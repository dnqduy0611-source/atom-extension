"""Scene-based SSE + REST endpoints for scene-by-scene chapter generation.

SSE Events:
  - status:     Pipeline stage updates ("Planning...", "Writing scene 1/4...")
  - scene:      Complete scene data (prose + choices) after each scene is written
  - scene_prose: Typewriter chunks for current scene's prose
  - choices:    Choices for the latest scene
  - metadata:   Chapter metadata after all scenes complete
  - identity:   Identity delta summary
  - done:       Stream complete
"""

from __future__ import annotations

import asyncio
import json
import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.models.story import (
    ChoiceResponse,
    SceneChapterResponse,
    SceneResponse,
)

from app.security import assert_owns_story, assert_owns_user, get_guest_or_user, get_guest_or_user_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/story", tags=["scene"])

# Heartbeat interval for SSE keep-alive (seconds)
_HEARTBEAT_INTERVAL = 8


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _scene_to_response(scene) -> SceneResponse:
    """Convert a Scene model to API response."""
    return SceneResponse(
        id=scene.id,
        chapter_id=scene.chapter_id,
        scene_number=scene.scene_number,
        title=scene.title or "",
        prose=scene.prose,
        scene_type=scene.scene_type,
        choices=[
            ChoiceResponse(
                id=c.id,
                text=c.text,
                risk_level=c.risk_level,
                consequence_hint=c.consequence_hint or "",
            )
            for c in scene.choices
        ],
        chosen_choice_id=scene.chosen_choice_id,
        is_chapter_end=scene.is_chapter_end,
        tension=scene.tension,
        mood=scene.mood,
        critic_score=scene.critic_score,
        rewrite_count=scene.rewrite_count,
    )


def _build_scene_chapter_response(chapter, scenes) -> SceneChapterResponse:
    """Build a SceneChapterResponse from chapter + scenes."""
    return SceneChapterResponse(
        chapter_id=chapter.id,
        chapter_number=chapter.chapter_number or chapter.number,
        chapter_title=chapter.title or "",
        total_scenes=len(scenes),
        scenes=[_scene_to_response(s) for s in scenes],
    )


def _sse(event: str, data: dict) -> dict:
    """Format an SSE event."""
    return {
        "event": event,
        "data": json.dumps(data, ensure_ascii=False),
    }


async def _stream_scene_typewriter(scene, scene_num, total, combat_data=None):
    """Yield SSE events for a single scene: status → typewriter prose → scene complete."""
    # Scene start
    yield _sse("status", {
        "stage": "scene",
        "message": f"Scene {scene_num}/{total}: {scene.title or scene.scene_type}",
        "scene_number": scene_num,
        "total_scenes": total,
    })

    # Typewriter prose for this scene
    prose = scene.prose
    chunk_size = 40
    for j in range(0, len(prose), chunk_size):
        chunk = prose[j:j + chunk_size]
        yield _sse("scene_prose", {
            "text": chunk,
            "offset": j,
            "scene_number": scene_num,
        })
        await asyncio.sleep(0.02)

    # Complete scene data
    scene_event = {
        "scene_number": scene_num,
        "total_scenes": total,
        "id": scene.id,
        "title": scene.title or "",
        "prose": scene.prose,
        "scene_type": scene.scene_type,
        "is_chapter_end": scene.is_chapter_end,
        "tension": scene.tension,
        "mood": scene.mood,
        "choices": [
            {
                "id": c.id,
                "text": c.text,
                "risk_level": c.risk_level,
                "consequence_hint": c.consequence_hint or "",
            }
            for c in scene.choices
        ],
    }

    # Add combat metadata if present
    if combat_data:
        scene_event["encounter_type"] = combat_data.get("encounter_type", "")
        scene_event["phase_count"] = combat_data.get("phases", 0)
        scene_event["final_outcome"] = combat_data.get("final_outcome", "")
        scene_event["fate_fired"] = combat_data.get("fate_fired", False)
        scene_event["defeat"] = combat_data.get("defeat")

    yield _sse("scene", scene_event)
    await asyncio.sleep(0.1)


# ──────────────────────────────────────────────
# REST: Create Story (no generation)
# ──────────────────────────────────────────────

