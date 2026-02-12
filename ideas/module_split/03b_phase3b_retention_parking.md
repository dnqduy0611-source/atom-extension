# Phase 3b: Retention Loop + Parking Lot (~524 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** Phase 1 (State Bus), Phase 3a (`SP.createUndoableAction`)  
**Status:** Planning  
**Risk:** 🟡 Trung bình  
**Effort:** 3-4 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tách 2 hệ thống feature-heavy:
- **Retention Loop** (~355 lines) — Quiz, Teach-back, Flashcard flows + overlay
- **Parking Lot** (~169 lines) — notes CRUD, promote-to-thread, park thread

> [!NOTE]
> Parking Lot phụ thuộc `SP.createUndoableAction` từ Phase 3a, nên Phase 3a **phải** hoàn thành trước.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_retention.js` | **NEW** | ~370 lines — retention overlay + quiz/teachback/flashcard |
| `sp_parking.js` | **NEW** | ~185 lines — parking lot CRUD + promote + park thread |
| `sidepanel.html` | **MODIFY** | +2 lines — thêm `<script>` tags |
| `sidepanel.js` | **MODIFY** | -524 lines, +12 lines — remove code, add SP calls |

---

## 3. Module: `sp_retention.js` (NEW)

### 3a. Code cần extract từ `sidepanel.js`

**State variables** (line 24):
```
retentionOverlay = null  (mutable)
```

**Functions** (lines 1972-2326):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `getRetentionStrings` | 1975-1983 | Internal — gọi `SP.getMessage` |
| `getQuizStrings` | 1985-2001 | Internal |
| `getTeachBackStrings` | 2003-2016 | Internal |
| `getFlashcardStrings` | 2018-2029 | Internal |
| `closeRetentionOverlay` | 2031-2036 | Internal |
| `createRetentionOverlay` | 2038-2069 | Internal |
| `renderRetentionLoading` | 2071-2076 | Internal |
| `appendHistory` | 2078-2088 | Internal — chrome.storage |
| `updateComprehensionScore` | 2090-2108 | Internal — external services |
| `openRetentionFlow` | 2110-2134 | **Expose qua SP** |
| `startQuizFlow` | 2136-2213 | Internal — gọi `callGeminiAPI` |
| `startTeachBackFlow` | 2215-2286 | Internal — gọi `callGeminiAPI` |
| `startFlashcardFlow` | 2288-2326 | Internal |

### 3b. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.getMessage(key, fb)       // i18n (nhiều)
SP.getIcon(name)             // icons
SP.showToast(msg, type)      // feedback
SP.getApiKey()               // API key
SP.callGeminiAPI             // LLM call (CẦN EXPOSE THÊM)
SP.pageContext               // page title/url
SP.activeSessionId           // session tracking
```

**External window services** (đọc trực tiếp, không qua SP):
```
window.QuizGeneratorService   // quiz generation
window.QuizUI                 // quiz UI
window.TeachBackService       // teach-back generation  
window.TeachBackUI            // teach-back UI
window.FlashcardUI            // flashcard UI
window.FlashcardDeck          // flashcard storage
window.SpacedRepetitionService // SRS
window.ReadingSessionService  // session metrics
window.ComprehensionScoringService // scoring
```

> [!IMPORTANT]
> `callGeminiAPI` (defined ~line 5100) là core LLM function. Cần expose lên SP:
> ```javascript
> SP.callGeminiAPI = callGeminiAPI;
> ```
> Thêm vào Phase 1 wiring block.

### 3c. Public API

```javascript
if (window.SP) {
    SP.openRetentionFlow = openRetentionFlow;
    SP.closeRetentionOverlay = closeRetentionOverlay;
}
```

### 3d. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 3863 | `openRetentionFlow(highlight.retentionAction, highlight);` | `SP.openRetentionFlow?.(highlight.retentionAction, highlight);` |

### 3e. File skeleton

