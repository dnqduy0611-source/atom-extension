# AMOISEKAI — Weapon System Spec v1.0

> **Author:** Amo  
> **Date:** 2026-02-28  
> **Status:** Draft — Pre-implementation (Audited)  
> **Dependencies:** POWER_SYSTEM_SPEC v1.1, COMBAT_SYSTEM_SPEC v2.0, UNIQUE_SKILL_GROWTH_SPEC v1.2, CONSEQUENCE_ROUTER_SPEC  
> **Audit:** 2026-02-28 — 3 Critical + 6 Major + 5 Minor issues resolved

> Vũ khí trong Amoisekai không phải công cụ — chúng là di sản được mang theo.
> Một warrior mạnh mẽ có thể không cần skill tốt nếu có weapon đủ sâu.
> Một weapon đủ mạnh mang theo lịch sử của nó — và đôi khi, lịch sử đó chiến đấu thay bạn.

---

## 1. Triết Lý Thiết Kế

### Weapons như External Legacy

Trong khi Unique Skill phản ánh **bản thể nội tâm** của player (mọc từ bên trong theo hành vi), Weapon phản ánh **di sản ngoại tại** — thứ player **kiếm được quyền mang**.

| | Unique Skill | Weapon |
|---|---|---|
| Nguồn gốc | Từ bên trong (identity-driven) | Từ bên ngoài (world-driven) |
| Tăng trưởng | Hành vi liên tục qua chapters | Bonding + upgrade milestones |
| Mất được không | Không (permanent) | Không sau Soul-Link |
| Độc lập với nhau? | Có thể dùng skill mà không có weapon | Có thể dùng weapon mà không có skill tốt |

### Nguyên Tắc Cốt Lõi

1. **Weapon đứng độc lập**: Player không cần Unique Skill tốt nếu có weapon đủ grade. Awakened weapon + Signature Move = viable build không cần skill.
2. **Weapon có linh hồn**: Mỗi weapon mang Lore riêng, phản ứng với player's identity, thay đổi cosmetically theo alignment.
3. **Soul-Link là giao ước**: Không phải mechanic game — là covenant giữa player và weapon. Sau Soul-Link, weapon không thể bị tước đoạt.
4. **Archon-Fragment là huyền thoại sống**: Không thể duplicate, không thể craft, không thể farm. Chúng chờ đúng người.

---

## 2. Weapon Grade System

5 cấp bậc, tiến từ thường đến thần thánh.

### Grade Overview

| Grade | Tên | Tên Việt | Principle Slots | Combat Bonus | Protections |
|---|---|---|---|---|---|
| 1 | Mundane | Thường | 0 | +0.02 | None |
| 2 | Resonant | Cộng Hưởng | 1 | +0.05 | None |
| 3 | Soul-Linked | Tâm Liên | 1-2 | +0.10 | Theft + Destroy |
| 4 | Awakened | Giác Ngộ | 2 | +0.12 | Theft + Destroy |
| 5 | Archon-Fragment | Mảnh Archon | 3 | +0.15 | Theft + Destroy + Replicate |

> **Combat Bonus**: Flat additive to BuildFit component của Combat Score Formula.

---

### Grade 1: Mundane (Thường)

Weapon chưa có nguyên lý. Công cụ thuần túy.

- Không principle resonance
- Có thể stolen/destroyed như bình thường
- Lore: trống hoặc rất ngắn ("Mua tại chợ cảng")
- **Vai trò**: Starting weapon, placeholder. Player nên replace ngay khi có thể.
- **Combat**: +0.02 BuildFit

---

### Grade 2: Resonant (Cộng Hưởng)

Weapon đã thức tỉnh 1 nguyên lý. Bắt đầu có câu chuyện.

- 1 Primary Principle (bất kỳ trong 6 Core Principles)
- Lore Fragment: 1-2 câu lịch sử
- Vẫn có thể bị stolen/destroyed
- **Bond Score**: Bắt đầu theo dõi từ grade này
- **Combat**: +0.05 BuildFit
- **Synergy**: Nếu primary principle match với equipped skill → +0.03 skill combat bonus (xem §3 Weapon-Skill Resonance Synergy)

**Thăng cấp lên Soul-Linked**: Bond Score ≥ 80 (xem §5)

---

### Grade 3: Soul-Linked (Tâm Liên)

Ngưỡng quan trọng nhất. Weapon không còn là vật — nó là một phần của player.

- 1-2 Principles (secondary principle unlock khi Soul-Link)
- Weapon Lore đầy đủ (AI-generated hoặc pre-written)
- **Không thể bị stolen** — kẻ địch biết điều này, tránh cố gắng
- **Không thể bị destroyed permanently** — nếu bị đập vỡ: "dormant", không "destroyed". Phục hồi được.
- Soul-Link Event: narrative scene được AI viết, unique với từng player
- **Combat**: +0.10 BuildFit, +0.02 PlayerSkill (weapon "biết" player)
- **Cosmetic**: Weapon bắt đầu phản ứng với player instability (glow màu khác, temperature changes)

**Điều kiện đạt Awakened (từ Soul-Linked)**: Bond Score ≥ 85 + "Awakening Scene" tự nhiên trong chapter — Planner tích hợp khi threshold đạt. Player phải actively chọn dùng weapon trong hoàn cảnh có stakes cao (không phải combat thường). Khoảnh khắc này không thể tìm, chỉ có thể xứng đáng với nó.

---

### Grade 4: Awakened (Giác Ngộ)

Weapon thức tỉnh hoàn toàn. Signature Move v1 unlock.

- 2 Principles (cố định từ Soul-Link)
- **Signature Move v1**: AI-generated khi Awakening xảy ra (xem §7)
- Awakened Passive: minor buff luôn active (tùy principle combination)
- **Combat**: +0.12 BuildFit
- Signature Move khi trigger: +0.05 additional cho 1 combat phase (not cumulative per encounter)

**Phase 1 note**: Grade 4 weapon không có trong Phase 1 story. Data model defined. Có thể pre-define 1-2 story weapons ở Awakened cho future chapters.

---

### Grade 5: Archon-Fragment (Mảnh Archon)

Một mảnh vỡ của sức mạnh Archon — không phải do ai forge. Nó tồn tại từ trước.

