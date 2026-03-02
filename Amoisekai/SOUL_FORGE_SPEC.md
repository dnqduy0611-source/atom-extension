# 🔥 SOUL FORGE — Unique Skill Generation System

> **Subtitle:** 3-Phase Identity Extraction → AI-Generated Truly Unique Skill  
> **Author:** Amo  
> **Date:** 2026-02-23  
> **Status:** Draft  
> **Replaces:** 7-question quiz onboarding  
> **Dependencies:** GDD v1.0, NARRATIVE_REBORN_SPEC, UNIQUE SKILL SYSTEM v3

---

## 1. Vấn đề cần giải quyết

Hệ thống quiz 7 câu hiện tại:

| Vấn đề | Chi tiết |
|---------|----------|
| Entropy thấp | 7 câu × 4 choices = ~16K combo → map xuống ~336 profile |
| Dễ trùng | 2 người trả lời giống → skill gần giống |
| Không thực sự "unique" | AI generate tên khác nhưng cơ chế giống |
| Trải nghiệm nhạt | Trả lời form khảo sát, ko gắn kết cảm xúc |
| Không tạo attachment | Player không cảm thấy "skill này sinh ra từ mình" |

**Mục tiêu Soul Forge:** Mỗi player nhận 1 skill **hoàn toàn không trùng** với bất kỳ ai — không chỉ về tên, mà cả **cơ chế, giới hạn, và hệ quả**.

---

## 2. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────┐
│              SOUL FORGE                      │
│                                              │
│  Phase 1: Micro-Narrative (5 scenes)         │
│  → Identity Signals (~25 dimensions)         │
│                    ↓                         │
│  Phase 2: Soul Fragment (1 free-text)        │
│  → Infinite entropy seed                     │
│                    ↓                         │
│  Phase 3: Behavioral Fingerprint (ẩn)        │
│  → Decision pattern vector (~8 dims)         │
│                    ↓                         │
│  ┌──────────────────────────────────┐        │
│  │  AI Forge (Gemini 2.5 Flash)    │        │
│  │  Input: 3-phase data + lore     │        │
│  │  Output: UniqueSkill object     │        │
│  │  Constraint: DB uniqueness      │        │
│  └──────────────────────────────────┘        │
│                    ↓                         │
│  Uniqueness Verification (embedding check)   │
│                    ↓                         │
│  ✅ Skill finalized → Narrative Reborn       │
└─────────────────────────────────────────────┘
```

**Thời gian:** ~5-7 phút (vs ~2 phút quiz cũ)  
**Cảm giác:** Sống 1 mini-story, không phải điền form

---

## 3. Phase 1: Micro-Narrative — "The Void Between"

### 3.1 Concept

Player trải qua 5 scenes trong "khoảng trống giữa hai thế giới" — trước khi tỉnh dậy ở Amoisekai. Đây là **khoảnh khắc linh hồn chuyển tiếp**, nơi bản chất sâu nhất bộc lộ.

> Lore: Khi The Veiled Will kéo linh hồn vào universe, linh hồn phải đi qua "The Void Between" — nơi ký ức bị xóa nhưng **bản năng thuần khiết** lộ ra.

### 3.2 Branching Structure

```
Scene 1 (fixed)
    ├── Choice A → Scene 2a
    ├── Choice B → Scene 2b  
    ├── Choice C → Scene 2c
    └── Choice D → Scene 2d
         ↓
Scene 2 (4 variants)
    ├── Choice A → Scene 3x
    ├── Choice B → Scene 3y
    └── Choice C → Scene 3z
         ↓
Scene 3 (12 variants)
    ├── ...
         ↓
Scene 4 (branching)
         ↓
