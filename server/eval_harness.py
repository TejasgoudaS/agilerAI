"""
LLM-as-judge evaluation harness with a golden dataset and regression testing.

Prompt/agent changes in an LLM pipeline are silent — nothing breaks at
import time if a prompt tweak quietly makes story quality worse. This
harness runs a small, fixed set of PRDs through the real PM + Engineer
agents, scores the output on a rubric, and diffs the result against the
last saved baseline so a quality regression shows up as a concrete,
numeric failure instead of "seemed fine when I glanced at it."

Design choices worth calling out:
  - The "grounded" dimension is NOT judged by the LLM — it's the
    deterministic groundingScore from grounding_checker, rescaled to the
    same 1-5 scale as the other dimensions. We don't ask a model to
    self-report something we can verify exactly.
  - The judge model defaults to gpt-4o-mini (cheap) since this harness is
    meant to run often (e.g. before merging a prompt change), not just once.
  - Golden PRDs skip the Repo Analyzer/Architect stages (their output isn't
    what determines story-writing quality) and go straight to PM + Engineer,
    which keeps a full run to a handful of LLM calls instead of dozens.
"""
import os
import re
import json
import time
import httpx

from crew_pipeline import _run_pm_agent, _run_engineer_agent, get_openai_key
from grounding_checker import annotate_stories_with_grounding
from rag_engine import rag_engine

JUDGE_MODEL = "gpt-4o-mini"
BASELINE_PATH = os.path.join(os.path.dirname(__file__), "eval_baseline.json")
REGRESSION_THRESHOLD = 0.4  # points on a 1-5 scale
MAX_STORIES_JUDGED_PER_PRD = 4  # bound judging cost per golden PRD

GOLDEN_DATASET = [
    {
        "id": "auth-mfa",
        "prdText": (
            "Add multi-factor authentication (MFA) to the login flow. Users should be able to "
            "enable TOTP-based 2FA from account settings, scan a QR code with an authenticator app, "
            "and be prompted for a 6-digit code on subsequent logins. Support backup recovery codes "
            "in case the user loses their device."
        ),
        "epics": [{"id": "E1", "title": "Multi-Factor Authentication", "description": "TOTP-based 2FA with recovery codes"}],
    },
    {
        "id": "billing-webhook",
        "prdText": (
            "Integrate Stripe billing: subscribe/cancel/upgrade a plan from the app, and reconcile "
            "subscription state via Stripe webhooks (invoice.paid, customer.subscription.deleted). "
            "Failed payments should downgrade the account to a free tier after 3 retries and notify "
            "the user by email."
        ),
        "epics": [{"id": "E1", "title": "Stripe Billing Integration", "description": "Plan management + webhook reconciliation"}],
    },
    {
        "id": "notif-prefs",
        "prdText": (
            "Let users configure notification preferences per channel (email, in-app, Slack) and per "
            "event type (mentions, assignments, due-date reminders). Preferences must be respected by "
            "every notification-sending code path, and there should be a sensible default for new users."
        ),
        "epics": [{"id": "E1", "title": "Notification Preferences", "description": "Per-channel, per-event opt-in/out"}],
    },
]


def _judge_call(prompt: str, api_key: str) -> dict:
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": JUDGE_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a strict, consistent quality judge for agile user stories. Always respond with raw JSON only."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        try:
            return json.loads(content)
        except Exception:
            match = re.search(r'(\{[\s\S]*\})', content)
            return json.loads(match.group(1)) if match else {}


def judge_story(story: dict, prd_text: str, api_key: str) -> dict:
    """LLM-as-judge: scores clarity, testability, and sizing reasonableness on a 1-5 scale."""
    prompt = f"""Score this user story on a strict 1-5 scale (5 = excellent, 1 = unacceptable).

PRD context:
{prd_text}

Story:
{json.dumps({k: story.get(k) for k in ('title', 'description', 'acceptanceCriteria', 'storyPoints', 'complexity')}, indent=2)}

Respond ONLY in RAW JSON:
{{
  "clarity": 1-5,
  "testability": 1-5,
  "sizingReasonableness": 1-5,
  "rationale": "one sentence"
}}"""
    try:
        result = _judge_call(prompt, api_key)
    except Exception as e:
        result = {"clarity": None, "testability": None, "sizingReasonableness": None, "rationale": f"judge error: {e}"}

    grounding_score = story.get("groundingScore")
    grounded_5pt = round(grounding_score * 4 + 1, 2) if grounding_score is not None else None
    result["grounded"] = grounded_5pt
    dims = [v for v in (result.get("clarity"), result.get("testability"), result.get("sizingReasonableness"), grounded_5pt) if v is not None]
    result["overall"] = round(sum(dims) / len(dims), 2) if dims else None
    return result


