"""World State Store — lazy DB singleton for WorldState CRUD.

Follows the same pattern as ledger_store.py:
- Single shared StoryStateDB instance (lazily initialized)
- Simple load/save API consumed by pipeline nodes
- Best-effort: all errors are caught and logged, never raised to pipeline

Usage:
    from app.memory.world_state_store import load_world_state, save_world_state

    world_state = load_world_state(story_id)
    world_state.absorb_simulator_updates(updates)
    save_world_state(story_id, world_state, chapter=3)
"""

from __future__ import annotations

import logging

from app.models.world_state import WorldState

logger = logging.getLogger(__name__)

_db = None  # lazy singleton


def _get_db():
    """Return a connected StoryStateDB singleton."""
    global _db
    if _db is None:
        from app.config import settings
        from app.memory.state import StoryStateDB

        _db = StoryStateDB(settings.db_file)
        _db.connect()
    return _db


def load_world_state(story_id: str) -> WorldState:
    """Load WorldState for a story. Returns fresh default if none exists.

    Never raises — returns empty WorldState on any error.
    """
    try:
        return _get_db().get_world_state(story_id)
    except Exception as e:
        logger.warning(f"WorldStateStore: load failed for {story_id}: {e} — returning default")
        return WorldState()


def save_world_state(story_id: str, world_state: WorldState, chapter: int = 0) -> None:
    """Upsert WorldState for a story.

    Never raises — logs warning on failure.
    """
    try:
        _get_db().save_world_state(story_id, world_state, chapter)
    except Exception as e:
        logger.warning(f"WorldStateStore: save failed for {story_id}: {e}")
