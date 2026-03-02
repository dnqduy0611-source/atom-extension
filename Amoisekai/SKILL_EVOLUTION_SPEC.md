# ⚔️ AMOISEKAI — Skill Evolution & Resonance Mastery Specification v1.1

> **Author:** Amo  
> **Date:** 2026-02-28  
> **Status:** Formalized — Audit-synced  
> **Dependencies:** PROGRESSION_SYSTEM_SPEC (§4-5), POWER_SYSTEM_SPEC, COMBAT_SYSTEM_SPEC v2.0, IDENTITY TRANSFORMATION ARCHITECTURE v1  
> **Scope:** Normal skills — KHÔNG bao gồm Unique Skill (xem UNIQUE_SKILL_GROWTH_SPEC)  
> **Covers:** Trục 2 (Skill Progression) + Trục 3 (Resonance Mastery) từ Progression Framework

---

## 1. Triết lý

> Normal skills không phải consumables. Chúng **tiến hóa** — constraint nới lỏng, bản chất đổi, principles hợp nhất, hoặc nguyên lý mới thức tỉnh.

**Nguyên tắc:**
- **Skills biến đổi, không tăng số** — Refinement nới constraint, không +10 damage
- **Ít nhưng có nghĩa** — Max 2 Refinements, 2 Integrations, 3 Mutations per character career
- **Gated by Rank** — Mỗi evolution path yêu cầu Rank tối thiểu
- **Narrative delivery** — Mọi evolution là story beat, không phải menu click
- **Resonance mastery = hidden power** — Player mạnh hơn qua usage, không qua farming

---

## 2. Skill System Recap

### 2.1 Skill Architecture (từ POWER_SYSTEM_SPEC)

```
Skill = Principle(s) + Mechanic + Constraint + Tier

Tiers:
├── Tier 1: Single principle, basic (VD: "Energy Burst" — Energy only)
├── Tier 2: Dual principle, complex (VD: "Kinetic Barrier" — Matter + Energy)
├── Tier 3: Rare/Augmented, triple or rare principle (VD: "Reality Anchor" — Order + Void + Matter)
└── Mythic: Lore-gated, floor-specific (Phase 2+)

Equipped Slots:
├── Rank 1-2: 3 slots
├── Rank 2+: 4 slots (unlock at Resonant)
└── Post-Ultimate: 3 slots + 1 Ultimate (1 normal absorbed)
```

### 2.2 6 Principles

```
ORDER ←→ ENTROPY
MATTER ←→ FLUX
ENERGY ←→ VOID

Interactions:
├── Strong against opposite: Order > Entropy, Entropy > Order (rock-paper-scissors)
├── Adjacent principles: compatible (can dual-skill)
└── Same principle: deepens resonance (high synergy)
```

### 2.3 Skill Nguồn gốc

| Nguồn | Khi nào | Tier |
|-------|---------|------|
| Story encounter | Chapter events, NPC gifts | Tier 1 |
| Floor reward | Clear floor boss | Tier 1-2 |
| Integration | Player merges 2 skills | Tier 2 |
| Awakening | Affinity event adds principle | Tier 2 (enhanced) |
| Lore discovery | Hidden narrative paths | Tier 2-3 |
| Mythic drop | Season event, extreme CRNG | Mythic (Phase 2) |

---

## 3. Evolution Path 1: Refinement — "Mài giũa"

### 3.1 Concept

Dùng skill **đúng identity, consistent** qua nhiều encounters → constraint tự nhiên nới lỏng. Đây là evolution phổ biến nhất, xảy ra sớm nhất.

> Cảm giác: "Kỹ năng này đã trở thành bản năng. Giới hạn cũ không còn ràng buộc."

### 3.2 Trigger

```python
def check_refinement(player, skill, successful_uses: int) -> bool:
    """Đủ điều kiện refine khi dùng nhiều + identity aligned.
    
    Args:
        player: Player state (has .skill_evolution)
        skill: Skill object being checked
        successful_uses: int — số lần dùng thành công (outcome ≠ unfavorable)
    """
    evolution = player.skill_evolution  # SkillEvolutionState — single source of truth
    alignment = _calc_skill_identity_alignment(skill, player.identity.current)
    return (
        successful_uses >= 8 and
        alignment >= 0.6 and
        skill.id not in evolution.refinements_done and  # Mỗi skill chỉ refine 1 lần
        len(evolution.refinements_done) < 2  # Max 2 refinements total
    )


def _calc_skill_identity_alignment(skill, current_identity) -> float:
    """Tính alignment giữa skill principle và identity hiện tại.
    
    Returns: 0.0–1.0
        - 1.0 = skill principle hoàn toàn khớp identity vector hiện tại
        - 0.0 = skill principle hoàn toàn lệch
    
    Logic: Dùng current_identity vector + skill.primary_principle
        → So sánh weight của principle đó trong identity vector
        → VD: identity.current = {order: 0.8, entropy: 0.1, ...}
               skill.primary_principle = "order"
               → alignment = 0.8
    """
    return current_identity.get(skill.primary_principle, 0.0)
```

### 3.3 Refinement Effects

| Constraint type | Trước | Sau Refine | Ví dụ |
|---|---|---|---|
| **Range** | Proximity only | Mid-range | "Energy Burst" mở rộng từ melee → 10m |
| **Cooldown** | 3 chapters | 2 chapters | "Void Cloak" dùng thường xuyên hơn |
| **Cost** | 30% stability | 20% stability | "Matter Shield" tiêu ít stability hơn |
| **Duration** | 1 phase | 2 phases | "Order Bind" kéo dài gấp đôi |
| **Condition** | Requires ally nearby | Solo OK | "Oath Bond" không cần ally |

