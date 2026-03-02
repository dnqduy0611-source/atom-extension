# SCENE-BASED NARRATIVE ARCHITECTURE SPEC v1.0

> **Author:** Amo
> **Date:** 2026-02-23
> **Status:** Approved — Ready for Implementation

---

## 1. Tổng quan & Motivation

### 1.1 Vấn đề hiện tại

| Vấn đề | Mô tả | Impact |
|--------|-------|--------|
| **Wall of text** | 1 chapter = 1000-3000 từ → user bị overwhelm | UX tệ |
| **Context loss** | Chỉ summary 2-3 câu → 95% chi tiết bị mất → chương sau rời rạc | Coherence |
| **Ít tương tác** | 3 choices / 2000 từ → user passive quá lâu | Engagement |
| **Gen time dài** | 60-120s cho 1 chapter → SSE timeout risk | Reliability |
| **Lãng phí beats** | Planner tạo 3-5 beats nhưng Writer nhồi tất cả vào 1 prose → mất granularity | Quality |

### 1.2 Giải pháp: Scene-Based Architecture

Refactor từ **1 Chapter = 1 monolithic prose** sang **1 Chapter = N Scenes** (sub-chapters).

```
HIỆN TẠI:
  Chapter 1 ──→ [Planner] ──→ [Writer: 2000 từ] ──→ 3 choices ──→ Chapter 2
                                    ↓
                              summary 2-3 câu (lossy)

ĐỀ XUẤT:
  Chapter 1
  ├── Scene 1.1 ──→ [Writer: 300-500 từ] ──→ 3 choices ──→
  ├── Scene 1.2 ──→ [Writer: 300-500 từ] ──→ 3 choices ──→
  ├── Scene 1.3 ──→ [Writer: 300-500 từ] ──→ 3 choices ──→
  └── Scene 1.4 ──→ [Writer: 300-500 từ] ──→ chapter_end
                         ↓
                   full prose scene trước (lossless)
```

### 1.3 Lợi ích kỳ vọng

| Metric | Trước | Sau | Cải thiện |
|--------|-------|-----|-----------|
| Text/interaction | 1500-3000 từ | 300-500 từ | **~5x ít hơn** |
| Choices/chapter | 3 | 9-15 | **~4x nhiều hơn** |
| Gen time | 60-120s | 10-20s | **~5x nhanh hơn** |
| Context quality | Summary (lossy) | Full prose (lossless) | **100% thông tin** |
| SSE timeout risk | Cao | Gần 0 | ✅ |
| Engagement | Đọc 5 phút → 1 action | Đọc 1 phút → 1 action | **5x interactive** |

---

## 2. Kiến trúc chi tiết

### 2.1 Phân cấp dữ liệu

```
Story
├── Chapter 1 (arc: "Thức Tỉnh")
│   ├── Scene 1 (beat: setup)      → prose + 3 choices
│   ├── Scene 2 (beat: rising)     → prose + 3 choices
│   ├── Scene 3 (beat: climax)     → prose + 3 choices
│   └── Scene 4 (beat: resolution) → prose + chapter_end flag
├── Chapter 2 (arc: "Khu Rừng Cổ")
│   ├── Scene 1 ...
│   └── ...
└── ...
```

### 2.2 Khi nào Chapter mới bắt đầu?

Chapter boundary được trigger bởi:

1. **Planner quyết định**: khi tất cả beats trong chapter outline đã hoàn thành
2. **Climax đã resolved**: sau beat `resolution` hoặc `falling`
3. **Location shift lớn**: khi cốt truyện chuyển sang vùng/thế giới mới
4. **Tone shift**: khi pacing cần thay đổi mạnh (VD: từ action sang mystery)

> **Quy tắc**: 1 chapter = 3-5 scenes (flexible). Planner quyết định số scenes dựa trên arc complexity.

### 2.3 Scene Model

