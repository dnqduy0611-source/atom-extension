# WORLD CONSISTENCY — IMPLEMENTATION SPEC
## Phased Build Plan với Complexity Assessment

**Version:** 1.0
**Base reading:** WORLD_CONSISTENCY_SPEC.md (kiến trúc), pipeline.py, context.py, story_brain.py
**Mục tiêu:** World nhất quán xuyên suốt mọi player journey, không cần full simulation.

---

## Đánh Giá Hiện Trạng

```
✅ Đã có:
  world_context.py        — inject static World Canon vào mọi AI call
  WORLD_CONTEXT_PROMPT.md — 238 dòng, 12 section, AI rules đầy đủ
  story_brain.py          — NeuralMemory per-story (store_scene, query_context)
  pipeline.py             — LangGraph pipeline hoàn chỉnh
  context.py              — context builder (NeuralMemory chưa được wire)

❌ Còn thiếu:
  Entity Registry         — canonical NPC/location data
  NeuralMemory wiring     — story_brain.py built nhưng context.py chưa gọi
  Story Ledger            — tracking AI-introduced facts per player
  Canon Guard             — validate generated content vs canon rules
  WorldState model        — world-level state tách khỏi player state
  Contextual entity inject— inject chỉ entities relevant to current scene
```

**Pipeline hiện tại:**
```
input_parser → planner → simulator → context → writer → critic (loop) → identity → weapon_update → output
```

**Pipeline sau khi implement:**
```
input_parser → planner → simulator → context* → writer* → critic* → identity → weapon_update → output → [ledger_extract]
                                          ↑             ↑
                              [entity_registry]  [story_ledger]
                              [neural_memory]    [canon_guard]
```

---

## Complexity Scale

```
⭐        — Trivial (< 2h, 1 file, no new patterns)
⭐⭐       — Low (2-4h, 2-3 files, straightforward)
⭐⭐⭐      — Medium (4-8h, 4-6 files, some design decisions)
⭐⭐⭐⭐     — High (1-2 days, architectural changes, test coverage needed)
⭐⭐⭐⭐⭐    — Complex (3+ days, cross-system impact, careful rollout)
```

---

---

# PHASE 1 — FOUNDATION
## Mục tiêu: Vá lỗ hổng consistency lớn nhất với effort thấp nhất

**Thời gian ước tính:** 3-5 ngày
**Rủi ro:** Thấp — không thay đổi pipeline flow, chỉ thêm context

---

## Task 1.1 — Wire NeuralMemory vào context.py

**Complexity: ⭐⭐**
**Effort:** 2-3 giờ
**Impact:** HIGH — story_brain.py đã built xong, chỉ cần kết nối

### Vấn đề hiện tại

`context.py` line 30:
```python
# NOTE: Full NeuralMemory query will be wired in story_brain.py
# For now, this is the fallback path.
```

`story_brain.py` có đầy đủ `query_context()` và `store_scene()` nhưng không được gọi từ pipeline.

### Files cần thay đổi

**`app/narrative/context.py`** — thêm NeuralMemory query:
```python
async def run_context(state: NarrativeState, db: object = None) -> dict:
    contexts: list[str] = []

    # ── Try NeuralMemory ── (WIRE THIS)
    story_id = getattr(state, "story_id", None)
    if story_id:
        from app.memory.story_brain import get_or_create_brain
        brain = await get_or_create_brain(story_id)
        if brain.available:
            # Query with current chapter context
            query = _build_memory_query(state)
            memory_context = await brain.query_context(query, max_tokens=800)
            if memory_context:
                contexts.append(memory_context)

    # ... rest of existing context building ...
```

**`app/narrative/pipeline.py`** — thêm `_node_ledger` sau output:
```python
async def _node_ledger(state: dict) -> dict:
    """Store chapter into NeuralMemory after generation."""
    from app.memory.story_brain import get_or_create_brain
    story_id = state.get("story_id")
    if not story_id:
        return {}
    brain = await get_or_create_brain(story_id)
    if brain.available:
        prose = state.get("final_prose", "")
        chapter = state.get("chapter_number", 0)
        choice = state.get("chosen_choice")
        choice_text = ""
        if isinstance(choice, dict):
            choice_text = choice.get("text", "")
        await brain.store_scene(
            scene_number=1,
            chapter_number=chapter,
            prose=prose,
            choice_text=choice_text,
        )
    return {}
```

Thêm vào graph sau `output`:
```python
graph.add_node("ledger", _node_ledger)
graph.add_edge("output", "ledger")
graph.add_edge("ledger", END)
```

### Kết quả

- Chapter N+1 có thể query ký ức từ Chapter N-10
- NPC đã gặp, decisions đã đưa ra → NeuralMemory recall
- Không cần thêm schema hay migration nào

---

## Task 1.2 — Entity Registry — Data File + Loader

**Complexity: ⭐⭐⭐**
**Effort:** 4-6 giờ
**Impact:** HIGH — ngăn NPC/location inconsistency xuyên session

### Kiến trúc

```
Amoisekai/data/
  entity_registry.yaml         ← nguồn sự thật canonical
app/world/
  entity_registry.py           ← loader + query API
```

