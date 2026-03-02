# AMOISEKAI — Phase 1 Single-Player Spec v1.0

> **Author:** Amo
> **Date:** 2026-02-28
> **Status:** Draft — Pre-implementation
> **Dependencies:** GDD_v1.0, HYBRID UNIVERSE SPEC v1, IDENTITY INSTABILITY SYSTEM v1, IDENTITY MUTATION WITH AGENCY v1, VILLAIN_SYSTEM_SPEC v1.0, FATE BUFFER SYSTEM, ECHO OF ORIGIN SYSTEM v1, ENEMY EMPIRE ARCHITECTURE v1
> **Companion:** PHASE1_ADAPTIVE_ENGINE v1.0 — định nghĩa archetype seeds, play style engine, và milestone content adaptation. Doc này là framework skeleton. PHASE1_ADAPTIVE_ENGINE là thịt và linh hồn.

> *Phase 1 trả lời một câu hỏi duy nhất: "Tôi là ai?"*
> *Đây là một tiểu thuyết hoàn chỉnh — có đầu, giữa, cuối. Thế giới lớn hơn câu chuyện này, nhưng câu chuyện này đủ.*

---

## 1. Định Nghĩa Phase 1

### Mục tiêu sản phẩm

Phase 1 là **single-player narrative RPG hoàn chỉnh** — không phải demo, không phải prologue. Một người chơi trải qua Phase 1 sẽ có:

- Một nhân vật với identity đã hình thành qua lựa chọn thực sự
- Một câu chuyện cá nhân có arc rõ ràng: khởi đầu, khủng hoảng, giải quyết
- Một thế giới đủ rộng để cảm nhận có nhiều hơn những gì họ đã thấy

**Phase 1 không phải:**
- Shared world (chưa có player khác ảnh hưởng lẫn nhau)
- Full MMO (chưa có faction contest, gate control, nation building)
- Complete story (The Veiled Will chưa reveal, General chưa đối đầu trực tiếp)

### Câu hỏi trung tâm

```
Phase 1: "Tôi là ai?"
Phase 2: "Identity của tôi có đủ vững trước kẻ đối lập không?"   ← General encounter
Phase 3: "Tôi chọn con đường nào trong thế giới có kẻ khác?"     ← MMO
```

---

## 2. Scope Hệ Thống

### Hệ thống ACTIVE trong Phase 1

| Hệ thống | Spec liên quan | Mức độ |
|---|---|---|
| Identity Engine (Seed → Drift → Echo) | GDD 3.1, ECHO OF ORIGIN v1 | Full |
| Soul Forge onboarding | SOUL_FORGE_SPEC | Full |
| Unique Skill (generation, use, instability) | UNIQUE_SKILL_SYSTEM, INSTABILITY v1 | Full |
| Narrative Confrontation Event | IDENTITY MUTATION WITH AGENCY v1 | Full — 1 lần trong Phase 1 |
| Fate Buffer | FATE BUFFER SYSTEM | Full — giảm dần đến Ch.20 |
| Combat System | COMBAT_SYSTEM_SPEC | Full |
| Tower Floor 1-3 (law modifiers) | HYBRID UNIVERSE SPEC v1 | Partial — 3/5 floors |
| Assigned Emissary arc | VILLAIN_SYSTEM_SPEC v1.0 | 1 Emissary per archetype, full arc |
| Outer Corruption | ENEMY EMPIRE ARCHITECTURE v1 | Tier 1 only |
| General Vorn shadow | VILLAIN_SYSTEM_SPEC v1.0 | Shadow only — no combat |
| The Veiled Will anomaly | COSMIC THREAT ARCHITECTURE | 1 seed only |
| CRNG + DNA Affinity | GDD 3.2 | Full |
| Controlled RNG Pity Timer | GDD 3.2 | Full |

### Hệ thống KHÔNG active trong Phase 1

