# WORLD CONSISTENCY SPEC
## Đảm Bảo Nhất Quán Thế Giới Xuyên Suốt Mọi Hành Trình

**Version:** 1.0
**Companion docs:** WORLD_CONTEXT_PROMPT.md, PHASE1_ADAPTIVE_ENGINE.md, FORCE_TAXONOMY_SPEC.md
**Vấn đề giải quyết:** Dù mỗi player có story khác nhau — archetype khác, villain khác, narrative khác —
thế giới Aelvyndor phải *nhất quán*: cùng địa lý, cùng lịch sử, cùng lore physics, cùng NPC core.

---

## I. Tại Sao Đây Là Vấn Đề Khó

AI không có "bộ nhớ thế giới" tự nhiên. Mỗi API call là một slate gần như trắng.

**Các điểm thất bại phổ biến:**

| Failure | Ví dụ | Hậu quả |
|---------|-------|---------|
| **World drift** | Player A: Grand Gate City = thành phố trên núi. Player B: Grand Gate City = cảng biển | World mâu thuẫn |
| **NPC inconsistency** | Chapter 3: Merchant Sel thân thiện. Chapter 8: Merchant Sel đã chết (AI forgot) | Story contradicts itself |
| **Name collision** | Chapter 3 AI đặt tên làng "Korath's Landing". Chapter 7 AI gọi "Village of Korath" | Lore confusion |
| **Rule violation** | AI cho player gặp Archon trực tiếp — vi phạm quy tắc "không bao giờ xuất hiện trực tiếp" | Canon break |
| **Cross-player contradiction** | Player A thấy Emissary Kaen còn sống. Player B thấy Kaen đã bị giết | World state incoherent |

---

## II. Kiến Trúc 3 Tầng

```
TẦNG 1: WORLD CANON (Static — không bao giờ thay đổi)
├── WORLD_CONTEXT_PROMPT.md  ← đã có, inject vào mọi AI call
├── Entity Registry          ← CẦN XÂY, danh sách NPC/location canonical
└── World Rules              ← phần Section 10 của WORLD_CONTEXT_PROMPT

TẦNG 2: WORLD STATE (Dynamic Shared — thay đổi, dùng chung)
├── World-level events đã xảy ra (Emissary status, major events)
├── Faction power balance
└── Tower state (floors discovered, anomalies active)
    Phase 1: per-player (single player)
    Phase 2+: shared DB across players

TẦNG 3: PLAYER NARRATIVE (Dynamic Personal — mỗi player khác nhau)
├── Player identity state (seed, current, echo_trace, coherence)
├── Story facts player đã gặp (tên làng do AI đặt, NPC player đã gặp)
├── Choices và consequences
└── Relationship với NPCs
```

**Quy tắc cốt lõi:**
- Tầng 1 không thể bị thay đổi bởi AI output
- Tầng 2 chỉ thay đổi qua milestone events, không phải AI hallucination
- Tầng 3 tự do drift — đây là nơi story diverges

---

## III. Tầng 1: World Canon — Những Gì Đã Có & Còn Thiếu

### ✅ Đã có: WORLD_CONTEXT_PROMPT.md

Bao gồm: world lore, 5 Principles, Gates, lịch sử, faction, archetype, AI rules.
Được inject vào mọi AI call qua `world_context.py`.

### ❌ Còn thiếu: Entity Registry

Entity Registry là danh sách canonical các **thực thể có tên** mà AI có thể reference. Không có registry, AI sẽ invent NPC details khác nhau mỗi session.

**Ví dụ registry entry:**
```yaml
entities:
  npcs:
    - id: "merchant_sel"
      name: "Sel"
      location: "Grand Gate City — Market Quarter"
      role: "Information broker disguised as merchant"
      principle_alignment: "Freedom (primary), Control (hidden)"
      personality_core: "Warm exterior, calculating interior. Never lies — but never tells the full truth."
      faction: "Council of Pillars (secret)"
      current_status: "active"
      known_by: []          # player IDs who have met this NPC
      secrets:
        - "Là thành viên Council of Pillars"
        - "Biết về Great Awakening từ 10 năm trước"
      notes_for_ai: |
        Sel KHÔNG BAO GIỜ cung cấp thông tin miễn phí.
        Luôn yêu cầu đổi chác — không nhất thiết là tiền.
        Nếu player có Seeker/Sovereign archetype → Sel chủ động tìm player trước.

  locations:
    - id: "grand_gate_city"
      name: "Grand Gate City"
      aliases: ["Ngưỡng Vàng", "City of the Golden Threshold"]
      description_anchor: |
        Thành phố vòng tròn bao quanh Grand Gate. Kiến trúc đá trắng và vàng.
        3 vành đai: Outer Ring (dân thường), Middle Ring (faction HQ), Inner Ring (Council).
        Grand Gate ở trung tâm — ánh sáng vàng nhạt tỏa ra liên tục.
        Không bao giờ hoàn toàn tối — ngay cả ban đêm có ánh Gate.
      principle: "Order + Devotion"
      threat_tier: 0          # safe zone — Empire chưa xâm nhập trực tiếp
      notable_npcs: ["merchant_sel", "council_elder_veth"]
      lore_forbidden: |
        KHÔNG mô tả Grand Gate City là cảng biển — nó ở trung tâm lục địa.
        KHÔNG có Wall / fortification — Order thể hiện qua social structure, không vũ lực.
```

