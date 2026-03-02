# ⚔️ AMOISEKAI — Combat System Specification v2.0

> **Author:** Amo  
> **Date:** 2026-02-25  
> **Status:** Formalized + V2 Unique Skill Integration  
> **Dependencies:** GDD v1.0, POWER_SYSTEM_SPEC, SOUL_FORGE_SPEC, SEASON_1_UNIQUE_SKILL_SPEC  
> **Source Drafts:** COMBAT SYSTEM v1 (Boss-Centric), COMBAT DECISION MODEL v1, COMBAT LÀ CORE LOOP, COMBAT PACING SPEC v1, COMBAT ROADMAP PvE→PvP, DETERMINISTIC CORE + PSYCHOLOGICAL LAYER
> 
> **v1.1 Change:** Replaced round-by-round JRPG model with **Resolution Combat** — narrative-integrated, phase-based combat that fits text-based storytelling format while preserving deterministic core.  
> **v2.0 Change:** Integrated V2 Unique Skill combat system — Domain Authority, Sub-skill evaluation, Unique Clause bonus, Growth Stage scaling. Combat score formula updated to 4-component model with Unique Skill bonus (0-8% cap).

---

## 1. Triết lý chiến đấu

> Combat không phải để farm.  
> Combat là **bài kiểm tra về cấu trúc build**.

**Nguyên tắc cốt lõi:**
- **Combat là core loop** — sân khấu chính, chính trị/xã hội là hệ quả
- **Resolution Model** — engine tính toàn bộ outcome trước, LLM viết prose cinematic từ kết quả
- **Narrative-integrated** — combat là phần của chapter prose, KHÔNG phải minigame riêng
- **Ít quyết định, sâu hệ quả** — 1-3 decision points per encounter, mỗi quyết định ảnh hưởng lớn
- **Stability warfare** — ai mất ổn định trước → thua
- **Duel nhanh, Boss dài** — pacing đa dạng qua số decision points

---

## 2. Combat Structure — 4 trụ cột

### 2.1 Principle Interaction (Khắc chế động)

Không có counter cứng 100%. Thay vào đó là modifier hệ thống:

```python
# 3 loại tác động trong combat
DAMAGE_TYPES = {
    "structural":  ["matter", "energy"],    # Giảm HP
    "stability":   ["entropy", "flux"],      # Giảm Stability bar
    "denial":      ["void"],                 # Stealth, absorption, denial
}
```

**Ví dụ tương tác:**
- `Entropy → Order`: Damage vừa, nhưng **stability drain rất mạnh**
- `Energy → Void`: Năng lượng áp đảo hư không — **reveal + burst**
- `Flux → Matter`: Damage **rất cao** (phase through cấu trúc)

### 2.2 Stability Bar

Ngoài HP, mỗi combatant có **Stability** (thanh ổn định thực tại):

| Stability | Trạng thái |
|-----------|-----------|
| 100-60% | Bình thường |
| 60-30% | Skills dễ misfire, backlash risk tăng |
| 30-10% | Nghiêm trọng — overdrive bị nerf, mutation risk |
| <10% | **Stability Break** — dễ bị 1-shot, forced mutation possible |

> **Core mechanic:** Combat trở thành "ai làm đối thủ mất ổn định trước?"

### 2.3 Overdrive Decision Moment

Trong combat, player có thể đẩy intensity lên **Overdrive**:
- Power tăng **200%**
- Nhưng: instability spike, backlash risk, stability drain tự thân

**Đây là điểm điện ảnh** — moment mà player gamble everything.

### 2.4 Environment Modifier

Combat ở các location khác nhau có modifier khác nhau:

| Location | Buff | Nerf |
|----------|------|------|
| Grand Gate city | Order +20% | Chaos skills -15% |
| Minor Gate | Flux +15% | Stability drain +20% |
| Tower Floor 3 | Entropy +25% | Void -20% |
| Ritual site | All rare +30% | All stability -30% |
| Open world | None | None |

---

## 3. Resolution Combat Model

### 3.1 Tại sao Resolution thay vì Round-by-Round?

| Vấn đề Round-by-Round | Resolution Combat giải quyết |
|------------------------|------------------------------|
| 10+ LLM calls per encounter (~$0.005) | 2-3 LLM calls (~$0.002) |
| 30+ giây latency cho boss fight | 15-20 giây |
| Phá vỡ narrative flow (đọc truyện → bấm 10 lần) | Combat là phần liền mạch của chapter |
| Boss AI: scripted (nhàm) vs LLM (inconsistent) | Engine tính toàn bộ, không cần boss AI |
| Mỗi round cần prose riêng | 1 combat scene hoàn chỉnh, cinematic |

### 3.2 Concept chính

```
Player choice (có combat intent)
     ↓
Combat Engine tính toàn bộ outcome TRƯỚC (1 lần, deterministic)
     ↓
Writer nhận CombatBrief → viết COMBAT PROSE liền mạch trong chapter
     ↓
Player nhận 1-3 DECISION POINTS trong prose (dependent on encounter type)
     ↓
Engine resolve decision → Writer tiếp tục prose
     ↓
Kết quả combat → IdentityDelta
```

### 3.3 Ba lớp quyết định

