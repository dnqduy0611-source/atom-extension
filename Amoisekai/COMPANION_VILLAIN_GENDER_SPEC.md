# AMOISEKAI — Companion · Villain Power · Gender-Aware Dialogue Spec v1.0

> **Author:** Amo
> **Date:** 2026-03-01
> **Status:** Spec — Pre-implementation
> **Dependencies:** VILLAIN_SYSTEM_SPEC, POWER_SYSTEM_SPEC, WORLD_BIBLE, SCENE_ARCHITECTURE_SPEC
> **Implementation order:** Phase 1 → Phase 2 → Phase 3

---

## Tổng quan

Ba phase này bổ trợ lẫn nhau và tạo ra một "character ecosystem" hoàn chỉnh xung quanh player:

```
Player (có Gender)
    │
    ├──► Companion (có Affinity + Ability + Secret)
    │        └──► Synergy với Player Skill
    │
    ├──► Villain (có Power Profile + Weakness + Philosophy)
    │        └──► Weakness tied to Companion Ability hoặc Player Skill
    │
    └──► World NPCs (phản ứng theo Gender + Affinity context)
```

---

# PHASE 1 — COMPANION SYSTEM (Nhân vật hỗ trợ)

## 1.1 Triết lý thiết kế

> Companion không phải NPC thông thường. Họ là **gương thứ hai** của player — phản chiếu góc khuất mà player không chịu nhìn nhận.

**5 nguyên tắc:**

1. **Companion có tâm lý riêng** — không phải công cụ của player
2. **Affinity earned, không phải given** — phải chứng minh qua hành động
3. **Secret là linh hồn companion** — mỗi companion có sự thật ẩn được reveal theo tier affinity
4. **Ability synergy** — sức mạnh companion kết hợp với unique skill player tạo combo narrative
5. **Companion có thể rời bỏ** — nếu player phản bội đủ mạnh (affinity < 0)

## 1.1b Companion × Preference Tags × Tone

Companion system **phải** tuân theo preference tags và tone của story. Đây không phải optional — tags và tone định hình loại companion nào được generate, companion hành động ra sao, và affinity dynamics nặng/nhẹ thế nào.

### Tag → Companion Role Bias

Khi Planner generate companion mới, preference tags biases companion profile:

| Tag | Role ưu tiên | Ability type | Đặc điểm |
|---|---|---|---|
| `combat` | `fighter` | Combat synergy (block, counter, coordinate) | Companion sát cánh trong trận, có cost rõ ràng |
| `politics` | `diplomat` | Information gathering, alliance detection | Companion đọc được subtext, biết ai đang dối |
| `romance` | Bất kỳ + romantic potential | Emotional resonance, protective instinct | Affinity milestone có romantic beats tự nhiên |
| `mystery` | `scout` | Secret detection, memory fragments | Companion là người giữ nhiều bí ẩn nhất |
| `horror` | `healer` hoặc vulnerable type | Warning sense, shield | Companion dễ bị đe dọa → tạo tension cho player |
| `cultivation` | `mage` | Cultivation boost, principle alignment | Companion có con đường tu luyện riêng |
| `adventure` | `scout` hoặc `wanderer` | Pathfinding, world knowledge | Companion là guide, biết thế giới hơn player |
| `strategy` | `strategist` | Tactical analysis, enemy weakness reveal | Companion lên kế hoạch, player execute |

**Khi nhiều tags:** Companion nhận dominant tag (tag đầu tiên) làm primary role, secondary tags thêm vào `ability.synergy_with_player` và `personality_core`.

### Tone → Affinity Dynamics

Tone thay đổi cách affinity tích lũy và cách companion bộc lộ cảm xúc:

| Tone | Affinity multiplier | Secret reveal tier | Companion personality flavour |
|---|---|---|---|
| `epic` | ×1.0 (chuẩn) | bonded (80+) | Companion cảm thấy như nhân vật của vận mệnh — lời nói nặng, sacrifice lớn |
| `dark` | ×0.75 (khó tăng hơn) | bonded (80+) nhưng secret tối hơn | Trust khó earn, companion có past nặng nề, secret là moral failure |
| `comedy` | ×1.2 (dễ tăng hơn) | ally (40+) | Companion hài hước nhưng vẫn có layer sâu — tsukkomi/boke dynamic |
| `slice_of_life` | ×1.0, slow burn | close (60+) nhưng qua mundane moments | Affinity tăng qua bữa ăn, trò chuyện bình thường — không cần crisis |
| `mysterious` | ×0.9 | sworn (100) — secret never fully revealed | Companion bí ẩn nhất, secret chỉ gợi ý, không bao giờ explain hoàn toàn |

### Affinity Delta Modifiers by Tone

```
dark tone:
  - Tất cả TĂNG affinity events: ×0.75
  - Tất cả GIẢM affinity events: ×1.25
  → Trust chậm xây, phá vỡ nhanh

comedy tone:
  - Tất cả TĂNG: ×1.2
  - Failure/accident không gây giảm affinity (companion cười xử lý)
  → Forgiving, warm dynamic

slice_of_life tone:
  - Thêm delta source: "mundane shared moment" → +3 mỗi khi scene là rest/dialogue với companion
  - Crisis-based deltas ×0.8 (crisis không phải cách chính build bond)

mysterious tone:
  - Affinity events chuẩn, nhưng companion KHÔNG bao giờ confirm tăng thân thiết
  - Tier display ẩn với player — player không biết affinity hiện tại bao nhiêu
```

### Tag → Scene Writer Companion Guidance

Khi inject companion context vào scene writer, thêm tag-specific instruction:

