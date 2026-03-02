"""Villain Power Store — load static profiles + per-story tracking.

Cung cấp:
  - get_villain_power_profile()   — load VillainPowerProfile từ static JSON seed
  - get_revealed_abilities()      — lấy abilities đã revealed per-story từ WorldState
  - mark_ability_revealed()       — ghi nhận ability mới được reveal
  - increment_encounter_count()   — tăng encounter_count sau mỗi encounter
  - get_power_context_block()     — format context string cho LLM injection

Static seed: app/data/villain_powers.json
Per-story state: WorldState.general_status / emissary_status (GeneralStatus / EmissaryStatus)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Static JSON loader (lazy cache)
# ──────────────────────────────────────────────

_DATA_PATH = Path(__file__).parent.parent / "data" / "villain_powers.json"
_CACHE: dict | None = None


def _load_raw() -> dict:
    """Load villain_powers.json, caching after first load."""
    global _CACHE
    if _CACHE is None:
        try:
            with open(_DATA_PATH, encoding="utf-8") as f:
                _CACHE = json.load(f)
        except FileNotFoundError:
            logger.error(f"VillainPowerStore: {_DATA_PATH} not found — returning empty cache")
            _CACHE = {"emissaries": {}, "generals": {}}
        except Exception as exc:
            logger.error(f"VillainPowerStore: failed to load JSON ({exc}) — returning empty cache")
            _CACHE = {"emissaries": {}, "generals": {}}
    return _CACHE


def _raw_villain(villain_id: str) -> dict | None:
    """Return raw dict for villain_id from cache (emissaries or generals)."""
    data = _load_raw()
    # Try emissaries first, then generals
    raw = data.get("emissaries", {}).get(villain_id)
    if raw is None:
        raw = data.get("generals", {}).get(villain_id)
    return raw


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────


def get_villain_power_profile(villain_id: str):
    """Load VillainPowerProfile từ static seed JSON.

    Returns None nếu villain_id không tồn tại.
    """
    from app.models.villain_power import VillainPowerProfile

    raw = _raw_villain(villain_id)
    if raw is None:
        return None
    try:
        return VillainPowerProfile.model_validate(raw)
    except Exception as exc:
        logger.warning(f"VillainPowerStore: failed to parse profile for {villain_id!r} ({exc})")
        return None


def get_revealed_abilities(ws: "WorldState", villain_id: str) -> list[str]:
    """Lấy danh sách ability names đã được reveal per-story từ WorldState."""
    # Check generals first, then emissaries
    if villain_id in ws.general_status:
        return list(ws.general_status[villain_id].revealed_abilities)
    if villain_id in ws.emissary_status:
        return list(ws.emissary_status[villain_id].revealed_abilities)
    return []


def get_encounter_count(ws: "WorldState", villain_id: str) -> int:
    """Lấy encounter_count per-story từ WorldState."""
    if villain_id in ws.general_status:
        return ws.general_status[villain_id].encounter_count
    if villain_id in ws.emissary_status:
        return ws.emissary_status[villain_id].encounter_count
    return 0


def mark_ability_revealed(ws: "WorldState", villain_id: str, ability_name: str) -> None:
    """Ghi nhận ability mới được reveal trong encounter — idempotent."""
    if villain_id in ws.general_status:
        status = ws.general_status[villain_id]
        if ability_name not in status.revealed_abilities:
            status.revealed_abilities.append(ability_name)
            logger.info(f"VillainPowerStore: general {villain_id!r} revealed ability {ability_name!r}")
        return
    if villain_id in ws.emissary_status:
        status = ws.emissary_status[villain_id]
        if ability_name not in status.revealed_abilities:
            status.revealed_abilities.append(ability_name)
            logger.info(f"VillainPowerStore: emissary {villain_id!r} revealed ability {ability_name!r}")
        return
    logger.warning(f"VillainPowerStore: villain {villain_id!r} not found in WorldState — cannot mark ability")


def increment_encounter_count(ws: "WorldState", villain_id: str) -> int:
    """Tăng encounter_count sau mỗi encounter. Returns new count."""
    if villain_id in ws.general_status:
        ws.general_status[villain_id].encounter_count += 1
        return ws.general_status[villain_id].encounter_count
    if villain_id in ws.emissary_status:
        ws.emissary_status[villain_id].encounter_count += 1
        return ws.emissary_status[villain_id].encounter_count
    logger.warning(f"VillainPowerStore: villain {villain_id!r} not found — cannot increment encounter")
    return 0


def get_power_context_block(ws: "WorldState", villain_id: str) -> str:
    """Build LLM context block cho villain power profile + per-story state.

    Format spec §2.8:
      ## Villain Profile — [Tên] (Tier N, [encounter_style]):
      - Dominant Principle: ...
      - Encounter style: ...
      - Abilities đã revealed:
          * [ability] — [mechanic tóm tắt] | Counter: [counter]
      - Abilities chưa revealed: N abilities còn ẩn
      - Điểm yếu được biết: ...
      - Argument: ...
      ⚠️ Writer: ...

    Returns "" nếu không có profile hoặc villain chưa encountered.
    """
    encounter_count = get_encounter_count(ws, villain_id)
    if encounter_count == 0:
        # Villain chưa từng encounter — không inject power context
        return ""

    profile = get_villain_power_profile(villain_id)
    if profile is None:
        return ""

    revealed = get_revealed_abilities(ws, villain_id)

    parts: list[str] = [
        f"## Villain Profile — {profile.villain_name} "
        f"(Tier {profile.power_tier}, {profile.encounter_style}):"
    ]
    parts.append(f"- Dominant Principle: {profile.dominant_principle}"
                 + (f" / {profile.secondary_principle}" if profile.secondary_principle else ""))
    parts.append(f"- Encounter count: {encounter_count} lần")

    # Abilities đã revealed — compute hidden_count AFTER filter (Bug B fix)
    revealed_abilities = [a for a in profile.abilities if a.name in revealed]
    hidden_count = max(0, len(profile.abilities) - len(revealed_abilities))
    if revealed_abilities:
        parts.append("- Abilities đã revealed với player:")
        for ab in revealed_abilities:
            mechanic_short = ab.mechanic.split(".")[0] if ab.mechanic else ab.description[:60]
            parts.append(f"  * {ab.name} — {mechanic_short} | Counter: {ab.counter}")

    # Số abilities còn ẩn
    if hidden_count > 0:
        parts.append(f"- Abilities chưa revealed: {hidden_count} abilities còn ẩn")

    # Điểm yếu (chỉ hiện nếu player đã encounter đủ lần để có thể phát hiện)
    if profile.weaknesses and encounter_count >= 2:
        parts.append(f"- Điểm yếu được biết: {'; '.join(profile.weaknesses)}")
    elif profile.weaknesses:
        parts.append("- Điểm yếu: chưa đủ encounter để phát hiện")

    # Companion weakness bypass — always show so writer knows the counter condition
    if profile.companion_weakness_bypass:
        parts.append(f"- Companion counter: {profile.companion_weakness_bypass}")

    # Argument của villain
    if profile.argument_to_player:
        parts.append(f"- Argument của villain: \"{profile.argument_to_player}\"")

    # Writer instruction
    style_notes = {
        "direct_combat":        "Villain chiến đấu trực tiếp — viết combat với weight của Tier 3+",
        "psychological":        "Villain dùng tâm lý — mọi dialogue có subtext, không có gì là innocent",
        "proxy":                "Villain không xuất hiện trực tiếp — damage và threat đến từ hướng bất ngờ",
        "revelation":           "Villain reveal sự thật — identity crisis là weapon chính",
        "philosophical_debate": "Villain tranh luận — player phải chứng minh bằng giá trị, không phải logic",
    }
    note = style_notes.get(profile.encounter_style, "")
    if note:
        parts.append(f"⚠️ Writer: {note}")

    return "\n".join(parts)
