"""Amoisekai — Skill Evolution engine.

Lightweight per-scene checks for skill evolution triggers.
No LLM calls needed for the check itself — only for generating
narrative once evolution is confirmed.

Ref: SKILL_EVOLUTION_SPEC v1.1 §3, §4, §5, §6, §10
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models.skill_evolution import (
    EvolutionType,
    MutationType,
    SkillEvolutionEvent,
    SkillEvolutionState,
)

if TYPE_CHECKING:
    from app.models.power import NormalSkill

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Planner Integration (Spec §10.2)
# ──────────────────────────────────────────────

EVOLUTION_BEATS: dict[EvolutionType, dict] = {
    EvolutionType.REFINEMENT: {
        "beat_type": "rest",
        "description": "Skill refinement: constraint nới lỏng",
        "scenes_needed": 1,
        "priority": "medium",
    },
    EvolutionType.MUTATION: {
        "beat_type": "discovery",
        "description": "Skill mutation arc: identity crisis affects skill",
        "scenes_needed": 3,
        "priority": "critical",
    },
    EvolutionType.INTEGRATION: {
        "beat_type": "rest",
        "description": "Skill integration: player merges 2 skills at rest",
        "scenes_needed": 1,
        "priority": "medium",
    },
    EvolutionType.AWAKENING: {
        "beat_type": "discovery",
        "description": "Skill awakening: piggybacks on affinity event",
        "scenes_needed": 0,  # Part of affinity arc
        "priority": "low",  # Auto, embedded in affinity scenes
    },
}


# ──────────────────────────────────────────────
# Identity Alignment
# ──────────────────────────────────────────────

def calc_skill_identity_alignment(
    skill_primary_principle: str,
    identity_resonance: dict[str, float],
) -> float:
    """Compute alignment between a skill's principle and player identity.

    Returns 0.0–1.0:
        - 1.0 = skill principle perfectly matches identity vector
        - 0.0 = skill principle completely misaligned

    Logic: look up the weight of the skill's primary principle in the
    player's identity/resonance vector.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §3.2

    Args:
        skill_primary_principle: The skill's primary principle (e.g. "energy").
        identity_resonance: Dict mapping principle → float (0.0-1.0),
            representing the player's resonance or identity weight per principle.
            Typically player.resonance.
    """
    return identity_resonance.get(skill_primary_principle, 0.0)


# ──────────────────────────────────────────────
# Refinement Check
# ──────────────────────────────────────────────

def check_refinement(
    evolution: SkillEvolutionState,
    skill_id: str,
    skill_primary_principle: str,
    successful_uses: int,
    identity_resonance: dict[str, float],
) -> bool:
    """Check if a skill is eligible for refinement.

    Conditions (ALL must be true):
        1. successful_uses >= 8
        2. identity_alignment >= 0.6
        3. This skill has NOT been refined before
        4. Total refinements < 2

    Ref: SKILL_EVOLUTION_SPEC v1.1 §3.2

    Args:
        evolution: Player's SkillEvolutionState (canonical source of truth).
        skill_id: The skill being checked.
        skill_primary_principle: Skill's primary principle string.
        successful_uses: Count of successful uses (outcome ≠ unfavorable).
        identity_resonance: Player's resonance dict {principle: float}.

    Returns:
        True if the skill is eligible for refinement.
    """
    if successful_uses < 8:
        return False

    alignment = calc_skill_identity_alignment(
        skill_primary_principle, identity_resonance,
    )
    if alignment < 0.6:
        return False

    if skill_id in evolution.refinements_done:
        return False  # Each skill refined max: 1 time

    if len(evolution.refinements_done) >= 2:
        return False  # Max 2 refinements total per character

    return True


# ──────────────────────────────────────────────
# Mutation Check (stub — Phase 2)
# ──────────────────────────────────────────────

def check_skill_mutation(
    coherence: float,
    instability: float,
    mutations_done: int,
    equipped_skills: list[dict],
    identity_resonance: dict[str, float],
) -> str | None:
    """Check if any skill is eligible for mutation.

    Conditions:
        - mutations_done < 3
        - coherence < 30 (strict)
        - instability > 70 (strict)
        - Find skill with highest misalignment (> 0.6)

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.2

    Returns:
        skill_id of the candidate, or None.
    """
    if mutations_done >= 3:
        return None

    # Guard: check if mutation is allowed at current growth stage
    # (GROWTH_SPEC §9: mutation locked after Aspect Forge)
    from app.engine.skill_check import check_mutation_allowed
    # Extract growth stage from equipped skills context
    # check_mutation_allowed is a policy check, not skill-specific
    # We pass conservative defaults — caller can override
    allowed, reason = check_mutation_allowed()
    if not allowed:
        logger.debug("Mutation blocked: %s", reason)
        return None

    # Identity drift conditions (strict: < 30 coherence AND > 70 instability)
    if coherence >= 30 or instability <= 70:
        return None  # Not enough drift

    max_misalignment = 0.0
    candidate = None

    for skill in equipped_skills:
        # Skip unique skills
        if skill.get("is_unique", False):
            continue

        principle = skill.get("primary_principle", "")
        if not principle:
            continue

        alignment = calc_skill_identity_alignment(principle, identity_resonance)
        misalignment = 1.0 - alignment

        if misalignment > max_misalignment and misalignment > 0.6:
            max_misalignment = misalignment
            candidate = skill.get("id", "")

    return candidate or None


# ──────────────────────────────────────────────
# Usage Tracking
# ──────────────────────────────────────────────

def track_skill_usage(
    evolution: SkillEvolutionState,
    scene_result: dict,
) -> None:
    """Track skill usage from a scene result.

    Tracks per combat PHASE (not per scene) for accuracy.
    Only counts non-unfavorable outcomes.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §10.1

    Args:
        evolution: Player's SkillEvolutionState to update in-place.
        scene_result: Dict with scene outcome data. May contain:
            - "combat_phases": list of phase dicts, each with "skill_used" and "outcome"
            - "skill_used": single skill ID (fallback for non-combat scenes)
            - "outcome": scene outcome string
    """
    combat_phases = scene_result.get("combat_phases")

    if combat_phases:
        for phase in combat_phases:
            skill_used = phase.get("skill_used")
            outcome = phase.get("outcome", "")
            if skill_used and outcome != "unfavorable":
                current = evolution.refinement_trackers.get(skill_used, 0)
                evolution.refinement_trackers[skill_used] = current + 1
    else:
        skill_used = scene_result.get("skill_used")
        outcome = scene_result.get("outcome", "")
        if skill_used and outcome != "unfavorable":
            current = evolution.refinement_trackers.get(skill_used, 0)
            evolution.refinement_trackers[skill_used] = current + 1


# ──────────────────────────────────────────────
# Main Evolution Check (per scene)
# ──────────────────────────────────────────────

def check_skill_evolution(
    evolution: SkillEvolutionState,
    equipped_skills: list[dict],
    identity_resonance: dict[str, float],
    coherence: float,
    instability: float,
    chapter: int,
    scene: int,
    scene_result: dict,
) -> SkillEvolutionEvent | None:
    """Called after every scene. Lightweight, no LLM needed for check.

    Enforces: 1 evolution per chapter maximum (except Awakening).
    Tracks usage per combat PHASE (not per scene) for accuracy.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §10.1

    Args:
        evolution: Player's SkillEvolutionState (updated in-place).
        equipped_skills: List of equipped skill dicts (excl. unique).
        identity_resonance: Player's resonance dict {principle: float}.
        coherence: Player's identity_coherence (0-100).
        instability: Player's instability (0-100).
        chapter: Current chapter number.
        scene: Current scene number.
        scene_result: Dict with skill usage and outcome data.

    Returns:
        SkillEvolutionEvent if evolution triggered, None otherwise.
    """
    # Step 1: Track skill usage
    track_skill_usage(evolution, scene_result)

    # Step 2: If mutation arc in progress, block all other evolutions
    if evolution.mutation_in_progress is not None:
        logger.debug("Mutation arc in progress — blocking other evolutions")
        return None

    # Step 3: 1 evolution per chapter maximum (except Awakening)
    if evolution.last_evolution_chapter >= chapter:
        logger.debug(
            "Already evolved this chapter (%d) — skipping", chapter,
        )
        return None

    # Priority 1: Mutation (identity crisis)
    candidate = check_skill_mutation(
        coherence=coherence,
        instability=instability,
        mutations_done=evolution.mutations_done,
        equipped_skills=equipped_skills,
        identity_resonance=identity_resonance,
    )
    if candidate:
        evolution.mutation_in_progress = candidate
        evolution.mutation_arc_scene = 1
        evolution.last_evolution_chapter = chapter
        logger.info("Mutation triggered for skill %s", candidate)
        return SkillEvolutionEvent(
            event_type=EvolutionType.MUTATION,
            skill_id=candidate,
            chapter=chapter,
            scene=scene,
        )

    # Priority 2: Refinement
    for skill in equipped_skills:
        if skill.get("is_unique", False):
            continue

        skill_id = skill.get("id", "")
        if not skill_id:
            continue

        uses = evolution.refinement_trackers.get(skill_id, 0)
        principle = skill.get("primary_principle", "")

        if check_refinement(
            evolution=evolution,
            skill_id=skill_id,
            skill_primary_principle=principle,
            successful_uses=uses,
            identity_resonance=identity_resonance,
        ):
            evolution.last_evolution_chapter = chapter
            logger.info(
                "Refinement triggered for skill %s (%d uses, principle=%s)",
                skill_id, uses, principle,
            )
            return SkillEvolutionEvent(
                event_type=EvolutionType.REFINEMENT,
                skill_id=skill_id,
                chapter=chapter,
                scene=scene,
            )

    # Awakening: event-driven (when affinity_awakened flag changes)
    #   → exempt from 1-per-chapter limit
    # Integration: player-initiated only (at rest scenes)

    return None


# ──────────────────────────────────────────────
# Apply Refinement
# ──────────────────────────────────────────────

def apply_refinement(
    evolution: SkillEvolutionState,
    skill_id: str,
) -> None:
    """Mark a skill as refined in SkillEvolutionState.

    Called after the narrative has been generated and the skill
    constraint has been loosened. Updates the canonical state.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §3.4

    Args:
        evolution: Player's SkillEvolutionState to update.
        skill_id: The skill that was refined.
    """
    if skill_id not in evolution.refinements_done:
        evolution.refinements_done.append(skill_id)


# ──────────────────────────────────────────────
# Mutation Type Determination (§4.3)
# ──────────────────────────────────────────────

def determine_mutation_type(
    coherence: float,
    instability: float,
    echo_trace: float,
    latent_drift_direction: str,
) -> MutationType:
    """Determine mutation type from identity drift pattern.

    Priority (checked in order):
        1. Corruption → instability > 85 (extremely high)
        2. Purification → coherence recovering from low (echo_trace > 60)
        3. Hybridization → latent identity drifting in specific direction
        4. Inversion → default (seed-opposite behavior)

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.3

    Args:
        coherence: Player's identity_coherence (0-100).
        instability: Player's instability (0-100).
        echo_trace: Player's echo_trace (0-100).
        latent_drift_direction: From LatentIdentity.drift_direction.
    """
    if instability > 85:
        return MutationType.CORRUPTION

    if echo_trace > 60 and coherence < 30:
        # Coherence is low, but echo_trace (connection to origin) is still strong
        # This means player is recovering/purifying
        return MutationType.PURIFICATION

    if latent_drift_direction and latent_drift_direction != "":
        return MutationType.HYBRIDIZATION

    return MutationType.INVERSION


# ──────────────────────────────────────────────
# Mutation Arc State Machine (§4.4)
# ──────────────────────────────────────────────

def advance_mutation_arc(
    evolution: SkillEvolutionState,
    scene_number: int,
) -> dict:
    """Advance the mutation arc state machine.

    3-scene arc:
        Scene 1: "Bất ổn" (discovery) → skill behaves abnormally
        Scene 2: "Đối mặt" (climax)  → DECISION POINT
        Scene 3: "Kết quả" (resolution, only if accepted)

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.4

    Args:
        evolution: Player's SkillEvolutionState (updated in-place).
        scene_number: Current scene number within the mutation arc (1-based).

    Returns:
        Dict with arc state info for the writer/planner.
    """
    if evolution.mutation_in_progress is None:
        return {"status": "no_mutation"}

    skill_id = evolution.mutation_in_progress

    if scene_number == 1:
        evolution.mutation_arc_scene = 1
        return {
            "status": "discovery",
            "skill_id": skill_id,
            "beat_type": "discovery",
            "description": "Skill behaves abnormally — misfires, weakens, or reverses",
            "writer_hint": (
                f"[{skill_id}] cảm thấy khác. Như thể nó không còn nhận ra bạn."
            ),
        }

    elif scene_number == 2:
        evolution.mutation_arc_scene = 2
        return {
            "status": "decision_point",
            "skill_id": skill_id,
            "beat_type": "climax",
            "description": "Skill doesn't work properly — player must decide",
            "choices": [
                {"id": "accept", "text": "Để nó thay đổi theo bạn", "risk": 3},
                {"id": "resist", "text": "Giữ bản chất cũ", "risk": 4},
                {"id": "hybrid", "text": "Ép cả hai bản chất cùng tồn tại", "risk": 5},
            ],
        }

    elif scene_number == 3:
        evolution.mutation_arc_scene = 3
        return {
            "status": "resolution",
            "skill_id": skill_id,
            "beat_type": "resolution",
            "description": "Mutation completes — skill transforms",
        }

    return {"status": "arc_complete"}


# ──────────────────────────────────────────────
# Mutation Choice Resolution (§4.5)
# ──────────────────────────────────────────────

def resolve_mutation_choice(
    evolution: SkillEvolutionState,
    choice: str,
    instability: float,
) -> dict:
    """Resolve the player's mutation choice.

    3 outcomes:
        - "accept": skill mutates, mutations_done += 1, arc ends
        - "resist": stability trial — instability -20, coherence +10 if success
        - "hybrid": instability +15, skill becomes dual-nature if stable enough

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.5

    Args:
        evolution: Player's SkillEvolutionState (updated in-place).
        choice: "accept" | "resist" | "hybrid".
        instability: Player's current instability for hybrid check.

    Returns:
        Dict with resolution outcome for writer/player state updates.
    """
    skill_id = evolution.mutation_in_progress

    if not skill_id:
        return {"error": "no_mutation_in_progress"}

    result: dict = {
        "skill_id": skill_id,
        "choice": choice,
    }

    if choice == "accept":
        # Skill mutates to match current identity
        evolution.mutations_done += 1
        evolution.mutation_in_progress = None
        evolution.mutation_arc_scene = 0
        result["outcome"] = "mutated"
        result["needs_ai_skill_generation"] = True
        # AI will generate mutated skill via _ai_generate_mutated_skill()

    elif choice == "resist":
        # Player fights mutation → stability trial
        evolution.mutation_in_progress = None
        evolution.mutation_arc_scene = 0
        result["outcome"] = "resisted"
        result["identity_changes"] = {
            "instability_change": -20,
            "coherence_change": +10,
        }
        # NOTE: resist-failure (forced mutation) is narrative-only,
        # handled by the writer — not automated

    elif choice == "hybrid":
        # Risky: dual-nature skill
        if instability + 15 > 100:
            # Too unstable → collapses into forced mutation
            evolution.mutations_done += 1
            evolution.mutation_in_progress = None
            evolution.mutation_arc_scene = 0
            result["outcome"] = "forced_mutation"
            result["needs_ai_skill_generation"] = True
        else:
            evolution.mutations_done += 1
            evolution.mutation_in_progress = None
            evolution.mutation_arc_scene = 0
            result["outcome"] = "hybrid"
            result["needs_ai_skill_generation"] = True
            result["identity_changes"] = {
                "instability_change": +15,
            }

    else:
        result["error"] = f"invalid_choice: {choice}"

    return result


# ──────────────────────────────────────────────
# Integration Eligibility (§5.2)
# ──────────────────────────────────────────────

def check_integration_eligible(
    equipped_skills: list[dict],
    skill_usage: dict[str, int],
    current_rank: int,
    integrations_done: int,
) -> list[tuple[str, str]]:
    """Find pairs of skills eligible for integration.

    Conditions:
        - Rank 3+ (STABILIZED)
        - integrations_done < 2
        - Both skills used 5+ times
        - Both share at least 1 principle

    Ref: SKILL_EVOLUTION_SPEC v1.1 §5.2

    Args:
        equipped_skills: List of equipped skill dicts (excl. unique).
        skill_usage: Dict {skill_id: use_count}.
        current_rank: Player's ProgressionRank value (IntEnum).
        integrations_done: Number of integrations already done.

    Returns:
        List of (skill_a_id, skill_b_id) pairs that can integrate.
    """
    if current_rank < 3:  # STABILIZED = 3
        return []
    if integrations_done >= 2:
        return []

    # Filter to normal skills only
    normal_skills = [
        s for s in equipped_skills
        if not s.get("is_unique", False) and s.get("id")
    ]

    eligible_pairs = []

    for i, a in enumerate(normal_skills):
        for b in normal_skills[i + 1:]:
            a_id = a.get("id", "")
            b_id = b.get("id", "")

            # Both used 5+ times
            if skill_usage.get(a_id, 0) < 5:
                continue
            if skill_usage.get(b_id, 0) < 5:
                continue

            # Must share at least 1 principle
            a_principles = _get_skill_principles(a)
            b_principles = _get_skill_principles(b)
            shared = a_principles & b_principles
            if not shared:
                continue

            eligible_pairs.append((a_id, b_id))

    return eligible_pairs


def _get_skill_principles(skill: dict) -> set[str]:
    """Extract all principle names from a skill dict."""
    principles = set()
    for key in ("primary_principle", "secondary_principle", "tertiary_principle"):
        p = skill.get(key, "")
        if p:
            principles.add(p)
    return principles


# ──────────────────────────────────────────────
# Integration Execution (§5.4)
# ──────────────────────────────────────────────

def calculate_integration_tier(
    tier_a: int,
    tier_b: int,
    current_rank: int,
) -> int | None:
    """Calculate the output tier for a skill integration.

    Rules (spec §5.3):
        - T1 + T1 → T2
        - T1 + T2 → T2 enhanced (constraint reduced)
        - T2 + T2 → T3 (Rank 4+ required)

    Returns:
        Output tier, or None if integration is blocked.
    """
    if tier_a == 1 and tier_b == 1:
        return 2
    elif max(tier_a, tier_b) == 2:
        if min(tier_a, tier_b) == 2:
            # T2 + T2 → T3 (requires Rank 4: TRANSCENDENT)
            if current_rank < 4:
                return None  # Rank gate
            return 3
        return 2  # T1 + T2 → T2 enhanced
    return None


def perform_integration(
    evolution: SkillEvolutionState,
    skill_a: dict,
    skill_b: dict,
    current_rank: int,
) -> dict | None:
    """Execute a skill integration.

    Merges 2 skills into 1 higher-tier skill. AI generates the actual skill.
    This function handles state tracking and tier calculation.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §5.4

    Args:
        evolution: Player's SkillEvolutionState (updated in-place).
        skill_a: First skill dict.
        skill_b: Second skill dict.
        current_rank: Player's ProgressionRank value.

    Returns:
        Dict with integration result, or None if blocked.
    """
    output_tier = calculate_integration_tier(
        skill_a.get("tier", 1),
        skill_b.get("tier", 1),
        current_rank,
    )
    if output_tier is None:
        return None

    # Merge principles
    all_principles = list(
        _get_skill_principles(skill_a) | _get_skill_principles(skill_b)
    )

    evolution.integrations_done += 1

    return {
        "merged_from": [skill_a.get("id", ""), skill_b.get("id", "")],
        "output_tier": output_tier,
        "merged_principles": all_principles,
        "needs_ai_skill_generation": True,
        # AI will generate integrated skill via _ai_generate_integrated_skill()
    }


# ──────────────────────────────────────────────
# Awakening Candidates (§6.3)
# ──────────────────────────────────────────────

def get_awakening_candidates(
    equipped_skills: list[dict],
    awakened_principle: str,
    awakened_skills: list[str],
) -> list[str]:
    """Find skills compatible with the awakened principle.

    A skill is compatible if its primary principle is ADJACENT
    to the awakened principle (InteractionType.SYNERGY).

    Ref: SKILL_EVOLUTION_SPEC v1.1 §6.3

    Args:
        equipped_skills: List of equipped skill dicts.
        awakened_principle: The newly awakened principle (e.g. "flux").
        awakened_skills: Already awakened skill IDs (to avoid duplicates).

    Returns:
        List of skill_ids that can receive the awakened principle.
    """
    from app.models.power import InteractionType, get_principle_interaction

    candidates = []

    for skill in equipped_skills:
        if skill.get("is_unique", False):
            continue  # Unique skill awakening is separate

        skill_id = skill.get("id", "")
        if not skill_id or skill_id in awakened_skills:
            continue  # Already awakened

        # Tier 3 skills can't awaken (already complex enough)
        if skill.get("tier", 1) >= 3:
            continue

        primary = skill.get("primary_principle", "")
        if not primary:
            continue

        # Check adjacency via interaction graph
        interaction = get_principle_interaction(primary, awakened_principle)
        if interaction.interaction == InteractionType.SYNERGY:
            candidates.append(skill_id)

    return candidates


# ──────────────────────────────────────────────
# Apply Awakening (§6.5)
# ──────────────────────────────────────────────

def apply_awakening(
    evolution: SkillEvolutionState,
    skill_id: str,
    awakened_principle: str,
    skill: dict,
) -> dict:
    """Apply awakening to a skill — add the awakened principle.

    Tier 1 → gains secondary principle (behaves like Tier 2)
    Tier 2 → gains tertiary principle (enhanced, constraint reduced)

    Ref: SKILL_EVOLUTION_SPEC v1.1 §6.5

    Args:
        evolution: Player's SkillEvolutionState (updated in-place).
        skill_id: The skill being awakened.
        awakened_principle: The principle being added.
        skill: The skill dict (modified in-place).

    Returns:
        Dict with awakening result for writer context.
    """
    tier = skill.get("tier", 1)

    if tier == 1:
        # Tier 1: add secondary principle
        skill["secondary_principle"] = awakened_principle
    elif tier == 2:
        # Tier 2: add tertiary principle, reduce constraint
        skill["tertiary_principle"] = awakened_principle
    # Tier 3: no change (already complex enough)

    if skill_id not in evolution.awakened_skills:
        evolution.awakened_skills.append(skill_id)

    return {
        "skill_id": skill_id,
        "awakened_principle": awakened_principle,
        "original_tier": tier,
        "effect": (
            "secondary_principle_added" if tier == 1
            else "tertiary_principle_added" if tier == 2
            else "no_change"
        ),
    }


# ──────────────────────────────────────────────
# Sync Helper
# ──────────────────────────────────────────────

def sync_evolution_to_progression(
    evolution: SkillEvolutionState,
    progression: object,
) -> None:
    """Sync SkillEvolutionState to PlayerProgression for backward compatibility.

    SkillEvolutionState is the canonical source of truth. This helper
    copies values to PlayerProgression so legacy code still works.

    Args:
        evolution: The canonical SkillEvolutionState.
        progression: PlayerProgression (duck-typed to avoid circular import).
    """
    if hasattr(progression, "refinements_done"):
        progression.refinements_done = list(evolution.refinements_done)  # type: ignore[attr-defined]
    if hasattr(progression, "mutations_done"):
        progression.mutations_done = evolution.mutations_done  # type: ignore[attr-defined]
    if hasattr(progression, "integrations_done"):
        progression.integrations_done = evolution.integrations_done  # type: ignore[attr-defined]