```
[combat tag + companion fighter] → Writer: "Companion sát cánh trong mọi combat,
có moment nguy hiểm riêng. KHÔNG để companion chỉ đứng xem."

[romance tag + affinity ≥ ally] → Writer: "Cho phép romantic subtext tự nhiên —
khoảnh khắc nhỏ (ánh mắt, chần chừ, không nói thẳng). KHÔNG force romance."

[mystery tag + companion scout] → Writer: "Companion biết nhiều hơn nói.
Hint qua hành động, không phải lời. Secret leak 1 mảnh nhỏ mỗi 3-4 scenes."

[horror tag] → Writer: "Companion dễ bị tổn thương. Đặt companion vào tình huống
nguy hiểm để tạo stakes cho player. Player PHẢI chọn giữa companion và mục tiêu."

[strategy tag + companion strategist] → Writer: "Companion phân tích trước player.
Companion có thể SAI — tạo tension khi player chọn nghe hay không nghe."
```

---

## 1.1c Companion Diversity by Archetype (+ Per-User Long-term)

> Companion hay nhất không phải người giống player — mà là người **phản chiếu đúng điểm mù của archetype đó**.
> Đây là lý do Samwise Gamgee hoạt động với Frodo, không phải với Aragorn.

### Tại sao Archetype quyết định Companion Pool?

Mỗi archetype có một **điểm mù cốt lõi** — điều họ không thể tự nhìn thấy ở mình. Companion lý tưởng là người buộc archetype đó đối mặt với điểm mù đó — không phải qua giáo huấn, mà qua sự tồn tại của chính họ.

### Companion Archetype Matrix

Mỗi player archetype có pool **3 companion archetype**:
- **Primary** — Foil tự nhiên, phản chiếu điểm mù trực tiếp
- **Secondary** — Unexpected ally, bổ trợ theo cách không ai ngờ
- **Shadow** — Companion có thể trở thành adversary nếu affinity < 0 (không phải villain, chỉ là quan hệ vỡ)

---

#### SOVEREIGN (lãnh đạo, quyết định, kiểm soát)
*Điểm mù: Quyền lực cô lập. Không ai dám nói thật. Đang dần mất kết nối với người bình thường.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Conscience** | Người duy nhất dám phản biện Sovereign — không phải vì muốn quyền lực mà vì tin vào điều đúng | Sovereign ra lệnh → Conscience không tuân và giải thích tại sao. Sovereign tức giận → nhưng về sau nhận ra Conscience đúng |
| Secondary | **The Commoner** | Người hoàn toàn ngoài hệ thống quyền lực, nhắc Sovereign nhớ cuộc sống bình thường ra sao | Thấy thế giới qua mắt người bình thường. Không bị ấn tượng bởi title hay authority |
| Shadow | **The Ambitious Underling** | Bắt đầu là follower trung thành, nhưng khi affinity sụp đổ → thấy Sovereign là obstacle | Tốt khi Sovereign mạnh, nguy hiểm khi Sovereign yếu |

*Ability bias: Conscience → social/information. Commoner → survival/practical. Underling → combat/political.*

---

#### CATALYST (thay đổi, đột phá, khuấy động)
*Điểm mù: Hậu quả thay đổi lên người khác. Catalyst tạo ra bão — nhưng không sống trong bão đó.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Anchor** | Người bị ảnh hưởng trực tiếp bởi thay đổi của Catalyst — nhưng không oán hận, chỉ muốn Catalyst thấy hậu quả thật | Catalyst phá vỡ một thứ → Anchor phải sống với mảnh vỡ đó. Không phán xét, chỉ thể hiện |
| Secondary | **The Fellow Revolutionary** | Cùng muốn thay đổi nhưng khác phương pháp — tạo friction productive | Catalyst muốn bứt phá ngay lập tức → Fellow muốn xây dựng từ bên trong. Cả hai đúng một phần |
| Shadow | **The Casualty** | Người bị tổn thương bởi hành động của Catalyst trong quá khứ, ban đầu tha thứ | Nếu Catalyst tiếp tục lặp lại pattern → Casualty rời bỏ hoặc oppose |

*Ability bias: Anchor → healing/stabilization. Fellow → disruption/combo. Casualty → warning sense/protection.*

---

#### VANGUARD (bảo vệ, tiên phong, hy sinh)
*Điểm mù: Ai bảo vệ người bảo vệ? Vanguard không biết nhận giúp đỡ.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Ward → The Equal** | Bắt đầu là người Vanguard bảo vệ. Dần lớn mạnh. Cuối arc: bảo vệ Vanguard lại | Arc dài nhất — Ward học từ Vanguard, rồi trở thành mirror |
| Secondary | **The Fellow Shield** | Protector khác, dynamic anh/chị em chiến đấu — compete và hỗ trợ lẫn nhau | Không cần lời giải thích, đã hiểu nhau qua hành động |
| Shadow | **The One They Failed** | Từ quá khứ Vanguard không bảo vệ được — xuất hiện lại | Nếu affinity sụp đổ → nhắc nhở failure thay vì redemption |

*Ability bias: Ward → evolving ability (grows with affinity). Shield → tandem combat. Failed One → disruption/trauma trigger.*

---

#### TACTICIAN (mưu lược, quan sát, nhiều bước trước)
*Điểm mù: Cảm xúc không tính được. Đôi khi đúng về logic nhưng sai về người.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Intuitive** | Hành động theo trực giác, thường đúng theo cách logic Tactician không giải thích được | Tactician tính 5 bước → Intuitive hành động ngay → đúng vì lý do bất ngờ. Mâu thuẫn tạo tension |
| Secondary | **The Student** | Học từ Tactician, tạo ra mirror của growth — và đặt câu hỏi mà Tactician không bao giờ tự hỏi | "Thầy nghĩ rất nhiều. Thầy có hạnh phúc không?" |
| Shadow | **The Smarter Rival** | Companion đủ thông minh để out-maneuver Tactician nếu trust vỡ | Khi aligned: devastating duo. Khi broken: biết mọi điểm yếu |