| Lớp | Ai xử lý | Khi nào | Ví dụ |
|-----|----------|---------|-------|
| **Strategic** (pre-combat) | Player | Chọn approach: aggression + intensity | "Tấn công bằng Entropy Shred, cường độ cao" |
| **Tactical** (mid-combat) | Engine (deterministic) | Tính outcome dựa trên build, resonance, floor | combat_score = 0.65 → favorable |
| **Narrative** (prose) | Writer (LLM) | Mô tả combat scene theo CombatBrief | "Entropy xé qua lớp cấu trúc Order..." |

### 3.4 Player Actions (vẫn giữ 3 Action + 3 Intensity)

Player chọn approach **trước** encounter (hoặc tại decision points):

#### 3 Hành động

| Action | Mục đích | Trong Resolution Combat |
|--------|----------|------------------------|
| **Strike** | Tấn công | Gây damage + stability pressure |
| **Shift** | Thích ứng | Đổi vector, counter phase shift |
| **Stabilize** | Phòng thủ | Hồi stability, setup cho phase sau |

#### 3 Cường độ

| Intensity | Power Mod | Risk | Best for |
|-----------|----------|------|----------|
| **Safe** | ×1.0 | Thấp | Đọc boss pattern |
| **Push** | ×1.5 | Vừa | Sustained pressure |
| **Overdrive** | ×2.0 | Cao | Burst / climax moment |

### 3.5 Chiến lược nằm ở đâu?

Không ở số lượng clicks. Mà ở **5 lớp ngầm** ảnh hưởng combat_score:

```
Layer 1: Resonance alignment — build pre-combat (principle vs enemy principle)
Layer 2: Floor modifier — environment awareness (location matters)
Layer 3: Instability level — quá cao thì overdrive tự backlash
Layer 4: Boss phase — mỗi decision point ở 1 phase, cần đọc pattern
Layer 5: Soft cap overflow — push quá limit có risk thật
```

---

## 4. Encounter Types & Decision Points

### 4.1 Encounter Scaling

| Tình huống | Decision Points | Phases | Combat prose |
|-----------|-----------------|--------|-------------|
| **Minor** (mob, ambush) | 0 | 1-phase auto | ~200 từ (kết quả trong chapter) |
| **Duel** (elite enemy) | 1 | 2-phase | ~500 từ (opening → decision → conclusion) |
| **Boss** (guardian, general) | 2 | 3-phase | ~800-1200 từ (full combat scene) |
| **Season Climax** (final boss) | 3 | 4-phase | ~1500 từ (epic encounter) |

### 4.2 Minor Encounter — 0 Decision Points

Player đã chọn action trước đó (trong chapter choice). Engine auto-resolve:

```
Player choice: "Tấn công nhóm cướp" (risk=2)
   ↓ Engine
CombatBrief: { outcome: "favorable", player_wounded: false, ... }
   ↓ Writer
"Thanh kiếm xé qua bóng tối. Hai tên cướp ngã xuống trước khi 
 chúng kịp rút vũ khí. Tên cuối cùng quay đầu chạy."
   ↓
Tiếp tục chapter bình thường.
```

### 4.3 Duel — 1 Decision Point

```
PHASE 1 — Opening Exchange
├── Engine tính: player vs enemy (based on approach)
├── Writer viết 300 từ combat prose
├── Kết quả: cả hai tổn thương, enemy weakness lộ ra
└── Writer mô tả boss tell / enemy pattern

DECISION POINT ← Player chọn 1 trong 3:
├── 🗡️ Overdrive Strike — "Dồn hết sức, kết thúc ngay" (risk=4)
├── 🔄 Shift + Counter — "Khai thác weakness vừa phát hiện" (risk=2)
└── 🛡️ Stabilize + Wait — "Ổn định, chờ đợi cơ hội chắc chắn" (risk=1)

PHASE 2 — Resolution
├── Engine tính: outcome dựa trên decision + Phase 1 state
├── Writer viết 200 từ kết thúc
└── Combat result → narrative continues
```

### 4.4 Boss — 2 Decision Points

```
PHASE 1 — Structural Test (~300 từ)
├── Engine tính: initial exchange
├── Boss pattern dễ đọc
├── Writer mô tả boss mechanics
└── Player bắt đầu hiểu boss

DECISION POINT 1 ← Player chọn approach cho phase 2:
├── 🗡️ Aggressive Strike — "Tấn công trước khi boss chuyển phase" (risk=3)
├── 🔄 Adaptive Shift — "Chuẩn bị counter boss phase shift" (risk=2)
└── 🛡️ Defensive Stabilize — "Ưu tiên ổn định, đánh lâu dài" (risk=1)

PHASE 2 — Distortion (~400 từ)
├── Boss phase shift → principle dominance thay đổi
├── Player's decision ảnh hưởng outcome Phase 2
├── Instability tăng, áp lực đẩy lên
└── Boss tell cho Phase 3

DECISION POINT 2 ← Player chọn climax approach:
├── 🔥 Overdrive Gamble — "Bùng nổ toàn lực, chấp nhận rủi ro" (risk=5)
├── 🗡️ Calculated Strike — "Tấn công chính xác vào điểm yếu" (risk=3)
└── 🔄 Endurance Play — "Chịu đòn, đợi boss kiệt sức" (risk=2)

PHASE 3 — Reality Pressure (~300 từ)
├── Climax — resolution dựa trên toàn bộ combat state
├── Soft cap lore flavor
├── Boss final form or defeat
└── Combat result → major narrative impact
```

