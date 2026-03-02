"""Amoisekai — Combat Data Models.

Models for the Resolution Combat system (multi-phase, decision-point-based).
Spec: COMBAT_SYSTEM_SPEC v1.1 §11

Note: The engine module (app/engine/combat.py) still keeps the flat CombatBrief
for backwards-compat with Minor encounters. These models extend the system
for Duel/Boss/Climax encounter types.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class CombatAction(str, Enum):
    """Player action during a combat phase."""

    STRIKE = "strike"          # Damage + stability pressure on enemy
    SHIFT = "shift"            # Adapt principle vector, counter phase shift
    STABILIZE = "stabilize"    # Recover stability, reduce instability


class EncounterType(str, Enum):
    """Combat encounter scale — determines number of decision points."""

    MINOR = "minor"       # 0 decision points → auto-resolve (1 phase)
    DUEL = "duel"         # 1 decision point  → 2 phases
    BOSS = "boss"         # 2 decision points → 3 phases
    CLIMAX = "climax"     # 3 decision points → season boss (defer to Phase 2)

    @property
    def decision_point_count(self) -> int:
        return {"minor": 0, "duel": 1, "boss": 2, "climax": 3}[self.value]

    @property
    def phase_count(self) -> int:
        return self.decision_point_count + 1

    @property
    def display_name(self) -> str:
        return {
            "minor": "Giao Tranh Nhỏ",
            "duel": "Tỷ Đấu",
            "boss": "Boss",
            "climax": "Đại Chiến",
        }[self.value]


class StabilityTier(str, Enum):
    """Stability bar tiers — each has gameplay effects.

    §3.2: As stability drops, combat becomes riskier.
    """

    NORMAL = "normal"        # 60-100% → full combat effectiveness
    UNSTABLE = "unstable"    # 30-59%  → misfire chance, reduced crit
    CRITICAL = "critical"    # 10-29%  → overdrive disabled, high mutation risk
    BROKEN = "broken"        #  0-9%   → vulnerability, must Stabilize or retreat

    @staticmethod
    def from_value(stability: float) -> StabilityTier:
        """Get tier from stability percentage (0-100)."""
        if stability >= 60:
            return StabilityTier.NORMAL
        if stability >= 30:
            return StabilityTier.UNSTABLE
        if stability >= 10:
            return StabilityTier.CRITICAL
        return StabilityTier.BROKEN

    @property
    def effects(self) -> dict:
        """Gameplay effects at this stability tier."""
        return {
            "normal": {
                "combat_score_modifier": 0.0,
                "overdrive_available": True,
                "misfire_chance": 0.0,
                "description": "Ổn định — chiến đấu toàn lực",
            },
            "unstable": {
                "combat_score_modifier": -0.05,
                "overdrive_available": True,
                "misfire_chance": 0.10,
                "description": "Bất ổn — độ chính xác giảm",
            },
            "critical": {
                "combat_score_modifier": -0.15,
                "overdrive_available": False,
                "misfire_chance": 0.25,
                "description": "Nguy hiểm — Overdrive bị khóa, dễ thất bại",
            },
            "broken": {
                "combat_score_modifier": -0.30,
                "overdrive_available": False,
                "misfire_chance": 0.50,
                "description": "Sụp đổ — cực kỳ dễ tổn thương",
            },
        }[self.value]


class EnemyType(str, Enum):
    """Enemy archetypes — each tests different aspects of player build.

    §4.3: Three enemy types to force build diversity.
    """

    STRUCTURAL = "structural"      # High HP, tests sustained damage
    INSTABILITY = "instability"    # Pressures stability, rewards Stabilize
    PERCEPTION = "perception"      # Reads patterns, punishes repetition


# ──────────────────────────────────────────────
# Boss System
# ──────────────────────────────────────────────

class BossPhase(BaseModel):
    """Configuration for a single boss phase.

    §5.1: Bosses shift principle + pressure between phases.
    """

    phase_number: int
    name: str                                    # "Stone Shield", "Quake Fury"
    hp_threshold: float                          # 0.0-1.0, when this phase activates
    dominant_principle: str                       # Changes per phase
    stability_pressure: str = "medium"           # "low" | "medium" | "high"
    special_mechanic: str = ""                   # Phase-specific rule
    tell_pattern: str = ""                       # Narrative hint for player to read
    environmental_modifier: dict = Field(default_factory=dict)


class BossTemplate(BaseModel):
    """Full boss definition loaded from JSON data files.

    §5.1: Multi-phase bosses with principle shifts and tell patterns.
    """

    boss_id: str
    name: str
    floor: int
    primary_principle: str
    secondary_principle: str = ""
    enemy_type: str = "structural"               # EnemyType value
    phases: list[BossPhase] = Field(default_factory=list)
    base_hp: float = 100.0
    base_stability: float = 100.0
    resistances: dict[str, float] = Field(default_factory=dict)
    weaknesses: dict[str, float] = Field(default_factory=dict)
    lore_description: str = ""                   # For Writer context

    def get_phase(self, phase_number: int) -> BossPhase | None:
        """Get phase data by number (1-indexed)."""
        for phase in self.phases:
            if phase.phase_number == phase_number:
                return phase
        return None


# ──────────────────────────────────────────────
# Player Combat Input
# ──────────────────────────────────────────────

class CombatApproach(BaseModel):
    """Player's chosen approach for a combat phase.

    §6.1: Player picks action + intensity at each decision point.
    """

    action: CombatAction = CombatAction.STRIKE
    intensity: str = "safe"                      # Intensity enum value
    skill_name: str = ""                         # Equipped skill used


# ──────────────────────────────────────────────
# Decision Points (embedded in prose as choices)
# ──────────────────────────────────────────────

class DecisionPointChoice(BaseModel):
    """A single combat choice at a decision point.

    §6.2: Mapped to Choice model for frontend display.
    Each choice = action + intensity combination with narrative hint.
    """

    action: CombatAction
    intensity: str = "safe"                      # Intensity enum value
    risk_level: int = Field(default=1, ge=1, le=5)
    hint: str = ""                               # "Boss đang tích năng lượng..."
    stability_preview: str = ""                  # "Stability: 72% → ~55%"
    boss_tell: str = ""                          # "Dây xích ánh sáng đang hình thành..."

    def to_choice_text(self) -> str:
        """Generate display text for Choice model."""
        action_labels = {
            "strike": "⚔️ Tấn Công",
            "shift": "🔄 Chuyển Hóa",
            "stabilize": "🛡️ Ổn Định",
        }
        intensity_labels = {
            "safe": "— Thận Trọng",
            "push": "— Dồn Sức",
            "overdrive": "— Toàn Lực",
        }
        label = action_labels.get(self.action.value, self.action.value)
        int_label = intensity_labels.get(self.intensity, "")
        return f"{label} {int_label}".strip()


class DecisionPoint(BaseModel):
    """A combat decision point embedded in prose.

    §6.2: Between phases, player chooses action + intensity.
    Rendered as 3 Choice options in the scene UI.
    """

    phase_after: int                             # Which phase follows this decision
    context: str = ""                            # Narrative context (boss tell, situation)
    choices: list[DecisionPointChoice] = Field(default_factory=list, max_length=3)


# ──────────────────────────────────────────────
# Phase Result
# ──────────────────────────────────────────────

class PhaseResult(BaseModel):
    """Result of a single combat phase.

    §6.1: Deterministic outcome computed by engine.
    Writer uses this to generate phase prose.
    """

    phase_number: int
    outcome: str = "mixed"                       # "favorable" | "mixed" | "unfavorable"
    combat_score: float = 0.0

    # Player action taken
    action_taken: str = "strike"                 # CombatAction value
    intensity_used: str = "safe"                 # Intensity value

    # Damage dealt
    structural_damage_dealt: float = 0.0
    stability_damage_dealt: float = 0.0

    # State after phase
    player_hp_remaining: float = 100.0
    player_stability_remaining: float = 100.0
    enemy_hp_remaining: float = 100.0
    enemy_stability_remaining: float = 100.0

    # Events
    backlash_occurred: bool = False
    backlash_description: str = ""
    phase_shifted: bool = False                  # Boss shifted to next phase
    skill_activated: bool = False
    skill_activation_description: str = ""
    stability_tier_changed: bool = False         # Player/enemy tier shifted
    fate_buffer_triggered: bool = False
    adapt_bonus_next_phase: float = 0.0          # Carry-over from Shift action

    # For Writer
    narrative_cues: list[str] = Field(default_factory=list)
    boss_tell_for_next: str = ""                 # Tell pattern for next phase


# ──────────────────────────────────────────────
# Multi-Phase Combat Brief (V2)
# ──────────────────────────────────────────────

class CombatBriefV2(BaseModel):
    """Complete multi-phase combat brief for Writer.

    §7: Engine computes all phases → Writer transforms to cinematic prose.
    Extends flat CombatBrief with multi-phase support.
    """

    # Encounter info
    encounter_type: str = "minor"                # EncounterType value
    enemy_name: str = ""
    enemy_type: str = ""                         # EnemyType value
    enemy_description: str = ""
    enemy_principle: str = ""

    # Boss data (None for minor/duel)
    boss_id: str | None = None
    boss_template_name: str = ""

    # Phase results (filled incrementally as player makes decisions)
    phases: list[PhaseResult] = Field(default_factory=list)
    decision_points: list[DecisionPoint] = Field(default_factory=list)

    # Current state (updated after each phase)
    current_phase: int = 1
    total_phases: int = 1
    is_complete: bool = False

    # Final outcome (filled after all phases)
    final_outcome: str = ""                      # "player_wins" | "enemy_wins" | "draw" | "fate_save"
    player_state_after: dict = Field(default_factory=dict)

    # Impact on game state
    total_stability_cost: float = 0.0
    total_hp_cost: float = 0.0
    resonance_growth: float = 0.0
    resonance_principle: str = ""
    instability_gained: float = 0.0
    identity_impact: str = ""
    narrative_consequences: list[str] = Field(default_factory=list)
    floor_progress: bool = False

    # Skill info (carried from existing CombatBrief)
    player_skill_name: str = ""
    player_skill_mechanic: str = ""
    player_principle: str = ""
    unique_skill_active: bool = False
    unique_skill_name: str = ""
    unique_skill_outcome: str = "full"
    unique_skill_narrative: str = ""

    # Principle interaction
    principle_advantage: str = ""                # "strong" | "weak" | "neutral" | "synergy"
    advantage_description: str = ""

    # Fate Buffer
    fate_fired: bool = False                     # True if Fate Buffer saved player mid-combat


class CombatResult(BaseModel):
    """Final combat result for IdentityDelta and state updates.

    §11: Connects combat outcome to identity system.
    """

    winner: str = "draw"                         # "player" | "enemy" | "draw" | "fate_buffer_save"
    encounter_type: str = "minor"
    decision_count: int = 0                      # How many decision points player faced

    # State changes
    hp_remaining: float = 100.0
    stability_remaining: float = 100.0
    instability_gained: float = 0.0

    # Identity impact
    dqs_change: float = 0.0                      # Combat smart → DQS up
    coherence_change: float = 0.0                # Fighting aligned with identity?
    breakthrough_change: float = 0.0             # High-risk combat → breakthrough meter

    # Rewards (narrative, not items)
    narrative_consequences: list[str] = Field(default_factory=list)
    floor_progress: bool = False


# ──────────────────────────────────────────────
# Floor / Environment Modifiers
# ──────────────────────────────────────────────

class FloorModifier(BaseModel):
    """Environment modifiers for a floor/location.

    §3.4: Locations buff/nerf specific principles.
    """

    floor: int = 1
    location_name: str = ""
    principle_buffs: dict[str, float] = Field(default_factory=dict)   # e.g. {"matter": 0.1}
    principle_nerfs: dict[str, float] = Field(default_factory=dict)   # e.g. {"void": -0.1}
    stability_modifier: float = 0.0              # Passive stability drain/gain
    description: str = ""                        # "Rừng Thạch — đá quý cộng hưởng Matter"

    def get_modifier(self, principle: str) -> float:
        """Get net modifier for a principle in this location."""
        buff = self.principle_buffs.get(principle, 0.0)
        nerf = self.principle_nerfs.get(principle, 0.0)
        return buff + nerf