*Ability bias: Intuitive → prediction/sense danger. Student → strategy analysis. Rival → counter-planning.*

---

#### SEEKER (tìm kiếm sự thật, khám phá, kiến thức)
*Điểm mù: Sự thật có thể phá hủy. Seeker muốn biết mọi thứ — nhưng không sẵn sàng cho cái giá.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Guardian of Secrets** | Biết điều Seeker đang tìm — nhưng không nói ngay, vì có lý do. Secret reveal = arc companion | Mỗi tier affinity, Guardian tiết lộ thêm một lớp — nhưng lớp sau nặng hơn lớp trước |
| Secondary | **The Fellow Traveler** | Cùng tìm kiếm nhưng câu hỏi khác — tạo hai hướng song song | Đôi khi gặp nhau, đôi khi phân kỳ. Discovery của một bên illuminate discovery của bên kia |
| Shadow | **The True Believer** | Đã tìm thấy "sự thật" của họ và không muốn bị challenge | Nếu Seeker tìm thấy điều mâu thuẫn với belief của True Believer → conflict |

*Ability bias: Guardian → information/memory. Fellow → exploration/pathfinding. True Believer → buff khi aligned, debuff khi opposed.*

---

#### WANDERER (tự do, không ràng buộc, chuyển động)
*Điểm mù: Cô đơn của tự do. Wanderer chọn không thuộc về đâu — nhưng đôi khi muốn.*

| Type | Companion Archetype | Psychological role | Ví dụ dynamic |
|---|---|---|---|
| Primary | **The Root** | Người muốn Wanderer ở lại — không phải để kiểm soát, mà vì genuinely cần | Wanderer phải chọn: tiếp tục đi hay ở lại cho người này. Không có câu trả lời đúng |
| Secondary | **The Fellow Wanderer** | Wanderer khác, lý do wandering khác — mirror nhưng không identical | Cùng đường nhưng khác đích. Đôi khi companion, đôi khi diverge |
| Shadow | **The Obligation** | Gia đình, nghĩa vụ, hoặc guilt từ quá khứ Wanderer đang chạy trốn | Nếu Wanderer từ chối đối mặt → Obligation trở thành nguồn conflict |

*Ability bias: Root → healing/anchoring. Fellow Wanderer → speed/evasion. Obligation → consequence weight.*

---

### Implementation: Archetype → Companion Pool

Khi Planner tạo beat giới thiệu companion mới:

```python
COMPANION_POOL = {
    "sovereign":  ["conscience", "commoner", "ambitious_underling"],
    "catalyst":   ["anchor", "fellow_revolutionary", "casualty"],
    "vanguard":   ["ward", "fellow_shield", "failed_one"],
    "tactician":  ["intuitive", "student", "smarter_rival"],
    "seeker":     ["guardian_of_secrets", "fellow_traveler", "true_believer"],
    "wanderer":   ["root", "fellow_wanderer", "obligation"],
}
```

Planner chọn companion archetype type từ pool, AI generate tên/ngoại hình/ability cụ thể.
- Companion thứ 1 (chapter 1-2): luôn là Primary
- Companion thứ 2 (chapter 3+): Secondary hoặc shadow tùy story direction
- Shadow companion: xuất hiện nếu có event đặc biệt hoặc affinity của primary đã ≥ ally

### Per-User Long-term: Companion Echo System

> Nếu user chơi nhiều story, companion "echo" xuất hiện — không phải cùng nhân vật,
> nhưng cùng psychological archetype relationship với player đó.

**Phase 1 (current):** Per-story companion — mỗi story tạo mới hoàn toàn.

**Phase 2+ (future):** Companion Echo Registry per user:
```python
class CompanionEchoRegistry(BaseModel):
    user_id: str
    echoes: list[CompanionEcho]

class CompanionEcho(BaseModel):
    companion_type: str      # "conscience", "anchor", etc.
    highest_affinity: int    # Peak affinity đạt được
    story_count: int         # Số story đã gặp type này
    notes: str               # AI note về pattern relationship của user này với type này
```

Khi user bắt đầu story mới, Companion Echo Registry inform Planner:
- "User này có pattern với Conscience companion: thường betray ở tier close (affinity 60-70)"
- → Planner tạo companion có secret reveal timing adjusted, tạo thêm moments test trust

Điều này cho phép companion system **học từ user** — không phải cùng nhân vật nhưng cùng dynamic, evolved.

---

## 1.2 Data Model

### CompanionAbility

```python
class CompanionAbility(BaseModel):
    name: str                          # "Mắt Đọc Tâm" / "Chắn Linh"
    description: str                   # Mô tả narrative
    mechanic: str                      # Cơ chế hoạt động cụ thể
    activation_condition: str          # Khi nào kích hoạt được
    limitation: str                    # Điều gì giới hạn ability này
    synergy_with_player: str           # Kết hợp với unique skill player thế nào
    cost: str                          # Chi phí khi dùng (stamina, risk, emotion)
```

### CompanionProfile

