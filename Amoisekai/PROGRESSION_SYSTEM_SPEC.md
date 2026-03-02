# 📈 AMOISEKAI — Progression System Specification v1.0

> **Author:** Amo  
> **Date:** 2026-02-23  
> **Status:** Formalized  
> **Dependencies:** GDD v1.0, POWER_SYSTEM_SPEC, COMBAT_SYSTEM_SPEC v1.1, SOUL_FORGE_SPEC, SCENE_ARCHITECTURE_SPEC, IDENTITY TRANSFORMATION ARCHITECTURE v1  
> **Design Decision:** Không dùng stats truyền thống (STR/INT/AGI/DEF/CRIT/MANA). Progression dựa trên 6 chỉ số cốt lõi emerge từ gameplay.

---

## 1. Triết lý tăng tiến

> Bạn không "luyện tập 100 lần để tăng sức mạnh."  
> Bạn **trưởng thành qua lựa chọn**, và sức mạnh phản ánh con người bạn trở thành.

**Nguyên tắc:**
- **Identity > Level** — Không XP, không level number. Rank dựa trên identity metrics
- **Transformation > Stat increase** — Skills biến đổi bản chất, không tăng damage number
- **Behavior-driven** — Hệ thống tự động tiến hóa dựa trên cách player hành xử
- **Narrative milestone** — Rank up qua câu chuyện, không qua grind
- **No traditional stats** — 6 chỉ số cốt lõi thay thế STR/INT/AGI/DEF/CRIT/MANA

---

## 2. Combat Stat System — 6 chỉ số cốt lõi

### 2.1 Thay vì 8+ stats truyền thống, Amoisekai dùng 6

| Chỉ số | Range | Vai trò | Tương đương truyền thống |
|--------|-------|---------|--------------------------|
| **❤️ HP** | 0-100 | Sức chịu đựng thể xác | HP |
| **🛡️ Stability** | 0-100 | Ổn định thực tại (phòng thủ + mana + sanity) | DEF + MANA + Sanity |
| **⚡ Resonance** | 0.0-1.0 (per principle) | Độ cộng hưởng với nguyên lý | STR/ATK multiplier |
| **💢 Instability** | 0-100 | Bất ổn tích lũy (risk meter) | — (mới) |
| **🧠 DQS** | 0-100 | Decision Quality Score | INT (accumulated wisdom) |
| **🔥 Breakthrough** | 0-100 | Đột phá meter | — (mới, CRNG-driven) |

### 2.2 Stability = 3 vai trò trong 1

```
Stability = Phòng thủ (vỡ → dễ bị 1-shot, stability break)
          + Resource (xài skill tốn stability, overdrive drain stability)
          + Sanity (vỡ → mutation risk, forced identity event)
```

> **Design insight:** 1 resource làm 3 việc → tạo tension tự nhiên. Player phải chọn: dùng stability tấn công (mất phòng thủ) hay giữ stability sống (mất damage).

### 2.3 Combat Outcome Formula

```python
def compute_combat_score(player, enemy, skill, floor, intensity) -> float:
    """
    Deterministic. Quyết định outcome mỗi combat phase.
    Score > 0.6 → favorable | 0.4-0.6 → mixed | < 0.4 → unfavorable
    """
    score = 0.0
    
    # === BUILD FIT (45%) — build có counter enemy không? ===
    # Resonance match: resonance cao = đánh mạnh hơn với principle đó
    resonance = player.resonance.get(skill.primary_principle, 0.25)
    score += resonance * 0.25
    
    # Principle advantage: entropy > order, flux > matter, etc.
    interaction = get_principle_interaction(skill.primary_principle, enemy.dominant_principle)
    score += interaction.advantage_mod * 0.20
    
    # === PLAYER SKILL (30%) — player chơi có giỏi không? ===
    # DQS: lịch sử quyết định
    score += (player.dqs / 100) * 0.20
    
    # Stability management: vào trận với stability cao = lợi thế
    score += (player.stability / 100) * 0.10
    
    # === ENVIRONMENT (15%) ===
    # Floor modifier
    floor_bonus = floor.principle_modifiers.get(skill.primary_principle, 0.0)
    score += floor_bonus * 0.10
    
    # Intensity: overdrive = +bonus nhưng stability cost cao
    intensity_bonus = {"safe": 0.0, "push": 0.02, "overdrive": 0.05}[intensity]
    score += intensity_bonus
    
    # === CONTROLLED RANDOMNESS (10%) ===
    # CRNG (pity/breakthrough)
    score += crng_combat_roll(player) * 0.05
    
    # Unique skill activation bonus
    score += unique_skill_combat_bonus(player) * 0.05
    
    return clamp(score, 0.0, 1.0)
```