**Scope Entity Registry Phase 1:**
- ~10-15 NPCs (những NPC có thể xuất hiện)
- ~8-10 locations (starting zones + Tower floors + key landmarks)
- Emissary/General profiles (đã có trong VILLAIN_SYSTEM_SPEC, cần unify format)

### ❌ Còn thiếu: World Bible → World Context Sync

`WORLD_CONTEXT_PROMPT.md` là bản rút gọn từ WORLD_BIBLE.md (864 dòng → 238 dòng).
Cần có quy trình rõ ràng khi WORLD_BIBLE.md thay đổi → WORLD_CONTEXT_PROMPT.md phải update.

**Hiện tại:** Manual. **Cần:** Checklist hoặc script verify consistency.

---

## IV. Tầng 2: World State — Shared Dynamic

### Cấu trúc

```python
class WorldState(BaseModel):
    """Trạng thái thế giới — chia sẻ across players (Phase 2+), per-player Phase 1."""

    season: int = 1
    world_event_flags: dict[str, bool] = {}
    # Ví dụ:
    # "great_awakening_revealed": True/False  — dân chúng đã biết về chuyển sinh?
    # "minor_gate2_corruption_spread": False  — Cổng Máu đã lan rộng?
    # "tower_floor4_accessible": False        — Floor 4 đã mở chưa?

    emissary_status: dict[str, Literal["active", "revealed", "eliminated", "converted"]] = {
        "kaen": "active",
        "sira": "active",
        "thol": "active",
    }

    general_status: dict[str, Literal["shadow", "manifested", "confronted", "defeated"]] = {
        "vorn": "shadow",
        "kha": "shadow",
        "mireth": "shadow",
        "azen": "shadow",
    }

    tower_state: dict[str, Any] = {
        "highest_floor_reached": 1,       # Phase 1: single player
        "active_anomalies": [],
        "sealed_rooms": [],
    }

    faction_balance: dict[str, int] = {
        "council_of_pillars": 50,          # 0-100, Empire pressure vs resistance
        "free_cities": 50,
        "empire": 50,
    }
```

### Phase 1 vs Phase 2

| | Phase 1 (single player) | Phase 2+ (MMO) |
|-|------------------------|----------------|
| Storage | Player record (per-user WorldState) | Shared DB (PostgreSQL) |
| Mutation | Player choices only | Player actions + world events + other players |
| Sync | N/A | Event bus, eventual consistency |

**Phase 1 đơn giản hóa:** WorldState được nhúng vào player state. Emissary Kaen "eliminated" chỉ có nghĩa với player đó — không ảnh hưởng player khác. Đây là OK cho Phase 1.

---

## V. Tầng 3: Player Narrative — Story Ledger

Đây là tầng dễ bị bỏ qua nhưng quan trọng nhất cho **per-player consistency**.

### Vấn đề

Trong Chapter 3, AI đặt tên một ngôi làng ven rừng là "Korath's Landing". Đây không có trong Entity Registry (không phải canonical location). Nhưng một khi đã xuất hiện, nó phải nhất quán trong toàn bộ hành trình của player đó.

Không có Story Ledger, Chapter 8 AI có thể gọi nó là "the forest village" hoặc invent tên khác.

### Story Ledger — Cấu Trúc

```python
class StoryLedger(BaseModel):
    """Per-player accumulated story facts — những gì AI đã invent cho player này."""

    introduced_entities: list[IntroducedEntity] = []
    established_facts: list[EstablishedFact] = []
    player_named_entities: list[str] = []   # player đặt tên NPC/vật

class IntroducedEntity(BaseModel):
    entity_id: str                          # auto-generated slug
    entity_type: Literal["npc", "location", "object", "event"]
    name: str
    first_appeared_chapter: int
    description_anchor: str                 # 1-2 câu mô tả cố định
    current_status: str = "active"
    relationships: dict[str, str] = {}      # {"player": "helped_once", "sel": "rival"}

class EstablishedFact(BaseModel):
    fact_id: str
    statement: str                          # "Korath's Landing bị Empire đốt 20 năm trước"
    chapter_established: int
    source: Literal["ai_generated", "player_action", "world_canon"]
    # Nếu source = "world_canon" → không bao giờ thay đổi
    # Nếu source = "ai_generated" → có thể evolve nhưng không contradict
```

