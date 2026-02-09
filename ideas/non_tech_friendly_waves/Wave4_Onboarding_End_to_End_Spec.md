# Non-Tech Friendly Wave 4 Spec

## 1) Muc tieu va pham vi
Wave 4 toi uu onboarding end-to-end cho user non-tech tu lan mo dau den hanh dong gia tri dau tien.

Muc tieu dinh luong:
1. Time-to-first-value <= 90s.
2. Ty le user hoan thanh hanh dong dau tien >= 85% trong test noi bo.
3. Giam so buoc mo ho trong onboarding xuong <=3 buoc.

Pham vi:
- `popup.html`, `popup.js`
- `sidepanel.html`, `sidepanel.js`
- i18n onboarding keys

## 2) Baseline hien tai
1. Sidepanel da co onboarding (welcome + guide + tooltip).
2. Popup chua dieu huong ro sang sidepanel theo ngu canh user moi.
3. Onboarding va error recovery chua thong nhat thong diep.

## 3) Non-goals
1. Khong thay doi core logic AI response.
2. Khong thay doi SRQ architecture.
3. Khong them permission moi.

## 4) Luong onboarding de xuat

### 4.1 Entry point
1. Neu user chua onboard -> popup hien banner `Bat dau trong 1 phut`.
2. CTA chinh: `Mo thanh ben`.

### 4.2 Guided first task
Trong sidepanel:
1. Buoc 1: `Boi den 1 doan van ngan`.
2. Buoc 2: `Nhan Tom tat`.
3. Buoc 3: `Nhan Luu`.

### 4.3 Completion
1. Hien toast `Ban da hoan thanh thiet lap co ban`.
2. Luu moc `onboarding_completed_at`.

## 5) State machine onboarding
State de xuat trong `chrome.storage.local`:
1. `not_started`
2. `started`
3. `first_highlight_done`
4. `first_ai_reply_done`
5. `first_save_done`
6. `completed`

Rule:
1. Moi transition la monotonic, khong lui.
2. Neu state = completed -> khong show overlay lan nua.

## 6) File-level implementation

### `popup.html` and `popup.js`
1. Them onboarding card gon cho user moi.
2. Them CTA mo sidepanel theo active tab.
3. Khi user da completed, an onboarding card.

### `sidepanel.js`
1. Hop nhat logic welcome/guide/tooltip vao state machine moi.
2. Trigger tooltip theo event that (highlight sent, AI replied, saved).
3. Them nut `Bo qua huong dan` co confirm nhe.

### `sidepanel.html`
1. Them placeholder region cho onboarding progress.
2. Dam bao ARIA role cho overlay va tooltip.

### `_locales/en/messages.json`, `_locales/vi/messages.json`
1. Them key cho onboarding card popup.
2. Them key cho progress labels `Buoc 1/3`, `Buoc 2/3`, `Buoc 3/3`.
3. Them key cho completion text.

## 7) UX chi tiet
1. Muc tieu moi buoc viet 1 cau, 1 dong tu.
2. Khong hien qua 1 tooltip tai cung thoi diem.
3. Neu user gap loi API key, flow dieu huong ve Settings bang CTA ro rang.
4. Co `Skip` nhung thong bao user co the mo lai huong dan trong menu.

## 8) Test plan

### 8.1 Functional
1. User moi mo popup -> thay onboarding card.
2. Bam CTA -> mo sidepanel dung tab.
3. Hoan thanh 3 buoc -> state `completed`.
4. Reload -> khong show onboarding lai.

### 8.2 Negative
1. Khong co API key -> hien huong dan mo settings, khong dead-end.
2. Mat mang -> thong bao va cho retry.

### 8.3 Accessibility
1. Tooltip/coachmark keyboard accessible.
2. ESC dong overlay.
3. Focus return dung vi tri sau khi dong overlay.

## 9) Acceptance criteria
1. Hoan thanh 3 buoc onboarding khong can doc tai lieu ngoai.
2. Time-to-first-value <= 90s trong test noi bo.
3. Khong bug lap tooltip/overlay.
4. State machine luu dung va khong reset sai.

## 10) Rui ro va rollback
Rui ro:
1. Overlay qua nhieu co the gay phien user cu.
2. Conflict voi onboarding cu dang ton tai.

Giam thieu:
1. Gate theo user moi (state not_started).
2. Feature flag cho onboarding v2.

Rollback:
1. Tat feature flag -> quay ve onboarding cu.
2. Khong dong vao core chat/save flow de rollback an toan.

## 11) Estimate
1. Dev: 2 ngay.
2. QA: 0.5 ngay.
3. Tong: 2.5 ngay.
