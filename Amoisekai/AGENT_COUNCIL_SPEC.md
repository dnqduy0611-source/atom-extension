# 🏛️ AGENT COUNCIL — Multi-Agent Decision System for Amoisekai

> **Author:** Amo  
> **Date:** 2026-02-23  
> **Status:** Draft  
> **Dependencies:** GDD v1.0, TECH_SPEC_PHASE1, ARCHITECTURE_OVERVIEW  
> **Replaces:** Single-path 7-agent pipeline (partially — pipeline still exists, Council wraps around it)

---

## 1. Vấn đề cần giải quyết

Pipeline hiện tại là **sequential, single-voice**:

```
Planner → Simulator → Context → Writer → Critic → Identity
```

| Vấn đề | Chi tiết |
|---------|----------|
| **Single Planner bias** | 1 LLM call quyết định toàn bộ chapter outline — không có phản biện |
| **Skill activation mù** | Writer tự quyết khi nào skill trigger, không có judge riêng |
| **Combat outcome thiên lệch** | Không có referee chuyên biệt — Writer vừa kể chuyện vừa phân xử |
| **Lore inconsistency** | Context agent trả về raw memory, không AI nào verify lore |
| **Identity drift detection yếu** | Simulator đánh giá `identity_alignment` qua 1 field nhỏ |

**Mục tiêu Agent Council:** Thêm lớp **deliberation** (bàn bạc) cho những quyết định quan trọng, giữ cost thấp cho quyết định thường.

---

## 2. Triết lý thiết kế

### 2.1 Không thay thế — Bao bọc (Wrap, Don't Replace)

Pipeline 7-agent hiện tại **vẫn là backbone**. Council **chỉ can thiệp** khi phát hiện tình huống cần deliberation. Hãy nghĩ Council như một **hội đồng cố vấn** được triệu tập khi cần, không phải thay thế toàn bộ quy trình.

```
                    Normal chapters (90%)
Player Choice ──→  Pipeline (as-is) ──→ Output
                         │
                    Detected trigger?
                         │ yes
                         ▼
                    Agent Council ──→ Council Verdict ──→ Inject back into Pipeline
```

### 2.2 Nguyên tắc: Fast Path vs Council Path

| Path | Khi nào | Cost | Latency |
|------|---------|------|---------|
| **Fast Path** | Chapter bình thường, exploration, dialogue | ~$0.003 | ~10-15s |
| **Council Path** | Combat, skill activation, major plot twist, identity crisis | ~$0.008-0.015 | ~20-35s |

### 2.3 LangGraph-native

Council được implement bằng **LangGraph sub-graph** — tận dụng StateGraph, conditional edges, fan-out. Không dùng framework ngoài (CrewAI, AutoGen).

**Lý do:**
- Đã dùng LangGraph cho pipeline → unified stack
- Full control over routing logic
- Không thêm dependency
- Debug dễ (LangGraph has built-in tracing)

---

## 3. Council Members — Phase 1 Solo Play

### 3.1 Tổng quan

4 Council Members, mỗi member là 1 **specialist agent** với góc nhìn riêng:

```
┌────────────────────────────────────────────────────────┐
│                    COUNCIL ORCHESTRATOR                  │
│           (Router + Aggregator — deterministic)         │
├────────────┬────────────┬────────────┬─────────────────┤
│            │            │            │                  │
│  NARRATIVE │  COMBAT    │  IDENTITY  │  LORE            │
│  DIRECTOR  │  JUDGE     │  GUARDIAN  │  KEEPER          │
│            │            │            │                  │
│  Câu       │  Chiến     │  Nhân vật  │  Thế giới       │
│  chuyện    │  đấu       │  player    │  nhất quán      │
│  hay?      │  công      │  có       │  với lore?       │
│            │  bằng?     │  coherent? │                  │
└────────────┴────────────┴────────────┴─────────────────┘
```

### 3.2 Chi tiết từng Member

---

#### 🎭 Narrative Director

**Vai trò:** Bảo vệ chất lượng câu chuyện — pacing, tension, dramatic impact.

