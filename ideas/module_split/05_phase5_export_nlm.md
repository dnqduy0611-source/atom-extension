# Phase 5: Export + NLM Bridge (~825 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** Phase 1 (State Bus), Phase 2 (`SP.checkAndShowContextualTooltip`), Phase 3b (`SP.saveParkingLot`, `SP.renderParkingLot`, `SP.updateSessionStats`)  
**Status:** Planning  
**Risk:** 🟡 Trung bình  
**Effort:** 4-5 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tách 2 hệ thống liên quan:
- **NLM Bridge** (~310 lines) — Save to Knowledge, Quick Save, Bulk Export, failure handling
- **Export / Session** (~515 lines) — Export dialog, multi-format download, session summary, end session

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_export.js` | **NEW** | ~540 lines — export dialog + formatters + NLM bridge |
| `sidepanel.html` | **MODIFY** | +1 line — thêm `<script>` |
| `sidepanel.js` | **MODIFY** | -825 lines, +15 lines SP calls |

> [!NOTE]
> NLM Bridge và Export gộp vào **1 module** (`sp_export.js`) vì chúng chia sẻ nhiều logic: cùng đọc `threads`, `parkingLot`, `pageContext`, gọi `saveThreadsToStorage`, `renderThreadList`. Tách thành 2 module sẽ thêm overhead không cần thiết.

---

## 3. Code cần extract từ `sidepanel.js`

### 3a. NLM Bridge functions

| # | Function | Lines | Size | Scope |
|---|----------|-------|------|-------|
| 1 | `getNlmExportFailureToast` | 3119-3149 | 31 | Internal |
| 2 | `quickSaveHighlight` | 3155-3226 | 72 | **Expose → SP** |
| 3 | `maybeAddInsightReviewCard` | 7113-7143 | 31 | Internal |
| 4 | `saveThreadToNLM` | 7148-7225 | 78 | **Expose → SP** |
| 5 | `exportAllToNLM` | 7230-7296 | 67 | **Expose → SP** |
| 6 | `showExportAllLoading` | 7298-7305 | 8 | Internal |
| 7 | `hideExportAllLoading` | 7307-7314 | 8 | Internal |

### 3b. Export / Session functions

| # | Function | Lines | Size | Scope |
|---|----------|-------|------|-------|
| 8 | `generateSessionSummary` | 7342-7379 | 38 | Internal — **direct fetch** |
| 9 | `showExportDialog` | 7384-7495 | 112 | **Expose → SP** |
| 10 | `closeExportDialog` | 7497-7503 | 7 | Internal |
| 11 | `exportWithFormat` | 7505-7536 | 32 | Internal |
| 12 | `generateMarkdownExport` | 7538-7590 | 53 | Internal |
| 13 | `generateJsonExport` | 7592-7634 | 43 | Internal |
| 14 | `generateTextExport` | 7636-7686 | 51 | Internal |
| 15 | `downloadFile` | 7688-7698 | 11 | Internal |
| 16 | `exportSession` | 7701-7788 | 88 | Internal — legacy, called by `endSession` |
| 17 | `downloadMarkdown` | 7790-7800 | 11 | Internal — legacy duplicate of `downloadFile` |
| 18 | `showExportLoading` | 7802-7809 | 8 | Internal |
| 19 | `hideExportLoading` | 7811-7818 | 8 | Internal |
| 20 | `endSession` | 7820-7864 | 45 | **Expose → SP** |

**Total: 20 functions, ~825 lines**

---

## 4. Dependencies (đọc từ SP)

### State refs
```javascript
SP.threads                     // READ — export content
SP.activeThreadId              // READ — saveThreadToNLM
SP.parkingLot                  // READ — export notes
SP.pageContext                 // READ — url, title, content
SP.currentDomain               // READ — JSON export
SP.sessionStartTime            // READ — session duration (CẦN EXPOSE)
SP.API_CONFIG                  // READ — generateSessionSummary (direct fetch)
SP.elements.emptyState         // endSession UI reset
SP.elements.currentHighlight   // endSession UI reset
SP.elements.messages           // endSession UI reset
```

### Functions từ SP
```javascript
SP.getMessage(key, fb)         // i18n (rất nhiều)
SP.getApiKey()                 // generateSessionSummary
SP.showToast(msg, type)        // feedback
SP.saveThreadsToStorage()      // sau save/export
SP.renderThreadList()          // sau save/export
SP.updateSessionStats()        // Phase 3b — sau save
SP.saveParkingLot()            // Phase 3b — endSession (CẦN EXPOSE)
SP.renderParkingLot()          // Phase 3b — endSession (CẦN EXPOSE)
SP.checkAndShowContextualTooltip() // Phase 2 — sau first_save
```

### External APIs
```javascript
chrome.runtime.sendMessage({ type: 'ATOM_SAVE_THREAD_TO_NLM', ... })  // NLM background
chrome.runtime.sendMessage({ type: 'SRQ_CREATE_CARD', ... })          // SRQ background
window.FlashcardDeck           // maybeAddInsightReviewCard
```

---

## 5. SP wiring cần thêm trong `sidepanel.js`

```javascript
// Phase 5 wiring — trong init()
SP.sessionStartTime = sessionStartTime;  // hoặc getter
```

Thêm vào Phase 3b wiring nếu chưa có:
```javascript
SP.saveParkingLot = saveParkingLot;
SP.renderParkingLot = renderParkingLot;
```

> [!IMPORTANT]
> `endSession` ghi `threads = []`, `parkingLot = []`, `activeThreadId = null`, `sessionStartTime = Date.now()`. Phải cẩn thận với array reassignment:
> ```javascript
> // sp_export.js — endSession()
> SP.threads.length = 0;       // clear in-place (giữ reference)
> SP.parkingLot.length = 0;    // clear in-place
> SP.activeThreadId = null;
> SP.sessionStartTime = Date.now();
> ```

---

## 6. Public API

```javascript
if (window.SP) {
    // NLM Bridge
    SP.saveThreadToNLM = saveThreadToNLM;
    SP.quickSaveHighlight = quickSaveHighlight;
    SP.exportAllToNLM = exportAllToNLM;
    
    // Export
    SP.showExportDialog = showExportDialog;
    SP.endSession = endSession;
    SP.exportSession = exportSession;
}
```

---

## 7. Call sites cần update trong `sidepanel.js`

### Event listener registrations

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 2808 | `getElementById('menu-download')?.addEventListener('click', showExportDialog)` | `...addEventListener('click', () => SP.showExportDialog?.())` |
| 2809 | `getElementById('menu-save-all')?.addEventListener('click', exportAllToNLM)` | `...addEventListener('click', () => SP.exportAllToNLM?.())` |
| 2814 | `getElementById('menu-finish')?.addEventListener('click', endSession)` | `...addEventListener('click', () => SP.endSession?.())` |
| 3116 | `getElementById('btn-save-insight')?.addEventListener('click', saveThreadToNLM)` | `...addEventListener('click', () => SP.saveThreadToNLM?.())` |

### Direct function calls

| Line | Context | Update |
|------|---------|--------|
| Quick Save button handler | `quickSaveHighlight()` | `SP.quickSaveHighlight?.()` |

---

## 8. Rủi ro và giải pháp

### 8a. `generateSessionSummary` dùng direct fetch

**Vấn đề:** Gọi Gemini API trực tiếp qua `fetch()` thay vì `SP.callLLMAPI`.

**Giải pháp:** Refactor để dùng `SP.callLLMAPI`:
```javascript
// Thay vì direct fetch:
const response = await SP.callLLMAPI(
    'You summarize reading sessions.',
    [{ role: 'user', parts: [{ text: prompt }] }],
    { priority: 'background', generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } }
);
```
Nếu muốn an toàn hơn, giữ direct fetch nhưng dùng `SP.API_CONFIG` và `SP.getApiKey()`.

### 8b. `endSession` clears core state

**Vấn đề:** Reassigns `threads = []`, `parkingLot = []`, `activeThreadId = null`.

**Giải pháp:** Dùng `length = 0` để clear in-place (giữ reference cho SP sync). Với `activeThreadId` và `sessionStartTime`, set trực tiếp trên SP.

### 8c. `endSession` gọi `saveParkingLot` và `renderParkingLot`

**Vấn đề:** Hai function này đã tách sang `sp_parking.js` (Phase 3b).

**Giải pháp:** Gọi qua SP:
```javascript
await SP.saveParkingLot?.();
SP.renderParkingLot?.();
```

### 8d. `saveThreadToNLM` và `quickSaveHighlight` gọi `checkAndShowContextualTooltip`

**Vấn đề:** Function này đã tách sang `sp_onboarding.js` (Phase 2).

**Giải pháp:** Đã expose qua SP: `SP.checkAndShowContextualTooltip?.('first_save')`. Hoạt động bình thường.

---

## 9. File skeleton

```javascript
/**
 * sp_export.js — Export System + NLM Bridge
 * Phase 5 of Sidepanel Module Split
 * 
 * Handles: Save to Knowledge (NLM), Quick Save, Bulk Export,
 * Export Dialog (Markdown/JSON/Text), Legacy Session Export,
 * End Session flow.
 * 
 * DOES NOT handle: Chat logic, thread CRUD, insight generation.
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Export] SP not found'); return; }

    // ── NLM Helpers ──
    function getNlmExportFailureToast(reason) { /* ... SP.getMessage */ }

    async function maybeAddInsightReviewCard(thread) {
        /* ... window.FlashcardDeck */
    }

    // ── NLM Bridge ──
    async function saveThreadToNLM() {
        /* Uses: SP.threads, SP.activeThreadId, SP.pageContext,
           chrome.runtime.sendMessage('ATOM_SAVE_THREAD_TO_NLM'),
           chrome.runtime.sendMessage('SRQ_CREATE_CARD'),
           SP.saveThreadsToStorage, SP.renderThreadList,
           SP.updateSessionStats, SP.showToast, SP.getMessage,
           SP.checkAndShowContextualTooltip */
    }

    async function quickSaveHighlight() {
        /* Similar to saveThreadToNLM but with quickSave flag */
    }

    async function exportAllToNLM() {
        /* Bulk export all unsaved threads */
    }

    function showExportAllLoading() { /* ... DOM manipulation */ }
    function hideExportAllLoading() { /* ... DOM manipulation */ }

    // ── Export Dialog ──
    function showExportDialog() {
        /* 112-line UI builder with format options and checkboxes */
    }
    function closeExportDialog() { /* ... */ }

    async function exportWithFormat(format, options) {
        /* Routes to generateMarkdown/Json/TextExport */
    }

    // ── Format Generators ──
    async function generateMarkdownExport(options, sessionDuration, exportDate) {
        /* Uses: SP.threads, SP.parkingLot, SP.pageContext */
    }
    function generateJsonExport(options, sessionDuration) {
        /* Uses: SP.threads, SP.parkingLot, SP.pageContext, SP.currentDomain */
    }
    function generateTextExport(options, sessionDuration, exportDate) {
        /* Uses: SP.threads, SP.parkingLot, SP.pageContext */
    }

    // ── Download Utilities ──
    function downloadFile(content, filename, mimeType) {
        /* Blob → URL.createObjectURL → <a> click → cleanup */
    }
    function downloadMarkdown(content, filename) {
        /* Legacy — delegates to downloadFile */
    }

    // ── Session Summary ──
    async function generateSessionSummary() {
        /* Uses: SP.getApiKey, SP.API_CONFIG or SP.callLLMAPI,
           SP.threads, SP.pageContext */
    }

    // ── Legacy Export + End Session ──
    async function exportSession() {
        /* Full markdown export with AI summary */
    }
    function showExportLoading() { /* ... */ }
    function hideExportLoading() { /* ... */ }

    async function endSession() {
        /* Uses: SP.threads, SP.parkingLot, SP.activeThreadId,
           SP.sessionStartTime, SP.saveThreadsToStorage,
           SP.saveParkingLot, SP.renderThreadList, SP.renderParkingLot,
           SP.updateSessionStats, SP.elements.* */
        // IMPORTANT: clear arrays in-place with .length = 0
    }

    // ── Expose ──
    SP.saveThreadToNLM = saveThreadToNLM;
    SP.quickSaveHighlight = quickSaveHighlight;
    SP.exportAllToNLM = exportAllToNLM;
    SP.showExportDialog = showExportDialog;
    SP.endSession = endSession;
    SP.exportSession = exportSession;
})();
```

---

## 10. Load Order

```diff
 <script src="sp_smartlink.js"></script>
