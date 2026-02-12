# Monetization Plan: AmoNexus — Hybrid Distribution Strategy

**Version:** 3.0
**Date:** 2026-02-12
**Status:** Active
**Replaces:** v2.0 (Soft Launch only)

---

## 1. Bối cảnh & Vấn đề

Chrome Web Store review mất 1-7 ngày mỗi lần update. Trong thời kỳ vibe coding, tốc độ iteration là lợi thế cạnh tranh — extension cần update từng giờ để cải thiện trải nghiệm.

**Giải pháp:** Dùng **GitHub** làm kênh phân phối chính cho tốc độ, nhưng giữ **Chrome Web Store** cho mainstream user và monetization.

---

## 2. Mô hình: Hybrid Distribution (Open Core)

```
┌──────────────────────────────────────────────────────┐
│               GITHUB (Nightly / Beta)                │
│                                                      │
│  • Bản mới nhất, cập nhật liên tục                   │
│  • Dành cho early adopter, power user, developer     │
│  • Code mở, miễn phí hoàn toàn                       │
│  • User tự nhập API key (BYOK) → bạn không tốn gì   │
│  • KHÔNG có managed AI key từ bạn                    │
│  • Không auto-update (tự tải zip mới)                │
└──────────────────────┬───────────────────────────────┘
                       │
         Gom bản ổn định mỗi 1-2 tuần
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│            CHROME WEB STORE (Stable)                 │
│                                                      │
│  • Bản ổn định, đã test kỹ qua beta                 │
│  • Dành cho mainstream user                          │
│  • Auto-update, cài 1 click                          │
│  • FREE: 10 AI calls/ngày (managed key)              │
│  • PRO: unlimited AI + cloud sync ($4.99/tháng)      │
└──────────────────────────────────────────────────────┘
```

### Tại sao mô hình này hoạt động

| Kênh | Vai trò | Chi phí cho bạn | Thu nhập |
|---|---|---|---|
| **GitHub** | Marketing, community, beta test | **$0** (user dùng BYOK) | $0 (chấp nhận) |
| **CWS Free** | Mở rộng user base | Thấp (~$30-50/1000 user) | $0 |
| **CWS Pro** | Nguồn thu chính | User trả tiền cover | **$4.99/tháng/user** |

**Kiếm tiền từ CONVENIENCE, không phải từ CODE:**
- Code miễn phí → tốt cho trust, marketing, community
- Muốn **tiện** (managed key + auto-update + cloud sync) → trả tiền
- Giống mô hình: Bitwarden, Ghostery, GitLens

---

## 3. Phân loại User & Tier

### 3.1 GitHub User (Power User / Developer)

| Đặc điểm | Chi tiết |
|---|---|
| Cài đặt | Thủ công (load unpacked hoặc CRX) |
| Auto-update | ❌ — Extension tự check GitHub releases, nhắc user tải bản mới |
| AI calls | **BYOK only** (user tự dùng API key của mình) |
| Tất cả features | ✅ Mở hết (code mở, không gate) |
| Cloud Sync | ❌ (chỉ local) |
| Chi phí cho bạn | **$0** |

### 3.2 CWS Free User (Mainstream)

| Đặc điểm | Chi tiết |
|---|---|
| Cài đặt | 1-click từ Chrome Web Store |
| Auto-update | ✅ |
| AI calls | **10/ngày** (managed key, bạn trả tiền) |
| Core features | ✅ Highlight, ghi chú, SRQ cơ bản |
| Pro features | 🔒 Locked |
| Cloud Sync | ❌ |
| BYOK option | ✅ Nếu user tự nhập key → unlimited, bypass daily limit |

### 3.3 CWS Pro User ($4.99/tháng)

| Đặc điểm | Chi tiết |
|---|---|
| Cài đặt | 1-click từ Chrome Web Store |
| Auto-update | ✅ |
| AI calls | **Unlimited** (managed key, fair use) |
| Tất cả features | ✅ |
| Cloud Sync | ✅ (Supabase) |
| Ưu tiên support | ✅ |

