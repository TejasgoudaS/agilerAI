"""
Rate Limiting Middleware for FastAPI.
Provides per-user or per-IP sliding-window rate limiting to protect endpoints against abuse.
"""
import time
from collections import defaultdict
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # client_key -> list of timestamp floats
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_identifier(self, request: Request) -> str:
        # Check authorization header for user identifier or fall back to client IP
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]
        return request.client.host if request.client else "127.0.0.1"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Bypass static assets, options preflight, and health check
        if request.method == "OPTIONS" or path.startswith("/assets") or path == "/api/health" or not path.startswith("/api/"):
            return await call_next(request)

        client_id = self._get_client_identifier(request)
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        timestamps = [t for t in self.requests[client_id] if t > cutoff]
        self.requests[client_id] = timestamps

        if len(timestamps) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - timestamps[0]))
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Please wait before making more requests.", "retryAfterSeconds": max(1, retry_after)},
                headers={"Retry-After": str(max(1, retry_after))}
            )

        self.requests[client_id].append(now)
        response = await call_next(request)
        return response