### 2.4 "Mạnh hơn" nghĩa là gì?

| Progression | Player cảm nhận trong prose |
|---|---|
| Resonance tăng | "Entropy phóng ra mạnh hơn lần trước — resonance đã sâu hơn" |
| Tier skill tăng | "Giờ bạn có dual-principle skill thay vì single" |
| Stability cao | "Chịu được 2 lần overdrive mà không vỡ" |
| DQS cao | "Combat score luôn favorable vì player consistent" |
| Affinity awakening | "Nguyên lý mới mở ra — Flux kích hoạt" |
| Unique skill evolve | "Ý Chí Vượt Trội biến thành dạng mới, phản ánh hành trình" |

---

## 3. Trục 1: Identity Progression (Rank System)

### 3.1 Rank thay thế Level

Không XP. Không level number. **Rank** dựa trên identity metrics + narrative milestones:

| Rank | Tên (EN) | Tên (VN) | Yêu cầu | Floor | Unlock |
|------|----------|----------|----------|-------|--------|
| 1 | Awakened | Thức Tỉnh | Quiz hoàn thành, skill generated | F1 | Tier 1 skills, unique skill base form |
| 2 | Resonant | Cộng Hưởng | DQS ≥ 40, Coherence ≥ 50, 10+ scenes | F1-2 | Tier 2 (dual principle), 4th skill slot |
| 3 | Stabilized | Ổn Định | DQS ≥ 60, Pass Stability Trial, clear F2 boss | F2-3 | Personal cap training, skill integration |
| 4 | Transcendent | Siêu Việt | DQS ≥ 70, Breakthrough event, Affinity Awakening | F3-4 | Rare principle access, Mythic tier |
| 5 | Sovereign | Chủ Tể | DQS ≥ 85, Season climax cleared | F4-5 | Ultimate unique skill form, Aspect Forge |

### 3.2 Rank Up Flow

```
Player meets conditions (hidden — system tracks)
     ↓
Engine flags rank_up_ready = true
     ↓
Planner nhận flag → tạo beat "rank_up_event" trong chapter tiếp theo
     ↓
Writer viết Rank Up Scene:
├── Narrative confrontation/trial/revelation
├── Player nhận thông báo qua prose (không phải popup)
└── Rank up → unlock mới available
     ↓
Choice tiếp theo có thể trigger unlock ngay
```

**Key:** Rank up là **narrative event**, không phải notification. Player **trải nghiệm** rank up qua prose.

### 3.3 Rank Benefits

```
Rank 1 → Rank 2 (Resonant):
├── Tier 2 skills unlock (dual principle)
├── 4th equipped skill slot (từ 3 → 4)
├── Combat choice: "Shift" unlocks more options
└── Narrative: "Bạn bắt đầu cảm nhận cộng hưởng sâu hơn..."

Rank 2 → Rank 3 (Stabilized):
├── Personal cap training available
├── Skill Integration unlock (merge 2 skills)
├── Overdrive risk giảm -5% baseline
└── Narrative: stability trial + identity test

Rank 3 → Rank 4 (Transcendent):
├── Rare principle may appear in encounters
├── Unique skill: Echo Deepening or Scar Adaptation triggers
├── Affinity awakening event (narrative arc)
└── Narrative: "Thực tại phản ứng với sự hiện diện của bạn..."

Rank 4 → Rank 5 (Sovereign):
├── Aspect Forge (unique skill branches)
├── All Tier 3 skills accessible
├── Season climax: ultimate test
└── Narrative: "Bạn không còn bị chi phối bởi giới hạn tầng..."
```

