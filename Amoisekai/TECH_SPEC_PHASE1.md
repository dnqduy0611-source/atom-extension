# 🏗️ AMOISEKAI — Technical Spec Phase 1: Single Player Isekai Engine

> **Date:** 2026-02-22  
> **Scope:** Mở rộng AmoStories Engine thành Amoisekai single-player  
> **Base:** `amo-stories-engine/` (FastAPI + LangGraph + NeuralMemory + Gemini 2.5 Flash)  
> **Goal:** 20-30 chương playable với Identity System, CRNG, Fate Buffer

---

## 1. Tổng Quan Thay Đổi

### Có sẵn (reuse từ AmoStories):
- ✅ FastAPI skeleton (`main.py`, `config.py`)
- ✅ SQLite state DB (`memory/state.py`) — stories + chapters CRUD
- ✅ Pydantic models (`models/story.py`, `models/pipeline.py`)
- ✅ REST API routes (`routers/story.py`, `routers/stream.py`)
- ✅ Dependencies (`pyproject.toml`) — langgraph, neural-memory, sse-starlette

### Cần build mới cho Phase 1:
- 🔨 **Identity System** — onboarding, seed, drift, instability
- 🔨 **Player State** — mở rộng SQLite schema
- 🔨 **7-agent Pipeline** — implement cả 7 agents (chỉ có skeleton)
- 🔨 **CRNG Engine** — DNA Affinity, Pity Timer, Breakthrough
- 🔨 **Fate Buffer** — early-game protection
- 🔨 **Prompt Templates** — tất cả system/user prompts
- 🔨 **Free Input Handler** — agent thứ 0 xử lý input tự do
- 🔨 **Web App UI** — React/Next.js frontend

---

## 2. Project Structure (Phase 1)

```
amo-stories-engine/
├── pyproject.toml              # CẬP NHẬT: thêm dependencies
├── .env.example
├── app/
│   ├── __init__.py
│   ├── main.py                 # CẬP NHẬT: thêm player state init
│   ├── config.py               # CẬP NHẬT: thêm identity config
│   │
│   ├── models/
│   │   ├── __init__.py         # CẬP NHẬT: export new models
│   │   ├── story.py            # CẬP NHẬT: thêm free_input vào Choice
│   │   ├── pipeline.py         # CẬP NHẬT: thêm IdentityUpdate agent
│   │   ├── player.py           # [MỚI] PlayerState, SeedIdentity, DNA
│   │   └── identity.py         # [MỚI] Identity models, mutation
│   │
│   ├── memory/
│   │   ├── __init__.py
│   │   ├── state.py            # CẬP NHẬT: thêm players table
│   │   ├── story_brain.py      # [MỚI] NeuralMemory Brain manager
│   │   └── encoding.py         # [MỚI] Chapter → NeuralMemory encoder
│   │
│   ├── narrative/
│   │   ├── __init__.py
│   │   ├── pipeline.py         # [MỚI] LangGraph graph wiring
│   │   ├── planner.py          # [MỚI] Agent 1: Chapter outline
│   │   ├── simulator.py        # [MỚI] Agent 2: Consequences
│   │   ├── context.py          # [MỚI] Agent 3: NeuralMemory query
│   │   ├── writer.py           # [MỚI] Agent 5: Prose + choices
│   │   ├── critic.py           # [MỚI] Agent 6: Quality gate
│   │   ├── identity_agent.py   # [MỚI] Agent 7: DQS/coherence update
│   │   └── input_parser.py     # [MỚI] Agent 0: Free input → Choice
│   │
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── crng.py             # [MỚI] Controlled RNG
│   │   ├── fate_buffer.py      # [MỚI] Early-game protection
│   │   └── onboarding.py       # [MỚI] Quiz → Seed Identity
│   │
│   ├── prompts/
│   │   ├── planner.md          # [MỚI] System prompt
│   │   ├── simulator.md        # [MỚI]
│   │   ├── writer.md           # [MỚI]
│   │   ├── critic.md           # [MỚI]
│   │   ├── identity.md         # [MỚI]
│   │   └── onboarding.md       # [MỚI]
│   │
│   └── routers/
│       ├── __init__.py
│       ├── story.py            # CẬP NHẬT: wire pipeline
│       ├── stream.py           # CẬP NHẬT: implement SSE
│       ├── player.py           # [MỚI] Onboarding, identity, state
│       └── debug.py            # [MỚI] Dev-only state inspection
│
├── web/                         # [MỚI] Frontend (Phase 1 basic)
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Onboarding.tsx
│       │   ├── StoryReader.tsx
│       │   └── Dashboard.tsx
│       └── components/
│           ├── ChapterView.tsx
│           ├── ChoicePanel.tsx
│           └── IdentityCard.tsx
│
└── tests/
    ├── test_models.py
    ├── test_state_db.py
    ├── test_pipeline.py
    ├── test_crng.py
    └── test_identity.py
```

