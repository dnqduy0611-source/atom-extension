# AMOISEKAI — Phase 1 Adaptive Engine Spec v1.0

> **Author:** Amo
> **Date:** 2026-02-28
> **Status:** Draft — Addendum to PHASE1_SINGLEPLAYER_SPEC v1.0
> **Dependencies:** PHASE1_SINGLEPLAYER_SPEC v1.0, GDD_v1.0, IDENTITY INSTABILITY SYSTEM v1, ECHO OF ORIGIN SYSTEM v1, VILLAIN_SYSTEM_SPEC v1.0

> *16–29 chapters là khung xương. Archetype × Playstyle là thịt và linh hồn.*
> *Hai người chơi cùng chọn Wanderer sẽ không có cùng một câu chuyện.*

---

## Vấn Đề Cần Giải Quyết

PHASE1_SINGLEPLAYER_SPEC mô tả **milestone beats** — những điểm quan trọng trong hành trình. Nhưng nó không trả lời:

- *Cùng Act 2, nhưng Vanguard trải qua gì khác Wanderer?*
- *Cái gì cụ thể làm Seeker mất identity coherence — không giống với Sovereign?*
- *Emissary được assign nói chuyện với Tactician như thế nào khác với cách tiếp cận Catalyst?*
- *Assigned General đặt câu hỏi gì cho từng archetype?*
- *Player chơi thận trọng vs. player chơi liều lĩnh — hành trình khác nhau ra sao?*

Document này định nghĩa **lớp adaptive** — phần AI narrative engine dùng để generate content khác nhau cho từng người.

---

## Kiến Trúc 3 Lớp

```
┌─────────────────────────────────────────────────────────┐
│  Lớp 3: MILESTONE FRAMEWORK (từ PHASE1_SINGLEPLAYER)   │
│  16–29 chapters (variable), 4 hồi, story beats condition-based  │
└────────────────────────┬────────────────────────────────┘
                         │ drives
┌────────────────────────▼────────────────────────────────┐
│  Lớp 2: PLAY STYLE ENGINE                               │
│  5 behavioral axes, tracked per chapter                 │
│  Ảnh hưởng: timing, event triggers, tone               │
└────────────────────────┬────────────────────────────────┘
                         │ combines with
┌────────────────────────▼────────────────────────────────┐
│  Lớp 1: ARCHETYPE SEED                                  │
│  6 archetypes, mỗi cái có identity shape riêng          │
│  Ảnh hưởng: drift triggers, NCE form, villain approach  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              AI generates unique content
              cho từng player combination
```

---

## Lớp 1 — Archetype Seeds

### Archetype Seed là gì?

Archetype không phải class. Nó là **cách nhân vật tiếp cận thế giới** — bias 20-30% narrative, không lock skill hay path. Archetype có thể drift và hòa trộn theo thời gian.

> **Source:** Archetype được xác định bởi **Soul Forge** (SOUL_FORGE_SPEC §6.2). AI Forge tự chọn archetype (1/6) dựa trên soul data từ 3 phases (Micro-Narrative → Soul Fragment → Behavioral Fingerprint). Archetype này là input cho toàn bộ Adaptive Engine.

Mỗi archetype có:
- **Identity Vector khởi đầu**: 5 dimensions (order, freedom, evolution, control, devotion)
- **Natural drift trigger**: hành động nào cụ thể gây coherence drop
- **Natural drift direction**: drift về đâu nếu không được anchor
- **DNA Affinity bias**: soft weight cho skill category likely emerge (xem note bên dưới)
- **Act 1 entry point**: player tiếp cận thế giới như thế nào
- **M1.3 skill manifestation**: context trigger cụ thể
- **Hồi 2 coherence threat**: thứ gì cụ thể thử thách identity trong mid-game
- **NCE core question**: câu hỏi cụ thể mà Narrative Confrontation Event đặt ra
- **Assigned Emissary approach**: Emissary được assign tiếp cận archetype này như thế nào
- **Assigned General's shadow line**: câu General nói riêng cho archetype này

---

### VANGUARD — "Kẻ Đối Diện Trực Tiếp"

```
Identity Vector khởi đầu:
  order: 60     freedom: 70    evolution: 50
  control: 55   devotion: 40

Cơ chế đặc trưng:
  → Tiếp cận thế giới qua confrontation — combat, argument, direct challenge
  → Mạnh nhất khi có kẻ thù rõ ràng để đối đầu
  → Yếu nhất khi kẻ thù là mơ hồ, là chính mình, hoặc là người thân

Natural drift triggers:
  - Chọn không chiến đấu khi có thể → coherence giảm (không sống theo bản năng)
  - Chiến thắng nhưng gây collateral damage không muốn → instability tăng
  - Bị buộc phải dùng mưu kế thay vì đối đầu trực tiếp → drift về hướng Tactician
  - Chiến đấu vì người khác đến mức quên chiến đấu cho mình → drift về hướng Sovereign/Catalyst (bảo vệ thay vì đối đầu)

DNA Affinity bias (soft weight — Soul Forge AI likely chọn nhưng không bắt buộc): Manifestation (combat amplification), Contract (oath of battle)

Act 1 entry point:
  Vanguard không quan sát, không hỏi — họ bước thẳng vào nguy hiểm đầu tiên gặp được.
  World giới thiệu qua conflict, không phải exposition.
  "Anh đến Minor Gate, thấy ai đó bị tấn công. Không cần suy nghĩ."

M1.3 — Skill manifestation:
  Trigger: Đang ở thế không thể thắng bằng sức. Kẻ thù quá mạnh.
  Moment: Thay vì bỏ chạy, Vanguard đứng lại. Skill bùng phát từ sự từ chối thất bại.
  Form: Combat amplification — thứ đang trong người bổ sung cho sức mạnh vật lý.

Hồi 2 — Coherence threat:
  Act 2 Early: Phải chọn giữa "chiến đấu và thắng" vs "không chiến đấu và cứu được nhiều người hơn"
  Act 2 Mid: Empire Outer Corruption có strategy — không thể đánh thẳng. Phải dùng cách khác.
  Act 2 Late: Mirror NPC là Vanguard đã trở thành công cụ — mạnh nhưng không còn chủ ý.

NCE core question (Act 3, M3.4):
  Form: Form A (ảo giác) — gặp phiên bản mình đã chỉ biết chiến đấu, không còn biết tại sao.
  Câu hỏi:
    "Anh đã chiến đấu với mọi thứ đứng trước mặt.
    Nhưng có những thứ không cần bị đánh — anh đã phá vỡ chúng mà không nhận ra.
    Vậy anh bảo vệ cái gì, hay anh chỉ chiến đấu vì đó là thứ duy nhất anh biết làm?"

Emissary Thol tiếp cận:
  Thol respect sức mạnh trực tiếp. Không dùng words nhiều — chiến đấu cạnh Vanguard trước khi nói.
  "Tôi thấy anh chiến đấu. Tôi chưa thấy ai chiến đấu vì lý do đúng."
  Philosophy hint: "Một kẻ đủ mạnh không cần chọn phe — chỉ cần chọn survival. Empire hiểu điều đó."

General Vorn's shadow line:
  "Phá vỡ không phải sức mạnh. Xây dựng mới là.
  Anh có thể hạ gục tất cả. Nhưng khi trận đánh kết thúc, anh đã xây được gì?"
```

---

### CATALYST — "Kẻ Thay Đổi Môi Trường"