| Hệ thống | Lý do hoãn |
|---|---|
| Shared World State | Cần architecture shift (Postgres + Redis) |
| Political Layer / Faction | Phụ thuộc shared world |
| Gate Control Contest | Cần multiple players |
| Nation Building | Late-game arc |
| General encounter (combat) | Phase 2 |
| Other 2 Emissaries | Phase 2 — mỗi player chỉ gặp 1 Assigned Emissary trong Phase 1 |
| The Veiled Will Phase 2-3 | Phase 2+ |
| Tower Floor 4-5 | Phase 2 |
| Fate Collision Engine | Cần multiple players |

---

## 3. Narrative Arc — 4 Milestone Acts, Variable Duration

### Nguyên tắc cốt lõi

**Không có số chapter cố định.** Hành trình của một Wanderer thận trọng và một Vanguard liều lĩnh không thể có cùng nhịp. Phase 1 được tổ chức thành **4 Milestone Acts** — mỗi Act có điều kiện exit rõ ràng, không phải số chapter cố định.

```
Act 1 — "Thế giới mới, người lạ"    4-7 chapters      Awakening
Act 2 — "Tìm chỗ đứng"              6-11 chapters     Growth & Drift
Act 3 — "Rạn nứt"                   3-6 chapters      Crisis & Choice  ← đỉnh kịch tính
Act 4 — "Bước ra khỏi sương mù"     3-5 chapters      Resolution & Seeds

Tổng: 16-29 chapters  |  Hard floor: 16  |  Hard cap: 29
```

Villain assignment (Emissary, General shadow, Lieutenant) thay đổi theo archetype. *(Xem PHASE1_ADAPTIVE_ENGINE — Villain Assignment System)*

---

### ACT 1 — "Thế giới mới, người lạ" (4-7 chapters)

**Mục tiêu:** Đặt nền móng — player có identity, có skill, có thế giới, có Emissary ẩn.

**Exit conditions** *(tất cả phải đạt trước khi Act 2 bắt đầu)*:
```
✓ Unique Skill đã manifest lần đầu
✓ World context established (Minor Gate, Tower existence, Empire presence)
✓ Assigned Emissary đã xuất hiện và tạo được initial contact
✓ Combat system đã được giới thiệu (ít nhất 1 Outer Corruption encounter)
```

**Milestone beats** *(thứ tự và nội dung cụ thể do AI + archetype quyết định)*:

| Milestone | Fixed purpose | Variable content |
|---|---|---|
| **M1.1** | Soul Forge — Seed tạo ra, nhân vật xuất hiện | Entry scene theo archetype (xem ADAPTIVE_ENGINE Lớp 1) |
| **M1.2** | Emissary lần đầu xuất hiện — neutral, helpful | Vỏ bọc và approach theo archetype assignment |
| **M1.3** | Unique Skill tự phát lần đầu | Trigger context theo archetype (xem ADAPTIVE_ENGINE Lớp 1) |
| **M1.4** | Outer Corruption encounter đầu tiên | Scale và style theo combat_preference |
| **M1.5** *(optional)* | Emissary contact lần 2, mở đường vào Tower | Xuất hiện nếu curiosity_depth cao hoặc Act cần thêm build-up |

**Fate Buffer:** 100% trong toàn Act 1.

**Act 1 nhanh hay chậm?**
- Vanguard + high risk → 4-5 chapters (bước thẳng vào mọi thứ)
- Seeker + low risk → 6-7 chapters (quan sát, khám phá, hỏi nhiều trước khi hành động)

---

### ACT 2 — "Tìm chỗ đứng" (6-11 chapters)

**Mục tiêu:** Identity bắt đầu được thử thách thực sự. Drift tích lũy. First cracks, chưa thành crisis.

**Exit conditions** *(tất cả phải đạt trước khi Act 3 bắt đầu)*:
```
✓ identity_coherence < 65 (drift đã tích lũy đủ)
✓ instability >= 40
✓ Tower Floor 2 cleared
✓ Mirror moment đã xảy ra (ít nhất 1 lần player thấy mình trong người khác)
✓ Emissary sympathy tracking đang active (ít nhất 2 meaningful interactions)
✓ Skill instability Phase 1 đã xuất hiện trong prose (player có thể đã nhận ra)
```

**Milestone beats:**

