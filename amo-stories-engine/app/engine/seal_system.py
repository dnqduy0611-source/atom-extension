"""Amoisekai — Seal System Engine.

Handles seal creation, validation, expiration, and Anti-Unique Field effects.

Design Rules (from CONTROL_SYSTEM v1 §II.2-3):
- Seals are TEMPORARY — max 3-5 combat phases or 1 narrative scene.
- Each seal type has specific requirements (cost, conditions).
- Anti-Unique Fields are EXTREMELY RARE and location-based.
- Seals use suppression_type="seal" (1.5x) or "field" (2.0x).

Ref: UNIQUE SKILL CONTROL SYSTEM v1 §II.2-3
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models.seal import SealState, SealType
from app.engine.suppression_check import (
    SuppressionLevel,
    SuppressionResult,
    check_suppression,
)

if TYPE_CHECKING:
    from app.models.player import PlayerState

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# SEAL REQUIREMENTS
# ══════════════════════════════════════════════

RITUAL_STABILITY_COST = 30.0       # Stability consumed to perform ritual
FACTION_MIN_RANK = 3               # Minimum rank for faction seal tech

# Duration by seal type (phases, scenes)
SEAL_DURATION: dict[str, tuple[int, int]] = {
    "ritual": (3, 1),        # 3 phases or 1 scene
    "zone": (5, 1),          # 5 phases or 1 scene (zone-based = stronger)
    "contract": (5, 1),      # 5 phases or 1 scene (mutual agreement = long)
    "faction": (3, 1),       # 3 phases or 1 scene
    "field": (0, 0),         # Anti-Unique Field: no duration limit (zone-based)
}


# ══════════════════════════════════════════════
# VALIDATE SEAL REQUIREMENTS
# ══════════════════════════════════════════════

def validate_seal_requirements(
    seal_type: str,
    player: PlayerState | None = None,
    in_combat: bool = False,
    mutual_consent: bool = False,
    faction_rank: int = 0,
    zone_has_seal_property: bool = False,
) -> tuple[bool, str]:
    """Validate whether a seal can be created.

    Args:
        seal_type: SealType value string
        player: Player attempting the seal (for ritual cost check)
        in_combat: Whether currently in combat
        mutual_consent: Whether both parties agree (for contract)
        faction_rank: Player's faction rank
        zone_has_seal_property: Whether current zone has seal property

    Returns:
        (valid: bool, reason: str)
    """
    if seal_type == "ritual":
        if in_combat:
            return False, "Ritual seal cannot be used during combat"
        if player and player.stability < RITUAL_STABILITY_COST:
            return False, f"Not enough stability ({player.stability:.0f} < {RITUAL_STABILITY_COST})"
        return True, "Ritual seal requirements met"

    if seal_type == "zone":
        if not zone_has_seal_property:
            return False, "Current zone does not have seal property"
        return True, "Zone seal active"

    if seal_type == "contract":
        if not mutual_consent:
            return False, "Contract seal requires mutual consent from both parties"
        return True, "Contract seal agreed"

    if seal_type == "faction":
        if faction_rank < FACTION_MIN_RANK:
            return False, f"Faction rank too low ({faction_rank} < {FACTION_MIN_RANK})"
        return True, "Faction seal tech available"

    if seal_type == "field":
        if not zone_has_seal_property:
            return False, "No Anti-Unique Field in this location"
        return True, "Anti-Unique Field active"

    return False, f"Unknown seal type: {seal_type}"


# ══════════════════════════════════════════════
# APPLY SEAL
# ══════════════════════════════════════════════

def apply_seal(
    player: PlayerState,
    seal_type: str,
    source: str = "",
    source_description: str = "",
    suppression_power: float = 70.0,
) -> dict:
    """Apply a seal to the player's unique skill.

    Creates the SealState, pays costs, and runs suppression check.

    Args:
        player: Player to seal
        seal_type: SealType value
        source: Who/what created the seal
        source_description: For Writer context
        suppression_power: Raw power of the seal source

    Returns:
        Result dict with success, seal state, and suppression result.
    """
    skill = player.unique_skill
    if not skill:
        return {"success": False, "reason": "Player has no unique skill"}

    # ── Pay costs ──
    if seal_type == "ritual":
        player.stability = max(0.0, player.stability - RITUAL_STABILITY_COST)

    # ── Run suppression check ──
    supp_type = "field" if seal_type == "field" else "seal"
    result = check_suppression(
        suppression_power=suppression_power,
        suppression_type=supp_type,
        target_resistance=skill.suppression_resistance,
        target_category=skill.category,
    )

    # Seal must achieve at least SEALED level to take effect
    if result.level in (SuppressionLevel.NONE, SuppressionLevel.SUPPRESSED):
        return {
            "success": False,
            "reason": f"Seal failed: only achieved {result.level.value}",
            "suppression_result": result.model_dump(),
        }

    # ── Create seal state ──
    phases, scenes = SEAL_DURATION.get(seal_type, (3, 1))
    is_field = seal_type == "field"

    seal = SealState(
        active=True,
        seal_type=SealType(seal_type),
        source=source,
        source_description=source_description,
        remaining_phases=phases,
        remaining_scenes=scenes,
        max_phases=phases,
        suppression_power=suppression_power,
        is_anti_unique_field=is_field,
        sub_skill_modifier=0.0 if is_field else 0.3,  # Field = everything off
        domain_passive_off=True,
    )
    player.active_seal = seal

    logger.info(
        f"Seal applied: type={seal_type}, source={source}, "
        f"duration={phases}p/{scenes}s, level={result.level.value}"
    )

    return {
        "success": True,
        "seal_type": seal_type,
        "duration_phases": phases,
        "duration_scenes": scenes,
        "suppression_level": result.level.value,
        "narrative_instruction": result.narrative_instruction,
        "is_anti_unique_field": is_field,
    }


# ══════════════════════════════════════════════
# TICK / EXPIRE
# ══════════════════════════════════════════════

def tick_seal_phase(player: PlayerState) -> dict | None:
    """Consume one combat phase from active seal.

    Called after each combat phase in the combat engine.

    Returns:
        None if no seal, or dict with expiry info.
    """
    seal = player.active_seal
    if not seal or not seal.active:
        return None

    expired = seal.tick_phase()
    if expired:
        logger.info(f"Seal expired after combat phase: {seal.source}")
        return {
            "seal_expired": True,
            "source": seal.source,
            "narrative": (
                "Phong ấn tan biến — sức mạnh Unique Skill đang hồi phục. "
                "Mô tả cảm giác giải phóng, năng lượng chảy lại."
            ),
        }

    return {
        "seal_expired": False,
        "remaining_phases": seal.remaining_phases,
    }


def tick_seal_scene(player: PlayerState) -> dict | None:
    """Consume one narrative scene from active seal.

    Called after each scene in the orchestrator.

    Returns:
        None if no seal, or dict with expiry info.
    """
    seal = player.active_seal
    if not seal or not seal.active:
        return None

    expired = seal.tick_scene()
    if expired:
        logger.info(f"Seal expired after scene: {seal.source}")
        return {
            "seal_expired": True,
            "source": seal.source,
            "narrative": (
                "Phong ấn suy yếu và tan biến. "
                "Unique Skill đang tỉnh dậy — mô tả cảm giác hồi phục."
            ),
        }

    return {
        "seal_expired": False,
        "remaining_scenes": seal.remaining_scenes,
    }


def release_seal(player: PlayerState) -> dict:
    """Manually release a seal (e.g., contract broken, zone exited).

    Returns:
        Summary dict for logging.
    """
    seal = player.active_seal
    if not seal or not seal.active:
        return {"released": False, "reason": "No active seal"}

    source = seal.source
    seal.release()

    logger.info(f"Seal manually released: {source}")
    return {
        "released": True,
        "source": source,
        "narrative": (
            "Phong ấn bị phá vỡ — Unique Skill bùng lên không kiểm soát. "
            "Mô tả sức mạnh thoát ra dữ dội, có thể gây bất ổn."
        ),
    }


# ══════════════════════════════════════════════
# QUERY
# ══════════════════════════════════════════════

def is_sealed(player: PlayerState) -> bool:
    """Check if player currently has an active seal."""
    seal = player.active_seal
    return seal is not None and seal.active and not seal.is_expired()


def is_in_anti_unique_field(player: PlayerState) -> bool:
    """Check if player is in an Anti-Unique Field."""
    seal = player.active_seal
    return (
        seal is not None
        and seal.active
        and seal.is_anti_unique_field
    )


def get_seal_narrative(player: PlayerState) -> str:
    """Get narrative instruction for current seal state."""
    seal = player.active_seal
    if not seal or not seal.active:
        return ""

    if seal.is_anti_unique_field:
        return (
            "TOÀN BỘ Unique Skill bị VÔ HIỆU HÓA trong Anti-Unique Field. "
            "Không có khả năng siêu nhiên nào hoạt động. "
            "Nhưng identity vẫn ảnh hưởng quyết định — mô tả nhân vật "
            "dựa vào bản năng, kinh nghiệm, và ý chí thay vì sức mạnh."
        )

    return (
        f"Core skill bị PHONG ẤN bởi {seal.source}. "
        f"Sub-skills hoạt động yếu ớt ({seal.sub_skill_modifier:.0%}). "
        f"Domain passive TẮT. Còn {seal.remaining_phases} phases / "
        f"{seal.remaining_scenes} scenes."
    )
