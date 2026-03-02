# ⚔️ AMOISEKAI — Skill Catalog & Hybrid Generation Specification v1.0

> **Author:** Amo  
> **Date:** 2026-02-23  
> **Status:** Formalized  
> **Dependencies:** POWER_SYSTEM_SPEC v1.1, COMBAT_SYSTEM_SPEC v1.1, SKILL_EVOLUTION_SPEC v1.0, SOUL_FORGE_SPEC  
> **Design Decision:** Hybrid model — pre-built mechanical skeletons + AI narrative wrapping. Balance-safe yet narratively unique.

---

## 1. Triết lý Hybrid Generation

> Cơ học cố định. Câu chuyện linh hoạt.  
> Mỗi player nhận cùng "xương sống" nhưng mặc "áo" khác nhau.

### 1.1 Three-Layer Skill Model

```
┌────────────────────────────────────────────────────┐
│               SKILL = 3 LAYERS                     │
│                                                    │
│  Layer 1: SKELETON (Pre-built, from catalog)       │
│  ├── principle, mechanic, limitation, weakness     │
│  ├── damage_type, tier, archetype                  │
│  └── Balance = deterministic, tested               │
│                                                    │
│  Layer 2: NARRATIVE SKIN (AI-generated per player) │
│  ├── Display name (English, fit player story)      │
│  ├── Description (linked to player's journey)      │
│  └── Discovery story (how player found/earned it)  │
│                                                    │
│  Layer 3: EVOLUTION (Runtime, from gameplay)        │
│  ├── Refinement, Mutation, Integration, Awakening  │
│  └── See SKILL_EVOLUTION_SPEC                      │
└────────────────────────────────────────────────────┘
```

### 1.2 Generation Strategy per Tier

| Tier | Skeleton | Narrative | Cost |
|------|----------|-----------|------|
| **Tier 1** | Pre-built catalog (72 skills) | AI wraps name + desc per player | ~100 tokens |
| **Tier 2** (Integration) | Formula from principle-pair template | AI generates fused name + desc | ~200 tokens |
| **Tier 2** (Mutation) | AI transforms existing skill | AI generates mutated identity | ~500 tokens |
| **Tier 3+** | Phase 2 — deferred | — | — |

### 1.3 Future: Legend/Rare Promotion

Specific formula-generated Tier 2 skills có thể được "promote" thành **pre-defined Legend/Rare skills** trong future updates. Promotion yêu cầu:
- Narrative event đặc biệt (boss kill, season climax)
- Player meets identity conditions
- Engine flags eligibility → Planner creates promotion arc

> [!NOTE]
> Legend/Rare promotion là Phase 2+ content. Spec này chỉ define skeleton — promotion rules sẽ spec riêng.

---

## 2. Skill Template Structure

### 2.1 Skeleton Fields

```python
class SkillSkeleton:
    id: str                    # Unique catalog ID (e.g., "order_off_01")
    catalog_name: str          # English catalog name (for dev reference)
    principle: str             # Primary principle (Principle enum value)
    archetype: str             # "offensive" | "defensive" | "support" | "specialist"
    damage_type: str           # "structural" | "stability" | "denial"
    mechanic: str              # How the skill works mechanically
    limitation: str            # Primary constraint
    weakness: str              # What makes the skill exploitable
    delivery: str              # "melee" | "ranged" | "area" | "self" | "field"
    tags: list[str]            # For search/filter: ["burst", "shield", "dot", ...]
```

### 2.2 Damage Type System

Principle → damage_type mapping thay thế traditional physical/magical:

| Damage Type | Principles | Target | Thay thế |
|-------------|-----------|--------|----------|
| **structural** | Matter, Energy, Order (barrier) | HP | Physical / Elemental |
| **stability** | Entropy, Flux, Order (binding) | Stability bar | Magic / Psychic |
| **denial** | Void | Buff removal, stealth, suppression | Shadow / Void |

> [!IMPORTANT]
> Order là principle duy nhất có thể gây **cả structural lẫn stability** damage tùy skill. Xem catalog §3.1.

### 2.3 Archetype Distribution (per principle)

Mỗi principle có 12 skills phân bổ:

| Archetype | Count | Vai trò |
|-----------|-------|---------|
| **Offensive** | 4 | Direct damage, DoT, burst, AoE |
| **Defensive** | 3 | Shield, counter, dodge/guard |
| **Support** | 3 | Buff self/ally, debuff enemy, status |
| **Specialist** | 2 | Unique mechanic cho principle đó |

---

## 3. Tier 1 Skill Catalog — 72 Skills

### 3.1 ORDER — Trật Tự (structural / stability)

> "Cấu trúc là sức mạnh. Quy luật là vũ khí."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `order_off_01` | Order Strike | offensive | structural | melee | Structured impact — reliable, consistent damage | Short range | Predictable pattern |
| `order_off_02` | Law Bind | offensive | stability | ranged | Binds target in structured rules — stability drain | Line of sight required | Breaks on high instability target |
| `order_off_03` | Mandate Pulse | offensive | stability | area | AoE wave that disrupts chaotic entities | 3-phase cooldown | Friendly targets also slowed |
| `order_off_04` | Sequence Barrage | offensive | structural | ranged | Multi-hit projectiles in fixed pattern | Pattern is telegraphed | Dodgeable if pattern learned |
| `order_def_01` | Structure Shield | defensive | — | self | Frontal barrier absorbs incoming damage | Stationary while active | Side/back vulnerable |
| `order_def_02` | Rule Ward | defensive | — | field | Area protection zone — allies take less damage inside | Fixed position once placed | Costs stability to maintain |
| `order_def_03` | Sequence Counter | defensive | structural | melee | Predicts and counters enemy attack pattern | Requires 1 phase observation first | Fails vs chaotic enemies |
| `order_sup_01` | Discipline Stance | support | — | self | Stability regen over time, resist disruption | Cannot use offensive skills during | Broken by forced movement |
| `order_sup_02` | Regulation Field | support | stability | field | Debuff zone — enemies slowed, skill cooldown increased | Small radius | Costs stability per phase |
| `order_sup_03` | Predict | support | — | ranged | Read enemy's next probable action (partial info) | Single target only | Unreliable vs Flux/Entropy enemies |
| `order_spe_01` | Axiom Anchor | specialist | — | self | Prevents forced movement, knockback, displacement | Rooted in place | Immobile = easy target for AoE |
| `order_spe_02` | Decree | specialist | stability | ranged | Marks target — all incoming damage increased | One mark at a time | Mark visible = target knows |

### 3.2 ENTROPY — Hỗn Loạn (stability)

> "Mọi cấu trúc đều có vết nứt. Hỗn loạn chỉ cần tìm thấy nó."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `entropy_off_01` | Entropy Shred | offensive | stability | melee | Tear apart target's structural integrity | Proximity only | Self-instability +2 |
| `entropy_off_02` | Decay Bolt | offensive | stability | ranged | Corroding projectile — stability drain over time | DoT, not burst | Slow projectile speed |
| `entropy_off_03` | Chaos Burst | offensive | stability | area | AoE destabilization wave | High stability cost (20) | Affects self if too close |
| `entropy_off_04` | Unravel Beam | offensive | stability | ranged | Focused beam that strips defensive buffs | Channel — interruptible | No damage, only debuff |
| `entropy_def_01` | Dissolution Cloak | defensive | stability | self | Damage aura — melee attackers take stability drain | Costs stability per phase | No protection vs ranged |
| `entropy_def_02` | Entropy Dodge | defensive | — | self | Chaotic movement — hard to predict/target | Random direction | May dodge into worse position |
| `entropy_def_03` | Feedback Loop | defensive | stability | self | Reflect portion of stability damage back to attacker | Only reflects stability damage | Doesn't block structural |
| `entropy_sup_01` | Corrode | support | stability | ranged | Debuff — reduce target's defensive stats | Single target | Wears off after 2 phases |
| `entropy_sup_02` | Chaos Field | support | stability | field | Area denial — entering zone causes stability drain | Fixed position | Self-zone also affected |
| `entropy_sup_03` | Destabilize | support | stability | melee | Single target focus — massive stability shred | Touch range, slow activation | Leaves user exposed |
| `entropy_spe_01` | Cascade Failure | specialist | stability | ranged | Chain reaction — damage spreads to adjacent enemies | Needs 2+ enemies clustered | Self-instability +5 |
| `entropy_spe_02` | Entropy Siphon | specialist | stability | melee | Drain target stability → convert to own stability | Touch range, channel | Interrupted by any hit |