**Được hỏi khi:**
- Planner đề xuất chapter outline có chứa major event
- CRNG trigger breakthrough/rogue event
- Writer sử dụng twist hoặc character death

**Input:** `PlannerOutput` + `previous_summary` + `chapter_number`

**Output:**
```json
{
  "verdict": "approve" | "modify" | "reject",
  "pacing_assessment": "Twist quá sớm — chapter 3 chưa đủ setup",
  "tension_recommendation": 7,
  "narrative_notes": "Nên build thêm 1-2 chương trước twist",
  "modified_beats": []  // nếu modify
}
```

**System Prompt (tóm tắt):**
> Bạn là Narrative Director. Nhiệm vụ: đánh giá outline có tạo câu chuyện hay không. 
> Bạn ưu tiên: dramatic tension, proper pacing (không rush), emotional payoff.
> Bạn KHÔNG quan tâm: combat balance, lore accuracy (có agent khác lo).
> Output: verdict + lý do + đề xuất sửa.

---

#### ⚔️ Combat Judge

**Vai trò:** Phân xử chiến đấu, skill activation, và combat outcome. Đảm bảo combat **logic, balanced, và narratively satisfying**.

**Được hỏi khi:**
- Planner outline chứa combat beat
- Player choice liên quan đến combat (risk ≥ 3)
- Skill activation condition xuất hiện

**Input:** `PlannerOutput` + `player_state` (skill, stats) + `chosen_choice`

**Output:**
```json
{
  "verdict": "approve" | "modify" | "reject",
  "skill_activation": {
    "should_activate": true | false,
    "reason": "Activation condition met: player đang hỏi với intent tìm sự thật",
    "effect_description": "Vết nứt xuất hiện trên lời nói NPC",
    "cooldown_status": "Available (last used chapter 8, cooldown 3)"
  },
  "combat_outcome": {
    "winner": "player" | "enemy" | "draw" | "interrupted",
    "damage_narrative": "Player bị thương nhẹ vai trái",
    "consequence_severity": "moderate",
    "reasoning": "Player DQS=72, risk=3, skill synergy → favorable outcome"
  },
  "balance_notes": "Outcome hợp lý — player mạnh hơn Tier 1 enemy nhưng không stomp"
}
```

**System Prompt (tóm tắt):**
> Bạn là Combat Judge. Nhiệm vụ: phân xử combat và skill activation.
> Quy tắc:
> 1. Skill chỉ activate khi ĐÚNG activation_condition (check chính xác)
> 2. Skill có cooldown — check chapter hiện tại vs lần dùng gần nhất
> 3. Combat outcome dựa trên: player DQS, risk level, skill match, enemy tier
> 4. KHÔNG cho player thắng dễ — Amoisekai là thế giới nguy hiểm
> 5. Có Fate Buffer? → giảm severity chết thành bị thương nặng
> 6. Output: verdict + skill activation detail + combat outcome

**Quan trọng — Combat Formula (deterministic backbone):**

```python
# Combat Judge dùng formula này làm baseline, AI chỉ điều chỉnh narrative
def base_combat_score(player, choice, enemy_tier):
    dqs_factor = player.dqs / 100 * 0.3           # 30% from strategy
    risk_factor = choice.risk_level / 5 * 0.2     # 20% from boldness
    skill_factor = 0.3 if skill_activated else 0.0 # 30% from skill
    rng_factor = random.uniform(0.0, 0.2)          # 20% luck (CRNG)
    return dqs_factor + risk_factor + skill_factor + rng_factor

# score > 0.6 → favorable
# score 0.4-0.6 → mixed
# score < 0.4 → unfavorable
```

---

#### 🛡️ Identity Guardian

**Vai trò:** Bảo vệ sự nhất quán identity của player. Phát hiện drift, đề xuất confrontation, verify mutation.

**Được hỏi khi:**
- `coherence_change < -3` (significant drift detected)
- `instability > 50` (nearing confrontation threshold)
- Player choice mâu thuẫn với `seed_identity`
- Breakthrough event triggered

