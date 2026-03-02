# FORCE TAXONOMY SPEC — Phase 1
## Empire Force + Outer Corruption System

**Version:** 1.0
**Companion docs:** VILLAIN_SYSTEM_SPEC.md, PHASE1_ADAPTIVE_ENGINE.md, PHASE1_SINGLEPLAYER_SPEC.md
**Philosophy:** Abstract state, không simulation. Taxonomy là narrative lens — không phải game mechanic.

---

## I. Tại Sao Cần Hệ Thống Này

VILLAIN_SYSTEM_SPEC bao phủ **named antagonists** (Emissary, General, Veiled Will) — những nhân vật có triết lý, có identity arc, có dialogue. Đây là "bộ mặt" của Empire.

Nhưng Empire còn cần **cơ thể** — sự hiện diện liên tục, không đòi hỏi named budget:

- Giữa các milestone named encounter, world không được trống rỗng
- Tower floors cần texture giữa các boss moment
- Threat escalation cần tầng lớp — không phải chỉ "bình yên → Kaen xuất hiện"
- Empire influence phải cảm nhận được khi player gain influence, không chờ General xuất hiện

Ngoài Empire, World còn có mối đe dọa riêng — **Outer Corruption** — không thuộc ai điều khiển, xuất phát từ bản chất bất ổn của Tower và World.

---

## II. Kiến Trúc Tổng Quan

```
THREAT ENVIRONMENT
├── Empire Force Taxonomy         ← Có chủ thể, có ý chí
│   ├── Tier 1: Watcher           ← Passive presence
│   ├── Tier 2: Enforcement       ← Active conflict
│   ├── Tier 3: Lieutenant Unit   ← Pre-boss escalation
│   └── Tier 4: Experimental      ← Mireth anomalies
│
└── Outer Corruption              ← Không có chủ thể
    ├── Tower Dị Biến             ← Identity instability → environment
    ├── Identity Echo             ← Dư âm của người đã qua
    └── World Anomaly             ← Veiled Will signal
```

---

## III. Abstract State Model

```python
class ThreatEnvironment(BaseModel):
    # Empire Force
    active_empire_tiers: list[int] = []         # [1], [1,2], [1,2,3], etc.
    general_zone_affiliation: str | None = None  # "vorn"|"kha"|"mireth"|"azen"
    watcher_active: bool = False
    enforcement_intensity: int = 0               # 0-100
    lieutenant_unit_deployed: bool = False

    # Outer Corruption
    tower_instability: int = 0                   # 0-100, mirrors player coherence gap
    identity_echo_present: bool = False
    world_anomaly_active: bool = False

    # Derived narrative tone
    threat_pressure: Literal["calm","observed","contested","siege","anomalous"] = "calm"
```

AI không nhận stat sheet. AI nhận `WorldState` object (chứa các field trên) + player state → generate narrative.

> **Implementation note:** Các field `ThreatEnvironment` đã được embed trực tiếp vào `WorldState` model (`app/models/world_state.py`) thay vì class riêng. `get_threat_pressure()` là method của `WorldState`. Auto-trigger logic nằm trong `update_threat_triggers()`. Decay nằm trong `apply_chapter_decay()`.

---

## IV. Empire Force — 4 Tiers

### Tier 1: Watcher

**Bản chất:** Không combat. Không đối đầu trực tiếp.
**Narrative function:** Player cảm thấy bị quan sát. Empire đã chú ý.

**Kích hoạt:**
- Player `notoriety >= 25` (đã thu hút sự chú ý — xem GDD 3.3)
- Hoặc player hoàn thành Floor 1 Tower
- Hoặc Emissary contact lần đầu xảy ra

**Biểu hiện trong narrative (AI generate):**
- NPC nhắc đến "người lạ hỏi thăm về bạn"
- Dấu hiệu ai đó đã vào khu vực player trú ngụ
- Cảm giác bị theo dõi trong Tower — không có encounter, chỉ áp lực
- Tin tình báo Empire đề cập tên player

