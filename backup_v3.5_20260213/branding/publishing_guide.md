# Hướng Dẫn Pushlish Chrome Extension (AmoNexus Rebranding)

Để đưa phiên bản **AmoNexus** mới lên Chrome Web Store, bạn cần chuẩn bị 2 phần chính: **Gói Code (Zip)** và **Tài Nguyên Store (Listing Assets)**.

## 1. Chuẩn Bị Gói Code (Zip File)

Đây là file chứa mã nguồn extension sẽ chạy trên máy người dùng.

### ✅ Checklist trước khi nén:
1.  **Code Rebranding**: Đảm bảo đã chạy *Execution Plan* để đổi hết tên từ "Atom" sang "AmoNexus" trong `manifest.json`, `_locales`, `html/js`.
2.  **Version Update**: Trong `manifest.json`, hãy tăng version lên (Ví dụ: từ `2.6` -> `3.0` hoặc `2.7`) để đánh dấu bước ngoặt Rebranding.
3.  **Clean up**: Xóa các file không cần thiết (VD: thư mục `.git`, `.agent`, các file `.md`, file thiết kế gốc `branding/`) để giảm dung lượng.

### 📦 Cách nén:
*   Vào thư mục gốc `d:\Amo\ATOM_Extension_V2.6`.
*   Chọn tất cả các file/folder cần thiết (`manifest.json`, `background.js`, `content.js`, `popup.html`, `icons`, `_locales`, ...).
*   Chuột phải -> **Compress to ZIP file**.
*   Đặt tên: `AmoNexus_v3.0.zip`.

---

## 2. Chuẩn Bị Tài Nguyên Store (Store Listing)

Vì bạn đổi tên thương hiệu, bạn **BẮT BUỘC** phải cập nhật lại toàn bộ hình ảnh trên Store. Nếu tên là "AmoNexus" mà hình ảnh vẫn là "Atom" thì sẽ rất thiếu chuyên nghiệp.

### 🖼️ Hình Ảnh (Graphics Assets) - *Cần thiết kế mới*
1.  **Store Icon (Bắt buộc):**
    *   Kích thước: `128 x 128` pixels.
    *   Định dạng: PNG.
    *   *Lưu ý:* Đây là icon hiện trên chợ ứng dụng, cần rõ ràng, nền trong suốt hoặc bo tròn đẹp.
2.  **Screenshots (Ảnh chụp màn hình):**
    *   Kích thước: `1280 x 800` hoặc `640 x 400` pixels.
    *   Số lượng: Tối thiểu 1, tối đa 5.
    *   *Nội dung:* Chụp giao diện Popup, Options, Sidepanel mới (có chữ AmoNexus).
3.  **Small Promo Tile (Ảnh quảng cáo nhỏ):**
    *   Kích thước: `440 x 280` pixels.
    *   *Nội dung:* Logo AmoNexus + Tagline trên nền màu thương hiệu (Teal/Silver).
4.  **Marquee Promo Tile (Ảnh quảng cáo lớn):**
    *   Kích thước: `1400 x 560` pixels.
    *   *Nội dung:* Thiết kế pro hơn, dùng để làm banner chính nếu được feature.

### 📝 Nội Dung Text (Cần viết lại)
1.  **Name:** `AmoNexus - The Neural Nexus for Your Second Brain` (Có thể thêm slogan ngắn vào tên).
2.  **Summary:** (Tối đa 132 ký tự). *Ví dụ: Manage your attention and knowledge with AI. Focus timer, web chat, and note-taking powered by Gemini.*
3.  **Description:** Bài giới thiệu chi tiết các tính năng, cách dùng, và nhấn mạnh sự thay đổi thương hiệu.

---

## 3. Các Bước Upload (Developer Dashboard)

1.  Truy cập: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
2.  Chọn Extension cũ (Amo/Atom).
3.  Vào menu **Package** -> Chọn nút **Batch Upload new package** (hoặc Upload new package).
    *   Tải file `.zip` vừa nén lên.
4.  Vào menu **Store Listing**:
    *   Cập nhật **Name**, **Summary**, **Description**.
    *   Upload lại **Icon**, **Screenshots**, **Promo Tiles** mới.
5.  Kiểm tra lại menu **Privacy**: Nếu extension có thêm quyền mới (ví dụ `sidePanel` nếu bản trước chưa có), bạn cần giải trình lý do.
6.  Nhấn **Submit for Review**.

---

## 💡 Lời Khuyên
*   **Khoan hãy upload ngay!** Bạn chưa thực hiện việc đổi tên trong code (Execution Plan). Hãy để tôi thực hiện bước đó trước, sau đó bạn chụp lại màn hình (Screenshot) giao diện mới thì mới có tư liệu để upload.