```python
class CompanionProfile(BaseModel):
    # Identity
    name: str                          # Tên canonical (KHÔNG thay đổi sau first appearance)
    gender: str = "neutral"            # "male" | "female" | "neutral"
    role: str                          # "fighter" | "strategist" | "scout" | "healer" | "mage" | "diplomat"
    personality_core: str              # 1 câu mô tả tính cách cốt lõi
    appearance_anchor: str             # Mô tả ngoại hình cố định (không drift)

    # Backstory (tiered unlock)
    backstory_surface: str             # Những gì companion nói về bản thân (lớp ngoài)
    backstory_hidden: str              # Sự thật thực sự (unlock affinity ≥ 60)
    secret: str                        # Bí ẩn sâu nhất (unlock affinity ≥ 80)
    secret_reveal_trigger: str         # Điều kiện/hoàn cảnh reveal secret

    # Story tracking
    story_id: str
    first_appeared_chapter: int
    status: Literal["active", "departed", "dead", "unknown"] = "active"
    departure_reason: str = ""         # Nếu departed

    # Affinity system
    affinity: int = Field(default=20, ge=-20, gt=-21)  # Bắt đầu ở Quen biết
    affinity_tier: str = "acquaintance"
    affinity_history: list[AffinityEvent] = []         # Log các thay đổi

    # Ability
    ability: CompanionAbility

    # Dialogue memory (AI reference)
    notable_quotes: list[str] = []     # Những câu nói đáng nhớ để AI tái dùng voice
    last_emotional_state: str = "neutral"  # Trạng thái cảm xúc gần nhất

    # Gender-aware response profile
    response_to_player_male: str = ""   # Hành vi đặc trưng với player nam
    response_to_player_female: str = "" # Hành vi đặc trưng với player nữ
```

### AffinityEvent

```python
class AffinityEvent(BaseModel):
    chapter: int
    scene: int
    delta: int                         # +/- amount
    reason: str                        # "Bảo vệ companion trong combat"
    trigger_type: str                  # "choice" | "free_input" | "consequence" | "inaction"
```

## 1.3 Affinity Tiers

| Tier | Tên | Range | Unlocks |
|---|---|---|---|
| `stranger` | Người lạ | -20 → 19 | Companion lạnh lùng, info tối thiểu |
| `acquaintance` | Quen biết | 20 → 39 | Banter, surface banter, ability available ở mức cơ bản |
| `ally` | Đồng minh | 40 → 59 | Companion share info quan trọng, ability fully usable |
| `close` | Thân thiết | 60 → 79 | Backstory hidden revealed, ability có upgrade |
| `bonded` | Gắn kết | 80 → 99 | Secret revealed, companion có thể hy sinh để bảo vệ player |
| `sworn` | Thề ước | 100 | Special narrative event, ability legendary upgrade, unbreakable |

**Ngưỡng âm:**
- `< 0`: Companion rời bỏ temporarily (status = "departed")
- `< -10`: Companion không quay lại (status = "departed", permanent)
- `< -20`: Trong trường hợp phản bội nặng: companion trở thành adversary (chuyển thành Emissary-class NPC)

## 1.4 Affinity Delta Rules

```
TĂNG AFFINITY:
+3   → Player chọn action mà companion gợi ý
+5   → Player bảo vệ/hỗ trợ companion không cần thiết
+8   → Player trust companion trong tình huống rủi ro cao
+10  → Hoàn thành scene companion-focused (beat purpose = "companion_bond")
+5   → Player share vulnerable moment (free_input có emotional disclosure)
+15  → Player cứu companion khỏi nguy hiểm thực sự

GIẢM AFFINITY:
-5   → Player bỏ qua companion khi companion cần
-10  → Player chọn action companion phản đối rõ ràng
-15  → Player sử dụng companion như công cụ (instrumental betrayal)
-20  → Player phản bội companion trong choice rõ ràng
-30  → Player betrays companion trong khủng hoảng (high-stakes)
-40  → Player kills/removes companion intentionally
```

**Affinity Update point:** Sau mỗi chapter, Simulator/Consequence Router phân tích choices của chapter đó và output `affinity_deltas: dict[companion_name, int]`.

## 1.5 Companion Ability Synergy

Mỗi companion ability có một `synergy_with_player` field chỉ định cách kết hợp:

```
VD: Player skill = "Kính Soi Hồn Ảnh" (đọc cảm xúc/ký ức)
    Companion (Sira-type) ability = "Chắn Linh" (tạo barrier bảo vệ)

    Synergy: Khi player dùng Kính Soi Hồn Ảnh + companion đang ở tier "ally"+:
    → Companion tự động chắn distraction, player đọc sâu hơn bình thường
    → Writer gợi ý trong prose: companion đứng chặn xung quanh, ánh mắt focused
    → Trong choices: "[Kính Soi Hồn Ảnh + Sira] — Đọc sâu với Sira bảo vệ" (risk giảm 1)
```

**Rule**: Synergy chỉ hoạt động khi:
1. Companion có mặt trong scene (`characters_involved` bao gồm tên companion)
2. Affinity ≥ `ally` (40+)
3. Scene type phù hợp với activation_condition của cả hai

## 1.6 Files cần tạo/sửa

### Tạo mới

| File | Mục đích |
|---|---|
| `app/models/companion.py` | `CompanionProfile`, `CompanionAbility`, `AffinityEvent` models |
| `app/memory/companion_store.py` | Load/save companions per story (SQLite, table `companions`) |
| `app/narrative/companion_context.py` | Build context block từ active companions cho pipeline |

### Sửa có

| File | Thay đổi |
|---|---|
| `app/memory/state.py` | Thêm table `companions`, methods `save_companion()`, `get_story_companions()` |
| `app/narrative/context.py` | Inject companion context block (sau Story Ledger) |
| `app/narrative/simulator.py` | Output `affinity_deltas` từ chapter choices |
| `app/engine/orchestrator.py` | Sau chapter: read affinity_deltas → update companion store |
| `app/models/pipeline.py` | Add `companion_context: str = ""` to `NarrativeState` |
| `app/prompts/scene_writer.md` | Thêm section: Companion Affinity Tier behavior, Ability synergy rules |

