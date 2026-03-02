# 💰 AMOISEKAI — Monetization Spec v1.0

> **Chiến lược:** Scale First → Monetize Gradually  
> **Nguyên tắc:** No P2W. Người chơi free PHẢI có trải nghiệm tốt.  
> **Chi phí server:** ~$0.002-0.005/chapter (Gemini Flash)

---

## 1. Triết lý kiếm tiền

> Scale trước, tiền sau. Genshin Impact free 100% content, kiếm tỷ đô từ cosmetic + convenience.  
> Amoisekai áp dụng tương tự: free story engine + kiếm tiền từ trải nghiệm premium.

### Nguyên tắc tuyệt đối:
- ❌ **KHÔNG bán:** Stat, Skill, Item power, RNG boost, DQS boost, Breakthrough skip
- ❌ **KHÔNG bán:** Pity timer reveal, hidden system reveal, identity mutation direction
- ✅ **CÓ bán:** Thời gian, thẩm mỹ, tiện ích, trải nghiệm bổ sung

---

## 2. Tầng Free vs Pro

### Free Tier — Phải đủ tốt để scale

| Feature | Free | Lý do |
|---------|------|-------|
| Chơi truyện | ✅ 5 chương/ngày | Đủ để hook, tạo habit loop |
| Identity System | ✅ Full | Core experience, không gate |
| World Events Feed | ✅ Full | Tạo FOMO, kéo quay lại |
| NeuralMemory (brain) | ✅ Full | AI nhớ hết, không bị cắt |
| Liveness rewards | ✅ Full | Quay lại = bonus chapter |
| Đọc lại story | ✅ Full | Retention |

### Pro Tier — Convenience + Premium Experience

| Feature | Pro | Giá đề xuất |
|---------|-----|-------------|
| Unlimited chapters/ngày | ✅ | Subscription |
| Priority generation | ✅ Nhanh hơn 2-3x | Subscription |
| Extended prose | ✅ 2000-3000 từ (vs 1000-1500) | Subscription |
| Story branching preview | ✅ Xem trước hậu quả mỗi choice (mờ) | Subscription |
| Multiple concurrent stories | ✅ 3 stories (vs 1) | Subscription |
| Advanced character sheet | ✅ Thống kê chi tiết identity | Subscription |
| Ad-free | ✅ | Subscription |

---

## 3. Dòng doanh thu — Theo thứ tự ưu tiên

### 3.1 🏆 Subscription (Doanh thu chính — Phase 1)

Đây là nguồn thu chính, ổn định, predictable.

| Plan | Giá VND | Giá USD | Bao gồm |
|------|---------|---------|---------|
| **Free** | 0 | 0 | 5 chương/ngày, 1 story, ads nhẹ |
| **Pro Monthly** | 79,000₫ | ~$3.19 | Unlimited chapters, priority, no ads |
| **Pro Yearly** | 599,000₫ | ~$24 | = 63₫/ngày, best value |

**Tại sao giá thấp:**
- Gemini cost = ~$0.005/chapter × 20 chapters/ngày = $0.10/ngày → hời lớn ở $3.19/tháng
- Thị trường VN: Webtoon pass = 49-99k, game sub = 50-150k → 79k là sweet spot
- Scale 10,000 Pro users × 79k = **790M₫/tháng** (~$32,000 USD)

**Khi nào bật:** Phase 1b — khi có 20+ chương playable + payment gateway ready.

---

### 3.2 💎 Crystal (In-app Currency — Phase 2)

Tạo currency trung gian để linh hoạt pricing.

| Package | Giá | Crystal |
|---------|-----|---------|
| Starter | 25,000₫ | 100 💎 |
| Popular | 99,000₫ | 500 💎 (bonus 20%) |
| Best Value | 249,000₫ | 1500 💎 (bonus 50%) |

**Crystal dùng cho:**

| Item | Crystal | Mô tả |
|------|---------|-------|
| Extra Chapter Pack (5) | 20 💎 | 5 chương bonus (không hết hạn) |
| **Item Art** (Imagen 4) | 15 💎 | AI vẽ weapon/relic/artifact vừa nhận |
| **Character Portrait** (Imagen 4) | 30 💎 | Full character art từ identity hiện tại |
| **Scene Illustration** (Imagen 4) | 25 💎 | Vẽ lại cảnh đáng nhớ trong chapter |
| **Battle Replay** (Veo 3 Fast) | 80 💎 | Video 5-8s tái hiện trận chiến |
| **Epic Moment Clip** (Veo 3) | 150 💎 | Video 5-8s chất lượng cao, chia sẻ được |
| Story Export (PDF/EPUB) | 50 💎 | Xuất truyện đẹp kèm illustrations |
| Name Change | 10 💎 | Đổi tên nhân vật |
| Story Slot | 50 💎 | Thêm 1 story slot vĩnh viễn |

**Khi nào bật:** Phase 2 — khi có auth + payment + đủ content.

---

### 3.3 🎨 Cosmetic Shop (Phase 2-3)

