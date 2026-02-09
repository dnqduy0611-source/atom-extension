# SRQ Remediation Wave 3 (P2) Spec

## 1) Mục tiêu & phạm vi
Wave 3 tập trung polish UX/UI và hoàn thiện trải nghiệm:
1. Theme/density options cho SRQ widget/review.
2. Microcopy/i18n rõ ràng, nhất quán ngữ cảnh.
3. Cải thiện khả năng đọc nhanh và thao tác ở danh sách batch lớn.

## 2) Non-goals
- Không thay đổi business logic cốt lõi của SRQ.
- Không thay đổi contract background message chính.
- Không thêm permission hoặc dependency nặng.

## 3) Hiện trạng / rủi ro
- UI đã chạy được nhưng chưa tinh chỉnh cho nhiều profile người dùng.
- Một số wording có thể kỹ thuật hoặc chưa nhất quán đa ngôn ngữ.
- Khi batch nhiều, khả năng scan/action có thể chậm.

## 4) Thiết kế giải pháp
### 4.1 Visual density
Thêm chế độ hiển thị:
- `comfortable` (mặc định)
- `compact`

Lưu trong settings hiện có (mở rộng nhẹ).

### 4.2 Theme alignment
Tận dụng token hiện hữu, đảm bảo SRQ không lệch theme tổng thể (dark/light tương thích nếu app support).

### 4.3 Microcopy pass
Rà soát chuỗi i18n:
- Nhất quán động từ (`Xuất`, `Bỏ qua`, `Xem lại`, `Thử lại`)
- Rút gọn câu lỗi/nhắc để dễ hiểu
- Đồng bộ en/vi parity

### 4.4 High-volume list usability
- Header sticky trong review modal.
- Batch card có thông tin ưu tiên rõ hơn (badge/color nhẹ, không lòe loẹt).
- Pagination nhẹ hoặc collapse nhóm dài (nếu cần).

## 5) Chi tiết thay đổi theo file
### `styles/srq.css.js`
- Bổ sung class cho density mode.
- Tinh chỉnh spacing, typography, hover/focus states.

### `ui/components/srq_widget.js`
- Toggle density (nếu đã có settings UI thì đọc từ đó).
- Cải thiện layout batch card khi text dài.
- Tăng độ rõ nút chính/phụ.

### `sidepanel.js`
- Nạp/persist user preference cho density mode (qua settings key hiện tại).

### `_locales/en/messages.json`, `_locales/vi/messages.json`
- Rà soát/chuẩn hóa toàn bộ SRQ keys liên quan copy.
- Thêm key còn thiếu cho trạng thái/P0-P1 nếu cần.

## 6) Message/Event contracts
- Không thêm event bắt buộc mới.
- Tùy chọn: event UI-local `SRQ_UI_PREF_CHANGED` chỉ dùng nội bộ sidepanel.

## 7) Data model/state changes
Mở rộng settings (nhẹ):
- `srqDensityMode: "comfortable" | "compact"`
- (optional) `srqShowHints: boolean`

## 8) UX states & copy
Ví dụ copy tối ưu:
- `Bạn có {n} clip sẵn sàng xuất.`
- `Không có clip chờ.`
- `Xuất thành công {n} clip.`
- `Có lỗi khi xuất. Vui lòng thử lại.`

## 9) Test plan
### Unit
- Render đúng class theo density mode.
- i18n key fallback hoạt động nếu thiếu locale key.

### Manual
- So sánh comfortable vs compact với batch 1, 5, 20 cards.
- Kiểm tra readability trên màn nhỏ sidepanel.
- Kiểm tra focus ring/hover states.

### E2E
- Thay density mode, reload extension, preference vẫn giữ.
- Dòng text en/vi không overflow layout nghiêm trọng.

## 10) Acceptance criteria
- [ ] Người dùng chuyển được density mode và persisted.
- [ ] Copy SRQ en/vi đồng nhất, dễ hiểu.
- [ ] UI vẫn rõ ràng khi batch/card dài.
- [ ] Không regression logic export/dismiss từ Wave 1-2.

## 11) Rollout + rollback
### Rollout
- Ship sau khi Wave 1-2 ổn định.
- Có thể bật dần qua setting default (giữ comfortable).

### Rollback
- Nếu phát sinh lỗi layout: fallback về style cũ bằng bỏ class density mới.

## 12) Ước lượng effort + phụ thuộc
- Effort: 1.5–2.5 ngày dev + 0.5 ngày QA/UI review.
- Phụ thuộc: Wave 1-2 đã ổn định để tránh polish đè lên logic chưa chắc.