### DB Schema (thêm vào `state.py`)

```sql
CREATE TABLE companions (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL,
    name TEXT NOT NULL,
    gender TEXT DEFAULT 'neutral',
    role TEXT DEFAULT 'ally',
    personality_core TEXT,
    appearance_anchor TEXT,
    backstory_surface TEXT,
    backstory_hidden TEXT,
    secret TEXT,
    secret_reveal_trigger TEXT,
    first_appeared_chapter INTEGER,
    status TEXT DEFAULT 'active',
    affinity INTEGER DEFAULT 20,
    affinity_tier TEXT DEFAULT 'acquaintance',
    ability_json TEXT,              -- CompanionAbility as JSON
    affinity_history_json TEXT,     -- list[AffinityEvent]
    notable_quotes_json TEXT,
    last_emotional_state TEXT DEFAULT 'neutral',
    response_to_player_male TEXT,
    response_to_player_female TEXT,
    departure_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id)
);
```

## 1.7 Context Block Format

Khi inject vào pipeline (trong context.py), companion state được format:

```
## Nhân vật đồng hành (Active Companions):

### [Tên Companion] — [Role] | Affinity: [Tier] ([số])
- Tính cách: [personality_core]
- Trạng thái: [status] | Cảm xúc hiện tại: [last_emotional_state]
- Ability: [ability.name] — [ability.description] (kích hoạt: [activation_condition])
- Synergy với player skill: [ability.synergy_with_player]
⚠️ Tier hiện tại [tier]: [mô tả behavior của tier này]
[Nếu tier ≥ close]: Backstory đã reveal: [backstory_hidden]
[Nếu tier ≥ bonded]: Secret: [secret]
[Nếu tier stranger]: Companion lạnh lùng, có thể từ chối hợp tác
```

---

## 1.8 Companion × Arc Blueprint

> Companion không chỉ thay đổi theo affinity — companion thay đổi theo **vị trí trong câu chuyện lớn**.
> Arc Blueprint (`arc_blueprint.py`) cung cấp `companion_directive` per arc — directive này **override default behavior** khi conflict.

### Arc → Companion Behavior Matrix

| Arc | Companion Directive | Affinity Pace | Key Companion Moment |
|---|---|---|---|
| **1. Thức Tỉnh** (0-20%) | Mysterious, giữ khoảng cách, lore guide nhẹ | Chậm — companion chưa trust player | First encounter — companion xuất hiện nhưng chưa commit |
| **2. Rèn Luyện** (20-40%) | Ally thực sự — banter tăng, tin tưởng xây dần | Ổn định — tăng qua shared experiences | Backstory hint — companion lộ 1-2 bí mật nhẹ |
| **3. Thử Lửa** (40-65%) | Bị đặt trong nguy hiểm hoặc conflict lợi ích — test player loyalty | Tăng nhanh HOẶC sụt mạnh — high stakes | **Loyalty test** — player phải chọn giữa companion và mục tiêu |
| **4. Sụp Đổ** (65-85%) | Absence hoặc strained relationship — reunion phải EARNED | Giảm hoặc đóng băng — companion crisis | **Crisis peak** — companion bị bắt/bỏ đi/phản bội tạm |
| **5. Cao Trào** (85-100%) | Đỉnh loyalty — sẵn sàng sacrifice hoặc đã sacrifice | Đỉnh — bonded hoặc sworn nếu player earned | **Sacrifice moment** — companion đứng cạnh player lần cuối |

### Quy tắc tích hợp

1. **Arc directive > Affinity default**: Nếu arc directive nói "companion absence" nhưng affinity cao → companion vẫn absence (narrative reason: bị bắt, bị thương, bỏ đi vì lý do riêng). Affinity không ngăn arc progression.

2. **Affinity pace theo arc**: Arc 1-2 affinity tăng chậm (~+3-5/chapter). Arc 3 tăng/giảm mạnh (~±8-15/chapter). Arc 4 đóng băng hoặc giảm. Arc 5 spike nếu reunion.

3. **Secret reveal timing theo arc**:
   - `backstory_hidden` (tier close, 60+): Tự nhiên nhất ở Arc 2-3
   - `secret` (tier bonded, 80+): Tự nhiên nhất ở Arc 3-4 (trước hoặc trong crisis)
   - Nếu affinity đạt tier nhưng arc chưa phù hợp → **delay reveal** đến arc phù hợp

4. **Companion departure rules**:
   - Arc 1-3: Companion KHÔNG được rời bỏ vĩnh viễn (trừ affinity < -20)
   - Arc 4: Companion CÓ THỂ tạm rời bỏ (departure_reason from arc crisis)
   - Arc 5: Companion rời bỏ chỉ qua sacrifice — không phải abandonment

### Implementation: Arc Directive Injection

Khi build companion context cho pipeline, thêm arc directive:

```python
# Trong companion_context.py
from app.narrative.arc_blueprint import get_current_arc

arc = get_current_arc(chapter_number)
if arc and arc.companion_directive:
    companion_block += f"\n⚠️ ARC DIRECTIVE: {arc.companion_directive}"
```

Planner và Scene Writer đọc directive này và điều chỉnh companion behavior accordingly.

---

# PHASE 2 — VILLAIN POWER SYSTEM

## 2.1 Triết lý

> Villain không mạnh vì level cao. Villain mạnh vì **họ hiểu một Principle sâu hơn player** và đã sacrifice thứ gì đó để đạt được sức mạnh đó.

