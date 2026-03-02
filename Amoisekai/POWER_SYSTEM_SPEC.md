# ⚡ AMOISEKAI — Power System Specification v1.1

> **Author:** Amo  
> **Date:** 2026-02-23 (v1.1 — harmonized with implementation + World Bible)  
> **Status:** Formalized — aligned with `power.py`, `combat.py`, COMBAT_SYSTEM_SPEC v1.1, WORLD_BIBLE §2.4  
> **Dependencies:** GDD v1.0, SOUL_FORGE_SPEC, TECH_SPEC_PHASE1, WORLD_BIBLE v1.0  
> **Breaking changes from v1.0:** Light removed from core → 6 core principles. Interaction matrix simplified. Data models match implementation.

---

## 1. Triết lý thiết kế

> Sức mạnh không đến từ level.  
> Sức mạnh đến từ **cấu trúc** — nguyên lý nào, kết hợp ra sao, ổn định đến đâu.

**Nguyên tắc cốt lõi:**
- **Identity > Level** — nhân vật được định nghĩa bởi lựa chọn
- **Resolution Model** — engine tính toàn bộ outcome trước (per-phase), Writer viết prose từ CombatBrief. Xem COMBAT_SYSTEM_SPEC.md §3
- **Risk/Reward** — sức mạnh lớn = rủi ro lớn (instability, backlash)
- **Emergent meta** — không balance bằng nerf số, mà bằng stability cost

---

## 2. Ontological Principle Matrix

### 2.1 Dual-Layer Architecture

Amoisekai sử dụng **2 lớp nguyên lý** phục vụ 2 mục đích khác nhau:

| Layer | Principles | Dùng ở đâu |
|-------|-----------|------------|
| **Narrative Layer** (World Bible §2.4) | 5: Order, Freedom, Evolution, Control, Devotion | Identity vector, narrative, NPC worldview, religion |
| **Mechanical Layer** (Power System) | 6 core + 3 rare | Combat, skills, resonance, power output |

> **Tại sao 2 lớp?** Mechanical principles (nguyên lý cơ học) mô tả **cách sức mạnh hoạt động** — vật chất, năng lượng, dòng chảy. Narrative principles (nguyên lý triết học) mô tả **ý nghĩa** — trật tự, tự do, tận hiến. Cả hai cùng tồn tại, cùng ảnh hưởng nhau, nhưng phục vụ hệ thống khác nhau.

### 2.2 Mapping: Narrative → Mechanical

Khi engine cần chuyển đổi giữa 2 lớp (VD: identity vector → resonance affinity):

| Narrative Principle | → Primary Mechanical | → Secondary Mechanical | Lý do |
|--------------------|-----------------------|------------------------|-------|
| **Order** (Trật tự) | **Order** | — | 1:1 mapping — trật tự = cấu trúc quy luật |
| **Freedom** (Tự do) | **Entropy** | Flux | Phá vỡ quy luật = phân rã + biến đổi |
| **Evolution** (Tiến hóa) | **Flux** | Energy | Thích nghi = dòng chảy + năng lượng chuyển hóa |
| **Control** (Kiểm soát) | **Matter** | Void | Áp đặt = vật chất hóa + denial |
| **Devotion** (Tận hiến) | **Energy** | Matter | Hy sinh = năng lượng tiêu hao + bảo vệ cấu trúc |

> [!NOTE]
> Mapping KHÔNG phải 1:1 hoàn hảo — đây là cố ý. Player có narrative principle "Freedom" có thể có resonance cao nhất ở Entropy HOẶC Flux tùy playstyle. Engine dùng mapping làm weighted default khi khởi tạo, sau đó drift tự nhiên.

### 2.3 Core Principles — 6 nguyên lý cơ học nền

Mọi kỹ năng, hiện tượng chiến đấu, và power output đều dựa trên tổ hợp 6 nguyên lý:

```
┌─────────────────────────────────────────────┐
│           SIX CORE PRINCIPLES               │
│                                             │
│   ORDER  ←————opposing————→  ENTROPY        │
│   MATTER ←————opposing————→  FLUX           │
│   ENERGY ←————opposing————→  VOID           │
│                                             │
│   Adjacent (compatible):                    │
│   ORDER  — MATTER, ENERGY                   │
│   ENTROPY — FLUX, VOID                      │
│   MATTER — ORDER, ENERGY                    │
│   FLUX   — ENTROPY, VOID                    │
│   ENERGY — ORDER, MATTER                    │
│   VOID   — ENTROPY, FLUX                    │
└─────────────────────────────────────────────┘
```

| Nguyên lý | Bản chất | Tương tác chiến đấu |
|-----------|----------|---------------------|
| **Order** (Trật tự) | Cấu trúc, quy luật, dự đoán được | Defensive structure, binding, control |
| **Entropy** (Hỗn Loạn) | Phân rã, hỗn loạn, dissolution | Stability shred, disruption |
| **Matter** (Vật Chất) | Cấu trúc vật chất, hình dạng, cứng rắn | Tanky, structural damage, shielding |
| **Flux** (Linh Hoạt) | Dòng chảy, biến đổi, thích nghi | Mobility, vector shift, phase |
| **Energy** (Năng Lượng) | Năng lượng, chuyển hóa, vận động | Physical/thermal damage, burst |
| **Void** (Hư Không) | Hư vô, ẩn giấu, denial | Stealth, absorption, denial |

### 2.4 Rare Principles — 3 nguyên lý hiếm (Phase 2+)

Chỉ xuất hiện từ late-game (Floor 3+). Resonance gần 0 cho đến khi player thức tỉnh qua narrative event đặc biệt.

| Nguyên lý | Bản chất | Cơ chế | Nguy hiểm |
|-----------|----------|--------|-----------|
| **Causality** (Nhân Quả) | Xâu chuỗi sự kiện, nguyên nhân-hệ quả | Cho phép "delay" effect — skill activate ở phase sau. Chain combo potential. | Instability cực cao. Dùng sai → backlash cascade. |
| **Continuum** (Liên Tục) | Thời gian, trì hoãn, persistence | Effect kéo dài qua nhiều phase. "Slow burn" damage/heal. | Drift acceleration — dùng nhiều → identity shift nhanh. |
| **Resonance Meta** (Cộng Hưởng) | Self-amplification, feedback loop | Tăng resonance tạm thời cho bất kỳ principle nào đang dùng. Multiplicative. | Backlash chain. Nếu vỡ → resonance crash (tất cả giảm). |

**Rare Principle Rules:**
- Không xuất hiện trong player resonance state cho đến khi narrative event unlock
- Chỉ dùng được ở Tier 3 skills (2 core + 1 rare)
- Tối đa 1 rare principle per skill
- Không thể có 2 rare principles active cùng lúc (1 rare skill equipped at a time)
- Instability cost gấp đôi so với core principle tương đương

### 2.5 Principle Interaction System

#### 2.5.1 Four Interaction Types

Thay vì bảng modifier phức tạp per-pair, engine dùng 4 loại tương tác dựa trên graph topology:

| Interaction | Modifier | Khi nào | Ví dụ |
|------------|---------|---------|-------|
| **Strong** | +0.15 combat advantage | Attacker dùng principle **đối diện** defender | Energy vs Void |
| **Synergy** | +0.05 | Attacker dùng principle **lân cận** defender | Order vs Matter |
| **Neutral** | 0.00 | Same principle | Order vs Order |
| **Weak** | -0.10 | Non-adjacent, non-opposite | Order vs Flux |

#### 2.5.2 Interaction Graph

```
get_principle_interaction(attacker, defender):
    if attacker == defender → NEUTRAL (0.0)
    if defender == opposite(attacker) → STRONG (+0.15)
    if defender in adjacent(attacker) → SYNERGY (+0.05)
    else → WEAK (-0.10)
```

**Opposing pairs:**