Không ảnh hưởng gameplay, chỉ visual/social.

| Category | Ví dụ | Crystal |
|----------|-------|---------|
| **Title Frame** | Khung tên hiển thị trên leaderboard | 30-80 💎 |
| **Chapter Theme** | Dark mode, parchment, neon cyberpunk | 20-50 💎 |
| **Narrative Style Pack** | Prose style: poetic, cinematic, manga | 50 💎 |
| **Character Aura** | Visual effect trên profile | 30-100 💎 |

---

### 3.4 📢 Interstitial Ads — Revenue Floor (Phase 1)

Chỉ cho Free users, không invasive.

| Vị trí | Tần suất | Loại |
|--------|---------|------|
| Giữa chapter load | Mỗi 3 chương | Rewarded (xem ad = +1 bonus chapter) |
| World Events Feed | Cuối feed | Native ad |
| Chapter complete screen | Sau chapter kết thúc | Banner nhẹ |

**Quan trọng:**
- **Rewarded ads** > forced ads → player tự chọn xem, tăng goodwill
- Estimated: $2-5 eCPM × 5 impressions/user/ngày → **$0.01-0.025/user/ngày**
- 10,000 DAU × $0.015 = **$150/ngày** = $4,500/tháng (revenue floor)

**Khi nào bật:** Phase 1 — dễ integrate nhất, tạo revenue floor ngay.

---

### 3.5 🏛️ Season Pass (Phase 3+)

Khi có đủ content cho seasonal model.

| Tier | Giá | Bao gồm |
|------|-----|---------|
| Free Pass | 0 | Basic rewards mỗi 5 chương |
| Premium Pass | 129,000₫ | Exclusive story arcs, cosmetics, crystal bonus |

**Season = 30 ngày.** Rewards unlock theo số chương đã chơi → tăng retention.

---

### 3.6 🖼️ AI Visual Generation — Killer Feature (Phase 2)

> Dùng Gemini Imagen (image) + Veo (video) để tạo visual content trả phí.
> Đây là tính năng **cao cấp nhất** — biến text thành hình ảnh/video.

#### Image Generation (Gemini Imagen 4)

| Sản phẩm | Chi phí Google | Giá bán (Crystal) | Giá bán (VND) | Margin |
|----------|---------------|-------------------|---------------|--------|
| **Item Art** (weapon/relic) | $0.02-0.04 | 15 💎 | ~3,750₫ | **98%** |
| **Scene Illustration** | $0.04 | 25 💎 | ~6,250₫ | **99%** |
| **Character Portrait** | $0.04 (x2 attempts) | 30 💎 | ~7,500₫ | **99%** |
| **Character Full Art** | $0.04 (x3 quality) | 50 💎 | ~12,500₫ | **99%** |

**Cách hoạt động:**
1. Player nhận item/skill/relic mới trong chapter
2. Hiện nút "🎨 Visualize" bên cạnh mô tả
3. Click → Gemini Imagen generate dựa trên: item description + player identity + world aesthetic
4. Trả về 2-3 variations → player chọn 1 lưu vào gallery
5. Có thể set làm avatar, share lên social

**Prompt strategy:**
```
Generate anime-style illustration of: {item_description}
Context: {world_aesthetic}, {player_archetype}
Style: dark fantasy isekai, dramatic lighting
```

#### Video Generation (Google Veo)

| Sản phẩm | Duration | Chi phí Google | Giá bán (Crystal) | Giá bán (VND) | Margin |
|----------|----------|---------------|-------------------|---------------|--------|
| **Battle Replay** (Veo 3 Fast) | 5s | ~$0.75 | 80 💎 | ~20,000₫ | **96%** |
| **Epic Moment Clip** (Veo 3) | 5s | ~$2.00 | 150 💎 | ~37,500₫ | **95%** |
| **Breakthrough Animation** (Veo 3) | 8s | ~$3.20 | 250 💎 | ~62,500₫ | **95%** |

**Cách hoạt động:**
1. Sau trận chiến epic / breakthrough / identity mutation
2. Hiện nút "🎬 Tái hiện khoảnh khắc"
3. System tạo prompt từ: battle description + character skills + setting
4. Veo generate video 5-8 giây
5. Player có thể download, share lên social (viral marketing tự nhiên!)

**Prompt strategy:**
```
Anime battle scene: {character_name} uses {skill_name} against {enemy}.
Setting: {location}. Style: dramatic, cinematic isekai.
Camera: dynamic angle, slow-motion impact.
```

#### Tại sao đây là Killer Feature?

1. **Emotional anchor** — Player vừa trải qua moment epic → muốn giữ lại → sẵn sàng trả tiền
2. **Social sharing** — Video/art chia sẻ = marketing miễn phí (viral loop)
3. **Collection instinct** — Gallery cá nhân → càng chơi càng muốn collect
4. **Margin cực cao** — Image cost $0.02-0.08, bán $0.15-0.50 → 95-99% margin
5. **Không P2W** — Chỉ visual, không ảnh hưởng gameplay

