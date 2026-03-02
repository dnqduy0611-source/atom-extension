# AMOISEKAI — Consequence Router Spec

> Nâng cấp `simulator.py` (Agent 2) từ flat consequence prediction lên
> **causal chain reasoning** — hiểu không chỉ "điều gì xảy ra" mà "tại sao A dẫn đến B dẫn đến C".

---

## 1. Vấn đề với Simulator hiện tại

### Hiện trạng (`simulator.py`)

```
Choice + Planner beats + Player identity
    ↓
LLM + world context
    ↓
SimulatorOutput:
  consequences: list[flat dict]
  relationship_changes: list
  world_impact: str
  foreshadowing: list
  identity_alignment: dict
```

### Giới hạn của flat consequence model

**Vấn đề 1: Không có causal chain**

```
Current:
  consequences = ["A xảy ra", "B xảy ra", "C xảy ra"]

Missing:
  A xảy ra → VÌ player phản bội → dẫn đến B → vì B nên C có thể xảy ra → foreshadow D
```

Không có chain → Writer không thể tạo narrative với nhân-quả rõ ràng → story cảm giác episodic, không connected.

**Vấn đề 2: Không biết faction implications**

Player hành động liên quan đến một faction nhưng Simulator không output faction-specific consequences → World State Engine (Phase 2) thiếu data để update.

**Vấn đề 3: Unique Skill consequences bị flatten**

Khi player invoke Unique Skill, mechanic đặc biệt của nó (VD: contract, obfuscation) có những implication riêng mà flat consequence list bỏ qua.

**Vấn đề 4: Horizon mixing**

`immediate`, `delayed`, `long_term` consequences bị trộn vào cùng một list → Writer không biết nên foreshadow cái nào ngay và cái nào để sau.

---

## 2. Thiết kế Consequence Router

### Triết lý

**Simulator hiện tại**: "Hành động này có những hậu quả gì?"
**Consequence Router**: "Hành động này trigger chain A→B→C. Chain này intersect với world state như thế nào? Factions nào bị ảnh hưởng? Unique Skill mechanic đóng vai trò gì?"

### Vị trí trong pipeline

```
Current:
  Planner → Simulator → Context → Writer

After:
  Planner → [CONSEQUENCE ROUTER] → Context → Writer
                   │
                   ├── Causal chain reasoning
                   ├── Faction implications
                   ├── Unique Skill consequence layer
                   └── Horizon-sorted output
```

Consequence Router **thay thế** Simulator. Không chạy song song.

### Context Envelope (input)

```json
{
  "choice": {
    "text": "Phản bội Faction IronVeil để đứng về phía Faction Crimson",
    "action_category": "social",
    "skill_reference": "",
    "risk_level": 4,
    "player_intent": "Đổi phe để đạt được sức mạnh lớn hơn"
  },
  "planner_beats": [
    {"description": "Cuộc họp bí mật với đại diện Crimson", "scene_type": "dialogue"},
    {"description": "Ký kết thỏa thuận", "scene_type": "dialogue"}
  ],
  "chapter_context": {
    "chapter_number": 28,
    "previous_summary": "Player đã biết IronVeil đang lên kế hoạch tấn công làng...",
    "chapter_tension": 8
  },
  "player": {
    "archetype": "tactician",
    "dna_affinity": ["oath", "shadow"],
    "identity_coherence": 65.0,
    "notoriety": 42.0,
    "alignment": -15.0,
    "unique_skill_name": "Khế Ước Bóng Tối",
    "unique_skill_category": "contract",
    "unique_skill_stage": "bloom"
  },
  "world_context": {
    "known_factions": ["IronVeil", "Crimson", "The Wanderers"],
    "current_world_alignment": 0.15,
    "active_threats": ["IronVeil expansion campaign"]
  }
}
```

---

## 3. Output Schema

### Full `ConsequenceRouterOutput`

