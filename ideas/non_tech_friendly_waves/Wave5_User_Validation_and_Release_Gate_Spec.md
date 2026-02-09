# Non-Tech Friendly Wave 5 Spec
## User Validation & Release Gate

---

## 1) Mục tiêu và phạm vi

Wave 5 xác thực kết quả bằng usability test với user non-tech và chốt readiness rollout.

### Mục tiêu định lượng
| Metric | Target | Đo lường |
|--------|--------|----------|
| Non-tech friendly score | ≥ 8.5/10 | Trung bình 5 tiêu chí rubric |
| Task completion rate | ≥ 90% | Số task hoàn thành / tổng task |
| Direct help rate | ≤ 20% | Số lần cần moderator giải thích |

### Phạm vi
- Test plan & script chi tiết
- Rubric chấm điểm
- Template thu thập dữ liệu
- Tổng hợp kết quả
- Gate go/no-go cho release

---

## 2) Đối tượng test

### Tiêu chí tuyển chọn
| # | Tiêu chí | Yêu cầu |
|---|----------|---------|
| 1 | Nghề nghiệp | Không làm IT, không phải developer/designer |
| 2 | Kinh nghiệm extension | Chưa từng dùng extension AI tương tự |
| 3 | Độ tuổi | Đa dạng: 20-60 tuổi |
| 4 | Mức độ quen AI | Từ chưa bao giờ đến đã dùng ChatGPT cơ bản |

### Recruitment Plan
| Nguồn | Số lượng | Ghi chú |
|-------|----------|---------|
| Giới thiệu cá nhân (gia đình, bạn bè non-tech) | 4 người | Ưu tiên độ tuổi đa dạng |
| Facebook group (AI Enthusiasts VN, etc.) | 3 người | Post tuyển người test |
| Đồng nghiệp non-tech | 3 người | HR, Marketing, Finance team |
| **Tổng** | **10 người** | Mỗi người test 25-30 phút |

### Compensation
- Thank you gift: voucher 50k hoặc cà phê
- Không bắt buộc nhưng khuyến khích để tăng engagement

---

## 3) Nhiệm vụ test (5 Tasks)

### Task 1: Mở extension và hiểu trạng thái
**Mục tiêu:** Kiểm tra user có thể tìm, mở extension và hiểu được trạng thái hiện tại

| Bước | Hướng dẫn cho Moderator | Kỳ vọng |
|------|-------------------------|---------|
| 1.1 | "Hãy mở extension ATOM/AmoNexus" | User tìm được icon trên toolbar |
| 1.2 | "Cho tôi biết extension đang ở trạng thái gì" | User đọc và mô tả đúng status |
| **Success** | Hoàn thành trong ≤ 60 giây | User hiểu rõ trạng thái |

---

### Task 2: Cấu hình AI cơ bản
**Mục tiêu:** Kiểm tra user có thể thiết lập API key

| Bước | Hướng dẫn cho Moderator | Kỳ vọng |
|------|-------------------------|---------|
| 2.1 | Đưa user API key test: `AIzaSy...TestKey123` | User nhận key |
| 2.2 | "Hãy nhập key này vào extension để kích hoạt AI" | User tìm được ô nhập key |
| 2.3 | "Lưu cấu hình lại" | User bấm Save/Lưu thành công |
| **Success** | Hoàn thành trong ≤ 90 giây | Hiển thị thông báo thành công |

> **Lưu ý:** Chuẩn bị sẵn test API key hoạt động được để user không bị lỗi authentication

---

### Task 3: Mở sidepanel và tóm tắt text
**Mục tiêu:** Kiểm tra luồng sử dụng chính của extension

| Bước | Hướng dẫn cho Moderator | Kỳ vọng |
|------|-------------------------|---------|
| 3.1 | Mở sẵn trang web có đoạn văn bản dài | Trang test page ready |
| 3.2 | "Hãy dùng extension để tóm tắt đoạn text này" | User mở sidepanel |
| 3.3 | Quan sát user thao tác | User bôi text và bấm tóm tắt |
| **Success** | Hoàn thành trong ≤ 120 giây | Kết quả tóm tắt hiện ra |

---