```
Identity Vector khởi đầu:
  order: 35     freedom: 75    evolution: 80
  control: 45   devotion: 50

Cơ chế đặc trưng:
  → Tiếp cận thế giới bằng cách thay đổi conditions, không phải đối đầu trực tiếp
  → Mạnh nhất khi có thời gian chuẩn bị và resource để thay đổi
  → Yếu nhất khi hậu quả của thay đổi vượt tầm kiểm soát

Natural drift triggers:
  - Một thay đổi gây chain reaction ngoài ý muốn → instability tăng mạnh
  - Thay đổi environment để thắng nhưng dân thường bị ảnh hưởng → coherence giảm
  - Ai đó bị tổn hại bởi "cải thiện" của Catalyst → mirror moment sớm

DNA Affinity bias: Manipulation (change amplifier), Perception (see systems)

Act 1 entry point:
  Catalyst nhận ra ngay có gì đó không ổn trong Minor Gate — một pattern sai.
  Không attack, không hỏi người — quan sát hệ thống, tìm điểm can thiệp.
  "Nước không chảy đúng hướng. Có điều gì đó đang làm tắc nghẽn nguồn."

M1.3 — Skill manifestation:
  Trigger: Cố gắng thay đổi một điều nhỏ → skill amplify thay đổi đó beyond intent.
  Moment: Catalyst muốn làm một việc nhỏ, skill biến nó thành lớn hơn nhiều.
  Form: Environmental manipulation — affect không gian, không phải trực tiếp combat.

Hồi 2 — Coherence threat:
  Act 2 Early: Một thay đổi Catalyst tạo ra bắt đầu có hậu quả không lường được.
  Act 2 Mid: Ai đó đổ lỗi cho Catalyst về hậu quả đó. Catalyst phải quyết định: nhận trách nhiệm hay không?
  Act 2 Late: Mirror NPC là Catalyst đã thay đổi quá nhiều thứ và không còn nhận ra thế giới mình tạo ra.

NCE core question (Act 3, M3.4):
  Form: Form B (NPC phản chiếu) — người bị ảnh hưởng bởi thay đổi của Catalyst nói thẳng.
  Câu hỏi:
    "Anh thay đổi mọi thứ xung quanh.
    Nhưng nhìn lại con đường đã đi — anh cải thiện chúng, hay anh chỉ để lại một kiểu rối loạn khác?
    Ai cho phép anh quyết định thế giới của người khác cần thay đổi như thế nào?"

Emissary Sira tiếp cận:
  Sira cùng quan sát những thay đổi Catalyst tạo ra — không phán xét, chỉ track consequences.
  "Tôi thấy anh thay đổi nhiều thứ. Tôi theo dõi những gì đến sau."
  Philosophy hint: "Năng lực mà không được kiểm soát sẽ hủy hoại người sở hữu nó. Empire biết cái giá của change."

General Vorn's shadow line:
  "Anh tạo ra chaos và gọi nó là tiến hóa.
  Nhưng tiến hóa có hướng. Chaos không có.
  Nhìn những gì anh đã thay đổi. Bao nhiêu trong số đó tốt hơn thật sự?"
```

---

### SOVEREIGN — "Kẻ Ảnh Hưởng Con Người"

```
Identity Vector khởi đầu:
  order: 65     freedom: 45    evolution: 50
  control: 70   devotion: 75

Cơ chế đặc trưng:
  → Tiếp cận thế giới qua người — hiểu, thuyết phục, dẫn dắt
  → Mạnh nhất khi có followers tin tưởng và faction support
  → Yếu nhất khi một mình, hoặc khi followers phản bội vì leader không xứng

Natural drift triggers:
  - Dùng người như công cụ (không quan tâm đến chi phí với họ) → coherence giảm mạnh
  - Followers hy sinh vì quyết định của Sovereign → instability tăng
  - Tiếp tục dẫn dắt dù biết hướng đi sai → Echo dormant

DNA Affinity bias: Contract (oath, loyalty), Obfuscation (charisma-based concealment)

Act 1 entry point:
  Sovereign ngay lập tức scan xã hội ở Minor Gate — ai là leader, ai là outsider, ai có power.
  Không cần giải thích nhiều — họ biết họ muốn đứng ở đâu trong hệ thống này.
  "Người phụ nữ già ở góc chợ — bà ta biết nhiều hơn tất cả mọi người. Đó là người cần nói chuyện."

M1.3 — Skill manifestation:
  Trigger: Cần thuyết phục ai đó điều không thể thuyết phục bình thường.
  Moment: Lời nói — hoặc sự hiện diện — của Sovereign có weight vượt ngoài khả năng thông thường.
  Form: Authority amplifier — người xung quanh cảm nhận something không giải thích được về Sovereign.

Hồi 2 — Coherence threat:
  Act 2 Early: Dùng một NPC như công cụ để đạt mục đích — NPC bị tổn hại.
  Act 2 Mid: Followers làm điều Sovereign chỉ đạo mà không hỏi. Kết quả tốt. Nhưng: họ có là người độc lập không?
  Act 2 Late: Mirror NPC là Sovereign đã có quyền lực nhưng không còn ai thật sự ở bên — chỉ có phục tùng.

NCE core question (Act 3, M3.4):
  Form: Form B (NPC phản chiếu) — một follower nói điều chưa ai dám nói.
  Câu hỏi:
    "Tất cả đều theo anh. Nhưng họ theo anh — hay theo ý tưởng về anh mà anh đã xây dựng?
    Và anh: anh có biết mình thật sự là ai khi không có ai nhìn không?"

Emissary Sira tiếp cận:
  Sira không impressed bởi charisma — nhìn thẳng vào người bên dưới vỏ bọc lãnh đạo.
  "Tôi không quan tâm anh làm ai follow anh. Tôi quan tâm anh đối xử với họ thế nào sau đó."
  Philosophy hint: "Empire không cần charisma. Empire cần loyalty được xây trên something thật hơn."

General Azen's shadow line:
  "Followers của anh sẽ làm bất cứ điều gì anh nói.
  Anh đã nghĩ đến việc họ có nên không?"
```

---

### SEEKER — "Kẻ Khai Thác Bí Ẩn"

