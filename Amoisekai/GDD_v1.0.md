# 🌌 AMOISEKAI — Game Design Document v1.0

> **Subtitle:** AI-Driven MMO Narrative Universe  
> **Author:** Amo  
> **Date:** 2026-02-22  
> **Status:** Draft — Approved Decisions Consolidated  
> **Stack:** FastAPI + LangGraph + NeuralMemory + Gemini 2.5 Flash + Supabase

---

## 1. Product Vision

### 1.1 Core Identity

> Người chơi không "cày level".  
> Người chơi trở thành một nhân vật trong một bộ anime đang sống.

- Không Pay-to-Win. Không bán power, stat, skill, RNG boost.
- Sức mạnh đến từ: **Controlled RNG** + **Quyết định chiến lược** + **Hệ quả narrative**
- **Identity > Level** — nhân vật được định nghĩa bởi lựa chọn, không bởi số

### 1.2 One-Line Pitch

*"Isekai MMO nơi AI viết câu chuyện riêng cho từng player, nhưng tất cả cùng sống trong 1 universe."*

### 1.3 Platform & Team

| Item | Decision |
|------|----------|
| Platform | Web app (MVP) → Mobile (sau) |
| Team | Solo vibe coding |
| AI Model | Gemini 2.5 Flash via `langchain-google-genai` |
| Memory | NeuralMemory (graph-based, spreading activation) |
| Backend | FastAPI (mở rộng từ AmoStories Engine) |
| Database | Supabase (auth, player state, world state) |
| Player Memory | NeuralMemory SQLite per player |

---

## 2. Universe Rules

### 2.1 Một Universe Duy Nhất

- 1 timeline chung, 1 world-state toàn server
- Nhiều tuyến truyện cá nhân chạy song song
- Async Shared: player chơi riêng nhưng ảnh hưởng lẫn nhau

### 2.2 Universe Philosophy — Balanced Dual Force

Hai lực luôn tồn tại:

| Lực | Ảnh hưởng |
|-----|-----------|
| **Internal Force** (Choice): quyết định, giá trị, lời hứa, phản bội | → Current Identity |
| **External Force** (World Pressure): faction, chiến tranh, biến cố global | → Instability + Drift |

Identity mới = f(Choice, Pressure, Echo)

### 2.3 Universe Tone

Isekai + political drama + psychological depth. Cân bằng giữa power fantasy và chiều sâu nhân vật. Không đen trắng — đạo đức xám.

---

## 3. Core Game Systems

### 3.1 Identity System (Hệ thống danh tính)

Mỗi player có 3 lớp identity:

```json
{
  "seed_identity": {},       // Tạo từ quiz ban đầu, không bao giờ xóa
  "current_identity": {},    // Cập nhật theo hành vi
  "latent_identity": {},     // Xu hướng đang hình thành
  "echo_trace": 0-100,       // Dư âm của seed trong hiện tại
  "identity_coherence": 0-100, // Hành vi khớp với seed?
  "instability": 0-100       // Mức bất ổn
}
```

**Vòng đời Identity:**
1. **Seed** → tạo từ onboarding quiz (3-5 DNA Affinity Tags)
2. **Drift** → hành vi lệch khỏi seed → coherence giảm, instability tăng
3. **Narrative Confrontation Event** → khi instability vượt ngưỡng
4. **Mutation** (có agency) → Player chọn: chấp nhận / từ chối / con đường thứ 3
5. **Echo of Origin** → seed luôn để lại vết tích dù mutation xảy ra

Mutation luôn là lựa chọn có ý thức. Không có "game lén thay đổi bạn". Tối đa 2-3 mutation lớn trong đời nhân vật.

---

### 3.2 Controlled RNG System (CRNG)

**Mục tiêu:** Ngẫu nhiên nhưng không phá cân bằng.

#### DNA Affinity System
- Mỗi player: 3-5 Affinity Tags ẩn (Shadow, Oath, Bloodline, Tech, Chaos, Mind, Charm, Relic)
- AI generate skill/item: 70% synergistic, 30% outlier → giảm "rác RNG"

#### Pity Timer (ẩn hoàn toàn)
- Nếu X chương không nhận major skill/relic/arc → xác suất tăng dần
- Không hiển thị, không gọi là pity → "định mệnh chuyển động"

#### Breakthrough Meter
- Tăng khi: high-risk decisions, giữ lời thề, theo đuổi arc cá nhân
- Khi đầy → unlock "Breakthrough Window" → AI generate arc đột phá

---

### 3.3 Catch-Up Mechanism

**Mục tiêu:** Người mới vẫn leo nhanh nếu chơi đúng.

#### Threat Tier Matching
- Tier 1 (local) → Tier 4 (global)
- Người mới gặp Tier thấp nhưng có xác suất **Rogue Event**: relic kén chủ, mentor phản diện, awakening bí mật