def _generate_stories_for_golden_prd(golden: dict, api_key: str) -> list:
    """Runs the real PM + Engineer agents (skipping Repo Analyzer/Architect for speed) against a golden PRD."""
    epics_json = json.dumps(golden["epics"], indent=2)
    codebase_context = rag_engine.get_codebase_context_str(golden["prdText"][:1500], top_k=4)
    repo_context_json = json.dumps({"affectedFiles": [], "locEstimate": 0, "impactSummary": "eval mode", "technicalDebtRisk": "low"})
    kg_context = json.dumps({"entities": [], "relationships": []})

    pm_stories, _, _ = _run_pm_agent(epics_json, kg_context, repo_context_json, "gpt-4o")
    stories_json = json.dumps(pm_stories.get("stories", []), indent=2)
    eng_stories, _, _ = _run_engineer_agent(stories_json, repo_context_json, codebase_context, "[]", {}, "gpt-4o")
    stories = (eng_stories or pm_stories).get("stories", [])
    annotate_stories_with_grounding(stories)
    return stories


def run_golden_eval(api_key: str = None) -> dict:
    api_key = api_key or get_openai_key()
    if not api_key:
        raise RuntimeError("No OpenAI API key configured")

    per_prd = []
    dim_totals = {"clarity": [], "testability": [], "sizingReasonableness": [], "grounded": [], "overall": []}

    for golden in GOLDEN_DATASET:
        stories = _generate_stories_for_golden_prd(golden, api_key)
        judged = []
        for story in stories[:MAX_STORIES_JUDGED_PER_PRD]:
            score = judge_story(story, golden["prdText"], api_key)
            judged.append({"title": story.get("title", "")[:80], **score})
            for dim in dim_totals:
                if score.get(dim) is not None:
                    dim_totals[dim].append(score[dim])

        prd_avg = {
            dim: round(sum(s.get(dim) for s in judged if s.get(dim) is not None) /
                       max(1, len([s for s in judged if s.get(dim) is not None])), 2)
            if any(s.get(dim) is not None for s in judged) else None
            for dim in dim_totals
        }
        per_prd.append({
            "id": golden["id"],
            "storiesGenerated": len(stories),
            "storiesJudged": len(judged),
            "scores": judged,
            "average": prd_avg,
        })

    aggregate = {
        dim: round(sum(vals) / len(vals), 2) if vals else None
        for dim, vals in dim_totals.items()
    }

    report = {
        "goldenCount": len(GOLDEN_DATASET),
        "totalStoriesJudged": sum(p["storiesJudged"] for p in per_prd),
        "perPrd": per_prd,
        "aggregate": aggregate,
        "timestamp": time.time(),
    }

    report["regression"] = _check_regression(aggregate)
    return report


def _load_baseline() -> dict:
    if os.path.exists(BASELINE_PATH):
        try:
            with open(BASELINE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _check_regression(aggregate: dict) -> dict:
    baseline = _load_baseline()
    if not baseline:
        return {"baselineExists": False, "regressed": False, "deltas": {}}

    deltas = {}
    regressed = False
    for dim, current_val in aggregate.items():
        base_val = baseline.get(dim)
        if current_val is None or base_val is None:
            continue
        delta = round(current_val - base_val, 2)
        deltas[dim] = delta
        if delta <= -REGRESSION_THRESHOLD:
            regressed = True

    return {"baselineExists": True, "regressed": regressed, "deltas": deltas, "threshold": REGRESSION_THRESHOLD}


def save_as_baseline(aggregate: dict):
    with open(BASELINE_PATH, "w", encoding="utf-8") as f:
        json.dump(aggregate, f, indent=2)
