"""Story REST endpoints — start, continue, state, list, delete."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.story import (
    ChapterResponse,
    ChoiceResponse,
    ContinueRequest,
    StartRequest,
    StartResponse,
    StoryStateResponse,
)

router = APIRouter(prefix="/api/story", tags=["story"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _chapter_to_response(chapter) -> ChapterResponse:
    """Convert a Chapter model to API response."""
    return ChapterResponse(
        id=chapter.id,
        number=chapter.number,
        prose=chapter.prose,
        choices=[
            ChoiceResponse(id=c.id, text=c.text, risk_level=c.risk_level)
            for c in chapter.choices
        ],
        critic_score=chapter.critic_score,
        rewrite_count=chapter.rewrite_count,
    )


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@router.post("/start", response_model=StartResponse)
async def start_story(req: StartRequest):
    """Create a new story and generate chapter 1."""
    # Phase 1b: will wire up the pipeline here
    # For now, return a placeholder to verify the route works
    raise HTTPException(
        status_code=501,
        detail="Pipeline not yet implemented — coming in Phase 1b",
    )


@router.post("/continue", response_model=ChapterResponse)
async def continue_story(req: ContinueRequest):
    """Choose an option and generate the next chapter."""
    raise HTTPException(
        status_code=501,
        detail="Pipeline not yet implemented — coming in Phase 1b",
    )


@router.get("/{story_id}/state", response_model=StoryStateResponse)
async def get_story_state(story_id: str):
    """Get story + all chapters."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    chapters = db.get_story_chapters(story_id)
    return StoryStateResponse(
        story=story,
        chapters=[_chapter_to_response(c) for c in chapters],
    )


@router.get("/user/{user_id}")
async def list_user_stories(user_id: str):
    """List all active stories for a user."""
    from app.main import get_db

    db = get_db()
    stories = db.get_user_stories(user_id)
    return {"stories": [s.model_dump() for s in stories]}


@router.delete("/{story_id}")
async def delete_story(story_id: str):
    """Delete a story and all its chapters."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    db.delete_story(story_id)
    return {"ok": True, "deleted": story_id}
