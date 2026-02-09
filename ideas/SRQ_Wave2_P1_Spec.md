# SRQ Remediation Wave 2 (P1) Spec

## 1) Mục tiêu & phạm vi
Wave 2 xử lý tính nhất quán runtime và khả năng thao tác:
1. Giảm race condition giữa enrich/update/export/refresh.
2. Thêm in-flight guard cho action export/dismiss.
3. Bổ sung keyboard + a11y cơ bản cho widget/review modal.

## 2) Non-goals
- Không đổi data schema lớn ngoài field runtime cần thiết.
- Không làm visual redesign.
- Không thêm MCP/OpenClaw phase mới.

## 3) Hiện trạng / rủi ro
- Các action bất đồng bộ có thể đến UI sai thứ tự.
- User bấm nhiều lần `Export`/`Dismiss` có thể tạo thao tác lặp.
- Modal/widget có thể chưa đủ chuẩn bàn phím và focus.

## 4) Thiết kế giải pháp
### 4.1 Sequencing + guard
- Định nghĩa action pipeline rõ:
  - `capture -> create/upsert -> async enrich -> broadcast`
  - `export/dismiss -> lock card/batch -> apply -> broadcast`
- Mỗi action mutation có `requestId` + `opTimestamp` để trace.

### 4.2 In-flight map
Background duy trì map:
- key: `operationType:targetId`
- value: trạng thái đang chạy

Nếu cùng key đang chạy thì reject mềm (hoặc no-op success) để tránh double mutation.

### 4.3 Keyboard & a11y baseline
- `Esc` đóng review modal.
- Trap focus trong modal.
- ARIA labels cho button/action chính.
- Tab order ổn định.

## 5) Chi tiết thay đổi theo file
### `background.js`
- Bọc `SRQ_EXPORT_BATCH`, `SRQ_EXPORT_CARD`, `SRQ_DISMISS_CARD`, `SRQ_DISMISS_BATCH` bằng in-flight guard.
- Chuẩn hóa response lỗi: `{ ok:false, errorCode, message }`.
- Broadcast update chỉ sau mutation thành công.

### `services/srq_enricher.js`
- Đảm bảo enrich async không override trạng thái mới hơn (check `updatedAt` / version guard).

### `storage/srq_store.js`
- Thêm optional optimistic guard: update theo `expectedUpdatedAt` (nếu mismatch thì retry read-merge-write).

### `ui/components/srq_widget.js`
- Disable button khi action đang in-flight.
- Add keyboard handler (`Esc`, `Enter` ở CTA chính).
- Add ARIA attributes và live region cho trạng thái.

### `sidepanel.js`
- Debounce refresh khi nhận nhiều `SRQ_CARDS_UPDATED` liên tiếp.

## 6) Message/Event contracts
Giữ event cũ, bổ sung quy ước:
- Mọi mutation response chứa `requestId` (nếu request truyền vào).
- `SRQ_CARDS_UPDATED` có thể kèm payload nhẹ `{ reason, changedIds }`.

## 7) Data model/state changes
- Optional card metadata:
  - `version` hoặc `updatedAt` dùng cho conflict guard.
- Runtime-only in-flight map đặt ở background memory (không cần persist).

## 8) UX states & copy
- Khi đang export/dismiss: nút disabled + text `Đang xử lý...`
- Nếu bấm lặp: toast nhẹ `Tác vụ đang chạy, vui lòng đợi.`
- Lỗi concurrency: `Dữ liệu vừa thay đổi, đã tải lại danh sách mới nhất.`

## 9) Test plan
### Unit
- In-flight guard chặn double-call cùng target.
- Debounce refresh không làm mất cập nhật cuối.

### Manual
- Spam click Export/Dismiss nhanh: chỉ xử lý 1 lần.
- Mở modal, test Esc/Tab/Shift+Tab.

### E2E
- Capture nhiều card + export song song: state cuối đúng, không duplicate mutation.

## 10) Acceptance criteria
- [ ] Không double-export/double-dismiss do multi-click.
- [ ] Modal dùng được hoàn toàn bằng bàn phím cơ bản.
- [ ] Broadcast/refresh không gây nhấp nháy hoặc lệch count kéo dài.

## 11) Rollout + rollback
### Rollout
- Bật guard theo flag nội bộ (`srqStrictOpsGuard` - optional).
- Quan sát logs mutation 24-48h.

### Rollback
- Tắt guard flag nếu phát sinh false-positive block.

## 12) Ước lượng effort + phụ thuộc
- Effort: 2–3 ngày dev + 1 ngày QA.
- Phụ thuộc: hoàn thành Wave 1 để có nền idempotency/state rõ ràng.