#### Decision Quality Score (DQS)
- Đo consistency chiến lược (không mâu thuẫn build, khai thác info đã có, chọn rủi ro đúng lúc)
- DQS cao → AI mở nhánh reward lớn hơn, unlock "high leverage arcs"
- Người mới max DQS nhanh → leo nhanh

#### Soft Cap + Diminishing Return
- Càng mạnh: Breakthrough khó hơn, event nguy hiểm hơn, xác suất betrayal cao
- Người top không snowball vô hạn

---

### 3.4 Anti-Snowball System

#### Notoriety System
- Mạnh → notoriety tăng → NPC elite săn, faction để ý, bounty xuất hiện
- Power lớn = rủi ro lớn

#### Resource Friction
- Skill mạnh: cooldown dài, điều kiện kích hoạt, cần sacrifice

#### World Reaction Engine
- Player top → Threat Level tăng → spawn đối trọng tự nhiên → faction cân bằng
- Không nerf trực tiếp, mà **lore reaction**

---

### 3.5 Unique Skill System

#### Skill Generation
- Từ Seed Identity + DNA Affinity → AI generate skill unique
- 5 archetype: Manifestation, Manipulation, Contract, Perception, Obfuscation
- Tam giác cân bằng: Perception ↔ Obfuscation ↔ Suppression

#### Secret by Default
- Skill mặc định bí mật, không hiển thị trên profile
- 3 cách lộ: Voluntary reveal, Pattern recognition (dùng nhiều), Perception skill
- Trust là tài nguyên, tiết lộ là rủi ro, bí mật là quyền lực

#### Skill Control
- **Suppression** (áp chế một phần): giảm hiệu quả, tăng cooldown
- **Seal** (phong ấn tạm): ritual, khu vực đặc biệt, contract
- **Anti-Unique Field** (vô hiệu hoàn toàn): cực hiếm, chi phí cao, hậu quả lớn
- Skill không thể bị đánh cắp (identity = linh hồn)

#### Instability
- Skill mất ổn định nếu sống trái identity (ẩn, player không biết cơ chế)
- Biểu hiện: nhiễu nhẹ → sai lệch → biến dị
- Có Re-alignment Arcs để hồi phục

```json
{
  "resilience": 0-100,
  "trait_tags": [],
  "instability": 0-100,
  "countered_by": []
}
```

---

### 3.6 Three Axis Power Model

Thay vì level, dùng 3 trục:

| Trục | Bao gồm | Lối chơi |
|------|---------|----------|
| **Combat Power** | Săn boss, solo dungeon, đánh tay đôi | Solo player |
| **Influence Power** | Faction, alliance, nation, reputation | Nation builder |
| **Strategic Power** | Thông tin, kế hoạch, chính trị, timing | Strategist |

Không cho 1 trục dominate. Mỗi trục tác động ở layer khác nhau:
- **Micro** (cá nhân) ← Solo player
- **Meso** (faction) ← Strategist
- **Macro** (world event) ← Nation builder

---

### 3.7 Origin Archetypes (thay vì Class)

6 archetypes, không khóa skill/weapon, chỉ bias 20-30% early arc:

| Archetype | Cách tiếp cận thế giới |
|-----------|----------------------|
| **Vanguard** | Đối diện trực tiếp |
| **Catalyst** | Thay đổi môi trường |
| **Sovereign** | Ảnh hưởng con người |
| **Seeker** | Khai thác bí ẩn |
| **Tactician** | Thao túng cục diện |
| **Wanderer** | Sống ngoài hệ thống |

Archetype có thể drift, hòa trộn, hoặc biến mất theo thời gian.

---

### 3.8 Fate Collision Engine

- Scan async (cron job): objective trùng, artifact trùng, faction đối nghịch
- Generate: shared chapter, asynchronous duel, political arc
- Không cần real-time, chỉ cần cùng world-state

---

### 3.9 Nation Building (Late-game)

Unlock khi đạt: Influence threshold + DQS threshold + có followers
- Không phải menu "Create Kingdom"
- AI generate arc: NPC đề xuất, lãnh thổ bỏ hoang, dân tị nạn
- Unique Skill ảnh hưởng style quốc gia (Oath → loyalty pact, Chaos → bất ổn)
- Có instability, rebellion risk, resource drain

---

### 3.10 Enemy Empire (5 tầng)

| Tầng | Mô tả | Lối chơi |
|------|-------|----------|
| 1. Outer Corruption | Dị biến, tay sai cấp thấp | Solo farm |
| 2. Regional Generals | Mỗi tướng có triết lý, quân đội riêng | Arc lớn |
| 3. Inner Circle | 3-7 thực thể, counterpart archetype | Strategist |
| 4. Capital Domain | Reality biến dạng, skill hoạt động khác | End-game |
| 5. Final Entity | Có ý thức, có triết lý về evolution | Cosmic |