```
Identity Vector khởi đầu:
  order: 40     freedom: 65    evolution: 85
  control: 35   devotion: 45

Cơ chế đặc trưng:
  → Tiếp cận thế giới qua knowledge — quan sát, phân tích, tìm pattern ẩn
  → Mạnh nhất khi có đủ thông tin và không gian để kết nối dots
  → Yếu nhất khi hành động đòi hỏi quyết định trước khi hiểu đủ

Natural drift triggers:
  - Chạy theo knowledge past ethical limits → coherence giảm
  - Biết sự thật nhưng giữ lại vì lợi ích riêng → instability tăng
  - Sự thật tìm được mâu thuẫn với giá trị cốt lõi → mirror moment cưỡng bức

DNA Affinity bias: Perception (truth-sight, pattern recognition), Seeker-hybrid

Act 1 entry point:
  Seeker nhận ra ngay có inconsistency — điều gì đó ở Minor Gate không khớp với thông tin có được.
  Không làm gì cả. Quan sát. Thu thập. Sau đó mới hành động.
  "Cái vết này trên tường không phải từ Outer Corruption. Nó cũ hơn. Ai để lại nó?"

M1.3 — Skill manifestation:
  Trigger: Cố hiểu điều vượt khả năng nhận thức bình thường.
  Moment: Perception amplify — thấy lớp sâu hơn của thực tại, không chỉ surface.
  Form: Truth-sight — nhìn thấy pattern/history/intent mà người khác không thấy.

Hồi 2 — Coherence threat:
  Act 2 Early: Tìm được thông tin có thể giúp người khác — nhưng chia sẻ sẽ khiến mình mất lợi thế.
  Act 2 Mid: Knowledge dẫn đến nơi Seeker không muốn đến. Tiếp tục hay dừng lại?
  Act 2 Late: Mirror NPC là Seeker đã biết quá nhiều và không còn tin vào ai — kể cả bản thân.

NCE core question (Act 3, M3.4):
  Form: Form C (khoảnh khắc tịch lặng) — không có entity, chỉ có câu hỏi tự nảy sinh.
  Câu hỏi:
    "Anh đã tìm kiếm câu trả lời về mọi thứ.
    Câu trả lời về chính mình — anh có đang chủ động tránh tìm không?
    Có những thứ anh đã thấy nhưng từ chối nhìn thẳng vào."

Emissary Kaen tiếp cận:
  Kaen không nói nhiều — để Seeker tự tìm ra mình là ai.
  Thỉnh thoảng để lại hints không giải thích.
  "Tôi không nói anh đúng hay sai. Tôi chỉ nói anh chưa nhìn đủ sâu."
  Philosophy hint: "Empire có những câu trả lời mà anh đang tìm. Không phải tất cả. Nhưng đủ để thay đổi mọi thứ anh nghĩ mình biết."

General Mireth's shadow line:
  "Anh biết rất nhiều.
  Nhưng knowledge không có action chỉ là observation.
  Anh đang đứng xem thế giới sụp đổ và ghi chép lại."
```

---

### TACTICIAN — "Kẻ Thao Túng Cục Diện"

```
Identity Vector khởi đầu:
  order: 70     freedom: 50    evolution: 60
  control: 85   devotion: 30

Cơ chế đặc trưng:
  → Tiếp cận thế giới qua systems và patterns — mọi thứ đều có logic, có thể tối ưu
  → Mạnh nhất khi có thông tin và thời gian chuẩn bị
  → Yếu nhất khi phải đối mặt với chaos thuần túy hoặc với emotional reality của quyết định

Natural drift triggers:
  - Coi người như pieces trong strategy → coherence giảm khi họ bị tổn thương
  - Kế hoạch thành công nhưng require betraying someone → instability tăng
  - Ai đó tin tưởng Tactician hoàn toàn mà không biết họ đang bị dùng → mirror moment

DNA Affinity bias: Obfuscation (strategic concealment), Manipulation (outcome engineering)

Act 1 entry point:
  Tactician assess toàn bộ Minor Gate trong vài phút: threats, resources, leverage points, exit routes.
  Không ai biết họ đang làm gì. Đó là điểm.
  "Ba phe đang tranh nhau điểm này. Hai trong số họ không biết phe thứ ba tồn tại. Thú vị."

M1.3 — Skill manifestation:
  Trigger: Một kế hoạch sắp fail vì thiếu một biến số không thể kiểm soát.
  Moment: Skill emerge để fill gap — không phải power, mà là precision.
  Form: Strategic sight — hiểu được optimal play một cách instant trong chaotic situations.

Hồi 2 — Coherence threat:
  Act 2 Early: Kế hoạch thành công hoàn hảo — nhưng ai đó bị thương là result.
  Act 2 Mid: NPC tin Tactician không biết họ đang là piece trong strategy. Tactician phải quyết định có reveal không.
  Act 2 Late: Mirror NPC là Tactician đã thắng mọi trận — và bây giờ không còn ai muốn ngồi cùng bàn.

NCE core question (Act 3, M3.4):
  Form: Form A (ảo giác) — gặp một board game không thể win vì không phải strategic problem.
  Câu hỏi:
    "Anh thấy mọi người như moves trên bàn cờ.
    Khi nào anh ngừng thấy họ là người thật — người biết sợ hãi, người biết hy vọng?
    Và bây giờ — khi nhìn vào mình, anh thấy người hay thấy piece?"

Emissary Kaen tiếp cận:
  Kaen đóng vai đối thủ Tactician thật sự muốn — ai đó cũng chơi trò chơi này.
  "Tôi thấy strategy của anh. Nó tốt. Nhưng anh đang chơi với thiếu thông tin."
  Philosophy hint: "Empire có full information. Tactician không có Empire là Tactician đang blind."

General Kha's shadow line:
  "Tự do lựa chọn của anh — anh đã dùng nó để loại bỏ tự do lựa chọn của người khác.
  Có phải đó là strategy anh tự hào?"
```

---

### WANDERER — "Kẻ Sống Ngoài Hệ Thống"

```
Identity Vector khởi đầu:
  order: 25     freedom: 95    evolution: 65
  control: 20   devotion: 35

Cơ chế đặc trưng:
  → Tiếp cận thế giới bằng cách từ chối thuộc về bất kỳ phần nào của nó
  → Mạnh nhất khi không bị ràng buộc — có thể đi bất cứ đâu, làm bất cứ gì
  → Yếu nhất khi phải commit, khi ai đó cần họ thật sự ở đây

Natural drift triggers:
  - Một connection thật sự hình thành (không thể bước đi bình thường nữa) → coherence giảm
  - Từ chối connection đó gây ra hậu quả cho người kia → instability tăng
  - Được ai đó cần theo cách không thể bỏ qua → mirror moment cưỡng bức

DNA Affinity bias: Perception (awareness, survival instinct), unique hybrid bất định

Act 1 entry point:
  Wanderer đến Minor Gate không có mục đích rõ ràng. Quan sát mọi người như observation, không tham gia.
  Tìm thứ thú vị. Không tìm thứ quan trọng.
  "Không ai nhìn anh. Tốt. Anh thích như vậy."

M1.3 — Skill manifestation:
  Trigger: Một mình hoàn toàn. Không có nhân chứng. Không có kỳ vọng.
  Moment: Skill emerge khi không có áp lực perform — xuất hiện tự nhiên nhất.
  Form: Awareness amplifier — sense of environment, people's intent, dangers không ai thấy được.

Hồi 2 — Coherence threat:
  Act 2 Early: Kaen hoặc một NPC khác bắt đầu expect họ ở đây. Wanderer cảm thấy pull và push cùng lúc.
  Act 2 Mid: Một chuỗi sự kiện khiến Wanderer có trách nhiệm với ai đó dù không muốn.
  Act 2 Late: Mirror NPC là Wanderer đã tự cô lập hoàn toàn — và bây giờ không còn biết mình muốn gì.

NCE core question (Act 3, M3.4):
  Form: Form C (khoảnh khắc tịch lặng) hoặc Form A, tùy play style.
  Câu hỏi:
    "Anh luôn chọn tự do — chọn không thuộc về.
    Nhưng giờ hãy tự hỏi: đây còn là lựa chọn không?
    Hay sự cô độc đã trở thành ai anh là — không phải vì anh muốn, mà vì anh không biết cách nào khác?"

Emissary Thol tiếp cận:
  Thol không cố kéo Wanderer vào. Chỉ xuất hiện, parallel — không kết bạn chủ động.
  "Empire không yêu cầu anh thuộc về. Chỉ yêu cầu results. Đó là deal tốt nhất anh từng nghe."
  Philosophy hint: "Tự do của anh không cần bị hy sinh. Nó chỉ cần direction."

General Kha's shadow line:
  "Anh phá vỡ mọi cage đứng trước mặt. Ấn tượng.
  Nhưng tự do của anh tồn tại ở đâu — khi chính anh đang phá vỡ nó từ bên trong?"
```