**State update:**
```python
watcher_active = True  # không tự tắt — chỉ tắt khi player rời khỏi tầm ảnh hưởng
```

---

### Tier 2: Enforcement

**Bản chất:** Conflict trực tiếp. Faceless units — không có tên riêng, không có philosophy.
**Narrative function:** Demonstrate Empire's physical power. Escalate tension. Punish high influence.

**Kích hoạt:**
- Player `notoriety >= 50`
- Player xâm nhập Empire-controlled territory
- Player giải cứu target bị Empire giam giữ

**Phân nhánh theo General Affiliation:**

| General | Enforcement style | Narrative tone |
|---------|-------------------|----------------|
| Vorn | Warrior-grade soldiers, direct assault | "Họ không nói. Họ chỉ tiến." |
| Kha | Adaptable units, hit-and-fade | "Không ai nhớ khuôn mặt họ." |
| Mireth | Augmented soldiers, experimental gear | "Họ đã không còn hoàn toàn là người." |
| Azen | Diplomatic enforcers, coercive negotiation | "Lời mời nghe như mệnh lệnh." |

**State tracking:**
```python
enforcement_intensity += 10   # mỗi lần encounter (keyword-based từ simulator output)
# Nếu intensity >= 70 → lieutenant_unit_deployed trigger eligible

# Decay: Empire giảm tuần tra ở nơi player không xuất hiện
if no_empire_encounter_this_chapter:
    enforcement_intensity = max(0, enforcement_intensity - 5)
```

---

### Tier 3: Lieutenant's Unit

**Bản chất:** Semi-named. Không phải Lieutenant bản thân — mà là đội dưới quyền Lieutenant.
**Narrative function:** Báo hiệu Act 3. Pre-boss escalation. Có tên nhóm, có đặc điểm nhận ra được.

**Kích hoạt:**
- Act 3 begin (sau khi NCE xảy ra)
- `enforcement_intensity >= 70`
- Player clear Floor 2 Tower

**4 Lieutenant Units (one per General):**

| Unit | General | Đặc điểm | Encounter type |
|------|---------|-----------|----------------|
| **Iron Oath** | Vorn | Không rút lui, không đàm phán | Attrition — họ đến cho đến khi bạn rời đi |
| **The Hollow** | Kha | Không có dấu hiệu nhận dạng, thay thế nhau liền mạch | Pursuit — không encounter rõ ràng, chỉ áp lực liên tục |
| **Specimen Series** | Mireth | Mỗi unit là thí nghiệm khác nhau | Unpredictable — mỗi encounter có mechanic khác |
| **Voice of Order** | Azen | Thuyết phục trước, ép buộc sau | Social — NPC xung quanh bị influence trước khi player |

**State:**
```python
lieutenant_unit_deployed = True
# Tắt sau khi Lieutenant (boss) encounter hoàn thành
```

---

### Tier 4: Experimental (Mireth Zone)

**Bản chất:** Không phải combat truyền thống. Mireth's domain — nơi ranh giới giữa soldier và creation mờ đi.
**Narrative function:** Identity test trong disguise. World-building cho Mireth philosophy.

**Kích hoạt:**
- Player enter Mireth-affiliated zone (Tower Floor 3 nếu Mireth là General assigned)
- Hoặc Act 3 Mireth event trigger
- Hoặc player `curiosity_depth >= 70` + Seeker archetype

**Biểu hiện:**
- Entity không tấn công bằng vũ lực — tấn công bằng câu hỏi, bằng distortion
- Môi trường thay đổi theo `identity_coherence` của player
- Có thể không phải encounter — chỉ là sự kiện perception

**Lưu ý:** Tier 4 không có `enforcement_intensity` — đây là nhánh riêng, chỉ kích hoạt khi Mireth là assigned General. Archetype Seeker và Wanderer có khả năng cao gặp Tier 4 hơn.