### 3.3 MATTER — Vật Chất (structural)

> "Vật chất không cần thoả hiệp. Nó chỉ cần tồn tại đủ lâu."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `matter_off_01` | Iron Fist | offensive | structural | melee | Heavy physical strike — high base damage | Short range, slow | Telegraphed startup |
| `matter_off_02` | Stone Spike | offensive | structural | ranged | Earth projectile from ground | Needs solid ground | No effect on flying/phased |
| `matter_off_03` | Quake Slam | offensive | structural | area | Ground impact — AoE damage | Self-root during animation | Airborne enemies immune |
| `matter_off_04` | Boulder Crush | offensive | structural | ranged | Heavy projectile — highest single-target damage Tier 1 | Very slow, 3-phase cooldown | Easy to dodge |
| `matter_def_01` | Matter Shield | defensive | — | self | Solid frontal barrier — high HP absorption | Stationary, frontal only | Side flanking |
| `matter_def_02` | Bastion Wall | defensive | — | field | Create cover wall — blocks projectiles for area | Fixed position, breakable | AoE bypasses |
| `matter_def_03` | Granite Counter | defensive | structural | melee | Absorb hit → return amplified physical damage | Only counters melee | Timing-dependent |
| `matter_sup_01` | Fortify | support | — | self | Self-buff — structural damage resistance increase | Duration 2 phases | No stability protection |
| `matter_sup_02` | Weight Bind | support | — | ranged | Debuff — increase target weight, reduce mobility | Single target | Flux enemies resist |
| `matter_sup_03` | Earth Spike Trap | support | structural | field | Delayed trap — triggers on enemy entry | Setup time 1 phase | Visible trap, avoidable |
| `matter_spe_01` | Reshape | specialist | — | field | Alter terrain — create obstacles or bridges | Requires existing matter | Costs stability 15 |
| `matter_spe_02` | Iron Skin | specialist | — | self | Convert 20% stability → temporary structural armor | Stability sacrifice | Below 30 stability = risky |

### 3.4 FLUX — Linh Hoạt (stability)

> "Không chống lại. Không chạy khỏi. Chỉ cần thay đổi nhanh hơn."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `flux_off_01` | Phase Strike | offensive | stability | melee | Phase through defenses — ignores shields | Touch range | Self-instability +2 |
| `flux_off_02` | Flux Bolt | offensive | stability | ranged | Shifting projectile — changes trajectory mid-flight | Unpredictable accuracy | May miss entirely |
| `flux_off_03` | Ripple Wave | offensive | stability | area | Reality ripple — disrupts all in area | Small radius | Friendly fire possible |
| `flux_off_04` | Vector Strike | offensive | structural | melee | Move + attack combo — momentum converts to damage | Needs running start | Locked into trajectory |
| `flux_def_01` | Flow Guard | defensive | — | self | Adaptive shield — shifts to block incoming attack type | Brief window only | Multi-hit breaks it |
| `flux_def_02` | Phase Dodge | defensive | — | self | Phase out of reality briefly — complete avoidance | 3-phase cooldown | Instability +1 per use |
| `flux_def_03` | Redirect | defensive | — | self | Redirect incoming attack to nearby target/area | Requires nearby redirect target | High skill ceiling |
| `flux_sup_01` | Accelerate | support | — | self | Self-buff — speed increase, extra action possibility | Duration 1 phase | Stability drain while active |
| `flux_sup_02` | Distortion Field | support | stability | field | AoE debuff — confusion, accuracy reduction | Costs stability 10/phase | Affects allies too |
| `flux_sup_03` | Flux Disruption | support | stability | ranged | Cancel target's current action/channel | Single use per encounter | Narrow timing window |
| `flux_spe_01` | Momentum Surge | specialist | structural | melee | Chain consecutive attacks — each hit +10% damage | Must keep attacking, no pause | One miss = chain breaks |
| `flux_spe_02` | Adaptive Form | specialist | — | self | Temporarily shift primary principle to counter enemy | 1 phase duration, 5-phase cooldown | High instability +5 |

### 3.5 ENERGY — Năng Lượng (structural)