---

## 4. Trục 2: Skill Progression

### 4.1 Triết lý

Skills KHÔNG tăng damage number. Skills **biến đổi bản chất** — mở rộng usage, thay đổi identity, hoặc merge thành skill cao hơn.

### 4.2 Bốn đường tiến hóa skill

#### 4.2.1 Refinement (Tinh chế)

Dùng skill **đúng identity, consistent** → constraint tự nhiên nới lỏng.

```python
class SkillRefinement(BaseModel):
    skill_id: str
    usage_count: int = 0             # Số lần dùng thành công
    identity_alignment: float = 0.0  # Trùng với identity cao → refine nhanh
    refined: bool = False
    
    def check_refinement(self) -> bool:
        """Đủ điều kiện refine khi dùng nhiều + identity aligned."""
        return (
            self.usage_count >= 8 and
            self.identity_alignment >= 0.6
        )
```

| Trước Refine | Sau Refine | Constraint thay đổi |
|---|---|---|
| Entropy Shred: "proximity only" | Entropy Shred: "mid-range" | Range mở rộng |
| Energy Burst: "cooldown 3 turns" | Energy Burst: "cooldown 2 turns" | Cooldown giảm |
| Void Cloak: "30% stability cost" | Void Cloak: "20% stability cost" | Cost giảm |

> **Giới hạn:** Mỗi skill chỉ refine **1 lần**. Refinement nhỏ, không phá balance.

#### 4.2.2 Mutation (Đột biến)

Identity drift mạnh → Skill đổi bản chất. Xem: IDENTITY TRANSFORMATION ARCHITECTURE v1.

```
Trigger: identity_coherence < 30 AND instability > 70
   AND latent_identity diverges from seed_identity
     ↓
Engine flags mutation_ready
     ↓
Planner tạo "Skill Mutation Arc" (2-3 scenes):
├── Scene 1: Skill misfire / behave bất thường
├── Scene 2: Identity confrontation — "Bạn đang thay đổi"
└── Scene 3: DECISION POINT:
    ├── Chấp nhận mutation → Skill đổi bản chất mới
    ├── Chống lại mutation → Stabilize path (instability giảm, skill giữ nguyên)
    └── Con đường thứ 3 → Hybrid (hiếm, phụ thuộc vào context)
```

**Ví dụ:**

| Seed Skill | Hành vi player | Mutation Result |
|---|---|---|
| Oath Resonance (trung thành) | 30 chương phản bội vì lý tưởng | **Covenant Breaker** (mạnh khi phá trật tự) |
| Iron Resolve (kiên định) | Liên tục thỏa hiệp | **Flowing Will** (mạnh khi thích ứng) |
| Sacred Light (bảo vệ) | Hy sinh người khác vì mục tiêu | **Profane Radiance** (bảo vệ bản thân, bỏ rơi đồng đội) |

> **Giới hạn:** Tối đa **3 mutation** trong suốt đời nhân vật. Mutation luôn là **lựa chọn có ý thức** (GDD: "Mutation có agency").

#### 4.2.3 Integration (Tích hợp)

Rank 3+: 2 skills cùng principle domain → merge thành 1 skill tier cao hơn.

```
Điều kiện:
├── Rank ≥ 3 (Stabilized)
├── 2 skills share at least 1 principle
├── Cả 2 skills đã dùng 5+ lần mỗi cái
└── Player chọn Integration tại chapter rest scene

Kết quả:
├── 2 Tier 1 skills → 1 Tier 2 skill (dual principle)
├── Tier 1 + Tier 2 → 1 Tier 2 enhanced (constraint giảm)
└── 2 Tier 2 → 1 Tier 3 (rare augmented) — Rank 4+ only
```

**Ví dụ:**
- `Matter Shield` (Tier 1) + `Energy Pulse` (Tier 1) → `Kinetic Barrier` (Tier 2, Matter-Energy)
- `Entropy Shred` (Tier 1) + `Flux Disruption` (Tier 1) → `Reality Tear` (Tier 2, Entropy-Flux)

> **Giới hạn:** Max **2 integrations** per character career. Mất 2 skills, được 1 — player phải cân nhắc.

