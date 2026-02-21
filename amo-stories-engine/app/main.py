"""Amo Stories Engine — FastAPI application.

Run with:
    cd amo-stories-engine
    pip install -e .
    uvicorn app.main:app --reload --port 8001
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.memory.state import StoryStateDB

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
    # Startup: init DB
    db = get_db()
    print(f"[Amo Stories] DB connected: {settings.db_path}")
    print(f"[Amo Stories] CORS origins: {settings.cors_origin_list}")

    yield

    # Shutdown: close DB
    db.close()
    print("[Amo Stories] DB closed. Goodbye!")


# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────

app = FastAPI(
    title="Amo Stories Engine",
    description="AI-powered interactive fiction engine for AmoLofi",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health():
    """Health check endpoint."""
    db = get_db()
    # Quick DB check
    story_count = db.conn.execute("SELECT COUNT(*) FROM stories").fetchone()[0]
    return {
        "status": "ok",
        "service": "amo-stories-engine",
        "version": "0.1.0",
        "stories_count": story_count,
        "models": {
            "planner": settings.planner_model,
            "writer": settings.writer_model,
        },
    }


# ──────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────

from app.routers.story import router as story_router  # noqa: E402
from app.routers.stream import router as stream_router  # noqa: E402

app.include_router(story_router)
app.include_router(stream_router)
