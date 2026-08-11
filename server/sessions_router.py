import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import GenerationSession, User
from auth import require_auth

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SaveSessionRequest(BaseModel):
    title: Optional[str] = "Untitled Session"
    prd_text: Optional[str] = None
    prd_filename: Optional[str] = None
    epics: Optional[list] = []
    stories: Optional[list] = []
    knowledge_graph: Optional[dict] = {}
    repo_impact: Optional[dict] = {}
    telemetry: Optional[dict] = {}
    agent_logs: Optional[list] = []


@router.get("")
def list_sessions(
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """List all sessions for the current user, newest first."""
    sessions = db.exec(
        select(GenerationSession)
        .where(GenerationSession.user_id == user.id)
        .order_by(GenerationSession.created_at.desc())
    ).all()

    return [
        {
            "id": s.id,
            "title": s.title,
            "status": s.status,
            "prd_filename": s.prd_filename,
            "total_stories": s.total_stories,
            "total_story_points": s.total_story_points,
            "total_cost_usd": round(s.total_cost_usd, 4),
            "jira_synced": s.jira_synced,
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.get("/{session_id}")
def get_session_detail(
    session_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Load full session data for restoring into app state."""
    session = db.get(GenerationSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session.id,
        "title": session.title,
        "status": session.status,
        "prd_text": session.prd_text,
        "prd_filename": session.prd_filename,
        "epics": session.get_epics(),
        "stories": session.get_stories(),
        "knowledge_graph": session.get_knowledge_graph(),
        "repo_impact": session.get_repo_impact(),
        "telemetry": session.get_telemetry(),
        "agent_logs": session.get_agent_logs(),
        "total_stories": session.total_stories,
        "total_story_points": session.total_story_points,
        "total_cost_usd": session.total_cost_usd,
        "jira_synced": session.jira_synced,
        "jira_sync_at": session.jira_sync_at.isoformat() if session.jira_sync_at else None,
        "created_at": session.created_at.isoformat(),
    }


@router.post("")
def save_session(
    req: SaveSessionRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Persist a completed generation session to the database."""
    # Auto-generate title from PRD filename or first epic name
    title = req.title or "Untitled Session"
    if title == "Untitled Session" and req.epics:
        first_epic = req.epics[0]
        title = first_epic.get("name", title)[:80]
    if req.prd_filename:
        title = req.prd_filename.replace(".pdf", "").replace(".docx", "").replace(".txt", "")[:80]

    session = GenerationSession(
        user_id=user.id,
        title=title,
        prd_filename=req.prd_filename,
        status="completed",
    )

    if req.prd_text:
        session.prd_text = req.prd_text[:50000]  # Cap at 50k chars

    session.set_epics(req.epics or [])
    session.set_stories(req.stories or [])
    session.set_knowledge_graph(req.knowledge_graph or {})
    session.set_repo_impact(req.repo_impact or {})

    if req.telemetry:
        session.set_telemetry(req.telemetry)

    if req.agent_logs:
        session.set_agent_logs(req.agent_logs)

    db.add(session)
    db.commit()
    db.refresh(session)

    return {"id": session.id, "title": session.title, "status": "saved"}


@router.patch("/{session_id}/jira-synced")
def mark_jira_synced(
    session_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Mark a session as having been pushed to Jira."""
    session = db.get(GenerationSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    session.jira_synced = True
    session.jira_sync_at = datetime.utcnow()
    db.commit()
    return {"status": "updated"}


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Delete a session permanently."""
    session = db.get(GenerationSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"status": "deleted"}