### Schema `entity_registry.yaml`

```yaml
# Entity Registry Phase 1
# Mọi NPC/location canonical phải có entry ở đây
# AI không được invent core attributes khác với entry này

npcs:
  - id: "merchant_sel"
    name: "Sel"
    aliases: []
    location_ids: ["grand_gate_city"]
    role: "Information broker ẩn sau vỏ bọc thương nhân"
    principle_alignment:
      primary: "Freedom"
      hidden: "Control"
    personality_core: |
      Ấm áp bên ngoài, tính toán bên trong.
      Không bao giờ nói dối — nhưng không bao giờ nói toàn bộ sự thật.
      Luôn yêu cầu đổi chác. Không làm từ thiện.
    faction: "council_of_pillars"
    faction_visible: false     # player không biết affiliation này
    current_status: "active"
    archetype_affinity:
      - seeker                 # chủ động tìm đến player loại này
      - sovereign
    notes_for_ai: |
      Sel KHÔNG bao giờ cung cấp thông tin miễn phí.
      Nếu player Seeker/Sovereign → Sel tìm player trước, không phải ngược lại.
      Giọng nói: nhẹ nhàng, hài hước, không bao giờ trực tiếp.
    secrets:
      - "Thành viên Council of Pillars"
      - "Biết về Great Awakening từ 10 năm trước"
      - "Có connection với ít nhất 1 Emissary"

  - id: "elder_veth"
    name: "Veth"
    aliases: ["Elder Veth", "Người Già Của Hội Đồng"]
    location_ids: ["grand_gate_city_inner_ring"]
    role: "Council of Pillars — open member (visible tier)"
    principle_alignment:
      primary: "Order"
      secondary: "Devotion"
    personality_core: |
      Chậm rãi, cân nhắc mọi lời trước khi nói.
      Tin vào trật tự nhưng không phải Empire.
      Có vết thương cũ chưa lành liên quan đến Great Awakening lần 1.
    faction: "council_of_pillars"
    faction_visible: true
    current_status: "active"
    archetype_affinity:
      - sovereign
      - tactician
    notes_for_ai: |
      Veth nói bằng câu hỏi hơn là tuyên bố.
      Không tin tưởng người lạ trong vòng 3 lần gặp đầu.
      Archetype Wanderer → Veth thất vọng và cố giữ lại.

locations:
  - id: "grand_gate_city"
    name: "Grand Gate City"
    aliases: ["Ngưỡng Vàng", "City of the Golden Threshold", "Thành Vàng"]
    description_anchor: |
      Thành phố vòng tròn bao quanh Grand Gate. Đá trắng và vàng.
      3 vành đai: Outer Ring (dân thường), Middle Ring (faction HQ), Inner Ring (Council).
      Grand Gate ở trung tâm — ánh sáng vàng nhạt tỏa ra liên tục, kể cả ban đêm.
      Không bao giờ hoàn toàn tối.
    principle: ["Order", "Devotion"]
    threat_tier: 0
    starting_zone_for: ["sovereign"]
    notable_npc_ids: ["merchant_sel", "elder_veth"]
    forbidden_descriptions:
      - "cảng biển hoặc bất cứ thứ gì liên quan đến biển"
      - "tường thành quân sự — Order thể hiện qua social structure"
      - "vùng nghèo hay slum — Outer Ring vẫn được chăm sóc tốt"

  - id: "outer_corruption_zone"
    name: "Outer Corruption Zone"
    aliases: ["Rìa Bóng Tối", "Vùng Dị Biến", "The Fringe"]
    description_anchor: |
      Vùng tiếp xúc với ảnh hưởng Empire — thịt biến dạng, thực tại tan rã.
      Không có ranh giới rõ ràng — corruption lan dần từ Cổng Máu (Minor Gate #2).
      Dân thường đã chạy khỏi đây. Ai còn ở lại đều có lý do riêng.
      Ánh sáng mờ và có màu tím nhạt bất thường.
    principle: ["Control"]
    threat_tier: 2
    starting_zone_for: ["vanguard"]
    notable_npc_ids: []
    forbidden_descriptions:
      - "đẹp hoặc yên bình theo bất kỳ nghĩa nào"
      - "người dân bình thường sinh sống"

  - id: "tower_floor_1"
    name: "Tower — Floor 1"
    aliases: ["Tầng 1 Tháp", "Tầng Khai Mở"]
    description_anchor: |
      Tầng đầu của Tower. Môi trường thay đổi theo Principle của người vào.
      Không có layout cố định — Tower phản chiếu người đang đi.
      Ánh sáng trung tính — không tối hoàn toàn, không sáng hoàn toàn.
      Không có NPC cố định — chỉ có Echoes và dấu vết.
    principle: ["Evolution"]     # Tower nói chung liên quan đến Evolution
    threat_tier: 1               # Thấp nhưng không zero
    instability_modifier: 1.2
    starting_zone_for: []
    forbidden_descriptions:
      - "floor layout cố định — Tower luôn khác nhau với mỗi người"
      - "NPC permanent tại Tower (Echoes không phải NPC)"

emissaries:
  - id: "kaen"
    name: "Kaen"
    title: "Emissary of Understanding"
    principle_alignment: "Evolution (warped)"
    personality_core: |
      Học giả bị corruption, tin rằng identity phải bị phá vỡ để tiến hóa thật sự.
      Không thù địch theo nghĩa thông thường — tò mò, thậm chí tôn trọng.
      Approach: đặt câu hỏi triết học để gây instability, không dùng bạo lực trước.
    archetype_assigned: ["seeker", "tactician"]
    visual_anchor: "áo dài đen, không mang vũ khí nhìn thấy được, luôn có sách"
    current_status: "active"
    forbidden:
      - "bạo lực trực tiếp trừ khi bị ép hoặc Act 3+"
      - "tiết lộ kế hoạch Empire cụ thể"

  - id: "sira"
    name: "Sira"
    title: "Emissary of Order"
    principle_alignment: "Order (absolute)"
    personality_core: |
      Tin rằng freedom gây hỗn loạn và khổ đau. Muốn "giải cứu" player khỏi chaos của identity.
      Không ác — genuinely believes Empire is right.
      Approach: cung cấp power, resources, protection — price là loyalty.
    archetype_assigned: ["catalyst", "sovereign"]
    visual_anchor: "áo giáp bạc, di chuyển geometric, không có biểu cảm rõ ràng"
    current_status: "active"
    forbidden:
      - "thô bạo hoặc mất kiên nhẫn với player"
      - "admit Empire có điểm sai"

  - id: "thol"
    name: "Thol"
    title: "Emissary of Strength"
    principle_alignment: "Control + Devotion (twisted)"
    personality_core: |
      Tin rằng sức mạnh mới là sự thật duy nhất. Tôn trọng người mạnh.
      Approach: combat test trực tiếp, challenge, prove yourself — hoặc kneel.
      Không hiểu subtlety — nhưng đây chính là weakness của Thol.
    archetype_assigned: ["vanguard", "wanderer"]
    visual_anchor: "to lớn, scar khắp người, không bao giờ ngồi"
    current_status: "active"
    forbidden:
      - "dialogue phức tạp về triết học — Thol nói ngắn"
      - "mercy cho kẻ yếu mà không có lý do rõ ràng"

generals:
  - id: "vorn"
    name: "Vorn"
    title: "General of the Blade"
    principle_alignment: "Control (pure)"
    personality_core: |
      Sức mạnh là phương tiện, không phải mục đích. Discipline tuyệt đối.
      Không ghét player — xem họ là thú vị nếu đủ mạnh.
      Shadow: giọng nói xuất hiện trong Vorn-zone như tiếng vọng của sự kiên định.
    archetype_shadow: ["vanguard", "catalyst"]
    phase1_role: "shadow_voice_only"   # không encounter trực tiếp Phase 1
    forbidden:
      - "xuất hiện vật lý trực tiếp Phase 1"
      - "nói nhiều hơn 2-3 câu khi shadow"
```