| Milestone | Fixed purpose | Variable content |
|---|---|---|
| **M2.1** | Tower Floor 1 — law_modifier nhẹ | Thể hiện khác nhau theo archetype |
| **M2.2** | **First drift choice** — lựa chọn trái với Seed identity | Tình huống cụ thể theo archetype natural drift trigger |
| **M2.3** | Emissary philosophy hint — lần đầu hé lộ triết lý | Approach theo archetype assignment |
| **M2.4** | Tower Floor 2 — instability_modifier 1.5x | Skill bắt đầu bất ổn nhẹ |
| **M2.5** | Outer Corruption có tổ chức | Player nhận ra đây là enemy, không phải thiên tai |
| **M2.6** | **Mirror moment** — gặp NPC là gương phản chiếu | NPC cụ thể theo archetype (xem ADAPTIVE_ENGINE) |
| **M2.7** | Skill instability Phase 1 — prose hints | Biểu hiện theo loại skill |
| **M2.8** *(optional)* | Fate Buffer kích hoạt nếu player mắc sai lầm lớn | Arc thay vì death |
| **M2.9** *(optional)* | Additional exploration beat | Nếu curiosity_depth cao hoặc alliance_tendency cao cần thêm NPC depth |

**Fate Buffer:** 90% đầu Act → 65% cuối Act. Vẫn còn, nhưng cost bắt đầu xuất hiện.

**Act 2 nhanh hay chậm?**
- High risk_appetite → drift trigger nhanh → exit conditions đạt sau 6-7 chapters
- Low risk_appetite + high curiosity → drift chậm, nhiều exploration beats → 9-11 chapters

---

### ACT 3 — "Rạn nứt" (3-6 chapters) ← *Trái tim của Phase 1*

**Mục tiêu:** Mọi thứ tích lũy từ Act 1-2 đổ vào đây. Đây là nơi Phase 1 thật sự sống.

**Entry conditions** *(phải từ Act 2 exit)*:
```
identity_coherence < 65 AND instability >= 40
```

**Force-trigger:** Nếu player đạt hard cap chapters mà chưa vào Act 3, engine force instability spike qua một crisis event.

**Exit conditions:**
```
✓ Narrative Confrontation Event đã xảy ra VÀ player đã đưa ra lựa chọn
✓ Emissary reveal đã resolve (dù theo nhánh nào)
✓ Tower Floor 3 entered
```

**Milestone beats:**

| Milestone | Fixed purpose | Variable content |
|---|---|---|
| **M3.1** | **Emissary reveal** (tùy sympathy_score) | Timing và moment tùy sympathy + archetype reveal context |
| **M3.2** | Tower Floor 3 — instability_modifier 2.0x | Skill behavior changes rõ rệt |
| **M3.3** | Prose tone shift — narrator thay đổi | Không thông báo, không giải thích |
| **M3.4** | **NARRATIVE CONFRONTATION EVENT** | Form, câu hỏi, General shadow — tất cả theo archetype |
| **M3.5** | Aftermath — world và Emissary react | Tùy nhánh player chọn |

**Fate Buffer:** 65% đầu Act → 35% cuối Act.

**NCE timing:**
- High instability buildup (risk_appetite > 70) → NCE xảy ra sớm trong Act 3 (M3.4 ở chapter 2-3 của act)
- Low instability buildup → NCE xảy ra muộn hơn (M3.4 ở chapter 4-5 của act)

**General shadow tại NCE:** Không phải luôn là Vorn — tùy archetype counterpart assignment. *(Xem PHASE1_ADAPTIVE_ENGINE — Villain Assignment System)*

---

### ACT 4 — "Bước ra khỏi sương mù" (3-5 chapters)

**Mục tiêu:** Resolution, world reaction, combat climax, seeds cho Phase 2.

**Exit conditions = Phase 1 complete:**
```
✓ NCE aftermath settled — identity state post-choice established
✓ Tower Floor 3 cleared (Lieutenant defeated)
✓ Assigned General xuất hiện brief — cliffhanger planted
✓ Emissary arc có closure (dù nhánh nào)
✓ 5 epilogue seeds gieo xong
```

**Milestone beats:**

