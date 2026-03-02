"""Models package."""

from app.models.story import (
    Chapter,
    ChapterResponse,
    Choice,
    ChoiceResponse,
    ContinueRequest,
    PreferenceTag,
    StartRequest,
    StartResponse,
    Story,
    StoryStateResponse,
)

from app.models.player import (
    Archetype,
    CurrentIdentity,
    DNAAffinityTag,
    LatentIdentity,
    OnboardingRequest,
    OnboardingResponse,
    PlayerState,
    PlayerStateResponse,
    SeedIdentity,
    SkillCategory,
    UniqueSkill,
)

from app.models.identity import (
    IdentityDelta,
    IdentityEvent,
    IdentityEventType,
    PlayerFlag,
    apply_delta,
)

from app.models.soul_forge import (
    BehavioralFingerprint,
    IdentitySignals,
    SceneChoice,
    SceneData,
    SoulForgeChoiceRequest,
    SoulForgeForgeRequest,
    SoulForgeForgeResponse,
    SoulForgeFragmentRequest,
    SoulForgeSceneResponse,
    SoulForgeSession,
    SoulForgeStartRequest,
    SoulForgeStartResponse,
)

from app.models.weapon import (
    PlayerWeaponSlots,
    Weapon,
    WeaponBondEvent,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)

from app.models.adaptive import (
    AdaptiveContext,
    ArchetypeEvolutionState,
    ArchetypeTier,
    EmpireThreatTier,
    PlayStyleState,
    TransmutedArchetype,
)

__all__ = [
    # story
    "Chapter",
    "ChapterResponse",
    "Choice",
    "ChoiceResponse",
    "ContinueRequest",
    "PreferenceTag",
    "StartRequest",
    "StartResponse",
    "Story",
    "StoryStateResponse",
    # player
    "Archetype",
    "CurrentIdentity",
    "DNAAffinityTag",
    "LatentIdentity",
    "OnboardingRequest",
    "OnboardingResponse",
    "PlayerState",
    "PlayerStateResponse",
    "SeedIdentity",
    "SkillCategory",
    "UniqueSkill",
    # identity
    "IdentityDelta",
    "IdentityEvent",
    "IdentityEventType",
    "PlayerFlag",
    "apply_delta",
    # soul forge
    "BehavioralFingerprint",
    "IdentitySignals",
    "SceneChoice",
    "SceneData",
    "SoulForgeChoiceRequest",
    "SoulForgeForgeRequest",
    "SoulForgeForgeResponse",
    "SoulForgeFragmentRequest",
    "SoulForgeSceneResponse",
    "SoulForgeSession",
    "SoulForgeStartRequest",
    "SoulForgeStartResponse",
    # weapon
    "CraftingMaterial",
    "MonsterCore",
    "MonsterCoreTier",
    "PlayerWeaponSlots",
    "Weapon",
    "WeaponBondEvent",
    "WeaponGrade",
    "WeaponLore",
    "WeaponOrigin",
    # adaptive
    "AdaptiveContext",
    "ArchetypeEvolutionState",
    "ArchetypeTier",
    "EmpireThreatTier",
    "PlayStyleState",
    "TransmutedArchetype",
]

