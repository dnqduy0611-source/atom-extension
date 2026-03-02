# ✨ AMOISEKAI — Unique Skill Growth Specification v1.2

> **Author:** Amo  
> **Date:** 2026-02-28  
> **Status:** Formalized — Code-synced  
> **Dependencies:** SOUL_FORGE_SPEC, PROGRESSION_SYSTEM_SPEC, POWER_SYSTEM_SPEC, COMBAT_SYSTEM_SPEC v1.1, IDENTITY TRANSFORMATION ARCHITECTURE v1, UNIQUE SKILL CONTROL SYSTEM v1  
> **Input:** UniqueSkill object từ Soul Forge (`evolution_hint` field là hook chính)  
> **Inspiration:** Rimuru Tempest skill evolution (That Time I Got Reincarnated as a Slime) cho Ultimate Form

---

## 1. Triết lý

> Unique Skill không phải vũ khí.  
> Nó là **gương phản chiếu** — mạnh hơn khi bạn trưởng thành, méo mó khi bạn lạc lối, phân nhánh khi bạn đứng trước ngã rẽ, và **siêu việt** khi bạn vượt qua giới hạn cuối cùng.

**Nguyên tắc:**
- **Behavior-driven** — player KHÔNG chọn upgrade path. Hành vi tự nhiên → tiến hóa phù hợp
- **Identity-tied** — mỗi dạng growth phản ánh hành trình identity
- **1 growth type active** — `active_growth` = display priority only. Previous growth effects tích lũy (Echo + Scar có thể cả 2 xảy ra, nhưng chỉ 1 được gán làm active)
- **evolution_hint** — Soul Forge AI đã gieo seed tiến hóa (hidden), engine dùng làm compass
- **Narrative-first** — mọi growth đều là arc narrative, không phải stat popup
- **Ultimate = culmination** — đỉnh cao tiến hóa, chỉ đạt được khi vượt Season Climax

---

## 2. Soul Forge Output → Growth Input

### 2.1 Skill data từ Soul Forge (input cho growth system)

```python
# Từ SOUL_FORGE_SPEC §6.2 output + V2 extensions:
class UniqueSkill(BaseModel):
    name: str                    # "Vết Nứt Sự Thật"
    description: str             # Mô tả cơ chế
    category: str                # "manifestation" | "manipulation" | "contract" | "perception" | "obfuscation"
    mechanic: str                # Chi tiết hoạt động
    limitation: str              # Giới hạn
    weakness: str                # Điểm yếu
    activation_condition: str    # Trigger
    soul_resonance: str          # Lý do skill thuộc về player
    trait_tags: list[str]        # ["mind", "relic", "perception"]
    evolution_hint: str          # "Nếu kiên trì tìm sự thật... vết nứt có thể mở rộng"

    # V2 additions (CONTROL_SYSTEM v1):
    current_stage: str = "seed"           # seed | bloom | aspect | ultimate
    suppression_resistance: float = 50.0  # Scales with growth stage
    sub_skills: list[SubSkill] = []       # SS0 at seed, grows at bloom/aspect
    weakness_type: str = ""               # 1 of 7 WeaknessType taxonomy
    domain_category: str = ""             # Same as category
    countered_by: list[str] = []          # Categories that counter
```

### 2.2 `evolution_hint` — Seed cho growth

Soul Forge **đã gieo sẵn** direction tiến hóa qua `evolution_hint`. Engine dùng field này để:

1. **Xác định natural growth path** — hint nói "kiên trì" → Echo Deepening. Hint nói "sống sót" → Scar Adaptation
2. **Feed Writer** — Writer dùng hint để foreshadow growth trong prose
3. **Feed AI Forge lần 2-4** — mỗi lần growth triggers, AI Forge dùng hint + accumulated data để generate evolved form

> **Player KHÔNG thấy** `evolution_hint`. Đây là backend data.

---

## 3. Bốn dạng Growth + Ultimate Form

### 3.1 Tổng quan

```
                    ┌── Coherence cao, behavior aligned ──→ ECHO DEEPENING
                    │   (Trưởng thành)
                    │
Unique Skill ───────┼── Survive trauma, near-death ──────→ SCAR ADAPTATION
(base form)         │   (Cái đau dạy bạn)
                    │
                    ├── Rank 4+, Affinity Awakened ──────→ ASPECT FORGE
                    │   (Ngã rẽ định mệnh)
                    │
                    └── Rank 5, Season Climax ──────────→ ULTIMATE FORM
                        (Siêu việt — Thiên Mệnh)
```

**Skill Evolution Path hoàn chỉnh:**
```
Soul Forge        Echo/Scar        Aspect Forge        ULTIMATE
(Rank 1)     →    (Rank 2-3)   →   (Rank 4)       →   (Rank 5)
                                                        
"Vết Nứt       "Vết Nứt          "Phá Chấp"          "Thiên Nhãn —
 Sự Thật"       tinh luyện"       (Truth Breaker)      Chúa Tể Sự Thật"
```

| Growth Type | Trigger | Timing | Player chooses? | Permanent? |
|---|---|---|---|---|
| Echo Deepening | Coherence ≥ 70 sustained | F1-2 (~Ch 10-20) | ❌ Auto | ✅ Nhưng có thể mất nếu coherence drop |
| Scar Adaptation | 3× survive near-death/backlash | F1-3 (~Ch 8-25) | ❌ Auto | ✅ Permanent |
| Aspect Forge | Rank 4 + Awakened affinity + 20 uses | F3-4 (~Ch 30-40) | ✅ Chọn 1 trong 2 | ✅ Permanent, không đổi |
| **Ultimate Form** | Rank 5 + Aspect + mastered skill + Season Climax | F4-5 (~Ch 40-48) | ❌ Narrative-driven | ✅ Permanent, ultimate ability |