### `app/world/entity_registry.py`

```python
"""Entity Registry — canonical world entities loader and query interface."""

from __future__ import annotations
from pathlib import Path
from functools import lru_cache
import yaml
import logging

logger = logging.getLogger(__name__)

_REGISTRY_PATHS = [
    Path(__file__).parent.parent.parent.parent / "Amoisekai" / "data" / "entity_registry.yaml",
    Path(__file__).parent.parent / "data" / "entity_registry.yaml",
]

@lru_cache(maxsize=1)
def _load_registry() -> dict:
    for path in _REGISTRY_PATHS:
        if path.exists():
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
            logger.info(f"Entity registry loaded from {path}")
            return data
    logger.warning("Entity registry not found — world consistency degraded")
    return {}

def get_entities_for_location(location_id: str) -> list[dict]:
    """Return NPC entities relevant to a given location."""
    registry = _load_registry()
    npcs = registry.get("npcs", [])
    return [n for n in npcs if location_id in n.get("location_ids", [])]

def get_entity_by_id(entity_id: str) -> dict | None:
    registry = _load_registry()
    for category in ["npcs", "emissaries", "generals", "locations"]:
        for entity in registry.get(category, []):
            if entity.get("id") == entity_id:
                return entity
    return None

def get_location(location_id: str) -> dict | None:
    registry = _load_registry()
    for loc in registry.get("locations", []):
        if loc.get("id") == location_id:
            return loc
    return None

def format_for_prompt(entities: list[dict], locations: list[dict]) -> str:
    """Format entity + location data as prompt-injectable text block."""
    lines = ["## CANONICAL ENTITIES (không được contradict):"]

    for loc in locations:
        lines.append(f"\n### Location: {loc['name']}")
        lines.append(loc["description_anchor"].strip())
        if loc.get("forbidden_descriptions"):
            forbidden = "; ".join(loc["forbidden_descriptions"])
            lines.append(f"KHÔNG mô tả: {forbidden}")

    for entity in entities:
        lines.append(f"\n### NPC: {entity['name']}")
        lines.append(f"Vai trò: {entity['role']}")
        lines.append(f"Tính cách: {entity['personality_core'].strip()}")
        if entity.get("notes_for_ai"):
            lines.append(f"Hướng dẫn AI: {entity['notes_for_ai'].strip()}")

    return "\n".join(lines)
```

