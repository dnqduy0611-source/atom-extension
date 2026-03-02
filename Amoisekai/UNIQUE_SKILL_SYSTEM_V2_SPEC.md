# ✨ AMOISEKAI — Unique Skill System Specification v2.0

> **Author:** Amo  
> **Date:** 2026-02-24  
> **Status:** Draft  
> **Replaces:** UNIQUE_SKILL_GROWTH_SPEC v1.1  
> **Dependencies:** SOUL_FORGE_SPEC, PROGRESSION_SYSTEM_SPEC, POWER_SYSTEM_SPEC, COMBAT_SYSTEM_SPEC v1.1, SKILL_CATALOG_SPEC  
> **Inspiration:** That Time I Got Reincarnated as a Slime (Tensura) — skill hierarchy, sub-skill ecosystem, qualitative power gaps

---

## 1. Triết lý — "Unique ≠ Stronger. Unique = Irreplaceable."

> Unique Skill không phải phiên bản mạnh hơn của Normal Skill.  
> Nó là **hệ sinh thái sức mạnh** — bắt đầu nhỏ nhưng phát triển thành thứ Normal Skill không thể chạm tới.  
> Giống Predator của Rimuru: ban đầu chỉ "nuốt" — nhưng cuối cùng trở thành Lord of Gluttony.

### 1.1 Nguyên tắc thiết kế

| # | Nguyên tắc | Giải thích |
|---|-----------|-----------|
| 1 | **Sub-skill Ecosystem** | Unique Skill chứa multiple sub-skills, unlock dần qua growth. Normal Skill chỉ có 1 mechanic. |
| 2 | **Domain Authority** | Unique Skill tạo "domain" — vùng ảnh hưởng nơi nó IMMUNE với Normal Skill cùng axis |
| 3 | **Axis Weakness** | Weakness = structural blind spot (skill làm gì → trống ở đâu), không phải emotional debuff |
| 4 | **Weak Start, God Tier End** | Seed = ngang Tier 1 combat power. Ultimate = vượt mọi ceiling |
| 5 | **Identity = Power Source** | Skill phản chiếu linh hồn — mạnh hơn khi aligned, méo mó khi drifted |
| 6 | **Narrative-first Growth** | Mọi tiến hóa là story arc, không phải stat popup |
| 7 | **1 Unique per Player** | Không stack, không multi-unique. 1 skill, 1 journey |

### 1.2 So sánh Unique vs Normal — Power Gap Design

```
                     NORMAL SKILL                 UNIQUE SKILL
                     ─────────────────            ─────────────────
Mechanic:            1 effect, clear              1 core + sub-skills (ecosystem)
Domain:              Không                        Có — immunity cùng axis
Sub-skills:          Không                        1 (Seed) → 4+ (Ultimate)
Weakness:            Generic constraint           Axis Blind Spot (structural)
Growth ceiling:      Tier 3 (absolute cap)        UNLIMITED (→ Ultimate → God-tier)
Narrative power:     Combat only                  Combat + Story + Social
Identity-tied:       Không                        Mạnh/yếu theo identity alignment

Timeline:  
  Normal:  ████████████████ (Tier 3 cap)
  Unique:  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (Seed = Tier 1)
            → ████████████░░░░░░░░░░░░░░ (Bloom)
            → ████████████████████░░░░░░ (Aspect)
            → ████████████████████████████████████ (ULTIMATE — transcend)
```

---

## 2. Sub-skill System — "Hệ sinh thái bên trong"

> Inspired by: Tensura's Great Sage containing Thought Acceleration, Analytical Appraisal, Parallel Processing, etc.

### 2.1 Concept

Unique Skill không phải 1 ability — nó là **container** chứa nhiều sub-skills. Mỗi growth stage unlock thêm sub-skills:

```
SEED (sau Soul Forge):
└── Core Mechanic         ← 1 primary effect
└── Sub-skill 0 (passive) ← Domain passive (see §3)

BLOOM (khi đạt Echo Deepening hoặc Scar Adaptation):
└── Core Mechanic++       ← enhanced
└── Sub-skill 0 (passive)
└── Sub-skill 1 (active)  ← NEW — unlocked via growth

ASPECT (khi đạt Rank 4 + Affinity Awakened):
└── Core Mechanic+++
└── Sub-skill 0 (passive)
└── Sub-skill 1 (active++)
└── Sub-skill 2 (active)  ← NEW — aspect-specific
└── Sub-skill 3 (passive) ← NEW — aspect-specific

ULTIMATE (khi đạt Rank 5 + Season Climax):
└── ALL merged + transcended
└── Ultimate Ability       ← God-tier, 1/season
└── Absorbed Skill integration
```

### 2.2 Sub-skill Types

| Type | Khi nào | Cách hoạt động |
|------|---------|----------------|
| **Core Mechanic** | Always | Primary effect — "skill làm gì". Duy nhất, luôn active |
| **Passive Sub-skill** | Always (from Seed) | Auto-effect liên tục. VD: enhanced perception, damage resist |
| **Active Sub-skill** | Manual trigger | Player chọn kích hoạt. Có cost riêng. VD: burst mode, scan |
| **Reactive Sub-skill** | Auto on condition | Tự kích hoạt khi điều kiện met. VD: auto-shield khi HP < 20% |
| **Ultimate Ability** | Manual, 1/season | God-tier. Cost: 80% stability |

### 2.3 Sub-skill Naming Convention

Sub-skills kế thừa theme từ core skill:

**Ví dụ: "Vết Nứt Sự Thật" (Perception — thấy sự thật bị ẩn giấu)**

| Stage | Sub-skill | Type | Effect |
|-------|-----------|------|--------|
| Seed | Core: Vết Nứt | Active | Nhìn thấy 1 vết nứt khi đối diện lời dối/ẩn ý |
| Seed | SS0: Trực Giác Nứt (Domain) | Passive | Immune với Normal perception; tín hiệu mơ hồ khi ở gần deception |
| Bloom | SS1: Đọc Vết | Active | Focus vết nứt → thấy chi tiết hơn (direction, severity) |
| Aspect A | SS2: Tường Minh | Active | Area scan — all hidden intents in range hiện vết nứt |
| Aspect A | SS3: Nhạy Cảm Nứt | Passive | Stability warning khi bước vào vùng có deception |
| Ultimate | UA: Phán Quyết Sự Thật | Active (1/season) | Force reveal toàn bộ reality trong 1 scene |

**Ví dụ: "Thệ Ước Thép" (Manifestation — cứng hóa cơ thể)**

| Stage | Sub-skill | Type | Effect |
|-------|-----------|------|--------|
| Seed | Core: Ngưng Kết | Reactive | Cứng hóa phần cơ thể ĐANG BỊ VA CHẠM (auto, instant) |
| Seed | SS0: Thân Thép (Domain) | Passive | Immune với Normal defensive skills cùng principle; +5% physical resist |
| Bloom | SS1: Phản Xạ Thép | Reactive | Damage reflect 20% khi cứng hóa thành công |
| Aspect B | SS2: Nộ Cương | Active | Voluntary full-body harden 3 giây, cost 25 stability |
| Aspect B | SS3: Ký Ức Thép | Passive | Cơ thể "nhớ" pattern đòn — cùng loại attack lần 2+ cứng hóa nhanh hơn |
| Ultimate | UA: Thiết Thệ Bất Hoại | Active (1/season) | Toàn thân cứng hóa tuyệt đối 1 scene, immune mọi physical + reflect tất cả |

### 2.4 Sub-skill Generation

Sub-skills **KHÔNG pre-defined** — AI Forge tạo chúng ở mỗi growth stage, dựa trên:
- Core skill bản chất
- evolution_hint (seed từ Soul Forge)
- Player identity snapshot
- Accumulated behavior data

```python
# Sub-skill generation happens at:
# 1. Soul Forge (Seed) → Core + SS0 (Domain passive)
# 2. Echo Deepening (Bloom) → SS1 unlocked
# 3. Aspect Forge (Aspect) → SS2 + SS3 unlocked
# 4. Ultimate Synthesis → Ultimate Ability + merge all
```

---

## 3. Domain System — "Vùng chúa tể"

> Inspired by: Tensura's Unique Skills granting immunity to lower-tier abilities of the same type

### 3.1 Concept

Mỗi Unique Skill tạo 1 **Domain** — vùng ảnh hưởng nơi:
1. Unique Skill **immune** với Normal Skill cùng category
2. Unique Skill có **authority** cao hơn Normal Skill trong combat resolution

### 3.2 Domain Rules

```python
class SkillDomain(BaseModel):
    """Domain granted by Unique Skill."""
    category: str              # perception | manifestation | manipulation | contract | obfuscation
    immunity_description: str  # Human-readable: "Immune với Normal perception skills"
    authority_bonus: float     # Combat score bonus when unique vs normal same-category

DOMAIN_RULES = {
    "perception": {
        "immunity": "Normal perception/analysis skills KHÔNG thể feed thông tin sai cho player. "
                    "Nếu Normal perception nói A, Unique perception nói B → B luôn đúng.",
        "authority_bonus": 0.03,  # +3% combat score khi matchup
        "narrative": "Mắt bạn nhìn xuyên qua ảo ảnh mà kỹ năng thường nhìn thấy."
    },
    "manifestation": {
        "immunity": "Normal defensive/offensive manifestation skills KHÔNG thể cancel Unique manifestation. "
                    "VD: Normal barrier không chặn được Unique physical attack.",
        "authority_bonus": 0.03,
        "narrative": "Sức mạnh này không tuân theo quy luật thông thường."
    },
    "manipulation": {
        "immunity": "Normal manipulation/control skills KHÔNG thể override Unique manipulation. "
                    "VD: Normal terrain control bị phủ bởi Unique terrain control.",
        "authority_bonus": 0.03,
        "narrative": "Khi bạn thay đổi thế giới, thế giới NGHE."
    },
    "contract": {
        "immunity": "Normal contract/binding skills KHÔNG thể phá Unique contract. "
                    "All pacts sealed by Unique contract = unbreakable by normal means.",
        "authority_bonus": 0.03,
        "narrative": "Lời thề của bạn khắc vào thực tại — không ai gỡ được bằng sức mạnh thường."
    },
    "obfuscation": {
        "immunity": "Normal detection/reveal skills KHÔNG thể phá Unique obfuscation. "
                    "Player's stealth = impenetrable by Normal perception.",
        "authority_bonus": 0.03,
        "narrative": "Bạn biến mất — không phải ẩn, mà là KHÔNG TỒN TẠI trong nhận thức họ."
    }
}
```

### 3.3 Domain trong Combat

```python
def apply_domain_bonus(player, enemy, player_skill) -> float:
    """Apply Domain authority bonus if matchup qualifies."""
    if not player.unique_skill:
        return 0.0
    
    domain = player.unique_skill.domain
    
    # Check every enemy skill used this phase
    for enemy_skill in enemy.active_skills:
        if (enemy_skill.category == domain.category and 
            enemy_skill.tier <= 3):  # Domain chỉ immune vs Normal (Tier 1-3)
            return domain.authority_bonus  # +3%
    
    return 0.0
```

### 3.4 Domain Scaling

| Growth Stage | Domain Power |
|-------------|-------------|
| Seed | Immunity vs Normal cùng category. +3% combat bonus |
| Bloom | Immunity mở rộng: Normal skills cùng category không thể counter |
| Aspect | Domain ảnh hưởng narrative: NPC cảm nhận domain power |
| Ultimate | Domain vượt Tier 3: chỉ Unique Skill khác mới counter được |

### 3.5 Domain KHÔNG phải auto-win

> [!IMPORTANT]
> Domain chỉ **immune với Normal Skill cùng category**. Nó KHÔNG:
> - Immune với Normal Skill khác category
> - Immune với Unique Skill của player khác (future MMO)
> - Tăng raw damage
> - Thay đổi combat score formula

---

## 4. Axis Weakness — "Structural Blind Spot"

> Thay thế hoàn toàn weakness model cũ ("nghi ngờ bản thân").  
> Weakness mới = **thứ skill KHÔNG LÀM ĐƯỢC**, không phải "player cảm thấy X thì skill yếu".

### 4.1 Weakness Taxonomy — 7 Categories

Forge prompt **BẮT BUỘC** AI chọn 1 trong 7 loại weakness, rồi customize từ Phase data:

| # | Type | Mechanic | Ví dụ | Narrative Feel |
|---|------|----------|-------|----------------|
| 1 | **Soul Echo** | Ký ức pre-isekai xâm nhập khi dùng skill | Skill tạo ảo giác người đã mất khi bảo vệ ai giống họ | Backstory trả thù — drama |
| 2 | **Principle Bleed** | Principle của skill ảnh hưởng player ngoài combat | Entropy skill → ký ức bị "rỉ sét" sau khi dùng; Order skill → không thể nói dối 1 giờ | Mechanical — ảnh hưởng gameplay |
| 3 | **Resonance Dependency** | Skill misfire khi dùng trái identity | Skill bảo vệ dùng để tấn công → hiệu quả -50%; phải aligned | Identity-driven — buộc sống đúng |
| 4 | **Target Paradox** | Không dùng được với người/vật có tính chất X | Vô hiệu hóa với người player tin tưởng; không tác dụng lên cùng principle | Social game — tạo drama |
| 5 | **Sensory Tax** | Mất/suy giảm 1 giác quan tạm thời sau khi dùng | Mù 30 giây; mất xúc giác; hướng bắc biến mất | Visceral — player CẢM được cost |
| 6 | **Environment Lock** | Chỉ hoạt động dưới điều kiện môi trường | Chỉ trong bóng tối; khi có tiếng nước; khi im lặng hoàn toàn | Strategic — player phải plan |
| 7 | **Escalation Curse** | Side effect tệ hơn mỗi lần dùng liên tục | Lần 1: đau đầu. Lần 3: mất 1 ký ức ngẫu nhiên. Lần 5: mutation risk | Tension building — risk/reward |

