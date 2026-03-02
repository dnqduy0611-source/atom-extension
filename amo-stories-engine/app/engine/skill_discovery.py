"""Amoisekai — Skill Discovery & Reward Service.

Manages how players find, accept/reject, equip, and manage normal skills.
All normal skills come from story events — no skills at game start.

Ref: SKILL_CATALOG_SPEC v1.0 §4
"""

from __future__ import annotations

import random
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from app.models.skill_catalog import (
    SKILL_CATALOG,
    NarrativeSkin,
    PlayerSkill,
    SkillArchetype,
    SkillSkeleton,
    get_skills_by_principle,
)


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

MAX_EQUIPPED_SLOTS = 5          # 1 Unique + 4 Normal (ref SKILL_CATALOG_SPEC §4.5)
MAX_NORMAL_SLOTS = 4            # Normal-only portion
MIN_CHAPTERS_BETWEEN_REWARDS = 2
EARLY_GAME_REWARD_INTERVAL = 2  # Chapters between skill rewards (Rank 1-2)
LATE_GAME_REWARD_INTERVAL = 4   # Chapters between skill rewards (Rank 3+)

PRINCIPLES = ["order", "entropy", "matter", "flux", "energy", "void"]


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class SkillSource(str, Enum):
    """How the player found this skill."""

    FLOOR_CLEAR = "floor_clear"
    FLOOR_BOSS = "floor_boss"
    TOWER_EXPLORATION = "tower_exploration"
    NPC_ENCOUNTER = "npc_encounter"
    TRAINING_AWAKENING = "training_awakening"
    CRNG_BREAKTHROUGH = "crng_breakthrough"
    LORE_SECRET = "lore_secret"


class SkillDiscoveryAction(str, Enum):
    """Player's response to a skill discovery."""

    ACCEPT = "accept"
    REJECT = "reject"


# ──────────────────────────────────────────────
# Discovery Result
# ──────────────────────────────────────────────

class SkillDiscovery(BaseModel):
    """A skill discovery event — presented to the player for accept/reject."""

    skeleton_id: str
    skeleton: SkillSkeleton
    source: SkillSource
    narrative_context: str = ""         # Why this skill appeared
    chapter_discovered: int = 0


class SkillRewardPlan(BaseModel):
    """Planner output — instruction to reward a skill in a chapter."""

    should_reward: bool = False
    candidate_ids: list[str] = Field(default_factory=list)
    source: SkillSource = SkillSource.FLOOR_CLEAR
    narrative_hint: str = ""


# ──────────────────────────────────────────────
# Core Service Functions
# ──────────────────────────────────────────────

def plan_skill_reward(
    owned_skill_ids: list[str],
    resonance: dict[str, float],
    total_chapters: int,
    chapters_since_last_skill: int,
    current_rank: int,
    current_floor: int,
    combat_count_since_rest: int = 0,
    has_crng_breakthrough: bool = False,
) -> SkillRewardPlan:
    """Decide whether this chapter should offer a skill reward.

    Called by the Planner before generating chapter beats.

    Returns a SkillRewardPlan: if should_reward=True, the Planner
    creates a discovery beat in the chapter outline.
    """
    reward_interval = (
        EARLY_GAME_REWARD_INTERVAL
        if current_rank <= 2
        else LATE_GAME_REWARD_INTERVAL
    )

    # ── Check timing ──
    if chapters_since_last_skill < MIN_CHAPTERS_BETWEEN_REWARDS:
        return SkillRewardPlan(should_reward=False)

    # ── Determine source & principle ──

    # CRNG Breakthrough — highest priority (rare event)
    if has_crng_breakthrough:
        principle = _weighted_random_principle(resonance)
        candidates = _find_candidates(principle, owned_skill_ids)
        if candidates:
            return SkillRewardPlan(
                should_reward=True,
                candidate_ids=[c.id for c in candidates[:3]],
                source=SkillSource.CRNG_BREAKTHROUGH,
                narrative_hint="Breakthrough moment — instinct awakens",
            )

    # Training Awakening — high priority if lots of combat
    if combat_count_since_rest >= 3:
        principle = _find_underrepresented_principle(owned_skill_ids, resonance)
        candidates = _find_candidates(principle, owned_skill_ids)
        if candidates:
            return SkillRewardPlan(
                should_reward=True,
                candidate_ids=[c.id for c in candidates[:3]],
                source=SkillSource.TRAINING_AWAKENING,
                narrative_hint="Body remembers what mind forgot",
            )

    # Regular interval — floor/exploration/NPC
    if chapters_since_last_skill >= reward_interval:
        principle = _find_underrepresented_principle(owned_skill_ids, resonance)
        candidates = _find_candidates(principle, owned_skill_ids)
        if not candidates:
            # Try any principle the player has resonance with
            for p in _sorted_principles_by_resonance(resonance):
                candidates = _find_candidates(p, owned_skill_ids)
                if candidates:
                    break

        if candidates:
            # Determine source from context
            source = SkillSource.TOWER_EXPLORATION
            return SkillRewardPlan(
                should_reward=True,
                candidate_ids=[c.id for c in candidates[:3]],
                source=source,
                narrative_hint=f"Discovery on floor {current_floor}",
            )

    return SkillRewardPlan(should_reward=False)