### 3.2 Growth Priority

```python
# Growth priority: Ultimate > Aspect Forge > Scar > Echo
# Code: active_growth tracks current display priority.
# current_stage tracks progression: "seed" | "bloom" | "aspect" | "ultimate"
def determine_active_growth(growth: UniqueSkillGrowthState) -> GrowthType:
    if growth.ultimate_forged:
        return GrowthType.ULTIMATE
    if growth.aspect_forged:
        return GrowthType.ASPECT
    if growth.scar_adapted:
        return GrowthType.SCAR
    if growth.bloom_completed:
        return GrowthType.ECHO  # or SCAR depending on bloom_path
    return GrowthType.BASE
```

---

## 4. Echo Deepening — "Con đường thuần khiết"

### 4.1 Concept

Player hành xử **aligned với identity**, coherence cao → skill tự nhiên "sâu hơn". Cảm giác: "Skill phản ứng nhanh hơn vì bạn đang sống đúng với bản thân."

### 4.2 Trigger

```python
# Code: engine/unique_skill_growth.py
COHERENCE_THRESHOLD = 70.0     # Min coherence for echo streak
ECHO_STREAK_THRESHOLD = 10     # Consecutive scenes ≥ 70
ECHO_RESET_THRESHOLD = 50.0    # Below this = streak decays

# Per-scene tracking (in update_growth_per_scene):
if player.identity_coherence >= COHERENCE_THRESHOLD:
    growth.echo_coherence_streak += 1
elif player.identity_coherence < ECHO_RESET_THRESHOLD:
    # Streak decay: -2 per low scene (can be lost)
    if growth.echo_coherence_streak > 0 and growth.echo_can_lose:
        growth.echo_coherence_streak = max(0, growth.echo_coherence_streak - 2)

# Bloom trigger (in check_bloom_trigger):
def check_bloom_trigger(player) -> str | None:
    if growth.bloom_completed:
        return None  # Already bloomed
    if growth.echo_coherence_streak >= ECHO_STREAK_THRESHOLD:
        return "echo"  # Echo Bloom!
    if growth.scar_trauma_count >= 3 and not growth.scar_adapted:
        return "scar"  # Scar Bloom!
    return None
```

### 4.3 Bloom Refinement

> **Note:** Code implements bloom as a single event (seed → bloom), not 2 discrete levels.
> Echo Level 2 (Resonance Bonus) là **design intent** cho future AI Forge wiring.

#### Bloom Effect (implemented):

Khi Echo Bloom trigger, AI Forge generate:
- **SS1** (Sub-Skill 1): thêm 1 sub-skill passive/reactive
- **Weakness update**: nới lỏng weakness hiện tại
- `current_stage` → "bloom", `bloom_completed` = True

| Skill data field | Thay đổi | Ví dụ |
|---|---|---|
| `limitation` | Constraint giảm | "Cooldown 3 chương" → "Cooldown 2 chương" |
| `activation_condition` | Dễ trigger hơn | "Khi thực sự muốn biết" → "Khi đặt câu hỏi với ý chí" |
| `mechanic` | Nhẹ mở rộng | "Cảm nhận vết nứt" → "Cảm nhận vết nứt + hướng sơ bộ" |

#### Echo Level 2: Resonance Bonus (🔜 Future — AI Forge wiring)

Skill gain **passive bonus** khi identity aligned:
- Khi `coherence ≥ 80`: skill output +20% (combat score bonus)
- Skill tự kích hoạt nhẹ trong narrative (Writer mô tả: "Vết nứt phát sáng nhẹ — như thể nó đồng ý")

### 4.4 Echo có thể mất

Nếu coherence drop dưới 50 kéo dài **5 consecutive scenes** → Echo Bloom reverted:
- `bloom_completed` → False, `current_stage` → "seed"
- `suppression_resistance` → seed level (50.0)
- **Chỉ reversible khi chưa Aspect Forge** (`aspect_forged = False`)
- **Chỉ reversible khi `echo_can_lose = True`**
- Scar Bloom KHÔNG reversible (permanent)

> **Đây là cost narrative:** Player lạc lối → skill yếu đi. Tạo tension thật.

```python
# Implementation: unique_skill_growth.py → update_growth_per_scene()
ECHO_REVERT_COHERENCE = 50.0
ECHO_REVERT_STREAK = 5  # Consecutive low-coherence scenes
# Conditions: bloom_completed AND bloom_path == "echo" AND NOT aspect_forged AND echo_can_lose
```

---

## 5. Scar Adaptation — "Cái đau là thầy"

### 5.1 Concept

Player sống sót qua trauma (backlash, near-death) → skill **thích nghi** để bảo vệ. Cảm giác: "Skill nhớ nỗi đau đó và không muốn bạn chết lại."

### 5.2 Trigger