Villain power phải:
1. Có thể **counter bởi player skill hoặc companion ability** — không phải invincible
2. Có **philosophy cost** — mỗi ability phản ánh sự hy sinh/lựa chọn của villain
3. **Reveal dần** — player không biết toàn bộ ability ngay từ đầu

## 2.2 Villain Power Tiers (align với Power System Spec)

| Tier | Tên | Corresponds to | Combat Threat |
|---|---|---|---|
| I | Enforcer | Emissary sơ cấp, mid-boss | Player có thể thắng nếu dùng skill đúng |
| II | Emissary | 3 Emissary (Kaen, Sira, Thol) | Khó, cần companion hoặc strategy |
| III | General | 4 Generals | Cần multi-chapter buildup, companion synergy |
| IV | Veiled Will fragment | Phase 1 Veiled Will hints | Chỉ encounter, không thể "thắng" conventionally |
| V | Veiled Will | End-game | Narrative confrontation, không combat thuần |

## 2.3 VillainPowerProfile Model

```python
class VillainAbility(BaseModel):
    name: str                          # "Xiềng Nhân Quả"
    description: str                   # Mô tả narrative
    mechanic: str                      # Cách hoạt động cụ thể trong narrative
    reveal_condition: str              # Khi nào player biết ability này tồn tại
    counter: str                       # Cái gì counter được (player skill / companion / strategy)
    philosophy_source: str             # Principle nào tạo ra power này (Order/Entropy/Flux/...)
    cost_to_villain: str               # Villain hy sinh gì để dùng ability này

class VillainPowerProfile(BaseModel):
    villain_id: str                    # "kaen" | "general_sael" | ...
    villain_name: str
    villain_class: Literal["enforcer", "emissary", "general", "veiled_fragment"]
    power_tier: int                    # 1-5
    faction: str
    dominant_principle: str            # Principle mạnh nhất (Order/Entropy/Flux/Matter/Energy/Void)
    secondary_principle: str

    # Combat profile
    abilities: list[VillainAbility]    # 2-4 abilities
    weaknesses: list[str]              # 1-2 explicit weaknesses
    encounter_style: Literal[
        "direct_combat",               # Đánh trực tiếp
        "psychological",               # Thao túng tâm lý
        "proxy",                       # Dùng subordinate, không xuất hiện trực tiếp
        "revelation",                  # Reveal sự thật → identity crisis
        "philosophical_debate"         # Tranh luận ideology → player phải chứng minh
    ]

    # Narrative profile
    motivation_core: str               # Lý do thực sự
    argument_to_player: str            # Villain muốn thuyết phục player điều gì
    what_villain_fears: str            # Điểm yếu tâm lý

    # Tracking
    revealed_abilities: list[str] = [] # Những ability player đã thấy
    encounter_count: int = 0
```

## 2.4 Villain Ability Examples

### Emissary Kaen (Power Tier II, Dominant: Order)

```
Ability 1: "Luật Bất Di Dịch"
- Mechanic: Trong combat, mọi hành động của player bị predict chính xác 1 nhịp trước
- Reveal: Sau lần encounter đầu tiên — player nhận ra đòn bị đọc trước
- Counter: Unique skill chaos-type hoặc companion có Flux principle
- Cost to Kaen: Kaen phải "trả giá" bằng việc không thể improvise — y bị ràng buộc bởi quy luật của chính mình

Ability 2: "Đế Chế Ký Ức"
- Mechanic: Kaen có thể access một số ký ức của người y từng "đăng ký" — biết điểm yếu
- Reveal: Khi Kaen nhắc đến chi tiết mà player chưa bao giờ nói
- Counter: Player deny information (không answer questions), companion shield
- Cost: Kaen phải có đủ "quan sát" — cần từng gặp player hoặc người quen
```

### General Sael (Power Tier III, Dominant: Entropy)

```
Ability 1: "Phân Rã Lý Trí"
- Mechanic: Mỗi lần encounter với Sael, player nhận +instability (không thể tránh)
- Reveal: Sau encounter đầu — player cảm thấy có gì đó không ổn sau khi rời
- Counter: Identity Anchor cao (companion bonded + identity_anchor từ Identity System)
- Cost: Sael phải tiêu hao bản thân — mỗi lần dùng ability, y mất một phần coherence

Ability 2: "Echo Vực Sâu"
- Mechanic: Sael summon "phiên bản drift" của người player thân thiết nhất
- Reveal: Mid-combat — player thấy companion hoặc NPC quan trọng nhưng "sai"
- Counter: Affinity ≥ bonded với companion bị echo'd → companion không bị distort hoàn toàn
- Cost: Sael cần biết ai player thân thiết — có thể bị lợi dụng ngược lại
```

## 2.5 Weakness ↔ Companion Synergy Design

Mỗi General villain có ít nhất **một weakness tied to companion**:

```
General N có weakness: "Bị phá vỡ bởi unconditional trust"
→ Nếu companion [X] đạt tier "bonded" và present trong encounter
→ Scene Writer thêm option: "[Tên companion] đứng giữa bạn và General" (risk giảm đáng kể)
→ Villain không thể dùng ability tâm lý khi target có companion bonded che chắn
```

Đây tạo ra **progression loop có ý nghĩa**: xây affinity companion → mở weakness villain → có cơ hội counter villain mạnh hơn.

## 2.6 Files cần tạo/sửa

### Tạo mới

| File | Mục đích |
|---|---|
| `app/models/villain_power.py` | `VillainPowerProfile`, `VillainAbility` models |
| `app/memory/villain_power_store.py` | Lưu villain power profiles (static JSON seed + per-story tracking) |

### Sửa có

