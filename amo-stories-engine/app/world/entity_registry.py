"""Entity Registry — canonical world entity loader and prompt formatter.

Loads entity_registry.yaml (source of truth) and provides:
- get_entities_for_archetype() — NPC/emissary affinity lookup
- get_location() — canonical location data
- format_for_prompt() — compact injection-ready text for writer/critic

Cached at import time (lru_cache) — no hot-reload during runtime.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Registry file paths (priority order) ──
_REGISTRY_PATHS = [
    # Canonical source in Amoisekai design folder
    Path(__file__).parent.parent.parent.parent / "Amoisekai" / "data" / "entity_registry.yaml",
    # Fallback copy inside the engine (for deployment environments)
    Path(__file__).parent.parent / "data" / "entity_registry.yaml",
]


@lru_cache(maxsize=1)
def _load_registry() -> dict:
    """Load and cache registry YAML. Returns empty dict on failure."""
    try:
        import yaml  # type: ignore[import]
    except ImportError:
        logger.warning("PyYAML not installed — entity registry disabled")
        return {}

    for path in _REGISTRY_PATHS:
        if path.exists():
            try:
                data = yaml.safe_load(path.read_text(encoding="utf-8"))
                total = sum(
                    len(data.get(k, []))
                    for k in ["npcs", "locations", "emissaries", "generals"]
                )
                logger.info(f"Entity registry loaded: {path} ({total} entities)")
                return data or {}
            except Exception as e:
                logger.error(f"Entity registry parse error ({path}): {e}")

    logger.warning("Entity registry not found — world consistency degraded")
    return {}


# ──────────────────────────────────────────────
# Public query API
# ──────────────────────────────────────────────

def get_entities_for_archetype(archetype: str) -> list[dict]:
    """Return NPCs whose archetype_affinity includes the given archetype."""
    registry = _load_registry()
    archetype_lower = (archetype or "").lower()
    return [
        npc for npc in registry.get("npcs", [])
        if archetype_lower in [a.lower() for a in npc.get("archetype_affinity", [])]
    ]


def get_emissary_for_archetype(archetype: str) -> dict | None:
    """Return the Emissary assigned to this archetype (or None)."""
    registry = _load_registry()
    archetype_lower = (archetype or "").lower()
    for emissary in registry.get("emissaries", []):
        if archetype_lower in [a.lower() for a in emissary.get("archetype_assigned", [])]:
            return emissary
    return None


def get_general_for_archetype(archetype: str) -> dict | None:
    """Return the General whose shadow is assigned to this archetype."""
    registry = _load_registry()
    archetype_lower = (archetype or "").lower()
    for general in registry.get("generals", []):
        if archetype_lower in [a.lower() for a in general.get("archetype_shadow", [])]:
            return general
    return None


def get_location(location_id: str) -> dict | None:
    """Return a canonical location entry by ID."""
    registry = _load_registry()
    for loc in registry.get("locations", []):
        if loc.get("id") == location_id:
            return loc
    return None


def get_starting_location(archetype: str) -> dict | None:
    """Return the starting location for a given archetype."""
    registry = _load_registry()
    archetype_lower = (archetype or "").lower()
    for loc in registry.get("locations", []):
        if archetype_lower in [a.lower() for a in loc.get("starting_zone_for", [])]:
            return loc
    return None


def get_entity_by_id(entity_id: str) -> dict | None:
    """Return any entity (npc / location / emissary / general) by its id."""
    registry = _load_registry()
    for category in ("npcs", "locations", "emissaries", "generals"):
        for entity in registry.get(category, []):
            if entity.get("id") == entity_id:
                return entity
    return None


# ──────────────────────────────────────────────
# Prompt formatting
# ──────────────────────────────────────────────

def build_entity_context(archetype: str) -> str:
    """Build a compact entity context block for injection into writer/critic prompts.

    Includes:
    - Starting location canonical description
    - NPCs with affinity for this archetype
    - Assigned Emissary profile (condensed)
    - Assigned General shadow note

    Returns empty string if nothing relevant found (graceful degradation).
    """
    parts: list[str] = []

    # ── Starting location ──
    location = get_starting_location(archetype)
    if location:
        forbidden = "; ".join(location.get("forbidden_descriptions", []))
        loc_block = (
            f"### LOCATION: {location['name']}\n"
            f"{location['description_anchor'].strip()}"
        )
        if forbidden:
            loc_block += f"\nNHỮNG THỨ KHÔNG ĐƯỢC MÔ TẢ: {forbidden}"
        parts.append(loc_block)

    # ── Affinity NPCs ──
    npcs = get_entities_for_archetype(archetype)
    for npc in npcs[:3]:  # cap at 3 to control token usage
        npc_block = (
            f"### NPC: {npc['name']} ({npc['role']})\n"
            f"{npc['personality_core'].strip()}"
        )
        if npc.get("notes_for_ai"):
            npc_block += f"\nHƯỚNG DẪN AI: {npc['notes_for_ai'].strip()}"
        parts.append(npc_block)

    # ── Assigned Emissary ──
    emissary = get_emissary_for_archetype(archetype)
    if emissary:
        em_block = (
            f"### EMISSARY: {emissary['name']} — {emissary['title']}\n"
            f"Triết lý: {emissary['principle_alignment']}\n"
            f"Tính cách: {emissary['personality_core'].strip()}"
        )
        if emissary.get("notes_for_ai"):
            em_block += f"\nHƯỚNG DẪN AI: {emissary['notes_for_ai'].strip()}"
        if emissary.get("forbidden"):
            em_block += f"\nCẤM: {'; '.join(emissary['forbidden'])}"
        parts.append(em_block)

    # ── Assigned General (shadow note only) ──
    general = get_general_for_archetype(archetype)
    if general:
        gen_block = (
            f"### GENERAL SHADOW: {general['name']} — {general['title']}\n"
            f"Phase 1 role: {general.get('phase1_role', 'shadow_voice_only')}\n"
            f"Tính cách: {general['personality_core'].strip()}"
        )
        if general.get("notes_for_ai"):
            gen_block += f"\nHƯỚNG DẪN AI: {general['notes_for_ai'].strip()}"
        if general.get("forbidden"):
            gen_block += f"\nCẤM: {'; '.join(general['forbidden'])}"
        parts.append(gen_block)

    if not parts:
        return ""

    header = "## CANONICAL ENTITIES (không được contradict — đây là nguồn sự thật):\n"
    return header + "\n\n".join(parts)


def build_tower_context(floor: int) -> str:
    """Build canonical Tower floor context for injection."""
    floor_id_map = {
        1: "tower_floor_1",
        2: "tower_floor_2",
        3: "tower_floor_3",
    }
    location_id = floor_id_map.get(floor)
    if not location_id:
        return ""

    loc = get_location(location_id)
    if not loc:
        return ""

    forbidden = "; ".join(loc.get("forbidden_descriptions", []))
    block = (
        f"## TOWER FLOOR {floor} — CANONICAL:\n"
        f"{loc['description_anchor'].strip()}"
    )
    if forbidden:
        block += f"\nNHỮNG THỨ KHÔNG ĐƯỢC MÔ TẢ: {forbidden}"
    return block
