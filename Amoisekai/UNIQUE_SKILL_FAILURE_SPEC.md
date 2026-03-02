# 🎯 Unique Skill — Failure Mechanic Specification v1.0

> **Author:** Amo + AI  
> **Date:** 2026-02-23  
> **Status:** Implemented v1.0  
> **Phase:** 1 (MVP)  
> **Dependencies:** POWER_SYSTEM_SPEC §5 & §8, COMBAT_SYSTEM_SPEC §6, UniqueSkill model  

---

## 1. Vấn đề hiện tại

| Hiện trạng | Vấn đề |
|------------|--------|
| `unique_skill_bonus = 0.03` — cố định, không điều kiện | Skill lần đầu luôn thành công 100% |
| `skill_usage_this_chapter` chỉ tăng counter | Không enforce fail — chỉ gửi prompt warning cho LLM |
| Overuse warning ≥2-3 lần là text instruction | LLM có thể bỏ qua, không có code verify |
| `UniqueSkill.resilience` & `instability` có trong model | **Không có code nào đọc chúng** |
| Counter reset mỗi chapter | Chương mới = dùng thoải mái lại |

**Hệ quả narrative:** Player spam unique skill → mọi combat trivial, không có tension.

---

## 2. Design Goals

1. **Code-enforced** — Failure/degradation được tính bằng code, KHÔNG phụ thuộc LLM compliance
2. **Gradual** — Không on/off mà degrade dần: full → weakened → misfire → backfire
3. **Narrative-aware** — Failure type gắn với câu chuyện (resilience decay = identity drift)
4. **Simple Phase 1** — Chỉ dùng stats hiện có: `resilience`, `instability`, `stability`, `skill_usage_this_chapter`
5. **Writer-readable** — Output `SkillActivation` struct để Writer biết chính xác skill outcome

---

## 3. Skill Activation System

### 3.1 Activation Check — `check_skill_activation()`

```python
# app/engine/skill_check.py [NEW]

from __future__ import annotations
from enum import Enum
from pydantic import BaseModel
import random


class SkillOutcome(str, Enum):
    """4 cấp bậc kết quả khi activate unique skill."""
    FULL = "full"            # Skill hoạt động 100%
    WEAKENED = "weakened"    # Skill yếu hơn — hiệu quả giảm
    MISFIRE = "misfire"      # Skill kích hoạt sai — không damage, tốn stability
    BACKFIRE = "backfire"    # Skill phản tác dụng — damage bản thân


class SkillActivation(BaseModel):
    """Kết quả check activation, truyền cho CombatBrief và SceneWriter."""
    outcome: SkillOutcome = SkillOutcome.FULL
    effectiveness: float = 1.0       # 0.0-1.0, nhân với unique_skill_bonus
    stability_cost: float = 0.0      # Stability drain thêm
    hp_cost: float = 0.0             # HP damage nếu backfire
    narrative_instruction: str = ""  # Hướng dẫn cho Writer
    reason: str = ""                 # Log/debug lý do


def check_skill_activation(
    resilience: float,            # UniqueSkill.resilience (0-100)
    skill_instability: float,     # UniqueSkill.instability (0-100)
    player_stability: float,      # PlayerState.stability (0-100)
    usage_this_chapter: int,      # Lần dùng trong chapter hiện tại
    player_instability: float,    # PlayerState.instability (0-100)
) -> SkillActivation:
    """
    Kiểm tra kết quả khi player cố dùng unique skill.
    
    Logic 3 lớp:
    1. Usage fatigue — dùng nhiều trong chapter = yếu dần
    2. Resilience gate — resilience thấp = misfire risk cao
    3. Instability threshold — instability cao = backfire risk
    
    Returns SkillActivation struct cho CombatBrief/SceneWriter.
    """
```

### 3.2 Failure Probability Matrix

#### Layer 1: Usage Fatigue (trong chapter)

| Lần dùng | Effectiveness | Stability cost | Fail risk | Logic |
|----------|--------------|----------------|-----------|-------|
| 0 (lần 1) | 1.0 | 0 | 0% | Fresh — luôn thành công |
| 1 (lần 2) | 0.8 | 5 | 5% misfire | Bắt đầu mệt |
| 2 (lần 3) | 0.5 | 12 | 20% misfire, 5% backfire | Mệt nặng |
| 3+ (lần 4+) | 0.2 | 20 | 40% misfire, 15% backfire | Gần kiệt |