> **Quan trọng:** Chỉ **1 constraint** được nới lỏng per refinement. Engine chọn constraint phù hợp nhất dựa trên usage pattern.

### 3.4 Refinement Narrative (1 scene)

```
Rest/Discovery scene:
├── beat_type: "rest"
├── Skill activates smoothly — player notices it's "easier"
├── Writer: "Bạn nhận ra [skill] phản ứng tự nhiên hơn. Giới hạn về 
│   [range/cooldown/cost] dường như đã nới lỏng."
└── Skill updated in player state
```

### 3.5 Limits

| Quy tắc | Giá trị |
|---------|--------|
| Max refinements per character | **2** (across all skills) |
| Each skill refined max | **1 lần** (mỗi skill chỉ refine được 1 lần) |
| Min uses before eligible | **8** successful uses |
| Min identity alignment | **0.6** resonance with skill's principle |
| Refinement magnitude | Small — nới 1 constraint, không phá balance |
| Rank requirement | **None** (possible from Rank 1) |

---

## 4. Evolution Path 2: Mutation — "Biến đổi"

### 4.1 Concept

Identity drift mạnh → skill's **bản chất thay đổi** để khớp với identity mới. Đây là evolution dramatic nhất, gắn chặt với IDENTITY TRANSFORMATION ARCHITECTURE.

> Cảm giác: "Bạn đã thay đổi. Và kỹ năng của bạn thay đổi theo."

### 4.2 Trigger

```python
def check_skill_mutation(player) -> str | None:
    """Check nếu bất kỳ skill nào đủ điều kiện mutation."""
    if player.skill_evolution.mutations_done >= 3:
        return None  # Max 3 mutations
    
    # Identity drift conditions (strict: < 30 coherence AND > 70 instability)
    identity = player.identity
    if identity.coherence >= 30 or identity.instability <= 70:
        return None  # Chưa đủ drift
    
    # Find skill most misaligned with current identity
    max_misalignment = 0.0
    candidate = None
    for skill in player.equipped_skills:
        if skill.is_unique:
            continue  # Unique skills mutate via UNIQUE_SKILL_GROWTH_SPEC
        alignment = _calc_skill_identity_alignment(skill, identity.current)
        misalignment = 1.0 - alignment
        if misalignment > max_misalignment and misalignment > 0.6:
            max_misalignment = misalignment
            candidate = skill.id
    
    return candidate  # skill_id or None
```

### 4.3 Mutation Types

| Type | Identity Drift Pattern | Kết quả | Ví dụ |
|---|---|---|---|
| **Inversion** | Hành vi đối lập seed | Skill đổi sang principle đối diện | Order Shield → Entropy Disruption |
| **Corruption** | Instability cực cao (>85) | Skill mạnh hơn nhưng thêm backlash risk | Energy Burst → Unstable Detonation |
| **Purification** | Coherence recovery từ low | Skill "thanh lọc", constraint giảm + weakness giảm | Chaos Surge → Balanced Flow |
| **Hybridization** | Latent identity ≠ current | Skill nhận thêm latent principle | Matter Shield → Matter-Flux Adaptive Shield |

### 4.4 Mutation Arc (2-3 scenes)

```
Scene 1 — "Bất ổn" (discovery):
├── Skill hành xử bất thường — misfire, weak, hoặc behave ngược
├── Writer: "[Skill] cảm thấy khác. Như thể nó không còn nhận ra bạn."
└── Player nhận ra skill đang drift

Scene 2 — "Đối mặt" (climax):
├── Tình huống cần skill nhưng skill không hoạt động đúng
├── DECISION POINT:
│   🔄 Chấp nhận mutation — "Để nó thay đổi theo bạn"
│   🛡️ Chống lại mutation — "Giữ bản chất cũ" (stability trial)
│   ⚡ Buộc hybrid — "Ép cả hai bản chất cùng tồn tại" (instability risk)
└── Player chọn

Scene 3 — "Kết quả" (resolution, chỉ nếu chấp nhận):
├── Skill hoàn thành mutation → tên mới, mechanic mới
├── Writer mô tả skill mới
└── Cảm giác: tiến hóa, không phải mất mát
```

### 4.5 Mutation Decision Outcomes

```python
def resolve_mutation_choice(player, skill_id, choice):
    if choice == "accept":
        # Skill mutates to match current identity
        new_skill = _ai_generate_mutated_skill(
            original=player.get_skill(skill_id),
            current_identity=player.identity.current,
            mutation_type=_determine_mutation_type(player),
        )
        player.replace_skill(skill_id, new_skill)
        player.skill_evolution.mutations_done += 1
    
    elif choice == "resist":
        # Player fights mutation — stability trial
        # Success: skill stays, instability -20, coherence +10
        # Failure: mutation happens anyway (rare, dramatic)
        trial_result = _stability_trial(player)
        if trial_result.success:
            player.identity.instability -= 20
            player.identity.coherence += 10
        else:
            # Forced mutation — narrative weight
            _force_mutation(player, skill_id)
    
    elif choice == "hybrid":
        # Risky: skill tries to hold both natures
        # High instability cost, but skill becomes dual-nature
        if player.identity.instability + 15 > 100:
            _force_mutation(player, skill_id)  # Too unstable, collapses
        else:
            player.identity.instability += 15
            new_skill = _ai_generate_hybrid_skill(
                original=player.get_skill(skill_id),
                current_identity=player.identity.current,
                latent_identity=player.identity.latent,
            )
            player.replace_skill(skill_id, new_skill)
            player.skill_evolution.mutations_done += 1
```

