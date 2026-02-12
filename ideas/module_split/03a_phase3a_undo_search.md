# Phase 3a: Undo System + Search & Filter (~497 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** Phase 1 (State Bus), Phase 2 (indirectly)  
**Status:** Planning  
**Risk:** 🟡 Trung bình  
**Effort:** 2-3 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tách 2 hệ thống utility với coupling vừa phải:
- **Undo System** (~215 lines) — undo toast, countdown, action stack
- **Search & Filter** (~282 lines) — Ctrl+F modal, filters, keyboard nav

> [!NOTE]
> Undo phải tách trước Search vì Phase 3b (Parking Lot) phụ thuộc vào `createUndoableAction`.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_undo.js` | **NEW** | ~230 lines — undo system + constants |
| `sp_search.js` | **NEW** | ~300 lines — search modal + helpers |
| `sidepanel.html` | **MODIFY** | +2 lines — thêm `<script>` tags |
| `sidepanel.js` | **MODIFY** | -497 lines, +10 lines — remove code, add SP calls |

---

## 3. Module: `sp_undo.js` (NEW)

### 3a. Code cần extract từ `sidepanel.js`

**Constants** (lines 757-760):
```
UNDO_TIMEOUT_MS = 5000
undoStack = []           (mutable)
activeUndoToast = null   (mutable)
toastTimeoutId = null    (mutable — note: shared with showToast!)
```

> [!WARNING]
> `toastTimeoutId` được dùng bởi cả `showToast()` (line 7316) và undo toast. Cần tách thành 2 biến riêng: `undoToastTimeoutId` (trong sp_undo.js) và `toastTimeoutId` (giữ trong sidepanel.js).

**Functions** (lines 6352-6566):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `createUndoableAction` | 6366-6390 | **Expose qua SP** — gọi bởi Parking Lot (3 call sites) |
| `showUndoToast` | 6392-6448 | Internal — gọi `escapeHtml()` |
| `startCountdownAnimation` | 6450-6482 | Internal |
| `undoAction` | 6484-6507 | Internal — gọi `SP.getMessage`, `SP.showToast` |
| `commitAction` | 6509-6525 | Internal |
| `cancelActiveUndo` | 6527-6543 | **Expose qua SP** |
| `hideUndoToast` | 6545-6555 | Internal |
| `undoLastAction` | 6557-6566 | **Expose qua SP** — gọi bởi Ctrl+Z handler |

### 3b. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.getMessage(key, fb)    // i18n
SP.showToast(msg, type)   // feedback toast
SP.escapeHtml(text)       // HTML sanitization (cần expose thêm)
```

> [!IMPORTANT]
> `escapeHtml()` (line 6605) là shared utility dùng bởi 14+ chỗ. Cần expose lên `SP.escapeHtml` trong Phase 1 wiring. **Không move**, chỉ expose.

### 3c. Public API

```javascript
if (window.SP) {
    SP.createUndoableAction = createUndoableAction;
    SP.undoLastAction = undoLastAction;
    SP.cancelActiveUndo = cancelActiveUndo;
}
```

### 3d. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 3506 | `undoLastAction();` | `SP.undoLastAction?.();` |
| 6663 | `createUndoableAction(...)` | `SP.createUndoableAction?.(...)` |
| 6743 | `createUndoableAction(...)` | `SP.createUndoableAction?.(...)` |
| 6848 | `createUndoableAction(...)` | `SP.createUndoableAction?.(...)` |

### 3e. File skeleton

```javascript
/**
 * sp_undo.js — Undo System
 * Phase 3a of Sidepanel Module Split
 * 
 * Handles: Undo toast with countdown, action stack,
 * auto-commit after timeout, undoLastAction (Ctrl+Z).
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Undo] SP not found'); return; }

    // ── Constants ──
    const UNDO_TIMEOUT_MS = 5000;

    // ── State ──
    let undoStack = [];
    let activeUndoToast = null;

    // ── Functions ──
    function createUndoableAction(type, message, data, undoFn, commitFn = null) { /* ... */ }
    function showUndoToast(action) { /* ... uses SP.escapeHtml, SP.getMessage */ }
    function startCountdownAnimation(action) { /* ... */ }
    function undoAction(action) { /* ... uses SP.getMessage, SP.showToast */ }
    function commitAction(action) { /* ... */ }
    function cancelActiveUndo() { /* ... */ }
    function hideUndoToast() { /* ... */ }
    function undoLastAction() { /* ... uses SP.showToast, SP.getMessage */ }

    // ── Expose ──
    SP.createUndoableAction = createUndoableAction;
    SP.undoLastAction = undoLastAction;
    SP.cancelActiveUndo = cancelActiveUndo;
})();
```