> **Key:** Lần 1 luôn thành công (player feels powerful). Degradation bắt đầu từ lần 2+.

#### Layer 2: Resilience Gate (cross-chapter persistence)

> [!IMPORTANT]
> `resilience` chỉ dùng cho **failure mechanic nội tại** (overuse, identity drift → misfire/backfire).
> Khả năng chống áp chế từ bên ngoài (opponent/field) dùng field riêng: `suppression_resistance` (xem UNIQUE SKILL CONTROL SYSTEM v1 §IX).

UniqueSkill.resilience phản ánh mức độ "khỏe mạnh" của skill. Giảm khi:
- Identity drift mạnh (player hành xử ngược seed → -2.0)
- Overuse liên tục qua nhiều chapter (mỗi lần dùng ≥3 trong 1 chapter → -5.0)
- Instability cao kéo dài → -1.0/chapter

| Resilience | Modifier | Effect |
|------------|----------|--------|
| 80-100 | ×1.0 | Healthy — skill hoạt động bình thường |
| 50-79 | ×0.85 | Strained — effectiveness giảm nhẹ |
| 20-49 | ×0.65 | Fragile — fail risk +15%, effectiveness giảm mạnh |
| 0-19 | ×0.40 | Fractured — fail risk +30%, gần mất skill |

**Resilience recovery (Phase 1):**
- +3.0/chapter nếu player hành xử đúng seed identity (`identity_coherence ≥ 80`)

**Resilience recovery (Phase 2 — chưa implement):**
- +5.0 nếu chapter có "rest" scenes (cần rest detection)
- +10.0 từ narrative milestone (Soul Forge event)

#### Layer 3: Instability Threshold

**3a. Skill-level instability** (`UniqueSkill.instability`) → misfire:

| skill_instability | Misfire bonus | Logic |
|-------------------|---------------|-------|
| 0-39 | +0% | Skill ổn định |
| 40-69 | +5% | Skill bắt đầu lung lay |
| 70+ | +12% | Skill rất bất ổn, misfire cao |

> `skill.instability` được sync = `player.instability × 0.5` cuối mỗi chapter.

**3b. Player-level instability** (`PlayerState.instability`) → backfire:

Khi `player_instability ≥ 60`:
- Backfire chance +10% (cộng thêm vào Layer 1)
- Narrative: "Sức mạnh đang xung đột với bản chất lung lay"

Khi `player_instability ≥ 80`:
- Backfire chance +25%
- Narrative: "Skill tự phản — hiện thực từ chối bản sắc không ổn định"

---

## 4. Outcome Effects

### 4.1 Chi tiết từng Outcome

