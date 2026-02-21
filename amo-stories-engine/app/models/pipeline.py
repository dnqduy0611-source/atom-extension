"""Pipeline-specific models for LangGraph agent outputs."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.story import Choice


# ──────────────────────────────────────────────
# Planner
# ──────────────────────────────────────────────

class Beat(BaseModel):
    """A single scene beat within a chapter."""

    description: str                    # "Thiên Vũ phát hiện hang tối"
    characters_involved: list[str] = Field(default_factory=list)
    mood: str = "neutral"               # tense | romantic | action | mystery | calm
    estimated_words: int = 400


class PlannerOutput(BaseModel):
    """Structured outline for a chapter."""

    beats: list[Beat] = Field(default_factory=list)
    tension_curve: str = "rising"       # rising | climax | falling | twist
    new_characters: list[str] = Field(default_factory=list)
    world_changes: list[str] = Field(default_factory=list)
    pacing: str = "medium"              # fast | medium | slow
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
    relationship_changes: list[RelChange] = Field(default_factory=list)
    world_state_updates: list[str] = Field(default_factory=list)
    character_reactions: list[CharReaction] = Field(default_factory=list)
    foreshadowing: list[str] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Writer
# ──────────────────────────────────────────────

class WriterOutput(BaseModel):
    prose: str = ""
    choices: list[Choice] = Field(default_factory=list)


# ──────────────────────────────────────────────
# Critic
# ──────────────────────────────────────────────

class CriticOutput(BaseModel):
    score: float = 0.0                  # 1-10
    consistency_ok: bool = True
    style_ok: bool = True
    engagement: float = 0.0             # 1-10
    feedback: str | None = None         # Rewrite instructions if score < 7
    approved: bool = False


# ──────────────────────────────────────────────
# LangGraph State
# ──────────────────────────────────────────────

class NarrativeState(BaseModel):
    """Full state passed through the LangGraph pipeline."""

    # Input
    story_id: str = ""
    chapter_number: int = 1
    genre: str = ""
    world_desc: str = ""
    protagonist_name: str = ""
    chosen_choice: Choice | None = None
    previous_summary: str = ""

    # Pipeline outputs
    planner_output: PlannerOutput | None = None
    simulator_output: SimulatorOutput | None = None
    context: str = ""
    writer_output: WriterOutput | None = None

    # Critic loop
    critic_output: CriticOutput | None = None
    rewrite_count: int = 0

    # Final
    final_prose: str = ""
    final_choices: list[Choice] = Field(default_factory=list)