### Integration vào writer.py

```python
# Trong run_writer() — trước khi build prompt
from app.world.entity_registry import get_entities_for_location, get_location, format_for_prompt

current_location = getattr(state, "current_location", "")
relevant_npcs = get_entities_for_location(current_location) if current_location else []
location_data = [get_location(current_location)] if current_location else []
entity_block = format_for_prompt(relevant_npcs, [l for l in location_data if l])
# Inject entity_block vào system prompt writer
```

---

## Task 1.3 — Canon Guard

**Complexity: ⭐⭐**
**Effort:** 2-3 giờ
**Impact:** MEDIUM — catch những vi phạm canon nghiêm trọng nhất

### `app/world/canon_guard.py`

```python
"""Canon Guard — pattern-based detection of canon violations in generated prose."""

from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)

# (pattern, violation_message, severity)
CANON_RULES: list[tuple[str, str, str]] = [
    # Archon rules
    (
        r"Archon\s+(xuất hiện|nói chuyện với|gặp|trực tiếp)",
        "Archon không bao giờ xuất hiện trực tiếp — chỉ biểu hiện qua hiện tượng",
        "critical"
    ),
    # Veiled Will reveal
    (
        r"Veiled Will\s+(là|chính là|tên thật|thực chất)",
        "Không reveal Veiled Will identity trong Season 1",
        "critical"
    ),
    # Game terminology
    (
        r"\b(HP|MP|XP|EXP|level up|experience point|hit point)\b",
        "Không dùng game terminology — dùng lore terms",
        "medium"
    ),
    # General physical appearance Phase 1
    (
        r"(Vorn|Kha|Mireth|Azen)\s+(xuất hiện|đứng trước|tấn công|bước vào)",
        "General không xuất hiện vật lý Phase 1 — chỉ shadow/voice",
        "high"
    ),
    # All-good choices
    # (hard to detect with regex — handled by critic prompt instead)
]

class CanonViolation:
    def __init__(self, rule: str, message: str, severity: str, match_text: str):
        self.rule = rule
        self.message = message
        self.severity = severity
        self.match_text = match_text

def check_canon(prose: str) -> list[CanonViolation]:
    """Check prose for canon violations. Returns list of violations (empty = clean)."""
    violations = []
    for pattern, message, severity in CANON_RULES:
        matches = re.finditer(pattern, prose, re.IGNORECASE)
        for match in matches:
            violations.append(CanonViolation(
                rule=pattern,
                message=message,
                severity=severity,
                match_text=match.group(0)
            ))
    if violations:
        logger.warning(f"Canon Guard: {len(violations)} violations detected")
    return violations

def format_violations_for_rewrite(violations: list[CanonViolation]) -> str:
    """Format violations as instruction for rewrite prompt."""
    lines = ["CANON VIOLATIONS — phải sửa trong bản rewrite:"]
    for v in violations:
        lines.append(f"- [{v.severity.upper()}] {v.message}")
        lines.append(f"  (triggered by: \"{v.match_text}\")")
    return "\n".join(lines)
```

### Integration vào critic.py

```python
from app.world.canon_guard import check_canon, format_violations_for_rewrite

# Trong run_critic():
prose = getattr(state, "final_prose", "") or state.writer_output.prose
violations = check_canon(prose)
if any(v.severity == "critical" for v in violations):
    # Force rewrite regardless of critic score
    violation_note = format_violations_for_rewrite(violations)
    return {"critic_output": {"approved": False, "score": 0, "notes": violation_note}}
```

---

## Phase 1 — Deliverables Summary

| Task | Files tạo mới | Files sửa | Effort | Impact |
|------|--------------|-----------|--------|--------|
| 1.1 NeuralMemory wire | — | context.py, pipeline.py | 2-3h | ⬆️ HIGH |
| 1.2 Entity Registry | entity_registry.yaml, app/world/entity_registry.py | writer.py | 4-6h | ⬆️ HIGH |
| 1.3 Canon Guard | app/world/canon_guard.py | critic.py | 2-3h | ➡️ MED |

**Tổng Phase 1:** 8-12 giờ, không cần migration DB, không break existing flow.

---

---

# PHASE 2 — STORY LEDGER
## Mục tiêu: Per-player accumulated story facts — AI nhất quán trong 1 hành trình

**Thời gian ước tính:** 4-6 ngày
**Dependency:** Phase 1 hoàn thành
**Rủi ro:** Medium — cần DB schema mới, thêm pipeline step

---

## Task 2.1 — StoryLedger Model + DB Schema

**Complexity: ⭐⭐⭐**
**Effort:** 3-4 giờ

### `app/models/story_ledger.py`