| Milestone | Fixed purpose | Variable content |
|---|---|---|
| **M4.1** | Identity mới/củng cố thể hiện ra ngoài | NPC reactions, skill lore description thay đổi, Echo of Origin |
| **M4.2** | **Emissary final interaction** — arc closure | Tùy nhánh: đồng minh / đối đầu / biến mất |
| **M4.3** | **Floor 3 Boss: Assigned Lieutenant** | Combat style theo archetype counterpart |
| **M4.4** | **Assigned General — brief appearance** | Lines theo archetype (xem ADAPTIVE_ENGINE) |
| **M4.5** | **Epilogue** — 5 seeds gieo | *(Xem Section 5)* |

**Fate Buffer:** 35% đầu Act → 5% cuối Act. Trận Lieutenant có weight thật sự.

---

## 4. Narrative Confrontation Event — Act 3 (M3.4)

Đây là chapter quan trọng nhất của Phase 1. Thiết kế chi tiết:

### Trigger conditions

```
Điều kiện hard:
  - Player đang ở Tower Floor 3 (đủ instability_modifier)
  - identity instability >= 60 (tích lũy từ drift)

Điều kiện soft (ảnh hưởng form của event):
  - empire_resonance > 30 → Assigned General's voice rõ hơn
  - emissary sympathy (assigned Emissary) > 40 → Emissary's philosophy echo trong event
  - identity_anchor > 30 → third path có thể unlock
```

### Form — AI chọn 1 trong 3 form phù hợp với player's arc

**Form A — Giấc mơ / Ảo giác** *(phổ biến nhất)*
> Tower Floor 3 có một đặc điểm: thực tại không ổn định. Trong một khoảnh khắc đối đầu với bóng tối của Floor 3, player rơi vào trạng thái in-between. Gặp một phiên bản của mình — phiên bản đã đi theo hướng drift hoàn toàn. Hai người nhìn nhau. Không có lời giải thích. Chỉ có câu hỏi: *"Có phải đây là tôi không?"*

**Form B — NPC phản chiếu** *(khi player có nhiều NPC interaction)*
> Một NPC mà player đã gặp từ sớm nói ra điều player chưa dám nghĩ. Không phải giảng đạo — chỉ là một quan sát thật, đúng lúc. Player phải quyết định có để câu đó thay đổi mình không.

**Form C — Khoảnh khắc tịch lặng** *(khi player là archetype Seeker/Tactician)*
> Không có entity nào xuất hiện. Chỉ là một khoảnh khắc player một mình, và câu hỏi tự nảy sinh. Narrative không push — chỉ create không gian.

### Assigned General's voice tại NCE

Không phải encounter. Chỉ là một câu — qua gió, qua echo của Tower Floor 3.

**General được assign theo archetype** — không phải luôn là Vorn. *(Xem PHASE1_ADAPTIVE_ENGINE — Villain Assignment System cho shadow line cụ thể của từng General × archetype.)*

**Nguyên tắc chung cho tất cả General shadows:**
- Không phán xét, không đe dọa
- Gần như buồn — như thể họ đã thấy điều này trước đây, ở người khác
- Một câu duy nhất. Không giải thích thêm.
- Câu hỏi, không phải tuyên bố

**Tone example** *(General Vorn, dành cho Vanguard/Catalyst)*:
> *"Anh đang xây hay đang phá? Bởi vì từ nơi tôi đứng — tôi chỉ thấy đống đổ nát."*

**Tone example** *(General Kha, dành cho Wanderer/Tactician)*:
> *"Tự do của anh tồn tại ở đâu khi chính anh đang phá vỡ nó từ bên trong?"*

### Player choices

```
[A] Chấp nhận — "Đây là người tôi đang trở thành."
    → Mutation trigger (tùy drift direction)
    → Skill bắt đầu transform
    → empire_resonance += 10 (drift về Empire direction)

[B] Từ chối — "Không. Tôi biết mình là ai."
    → identity_anchor += 20
    → Skill ổn định hoàn toàn
    → Instability reset về 30
    → Assigned General's voice: "Chúng ta sẽ gặp lại nhau."

[C] Con đường thứ ba — "Tôi không phải lựa chọn giữa hai thứ đó."
    → Chỉ unlock nếu: identity_anchor >= 30 VÀ player đã rejected ít nhất 1 philosophy argument trước đó
    → Hybrid path: không fully accept drift, không fully reject
    → Instability giảm nhưng không về 0 — luôn có một tension nhỏ
    → Skill evolve theo hướng không thể predict trước
    → Assigned General im lặng. (Đây là response duy nhất khiến Assigned General không có câu trả lời.)
```