```python
class Scene(BaseModel):
    """A single scene within a chapter."""
    id: str
    chapter_id: str
    scene_number: int            # 1, 2, 3, ... within chapter
    beat_index: int              # Index into planner_output.beats
    
    # Content
    prose: str                   # 300-500 từ
    title: str                   # Scene title (optional, can be empty)
    
    # Player action
    choices: list[Choice]        # 3 choices (all scenes including chapter_end)
    scene_type: str              # "exploration" | "combat" | "dialogue" | "discovery" | "rest"
    chosen_choice_id: str | None
    free_input: str
    
    # Metadata
    is_chapter_end: bool         # True → next scene starts new chapter
    tension: int                 # 1-10
    mood: str                    # From beat
    
    created_at: datetime
```

### 2.4 Pipeline Flow mới

```
┌─────────────────────────────────────────────────────────────┐
│                    Chapter Start                             │
│  Planner chạy 1 LẦN → tạo 3-5 beats → lưu vào chapter     │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Scene Loop                                  │
│                                                              │
│  For each beat in planner_output.beats:                      │
│    1. SceneWriter nhận:                                      │
│       - beat hiện tại + scene_type                           │
│       - FULL prose scene trước (KHÔNG phải summary)          │
│       - chosen_choice của player                             │
│       - player identity + unique_skill                       │
│    2. SceneWriter xuất:                                      │
│       - prose 300-500 từ                                     │
│       - 3 choices (CÓ choices ở mọi scene kể cả cuối)       │
│    3. Critic per-scene: đánh giá + rewrite nếu cần           │
│    4. Identity delta per-scene: tính ngay sau mỗi choice     │
│    5. Stream cho frontend → user chọn → next beat            │
│                                                              │
│  Kết thúc khi hết beats HOẶC planner signal chapter_end     │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Context Strategy

| Dữ liệu | Cách dùng | Tại sao |
|----------|-----------|---------|
| **Scene N-1 full prose** | Input **TOÀN BỘ** cho Writer | 100% context, không lossy |
| **Scene N-2 full prose** | Input toàn bộ | 2 scenes liên tiếp = đủ context sâu |
| **Scene N-3+** | Không dùng (quá xa) | Tiết kiệm tokens |
| **Planner beats** | Toàn bộ, đánh dấu beat hiện tại | Writer biết vị trí trong arc |
| **Player choice** | Text + consequence_hint | Quyết định hướng đi |
| **Player identity** | Cả object | Duy trì coherence nhân vật |
| **Unique skill** | Cả object | Tích hợp vào narrative + choices |

**Token budget estimate per scene call:**
- System prompt: ~800 tokens
- Beat list: ~300 tokens
- Scene N-1 full prose: ~400 tokens (300-500 từ)
- Scene N-2 full prose: ~400 tokens
- Player context + skill: ~300 tokens
- **Total input: ~2200 tokens**
- Output (300-500 từ prose + choices JSON): ~600 tokens
- **Total per scene: ~2800 tokens** (vs ~5000+ tokens cho monolithic chapter)

### 2.6 Writer Prompt thay đổi

Từ:
```
Viết prose chương mới (1000-3000 từ) dựa trên toàn bộ beats...
```

Thành:
```
Viết 1 SCENE duy nhất (300-500 từ) cho beat hiện tại.

## Beat hiện tại:
- Description: {beat.description}
- Tension: {beat.tension}/10
- Purpose: {beat.purpose}
- Mood: {beat.mood}

## Prose scene TRƯỚC ĐÓ (PHẢI tiếp nối):
{previous_scene_prose}

## Lựa chọn player vừa đưa ra:
{chosen_choice.text}