---

## V. Outer Corruption — 3 Loại

### 1. Tower Dị Biến

**Nguồn gốc:** Tower không phải do Empire tạo ra. Tower là cấu trúc nguyên thủy của World — bất ổn theo bản chất.

**Trigger:**
```python
tower_instability = max(0, 100 - player.identity_coherence + floor_modifier)
# floor_modifier: Floor 1 = +0, Floor 2 = +15, Floor 3 = +30

if tower_instability >= 40:
    dị_biến_encounter_eligible = True
```

**Biểu hiện:**
- Tower layout thay đổi theo coherence → player có thể bị lạc ở Floor đã quen
- Mirror-image encounters — player gặp phiên bản distorted của chính họ (low coherence only)
- Dead-end rooms không có trên map — xuất hiện khi instability cao
- Lore: "Tower không dẫn ai đến đích. Tower chỉ phản chiếu người đang đi."

**Narrative tone:** Psychological. Không có enemy để đánh. Chỉ có environment để navigate.

---

### 2. Identity Echo

**Nguồn gốc:** Người từng đi qua Tower để lại dấu vết identity. Những mảnh này không biến mất — chúng lơ lửng.

**Trigger:**
- Player enter Floor 2+
- Hoặc `tower_instability >= 30`

**Biểu hiện:**
- Echo có Seed tương tự player → mirror moment tự nhiên
- Echo là "bóng ma" — không combat, có dialogue fragments
- Dialogue fragments gợi ý về path player chưa đi, hoặc consequences của path đang đi.

**Phase 1 implementation:**
```python
echo_seed = random.choice(compatible_seeds)  # lấy từ Archetype seed pool
# AI generate identity fragment dựa trên echo_seed vs player_seed contrast
```

**Phase 2+ (MMO):** Echo được seed từ player data thật — người đã chơi trước bạn, có seed gần giống, đã làm gì đó khác. Đây là cơ chế cực kỳ powerful cho MMO layer.

**Narrative value:** Không threat theo nghĩa nguy hiểm — là **dialogue với con đường chưa đi**.

---

### 3. World Anomaly

**Nguồn gốc:** The Veiled Will. Không phải Empire. Không phải Tower. Tầng đe dọa thứ ba — chỉ xuất hiện cuối Phase 1 để plant seed.

**Trigger:**
- Chỉ Act 3-4
- `veiled_will_phase >= 1` trong VillainState
- Hoặc player `identity_coherence >= 80` (identity quá vững → Veiled Will notice)

**Biểu hiện:**
- Hiện tượng không có nguyên nhân — vật thể di chuyển sai chiều, thời gian slip, NPC nói những thứ họ không thể biết
- Không có encounter — chỉ là sự kiện
- AI không giải thích — chỉ mô tả, để player tự interpret

**Narrative rule:** Không bao giờ confirm Veiled Will là gì. Chỉ plant seed. Phase 2 mới bắt đầu reveal.

---

## VI. Threat Pressure — Derived Narrative Tone

AI không tính threat riêng lẻ — nó nhận `threat_pressure` tổng hợp:

```python
def compute_threat_pressure(env: ThreatEnvironment, player: PlayerState) -> str:
    if env.world_anomaly_active:
        return "anomalous"
    if env.lieutenant_unit_deployed or env.enforcement_intensity >= 70:
        return "siege"
    if env.enforcement_intensity >= 40 or env.tower_instability >= 60:
        return "contested"
    if env.watcher_active or env.tower_instability >= 30:
        return "observed"
    return "calm"
```

