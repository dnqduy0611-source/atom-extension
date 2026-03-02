# 🎮 AMOISEKAI — Season 1 Unique Skill Spec

> **Source:** [UNIQUE_SKILL_SYSTEM_V2_SPEC.md](file:///d:/Amo/ATOM_Extension_V2.8_public/Amoisekai/UNIQUE_SKILL_SYSTEM_V2_SPEC.md) (full spec)  
> **Scope:** Chỉ những gì CẦN implement cho Season 1  
> **Date:** 2026-02-25  
> **Status:** Draft  

---

## Tổng Quan Season 1

```
PLAYER THẤY:                          ENGINE LÀM NGẦM:
├── Soul Forge → Unique Skill (V2)     ├── Principle Resonance (SECRET)
├── Growth: Seed→Bloom→Aspect→Ultimate ├── Proto-Sovereign flag (SECRET)
├── Combat: Domain + Sub-skills        └── Sovereign Registry (data only)
└── Naming Event (Ultimate)
```

Season 1 = **Single-player**. Toàn bộ Sovereign content (trial, claim, World Echo) dành cho Season 2+ (MMO).

---

## PHASE 1 — Model Foundation & Migration

**Mục tiêu:** Tạo Pydantic models V2. Backward-compatible với V1.

### 1.1 SubSkill Model

```python
# app/models/player.py — NEW class

class SubSkill(BaseModel):
    """A sub-skill within a Unique Skill ecosystem."""
    name: str = ""
    type: str = ""               # "passive" | "active" | "reactive"
    mechanic: str = ""           # How it works
    cost: str = ""               # Stability cost or trigger condition
    trigger: str = ""            # For reactive: when does it auto-activate
    unlocked_at: str = ""        # "seed" | "bloom" | "aspect" | "ultimate"
```

### 1.2 UniqueSkill V2

```python
# app/models/player.py — UPGRADE existing UniqueSkill

class UniqueSkill(BaseModel):
    # ── Existing V1 fields (giữ nguyên) ──
    name: str = ""                              
    description: str = ""                       
    category: str = ""
    trait_tags: list[str] = Field(default_factory=list)
    mechanic: str = ""
    limitation: str = ""
    weakness: str = ""
    activation_condition: str = ""
    activation_cost: str = ""
    soul_resonance: str = ""
    evolution_hint: str = ""
    countered_by: list[str] = Field(default_factory=list)
    resilience: float = 100.0                   
    instability: float = 0.0                    
    is_revealed: bool = False
    uniqueness_score: float = 1.0               
    forge_timestamp: datetime | None = None     
    
    # ── NEW V2 fields ──
    unique_clause: str = ""                     # What Normal Skill can't do
    sub_skills: list[SubSkill] = Field(default_factory=list)
    domain_category: str = ""                   # Same as category
    domain_passive_name: str = ""               # SS0 name
    domain_passive_mechanic: str = ""           # SS0 effect
    weakness_type: str = ""                     # 1 of 7 taxonomy
    axis_blind_spot: str = ""                   # Structural category weakness
    current_stage: str = "seed"                 # seed | bloom | aspect | ultimate
```

### 1.3 UniqueSkillGrowthState

```python
# app/models/unique_skill_growth.py — NEW file

class GrowthType(str, Enum):
    BASE = "base"
    ECHO = "echo"
    SCAR = "scar"

class ScarType(str, Enum):
    DEFENSIVE = "defensive"
    COUNTER = "counter"
    WARNING = "warning"

class WeaknessType(str, Enum):
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
    severity: str = ""       # "near_death" | "backlash" | "loss"

class AspectOption(BaseModel):
    name: str = ""
    description: str = ""
    sub_skill_2: SubSkill | None = None
    sub_skill_3: SubSkill | None = None

class UltimateSkill(BaseModel):
    name: str = ""           # "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"
    title: str = ""          # Danh xưng
    merged_sub_skills: list[SubSkill] = Field(default_factory=list)
    absorbed_skill_name: str = ""
    ultimate_ability: str = ""
    ultimate_ability_used: bool = False

class UniqueSkillGrowthState(BaseModel):
    """Complete growth state tracking — V2."""
    skill_id: str = ""
    original_skill_name: str = ""
    current_skill_name: str = ""
    current_stage: str = "seed"
    
    # ── Bloom ──
    active_growth: GrowthType = GrowthType.BASE
    bloom_path: str = ""             # "echo" | "scar" | ""
    bloom_completed: bool = False
    echo_coherence_streak: int = 0
    echo_can_lose: bool = True
    scar_adapted: bool = False
    scar_type: ScarType | None = None
    trauma_log: list[TraumaEvent] = Field(default_factory=list)
    scar_trauma_count: int = 0
    
    # ── Aspect ──
    aspect_forged: bool = False
    aspect_options: list[AspectOption] = Field(default_factory=list)
    aspect_chosen: str = ""
    aspect_deferred: bool = False
    aspect_defer_chapter: int = 0
    
    # ── Ultimate ──
    ultimate_forged: bool = False
    ultimate_skill: UltimateSkill | None = None
    absorbed_skill_id: str = ""
    naming_event_completed: bool = False
    
    # ── Sub-skills + Combat ──
    sub_skills_unlocked: list[str] = Field(default_factory=list)
    mutation_count: int = 0
    mutation_locked: bool = False
    combat_bonus: float = 0.0
```

### 1.4 PlayerState Update

```python
# app/models/player.py — ADD to PlayerState
unique_skill_growth: UniqueSkillGrowthState | None = None
```

### 1.5 Principle Resonance (SILENT — Sovereign Prep)

```python
# app/models/unique_skill_growth.py — ADD

class PrincipleResonance(BaseModel):
    """SECRET — calculated after Soul Forge, player never sees this."""
    order: float = 0.0
    entropy: float = 0.0
    matter: float = 0.0
    flux: float = 0.0
    energy: float = 0.0
    void: float = 0.0
    
    is_proto_sovereign: bool = False
    dominant_principle: str = ""
```

```python
# app/models/player.py — ADD to PlayerState
principle_resonance: PrincipleResonance | None = None  # SECRET
```

### Phase 1 Tests

- `TestSubSkill`: Creation, type validation
- `TestUniqueSkillV2`: V2 fields defaults, backward compat với V1
- `TestGrowthState`: Default values, stage transitions, enum validation
- `TestV1BackwardCompat`: V1 JSON vẫn deserialize (empty V2 fields)
- `TestPrincipleResonance`: Score ranges, proto-sovereign detection

---

## PHASE 2 — Soul Forge V2 & Domain System

**Mục tiêu:** Update Forge prompt → generate V2 skills. Implement Domain rules.

### 2.1 Forge Prompt V2

File: `app/engine/soul_forge.py`

**Changes:**
1. New `_build_forge_prompt_v2()` — full prompt (xem Full Spec §6.2)
2. Output JSON phải include: `domain_passive`, `weakness_type`, `unique_clause`, `axis_blind_spot`
3. `forge_skill_sync()` parse V2 output:
   - Map `domain_passive` → `SubSkill(type="passive", unlocked_at="seed")`
   - Auto-derive `axis_blind_spot` from category
   - Set `current_stage = "seed"`
   - Init `UniqueSkillGrowthState`
4. `forge_skill_ai()` — same

**V2 thêm gì so với V1:**

| Field | V1 | V2 |
|-------|----|-----|
| mechanic | 1 mô tả đơn | Core Mechanic + quirk |
| weakness | Free-form | 1/7 taxonomy + customize |
| *(new)* domain_passive | ✗ | SS0 — Domain passive |
| *(new)* weakness_type | ✗ | Enum 7 loại |
| *(new)* axis_blind_spot | ✗ | Structural weakness |
| *(new)* unique_clause | ✗ | Điều Normal Skill không thể |

### 2.2 Weakness Taxonomy — 7 Types

AI Forge **BẮT BUỘC** chọn 1 type rồi customize từ player data:

| # | Type | Mechanic | VD |
|---|------|----------|-----|
| 1 | **Soul Echo** | Ký ức pre-isekai xâm nhập khi dùng | Ảo giác người đã mất |
| 2 | **Principle Bleed** | Principle ảnh hưởng ngoài combat | Entropy → ký ức "rỉ sét" |
| 3 | **Resonance Dependency** | Misfire khi dùng trái identity | -50% nếu không aligned |
| 4 | **Target Paradox** | Không dùng được với người/vật X | Vô hiệu với người tin tưởng |
| 5 | **Sensory Tax** | Mất giác quan tạm thời | Mù 30 giây sau dùng |
| 6 | **Environment Lock** | Chỉ hoạt động dưới điều kiện | Cần bóng tối |
| 7 | **Escalation Curse** | Side effect tệ hơn mỗi lần | Lần 3: mất ký ức |

### 2.3 Domain System

File: `app/engine/domain.py` (NEW)

```python
DOMAIN_RULES = {
    "perception": {
        "immunity": "Normal perception KHÔNG thể feed sai. Unique luôn đúng.",
        "authority_bonus": 0.03,
    },
    "manifestation": {
        "immunity": "Normal defense/offense KHÔNG cancel Unique manifestation.",
        "authority_bonus": 0.03,
    },
    "manipulation": {
        "immunity": "Normal manipulation KHÔNG override Unique manipulation.",
        "authority_bonus": 0.03,
    },
    "contract": {
        "immunity": "Normal contract KHÔNG phá Unique contract.",
        "authority_bonus": 0.03,
    },
    "obfuscation": {
        "immunity": "Normal detection KHÔNG phá Unique obfuscation.",
        "authority_bonus": 0.03,
    },
}

# Category → Structural blind spot
AXIS_BLIND_SPOTS = {
    "manifestation": "Không thể hỗ trợ/heal đồng đội",
    "perception":    "Không tăng damage/defense trực tiếp",
    "contract":      "Vô hiệu nếu đối phương không tương tác",
    "manipulation":  "Không burst damage, không instant kill",
    "obfuscation":   "Không thể tank trực diện khi bị lộ",
}

def apply_domain_bonus(player, enemy, skill) -> float:
    """Domain chỉ vs Normal (Tier 1-3) cùng category. +3%."""
    ...

def get_axis_blind_spot(category: str) -> str:
    return AXIS_BLIND_SPOTS.get(category, "")
```

### 2.4 Principle Resonance Calculation (SILENT)

File: `app/engine/soul_forge.py` — thêm hàm

```python
def calculate_principle_resonance(signals: IdentitySignals, skill: UniqueSkill) -> PrincipleResonance:
    """SECRET — Calculate resonance after Soul Forge.
    
    Weighting:
    - Behavioral Fingerprint (quiz): 60%
    - DNA Tags Alignment: 30%
    - Forge narrative choices: 10%
    
    Proto-Sovereign threshold: max_resonance >= 0.8 (~3% players)
    """
    # DNA tag → Principle mapping
    PRINCIPLE_TAGS = {
        "order":   ["analytical", "structured", "disciplined", "truth-seeking"],
        "entropy": ["adaptive", "deconstructive", "absorptive", "transformative"],
        "matter":  ["creative", "protective", "constructive", "grounded"],
        "flux":    ["fluid", "resilient", "boundary-breaking", "metamorphic"],
        "energy":  ["passionate", "sacrificial", "connective", "catalytic"],
        "void":    ["detached", "absolute", "transcendent", "liminal"],
    }
    ...
```

### Phase 2 Tests

- `TestForgePromptV2`: Prompt chứa weakness taxonomy, domain, unique clause
- `TestForgeOutput`: Parsed có SubSkill, weakness_type ∈ 7 enum
- `TestDomainRules`: Mỗi category có immunity + 3% bonus
- `TestApplyDomainBonus`: +3% khi matchup, 0% khi không
- `TestAxisBlindSpot`: Mỗi category trả đúng blind spot
- `TestPrincipleResonanceCalc`: Score ranges, threshold detection

---

## PHASE 3 — Growth Engine (Bloom → Aspect → Ultimate)

**Mục tiêu:** Full growth path. Sub-skill unlocks. Naming Event.

### 3.1 Bloom Stage

File: `app/engine/unique_skill_growth.py` (NEW)

**Two paths to Bloom:**

| Path | Trigger | SS1 Type |
|------|---------|----------|
| **Echo Bloom** | Coherence ≥ 70 sustained 10 scenes | Active |
| **Scar Bloom** | 3× survive trauma | Reactive |

```python
def check_bloom_trigger(player, progression) -> str | None:
    """Returns 'echo' or 'scar' or None."""
    growth = player.unique_skill_growth
    if growth.bloom_completed:
        return None
    if growth.echo_coherence_streak >= 10:
        return "echo"
    if growth.scar_trauma_count >= 3 and not growth.scar_adapted:
        return "scar"
    return None

def update_growth_per_scene(player, scene_result):
    """Track coherence streak, trauma count mỗi scene."""
    ...
```

**AI Forge — Bloom prompt** (lần 2): Tạo SS1, enhance core, nới weakness.

### 3.2 Aspect Stage

**Trigger:** Rank 4 + Bloom completed + 20 uses

**Aspect Forge Flow (3 scenes):**
```
Scene 1 — "Skill Run": Skill kích hoạt bất thường
Scene 2 — "The Fork": 2 visions → DECISION POINT (A or B)
Scene 3 — "Reborn": Skill hoàn thành, first use
```

**Unlocks:** SS2 (active) + SS3 (passive). Mỗi aspect khác nhau.

**AI Forge — Aspect prompt** (lần 3): Tạo 2 aspects, mỗi cái 2 sub-skills. Player chọn 1.

### 3.3 Ultimate Stage

**Trigger:** Rank 5 + Aspect Forged + Mastered Normal Skill + Season Climax

**Ultimate Synthesis Flow (3 scenes):**
```
Scene 1 — "Giới Hạn": Boss dồn, cả 2 skill max → vẫn thiếu
Scene 2 — "Cộng Hưởng": 2 skills RESONANCE. Normal ABSORB → NAMING EVENT
Scene 3 — "Tái Sinh": Ultimate kích hoạt lần đầu. Season 1 kết thúc
```

**Unlocks:**
- All SS merged + transcended
- Normal Skill absorbed (mất khỏi equipped)
- Ultimate Ability: God-tier, 1/season, 80% stability
- Naming Event: "[Tên] — [Danh xưng]"

### 3.4 Weakness Evolution (qua các stage)

```
SEED:     Weakness nguyên bản (strong constraint)
BLOOM:    Nới lỏng 1 điều kiện
ASPECT:   Transform dạng (vẫn tồn tại)
ULTIMATE: Vẫn có — UA BYPASS 1 lần
```

### 3.5 Orchestrator Hook

File: `app/engine/orchestrator.py`

```python
# Sau mỗi scene:
await update_growth_per_scene(player, scene_result)

# Khi trigger:
if bloom_trigger := check_bloom_trigger(player, progression):
    # Generate SS1 via AI Forge
    ...
```

### Phase 3 Tests

- `TestBloomTrigger`: Echo (streak ≥ 10), Scar (trauma ≥ 3)
- `TestGrowthPerScene`: Coherence tracking, trauma counting
- `TestBloomGeneration`: SS1 unlock, weakness nới lỏng
- `TestAspectTrigger`: Rank 4, Bloom done, use count
- `TestAspectForge`: 2 options, branch choice, SS2+SS3
- `TestUltimateTrigger`: All preconditions
- `TestUltimateSynthesis`: Merge, absorption, naming event
- `TestWeaknessEvolution`: Transform per stage, never delete

---

## PHASE 4 — Combat Integration

**Mục tiêu:** Unique Skill matters in combat. Domain + Sub-skills + Unique Clause.

### 4.1 Combat Score Formula (updated)

File: `app/engine/combat.py`

```python
def unique_skill_combat_bonus(player) -> float:
    """0.0-0.08 bonus (upgraded from 0.05 cap in v1)."""
    growth = player.unique_skill_growth
    base = 0.01  # Unique exists = 1%
    
    base += apply_domain_bonus(...)   # +0-3% (matchup)
    
    if growth.bloom_completed:
        base += 0.01                  # Bloom: +1%
    if growth.scar_adapted and growth.scar_type == ScarType.DEFENSIVE:
        base += 0.01                  # Scar defensive: +1%
    if growth.aspect_forged:
        base += 0.02                  # Aspect: +2%
    if growth.ultimate_forged:
        base = 0.08                   # Ultimate: auto-max
    
    return min(0.08, base)
```

### 4.2 Sub-skill Evaluation

```python
def evaluate_sub_skills(player, enemy, context) -> float:
    """0.0-0.03 bonus based on sub-skill applicability."""
    ...
```

### 4.3 Unique Clause Check

```python
def check_unique_clause_applicable(player, enemy, context) -> bool:
    """If applicable: +5% bonus (significant advantage)."""
    ...
```

### 4.4 CombatBrief Update

```python
combat_brief.unique_skill_context = {
    "name": skill.name,
    "stage": growth.current_stage,
    "active_sub_skills": [...],
    "domain": skill.domain_passive_name,
    "weakness_type": skill.weakness_type,
    "unique_clause": skill.unique_clause,
    "can_use_ultimate_ability": ...,
}
```

### 4.5 Domain Scaling per Stage

| Stage | Domain Power |
|-------|-------------|
| Seed | Immune Normal cùng category. +3% |
| Bloom | Mở rộng: Normal không thể counter |
| Aspect | Narrative: NPC cảm nhận domain |
| Ultimate | Vượt Tier 3: chỉ Unique khác counter |

### Phase 4 Tests

- `TestCombatDomainBonus`: Score formula with domain
- `TestCombatSubSkill`: Sub-skill evaluation bonus
- `TestCombatUniqueClause`: +5% khi applicable
- `TestCombatBonusCap`: Max 8%
- `TestCombatBrief`: unique_skill_context format
- `TestDomainScaling`: Per stage behavior

---

## Season 1 KHÔNG LÀM

| Hệ thống | Season | Lý do |
|-----------|--------|-------|
| World Echo | 2 | Chỉ trigger khi Sovereign awakening |
| Sovereign Trial + Claim | 2 | Cần MMO infrastructure |
| World Hints / Anomaly Events | 2 | Tiết lộ dần |
| MMO Sovereign Competition | 2 | Cần multiplayer |
| Forbidden Ability | 3+ | Ascended phase |
| Void Sovereign unlock | 3+ | Endgame content |

---

## Sovereign Registry (DATA ONLY — Season 1)

6 Sovereign Skills tồn tại trong data, tất cả DORMANT:

```python
SOVEREIGN_REGISTRY = {
    "order":   {"name": "Thiên Nhãn Vạn Tượng",   "status": "dormant", "owner": None, "season": 2},
    "entropy": {"name": "Thôn Phệ Vạn Vật",       "status": "dormant", "owner": None, "season": 2},
    "matter":  {"name": "Kiến Tạo Vĩnh Hằng",     "status": "dormant", "owner": None, "season": 2},
    "flux":    {"name": "Biến Huyễn Vô Thường",    "status": "dormant", "owner": None, "season": 2},
    "energy":  {"name": "Thần Hỏa Nguyên Thủy",   "status": "dormant", "owner": None, "season": 2},
    "void":    {"name": "Hư Vô Thâm Uyên",        "status": "dormant", "owner": None, "season": 3},
}
```

> [!NOTE]
> Lore: 6 quyền năng thần thánh từ thuở khai thiên. Thần thoại sẽ được tiết lộ ở các season sau.  
> Season 1: Engine lưu Principle Resonance + Proto-Sovereign flag, nhưng KHÔNG dùng.

---

## Migration từ V1

| V1 | V2 | Migration |
|----|-----|-----------|
| `mechanic` = single | Core + Sub-skills | Re-forge prompt v2 |
| `weakness` = free-form | `weakness_type` + structured | Re-forge |
| No Domain | `domain_passive` | Generate via prompt |
| No Sub-skills | `sub_skills: list` | Empty for existing |
| Combat cap: 5% | Combat cap: 8% | Update formula |

**V1 backward-compatible**: New fields default empty. Re-forge khi player enters Bloom.

---

## Safety Constraints — Season 1

| Quy tắc | Lý do |
|---------|-------|
| 1 Unique Skill per player | Power fantasy nhưng không broken |
| Sub-skills unlock qua narrative | Immersion |
| Domain chỉ immune Normal cùng category | Không auto-win |
| Weakness KHÔNG BAO GIỜ XÓA, chỉ transform | Tension duy trì |
| Ultimate Ability = 1/season, 80% stability | God-tier cần scarcity |
| AI Forge chọn weakness từ 7-type taxonomy | Đa dạng |
| Combat bonus cap 8% | Unique matter nhưng không broken |
| Player NEVER sees raw stats | Mystery preserved |
| Proto-Sovereign = HOÀN TOÀN BÍ MẬT | Season 2 reveal |
| Principle Resonance = SILENT | Player không thấy |

---

## Complete Example — "Thệ Ước Thép"

**Archetype:** Vanguard | **Category:** Manifestation | **Weakness:** Sensory Tax

```
SEED:
  Core: Cứng hóa phần cơ thể ĐANG BỊ VA CHẠM (reactive, instant, 1 vùng)
  SS0 (Domain): "Thân Thép" — Immune Normal defensive cùng category, +5% resist
  Weakness: Mất xúc giác 30 giây sau cứng hóa
  Unique Clause: Stability < 30% → skill MẠNH hơn

ECHO BLOOM:
  Core++: Cứng hóa nhanh hơn, 2 vùng thay vì 1
  SS1 (reactive): "Phản Xạ Thép" — reflect 20% damage
  Weakness: Mất xúc giác 15 giây (nới lỏng)

ASPECT B — "Nộ Cương":
  Core+++: Cứng hóa TOÀN THÂN khi stability < 30%
  SS1: reflect 35% + knockback
  SS2 (active): "Nộ Cương" — Voluntary full-body harden 3s, cost 25
  SS3 (passive): "Ký Ức Thép" — cùng loại attack lần 2+ → nhanh gấp đôi
  Weakness: Xúc giác delay 5 giây

ULTIMATE — "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương":
  Core Transcend: Cứng hóa BẤT KỲ VẬT THỂ cơ thể chạm vào
  Absorbed: "Matter Shield" (Tier 2)
  UA: "Thiết Thệ Tuyệt Đối" — Reality cứng hóa bán kính 10m, 1/season, 80% stability
  Weakness final: Sau UA → toàn thân mềm 1 scene → 2× damage
```