> "Năng lượng không biết nhân nhượng. Nó chỉ biết cháy — hoặc không."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `energy_off_01` | Energy Burst | offensive | structural | melee | Close-range energy explosion — high burst | Proximity only | Self-damage if stability < 30 |
| `energy_off_02` | Spark Bolt | offensive | structural | ranged | Fast energy projectile — reliable damage | Low damage per hit | No secondary effects |
| `energy_off_03` | Shockwave | offensive | structural | area | Expanding energy wave — damage decreases with distance | Centered on self | Close allies affected |
| `energy_off_04` | Thermal Strike | offensive | structural | melee | Superheated impact — HP damage + burn DoT | Slow windup | Costs stability 15 |
| `energy_def_01` | Energy Barrier | defensive | — | self | Energy shield — absorbs fixed damage amount | Drains stability over time | Burst damage overloads it |
| `energy_def_02` | Charge Field | defensive | structural | field | Protective zone — enemies inside take damage | Fixed position, energy cost | Drains stability 5/phase |
| `energy_def_03` | Overload Counter | defensive | structural | self | Absorb energy attack → overload → return 150% damage | Only energy/structural attacks | Mistime = full damage taken |
| `energy_sup_01` | Power Surge | support | — | self | Self-buff — next attack +40% damage | Single next attack only | 3-phase cooldown |
| `energy_sup_02` | Drain Pulse | support | structural | area | AoE weak damage — drain energy from environment | Low damage | No effect in void zones |
| `energy_sup_03` | Ignite | support | structural | ranged | DoT debuff — burning damage over 3 phases | Single target | Water/void extinguishes |
| `energy_spe_01` | Arc Chain | specialist | structural | ranged | Chain lightning — jumps to 2 adjacent enemies | Needs clustered targets | Damage splits per jump |
| `energy_spe_02` | Conversion Core | specialist | — | self | Convert 15 HP → 25 stability (energy alchemy) | HP sacrifice | Can't use below 20 HP |

### 3.6 VOID — Hư Không (denial)

> "Void không phá huỷ. Nó chỉ... phủ nhận sự tồn tại."

| ID | Catalog Name | Archetype | Damage | Delivery | Mechanic | Limitation | Weakness |
|----|-------------|-----------|--------|----------|----------|-----------|----------|
| `void_off_01` | Null Strike | offensive | denial | melee | Strike removes 1 active buff from target | Touch range | No raw damage |
| `void_off_02` | Shadow Bolt | offensive | denial | ranged | Ranged damage + grants brief stealth | 2-phase cooldown | Stealth breaks on attack |
| `void_off_03` | Void Pulse | offensive | denial | area | AoE silence — enemies can't use skills for 1 phase | High stability cost (25) | Self also silenced |
| `void_off_04` | Absorption Touch | offensive | denial | melee | Absorb enemy attack → convert to stability | Requires incoming attack | Structural damage only partially absorbed |
| `void_def_01` | Void Cloak | defensive | — | self | Full stealth — enemies lose targeting | Broken by AoE or attacking | Stability cost per phase (5) |
| `void_def_02` | Null Ward | defensive | denial | field | Anti-skill zone — no skills work inside (allies too) | Fixed position | Everyone affected equally |
| `void_def_03` | Negation Counter | defensive | denial | self | Absorb and nullify incoming skill — skill cancelled | Only negates 1 skill | 4-phase cooldown |
| `void_sup_01` | Shadow Veil | support | — | self | Self-buff — evasion increase, harder to predict | 2 phases duration | Energy burst reveals |
| `void_sup_02` | Suppress | support | denial | ranged | Debuff — target's skill effectiveness -30% | Single target, 2 phases | High-resonance targets resist |
| `void_sup_03` | Void Anchor | support | denial | field | Tether target to location — can't move beyond radius | Channel — interruptible | Only 1 anchor at a time |
| `void_spe_01` | Erase | specialist | denial | ranged | Temporarily remove 1 target buff/skill (3 phases) | 5-phase cooldown | Target knows which skill erased |
| `void_spe_02` | Hollow Zone | specialist | denial | field | Create zone where all principle resonance weakened -20% | Fixed area, high cost (30 stability) | Self also weakened inside |

---

## 4. Skill Acquisition Flow — Progressive Discovery

> Player starts lean. Each new skill is a narrative reward, not a menu selection.

### 4.1 Post-Quiz: Unique Skill Only

