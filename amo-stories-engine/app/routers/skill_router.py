"""Skill management REST endpoints.

Handles skill inventory, accept/reject, equip/unequip, integration,
and skill evolution actions (mutation choice).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.main import get_db
from app.engine.skill_discovery import (
    SkillSource,
    accept_skill,
    create_discovery,
    equip_skill,
    reject_skill,
    unequip_skill,
    integration_slot_recovery,
)
from app.engine.skill_integration import (
    IntegrationError,
    integrate_skills,
    can_integrate,
    get_integration_options,
)
from app.models.skill_catalog import (
    NarrativeSkin,
    PlayerSkill,
    SKILL_CATALOG,
    get_skill,
)

from app.security import assert_owns_user, get_guest_or_user, sanitize_free_input

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/skill", tags=["skill"])


# ══════════════════════════════════════════
# Request Models
# ══════════════════════════════════════════

class AcceptSkillRequest(BaseModel):
    skeleton_id: str
    source: str = "floor_clear"
    narrative_context: str = ""
    chapter: int = 0


class RejectSkillRequest(BaseModel):
    skeleton_id: str


class EquipRequest(BaseModel):
    skeleton_id: str


class IntegrateRequest(BaseModel):
    skill_a_id: str
    skill_b_id: str


class MutationChoiceRequest(BaseModel):
    """Player's choice for a mutation decision point."""
    choice: str  # "accept" | "resist" | "hybrid"


# ══════════════════════════════════════════
# Inventory
# ══════════════════════════════════════════

