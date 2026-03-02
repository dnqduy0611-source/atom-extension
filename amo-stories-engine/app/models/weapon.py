"""Amoisekai — Weapon System models.

Weapons are external legacies — distinct from Unique Skills (internal identity).
Grade 1-5, principle-based, bond system, soul-link covenant.

Ref: WEAPON_SYSTEM_SPEC v1.0 (audited 2026-02-28)
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class WeaponGrade(str, Enum):
    """5 weapon grades, mundane → archon_fragment."""
    mundane = "mundane"
    resonant = "resonant"
    soul_linked = "soul_linked"
    awakened = "awakened"
    archon_fragment = "archon_fragment"


class WeaponOrigin(str, Enum):
    """How the weapon came to exist."""
    monster_core = "monster_core"
    inheritance = "inheritance"
    crafting = "crafting"
    archon = "archon"


class SoulCrystalTier(str, Enum):
    """3 tiers of Soul Crystal rarity."""
    pale = "pale"                   # base — principle reroll + short lore
    true_crystal = "true_crystal"   # CRNG-boosted — reroll + full lore + minor passive
    sovereign = "sovereign"         # coherence ≥ 75 — reroll + passive + Awakened shortcut


class MonsterCoreTier(str, Enum):
    """3 tiers of Monster Core drops. Spec §6.1."""
    shard = "shard"                 # common monster — +10% resonance
    core = "core"                   # elite monster  — +25% resonance + lore fragment
    heart = "heart"                 # mini-boss      — unlock secondary principle


# ──────────────────────────────────────────────
# Sub-models
# ──────────────────────────────────────────────

class SignatureMove(BaseModel):
    """AI-generated weapon move that evolves v1 → v2 → v3."""
    evolution_tier: int = 1         # 1 | 2 | 3
    name: str = ""
    description: str = ""
    mechanical_effect: str = ""     # "stability_burst" | "damage_amplify" | etc.
    mechanical_value: float = 0.05  # tier 1: 0.05, tier 2: 0.07, tier 3: 0.10
    secondary_effect: str = ""      # tier 3 only: synergy with Unique Skill
    narrative_note: str = ""
    activation_cue: str = ""
    # v1/v2 preserved for AI context when evolving
    v1_name: str = ""
    v1_description: str = ""
    v2_name: str = ""
    v2_description: str = ""


class WeaponLore(BaseModel):
    """Weapon's narrative history and origin context."""
    origin: WeaponOrigin = WeaponOrigin.crafting
    history_summary: str = ""
    key_event: str = ""
    lore_fragments_revealed: int = 0    # for Archon-Fragment progressive reveal


class WeaponBondEvent(BaseModel):
    """Recorded bond moment for Soul-Link scene generation."""
    chapter: int = 0
    event_type: str = ""            # "near_death" | "soul_choice" | "combat_turning_point" | etc.
    description: str = ""
    bond_delta: float = 0.0


class MonsterCore(BaseModel):
    """A dropped monster core, used to imbue weapons. Spec §6.1."""
    tier: MonsterCoreTier = MonsterCoreTier.shard
    principle: str = ""             # principle energy stored in this core
    source_monster: str = ""        # monster name that dropped this core
    source_chapter: int = 0


class CraftingMaterial(BaseModel):
    """Material for weapon crafting. Spec §6.3."""
    name: str = ""
    tier: str = "common"            # "common" | "uncommon" | "rare" | "masterwork"
    principle_affinity: str = ""    # optional principle alignment


# ──────────────────────────────────────────────
# Main Weapon Model
# ──────────────────────────────────────────────

class Weapon(BaseModel):
    """A single weapon instance in the game world."""
    id: str = ""
    name: str = ""
    weapon_type: str = ""               # "sword" | "axe" | "bow" | etc.
    grade: WeaponGrade = WeaponGrade.mundane
    primary_principle: str = ""
    secondary_principle: str = ""
    tertiary_principle: str = ""        # Archon-Fragment only
    lore: WeaponLore = Field(default_factory=WeaponLore)
    bond_score: float = 0.0             # 0-100 pre-Awakened, 0-150 post-Awakened
    soul_linked: bool = False
    dormant: bool = False
    signature_move: Optional[SignatureMove] = None
    awakened_passive: str = ""          # from principle combination table
    is_archon_fragment: bool = False
    archon_source: str = ""             # "aethis" | "vyrel" | etc.
    chapters_used: int = 0              # for Morphic Hunger passive
    bond_events: list[WeaponBondEvent] = Field(default_factory=list)
    imbued_core: Optional[MonsterCore] = None    # current imbued core (Heart/Crystal)
    shard_count: int = 0                         # accumulated Shards (additive)
    climax_encounter_count: int = 0              # for Signature Move v3 prereq
    divine_ability_used_season: int = 0          # season number when divine ability was last used (0 = never)
    shard_principle: str = ""                    # principle of accumulated shards (for resonance check)
    soul_crystals: list[str] = Field(
        default_factory=list,
        description="Crystal inventory: ['pale', 'true_crystal', 'sovereign']",
    )

    @property
    def principles(self) -> list[str]:
        """All active principles as a list."""
        result = []
        if self.primary_principle:
            result.append(self.primary_principle)
        if self.secondary_principle:
            result.append(self.secondary_principle)
        if self.tertiary_principle:
            result.append(self.tertiary_principle)
        return result