| Pair | Logic |
|------|-------|
| Order ↔ Entropy | Cấu trúc vs Phân rã |
| Matter ↔ Flux | Cứng rắn vs Linh hoạt |
| Energy ↔ Void | Năng lượng vs Hư không |

**Adjacency graph:**

| Principle | Adjacent (compatible) |
|-----------|----------------------|
| Order | Matter, Energy |
| Entropy | Flux, Void |
| Matter | Order, Energy |
| Flux | Entropy, Void |
| Energy | Order, Matter |
| Void | Entropy, Flux |

> [!NOTE]
> Adjacency logic: mỗi principle có 2 "đồng minh" — chúng form 2 cluster tự nhiên: {Order, Matter, Energy} (constructive) vs {Entropy, Flux, Void} (deconstructive). Bên trong cluster = adjacent. Ngoài cluster (không đối diện) = weak.

#### 2.5.3 Rare Principle Interactions

Rare principles KHÔNG nằm trong opposing/adjacent graph. Chúng luôn có interaction = **NEUTRAL** với mọi core principle (modifier = 0.0). Power của rare đến từ mechanic đặc biệt, không từ elemental advantage.

| Rare vs Core | Interaction |
|-------------|------------|
| Causality vs any core | NEUTRAL (0.0) |
| Continuum vs any core | NEUTRAL (0.0) |
| Resonance Meta vs any core | NEUTRAL (0.0) |
| Rare vs Rare | NEUTRAL (0.0) |

---

## 3. Skill Tier System

### 3.1 Tier 1 — Common (Single Principle)

```
[Principle A] + [Mechanic] + [Constraint]
```

- 1 nguyên lý core duy nhất
- Ổn định, dễ kiểm soát
- Ví dụ: `Energy + Direct + Proximity` → tấn công năng lượng cận chiến

### 3.2 Tier 2 — Dual Principle (Meta build chính)

```
[Principle A + Principle B] + [Mechanic] + [Constraint]
```

- 2 nguyên lý core kết hợp
- Adjacent principles → stability cost thấp, synergy
- Opposing principles → instability cao, nhưng power burst mạnh
- Ví dụ: `Entropy + Void + Area + Accumulative` → AoE destabilization

### 3.3 Tier 3 — Rare Augmented (Late Game, Phase 2+)

```
[Core A + Core B] + [Rare Principle C] + [Mechanic] + [Constraint]
```

- 2 nguyên lý core + 1 nguyên lý hiếm
- Instability cao hơn nhiều
- Chỉ khả thi từ Floor 3+ (khi rare principle được unlock)
- Ví dụ: `Order + Matter + Causality` → cấu trúc phòng thủ nhân quả (damage delay)

### 3.4 Mythic Tier — Ancient Tri-Core (Cực hiếm, Phase 2+)

```
[Principle A + Principle B + Principle C] (3 core)
```

- 3 nguyên lý core (KHÔNG dùng rare)
- Constraint cực nặng, cost lớn, instability spike
- Ví dụ: `Matter + Order + Energy` → tạo cấu trúc phức tạp
- Ví dụ: `Entropy + Void + Flux` → dissolution dimension

---

## 4. Affinity System

### 4.1 Core Affinity (Innate — Không bao giờ mất)

Sinh ra từ onboarding quiz + identity vector. Engine dùng §2.2 mapping để chuyển narrative principle → mechanical resonance:

```json
{
  "core_affinity": {
    "primary": "order",    // resonance 0.7-0.9
    "minor": "matter"      // resonance 0.4-0.6
  }
}
```

**Tác dụng:**
- Tăng resonance khi dùng đúng nguyên lý
- Giảm instability khi dùng đúng
- Không bao giờ mất — là "bản chất gốc" (linked to Seed Identity)

### 4.2 Awakened Affinity (Dynamic — Từ Drift)

Có thể thức tỉnh khi:
- Drift mạnh và consistent theo nguyên lý khác
- Instability cao nhưng không vỡ
- Mutation lớn xảy ra
- Ritual đặc biệt hoặc mythic event
- Chết nhiều trong tháp (Tower amplifies)

