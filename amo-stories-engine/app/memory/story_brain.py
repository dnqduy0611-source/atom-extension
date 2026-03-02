"""NeuralMemory Brain Manager — per-story semantic memory using v2.8 API.

Uses NeuralMemory v2.8:
- SQLiteStorage: persistent graph storage
- Brain: memory container
- MemoryEncoder: text → neurons + synapses + fibers
- ReflexPipeline: query → relevant memories via graph activation

All encode/query operations are async.
Graceful degradation: if NeuralMemory is not installed, StoryBrain is a no-op.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# NeuralMemory import — optional, graceful degradation
# ──────────────────────────────────────────────

_NEURAL_MEMORY_AVAILABLE = False
try:
    from neural_memory import Brain, BrainConfig, MemoryEncoder
    from neural_memory.engine.retrieval import ReflexPipeline
    from neural_memory.storage.sqlite_store import SQLiteStorage
    _NEURAL_MEMORY_AVAILABLE = True
except ImportError:
    logger.warning("NeuralMemory not installed — running without semantic memory")


class StoryBrain:
    """Per-story semantic memory using NeuralMemory v2.8.

    Lifecycle:
        brain = StoryBrain(story_id)
        await brain.initialize()       # async setup required
        await brain.store_scene(...)    # store scene content
        ctx = await brain.query_context(...)  # retrieve relevant memories
        await brain.close()             # cleanup
    """

    def __init__(self, story_id: str, brain_id: str = "") -> None:
        self.story_id = story_id
        self.brain_id = brain_id or story_id
        self._storage: "SQLiteStorage | None" = None
        self._encoder: "MemoryEncoder | None" = None
        self._retriever: "ReflexPipeline | None" = None
        self._brain: "Brain | None" = None
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize storage, brain, encoder, and retriever (async)."""
        if not _NEURAL_MEMORY_AVAILABLE:
            return
        if self._initialized:
            return
        try:
            db_dir = Path(settings.db_path).parent / "brains" / self.brain_id
            db_dir.mkdir(parents=True, exist_ok=True)
            db_path = db_dir / "memory.db"

            self._storage = SQLiteStorage(db_path)
            await self._storage.initialize()

            self._brain = Brain.create(
                name=f"story-{self.story_id}",
                brain_id=self.brain_id,
            )
            self._storage.set_brain(self.brain_id)

            # Persist brain metadata (idempotent)
            try:
                await self._storage.save_brain(self._brain)
            except Exception:
                pass  # Already exists

            self._encoder = MemoryEncoder(
                storage=self._storage,
                config=self._brain.config,
            )
            self._retriever = ReflexPipeline(
                storage=self._storage,
                config=self._brain.config,
            )
            self._initialized = True
            logger.info(f"StoryBrain: initialized for story {self.story_id}")
        except Exception as e:
            logger.error(f"StoryBrain init failed: {e}")
            self._storage = None
            self._encoder = None
            self._retriever = None

    @property
    def available(self) -> bool:
        return self._initialized and self._encoder is not None

    # ══════════════════════════════════════
    # STORE
    # ══════════════════════════════════════

    async def store_scene(
        self,
        scene_number: int,
        chapter_number: int,
        prose: str,
        scene_type: str = "",
        choice_text: str = "",
        npcs: list[str] | None = None,
        mood: str = "",
        title: str = "",
    ) -> None:
        """Store scene content as semantic memory.

        Encoding extracts entities (NPCs, locations), relationships,
        and temporal context → creates neurons + synapses in graph.
        """
        if not self._encoder:
            return
        try:
            parts = [f"[Chương {chapter_number} - Scene {scene_number}]"]
            if title:
                parts[0] += f" {title}"
            parts.append(prose[:800])
            if choice_text:
                parts.append(f"→ Player chọn: {choice_text}")
            if npcs:
                parts.append(f"Nhân vật: {', '.join(npcs)}")

            tags = {
                "scene_memory",
                f"chapter:{chapter_number}",
                f"scene:{scene_number}",
                f"type:{scene_type}",
            }
            if npcs:
                for npc in npcs:
                    tags.add(f"npc:{npc}")

            await self._encoder.encode(
                content="\n".join(parts),
                metadata={
                    "story_id": self.story_id,
                    "chapter": chapter_number,
                    "scene": scene_number,
                    "scene_type": scene_type,
                },
                tags=tags,
            )
            logger.debug(f"StoryBrain: stored scene {chapter_number}.{scene_number}")
        except Exception as e:
            logger.error(f"StoryBrain store_scene failed: {e}")

    async def store_chapter_summary(
        self,
        chapter_number: int,
        summary: str,
        choice_text: str = "",
    ) -> None:
        """Store high-level chapter summary memory."""
        if not self._encoder:
            return
        try:
            text = f"[Tóm tắt Chương {chapter_number}]\n{summary}"
            if choice_text:
                text += f"\n→ Lựa chọn: {choice_text}"

            await self._encoder.encode(
                content=text,
                metadata={
                    "story_id": self.story_id,
                    "chapter": chapter_number,
                    "type": "chapter_summary",
                },
                tags={"chapter_summary", f"chapter:{chapter_number}"},
            )
            logger.debug(f"StoryBrain: stored chapter {chapter_number} summary")
        except Exception as e:
            logger.error(f"StoryBrain store_chapter_summary failed: {e}")

    # ══════════════════════════════════════
    # QUERY
    # ══════════════════════════════════════

    async def query_context(self, query: str, max_tokens: int = 1500) -> str:
        """Query semantic memory for relevant past events.

        Returns formatted context string for LLM prompt injection.
        Returns empty string if no results or on error.
        """
        if not self._retriever:
            return ""
        try:
            result = await self._retriever.query(query=query, max_tokens=max_tokens)
            if not result or result.confidence < 0.1:
                return ""

            # RetrievalResult.context is pre-formatted by the pipeline
            context = result.context.strip() if result.context else ""

            # Fallback to answer if context is empty
            if not context and result.answer:
                context = result.answer.strip()

            if not context:
                return ""

            formatted = (
                f"## Ký ức liên quan (từ các chương trước):\n{context}"
            )
            logger.debug(
                f"StoryBrain: query returned {len(result.fibers_matched)} fibers, "
                f"confidence={result.confidence:.2f}"
            )
            return formatted
        except Exception as e:
            logger.warning(f"StoryBrain query failed: {e}")
            return ""

    async def close(self) -> None:
        """Close storage connection."""
        if self._storage:
            await self._storage.close()
            self._storage = None
            self._encoder = None
            self._retriever = None
            self._initialized = False


# ──────────────────────────────────────────────
# Brain cache (per story) — with async init
# ──────────────────────────────────────────────

_brain_cache: dict[str, StoryBrain] = {}


async def get_or_create_brain(story_id: str, brain_id: str = "") -> StoryBrain:
    """Get or create a StoryBrain for a story (cached + async initialized)."""
    cache_key = brain_id or story_id
    if cache_key not in _brain_cache:
        brain = StoryBrain(story_id, brain_id)
        await brain.initialize()
        _brain_cache[cache_key] = brain
    return _brain_cache[cache_key]
