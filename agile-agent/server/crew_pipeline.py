import os
import json
import re
from crewai import Agent, Task, Crew, Process


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


def run_pipeline(prd_text, epics, team, event_queue):
    """Run the full 4-agent CrewAI pipeline, pushing SSE events to the queue."""
    api_key = get_openai_key()
    if not api_key:
        event_queue.put({"type": "error", "message": "OpenAI API key not found in .env"})
        return

    os.environ["OPENAI_API_KEY"] = api_key
    llm_model = "gpt-4o"
    epics_json = json.dumps(epics, indent=2)
    team_json = json.dumps(team, indent=2)

    # ═══════════════════════════════════════════
    # AGENT 1: Architect Agent — Knowledge Graph
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "Architect Agent",
        "role": "Solutions Architect",
        "description": "Extracting architecture knowledge graph from PRD..."
    })

    architect = Agent(
        role="Principal Solutions Architect",
        goal="Extract a comprehensive architecture knowledge graph from the PRD identifying services, APIs, databases, and their relationships.",
        backstory=(
            "You are a principal solutions architect with 15+ years in distributed systems. "
            "You read product documents and instantly map them to technical architecture components."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    architect_task = Task(
        description=f"""Analyze this PRD and extract a knowledge graph of architecture entities and relationships.

PRD Text:
{prd_text[:4000]}

Respond ONLY in JSON. Output RAW JSON ONLY without any markdown formatting, backticks, or preamble:
{{
  "entities": [
    {{"id": "svc-1", "name": "Auth Service", "type": "service|api|database|external|team"}},
  ],
  "relationships": [
    {{"from": "svc-1", "to": "db-1", "label": "reads/writes"}}
  ]
}}""",
        expected_output="A JSON object with entities and relationships arrays",
        agent=architect
    )

    architect_crew = Crew(agents=[architect], tasks=[architect_task], process=Process.sequential, verbose=False)

    try:
        architect_result = architect_crew.kickoff()
        knowledge_graph = parse_json_from_text(str(architect_result))
        if not knowledge_graph:
            knowledge_graph = {"entities": [], "relationships": []}

        event_queue.put({
            "type": "agent_complete",
            "agent": "Architect Agent",
            "output": f"Extracted {len(knowledge_graph.get('entities', []))} entities and {len(knowledge_graph.get('relationships', []))} relationships",
            "data": knowledge_graph
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
        "description": "Drafting user stories from epics..."
    })

    pm_agent = Agent(
        role="Senior Product Manager",
        goal="Draft comprehensive, user-focused stories from PRD epics with clear acceptance criteria.",
        backstory=(
            "You are a senior PM with 10+ years in agile product development. "
            "You write stories that are crystal clear for developers. "
            "You always consider the architecture context when writing stories."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    pm_task = Task(
        description=f"""Given these epics, generate user stories.

Epics:
{epics_json}

Architecture Context (Knowledge Graph):
{kg_context}

For each epic, generate user stories. Each story must have:
- id (S1, S2, ...)
- epicId (matching the epic)
- title: "As a [user], I want [goal] so that [benefit]"
- description: Detailed technical description
- acceptanceCriteria: 3-5 Given/When/Then statements
- storyPoints: Fibonacci (1,2,3,5,8,13)
- type: feature|bug|task|spike
- labels: ["frontend","backend","database","api","ui","auth"]
- complexity: low|medium|high

Respond ONLY in JSON. Output RAW JSON ONLY without any markdown formatting, backticks, or preamble:
{{"stories": [...]}}""",
        expected_output="JSON object with a stories array",
        agent=pm_agent
    )

    pm_crew = Crew(agents=[pm_agent], tasks=[pm_task], process=Process.sequential, verbose=False)

    try:
        pm_result = pm_crew.kickoff()
        pm_stories = parse_json_from_text(str(pm_result))
        if not pm_stories or "stories" not in pm_stories:
            pm_stories = {"stories": []}

        event_queue.put({
            "type": "agent_complete",
            "agent": "PM Agent",
            "output": f"Drafted {len(pm_stories['stories'])} stories",
            "stories": pm_stories["stories"]
        })
    except Exception as e:
        event_queue.put({"type": "error", "message": f"PM Agent failed: {str(e)}"})
        return

    stories_json = json.dumps(pm_stories["stories"], indent=2)

    # ═══════════════════════════════════════════
    # AGENT 3: Engineer Agent — Technical Review
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "agent_start",
        "agent": "Engineer Agent",
        "role": "Lead Software Engineer",
        "description": "Reviewing stories for technical feasibility..."
    })

    engineer_agent = Agent(
        role="Lead Software Engineer",
        goal="Review user stories for technical accuracy, adjust complexity and story points, add implementation notes.",
        backstory=(
            "You are a lead engineer who reviews stories before sprint planning. "
            "You ensure stories are technically feasible, properly scoped, and have accurate point estimates. "
            "You add technical implementation notes that help developers."
        ),
        llm=llm_model,
        max_iter=1,
        verbose=False
    )

    engineer_task = Task(
        description=f"""Review and enhance these user stories from a technical perspective.

Stories from PM:
{stories_json}

Architecture Context:
{kg_context}

Team:
{team_json}

For each story:
1. Review the complexity rating and adjust if needed
2. Adjust story points based on real implementation effort
3. Add or refine labels based on architecture
4. Keep the same JSON structure but improve descriptions with technical notes

Respond ONLY in JSON. Output RAW JSON ONLY without any markdown formatting, backticks, or preamble:
{{"stories": [same structure as input but enhanced]}}""",
        expected_output="JSON object with enhanced stories array",
        agent=engineer_agent
    )

    eng_crew = Crew(agents=[engineer_agent], tasks=[engineer_task], process=Process.sequential, verbose=False)

    try:
        eng_result = eng_crew.kickoff()
        eng_stories = parse_json_from_text(str(eng_result))
        if not eng_stories or "stories" not in eng_stories:
            eng_stories = pm_stories  # fallback

        event_queue.put({
            "type": "agent_complete",
            "agent": "Engineer Agent",
            "output": f"Reviewed {len(eng_stories['stories'])} stories with technical enhancements",
            "stories": eng_stories["stories"]
        })
    except Exception as e:
        eng_stories = pm_stories
        event_queue.put({"type": "agent_thought", "agent": "Engineer Agent", "text": f"Warning: {str(e)}"})
        event_queue.put({"type": "agent_complete", "agent": "Engineer Agent", "output": "Completed with fallback"})

    reviewed_json = json.dumps(eng_stories["stories"], indent=2)

    # ═══════════════════════════════════════════
    # Final Result
    # ═══════════════════════════════════════════
    event_queue.put({
        "type": "final_result",
        "stories": eng_stories.get("stories", []),
        "knowledgeGraph": knowledge_graph
    })