**Giới hạn:** Tối đa **2 awakened affinity** active cùng lúc.

**Ví dụ:** Người Order main drift mạnh → Entropy awakening → `Order-Entropy hybrid` (mạnh nhưng unstable).

### 4.3 Resonance Scores

Mỗi player có resonance cho từng nguyên lý core (backend, hidden):

```json
{
  "order": 0.82,
  "entropy": 0.12,
  "matter": 0.55,
  "flux": 0.34,
  "energy": 0.45,
  "void": 0.10
}
```

| Mức | Resonance | Nguồn |
|-----|-----------|-------|
| Core affinity | 0.7–0.9 | Quiz/Identity |
| Minor affinity | 0.4–0.6 | Quiz/Identity |
| Neutral | 0.2–0.4 | Default |
| Opposing | 0.0–0.2 | Conflict |
| Awakened | Starts 0.3, grows | Drift/Mutation |

> [!IMPORTANT]
> Rare principles (Causality, Continuum, Resonance Meta) KHÔNG có resonance score trong Phase 1. Khi unlock ở Phase 2+, rare resonance sẽ bắt đầu ở 0.0 và grow qua usage + narrative events.

**Resonance ảnh hưởng:**

| Metric | Ảnh hưởng |
|--------|-----------| 
| Combat score | Resonance × weight trong 4-component formula |
| Stability drain | Lower resonance → higher drain |
| Mutation trigger | Lower resonance + high use → mutation risk |
| Backlash chance | Opposing principles → high backlash |

### 4.4 Floor Resonance Caps

Resonance bị giới hạn bởi floor hiện tại (0.0–1.0 scale):

| Floor | Max Resonance | Rare Accessible | Season |
|-------|--------------|-----------------|--------|
| 1 | 0.50 | ❌ | S1 |
| 2 | 0.70 | ❌ | S1 |
| 3 | 0.85 | ✅ Bắt đầu | S1 |
| 4 | 0.95 | ✅ Khả thi | S1 |
| 5 | 1.00 | ✅ Meta mở rộng | S1 |

**Effective cap:**
```python
effective_cap = min(1.0, floor_cap + personal_cap_bonus)
# personal_cap_bonus: from Stability Trials (max +0.3)
```

---

## 5. Intensity & Backlash System

### 5.1 Three Intensity Levels

| Intensity | Combat Score Bonus | Stability Cost | Backlash Risk | Ý nghĩa |
|-----------|-------------------|----------------|--------------|---------|
| **Safe** | +0.00 | 5 | 0% | Low risk, low reward |
| **Push** | +0.02 | 15 | 5% | Moderate risk/reward |
| **Overdrive** | +0.05 | 30 | 20% | High risk, high reward |

### 5.2 Backlash Effects

Khi backlash trigger (random roll < backlash_risk):

| Effect | Value |
|--------|-------|
| Stability cost | ×1.5 (50% extra) |
| HP damage | +10 extra |
| Instability | +5 |

### 5.3 Backlash Severity Ladder (Narrative — Phase 2+)

Khi instability tích lũy qua nhiều encounters:

```
Level 1: Skill misfire (output bị méo)
Level 2: Identity distortion (short-term perception shift)
Level 3: Affinity inversion (temporary resonance flip)
Level 4: Forced mutation event (narrative confrontation)
Level 5: Echo fracture (seed_identity conflict)
Level 6: World attention spike (notoriety + Empire notices)
```

---

## 6. Combat Score Formula (Resolution Model)

### 6.1 Four-Component Weighted Formula

Engine tính combat score (0.0–1.0) **trước** khi Writer viết prose:

```
CombatScore = BuildFit × 0.45
            + PlayerSkill × 0.30
            + Environment × 0.15
            + ControlledRandomness × 0.10
```

