# 🦋 AMOISEKAI — Archetype Evolution Specification v1.0

> **Author:** Amo  
> **Date:** 2026-02-28  
> **Status:** Draft — Awaiting Review  
> **Dependencies:** WORLD_BIBLE v1.0, PROGRESSION_SYSTEM_SPEC v1.0, POWER_SYSTEM_SPEC v1.1, UNIQUE_SKILL_GROWTH_SPEC v1.2, SOUL_FORGE_SPEC, IDENTITY TRANSFORMATION ARCHITECTURE v1  
> **Inspiration:** Rimuru Tempest evolution path (Slime → Demon Slime → True Demon Lord) — "Tên Đặt" system — nhưng thay vì tiến hóa chủng tộc, Amoisekai tiến hóa **bản thể**

---

## 1. Triết lý

> Trong Aelvyndor, bạn không "lên cấp" hay "chuyển job".  
> Bạn **trở thành thứ gì đó lớn hơn** — không phải vì bạn grind đủ, mà vì thế giới **công nhận** bạn đã thay đổi.

**Nguyên tắc cốt lõi:**

| # | Nguyên tắc | Giải thích |
|---|-----------|-----------|
| 1 | **Identity Evolution > Class Promotion** | Không có cây class truyền thống. Archetype tiến hóa phản ánh con người bạn ĐÃ TRỞ THÀNH |
| 2 | **World Recognition** | Thế giới (Principles, NPCs, Gates) phản ứng với evolution — không phải hệ thống game trao thưởng |
| 3 | **Behavior-Driven** | Player KHÔNG chọn "tiến hóa thành X". Hành vi + lựa chọn → engine xác định evolved form |
| 4 | **Unique per Player** | 2 Vanguard có thể tiến hóa thành 2 dạng hoàn toàn khác nhau |
| 5 | **Narrative Event** | Mỗi evolution là narrative arc, không phải popup thông báo |
| 6 | **No Regression, Only Transformation** | Không "mất" evolution. Nhưng CÓ THỂ drift sang hướng mới |

> 🎯 **So sánh Rimuru:**
> | Rimuru | Amoisekai |
> |--------|-----------|
> | Slime → Demon Slime → True Demon Lord | Vanguard → Bulwark → Fortress Sovereign |
> | Tiến hóa qua absorb + naming + crisis | Tiến hóa qua identity crystallization + world pressure + Arc Climax |
> | Tên Đặt = power boost + evolution trigger | Naming Event = thế giới công nhận danh xưng mới |
> | Predator → Gluttony → Beelzebuth (skill evolve cùng) | Unique Skill growth (Echo/Scar/Aspect/Ultimate) song song với archetype evolution |

---

## 2. Kiến trúc tổng quan — Bốn Tầng Bản Thể

```
┌─────────────────────────────────────────────────────────────────────┐
│  TẦNG 4 — TRUYỀN THUYẾT (Legendary Being)          [Season 2+]    │
│  "Thế giới gọi tên bạn"                                           │
│  Chỉ 1 per server. Archon Notice. World-altering.                 │
├─────────────────────────────────────────────────────────────────────┤
│  TẦNG 3 — SIÊU VIỆT (Ascendant Archetype)            [Rank 4-5]    │
│  "Bạn định nghĩa không gian xung quanh"                           │
│  Unique Title. Aura Effect. Domain manifestation.                  │
├─────────────────────────────────────────────────────────────────────┤
│  TẦNG 2 — CHUYỂN HÓA (Transmuted Archetype)         [Rank 2-3]    │
│  "Archetype crystallize theo identity thật"                        │
│  Archetype name thay đổi. Narrative powers unlock.                 │
├─────────────────────────────────────────────────────────────────────┤
│  TẦNG 1 — KHỞI NGUYÊN (Origin Archetype)             [Rank 1]     │
│  "Cách bạn tiếp cận thế giới lần đầu"                             │
│  Vanguard | Catalyst | Sovereign | Seeker | Tactician | Wanderer   │
└─────────────────────────────────────────────────────────────────────┘
```

> 🧠 **Tại sao 4 tầng thay vì cây job?**
> - Cây job cố định → meta builds, min-max, mất uniqueness
> - 4 tầng mở → mỗi player có branch riêng dựa trên identity vector
> - Giống Rimuru: không có "class tree" — chỉ có evolution dựa trên bạn đã absorb/trải qua gì

---

## 3. Tầng 1 — Origin Archetype (Khởi Nguyên)

### 3.1 Sáu Archetype gốc (đã thiết lập)

Từ Soul Forge quiz, player nhận 1 trong 6 Origin Archetype. Đây là **cách tiếp cận**, không phải class:

| Archetype | Principle Affinity | Approach | Starting Zone |
|-----------|-------------------|----------|---------------|
| **Vanguard** | Energy, Matter | Đối diện trực tiếp | Outer Corruption Zone |
| **Catalyst** | Flux, Entropy | Thay đổi môi trường | Minor Gate Region #1 |
| **Sovereign** | Order, Control | Ảnh hưởng con người | Grand Gate City |
| **Seeker** | Void, Entropy | Khai thác bí ẩn | Ancient Ruins |
| **Tactician** | Order, Void | Thao túng cục diện | GGC Intelligence |
| **Wanderer** | Flux, Freedom | Sống ngoài hệ thống | Wild Zone |

### 3.2 Origin Archetype Effects (Phase 1)

| Ảnh hưởng | Mức độ | Mờ dần khi | Thay vì |
|-----------|--------|-----------|---------|
| Starting Zone | 100% | Không mờ | Fixed per archetype |
| Early narrative bias | 20-30% | ~Chapter 8-10 | Phản ánh approach gốc |
| NPC first impression | Moderate | Identity drift | "Anh thấy giống [archetype]..." |
| Skill catalog bias | Slight | Resonance growth | Ưu tiên nhẹ khi offer skill |