Scene 5 (convergent — cùng kết thúc bằng "tỉnh dậy")
```

**Tổng paths:** 4 × 3 × 3 × 3 = **108 narrative paths** (Scene 5 convergent, không có choice)

### 3.3 5 Scenes chi tiết

---

#### 🌑 Scene 1: "The Awakening Void" (Arrival)

**Setting:** Bóng tối hoàn toàn. Không có thân xác. Chỉ có ý thức.

> *Không có gì. Không ánh sáng, không âm thanh, không cơ thể. Chỉ có bạn — hoặc thứ còn lại của bạn.*
>
> *Rồi bạn cảm nhận được bốn thứ, rất xa, rất mờ. Như tiếng vọng từ cuối đường hầm.*

**4 choices:**

| Choice | Text hiển thị | Signals ẩn |
|--------|--------------|------------|
| A | Một sợi dây — kết nối bạn với ai đó bạn không nhớ | `oath +3`, `charm +1`, attachment_style: relational |
| B | Một luồng năng lượng — như cơn bão đang ngủ bên trong | `chaos +3`, `bloodline +1`, attachment_style: power-seeking |
| C | Một mảnh ký ức — hình ảnh mờ nhạt, nhưng sắc như dao | `mind +3`, `relic +1`, attachment_style: analytical |
| D | Một khoảng lặng — bình yên, nhưng bạn biết nó nguy hiểm | `shadow +3`, `tech +1`, attachment_style: cautious |

**Signal output:** `void_anchor` (gì bạn bám vào trong hư vô), `primary_dna_hint`

---

#### 🌑 Scene 2: "The Echo Test" (Moral Core)

**Setting:** Thay đổi theo Scene 1 choice. Void bắt đầu "chiếu" hình ảnh.

> *Hư vô đáp lại bạn. Nó chiếu một hình ảnh — không phải ký ức, mà như thể nó đang thử bạn.*

**4 variants × 3 choices mỗi variant:**

**Variant A** (chose "sợi dây" ở Scene 1):
> *Bạn thấy hai nhóm người. Một phía đang gọi bạn, khuôn mặt thân quen dù bạn không nhớ. Phía kia — một đứa trẻ bị bỏ lại.*

| Choice | Text | Signals |
|--------|------|---------|
| 1 | Chạy về phía quen thuộc — bạn tin bản năng | `loyalty +2`, `oath +1`, decision_pattern: instinctive |
| 2 | Đến đứa trẻ — người cần bạn hơn | `sacrifice +2`, `catalyst +1`, decision_pattern: empathetic |
| 3 | Đứng yên — quan sát trước đã | `tactical +2`, `perception +1`, decision_pattern: calculated |

**Variant B** (chose "năng lượng"):
> *Năng lượng trong bạn bùng lên. Từ bóng tối, hai thực thể xuất hiện — một đang gầm gừ, một đang cười.*

| Choice | Text | Signals |
|--------|------|---------|
| 1 | Tấn công trước — không cần biết ai là bạn | `aggression +2`, `chaos +1`, decision_pattern: aggressive |
| 2 | Quan sát — kẻ cười có thể nguy hiểm hơn | `analysis +2`, `mind +1`, decision_pattern: calculated |
| 3 | Để năng lượng tràn ra — xem chuyện gì xảy ra | `surrender +2`, `bloodline +1`, decision_pattern: intuitive |

**Variant C** (chose "ký ức"):
> *Mảnh ký ức sắc nét hơn. Một cuốn sách đang cháy. Bạn chỉ đọc được một dòng trước khi nó biến mất.*

| Choice | Text | Signals |
|--------|------|---------|
| 1 | Cố nhớ dòng chữ bằng mọi giá | `determination +2`, `mind +1`, decision_pattern: obsessive |
| 2 | Để nó cháy — có thứ mới sẽ viết | `acceptance +2`, `chaos +1`, decision_pattern: adaptive |
| 3 | Cố cứu cuốn sách — dù biết không kịp | `preservation +2`, `relic +1`, decision_pattern: protective |

**Variant D** (chose "khoảng lặng"):
> *Sự im lặng trở nên sâu hơn. Từ trong đó, một giọng nói — không phải bạn, nhưng biết bạn.*

| Choice | Text | Signals |
|--------|------|---------|
| 1 | Hỏi: "Ngươi là ai?" | `curiosity +2`, `perception +1`, decision_pattern: investigative |
| 2 | Nói: "Tôi biết đây không có thật" | `defiance +2`, `tech +1`, decision_pattern: skeptical |
| 3 | Im lặng đáp lại — nghe xem nó muốn gì | `patience +2`, `shadow +1`, decision_pattern: observant |

**Signal output:** `moral_core` (loyalty/sacrifice/analysis/etc.), `decision_pattern`

---

#### 🌑 Scene 3: "Vết Nứt Thiên Mệnh" (The Fracture — Conflict Response)

**Setting:** Void bắt đầu vỡ. Dùng context từ 2 choices trước.

> *Hư Vô rung chuyển. Từ các vết nứt, mảnh thực tại lọt vào. Linh hồn cảm nhận quyền năng xa lạ lần đầu — Domain Echo.*

AI generate scene text dựa trên 2 choices trước (V2: tone thần thánh, sử thi, xưng ta/ngươi).

> [!NOTE]
> Prompt đầy đủ xem tại `_build_scene3_prompt()` trong `soul_forge.py`. Dưới đây là tóm tắt:

**Prompt features (V2):**
- Hư Vô xưng "ta", gọi player là "ngươi" — giọng thần cổ đại
- **Domain Echo:** player cảm nhận quyền năng xa lạ (perception/manifestation/contract/obfuscation/manipulation)
- **Weakness hints:** mỗi choice ám chỉ 1 `weakness_type` (soul_echo / sensory_tax / escalation_curse)
- Scene text 150-200 từ tiếng Việt, tone sử thi thần thoại
- 3 choices rõ nghĩa, ngắn gọn, mỗi choice có `conflict_response`, `risk_tolerance`, `power_vs_connection`

**Signal output:** `conflict_response`, `risk_tolerance`, `power_vs_connection`

---

#### 🌑 Scene 4: "Lễ Hiến Tế" (The Sacrifice — Core Value)

> *Hư Vô đòi CÁI GIÁ — mọi sức mạnh đều cần hiến tế.*

**AI generate dựa trên context tích lũy.** Tone đã được nâng cấp V2.

> [!NOTE]
> Prompt đầy đủ xem tại `_build_scene4_prompt()` trong `soul_forge.py`. Dưới đây là tóm tắt:

**Prompt features (V2):**
- Hư Vô xưng "ta", gọi "ngươi" — nghi lễ cổ đại
- **Unique Clause Foreshadowing:** linh hồn cảm nhận quyền năng vượt giới hạn phàm nhân
- 3 choices rõ ràng:
  A. Dũng cảm (courage) — chấp nhận hiến tế hoàn toàn
  B. Khôn ngoan (cleverness) — thương lượng, đàm phán giá cả
  C. Phản kháng (defiance) — từ chối luật chơi của Hư Vô

**Signal output:** `sacrifice_type`, `courage_vs_cleverness_vs_defiance`

---

#### 🌑 Scene 5: "The Forge" (Convergent — Skill Awakening)

> *Mọi thứ hội tụ lại. Mọi lựa chọn bạn vừa đưa ra — chúng không biến mất. Chúng đang cháy, nung chảy, hòa vào nhau bên trong bạn.*
> 
> *Đây là khoảnh khắc bạn được rèn.*

**Không có choice.** Scene này là cinematic transition:

1. AI tóm tắt hành trình Void dựa trên 4 choices trước
2. Hiển thị: "Linh hồn bạn đang được rèn..."
3. → Chuyển sang Phase 2 (Soul Fragment)

---

### 3.5 V2 Narrative Integration — Domain Echo, Clause Hint, Forge Vision

> **v2.0:** Scene 3-5 tích hợp narrative foreshadowing cho V2 Unique Skill fields.

#### Domain Echo (Scene 3)
Trong "Vết Nứt Thiên Mệnh", player cảm nhận **quyền năng xa lạ** lần đầu tiên:
- Perception → "vết nứt phát sáng, hiện hình ảnh ai đó đang nói dối"
- Manifestation → "cơ thể rung chuyển, da cứng lại như kim loại"
- Contract → "giọng nói vang lên: 'Hãy trao lời thề'"
- Obfuscation → "bóng bạn tách ra, di chuyển độc lập"
- Manipulation → "không gian uốn cong theo ý nghĩ"

Mỗi choice trong Scene 3 ám chỉ 1 `weakness_type` khác nhau qua hệ quả.

#### Clause Hint (Scene 4)
Trong "Lễ Hiến Tế", giây phút hiến tế, player cảm nhận quyền năng **vượt giới hạn phàm nhân** — thứ Normal Skill không thể làm. Đây là foreshadowing cho `unique_clause`.

#### Forge Vision (Scene 5)
Sau khi Hư Vô phán xử, player thấy **hình ảnh kỹ năng đang kết tinh** — dựa trên `void_anchor` + `moral_core`. Không reveal tên/mechanic, chỉ là cảm giác thần bí.

#### Phong cách chung
- Hư Vô xưng **"ta"**, gọi player là **"ngươi"** — giọng thần minh phán xử
- Ngôn ngữ **sử thi, thần thoại** — không hiện đại
- Mỗi choice **rõ nghĩa, ngắn gọn** — player hiểu ngay hậu quả

---

### 3.4 Identity Signal Map

Sau Phase 1, hệ thống thu được:

```json
{
  "void_anchor": "connection|power|knowledge|silence",
  "primary_dna_hint": ["oath", "chaos", "mind", "shadow"],
  "attachment_style": "relational|power-seeking|analytical|cautious",
  "moral_core": "loyalty|sacrifice|analysis|aggression|determination|...",
  "decision_pattern": "instinctive|calculated|empathetic|aggressive|...",
  "conflict_response": "...",     // AI-generated
  "risk_tolerance": 1-3,
  "power_vs_connection": -1.0 to 1.0,
  "sacrifice_type": "...",        // AI-generated
  "courage_vs_cleverness_vs_defiance": "...",
  "scene_path": [1, 2, 3, 4]     // exact path taken
}
```

**Dimensions:** ~12-15 identity signals, với ~25 possible values

---

## 4. Phase 2: Soul Fragment — "The Last Words"

### 4.1 Concept

Ngay sau Scene 5 (khoảnh khắc "being forged"), hiển thị:

> *Lửa nung chảy mọi thứ — nhưng có thứ gì đó từ chối bị xóa. Một mảnh linh hồn, nhỏ nhưng không thể phá vỡ.*
>
> *Nếu bạn chỉ được giữ lại DUY NHẤT một thứ khi bước vào thế giới mới — đó là gì?*

**1 câu free-text duy nhất.** Không giới hạn ngôn ngữ (Việt/Anh).

### 4.2 Tại sao 1 câu thay vì nhiều câu?

| Lý do | Giải thích |
|-------|-----------|
| Tập trung | 1 câu buộc player tìm "core" thực sự |
| Entropy cực cao | Không ai viết giống ai |
| Không gây khó chịu | Nhiều free-text = homework, 1 câu = meaningful |
| Dễ process | AI parse 1 câu tốt hơn 5 câu |

### 4.3 Câu hỏi backup (nếu player viết quá ngắn / trống)

Nếu player viết < 3 từ hoặc bỏ trống, hiển thị 1 trong 3 câu hỏi thay thế:

1. > *"Có người từng nói với bạn một câu mà bạn không bao giờ quên. Câu đó là gì?"*
2. > *"Điều gì khiến bạn nổi giận nhất — dù bạn biết không nên?"*
3. > *"Nếu thế giới cũ biến mất, bạn sẽ nhớ điều gì nhất?"*

### 4.4 Processing

AI extract từ free-text:

```json
{
  "soul_fragment_raw": "nguyên văn player viết",
  "soul_fragment_themes": ["protection", "freedom", "knowledge", ...],
  "soul_fragment_emotion": "fierce|gentle|melancholic|defiant|...",
  "soul_fragment_target": "self|others|concept|world"
}
```

---

## 5. Phase 3: Behavioral Fingerprint — "Soul Signature" (Ẩn hoàn toàn)

### 5.1 Thu thập gì?

Trong suốt Phase 1 + 2, hệ thống **im lặng** thu thập:

| Signal | Đo gì | Cách đo |
|--------|-------|---------|
| `response_times[5]` | Quyết đoán vs cân nhắc | ms cho mỗi choice |
| `hesitation_score` | Phân vân | Số lần hover/touch choice trước khi chọn |
| `reading_speed` | Kiên nhẫn vs nhanh | Thời gian từ scene hiện đến choice |
| `revision_count` | Hoàn hảo vs chấp nhận | Số lần sửa free-text |
| `text_length` | Verbose vs concise | Ký tự trong soul fragment |
| `typing_rhythm` | Confidence | Tốc độ gõ (chars/sec) |
| `scroll_pattern` | Review behavior | Có scroll lại đọc lại scene không |
| `completion_rate` | Commitment | Hoàn thành hay bỏ giữa chừng |

### 5.2 Vector hóa

```json
{
  "decisiveness": 0.0-1.0,      // nhanh = decisive
  "deliberation": 0.0-1.0,      // chậm + hover = deliberate
  "expressiveness": 0.0-1.0,    // text dài = expressive
  "confidence": 0.0-1.0,        // gõ nhanh + ít sửa = confident
  "patience": 0.0-1.0,          // đọc kỹ + scroll lại = patient
  "consistency": 0.0-1.0,       // response time đều = consistent
  "impulsivity": 0.0-1.0,       // choice đầu tiên < 2s = impulsive
  "revision_tendency": 0.0-1.0  // sửa nhiều = perfectionist
}
```

### 5.3 Privacy

> [!IMPORTANT]
> Behavioral data **KHÔNG lưu raw** (không lưu keystroke, mouse position).
> Chỉ lưu **vector trừu tượng** sau khi normalize.
> Player không biết hệ thống đo behavioral — nhưng dữ liệu không sensitive.

---

## 6. AI Forge — Skill Generation Pipeline

### 6.1 Input Assembly

```json
{
  "phase_1_signals": {
    "void_anchor": "knowledge",
    "moral_core": "determination",
    "decision_pattern": "calculated",
    "conflict_response": "strategic_withdrawal",
    "risk_tolerance": 2,
    "sacrifice_type": "certainty",
    "scene_path": [1, "C", "1", "2", "2"]
  },
  "phase_2_signals": {
    "soul_fragment_raw": "Sự thật — dù nó đau đến đâu, tôi muốn biết sự thật",
    "soul_fragment_themes": ["truth", "knowledge", "pain"],
    "soul_fragment_emotion": "defiant",
    "soul_fragment_target": "concept"
  },
  "phase_3_signals": {
    "decisiveness": 0.6,
    "deliberation": 0.7,
    "expressiveness": 0.4,
    "confidence": 0.8,
    "patience": 0.9,
    "consistency": 0.6,
    "impulsivity": 0.2,
    "revision_tendency": 0.3
  }
}
```

### 6.2 Generation Prompt (Gemini 2.5 Flash)

> [!NOTE]
> Prompt đầy đủ xem tại `_build_forge_prompt_v2()` trong `soul_forge.py`. Dưới đây là tóm tắt cấu trúc:

```
BẠN LÀ SOUL FORGE — hệ thống rèn kỹ năng độc nhất từ linh hồn.