### 4.6 AI Skill Mutation Prompt

```
Tạo MUTATED SKILL dựa trên identity drift.

## Original Skill:
{original_skill.json}

## Player Identity (current vs seed):
Seed: {seed_identity}
Current: {current_identity}
Drift direction: {drift_analysis}

## Mutation Type: {inversion/corruption/purification/hybridization}

## Quy tắc:
1. Skill MỚI phải phản ánh identity HIỆN TẠI, không phải seed
2. Tên mới — liên quan nhưng KHÁC bản chất
3. Mechanic: biến đổi từ gốc, không hoàn toàn mới
4. Giữ cùng Tier (Tier 1 → Tier 1, Tier 2 → Tier 2)
5. Constraint có thể thay đổi (nhưng tổng power tương đương)
6. Player phải cảm thấy "tiến hóa" chứ không phải "mất mát"

## Output JSON:
{
  "name": "Tên skill mới",
  "principle": "Principle mới (nếu thay đổi)",
  "mechanic": "Mechanic mới",
  "limitation": "Constraint mới",
  "weakness": "Weakness mới",
  "mutation_narrative": "1 câu giải thích vì sao skill đổi"
}
```

### 4.6.1 AI Hybrid Skill Prompt

> Dùng khi player chọn **"hybrid"** trong mutation decision. Khác với mutation type "hybridization" — đây là player forced dual-nature.

```
Tạo HYBRID SKILL — giữ cả bản chất cũ VÀ mới.

## Original Skill:
{original_skill.json}

## Player Identity:
Current: {current_identity}
Latent: {latent_identity}

## Quy tắc:
1. Skill PHẢI phản ánh CẢ HAI identity (current + latent)
2. Tên: phản ánh dual-nature (VD: "Matter-Flux Adaptive Shield")
3. Mechanic: kết hợp gốc + yếu tố mới, tạo dual behavior
4. Giữ cùng Tier
5. Constraint: TĂNG (hybrid = mạnh nhưng phức tạp hơn, instability risk)
6. Weakness: dễ bị disrupt vì bản chất nội tại xung đột

## Output JSON:
{
  "name": "Tên skill hybrid",
  "principle_primary": "Principle gốc",
  "principle_secondary": "Principle mới từ latent",
  "mechanic": "Mechanic kép",
  "limitation": "Constraint (nặng hơn gốc)",
  "weakness": "Dual-nature instability weakness",
  "hybrid_narrative": "1 câu giải thích dual-nature"
}
```

### 4.7 Limits

| Quy tắc | Giá trị |
|---------|--------|
| Max mutations per character | **3** (across all normal skills) |
| Coherence to trigger | **< 30** (strict less than, coherence=30 KHÔNG trigger) |
| Instability to trigger | **> 70** (strict greater than, instability=70 KHÔNG trigger) |
| Rank requirement | **None** (can happen any time) |
| Unique skills? | **NO** — unique skill mutation is in UNIQUE_SKILL_GROWTH_SPEC |
| Player agency? | **YES** — always a choice (accept/resist/hybrid) |

---

## 5. Evolution Path 3: Integration — "Hợp nhất"

### 5.1 Concept

2 skills cùng principle domain → **merge** thành 1 skill tier cao hơn. Player chủ động chọn tại rest scenes.

> Cảm giác: "Hai kỹ năng riêng lẻ đã tìm được nhau — và trở thành một thứ mạnh hơn."

### 5.2 Trigger

```python
def check_integration_eligible(player) -> list[tuple[str, str]]:
    """Trả về list pairs (skill_a, skill_b) có thể integrate."""
    if player.progression.current_rank < ProgressionRank.STABILIZED:
        return []  # Rank 3+ required
    if player.skill_evolution.integrations_done >= 2:
        return []  # Max 2
    
    eligible_pairs = []
    skills = [s for s in player.equipped_skills if not s.is_unique]
    
    for i, a in enumerate(skills):
        for b in skills[i+1:]:
            # Must share at least 1 principle
            shared = set(a.principles) & set(b.principles)
            if not shared:
                continue
            # Both used 5+ times
            if (player.progression.skill_usage.get(a.id, 0) >= 5 and
                player.progression.skill_usage.get(b.id, 0) >= 5):
                eligible_pairs.append((a.id, b.id))
    
    return eligible_pairs
```

### 5.3 Integration Rules

| Input | Output | Ví dụ |
|---|---|---|
| 2× Tier 1 (same principle) | 1× Tier 2 (same principle, enhanced) | Energy Burst + Energy Shield → Kinetic Field (Energy, Tier 2) |
| 2× Tier 1 (shared principle) | 1× Tier 2 (dual principle) | Matter Shield + Energy Pulse → Kinetic Barrier (Matter-Energy, Tier 2) |
| Tier 1 + Tier 2 (shared) | 1× Tier 2 enhanced (constraint nới) | Entropy Shred (T1) + Chaos Surge (T2, Entropy-Flux) → Enhanced Chaos Surge (constraint -1) |
| 2× Tier 2 | 1× Tier 3 (rare augmented) — **Rank 4+ only** | Order Bind (T2) + Void Anchor (T2) → Reality Lock (T3, Order-Void-Matter) |

### 5.4 Integration Process