### Task 4: Lưu insight vào kho nhớ
**Mục tiêu:** Kiểm tra tính năng Memory/Lưu trữ

| Bước | Hướng dẫn cho Moderator | Kỳ vọng |
|------|-------------------------|---------|
| 4.1 | "Hãy lưu kết quả vừa tóm tắt vào bộ nhớ của extension" | User tìm nút Save/Lưu |
| 4.2 | "Kiểm tra xem đã lưu thành công chưa" | User mở Memory tab |
| **Success** | Hoàn thành trong ≤ 90 giây | Item xuất hiện trong Memory |

---

### Task 5: Xử lý tình huống lỗi
**Mục tiêu:** Kiểm tra khả năng phục hồi khi gặp lỗi

**Kịch bản test (chọn 1):**

| Kịch bản | Cách simulate | Kỳ vọng user làm |
|----------|---------------|------------------|
| **A. Mất mạng** | Tắt WiFi trước khi user thao tác | User thấy error, bấm Retry sau khi bật lại |
| **B. Key sai** | Thay key bằng `InvalidKey123` | User thấy error, tìm cách sửa key |

| Bước | Hướng dẫn cho Moderator | Kỳ vọng |
|------|-------------------------|---------|
| 5.1 | "Hãy thử tóm tắt lại một đoạn text" | User thao tác và gặp lỗi |
| 5.2 | "Bạn sẽ làm gì tiếp theo?" | User đọc error message |
| 5.3 | Quan sát | User tìm và bấm đúng CTA (Retry/Fix) |
| **Success** | Hoàn thành trong ≤ 120 giây | User phục hồi được |

---

## 4) Rubric chấm điểm

### Định nghĩa thang điểm 0-10
| Điểm | Mô tả |
|------|-------|
| 9-10 | Xuất sắc - User hiểu/thao tác ngay, không do dự |
| 7-8 | Tốt - Có chút do dự nhưng tự giải quyết được |
| 5-6 | Trung bình - Cần thử 2-3 lần mới đúng |
| 3-4 | Kém - Gần như stuck, cần gợi ý nhẹ |
| 0-2 | Rất kém - Hoàn toàn không thể tự làm |

### 5 Tiêu chí đánh giá
| # | Tiêu chí | Mô tả chi tiết |
|---|----------|----------------|
| 1 | Dễ hiểu từ ngữ | Label, button text, message có dễ hiểu không? |
| 2 | Dễ tìm đúng nút | Navigation có trực quan? Nút ở vị trí mong đợi? |
| 3 | Dễ hiểu kết quả | Sau khi bấm, user có hiểu chuyện gì xảy ra? |
| 4 | Dễ phục hồi lỗi | Khi gặp lỗi, user có biết cách sửa? |
| 5 | Cảm giác tự tin | User có thấy confident khi sử dụng? |

### Công thức tính điểm
```
Non-tech friendly score = (Tiêu chí 1 + 2 + 3 + 4 + 5) / 5
```

### Ngưỡng release
| Điều kiện | Kết luận |
|-----------|----------|
| Score ≥ 8.5 **VÀ** Completion ≥ 90% **VÀ** Không có S1 | ✅ **GO** |
| Score 8.0-8.49 **VÀ** Tất cả S1 đã có patch rõ ràng | ⚠️ **CONDITIONAL GO** |
| Score < 8.0 **HOẶC** Completion < 85% | ❌ **NO-GO** |

---

## 5) Định nghĩa Severity

| Level | Tên | Định nghĩa | Ví dụ |
|-------|-----|------------|-------|
| **S1** | Blocker | User hoàn toàn stuck ≥ 2 phút, không thể hoàn thành task | Không tìm được nút Save, không hiểu error message |
| **S2** | Major | User nhầm lẫn, cần ≥ 3 lần thử hoặc hỏi moderator | Bấm sai nút 2-3 lần trước khi đúng |
| **S3** | Minor | User hoàn thành nhưng có chút do dự hoặc comment tiêu cực | "Chỗ này hơi khó tìm nhỉ" |

---

## 6) Dữ liệu cần thu