```json
{
  "causal_chains": [
    {
      "id": "chain_001",
      "trigger": "Player ký thỏa thuận với Crimson, cắt đứt IronVeil",
      "links": [
        "IronVeil mất một tài sản chiến lược (player)",
        "IronVeil gán bounty + điều tra danh tính thật của player",
        "Crimson nhận ra player có giá trị cao → đặt kỳ vọng lớn hơn",
        "World threat level từ IronVeil tăng đối với player cụ thể"
      ],
      "horizon": "immediate_to_long_term",
      "reversible": false,
      "cascade_risk": "high"
    },
    {
      "id": "chain_002",
      "trigger": "Unique Skill 'Khế Ước Bóng Tối' bị invoke trong thỏa thuận",
      "links": [
        "Thỏa thuận được binding bởi Contract mechanic — không thể phá vỡ đơn phương",
        "Player mất tự do chọn exit strategy với Crimson",
        "Skill resilience giảm nếu player sau này cố break contract"
      ],
      "horizon": "long_term",
      "reversible": false,
      "cascade_risk": "medium",
      "unique_skill_triggered": true
    }
  ],
  "consequences": [
    {
      "description": "IronVeil đặt bounty trung bình lên player",
      "severity": "major",
      "timeframe": "delayed",
      "reversible": false,
      "chain_id": "chain_001"
    },
    {
      "description": "Crimson cung cấp training facility tạm thời",
      "severity": "moderate",
      "timeframe": "immediate",
      "reversible": true,
      "chain_id": "chain_001"
    }
  ],
  "faction_implications": [
    {
      "faction": "IronVeil",
      "stance_change": "neutral → hostile",
      "reason": "Phản bội trực tiếp, mất tài sản chiến lược",
      "notoriety_contribution": 8.0
    },
    {
      "faction": "Crimson",
      "stance_change": "neutral → cautious_ally",
      "reason": "Ký thỏa thuận nhưng chưa prove loyalty",
      "notoriety_contribution": 2.0
    }
  ],
  "relationship_changes": [
    {
      "from_char": "Đại Diện IronVeil",
      "to_char": "Player",
      "old_relation": "employer",
      "new_relation": "enemy",
      "reason": "Phản bội thẳng mặt"
    }
  ],
  "world_state_updates": [
    "IronVeil threat level đối với player tăng từ 1 → 3",
    "Crimson–IronVeil tension tăng nhẹ do recruitment war"
  ],
  "world_impact": "Cán cân quyền lực khu vực Aelvyndor bắt đầu nghiêng về phía Crimson nếu player prove worth",
  "character_reactions": [
    {
      "character": "Đại Diện IronVeil",
      "reaction": "Tức giận kiềm chế, bắt đầu lên kế hoạch trả thù im lặng",
      "motivation": "Mặt mũi và tài nguyên"
    }
  ],
  "foreshadowing": [
    "Một cái bóng quen thuộc theo dõi player khi rời cuộc họp",
    "Khế ước phát sáng mờ — như thể đang nhớ điều gì đó"
  ],
  "identity_alignment": {
    "aligns_with_seed": false,
    "drift_indicator": "significant",
    "note": "DNA Affinity 'oath' mâu thuẫn trực tiếp với hành động phá vỡ lòng trung thành với IronVeil"
  },
  "writer_guidance": {
    "tone": "tense",
    "highlight_chains": ["chain_001", "chain_002"],
    "foreshadow_priority": "IronVeil revenge arc",
    "unique_skill_narrative_note": "Khế Ước Bóng Tối nên được mô tả với cảm giác binding thực sự — không chỉ ký tờ giấy"
  }
}
```

---

## 4. Causal Chain Design

### Cấu trúc một chain

```python
class CausalChain:
    id: str                   # "chain_001"
    trigger: str              # Sự kiện khởi động chain
    links: list[str]          # Các bước A → B → C (ordered)
    horizon: str              # "immediate" | "delayed" | "long_term" | "immediate_to_long_term"
    reversible: bool          # Chain có thể bị đảo ngược không?
    cascade_risk: str         # "low" | "medium" | "high" — khả năng sinh chain mới
    unique_skill_triggered: bool = False
    faction_involved: str = ""
```

### Quy tắc chain generation

**Rule 1: Độ dài chain theo risk level**

| Risk | Chain length | Reasoning |
|---|---|---|
| 1–2 | 1–2 links | Low-stakes, local effect |
| 3 | 2–3 links | Mid-stakes, some ripple |
| 4 | 3–4 links | High-stakes, faction-level ripple |
| 5 | 4–5 links | World-level cascade |

**Rule 2: Unique Skill mechanic tạo chain riêng**

Khi `skill_reference` không rỗng:
- Tạo riêng một chain với `unique_skill_triggered: true`
- Chain này phản ánh mechanic của skill (contract → binding consequence, obfuscation → information gap consequence...)
- Links trong chain phải consistent với `skill.mechanic` và `skill.weakness`

**Rule 3: DNA Affinity conflict tạo identity chain**

Khi action contradicts player's DNA Affinity tags:
- VD: Player có `oath` DNA → phản bội → tạo chain về "breaking oath mechanics"
- Chain này feed vào `identity_alignment.drift_indicator`

**Rule 4: Cascade risk**

| Cascade | Meaning |
|---|---|
| `low` | Chain kết thúc tại đây, không sinh thêm |
| `medium` | 1 link cuối có thể trigger chain mới ở chapter sau |
| `high` | Multiple downstream chains khả năng cao — Planner nên plan cho điều đó |