### 4.2 Category Axis Weakness — Mỗi category "trống" ở đâu

Bổ sung cho weakness taxonomy, mỗi Unique Skill category có **structural blind spot**:

| Category | Mạnh ở Axis | Trống ở Axis | Ví dụ |
|----------|------------|-------------|-------|
| **Manifestation** | Direct combat, physical impact | Không thể hỗ trợ/heal đồng đội | "Cứng hóa cơ thể" → mạnh solo, vô dụng trong team |
| **Perception** | Thông tin, detection, analysis | Không tăng damage/defense trực tiếp | "Thấy sự thật" → biết nhược điểm nhưng không đánh mạnh hơn |
| **Contract** | Social, binding, oath | Không tác dụng nếu đối phương không tương tác/giao tiếp | "Lời thề ràng buộc" → vô hiệu với kẻ im lặng |
| **Manipulation** | Control terrain, reshape situation | Không burst damage, không instant kill | "Thay đổi trọng lực" → control nhưng không giết |
| **Obfuscation** | Stealth, evasion, misdirection | Không thể tank trực diện khi bị lộ | "Biến mất" → nếu bị spot, không có defense |

### 4.3 Weakness Evolution

Weakness KHÔNG mất đi khi skill evolve — nó **transform**:

```
SEED:    Weakness nguyên bản (strong constraint)
BLOOM:   Weakness nới lỏng nhẹ (1 điều kiện giảm)
ASPECT:  Weakness transform (thay đổi dạng nhưng vẫn tồn tại)
ULTIMATE: Weakness vẫn có — nhưng Ultimate Ability BYPASS nó 1 lần
```

**Ví dụ: "Thệ Ước Thép" — Sensory Tax**

| Stage | Weakness Form |
|-------|--------------|
| Seed | Mất xúc giác 30 giây sau khi cứng hóa — không cảm nhận vết thương |
| Bloom | Mất xúc giác 15 giây (nới lỏng) — nhưng giờ có sub-skill reflect nên ít cần cảm nhận |
| Aspect | Xúc giác không mất nhưng bị "chậm" 5 giây — tín hiệu đau đến muộn |
| Ultimate | Weakness bypass 1 lần khi dùng Ultimate Ability. Sau đó vẫn áp dụng |

---

## 5. Growth Stages — Sub-skill Unlock Path

### 5.1 Tổng quan tiến hóa

```
                    ┌── Coherence cao, aligned ────→ ECHO DEEPENING → BLOOM
                    │   (Sub-skill 1 unlock)
                    │
Unique Skill ───────┼── Survive trauma ────────────→ SCAR ADAPTATION → BLOOM
(SEED form)         │   (Sub-skill 1 unlock, defensive variant)
                    │
                    ├── Rank 4+, Awakened ─────────→ ASPECT FORGE
                    │   (Branch choice: Sub-skills 2+3)
                    │
                    └── Rank 5, Season Climax ─────→ ULTIMATE FORM
                        (All merge + Ultimate Ability + Name)
```

**Complete Evolution Path:**
```
Soul Forge          Echo/Scar (Bloom)     Aspect Forge          ULTIMATE
(sau onboarding) →  (narrative trigger) → (Rank 4 + Awakened) → (Rank 5 + Climax)
                                                                  
"Thệ Ước Thép"     "Thệ Ước Thép"      "Nộ Cương"          "Thiết Thệ Bất Hoại —
 (1 core + SS0)     (+ SS1: Phản Xạ)    (+ SS2 + SS3)        Chúa Tể Kim Cương"
```

### 5.2 Stage 1: SEED — "Mầm"

**Trigger:** Soul Forge completion (onboarding)

**Contains:**
- 1 Core Mechanic — primary effect
- 1 Sub-skill 0 (Domain Passive) — always-on domain immunity

**Power Level:** ≈ Tier 1 Normal Skill (combat output tương đương)

**Nhưng đã có:**
- Domain immunity (Normal cùng category không override)
- Sub-skill passive (nhỏ nhưng unique)
- evolution_hint (hidden — AI compass for future growth)

**Player feels:** "Skill này hơi khác Normal Skill... không hẳn mạnh hơn, nhưng có gì đó weird."

### 5.3 Stage 2: BLOOM — "Nở"

**Trigger:** Echo Deepening (coherence ≥ 70 sustained 10 scenes) HOẶC Scar Adaptation (3× survive trauma)

**Unlocks:**
- Core Mechanic enhanced (stronger/faster/wider)
- Sub-skill 1 (active hoặc reactive) — new capability

**Two variants:**

| Path | Trigger | Sub-skill 1 Type | Focus |
|------|---------|------------------|-------|
| **Echo Bloom** | Coherence ≥ 70, 10 scenes | Active (player-controlled) | Controlled power extension |
| **Scar Bloom** | 3× near-death/backlash | Reactive (auto-trigger) | Survival adaptation |

**Power Level:** ≈ Tier 1.5 — vẫn ngang Normal Skill Tier 2 về raw power, nhưng có 2 abilities thay vì 1.

**Player feels:** "Skill bắt đầu có chiều sâu. Tôi có thể làm được 2 thứ thay vì 1."

```python
def check_bloom_trigger(player, progression) -> str | None:
    """Check if Bloom is ready. Returns 'echo' or 'scar' or None."""
    growth = player.unique_skill_growth
    
    # Already bloomed → skip
    if growth.bloom_completed:
        return None
    
    # Echo path: coherence ≥ 70 sustained 10 scenes
    if growth.echo_coherence_streak >= 10:
        return "echo"
    
    # Scar path: 3× survive trauma
    if growth.scar_trauma_count >= 3 and not growth.scar_adapted:
        return "scar"
    
    return None
```

**AI Forge — Bloom Generation (lần 2):**

```
Tạo BLOOM form cho Unique Skill:

## Original Skill:
{unique_skill json}

## Growth Path: {echo_bloom | scar_bloom}

## Evolution Hint:
{evolution_hint}

## Player Identity Snapshot:
{identity_snapshot}

## Quy tắc:
1. Core mechanic: tăng cường NHẸ (range/speed/precision — KHÔNG tăng raw power)
2. Sub-skill 1:
   - Nếu echo_bloom: ACTIVE sub-skill — player control, mở rộng use case
   - Nếu scar_bloom: REACTIVE sub-skill — auto-trigger khi danger
3. Sub-skill phải KẾ THỪA theme từ core skill
4. Tên sub-skill: tiếng Việt, 2-3 từ, liên quan skill gốc
5. Weakness: nới lỏng 1 điều kiện nhưng KHÔNG XÓA
6. Domain: giữ nguyên

## Output JSON:
{
  "core_mechanic_enhanced": "Mô tả core enhanced 1-2 câu",
  "sub_skill_1": {
    "name": "Tên sub-skill",
    "type": "active | reactive",
    "mechanic": "Chi tiết hoạt động",
    "cost": "Stability cost hoặc condition",
    "trigger": "Khi nào kích hoạt (nếu reactive)"
  },
  "weakness_evolved": "Weakness nới lỏng thế nào",
  "bloom_narrative": "1-2 câu Writer guidance cho Bloom reveal scene"
}
```

### 5.4 Stage 3: ASPECT — "Aspect"

**Trigger:** Rank 4 (Transcendent) + Affinity Awakened + 20 uses + NOT already forged

**Unlocks:**
- Core Mechanic greatly enhanced
- Sub-skill 1 enhanced
- Sub-skill 2 (active) — aspect-specific, new capability
- Sub-skill 3 (passive) — aspect-specific, always-on

**Branching:** Player chọn 1 trong 2 aspects. Mỗi aspect cho sub-skills KHÁC NHAU.

**Power Level:** ≈ Tier 2-3 — giờ đây combat output vượt Normal Tier 2. Sub-skill ecosystem bắt đầu tạo lợi thế chiến lược.

**Player feels:** "Đây là LÚC unique skill thực sự define build. Normal Skill bắt đầu cảm thấy replaceable."

**Aspect Forge Flow (3 scenes — giữ nguyên từ v1):**

```
Scene 1 — "Skill Run": Skill kích hoạt bất thường — mạnh hơn, không kiểm soát
Scene 2 — "The Fork": 2 visions → DECISION POINT (chọn Aspect A hoặc B)
Scene 3 — "Reborn": Skill hoàn thành tiến hóa, first use
```

**AI Forge — Aspect Generation (lần 3):**

```
Tạo 2 ASPECTS cho Unique Skill. Mỗi aspect unlock 2 sub-skills mới.

## Current Skill (Bloom form):
{bloom_skill json, including SS0 and SS1}

## Evolution Hint:
{evolution_hint}

## Awakened Principle:
{awakened_principle}

## Quy tắc:
1. 2 aspects = 2 con đường KHÁC NHAU nhưng cùng grow từ skill gốc
2. Mỗi aspect unlock:
   - Sub-skill 2 (ACTIVE): new major capability
   - Sub-skill 3 (PASSIVE): always-on enhancement
3. Aspect A: thiên về DEFENSIVE/UTILITY/AREA
4. Aspect B: thiên về OFFENSIVE/FOCUSED/IMPACT
5. CẢ HAI tích hợp Awakened Principle
6. Sub-skill 1 (từ Bloom) được ENHANCE, không thay đổi bản chất
7. Domain EXPAND — ảnh hưởng narrative ngoài combat
8. Weakness TRANSFORM — dạng khác nhưng vẫn tồn tại
9. Tên mới cho mỗi aspect (source → 2 branches)

## Output JSON:
{
  "aspect_a": {
    "name": "Tên Aspect A",
    "description": "Mô tả tổng",
    "core_mechanic": "Core enhanced for Aspect A",
    "sub_skill_1_enhanced": "SS1 enhanced cho Aspect A",
    "sub_skill_2": { "name": "", "type": "active", "mechanic": "", "cost": "" },
    "sub_skill_3": { "name": "", "type": "passive", "mechanic": "" },
    "strength": "Aspect A mạnh ở đâu",
    "trade_off": "Aspect A yếu ở đâu",
    "weakness": "Weakness transformed",
    "awakened_integration": "Principle mới tích hợp thế nào"
  },
  "aspect_b": { ... }
}
```

### 5.5 Stage 4: ULTIMATE — "Thiên Mệnh"

> Inspired by: Rimuru's Raphael + Beelzebuth → Azathoth (God of the Void)

**Trigger:** Rank 5 (Sovereign) + Aspect Forged + Mastered compatible Normal Skill + Season Climax

**Unlocks:**
- ALL sub-skills merged + transcended
- Normal Skill absorbed (mất khỏi equipped)
- Ultimate Ability: God-tier, 1 use per season, 80% stability cost
- Naming Event: "[Tên] — [Danh xưng]"

**Power Level:** TRANSCEND — vượt mọi Tier. Chỉ Unique Skill khác mới counter.

**Player feels:** "Đây là khoảnh khắc xác định nhân vật. Skill không còn là tool — nó là BẢN THÂN TÔI."

**Ultimate Synthesis Flow (3 scenes — giữ nguyên từ v1):**

```
Scene 1 — "Giới Hạn": Season Climax boss, bị dồn. Unique + Normal đều max power → vẫn thiếu
Scene 2 — "Cộng Hưởng": Evolution hint nhắc lại. 2 skills RESONANCE. Normal bị ABSORB → NAMING EVENT
Scene 3 — "Tái Sinh": Ultimate kích hoạt lần đầu. Boss resolved. Season 1 kết thúc
```

**AI Forge — Ultimate Generation (lần 4):**

```
Tạo ULTIMATE SKILL từ Synthesis: Unique (Aspect) + Normal Skill (mastered).

## Aspect Skill (evolved unique):
{aspect_skill json — bao gồm tất cả sub-skills}

## Absorbed Normal Skill:
{absorbed_skill json}

## Evolution Hint:
{evolution_hint}

## Player Journey Summary:
{identity_journey_summary}

## Quy tắc:
1. Ultimate = FUSION bản chất 2 skills, không chỉ cộng gộp
2. Tất cả sub-skills (SS0-SS3) merge thành refined versions
3. Ultimate Ability: 1 GOD-TIER ability, 1 lần per season
   - Stability cost: 80%
   - Phải reflect bản chất skill + hành trình player
4. Tên format: "[Tên Skill] — [Danh xưng]"
   VD: "Thiên Nhãn — Chúa Tể Sự Thật"
5. Weakness vẫn tồn tại nhưng Ultimate Ability BYPASS nó 1 lần
6. Absorbed skill tích hợp thế nào (KHÔNG chỉ "damage +")
7. soul_resonance: kết nối Void Between → NOW

## Output JSON:
{
  "ultimate_name": "Tên — Danh xưng",
  "description": "Base mechanic (transcended)",
  "merged_sub_skills": [
    { "name": "", "type": "", "mechanic": "" },
    ...
  ],
  "absorbed_integration": "Normal skill tích hợp thế nào",
  "ultimate_ability": {
    "name": "Tên UA",
    "description": "Cinematic description",
    "stability_cost": 80,
    "uses_per_season": 1,
    "narrative_impact": "Ảnh hưởng lên thế giới"
  },
  "weakness": "Weakness final form",
  "naming_resonance": "Vì sao tên này phù hợp"
}
```

---

## 6. Updated Forge Prompt — Seed Generation

### 6.1 Thay đổi so với v1