```python
# Code: engine/unique_skill_growth.py → update_growth_per_scene()
def check_scar_adaptation(player, scene_result, growth) -> bool:
    """Track trauma events — automatic, per-scene."""
    # Trauma logged when: combat defeat OR near-death (HP < 15%)
    if is_combat and combat_outcome == "enemy_wins":
        trauma = TraumaEvent(
            chapter=player.total_chapters,
            description="Defeated in combat",
            severity=defeat_severity or "defeat",
        )
        growth.trauma_log.append(trauma)
        growth.scar_trauma_count = len(growth.trauma_log)
    elif is_combat and player.hp <= player.hp_max * 0.15:
        trauma = TraumaEvent(..., severity="near_death")
        growth.trauma_log.append(trauma)
        growth.scar_trauma_count = len(growth.trauma_log)
    
    # Need 3 trauma events + not already adapted
    return (
        not growth.scar_adapted and
        growth.scar_trauma_count >= 3
    )
```

### 5.3 Ba loại Adaptation

Engine chọn type dựa trên **pattern** trauma:

```python
# Code: engine/unique_skill_growth.py → _derive_scar_type()
def _derive_scar_type(growth) -> ScarType:
    near_death = sum(1 for t in growth.trauma_log if t.severity == "near_death")
    backlash = sum(1 for t in growth.trauma_log if t.severity in ("backlash", "defeat"))
    
    if near_death >= 2:
        return ScarType.DEFENSIVE
    elif backlash >= 2:
        return ScarType.COUNTER
    else:
        return ScarType.WARNING
```

| Type | Trigger Pattern | Hiệu ứng | Prose ví dụ |
|---|---|---|---|
| **Defensive** | ≥2 near-death | Skill auto-shield khi HP < 20%: hồi 10 stability + giảm incoming damage 50% cho 1 hit | "Vết Nứt Sự Thật phát sáng đỏ — một rào cản mỏng manh hiện ra, như thể skill nhớ lần bạn gần chết." |
| **Counter** | ≥2 defeat/backlash | Backlash severity giảm 50% khi dùng unique skill | "Năng lượng backlash phản ngược — nhưng Vết Nứt hấp thụ một phần, như vết sẹo đã chai sạn." |
| **Warning** | Mixed | Skill "cảnh báo" danger: boss tell rõ hơn, trap detection | "Vết nứt run nhẹ — có gì đó sai. Bạn không biết chính xác, nhưng bạn TIN nó." |

### 5.4 Scar Adaptation Narrative Arc (2 scenes)

```
Scene 1 (auto-triggered by Planner):
├── beat_type: "discovery"
├── Skill behave bất thường — phản ứng mạnh với tình huống danger
├── Writer: "Bạn nhận ra rằng [skill] đã thay đổi. Không phải mạnh hơn — mà khác."
└── Player: receives narrative description (no choice needed)

Scene 2 (next combat or danger):
├── Scar Adaptation kích hoạt lần đầu trong thực hành
├── Writer: mô tả adaptation effect trong combat prose
└── Entity: "Skill đã ghi nhớ nỗi đau và biến nó thành bản năng mới."
```

### 5.5 Scar là permanent

Khác Echo Deepening, Scar **không mất** khi coherence drop. Vết sẹo là vĩnh viễn.

---

## 6. Aspect Forge — "Ngã rẽ định mệnh"

### 6.1 Concept

End-game growth. Unique Skill **phân nhánh** thành 2 dạng (aspects) — player chọn 1. Cảm giác: "Skill của bạn đã trưởng thành. Giờ nó hỏi: 'Bạn muốn trở thành ai?'"

### 6.2 Trigger

```python
# Code: engine/unique_skill_growth.py → check_aspect_trigger()
def check_aspect_trigger(player) -> bool:
    growth = player.unique_skill_growth
    return (
        player.current_rank >= 4 and            # Rank 4+ (Transcendent)
        growth.bloom_completed and               # Must have bloomed first
        growth.mutation_count + 1 >= 20 and      # 20+ total growth events (proxy for usage)
        not growth.aspect_forged                 # Not already forged
    )
```

### 6.3 Aspect Generation

Khi trigger, **AI Forge gọi lần 3** (sau generation + optional echo refinement):

```
AI Forge Input:
├── Original UniqueSkill object
├── evolution_hint (from Soul Forge)
├── Player identity snapshot (current, không phải seed)
├── Awakened affinity principle
├── Accumulated skill usage patterns
├── Trauma history (scar data if any)
└── Instruction: "Tạo 2 aspects..."
```

**AI Forge Aspect Prompt:**
```
Tạo 2 ASPECTS (phiên bản tiến hóa) cho Unique Skill dưới đây.

## Original Skill:
{unique_skill.json}

## Evolution Hint (seed from creation):
{evolution_hint}

## Player Identity hiện tại:
{identity_snapshot}

## Awakened Principle:
{awakened_principle}

## Quy tắc:
1. 2 aspects = 2 con đường HOÀN TOÀN KHÁC NHAU nhưng đều grow từ skill gốc
2. Aspect A: thiên về DEFENSIVE/UTILITY — mở rộng duration/range/support
3. Aspect B: thiên về OFFENSIVE/IMPACT — tăng power/intensity/specialization
4. CẢ HAI đều tích hợp Awakened Principle ({awakened_principle})
5. Tên mới cho mỗi aspect (skill gốc là source, aspects là 2 nhánh)
6. Giữ soul_resonance — aspect phải reflection linh hồn gốc
7. Weakness MỚI cho mỗi aspect (khác nhau, gắn với path)
8. Mỗi aspect phải trade-off rõ: aspect A mạnh ở X yếu ở Y, aspect B ngược lại

## Output JSON:
{
  "aspect_a": {
    "name": "...",
    "description": "...",
    "mechanic": "...",
    "strength": "Aspect A mạnh ở điểm gì",
    "trade_off": "Aspect A yếu ở điểm gì",
    "awakened_integration": "Principle mới tích hợp thế nào",
    "weakness": "Weakness mới"
  },
  "aspect_b": {
    "name": "...",
    ...
  }
}
```

