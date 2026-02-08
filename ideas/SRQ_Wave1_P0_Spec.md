# SRQ Remediation Wave 1 (P0) Spec

## 1) Mục tiêu & phạm vi
Mục tiêu Wave 1 là tăng độ ổn định cốt lõi cho Smart Research Queue (SRQ), tập trung vào:
1. Chống trùng card bằng idempotency + upsert.
2. Chuẩn hóa trạng thái UX: Loading / Empty / Error / Retry.

Phạm vi chỉ áp dụng cho SRQ flow hiện có (capture → create card → enrich → batch → render/export), không thay đổi kiến trúc lớn.

## 2) Non-goals
- Không thêm permission mới trong `manifest.json`.
- Không thay đổi mô hình dữ liệu export queue hiện tại.
- Không redesign toàn bộ UI sidepanel.
- Không triển khai theme/density (để Wave 3).

## 3) Hiện trạng / rủi ro
- Có rủi ro tạo card trùng khi user click lặp hoặc event bắn lại.
- UI có thể không rõ ràng khi request fail/chậm (người dùng không biết đang loading hay lỗi).
- Trải nghiệm “im lặng khi fail” làm khó debug và giảm trust.

## 4) Thiết kế giải pháp
### 4.1 Idempotency key
Sinh `idempotencyKey` ổn định từ dữ liệu capture (normalized):
- `origin + pathname`
- `normalizedTitle`
- `normalizedSelectionPrefix` (120 ký tự)
- `timeBucket` (chuẩn hoá cố định theo UTC)

**Default chốt cho Wave 1:**
- `timeBucket` = **60 giây**, UTC, floor theo bucket.
- Công thức: `bucketStartMs = Math.floor(nowUtcMs / 60000) * 60000`
- Suffix version cho key: `:v1`
- Ví dụ key cuối: `${baseKey}:${bucketStartMs}:v1`

### 4.2 Upsert semantics
Store chuyển từ append-only logic sang hỗ trợ `upsertByIdempotencyKey`:
- Nếu key đã tồn tại: merge patch vào card cũ, cập nhật `updatedAt`.
- Nếu chưa có: thêm card mới.

### 4.3 UX state machine tối thiểu
Áp dụng cho SRQ widget + review entry points:
- `loading`
- `ready`
- `empty`
- `error` (kèm retry)

Khi lỗi runtime/storage/network: hiển thị message ngắn + nút retry.

## 5) Chi tiết thay đổi theo file (file-level plan)
### `services/srq_enricher.js`
- Thêm helper `buildIdempotencyKey(captureData)`.
- Gắn `idempotencyKey` vào card metadata trước khi save.

### `storage/srq_store.js`
- Thêm `findCardByIdempotencyKey(key)`.
- Thêm `upsertCard(card)`.
- Giữ nguyên FIFO eviction rule hiện có sau bước upsert.

### `background.js`
- `SRQ_CREATE_CARD` chuyển sang dùng flow idempotent:
  1) create/enrich payload
  2) `upsertCard`
  3) gửi `SRQ_CARDS_UPDATED` sau khi lưu thành công

### `ui/components/srq_widget.js`
- Bổ sung trạng thái loading/error/empty rõ ràng.
- Bổ sung nút retry cho lỗi lấy batches/card stats.

### `sidepanel.js`
- `mountSRQWidget()` trả về state chuẩn (không chỉ silent fail).

### `_locales/en/messages.json`, `_locales/vi/messages.json`
- Thêm key cho loading/error/retry state (nếu chưa có).

## 6) Message/Event contracts
Không đổi tên event hiện tại, chỉ bổ sung hành vi:
- `SRQ_CREATE_CARD`: idempotent save.
- `SRQ_GET_BATCHES`: trả lỗi nhất quán theo schema:
  - `{ ok:false, errorCode, message }`
  - `errorCode` enum chốt cho Wave 1:
    - `INVALID_PARAM`
    - `UNAUTHORIZED`
    - `NOT_FOUND`
    - `CONFLICT`
    - `RATE_LIMIT`
    - `TIMEOUT`
    - `TRANSIENT`
    - `SERVER_ERROR`
    - `UNKNOWN`
- `SRQ_CARDS_UPDATED`: chỉ bắn sau khi write thành công.

## 7) Data model / state changes
Bổ sung field card:
- `idempotencyKey: string`
- `updatedAt: number`

Không thay đổi key storage chính: `atom_srq_cards_v1`.

## 8) UX states & copy
Ví dụ copy (vi):
- Loading: `Đang tải hàng chờ nghiên cứu...`
- Empty: `Chưa có clip nào chờ xử lý.`
- Error: `Không tải được dữ liệu SRQ.`
- Retry CTA: `Thử lại`

## 9) Test plan
### Unit
- `buildIdempotencyKey()` ổn định cùng input.
- `buildIdempotencyKey()` dùng bucket UTC 60s đúng theo spec và có suffix `:v1`.
- `upsertCard()` không tạo duplicate khi key trùng.
- FIFO vẫn đúng sau upsert + overflow.
- `SRQ_GET_BATCHES` trả `errorCode` nằm trong enum cho phép.

### Manual
- Click 2-3 lần nhanh cùng selection → chỉ 1 card.
- Tắt mạng / giả lập lỗi message → thấy Error + Retry.
- Retry thành công thì UI quay về `ready`.

### E2E
- Capture → batch → export không bị nhân đôi card/job bất thường.

## 10) Acceptance criteria
- [ ] Không còn duplicate card với cùng idempotencyKey.
- [ ] `timeBucket` chạy theo UTC 60s, key có suffix `:v1`.
- [ ] `SRQ_GET_BATCHES` trả lỗi với `errorCode` đúng enum đã chốt.
- [ ] SRQ widget luôn hiển thị 1 trong 4 state hợp lệ.
- [ ] Mọi lỗi fetch chính có retry path.
- [ ] Không thêm permission manifest.

## 11) Rollout + rollback
### Rollout
- Merge behind setting gate `srqEnabled` (đang có).
- Bật cho internal users trước.

### Rollback
- Nếu lỗi nghiêm trọng: fallback về `addCard` cũ qua flag nhanh trong background.
- **Flag chốt cho Wave 1:** `SRQ_USE_LEGACY_ADD_CARD` (boolean), đặt trong `background.js` tại SRQ config block gần SRQ handlers.
- Default: `false`.
- Nguyên tắc bật rollback:
  1) Khởi tạo `let rollbackApplied = false`
  2) Chỉ set `rollbackApplied = true` sau khi side-effect đã mutate
  3) Nếu lỗi sau mutate thì chạy nhánh compensate/fallback và log bắt buộc: `{ reason, rollbackApplied, requestType }`

## 12) Ước lượng effort + phụ thuộc
- Effort: 1.5–2.5 ngày dev + 0.5 ngày test.
- Phụ thuộc: không có external dependency mới; cần reviewer nắm SRQ store/background flow.