### 4.5 Boss Phase Template (3 pha chuẩn)

```
Phase 1 — Structural (Test cơ bản)
├── Test damage output
├── Test principle interaction  
├── Boss pattern dễ đọc
└── Player học boss mechanics

Phase 2 — Distortion (Pressure tăng)
├── Boss principle shift
├── Floor modifier thay đổi
├── Instability aura tăng  
└── Ép player adapt

Phase 3 — Reality Pressure (Climax)
├── Soft cap strain (floor_cap × 0.8)
├── Boss overdrive — final form
├── Stability drain cực cao
└── Resolution — decisive outcome
```

### 4.6 Gradual Complexity (Theo Floor)

| Floor | Boss | Phases | Decision Points |
|-------|------|--------|-----------------|
| Floor 1 | 2 phases | Structural → simple climax | 1 |
| Floor 2 | 3 phases | Full template | 2 |
| Floor 3 | 3 phases + rare hint | Rare principle introduced | 2 |
| Floor 4 | 3 phases + full rare | Advanced interactions | 2-3 |
| Floor 5 | 4 phases + mythic | Season climax | 3 |

---

## 5. Boss Design Framework

### 5.1 Boss Data Model

```json
{
  "boss_id": "floor_2_guardian",
  "name": "Trấn Giới Hộ Pháp",
  "floor": 2,
  "primary_principle": "order",
  "secondary_principle": "energy",
  
  "phases": [
    {
      "phase": 1,
      "name": "Defensive Structure",
      "hp_threshold": 1.0,
      "dominant_principle": "order",
      "stability_pressure": "low",
      "tell_pattern": "Ánh sáng vàng bao phủ cơ thể"
    },
    {
      "phase": 2,
      "name": "Contract Bind",
      "hp_threshold": 0.6,
      "dominant_principle": "order",
      "stability_pressure": "medium",
      "special": "binding_contract",
      "tell_pattern": "Dây xích ánh sáng xuất hiện"
    },
    {
      "phase": 3,
      "name": "Order Overload",
      "hp_threshold": 0.3,
      "dominant_principle": "order",
      "stability_pressure": "high",
      "special": "anti_flux_aura",
      "environmental_modifier": {"flux": -0.3},
      "tell_pattern": "Không gian đông cứng"
    }
  ],
  
  "stability": 100,
  "resistances": {"entropy": 0.5, "flux": 0.3},
  "weaknesses": {"entropy": 1.5}
}
```

### 5.2 Enemy Types (3 loại)

| Type | Principles | Đặc điểm | Chiến thuật counter |
|------|-----------|----------|---------------------|
| **Structural** | Matter, Energy | Tanky, high HP | Dùng Entropy destabilize |
| **Instability** | Entropy, Flux | Stability shred nhanh | Stabilize thường xuyên, burst nhanh |
| **Denial** | Void | Stealth, denial, absorption | Energy burst reveal, Order pattern |

**Guardian tầng** là mix 2-3 types.

---

## 6. Deterministic Combat Engine

### 6.1 Resolution Engine — Compute phase outcomes

```python
def resolve_combat_phase(
    player: CombatantState,
    enemy: CombatantState,
    player_action: CombatAction,    # strike | shift | stabilize
    player_intensity: Intensity,     # safe | push | overdrive
    player_skill: CombatSkill,
    floor: FloorState,
    boss_phase: BossPhase | None,
) -> PhaseResult:
    """
    Resolve ONE phase of combat. All deterministic.
    Called once per phase, NOT per round.
    LLM NEVER decides outcome — only describes result.
    """

    # 1. Calculate combat score (deterministic baseline)
    combat_score = _compute_combat_score(player, enemy, player_skill, floor)
    
    # 2. Apply action + intensity modifiers
    if player_action == CombatAction.STRIKE:
        power = calculate_power_output(player_skill, player, floor, player_intensity)
        
        # Principle interaction
        interaction = get_principle_interaction(
            player_skill.primary_principle,
            enemy.dominant_principle
        )
        
        structural_dmg = power.structural_damage * interaction.damage_mod
        stability_dmg = power.stability_damage * interaction.stability_mod
        
        # Apply to enemy
        enemy.hp -= structural_dmg
        enemy.stability -= stability_dmg
        
        # Self cost
        player.stability -= player_skill.stability_cost * INTENSITY_COST[player_intensity]
        player.instability += power.instability_gain
        
        # Backlash check
        backlash = None
        if random.random() < power.backlash_probability:
            backlash = _apply_backlash(player)
            
    elif player_action == CombatAction.SHIFT:
        # Adapt to boss phase, reduce incoming damage
        player.active_vector = _resolve_shift(player_skill, floor)
        combat_score += 0.1  # bonus for reading boss pattern
        
    elif player_action == CombatAction.STABILIZE:
        recovery = 15.0 * (1.0 + player.resonance_alignment * 0.5)
        player.stability = min(100, player.stability + recovery)
        player.instability = max(0, player.instability - 5.0)
        combat_score += 0.05  # small bonus (prepared for next phase)
    
    # 3. Enemy counter-attack (deterministic based on boss template)
    enemy_damage = _calc_boss_phase_damage(enemy, boss_phase, player)
    player.hp -= enemy_damage.structural
    player.stability -= enemy_damage.stability_drain
    
    # 4. Phase transition check
    phase_shifted = False
    if boss_phase and enemy.hp / enemy.max_hp <= boss_phase.hp_threshold:
        phase_shifted = True
    
    # 5. End condition checks
    if player.hp <= 0 and player.fate_buffer > 0:
        # Fate Buffer saves: convert death → severe wound  
        player.hp = 10.0
        fate_buffer_triggered = True
    
    # 6. Determine phase outcome
    outcome = "favorable" if combat_score > 0.6 else "mixed" if combat_score > 0.4 else "unfavorable"
    
    return PhaseResult(
        outcome=outcome,
        combat_score=combat_score,
        player_hp=player.hp,
        player_stability=player.stability,
        enemy_hp=enemy.hp,
        enemy_stability=enemy.stability,
        structural_damage_dealt=structural_dmg,
        stability_damage_dealt=stability_dmg,
        backlash=backlash,
        phase_shifted=phase_shifted,
        fate_buffer_triggered=fate_buffer_triggered,
        narrative_cues=_generate_phase_narrative_cues(
            player_action, player_intensity, outcome, backlash, phase_shifted
        ),
    )
```