## Dữ liệu linh hồn:
{phase_1 + phase_2 + phase_3 JSON}

## Thế giới:
- 5 hệ skill: Manifestation, Manipulation, Contract, Perception, Obfuscation
- Tam giác cân bằng: mỗi hệ bị counter bởi 2 hệ khác
- Skill bí mật mặc định — không ai biết skill của bạn

## Quy tắc forge (12 rules):
1. Chọn ARCHETYPE (1/6)
2. Tên skill: tiếng Việt, 2-4 từ, poetic, ĐỘC NHẤT
3. Category: DUY NHẤT 1/5, CONSISTENT với archetype
4. Core Mechanic: 1 việc + QUIRK, seed level
5. Domain Passive (Sub-skill 0)
6. Limitation: ĐỘC ĐÁO, không mẫu cooldown
7. Weakness: 1/7 taxonomy types + customize từ Phase data
8. Unique Clause: 1 thứ Normal Skill KHÔNG làm được
9. Activation: trigger gắn với personality
10. Soul Resonance: 1-2 câu poetic
11. HEALING MECHANIC (cực hiếm — 3 điều kiện đồng thời)
12. NON-HEALING ENFORCED: Perception/Obfuscation/Manipulation
```

## Output JSON:
{
  "archetype": "1 trong 6 archetype",
  "name": "Tên Skill tiếng Việt",
  "description": "1 câu MÔ TẢ CỤ THỂ skill làm gì",
  "category": "1 trong 5 hệ",
  "mechanic": "Chi tiết CƠ CHẾ HOẠT ĐỘNG 2-3 câu: có QUIRK, không generic",
  "domain_passive": {
    "name": "Tên sub-skill 0",
    "mechanic": "Hiệu ứng passive domain 1-2 câu"
  },
  "limitation": "Giới hạn ĐỘC ĐÁO",
  "weakness_type": "1 trong 7 types",
  "weakness": "Điểm yếu CÁ NHÂN — customize từ Phase data",
  "unique_clause": "1 thứ Normal Skill không thể làm",
  "activation_condition": "Trigger CỤ THỂ gắn với personality",
  "activation_cost": "Chi phí SÁNG TẠO — không lặp lại giữa các skill",
  "soul_resonance": "1-2 câu POETIC vì sao skill thuộc về player",
  "trait_tags": ["max 3 DNA tags"],
  "evolution_hint": "1 câu hint ẩn cho growth direction"
}
```