> ⚡ **Thiết kế quan trọng:** Origin Archetype **không giới hạn** vũ khí, skill, hay destiny. Nó chỉ là xuất phát điểm. Một Vanguard có thể trở thành Shadow Broker. Một Wanderer có thể trở thành Emperor.

---

## 4. Tầng 2 — Transmuted Archetype (Chuyển Hóa)

### 4.1 Concept

Khi identity **crystallize** (DQS đủ cao, coherence ổn định hoặc drift đủ dramatic), Origin Archetype **transmute** thành dạng mới phản ánh bạn thực sự là ai.

> Cảm giác: "Thế giới nhìn bạn khác đi. NPC gọi bạn bằng cách khác. Gate phản ứng với bạn khác."

### 4.2 Trigger — Transmutation Event

```python
def check_transmutation_ready(player) -> bool:
    """Kiểm tra điều kiện Archetype Transmutation."""
    return (
        player.current_rank >= ProgressionRank.RESONANT and  # Rank 2+
        player.total_chapters >= 12 and                       # Đủ hành trình
        player.dqs >= 45.0 and                                # Quyết định có chất lượng
        _identity_crystallized(player) and                    # Identity rõ ràng
        not player.archetype_transmuted                       # Chưa transmute
    )

def _identity_crystallized(player) -> bool:
    """Identity đủ rõ ràng để transmute."""
    # CẢ HAI đường đều valid:
    # Đường 1: High coherence — bạn đi đúng con đường
    if player.identity_coherence >= 65 and player.echo_trace >= 50:
        return True
    # Đường 2: Dramatic drift — bạn đã trở thành người khác hoàn toàn
    if (player.identity_coherence < 35 and 
        _drift_distance(player.seed_identity, player.current_identity) >= 0.6):
        return True
    return False
```

> 🔥 **Hai đường đến Transmutation:**
> - **Alignment Path** (coherence ≥ 65): Bạn đi đúng bản chất → transmutation *strengthen* archetype gốc
> - **Divergence Path** (coherence < 35, drift ≥ 0.6): Bạn đã thay đổi hoàn toàn → transmutation *transform* archetype thành dạng mới

### 4.3 Transmutation Branches — Mỗi Archetype có 3 nhánh

Mỗi Origin Archetype có **3 Transmuted Forms** — engine chọn 1 dựa trên identity vector:

---

#### 🗡️ VANGUARD Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Bulwark** (Thành Lũy) | High Devotion + Order oriented | Energy-Matter → Matter-Order | Từ "đối diện" sang "bảo vệ". Không chỉ chiến đấu — mà chiến đấu VÌ ai đó. |
| **Ravager** (Tàn Phong) | High Freedom + Entropy oriented | Energy-Matter → Energy-Entropy | Từ "đối diện" sang "phá hủy". Bão phá hủy mọi thứ, kể cả chính mình. |
| **Sentinel** (Canh Gác) | High Control oriented, strategic | Energy-Matter → Matter-Void | Từ "đối diện" sang "kiểm soát chiến trường". Tĩnh lặng nhưng bao trùm. |

---

#### 🔮 CATALYST Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Architect** (Kiến Tạo) | High Order + Evolution oriented | Flux-Entropy → Flux-Order | Từ "thay đổi" sang "tái cấu trúc". Không phá — xây lại tốt hơn. |
| **Tempest** (Phong Ba) | High Freedom + Chaos oriented | Flux-Entropy → Entropy-Energy | Từ "thay đổi" sang "giải phóng". Cơn bão không phân biệt mục tiêu. |
| **Weaver** (Dệt Sĩ) | High Devotion + Evolution oriented | Flux-Entropy → Flux-Energy | Từ "thay đổi" sang "kết nối". Dệt lại mối quan hệ, chữa lành vết thương. |

---

#### 👑 SOVEREIGN Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Arbiter** (Phán Quan) | Strong Order + Control, fair | Order-Control → Order-Matter | Từ "ảnh hưởng" sang "phán xử". Luật lệ sống. Lời nói thành quy tắc. |
| **Tyrant** (Bạo Chúa) | Extreme Control, ruthless | Order-Control → Control-Void | Từ "ảnh hưởng" sang "thống trị". Bóng tối phục tùng. Fearsome. |
| **Shepherd** (Mục Tử) | High Devotion, self-sacrifice | Order-Control → Order-Devotion* | Từ "ảnh hưởng" sang "hy sinh vì dẫn dắt". Strength through service. |

*Devotion mapped to Energy in mechanical layer (xem POWER_SYSTEM_SPEC §2.2)

---

#### 🔍 SEEKER Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Oracle** (Tiên Tri) | High knowledge + perception | Void-Entropy → Void-Order | Từ "tìm kiếm" sang "nhìn thấy". Thấy mạch vận mệnh. Wisdom incarnate. |
| **Heretic** (Dị Giáo) | High Freedom + questioned authority | Void-Entropy → Entropy-Flux | Từ "tìm kiếm" sang "đặt câu hỏi mọi thứ". Phá vỡ dogma. Dangerous truth. |
| **Archivist** (Lưu Sử) | High Order + systematic approach | Void-Entropy → Void-Matter | Từ "tìm kiếm" sang "ghi chép và bảo tồn". Living library. Guardian of lore. |

---