---

## 3. Database Schema (Phase 1)

### 3.1 Bảng Hiện Có — Cập Nhật

#### `stories` — Thêm trường isekai

```sql
-- Giữ nguyên cấu trúc AmoStories, thêm trường
ALTER TABLE stories ADD COLUMN setting TEXT DEFAULT 'isekai';
-- setting: isekai world do AI generate (Tiên Hiệp, Huyền Huyễn, etc.)
```

#### `chapters` — Thêm free input

```sql
ALTER TABLE chapters ADD COLUMN free_input TEXT DEFAULT '';
-- Lưu input tự do của player (nếu có)
ALTER TABLE chapters ADD COLUMN identity_delta_json TEXT DEFAULT '{}';
-- Thay đổi identity sau chương này
```

### 3.2 Bảng Mới

#### `players` — Player State

```sql
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,                           -- uuid
    user_id TEXT NOT NULL UNIQUE,                   -- external user ID
    name TEXT NOT NULL DEFAULT '',                  -- player chosen name

    -- Identity
    seed_identity_json TEXT NOT NULL DEFAULT '{}',  -- SeedIdentity JSON
    current_identity_json TEXT DEFAULT '{}',        -- CurrentIdentity JSON
    latent_identity_json TEXT DEFAULT '{}',         -- LatentIdentity JSON
    archetype TEXT DEFAULT '',                      -- vanguard|catalyst|sovereign|seeker|tactician|wanderer
    dna_affinity_json TEXT DEFAULT '[]',            -- ["shadow","oath","mind"]

    -- Scores
    echo_trace REAL DEFAULT 100.0,                 -- 0-100, starts max
    identity_coherence REAL DEFAULT 100.0,          -- 0-100, starts max
    instability REAL DEFAULT 0.0,                   -- 0-100, starts 0
    decision_quality_score REAL DEFAULT 50.0,        -- 0-100
    breakthrough_meter REAL DEFAULT 0.0,             -- 0-100
    notoriety REAL DEFAULT 0.0,                      -- 0-100
    pity_counter INTEGER DEFAULT 0,                  -- chapters since last major event

    -- Progress
    total_chapters INTEGER DEFAULT 0,
    fate_buffer REAL DEFAULT 100.0,                  -- 0-100, decay over time
    alignment REAL DEFAULT 0.0,                      -- -100 to 100
    turns_today INTEGER DEFAULT 0,
    turns_reset_date TEXT DEFAULT '',

    -- Meta
    brain_id TEXT DEFAULT '',                        -- NeuralMemory Brain ID
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
```

#### `player_flags` — Major Plot Flags

```sql
CREATE TABLE IF NOT EXISTS player_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    flag_key TEXT NOT NULL,                         -- "saved_city_huyenvan"
    flag_value TEXT DEFAULT '',                      -- "chapter_12"
    chapter_number INTEGER,                          -- which chapter
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(player_id, flag_key)
);
```

#### `identity_events` — Identity Mutation Log