---

## Lớp 2 — Play Style Engine

### 5 Behavioral Axes

AI track 5 axes sau, mỗi cái 0-100, update sau mỗi chapter dựa trên pattern of choices:

```python
class PlayStyleState(BaseModel):
    """5 behavioral axes — hidden from player, tracked per chapter."""

    # Axis 1: Tiếp cận conflict như thế nào?
    combat_preference: int = 50     # 0=avoid/negotiate, 100=always direct confrontation

    # Axis 2: Đi một mình hay cần người khác?
    alliance_tendency: int = 50     # 0=solo maximalist, 100=always seeks help/trust

    # Axis 3: Quyết định táo bạo hay thận trọng?
    risk_appetite: int = 50         # 0=always safe, 100=always high-risk

    # Axis 4: Nguyên tắc hay kết quả?
    moral_axis: int = 50            # 0=pure pragmatist, 100=principled even at cost

    # Axis 5: Khám phá hay tập trung vào mục tiêu chính?
    curiosity_depth: int = 50       # 0=straight path, 100=explores everything
```

### Play Style ảnh hưởng gì?

**Timing của milestones:**

| Play Style | Effect |
|---|---|
| `risk_appetite` > 70 | Instability tăng nhanh hơn → NCE trigger sớm hơn trong Act 3 |
| `risk_appetite` < 30 | Instability tăng chậm → NCE trigger muộn hơn, Fate Buffer kéo dài |
| `alliance_tendency` > 70 | Assigned Emissary sympathy tăng nhanh → reveal sớm hơn |
| `alliance_tendency` < 30 | Emissary sympathy tăng chậm → reveal muộn hoặc không reveal |
| `curiosity_depth` > 70 | Player sớm trigger Veiled Will anomaly hints |
| `moral_axis` < 20 | empire_resonance tăng nhanh hơn qua choices |
| `moral_axis` > 80 | identity_anchor tăng nhanh hơn — Phase 1 tends toward Anchor ending |

**Tone của narrative:**

| Play Style | Prose adjustment |
|---|---|
| High combat | Narrator mô tả thế giới qua conflict và power dynamics |
| High alliance | Narrator nhấn mạnh relationship, trust, betrayal consequences |
| High curiosity | Narrator thêm detail vào environment, secrets, inconsistencies |
| High pragmatic | Narrator mô tả consequences without moral judgment |
| High principled | Narrator reflect moral weight của decisions |

**NCE form ưu tiên:**

| Play Style | NCE form preferred |
|---|---|
| High solo | Form C (tịch lặng — không có entity) |
| High alliance | Form B (NPC phản chiếu — ai đó nói thẳng) |
| High combat | Form A (ảo giác — gặp phiên bản đã chỉ biết fight) |
| High curiosity | Form A hoặc C (vision hoặc discovery) |
| High risk | Form A (chaotic vision, overwhelming) |

### Play Style × Archetype Examples

Cùng archetype, play style khác → câu chuyện khác:

**Vanguard + high alliance_tendency:**
> "Chiến binh xây đội nhóm" — Drift xảy ra khi đội bị tổn thương. NCE hỏi: *"Anh chiến đấu cho đội hay đội là cái cớ để anh có lý do chiến đấu?"*

**Vanguard + low alliance_tendency (solo):**
> "Chiến binh một mình" — Drift xảy ra khi sức mạnh của một mình không đủ. NCE hỏi: *"Anh từ chối mọi người vì mạnh hơn hay vì sợ phụ thuộc?"*

**Wanderer + high risk_appetite:**
> "Người lang thang liều lĩnh" — Drift nhanh, connections xảy ra bất ngờ vì rủi ro. NCE trigger sớm.

**Wanderer + low risk_appetite:**
> "Người quan sát" — Gần như không có drift vì không để thứ gì chạm đến mình. NCE muộn, và câu hỏi là: *"Có phải anh đang an toàn — hay đang đứng ngoài cuộc sống?"*

---

## Lớp 3 — Milestone Content Adaptation

### Nguyên tắc

Milestone content adaptation không gắn với chapter cố định — mà gắn với **act + milestone**. Mỗi milestone có:
- **Fixed purpose**: mục đích không đổi (VD: M1.3 = first skill manifestation)
- **Variable form**: content AI generate hoàn toàn khác theo archetype × play style
- **Variable timing**: chapter cụ thể thay đổi theo Variable Act Duration

**M1.1 — Soul Forge + Entry (Act 1 start):**
```
Fixed: Soul Forge tạo Seed, nhân vật xuất hiện tại Minor Gate
Variable:
  - Entry scene: mỗi archetype có entry point riêng (xem Lớp 1)
  - First impression của thế giới: theo curiosity_depth
    High curiosity → nhiều detail, nhiều mystery hints
    Low curiosity → functional world description
  - First NPC interaction style: theo alliance_tendency
    High alliance → NPC friendly, world feels relatable
    Low alliance → NPC distant, world feels indifferent
```

**M1.3 — Skill Manifestation (Act 1 mid):**
```
Fixed: Unique Skill xuất hiện lần đầu
Variable:
  - Trigger context: mỗi archetype có trigger riêng (xem Lớp 1)
  - Skill power level: theo risk_appetite
    High risk → skill mạnh nhưng uncontrolled
    Low risk → skill nhỏ hơn nhưng precise
  - Player's reaction: theo moral_axis
    High principled → frightened by power
    High pragmatic → immediately thinking about how to use it
```

**Act 2 Early — First Drift (M2.1):**
```
Fixed: Một lựa chọn trái với Seed gây coherence drop
Variable:
  - Tình huống cụ thể: theo archetype natural drift trigger
    Vanguard → forced to not fight OR caused collateral damage
    Catalyst → unintended consequence of a change
    Sovereign → used someone as a tool
    Seeker → chose knowledge over ethics
    Tactician → plan succeeded but someone was hurt
    Wanderer → formed a connection and it scared them
  - Magnitude của drift: theo risk_appetite
    High risk → coherence giảm nhiều hơn (bold choices have bigger consequences)
    Low risk → coherence giảm ít hơn (cautious player drifts slower)
```

**Act 2 Late — Mirror NPC + Transmutation Foreshadow (M2.4):**
```
Fixed: Gặp ai đó như gương phản chiếu — phiên bản đã đi đường khác
Variable:
  - Ai là mirror NPC: theo archetype
    Vanguard → warrior who only knows how to fight, nothing left to protect
    Catalyst → someone who changed too much, doesn't recognize their own world
    Sovereign → leader with power but no one truly beside them
    Seeker → person who knows everything, trusts no one
    Tactician → strategist who won every game, lost every relationship
    Wanderer → wanderer who is now completely alone and doesn't know what they wanted
  - Interaction style: theo alliance_tendency
    High alliance → long conversation, emotional
    Low alliance → brief encounter, NPC doesn't know player is watching
  - Transmutation foreshadow (ARCHETYPE_EVOLUTION_SPEC §4.4 Scene 1):
    Nếu check_transmutation_ready() → NPC/environment bắt đầu phản ứng khác
    Gate energy dao động khi player đi qua
    "Có gì đó thay đổi trong cách thế giới nhìn bạn."
```