### 6.2 Combat Score Formula (4-Component Model)

```python
# Weight distribution (must sum to 1.0)
W_BUILD_FIT    = 0.45   # Resonance + principle advantage
W_PLAYER_SKILL = 0.30   # DQS + stability
W_ENVIRONMENT  = 0.15   # Floor bonus + intensity
W_RANDOMNESS   = 0.10   # CRNG + unique skill bonus

# Sub-weights within each category
W_RESONANCE      = 0.25
W_PRINCIPLE_ADV  = 0.20
W_DQS            = 0.20
W_STABILITY      = 0.10
W_FLOOR          = 0.10
W_INTENSITY      = 0.05
W_CRNG           = 0.05
W_UNIQUE         = 0.05   # V2: Unique Skill contribution

def compute_combat_score(
    resonance, metrics, skill, enemy,
    floor=1, intensity=Intensity.SAFE,
    crng_roll=0.5, unique_skill_bonus=0.0,  # V2: 0.0-0.08
) -> float:
    """
    Deterministic combat score — 4-component weighted formula.
    Score ≥ 0.60 → favorable, 0.40-0.60 → mixed, < 0.40 → unfavorable.
    """
    # ── Build Fit (45%) ──
    skill_resonance = avg(resonance.get(p) for p in skill.principles)
    adv_normalized = (interaction.advantage_mod + 0.10) / 0.25  # [-0.10,+0.15] → [0,1]
    build_fit = (
        skill_resonance * (W_RESONANCE / W_BUILD_FIT)
        + adv_normalized * (W_PRINCIPLE_ADV / W_BUILD_FIT)
    )

    # ── Player Skill (30%) ──
    player_skill = (
        metrics.dqs_ratio * (W_DQS / W_PLAYER_SKILL)
        + metrics.stability_ratio * (W_STABILITY / W_PLAYER_SKILL)
    )

    # ── Environment (15%) ──
    floor_bonus = min(1.0, floor / 5.0)
    env = (
        floor_bonus * (W_FLOOR / W_ENVIRONMENT)
        + intensity.bonus / 0.05 * (W_INTENSITY / W_ENVIRONMENT)
    )

    # ── Controlled Randomness (10%) ──
    crng_component = (
        crng_roll * (W_CRNG / W_RANDOMNESS)
        + min(1.0, unique_skill_bonus / 0.08) * (W_UNIQUE / W_RANDOMNESS)
    )                           # ↑ V2: normalized by 0.08 cap

    # ── Weighted sum ──
    raw = (build_fit * W_BUILD_FIT + player_skill * W_PLAYER_SKILL
           + env * W_ENVIRONMENT  + crng_component * W_RANDOMNESS)

    # Threat penalty: higher threat → harder
    final = raw - enemy.threat_level * 0.15 + 0.075
    return clamp(final, 0.0, 1.0)
```

> **V2 Note:** `unique_skill_bonus` (0.0-0.08) is computed by `unique_skill_combat_bonus_v2()` × `activation.effectiveness`. See §6.4.

### 6.3 Full Encounter Flow