Boss Empire phản ứng với world-state, không phải scripted raid. Player có thể gia nhập phe Empire.

---

### 3.11 Cosmic Architecture

#### Cosmic Threat — "The Veiled Will"
- Giai đoạn 1: Thảm họa (không mặt, không tên, chỉ hậu quả)
- Giai đoạn 2: Pattern Recognition (strategist nghi ngờ)
- Giai đoạn 3: Revelation (lộ ra ý chí phía sau)
- Scale lên tầng 2 khi đủ users + funding

#### Cosmic Democracy
- Chu kỳ mới do tập thể quyết định qua hành động thật (không vote menu)
- World Alignment Meter ẩn:
```json
{
  "world_instability": 0-100,
  "collective_alignment": { "order": 0, "evolution": 0, "freedom": 0, "reset": 0 }
}
```

---

### 3.12 Fate Buffer (Early-Game Protection)

- Ẩn hoàn toàn, player không biết tồn tại
- Early game (0-15 chương): chết chuyển thành arc thay vì game over
- Giảm dần: chương 20 → 50%, chương 40 → gần 0
- Lore-consistent: "linh hồn mới chưa bị ràng buộc định mệnh"
- Sau này player có thể phát hiện "thế giới đã từng bảo vệ mình"

---

## 4. MMO Architecture — Async Shared Universe

### 4.1 Model

- Tất cả player cùng 1 universe, shared world-state
- Mỗi player chơi theo pace riêng (không cần online cùng lúc)
- World-state update mỗi 6-24h qua cron job
- Không cần WebSocket, không cần real-time

### 4.2 Global World State

```json
{
  "factions": [],
  "power_balance": {},
  "global_conflicts": [],
  "major_events": [],
  "artifact_registry": {},
  "threat_level": 0-100,
  "world_instability": 0-100,
  "collective_alignment": {}
}
```

### 4.3 Player State

```json
{
  "dna_affinity": [],
  "alignment": -100-100,
  "reputation": {},
  "notoriety": 0-100,
  "decision_quality_score": 0-100,
  "breakthrough_meter": 0-100,
  "pity_counter": 0,
  "major_flags": [],
  "relationships": {},
  "seed_identity": {},
  "current_identity": {},
  "latent_identity": {},
  "echo_trace": 0-100,
  "identity_coherence": 0-100,
  "instability": 0-100,
  "archetype": "string",
  "chapter_count": 0,
  "fate_buffer": 0-100,
  "turns_today": 0
}
```

### 4.4 MMO Feel Without Real-Time

| Feature | Implementation |
|---------|---------------|
| Leaderboard | Narrative titles only (no numbers). Update 6-24h |
| World Events Feed | "Thành phố X sụp đổ do hành động bí ẩn" |
| Indirect interaction | Dấu vết dungeon, artifact claimed, NPC nhắc player khác |
| Fate Collision | Cron scan objectives → shared plot points |

---

## 5. Interaction Model

### 5.1 Chapter Flow

```
Player bấm "Chơi tiếp"
    ↓
AI generate chương mới (SSE streaming)
    ↓
Cuối chương hiển thị:
    ├─ Choice 1 (risk indicator)
    ├─ Choice 2 (risk indicator)
    ├─ Choice 3 (risk indicator)
    └─ Viết lựa chọn riêng (free input)
    ↓
Player chọn → trigger chương tiếp
```

### 5.2 Chapter Cadence — Hybrid

- Player-driven (bấm chơi tiếp khi muốn)
- Soft cap: **5 chương miễn phí/ngày**
- Pro users: thêm turn hoặc unlimited
- Mỗi chương: 1000-3000 từ, ~10-30 giây generate

### 5.3 Chapter Content

- Prose Việt Nam (văn phong tiểu thuyết)
- Miêu tả chiến đấu, cảm xúc, nội tâm
- References world-state hiện tại
- Nhắc đến hành động player khác (qua world events)
- Kết thúc bằng 3 choices + 1 free input

---

## 6. NeuralMemory Brain Architecture

### 6.1 Multi-Brain System

| Brain | Scope | Lưu gì |
|-------|-------|--------|
| **Player Brain** (1/user) | Cá nhân | Identity, skill, relationships, arc, decisions |
| **Global World Brain** (1) | Server | Factions, artifacts, threats, major events |

### 6.2 Tại sao NeuralMemory thay vì Vector Search?

- Truyện cần **relationships + causal chains**, không chỉ similarity
- `BETRAYED` → trace nguyên nhân → tìm full context chain
- Spreading activation tìm liên kết multi-hop tự nhiên
- Decay + Consolidation phù hợp long-running narrative

---

## 7. Extended Narrative Pipeline (7 Agents)

Mở rộng từ AmoStories 5-agent pipeline:

```
Player choice/input
    ↓
1. PLANNER          → chapter outline (Gemini)
    ↓ (parallel)
2. SIMULATOR        → consequences (Gemini)
3. CONTEXT          → NeuralMemory Player Brain query
4. WORLD CONTEXT    → NeuralMemory Global Brain + World State  [MỚI]
    ↓
5. WRITER           → prose + choices (Gemini, SSE stream)
    ↓
6. CRITIC           → score, loop ≤3x (Gemini)
    ↓
7. IDENTITY UPDATE  → update DQS, coherence, instability, notoriety  [MỚI]
```

### Chi phí per chapter: ~$0.002-0.005

---

## 8. Monetization

> 📄 Chi tiết: [MONETIZATION_SPEC.md](./MONETIZATION_SPEC.md)

### Nguyên tắc: Scale First → Monetize Gradually

### ❌ Không bán (No P2W):
- Stat, Skill, Item, RNG boost, DQS boost, Breakthrough skip

### 5 dòng doanh thu (theo thứ tự bật):

| # | Source | Phase | Revenue Type |
|---|--------|-------|-------------|
| 1 | Rewarded Ads | Phase 1a | Revenue floor |
| 2 | Pro Subscription (79k₫/tháng) | Phase 1b | Recurring |
| 3 | Crystal (in-app currency) | Phase 2 | Consumable |
| 4 | Cosmetic Shop | Phase 2-3 | One-time |
| 5 | Season Pass | Phase 3+ | Seasonal |

### Unit Economics
- Cost: ~$0.005/chapter → $0.10/user/ngày (20 ch)
- Pro sub: $3.19/tháng → margin ~86%
- Target: 10K DAU × $0.96 ARPU = **~$9,600/tháng**

---

## 9. Development Roadmap

### Phase 1 — Single Player Isekai (3-4 tuần)
- Identity System (Seed → Drift)
- Extended pipeline (7 agents)
- CRNG + Fate Buffer
- Web app basic UI
- 20-30 chương playable

### Phase 2 — Shared World (4-5 tuần)
- Global World Brain
- World-State Engine + Supabase
- Async MMO model
- World Events Feed + Leaderboard
- Player authentication

### Phase 3 — MMO Systems (6-8 tuần)
- Fate Collision Engine
- Anti-snowball (Notoriety, Soft Cap)
- Faction system
- Indirect player interaction

### Phase 4 — Full Universe (8+ tuần)
- Nation building
- Enemy Empire Arc 1
- Cosmic Threat progression
- Cosmic Democracy events

---

## 10. Risk Analysis

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI narrative quality inconsistent | High | Critic agent + rewrite loop + prompt tuning |
| State explosion (many players) | High | Abstraction scores, không simulate chi tiết |
| NeuralMemory performance at scale | Medium | Benchmark early, partition by faction |
| Player không hiểu hệ thống sâu | Medium | Onboarding narrative, gradual reveal |
| Solo dev burnout | Medium | Phase-based, MVP first |
| Chi phí AI scale lên | Low | Gemini rất rẻ (~$0.002/chapter) |

---

## Appendix A: Decisions Log

| Câu hỏi | Quyết định | Source |
|----------|-----------|--------|
| Chết vĩnh viễn? | Có, nhưng Fate Buffer ẩn 15 chương đầu | FATE BUFFER SYSTEM |
| Timeline rewind? | Có giới hạn, rare relic | TIME REWRITE RELIC |
| Universe tone? | Isekai + political + psychological | UNIVERSE PHILOSOPHY |
| Lập faction? | Có, late-game | Archetype |
| Class hay Archetype? | Archetype (6 loại, drift được) | Archetype |
| Skill bị đánh cắp? | Không (identity = linh hồn) | UNIQUE SKILL CONTROL |
| Anti-Unique Field? | Có, cực hiếm, chi phí cao | UNIQUE SKILL CONTROL |
| Instability skill? | Có, ẩn, narrative warning | IDENTITY INSTABILITY |
| Mutation agency? | Luôn là lựa chọn có ý thức | IDENTITY MUTATION |
| Seed biến mất? | Không bao giờ, luôn để lại echo | ECHO OF ORIGIN |
| Final Boss? | Ban đầu thảm họa, sau lộ ý thức | COSMIC THREAT |
| Chu kỳ mới? | Do tập thể quyết định | COSMIC DEMOCRACY |
| Enemy Empire? | Có triết lý riêng, player có thể join | ENEMY EMPIRE |
| Solo vs MMO? | 3 trục cân bằng | THREE AXIS POWER |
| Interaction model? | 3 choices + 1 free input | Advisory |
| Chapter cadence? | Player-driven + 5/ngày soft cap | Advisory |
| MMO model? | Async Shared Universe | Advisory |
| Platform? | Web app → Mobile | User |
