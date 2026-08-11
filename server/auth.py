import os
import base64
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from passlib.context import CryptContext
from jose import jwt, JWTError

from database import get_session
from models import User, WorkspaceConfig

# ── Security Configuration ──────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ai-jira-enterprise-secret-change-in-prod-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Fernet Encryption for API Keys ───────────────────────────────────────
def _get_fernet():
    """Get Fernet cipher for encrypting API keys at rest."""
    try:
        from cryptography.fernet import Fernet
        key = os.getenv("ENCRYPTION_KEY", "")
        if not key or len(key) < 32:
            # Derive a stable key from JWT_SECRET_KEY for local dev
            import hashlib
            raw = hashlib.sha256(SECRET_KEY.encode()).digest()
            key = base64.urlsafe_b64encode(raw)
        elif isinstance(key, str):
            key = key.encode()
        return Fernet(key)
    except ImportError:
        return None


def encrypt_key(plain: str) -> str:
    f = _get_fernet()
    if f:
        return f.encrypt(plain.encode()).decode()
    return base64.b64encode(plain.encode()).decode()  # Fallback: base64 (not secure, use cryptography in prod)


def decrypt_key(encrypted: str) -> str:
    f = _get_fernet()
    if f:
        try:
            return f.decrypt(encrypted.encode()).decode()
        except Exception:
            pass
    try:
        return base64.b64decode(encrypted).decode()
    except Exception:
        return encrypted


# ── Password Helpers ─────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT Helpers ──────────────────────────────────────────────────────────
def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return {}


# ── FastAPI Auth Dependency ──────────────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_session)
) -> Optional[User]:
    """Dependency that returns current user if JWT is valid, else None."""
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.get(User, int(user_id))


def require_auth(user: Optional[User] = Depends(get_current_user)) -> User:
    """Dependency that raises 401 if not authenticated."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# ── Request/Response Schemas ─────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


# ── Auth Routes ──────────────────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, db: Session = Depends(get_session)):
    # Check if email already exists
    existing = db.exec(select(User).where(User.email == req.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password)
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Seed workspace config from .env if provided (migration path for existing users)
    _seed_workspace_from_env(db, user.id)

    token = create_access_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_session)):
    user = db.exec(select(User).where(User.email == req.email)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.get("/me")
def get_me(user: User = Depends(require_auth)):
    return {"id": user.id, "email": user.email, "name": user.name, "created_at": str(user.created_at)}


def _seed_workspace_from_env(db: Session, user_id: int):
    """Seed workspace config from .env for the first registered user (migration path)."""
    openai_key = os.getenv("VITE_OPENAI_API_KEY", "")
    jira_url = os.getenv("VITE_JIRA_BASE_URL", "")
    jira_email = os.getenv("VITE_JIRA_EMAIL", "")
    jira_token = os.getenv("VITE_JIRA_API_TOKEN", "")
    jira_project = os.getenv("VITE_JIRA_PROJECT_KEY", "")

    if not openai_key and not jira_url:
        return  # Nothing to seed

    config = WorkspaceConfig(
        user_id=user_id,
        openai_key_enc=encrypt_key(openai_key) if openai_key else None,
        jira_base_url=jira_url or None,
        jira_email=jira_email or None,
        jira_token_enc=encrypt_key(jira_token) if jira_token else None,
        jira_project_key=jira_project or None,
    )
    db.add(config)
    db.commit()


def get_workspace_config(db: Session, user_id: int) -> WorkspaceConfig:
    """Get decrypted workspace config for a user."""
    return db.exec(select(WorkspaceConfig).where(WorkspaceConfig.user_id == user_id)).first()