| File | Thay đổi |
|---|---|
| `app/narrative/villain_tracker.py` | Load VillainPowerProfile, inject ability context vào writer |
| `app/memory/world_state_store.py` | Thêm `revealed_abilities` tracking vào GeneralStatus/EmissaryStatus |
| `app/models/world_state.py` | Extend `GeneralStatus` và `EmissaryStatus` với `revealed_abilities`, `encounter_count` |
| `app/prompts/scene_writer.md` | Villain ability rules: reveal timing, counter mechanics, how to write villain combat |

## 2.7 Static Seed Data

Villain Power Profiles cho Phase 1 được seed từ JSON file:

```
app/data/villain_powers.json
├── emissaries/
│   ├── kaen.json
│   ├── sira.json
│   └── thol.json
└── generals/
    ├── general_1.json
    ├── general_2.json
    ├── general_3.json
    └── general_4.json
```

Các profile này là **static** (không thay đổi theo story) nhưng `revealed_abilities` và `encounter_count` là per-story state.

## 2.8 Context Block Format

Khi inject vào villain_tracker context:

```
## Villain Profile — [Tên] (Tier [N], [encounter_style]):
- Dominant Principle: [principle]
- Encounter style: [style]
- Abilities đã revealed với player:
  * [ability 1] — [mechanic tóm tắt] | Counter: [counter]
  * [ability 2] — ...
- Abilities chưa revealed: [số lượng] abilities còn ẩn
- Điểm yếu được biết: [nếu player đã discover]
- Argument của villain: [argument_to_player]
⚠️ Writer: Villain dùng [encounter_style] — đừng viết như combat thông thường
```

---

# PHASE 3 — GENDER-AWARE DIALOGUE

## 3.1 Triết lý

> Gender không phải chỉ là pronoun. Gender ảnh hưởng đến **power dynamics**, **social expectations**, và **emotional subtext** trong từng nền văn hóa.

**3 lớp gender awareness:**

1. **Pronoun layer** *(đã có)* — narrator dùng "anh/cô/bạn"
2. **Social dynamic layer** *(mới)* — NPC đối xử khác nhau dựa trên gender + context
3. **Romance layer** *(mới)* — tension lãng mạn thay đổi theo gender player + gender NPC

## 3.2 Gender Signal trong Pipeline

### NarrativeState addition

```python
# Trong models/pipeline.py — NarrativeState
player_gender: str = "neutral"   # "male" | "female" | "neutral"
```

Lấy từ `player.gender` và pass vào pipeline như `previous_chapter_ending`.

### Context Block

Thêm vào `context.py` sau Player Identity:

```python
# ── 9b. Player Gender Context ──
if state.player_gender and state.player_gender != "neutral":
    gender_label = {"male": "nam", "female": "nữ"}.get(state.player_gender, "")
    if gender_label:
        contexts.append(
            f"## Player Gender: {gender_label}\n"
            f"{_build_gender_context(state.player_gender)}"
        )
```

### `_build_gender_context()` function

```python
def _build_gender_context(gender: str) -> str:
    if gender == "male":
        return (
            "- NPC lớn tuổi/có quyền lực: tôn trọng dạng 'thiếu hiệp', 'cậu bé', 'cháu'\n"
            "- NPC nữ cùng tầng lớp: trung lập đến thân thiện, có thể có subtext lãng mạn nếu tag romance\n"
            "- NPC kẻ thù: 'ngươi', 'hắn', đôi khi đánh giá thấp khả năng nếu player trẻ\n"
            "- Authority figures: test player bằng thách thức trực tiếp\n"
            "- Cultivation setting: 'đạo hữu', 'huynh', 'thiếu hiệp' tùy hoàn cảnh"
        )
    elif gender == "female":
        return (
            "- NPC lớn tuổi/có quyền lực: protective hoặc dismissive (tùy archetype NPC)\n"
            "  → Nếu NPC progressive/open-minded: tôn trọng sức mạnh, không phân biệt\n"
            "  → Nếu NPC truyền thống/prejudiced: thể hiện surprise khi player mạnh\n"
            "- NPC nam cùng tầng lớp: đa dạng — respectful/flirtatious/dismissive tùy character\n"
            "- NPC kẻ thù: 'ngươi', một số underestimate → tạo dramatic irony khi player thắng\n"
            "- NPC nữ khác: solidarity có thể xuất hiện tự nhiên trong cultivation setting\n"
            "- Cultivation setting: 'đạo hữu', 'muội', 'tiên tử' tùy hoàn cảnh\n"
            "⚠️ Không stereotype — female player phải được đối xử với dignity bất kể NPC bias"
        )
    return ""
```

## 3.3 Romance Dynamics by Gender

Khi story có tag `romance`, thêm layer này vào `_build_gender_context()`:

```
Player male + NPC female (tương thích):
→ Classic romantic tension: y không nhìn thẳng, hay tranh luận nhỏ để giữ khoảng cách
→ Makoto Shinkai style: khoảnh khắc bình thường nâng tầm

Player male + NPC male (tương thích):
→ Bromance → romance: từ rivalry sang mutual respect sang something more
→ Harder to articulate, more subtext, less explicit

Player female + NPC male (tương thích):
→ Same-page dynamic: NPC có thể bị intimidated hoặc fascinated bởi player mạnh
→ Power subversion: player female mạnh hơn NPC male tạo interesting dynamic

Player female + NPC female (tương thích):
→ Shared understanding: ít phải giải thích, nhiều silence có nghĩa hơn

Player neutral:
→ Attraction-agnostic: subtext tồn tại nhưng không specified
→ Companion có thể feel attraction nhưng không định danh
```

## 3.4 NPC Archetype Reaction Matrix

