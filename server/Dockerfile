# Agiler AI backend — built from the project root build context
# (needs src/ + server/ both present so codebase_indexer can index the whole repo,
# matching local dev behavior where main.py's ROOT_DIR is the project root).
FROM python:3.12-slim

WORKDIR /app

# build-essential: safety net in case any of crewai's dependency tree doesn't ship a
# prebuilt wheel for the host platform's exact Python/OS combo — pip can then build
# it from source instead of hard-failing. Slightly slower image build, portable either way.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install deps first for better layer caching
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy the rest of the project (see .dockerignore for exclusions)
COPY . .

WORKDIR /app/server
EXPOSE 8000

# Single worker: job_queue.py and the SSE event queues are in-process/in-memory —
# running >1 worker would split that state across processes and break job status
# polling and SSE streaming. Scale via a real queue (Redis/Celery) before adding workers.
#
# Shell form (not exec-form JSON array) so ${PORT:-8000} actually expands:
# Railway injects its own PORT env var at runtime; local `docker compose` runs
# without one, so it falls back to 8000 to match docker-compose.yml's port mapping.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
