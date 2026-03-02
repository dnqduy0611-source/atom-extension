"""Soul Forge — API routes for 3-phase identity extraction.

Flow:
    POST /start    → create session, return Scene 1
    POST /choice   → submit choice + behavioral data, return next scene
    POST /fragment → submit soul fragment text
    POST /forge    → trigger skill generation, create player
    GET  /status   → get session state
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.main import get_db
from app.models.soul_forge import (
    SoulForgeAdvanceRequest,
    SoulForgeChoiceRequest,
    SoulForgeForgeRequest,
    SoulForgeForgeResponse,
    SoulForgeFragmentRequest,
    SoulForgeSceneResponse,
    SoulForgeSession,
    SoulForgeStartRequest,
    SoulForgeStartResponse,
)
from app.engine.soul_forge import (
    build_identity_signals,
    compute_behavioral_fingerprint,
    derive_archetype,
    derive_dna_tags,
    forge_skill,
    forge_skill_sync,
    get_scene,
    process_choice,
    process_scene5_advance,
    process_soul_fragment,
)
from app.engine.onboarding import create_initial_player, create_seed_event
from app.engine.play_style_engine import seed_play_style_from_fingerprint_model
from app.models.player import (
    Archetype,
    DNAAffinityTag,
    SeedIdentity,
)

from app.security import assert_owns_user, get_guest_or_user
from app.security.ownership import assert_owns_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/soul-forge", tags=["soul-forge"])

# In-memory session store (temporary — production uses DB)
_sessions: dict[str, SoulForgeSession] = {}

# ── Session TTL ────────────────────────────────────────────────────────────────
_SESSION_TTL_SECONDS = 4 * 3600  # 4 hours
_session_times: dict[str, float] = {}

_MAX_FRAGMENT_LENGTH = 2000
_MAX_BACKSTORY_LENGTH = 1000


def _get_session(session_id: str) -> SoulForgeSession | None:
    """Get a session, evicting it if it has expired."""
    session = _sessions.get(session_id)
    if not session:
        return None
    age = time.monotonic() - _session_times.get(session_id, 0)
    if age > _SESSION_TTL_SECONDS:
        _sessions.pop(session_id, None)
        _session_times.pop(session_id, None)
        logger.info(f"Soul Forge session expired and evicted: {session_id}")
        return None
    return session


def _cleanup_expired_sessions() -> None:
    """Evict all sessions older than TTL. Call periodically on write paths."""
    now = time.monotonic()
    expired = [
        sid for sid, t in _session_times.items()
        if now - t > _SESSION_TTL_SECONDS
    ]
    for sid in expired:
        _sessions.pop(sid, None)
        _session_times.pop(sid, None)
    if expired:
        logger.info(f"Soul Forge: evicted {len(expired)} expired sessions")


# ══════════════════════════════════════════════
# Start
# ══════════════════════════════════════════════

@router.post("/start", response_model=SoulForgeStartResponse)
async def start_soul_forge(req: SoulForgeStartRequest, current_user: str = Depends(get_guest_or_user)):
    """Create a new Soul Forge session and return Scene 1."""
    assert_owns_user(req.user_id, current_user)
    db = get_db()

    # Check if player already exists
    existing = db.get_player_by_user(req.user_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Player already exists for this account.",
        )

    _cleanup_expired_sessions()

    session = SoulForgeSession(user_id=req.user_id, gender=req.gender)
    _sessions[session.session_id] = session
    _session_times[session.session_id] = time.monotonic()

    scene = get_scene(session)

    logger.info(f"Soul Forge started: {session.session_id} for {req.user_id}")

    return SoulForgeStartResponse(
        session_id=session.session_id,
        scene=scene,
    )


# ══════════════════════════════════════════════
# Choice
# ══════════════════════════════════════════════

@router.post("/choice", response_model=SoulForgeSceneResponse)
async def submit_choice(req: SoulForgeChoiceRequest, current_user: str = Depends(get_guest_or_user)):
    """Submit a scene choice and get the next scene."""
    session = _get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    assert_owns_session(session.user_id, current_user)

    if session.phase != "narrative":
        raise HTTPException(
            status_code=400,
            detail=f"Session in phase '{session.phase}', expected 'narrative'",
        )

    # Process the choice
    session = process_choice(
        session,
        req.choice_index,
        req.response_time_ms,
        req.hover_count,
    )

    # All scenes are deterministic — get content from variant data
    scene = get_scene(session)

    logger.info(
        f"Soul Forge choice: {session.session_id} "
        f"scene {session.current_scene - 1} → {session.current_scene}"
    )

    return SoulForgeSceneResponse(
        session_id=session.session_id,
        scene=scene,
    )


# ══════════════════════════════════════════════
# Scene 5 advance (no choice)
# ══════════════════════════════════════════════

@router.post("/advance", response_model=SoulForgeSceneResponse)
async def advance_scene(req: SoulForgeAdvanceRequest, current_user: str = Depends(get_guest_or_user)):
    """Advance past Scene 5 (no choice scene) to Phase 2.

    Transitions to the Soul Fragment phase.
    """
    session = _get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    assert_owns_session(session.user_id, current_user)

    if session.current_scene == 5 and session.phase == "narrative":
        session = process_scene5_advance(session)

    return SoulForgeSceneResponse(
        session_id=session.session_id,
        scene=get_scene(session),
    )


# ══════════════════════════════════════════════
# Soul Fragment
# ══════════════════════════════════════════════

@router.post("/fragment", response_model=SoulForgeSceneResponse)
async def submit_fragment(req: SoulForgeFragmentRequest, current_user: str = Depends(get_guest_or_user)):
    """Submit soul fragment text and advance to forging."""
    session = _get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    assert_owns_session(session.user_id, current_user)

    if session.phase != "fragment":
        raise HTTPException(
            status_code=400,
            detail=f"Session in phase '{session.phase}', expected 'fragment'",
        )

    if not req.text.strip():
        raise HTTPException(
            status_code=400, detail="Soul fragment cannot be empty",
        )

    # Length caps — prevent context stuffing
    fragment_text = req.text[:_MAX_FRAGMENT_LENGTH]

    # Store backstory on session if provided
    if req.backstory.strip():
        session.backstory = req.backstory.strip()[:_MAX_BACKSTORY_LENGTH]

    session = process_soul_fragment(
        session, fragment_text,
        typing_time_ms=req.typing_time_ms,
        revision_count=req.revision_count,
    )

    scene = get_scene(session)

    logger.info(
        f"Soul Forge fragment: {session.session_id} "
        f"({len(fragment_text)} chars)"
    )

    return SoulForgeSceneResponse(
        session_id=session.session_id,
        scene=scene,
    )


# ══════════════════════════════════════════════
# Forge
# ══════════════════════════════════════════════

@router.post("/forge", response_model=SoulForgeForgeResponse)
async def forge(req: SoulForgeForgeRequest, current_user: str = Depends(get_guest_or_user)):
    """Trigger skill generation and create the player."""
    session = _get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    assert_owns_session(session.user_id, current_user)

    if session.phase != "forging":
        raise HTTPException(
            status_code=400,
            detail=f"Session in phase '{session.phase}', expected 'forging'",
        )

    db = get_db()

    # Generate skill
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model=settings.onboarding_model,
            temperature=0.9,  # Higher creativity for unique skills
            google_api_key=settings.google_api_key,
        )
        existing_names = db.get_all_skill_names()
        skill = await forge_skill(session, llm, existing_names=existing_names, db=db)
    except Exception as e:
        logger.warning(f"AI forge failed, using sync fallback: {e}")
        skill = forge_skill_sync(session)

    # Build identity signals for seed identity
    signals = session.identity_signals or build_identity_signals(session)
    # Use AI-chosen archetype if available, fallback to lookup table
    archetype_str = session.ai_archetype or derive_archetype(signals)
    dna_tags = derive_dna_tags(signals)

    # Map to enums
    try:
        archetype = Archetype(archetype_str)
    except ValueError:
        archetype = Archetype.WANDERER

    dna_affinity = []
    for tag in dna_tags[:3]:
        try:
            dna_affinity.append(DNAAffinityTag(tag))
        except ValueError:
            pass

    # Build SeedIdentity from soul forge data
    origin = (
        f"Linh hồn thức tỉnh trong Hư Vô, bám vào {signals.void_anchor}. "
        f"Bản chất: {signals.moral_core}."
    )
    if session.backstory:
        origin = f"{session.backstory}. {origin}"

    seed = SeedIdentity(
        core_values=signals.soul_fragment_themes or [signals.moral_core],
        personality_traits=[
            signals.decision_pattern,
            signals.conflict_response,
            signals.courage_vs_cleverness,
        ],
        motivation=signals.soul_fragment_raw[:100] if signals.soul_fragment_raw else "",
        fear="",
        origin_story=origin,
    )

    # Seed play style from behavioral fingerprint
    behavioral = compute_behavioral_fingerprint(session)
    initial_play_style = seed_play_style_from_fingerprint_model(behavioral)

    # Create player
    player = create_initial_player(
        user_id=session.user_id,
        name=req.name or "Nhân vật chính",
        seed=seed,
        archetype=archetype,
        dna=dna_affinity,
        skill=skill,
        play_style=initial_play_style,
        gender=session.gender,
    )

    # Persist
    db.create_player(player)
    event = create_seed_event(player)
    db.log_identity_event(event)

    # Save skill embedding for future uniqueness checks
    try:
        from app.engine.skill_uniqueness import embed_text, save_skill_embedding
        skill_text = f"{skill.name}: {skill.description}. {skill.mechanic}"
        embedding = await embed_text(skill_text)
        save_skill_embedding(db, player.id, skill.name, skill_text, embedding)
    except Exception as e:
        logger.warning(f"Failed to save skill embedding: {e}")

    session.phase = "done"

    logger.info(
        f"Soul Forge complete: {session.session_id} → "
        f"player {player.id} ({archetype.value}), "
        f"skill: {skill.name} (uniqueness={skill.uniqueness_score:.3f})"
    )

    # Cleanup session
    _sessions.pop(session.session_id, None)
    _session_times.pop(session.session_id, None)

    return SoulForgeForgeResponse(
        session_id=session.session_id,
        player_id=player.id,
        skill_name=skill.name,
        skill_description=skill.description,
        skill_category=skill.category,
        skill_mechanic=skill.mechanic,
        skill_activation=skill.activation_condition,
        skill_limitation=skill.limitation,
        skill_weakness=skill.weakness,
        soul_resonance=skill.soul_resonance,
        archetype=archetype.value,
        archetype_display=archetype.display_name,
        archetype_description=archetype.description,
        dna_affinity=[t.value for t in dna_affinity],
        # V2 fields
        domain_passive_name=skill.domain_passive_name,
        domain_passive_mechanic=skill.domain_passive_mechanic,
        weakness_type=skill.weakness_type,
        axis_blind_spot=skill.axis_blind_spot,
        unique_clause=skill.unique_clause,
    )


# ══════════════════════════════════════════════
# Status
# ══════════════════════════════════════════════

@router.get("/status/{session_id}")
async def get_status(session_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get current Soul Forge session status."""
    session = _get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    assert_owns_session(session.user_id, current_user)

    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "phase": session.phase,
        "current_scene": session.current_scene,
        "choices_made": len(session.scene_choices),
        "has_fragment": bool(session.soul_fragment_raw),
    }