```
Soul Forge Quiz Complete
     ↓
1 Unique Skill generated (via SOUL_FORGE_SPEC)
     ↓
NarrativePrinciple → resonance_weights
  e.g., "Freedom" → {entropy: 0.6, flux: 0.3, void: 0.1}
     ↓
Player starts with: 1 Unique Skill only
Normal skills = 0 — all discovered through story
```

> [!NOTE]
> Player's first normal skill sẽ nhận qua sự kiện cốt truyện sớm (chapter 1-2). Planner phải ưu tiên trao skill trong early game.

### 4.2 Story-Based Discovery (100% of Normal Skills)

All normal skills are earned through narrative events:

| # | Source | Trigger | Principle Logic |
|---|--------|---------|----------------|
| 1 | **Floor Clear Reward** | Hoàn thành 1 tầng (không cần boss) | Principle chủ đạo của tầng |
| 2 | **Floor Boss Trophy** | Hạ boss tầng | Principle của boss |
| 3 | **Tower Exploration** | Phòng ẩn, rẽ nhánh, tương tác environment | Principle của khu vực |
| 4 | **NPC Encounter** | Gặp NPC — gift, trade, teaching | NPC's principle hoặc narrative fit |
| 5 | **Training Awakening** | Rest scene sau 3+ combats | Under-represented principle |
| 6 | **CRNG Breakthrough** | Breakthrough meter threshold | Random weighted by resonance |
| 7 | **Lore Secret** | Tìm lore ẩn sâu (rare) | Planner decides |

> [!IMPORTANT]
> Planner should award first normal skill in chapter 1-2. Early game: ~1 skill per 2-3 chapters. Frequency decreases at higher Ranks.

### 4.3 Player Choice on Discovery

Khi player tìm thấy skill mới, player có quyền lựa chọn:

```
Skill discovered!
     ↓
Player sees: name, description, principle, archetype
     ↓
┌─ [ACCEPT] → Skill added to inventory (owned, not necessarily equipped)
└─ [REJECT] → Skill bỏ qua, có thể tìm skill khác sau
```

> Player **không bị ép nhận** skill. Cho phép chiến thuật chọn lọc — chỉ thu thập skills phù hợp build.

### 4.4 Integration Slot Recovery

Khi 2 skill hợp nhất (Integration, ref SKILL_EVOLUTION_SPEC §5):

```
Equipped: [Skill A] [Skill B] [Skill C] [Skill D]
                ↓ Integration
Equipped: [Tier 2 Skill AB] [Skill C] [Skill D] [EMPTY]
                                                    ↑
                                         Có thể equip skill từ inventory
```

- Integration tiêu thụ 2 skills → tạo 1 Tier 2 → giải phóng 1 equipped slot
- Player có thể **ngay lập tức equip** 1 skill từ inventory vào slot trống
- Hoặc giữ slot trống cho skill sắp tìm được

### 4.5 Ownership Rules

| Rule | Value |
|------|-------|
| **Owned skills** | **Unlimited** — thu thập thoải mái |
| **Equipped slots** | **5** (1 Unique + 4 Normal) |
| **Swap timing** | Rest/between encounters only, never mid-combat |
| **Duplicates** | No — can't own the same skeleton twice |
| **Player choice** | Luôn được chọn nhận hoặc bỏ qua skill |
| **Integration recovery** | Slot trống sau Integration → equip từ inventory |

> [!NOTE]
> Unlimited ownership + player choice = strategic collecting. Balance comes from **equipped slot limits** and **resonance affinity** (low-resonance skills perform worse in combat). Collector balancing strategies planned for Phase 2.

---

## 5. AI Narrative Wrapping

### 5.1 Wrapping Prompt

Khi player nhận skill mới, AI wrap mechanical skeleton thành narrative skill:

```
Wrap this combat skill for a specific player.

## Skill Skeleton:
- Catalog: {catalog_name}
- Principle: {principle}
- Mechanic: {mechanic}
- Limitation: {limitation}

## Player Context:
- Narrative Principle: {narrative_principle}
- Current story arc: {current_arc_summary}
- Identity traits: {core_traits}
- How skill was earned: {source} (story/boss_reward/quiz)

## Rules:
1. Name: English, 2-3 words, evocative, fits player's journey
2. Description: 1-2 sentences linking skill to player's identity/story
3. Discovery line: 1 sentence — how the skill manifested
4. KEEP the mechanic and limitation intact — only change narrative framing
5. Do NOT invent new mechanical effects

## Output (JSON):
{
  "display_name": "...",
  "description": "...",
  "discovery_line": "..."
}
```