---

## 5. Faction Implications Layer

### Tại sao cần riêng

`relationship_changes` hiện tại chỉ track individual characters. Nhưng Amoisekai có faction-level implications:
- Player kill một soldier → IronVeil stance thay đổi, không chỉ soldier đó
- Player cứu một villager → faction của villager's village notice

### `faction_implications` schema

```python
class FactionImplication:
    faction: str              # Tên faction
    stance_change: str        # "neutral → hostile" | "ally → cautious" | v.v.
    reason: str               # Tại sao stance thay đổi
    notoriety_contribution: float  # Đóng góp vào player notoriety (0–10)
    reversible: bool          # Có thể repair relationship không?
    empire_resonance_delta: int = 0   # Feed vào villain_tracker.track_empire_resonance
    identity_anchor_delta: int = 0    # Feed vào villain_tracker.track_identity_anchor
```

### Phase dependency

Phase 1 (hiện tại): `world_context.known_factions` kết hợp static config + dynamic WorldState data:
- Static: config-defined factions
- Dynamic: `WorldState.emissary_status` (3 Emissary NPCs), `WorldState.general_status` (4 Generals), `WorldState.empire_allegiance`

Phase 2 (MMO): `world_context` đến từ Global World Brain (NeuralMemory) — real-time faction state.

Consequence Router được thiết kế để handle cả hai case — chỉ cần thay data source.

---

## 6. Writer Guidance Layer

### Mục đích

Consequence Router có cái nhìn toàn cục nhất về what happened và what will happen. Nó nên pass **narrative guidance** cho Writer thay vì để Writer tự figure out.

```python
class WriterGuidance:
    tone: str                          # "tense" | "hopeful" | "melancholic" | "triumphant"
    highlight_chains: list[str]        # Chain IDs Writer nên emphasize
    foreshadow_priority: str           # Cái gì cần foreshadow nhất trong chapter này
    unique_skill_narrative_note: str   # Nếu unique skill liên quan, gợi ý mô tả mechanic
    pacing_note: str                   # "slow burn" | "fast escalation" | "quiet aftermath"
```

Writer sẽ nhận `writer_guidance` như một soft instruction — không phải hard constraint (Critic vẫn evaluate độc lập).

---

## 7. Integration với Pipeline

### Thay đổi trong `NarrativeState`

```python
# Thay thế simulator_output: SimulatorOutput
consequence_output: ConsequenceRouterOutput | None = None

# Backward compat: giữ simulator_output làm alias
# (sau khi migrate hoàn toàn thì xóa)
simulator_output: SimulatorOutput | None = None
```

### Thay đổi trong `pipeline.py`

```python
async def _node_consequence(state: dict) -> dict:
    """Causal chain consequence prediction."""
    from app.narrative.consequence_router import run_consequence_router
    ns = _to_narrative_state(state)
    llm = _make_llm(settings.simulator_model, 0.5)
    return await run_consequence_router(ns, llm)
```

Node rename: `simulator` → `consequence` trong graph.

### Fallback

Nếu Consequence Router fail → fallback về `run_simulator()` hiện tại.
Output có thể thiếu `causal_chains` và `faction_implications` → Writer và Planner vẫn hoạt động (graceful degradation).

---

## 8. Implementation Notes

### File structure

```
app/narrative/consequence_router.py    ← agent mới
app/prompts/consequence_router.md      ← system prompt
app/models/pipeline.py                 ← thêm ConsequenceRouterOutput model
```

### ConsequenceRouterOutput model

```python
class CausalChain(BaseModel):
    id: str = ""
    trigger: str = ""
    links: list[str] = Field(default_factory=list)
    horizon: str = "immediate"
    reversible: bool = True
    cascade_risk: str = "low"
    unique_skill_triggered: bool = False
    faction_involved: str = ""

class FactionImplication(BaseModel):
    faction: str = ""
    stance_change: str = ""
    reason: str = ""
    notoriety_contribution: float = 0.0
    reversible: bool = True
    empire_resonance_delta: int = 0   # Feed → villain_tracker.track_empire_resonance
    identity_anchor_delta: int = 0    # Feed → villain_tracker.track_identity_anchor

class WriterGuidance(BaseModel):
    tone: str = "neutral"
    highlight_chains: list[str] = Field(default_factory=list)
    foreshadow_priority: str = ""
    unique_skill_narrative_note: str = ""
    pacing_note: str = ""

class ConsequenceRouterOutput(BaseModel):
    # Causal chains (new)
    causal_chains: list[CausalChain] = Field(default_factory=list)
    faction_implications: list[FactionImplication] = Field(default_factory=list)
    writer_guidance: WriterGuidance = Field(default_factory=WriterGuidance)

    # Backward compat with SimulatorOutput (keep same typed fields)
    consequences: list[dict] = Field(default_factory=list)
    relationship_changes: list[dict | RelChange] = Field(default_factory=list)
    world_state_updates: list[str] = Field(default_factory=list)
    world_impact: str = ""
    character_reactions: list[CharReaction] = Field(default_factory=list)
    foreshadowing: list[str] = Field(default_factory=list)
    identity_alignment: dict = Field(default_factory=dict)
```

