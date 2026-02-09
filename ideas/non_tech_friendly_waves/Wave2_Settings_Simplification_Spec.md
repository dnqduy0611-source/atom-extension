# Non-Tech Friendly Wave 2 Spec

## 1) Muc tieu va pham vi
Wave 2 don gian hoa Information Architecture cua Settings de user non-tech chi thay nhung gi can thiet.

Muc tieu dinh luong:
1. Giam so quyet dinh user phai chon trong lan setup dau tien xuong <=5.
2. 80% user lan dau chi can dung tab `Co ban`.
3. Tat ca option nang cao duoc an mac dinh va co canh bao truoc khi mo.

Pham vi:
- `options.html`
- `options.js`
- i18n keys cho settings

## 2) Baseline hien tai
1. Settings gom nhieu tab (`General`, `AI Pilot`, `Connections`, `Advanced`).
2. User moi de vao nham cac field tuning ky thuat.
3. Nhieu field nang cao nam cung luong setup thong thuong.

## 3) Non-goals
1. Khong bo feature nang cao.
2. Khong thay doi storage key hien tai.
3. Khong thay doi provider backend.

## 4) IA de xuat

### 4.1 Cau truc trang moi
1. Tab `Co ban` (default)
2. Tab `Ket noi`
3. Tab `Nang cao` (an sau confirm)

### 4.2 Tab Co ban chi giu 6 muc
1. Bat/Tat AI
2. Chon nha cung cap
3. Nhap ma ket noi AI
4. Chon muc do can thiep (Gentle/Balanced/Strict)
5. Ngon ngu
6. Nut Luu

### 4.3 Tab Nang cao
Toan bo field sau dat trong day:
1. Min confidence
2. Timeout
3. Budget/day
4. Cache TTL
5. Viewport/selected char limits
6. Proxy URL
7. Mapping rules
8. Semantic toggles + warning

## 5) Luong hanh vi
1. User vao Settings lan dau -> mo tab `Co ban`.
2. Khi bam vao `Nang cao` lan dau -> modal confirm: `Ban chi can muc nay neu hieu ro cau hinh`.
3. Neu user huy -> o lai tab `Co ban`.
4. Neu user dong y -> mo tab `Nang cao`, luu co da-xac-nhan vao local storage.

## 6) File-level implementation

### `options.html`
1. Sap xep lai nav tabs theo IA moi.
2. Chuyen field nang cao vao 1 section duy nhat.
3. Them modal confirm truoc khi vao tab nang cao.
4. Them helper text duoi moi section co ban.

### `options.js`
1. Them state `atom_options_advanced_confirmed` trong `chrome.storage.local`.
2. Guard click tab `advanced` theo flow confirm.
3. Preset setup nhanh (optional): `Mac dinh de xuat` ap dung 1 bo setting an toan.
4. Dam bao restore tab khong vuot qua guard neu chua confirmed.

### `_locales/en/messages.json` and `_locales/vi/messages.json`
1. Them key cho label `Co ban`, `Nang cao`, modal confirm, helper text.
2. Cap nhat key cu de khop ten moi neu can.

## 7) Data va migration
1. Khong doi key storage hien co.
2. Chi them key moi:
- `atom_options_advanced_confirmed: boolean`
3. Neu key khong ton tai -> mac dinh `false`.

## 8) Test plan

### 8.1 Functional
1. User moi mo settings -> tab `Co ban`.
2. Click `Nang cao` khi chua confirm -> hien modal.
3. Confirm -> mo dung tab, khong mat du lieu da nhap.
4. Reload page -> giu trang thai confirmed.

### 8.2 Regression
1. Save settings van ghi dung key cu.
2. Provider toggle (Gemini/OpenRouter) van hoat dong.
3. Debug section van an khi `BUILD_FLAGS.DEBUG=false`.

### 8.3 Accessibility
1. Modal confirm co focus trap.
2. ESC dong modal.
3. Tab order dung.

## 9) Acceptance criteria
1. Tab `Co ban` co toi da 6 quyet dinh setup.
2. Tab `Nang cao` khong tu dong mo cho user moi neu chua confirm.
3. Khong regression cho luong save/load settings.
4. QA checklist pass tren EN va VI.

## 10) Rui ro va rollback
Rui ro:
1. Sap xep lai layout co the lam user cu khong quen.
2. Restore last tab co the xung dot voi guard nang cao.

Giam thieu:
1. Them helper text va thong diep huong dan.
2. Thu nghiem voi 2 profile user (moi va cu).

Rollback:
1. Giu commit tach rieng cho IA va logic guard.
2. Co the tat guard va quay lai nav cu nhanh.

## 11) Estimate
1. Dev: 1.5 ngay.
2. QA: 0.5 ngay.
3. Tong: 2 ngay.