```python
# Continuation of check_skill_activation()

    # ── Layer 1: Usage fatigue ──
    USAGE_TABLE = {
        0: {"eff": 1.0, "stab_cost": 0,  "misfire": 0.00, "backfire": 0.00},
        1: {"eff": 0.8, "stab_cost": 5,  "misfire": 0.05, "backfire": 0.00},
        2: {"eff": 0.5, "stab_cost": 12, "misfire": 0.20, "backfire": 0.05},
    }
    DEFAULT_USAGE = {"eff": 0.2, "stab_cost": 20, "misfire": 0.40, "backfire": 0.15}

    usage_data = USAGE_TABLE.get(usage_this_chapter, DEFAULT_USAGE)
    effectiveness = usage_data["eff"]
    stability_cost = usage_data["stab_cost"]
    misfire_chance = usage_data["misfire"]
    backfire_chance = usage_data["backfire"]

    # ── Layer 2: Resilience modifier ──
    if resilience >= 80:
        res_mod = 1.0
    elif resilience >= 50:
        res_mod = 0.85
        misfire_chance += 0.05
    elif resilience >= 20:
        res_mod = 0.65
        misfire_chance += 0.15
    else:
        res_mod = 0.40
        misfire_chance += 0.30

    effectiveness *= res_mod

    # ── Layer 3: Instability threshold ──
    if player_instability >= 80:
        backfire_chance += 0.25
    elif player_instability >= 60:
        backfire_chance += 0.10

    # ── Low stability amplifier ──
    if player_stability < 30:
        misfire_chance += 0.10
        stability_cost *= 1.5  # drain more when already low

    # ── Roll ──
    roll = random.random()

    if roll < backfire_chance:
        return SkillActivation(
            outcome=SkillOutcome.BACKFIRE,
            effectiveness=0.0,
            stability_cost=stability_cost * 2,
            hp_cost=15.0,
            narrative_instruction=(
                "Unique skill PHẢN TÁC DỤNG! Sức mạnh phóng ngược lại. "
                "Player chịu damage, stability crash. Mô tả nỗi đau và sự mất kiểm soát. "
                "Skill tạm thời không dùng được trong scene tiếp theo."
            ),
            reason=f"Backfire roll {roll:.2f} < {backfire_chance:.2f}",
        )

    if roll < backfire_chance + misfire_chance:
        return SkillActivation(
            outcome=SkillOutcome.MISFIRE,
            effectiveness=0.0,
            stability_cost=stability_cost,
            hp_cost=0.0,
            narrative_instruction=(
                "Unique skill THẤT BẠI — kích hoạt nhưng không có hiệu quả. "
                "Mô tả skill chớp lóe rồi tắt, hoặc phóng sai hướng. "
                "Player mất stability nhưng không gây damage. Tạo khoảnh khắc bất lực."
            ),
            reason=f"Misfire roll {roll:.2f} < {backfire_chance + misfire_chance:.2f}",
        )

    if effectiveness < 0.8:
        return SkillActivation(
            outcome=SkillOutcome.WEAKENED,
            effectiveness=effectiveness,
            stability_cost=stability_cost,
            hp_cost=0.0,
            narrative_instruction=(
                f"Skill yếu hơn bình thường (hiệu quả {effectiveness:.0%}). "
                "Mô tả skill kích hoạt nhưng không đạt sức mạnh tối đa — "
                "run rẩy, chậm hơn, hoặc tác dụng ngắn hơn dự kiến."
            ),
            reason=f"Weakened: eff={effectiveness:.2f}",
        )

    return SkillActivation(
        outcome=SkillOutcome.FULL,
        effectiveness=effectiveness,
        stability_cost=stability_cost,
        hp_cost=0.0,
        narrative_instruction=(
            "Skill kích hoạt thành công — mô tả sức mạnh đầy đủ, "
            "thể hiện sự kết nối giữa player và bản sắc."
        ),
        reason=f"Full: eff={effectiveness:.2f}",
    )
```

### 4.2 Outcome Summary

| Outcome | Combat bonus | Stability cost | HP cost | Narrative |
|---------|------------|----------------|---------|-----------|
| **FULL** | `0.03 × 1.0` = 0.03 | 0-5 | 0 | Skill rực rỡ |
| **WEAKENED** | `0.03 × 0.2-0.8` | 5-12 | 0 | Skill yếu ớt, run rẩy |
| **MISFIRE** | 0 | 12-20 | 0 | Skill chớp tắt, vô dụng |
| **BACKFIRE** | 0 | 24-40 | 15 | Skill phản ngược, damage bản thân |

---

## 5. Integration Points

### 5.1 Combat Path — `_resolve_combat_for_beat()`

**File:** `orchestrator.py` L1195-1302

Thay thế `unique_bonus = 0.03` cố định:

```diff
    # ── Unique skill bonus ──
    unique_bonus = 0.0
    unique_name = ""
    unique_mechanic = ""
+   skill_activation = None
    if player.unique_skill:
-       unique_bonus = 0.03  # Small passive bonus for having a unique skill
+       from app.engine.skill_check import check_skill_activation
+       skill_activation = check_skill_activation(
+           resilience=player.unique_skill.resilience,
+           skill_instability=player.unique_skill.instability,
+           player_stability=player.stability,
+           usage_this_chapter=skill_usage_this_chapter,  # needs to be passed
+           player_instability=player.instability,
+       )
+       unique_bonus = 0.03 * skill_activation.effectiveness
        unique_name = player.unique_skill.name
        unique_mechanic = player.unique_skill.mechanic
+
+       # Apply activation costs
+       if skill_activation.stability_cost > 0:
+           player.stability = max(0, player.stability - skill_activation.stability_cost)
+       if skill_activation.hp_cost > 0:
+           player.hp = max(0, player.hp - skill_activation.hp_cost)
```