class PlayerWeaponSlots(BaseModel):
    """Archetype-aware weapon slot configuration."""
    primary: Optional[Weapon] = None
    secondary: Optional[Weapon] = None      # Vanguard: off-hand or dual-wield
    utility: Optional[Weapon] = None        # Wanderer: non-combat utility


# ──────────────────────────────────────────────
# Constants — Combat Integration (Spec §9)
# ──────────────────────────────────────────────

# Grade → flat additive to BuildFit component
WEAPON_GRADE_BONUS: dict[str, float] = {
    "mundane": 0.02,
    "resonant": 0.05,
    "soul_linked": 0.10,
    "awakened": 0.12,
    "archon_fragment": 0.15,
}

# Grade → flat additive to PlayerSkill component
WEAPON_PLAYERSKILL_BONUS: dict[str, float] = {
    "mundane": 0.0,
    "resonant": 0.0,
    "soul_linked": 0.02,       # weapon "reads" player intent
    "awakened": 0.02,
    "archon_fragment": 0.03,
}

# Grade → flat additive to Environment component
WEAPON_ENVIRONMENT_BONUS: dict[str, float] = {
    "mundane": 0.0,
    "resonant": 0.0,
    "soul_linked": 0.0,
    "awakened": 0.0,
    "archon_fragment": 0.03,   # weapon influences battlefield
}

# Weapon-Skill Resonance Synergy (Spec §3)
# weapon principle vs equipped skill principle
WEAPON_SYNERGY_TABLE: dict[str, float] = {
    "identical": 0.03,      # same principle
    "adjacent": 0.02,       # same cluster
    "opposing": 0.0,        # neutral
    "weak": -0.01,          # cross-cluster, non-adjacent
}

# Opposing pairs for weapon-opponent advantage (Spec §9, +0.03)
OPPOSING_PAIRS: set[frozenset[str]] = {
    frozenset({"order", "entropy"}),
    frozenset({"matter", "flux"}),
    frozenset({"energy", "void"}),
}

# Cluster definitions for synergy lookup
CONSTRUCTIVE_CLUSTER: set[str] = {"order", "matter", "energy"}
DECONSTRUCTIVE_CLUSTER: set[str] = {"entropy", "flux", "void"}

# Caps (Spec §9)
WEAPON_BUILDFIT_CAP: float = 0.20           # Max weapon flat additive to BuildFit
WEAPON_TOTAL_EFFECTIVE_CAP: float = 0.10    # Max weapon contribution to final score

# Combat formula weights (mirror from combat.py for cap calc)
_W_BUILD_FIT: float = 0.45
_W_PLAYER_SKILL: float = 0.30
_W_ENVIRONMENT: float = 0.15

# Weapon-opponent principle advantage bonus
WEAPON_OPPONENT_ADVANTAGE: float = 0.03

# Sovereign archetype amplification
SOVEREIGN_AMPLIFICATION: float = 1.30


# ──────────────────────────────────────────────
# Helpers — Combat Contribution
# ──────────────────────────────────────────────

def get_synergy_type(weapon_principle: str, skill_principle: str) -> str:
    """Determine synergy type between weapon and skill principles.

    Returns: "identical" | "adjacent" | "opposing" | "weak"
    """
    if not weapon_principle or not skill_principle:
        return "weak"

    if weapon_principle == skill_principle:
        return "identical"

    # Check opposing pairs
    pair = frozenset({weapon_principle, skill_principle})
    if pair in OPPOSING_PAIRS:
        return "opposing"

    # Check same cluster (adjacent)
    wp_constructive = weapon_principle in CONSTRUCTIVE_CLUSTER
    sp_constructive = skill_principle in CONSTRUCTIVE_CLUSTER
    if wp_constructive == sp_constructive:
        return "adjacent"

    # Cross-cluster, non-opposing
    return "weak"


