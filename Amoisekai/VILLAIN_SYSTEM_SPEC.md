# AMOISEKAI — Villain System Spec v1.0

> **Author:** Amo
> **Date:** 2026-02-28
> **Status:** Draft — Pre-implementation
> **Dependencies:** ENEMY EMPIRE ARCHITECTURE v1, IDENTITY INSTABILITY SYSTEM v1, IDENTITY MUTATION WITH AGENCY v1, COSMIC THREAT ARCHITECTURE, IDENTITY TRANSFORMATION ARCHITECTURE v1
> **Deferred dependency:** CONSEQUENCE_ROUTER_SPEC (chỉ cần từ Sprint 4+ — General encounter consequences)

> *Villain không phải kẻ ác — villain là gương phản chiếu Identity của player.*
> *Mỗi encounter với villain là một cuộc đối thoại với phiên bản "đi lệch đường" của chính mình.*

---

## 1. Triết Lý Thiết Kế

### Nguyên tắc cốt lõi

Amoisekai xây dựng trên triết lý **Balanced Dual Force**: Identity = f(Choice, Pressure, Echo). Villain là nguồn tạo **External Pressure có chủ ý và nhất quán nhất** trong thế giới — không phải tai nạn, không phải thiên tai, mà là một ý chí đối lập có hệ thống triết học riêng.

**5 nguyên tắc không thể vi phạm:**

1. **Villain luôn "đúng" theo logic của họ** — players phải tranh luận, không chỉ đánh
2. **Mỗi villain là Archetype Counterpart** — gặp villain = gặp phiên bản drift của chính mình
3. **Boss encounter = Identity Checkpoint** — không phải combat checkpoint
4. **Villain philosophy có thể chiêu dụ player** — gia nhập Empire là lựa chọn hợp lệ
5. **Không có kẻ ác tuyệt đối** — morally gray universe, Empire có logic riêng đáng hiểu

### Villain là gì trong narrative pipeline?

```
Player Identity (Seed)
        │
        │ External Pressure (từ villain)
        ↓
  Identity Drift
        │
        │ nếu đủ mạnh → Narrative Confrontation Event
        ↓
  Player Agency (Chấp nhận / Từ chối / Con đường thứ ba)
        │
        ↓
  Identity Mutation hoặc Identity Anchor
```

Villain không chỉ gây combat — villain là **tác nhân kích hoạt Identity Confrontation Events**.

---

## 2. Phân Loại 3 Lớp Villain

### Tổng quan

| Lớp | Tên | Empire Tier | Số lượng Phase 1 | Vai trò chính |
|---|---|---|---|---|
| A | Emissary (Sứ giả) | Tier 1-2 | 3 nhân vật | Dẫn dắt, thao túng, mời gia nhập |
| B | General (Tướng lĩnh) | Tier 3 | 4 nhân vật | Archetype Counterpart, arc lớn |
| C | The Veiled Will | Tier 4-5 | 1 entity (3-phase reveal) | Cosmic truth, final revelation |

---

## 3. Lớp A — EMISSARY (Sứ giả Đế chế)

### Định nghĩa

Emissary không xuất hiện như kẻ thù. Họ đóng vai **đồng minh, cố vấn, hoặc người thân tín** trong 3-5 chapters đầu. Sau đó lộ ra là tay trong của Empire — hoặc không bao giờ lộ ra nếu player không đủ điều kiện trigger reveal.

### Cơ chế hidden tracking

Mỗi interaction với Emissary cộng điểm vào `sympathy_score` (ẩn, player không thấy):

```python
class EmissaryInteraction(BaseModel):
    emissary_id: str
    chapter_id: str
    interaction_type: Literal[
        "agreed_with_logic",       # +15 sympathy
        "showed_understanding",    # +8 sympathy
        "neutral_response",        # +0
        "mild_disagreement",       # -5 sympathy
        "strong_rejection",        # -15 sympathy, +10 identity_anchor
    ]
    sympathy_delta: int
    empire_resonance_delta: int
```

### Reveal triggers

