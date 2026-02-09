# Non-Tech Friendly Wave 1 Spec

## 1) Muc tieu va pham vi
Wave 1 tap trung vao quick wins de giam ngon ngu ky thuat trong UI va giup user non-tech hieu ngay thao tac can lam.

Muc tieu dinh luong:
1. Giam >60% text ky thuat hien ra o luong su dung co ban.
2. 100% hanh dong nguy hiem co canh bao de hieu (khong dung tu noi bo ky thuat).
3. Tat ca error state chinh co CTA ro rang (Thu lai / Mo Cai dat / Bao loi).

Pham vi:
- Popup (`popup.html`, `popup.js`)
- Options (`options.html`, `options.js`)
- Sidepanel (`sidepanel.html`, `sidepanel.js`)
- i18n (`_locales/en/messages.json`, `_locales/vi/messages.json`)

## 2) Baseline hien tai
Bang chung baseline tu code:
1. Settings con nhieu term ky thuat: `Proxy URL`, `Model ID`, `JSON`, `TTL`, `Min Confidence`, `Timeout (ms)`.
2. Confirm reset con wording ky thuat (`machine learning data and history`).
3. Nhieu fallback text trong JS mang tinh noi bo ky thuat.
4. i18n VI thieu key so voi EN (baseline: VI 488 keys, EN 755 keys).

## 3) Non-goals
1. Khong doi architecture lon.
2. Khong doi logic AI pipeline.
3. Khong doi data schema storage.
4. Khong redesign visual style tong the.

## 4) Nguyen tac copy
1. Plain language first: uu tien tu thong dung.
2. Action-first: moi thong bao loi phai kem buoc tiep theo.
3. Safe wording: voi thao tac xoa/reset, neu ro pham vi va khong hoan tac.
4. Khong lo implementation details cho luong co ban.

## 5) Danh sach thay doi chi tiet

### 5.1 Term mapping (bat buoc)
Thay doi theo bang mapping duoi day cho UI layer:
1. `API key` -> `Ma ket noi AI`
2. `Proxy URL` -> `Dia chi ket noi tuy chon`
3. `Model ID` -> `Mau AI`
4. `Semantic Embeddings` -> `Lien ket noi dung thong minh`
5. `Semantic Search` -> `Tim noi dung lien quan`
6. `Min Confidence` -> `Muc tin cay toi thieu`
7. `Timeout (ms)` -> `Thoi gian cho toi da`
8. `Budget / day` -> `Gioi han su dung moi ngay`
9. `Cache TTL (ms)` -> `Thoi gian nho tam`
10. `JSON mapping rules` -> `Quy tac tu dong (nang cao)`

### 5.2 Popup copy
Yeu cau:
1. Text status ngan, de hieu, tranh term noi bo.
2. Confirm reset phai neu ro du lieu nao bi xoa.
3. Nut hanh dong phai la dong tu ro nghia.

Chi tiet:
1. Sua key `popup_confirm_reset` trong EN/VI.
2. Bo sung subtitle huong dan 1 cau trong popup khi lan dau mo.
3. Dong nhat thong diep loading/checking.

### 5.3 Options copy
Yeu cau:
1. Tat ca label o tab `General` va `AI` co tooltip 1 cau plain-language.
2. Field nang cao them nhan `(Nang cao)`.
3. Warning ve chi phi AI viet theo kieu user-facing.

Chi tiet:
1. Dieu chinh key i18n cho cac label ky thuat.
2. Chuan hoa hint text trong options.
3. Bo hardcoded text trong `options.html`, dung `data-i18n` day du.

### 5.4 Sidepanel copy
Yeu cau:
1. Empty state noi ro buoc bat dau.
2. Error state co CTA (`Thu lai`, `Mo Cai dat`).
3. Quick action text dung dong tu de hieu.

Chi tiet:
1. Soat fallback text trong `sidepanel.js` va doi sang plain-language.
2. Chuan hoa thong diep toast thanh 1 style ngan gon.

## 6) File-level implementation

### `_locales/en/messages.json`
1. Cap nhat key lien quan popup reset, advanced labels, semantic labels, error desc.
2. Them key moi cho plain-language help text neu chua co.

### `_locales/vi/messages.json`
1. Mirror toan bo key EN duoc cap nhat trong Wave 1.
2. Dam bao key ten giong EN.

### `options.html`
1. Loai bo label hardcoded khong qua i18n.
2. Gan `data-i18n` cho label/hint con thieu.
3. Them note `(Nang cao)` cho block ky thuat.

### `options.js`
1. Cap nhat fallback string trong `getMessage/atomMsg` call.
2. Dam bao error state su dung copy plain-language.

### `popup.js`
1. Cap nhat luong confirm reset su dung key moi.
2. Chuan hoa loading, success, error copy theo key i18n.

### `sidepanel.js`
1. Rasoat fallback text trong onboarding, error, toast.
2. Thay fallback ky thuat bang plain-language.

## 7) Test plan

### 7.1 Unit / static
1. Khong con hardcoded ky thuat trong `options.html` (scan theo keyword list).
2. Cac key i18n moi co trong ca EN va VI.

### 7.2 Manual
1. Flow setup key AI: user non-tech doc khong can giai thich them.
2. Flow reset: user hieu ro du lieu bi xoa.
3. Flow loi API key: user thay duoc buoc tiep theo.

### 7.3 Smoke checklist
1. Popup mo khong loi i18n.
2. Options load du text o 2 ngon ngu.
3. Sidepanel empty/error state hien dung thong diep.

## 8) Acceptance criteria
1. Khong con 10 term ky thuat trong danh sach mapping xuat hien o luong co ban.
2. 100% error state chinh co CTA.
3. 100% text moi thong qua i18n keys (khong hardcoded tieng tron trong HTML).
4. Reviewer non-tech co the mo extension va hieu luong setup trong <=2 phut (test nhanh noi bo).

## 9) Rui ro va rollback
Rui ro:
1. Doi copy co the lam lech nghia ky thuat.
2. Mat key i18n gay fallback sai ngon ngu.

Giam thieu:
1. Checklist term mapping + review doi chieu voi logic that.
2. Script check key parity EN/VI cho scope Wave 1.

Rollback:
1. Tach commit theo tung file i18n/UI.
2. Neu regression, rollback tung commit copy khong dung.

## 10) Estimate
1. Dev: 1 ngay.
2. QA + copy review: 0.5 ngay.
3. Tong: 1.5 ngay.