#### ⚔️ TACTICIAN Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Strategist** (Quân Sư) | High Order + careful planning | Order-Void → Order-Energy | Từ "thao túng" sang "dẫn dắt chiến trường". Tướng quân. Visible authority. |
| **Shadow Broker** (Môi Giới Bóng Tối) | High Control + manipulation | Order-Void → Void-Flux | Từ "thao túng" sang "kiểm soát thông tin". No one knows your face. |
| **Diplomat** (Sứ Giả) | High Devotion + negotiation | Order-Void → Order-Matter | Từ "thao túng" sang "kết nối lợi ích". Bridge between factions. |

---

#### 🌿 WANDERER Transmutation Branches

| Transmuted Form | Điều kiện Identity | Principle Shift | Essence |
|---|---|---|---|
| **Nomad King** (Vua Du Mục) | High Freedom + strong allies | Flux-Freedom → Flux-Energy | Từ "ngoài hệ thống" sang "tạo hệ thống riêng". Caravan becomes kingdom. |
| **Phantom** (Bóng Ma) | High Void + loner path | Flux-Freedom → Void-Flux | Từ "ngoài hệ thống" sang "biến mất khỏi hệ thống". Không ai biết bạn tồn tại. |
| **Pathfinder** (Khai Lộ) | High Evolution + explorer | Flux-Freedom → Flux-Entropy | Từ "ngoài hệ thống" sang "khám phá nơi chưa ai đặt chân". First to arrive. |

### 4.4 Transmutation Narrative Arc (3 scenes)

```
Scene 1 — "Sóng Ngầm" (foreshadowing):
├── beat_type: "discovery"
├── NPC hoặc environment bắt đầu phản ứng khác với player
├── Writer: "Có gì đó thay đổi trong cách thế giới nhìn bạn."
├── Gate energy dao động khi player đi qua
└── Player nhận thức mình đã khác — nhưng chưa biết thế nào

Scene 2 — "Lò Biến Đổi" (climax — narrative trial):
├── beat_type: "discovery" hoặc "combat" (tùy archetype)
├── Tình huống buộc player phải thể hiện full identity:
│   Vanguard: Combat crisis — bảo vệ hay phá hủy?
│   Catalyst: World event — kiến tạo hay hỗn loạn?
│   Sovereign: Political crisis — phán xử hay thống trị?
│   Seeker: Truth revealed — chấp nhận hay phá bỏ?
│   Tactician: Strategic dilemma — dẫn dắt hay thao túng?
│   Wanderer: Choice — định cư hay biến mất?
├── Principle Resonance flare (visual + narrative)
└── Entity (hidden): "Bản chất đã crystallize."

Scene 3 — "Danh Xưng Mới" (Naming Event):
├── beat_type: "discovery"
├── NPCs bắt đầu gọi player bằng tên mới
│   (hoặc player NGHE thế giới gọi tên mới — Principle Whisper)
├── Writer: cinematic description — "Bạn không còn là [Origin]. 
│   Bạn là [Transmuted Form]."
├── New archetype_title set
├── Passive effects begin
└── "Thế giới ghi nhận bạn là [Transmuted Form]."
```

### 4.5 Transmuted Archetype Effects

| Effect | Mức độ | Mô tả |
|--------|--------|-------|
| **Title** | Permanent | NPC gọi bạn bằng Transmuted title thay vì Origin |
| **Narrative Bias** | 15-25% | Planner ưu tiên beat phù hợp với transmuted identity |
| **Principle Resonance** | +0.05 | Resonance bonus cho principles aligned với transmuted form |
| **World Reaction** | Moderate | NPCs phản ứng khác dựa trên transmuted form |
| **Gate Affinity** | Minor | Gate gần nhất có minor response (stability ±2) khi player hiện diện |

---

## 5. Tầng 3 — Ascendant Archetype (Siêu Việt)

### 5.1 Concept

Đỉnh cao của Season 1. Player không chỉ có danh xưng — player **định nghĩa không gian xung quanh**. Giống Rimuru khi trở thành True Demon Lord — thế giới thay đổi vì sự hiện diện của bạn.

> Cảm giác: "Bạn bước vào phòng — không khí thay đổi. Principle trong vùng dao động theo nhịp bạn."

### 5.2 Trigger — Ascendant Ascension

```python
def check_ascendant_ascension(player) -> bool:
    """Điều kiện cho Tầng 3 — Ascendant Archetype."""
    return (
        player.current_rank >= ProgressionRank.TRANSCENDENT and  # Rank 4+
        player.archetype_transmuted and                          # Đã Transmute
        player.dqs >= 70.0 and                                   # High DQS
        player.unique_skill_growth.aspect_forged and             # Aspect Forge done
        _has_domain_event(player) and                            # Domain-specific event
        not player.archetype_ascended
    )

def _has_domain_event(player) -> bool:
    """Yêu cầu 1 major narrative event phù hợp với archetype."""
    # Ví dụ:
    # Bulwark: Bảo vệ thành công một cộng đồng khỏi thảm họa
    # Ravager: Phá hủy một mối đe dọa cấp tướng
    # Oracle: Giải mã một bí ẩn cổ đại
    # Shadow Broker: Thao túng thành công một cuộc chiến phe phái
    return player.domain_event_completed
```

### 5.3 Ascendant Forms — Tiến hóa từ Transmuted

Mỗi Transmuted Form có **1 Ascendant Form** (không phân nhánh — identity đã đủ rõ ở tầng này):