#### 4.2.4 Awakening (Thức tỉnh)

Khi Affinity Awakening xảy ra → skills liên quan nhận nguyên lý mới.

```
Affinity Awakening event (narrative arc, Rank 3-4)
     ↓
Player's skills kiểm tra compatibility
     ↓
Compatible skill: nhận awakened principle as secondary
     ↓
Skill behavior thay đổi dựa trên nguyên lý mới
```

**Ví dụ:**
- Energy Burst + Entropy awakening → `Energy Burst` giờ gây thêm **stability damage** (entropy component)
- Order Shield + Flux awakening → `Order Shield` giờ có thể **redirect** attacks thay vì chỉ block

> **Không phải tất cả skills đều compatible.** Engine kiểm tra principle interaction matrix.

---

## 5. Trục 3: Resonance Mastery

### 5.1 Resonance Growth (tự nhiên)

Resonance tăng **tự động** khi player dùng principle:

```python
def update_resonance_after_combat(player, skill_used, outcome):
    principle = skill_used.primary_principle
    
    if outcome == "favorable":
        delta = 0.03   # Thắng → resonance tăng mạnh hơn
    elif outcome == "mixed":
        delta = 0.02
    else:
        delta = 0.01   # Thua vẫn tăng nhẹ (learning)
    
    # Cap by floor
    max_resonance = get_floor_resonance_cap(player.current_floor)
    player.resonance[principle] = min(
        max_resonance,
        player.resonance[principle] + delta
    )
    
    # Decay for unused principles (very slow)
    for other in ALL_PRINCIPLES:
        if other != principle:
            player.resonance[other] = max(
                0.1,  # minimum floor
                player.resonance[other] - 0.005
            )
```

### 5.2 Personal Cap Training

Chi tiết hóa từ MULTI-LAYER SOFT CAP v2:

| Training | Trigger | Kết quả | Narrative |
|----------|---------|---------|-----------|
| **Stability Trial** | Dùng 2 principles xung đột 5+ lần mà không backlash | Personal cap +0.1 | "Bạn đã kiểm soát được xung đột giữa Entropy và Order..." |
| **Overdrive Control** | Dùng Overdrive 3 lần thành công (không misfire) | Overdrive backlash risk -5% | "Giới hạn không còn đáng sợ. Bạn đã biết cách bước qua." |
| **Floor Attunement** | Clear floor boss lần đầu | Floor-specific resonance +0.1 | "Thực tại tầng này đã in dấu lên bạn." |
| **Dual Mastery** | Duy trì dual-principle stable qua 1 boss fight | Resonance minimum threshold +0.05 cho cả 2 | "Hai nguyên lý hòa nhập — không còn xung đột." |

> **Lưu ý Overdrive Control:** Overdrive backlash mechanism chưa định nghĩa chi tiết trong combat flow hiện tại. Overdrive hiện chỉ là intensity level (+0.05 combat score). Backlash probability system (VD: stability < 30% + overdrive → X% chance backlash, giảm bởi `overdrive_risk_reduction`) sẽ được thiết kế và implement trong **Phase 2** cùng với Personal Cap Training.

### 5.3 Resonance Visibility (từ POWER_SYSTEM_SPEC)

Player **không thấy số resonance chính xác**:

| Tier | Thấy gì | Khi nào |
|------|---------|--------|
| Public Signal | Narrative descriptions: "Entropy cộng hưởng mạnh" | Luôn luôn |
| Measurable | Relative bars: ████░░ | Rank 2+ |
| Raw Data | Exact numbers: 0.78 | KHÔNG BAO GIỜ (backend only) |

---

## 6. Trục 4: Unique Skill Growth

### 6.1 Soul Forge skill có 4 dạng tiến hóa

Unique Skill từ Soul Forge không static — nó **grow** theo hành vi player:

```
         ┌─── Hành vi aligned ───→ Echo Deepening
         │
Unique ──┼─── Survive trauma ────→ Scar Adaptation
Skill    │
         ├─── Rank 4+ ──────────→ Aspect Forge (branch)
         │
         └─── Rank 5 + Season ──→ Ultimate Form (xem UNIQUE_SKILL_GROWTH_SPEC §7)
```

