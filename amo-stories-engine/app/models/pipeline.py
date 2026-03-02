"""Pipeline-specific models for LangGraph agent outputs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.story import Choice


# ──────────────────────────────────────────────
# Planner
# ──────────────────────────────────────────────

class Beat(BaseModel):
    """A single scene beat within a chapter."""

    description: str = ""               # "Thiên Vũ phát hiện hang tối"
    tension: int = 5                    # 1-10
    purpose: str = "rising"             # setup | rising | climax | falling | resolution
    scene_type: str = "exploration"     # exploration | combat | dialogue | discovery | rest
    characters_involved: list[str] = Field(default_factory=list)
    mood: str = "neutral"               # tense | romantic | action | mystery | calm
    estimated_words: int = 400
    combat_brief: dict | None = None    # CombatBrief data (only for scene_type=combat)
    encounter_type: str = "minor"       # minor | duel | boss | climax (combat only)
    skill_reward: dict | None = None    # SkillRewardPlan (only for scene_type=discovery)


class PlannerOutput(BaseModel):
    """Structured outline for a chapter."""

    beats: list[Beat] = Field(default_factory=list)
    chapter_tension: int = 5            # Overall chapter tension 1-10
    pacing: str = "medium"              # fast | medium | slow
    emotional_arc: str = "growth"       # hope | despair | conflict | discovery | growth
    tension_curve: str = "rising"       # rising | climax | falling | twist
    new_characters: list[str] = Field(default_factory=list)
    world_changes: list[str] = Field(default_factory=list)
    chapter_title: str = ""


# ──────────────────────────────────────────────
# Simulator
# ──────────────────────────────────────────────

class RelChange(BaseModel):
    from_char: str
    to_char: str
    old_relation: str = "neutral"
    new_relation: str = "neutral"
    reason: str = ""


class CharReaction(BaseModel):
    character: str
    reaction: str                       # "giận dữ nhưng kìm nén"
    motivation: str = ""                # "vì vẫn coi Thiên Vũ như con"


class SimulatorOutput(BaseModel):
    consequences: list[dict] = Field(default_factory=list)
    relationship_changes: list[dict | RelChange] = Field(default_factory=list)
    world_state_updates: list[str] = Field(default_factory=list)
    world_impact: str = ""
    character_reactions: list[CharReaction] = Field(default_factory=list)
    foreshadowing: list[str] = Field(default_factory=list)
    identity_alignment: dict = Field(default_factory=dict)
    companion_affinity_deltas: dict[str, int] = Field(default_factory=dict)  # {companion_name: delta}

    @field_validator("world_impact", mode="before")
    @classmethod
    def coerce_world_impact(cls, v):
        return v if v is not None else ""


# ──────────────────────────────────────────────
# Consequence Router (replaces Simulator)
# ──────────────────────────────────────────────

class CausalChain(BaseModel):
    """A causal chain: trigger → ordered links with horizon and cascade risk."""
    id: str = ""
    trigger: str = ""
    links: list[str] = Field(default_factory=list)
    horizon: str = "immediate"           # immediate | delayed | long_term | immediate_to_long_term
    reversible: bool = True
    cascade_risk: str = "low"            # low | medium | high
    unique_skill_triggered: bool = False
    faction_involved: str = ""


class FactionImplication(BaseModel):
    """Faction-level consequence of a player action."""
    faction: str = ""
    stance_change: str = ""              # "neutral → hostile"
    reason: str = ""
    notoriety_contribution: float = 0.0
    reversible: bool = True
    empire_resonance_delta: int = 0      # Feed → villain_tracker.track_empire_resonance
    identity_anchor_delta: int = 0       # Feed → villain_tracker.track_identity_anchor


class WriterGuidance(BaseModel):
    """Narrative guidance from Consequence Router to Writer."""
    tone: str = "neutral"                # tense | hopeful | melancholic | triumphant
    highlight_chains: list[str] = Field(default_factory=list)  # chain IDs to emphasize
    foreshadow_priority: str = ""
    unique_skill_narrative_note: str = ""
    pacing_note: str = ""                # slow_burn | fast_escalation | quiet_aftermath


class ConsequenceRouterOutput(BaseModel):
    """Causal-chain consequence prediction — replaces SimulatorOutput.

    New fields provide causal chain reasoning, faction implications,
    and writer guidance. Backward-compat fields mirror SimulatorOutput.
    """
    # New: causal chain reasoning
    causal_chains: list[CausalChain] = Field(default_factory=list)
    faction_implications: list[FactionImplication] = Field(default_factory=list)
    writer_guidance: WriterGuidance = Field(default_factory=WriterGuidance)

    # Backward compat with SimulatorOutput (keep same typed fields)
    consequences: list[dict] = Field(default_factory=list)
    relationship_changes: list[dict | RelChange] = Field(default_factory=list)
    world_state_updates: list[str] = Field(default_factory=list)
    world_impact: str = ""
    character_reactions: list[CharReaction] = Field(default_factory=list)
    foreshadowing: list[str] = Field(default_factory=list)
    identity_alignment: dict = Field(default_factory=dict)
    companion_affinity_deltas: dict[str, int] = Field(default_factory=dict)  # {companion_name: delta}

    @field_validator("world_impact", mode="before")
    @classmethod
    def coerce_world_impact(cls, v):
        return v if v is not None else ""


# ──────────────────────────────────────────────
# Writer
# ──────────────────────────────────────────────

class WriterOutput(BaseModel):
    chapter_title: str = ""
    prose: str = ""
    summary: str = ""
    choices: list[Choice] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Critic
# ──────────────────────────────────────────────

class CriticOutput(BaseModel):
    score: float = 0.0                  # 1-10
    approved: bool = False
    feedback: dict = Field(default_factory=dict)
    issues: list[str] = Field(default_factory=list)
    rewrite_instructions: str = ""


# ──────────────────────────────────────────────
# LangGraph State
# ──────────────────────────────────────────────

class NarrativeState(BaseModel):
    """Full state passed through the LangGraph pipeline."""

    # Input
    story_id: str = ""
    chapter_number: int = 1
    preference_tags: list[str] = Field(default_factory=list)
    backstory: str = ""
    tone: str = ""
    protagonist_name: str = ""
    chosen_choice: Choice | None = None
    previous_summary: str = ""

    # Cross-chapter continuity bridge
    # Last scene prose from the previous chapter — empty for chapter 1
    previous_chapter_ending: str = ""

    # Player identity context
    player_state: Any = None                 # PlayerState (dict or Pydantic model)
    free_input: str = ""                     # Player's custom action text

    # Pipeline outputs
    planner_output: PlannerOutput | None = None
    simulator_output: SimulatorOutput | None = None
    consequence_output: ConsequenceRouterOutput | None = None  # Consequence Router (replaces simulator)
    context: str = ""
    writer_output: WriterOutput | None = None

    # Critic loop
    critic_output: CriticOutput | None = None
    rewrite_count: int = 0

    # Identity update output
    identity_delta: Any = None               # IdentityDelta (dict or Pydantic model)

    # Enhanced Intent Classifier outputs (Agent 0 upgrade)
    # Spec: Amoisekai/ENHANCED_INTENT_CLASSIFIER_SPEC.md
    action_category: str = ""         # narrative|combat|skill_use|social|exploration|stealth|equipment|soul_choice|other
    skill_reference: str = ""         # Name of skill being invoked (empty if none)
    player_intent: str = ""           # One-sentence intent behind the action
    choice_confidence: float = 1.0    # Classifier confidence (0–1)
    archetype_note: str = ""          # Archetype alignment note from classifier

    # Gender-Aware System (COMPANION_VILLAIN_GENDER_SPEC Phase 3)
    player_gender: str = "neutral"    # "male" | "female" | "neutral" — from player.gender

    # Companion System (COMPANION_VILLAIN_GENDER_SPEC Phase 1)
    companion_context: str = ""       # formatted companion block injected into context
    companion_affinity_deltas: dict = Field(default_factory=dict)  # {name: delta} from Simulator

    # Villain System (VILLAIN_SYSTEM_SPEC)
    active_villain: str = ""          # villain_id active in this chapter (e.g. "kaen", "vorn")
    villain_context: str = ""         # summary of villain state for LLM prompt injection

    # Adaptive Engine (PHASE1_ADAPTIVE_ENGINE)
    adaptive_context: str = ""        # Formatted adaptive context for LLM prompt injection (planner)
    writer_adaptive_context: str = "" # Narrative texture block for Writer agent (format_writer_context)

    # CRNG event for this chapter
    crng_event: dict = Field(default_factory=dict)

    # Fate buffer instruction
    fate_instruction: str = ""

    # Combat context
    combat_results: list[dict] = Field(default_factory=list)

    # Skill reward plan (from skill_discovery.plan_skill_reward)
    skill_reward_plan: dict | None = None

    # ── Weapon System (WEAPON_SYSTEM_SPEC v1.0) ──
    weapon_soul_link_pending: bool = False   # Flag for Planner: weapon ready for Soul-Link scene
    weapon_bond_updates: list[dict] = Field(default_factory=list)  # Bond score changes from chapter
    weapon_signature_used: bool = False      # Reset after encounter ends
    weapon_dormant: bool = False             # True if primary weapon is dormant
    dominant_archon: str = ""                # Archon soft-hint for Writer (optional, ignorable)
    weapon_awakening_pending: bool = False    # Flag: weapon ready for Awakening Scene (bond ≥ 85)
    weapon_evolution_pending: str = ""        # "v2" or "v3" when Signature Move evolution conditions met

    # Final
    final_prose: str = ""
    final_choices: list[Choice] = Field(default_factory=list)


