"""Amoisekai — Skill Evolution & Resonance Mastery data models.

Tracks normal skill evolution (Refinement, Mutation, Integration, Awakening)
and Resonance Mastery training progress.

Ref: SKILL_EVOLUTION_SPEC v1.1 §9
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Evolution Enums
# ──────────────────────────────────────────────

class EvolutionType(str, Enum):
    """Types of normal skill evolution."""

    REFINEMENT = "refinement"
    MUTATION = "mutation"
    INTEGRATION = "integration"
    AWAKENING = "awakening"


class MutationType(str, Enum):
    """How a skill mutates based on identity drift pattern."""

    INVERSION = "inversion"           # Principle flips to opposite
    CORRUPTION = "corruption"         # Stronger + backlash risk
    PURIFICATION = "purification"     # Constraint reduced + weakness reduced
    HYBRIDIZATION = "hybridization"   # Adds latent principle


class MutationChoice(str, Enum):
    """Player's choice during mutation arc."""

    ACCEPT = "accept"
    RESIST = "resist"
    HYBRID = "hybrid"


# ──────────────────────────────────────────────
# Skill Evolution State
# ──────────────────────────────────────────────

class SkillEvolutionState(BaseModel):
    """Tracks all normal skill evolution for a player.

    CANONICAL SOURCE OF TRUTH for skill evolution data.
    PlayerProgression (PROGRESSION_SYSTEM_SPEC) may reference these fields
    but SkillEvolutionState is authoritative.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §9
    """

    player_id: str = ""

    # Refinement
    # NOTE: stores int (successful_uses count). identity_alignment is computed
    # on-the-fly via _calc_skill_identity_alignment() — not stored.
    refinement_trackers: dict[str, int] = Field(
        default_factory=dict,
        description="skill_id → successful_uses count (outcome ≠ unfavorable)",
    )
    refinements_done: list[str] = Field(
        default_factory=list,
        description="skill_ids that have been refined (max 2, each skill once)",
    )

    # Mutation
    mutations_done: int = 0                     # Max 3
    mutation_in_progress: str | None = None     # skill_id currently mutating
    mutation_arc_scene: int = 0                 # 0 = not started, 1-3 = scene in arc

    # Integration
    integrations_done: int = 0                  # Max 2

    # Awakening
    awakened_skills: list[str] = Field(
        default_factory=list,
        description="skill_ids that received awakened principle",
    )

    # Per-chapter limit
    last_evolution_chapter: int = 0             # Last chapter where evolution triggered (except Awakening)


# ──────────────────────────────────────────────
# Resonance Mastery State
# ──────────────────────────────────────────────

class ResonanceMasteryState(BaseModel):
    """Tracks resonance training progress.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3
    """

    player_id: str = ""

    # Personal Cap Training
    personal_cap_bonus: float = 0.0             # Max +0.3
    stability_trials_passed: int = 0            # Max 3
    stability_trial_tracker: int = 0            # Current conflicting uses count

    overdrive_risk_reduction: float = 0.0       # Max -10%
    overdrive_successes: int = 0                # Cumulative count. Trigger at 3.

    floor_attunements: list[int] = Field(
        default_factory=list,
        description="Floor numbers where attunement was achieved",
    )

    dual_masteries: list[str] = Field(
        default_factory=list,
        description='Principle pairs mastered, e.g. "energy-matter"',
    )
    dual_mastery_count: int = 0                 # Max 2


# ──────────────────────────────────────────────
# Evolution Event Log
# ──────────────────────────────────────────────

class SkillEvolutionEvent(BaseModel):
    """Log entry for a skill evolution event.

    Created by check_skill_evolution() when evolution is triggered.
    Consumed by the Planner to generate narrative beats.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §9
    """

    event_type: EvolutionType
    skill_id: str
    chapter: int = 0
    scene: int = 0

    # Refinement
    constraint_changed: str = ""                # "range" | "cooldown" | "cost" | etc.

    # Mutation
    mutation_type: MutationType | None = None
    player_choice: MutationChoice | None = None
    original_name: str = ""
    new_name: str = ""

    # Integration
    merged_from: list[str] = Field(default_factory=list)  # 2 skill_ids merged
    result_skill_name: str = ""
    result_tier: int = 0

    # Awakening
    awakened_principle: str = ""
