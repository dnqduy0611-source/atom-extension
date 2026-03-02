"""Ledger Store — lazy singleton DB access for Story Ledger operations.

Pipeline nodes use this to load/save ledgers without depending on
FastAPI's get_db() (which would create circular imports).

Pattern mirrors story_brain.py's get_or_create_brain().
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings
from app.models.story_ledger import StoryLedger

logger = logging.getLogger(__name__)

_db = None


def _get_db():
    """Lazy-init shared StoryStateDB instance for ledger ops."""
    global _db  # noqa: PLW0603
    if _db is None:
        from app.memory.state import StoryStateDB
        _db = StoryStateDB(settings.db_file)
        _db.connect()
    return _db


def load_ledger(story_id: str) -> StoryLedger:
    """Load Story Ledger for a story. Returns empty ledger on any failure."""
    try:
        return _get_db().get_story_ledger(story_id)
    except Exception as e:
        logger.warning(f"LedgerStore: load failed for {story_id}: {e}")
        return StoryLedger(story_id=story_id)


def save_ledger(ledger: StoryLedger) -> None:
    """Save Story Ledger. Logs warning on failure, does not raise."""
    try:
        _get_db().save_story_ledger(ledger)
        logger.debug(
            f"LedgerStore: saved story={ledger.story_id} "
            f"ch={ledger.last_updated_chapter} "
            f"entities={ledger.entity_count()} facts={ledger.fact_count()}"
        )
    except Exception as e:
        logger.warning(f"LedgerStore: save failed for {ledger.story_id}: {e}")