### 5.2 Wrapping Example

**Input:** `matter_def_01` (Matter Shield) for a player with identity "protector of family"

```json
{
  "display_name": "Oath Wall",
  "description": "A barrier born from the promise to stand between harm and those you love. It doesn't need you to be strong — it needs you to not run.",
  "discovery_line": "The wall appeared the moment you thought of her. Not from training. From refusal."
}
```

**Same skeleton** for a player with identity "cold pragmatist":

```json
{
  "display_name": "Practical Barrier",
  "description": "An efficient structural barrier. No emotional weight — just physics applied correctly.",
  "discovery_line": "You calculated the force vectors and the shield simply... appeared."
}
```

### 5.3 Cost Estimate

| Operation | Tokens | Cost (Gemini Flash) |
|-----------|--------|---------------------|
| Narrative wrap (1 skill) | ~150 in + ~80 out | ~$0.0002 |
| Awakening skill (post-quiz) | ~150 in + ~80 out | ~$0.0002 |
| Story reward (1 skill) | ~150 in + ~80 out | ~$0.0002 |

> Rất rẻ — dưới $0.001 cho full initial kit.

---

## 6. Tier 2 Integration Formulae

### 6.1 Principle Pair Templates

Khi 2 Tier 1 skills merge (via Integration, SKILL_EVOLUTION_SPEC §5):

```python
PRINCIPLE_PAIR_TEMPLATE = {
    # (principle_a, principle_b): template
    
    # ── Opposing Pairs (high power, high instability) ──
    ("order", "entropy"): {
        "archetype_blend": "paradox",
        "mechanic_pattern": "structured_chaos",
        "instability_cost": "high",      # +5 instability per use
        "power_multiplier": 1.4,
        "flavor": "Order constrains Entropy — or tries to",
    },
    ("matter", "flux"): {
        "archetype_blend": "phase_material",
        "mechanic_pattern": "solid_shift",
        "instability_cost": "high",
        "power_multiplier": 1.4,
        "flavor": "Matter that refuses to stay in one form",
    },
    ("energy", "void"): {
        "archetype_blend": "dark_energy",
        "mechanic_pattern": "burst_absorb",
        "instability_cost": "high",
        "power_multiplier": 1.4,
        "flavor": "Energy poured into nothingness — or pulled from it",
    },

    # ── Adjacent Pairs (synergy, stable) ──
    ("order", "matter"): {
        "archetype_blend": "fortress",
        "mechanic_pattern": "structural_reinforce",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Structured matter — the strongest defense",
    },
    ("order", "energy"): {
        "archetype_blend": "directed_force",
        "mechanic_pattern": "focused_beam",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Energy with purpose and precision",
    },
    ("entropy", "flux"): {
        "archetype_blend": "dissolution",
        "mechanic_pattern": "shifting_decay",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Nothing stays the same — nothing stays at all",
    },
    ("entropy", "void"): {
        "archetype_blend": "annihilation",
        "mechanic_pattern": "erase_existence",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Not just destruction — erasure from reality",
    },
    ("matter", "energy"): {
        "archetype_blend": "kinetic",
        "mechanic_pattern": "convert_force",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Mass in motion — physics at its most violent",
    },
    ("flux", "void"): {
        "archetype_blend": "phantom",
        "mechanic_pattern": "exist_not_exist",
        "instability_cost": "low",
        "power_multiplier": 1.1,
        "flavor": "Present one moment, void the next",
    },

    # ── Cross-Cluster Pairs (weak interaction, moderate instability) ──
    ("order", "flux"): {
        "archetype_blend": "controlled_change",
        "mechanic_pattern": "regulated_shift",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "Change within rules — evolution, not chaos",
    },
    ("order", "void"): {
        "archetype_blend": "reality_lock",
        "mechanic_pattern": "deny_and_bind",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "The void has structure too — if you know where to look",
    },
    ("entropy", "matter"): {
        "archetype_blend": "corrosion",
        "mechanic_pattern": "structural_decay",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "Even the hardest stone crumbles given time",
    },
    ("entropy", "energy"): {
        "archetype_blend": "meltdown",
        "mechanic_pattern": "explosive_decay",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "Energy unleashed without direction — beautiful and devastating",
    },
    ("matter", "void"): {
        "archetype_blend": "hollow_form",
        "mechanic_pattern": "empty_structure",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "A shell of matter with nothing inside",
    },
    ("flux", "energy"): {
        "archetype_blend": "surge",
        "mechanic_pattern": "dynamic_power",
        "instability_cost": "moderate",
        "power_multiplier": 1.2,
        "flavor": "Power that never flows the same way twice",
    },
}
```

