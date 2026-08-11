import os
import json
import queue
import threading
import asyncio
import httpx
from typing import Optional

from fastapi import FastAPI, Request, Response, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select
from dotenv import load_dotenv

from database import create_db_and_tables, get_session
from models import User, GenerationSession, StoryVersion
from auth import router as auth_router, require_auth, get_current_user, decrypt_key, get_workspace_config
from settings_router import router as settings_router
from sessions_router import router as sessions_router
from integrations_analytics_router import integrations_router, analytics_router
from crew_pipeline import run_pipeline
from codebase_indexer import codebase_indexer
from test_generator import generate_test_suite
from eval_harness import run_golden_eval, save_as_baseline
from job_queue import create_job, get_job, update_job_status, push_event, get_event_queue, cleanup_job_queue, run_job_in_background
from rate_limiter import RateLimiterMiddleware

# Load .env from project root
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
load_dotenv(os.path.join(ROOT_DIR, '.env'))

app = FastAPI(title="Agiler AI — The Autonomous AI Agent for Agile Software Delivery", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimiterMiddleware, max_requests=120, window_seconds=60)


async def retry_with_backoff(async_fn, max_retries: int = 3, initial_delay: float = 1.0, backoff_factor: float = 2.0, *args, **kwargs):
    """Execute async function with exponential backoff retry logic."""
    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            return await async_fn(*args, **kwargs)
        except Exception as e:
            if attempt == max_retries:
                raise e
            await asyncio.sleep(delay)
            delay *= backoff_factor


# ── Startup ──────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    print("✓ Database ready (ai_agile.db)")
    try:
        codebase_indexer.scan_directory(ROOT_DIR)
        print(f"✓ Codebase indexed: {len(codebase_indexer.indexed_files)} files")
    except Exception as e:
        print(f"  Codebase index notice: {e}")


# ── Mount Routers ────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(settings_router)
app.include_router(sessions_router)
app.include_router(integrations_router)
app.include_router(analytics_router)

JIRA_BASE_URL_ENV = (os.getenv('VITE_JIRA_BASE_URL') or '').rstrip('/')
FORWARD_HEADERS = {'authorization', 'content-type', 'accept', 'x-atlassian-token'}


# ── Key Resolution Helpers ───────────────────────────────────────────────
def _resolve_openai_key(user: Optional[User], db: Session) -> str:
    if user:
        config = get_workspace_config(db, user.id)
        if config and config.openai_key_enc:
            return decrypt_key(config.openai_key_enc)
    return os.getenv("VITE_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")


# ── Health ───────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "agents": ["Repo Analyzer", "Architect", "PM", "Engineer", "QA"],
        "features": ["hybrid-rag", "auth", "persistence", "github", "confluence", "slack", "analytics",
                     "velocity-calibration", "grounding-guardrail", "reflection-loop", "eval-harness"],
        "codebaseIndexed": codebase_indexer.indexed_path is not None,
        "indexedFiles": len(codebase_indexer.indexed_files),
        "dbReady": True,
    }