```python
def perform_integration(player, skill_a_id, skill_b_id):
    skill_a = player.get_skill(skill_a_id)
    skill_b = player.get_skill(skill_b_id)
    
    # Calculate output tier
    if skill_a.tier == 1 and skill_b.tier == 1:
        output_tier = 2
    elif skill_a.tier <= 2 and skill_b.tier <= 2:
        if max(skill_a.tier, skill_b.tier) == 2:
            output_tier = 2  # Enhanced (constraint reduced)
            if min(skill_a.tier, skill_b.tier) == 2:
                # RANK 4+ GATE: T2+T2→T3 requires Transcendent rank
                if player.progression.current_rank < ProgressionRank.TRANSCENDENT:
                    return None  # Not high enough rank for T3 output
                output_tier = 3  # Both T2 → T3
    
    # Merge principles
    all_principles = list(set(skill_a.principles + skill_b.principles))
    
    # AI generates integrated skill
    new_skill = _ai_generate_integrated_skill(
        skill_a=skill_a,
        skill_b=skill_b,
        output_tier=output_tier,
        merged_principles=all_principles,
    )
    
    # Remove both, add new — player loses 1 slot (net: 2 removed, 1 added)
    # Empty slot can only be filled by story discovery, floor reward, or lore find
    player.remove_skill(skill_a_id)
    player.remove_skill(skill_b_id)
    player.add_skill(new_skill)
    
    player.skill_evolution.integrations_done += 1  # Track on SkillEvolutionState
    
    return new_skill
```

> **Post-Integration:** Player mất 1 equipped slot (2 skills → 1). Slot trống chỉ có thể fill qua story discovery, floor reward, hoặc lore find — KHÔNG có inventory/shop.

### 5.5 Integration Narrative (1 scene)

```
Rest scene — Player chọn Integration:
├── beat_type: "rest"
├── Player tập trung, 2 skills bắt đầu resonance
├── Writer: "Hai sức mạnh quen thuộc — [skill_a] và [skill_b] — bắt đầu 
│   cộng hưởng. Ranh giới giữa chúng mờ đi..."
├── New skill formed → Writer mô tả
└── "Bạn mất [skill_a] và [skill_b]. Nhưng [new_skill] mạnh hơn cả hai."
```

### 5.6 Limits

| Quy tắc | Giá trị |
|---------|--------|
| Max integrations per character | **2** |
| Rank requirement | **Rank 3+** (Stabilized) |
| Min uses per skill | **5** each |
| Must share principle? | **Yes** — at least 1 shared |
| Tier 3 output | **Rank 4+ only** (rare) |
| Player agency | **Yes** — player initiates at rest scene |
| Mất 2 skills, được 1 | **Yes** — trade-off rõ ràng |

---

## 6. Evolution Path 4: Awakening — "Thức tỉnh"

### 6.1 Concept

Khi player trải qua **Affinity Awakening** event → skills tương thích nhận thêm nguyên lý mới. Đây là evolution bị động — xảy ra tự động khi affinity awakens.

> Cảm giác: "Nguyên lý mới thức tỉnh bên trong bạn — và kỹ năng cũ phản ứng."

### 6.2 Affinity Awakening Recap (từ POWER_SYSTEM_SPEC)

```
Player profile → core affinities (từ quiz/Soul Forge):
├── Core Affinity: principle chính (VD: Entropy)
└── Latent Affinity: principle ẩn, chưa kích hoạt (VD: Flux)

Khi Rank 3-4 + narrative event:
├── Latent Affinity AWAKENS
├── Player giờ có 2 affinities
└── Skills có thể nhận awakened principle
```

### 6.3 Skill Compatibility Check

```python
def get_awakening_candidates(player) -> list[str]:
    """Skills có thể nhận awakened principle."""
    if not player.progression.affinity_awakened:
        return []
    
    awakened = player.identity.awakened_affinity  # VD: "flux"
    candidates = []
    
    for skill in player.equipped_skills:
        if skill.is_unique:
            continue  # Unique skill awakening is separate
        
        # Check principle compatibility
        # get_principle_interaction returns PrincipleInteraction object
        # Adjacent principles → .interaction == InteractionType.SYNERGY
        interaction = get_principle_interaction(
            skill.primary_principle, awakened
        )
        if interaction.interaction == InteractionType.SYNERGY:  # Adjacent = compatible
            candidates.append(skill.id)
    
    return candidates
```

### 6.4 Compatibility Matrix

```
AWAKEN w/ → ORDER   ENTROPY   MATTER   FLUX   ENERGY   VOID
──────────────────────────────────────────────────────────
ORDER       —       ❌ oppose  ✅ adj    ❌      ✅ adj   ❌
ENTROPY     ❌ opp   —        ❌        ✅ adj  ❌       ✅ adj
MATTER      ✅ adj   ❌        —        ❌ opp  ✅ adj   ❌
FLUX        ❌       ✅ adj    ❌ opp    —      ❌       ✅ adj
ENERGY      ✅ adj   ❌        ✅ adj    ❌      —       ❌ opp
VOID        ❌       ✅ adj    ❌        ✅ adj  ❌ opp   —

✅ adj = Adjacent/Compatible → can awaken
❌ opp = Opposite → cannot awaken (conflict)
❌ = Non-adjacent → cannot awaken
```

### 6.5 Awakening Effects

| Skill Type | Awakening Effect | Ví dụ |
|---|---|---|
| Tier 1 (single principle) | Adds secondary principle → behaves like Tier 2 | Energy Burst + Flux awakening → Energy-Flux Burst (adaptive range) |
| Tier 2 (dual principle) | Third principle enhances existing → constraint giảm | Order-Energy Shield + Matter awakening → Shield gains physical resistance |
| Tier 3 | No change (already complex enough) | — |

### 6.6 Awakening Narrative (1 scene, embedded in Affinity Awakening arc)