**Input:** `player_state` (full identity) + `chosen_choice` + `simulator_output`

**Output:**
```json
{
  "verdict": "approve" | "warn" | "trigger_confrontation",
  "identity_assessment": {
    "alignment_with_seed": 0.72,
    "drift_direction": "toward_ruthless",
    "drift_severity": "moderate",
    "explanation": "3 chương gần đây, player liên tục chọn sacrifice others — trái với core value 'protection'"
  },
  "confrontation": {
    "should_trigger": false,
    "type": null,
    "narrative_hook": null
  },
  "echo_of_origin": {
    "visible": true,
    "manifestation": "Trong giấc mơ, player nhìn thấy hình ảnh người cần được bảo vệ"
  },
  "instructions_for_writer": "Thêm internal conflict — player cảm thấy khó chịu với quyết định vừa đưa ra"
}
```

**System Prompt (tóm tắt):**
> Bạn là Identity Guardian. Nhiệm vụ: theo dõi identity player.
> Quy tắc:
> 1. So sánh hành vi hiện tại vs seed_identity (core_values, traits, motivation)
> 2. Drift nhẹ là BÌNH THƯỜNG (character development) — chỉ cảnh báo khi significant
> 3. Khi instability > 70 → đề xuất Narrative Confrontation Event
> 4. Echo of Origin: seed KHÔNG BAO GIỜ biến mất hoàn toàn — luôn có traces
> 5. Mutation phải là LỰA CHỌN CÓ Ý THỨC của player, không bị ép

---

#### 📜 Lore Keeper

**Vai trò:** Verify tính nhất quán với lore đã established. Ngăn contradictions.

**Được hỏi khi:**
- Writer/Planner introduce NPC/location/skill mới
- Chapter references past events (cần check NeuralMemory)
- World-state changes proposed (new faction, territory shift)

**Input:** `PlannerOutput` + `context` (from NeuralMemory) + `writer_output` (first draft)

**Output:**
```json
{
  "verdict": "approve" | "modify" | "reject",
  "consistency_check": {
    "contradictions_found": [],
    "warnings": ["NPC Lão Trần đã chết ở chapter 7 — không thể xuất hiện"],
    "suggestions": ["Thay bằng con trai Lão Trần (chưa được giới thiệu)"]
  },
  "world_state_impact": "Hành động này sẽ tăng threat_level +5",
  "lore_enrichment": "Thêm chi tiết: vùng này thuộc Faction X, player cần thận trọng"
}
```

**System Prompt (tóm tắt):**
> Bạn là Lore Keeper. Nhiệm vụ: verify mọi thứ khớp với lore.
> Quy tắc:
> 1. Dead NPCs KHÔNG sống lại (trừ khi có lore mechanic rõ ràng)
> 2. Skills hoạt động ĐÚNG như spec (check mechanic, limitation, weakness)
> 3. World-state phải consistent: nếu nói "thành phố bình yên" nhưng world_instability=80 → reject
> 4. Universe philosophy: Balanced Dual Force — không cho 1 force dominate
> 5. Check geography, timeline, character relationships

---

## 4. Council Orchestrator — Router & Aggregator

### 4.1 Trigger Detection (Deterministic)

Orchestrator KHÔNG phải AI. Nó là **deterministic router** kiểm tra conditions:

