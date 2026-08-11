"""
Production-grade in-process job queue backed by SQLite.
No Redis required — jobs survive server restarts and support status polling.
"""
import json
import queue
import threading
import uuid
from datetime import datetime
from typing import Optional, Callable
from sqlmodel import Session, select

from database import engine
from models import JobRecord


# In-memory event queues per job (for SSE streaming)
_event_queues: dict[str, queue.Queue] = {}
_lock = threading.Lock()


def create_job(user_id: int, job_type: str = "generate") -> str:
    """Create a new job record and return its ID."""
    job_id = str(uuid.uuid4())
    with Session(engine) as db:
        job = JobRecord(
            id=job_id,
            user_id=user_id,
            job_type=job_type,
            status="queued",
        )
        db.add(job)
        db.commit()
    with _lock:
        _event_queues[job_id] = queue.Queue()
    return job_id


def get_job(job_id: str) -> Optional[dict]:
    """Return job status and metadata."""
    with Session(engine) as db:
        job = db.get(JobRecord, job_id)
        if not job:
            return None
        return {
            "id": job.id,
            "user_id": job.user_id,
            "job_type": job.job_type,
            "status": job.status,
            "progress": job.progress,
            "error": job.error,
            "result_json": json.loads(job.result_json) if job.result_json else None,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }


def update_job_status(job_id: str, status: str, progress: int = 0, error: str = None):
    """Update job status in DB."""
    with Session(engine) as db:
        job = db.get(JobRecord, job_id)
        if job:
            job.status = status
            job.progress = progress
            if error:
                job.error = error
            if status == "running" and not job.started_at:
                job.started_at = datetime.utcnow()
            if status in ("completed", "failed"):
                job.completed_at = datetime.utcnow()
            db.add(job)
            db.commit()


def save_job_result(job_id: str, result: dict):
    """Persist final job result to DB."""
    with Session(engine) as db:
        job = db.get(JobRecord, job_id)
        if job:
            job.result_json = json.dumps(result)
            job.status = "completed"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            db.add(job)
            db.commit()


def push_event(job_id: str, event: dict):
    """Push an SSE event to the job's in-memory queue."""
    with _lock:
        q = _event_queues.get(job_id)
    if q:
        q.put(event)


def get_event_queue(job_id: str) -> Optional[queue.Queue]:
    """Get the SSE event queue for a job."""
    with _lock:
        return _event_queues.get(job_id)


def cleanup_job_queue(job_id: str):
    """Remove in-memory queue after SSE stream closes."""
    with _lock:
        _event_queues.pop(job_id, None)


def run_job_in_background(job_id: str, fn: Callable, *args, **kwargs):
    """Run a function in a daemon thread, updating job status automatically."""
    def _wrapper():
        update_job_status(job_id, "running", progress=5)
        try:
            result = fn(*args, **kwargs)
            if result:
                save_job_result(job_id, result)
            else:
                update_job_status(job_id, "completed", progress=100)
        except Exception as e:
            update_job_status(job_id, "failed", error=str(e))
            push_event(job_id, {"type": "error", "message": str(e)})
        finally:
            push_event(job_id, {"type": "stream_end"})

    t = threading.Thread(target=_wrapper, daemon=True)
    t.start()
    return t
