"""Amoisekai — Adaptive Engine models.

Play style tracking, archetype evolution state,
and the unified AdaptiveContext for AI prompt injection.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Play Style State (5 Behavioral Axes)
# ──────────────────────────────────────────────

class PlayStyleState(BaseModel):
    """5 hidden behavioral axes — tracked per chapter.

    Updated by play_style_engine after each chapter.
    All values 0-100.  Seeded from BehavioralFingerprint.
    """

    risk_appetite: int = 50          # 0=cautious, 100=reckless
    alliance_tendency: int = 50      # 0=solo, 100=community builder
    curiosity_depth: int = 50        # 0=main-path only, 100=deep explorer
    moral_axis: int = 50             # 0=pragmatic, 100=idealistic
    combat_preference: int = 50      # 0=diplomatic, 100=combat-first


# ──────────────────────────────────────────────
# Archetype Tier Enum
# ──────────────────────────────────────────────

class ArchetypeTier(int, Enum):
    """Evolution tier of the player's archetype."""

    ORIGIN = 1          # Tầng 1 — Khởi Nguyên
    TRANSMUTED = 2      # Tầng 2 — Chuyển Hóa
    ASCENDANT = 3       # Tầng 3 — Siêu Việt
    LEGENDARY = 4       # Tầng 4 — Truyền Thuyết (Season 2+)


# ──────────────────────────────────────────────
# Transmuted Archetype Enum
# ──────────────────────────────────────────────

class TransmutedArchetype(str, Enum):
    """18 possible transmuted forms (3 per origin archetype)."""

    # Vanguard branches
    BULWARK = "bulwark"
    RAVAGER = "ravager"
    SENTINEL = "sentinel"
    # Catalyst branches
    ARCHITECT = "architect"
    TEMPEST = "tempest"
    WEAVER = "weaver"
    # Sovereign branches
    ARBITER = "arbiter"
    TYRANT = "tyrant"
    SHEPHERD = "shepherd"
    # Seeker branches
    ORACLE = "oracle"
    HERETIC = "heretic"
    ARCHIVIST = "archivist"
    # Tactician branches
    STRATEGIST = "strategist"
    SHADOW_BROKER = "shadow_broker"
    DIPLOMAT = "diplomat"
    # Wanderer branches
    NOMAD_KING = "nomad_king"
    PHANTOM = "phantom"
    PATHFINDER = "pathfinder"


# ──────────────────────────────────────────────
# Archetype Evolution State
# ──────────────────────────────────────────────

class ArchetypeEvolutionState(BaseModel):
    """Tracks a player's archetype evolution across tiers.

    Phase 1 covers Origin → Transmuted only.
    Ascendant (Tier 3) and Legendary (Tier 4) are stubs.
    """

    # Current tier
    current_tier: ArchetypeTier = ArchetypeTier.ORIGIN

    # Tier 2 — Transmuted
    transmuted_form: str = ""            # TransmutedArchetype value
    transmutation_path: str = ""         # "alignment" | "divergence"
    archetype_title: str = ""            # VN display name (e.g. "Thành Lũy")

    # Tier 3 — Ascendant (stub for Phase 2+)
    ascendant_form: str = ""             # AscendantArchetype value
    ascendant_title: str = ""            # "[Danh Xưng] — [Epithet]"

    # Tracking
    transmutation_chapter: int = 0       # Which chapter transmutation happened
    ascension_chapter: int = 0           # Which chapter ascension happened


# ──────────────────────────────────────────────
# Empire Threat Tier
# ──────────────────────────────────────────────

class EmpireThreatTier(str, Enum):
    """Empire reaction level based on archetype tier."""

    WATCHER = "watcher"              # Tầng 1 — passive observation
    ENFORCEMENT = "enforcement"      # Tầng 2 — active conflict
    GENERAL_NOTICE = "general_notice" # Tầng 3 — direct confrontation


# ──────────────────────────────────────────────
# Adaptive Context (unified prompt injection)
# ──────────────────────────────────────────────

class AdaptiveContext(BaseModel):
    """Assembled context for AI Writer/Planner prompts.

    Built from PlayerState by adaptive_context_builder.
    Contains everything the AI needs to personalize content.
    """

    # ── Archetype & Play Style ──
    archetype: str = ""                      # Origin archetype value
    seed_archetype: str = ""                 # Same as archetype (never changes)
    play_style: PlayStyleState = Field(default_factory=PlayStyleState)

    # ── Archetype Evolution ──
    archetype_tier: int = 1                  # ArchetypeTier value
    transmuted_form: str = ""                # TransmutedArchetype value or ""
    transmutation_path: str = ""             # "alignment" | "divergence" | ""
    archetype_title: str = ""                # Display name

    # ── Progression ──
    current_act: int = 1                     # 1-4
    current_milestone: str = ""              # "M1.1", "M2.4", etc.
    current_rank: int = 1
    current_floor: int = 1                   # Tower floor (1-5)

    # ── Identity State ──
    identity_coherence: float = 100.0
    identity_instability: float = 0.0
    identity_anchor: int = 0                 # Anchoring score
    drift_history: list[str] = Field(default_factory=list)
    nce_approaching: bool = False            # Near NCE trigger
    nce_completed: bool = False              # NCE already happened this story

    # ── Unique Skill Growth ──
    unique_skill_stage: str = "seed"         # "seed" | "bloom" | "aspect" | "ultimate"
    bloom_path: str = ""                     # "echo" | "scar" | ""

    # ── Villain Assignment ──
    assigned_emissary: str = ""              # NPC name
    assigned_general: str = ""               # NPC name
    assigned_lieutenant: str = ""            # NPC name
    emissary_sympathy: int = 0               # 0-100 — how much player trusts emissary
    empire_threat_tier: str = "watcher"      # EmpireThreatTier value
    empire_resonance: int = 0                # Empire resonance score