---

## 4. Module: `sp_search.js` (NEW)

### 4a. Code cần extract từ `sidepanel.js`

**State variables** (lines 1303-1307):
```
searchQuery = ''       (mutable)
activeFilter = 'all'   (mutable)
isSearchOpen = false   (mutable)
```

**Functions** (lines 2473-2754):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `toggleQuickSearch` | 2476-2482 | **Expose qua SP** — gọi bởi Ctrl+F |
| `openQuickSearch` | 2484-2564 | Internal |
| `closeQuickSearch` | 2566-2574 | Internal |
| `performSearch` | 2576-2656 | Internal — đọc `SP.threads`, `SP.parkingLot` |
| `applyFilters` | 2658-2675 | Internal |
| `highlightMatch` | 2677-2683 | Internal — gọi `SP.escapeHtml` |
| `escapeRegex` | 2685-2687 | Internal (standalone utility) |
| `formatRelativeTime` | 2689-2703 | Internal — gọi `SP.getMessage` |
| `navigateSearchResults` | 2705-2721 | Internal |
| `selectSearchResult` | 2723-2730 | Internal |
| `handleSearchResultClick` | 2732-2754 | Internal — gọi core UI functions |

### 4b. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.threads              // data source
SP.parkingLot           // data source
SP.getMessage(key, fb)  // i18n
SP.getIcon(name)        // icons
SP.escapeHtml(text)     // HTML sanitization
SP.switchMainTab(name)  // navigation
SP.switchToTab(name)    // tab switching (cần expose thêm)
SP.renderThreadList()   // UI refresh (cần expose thêm)
SP.renderActiveThread() // UI refresh (cần expose thêm)
SP.activeThreadId       // write — sẽ set khi user click result
```

> [!IMPORTANT]
> `handleSearchResultClick` gọi 4 core UI functions: `switchMainTab`, `switchToTab`, `renderThreadList`, `renderActiveThread`. Cần expose tất cả qua SP. Cũng set `activeThreadId` trực tiếp — cần thêm setter sync.

### 4c. Bổ sung SP wiring (trong Phase 1 hoặc trước Phase 3a)

Thêm vào block wiring cuối `init()`:
```javascript
// Core UI functions cần bởi modules
SP.switchToTab = switchToTab;
SP.renderThreadList = renderThreadList;
SP.renderActiveThread = renderActiveThread;
SP.escapeHtml = escapeHtml;
```

Set `activeThreadId` cần sync:
```javascript
// sp_search.js handleSearchResultClick:
SP.activeThreadId = id;      // set on SP
// sidepanel.js cần đọc lại SP.activeThreadId sau khi render
```

### 4d. Public API

```javascript
if (window.SP) {
    SP.toggleQuickSearch = toggleQuickSearch;
    SP.closeQuickSearch = closeQuickSearch;
}
```

### 4e. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 3499 | `toggleQuickSearch();` | `SP.toggleQuickSearch?.();` |

### 4f. File skeleton

```javascript
/**
 * sp_search.js — Quick Search & Filter System
 * Phase 3a of Sidepanel Module Split
 * 
 * Handles: Ctrl+F search modal, filter buttons,
 * keyboard nav, result clicks → thread/note switching.
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Search] SP not found'); return; }

    // ── State ──
    let searchQuery = '';
    let activeFilter = 'all';
    let isSearchOpen = false;

    // ── Functions ──
    function toggleQuickSearch() { /* ... */ }
    function openQuickSearch() { /* ... uses SP.getMessage, SP.getIcon */ }
    function closeQuickSearch() { /* ... */ }
    function performSearch() { /* ... reads SP.threads, SP.parkingLot */ }
    function applyFilters(items) { /* ... */ }
    function highlightMatch(text, query) { /* ... uses SP.escapeHtml */ }
    function escapeRegex(string) { /* ... */ }
    function formatRelativeTime(timestamp) { /* ... uses SP.getMessage */ }
    function navigateSearchResults(direction) { /* ... */ }
    function selectSearchResult() { /* ... */ }
    function handleSearchResultClick(type, id) {
        closeQuickSearch();
        if (type === 'thread') {
            SP.activeThreadId = id;
            SP.switchMainTab?.('chat', false);
            SP.switchToTab?.('discussions');
            SP.renderThreadList?.();
            SP.renderActiveThread?.();
        } else if (type === 'note') {
            SP.switchMainTab?.('notes', false);
            SP.switchToTab?.('notes');
            // highlight note...
        }
    }

    // ── Expose ──
    SP.toggleQuickSearch = toggleQuickSearch;
    SP.closeQuickSearch = closeQuickSearch;
})();
```

---

## 5. Load Order

```diff
 <script src="sp_state.js"></script>
 <!-- ...services... -->
 <script src="sp_onboarding.js"></script>
 <script src="sp_multitab.js"></script>