+<script src="sp_export.js"></script>
 <script src="sidepanel.js"></script>
```

`sp_export.js` cần Phase 2 (`SP.checkAndShowContextualTooltip`) và Phase 3b (`SP.saveParkingLot`) — đều expose trước `sidepanel.js init()`.

---

## 11. Xoá khỏi `sidepanel.js`

- [ ] Lines 3119-3149: `getNlmExportFailureToast`
- [ ] Lines 3155-3226: `quickSaveHighlight`
- [ ] Lines 7113-7143: `maybeAddInsightReviewCard`
- [ ] Lines 7145-7296: `saveThreadToNLM`, `exportAllToNLM`
- [ ] Lines 7298-7314: `showExportAllLoading`, `hideExportAllLoading`
- [ ] Lines 7339-7818: Export system (12 functions)
- [ ] Lines 7820-7864: `endSession`
- [ ] Update ~5 event listener registrations → gọi qua `SP.*`
- [ ] Thêm SP wiring cho `sessionStartTime`

**Kết quả:** `sidepanel.js` giảm thêm ~825 lines

---

## 12. Tổng kết giảm tải toàn bộ

| Phase | Module(s) | Lines giảm |
|-------|-----------|------------|
| 1 | `sp_state.js` | +80 (thêm mới) |
| 2 | `sp_onboarding.js`, `sp_multitab.js` | -690 |
| 3a | `sp_undo.js`, `sp_search.js` | -497 |
| 3b | `sp_retention.js`, `sp_parking.js` | -524 |
| 4a | `sp_llm.js` | -585 |
| 4b | `sp_smartlink.js` | -455 |
| **5** | **`sp_export.js`** | **-825** |
| **Total** | **10 modules** | **~-3576 lines** (~44% of 8179) |

Sau tất cả phases: `sidepanel.js` giảm từ ~8179 lines → ~4600 lines (core chat, UI rendering, event handlers, init).

---

## 13. Verification Checklist

### NLM Bridge Tests

- [ ] Click Save → "Saved to Knowledge!" toast
- [ ] Save lần 2 → "Already saved today" (dedupe)
- [ ] Quick Save (chưa có insight) → "Highlight saved!"
- [ ] SRQ card tạo đúng sau save
- [ ] Export All → Confirm dialog → Success count toast
- [ ] Cloud Export disabled → Warning toast

### Export Dialog Tests

- [ ] Click Download Notes → Dialog hiện
- [ ] Select Markdown → Download `.md` file
- [ ] Select JSON → Download `.json` file
- [ ] Select Plain Text → Download `.txt` file
- [ ] Uncheck "Key Insights" → File không chứa insights
- [ ] Check "Full Chat History" → File chứa messages
- [ ] Cancel → Dialog đóng
- [ ] Click outside → Dialog đóng

### End Session Tests

- [ ] Click Finish → Confirm dialog
- [ ] Confirm → Export file downloads → Session cleared
- [ ] threads, parkingLot → rỗng
- [ ] Empty state hiện
- [ ] Highlight new text → Session hoạt động lại bình thường

### Regression (tất cả phases)

- [ ] Chat flow
- [ ] Onboarding
- [ ] Search (Ctrl+F)
- [ ] Undo
- [ ] Parking Lot
- [ ] Retention tools
- [ ] Smart Linking / Deep Angle
- [ ] Export
- [ ] Multi-tab

---

## 14. Rollback Plan

1. Xoá `<script src="sp_export.js">` khỏi `sidepanel.html`
2. Revert export/NLM code trong `sidepanel.js` từ git
3. Reload extension
