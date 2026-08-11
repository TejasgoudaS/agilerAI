"""
Integrations router: GitHub indexing, Confluence publishing, Slack/Teams webhooks.
Analytics router: usage metrics, velocity benchmarking, cost dashboard.
"""
import json
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select

from database import get_session
from models import User, WorkspaceConfig, GenerationSession, StoryRating
from auth import require_auth, get_workspace_config, decrypt_key
from github_indexer import github_indexer
from confluence_client import ConfluenceClient
from velocity_engine import velocity_engine
from velocity_calibrator import velocity_calibrator

# ── Integrations Router ──────────────────────────────────────────────────
integrations_router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class GitHubIndexRequest(BaseModel):
    github_url: str
    github_token: Optional[str] = None


class ConfluencePublishRequest(BaseModel):
    session_id: int
    space_key: str
    parent_page_id: Optional[str] = None


class SlackNotifyRequest(BaseModel):
    webhook_url: str
    message: str
    session_id: Optional[int] = None


@integrations_router.post("/github/index")
def index_github_repo(
    req: GitHubIndexRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Index a GitHub repo directly from URL — public or private (with token)."""
    config = get_workspace_config(db, user.id)
    token = req.github_token
    if not token and config and config.github_token_enc:
        token = decrypt_key(config.github_token_enc)

    try:
        stats = github_indexer.index_from_url(req.github_url, token=token)
        return {"status": "success", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@integrations_router.get("/github/status")
def github_index_status(user: User = Depends(require_auth)):
    """Return current GitHub index status."""
    return {
        "indexed": bool(github_indexer.last_indexed_url),
        "url": github_indexer.last_indexed_url,
        "fileCount": len(github_indexer.indexed_files),
        "stats": github_indexer.stats,
    }


@integrations_router.post("/confluence/publish")
def publish_to_confluence(
    req: ConfluencePublishRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Publish a generation session as a Confluence page."""
    config = get_workspace_config(db, user.id)
    if not config or not config.confluence_url:
        raise HTTPException(status_code=400, detail="Confluence not configured. Set it in Settings.")

    session = db.get(GenerationSession, req.session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    confluence_token = decrypt_key(config.confluence_token_enc) if config.confluence_token_enc else ""
    client = ConfluenceClient(
        base_url=config.confluence_url,
        email=config.jira_email or "",
        api_token=confluence_token,
        space_key=req.space_key,
    )

    session_data = {
        "title": session.title,
        "prd_filename": session.prd_filename,
        "epics": session.get_epics(),
        "stories": session.get_stories(),
        "telemetry": session.get_telemetry(),
    }

    try:
        result = client.publish_sprint_backlog(session_data, req.space_key, req.parent_page_id)
        return {"status": "published", "url": result["url"], "pageId": result["pageId"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@integrations_router.post("/slack/notify")
async def send_slack_notification(
    req: SlackNotifyRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Send a Slack/Teams webhook notification."""
    config = get_workspace_config(db, user.id)
    webhook_url = req.webhook_url

    # Fall back to stored webhook
    if not webhook_url and config and config.slack_webhook_url:
        webhook_url = config.slack_webhook_url

    if not webhook_url:
        raise HTTPException(status_code=400, detail="No webhook URL configured")

    # Build rich Slack message
    session_text = ""
    if req.session_id:
        session = db.get(GenerationSession, req.session_id)
        if session:
            session_text = f"\n*Session:* {session.title} | {session.total_stories} stories | {session.total_story_points} story points"

    payload = {
        "text": req.message + session_text,
        "username": "Agiler AI",
        "icon_emoji": ":robot_face:",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(webhook_url, json=payload)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Slack returned {r.status_code}: {r.text}")

    return {"status": "sent"}


# ── Analytics Router ─────────────────────────────────────────────────────
analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class StoryRatingRequest(BaseModel):
    session_id: int
    story_title: str
    rating: int           # 1–5
    feedback: Optional[str] = None


@analytics_router.get("/usage")
def get_usage_analytics(
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Return aggregated usage stats for the current user."""
    sessions = db.exec(
        select(GenerationSession).where(GenerationSession.user_id == user.id)
    ).all()

    if not sessions:
        return {"totalSessions": 0, "totalCostUSD": 0, "totalStories": 0, "totalStoryPoints": 0}

    total_cost = sum(s.total_cost_usd for s in sessions)
    total_stories = sum(s.total_stories for s in sessions)
    total_sp = sum(s.total_story_points for s in sessions)
    jira_synced = sum(1 for s in sessions if s.jira_synced)

    # Cost per session trend (last 10)
    recent = sorted(sessions, key=lambda s: s.created_at)[-10:]
    cost_trend = [
        {"date": s.created_at.strftime("%b %d"), "cost": round(s.total_cost_usd, 4), "stories": s.total_stories}
        for s in recent
    ]

    # Token breakdown from telemetry
    total_tokens = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    for s in sessions:
        t = s.get_telemetry()
        total_tokens += t.get("totalTokens", 0)
        total_prompt_tokens += t.get("promptTokens", 0)
        total_completion_tokens += t.get("completionTokens", 0)

    return {
        "totalSessions": len(sessions),
        "totalCostUSD": round(total_cost, 4),
        "totalStories": total_stories,
        "totalStoryPoints": total_sp,
        "jiraSynced": jira_synced,
        "avgCostPerSession": round(total_cost / len(sessions), 4) if sessions else 0,
        "avgStoriesPerSession": round(total_stories / len(sessions), 1) if sessions else 0,
        "totalTokens": total_tokens,
        "promptTokens": total_prompt_tokens,
        "completionTokens": total_completion_tokens,
        "costTrend": cost_trend,
    }


@analytics_router.get("/velocity")
def get_velocity_report(
    board_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Pull Jira sprint history and compute velocity benchmarks."""
    config = get_workspace_config(db, user.id)
    if not config or not config.jira_base_url:
        raise HTTPException(status_code=400, detail="Jira not configured")

    jira_token = decrypt_key(config.jira_token_enc) if config.jira_token_enc else ""
    try:
        report = velocity_engine.compute_velocity_report(
            jira_base_url=config.jira_base_url,
            board_id=board_id,
            jira_email=config.jira_email or "",
            jira_token=jira_token,
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.post("/velocity/calibrate")
def calibrate_velocity_model(
    board_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """
    Train the velocity_calibrator on real (AI estimate -> Jira actual) pairs.
    Pulls every completed sprint's issues from the configured board, matches
    them against every story this user has ever generated, and fits a Ridge
    regression to the systematic estimation bias. No-ops gracefully (with a
    clear reason) when there isn't yet enough matched history.
    """
    config = get_workspace_config(db, user.id)
    if not config or not config.jira_base_url:
        raise HTTPException(status_code=400, detail="Jira not configured")

    jira_token = decrypt_key(config.jira_token_enc) if config.jira_token_enc else ""

    try:
        sprints = velocity_engine.get_completed_sprints(
            jira_base_url=config.jira_base_url, board_id=board_id,
            jira_email=config.jira_email or "", jira_token=jira_token,
        )
        all_issues = []
        for sprint in sprints:
            try:
                all_issues.extend(velocity_engine.get_sprint_issues(
                    jira_base_url=config.jira_base_url, sprint_id=sprint["id"],
                    jira_email=config.jira_email or "", jira_token=jira_token,
                ))
            except Exception:
                continue

        sessions = db.exec(
            select(GenerationSession).where(GenerationSession.user_id == user.id)
        ).all()
        all_ai_stories = [s for session in sessions for s in session.get_stories()]

        accuracy = velocity_engine.compute_estimation_accuracy(all_ai_stories, all_issues)
        samples = [(m["story"], m["jiraActual"]) for m in accuracy.get("details", []) if m.get("story")]

        result = velocity_calibrator.fit(samples)
        return {**result, "matchedFromJira": len(samples)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@analytics_router.get("/velocity/calibration-status")
def get_calibration_status(user: User = Depends(require_auth)):
    """Return whether the ML velocity calibrator is trained and on how much data."""
    return velocity_calibrator.status()


@analytics_router.post("/story-rating")
def rate_story(
    req: StoryRatingRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Submit a quality rating for a generated story."""
    if not (1 <= req.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be 1–5")

    session = db.get(GenerationSession, req.session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Check for existing rating
    existing = db.exec(
        select(StoryRating).where(
            StoryRating.session_id == req.session_id,
            StoryRating.story_title == req.story_title[:200]
        )
    ).first()

    if existing:
        existing.rating = req.rating
        existing.feedback = req.feedback
        db.add(existing)
    else:
        rating = StoryRating(
            session_id=req.session_id,
            user_id=user.id,
            story_title=req.story_title[:200],
            rating=req.rating,
            feedback=req.feedback,
        )
        db.add(rating)

    db.commit()
    return {"status": "saved", "rating": req.rating}


@analytics_router.get("/story-ratings/{session_id}")
def get_story_ratings(
    session_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Return all story ratings for a session."""
    ratings = db.exec(
        select(StoryRating).where(
            StoryRating.session_id == session_id,
            StoryRating.user_id == user.id
        )
    ).all()

    avg = sum(r.rating for r in ratings) / len(ratings) if ratings else None
    return {
        "sessionId": session_id,
        "ratings": [
            {"storyTitle": r.story_title, "rating": r.rating, "feedback": r.feedback}
            for r in ratings
        ],
        "averageRating": round(avg, 2) if avg else None,
        "totalRated": len(ratings),
    }