| `sympathy_score` | Sự kiện |
|---|---|
| < 20 | Emissary không reveal (giữ role bình thường) |
| 20-49 | Emissary gửi tín hiệu mơ hồ (prose hints, "có vẻ như biết nhiều hơn") |
| 50-79 | Emissary reveal thân phận trong một tình huống crisis, đề nghị hợp tác |
| ≥ 80 | Emissary chủ động mời player gia nhập Empire, giải thích toàn bộ mục tiêu |

### 3 nhánh sau reveal

```
EMISSARY REVEAL
│
├─ [Từ chối / Phản bội] ──→ Combat encounter (mini-boss)
│                            + "Emissary's Last Words" — lời nói có thể ám ảnh sau này
│                            + identity_anchor += 10
│
├─ [Chấp nhận hợp tác]  ──→ Empire Route mở partial
│                            + empire_resonance spike (+20)
│                            + Emissary trở thành NPC đặc biệt (có thể quest)
│
└─ [Giả vờ đồng ý]      ──→ Double-agent path
                             + Narrative tracking "unresolved_allegiance = true"
                             + Future chapters bị ảnh hưởng (NPC doubt, General cảnh giác)
```

### 3 Emissary cụ thể cho Phase 1

**Emissary Kaen** — xuất hiện như thương nhân/thám tử tìm artifact, thực ra là tình báo Empire
- Philosophy: *"Hòa bình thật sự cần một kẻ đủ mạnh để áp đặt nó"*
- Sympathy trigger chính: khi player chứng kiến chaos từ faction wars

**Emissary Sira** — xuất hiện như healer/sage, thực ra là người nghiên cứu Unique Skills cho Empire
- Philosophy: *"Năng lực mà không được kiểm soát sẽ hủy hoại người sở hữu nó"*
- Sympathy trigger chính: khi player gặp Instability từ identity drift

**Emissary Thol** — xuất hiện như chiến binh trung lập, thực ra là người bảo vệ Inner Circle đang quan sát player
- Philosophy: *"Một kẻ đủ mạnh không cần phải chọn phe — chỉ cần chọn survival"*
- Sympathy trigger chính: khi player thất bại nặng nề hoặc mất đồng minh

---

## 4. Lớp B — GENERAL (Tướng lĩnh Vùng)

### Nguyên tắc Archetype Counterpart

Mỗi General là **phiên bản "đi lệch đường"** của một archetype player. Gặp General tương ứng archetype của mình = gặp cảnh báo từ tương lai. Gặp General khác archetype = học được một góc nhìn đối lập.

**Bảng đối chiếu Archetype — General:**

> *4 Generals cover 6 archetypes. Một số General thách thức 2 archetype khác nhau, nhưng từ góc độ triết lý khác nhau. (Xem PHASE1_ADAPTIVE_ENGINE — Villain Assignment System cho chi tiết.)*

| Archetype Player | General | Triết lý đối lập | Cơ chế đặc trưng |
|---|---|---|---|
| Vanguard (đối diện trực tiếp) | **General Vorn — "Người Xây Lại"** | *"Phá vỡ mà không xây lại chỉ là phá hoại."* | Stability Test — đánh vào mục đích đằng sau hành động |
| Catalyst (thay đổi môi trường) | **General Vorn — "Người Xây Lại"** | *"Anh tạo chaos và gọi nó là tiến hóa. Tiến hóa có hướng."* | Stability Test — đánh vào hướng đi của thay đổi |
| Sovereign (ảnh hưởng con người) | **General Azen — "Kẻ Hy Sinh"** | *"Hy sinh số ít là đạo đức. Cảm xúc cá nhân là xa xỉ phẩm."* | Forced Choice — buộc player chọn ai sống giữa 2 NPC họ đã gặp |
| Seeker (khai thác bí ẩn) | **General Mireth — "Người Lạnh"** | *"Tri thức không có quyền năng là triết học. Chỉ có Applied Truth mới tồn tại."* | Memory Suppression — xóa một phần story_summary của player khỏi context |
| Tactician (thao túng cục diện) | **General Kha — "Bàn Tay Trật Tự"** | *"Tự do lựa chọn của anh — anh đã dùng nó để loại bỏ tự do của người khác."* | Tạo Anti-Free Zone — mọi free_input bị chuyển về predefined choices |
| Wanderer (sống ngoài hệ thống) | **General Kha — "Bàn Tay Trật Tự"** | *"Tự do là ảo tưởng. Chỉ có kết quả tồn tại."* | Tạo Anti-Free Zone — phủ nhận giá trị cốt lõi của tự do |