```python
"""Story Ledger — per-player accumulated facts introduced by AI narrative."""

from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field
from datetime import datetime


class IntroducedEntity(BaseModel):
    """An entity introduced by AI that doesn't exist in canonical Entity Registry."""
    entity_id: str                  # slugified name: "korath_landing"
    entity_type: Literal["npc", "location", "object", "group", "event"]
    name: str                       # canonical name as first introduced
    first_appeared_chapter: int
    description_anchor: str         # 1-2 sentence fixed description
    current_status: str = "active"  # active / destroyed / unknown / left
    relationships: dict[str, str] = Field(default_factory=dict)
    # {"player": "ally", "merchant_sel": "rival"}


class EstablishedFact(BaseModel):
    """A world fact established during this player's story."""
    fact_id: str
    statement: str
    # e.g. "Korath's Landing was burned by Empire 20 years ago"
    chapter_established: int
    source: Literal["ai_generated", "player_action", "world_event"]
    entity_ids_involved: list[str] = Field(default_factory=list)
    # Reference to entity_ids this fact concerns
    superseded: bool = False        # True if a later fact contradicts this


class StoryLedger(BaseModel):
    """Complete per-player story ledger."""
    story_id: str
    player_id: str
    last_updated_chapter: int = 0
    introduced_entities: list[IntroducedEntity] = Field(default_factory=list)
    established_facts: list[EstablishedFact] = Field(default_factory=list)

    def to_prompt_string(self, max_chars: int = 1500) -> str:
        """Format ledger as injection-ready prompt block."""
        if not self.introduced_entities and not self.established_facts:
            return ""

        lines = ["## STORY LEDGER (facts established in YOUR story — không được contradict):"]

        # Entities first
        for entity in self.introduced_entities:
            if entity.current_status != "active":
                status_note = f" [{entity.current_status.upper()}]"
            else:
                status_note = ""
            lines.append(
                f"- {entity.name}{status_note}: {entity.description_anchor}"
                f" (ch.{entity.first_appeared_chapter})"
            )

        # Key facts
        for fact in self.established_facts:
            if not fact.superseded:
                lines.append(f"- FACT: {fact.statement} (ch.{fact.chapter_established})")

        result = "\n".join(lines)

        # Truncate if too long (keep most recent)
        if len(result) > max_chars:
            # Keep first line + last N facts/entities to fit
            # Simple approach: truncate from old facts, keep recent
            result = result[:max_chars] + "\n[...lịch sử cũ hơn đã được nén]"

        return result

    def add_entity(self, entity: IntroducedEntity) -> None:
        """Add entity if not already present."""
        existing_ids = {e.entity_id for e in self.introduced_entities}
        if entity.entity_id not in existing_ids:
            self.introduced_entities.append(entity)

    def add_fact(self, fact: EstablishedFact) -> None:
        self.established_facts.append(fact)
```

### DB Schema (SQLite — thêm vào migration)

```sql
-- Migration: add story_ledger table
CREATE TABLE IF NOT EXISTS story_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    TEXT NOT NULL,
    player_id   TEXT NOT NULL,
    ledger_json TEXT NOT NULL,           -- full StoryLedger JSON
    chapter     INTEGER NOT NULL DEFAULT 0,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(story_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_story ON story_ledger(story_id);
```

---

## Task 2.2 — Ledger Extraction Pipeline Step

**Complexity: ⭐⭐⭐⭐**
**Effort:** 6-8 giờ
**Notes:** Cần design extraction prompt carefully — false positives costly

### `app/world/ledger_extractor.py`

```python
"""Extract new story facts from generated prose for Story Ledger."""

from __future__ import annotations
import json
import logging
from app.models.story_ledger import IntroducedEntity, EstablishedFact, StoryLedger

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """
Bạn là hệ thống trích xuất dữ kiện tự động.

Đọc đoạn văn chương {chapter_number} và trích xuất:

1. ENTITIES MỚI: NPC, địa điểm, vật phẩm ĐƯỢC ĐẶT TÊN trong chapter này
   mà CHƯA có trong STORY LEDGER hiện tại.

   CHÚ Ý: Chỉ extract entity có TÊN RIÊNG (proper noun).
   KHÔNG extract: "một người lính", "căn nhà", "kẻ địch" (generic)
   CÓ extract: "Gara the Blind", "Korath's Landing", "Kiếm Gãy của Thol"

2. FACTS MỚI: Sự thật về thế giới được establish trong chapter này.
   Chỉ những gì có thể contradiction nếu AI quên.
   Ví dụ: "Korath's Landing bị đốt 20 năm trước" — nếu AI quên, có thể mô tả làng còn nguyên.
   KHÔNG extract: cảm xúc nhân vật, dialogue cụ thể (trừ lời thề/giao kèo quan trọng)

STORY LEDGER HIỆN TẠI:
{current_ledger}

WORLD CANON (entity ở đây là canonical, không cần extract):
{canonical_entities}

CHAPTER TEXT:
{chapter_text}

Output JSON (chỉ JSON, không giải thích):
{{
  "new_entities": [
    {{
      "entity_id": "slug_id",
      "entity_type": "npc|location|object|group|event",
      "name": "Tên Chính Xác",
      "description_anchor": "1-2 câu mô tả cố định",
      "current_status": "active"
    }}
  ],
  "new_facts": [
    {{
      "fact_id": "slug_id",
      "statement": "Phát biểu sự thật ngắn gọn",
      "entity_ids_involved": ["entity_id_1"]
    }}
  ]
}}
"""

async def extract_from_chapter(
    prose: str,
    chapter_number: int,
    current_ledger: StoryLedger,
    llm,
) -> tuple[list[IntroducedEntity], list[EstablishedFact]]:
    """Extract new entities and facts from a generated chapter.

    Uses a lightweight LLM call (low temperature, structured output).
    Returns empty lists on failure — extraction is best-effort.
    """
    try:
        from app.world.entity_registry import get_entities_for_location
        canonical_summary = "[Entity Registry: Sel, Veth, Grand Gate City, Tower Floor 1-3, ...]"

        prompt = EXTRACTION_PROMPT.format(
            chapter_number=chapter_number,
            current_ledger=current_ledger.to_prompt_string(max_chars=800),
            canonical_entities=canonical_summary,
            chapter_text=prose[:3000],  # Cap to avoid token explosion
        )

        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)

        # Parse JSON
        data = json.loads(content)

        entities = [
            IntroducedEntity(
                entity_id=e["entity_id"],
                entity_type=e["entity_type"],
                name=e["name"],
                first_appeared_chapter=chapter_number,
                description_anchor=e["description_anchor"],
                current_status=e.get("current_status", "active"),
            )
            for e in data.get("new_entities", [])
        ]

        facts = [
            EstablishedFact(
                fact_id=f["fact_id"],
                statement=f["statement"],
                chapter_established=chapter_number,
                source="ai_generated",
                entity_ids_involved=f.get("entity_ids_involved", []),
            )
            for f in data.get("new_facts", [])
        ]

        logger.info(
            f"Ledger extraction ch.{chapter_number}: "
            f"{len(entities)} entities, {len(facts)} facts"
        )
        return entities, facts

    except Exception as e:
        logger.warning(f"Ledger extraction failed: {e} — continuing without update")
        return [], []
```