```
During Affinity Awakening arc:
├── Scene X: Player's latent affinity awakens (identity event)
├── Immediate: engine checks compatible skills
├── Compatible skills "react" — Writer mentions them responding
└── Writer: "[Skill] rung lên — nguyên lý [awakened] cộng hưởng 
    với nó, mở ra khả năng mới."
```

### 6.7 Limits

| Quy tắc | Giá trị |
|---------|--------|
| Max skills awakened | **All compatible** (no limit on how many) |
| Rank requirement | **Rank 3-4** (when Affinity Awakening happens) |
| Player agency | **No** — automatic for compatible skills |
| Opposite principles | **Cannot awaken** (Energy skill + Void awaken = incompatible) |
| Power increase | **Moderate** — adds flexibility, not raw power |

---

## 7. Resonance Mastery — "Tinh thông cộng hưởng"

### 7.1 Concept (Trục 3)

Resonance grow tự nhiên qua combat. Personal Cap Training mở rộng giới hạn. Đây là progression **ẩn** — player cảm nhận mạnh hơn mà không thấy số thay đổi.

### 7.2 Resonance Growth (automatic)

```python
def update_resonance_after_combat(player, skill_used, outcome):
    """Called after each combat phase."""
    principle = skill_used.primary_principle
    
    # Growth based on outcome
    delta = {"favorable": 0.03, "mixed": 0.02, "unfavorable": 0.01}[outcome]
    
    # Floor cap
    floor_cap = get_floor_resonance_cap(player.current_floor)
    # Floor 1: 0.5, Floor 2: 0.7, Floor 3: 0.85, Floor 4: 0.95, Floor 5: 1.0
    
    # Personal cap bonus (from training)
    effective_cap = min(1.0, floor_cap + player.progression.personal_cap_bonus)
    
    player.resonance[principle] = min(
        effective_cap,
        player.resonance[principle] + delta
    )
    
    # Slow decay for unused principles
    for other in ALL_PRINCIPLES:
        if other != principle:
            player.resonance[other] = max(
                0.1,  # Minimum floor
                player.resonance[other] - 0.005
            )
```

### 7.3 Personal Cap Training

4 loại training, mỗi loại tăng một aspect khác nhau:

#### 7.3.1 Stability Trial

```python
class StabilityTrial(BaseModel):
    conflicting_uses: int = 0   # Lần dùng 2 opposing principles mà không backlash

def check_stability_trial(player, skill_used, scene_result, tracker):
    # Track: dùng principle xung đột mà không backlash
    if _is_conflicting_use(player, skill_used) and not scene_result.backlash:
        tracker.conflicting_uses += 1
    
    if tracker.conflicting_uses >= 5:
        player.progression.personal_cap_bonus += 0.1
        player.progression.stability_trials_passed += 1
        tracker.conflicting_uses = 0  # Reset for next trial
        return True
    return False
```

> **`_is_conflicting_use()` definition:** Using a skill whose principle has both itself AND its opposite with resonance ≥ 0.2 (non-trivial threshold). This means the player is actively maintaining two opposing forces.

| Training | Điều kiện | Kết quả | Max lần |
|----------|-----------|---------|---------|
| **Stability Trial** | Dùng 2 opposing principles 5 lần mà không backlash | Personal cap +0.1 | 3 lần (total +0.3) |
| **Overdrive Control** | Dùng Overdrive 3 lần thành công (không misfire) | Overdrive backlash risk -5% | 2 lần (total -10%) |
| **Floor Attunement** | Clear floor boss lần đầu | Floor-specific resonance +0.1 | 1 per floor |
| **Dual Mastery** | Duy trì dual-principle stable qua boss fight | Resonance min threshold +0.05 cho cả 2 | 2 lần |

#### 7.3.2 Training Narrative

```
Training completions → Writer mentions growth in prose:

Stability Trial: "Hai nguyên lý xung đột giờ đây cùng tồn tại trong bạn 
                  một cách hài hòa. Giới hạn đã nới lỏng."

Overdrive Control: "Giới hạn không còn đáng sợ. Bạn đã biết cách bước qua 
                    mà không bị nuốt chửng."

Floor Attunement: "Thực tại tầng này đã in dấu lên bạn. Cộng hưởng ở đây 
                   tự nhiên hơn."

Dual Mastery: "Hai nguyên lý hòa nhập — không còn xung đột. Chúng flow 
               cùng nhau."
```

### 7.4 Resonance Visibility

| Rank | Player thấy gì |
|------|----------------|
| Rank 1 | Chỉ qua prose: "Entropy cộng hưởng mạnh" |
| Rank 2+ | Relative bars: ████░░░░ cho mỗi principle đã dùng |
| Raw numbers | **KHÔNG BAO GIỜ** (backend only: 0.0-1.0) |

---

## 8. Evolution Interaction Rules

### 8.1 Có thể xảy ra cùng lúc?

```
Refinement + Mutation:
├── CÓ THỂ — skill đã refine vẫn có thể mutate
└── Nếu mutate: refinement effect MẤT (skill mới, constraint mới)

Refinement + Integration:
├── CÓ THỂ — refined skill vẫn merge được
└── Skill mới GIỮA refinement effect (nới constraint đã refine)

Mutation + Integration:
├── KHÔNG — skill đang mutation arc không thể merge
└── Phải hoàn thành mutation trước

Awakening + bất kỳ:
├── CÓ THỂ — awakening là additive, không conflict
└── Awakened skill vẫn có thể refine/mutate/integrate sau
```

### 8.2 Evolution Priority khi nhiều trigger cùng lúc