### Multi-phase Encounter Structure

Mỗi General encounter diễn ra trong **3 phases không thể skip**:

```
PHASE 1 — CONFRONTATION (1-2 chapters)
──────────────────────────────────────────
General xuất hiện, không combat ngay.
Thách thức world-view của player qua dialogue.
Mỗi response của player được track:
  - "agreed" / "understood" → sympathy delta
  - "rejected with reason" → identity_anchor delta
  - "avoided / deflected" → tension_unresolved = true

PHASE 2 — DEMONSTRATION (1 chapter)
──────────────────────────────────────────
General không nói thêm. Họ hành động.
Narrative cho player CHỨNG KIẾN General làm điều trái với giá trị player
nhưng theo logic của General, nó là đúng đắn.
Không có lựa chọn can thiệp — chỉ chứng kiến.
Player phải xử lý: "Tôi hiểu tại sao họ làm vậy, nhưng tôi có đồng ý không?"

PHASE 3 — RESOLUTION (1 chapter)
──────────────────────────────────────────
3 nhánh tùy vào tích lũy từ Phase 1-2:
  A) Combat (default nếu player reject liên tục)
  B) Alliance offer (nếu empire_resonance > 50)
  C) Escape / Stalemate (nếu player né tránh)
```

### Resolution outcomes

**A) Victory (Combat)**
```
Kết quả:
  + "General's Philosophy Rejected" seal
  + identity_anchor += 20
  + General's Last Words: 1 câu nói player không thể gỡ khỏi story context
  + Một seed of doubt: prose sau này thỉnh thoảng echo lại argument của General

Quan trọng:
  Không triumphant.
  Không phải "kẻ ác bị đánh bại".
  General có thể chết với dignity hoặc rút lui.
  Narrative cần cho player cảm thấy: "Tôi thắng, nhưng tôi chưa chắc mình đúng."
```

**B) Alliance (Empire Route)**
```
Kết quả:
  + "General's Philosophy Absorbed" marker
  + empire_resonance += 30
  + Unlock Empire faction quests liên quan đến General đó
  + Old faction memories trở thành "regret echoes"
  + Unique Skill bắt đầu drift về hướng Empire alignment

Quan trọng:
  Player không mất Unique Skill — nó transform.
  Ví dụ: "Scepter of Protection" → "Scepter of Necessary Sacrifice"
  Cùng skill, khác triết lý vận hành.
```

**C) Escape / Stalemate**
```
Kết quả:
  + "Unresolved Tension" marker (permanent)
  + General nhớ player — xuất hiện lại ở arc sau
  + Mỗi lần re-encounter, General có thêm argument mới (học từ lần trước)
  + tension_unresolved tích lũy ảnh hưởng identity_coherence
```

---

## 5. EMPIRE RESONANCE SYSTEM

### Hidden tracking axes