> **Ultimate Form** (Thiên Mệnh): Unique Skill ở dạng Aspect **absorb** 1 normal skill đã master → Synthesis thành Ultimate Skill. Chi tiết đầy đủ: UNIQUE_SKILL_GROWTH_SPEC §7.

### 6.2 Echo Deepening

**Trigger:** `identity_coherence ≥ 70` sustained qua 10+ scenes.

Skill mạnh hơn khi identity aligned. Player đang "đi đúng con đường."

```python
class EchoDeepening(BaseModel):
    """Unique skill grows stronger when aligned with identity."""
    skill_id: str
    coherence_streak: int = 0        # Scenes với coherence ≥ 70
    deepening_level: int = 0         # 0 = base, 1 = deepened, 2 = deep
    
    # Level 1: constraint nới lỏng (giống refinement nhưng mạnh hơn)
    # Level 2: bonus effect khi identity aligned (VD: +stability recovery)
```

**Ví dụ:**
- "Ý Chí Vượt Trội" (base: boost stability khi bị ép) → **Echo Level 1:** range mở rộng, cost giảm → **Echo Level 2:** khi coherence > 80, auto-stabilize 5% per scene

**Narrative:** Writer mô tả skill đang "sâu hơn" — "Ý chí phản ứng nhanh hơn, như thể nó đã trở thành bản năng."

### 6.3 Scar Adaptation

**Trigger:** Player survive backlash **3 lần** hoặc near-death (HP < 10%) **3 lần**.

Skill thêm khả năng **phòng thủ/sinh tồn** — phản ánh "cái đau đã dạy bạn."

```python
class ScarAdaptation(BaseModel):
    """Unique skill adapts after trauma/survival."""
    skill_id: str
    trauma_count: int = 0            # Lần survive backlash/near-death
    adapted: bool = False
    adaptation_type: str = ""        # "defensive" | "counter" | "warning"
```

**3 loại Scar Adaptation:**

| Type | Trigger pattern | Kết quả | Ví dụ |
|---|---|---|---|
| **Defensive** | Nhiều lần gần chết | Skill tự kích hoạt shield khi HP < 20% | "Ý Chí" → auto shield |
| **Counter** | Nhiều lần bị backlash | Skill giảm backlash severity | "Ý Chí" → backlash damage -50% |
| **Warning** | Cả hai | Skill "cảnh báo" danger qua narrative | "Ý Chí rung nhẹ — có gì đó sai..." |

> **Không chọn được.** Engine tự xác định type dựa trên pattern.

### 6.4 Aspect Forge

**Trigger:** Rank 4+ (Transcendent) + Affinity Awakening đã xảy ra.

Unique Skill phân nhánh thành **2 aspect** — player chọn 1:

```
Unique Skill: "Ý Chí Vượt Trội"
     ↓ Rank 4 + Awakened Entropy
     ↓ 
   ┌──────────────────────────┐
   │     ASPECT FORGE         │
   │                          │
   │  Choose your path:       │
   │                          │
   │  ⚔️ "Bất Khuất"          │
   │     (Unyielding)         │
   │     Tank aspect:         │
   │     Stability regen ++   │
   │     Damage resist ++     │
   │     Offensive power --   │
   │                          │
   │  🔥 "Cuồng Nộ"           │
   │     (Fury)               │
   │     Burst aspect:        │
   │     Overdrive power ++   │
   │     Stability cost --    │
   │     Backlash risk +      │
   └──────────────────────────┘
```

**Điều kiện:**
- Rank ≥ 4
- Affinity Awakening đã hoàn thành
- Player đã dùng unique skill 20+ lần
- Aspect Forge là **narrative arc** — 2-3 scenes, culminating in choice

> **Chọn rồi không đổi.** Aspect Forge là permanent branching. Tạo replay value mạnh.

---

## 7. Progression Timeline (per Floor)

### 7.1 Floor 1: The Beginning

