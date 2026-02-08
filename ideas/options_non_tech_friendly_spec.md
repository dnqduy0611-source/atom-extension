# Options UX Spec (Non-Tech Friendly)

## 1) Mục tiêu
Thiết kế lại màn **Options** để người dùng không kỹ thuật vẫn cấu hình được AI Pilot dễ dàng, giảm rối, giảm chỉnh sai, vẫn giữ quyền tinh chỉnh cho power user.

## 2) Phạm vi
Áp dụng cho nhóm cấu hình AI Pilot hiện có:
- Min Confidence
- Timeout (ms)
- Budget/day
- Cache TTL (ms)
- Viewport max chars
- Selected max chars
- Provider
- Proxy URL
- Accuracy Level
- Primary Mode

## 3) Nguyên tắc UX
1. **Basic-first**: mặc định chỉ hiển thị mục user hiểu ngay.
2. **Preset-first**: user chọn mục tiêu trước, không phải chỉnh số trước.
3. **Guardrail-first**: chặn giá trị nguy hiểm + cảnh báo rõ.
4. **Progressive disclosure**: Advanced chỉ mở khi người dùng chủ động.

---

## 4) IA đề xuất

### 4.1 Basic (mặc định)
Hiển thị 5 mục:
1. **Mục tiêu sử dụng** (Preset)
2. **Độ kỹ của câu trả lời** (Accuracy Level dạng mức)
3. **Mức chắc chắn trước khi trả lời** (Min Confidence dạng slider)
4. **Thời gian chờ tối đa** (Timeout)
5. **Hạn mức mỗi ngày** (Budget/day)

### 4.2 Advanced (accordion)
Hiển thị khi bấm “Nâng cao”:
- Thời gian nhớ kết quả cũ (Cache TTL)
- Lượng nội dung quét trên màn hình (Viewport max chars)
- Lượng nội dung bạn bôi đen (Selected max chars)
- Động cơ AI (Provider)
- Đường mạng trung gian (Proxy URL)
- Ưu tiên xử lý (Primary Mode) [chỉ power user]

### 4.3 Ẩn khỏi user thường
- Proxy URL
- Provider chi tiết (model/fallback chain)
- Primary Mode enum nội bộ
- Accuracy dạng số kỹ thuật

(Hiển thị các mục này chỉ khi bật `Advanced Mode` + tooltip cảnh báo)

---

## 5) Đổi tên nhãn non-tech
| Kỹ thuật | Nhãn thân thiện |
|---|---|
| Min Confidence | Mức chắc chắn trước khi trả lời |
| Timeout (ms) | Thời gian chờ tối đa |
| Budget/day | Hạn mức mỗi ngày |
| Cache TTL (ms) | Thời gian nhớ kết quả cũ |
| Viewport max chars | Lượng nội dung quét trên màn hình |
| Selected max chars | Lượng nội dung bạn bôi đen |
| Provider | Động cơ AI |
| Proxy URL | Đường mạng trung gian |
| Accuracy Level | Độ kỹ của câu trả lời |
| Primary Mode | Ưu tiên xử lý |

---

## 6) Preset mặc định

### 6.1 Nhanh mượt
- Min Confidence: 0.65
- Timeout: 15s
- Budget/day: 3
- Cache TTL: 24h
- Accuracy: 2/5
- Mode: Fast

### 6.2 Cân bằng (mặc định khuyến nghị)
- Min Confidence: 0.75
- Timeout: 30s
- Budget/day: 5
- Cache TTL: 12h
- Accuracy: 3/5
- Mode: Balanced

### 6.3 Chính xác cao
- Min Confidence: 0.90
- Timeout: 60s
- Budget/day: 12
- Cache TTL: 2h
- Accuracy: 5/5
- Mode: Deep

### 6.4 Tiết kiệm quota
- Min Confidence: 0.78
- Timeout: 20s
- Budget/day: 1
- Cache TTL: 48h
- Accuracy: 3/5
- Mode: Economy

---

## 7) Guardrails & Validation

| Field | Range an toàn | Cảnh báo |
|---|---|---|
| Min Confidence | 0.55–0.95 | <0.60: dễ sai; >0.92: dễ bỏ sót |
| Timeout | 10–90s | <15s: dễ timeout; >60s: cảm giác chậm |
| Budget/day | 0.5–50 | <1: nhanh hết hạn mức; >20: tốn chi phí |
| Cache TTL | 0–72h | 0h: tốn quota; >24h: kết quả cũ |
| Viewport chars | 1,000–30,000 | >20,000: tăng token mạnh |
| Selected chars | 200–12,000 | >8,000: tăng trễ |
| Proxy URL | https://... hoặc trống | không HTTPS: chặn lưu |

### Quy tắc UI
- Cảnh báo inline ngay dưới field.
- Không cho Save nếu vượt hard-limit.
- Nếu sửa lệch preset, hiển thị badge: **“Tuỳ chỉnh nâng cao”**.

---

## 8) Onboarding 3 bước
1. **Bạn muốn ưu tiên gì?** (Nhanh / Cân bằng / Chính xác / Tiết kiệm)
2. **Xem thử ước tính** (thời gian phản hồi + chi phí/ngày)
3. **Xác nhận an toàn** (Budget/day + bật auto-stop khi chạm ngưỡng)

---

## 9) Luồng Save/Load
1. User chọn preset → auto-fill field.
2. User chỉnh thêm (nếu cần) → validate realtime.
3. Save thành công → toast “Đã lưu cấu hình”.
4. Lần mở sau:
   - ưu tiên load preset đã chọn
   - nếu custom lệch preset, giữ custom và gắn nhãn “Tuỳ chỉnh nâng cao”.

---

## 10) Acceptance Criteria
- [ ] Người dùng mới cấu hình xong trong < 60 giây.
- [ ] Tỷ lệ mở Advanced < 30% (đa số dùng được bằng Basic).
- [ ] Lỗi nhập sai giảm ít nhất 50% so với UI cũ.
- [ ] Không còn field kỹ thuật khó hiểu ở Basic.
- [ ] Preset áp dụng đúng và có thể override an toàn.

---

## 11) Rollout
- Phase A: ship UI mới sau feature flag `options_non_tech_v1`.
- Phase B: A/B 20% user, đo completion rate + save success rate.
- Phase C: rollout 100%, giữ fallback UI cũ trong 1 phiên bản.

## 12) Rollback
- Tắt `options_non_tech_v1` để quay về layout cũ.
- Không thay đổi schema lưu cũ, chỉ thêm map preset nên rollback an toàn.
