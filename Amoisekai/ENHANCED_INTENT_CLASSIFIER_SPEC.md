# AMOISEKAI — Enhanced Intent Classifier Spec

> Thay thế `input_parser.py` (Agent 0) bằng một classifier nhận thức đầy đủ context của player —
> không chỉ parse văn bản, mà hiểu **ý định thực sự** phía sau hành động.

---

## 1. Vấn đề với Input Parser hiện tại

### Hiện trạng (`input_parser.py`)

```
Player free text
    ↓
LLM + world context + previous_summary
    ↓
Choice(text, risk_level, consequence_hint)
```

Parser hiện tại chỉ biết:
- Văn bản player nhập
- Tóm tắt chapter trước
- Tên nhân vật

Parser hiện tại **không biết**:
- Player đang ở Unique Skill stage nào (không thể validate "tôi dùng Aspect skill")
- Skills nào player đang equipped (không thể nhận diện tên skill cụ thể)
- Archetype của player (không calibrate risk assessment theo archetype)
- Một số action categories không tồn tại: equipment, soul_forge, unique_skill_use

### Hậu quả

| Tình huống | Behavior hiện tại | Behavior đúng |
|---|---|---|
| "Tôi dùng kỹ năng Aspect lần 2 của mình" | Classify = magic, không validate stage | Detect `skill_use`, cross-check `unique_skill_stage == "aspect"` |
| "Tôi trang bị kiếm tối mới nhặt được" | Classify = other | Detect `equipment` category (khi weapon system ra) |
| "Bỏ trốn và ẩn náu" vs "Lẩn trốn trong bóng tối" | Treat as cùng action | Vanguard bỏ trốn = drift signal, Wanderer bỏ trốn = phong cách |
| "Tôi có thể bay không?" | Chuyển thành hành động, nhưng không biết player có khả năng bay không | `not_unlocked` nếu không có skill liên quan |

---

## 2. Thiết kế Enhanced Intent Classifier

### Triết lý

**Parser hiện tại**: "Văn bản này là gì?"
**Enhanced Classifier**: "Player đang muốn làm gì, có thể làm không, và điều này có nghĩa gì trong context của họ?"

### Context Envelope (input)

```json
{
  "free_input": "Tôi dùng kỹ năng bóng tối để ám sát tên lính canh",
  "protagonist_name": "Thiên Vũ",
  "previous_summary": "Tóm tắt chapter trước...",
  "player_context": {
    "archetype": "tactician",
    "dna_affinity": ["shadow", "mind"],
    "unique_skill_stage": "bloom",
    "unique_skill_name": "Màn Đêm Vô Tận",
    "unique_skill_category": "obfuscation",
    "equipped_skills": [
      {"name": "Bước Chân Bóng Tối", "principle": "void", "mechanic": "stealth movement"}
    ],
    "identity_coherence": 72.0,
    "current_arc_tag": "infiltration_arc"
  },
  "villain_context": {
    "active_villain": "general_kha",
    "encounter_phase": 1,
    "empire_resonance": 35,
    "identity_anchor": 20
  }
}
```

### Output Schema

```json
{
  "parsed_action": "Sử dụng kỹ năng ẩn thân để tiếp cận và vô hiệu hóa lính canh",
  "action_category": "skill_use",
  "skill_reference": "Bước Chân Bóng Tối",
  "risk_level": 3,
  "feasibility": "possible",
  "feasibility_note": "",
  "requires_modification": false,
  "modified_action": "",
  "modification_reason": "",
  "consequence_hint": "Ám sát thành công có thể mở lối vào, nhưng nếu phát hiện sẽ kích hoạt báo động",
  "player_intent": "Tiếp cận mục tiêu bí mật mà không gây ồn ào",
  "archetype_note": "Hành động tactical — phù hợp archetype Tactician",
  "confidence": 0.92
}
```

### Action Category Taxonomy

| Category | Mô tả | Ví dụ |
|---|---|---|
| `narrative` | Hành động thuần narrative, không dùng power | "Tôi nói chuyện với lão lái buôn" |
| `combat` | Chiến đấu trực tiếp, không invoke skill cụ thể | "Tấn công bằng kiếm" |
| `skill_use` | Invoke một skill cụ thể (normal hoặc unique) | "Dùng kỹ năng [tên]" |
| `social` | Thuyết phục, đàm phán, thao túng xã hội | "Thuyết phục hội đồng tin vào ta" |
| `exploration` | Di chuyển, khám phá địa điểm | "Khám phá tầng hầm" |
| `stealth` | Ẩn nấp, theo dõi, không bị phát hiện | "Bí mật theo dõi tên gián điệp" |
| `equipment` | Trang bị/tháo vũ khí, thay đổi weapon slot | "Trang bị Vô Hồi Đao vào primary slot" |
| `soul_choice` | Quyết định liên quan identity/mutation arc | "Từ chối thức tỉnh sức mạnh tối" |
| `other` | Không thuộc category trên | Fallback |

> **Update**: `equipment` category **active** từ Weapon System Spec v1.0. Context envelope cần bổ sung `equipped_weapons` (xem §5 bên dưới). Signature Move invoke classify là `skill_use` với `skill_reference = "{weapon_name}.signature"`.

> **Update**: `soul_choice` classification rule: Nếu `villain_context.active_villain` không null VÀ player response liên quan đến philosophy/allegiance/acceptance/rejection → classify là `soul_choice`, không phải `social` hay `narrative`.