def create_discovery(
    skeleton_id: str,
    source: SkillSource,
    narrative_context: str = "",
    chapter: int = 0,
) -> SkillDiscovery:
    """Create a skill discovery event to present to the player."""
    skeleton = SKILL_CATALOG.get(skeleton_id)
    if skeleton is None:
        raise ValueError(f"Unknown skill ID: {skeleton_id}")

    return SkillDiscovery(
        skeleton_id=skeleton_id,
        skeleton=skeleton,
        source=source,
        narrative_context=narrative_context,
        chapter_discovered=chapter,
    )


def accept_skill(
    discovery: SkillDiscovery,
    owned_skills: list[PlayerSkill],
    narrative: NarrativeSkin | None = None,
) -> PlayerSkill:
    """Player accepts a discovered skill — add to owned inventory.

    Returns the new PlayerSkill.
    Raises ValueError if player already owns this skeleton.
    """
    # Check for duplicates
    for ps in owned_skills:
        if ps.skeleton_id == discovery.skeleton_id:
            raise ValueError(
                f"Player already owns skill: {discovery.skeleton_id}"
            )

    return PlayerSkill(
        skeleton_id=discovery.skeleton_id,
        narrative=narrative or NarrativeSkin(),
    )


def reject_skill(discovery: SkillDiscovery) -> None:
    """Player rejects a discovered skill — do nothing, move on."""
    # No-op: skill is simply not added.
    # Future: could log for analytics / narrative callbacks.
    pass


def equip_skill(
    skill_id: str,
    owned_skills: list[PlayerSkill],
    equipped_ids: list[str],
) -> list[str]:
    """Equip a skill from inventory to an equipped slot.

    Returns updated equipped_ids list.
    Raises ValueError if skill not owned or slots full.
    """
    # Verify ownership
    if not any(ps.skeleton_id == skill_id for ps in owned_skills):
        raise ValueError(f"Player does not own skill: {skill_id}")

    # Check if already equipped
    if skill_id in equipped_ids:
        raise ValueError(f"Skill already equipped: {skill_id}")

    # Check slot limit
    if len(equipped_ids) >= MAX_NORMAL_SLOTS:
        raise ValueError(
            f"All {MAX_NORMAL_SLOTS} normal skill slots are full. "
            "Unequip a skill first or integrate to free a slot."
        )

    return [*equipped_ids, skill_id]


def unequip_skill(
    skill_id: str,
    equipped_ids: list[str],
) -> list[str]:
    """Unequip a skill — returns updated equipped list."""
    if skill_id not in equipped_ids:
        raise ValueError(f"Skill not equipped: {skill_id}")
    return [eid for eid in equipped_ids if eid != skill_id]


def integration_slot_recovery(
    consumed_ids: list[str],
    new_tier2_id: str,
    equipped_ids: list[str],
) -> list[str]:
    """After Integration merges 2 skills into 1 Tier 2.

    Removes the 2 consumed skills from equipped,
    adds the new Tier 2 skill, leaving 1 slot free.
    """
    result = [eid for eid in equipped_ids if eid not in consumed_ids]
    result.append(new_tier2_id)
    return result


# ──────────────────────────────────────────────
# Internal Helpers
# ──────────────────────────────────────────────

def _find_candidates(
    principle: str,
    owned_skill_ids: list[str],
) -> list[SkillSkeleton]:
    """Find catalog skills for a principle that the player doesn't own."""
    return [
        sk for sk in get_skills_by_principle(principle)
        if sk.id not in owned_skill_ids
    ]


def _find_underrepresented_principle(
    owned_skill_ids: list[str],
    resonance: dict[str, float],
) -> str:
    """Find the principle with highest resonance but fewest owned skills.

    Prioritizes principles the player has affinity for but hasn't explored.
    """
    count_by_principle: dict[str, int] = {p: 0 for p in PRINCIPLES}
    for sid in owned_skill_ids:
        sk = SKILL_CATALOG.get(sid)
        if sk:
            count_by_principle[sk.principle] = (
                count_by_principle.get(sk.principle, 0) + 1
            )

    # Sort by: (lowest owned count first, then highest resonance)
    scored = [
        (p, count_by_principle.get(p, 0), resonance.get(p, 0.0))
        for p in PRINCIPLES
        if resonance.get(p, 0.0) > 0
    ]
    scored.sort(key=lambda x: (x[1], -x[2]))

    if not scored:
        return random.choice(PRINCIPLES)

    return scored[0][0]


def _weighted_random_principle(resonance: dict[str, float]) -> str:
    """Pick a random principle weighted by resonance values."""
    principles = list(resonance.keys())
    weights = [resonance.get(p, 0.0) for p in principles]
    total = sum(weights)
    if total == 0:
        return random.choice(PRINCIPLES)
    return random.choices(principles, weights=weights, k=1)[0]


def _sorted_principles_by_resonance(
    resonance: dict[str, float],
) -> list[str]:
    """Return principles sorted by resonance descending."""
    return sorted(
        PRINCIPLES,
        key=lambda p: resonance.get(p, 0.0),
        reverse=True,
    )