```python
def run_resolution_combat(
    player: CombatantState,
    enemy: CombatantState,
    encounter_type: EncounterType,
    floor: FloorState,
    initial_approach: CombatApproach,
) -> CombatBrief:
    """
    Resolve entire encounter. Returns CombatBrief for Writer.
    
    For MINOR: 1 phase, auto-resolve, 0 decision points.
    For DUEL: 2 phases, 1 decision point between phases.
    For BOSS: 3 phases, 2 decision points between phases.
    """
    phases = []
    
    if encounter_type == EncounterType.MINOR:
        # Single phase, auto-resolve
        result = resolve_combat_phase(
            player, enemy, initial_approach.action,
            initial_approach.intensity, initial_approach.skill,
            floor, boss_phase=None
        )
        phases.append(result)
        
    elif encounter_type == EncounterType.DUEL:
        # Phase 1: Opening
        result_1 = resolve_combat_phase(
            player, enemy, initial_approach.action,
            initial_approach.intensity, initial_approach.skill,
            floor, boss_phase=None
        )
        phases.append(result_1)
        
        # Decision Point 1 → player chooses (yielded back to pipeline)
        # Phase 2 resolved after player decision
        
    elif encounter_type == EncounterType.BOSS:
        boss = get_boss_template(enemy.entity_id)
        
        # Phase 1: Structural Test
        result_1 = resolve_combat_phase(
            player, enemy, initial_approach.action,
            initial_approach.intensity, initial_approach.skill,
            floor, boss_phase=boss.phases[0]
        )
        phases.append(result_1)
        
        # Decision Point 1 → player chooses
        # Phase 2 & Decision Point 2 → player chooses
        # Phase 3 resolved after final decision
    
    # Aggregate into CombatBrief
    return CombatBrief(
        encounter_type=encounter_type,
        total_phases=len(phases),
        phases=phases,
        final_outcome=_determine_final_outcome(phases, player, enemy),
        player_state_after=player,
        enemy_state_after=enemy,
    )
```

### 6.4 V2 Unique Skill Combat Integration

Unique Skills contribute to combat through 3 bonus layers + rich context for the Writer.

#### 6.4.1 Combat Bonus Formula (`unique_skill_combat_bonus_v2`)

```python
# Cap: 0.08 (8%)
V2_BONUS_CAP         = 0.08
UNIQUE_EXISTS_BONUS  = 0.01   # Having a unique skill
BLOOM_BONUS          = 0.01   # Bloom completed
SCAR_DEFENSIVE_BONUS = 0.01   # Scar defensive adaptation
ASPECT_BONUS         = 0.02   # Aspect forged
ULTIMATE_BONUS       = 0.08   # Auto-max at Ultimate

def unique_skill_combat_bonus_v2(player, enemy_skills=None) -> float:
    base = 0.01                              # Unique exists
    base += apply_domain_bonus(...)          # +0-3% domain matchup
    if growth.bloom_completed:   base += 0.01
    if growth.scar_defensive:    base += 0.01
    if growth.aspect_forged:     base += 0.02
    if growth.ultimate_forged:   return 0.08  # Auto-max
    return min(0.08, base)
```

| Stage | Max Bonus | Breakdown |
|-------|-----------|----------|
| Seed | 4% | 1% exists + 3% domain |
| Bloom (Echo) | 5% | +1% bloom |
| Bloom (Scar Def) | 6% | +1% bloom + 1% scar |
| Aspect | 8% | +2% aspect (hits cap) |
| Ultimate | 8% | Auto-max |

#### 6.4.2 Sub-skill Evaluation (`evaluate_sub_skills`)

Each unlocked sub-skill contributes +0.01 if applicable (cap: 0.03):
- **Passive** → always active
- **Active** → in combat only
- **Reactive** → in combat only

#### 6.4.3 Unique Clause Bonus (`check_unique_clause_applicable`)

When the Unique Clause condition is Met → **+5% significant bonus**.

Uses keyword matching against player state:
- Stability-based: "Stability < 30%" → `player.stability < 30`
- HP-based: "HP < 30%" → `player.hp < hp_max * 0.3`
- Instability-based: "instability" → `player.instability > 50`
- Combat-specific: "combat" → `is_combat`
- Post-defeat: "defeat" → `defeat_count > 0`
- Coherence-based: "coherence" → `identity_coherence > 80`

#### 6.4.4 Unique Skill Context (`build_unique_skill_context`)

Builds a rich dict for `CombatBrief.unique_skill_context` so SceneWriter can describe the skill accurately:

```json
{
  "name": "Thiết Thệ Bất Hoại",
  "stage": "bloom",
  "category": "manifestation",
  "mechanic": "Cứng hóa vùng cơ thể...",
  "active_sub_skills": [
    {"name": "SS0", "type": "passive", "mechanic": "..."},
    {"name": "SS1", "type": "reactive", "mechanic": "..."}
  ],
  "domain": "Kim Cương Lĩnh Vực",
  "domain_mechanic": "Miễn cưỡng với NormalSkill cùng category",
  "weakness": "...",
  "weakness_type": "resonance_dependency",
  "unique_clause": "Stability < 30% → skill mạnh hơn",
  "unique_clause_active": true,
  "axis_blind_spot": "creativity",
  "combat_bonus": 0.05,
  "sub_skill_bonus": 0.02,
  "clause_bonus": 0.05,
  "total_bonus": 0.12,
  "can_use_ultimate_ability": false,
  "bloom_path": "echo"
}
```

#### 6.4.5 Orchestrator Integration

The orchestrator wires V2 combat as follows:

```
1. Check unique_skill exists
2. Auto-init growth state if None (init_growth_state)
3. Compute skill activation (check_skill_activation)
4. V2 bonus = unique_skill_combat_bonus_v2(player) × effectiveness
5. Build unique_skill_context for CombatBrief
6. Pass V2 bonus to compute_combat_score
7. Inject unique_skill_context into CombatBrief
```

---

## 7. CombatBrief — Interface between Engine & Writer

### 7.1 CombatBrief Structure

Engine outputs a **CombatBrief** — structured data that Writer transforms into prose:

```json
{
  "encounter_type": "boss",
  "enemy_name": "Trấn Giới Hộ Pháp",
  "total_phases": 3,
  
  "phase_1": {
    "outcome": "mixed",
    "player_action": "strike",
    "intensity": "push",
    "skill_used": "Entropy Shred",
    "structural_damage": 18.5,
    "stability_damage": 25.3,
    "enemy_stability_remaining": 0.65,
    "player_stability_remaining": 0.72,
    "backlash": false,
    "boss_tell": "Dây xích ánh sáng bắt đầu hình thành",
    "narrative_cues": [
      "entropy_vs_order_effective",
      "boss_phase_shift_imminent",
      "player_slightly_wounded"
    ]
  },
  
  "decision_point_1": {
    "context": "Boss sắp chuyển Phase 2 - Contract Bind",
    "choices": [
      {"action": "strike", "intensity": "overdrive", "risk": 5, 
       "hint": "Kết thúc nhanh trước khi boss bind"},
      {"action": "shift", "intensity": "safe", "risk": 2, 
       "hint": "Đổi vector để counter dây xích"},
      {"action": "stabilize", "intensity": "safe", "risk": 1, 
       "hint": "Ổn định trước, chịu được bind"}
    ]
  },
  
  "phase_2": null,
  "phase_3": null,
  "final_outcome": null,
  
  "unique_skill_context": {
    "name": "Thiết Thệ Bất Hoại",
    "stage": "bloom",
    "category": "manifestation",
    "combat_bonus": 0.05,
    "sub_skill_bonus": 0.02,
    "unique_clause_active": true,
    "clause_bonus": 0.05,
    "total_bonus": 0.12,
    "active_sub_skills": ["..."],
    "bloom_path": "echo"
  }
}
```

### 7.2 Writer xử lý CombatBrief thế nào

Writer nhận CombatBrief → viết combat scene liền mạch trong chapter:

**Input:** CombatBrief Phase 1

**Writer output (prose ~400 từ):**
> Entropy xé qua lớp cấu trúc Order của Hộ Pháp. Khoảnh khắc đó, vết nứt lan rộng trên bộ giáp ánh sáng vàng — không phải vết thương thể xác, mà là **hiện thực đang lung lay**.
> 
> Hộ Pháp lùi lại nửa bước. Lần đầu tiên kể từ khi chiến đấu bắt đầu, hắn chậm lại.
>
> Nhưng ánh sáng trong mắt hắn thay đổi. Từ phía sau, những dây xích dệt bằng ánh sáng vàng bắt đầu hình thành, quấn quanh không gian như một mạng lưới khế ước.
>
> ***Phase 2 sắp kích hoạt.***
>
> *Bạn có 3 lựa chọn:*
> 
> 1. 🔥 **Dồn toàn lực Entropy Shred** — Kết thúc trước khi dây xích hoàn thành. *(Nguy hiểm — có thể backlash)*
> 2. 🔄 **Chuyển vector, né hệ thống khế ước** — Từ bỏ tấn công, tập trung counter. *(An toàn hơn)*
> 3. 🛡️ **Ổn định bản thân** — Chấp nhận bị bind, nhưng stability đầy để chịu đựng. *(Chơi dài)*

---

## 8. Psychological Layer — Bluff & Mind Game

### 8.1 Triết lý: Cờ vua + Poker (Phase 2 PvP)

- **Deterministic core** (cờ vua) — damage/stability/interaction tính chính xác
- **Hidden information** (poker) — đối thủ không biết resonance + instability thật

### 8.2 PvE: Boss Pattern Reading

Boss có **tells** (dấu hiệu) trong prose. Player phải đọc và chọn đúng:

```
Boss tell: "Dây xích ánh sáng bắt đầu hình thành"
   → Phase 2 = Contract Bind
   → Counter = Shift (dodge bind) hoặc Overdrive (kill before bind)
   → Trap = Stabilize (bị bind và mất thế)
```

**Đây là mind game với boss** — không phải reaction speed, mà là **pattern recognition qua prose**.

### 8.3 PvP Mind Game (Phase 2+)

Khi PvP mở, bluff nằm ở:
- **Hidden intensity** — đối thủ không biết bạn chọn Safe hay Overdrive
- **Hidden resonance** — thật sự mạnh Order hay đang giấu Entropy build?
- **Hidden instability** — gần mutation hay vẫn ổn?

### 8.4 Chiến lược 3 tầng (áp dụng cho cả PvE và PvP)

```
Layer 1: Build trước trận — preparation (principle + skill selection)
Layer 2: Phase decision — pattern reading (đọc boss tell, chọn đúng)
Layer 3: Intensity bet — risk management (safe vs overdrive timing)
```

---