```sql
CREATE TABLE IF NOT EXISTS identity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    event_type TEXT NOT NULL,                        -- seed_created|drift|confrontation|mutation|realignment
    chapter_number INTEGER,
    description TEXT DEFAULT '',
    before_json TEXT DEFAULT '{}',                   -- snapshot before
    after_json TEXT DEFAULT '{}',                    -- snapshot after
    created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 4. Data Models (Python)

### 4.1 `models/player.py` — [MỚI]

```python
"""Player state and identity models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from uuid import uuid4

class DNAAffinityTag(str, Enum):
    SHADOW = "shadow"
    OATH = "oath"
    BLOODLINE = "bloodline"
    TECH = "tech"
    CHAOS = "chaos"
    MIND = "mind"
    CHARM = "charm"
    RELIC = "relic"

class SeedIdentity(BaseModel):
    """Created once during onboarding. Never deleted."""
    core_values: list[str]          # ["loyalty", "freedom", "knowledge"]
    personality_traits: list[str]   # ["cautious", "analytical"]
    motivation: str                 # "Tìm kiếm sức mạnh để bảo vệ"
    fear: str                       # "Mất đi người thân"
    origin_story: str               # 2-3 câu do AI generate từ quiz

class CurrentIdentity(BaseModel):
    """Updated after every chapter."""
    active_values: list[str] = []
    active_traits: list[str] = []
    current_motivation: str = ""
    reputation_tags: list[str] = []     # ["merciful", "ruthless", "cunning"]
    power_style: str = ""               # combat|influence|strategic

class LatentIdentity(BaseModel):
    """Xu hướng đang hình thành. AI detects patterns."""
    emerging_traits: list[str] = []
    drift_direction: str = ""           # "toward_ruthless" | "toward_compassion"
    trigger_events: list[str] = []      # events causing drift

class PlayerState(BaseModel):
    """Full player state model."""
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    user_id: str
    name: str = ""

    # Identity
    seed_identity: SeedIdentity | None = None
    current_identity: CurrentIdentity = Field(default_factory=CurrentIdentity)
    latent_identity: LatentIdentity = Field(default_factory=LatentIdentity)
    archetype: str = ""
    dna_affinity: list[DNAAffinityTag] = Field(default_factory=list)

    # Scores
    echo_trace: float = 100.0
    identity_coherence: float = 100.0
    instability: float = 0.0
    decision_quality_score: float = 50.0
    breakthrough_meter: float = 0.0
    notoriety: float = 0.0
    pity_counter: int = 0

    # Progress
    total_chapters: int = 0
    fate_buffer: float = 100.0
    alignment: float = 0.0
    turns_today: int = 0
```

### 4.2 `models/pipeline.py` — Cập Nhật

Thêm vào NarrativeState:

```python
class NarrativeState(BaseModel):
    # ... (giữ nguyên tất cả fields hiện có) ...

    # [MỚI] Player identity context
    player_state: PlayerState | None = None

    # [MỚI] Free input
    free_input: str = ""                # Player's custom action text

    # [MỚI] Identity update output
    identity_delta: IdentityDelta | None = None

class IdentityDelta(BaseModel):
    """Changes to player identity after a chapter."""
    coherence_change: float = 0.0       # -5 to +3 per chapter
    instability_change: float = 0.0     # -3 to +5 per chapter
    echo_trace_change: float = 0.0
    dqs_change: float = 0.0
    breakthrough_change: float = 0.0
    notoriety_change: float = 0.0
    pity_reset: bool = False            # True if major event occurred
    new_flags: list[str] = []
    drift_detected: str = ""            # "", "minor", "major"
    confrontation_triggered: bool = False
```

### 4.3 `models/story.py` — Cập Nhật

```python
class ContinueRequest(BaseModel):
    story_id: str
    chapter_id: str
    choice_id: str = ""                 # Trống nếu dùng free input
    free_input: str = ""                # Input tự do của player

class StartRequest(BaseModel):
    user_id: str
    genre: Genre
    world_desc: str = ""
    protagonist_name: str = ""
    # [MỚI] Onboarding quiz answers
    quiz_answers: dict = Field(default_factory=dict)
```

---

## 5. API Endpoints (Phase 1)

### 5.1 Player Routes — `/api/player/` [MỚI]

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/player/onboard` | Quiz → tạo Seed Identity + DNA |
| `GET` | `/api/player/{user_id}` | Lấy player state |
| `GET` | `/api/player/{user_id}/identity` | Chi tiết identity (seed, current, latent) |
| `GET` | `/api/player/{user_id}/events` | Identity event log |

#### `POST /api/player/onboard`

```json
// Request
{
    "user_id": "user_abc123",
    "name": "Lý Thiên Vũ",
    "quiz_answers": {
        "q1_confrontation": "fight",       // fight | negotiate | observe | flee
        "q2_loyalty": "protect_strangers",  // protect_strangers | protect_self | protect_allies
        "q3_power_source": "knowledge",     // strength | knowledge | connection | deception
        "q4_sacrifice": "accept",           // accept | refuse | bargain
        "q5_worldview": "change_it"         // accept_it | change_it | escape_it | understand_it
    }
}

// Response
{
    "player_id": "a1b2c3d4e5f6",
    "seed_identity": {
        "core_values": ["knowledge", "protection", "sacrifice"],
        "personality_traits": ["analytical", "protective", "curious"],
        "motivation": "Tìm kiếm tri thức để bảo vệ kẻ yếu",
        "fear": "Sự thiếu hiểu biết dẫn đến bi kịch",
        "origin_story": "Một kẻ du hành từ thế giới khác, mang theo..."
    },
    "archetype": "seeker",
    "dna_affinity": ["mind", "oath", "relic"]
}
```

### 5.2 Story Routes — Cập Nhật

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/story/start` | Tạo story + generate chương 1 |
| `POST` | `/api/story/continue` | Chọn + generate chương tiếp |
| `GET` | `/api/story/stream/{chapter_id}` | SSE streaming |
| `GET` | `/api/story/{story_id}/state` | Story + chapters |
| `GET` | `/api/story/user/{user_id}` | List stories |
| `DELETE` | `/api/story/{story_id}` | Xóa story |

### 5.3 Debug Routes — `/api/debug/` [MỚI, Dev Only]

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/debug/player/{user_id}/brain` | Dump NeuralMemory |
| `POST` | `/api/debug/player/{user_id}/reset` | Reset player state |

---

## 6. Pipeline Chi Tiết (7 Agents)

### 6.1 Flow Diagram

```
ContinueRequest (choice_id hoặc free_input)
    │
    ▼
┌─────────────────────┐
│ 0. INPUT PARSER     │  Nếu free_input → parse thành structured choice
│    (conditional)     │  Nếu choice_id → skip
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ 1. PLANNER          │  Chapter outline (beats, tension, pacing)
│    (Gemini Flash)    │  Input: genre, world, previous_summary, player_state, choice
└─────────┬───────────┘
          │
    ┌─────┴─────┐  (parallel)
    ▼           ▼
┌────────┐ ┌────────┐
│2. SIM  │ │3. CTX  │  Simulator: consequences  |  Context: NeuralMemory query
│(Gemini)│ │(Neural │
│        │ │Memory) │
└───┬────┘ └───┬────┘
    └─────┬────┘
          ▼
┌─────────────────────┐
│ 5. WRITER           │  Prose generation (1000-3000 words, SSE stream)
│    (Gemini Flash)    │  Output: prose + 3 choices + chapter_title
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 6. CRITIC           │  Score 1-10. If < 7 → loop back to Writer (max 3x)
│    (Gemini Flash)    │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 7. IDENTITY UPDATE  │  Calculate deltas: DQS, coherence, instability, etc.
│    (deterministic)   │  Check: confrontation trigger? fate buffer?
└─────────┬───────────┘
          ▼
     Save to DB + Encode to NeuralMemory
```

### 6.2 LangGraph Wiring — `narrative/pipeline.py`

```python
from langgraph.graph import StateGraph, END

def build_pipeline() -> StateGraph:
    graph = StateGraph(NarrativeState)

    # Nodes
    graph.add_node("input_parser", run_input_parser)
    graph.add_node("planner", run_planner)
    graph.add_node("simulator", run_simulator)
    graph.add_node("context", run_context)
    graph.add_node("writer", run_writer)
    graph.add_node("critic", run_critic)
    graph.add_node("identity_update", run_identity_update)

    # Edges
    graph.set_entry_point("input_parser")
    graph.add_edge("input_parser", "planner")

    # Parallel: simulator + context (sử dụng LangGraph fan-out)
    graph.add_edge("planner", "simulator")
    graph.add_edge("planner", "context")
    graph.add_edge("simulator", "writer")
    graph.add_edge("context", "writer")

    graph.add_edge("writer", "critic")

    # Critic conditional: rewrite or continue
    graph.add_conditional_edges(
        "critic",
        should_rewrite,
        {"rewrite": "writer", "accept": "identity_update"},
    )

    graph.add_edge("identity_update", END)

    return graph.compile()

def should_rewrite(state: NarrativeState) -> str:
    critic = state.critic_output
    if critic and not critic.approved and state.rewrite_count < 3:
        return "rewrite"
    return "accept"
```

### 6.3 Agent Specifications

#### Agent 0: Input Parser (`narrative/input_parser.py`)

```python
async def run_input_parser(state: NarrativeState) -> dict:
    """Parse free input into structured choice, or pass through."""
    if state.free_input:
        # Use Gemini to parse free text → structured action
        result = await llm.ainvoke(INPUT_PARSER_PROMPT.format(
            free_input=state.free_input,
            context=state.previous_summary,
        ))
        # Extract: action type, risk level, consequence hint
        return {"chosen_choice": parsed_choice}
    return {}  # No change if using predefined choice
```

#### Agent 1: Planner (`narrative/planner.py`)

- **Input:** genre, world_desc, chosen_choice, previous_summary, player_state (identity, archetype, DQS)
- **Output:** `PlannerOutput` (beats, tension, pacing, new_characters, world_changes)
- **Key:** Planner nhận player identity → adjust story arcs accordingly
- **CRNG Integration:** Planner checks `breakthrough_meter` và `pity_counter` → quyết định có trigger major event không

#### Agent 5: Writer (`narrative/writer.py`)

- **Input:** PlannerOutput, SimulatorOutput, context string, player_state
- **Output:** `WriterOutput` (prose, 3 choices)
- **SSE Streaming:** `async for chunk in llm.astream(...)`
- **Choices format:**
  ```json
  [
      {"text": "Bước vào hang động", "risk_level": 2, "consequence_hint": "..."},
      {"text": "Quay lại cảnh báo đồng đội", "risk_level": 1, "consequence_hint": "..."},
      {"text": "Phá hủy lối vào", "risk_level": 4, "consequence_hint": "..."}
  ]
  ```

#### Agent 7: Identity Update (`narrative/identity_agent.py`)

```python
async def run_identity_update(state: NarrativeState) -> dict:
    """Deterministic identity calculations (no AI call)."""
    player = state.player_state
    choice = state.chosen_choice
    sim = state.simulator_output

    delta = IdentityDelta()

    # 1. DQS: +1 if choice aligns with identity, -2 if contradicts
    delta.dqs_change = calculate_dqs(player, choice, sim)

    # 2. Coherence: drops if behavior contradicts seed
    delta.coherence_change = calculate_coherence(player, choice)

    # 3. Instability: rises when coherence drops
    if delta.coherence_change < -2:
        delta.instability_change = abs(delta.coherence_change) * 0.8

    # 4. Breakthrough meter
    if choice.risk_level >= 4:
        delta.breakthrough_change = 5.0
    elif choice.risk_level >= 3:
        delta.breakthrough_change = 2.0

    # 5. Pity counter
    if has_major_event(state):
        delta.pity_reset = True
    # else pity_counter +1 (handled in DB update)

    # 6. Confrontation check
    new_instability = player.instability + delta.instability_change
    if new_instability > 70 and player.instability <= 70:
        delta.confrontation_triggered = True

    # 7. Fate Buffer decay
    if player.total_chapters > 15:
        delta.fate_buffer_change = -2.5  # decay per chapter after 15

    return {"identity_delta": delta}
```

---

## 7. NeuralMemory Integration

### 7.1 Brain Manager — `memory/story_brain.py`

```python
class StoryBrainManager:
    """1 Brain per player (not per story)."""

    def __init__(self):
        self.storage = SQLiteStorage("./data/brains/")
        self._brains: dict[str, Brain] = {}

    async def get_or_create(self, player_id: str) -> Brain:
        if player_id in self._brains:
            return self._brains[player_id]
        brain = Brain.create(f"player_{player_id}")
        await self.storage.save_brain(brain)
        self._brains[player_id] = brain
        return brain
```

### 7.2 Encoding Strategy — `memory/encoding.py`

```python
async def encode_chapter(encoder: MemoryEncoder, chapter, sim, player):
    """Encode chapter into player's NeuralMemory Brain."""

    # 1. Plot facts
    await encoder.encode(
        f"Chương {chapter.number}: {chapter_summary}",
        memory_type="fact"
    )

    # 2. Relationships (typed synapses)
    for rel in sim.relationship_changes:
        await encoder.encode(
            f"{rel.from_char} {rel.new_relation} {rel.to_char}: {rel.reason}",
            memory_type="fact"
        )

    # 3. Player decisions (for identity tracking)
    await encoder.encode(
        f"Player chọn: {choice_text} (risk {risk}) → {consequence}",
        memory_type="decision"
    )

    # 4. Foreshadowing
    for hint in sim.foreshadowing:
        await encoder.encode(hint, memory_type="context")