### Temperature

`0.5` — thấp hơn Planner (0.7) và Writer (0.8) vì causal chain cần logic-consistent.
Creative enough cho reasoning nhưng không hallucinate chains vô lý.

### Token budget

Context envelope có thể lớn hơn simulator hiện tại (thêm player_context, world_context).

Giới hạn:
- `known_factions`: tối đa 5
- `previous_summary`: giữ ngắn (cũng giống simulator hiện tại)
- `planner_beats`: tối đa 5 beats (như simulator)
- `equipped_skills`: không pass vào đây (đã có trong Intent Classifier, không cần lặp)

---

## 9. Weapon/Equipment System — Dependency Note

Consequence Router được thiết kế sẵn để handle equipment consequences khi Weapon System ra:

```python
# Khi Weapon System có spec:
# 1. Thêm equipped_weapon vào context envelope
# 2. Thêm equipment_consequences vào output schema:
#    equipment_consequences: list[dict]  # resonance shifts, durability, etc.
# 3. FactionImplication có thể trigger từ weapon type (void weapon → void faction notices)
```

Không cần refactor core logic — chỉ extend context và output.

---

## 10. Rollout Plan

| Phase | Action |
|---|---|
| Phase 1A | Build `ConsequenceRouterOutput` model, implement basic version (causal_chains + backward compat consequences) |
| Phase 1B | Add `faction_implications` — test với known_factions từ world_context |
| Phase 1C | Add `writer_guidance` — measure impact on prose quality via Critic scores |
| Phase 2 | Connect `faction_implications` → Global World Brain (NeuralMemory update) |
| Phase Weapon | Extend context + output khi Weapon System spec complete |

---

## 11. Pending Decisions

| Câu hỏi | Options | Recommendation |
|---|---|---|
| Consequence Router thay Simulator hoàn toàn hay wrap? | Thay hoàn toàn / Wrap | **Thay hoàn toàn** — giữ fallback về simulator cũ |
| `writer_guidance` là hard constraint hay soft? | Hard (Critic enforce) / Soft (Writer chọn) | **Soft** — Writer có creative freedom |
| `causal_chains` có được lưu vào NeuralMemory không? | Yes / No | **Yes (Phase 2)** — chain là memory cho world brain |
| `faction_implications` có trigger immediate world event không? | Yes / Only Phase 2 | **Only Phase 2** |
| Max chains per chapter? | 2 / 3 / unlimited | **3** — đủ depth, không overwhelm Writer |

---

## 12. Villain System Integration

> Added post-audit: bridges Consequence Router ↔ Villain System (Sprint 1-6).

### Faction Implications → Villain Tracker

Khi `faction_implications` liên quan đến Empire:

```python
# Trong consequence_router.py, sau khi parse output:
for fi in output.faction_implications:
    if fi.empire_resonance_delta:
        track_empire_resonance(ws, fi.empire_resonance_delta,
                              reason=f"consequence_{fi.faction}")
    if fi.identity_anchor_delta:
        track_identity_anchor(ws, fi.identity_anchor_delta,
                              reason=f"consequence_{fi.faction}")
```

### Identity Alignment → Identity Anchor

`identity_alignment.drift_indicator` maps to anchor adjustments:

| drift_indicator | identity_anchor_delta | Reasoning |
|---|---|---|
| `none` | 0 | Hành động consistent |
| `minor` | -3 | Nhẹ, recoverable |
| `significant` | -8 | Drift rõ ràng |
| `critical` | -15 | Core value violation |

### Causal Chains from General Encounters

Khi chain liên quan đến General encounter:
- `faction_involved: "empire"` → Consequence Router biết đây là villain-related chain
- Chain links có thể reference General philosophy → Writer weave vào prose
- `cascade_risk: "high"` trên Empire chains → trigger Veiled Will phase check

### Context Envelope Extension

```python
# Thêm vào Context Envelope (§2):
"villain_context": {
    "empire_resonance": 45,
    "identity_anchor": 70,
    "empire_allegiance": "none",
    "active_general": "vorn",
    "veiled_will_phase": 1,
    "absorbed_arguments": [...]
}
```

Điều này cho Consequence Router biết villain state hiện tại khi reasoning chains.
