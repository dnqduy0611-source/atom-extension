"""Amoisekai — Unique Skill Suppression Check.

Implements external counterplay against Unique Skills.
3-level suppression: SUPPRESSED → SEALED → NULLIFIED.

Design rules:
- Only Unique-tier effects or artifact-level powers can Suppress.
- Normal Skills CANNOT suppress Unique Skills (preserves Domain Authority).
- Category match gives +10 specialization bonus.
- suppression_resistance grows with growth stage (Seed=50 → Ultimate=95).

Ref: UNIQUE SKILL CONTROL SYSTEM v1
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


# ──────────────────────────────────────────────
# Suppression Levels
# ──────────────────────────────────────────────

class SuppressionLevel(str, Enum):
    """3-tier suppression outcome (+ NONE)."""

    NONE = "none"              # Resistance wins — no effect
    SUPPRESSED = "suppressed"  # Partial: effectiveness reduced, cooldown up
    SEALED = "sealed"          # Core skill disabled, some sub-skills may work
    NULLIFIED = "nullified"    # Anti-Unique Field: all unique abilities off


# ──────────────────────────────────────────────
# Type Multipliers
# ──────────────────────────────────────────────

_TYPE_MULTIPLIERS: dict[str, float] = {
    "skill": 1.0,   # Direct unique-vs-unique
    "seal": 1.5,    # Ritual / artifact / zone — stronger
    "field": 2.0,   # Anti-Unique Field — overwhelming
}

# Category specialization bonus when suppression targets same category
_CATEGORY_MATCH_BONUS = 10.0


# ──────────────────────────────────────────────
# Stage → Default Resistance
# ──────────────────────────────────────────────

STAGE_RESISTANCE: dict[str, float] = {
    "seed": 50.0,
    "bloom": 65.0,
    "aspect": 80.0,
    "ultimate": 95.0,
}


# ──────────────────────────────────────────────
# Result Model
# ──────────────────────────────────────────────

class SuppressionResult(BaseModel):
    """Result of a suppression check.

    Consumed by CombatBrief and SceneWriter.
    """

    level: SuppressionLevel = SuppressionLevel.NONE
    effectiveness_modifier: float = 1.0   # 0.0-1.0, applied to unique skill output
    duration_phases: int = 0              # How many combat phases it lasts
    narrative_instruction: str = ""       # Prose guidance for Writer
    reason: str = ""                      # Debug/log info


# ──────────────────────────────────────────────
# Narrative Instructions
# ──────────────────────────────────────────────

_NARRATIVE = {
    SuppressionLevel.NONE: (
        "Unique skill chống cự thành công — sức mạnh bản ngã phủ nhận "
        "sự áp chế. Mô tả skill bùng lên chống lại hiệu ứng."
    ),
    SuppressionLevel.SUPPRESSED: (
        "Unique skill bị áp chế một phần — hiệu quả giảm, "
        "phản ứng chậm hơn, tầm ảnh hưởng thu hẹp. "
        "Mô tả skill hoạt động nhưng bị nhiễu, run rẩy, không ổn định."
    ),
    SuppressionLevel.SEALED: (
        "Core skill bị PHONG ẤN — khả năng chính không kích hoạt được. "
        "Sub-skills khác trait vẫn có thể hoạt động yếu ớt. "
        "Mô tả sức mạnh bị khóa, player cảm nhận sự trống rỗng."
    ),
    SuppressionLevel.NULLIFIED: (
        "TOÀN BỘ Unique Skill bị VÔ HIỆU HÓA trong Anti-Unique Field. "
        "Không có khả năng siêu nhiên nào hoạt động. "
        "Nhưng identity vẫn ảnh hưởng quyết định — mô tả nhân vật "
        "dựa vào bản năng, kinh nghiệm, và ý chí thay vì sức mạnh."
    ),
}


# ──────────────────────────────────────────────
# Main Check Function
# ──────────────────────────────────────────────

def check_suppression(
    suppression_power: float,
    suppression_type: str = "skill",
    target_resistance: float = 50.0,
    target_category: str = "",
    suppression_category: str = "",
) -> SuppressionResult:
    """Check if an external suppression effect overcomes a Unique Skill.

    Formula:
        effective_power = suppression_power × type_multiplier
        if same category: effective_power += 10 (specialization)
        gap = effective_power - target_resistance

        gap < 0  → NONE (resistance wins)
        0 ≤ gap < 30 → SUPPRESSED (partial)
        30 ≤ gap < 60 → SEALED (core disabled)
        gap ≥ 60 → NULLIFIED (everything off)

    Args:
        suppression_power: Raw strength of suppression source (0-100).
        suppression_type: Source type — "skill" | "seal" | "field".
        target_resistance: UniqueSkill.suppression_resistance (0-100).
        target_category: UniqueSkill.category (manifestation, perception, etc.).
        suppression_category: Category the suppression targets ("" = universal).

    Returns:
        SuppressionResult with level, modifier, duration, and narrative.
    """
    # ── Calculate effective power ──
    multiplier = _TYPE_MULTIPLIERS.get(suppression_type, 1.0)
    effective_power = suppression_power * multiplier

    # Category specialization bonus
    category_match = (
        target_category
        and suppression_category
        and target_category == suppression_category
    )
    if category_match:
        effective_power += _CATEGORY_MATCH_BONUS

    # ── Gap calculation ──
    gap = effective_power - target_resistance

    # ── Determine level ──
    if gap < 0:
        return SuppressionResult(
            level=SuppressionLevel.NONE,
            effectiveness_modifier=1.0,
            duration_phases=0,
            narrative_instruction=_NARRATIVE[SuppressionLevel.NONE],
            reason=f"Resisted: gap={gap:.1f} (power={effective_power:.1f} vs resist={target_resistance:.1f})",
        )

    if gap < 30:
        # Partial suppression — effectiveness scales with gap
        modifier = max(0.2, 1.0 - gap / 100.0)
        duration = 2 if gap < 15 else 3
        instruction = (
            f"Skill bị áp chế (hiệu quả {modifier:.0%}). "
            + _NARRATIVE[SuppressionLevel.SUPPRESSED]
        )
        return SuppressionResult(
            level=SuppressionLevel.SUPPRESSED,
            effectiveness_modifier=modifier,
            duration_phases=duration,
            narrative_instruction=instruction,
            reason=f"Suppressed: gap={gap:.1f}, modifier={modifier:.2f}",
        )

    if gap < 60:
        duration = 3 if gap < 45 else 5
        return SuppressionResult(
            level=SuppressionLevel.SEALED,
            effectiveness_modifier=0.0,
            duration_phases=duration,
            narrative_instruction=_NARRATIVE[SuppressionLevel.SEALED],
            reason=f"Sealed: gap={gap:.1f}",
        )

    # Nullified — Anti-Unique Field level
    return SuppressionResult(
        level=SuppressionLevel.NULLIFIED,
        effectiveness_modifier=0.0,
        duration_phases=0,  # Lasts as long as field is active — no fixed duration
        narrative_instruction=_NARRATIVE[SuppressionLevel.NULLIFIED],
        reason=f"Nullified: gap={gap:.1f}",
    )


def get_stage_resistance(stage: str) -> float:
    """Get default suppression_resistance for a growth stage.

    Used when initializing or upgrading skills.

    Args:
        stage: Growth stage — "seed" | "bloom" | "aspect" | "ultimate".

    Returns:
        Default resistance value for that stage.
    """
    return STAGE_RESISTANCE.get(stage, 50.0)


# ──────────────────────────────────────────────
# Weakness Exploit Bonuses
# ──────────────────────────────────────────────

_WEAKNESS_BLIND_SPOT_BONUS = 15.0   # Suppression hits axis_blind_spot
_WEAKNESS_TYPE_BONUS = 10.0         # Suppression matches weakness_type
_WEAKNESS_BONUS_CAP = 25.0          # Max combined weakness bonus


# ──────────────────────────────────────────────
# Enemy Suppression Check (Combat Wrapper)
# ──────────────────────────────────────────────

def check_suppression_from_enemy(
    player_skill_category: str,
    player_resistance: float,
    player_weakness_type: str = "",
    player_axis_blind_spot: str = "",
    enemy_has_unique: bool = False,
    enemy_unique_category: str = "",
    enemy_suppression_power: float = 0.0,
    enemy_suppression_type: str = "skill",
) -> SuppressionResult:
    """High-level suppression check for combat encounters.

    Extracts relevant data and enforces Domain Authority:
    - Normal Skills CANNOT suppress Unique Skills.
    - Only enemies with Unique Skills or artifact-level powers can suppress.

    Also applies weakness exploit bonuses from CONTROL_SYSTEM §III.b:
    - +15 if suppression hits target's axis_blind_spot
    - +10 if suppression matches target's weakness_type
    - Combined cap: +25

    Args:
        player_skill_category: Player's unique skill category
        player_resistance: Player's UniqueSkill.suppression_resistance
        player_weakness_type: Player's UniqueSkill.weakness_type
        player_axis_blind_spot: Player's UniqueSkill.axis_blind_spot
        enemy_has_unique: Whether enemy has a unique-tier ability
        enemy_unique_category: Enemy's unique skill category
        enemy_suppression_power: Raw suppression power (0-100)
        enemy_suppression_type: "skill" | "seal" | "field"

    Returns:
        SuppressionResult — NONE if enemy can't suppress.
    """
    # ── Domain Authority: only unique-tier can suppress ──
    if not enemy_has_unique and enemy_suppression_type == "skill":
        return SuppressionResult(
            level=SuppressionLevel.NONE,
            effectiveness_modifier=1.0,
            narrative_instruction="",
            reason="Domain immunity: enemy has no unique-tier ability",
        )

    if enemy_suppression_power <= 0:
        return SuppressionResult(
            level=SuppressionLevel.NONE,
            effectiveness_modifier=1.0,
            narrative_instruction="",
            reason="No suppression power",
        )

    # ── Weakness exploit bonus ──
    weakness_bonus = 0.0
    if (player_axis_blind_spot
            and enemy_unique_category
            and player_axis_blind_spot.lower() == enemy_unique_category.lower()):
        weakness_bonus += _WEAKNESS_BLIND_SPOT_BONUS

    if (player_weakness_type
            and enemy_unique_category
            and _weakness_type_matches(player_weakness_type, enemy_unique_category)):
        weakness_bonus += _WEAKNESS_TYPE_BONUS

    weakness_bonus = min(_WEAKNESS_BONUS_CAP, weakness_bonus)

    # ── Run core check with boosted power ──
    effective_power = enemy_suppression_power + weakness_bonus
    return check_suppression(
        suppression_power=effective_power,
        suppression_type=enemy_suppression_type,
        target_resistance=player_resistance,
        target_category=player_skill_category,
        suppression_category=enemy_unique_category,
    )


def _weakness_type_matches(weakness_type: str, enemy_category: str) -> bool:
    """Check if enemy's suppression category exploits the target weakness type.

    Simple heuristic: certain weakness types are vulnerable to certain categories.
    """
    _EXPLOIT_MAP: dict[str, list[str]] = {
        "sensory_tax": ["manifestation", "perception"],
        "resonance_dependency": ["obfuscation", "manipulation"],
        "environment_lock": ["manifestation", "contract"],
        "escalation_curse": ["perception", "manipulation"],
        "target_paradox": ["contract", "obfuscation"],
        "soul_echo": ["perception"],
        "principle_bleed": ["manifestation"],
    }
    vulnerable_to = _EXPLOIT_MAP.get(weakness_type, [])
    return enemy_category.lower() in vulnerable_to
