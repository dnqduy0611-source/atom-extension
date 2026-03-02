# NeuralMemory Integration Spec — Amo Stories Engine

> **Mục tiêu:** Tích hợp NeuralMemory v2.8 để cung cấp semantic long-term memory cho story engine, hỗ trợ 20-30 chapters mà không mất context.
>
> **Trạng thái:** ✅ **ĐÃ TRIỂN KHAI** (Phase 1-4 hoàn tất, 274 tests passed)

---

## 1. Vấn Đề Hiện Tại

| Hệ thống | Cách hoạt động | Giới hạn |
|-----------|---------------|----------|
| `build_rolling_summary()` | Lấy 5 chương gần nhất, format text | Chương 1-5 bị mất khi đến chương 6+ |
| `StoryBrain` wrapper | Graceful degradation (no-op) | NeuralMemory chưa cài, không có semantic search |
| `previous_summary` | Inject vào planner/writer prompt | Chỉ có text summary, không có entity/relationship recall |

**Kết quả:** AI "quên" NPC, sự kiện, lời hứa từ chương đầu khi story dài.

---

## 2. Giải Pháp: NeuralMemory v2.8

NeuralMemory là **reflex-based memory system** — dùng graph activation (không phải vector similarity) để retrieve relevant memories.

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────┐
│                Story Engine                          │
│                                                      │
│  generate_chapter_plan()                             │
│    ├── brain.query_context(choice_text)  ← QUERY     │
│    ├── Nối semantic_context vào previous_summary     │
│    └── Planner tạo beats với full context            │
│                                                      │
│  generate_single_scene()                             │
│    ├── brain.query_context(beat.description) ← QUERY │
│    ├── Scene Writer nhận semantic_context             │
│    ├── Output: scene prose + choices                 │
│    └── brain.store_scene(prose, NPCs, ...) → STORE   │
│                                                      │
│  Chapter End:                                        │
│    └── brain.store_chapter_summary() → STORE         │
└─────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────┐
│              NeuralMemory v2.8                       │
│                                                      │
│  SQLiteStorage ──→ Brain ──→ MemoryEncoder           │
│       │                           │                  │
│       │              encode(text, tags, metadata)     │
│       │                           ↓                  │
│       │              Neurons + Synapses + Fibers     │
│       │                                              │
│       └────→ ReflexPipeline.query(text)              │
│                    │                                 │
│                    ↓                                 │
│              Reflex Activation → Fiber traversal     │
│                    ↓                                 │
│              RetrievalResult (relevant memories)     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Tại sao NeuralMemory (không phải RAG/vector DB)?

| Feature | NeuralMemory | RAG (ChromaDB) |
|---------|-------------|----------------|
| **Deps** | Chỉ SQLite + networkx (có sẵn) | Cần embedding model + chromadb |
| **Retrieval** | Graph reflex activation — tìm theo liên kết ngữ nghĩa | Vector similarity — tìm theo khoảng cách embedding |
| **Entity tracking** | Tự động extract entities → tạo neurons + synapses | Không, phải tự implement |
| **Temporal reasoning** | Built-in temporal traversal | Không |
| **Local source** | Có sẵn tại `neural-memory-main/` | Cần install thêm |

---

## 3. Thay Đổi Code Chi Tiết

### 3.1 Install

```bash
pip install -e "d:\Amo\ATOM_Extension_V2.8_public\neural-memory-main"
```

Verify: `python -c "from neural_memory import Brain, MemoryEncoder; print('OK')"`

---

### 3.2 `app/memory/story_brain.py` — REWRITE HOÀN TOÀN

**Trước (API cũ, không hoạt động):**
```python
# BROKEN: NeuralMemory(persist_directory=...) không tồn tại trong v2.8
self._brain = NeuralMemory(persist_directory=str(brain_path))

# BROKEN: .store() / .query() không phải API v2.8
self._brain.store(text=text, metadata=meta)
results = self._brain.query(query=query_text, top_k=top_k)
```

**Sau (API v2.8):**

```python
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
        """Store scene content as semantic memory."""
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
        Uses RetrievalResult.context (pre-formatted by pipeline)
        with fallback to RetrievalResult.answer.
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
```

---

### 3.3 `app/engine/orchestrator.py` — TẤT CẢ integration points

Orchestrator có **3 hàm generate** + **1 fallback**, tất cả đều cần NeuralMemory:

| Hàm | Line | Mô tả | Semantic Query? | Store? |
|-----|------|-------|-----------------|--------|
| `generate_chapter()` | ~170 | Monolithic (1 LLM call = full chapter) | ✅ trước pipeline | ✅ `store_chapter_summary` |
| `generate_scene_chapter()` | ~340 | Batch scene-by-scene (non-interactive) | ✅ trước pipeline | ✅ per-scene + summary |
| `generate_chapter_plan()` | ~611 | Planner only (interactive Phase B) | ✅ trước planner | ❌ (chưa có prose) |
| `generate_single_scene()` | ~710 | 1 scene (interactive Phase B) | ✅ trước scene writer | ✅ per-scene + summary |
| `_fallback_to_monolithic()` | ~575 | Wraps monolithic → scene | ❌ (gọi generate_chapter) | ❌ (đã store trong generate_chapter) |