### 6.3 Ví dụ Output

**Input:** void_anchor=knowledge, moral_core=determination, soul_fragment="sự thật — dù nó đau đến đâu", high patience, high confidence

```json
{
  "archetype": "seeker",
  "name": "Vết Nứt Sự Thật",
  "description": "Nhìn thấy một 'vết nứt' trong hiện thực khi ai đó che giấu điều gì đó quan trọng.",
  "category": "perception",
  "mechanic": "Khi đối diện với lời nói hoặc tình huống, cảm nhận được 'vết nứt' — dấu hiệu sự thật bị che giấu. Không cho biết sự thật là gì, chỉ cho biết NÓ TỒN TẠI.",
  "domain_passive": {
    "name": "Linh Giác Nứt Vỡ",
    "mechanic": "Tín hiệu mờ khi gần nguồn deception — tăng 5% phát hiện nói dối"
  },
  "limitation": "Chỉ hoạt động khi thực sự muốn biết sự thật (không thể spam). Cooldown: 3 chương.",
  "weakness_type": "resonance_dependency",
  "weakness": "Không phân biệt được sự thật nguy hiểm vs vô hại — đôi khi biết sự thật là sai lầm.",
  "unique_clause": "Nhìn xuyên qua concealment/deception cấp thấp — thứ Normal Skill không thể detect",
  "activation_condition": "Khi trực tiếp đặt câu hỏi với ý định tìm sự thật.",
  "activation_cost": "Đau đầu dữ dội 1 giờ sau khi dùng — càng nhiều sự thật càng đau.",
  "soul_resonance": "Linh hồn này chọn giữ lại 'sự thật' khi mọi thứ bị nung chảy. Khao khát biết chân tướng mạnh đến mức hư vô cũng không xóa được.",
  "trait_tags": ["mind", "relic", "perception"],
  "evolution_hint": "Nếu kiên trì tìm sự thật dù đau — vết nứt có thể mở rộng thành cửa sổ."
}
```