| Origin → Transmuted | → Ascendant Form | Essence | Domain Power |
|---|---|---|---|
| Vanguard → Bulwark | **Fortress Sovereign** (Pháo Đài Sống) | Vùng bạn đứng = vùng an toàn tuyệt đối | **Bastion Domain**: Stability của allies trong phạm vi +15%. Enemy stability drain -10%. |
| Vanguard → Ravager | **Storm Incarnate** (Hiện Thân Bão Táp) | Sự phá hủy có mục đích = sức mạnh nguyên thủy | **Tempest Domain**: Instability của enemies trong phạm vi +5 per scene. Resonance decay tăng gấp đôi cho opponent. |
| Vanguard → Sentinel | **Iron Warden** (Thiết Vệ) | Kiểm soát tuyệt đối chiến trường | **Ward Domain**: Player chọn 1 principle — suppress nó trong vùng (enemy skills dùng principle đó bị -0.10 resonance). |
| Catalyst → Architect | **Reality Shaper** (Người Định Hình) | Bạn không thay đổi thế giới — bạn tái tạo nó | **Forge Domain**: 1 lần per encounter, player có thể thay đổi floor_modifier principle. |
| Catalyst → Tempest | **Chaos Sovereign** (Hỗn Nguyên Chúa) | Hỗn loạn CHÍNH LÀ trật tự của bạn | **Entropy Domain**: Principle interactions trong vùng bị đảo (Strong ↔ Weak). |
| Catalyst → Weaver | **Lifethread** (Sợi Sinh Mệnh) | Dệt lại kết nối — healing through connection | **Weave Domain**: Allies trong vùng hồi 3 stability per scene. Player hồi 1 stability mỗi khi ally dùng skill. |
| Sovereign → Arbiter | **Living Law** (Luật Sống) | Lời bạn nói trở thành quy tắc | **Decree Domain**: 1 lần per chapter, player ban 1 "Law" — NPC trong vùng buộc phải tuân theo (narrative). |
| Sovereign → Tyrant | **Dread Sovereign** (Bạo Chúa Tối Thượng) | Sợ hãi là vũ khí mạnh nhất | **Terror Domain**: Enemy morale -20%. First encounter phase: enemy có 30% chance retreat. |
| Sovereign → Shepherd | **Saint Warden** (Thánh Thủ Hộ) | Sức mạnh từ hy sinh | **Grace Domain**: Khi player HP < 30%, allies nhận +0.05 resonance bonus. Player chết → allies hồi full stability (1/season). |
| Seeker → Oracle | **Truth Seer** (Mắt Chân Lý) | Nhìn thấy mạch vận mệnh | **Sight Domain**: Player nhận boss tells sớm 1 phase. Hidden enemy weaknesses lộ ra. |
| Seeker → Heretic | **Dogma Breaker** (Kẻ Phá Giáo) | Phá vỡ mọi hệ thống tin tưởng | **Doubt Domain**: Enemy skills mất 1 sub-effect (random). Construct/barrier enemy yếu hơn -15%. |
| Seeker → Archivist | **Lore Keeper** (Hộ Thư Sống) | Kiến thức là sức mạnh, ghi chép là bất tử | **Archive Domain**: Player nhận lore fragment mỗi combat. Accumulated lore → permanent resonance bonus +0.02. |
| Tactician → Strategist | **Grand Marshal** (Đại Nguyên Soái) | Chiến trường là bàn cờ | **Command Domain**: Player chọn thứ tự phase (2 phases ahead) thay vì engine random. |
| Tactician → Shadow Broker | **Unseen Hand** (Bàn Tay Vô Hình) | Điều khiển mà không ai nhìn thấy | **Veil Domain**: Player's true Archetype ẩn khỏi NPC detection. 1 lần per chapter: redirect attention (enemy target NPC thay vì player). |
| Tactician → Diplomat | **Bridge Walker** (Người Đi Giữa) | Kết nối mọi phe phái | **Treaty Domain**: Faction hostility toward player giảm 25%. Negotiation events success rate +20%. |
| Wanderer → Nomad King | **Horizon Lord** (Chúa Tể Chân Trời) | Tự do CHÍNH LÀ vương quốc | **Frontier Domain**: Không bị floor resonance cap debuff. Di chuyển giữa zones không mất stability. |
| Wanderer → Phantom | **Null Walker** (Bước Đi Hư Vô) | Tồn tại ngoài mọi hệ thống — kể cả thực tại | **Null Domain**: Notoriety decay ×3. Empire Watcher KHÔNG detect. Anti-Unique Field hiệu ứng giảm 50%. |
| Wanderer → Pathfinder | **Frontier Sage** (Sư Tổ Khai Hoang) | Đi nơi chưa ai đặt chân — và sống sót để kể lại | **Pioneer Domain**: Floor mới: resonance growth ×1.5 (thay vì ×1.0). Exploration reward +1 tier. |

### 5.4 Ascendant Ascension — Naming Event (Trọng Đại)

Tương tự "Tên Đặt" (Naming) trong Slime — nhưng thay vì Rimuru đặt tên cho thuộc hạ, thế giới **đặt tên cho player**:

```
Ascendant Ascension Arc (5 scenes — major arc):

Scene 1 — "Tiền Chấn" (Tremor):
├── World events converge — Gate dao động, NPC tụ tập
├── Principle Whisper: player nghe Archon thì thầm
└── Foreshadowing: "Có gì đó sắp xảy ra cho bạn."

Scene 2 — "Thử Thách Bản Thể" (Domain Trial):
├── Domain-specific trial — khó nhất đến giờ
├── Player phải thể hiện bản chất ascendant:
│   Combat-based: 1v1 với Domain Guardian (Principle construct)
│   Social-based: Resolve faction crisis đơn độc
│   Exploration-based: Navigate reality fracture zone
└── Failure = retry sau 5 chapters (không mất progress)

Scene 3 — "Cộng Hưởng Đỉnh" (Resonance Peak):
├── Player's Principle resonance flare — visual description
├── Gate(s) gần nhất phản ứng (stability dao động ±5)
├── NPCs trong vùng CẢM THẤY sự thay đổi
└── Entity: "Thực tại đang co giãn quanh bạn."

Scene 4 — "Thế Giới Gọi Tên" (World Names You):
├── NAMING EVENT — tương tự Rimuru naming
├── Player không tự chọn tên — AI generate based on journey
├── Format: "[Danh Xưng Ascendant] — [Epithet]"
│   VD: "Pháo Đài Sống — Người Không Ngã"
│   VD: "Bạo Chúa Tối Thượng — Bóng Tối Thức Tỉnh"
│   VD: "Mắt Chân Lý — Kẻ Nhìn Thấu Mọi Bức Màn"
├── This name becomes player's ASCENDANT TITLE
└── NPCs, faction leaders, even enemies acknowledge this title

Scene 5 — "Domain Manifestation" (First Use):
├── Domain Power kích hoạt lần đầu trong combat/event
├── Writer viết cinematic description
├── World reacts: NPC spread news, faction adjusts
└── "Bạn không chỉ sống trong thế giới này. 
     Thế giới này bắt đầu sống THEO bạn."
```