### Feasibility Values

| Giá trị | Ý nghĩa | Hành động |
|---|---|---|
| `possible` | Action hợp lệ và khả thi | Proceed |
| `unlikely` | Khó nhưng có thể (low probability) | Modify risk_level lên, note cho writer |
| `impossible` | Vật lý/lore bất khả thi | Replace bằng closest valid action |
| `not_unlocked` | Cần skill/stage chưa có | Thay bằng limited version player thực sự có |
| `ambiguous` | Input quá mơ hồ để classify | Chọn interpretation rõ nhất, confidence thấp |

### Skill Reference Resolution

Khi classifier detect `skill_use`:
1. Tìm trong `equipped_skills` theo tên / keyword / mechanic
2. Nếu match → set `skill_reference = skill.name`
3. Nếu player nhắc đến unique skill nhưng stage không unlock sub-skill đó → `feasibility = "not_unlocked"`, `feasibility_note = "Sub-skill này unlock ở stage [X]"`
4. Nếu không match bất kỳ equipped skill nào → classify thành `combat` thông thường

---

## 3. So sánh Input/Output

### Current `input_parser.py` output
```json
{
  "parsed_action": "Tấn công lính canh bằng bóng tối",
  "risk_level": 3,
  "action_type": "stealth",
  "feasibility": "possible",
  "consequence_hint": "...",
  "requires_modification": false,
  "modified_reason": ""
}
```

### Enhanced Intent Classifier output
```json
{
  "parsed_action": "Sử dụng Bước Chân Bóng Tối tiếp cận và vô hiệu hóa lính canh",
  "action_category": "skill_use",
  "skill_reference": "Bước Chân Bóng Tối",
  "risk_level": 3,
  "feasibility": "possible",
  "feasibility_note": "",
  "requires_modification": false,
  "modified_action": "",
  "modification_reason": "",
  "consequence_hint": "Ám sát im lặng — nếu thành công mở lối, nếu thất bại kích hoạt báo động",
  "player_intent": "Xâm nhập im lặng, tránh confrontation",
  "archetype_note": "Phù hợp Tactician — cách tiếp cận strategic",
  "confidence": 0.92
}
```

Downstream, `skill_reference` giúp Planner biết skill nào được invoke → Writer mô tả đúng mechanic → Critic kiểm tra skill được dùng đúng cách.

---

## 4. Integration với Pipeline

### Vị trí trong pipeline

```
Player Input (free text)
    ↓
[ENHANCED INTENT CLASSIFIER]   ← thay thế _node_input_parser
    ├── Nhận player_context từ state.player_state
    ├── Phân tích intent + validate feasibility
    └── Output: enriched Choice + intent metadata
    ↓
[PLANNER]   ← nhận thêm action_category + skill_reference
    ↓
...pipeline như cũ...
```

### Thay đổi trong `NarrativeState`

Thêm field vào `NarrativeState` để carry intent metadata qua pipeline:

```python
# Thêm vào NarrativeState
action_category: str = ""         # từ classifier
skill_reference: str = ""         # tên skill được invoke
player_intent: str = ""           # intent layer
choice_confidence: float = 1.0    # confidence của classification
```

### Thay đổi trong Planner

Planner nhận `action_category` và `skill_reference` → có thể:
- Beat planning với `scene_type = "combat"` khi `action_category = "combat"`
- Inject đúng skill mechanic vào beat description khi `skill_reference` không rỗng
- Biết đây là `soul_choice` → plan narrative confrontation arc thay vì normal beat

### Backward Compatibility

Nếu Enhanced Intent Classifier fail (parse error, AI timeout):
→ Fallback về `input_parser.py` hiện tại
→ `action_category = "other"`, `skill_reference = ""`, `confidence = 0.5`

---

## 5. Implementation Notes

### File structure

```
app/narrative/enhanced_intent_classifier.py   ← agent mới
app/prompts/enhanced_intent_classifier.md     ← system prompt
```

`input_parser.py` giữ nguyên làm fallback.

### Context envelope builder

Cần extract từ `state.player_state`:
- `archetype`
- `dna_affinity`
- `unique_skill_growth.current_stage`
- `unique_skill.name` + `unique_skill.category`
- `equipped_skills` (top-level list)
- `identity_coherence` (để detect nếu player đang drift → alert Planner)
- `current_arc_tag` (nếu có — Phase 2)

### Temperature

`0.25` — classification task cần nhất quán, không cần creative.

### Timing note

Weapon System Spec v1.0 đã hoàn thành. `equipment` category đã active — classifier trích xuất `weapon_name` và `weapon_soul_linked` từ `player_state.equipped_weapons`. Signature Move invoke classify là `skill_use` với `skill_reference = "{weapon_name}.signature"`.

---

## 6. Pending Decisions — Resolved

| Câu hỏi | Resolution | Implementation |
|---|---|---|
| Có pass `player_intent` vào Writer prompt không? | **Yes** — thêm vào writer context | ✅ Writer template có `## Player Intent` section |
| `archetype_note` có log vào identity agent không? | **Yes** — extract từ classifier, carry qua pipeline | ✅ `archetype_note` field trong NarrativeState |
| Fallback khi `confidence < 0.5`? | **Proceed + log** | ✅ Classifier returns result regardless, pipeline logs low confidence |
| Khi `feasibility = "not_unlocked"` thì Writer có hint player không? | **Subtle hint** — append `feasibility_note` vào action text | ✅ Line 201-205 in classifier |
