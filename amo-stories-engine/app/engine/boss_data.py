"""Amoisekai — Boss Data Loader.

Loads boss templates from JSON files in app/data/bosses/.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.models.combat import BossTemplate

logger = logging.getLogger(__name__)

_BOSS_DIR = Path(__file__).parent.parent / "data" / "bosses"
_boss_cache: dict[str, BossTemplate] = {}


def load_boss(boss_id: str) -> BossTemplate | None:
    """Load a boss template by ID. Returns None if not found."""
    if boss_id in _boss_cache:
        return _boss_cache[boss_id]

    filepath = _BOSS_DIR / f"{boss_id}.json"
    if not filepath.exists():
        logger.warning(f"Boss file not found: {filepath}")
        return None

    try:
        data = json.loads(filepath.read_text(encoding="utf-8"))
        boss = BossTemplate(**data)
        _boss_cache[boss_id] = boss
        return boss
    except Exception as e:
        logger.error(f"Failed to load boss {boss_id}: {e}")
        return None


def load_floor_boss(floor: int) -> BossTemplate | None:
    """Load the boss template for a given floor number."""
    # Convention: file named floor_{n}_guardian.json
    return load_boss(f"floor_{floor}_guardian")


def list_available_bosses() -> list[str]:
    """Return list of available boss IDs from data directory."""
    if not _BOSS_DIR.exists():
        return []
    return [
        f.stem for f in _BOSS_DIR.glob("*.json")
    ]