### 5.5 Ascendant Effects

| Effect | Mức độ | Persistence |
|--------|--------|-------------|
| **Ascendant Title** | Permanent | Luôn hiển thị |
| **Domain Power** | Active (1/encounter or 1/chapter depending on type) | Permanent once ascended |
| **Aura Presence** | Passive narrative | NPC trong vùng phản ứng — respect, fear, or awe |
| **Principle Flare** | Visual narrative | Writer mô tả principle energy quanh player |
| **Gate Sensitivity** | Passive | Gate stability dao động nhẹ khi Ascendant gần |
| **Notoriety Spike** | +25 immediate | Empire/Factions PHẢI phản ứng |

---

## 6. Tầng 4 — Legendary Being (Truyền thuyết) — Season 2+

### 6.1 Concept (Chỉ Gieo Hạt — Season 1 không implement)

> Khi một Ascendant vượt qua giới hạn cuối cùng — khi identity + power + world impact đạt đỉnh — thế giới **viết bạn vào lịch sử**. Bạn trở thành **huyền thoại sống** — như Ancient Guardians thuở xưa.

### 6.2 Manh Mối Season 1

Không implement Tầng 4 trong Season 1, nhưng **gieo hạt**:

- NPC già kể về Ancient Guardians: *"Họ cũng bắt đầu như bạn..."*
- Artifact cổ đại có dấu ấn Principle cực mạnh — giống Ascendant nhưng mạnh hơn nhiều
- The Veiled Will phản ứng với Ascendant: *"Nó... nhìn bạn."*
- Council of Pillars lo sợ: *"Lần cuối có người đạt tầng này — thế giới thay đổi vĩnh viễn."*

### 6.3 Vision (Season 2+)

| Aspect | Legendary Being |
|--------|----------------|
| **Giới hạn** | Chỉ 1 per server (MMO) hoặc per story (singleplayer) |
| **Trigger** | Season Climax + Ultimate Skill + Ascendant Domain mastery |
| **Effect** | World-altering — Principle balance của thế giới thay đổi |
| **Archon Reaction** | Archon tương ứng manifestation — thần thánh BIẾT bạn tồn tại |
| **Lore Impact** | Player được ghi vào World Bible lore — NPC đời sau nhắc đến |

---

## 7. Archetype Evolution × Existing Systems

### 7.1 × Rank System (PROGRESSION_SYSTEM_SPEC)

```
Rank 1 (Awakened)     → Origin Archetype (Tầng 1) — fixed
Rank 2 (Resonant)     → Transmutation eligible (Tầng 2) — ~Ch 12
Rank 3 (Stabilized)   → Transmutation likely complete
Rank 4 (Transcendent) → Ascendant Ascension eligible (Tầng 3) — ~Ch 30
Rank 5 (Sovereign)    → Ascendant established + Ultimate Skill
```

> **Lưu ý:** Archetype evolution và Rank up là **hai hệ thống song song**, không phải cùng event. Transmutation có thể xảy ra trước hoặc sau Rank 2 lên 3. Ascendant Ascension xảy ra tại Rank 4, KHÔNG phải Rank 5 (không còn conflict naming với Rank 5 "Sovereign").

### 7.2 × Unique Skill Growth (UNIQUE_SKILL_GROWTH_SPEC)

```
Timeline:
├── Ch 1-3:  Origin Archetype set (Tầng 1) + Unique Skill seed
├── Ch 5-10: Echo/Scar Bloom (Unique Skill) — skill grows
├── Ch 12-15: Transmutation Event (Tầng 2) — archetype evolves
├── Ch 15-25: Skill Mutation possible (identity drift)
├── Ch 30-35: Aspect Forge (Unique Skill branches)
├── Ch 30-40: Ascendant Ascension Event (Tầng 3) — archetype peaks
├── Ch 40-48: Ultimate Skill Form (Unique Skill culmination)
└── Season End: Ascendant Archetype + Ultimate Skill established
```

**Interaction rules:**
- Transmutation và Unique Skill growth là **independent** — có thể trigger cùng chapter nhưng là separate events
- Ascendant Ascension yêu cầu Aspect Forge completed (dependency)
- Ultimate Skill Generation sử dụng Ascendant Title trong naming (VD: "Thiên Nhãn — Mắt Chân Lý")
- Domain Power KHÔNG conflict với combat score — Domain là narrative effect, không phải combat bonus

### 7.3 × Identity System

| Event | Identity Effect |
|-------|----------------|
| Transmutation | `archetype_title` update + identity crystallization marker |
| Ascendant Ascension | `ascendant_title` + Domain active + permanent identity anchor |
| Failed trial | No penalty — retry window (Rimuru-style: "chưa đủ conditions") |

### 7.4 × Villain System