### 6.4 Ví dụ Aspect Forge

**Skill gốc:** "Vết Nứt Sự Thật" (perception — thấy vết nứt khi sự thật bị giấu)  
**Awakened Principle:** Entropy  

```json
{
  "aspect_a": {
    "name": "Tường Minh (Clarity Wall)",
    "description": "Mở rộng Vết Nứt thành một vùng quét — tất cả sự thật bị ẩn trong phạm vi đều lộ ra dưới dạng ánh sáng mờ.",
    "mechanic": "Kích hoạt trong 30 giây (narrative time). Tất cả hidden intent/trap/lie trong phạm vi đều hiện vết nứt sáng. Không chi tiết, nhưng biết VỊ TRÍ và MỨC ĐỘ.",
    "strength": "Area detection, cực mạnh cho recon và counter-ambush",
    "trade_off": "Không còn khả năng deep-read 1 target. Rộng nhưng nông.",
    "awakened_integration": "Entropy phân tán vết nứt thành vùng thay vì 1 điểm",
    "weakness": "Quá tải thông tin — trong vùng có nhiều sự thật bị ẩn, player bị overwhelm (stability drain)"
  },
  "aspect_b": {
    "name": "Phá Chấp (Truth Breaker)",
    "description": "Vết Nứt giờ có thể PHÁ VỠ sự thật bị giấu — buộc nó lộ ra hoàn toàn, không thể ẩn lại.",
    "mechanic": "Focus vào 1 target. Vết Nứt MỞ TOANG — sự thật bị ẩn hiện ra dưới dạng prose cụ thể. Target mất ability to lie với bạn trong 5 chương.",
    "strength": "Single-target truth extraction cực mạnh, combat utility (thấy rõ boss tell)",
    "trade_off": "Chỉ 1 target. Cooldown 5 chương (rất dài). Tiêu hao stability lớn.",
    "awakened_integration": "Entropy xé vết nứt thành lỗ hổng, phá vỡ concealment",
    "weakness": "Sự thật đôi khi là vũ khí — biết quá rõ nội tâm kẻ thù có thể gây instability cho chính player"
  }
}
```

### 6.5 Aspect Forge Narrative Arc (3 scenes)

```
Scene 1 — "Skill Run" (discovery beat):
├── Unique Skill kích hoạt bất thường — mạnh hơn, nhưng không kiểm soát được
├── Writer: "Vết Nứt phát sáng mạnh gấp đôi. Nó muốn gì đó — muốn THAY ĐỔI."
└── Player cảm nhận skill đang ở ngưỡng tiến hóa

Scene 2 — "The Fork" (climax beat):
├── Tình huống buộc phải dùng skill ở mức tối đa
├── Skill "phân nhánh" — player thấy 2 vision:
│   Vision A: "Vùng ánh sáng lan rộng, mọi sự thật hiện ra..."
│   Vision B: "Vết nứt nứt toang, một sự thật duy nhất lộ ra hoàn toàn..."
├── DECISION POINT ← 3 chapter choices:
│   🌐 Chọn Tường Minh — "Bạn muốn thấy TẤT CẢ, dù chỉ bề mặt"
│   🎯 Chọn Phá Chấp — "Bạn muốn biết TRIỆT ĐỂ, dù chỉ một điều"
│   ⏸️ Trì hoãn — "Bạn chưa sẵn sàng" (defer 5 chapters, repeat Scene 2 later)
└── Player chọn

Scene 3 — "Reborn" (resolution beat):
├── Skill hoàn thành tiến hóa
├── Writer viết cinematic description của aspect mới
├── First use trong combat/narrative ngay chapter đó
└── "Bạn không còn sở hữu Vết Nứt Sự Thật. Giờ bạn sở hữu [Tường Minh/Phá Chấp]."
```

### 6.6 Permanent & Irreversible

- Chọn rồi **KHÔNG đổi** được. Tạo replay value.
- Aspect thay thế hoàn toàn skill gốc (tên mới, mechanic mới)
- Nếu player có Echo hoặc Scar trước → effects **integrate** vào aspect mới (không mất)

---

## 7. Ultimate Form — "Thiên Mệnh" (Transcendence)

> Inspired by: Rimuru Tempest's Unique Skill → Ultimate Skill evolution  
> Common Skill → Unique Skill → **Ultimate Skill** (Predator → Gluttony → Beelzebuth, Lord of Gluttony)

### 7.1 Concept

Unique Skill ở dạng Aspect **absorb** 1 normal skill đã master → **Synthesis** thành Ultimate Skill. Đây là đỉnh cao tiến hóa, xảy ra tại **Season Climax** — khoảnh khắc player vượt qua giới hạn cuối cùng.

> Cảm giác: "Hai sức mạnh hợp nhất — skill sinh ra tên mới, dạng mới, và 1 khả năng vượt qua mọi giới hạn."

### 7.2 Trigger