**Input:** void_anchor=connection, moral_core=sacrifice, soul_fragment="gia đình tôi", high impulsivity, high expressiveness

```json
{
  "archetype": "catalyst",
  "name": "Sợi Dây Bất Diệt",
  "description": "Tạo liên kết vô hình với 1 người, cảm nhận được khi họ trong nguy hiểm.",
  "category": "contract",
  "mechanic": "Đánh dấu 1 người (NPC hoặc player) bằng 'Sợi Dây'. Khi họ bị đe dọa nghiêm trọng, cảm nhận được hướng và mức độ nguy hiểm. Chỉ active với 1 người cùng lúc.",
  "domain_passive": {
    "name": "Sợi Tơ Hiệp Ước",
    "mechanic": "Tự động cảm nhận khoảng cách và hướng của người được đánh dấu — passive, luôn bật"
  },
  "limitation": "Phải tiếp xúc trực tiếp để đánh dấu. Chuyển sang người khác → mất liên kết cũ. Cooldown chuyển: 10 chương.",
  "weakness_type": "target_paradox",
  "weakness": "Khi người được đánh dấu phản bội — sợi dây trở thành vũ khí: cảm nhận nỗi đau của họ liên tục.",
  "unique_clause": "Truyền cảm xúc qua sợi dây — thứ Normal Skill không thể làm vì không tạo được liên kết cảm xúc sâu",
  "activation_condition": "Khi thực sự quan tâm đến sự an toàn của ai đó.",
  "activation_cost": "Sợi dây hút 1 phần sinh lực — mệt mỏi và nhức đầu nhẹ khi duy trì liên kết lâu.",
  "soul_resonance": "Linh hồn này bám vào 'gia đình' như tia sáng cuối cùng. Nỗi sợ mất kết nối biến thành năng lực — nhưng cũng là gánh nặng.",
  "trait_tags": ["oath", "charm", "contract"],
  "evolution_hint": "Nếu giữ sợi dây với cùng 1 người qua 50 chương — sợi dây có thể truyền được nhiều hơn cảnh báo."
}
```