```python
# Villain fields — MERGED vào WorldState (app/models/world_state.py)
# Không tạo class VillainState riêng — reuse WorldState đã có EmissaryStatus + GeneralStatus.

class WorldState(BaseModel):
    # ... existing fields (emissary_status, general_status, tower, world_flags) ...
    # ... existing force taxonomy fields ...

    # ── Villain Resonance System ──
    empire_resonance: int = 0          # 0-100
    identity_anchor: int = 0           # 0-100
    empire_allegiance: Literal["none", "sympathizer", "agent", "defector"] = "none"
    empire_route_unlocked: bool = False

    # Active villain tracking
    active_general: str = ""           # General đang "săn" player
    unresolved_tensions: list[str] = []# General IDs có stalemate

    # Cosmic arc
    veiled_will_phase: int = 0         # 0=hidden, 1=calamity, 2=pattern, 3=revelation
                                       # (replaces world_flags["veiled_will_signal_detected"])

    # Sympathy tracking per Emissary (extend EmissaryStatus với sympathy_score)
    # → EmissaryStatus gets: sympathy_score: int = 0

    # Philosophy tracking
    absorbed_arguments: list[str] = []
    rejected_arguments: list[str] = []
```

> **Implementation note:** `EmissaryStatus` mở rộng thêm `sympathy_score: int = 0` và `allegiance_offered: bool = False`. `GeneralStatus` mở rộng thêm `encounter_phase: int = 0`, `resolution: str = "pending"`, `philosophy_absorbed: bool = False`, `last_words: str = ""`. Không cần separate `VillainState` class.

### Threshold Events

Các sự kiện tự động trigger theo `empire_resonance`:

| Threshold | Sự kiện narrative |
|---|---|
| ≥ 20 | Narrator prose đôi khi dùng Empire terminology một cách tự nhiên |
| ≥ 30 | Empire NPCs treat player với visible respect (không giải thích tại sao) |
| ≥ 50 | General Alliance offer xuất hiện dù Phase 1 chưa đủ điều kiện |
| ≥ 60 | Some non-Empire factions bắt đầu doubt player loyalty |
| ≥ 70 | Unique Skill bắt đầu có Empire aesthetic (lore description thay đổi) |
| ≥ 80 | Empire Route unlock — alternative story branch mở |
| ≥ 90 | Player trở thành "Empire Agent" — narrative fork không thể revert |

Các sự kiện tự động trigger theo `identity_anchor`:

| Threshold | Sự kiện narrative |
|---|---|
| ≥ 30 | Player có thêm dialogue option "Absolute Conviction" trong villain encounters |
| ≥ 50 | Generals coi player là priority target — encounters khó hơn, phức tạp hơn |
| ≥ 70 | Unique Skill crystallizes — identity_coherence không thể drop dưới 40 |
| ≥ 90 | Unlock "The Unbending" — unique narrative title, affects how world perceives player |

### Balance Mechanic: Tension giữa 2 axes

`empire_resonance` và `identity_anchor` **không triệt tiêu nhau hoàn toàn** — chúng tạo ra **tension zone**:

```
empire_resonance 40-60 + identity_anchor 40-60 = "The Gray Zone"
→ Trạng thái không ổn định nhất
→ Narrative Confrontation Events xảy ra thường xuyên hơn
→ Đây là nơi story phong phú nhất — player đang thực sự vật lộn
→ Context Weight Agent biết đây là "critical identity moment"
```

---

## 6. VILLAIN-TRIGGERED IDENTITY MUTATIONS

### Kết nối với IDENTITY MUTATION WITH AGENCY

Villain encounters là **trigger chính cho Narrative Confrontation Events** (định nghĩa trong IDENTITY MUTATION WITH AGENCY spec). Sau encounter với General, nếu conditions đủ, AI sẽ generate một chapter đặc biệt:

```
Narrative Confrontation Event (villain-triggered):
  - Nhân vật đối diện bản thân qua gương / ảo ảnh / giấc mơ
  - Hình ảnh của General xuất hiện như "phiên bản tương lai có thể có"
  - Player phải chọn: Chấp nhận drift / Từ chối / Tìm con đường thứ ba
```

### 3 Villain-specific Mutations

**Mutation 1: "The Mirror Crack"**
```
Trigger: Đánh bại General nhưng empire_resonance vẫn tăng sau encounter
         (Player hiểu logic General dù từ chối)

Effect:
  - Một core value trong Identity Seed bị đánh dấu "questioned"
  - Future choices liên quan đến value đó xuất hiện với undertone khác trong prose
  - Context Weight Agent biết: "player đang uncertain về giá trị này"

Narrative signal (không UI):
  > "Lưỡi kiếm trong tay người phải chăng là cái đúng? Hay chỉ là cái cần thiết?"
  > (narrator nhẹ nhàng plant doubt vào prose)

Reversible: Có, qua Re-alignment Arc (đối diện sai lầm, giữ lời hứa lớn)
```