| Component | Weight | Sub-components |
|-----------|--------|----------------|
| **Build Fit** | 45% | Resonance alignment (25%) + Principle advantage (20%) |
| **Player Skill** | 30% | DQS mastery (20%) + Stability resource (10%) |
| **Environment** | 15% | Floor familiarity (10%) + Intensity bonus (5%) |
| **Controlled Randomness** | 10% | CRNG roll (5%) + Unique skill bonus (5%) |

### 6.2 Outcome Thresholds

| Score Range | Outcome | Narrative |
|-------------|---------|-----------|
| ≥ 0.60 | **FAVORABLE** | Player thắng rõ ràng. Skill mastery. Minimal cost. |
| 0.40 – 0.59 | **MIXED** | Thắng nhưng tốn kém. Trade-off. Struggle. |
| < 0.40 | **UNFAVORABLE** | Overwhelmed. Retreat, injury, or loss. |

### 6.3 Post-Combat Effects

| Metric | Favorable | Mixed | Unfavorable |
|--------|-----------|-------|-------------|
| HP cost | 0 | 10 | 25 |
| Resonance growth (primary) | +0.03 | +0.02 | +0.01 |
| Instability delta | -1.0 | 0.0 | +3.0 |

**Resonance decay:** Mỗi combat, tất cả principles KHÔNG được sử dụng bị decay -0.005 (minimum 0.1).

---

## 7. Resonance Visibility System

### 7.1 Ba tầng thông tin

Player **KHÔNG bao giờ** thấy số chính xác. Game dùng partial visibility:

#### 🟢 Tầng 1 — Public Signal (Narrative mô tả)

Player thấy prose:
- *"Bạn có xu hướng ổn định mạnh mẽ."* → Order high
- *"Flux trong bạn đang dao động."* → Flux rising
- *"Void đang âm thầm cộng hưởng."* → Void latent

#### 🔵 Tầng 2 — Measurable Indicator (Tương đối, Rank 2+)

UI hiển thị dạng thanh hoặc label:

```
Order:   ████░░░░  (Resonant)
Flux:    ██░░░░░░  (Dormant)
Entropy: █░░░░░░░  (Faint)
```

Labels: `Faint` → `Dormant` → `Active` → `Resonant` → `Turbulent`

#### 🟣 Tầng 3 — Hidden Layer (Backend only)

```json
{ "order": 0.82, "flux": 0.34, "entropy": 0.12 }
```

Chỉ engine + LLM + Combat Judge dùng. Player không thấy.

### 7.2 Awakening Hints

Thức tỉnh không thông báo rõ. Dùng narrative hints:
- *"Bạn bắt đầu cảm thấy mọi thứ xung quanh phân rã rõ ràng hơn."*
- *"Những cấu trúc bền vững làm bạn khó chịu."*

→ Tạo meta diễn đàn: *"Dấu hiệu này có phải sắp awaken Entropy không?"*

### 7.3 Rare Principle Hints (Phase 2+)

Rare principles có hint đặc biệt khi player tiếp cận Floor 3+:

| Rare | Hint narrative |
|------|---------------|
| Causality | *"Bạn bắt đầu... nhìn thấy chuỗi, trước khi chúng xảy ra."* |
| Continuum | *"Thời gian dường như không còn tuyến tính. Giây trước và giây sau trộn lẫn."* |
| Resonance Meta | *"Sức mạnh vọng lại — mỗi lần dùng, nó mạnh hơn một chút. Nhưng cũng rung hơn."* |

---

## 8. Unique Skill Integration

Unique Skills (từ Soul Forge) là **quyền bẻ cong cấu trúc**, KHÔNG phải nguyên lý:

| Loại Unique | Tác dụng | Ví dụ |
|-------------|----------|-------|
| Constraint Override | Bỏ qua 1 constraint | Dùng skill mà không cần proximity |
| Vector Inversion | Đảo hướng nguyên lý | Entropy → tái cấu trúc |
| Echo Stabilizer | Giảm instability xung đột | Hybrid build ổn định hơn |
| Cap Expander | Tăng personal cap | Vượt trần nhẹ mà ít risk |
| Resonance Shifter | Đổi resonance tạm thời | Adapt cho boss phase |