---

## 7. Uniqueness Verification

### 7.1 DB Check

Trước khi finalize skill, kiểm tra uniqueness:

```python
# Step 1: Name check (exact match)
existing = db.query("SELECT name FROM unique_skills WHERE name = ?", skill.name)
if existing:
    regenerate()

# Step 2: Mechanic similarity check (semantic)
embedding = embed(skill.mechanic + skill.description)
similar = db.vector_search(embedding, threshold=0.85, top_k=5)
if similar:
    regenerate_with_constraint(avoid_similar=similar)

# Step 3: Final uniqueness score
uniqueness_score = 1.0 - max_similarity
if uniqueness_score < 0.15:
    regenerate()  # Quá giống skill đã tồn tại
```

### 7.2 Regeneration Strategy

Nếu skill quá giống (1-3 lần retry):

1. **Retry 1:** "Skill này quá giống {similar_skill.name}. Hãy tạo skill với cơ chế HOÀN TOÀN KHÁC, vẫn dựa trên cùng soul data."
2. **Retry 2:** Thêm random "chaos factor" — inject 1 trait_tag ngẫu nhiên
3. **Retry 3:** Cho phép AI phá vỡ 1 quy tắc category (ví dụ: perception nhưng có yếu tố manipulation)

**Tối đa 3 retries.** Nếu vẫn thất bại → accept skill + append số thứ tự (cực hiếm, <0.1% cases).

---

## 8. Lore Integration

### 8.1 The Void Between

**Vị trí trong lore:** The Void Between là không gian giữa các thế giới. Khi The Veiled Will kéo linh hồn từ Earth vào Amoisekai, linh hồn phải đi qua đây.

- Ký ức bị TẠM XÓA trong The Void (bản chất thuần khiết bộc lộ khi không có ký ức)
- Nhưng ký ức **QUAY LẠI HOÀN TOÀN** sau khi tỉnh dậy ở Aelvyndor
- **Bản chất** (core identity) không thể xóa — đây là nguyên liệu rèn skill
- The Void "thử" linh hồn — và từ phản ứng của linh hồn, **skill kết tinh**
- Ký ức cũ (gia đình, bạn bè, cuộc sống) CÓ THỂ trở thành nguồn cảm xúc — nhưng không bắt buộc

### 8.2 Narrative Transition

```
Soul Forge kết thúc
        ↓
"Lửa tắt. Bạn cảm nhận thứ gì đó mới — sâu trong lồng ngực,
 như nhịp tim thứ hai. Bạn không biết nó là gì.
 Nhưng nó là CỦA BẠN."
        ↓
→ NARRATIVE_REBORN_SPEC: Chapter 1 Awakening
```

Skill **KHÔNG được reveal** ngay. Player chỉ cảm nhận "thứ gì đó". Skill lần đầu manifest ở Chapter 2-3 khi gặp tình huống trigger.

---

## 9. UI/UX Flow

### 9.1 Visual Design

| Giai đoạn | Visual | Audio (nếu có) |
|-----------|--------|---------|
| Scene 1-2 | Nền đen, text trắng, particle nhẹ | Ambient drone |
| Scene 3-4 | Nền bắt đầu nứt, ánh sáng lọt qua | Tension build |
| Soul Fragment | Gold glow, khung viết đẹp | Piano nhẹ |
| Scene 5 (Forge) | Lửa animation, text chạy | Climax sound |

### 9.2 Mobile-First Design

```
┌─────────────────────────┐
│                         │
│   [Narrative text area] │
│   (scroll if needed)    │
│                         │
│─────────────────────────│
│                         │
│   ┌─────────────────┐   │
│   │   Choice A      │   │
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │   Choice B      │   │
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │   Choice C      │   │
│   └─────────────────┘   │
│                         │
└─────────────────────────┘
```

### 9.3 Timing Tracking (Ẩn)

```javascript
// Phase 3 behavioral tracking
const sceneStartTime = Date.now();
let hoverCount = 0;

choiceButtons.forEach(btn => {
  btn.addEventListener('mouseenter', () => hoverCount++);
  btn.addEventListener('click', () => {
    const responseTime = Date.now() - sceneStartTime;
    behavioral.pushSignal({
      scene: currentScene,
      responseTime,
      hoverCount,
      choiceIndex: btn.dataset.index
    });
  });
});
```

---

## 10. Data Model

### 10.1 SoulForgeSession (trong quá trình onboarding)