**Mutation 2: "The Conversion"**
```
Trigger: empire_resonance ≥ 80, player chọn Empire Alliance

Effect:
  - protagonist title thay đổi trong narrative (subtle — không thông báo)
  - Unique Skill không mất — transform về Empire alignment
    VD: "Veil of Shadows" → "Veil of Dominion" (cùng mechanic, khác lore)
  - Old faction memories xuất hiện như "regret echoes" trong prose
  - New skill category unlock: Empire-exclusive abilities

Narrative signal:
  > Không còn là "kẻ lữ hành". Giờ là "người mang sứ mệnh."
  > Không có thông báo. Narrator đơn giản gọi bằng title mới.

Reversible: Rất khó. Cần "Defector Arc" — betray Empire, bear consequences
```

**Mutation 3: "The Resistant"**
```
Trigger: identity_anchor ≥ 70, reject tất cả General encounters

Effect:
  - Identity crystallizes (coherence floor tăng)
  - Unlock "Absolute Conviction" dialogue options
  - Generals nhận ra player là core threat → encounters become harder
  - Prose bắt đầu reflect "unbending determination" trong mô tả hành động

Narrative signal:
  > Không còn lưỡng lự. Không còn câu hỏi. Chỉ có hướng đi.
  > (narrator mô tả hành động với certainty cao hơn)

Reversible: Không — nhưng không phải bất lợi, chỉ là một con đường cụ thể
```

---

## 7. "THE VEILED WILL" — Cosmic Villain Arc

### Phase reveal integration với villain system

The Veiled Will không xuất hiện như villain rõ ràng — nó được reveal qua **accumulated patterns**. Villain system là một trong những kênh gieo hạt pattern đó:

**Phase 1 — The Calamity (hidden seeds qua villain system):**
```
- General arguments đôi khi reference "a greater collapse coming"
- Emissary Sira nghiên cứu Instability vì "something external amplifies it"
- Khi player có empire_resonance >= 30, một General tiết lộ:
  "Đế chế không tấn công vì muốn quyền lực. Chúng ta tấn công vì thế giới đang hấp hối."
- Fate Buffer glitches tăng tần suất khi villain encounters xảy ra gần đó
```

**Phase 2 — Pattern Recognition:**
```
- Player (nếu là Strategist archetype) bắt đầu thấy: Empire biết quá nhiều về Fate Buffer
- General Kha bị hỏi về nguồn gốc Empire → lần đầu tiên hesitant
- Emissary Sira's research notes (nếu player tìm được): reference "the Primordial Monitor"
- Empire không tấn công Fate Buffer nodes — họ bảo vệ chúng
  (Player nhận ra: Enemy và Buffer có quan hệ kỳ lạ)
```

**Phase 3 — The Revelation:**
```
Chỉ reveal trong endgame của Season 1.
The Veiled Will không phải entity muốn phá hủy — nó muốn điều chỉnh.
Fate Buffer là một phần của hệ thống nó tạo ra.
Empire biết điều này — và đang cố ngăn reveal bằng cách kiểm soát thế giới trước.

Moral complexity tối đa:
  - Empire "đúng" về threat (The Veiled Will thật)
  - Empire "sai" về phương pháp (kiểm soát không phải giải pháp)
  - Player phải chọn: Chiến đấu cả 2 / Chọn 1 phe / Tìm con đường thứ ba
```

### Personality fragments của The Veiled Will

Scattered qua story như background anomalies — player không nhận ra ngay:

```
Loại 1: Narrator voice anomalies
  → Thỉnh thoảng trong prose, có 1 câu mô tả như "ai đó bên ngoài câu chuyện đang nhìn vào"
  → VD: "Bầu trời đêm đó — như thể nó ghi nhớ điều gì đó."

Loại 2: Item descriptions
  → Một số artifact có description không giải thích được:
  → "Vật này không thuộc về kỷ nguyên này. Có lẽ không thuộc về thế giới này."

Loại 3: NPC dialogue
  → Một số NPC nói câu không liên quan đến context, nhưng sau này có ý nghĩa:
  → "Cháu à, đừng bao giờ hỏi tại sao bầu trời có màu xanh. Có những thứ tốt hơn là không biết."

Loại 4: Fate Buffer glitches
  → Khi Fate Buffer activate, prose mô tả:
  → "Trong khoảnh khắc đó, anh thoáng thấy... một cái gì đó nhìn lại từ phía bên kia."
```

---

## 8. DATA MODELS

### Pipeline State additions

```python
# NarrativeState (Pydantic BaseModel — app/models/pipeline.py)
class NarrativeState(BaseModel):
    # ... existing fields ...
    active_villain: str = ""            # villain_id đang active trong chapter này
    villain_context: str = ""           # summary về villain encounters để feed vào LLM

# PipelineState (TypedDict — app/narrative/pipeline.py, dùng cho LangGraph)
class PipelineState(TypedDict):
    # ... existing fields ...
    active_villain: str
    villain_context: str
```

> **Note:** Villain tracking data (empire_resonance, identity_anchor, encounters) nằm trong `WorldState`, không trong NarrativeState. NarrativeState chỉ carry per-chapter villain context cho LLM.

### Encounter/Interaction Models (trong `app/models/world_state.py`)

```python
class GeneralEncounter(BaseModel):
    general_id: str
    phase_reached: int = 1              # 1, 2, or 3
    resolution: str = "pending"         # victory | alliance | stalemate | pending
    philosophy_absorbed: bool = False
    last_words: str = ""                # General's final statement
    empire_resonance_delta: int = 0
    identity_anchor_delta: int = 0
    mutation_triggered: str = ""        # mirror_crack | conversion | resistant
    chapter: int = 0

class EmissaryInteraction(BaseModel):
    emissary_id: str
    chapter: int = 0
    sympathy_delta: int = 0
    empire_resonance_delta: int = 0
    interaction_type: str = "neutral_response"
```

### Database schema (SQLite — thêm vào story_brain.py)

```sql
-- Villain encounter log
CREATE TABLE villain_encounters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    villain_id TEXT NOT NULL,
    villain_tier TEXT NOT NULL,         -- "emissary" | "general" | "veiled_will"
    chapter_id TEXT,
    phase_reached INTEGER DEFAULT 1,
    resolution TEXT DEFAULT "pending",
    empire_resonance_delta INTEGER DEFAULT 0,
    identity_anchor_delta INTEGER DEFAULT 0,
    mutation_triggered TEXT,
    philosophy_absorbed BOOLEAN DEFAULT FALSE,
    last_words TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Empire resonance tracking (snapshot per chapter)
CREATE TABLE empire_resonance_snapshots (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    chapter_id TEXT NOT NULL,
    empire_resonance INTEGER NOT NULL,
    identity_anchor INTEGER NOT NULL,
    empire_allegiance TEXT DEFAULT "none",
    snapshot_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emissary sympathy scores
CREATE TABLE emissary_sympathy (
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    emissary_id TEXT NOT NULL,
    sympathy_score INTEGER DEFAULT 0,
    revealed BOOLEAN DEFAULT FALSE,
    allegiance_offered BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (story_id, emissary_id)
);
```

---

## 9. AI/PIPELINE INTEGRATION

### Context Weight Agent — villain context

Thêm villain context vào `context_weight_agent.md` prompt:

