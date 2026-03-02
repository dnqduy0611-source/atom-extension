"""Amoisekai — Signature Move Evolution Engine.

Pure logic for Signature Move v2→v3 evolution.
Condition checks, state transitions, crystal consumption, resonance burst.

Ref: WEAPON_SYSTEM_SPEC v1.0 §7
"""

from __future__ import annotations

from app.models.weapon import SignatureMove, Weapon, WeaponGrade


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

EVOLUTION_V2_BOND_THRESHOLD: float = 101.0
RESONANCE_BURST_BONUS: float = 0.03     # v3 + Unique Skill same chapter

# Valid Unique Skill stages for v3 prereq (Aspect or higher)
V3_SKILL_STAGES: set[str] = {"aspect", "manifestation", "transcendence"}

# Crystal requirements per evolution tier
CRYSTAL_REQUIREMENT: dict[int, set[str]] = {
    2: {"true_crystal", "sovereign"},       # v2: True Crystal OR Sovereign
    3: {"sovereign"},                        # v3: Sovereign only
}

# Mechanical values per tier (spec §7)
TIER_MECHANICAL_VALUES: dict[int, float] = {
    1: 0.05,
    2: 0.07,
    3: 0.10,
}


# ──────────────────────────────────────────────
# Condition Checkers
# ──────────────────────────────────────────────

def can_evolve_v2(
    weapon: Weapon,
    has_soul_choice_this_chapter: bool = False,
) -> tuple[bool, str]:
    """Check if Signature Move can evolve to v2.

    Requirements (spec §7):
    - Weapon is Awakened+
    - Signature Move v1 exists
    - Bond Score ≥ 101
    - True Crystal or Sovereign Crystal available in weapon inventory
    - soul_choice action in this chapter

    Returns: (can_evolve, reason_if_not)
    """
    if weapon.grade not in (WeaponGrade.awakened, WeaponGrade.archon_fragment):
        return False, "weapon_not_awakened"

    if weapon.signature_move is None:
        return False, "no_signature_move"

    if weapon.signature_move.evolution_tier != 1:
        return False, f"wrong_tier_{weapon.signature_move.evolution_tier}"

    if weapon.bond_score < EVOLUTION_V2_BOND_THRESHOLD:
        return False, f"bond_too_low_{weapon.bond_score}"

    # Check crystal inventory
    has_crystal = any(
        c in CRYSTAL_REQUIREMENT[2] for c in weapon.soul_crystals
    )
    if not has_crystal:
        return False, "no_crystal"

    if not has_soul_choice_this_chapter:
        return False, "no_soul_choice"

    return True, "ok"


def can_evolve_v3(
    weapon: Weapon,
    unique_skill_stage: str = "",
) -> tuple[bool, str]:
    """Check if Signature Move can evolve to v3.

    Requirements (spec §7):
    - Signature Move v2 exists
    - Unique Skill ≥ Aspect stage
    - Sovereign Crystal available
    - Weapon participated in ≥1 Climax encounter

    Returns: (can_evolve, reason_if_not)
    """
    if weapon.signature_move is None:
        return False, "no_signature_move"

    if weapon.signature_move.evolution_tier != 2:
        return False, f"wrong_tier_{weapon.signature_move.evolution_tier}"

    if unique_skill_stage not in V3_SKILL_STAGES:
        return False, f"skill_stage_too_low_{unique_skill_stage}"

    has_sovereign = "sovereign" in weapon.soul_crystals
    if not has_sovereign:
        return False, "no_sovereign_crystal"

    if weapon.climax_encounter_count < 1:
        return False, "no_climax_encounter"

    return True, "ok"


# ──────────────────────────────────────────────
# Crystal Consumption
# ──────────────────────────────────────────────

def consume_crystal(
    weapon: Weapon,
    required_tiers: set[str],
) -> str | None:
    """Consume best available crystal from weapon inventory.

    Prefers higher tier (sovereign > true_crystal).
    Returns consumed crystal tier or None if not available.
    """
    # Prefer sovereign first
    for tier in ["sovereign", "true_crystal", "pale"]:
        if tier in required_tiers and tier in weapon.soul_crystals:
            weapon.soul_crystals.remove(tier)
            return tier
    return None


# ──────────────────────────────────────────────
# State Transitions
# ──────────────────────────────────────────────

def apply_evolution_v2(
    weapon: Weapon,
) -> Weapon:
    """Evolve Signature Move from v1 → v2.

    Consumes crystal, bumps tier, preserves v1 context.
    Caller must verify can_evolve_v2() first.
    """
    if weapon.signature_move is None or weapon.signature_move.evolution_tier != 1:
        return weapon

    # Consume crystal
    consumed = consume_crystal(weapon, CRYSTAL_REQUIREMENT[2])
    if consumed is None:
        return weapon

    move = weapon.signature_move

    # Preserve v1 context (already set from v1 creation)
    # v1_name and v1_description are kept from original

    # Bump tier + mechanical value
    move.evolution_tier = 2
    move.mechanical_value = TIER_MECHANICAL_VALUES[2]

    return weapon


def apply_evolution_v3(
    weapon: Weapon,
    unique_skill_name: str = "",
) -> Weapon:
    """Evolve Signature Move from v2 → v3.

    Consumes Sovereign Crystal, bumps tier, preserves v1+v2 context.
    Adds secondary_effect for weapon-skill synergy.
    Caller must verify can_evolve_v3() first.
    """
    if weapon.signature_move is None or weapon.signature_move.evolution_tier != 2:
        return weapon

    # Consume Sovereign Crystal
    consumed = consume_crystal(weapon, CRYSTAL_REQUIREMENT[3])
    if consumed is None:
        return weapon

    move = weapon.signature_move

    # Preserve v2 context for AI chaining
    move.v2_name = move.name
    move.v2_description = move.description

    # Bump tier + mechanical value
    move.evolution_tier = 3
    move.mechanical_value = TIER_MECHANICAL_VALUES[3]

    # Mark secondary effect (v3: synergy with Unique Skill)
    if unique_skill_name:
        move.secondary_effect = f"Synergy with {unique_skill_name}"

    return weapon


# ──────────────────────────────────────────────
# Resonance Burst (v3 exclusive)
# ──────────────────────────────────────────────

def check_resonance_burst(
    weapon: Weapon,
    unique_skill_used_this_chapter: bool = False,
) -> float:
    """Check if principle_resonance_burst applies.

    +0.03 flat combat bonus when:
    - Signature Move is v3
    - Unique Skill was invoked in the same chapter

    Spec §7: "nếu invoke cùng chapter với Unique Skill → cộng thêm +0.03"
    """
    if weapon.signature_move is None:
        return 0.0

    if weapon.signature_move.evolution_tier < 3:
        return 0.0

    if not unique_skill_used_this_chapter:
        return 0.0

    return RESONANCE_BURST_BONUS
