"""Amoisekai — Identity delta and mutation models.

These models track how identity changes after each chapter
and log mutation events over the player's lifetime.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Identity Event Types
# ──────────────────────────────────────────────

class IdentityEventType(str, Enum):
    """Types of identity events logged over a player's lifetime."""

    SEED_CREATED = "seed_created"           # Onboarding complete
    DRIFT = "drift"                         # Minor identity shift
    CONFRONTATION = "confrontation"         # Narrative Confrontation Event
    MUTATION = "mutation"                   # Major identity change (player chose)
    MUTATION_REJECTED = "mutation_rejected" # Player refused mutation
    REALIGNMENT = "realignment"             # Re-alignment arc completed
    BREAKTHROUGH = "breakthrough"           # Major breakthrough achieved


# ──────────────────────────────────────────────
# Identity Delta
# ──────────────────────────────────────────────

class IdentityDelta(BaseModel):
    """Changes to player identity after a single chapter.

    Computed by the Identity Agent (deterministic, no AI call).
    Applied to PlayerState after each chapter.
    """

    # Score changes (can be positive or negative)
    coherence_change: float = 0.0       # Typically -5 to +3 per chapter
    instability_change: float = 0.0     # Typically -3 to +5 per chapter
    echo_trace_change: float = 0.0      # Only changes on mutation
    dqs_change: float = 0.0             # Decision quality delta
    breakthrough_change: float = 0.0    # +2 to +5 for risky choices
    notoriety_change: float = 0.0       # +1 to +10 for flashy actions
    alignment_change: float = 0.0       # -5 to +5 per chapter
    fate_buffer_change: float = 0.0     # Negative after chapter 15

    # Events
    pity_reset: bool = False            # True if major event occurred
    new_flags: list[str] = Field(default_factory=list)

    # Drift detection
    drift_detected: str = ""            # "" | "minor" | "major"
    drift_description: str = ""         # Human-readable drift summary

    # Triggers
    confrontation_triggered: bool = False
    breakthrough_triggered: bool = False
    rogue_event_triggered: bool = False  # CRNG rogue event


# ──────────────────────────────────────────────
# Identity Event (Logged)
# ──────────────────────────────────────────────

class IdentityEvent(BaseModel):
    """A logged identity event — stored in identity_events table."""

    id: int | None = None               # Auto-increment from DB
    player_id: str = ""
    event_type: IdentityEventType = IdentityEventType.SEED_CREATED
    chapter_number: int = 0
    description: str = ""               # Human-readable description
    before_snapshot: dict = Field(default_factory=dict)
    after_snapshot: dict = Field(default_factory=dict)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


# ──────────────────────────────────────────────
# Player Flag
# ──────────────────────────────────────────────

class PlayerFlag(BaseModel):
    """A major plot flag for a player — stored in player_flags table.

    Examples:
        - "saved_city_huyenvan" → "chapter_12"
        - "betrayed_master_linh" → "chapter_8"
        - "discovered_ancient_relic" → "chapter_20"
    """

    id: int | None = None
    player_id: str = ""
    flag_key: str = ""
    flag_value: str = ""
    chapter_number: int = 0
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def apply_delta(
    player_state: "PlayerState",  # noqa: F821 — forward ref
    delta: IdentityDelta,
) -> "PlayerState":
    """Apply an IdentityDelta to a PlayerState, clamping all values.

    Returns a new PlayerState (does not mutate input).
    """

    def clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
        return max(lo, min(hi, val))

    updated = player_state.model_copy(
        update={
            "identity_coherence": clamp(
                player_state.identity_coherence + delta.coherence_change,
            ),
            "instability": clamp(
                player_state.instability + delta.instability_change,
            ),
            "echo_trace": clamp(
                player_state.echo_trace + delta.echo_trace_change,
            ),
            "decision_quality_score": clamp(
                player_state.decision_quality_score + delta.dqs_change,
            ),
            "breakthrough_meter": clamp(
                player_state.breakthrough_meter + delta.breakthrough_change,
            ),
            "notoriety": clamp(
                player_state.notoriety + delta.notoriety_change,
            ),
            "alignment": clamp(
                player_state.alignment + delta.alignment_change,
                lo=-100.0,
                hi=100.0,
            ),
            "fate_buffer": clamp(
                player_state.fate_buffer + delta.fate_buffer_change,
            ),
            "pity_counter": 0 if delta.pity_reset else player_state.pity_counter + 1,
            "total_chapters": player_state.total_chapters + 1,
        },
    )

    return updated