```python
class SoulForgeSession(BaseModel):
    """Temporary session data during Soul Forge process."""
    
    session_id: str
    user_id: str
    started_at: datetime
    
    # Phase 1: Micro-Narrative
    scene_choices: list[SceneChoice] = []  # 4-5 entries
    scene_path: list[int] = []             # branch path taken
    
    # Phase 2: Soul Fragment
    soul_fragment_raw: str = ""
    soul_fragment_themes: list[str] = []
    soul_fragment_emotion: str = ""
    soul_fragment_target: str = ""
    
    # Phase 3: Behavioral Fingerprint
    behavioral: BehavioralFingerprint = BehavioralFingerprint()
    
    # Derived
    identity_signals: IdentitySignals | None = None
    
    # Result
    forged_skill: UniqueSkill | None = None
    forge_attempts: int = 0  # retry count for uniqueness

class SceneChoice(BaseModel):
    scene_id: int
    variant: str = ""           # which variant was shown
    choice_index: int
    choice_text: str = ""
    response_time_ms: int = 0   # behavioral signal
    hover_count: int = 0        # behavioral signal
    signal_tags: dict = {}      # extracted signals

class BehavioralFingerprint(BaseModel):
    decisiveness: float = 0.5
    deliberation: float = 0.5
    expressiveness: float = 0.5
    confidence: float = 0.5
    patience: float = 0.5
    consistency: float = 0.5
    impulsivity: float = 0.5
    revision_tendency: float = 0.5
```

### 10.2 UniqueSkill (mở rộng model hiện tại)

```python
class UniqueSkill(BaseModel):
    # === Existing fields ===
    name: str = ""
    description: str = ""
    category: str = ""
    trait_tags: list[str] = []
    countered_by: list[str] = []
    resilience: float = 100.0
    instability: float = 0.0
    is_revealed: bool = False
    activation_cost: str = ""
    
    # === New Soul Forge fields ===
    mechanic: str = ""                  # Chi tiết cơ chế hoạt động
    limitation: str = ""                # Giới hạn cụ thể
    weakness: str = ""                  # Điểm yếu gắn với bản chất
    activation_condition: str = ""      # Trigger condition
    soul_resonance: str = ""            # Vì sao skill thuộc về player
    evolution_hint: str = ""            # Ẩn — AI dùng cho evolution sau này
    uniqueness_score: float = 1.0       # 0-1, đo mức unique vs DB
    forge_timestamp: datetime | None = None
    
    # === V2 fields (Unique Skill System V2) ===
    unique_clause: str = ""             # What Normal Skill can't do
    sub_skills: list[SubSkill] = Field(default_factory=list)
    domain_category: str = ""           # Same as category
    domain_passive_name: str = ""       # SS0 name
    domain_passive_mechanic: str = ""   # SS0 effect
    weakness_type: str = ""             # 1 of 7 taxonomy
    axis_blind_spot: str = ""           # Structural category weakness
    current_stage: str = "seed"         # seed | bloom | aspect | ultimate
```

---

## 11. Technical Implementation Notes

### 11.1 Scene Storage

Scenes 1-2 = **hard-coded** (pre-written Vietnamese text + choices)  
Scenes 3-4 = **AI-generated** per session (dùng context từ 1-2)  
Scene 5 = **template + AI summary** (tóm tắt hành trình)

### 11.2 Cost Estimate

| Step | Model | Tokens | Cost |
|------|-------|--------|------|
| Scene 3 generation | Gemini 2.5 Flash | ~500 in + 300 out | ~$0.0004 |
| Scene 4 generation | Gemini 2.5 Flash | ~700 in + 300 out | ~$0.0005 |
| Scene 5 summary | Gemini 2.5 Flash | ~400 in + 200 out | ~$0.0003 |
| Soul Fragment parse | Gemini 2.5 Flash | ~300 in + 100 out | ~$0.0002 |
| Skill generation | Gemini 2.5 Flash | ~1500 in + 500 out | ~$0.001 |
| Uniqueness retry (×1) | Gemini 2.5 Flash | ~1500 in + 500 out | ~$0.001 |
| **Total per player** | | | **~$0.003** |

### 11.3 API Endpoints

```
POST /api/soul-forge/start              → Tạo session, trả Scene 1
POST /api/soul-forge/choice             → Submit choice + behavioral data, trả scene tiếp
POST /api/soul-forge/advance            → Advance qua Scene 5, generate AI summary
POST /api/soul-forge/fragment           → Nhận free-text soul fragment
POST /api/soul-forge/forge              → Trigger skill generation, trả player + skill
GET  /api/soul-forge/status/{session_id} → Trạng thái session hiện tại
```

### 11.4 Fallback

Nếu AI fail (timeout, error):
- Scene 3-4: Sử dụng pre-written generic scene (kém hay hơn nhưng functional)
- Skill generation: `create_seed_from_quiz_sync` fallback (dùng Phase 1 signals thay quiz answers)

---

## 12. Migration từ hệ thống cũ

### 12.1 Backward Compatibility

- Player cũ (đã qua quiz): **KHÔNG buộc làm lại**
- Có option "Tái rèn linh hồn" (Soul Reforge) — optional, 1 lần duy nhất

### 12.2 Data Migration

```python
# Quiz answers → Soul Forge session (cho player cũ muốn reforge)
def migrate_quiz_to_forge(quiz_answers: dict) -> SoulForgeSession:
    """Pre-fill Phase 1 signals from old quiz data."""
    session = SoulForgeSession()
    # Map old quiz → approximate signals
    session.identity_signals = approximate_from_quiz(quiz_answers)
    # Still require Phase 2 (soul fragment) + Phase 3 (behavioral)
    return session
```

---

## 13. KPIs & Success Metrics

