"""Amo Stories Engine — FastAPI application.

Run with:
    cd amo-stories-engine
    pip install -e .
    uvicorn app.main:app --reload --port 8001
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.memory.state import StoryStateDB

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Global state
# ──────────────────────────────────────────────

_db: StoryStateDB | None = None


def get_db() -> StoryStateDB:
    """Get the global StoryStateDB instance."""
    global _db  # noqa: PLW0603
    if _db is None:
        _db = StoryStateDB(settings.db_file)
        _db.connect()
    return _db


# ──────────────────────────────────────────────
# Lifespan
# ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Production guard — refuse to start without auth configured
    if settings.env == "production" and not settings.supabase_jwt_secret:
        raise RuntimeError(
            "SUPABASE_JWT_SECRET must be set in production (ENV=production). "
            "Authentication is currently DISABLED — refusing to start."
        )

    # Startup: init DB
    db = get_db()
    logger.info(f"[Amo Stories] DB connected: {settings.db_path}")
    logger.info(f"[Amo Stories] CORS origins: {settings.cors_origin_list}")
    logger.info(f"[Amo Stories] Environment: {settings.env}")

    yield

    # Shutdown: close DB
    db.close()
    logger.info("[Amo Stories] DB closed. Goodbye!")


# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # HSTS: only meaningful over HTTPS — safe to include unconditionally
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # CSP: API-first policy — no inline scripts, no framing, no mixed content
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        return response


_is_production = settings.env == "production"

app = FastAPI(
    title="Amo Stories Engine",
    description="AI-powered interactive fiction engine for AmoLofi",
    version="0.1.0",
    lifespan=lifespan,
    # Disable API explorer in production — prevents schema enumeration
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# Security headers — added before CORS so they apply to all responses
app.add_middleware(SecurityHeadersMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    db = get_db()
    # Quick DB check — confirm connectivity only, no counts exposed
    db.conn.execute("SELECT 1").fetchone()
    return {
        "status": "ok",
        "service": "amo-stories-engine",
        "version": "0.2.0",
    }


# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────

from app.routers.story import router as story_router  # noqa: E402
from app.routers.stream import router as stream_router  # noqa: E402
from app.routers.player import router as player_router  # noqa: E402
from app.routers.soul_forge import router as soul_forge_router  # noqa: E402
from app.routers.scene import router as scene_router  # noqa: E402
from app.routers.skill_router import router as skill_router  # noqa: E402

app.include_router(story_router)
app.include_router(stream_router)
app.include_router(player_router)
app.include_router(soul_forge_router)
app.include_router(scene_router)
app.include_router(skill_router)


# ──────────────────────────────────────────────
# Static files (web frontend) — MUST be last so API routes take priority
# ──────────────────────────────────────────────

from pathlib import Path  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

_web_dir = Path(__file__).resolve().parent.parent / "web"
if _web_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_web_dir), html=True), name="static")