### 6.2 Integration Output Formula

```python
def generate_tier2_skill(skill_a, skill_b, template) -> NormalSkill:
    """Generate Tier 2 skill from 2 Tier 1 skills + principle pair template."""
    return NormalSkill(
        id=f"t2_{skill_a.principle}_{skill_b.principle}_{hash}",
        primary_principle=skill_a.principle,
        secondary_principle=skill_b.principle,
        tier=2,
        mechanic=f"{template['mechanic_pattern']}: "
                 f"combines {skill_a.mechanic} + {skill_b.mechanic}",
        limitation=_inherit_heavier_limitation(skill_a, skill_b),
        weakness=_combine_weaknesses(skill_a, skill_b),
        # ... AI wraps the rest
    )
```

### 6.3 Integration AI Prompt

```
Create a Tier 2 skill from two merged Tier 1 skills.

## Skill A: {skill_a.display_name}
- Principle: {skill_a.principle}
- Mechanic: {skill_a.mechanic}

## Skill B: {skill_b.display_name}
- Principle: {skill_b.principle}
- Mechanic: {skill_b.mechanic}

## Pair Template:
- Archetype: {template.archetype_blend}
- Flavor: {template.flavor}

## Player Context:
{player_story_summary}

## Rules:
1. Name: English, 2-4 words, reflects fusion of both skills
2. Mechanic: MUST combine both source mechanics, enhanced
3. Limitation: inherit the heavier constraint
4. Description links to player's journey of mastering both principles

## Output (JSON):
{
  "display_name": "...",
  "description": "...",
  "mechanic": "...",   
  "limitation": "...",
  "discovery_line": "..."
}
```

---

## 7. Planner Integration

### 7.1 Skill Reward Planning

```python
def plan_skill_reward(player, chapter_context) -> dict | None:
    """Decide if this chapter should reward a new skill.
    
    Conditions for skill reward:
    - Story context supports discovery (NPC, exploration, aftermath)
    - Player hasn't received a skill in last 2-3 chapters
    - Prefer under-represented principles in player's collection
    - No duplicate skeletons
    
    Note: No cap on owned skills — player can collect freely.
    Returns skill_reward_plan or None.
    """
    # Determine which principle to reward
    underrepresented = _find_underrepresented_principle(
        player.owned_skills,
        player.resonance,
    )
    
    # Select from catalog, exclude already owned
    candidates = [
        sk for sk in get_skills_by_principle(underrepresented)
        if sk.id not in player.owned_skill_ids
    ]
    
    if not candidates:
        return None  # Player owns all skills for this principle
    
    return {
        "reward_type": "new_skill",
        "candidate_ids": [c.id for c in candidates[:3]],
        "narrative_source": chapter_context.reward_source,
    }
```

### 7.2 Skill Catalog Integration with Combat Beat