@router.get("/{user_id}/inventory")
async def get_skill_inventory(user_id: str, current_user: str = Depends(get_guest_or_user)):
    """List owned + equipped skills for a player."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Build owned skills with catalog info
    owned = []
    for ps in player.owned_skills:
        ps_data = ps if isinstance(ps, dict) else ps.model_dump() if hasattr(ps, "model_dump") else {}
        sid = ps_data.get("skeleton_id", "")
        skeleton = SKILL_CATALOG.get(sid)
        owned.append({
            "skeleton_id": sid,
            "catalog_name": skeleton.catalog_name if skeleton else "unknown",
            "principle": skeleton.principle if skeleton else "",
            "archetype": skeleton.archetype.value if skeleton else "",
            "tier": skeleton.tier if skeleton else 1,
            "narrative": ps_data.get("narrative", {}),
            "usage_count": ps_data.get("usage_count", 0),
        })

    return {
        "player_id": player.id,
        "owned_skills": owned,
        "equipped_skill_ids": player.equipped_skill_ids,
        "equipped_count": len(player.equipped_skill_ids),
        "max_normal_slots": 4,
        "total_owned": len(owned),
    }


# ══════════════════════════════════════════
# Accept / Reject
# ══════════════════════════════════════════

@router.post("/{user_id}/accept")
async def accept_discovered_skill(user_id: str, req: AcceptSkillRequest, current_user: str = Depends(get_guest_or_user)):
    """Accept a discovered skill — adds to inventory."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Validate source
    try:
        source = SkillSource(req.source)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid source: {req.source}")

    # Sanitize free-text field before it enters the skill engine
    try:
        safe_narrative_context = sanitize_free_input(req.narrative_context) if req.narrative_context else ""
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create discovery
    try:
        discovery = create_discovery(
            skeleton_id=req.skeleton_id,
            source=source,
            narrative_context=safe_narrative_context,
            chapter=req.chapter,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Build owned_skills list as PlayerSkill objects
    owned_list = _parse_owned_skills(player)

    # Accept
    try:
        new_skill = accept_skill(discovery, owned_list)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Persist — add to player's owned_skills
    player.owned_skills.append(new_skill.model_dump())
    player.chapters_since_last_skill = 0
    db.update_player(player)

    logger.info(f"Player {user_id} accepted skill: {req.skeleton_id}")

    return {
        "status": "accepted",
        "skeleton_id": req.skeleton_id,
        "catalog_name": discovery.skeleton.catalog_name,
        "principle": discovery.skeleton.principle,
        "total_owned": len(player.owned_skills),
    }


@router.post("/{user_id}/reject")
async def reject_discovered_skill(user_id: str, req: RejectSkillRequest, current_user: str = Depends(get_guest_or_user)):
    """Reject a discovered skill — no-op, move on."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Validate skeleton exists
    skeleton = get_skill(req.skeleton_id)
    if not skeleton:
        raise HTTPException(status_code=400, detail=f"Unknown skill: {req.skeleton_id}")

    logger.info(f"Player {user_id} rejected skill: {req.skeleton_id}")

    return {
        "status": "rejected",
        "skeleton_id": req.skeleton_id,
    }


# ══════════════════════════════════════════
# Equip / Unequip
# ══════════════════════════════════════════

@router.post("/{user_id}/equip")
async def equip_player_skill(user_id: str, req: EquipRequest, current_user: str = Depends(get_guest_or_user)):
    """Equip a skill from inventory to an active slot."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    owned_list = _parse_owned_skills(player)

    try:
        new_equipped = equip_skill(
            skill_id=req.skeleton_id,
            owned_skills=owned_list,
            equipped_ids=player.equipped_skill_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Persist — rebuild equipped_skills list
    _update_equipped(player, new_equipped)
    db.update_player(player)

    logger.info(f"Player {user_id} equipped: {req.skeleton_id}")

    return {
        "status": "equipped",
        "skeleton_id": req.skeleton_id,
        "equipped_ids": new_equipped,
        "equipped_count": len(new_equipped),
    }


@router.post("/{user_id}/unequip")
async def unequip_player_skill(user_id: str, req: EquipRequest, current_user: str = Depends(get_guest_or_user)):
    """Unequip a skill from active slot back to inventory."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    try:
        new_equipped = unequip_skill(
            skill_id=req.skeleton_id,
            equipped_ids=player.equipped_skill_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _update_equipped(player, new_equipped)
    db.update_player(player)

    logger.info(f"Player {user_id} unequipped: {req.skeleton_id}")

    return {
        "status": "unequipped",
        "skeleton_id": req.skeleton_id,
        "equipped_ids": new_equipped,
        "equipped_count": len(new_equipped),
    }


# ══════════════════════════════════════════
# Integration
# ══════════════════════════════════════════

@router.post("/{user_id}/integrate")
async def integrate_player_skills(user_id: str, req: IntegrateRequest, current_user: str = Depends(get_guest_or_user)):
    """Merge two Tier 1 skills into a Tier 2 skill."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    owned_list = _parse_owned_skills(player)

    try:
        result = integrate_skills(
            skill_a_id=req.skill_a_id,
            skill_b_id=req.skill_b_id,
            owned_skills=owned_list,
        )
    except IntegrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Update owned skills: remove consumed, add Tier 2
    player.owned_skills = [
        s for s in player.owned_skills
        if (s if isinstance(s, dict) else s.model_dump() if hasattr(s, "model_dump") else {}).get("skeleton_id") not in result.consumed_ids
    ]
    player.owned_skills.append(result.tier2_player_skill.model_dump())

    # Update equipped: slot recovery
    new_equipped = integration_slot_recovery(
        consumed_ids=result.consumed_ids,
        new_tier2_id=result.tier2_skeleton.id,
        equipped_ids=player.equipped_skill_ids,
    )
    _update_equipped(player, new_equipped)

    # Apply instability cost
    player.instability = min(100.0, player.instability + result.instability_added)

    # Track integration on evolution state (SKILL_EVOLUTION_SPEC §5.4)
    if hasattr(player, "skill_evolution") and player.skill_evolution:
        player.skill_evolution.integrations_done += 1

    # Try AI-enhanced integration skill generation
    ai_skill = None
    try:
        from app.engine.skill_evolution_ai import generate_integrated_skill
        from app.engine.skill_evolution import calculate_integration_tier

        # Find original skill dicts
        skill_a_dict = next(
            (s for s in player.owned_skills
             if (s if isinstance(s, dict) else {}).get("skeleton_id") == req.skill_a_id),
            None,
        )
        skill_b_dict = next(
            (s for s in player.owned_skills
             if (s if isinstance(s, dict) else {}).get("skeleton_id") == req.skill_b_id),
            None,
        )
        if skill_a_dict and skill_b_dict:
            a = skill_a_dict if isinstance(skill_a_dict, dict) else {}
            b = skill_b_dict if isinstance(skill_b_dict, dict) else {}
            tier_a = a.get("tier", 1)
            tier_b = b.get("tier", 1)
            rank_val = player.progression.current_rank.value if hasattr(player.progression, "current_rank") else 3
            output_tier = calculate_integration_tier(tier_a, tier_b, rank_val) or 2
            merged = list({a.get("primary_principle", ""), b.get("primary_principle", "")} - {""})
            ai_skill = await generate_integrated_skill(
                skill_a=a, skill_b=b,
                output_tier=output_tier,
                merged_principles=merged,
            )
            logger.info("AI integration generated: %s", ai_skill.get("name", "unknown"))
    except Exception as e:
        logger.warning("AI integration generation failed (using deterministic): %s", e)

    db.update_player(player)

    logger.info(
        f"Player {user_id} integrated: {req.skill_a_id} + {req.skill_b_id} "
        f"→ {result.tier2_skeleton.id} (instability +{result.instability_added})"
    )

    return {
        "status": "integrated",
        "tier2_id": result.tier2_skeleton.id,
        "tier2_name": result.tier2_skeleton.catalog_name,
        "consumed_ids": result.consumed_ids,
        "instability_added": result.instability_added,
        "power_multiplier": result.power_multiplier,
        "equipped_ids": new_equipped,
        "slot_freed": True,
        "ai_generated_skill": ai_skill,
    }


# ══════════════════════════════════════════
# Skill Evolution — Mutation Choice
# ══════════════════════════════════════════

@router.post("/{user_id}/mutation-choice")
async def submit_mutation_choice(
    user_id: str,
    req: MutationChoiceRequest,
    current_user: str = Depends(get_guest_or_user),
):
    """Submit player's choice for a mutation decision point.

    Called when mutation arc reaches scene 2 (decision point).
    Valid choices: "accept", "resist", "hybrid".

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.5
    """
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Validate mutation arc is at decision point
    evo = player.skill_evolution
    if not evo or not evo.mutation_in_progress:
        raise HTTPException(
            status_code=400,
            detail="No mutation arc in progress",
        )
    if evo.mutation_arc_scene != 2:
        raise HTTPException(
            status_code=400,
            detail=f"Mutation arc not at decision point (scene {evo.mutation_arc_scene}, need 2)",
        )

    if req.choice not in ("accept", "resist", "hybrid"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid choice: {req.choice}. Must be 'accept', 'resist', or 'hybrid'",
        )

    from app.engine.skill_evolution import resolve_mutation_choice

    result = resolve_mutation_choice(
        evolution=evo,
        choice=req.choice,
        instability=player.instability,
    )

    # Apply identity changes if any
    identity_changes = result.get("identity_changes", {})
    if identity_changes:
        player.instability = max(0.0, min(100.0,
            player.instability + identity_changes.get("instability_change", 0)
        ))
        if hasattr(player, "identity_coherence"):
            player.identity_coherence = max(0.0, min(100.0,
                player.identity_coherence + identity_changes.get("coherence_change", 0)
            ))

    # If AI skill generation needed, trigger it
    if result.get("needs_ai_skill_generation"):
        try:
            from app.engine.skill_evolution_ai import (
                generate_mutated_skill,
                generate_hybrid_skill,
            )
            skill_id = result["skill_id"]
            # Find original skill data
            original_skill = None
            for sk in player.equipped_skills:
                sk_data = sk if isinstance(sk, dict) else {}
                if sk_data.get("id") == skill_id or sk_data.get("skeleton_id") == skill_id:
                    original_skill = sk_data
                    break

            if original_skill:
                if result["outcome"] == "hybrid":
                    # Bug #3 fix: convert identity dicts to strings
                    ci = getattr(player, "current_identity", None)
                    ci_str = str(ci.model_dump() if hasattr(ci, "model_dump") else ci) if ci else ""
                    new_skill = await generate_hybrid_skill(
                        original_skill=original_skill,
                        current_identity=ci_str,
                        latent_identity="",
                    )
                else:  # accept or forced_mutation
                    from app.engine.skill_evolution import determine_mutation_type
                    # drift_direction is on LatentIdentity sub-model
                    dd = ""
                    if hasattr(player, "latent_identity") and player.latent_identity:
                        dd = player.latent_identity.drift_direction or ""
                    mutation_type = determine_mutation_type(
                        coherence=player.identity_coherence,
                        instability=player.instability,
                        echo_trace=player.echo_trace,
                        latent_drift_direction=dd,
                    )
                    # Bug #2 fix: use correct params matching function signature
                    new_skill = await generate_mutated_skill(
                        original_skill=original_skill,
                        mutation_type=mutation_type.value,
                        current_resonance=player.resonance or {},
                        drift_direction=dd,
                    )

                result["generated_skill"] = new_skill
                logger.info(
                    "AI generated %s skill for mutation: %s",
                    result["outcome"], new_skill.get("name", "unknown"),
                )
        except Exception as e:
            logger.error("AI skill generation failed: %s", e)
            result["ai_generation_error"] = str(e)

    db.update_player(player)

    logger.info(
        "Player %s mutation choice: %s → %s",
        user_id, req.choice, result.get("outcome"),
    )

    return result


@router.get("/{user_id}/evolution-status")
async def get_evolution_status(
    user_id: str,
    current_user: str = Depends(get_guest_or_user),
):
    """Get current skill evolution state for a player."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    evo = player.skill_evolution
    mastery = player.resonance_mastery

    return {
        "player_id": player.id,
        "evolution": {
            "refinements_done": len(evo.refinements_done) if evo else 0,
            "mutations_done": evo.mutations_done if evo else 0,
            "integrations_done": evo.integrations_done if evo else 0,
            "mutation_in_progress": evo.mutation_in_progress if evo else None,
            "mutation_arc_scene": evo.mutation_arc_scene if evo else 0,
            "awakened_skills": evo.awakened_skills if evo else [],
        },
        "resonance_mastery": {
            "personal_cap_bonus": mastery.personal_cap_bonus if mastery else 0.0,
            "stability_trials_passed": mastery.stability_trials_passed if mastery else 0,
            "overdrive_risk_reduction": mastery.overdrive_risk_reduction if mastery else 0.0,
            "dual_mastery_count": mastery.dual_mastery_count if mastery else 0,
        },
    }


@router.get("/{user_id}/integration-options")
async def get_player_integration_options(user_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get all valid integration pairs from owned skills."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    options = get_integration_options(player.owned_skill_ids)

    return {
        "player_id": player.id,
        "options": [
            {
                "skill_a_id": a,
                "skill_b_id": b,
                "archetype_blend": t.archetype_blend,
                "mechanic_pattern": t.mechanic_pattern,
                "power_multiplier": t.power_multiplier,
                "instability_cost": t.instability_cost,
            }
            for a, b, t in options
        ],
        "total_options": len(options),
    }


# ══════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════

def _parse_owned_skills(player) -> list[PlayerSkill]:
    """Parse player's owned_skills (list of dicts) into PlayerSkill objects."""
    result = []
    for s in player.owned_skills:
        if isinstance(s, dict):
            result.append(PlayerSkill(**s))
        elif hasattr(s, "model_dump"):
            result.append(s)
        else:
            continue
    return result


def _update_equipped(player, equipped_ids: list[str]) -> None:
    """Rebuild player.equipped_skills from equipped_ids list.

    Maps skeleton_ids back to owned_skills data.
    """
    equipped_data = []
    for sid in equipped_ids:
        # Find in owned_skills
        for s in player.owned_skills:
            s_data = s if isinstance(s, dict) else s.model_dump() if hasattr(s, "model_dump") else {}
            if s_data.get("skeleton_id") == sid:
                # Also attach catalog info
                skeleton = SKILL_CATALOG.get(sid)
                entry = dict(s_data)
                if skeleton:
                    entry["catalog_name"] = skeleton.catalog_name
                    entry["principle"] = skeleton.principle
                    entry["archetype"] = skeleton.archetype.value
                equipped_data.append(entry)
                break
    player.equipped_skills = equipped_data