| Archetype Tier | Empire Reaction |
|---|---|
| Origin (Tầng 1) | Watcher — passive observation |
| Transmuted (Tầng 2) | Enforcement — active conflict begins |
| Ascendant (Tầng 3) | General notice — direct confrontation from Regional General |

> 🎭 **Thiết kế đặc biệt:** Ascendant Ascension **sẽ trigger Empire escalation**. Khi player trở thành Ascendant, Empire không thể bỏ qua nữa → General deployment → dramatic tension tăng tự nhiên.

---

## 8. Data Models

```python
# app/models/archetype_evolution.py [NEW]

from enum import Enum
from pydantic import BaseModel, Field


class ArchetypeTier(int, Enum):
    ORIGIN = 1          # Tầng 1 — Khởi Nguyên
    TRANSMUTED = 2      # Tầng 2 — Chuyển Hóa
    ASCENDANT = 3       # Tầng 3 — Siêu Việt
    LEGENDARY = 4       # Tầng 4 — Truyền Thuyết (Season 2+)


class OriginArchetype(str, Enum):
    VANGUARD = "vanguard"
    CATALYST = "catalyst"
    SOVEREIGN_ARCHETYPE = "sovereign"  # Tránh conflict với Sovereign tier
    SEEKER = "seeker"
    TACTICIAN = "tactician"
    WANDERER = "wanderer"


class TransmutedArchetype(str, Enum):
    # Vanguard branches
    BULWARK = "bulwark"
    RAVAGER = "ravager"
    SENTINEL = "sentinel"
    # Catalyst branches
    ARCHITECT = "architect"
    TEMPEST = "tempest"
    WEAVER = "weaver"
    # Sovereign branches
    ARBITER = "arbiter"
    TYRANT = "tyrant"
    SHEPHERD = "shepherd"
    # Seeker branches
    ORACLE = "oracle"
    HERETIC = "heretic"
    ARCHIVIST = "archivist"
    # Tactician branches
    STRATEGIST = "strategist"
    SHADOW_BROKER = "shadow_broker"
    DIPLOMAT = "diplomat"
    # Wanderer branches
    NOMAD_KING = "nomad_king"
    PHANTOM = "phantom"
    PATHFINDER = "pathfinder"


class AscendantArchetype(str, Enum):
    # Vanguard line
    FORTRESS_SOVEREIGN = "fortress_sovereign"
    STORM_INCARNATE = "storm_incarnate"
    IRON_WARDEN = "iron_warden"
    # Catalyst line
    REALITY_SHAPER = "reality_shaper"
    CHAOS_SOVEREIGN = "chaos_sovereign"
    LIFETHREAD = "lifethread"
    # Sovereign line
    LIVING_LAW = "living_law"
    DREAD_SOVEREIGN = "dread_sovereign"
    SAINT_WARDEN = "saint_warden"
    # Seeker line
    TRUTH_SEER = "truth_seer"
    DOGMA_BREAKER = "dogma_breaker"
    LORE_KEEPER = "lore_keeper"
    # Tactician line
    GRAND_MARSHAL = "grand_marshal"
    UNSEEN_HAND = "unseen_hand"
    BRIDGE_WALKER = "bridge_walker"
    # Wanderer line
    HORIZON_LORD = "horizon_lord"
    NULL_WALKER = "null_walker"
    FRONTIER_SAGE = "frontier_sage"


class DomainPower(BaseModel):
    """Ascendant Domain active ability."""
    name: str = ""
    description: str = ""
    effect_type: str = ""       # "combat" | "narrative" | "passive"
    uses_per: str = ""          # "encounter" | "chapter" | "season" | "passive"
    active: bool = False


class ArchetypeEvolutionState(BaseModel):
    """Complete archetype evolution state for a player."""
    # Tier 1 — Origin
    origin: OriginArchetype = OriginArchetype.VANGUARD
    
    # Tier 2 — Transmuted
    current_tier: ArchetypeTier = ArchetypeTier.ORIGIN
    transmuted_form: TransmutedArchetype | None = None
    transmutation_path: str = ""     # "alignment" | "divergence"
    transmutation_chapter: int = 0
    archetype_title: str = ""        # VN display name
    
    # Tier 3 — Ascendant
    ascendant_form: AscendantArchetype | None = None
    ascendant_title: str = ""        # "[Danh Xưng] — [Epithet]"
    ascendant_epithet: str = ""
    domain_power: DomainPower = Field(default_factory=DomainPower)
    ascension_chapter: int = 0
    
    # Tier 4 — Legendary (Season 2+ stub)
    legendary_seed: bool = False     # Đã gieo hạt chưa
    
    # Tracking
    domain_event_completed: bool = False
    trial_failed_count: int = 0


# === Transmutation Mapping ===

TRANSMUTATION_MAP: dict[OriginArchetype, dict[str, TransmutedArchetype]] = {
    OriginArchetype.VANGUARD: {
        "devotion_order": TransmutedArchetype.BULWARK,
        "freedom_entropy": TransmutedArchetype.RAVAGER,
        "control_strategic": TransmutedArchetype.SENTINEL,
    },
    OriginArchetype.CATALYST: {
        "order_evolution": TransmutedArchetype.ARCHITECT,
        "freedom_chaos": TransmutedArchetype.TEMPEST,
        "devotion_evolution": TransmutedArchetype.WEAVER,
    },
    OriginArchetype.SOVEREIGN_ARCHETYPE: {
        "order_control": TransmutedArchetype.ARBITER,
        "control_extreme": TransmutedArchetype.TYRANT,
        "devotion_sacrifice": TransmutedArchetype.SHEPHERD,
    },
    OriginArchetype.SEEKER: {
        "knowledge_perception": TransmutedArchetype.ORACLE,
        "freedom_questioning": TransmutedArchetype.HERETIC,
        "order_systematic": TransmutedArchetype.ARCHIVIST,
    },
    OriginArchetype.TACTICIAN: {
        "order_planning": TransmutedArchetype.STRATEGIST,
        "control_manipulation": TransmutedArchetype.SHADOW_BROKER,
        "devotion_negotiation": TransmutedArchetype.DIPLOMAT,
    },
    OriginArchetype.WANDERER: {
        "freedom_allies": TransmutedArchetype.NOMAD_KING,
        "void_loner": TransmutedArchetype.PHANTOM,
        "evolution_explorer": TransmutedArchetype.PATHFINDER,
    },
}

ASCENDANT_MAP: dict[TransmutedArchetype, AscendantArchetype] = {
    TransmutedArchetype.BULWARK: SovereignArchetype.FORTRESS_SOVEREIGN,
    TransmutedArchetype.RAVAGER: SovereignArchetype.STORM_INCARNATE,
    TransmutedArchetype.SENTINEL: SovereignArchetype.IRON_WARDEN,
    TransmutedArchetype.ARCHITECT: SovereignArchetype.REALITY_SHAPER,
    TransmutedArchetype.TEMPEST: SovereignArchetype.CHAOS_SOVEREIGN,
    TransmutedArchetype.WEAVER: SovereignArchetype.LIFETHREAD,
    TransmutedArchetype.ARBITER: SovereignArchetype.LIVING_LAW,
    TransmutedArchetype.TYRANT: SovereignArchetype.DREAD_SOVEREIGN,
    TransmutedArchetype.SHEPHERD: SovereignArchetype.SAINT_WARDEN,
    TransmutedArchetype.ORACLE: SovereignArchetype.TRUTH_SEER,
    TransmutedArchetype.HERETIC: SovereignArchetype.DOGMA_BREAKER,
    TransmutedArchetype.ARCHIVIST: SovereignArchetype.LORE_KEEPER,
    TransmutedArchetype.STRATEGIST: SovereignArchetype.GRAND_MARSHAL,
    TransmutedArchetype.SHADOW_BROKER: SovereignArchetype.UNSEEN_HAND,
    TransmutedArchetype.DIPLOMAT: SovereignArchetype.BRIDGE_WALKER,
    TransmutedArchetype.NOMAD_KING: SovereignArchetype.HORIZON_LORD,
    TransmutedArchetype.PHANTOM: SovereignArchetype.NULL_WALKER,
    TransmutedArchetype.PATHFINDER: SovereignArchetype.FRONTIER_SAGE,
}
```

