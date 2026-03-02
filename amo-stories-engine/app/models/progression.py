"""Amoisekai — Progression system models.

Rank tracking, skill evolution counters, and rank-up conditions.

Ref: PROGRESSION_SYSTEM_SPEC §3
"""

from __future__ import annotations

from enum import IntEnum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Progression Rank
# ──────────────────────────────────────────────

class ProgressionRank(IntEnum):
    """5-tier rank system tied to narrative milestones."""

    AWAKENED = 1        # F1 — Thức Tỉnh
    RESONANT = 2        # F1-2 — Cộng Hưởng
    STABILIZED = 3      # F2-3 — Ổn Định
    TRANSCENDENT = 4    # F3-4 — Siêu Việt
    SOVEREIGN = 5       # F4-5 — Chủ Tể

    @property
    def display_name(self) -> str:
        names = {
            1: "Thức Tỉnh (Awakened)",
            2: "Cộng Hưởng (Resonant)",
            3: "Ổn Định (Stabilized)",
            4: "Siêu Việt (Transcendent)",
            5: "Chủ Tể (Sovereign)",
        }
        return names.get(self.value, str(self.value))

    @property
    def skill_slots(self) -> int:
        """Number of equipped skill slots at this rank."""
        return 4 if self.value >= 2 else 3


# ──────────────────────────────────────────────
# Rank-Up Conditions
# ──────────────────────────────────────────────

# Minimum requirements per rank
RANK_CONDITIONS: dict[int, dict] = {
    2: {  # Awakened → Resonant
        "min_dqs": 40,
        "min_coherence": 50,
        "min_scenes": 10,
    },
    3: {  # Resonant → Stabilized
        "min_dqs": 60,
        "stability_trial_passed": True,
        "floor_boss_cleared": 2,
    },
    4: {  # Stabilized → Transcendent
        "min_dqs": 70,
        "breakthrough_event": True,
        "affinity_awakened": True,
    },
    5: {  # Transcendent → Sovereign
        "min_dqs": 85,
        "season_climax_cleared": True,
    },
}


# ──────────────────────────────────────────────
# Player Progression State
# ──────────────────────────────────────────────

class PlayerProgression(BaseModel):
    """Tracks all progression data for a player.

    Stored alongside PlayerState, updated per scene.
    """

    player_id: str = ""
    current_rank: ProgressionRank = ProgressionRank.AWAKENED

    # Rank-up tracking
    rank_up_ready: bool = False        # Engine flag → Planner creates rank-up beat
    total_scenes: int = 0

    # Skill evolution counters
    refinements_done: list[str] = Field(default_factory=list)   # skill_ids (max 2)
    mutations_done: int = 0            # Max 3
    integrations_done: int = 0         # Max 2
    skill_usage: dict[str, int] = Field(default_factory=dict)   # skill_id: use_count

    # Resonance mastery
    personal_cap_bonus: float = 0.0    # From training (max +0.3)
    stability_trials_passed: int = 0   # Max 3
    floor_bosses_cleared: list[int] = Field(default_factory=list)

    # Affinity
    affinity_awakened: bool = False
    awakened_principle: str = ""       # Principle enum value

    # Season/narrative flags
    breakthrough_event_done: bool = False
    season_climax_cleared: bool = False


def check_rank_up(
    player_dqs: float,
    player_coherence: float,
    progression: PlayerProgression,
) -> bool:
    """Check if player meets conditions for next rank.

    Returns True if all conditions for the next rank are met.
    Deterministic — no LLM call needed.
    """
    next_rank = progression.current_rank.value + 1
    if next_rank > 5:
        return False

    conditions = RANK_CONDITIONS.get(next_rank)
    if not conditions:
        return False

    # Check DQS
    if player_dqs < conditions.get("min_dqs", 0):
        return False

    # Check coherence (Rank 2 only)
    if "min_coherence" in conditions:
        if player_coherence < conditions["min_coherence"]:
            return False

    # Check scene count (Rank 2 only)
    if "min_scenes" in conditions:
        if progression.total_scenes < conditions["min_scenes"]:
            return False

    # Check stability trial (Rank 3)
    if conditions.get("stability_trial_passed"):
        if progression.stability_trials_passed < 1:
            return False

    # Check floor boss (Rank 3)
    if "floor_boss_cleared" in conditions:
        required_floor = conditions["floor_boss_cleared"]
        if required_floor not in progression.floor_bosses_cleared:
            return False

    # Check breakthrough (Rank 4)
    if conditions.get("breakthrough_event"):
        if not progression.breakthrough_event_done:
            return False

    # Check affinity (Rank 4)
    if conditions.get("affinity_awakened"):
        if not progression.affinity_awakened:
            return False

    # Check season climax (Rank 5)
    if conditions.get("season_climax_cleared"):
        if not progression.season_climax_cleared:
            return False

    return True