```markdown
## Villain Context Rules

Khi villain_state được cung cấp, áp dụng các rules sau:

**empire_resonance > 60:**
- Tăng weight cho Empire-related context
- Narrator có thể subtle dùng Empire framing trong descriptions
- NPC reactions reflect player's growing Empire alignment

**active_general present:**
- General's philosophy luôn là background presence
- Nếu chapter liên quan đến values của General đó → tăng conflict weight
- Prose có subtle shadow của General's argument

**veiled_will_phase >= 2:**
- Thêm anomaly descriptions vào world
- "Cracks in reality" xuất hiện trong world-building prose
- Fate Buffer references trở nên ominous hơn

**mutation "mirror_crack" active:**
- Core value bị questioned → khi choice liên quan đến value đó, prose phản ánh uncertainty
- Player's inner monologue (nếu có) phản ánh doubt

**identity_anchor >= 70:**
- Player's descriptions thể hiện determination và clarity
- Villain arguments không còn tạo doubt — player bác bỏ confident
```

### Scene Writer — villain dialogue principles

Thêm vào `scene_writer.md`:

```markdown
## Villain Dialogue Rules

**Không được làm:**
- Villain tuyên bố mục tiêu bá đồ ("Tôi sẽ thống trị thế giới")
- Villain monologue exposition dài
- Villain chết hay thất bại với vẻ buông xuôi

**Phải làm:**
- Villain dùng Socratic method — đặt câu hỏi để player tự đặt câu hỏi
  VD: "Bao nhiêu người chết cho tự do của anh là mức chấp nhận được?"
- Villain hành động trước, giải thích sau (hoặc không giải thích gì)
- Villain defeat có dignity — họ rút lui, hy sinh, hoặc chết như một người tin vào lý tưởng của mình
- Sau mỗi encounter: player phải cảm thấy "Tôi không chắc mình hoàn toàn đúng"

**Villain-specific tone:**
- General Kha: Cold, precise, no emotion. Logic only.
- General Mireth: Clinical, curious. Treats player as fascinating specimen.
- General Azen: Gentle but unbending. Like a parent explaining hard truth.
- General Vorn: Passionate, frustrated. Believes in player's potential to see truth.
- Emissaries: Warm, relatable, never reveal ideology until forced.
```

### Consequence Router — villain consequence chains

```markdown
## Villain Encounter Consequence Chains

Khi chapter có villain encounter, consequence chain phải bao gồm:

immediate:
  - Visible world change từ encounter resolution

delayed (2-3 chapters):
  - Empire phản ứng với outcome
  - Faction attitudes shift
  - General's "Last Words" echo trong prose

long_term (arc-level):
  - empire_resonance threshold events trigger
  - Active general changes (next general "replaces" defeated one)
  - Veiled Will phase progression nếu điều kiện đủ

faction_implications:
  - Empire faction state update
  - Ally factions: worry / reassurance based on resolution
  - Neutral factions: observe, adjust stance
```

---

## 10. EMPIRE ROUTE — Alternative Branch

### Khi nào Empire Route mở

`empire_resonance >= 80` sau bất kỳ General Alliance hoặc chuỗi Emissary interactions.

### Những gì thay đổi trong Empire Route

**Narrative:**
- Protagonist title thay đổi (không announce — narrator dùng title mới tự nhiên)
- World descriptions phản ánh player thấy thế giới từ góc độ Empire
- NPCs cũ react khác — một số xa lánh, một số respectful

**Gameplay:**
- Empire faction quests mở
- General trở thành optional ally (không phải enemy)
- Old faction quests vẫn có thể làm — nhưng với "compromised agent" framing

**Identity system:**
- Unique Skill drift về Empire alignment (cosmetic + lore change, không nerf)
- Identity Coherence reset theo hướng mới (Empire values = new anchor)
- Mutation "The Conversion" apply nếu chưa có

**Endgame implications:**
- Empire Route không có "good ending" hay "bad ending" — chỉ có "Empire ending"
- Player phải đối mặt với consequences của đế chế họ chọn phục vụ
- The Veiled Will reveal vẫn xảy ra — nhưng Empire đã biết, và player là công cụ để giải quyết nó theo cách của Empire

### Defector path

Nếu player đã vào Empire Route nhưng muốn thoát:

