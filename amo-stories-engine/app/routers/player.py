"""Player onboarding and state management routes."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.main import get_db
from app.models.player import (
    OnboardingRequest,
    OnboardingResponse,
    PlayerState,
    PlayerStateResponse,
)
from app.models.identity import IdentityEventType
from app.security import assert_owns_user, get_guest_or_user
from app.engine.onboarding import (
    create_initial_player,
    create_seed_event,
    create_seed_from_quiz,
    create_seed_from_quiz_sync,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/player", tags=["player"])


# ══════════════════════════════════════════
# Onboarding
# ══════════════════════════════════════════

@router.post("/onboard", response_model=OnboardingResponse)
async def onboard_player(req: OnboardingRequest, current_user: str = Depends(get_guest_or_user)):
    """Quiz answers → Seed Identity + Archetype + DNA.

    This is the player creation endpoint.
    If the user already has a player, returns 409 Conflict.
    """
    assert_owns_user(req.user_id, current_user)
    db = get_db()

    # Check if player already exists
    existing = db.get_player_by_user(req.user_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Player already exists for user {req.user_id}",
        )

    # Generate seed identity
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=settings.onboarding_model,
            temperature=0.8,
            google_api_key=settings.google_api_key,
        )
        seed, archetype, dna, skill = await create_seed_from_quiz(
            req.quiz_answers, llm, backstory=req.backstory,
        )
    except Exception as e:
        logger.warning(f"AI onboarding failed, using sync fallback: {e}")
        seed, archetype, dna, skill = create_seed_from_quiz_sync(
            req.quiz_answers, backstory=req.backstory,
        )

    # Create player
    player = create_initial_player(
        user_id=req.user_id,
        name=req.name,
        seed=seed,
        archetype=archetype,
        dna=dna,
        skill=skill,
    )

    # Persist
    db.create_player(player)

    # Log seed event
    event = create_seed_event(player)
    db.log_identity_event(event)

    logger.info(f"Player onboarded: {player.id} ({archetype.value})")

    return OnboardingResponse(
        player_id=player.id,
        seed_identity=seed,
        archetype=archetype.value,
        archetype_display=archetype.display_name,
        dna_affinity=[t.value for t in dna],
        unique_skill=skill,
    )


# ══════════════════════════════════════════
# Player State
# ══════════════════════════════════════════

@router.get("/{user_id}", response_model=PlayerStateResponse)
async def get_player(user_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get player state by user ID."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    from app.models.player import Archetype

    arch_display = ""
    try:
        arch_display = Archetype(player.archetype).display_name
    except ValueError:
        arch_display = player.archetype

    return PlayerStateResponse(
        id=player.id,
        name=player.name,
        gender=player.gender,
        archetype=player.archetype,
        archetype_display=arch_display,
        dna_affinity=[t.value for t in player.dna_affinity],
        unique_skill=player.unique_skill.model_dump() if player.unique_skill else None,
        total_chapters=player.total_chapters,
        turns_today=player.turns_today,
        echo_trace=player.echo_trace,
        identity_coherence=player.identity_coherence,
        instability=player.instability,
        decision_quality_score=player.decision_quality_score,
        breakthrough_meter=player.breakthrough_meter,
        alignment=player.alignment,
        is_early_game=player.is_early_game,
        instability_critical=player.instability_critical,
        breakthrough_ready=player.breakthrough_ready,
    )


@router.get("/{user_id}/identity")
async def get_player_identity(user_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get full identity details (seed, current, latent)."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    return {
        "player_id": player.id,
        "seed_identity": player.seed_identity.model_dump(),
        "current_identity": player.current_identity.model_dump(),
        "latent_identity": player.latent_identity.model_dump(),
        "archetype": player.archetype,
        "dna_affinity": [t.value for t in player.dna_affinity],
        "scores": {
            "echo_trace": player.echo_trace,
            "identity_coherence": player.identity_coherence,
            "instability": player.instability,
            "decision_quality_score": player.decision_quality_score,
            "breakthrough_meter": player.breakthrough_meter,
            "notoriety": player.notoriety,
            "alignment": player.alignment,
            "fate_buffer": player.fate_buffer,
        },
    }


@router.get("/{user_id}/events")
async def get_player_events(user_id: str, limit: int = 50, current_user: str = Depends(get_guest_or_user)):
    """Get identity event log."""
    assert_owns_user(user_id, current_user)
    db = get_db()
    player = db.get_player_by_user(user_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    events = db.get_identity_events(player.id, limit=limit)
    return {
        "player_id": player.id,
        "events": [
            {
                "type": e.event_type.value,
                "chapter": e.chapter_number,
                "description": e.description,
                "created_at": str(e.created_at),
            }
            for e in events
        ],
    }
