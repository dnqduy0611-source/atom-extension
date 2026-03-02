"""Orchestration service — ties CRNG, Fate Buffer, Pipeline, and DB together.

This is the central coordinator that:
1. Loads player state
2. Runs CRNG rolls
3. Gets Fate Buffer instructions
4. Builds pipeline input
5. Runs the LangGraph pipeline
6. Saves results (chapter, identity delta, flags)
7. Updates player state
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass

from app.config import settings
from app.engine.crng import CRNGEngine, CRNGResult
from app.engine.fate_buffer import FateBuffer
from app.memory.encoding import build_rolling_summary, encode_chapter_from_state
from app.memory.state import StoryStateDB
from app.memory.story_brain import get_or_create_brain
from app.models.identity import IdentityEvent, IdentityEventType, apply_delta
from app.models.pipeline import NarrativeState
from app.models.player import PlayerState
from app.models.story import Chapter, Choice, Scene, Story
from app.narrative.pipeline import run_pipeline
from app.narrative.scene_writer import SceneWriterInput, run_scene_writer

# Combat engine (Phase A + B)
from app.engine.combat import (
    CombatBrief,
    EnemyProfile,
    Intensity,
    build_combat_brief,
    run_resolution_combat,
    build_combat_result,
)
from app.models.combat import (
    CombatApproach,
    EncounterType,
)
from app.models.power import (
    CombatMetrics,
    NormalSkill,
    ResonanceState,
)

logger = logging.getLogger(__name__)


@dataclass
class ChapterResult:
    """Result of generating a chapter."""
    chapter: Chapter
    state: NarrativeState
    identity_delta_summary: dict | None = None
    crng_result: CRNGResult | None = None


@dataclass
class SceneChapterResult:
    """Result of generating a full chapter via scene-by-scene loop."""
    chapter: Chapter
    scenes: list[Scene]
    identity_delta_summary: dict | None = None
    crng_result: CRNGResult | None = None


@dataclass
class ChapterPlanResult:
    """Result of running the planner only (no scene prose yet)."""
    chapter: Chapter
    total_scenes: int
    crng_result: CRNGResult | None = None
    identity_delta_summary: dict | None = None
    # Internal: kept for finalize step
    _pipeline_state: NarrativeState | None = None


@dataclass
class SingleSceneResult:
    """Result of generating one scene."""
    scene: Scene
    scene_number: int
    total_scenes: int
    is_chapter_end: bool
    # Only populated for last scene
    identity_delta_summary: dict | None = None
    # Combat metadata (populated for combat scenes)
    combat_data: dict | None = None
    # Skill Evolution events (populated when evolution triggered)
    skill_evolution_event: dict | None = None
    # Resonance Mastery events (populated after combat)
    resonance_events: dict | None = None
    # Mutation arc state (populated when mutation in progress)
    mutation_arc_info: dict | None = None
    # Integration options (at rest scenes with eligible pairs)
    integration_options: list[dict] | None = None
    # Awakening results (when affinity awakens compatible skills)
    awakening_results: list[dict] | None = None


class StoryOrchestrator:
    """Central coordinator for chapter generation.

    Usage:
        orch = StoryOrchestrator(db)
        result = await orch.generate_chapter(
            story_id="abc123",
            user_id="user1",
            choice=some_choice,
            free_input="",
        )
    """

    def __init__(self, db: StoryStateDB) -> None:
        self.db = db
        self.crng = CRNGEngine(
            pity_base_chance=settings.pity_base_chance,
            pity_increment=settings.pity_increment,
            pity_max_bonus=settings.pity_max_bonus,
            breakthrough_threshold=settings.breakthrough_threshold,
        )
        self.fate = FateBuffer(
            start_decay_chapter=settings.fate_buffer_start_decay,
            decay_rate=settings.fate_buffer_decay_rate,
        )

    # ── WorldState loading (for adaptive context) ──

    def _load_world_state_safe(self, story_id: str):
        """Load WorldState for adaptive context. Returns None on failure."""
        try:
            from app.memory.world_state_store import load_world_state
            return load_world_state(story_id)
        except Exception:
            return None

    def _get_prev_chapter_ending(self, chapters: list) -> str:
        """Return the prose of the last scene in the most recent chapter.

        Used to bridge chapter-to-chapter continuity — the planner and
        SceneWriter for chapter N receive the actual ending prose of chapter N-1
        instead of relying solely on the rolling text summary.
        """
        if not chapters:
            return ""
        prev_ch = chapters[-1]
        try:
            last_scene = self.db.get_latest_scene(prev_ch.id)
            if last_scene and last_scene.prose:
                logger.info(
                    f"Cross-chapter bridge: loaded last scene of chapter "
                    f"{prev_ch.chapter_number} ({len(last_scene.prose)} chars)"
                )
                return last_scene.prose
        except Exception as e:
            logger.warning(f"Cross-chapter bridge: failed to load last scene ({e})")
        return ""

    # ── Skill reward planning ──

    def _compute_skill_reward(
        self,
        player,
        crng_result,
    ) -> dict | None:
        """Compute skill reward plan from player state + CRNG result."""
        if not player:
            return None
        try:
            from app.engine.skill_discovery import plan_skill_reward
            plan = plan_skill_reward(
                owned_skill_ids=player.owned_skill_ids,
                resonance=player.resonance,
                total_chapters=player.total_chapters,
                chapters_since_last_skill=player.chapters_since_last_skill,
                current_rank=player.current_rank,
                current_floor=player.current_floor,
                combat_count_since_rest=player.combat_count_since_rest,
                has_crng_breakthrough=(
                    crng_result.triggered
                    and getattr(crng_result, 'event_type', '') == 'breakthrough'
                ),
            )
            if plan.should_reward:
                logger.info(f"Skill reward planned: source={plan.source}, candidates={len(plan.candidate_ids)}")
                return plan.model_dump()
        except Exception as exc:
            logger.warning(f"Skill reward planning failed: {exc}")
        return None

    async def start_new_story(
        self,
        user_id: str,
        preference_tags: list[str] | None = None,
        backstory: str = "",
        protagonist_name: str = "",
        tone: str = "",
    ) -> tuple[Story, ChapterResult] | tuple[Story, SceneChapterResult]:
        """Create a new story and generate chapter 1.

        Returns (Story, ChapterResult) or (Story, SceneChapterResult)
        depending on settings.scene_mode.
        """
        # Create story
        story = Story(
            user_id=user_id,
            preference_tags=preference_tags or [],
            backstory=backstory,
            tone=tone,
            protagonist_name=protagonist_name or "Nhân vật chính",
        )
        self.db.create_story(story)
        logger.info(f"Story created: {story.id} (scene_mode={settings.scene_mode})")

        if settings.scene_mode:
            # Scene-based chapter generation
            result = await self.generate_scene_chapter(
                story_id=story.id,
                user_id=user_id,
            )
            # Update story title from first scene
            if result.scenes and result.scenes[0].title:
                story.title = result.scenes[0].title
                self.db.conn.execute(
                    "UPDATE stories SET title = ? WHERE id = ?",
                    (story.title, story.id)
                )
                self.db.conn.commit()
            return story, result
        else:
            # Legacy monolithic chapter
            result = await self.generate_chapter(
                story_id=story.id,
                user_id=user_id,
            )
            if result.state.writer_output and result.state.writer_output.chapter_title:
                story.title = result.state.writer_output.chapter_title
                self.db.conn.execute(
                    "UPDATE stories SET title = ? WHERE id = ?",
                    (story.title, story.id)
                )
                self.db.conn.commit()
            return story, result

    async def generate_chapter(
        self,
        story_id: str,
        user_id: str,
        choice: Choice | None = None,
        free_input: str = "",
    ) -> ChapterResult:
        """Generate a chapter — the main orchestration flow.

        Steps:
        1. Load story + player state
        2. Build rolling summary from previous chapters
        3. CRNG roll
        4. Fate Buffer check
        5. Run pipeline
        6. Save chapter
        7. Apply identity delta + save player
        8. Store in NeuralMemory
        """
        # ── 1. Load state ──
        story = self.db.get_story(story_id)
        if not story:
            raise ValueError(f"Story {story_id} not found")

        player = self.db.get_player_by_user(user_id)
        chapters = self.db.get_story_chapters(story_id)
        chapter_number = len(chapters) + 1

        # Rate limiting
        if chapter_number > settings.max_chapters_per_story:
            raise ValueError(f"Story has reached max chapters ({settings.max_chapters_per_story})")

        # ── 2. Rolling summary ──
        previous_summary = build_rolling_summary(chapters)

        # ── 2b. Semantic memory query ──
        brain = await get_or_create_brain(story_id, story.brain_id)
        if brain.available:
            query_text = choice.text if choice else free_input or f"Chương {chapter_number}"
            semantic_ctx = await brain.query_context(query_text)
            if semantic_ctx:
                previous_summary += f"\n\n{semantic_ctx}"

        # ── 2c. Previous chapter ending prose (cross-chapter continuity) ──
        previous_chapter_ending = self._get_prev_chapter_ending(chapters)

        # ── 3. CRNG roll ──
        crng_result = CRNGResult()
        crng_event = {}
        if player:
            crng_result = self.crng.roll_chapter_events(player)
            if crng_result.triggered:
                crng_event = {
                    "triggered": True,
                    "event_type": crng_result.event_type,
                    "affinity_tag": crng_result.affinity_tag,
                    "details": crng_result.details,
                }
                logger.info(f"CRNG: {crng_result.event_type} triggered!")

        # ── 4. Fate Buffer ──
        fate_instruction = ""
        if player:
            fate_status = self.fate.get_status(player)
            fate_instruction = fate_status.narrative_instruction

        # ── 4b. Skill reward planning ──
        skill_reward_plan = self._compute_skill_reward(player, crng_result)

        # ── 5. Build pipeline input ──
        pipeline_input = {
            "story_id": story_id,
            "chapter_number": chapter_number,
            "preference_tags": story.preference_tags,
            "backstory": story.backstory,
            "protagonist_name": story.protagonist_name,
            "chosen_choice": choice,
            "previous_summary": previous_summary,
            "previous_chapter_ending": previous_chapter_ending,
            "free_input": free_input,
            "player_state": player.model_dump() if player else None,
            "crng_event": crng_event,
            "fate_instruction": fate_instruction,
            "tone": story.tone,
            "skill_reward_plan": skill_reward_plan,
            "player_gender": player.gender if player else "neutral",
        }

        # ── 5b. Inject adaptive context ──
        # Planner gets full metadata dump (format_adaptive_prompt).
        # Writer gets narrative texture (format_writer_context) — separate field.
        if player:
            try:
                from app.engine.adaptive_context_builder import (
                    build_adaptive_context,
                    format_adaptive_prompt,
                    format_writer_context,
                )
                adaptive_ctx = build_adaptive_context(player, world_state=self._load_world_state_safe(story_id))
                pipeline_input["adaptive_context"] = format_adaptive_prompt(adaptive_ctx)
                pipeline_input["writer_adaptive_context"] = format_writer_context(adaptive_ctx)
            except Exception as exc:
                logger.warning(f"Adaptive context build failed: {exc}")

        # ── 6. Run pipeline ──
        logger.info(f"Pipeline: starting chapter {chapter_number} for story {story_id}")
        state = await run_pipeline(pipeline_input)

        # ── 7. Save chapter ──
        chapter = encode_chapter_from_state(state)
        chapter.story_id = story_id
        chapter.chapter_number = chapter_number
        chapter.number = chapter_number
        chapter.chosen_choice = choice

        if state.critic_output:
            chapter.critic_score = state.critic_output.score
        chapter.rewrite_count = state.rewrite_count

        self.db.save_chapter(chapter)
        logger.info(f"Chapter {chapter_number} saved: {chapter.id}")

        # ── 7b. Update companion affinity from chapter ──
        _companion_deltas: dict[str, int] = {}
        if state.consequence_output and state.consequence_output.companion_affinity_deltas:
            _companion_deltas = state.consequence_output.companion_affinity_deltas
        elif state.simulator_output and state.simulator_output.companion_affinity_deltas:
            _companion_deltas = state.simulator_output.companion_affinity_deltas
        elif state.companion_affinity_deltas:
            _companion_deltas = state.companion_affinity_deltas
        if _companion_deltas:
            try:
                from app.memory.companion_store import batch_update_affinity
                from app.narrative.companion_context import TONE_AFFINITY_MULTIPLIER
                tone_mult = TONE_AFFINITY_MULTIPLIER.get(story.tone or "", 1.0)
                batch_update_affinity(
                    self.db, story_id, _companion_deltas,
                    chapter=chapter_number, tone_multiplier=tone_mult,
                )
                logger.info(f"Companion affinity updated: {_companion_deltas}")
            except Exception as exc:
                logger.warning(f"Companion affinity update failed: {exc}")

        # ── 8. Apply identity delta ──
        identity_delta_summary = None
        if player and state.identity_delta:
            delta = state.identity_delta

            # Apply delta to player
            updated_player = apply_delta(player, delta)
            updated_player.total_chapters += 1

            # Update skill reward timing counters
            if skill_reward_plan:
                updated_player.chapters_since_last_skill = 0
            else:
                updated_player.chapters_since_last_skill += 1

            # Pity counter
            if delta.pity_reset:
                updated_player.pity_counter = 0
            else:
                updated_player.pity_counter += 1

            # Update player in DB
            self.db.update_player(updated_player)

            # ── 8b. Update play style from chapter choice ──
            try:
                from app.engine.play_style_engine import update_play_style
                consequence_tags = delta.new_flags or []
                risk = choice.risk_level if choice else 1
                choice_type = choice.choice_type if choice else "narrative"
                updated_player.play_style = update_play_style(
                    updated_player.play_style,
                    chosen_risk_level=risk,
                    choice_type=choice_type,
                    consequence_tags=consequence_tags,
                )
                self.db.update_player(updated_player)
            except Exception as exc:
                logger.warning(f"Play style update failed: {exc}")

            # ── 8c. Check archetype evolution ──
            try:
                from app.narrative.archetype_evolution_agent import check_archetype_evolution
                evo_event = check_archetype_evolution(updated_player)
                if evo_event:
                    logger.info(f"Archetype evolution event: {evo_event}")
                    # Store as identity event for planner to pick up
                    self.db.log_identity_event(IdentityEvent(
                        player_id=player.id,
                        event_type=IdentityEventType.DRIFT,
                        chapter_number=chapter_number,
                        description=(
                            f"ARCHETYPE_EVOLUTION: {evo_event['event']} "
                            f"→ {evo_event.get('target_form', '?')} "
                            f"({evo_event.get('path', '?')})"
                        ),
                        delta_snapshot=evo_event,
                    ))
            except Exception as exc:
                logger.warning(f"Archetype evolution check failed: {exc}")

            # Log identity event
            event = IdentityEvent(
                player_id=player.id,
                event_type=IdentityEventType.DRIFT,
                chapter_number=chapter_number,
                description=(
                    f"Ch.{chapter_number}: DQS={delta.dqs_change:+.1f} "
                    f"Coh={delta.coherence_change:+.1f} "
                    f"Inst={delta.instability_change:+.1f}"
                ),
                delta_snapshot=delta.model_dump(),
            )
            self.db.log_identity_event(event)

            # Log flags
            for flag_key in delta.new_flags:
                self.db.set_player_flag(player.id, flag_key, chapter_number)

            # Confrontation event
            if delta.confrontation_triggered:
                self.db.log_identity_event(IdentityEvent(
                    player_id=player.id,
                    event_type=IdentityEventType.CONFRONTATION,
                    chapter_number=chapter_number,
                    description="Identity instability reached critical threshold!",
                ))

            # Breakthrough event
            if delta.breakthrough_triggered:
                self.db.log_identity_event(IdentityEvent(
                    player_id=player.id,
                    event_type=IdentityEventType.BREAKTHROUGH,
                    chapter_number=chapter_number,
                    description="Breakthrough triggered!",
                ))
                # Reset breakthrough meter
                updated_player.breakthrough_meter = 0
                self.db.update_player(updated_player)

            identity_delta_summary = {
                "dqs": delta.dqs_change,
                "coherence": delta.coherence_change,
                "instability": delta.instability_change,
                "breakthrough": delta.breakthrough_change,
                "confrontation": delta.confrontation_triggered,
                "breakthrough_triggered": delta.breakthrough_triggered,
            }

        # ── 9. Store in NeuralMemory ──
        if brain.available:
            await brain.store_chapter_summary(
                chapter_number=chapter_number,
                summary=chapter.summary,
                choice_text=choice.text if choice else free_input,
            )

        return ChapterResult(
            chapter=chapter,
            state=state,
            identity_delta_summary=identity_delta_summary,
            crng_result=crng_result,
        )

    # ══════════════════════════════════════════
    # Scene-Based Chapter Generation
    # ══════════════════════════════════════════

    async def generate_scene_chapter(
        self,
        story_id: str,
        user_id: str,
        choice: Choice | None = None,
        free_input: str = "",
    ) -> SceneChapterResult:
        """Generate a chapter scene-by-scene.

        Steps:
        1. Load story + player state
        2. CRNG + Fate Buffer
        3. Run planner pipeline (once per chapter)
        4. Scene loop: for each beat, generate scene via SceneWriter
        5. Save chapter + all scenes
        6. Apply identity deltas
        7. Store in NeuralMemory
        """
        import json as _json

        # ── 1. Load state ──
        story = self.db.get_story(story_id)
        if not story:
            raise ValueError(f"Story {story_id} not found")

        player = self.db.get_player_by_user(user_id)
        chapters = self.db.get_story_chapters(story_id)
        chapter_number = len(chapters) + 1

        if chapter_number > settings.max_chapters_per_story:
            raise ValueError(f"Story has reached max chapters ({settings.max_chapters_per_story})")

        # ── 2. Rolling summary (for planner) ──
        previous_summary = build_rolling_summary(chapters)

        # ── 2b. Semantic memory query ──
        brain = await get_or_create_brain(story_id, story.brain_id)
        if brain.available:
            query_text = choice.text if choice else free_input or f"Chương {chapter_number}"
            semantic_ctx = await brain.query_context(query_text)
            if semantic_ctx:
                previous_summary += f"\n\n{semantic_ctx}"

        # ── 2c. Previous chapter ending prose (cross-chapter continuity) ──
        previous_chapter_ending = self._get_prev_chapter_ending(chapters)

        # ── 3. CRNG + Fate Buffer ──
        crng_result = CRNGResult()
        crng_event = {}
        if player:
            crng_result = self.crng.roll_chapter_events(player)
            if crng_result.triggered:
                crng_event = {
                    "triggered": True,
                    "event_type": crng_result.event_type,
                    "affinity_tag": crng_result.affinity_tag,
                    "details": crng_result.details,
                }

        fate_instruction = ""
        if player:
            fate_status = self.fate.get_status(player)
            fate_instruction = fate_status.narrative_instruction

        # ── 3b. Skill reward planning ──
        skill_reward_plan = self._compute_skill_reward(player, crng_result)

        # ── 4. Run planner pipeline (once) ──
        pipeline_input = {
            "story_id": story_id,
            "chapter_number": chapter_number,
            "preference_tags": story.preference_tags,
            "backstory": story.backstory,
            "protagonist_name": story.protagonist_name,
            "chosen_choice": choice,
            "previous_summary": previous_summary,
            "previous_chapter_ending": previous_chapter_ending,
            "free_input": free_input,
            "player_state": player.model_dump() if player else None,
            "crng_event": crng_event,
            "fate_instruction": fate_instruction,
            "tone": story.tone,
            "skill_reward_plan": skill_reward_plan,
            "player_gender": player.gender if player else "neutral",
        }

        # ── 4b. Inject adaptive context ──
        # Planner gets full metadata dump (format_adaptive_prompt).
        # Scene writer gets narrative texture (format_writer_context) — separate string.
        _adaptive_ctx_writer = ""
        if player:
            try:
                from app.engine.adaptive_context_builder import (
                    build_adaptive_context,
                    format_adaptive_prompt,
                    format_writer_context,
                )
                adaptive_ctx = build_adaptive_context(player, world_state=self._load_world_state_safe(story_id))
                pipeline_input["adaptive_context"] = format_adaptive_prompt(adaptive_ctx)
                _adaptive_ctx_writer = format_writer_context(adaptive_ctx)
            except Exception as exc:
                logger.warning(f"Adaptive context build failed: {exc}")

        logger.info(f"Scene pipeline: running planner for chapter {chapter_number}")
        state = await run_pipeline(pipeline_input)

        planner_output = state.planner_output
        if not planner_output or not planner_output.beats:
            # Fallback to monolithic generation
            logger.warning("No planner output — falling back to monolithic chapter")
            return await self._fallback_to_monolithic(
                story_id, user_id, choice, free_input
            )

        beats = planner_output.beats
        total_scenes = len(beats)

        # ── 5. Create chapter shell ──
        chapter = Chapter(
            story_id=story_id,
            chapter_number=chapter_number,
            number=chapter_number,
            title=planner_output.chapter_title or f"Chương {chapter_number}",
            planner_outline=str(planner_output.model_dump()),
            planner_output_json=planner_output.model_dump_json(),
            total_scenes=total_scenes,
            chosen_choice=choice,
        )
        self.db.save_chapter(chapter)
        logger.info(f"Chapter {chapter_number} shell saved: {chapter.id}")

        # ── 6. Scene loop ──
        scenes: list[Scene] = []
        scene_choice = choice       # First scene uses the chapter-level choice
        identity_delta_summary = None

        # Extract skill info for scene writer
        skill_data = None
        if player and player.unique_skill:
            skill_data = player.unique_skill.model_dump()

        for i, beat in enumerate(beats):
            scene_number = i + 1
            is_chapter_end = (scene_number == total_scenes)
            scene_start = time.monotonic()

            # Build context from previous scenes in this chapter
            prev_prose = scenes[-1].prose if scenes else ""
            prev_prose_2 = scenes[-2].prose if len(scenes) >= 2 else ""

            # Cross-chapter continuity: for scene 1 of a new chapter (i==0),
            # use the last scene prose of the previous chapter so the writer
            # doesn't start completely cold
            if i == 0 and not prev_prose and chapter_number > 1:
                prev_prose = previous_chapter_ending

            # Edge case: beat has no description
            if not beat.description:
                logger.warning(f"Beat {i} has empty description — skipping")
                continue

            # ── Combat resolution (before writer) ──
            if beat.scene_type == "combat" and player:
                combat_summary = self._resolve_combat_for_beat(
                    player=player, beat=beat, floor=player.current_floor,
                )
                self.db.update_player(player)
                logger.info(
                    f"Combat resolved (scene loop): "
                    f"outcome={combat_summary.get('outcome', '?')}"
                )

            scene_input = SceneWriterInput(
                chapter_number=chapter_number,
                scene_number=scene_number,
                total_scenes=total_scenes,
                beat=beat,
                all_beats=beats,
                protagonist_name=story.protagonist_name,
                previous_scene_prose=prev_prose,
                previous_scene_prose_2=prev_prose_2,
                chosen_choice=scene_choice,
                is_chapter_end=is_chapter_end,
                player_state=player.model_dump() if player else None,
                unique_skill=skill_data,
                fate_instruction=fate_instruction,
                preference_tags=story.preference_tags,
                combat_brief=beat.combat_brief,
                adaptive_context=_adaptive_ctx_writer,
                tone=story.tone,
            )

            scene = await run_scene_writer(scene_input)
            scene.chapter_id = chapter.id

            # Save scene to DB
            self.db.save_scene(scene)
            scenes.append(scene)

            # Store scene in NeuralMemory
            if brain.available:
                await brain.store_scene(
                    scene_number=scene_number,
                    chapter_number=chapter_number,
                    prose=scene.prose,
                    scene_type=scene.scene_type,
                    choice_text=scene_choice.text if scene_choice else "",
                    title=scene.title or "",
                )

            elapsed = time.monotonic() - scene_start
            logger.info(
                f"Scene {scene_number}/{total_scenes} done in {elapsed:.1f}s — "
                f"{len(scene.prose)} chars, type={scene.scene_type}, "
                f"choices={len(scene.choices)}"
            )

            # For the next scene, the "choice" is None until player picks
            # In the non-interactive flow, we don't have choices between scenes
            scene_choice = None

        # ── 7. Update chapter with aggregated data ──
        combined_prose = "\n\n---\n\n".join(s.prose for s in scenes)
        combined_summary = (
            f"Chapter {chapter_number}: {len(scenes)} scenes. "
            f"Types: {', '.join(s.scene_type for s in scenes)}. "
            f"Final scene: {scenes[-1].title or 'untitled'}."
        )

        chapter.prose = combined_prose
        chapter.summary = combined_summary
        chapter.choices = scenes[-1].choices if scenes else []
        self.db.save_chapter(chapter)

        # ── 7b. Update companion affinity from chapter (scene mode) ──
        _companion_deltas: dict[str, int] = {}
        if state.consequence_output and state.consequence_output.companion_affinity_deltas:
            _companion_deltas = state.consequence_output.companion_affinity_deltas
        elif state.simulator_output and state.simulator_output.companion_affinity_deltas:
            _companion_deltas = state.simulator_output.companion_affinity_deltas
        elif state.companion_affinity_deltas:
            _companion_deltas = state.companion_affinity_deltas
        if _companion_deltas:
            try:
                from app.memory.companion_store import batch_update_affinity
                from app.narrative.companion_context import TONE_AFFINITY_MULTIPLIER
                tone_mult = TONE_AFFINITY_MULTIPLIER.get(story.tone or "", 1.0)
                batch_update_affinity(
                    self.db, story_id, _companion_deltas,
                    chapter=chapter_number, tone_multiplier=tone_mult,
                )
                logger.info(f"Companion affinity updated (scene mode): {_companion_deltas}")
            except Exception as exc:
                logger.warning(f"Companion affinity update failed (scene mode): {exc}")

        # ── 8. Apply identity delta (from pipeline planner) ──
        if player and state.identity_delta:
            delta = state.identity_delta
            updated_player = apply_delta(player, delta)
            updated_player.total_chapters += 1

            if delta.pity_reset:
                updated_player.pity_counter = 0
            else:
                updated_player.pity_counter += 1

            self.db.update_player(updated_player)

            # ── 8b. Update play style from chapter choice ──
            try:
                from app.engine.play_style_engine import update_play_style
                consequence_tags = delta.new_flags or []
                risk = choice.risk_level if choice else 1
                choice_type = choice.choice_type if choice else "narrative"
                updated_player.play_style = update_play_style(
                    updated_player.play_style,
                    chosen_risk_level=risk,
                    choice_type=choice_type,
                    consequence_tags=consequence_tags,
                )
                self.db.update_player(updated_player)
            except Exception as exc:
                logger.warning(f"Play style update failed: {exc}")

            # ── 8c. Check archetype evolution ──
            try:
                from app.narrative.archetype_evolution_agent import check_archetype_evolution
                evo_event = check_archetype_evolution(updated_player)
                if evo_event:
                    logger.info(f"Archetype evolution event: {evo_event}")
                    self.db.log_identity_event(IdentityEvent(
                        player_id=player.id,
                        event_type=IdentityEventType.DRIFT,
                        chapter_number=chapter_number,
                        description=(
                            f"ARCHETYPE_EVOLUTION: {evo_event['event']} "
                            f"→ {evo_event.get('target_form', '?')} "
                            f"({evo_event.get('path', '?')})"
                        ),
                        delta_snapshot=evo_event,
                    ))
            except Exception as exc:
                logger.warning(f"Archetype evolution check failed: {exc}")

            event = IdentityEvent(
                player_id=player.id,
                event_type=IdentityEventType.DRIFT,
                chapter_number=chapter_number,
                description=(
                    f"Ch.{chapter_number}: DQS={delta.dqs_change:+.1f} "
                    f"Coh={delta.coherence_change:+.1f} "
                    f"Inst={delta.instability_change:+.1f}"
                ),
                delta_snapshot=delta.model_dump(),
            )
            self.db.log_identity_event(event)

            for flag_key in delta.new_flags:
                self.db.set_player_flag(player.id, flag_key, chapter_number)

            if delta.confrontation_triggered:
                self.db.log_identity_event(IdentityEvent(
                    player_id=player.id,
                    event_type=IdentityEventType.CONFRONTATION,
                    chapter_number=chapter_number,
                    description="Identity instability reached critical threshold!",
                ))

            if delta.breakthrough_triggered:
                self.db.log_identity_event(IdentityEvent(
                    player_id=player.id,
                    event_type=IdentityEventType.BREAKTHROUGH,
                    chapter_number=chapter_number,
                    description="Breakthrough triggered!",
                ))
                updated_player.breakthrough_meter = 0
                self.db.update_player(updated_player)

            identity_delta_summary = {
                "dqs": delta.dqs_change,
                "coherence": delta.coherence_change,
                "instability": delta.instability_change,
                "breakthrough": delta.breakthrough_change,
                "confrontation": delta.confrontation_triggered,
                "breakthrough_triggered": delta.breakthrough_triggered,
            }

        # ── 9. Store chapter summary in NeuralMemory ──
        if brain.available:
            await brain.store_chapter_summary(
                chapter_number=chapter_number,
                summary=chapter.summary,
                choice_text=choice.text if choice else free_input,
            )

        return SceneChapterResult(
            chapter=chapter,
            scenes=scenes,
            identity_delta_summary=identity_delta_summary,
            crng_result=crng_result,
        )

    async def _fallback_to_monolithic(
        self,
        story_id: str,
        user_id: str,
        choice: Choice | None,
        free_input: str,
    ) -> SceneChapterResult:
        """Fallback: generate monolithic chapter and wrap as single scene."""
        result = await self.generate_chapter(story_id, user_id, choice, free_input)
        chapter = result.chapter

        # Wrap as a single scene
        scene = Scene(
            chapter_id=chapter.id,
            scene_number=1,
            title=chapter.title,
            prose=chapter.prose,
            choices=chapter.choices,
            scene_type="exploration",
            is_chapter_end=True,
            tension=5,
            mood="neutral",
        )
        self.db.save_scene(scene)

        return SceneChapterResult(
            chapter=chapter,
            scenes=[scene],
            identity_delta_summary=result.identity_delta_summary,
            crng_result=result.crng_result,
        )

    # ══════════════════════════════════════════
    # Interactive Scene-by-Scene (Phase B)
    # ══════════════════════════════════════════

    async def generate_chapter_plan(
        self,
        story_id: str,
        user_id: str,
        choice: Choice | None = None,
        free_input: str = "",
    ) -> ChapterPlanResult:
        """Run the planner pipeline ONLY — create chapter shell with beats.

        Does NOT generate any scene prose. Returns chapter with planner
        output stored in DB so generate_single_scene can load it later.
        """
        import json as _json

        # ── 1. Load state ──
        story = self.db.get_story(story_id)
        if not story:
            raise ValueError(f"Story {story_id} not found")

        player = self.db.get_player_by_user(user_id)
        chapters = self.db.get_story_chapters(story_id)
        chapter_number = len(chapters) + 1

        if chapter_number > settings.max_chapters_per_story:
            raise ValueError(f"Story has reached max chapters ({settings.max_chapters_per_story})")

        # ── 2. Rolling summary ──
        previous_summary = build_rolling_summary(chapters)

        # ── 2b. Semantic memory query ──
        brain = await get_or_create_brain(story_id, story.brain_id)
        if brain.available:
            query_text = choice.text if choice else free_input or f"Chương {chapter_number}"
            semantic_ctx = await brain.query_context(query_text)
            if semantic_ctx:
                previous_summary += f"\n\n{semantic_ctx}"

        # ── 2c. Previous chapter ending prose (cross-chapter continuity) ──
        previous_chapter_ending = self._get_prev_chapter_ending(chapters)

        # ── 3. CRNG + Fate Buffer ──
        crng_result = CRNGResult()
        crng_event = {}
        if player:
            crng_result = self.crng.roll_chapter_events(player)
            if crng_result.triggered:
                crng_event = {
                    "triggered": True,
                    "event_type": crng_result.event_type,
                    "affinity_tag": crng_result.affinity_tag,
                    "details": crng_result.details,
                }

        fate_instruction = ""
        if player:
            fate_status = self.fate.get_status(player)
            fate_instruction = fate_status.narrative_instruction

        # ── 3b. Skill reward planning ──
        skill_reward_plan = self._compute_skill_reward(player, crng_result)

        # ── 4. Run planner pipeline ──
        pipeline_input = {
            "story_id": story_id,
            "chapter_number": chapter_number,
            "preference_tags": story.preference_tags,
            "backstory": story.backstory,
            "protagonist_name": story.protagonist_name,
            "chosen_choice": choice,
            "previous_summary": previous_summary,
            "previous_chapter_ending": previous_chapter_ending,
            "free_input": free_input,
            "player_state": player.model_dump() if player else None,
            "crng_event": crng_event,
            "fate_instruction": fate_instruction,
            "tone": story.tone,
            "skill_reward_plan": skill_reward_plan,
            "player_gender": player.gender if player else "neutral",
        }

        logger.info(f"ChapterPlan: running planner for chapter {chapter_number}")

        # ── 4b. Inject adaptive context ──
        if player:
            try:
                from app.engine.adaptive_context_builder import (
                    build_adaptive_context,
                    format_adaptive_prompt,
                )
                adaptive_ctx = build_adaptive_context(player, world_state=self._load_world_state_safe(story_id))
                pipeline_input["adaptive_context"] = format_adaptive_prompt(adaptive_ctx)
            except Exception as exc:
                logger.warning(f"Adaptive context build failed: {exc}")

        state = await run_pipeline(pipeline_input)

        planner_output = state.planner_output
        if not planner_output or not planner_output.beats:
            raise ValueError("Planner failed to produce beats")

        total_scenes = len(planner_output.beats)

        # ── 5. Create chapter shell ──
        # Store identity delta for later application (when final scene completes)
        identity_delta_json = ""
        if state.identity_delta:
            identity_delta_json = state.identity_delta.model_dump_json()

        chapter = Chapter(
            story_id=story_id,
            chapter_number=chapter_number,
            number=chapter_number,
            title=planner_output.chapter_title or f"Chương {chapter_number}",
            planner_outline=str(planner_output.model_dump()),
            planner_output_json=planner_output.model_dump_json(),
            total_scenes=total_scenes,
            chosen_choice=choice,
            identity_delta_json=identity_delta_json,
        )
        self.db.save_chapter(chapter)
        logger.info(f"ChapterPlan: chapter {chapter_number} shell saved ({total_scenes} beats)")

        return ChapterPlanResult(
            chapter=chapter,
            total_scenes=total_scenes,
            crng_result=crng_result,
            _pipeline_state=state,
        )

    async def generate_single_scene(
        self,
        story_id: str,
        chapter_id: str,
        scene_number: int,
        choice: Choice | None = None,
        free_input: str = "",
        combat_decisions: list | None = None,
    ) -> SingleSceneResult:
        """Generate ONE scene for an existing chapter.

        The chapter must already have a planner_output stored (via
        generate_chapter_plan). The choice parameter is the user's
        selection from the PREVIOUS scene and feeds into the SceneWriter
        prompt, ensuring narrative continuity.
        """
        import json as _json

        # ── 1. Load state ──
        story = self.db.get_story(story_id)
        if not story:
            raise ValueError(f"Story {story_id} not found")

        chapter = self.db.get_chapter(chapter_id)
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        player = self.db.get_player_by_user(story.user_id)

        # ── 2. Load planner output from chapter ──
        from app.models.pipeline import PlannerOutput
        try:
            planner_data = _json.loads(chapter.planner_output_json)
            planner_output = PlannerOutput(**planner_data)
        except Exception as e:
            raise ValueError(f"Cannot load planner output from chapter: {e}")

        beats = planner_output.beats
        total_scenes = len(beats)

        if scene_number < 1 or scene_number > total_scenes:
            raise ValueError(f"Scene {scene_number} out of range (1-{total_scenes})")

        beat_index = scene_number - 1
        beat = beats[beat_index]
        is_chapter_end = (scene_number == total_scenes)

        # ── 3. Load previous scenes for context ──
        existing_scenes = self.db.get_chapter_scenes(chapter_id)
        existing_scenes.sort(key=lambda s: s.scene_number)

        prev_prose = ""
        prev_prose_2 = ""
        if existing_scenes:
            prev_prose = existing_scenes[-1].prose
            if len(existing_scenes) >= 2:
                prev_prose_2 = existing_scenes[-2].prose
        elif scene_number == 1 and chapter.chapter_number > 1:
            # Cross-chapter continuity: scene 1 of chapter N has no existing scenes yet.
            # Use the last scene of chapter N-1 so the writer opens consistently.
            all_chapters = self.db.get_story_chapters(story_id)
            prev_ch = next(
                (c for c in all_chapters if c.chapter_number == chapter.chapter_number - 1),
                None,
            )
            if prev_ch:
                prev_last = self.db.get_latest_scene(prev_ch.id)
                if prev_last:
                    prev_prose = prev_last.prose
                    logger.info(
                        f"Cross-chapter SceneWriter bridge: using last scene of "
                        f"chapter {chapter.chapter_number - 1} ({len(prev_prose)} chars)"
                    )

        # ── 4. Skill data ──
        skill_data = None
        skill_name = ""
        if player and player.unique_skill:
            skill_data = player.unique_skill.model_dump()
            skill_name = player.unique_skill.name

        # ── 4b. Track skill usage ──
        # Count how many times skill was used in this chapter so far
        skill_usage_this_chapter = 0
        if skill_name and player:
            # Check existing scenes' chosen choices for skill pattern
            for s in existing_scenes:
                if s.chosen_choice_id:
                    for c in s.choices:
                        if c.id == s.chosen_choice_id and f"[{skill_name}]" in c.text:
                            skill_usage_this_chapter += 1
                            break
            # Check current incoming choice (from previous scene)
            if choice and f"[{skill_name}]" in (choice.text or ""):
                skill_usage_this_chapter += 1
                # Increment global skill usage counter in progression
                skill_id = player.unique_skill.name  # Use name as ID for now
                player.progression.skill_usage[skill_id] = (
                    player.progression.skill_usage.get(skill_id, 0) + 1
                )
                player.progression.total_scenes += 1

        # Fate instruction
        fate_instruction = ""
        if player:
            fate_status = self.fate.get_status(player)
            fate_instruction = fate_status.narrative_instruction

        # ── 4c. Load previous scene's critic feedback ──
        prev_critic_feedback = ""
        if existing_scenes:
            prev_critic_feedback = existing_scenes[-1].critic_feedback or ""

        # ── 4d. Combat resolution (before writer) ──
        combat_summary = None
        if beat.scene_type == "combat" and player:
            combat_summary = self._resolve_combat_for_beat(
                player=player, beat=beat, floor=player.current_floor,
                skill_usage_this_chapter=skill_usage_this_chapter,
                player_decisions=combat_decisions,
            )
            # Persist combat-updated player state immediately
            self.db.update_player(player)
            logger.info(
                f"Combat resolved: score={combat_summary.get('combat_score', '?')}, "
                f"outcome={combat_summary.get('outcome', '?')}"
            )

        # ── 4e. Semantic memory query ──
        brain = await get_or_create_brain(story_id, story.brain_id)
        semantic_context = ""
        if brain.available:
            query_text = beat.description or (choice.text if choice else "")
            semantic_context = await brain.query_context(query_text)

        # ── 4f. Build evolution + resonance context for writer ──
        evolution_context = ""
        resonance_context_str = ""
        if player:
            # Resonance prose descriptors (spec §10.3)
            from app.engine.resonance_mastery import build_resonance_context
            res_ctx = build_resonance_context(player.resonance or {})
            if res_ctx:
                resonance_context_str = "\n".join(
                    f"- {p}: {desc}" for p, desc in res_ctx.items()
                )

            # Evolution context for active mutation arc
            evo = player.skill_evolution
            if evo and evo.mutation_in_progress:
                arc = evo.mutation_arc_scene
                evolution_context = (
                    f"⚡ Skill [{evo.mutation_in_progress}] đang mutation "
                    f"(scene {arc}/3).\n"
                )
                if arc == 1:
                    evolution_context += (
                        "→ Skill hành xử bất thường — misfire, yếu, hoặc ngược. "
                        "Mô tả sự bất ổn trong prose."
                    )
                elif arc == 2:
                    evolution_context += (
                        "→ DECISION POINT — player phải chọn: chấp nhận / "
                        "chống lại / ép hybrid. TẠO 3 CHOICES phản ánh 3 lựa chọn này."
                    )
                elif arc == 3:
                    evolution_context += (
                        "→ Skill hoàn thành transformation. Mô tả sự tiến hóa — "
                        "cảm giác mạnh mẽ hơn, không mất mát."
                    )

        # ── 5. Generate scene ──
        scene_start = time.monotonic()

        # ── 4g. Build adaptive context for scene writer ──
        # Writer gets narrative texture (format_writer_context), not the full metadata dump.
        adaptive_ctx_str = ""
        if player:
            try:
                from app.engine.adaptive_context_builder import (
                    build_adaptive_context,
                    format_writer_context,
                )
                adaptive_ctx = build_adaptive_context(player, world_state=self._load_world_state_safe(story_id))
                adaptive_ctx_str = format_writer_context(adaptive_ctx)
            except Exception as exc:
                logger.warning(f"Adaptive context build failed: {exc}")

        scene_input = SceneWriterInput(
            chapter_number=chapter.chapter_number,
            scene_number=scene_number,
            total_scenes=total_scenes,
            beat=beat,
            all_beats=beats,
            protagonist_name=story.protagonist_name,
            previous_scene_prose=prev_prose,
            previous_scene_prose_2=prev_prose_2,
            chosen_choice=choice,      # ← User's actual choice from previous scene!
            is_chapter_end=is_chapter_end,
            player_state=player.model_dump() if player else None,
            unique_skill=skill_data,
            fate_instruction=fate_instruction,
            preference_tags=story.preference_tags,
            skill_usage_this_chapter=skill_usage_this_chapter,
            critic_feedback=prev_critic_feedback,
            combat_brief=beat.combat_brief,  # Injected by _resolve_combat
            semantic_context=semantic_context,
            evolution_context=evolution_context,
            resonance_context=resonance_context_str,
            adaptive_context=adaptive_ctx_str,
            tone=story.tone,
            gender=player.gender if player else "neutral",
        )

        scene = await run_scene_writer(scene_input)
        scene.chapter_id = chapter_id

        # ── 5b. Heuristic critic (sync, instant) ──
        from app.narrative.scene_critic import heuristic_scene_critic
        heuristic = heuristic_scene_critic(scene, skill_name=skill_name)
        scene.critic_score = heuristic.score

        # Save scene to DB
        self.db.save_scene(scene)

        # Store scene in NeuralMemory
        if brain.available:
            await brain.store_scene(
                scene_number=scene_number,
                chapter_number=chapter.chapter_number,
                prose=scene.prose,
                scene_type=scene.scene_type,
                choice_text=choice.text if choice else free_input,
                title=scene.title or "",
            )

        # ── 5c. Async LLM critic (background, zero latency) ──
        asyncio.ensure_future(self._run_async_scene_critic(
            scene=scene,
            beat_description=beat.description,
            total_scenes=total_scenes,
            skill_name=skill_name,
        ))

        # Persist player progression updates
        if player and choice:
            self.db.update_player(player)

        elapsed = time.monotonic() - scene_start
        logger.info(
            f"SingleScene: scene {scene_number}/{total_scenes} done in {elapsed:.1f}s — "
            f"{len(scene.prose)} chars, type={scene.scene_type}, "
            f"choices={len(scene.choices)}"
        )

        # ── 6. Per-scene identity hints (lightweight, no LLM) ──
        scene_identity_hints = None
        if player and choice:
            scene_identity_hints = self._compute_scene_identity_hints(
                player=player,
                choice=choice,
                scene_type=scene.scene_type,
                skill_name=skill_name,
                skill_usage=skill_usage_this_chapter,
            )
            # Save hints to scene record (for UI display)
            scene.identity_delta_json = json.dumps(scene_identity_hints)
            self.db.save_scene(scene)

            # Persist hints to PlayerState (micro-updates are real)
            hints = scene_identity_hints
            for field in (
                "identity_coherence", "instability", "breakthrough_meter",
                "decision_quality_score", "notoriety",
            ):
                if field in hints:
                    setattr(player, field, hints[field])
            if "alignment" in hints:
                player.alignment = hints["alignment"]
            self.db.update_player(player)

        # ── 6b. Unique Skill Growth tracking ──
        growth_events = {}
        if player and player.unique_skill_growth:
            from app.engine.unique_skill_growth import (
                update_growth_per_scene,
                check_bloom_trigger,
                check_aspect_trigger,
                check_ultimate_trigger,
            )
            growth_events = update_growth_per_scene(
                player=player,
                scene_type=scene.scene_type,
                is_combat=(scene.scene_type == "combat"),
                combat_outcome=(
                    combat_summary.get("outcome", "")
                    if combat_summary else ""
                ),
                defeat_severity=(
                    combat_summary.get("defeat_result", {}).get("scar_type", "")
                    if combat_summary else ""
                ),
                skill_was_used=(
                    bool(choice and skill_name and f"[{skill_name}]" in (choice.text or ""))
                ),
            )
            # Check bloom trigger
            bloom_trigger = check_bloom_trigger(player)
            if bloom_trigger:
                growth_events["bloom_ready"] = bloom_trigger
                logger.info(f"Bloom ready: {bloom_trigger}")

            # Check aspect trigger (Rank 4+, Bloom done, 20+ uses)
            if check_aspect_trigger(player):
                growth_events["aspect_ready"] = True
                logger.info("Aspect Forge ready!")

            # Check ultimate trigger (Rank 5, Aspect done)
            if check_ultimate_trigger(player):
                growth_events["ultimate_ready"] = True
                logger.info("Ultimate Synthesis ready!")

            # ── Inject growth narrative beats ──
            if growth_events:
                from app.engine.growth_orchestration import (
                    check_and_inject_growth_beats,
                    build_growth_writer_context,
                )
                injected_beats = check_and_inject_growth_beats(player, growth_events)
                if injected_beats:
                    growth_events["injected_beats"] = [
                        b.model_dump() for b in injected_beats
                    ]
                    logger.info(
                        f"Growth beats injected: {len(injected_beats)} beats "
                        f"(type={injected_beats[0].arc_type})"
                    )

                # Always include growth writer context
                growth_events["writer_context"] = build_growth_writer_context(player)

            self.db.update_player(player)

        # ── 6c. Resonance Mastery update (after combat) ──
        resonance_events = {}
        if player and combat_summary:
            from app.engine.resonance_mastery import (
                update_resonance_after_combat,
                check_stability_trial,
                check_floor_attunement,
                check_overdrive_control,
                check_dual_mastery,
            )
            mastery = player.resonance_mastery

            # Fix #1+#2: iterate per combat PHASE, multi-skill
            phases = combat_summary.get("phases", [])
            if phases:
                # Per-phase resonance growth (spec §7.2)
                for phase in phases:
                    phase_principle = phase.get("skill_principle", "")
                    if not phase_principle:
                        # Fallback: extract from skill_used
                        phase_skill_id = phase.get("skill_used", "")
                        for sk in (player.equipped_skills or []):
                            if sk.get("id") == phase_skill_id:
                                phase_principle = sk.get("primary_principle", "")
                                break
                    phase_outcome = phase.get("outcome", "mixed")

                    if phase_principle:
                        update_resonance_after_combat(
                            resonance=player.resonance,
                            skill_principle=phase_principle,
                            outcome=phase_outcome,
                            current_floor=player.current_floor,
                            personal_cap_bonus=mastery.personal_cap_bonus,
                        )

                        # Check stability trial per phase
                        had_backlash = phase.get("backlash", False)
                        trial_passed = check_stability_trial(
                            mastery=mastery,
                            skill_principle=phase_principle,
                            resonance=player.resonance,
                            had_backlash=had_backlash,
                        )
                        if trial_passed:
                            resonance_events["stability_trial_passed"] = True
                            resonance_events["personal_cap_bonus"] = mastery.personal_cap_bonus
                            logger.info(
                                "Stability trial passed! Cap bonus: %.1f",
                                mastery.personal_cap_bonus,
                            )
            else:
                # Fallback: single skill per scene (no phases data)
                skill_principle = ""
                if player.equipped_skills:
                    skill_principle = player.equipped_skills[0].get("primary_principle", "")
                combat_outcome = combat_summary.get("outcome", "mixed")

                if skill_principle:
                    update_resonance_after_combat(
                        resonance=player.resonance,
                        skill_principle=skill_principle,
                        outcome=combat_outcome,
                        current_floor=player.current_floor,
                        personal_cap_bonus=mastery.personal_cap_bonus,
                    )

                    had_backlash = combat_summary.get("backlash", False)
                    trial_passed = check_stability_trial(
                        mastery=mastery,
                        skill_principle=skill_principle,
                        resonance=player.resonance,
                        had_backlash=had_backlash,
                    )
                    if trial_passed:
                        resonance_events["stability_trial_passed"] = True
                        resonance_events["personal_cap_bonus"] = mastery.personal_cap_bonus
                        logger.info(
                            "Stability trial passed! Cap bonus: %.1f",
                            mastery.personal_cap_bonus,
                        )

            # ── 6c-ii. Floor Attunement (boss clear → dominant resonance +0.1) ──
            boss_cleared = combat_summary.get("boss_cleared", False)
            if boss_cleared:
                dominant = max(player.resonance, key=player.resonance.get, default="")
                if dominant and check_floor_attunement(
                    mastery=mastery,
                    floor=player.current_floor,
                    boss_cleared=True,
                    resonance=player.resonance,
                    dominant_principle=dominant,
                ):
                    resonance_events["floor_attunement"] = {
                        "floor": player.current_floor,
                        "principle": dominant,
                    }

            # ── 6c-iii. Overdrive Control (3 successes → risk -5%) ──
            overdrive_used = combat_summary.get("overdrive_used", False)
            overdrive_misfire = combat_summary.get("overdrive_misfire", False)
            if overdrive_used or overdrive_misfire:
                if check_overdrive_control(
                    mastery=mastery,
                    overdrive_used=overdrive_used,
                    overdrive_misfire=overdrive_misfire,
                ):
                    resonance_events["overdrive_control"] = {
                        "risk_reduction": mastery.overdrive_risk_reduction,
                    }

            # ── 6c-iv. Dual Mastery (boss + dual principles ≥ 0.5) ──
            if boss_cleared:
                principles_used = list({
                    p.get("skill_principle", "")
                    for p in phases if p.get("skill_principle")
                }) if phases else []
                if len(principles_used) >= 2 and check_dual_mastery(
                    mastery=mastery,
                    resonance=player.resonance,
                    boss_cleared=True,
                    principles_used=principles_used,
                ):
                    resonance_events["dual_mastery"] = {
                        "count": mastery.dual_mastery_count,
                    }

            self.db.update_player(player)

        # ── 6d. Skill Evolution check (per scene) ──
        skill_evolution_event = None
        mutation_arc_info = None
        if player:
            from app.engine.skill_evolution import (
                check_skill_evolution,
                advance_mutation_arc,
                sync_evolution_to_progression,
                apply_refinement,
            )
            from app.models.skill_evolution import EvolutionType

            # 6d-i: If mutation arc in progress → advance it
            if player.skill_evolution.mutation_in_progress:
                # Advance to NEXT scene (arc_scene starts at 1 from check_skill_evolution)
                next_arc_scene = min(player.skill_evolution.mutation_arc_scene + 1, 3)
                mutation_arc_info = advance_mutation_arc(
                    evolution=player.skill_evolution,
                    scene_number=next_arc_scene,
                )
                logger.info(
                    "Mutation arc advanced: %s (scene %d) → %s",
                    player.skill_evolution.mutation_in_progress,
                    player.skill_evolution.mutation_arc_scene,
                    mutation_arc_info.get("status"),
                )
                self.db.update_player(player)

            # 6d-ii: Check for new evolution triggers (blocked during mutation)
            skill_evolution_event = check_skill_evolution(
                evolution=player.skill_evolution,
                equipped_skills=player.equipped_skills,
                identity_resonance=player.resonance,
                coherence=player.identity_coherence,
                instability=player.instability,
                chapter=chapter.chapter_number,
                scene=scene_number,
                scene_result={
                    "skill_used": (
                        player.equipped_skills[0].get("id", "")
                        if player.equipped_skills else ""
                    ),
                    "outcome": (
                        combat_summary.get("outcome", "")
                        if combat_summary else ""
                    ),
                    "combat_phases": (
                        combat_summary.get("phases", [])
                        if combat_summary else []
                    ),
                },
            )
            if skill_evolution_event:
                # Sync to progression for backward compat
                sync_evolution_to_progression(
                    player.skill_evolution, player.progression,
                )
                # Apply refinement immediately if triggered
                if skill_evolution_event.event_type == EvolutionType.REFINEMENT:
                    apply_refinement(
                        evolution=player.skill_evolution,
                        skill_id=skill_evolution_event.skill_id,
                    )
                    logger.info(
                        "Refinement applied: %s",
                        skill_evolution_event.skill_id,
                    )
                logger.info(
                    "Skill evolution: %s for %s (ch.%d sc.%d)",
                    skill_evolution_event.event_type.value,
                    skill_evolution_event.skill_id,
                    chapter.chapter_number,
                    scene_number,
                )
            self.db.update_player(player)

        # ── 6e. Integration eligibility check (rest scenes only) ──
        integration_options = None
        if player and beat.scene_type == "rest":
            from app.engine.skill_evolution import check_integration_eligible

            pairs = check_integration_eligible(
                equipped_skills=player.equipped_skills,
                skill_usage=player.skill_evolution.refinement_trackers,
                current_rank=player.progression.current_rank.value,
                integrations_done=player.skill_evolution.integrations_done,
            )
            if pairs:
                integration_options = [
                    {"skill_a_id": a, "skill_b_id": b}
                    for a, b in pairs
                ]
                logger.info(
                    "Integration eligible: %d pairs at rest scene",
                    len(pairs),
                )

        # ── 6f. Awakening auto-trigger ──
        awakening_results = []
        if player and player.progression.affinity_awakened:
            awakened_principle = player.progression.awakened_principle
            if awakened_principle:
                from app.engine.skill_evolution import (
                    get_awakening_candidates,
                    apply_awakening,
                )

                candidates = get_awakening_candidates(
                    equipped_skills=player.equipped_skills,
                    awakened_principle=awakened_principle,
                    awakened_skills=player.skill_evolution.awakened_skills,
                )
                for cand_id in candidates:
                    # Find skill dict
                    for sk in player.equipped_skills:
                        sk_data = sk if isinstance(sk, dict) else {}
                        if (sk_data.get("id") == cand_id
                                or sk_data.get("skeleton_id") == cand_id):
                            result = apply_awakening(
                                evolution=player.skill_evolution,
                                skill_id=cand_id,
                                awakened_principle=awakened_principle,
                                skill=sk_data,
                            )
                            awakening_results.append(result)
                            logger.info(
                                "Awakening applied: %s + %s → %s",
                                cand_id, awakened_principle,
                                result.get("effect"),
                            )
                            break
                if awakening_results:
                    self.db.update_player(player)

        # ── 7. If last scene: finalize chapter ──
        identity_delta_summary = scene_identity_hints  # Start with per-scene hints
        if is_chapter_end:
            # Aggregate prose
            all_scenes = existing_scenes + [scene]
            combined_prose = "\n\n---\n\n".join(s.prose for s in all_scenes)
            combined_summary = (
                f"Chapter {chapter.chapter_number}: {len(all_scenes)} scenes. "
                f"Types: {', '.join(s.scene_type for s in all_scenes)}. "
                f"Final scene: {all_scenes[-1].title or 'untitled'}."
            )

            chapter.prose = combined_prose
            chapter.summary = combined_summary
            chapter.choices = scene.choices
            self.db.save_chapter(chapter)

            # Apply identity delta (from planner pipeline state stored in chapter)
            if player:
                chapter_delta = await self._apply_chapter_identity_delta(
                    player, chapter, story_id
                )
                # Merge chapter-end delta with per-scene hints
                if chapter_delta:
                    identity_delta_summary = chapter_delta

            # Store chapter summary in NeuralMemory
            if brain.available:
                await brain.store_chapter_summary(
                    chapter_number=chapter.chapter_number,
                    summary=chapter.summary,
                    choice_text=choice.text if choice else free_input,
                )

            # Update unique skill resilience (post-chapter decay/recovery)
            if player and player.unique_skill:
                from app.engine.skill_check import update_skill_resilience
                player.unique_skill.resilience = update_skill_resilience(
                    resilience=player.unique_skill.resilience,
                    skill_usage_this_chapter=skill_usage_this_chapter,
                    identity_coherence=player.identity_coherence,
                    player_instability=player.instability,
                )
                # Sync skill instability from player instability
                player.unique_skill.instability = player.instability * 0.5
                self.db.update_player(player)

        return SingleSceneResult(
            scene=scene,
            scene_number=scene_number,
            total_scenes=total_scenes,
            is_chapter_end=is_chapter_end,
            identity_delta_summary=identity_delta_summary,
            combat_data=combat_summary,
            skill_evolution_event=(
                skill_evolution_event.model_dump()
                if skill_evolution_event else None
            ),
            resonance_events=resonance_events or None,
            mutation_arc_info=mutation_arc_info,
            integration_options=integration_options,
            awakening_results=awakening_results or None,
        )

    async def _run_async_scene_critic(
        self,
        scene: "Scene",
        beat_description: str,
        total_scenes: int,
        skill_name: str,
    ):
        """Fire-and-forget background LLM critic.

        Runs after scene is already saved and streamed to user.
        Stores feedback in scene record for next scene's prompt.
        """
        try:
            from app.narrative.scene_critic import (
                run_scene_critic_async,
                format_critic_for_next_scene,
            )
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm = ChatGoogleGenerativeAI(
                model=settings.critic_model,
                temperature=0.3,
                google_api_key=settings.google_api_key,
            )
            result = await run_scene_critic_async(
                scene=scene,
                beat_description=beat_description,
                total_scenes=total_scenes,
                skill_name=skill_name,
                llm=llm,
            )

            if result:
                # Update scene with critic results
                scene.critic_score = result["score"]
                scene.critic_feedback = format_critic_for_next_scene(result)
                self.db.save_scene(scene)
                logger.info(
                    f"AsyncCritic: scene {scene.scene_number} — "
                    f"score={result['score']:.1f}, feedback saved for next scene"
                )

        except Exception as e:
            logger.warning(f"AsyncCritic failed for scene {scene.scene_number}: {e}")

    def _compute_scene_identity_hints(
        self,
        player: "PlayerState",
        choice: "Choice",
        scene_type: str,
        skill_name: str,
        skill_usage: int,
    ) -> dict:
        """Compute lightweight per-scene identity micro-updates.

        Based on choice risk level and skill usage patterns.
        No LLM call — pure heuristics. Returns a dict
        suitable for SSE 'identity' event and scene.identity_delta_json.
        """
        hints = {}
        narrative_notes = []

        risk = choice.risk_level or 3

        # ── Risk-based updates ──
        if risk >= 4:
            # Bold/risky choice → breakthrough potential
            hints["breakthrough_meter"] = min(player.breakthrough_meter + 3.0, 100.0)
            hints["instability"] = min(player.instability + 1.0, 100.0)
            narrative_notes.append("Quyết định liều lĩnh — bước đột phá tích lũy")
        elif risk <= 2:
            # Safe/cautious choice → coherence
            hints["identity_coherence"] = min(player.identity_coherence + 1.0, 100.0)
            hints["instability"] = max(player.instability - 0.5, 0.0)
            narrative_notes.append("Lựa chọn thận trọng — bản sắc ổn định hơn")
        else:
            # Balanced choice → slight DQS boost
            hints["decision_quality_score"] = min(player.decision_quality_score + 0.5, 100.0)

        # ── Skill usage effects ──
        if skill_name and f"[{skill_name}]" in (choice.text or ""):
            if skill_usage >= 3:
                hints["instability"] = min(hints.get("instability", player.instability) + 3.0, 100.0)
                hints["identity_coherence"] = max(
                    hints.get("identity_coherence", player.identity_coherence) - 2.0, 0.0
                )
                narrative_notes.append(f"Lạm dụng {skill_name} — bản sắc lung lay")
            elif skill_usage >= 2:
                hints["instability"] = min(hints.get("instability", player.instability) + 1.5, 100.0)
                narrative_notes.append(f"Sử dụng {skill_name} nhiều — dấu hiệu mệt mỏi")

        # ── Scene type effects ──
        if scene_type == "combat":
            hints["notoriety"] = min(player.notoriety + 1.0, 100.0)
        elif scene_type == "social":
            hints["alignment"] = player.alignment + (0.5 if risk <= 2 else -0.5)
            hints["alignment"] = max(-100.0, min(100.0, hints["alignment"]))

        # ── Apply micro-updates to player ──
        for key, value in hints.items():
            if hasattr(player, key):
                setattr(player, key, value)

        # Build summary for frontend
        return {
            "type": "scene_hint",
            "scene_type": scene_type,
            "risk_level": risk,
            "micro_updates": hints,
            "narrative_hint": " | ".join(narrative_notes) if narrative_notes else None,
        }

    async def _apply_chapter_identity_delta(
        self,
        player: PlayerState,
        chapter: Chapter,
        story_id: str,
    ) -> dict | None:
        """Apply identity delta from the planner pipeline state."""
        import json as _json

        # Try to reload pipeline state from chapter's planner output
        # The identity delta was computed during generate_chapter_plan
        # but stored in the pipeline state. We need to re-derive it.
        from app.models.pipeline import PlannerOutput
        try:
            planner_data = _json.loads(chapter.planner_output_json)
            planner_output = PlannerOutput(**planner_data)
        except Exception:
            logger.warning("Cannot load planner output for identity delta")
            return None

        # Re-run identity delta from planner output
        # For now, use the identity_delta_json if stored on chapter
        if chapter.identity_delta_json:
            try:
                from app.models.identity import IdentityDelta
                delta_data = _json.loads(chapter.identity_delta_json)
                delta = IdentityDelta(**delta_data)
            except Exception:
                logger.warning("Cannot parse identity_delta_json")
                return None
        else:
            # No identity delta stored — skip
            return None

        # Apply delta (apply_delta handles total_chapters and pity_counter)
        updated_player = apply_delta(player, delta)

        self.db.update_player(updated_player)

        # Log events
        event = IdentityEvent(
            player_id=player.id,
            event_type=IdentityEventType.DRIFT,
            chapter_number=chapter.chapter_number,
            description=(
                f"Ch.{chapter.chapter_number}: DQS={delta.dqs_change:+.1f} "
                f"Coh={delta.coherence_change:+.1f} "
                f"Inst={delta.instability_change:+.1f}"
            ),
            delta_snapshot=delta.model_dump(),
        )
        self.db.log_identity_event(event)

        for flag_key in delta.new_flags:
            self.db.set_player_flag(player.id, flag_key, chapter.chapter_number)

        if delta.confrontation_triggered:
            self.db.log_identity_event(IdentityEvent(
                player_id=player.id,
                event_type=IdentityEventType.CONFRONTATION,
                chapter_number=chapter.chapter_number,
                description="Identity instability reached critical threshold!",
            ))

        if delta.breakthrough_triggered:
            self.db.log_identity_event(IdentityEvent(
                player_id=player.id,
                event_type=IdentityEventType.BREAKTHROUGH,
                chapter_number=chapter.chapter_number,
                description="Breakthrough triggered!",
            ))
            updated_player.breakthrough_meter = 0
            self.db.update_player(updated_player)

        return {
            "dqs": delta.dqs_change,
            "coherence": delta.coherence_change,
            "instability": delta.instability_change,
            "breakthrough": delta.breakthrough_change,
            "confrontation": delta.confrontation_triggered,
            "breakthrough_triggered": delta.breakthrough_triggered,
        }

    # ══════════════════════════════════════════
    # Combat Resolution Helper
    # ══════════════════════════════════════════

    def _resolve_combat_for_beat(
        self,
        player: PlayerState,
        beat: "Beat",
        floor: int = 1,
        skill_usage_this_chapter: int = 0,
        player_decisions: list | None = None,
    ) -> dict:
        """Run deterministic combat resolution for a combat beat.

        Routes encounter types:
          - minor → old build_combat_brief() single-phase
          - duel/boss → run_resolution_combat() multi-phase

        Writes combat_brief into beat for SceneWriter.
        Applies post-combat state changes back to player.
        Returns summary dict for logging/SSE.
        """
        import random

        # ── Build resonance state from player dict ──
        resonance = ResonanceState(**{
            k: v for k, v in player.resonance.items()
            if k in ResonanceState.model_fields
        })

        # ── Build combat metrics ──
        metrics = CombatMetrics(
            hp=player.hp,
            stability=player.stability,
            instability=player.instability,
            dqs=player.decision_quality_score,
            breakthrough=player.breakthrough_meter,
        )

        # ── Pick best equipped skill ──
        skill = NormalSkill()  # Empty default
        if player.equipped_skills:
            try:
                skill = NormalSkill(**player.equipped_skills[0])
            except Exception:
                logger.warning("Cannot parse equipped skill; using default")

        # ── Build enemy from beat data ──
        default_enemy_principle = "entropy"
        if skill.primary_principle:
            try:
                from app.models.power import Principle
                player_p = Principle(skill.primary_principle)
                default_enemy_principle = player_p.opposite.value
            except (ValueError, AttributeError):
                pass

        enemy = EnemyProfile(
            name="Unknown Entity",
            principle=default_enemy_principle,
            threat_level=0.5,
            description=beat.description,
        )
        if beat.combat_brief and isinstance(beat.combat_brief, dict):
            enemy = EnemyProfile(
                name=beat.combat_brief.get("enemy_name", enemy.name),
                principle=beat.combat_brief.get("enemy_principle", enemy.principle),
                threat_level=beat.combat_brief.get("threat_level", enemy.threat_level),
                description=beat.combat_brief.get("enemy_description", enemy.description),
            )

        crng_roll = random.random()

        # ── Unique skill bonus ──
        unique_bonus = 0.0
        unique_name = ""
        unique_mechanic = ""
        unique_outcome = "full"
        unique_narrative = ""
        unique_ctx: dict = {}
        if player.unique_skill:
            # F3: Ensure growth state exists
            if not player.unique_skill_growth:
                from app.engine.unique_skill_growth import init_growth_state
                player.unique_skill_growth = init_growth_state(player.unique_skill)
                logger.info("Initialized UniqueSkillGrowthState after forge")

            from app.engine.skill_check import check_skill_activation
            activation = check_skill_activation(
                resilience=player.unique_skill.resilience,
                skill_instability=player.unique_skill.instability,
                player_stability=player.stability,
                usage_this_chapter=skill_usage_this_chapter,
                player_instability=player.instability,
            )

            # F2: V2 combat bonus (0.0-0.08)
            from app.engine.unique_skill_combat import (
                unique_skill_combat_bonus_v2,
                build_unique_skill_context,
            )
            v2_bonus = unique_skill_combat_bonus_v2(player)
            unique_bonus = v2_bonus * activation.effectiveness

            unique_name = player.unique_skill.name
            unique_mechanic = player.unique_skill.mechanic
            unique_outcome = activation.outcome.value
            unique_narrative = activation.narrative_instruction

            if activation.stability_cost > 0:
                player.stability = max(0, player.stability - activation.stability_cost)
                metrics.stability = player.stability
            if activation.hp_cost > 0:
                player.hp = max(0, player.hp - activation.hp_cost)
                metrics.hp = player.hp

            logger.info(
                f"Skill activation: {activation.outcome.value} "
                f"(eff={activation.effectiveness:.2f}, v2_bonus={v2_bonus:.3f}, reason={activation.reason})"
            )

            # F5: Check enemy suppression of unique skill
            suppression_result = None
            try:
                from app.engine.suppression_check import check_suppression_from_enemy
                suppression_result = check_suppression_from_enemy(
                    player_skill_category=player.unique_skill.category,
                    player_resistance=getattr(player.unique_skill, "suppression_resistance", 50.0),
                    player_weakness_type=getattr(player.unique_skill, "weakness_type", ""),
                    player_axis_blind_spot=getattr(player.unique_skill, "axis_blind_spot", ""),
                    enemy_has_unique=bool(beat.combat_brief and isinstance(beat.combat_brief, dict) and beat.combat_brief.get("enemy_has_unique")),
                    enemy_unique_category=beat.combat_brief.get("enemy_unique_category", "") if isinstance(beat.combat_brief, dict) else "",
                    enemy_suppression_power=beat.combat_brief.get("enemy_suppression_power", 0.0) if isinstance(beat.combat_brief, dict) else 0.0,
                    enemy_suppression_type=beat.combat_brief.get("enemy_suppression_type", "skill") if isinstance(beat.combat_brief, dict) else "skill",
                )
                # Apply suppression modifier to unique bonus
                if suppression_result and hasattr(suppression_result, "effectiveness_modifier"):
                    unique_bonus *= suppression_result.effectiveness_modifier
                    if suppression_result.level.value != "none":
                        logger.info(
                            "Suppression: %s (modifier=%.2f)",
                            suppression_result.level.value,
                            suppression_result.effectiveness_modifier,
                        )
            except Exception as e:
                logger.debug("Suppression check skipped: %s", e)

            # F4: Build rich context for CombatBrief
            supp_dict = suppression_result.model_dump() if suppression_result else None
            unique_ctx = build_unique_skill_context(
                player=player,
                scene_type="combat",
                is_combat=True,
                enemy_category=enemy.principle,
                suppression_result=supp_dict,
            )

        intensity = Intensity.SAFE

        # ── Determine encounter type ──
        enc_type_str = getattr(beat, "encounter_type", None) or "minor"
        try:
            enc_type = EncounterType(enc_type_str)
        except ValueError:
            enc_type = EncounterType.MINOR

        # ── Route: minor → old engine, duel/boss → new multi-phase ──
        if enc_type in (EncounterType.DUEL, EncounterType.BOSS):
            # Load boss template if boss encounter
            boss_template = None
            if enc_type == EncounterType.BOSS:
                try:
                    from app.engine.boss_data import load_floor_boss
                    boss_template = load_floor_boss(floor)
                except Exception:
                    logger.warning(f"Boss data not found for floor {floor}")

            # Convert player_decisions if provided
            decisions = None
            if player_decisions:
                decisions = [
                    CombatApproach(**d) if isinstance(d, dict) else d
                    for d in player_decisions
                ]

            brief_v2 = run_resolution_combat(
                resonance=resonance,
                metrics=metrics,
                skill=skill,
                enemy=enemy,
                encounter_type=enc_type,
                boss_template=boss_template,
                player_decisions=decisions,
                floor=floor,
                crng_roll=crng_roll,
                unique_skill_bonus=unique_bonus,
                fate_buffer=player.fate_buffer,
            )

            # Write CombatBriefV2 into beat
            beat.combat_brief = brief_v2.model_dump()

            # Sync state back
            player.hp = min(metrics.hp, player.hp_max)
            player.stability = metrics.stability
            player.instability = metrics.instability
            player.resonance = resonance.to_dict()

            # ── Post-combat: Fate Buffer consumption + Defeat handling ──
            from app.engine.failure import consume_fate_buffer, apply_defeat

            if brief_v2.fate_fired:
                consume_fate_buffer(player)
                logger.info("Fate Buffer consumed after mid-combat save")

            defeat_result = None
            if brief_v2.final_outcome == "enemy_wins":
                defeat_result = apply_defeat(
                    player=player,
                    enemy_name=enemy.name,
                    chapter_number=player.total_chapters,
                )
                logger.info(
                    f"Defeat applied: {defeat_result.scar_type} "
                    f"(#{defeat_result.defeat_number}), "
                    f"soul_death={defeat_result.is_soul_death}"
                )
                # Store defeat info in beat for scene writer
                beat.combat_brief["defeat_result"] = defeat_result.model_dump()

            # Build CombatResult for identity delta
            combat_result = build_combat_result(brief_v2)

            # Build phase data list for §6c resonance mastery
            # Each phase needs: skill_principle, outcome, backlash, overdrive info
            phase_data_list = []
            for pr in brief_v2.phases:
                # Determine which skill principle was used this phase
                phase_principle = ""
                if player.equipped_skills:
                    phase_principle = player.equipped_skills[0].get("primary_principle", "")
                phase_data_list.append({
                    "skill_principle": phase_principle,
                    "outcome": pr.outcome,
                    "backlash": pr.backlash_occurred,
                    "skill_used": player.equipped_skills[0].get("id", "") if player.equipped_skills else "",
                    "intensity": pr.intensity_used,
                })

            # Overdrive tracking for §6c-iii
            any_overdrive = any(p.get("intensity") == "overdrive" for p in phase_data_list)
            any_overdrive_backlash = any(
                p.get("intensity") == "overdrive" and p.get("backlash")
                for p in phase_data_list
            )

            return {
                "encounter_type": enc_type.value,
                "final_outcome": brief_v2.final_outcome,
                "outcome": (
                    "favorable" if brief_v2.final_outcome == "player_wins"
                    else "unfavorable" if brief_v2.final_outcome == "enemy_wins"
                    else "mixed"
                ),
                "phases": phase_data_list,
                "phase_count": len(brief_v2.phases),
                "decision_points": len(brief_v2.decision_points),
                "dqs_change": combat_result.dqs_change,
                "breakthrough_change": combat_result.breakthrough_change,
                "skill_outcome": unique_outcome,
                "fate_fired": brief_v2.fate_fired,
                "defeat": defeat_result.model_dump() if defeat_result else None,
                "defeat_result": defeat_result.model_dump() if defeat_result else {},
                "boss_cleared": (
                    enc_type == EncounterType.BOSS
                    and brief_v2.final_outcome == "player_wins"
                ),
                "overdrive_used": any_overdrive,
                "overdrive_misfire": any_overdrive_backlash,
            }

        # ── Minor encounter: use original single-phase engine ──
        # Extract suppression data if available
        supp_level = "none"
        supp_modifier = 1.0
        supp_narrative = ""
        if unique_ctx and isinstance(unique_ctx, dict):
            supp_level = unique_ctx.get("suppression_level", "none")
            supp_modifier = unique_ctx.get("suppression_modifier", 1.0)
            supp_narrative = unique_ctx.get("suppression_narrative", "")

        brief = build_combat_brief(
            resonance=resonance,
            metrics=metrics,
            skill=skill,
            enemy=enemy,
            floor=floor,
            intensity=intensity,
            crng_roll=crng_roll,
            unique_skill_bonus=unique_bonus,
            unique_skill_name=unique_name,
            unique_skill_mechanic=unique_mechanic,
            unique_skill_outcome=unique_outcome,
            unique_skill_narrative=unique_narrative,
            personal_cap_bonus=player.progression.personal_cap_bonus,
            suppression_level=supp_level,
            suppression_modifier=supp_modifier,
            suppression_narrative=supp_narrative,
        )
        # F4: Inject V2 unique skill context
        brief.unique_skill_context = unique_ctx

        beat.combat_brief = brief.model_dump()

        player.hp = min(metrics.hp, player.hp_max)
        player.stability = metrics.stability
        player.instability = metrics.instability
        player.resonance = resonance.to_dict()

        # ── Post-combat: Fate Buffer + Defeat handling for minor ──
        from app.engine.failure import (
            can_fate_save, consume_fate_buffer, apply_defeat,
        )

        fate_fired = False
        defeat_result = None

        if player.hp <= 0:
            # Try fate save
            if can_fate_save(player.fate_buffer):
                player.hp = 1.0
                consume_fate_buffer(player)
                fate_fired = True
                logger.info("Fate Buffer save on minor encounter")
            else:
                # Apply defeat
                defeat_result = apply_defeat(
                    player=player,
                    enemy_name=enemy.name,
                    chapter_number=player.total_chapters,
                )
                logger.info(
                    f"Minor encounter defeat: {defeat_result.scar_type} "
                    f"(#{defeat_result.defeat_number})"
                )
                beat.combat_brief["defeat_result"] = defeat_result.model_dump()

        return {
            "encounter_type": "minor",
            "combat_score": brief.combat_score,
            "final_outcome": (
                "enemy_wins" if defeat_result
                else "player_wins" if brief.outcome == "favorable"
                else brief.outcome
            ),
            "outcome": brief.outcome,
            "stability_cost": brief.stability_cost,
            "hp_cost": brief.hp_cost,
            "resonance_growth": brief.resonance_growth,
            "backlash": brief.backlash_triggered,
            "skill_outcome": unique_outcome,
            "fate_fired": fate_fired,
            "defeat": defeat_result.model_dump() if defeat_result else None,
            "defeat_result": defeat_result.model_dump() if defeat_result else {},
        }