```javascript
/**
 * sp_retention.js — Retention Loop (Quiz, Teach-back, Flashcard)
 * Phase 3b of Sidepanel Module Split
 * 
 * Handles: Retention overlay, quiz flow with evaluation,
 * teach-back with AI feedback, flashcard review sessions.
 * 
 * Uses external services: QuizGeneratorService, QuizUI,
 * TeachBackService, TeachBackUI, FlashcardUI, FlashcardDeck,
 * SpacedRepetitionService, ReadingSessionService, ComprehensionScoringService
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Retention] SP not found'); return; }

    // ── State ──
    let retentionOverlay = null;

    // ── String builders ──
    function getRetentionStrings() { /* ... SP.getMessage */ }
    function getQuizStrings() { /* ... */ }
    function getTeachBackStrings() { /* ... */ }
    function getFlashcardStrings() { /* ... */ }

    // ── Overlay ──
    function closeRetentionOverlay() { /* ... */ }
    function createRetentionOverlay(title) { /* ... SP.getMessage */ }
    function renderRetentionLoading(container, message) { /* ... SP.getMessage */ }

    // ── History & Scoring ──
    async function appendHistory(storageKey, entry) { /* ... chrome.storage */ }
    async function updateComprehensionScore(sessionId) { /* ... window services */ }

    // ── Flows ──
    async function openRetentionFlow(action, highlight) { /* ... SP.showToast */ }
    async function startQuizFlow(container, highlight) { /* ... SP.getApiKey, SP.callGeminiAPI */ }
    async function startTeachBackFlow(container, highlight) { /* ... SP.getApiKey, SP.callGeminiAPI */ }
    async function startFlashcardFlow(container) { /* ... window services */ }

    // ── Expose ──
    SP.openRetentionFlow = openRetentionFlow;
    SP.closeRetentionOverlay = closeRetentionOverlay;
})();
```

---

## 4. Module: `sp_parking.js` (NEW)

### 4a. Code cần extract từ `sidepanel.js`

**Functions** (lines 6700-6868):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `loadParkingLot` | 6703-6709 | **Expose qua SP** — gọi từ `init()` |
| `saveParkingLot` | 6711-6715 | Internal |
| `addToParkingLot` | 6717-6728 | **Expose qua SP** — gọi từ UI handler |
| `removeFromParkingLot` | 6730-6763 | Internal — gọi `SP.createUndoableAction` |
| `renderParkingLot` | 6765-6803 | Internal |
| `promoteFromParkingLot` | 6805-6833 | Internal — **writes `threads`, `activeThreadId`** |
| `parkCurrentThread` | 6835-6868 | **Expose qua SP** — gọi `SP.createUndoableAction` |

### 4b. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.currentDomain            // storage key
SP.parkingLot               // data (READ initial + WRITE back)
SP.threads                  // data (READ/WRITE for promote)
SP.activeThreadId           // READ/WRITE for promote
SP.pageContext              // url/title for promote
SP.elements.notesCount      // DOM badge
SP.elements.notesList       // DOM list container
SP.getMessage(key, fb)      // i18n
SP.getIcon(name)            // icons
SP.escapeHtml(text)         // HTML sanitization
SP.createUndoableAction     // undo system (Phase 3a)
SP.renderThreadList()       // UI refresh
SP.renderActiveThread()     // UI refresh
SP.saveThreadsToStorage()   // persist after promote
SP.updateSessionStats()     // stats (CẦN EXPOSE THÊM)
SP.updateAllCounts()        // counts (CẦN EXPOSE THÊM)
```

> [!WARNING]
> `promoteFromParkingLot` **writes trực tiếp** vào `threads` và `activeThreadId` — 2 biến core. Pattern giải quyết:
> ```javascript
> // sp_parking.js
> SP.threads.push(newThread);      // mutate array in-place (SP.threads là reference)
> SP.activeThreadId = newThread.id; // set trực tiếp trên SP
> ```
> Vì arrays là reference, `push` sẽ đồng thời mutate closure var trong sidepanel.js nếu đã wire đúng.

### 4c. Bổ sung SP wiring

Thêm vào wiring block:
```javascript
SP.callGeminiAPI = callGeminiAPI;
SP.saveThreadsToStorage = saveThreadsToStorage;
SP.updateSessionStats = updateSessionStats;
SP.updateAllCounts = updateAllCounts;
```

### 4d. Public API

```javascript
if (window.SP) {
    SP.loadParkingLot = loadParkingLot;
    SP.addToParkingLot = addToParkingLot;
    SP.parkCurrentThread = parkCurrentThread;
}
```

### 4e. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 1480 | `await loadParkingLot();` | `await SP.loadParkingLot?.();` |
| 3060 | `addToParkingLot(idea);` | `SP.addToParkingLot?.(idea);` |
| 3104 | `parkCurrentThread` (event listener) | `SP.parkCurrentThread` |
| 3481 | `parkCurrentThread();` | `SP.parkCurrentThread?.();` |

---

## 5. Load Order

```diff
 <script src="sp_undo.js"></script>
 <script src="sp_search.js"></script>