```python
class CouncilTrigger(str, Enum):
    COMBAT = "combat"           # Planner beats contain combat
    SKILL_ACTIVATION = "skill"  # Activation condition might be met
    MAJOR_PLOT = "major_plot"   # CRNG breakthrough/rogue event
    IDENTITY_CRISIS = "identity" # Instability > 50 or major drift
    LORE_CHECK = "lore"         # New NPC/location/faction introduced

def should_convene_council(state: NarrativeState, planner_output: PlannerOutput) -> list[CouncilTrigger]:
    """Deterministic check — NO AI call."""
    triggers = []
    
    # 1. Combat detection
    for beat in planner_output.beats:
        if beat.purpose == "climax" and beat.tension >= 7:
            triggers.append(CouncilTrigger.COMBAT)
            break
        if any(kw in beat.description.lower() for kw in 
               ["chiến đấu", "tấn công", "đấu", "combat", "fight"]):
            triggers.append(CouncilTrigger.COMBAT)
            break
    
    # 2. Skill activation check
    player = state.player_state
    if player and _has_skill(player):
        skill = _get_skill(player)
        choice_text = state.chosen_choice.text if state.chosen_choice else ""
        # Simple keyword match for activation condition
        if _activation_keywords_match(skill, choice_text, planner_output):
            triggers.append(CouncilTrigger.SKILL_ACTIVATION)
    
    # 3. Major plot events
    if state.crng_event and state.crng_event.get("triggered"):
        triggers.append(CouncilTrigger.MAJOR_PLOT)
    
    # 4. Identity crisis
    if player:
        instability = _get_instability(player)
        if instability > 50:
            triggers.append(CouncilTrigger.IDENTITY_CRISIS)
    
    # 5. Lore check (new characters/locations)
    if planner_output.new_characters or planner_output.world_changes:
        triggers.append(CouncilTrigger.LORE_CHECK)
    
    return triggers
```

### 4.2 Council Routing

Không phải mọi trigger đều triệu tập toàn bộ Council:

| Trigger(s) | Members Called | Cost |
|------------|---------------|------|
| `COMBAT` only | Combat Judge + Narrative Director | ~$0.004 |
| `SKILL_ACTIVATION` only | Combat Judge | ~$0.002 |
| `MAJOR_PLOT` | Narrative Director + Identity Guardian | ~$0.004 |
| `IDENTITY_CRISIS` | Identity Guardian + Narrative Director | ~$0.004 |
| `LORE_CHECK` | Lore Keeper | ~$0.002 |
| `COMBAT + SKILL + IDENTITY` | All 4 members | ~$0.008 |

### 4.3 Verdict Aggregation (Deterministic)

```python
def aggregate_verdicts(verdicts: list[CouncilVerdict]) -> CouncilDecision:
    """
    Voting rules:
    1. Any REJECT → entire council REJECTS (unanimous safety)
    2. All APPROVE → APPROVE
    3. Mix of APPROVE + MODIFY → MODIFY (merge modifications)
    """
    if any(v.verdict == "reject" for v in verdicts):
        rejections = [v for v in verdicts if v.verdict == "reject"]
        return CouncilDecision(
            verdict="reject",
            reason="; ".join(r.reason for r in rejections),
            retry_instructions=_merge_instructions(rejections),
        )
    
    modifications = [v for v in verdicts if v.verdict == "modify"]
    if modifications:
        return CouncilDecision(
            verdict="modify",
            modifications=_merge_modifications(modifications),
            additional_context=_merge_contexts(verdicts),
        )
    
    return CouncilDecision(
        verdict="approve",
        enrichments=_merge_enrichments(verdicts),
    )
```

---

## 5. Pipeline Integration — Sơ đồ luồng mới

### 5.1 Updated Pipeline Flow

```
Player Choice/Input
     │
     ▼
┌─────────────────┐
│ 0. INPUT PARSER  │  (unchanged)
└────────┬────────┘
         ▼
┌─────────────────┐
│ 1. PLANNER       │  (unchanged)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│ 1.5 COUNCIL GATE (deterministic)                 │
│                                                  │
│   should_convene_council(state, planner_output)  │
│   → triggers: [COMBAT, SKILL]                    │
│                                                  │
│   if no triggers → FAST PATH (skip council)      │
│   if triggers → COUNCIL PATH                     │
└─────────────┬────────────────┬──────────────────┘
              │ fast           │ council
              ▼                ▼
    ┌─────────────┐   ┌─────────────────────┐
    │ Normal flow │   │ COUNCIL SESSION      │
    │ (unchanged) │   │                      │
    └─────────────┘   │ Fan-out to members   │
                      │ → Aggregate verdicts │
                      │ → Inject into state  │
                      └──────────┬──────────┘
                                 │
                      ┌──────────┴──────────┐
                      │ verdict == reject?   │
                      │ → Re-plan (max 2x)  │
                      │ verdict == modify?   │
                      │ → Inject mods        │
                      │ verdict == approve?  │
                      │ → Continue           │
                      └──────────┬──────────┘
                                 ▼
                    ┌──────────────────────┐
                    │  2+3. SIM + CTX      │  (parallel, unchanged)
                    │  (with council       │
                    │   context injected)  │
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  5. WRITER            │  (receives council verdict
                    │                      │   as extra instructions)
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  6. CRITIC            │  (checks council compliance)
                    └──────────┬───────────┘
                               ▼
                    ┌──────────────────────┐
                    │  7. IDENTITY UPDATE   │  (unchanged)
                    └──────────────────────┘
```