---

## 9. Engine Integration

### 9.1 Transmutation Check (per scene — lightweight)

```python
def check_archetype_evolution(player, scene_result) -> dict | None:
    """Called after every scene. No LLM needed."""
    evo = player.archetype_evolution
    
    # Already at max tier for Phase 1
    if evo.current_tier >= ArchetypeTier.ASCENDANT:
        return None
    
    # Check Transmutation (Tier 1 → 2)
    if evo.current_tier == ArchetypeTier.ORIGIN:
        if check_transmutation_ready(player):
            transmuted = _determine_transmuted_form(player)
            return {
                "event": "transmutation_ready",
                "target_form": transmuted,
                "path": "alignment" if player.identity_coherence >= 65 else "divergence",
            }
    
    # Check Ascendant Ascension (Tier 2 → 3)
    if evo.current_tier == ArchetypeTier.TRANSMUTED:
        if check_ascendant_ascension(player):
            ascendant = ASCENDANT_MAP[evo.transmuted_form]
            return {
                "event": "ascension_ready",
                "target_form": ascendant,
            }
    
    return None


def _determine_transmuted_form(player) -> TransmutedArchetype:
    """Xác định form dựa trên identity vector."""
    origin = player.archetype_evolution.origin
    branches = TRANSMUTATION_MAP[origin]
    
    # Score each branch against current identity
    best_match = None
    best_score = -1
    for key, form in branches.items():
        score = _score_identity_match(player.current_identity, key)
        if score > best_score:
            best_score = score
            best_match = form
    
    return best_match
```

### 9.2 Planner Integration

```python
ARCHETYPE_BEATS = {
    "transmutation_ready": {
        "beat_type": "discovery",
        "description": "Archetype Transmutation arc (3 scenes)",
        "priority": "critical",
        "scenes_needed": 3,
    },
    "ascension_ready": {
        "beat_type": "discovery", 
        "description": "Ascendant Ascension arc (5 scenes)",
        "priority": "critical",
        "scenes_needed": 5,
    },
}
```

### 9.3 Prompt Integration

```
## ARCHETYPE STATE:
- Origin: {origin_archetype}
- Current Tier: {tier} ({tier_name})
- Transmuted Form: {transmuted_form or "Not yet transmuted"}
- Ascendant Title: {ascendant_title or "Not yet ascended"}
- Domain Power: {domain_power.name or "None"}
- Evolution Status: {status_description}
```

---

## 10. Phase 1 Scope

### 10.1 Must-Have (Phase 1)

| Component | Complexity | Notes |
|-----------|-----------|-------|
| Origin Archetype (6 types) | ✅ Exists | Already in Soul Forge |
| Transmutation trigger check | Low | Per-scene lightweight check |
| Transmuted Form determination | Medium | Identity vector scoring |
| Transmutation Narrative Arc (3 scenes) | Medium | Planner beats + Writer prose |
| Transmuted Archetype effects (title, bias) | Low | Prompt injection |
| Archetype state tracking | Low | New model, simple fields |
| `ArchetypeEvolutionState` model | Low | New file |

### 10.2 Phase 2