### Story Ledger Injection

Story Ledger được inject vào AI prompt dưới dạng compressed context:

```
STORY LEDGER (facts established in YOUR story — không được contradict):
- Korath's Landing: làng ven rừng phía đông Grand Gate, bị Empire đốt 20 năm trước, chỉ còn 3 gia đình (ch.3)
- NPC "Gara the Blind": Oracle già tại Korath's Landing, có Perception skill (ch.4)
- Emissary Kaen đã reveal identity tại Forest Shrine (ch.11)
- [...]
```

**Size constraint:** Ledger không được quá 500 tokens để inject. Nếu vượt → compression agent tóm tắt ledger cũ.

---

## VI. Cơ Chế Phòng Ngừa Canon Violation

### A. AI Rules trong Prompt (đã có)

`WORLD_CONTEXT_PROMPT.md` Section 10 đã có DO/DON'T list. Đây là lớp phòng thủ đầu tiên.

### B. Post-Generation Extraction

Sau mỗi chapter, một pipeline step nhỏ extract:
- Tên entities mới được đặt
- Facts mới được establish
- Bất kỳ statement nào về world lore, history, faction

→ Append vào Story Ledger.

**Không cần AI phức tạp để làm bước này.** Có thể dùng regex pattern cho tên riêng (capitalized proper nouns) + light extraction prompt.

```python
async def extract_story_facts(chapter_text: str, existing_ledger: StoryLedger) -> list[EstablishedFact]:
    """Extract new facts from generated chapter text."""
    prompt = f"""
    Đọc đoạn văn sau và extract:
    1. Tên mới của NPC, địa điểm, vật phẩm chưa có trong STORY LEDGER
    2. Facts mới về lịch sử/lore được nhắc đến

    STORY LEDGER HIỆN TẠI:
    {existing_ledger.to_compact_string()}

    CHAPTER TEXT:
    {chapter_text}

    Output JSON:
    {{"new_entities": [...], "new_facts": [...]}}
    """
    # Light model, không cần expensive call
```

### C. Canon Guard (Critical Rules Only)

Một số rules cực kỳ quan trọng nên được check programmatically, không chỉ qua AI prompt:

```python
CANON_GUARD_PATTERNS = [
    # Pattern → violation message
    (r"Archon\s+(xuất hiện|nói chuyện|gặp player)", "Canon violation: Archon không xuất hiện trực tiếp"),
    (r"The Veiled Will\s+(là|chính là|tên thật)", "Canon violation: Veiled Will không được reveal Season 1"),
    (r"level\s+\d+|HP\s*[:=]|XP\s+gained", "Canon violation: không dùng game terminology"),
]

def check_canon_guard(generated_text: str) -> list[str]:
    violations = []
    for pattern, message in CANON_GUARD_PATTERNS:
        if re.search(pattern, generated_text, re.IGNORECASE):
            violations.append(message)
    return violations
```

Nếu có violation → regenerate với explicit instruction về violation đó.

### D. Entity Registry Injection (Contextual)

Không inject TOÀN BỘ Entity Registry mỗi call — quá tốn token. Inject chỉ **entities relevant to current scene**:

```python
def get_relevant_entities(scene_context: SceneContext, registry: EntityRegistry) -> list[Entity]:
    """Return only entities relevant to current scene location and active NPCs."""
    relevant = []
    for entity in registry.entities:
        if entity.location_id == scene_context.current_location:
            relevant.append(entity)
        if entity.id in scene_context.active_npc_ids:
            relevant.append(entity)
    return relevant[:5]  # Cap at 5 to control token usage
```

---

## VII. Prompt Architecture — Thứ Tự Injection

Mọi AI narrative call phải inject theo thứ tự:

```
SYSTEM PROMPT:
[1] WORLD CANON (static — WORLD_CONTEXT_PROMPT.md)        ~1500 tokens
[2] ENTITY REGISTRY (contextual — chỉ relevant entities)   ~300 tokens
[3] STORY LEDGER (per-player — compressed)                 ~500 tokens

USER PROMPT:
[4] WORLD STATE (current world-level flags)                ~200 tokens
[5] PLAYER STATE (identity, coherence, archetype, etc.)    ~400 tokens
[6] THREAT ENVIRONMENT (from FORCE_TAXONOMY_SPEC)          ~150 tokens
[7] SCENE CONTEXT (current location, active NPCs, act)     ~300 tokens
[8] INSTRUCTION (what to generate)                         ~200 tokens

TOTAL ESTIMATE: ~3550 tokens context per call
```