### 3.4 Tính năng phân theo Tier

| Tính năng | GitHub (BYOK) | CWS Free | CWS Pro |
|---|---|---|---|
| Highlight & ghi chú | ✅ | ✅ | ✅ |
| SRQ cơ bản (lưu, xem) | ✅ | ✅ | ✅ |
| AI Chat / Explain / Summarize | ✅ (BYOK) | 10/ngày | ✅ Unlimited |
| SRQ nâng cao (liên quan, analytics) | ✅ | 🔒 | ✅ |
| NotebookLM Bridge | ✅ | ✅ | ✅ |
| Focus Timer | ✅ | ✅ | ✅ |
| Journal / Quick Diary | ✅ | ✅ | ✅ |
| Cloud Sync | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |

---

## 4. Kiến trúc Monetization

### 4.1 Server-side Gate (Quan trọng nhất)

```
Extension (GitHub hoặc CWS)
        ↓
Proxy Server (Supabase Edge Function hoặc Cloudflare Worker)
        ↓
Kiểm tra: BYOK hay Managed key?
        ↓
   BYOK → Gọi thẳng Gemini API bằng key user
   Managed → Kiểm tra subscription + daily limit → Gọi Gemini bằng key bạn
```

> [!IMPORTANT]
> **Không embedded API key trực tiếp trong extension.** Mọi managed AI call đều phải đi qua proxy server. Đây là cách duy nhất bảo vệ API key khi code mở trên GitHub.

### 4.2 Quota & Billing Service

**File:** `services/quota_service.js`

- `checkQuota()`: BYOK → always true. Managed → check daily limit + subscription
- `incrementQuota()`: Tăng counter sau mỗi AI call
- `getQuotaStatus()`: Trả về `{ used, limit, isProUser, isByok }`

### 4.3 Subscription Check Flow

```
1. User mở extension
2. Nếu đã login Supabase → fetch profile.subscription_status
3. Nếu "active" hoặc "trialing" → Pro tier
4. Nếu "free" hoặc chưa login → Free tier
5. Nếu BYOK key có → bypass managed key limit (nhưng Pro features vẫn locked nếu chưa trả tiền)
```

---

## 5. GitHub Auto-Update Notification

Vì GitHub không có auto-update, extension sẽ tự check:

```javascript
// Chạy mỗi 6 giờ qua chrome.alarms
async function checkGitHubUpdate() {
  const res = await fetch('https://api.github.com/repos/OWNER/REPO/releases/latest');
  const latest = await res.json();
  const currentVersion = chrome.runtime.getManifest().version;

  if (latest.tag_name !== `v${currentVersion}`) {
    // Hiện notification nhẹ
    showUpdateBanner({
      message: `Phiên bản mới ${latest.tag_name} đã có!`,
      url: latest.html_url
    });
  }
}
```

> [!NOTE]
> Chỉ áp dụng cho bản GitHub (sideloaded). Phát hiện qua `chrome.management.getSelf()` — nếu `installType === 'development'` thì là bản GitHub.

---

## 6. Chi phí vận hành

### 6.1 Gemini API (Managed key cho CWS user)

| Metric | Giá trị |
|---|---|
| Model | `gemini-2.5-flash-lite` |
| Input cost | $0.075 / 1M tokens |
| Output cost | $0.30 / 1M tokens |
| Free user limit | 10 calls/ngày |
| Pro user limit | Fair use (~100 calls/ngày) |

### 6.2 Ước tính chi phí theo user base

| User base | Free users (70%) | Pro users (5%) | Monthly AI cost | Monthly revenue |
|---|---|---|---|---|
| 100 | 70 | 5 | ~$5 | $25 |
| 1,000 | 700 | 50 | ~$40 | $250 |
| 10,000 | 7,000 | 500 | ~$300 | $2,500 |