### Pipeline Integration

Thêm vào `_node_ledger` trong pipeline.py (extend Task 1.1):

```python
async def _node_ledger(state: dict) -> dict:
    """Store chapter into NeuralMemory AND update Story Ledger."""
    from app.memory.story_brain import get_or_create_brain
    from app.world.ledger_extractor import extract_from_chapter
    from app.db.ledger_repo import load_ledger, save_ledger  # new repo

    story_id = state.get("story_id")
    if not story_id:
        return {}

    prose = state.get("final_prose", "")
    chapter = state.get("chapter_number", 0)

    # 1. NeuralMemory store (Task 1.1)
    brain = await get_or_create_brain(story_id)
    if brain.available:
        await brain.store_scene(1, chapter, prose)

    # 2. Story Ledger update (Task 2.2)
    ledger = await load_ledger(story_id)
    llm_extract = _make_llm(settings.planner_model, 0.1)  # very low temp for extraction
    new_entities, new_facts = await extract_from_chapter(prose, chapter, ledger, llm_extract)

    for entity in new_entities:
        ledger.add_entity(entity)
    for fact in new_facts:
        ledger.add_fact(fact)
    ledger.last_updated_chapter = chapter

    await save_ledger(ledger)
    logger.info(f"Story Ledger updated: ch.{chapter}, total entities={len(ledger.introduced_entities)}")

    return {}
```

---

## Task 2.3 — Ledger Injection vào Writer

**Complexity: ⭐⭐**
**Effort:** 1-2 giờ

Thêm `story_ledger` vào `PipelineState`:
```python
class PipelineState(TypedDict, total=False):
    # ... existing ...
    story_ledger: Any   # StoryLedger object
```

Thêm ledger load vào context node:
```python
# context.py — thêm sau NeuralMemory query
ledger = await load_ledger(story_id)
if ledger:
    ledger_block = ledger.to_prompt_string(max_chars=1000)
    if ledger_block:
        contexts.append(ledger_block)
```

---

## Phase 2 — Deliverables Summary

| Task | Files tạo mới | Files sửa | Effort | Impact |
|------|--------------|-----------|--------|--------|
| 2.1 StoryLedger model | app/models/story_ledger.py, migration | — | 3-4h | ⬆️ HIGH |
| 2.2 Ledger Extraction | app/world/ledger_extractor.py, app/db/ledger_repo.py | pipeline.py | 6-8h | ⬆️ HIGH |
| 2.3 Ledger Injection | — | context.py, pipeline.py | 1-2h | ⬆️ HIGH |

**Tổng Phase 2:** 10-14 giờ. Cần 1 DB migration.
**Rủi ro chính:** Extraction LLM có thể false positive — cần monitor và tune prompt.

---

---

# PHASE 3 — WORLD STATE FORMALIZATION
## Mục tiêu: Tách world-level state khỏi player state

**Thời gian ước tính:** 3-4 ngày
**Dependency:** Phase 1 + Phase 2
**Rủi ro:** Medium — refactor player_state schema

---

## Task 3.1 — WorldState Model

**Complexity: ⭐⭐⭐**
**Effort:** 4-5 giờ

### `app/models/world_state.py`