→ Viết prose NỐI TIẾP TRỰC TIẾP từ scene trước.
→ 300-500 từ, KHÔNG hơn.
→ Tạo 3 choices PHÙ HỢP VỚI SCENE TYPE (xem quy tắc bên dưới).
→ Nếu đây là beat cuối → set is_chapter_end = true, VẪN tạo choices.
```

### 2.7 Scene Types & Context-Aware Choices

Mỗi beat có `scene_type` do Planner gán. Choices phải **adapt theo scene type**:

| Scene Type | Mô tả | Choice Style |
|------------|--------|--------------|
| `combat` | Chiến đấu, trốn chạy, đối đầu | ⚔️ Tấn công/Phòng thủ/Rút lui — **BẮT BUỘC** có 1 choice dùng unique skill |
| `exploration` | Khám phá địa hình, tìm kiếm | 🗺️ Hướng đi, sử dụng kỹ năng quan sát, tương tác với môi trường |
| `dialogue` | Hội thoại, đàm phán, thẩm vấn | 💬 Thái độ khác nhau (thân thiện/đe dọa/trung lập), hỏi về thông tin |
| `discovery` | Phát hiện skill mới, awakening | ✨ Thử nghiệm khả năng, chấp nhận/từ chối sức mạnh, tìm hiểu giới hạn |
| `rest` | Nghỉ ngơi, suy ngẫm, hồi phục | 🌙 Trò chuyện với NPC, rèn luyện, tìm hiểu backstory |

**Quy tắc đặc biệt cho Combat scenes:**

```
## Quy tắc COMBAT CHOICES (BẮT BUỘC cho scene_type = "combat"):
1. CẢ 3 choices PHẢI liên quan trực tiếp đến tình huống combat
2. ÍT NHẤT 1 choice phải liên quan đến Unique Skill:
   - Format: "[Tên Skill] — hành động cụ thể" (VD: "[Ý Chí Vượt Trội] — Tập trung toàn bộ ý chí để chống chịu đòn tấn công")
   - Skill choice KHÔNG phải lúc nào cũng tốt nhất — có thể có hậu quả (overuse, lộ bí mật, quá tải)
3. 3 choices nên cover 3 chiến thuật khác nhau:
   - Aggressive (tấn công trực diện, risk 3-5)
   - Tactical (chiến thuật thông minh, risk 2-3)
   - Defensive/Evasive (phòng thủ/rút lui, risk 1-2)
4. Consequence hint phải reflect combat outcome — không generic
```

### 2.8 Skill Discovery Arc (Chapter 1-3)

Áp dụng cho **3 chapters đầu tiên** để xây dựng unique skill progression:

```
 Chapter 1: AWAKENING (Thức Tỉnh)
 ├── Scene 1-2: Skill biểu hiện THOÁNG QUA (linh cảm, phản xạ lạ)
 ├── Scene 3: Tình huống nguy hiểm → skill kích hoạt LẦN ĐẦU (bản năng)
 └── Scene 4: Nhân vật BỐI RỐI về khả năng mới

 Chapter 2: DISCOVERY (Khám Phá)
 ├── Scene 1-2: Thử nghiệm skill có ý thức → phát hiện CƠ CHẾ + GIỚI HẠN
 ├── Scene 3: Gặp NPC/tình huống giải thích skill (mentor, sách cổ...)
 └── Scene 4: Hiểu được ĐIỂM YẾU của skill

 Chapter 3: INTEGRATION (Tích Hợp)
 ├── Scene 1-2: Dùng skill CHIẾN LƯỢC (không chỉ bản năng)
 ├── Scene 3: Đối mặt tình huống skill KHÔNG GIẢI QUYẾT ĐƯỢC → cần sáng tạo
 └── Scene 4: Skill trở thành một phần identity → reflected trong choices
