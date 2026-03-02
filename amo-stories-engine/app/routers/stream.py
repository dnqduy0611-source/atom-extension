"""SSE streaming endpoint for real-time chapter prose delivery.

Streams pipeline progress via Server-Sent Events:
  - status:   Pipeline stage updates ("Planning...", "Writing...")
  - prose:    Incremental prose chunks
  - choices:  Final choices array
  - identity: Identity delta summary
  - metadata: Critic score, rewrite count
  - done:     Stream complete
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.security import assert_owns_story, assert_owns_user, get_guest_or_user_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/story", tags=["stream"])


@router.get("/stream/start")
async def stream_start_story(
    user_id: str,
    preference_tags: str = "",
    backstory: str = "",
    protagonist_name: str = "",
    tone: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Start a new story with SSE streaming.

    Streams pipeline progress as the first chapter is generated.
    Query params for GET-based SSE compatibility.
    """
    assert_owns_user(user_id, current_user)

    async def event_generator():
        from app.main import get_db
        from app.engine.orchestrator import StoryOrchestrator

        db = get_db()

        try:
            yield _sse("status", {"stage": "init", "message": "Đang khởi tạo câu chuyện..."})
            await asyncio.sleep(0.1)

            orch = StoryOrchestrator(db)

            yield _sse("status", {"stage": "pipeline", "message": "Đang tạo chương 1..."})

            tags_list = [t.strip() for t in preference_tags.split(",") if t.strip()] if preference_tags else []

            story, result = await orch.start_new_story(
                user_id=user_id,
                preference_tags=tags_list,
                backstory=backstory,
                protagonist_name=protagonist_name,
                tone=tone,
            )

            # Stream prose in chunks for typewriter effect
            prose = result.chapter.prose
            chunk_size = 50  # ~50 chars per chunk
            for i in range(0, len(prose), chunk_size):
                chunk = prose[i:i + chunk_size]
                yield _sse("prose", {"text": chunk, "offset": i})
                await asyncio.sleep(0.03)  # 30ms delay for smooth typing

            # Send choices
            yield _sse("choices", {
                "choices": [
                    {
                        "id": c.id,
                        "text": c.text,
                        "risk_level": c.risk_level,
                        "consequence_hint": c.consequence_hint,
                    }
                    for c in result.chapter.choices
                ]
            })

            # Send metadata
            yield _sse("metadata", {
                "story_id": story.id,
                "story_title": story.title,
                "chapter_id": result.chapter.id,
                "chapter_number": 1,
                "chapter_title": result.chapter.title,
                "critic_score": result.chapter.critic_score,
                "rewrite_count": result.chapter.rewrite_count,
                "preference_tags": story.preference_tags,
            })

            # Send identity update
            if result.identity_delta_summary:
                yield _sse("identity", result.identity_delta_summary)

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_start failed: {e}", exc_info=True)
            yield _sse("error", {"message": "Failed to start story. Please try again."})

    return EventSourceResponse(event_generator())


@router.get("/stream/continue")
async def stream_continue_story(
    story_id: str,
    choice_id: str = "",
    free_input: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Continue a story with SSE streaming.

    Streams pipeline progress as the next chapter is generated.
    """
    # Ownership check before streaming starts
    from app.main import get_db as _get_db
    _db = _get_db()
    _story = _db.get_story(story_id)
    if not _story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(_story.user_id, current_user)

    async def event_generator():
        from app.main import get_db
        from app.engine.orchestrator import StoryOrchestrator

        db = get_db()

        try:
            story = db.get_story(story_id)
            if not story:
                yield _sse("error", {"message": "Story not found"})
                return

            # Resolve choice
            from app.models.story import Choice
            chosen_choice = None

            if choice_id:
                chapters = db.get_story_chapters(story_id)
                if chapters:
                    for c in chapters[-1].choices:
                        if c.id == choice_id:
                            chosen_choice = c
                            break

                if not chosen_choice:
                    yield _sse("error", {"message": f"Choice {choice_id} not found"})
                    return

            elif not free_input:
                yield _sse("error", {"message": "Either choice_id or free_input required"})
                return

            yield _sse("status", {"stage": "loading", "message": "Đang tải trạng thái..."})
            await asyncio.sleep(0.1)

            yield _sse("status", {"stage": "pipeline", "message": "Đang tạo chương mới..."})

            orch = StoryOrchestrator(db)
            result = await orch.generate_chapter(
                story_id=story_id,
                user_id=story.user_id,
                choice=chosen_choice,
                free_input=free_input,
            )

            # Stream prose in chunks
            prose = result.chapter.prose
            chunk_size = 50
            for i in range(0, len(prose), chunk_size):
                chunk = prose[i:i + chunk_size]
                yield _sse("prose", {"text": chunk, "offset": i})
                await asyncio.sleep(0.03)

            # Send choices
            yield _sse("choices", {
                "choices": [
                    {
                        "id": c.id,
                        "text": c.text,
                        "risk_level": c.risk_level,
                        "consequence_hint": c.consequence_hint,
                    }
                    for c in result.chapter.choices
                ]
            })

            # Send metadata
            yield _sse("metadata", {
                "story_id": story_id,
                "chapter_id": result.chapter.id,
                "chapter_number": result.chapter.chapter_number,
                "chapter_title": result.chapter.title,
                "critic_score": result.chapter.critic_score,
                "rewrite_count": result.chapter.rewrite_count,
            })

            # Identity update
            if result.identity_delta_summary:
                yield _sse("identity", result.identity_delta_summary)

            # CRNG event
            if result.crng_result and result.crng_result.triggered:
                yield _sse("crng", {
                    "event_type": result.crng_result.event_type,
                    "affinity_tag": result.crng_result.affinity_tag,
                    "details": result.crng_result.details,
                })

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_continue failed: {e}", exc_info=True)
            yield _sse("error", {"message": "Failed to generate chapter. Please try again."})

    return EventSourceResponse(event_generator())


def _sse(event: str, data: dict) -> dict:
    """Format an SSE event."""
    return {
        "event": event,
        "data": json.dumps(data, ensure_ascii=False),
    }