```python
EVOLUTION_PRIORITY = {
    "mutation": 1,      # Highest — identity crisis takes precedence
    "integration": 2,   # Player-initiated, can wait
    "refinement": 3,    # Passive, can wait  
    # NOTE: "awakening" is NOT in priority list — it's event-driven,
    # embedded within Affinity Awakening arc, and does NOT consume
    # the "1 evolution per chapter" slot. Multiple skills can awaken
    # simultaneously as part of the same affinity event.
}
# Engine xử lý 1 evolution per chapter maximum
# (Awakening is exempt — see note above)
```

### 8.3 Evolution × Rank Gate

| Evolution | Rank Min | Lý do |
|-----------|----------|-------|
| Refinement | 1 | Accessible early — first progression feel |
| Mutation | None* | Identity drift doesn't care about rank |
| Integration | 3 | Need enough skills + mastery first |
| Awakening | 3-4 | Tied to Affinity Awakening event |

\* Mutation CÓ THỂ xảy ra bất cứ lúc nào nếu identity drift đủ. Nhưng thực tế drift đủ mạnh thường ở Ch 15+ (tương đương Rank 2-3).

---

## 9. Data Models

```python
# app/models/skill_evolution.py [NEW]

from enum import Enum
from pydantic import BaseModel, Field

class EvolutionType(str, Enum):
    REFINEMENT = "refinement"
    MUTATION = "mutation"
    INTEGRATION = "integration"
    AWAKENING = "awakening"

class MutationType(str, Enum):
    INVERSION = "inversion"          # Principle đổi sang đối diện
    CORRUPTION = "corruption"        # Mạnh hơn + thêm backlash
    PURIFICATION = "purification"    # Constraint giảm + weakness giảm
    HYBRIDIZATION = "hybridization"  # Thêm latent principle

class MutationChoice(str, Enum):
    ACCEPT = "accept"
    RESIST = "resist"
    HYBRID = "hybrid"


class SkillEvolutionState(BaseModel):
    """Tracks all normal skill evolution for a player.
    
    CANONICAL SOURCE OF TRUTH for skill evolution data.
    PlayerProgression (PROGRESSION_SYSTEM_SPEC) may reference these fields
    but SkillEvolutionState is authoritative.
    """
    player_id: str
    
    # Refinement
    # NOTE: stores int (successful_uses count). identity_alignment is computed
    # on-the-fly via _calc_skill_identity_alignment() — not stored.
    refinement_trackers: dict[str, int] = Field(default_factory=dict)  # skill_id: successful_uses
    refinements_done: list[str] = Field(default_factory=list)  # skill_ids refined (max 2, each skill once)
    
    # Mutation
    mutations_done: int = 0                    # Max 3
    mutation_in_progress: str | None = None    # skill_id currently mutating
    mutation_arc_scene: int = 0                # 0 = not started, 1-3 = scene in arc
    
    # Integration
    integrations_done: int = 0                 # Max 2
    
    # Awakening
    awakened_skills: list[str] = Field(default_factory=list)  # skill_ids that received awakened principle
    
    # Per-chapter limit (enforces 1 evolution per chapter max, except Awakening)
    last_evolution_chapter: int = 0             # Last chapter where evolution triggered


class ResonanceMasteryState(BaseModel):
    """Tracks resonance training progress.
    
    NOTE: Per-principle resonance values are stored in PlayerState.resonance,
    NOT duplicated here. This model only tracks training milestones.
    """
    player_id: str
    
    # Personal Cap Training
    personal_cap_bonus: float = 0.0            # Total bonus from training (max +0.3)
    stability_trials_passed: int = 0           # Max 3
    stability_trial_tracker: int = 0           # Current conflicting uses count
    
    overdrive_risk_reduction: float = 0.0      # Total reduction (max -10%)
    overdrive_successes: int = 0               # Cumulative count (total, not streak). Trigger at 3.
    
    floor_attunements: list[int] = Field(default_factory=list)  # Floors attuned
    
    dual_masteries: list[str] = Field(default_factory=list)  # "energy-matter" etc.
    dual_mastery_count: int = 0                # Max 2


class SkillEvolutionEvent(BaseModel):
    """Log entry for evolution events."""
    event_type: EvolutionType
    skill_id: str
    chapter: int
    scene: int
    
    # Refinement
    constraint_changed: str = ""               # "range" | "cooldown" | "cost" | etc.
    
    # Mutation
    mutation_type: MutationType | None = None
    player_choice: MutationChoice | None = None
    original_name: str = ""
    new_name: str = ""
    
    # Integration
    merged_from: list[str] = Field(default_factory=list)  # 2 skill_ids merged
    result_skill_name: str = ""
    result_tier: int = 0
    
    # Awakening
    awakened_principle: str = ""
```

---

## 10. Engine Integration

### 10.1 Evolution Check (per scene)