| Field | V1 | V2 |
|-------|----|----|
| mechanic | 1 mô tả đơn | Core Mechanic + quirk |
| weakness | "nghi ngờ bản thân" (generic) | Chọn 1/7 taxonomy + customize |
| *(new)* domain_passive | Không có | Sub-skill 0 — Domain passive |
| *(new)* weakness_type | Không có | Enum từ 7 loại |
| *(new)* axis_blind_spot | Không có | Structural weakness từ category |
| *(new)* unique_clause | Không có | Điều Normal Skill không thể |

### 6.2 New Forge Prompt (thay thế `_build_forge_prompt`)

```python
def _build_forge_prompt_v2(signals: IdentitySignals) -> str:
    behavioral = signals.behavioral

    return f"""BẠN LÀ SOUL FORGE — hệ thống rèn kỹ năng độc nhất từ linh hồn.

## Dữ liệu linh hồn:

Phase 1 — Hành trình trong hư vô:
- Void anchor: {signals.void_anchor}
- Attachment style: {signals.attachment_style}
- Moral core: {signals.moral_core}
- Decision pattern: {signals.decision_pattern}
- Conflict response: {signals.conflict_response}
- Risk tolerance: {signals.risk_tolerance}/3
- Power vs connection: {signals.power_vs_connection}
- Sacrifice type: {signals.sacrifice_type}
- Courage vs cleverness: {signals.courage_vs_cleverness}

Phase 2 — Mảnh linh hồn:
- Nguyên văn: "{signals.soul_fragment_raw}"
- Themes: {signals.soul_fragment_themes}
- Emotion: {signals.soul_fragment_emotion}
- Target: {signals.soul_fragment_target}
{f'''
Tiểu sử trước Isekai:
"{signals.backstory}"
→ Dùng backstory để LÀM GIÀU cơ chế và mô tả skill.
→ Skill nên PHẢN ÁNH kinh nghiệm/nghề nghiệp cũ một cách SÁNG TẠO.
''' if signals.backstory else ''}
Phase 3 — Soul Signature:
- Decisiveness: {behavioral.decisiveness}
- Deliberation: {behavioral.deliberation}
- Expressiveness: {behavioral.expressiveness}
- Confidence: {behavioral.confidence}
- Patience: {behavioral.patience}
- Consistency: {behavioral.consistency}
- Impulsivity: {behavioral.impulsivity}
- Revision tendency: {behavioral.revision_tendency}

## 6 Archetype (chọn 1):
- vanguard (Tiên Phong): Đối diện trực tiếp, không né tránh
- catalyst (Xúc Tác): Thay đổi thế giới xung quanh
- sovereign (Chủ Tể): Dẫn dắt và ảnh hưởng người khác
- seeker (Tầm Đạo): Tìm kiếm tri thức và bí mật
- tactician (Mưu Sĩ): Tính toán và thao túng cục diện
- wanderer (Lãng Khách): Tự do, không ràng buộc

## 5 Skill Category — mỗi category có DOMAIN (quyền miễn nhiễm):
- manifestation: combat direct (domain: immune normal defense/offense cùng loại)
- manipulation: terrain/situation control (domain: override normal manipulation)
- contract: social/binding (domain: unbreakable by normal means)
- perception: information/detection (domain: see through normal deception)
- obfuscation: stealth/misdirection (domain: undetectable by normal perception)

## TRIẾT LÝ: UNIQUE ≠ STRONGER. UNIQUE = WEIRD + PERSONAL + IRREPLACEABLE.
Normal skill: "tăng defense 20%"
Unique skill: "cứng hóa chỉ phần cơ thể ĐANG BỊ VA CHẠM — reactive, instant, nhưng chỉ 1 vùng"

## Quy tắc forge:
1. Chọn ARCHETYPE phù hợp nhất với toàn bộ dữ liệu 3 phase
2. Tên skill: tiếng Việt, 2-4 từ, poetic, ĐỘC NHẤT
3. Category: chọn DUY NHẤT 1, CONSISTENT với archetype
4. Core Mechanic:
   - CHỈ LÀM ĐƯỢC 1 VIỆC — nhưng cách hoạt động phải có QUIRK
   - Quirk = cách skill diễn ra khác thường, không predictable
   - VD hay: "Cứng hóa phần cơ thể đang bị tác động — reactive, không chọn được"
   - VD tệ: "Tăng defense. Giảm damage taken." (= Normal Skill)
   - Seed level = basic, KHÔNG quá mạnh
5. Domain Passive (Sub-skill 0):
   - Hiệu ứng passive luôn bật, liên quan Domain
   - VD: perception → "Tín hiệu mờ khi gần deception"
   - VD: manifestation → "+5% physical resist passive"
6. Limitation — ĐỘC ĐÁO, chọn 1-2 loại:
   - Điều kiện môi trường / Tác dụng phụ cơ thể / Ràng buộc cảm xúc
   - Giới hạn mục tiêu / Đánh đổi
   - ❌ CẤM "cooldown X + chỉ Y trung bình + không thể Z"
7. Weakness — CHỌN 1 TRONG 7 LOẠI, rồi customize từ Phase data:
   TYPE (chọn 1):
   - soul_echo: Ký ức pre-isekai xâm nhập khi dùng skill
   - principle_bleed: Principle ảnh hưởng player ngoài combat
   - resonance_dependency: Misfire nếu dùng trái identity
   - target_paradox: Không dùng được với người/vật tính chất X
   - sensory_tax: Mất giác quan tạm thời sau dùng
   - environment_lock: Chỉ hoạt động dưới điều kiện môi trường
   - escalation_curse: Side effect tệ hơn mỗi lần dùng liên tục
   
   Sau khi chọn type → CUSTOMIZE dựa trên Phase 1-3 data:
   - VD: sacrifice=courage + type=sensory_tax → "mất xúc giác vì cơ thể liều mạng"
   - VD: attachment=avoidant + type=target_paradox → "vô hiệu với người đang tin tưởng player"
   - ❌ CẤM mẫu "do dự, thiếu tự tin, nghi ngờ bản thân"
8. Unique Clause: 1 thứ Normal Skill KHÔNG BAO GIỜ làm được
   VD: "Skip boss gimmick 1 lần" / "Stability thấp → skill MẠNH hơn" / "Phá vỡ concealment permanently"
9. Activation: trigger gắn với personality
10. Soul Resonance: 1-2 câu poetic vì sao skill thuộc về player

Return ONLY JSON (no markdown):
{{
  "archetype": "1 trong 6",
  "name": "Tên Skill tiếng Việt",
  "description": "1 câu cụ thể skill làm gì",
  "category": "1 trong 5",
  "mechanic": "Chi tiết CORE MECHANIC 2-3 câu: có QUIRK, không generic",
  "domain_passive": {{
    "name": "Tên sub-skill 0",
    "mechanic": "Hiệu ứng passive domain 1-2 câu"
  }},
  "limitation": "Giới hạn ĐỘC ĐÁO",
  "weakness_type": "1 trong 7 types",
  "weakness": "Điểm yếu CÁ NHÂN — customize từ Phase data",
  "unique_clause": "1 thứ Normal Skill không thể làm",
  "activation_condition": "Trigger cụ thể",
  "activation_cost": "Chi phí sáng tạo",
  "soul_resonance": "1-2 câu poetic",
  "trait_tags": ["max 3 DNA tags"],
  "evolution_hint": "1 câu hint ẩn cho growth direction"
}}"""
```

---

## 7. Updated UniqueSkill Model

### 7.1 UniqueSkill v2

```python
# app/models/player.py — UniqueSkill updated

class SubSkill(BaseModel):
    """A sub-skill within a Unique Skill ecosystem."""
    name: str = ""
    type: str = ""               # "passive" | "active" | "reactive"
    mechanic: str = ""           # How it works
    cost: str = ""               # Stability cost or trigger condition
    trigger: str = ""            # For reactive: when does it auto-activate
    unlocked_at: str = ""        # "seed" | "bloom" | "aspect" | "ultimate"

class UniqueSkill(BaseModel):
    """AI-generated unique skill from Soul Forge.
    
    V2: Sub-skill ecosystem + Domain + Axis Weakness.
    """
    name: str = ""                              
    description: str = ""                       
    category: str = ""                          # manifestation | perception | etc.
    trait_tags: list[str] = Field(default_factory=list)
    
    # Core mechanic
    mechanic: str = ""                          # Core mechanic with quirk
    unique_clause: str = ""                     # What Normal Skill can't do
    
    # Sub-skill ecosystem
    sub_skills: list[SubSkill] = Field(default_factory=list)    # SS0 at seed, grow over time
    
    # Domain
    domain_category: str = ""                   # Same as category
    domain_passive_name: str = ""               # SS0 name
    domain_passive_mechanic: str = ""           # SS0 effect
    
    # Weakness (V2 — structured)
    weakness_type: str = ""                     # 1 of 7 taxonomy types
    weakness: str = ""                          # Customized description
    axis_blind_spot: str = ""                   # Structural category weakness
    
    # Limitations & Activation
    limitation: str = ""                        
    activation_condition: str = ""              
    activation_cost: str = ""                   
    
    # Soul connection
    soul_resonance: str = ""                    
    evolution_hint: str = ""                    # Hidden — AI compass
    
    # Meta
    countered_by: list[str] = Field(default_factory=list)
    resilience: float = 100.0                   # Internal skill health (FAILURE_SPEC)
    instability: float = 0.0                    
    suppression_resistance: float = 50.0        # External counter resist (CONTROL_SYSTEM)
    is_revealed: bool = False                   # Secret by default
    uniqueness_score: float = 1.0               
    forge_timestamp: datetime | None = None     
    
    # Growth stage
    current_stage: str = "seed"                 # seed | bloom | aspect | ultimate
```

### 7.2 UniqueSkillGrowthState v2

```python
class UniqueSkillGrowthState(BaseModel):
    """Complete growth state tracking — V2 with sub-skill management."""
    skill_id: str
    original_skill_name: str
    current_skill_name: str          # Changes after aspect/ultimate
    current_stage: str = "seed"      # seed | bloom | aspect | ultimate
    
    # Active growth path
    active_growth: GrowthType = GrowthType.BASE
    bloom_path: str = ""             # "echo" | "scar" | ""
    bloom_completed: bool = False
    
    # Echo tracking (for Echo Bloom)
    echo_coherence_streak: int = 0
    echo_can_lose: bool = True       # Echo bloom can be lost if coherence drops
    
    # Scar tracking (for Scar Bloom)
    scar_adapted: bool = False
    scar_type: ScarType | None = None
    trauma_log: list[TraumaEvent] = Field(default_factory=list)
    scar_trauma_count: int = 0
    
    # Aspect Forge
    aspect_forged: bool = False
    aspect_options: list[AspectOption] = Field(default_factory=list, max_length=2)
    aspect_chosen: str = ""
    aspect_deferred: bool = False
    aspect_defer_chapter: int = 0
    
    # Ultimate Form
    ultimate_forged: bool = False
    ultimate_skill: UltimateSkill | None = None
    absorbed_skill_id: str = ""
    naming_event_completed: bool = False
    
    # Sub-skill tracking
    sub_skills_unlocked: list[str] = Field(default_factory=list)  # Sub-skill names
    
    # Mutation
    mutation_count: int = 0
    mutation_locked: bool = False     # True after Aspect Forge
    
    # Combat
    combat_bonus: float = 0.0
```

---

## 8. Combat Integration

### 8.1 Combat Score Bonus (updated)

```python
def unique_skill_combat_bonus(player) -> float:
    """0.0-0.08 bonus (upgraded from 0.05 cap in v1)."""
    growth = player.unique_skill_growth
    base = 0.01  # Unique skill exists = 1%
    
    # Domain authority bonus (if matchup qualifies)
    base += apply_domain_bonus(player, current_enemy, player_skill)  # +0-3%
    
    # Bloom bonus
    if growth.bloom_completed:
        base += 0.01  # Bloom: +1%
    
    # Scar defensive bonus
    if growth.scar_adapted and growth.scar_type == ScarType.DEFENSIVE:
        base += 0.01
    
    # Aspect bonus
    if growth.aspect_forged:
        base += 0.02  # Aspect: +2%
    
    # Ultimate
    if growth.ultimate_forged:
        base = 0.08  # Auto-max
    
    return min(0.08, base)
```

### 8.2 Sub-skill trong CombatBrief

```python
# CombatBrief passiert tells Writer which sub-skills are available:
combat_brief.unique_skill_context = {
    "name": skill.name,
    "stage": growth.current_stage,
    "active_sub_skills": [ss.name for ss in skill.sub_skills if ss.type in ("active", "reactive")],
    "domain": skill.domain_passive_name,
    "weakness_type": skill.weakness_type,
    "unique_clause": skill.unique_clause,
    "can_use_ultimate_ability": (
        growth.ultimate_forged and 
        not growth.ultimate_skill.ultimate_ability.used_this_season
    ),
}
```

### 8.3 Domain trong Combat Resolution

```python
# In compute_combat_score():

# ... existing formula ...

# NEW: Domain authority
domain_bonus = apply_domain_bonus(player, enemy, skill)
score += domain_bonus  # +0-3%

# NEW: Sub-skill activation (replaces simple 5% unique bonus)
sub_skill_bonus = evaluate_sub_skills(player, enemy, combat_context)
score += sub_skill_bonus  # +0-3%

# NEW: Unique clause check
if check_unique_clause_applicable(player, enemy, combat_context):
    score += 0.05  # Unique clause = significant advantage
```

---

## 9. Migration from V1

### 9.1 Breaking Changes