Khi Planner tạo combat beat, nó phải biết player's equipped skills để:
1. Chọn enemy counter (enemy principle opposing player's main skill)
2. Hint đúng tương tác trong combat brief
3. Tạo narrative tension ("skill X bị vô hiệu bởi environment Y")

---

## 8. Data Models (Python)

```python
# app/models/skill_catalog.py [NEW — Phase C implementation]

from enum import Enum
from pydantic import BaseModel, Field
from app.models.power import NormalSkill, Principle


class SkillArchetype(str, Enum):
    OFFENSIVE = "offensive"
    DEFENSIVE = "defensive"
    SUPPORT = "support"
    SPECIALIST = "specialist"


class DamageType(str, Enum):
    STRUCTURAL = "structural"    # HP damage (matter, energy, order)
    STABILITY = "stability"      # Stability drain (entropy, flux, order)
    DENIAL = "denial"           # Void effects (suppress, stealth, absorb)


class DeliveryType(str, Enum):
    MELEE = "melee"
    RANGED = "ranged"
    AREA = "area"
    SELF = "self"
    FIELD = "field"


class SkillSkeleton(BaseModel):
    """Pre-built skill template from catalog."""
    id: str
    catalog_name: str
    principle: str
    archetype: SkillArchetype
    damage_type: DamageType
    delivery: DeliveryType
    mechanic: str
    limitation: str
    weakness: str
    tags: list[str] = Field(default_factory=list)


class NarrativeSkin(BaseModel):
    """AI-generated narrative wrapping for a skill."""
    display_name: str = ""
    description: str = ""
    discovery_line: str = ""


class PlayerSkill(BaseModel):
    """A skill as owned by a player — skeleton + narrative + runtime."""
    skeleton_id: str            # References SKILL_CATALOG
    skeleton: SkillSkeleton     # The mechanical template
    narrative: NarrativeSkin    # AI-generated wrapping
    
    # Runtime state (from SKILL_EVOLUTION_SPEC)
    usage_count: int = 0
    refined: bool = False
    mutated: bool = False
    awakened_principle: str = ""


class PrinciplePairTemplate(BaseModel):
    """Template for Tier 2 integration."""
    archetype_blend: str
    mechanic_pattern: str
    instability_cost: str       # "low" | "moderate" | "high"
    power_multiplier: float
    flavor: str
```

---

## 9. Phase Scope

### Phase 1 — Must Have

| Component | Chi tiết |
|-----------|----------|
| 72 Tier 1 skill skeletons | All defined in catalog |
| `SKILL_CATALOG` dict | Loaded at startup |
| Story-based discovery | All normal skills via narrative events |
| AI narrative wrapping | Prompt + integration |
| `DamageType` enum | structural / stability / denial |
| Story reward logic | Planner integration — progressive discovery |
| Unlimited ownership | Player collects freely, balance via equipped slots |

### Phase 2+

| Component | Phase |
|-----------|-------|
| Legend/Rare skill promotion | Phase 2 |
| Tier 3 skills (with rare principles) | Phase 2 |
| Mythic skills (lore-gated) | Phase 2 |
| Pre-defined legendary recipes | Phase 2 (from formula → handcrafted) |
| Skill visual effects | Phase 3 (client) |

---

## 10. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| AI KHÔNG tự tạo mechanic | Balance control |
| AI CHỈ wraps narrative (name + desc) | Mechanical consistency |
| Max 72 Tier 1 skeletons in catalog | Scope control cho solo dev |
| No duplicate skeletons per player | Variety enforcement |
| **Owned skills = unlimited** | Encourage exploration, balance via equipped slots |
| Equipped slots = 5 (1 Unique + 4 Normal) | Prevent combat power creep |
| Skill swap only during rest | No mid-combat respec |
| Integration recipe = formula, not freestyle | Predictable Tier 2 output |
| Collector balancing | Phase 2 — TBD strategies |
| **Healing = Unique Skill ONLY** | Catalog có 0 healing skills. Healing chỉ từ Soul Forge khi player đạt 3 điều kiện đồng thời (xem SOUL_FORGE_SPEC §6.2 rule 7). ~10-15% player có healing — rarity = balance |

---

## Appendix A: Skill Count Summary

| Principle | Offensive | Defensive | Support | Specialist | Total |
|-----------|-----------|-----------|---------|------------|-------|
| Order | 4 | 3 | 3 | 2 | **12** |
| Entropy | 4 | 3 | 3 | 2 | **12** |
| Matter | 4 | 3 | 3 | 2 | **12** |
| Flux | 4 | 3 | 3 | 2 | **12** |
| Energy | 4 | 3 | 3 | 2 | **12** |
| Void | 4 | 3 | 3 | 2 | **12** |
| **Total** | 24 | 18 | 18 | 12 | **72** |

## Appendix B: Principle Pair Template Count

| Pair Type | Count | Instability | Power |
|-----------|-------|-------------|-------|
| Opposing (Order↔Entropy, etc.) | 3 | High (+5) | ×1.4 |
| Adjacent (Order-Matter, etc.) | 6 | Low (+1) | ×1.1 |
| Cross-cluster (Order-Flux, etc.) | 6 | Moderate (+3) | ×1.2 |
| **Total unique pairs** | **15** | — | — |
