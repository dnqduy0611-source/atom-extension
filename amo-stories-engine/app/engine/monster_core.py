"""Amoisekai — Monster Core & Crafting Engine.

Drop logic for Monster Cores (Shard, Core, Heart) and Soul Crystals.
Imbue logic for applying cores to weapons.
Crafting logic for creating new weapons from materials.

Ref: WEAPON_SYSTEM_SPEC v1.0 §6.1, §6.3
"""

from __future__ import annotations

import random
import uuid
from typing import Optional

from app.models.weapon import (
    MonsterCore,
    MonsterCoreTier,
    SoulCrystalTier,
    Weapon,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)


# ──────────────────────────────────────────────
# Drop Rate Constants (Spec §6.1)
# ──────────────────────────────────────────────

DROP_RATE_SHARD: float = 0.30       # common monsters
DROP_RATE_CORE: float = 0.10        # elite monsters
DROP_RATE_HEART: float = 0.03       # mini-boss

# monster_tier → (core_tier, drop_rate)
MONSTER_DROP_TABLE: dict[str, tuple[MonsterCoreTier, float]] = {
    "common": (MonsterCoreTier.shard, DROP_RATE_SHARD),
    "elite": (MonsterCoreTier.core, DROP_RATE_CORE),
    "mini_boss": (MonsterCoreTier.heart, DROP_RATE_HEART),
}

# Material tier → max craftable weapon grade (Spec §6.3)
MATERIAL_GRADE_MAP: dict[str, WeaponGrade] = {
    "common": WeaponGrade.mundane,
    "uncommon": WeaponGrade.resonant,
    "rare": WeaponGrade.resonant,       # high resonance, but still Resonant in Phase 1
    "masterwork": WeaponGrade.awakened,  # Phase 2 only — capped at resonant in Phase 1
}

# Phase 1 cap for crafting
PHASE1_MAX_CRAFT_GRADE: WeaponGrade = WeaponGrade.resonant


# ──────────────────────────────────────────────
# Core Drop Functions
# ──────────────────────────────────────────────

def roll_core_drop(
    monster_tier: str,
    monster_principle: str = "",
    monster_name: str = "",
    chapter: int = 0,
    crng_roll: float | None = None,
) -> MonsterCore | None:
    """Roll for a Monster Core drop after defeating a monster.

    Args:
        monster_tier: "common" | "elite" | "mini_boss"
        monster_principle: Principle energy of the monster
        monster_name: Monster's name for lore tracking
        chapter: Current chapter number
        crng_roll: Override random roll (0.0-1.0) for testing. None = random.

    Returns:
        MonsterCore if drop succeeds, None otherwise.
    """
    entry = MONSTER_DROP_TABLE.get(monster_tier)
    if entry is None:
        return None

    core_tier, drop_rate = entry
    roll = crng_roll if crng_roll is not None else random.random()

    if roll > drop_rate:
        return None     # No drop

    return MonsterCore(
        tier=core_tier,
        principle=monster_principle,
        source_monster=monster_name,
        source_chapter=chapter,
    )


def roll_soul_crystal(
    crng_favorable: bool,
    coherence: float,
    weapon_equipped: bool = True,
) -> SoulCrystalTier | None:
    """Roll for Soul Crystal tier after boss kill. Spec §6.1.

    Soul Crystals only drop from boss kills with weapon equipped.
    Tier upgrades:
    - Base: Pale Crystal (always if weapon equipped)
    - CRNG favorable: Pale → True Crystal
    - CRNG favorable + coherence ≥ 75: True → Sovereign Crystal

    Args:
        crng_favorable: Whether CRNG "favorable" trigger fired
        coherence: Player's identity coherence at time of kill
        weapon_equipped: Whether player has a weapon equipped

    Returns:
        SoulCrystalTier or None if no crystal drops.
    """
    if not weapon_equipped:
        return None

    # Base: always Pale
    tier = SoulCrystalTier.pale

    # Upgrade: CRNG favorable → True Crystal
    if crng_favorable:
        tier = SoulCrystalTier.true_crystal

        # Further upgrade: coherence ≥ 75 → Sovereign
        if coherence >= 75.0:
            tier = SoulCrystalTier.sovereign

    return tier