def check_opponent_advantage(weapon_principle: str, enemy_principle: str) -> bool:
    """Check if weapon principle counters enemy principle (opposing pair)."""
    if not weapon_principle or not enemy_principle:
        return False
    return frozenset({weapon_principle, enemy_principle}) in OPPOSING_PAIRS


def compute_weapon_combat_contribution(
    weapon: Weapon | None,
    skill_principle: str = "",
    enemy_principle: str = "",
    archetype: str = "",
) -> dict:
    """Compute weapon's total combat contribution across all formula components.

    Returns dict with:
        buildfit_bonus: float   — flat additive to BuildFit (pre-weight)
        playerskill_bonus: float — flat additive to PlayerSkill (pre-weight)
        env_bonus: float        — flat additive to Environment (pre-weight)
        synergy_bonus: float    — skill combat bonus from weapon-skill synergy
        effective_total: float  — total effective on final score (post-weight, capped)
    """
    if weapon is None or weapon.dormant:
        return {
            "buildfit_bonus": 0.0,
            "playerskill_bonus": 0.0,
            "env_bonus": 0.0,
            "synergy_bonus": 0.0,
            "effective_total": 0.0,
        }

    grade = weapon.grade.value

    # Base grade bonus
    buildfit = WEAPON_GRADE_BONUS.get(grade, 0.0)

    # Weapon-opponent principle advantage
    if check_opponent_advantage(weapon.primary_principle, enemy_principle):
        buildfit += WEAPON_OPPONENT_ADVANTAGE

    # Cap BuildFit
    buildfit = min(buildfit, WEAPON_BUILDFIT_CAP)

    # PlayerSkill and Environment bonuses
    playerskill = WEAPON_PLAYERSKILL_BONUS.get(grade, 0.0)
    env = WEAPON_ENVIRONMENT_BONUS.get(grade, 0.0)

    # Sovereign amplification (×1.3 on all bonuses)
    if archetype == "sovereign":
        buildfit *= SOVEREIGN_AMPLIFICATION
        playerskill *= SOVEREIGN_AMPLIFICATION
        env *= SOVEREIGN_AMPLIFICATION
        # Re-cap after amplification
        buildfit = min(buildfit, WEAPON_BUILDFIT_CAP)

    # Weapon-Skill synergy bonus (added to BuildFit per spec §3)
    synergy_type = get_synergy_type(weapon.primary_principle, skill_principle)
    synergy_bonus = WEAPON_SYNERGY_TABLE.get(synergy_type, 0.0)
    buildfit += synergy_bonus

    # Re-cap BuildFit after synergy (synergy is part of weapon contribution)
    buildfit = min(buildfit, WEAPON_BUILDFIT_CAP)

    # Effective total (post-weight)
    effective = (
        buildfit * _W_BUILD_FIT
        + playerskill * _W_PLAYER_SKILL
        + env * _W_ENVIRONMENT
    )
    effective = min(effective, WEAPON_TOTAL_EFFECTIVE_CAP)

    return {
        "buildfit_bonus": round(buildfit, 4),
        "playerskill_bonus": round(playerskill, 4),
        "env_bonus": round(env, 4),
        "synergy_bonus": round(synergy_bonus, 4),
        "effective_total": round(effective, 4),
    }


# Vanguard dual-wield discount multipliers (Spec §4)
VANGUARD_PRIMARY_MULTIPLIER: float = 0.70
VANGUARD_SECONDARY_MULTIPLIER: float = 0.50