```
Chapter 1-3: Skill Discovery Arc
├── Unique skill activation (SCENE_ARCHITECTURE §2.8)
├── Tier 1 skills: player equips 3 basic skills
├── Resonance bắt đầu grow
└── DQS bắt đầu tích lũy

Chapter 4-8: Learning Combat
├── Duel encounters (Minor + some Duel)
├── Stability management learning
├── Resonance reaches ~0.4 cho primary principle
└── ~Chapter 8: Rank 2 (Resonant) — tier 2 skill unlock

Chapter 9-12: First Boss
├── Boss encounter: Floor 1 Guardian (2 phases, 1 decision point)
├── Overdrive mechanic introduced
├── Resonance reaches ~0.5
└── Floor 1 cleared → Floor Attunement bonus
```

### 7.2 Floor 2: Deepening

```
Chapter 13-18:
├── Dual principle skills available (Tier 2)
├── Skill usage enough for potential Refinement
├── DQS should be ~50-60
├── Instability starts to matter
└── ~Chapter 15-16: Rank 3 (Stabilized) — integration unlock

Chapter 19-24:
├── Boss encounter: Floor 2 Guardian (3 phases, 2 decision points)
├── First Skill Integration opportunity (if player wants)
├── Personal Cap training unlock
├── Unique Skill: Echo Deepening or Scar Adaptation may trigger
└── Floor 2 cleared
```

### 7.3 Floor 3+: Transformation

```
Chapter 25-36:
├── Identity drift may trigger Skill Mutation arc
├── Affinity Awakening narrative arc (major event)
├── Rank 4 (Transcendent) — rare principle, mythic tier
├── Skill Awakening (affected by affinity)
└── Boss fights with rare principle involved

Chapter 37-48:
├── Rank 5 (Sovereign) — season climax
├── Aspect Forge for unique skill (Ch 30-40)
├── Ultimate Form — Unique Skill absorb mastered normal skill (Ch 40-48)
│   └── Naming Event: AI tạo tên Ultimate ("[Tên] — [Danh xưng]")
├── Full build diversity realized
└── Season 1 climax encounter + Ultimate Ability unlock (1/season)
```

---

## 8. Data Models

