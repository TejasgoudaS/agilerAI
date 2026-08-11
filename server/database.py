import os
from sqlmodel import create_engine, Session, SQLModel

# Use SQLite locally (zero setup). Switch to PostgreSQL in production via DATABASE_URL env var.
# PostgreSQL example: postgresql+psycopg2://user:password@localhost:5432/aijira
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./ai_agile.db"  # Stored in project root, persists across restarts
)

# SQLite needs check_same_thread=False for multi-threaded FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False  # Set True to log SQL queries in dev
)


def create_db_and_tables():
    """Create all tables from SQLModel metadata. Safe to call on every startup (idempotent)."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that yields a database session."""
    with Session(engine) as session:
        yield session
