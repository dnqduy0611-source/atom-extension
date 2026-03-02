"""Story REST endpoints — start, continue, state, list, delete.

Now wired to the full LangGraph pipeline via StoryOrchestrator.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.models.story import (
    ChapterResponse,
    ChoiceResponse,
    ContinueRequest,
    ContinueResponse,
    StartRequest,
    StartResponse,
    StoryStateResponse,
)

from app.security import assert_owns_story, assert_owns_user, get_guest_or_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/story", tags=["story"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _chapter_to_response(chapter) -> ChapterResponse:
    """Convert a Chapter model to API response."""
    return ChapterResponse(
        id=chapter.id,
        number=chapter.chapter_number or chapter.number,
        title=chapter.title or "",
        prose=chapter.prose,
        summary=chapter.summary or "",
        choices=[
            ChoiceResponse(
                id=c.id,
                text=c.text,
                risk_level=c.risk_level,
                consequence_hint=c.consequence_hint or "",
            )
            for c in chapter.choices
        ],
        critic_score=chapter.critic_score,
        rewrite_count=chapter.rewrite_count,
    )


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/start", response_model=StartResponse)
async def start_story(req: StartRequest, current_user: str = Depends(get_guest_or_user)):
    """Create a new story and generate chapter 1.

    Optionally accepts quiz_answers to onboard a new player simultaneously.
    """
    assert_owns_user(req.user_id, current_user)
    from app.main import get_db
    from app.engine.orchestrator import StoryOrchestrator

    db = get_db()

    # Optional: onboard player if quiz_answers provided
    if req.quiz_answers:
        existing = db.get_player_by_user(req.user_id)
        if not existing:
            from app.engine.onboarding import (
                create_initial_player,
                create_seed_event,
                create_seed_from_quiz_sync,
            )
            seed, archetype, dna, skill = create_seed_from_quiz_sync(
                req.quiz_answers, backstory=req.backstory,
            )
            player = create_initial_player(
                user_id=req.user_id,
                name=req.protagonist_name or "Nhân vật chính",
                seed=seed,
                archetype=archetype,
                dna=dna,
                skill=skill,
            )
            db.create_player(player)
            db.log_identity_event(create_seed_event(player))
            logger.info(f"Auto-onboarded player {player.id} during story start")

    try:
        orch = StoryOrchestrator(db)
        story, result = await orch.start_new_story(
            user_id=req.user_id,
            preference_tags=req.preference_tags,
            backstory=req.backstory,
            protagonist_name=req.protagonist_name,
        )
    except Exception as e:
        logger.error(f"start_story failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start story. Please try again.")

    return StartResponse(
        story_id=story.id,
        title=story.title or "Câu chuyện mới",
        preference_tags=story.preference_tags,
        chapter=_chapter_to_response(result.chapter),
    )


@router.post("/continue", response_model=ContinueResponse)
async def continue_story(req: ContinueRequest, current_user: str = Depends(get_guest_or_user)):
    """Choose an option (or free input) and generate the next chapter."""
    from app.main import get_db
    from app.engine.orchestrator import StoryOrchestrator

    db = get_db()

    # Validate story exists and caller owns it
    story = db.get_story(req.story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(story.user_id, current_user)

    # Resolve chosen choice
    from app.models.story import Choice
    chosen_choice = None

    if req.choice_id:
        # Find the choice from the latest chapter
        chapters = db.get_story_chapters(req.story_id)
        if chapters:
            last_chapter = chapters[-1]
            for c in last_chapter.choices:
                if c.id == req.choice_id:
                    chosen_choice = c
                    break

        if not chosen_choice:
            raise HTTPException(status_code=400, detail=f"Choice {req.choice_id} not found")

    elif not req.free_input:
        raise HTTPException(
            status_code=400,
            detail="Either choice_id or free_input must be provided",
        )

    try:
        orch = StoryOrchestrator(db)
        result = await orch.generate_chapter(
            story_id=req.story_id,
            user_id=story.user_id,
            choice=chosen_choice,
            free_input=req.free_input,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"continue_story failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate chapter. Please try again.")

    return ContinueResponse(
        story_id=req.story_id,
        chapter=_chapter_to_response(result.chapter),
        identity_update=result.identity_delta_summary,
    )


@router.get("/{story_id}/state", response_model=StoryStateResponse)
async def get_story_state(story_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get story + all chapters."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(story.user_id, current_user)

    chapters = db.get_story_chapters(story_id)
    return StoryStateResponse(
        story=story,
        chapters=[_chapter_to_response(c) for c in chapters],
    )


@router.get("/user/{user_id}")
async def list_user_stories(user_id: str, current_user: str = Depends(get_guest_or_user)):
    """List all active stories for a user."""
    assert_owns_user(user_id, current_user)
    from app.main import get_db

    db = get_db()
    stories = db.get_user_stories(user_id)
    return {"stories": [s.model_dump() for s in stories]}


@router.delete("/{story_id}")
async def delete_story(story_id: str, current_user: str = Depends(get_guest_or_user)):
    """Delete a story and all its chapters."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(story.user_id, current_user)

    db.delete_story(story_id)
    return {"ok": True, "deleted": story_id}