```python
"""World State — world-level events shared conceptually, per-player Phase 1."""

from __future__ import annotations
from typing import Literal, Any
from pydantic import BaseModel, Field


class EmissaryStatus(BaseModel):
    status: Literal["active", "revealed", "eliminated", "converted"] = "active"
    revealed_to_player: bool = False
    chapter_revealed: int | None = None
    chapter_resolved: int | None = None


class GeneralStatus(BaseModel):
    status: Literal["shadow", "manifested", "confronted", "defeated"] = "shadow"
    chapter_manifested: int | None = None
    nce_triggered: bool = False


class TowerState(BaseModel):
    highest_floor_reached: int = 0
    floors_cleared: list[int] = Field(default_factory=list)
    active_anomalies: list[str] = Field(default_factory=list)
    instability_history: list[int] = Field(default_factory=list)


class WorldState(BaseModel):
    """World-level state. Phase 1: per-player. Phase 2+: shared."""

    season: int = 1

    # Villain tracking
    emissary_status: dict[str, EmissaryStatus] = Field(default_factory=lambda: {
        "kaen": EmissaryStatus(),
        "sira": EmissaryStatus(),
        "thol": EmissaryStatus(),
    })
    general_status: dict[str, GeneralStatus] = Field(default_factory=lambda: {
        "vorn": GeneralStatus(),
        "kha": GeneralStatus(),
        "mireth": GeneralStatus(),
        "azen": GeneralStatus(),
    })

    # Tower
    tower: TowerState = Field(default_factory=TowerState)

    # World events (boolean flags)
    world_flags: dict[str, bool] = Field(default_factory=dict)
    # Keys:
    #   "great_awakening_public"      — dân chúng biết chuyển sinh xảy ra hàng loạt
    #   "minor_gate2_corruption_spread" — Cổng Máu lan rộng đáng kể
    #   "council_pillars_revealed"    — Council biết player tồn tại
    #   "veiled_will_signal_detected" — Anomaly đầu tiên xảy ra

    # Threat environment (từ FORCE_TAXONOMY_SPEC)
    active_empire_tiers: list[int] = Field(default_factory=list)
    watcher_active: bool = False
    enforcement_intensity: int = 0
    lieutenant_unit_deployed: bool = False
    tower_instability: int = 0
    identity_echo_present: bool = False
    world_anomaly_active: bool = False

    def get_threat_pressure(self) -> str:
        """Compute narrative threat tone."""
        if self.world_anomaly_active:
            return "anomalous"
        if self.lieutenant_unit_deployed or self.enforcement_intensity >= 70:
            return "siege"
        if self.enforcement_intensity >= 40 or self.tower_instability >= 60:
            return "contested"
        if self.watcher_active or self.tower_instability >= 30:
            return "observed"
        return "calm"

    def to_prompt_string(self) -> str:
        """Format world state as prompt injection block."""
        emissary_lines = []
        for name, status in self.emissary_status.items():
            if status.revealed_to_player:
                emissary_lines.append(f"  - {name}: {status.status} (đã lộ diện)")

        tower_line = f"Tầng cao nhất đã đến: {self.tower.highest_floor_reached}"

        flags_active = [k for k, v in self.world_flags.items() if v]

        return f"""## WORLD STATE:
- Emissary đã biết: {', '.join(emissary_lines) if emissary_lines else 'Chưa có'}
- Tower: {tower_line}
- Threat pressure: {self.get_threat_pressure()}
- Empire tier active: {self.active_empire_tiers}
- World events: {', '.join(flags_active) if flags_active else 'Chưa có'}"""
```

### Integration

- Thêm `world_state: WorldState` vào `PipelineState`
- Load từ DB cùng với player state
- Inject vào `context.py` sau Story Ledger
- Update sau `identity_update` node và `weapon_update` node
- `simulator_output.world_state_updates` → parse và apply vào `WorldState`

---

## Task 3.2 — WorldState DB + CRUD

**Complexity: ⭐⭐⭐**
**Effort:** 3-4 giờ