```python
def check_skill_evolution(player, scene_result) -> SkillEvolutionEvent | None:
    """Called after every scene. Lightweight, no LLM needed for check.
    
    Enforces: 1 evolution per chapter maximum (except Awakening).
    Tracks usage per combat PHASE (not per scene) for accuracy.
    """
    evolution = player.skill_evolution
    
    # Track skill usage — per combat phase for accuracy
    if hasattr(scene_result, 'combat_phases'):
        for phase in scene_result.combat_phases:
            if phase.skill_used and phase.outcome != "unfavorable":
                current = evolution.refinement_trackers.get(phase.skill_used, 0)
                evolution.refinement_trackers[phase.skill_used] = current + 1
    elif scene_result.skill_used and scene_result.outcome != "unfavorable":
        current = evolution.refinement_trackers.get(scene_result.skill_used, 0)
        evolution.refinement_trackers[scene_result.skill_used] = current + 1
    
    # Priority 1: Mutation (identity crisis)
    if evolution.mutation_in_progress is not None:
        return None  # Mutation arc in progress — block all other evolutions
    
    candidate = check_skill_mutation(player)
    if candidate:
        evolution.mutation_in_progress = candidate
        evolution.mutation_arc_scene = 1
        return SkillEvolutionEvent(
            event_type=EvolutionType.MUTATION,
            skill_id=candidate,
            chapter=scene_result.chapter,
            scene=scene_result.scene,
        )
    
    # Priority 2: Refinement
    for skill in player.equipped_skills:
        if skill.is_unique:
            continue
        uses = evolution.refinement_trackers.get(skill.id, 0)
        if check_refinement(player, skill, uses):
            return SkillEvolutionEvent(
                event_type=EvolutionType.REFINEMENT,
                skill_id=skill.id,
                chapter=scene_result.chapter,
                scene=scene_result.scene,
            )
    
    # Awakening: event-driven (when affinity_awakened flag changes)
    #   → exempt from 1-per-chapter limit
    # Integration: player-initiated only (at rest scenes)
    
    return None
```

### 10.2 Planner Integration

```python
EVOLUTION_BEATS = {
    EvolutionType.REFINEMENT: {
        "beat_type": "rest",
        "description": "Skill refinement: constraint nới lỏng",
        "scenes_needed": 1,
        "priority": "medium",
    },
    EvolutionType.MUTATION: {
        "beat_type": "discovery",
        "description": "Skill mutation arc: identity crisis affects skill",
        "scenes_needed": 3,  # 2-3 scenes
        "priority": "critical",
    },
    EvolutionType.INTEGRATION: {
        "beat_type": "rest",
        "description": "Skill integration: player merges 2 skills at rest",
        "scenes_needed": 1,
        "priority": "medium",
    },
    EvolutionType.AWAKENING: {
        "beat_type": "discovery",
        "description": "Skill awakening: piggybacks on affinity event",
        "scenes_needed": 0,  # Part of affinity arc
        "priority": "low",  # Auto, embedded in affinity scenes
    },
}
```

### 10.3 Writer Context

```python
skill_evolution_context = {
    "equipped_skills": [s.dict() for s in player.equipped_skills],
    "recent_evolution": evolution.last_event.dict() if evolution.last_event else None,
    "resonance_descriptors": {
        principle: _resonance_to_prose(value)
        for principle, value in player.resonance.items()
        # VD: 0.8 → "cộng hưởng mạnh", 0.3 → "cộng hưởng yếu"
    },
    "instruction": (
        "Mô tả skills ở trạng thái hiện tại. "
        "Nếu có recent_evolution, mention sự thay đổi trong prose. "
        "Resonance descriptions phải tự nhiên, không nói số."
    ),
}
```

---

## 11. Phase 1 Scope

### Must-Have

| Component | Chi tiết |
|-----------|----------|
| SkillEvolutionState model | Data tracking for all 4 paths |
| ResonanceMasteryState model | Resonance + training tracking |
| Refinement (full) | 8 uses + alignment → constraint nới |
| Resonance growth (automatic) | Post-combat resonance update |
| Floor Attunement | Clear boss → floor resonance +0.1 |
| Evolution check per scene | Lightweight engine check |
| Refinement tracker | Count successful uses per skill |
| Evolution → Planner flags | Beat generation for arcs |
| Resonance → Writer context | Prose descriptions of resonance |

### Defer to Phase 2

| Component | Phase |
|-----------|-------|
| Mutation full system | Phase 2 (needs rich identity drift) |
| Integration full system | Phase 2 (needs Rank 3 + enough skills) |
| Awakening full system | Phase 2 (needs Affinity Awakening) |
| AI-generated mutated skills | Phase 2 (complex LLM pipeline) |
| AI-generated integrated skills | Phase 2 (complex LLM pipeline) |
| Stability Trial training | Phase 2 (needs opposing principle combat) |
| Overdrive Control training | Phase 2 (needs Overdrive system) |
| Dual Mastery training | Phase 2 (needs dual-principle combat) |

---

## 12. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| Max 2 Refinements per character | Progression feel mà không phá balance |
| Max 3 Mutations per character | Mutation là drama lớn, không spam |
| Max 2 Integrations per character | Mất 2 skills/lần → limit meaningful |
| Mutation = player choice (accept/resist/hybrid) | Agency trong identity crisis |
| Integration = player-initiated at rest | Deliberate choice, không forced |
| Awakening = auto (no choice) | Thematic — nguyên lý thức tỉnh tự nhiên |
| 1 evolution per chapter max (trừ Awakening) | Pacing control (Awakening exempt vì event-driven) |
| AI-generated skills phải cùng Tier | Power balance |
| Resonance numbers hidden from player | Mystery preserved |
| Personal cap max +0.3 from training | Soft ceiling, không infinite growth |
| Floor resonance cap system intact | Soft cap structure maintained |

---

## Appendix: Complete Skill Evolution Journey (Example)