+<script src="sp_undo.js"></script>
+<script src="sp_search.js"></script>
 <!-- ...other controllers... -->
 <script src="sidepanel.js"></script>
```

`sp_undo.js` trước `sp_search.js` (không dependency, nhưng logic ordering).

---

## 6. Bổ sung SP wiring cần thiết

Những functions/utilities cần expose thêm lên `SP` **trước** Phase 3a:

| Function | Defined at | Cần bởi |
|----------|-----------|---------|
| `escapeHtml` | line 6605 | sp_undo, sp_search |
| `switchToTab` | line 3558 | sp_search |
| `renderThreadList` | line 4497 | sp_search |
| `renderActiveThread` | line 4646 | sp_search |

Thêm vào Phase 1 wiring block:
```javascript
SP.escapeHtml = escapeHtml;
SP.switchToTab = switchToTab;
SP.renderThreadList = renderThreadList;
SP.renderActiveThread = renderActiveThread;
```

---

## 7. Xoá khỏi `sidepanel.js`

- [ ] Lines 757-760: `UNDO_TIMEOUT_MS`, `undoStack`, `activeUndoToast` (giữ `toastTimeoutId`)
- [ ] Lines 1303-1307: `searchQuery`, `activeFilter`, `isSearchOpen`
- [ ] Lines 6352-6566: Tất cả 8 undo functions
- [ ] Lines 2473-2754: Tất cả 11 search functions
- [ ] Update 5 call sites → gọi qua `SP.*`
- [ ] Thêm SP wiring cho 4 functions mới

**Kết quả:** `sidepanel.js` giảm thêm ~497 lines

---

## 8. Verification Checklist

### Undo Tests

- [ ] Xoá thread → Undo toast hiện với countdown 5s
- [ ] Click Undo trước hết timeout → Thread phục hồi
- [ ] Để hết timeout → Action committed, toast biến mất
- [ ] Ctrl+Z → Undo action gần nhất
- [ ] Ctrl+Z khi không có action → "Nothing to undo" toast
- [ ] Xoá thread nhanh liên tiếp → Undo trước committed ngay

### Search Tests

- [ ] Ctrl+F → Search modal mở
- [ ] Gõ text → Results hiện real-time
- [ ] Click filter buttons (Today/Week/Insights/Notes) → Filter hoạt động
- [ ] Arrow Up/Down → Navigate giữa results
- [ ] Enter → Select result, switch to đúng tab
- [ ] Click thread result → Switch to Chat, hiện đúng thread
- [ ] Click note result → Switch to Notes, highlight note
- [ ] Esc → Đóng modal
- [ ] Click outside → Đóng modal

### Regression

- [ ] Chat hoạt động bình thường
- [ ] Parking Lot — park thread → Undo works
- [ ] Export → Hoạt động
- [ ] Onboarding tooltips → Hoạt động

---

## 9. Rollback Plan

1. Xoá 2 dòng `<script>` trong `sidepanel.html`
2. Revert `sidepanel.js` từ git
3. Reload extension