```python
# app/models/progression.py [NEW]

from enum import Enum
from pydantic import BaseModel, Field

class ProgressionRank(int, Enum):
    AWAKENED = 1       # Thức Tỉnh — quiz complete
    RESONANT = 2       # Cộng Hưởng — DQS ≥ 40, coherence ≥ 50
    STABILIZED = 3     # Ổn Định — DQS ≥ 60, stability trial
    TRANSCENDENT = 4   # Siêu Việt — breakthrough + awakening
    SOVEREIGN = 5      # Chủ Tể — DQS ≥ 85, season climax

class SkillEvolutionPath(str, Enum):
    REFINEMENT = "refinement"       # Constraint nới lỏng
    MUTATION = "mutation"           # Bản chất đổi
    INTEGRATION = "integration"     # 2 skills merge
    AWAKENING = "awakening"         # Nhận nguyên lý mới

class UniqueSkillGrowthType(str, Enum):
    ECHO_DEEPENING = "echo_deepening"     # Coherence-driven
    SCAR_ADAPTATION = "scar_adaptation"   # Trauma-driven
    ASPECT_FORGE = "aspect_forge"         # Branch choice
    ULTIMATE_FORM = "ultimate_form"       # Rank 5 + Aspect + Season Climax (UNIQUE_SKILL_GROWTH_SPEC §7)


# === Player Progression State ===

class PlayerProgression(BaseModel):
    """Tracks all progression for a player."""
    player_id: str
    
    # Rank
    current_rank: ProgressionRank = ProgressionRank.AWAKENED
    rank_up_ready: bool = False
    
    # Skill evolution tracking
    skill_usage: dict[str, int] = Field(default_factory=dict)  # skill_id: usage_count
    refinements_done: list[str] = Field(default_factory=list)   # skill_ids refined
    mutations_done: int = 0          # Max 3
    integrations_done: int = 0       # Max 2
    
    # Unique skill growth
    unique_skill_growth_type: UniqueSkillGrowthType | None = None
    echo_coherence_streak: int = 0   # Scenes with coherence ≥ 70
    echo_level: int = 0              # 0, 1, 2
    scar_trauma_count: int = 0       # Times survived backlash/near-death
    scar_adapted: bool = False
    aspect_forged: bool = False
    aspect_chosen: str = ""          # Which aspect was chosen
    
    # Resonance mastery
    personal_cap_bonus: float = 0.0  # From training
    overdrive_risk_reduction: float = 0.0
    floor_attunements: list[int] = Field(default_factory=list)  # Floors attuned
    stability_trials_passed: int = 0
    dual_masteries: list[str] = Field(default_factory=list)  # "matter-energy", etc.
    
    # Training readiness
    stability_trial_ready: bool = False
    overdrive_control_ready: bool = False


class RankUpCondition(BaseModel):
    """Conditions required for rank up."""
    target_rank: ProgressionRank
    dqs_min: float = 0.0
    coherence_min: float = 0.0
    scenes_min: int = 0
    floor_cleared: int = 0
    stability_trial: bool = False
    breakthrough_event: bool = False
    affinity_awakening: bool = False
    season_climax: bool = False


# Predefined rank conditions
RANK_CONDITIONS = {
    ProgressionRank.RESONANT: RankUpCondition(
        target_rank=ProgressionRank.RESONANT,
        dqs_min=40.0,
        coherence_min=50.0,
        scenes_min=10,
    ),
    ProgressionRank.STABILIZED: RankUpCondition(
        target_rank=ProgressionRank.STABILIZED,
        dqs_min=60.0,
        stability_trial=True,
        floor_cleared=2,
    ),
    ProgressionRank.TRANSCENDENT: RankUpCondition(
        target_rank=ProgressionRank.TRANSCENDENT,
        dqs_min=70.0,
        breakthrough_event=True,
        affinity_awakening=True,
    ),
    ProgressionRank.SOVEREIGN: RankUpCondition(
        target_rank=ProgressionRank.SOVEREIGN,
        dqs_min=85.0,
        season_climax=True,
    ),
}


class SkillEvolutionEvent(BaseModel):
    """Log entry for skill evolution."""
    event_type: SkillEvolutionPath
    skill_id: str
    chapter: int
    scene: int
    description: str = ""
    
    # For Integration
    merged_from: list[str] = Field(default_factory=list)  # skill_ids merged
    result_skill_id: str = ""
    
    # For Mutation
    original_name: str = ""
    mutated_name: str = ""
    player_choice: str = ""  # "accept" | "resist" | "hybrid"
    
    # For Awakening
    awakened_principle: str = ""
```

---

## 9. Engine Integration

### 9.1 Progression Check Pipeline

```python
def check_progression_updates(player, scene_result):
    """Called after every scene. Light check, no LLM needed."""
    progression = player.progression
    
    # 1. Track skill usage (per combat PHASE, not per scene)
    #    1 combat = 2-5 phases, each phase uses 1 skill
    #    This gives more accurate usage count for refinement triggers
    if hasattr(scene_result, 'combat_phases'):
        for phase in scene_result.combat_phases:
            if phase.skill_used:
                progression.skill_usage[phase.skill_used] = (
                    progression.skill_usage.get(phase.skill_used, 0) + 1
                )
    elif scene_result.skill_used:
        # Non-combat scene: 1 skill per scene
        progression.skill_usage[scene_result.skill_used] = (
            progression.skill_usage.get(scene_result.skill_used, 0) + 1
        )
    
    # 2. Check rank up conditions
    if not progression.rank_up_ready:
        next_rank = ProgressionRank(progression.current_rank + 1)
        if next_rank in RANK_CONDITIONS:
            condition = RANK_CONDITIONS[next_rank]
            if _meets_condition(player, condition):
                progression.rank_up_ready = True
    
    # 3. Track unique skill growth
    if player.identity.coherence >= 70:
        progression.echo_coherence_streak += 1
    else:
        progression.echo_coherence_streak = 0
    
    if scene_result.backlash_survived or scene_result.near_death:
        progression.scar_trauma_count += 1
    
    # 4. Check skill refinement
    for skill_id, count in progression.skill_usage.items():
        if count >= 8 and skill_id not in progression.refinements_done:
            alignment = _get_skill_identity_alignment(player, skill_id)
            if alignment >= 0.6:
                # Flag for refinement event in next chapter
                progression.refinement_ready = skill_id
    
    return progression
```

