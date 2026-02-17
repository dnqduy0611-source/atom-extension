# Chính Sách Whitelist & Miễn Trừ của AmoNexus

**Cập nhật lần cuối:** 01/02/2026

Để đảm bảo mức độ riêng tư và an toàn cao nhất (tiêu chuẩn "NeuroGuard"), AmoNexus áp dụng **Chính Sách Whitelist** nghiêm ngặt. Tài liệu này quy định chi tiết về các tên miền được tin cậy, các "Vùng An Toàn" (Safe Zones), và các trường hợp tiện ích tự động vô hiệu hóa để bảo vệ dữ liệu nhạy cảm của bạn.

## 1. Miễn Trừ Riêng Tư (Tự Động Vô Hiệu Hóa)
AmoNexus được thiết lập để tôn trọng sự riêng tư của bạn trong các bối cảnh quan trọng. Tiện ích sẽ **tự động tắt** các tính năng "Đọc Chủ Động" và "Nhật Ký" trên các nhóm trang web sau. Chúng tôi tuyệt đối không xử lý, đọc hoặc gửi dữ liệu từ các tên miền này.

### 🛑 Nhóm 1: Tài Chính & Ngân Hàng
*   **Cổng Ngân Hàng:** `*.vietcombank.com.vn`, `*.techcombank.com.vn`, `*.acb.com.vn`, v.v.
*   **Cổng Thanh Toán:** `paypal.com`, `stripe.com`, `momo.vn`, `zalopay.vn`.
*   **Ví Tiền Số:** `metamask.io`, `binance.com`.

### 🛑 Nhóm 2: Chính Phủ & Pháp Lý
*   **Cổng Thông Tin Chính Phủ:** Tên miền kết thúc bằng `.gov` hoặc `.gov.vn`.
*   **Hệ Thống Thuế:** `gdt.gov.vn`, `thuedientu.gdt.gov.vn`.
*   **Dịch Vụ Công:** `dichvucong.gov.vn`.

### 🛑 Nhóm 3: Y Tế (Bảo Vệ PII)
*   **Hồ Sơ Bệnh Án:** Các cổng thông tin bệnh viện (e.g., `ivie.vn`, `medlatec.vn` - phần quản lý hồ sơ).
*   **Lưu ý:** Dù AmoNexus là công cụ hỗ trợ sức khỏe tinh thần, chúng tôi tránh tương tác với dữ liệu lâm sàng thực tế trừ khi bạn đang ở trên các trang kiến thức y khoa công cộng (VD: Vinmec, Hellobacsi).

---

## 2. Whitelist Năng Suất (Vùng An Toàn Mặc Định)
AmoNexus hiểu rằng "Năng suất" có định nghĩa khác nhau với mỗi người. Tuy nhiên, theo mặc định, chúng tôi đưa các tên miền sau vào **"Vùng An Toàn" (Safe Zones)**.
*   **Hành vi:** Đồng hồ "Focus Mode" sẽ **KHÔNG** tính thời gian trên các trang này là "xao nhãng", và sẽ không có cảnh báo/can thiệp nào được kích hoạt.

### ✅ Công Cụ Làm Việc (Collaboration)
*   `notion.so`
*   `figma.com`
*   `linear.app`
*   `trello.com`
*   `slack.com`

### ✅ Kiến Thức & Lập Trình
*   `github.com`
*   `stackoverflow.com`
*   `docs.google.com` (Drive/Docs/Sheets)
*   `chatgpt.com`, `claude.ai` (AI Workspaces)

### ✅ Giáo Dục
*   `coursera.org`
*   `udemy.com`
*   `duolingo.com`
*   `wikipedia.org`

---

## 3. Quyền Kiểm Soát Của Người Dùng
Bạn là kiến trúc sư cuối cùng cho không gian số của mình.

*   **Whitelist Tùy Chỉnh:** Bạn có thể thêm bất kỳ tên miền nào vào "Vùng An Toàn" của riêng bạn thông qua trang **Cài Đặt** hoặc nút gạt "Add to Safe Zone" trong Menu chính.
*   **Blacklist Tùy Chỉnh:** Ngược lại, bạn có thể đánh dấu thủ công một trang "Năng suất" thành "Xao nhãng" nếu bạn thấy mình đang lạm dụng nó (ví dụ: dành quá nhiều thời gian trang trí Notion mà không làm việc).

## 4. Kết Nối Bên Thứ Ba
AmoNexus chỉ kết nối đến các dịch vụ bên thứ ba đã được whitelist rõ ràng trong kiến trúc bảo mật:
1.  **Google Gemini API:** `generativelanguage.googleapis.com` (Xử lý AI).
2.  **NotebookLM:** `notebooklm.google.com` (Xuất dữ liệu Second Brain).
3.  **Chrome Sync:** Bộ nhớ trình duyệt nội bộ (Đồng bộ cài đặt).

Chúng tôi **chặn** mọi kết nối ngầm đến các máy chủ quảng cáo hoặc theo dõi (analytics) không được phép.

---

**Liên Hệ Hỗ Trợ**
Nếu bạn tin rằng một tên miền bị phân loại sai, vui lòng gửi yêu cầu qua trang GitHub Support của chúng tôi.