**Act 2 Late — Archetype Transmutation Event (nếu eligible):**
```
Fixed: Archetype Origin → Transmuted Form (3 scenes — ARCHETYPE_EVOLUTION_SPEC §4.4)
Trigger: Rank 2+, DQS ≥ 45, identity_coherence ≥ 65 (alignment) HOẶC drift ≥ 0.6 (divergence)
Variable:
  - Path type:
    Alignment (coherence ≥ 65): Transmutation strengthen archetype gốc
    Divergence (drift ≥ 0.6): Transmutation transform sang dạng mới
  - Form: engine chọn 1/3 branches dựa trên identity vector
    VD Vanguard: Bulwark (devotion+order) | Ravager (freedom+entropy) | Sentinel (control)
  - Narrative trial (Scene 2): theo archetype
    Vanguard → combat crisis: bảo vệ hay phá hủy?
    Catalyst → world event: kiến tạo hay hỗn loạn?
    Sovereign → political crisis: phán xử hay thống trị?
    Seeker → truth revealed: chấp nhận hay phá bỏ?
    Tactician → strategic dilemma: dẫn dắt hay thao túng?
    Wanderer → choice: định cư hay biến mất?
  - Naming Event (Scene 3): NPC gọi player bằng Transmuted title
  - Timing: xảy ra SONG SONG với Echo/Scar Bloom (independent events)
  - Không có Transmutation → skip, không ảnh hưởng Phase 1 flow
```

**M3.4 — Narrative Confrontation Event (Act 3):**
```
Fixed: Identity crisis, player must choose accept drift / anchor / third path
Variable:
  - Form: theo play style (xem Lớp 2 NCE form table)
  - Core question: theo archetype (xem Lớp 1 NCE section)
  - Assigned General's shadow line: theo archetype (xem Lớp 1)
  - Timing shift: theo risk_appetite (xem Lớp 2 timing table)
  - empire_resonance context:
    If empire_resonance > 40 → Assigned General's voice clearer, more personal
    If identity_anchor > 40 → Player has additional dialogue options
  - Post-Transmutation context:
    If đã Transmuted → NCE question incorporates new identity
    "Bạn đã thay đổi — nhưng thay đổi đó có thật không?"
```

**Act 4 — Floor 3 Guardian / Lieutenant (M4.2):**
```
Fixed: Combat climax, phải dùng post-mutation/post-anchor identity
Variable:
  - Challenge type: theo archetype
    Vanguard → pure power confrontation (Lieutenant matches combat style)
    Catalyst → environmental manipulation battle
    Sovereign → leadership/authority challenge (Lieutenant controls a group)
    Seeker → information/pattern warfare (Lieutenant has knowledge weapon)
    Tactician → strategic battle (Lieutenant has pre-planned counter)
    Wanderer → pursuit/containment (Lieutenant tries to trap Wanderer)
  - Difficulty scaling: theo risk_appetite + combat_preference
    High both → hardest version of fight
    Low both → more puzzle-like resolution available
```

---

## Skill Development Arc Per Archetype

### Nguyên tắc

Unique Skill được generate bởi **Soul Forge** (SOUL_FORGE_SPEC) từ Seed Identity + DNA Affinity. Nó evolve theo UNIQUE_SKILL_GROWTH_SPEC v1.2 — **behavior-driven**, không phải player chọn upgrade.

### Growth Stages trong Phase 1

> Phase 1 chỉ cover **Seed → Bloom** (Echo Deepening hoặc Scar Adaptation). Aspect Forge (Rank 4+) và Ultimate Form (Rank 5 + Season Climax) xảy ra **sau Phase 1** — xem UNIQUE_SKILL_GROWTH_SPEC §6-7.

```
Stage 1: SEED (Act 1)
  → Skill manifestation. Unrefined. Quirky. Domain passive active.
  → Sub-Skill 0 (SS0) = domain passive, luôn bật.

Stage 2: BLOOM (Act 2-3)
  → Echo Deepening: coherence ≥ 70 sustained 10 scenes → Bloom
  → HOẶC Scar Adaptation: 3× trauma events (near-death / defeat) → Bloom
  → Bloom unlocks SS1 (sub-skill 1), constraint nới lỏng.

Post-NCE identity shift → ảnh hưởng future growth direction:
  [Accept mutation]: identity vector reset → Echo bloom có thể revert, Scar giữ
  [Anchor identity]: identity_anchor += 20 → Bloom stable, future Aspect clear
  [Third path]: hybrid tension → Bloom unpredictable

Phase 2+ stages (ngoài scope Phase 1):
  Stage 3: ASPECT FORGE (Rank 4+) → Branch choice, 2 options
  Stage 4: ULTIMATE FORM (Rank 5 + Season Climax) → Synthesis
```

### Skill behavior trajectory per archetype

**Vanguard:**
```
Seed:  Raw power manifestation. Brute force. SS0 active (combat amplification passive).
Bloom: Precision develops. Echo = constraint nới lỏng. Scar = auto-shield khi near-death.
Transmutation: Nếu Bulwark → skill shift bảo vệ. Ravager → skill mạnh hơn nhưng rủi ro. Sentinel → skill kiểm soát.
Post-NCE [Accept]: Power gains intent — mutation-compatible, skill may transform.
Post-NCE [Anchor]: Signature move crystallizes. High mastery, predictable but strong.
Post-NCE [Third]:  Oscillates — sometimes raw, sometimes precise. Bloom unstable.
```

**Catalyst:**
```
Seed:  Small changes that amplify beyond intent. Messy side effects.
Bloom: Scoped changes. Echo = activation easier. Scar = consequence reduction.
Post-NCE [Accept]: Embraces consequence. Mutation possible toward larger-scale.
Post-NCE [Anchor]: Control parameter gains. Smaller changes, high precision.
Post-NCE [Third]:  Can change AND restore — dual nature.
```

**Sovereign:**
```
Seed:  Presence-based. People feel it without knowing why.
Bloom: Intentional use. Echo = range expands. Scar = protective aura.
Post-NCE [Accept]: Domination-adjacent mutation. Commands rather than influences.
Post-NCE [Anchor]: Genuine inspiration. Loyalty based on truth.
Post-NCE [Third]:  Nuanced — can choose which.
```

**Seeker:**
```
Seed:  Flashes of insight. Can't control when it activates.
Bloom: Pattern-based trigger. Echo = deeper reads. Scar = danger detection.
Post-NCE [Accept]: Turns inward. See's own patterns. Painful but powerful.
Post-NCE [Anchor]: Focuses outward. Better at world-truth.
Post-NCE [Third]:  Balanced sight — inward and outward.
```

**Tactician:**
```
Seed:  Tactical previews. Sees 1-2 moves ahead.
Bloom: Extended preview. Echo = constraint nới. Scar = anti-backlash.
Post-NCE [Accept]: Incorporates human variables. Unpredictability as feature.
Post-NCE [Anchor]: Multi-constraint optimization (win + protect people).
Post-NCE [Third]:  Meta-awareness — sees when strategy is the wrong tool.
```

**Wanderer:**
```
Seed:  Awareness spikes. Random. Hard to control.
Bloom: Directional awareness. Echo = focus. Scar = environmental warning.
Post-NCE [Accept]: Embraces rootlessness. Works best when moving.
Post-NCE [Anchor]: Finds home. Works best in specific context/person.
Post-NCE [Third]:  Works everywhere equally. No peak, no fade.
```

