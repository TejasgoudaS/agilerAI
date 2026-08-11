import os
import json
import re
import time
import httpx
from rag_engine import rag_engine
from codebase_indexer import codebase_indexer
from observability import telemetry_tracker
from grounding_checker import annotate_stories_with_grounding
from velocity_calibrator import velocity_calibrator

try:
    from crewai import Agent, Task, Crew, Process
except Exception:
    # Resilient fallback if crewai package or C-extensions are unavailable
    class Agent:
        def __init__(self, role="", goal="", backstory="", llm="", max_iter=1, verbose=False):
            self.role = role
            self.goal = goal
            self.backstory = backstory

    class Task:
        def __init__(self, description="", expected_output="", agent=None):
            self.description = description
            self.expected_output = expected_output
            self.agent = agent

    class Process:
        sequential = "sequential"

    class Crew:
        def __init__(self, agents=None, tasks=None, process=None, verbose=False):
            self.agents = agents or []
            self.tasks = tasks or []

        def kickoff(self):
            api_key = os.getenv("OPENAI_API_KEY", "")
            if not self.tasks or not api_key:
                return "{}"
            task = self.tasks[0]
            try:
                with httpx.Client(timeout=60.0) as client:
                    resp = client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json={
                            "model": "gpt-4o",
                            "messages": [
                                {"role": "system", "content": f"You are {getattr(task.agent, 'role', 'AI Assistant')}. {getattr(task.agent, 'backstory', '')}"},
                                {"role": "user", "content": task.description}
                            ],
                            "temperature": 0.2
                        }
                    )
                    if resp.status_code == 200:
                        return resp.json()["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"Fallback LLM call error: {e}")
            return "{}"


def get_openai_key():
    return os.getenv("VITE_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")


def parse_json_from_text(text):
    """Extract JSON from text that might contain explanation around it."""
    text = str(text)
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return None


# Below this overall QA score (0-100), the pipeline sends one bounded
# revision pass back to the PM agent (Reflexion / self-refine pattern).
# Bounded to a single retry so a stubborn low score can't loop forever
# and blow up latency/cost.
QA_QUALITY_THRESHOLD = 75


def _run_pm_agent(epics_json, kg_context, repo_context_json, llm_model, critique_note=""):
    """Runs the PM Agent to draft (or, with `critique_note`, revise) user stories."""
    pm_agent = Agent(
        role="Senior Product Manager",
        goal="Draft clear, developer-focused user stories from PRD epics with precise Gherkin acceptance criteria.",
        backstory="You write clear, modular user stories grounded in user goals and engineering architecture.",
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    revision_block = f"""

QA REVIEW FEEDBACK FROM PRIOR DRAFT — you MUST address these specific issues in this revision:
{critique_note}
""" if critique_note else ""

    pm_task = Task(
        description=f"""Given these epics, generate user stories.

Epics:
{epics_json}

Architecture Context:
{kg_context}

Repo Code Impact:
{repo_context_json}
{revision_block}
For each epic, generate stories. Each story must include:
- id (S1, S2, ...)
- epicId (matching the epic)
- title: "As a [user], I want [goal] so that [benefit]"
- description: Detailed technical description
- acceptanceCriteria: 3-5 Given/When/Then statements
- storyPoints: Fibonacci (1,2,3,5,8,13)
- type: feature|bug|task|spike
- labels: ["frontend","backend","database","api","ui","auth"]
- complexity: low|medium|high

Respond ONLY in RAW JSON:
{{"stories": [...]}}""",
        expected_output="JSON object with stories array",
        agent=pm_agent
    )

    t0 = time.time()
    pm_crew = Crew(agents=[pm_agent], tasks=[pm_task], process=Process.sequential, verbose=False)
    pm_result = pm_crew.kickoff()
    dur = time.time() - t0
    pm_stories = parse_json_from_text(str(pm_result)) or {"stories": []}
    return pm_stories, str(pm_result), dur


def _run_engineer_agent(stories_json, repo_context_json, codebase_context, team_json, repo_impact, llm_model):
    engineer_agent = Agent(
        role="Lead Software Engineer",
        goal="Review stories against actual repo code structure, assign grounded story points, and list specific affected files.",
        backstory=(
            "You are a lead engineer who estimates story points based on code complexity, "
            "number of affected files, API integrations, and pull request breakdown."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    engineer_task = Task(
        description=f"""Review and enhance these user stories by grounding story points in actual code repository changes.

Stories from PM:
{stories_json}

Repo Impact Context:
{repo_context_json}

Codebase Files Sample:
{codebase_context}

Team Skills:
{team_json}

For each story:
1. Ground story points in real implementation effort:
   - 1 point: minor tweak in 1 file
   - 2 points: simple component or function addition in 1-2 files
   - 3 points: multi-file update with UI + logic
   - 5 points: backend API + UI + database migration
   - 8 points: complex multi-module architecture change
   - 13 points: high-risk core refactor across systems
2. Add `affectedFiles`: list exact file paths from codebase sample or project structure.
3. Add `locEstimate`: estimated lines of code changed (e.g. 50, 150).
4. Add `prBreakdown`: recommended PR title or split strategy.

Respond ONLY in RAW JSON format:
{{"stories": [same structure but enhanced with affectedFiles, locEstimate, prBreakdown]}}""",
        expected_output="JSON object with enhanced stories array",
        agent=engineer_agent
    )

    t0 = time.time()
    eng_crew = Crew(agents=[engineer_agent], tasks=[engineer_task], process=Process.sequential, verbose=False)
    eng_result = eng_crew.kickoff()
    dur = time.time() - t0
    eng_stories = parse_json_from_text(str(eng_result))
    return eng_stories, str(eng_result), dur


def _run_qa_agent(stories, prd_text, llm_model):
    """
    QA Agent: audits stories for acceptance-criteria completeness, sizing
    sanity, and the deterministic groundingScore already attached to each
    story (computed by grounding_checker, not self-reported by an LLM).
    Produces a 0-100 quality score that drives the reflection loop below.
    """
    qa_agent = Agent(
        role="Senior QA Engineer",
        goal="Audit user stories for testability, acceptance-criteria completeness, and sizing sanity before they reach a sprint board.",
        backstory=(
            "You are a QA lead who rejects stories with vague acceptance criteria, "
            "missing edge cases, or story points that don't match the described scope."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    stories_for_review = json.dumps([
        {
            "id": s.get("id"), "title": s.get("title"), "acceptanceCriteria": s.get("acceptanceCriteria"),
            "storyPoints": s.get("storyPoints"), "complexity": s.get("complexity"),
            "groundingScore": s.get("groundingScore"), "ungroundedFiles": s.get("ungroundedFiles"),
        }
        for s in stories
    ], indent=2)

    qa_task = Task(
        description=f"""Audit these user stories before they are pushed to Jira.

PRD Excerpt:
{prd_text[:1500]}

Stories (including a deterministic `groundingScore` 0-1 computed by cross-checking
`affectedFiles` against the real indexed repository — NOT self-reported):
{stories_for_review}

For each story, score 0-100 on: acceptance-criteria completeness/testability, and
story-point sanity given its complexity. Treat any `groundingScore` below 0.5 (when
`ungroundedFiles` is non-empty) as a serious red flag — those files were referenced
but don't exist in the repository, which means the estimate may be based on
hallucinated context.

Respond ONLY in RAW JSON:
{{
  "storyScores": [{{"id": "S1", "qualityScore": 0-100, "issues": ["..."]}}],
  "overallQualityScore": 0-100,
  "readyForSprint": true|false,
  "summary": "one-paragraph critique to hand back to the PM agent if revision is needed"
}}""",
        expected_output="RAW JSON with storyScores, overallQualityScore, readyForSprint, summary",
        agent=qa_agent
    )

    t0 = time.time()
    qa_crew = Crew(agents=[qa_agent], tasks=[qa_task], process=Process.sequential, verbose=False)
    qa_result = qa_crew.kickoff()
    dur = time.time() - t0
    qa_report = parse_json_from_text(str(qa_result))
    return qa_report, str(qa_result), dur


def _apply_qa_scores(stories, qa_report):
    """Attach per-story QA scores/issues onto the story objects in-place."""
    if not qa_report:
        return
    by_id = {s.get("id"): s for s in qa_report.get("storyScores", []) if s.get("id")}
    for story in stories:
        match = by_id.get(story.get("id"))
        if match:
            story["qaQualityScore"] = match.get("qualityScore")
            story["qaIssues"] = match.get("issues", [])


def _apply_calibration(stories):
    """Attach velocity_calibrator's calibrated estimate onto each story, alongside the raw AI one."""
    for story in stories:
        calibration = velocity_calibrator.calibrate(story)
        story["calibratedStoryPoints"] = calibration["calibratedEstimate"]
        story["calibrationApplied"] = calibration["calibrated"]


def run_pipeline(prd_text, epics, team, event_queue, codebase_path=None):
    """
    Run the Codebase-Aware Multi-Agent CrewAI pipeline with RAG & Telemetry.
    Streams SSE events: agent_start, agent_thought, agent_complete, telemetry, final_result.

    Agents: Repo Codebase Analyzer -> Architect -> PM -> Engineer -> QA, with a
    bounded (max 1) reflection pass back to PM if QA's overall quality score is
    below QA_QUALITY_THRESHOLD.
    """
    api_key = get_openai_key()
    if not api_key:
        event_queue.put({"type": "error", "message": "OpenAI API key not found in .env"})
        return

    os.environ["OPENAI_API_KEY"] = api_key
    llm_model = "gpt-4o"
    epics_json = json.dumps(epics, indent=2)
    team_json = json.dumps(team, indent=2)

    # Initialize observability telemetry tracking
    telemetry_tracker.start_pipeline()

    # ═════════════════════════════════════════════════════════════════════
    # AGENT 0: Repo Codebase Analyzer Agent — RAG Code Context Extraction
    # ═════════════════════════════════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "Repo Codebase Analyzer Agent",
        "role": "Lead Codebase RAG Specialist",
        "description": "Cross-referencing PRD requirements with indexed repository files..."
    })

    t0 = time.time()
    codebase_context = rag_engine.get_codebase_context_str(prd_text[:1500], top_k=6)

    # Push initial codebase indexing telemetry
    repo_stats = codebase_indexer.stats
    event_queue.put({
        "type": "agent_thought",
        "agent": "Repo Codebase Analyzer Agent",
        "text": f"Found {len(codebase_indexer.indexed_files)} files in index. Extracted relevant files for PRD context."
    })

    code_analyzer = Agent(
        role="Lead Codebase RAG Specialist",
        goal="Identify existing codebase files, APIs, and components impacted by new PRD features.",
        backstory=(
            "You are a principal codebase architect who deeply analyzes code repositories. "
            "You inspect AST structures, exported interfaces, and files to map feature changes to exact repository locations."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    code_task = Task(
        description=f"""Analyze the PRD against the indexed Codebase Context.

PRD Excerpt:
{prd_text[:3000]}

Codebase Context:
{codebase_context}

Identify:
1. Affected existing files or components.
2. New files/modules required.
3. Estimated lines of code changes (LOC).
4. System complexity risk.

Respond ONLY in RAW JSON format:
{{
  "affectedFiles": ["src/components/..., server/..."],
  "locEstimate": 250,
  "impactSummary": "Description of repo modifications required",
  "technicalDebtRisk": "low|medium|high"
}}""",
        expected_output="JSON object with affectedFiles, locEstimate, and impactSummary",
        agent=code_analyzer
    )

    try:
        code_crew = Crew(agents=[code_analyzer], tasks=[code_task], process=Process.sequential, verbose=False)
        code_res = code_crew.kickoff()
        dur = time.time() - t0
        repo_impact = parse_json_from_text(str(code_res)) or {
            "affectedFiles": ["src/App.jsx", "server/main.py"],
            "locEstimate": 150,
            "impactSummary": "Standard feature integration",
            "technicalDebtRisk": "medium"
        }

        telemetry_record = telemetry_tracker.record_agent_step(
            "Repo Codebase Analyzer Agent", llm_model, f"{prd_text[:1000]}{codebase_context}", str(code_res), dur
        )

        event_queue.put({
            "type": "agent_complete",
            "agent": "Repo Codebase Analyzer Agent",
            "output": f"Mapped {len(repo_impact.get('affectedFiles', []))} repository files to PRD requirements",
            "data": repo_impact,
            "telemetry": telemetry_record
        })
    except Exception as e:
        repo_impact = {"affectedFiles": [], "locEstimate": 100, "impactSummary": "Codebase search completed", "technicalDebtRisk": "low"}
        event_queue.put({"type": "agent_thought", "agent": "Repo Codebase Analyzer Agent", "text": f"Warning: {str(e)}"})

    repo_context_json = json.dumps(repo_impact, indent=2)

    # ═══════════════════════════════════════════
    # AGENT 1: Architect Agent — Knowledge Graph
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "Architect Agent",
        "role": "Solutions Architect",
        "description": "Building code-grounded architecture knowledge graph..."
    })

    t0 = time.time()
    architect = Agent(
        role="Principal Solutions Architect",
        goal="Extract a comprehensive architecture knowledge graph combining PRD requirements with existing code components.",
        backstory=(
            "You are a principal solutions architect. "
            "You map product specs directly to code components, services, database models, and API endpoints."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    architect_task = Task(
        description=f"""Analyze PRD and Codebase Impact to construct an architectural Knowledge Graph.

PRD Text:
{prd_text[:3500]}

Repo Code Impact Context:
{repo_context_json}

Respond ONLY in RAW JSON format:
{{
  "entities": [
    {{"id": "svc-1", "name": "Auth Service", "type": "service|api|database|external|component"}}
  ],
  "relationships": [
    {{"from": "svc-1", "to": "db-1", "label": "reads/writes"}}
  ]
}}""",
        expected_output="RAW JSON with entities and relationships arrays",
        agent=architect
    )

    try:
        architect_crew = Crew(agents=[architect], tasks=[architect_task], process=Process.sequential, verbose=False)
        architect_result = architect_crew.kickoff()
        dur = time.time() - t0
        knowledge_graph = parse_json_from_text(str(architect_result)) or {"entities": [], "relationships": []}

        telemetry_record = telemetry_tracker.record_agent_step(
            "Architect Agent", llm_model, f"{prd_text[:1000]}{repo_context_json}", str(architect_result), dur
        )

        event_queue.put({
            "type": "agent_complete",
            "agent": "Architect Agent",
            "output": f"Extracted {len(knowledge_graph.get('entities', []))} entities and {len(knowledge_graph.get('relationships', []))} relationships",
            "data": knowledge_graph,
            "telemetry": telemetry_record
        })
    except Exception as e:
        knowledge_graph = {"entities": [], "relationships": []}
        event_queue.put({"type": "agent_thought", "agent": "Architect Agent", "text": f"Warning: {str(e)}"})
        event_queue.put({"type": "agent_complete", "agent": "Architect Agent", "output": "Completed with warnings", "data": knowledge_graph})

    kg_context = json.dumps(knowledge_graph, indent=2)

    # ═══════════════════════════════════════════
    # AGENT 2: PM Agent — Draft Stories
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "PM Agent",
        "role": "Senior Product Manager",
        "description": "Drafting user stories from epics with code impact context..."
    })

    try:
        pm_stories, pm_raw, dur = _run_pm_agent(epics_json, kg_context, repo_context_json, llm_model)

        telemetry_record = telemetry_tracker.record_agent_step(
            "PM Agent", llm_model, f"{epics_json}{kg_context}", pm_raw, dur
        )

        event_queue.put({
            "type": "agent_complete",
            "agent": "PM Agent",
            "output": f"Drafted {len(pm_stories.get('stories', []))} user stories",
            "stories": pm_stories.get("stories", []),
            "telemetry": telemetry_record
        })
    except Exception as e:
        event_queue.put({"type": "error", "message": f"PM Agent failed: {str(e)}"})
        return

    # ═════════════════════════════════════════════════════════════════════
    # AGENT 3: Lead Engineer Agent — Code-Grounded Points & File Mapping
    # ═════════════════════════════════════════════════════════════════════
    def run_engineer_pass(stories_payload):
        stories_json = json.dumps(stories_payload.get("stories", []), indent=2)
        event_queue.put({
            "type": "agent_start",
            "agent": "Engineer Agent",
            "role": "Lead Software Engineer",
            "description": "Performing code-grounded story point estimation & file diff mapping..."
        })
        try:
            eng_stories, eng_raw, dur = _run_engineer_agent(
                stories_json, repo_context_json, codebase_context, team_json, repo_impact, llm_model
            )
            eng_stories = eng_stories or stories_payload

            # Fallback enrichment if LLM omitted file fields
            for s in eng_stories.get("stories", []):
                if "affectedFiles" not in s or not s["affectedFiles"]:
                    s["affectedFiles"] = repo_impact.get("affectedFiles", ["src/App.jsx"])[:2]
                if "locEstimate" not in s:
                    pts = int(s.get("storyPoints", 3))
                    s["locEstimate"] = pts * 40

            telemetry_record = telemetry_tracker.record_agent_step(
                "Engineer Agent", llm_model, f"{stories_json}{repo_context_json}", eng_raw, dur
            )

            event_queue.put({
                "type": "agent_complete",
                "agent": "Engineer Agent",
                "output": f"Reviewed {len(eng_stories.get('stories', []))} stories with code-grounded estimation & file mapping",
                "stories": eng_stories.get("stories", []),
                "telemetry": telemetry_record
            })
            return eng_stories
        except Exception as e:
            event_queue.put({"type": "agent_thought", "agent": "Engineer Agent", "text": f"Warning: {str(e)}"})
            event_queue.put({"type": "agent_complete", "agent": "Engineer Agent", "output": "Completed with fallback"})
            return stories_payload

    eng_stories = run_engineer_pass(pm_stories)

    # ── Deterministic grounding guardrail (no LLM call) ─────────────────
    grounding_summary = annotate_stories_with_grounding(eng_stories.get("stories", []))
    event_queue.put({
        "type": "agent_thought",
        "agent": "Engineer Agent",
        "text": f"Grounding check: {grounding_summary['storiesWithHallucinatedFiles']} of "
                f"{grounding_summary['storiesChecked']} stories reference files not found in the "
                f"indexed repo (avg groundingScore={grounding_summary['averageGroundingScore']})."
    })

    # ── ML velocity calibration (Ridge regression on historical estimate->actual) ──
    _apply_calibration(eng_stories.get("stories", []))

    # ═══════════════════════════════════════════
    # AGENT 4: QA Agent — Quality Audit + Bounded Reflection
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "QA Agent",
        "role": "Senior QA Engineer",
        "description": "Auditing acceptance criteria, sizing, and codebase grounding..."
    })

    revision_applied = False
    qa_report = None
    try:
        qa_report, qa_raw, qa_dur = _run_qa_agent(eng_stories.get("stories", []), prd_text, llm_model)
        _apply_qa_scores(eng_stories.get("stories", []), qa_report)

        telemetry_record = telemetry_tracker.record_agent_step(
            "QA Agent", llm_model, json.dumps(eng_stories.get("stories", []))[:2000], qa_raw, qa_dur
        )

        overall_score = (qa_report or {}).get("overallQualityScore")
        event_queue.put({
            "type": "agent_complete",
            "agent": "QA Agent",
            "output": f"Quality audit complete — overall score {overall_score if overall_score is not None else 'n/a'}/100",
            "stories": eng_stories.get("stories", []),
            "data": {"overallQualityScore": overall_score, "readyForSprint": (qa_report or {}).get("readyForSprint")},
            "telemetry": telemetry_record
        })

        # ── Bounded reflection: one revision pass if quality is below threshold ──
        if qa_report and isinstance(overall_score, (int, float)) and overall_score < QA_QUALITY_THRESHOLD:
            critique = qa_report.get("summary", "Improve acceptance criteria detail and story point accuracy.")
            event_queue.put({
                "type": "agent_thought",
                "agent": "PM Agent",
                "text": f"QA score {overall_score}/100 is below the {QA_QUALITY_THRESHOLD} threshold — "
                        f"revising stories once based on QA feedback: {critique}"
            })

            event_queue.put({
                "type": "agent_start",
                "agent": "PM Agent",
                "role": "Senior Product Manager",
                "description": "Revising stories based on QA critique (reflection pass)..."
            })
            revised_pm_stories, revised_pm_raw, revised_dur = _run_pm_agent(
                epics_json, kg_context, repo_context_json, llm_model, critique_note=critique
            )
            telemetry_record = telemetry_tracker.record_agent_step(
                "PM Agent (revision)", llm_model, critique, revised_pm_raw, revised_dur
            )
            event_queue.put({
                "type": "agent_complete",
                "agent": "PM Agent",
                "output": f"Revised draft: {len(revised_pm_stories.get('stories', []))} stories",
                "stories": revised_pm_stories.get("stories", []),
                "telemetry": telemetry_record
            })

            eng_stories = run_engineer_pass(revised_pm_stories)
            grounding_summary = annotate_stories_with_grounding(eng_stories.get("stories", []))
            _apply_calibration(eng_stories.get("stories", []))

            # Re-score once (not re-looped — bounded to a single reflection pass)
            qa_report, qa_raw2, qa_dur2 = _run_qa_agent(eng_stories.get("stories", []), prd_text, llm_model)
            _apply_qa_scores(eng_stories.get("stories", []), qa_report)
            revision_applied = True

            event_queue.put({
                "type": "agent_complete",
                "agent": "QA Agent",
                "output": f"Post-revision quality score: {(qa_report or {}).get('overallQualityScore', 'n/a')}/100",
                "stories": eng_stories.get("stories", []),
                "data": {"overallQualityScore": (qa_report or {}).get("overallQualityScore"),
                         "readyForSprint": (qa_report or {}).get("readyForSprint")}
            })
    except Exception as e:
        event_queue.put({"type": "agent_thought", "agent": "QA Agent", "text": f"Warning: {str(e)}"})
        event_queue.put({"type": "agent_complete", "agent": "QA Agent", "output": "Completed with warnings"})

    # ═══════════════════════════════════════════
    # Final Result + Telemetry Summary
    # ═══════════════════════════════════════════
    telemetry_summary = telemetry_tracker.get_summary()

    event_queue.put({
        "type": "final_result",
        "stories": eng_stories.get("stories", []),
        "knowledgeGraph": knowledge_graph,
        "repoImpact": repo_impact,
        "telemetry": telemetry_summary,
        "qualityReport": qa_report,
        "groundingSummary": grounding_summary,
        "reflectionApplied": revision_applied,
        "calibrationStatus": velocity_calibrator.status(),
    })
