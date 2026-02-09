# Non-Tech Friendly Wave 3 Spec

## 1) Muc tieu va pham vi
Wave 3 dong bo i18n de khong con fallback ngon ngu khong mong muon cho user VI.

Muc tieu dinh luong:
1. Key parity: `missing in vi = 0` so voi EN.
2. 100% man hinh chinh khong xuat hien fallback English khi locale la VI.
3. Co cong cu check tu dong de chan missing key trong cac PR sau.

Pham vi:
- `_locales/vi/messages.json`
- `_locales/en/messages.json` (neu can bo sung key nguon)
- Them script check i18n (de xuat)

## 2) Baseline hien tai
1. EN: 755 keys.
2. VI: 488 keys.
3. Missing in VI: 267 keys.
4. Khong co gate tu dong trong repo de bao loi missing key.

## 3) Non-goals
1. Khong thay doi logic runtime.
2. Khong doi locale strategy cua manifest.
3. Khong chinh sua noi dung marketing ngoai scope extension UI.

## 4) Chuan hoa i18n

### 4.1 Nguon su that
1. EN la source of truth cho key set.
2. VI phai mirror day du key cua EN.

### 4.2 Quy tac dat key
1. Key theo domain: `popup_*`, `opt_*`, `sp_*`, `srq_*`, `bug_*`, `focus_*`.
2. Khong tao key moi neu key cu da dung duoc.
3. Placeholder phai co `placeholders` dung ten bien.

### 4.3 Quy tac dich
1. Ngan gon, de hieu, plain-language.
2. Dong nhat thuat ngu da chot o Wave 1.
3. Khong dung viet tat kho hieu.

## 5) Ke hoach thuc thi

### 5.1 Buoc 1: Gap analysis
1. Sinh danh sach keys missing VI.
2. Nhom theo domain key de chia batch review.

### 5.2 Buoc 2: Fill missing keys
1. Them toan bo keys missing vao `vi/messages.json`.
2. Preserve placeholder shape y het EN.
3. Validate JSON syntax.

### 5.3 Buoc 3: Runtime fallback audit
1. Rasoat fallback hardcoded trong `popup.js`, `options.js`, `sidepanel.js`.
2. Neu fallback can thiet, dat fallback o EN plain-language, khong technical.

### 5.4 Buoc 4: Add parity check tool
De xuat them file script:
1. `tools/i18n/check_parity.mjs`
2. Input: EN + VI messages
3. Output:
- missing in vi
- missing in en
- placeholder mismatch
4. Exit code non-zero neu co mismatch.

## 6) File-level implementation

### `_locales/vi/messages.json`
1. Bo sung 267 key (baseline) + key moi phat sinh Wave 1-2.
2. Dam bao UTF-8 hop le.

### `_locales/en/messages.json`
1. Chot key source.
2. Bo sung key nao dang duoc goi trong code ma chua co.

### `tools/i18n/check_parity.mjs` (neu duoc phe duyet)
1. Parse JSON.
2. Compare key set.
3. Compare placeholders object shape.
4. In report gon de review.

### `README.md` hoac `spec/README.md`
1. Them 1 muc nho: cach chay i18n parity check.

## 7) Test plan

### 7.1 Static
1. Chay parity script -> missing = 0.
2. Chay parse JSON ca 2 locale -> pass.

### 7.2 Manual
1. Set Chrome locale VI.
2. Di qua popup/options/sidepanel/bug report/memory.
3. Kiem tra khong con chu English fallback o luong chinh.

### 7.3 Regression
1. Locale EN van hien dung.
2. Placeholder replacement van dung ($1, $2).

## 8) Acceptance criteria
1. `missing in vi = 0`.
2. `missing in en = 0`.
3. `placeholder mismatch = 0`.
4. QA khong ghi nhan fallback English trong 5 flow chinh.

## 9) Rui ro va rollback
Rui ro:
1. Dich nham nghia key gay kho hieu.
2. Sai placeholder gay crash text render.

Giam thieu:
1. Double review theo domain.
2. Script check placeholder shape bat buoc.

Rollback:
1. Tach commit theo domain key.
2. Revert nhanh batch key co loi.

## 10) Estimate
1. Translation + review: 1.5 ngay.
2. Tooling + doc: 0.5 ngay.
3. Tong: 2 ngay.