---

## Normal Skill Evolution Integration

> Cross-reference: SKILL_EVOLUTION_SPEC v1.1

Normal skills (catalog skills) cũng evolve trong Phase 1 qua 3 paths:

| Path | Trigger | Archetype relevance |
|---|---|---|
| **Refinement** | 8+ successful uses, identity alignment ≥ 0.6 | Play style ảnh hưởng usage pattern → refinement timing |
| **Mutation** | Instability ≥ 50, latent identity divergence | Archetype drift triggers → có thể gây skill mutation |
| **Integration** | 2 skills cùng principle domain | DNA Affinity bias → skills cùng principle more likely |

Context Weight Agent cần ensure narrative prose **foreshadow** evolution khi conditions gần đạt. Max: 2 refinements, 3 mutations per lifetime.

---

## Progression Integration

> Cross-reference: PROGRESSION_SYSTEM_SPEC v1.0

Phase 1 covers **Ranks 1-3** (Initiate → Awakened → Resonant). Tower Floors 1-3 correspond to rank progression.

| Rank | DQS Requirement | Phase 1 milestone |
|---|---|---|
| Rank 1 (Initiate) | DQS ≥ 30 | Act 1 — Soul Forge → Entry |
| Rank 2 (Awakened) | DQS ≥ 45 | Act 2 — Archetype Transmutation eligible |
| Rank 3 (Resonant) | DQS ≥ 55 | Act 3 — NCE eligible, Affinity detectable |

Rank 4 (Transcendent) và Rank 5 (Sovereign) xảy ra **sau Phase 1** — gắn với Aspect Forge, Ascendant Ascension, và Ultimate Form.

---

## Archetype Evolution Integration

> Cross-reference: ARCHETYPE_EVOLUTION_SPEC v1.0

Phase 1 covers **Tier 1 → Tier 2** (Origin → Transmuted). Tier 3 (Ascendant Ascension) và Tier 4 (Legendary) xảy ra **sau Phase 1**.

### Transmutation trong Phase 1

```
Timeline:
├── Act 1 start:  Origin Archetype set (from Soul Forge)
├── Act 1-2:     Origin Archetype bias active (20-30% narrative)
├── Act 2 late:   Transmutation eligibility check (Rank 2+, DQS ≥ 45)
│              Mirror NPC = foreshadow (Scene 1: "Sóng Ngầm")
├── Act 2 late:  Transmutation Event (3 scenes) — nếu eligible
│              Scene 2: "Lò Biến Đổi" — narrative trial
│              Scene 3: "Danh Xưng Mới" — Naming Event
├── Act 3+:      Transmuted Archetype effects active:
│              - NPC gọi player bằng Transmuted title
│              - Narrative bias shift theo transmuted form
│              - Principle resonance +0.05 cho aligned principles
│              - Empire escalation: Watcher → Enforcement
└── Phase 2+:    Sovereign Ascension (Tier 3, Rank 4+)
```

### Transmutation × Villain System

| Archetype Tier | Empire Reaction |
|---|---|
| Origin (Tier 1) | Watcher — passive observation |
| **Transmuted (Tier 2)** | **Enforcement** — active conflict begins |
| Sovereign (Tier 3) | General notice — Phase 2+ |

> **Thiết kế:** Khi player transmute, Empire nhận ra mối đe dọa thực sự. Enforcement tier bắt đầu → Lieutenant encounters intensify. Transmutation tự nhiên escalate villain pressure.

### Transmutation × Identity

| Path | Identity Effect | Skill Impact |
|---|---|---|
| Alignment (coherence ≥ 65) | Identity **crystallize** — khó drift hơn | Echo Deepening accelerated |
| Divergence (drift ≥ 0.6) | Identity **reset** theo hướng mới | Scar Adaptation more likely |

---

## Villain Assignment System

### Nguyên tắc cốt lõi

**Không có villain nào là "villain mặc định" cho tất cả player.** Empire đủ thông minh để gửi đúng người đến đúng target. Mỗi archetype được assign:

1. **1 Emissary** — người xây dựng connection qua Act 1-2
2. **1 Archetype Counterpart General** — shadow/voice tại NCE, brief appearance sau Lieutenant
3. **1 Lieutenant** — Floor 3 boss tại Act 4, thuộc về Assigned General

Cùng một game system, cùng một Phase 1 arc — nhưng ba người chơi Wanderer, Sovereign, và Seeker gặp ba bộ villain hoàn toàn khác nhau.

---

### Emissary Assignment

Ba Emissaries có approach khác nhau — assign theo archetype nào họ có thể build connection thật sự:

**Emissary Kaen** *(thương nhân/thám tử tìm artifact)*
> Philosophy: *"Hòa bình thật sự cần một kẻ đủ mạnh để áp đặt nó."*
> Strengths: Respect for competence, intellectual exchange, strategic partnership
> Assigned to: **Seeker, Tactician**

**Emissary Sira** *(healer/sage nghiên cứu Unique Skills)*
> Philosophy: *"Năng lực mà không được kiểm soát sẽ hủy hoại người sở hữu nó."*
> Strengths: Understanding of power and cost, genuine care for people
> Assigned to: **Catalyst, Sovereign**

**Emissary Thol** *(chiến binh trung lập quan sát player)*
> Philosophy: *"Một kẻ đủ mạnh không cần phải chọn phe — chỉ cần chọn survival."*
> Strengths: Respects independence, no pressure to belong, warrior's code
> Assigned to: **Vanguard, Wanderer**

**Assignment table:**

| Archetype | Assigned Emissary | Lý do connection hình thành tự nhiên |
|---|---|---|
| Vanguard | **Thol** | Warrior to warrior — Thol là người Vanguard có thể respect, không phải phục tùng |
| Catalyst | **Sira** | Cả hai muốn "cải thiện" thế giới — Sira hiểu cost of change |
| Sovereign | **Sira** | Cả hai deal với power over people — Sira challenge Sovereign về ethics of leadership |
| Seeker | **Kaen** | Kaen có artifact knowledge, để lại hints thay vì answers — Seeker bị kéo vào |
| Tactician | **Kaen** | Intellectual equals — Kaen là đối thủ Tactician thật sự muốn chơi cờ cùng |
| Wanderer | **Thol** | Thol là người đã từng wandering rồi chọn Empire — gương phản chiếu của Wanderer |

### Emissary approach per assignment

**Thol → Vanguard:**
> Không dùng words nhiều. Chiến đấu cạnh Vanguard trước khi nói bất cứ điều gì. Sau đó mới hỏi: "Anh chiến đấu vì cái gì?"
> Reveal context: Khi Vanguard thua trận không thể thắng một mình — Thol bước vào, không giải thích, chỉ giúp. Sau đó reveal.

**Thol → Wanderer:**
> Không cố giữ Wanderer ở đâu. Không kết bạn chủ động. Chỉ xuất hiện, parallel. Lâu dần Wanderer tự hỏi tại sao người này luôn ở đó.
> Reveal context: Khi Wanderer bị buộc phải ở lại (bị bắt, bị thương) — Thol là người duy nhất không cố giữ hoặc giải phóng, chỉ ngồi đó. Và reveal.

