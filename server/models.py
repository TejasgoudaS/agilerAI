from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
import json


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WorkspaceConfig(SQLModel, table=True):
    """Per-user encrypted workspace configuration (API keys, Jira settings, integrations)."""
    __tablename__ = "workspace_configs"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    llm_provider: str = Field(default="openai")
    # AI keys — AES-256 encrypted
    openai_key_enc: Optional[str] = Field(default=None)
    anthropic_key_enc: Optional[str] = Field(default=None)
    # Jira
    jira_base_url: Optional[str] = Field(default=None)
    jira_email: Optional[str] = Field(default=None)
    jira_token_enc: Optional[str] = Field(default=None)
    jira_project_key: Optional[str] = Field(default=None)
    # GitHub (Phase 3)
    github_token_enc: Optional[str] = Field(default=None)
    # Confluence (Phase 3)
    confluence_url: Optional[str] = Field(default=None)
    confluence_token_enc: Optional[str] = Field(default=None)
    confluence_space_key: Optional[str] = Field(default=None)
    # Slack / MS Teams (Phase 3)
    slack_webhook_url: Optional[str] = Field(default=None)
    teams_webhook_url: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GenerationSession(SQLModel, table=True):
    """Persisted PRD generation run with all metadata."""
    __tablename__ = "generation_sessions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(default="Untitled Session")
    prd_text: Optional[str] = Field(default=None, sa_column=Column(Text))
    prd_filename: Optional[str] = Field(default=None)
    status: str = Field(default="completed")
    epics_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    stories_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    knowledge_graph_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    repo_impact_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    telemetry_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    agent_logs_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    # Aggregate stats
    total_stories: int = Field(default=0)
    total_story_points: int = Field(default=0)
    total_cost_usd: float = Field(default=0.0)
    jira_synced: bool = Field(default=False)
    jira_sync_at: Optional[datetime] = Field(default=None)
    confluence_published: bool = Field(default=False)
    confluence_page_url: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def set_epics(self, v): self.epics_json = json.dumps(v)
    def get_epics(self) -> list: return json.loads(self.epics_json) if self.epics_json else []
    def set_stories(self, v):
        self.stories_json = json.dumps(v)
        self.total_stories = len(v)
        self.total_story_points = sum(int(s.get("storyPoints", 0)) for s in v)
    def get_stories(self) -> list: return json.loads(self.stories_json) if self.stories_json else []
    def set_knowledge_graph(self, v): self.knowledge_graph_json = json.dumps(v)
    def get_knowledge_graph(self) -> dict: return json.loads(self.knowledge_graph_json) if self.knowledge_graph_json else {}
    def set_repo_impact(self, v): self.repo_impact_json = json.dumps(v)
    def get_repo_impact(self) -> dict: return json.loads(self.repo_impact_json) if self.repo_impact_json else {}
    def set_telemetry(self, v):
        self.telemetry_json = json.dumps(v)
        self.total_cost_usd = v.get("totalCostUSD", 0.0)
    def get_telemetry(self) -> dict: return json.loads(self.telemetry_json) if self.telemetry_json else {}
    def set_agent_logs(self, v): self.agent_logs_json = json.dumps(v)
    def get_agent_logs(self) -> list: return json.loads(self.agent_logs_json) if self.agent_logs_json else []


class JobRecord(SQLModel, table=True):
    """Persistent background job tracker for async pipeline executions."""
    __tablename__ = "job_records"
    id: str = Field(primary_key=True)  # UUID
    user_id: int = Field(foreign_key="users.id", index=True)
    job_type: str = Field(default="generate")
    status: str = Field(default="queued")  # queued|running|completed|failed
    progress: int = Field(default=0)      # 0–100
    error: Optional[str] = Field(default=None)
    result_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)


class StoryRating(SQLModel, table=True):
    """User quality ratings for AI-generated stories (feeds back to prompt calibration)."""
    __tablename__ = "story_ratings"
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="generation_sessions.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    story_title: str = Field(max_length=200)
    rating: int  # 1–5 stars
    feedback: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StoryVersion(SQLModel, table=True):
    """Git-style version history for story edits."""
    __tablename__ = "story_versions"
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="generation_sessions.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    story_id: str  # client-side story identifier
    version_number: int = Field(default=1)
    snapshot_json: str = Field(sa_column=Column(Text))  # Full story JSON at this version
    change_summary: Optional[str] = Field(default=None)  # e.g. "Updated acceptance criteria"
    created_at: datetime = Field(default_factory=datetime.utcnow)