def compute_vanguard_dual_wield(
    primary: Weapon | None,
    secondary: Weapon | None,
    skill_principle: str = "",
    enemy_principle: str = "",
) -> dict:
    """Compute combined combat contribution for Vanguard dual-wield.

    Spec §4: primary_grade_bonus × 0.70 + secondary_grade_bonus × 0.50.
    Both weapons must be Resonant+. Secondary below Resonant = ignored.

    Synergy, PlayerSkill, and Environment come from primary only.
    BuildFit cap and Total Effective cap still apply on combined result.

    Returns same structure as compute_weapon_combat_contribution().
    """
    # Primary contribution (normal calc, will be discounted)
    if primary is None or primary.dormant:
        return compute_weapon_combat_contribution(None)

    primary_grade = primary.grade.value
    primary_buildfit = WEAPON_GRADE_BONUS.get(primary_grade, 0.0)

    # Weapon-opponent advantage (primary only)
    if check_opponent_advantage(primary.primary_principle, enemy_principle):
        primary_buildfit += WEAPON_OPPONENT_ADVANTAGE

    # Discount primary
    primary_buildfit *= VANGUARD_PRIMARY_MULTIPLIER

    # Secondary contribution (grade bonus only, discounted)
    secondary_buildfit = 0.0
    if (
        secondary is not None
        and not secondary.dormant
        and secondary.grade not in (WeaponGrade.mundane,)
    ):
        secondary_buildfit = WEAPON_GRADE_BONUS.get(secondary.grade.value, 0.0)
        secondary_buildfit *= VANGUARD_SECONDARY_MULTIPLIER

    # Combined BuildFit
    buildfit = primary_buildfit + secondary_buildfit

    # Synergy from primary weapon only
    synergy_type = get_synergy_type(primary.primary_principle, skill_principle)
    synergy_bonus = WEAPON_SYNERGY_TABLE.get(synergy_type, 0.0)
    buildfit += synergy_bonus

    # Cap BuildFit
    buildfit = min(buildfit, WEAPON_BUILDFIT_CAP)

    # PlayerSkill and Environment from primary only
    playerskill = WEAPON_PLAYERSKILL_BONUS.get(primary_grade, 0.0)
    env = WEAPON_ENVIRONMENT_BONUS.get(primary_grade, 0.0)

    # Effective total (post-weight, capped)
    effective = (
        buildfit * _W_BUILD_FIT
        + playerskill * _W_PLAYER_SKILL
        + env * _W_ENVIRONMENT
    )
    effective = min(effective, WEAPON_TOTAL_EFFECTIVE_CAP)

    return {
        "buildfit_bonus": round(buildfit, 4),
        "playerskill_bonus": round(playerskill, 4),
        "env_bonus": round(env, 4),
        "synergy_bonus": round(synergy_bonus, 4),
        "effective_total": round(effective, 4),
    }


def build_weapon_context(weapon: Weapon | None) -> dict:
    """Build weapon_context dict for CombatBrief / Writer integration.

    Returns empty dict if no weapon equipped.
    """
    if weapon is None or weapon.dormant:
        return {}

    ctx: dict = {
        "weapon_name": weapon.name,
        "weapon_grade": weapon.grade.value,
        "weapon_principles": weapon.principles,
        "soul_linked": weapon.soul_linked,
        "signature_available": weapon.signature_move is not None,
        "signature_move_name": weapon.signature_move.name if weapon.signature_move else "",
        "signature_tier": weapon.signature_move.evolution_tier if weapon.signature_move else 0,
        "archon_fragment": weapon.is_archon_fragment,
        "bond_moments_count": len(weapon.bond_events),
        "weapon_lore_summary": weapon.lore.history_summary,
    }

    if weapon.is_archon_fragment:
        ctx["archon_source"] = weapon.archon_source
        ctx["divine_ability_available"] = True  # 1/season

    return ctx


# ──────────────────────────────────────────────
# Pre-written Inheritance Weapons (Phase 1 Data)
# ──────────────────────────────────────────────

INHERITANCE_WEAPONS: dict[str, Weapon] = {
    "vo_hoi_dao": Weapon(
        id="vo_hoi_dao",
        name="Vô Hồi Đao",
        weapon_type="curved_sword",
        grade=WeaponGrade.resonant,
        primary_principle="entropy",
        lore=WeaponLore(
            origin=WeaponOrigin.inheritance,
            history_summary=(
                "Đao của vị tướng cuối cùng của Đế chế cũ, "
                "bị bẻ gãy và forge lại"
            ),
            key_event="Trận đánh cuối cùng tại Quan Ải Phong Ấn",
        ),
    ),
    "than_ve_thuan": Weapon(
        id="than_ve_thuan",
        name="Thần Vệ Thuẫn",
        weapon_type="shield",
        grade=WeaponGrade.soul_linked,
        primary_principle="order",
        soul_linked=True,
        bond_score=80.0,  # Already soul-linked
        lore=WeaponLore(
            origin=WeaponOrigin.inheritance,
            history_summary=(
                "Thuẫn được một Herald của Aethis ban cho một chiến binh, "
                "truyền qua 3 thế hệ"
            ),
            key_event="Herald's Blessing tại Grand Gate",
        ),
    ),
}