```
Chapter 1-3:
├── Player receives 3 Tier 1 skills: Energy Burst, Matter Shield, Order Bind
├── Unique Skill: "Vết Nứt Sự Thật" (from Soul Forge)
├── Resonance starts at 0.25 for each principle used
└── Using Energy Burst → Energy resonance grows

Chapter 8-10:
├── Energy Burst: 8 successful uses + 0.65 Energy resonance
├── REFINEMENT triggered: "Energy Burst cooldown 3 → 2 chapters"
├── Narrative: "Năng lượng phản ứng nhanh hơn với mệnh lệnh của bạn."
└── Refinement #1 of 2 used

Chapter 12 - Rank 2 (Resonant):
├── 4th skill slot unlocks
├── Receives "Flux Disruption" (Tier 1) from story
├── Now: Energy Burst*, Matter Shield, Order Bind, Flux Disruption
└── (* = refined)

Chapter 15-18 - Floor 2:
├── Floor 1 boss cleared → Floor Attunement (Energy +0.1)
├── Energy resonance now ~0.55 (approaching F2 cap 0.7)
├── Identity: coherence dropping (player behaviour changing)
└── Instability rising: 45 → 65

Chapter 20-23 - Identity Crisis:
├── Instability hits 72, coherence drops to 28
├── Matter Shield: most misaligned with current identity
├── MUTATION triggered: "Matter Shield behaves wrong"
├── Story arc: 3 scenes of identity confrontation
├── Player ACCEPTS mutation
├── Matter Shield → "Flux Barrier" (Matter→Flux, Inversion type)
├── Narrative: "Sự ổn định không còn là bản chất bạn. Giờ bạn CHẢY."
└── Mutation #1 of 3 used

Chapter 25 - Rank 3 (Stabilized):
├── Integration unlock
├── Energy Burst* (T1, Energy) + Flux Disruption (T1, Flux)
├── Share no principle → CANNOT integrate
├── Energy Burst* + Flux Barrier (T1, Flux) → share NOTHING → cannot
├── Hmmm... player needs compatible skills
├── Receives "Energy Wave" (T1, Energy) from Floor 2 reward
└── Energy Burst* (T1, Energy) + Energy Wave (T1, Energy) → CAN integrate!

Chapter 28 - Integration:
├── Player chooses Integration at rest scene
├── Energy Burst* + Energy Wave → "Kinetic Storm" (T2, Energy, enhanced)
├── Narrative: "Hai luồng năng lượng hòa làm một..."
└── Integration #1 of 2 used  

Chapter 32 - Affinity Awakening:
├── Latent Affinity: Entropy → AWAKENS
├── Compatible skills checked:
│   Kinetic Storm (Energy) + Entropy → Adjacent ✅
│   Flux Barrier (Flux) + Entropy → Adjacent ✅
│   Order Bind (Order) + Entropy → Opposite ❌
├── Kinetic Storm gains Entropy component → destructive energy
├── Flux Barrier gains Entropy component → adaptive decay shield
└── Order Bind: unchanged

Chapter 40+ (Season Climax):
├── Skills: Kinetic Storm (T2, Energy-Entropy), Flux Barrier (T1, Flux-Entropy),
│   Order Bind (T1, Order), Unique: "Phá Chấp" (Aspect Forge)
├── "Phá Chấp" absorbs Kinetic Storm → ULTIMATE: "Thiên Nhãn — Chúa Tể Sự Thật"
├── Lost 1 skill slot (Kinetic Storm absorbed)
└── Final: Flux Barrier, Order Bind, UNIQUE: Thiên Nhãn — Chúa Tể Sự Thật
```

---

## Appendix B: Changelog

### v1.1 (2026-02-28) — Audit-synced

- **FIXED:** `check_refinement()` signature — was `tracker: RefinementTracker` (object), now `successful_uses: int` matching `SkillEvolutionState.refinement_trackers` storage.
- **NEW:** `_calc_skill_identity_alignment()` — defined formula for skill-identity alignment (was undefined in v1.0).
- **FIXED:** `SkillEvolutionState` declared as canonical source of truth for `refinements_done`, `mutations_done`, `integrations_done`. `PlayerProgression` (PROGRESSION_SYSTEM_SPEC) references only.
- **FIXED:** Rank 4 gate for T2+T2→T3 integration — was in comment only, now enforced in `perform_integration()` code.
- **FIXED:** §6.3 `get_awakening_candidates()` — `interaction.compatibility in ["synergy", "adjacent"]` → `interaction == InteractionType.SYNERGY`. `"adjacent"` was never a valid `InteractionType` enum value.
- **FIXED:** Mutation boundary — code now uses strict `coherence >= 30` / `instability <= 70` (return None), matching table's `< 30` / `> 70` intent.
- **NEW:** §4.6.1 AI Hybrid Skill Prompt — template for `_ai_generate_hybrid_skill()` (distinct from hybridization mutation type).
- **CHANGED:** §10.1 engine — tracks usage per combat phase (not per scene), blocks all evolutions during active mutation arc.
- **CHANGED:** §8.2 — Awakening removed from priority list; exempt from "1 evolution per chapter" limit (event-driven, embedded in affinity arc).
- **CHANGED:** §5.4 `integrations_done` tracked on `player.skill_evolution` (not `player.progression`).
- **CHANGED:** `overdrive_success_streak` → `overdrive_successes` (cumulative, not streak).
- **ADDED:** §3.5 — "Each skill refined max: 1 lần" explicit in Limits table.
- **ADDED:** Post-integration slot behavior note.
- **FIXED:** Appendix — "Flux Barrier (T1, Flux-Matter)" → "(T1, Flux)" (mutation keeps same tier, single principle).
- **UPDATED:** Dependencies — COMBAT_SYSTEM_SPEC v1.1 → v2.0.
- **FIXED (re-audit):** §4.2, §4.5: `player.progression.mutations_done` → `player.skill_evolution.mutations_done` (3 places).
- **FIXED (re-audit):** §5.2: `player.progression.integrations_done` → `player.skill_evolution.integrations_done`.
- **FIXED (re-audit):** §12: "1 evolution per chapter max" → "(trừ Awakening)" to match §8.2 exemption.
