"""Companion persistence — load/save CompanionProfile per story.

Uses the shared StoryStateDB SQLite connection (companions table
created in state.py schema migration).

Public API:
    save_companion(db, companion) -> None
    get_story_companions(db, story_id) -> list[CompanionProfile]
    get_companion(db, companion_id) -> CompanionProfile | None
    delete_companion(db, companion_id) -> None
    update_affinity(db, companion_id, delta, reason, chapter, scene, trigger_type, tone_multiplier) -> int
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import TYPE_CHECKING

from app.models.companion import CompanionAbility, AffinityEvent, CompanionProfile

if TYPE_CHECKING:
    from app.memory.state import StoryStateDB

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Save / Load
# ──────────────────────────────────────────────

def save_companion(db: "StoryStateDB", companion: CompanionProfile) -> None:
    """Upsert a companion profile to the database."""
    if not companion.id:
        companion.id = str(uuid.uuid4())
    db.conn.execute(
        """INSERT OR REPLACE INTO companions (
            id, story_id, name, gender, role,
            personality_core, appearance_anchor,
            backstory_surface, backstory_hidden, secret, secret_reveal_trigger,
            companion_archetype_type, first_appeared_chapter,
            status, departure_reason,
            affinity, affinity_tier,
            ability_json, affinity_history_json, notable_quotes_json,
            last_emotional_state,
            response_to_player_male, response_to_player_female
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            companion.id,
            companion.story_id,
            companion.name,
            companion.gender,
            companion.role,
            companion.personality_core,
            companion.appearance_anchor,
            companion.backstory_surface,
            companion.backstory_hidden,
            companion.secret,
            companion.secret_reveal_trigger,
            companion.companion_archetype_type,
            companion.first_appeared_chapter,
            companion.status,
            companion.departure_reason,
            companion.affinity,
            companion.affinity_tier,
            json.dumps(companion.ability.model_dump(), ensure_ascii=False),
            json.dumps([e.model_dump() for e in companion.affinity_history], ensure_ascii=False),
            json.dumps(companion.notable_quotes, ensure_ascii=False),
            companion.last_emotional_state,
            companion.response_to_player_male,
            companion.response_to_player_female,
        ),
    )
    db.conn.commit()
    logger.info(f"CompanionStore: saved companion '{companion.name}' (id={companion.id})")


def get_story_companions(
    db: "StoryStateDB",
    story_id: str,
    active_only: bool = True,
) -> list[CompanionProfile]:
    """Load all companions for a story, optionally filtering to active only."""
    query = "SELECT * FROM companions WHERE story_id = ?"
    params: list = [story_id]
    if active_only:
        query += " AND status = 'active'"
    query += " ORDER BY first_appeared_chapter ASC"
    rows = db.conn.execute(query, params).fetchall()
    return [_row_to_companion(r) for r in rows]


def get_companion(db: "StoryStateDB", companion_id: str) -> CompanionProfile | None:
    """Load a single companion by id."""
    row = db.conn.execute(
        "SELECT * FROM companions WHERE id = ?", (companion_id,)
    ).fetchone()
    return _row_to_companion(row) if row else None


def get_companion_by_name(
    db: "StoryStateDB", story_id: str, name: str
) -> CompanionProfile | None:
    """Load a companion by (story_id, name). Names are canonical per story."""
    row = db.conn.execute(
        "SELECT * FROM companions WHERE story_id = ? AND name = ?",
        (story_id, name),
    ).fetchone()
    return _row_to_companion(row) if row else None


def delete_companion(db: "StoryStateDB", companion_id: str) -> None:
    """Remove a companion record."""
    db.conn.execute("DELETE FROM companions WHERE id = ?", (companion_id,))
    db.conn.commit()


# ──────────────────────────────────────────────
# Affinity update
# ──────────────────────────────────────────────

def update_affinity(
    db: "StoryStateDB",
    companion_id: str,
    delta: int,
    reason: str,
    chapter: int = 0,
    scene: int = 0,
    trigger_type: str = "consequence",
    tone_multiplier: float = 1.0,
) -> int:
    """Apply an affinity delta to a companion and persist the result.

    Returns the actual delta applied (may differ from raw delta due to
    tone_multiplier and clamping).
    """
    companion = get_companion(db, companion_id)
    if not companion:
        logger.warning(f"CompanionStore: companion {companion_id} not found for affinity update")
        return 0
    actual = companion.apply_delta(
        delta=delta,
        reason=reason,
        chapter=chapter,
        scene=scene,
        trigger_type=trigger_type,
        tone_multiplier=tone_multiplier,
    )

    # Determine status transition BEFORE saving (single save)
    if companion.status == "active":
        if companion.is_adversary():
            # affinity hit the floor (-20) — adversary-level betrayal
            companion.status = "departed"
            companion.departure_reason = "adversary"
            logger.warning(
                f"CompanionStore: '{companion.name}' → adversary threshold "
                f"(affinity={companion.affinity}), status=departed"
            )
        elif companion.affinity < -10:
            # permanent departure
            companion.status = "departed"
            if not companion.departure_reason:
                companion.departure_reason = "permanent"
            logger.info(
                f"CompanionStore: '{companion.name}' permanently departed "
                f"(affinity={companion.affinity})"
            )
        elif companion.affinity < 0:
            # temporary departure — can return if affinity recovers
            companion.status = "departed"
            if not companion.departure_reason:
                companion.departure_reason = "temporary"
            logger.info(
                f"CompanionStore: '{companion.name}' temporarily departed "
                f"(affinity={companion.affinity})"
            )

    save_companion(db, companion)
    return actual