```python
def check_ultimate_form(player, growth) -> bool:
    return (
        player.progression.current_rank >= ProgressionRank.SOVEREIGN and  # Rank 5
        growth.aspect_forged and                       # Aspect Forge completed
        _has_mastered_compatible_skill(player) and     # 1 normal skill: refined + same principle
        player.season_climax_active and                # Season Climax encounter
        not growth.ultimate_forged
    )

def _has_mastered_compatible_skill(player) -> str | None:
    """Find a normal skill that can be absorbed."""
    for skill in player.equipped_skills:
        if (skill.id != player.unique_skill.id and
            skill.id in player.progression.refinements_done and
            skill.primary_principle in player.unique_skill.trait_tags):
            return skill.id
    return None
```

### 7.3 Synthesis Event — Narrative Arc (3 scenes, Season Climax)

```
Scene 1 — "Giới Hạn" (Season Climax boss, phase 3 — đang thua):
├── Player bị dồn vào đường cùng — boss final quá mạnh
├── Unique Skill (Aspect form) kích hoạt max → vẫn không đủ
├── Normal skill (mastered) cũng kích hoạt → vẫn không đủ
└── Narrative: "Hai sức mạnh song song — nhưng tách rời. Bạn thiếu gì đó."

Scene 2 — "Cộng Hưởng Tuyệt Đối" (climax):
├── evolution_hint "nhắc lại" lần cuối (giọng nói từ khi sinh ra tại Void Between)
├── Unique Skill + Normal Skill bắt đầu RESONANCE
├── Normal skill bị ABSORB — biến mất khỏi equipped list
├── AI Forge gọi lần CUỐI → generate Ultimate Skill
├── NAMING EVENT — AI tạo tên Ultimate:
│   Format: "[Tên Skill] — [Danh xưng]"
│   VD: "Thiên Nhãn — Chúa Tể Sự Thật"
└── Tất cả growth trước (Echo, Scar) integrate vào Ultimate

Scene 3 — "Tái Sinh" (resolution):
├── Ultimate Skill kích hoạt lần đầu
├── Boss fight resolution — player thắng bằng Ultimate
├── ULTIMATE ABILITY lần đầu: narrator mô tả cinematic moment
└── Season Climax → kết thúc Season 1
```

### 7.4 AI Forge — Ultimate Generation (lần 4)

```
Tạo ULTIMATE SKILL từ Synthesis giữa Unique Skill (Aspect form) và Normal Skill đã master.

## Aspect Skill (evolved unique):
{aspect_skill.json}

## Absorbed Skill (mastered normal):
{absorbed_skill.json}

## Evolution Hint (seed từ Soul Forge):
{evolution_hint}

## Player Journey Summary:
{identity_journey_summary}

## Quy tắc:
1. Ultimate = FUSION bản chất 2 skills, không chỉ cộng gộp
2. Tên theo format: "[Tên] — [Danh xưng]" 
   (VD: "Thiên Nhãn — Chúa Tể Sự Thật", "Cuồng Nộ — Bạo Chúa Lửa")
3. Mechanic: mở rộng Aspect + tích hợp absorbed principle
4. Ultimate Ability: 1 khả năng GOD-TIER, dùng 1 lần per season
   - Stability cost: 80% (gần self-destruct)
   - Phải reflect bản chất skill + hành trình player
5. Weakness: Ultimate có 1 weakness nghiêm trọng gắn với power level
6. soul_resonance: kết nối Void Between origin + toàn bộ growth journey

## Output JSON:
{
  "ultimate_name": "Tên — Danh xưng",
  "description": "Mô tả base mechanic (nâng cấp từ Aspect)",
  "mechanic": "Chi tiết hoạt động thường xuyên",
  "absorbed_integration": "Absorbed skill tích hợp thế nào",
  "ultimate_ability": {
    "name": "Tên khả năng ultimate",
    "description": "Mô tả effect — cinematic, 1 scene",
    "stability_cost": 80,
    "uses_per_season": 1,
    "narrative_impact": "Ảnh hưởng lên thế giới/câu chuyện"
  },
  "weakness": "Điểm yếu nghiêm trọng",
  "naming_resonance": "Vì sao tên này phù hợp với hành trình"
}
```

### 7.5 Ví dụ Ultimate Skill

**Aspect:** "Phá Chấp" (Truth Breaker — perception, Entropy-enhanced)  
**Absorbed:** "Entropy Shred" (Tier 2, mastered, Entropy principle)

```json
{
  "ultimate_name": "Thiên Nhãn — Chúa Tể Sự Thật",
  "description": "Nhìn thấy CẤU TRÚC SỰ THẬT của mọi thứ trong tầm nhìn — bản chất nguyên lý, ý định ẩn, và cấu trúc hiện thực.",
  "mechanic": "Passive: mọi hidden intent/lie/trap đều hiện vết nứt sáng (không cần kích hoạt). Active: focus vào 1 target → thấy toàn bộ principle structure + weakness. Tích hợp Entropy: có thể PHÂN RÃ cấu trúc đã nhìn thấy.",
  "absorbed_integration": "Entropy Shred cho phép không chỉ nhìn mà còn phá vỡ cấu trúc — từ perception sang destruction.",
  "ultimate_ability": {
    "name": "Phán Quyết Sự Thật",
    "description": "Buộc toàn bộ reality trong vùng reveal bản chất thật. Mọi ảo ảnh vỡ, mọi disguise lộ, mọi hidden intent hiện ra. Kéo dài 1 scene.",
    "stability_cost": 80,
    "uses_per_season": 1,
    "narrative_impact": "Boss mất mọi concealment, hidden phase bị skip, true form lộ ra."
  },
  "weakness": "Nhìn quá nhiều sự thật → instability luôn ở mức cao. Player phải đối diện sự thật về CHÍNH MÌNH mỗi khi kích hoạt — coherence bị test.",
  "naming_resonance": "Linh hồn chọn 'sự thật' từ Void Between → vết nứt nhỏ → phá chấp → MẮT THẤU TRỜI. Tên phản ánh hành trình từ tò mò thành quyền năng."
}
```