@router.post("/create")
async def create_story(
    user_id: str,
    preference_tags: str = "",
    backstory: str = "",
    protagonist_name: str = "",
    tone: str = "",
    current_user: str = Depends(get_guest_or_user),
):
    """Create a new story shell without generating any content.

    Used by Phase B interactive flow: create story → scene-first → scene-next.
    """
    assert_owns_user(user_id, current_user)
    from app.main import get_db
    from app.models.story import Story

    db = get_db()
    tags_list = [t.strip() for t in preference_tags.split(",") if t.strip()] if preference_tags else []

    story = Story(
        user_id=user_id,
        preference_tags=tags_list,
        backstory=backstory,
        tone=tone,
        protagonist_name=protagonist_name or "Nhân vật chính",
    )
    db.create_story(story)
    logger.info(f"Story created: {story.id} for user {user_id}")

    return {
        "story_id": story.id,
        "protagonist_name": story.protagonist_name,
        "preference_tags": story.preference_tags,
    }


# ──────────────────────────────────────────────
# SSE: Stream Scene-by-Scene Start
# ──────────────────────────────────────────────

@router.get("/stream/scene-start")
async def stream_scene_start(
    user_id: str,
    preference_tags: str = "",
    backstory: str = "",
    protagonist_name: str = "",
    tone: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Start a new story with scene-based SSE streaming.

    Runs generate_scene_chapter in a background task with heartbeats
    to prevent SSE timeouts.
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
            tags_list = [t.strip() for t in preference_tags.split(",") if t.strip()] if preference_tags else []

            # Create story
            from app.models.story import Story
            story = Story(
                user_id=user_id,
                preference_tags=tags_list,
                backstory=backstory,
                tone=tone,
                protagonist_name=protagonist_name or "Nhân vật chính",
            )
            db.create_story(story)

            yield _sse("status", {"stage": "planning", "message": "Đang lập dàn ý chương 1..."})

            # Run generation in background → heartbeat while waiting
            result_holder = {"result": None, "error": None}

            async def _run_generation():
                try:
                    result_holder["result"] = await orch.generate_scene_chapter(
                        story_id=story.id,
                        user_id=user_id,
                    )
                except Exception as e:
                    result_holder["error"] = e

            gen_task = asyncio.create_task(_run_generation())

            # Send heartbeats while waiting for generation
            heartbeat_count = 0
            pipeline_messages = [
                "Đang lập dàn ý chương 1...",
                "Đang xây dựng cốt truyện...",
                "Đang tạo các cảnh...",
                "Đợi xíu nhé, AI đang viết...",
                "Sắp xong rồi...",
            ]
            while not gen_task.done():
                await asyncio.sleep(_HEARTBEAT_INTERVAL)
                if not gen_task.done():
                    msg = pipeline_messages[min(heartbeat_count, len(pipeline_messages) - 1)]
                    yield _sse("status", {
                        "stage": "generating",
                        "message": msg,
                    })
                    heartbeat_count += 1

            # Check for errors
            if result_holder["error"]:
                raise result_holder["error"]

            result = result_holder["result"]

            # Update story title from chapter
            if result.chapter.title:
                story.title = result.chapter.title
                db.conn.execute(
                    "UPDATE stories SET title = ? WHERE id = ?",
                    (story.title, story.id)
                )
                db.conn.commit()

            # Stream each scene with typewriter
            logger.info(f"Streaming {len(result.scenes)} scenes to client")
            for i, scene in enumerate(result.scenes):
                logger.info(f"Streaming scene {i+1}/{len(result.scenes)}: {scene.id}")
                async for event in _stream_scene_typewriter(scene, i + 1, len(result.scenes)):
                    yield event
                logger.info(f"Scene {i+1} stream complete")

            # Send metadata
            yield _sse("metadata", {
                "story_id": story.id,
                "story_title": story.title or "",
                "chapter_id": result.chapter.id,
                "chapter_number": result.chapter.chapter_number or 1,
                "chapter_title": result.chapter.title or "",
                "total_scenes": len(result.scenes),
                "preference_tags": story.preference_tags,
            })

            # Identity update
            if result.identity_delta_summary:
                yield _sse("identity", result.identity_delta_summary)

            # CRNG
            if result.crng_result and result.crng_result.triggered:
                yield _sse("crng", {
                    "event_type": result.crng_result.event_type,
                    "affinity_tag": result.crng_result.affinity_tag,
                    "details": result.crng_result.details,
                })

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_scene_start failed: {e}", exc_info=True)
            yield _sse("error", {"message": str(e)})

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# SSE: Stream Scene-by-Scene Continue
# ──────────────────────────────────────────────

@router.get("/stream/scene-continue")
async def stream_scene_continue(
    story_id: str,
    choice_id: str = "",
    free_input: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Continue a story with scene-based SSE streaming.

    Generates the next chapter scene-by-scene, streaming each
    scene as it completes.
    """
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
                    last_chapter = chapters[-1]
                    for c in last_chapter.choices:
                        if c.id == choice_id:
                            chosen_choice = c
                            break

                    if not chosen_choice:
                        scenes = db.get_chapter_scenes(last_chapter.id)
                        if scenes:
                            for c in scenes[-1].choices:
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

            yield _sse("status", {"stage": "planning", "message": "Đang lập dàn ý chương mới..."})

            # Run generation in background → heartbeat while waiting
            result_holder = {"result": None, "error": None}

            async def _run_generation():
                try:
                    orch = StoryOrchestrator(db)
                    result_holder["result"] = await orch.generate_scene_chapter(
                        story_id=story_id,
                        user_id=story.user_id,
                        choice=chosen_choice,
                        free_input=free_input,
                    )
                except Exception as e:
                    result_holder["error"] = e

            gen_task = asyncio.create_task(_run_generation())

            # Send heartbeats while waiting
            heartbeat_count = 0
            pipeline_messages = [
                "Đang lập dàn ý chương mới...",
                "Đang tạo các cảnh...",
                "AI đang viết tiếp...",
                "Đợi xíu nhé...",
                "Sắp xong rồi...",
            ]
            while not gen_task.done():
                await asyncio.sleep(_HEARTBEAT_INTERVAL)
                if not gen_task.done():
                    msg = pipeline_messages[min(heartbeat_count, len(pipeline_messages) - 1)]
                    yield _sse("status", {
                        "stage": "generating",
                        "message": msg,
                    })
                    heartbeat_count += 1

            if result_holder["error"]:
                raise result_holder["error"]

            result = result_holder["result"]

            # Stream each scene
            for i, scene in enumerate(result.scenes):
                async for event in _stream_scene_typewriter(scene, i + 1, len(result.scenes)):
                    yield event

            # Metadata
            yield _sse("metadata", {
                "story_id": story_id,
                "chapter_id": result.chapter.id,
                "chapter_number": result.chapter.chapter_number or result.chapter.number,
                "chapter_title": result.chapter.title or "",
                "total_scenes": len(result.scenes),
            })

            # Identity
            if result.identity_delta_summary:
                yield _sse("identity", result.identity_delta_summary)

            # CRNG
            if result.crng_result and result.crng_result.triggered:
                yield _sse("crng", {
                    "event_type": result.crng_result.event_type,
                    "affinity_tag": result.crng_result.affinity_tag,
                    "details": result.crng_result.details,
                })

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_scene_continue failed: {e}", exc_info=True)
            yield _sse("error", {"message": str(e)})

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# SSE: Interactive Per-Scene (Phase B)
# ──────────────────────────────────────────────

@router.get("/stream/scene-first")
async def stream_scene_first(
    story_id: str,
    user_id: str,
    choice_id: str = "",
    free_input: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Plan a new chapter + generate scene 1 only.

    This endpoint:
    1. Runs the planner to create beats
    2. Generates ONLY scene 1
    3. Streams scene 1 prose + choices
    4. Frontend then calls scene-next for subsequent scenes
    """
    assert_owns_user(user_id, current_user)
    # Also verify story_id belongs to current_user (user_id check alone is not enough)
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

            # Resolve choice (from last chapter's last scene)
            from app.models.story import Choice
            chosen_choice = None

            if choice_id:
                chapters = db.get_story_chapters(story_id)
                if chapters:
                    last_chapter = chapters[-1]
                    # Check chapter-level choices
                    for c in last_chapter.choices:
                        if c.id == choice_id:
                            chosen_choice = c
                            break
                    # Check scene-level choices
                    if not chosen_choice:
                        scenes = db.get_chapter_scenes(last_chapter.id)
                        if scenes:
                            for c in scenes[-1].choices:
                                if c.id == choice_id:
                                    chosen_choice = c
                                    break

            yield _sse("status", {"stage": "planning", "message": "Đang lập dàn ý chương mới..."})
            await asyncio.sleep(0.1)

            orch = StoryOrchestrator(db)

            # ── Step 1: Plan chapter ──
            result_holder = {"result": None, "error": None}

            async def _run_plan():
                try:
                    result_holder["result"] = await orch.generate_chapter_plan(
                        story_id=story_id,
                        user_id=user_id,
                        choice=chosen_choice,
                        free_input=free_input,
                    )
                except Exception as e:
                    result_holder["error"] = e

            plan_task = asyncio.create_task(_run_plan())

            # Heartbeat during planning
            heartbeat_count = 0
            plan_messages = [
                "Đang lập dàn ý chương mới...",
                "Đang phân tích cốt truyện...",
                "Đang tạo các beat...",
                "Sắp xong...",
            ]
            while not plan_task.done():
                await asyncio.sleep(_HEARTBEAT_INTERVAL)
                if not plan_task.done():
                    msg = plan_messages[min(heartbeat_count, len(plan_messages) - 1)]
                    yield _sse("status", {"stage": "planning", "message": msg})
                    heartbeat_count += 1

            if result_holder["error"]:
                raise result_holder["error"]

            plan_result = result_holder["result"]
            chapter = plan_result.chapter

            yield _sse("status", {
                "stage": "planned",
                "message": f"Đã lập dàn ý: {plan_result.total_scenes} scenes",
                "total_scenes": plan_result.total_scenes,
            })

            # ── Step 2: Generate scene 1 ──
            yield _sse("status", {
                "stage": "scene",
                "message": f"Đang viết Scene 1/{plan_result.total_scenes}...",
                "scene_number": 1,
                "total_scenes": plan_result.total_scenes,
            })

            scene_holder = {"result": None, "error": None}

            async def _run_scene():
                try:
                    scene_holder["result"] = await orch.generate_single_scene(
                        story_id=story_id,
                        chapter_id=chapter.id,
                        scene_number=1,
                        choice=chosen_choice,
                    )
                except Exception as e:
                    scene_holder["error"] = e

            scene_task = asyncio.create_task(_run_scene())

            # Heartbeat during scene generation
            heartbeat_count = 0
            scene_messages = [
                f"Đang viết Scene 1/{plan_result.total_scenes}...",
                "AI đang sáng tạo...",
                "Đợi xíu nhé...",
            ]
            while not scene_task.done():
                await asyncio.sleep(_HEARTBEAT_INTERVAL)
                if not scene_task.done():
                    msg = scene_messages[min(heartbeat_count, len(scene_messages) - 1)]
                    yield _sse("status", {"stage": "writing", "message": msg})
                    heartbeat_count += 1

            if scene_holder["error"]:
                raise scene_holder["error"]

            scene_result = scene_holder["result"]

            # Stream the scene with typewriter
            async for event in _stream_scene_typewriter(
                scene_result.scene, 1, plan_result.total_scenes
            ):
                yield event

            # Metadata
            yield _sse("metadata", {
                "story_id": story_id,
                "chapter_id": chapter.id,
                "chapter_number": chapter.chapter_number,
                "chapter_title": chapter.title or "",
                "total_scenes": plan_result.total_scenes,
            })

            # CRNG
            if plan_result.crng_result and plan_result.crng_result.triggered:
                yield _sse("crng", {
                    "event_type": plan_result.crng_result.event_type,
                    "affinity_tag": plan_result.crng_result.affinity_tag,
                    "details": plan_result.crng_result.details,
                })

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_scene_first failed: {e}", exc_info=True)
            yield _sse("error", {"message": str(e)})

    return EventSourceResponse(event_generator())


@router.get("/stream/scene-next")
async def stream_scene_next(
    story_id: str,
    chapter_id: str,
    scene_number: int,
    choice_id: str = "",
    free_input: str = "",
    combat_decisions: str = "",
    current_user: str = Depends(get_guest_or_user_sse),
):
    """Generate the next scene in an existing chapter.

    The choice_id is the user's selection from the PREVIOUS scene,
    which feeds into the SceneWriter prompt to ensure narrative
    continuity and skill usage consequences.
    """
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
            # Resolve choice from previous scene
            from app.models.story import Choice
            chosen_choice = None

            if choice_id:
                scenes = db.get_chapter_scenes(chapter_id)
                if scenes:
                    for s in scenes:
                        for c in s.choices:
                            if c.id == choice_id:
                                chosen_choice = c
                                break
                        if chosen_choice:
                            break

                # Also check chapter-level choices
                if not chosen_choice:
                    chapter = db.get_chapter(chapter_id)
                    if chapter:
                        for c in chapter.choices:
                            if c.id == choice_id:
                                chosen_choice = c
                                break

            yield _sse("status", {
                "stage": "scene",
                "message": f"Đang viết Scene {scene_number}...",
                "scene_number": scene_number,
            })
            await asyncio.sleep(0.1)

            orch = StoryOrchestrator(db)

            # Generate the scene
            result_holder = {"result": None, "error": None}

            async def _run_scene():
                try:
                    # Parse combat decisions if provided
                    parsed_decisions = None
                    if combat_decisions:
                        import json as _json
                        try:
                            parsed_decisions = _json.loads(combat_decisions)
                        except Exception:
                            logger.warning(f"Invalid combat_decisions JSON: {combat_decisions[:100]}")

                    result_holder["result"] = await orch.generate_single_scene(
                        story_id=story_id,
                        chapter_id=chapter_id,
                        scene_number=scene_number,
                        choice=chosen_choice,
                        free_input=free_input,
                        combat_decisions=parsed_decisions,
                    )
                except Exception as e:
                    result_holder["error"] = e

            scene_task = asyncio.create_task(_run_scene())

            # Heartbeat during generation
            heartbeat_count = 0
            while not scene_task.done():
                await asyncio.sleep(_HEARTBEAT_INTERVAL)
                if not scene_task.done():
                    yield _sse("status", {
                        "stage": "writing",
                        "message": f"Đang viết Scene {scene_number}...",
                    })
                    heartbeat_count += 1

            if result_holder["error"]:
                raise result_holder["error"]

            scene_result = result_holder["result"]

            # Stream the scene with typewriter
            async for event in _stream_scene_typewriter(
                scene_result.scene, scene_number, scene_result.total_scenes,
                combat_data=scene_result.combat_data,
            ):
                yield event

            # Identity (only on last scene)
            if scene_result.identity_delta_summary:
                yield _sse("identity", scene_result.identity_delta_summary)

            yield _sse("done", {"ok": True})

        except Exception as e:
            logger.error(f"stream_scene_next failed: {e}", exc_info=True)
            yield _sse("error", {"message": str(e)})

    return EventSourceResponse(event_generator())


# ──────────────────────────────────────────────
# REST: Get Chapter Scenes
# ──────────────────────────────────────────────

@router.get("/{story_id}/scenes/{chapter_id}", response_model=SceneChapterResponse)
async def get_chapter_scenes(story_id: str, chapter_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get all scenes for a specific chapter."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(story.user_id, current_user)

    chapter = db.get_chapter(chapter_id)
    if not chapter or chapter.story_id != story_id:
        raise HTTPException(status_code=404, detail="Chapter not found")

    scenes = db.get_chapter_scenes(chapter_id)
    return _build_scene_chapter_response(chapter, scenes)


@router.get("/{story_id}/all-scenes")
async def get_all_story_scenes(story_id: str, current_user: str = Depends(get_guest_or_user)):
    """Get all chapters with their scenes for a story."""
    from app.main import get_db

    db = get_db()
    story = db.get_story(story_id)
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    assert_owns_story(story.user_id, current_user)

    chapters = db.get_story_chapters(story_id)
    result = []
    for chapter in chapters:
        scenes = db.get_chapter_scenes(chapter.id)
        result.append(_build_scene_chapter_response(chapter, scenes))

    return {"story_id": story_id, "chapters": result}