**Priority nếu context quá dài:** Cắt theo thứ tự ưu tiên ngược — Story Ledger compress trước, Entity Registry chỉ lấy top 3, Player State giữ nguyên, World Canon KHÔNG bao giờ cắt.

---

## VIII. Vì Sao Không Cần Full Simulation

Một sai lầm phổ biến: nghĩ rằng world consistency cần simulate toàn bộ world state.

Aelvyndor theo triết lý **abstract state** — world không cần simulate mọi NPC activity. Chỉ cần:

1. **Canon là anchor** — những gì luôn đúng, inject vào mọi call
2. **Registry là guardrail** — AI không tự phát minh NPC core attributes
3. **Ledger là memory** — những gì đã được invented, phải giữ nhất quán
4. **World State là checkpoint** — major events đã xảy ra, không un-happen

Tất cả còn lại (dialogue, description, atmosphere, minor NPC details) → AI có thể improvise tự do trong guardrails.

---

## IX. Cross-Player Consistency (Phase 2 Preview)

Phase 1 đơn giản vì mỗi player có world state riêng. Phase 2 (MMO) cần:

### Shared World State

```python
# Phase 2: WorldState trong shared DB
# Emissary Kaen bị player A eliminate → tất cả player khác thấy Kaen status = "eliminated"
# Nhưng NARRATIVE khác nhau — player B nghe tin đồn, player A có memory trực tiếp
```

### Divergent Experience, Shared Reality

Player A kill Emissary Kaen. Player B chưa gặp Kaen.

Kết quả:
- World State: `kaen: "eliminated"` (shared)
- Player A ledger: "Tôi đã đối mặt và đánh bại Kaen tại..."
- Player B ledger: "Nghe tin đồn một Emissary đã biến mất, không ai biết tại sao"

AI generate cho player B: Kaen không xuất hiện, NPC nhắc "một trong những Emissary đột nhiên biến mất" — không reveal ai làm, để mystery.

### Identity Echo Integration

Player A chết tại một location → Soul Scar tạo Identity Echo tại đó.
Player B đi qua location → gặp Echo với seed signature tương tự A (không biết là ai).

Đây là cross-player shared reality không cần realtime sync — chỉ cần Soul Scar record trong world DB.

---

## X. Implementation Roadmap — Phase 1

### Tuần 1-2: Foundation (đã có phần lớn)
- [x] `WORLD_CONTEXT_PROMPT.md` — static canon
- [x] `world_context.py` — injection mechanism
- [ ] `EntityRegistry` schema + Phase 1 entity data file
- [ ] `StoryLedger` model + DB schema

### Tuần 3-4: Extraction & Validation
- [ ] Post-generation fact extraction pipeline step
- [ ] `canon_guard.py` — pattern-based violation detection
- [ ] Contextual entity injection in scene builder
- [ ] Story Ledger compression for long-running sessions

### Tuần 5-6: Integration
- [ ] Wire Entity Registry vào narrative pipeline
- [ ] Wire Story Ledger vào AdaptiveContext
- [ ] Test: chạy 10 chapters, verify entity names consistent
- [ ] Test: Canon Guard catches Archon/Veiled Will violations

### Phase 2 (later):
- [ ] Shared WorldState → PostgreSQL
- [ ] Emissary/General status sync across players
- [ ] Soul Scar → Identity Echo cross-player
- [ ] World-level event bus

---

## XI. Tóm Tắt Triết Lý

**Thế giới nhất quán không đến từ simulation — đến từ injection.**

```
AI không nhớ thế giới.
Ta cho AI biết thế giới mỗi lần.
Và ta nhớ những gì AI đã invent.
```

3 câu đó là toàn bộ kiến trúc.

- **WORLD CANON** → Ta cho AI biết những gì luôn đúng
- **STORY LEDGER** → Ta nhớ những gì AI đã invent
- **WORLD STATE** → Ta cập nhật những gì đã xảy ra

Player A có story hoàn toàn khác Player B — nhưng cả hai đều đứng trong cùng một thế giới Aelvyndor, với cùng Grand Gate City bằng đá trắng vàng, cùng Archon không bao giờ xuất hiện trực tiếp, cùng Empire mang triết lý "Trật tự tuyệt đối".

Còn Korath's Landing — ngôi làng Player A đặt chân đến ở Chapter 3 — chỉ tồn tại trong story của Player A. Player B có thể không bao giờ biết nó tồn tại. Và đó là điều hoàn toàn ổn.