### 7.6 Trade-offs

| Nhận được | Mất đi |
|-----------|--------|
| Ultimate Form (strongest unique skill) | 1 normal skill bị absorb (mất slot) |
| Ultimate Ability (god-tier, 1/season) | 80% stability cost = gần self-destruct |
| Auto-max combat bonus (5%) | Instability permanently elevated |
| Cinematic naming event | Skill đã ở dạng CUỐI — không tiến hóa thêm |

### 7.7 Giới hạn Ultimate

| Quy tắc | Lý do |
|---------|-------|
| Chỉ 1 Ultimate per character | Power fantasy nhưng không broken |
| Ultimate Ability = 1 lần per season | God-tier power cần extreme scarcity |
| Stability cost 80% | Cái giá thật sự — gần self-destruct |
| Season Climax only | Không trigger random, phải là đỉnh cao season |
| Absorb 1 normal skill (mất skill đó) | Meaningful sacrifice |
| Mutation blocked permanently | Ultimate = final form |
| AI Forge naming phải reflect toàn bộ journey | Identity crystallization |

---

## 8. Growth × Combat Integration

### 8.1 Combat Score Bonus

Unique Skill growth ảnh hưởng combat thế nào (từ COMBAT_SYSTEM_SPEC §6.2 — CRNG component 5%):

```python
# Code: engine/unique_skill_combat.py → unique_skill_combat_bonus_v2()
def unique_skill_combat_bonus_v2(player, enemy_skills=None) -> float:
    """0.0-0.08 bonus to combat score (V2: 8% cap)."""
    growth = player.unique_skill_growth
    skill = player.unique_skill
    if not skill:
        return 0.0
    
    base = 0.01  # Unique skill exists = 1%
    
    # Domain matchup bonus (+0-3%)
    if skill.domain_category and enemy_skills:
        base += apply_domain_bonus(
            skill.domain_category, enemy_skills,
            player_stage=growth.current_stage if growth else "seed",
        )
    
    if growth:
        # Ultimate: auto-max, skip others
        if growth.ultimate_forged:
            return 0.05  # ULTIMATE_BONUS
        
        # Bloom bonus
        if growth.bloom_completed:
            base += 0.01  # +1%
        
        # Scar defensive bonus
        if growth.scar_adapted and growth.scar_type == ScarType.DEFENSIVE:
            base += 0.01  # +1%
        
        # Aspect bonus
        if growth.aspect_forged:
            base += 0.02  # +2%
    
    return min(0.08, base)  # V2 cap: 8%
```

### 8.2 Growth trong Resolution Combat

| Growth Type | Impact trong CombatBrief |
|---|---|
| Bloom (Echo path) | Skill activation condition dễ hơn → Writer mention unique skill |
| Bloom (Scar path) | Scar effect kích hoạt (shield/counter/warning) |
| Scar Defensive | HP < 20% → auto-shield (reduce 1 phase damage by 50%) |
| Scar Counter | Backlash severity halved (backlash_probability × 0.5) |
| Scar Warning | Boss tell rõ hơn → narrative_cues += "unique_skill_warning" |
| Aspect | Replaced mechanic → combat engine dùng new aspect data |
| **Ultimate** | Auto-max 5% combat bonus + **Ultimate Ability** (1/season) |

---

## 9. Growth × Identity Mutation Interaction

### 9.1 Mutation override growth?

Skill Mutation (PROGRESSION_SYSTEM_SPEC §4.2.2) thay đổi bản chất skill. Khi mutation xảy ra:

```
Case 1: Player ĐÃ có Echo Bloom
├── Mutation: skill đổi bản chất → bloom reverted (bloom_completed = False)
├── Player phải rebuild coherence streak với SKILL MỚI
└── Narrative: "Skill mới xa lạ — resonance cũ không còn."

Case 2: Player ĐÃ có Scar Adaptation
├── Mutation: scar effect GIỮ NGUYÊN
├── Lý do: scar là "vết sẹo trên linh hồn", không phải trên skill
└── Narrative: "Skill mới, nhưng vết sẹo vẫn ở đó. Nó nhớ nỗi đau."

Case 3: Player ĐÃ có Aspect Forge
├── Mutation KHÔNG thể xảy ra (blocked — mutation_locked = True)
├── Code: check_mutation_allowed() returns (False, "...permanent...")
└── Narrative: "Skill đã ở dạng tiến hóa — identity drift không lay chuyển được."

Case 4: Player ĐÃ có Ultimate Form
├── Mutation KHÔNG thể xảy ra (blocked — strongest lock)
├── Code: check_mutation_allowed() returns (False, "...locked...")
└── Narrative: "Thiên Nhãn đã vượt qua mọi giới hạn. Nó không còn bị ràng buộc."
```

> **Implementation:** `engine/skill_check.py → check_mutation_allowed(growth_stage, mutation_locked, aspect_forged)`

### 9.2 Timeline Interaction