**Sira → Catalyst:**
> Cùng quan sát những thay đổi Catalyst tạo ra. Không phán xét — chỉ track consequences mà Catalyst chưa thấy. "Tôi thấy anh thay đổi nhiều thứ. Tôi theo dõi những gì đến sau."
> Reveal context: Khi một thay đổi của Catalyst gây hậu quả lớn — Sira reveal rằng họ đã thấy coming và đã chuẩn bị. "Empire biết cái giá của change. Đó là lý do chúng tôi tồn tại."

**Sira → Sovereign:**
> Không impressed bởi charisma. Nhìn thẳng vào người bên dưới vỏ bọc lãnh đạo. "Tôi không quan tâm anh làm ai follow anh. Tôi quan tâm anh đối xử với họ thế nào sau đó."
> Reveal context: Khi follower của Sovereign phản bội hoặc bị tổn thương — Sira là người duy nhất trung thực về lý do. Và reveal.

**Kaen → Seeker:**
> Không explain. Chỉ leave hints — artifact không giải thích được, câu hỏi không trả lời, location không có trên map. Seeker tự tìm đến Kaen.
> Reveal context: Khi Seeker tìm được mảnh thông tin chỉ Empire có thể explain — Kaen xuất hiện với giải thích, và reveal.

**Kaen → Tactician:**
> Đóng vai đối thủ Tactician thật sự muốn. Counter một kế hoạch hoàn hảo. "Tôi thấy strategy của anh. Nó tốt. Nhưng anh đang chơi với thiếu thông tin."
> Reveal context: Khi kế hoạch của Tactician bị counter hoàn hảo — Kaen reveal rằng họ là người counter. Rồi offer full information.

---

### General (Archetype Counterpart) Assignment

Mỗi General là phiên bản "đi lệch đường" của một archetype — shadow họ tại NCE, brief appearance sau trận Lieutenant. **4 Generals, 6 archetypes** — một số General cover 2 archetypes nhưng với philosophical challenge khác nhau.

**Mapping:**

| Archetype | Assigned General | Core value bị challenge | Shadow line tại NCE |
|---|---|---|---|
| **Vanguard** | **General Vorn** | *Mục đích của hành động* | "Anh đang xây hay đang phá? Tôi chỉ thấy đống đổ nát." |
| **Catalyst** | **General Vorn** | *Hướng của thay đổi* | "Anh tạo chaos và gọi nó là tiến hóa. Tiến hóa có hướng. Chaos không có." |
| **Sovereign** | **General Azen** | *Chi phí của quyền lực với người khác* | "Followers của anh sẽ làm bất cứ điều gì anh nói. Anh đã nghĩ đến việc họ có nên không?" |
| **Seeker** | **General Mireth** | *Ứng dụng của tri thức* | "Anh biết rất nhiều. Nhưng knowledge không có action chỉ là observation. Anh đang ghi chép trong khi thế giới sụp đổ." |
| **Tactician** | **General Kha** | *Nhân tính trong strategy* | "Tự do lựa chọn của anh — anh đã dùng nó để loại bỏ tự do lựa chọn của người khác. Có phải đó là strategy anh tự hào?" |
| **Wanderer** | **General Kha** | *Thực tế của tự do* | "Tự do của anh tồn tại ở đâu khi chính anh đang phá vỡ nó từ bên trong?" |

**Tại sao Vorn cover Vanguard VÀ Catalyst?**
Vorn's challenge là về *mục đích đằng sau hành động* — nhưng challenge này đến từ góc độ khác nhau:
- Với Vanguard: "Destruction với ai?" — về bạo lực không có mục tiêu
- Với Catalyst: "Change về đâu?" — về thay đổi không có định hướng

**Tại sao Kha cover Tactician VÀ Wanderer?**
Kha's challenge là về *sự thật của kiểm soát và tự do* — nhưng khác nhau:
- Với Tactician: Kha là extreme của pragmatism — chiếc gương Tactician không muốn nhìn vào
- Với Wanderer: Kha trực tiếp phủ nhận giá trị cốt lõi của Wanderer — freedom is illusion

---

### Lieutenant Assignment

Lieutenant là tay thực thi trực tiếp của General — là người "đã ngừng đặt câu hỏi". Contrast với player vừa phải đối mặt bản thân tại NCE.

**4 Lieutenants** (1 per General):

**Lieutenant của Vorn — "Người Thực Thi"**
> Identity: Từng là builder, chiến đấu cho Vorn vì tin vào "building through force". Không còn hỏi tại sao. Chỉ thực thi.
> Fighting style: Environmental control combat — locks battlefield, removes player's options
> Challenge type: Forces player to *create* rather than just react
> Contrast với player: Player đã phải tìm ra mình muốn xây gì — Lieutenant đã quên điều đó từ lâu

**Lieutenant của Azen — "Kẻ Hy Sinh"**
> Identity: Đã từ bỏ tất cả vì tin sacrifice là đạo đức tối thượng. Genuinely believes in what they do.
> Fighting style: Attrition warfare — willing to take damage to deal damage, war of attrition
> Challenge type: Tests player's willingness to pay costs
> Contrast với player: Player đã phải chọn giữa người quan trọng — Lieutenant đã chọn rồi và không nhìn lại

**Lieutenant của Mireth — "Vũ Khí Học Thuật"**
> Identity: Scholar who became weapon — knowledge purely for power, no longer curious, only effective.
> Fighting style: Precision and counter — reads player's patterns and exploits them
> Challenge type: Tests player's adaptability when their patterns are known
> Contrast với player: Player đã phải đối mặt với sự thật về bản thân — Lieutenant không còn tự hỏi bất cứ điều gì

**Lieutenant của Kha — "Người Thực Dụng"**
> Identity: Người tin rằng freedom is performance, order is the only truth. Cold and effective.
> Fighting style: Suppression — methodically removes player's options and freedoms in combat
> Challenge type: Tests player's ability to act without the freedom they assumed they had
> Contrast với player: Player vừa xác định được bản thân — Lieutenant đã từ bỏ bản thân từ lâu

**Assignment:**

| Archetype | Lieutenant |
|---|---|
| Vanguard | Lieutenant của Vorn |
| Catalyst | Lieutenant của Vorn |
| Sovereign | Lieutenant của Azen |
| Seeker | Lieutenant của Mireth |
| Tactician | Lieutenant của Kha |
| Wanderer | Lieutenant của Kha |

---

### Full Villain Cast Per Archetype — Summary

| Archetype | Emissary (Act 1-3) | General Shadow (NCE) | Lieutenant (Act 4) | General Brief (Act 4 end) |
|---|---|---|---|---|
| **Vanguard** | Thol | Vorn | Vorn's Lieutenant | Vorn |
| **Catalyst** | Sira | Vorn | Vorn's Lieutenant | Vorn |
| **Sovereign** | Sira | Azen | Azen's Lieutenant | Azen |
| **Seeker** | Kaen | Mireth | Mireth's Lieutenant | Mireth |
| **Tactician** | Kaen | Kha | Kha's Lieutenant | Kha |
| **Wanderer** | Thol | Kha | Kha's Lieutenant | Kha |

**Kết quả:** Vanguard và Wanderer đều gặp Thol — nhưng Thol đến với họ theo cách hoàn toàn khác. Catalyst và Sovereign đều gặp Sira — nhưng Sira thách thức họ về những gì hoàn toàn khác nhau. Seeker và Tactician đều gặp Kaen — nhưng Kaen build connection qua knowledge vs. strategy. Villain system đủ đa dạng để tạo trải nghiệm khác nhau, đủ gọn để build được.

---

## Integration với Context Weight Agent