> [!NOTE]
> `_resolve_combat_for_beat()` hiện không nhận `skill_usage_this_chapter` — cần truyền thêm param từ `generate_single_scene()`.

### 5.2 Non-Combat Path — SceneWriter

**File:** `scene_writer.py` L288-303

Thay overuse warning text bằng structured data:

```diff
    # Skill overuse warning
    usage = input.skill_usage_this_chapter
-   if usage >= 3:
-       overuse_warning = "⛔ CẢNH BÁO..."
-   elif usage >= 2:
-       overuse_warning = "⚠️ Skill đã dùng 2 lần..."
-   elif usage == 1:
-       overuse_warning = "Skill đã dùng 1 lần..."
-   else:
-       overuse_warning = ""
+   # Run skill activation check
+   overuse_warning = ""
+   if input.unique_skill and usage > 0:
+       from app.engine.skill_check import check_skill_activation
+       resilience = input.unique_skill.get("resilience", 100)
+       s_instab = input.unique_skill.get("instability", 0)
+       p_stab = (input.player_state or {}).get("stability", 100)
+       p_instab = (input.player_state or {}).get("instability", 0)
+       activation = check_skill_activation(
+           resilience=resilience,
+           skill_instability=s_instab,
+           player_stability=p_stab,
+           usage_this_chapter=usage,
+           player_instability=p_instab,
+       )
+       overuse_warning = activation.narrative_instruction
```

### 5.3 CombatBrief Extension

**File:** `combat.py` — class `CombatBrief`

```diff
    # Unique skill involvement
    unique_skill_active: bool = False
    unique_skill_name: str = ""
    unique_skill_mechanic: str = ""
+   unique_skill_outcome: str = "full"  # SkillOutcome value
+   unique_skill_narrative: str = ""    # Writer instruction for skill outcome
```

### 5.4 Resilience Decay — Post-Chapter

**File:** `orchestrator.py` — alongside `brain.store_chapter()`

```python
# After chapter completion, update UniqueSkill resilience
if player and player.unique_skill:
    skill = player.unique_skill

    # Decay from overuse
    if skill_usage_this_chapter >= 3:
        skill.resilience = max(0, skill.resilience - 5.0)

    # Decay from identity drift (coherence dropping)
    if player.identity_coherence < 50:
        skill.resilience = max(0, skill.resilience - 2.0)

    # Recovery from aligned behavior
    if player.identity_coherence >= 80:
        skill.resilience = min(100, skill.resilience + 3.0)

    # Skill instability mirrors player instability (feeds Layer 3a)
    skill.instability = player.instability * 0.5

    self.db.update_player(player)
```

---

## 6. Data Flow

```
Player choice → "[Skill Name]" detected
       ↓
skill_usage_this_chapter += 1
       ↓
┌─────────────────────────────────┐
│    check_skill_activation()     │
│                                 │
│  Input:                         │
│  - resilience (0-100)           │
│  - skill_instability (0-100)    │
│  - player_stability (0-100)     │
│  - usage_this_chapter (int)     │
│  - player_instability (0-100)   │
│                                 │
│  Output:                        │
│  - SkillActivation {            │
│      outcome: SkillOutcome      │
│      effectiveness: 0.0-1.0     │
│      stability_cost: float      │
│      hp_cost: float             │
│      narrative_instruction: str │
│    }                            │
└──────────┬──────────────────────┘
           │
     ┌─────┴─────┐
     │            │
 Combat?      Non-combat?
     │            │
     ▼            ▼
 CombatBrief  SceneWriter
 bonus *= eff overuse_warning = instruction
```

---

## 7. Ví dụ Narrative

### 7.1 Lần 1 — Full

> Sáng tạo bùng cháy trong lòng bàn tay. **Resonance Ripple** kích hoạt — ánh sáng tím lan tỏa, làm méo mó không gian xung quanh. Tên lính Empire ngã ra sau, cấu trúc bảo vệ vỡ vụn.

### 7.2 Lần 2 — Weakened

> Bạn cố gọi lại **Resonance Ripple**, nhưng lần này ánh sáng yếu hơn — run rẩy, như ngọn nến trước gió. Sóng lan ra, nhưng chỉ đẩy lùi chứ không phá vỡ. Cơ thể bắt đầu ê ẩm.

### 7.3 Lần 3 — Misfire