**Ultimate Skills** có thể:
- Viết lại compatibility
- Giảm xung đột foundation
- Mở khóa tri-core
- Neo cap cá nhân
- Tạo pocket-stability zone

**Nhưng KHÔNG BAO GIỜ phá world cap hoàn toàn.**

---

## 9. Data Models (Python — Implemented)

### 9.1 Core Models

```python
# app/models/power.py [IMPLEMENTED]

class Principle(str, Enum):
    """6 core principles — 3 opposing pairs."""
    ORDER = "order"
    ENTROPY = "entropy"
    MATTER = "matter"
    FLUX = "flux"
    ENERGY = "energy"
    VOID = "void"
    # Properties: display_name, opposite, adjacent

class InteractionType(str, Enum):
    STRONG = "strong"         # Opposite → +0.15
    WEAK = "weak"             # Non-adj, non-opp → -0.10
    NEUTRAL = "neutral"       # Same → 0.00
    SYNERGY = "synergy"       # Adjacent → +0.05

class NormalSkill(BaseModel):
    id: str
    name: str
    primary_principle: str     # Principle enum value
    secondary_principle: str   # For Tier 2+
    tertiary_principle: str    # For Tier 3 (rare)
    tier: int                  # 1, 2, or 3
    mechanic: str
    limitation: str
    weakness: str
    source: str                # "story" | "floor_reward" | "integration" | "lore"

class ResonanceState(BaseModel):
    """Per-principle resonance (0.0–1.0), clamped."""
    order: float = 0.0
    entropy: float = 0.0
    matter: float = 0.0
    flux: float = 0.0
    energy: float = 0.0
    void: float = 0.0
    # Methods: get(), set(), grow(delta, floor, cap_bonus), decay()

class CombatMetrics(BaseModel):
    """Runtime combat state."""
    hp: float = 100.0
    stability: float = 100.0
    instability: float = 0.0
    dqs: float = 50.0            # Decision Quality Score
    breakthrough: float = 0.0    # Controlled randomness

class Intensity(str, Enum):
    SAFE = "safe"          # bonus=0.0, backlash_risk=0.0
    PUSH = "push"          # bonus=0.02, backlash_risk=0.05
    OVERDRIVE = "overdrive"  # bonus=0.05, backlash_risk=0.20
```

### 9.2 Rare Principle Models (Phase 2+ — NOT YET IMPLEMENTED)

```python
# app/models/power.py [IMPLEMENTED — stub enum, Phase 2 mechanics pending]

class RarePrinciple(str, Enum):
    """3 rare principles, unlocked Floor 3+."""
    CAUSALITY = "causality"
    CONTINUUM = "continuum"
    RESONANCE_META = "resonance_meta"

class RareResonanceState(BaseModel):
    """Separate tracking for rare principles."""
    causality: float = 0.0
    continuum: float = 0.0
    resonance_meta: float = 0.0
    unlocked: list[str] = []  # Which rare principles player has accessed

# NormalSkill.tertiary_principle will reference RarePrinciple for Tier 3 skills
```

---

## 10. Phase 1 Scope — Implemented ✅

### Implemented

| Component | Status | File |
|-----------|--------|------|
| 6 Core Principles | ✅ | `power.py` — `Principle` enum |
| Interaction System | ✅ | `power.py` — `get_principle_interaction()` |
| Tier 1+2 Skills | ✅ | `power.py` — `NormalSkill` |
| Resonance State | ✅ | `power.py` — `ResonanceState` |
| Floor Caps | ✅ | `power.py` — `FLOOR_RESONANCE_CAPS` |
| Combat Score | ✅ | `combat.py` — `compute_combat_score()` |
| Resolution Outcomes | ✅ | `combat.py` — `resolve_combat()` |
| Intensity + Backlash | ✅ | `power.py` + `combat.py` |
| CombatBrief | ✅ | `combat.py` — `build_combat_brief()` |
| Pipeline Integration | ✅ | `orchestrator.py` — `_resolve_combat_for_beat()` |

