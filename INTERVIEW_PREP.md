# Agiler AI — Complete Technical Reference & Interview Prep

> **What this is:** A from-scratch, file-by-file explanation of every part of this codebase — tech stack, architecture, data flow, and the reasoning behind every non-obvious decision — written so you can answer any question an interviewer throws at you about this project.

---

## Table of Contents

1. [30-Second Elevator Pitch](#1-30-second-elevator-pitch)
2. [Tech Stack At a Glance](#2-tech-stack-at-a-glance)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [End-to-End Data Flow](#5-end-to-end-data-flow-the-walkthrough-to-memorize)
6. [Backend Deep Dive (file by file)](#6-backend-deep-dive-file-by-file)
7. [Frontend Deep Dive (file by file)](#7-frontend-deep-dive-file-by-file)
8. [Database Schema](#8-database-schema)
9. [Authentication & Security Model](#9-authentication--security-model)
10. [The 5 AI-Engineering Differentiators](#10-the-5-ai-engineering-differentiators-deep-dive)
11. [API Reference](#11-api-reference)
12. [Known Limitations & Trade-offs](#12-known-limitations--trade-offs-be-ready-to-discuss-honestly)
13. [Anticipated Interview Q&A](#13-anticipated-interview-qa)
14. [How to Run It Locally](#14-how-to-run-it-locally)

---

## 1. 30-Second Elevator Pitch

> "Agiler AI turns a raw PRD document into a sprint-ready Jira backlog using a **5-agent CrewAI pipeline** — Repo Analyzer, Architect, PM, Engineer, and QA — that's **grounded in the actual codebase** via hybrid retrieval (BM25 + OpenAI embeddings, fused with reciprocal rank fusion), not just the PRD text. Story-point estimates are corrected over time by a small ML model trained on real Jira history, every generated story is deterministically fact-checked against the indexed repo so hallucinated file references get flagged, and there's a bounded self-critique loop where the QA agent's review can send stories back to the PM agent for one revision pass. The whole thing streams live via Server-Sent Events, is multi-tenant with per-user encrypted credentials, and ships with an LLM-as-judge regression-testing harness so prompt changes don't silently degrade quality."

That one paragraph hits: multi-agent orchestration, RAG, classical ML, hallucination mitigation, agentic self-refinement, real-time systems, security, and eval engineering — the exact surface area a FAANG interviewer probes.

---

## 2. Tech Stack At a Glance

### Frontend
| Layer | Choice | Why it matters |
|---|---|---|
| Framework | React 18.3 + Vite 5 | Fast HMR dev loop, ESM-native build |
| State | **Zustand** (single store, `src/store/appStore.js`) | No Context/Redux boilerplate — one flat store with plain functions as actions |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) | Utility-first, no separate PostCSS config needed in v4 |
| Graphs | `reactflow` | Renders the Dependency Graph and Knowledge Graph tabs |
| File parsing | `pdfjs-dist`, `mammoth` | Client-side PDF/DOCX text extraction — no server round-trip needed just to read a file |
| HTTP | `axios` (Jira calls) + native `fetch` (SSE streaming, since `axios` doesn't stream response bodies well) |
| Notifications | `react-hot-toast` |

### Backend
| Layer | Choice | Why it matters |
|---|---|---|
| Framework | **FastAPI** + Uvicorn | Async, auto OpenAPI docs, native Pydantic validation |
| Agent orchestration | **CrewAI** (`Agent`, `Task`, `Crew`, `Process.sequential`) | Structured multi-agent role/goal/backstory pattern instead of hand-rolled prompt chaining |
| ORM | **SQLModel** (SQLAlchemy + Pydantic combined) | One model class doubles as the DB table schema *and* the request/response type |
| Database | SQLite (`ai_agile.db`) locally, swappable to Postgres via `DATABASE_URL` env var | Zero-setup dev, prod-ready swap without code changes |
| Auth | `python-jose` (JWT), `passlib[bcrypt]` (password hashing) | Industry-standard, not hand-rolled crypto |
| Secrets at rest | `cryptography.Fernet` (AES-128-CBC + HMAC) | API keys/tokens encrypted before hitting the DB |
| ML | **scikit-learn** (`Ridge` regression) | The velocity calibrator — classical supervised ML, not another LLM call |
| Retrieval | **rank-bm25** (`BM25Okapi`) + OpenAI `text-embedding-3-small` | Hybrid sparse+dense search over the indexed repo |
| LLM provider | OpenAI (`gpt-4o` for agents, `gpt-4o-mini` for the eval judge) | Swappable — `WorkspaceConfig` also has an `anthropic_key_enc` field for future multi-provider support |
| HTTP client | `httpx` (async + sync) | Used for OpenAI calls, GitHub API, Confluence API, Jira proxying |

### Why these specific choices (be ready to justify)
- **Zustand over Redux**: this app has ~40 pieces of loosely-related UI/session state; Redux's action/reducer/dispatch ceremony buys nothing here — Zustand gives the same single-source-of-truth with plain function calls.
- **SQLModel over raw SQLAlchemy + separate Pydantic schemas**: halves the boilerplate — one `GenerationSession` class is simultaneously the table definition and (via helper methods like `get_stories()`/`set_stories()`) the JSON serialization layer.
- **CrewAI over a hand-rolled agent loop**: gives each agent a `role`/`goal`/`backstory` — this is what makes prompts modular and swappable per-agent instead of one giant monolithic system prompt.
- **SSE over WebSockets**: the pipeline is strictly server→client (agent progress events); the client never needs to push messages mid-run. SSE is simpler (plain HTTP, auto-reconnect semantics, works through more proxies) and `fetch` + `ReadableStream` gives full control without adding a WebSocket library.

---

## 3. System Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────────────┐
│         BROWSER              │        │            FASTAPI SERVER (:8000)     │
│  React SPA (Zustand store)   │◄──────►│  main.py — routes, SSE, static SPA    │
│                               │  HTTP  │  ├─ auth.py         (JWT + bcrypt)    │
│  - LandingPage / LoginPage   │  + SSE │  ├─ settings_router  (encrypted keys) │
│  - StoryBoard / AIQuality    │        │  ├─ sessions_router  (history)        │
│  - DependencyGraph (ReactFlow)│        │  ├─ integrations_analytics_router     │
│                               │        │  │    (GitHub, Confluence, Slack,     │
│  fetch('/api/generate-stories│        │  │     velocity, story ratings)       │
│    ') → ReadableStream        │        │  └─ crew_pipeline.py (5-agent run)   │
└─────────────┬─────────────────┘        └───────────────┬────────────────────┘
              │                                            │
              │ /rest/* (Jira proxy, prod)                 │ OpenAI API (gpt-4o,
              ▼                                            │ gpt-4o-mini, embeddings)
     ┌──────────────────┐                                  ▼
     │   Jira Cloud API  │                        ┌──────────────────────┐
     └──────────────────┘                        │  SQLite (ai_agile.db) │
                                                    │  Users, Sessions,     │
                                                    │  Jobs, Ratings, ...   │
                                                    └──────────────────────┘
```

**One process serves everything.** In production, FastAPI both serves the built React bundle (`dist/`, mounted via `StaticFiles` + an SPA-fallback catch-all route) *and* the JSON/SSE API *and* proxies Jira REST calls — all on port 8000. In dev, Vite (`:5173`) proxies `/api` and `/rest` to the FastAPI backend (`:8000`) so there's no CORS friction (`vite.config.js`).

**Why proxy Jira instead of calling it directly from the browser?** Two reasons:
1. Jira Cloud's CORS policy won't allow arbitrary browser origins.
2. In prod, the backend attaches the *authenticated user's own* encrypted Jira credentials (from `WorkspaceConfig`) rather than baking one shared token into the frontend bundle — this is what makes the app actually multi-tenant instead of single-shared-account.

---

## 4. Repository Structure

```
ai-jira/
├── src/                        # React frontend
│   ├── App.jsx                 # Root component — header, tab bar, routing via currentStep
│   ├── store/appStore.js       # The one Zustand store (auth, session, pipeline, UI state)
│   ├── hooks/
│   │   ├── usePRDProcessor.js  # Orchestrates: parse PRD → run agent pipeline → assign → depend → sprint
│   │   └── useJiraSync.js      # Pushes epics/stories/links to Jira via jiraClient
│   ├── lib/
│   │   ├── aiClient.js         # SSE consumer for /api/generate-stories + direct-LLM fallback calls
│   │   ├── jiraClient.js       # Jira REST v3 / Agile v1.0 wrapper (axios, via /rest proxy)
│   │   ├── fileParser.js       # PDF (pdfjs-dist) / DOCX (mammoth) → plain text
│   │   ├── storyTransformer.js # Normalizes raw AI JSON into safe story/epic shapes
│   │   └── prompts.js          # System prompts for the *fallback* (non-agent) direct LLM path
│   └── components/              # ~25 components — story board, graphs, modals, panels
├── server/                      # FastAPI backend
│   ├── main.py                  # App entrypoint, route mounting, SSE endpoints, Jira proxy, SPA serving
│   ├── auth.py                  # JWT + bcrypt + Fernet encryption + /api/auth/*
│   ├── database.py              # SQLModel engine/session (SQLite, Postgres-ready)
│   ├── models.py                # User, WorkspaceConfig, GenerationSession, JobRecord, StoryRating, StoryVersion
│   ├── crew_pipeline.py         # The 5-agent CrewAI pipeline + bounded reflection loop
│   ├── rag_engine.py            # Hybrid BM25 + dense-embedding retrieval, RRF fusion
│   ├── codebase_indexer.py      # Local filesystem AST-lite scanner (regex-based symbol/route extraction)
│   ├── grounding_checker.py     # Deterministic hallucination guardrail
│   ├── velocity_calibrator.py   # scikit-learn Ridge regression story-point calibrator
│   ├── velocity_engine.py       # Jira sprint history fetch + AI-vs-actual accuracy computation
│   ├── eval_harness.py          # LLM-as-judge golden-dataset regression testing
│   ├── job_queue.py             # SQLite-backed async job tracking + in-memory SSE queues
│   ├── observability.py         # Token/cost/latency tracking per agent step
│   ├── rate_limiter.py          # Sliding-window rate-limit middleware
│   ├── github_indexer.py        # Remote GitHub repo indexer (GitHub API, no local clone)
│   ├── confluence_client.py     # Publishes sprint backlog as a Confluence page (ADF format)
│   ├── test_generator.py        # Generates Playwright/PyTest test code from acceptance criteria
│   ├── settings_router.py       # Encrypted workspace config CRUD
│   ├── sessions_router.py       # Generation-session persistence/history
│   └── integrations_analytics_router.py  # GitHub/Confluence/Slack + analytics + velocity + ratings
├── vite.config.js               # Dev proxy config (/api, /rest → :8000)
├── package.json                 # name: "agiler-ai"
└── .env                         # VITE_OPENAI_API_KEY, VITE_JIRA_*, JWT_SECRET_KEY, ENCRYPTION_KEY
```

---

## 5. End-to-End Data Flow (the walkthrough to memorize)

This is the sequence you should be able to narrate without hesitation — it's the answer to "walk me through what happens when a user generates stories."

1. **Upload** — `UploadZone.jsx` accepts a PDF/DOCX/TXT file, parses it client-side via `fileParser.js` (`pdfjs-dist`/`mammoth`), and stores raw text in Zustand (`setPrdText`).
2. **Parse into epics** — `usePRDProcessor.processPRD()` calls `parsePRD()` in `aiClient.js`, which calls OpenAI **directly from the browser** (`VITE_OPENAI_API_KEY`, dev-only pattern) using `PRD_PARSER_PROMPT` to extract `{ epics: [...], globalRisks: [...] }`.
3. **Check agent server** — `checkAgentServer()` pings `/api/health`. If the backend is up, the real 5-agent pipeline runs; otherwise it falls back to a single direct LLM call (`generateStories()`) — graceful degradation.
4. **POST `/api/generate-stories`** ([main.py](server/main.py)) — resolves the OpenAI key server-side (per-user encrypted config, or `.env` fallback), creates a `JobRecord` row (`job_queue.create_job`), and spawns a **daemon thread** running `crew_pipeline.run_pipeline(...)`. The HTTP response is immediately a `StreamingResponse` that polls the job's `queue.Queue` and yields `data: {...}\n\n` SSE lines.
5. **The pipeline runs** ([crew_pipeline.py](server/crew_pipeline.py)) — 5 agents in sequence, each pushing `agent_start` → (optional `agent_thought`) → `agent_complete` events into the queue:
   - **Repo Codebase Analyzer** — calls `rag_engine.get_codebase_context_str(prd_text)` (hybrid BM25+dense retrieval) to find real files relevant to the PRD, then one LLM call maps PRD requirements to those files → `repoImpact` JSON.
   - **Architect** — builds a knowledge graph (`entities`/`relationships`) from the PRD + repo impact.
   - **PM** — drafts stories per epic (title, description, Gherkin acceptance criteria, story points, labels).
   - **Engineer** — re-estimates story points grounded in the repo impact, assigns `affectedFiles`/`locEstimate`/`prBreakdown`.
   - **Grounding check** (no LLM) — `grounding_checker.annotate_stories_with_grounding()` cross-checks every `affectedFiles` entry against `codebase_indexer.indexed_files`; attaches `groundingScore`/`ungroundedFiles` per story.
   - **Velocity calibration** (no LLM) — `velocity_calibrator.calibrate()` attaches `calibratedStoryPoints` per story (no-op until trained).
   - **QA** — reviews stories (now grounding-aware) and produces `qualityScore`/`issues` per story + `overallQualityScore`. **If `overallQualityScore < 75`**, the pipeline sends one bounded revision pass back to the PM agent with the QA critique, re-runs Engineer + grounding + calibration, and re-scores — capped at exactly one retry.
6. **`final_result` event** — includes `stories`, `knowledgeGraph`, `repoImpact`, `telemetry`, `qualityReport`, `groundingSummary`, `reflectionApplied`, `calibrationStatus`.
7. **Frontend consumes the stream** — `aiClient.runAgentPipeline()` reads the `ReadableStream` byte-by-byte, splits on `\n`, parses each `data:` line as JSON, and calls `onEvent()` for every event (`usePRDProcessor.js`). Story data is normalized through `storyTransformer.transformStories()` (which **must** spread `...story` to preserve backend-enriched fields — a real bug we hit and fixed) and written into Zustand.
8. **Downstream steps** (still client-orchestrated, direct LLM calls) — assign stories to team members (`SMART_ASSIGNER_PROMPT`), detect dependencies (`DEPENDENCY_DETECTOR_PROMPT`), plan sprints (`SPRINT_PLANNER_PROMPT`).
9. **Auto-save** — `saveSessionToServer()` POSTs the full session to `/api/sessions`, persisted as a `GenerationSession` row.
10. **Push to Jira** — `useJiraSync.pushToJira()` creates Epics, then Stories (with ADF-formatted description + acceptance criteria bullet list), then issue links for dependencies, via `jiraClient.js` hitting the `/rest/...` proxy.

---

## 6. Backend Deep Dive (file by file)

### `main.py` — the entrypoint
- Creates the `FastAPI` app, mounts CORS + `RateLimiterMiddleware` (120 req/60s).
- `@app.on_event("startup")`: creates DB tables (`create_db_and_tables()`) and indexes the local codebase (`codebase_indexer.scan_directory(ROOT_DIR)`) — this is why the RAG engine always has fresh data on boot.
- Mounts 5 routers: `auth_router`, `settings_router`, `sessions_router`, `integrations_router`, `analytics_router`.
- **`/api/generate-stories`**: the main pipeline trigger (see Data Flow above).
- **`/api/jobs/{id}/stream`**: a *reconnectable* SSE endpoint — if the client's connection drops mid-run, it can re-subscribe here; if the job already finished, it replays the persisted `result_json` from the DB instead of erroring.
- **`/rest/{path:path}`**: the Jira reverse proxy — forwards whitelisted headers, attaches the authenticated user's decrypted Jira Basic-Auth header server-side.
- **SPA serving**: mounts `dist/assets` as static files, and a catch-all `GET /{full_path:path}` that returns `index.html` for any non-file path (client-side routing support) — classic SPA-on-a-single-origin pattern.
- **`/api/eval/run`, `/api/eval/save-baseline`**: eval harness endpoints (see §10.5).

### `auth.py` — identity & secrets
- **Password hashing**: `passlib.CryptContext(schemes=["bcrypt"])`. *(Real incident: `bcrypt` 5.0.0 removed an internal `__about__` attribute that `passlib` 1.7.4 probes for — this silently broke every register/login call with a 500. Fixed by pinning `bcrypt==4.0.1`. Good "debugging a dependency incompatibility" story for interviews.)*
- **JWT**: `python-jose`, `HS256`, 7-day expiry, signed with `JWT_SECRET_KEY` (env var, with an insecure hardcoded fallback for local dev only).
- **API-key-at-rest encryption**: `cryptography.Fernet` (AES-128-CBC + HMAC-SHA256, authenticated encryption). If `ENCRYPTION_KEY` isn't set, it *derives* a stable key via `SHA-256(JWT_SECRET_KEY)` — deterministic across restarts without needing a second secret in dev. Falls back to base64 (explicitly *not* secure, logged as such) if the `cryptography` package is unavailable.
- **Dependency-injection auth pattern**: `get_current_user` (returns `Optional[User]`, never raises) vs `require_auth` (raises 401) — lets endpoints choose whether auth is optional (e.g. `/api/health`) or mandatory (e.g. `/api/sessions`).
- **`_seed_workspace_from_env`**: on first registration, seeds a `WorkspaceConfig` from `.env` values — a migration path for the pre-multi-tenant version of the app where credentials lived only in `.env`.

### `models.py` — the schema (SQLModel = table + Pydantic in one)
See §8 for the full table breakdown.

### `crew_pipeline.py` — the orchestrator
- Defines a **fallback shim** for `Agent`/`Task`/`Crew`/`Process` if the real `crewai` package or its C-extensions fail to import — the fallback `Crew.kickoff()` just does one raw `httpx` POST to OpenAI's chat completions endpoint. This means the app degrades gracefully instead of hard-crashing if CrewAI has an environment issue.
- `parse_json_from_text()`: LLMs don't always return clean JSON even when told to — this tries `json.loads` first, then regex-extracts the first `{...}` block as a fallback. Every agent's raw output goes through this.
- `_run_pm_agent(..., critique_note="")`: the same function drafts stories *and* revises them — when `critique_note` is non-empty, it's injected as a "QA REVIEW FEEDBACK" block in the prompt. This is what makes the reflection loop a one-parameter reuse instead of a duplicated code path.
- `QA_QUALITY_THRESHOLD = 75`: below this, exactly **one** revision pass runs — bounded so a stubborn low score can't loop forever and blow up cost/latency (a deliberate, defensible design choice — mention this explicitly if asked "why not loop until it passes?").

### `rag_engine.py` — hybrid retrieval (see §10.1 for the full deep dive)

### `codebase_indexer.py` — the "AST-lite" scanner
- Walks the local filesystem (`Path.rglob("*")`), skips `IGNORE_DIRS` (`node_modules`, `.git`, `dist`, etc.), reads files matching `SUPPORTED_EXTENSIONS`.
- Extracts **exports** (`export function/class/const X`, Python `def`/`class`), **API routes** (`@app.get(...)`/`app.get(...)` regex — FastAPI/Express style), and **schemas** (Pydantic `BaseModel`/`SQLModel` subclasses, TS `interface`/`type`) — all via **regex, not a real AST parser**. This is a deliberate speed/simplicity trade-off (be ready to say: "a real implementation would use `ast` for Python and a JS/TS parser like `@babel/parser` or `tree-sitter` for full accuracy; regex covers the common cases fast and without extra native dependencies").
- Stores a 1.5KB `snippet` per file for cheap context injection.

### `grounding_checker.py`, `velocity_calibrator.py`, `eval_harness.py`
Covered in full in §10.

### `job_queue.py` — the async execution model
- **Not Celery/Redis** — a `JobRecord` SQLite row for durable status/result, plus an **in-memory `dict[str, queue.Queue]`** for live SSE event delivery. This is a deliberate scope trade-off: durable enough to survive a server restart (job status/result persist), but if the server restarts *mid-run*, the in-memory queue is lost and the SSE stream just ends — the honest answer if asked "does this scale to multiple workers?": **no**, not yet — that's exactly the kind of thing you'd swap for Redis/Celery or a Postgres-backed pub/sub in a real production deployment (see §12).
- `run_job_in_background()`: spawns a **daemon thread** per job — fine for a handful of concurrent users, not a real worker pool.

### `observability.py` — cost/latency telemetry
- Token counting is a **heuristic** (`len(text) // 4 ≈ tokens`), not the real `tiktoken` tokenizer — cheap and fast, ~10-15% error margin, good enough for a live cost *estimate* in the UI but not for billing-grade accuracy. Be ready to name this trade-off proactively.
- Hardcoded per-model `$/1K token` pricing table — would need to be kept in sync with provider pricing changes in production (or fetched from a pricing API).

### `rate_limiter.py` — abuse protection
- Custom Starlette `BaseHTTPMiddleware`, **sliding window** (not fixed window / token bucket): keeps a list of request timestamps per client key, prunes anything older than the window on every request.
- Client key = the Bearer token if present, else `request.client.host` — meaning **unauthenticated requests from behind a shared NAT/proxy share one bucket**, a known weakness worth naming if asked "how would you break this rate limiter?"
- **In-memory only** — resets on restart, and doesn't share state across multiple server instances (same class of limitation as the job queue).

### `github_indexer.py` / `confluence_client.py` / `test_generator.py`
- **GitHub indexer**: indexes a *remote* repo directly via the GitHub REST API (`git/trees?recursive=1` + raw content fetch) — no local `git clone` needed, capped at 500 files / 50KB each.
- **Confluence client**: hand-builds **Atlassian Document Format (ADF)** JSON (not markdown) — headings, tables, bullet lists — to publish a fully formatted sprint backlog page via REST API v2, with create-or-update-if-exists logic.
- **Test generator**: one CrewAI-style agent call turns a story's acceptance criteria into Playwright (TS) or PyTest (Python) code; falls back to a template generator (real, runnable — just generic assertions) if no API key is configured.

### Routers: `settings_router.py`, `sessions_router.py`, `integrations_analytics_router.py`
- `settings_router`: `GET /api/settings` returns **masked** keys (`••••••1234`) for display; `POST` only re-encrypts a field if the submitted value doesn't contain the mask character `•` (so re-saving the form without touching a field doesn't overwrite it with the masked placeholder — a subtle but important UX/security detail).
- `sessions_router`: CRUD over `GenerationSession` — list/detail/save/delete, plus `PATCH .../jira-synced` to mark push-to-Jira completion.
- `integrations_analytics_router`: GitHub indexing, Confluence publish, Slack webhook notify, usage analytics (cost trend, token breakdown), velocity report + calibration training, and story ratings (1–5 stars, feeds the human-quality-signal side of the system).

---

## 7. Frontend Deep Dive (file by file)

### `App.jsx`
- **No router library** — navigation is a single `currentStep` string in Zustand (`'home' | 'login' | 'landing' | 'processing' | 'dashboard'`), and the dashboard itself has a local `activeTab` `useState` for its 7 tabs (Story Board, Dependencies, Knowledge Graph, Sprint Plan, Risk Report, Analytics, **AI Quality**). Simple enough that `react-router` would be over-engineering for this app's shape.
- Auth gate: unauthenticated users can freely browse the marketing home page (`currentStep === 'home'`); every other step requires `isAuthenticated`.

### `store/appStore.js` — the single Zustand store
- One `create((set, get) => ({...}))` call holding: auth state, session-history state, ~15 core data fields (`epics`, `stories`, `sprints`, `dependencies`, `knowledgeGraph`, `repoImpact`, `telemetry`, and the newer `qualityReport`/`groundingSummary`/`reflectionApplied`/`calibrationStatus`), agent-pipeline visualization state (`agentPipeline` array — 5 entries, one per agent, each with a `status: 'pending'|'active'|'complete'`), and Jira metadata.
- `saveSessionToServer()` lives *inside* the store (an async action with `get()`/`set()` access) rather than in a separate service file — a valid but debatable pattern; if asked "would you structure this differently," a reasonable answer is "I'd extract server-sync actions into a separate slice/service to keep the store focused on pure state, but for a store this size the coupling is manageable."

### `hooks/usePRDProcessor.js` — the orchestration hook
- The `onEvent` switch statement is the **single place** that translates raw SSE JSON into Zustand mutations — every new event type (like the QA agent's events) "just works" through the existing generic handling (`updateAgentStatus(event.agent, ...)`) without needing per-agent special-casing, *because agent identity is a string, not a hardcoded enum*. This is why adding the 5th (QA) agent required zero changes to this file.

### `hooks/useJiraSync.js`
- Builds three `Map`s (`epicKeyMap`, `storyKeyMap`, `userKeyMap`) to track AI-generated IDs → real Jira keys as it creates issues sequentially, so dependency links (step 3) can resolve `S1 → S3` into real Jira issue keys.
- Awaits each Jira API call **sequentially in a `for` loop**, not `Promise.all` — deliberate, since Jira issue creation order matters (stories need their epic's real key to exist first) and parallel calls would also risk hitting Jira's own rate limits harder.

### `lib/aiClient.js` — SSE consumption without EventSource
- Why not the browser's native `EventSource`? Because `EventSource` only supports **GET** requests with no custom body — this endpoint needs a **POST** with a JSON body (`prdText`, `epics`, `team`). So it manually does `fetch(...).body.getReader()`, decodes chunks, buffers partial lines (`buffer.split('\n'); buffer = lines.pop()`), and parses `data: ` lines as JSON — a hand-rolled SSE client.
- Also holds the **fallback direct-LLM functions** (`parsePRD`, `generateStories`, `assignStories`) used when the backend agent server is unreachable — these call OpenAI directly from the browser using `VITE_OPENAI_API_KEY` (a dev-mode convenience; in a real prod deploy you would *not* ship an OpenAI key in a public bundle — the backend-proxied path is the secure one).

### `lib/storyTransformer.js`
- **The bug we found and fixed this session**: `transformStories()` used to return a brand-new object literal listing only the "known" fields, silently dropping every backend-enriched field. Fixed by spreading `...story` first, then overriding only the fields that need validation/defaults. Good story to tell: *"I found a data-loss bug where new backend fields never reached the UI because a transformer function wasn't spreading the source object — a classic 'forgot to widen the whitelist' bug."*

### `components/` highlights
| Component | Role |
|---|---|
| `LandingPage.jsx` | Marketing/home page — hero, 5-stage flow diagram, 4-agent explainer |
| `LoginPage.jsx` | Auth form (login/register toggle), calls `/api/auth/login`\|`register` |
| `UploadZone.jsx` | Drag-drop file upload → `fileParser.js` → Zustand |
| `TeamProfileForm.jsx` / `JiraConfigForm.jsx` | Team roster input + Jira project/board/sprint selectors (populated live from `jiraClient.js`) |
| `LoadingAnimation.jsx` | The 5-agent pipeline visualization (icons/colors keyed by agent name, including QA's `Shield` icon) |
| `StoryBoard.jsx` | Epic → story card grid; renders `ObservabilityPanel`, `CodeImpactView`, `StoryRatingWidget` per story |
| `CodeImpactView.jsx` | Per-story grounding/QA/calibration badges + affected-files list (ungrounded files highlighted red) |
| `DependencyGraph.jsx` / `KnowledgeGraphView.jsx` | ReactFlow node/edge graphs (simple grid auto-layout — not a real hierarchical layout engine like `dagre`) |
| `RiskPanel.jsx` | Flat list of AI-flagged ambiguous/missing requirements |
| `SprintPlanView.jsx` | Sprint-by-sprint breakdown with per-developer load |
| `AnalyticsDashboard.jsx` | Cost/token trend + velocity benchmark (Jira actual vs AI estimate) |
| `AIQualityPanel.jsx` | **New this session** — grounding/QA/reflection summary, calibrator training UI, eval-harness runner |
| `SettingsModal.jsx` | Encrypted workspace config (API keys, Jira creds) |
| `IntegrationsPanel.jsx` | Confluence publish + Slack webhook test |
| `SessionHistoryPanel.jsx` / `StoryVersionHistory.jsx` | Past-session browsing + per-story git-style version snapshots |
| `TestGeneratorModal.jsx` | Triggers `/api/generate-tests`, shows generated Playwright/PyTest code |
| `JobStatusBanner.jsx` | Global sticky banner polling `/api/jobs/{id}` for any in-flight background job |

---

## 8. Database Schema

All tables defined in `server/models.py` via SQLModel (`table=True`):

| Table | Purpose | Key fields |
|---|---|---|
| **`users`** | Auth identity | `email` (unique), `hashed_password` (bcrypt), `is_active` |
| **`workspace_configs`** | Per-user encrypted integration credentials | `openai_key_enc`, `anthropic_key_enc`, `jira_*_enc`, `github_token_enc`, `confluence_*_enc`, `slack_webhook_url` — 1:1 with `users` |
| **`generation_sessions`** | A full PRD→stories run, persisted | `prd_text`, `epics_json`/`stories_json`/`knowledge_graph_json`/`repo_impact_json`/`telemetry_json` (all JSON-serialized `Text` columns with typed getter/setter helper methods), aggregate stats (`total_stories`, `total_story_points`, `total_cost_usd`), `jira_synced` |
| **`job_records`** | Async pipeline execution tracking | `id` (UUID string PK), `status` (`queued`\|`running`\|`completed`\|`failed`), `progress`, `result_json` |
| **`story_ratings`** | Human 1–5 star quality feedback per story | `session_id` FK, `story_title`, `rating`, `feedback` |
| **`story_versions`** | Git-style edit history per story | `session_id` FK, `story_id`, `version_number`, `snapshot_json`, `change_summary` |

**Design pattern worth naming**: JSON blobs stored as `Text` columns with typed accessor methods (`session.get_stories()` / `session.set_stories(v)`) rather than a fully normalized `stories` table with foreign keys. This is a deliberate trade-off — much simpler to write/read a whole session, but you **cannot** efficiently query "give me all stories with `storyPoints > 8` across all sessions" without loading and deserializing every session row. If asked "how would you scale the data model," this is the first thing to name: normalize `stories`/`epics` into their own tables once cross-session querying becomes a real requirement.

---

## 9. Authentication & Security Model

1. **Registration/login** → `bcrypt`-hashed password → JWT (`HS256`, 7-day expiry, `sub`=user id) returned to client, stored in `localStorage`.
2. **Every authenticated request** sends `Authorization: Bearer <jwt>`; FastAPI's `Depends(require_auth)` decodes it, loads the `User` row.
3. **Third-party credentials** (OpenAI/Anthropic/Jira/GitHub/Confluence tokens) are **never stored in plaintext** — encrypted with Fernet (authenticated AES) before hitting `workspace_configs`, decrypted only in-memory when a request actually needs to call that service.
4. **Display masking**: the settings API only ever returns `••••••1234`-style masked values to the frontend — the plaintext key is decrypted server-side, checked for existence, then masked before the response leaves the server.
5. **Multi-tenancy boundary**: every session/rating/version query filters by `.where(X.user_id == user.id)` — there's no shared global data (aside from the codebase index itself, which is server-wide by design since it indexes *this deployment's* filesystem, not a per-user thing).
6. **Rate limiting**: 120 req/60s sliding window, keyed by bearer token (falls back to IP for unauthenticated requests).
7. **Known gaps** (name these proactively if asked "how would you harden this for production"):
   - No refresh-token rotation — a stolen 7-day JWT is valid for 7 days, no revocation list.
   - No MFA/SSO — flat email+password only.
   - `JWT_SECRET_KEY` has an insecure hardcoded fallback — fine for local dev, **must** be set via env var in any real deployment.
   - No audit log of who changed what/when.

---

## 10. The 5 AI-Engineering Differentiators (deep dive)

These were purpose-built to demonstrate depth beyond "I called an LLM API" — know these cold.

### 10.1 Hybrid RAG (`rag_engine.py`)

**Before**: pure TF-IDF cosine similarity — words in the query overlapping with words in each file, no synonym/semantic understanding, and (worth being honest about) the code's docstring used to *claim* "semantic vector search" while actually doing keyword matching.

**After**: true hybrid retrieval —
- **Sparse**: `BM25Okapi` (from `rank-bm25`) over tokenized `path + exports + snippet` for every indexed file. BM25 is TF-IDF's more principled successor — it saturates term-frequency contribution (a word appearing 50 times isn't 50x as relevant as appearing once) and normalizes for document length.
- **Dense**: OpenAI `text-embedding-3-small` (1536-dim) vectors, cosine similarity. Embeddings are **disk-cached** (`server/.cache/embeddings.json`) keyed by a SHA-1 hash of each file's content — so re-running search doesn't re-embed unchanged files, only new/modified ones, batched 64-at-a-time per API call.
- **Fusion**: **Reciprocal Rank Fusion (RRF)** — `score(doc) = Σ 1/(60 + rank)` across both rankers. *Why RRF instead of a cross-encoder reranker or a weighted score average?* Score averaging requires both rankers to be on comparable scales (BM25 scores and cosine similarities aren't); RRF only needs *rank order*, making it scale-invariant and dead simple — no tuning a blend weight. A cross-encoder reranker would be more accurate but adds a heavyweight model download/inference cost that isn't justified for a 98-file demo repo.
- **Graceful degradation**: if there's no API key or the embeddings call fails, it silently falls back to BM25-only, then to the original TF-IDF cosine search if even `rank-bm25` is unavailable — retrieval never hard-fails.

**Interview-ready one-liner**: *"BM25 catches exact identifier/path matches that embeddings can blur past; embeddings catch semantic paraphrases that BM25 misses entirely. Fusing them with RRF gets both without needing a reranker model."*

### 10.2 ML Velocity Calibrator (`velocity_calibrator.py`)

The **only classical supervised-learning component** in the system — everything else is LLM calls or deterministic rules.

- **Model**: `sklearn.linear_model.Ridge` (L2-regularized linear regression) — deliberately simple. With realistically small training sets (tens to low-hundreds of matched stories), a small linear model generalizes far better than anything deep-learning-shaped, and it's fully interpretable (you can read the learned coefficients).
- **Features**: `[storyPoints (raw AI estimate), locEstimate, len(affectedFiles), complexity (low=1/medium=2/high=3)]` — 4 numeric features, hand-picked because they're all things the Engineer agent already outputs.
- **Target**: real Jira "actual" points, sourced by `velocity_engine.compute_estimation_accuracy()`, which fuzzy-matches AI-generated story titles against real Jira issue summaries (substring match) and pairs `(story_dict, jira_actual_points)`.
- **Cold-start honesty**: `MIN_SAMPLES = 5` — below that, `.fit()` refuses and returns `{"trained": False, "reason": "..."}"`, and `.calibrate()` returns the raw estimate unchanged with `calibrated: false`. **No fake confidence.** This is the single most interview-defensible design choice in the whole calibrator — be ready to say it explicitly.
- **Output**: prediction is snapped to the nearest Fibonacci number (`min(FIBONACCI, key=lambda f: abs(f - pred))`) so calibrated estimates stay in the same scale the team already plans in.
- **Persistence**: trained model pickled via `joblib` to `server/models/velocity_calibrator.joblib`, reloaded on process restart.

**Interview-ready one-liner**: *"It's a bias-correction model, not a from-scratch estimator — it learns the systematic gap between what the LLM guesses and what the team's actual points end up being, and only activates once there's real evidence to learn from."*

### 10.3 Grounding / Hallucination Guardrail (`grounding_checker.py`)

- **Zero LLM calls** — pure Python, deterministic, fast, reproducible.
- Cross-checks every story's `affectedFiles` claims against `codebase_indexer.indexed_files` (normalized path comparison, with a basename-match fallback for when the agent abbreviates directory depth).
- Produces `groundingScore` (verified / total referenced) and `ungroundedFiles` (the specific hallucinated paths) **per story**.
- **Proven in testing, not theoretical**: during this session's end-to-end test, the Engineer agent invented `src/components/SettingsPage.jsx` for a dark-mode story — a file that does not exist in this repo — and the guardrail caught it, flagged `groundingScore: 0.75`, and the QA agent's critique explicitly cited it by name.

**Interview-ready one-liner**: *"Instead of asking the LLM to self-report whether its own output is grounded — which is exactly the kind of thing LLMs are unreliable at judging about themselves — we verify it against ground truth we already have: the actual indexed repository."*

### 10.4 QA Agent + Bounded Reflection Loop (`crew_pipeline.py`)

- Implements the well-known **Reflexion / self-refine** agentic pattern: a critique step whose output is fed back into generation for one corrective pass.
- QA agent scores each story 0–100 on acceptance-criteria completeness, story-point sanity vs. complexity, and explicitly factors in the **deterministic** `groundingScore` (not asked to guess grounding itself — told to *trust* the number that's already been verified).
- `QA_QUALITY_THRESHOLD = 75` — below it, the QA's `summary` critique is injected into a second PM-agent call (`critique_note` parameter), which re-runs Engineer + grounding + calibration + a final QA re-score.
- **Bounded to exactly one retry** — not looped until it passes. This is a deliberate cost/latency/infinite-loop-risk trade-off; verified in testing that the system will honestly report `readyForSprint: false` after the one retry rather than pretending success.

**Interview-ready one-liner**: *"It's a closed loop, but a bounded one — unbounded self-critique loops are a well-known way to blow up cost and latency with no guaranteed convergence, so one retry is the ceiling, and if it still doesn't pass, the system says so honestly instead of hiding it."*

### 10.5 LLM-as-Judge Eval Harness (`eval_harness.py`)

The answer to "how do you know a prompt change didn't quietly make things worse?"

- **Golden dataset**: 3 fixed, hand-written PRDs (MFA login, Stripe billing, notification preferences) — deliberately unrelated to this repo's actual features, so the "grounded" dimension has a *known-bad* expected value (there's no `SettingsPage.jsx`-style file for "Stripe billing" in an AI-story-generator codebase) — a useful sanity check on the harness itself.
- **Judge model**: `gpt-4o-mini` (cheap, since this is meant to run on every prompt change, not once) scores `clarity`, `testability`, `sizingReasonableness` on a 1–5 scale, `temperature=0` for determinism.
- **"Grounded" is NOT judged by the LLM** — it's `groundingScore * 4 + 1` (rescaled from the deterministic checker) — same reasoning as §10.3: don't ask a model to self-report what you can measure exactly.
- **Speed/cost trade-off**: golden-PRD runs skip the Repo Analyzer/Architect stages (their output doesn't determine story-writing *quality*) and go straight to PM + Engineer — a handful of calls instead of dozens.
- **Regression detection**: `POST /api/eval/save-baseline` persists the current aggregate scores to `server/eval_baseline.json`; every subsequent `/api/eval/run` diffs against it and flags `regressed: true` if any dimension drops more than `REGRESSION_THRESHOLD = 0.4` points.

**Interview-ready one-liner**: *"It turns 'the AI output seems fine' into a number you can diff — the same instinct as a unit-test regression suite, applied to non-deterministic LLM output."*

---

## 11. API Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` \| `/login` | — | Returns JWT + user |
| GET | `/api/auth/me` | required | Current user info |
| GET/POST | `/api/settings` | required | Encrypted workspace config (masked on read) |
| GET | `/api/settings/resolved` | required | Fully decrypted config (internal use) |
| GET | `/api/health` | — | Agent list, feature flags, codebase-index status |
| POST | `/api/codebase/index` \| GET `/status` | optional | Local dir scan |
| POST | `/api/generate-stories` | optional | **The pipeline** — returns SSE stream |
| GET | `/api/jobs/{id}` \| `/stream` | mixed | Job status / reconnectable SSE |
| POST | `/api/generate-tests` | optional | Playwright/PyTest generation |
| GET/POST | `/api/story-versions` | required | Version history |
| GET/POST | `/api/sessions` | required | Session CRUD + history |
| POST | `/api/integrations/github/index` | required | Remote GitHub repo indexing |
| POST | `/api/integrations/confluence/publish` | required | Publish sprint backlog page |
| POST | `/api/integrations/slack/notify` | required | Webhook test/notify |
| GET | `/api/analytics/usage` | required | Cost/token/session aggregates |
| GET | `/api/analytics/velocity?board_id=` | required | Jira sprint history report |
| POST | `/api/analytics/velocity/calibrate?board_id=` | required | **Train the ML calibrator** |
| GET | `/api/analytics/velocity/calibration-status` | required | Calibrator trained/samples/R² |
| POST/GET | `/api/analytics/story-rating(s)` | required | Human 1–5 quality feedback |
| POST | `/api/eval/run` | required | **Run the golden-dataset eval** |
| POST | `/api/eval/save-baseline` | required | Persist regression baseline |
| ANY | `/rest/{path}` | mixed | Jira reverse proxy |

---

## 12. Known Limitations & Trade-offs (be ready to discuss honestly)

Interviewers respect naming your own system's weaknesses unprompted far more than pretending it's flawless. Keep this list mentally ready:

1. **SQLite in production** — fine for a single-process demo; real concurrent multi-tenant load needs Postgres (the `DATABASE_URL` env var already supports this swap with zero code changes).
2. **In-memory job/SSE queues + rate limiter** — lost on restart, don't share state across multiple server instances. A real deployment needs Redis/Celery (or a Postgres-backed pub/sub) for the job queue, and a shared store (Redis) for rate-limit counters.
3. **Heuristic token counting** (`len // 4`) — good enough for a live cost *estimate*, not billing-grade; swap for `tiktoken` for exact counts.
4. **Regex-based code indexing**, not a real AST — fast and dependency-light, but will miss unusual syntax patterns a real parser (`ast` / `tree-sitter`) would catch.
5. **Small golden eval set** (3 PRDs) — enough to catch a gross regression, not statistically rigorous; a mature version would need dozens of labeled examples and inter-rater agreement checks against human raters.
6. **Velocity calibrator's feature set is small** (4 hand-picked features) — a production version might add team-level features (assignee seniority, historical accuracy per label/type) once there's enough data to support more parameters without overfitting.
7. **No RBAC/multi-tenant orgs** — every user is a fully independent workspace; there's no team/org/role concept yet (see the earlier "enterprise readiness" roadmap: SSO, RBAC, audit log, Postgres migration were the top-priority next steps).
8. **JWT has no revocation** — a leaked token is valid until it expires (7 days).

---

## 13. Anticipated Interview Q&A

**Q: Why multi-agent instead of one big prompt?**
A: Each agent has a narrow role/goal/backstory, which keeps individual prompts small, testable, and independently improvable — you can iterate on the QA agent's rubric without touching the PM agent's story-drafting prompt. It also means each stage's output is inspectable (and, critically, checkpointable — the reflection loop only needs to re-run PM+Engineer, not the whole pipeline).

**Q: How do you keep this from being "just an LLM API wrapper"?**
A: Two genuinely non-LLM components: the grounding checker (pure deterministic verification against real data) and the velocity calibrator (classical supervised ML, `sklearn.Ridge`, trained on real historical data). Plus systems-engineering pieces that have nothing to do with prompting: SSE streaming with reconnect support, encrypted multi-tenant credential storage, a job queue, rate limiting.

**Q: Walk me through the SSE implementation and why not WebSockets.**
A: Communication is one-directional (server→client progress events); the client never needs to send anything mid-stream. SSE runs over plain HTTP (simpler infra, works through more proxies/load balancers than WebSocket upgrades), and since the trigger is a POST with a JSON body, I hand-roll the client with `fetch().body.getReader()` instead of the native `EventSource` (which only supports GET). Reconnect support is separate: `/api/jobs/{id}/stream` lets a client that dropped mid-run resubscribe, or replay the final result from the DB if the job already finished.

**Q: How does the reflection loop avoid infinite cost blowup?**
A: Hard-capped at one retry (`QA_QUALITY_THRESHOLD` check happens once; the second QA score is accepted regardless of outcome). No while-loop-until-passes. Verified in testing: a run that scored 68 after its retry still correctly reported `readyForSprint: false` rather than looping again or lying about success.

**Q: Why RRF instead of a learned reranker (cross-encoder)?**
A: RRF needs no training data and no extra model to host/serve — it just needs rank order from each retriever, which sidesteps the "BM25 and cosine scores aren't on comparable scales" problem entirely. A cross-encoder would likely retrieve more precisely, but for a ~100-file repo the accuracy gain doesn't justify the added latency and infra of hosting another model.

**Q: How would this scale to 100 concurrent users generating stories simultaneously?**
A: Today: daemon threads per job, in-memory SSE queues, SQLite — this would start falling over under real concurrent write load and cross-process state. The migration path: Postgres (already supported via env var), move the job queue to Celery+Redis (durable across restarts, real worker pool instead of daemon threads), move rate-limit counters to Redis, and consider a message broker (Redis pub/sub or similar) for SSE event delivery so any server instance can serve any client's stream.

**Q: How are passwords and API keys secured differently, and why?**
A: Passwords are **hashed** (bcrypt, one-way, salted) — the server never needs the plaintext again, only to verify. API keys are **encrypted** (Fernet, symmetric, reversible) — because the server *does* need the plaintext key back later to actually call OpenAI/Jira/GitHub on the user's behalf. Using a hash for a password is correct because you only ever compare; using a hash for an API key would be wrong because you'd have no way to retrieve it to use it.

**Q: What would you change about the story-transformer bug, architecturally, to prevent this class of bug recurring?**
A: The root cause was an explicit field whitelist silently dropping new fields. TypeScript with a shared type between backend response and frontend transform would catch this at compile time (a field added to the Pydantic/SQLModel response but not the TS interface would be a type error). Short of a full TS migration, a runtime schema validator (zod/io-ts) on the SSE payload would surface unexpected/missing fields immediately instead of silently.

**Q: Why Ridge regression instead of a more powerful model for the calibrator?**
A: Training data is inherently small (real historical Jira-matched stories, likely tens to low hundreds of samples even in an active team). A more expressive model (gradient boosting, a neural net) would overfit badly on that little data and its predictions would be uninterpretable. Ridge's L2 regularization keeps coefficients small/stable with little data, and it's fully auditable — you can read the 4 learned weights directly.

**Q: How do you validate that the LLM-as-judge itself is any good?**
A: Honestly — this is the harness's own weak point, named in §12. `temperature=0` gives determinism (same input → same score), which is necessary but not sufficient for *correctness*. A more rigorous version would periodically sample judge scores against human ratings (the `story_ratings` table already collects exactly this human signal) and report inter-rater agreement, not just trust the judge blindly.

**Q: What's the biggest thing you'd prioritize if this had to go to production tomorrow?**
A: In order: (1) Postgres migration + Celery/Redis job queue — the current in-memory/SQLite setup is the single biggest correctness risk under real concurrent load; (2) SSO/RBAC — flat per-user auth with no org/team concept isn't viable for a B2B tool; (3) an audit log, since this tool writes to Jira/Confluence on the user's behalf and enterprises will ask "who did what, when."

---

## 14. How to Run It Locally

```bash
# Frontend build (served by the backend in prod-style local run)
npm install
npm run build

# Backend (Python 3.12 required — crewai's dependency tree pins to <3.13 in places)
cd server
pip install -r requirements.txt
python main.py
# → http://localhost:8000  (UI + API + Jira proxy, single process)
```

For active frontend development with hot reload:
```bash
npm run dev
# → http://localhost:5173  (Vite dev server, proxies /api and /rest to :8000)
```

Required `.env` (project root): `VITE_OPENAI_API_KEY`, `VITE_JIRA_BASE_URL`/`VITE_JIRA_EMAIL`/`VITE_JIRA_API_TOKEN`/`VITE_JIRA_PROJECT_KEY` (dev convenience — prod path uses per-user encrypted `WorkspaceConfig` instead), `JWT_SECRET_KEY`, optionally `ENCRYPTION_KEY` and `DATABASE_URL`.
