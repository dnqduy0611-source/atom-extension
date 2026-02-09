# Phase 2 v3: Side Panel Unification (UX/UI Non-Tech First)

Version: 3.0  
Date: 2026-02-09  
Status: Ready for implementation

## 1) Mục tiêu

Biến Side Panel thành 1 luồng đơn giản, dễ hiểu cho người không kỹ thuật:
- 1 thanh tab chính rõ ràng: `Chat | Ghi chú | Ôn tập | Đã lưu`
- Ưu tiên hành động bằng nút/chip thay vì yêu cầu gõ lệnh
- Nội dung hiển thị theo ngữ cảnh, không gây quá tải
- Không phá flow chat hiện tại

## 2) Nguyên tắc UX/UI bắt buộc

1. No-jargon 100%  
- Không dùng từ kỹ thuật trên UI (`memory`, `semantic`, `embedding`, `SRQ`).
- Dùng từ thân thiện: `Ghi chú`, `Ôn tập`, `Đã lưu`, `Tập trung`.

2. Progressive disclosure  
- Mặc định chỉ hiện phần cần thiết.
- Tính năng nâng cao chỉ mở khi user bấm.

3. One-primary-action-per-state  
- Mỗi trạng thái chỉ có 1 CTA chính dễ thấy.
- Ví dụ khi chưa có dữ liệu: chỉ hiện `Bắt đầu`.

4. Consistent feedback  
- Mọi thao tác đều có phản hồi tức thì (toast/trạng thái nút/loading).
- Không để click xong mà “im lặng”.

5. Fast + forgiving  
- Không block UI không cần thiết.
- Action có confirm/undo khi phù hợp.

## 3) Điều chỉnh kỹ thuật theo codebase hiện tại

Do sidepanel hiện đang chạy theo IIFE/global scripts, Phase 2 v3 dùng pattern này để tránh rủi ro:
- `ui/controllers/tab_controller.js` -> `window.TabController`
- `ui/controllers/focus_widget.js` -> `window.FocusWidget`
- `sidepanel.js` giữ vai trò orchestration

Không áp dụng ES module import/export cho sidepanel ở phase này.

## 4) Luồng UI đích (non-tech friendly)

## 4.1 Màn hình mặc định
- Mở sidepanel vào tab `Chat`.
- Trên input có cụm quick actions dễ hiểu (ví dụ: `Tập trung 25p`, `Ghi nhanh`).
- Không hiển thị quá nhiều panel cùng lúc.

## 4.2 Tab chính
- `Chat`: giữ nguyên toàn bộ flow chat hiện tại.
- `Ghi chú`: danh sách ghi chú gần đây + tìm nhanh.
- `Ôn tập`: trạng thái rỗng thân thiện + CTA dẫn user tạo dữ liệu.
- `Đã lưu`: hiển thị widget đã lưu (SRQ) nhưng copy hiển thị là `Đã lưu`.

## 4.3 Focus widget
- 3 trạng thái: Idle / Active / Break.
- Nút rõ nghĩa: `Bắt đầu`, `Tạm dừng`, `Dừng`.
- Đồng bộ với popup/background qua `FOCUS_GET_STATE` + `ATOM_FOCUS_STATE_UPDATED`.

## 5) Kế hoạch triển khai (wave-based, an toàn)

## Wave A: Module split (không đổi UI lớn)
- Tách `TabController` từ logic tab hiện tại trong `sidepanel.js`.
- Tách `FocusWidget` mới vào controller riêng.
- Giữ behavior không đổi để giảm regression.

## Wave B: Main tab unification
- Thêm thanh tab chính `Chat | Ghi chú | Ôn tập | Đã lưu`.
- Map dữ liệu/callback vào controller thay vì xử lý rải rác trong `sidepanel.js`.
- Đảm bảo không có 2 hệ tab gây rối mắt (loại bỏ/ẩn flow tab cũ sau khi map xong).

## Wave C: UX polish
- Animation dưới 200ms cho switch tab.
- `prefers-reduced-motion` fallback.
- Responsive 280px+ (icon-first ở màn hẹp).

## 6) Acceptance criteria

1. User mới mở sidepanel hiểu được ngay 4 khu vực chính trong <5 giây.  
2. Không còn text kỹ thuật trên giao diện chính.  
3. Chuyển tab mượt, không giật, không reset trạng thái ngoài ý muốn.  
4. Focus widget cập nhật đúng thời gian thực với background state.  
5. Flow chat cũ vẫn chạy ổn, không regression.  
6. Tất cả nhãn/CTA có i18n EN+VI.

## 7) Checklist copy non-tech (bắt buộc)

- `Saved` -> `Đã lưu`
- `Cards` -> `Ôn tập`
- `Focus` -> `Tập trung`
- `Export` -> `Lưu`
- `Dismiss` -> `Bỏ qua`

## 8) Test scenario tối thiểu trước release

1. Fresh user chưa có dữ liệu: nhìn UI vẫn hiểu và có CTA rõ.  
2. User đang focus: widget đổi trạng thái đúng và nút hoạt động đúng.  
3. User thao tác nhanh liên tục (tab/chip): không bị lỗi race, không double-action.  
4. Màn hình hẹp 280px: không vỡ layout, nút vẫn bấm được.