| V1 | V2 | Migration |
|----|----|----|
| `UniqueSkill.mechanic` = single effect | Core Mechanic + Sub-skills | Regenerate via forge prompt v2 |
| `UniqueSkill.weakness` = free-form | `weakness_type` + `weakness` structured | Re-forge or manual tag |
| No Domain | `domain_passive`, `domain_category` | Generate via prompt |
| No Sub-skills | `sub_skills: list[SubSkill]` | New field, empty for existing |
| No `unique_clause` | `unique_clause: str` | Generate via prompt |
| No `axis_blind_spot` | `axis_blind_spot: str` | Auto-derive from category |
| Echo/Scar = modifier only | Echo/Scar = Bloom stage (unlock SS1) | Reframe existing Echo/Scar |
| Combat bonus cap: 5% | Combat bonus cap: 8% | Update formula |

### 9.2 Backward Compatibility

Existing UniqueSkill objects (v1) **vẫn hoạt động** — new fields default to empty:
- `sub_skills = []` → no sub-skills, but core mechanic works
- `weakness_type = ""` → old weakness still displayed
- `unique_clause = ""` → no special clause

**Re-forge recommended** khi player enters Bloom stage → system regenerates with v2 format.

---

## 10. V1 Sections Retained (Reference)

Các phần sau từ UNIQUE_SKILL_GROWTH_SPEC v1.1 **GIỮ NGUYÊN** trong v2:

| Section | Link | Status |
|---------|------|--------|
| Growth × Identity Mutation Interaction | V1 §9 | ✅ Giữ nguyên |
| Growth Priority Logic | V1 §3.2 | ✅ Giữ nguyên (Ultimate > Aspect > Scar > Echo) |
| Aspect Forge Narrative Arc (3 scenes) | V1 §6.5 | ✅ Giữ nguyên |
| Ultimate Synthesis Arc (3 scenes) | V1 §7.3 | ✅ Giữ nguyên |
| Ultimate Ability constraints (1/season, 80% stability) | V1 §7.7 | ✅ Giữ nguyên |
| Scar Adaptation 3 types (defensive/counter/warning) | V1 §5.3 | ✅ Giữ nguyên, now = Scar Bloom |
| Echo có thể mất | V1 §4.4 | ✅ Giữ nguyên |
| Naming Event format | V1 §7.4 | ✅ Giữ nguyên |

---

## 11. Phase Scope

### Phase 1 — Must Have

| Component | Chi tiết |
|-----------|----------|
| UniqueSkill v2 model | Sub-skills, Domain, weakness taxonomy |
| Forge Prompt v2 | Updated `_build_forge_prompt_v2` |
| Domain passive (SS0) | Always-on immunity + authority bonus |
| Weakness taxonomy (7 types) | Structured weakness generation |
| Bloom Stage (Echo path) | Sub-skill 1 unlock via coherence |
| Bloom Stage (Scar path) | Sub-skill 1 unlock via trauma |
| Growth check per scene | Updated for Bloom trigger |
| Combat Domain bonus | +3% authority when matchup |

### Phase 2 — Full System

| Component | Phase |
|-----------|-------|
| Aspect Forge (full, SS2+SS3) | Phase 2 |
| Ultimate Form (full synthesis) | Phase 2 |
| AI Forge regeneration (Bloom/Aspect/Ultimate prompts) | Phase 2 |
| Sub-skill combat evaluation | Phase 2 |
| Domain scaling (per growth stage) | Phase 2 |
| Echo loss mechanic (coherence drop) | Phase 2 |
| Growth × Mutation interaction | Phase 2 |
| Unique Clause combat check | Phase 2 |

---

## 12. Complete Example — "Thệ Ước Thép" (Steel Oath)

Archetype: Vanguard | Category: Manifestation | Weakness: Sensory Tax

### Seed
```
Name: Thệ Ước Thép
Core: Cứng hóa phần cơ thể ĐANG BỊ VA CHẠM (reactive, instant, 1 vùng)
Quirk: Chỉ reactive — không chọn chủ động — phải bị đánh mới trigger
SS0 (Domain): "Thân Thép" — Immune Normal defensive skills cùng principle, +5% phys resist
Weakness (sensory_tax): Mất xúc giác 30 giây sau cứng hóa — không cảm nhận vết thương
Unique Clause: Stability < 30% → skill MẠNH hơn (thay vì yếu như bình thường)
Axis Blind Spot: Manifestation → không thể hỗ trợ đồng đội
```

### Echo Bloom
```
Core++: Cứng hóa NHANH hơn, phủ RỘNG hơn (từ 1 vùng → 2 vùng adjacent)
SS1 (reactive): "Phản Xạ Thép" — Khi cứng hóa thành công, reflect 20% damage
Weakness nới lỏng: Mất xúc giác 15 giây (giảm từ 30)
```

### Aspect B — "Nộ Cương" (Fury Hardening)
```
Core+++: Cứng hóa TOÀN THÂN khi stability < 30% (unique clause activated)
SS1 enhanced: "Phản Xạ Thép" → reflect 35% + knockback
SS2 (active): "Nộ Cương" — Voluntary full-body harden 3 giây, cost 25 stability
SS3 (passive): "Ký Ức Thép" — Cơ thể nhớ pattern đòn, cùng loại attack lần 2+ cứng hóa nhanh gấp đôi
Weakness transform: Xúc giác không mất nhưng bị "chậm" — tín hiệu đau đến delay 5 giây
New Domain: NPC cảm nhận "aura thép" — intimidation effect trong negotiation
```

### Ultimate — "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"
```
Absorbed: "Matter Shield" (Tier 2, mastered)
Core Transcended: Cứng hóa không chỉ thân thể — BẤT KỲ VẬT ThỂ cơ thể chạm vào
  → Cứng hóa mặt đất tạo wall, cứng hóa vũ khí địch vô hiệu hóa nó
SS merged: 
  - "Thiết Phản" (reflect 50% + area knockback)
  - "Kim Cương Thể" (passive +20% all resist, stack với SS0)
  - "Trí Nhớ Thép" (auto-dodge 3rd+ attack cùng loại)
Ultimate Ability: "Thiết Thệ Tuyệt Đối" — Toàn bộ reality trong bán kính 10m cứng hóa
  → Freeze mọi thứ: enemy, projectile, environment
  → Cost: 80% stability
  → 1/season
  → Boss hidden phase bị FREEZE — skip 1 gimmick
Weakness final: Sau khi dùng UA, toàn thân MỀM hoàn toàn 1 scene — chịu 2× damage
Naming Resonance: "Lời thề bằng thép — không ai phá vỡ. Từ reactive defense sang 
  absolute authority over physical reality."
```

---

## 14. World Echo — "Tiếng Vọng Thế Giới"

> Inspired by: Tensura's **Voice of the World** (世界の声) — khi Rimuru nhận Ultimate Skill, thế giới phát announcement mà mọi thực thể mạnh đều cảm nhận được.

### 14.1 Concept

Khi một sự kiện **đủ lớn** xảy ra (Ultimate Naming Event, Sovereign Skill acquisition), thế giới Amoisekai phát ra một **World Echo** — xung chấn narrative mà NPC, boss, và hệ thống thế giới đều phản ứng.

**World Echo KHÔNG phải UI popup** — nó là **narrative moment** được Writer dệt vào câu chuyện.

### 14.2 Trigger Conditions

| # | Event | Echo Level | Narrative Impact |
|---|-------|------------|----------------|
| 1 | **Ultimate Naming Event** | 🌟 Major Echo | NPC mạnh cảm nhận "ai đó vừa vượt ngưỡng". Boss chương tiếp thận trọng hơn |
| 2 | **Sovereign Skill Awakening** (§15) | 🌌 World Tremor | Toàn bộ thế giới cảm nhận. NPC faction thay đổi thái độ. Boss coi player là threat |
| 3 | **Aspect Forge Completion** | ⚡ Minor Echo | NPC gần nhất cảm nhận power shift. Không lan xa |

### 14.3 Echo Mechanics

```python
class WorldEcho(BaseModel):
    """Narrative event triggered by major power milestones."""
    echo_level: str = ""          # "minor" | "major" | "world_tremor"
    trigger_event: str = ""       # "ultimate_naming" | "sovereign_awakening" | "aspect_forge"
    player_id: str = ""
    skill_name: str = ""          # Skill vừa evolve
    
    # Writer guidance
    narrative_directive: str = "" # Hướng dẫn Writer dệt Echo vào scene
    npc_reaction_hint: str = ""   # NPC phản ứng thế nào
    world_consequence: str = ""   # Hệ quả lên thế giới

ECHO_TEMPLATES = {
    "ultimate_naming": {
        "echo_level": "major",
        "narrative_directive": (
            "Giữa scene, mọi thứ DỪNG LẠI 1 nhịp. "
            "Không khí nặng hơn. Mặt đất rung nhẹ. "
            "NPC mạnh nhất trong scene NHÌN về phía player — "
            "không hiểu chuyện gì, nhưng bản năng la hét. "
            "Player CẢM NHẬN tên skill mới — không phải nghe, mà biết. "
            "Như thế giới vừa viết tên của họ vào nền tảng thực tại."
        ),
        "npc_reaction_hint": (
            "NPC rank thấp: không nhận ra gì. "
            "NPC rank cao (3+): khựng lại, quay đầu, mắt mở to. "
            "Boss: cảnh giác, thay đổi strategy."
        ),
        "world_consequence": (
            "Chapter sau: NPC bắt đầu đồn đại về 'ai đó vừa phá vỡ giới hạn'. "
            "Faction đối lập cử scout. Notoriety +15."
        ),
    },
    "sovereign_awakening": {
        "echo_level": "world_tremor",
        "narrative_directive": (
            "CẮT SCENE. Toàn bộ thế giới trải qua 1 khoảnh khắc — "
            "từ Tower đến Frontier, từ thành phố đến rừng sâu. "
            "Ai có resonance ≥ 0.5 đều CẢM NHẬN: 'Thứ gì đó vừa thức tỉnh.' "
            "Bầu trời thay đổi màu 3 giây. Rồi mọi thứ trở lại bình thường. "
            "Nhưng những kẻ mạnh BIẾT — thế giới vừa thay đổi."
        ),
        "npc_reaction_hint": (
            "ALL NPC cảm nhận. Rank thấp: bất an, không hiểu. "
            "Rank cao: kinh hoàng hoặc hào hứng. "
            "Faction leaders: triệu tập họp khẩn cấp."
        ),
        "world_consequence": (
            "Toàn bộ political landscape shift. "
            "Player trở thành 'person of interest' cho mọi faction. "
            "Notoriety +30. Story arc mới unlock."
        ),
    },
    "aspect_forge": {
        "echo_level": "minor",
        "narrative_directive": (
            "Xung quanh player, không khí dao động nhẹ. "
            "NPC gần nhất cảm thấy 'cold chill' hoặc 'áp lực mơ hồ'. "
            "Không ai biết tại sao. Chỉ player biết — skill vừa tiến hóa."
        ),
        "npc_reaction_hint": "NPC gần nhất nhìn player khác đi. Không comment.",
        "world_consequence": "Notoriety +5. Không ảnh hưởng lớn.",
    },
}
```

### 14.4 Writer Integration

World Echo được truyền vào `SceneWriterInput` và Writer dệt vào narrative:

```python
# Trong orchestrator, sau growth event:
if growth_event in ("ultimate_naming", "sovereign_awakening", "aspect_forge"):
    echo = WorldEcho(
        echo_level=ECHO_TEMPLATES[growth_event]["echo_level"],
        trigger_event=growth_event,
        player_id=player.id,
        skill_name=player.unique_skill.name,
        narrative_directive=ECHO_TEMPLATES[growth_event]["narrative_directive"],
        npc_reaction_hint=ECHO_TEMPLATES[growth_event]["npc_reaction_hint"],
        world_consequence=ECHO_TEMPLATES[growth_event]["world_consequence"],
    )
    # Inject vào Writer context
    scene_input.world_echo = echo
```

### 14.5 Echo Rules

| Quy tắc | Lý do |
|---------|-------|
| Echo KHÔNG phải cutscene — nó woven vào prose | Immersion |
| Echo chỉ xảy ra TẠI SCENE growth event | Không delayed |
| NPC phản ứng TÙY RANK (chỉ strong NPC nhận ra) | Power hierarchy cảm nhận |
| World Consequence = persistent (ảnh hưởng chapters sau) | Gravity of the moment |
| Minor Echo không tạo notoriety lớn | Chỉ Ultimate/Sovereign mới "shake the world" |

---

## 15. Sovereign Skill — "Thiên Mệnh Chi Kỹ" (天命之技)

> Inspired by: Tensura's **Unique → Ultimate Skill** evolution.  
> Trong Tensura, Unique Skill (Predator) phát triển thành Ultimate Skill (Beelzebuth) khi đủ điều kiện.  
> Amoisekai adapt: Unique Skill (Ultimate stage) có thể tiến hóa tiếp thành **Sovereign Skill** — 6 Ultimate Skill mạnh nhất thế giới.

### 15.1 Triết lý

> Mọi player đều có Unique Skill. Mọi Unique Skill đều có thể đạt Ultimate stage.  
> Nhưng chỉ **6 Unique Skill trên toàn thế giới** có thể tiến hóa thêm 1 bước — thành **Sovereign**.  
>  
> Sovereign Skill **CHÍNH LÀ** Unique Skill đã vượt qua giới hạn cuối cùng.  
> Không phải hệ thống tách biệt. Không phải skill mới. Mà là Unique Skill đã **GIÁC NGỘ**.  
>  
> Khi Unique Skill tiến hóa thành Sovereign — player không còn là chiến binh.  
> Họ là **thực thể định hình thế giới**.

### 15.2 Con Đường Tiến Hóa — Unique → Sovereign

```
MỌI PLAYER:  Unique Skill → Seed → Bloom → Aspect → Ultimate
                                                        ↓
                                              (điều kiện cực khắt khe)
                                                        ↓
CHỈ 6 NGƯỜI: Ultimate → SOVEREIGN (Dormant → Awakened → Ascended)
                         ↑
                         Unique Skill KHÔNG BIẾN MẤT
                         Nó TIẾN HÓA — tất cả sub-skills, domain,
                         weakness đều TRANSCEND lên tầng mới
```

