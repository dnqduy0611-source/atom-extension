# 🌅 AMOISEKAI — Narrative Reborn Spec

> Player "tỉnh dậy" trong thế giới mới ở tuổi 16-18, không nhớ quá khứ.  
> Chỉ mang theo bản năng = Seed Identity từ onboarding quiz.

---

## 1. Concept: Narrative Reborn

- Mọi player bắt đầu cùng 1 cách: **tỉnh dậy trong thân xác mới**
- Tuổi cố định **16-18** (bất kể tuổi thật người chơi)
- Không nhớ đời trước — chỉ có cảm giác mơ hồ (= Seed Identity traits)
- Lore: linh hồn được "The Veiled Will" kéo vào universe, tái sinh trong thân thể mới

### Tại sao không dùng cách khác?

| Option | Vấn đề |
|--------|--------|
| Trẻ sơ sinh → lớn dần | Chapter 1-15 nhàm chán, mất retention |
| Giữ tuổi thật | Người chơi 12 tuổi vs 30 tuổi = balance nightmare |
| **Tỉnh dậy 16-18** ✅ | Action từ chapter 1, fair, lore-consistent |

---

## 2. Onboarding Flow

```
[1] Player mở game lần đầu
         ↓
[2] Onboarding Quiz (3-5 câu)
    → Tạo Seed Identity + DNA Affinity + Archetype hint
         ↓
[3] Cutscene text: "Khoảng trống. Rồi ánh sáng."
         ↓
[4] Chapter 1: AWAKENING
    → Tỉnh dậy ở unknown location
    → Choice đầu tiên (reveal archetype tendency)
         ↓
[5] Chapter 2-3: FIRST STEPS
    → Khám phá cơ thể, cảm nhận sức mạnh tiềm ẩn
    → Gặp NPC mentor hoặc kẻ thù đầu tiên
         ↓
[6] Chapter 4-5: FIRST ARC
    → Arc nhỏ đầu tiên, stakes vừa đủ
    → Kết thúc = player bị hook → RETENTION
```

---

## 3. Onboarding Quiz Design

### Nguyên tắc:
- **3-5 câu**, tối đa 2 phút
- Không hỏi tuổi/giới tính thật (privacy)
- Câu hỏi tình huống → reveal personality → map sang Seed Identity
- Player KHÔNG biết kết quả map ra gì (bí ẩn)

### Câu hỏi mẫu:

**Q1: Bạn đang trong rừng tối. Có tiếng bước chân đến gần.**
- Nấp lại, quan sát → `Perception +2, Obfuscation +1`
- Đứng ra, sẵn sàng → `Manifestation +2, Combat +1`
- Chạy về hướng có ánh sáng → `Survival +1, Instinct +1`
- Gọi to: "Ai đó?" → `Charm +1, Contract +1`

**Q2: Bạn tìm thấy một vật phẩm lạ phát sáng. Bạn...**
- Nghiên cứu nó cẩn thận → `Mind +2` → Seeker
- Kích hoạt ngay → `Chaos +2` → Catalyst  
- Giấu đi, dùng sau → `Strategic +2` → Tactician
- Tìm ai đó để hỏi → `Social +2` → Sovereign

**Q3: Ai đó cầu xin bạn giúp, nhưng bạn cảm thấy đây là bẫy.**
- Giúp dù sao, chấp nhận rủi ro → `Oath +2, Echo +1`
- Từ chối, tự bảo vệ mình → `Shadow +1, Survival +1`
- Giúp nhưng chuẩn bị sẵn kế hoạch B → `Manipulation +2`
- Đặt điều kiện trước khi giúp → `Contract +2`

**Q4: Bạn được cho chọn 1 trong 3 vật:**
- Thanh kiếm cũ nhưng vừa tay → `Bloodline +2` → Combat axis
- Cuốn sách viết bằng ngôn ngữ lạ → `Relic +2` → Strategic axis
- Chiếc nhẫn có dấu hiệu phe phái → `Tech +1, Charm +1` → Influence axis

### Kết quả quiz → Seed Identity:

```json
{
  "seed_identity": {
    "primary_trait": "Oath",
    "secondary_trait": "Mind",
    "shadow_trait": "Chaos",
    "dna_affinity": ["Oath", "Mind", "Relic"],
    "archetype_hint": "Seeker"
  }
}
```

> Player chỉ thấy: *"Linh hồn bạn mang theo một thứ gì đó... nhưng bạn chưa nhớ ra."*  
> Không bao giờ show raw data.

