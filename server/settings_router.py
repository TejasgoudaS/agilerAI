from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select
from datetime import datetime

from database import get_session
from models import WorkspaceConfig
from auth import require_auth, encrypt_key, decrypt_key, get_workspace_config
from models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


class WorkspaceConfigRequest(BaseModel):
    llm_provider: Optional[str] = None
    openai_key: Optional[str] = None       # plain-text, will be encrypted server-side
    anthropic_key: Optional[str] = None
    jira_base_url: Optional[str] = None
    jira_email: Optional[str] = None
    jira_token: Optional[str] = None       # plain-text, will be encrypted server-side
    jira_project_key: Optional[str] = None


def _mask(value: Optional[str]) -> str:
    """Mask all but last 4 chars of a sensitive value for display."""
    if not value:
        return ""
    visible = min(4, len(value))
    return "•" * (len(value) - visible) + value[-visible:]


@router.get("")
def get_settings(
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Return current workspace config with keys masked for display."""
    config = get_workspace_config(db, user.id)
    if not config:
        return {
            "configured": False,
            "llm_provider": "openai",
            "openai_key": "",
            "anthropic_key": "",
            "jira_base_url": "",
            "jira_email": "",
            "jira_token": "",
            "jira_project_key": ""
        }

    # Decrypt to check existence, then mask for UI display
    plain_openai = decrypt_key(config.openai_key_enc) if config.openai_key_enc else ""
    plain_anthropic = decrypt_key(config.anthropic_key_enc) if config.anthropic_key_enc else ""
    plain_jira = decrypt_key(config.jira_token_enc) if config.jira_token_enc else ""

    return {
        "configured": bool(plain_openai or plain_jira),
        "llm_provider": config.llm_provider,
        "openai_key": _mask(plain_openai),
        "anthropic_key": _mask(plain_anthropic),
        "jira_base_url": config.jira_base_url or "",
        "jira_email": config.jira_email or "",
        "jira_token": _mask(plain_jira),
        "jira_project_key": config.jira_project_key or "",
    }


@router.post("")
def save_settings(
    req: WorkspaceConfigRequest,
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Save workspace configuration with API keys encrypted at rest."""
    config = get_workspace_config(db, user.id)

    if not config:
        config = WorkspaceConfig(user_id=user.id)
        db.add(config)

    # Only update fields that were explicitly provided (non-None)
    if req.llm_provider is not None:
        config.llm_provider = req.llm_provider

    if req.jira_base_url is not None:
        config.jira_base_url = req.jira_base_url.rstrip("/")

    if req.jira_email is not None:
        config.jira_email = req.jira_email

    if req.jira_project_key is not None:
        config.jira_project_key = req.jira_project_key

    # Encrypt keys — skip if the field contains masked bullets (user didn't change it)
    if req.openai_key and "•" not in req.openai_key:
        config.openai_key_enc = encrypt_key(req.openai_key)

    if req.anthropic_key and "•" not in req.anthropic_key:
        config.anthropic_key_enc = encrypt_key(req.anthropic_key)

    if req.jira_token and "•" not in req.jira_token:
        config.jira_token_enc = encrypt_key(req.jira_token)

    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)

    return {"status": "saved", "message": "Workspace configuration saved successfully"}


@router.get("/resolved")
def get_resolved_settings(
    user: User = Depends(require_auth),
    db: Session = Depends(get_session)
):
    """Internal endpoint: return fully decrypted config for agent pipeline use."""
    config = get_workspace_config(db, user.id)
    if not config:
        return {}
    return {
        "openai_key": decrypt_key(config.openai_key_enc) if config.openai_key_enc else "",
        "anthropic_key": decrypt_key(config.anthropic_key_enc) if config.anthropic_key_enc else "",
        "llm_provider": config.llm_provider,
        "jira_base_url": config.jira_base_url or "",
        "jira_email": config.jira_email or "",
        "jira_token": decrypt_key(config.jira_token_enc) if config.jira_token_enc else "",
        "jira_project_key": config.jira_project_key or "",
    }