### 5.2 State Extension

```python
# Additions to NarrativeState
class NarrativeState(BaseModel):
    # ... existing fields ...
    
    # [NEW] Council
    council_triggers: list[str] = Field(default_factory=list)
    council_verdict: dict | None = None  # CouncilDecision
    council_instructions: str = ""       # Merged instructions for Writer
    skill_activation_ruling: dict | None = None  # Combat Judge ruling
    combat_ruling: dict | None = None    # Combat Judge combat outcome
```

### 5.3 LangGraph Sub-graph

```python
def build_council_subgraph() -> CompiledGraph:
    """Council sub-graph — fan-out to members, aggregate."""
    graph = StateGraph(CouncilState)
    
    graph.add_node("route", council_router)
    graph.add_node("narrative_director", run_narrative_director)
    graph.add_node("combat_judge", run_combat_judge)
    graph.add_node("identity_guardian", run_identity_guardian)
    graph.add_node("lore_keeper", run_lore_keeper)
    graph.add_node("aggregate", aggregate_verdicts)
    
    graph.set_entry_point("route")
    
    # Router decides which members to call
    graph.add_conditional_edges("route", route_to_members, {
        "combat_judge": "combat_judge",
        "narrative_director": "narrative_director",
        "identity_guardian": "identity_guardian",
        "lore_keeper": "lore_keeper",
    })
    
    # All members converge to aggregator
    for member in ["combat_judge", "narrative_director", 
                    "identity_guardian", "lore_keeper"]:
        graph.add_edge(member, "aggregate")
    
    graph.add_edge("aggregate", END)
    
    return graph.compile()
```

---

## 6. Practical Scenarios (Phase 1 Solo)

### 6.1 Scenario: Skill Activation during Combat

```
Chapter 15. Player "Minh" has skill "Vết Nứt Sự Thật" (Perception).
Player chọn: "Hỏi tên tướng cướp: 'Ai sai ngươi đến?'" (risk=3)

1. PLANNER output:
   beats: [
     {desc: "Đối đầu tướng cướp", tension: 7, purpose: "climax"},
     {desc: "Tướng cướp nói dối", tension: 8, purpose: "rising"},
   ]

2. COUNCIL GATE:
   triggers: [COMBAT, SKILL_ACTIVATION]
   → Convene: Combat Judge + Narrative Director

3. COMBAT JUDGE:
   - Skill check: "Vết Nứt Sự Thật"
     - Activation: "Khi trực tiếp hỏi với intent tìm sự thật" ✅
     - Cooldown: 3 chương, last used chương 11 → Available ✅
     - Effect: Detect lie, NOT reveal truth
   - Combat: Player DQS=68, risk=3, Tier 1 enemy
     - base_score = 0.65 → favorable
   - Verdict: APPROVE + skill activates

4. NARRATIVE DIRECTOR:
   - Pacing check: Chapter 15, skill first used chương 11
   - Assessment: "Timing tốt — skill reveal dần dần, đúng pacing"
   - Verdict: APPROVE

5. AGGREGATE: 2/2 APPROVE
   → Inject into Writer:
   "Skill 'Vết Nứt Sự Thật' KÍCH HOẠT. Player nhìn thấy vết nứt trên
    lời nói tướng cướp — hắn ĐANG NÓI DỐI. KHÔNG tiết lộ sự thật là gì.
    Combat outcome: Player thắng thế nhưng tướng cướp thoát được."

6. WRITER: Nhận council_instructions → viết prose tích hợp skill + combat
```

