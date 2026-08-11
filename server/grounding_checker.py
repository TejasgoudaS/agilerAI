"""
Grounding / hallucination guardrail.

LLM agents routinely invent plausible-looking file paths. Since this
product already indexes the real repository, we don't have to trust the
model's self-report of "affected files" — we can verify it deterministically
against codebase_indexer's actual index. No LLM call involved: pure,
fast, reproducible Python.
"""
import os
from codebase_indexer import codebase_indexer


def _normalize(path: str) -> str:
    return str(path or "").strip().replace("\\", "/").lstrip("./").lower()


def _real_path_set() -> set:
    return {_normalize(f["path"]) for f in codebase_indexer.indexed_files}


def check_story_grounding(story: dict) -> dict:
    """
    Cross-checks a story's `affectedFiles` against the real indexed
    repository. Returns groundingScore (0-1), verifiedFiles, and
    ungroundedFiles (claimed paths that don't exist in the repo).
    """
    referenced = [f for f in (story.get("affectedFiles") or []) if f]
    if not referenced:
        return {"groundingScore": None, "verifiedFiles": [], "ungroundedFiles": [], "referencedCount": 0}

    real_paths = _real_path_set()
    real_basenames = {os.path.basename(p): p for p in real_paths}

    verified, ungrounded = [], []
    for raw in referenced:
        norm = _normalize(raw)
        if norm in real_paths:
            verified.append(raw)
            continue
        # Fallback: allow a match on basename (agent may abbreviate directory depth)
        base = os.path.basename(norm)
        if base in real_basenames:
            verified.append(raw)
            continue
        ungrounded.append(raw)

    score = round(len(verified) / len(referenced), 3)
    return {
        "groundingScore": score,
        "verifiedFiles": verified,
        "ungroundedFiles": ungrounded,
        "referencedCount": len(referenced),
    }


def annotate_stories_with_grounding(stories: list) -> dict:
    """Mutates each story in-place with grounding fields; returns an aggregate summary."""
    scored = []
    for story in stories:
        result = check_story_grounding(story)
        story["groundingScore"] = result["groundingScore"]
        story["ungroundedFiles"] = result["ungroundedFiles"]
        if result["groundingScore"] is not None:
            scored.append(result["groundingScore"])

    return {
        "storiesChecked": len(stories),
        "storiesWithReferences": len(scored),
        "averageGroundingScore": round(sum(scored) / len(scored), 3) if scored else None,
        "storiesWithHallucinatedFiles": sum(1 for s in stories if s.get("ungroundedFiles")),
    }
