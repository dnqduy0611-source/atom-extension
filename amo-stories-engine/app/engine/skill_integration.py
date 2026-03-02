"""Amoisekai — Skill Integration Engine.

Handles Tier 2 skill creation by merging two Tier 1 skills using
pre-defined PrinciplePairTemplates.

Flow:
1. Validate: both skills owned, different principles, template exists
2. Create Tier 2 skeleton from template + source skeletons
3. (Optional) AI wraps the result with narrative skin
4. Remove consumed skills, add Tier 2 to inventory

Ref: SKILL_CATALOG_SPEC v1.0 §6, SKILL_EVOLUTION_SPEC §5
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any

from pydantic import BaseModel, Field

from app.models.skill_catalog import (
    DamageType,
    DeliveryType,
    NarrativeSkin,
    PlayerSkill,
    PrinciplePairTemplate,
    SkillArchetype,
    SkillSkeleton,
    SKILL_CATALOG,
    get_pair_template,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

INSTABILITY_COSTS = {
    "low": 1.0,       # Adjacent pairs — synergy, stable
    "moderate": 3.0,   # Cross-cluster pairs — weak interaction
    "high": 5.0,       # Opposing pairs — high power, high instability
}


# ──────────────────────────────────────────────
# Integration Result
# ──────────────────────────────────────────────

class IntegrationResult(BaseModel):
    """Output of a successful skill integration."""

    tier2_skeleton: SkillSkeleton
    tier2_player_skill: PlayerSkill
    consumed_ids: list[str]
    instability_added: float
    power_multiplier: float


class IntegrationError(Exception):
    """Raised when integration cannot proceed."""
    pass


# ──────────────────────────────────────────────
# Core Integration Function
# ──────────────────────────────────────────────

def integrate_skills(
    skill_a_id: str,
    skill_b_id: str,
    owned_skills: list[PlayerSkill],
    narrative: NarrativeSkin | None = None,
) -> IntegrationResult:
    """Integrate two Tier 1 skills into a Tier 2 skill.

    Args:
        skill_a_id: First skill skeleton ID
        skill_b_id: Second skill skeleton ID
        owned_skills: Player's owned skills list
        narrative: Optional pre-generated NarrativeSkin

    Returns:
        IntegrationResult with new Tier 2 skill and metadata

    Raises:
        IntegrationError: if integration is invalid
    """
    # ── Validate ownership ──
    owned_ids = {ps.skeleton_id for ps in owned_skills}
    if skill_a_id not in owned_ids:
        raise IntegrationError(f"Player does not own skill: {skill_a_id}")
    if skill_b_id not in owned_ids:
        raise IntegrationError(f"Player does not own skill: {skill_b_id}")
    if skill_a_id == skill_b_id:
        raise IntegrationError("Cannot integrate a skill with itself")

    # ── Fetch skeletons ──
    skel_a = SKILL_CATALOG.get(skill_a_id)
    skel_b = SKILL_CATALOG.get(skill_b_id)
    if skel_a is None:
        raise IntegrationError(f"Skeleton not found: {skill_a_id}")
    if skel_b is None:
        raise IntegrationError(f"Skeleton not found: {skill_b_id}")

    # ── Validate different principles ──
    if skel_a.principle == skel_b.principle:
        raise IntegrationError(
            f"Both skills share principle '{skel_a.principle}'. "
            "Integration requires different principles."
        )

    # ── Find template ──
    template = get_pair_template(skel_a.principle, skel_b.principle)
    if template is None:
        raise IntegrationError(
            f"No integration template for pair: "
            f"({skel_a.principle}, {skel_b.principle})"
        )

    # ── Generate Tier 2 skeleton ──
    tier2_id = _generate_tier2_id(skill_a_id, skill_b_id)
    tier2_skeleton = _build_tier2_skeleton(
        skel_a, skel_b, template, tier2_id,
    )

    # ── Create PlayerSkill ──
    tier2_skill = PlayerSkill(
        skeleton_id=tier2_id,
        narrative=narrative or NarrativeSkin(
            display_name=f"{skel_a.catalog_name} + {skel_b.catalog_name}",
            description=template.flavor,
            discovery_line="Two powers became one.",
        ),
    )

    instability = INSTABILITY_COSTS.get(template.instability_cost, 3.0)

    return IntegrationResult(
        tier2_skeleton=tier2_skeleton,
        tier2_player_skill=tier2_skill,
        consumed_ids=[skill_a_id, skill_b_id],
        instability_added=instability,
        power_multiplier=template.power_multiplier,
    )


# ──────────────────────────────────────────────
# Validation Helpers
# ──────────────────────────────────────────────

def can_integrate(
    skill_a_id: str,
    skill_b_id: str,
    owned_skill_ids: list[str],
) -> tuple[bool, str]:
    """Check if two skills can be integrated.

    Returns (can_integrate: bool, reason: str).
    """
    if skill_a_id not in owned_skill_ids:
        return False, f"Not owned: {skill_a_id}"
    if skill_b_id not in owned_skill_ids:
        return False, f"Not owned: {skill_b_id}"
    if skill_a_id == skill_b_id:
        return False, "Same skill"

    skel_a = SKILL_CATALOG.get(skill_a_id)
    skel_b = SKILL_CATALOG.get(skill_b_id)
    if skel_a is None or skel_b is None:
        return False, "Skeleton not found"
    if skel_a.principle == skel_b.principle:
        return False, "Same principle"

    template = get_pair_template(skel_a.principle, skel_b.principle)
    if template is None:
        return False, "No template for pair"

    return True, "OK"


def get_integration_options(
    owned_skill_ids: list[str],
) -> list[tuple[str, str, PrinciplePairTemplate]]:
    """Get all valid integration pairs from owned skills.

    Returns list of (skill_a_id, skill_b_id, template) tuples.
    """
    results = []
    ids = list(owned_skill_ids)

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            skel_a = SKILL_CATALOG.get(ids[i])
            skel_b = SKILL_CATALOG.get(ids[j])
            if skel_a is None or skel_b is None:
                continue
            if skel_a.principle == skel_b.principle:
                continue
            template = get_pair_template(skel_a.principle, skel_b.principle)
            if template:
                results.append((ids[i], ids[j], template))

    return results


# ──────────────────────────────────────────────
# Internal Builders
# ──────────────────────────────────────────────

def _generate_tier2_id(skill_a_id: str, skill_b_id: str) -> str:
    """Generate a deterministic ID for a Tier 2 skill."""
    # Sort to ensure (A,B) and (B,A) produce same ID
    pair = sorted([skill_a_id, skill_b_id])
    raw = f"{pair[0]}+{pair[1]}"
    short_hash = hashlib.md5(raw.encode()).hexdigest()[:8]
    return f"t2_{short_hash}"


def _build_tier2_skeleton(
    skel_a: SkillSkeleton,
    skel_b: SkillSkeleton,
    template: PrinciplePairTemplate,
    tier2_id: str,
) -> SkillSkeleton:
    """Build a Tier 2 SkillSkeleton from two sources + template."""
    return SkillSkeleton(
        id=tier2_id,
        catalog_name=f"{skel_a.catalog_name} × {skel_b.catalog_name}",
        principle=skel_a.principle,          # Primary principle
        secondary_principle=skel_b.principle,
        archetype=_blend_archetype(skel_a.archetype, skel_b.archetype),
        mechanic=(
            f"{template.mechanic_pattern}: "
            f"combines [{skel_a.mechanic}] + [{skel_b.mechanic}]"
        ),
        limitation=_inherit_heavier_limitation(skel_a, skel_b),
        weakness=_combine_weaknesses(skel_a, skel_b),
        damage_type=skel_a.damage_type,      # Primary damage
        delivery=skel_a.delivery,
        tier=2,
        tags=[
            f"integrated:{skel_a.principle}+{skel_b.principle}",
            f"blend:{template.archetype_blend}",
        ],
    )


def _blend_archetype(a: SkillArchetype, b: SkillArchetype) -> SkillArchetype:
    """Determine archetype of the fusion.

    If both same → keep. If mixed → offensive has priority,
    then defensive, then support, then specialist.
    """
    if a == b:
        return a

    priority = [
        SkillArchetype.OFFENSIVE,
        SkillArchetype.DEFENSIVE,
        SkillArchetype.SUPPORT,
        SkillArchetype.SPECIALIST,
    ]
    for p in priority:
        if a == p or b == p:
            return p
    return a


def _inherit_heavier_limitation(
    skel_a: SkillSkeleton,
    skel_b: SkillSkeleton,
) -> str:
    """Pick the more restrictive limitation from the two skills."""
    # Longer limitation text ≈ more restrictive (heuristic)
    if len(skel_a.limitation) >= len(skel_b.limitation):
        return skel_a.limitation
    return skel_b.limitation


def _combine_weaknesses(
    skel_a: SkillSkeleton,
    skel_b: SkillSkeleton,
) -> str:
    """Combine weakness descriptions from both skills."""
    parts = []
    if skel_a.weakness:
        parts.append(skel_a.weakness)
    if skel_b.weakness:
        parts.append(skel_b.weakness)
    if not parts:
        return "Unstable dual-principle resonance"
    return " + ".join(parts)