**So sánh stage:**

| Stage | Tensura Equivalent | Power Level | Ai đạt được? |
|-------|-------------------|-------------|-------------|
| Seed | Common Skill | Tier 1 | Mọi player |
| Bloom | Extra Skill | Tier 2 | Mọi player (nếu chơi đúng) |
| Aspect | — | Tier 3 | Đa số player |
| Ultimate | Unique Skill | God-tier | Player đạt Rank 5 |
| **Sovereign** | **Ultimate Skill** | **Transcend** | **Chỉ 6 người trên thế giới** |

### 15.3 Sovereign Skills Registry — "Thế Giới Chỉ Có N Cái"

Trong lore Amoisekai, thế giới được xây trên 6 Principle (Order, Entropy, Matter, Flux, Energy, Void). Mỗi Principle có **1 Sovereign Skill** — tổng cộng **6 Sovereign Skills** tồn tại trong toàn thế giới.

| # | Sovereign Skill | Principle | Tensura Equivalent | Bản chất |
|---|----------------|-----------|-------------------|----------|
| 1 | **Thiên Nhãn Vạn Tượng** (All-Seeing Eye) | Order | Great Sage / Raphael | Phân tích, tính toán, dự đoán — thấy "cấu trúc" của mọi thứ |
| 2 | **Thôn Phệ Vạn Vật** (All-Devouring) | Entropy | Predator / Beelzebuth | Hấp thụ, phân rã, tái cấu trúc — "nuốt" bất kỳ thứ gì, chuyển đổi thành sức mạnh |
| 3 | **Kiến Tạo Vĩnh Hằng** (Eternal Forge) | Matter | Storm Dragon Veldora's Skill | Tạo vật chất từ hư vô, thay đổi hiện thực vật lý |
| 4 | **Biến Huyễn Vô Thường** (Infinite Flux) | Flux | Degenerate | Biến đổi bản chất, mutation, phá vỡ giới hạn sinh học |
| 5 | **Thần Hỏa Nguyên Thủy** (Primordial Flame) | Energy | Merciless / Charybdis | Năng lượng thuần túy, phá hủy ở cấp độ nguyên tử |
| 6 | **Hư Vô Thâm Uyên** (Abyssal Void) | Void | Azathoth (God-tier) | Phủ định sự tồn tại, tạo/xóa không gian, thao túng chiều không |

> [!CAUTION]
> Sovereign Skill#6 (Void) **KHÔNG THỂ acquire được trong Season 1**. Đây là endgame content cho Season 3+. Lore: "Hư Vô Thâm Uyên hiện KHÔNG CÓ CHỦ — người cuối cùng sở hữu nó đã... biến mất."

### 15.4 Acquisition Conditions — "Thế Giới Không Cho Dễ"

> [!IMPORTANT]
> Sovereign Skill **KHÔNG THỂ** farm, grind, hoặc buy. Nó require **chuỗi sự kiện narrative cực kỳ khắt khe**, và player PHẢI đáp ứng TẤT CẢ điều kiện.

**Template điều kiện (ALL must be met):**

```python
class SovereignAcquisitionCondition(BaseModel):
    """Conditions for Sovereign Skill awakening."""
    
    # ── Hard Requirements ──
    rank_minimum: int = 5              # Phải đạt Rank 5 (Sovereign)
    unique_skill_stage: str = "ultimate"  # Unique Skill phải ở Ultimate form
    season_minimum: int = 2            # Không thể acquire trong Season 1
    
    # ── Principle Alignment ──
    required_principle: str = ""       # Resonance với principle tương ứng
    principle_resonance_min: float = 0.9  # Resonance ≥ 0.9 (gần perfect alignment)
    
    # ── Identity Conditions ──
    coherence_minimum: float = 85      # Identity coherence ≥ 85 (sống đúng với bản thân)
    identity_test_passed: bool = False # Phải vượt qua Identity Trial (narrative)
    
    # ── Narrative Conditions ──
    world_crisis_active: bool = False  # Phải đang trong World Crisis arc
    sacrifice_made: bool = False       # Phải đã hy sinh thứ gì đó THỰC SỰ quan trọng
    witness_count: int = 0             # ≥ 3 NPC "chứng kiến" moment awakening
    
    # ── Compatibility ──
    unique_skill_compatible: bool = False  # Unique Skill category phải compatible
```

**Ví dụ: Acquire "Thôn Phệ Vạn Vật" (All-Devouring / Entropy)**

```
ĐIỀU KIỆN:
├── Rank 5 (Sovereign)                          ✅ Hard gate
├── Unique Skill = Ultimate form                 ✅ Đã hoàn tất growth
├── Season ≥ 2                                   ✅ Không rush Season 1
├── Resonance Entropy ≥ 0.9                      ✅ Gần perfect Entropy alignment
├── Identity Coherence ≥ 85                      ✅ Sống đúng bản thân
├── World Crisis: "Entropy rift" đang active     ✅ Story arc specific
├── Sacrifice: Đã sacrifice Normal Skill yêu thích  ✅ Player phải "mất" thứ gì
├── Unique Skill compatible với Entropy axis     ✅ Không phải ai cũng compatible
└── Identity Trial: Đã vượt 3-scene trial arc    ✅ AI-generated challenge
    ├── Trial 1: "Bạn có dám hấp thụ sức mạnh TỪ CHÍNH KẺ THÙ?"
    ├── Trial 2: "Cái giá của 'nuốt' là MẤT bản thân. Chấp nhận?"
    └── Trial 3: "Lựa chọn cuối: nuốt hay tha?"
```

### 15.5 Sovereign Skill Structure

Sovereign Skill **KHÔNG** follow Sub-skill ecosystem giống Unique Skill. Nó có cấu trúc riêng:

```python
class SovereignSkill(BaseModel):
    """World-level skill — only 1 owner at a time."""
    
    sovereign_id: str = ""              # "all_seeing" | "all_devouring" | etc.
    name: str = ""                      # "Thôn Phệ Vạn Vật"
    title: str = ""                     # "Chủ Nhân Của Sự Tan Rã"
    principle: str = ""                 # Principle gắn với
    
    # ── Abilities (pre-defined, NOT AI-generated) ──
    passive_authority: str = ""         # Always-on: domain vượt Unique
    active_ability: str = ""            # Main power
    forbidden_ability: str = ""         # 1/lifetime — cost cực nặng
    
    # ── Catastrophic Weakness ──
    weakness: str = ""                  # SEVERE — nặng hơn Unique weakness rất nhiều
    backlash_condition: str = ""        # Khi nào backlash xảy ra
    
    # ── Growth ──
    current_phase: str = "dormant"      # dormant | awakened | ascended
    
    # ── Owner ──
    owner_id: str = ""                  # Player ID — only 1
    awakening_timestamp: datetime | None = None
```

### 15.6 Sovereign Skill — Full Design (All 6)

> Mỗi Sovereign Skill bắt nguồn từ Unique Skill của player. Khi điều kiện khắt khe được đáp ứng, thế giới "nhận ra" player xứng đáng mang sức mạnh của Principle — và **thức tỉnh** Sovereign Skill trong họ. Từ đây, player không chỉ là chiến binh — mà là **thực thể định hình thế giới**.

---

#### 🔷 #1 — "Thiên Nhãn Vạn Tượng" (All-Seeing Eye) — ORDER

**Sovereign Title:** "Người Thấy Cấu Trúc Thế Giới"  
**Tensura Feel:** Great Sage → Raphael → Ciel  
**Bản chất:** Không phải "nhìn thấy" — mà **hiểu cấu trúc** của mọi thứ. Quy luật, pattern, nhân quả. Thế giới trong mắt holder là **blueprint**.

```
PASSIVE AUTHORITY: "Tuyệt Đối Giải Tích"
  → Tự động phân tích MỌI tình huống — combat forecast accuracy +30%
  → Nhìn thấy enemy skill mechanic (narrative hint, KHÔNG raw stat)
  → Nhận cảnh báo TRƯỚC khi bẫy/ambush xảy ra
  → Khi đối mặt puzzle/trap: auto-hint solution direction

ACTIVE ABILITY: "Thiên Toán" (Celestial Computation)
  → Phân tích sâu 1 target → biết weakness, strategy tối ưu
  → Mỗi lần dùng: AI generate "analysis report" (narrative style):
    "Mắt của Thiên Nhãn phân rã đối thủ thành layers — 
     cấu trúc skill, nhịp tim, pattern cử động. 
     Bạn THẤY lỗ hổng: bước thứ 3 trong combo của hắn."
  → Cost: 20 stability + 10 giây "freeze" (toàn bộ consciousness tập trung)
  → Mỗi season: 5 lần dùng Active

FORBIDDEN ABILITY: "Toàn Tri" (Omniscience)
  → 1 LẦN PER GAME
  → Biết CHÍNH XÁC điều gì sẽ xảy ra trong 3 scene tiếp theo
  → AI generate 3 "prophecy visions" — player biết trước plot
  → Có thể THAY ĐỔI kết quả nếu act dựa trên knowledge
  → Cost: Sau khi dùng, mất khả năng "bất ngờ" — mọi surprise event
    trong 1 season đều bị telegraphed. "Biết tất cả = không còn gì thú vị."
  → Narrative: "Bạn nhìn thấy ba con đường phía trước. 
    Rõ ràng. Lạnh lùng. Và đột nhiên — tương lai không còn là bí ẩn.
    Bạn nhận ra: bí ẩn chính là thứ khiến cuộc sống đáng sống."

CATASTROPHIC WEAKNESS: "Nghịch Lý Toàn Tri" (Omniscience Paradox)
  → Biết quá nhiều = paralysis. Sau mỗi lần dùng Active:
    - Stability -5 (quá tải thông tin)
    - 10% chance nhìn thấy "future trauma" → coherence -3
    - Nếu dùng liên tục: migraines → tạm mất perception 1 scene
  → Long-term: Player bắt đầu "nhìn thấy" cái chết của NPC thân thiết
    TRƯỚC khi nó xảy ra — nhưng KHÔNG THỂ ngăn mọi thứ
  → "Nhìn thấy tất cả nghĩa là cũng nhìn thấy những thứ bạn ước mình không thấy."

TRIAL THEME: "Tri Thức Là Gánh Nặng"
  Scene 1: Player nhìn thấy vision — NPC thân cận sẽ chết nếu không act
  Scene 2: Act → cứu được 1, nhưng phải CHỌN ai. Thiên Nhãn cho thấy CÁCH CỨU 2 
           nhưng cost = mất bản chất Unique Skill tạm thời
  Scene 3: "Bạn có chấp nhận LUÔN THẤY sự thật — kể cả khi sự thật phá hủy bạn?"
```

**Acquisition đặc biệt:** Player phải có Unique Skill category **Perception** hoặc **Contract** (logic/analysis axis). Resonance **Order ≥ 0.9**.

---

#### 🟤 #2 — "Thôn Phệ Vạn Vật" (All-Devouring) — ENTROPY

**Sovereign Title:** "Chủ Nhân Của Sự Tan Rã"  
**Tensura Feel:** Predator → Gluttony → Beelzebuth  
**Bản chất:** Không phải phá hủy — mà **hấp thụ, phân rã, tái cấu trúc**. Mọi thứ chạm vào holder đều có thể bị "nuốt" và chuyển hóa thành sức mạnh.

```
PASSIVE AUTHORITY: "Vạn Vật Quy Một" (All Returns to One)
  → Bất kỳ skill/ability nào nhắm vào player → 10% bị "hấp thụ một phần"
  → Player gain insight về mechanic của skill bị hấp thụ
  → VƯỢT Domain — Unique Skill enemy cũng bị ảnh hưởng (5% thay vì 10%)
  → Narrative: "Đòn đánh chạm vào bạn — và BIẾN MẤT. 
    Không phải chặn. Không phải dodge. Nó bị NUỐT."

ACTIVE ABILITY: "Nuốt" (Devour)
  → Khi đánh bại enemy có skill đặc biệt:
    - "Absorb insight" — không copy skill, mà hiểu sâu mechanic
    - Mỗi season: chỉ absorb 2 insight
    - Insight tích hợp vào Unique Skill → boost sub-skill hiện tại
    - VD: absorb fire-type insight → Unique Skill thêm "heat resistance" narrative
  → Cost: 30 stability per absorption
  → Narrative: "Bạn chạm vào tàn dư sức mạnh của kẻ đã ngã — 
    và bạn CẢM NHẬN nó tan vào bạn. Không phải đánh cắp. Nó THUỘC VỀ bạn."

FORBIDDEN ABILITY: "Thôn Thiên" (Devour the Heavens)
  → 1 LẦN DUY NHẤT PER GAME
  → Absorb hoàn toàn 1 ability/entity → gain permanent power boost
  → Có thể nhắm vào: Boss essence, environmental anomaly, hoặc thậm chí 
    1 khái niệm (VD: "nuốt" bóng tối trong 1 vùng → vùng đó vĩnh viễn sáng)
  → Cost: Unique Skill bị "tạm khóa" 1 season. Weakness amplified 2×.
  → Narrative: "Bạn mở miệng — không phải miệng thể xác, 
    mà miệng linh hồn — và NUỐT. Bầu trời tối đi 3 giây.
    Khi sáng lại, thứ bạn nuốt KHÔNG CÒN TỒN TẠI. Nhưng bạn thấy... 
    trong gương, nụ cười của mình hơi khác."

CATASTROPHIC WEAKNESS: "Tự Thực" (Self-Devouring)
  → Entropy không phân biệt. Mỗi lần dùng Active:
    - 5% chance ký ức ngẫu nhiên bị "ăn mòn" (narrative: player quên 1 detail)
    - Mất 1 NPC relationship point (họ cảm thấy "cold" từ player)
    - Sau 10 lần dùng/season: MUST sacrifice 1 memory (player chọn)
  → Long-term: Thật sự quên — NPC nhắc chuyện cũ mà player không biết
  → "Cái giá của 'nuốt tất cả' là chính bạn cũng bị nuốt."

TRIAL THEME: "Hấp Thụ Hay Bị Hấp Thụ?"
  Scene 1: Enemy mạnh có ability player MUỐN. Trial: "Nuốt hay chiến đấu sòng phẳng?"
  Scene 2: Nuốt thành công — nhưng ability "cắn lại". Player phải KIỂM SOÁT entropy 
           bên trong. Fail = bị overwhelm, mất 1 sub-skill tạm thời.
  Scene 3: "Entropy là tự nhiên. Bạn không điều khiển nó — bạn BỊ NÓ CHỌN. 
           Chấp nhận?"
```