```

**Planner prompt phải nhận `unique_skill` data** để tạo beats phù hợp:
- Chapter 1: auto-include 1 beat `discovery` cho skill activation
- Chapter 2: auto-include 1 beat `discovery` cho skill experimentation
- Chapter 3: auto-include 1 beat `combat` showcase skill mastery

---

## 3. DB Schema Changes

### 3.1 Bảng `scenes` mới

```sql
CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id),
    scene_number INTEGER NOT NULL,
    beat_index INTEGER DEFAULT 0,
    
    -- Content
    title TEXT DEFAULT '',
    prose TEXT NOT NULL DEFAULT '',
    
    -- Player action
    choices_json TEXT DEFAULT '[]',
    chosen_choice_id TEXT DEFAULT NULL,
    free_input TEXT DEFAULT '',
    
    -- Metadata
    is_chapter_end INTEGER DEFAULT 0,
    tension INTEGER DEFAULT 5,
    mood TEXT DEFAULT 'neutral',
    
    created_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(chapter_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_scenes_chapter 
    ON scenes(chapter_id, scene_number);
```

### 3.2 Thay đổi bảng `chapters`

```diff
 CREATE TABLE IF NOT EXISTS chapters (
     id TEXT PRIMARY KEY,
     story_id TEXT NOT NULL REFERENCES stories(id),
     number INTEGER NOT NULL,
     title TEXT DEFAULT '',
-    prose_json TEXT DEFAULT '',
-    choices_json TEXT DEFAULT '[]',
-    summary TEXT DEFAULT '',
+    -- prose/choices/summary giờ nằm trong scenes
+    planner_output_json TEXT DEFAULT '{}',    -- Lưu toàn bộ beats
+    total_scenes INTEGER DEFAULT 0,
+    summary TEXT DEFAULT '',                  -- Chapter-level summary (auto-generated)
     ...
 );
```

> **Backward compatible:** Giữ nguyên columns cũ, thêm columns mới. Code mới đọc từ `scenes`, code cũ vẫn hoạt động.

---

## 4. API Changes

### 4.1 SSE Stream mới

**`GET /api/stream/scene`**

```
Parameters:
  story_id: str
  chapter_id: str (optional — nếu rỗng → tạo chapter mới)
  choice_id: str
  free_input: str

SSE Events:
  → status: { stage: "planner" | "writer", message: "..." }
  → prose: { text: "chunk...", offset: 0 }
  → choices: { choices: [...], scene_number: 2, is_chapter_end: false }
  → metadata: { scene_id, scene_number, chapter_id, chapter_number, ... }
  → chapter_start: { chapter_number: 2, title: "..." }  ← NEW event khi bắt đầu chapter mới
  → done: { ok: true }
```

### 4.2 History API

**`GET /api/story/{id}/scenes`** — Trả về tất cả scenes theo chapter order

```json
{
  "chapters": [
    {
      "chapter_number": 1,
      "title": "Thức Tỉnh",
      "scenes": [
        { "scene_number": 1, "prose": "...", "choices": [...] },
        { "scene_number": 2, "prose": "...", "choices": [...] }
      ]
    }
  ]
}
```

---

## 5. Frontend Changes

### 5.1 Reading Experience

```
HIỆN TẠI:
┌──────────────────────┐
│      CHƯƠNG 1        │
│                      │
│  [2000 từ prose]     │
│  ...wall of text...  │
│  ...scroll mỏi...   │
│                      │
│  ○ Choice 1          │
│  ○ Choice 2          │
│  ○ Choice 3          │
└──────────────────────┘

ĐỀ XUẤT:
┌──────────────────────┐
│   CHƯƠNG 1 • Scene 1 │
│                      │
│  [400 từ prose]      │
│  focused, readable   │
│                      │
│  ○ Choice 1          │
│  ○ Choice 2          │
│  ○ Choice 3          │
│──────────────────────│
│   ← Previous scenes  │
│   (collapsed/dimmed)  │
└──────────────────────┘
```

### 5.2 Scene Scroll/History

- Scenes trước hiển thị collapsed/dimmed phía trên
- Click để expand đọc lại
- Scene hiện tại luôn ở viewport chính
- Transition animation giữa scenes (fade in)

### 5.3 Chapter Transition

- Khi scene cuối của chapter kết thúc → chapter transition animation
- Hiện title chapter mới → auto-trigger planner → scene 1.1 mới

---

## 6. Implementation Phases

### Phase A: DB + Models (Complexity: ⭐⭐ — Low)

**Mục tiêu**: Thêm `Scene` model và DB table, backward compatible.

| Task | File(s) | Effort |
|------|---------|--------|
| Tạo `Scene` model | `models/story.py` | 30 min |
| Tạo `scenes` table + CRUD | `memory/state.py` | 1h |
| Migration cho existing DB | `memory/state.py` | 30 min |
| Unit tests cho Scene CRUD | `tests/test_scene_db.py` | 1h |

**Estimated: 3h** | **Risk: Thấp** — Chỉ thêm, không sửa existing code.

---

### Phase B: Scene Pipeline (Complexity: ⭐⭐⭐⭐ — High)

**Mục tiêu**: Refactor pipeline từ monolithic chapter sang scene-by-scene generation.

| Task | File(s) | Effort |
|------|---------|--------|
| Tạo `scene_writer.md` prompt | `prompts/scene_writer.md` | 1h |
| Refactor `writer.py` → `scene_writer.py` | `narrative/scene_writer.py` | 2h |
| Tách pipeline: planner chạy 1 lần, writer chạy per-scene | `narrative/pipeline.py` | 2h |
| Refactor `orchestrator.py` → scene orchestration loop | `engine/orchestrator.py` | 3h |
| Context strategy: full prose trước thay vì summary | `narrative/context.py` | 1h |
| Unit tests cho scene pipeline | `tests/test_scene_pipeline.py` | 2h |

**Estimated: 11h** | **Risk: Trung bình-Cao** — Core pipeline change, cần test kỹ.

> [!WARNING]
> Đây là phase critical nhất. Planner vẫn chạy 1 lần per chapter, nhưng Writer/Critic loop phải chạy per-scene. Orchestrator cần quản lý scene state machine.

---

### Phase C: API + SSE (Complexity: ⭐⭐⭐ — Medium)

**Mục tiêu**: Expose scene-based API và SSE streaming.

| Task | File(s) | Effort |
|------|---------|--------|
| Tạo `/stream/scene` endpoint | `routers/stream.py` | 2h |
| Tạo `/story/{id}/scenes` history endpoint | `routers/stories.py` | 1h |
| Backward compatible: `/stream/start` vẫn hoạt động | `routers/stream.py` | 30 min |
| Integration tests | `tests/test_api_scene.py` | 1h |

**Estimated: 4.5h** | **Risk: Thấp-Trung**

---

### Phase D: Frontend UI (Complexity: ⭐⭐⭐ — Medium)

**Mục tiêu**: Cập nhật UI để hiển thị scenes thay vì monolithic chapters.

| Task | File(s) | Effort |
|------|---------|--------|
| Refactor `StoryReader` → scene-based rendering | `web/js/app.js` | 3h |
| Scene scroll + history (collapsed previous scenes) | `web/js/app.js` | 2h |
| Chapter transition animation | `web/css/style.css`, `app.js` | 1h |
| Scene indicator (1.1, 1.2, ...) | `web/js/app.js` | 30 min |
| SSE handler cho scene events | `web/js/api.js` | 1h |

**Estimated: 7.5h** | **Risk: Trung bình** — UI logic phức tạp hơn hiện tại.

---

### Phase E: Polish & Migration (Complexity: ⭐⭐ — Low)

**Mục tiêu**: Migration tool cho existing stories, cleanup.

| Task | File(s) | Effort |
|------|---------|--------|
| Migration: convert existing chapters → 1-scene chapters | script | 1h |
| Remove legacy monolithic path | cleanup | 30 min |
| E2E test: Soul Forge → Chapter 1 → Choose → Scene 2 → ... | manual testing | 1h |
| Documentation update | README, specs | 30 min |

**Estimated: 3h** | **Risk: Thấp**

---

## 7. Tổng hợp Complexity

| Phase | Mô tả | Effort | Complexity | Risk | Phụ thuộc |
|-------|--------|--------|------------|------|-----------|
| **A** | DB + Models | 3h | ⭐⭐ | Thấp | — |
| **B** | Scene Pipeline | 11h | ⭐⭐⭐⭐ | Cao | A |
| **C** | API + SSE | 4.5h | ⭐⭐⭐ | Trung bình | A, B |
| **D** | Frontend UI | 7.5h | ⭐⭐⭐ | Trung bình | C |
| **E** | Polish + Migration | 3h | ⭐⭐ | Thấp | A-D |
| | **TỔNG** | **~29h** | | | |

> [!IMPORTANT]
> **Phase B là critical path** — nếu scene pipeline hoạt động đúng, phần còn lại chỉ là plumbing. Recommend: implement Phase A+B trước, test E2E bằng CLI/API, sau đó mới làm UI.

---

## 8. Rủi ro & Mitigation

| Rủi ro | Khả năng | Impact | Mitigation |
|--------|----------|--------|------------|
| LLM output không consistent giữa scenes | Trung bình | Cao | Feed full prose scene trước + explicit continuity rules |
| Scene quá ngắn, thiếu depth | Thấp | Trung bình | Prompt engineering: min 300 từ, có emotional beat |
| Quá nhiều API calls → cost tăng | Thấp | Trung bình | Mỗi call nhỏ hơn → total tokens tương đương |
| Migration phức tạp | Thấp | Thấp | Backward compatible — không cần migrate ngay |
| UX scene transition jerky | Trung bình | Trung bình | Smooth animation + preload next scene |

---

## 9. Quyết định đã xác nhận ✅

| # | Câu hỏi | Quyết định |
|---|---------|------------|
| 1 | Số scenes per chapter | **Planner quyết định** (3-5, flexible theo arc) |
| 2 | Scene N-1 context | **Full prose** (không truncate) |
| 3 | Choices at chapter_end | **Có** — scene cuối vẫn có 3 choices |
| 4 | Critic | **Per-scene** — chạy critic sau mỗi scene |
| 5 | Identity delta | **Per-scene** — tính ngay sau mỗi choice, DQS/coherence/instability update real-time |

---

## 10. Ví dụ Flow

### Trải nghiệm user:

```
[Soul Forge hoàn thành]

━━━ CHƯƠNG 1: Thức Tỉnh ━━━

▸ Scene 1 (setup)
  "Devold mở mắt. Ánh sáng chói chang xuyên qua tán lá. 
  Đau đớn ập đến — toàn thân anh rã rời..."
  (400 từ)
  
  → Chọn: "Cố gắng đứng dậy và quan sát xung quanh"

▸ Scene 2 (rising)
  "Devold chống tay đứng dậy. Khung cảnh trước mắt 
  khiến anh sững sờ — cây cối cao vút, thân phát sáng..."
  (350 từ)
  
  → Chọn: "Tiến về phía tiếng nước chảy"

▸ Scene 3 (climax)
  "Tiếng gầm rú vang lên từ phía sau. Devold quay lại 
  — một sinh vật khổng lồ, lông đen như mực..."
  (450 từ)
  
  → Chọn: "Kích hoạt Ý Chí Vượt Trội để chống cự"

▸ Scene 4 (resolution)
  "Sinh vật ngã xuống. Devold thở hổn hển, cánh tay 
  run rẩy. Bất chợt, một lão già xuất hiện..."
  (400 từ)

━━━ CHƯƠNG 2: Khu Rừng Cổ ━━━

▸ Scene 1 (setup) — Planner chạy lại cho chapter 2
  ...
```

**Tổng: 1600 từ / chapter, 4 interactions thay vì 1** ✅