### Defer to Phase 2+

| Component | Phase | Notes |
|-----------|-------|-------|
| 3 Rare Principles (Causality, Continuum, Resonance Meta) | Phase 2 | Unlock at Floor 3+, new enum + resonance model |
| Tier 3 Skills | Phase 2 | Requires rare principles |
| Mythic Tri-Core | Phase 2 | 3 core principles |
| Awakened Affinity | Phase 2 | Latent principle awakening |
| Personal Cap Training | Phase 2 | Stability Trials, see SKILL_EVOLUTION_SPEC §7 |
| Backlash Severity Ladder | Phase 2 | 6-level cascading effect |
| World Cap progression | Phase 3 (MMO) | Server-wide modifier |
| Perception skills | Phase 3 | Detection/stealth PvP |

---

## 11. Giới hạn chống phá meta

| Quy tắc | Lý do |
|---------|-------|
| 6 core principles chỉ trong Phase 1 | Avoid overdesign |
| Rare principles chỉ từ Floor 3+ | Gradual complexity |
| Tối đa 1 rare principle per skill | Prevent god-mode |
| Tối đa 2 awakened affinity | Limit build complexity |
| Affinity xung đột gây internal friction | Hybrid có cost |
| Overdrive có backlash probability | Risk/reward |
| LLM không tự bịa resonance | Consistency |
| Resonance always hidden from player | Anti-min-max |

---

## Appendix A: Decisions Log

| Câu hỏi | Quyết định | Source |
|----------|-----------|--------|
| Mấy core principles? | **6** (drop Light from v1.0) | Audit v1.1 — Light merged into Void/Energy |
| Affinity cố định hay dynamic? | Core innate + awakened dynamic | Affinity Spec v1 |
| Hiển thị resonance? | Partial visibility (C) | Resonance Visibility v1 |
| Soft cap? | Floor cap + personal bonus (0.0–1.0 scale) | Implementation alignment |
| Vượt trần? | Có, bằng Overdrive + rủi ro cao | Soft Cap v1 |
| Power focus? | Combat-focused (A) | Combat Core Loop |
| Build complexity? | Dễ tiếp cận, dần lộ chiều sâu (B) | Deterministic Core |
| Rare principles khi nào? | Phase 2, Floor 3+ | v1.1 decision |
| World Bible 5 vs Spec 6? | Both valid — 2-layer architecture + mapping | v1.1 harmonization |

## Appendix B: Changelog

### v1.1 (2026-02-23)

- **BREAKING:** Removed "Light" from core principles (7 → 6). Light functionality split between Energy (perception aspects) and Void (stealth/denial).
- **NEW:** §2.1 Dual-Layer Architecture — documents relationship between World Bible's 5 narrative principles and Power System's 6 mechanical principles.
- **NEW:** §2.2 Narrative → Mechanical mapping table with reasoning.
- **NEW:** §2.5.1 Formalized 4-type interaction system (Strong/Weak/Neutral/Synergy) replacing v1.0's per-pair matrix.
- **NEW:** §2.5.2 Adjacency graph — two clusters: {Order, Matter, Energy} constructive vs {Entropy, Flux, Void} deconstructive.
- **NEW:** §2.5.3 Rare principle interaction rules (always NEUTRAL).
- **CHANGED:** §4.3 Resonance scores now 0.0–1.0 scale (was implicit), 6 principles.
- **CHANGED:** §4.4 Floor caps aligned with implementation (0.50/0.70/0.85/0.95/1.00).
- **CHANGED:** §9 Data models now reflect actual `power.py` implementation.
- **CHANGED:** §10 Phase scope updated with implementation status.
- **MOVED:** 3 rare principles (Causality, Continuum, Resonance Meta) explicitly to Phase 2+.