# ── Codebase Indexer (local dir) ─────────────────────────────────────────
@app.post("/api/codebase/index")
async def index_codebase(request: Request, user: Optional[User] = Depends(get_current_user)):
    data = await request.json()
    dir_path = data.get("dirPath") or ROOT_DIR
    try:
        res = codebase_indexer.scan_directory(dir_path)
        return {"status": "success", "path": res["path"], "fileCount": res["file_count"], "stats": res["stats"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/codebase/status")
async def codebase_status(user: Optional[User] = Depends(get_current_user)):
    return {"path": codebase_indexer.indexed_path, "fileCount": len(codebase_indexer.indexed_files), "stats": codebase_indexer.stats}


# ── Test Generator ───────────────────────────────────────────────────────
@app.post("/api/generate-tests")
async def generate_tests(
    request: Request,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    data = await request.json()
    story = data.get("story", {})
    framework = data.get("framework", "playwright")
    if user:
        config = get_workspace_config(db, user.id)
        if config and config.openai_key_enc:
            os.environ["OPENAI_API_KEY"] = decrypt_key(config.openai_key_enc)
    try:
        test_code = generate_test_suite(story, framework=framework)
        return {"status": "success", "framework": framework, "code": test_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Eval Harness (LLM-as-judge, golden dataset, regression gate) ──────────
@app.post("/api/eval/run")
async def run_eval(
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Run the golden-dataset eval and diff it against the last saved baseline."""
    openai_key = _resolve_openai_key(user, db)
    if not openai_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")
    try:
        report = run_golden_eval(api_key=openai_key)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveBaselineRequest(BaseModel):
    aggregate: dict


@app.post("/api/eval/save-baseline")
async def save_eval_baseline(req: SaveBaselineRequest, user: User = Depends(require_auth)):
    """Persist the given aggregate scores as the new regression baseline (deliberate action, not automatic)."""
    save_as_baseline(req.aggregate)
    return {"status": "saved"}


# ── Story Version History ────────────────────────────────────────────────
class SaveVersionRequest(BaseModel):
    session_id: int
    story_id: str
    snapshot: dict
    change_summary: Optional[str] = None


@app.post("/api/story-versions")
def save_story_version(
    req: SaveVersionRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Save a new story version snapshot."""
    # Get current version count
    existing = db.exec(
        select(StoryVersion).where(
            StoryVersion.session_id == req.session_id,
            StoryVersion.story_id == req.story_id
        ).order_by(StoryVersion.version_number.desc())
    ).first()
    next_version = (existing.version_number + 1) if existing else 1

    version = StoryVersion(
        session_id=req.session_id,
        user_id=user.id,
        story_id=req.story_id,
        version_number=next_version,
        snapshot_json=json.dumps(req.snapshot),
        change_summary=req.change_summary or f"Version {next_version}",
    )
    db.add(version)
    db.commit()
    return {"status": "saved", "version": next_version}


@app.get("/api/story-versions/{session_id}/{story_id}")
def get_story_versions(
    session_id: int,
    story_id: str,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Get full version history for a story."""
    versions = db.exec(
        select(StoryVersion).where(
            StoryVersion.session_id == session_id,
            StoryVersion.story_id == story_id,
            StoryVersion.user_id == user.id
        ).order_by(StoryVersion.version_number.desc())
    ).all()
    return [
        {
            "version": v.version_number,
            "changeSummary": v.change_summary,
            "snapshot": json.loads(v.snapshot_json),
            "createdAt": v.created_at.isoformat(),
        }
        for v in versions
    ]


# ── Job Status (Phase 2) ─────────────────────────────────────────────────
@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str, user: User = Depends(require_auth)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job


@app.get("/api/jobs/{job_id}/stream")
async def stream_job(job_id: str, user: Optional[User] = Depends(get_current_user)):
    """SSE stream for job events — client can reconnect after disconnect."""
    q = get_event_queue(job_id)
    if not q:
        # Job may have already completed — return final result
        job = get_job(job_id)
        if job and job.get("result_json"):
            async def done():
                yield f"data: {json.dumps({'type': 'final_result', **job['result_json']})}\n\n"
                yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
            return StreamingResponse(done(), media_type="text/event-stream")
        raise HTTPException(status_code=404, detail="Job stream not found")

    async def event_stream():
        try:
            while True:
                try:
                    item = q.get(timeout=0.5)
                    if item is None:
                        yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
                        break
                    yield f"data: {json.dumps(item)}\n\n"
                    if item.get("type") in ("stream_end", "error"):
                        break
                except queue.Empty:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                    await asyncio.sleep(0.1)
        finally:
            cleanup_job_queue(job_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
    )


# ── Main Story Generation Pipeline ───────────────────────────────────────
@app.post("/api/generate-stories")
async def generate_stories(
    request: Request,
    background_tasks: BackgroundTasks,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """
    Run the Codebase-Aware CrewAI multi-agent pipeline.
    Returns a job_id immediately; client streams events via /api/jobs/{id}/stream.
    """
    data = await request.json()
    prd_text = data.get("prdText", "")
    epics = data.get("epics", [])
    team = data.get("team", [])
    codebase_path = data.get("codebasePath", None)

    # Resolve API key server-side
    openai_key = _resolve_openai_key(user, db)
    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key

    if codebase_path and codebase_path != codebase_indexer.indexed_path:
        try:
            codebase_indexer.scan_directory(codebase_path)
        except Exception:
            pass

    user_id = user.id if user else 0

    # Create persistent job record
    job_id = create_job(user_id=user_id, job_type="generate")
    event_q = __import__("job_queue")._event_queues.get(job_id)

    def _pipeline_wrapper():
        update_job_status(job_id, "running", progress=5)
        try:
            run_pipeline(prd_text, epics, team, event_q, codebase_path=codebase_path)
        except Exception as e:
            push_event(job_id, {"type": "error", "message": str(e)})
            update_job_status(job_id, "failed", error=str(e))
        finally:
            update_job_status(job_id, "completed", progress=100)
            push_event(job_id, None)

    thread = threading.Thread(target=_pipeline_wrapper, daemon=True)
    thread.start()

    async def event_stream():
        try:
            while True:
                try:
                    item = event_q.get(timeout=0.5)
                    if item is None:
                        yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
                        break
                    yield f"data: {json.dumps(item)}\n\n"
                except queue.Empty:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                    await asyncio.sleep(0.1)
        finally:
            cleanup_job_queue(job_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no",
                 "X-Job-Id": job_id}
    )


# ── Jira Proxy ───────────────────────────────────────────────────────────
@app.api_route("/rest/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def jira_proxy(
    path: str,
    request: Request,
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    jira_url = JIRA_BASE_URL_ENV
    if user:
        config = get_workspace_config(db, user.id)
        if config and config.jira_base_url:
            jira_url = config.jira_base_url

    if not jira_url:
        raise HTTPException(status_code=500, detail="Jira URL not configured. Set it in Settings.")

    target_url = f"{jira_url}/rest/{path}"
    if request.url.query:
        target_url = f"{target_url}?{request.url.query}"

    jira_headers = {k: v for k, v in request.headers.items() if k.lower() in FORWARD_HEADERS}
    if user:
        config = get_workspace_config(db, user.id)
        if config and config.jira_email and config.jira_token_enc:
            import base64
            jira_token = decrypt_key(config.jira_token_enc)
            jira_auth = base64.b64encode(f"{config.jira_email}:{jira_token}".encode()).decode()
            jira_headers["authorization"] = f"Basic {jira_auth}"
            jira_headers["content-type"] = "application/json"

    jira_headers["Origin"] = jira_url
    jira_headers["Referer"] = f"{jira_url}/"
    body = await request.body()

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        upstream = await client.request(
            method=request.method, url=target_url, headers=jira_headers,
            content=body if body else None,
        )

    excluded = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    response_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in excluded}
    return Response(content=upstream.content, status_code=upstream.status_code,
                    headers=response_headers, media_type=upstream.headers.get("content-type"))


# ── Serve React SPA ──────────────────────────────────────────────────────
if os.path.isdir(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = os.path.normpath(os.path.join(DIST_DIR, full_path))
        if full_path and candidate.startswith(DIST_DIR) and os.path.isfile(candidate):
            return FileResponse(candidate)
        index_path = os.path.join(DIST_DIR, "index.html")
        if not os.path.isfile(index_path):
            raise HTTPException(status_code=503, detail="Frontend build missing. Run: npm run build")
        return FileResponse(index_path)
else:
    @app.get("/")
    async def missing_frontend():
        raise HTTPException(status_code=503, detail="Frontend build missing. Run: npm run build")


if __name__ == "__main__":
    import uvicorn
    print("Agiler AI — The Autonomous AI Agent for Agile Software Delivery")
    print("  From requirements to sprint-ready Jira.")
    print("  http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
