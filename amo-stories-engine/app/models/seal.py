"""Amoisekai — Seal State models.

Tracks active Seal / Anti-Unique Field effects on a player's Unique Skill.

Ref: UNIQUE SKILL CONTROL SYSTEM v1 §II.2-3
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class SealType(str, Enum):
    """How the seal was created."""
    RITUAL = "ritual"       # Costs 30+ stability, 1 phase prep, no combat use
    ZONE = "zone"           # Tower zone / location with pre-defined seal property
    CONTRACT = "contract"   # Mutual agreement, breaking = narrative consequences
    FACTION = "faction"     # Faction-locked tech, requires Rank 3+ or quest
    FIELD = "field"         # Anti-Unique Field (rare, extreme, suppression x2.0)


class SealState(BaseModel):
    """Active seal on a player's Unique Skill.

    Tracked per scene. Auto-expires when remaining_duration hits 0.
    """

    active: bool = False
    seal_type: SealType | None = None
    source: str = ""                    # Who/what created the seal
    source_description: str = ""        # For Writer context

    # Duration tracking
    remaining_phases: int = 0           # Combat phases remaining (0 = expired)
    remaining_scenes: int = 0           # Narrative scenes remaining (0 = expired)
    max_phases: int = 0                 # Original duration for reference

    # Suppression info (cached from suppression_check)
    suppression_power: float = 0.0      # Raw power used to create seal
    is_anti_unique_field: bool = False   # True if within Anti-Unique zone

    # Effects
    sub_skill_modifier: float = 0.3     # Sub-skills at 30% during seal
    domain_passive_off: bool = True     # Domain passive disabled during seal

    def is_expired(self) -> bool:
        """Check if seal has expired."""
        if not self.active:
            return True
        if self.is_anti_unique_field:
            return False  # Fields don't expire on their own
        return self.remaining_phases <= 0 and self.remaining_scenes <= 0

    def tick_phase(self) -> bool:
        """Consume one combat phase. Returns True if seal just expired."""
        if not self.active or self.is_anti_unique_field:
            return False
        self.remaining_phases = max(0, self.remaining_phases - 1)
        if self.is_expired():
            self.active = False
            return True
        return False

    def tick_scene(self) -> bool:
        """Consume one narrative scene. Returns True if seal just expired."""
        if not self.active or self.is_anti_unique_field:
            return False
        self.remaining_scenes = max(0, self.remaining_scenes - 1)
        if self.is_expired():
            self.active = False
            return True
        return False

    def release(self) -> None:
        """Manually release the seal."""
        self.active = False
        self.remaining_phases = 0
        self.remaining_scenes = 0