## 9. Pipeline Integration

### 9.1 Combat trong Narrative Pipeline

```
Planner output: beats có combat
     ↓
Council Gate: trigger COMBAT → Combat Judge
     ↓
Combat Judge dùng Resolution Engine:
├── 1. Tính CombatBrief Phase 1
├── 2. Xác định decision point choices
├── 3. Đánh giá skill activation (nếu có)
└── 4. Trả về structured data
     ↓
Writer nhận: PlannerOutput + CombatBrief + CouncilVerdict
├── Viết combat prose tích hợp CombatBrief
├── Embed decision point choices vào prose
└── Output: chapter prose với combat scene bên trong
     ↓
Player chọn at decision point
     ↓
Next chapter: Engine resolve Phase 2+3 based on choice
     ↓
Writer viết combat resolution + chapter continuation
```

### 9.2 Multi-chapter Boss Fights

Boss fight có thể span 2 chapters:

```
Chapter N: 
├── Narrative setup
├── Combat Phase 1 (automated, trong prose)
├── Decision Point 1 → 3 choices cuối chapter
└── Player chọn

Chapter N+1:
├── Combat Phase 2 (based on choice)
├── Decision Point 2 → 3 choices giữa chapter  
├── Player follows prose...
├── Combat Phase 3 (resolution)
└── Narrative aftermath
```

> **1 decision point = 1 chapter choice.** Không cần thêm UI — choices cuối chapter đã là decision points.

---

## 10. PvE → PvP Evolution Roadmap

### Phase 1 — PvE Core (MVP) ← **Current**

- Guardian tầng + Empire units + Elite anomaly
- Resolution Combat model (0-2 decision points)
- Stability mechanic + Overdrive risk
- Boss pattern reading qua prose tells
- No PvP

**Mục tiêu test:**
- Combat score formula balanced
- Decision points feel meaningful
- Prose describes combat accurately from CombatBrief
- Stability + Overdrive create real tension

### Phase 2 — Asynchronous PvP

- Arena simulation (ghost combat)
- Influence duel (Gate contest)
- **Không real-time**
- Engine simulate duel dựa trên build
- Hidden intensity → bluff layer mở

### Phase 3 — Controlled PvP

- Duel có điều kiện (consent-based)
- Không full loot, không perma death
- Stability penalty (chỉ thua stability, không mất item)
- PvP = showcase build, không phải griefing
- Full mind game layer active

---

## 11. Data Models (Python)

### 11.1 Combat Models

```python
# app/models/combat.py [NEW]

from enum import Enum
from pydantic import BaseModel, Field

class CombatAction(str, Enum):
    STRIKE = "strike"
    SHIFT = "shift"
    STABILIZE = "stabilize"

class Intensity(str, Enum):
    SAFE = "safe"
    PUSH = "push"
    OVERDRIVE = "overdrive"

class EncounterType(str, Enum):
    MINOR = "minor"     # 0 decision points, auto-resolve
    DUEL = "duel"       # 1 decision point
    BOSS = "boss"       # 2-3 decision points
    CLIMAX = "climax"   # 3 decision points, season boss

class BossPhase(BaseModel):
    phase_number: int
    name: str
    hp_threshold: float              # 0.0-1.0, when this phase activates
    dominant_principle: str
    stability_pressure: str          # "low" | "medium" | "high"
    special_mechanic: str = ""
    tell_pattern: str = ""           # narrative hint for player
    environmental_modifier: dict = Field(default_factory=dict)

class BossTemplate(BaseModel):
    boss_id: str
    name: str
    floor: int
    primary_principle: str
    secondary_principle: str
    phases: list[BossPhase]
    base_hp: float = 100.0
    base_stability: float = 100.0
    resistances: dict[str, float] = Field(default_factory=dict)
    weaknesses: dict[str, float] = Field(default_factory=dict)

class CombatApproach(BaseModel):
    """Player's chosen approach for a combat phase."""
    action: CombatAction
    intensity: Intensity
    skill_name: str = ""

class DecisionPointChoice(BaseModel):
    """A single choice at a decision point."""
    action: CombatAction
    intensity: Intensity
    risk_level: int = 1              # 1-5
    hint: str = ""                   # narrative context for player
    
class DecisionPoint(BaseModel):
    """A combat decision point embedded in prose."""
    phase_after: int                 # which phase follows this decision
    context: str                     # narrative context (boss tell, situation)
    choices: list[DecisionPointChoice] = Field(max_length=3)

class PhaseResult(BaseModel):
    """Result of a single combat phase."""
    phase_number: int
    outcome: str                     # "favorable" | "mixed" | "unfavorable"
    combat_score: float = 0.0
    
    # Damage dealt
    structural_damage_dealt: float = 0.0
    stability_damage_dealt: float = 0.0
    
    # State after phase
    player_hp_remaining: float = 100.0
    player_stability_remaining: float = 100.0
    enemy_hp_remaining: float = 100.0
    enemy_stability_remaining: float = 100.0
    
    # Events
    backlash_occurred: bool = False
    backlash_description: str = ""
    phase_shifted: bool = False
    skill_activated: bool = False
    skill_activation_description: str = ""
    fate_buffer_triggered: bool = False
    
    # For Writer
    narrative_cues: list[str] = Field(default_factory=list)
    boss_tell_for_next: str = ""     # tell pattern for next phase

class CombatBrief(BaseModel):
    """
    Complete structured output from Combat Engine → Writer.
    Writer transforms this into cinematic prose.
    """
    encounter_type: EncounterType
    enemy_name: str = ""
    enemy_type: str = ""             # structural | instability | perception
    
    # Phase results (filled incrementally as player makes decisions)
    phases: list[PhaseResult] = Field(default_factory=list)
    decision_points: list[DecisionPoint] = Field(default_factory=list)
    
    # Final outcome (filled after all phases)
    final_outcome: str = ""          # "player_wins" | "enemy_wins" | "draw" | "fate_save"
    player_state_after: dict = Field(default_factory=dict)
    
    # V2 Unique Skill context
    unique_skill_context: dict = Field(default_factory=dict)  # V2: rich context for Writer
    
    # Impact on game state
    instability_gained: float = 0.0
    identity_impact: str = ""
    narrative_consequences: list[str] = Field(default_factory=list)
    floor_progress: bool = False

class CombatResult(BaseModel):
    """Final result for IdentityDelta and state updates."""
    winner: str                      # "player" | "enemy" | "draw" | "fate_buffer_save"
    encounter_type: str
    decision_count: int = 0          # how many decision points player faced
    
    # State changes
    hp_remaining: float = 0.0
    stability_remaining: float = 0.0
    instability_gained: float = 0.0
    
    # Identity impact
    dqs_change: float = 0.0          # combat smart → DQS up
    coherence_change: float = 0.0    # fighting aligned with identity?
    breakthrough_change: float = 0.0 # high-risk combat → breakthrough meter
    
    # Rewards (narrative, not items)
    narrative_consequences: list[str] = Field(default_factory=list)
    floor_progress: bool = False
```