- 3 Principles (luôn bao gồm Archon's primary principle)
- **Không có Signature Move**: Archon-Fragment có Divine Ability riêng (1 use/season)
- **Không thể replicate, craft, hay tìm lại** nếu đã bonded với người khác
- Soul-Linked ngay từ lúc acquit — không qua bond process
- **Global Passive**: luôn active, không cooldown
- **Combat**: +0.15 BuildFit, +0.03 PlayerSkill, +0.03 Environment modifier (weapon ảnh hưởng battlefield)
- Lore reveal: behavior-based progressive — Archon "kể" lịch sử khi player hành động align với principle của Archon đó. Hidden minimum chapter floor (không expose ra player). Mỗi player nhận lore theo pace riêng.

---

## 3. Weapon Principles

Mỗi weapon có 1-3 Core Principles từ hệ thống 6 nguyên lý:

```
ORDER ↔ ENTROPY
MATTER ↔ FLUX
ENERGY ↔ VOID
```

### Principle → Weapon Flavor

| Principle | Combat Style | Thematic Feel | Weapon Types Phù Hợp |
|---|---|---|---|
| Order | Structural damage, cooldown reduction | Kỷ luật, chính xác | Kiếm thẳng, giáo, thuẫn |
| Entropy | Stability drain, decay over time | Tàn phá, ăn mòn | Đao cong, vũ khí độc |
| Matter | Raw damage, durability | Nặng nề, áp đảo | Búa chiến, đại đao |
| Flux | Adaptability, counter-strike | Linh hoạt, biến hóa | Song kiếm, vũ khí ngắn |
| Energy | Burst damage, overdrive bonus | Sáng rực, polarity | Cung, đạn thạch |
| Void | Denial, absorption, nullification | Im lặng, hư vô | Roi, xiềng, vũ khí kỳ lạ |

### Weapon-Skill Resonance Synergy

Khi weapon principle match hoặc gần với equipped skill principle, skill hoạt động tốt hơn. Sử dụng adjacency graph từ Power System Spec:

```
Constructive cluster: {Order, Matter, Energy}
Deconstructive cluster: {Entropy, Flux, Void}
```

| Weapon Principle vs Skill Principle | Bonus |
|---|---|
| Identical match | +0.03 skill combat bonus |
| Adjacent (same cluster) | +0.02 skill combat bonus |
| Opposing | Neutral (no bonus, no penalty) |
| Weak (cross-cluster, non-adjacent) | -0.01 skill combat bonus |

> **Note**: Weapon không cần synergy với skill để effective. Grade bonus tự đứng độc lập.

> [!IMPORTANT]
> **Cross-Reference:** Table trên là **Weapon-Skill Resonance Synergy** — đo lường sự cộng hưởng giữa weapon principle và equipped skill principle (cùng phe = tốt).
> Đây KHÁC với **Principle Interaction** trong POWER_SYSTEM_SPEC §2.5 — đo lường combat advantage khi attacker principle đối đầu defender principle (opposing = STRONG +0.15).
> Hai hệ thống có mục đích khác nhau, chạy song song, không xung đột.

### Awakened Passive theo Principle Combination

> **Note:** Chỉ 6 same-cluster hoặc thematic pairs có Awakened Passive. Cross-cluster combinations (e.g., Order+Entropy, Matter+Void) không sinh passive — principles tự conflict, không synergize.

| Combination | Passive Name | Effect |
|---|---|---|
| Order + Matter | Iron Discipline | +5% stability recovery per phase |
| Order + Energy | Law of Force | +3% damage khi HP > 70% |
| Entropy + Void | Abyssal Hunger | +5% stability drain to opponent |
| Entropy + Flux | Liquid Chaos | Counter-strike +10% khi bị hit |
| Matter + Energy | Forged Fire | Overdrive cost -5% |
| Flux + Void | Shadow Step | Environment modifier +0.05 |

---

## 4. Archetype Slot System

Weapon slots phụ thuộc vào archetype — phản ánh combat philosophy của mỗi archetype.

### Slot Configuration

| Archetype | Slots | Configuration | Notes |
|---|---|---|---|
| **Vanguard** | 2 | Primary + Off-hand | Off-hand = shield OR secondary weapon (dual-wield) |
| **Wanderer** | 2 | Main + Utility | Utility = non-combat (traversal, survival). Không dùng làm combat weapon. |
| **Tactician** | 1 (Phase 1) | Primary only | Auxiliary system deferred to Phase 2. |
| **Sovereign** | 1 | Single (amplified) | Solo weapon nhưng bonus ×1.3 (Sovereign gắn toàn bộ identity vào 1 vũ khí) |
| **Other archetypes** | 1 | Standard | Default single slot |

### Slot Rules

- **Soul-Linked weapon luôn chiếm primary slot** — không thể để Soul-Linked weapon ở off-hand (nó chọn vị trí chính)
- **Vanguard dual-wield**: Cả 2 weapon phải Resonant+. Combat bonus = primary_grade_bonus × 0.70 + secondary_grade_bonus × 0.50. Ví dụ: 2× Resonant (+0.05 each) → effective = 0.05×0.70 + 0.05×0.50 = **0.060** (cao hơn single 0.05, nhưng mỗi cái bị discount riêng, không cộng thẳng)
- **Wanderer utility slot**: Utility weapon không contribute combat score. Khi equipped trong exploration: +15% discovery chance cho hidden lore nodes, secret paths, và inheritance weapons. Phản ánh archetype Wanderer — đánh đổi combat slot để có lore access rộng hơn.
- **Tactician auxiliary**: Deferred to Phase 2 — trong Phase 1, Tactician chỉ có 1 primary slot (như standard archetypes). Auxiliary system sẽ được spec riêng.
- **Sovereign amplification**: +30% flat trên tất cả weapon bonuses của slot đó (Grade bonus × 1.3)

---

## 5. Bond System & Soul-Link

### Bond Score

Bắt đầu theo dõi khi weapon ≥ Resonant. Range: **0-100** (pre-Awakened), **extended to 150** post-Awakened (xem §7 Signature Move v2 requirements).

> [!NOTE]
> Bond Score cap ở 100 trước khi weapon đạt Awakened. Sau Awakening, cap mở rộng lên 150 để track deep bond cho Signature Move evolution (v2 requires 101+, v3 requires higher).

**Bond Score tăng khi:**

| Sự kiện | Bond Score |
|---|---|
| Sử dụng weapon trong combat encounter | +3-5 |
| Survive near-death với weapon equipped | +8 |
| Narrative scene player chủ động chọn reference weapon | +5 |
| Kẻ địch cố steal weapon (thất bại) | +4 |
| Player sử dụng weapon trong soul_choice action category | +6 |
| Chapter kết thúc với weapon là "turning point" (Planner flag) | +10 |

**Bond Score giảm khi:**
| Sự kiện | Bond Score |
|---|---|
| Player không dùng weapon trong 3 chapters liên tiếp | -5/chapter |
| Player dùng weapon ngược với principle của nó (Planner flag) | -3 |

### Soul-Link Event

**Trigger**: Bond Score ≥ 80 trên Resonant weapon

**Process**:
1. Pipeline detect threshold crossed
2. Planner nhận flag `weapon_soul_link_pending = true`
3. Planner tích hợp Soul-Link moment vào chapter arc tự nhiên (không interrupt đột ngột)
4. Writer nhận directive: viết Soul-Link scene
5. Soul-Link scene: AI-generated prose, unique với player journey. Reference bond moments.
6. Post-event: weapon upgraded to Soul-Linked, second principle unlock

**Soul-Link Scene Input**:
```json
{
  "weapon_name": "...",
  "weapon_lore": "...",
  "player_archetype": "...",
  "top_bond_moments": ["moment 1", "moment 2", "moment 3"],
  "player_identity_summary": "...",
  "chapter_context": "..."
}
```

### Dormant State (khi Soul-Linked weapon "bị phá")

Soul-Linked weapon không thể destroyed — nhưng có thể bị đưa vào Dormant:

- **Trigger**: Enemy ability đặc biệt "force dormant" (chỉ boss tier), hoặc player alignment cực đoan trái ngược principle weapon trong nhiều chapters liên tiếp
- **Dormant**: Weapon tồn tại nhưng vô hiệu. Combat bonus = 0. Lore "tối đi". Writer mô tả weapon như vật chết, lạnh, không phản ứng.
- Dormant là **narrative punishment**, không phải permanent loss

**Phục hồi — Natural Story Progression**:
- Planner biết weapon đang dormant → weave recovery opportunity vào chapter arc một cách tự nhiên. Không tạo "quest recover weapon" riêng.
- Player đến một địa điểm high resonance vì lý do story của riêng họ (exploration, plot, NPC) — không phải vì hệ thống dẫn họ đến đó.
- Khi player ở đúng điều kiện (coherence ≥ 60 + resonant location), Writer nhận directive: weapon tự phản ứng — "ấm lên", "tiếng vang nhẹ", "ánh sáng mờ" — không có dialog box, không có confirmation.
- Recovery diễn ra trong prose tự nhiên. Player *cảm nhận* vũ khí sống lại, không được *thông báo* rằng nó đã phục hồi.

---

## 6. Ba Nguồn Lore Gốc

Mỗi weapon phải có 1 trong 3 nguồn gốc. Nguồn gốc quyết định acquisition path, lore style, và upgrade constraint.

---

### 6.1 Monster Core Imbuing (Lõi Quái Vật)

**Concept**: Quái vật chứa principle energy trong lõi của chúng. Nghiền lõi vào weapon → weapon hấp thụ principle đó.

**Acquisition Flow**:
```
Defeat monster → Drop Principle Core (% based on monster tier)
    ↓
Imbue into Resonant+ weapon at Principle Forge NPC
    ↓
Weapon gains/upgrades principle alignment
```

**Core Tiers**:

| Core Tier | Nguồn | Drop Rate | Effect |
|---|---|---|---|
| Shard (Mảnh) | Common monsters | 30% | +10% principle resonance |
| Core (Lõi) | Elite monsters | 10% | +25% resonance + minor Lore Fragment |
| Heart (Trái Tim) | Mini-boss | 3% | Unlock secondary principle |

**Soul Crystal — 3 Tiers của Tier Cao Nhất**:

Không phải 1 loại Soul Crystal — mà 3 rarity tiers, được quyết định tại thời điểm boss chết bởi CRNG + player state:

| Soul Crystal | Drop Condition | Effect | Đặc Biệt |
|---|---|---|---|
| **Pale Crystal** (Lờ Mờ) | Boss kill + weapon equipped | Principle reroll + short lore reveal | Base tier |
| **True Crystal** (Thuần Khiết) | Pale conditions + CRNG "favorable" trigger | Reroll + full lore + minor passive bonus | CRNG influenced bởi Fate Buffer level |
| **Sovereign Crystal** (Vương) | True conditions + coherence ≥ 75 tại thời điểm kill | Reroll + minor passive + Awakened shortcut unlock | Cực hiếm — player xứng đáng mới có |

**Luck mechanic**: Fate Buffer không chỉ ngăn chết — khi CRNG "favorable" trigger đúng lúc boss chết, Soul Crystal quality nâng từ Pale → True. Nếu coherence ≥ 75 đồng thời → True → Sovereign. Player không biết công thức, nhưng hành vi identity của họ tạo ra xác suất.

**Special: Soul Crystal Imbue**
- Khi imbue vào weapon → trigger Weapon Lore expansion (AI-generated, based on monster's history + crystal tier)
- Ví dụ: Sovereign Crystal của Shadow Serpent Elder → weapon gains Void resonance + extended lore + passive "Bóng Tối Nguyên Thủy" (minor Void principle amplify)
- Pale Crystal → ngắn: 1-2 câu. True Crystal → đầy đủ: đoạn văn. Sovereign Crystal → full Lore chapter reveal.

**Constraints**:
- Chỉ imbue được vào Mundane hoặc Resonant weapon (không modify Soul-Linked+)
- Mỗi weapon chỉ imbue tối đa 1 Core tại một thời điểm
- Multiple Shards cộng dồn, nhưng Heart và Soul Crystal ghi đè Shards
- Soul Crystal (mọi tier) + Soul-Linked weapon = **dùng làm Signature Move evolution resource** (xem §7)

---

### 6.2 History & Inheritance (Lịch Sử & Thừa Kế)

**Concept**: Những vũ khí này có trước player. Chúng đã có câu chuyện. Player tìm thấy chúng — hoặc đúng hơn, chúng tìm thấy player.

**Acquisition**:
- Story nodes: dungeon hidden room, NPC questline, lore-locked location
- Often already Resonant hoặc Soul-Linked grade khi found
- Acquisition condition thường liên quan đến **player identity** (coherence, alignment, archetype match)

**Lore Style**:
- Pre-written (không phải AI-generated) — có fixed history trong world lore
- Weapon "biết" lịch sử của nó. Writer có thể reference.
- Một số weapons có "Recognition Moment": NPC nhận ra weapon, có dialogue đặc biệt

**Upgrade Constraints**:
- **Không thể imbue Monster Core** (lore-locked — "The blade refuses foreign essence")
- Có thể bond naturally → Soul-Link bình thường
- Signature Move (khi Awakened): AI-generated **nhưng constrained** bởi historical context của weapon

**Ví Dụ Phase 1 Weapons (pre-written)**:

| Tên | Grade | Principle | Lore | Acquisition |
|---|---|---|---|---|
| Vô Hồi Đao | Resonant | Entropy | Đao của vị tướng cuối cùng của Đế chế cũ, bị bẻ gãy và forge lại | Hidden room, Floor 2 dungeon |
| Thần Vệ Thuẫn | Soul-Linked | Order | Thuẫn được một Herald của Aethis ban cho một chiến binh, truyền qua 3 thế hệ | NPC questline, requires coherence ≥ 70 |

---

### 6.3 Crafting (Rèn Đúc)

**Concept**: Player định hình weapon từ đầu — chọn principle, loại vũ khí, chất liệu. Không có fixed lore, nhưng lore sẽ được viết bởi AI dựa trên crafting choices.

**Crafting Flow**:
```
Player specifies: weapon type + desired principle + available materials
    ↓
Master Craftsman NPC evaluates (material quality → max achievable grade)
    ↓
Crafting scene (1-2 chapters, story-integrated)
    ↓
Weapon created với Lore generated from crafting context
```

**Material Tiers**:

| Material Tier | Max Grade | Example Materials |
|---|---|---|
| Common | Mundane | Iron, wood, basic hide |
| Uncommon | Resonant | Principle-infused alloy, monster bone |
| Rare | Resonant (high resonance) | Floor 3+ materials, purified cores |
| Masterwork | Awakened (exceptional crafting) | World-specific materials, NPC ritual |

**Masterwork Crafting (Phase 2)**:
- Cần: Rare+ materials + Master-tier NPC + specific conditions (moon phase, location resonance, etc.)
- Có thể reach Awakened grade — nhưng exceptional, không thể farm
- Phase 1: chỉ đến Resonant

**Crafting Lore Generation**:
```json
{
  "prompt_input": {
    "weapon_type": "straight sword",
    "primary_principle": "order",
    "materials_used": ["principle-infused steel", "order crystal shard"],
    "craftsman_name": "Lão Thợ Rèn Torvak",
    "player_archetype": "vanguard",
    "crafting_intent": "player stated: kiếm đại diện cho sự kỷ luật của ta"
  }
}
```

**Unique Advantage**:
- Player có influence từ đầu về principle và style → emotional ownership cao hơn
- Không bị lore-locked về upgrade path (có thể imbue Core sau)
- "Blank slate" — writer không bị constrain bởi pre-written lore

---

## 7. Signature Move System (AI-Generated, Evolution-Based)

### Triết Lý

Signature Move không phải thứ được chọn một lần rồi giữ mãi — nó **lớn lên cùng player**. Khi player và weapon thay đổi, Signature Move phản ánh sự thay đổi đó. Không có "reject" — chỉ có "grow."

### Ba Tầng Evolution

```
Awakened unlock
    ↓
Signature Move v1 — "Hạt Giống" (seed form)
    ↓
[Bond Score 101-150 + True Crystal + soul_choice moment]
    ↓
Signature Move v2 — "Trưởng Thành" (deepened form, mechanic stronger)
    ↓
[Unique Skill ≥ Aspect + Sovereign Crystal]
    ↓
Signature Move v3 — "Hợp Nhất" (final form, weapon và player là một)
```

### Tier 1: v1 — Hạt Giống (Seed Form)

**Trigger**: Awakening Scene tự nhiên (Bond Score ≥ 85 + Planner-placed narrative moment)

**AI Generation Input**:
```json
{
  "evolution_tier": 1,
  "weapon_name": "Tên vũ khí",
  "weapon_principles": ["energy", "void"],
  "weapon_lore_summary": "Tóm tắt 2-3 câu lịch sử vũ khí",
  "player_archetype": "vanguard",
  "player_key_moments": [
    "Chapter 3: survive near-death với weapon equipped",
    "Chapter 5: sử dụng weapon trong soul_choice moment"
  ],
  "unique_skill_stage": "bloom",
  "player_identity_summary": "Tóm tắt alignment + coherence hiện tại"
}
```

**Output**: Move name + 2-câu description + mechanical_effect + narrative_note

**Combat bonus**: +0.05 additive cho 1 combat phase

---

### Tier 2: v2 — Trưởng Thành (Deepened Form)

**Requirements**:
- Bond Score 101+ (tracked tiếp sau Awakened)
- Consume 1 **True Crystal** (hoặc Sovereign Crystal)
- 1 `soul_choice` moment trong chapter đó liên quan đến weapon

**AI Generation Input** (thêm so với v1):
```json
{
  "evolution_tier": 2,
  "v1_move_name": "Tên v1 — AI sẽ build lên từ đây",
  "v1_move_description": "...",
  "bond_moments_since_v1": ["moment 1", "moment 2"],
  "unique_skill_stage": "aspect hoặc cao hơn (nếu có)"
}
```

**Output**: Move name (deepened, có thể giữ phần tên v1), longer description (3-4 câu), stronger mechanical_effect

**Combat bonus**: +0.07 additive (nâng từ 0.05)

---

### Tier 3: v3 — Hợp Nhất (Final Form)

**Requirements**:
- Unique Skill ≥ Aspect stage
- Consume 1 **Sovereign Crystal**
- Weapon đã tham gia ít nhất 1 Climax encounter

**AI Generation Input** (thêm so với v2):
```json
{
  "evolution_tier": 3,
  "v2_move_name": "...",
  "unique_skill_name": "...",
  "unique_skill_aspect": "aspect_chosen",
  "climax_chapter_summary": "Tóm tắt chapter climax weapon đã góp mặt"
}
```

**Output**: Move name (có thể hoàn toàn mới, hoặc synthesis v1+v2), 4-5 câu description, dual mechanical_effect (weapon + skill synergy)

**Combat bonus**: +0.10 additive — nhưng thêm `principle_resonance_burst`: nếu invoke cùng chapter với Unique Skill → cộng thêm +0.03

---

### Constraints cho AI (mọi tier)

- Tên move phải cổ kính ("Tuyệt Kỹ", "Thiên Địa", "Vô Ảnh" là được — không dùng tiếng Anh hoặc tên hiện đại)
- Effect phải match principle combination (Energy+Void không thể generate "armor buff")
- Archetype-aware: Vanguard = frontal force; Wanderer = environmental; Tactician = setup/delay; Sovereign = authority
- **v2 phải cảm giác là evolution của v1, không phải replacement** — AI nhận v1 làm base
- **v3 phải hợp nhất weapon identity và Unique Skill identity** — cả hai visible trong description

### Combat Usage (mọi tier)

- 1 lần per encounter (không per scene)
- Consumed flag reset sau khi encounter kết thúc
- Writer **bắt buộc** mô tả Signature Move cinematically khi player invoke
- Tier càng cao → prose mô tả càng epic (Writer nhận `signature_tier` trong weapon_context)

---

## 8. Archon-Fragment Weapons

### Lore

Khi The First Fracture xảy ra ~3000 năm trước, năm Archon — Aethis, Vyrel, Morphael, Dominar, Seraphine — đổ năng lượng của họ vào thế giới để ngăn Grand Gate sụp đổ. Năng lượng đó kết tinh thành những mảnh vũ khí. Không ai forge chúng. Chúng tự hình thành.

5 Archon → Tối đa 5 Fragment weapons trong thế giới. Mỗi cái duy nhất vĩnh viễn.

### Five Fragments

| Fragment | Archon | Principles | Global Passive | Divine Ability (1/season) |
|---|---|---|---|---|
| Lex Primordialis | Aethis (Order) | Order + Matter + Energy | Opponent stability drain 2% per phase | "Absolute Decree" — 1 combat phase outcome forced Favorable regardless of score |
| Veil Unbound | Vyrel (Freedom) | Entropy + Flux + Void | Cannot be slowed/bound by environmental penalties | "Freedom Cascade" — negate next 2 debuffs + bonus phase |
| Morphic Hunger | Morphael (Evolution) | Flux + Energy + Matter | +1% combat bonus per chapter this weapon was used (max +5%) | "Adaptive Apex" — copy opponent's principle strength for 1 phase |
| Iron Dominion | Dominar (Control) | Matter + Void + Order | +0.03 Environment modifier always | "Sovereign Command" — force opponent into Stabilize action next decision point |
| Grace Eternal | Seraphine (Devotion) | Energy + Matter + Order | Fate Buffer charges +1 when coherence ≥ 80 | "Eternal Devotion" — fully restore stability at cost of 20% HP |

### Phase 1 Availability

**2 Fragments hidden in Phase 1** (recommended: **Veil Unbound** và **Iron Dominion** — thematic fit với The Great Awakening arc).

**Acquisition conditions (behavior-based, NOT power-gated)**:

*Veil Unbound (Vyrel)*:
- Player accumulated ≥ 3 "freedom assertion" moments (narrative choices involving defying authority/binding)
- Current arc does NOT involve faction loyalty
- Identity alignment < -20 (freedom-leaning) hoặc specific soul_choice moment

*Iron Dominion (Dominar)*:
- Notoriety ≥ 30 với ít nhất 1 faction
- Player đã demonstrate control/leadership trong ≥ 2 chapters
- Archetype: preferably Sovereign hoặc Tactician (không hard requirement)

**Hidden Mechanic**: Player không thể "search" cho Fragment. Fragment xuất hiện khi conditions đúng — NPC dẫn đến nó, hoặc dungeon path tự mở ra. Lần đầu encounter, weapon không reveal là Archon-Fragment. Lore dần dần unlock.

### Archon-Fragment Rules

- Soul-Linked **ngay từ đầu** (không cần bond process)
- Không có Signature Move — Divine Ability thay thế (và powerful hơn nhiều)
- Không có secondary lore origin: chúng là `archon` origin
- Không thể imbue Monster Core (from Fragment's perspective: "Tôi đã đủ đầy")
- Lore reveal: behavior-based — mỗi lần player hành động align với Archon's principle → 1 lore fragment reveal trong prose (weapon tự "kể"). Hidden minimum chapter floor enforced by system, không thông báo cho player. Mỗi người nhận lore theo journey riêng.
- Combat: +0.15 BuildFit, +0.03 PlayerSkill, +0.03 Environment

---

## 9. Combat Integration

### Weapon Contribution to Combat Score Formula

```
CombatScore = BuildFit(45%) + PlayerSkill(30%) + Environment(15%) + Randomness(10%)
```

**Weapon modifies:**
- **BuildFit** (primary): Grade bonus + Principle match bonus
- **PlayerSkill** (secondary): Soul-Link knowledge bonus (weapon "anticipates" player)
- **Environment**: Archon-Fragment global passive (+0.03)

### Detailed Breakdown

```
BuildFit contribution (max 45%):
├── Resonance alignment (25%): includes weapon principle match
│   ├── Weapon grade bonus: +0.02 to +0.15 flat
│   └── Weapon-opponent principle advantage: +0.03
│       (counter = opposing pair: Order↔Entropy, Matter↔Flux, Energy↔Void
│        per POWER_SYSTEM_SPEC §2.5. Multi-principle: check primary only)
└── Principle advantage (20%): unchanged from Power System Spec

PlayerSkill contribution (max 30%):
├── DQS (20%): unchanged
├── Stability (10%): unchanged
└── Soul-Link bonus: +0.02 flat additive
    (added after DQS+Stability calc, before ×0.30 weight)

Signature Move (Awakened only):
└── Flat additive to BuildFit component cho 1 combat phase.
    v1: +0.05, v2: +0.07, v3: +0.10.
    Included in WEAPON_BUILDFIT_CAP (0.20) và WEAPON_TOTAL_EFFECTIVE_CAP (0.10).

Archon-Fragment additional:
└── +0.03 Environment on top of normal environment calculation
```

**BuildFit cap**: Weapon contribution to BuildFit capped at +0.20 (grade + match combined).

**Total Weapon Effective Cap**: Weapon total effective contribution to **final combat score** (sau khi nhân weight) capped at **+0.10**:

```python
WEAPON_BUILDFIT_CAP = 0.20          # Max weapon flat additive to BuildFit component
WEAPON_TOTAL_EFFECTIVE_CAP = 0.10   # Max weapon contribution to final combat score

# Calculation:
weapon_effective = (
    min(weapon_buildfit_total, WEAPON_BUILDFIT_CAP) * W_BUILD_FIT    # 0.45
    + weapon_playerskill_bonus * W_PLAYER_SKILL                      # 0.30
    + weapon_environment_bonus * W_ENVIRONMENT                       # 0.15
)
weapon_effective = min(weapon_effective, WEAPON_TOTAL_EFFECTIVE_CAP)
```

**Effective impact per grade (sau weight):**

| Grade | BuildFit×0.45 | PSkill×0.30 | Env×0.15 | **Total Effective** |
|---|---|---|---|---|
| Mundane | 0.009 | — | — | **0.009** |
| Resonant | 0.023 | — | — | **0.023** |
| Soul-Linked | 0.045 | 0.006 | — | **0.051** |
| Awakened | 0.054 | 0.006 | — | **0.060** |
| Archon-Fragment | 0.068 | 0.009 | 0.005 | **0.081** |
| Archon + Sig v3 | 0.068+0.045 | 0.009 | 0.005 | **0.100** (capped) |

> [!IMPORTANT]
> **Design Intent:** Archon-Fragment combat contribution (~0.08 effective) intentionally exceeds Unique Skill V2 cap (~0.05 effective). Archon-Fragment là 5 vật thể hiếm nhất thế giới — divine power vượt trội so với ability bẩm sinh là correct theo lore. Total Weapon Effective Cap = 0.10 ngăn weapon stacking (Archon + Signature Move) trivialize mọi content.
>
> **Max-build player (Archon + Ultimate Skill + Sig v3) final score bonuses:**
> - Weapon effective: +0.10 (capped)
> - Unique Skill V2: +0.05 (capped in Randomness component)
> - Total boost: +0.15 maximum trên 0.0-1.0 score
> - Player vẫn cần build_fit tốt và DQS cao. +0.15 chỉ chuyển Mixed→Favorable, không trivialize Boss.

### Writer Integration: weapon_context

Khi có combat encounter, CombatBrief nhận thêm `weapon_context`:

```json
{
  "weapon_name": "Vô Hồi Đao",
  "weapon_grade": "soul_linked",
  "weapon_principles": ["entropy"],
  "soul_linked": true,
  "signature_available": false,
  "signature_move_name": "",
  "signature_tier": 0,
  "archon_fragment": false,
  "bond_moments_count": 4,
  "weapon_lore_summary": "Đao của vị tướng cuối cùng..."
}
```

Writer **bắt buộc** reference weapon trong combat prose nếu Soul-Linked+. Mundane: silent (không reference). Resonant: optional. Khi `signature_available = true`, Writer nhận `signature_tier` để calibrate độ epic của prose mô tả.

---

## 10. Pipeline Integration

### NarrativeState Extensions

```python
# Thêm vào NarrativeState (models/pipeline.py)
weapon_soul_link_pending: bool = False   # flag cho Planner
weapon_bond_updates: list[dict] = []     # bond score changes từ chapter
weapon_signature_used: bool = False      # reset sau encounter
```

### PlayerState Extensions

```python
# Thêm vào PlayerState (models/player.py)
equipped_weapons: PlayerWeaponSlots = PlayerWeaponSlots()
weapon_history: list[str] = []          # IDs của weapons đã từng bond
```

### Pipeline Flow Changes

**After each scene:**
- Bond Score update: `+bond_delta` based on scene events
- Check threshold: bond_score ≥ 80 → set `weapon_soul_link_pending = True`

**Planner node:**
- If `weapon_soul_link_pending`: integrate Soul-Link moment into chapter arc
- If `action_category == "skill_use"` với skill_reference = `"{weapon}.signature"`: set `weapon_signature_used = True`

**Writer node:**
- Receives `weapon_context` dict
- If `weapon_signature_used`: bắt buộc mô tả Signature Move
- If `weapon_soul_link_pending` và trong chapter: viết Soul-Link scene khi được Planner place

**After encounter ends:**
- Reset `weapon_signature_used = False`

### Enhanced Intent Classifier Integration

Với weapon system active, `equipment` category trong Intent Classifier **không còn pending**:

```json
{
  "action_category": "equipment",
  "feasibility": "possible",
  "feasibility_note": "Player trang bị Vô Hồi Đao vào primary slot"
}
```

Signature Move invoke → classified as `skill_use` với:
```json
{
  "skill_reference": "Vô Hồi Đao.signature",
  "action_category": "skill_use"
}
```

### Consequence Router Integration

- **Principle alignment consequence**: Weapon principle trái ngược với player's DNA affinity → `identity_alignment` signal cho Router
- **Archon-Fragment acquisition**: Consequence chain với `cascade_risk: "high"` (divine entities notice)
- **Soul-Link event**: Minor `coherence_change` bonus passed via `faction_implications` (neutral, positive)
- **Faction implications**: Iron Dominion acquisition → Empire faction notoriety +5 (they recognize it)

### Context Weight Agent Integration

Weapon state ảnh hưởng identity delta:

- Sử dụng weapon có principle trái ngược alignment liên tục: `alignment_change` drift signal
- Soul-Link event trong chapter: `coherence_change` +1.5 (stabilizing effect)
- Archon-Fragment acquisition: flag `new_flags: ["archon_bond"]` → special CWA handling

---

## 11. Data Models

### Pydantic Models

```python
from enum import Enum
from typing import Optional
from pydantic import BaseModel


class WeaponGrade(str, Enum):
    mundane = "mundane"
    resonant = "resonant"
    soul_linked = "soul_linked"
    awakened = "awakened"
    archon_fragment = "archon_fragment"


class WeaponOrigin(str, Enum):
    monster_core = "monster_core"
    inheritance = "inheritance"
    crafting = "crafting"
    archon = "archon"


class SoulCrystalTier(str, Enum):
    pale = "pale"           # base — principle reroll + short lore
    true_crystal = "true_crystal"   # CRNG-boosted — reroll + full lore + minor passive
    sovereign = "sovereign"         # coherence ≥ 75 — reroll + passive + Awakened shortcut


class SignatureMove(BaseModel):
    evolution_tier: int = 1         # 1 | 2 | 3
    name: str
    description: str
    mechanical_effect: str          # "stability_burst" | "damage_amplify" | "principle_override" | "denial_wave"
    mechanical_value: float = 0.05  # tier 1: 0.05, tier 2: 0.07, tier 3: 0.10
    secondary_effect: str = ""      # tier 3 only: synergy with Unique Skill
    narrative_note: str
    activation_cue: str = ""
    # v1 preserved for AI context when evolving
    v1_name: str = ""
    v1_description: str = ""


class WeaponLore(BaseModel):
    origin: WeaponOrigin
    history_summary: str
    key_event: str = ""
    lore_fragments_revealed: int = 0    # for Archon-Fragment progressive reveal


class Weapon(BaseModel):
    id: str
    name: str
    weapon_type: str                # "sword" | "axe" | "bow" | etc.
    grade: WeaponGrade
    primary_principle: str
    secondary_principle: str = ""
    tertiary_principle: str = ""    # Archon-Fragment only
    lore: WeaponLore
    bond_score: float = 0.0         # 0-100 pre-Awakened, 0-150 post-Awakened
    soul_linked: bool = False
    dormant: bool = False
    signature_move: Optional[SignatureMove] = None
    awakened_passive: str = ""      # from principle combination table
    is_archon_fragment: bool = False
    archon_source: str = ""         # "aethis" | "vyrel" | etc.
    chapters_used: int = 0          # for Morphic Hunger passive


class PlayerWeaponSlots(BaseModel):
    """Archetype-aware weapon slot configuration."""
    primary: Optional[Weapon] = None
    secondary: Optional[Weapon] = None      # Vanguard: off-hand or dual-wield
    utility: Optional[Weapon] = None        # Wanderer: non-combat utility


class WeaponBondEvent(BaseModel):
    """Recorded bond moment for Soul-Link scene generation."""
    chapter: int
    event_type: str                 # "near_death" | "soul_choice" | "combat_turning_point" | etc.
    description: str
    bond_delta: float
```

---

## 12. Phase Scope & Complexity Assessment

> Đánh giá complexity dựa trên codebase thực tế: LangGraph pipeline 8 nodes, engine/ riêng biệt, models/ Pydantic, narrative/ agents.
> Scale: ⭐ Trivial → ⭐⭐⭐⭐⭐ Rất phức tạp / nhiều system phụ thuộc

---

### Phase 1A — Foundation (Core Weapon System) | ⭐⭐⭐

**Mục tiêu**: Player có thể có weapon. Weapon có ý nghĩa trong story. Hệ thống bond và soul-link hoạt động.

**Files mới:**
- `app/models/weapon.py` — toàn bộ Pydantic models (`Weapon`, `PlayerWeaponSlots`, `SignatureMove`, `WeaponLore`, `WeaponBondEvent`, `SoulCrystalTier`)
- `app/engine/weapon_bond.py` — Bond Score tracking, threshold detection, Soul-Link trigger

**Files modify:**
- `app/models/player.py` — thêm `equipped_weapons: PlayerWeaponSlots`
- `app/models/pipeline.py` — thêm `weapon_soul_link_pending`, `weapon_bond_updates`, `weapon_signature_used`, `weapon_dormant`
- `app/engine/combat.py` — thêm weapon grade bonus vào BuildFit formula
- `app/narrative/planner.py` — đọc `weapon_soul_link_pending` flag, tích hợp Soul-Link moment vào arc
- `app/narrative/writer.py` — nhận `weapon_context` dict, Soul-Link scene generation, Dormant state prose
- `app/narrative/input_parser.py` / Enhanced Intent Classifier — `equipment` category active

**Data (không phải code):**
- 2 pre-written Inheritance weapons (JSON hoặc hardcoded constants)

**Deliverables:**
- [ ] Weapon Pydantic models
- [ ] Bond Score system (event-driven counter)
- [ ] Soul-Link Event (AI prose — Writer-style call, không phải agent riêng)
- [ ] Grade 1-3: Mundane, Resonant, Soul-Linked
- [ ] Archetype slot configuration
- [ ] Combat Score: weapon grade bonus to BuildFit
- [ ] Writer: `weapon_context` dict, Mundane = silent
- [ ] 2 pre-written Inheritance weapons
- [ ] Intent Classifier: `equipment` category active
- [ ] Wanderer utility: +15% discovery chance (exploration flag)

**Why ⭐⭐⭐**: Nhiều files nhưng patterns quen thuộc. Soul-Link = Writer call tương tự existing pattern. Combat = formula addition. Không có AI agent mới, không có cross-system dependency phức tạp.

---

### Phase 1B — Monster Core System | ⭐⭐

**Mục tiêu**: Upgrade path qua combat. Player cảm giác được từ farming.

**Files mới:**
- `app/engine/monster_core.py` — drop logic (Shard, Core, Heart), imbue logic, principle modification

**Files modify:**
- `app/narrative/simulator.py` / Consequence Router — thêm Core drop event vào consequences
- `app/routers/story.py` — endpoint imbue Core vào weapon
- `app/prompts/` — lore expansion prompt khi imbue Core (minor)

**Deliverables:**
- [ ] Monster Core: Shard + Core + Heart drop tables (probability + monster tier)
- [ ] Imbue endpoint: apply Core → weapon principle modification
- [ ] Principle Forge NPC (story node, không phải real NPC system)
- [ ] Basic Crafting: NPC dialogue → weapon creation (Mundane/Resonant only)
- [ ] Crafted weapon lore: AI-generated từ crafting context (1 AI call)

**Blockers**: Không. Chạy độc lập sau Phase 1A.

**Why ⭐⭐**: Drop logic = probability table. Imbue = state mutation. Không có Planner/Writer complexity. Crafting lore = 1 AI call đơn giản.

---

### Phase 1C — Archon-Fragment (Hidden) | ⭐⭐⭐⭐

**Mục tiêu**: Hidden endgame content. 2 Archon-Fragment weapons tồn tại trong world, player không biết đến cho đến khi đủ điều kiện.

**Behavior Tracking — Thiết kế sau review:**
Thay vì file `behavior_tracker.py` + generic `behavior_flags: dict[str, int]` (unbounded, risk phình khi 200+ chapters), dùng **`archon_affinity: dict[str, int]`** bounded chặt tối đa 5 keys:

```python
# app/models/player.py
archon_affinity: dict[str, int] = {}
# keys cố định: "vyrel" | "aethis" | "morphael" | "dominar" | "seraphine"
# mỗi key chỉ increment, không bao giờ vượt quá 5 Archon → không bao giờ phình
```

Classifier **rule-based**, tái dụng output của Context Weight Agent (không có LLM call mới):

```python
# Đặt trong app/narrative/orchestrator.py (không cần file mới)
def _classify_archon_affinity(state: NarrativeState) -> str | None:
    """Returns Archon key nếu chapter này có signal rõ ràng, else None."""
    delta = state.identity_delta  # từ CWA — đã có sẵn
    cat   = state.action_category  # từ Intent Classifier — đã có sẵn

    # Thresholds cao để tránh false-positive — chỉ moments thực sự có tính cách
    if delta.alignment_change < -1.5 and cat in ("stealth", "exploration", "soul_choice"):
        return "vyrel"      # Freedom/Erosion
    if delta.notoriety_change > 1.0 and cat in ("social", "combat"):
        return "dominar"    # Control/Dominance
    if delta.coherence_change > 1.0 and cat in ("soul_choice", "exploration"):
        return "aethis"     # Order/Transcendence
    if delta.drift_detected and cat in ("exploration", "stealth"):
        return "morphael"   # Evolution/Transformation
    if delta.alignment_change > 1.5 and cat in ("social", "soul_choice"):
        return "seraphine"  # Devotion/Grace
    return None  # Đa số chapters không trigger gì

def check_fragment_conditions(player: PlayerState) -> str | None:
    """Pure Python — không có LLM call."""
    aff = player.archon_affinity or {}
    if aff.get("vyrel", 0) >= 3 and player.alignment < -20:
        return "veil_unbound"
    if aff.get("dominar", 0) >= 2 and player.notoriety >= 30:
        return "iron_dominion"
    return None
```

**UX & Story Rigidity:**
- Player không thấy số affinity. UX manifest qua 3 lớp:
  1. **Fragment discovery** — weapon xuất hiện tự nhiên, lore phản ánh journey của player
  2. **Soft-hint cho Writer** — Context node tính `dominant_archon`, truyền vào writer prompt như optional signal ("weave subtle echoes if fitting"). Writer có thể ignore. Tạo flavor personalization, không phải plot constraint.
  3. **Ambient prose** — khi affinity ≥ 2 (gần threshold), Writer nhận hint nhẹ hơn: environment phản ứng với character, không cần nói thẳng "bạn sắp unlock."
- **Story rigidity thấp**: Classifier chặt (hầu hết chapters return None). Affinity chỉ là unlock gate — story sau Fragment vẫn viết tự do. Multiple affinities = player portrait phức tạp, không phải single-path lock.

**Files mới:** Không có. Classifier + condition check nằm trong `orchestrator.py`.

**Files modify:**
- `app/models/player.py` — thêm `archon_affinity: dict[str, int] = {}`
- `app/models/pipeline.py` — thêm `dominant_archon: str | None` (optional context signal)
- `app/narrative/orchestrator.py` — `_classify_archon_affinity()` + `check_fragment_conditions()` + increment logic
- `app/narrative/context.py` — tính `dominant_archon` từ affinity, đưa vào context dict
- `app/narrative/planner.py` — check Fragment acquisition conditions, dẫn player đến Fragment tự nhiên
- `app/narrative/writer.py` — nhận `dominant_archon` soft-hint + Fragment lore reveal directive
- `app/engine/combat.py` — Divine Ability override (score forced Favorable for 1 phase)

**Data:**
- 2 Archon-Fragment weapon definitions (Veil Unbound, Iron Dominion) với full lore text pre-written

**Deliverables:**
- [ ] `archon_affinity` field trong PlayerState (5 keys max, bounded)
- [ ] `_classify_archon_affinity()` rule-based classifier trong orchestrator
- [ ] `check_fragment_conditions()` pure Python gate check
- [ ] `dominant_archon` soft-hint: context node → writer node (optional, ignoreable)
- [ ] Acquisition condition: Veil Unbound (vyrel ≥ 3 + alignment < -20) + Iron Dominion (dominar ≥ 2 + notoriety ≥ 30)
- [ ] Fragment discovery integration (Planner weaves encounter naturally)
- [ ] Lore reveal: behavior-based, hidden minimum floor, progressive
- [ ] Divine Ability: combat score override cho 1 phase (Climax only)

**Blockers**: Phase 1A hoàn chỉnh. Có thể chạy song song với 1B.

**Why ⭐⭐⭐⭐**: Không còn file mới nhưng cross-chapter state tracking vẫn là pattern mới trong pipeline. Hidden condition evaluation = logic phức tạp. Fragment discovery cần Planner hiểu "dẫn đến weapon" narrative, không phải explicit. Divine Ability override = special case trong combat engine. Complexity giảm từ ⭐⭐⭐⭐⭐ xuống ⭐⭐⭐⭐ vì không có behavior_tracker.py riêng.

---

### Phase 2A — Awakened + Signature Move v1 | ⭐⭐⭐⭐

**Mục tiêu**: Grade 4 Awakened hoạt động. Signature Move v1 được generate. Soul Crystal system kết nối với CRNG.

**Files mới:**
- `app/narrative/signature_move_agent.py` — AI agent mới, generate Signature Move v1 từ weapon + player context
- `app/prompts/signature_move.md` — system prompt cho agent
- `app/engine/soul_crystal.py` — Soul Crystal drop (Pale/True/Sovereign), CRNG + coherence integration

**Files modify:**
- `app/engine/crng.py` — thêm "soul_crystal_quality" event type (không break existing breakthrough/rogue)
- `app/engine/fate_buffer.py` — expose fate_buffer level để soul_crystal.py đọc
- `app/narrative/planner.py` — detect `weapon_awakening_pending`, orchestrate Awakening Scene
- `app/narrative/writer.py` — Awakening Scene directive, Signature Move reveal prose
- `app/config.py` — thêm `signature_move_model`

**Deliverables:**
- [ ] Grade 4 Awakened: full state + Awakening Scene trigger
- [ ] Awakening Scene: Planner-orchestrated, Bond ≥ 85 + stakes moment
- [ ] Signature Move v1 AI agent (temperature 0.3, new prompt)
- [ ] Soul Crystal: Pale/True/Sovereign drop system
- [ ] CRNG integration: Fate Buffer → Crystal quality escalation
- [ ] Combat: Signature Move +0.05 burst, `signature_tier` in weapon_context

**Blockers**: Phase 1A. CRNG system phải extensible (đọc code `crng.py` trước khi modify).

**Why ⭐⭐⭐⭐**: Awakening Scene = Planner orchestration type mới (không phải normal beat planning). Signature Move = AI agent hoàn toàn mới với prompt engineering phức tạp (cổ kính, archetype-aware, principle-constrained). CRNG extension = timing-sensitive, phải intercept boss kill moment đúng chỗ.

---

### Phase 2B — Signature Move Evolution | ⭐⭐⭐⭐⭐

**Mục tiêu**: Signature Move lớn lên cùng player. v2 → v3 với resource consumption và Unique Skill synthesis.

**Files mới:**
- `app/engine/resource_consumption.py` — consume Crystal từ inventory, transaction pattern

**Files modify:**
- `app/narrative/signature_move_agent.py` — thêm v2 + v3 generation logic (context chaining)
- `app/prompts/signature_move.md` — extend prompt cho v2/v3 instructions
- `app/models/weapon.py` — Bond Score 101+ tracking (post-Awakened extension)
- `app/models/pipeline.py` — `weapon_evolution_pending` flag
- `app/engine/combat.py` — `principle_resonance_burst` mechanic (v3 + Unique Skill combo)

**Deliverables:**
- [ ] Signature Move v2: True Crystal consumption + soul_choice detection + AI generation với v1 context
- [ ] Signature Move v3: Sovereign Crystal + Aspect stage + Climax encounter requirement
- [ ] Bond Score 101-150 tracking (separate từ pre-Awakened)
- [ ] `principle_resonance_burst`: +0.03 khi invoke v3 cùng chapter với Unique Skill
- [ ] Resource consumption pipeline

**Blockers**: ⚠️ **Phase 2A hoàn chỉnh** + ⚠️ **Unique Skill Aspect stage đã implemented** (check `unique_skill_growth.py` — model đã có nhưng logic chưa chắc complete). v3 không thể làm nếu Aspect stage chưa có.

**Why ⭐⭐⭐⭐⭐**: v3 = cross-system synthesis giữa Weapon và Unique Skill — cần cả hai systems trưởng thành. AI context chaining (v1 → v2 → v3) = prompt engineering phức tạp nhất trong toàn hệ thống. Resource consumption = transaction pattern mới. principle_resonance_burst = timing logic trong combat pipeline.

---

### Phase 2C — Completion & Polish | ⭐⭐⭐

**Mục tiêu**: Lấp các khoảng trống còn lại. Masterwork crafting, Dormant recovery, Tactician auxiliary.

**Files:**
- Masterwork crafting: extend `monster_core.py` + new material catalog data
- Dormant recovery: Planner modification (weave recovery opportunity)
- Tactician auxiliary: new spec + implementation (riêng)
- Weapon cosmetics: Writer directive only (no new code, chỉ prompt update)
- More Monster Core tiers: Heart (nếu chưa làm trong 1B)

**Blockers**: Tactician auxiliary cần spec riêng trước. Masterwork cần material system defined.

**Why ⭐⭐⭐**: Phần lớn là extension của existing systems, không phải greenfield.

---

### Phase 3 — Expansion | ⭐⭐⭐⭐⭐ (TBD)

- 3 Archon-Fragments còn lại (Lex Primordialis, Morphic Hunger, Grace Eternal)
- PvP weapon interactions — kiến trúc riêng hoàn toàn
- Weapon visual system (ngoài scope narrative engine)

---

### Dependency Graph

```
Phase 1A (Foundation)
    ├── Phase 1B (Monster Core) ← độc lập, có thể song song sau 1A
    ├── Phase 1C (Archon-Fragment) ← cần 1A, có thể song song với 1B
    └── Phase 2A (Awakened + Signature v1) ← cần 1A
            └── Phase 2B (Signature Evolution) ← cần 2A + Unique Skill Aspect
                    └── Phase 2C (Completion)
                            └── Phase 3 (Expansion)
```

### Summary Table

| Phase | Nội dung | Complexity | New Files | Modify Existing | Blocker |
|---|---|---|---|---|---|
| **1A** | Foundation | ⭐⭐⭐ | 2 | 6 | Không |
| **1B** | Monster Core | ⭐⭐ | 1 | 3 | 1A |
| **1C** | Archon-Fragment | ⭐⭐⭐⭐ | 0 | 6 | 1A |
| **2A** | Awakened + Sig v1 | ⭐⭐⭐⭐ | 3 | 6 | 1A, crng.py audit |
| **2B** | Sig Evolution | ⭐⭐⭐⭐⭐ | 1 | 5 | 2A + Unique Skill Aspect |
| **2C** | Completion | ⭐⭐⭐ | 0-1 | 3-4 | 2A |
| **3** | Expansion | ⭐⭐⭐⭐⭐ | TBD | TBD | 2B |

### Phase 1 Story Pre-Defined Content

**Inheritance Weapons (2):**
- Vô Hồi Đao (Entropy, Resonant) — Floor 2 dungeon
- Thần Vệ Thuẫn (Order, Soul-Linked) — NPC questline, requires coherence ≥ 70

**Archon-Fragment (2, hidden — Phase 1C):**
- Veil Unbound (Vyrel/Freedom — Entropy+Flux+Void)
- Iron Dominion (Dominar/Control — Matter+Void+Order)

---

## 13. Design Decisions Log

Tất cả decisions đã resolved. Ghi lại để reference.

| Câu hỏi | Decision | Lý do |
|---|---|---|
| Awakened requirements? | Bond Score ≥ 85 + Awakening Scene tự nhiên (Planner-placed) | Cần xứng đáng, không phải auto-reward |
| Soul Crystal system? | 3 tiers (Pale/True/Sovereign) — CRNG + coherence ≥ 75 ảnh hưởng quality | Luck là identity behavior, không phải random |
| Wanderer utility slot bonus? | Exploration-only: +15% discovery chance cho hidden lore/paths/inheritance weapons | Archetype đánh đổi combat slot để có lore access |
| Tactician auxiliary? | Deferred Phase 2 | Scope risk — Phase 1 Tactician có 1 primary slot |
| Signature Move reject/redo? | Không có reject — thay bằng v1→v2→v3 evolution system | Move lớn lên cùng player, nhất quán với game theme |
| Archon lore reveal trigger? | Behavior-based + hidden minimum chapter floor (không expose) | Mỗi player có journey riêng, pace riêng |
| Dormant recovery? | Planner weaves vào story tự nhiên. Weapon tự phản ứng ở coherence ≥ 60 + resonant location. Không có prompt. | Recovery là discovery, không phải transaction |
| Writer reference Mundane weapon? | Silent (không reference) | Mundane không có narrative presence |