#### Point A: `generate_chapter()` ~line 190

```python
# ── 2. Rolling summary ──
previous_summary = build_rolling_summary(chapters)

# ── 2b. Semantic memory query (NEW) ──
brain = get_or_create_brain(story_id, story.brain_id)
if brain.available and chapter_number > 1:
    query_text = choice.text if choice else f"Chương {chapter_number}"
    semantic_ctx = brain.query_context(query_text)
    if semantic_ctx:
        previous_summary += "\n\n" + semantic_ctx
```

**Store** (~line 315): Đổi `brain.store_chapter()` → `brain.store_chapter_summary()`

#### Point B: `generate_scene_chapter()` ~line 366

Same pattern: thêm semantic query sau `build_rolling_summary()`, trước pipeline_input. Cũng dùng `await get_or_create_brain()`.

**Store per-scene** (~line 495): `await brain.store_scene(...)` cho mỗi scene trong loop.

**Store chapter** (~line 580): `await brain.store_chapter_summary()` (đã đổi từ `brain.store_chapter()`)

#### Point C: `generate_chapter_plan()` ~line 638

```python
# ── 2b. Semantic memory query (NEW) ──
brain = await get_or_create_brain(story_id, story.brain_id)
if brain.available:
    query_text = choice.text if choice else free_input or f"Chương {chapter_number}"
    semantic_ctx = await brain.query_context(query_text)
    if semantic_ctx:
        previous_summary += "\n\n" + semantic_ctx
```

#### Point D: `generate_single_scene()` ~line 806

Thêm semantic query trước scene generation:

```python
# ── 4e. Semantic memory query (NEW) ──
brain = await get_or_create_brain(story_id, story.brain_id)
semantic_context = ""
if brain.available:
    query_text = beat.description or (choice.text if choice else "")
    semantic_context = await brain.query_context(query_text)

# ── 5. Generate scene ──
scene_input = SceneWriterInput(
    ...  # existing fields
    semantic_context=semantic_context,  # NEW
)
```

**Store per-scene** (~line 837):

```python
# Save scene to DB
self.db.save_scene(scene)

# ── Store scene in NeuralMemory (NEW) ──
if brain.available:
    await brain.store_scene(
        scene_number=scene_number,
        chapter_number=chapter.chapter_number,
        prose=scene.prose,
        scene_type=scene.scene_type,
        choice_text=choice.text if choice else free_input,
        title=scene.title or "",
    )
```

**Store chapter summary** (~line 925): `brain.store_chapter_summary()` (đã đổi từ `brain.store_chapter()`)

> [!IMPORTANT]
> Tất cả calls đến `get_or_create_brain()` và `brain.store_*()` / `brain.query_context()` đều **phải `await`** vì API v2.8 hoàn toàn async.

---

### 3.4 `app/narrative/scene_writer.py`

#### SceneWriterInput — thêm field:

```python
@dataclass
class SceneWriterInput:
    ...
    skill_usage_this_chapter: int = 0
    combat_brief: dict | None = None
    semantic_context: str = ""    # NeuralMemory retrieved context
```

#### _USER_TEMPLATE — thêm section:

```
## Ký ức dài hạn (từ các chương trước):
{semantic_context}
```

Thêm vào cuối template, sau `{critic_feedback}`.

#### run_scene_writer() — format field:

```python
semantic_context=scene_input.semantic_context or "Không có ký ức liên quan.",
```

---

### 3.5 `app/prompts/scene_writer.md` — thêm quy tắc

Thêm vào phần **Quy tắc Prose**, sau rule 7:

```markdown
8. **KÝ ỨC DÀI HẠN:** Nếu phần "Ký ức dài hạn" có nội dung (không phải "Không có ký ức liên quan"):
   - Tự nhiên reference NPC, sự kiện, hoặc địa điểm từ các chương trước khi phù hợp
   - VD: nhân vật nhớ lại lời dặn, vết sẹo cũ nhói đau, NPC quen xuất hiện lại
   - KHÔNG ép buộc — chỉ weave vào khi tình huống cho phép
   - KHÔNG copy nguyên văn — paraphrase thành narrative tự nhiên
```

---

### 3.6 `app/narrative/context.py` — cleanup TODO

File này có TODO comments cho NeuralMemory nhưng **KHÔNG CẦN sửa** vì:
- `run_context()` chỉ được gọi trong `pipeline.py` (monolithic flow)
- Semantic context đã được inject via `previous_summary` ở orchestrator level
- Nếu muốn: có thể thêm `brain.query_context()` ở đây sau này, nhưng không cần cho Phase 1

### 3.7 `app/narrative/simulator.py` — Tự động hưởng lợi

`simulator.py` dùng `{previous_summary}` từ `NarrativeState` → vì orchestrator đã nối `semantic_context` vào `previous_summary` trước khi build `pipeline_input`, simulator tự động nhận semantic context. **KHÔNG CẦN sửa.**

---

## 4. Data Storage Layout