### 6.2 Scenario: Identity Drift Warning

```
Chapter 22. Player "Linh" — seed: protection, compassion.
3 chương gần đây liên tục sacrifice others for power.
instability = 58, coherence = 42

1. PLANNER output: normal exploration chapter

2. COUNCIL GATE:
   triggers: [IDENTITY_CRISIS]  (instability > 50)
   → Convene: Identity Guardian + Narrative Director

3. IDENTITY GUARDIAN:
   - Drift: "Significant — 3 straight choices against seed"
   - Assessment: alignment_with_seed = 0.35 (low!)
   - Echo of Origin: "Trong một khoảnh khắc yên lặng, Linh nhớ lại
     tiếng khóc — ai đó cần được bảo vệ"
   - Verdict: WARN + inject echo

4. NARRATIVE DIRECTOR:
   - Assessment: "Confrontation event chưa nên trigger (instability=58 < 70)"
   - "Nhưng nên build tension — thêm foreshadowing"
   - Verdict: MODIFY + thêm subtle warning beat

5. AGGREGATE: MODIFY
   → Writer receives: thêm echo moment + identity tension subplot
```

### 6.3 Scenario: Lore Contradiction Caught

```
Chapter 30. Writer draft mentions "Lão Trần chỉ đường cho Minh".
NeuralMemory: Lão Trần died in chapter 12.

1. COUNCIL GATE: triggers [LORE_CHECK] (NPC mentioned)

2. LORE KEEPER:
   - Check NeuralMemory context
   - Found: "Lão Trần bị giết bởi Shadow faction, chapter 12"
   - Verdict: REJECT
   - Suggestion: "Thay bằng Trần Nhị (con trai), hoặc ghost/memory"

3. AGGREGATE: REJECT
   → Planner re-plans with Lore Keeper's suggestion
```

---

## 7. Data Models

### 7.1 Council Models

```python
# app/models/council.py [NEW]

from enum import Enum
from pydantic import BaseModel, Field

class CouncilTrigger(str, Enum):
    COMBAT = "combat"
    SKILL_ACTIVATION = "skill"
    MAJOR_PLOT = "major_plot"
    IDENTITY_CRISIS = "identity"
    LORE_CHECK = "lore"

class MemberVerdict(BaseModel):
    member: str               # "combat_judge" | "narrative_director" | ...
    verdict: str              # "approve" | "modify" | "reject"
    reasoning: str = ""
    modifications: dict = Field(default_factory=dict)
    instructions_for_writer: str = ""
    instructions_for_planner: str = ""

class SkillActivationRuling(BaseModel):
    should_activate: bool = False
    skill_name: str = ""
    reason: str = ""
    effect_description: str = ""
    cooldown_remaining: int = 0

class CombatRuling(BaseModel):
    outcome: str = ""        # "favorable" | "mixed" | "unfavorable"
    winner: str = ""         # "player" | "enemy" | "draw" | "interrupted"
    damage_narrative: str = ""
    consequence_severity: str = "moderate"
    reasoning: str = ""

class CouncilDecision(BaseModel):
    verdict: str             # "approve" | "modify" | "reject"
    triggers: list[str] = Field(default_factory=list)
    member_verdicts: list[MemberVerdict] = Field(default_factory=list)
    
    # Derived outputs
    merged_writer_instructions: str = ""
    merged_planner_instructions: str = ""
    skill_ruling: SkillActivationRuling | None = None
    combat_ruling: CombatRuling | None = None
    
    # Meta
    retry_count: int = 0     # How many times council rejected and re-planned
```

---

## 8. Cost Analysis

### 8.1 Per Council Member Cost