> **Resonance Ripple** phập phù — kích hoạt rồi tắt ngấm. Bạn giơ tay ra, nhưng không có gì xảy ra ngoài một tiếng nổ nhỏ và cảm giác kiệt sức ập đến. Stability giảm. Đối thủ lao tới.

### 7.4 Lần 4 (hoặc low resilience) — Backfire

> Bạn ép **Resonance Ripple** hoạt động bằng ý chí — nhưng sóng phóng ngược! Đau đớn xé qua cánh tay, sức mạnh xoắn lại trong cơ thể. HP giảm 15. Stability crash. Đối thủ nhìn bạn với ánh mắt thương hại.

---

## 8. Balance Notes

### 8.1 Tại sao lần 1 luôn thành công?

**Game feel.** Player cần cảm nhận sức mạnh trước khi bị giới hạn. Nếu skill fail ngay từ đầu → frustration, không phải tension. Flow: **power → overconfidence → consequence**.

### 8.2 Tại sao reset per-chapter?

Chapter = unit thời gian trong truyện (vài giờ trong game). Skill fatigue per-chapter cân bằng giữa:
- **In-chapter tension** — spam không được
- **Cross-chapter freedom** — chương mới = sức mạnh hồi phục (rest logic)

**Cross-chapter persistence** đến từ `resilience` decay — nếu lạm dụng liên tục qua 5+ chapters, resilience rơi xuống low → lần 1 cũng có thể yếu.

### 8.3 Tại sao không hard-disable?

"Không dùng được" = boring. "Dùng được nhưng có thể phản tác dụng" = **drama**. Player vẫn có thể gamble — đúng triết lý **Risk/Reward** của Combat Spec.

---

## 9. Files Changed (Summary)

| File | Type | Changes |
|------|------|---------|
| `app/engine/skill_check.py` | **NEW** | `SkillOutcome`, `SkillActivation`, `check_skill_activation()` |
| `app/engine/combat.py` | MODIFY | Add `unique_skill_outcome` & `unique_skill_narrative` to `CombatBrief` |
| `app/engine/orchestrator.py` | MODIFY | Replace fixed bonus with `check_skill_activation()` in `_resolve_combat_for_beat()` + Add resilience decay in chapter completion |
| `app/narrative/scene_writer.py` | MODIFY | Replace hardcoded overuse warnings with `check_skill_activation()` output |

**LOC estimate:** ~120 new lines, ~40 modified lines

---

## 10. Verification Checklist

- [x] Unit test: `check_skill_activation()` returns FULL at usage=0
- [x] Unit test: WEAKENED at usage=1, resilience=100
- [x] Unit test: MISFIRE at usage=2, low resilience
- [x] Unit test: BACKFIRE at usage=3+, high instability
- [x] Unit test: Resilience 0 → high misfire rate
- [x] Unit test: Player instability ≥80 → high backfire rate
- [x] Unit test: skill_instability ≥40 → misfire chance up
- [x] Unit test: skill_instability ≥70 → misfire chance higher
- [x] Integration: CombatBrief includes skill outcome
- [x] Integration: SceneWriter displays correct narrative instruction
- [ ] E2E: Play 3 chapters spamming skill → resilience decays → lần 1 bắt đầu yếu

---

## Appendix A: Relationship to Existing Systems

```
UniqueSkill.resilience ←── Identity Coherence (player behavior)
       │                        ↑
       │                  Soul Forge genesis
       ▼
check_skill_activation()
       │
       ├── Combat: CombatBrief.unique_skill_outcome
       │         ↓
       │    SceneWriter prose (combat narrative)
       │
       └── Non-combat: SceneWriter.overuse_warning
                ↓
           SceneWriter prose (narrative skill use)

Post-chapter:
  resilience += recovery (if identity aligned)
  resilience -= decay (if overuse or drift)
```

## Appendix B: Future Extensions (Phase 2+)

| Feature | Description |
|---------|-------------|
| **Skill Evolution on Backfire** | Backfire 3+ times → skill mutates → new variant |
| **Resonance-gated activation** | Specific resonance level required for full power |
| **Opponent resistance** | Bosses can have "skill immunity" phases |
| **Stamina/Mana resource** | Separate resource pool for unique skill |
| **Awakened Mastery** | High resilience + 50+ uses → unlock enhanced form |