### Định lượng (mỗi task)
| Metric | Cách thu | Ghi vào |
|--------|----------|---------|
| Task completion | Yes/No | Form |
| Time per task | Stopwatch (giây) | Form |
| Số lần hỏi lại ý nghĩa label | Đếm | Form |
| Số lần bấm sai | Đếm | Form |

### Định tính
| Metric | Cách thu | Ghi vào |
|--------|----------|---------|
| Feedback sau mỗi task | Hỏi 1 câu ngắn | Form |
| Pain points | Ghi chú theo severity S1/S2/S3 | Form |
| Quote đáng chú ý | Ghi nguyên văn | Form |

---

## 7) Template thu thập dữ liệu

### Form cho mỗi Participant
```
=== PARTICIPANT INFO ===
ID: P[XX]
Tuổi: ___
Nghề nghiệp: ___
Đã dùng AI trước đó: [ ] Có  [ ] Không
Ngày test: ___

=== TASK 1: Mở extension ===
Hoàn thành: [ ] Yes  [ ] No
Thời gian: ___ giây
Số lần hỏi lại: ___
Số lần bấm sai: ___
Pain points: [ ] S1  [ ] S2  [ ] S3  Mô tả: ___
Quote: "___"

=== TASK 2: Cấu hình AI ===
(Tương tự Task 1)

=== TASK 3: Tóm tắt text ===
(Tương tự Task 1)

=== TASK 4: Lưu insight ===
(Tương tự Task 1)

=== TASK 5: Xử lý lỗi ===
(Tương tự Task 1)

=== ĐIỂM RUBRIC (0-10 mỗi tiêu chí) ===
1. Dễ hiểu từ ngữ: ___
2. Dễ tìm đúng nút: ___
3. Dễ hiểu kết quả: ___
4. Dễ phục hồi lỗi: ___
5. Cảm giác tự tin: ___
ĐIỂM TỔNG: ___ / 10

=== GHI CHÚ CHUNG ===
___
```

---

## 8) Phương pháp test

### Think-aloud Protocol
1. Yêu cầu user nói ra suy nghĩ khi thao tác
2. Moderator chỉ gợi ý nhẹ: "Bạn đang nghĩ gì?"
3. Không giải thích UI hoặc gợi ý cách làm

### Quy tắc cho Moderator
| ✅ Được làm | ❌ Không được làm |
|-------------|-------------------|
| Đọc hướng dẫn task | Giải thích UI |
| Hỏi "Bạn đang nghĩ gì?" | Chỉ nút cần bấm |
| Ghi chú quan sát | Tỏ ra sốt ruột |
| Đợi user thử hết khả năng | Can thiệp khi chưa cần |

### Ghi chép
- Ghi màn hình (với consent)
- Ghi chú timestamp khi có sự kiện quan trọng
- Ảnh chụp màn hình nếu cần

---

## 9) Consent Form

```
=== ĐỒNG Ý THAM GIA USABILITY TEST ===

Tôi đồng ý tham gia buổi test usability cho extension ATOM/AmoNexus.

Tôi hiểu rằng:
[ ] Buổi test sẽ được ghi màn hình
[ ] Video chỉ dùng cho mục đích phân tích nội bộ
[ ] Tôi có thể dừng bất cứ lúc nào
[ ] Thông tin cá nhân sẽ được ẩn danh

Họ tên: _______________
Chữ ký: _______________
Ngày: _______________
```

---

## 10) Báo cáo kết quả

### Báo cáo cho mỗi Participant
| Field | Nội dung |
|-------|----------|
| Participant ID | P01-P10 |
| Completion | 5/5 tasks hoặc chi tiết |
| Thời gian trung bình/task | X giây |
| Pain points | Liệt kê theo S1/S2/S3 |
| Quote tiêu biểu | 1 câu feedback |
| Điểm rubric | X.X/10 |

### Tổng hợp sau cùng
1. **Top 10 Friction Points** - xếp theo tần suất và severity
2. **Mapping Table:**
   | Friction | File liên quan | Đề xuất fix | Priority |
   |----------|----------------|-------------|----------|
   | Không hiểu nút X | popup.html | Đổi label thành Y | P0 |