```sql
-- Migration: world_state table
CREATE TABLE IF NOT EXISTS world_state (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    TEXT NOT NULL UNIQUE,
    player_id   TEXT NOT NULL,
    state_json  TEXT NOT NULL,
    chapter     INTEGER NOT NULL DEFAULT 0,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

`app/db/world_state_repo.py` — async CRUD (load/save, update_flag, update_emissary_status, etc.)

---

## Phase 3 — Deliverables Summary

| Task | Files tạo mới | Files sửa | Effort | Impact |
|------|--------------|-----------|--------|--------|
| 3.1 WorldState model | app/models/world_state.py | pipeline.py, context.py | 4-5h | ⬆️ HIGH |
| 3.2 WorldState DB | app/db/world_state_repo.py, migration | pipeline.py | 3-4h | ➡️ MED |

**Tổng Phase 3:** 7-9 giờ. 1 DB migration thêm.

---

---

# PHASE 4 — CROSS-PLAYER CONSISTENCY (MMO Layer)
## Mục tiêu: Shared world state, Soul Scar, Identity Echo từ real players

**Thời gian ước tính:** 2-3 tuần
**Dependency:** Phase 1 + 2 + 3, PostgreSQL migration
**Rủi ro:** HIGH — breaking change DB, cần careful rollout

---

## Task 4.1 — SQLite → PostgreSQL Migration

**Complexity: ⭐⭐⭐⭐⭐**
**Effort:** 3-5 ngày

- Migrate toàn bộ schema sang PostgreSQL
- `world_state` table → shared (không per-player)
- Player-specific tables giữ nguyên per-player
- Connection pooling (asyncpg hoặc SQLAlchemy async)

---

## Task 4.2 — Shared Emissary/General Status

**Complexity: ⭐⭐⭐⭐**
**Effort:** 2-3 ngày

Player A eliminate Emissary Kaen → `emissary_status["kaen"] = "eliminated"` trong shared DB.
Player B request context → AI nhận Kaen status = "eliminated", generate narrative phù hợp dù B chưa gặp Kaen.

Rule: Player không biết ai đã làm — chỉ biết "Kaen đột nhiên biến mất" (unless direct evidence).

---

## Task 4.3 — Soul Scar System → Identity Echo

**Complexity: ⭐⭐⭐⭐**
**Effort:** 2-3 ngày

```sql
CREATE TABLE soul_scars (
    id              INTEGER PRIMARY KEY,
    player_id       TEXT NOT NULL,
    location_id     TEXT NOT NULL,
    chapter         INTEGER,
    seed_signature  JSONB,           -- identity vector snapshot
    echo_fragment   TEXT,            -- 1-2 sentence emotional imprint
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Player B đi qua location → query `soul_scars WHERE location_id = ?` → inject vào context nếu có echo phù hợp.

---

## Phase 4 — Deliverables Summary

| Task | Effort | Complexity | Risk |
|------|--------|-----------|------|
| 4.1 PostgreSQL migration | 3-5 ngày | ⭐⭐⭐⭐⭐ | Breaking change |
| 4.2 Shared world state | 2-3 ngày | ⭐⭐⭐⭐ | Race conditions |
| 4.3 Soul Scar system | 2-3 ngày | ⭐⭐⭐⭐ | Privacy concerns |

**Tổng Phase 4:** 7-11 ngày. Không làm Phase 4 cho đến khi Phase 1 single-player stable.

---

---

# TỔNG QUAN VÀ ĐỀ XUẤT THỨ TỰ

```
┌──────────────────────────────────────────────────────────────────┐
│  PHASE 1 — Foundation (8-12h, NO migration needed)               │
│  ✓ Wire NeuralMemory (3h)   ← highest ROI, code exists           │
│  ✓ Entity Registry (6h)     ← prevents NPC inconsistency         │
│  ✓ Canon Guard (3h)         ← catches critical violations        │
├──────────────────────────────────────────────────────────────────┤
│  PHASE 2 — Story Ledger (10-14h, 1 DB migration)                 │
│  ✓ StoryLedger model (4h)                                        │
│  ✓ Extraction pipeline (8h) ← most complex in Phase 2            │
│  ✓ Injection into context (2h)                                   │
├──────────────────────────────────────────────────────────────────┤
│  PHASE 3 — World State (7-9h, 1 DB migration)                    │
│  ✓ WorldState model (5h)                                         │
│  ✓ WorldState DB CRUD (4h)                                       │
├──────────────────────────────────────────────────────────────────┤
│  PHASE 4 — Cross-player (7-11 ngày, breaking DB change)          │
│  Only after single-player Phase 1 game ships and validates       │
└──────────────────────────────────────────────────────────────────┘

TOTAL Phase 1-3: ~25-35 giờ development
TOTAL Phase 4:   ~7-11 ngày (separate milestone)
```

## Complexity Recap

| Feature | Complexity | Công việc chính |
|---------|-----------|----------------|
| NeuralMemory wire | ⭐⭐ | 1 TODO comment, 2 file edits |
| Entity Registry | ⭐⭐⭐ | Data design + loader + inject |
| Canon Guard | ⭐⭐ | Regex patterns + critic hook |
| Story Ledger model | ⭐⭐⭐ | Pydantic + DB schema |
| Ledger Extraction | ⭐⭐⭐⭐ | LLM call + prompt tuning + error handling |
| Ledger Injection | ⭐⭐ | context.py edit |
| WorldState model | ⭐⭐⭐ | Pydantic + pipeline integration |
| WorldState DB | ⭐⭐⭐ | CRUD + migration |
| PostgreSQL migration | ⭐⭐⭐⭐⭐ | Full DB refactor |
| Shared world state | ⭐⭐⭐⭐ | Race conditions, eventual consistency |
| Soul Scar system | ⭐⭐⭐⭐ | Cross-player privacy, query tuning |

## Khuyến Nghị

**Bắt đầu ngay Phase 1** — không cần migration, không break anything, high impact.
Đặc biệt Task 1.1 (NeuralMemory wire): `story_brain.py` đã built đầy đủ, chỉ cần gọi từ đúng chỗ.
Đây là 2-3 giờ effort cho improvement lớn nhất trong consistency.

**Phase 2 (Ledger)** làm sau khi Phase 1 stable 1-2 tuần — validate NeuralMemory recall trước.
Ledger Extraction (Task 2.2) là phần cần attention nhất: extraction prompt cần tuning để không false positive.

**Phase 3 và 4** — defer cho đến khi có users thật testing. Architecture đúng hướng nhưng không cần build sớm.