```

### 7.3 Context Retrieval — `narrative/context.py`

```python
async def run_context(state: NarrativeState) -> dict:
    """Query NeuralMemory for relevant past events."""
    pipeline = ReflexPipeline(storage, brain.config)

    # Multi-query for comprehensive context
    queries = [
        f"Lịch sử với {char}" for char in characters_in_scene
    ] + [
        f"Hệ quả của {state.chosen_choice.text}",
        f"Tình trạng thế giới hiện tại",
    ]

    contexts = []
    for q in queries:
        result = await pipeline.query(q, depth=2)
        contexts.append(result.context)

    return {"context": "\n---\n".join(contexts)}
```

---

## 8. CRNG Engine — `engine/crng.py`

```python
class CRNGEngine:
    """Controlled RNG — biased randomness tuned by player DNA."""

    @staticmethod
    def should_trigger_rogue_event(player: PlayerState) -> bool:
        """Early game: random chance for relic/mentor/awakening."""
        if player.total_chapters > 30:
            return False
        base_chance = 0.05  # 5% per chapter
        pity_bonus = min(player.pity_counter * 0.02, 0.20)  # +2%/chapter, cap 20%
        return random.random() < (base_chance + pity_bonus)

    @staticmethod
    def generate_skill_affinity(player: PlayerState) -> dict:
        """70% synergistic with DNA, 30% outlier."""
        if random.random() < 0.7:
            pool = player.dna_affinity  # synergistic
        else:
            pool = [t for t in DNAAffinityTag if t not in player.dna_affinity]
        return {"affinity": random.choice(pool)}

    @staticmethod
    def should_trigger_breakthrough(player: PlayerState) -> bool:
        """Check if player hit breakthrough threshold."""
        return player.breakthrough_meter >= 90.0