| Threat Pressure | World feel | AI writing tone |
|-----------------|-----------|-----------------|
| `calm` | Trước bão | NPC bình thường, world detail nhiều hơn |
| `observed` | Áp lực ngầm | NPC cẩn thận hơn, subtle warning |
| `contested` | Căng thẳng | Encounter possible bất kỳ lúc nào, NPC chọn phe |
| `siege` | Chiến tranh cục bộ | Empire hiện diện trực tiếp, safe zone thu hẹp |
| `anomalous` | Không hiểu được | Reality unreliable, NPC behave unexpectedly |

---

## VII. Tương Tác Với Villain System

Empire Force **không thay thế** named villain. Chúng là cấp dưới trong narrative hierarchy:

```
Veiled Will (cosmic, Phase 2+)
    ↓ orchestrates
Generals (shadow/voice, Phase 1)
    ↓ deploy
Emissaries (direct encounter, Phase 1)
    ↓ command
Lieutenant Units (Tier 3, pre-boss)
    ↓ lead
Enforcement (Tier 2, faceless)
    ↓ backed by
Watchers (Tier 1, passive)
```

**Rule:** Khi named villain xuất hiện, Empire Force ở background — không compete. AI giảm force encounter density khi Emissary/General encounter đang active.

**Exception:** Lieutenant Unit có thể xuất hiện CÙNG named villain encounter — nhưng chỉ như context, không như separate encounter.

---

## VIII. Integration với Pipeline

`WorldState.to_prompt_string()` inject threat context vào AI prompt:

```
## WORLD STATE:
- Threat pressure: {pressure}
- Empire: Watcher đã kích hoạt — player đang bị theo dõi
- Empire: Enforcement cường độ CAO (75/100) — encounter bất kỳ lúc nào
- Enforcement kiểu Vorn: không nói, chỉ tiến — warrior-grade, direct assault
- Tower: BẤT ỔN CAO (65/100) — layout thay đổi, dead-ends xuất hiện
- Outer: Identity Echo hiện diện — bóng hình giống player, dialogue fragments
```

Auto-trigger: `update_threat_triggers(notoriety, coherence, act)` gọi sau mỗi chapter trong `_node_ledger`.
Decay: `apply_chapter_decay()` giảm `enforcement_intensity` -5 khi không có empire encounter.

> **Implementation:** Các field nằm trực tiếp trong `WorldState` (`app/models/world_state.py`), không có class `AdaptiveContext` hay `ThreatEnvironment` riêng.

---

## IX. Phase 1 Implementation Scope

Phase 1 cần implement đủ để world có texture. Không cần full system ngay.

### Must Have (Phase 1 launch)

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Watcher trigger + passive narrative | Low | Simple flag, AI handles rest |
| Enforcement encounter (Tier 2) | Medium | 4 General-style variants |
| Tower Dị Biến (instability-based) | Medium | Trigger formula đã có |
| `compute_threat_pressure()` + AI prompt | Low | Pure computation |
| World Anomaly (Act 4 only, 1 event) | Low | Single scripted moment, not system |

### Phase 2 Later

| Feature | Notes |
|---------|-------|
| Lieutenant Unit (Tier 3) full deployment | Cần Lieutenant character spec first |
| Identity Echo từ player data thật | Cần MMO layer |
| Tier 4 Experimental (Mireth full) | Cần Mireth character spec |
| Multi-General zone system | Cần world map architecture |

---

## X. Tóm Tắt Triết Lý

Creep system truyền thống simulate thế giới.
Hệ thống này **mô tả trạng thái thế giới** — AI là cầu nối giữa state và narrative.

Player không thấy tier, không thấy số. Họ thấy:

- NPC bắt đầu nhìn qua vai họ khi đi qua → Watcher active
- Khu chợ đóng cửa sớm, lính tuần tra nhiều hơn → Enforcement intensity rising
- Tower có tầng họ đã đi nhưng bây giờ không nhận ra → Tower Dị Biến
- Một bóng hình giống mình ngồi ở góc tối, nhìn không lại → Identity Echo
- Đồng hồ trên tháp đánh ngược → World Anomaly

**Không có số. Chỉ có thế giới.**