```
Story timeline:
├── Ch 1-3: Skill Discovery (SCENE_ARCHITECTURE_SPEC)
├── Ch 5-15: Echo Bloom có thể trigger (nếu coherence ≥ 70 × 10 scenes)
│            OR Scar Bloom (nếu gặp 3+ trauma)
├── Ch 15-25: Skill Mutation có thể xảy ra (nếu identity drift)
│            → Nếu mutation: Echo bloom reverted, Scar giữ
├── Ch 25-35: Echo có thể rebuild, hoặc Scar xảy ra muộn
├── Ch 30-40: Aspect Forge (Rank 4 required)
│            → Lock skill khỏi mutation (mutation_locked = True)
├── Ch 40-48: Ultimate Form (Rank 5 + Season Climax)
│            → Unique Skill absorb mastered normal skill → Synthesis
│            → Naming Event: AI tạo tên Ultimate ("[Tên] — [Danh xưng]")
│            → Ultimate Ability unlock (1 use per season)
└── Ch 48+: Ultimate established — Season 1 complete
```

---

## 10. Data Models

> **Source of truth:** `app/models/unique_skill_growth.py`

```python
# app/models/unique_skill_growth.py — V2 (synced 2026-02-27)

class GrowthType(str, Enum):
    BASE = "base"
    ECHO = "echo"         # Coherence-driven (aligned play)
    SCAR = "scar"         # Trauma-driven (survived hardship)
    ASPECT = "aspect"     # End-game branch (Rank 4+)
    ULTIMATE = "ultimate" # Final form — Synthesis (Rank 5)

class ScarType(str, Enum):
    DEFENSIVE = "defensive"   # Auto-shield, damage reduction
    COUNTER = "counter"       # Auto-retaliate, reflect
    WARNING = "warning"       # Auto-detect, precognition

class WeaknessType(str, Enum):
    """7-type weakness taxonomy — AI Forge must choose exactly one."""
    SOUL_ECHO = "soul_echo"
    PRINCIPLE_BLEED = "principle_bleed"
    RESONANCE_DEPENDENCY = "resonance_dependency"
    TARGET_PARADOX = "target_paradox"
    SENSORY_TAX = "sensory_tax"
    ENVIRONMENT_LOCK = "environment_lock"
    ESCALATION_CURSE = "escalation_curse"

class TraumaEvent(BaseModel):
    chapter: int = 0
    description: str = ""
    severity: str = ""         # "near_death" | "backlash" | "loss"

class AspectOption(BaseModel):
    name: str = ""
    description: str = ""
    strength: str = ""
    trade_off: str = ""
    sub_skill_2: dict = Field(default_factory=dict)  # Active sub-skill spec
    sub_skill_3: dict = Field(default_factory=dict)  # Passive sub-skill spec

class UltimateSkillForm(BaseModel):
    name: str = ""           # "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"
    title: str = ""          # Danh xưng
    merged_sub_skills: list[dict] = Field(default_factory=list)
    absorbed_skill_name: str = ""
    absorbed_skill_integration: str = ""
    ultimate_ability_name: str = ""
    ultimate_ability_description: str = ""
    ultimate_ability_used_this_season: bool = False
    naming_resonance: str = ""

class UniqueSkillGrowthState(BaseModel):
    """Complete growth state — V2 with sub-skill management."""
    skill_id: str = ""
    original_skill_name: str = ""
    current_skill_name: str = ""          # Changes after aspect/ultimate
    current_stage: str = "seed"           # seed | bloom | aspect | ultimate

    # ── Growth path ──
    active_growth: GrowthType = GrowthType.BASE
    bloom_path: str = ""                  # "echo" | "scar" | ""
    bloom_completed: bool = False

    # ── Echo tracking ──
    echo_coherence_streak: int = 0        # Consecutive scenes with coherence ≥ 70
    echo_can_lose: bool = True            # Echo bloom can be lost if coherence drops

    # ── Scar tracking ──
    scar_adapted: bool = False
    scar_type: ScarType | None = None
    trauma_log: list[TraumaEvent] = Field(default_factory=list)
    scar_trauma_count: int = 0

    # ── Aspect Forge ──
    aspect_forged: bool = False
    aspect_options: list[AspectOption] = Field(default_factory=list)
    aspect_chosen: str = ""
    aspect_deferred: bool = False
    aspect_defer_chapter: int = 0         # Retry after 5 chapters

    # ── Ultimate Form ──
    ultimate_forged: bool = False
    ultimate_form: UltimateSkillForm | None = None
    absorbed_skill_id: str = ""
    naming_event_completed: bool = False

    # ── Sub-skills ──
    sub_skills_unlocked: list[str] = Field(default_factory=list)

    # ── Mutation ──
    mutation_count: int = 0
    mutation_locked: bool = False         # True after Aspect Forge

    # ── Combat ──
    combat_bonus: float = 0.0             # Cached combat bonus (0.0-0.08)
```

> **Note:** Engine uses lightweight dicts for growth event logging, not Pydantic models.

---

## 11. Engine Integration

### 11.1 Growth Check (per scene)