+<script src="sp_retention.js"></script>
+<script src="sp_parking.js"></script>
 <!-- ...other controllers... -->
 <script src="sidepanel.js"></script>
```

`sp_parking.js` sau `sp_undo.js` (dependency: `createUndoableAction`).

---

## 6. Cumulative SP wiring (sau Phase 3b)

Tổng hợp tất cả functions cần expose lên SP qua init wiring:

| Function | Cần bởi | Thêm từ Phase |
|----------|---------|---------------|
| `escapeHtml` | sp_undo, sp_search, sp_parking | 3a |
| `switchToTab` | sp_search | 3a |
| `renderThreadList` | sp_search, sp_parking | 3a |
| `renderActiveThread` | sp_search, sp_parking | 3a |
| `callGeminiAPI` | sp_retention | 3b |
| `saveThreadsToStorage` | sp_parking | 3b |
| `updateSessionStats` | sp_parking | 3b |
| `updateAllCounts` | sp_parking | 3b |

---

## 7. Xoá khỏi `sidepanel.js`

- [ ] Line 24: `let retentionOverlay = null;`
- [ ] Lines 1972-2326: Tất cả 13 retention functions
- [ ] Lines 6700-6868: Tất cả 7 parking lot functions
- [ ] Update 5 call sites → gọi qua `SP.*`
- [ ] Thêm SP wiring cho `callGeminiAPI`, `saveThreadsToStorage`, `updateSessionStats`, `updateAllCounts`

**Kết quả:** `sidepanel.js` giảm thêm ~524 lines

---

## 8. Verification Checklist

### Retention Tests

- [ ] Menu → Quiz → Overlay mở, questions generate
- [ ] Trả lời quiz → Score hiện, "Add to Review Deck" button
- [ ] Menu → Teach-back → Prompt hiện, explain + evaluate
- [ ] Menu → Flashcard → Cards hiện (nếu có), swipe/rate
- [ ] Click Close / click outside / × → Overlay đóng
- [ ] Không có highlight → Warning toast "Please select..."

### Parking Lot Tests

- [ ] Gõ note → Add → Note hiện trong Notes tab
- [ ] Click remove → Note xoá + Undo toast 5s
- [ ] Click Undo → Note phục hồi
- [ ] Click promote → Thread mới tạo, switch to Chat
- [ ] Mark Done → Thread status = parked + Undo toast
- [ ] Badge count → Cập nhật đúng khi add/remove

### Regression

- [ ] Chat flow → Bình thường
- [ ] Search (Ctrl+F) → Hoạt động (tìm thấy notes)
- [ ] Onboarding → Tooltips hoạt động
- [ ] Export → Hoạt động

---

## 9. Rollback Plan

1. Xoá 2 dòng `<script>` trong `sidepanel.html`
2. Revert `sidepanel.js` từ git
3. Reload extension