| Metric | Mục tiêu | Đo bằng |
|--------|---------|---------|
| Completion rate | > 80% player hoàn thành Soul Forge | session completed / session started |
| Time to complete | 4-8 phút | avg session duration |
| Uniqueness rate | > 99% skills unique lần đầu | forge_attempts = 1 / total |
| Player attachment | > 70% nhớ tên skill sau 7 ngày | survey / behavior |
| Drop-off point | < 15% drop ở bất kỳ scene nào | scene completion funnel |

---

## Appendix: Decisions

| Câu hỏi | Quyết định | Lý do |
|----------|-----------|-------|
| Bao nhiêu scenes? | 5 (3 fixed + 2 AI-gen) | Đủ depth, không quá dài |
| Free-text bao nhiêu câu? | 1 | Focus > quantity |
| Behavioral tracking có ethical? | Có — chỉ lưu abstract vector | Không lưu raw input |
| Skill reveal ngay? | Không — manifest ở Ch.2-3 | Build anticipation |
| Player cũ buộc reforge? | Không — optional | Respect existing players |
| Soul Reforge khi nào? | Sau chapter 5+ | Đủ identity drift data |

---

## 14. Soul Reforge — "Thợ Rèn Linh Hồn" (In-Game Skill Re-generation)

> **Status:** Planned (chưa implement)  
> **Priority:** Medium — sau khi AI Forge hoạt động ổn

### 14.1 Concept

Sau khi vào game, player có cơ hội **rèn lại skill** tại một NPC đặc biệt. Skill mới phản ánh **identity hiện tại** (đã thay đổi qua câu chuyện), không phải identity ban đầu từ Soul Forge.

> *"Ta là Lão Thợ Rèn. Ta đã rèn hàng ngàn linh hồn. Nhưng chưa ai quay lại như ngươi. Ngươi muốn rèn lại ư? Hãy nhớ — lần này, linh hồn ngươi đã khác."*

### 14.2 Unlock Conditions

| Điều kiện | Chi tiết |
|-----------|----------|
| **Chapter tối thiểu** | Chapter 5+ (đủ identity drift data) |
| **Trigger** | NPC "Thợ Rèn Linh Hồn" xuất hiện trong narrative khi đủ điều kiện |
| **Giới hạn** | **1 lần / story** — không spam, quyết định phải có trọng lượng |

### 14.3 Cost

Một trong hai lựa chọn (tùy monetization strategy):

| Option | Cost | Phù hợp khi |
|--------|------|-------------|
| **A. Crystal** | 1 Crystal (premium currency) | Monetization-focused |
| **B. Side Quest** | Hoàn thành quest NPC đưa ra | Gameplay-focused |
| **C. Hybrid** | Quest miễn phí HOẶC Crystal skip | Cân bằng cả hai |

> [!TIP]
> Option C recommended — player free vẫn access được qua quest, player trả tiền skip nhanh.

### 14.4 AI Re-generation Mechanic

Khi player reforge, AI nhận **identity hiện tại** thay vì identity ban đầu:

```
Input cho AI Reforge:
┌─────────────────────────────────────────┐
│  Original Soul Forge signals            │ ← reference
│  + Current identity state:              │
│    - Archetype (có thể đã thay đổi)    │
│    - DQS score hiện tại                │
│    - Instability level                  │
│    - Personality traits sau N chapters  │
│    - Key choices player đã đưa ra      │
│    - Breakthrough/Confrontation events  │
│  + Instruction: "Skill mới phải KHÁC   │
│    skill cũ nhưng phản ánh evolution"   │
└─────────────────────────────────────────┘
```

**Key insight:** Skill reforge phản ánh player đã **thay đổi bao nhiêu** so với lúc đầu:
- Player ít thay đổi → skill mới tương tự nhưng tinh chỉnh
- Player thay đổi nhiều → skill mới có thể hoàn toàn khác category

### 14.5 Lore Integration

```
Player gặp NPC Thợ Rèn Linh Hồn
        ↓
NPC nhận xét về sự thay đổi của player
  "Linh hồn ngươi... đã khác rồi. Lửa cũ đã tắt,
   nhưng ta thấy lửa mới — mạnh hơn, hoặc nguy hiểm hơn."
        ↓
Player chọn: Rèn lại / Giữ nguyên
        ↓
[Nếu rèn lại] → Cinematic sequence (ngắn hơn Soul Forge)
        ↓
AI generate skill mới → Replace skill cũ
        ↓
"Kỹ năng cũ '{old_skill}' tan biến. Từ tro tàn,
 '{new_skill}' thức tỉnh."
```

### 14.6 Restrictions & Edge Cases

| Rule | Lý do |
|------|-------|
| 1 lần / story | Tránh spam, quyết định có trọng lượng |
| Không rollback | Sau khi reforge, không lấy lại skill cũ |
| Skill cũ → lore reference | Story vẫn nhắc đến skill cũ như "ký ức đã mất" |
| Level reset | Skill mới bắt đầu từ seed level (fair balance) |

### 14.7 Implementation Notes (khi ready)

```
# Files cần modify:
- app/models/player.py     → thêm reforge_count, reforge_history
- app/routers/soul_forge.py → thêm POST /api/soul-forge/reforge
- app/narrative/planner.py  → NPC trigger logic
- web/main.js              → reforge UI flow
```