```python
# Code: engine/unique_skill_growth.py + engine/growth_orchestration.py
# Actual implementation uses 3 separate trigger functions + growth_orchestration for beat injection.

def update_growth_per_scene(player, scene_type, is_combat, ...) -> dict:
    """Called after every scene. Tracks coherence streak + trauma."""
    # Echo tracking: coherence streak (±)
    # Echo revert: coherence < 50 × 5 scenes → revert bloom
    # Scar tracking: trauma events from combat defeat/near-death
    # Returns growth events dict

def check_bloom_trigger(player) -> str | None:
    """'echo' | 'scar' | None — lightweight, no LLM."""

def check_aspect_trigger(player) -> bool:
    """Rank 4+ AND bloom_completed AND 20+ uses."""

def check_ultimate_trigger(player) -> bool:
    """Rank 5 AND aspect_forged."""

# Orchestrator calls these in sequence, then:
from engine.growth_orchestration import check_and_inject_growth_beats
injected_beats = check_and_inject_growth_beats(player, growth_events)
# → Returns list[GrowthBeat] for Planner/Writer
```

### 11.2 Planner Flag Integration

```python
# Code: engine/growth_orchestration.py
# Beat definitions (matching orchestration module):
GROWTH_BEATS = {
    GrowthArcType.ECHO: {
        "scene_type": "rest",
        "description": "Skill refinement: player notices skill responding differently",
        "scenes_needed": 1,
        "priority": "medium",
    },
    GrowthArcType.SCAR: {
        "scene_type": "exploration",
        "description": "Skill adaptation: trauma-driven growth reveal",
        "scenes_needed": 2,
        "priority": "high",
    },
    GrowthArcType.ASPECT_FORGE: {
        "scene_type": "discovery",
        "description": "Skill branching: 3-scene arc with player choice",
        "scenes_needed": 3,
        "priority": "critical",
    },
    GrowthArcType.ULTIMATE: {
        "scene_type": "combat",
        "description": "Ultimate synthesis: 3-scene Season Climax arc",
        "scenes_needed": 3,
        "priority": "critical",
    },
}
```

### 11.3 Writer Integration

Writer nhận growth data qua `build_growth_writer_context()` (code: `engine/growth_orchestration.py`):

```python
# Injected into Writer context per scene:
growth_context = {
    "unique_skill": {
        "name": skill.name,
        "mechanic": skill.mechanic,
        "category": skill.category,
    },
    "growth_state": {
        "type": growth.active_growth.value,
        "current_stage": growth.current_stage,
        "echo_coherence_streak": growth.echo_coherence_streak,
        "scar_type": growth.scar_type.value if growth.scar_type else None,
        "aspect": growth.aspect_chosen if growth.aspect_forged else None,
        "ultimate": bool(growth.ultimate_forged),
        "bloom_completed": growth.bloom_completed,
    },
    "instruction": (
        f"Mô tả unique skill '{skill.name}' ở dạng hiện tại. "
        f"Growth stage: {growth.current_stage}. "
        "Skill phản ánh hành trình player — không generic."
    ),
}
```

---

## 12. Implementation Status (Updated 2026-02-27)

### ✅ All Implemented

| Component | File | Tests |
|-----------|------|-------|
| UniqueSkillGrowthState model (V2) | `models/unique_skill_growth.py` | `test_unique_skill_v2.py` |
| Echo/Scar Bloom + tracking | `engine/unique_skill_growth.py` | `test_phase3_growth_engine.py` |
| Growth × Combat (8% cap V2) | `engine/unique_skill_combat.py` | `test_suppression_combat.py` |
| Suppression × Combat wiring | `engine/suppression_check.py` | `test_suppression_check.py` |
| Seal + Anti-Unique Field | `engine/seal_system.py`, `models/seal.py` | `test_seal_system.py` |
| Growth narrative arcs | `engine/growth_orchestration.py` | `test_growth_narrative.py` |
| Mutation lock (Aspect+) | `engine/skill_check.py` | `test_mutation_lock.py` |
| Echo Bloom revert (coh<50×5) | `engine/unique_skill_growth.py` | `test_mutation_lock.py` |
| Writer context injection | `engine/growth_orchestration.py` | `test_growth_narrative.py` |

### 🔜 Future (AI Forge LLM Wiring)

| Component | Notes |
|-----------|-------|
| AI Forge regeneration (Echo/Aspect/Ultimate) | Prompt templates exist, LLM call not wired |
| Ultimate Ability activation in combat | Engine has `ultimate_ability_used_this_season` tracker |
| Season Climax detection | `season_climax_active` field needed on PlayerState |

---

## 13. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| Player KHÔNG chọn growth type (except Aspect branch) | Behavior-driven, không meta-gaming |
| Chỉ 1 growth type active | Complexity control |
| Echo có thể mất (coh<50×5 scenes → revert) | Tạo tension + consequence cho identity drift |
| Scar permanent | Trauma rất hiếm + thematic |
| Aspect Forge permanent + blocks mutation | End-game finality, replay value |
| **Ultimate Form permanent + strongest mutation lock** | **Final form — vượt khỏi identity drift** |
| **Ultimate Ability: 1 lần per season** | **God-tier power cần extreme scarcity** |
| **Ultimate absorb 1 normal skill (mất skill đó)** | **Meaningful sacrifice — trade slot for power** |
| **Stability cost 80% cho Ultimate Ability** | **Gần self-destruct — không spam được** |
| Max combat bonus **8%** (V2 upgrade from 5%) | Unique skill không auto-win |
| AI Forge lần 2-3-4 phải consistent | evolution_hint là compass xuyên suốt |
| Growth events → narrative arcs (1-3 scenes) | Không phải popup |
| Player never sees raw numbers | Mystery preserved |
| **Naming Event: AI tạo tên dựa trên TOÀN BỘ journey** | **Tên = identity crystallization, phải epic** |