---

## 12. Phase 1 Scope

### Must-Have

| Component | Chi tiết |
|-----------|----------|
| Resolution Combat Engine | Phase-based, deterministic |
| CombatBrief → Writer | Structured data for narrative integration |
| Combat Score formula | 4-component: Build Fit 45% + Player Skill 30% + Environment 15% + Randomness 10% |
| 3 encounter types | Minor (0dp), Duel (1dp), Boss (2dp) |
| 3-Action + 3-Intensity | Strike/Shift/Stabilize × Safe/Push/Overdrive |
| Stability bar | HP + Stability dual resource |
| Boss template | 2-3 phases, principle-based, tell patterns |
| 3 enemy types | Structural, Instability, Perception |
| Floor 1-2 bosses | Simple → medium complexity |
| CombatResult → IdentityDelta | Combat affects DQS, coherence, breakthrough |
| V2 Unique Skill Combat | Domain bonus (3%) + Growth scaling (1-8%) + Unique Clause (+5%) |
| V2 Sub-skill Evaluation | 0-3% bonus from applicable sub-skills |
| V2 Unique Skill Context | Rich context dict for SceneWriter (§6.4) |

### Defer to Phase 2+

| Component | Phase |
|-----------|-------|
| Season climax (3dp) | Late Phase 1 |
| Rare principle boss | Phase 2 |
| PvP (async arena) | Phase 2 |
| Mind game layer (bluff) | Phase 2 (PvP) |
| Multi-player boss | Phase 3 |
| Multi-chapter boss fights | Phase 2 |

---

## 13. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| Engine tính outcome TRƯỚC Writer viết | Deterministic core |
| LLM KHÔNG quyết định combat outcome | Consistency |
| LLM chỉ nhận CombatBrief → viết prose | Separation of concerns |
| Boss không chỉ là HP sponge | Meaningful decision points |
| 1 build không auto-win mọi boss | Build diversity |
| Overdrive có cost thật | Risk/reward |
| Stability break ≠ insta-death | Still recoverable (Fate Buffer) |
| Max 3 decision points per encounter | Avoid decision fatigue |
| Season 1: Floor 1-2 boss, 2-3 phases | Gradual complexity |
| Decision point = chapter choice (reuse UI) | No extra UI needed |

---

## Appendix: Decisions Log

| Câu hỏi | Quyết định | Source |
|----------|-----------|--------|
| Combat model? | **Resolution Combat** (phase-based, narrative-integrated) | v1.1 — replaces round-by-round |
| Combat focus? | Combat-focused (A) | Combat Core Loop |
| Duel vs Boss? | Duel 1dp + Boss 2-3dp | Combat Pacing v1 → Resolution v1.1 |
| PvE vs PvP? | PvE trước, PvP mở dần (C) | Combat Roadmap |
| Action model? | 3 actions × 3 intensities (kept from drafts) | Combat Decision v1 |
| Boss design? | Boss-centric, multi-phase (C) | Combat System v1 |
| Mind game? | Deterministic core + pattern reading (PvE) + bluff (PvP later) | Deterministic Core |
| Onboarding feel? | Dễ tiếp cận, dần lộ chiều sâu (B) | Deterministic Core |
| LLM role in combat? | Engine decides outcome → LLM writes prose from CombatBrief | v1.1 Resolution Model |