# ──────────────────────────────────────────────
# Imbue Functions
# ──────────────────────────────────────────────

def can_imbue(weapon: Weapon, core: MonsterCore) -> tuple[bool, str]:
    """Validate whether a core can be imbued into a weapon.

    Constraints (Spec §6.1):
    - Only Mundane or Resonant weapons can be imbued
    - Inheritance weapons cannot be imbued ("The blade refuses foreign essence")
    - Heart/Soul Crystal overrides Shards, but not each other
    - Each weapon can only have 1 Heart/Core imbued at a time

    Returns:
        (can_imbue: bool, reason: str)
    """
    # Grade check: only ≤ Resonant
    if weapon.grade not in (WeaponGrade.mundane, WeaponGrade.resonant):
        return False, "Chỉ có thể imbue vào weapon Mundane hoặc Resonant."

    # Origin check: inheritance weapons refuse
    if weapon.lore.origin == WeaponOrigin.inheritance:
        return False, "Vũ khí thừa kế từ chối tinh chất ngoại lai."

    # Already imbued with Heart or Core — cannot stack
    if weapon.imbued_core is not None and weapon.imbued_core.tier in (
        MonsterCoreTier.core, MonsterCoreTier.heart,
    ):
        if core.tier == MonsterCoreTier.shard:
            # Shards can still accumulate even with Core/Heart
            return True, ""
        return False, "Weapon đã imbue Core/Heart. Không thể ghi đè."

    return True, ""


def apply_imbue(weapon: Weapon, core: MonsterCore) -> dict:
    """Apply a Monster Core imbue to a weapon.

    Effects by tier (Spec §6.1):
    - Shard: shard_count += 1 (additive resonance)
    - Core: set imbued_core, +25% resonance + minor lore fragment
    - Heart: set imbued_core, unlock secondary_principle

    Returns:
        dict with: {"success": bool, "effect": str, "lore_fragment": str}
    """
    valid, reason = can_imbue(weapon, core)
    if not valid:
        return {"success": False, "effect": reason, "lore_fragment": ""}

    if core.tier == MonsterCoreTier.shard:
        weapon.shard_count += 1
        # NOTE [DEFERRED M1]: shard_count is tracked here but the +10% resonance
        # boost is not yet wired into ResonanceState or combat formula.
        # Will be integrated when pipeline calls apply_imbue() and feeds
        # shard_count into ResonanceState updates. See Phase 1B audit.
        # Set principle if weapon has none (Mundane → gains principle alignment)
        if not weapon.primary_principle and core.principle:
            weapon.primary_principle = core.principle
            # Mundane with principle → upgrade to Resonant
            if weapon.grade == WeaponGrade.mundane:
                weapon.grade = WeaponGrade.resonant
        return {
            "success": True,
            "effect": f"Shard imbued (+{weapon.shard_count} total). +10% resonance.",
            "lore_fragment": "",
        }

    elif core.tier == MonsterCoreTier.core:
        weapon.imbued_core = core
        # Set/strengthen principle
        if not weapon.primary_principle and core.principle:
            weapon.primary_principle = core.principle
            if weapon.grade == WeaponGrade.mundane:
                weapon.grade = WeaponGrade.resonant
        lore_frag = f"Năng lượng {core.principle} từ {core.source_monster} thấm vào vũ khí."
        if not weapon.lore.key_event:
            weapon.lore.key_event = lore_frag
        return {
            "success": True,
            "effect": f"Core imbued — {core.principle} resonance +25%.",
            "lore_fragment": lore_frag,
        }

    elif core.tier == MonsterCoreTier.heart:
        # Heart overrides Shards (spec §6.1: "Heart và Soul Crystal ghi đè Shards")
        weapon.shard_count = 0
        weapon.imbued_core = core
        # Heart unlocks secondary principle
        if core.principle and not weapon.secondary_principle:
            weapon.secondary_principle = core.principle
        elif core.principle and weapon.secondary_principle:
            # Already has secondary — Heart overrides
            weapon.secondary_principle = core.principle
        # Ensure at least Resonant
        if weapon.grade == WeaponGrade.mundane:
            weapon.primary_principle = weapon.primary_principle or core.principle
            weapon.grade = WeaponGrade.resonant
        lore_frag = (
            f"Trái tim của {core.source_monster} hòa nhập vào vũ khí. "
            f"Nguyên lý {core.principle} thức tỉnh bên trong."
        )
        weapon.lore.key_event = lore_frag
        return {
            "success": True,
            "effect": f"Heart imbued — secondary principle [{core.principle}] unlocked.",
            "lore_fragment": lore_frag,
        }

    return {"success": False, "effect": "Unknown core tier.", "lore_fragment": ""}