Companion profiles sẽ có `response_to_player_male` và `response_to_player_female`:

```
VD: Companion Elara (female, role=strategist)
  response_to_player_male:
    "Khi player nam hành động liều lĩnh, Elara bình tĩnh nhận xét với giọng khô khan.
     Khi player nam chứng tỏ intellect, Elara subtle show respect qua hành động (không lời).
     Không flirtatious, không motherly — peer-to-peer dynamic."

  response_to_player_female:
    "Với player nữ, Elara bớt formal hơn một chút — shared understanding ngầm.
     Không sisterhood cliché, nhưng khoảng cách giảm tự nhiên.
     Có thể share personal thought mà y sẽ không nói với player nam."
```

## 3.5 Files cần tạo/sửa

### Sửa có (nhỏ, không tạo file mới)

| File | Thay đổi |
|---|---|
| `app/models/pipeline.py` | Thêm `player_gender: str = "neutral"` vào `NarrativeState` |
| `app/narrative/context.py` | Thêm `_build_gender_context()` + inject block |
| `app/engine/orchestrator.py` | Pass `player_gender=player.gender` vào pipeline_input |
| `app/models/companion.py` | `CompanionProfile` đã có `response_to_player_male/female` |
| `app/prompts/scene_writer.md` | Thêm section "Gender-Aware NPC Dynamics" |

### scene_writer.md addition

```markdown
## Gender-Aware NPC Dynamics:
Khi "Player Gender" được cung cấp trong context:

**Player nam:**
- Authority NPCs: test player trực tiếp, ít protective
- Enemy NPCs: có thể đánh giá đúng sức mạnh, combat thẳng thắn
- Companion nữ: peer dynamic, bình tĩnh hơn khi player hấp tấp

**Player nữ:**
- Authority NPCs: một số bày tỏ surprise khi player vượt expectation (dramatic irony)
- Enemy NPCs: underestimate tạo openings — player exploit hoặc subvert
- Companion nam: respect earned qua action, không given
- ⚠️ KHÔNG viết female player như victim/damsel — luôn là protagonist active

**Player neutral:**
- NPCs react đến hành động, không assume gender
- Romance subtext tồn tại nhưng ambiguous

**QUAN TRỌNG:** Gender dynamics phải TINH TẾ — không stereotype thô, không political messaging.
Mục tiêu: tạo texture thực tế cho thế giới, không phải phát biểu về xã hội.
```

---

# IMPLEMENTATION ORDER & DEPENDENCIES

```
Sprint 1 (Phase 1 — Foundation):
├── app/models/companion.py                [NEW]
├── app/memory/companion_store.py          [NEW]
├── app/memory/state.py                    [ADD table + methods]
└── app/narrative/companion_context.py     [NEW]

Sprint 2 (Phase 1 — Pipeline Integration):
├── app/narrative/context.py               [ADD companion block]
├── app/models/pipeline.py                 [ADD companion_context field]
├── app/engine/orchestrator.py             [LOAD + PASS companions]
├── app/narrative/simulator.py             [OUTPUT affinity_deltas]
└── app/prompts/scene_writer.md            [ADD companion ability + affinity rules]

Sprint 3 (Phase 2 — Villain Power):
├── app/models/villain_power.py            [NEW]
├── app/data/villain_powers.json           [NEW — static seed]
├── app/memory/villain_power_store.py      [NEW]
├── app/narrative/villain_tracker.py       [EXTEND context injection]
├── app/models/world_state.py              [EXTEND GeneralStatus/EmissaryStatus]
└── app/prompts/scene_writer.md            [ADD villain ability rules]

Sprint 4 (Phase 3 — Gender-Aware):
├── app/models/pipeline.py                 [ADD player_gender]
├── app/narrative/context.py               [ADD gender context block]
├── app/engine/orchestrator.py             [PASS player_gender]
└── app/prompts/scene_writer.md            [ADD gender dynamics section]
```

**Estimated LOC:**
- Phase 1: ~600 lines new code + ~150 lines modifications
- Phase 2: ~300 lines new code + ~100 lines modifications
- Phase 3: ~100 lines new code + ~80 lines modifications

---

# DESIGN DECISIONS & TRADE-OFFS

## Companion là AI-generated hay hardcoded?

**Decision: AI-generated identity, rule-based tracking.**

- Companion personality, appearance, ability được AI tạo ra khi first encounter (qua Planner + Story Ledger)
- Sau khi established, `CompanionProfile` cố định tất cả fields quan trọng
- Affinity và ability synergy follow code rules (không phải AI decide)

**Lý do:** Hardcoded companions (như Emissary) giới hạn story diversity. Pure AI companions drift không nhất quán. Hybrid approach = flexibility + coherence.

## Affinity cập nhật khi nào?

**Decision: Cuối mỗi chapter (batch update, không real-time).**

- Simulator sau chapter phân tích toàn bộ choices → output affinity_deltas
- Không update mid-scene để tránh paradox (scene viết trước update xảy ra)

## Villain Power có affect combat resolution?

**Decision: Narrative-only affect, không dice roll.**

- Villain ability thay đổi OPTIONS available cho player (giảm/tăng risk levels)
- Không có hidden HP bar hay dice — combat resolution vẫn qua CombatBrief system
- Companion weakness bypass là soft (prose + choice options thay đổi), không hard override

## Gender awareness bao nhiêu là đủ?

**Decision: Texture layer, không simulation layer.**

- Gender chỉ inject vào context dưới dạng soft guidance
- Không enforce cứng nhắc (NPC không BẮT BUỘC react khác)
- AI writer nhận guidance và áp dụng theo judgment → natural feel, không mechanical

---

*End of Spec v1.0*