#### Pro Bonus: Free visuals/tháng

| Plan | Free Image/tháng | Free Video/tháng |
|------|-----------------|------------------|
| Free | 0 | 0 |
| Pro | 3 images | 1 video (Veo Fast) |

→ Tạo thêm lý do upgrade Pro. Taste → muốn thêm → mua Crystal.

---

## 4. Funnel kinh tế

```
                    100% users
                        │
            ┌───────────┼───────────┐
            ▼                       ▼
     FREE (85-90%)            PRO SUB (10-15%)
     5 ch/ngày + ads          Unlimited + priority
     Revenue: ads              Revenue: $3.19/tháng
            │
            ▼
     WHALE PATH (2-5%)
     Crystal purchases
     $5-25/tháng
     Cosmetics + extras
```

### Projected Revenue (@ 10,000 DAU)

| Source | Users | Rev/user/tháng | Monthly |
|--------|-------|---------------|---------|
| Pro Sub | 1,000 (10%) | $3.19 | **$3,190** |
| Crystal (general) | 300 (3%) | $5 avg | **$1,500** |
| 🖼️ AI Image | 500 (5%) | $2 avg | **$1,000** |
| 🎬 AI Video | 100 (1%) | $8 avg | **$800** |
| Ads | 9,000 free | $0.45 | **$4,050** |
| **Total** | | | **~$10,540/tháng** |

### Costs (@ 10,000 DAU)

| Item | Cost/tháng |
|------|-----------|
| Gemini Flash (chapters) | ~$1,200 |
| Imagen (500 users × 4 img) | ~$80 |
| Veo (100 users × 2 vid) | ~$300 |
| Supabase Pro | $25 |
| Hosting (Vercel/Railway) | $20-50 |
| **Total** | **~$1,650** |

> **Margin: ~84%** — AI visual generation thêm revenue nhưng chi phí cũng rất thấp.

---

## 5. Scale-First Roadmap

### Phase 1a — **Free + Ads** (Tuần 1-4)
- [x] Free 5 chapters/ngày
- [ ] Rewarded ads (xem ad = +1 chapter)
- [ ] Banner ads sau chapter
- **Goal:** MAU growth, không gate content

### Phase 1b — **Pro Subscription** (Tuần 4-6)
- [ ] Stripe/PayOS payment
- [ ] Pro tier unlock
- [ ] Upgrade prompts (soft, contextual — "Hết lượt hôm nay? Pro = unlimited")
- **Goal:** Convert 10% heavy users

### Phase 2a — **Crystal Economy** (Tuần 8-10)
- [ ] Crystal packages
- [ ] Story export
- [ ] Cosmetic shop v1
- **Goal:** Monetize whales, tăng ARPU

### Phase 2b — **AI Visual Generation** (Tuần 10-14)
- [ ] Imagen integration (item art, character portrait, scene illustration)
- [ ] Veo integration (battle replay, epic moment clip)
- [ ] Player gallery (collection UI)
- [ ] Social sharing (download + share link)
- [ ] Pro bonus (3 free images + 1 free video/tháng)
- **Goal:** Killer feature, viral marketing qua social sharing

### Phase 3 — **Season Pass + Advanced** (Tuần 16+)
- [ ] Season pass system
- [ ] Narrative style packs
- [ ] Faction cosmetics
- [ ] Referral rewards (invite = bonus crystal)
- [ ] Breakthrough animation (Veo premium)
- **Goal:** Recurring revenue + viral growth

---

## 6. Anti-Pattern — KHÔNG làm

| ❌ Đừng làm | Lý do |
|-------------|-------|
| Paywall gating chapters | Giết retention, player bỏ game |
| Sell identity mutation direction | Phá vỡ agency — core principle |
| Sell DQS/Breakthrough boost | = P2W, phá vỡ merit-based system |
| Energy system (wait or pay) | Frustrating, 2015 mobile game pattern |
| Loot boxes | Regulatory risk, bad PR |
| Mandatory ads blocking gameplay | Toxic, giảm retention |

---

## 7. Payment Gateway — Đề xuất

| Gateway | Phù hợp | Lý do |
|---------|---------|-------|
| **Stripe** | Global users | Standard, API tốt nhất |
| **PayOS** | Users VN | MoMo, VNPay, bank transfer |
| **RevenueCat** | Nếu có mobile app | In-app purchase management |

**Phase 1:** PayOS (VN market first) + Stripe (global).

---

## 8. KPIs cần track

| Metric | Target | Tool |
|--------|--------|------|
| DAU / MAU | Growth 20%+/tháng | Supabase analytics |
| Conversion Free→Pro | 8-15% | Custom tracking |
| ARPU (Average Revenue Per User) | $0.50-1.00 | Payment analytics |
| Chapter/user/day | 5-8 avg | App analytics |
| D1/D7/D30 retention | 40%/20%/10% | Supabase + custom |
| Cost per chapter | < $0.005 | Helicone (future) |