```
amo-stories-engine/
├── data/
│   ├── stories.db          ← SQLite: stories, chapters, scenes, players
│   └── brains/
│       ├── {story_id_1}/
│       │   └── memory.db   ← NeuralMemory: neurons, synapses, fibers
│       ├── {story_id_2}/
│       │   └── memory.db
│       └── ...
```

Mỗi story có 1 brain riêng → không conflict giữa các stories.

---

## 5. Memory Content Design

### Khi STORE scene, NeuralMemory nhận:

```
[Chương 3 - Scene 2] Cuộc Gặp Trong Đền Cổ
Aeres bước vào ngôi đền. Bụi phủ dày trên các bàn thờ đá.
Một bóng hình xuất hiện từ sau cột trụ — cụ già mặc áo choàng xám,
đôi mắt sáng rực trong bóng tối. "Ta đã chờ ngươi," cụ nói.
→ Player chọn: Hỏi cụ già về lịch sử ngôi đền
Nhân vật: Old Sage, Aeres
```

**Tags:** `scene_memory`, `chapter:3`, `scene:2`, `type:discovery`, `npc:Old Sage`

### Khi QUERY, ReflexPipeline trả về:

`RetrievalResult` có các trường chính:
- `context: str` — Pre-formatted context string (dùng chính)
- `answer: str | None` — Reconstructed answer (fallback)
- `confidence: float` — 0.0-1.0 (threshold: 0.1)
- `fibers_matched: list[str]` — IDs, KHÔNG phải fiber objects

```
## Ký ức liên quan (từ các chương trước):
## Relevant Memories

- [Chương 1 - Scene 1] Gap Hac Vu
Aeres thuc day tren dinh nui Linh Son...
→ Lựa chọn: Tha Hac Vu, doi lay thong tin
- [Chương 2 - Scene 2] Hoan De Xuat The
Khe Nut mo ra, anh sang xanh tran ngap...
```

> [!WARNING]
> **KHÔNG dùng `result.fibers`** — `RetrievalResult` v2.8 chỉ có `fibers_matched: list[str]` (IDs).
> Dùng `result.context` (pre-formatted) hoặc `result.answer` (fallback).

→ Scene Writer nhận context này → viết prose tham chiếu NPC + sự kiện tự nhiên.

---

## 6. Graceful Degradation

```python
# Nếu NeuralMemory fail ở bất kỳ bước nào:
# - Import fail → _NEURAL_MEMORY_AVAILABLE = False → StoryBrain.available = False
# - Init fail → self._storage = None → available = False
# - encode() fail → catch Exception, log warning, continue
# - query() fail → return "" → writer chạy không có semantic_context
#
# → KHÔNG BAO GIỜ crash story generation vì NeuralMemory
```

---

## 7. Verification Checklist

- [x] `pip install -e neural-memory-main` thành công
- [x] `python -c "from neural_memory import Brain; print('OK')"` pass
- [x] `StoryBrain("test").available` returns `True` (sau `await initialize()`)
- [x] Store 4 scenes + query → trả về 822 chars relevant context
- [x] `memory.db` created: 430KB tại `data/brains/{story_id}/memory.db`
- [x] `RetrievalResult.context` hoạt động (đã fix bug `.fibers` → `.context`)
- [x] Restart persistence: brain re-initializes from SQLite
- [x] All tests pass: `pytest tests/ -v` → **274 passed**
- [ ] Scene 6+ prose tham chiếu chi tiết từ scene 1-2 (cần live story test)

---

## 8. Performance Estimates

| Operation | Estimated Time | Notes |
|-----------|---------------|-------|
| `MemoryEncoder.encode()` | 50-200ms | Graph insert, no LLM call |
| `ReflexPipeline.query()` | 100-500ms | Graph traversal + FTS |
| Total overhead per scene | ~300-700ms | vs LLM call ~3-8s → negligible |

---

## 9. Files Modified Summary

| File | Change Type | Lines Changed |
|------|------------|---------------|
| `app/memory/story_brain.py` | **REWRITE** | 250 lines (async API) |
| `app/engine/orchestrator.py` | **MODIFY** | +55 lines (4 points: query + store) |
| `app/narrative/scene_writer.py` | **MODIFY** | +5 lines |
| `app/prompts/scene_writer.md` | **MODIFY** | +5 lines |
| `tests/test_story_brain.py` | **NEW** | 229 lines (12 tests) |

## 10. Files NOT Modified (and why)

| File | Reason |
|------|--------|
| `app/narrative/simulator.py` | Tự động nhận semantic context qua `previous_summary` |
| `app/narrative/context.py` | Chỉ dùng trong monolithic flow, orchestrator đã xử lý |
| `app/narrative/planner.py` | Nhận `previous_summary` đã có semantic context |
| `app/narrative/pipeline.py` | Chỉ là LangGraph graph definition, không cần sửa |
| `app/memory/encoding.py` | `build_rolling_summary()` giữ nguyên, semantic context bổ sung chứ không thay thế |
| `app/models/pipeline.py` | `NarrativeState` không cần field mới — semantic context đi qua `previous_summary` |
