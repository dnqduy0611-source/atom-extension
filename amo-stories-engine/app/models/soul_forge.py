"""Soul Forge — 3-Phase Identity Extraction models.

Phase 1: Micro-Narrative (5 scenes in The Void Between)
Phase 2: Soul Fragment (1 free-text)
Phase 3: Behavioral Fingerprint (hidden timing/hover data)
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field


def _session_id() -> str:
    return f"sf_{uuid4().hex[:12]}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# Phase 3: Behavioral Fingerprint
# ──────────────────────────────────────────────

class BehavioralFingerprint(BaseModel):
    """8-dimension vector from hidden timing/interaction data.

    All values normalized 0.0–1.0.
    """

    decisiveness: float = 0.5       # Fast decisions = high
    deliberation: float = 0.5       # Slow + hover = high
    expressiveness: float = 0.5     # Long text = high
    confidence: float = 0.5         # Fast typing + few edits = high
    patience: float = 0.5           # Read carefully + scroll back = high
    consistency: float = 0.5        # Even response times = high
    impulsivity: float = 0.5        # Sub-2s first choice = high
    revision_tendency: float = 0.5  # Many edits = high


# ──────────────────────────────────────────────
# Scene Choice Record
# ──────────────────────────────────────────────

class SceneChoice(BaseModel):
    """Records a single scene choice with behavioral data."""

    scene_id: int                        # 1-5
    variant: str = ""                    # Which variant was shown (e.g. "A", "B")
    choice_index: int = 0                # 0-based index of chosen option
    choice_text: str = ""                # Display text of chosen option
    response_time_ms: int = 0            # Time to choose (behavioral signal)
    hover_count: int = 0                 # How many times hovered over options
    signal_tags: dict = Field(default_factory=dict)  # Extracted identity signals


# ──────────────────────────────────────────────
# Identity Signals (aggregated)
# ──────────────────────────────────────────────

class IdentitySignals(BaseModel):
    """Aggregated signals from all 3 phases."""

    # Phase 1 — Micro-Narrative
    void_anchor: str = ""               # connection | power | knowledge | silence
    attachment_style: str = ""          # relational | power-seeking | analytical | cautious
    moral_core: str = ""                # loyalty | sacrifice | analysis | aggression | ...
    decision_pattern: str = ""          # instinctive | calculated | empathetic | ...
    conflict_response: str = ""         # AI-generated from Scene 3
    risk_tolerance: int = 2             # 1-3
    power_vs_connection: float = 0.0    # -1.0 (connection) to 1.0 (power)
    sacrifice_type: str = ""            # AI-generated from Scene 4
    courage_vs_cleverness: str = ""     # courage | cleverness | defiance
    scene_path: list[int] = Field(default_factory=list)

    # Phase 2 — Soul Fragment
    soul_fragment_raw: str = ""
    soul_fragment_themes: list[str] = Field(default_factory=list)
    soul_fragment_emotion: str = ""     # fierce | gentle | melancholic | defiant | ...
    soul_fragment_target: str = ""      # self | others | concept | world
    backstory: str = ""                 # Pre-isekai backstory (optional)
    backstory_signals: dict = Field(default_factory=dict)  # Parsed: domain_hint, skill_flavor, emotional_core

    # Phase 3 — Behavioral
    behavioral: BehavioralFingerprint = Field(
        default_factory=BehavioralFingerprint
    )


# ──────────────────────────────────────────────
# Session
# ──────────────────────────────────────────────

class SoulForgeSession(BaseModel):
    """Temporary session during the Soul Forge process."""

    session_id: str = Field(default_factory=_session_id)
    user_id: str = ""
    gender: str = "neutral"  # "male" | "female" | "neutral"
    started_at: datetime = Field(default_factory=_utcnow)

    # Progress
    current_scene: int = 1              # 1-5, 6 = soul_fragment, 7 = forging
    phase: str = "narrative"            # narrative | fragment | forging | done

    # Phase 1 data
    scene_choices: list[SceneChoice] = Field(default_factory=list)
    scene_path: list[int] = Field(default_factory=list)

    # AI-generated scene choices (keyed by scene_id)
    # Stores choices+signals from generate_scene_ai() for Scene 3-4
    ai_scene_choices: dict[int, list[dict]] = Field(default_factory=dict)

    # Phase 2 data
    soul_fragment_raw: str = ""
    backstory: str = ""  # Pre-isekai backstory (optional)

    # Phase 3 raw behavioral data
    raw_response_times: list[int] = Field(default_factory=list)
    raw_hover_counts: list[int] = Field(default_factory=list)
    fragment_char_count: int = 0
    fragment_typing_time_ms: int = 0
    fragment_revision_count: int = 0

    # Aggregated
    identity_signals: IdentitySignals | None = None

    # Result
    forge_attempts: int = 0
    ai_archetype: str = ""  # AI-chosen archetype (set during forge)


# ──────────────────────────────────────────────
# API Request/Response Models
# ──────────────────────────────────────────────

class SoulForgeStartRequest(BaseModel):
    user_id: str
    gender: str = "neutral"  # "male" | "female" | "neutral"


class SoulForgeAdvanceRequest(BaseModel):
    session_id: str


class SoulForgeChoiceRequest(BaseModel):
    session_id: str
    choice_index: int
    response_time_ms: int = 0
    hover_count: int = 0


class SoulForgeFragmentRequest(BaseModel):
    session_id: str
    text: str
    backstory: str = ""  # Optional pre-isekai backstory
    typing_time_ms: int = 0
    revision_count: int = 0


class SoulForgeForgeRequest(BaseModel):
    session_id: str
    name: str = ""  # Player-chosen character name


class SceneData(BaseModel):
    """Scene content returned to frontend."""

    scene_id: int
    title: str = ""
    text: str = ""
    choices: list[dict] = Field(default_factory=list)  # [{text, index}]
    phase: str = "narrative"  # narrative | fragment | forging | done


class SoulForgeStartResponse(BaseModel):
    session_id: str
    scene: SceneData


class SoulForgeSceneResponse(BaseModel):
    session_id: str
    scene: SceneData


class SoulForgeForgeResponse(BaseModel):
    session_id: str
    player_id: str
    skill_name: str
    skill_description: str
    skill_category: str
    skill_mechanic: str = ""
    skill_activation: str = ""
    skill_limitation: str = ""
    skill_weakness: str = ""
    soul_resonance: str
    archetype: str
    archetype_display: str
    archetype_description: str = ""
    dna_affinity: list[str]
    # ── V2 fields ──
    domain_passive_name: str = ""
    domain_passive_mechanic: str = ""
    weakness_type: str = ""
    axis_blind_spot: str = ""
    unique_clause: str = ""