> GitHub user dùng BYOK → chi phí $0 cho bạn, không tính vào bảng.

### 6.3 Proxy Server

| Option | Chi phí | Ghi chú |
|---|---|---|
| Supabase Edge Functions | Free (500K invocations/tháng) | Đủ cho 10K users |
| Cloudflare Workers | Free (100K requests/ngày) | Backup option |

---

## 7. Soft Launch Timeline

### Giai đoạn 1: Foundation (Tuần 1-2)

- [ ] Setup Proxy Server (Supabase Edge Function) để ẩn API key
- [ ] Implement `quota_service.js` (BYOK detection + daily limit)
- [ ] Implement GitHub update checker cho sideloaded builds
- [ ] Thêm banner "Early Access" trên sidepanel/options
- [ ] Release bản đầu tiên trên GitHub

### Giai đoạn 2: Trial (Tuần 3-4)

- [ ] CWS Free user nhận 30 ngày trial Pro (30 AI calls/ngày)
- [ ] Track usage data: install_date, ai_calls_today, feature_usage
- [ ] UI: "🥂 Early Access Pro: X Days Left"
- [ ] Submit stable build lên Chrome Web Store

### Giai đoạn 3: Paywall (Tháng 2+)

- [ ] Tích hợp Lemon Squeezy cho payment
- [ ] Free tier giảm xuống 10 calls/ngày
- [ ] Pro tier $4.99/tháng: unlimited + cloud sync
- [ ] UI: "Trial Expired → Upgrade to Pro"

### Giai đoạn 4: Growth (Tháng 3+)

- [ ] Phân tích conversion rate (Free → Pro)
- [ ] A/B test pricing ($3.99 vs $4.99 vs $6.99)
- [ ] Thêm annual plan (discount 20%)
- [ ] Referral program (mời bạn bè → thêm ngày Pro)

---

## 8. Rủi ro & Giảm thiểu

| Rủi ro | Xác suất | Giảm thiểu |
|---|---|---|
| User fork code, bỏ paywall | Thấp | Server-side gate. Client check chỉ là UX, không phải security |
| User dùng GitHub BYOK mãi | Trung bình | OK — chi phí $0, họ vẫn là community contributor |
| API key bị scrape từ extension | Cao nếu embed | **Dùng proxy server, KHÔNG embed key** |
| CWS reject bản update | Trung bình | GitHub luôn là fallback channel |
| User uninstall/reinstall reset trial | Thấp | Chấp nhận cho soft launch. Sau dùng Supabase Auth để track |
| Conversion rate quá thấp | Trung bình | Đảm bảo Pro features có giá trị rõ ràng (AI unlimited + sync) |

---

## 9. Open Questions

- [ ] Có nên bắt buộc login từ đầu? **Đề xuất:** Không. Cho anonymous trial, bắt login khi muốn sync hoặc mua Pro.
- [ ] License cho code trên GitHub? **Đề xuất:** MIT with Commons Clause (không được bán lại).
- [ ] Khi nào bắt đầu bán Pro? **Đề xuất:** Sau khi có ít nhất 100 active user và feedback tích cực.

---

## 10. Quyết định cần chốt

| # | Quyết định | Options | Đề xuất |
|---|---|---|---|
| 1 | Proxy server | Supabase Edge Function vs Cloudflare Worker | Supabase (đã có ecosystem) |
| 2 | Payment provider | Lemon Squeezy vs Stripe vs Paddle | Lemon Squeezy (dễ setup, MoR) |
| 3 | GitHub license | MIT vs MIT+Commons Clause vs AGPL | MIT+Commons Clause |
| 4 | Giá Pro | $3.99 / $4.99 / $6.99 | $4.99 (A/B test sau) |
| 5 | Trial duration | 14 / 30 / 60 ngày | 30 ngày |