def batch_update_affinity(
    db: "StoryStateDB",
    story_id: str,
    affinity_deltas: dict[str, int],
    chapter: int = 0,
    tone_multiplier: float = 1.0,
) -> None:
    """Apply batch affinity deltas by companion name after a chapter.

    affinity_deltas: {companion_name: delta_value}
    Called by orchestrator after Simulator/Consequence Router output.
    """
    for companion_name, delta in affinity_deltas.items():
        companion = get_companion_by_name(db, story_id, companion_name)
        if not companion:
            logger.debug(f"CompanionStore: '{companion_name}' not found in story {story_id}, skip affinity update")
            continue
        update_affinity(
            db,
            companion.id,
            delta=delta,
            reason=f"Chapter {chapter} batch update",
            chapter=chapter,
            trigger_type="consequence",
            tone_multiplier=tone_multiplier,
        )


# ──────────────────────────────────────────────
# Row mapper
# ──────────────────────────────────────────────

_VALID_ROLES = {"fighter", "strategist", "scout", "healer", "mage", "diplomat", "wanderer"}
_VALID_GENDERS = {"male", "female", "neutral"}
_VALID_STATUSES = {"active", "departed", "dead", "unknown"}


def _row_to_companion(row) -> CompanionProfile:
    """Convert a sqlite3.Row to CompanionProfile.

    Handles missing columns (pre-migration DBs) and invalid Literal values
    by falling back to safe defaults instead of raising.
    """
    row_keys = set(row.keys()) if hasattr(row, "keys") else set()

    # Parse ability JSON
    ability_data: dict = {}
    try:
        ability_data = json.loads(row["ability_json"] or "{}")
    except (json.JSONDecodeError, TypeError):
        pass

    # Parse affinity history
    history: list[AffinityEvent] = []
    try:
        raw_history = json.loads(row["affinity_history_json"] or "[]")
        history = [AffinityEvent(**e) for e in raw_history if isinstance(e, dict)]
    except Exception:
        pass

    # Parse notable quotes
    quotes: list[str] = []
    try:
        quotes = json.loads(row["notable_quotes_json"] or "[]")
    except (json.JSONDecodeError, TypeError):
        pass

    # Safe Literal fields — fallback to defaults if DB has stale/invalid values
    raw_gender = row["gender"] or "neutral"
    gender = raw_gender if raw_gender in _VALID_GENDERS else "neutral"

    raw_role = row["role"] or "fighter"
    role = raw_role if raw_role in _VALID_ROLES else "fighter"

    raw_status = row["status"] or "active"
    status = raw_status if raw_status in _VALID_STATUSES else "active"

    # companion_archetype_type — may not exist in old DBs
    archetype_type = ""
    if "companion_archetype_type" in row_keys:
        archetype_type = row["companion_archetype_type"] or ""

    try:
        return CompanionProfile(
            id=row["id"],
            story_id=row["story_id"],
            name=row["name"],
            gender=gender,
            role=role,
            personality_core=row["personality_core"] or "",
            appearance_anchor=row["appearance_anchor"] or "",
            backstory_surface=row["backstory_surface"] or "",
            backstory_hidden=row["backstory_hidden"] or "",
            secret=row["secret"] or "",
            secret_reveal_trigger=row["secret_reveal_trigger"] or "",
            companion_archetype_type=archetype_type,
            first_appeared_chapter=row["first_appeared_chapter"] or 1,
            status=status,
            departure_reason=row["departure_reason"] or "",
            affinity=row["affinity"] if row["affinity"] is not None else 20,
            affinity_tier=row["affinity_tier"] or "acquaintance",
            ability=CompanionAbility(**ability_data) if ability_data else CompanionAbility(),
            affinity_history=history,
            notable_quotes=quotes,
            last_emotional_state=row["last_emotional_state"] or "neutral",
            response_to_player_male=row["response_to_player_male"] or "",
            response_to_player_female=row["response_to_player_female"] or "",
        )
    except Exception as exc:
        logger.warning(f"CompanionStore: _row_to_companion failed for id={row['id'] if 'id' in row_keys else '?'}: {exc} — returning minimal profile")
        return CompanionProfile(
            id=row["id"] if "id" in row_keys else "",
            story_id=row["story_id"] if "story_id" in row_keys else "",
            name=row["name"] if "name" in row_keys else "Unknown",
        )
