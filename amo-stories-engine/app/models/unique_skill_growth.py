"""Amoisekai — Unique Skill Growth State models (V2).

Tracks full evolution path: Seed → Bloom → Aspect → Ultimate.
Includes sub-skill management, Principle Resonance (silent Sovereign prep).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class GrowthType(str, Enum):
    """Active growth path for the Unique Skill."""
    BASE = "base"
    ECHO = "echo"         # Coherence-driven (aligned play)
    SCAR = "scar"         # Trauma-driven (survived hardship)
    ASPECT = "aspect"     # End-game branch (Rank 4+)
    ULTIMATE = "ultimate" # Final form — Synthesis (Rank 5, Season Climax)


class ScarType(str, Enum):
    """Type of Scar Adaptation — determines reactive sub-skill flavor."""
    DEFENSIVE = "defensive"   # Auto-shield, damage reduction
    COUNTER = "counter"       # Auto-retaliate, reflect
    WARNING = "warning"       # Auto-detect, precognition


class WeaknessType(str, Enum):
    """7-type weakness taxonomy — AI Forge must choose exactly one."""
    SOUL_ECHO = "soul_echo"                     # Pre-isekai memories intrude
    PRINCIPLE_BLEED = "principle_bleed"          # Principle affects player outside combat
    RESONANCE_DEPENDENCY = "resonance_dependency"  # Misfire if used against identity
    TARGET_PARADOX = "target_paradox"            # Cannot target specific entities/conditions
    SENSORY_TAX = "sensory_tax"                 # Temporary sensory loss after use
    ENVIRONMENT_LOCK = "environment_lock"        # Only works under certain conditions
    ESCALATION_CURSE = "escalation_curse"        # Side effects worsen with repeated use


# ──────────────────────────────────────────────
# Sub-models
# ──────────────────────────────────────────────

class TraumaEvent(BaseModel):
    """A single trauma event that contributes to Scar Bloom."""
    chapter: int = 0
    description: str = ""
    severity: str = ""       # "near_death" | "backlash" | "loss"


class AspectOption(BaseModel):
    """One of 2 Aspect choices presented during Aspect Forge."""
    name: str = ""
    description: str = ""
    strength: str = ""       # What this aspect excels at
    trade_off: str = ""      # What this aspect sacrifices
    sub_skill_2: dict = Field(default_factory=dict)  # Active sub-skill spec
    sub_skill_3: dict = Field(default_factory=dict)  # Passive sub-skill spec


class UltimateSkillForm(BaseModel):
    """Ultimate form data — generated during Ultimate Synthesis."""
    name: str = ""           # "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"
    title: str = ""          # Danh xưng (title)
    merged_sub_skills: list[dict] = Field(default_factory=list)
    absorbed_skill_name: str = ""
    absorbed_skill_integration: str = ""   # How Normal Skill was integrated
    ultimate_ability_name: str = ""
    ultimate_ability_description: str = ""
    ultimate_ability_used_this_season: bool = False
    naming_resonance: str = ""             # Why this name fits


# ──────────────────────────────────────────────
# Growth State
# ──────────────────────────────────────────────

class UniqueSkillGrowthState(BaseModel):
    """Complete growth state tracking — V2 with sub-skill management.

    Tracks progression: Seed → Bloom → Aspect → Ultimate.
    Each growth stage unlocks new sub-skills and transforms
    the weakness into evolved forms.
    """

    skill_id: str = ""
    original_skill_name: str = ""
    current_skill_name: str = ""          # Changes after aspect/ultimate
    current_stage: str = "seed"           # seed | bloom | aspect | ultimate

    # ── Growth path ──
    active_growth: GrowthType = GrowthType.BASE
    bloom_path: str = ""                  # "echo" | "scar" | ""
    bloom_completed: bool = False

    # ── Echo tracking (for Echo Bloom) ──
    echo_coherence_streak: int = 0        # Consecutive scenes with coherence ≥ 70
    echo_can_lose: bool = True            # Echo bloom can be lost if coherence drops

    # ── Scar tracking (for Scar Bloom) ──
    scar_adapted: bool = False
    scar_type: ScarType | None = None
    trauma_log: list[TraumaEvent] = Field(default_factory=list)
    scar_trauma_count: int = 0

    # ── Aspect Forge ──
    aspect_forged: bool = False
    aspect_options: list[AspectOption] = Field(default_factory=list)
    aspect_chosen: str = ""               # Aspect A or B name
    aspect_deferred: bool = False         # Player delayed choice
    aspect_defer_chapter: int = 0

    # ── Ultimate Form ──
    ultimate_forged: bool = False
    ultimate_form: UltimateSkillForm | None = None
    absorbed_skill_id: str = ""           # ID of Normal Skill absorbed
    naming_event_completed: bool = False

    # ── Sub-skills ──
    sub_skills_unlocked: list[str] = Field(default_factory=list)  # Sub-skill names

    # ── Mutation ──
    mutation_count: int = 0
    mutation_locked: bool = False         # True after Aspect Forge

    # ── Combat ──
    combat_bonus: float = 0.0             # Cached combat bonus (0.0-0.08)


# ──────────────────────────────────────────────
# Principle Resonance — Sovereign Prep (SILENT)
# ──────────────────────────────────────────────

class PrincipleResonance(BaseModel):
    """SECRET — Calculated after Soul Forge, player never sees this.

    Measures alignment between player's Unique Skill / identity
    and the 6 world Principles. If max_resonance >= 0.8, the
    skill is flagged as Proto-Sovereign (~3% of players).

    Weighting:
    - Behavioral Fingerprint (quiz): 60%
    - DNA Tags Alignment: 30%
    - Soul Forge Narrative Choices: 10%
    """

    order: float = 0.0
    entropy: float = 0.0
    matter: float = 0.0
    flux: float = 0.0
    energy: float = 0.0
    void: float = 0.0           # Always ≤ 0.3 in Season 1-2 (locked)

    is_proto_sovereign: bool = False    # True if max(scores) >= 0.8
    dominant_principle: str = ""        # Principle with highest resonance