Context Weight Agent cần receive:

```python
class AdaptiveContext(BaseModel):
    # ── Archetype & Play Style ──
    archetype: str                      # "vanguard" | "catalyst" | "sovereign" | ...
    seed_archetype: str                 # Original archetype from Soul Forge (for Echo of Origin)
    play_style: PlayStyleState          # 5 axes

    # ── Archetype Evolution (ARCHETYPE_EVOLUTION_SPEC) ──
    archetype_tier: int                 # 1=Origin, 2=Transmuted (Phase 1 scope)
    transmuted_form: str                # "bulwark" | "ravager" | ... | "" (not yet)
    transmutation_path: str             # "alignment" | "divergence" | ""
    archetype_title: str                # VN display name, e.g. "Thành Lũy"

    # ── Progression ──
    current_act: int                    # 1, 2, 3, or 4
    current_milestone: str              # "M1.1", "M2.3", etc.
    current_rank: int                   # 1-3 trong Phase 1 (PROGRESSION_SYSTEM_SPEC)

    # ── Identity State (IDENTITY INSTABILITY / TRANSFORMATION specs) ──
    identity_coherence: float           # 0-100, drives Echo Deepening & narrative tone
    identity_instability: float         # 0-100, NCE hard trigger ≥ 60
    identity_anchor: int                # anchoring score
    drift_history: list[str]            # what triggered drift so far
    nce_approaching: bool               # instability nearing threshold

    # ── Unique Skill Growth (UNIQUE_SKILL_GROWTH_SPEC) ──
    unique_skill_stage: str             # "seed" | "bloom" | "aspect" | "ultimate"
    bloom_path: str                     # "echo" | "scar" | "" (which bloom type)

    # ── Villain Assignment ──
    assigned_emissary: str              # "kaen" | "sira" | "thol"
    assigned_general: str               # "vorn" | "azen" | "mireth" | "kha"
    assigned_lieutenant: str            # "iron_oath" | "silent_law" | "data_garden" | "the_unbound"
    emissary_sympathy: int              # current sympathy score
    empire_threat_tier: str             # "watcher" | "enforcement" (based on archetype_tier)
    empire_resonance: int
```

Agent dùng context này để:
- Weight narrative elements phù hợp với archetype + play style
- Adjust tone theo 5 behavioral axes
- **Foreshadow skill growth** khi `unique_skill_stage` gần transition (Echo streak building, trauma accumulating)
- **Foreshadow archetype evolution** khi transmutation conditions gần đạt (Gate dao động, NPC phản ứng khác)
- Adjust prose intensity theo `identity_instability` level
- Use `archetype_title` (nếu đã Transmuted) thay vì Origin archetype trong NPC dialogue
- Adjust Empire threat level theo `empire_threat_tier` (Transmuted → Enforcement)
- Ensure assigned villain dialogue consistent xuyên suốt arc
- Signal upcoming milestones khi appropriate
- Know WHICH villain's philosophy echo in prose (dựa trên `assigned_general`)

---

## Variable Act Duration — Updated

Phase 1 không có fixed chapter count. Acts có duration range:

| Act | Min | Max | Driver |
|---|---|---|---|
| Act 1 | 4 | 7 | curiosity_depth, risk_appetite |
| Act 2 | 6 | 11 | risk_appetite (drift speed), alliance_tendency (emissary), curiosity_depth, **Transmutation Event** (adds 3 scenes if eligible) |
| Act 3 | 3 | 6 | instability buildup rate, emissary sympathy (reveal timing) |
| Act 4 | 3 | 5 | combat_preference, moral_axis (resolution depth) |
| **Total** | **16** | **29** | — |

**Hard cap:** 29 chapters total. Nếu đạt mà Phase 1 chưa complete — engine force-trigger remaining milestones.
**Hard floor:** 16 chapters. Dưới đó không đủ thời gian cho Emissary arc develop.

**Typical ranges:**
```
Fast burn (Vanguard, high risk):      16-19 chapters
Balanced (most archetypes, average):  20-23 chapters
Deep burn (Seeker/Wanderer, cautious): 23-27 chapters
Extreme explorer (Seeker, max curiosity): 27-29 chapters
```

---

## Summary: Tất Cả Những Gì Phase 1 Gốc Còn Thiếu

| Gap | Document này bổ sung |
|---|---|
| Mỗi archetype bắt đầu với identity vector nào | ✅ Lớp 1 — 6 Archetype Seed profiles |
| Cái gì cụ thể gây drift cho từng archetype | ✅ Natural drift triggers per archetype |
| NCE hỏi câu gì riêng cho từng archetype | ✅ NCE core question per archetype |
| Villain là ai — không phải luôn luôn Kaen và Vorn | ✅ Villain Assignment System (3 Emissaries × 4 Generals × 4 Lieutenants) |
| Emissary tiếp cận và reveal như thế nào | ✅ Emissary approach + reveal context per assignment |
| General shadow nói gì — không phải luôn Vorn | ✅ Per-archetype shadow lines |
| Lieutenant challenge type khác nhau thế nào | ✅ 4 Lieutenant designs |
| Play style ảnh hưởng timing và tone | ✅ Lớp 2 — 5 behavioral axes |
| Skill evolve theo path nào | ✅ Skill Development Arc per archetype |
| Milestone content khác nhau theo archetype | ✅ Lớp 3 — Milestone Content Adaptation |
| Chapter count có fixed không | ✅ Variable 16-29, condition-based Acts |

---

## PlayStyle Update Mechanics

> **Khi nào update?** Sau mỗi chapter, dựa trên pattern of choices trong chapter đó.

```python
def update_play_style(play_style: PlayStyleState, chapter_choices: list[Choice]):
    """Called after each chapter. Adjusts 5 axes based on observed behavior."""
    for choice in chapter_choices:
        delta = 3  # Base delta per choice (small, gradual shift)
        if choice.involves_combat:
            play_style.combat_preference += delta if choice.chose_combat else -delta
        if choice.involves_trust:
            play_style.alliance_tendency += delta if choice.chose_trust else -delta
        if choice.involves_risk:
            play_style.risk_appetite += delta if choice.chose_risky else -delta
        if choice.has_moral_weight:
            play_style.moral_axis += delta if choice.chose_principled else -delta
        if choice.involves_exploration:
            play_style.curiosity_depth += delta if choice.explored else -delta
    # Clamp all axes to 0-100
    play_style.clamp_all(0, 100)
```

**Decay:** Không có decay — axes chỉ shift khi có behavioral input mới. Đây là reflection, không phải fading memory.

**Initial values:** Seeded từ Soul Forge `BehavioralFingerprint`:
| Soul Forge Signal | → PlayStyle Axis |
|---|---|
| `decisiveness` + `impulsivity` | → `risk_appetite` initial |
| `patience` (inverse) | → `curiosity_depth` initial |
| `expressiveness` | → `alliance_tendency` initial |
| `deliberation` | → `combat_preference` inverse (deliberate = less combat-first) |
| `confidence` | → `moral_axis` initial (confident = more principled) |

---

> *Hai người chọn Wanderer. Một người chơi liều lĩnh, một người thận trọng.*
> *Họ sẽ gặp Emissary khác nhau ở những chapter khác nhau, dưới những vỏ bọc khác nhau.*
> *NCE sẽ hỏi họ cùng một câu — nhưng câu đó sẽ đau theo những cách khác nhau.*
> *Đó là Amoisekai.*

