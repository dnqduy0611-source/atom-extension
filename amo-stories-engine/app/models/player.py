"""Amoisekai — Player state, identity, and DNA affinity models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator

from app.models.unique_skill_growth import (
    PrincipleResonance,
    UniqueSkillGrowthState,
)

from app.models.seal import SealState
from app.models.progression import PlayerProgression
from app.models.skill_evolution import (
    SkillEvolutionState,
    ResonanceMasteryState,
)
from app.models.weapon import PlayerWeaponSlots
from app.models.adaptive import (
    ArchetypeEvolutionState,
    PlayStyleState,
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _player_id() -> str:
    return uuid4().hex[:12]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# DNA Affinity
# ──────────────────────────────────────────────

class DNAAffinityTag(str, Enum):
    """Hidden affinity tags that bias AI skill/item generation.

    Each player gets 3 tags from onboarding quiz.
    AI generates: 70% synergistic with DNA, 30% outlier.
    """

    SHADOW = "shadow"           # Stealth, assassination, void
    OATH = "oath"               # Loyalty, contracts, binding
    BLOODLINE = "bloodline"     # Heritage, cultivation, body
    TECH = "tech"               # Artifacts, mechanisms, logic
    CHAOS = "chaos"             # Destruction, unpredictability
    MIND = "mind"               # Psychic, intelligence, analysis
    CHARM = "charm"             # Social, persuasion, manipulation
    RELIC = "relic"             # Ancient power, forbidden knowledge


# ──────────────────────────────────────────────
# Archetype
# ──────────────────────────────────────────────

class Archetype(str, Enum):
    """Origin archetype — how the character approaches the world.

    Not a class lock. Only biases early arc 20-30%.
    Can drift, blend, or dissolve over time.
    """

    VANGUARD = "vanguard"       # Đối diện trực tiếp
    CATALYST = "catalyst"       # Thay đổi môi trường
    SOVEREIGN = "sovereign"     # Ảnh hưởng con người
    SEEKER = "seeker"           # Khai thác bí ẩn
    TACTICIAN = "tactician"     # Thao túng cục diện
    WANDERER = "wanderer"       # Sống ngoài hệ thống

    @property
    def display_name(self) -> str:
        names = {
            "vanguard": "Tiên Phong",
            "catalyst": "Xúc Tác",
            "sovereign": "Chủ Tể",
            "seeker": "Tầm Đạo",
            "tactician": "Mưu Sĩ",
            "wanderer": "Lãng Khách",
        }
        return names.get(self.value, self.value)

    @property
    def description(self) -> str:
        descs = {
            "vanguard": "Đối diện mọi thứ trực tiếp, không né tránh",
            "catalyst": "Thay đổi thế giới xung quanh thay vì chính mình",
            "sovereign": "Dẫn dắt và ảnh hưởng người khác",
            "seeker": "Tìm kiếm tri thức và bí mật ẩn giấu",
            "tactician": "Tính toán và thao túng cục diện",
            "wanderer": "Tự do, không ràng buộc bởi hệ thống",
        }
        return descs.get(self.value, "")


# ──────────────────────────────────────────────
# Unique Skill System V2
# ──────────────────────────────────────────────

class SkillCategory(str, Enum):
    """5 skill archetypes from GDD.

    Balance triangle: Perception ↔ Obfuscation ↔ Suppression.
    Each archetype maps to a primary category.
    """

    MANIFESTATION = "manifestation"   # Direct power expression
    MANIPULATION = "manipulation"     # Alter environment/people
    CONTRACT = "contract"             # Binding agreements, oaths
    PERCEPTION = "perception"         # Sensing, analysis, detection
    OBFUSCATION = "obfuscation"       # Hiding, stealth, misdirection

    @property
    def display_name(self) -> str:
        names = {
            "manifestation": "Hiện Thực Hóa",
            "manipulation": "Thao Túng",
            "contract": "Khế Ước",
            "perception": "Linh Giác",
            "obfuscation": "Ẩn Giấu",
        }
        return names.get(self.value, self.value)

    @property
    def icon(self) -> str:
        icons = {
            "manifestation": "⚔️",
            "manipulation": "🌀",
            "contract": "📜",
            "perception": "👁️",
            "obfuscation": "🌑",
        }
        return icons.get(self.value, "✨")


class SubSkill(BaseModel):
    """A sub-skill within a Unique Skill ecosystem.

    Sub-skills unlock progressively through growth stages:
    - Seed: SS0 (Domain Passive) — always-on
    - Bloom: SS1 (Active or Reactive) — first real ability
    - Aspect: SS2 (Active) + SS3 (Passive) — aspect-specific
    - Ultimate: All merged + transcended
    """

    name: str = ""                    # Vietnamese name
    type: str = ""                    # "passive" | "active" | "reactive"
    mechanic: str = ""                # How it works
    cost: str = ""                    # Stability cost or trigger condition
    trigger: str = ""                 # For reactive: when auto-activates
    unlocked_at: str = ""             # "seed" | "bloom" | "aspect" | "ultimate"


class UniqueSkill(BaseModel):
    """AI-generated unique skill from Seed Identity + DNA Affinity.

    V2: Sub-skill ecosystem + Domain Authority + Axis Weakness.

    Rules:
    - Secret by default (is_revealed = False)
    - Skill tied to identity — instability rises if player drifts
    - Cannot be stolen (identity = soul)
    - 1 Unique Skill per player, evolves Seed → Ultimate
    """

    name: str = ""                              # AI-generated Vietnamese name
    description: str = ""                       # 1-2 sentences
    category: str = ""                          # SkillCategory value
    trait_tags: list[str] = Field(default_factory=list)   # DNA tags this aligns with
    countered_by: list[str] = Field(default_factory=list) # Categories that counter
    resilience: float = 100.0                   # Internal skill health — degrades with identity drift (FAILURE_SPEC)
    instability: float = 0.0                    # Rises when living against identity
    suppression_resistance: float = 50.0        # External counter resistance — scales with growth stage (CONTROL_SYSTEM)
    is_revealed: bool = False                   # Secret by default
    activation_cost: str = ""                   # Flavor text

    # ── Soul Forge fields (V1, retained) ──
    mechanic: str = ""                          # Core mechanic with quirk
    limitation: str = ""                        # Specific limitation
    weakness: str = ""                          # Weakness description (customized)
    activation_condition: str = ""              # Trigger condition
    soul_resonance: str = ""                    # Why this skill belongs to this player
    evolution_hint: str = ""                    # Hidden — AI compass for growth
    uniqueness_score: float = 1.0               # 0-1, how unique vs DB
    forge_timestamp: datetime | None = None     # When skill was forged

    # ── V2: Sub-skill ecosystem ──
    sub_skills: list[SubSkill] = Field(default_factory=list)  # SS0 at seed, grows

    # ── V2: Domain Authority ──
    domain_category: str = ""                   # Same as category
    domain_passive_name: str = ""               # SS0 name
    domain_passive_mechanic: str = ""           # SS0 effect

    # ── V2: Weakness (structured) ──
    weakness_type: str = ""                     # 1 of 7 taxonomy types
    axis_blind_spot: str = ""                   # Structural category weakness

    # ── V2: Unique Clause ──
    unique_clause: str = ""                     # What Normal Skill can never do

    # ── V2: Growth stage ──
    current_stage: str = "seed"                 # seed | bloom | aspect | ultimate


# ──────────────────────────────────────────────
# Identity Models
# ──────────────────────────────────────────────

class SeedIdentity(BaseModel):
    """Created once during onboarding quiz. Never deleted.

    This is the "Echo of Origin" — it always leaves traces
    even after mutation. echo_trace measures how much.
    """

    core_values: list[str] = Field(
        default_factory=list,
        description='Ví dụ: ["loyalty", "freedom", "knowledge"]',
    )
    personality_traits: list[str] = Field(
        default_factory=list,
        description='Ví dụ: ["cautious", "analytical", "protective"]',
    )
    motivation: str = ""        # "Tìm kiếm sức mạnh để bảo vệ"
    fear: str = ""              # "Mất đi người thân"
    origin_story: str = ""      # 2-3 câu do AI generate


class CurrentIdentity(BaseModel):
    """Updated after every chapter by the Identity Agent.

    Reflects who the player IS right now based on actions.
    """

    active_values: list[str] = Field(default_factory=list)
    active_traits: list[str] = Field(default_factory=list)
    current_motivation: str = ""
    reputation_tags: list[str] = Field(
        default_factory=list,
        description='Ví dụ: ["merciful", "ruthless", "cunning"]',
    )
    power_style: str = ""       # combat | influence | strategic


class LatentIdentity(BaseModel):
    """Emerging trends detected by Identity Agent.

    When drift becomes significant → triggers Narrative Confrontation.
    """

    emerging_traits: list[str] = Field(default_factory=list)
    drift_direction: str = ""   # "toward_ruthless" | "toward_compassion"
    trigger_events: list[str] = Field(
        default_factory=list,
        description="Events that caused the drift",
    )


# ──────────────────────────────────────────────
# Player State
# ──────────────────────────────────────────────

class PlayerState(BaseModel):
    """Full player state — persisted to SQLite.

    One player can have multiple stories,
    but identity is shared across stories.
    """

    id: str = Field(default_factory=_player_id)
    user_id: str = ""
    name: str = ""                  # Player-chosen character name
    gender: str = "neutral"         # "male" | "female" | "neutral"

    # ── Identity ──
    seed_identity: SeedIdentity = Field(default_factory=SeedIdentity)
    current_identity: CurrentIdentity = Field(default_factory=CurrentIdentity)
    latent_identity: LatentIdentity = Field(default_factory=LatentIdentity)
    archetype: str = ""             # Archetype enum value
    dna_affinity: list[DNAAffinityTag] = Field(default_factory=list)
    unique_skill: UniqueSkill | None = None  # Generated during onboarding

    # ── V2: Unique Skill Growth ──
    unique_skill_growth: UniqueSkillGrowthState | None = None
    principle_resonance: PrincipleResonance | None = None  # SECRET

    # ── Seal / Anti-Unique Field ──
    active_seal: SealState | None = None

    # ── Skill Evolution (SKILL_EVOLUTION_SPEC v1.1) ──
    skill_evolution: SkillEvolutionState = Field(default_factory=SkillEvolutionState)
    resonance_mastery: ResonanceMasteryState = Field(default_factory=ResonanceMasteryState)

    # ── Adaptive Engine (PHASE1_ADAPTIVE_ENGINE) ──
    play_style: PlayStyleState = Field(default_factory=PlayStyleState)
    archetype_evolution: ArchetypeEvolutionState = Field(
        default_factory=ArchetypeEvolutionState,
    )
    identity_anchor: int = 0                # Anchoring score (0-100)
    empire_resonance: int = 0               # Empire alignment resonance score
    emissary_sympathy: int = 0              # Emissary trust/sympathy (0-100)

    # ── Scores (0-100 unless noted) ──
    echo_trace: float = 100.0              # Starts max, decays with mutation
    identity_coherence: float = 100.0      # Drops when behavior contradicts seed
    instability: float = 0.0               # Rises when coherence drops
    decision_quality_score: float = 50.0   # DQS: consistency + strategy
    breakthrough_meter: float = 0.0        # Fills with risk-taking
    nce_completed: bool = False             # NCE already happened this story
    notoriety: float = 0.0                 # Visibility to NPC threats
    pity_counter: int = 0                  # Chapters since last major event

    # ── Power System ──
    resonance: dict[str, float] = Field(
        default_factory=dict,
        description="Per-principle resonance: {'energy': 0.25, 'order': 0.3}",
    )
    stability: float = 100.0               # Resource pool (defense + mana + sanity)
    hp: float = 100.0                      # Health points
    hp_max: float = 100.0                  # Max HP — decreases permanently with scars
    current_floor: int = 1                 # Tower floor (1-5)
    equipped_skills: list[dict] = Field(
        default_factory=list,
        description="Equipped NormalSkill dicts — max 4 normal slots + 1 Unique",
    )
    owned_skills: list[dict] = Field(
        default_factory=list,
        description="All owned PlayerSkill dicts — unlimited inventory",
    )
    chapters_since_last_skill: int = 0
    combat_count_since_rest: int = 0

    # ── Weapon System (WEAPON_SYSTEM_SPEC v1.0) ──
    equipped_weapons: PlayerWeaponSlots = Field(default_factory=PlayerWeaponSlots)
    weapon_history: list[str] = Field(
        default_factory=list,
        description="IDs of weapons player has ever bonded with",
    )
    archon_affinity: dict[str, int] = Field(
        default_factory=dict,
        description="Archon affinity counters: max 5 keys (aethis/vyrel/morphael/dominar/seraphine)",
    )

    # ── Progress ──
    total_chapters: int = 0
    fate_buffer: float = 100.0             # Early-game protection, decays
    defeat_count: int = 0                  # Total defeats (4 = Soul Death)
    scars: list[dict] = Field(
        default_factory=list,
        description="Permanent defeat scars: [{type, hp_max_loss, penalty, source, chapter}]",
    )
    alignment: float = 0.0                 # -100 (dark) to +100 (light)
    turns_today: int = 0
    turns_reset_date: str = ""

    # ── Progression ──
    progression: PlayerProgression = Field(default_factory=PlayerProgression)

    # ── Meta ──
    brain_id: str = ""                     # NeuralMemory Brain ID
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    # ── Backward-Compat: migrate old current_rank int → progression ──

    @model_validator(mode="before")
    @classmethod
    def _migrate_current_rank(cls, data: dict) -> dict:  # type: ignore[override]
        """If old data has bare `current_rank`, move it to progression."""
        if isinstance(data, dict) and "current_rank" in data:
            rank_val = data.pop("current_rank")
            prog = data.get("progression")
            if prog is None:
                prog = {}
                data["progression"] = prog
            if isinstance(prog, dict) and "current_rank" not in prog:
                prog["current_rank"] = rank_val
        return data

    # ── Helpers ──

    @property
    def current_rank(self) -> int:
        """Single source of truth for rank. Delegates to progression."""
        return int(self.progression.current_rank)

    @property
    def is_early_game(self) -> bool:
        """Player is in early game (Fate Buffer active)."""
        return self.total_chapters < 40 and self.fate_buffer > 5.0

    @property
    def instability_critical(self) -> bool:
        """Instability high enough to trigger Narrative Confrontation."""
        return self.instability >= 70.0

    @property
    def breakthrough_ready(self) -> bool:
        """Breakthrough meter full enough for major event."""
        return self.breakthrough_meter >= 90.0

    @property
    def owned_skill_ids(self) -> list[str]:
        """IDs of all owned normal skills."""
        return [s.get("skeleton_id", "") for s in self.owned_skills if s]

    @property
    def equipped_skill_ids(self) -> list[str]:
        """IDs of equipped normal skills."""
        return [s.get("skeleton_id", s.get("id", "")) for s in self.equipped_skills if s]


# ──────────────────────────────────────────────
# API Models
# ──────────────────────────────────────────────

class OnboardingRequest(BaseModel):
    """Quiz answers from the onboarding flow."""

    user_id: str
    name: str = ""
    backstory: str = ""                 # Player's personal backstory (pre-isekai)
    quiz_answers: dict = Field(
        default_factory=dict,
        description="5 quiz question answers",
    )


class OnboardingResponse(BaseModel):
    """Result of onboarding — seed identity + archetype + DNA + unique skill."""

    player_id: str
    seed_identity: SeedIdentity
    archetype: str
    archetype_display: str
    dna_affinity: list[str]
    unique_skill: UniqueSkill | None = None


class PlayerStateResponse(BaseModel):
    """Public player state for API response."""

    id: str
    name: str
    gender: str = "neutral"
    archetype: str
    archetype_display: str
    dna_affinity: list[str] = Field(default_factory=list)
    unique_skill: dict | None = None
    total_chapters: int
    turns_today: int

    # Identity summary (not full details)
    echo_trace: float
    identity_coherence: float
    instability: float
    decision_quality_score: float
    breakthrough_meter: float
    alignment: float

    # Flags
    is_early_game: bool
    instability_critical: bool
    breakthrough_ready: bool