```

---

## 9. Onboarding Flow — `engine/onboarding.py`

```python
async def create_seed_from_quiz(
    quiz_answers: dict,
    llm: ChatGoogleGenerativeAI,
) -> tuple[SeedIdentity, str, list[DNAAffinityTag]]:
    """
    Quiz (5 questions) → SeedIdentity + Archetype + DNA Tags.
    Uses Gemini to generate narrative origin based on answers.
    """
    # 1. Deterministic: quiz → archetype mapping
    archetype = map_quiz_to_archetype(quiz_answers)

    # 2. Deterministic: quiz → DNA tags (3 tags)
    dna = map_quiz_to_dna(quiz_answers)

    # 3. AI: Generate origin story + personality interpretation
    result = await llm.ainvoke(ONBOARDING_PROMPT.format(
        answers=json.dumps(quiz_answers),
        archetype=archetype,
        dna=dna,
    ))

    seed = SeedIdentity(
        core_values=result.core_values,
        personality_traits=result.personality_traits,
        motivation=result.motivation,
        fear=result.fear,
        origin_story=result.origin_story,
    )

    return seed, archetype, dna
```

---

## 10. SSE Streaming — `routers/stream.py`

```python
from sse_starlette.sse import EventSourceResponse

@router.get("/stream/{story_id}/{chapter_number}")
async def stream_chapter(story_id: str, chapter_number: int):
    async def event_generator():
        # Phase 1: Planning
        yield {"event": "status", "data": '{"phase": "planning"}'}

        # Phase 2: Context retrieval
        yield {"event": "status", "data": '{"phase": "context"}'}

        # Phase 3: Writing (streamed)
        async for chunk in pipeline.astream_writer(state):
            yield {"event": "prose", "data": json.dumps({"text": chunk})}

        # Phase 4: Choices
        yield {"event": "choices", "data": json.dumps({"choices": choices})}

        # Phase 5: Identity update
        yield {"event": "identity", "data": json.dumps(identity_delta)}

        # Done
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(event_generator())
```

---

## 11. Config Updates — `config.py`

```python
class Settings(BaseSettings):
    # ... (giữ nguyên) ...

    # [MỚI] Identity
    identity_model: str = "gemini-2.5-flash"
    onboarding_model: str = "gemini-2.5-flash"

    # [MỚI] CRNG
    pity_base_chance: float = 0.05
    pity_increment: float = 0.02
    pity_max_bonus: float = 0.20
    breakthrough_threshold: float = 90.0

    # [MỚI] Limits
    max_chapters_per_day: int = 5
    max_chapters_per_story: int = 200

    # [MỚI] Fate Buffer
    fate_buffer_start_decay: int = 15    # chapter number
    fate_buffer_decay_rate: float = 2.5  # per chapter