---

## 5. Chapter 22 — Epilogue Seeds

5 seeds được gieo tự nhiên, không dramatic, không announcement:

### Seed 1 — The Veiled Will anomaly

```
Trong cảnh cuối của epilogue, narrator mô tả:
"Bầu trời đêm đó có một màu không có tên."

Không giải thích. Không nhấn mạnh.
Câu tiếp theo tiếp tục bình thường.

Người chơi có thể đọc qua. Hoặc dừng lại.
Chỉ đến Phase 2 câu này mới có ý nghĩa.
```

### Seed 2 — Assigned General's exit

```
Sau khi Lieutenant bị đánh bại, Assigned General xuất hiện.
Nhìn player một khoảnh khắc.

Không nói gì về trận đánh.
Chỉ nói: "Anh đã trả lời câu hỏi của mình rồi. Lần sau, tôi sẽ hỏi câu tiếp theo."

Rời đi. Không battle. Không speech.
```

### Seed 3 — Assigned Emissary state (tùy nhánh)

```
Nếu Emissary là đồng minh:  Emissary đứng ở cửa Tower. "Tôi sẽ tiếp tục quan sát anh."
Nếu Emissary bị phản bội:  Không có mặt. Chỉ một note ngắn: "Đừng tìm tôi nữa."
Nếu chưa reveal:        Emissary vẫn là "người quen" — gặp ngắn, không đề cập đến bí mật.
```

### Seed 4 — Tower Floors 4-5

```
Nhìn lên: ánh sáng từ tầng 4 lọt xuống.
Không có lời mời. Không có mô tả.
Chỉ là ánh sáng.
```

### Seed 5 — Có ai đó khác đang ở đây

```
Ở đâu đó trong Tower, player tìm thấy dấu vết:
Một vết cắt trên tường không phải của mình.
Một vật bỏ lại không thuộc về ai trong câu chuyện.

Không có giải thích.
(Foreshadow MMO — có player khác trong thế giới.)
```

---

## 6. Villain Cast Phase 1

*(Chi tiết nhân diện trong VILLAIN_CAST_PHASE1.md — sẽ viết riêng)*

> [!IMPORTANT]
> **Villain cast thay đổi theo archetype.** Bảng dưới đây là ví dụ cho **Vanguard/Catalyst** (Emissary Thol/Sira + General Vorn). Các archetype khác có cast riêng — xem [PHASE1_ADAPTIVE_ENGINE — Villain Assignment System](./PHASE1_ADAPTIVE_ENGINE.md) cho bảng đầy đủ.

### Tổng quan (Ví dụ: Vanguard archetype)