**Acquisition đặc biệt:** Unique Skill phải category **Manipulation** hoặc **Manifestation** (physical interaction axis). Resonance **Entropy ≥ 0.9**. Player phải đã sacrifice 1 Normal Skill trước đó.

---

#### 🟠 #3 — "Kiến Tạo Vĩnh Hằng" (Eternal Forge) — MATTER

**Sovereign Title:** "Người Viết Lại Hiện Thực"  
**Tensura Feel:** Veldora's Storm Dragon + Creation magic  
**Bản chất:** Không phải "tạo vật chất" đơn giản — mà **viết lại quy luật vật lý** ở cấp cơ bản. Holder không tạo từ hư vô — họ **thay đổi BẢN CHẤT** của thứ đã tồn tại. Gỗ thành thép. Không khí thành tường. Nước thành lưỡi kiếm.

```
PASSIVE AUTHORITY: "Kiến Tạo Trường" (Creation Field)
  → Bán kính 5m xung quanh player: vật chất BẤT ỔN ĐỊNH
  → Player có thể "gợi ý" thay đổi nhỏ mà không active:
    - Mặt đất cứng hơn dưới chân player (tự động)
    - Vũ khí player tự "sửa chữa" vết nứt nhỏ
    - Vật thể nhỏ bay xung quanh player khi emotional
  → Enemy trong Creation Field: vũ khí degrade 5%/scene (narrative: rỉ sét, cùn)
  → "Bạn đi qua — và thế giới vật chất BIẾT bạn là chủ."

ACTIVE ABILITY: "Tái Tạo" (Reshape)
  → Chạm vào vật thể → thay đổi BẢN CHẤT (không phải hình dạng)
    - Chạm tường đá → đá mềm như bùn → đi xuyên qua → đá cứng lại
    - Chạm vũ khí enemy → thép biến giòn → gãy khi đánh tiếp
    - Chạm mặt đất → tạo spike/wall/trap từ material sẵn có
  → KHÔNG tạo từ hư vô — phải có material để reshape
  → Cost: 25 stability per reshape. Reshape lớn = cost nhiều hơn.
  → Giới hạn: 1 reshape tại 1 thời điểm. Phải "thả" cái cũ trước khi reshape mới
  → Mỗi season: 8 lần dùng Active (nhiều hơn #1, #2 vì mỗi lần yếu hơn)
  → Narrative: "Bạn chạm vào lưỡi kiếm hắn — và thép RÊN RỈ. 
    Không phải magia. Bạn nói chuyện với vật chất — và nó NGHE."

FORBIDDEN ABILITY: "Sáng Thế" (Genesis)
  → 1 LẦN PER GAME
  → Tạo 1 vật thể VĨNH VIỄN từ hư vô — phá vỡ quy luật bảo toàn vật chất
  → Vật thể mang tính chất Sovereign: indestructible, resonates với Matter
  → VD: Tạo 1 thanh kiếm vĩnh viễn, 1 bức tường bảo vệ thành phố, 
    1 artifact cho NPC đồng minh
  → Cost: Player MẤT khả năng chữa lành thông thường 1 season
    HP không thể regen tự nhiên — chỉ hồi qua items/NPC heal
    "Bạn tạo ra thứ gì đó VĨNH CỬU — nhưng cơ thể bạn quên cách TỰ SỬA."
  → Narrative: "Từ hai bàn tay trống không — bạn NGHĨ, và hiện thực NGHE.
    Thứ bạn tạo ra không phải vật thể. Nó là MỘT PHẦN THỰC TẠI MỚI."

CATASTROPHIC WEAKNESS: "Nghịch Lý Tạo Hóa" (Creator's Paradox)
  → Thay đổi vật chất = vật chất thay đổi BẠN. Mỗi lần dùng Active:
    - 1 phần cơ thể player "cứng hóa" tạm thời (đau, mất linh hoạt)
    - Dùng liên tục: da bắt đầu có texture vật liệu cuối cùng reshape
      (VD: reshape đá nhiều → da tay rough như đá 1 scene)
  → Long-term: Player dần "mất ranh giới" giữa cơ thể và vật chất 
    NPC bắt đầu comment: "Bàn tay bạn... lạnh như đá."
  → Dùng quá 5 lần/chapter: bàn tay TẠM MẤT xúc giác — giống Unique weakness
    nhưng nặng hơn: mất cảm giác toàn bàn tay, không chỉ vùng nhỏ
  → "Người tạo ra thế giới mới — dần dần TRỞ THÀNH một phần của nó."

TRIAL THEME: "Sáng Tạo Cần Hy Sinh"
  Scene 1: Thảm họa vật lý — mặt đất nứt, thành phố sụp. Player cảm nhận 
           Matter "gọi" — có thể sửa chữa nếu resonance đủ mạnh.
  Scene 2: Sửa chữa thành công → nhưng phải chọn: 
           sửa TOÀN BỘ (→ hy sinh 1 memory) hay sửa 1 phần (→ giữ bản thân)
  Scene 3: "Sáng tạo không phải ban phát. Là ĐÁO ĐỔI. 
           Bạn lấy từ bản thân để cho thế giới. Sẵn sàng?"
```

**Acquisition đặc biệt:** Unique Skill phải category **Manifestation** (physical expression). Resonance **Matter ≥ 0.9**. Player phải đã **build hoặc protect** (không destroy) trong 3+ major narrative choices.

---

#### 🟣 #4 — "Biến Huyễn Vô Thường" (Infinite Flux) — FLUX

**Sovereign Title:** "Người Xóa Giới Hạn Của Sinh Mệnh"  
**Tensura Feel:** Degenerate (Rimuru) + Orc Lord's Starved  
**Bản chất:** Không phải "biến hình" — mà **phá vỡ ranh giới giữa các trạng thái tồn tại**. Holder nhìn sinh vật nghĩa là gì, ranh giới giữa sống/chết/biến đổi — và **bước qua** ranh giới đó. Khái niệm "cố định" không tồn tại với họ.

```
PASSIVE AUTHORITY: "Vạn Biến Thể" (Myriad Forms)
  → Cơ thể player ở trạng thái "semi-fluid" — siêu thích nghi:
    - Tự động adapt với môi trường (nóng → tản nhiệt; lạnh → insulate)
    - Miễn nhiễm status effects lần đầu (poison, paralysis, etc.) — 
      lần 2+ vẫn dính nhưng giảm 40% duration
    - Vết thương nhỏ tự seal (không heal — "đóng lại" bằng cách cơ thể 
      biến đổi mô xung quanh)
  → Narrative: "Lưỡi kiếm cắt vào vai — nhưng máu không chảy. 
    Thịt xung quanh vết thương... DI CHUYỂN, tự lấp đầy khoảng trống."

ACTIVE ABILITY: "Biến Sinh" (Transmute Life)
  → Biến đổi BẢN CHẤT sinh học — player hoặc target:
    - Self: Tạm biến đổi 1 phần cơ thể cho combat (ngón tay → claw, 
      da → chitin armor, mắt → hawk vision)
    - Target (touch): Biến đổi 1 tính chất sinh học (slows healing, 
      softens bones, overloads adrenaline)
  → KHÔNG thể biến đổi hoàn toàn (VD: không biến thành rồng)
  → Mỗi transmutation kéo dài 1 combat encounter, sau đó revert
  → Cost: 20 stability (self) / 35 stability (target — vì xâm phạm sinh mệnh khác)
  → Mỗi season: 6 lần dùng
  → Narrative: "Bạn nghĩ về VUỐT — và ba ngón tay uốn cong, 
    dài ra, sắc lạnh. Không phải magia. Cơ thể bạn chỉ đơn giản... 
    QUYẾT ĐỊNH rằng đây là hình dạng mới."

FORBIDDEN ABILITY: "Tái Sinh Tuyệt Đối" (Absolute Rebirth)
  → 1 LẦN PER GAME
  → Chọn 1 trong 2:
    A) REBIRTH SELF: Hoàn toàn tái tạo cơ thể → full HP, xóa mọi scar,
       xóa mọi status effect. Player literally "chết và sống lại" as better version.
       Cost: MẤT 1 Unique Skill sub-skill VĨNH VIỄN (chọn cái nào để sacrifice)
    B) REBIRTH OTHER: Cứu 1 NPC đã chết/bị mortal wound → revive.
       Cost: Player NHẬN toàn bộ scar/wound của NPC đó. Permanent HP max -20%.
  → Narrative A: "Bạn cảm nhận cơ thể tan rã — từng tế bào. Rồi chúng 
    GỘP LẠI, tốt hơn, mạnh hơn. Nhưng có thứ gì đó... thiếu. 
    Kỹ năng [tên sub-skill] không còn ở đây nữa."
  → Narrative B: "Bạn chạm vào [NPC]. Vết thương của họ — di chuyển. 
    Sang cơ thể BẠN. Họ mở mắt. Bạn gục xuống, cảm nhận cơn đau 
    mà lẽ ra họ phải chịu — VĨNH VIỄN."

CATASTROPHIC WEAKNESS: "Bất Ổn Định Sinh Học" (Biological Instability)
  → Cơ thể "quá linh hoạt" — mất ổn định sau mỗi lần Active:
    - Appearance thay đổi nhẹ mỗi lần (eye color shift, scar position move)
    - NPC bắt đầu KHÔNG NHẬN RA player nếu dùng quá nhiều
    - 3+ lần/chapter: Identity Coherence -5 per use (cơ thể drift = mind drift)
  → Long-term: Player dần mất "hình dạng cố định" — NPC thân cận lo lắng
    "Bạn trông... khác. Mỗi lần tôi gặp, bạn đều khác."
  → Extreme case (10+ uses/season): Risk "Type Collapse" — cơ thể TỰ BIẾN ĐỔI 
    ngoài kiểm soát. 1 scene player phải chiến đấu với CHÍNH CƠ THỂ mình.
  → "Phá vỡ giới hạn sinh mệnh — nghĩa là sinh mệnh cũng phá vỡ BẠN."

TRIAL THEME: "Ranh Giới Của Tồn Tại"
  Scene 1: NPC đồng minh bị mutation không kiểm soát — biến thành beast.
           Player cảm nhận Flux gọi: "Bạn có thể SỬA họ. Hoặc... HOÀN THIỆN biến đổi."
  Scene 2: Chọn "sửa" → phải sacrifice 1 phần stability of chính mình.
           Chọn "hoàn thiện" → NPC mạnh hơn nhưng MẤT nhân tính vĩnh viễn.
  Scene 3: "Sinh mệnh là dòng chảy, không phải trạng thái. 
           Bạn có dám trôi theo — biết rằng bạn sẽ KHÔNG BAO GIỜ giống 
           người bạn hôm qua?"
```

**Acquisition đặc biệt:** Unique Skill phải category **Manipulation** hoặc **Obfuscation** (change/transform axis). Resonance **Flux ≥ 0.9**. Player phải đã **survive 1 near-death mutation** (tương tác với Scar growth).

---

#### 🔴 #5 — "Thần Hỏa Nguyên Thủy" (Primordial Flame) — ENERGY

**Sovereign Title:** "Người Nắm Dòng Chảy Sinh Tử"  
**Tensura Feel:** Charybdis (energy entity) + Shizue (Ifrit controller) + Benimaru (controlled burn)  
**Bản chất:** KHÔNG phải "phá hủy bằng lửa". Mà là **kiểm soát dòng chảy năng lượng** — rút, truyền, chuyển đổi, và overload. Player là **dây dẫn** nối tất cả năng lượng trong thế giới. Lửa chỉ là biểu hiện bên ngoài — bản chất là quyền lực trên **mọi dạng energy**.