### 9.2 Planner Integration

```python
# Planner checks progression flags and creates appropriate beats:

PROGRESSION_BEATS = {
    "rank_up_ready": {
        "beat_type": "discovery",
        "description": "Rank up narrative event",
        "priority": "high",
    },
    "refinement_ready": {
        "beat_type": "rest",
        "description": "Skill refinement moment during rest",
        "priority": "medium",
    },
    "mutation_conditions_met": {
        "beat_type": "discovery",
        "description": "Skill mutation arc begins (2-3 scenes)",
        "priority": "critical",
    },
    "echo_deepening_ready": {
        "beat_type": "combat",
        "description": "Unique skill shows new depth in combat",
        "priority": "medium",
    },
    "scar_adaptation_ready": {
        "beat_type": "discovery",
        "description": "Unique skill reacts to accumulated trauma",
        "priority": "medium",
    },
    "aspect_forge_ready": {
        "beat_type": "discovery",
        "description": "Unique skill branching choice (major arc)",
        "priority": "critical",
    },
}
```

---

## 10. Phase 1 Scope

### Must-Have

| Component | Chi tiết | Spec nguồn |
|-----------|----------|------------|
| 6 combat stats | HP, Stability, Resonance, Instability, DQS, Breakthrough | §2 |
| Combat Score formula | Deterministic outcome | §2.3 |
| Rank system (Rank 1-3) | Awakened → Resonant → Stabilized | §3 |
| Skill Refinement | 1 refinement per skill, constraint nới lỏng | §4.2.1 |
| Resonance growth | Auto-grow per combat | §5.1 |
| Unique Skill: Echo Deepening (Level 1) | Coherence-driven growth | §6.2 |
| Unique Skill: Scar Adaptation (basic) | Trauma-driven growth | §6.3 |
| Progression check per scene | Lightweight engine check | §9.1 |
| Rank up flow | Narrative event, not popup | §3.2 |

### Phase 2

| Component | Phase |
|-----------|-------|
| Rank 4-5 (Transcendent, Sovereign) | Phase 2 |
| Skill Mutation full arc | Phase 2 (need rich identity system) |
| Skill Integration | Phase 2 (need enough skills first) |
| Skill Awakening | Phase 2 (need affinity awakening) |
| Aspect Forge | Phase 2 (need Rank 4) |
| Echo Deepening Level 2 | Phase 2 |
| Personal Cap Training | Phase 2 |

---

## 11. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| Không stats truyền thống (STR/INT/AGI/DEF/CRIT/MANA) | Complexity control cho solo dev |
| Rank up qua narrative, không qua popup | Immersion |
| Max 3 mutations per character | Giữ giá trị của mutation |
| Max 2 integrations per character | Tránh merge spam |
| Refinement nhỏ, không phá balance | Chỉ nới constraint, không tăng damage |
| Player KHÔNG thấy combat_score số | Tránh min-max, giữ mystery |
| Resonance numbers hidden | Partial visibility (bars không phải %) |
| Aspect Forge permanent | Tạo replay value, meaningful choice |
| Progression check lightweight (no LLM) | Cost control |

---

## Appendix: Decisions Log

| Câu hỏi | Quyết định | Lý do |
|----------|-----------|-------|
| Stats truyền thống? | **KHÔNG** — dùng 6 chỉ số cốt lõi | Identity-driven, solo dev scope |
| Level system? | **Rank thay thế** — 5 ranks, narrative milestone | Không grind, meaningful progression |
| Skill tăng damage? | **KHÔNG** — skills biến đổi bản chất | Transformation > stat increase |
| Player chọn growth path? | **KHÔNG** cho Echo/Scar, **CÓ** cho Aspect Forge | Behavior-driven + meaningful choice tại climax |
| Nhiều unique skill growth cùng lúc? | **KHÔNG** — chỉ 1 type active | Complexity control |
| Resonance visible? | **Partial** — bars tại Rank 2+ | Balance mystery vs. feedback |
| Rank up flow? | **Narrative event** — prose, không popup | Immersion first |