def build_soul_crystal_imbue_context(
    weapon: Weapon,
    tier: SoulCrystalTier,
    monster_name: str,
    monster_principle: str = "",
) -> dict:
    """Build context dict for AI lore expansion when imbuing a Soul Crystal.

    Soul Crystals are used on Soul-Linked weapons for Signature Move evolution,
    or on ≤Resonant weapons for principle reroll + lore.

    Returns context for the crafting_lore prompt.
    """
    return {
        "crystal_tier": tier.value,
        "weapon_name": weapon.name,
        "weapon_grade": weapon.grade.value,
        "weapon_current_principle": weapon.primary_principle,
        "monster_source": monster_name,
        "monster_principle": monster_principle,
        "existing_lore": weapon.lore.history_summary,
        "lore_depth": {
            "pale": "1-2 câu ngắn",
            "true_crystal": "1 đoạn văn đầy đủ",
            "sovereign": "Full lore chapter reveal",
        }.get(tier.value, "1-2 câu"),
    }


# ──────────────────────────────────────────────
# Crafting Functions (Spec §6.3)
# ──────────────────────────────────────────────

def get_max_craft_grade(material_tier: str, phase: int = 1) -> WeaponGrade:
    """Get the maximum weapon grade achievable from a material tier.

    Phase 1: capped at Resonant regardless of material.
    Phase 2+: Masterwork materials can reach Awakened.
    """
    grade = MATERIAL_GRADE_MAP.get(material_tier, WeaponGrade.mundane)

    # Phase 1 cap
    if phase <= 1:
        grade_order = list(WeaponGrade)
        phase1_idx = grade_order.index(PHASE1_MAX_CRAFT_GRADE)
        grade_idx = grade_order.index(grade)
        if grade_idx > phase1_idx:
            grade = PHASE1_MAX_CRAFT_GRADE

    return grade


def create_crafted_weapon(
    weapon_type: str,
    principle: str,
    material_tier: str,
    player_archetype: str = "",
    craftsman_name: str = "Thợ Rèn",
    crafting_intent: str = "",
    weapon_name: str = "",
    phase: int = 1,
) -> tuple[Weapon, dict]:
    """Create a new crafted weapon from materials.

    Args:
        phase: Game phase (1 = cap Resonant, 2+ = Masterwork → Awakened)

    Returns:
        (weapon, lore_context) — weapon with base fields set,
        lore_context dict for AI lore generation call.
    """
    grade = get_max_craft_grade(material_tier, phase=phase)

    # Generate a default name if not provided
    if not weapon_name:
        weapon_name = f"Vũ Khí Rèn ({weapon_type})"

    weapon = Weapon(
        id=f"crafted_{weapon_type}_{principle}_{uuid.uuid4().hex[:8]}",
        name=weapon_name,
        weapon_type=weapon_type,
        grade=grade,
        primary_principle=principle if grade != WeaponGrade.mundane else "",
        lore=WeaponLore(
            origin=WeaponOrigin.crafting,
            history_summary="",  # To be filled by AI lore gen
        ),
    )

    # Context for AI lore generation
    lore_context = {
        "weapon_type": weapon_type,
        "primary_principle": principle,
        "material_tier": material_tier,
        "craftsman_name": craftsman_name,
        "player_archetype": player_archetype,
        "crafting_intent": crafting_intent,
        "weapon_grade": grade.value,
    }

    return weapon, lore_context