| Nhân vật | Loại | Xuất hiện | Vai trò |
|---|---|---|---|
| **Assigned Emissary** (VD: Thol) | Emissary (Tier 1-2) | Act 1-3 | Companion → Revealed antagonist |
| **Outer Corruption units** | Empire Tier 1 | Act 1-2 | Combat enemy, threat establisher |
| **Assigned Lieutenant** (VD: Vorn's Lt) | Sub-boss | Act 4 | Phase 1 combat climax |
| **Assigned General** (VD: Vorn) | General (Tier 3) | NCE (voice), Act 4 (brief + exit) | Shadow — philosophy, no combat |
| **The Veiled Will** | Cosmic | Epilogue (1 anomaly) | 1 seed, không nhân vật |

### Tại sao Vorn là ví dụ chính trong doc này?

1. **Philosophy phù hợp nhất với Phase 1 crisis**: "Anh đang xây hay chỉ đang phá?" — câu hỏi này đúng với mọi archetype player đang trong identity drift
2. **Tone engaging nhất cho lần đầu**: Passionate, frustrated, tin vào tiềm năng của player — không lạnh như Kha, không clinical như Mireth
3. **Cơ chế tự nhiên trong Tower**: Anti-Unique Zone mechanic của Vorn = Tower law modifier — connection logic
4. **Phù hợp Floor 3**: HYBRID UNIVERSE SPEC nói "1 Regional General tại Floor 3 hoặc 4" — Vorn ở Floor 3 là thiết kế hợp lý nhất
5. **Nhưng không phải mặc định duy nhất** — Seeker gặp Mireth, Tactician/Wanderer gặp Kha, Sovereign gặp Azen

---

## 7. Identity Arc — Trạng Thái Đầu/Cuối

### Đầu Phase 1 (Ch. 1)

```json
{
  "identity_coherence": 100,
  "instability": 0,
  "empire_resonance": 0,
  "identity_anchor": 0,
  "mutation": null,
  "echo_trace": 100,
  "fate_buffer": 100
}
```

### Cuối Phase 1 (Ch. 22) — 3 possible states

**Nếu player chọn [A] Mutation:**
```json
{
  "identity_coherence": 60,      // reset theo hướng mới
  "instability": 25,             // giảm sau mutation
  "empire_resonance": 20-40,    // tùy drift direction
  "identity_anchor": 15,
  "mutation": "mirror_crack hoặc conversion (partial)",
  "echo_trace": 65,              // vẫn còn, nhưng mờ hơn
  "fate_buffer": 5               // gần hết
}
```

**Nếu player chọn [B] Anchor:**
```json
{
  "identity_coherence": 85,
  "instability": 30,             // không về 0 — world pressure vẫn còn
  "empire_resonance": 10,
  "identity_anchor": 35,
  "mutation": "resistant (partial)",
  "echo_trace": 90,              // seed rất mạnh
  "fate_buffer": 5
}
```

**Nếu player chọn [C] Third Path:**
```json
{
  "identity_coherence": 70,
  "instability": 45,             // luôn có tension — đây là cost của third path
  "empire_resonance": 15,
  "identity_anchor": 25,
  "mutation": "unresolved_synthesis",
  "echo_trace": 75,
  "fate_buffer": 5
}
```

---

## 8. Tower Floor Specs (Phase 1)

### Floor 1

```json
{
  "floor_id": 1,
  "instability_modifier": 1.2,
  "law_modifier": {
    "description": "Không gian hơi bất ổn. Unique Skill có delay nhỏ.",
    "effect": "skill_activation_delay += 1 beat",
    "empire_presence": 15,
    "guardian_state": "absent"
  },
  "narrative_tone": "Xa lạ nhưng không nguy hiểm. Như bước vào một ngôi nhà chưa từng ở."
}
```

### Floor 2

```json
{
  "floor_id": 2,
  "instability_modifier": 1.5,
  "law_modifier": {
    "description": "Thực tại có khoảng trống nhỏ. Skill effect đôi khi lệch 10-20% so với intent.",
    "effect": "skill_outcome_variance += 0.15",
    "empire_presence": 30,
    "guardian_state": "weakened"
  },
  "narrative_tone": "Đẹp nhưng sai. Màu sắc hơi khác. Bóng đổ theo hướng không đúng."
}
```

### Floor 3

```json
{
  "floor_id": 3,
  "instability_modifier": 2.0,
  "law_modifier": {
    "description": "Một số khả năng không hoạt động hoàn toàn. Identity coherence ảnh hưởng trực tiếp đến skill power.",
    "effect": "skill_power = base_power * (identity_coherence / 100)",
    "empire_presence": 55,
    "guardian_state": "Lieutenant active"
  },
  "narrative_tone": "Nơi này biết bạn. Nó phản chiếu những gì bạn đang che giấu.",
  "special": "Narrative Confrontation Event trigger zone"
}
```

---

## 9. Fate Buffer Schedule

| Chapter | Buffer strength | Behavior khi player "chết" |
|---|---|---|
| Ch. 1-10 | 100% | Luôn có rescue — arc thay thế được generate tự nhiên |
| Ch. 11-15 | 80% | Rescue xảy ra nhưng có cost (mất gì đó, bị thương lâu hơn) |
| Ch. 16-18 | 50% | Rescue còn xảy ra nhưng không guaranteed |
| Ch. 19-21 | 20% | Chủ yếu không rescue — consequences real |
| Ch. 22 | 5% | Gần như không có. Epilogue có buffer nhỏ để narrative hoàn thành. |

**Lore explanation cho Fate Buffer (không bao giờ nói thẳng):**
> "Linh hồn chưa hoàn chỉnh. Thế giới chưa chú ý đến họ. Định mệnh chưa bị ràng buộc."

---

## 10. Success Metrics Phase 1

Phase 1 thành công khi:

### Metrics kỹ thuật
- [ ] 22 chapters generate nhất quán — không có plot contradiction
- [ ] Identity tracking chính xác — coherence/instability phản ánh đúng lựa chọn
- [ ] Emissary sympathy score theo đúng thứ tự chapters
- [ ] Tower law modifiers ảnh hưởng rõ ràng đến skill output
- [ ] Fate Buffer giảm đúng schedule

### Metrics narrative
- [ ] Player cảm thấy NCE (Act 3, M3.4) là một trong những moments đáng nhớ nhất
- [ ] Assigned Emissary không cảm thấy như "kẻ phản diện lộ bài" mà như "người có lý do"
- [ ] Assigned General's brief appearance (epilogue) để lại ấn tượng dù không có combat
- [ ] Epilogue seeds không cảm thấy forced — tự nhiên như ending thật sự

### Metrics player experience
- [ ] Sau Phase 1, player có thể trả lời: "Nhân vật của tôi là người như thế nào?"
- [ ] Player muốn biết điều gì xảy ra tiếp theo (Tower Floor 4, Assigned General, Emissary's whereabouts)
- [ ] Ít nhất 1 lựa chọn trong 22 chapters khiến player phải suy nghĩ lâu

---

## 11. Build Roadmap Phase 1

### Cái đã có (~80% core)

```
✅ Soul Forge + onboarding
✅ Unique Skill generation + instability
✅ Narrative pipeline (orchestrator, scene_writer, planner)
✅ Combat system
✅ Fate Buffer
✅ Identity tracking (seed, coherence, instability)
✅ Security layer
```

### Cần build thêm

| Item | Effort | Priority |
|---|---|---|
| Tower Floor law_modifier system | 2-3 tuần | P0 |
| Emissary tracking + sympathy scoring | 1-2 tuần | P0 |
| Narrative Confrontation Event trigger | 1 tuần | P0 |
| General shadow — prose integration | 3-4 ngày | P0 |
| Lieutenant character (Floor 3 boss) | 1 tuần | P1 |
| Emissary reveal branching (3 nhánh) | 1 tuần | P1 |
| Ch. 22 seed system | 3-4 ngày | P1 |
| Identity state snapshots cho Phase 2 | 3-4 ngày | P2 |
| Playtest + balance 22 chapters | 2 tuần | P0 |

**Tổng ước tính: 6-8 tuần để Phase 1 đủ để player thật chơi.**

---

## 12. Ranh Giới Phase 1 / Phase 2

### Phase 1 kết thúc khi:

```
Story: Ch. 22 epilogue complete
Player state:
  - 1 identity choice đã được đưa ra (mutation / anchor / third path)
  - Tower Floor 1-3 cleared
  - Assigned Emissary arc resolved (1 trong 3 nhánh)
  - Assigned General: seen, not fought
  - The Veiled Will: 1 anomaly seeded
  - Fate Buffer: gần 0

World state (personal):
  - Identity locked vào trạng thái post-Ch.17
  - empire_resonance, identity_anchor có giá trị mang sang Phase 2
  - Emissary allegiance state ghi lại
```

### Phase 2 bắt đầu với:

```
Player đã biết mình là ai.
Câu hỏi Phase 2: "Identity của mình có đủ vững không?"

Mở ra:
  → Tower Floor 4-5
  → General encounter (full — không phải shadow)
  → Second Emissary xuất hiện
  → Fate Buffer = 0 (stakes hoàn toàn thật)
  → First seeds of shared world (nếu MMO ready)
```

---

> *"Hai mươi hai chương. Một câu hỏi. Một câu trả lời — của riêng người chơi."*