| Member | Tokens In | Tokens Out | Cost (Gemini 2.5 Flash) |
|--------|-----------|------------|-------------------------|
| Narrative Director | ~600 | ~200 | ~$0.0004 |
| Combat Judge | ~800 | ~300 | ~$0.0006 |
| Identity Guardian | ~700 | ~250 | ~$0.0005 |
| Lore Keeper | ~600 | ~200 | ~$0.0004 |

### 8.2 Scenario Costs

| Scenario | Members | Extra Cost | Total Chapter Cost |
|----------|---------|-----------|-------------------|
| Normal (no council) | 0 | $0.000 | ~$0.003 |
| Skill activation only | 1 | $0.0006 | ~$0.004 |
| Combat + Narrative | 2 | $0.0010 | ~$0.004 |
| Full council (4) | 4 | $0.0019 | ~$0.005 |
| Full + 1 re-plan | 4+Planner | $0.0024 | ~$0.006 |

### 8.3 Blended Cost (Expected)

Assuming 90% fast path, 8% partial council, 2% full council:

```
Blended cost per chapter = 
  0.90 × $0.003 + 0.08 × $0.004 + 0.02 × $0.005
  = $0.0027 + $0.00032 + $0.0001
  = ~$0.0031
```

**Kết luận:** Chi phí tăng chỉ ~3% so với pipeline hiện tại, nhưng chất lượng quyết định tăng đáng kể cho combat/skill scenarios.

---

## 9. File Structure

```
app/
├── council/                     # [NEW] 
│   ├── __init__.py
│   ├── orchestrator.py          # Trigger detection + routing + aggregation
│   ├── narrative_director.py    # Dramatic quality assessor
│   ├── combat_judge.py          # Combat + skill arbitrator
│   ├── identity_guardian.py     # Identity coherence watchdog
│   └── lore_keeper.py           # Lore consistency verifier
│
├── models/
│   ├── council.py               # [NEW] Council data models
│   └── pipeline.py              # [MODIFY] Add council fields to NarrativeState
│
├── prompts/
│   ├── council_narrative.md     # [NEW]
│   ├── council_combat.md        # [NEW]
│   ├── council_identity.md      # [NEW]
│   └── council_lore.md          # [NEW]
│
└── narrative/
    └── pipeline.py              # [MODIFY] Insert council gate after Planner
```

---

## 10. Mở rộng cho Phase 2-4

| Phase | Council Changes |
|-------|----------------|
| **Phase 2: Shared World** | +World Advisor member (faction balance, world-state impact) |
| **Phase 3: MMO** | +Collision Arbitrator (player vs player), +Faction Strategist |
| **Phase 4: Full Universe** | +Empire Narrator (enemy empire perspective), +Cosmic Observer |

```
Phase 1: 4 members  →  Phase 4: 8 members
Cost:    ~$0.003/ch  →  ~$0.008/ch (still very cheap)
```

---

## 11. Implementation Priority

### Must-Have (Phase 1 MVP)
1. **Combat Judge** — trực tiếp ảnh hưởng gameplay fairness
2. **Council Orchestrator** — trigger detection + routing
3. **Skill Activation logic** — critical for gameplay feel

### Should-Have (Phase 1 Polish)  
4. **Narrative Director** — cải thiện story quality
5. **Lore Keeper** — ngăn contradictions  

### Nice-to-Have (Phase 1 Late)
6. **Identity Guardian** — enhance identity system (Identity Agent hiện tại đã handle baseline)

---

## Appendix: Decisions Log

| Câu hỏi | Quyết định | Lý do |
|----------|-----------|-------|
| Dùng framework ngoài? | Không — LangGraph native | Unified stack, no extra dep |
| Council cho mọi chapter? | Không — chỉ khi trigger | Cost & latency |
| Orchestrator là AI? | Không — deterministic | Fast, free, predictable |
| Verdict voting? | Unanimous safety (any reject = reject) | Prevent lore/balance breaks |
| Re-plan tối đa? | 2 lần | Avoid infinite loops |
| Combat outcome ai quyết? | Combat Judge (AI) + base formula (deterministic) | Balance narrative vs fairness |
| Skill activation ai quyết? | Combat Judge (AI) check conditions | Context-dependent, need AI |