3. **Quick Fix List** - những gì có thể fix trong 2-3 ngày
4. **Deferred List** - những gì cần thời gian hơn

---

## 11) Gate Release

### Decision Matrix
| Điều kiện | Score | Completion | S1 Blockers | Quyết định |
|-----------|-------|------------|-------------|------------|
| Đạt tất cả | ≥ 8.5 | ≥ 90% | 0 | ✅ **GO** |
| Gần đạt | 8.0-8.49 | ≥ 85% | Có patch | ⚠️ **CONDITIONAL GO** |
| Không đạt | < 8.0 | < 85% | Còn open | ❌ **NO-GO** |

### Action sau quyết định
| Quyết định | Action |
|------------|--------|
| GO | Release ngay, fix S2/S3 ở version sau |
| CONDITIONAL GO | Fix S1 trong 1-2 ngày → re-test 2 người → GO |
| NO-GO | Quay lại Wave 4 refinement → re-test full |

---

## 12) Kế hoạch sửa sau test

### Phân nhóm issue
| Nhóm | Mô tả | Ví dụ |
|------|-------|-------|
| Copy ambiguity | Từ ngữ không rõ nghĩa | "Tóm tắt thông minh" → "Tóm tắt nội dung" |
| Navigation confusion | Khó tìm đúng chỗ | Nút Save ẩn quá sâu |
| Error recovery gap | Khó xử lý khi lỗi | Error message không có hướng dẫn |

### Backlog Format
| ID | Issue | Nhóm | Severity | Owner | ETA | Status |
|----|-------|------|----------|-------|-----|--------|
| F01 | ... | Copy | S1 | ... | ... | Open |

### Timebox
- Patch wave sau test: **2-3 ngày**
- Chỉ fix P0 và S1 trước release
- P1/P2 chuyển sang version tiếp theo

---

## 13) Acceptance Criteria

Checklist hoàn thành Wave 5:

- [ ] Đủ report 10/10 participant
- [ ] Có bảng điểm tổng hợp với tất cả metrics
- [ ] Có kết luận GO/NO-GO rõ ràng với justification
- [ ] Có backlog fix ưu tiên kèm owner và ETA
- [ ] Có changelog ngắn cho những gì đã điều chỉnh sau test
- [ ] Video recordings đã được lưu trữ

---

## 14) Rủi ro và giảm thiểu

| Rủi ro | Xác suất | Impact | Giảm thiểu |
|--------|----------|--------|------------|
| Mẫu test không đại diện | Trung bình | Cao | Tuyển đa dạng profile |
| Moderator bias | Thấp | Cao | Dùng script cố định |
| Task script không sát use case | Trung bình | Trung bình | Pilot test 1-2 người |
| User không nói nhiều | Trung bình | Thấp | Nhắc think-aloud |
| Lỗi kỹ thuật khi test | Thấp | Cao | Test setup trước |

---

## 15) Estimate và Timeline

| Phase | Duration | Output |
|-------|----------|--------|
| Chuẩn bị (script, form, recruit) | 0.5 ngày | Ready-to-test setup |
| Pilot test (1-2 người) | 0.25 ngày | Refined script |
| Chạy test chính (10 người) | 1 ngày | Raw data |
| Tổng hợp và kết luận | 0.5 ngày | Report + GO/NO-GO |
| **Tổng** | **~2.25 ngày** | Release decision |

---

## 16) Checklist trước khi bắt đầu

### Setup
- [ ] Extension đã cài sẵn trên browser test
- [ ] Test API key hoạt động
- [ ] Trang web test có nội dung dài để tóm tắt
- [ ] Form thu thập dữ liệu ready (Google Form/Sheet)
- [ ] Phần mềm ghi màn hình ready
- [ ] Consent form in sẵn

### Recruitment
- [ ] Đã confirm 10 participants
- [ ] Đã gửi lịch hẹn cụ thể
- [ ] Chuẩn bị compensation (nếu có)

### Test session
- [ ] Pilot test xong, script đã refined
- [ ] Moderator đã đọc quy tắc
- [ ] Backup plan nếu có sự cố kỹ thuật

---

*Last updated: 2026-02-08*
*Version: 2.0*