| Component | Notes |
|-----------|-------|
| Ascendant Ascension full arc (5 scenes) | Cần Rank 4 system hoàn chỉnh |
| Domain Powers (18 ascendant forms) | Cần combat integration |
| Ascendant Naming Event (AI generated) | Cần AI Forge prompt |
| Empire escalation on Ascendant | Cần Villain System wiring |
| Gate sensitivity effects | Cần world_state mở rộng |

### 10.3 Season 2+ (Không implement)

| Component | Notes |
|-----------|-------|
| Legendary Being (Tầng 4) | 1 per server, world-altering |
| Cross-archetype hybrid | VD: Ravager + Oracle traits |
| Archetype lineage | NPC nhắc đến player-truyền thuyết |

---

## 11. Giới hạn an toàn

| Quy tắc | Lý do |
|---------|-------|
| Player KHÔNG chọn Transmuted Form — engine quyết định | Behavior-driven, không gaming |
| Transmutation là narrative arc, không popup | Immersion |
| Ascendant Ascension yêu cầu Aspect Forge | Gate dependency — đảm bảo player đủ trưởng thành |
| Domain Power là narrative, không phá combat | Solo dev scope — không thêm combat complexity |
| Max 1 Ascendant per timeline (no multi-class) | Clarity, identity-driven |
| Failed trial = retry, không penalty | Rimuru-style: "chưa đủ" thay vì "thất bại" |
| Tầng 4 chỉ gieo hạt Season 1 | Scope control |

---

## 12. So Sánh Toàn Diện với Rimuru Evolution

| Aspect | Rimuru (Tensura) | Amoisekai |
|--------|-----------------|-----------|
| **Bản chất** | Species evolution (Slime → Demon Slime → True Demon Lord) | Identity evolution (Vanguard → Bulwark → Fortress Sovereign) |
| **Trigger** | Absorb + Crisis + Naming | Identity crystallization + Narrative Arc + World Recognition |
| **Tên** | Rimuru đặt tên cho thuộc hạ → evolution | Thế giới đặt tên cho player → Archetype tiến hóa |
| **Skill tiến hóa cùng** | Predator → Gluttony → Beelzebuth | Unique Skill: Seed → Bloom → Aspect → Ultimate (parallel track) |
| **Subordinate evolution** | Naming: Goblin → Hobgoblin | Phase 2+: Player Ascendant naming NPC allies |
| **Uniqueness** | Mỗi Demon Lord khác nhau | Mỗi Ascendant khác nhau (18 forms × unique naming) |
| **Domain** | Demon Lord có domain cá nhân | Ascendant Domain — narrative aura + minor mechanics |
| **World impact** | True Demon Lord → world acknowledges | Ascendant Ascension → Gate responds, factions react |
| **God-tier** | Ultimate Skill (Ciel, Raphael) | Ultimate Skill Form (§UNIQUE_SKILL_GROWTH_SPEC) |

---

## Appendix A: Quyết Định Thiết Kế

| Câu hỏi | Quyết định | Lý do |
|----------|-----------|-------|
| Bao nhiêu tầng? | **4** (3 implement Phase 1-2, 1 gieo hạt) | Đủ sâu cho progression, không quá nhiều cho solo dev |
| Player chọn Transmuted Form? | **KHÔNG** — engine quyết định | Behavior-driven consistency với toàn bộ design philosophy |
| Ascendant Ascension có thể fail? | **Retry** — không penalty | Tránh frustration, giống Rimuru: "chưa đủ condition" |
| Domain Power phá combat? | **KHÔNG** — narrative-first | Solo dev scope, avoid combat rebalance |
| Tầng 4 implement Season 1? | **KHÔNG** — chỉ gieo hạt | Scope control, mystery building |
| Archetype evolution ảnh hưởng Unique Skill? | **Song song, không conflict** | 2 hệ thống complement nhau, không phụ thuộc |
| Rank "Sovereign" conflict với Ascendant Archetype? | **KHÔNG** — đã tách naming hoàn toàn. Rank 5 = progression, Ascendant = identity evolution | Naming rõ ràng, không confuse |

## Appendix B: Tất Cả 18 Ascendant Forms — Quick Reference

```
VANGUARD LINE:
  Vanguard → Bulwark    → Fortress Sovereign (Pháo Đài Sống)
  Vanguard → Ravager    → Storm Incarnate (Hiện Thân Bão Táp)
  Vanguard → Sentinel   → Iron Warden (Thiết Vệ)

CATALYST LINE:
  Catalyst → Architect  → Reality Shaper (Người Định Hình)
  Catalyst → Tempest    → Chaos Sovereign (Hỗn Nguyên Chúa)
  Catalyst → Weaver     → Lifethread (Sợi Sinh Mệnh)

SOVEREIGN LINE:
  Sovereign → Arbiter   → Living Law (Luật Sống)
  Sovereign → Tyrant    → Dread Sovereign (Bạo Chúa Tối Thượng)
  Sovereign → Shepherd  → Saint Warden (Thánh Thủ Hộ)

SEEKER LINE:
  Seeker → Oracle       → Truth Seer (Mắt Chân Lý)
  Seeker → Heretic      → Dogma Breaker (Kẻ Phá Giáo)
  Seeker → Archivist    → Lore Keeper (Hộ Thư Sống)

TACTICIAN LINE:
  Tactician → Strategist    → Grand Marshal (Đại Nguyên Soái)
  Tactician → Shadow Broker → Unseen Hand (Bàn Tay Vô Hình)
  Tactician → Diplomat      → Bridge Walker (Người Đi Giữa)

WANDERER LINE:
  Wanderer → Nomad King  → Horizon Lord (Chúa Tể Chân Trời)
  Wanderer → Phantom     → Null Walker (Bước Đi Hư Vô)
  Wanderer → Pathfinder  → Frontier Sage (Sư Tổ Khai Hoang)
```