```

---

## 12. Development Sub-phases

### Phase 1a: Foundation (2-3 ngày)
- [ ] `models/player.py` + `models/identity.py`
- [ ] Update `memory/state.py` — thêm players, player_flags, identity_events tables
- [ ] `engine/onboarding.py` — quiz → seed
- [ ] `routers/player.py` — onboarding endpoint
- [ ] Test: onboarding → player created with correct seed/DNA
- [ ] Update `config.py`

### Phase 1b: Pipeline (4-5 ngày)
- [ ] `narrative/input_parser.py`
- [ ] `narrative/planner.py` + `prompts/planner.md`
- [ ] `narrative/simulator.py` + `prompts/simulator.md`
- [ ] `narrative/context.py`
- [ ] `narrative/writer.py` + `prompts/writer.md`
- [ ] `narrative/critic.py` + `prompts/critic.md`
- [ ] `narrative/identity_agent.py`
- [ ] `narrative/pipeline.py` — LangGraph graph
- [ ] `memory/story_brain.py` + `memory/encoding.py`
- [ ] Test: full pipeline generates coherent chapter

### Phase 1c: API + Streaming (2-3 ngày)
- [ ] Wire `routers/story.py` — start + continue
- [ ] Implement `routers/stream.py` — SSE
- [ ] `engine/crng.py`
- [ ] `engine/fate_buffer.py`
- [ ] Integration test: onboard → start → 5 chapters → verify memory

### Phase 1d: Web App Basic (3-4 ngày)
- [ ] Vite + React setup
- [ ] Onboarding page (quiz UI)
- [ ] Story reader (SSE stream + choices + free input)
- [ ] Basic identity card display
- [ ] Dashboard (list stories, player state)

### Phase 1e: Polish + Test (2-3 ngày)
- [ ] Play through 20-30 chapters
- [ ] Prompt tuning (style, tone, Vietnamese quality)
- [ ] Identity system calibration (decay rates, thresholds)
- [ ] CRNG balance testing
- [ ] Bug fixes

**Tổng Phase 1: ~13-18 ngày**

---

## 13. Verification Plan

### Unit Tests
```bash
pytest tests/test_models.py -v        # Player, Identity models
pytest tests/test_state_db.py -v      # Players CRUD
pytest tests/test_crng.py -v          # RNG engine
pytest tests/test_identity.py -v      # Identity calculations
```

### Integration Tests
```bash
pytest tests/test_pipeline.py -v      # Full pipeline (mocked AI)
```

### Manual Playtest
1. Onboard → verify seed identity + DNA matches quiz
2. Start story → verify chapter 1 matches genre + seed
3. Play 5 chapters → verify NeuralMemory recalls past events
4. Make contradictory choices → verify coherence drops, instability rises
5. Play 15+ chapters → verify fate buffer decays
6. Hit breakthrough → verify major event triggers
7. Free input test → verify AI handles custom actions

---

## 14. Dependencies — `pyproject.toml` Update

```toml
dependencies = [
    # Giữ nguyên
    "fastapi>=0.100",
    "uvicorn[standard]>=0.23",
    "langgraph>=0.2.0",
    "langchain-core>=0.3.0",
    "langchain-google-genai>=2.0.0",
    "google-generativeai>=0.8.0",
    "neural-memory[nlp-vi]>=1.7.0",
    "sse-starlette>=1.6.0",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "python-dotenv>=1.0.0",
    "httpx>=0.24",
]
```

Không cần thêm dependency mới. Stack hiện tại đủ cho Phase 1.
