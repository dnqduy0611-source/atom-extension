"""Amoisekai — Skill Catalog & Hybrid Generation models.

Pre-built Tier 1 skill skeletons (72 skills),  AI narrative wrapping models,
damage-type system, and helper utilities.

Ref: SKILL_CATALOG_SPEC v1.0
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class SkillArchetype(str, Enum):
    """Combat role of a skill."""

    OFFENSIVE = "offensive"
    DEFENSIVE = "defensive"
    SUPPORT = "support"
    SPECIALIST = "specialist"


class DamageType(str, Enum):
    """Replaces traditional physical/magical split.

    structural  → HP damage  (Matter, Energy, Order)
    stability   → Stability drain  (Entropy, Flux, Order)
    denial      → Void effects  (suppress, stealth, absorb)
    """

    STRUCTURAL = "structural"
    STABILITY = "stability"
    DENIAL = "denial"
    NONE = "none"  # Buffs / utility with no damage


class DeliveryType(str, Enum):
    """How the skill reaches its target."""

    MELEE = "melee"
    RANGED = "ranged"
    AREA = "area"
    SELF = "self"
    FIELD = "field"


# ──────────────────────────────────────────────
# Skill Skeleton (pre-built template)
# ──────────────────────────────────────────────

class SkillSkeleton(BaseModel):
    """Pre-built mechanical template from the catalog.

    The *skeleton* never changes.  AI generates a narrative *skin*
    (display name + description) on top of it per player.
    """

    id: str
    catalog_name: str
    principle: str                         # Principle enum value
    secondary_principle: str = ""          # For Tier 2 dual-principle skills
    archetype: SkillArchetype
    damage_type: DamageType
    delivery: DeliveryType
    mechanic: str
    limitation: str
    weakness: str
    tier: int = 1                          # 1 = base, 2 = integrated
    tags: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Narrative Skin (AI-generated per player)
# ──────────────────────────────────────────────

class NarrativeSkin(BaseModel):
    """AI-generated narrative wrapping for a skill."""

    display_name: str = ""
    description: str = ""
    discovery_line: str = ""


# ──────────────────────────────────────────────
# Player Skill (skeleton + skin + runtime)
# ──────────────────────────────────────────────

class PlayerSkill(BaseModel):
    """A skill as owned by a player — skeleton + narrative + evolution state."""

    skeleton_id: str                        # Key into SKILL_CATALOG
    narrative: NarrativeSkin = Field(default_factory=NarrativeSkin)

    # Runtime evolution state (refs SKILL_EVOLUTION_SPEC)
    usage_count: int = 0
    refined: bool = False
    mutated: bool = False
    awakened_principle: str = ""


# ──────────────────────────────────────────────
# Principle-Pair Template (Tier 2 integration)
# ──────────────────────────────────────────────

class PrinciplePairTemplate(BaseModel):
    """Template for deriving Tier 2 skills via Integration."""

    archetype_blend: str
    mechanic_pattern: str
    instability_cost: str                  # "low" | "moderate" | "high"
    power_multiplier: float
    flavor: str


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _sk(
    id: str,
    name: str,
    principle: str,
    archetype: str,
    damage: str,
    delivery: str,
    mechanic: str,
    limitation: str,
    weakness: str,
    tags: list[str] | None = None,
) -> SkillSkeleton:
    """Shorthand constructor for catalog entries."""
    return SkillSkeleton(
        id=id,
        catalog_name=name,
        principle=principle,
        archetype=SkillArchetype(archetype),
        damage_type=DamageType(damage),
        delivery=DeliveryType(delivery),
        mechanic=mechanic,
        limitation=limitation,
        weakness=weakness,
        tags=tags or [],
    )


# ══════════════════════════════════════════════
#  TIER 1 SKILL CATALOG — 72 SKILLS
# ══════════════════════════════════════════════

# ──────────────────────────────────────────────
# ORDER — Trật Tự
# ──────────────────────────────────────────────

_ORDER_SKILLS: list[SkillSkeleton] = [
    _sk(
        "order_off_01", "Order Strike", "order",
        "offensive", "structural", "melee",
        "Structured impact — reliable, consistent damage",
        "Short range only",
        "Predictable pattern",
        ["burst", "melee", "reliable"],
    ),
    _sk(
        "order_off_02", "Law Bind", "order",
        "offensive", "stability", "ranged",
        "Binds target in structured rules — stability drain",
        "Line of sight required",
        "Breaks on high-instability target",
        ["bind", "stability_drain", "control"],
    ),
    _sk(
        "order_off_03", "Mandate Pulse", "order",
        "offensive", "stability", "area",
        "AoE wave that disrupts chaotic entities",
        "3-phase cooldown",
        "Friendly targets also slowed",
        ["aoe", "disruption", "cooldown"],
    ),
    _sk(
        "order_off_04", "Sequence Barrage", "order",
        "offensive", "structural", "ranged",
        "Multi-hit projectiles in fixed pattern",
        "Pattern is telegraphed",
        "Dodgeable if pattern learned",
        ["multi_hit", "ranged", "pattern"],
    ),
    _sk(
        "order_def_01", "Structure Shield", "order",
        "defensive", "none", "self",
        "Frontal barrier absorbs incoming damage",
        "Stationary while active",
        "Side and back vulnerable",
        ["shield", "frontal", "stationary"],
    ),
    _sk(
        "order_def_02", "Rule Ward", "order",
        "defensive", "none", "field",
        "Area protection zone — allies take less damage inside",
        "Fixed position once placed",
        "Costs stability to maintain",
        ["ward", "area_protect", "drain"],
    ),
    _sk(
        "order_def_03", "Sequence Counter", "order",
        "defensive", "structural", "melee",
        "Predicts and counters enemy attack pattern",
        "Requires 1 phase observation first",
        "Fails vs chaotic enemies",
        ["counter", "prediction", "timing"],
    ),
    _sk(
        "order_sup_01", "Discipline Stance", "order",
        "support", "none", "self",
        "Stability regen over time, resist disruption",
        "Cannot use offensive skills during",
        "Broken by forced movement",
        ["stance", "regen", "stability"],
    ),
    _sk(
        "order_sup_02", "Regulation Field", "order",
        "support", "stability", "field",
        "Debuff zone — enemies slowed, skill cooldown increased",
        "Small radius",
        "Costs stability per phase",
        ["debuff", "slow", "field"],
    ),
    _sk(
        "order_sup_03", "Predict", "order",
        "support", "none", "ranged",
        "Read enemy's next probable action (partial info)",
        "Single target only",
        "Unreliable vs Flux/Entropy enemies",
        ["intel", "predict", "info"],
    ),
    _sk(
        "order_spe_01", "Axiom Anchor", "order",
        "specialist", "none", "self",
        "Prevents forced movement, knockback, displacement",
        "Rooted in place",
        "Immobile = easy target for AoE",
        ["anchor", "anti_displacement", "root"],
    ),
    _sk(
        "order_spe_02", "Decree", "order",
        "specialist", "stability", "ranged",
        "Marks target — all incoming damage increased",
        "One mark at a time",
        "Mark visible = target knows",
        ["mark", "amplify", "debuff"],
    ),
]


# ──────────────────────────────────────────────
# ENTROPY — Hỗn Loạn
# ──────────────────────────────────────────────

_ENTROPY_SKILLS: list[SkillSkeleton] = [
    _sk(
        "entropy_off_01", "Entropy Shred", "entropy",
        "offensive", "stability", "melee",
        "Tear apart target's structural integrity",
        "Proximity only",
        "Self-instability +2",
        ["shred", "stability_drain", "melee"],
    ),
    _sk(
        "entropy_off_02", "Decay Bolt", "entropy",
        "offensive", "stability", "ranged",
        "Corroding projectile — stability drain over time",
        "DoT, not burst",
        "Slow projectile speed",
        ["dot", "ranged", "corrode"],
    ),
    _sk(
        "entropy_off_03", "Chaos Burst", "entropy",
        "offensive", "stability", "area",
        "AoE destabilization wave",
        "High stability cost (20)",
        "Affects self if too close",
        ["aoe", "burst", "destabilize"],
    ),
    _sk(
        "entropy_off_04", "Unravel Beam", "entropy",
        "offensive", "stability", "ranged",
        "Focused beam that strips defensive buffs",
        "Channel — interruptible",
        "No raw damage, only debuff removal",
        ["channel", "strip_buff", "beam"],
    ),
    _sk(
        "entropy_def_01", "Dissolution Cloak", "entropy",
        "defensive", "stability", "self",
        "Damage aura — melee attackers take stability drain",
        "Costs stability per phase",
        "No protection vs ranged",
        ["aura", "retaliate", "melee_only"],
    ),
    _sk(
        "entropy_def_02", "Entropy Dodge", "entropy",
        "defensive", "none", "self",
        "Chaotic movement — hard to predict/target",
        "Random direction",
        "May dodge into worse position",
        ["dodge", "chaotic", "unpredictable"],
    ),
    _sk(
        "entropy_def_03", "Feedback Loop", "entropy",
        "defensive", "stability", "self",
        "Reflect portion of stability damage back to attacker",
        "Only reflects stability damage",
        "Doesn't block structural damage",
        ["reflect", "stability_only", "counter"],
    ),
    _sk(
        "entropy_sup_01", "Corrode", "entropy",
        "support", "stability", "ranged",
        "Debuff — reduce target's defensive stats",
        "Single target",
        "Wears off after 2 phases",
        ["debuff", "defense_down", "timed"],
    ),
    _sk(
        "entropy_sup_02", "Chaos Field", "entropy",
        "support", "stability", "field",
        "Area denial — entering zone causes stability drain",
        "Fixed position",
        "Self-zone also affected",
        ["area_denial", "field", "hazard"],
    ),
    _sk(
        "entropy_sup_03", "Destabilize", "entropy",
        "support", "stability", "melee",
        "Single target focus — massive stability shred",
        "Touch range, slow activation",
        "Leaves user exposed",
        ["focus", "shred", "single_target"],
    ),
    _sk(
        "entropy_spe_01", "Cascade Failure", "entropy",
        "specialist", "stability", "ranged",
        "Chain reaction — damage spreads to adjacent enemies",
        "Needs 2+ enemies clustered",
        "Self-instability +5",
        ["chain", "multi_target", "high_risk"],
    ),
    _sk(
        "entropy_spe_02", "Entropy Siphon", "entropy",
        "specialist", "stability", "melee",
        "Drain target stability → convert to own stability",
        "Touch range, channel",
        "Interrupted by any hit",
        ["drain", "sustain", "channel"],
    ),
]


# ──────────────────────────────────────────────
# MATTER — Vật Chất
# ──────────────────────────────────────────────

_MATTER_SKILLS: list[SkillSkeleton] = [
    _sk(
        "matter_off_01", "Iron Fist", "matter",
        "offensive", "structural", "melee",
        "Heavy physical strike — high base damage",
        "Short range, slow",
        "Telegraphed startup",
        ["heavy", "melee", "slow"],
    ),
    _sk(
        "matter_off_02", "Stone Spike", "matter",
        "offensive", "structural", "ranged",
        "Earth projectile from ground",
        "Needs solid ground",
        "No effect on flying/phased",
        ["projectile", "ground", "conditional"],
    ),
    _sk(
        "matter_off_03", "Quake Slam", "matter",
        "offensive", "structural", "area",
        "Ground impact — AoE structural damage",
        "Self-root during animation",
        "Airborne enemies immune",
        ["aoe", "ground", "root"],
    ),
    _sk(
        "matter_off_04", "Boulder Crush", "matter",
        "offensive", "structural", "ranged",
        "Heavy projectile — highest single-target Tier 1 damage",
        "Very slow, 3-phase cooldown",
        "Easy to dodge",
        ["heavy", "cooldown", "burst"],
    ),
    _sk(
        "matter_def_01", "Matter Shield", "matter",
        "defensive", "none", "self",
        "Solid frontal barrier — high HP absorption",
        "Stationary, frontal only",
        "Side flanking",
        ["shield", "frontal", "stationary"],
    ),
    _sk(
        "matter_def_02", "Bastion Wall", "matter",
        "defensive", "none", "field",
        "Create cover wall — blocks projectiles for area",
        "Fixed position, breakable",
        "AoE bypasses",
        ["wall", "cover", "breakable"],
    ),
    _sk(
        "matter_def_03", "Granite Counter", "matter",
        "defensive", "structural", "melee",
        "Absorb hit → return amplified physical damage",
        "Only counters melee attacks",
        "Timing-dependent",
        ["counter", "amplify", "melee_only"],
    ),
    _sk(
        "matter_sup_01", "Fortify", "matter",
        "support", "none", "self",
        "Self-buff — structural damage resistance increase",
        "Duration 2 phases",
        "No stability protection",
        ["buff", "defense", "timed"],
    ),
    _sk(
        "matter_sup_02", "Weight Bind", "matter",
        "support", "none", "ranged",
        "Debuff — increase target weight, reduce mobility",
        "Single target",
        "Flux enemies resist",
        ["debuff", "slow", "conditional"],
    ),
    _sk(
        "matter_sup_03", "Earth Spike Trap", "matter",
        "support", "structural", "field",
        "Delayed trap — triggers on enemy entry",
        "Setup time 1 phase",
        "Visible trap, avoidable",
        ["trap", "delayed", "field"],
    ),
    _sk(
        "matter_spe_01", "Reshape", "matter",
        "specialist", "none", "field",
        "Alter terrain — create obstacles or bridges",
        "Requires existing matter",
        "Costs stability 15",
        ["terrain", "utility", "creative"],
    ),
    _sk(
        "matter_spe_02", "Iron Skin", "matter",
        "specialist", "none", "self",
        "Convert 20% stability → temporary structural armor",
        "Stability sacrifice",
        "Below 30 stability = risky",
        ["convert", "armor", "sacrifice"],
    ),
]


# ──────────────────────────────────────────────
# FLUX — Linh Hoạt
# ──────────────────────────────────────────────

_FLUX_SKILLS: list[SkillSkeleton] = [
    _sk(
        "flux_off_01", "Phase Strike", "flux",
        "offensive", "stability", "melee",
        "Phase through defenses — ignores shields",
        "Touch range",
        "Self-instability +2",
        ["phase", "bypass", "melee"],
    ),
    _sk(
        "flux_off_02", "Flux Bolt", "flux",
        "offensive", "stability", "ranged",
        "Shifting projectile — changes trajectory mid-flight",
        "Unpredictable accuracy",
        "May miss entirely",
        ["projectile", "erratic", "ranged"],
    ),
    _sk(
        "flux_off_03", "Ripple Wave", "flux",
        "offensive", "stability", "area",
        "Reality ripple — disrupts all in area",
        "Small radius",
        "Friendly fire possible",
        ["aoe", "ripple", "friendly_fire"],
    ),
    _sk(
        "flux_off_04", "Vector Strike", "flux",
        "offensive", "structural", "melee",
        "Move + attack combo — momentum converts to damage",
        "Needs running start",
        "Locked into trajectory",
        ["momentum", "charge", "melee"],
    ),
    _sk(
        "flux_def_01", "Flow Guard", "flux",
        "defensive", "none", "self",
        "Adaptive shield — shifts to block incoming attack type",
        "Brief window only",
        "Multi-hit breaks it",
        ["adaptive", "shield", "reactive"],
    ),
    _sk(
        "flux_def_02", "Phase Dodge", "flux",
        "defensive", "none", "self",
        "Phase out of reality briefly — complete avoidance",
        "3-phase cooldown",
        "Instability +1 per use",
        ["dodge", "phase", "cooldown"],
    ),
    _sk(
        "flux_def_03", "Redirect", "flux",
        "defensive", "none", "self",
        "Redirect incoming attack to nearby target/area",
        "Requires nearby redirect target",
        "High skill ceiling",
        ["redirect", "tactical", "advanced"],
    ),
    _sk(
        "flux_sup_01", "Accelerate", "flux",
        "support", "none", "self",
        "Self-buff — speed increase, extra action possibility",
        "Duration 1 phase",
        "Stability drain while active",
        ["buff", "speed", "drain"],
    ),
    _sk(
        "flux_sup_02", "Distortion Field", "flux",
        "support", "stability", "field",
        "AoE debuff — confusion, accuracy reduction",
        "Costs stability 10/phase",
        "Affects allies too",
        ["debuff", "field", "confusion"],
    ),
    _sk(
        "flux_sup_03", "Flux Disruption", "flux",
        "support", "stability", "ranged",
        "Cancel target's current action/channel",
        "Single use per encounter",
        "Narrow timing window",
        ["interrupt", "cancel", "single_use"],
    ),
    _sk(
        "flux_spe_01", "Momentum Surge", "flux",
        "specialist", "structural", "melee",
        "Chain consecutive attacks — each hit +10% damage",
        "Must keep attacking, no pause",
        "One miss = chain breaks",
        ["chain", "combo", "escalate"],
    ),
    _sk(
        "flux_spe_02", "Adaptive Form", "flux",
        "specialist", "none", "self",
        "Temporarily shift primary principle to counter enemy",
        "1 phase duration, 5-phase cooldown",
        "High instability +5",
        ["transform", "adapt", "high_risk"],
    ),
]


# ──────────────────────────────────────────────
# ENERGY — Năng Lượng
# ──────────────────────────────────────────────

_ENERGY_SKILLS: list[SkillSkeleton] = [
    _sk(
        "energy_off_01", "Energy Burst", "energy",
        "offensive", "structural", "melee",
        "Close-range energy explosion — high burst",
        "Proximity only",
        "Self-damage if stability < 30",
        ["burst", "melee", "risky"],
    ),
    _sk(
        "energy_off_02", "Spark Bolt", "energy",
        "offensive", "structural", "ranged",
        "Fast energy projectile — reliable damage",
        "Low damage per hit",
        "No secondary effects",
        ["projectile", "fast", "reliable"],
    ),
    _sk(
        "energy_off_03", "Shockwave", "energy",
        "offensive", "structural", "area",
        "Expanding energy wave — damage decreases with distance",
        "Centered on self",
        "Close allies affected",
        ["aoe", "wave", "falloff"],
    ),
    _sk(
        "energy_off_04", "Thermal Strike", "energy",
        "offensive", "structural", "melee",
        "Superheated impact — HP damage + burn DoT",
        "Slow windup",
        "Costs stability 15",
        ["heavy", "dot", "burn"],
    ),
    _sk(
        "energy_def_01", "Energy Barrier", "energy",
        "defensive", "none", "self",
        "Energy shield — absorbs fixed damage amount",
        "Drains stability over time",
        "Burst damage overloads it",
        ["shield", "energy", "drain"],
    ),
    _sk(
        "energy_def_02", "Charge Field", "energy",
        "defensive", "structural", "field",
        "Protective zone — enemies inside take damage",
        "Fixed position, energy cost",
        "Drains stability 5/phase",
        ["field", "damage_zone", "drain"],
    ),
    _sk(
        "energy_def_03", "Overload Counter", "energy",
        "defensive", "structural", "self",
        "Absorb energy attack → overload → return 150% damage",
        "Only energy/structural attacks",
        "Mistime = full damage taken",
        ["counter", "absorb", "timing"],
    ),
    _sk(
        "energy_sup_01", "Power Surge", "energy",
        "support", "none", "self",
        "Self-buff — next attack +40% damage",
        "Single next attack only",
        "3-phase cooldown",
        ["buff", "damage_amp", "single_use"],
    ),
    _sk(
        "energy_sup_02", "Drain Pulse", "energy",
        "support", "structural", "area",
        "AoE weak damage — drain energy from environment",
        "Low damage",
        "No effect in void zones",
        ["aoe", "drain", "environmental"],
    ),
    _sk(
        "energy_sup_03", "Ignite", "energy",
        "support", "structural", "ranged",
        "DoT debuff — burning damage over 3 phases",
        "Single target",
        "Water/void extinguishes",
        ["dot", "burn", "debuff"],
    ),
    _sk(
        "energy_spe_01", "Arc Chain", "energy",
        "specialist", "structural", "ranged",
        "Chain lightning — jumps to 2 adjacent enemies",
        "Needs clustered targets",
        "Damage splits per jump",
        ["chain", "multi_target", "conditional"],
    ),
    _sk(
        "energy_spe_02", "Conversion Core", "energy",
        "specialist", "none", "self",
        "Convert 15 HP → 25 stability (energy alchemy)",
        "HP sacrifice",
        "Can't use below 20 HP",
        ["convert", "sustain", "sacrifice"],
    ),
]


# ──────────────────────────────────────────────
# VOID — Hư Không
# ──────────────────────────────────────────────

_VOID_SKILLS: list[SkillSkeleton] = [
    _sk(
        "void_off_01", "Null Strike", "void",
        "offensive", "denial", "melee",
        "Strike removes 1 active buff from target",
        "Touch range",
        "No raw damage",
        ["dispel", "melee", "utility"],
    ),
    _sk(
        "void_off_02", "Shadow Bolt", "void",
        "offensive", "denial", "ranged",
        "Ranged damage + grants brief stealth",
        "2-phase cooldown",
        "Stealth breaks on next attack",
        ["ranged", "stealth", "combo"],
    ),
    _sk(
        "void_off_03", "Void Pulse", "void",
        "offensive", "denial", "area",
        "AoE silence — enemies can't use skills for 1 phase",
        "High stability cost (25)",
        "Self also silenced",
        ["aoe", "silence", "high_cost"],
    ),
    _sk(
        "void_off_04", "Absorption Touch", "void",
        "offensive", "denial", "melee",
        "Absorb enemy attack → convert to stability",
        "Requires incoming attack",
        "Structural damage only partially absorbed",
        ["absorb", "counter", "sustain"],
    ),
    _sk(
        "void_def_01", "Void Cloak", "void",
        "defensive", "none", "self",
        "Full stealth — enemies lose targeting",
        "Broken by AoE or attacking",
        "Stability cost per phase (5)",
        ["stealth", "invisibility", "drain"],
    ),
    _sk(
        "void_def_02", "Null Ward", "void",
        "defensive", "denial", "field",
        "Anti-skill zone — no skills work inside (allies too)",
        "Fixed position",
        "Everyone affected equally",
        ["field", "anti_skill", "hazard"],
    ),
    _sk(
        "void_def_03", "Negation Counter", "void",
        "defensive", "denial", "self",
        "Absorb and nullify incoming skill — skill cancelled",
        "Only negates 1 skill",
        "4-phase cooldown",
        ["counter", "negate", "cooldown"],
    ),
    _sk(
        "void_sup_01", "Shadow Veil", "void",
        "support", "none", "self",
        "Self-buff — evasion increase, harder to predict",
        "2 phases duration",
        "Energy burst reveals",
        ["buff", "evasion", "timed"],
    ),
    _sk(
        "void_sup_02", "Suppress", "void",
        "support", "denial", "ranged",
        "Debuff — target's skill effectiveness -30%",
        "Single target, 2 phases",
        "High-resonance targets resist",
        ["debuff", "suppress", "conditional"],
    ),
    _sk(
        "void_sup_03", "Void Anchor", "void",
        "support", "denial", "field",
        "Tether target to location — can't move beyond radius",
        "Channel — interruptible",
        "Only 1 anchor at a time",
        ["tether", "control", "channel"],
    ),
    _sk(
        "void_spe_01", "Erase", "void",
        "specialist", "denial", "ranged",
        "Temporarily remove 1 target buff/skill (3 phases)",
        "5-phase cooldown",
        "Target knows which skill erased",
        ["erase", "disable", "cooldown"],
    ),
    _sk(
        "void_spe_02", "Hollow Zone", "void",
        "specialist", "denial", "field",
        "Create zone where all principle resonance weakened -20%",
        "Fixed area, high cost (30 stability)",
        "Self also weakened inside",
        ["field", "weaken", "area_denial"],
    ),
]


# ══════════════════════════════════════════════
# ASSEMBLED CATALOG
# ══════════════════════════════════════════════

SKILL_CATALOG: dict[str, SkillSkeleton] = {
    sk.id: sk
    for sk in (
        _ORDER_SKILLS
        + _ENTROPY_SKILLS
        + _MATTER_SKILLS
        + _FLUX_SKILLS
        + _ENERGY_SKILLS
        + _VOID_SKILLS
    )
}
"""All 72 Tier 1 skill skeletons, keyed by ``id``."""


# ══════════════════════════════════════════════
# TIER 2 INTEGRATION TEMPLATES
# ══════════════════════════════════════════════

PRINCIPLE_PAIR_TEMPLATES: dict[tuple[str, str], PrinciplePairTemplate] = {
    # ── Opposing pairs (high power, high instability) ──
    ("order", "entropy"): PrinciplePairTemplate(
        archetype_blend="paradox",
        mechanic_pattern="structured_chaos",
        instability_cost="high",
        power_multiplier=1.4,
        flavor="Order constrains Entropy — or tries to",
    ),
    ("matter", "flux"): PrinciplePairTemplate(
        archetype_blend="phase_material",
        mechanic_pattern="solid_shift",
        instability_cost="high",
        power_multiplier=1.4,
        flavor="Matter that refuses to stay in one form",
    ),
    ("energy", "void"): PrinciplePairTemplate(
        archetype_blend="dark_energy",
        mechanic_pattern="burst_absorb",
        instability_cost="high",
        power_multiplier=1.4,
        flavor="Energy poured into nothingness — or pulled from it",
    ),

    # ── Adjacent pairs (synergy, stable) ──
    ("order", "matter"): PrinciplePairTemplate(
        archetype_blend="fortress",
        mechanic_pattern="structural_reinforce",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Structured matter — the strongest defense",
    ),
    ("order", "energy"): PrinciplePairTemplate(
        archetype_blend="directed_force",
        mechanic_pattern="focused_beam",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Energy with purpose and precision",
    ),
    ("entropy", "flux"): PrinciplePairTemplate(
        archetype_blend="dissolution",
        mechanic_pattern="shifting_decay",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Nothing stays the same — nothing stays at all",
    ),
    ("entropy", "void"): PrinciplePairTemplate(
        archetype_blend="annihilation",
        mechanic_pattern="erase_existence",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Not just destruction — erasure from reality",
    ),
    ("matter", "energy"): PrinciplePairTemplate(
        archetype_blend="kinetic",
        mechanic_pattern="convert_force",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Mass in motion — physics at its most violent",
    ),
    ("flux", "void"): PrinciplePairTemplate(
        archetype_blend="phantom",
        mechanic_pattern="exist_not_exist",
        instability_cost="low",
        power_multiplier=1.1,
        flavor="Present one moment, void the next",
    ),

    # ── Cross-cluster pairs (moderate instability) ──
    ("order", "flux"): PrinciplePairTemplate(
        archetype_blend="controlled_change",
        mechanic_pattern="regulated_shift",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="Change within rules — evolution, not chaos",
    ),
    ("order", "void"): PrinciplePairTemplate(
        archetype_blend="reality_lock",
        mechanic_pattern="deny_and_bind",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="The void has structure too — if you know where to look",
    ),
    ("entropy", "matter"): PrinciplePairTemplate(
        archetype_blend="corrosion",
        mechanic_pattern="structural_decay",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="Even the hardest stone crumbles given time",
    ),
    ("entropy", "energy"): PrinciplePairTemplate(
        archetype_blend="meltdown",
        mechanic_pattern="explosive_decay",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="Energy unleashed without direction — beautiful and devastating",
    ),
    ("matter", "void"): PrinciplePairTemplate(
        archetype_blend="hollow_form",
        mechanic_pattern="empty_structure",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="A shell of matter with nothing inside",
    ),
    ("flux", "energy"): PrinciplePairTemplate(
        archetype_blend="surge",
        mechanic_pattern="dynamic_power",
        instability_cost="moderate",
        power_multiplier=1.2,
        flavor="Power that never flows the same way twice",
    ),
}


def get_pair_template(
    principle_a: str,
    principle_b: str,
) -> PrinciplePairTemplate | None:
    """Look up the integration template for a principle pair.

    Order-independent: (order, entropy) == (entropy, order).
    """
    pair = (principle_a, principle_b)
    if pair in PRINCIPLE_PAIR_TEMPLATES:
        return PRINCIPLE_PAIR_TEMPLATES[pair]
    # Try reversed
    pair_rev = (principle_b, principle_a)
    return PRINCIPLE_PAIR_TEMPLATES.get(pair_rev)


# ══════════════════════════════════════════════
# QUERY HELPERS
# ══════════════════════════════════════════════

def get_skills_by_principle(principle: str) -> list[SkillSkeleton]:
    """Return all catalog skills for a given principle."""
    return [sk for sk in SKILL_CATALOG.values() if sk.principle == principle]


def get_skills_by_archetype(archetype: str) -> list[SkillSkeleton]:
    """Return all catalog skills of a given archetype."""
    return [
        sk for sk in SKILL_CATALOG.values()
        if sk.archetype.value == archetype
    ]


def get_skills_by_tag(tag: str) -> list[SkillSkeleton]:
    """Return all catalog skills containing a specific tag."""
    return [sk for sk in SKILL_CATALOG.values() if tag in sk.tags]


def get_skill(skill_id: str) -> SkillSkeleton | None:
    """Look up a single skill by ID."""
    return SKILL_CATALOG.get(skill_id)