```
Conditions:
  - empire_allegiance == "agent"
  - Player có 3 consecutive chapter choices trái với Empire orders
  - Trigger "Crisis of Faith" — Narrative Confrontation Event với Empire

Cost:
  - Empire truy sát player (active_general thay đổi thành Hunter mode)
  - empire_resonance -= 40 (nhưng không về 0 — scars remain)
  - Unique Skill có "fracture mark" — vết của conversion

Reward:
  - "The Defector" title (narrative only)
  - Unique hybrid — Empire-aligned skill + original seed echo
  - New storyline: "The Hunted" arc
```

---

## 11. IMPLEMENTATION ROADMAP

### Phase 1 — Foundation (triển khai ngay)

**Sprint 1: Data layer**
- [ ] Thêm `VillainState` vào `models/pipeline.py`
- [ ] Thêm `GeneralEncounter`, `EmissaryInteraction` models
- [ ] Update `NarrativeState` TypedDict với villain fields
- [ ] Tạo database tables (`villain_encounters`, `empire_resonance_snapshots`, `emissary_sympathy`)

**Sprint 2: Tracking engine**
- [ ] Tạo `app/narrative/villain_tracker.py`
  - `track_empire_resonance(state, delta, reason)` — update + log
  - `track_identity_anchor(state, delta, reason)` — update + log
  - `check_threshold_events(villain_state)` — trả về list triggered events
  - `get_villain_context(villain_state)` — format context string cho LLM
- [ ] Integrate vào `context_weight_agent.py`

**Sprint 3: Emissary layer**
- [ ] Tạo `app/narrative/emissary.py`
  - Emissary definitions (3 NPC specs)
  - `score_player_response(response, emissary_id)` → sympathy delta
  - `check_reveal_trigger(sympathy_score)` → reveal state
- [ ] Integrate vào `pipeline.py` như optional node

### Phase 2 — General Encounters (sau Phase 1 stable)

- [ ] Tạo `app/narrative/villain_encounter.py`
  - General definitions (4 Generals)
  - `run_encounter_phase(state, general_id, phase)` → encounter result
  - Multi-phase flow management
- [ ] Tạo prompts: `prompts/villain_confrontation.md`, `prompts/villain_dialogue.md`
- [ ] Update `scene_writer.py` và `simulator.py` với villain awareness
- [ ] Test với General Kha encounter đầu tiên

### Phase 3 — Mutations & Empire Route (sau General encounters stable)

- [ ] Implement mutation triggers in `pipeline.py`
- [ ] Empire Route branch logic
- [ ] Update `consequence_router.py` với villain consequence chains
- [ ] Defector path narrative

### Phase 4 — The Veiled Will seeds (Season 1 endgame)

- [ ] Personality fragments system trong `scene_writer.py`
- [ ] Phase reveal triggers
- [ ] Fate Buffer — Veiled Will connection reveal
- [ ] Endgame narrative fork

---

## 12. QUALITY METRICS

### Villain encounter thành công khi:

1. **No obvious evil** — Không có lời nào của villain nghe như "cliché villain"
2. **Player hesitation** — Player mất thời gian hơn bình thường để chọn response
3. **Post-encounter echo** — Player nhớ argument của villain 3+ chapters sau
4. **Identity drift measurable** — identity_coherence thay đổi rõ ràng sau encounter
5. **No "right answer" feeling** — Player không cảm thấy có lựa chọn "safe/correct"

### Red flags cần fix:

- Villain bị đánh bại và player cảm thấy "xong, tiếp" → Thiếu Last Words / dignity
- empire_resonance không tăng dù player đồng ý với villain → Bug trong scoring
- Player chọn Empire Route vì "mạnh hơn" thay vì vì triết lý → Prompt cần emphasize philosophy over power
- General encounter cảm thấy như combat encounter có thêm dialogue → Phase 1-2 cần weight more

---

> *"Kẻ thù xứng đáng nhất không phải kẻ mạnh nhất. Mà là kẻ khiến bạn nghi ngờ liệu mình có đang chiến đấu cho điều đúng đắn không."*