---

## 4. Chapter 1: Awakening — Script Template

### Opening (AI generated, guided by template):

```
[SETTING]
- Unknown location (AI chọn từ pool: rừng, hoang mạc, phế tích, bờ biển)
- Thời gian: bình minh hoặc hoàng hôn (symbolic: bắt đầu mới)
- Hai mặt trăng / bầu trời khác thường (signal: đây không phải Earth)

[AWAKENING]
- Player mở mắt, cơ thể lạ, không nhớ gì
- Cảm giác mơ hồ từ Seed Identity:
  - Oath → "có thứ gì đó bạn phải giữ lời"
  - Shadow → "bản năng nói bạn nên ẩn mình"
  - Mind → "bạn cần hiểu trước khi hành động"

[FIRST ENCOUNTER]
- Trigger ngay trong chapter 1: nguy hiểm nhẹ
- Forced choice → reveal archetype tendency
- Không quá khó (Fate Buffer đang ở 100%)
```

### Choice format:

```
Ba lựa chọn đầu tiên (archetype-hinted):

1. 🗡️ [Hành động trực tiếp]     → Vanguard / Combat axis
2. 🧠 [Phân tích / quan sát]     → Tactician / Seeker  
3. 👥 [Tìm đồng minh / giao tiếp] → Sovereign / Catalyst
4. ✍️ [Player viết hành động riêng] → AI phân loại
```

---

## 5. Chapter 2-5: First Steps

| Chapter | Mục đích | Reveal gì |
|---------|---------|-----------|
| Ch.1 | Awakening + first choice | Archetype hint |
| Ch.2 | Khám phá cơ thể/sức mạnh | DNA Affinity (skill flash nhẹ) |
| Ch.3 | Gặp NPC quan trọng đầu tiên | Social dynamics, trust/distrust |
| Ch.4 | First real conflict | DQS bắt đầu track |
| Ch.5 | Arc conclusion + cliffhanger | Player bị hook → quay lại ngày mai |

### Quy tắc early chapters:
- **Fate Buffer = 100%** → không thể chết thật
- Failure → AI chuyển thành arc thay vì game over
- Mỗi chapter kết thúc bằng mini mystery/cliffhanger
- NPC mentor xuất hiện tự nhiên (không forced tutorial)

---

## 6. Memory State Ẩn

Sau 5 chapter đầu, hệ thống đã biết:

```json
{
  "seed_identity": { "...from quiz" },
  "current_identity": {
    "dominant_archetype": "Seeker",
    "combat_tendency": 0.3,
    "social_tendency": 0.5,
    "strategic_tendency": 0.8,
    "trust_level": "cautious"
  },
  "dqs": 65,
  "chapter_count": 5,
  "fate_buffer": 95,
  "key_decisions": [
    "chose_to_observe_before_acting",
    "helped_stranger_with_conditions",
    "kept_artifact_secret"
  ],
  "relationships": {
    "npc_mentor_01": { "trust": 40, "type": "cautious_ally" }
  }
}
```

> Tất cả ẩn. Player chỉ cảm nhận qua prose — "Có thứ gì đó bên trong bạn đang thức dậy..."

---

## 7. Flashback System (Late-game hook)

- **Chapter 15-20+**: AI bắt đầu hint flashback mơ hồ
- Player nhận được "ký ức" ngẫu nhiên — hình ảnh, cảm giác, fragment
- Tạo arc "Tìm hiểu mình là ai" → engagement dài hạn
- Flashback content = AI tự generate dựa trên Seed Identity + player behavior
- Không bao giờ reveal 100% → mystery luôn tồn tại

---

## 8. Lore Integration

### Tại sao linh hồn bị kéo vào?

- The Veiled Will (Cosmic Threat) đang thu thập linh hồn từ các thế giới
- Mỗi player = một linh hồn bị kéo vào vì có "tiềm năng" nhất định
- Liên kết với Cosmic Architecture (Phase 4):
  - Nhiều player = nhiều linh hồn = thế giới mạnh hơn (hoặc bất ổn hơn)
  - Player có thể phát hiện mình không phải "người duy nhất" được kéo vào

### Narrative rules:
- Không ai tin player "đến từ thế giới khác" (trope isekai)
- Player phải tự khám phá, AI không nói thẳng
- Seed Identity = "di sản của linh hồn" — lore-consistent với quiz