```
PASSIVE AUTHORITY: "Vạn Nguyên Cảm Ứng" (Universal Energy Sense)
  → Cảm nhận MỌI dòng năng lượng xung quanh:
    - "Thấy" life force của sinh vật (mạnh/yếu/dying)
    - Cảm nhận skill activation TRƯỚC khi nó hoàn thành (energy spike)
    - Biết enemy còn bao nhiêu "energy" cho combat (narrative hint)
  → Passive drain: Môi trường xung quanh player hơi "lạnh hơn" — 
    energy tự nhiên bị hút nhẹ về phía player
  → "Bạn đứng giữa rừng — và cỏ quanh chân héo dần. 
    Không phải chết. Năng lượng của chúng... đang chảy về BẠN."

ACTIVE ABILITY: "Chuyển Hóa" (Energy Transfer)
  → Rút hoặc truyền năng lượng — player là conduit:
    A) DRAIN: Rút energy từ target → player gain stability (+15-25)
       Cost: Target yếu đi (narrative), environment damage nhẹ
       Chỉ drain sinh vật yếu hơn player HOẶC môi trường
    B) OVERLOAD: Bơm năng lượng dư thừa vào target → target bùng cháy/nổ
       Cost: 30 stability. Target mạnh hơn player = chỉ gây stagger
       Target yếu hơn 2+ tier = devastating
    C) TRANSFER: Truyền energy cho đồng minh → ally gain stability (+15)
       Cost: Player mất stability tương ứng + 10 (transfer tax)
       ĐÂY LÀ DUY NHẤT 1 SOVEREIGN có khả năng HỖ TRỢ ĐỒNG ĐỘI
  → Mỗi season: 7 lần dùng (flexible vì có 3 modes)
  → Narrative: "Bạn ĐẶT TAY lên vai ally — và họ CẢM NHẬN. 
    Ấm. Mạnh. Như vừa uống 1 giọt mặt trời.
    Bạn rút tay lại — mệt mỏi. Tay bạn lạnh buốt."

FORBIDDEN ABILITY: "Thần Hỏa Tịnh Thế" (Purifying Flame)
  → 1 LẦN PER GAME
  → Giải phóng TOÀN BỘ energy tích trữ → tạo "Purifying Zone" bán kính 20m
  → TRONG zone:
    - Mọi debuff/curse/corruption → PURIFIED (xóa hoàn toàn)
    - Mọi energy-based attack → NEUTRALIZED  
    - Ally: Full heal + stability restore
    - Enemy: Energy bị DRAIN hoàn toàn → cannot use skills 1 scene
  → Cost: Player MẤT 100% stability sau khi dùng. 
    HP giảm còn 1. Bất tỉnh 1 scene.
    Cơ thể "cháy" từ bên trong — 3 scene sau: mọi energy ability bị suppress
  → Narrative: "Bạn MÔNG MÊ — và toàn bộ energy bên trong BÙNG CHÁY RA.
    Không phải lửa. Là ÁNH SÁNG. Thuần khiết. Tàn nhẫn. Đẹp.
    Mọi thứ trong 20 mét — sạch sẽ. Trong veo.
    Bạn gục xuống. Cơ thể rỗng. Nhưng mọi người xung quanh... 
    đang đứng. An toàn. Lần đầu tiên trong rất lâu — an toàn."

CATASTROPHIC WEAKNESS: "Đạo Dẫn Bất Toàn" (Imperfect Conduit / Lightning Rod)
  → Cơ thể player là "dây dẫn" — và dây dẫn thì HÚT điện.
  → ⚡ LIGHTNING ROD (luôn active, KHÔNG TẮT ĐƯỢC):
    - Mọi energy-based attack trong combat TỰ ĐỘNG bị HÚT về phía player
    - Kể cả attack nhắm vào ALLY → chuyển hướng sang player
    - Player trở thành TARGET SỐ 1 cho mọi skill dạng energy
    - Enemy AI nhận ra: "Tất cả năng lượng đều chảy về hắn" → tập trung fire
    - Narrative: "Lửa không cần nhắm — nó TÌM ĐẾN bạn. 
      Sét không chọn điểm rơi — nó đã CHỌN bạn từ lâu."
  → Mỗi lần drain/transfer:
    - 10% energy "rò rỉ" → gây damage ngoài ý muốn cho surroundings
    - Dùng liên tục: cơ thể nóng lên (NPC cảm nhận "sốt" khi chạm player)
    - 4+ lần/chapter: Risk "Overload" → energy BURST không kiểm soát
      → Damage player + surroundings. Ally gần → cũng bị ảnh hưởng.
  → Long-term: Player trở thành "nguy hiểm khi ở gần" — NPC ngại ngùng,
    giữ khoảng cách. Relationship bị ảnh hưởng.
    Đứng cạnh player = cảm thấy tóc dựng, da châm chích, hơi nóng bất thường.
  → "Bạn là dây dẫn — nhưng dây dẫn không CHỌN dòng điện nào chảy qua.
    Mọi năng lượng trong thế giới — đều tìm đường về BẠN."

TRIAL THEME: "Sức Mạnh Nào Cũng Có Nhiệt"
  Scene 1: Ally bị trapped trong energy field tử thần. Player cảm nhận:
           "Bạn có thể DRAIN field đó — nhưng energy sẽ đi vào BẠN."
  Scene 2: Drain thành công → nhưng body overload. Phải TRUYỀN energy 
           cho environment (phá hủy cảnh quan) hoặc GIỮ (tự cháy từ bên trong)
  Scene 3: "Năng lượng không sinh ra, không mất đi. Chỉ CHUYỂN ĐỔI. 
           Bạn chấp nhận vai trò DÂY DẪN — biết rằng dây dẫn luôn bị nóng?"
```

**Acquisition đặc biệt:** Unique Skill phải category **Manifestation** hoặc **Perception** (energy interaction axis). Resonance **Energy ≥ 0.9**. Player phải đã **cứu hoặc bảo vệ đồng minh** ít nhất 3 lần (selfless energy = key trait).

---

#### ⬛ #6 — "Hư Vô Thâm Uyên" (Abyssal Void) — VOID

**Sovereign Title:** "????" (Chưa ai biết — người cuối cùng sở hữu đã... biến mất)  
**Tensura Feel:** Azathoth (God of the Void) → Rimuru's final skill  
**Bản chất:** Phủ định sự tồn tại. Không tạo, không phá — mà **XÓA**. Holder kiểm soát ranh giới giữa "tồn tại" và "không tồn tại". Đây là Sovereign mạnh nhất — và nguy hiểm nhất.

> [!CAUTION]
> **LOCKED SEASON 3+.** Lore: "Sovereign Skill thứ 6 hiện KHÔNG CÓ CHỦ. Người cuối cùng sở hữu nó đã biến mất khỏi thực tại — không chết, không bị giết. Biến mất. Như thể chưa từng tồn tại. Chỉ còn lại 1 vết nứt trong bầu trời mà không ai giải thích được."

```
PASSIVE AUTHORITY: "Hư Vô Trường" (Void Field)
  → Bán kính 3m: reality "mỏng" hơn xung quanh player
    - Perception skill (kể cả Sovereign #1) bị nhiễu khi scan player
    - Player immune WITH tất cả detection (Perception + Obfuscation counter-loop)
    - Vật chất trong Void Field đôi khi "nhấp nháy" — tồn tại rồi không
  → Enemy trong Void Field: instinct la hét "RUN" — morale penalty
  → "Bạn đứng đó — và thế giới quanh bạn RUN RẨY. 
    Không phải sợ bạn. Sợ chỗ bạn đứng. 
    Vì ở đó — ranh giới giữa CÓ và KHÔNG bị MỜ."

ACTIVE ABILITY: "Triệt Tiêu" (Annul)
  → Chọn 1 "concept" trong combat scene → XÓA nó 1 lượt:
    - Xóa GRAVITY → mọi thứ bay (1 phase)
    - Xóa SOUND → im lặng tuyệt đối (obfuscation + perception nullify)
    - Xóa MOMENTUM → mọi đòn đánh dừng lại giữa không trung
    - Xóa PAIN → player không cảm đau (nhưng damage vẫn tính)
    - KHÔNG THỂ xóa "life" hoặc "existence" trực tiếp (đó là Forbidden)
  → Cost: 40 stability. Phải chọn concept TRƯỚC, không cancel mid-way.
  → Mỗi season: 3 lần dùng (ít nhất trong tất cả Sovereign)
  → Narrative: "Bạn nghĩ về ÂM THANH — và nó BIẾN MẤT. 
    Không phải tắt. Không phải im. Âm thanh KHÔNG CÒN TỒN TẠI.
    Mọi người há miệng nhưng không gì phát ra.
    Rồi bạn thả — và thế giới THỞ lại."

FORBIDDEN ABILITY: "Hư Vô Cấm Kỵ — Xóa Tồn Tại" (Void Erase)
  → 1 LẦN PER GAME — ĐÂY LÀ ABILITY MẠNH NHẤT TRONG TOÀN BỘ AMOISEKAI
  → XÓA 1 thực thể khỏi sự tồn tại — hoàn toàn. Vĩnh viễn.
    Không chết. Không bị giết. CHƯA TỪNG TỒN TẠI.
    Ký ức về thực thể đó BỊ XÓA khỏi mọi NPC.
    (Player vẫn nhớ — burden of void holder)
  → Target: 1 entity (person, monster, object, even 1 location)
  → Cost: GUY NHẤT TRONG GAME:
    - Player MẤT 50% HP MAX vĩnh viễn (không thể recover)
    - 1 random memory bị XÓA cùng target (player cũng mất fragment)
    - Identity Coherence -30 NGAY LẬP TỨC
    - Sovereign Skill tự LOCK 2 season (chỉ Passive hoạt động)
    - NPC gần nhất khi dùng → PERMANENT fear of player
  → Narrative: "Bạn nhìn [target] — và QUYẾT ĐỊNH: 
    'Ngươi chưa từng tồn tại.'
    Thực tại... ĐỒNG Ý.
    [Target] không biến mất. Không tan biến. 
    Không có quá trình. Một khoảnh khắc — CÓ. 
    Khoảnh khắc sau — KHÔNG. Như cắt 1 trang khỏi cuốn sách.
    Nhưng cuốn sách... biết trang đó đã ở đây. 
    Và cuốn sách — sẽ đòi lại."

CATASTROPHIC WEAKNESS: "Vực Thẳm Gọi Tên" (The Abyss Calls Back)
  → Void không phải công cụ — nó SỐNG. Và nó MUỐN player.
  → Mỗi lần dùng Active:
    - "Vết nứt" xuất hiện trong perception của player (nhìn thấy void flicker)
    - Stability -10 (void drain)
    - 15% chance "void whisper" — player nghe giọng nói từ void
      "Bước vào đi. Ở đây yên tĩnh hơn."
  → Long-term: Player bắt đầu CẢM THẤY THOẢI MÁI trong void — 
    đó là dấu hiệu nguy hiểm nhất. Identity Coherence tụt dần.
  → Nếu Identity Coherence < 40 trong khi sở hữu Void Sovereign:
    GAME OVER UNIQUE — "Hư Vô Thâm Uyên thu hồi bạn."
    Player biến mất giống người sở hữu trước. Story ends.
    (Player có thể start new game, nhưng character này = gone)
  → "Hư vô nhìn lại bạn. Và hư vô — rất kiên nhẫn."

TRIAL THEME: "KHÔNG CÓ TRIAL"
  → Hư Vô Thâm Uyên KHÔNG CÓ trial arc.
  → Nó đến khi player ĐỨNG Ở RANH GIỚI GIỮA SỐNG VÀ CHẾT.
  → Không có 3-scene arc. Không có lựa chọn.
  → Chỉ có 1 khoảnh khắc — và void HỎI:
    "Ngươi có dám đứng ở nơi không gì tồn tại?"
  → Player không CHỌN void. Void CHỌN player.
  → Đây là lý do nó LOCKED Season 3+ — 
    cần đủ story depth để moment này có trọng lượng.
```

**Acquisition đặc biệt:** KHÔNG CÓ ĐIỀU KIỆN CỐ ĐỊNH. Void chọn player dựa trên **toàn bộ hành trình** — Identity Coherence, sacrifice history, relationship depth, suffering endured. Engine evaluate player's "narrative weight" — và chỉ khi đủ nặng, void mới gọi.

---

#### 📊 Bảng so sánh 6 Sovereign

```
                FORTE           WEAKNESS TYPE        FORBIDDEN COST         TRIAL THEME
Order     → Analysis/Predict   Information overload  Lose surprise forever  "Tri thức = gánh nặng"
Entropy   → Absorb/Convert     Self-consumption      Unique locked 1 season "Hấp thụ hay bị hấp thụ?"
Matter    → Reshape reality     Body petrification    Lose natural healing   "Sáng tạo cần hy sinh"
Flux      → Adapt/Transform    Identity loss         Lose sub-skill/HP max  "Ranh giới tồn tại"
Energy    → Transfer/Conduit   Collateral damage     Full collapse, KO      "Dây dẫn luôn bị nóng"
Void      → Erase existence    Void consumption      50% HP + 2 season lock "Void chọn, không hỏi"
```

### 15.7 Acquisition Flow (3-Scene Trial Arc)

```
Trigger: TẤT CẢ acquisition conditions met + World Crisis active

Scene 1 — "Tiếng Gọi" (The Calling)
  → Player cảm nhận "something ancient" đang gọi.
  → Sovereign Skill (dormant) resonance với player.
  → AI generate: tình huống PHẢI chọn — accept trial hoặc từ chối.
  → Từ chối = trial biến mất. Có thể quay lại SAU, nhưng conditions reset.

Scene 2 — "Thử Thách" (The Trial)  
  → AI generate trial dựa trên Sovereign Skill principle:
    - Entropy: "Bạn có dám phá hủy để tái tạo?"
    - Order: "Bạn có đủ kỷ luật để mang gánh nặng tri thức?"
  → Đây là combat + narrative hybrid — khó nhất trong game
  → FAIL = Sovereign Skill reject player. Permanent lock cho season này.

Scene 3 — "Thức Tỉnh" (The Awakening)
  → Thành công → Sovereign Skill BIND với player
  → WORLD ECHO: World Tremor — MỌI THỰC THỂ trong thế giới cảm nhận
  → Naming Event: "[Player Name] — [Sovereign Title]"
  → VD: "Kaito — Chủ Nhân Của Sự Tan Rã"
```

### 15.8 Growth: Sovereign Stages (sau Ultimate)

Khi Unique Skill (Ultimate) tiến hóa thành Sovereign, nó trải qua 3 phase mới:

| Phase | Trigger | Unique Skill thay đổi thế nào |
|-------|---------|-------------------------------|
| **Sovereign Dormant** | Trial bắt đầu (§15.7) | Unique Skill bắt đầu "cộng hưởng" với Principle — player cảm nhận power mới |
| **Sovereign Awakened** | Vượt trial thành công | Unique Skill **TRANSCEND**: tất cả sub-skills (SS0-SS3) + domain được nâng cấp. Passive Authority + Active Ability unlock. Weakness trở thành CATASTROPHIC weakness |
| **Sovereign Ascended** | Season 3+ specific arc | + Forbidden Ability unlock. Unique Skill đạt hình thái cuối cùng |

### 15.9 Sovereign LÀ Unique Skill Đã Tiến Hóa

> [!IMPORTANT]
> Sovereign **KHÔNG PHẢI** hệ thống tách biệt. Nó **LÀ** Unique Skill đã vượt qua giới hạn Ultimate.  
>  
> Khi tiến hóa thành Sovereign:  
> - Tất cả sub-skills (SS0-SS3) **merge + transcend** — mạnh hơn, nhưng weakness cũng nặng hơn  
> - Domain Authority **vượt tầm** — immune cả Unique Skill cùng category (không chỉ Normal)  
> - Weakness **tiến hóa thành Catastrophic Weakness** — cái giá tỷ lệ thuận với sức mạnh  
> - Player nhận thêm: Passive Authority + Active Ability + Forbidden Ability (Ascended)  
> - Skill vẫn dùng **cùng stability pool** — không có resource riêng  
>  
> Nói cách khác: player vẫn chỉ có **1 skill system**. Nhưng skill đó đã **đạt tầm tối thượng**.

### 15.10 Safety Constraints — Sovereign

| Quy tắc | Lý do |
|---------|-------|
| Chỉ 6 Sovereign Skill trong toàn world | Scarcity = value |
| 1 owner per Sovereign, tại 1 thời điểm | Lore consistency |
| Không thể acquire trước Season 2 | Prevent rushing |
| Forbidden Ability = 1/game, NOT 1/season | God-tier MUST cost |
| Catastrophic Weakness luôn active | Power = burden |
| Sovereign Skill CÓ THỂ MẤT nếu identity drift quá cao | Thế giới "thu hồi" nếu không xứng |
| Sovereign = BÍ MẬT TUYỆT ĐỐI trong Season 1 | Reveal dần qua seasons |
| Tất cả 6 slot = DORMANT, không NPC nào sở hữu | Chờ player xứng đáng thức tỉnh |

### 15.11 Principle Resonance — "Proto-Sovereign" Detection

> Không phải mọi Unique Skill đều có thể thành Sovereign.  
> Chỉ những Unique Skill có **Principle Resonance ≥ 0.8** mới có khả năng — và player KHÔNG BAO GIỜ được biết điều này.

**Hoạt động:**

```python
class PrincipleResonance(BaseModel):
    """Calculated after Soul Forge — SECRET, player never sees this."""
    order: float = 0.0      # 0.0-1.0
    entropy: float = 0.0
    matter: float = 0.0
    flux: float = 0.0
    energy: float = 0.0
    void: float = 0.0       # Luôn ≤ 0.3 trong Season 1-2 (locked)
    
    is_proto_sovereign: bool = False    # True nếu max resonance ≥ 0.8
    dominant_principle: str = ""         # Principle có resonance cao nhất
```

**Cách tính Resonance (sau Soul Forge):**

```
1. Behavioral Fingerprint (quiz) → 60% weight
   → Tất cả câu trả lời phải CHÁY cùng 1 hướng (coherence ≥ 90%)
   → VD: Order = mọi lựa chọn đều logic, đo lường, kiểm soát

2. DNA Tags Alignment → 30% weight
   → Tags phải map chính xác với 1 Principle:
     Order:   analytical, structured, disciplined, truth-seeking
     Entropy: adaptive, deconstructive, absorptive, transformative  
     Matter:  creative, protective, constructive, grounded
     Flux:    fluid, resilient, boundary-breaking, metamorphic
     Energy:  passionate, sacrificial, connective, catalytic
     Void:    detached, absolute, transcendent, liminal

3. Soul Forge Narrative Choices → 10% weight
   → Choices trong 5 scenes phải consistent với Principle
```

**Xác suất tự nhiên:**

| Resonance | Ý nghĩa | Xác suất ước tính |
|-----------|---------|-------------------|
| 0.0 - 0.3 | Không liên quan đến Principle | ~60% players |
| 0.3 - 0.5 | Hơi align nhưng không đủ | ~25% players |
| 0.5 - 0.8 | Khá align — nhưng KHÔNG ĐỦ cho Sovereign | ~12% players |
| **0.8 - 1.0** | **Proto-Sovereign — CÓ KHẢ NĂNG tiến hóa** | **~3% players** |

> [!IMPORTANT]
> Proto-Sovereign flag là **HOÀN TOÀN BÍ MẬT**. Player không biết. Không có UI indicator. Không có hint.  
> Player chỉ phát hiện khi Unique Skill đạt Ultimate + đủ conditions → thế giới bắt đầu "cộng hưởng".

### 15.12 Sovereign Registry — "6 Quyền Năng Của Thần"

> **Lore:** 6 Sovereign Skill là **quyền năng của các vị thần** — sức mạnh từ thuở khai thiên lập địa.  
> Trong thần thoại cổ đại, TỪNG có những thực thể sở hữu chúng — các vị thần dệt nên thế giới.  
> Nhưng thần thoại chỉ là thần thoại. Những mảnh vỡ lore sẽ được tiết lộ dần qua các season.  
>  
> **Trong trò chơi:** Tất cả 6 slot **HOÀN TOÀN TRỐNG**. Kể từ khi thế giới game bắt đầu,  
> chưa bao giờ có bất kỳ người chơi hay NPC nào nắm giữ 1 trong 6 quyền năng này.  
> Chúng nằm im — ẩn sâu dưới cấu trúc thực tại — chờ đợi ai đó **xứng đáng thức tỉnh**.

```python
SOVEREIGN_REGISTRY = {
    "order": {
        "name": "Thiên Nhãn Vạn Tượng",
        "status": "dormant",       # dormant | awakening | claimed
        "owner_id": None,          # Không ai sở hữu
        "available_from": "season_2",  # Có thể claim từ Season 2
        "world_hints": [           # Dấu hiệu thế giới tiết lộ dần
            # Season 1: Không có hint nào
            # Season 2: "Đôi khi, ở Tower tầng 99, pattern trên tường THAY ĐỔI..."
            # Season 3: "Ai đó nhìn thấy blueprint của thực tại trong giấc mơ..."
        ],
    },
    "entropy": {
        "name": "Thôn Phệ Vạn Vật",
        "status": "dormant",
        "owner_id": None,
        "available_from": "season_2",
        "world_hints": [],
    },
    "matter": {
        "name": "Kiến Tạo Vĩnh Hằng",
        "status": "dormant",
        "owner_id": None,
        "available_from": "season_2",
        "world_hints": [],
    },
    "flux": {
        "name": "Biến Huyễn Vô Thường",
        "status": "dormant",
        "owner_id": None,
        "available_from": "season_2",
        "world_hints": [],
    },
    "energy": {
        "name": "Thần Hỏa Nguyên Thủy",
        "status": "dormant",
        "owner_id": None,
        "available_from": "season_2",
        "world_hints": [],
    },
    "void": {
        "name": "Hư Vô Thâm Uyên",
        "status": "dormant",
        "owner_id": None,
        "available_from": "season_3",  # Locked lâu hơn
        "world_hints": [],
    },
}
```

### 15.13 Season Roadmap — Sovereign Discovery

Sovereign Skill là **long-term content** được tiết lộ dần qua nhiều season:

```
SEASON 1 — "KHÔNG AI BIẾT"
├── Sovereign Skill: HOÀN TOÀN BÍ MẬT. Không hint. Không lore.
├── Player: Nhận Unique Skill, grow đến Ultimate
├── Proto-Sovereign flag: Được tính SECRET khi Soul Forge
├── Engine: Lưu Principle Resonance, nhưng KHÔNG dùng
└── Player cảm nhận: "Skill của mình đặc biệt... nhưng tại sao?"

SEASON 2 — "DẤU HIỆU ĐẦU TIÊN" + MMO LAUNCH
├── Sovereign Skill: Thế giới bắt đầu có DẤU HIỆU MƠ HỒ
│   → NPC nhắc đến "sức mạnh cổ đại", "6 nền tảng thế giới"
│   → Anomaly events xuất hiện (liên quan đến Principles)
├── Proto-Sovereign players: Unique Skill bắt đầu "cộng hưởng" kỳ lạ
│   → Narrative hints: "Skill của bạn rung lên khi đến nơi này..."
├── 5 slots available (Order, Entropy, Matter, Flux, Energy)
├── MMO: First player đạt đủ điều kiện → CLAIM slot → World Echo
│   → Slot bị claim → LOCKED cho player đó
│   → Các player Proto-Sovereign khác cùng Principle: race condition!
└── Player cảm nhận: "Có thứ gì đó ĐANG THỨC DẬY trong skill của tôi."

SEASON 3+ — "THỨC TỈNH"
├── Sovereign lore: Fully revealed — NPC truyền thuyết về 6 Principle
├── Void slot (#6) unlocks
├── Sovereign holders: Ascended phase (Forbidden Ability)
├── MMO politics: Sovereign holders = faction leaders, world shapers
└── Player cảm nhận: "Tôi KHÔNG CHỈ chiến đấu. Tôi ĐỊNH HÌNH thế giới."
```

### 15.14 MMO Sovereign Competition (Season 2+)

Khi MMO launch, "chỉ 1 người" trở thành **thực sự**:

| Quy tắc | Chi tiết |
|---------|---------|
| **1 slot = 1 player** | Server-wide. First to claim = owner. |
| **Claim = irreversible** (trừ khi mất) | Không thể trade, give, split |
| **Mất nếu identity drift** | Coherence < 40 → Sovereign revoke → slot trở lại DORMANT |
| **KHÔNG THỂ PvP cướp slot** | Story-based only. Không arena camping. |
| **Proto-Sovereign race** | Nhiều player có thể Proto-Sovereign cùng Principle → ai đạt conditions trước = thắng |
| **Void slot** | Season 3+. Điều kiện đặc biệt. Không race — Void chọn. |

### 15.15 Phase Scope — Sovereign Skill

| Component | Impl Phase | Season |
|-----------|-----------|--------|
| Principle Resonance calculation (Soul Forge) | Phase 2 | Season 1 (silent) |
| Sovereign Registry (data, all dormant) | Phase 2 | Season 1 (data only) |
| Proto-Sovereign flag storage | Phase 2 | Season 1 (secret) |
| World hints system | Phase 5 | Season 2 |
| Sovereign trial arc + claim | Phase 5 | Season 2 |
| World Echo integration | Phase 5 | Season 2 |
| MMO Sovereign competition | Future | Season 2 |
| Forbidden Ability system | Future | Season 3+ |
| Void slot unlock | Future | Season 3+ |

---

## 13. Safety Constraints

| Quy tắc | Lý do |
|---------|-------|
| 1 Unique Skill per player | Power fantasy nhưng không broken |
| Sub-skills unlock qua narrative, không item shop | Immersion |
| Domain chỉ immune Normal cùng category | Không auto-win |
| Weakness KHÔNG BAO GIỜ XÓA, chỉ transform | Tension duy trì |
| Ultimate Ability = 1/season, 80% stability | God-tier cần scarcity |
| AI Forge chọn weakness từ 7-type taxonomy | Đa dạng, không "nghi ngờ bản thân" |
| Unique Clause phải kiểm chứng bởi engine | Không để AI tạo broken clause |
| Combat bonus cap 8% (increase from 5%) | Unique nên matter hơn trong combat |
| Player NEVER sees raw sub-skill stats | Mystery preserved |
| Forge prompt cấm "tăng damage X%" mechanics | Unique ≠ Normal mạnh hơn |
| Backward compatible với v1 UniqueSkill | Migration không phá existing players |
| Sovereign Skill chỉ 6, chỉ Season 2+ | Scarcity + progression pacing |
| World Echo woven vào narrative, KHÔNG popup | Immersion preserved |

---

## Appendix A: Decisions Log

| Câu hỏi | Quyết định | Lý do |
|----------|-----------|-------|
| Copy Tensura 1:1? | **KHÔNG** — adapt cho text-based game | AI-generated narrative khác light novel |
| Max sub-skills? | **4-5** (1 core + 1 SS0 + 2-3 unlock) | Quá nhiều = AI khó quản lý |
| Domain immune tất cả? | **Chỉ Normal cùng category** | Balance |
| Weakness taxonomy mandatory? | **CÓ** — AI phải chọn 1/7 | Tránh lặp "nghi ngờ bản thân" |
| Combat bonus tăng? | **8%** (từ 5%) | Unique cần matter hơn |
| Sub-skill names ngôn ngữ? | **Tiếng Việt** | Consistent với worldbuilding |
| Existing players migrate? | **Khi vào Bloom** — re-forge tự động | Smooth transition |
| Axis Blind Spot static? | **CÓ** — gắn theo category | Structural, không random |
| Sovereign Skill = Tensura gì? | **Ultimate Skill** — là Unique Skill đã tiến hóa, KHÔNG phải hệ thống tách biệt | Giống Tensura: Predator (Unique) → Beelzebuth (Ultimate) |
| Sovereign acquire khi nào? | **Season 2+** — không rush | Late-game reward |
| Forbidden Ability frequency? | **1/GAME** — không phải 1/season | True scarcity, true impact |
| World Echo = UI notification? | **KHÔNG** — narrative only | Immersion > convenience |
| Sovereign Skill mất được không? | **CÓ** — nếu identity drift quá cao | Consequence + drama |
