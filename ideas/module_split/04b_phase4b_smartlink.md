# Phase 4b: Smart Linking + Deep Angle (~455 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** Phase 1 (State Bus), Phase 3a (`SP.escapeHtml`), **Phase 4a** (`SP.callLLMAPI`)  
**Status:** Planning  
**Risk:** 🔴 Cao  
**Effort:** 3-4 giờ  
**Date:** 2026-02-11

> [!CAUTION]
> Module này có nhiều cross-dependencies: đọc/ghi `threads`, gọi chat functions (`sendToGemini`, `addMessageToDOM`), và dùng direct fetch trong `detectConnections`. Phải verify Phase 4a hoạt động ổn trước khi bắt đầu 4b.

---

## 1. Mục tiêu

Tách **Smart Linking System** — Deep Angle generation, semantic candidate selection, connection detection, connection UI rendering — thành module riêng.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_smartlink.js` | **NEW** | ~470 lines — smart linking + Deep Angle |
| `sidepanel.html` | **MODIFY** | +1 line — thêm `<script>` |
| `sidepanel.js` | **MODIFY** | -455 lines, +12 lines SP calls |

---

## 3. Code cần extract từ `sidepanel.js`

### 3a. State variables

| Variable | Line | Type | Ghi chú |
|----------|------|------|---------|
| `smartLinkMetrics` | 47-54 | Const object (mutable counters) | 6 metric fields |
| `deepAngleByUrl` | ~40 | `new Map()` | Per-URL Deep Angle cache |

### 3b. Functions (14 items)

| # | Function | Lines | Size | Scope |
|---|----------|-------|------|-------|
| 1 | `recordSmartLinkMetric` | 1553-1558 | 6 | Internal |
| 2 | `getDeepAngleCacheKey` | 3870-3875 | 6 | Internal |
| 3 | `getCurrentDeepAngleKey` | 3877-3879 | 3 | Internal |
| 4 | `updateDeepAngleUI` | 3881-3902 | 22 | **Expose → SP** |
| 5 | `setDeepAngleLoading` | 3904-3919 | 16 | Internal |
| 6 | `generateDeepAngleFromConnections` | 3921-4011 | 91 | **Expose → SP** |
| 7 | `getSemanticCandidateThreads` | 4013-4087 | 75 | Internal |
| 8 | `analyzeConnections` | 4088-4150 | 63 | **Expose → SP** |
| 9 | `detectConnections` | 4152-4330 | 179 | Internal — **direct fetch** |
| 10 | `showConnectionsLoading` | 4332-4335 | 4 | Internal |
| 11 | `hideConnectionsLoading` | 4337-4339 | 3 | Internal |
| 12 | `renderConnections` | 4341-4345 | 5 | Internal |
| 13 | `handleConnectionAction` | 4347-4389 | 43 | **Expose → SP** |
| 14 | `renderConnectionsList` | 4838-4882 | 45 | **Expose → SP** |

---

## 4. Dependencies (đọc từ SP)

### State refs
```javascript
SP.threads                     // READ/WRITE (merge mutates array)
SP.activeThreadId              // READ/WRITE (connection click)
SP.pageContext                 // READ (url, title)
SP.currentDomain               // READ
SP.API_CONFIG                  // READ (model, cache TTLs)
SP.semanticFlags               // READ (embedding feature flags)
```

### DOM refs
```javascript
SP.elements.deepAngleBtn       // Deep Angle button
SP.elements.deepAngleOutput    // Deep Angle output container
SP.elements.deepAngleText      // Deep Angle text
SP.elements.deepAngleStatus    // Deep Angle status text
SP.elements.connectionsList    // Connections list container
```

### Functions từ SP
```javascript
SP.callLLMAPI(...)             // Phase 4a
SP.getApiKey()                 // Phase 1
SP.getMessage(key, fb)         // Phase 1
SP.getIcon(name)               // Phase 1
SP.showToast(msg, type)        // Phase 1
SP.escapeHtml(text)            // Phase 3a
SP.saveThreadsToStorage()      // Phase 3b
SP.renderThreadList()          // Phase 3a
SP.renderActiveThread()        // Phase 3a
SP.updateAllCounts()           // Phase 3b
SP.hashString(input)           // CẦN EXPOSE THÊM
SP.normalizeUrl(value)         // CẦN EXPOSE THÊM
SP.formatMessage(text)         // CẦN EXPOSE THÊM
SP.addMessageToDOM(msg, role)  // CẦN EXPOSE THÊM
SP.sendToGemini(msg, thread)   // CẦN EXPOSE THÊM
```

### External window services
```
window.SemanticSearchService   // embedding search
window.EmbeddingService        // embeddings
window.VectorStore             // vector storage
window.RateLimitManager        // rate limiting (detectConnections)
window.__ATOM_RATE_MANAGER__   // singleton
window.i18nUtils               // effective language
window.parseRetryAfterSeconds  // retry-after parsing
```

---

## 5. SP wiring cần thêm trong `sidepanel.js`

```javascript
// Phase 4b wiring — trong init()
SP.hashString = hashString;
SP.normalizeUrl = normalizeUrl;
SP.formatMessage = formatMessage;
SP.addMessageToDOM = addMessageToDOM;
SP.sendToGemini = sendToGemini;
```

> [!IMPORTANT]
> `addMessageToDOM` và `sendToGemini` là **core chat functions**. Chúng **không di chuyển** — chỉ expose reference lên SP để `handleConnectionAction('compare')` gọi được.

---

## 6. Public API

```javascript
if (window.SP) {
    SP.updateDeepAngleUI = updateDeepAngleUI;
    SP.analyzeConnections = analyzeConnections;
    SP.renderConnectionsList = renderConnectionsList;
    SP.handleConnectionAction = handleConnectionAction;
    SP.generateDeepAngleFromConnections = generateDeepAngleFromConnections;
}
```

---

## 7. Call sites cần update trong `sidepanel.js`

### `updateDeepAngleUI` (7+ call sites)

| Line | Context | Update |
|------|---------|--------|
| 4852 | `renderConnectionsList` → đã tách cùng module | Không cần |
| 4881 | `renderConnectionsList` → đã tách cùng module | Không cần |
| 4938 | `loadPageContext` → sau khi load xong | `SP.updateDeepAngleUI?.()` |
| 8015 | Deep Angle button click handler | `SP.updateDeepAngleUI?.()` |
| 8026 | Deep Angle refresh | `SP.updateDeepAngleUI?.()` |

### `analyzeConnections` (1 call site)

| Line | Context | Update |
|------|---------|--------|
| 3856 | `handleNewHighlight` — sau khi tạo thread mới | `SP.analyzeConnections?.(thread)` |

### `renderConnectionsList` (2 call sites ngoài module)

| Line | Context | Update |
|------|---------|--------|
| 4698 | `renderActiveThread` — khi render thread detail | `SP.renderConnectionsList?.()` |

### `handleConnectionAction` 

Gọi từ inline event listeners trong `renderActiveThread` — cần update references.

---

## 8. Rủi ro và giải pháp

### 8a. `detectConnections` dùng direct fetch

**Vấn đề:** Function này gọi Gemini API qua `fetch()` thay vì `SP.callLLMAPI`, kèm tự quản lý RateLimitManager và cần `responseMimeType: "application/json"`.

**Giải pháp:** **Giữ nguyên** direct fetch logic trong `sp_smartlink.js`. Dùng `SP.API_CONFIG` và `SP.getApiKey()` thay cho trực tiếp. Refactor sang `SP.callGeminiAPI` ở iteration sau.

### 8b. `handleConnectionAction('merge')` reassigns threads

**Vấn đề:** `threads = threads.filter(t => t.id !== targetId)` — reassigns closure var, nhưng SP.threads là reference.

**Giải pháp:** Dùng `splice()` thay thế:
```javascript
// Thay vì:
// threads = threads.filter(t => t.id !== targetId);

// Dùng:
const idx = SP.threads.findIndex(t => t.id === targetId);
if (idx !== -1) SP.threads.splice(idx, 1);
```

### 8c. `renderConnectionsList` click handler sets `activeThreadId`

**Vấn đề:** Click connection item trực tiếp set `activeThreadId = item.dataset.threadId`.

**Giải pháp:** Dùng `SP.activeThreadId = ...` (wiring đã sync qua setter trong Phase 1).

### 8d. Timing: `SP.sendToGemini` chưa set khi IIFE chạy

**Vấn đề:** `sp_smartlink.js` IIFE chạy trước `sidepanel.js init()`. Lúc đó `SP.sendToGemini` chưa tồn tại.

**Giải pháp:** **Không thành vấn đề** — `handleConnectionAction` chỉ chạy khi user click, lúc đó `init()` đã xong và `SP.sendToGemini` đã set.

---

## 9. File skeleton

```javascript
/**
 * sp_smartlink.js — Smart Linking + Deep Angle System
 * Phase 4b of Sidepanel Module Split
 * 
 * Handles: Connection detection between highlights, Deep Angle
 * generation, semantic candidate selection, connection rendering.
 * 
 * DOES NOT handle: Core chat, message rendering, thread CRUD.
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[SmartLink] SP not found'); return; }

    // ── State ──
    const smartLinkMetrics = {
        connections_detected_count: 0,
        semantic_candidates_count: 0,
        deep_angle_generated_count: 0,
        fallback_to_recency_count: 0,
        embedding_api_errors: 0
    };
    const deepAngleByUrl = new Map();

    // ── Metrics ──
    function recordSmartLinkMetric(name, delta) {
        if (name in smartLinkMetrics) smartLinkMetrics[name] += delta;
    }

    // ── Deep Angle Helpers ──
    function getDeepAngleCacheKey(thread) {
        /* uses SP.hashString */
    }
    function getCurrentDeepAngleKey() {
        /* uses SP.normalizeUrl, SP.pageContext */
    }

    // ── Deep Angle UI ──
    function updateDeepAngleUI() {
        /* uses SP.elements.deepAngleBtn/Output/Text/Status,
           SP.getMessage, SP.pageContext, SP.formatMessage */
    }
    function setDeepAngleLoading(isLoading) {
        /* uses SP.elements.deepAngleBtn, SP.getMessage */
    }

    // ── Deep Angle Generation ──
    async function generateDeepAngleFromConnections(thread) {
        /* uses SP.callLLMAPI, SP.getApiKey, SP.showToast,
           SP.API_CONFIG, SP.saveThreadsToStorage, window.i18nUtils */
    }

    // ── Semantic Candidates ──
    async function getSemanticCandidateThreads(newThread, otherThreads) {
        /* uses SP.semanticFlags, SP.currentDomain, SP.normalizeUrl,
           window.SemanticSearchService, window.EmbeddingService, window.VectorStore */
    }

    // ── Connection Analysis ──
    async function analyzeConnections(newThread) {
        /* uses SP.threads, SP.getApiKey, SP.saveThreadsToStorage */
    }
    async function detectConnections(apiKey, newText, previousHighlights) {
        /* DIRECT FETCH — uses SP.API_CONFIG, window.RateLimitManager,
           window.i18nUtils, SP.hashString
           179 lines with robust JSON parsing */
    }

    // ── Connection UI ──
    function showConnectionsLoading() { SP.showToast?.(SP.getMessage?.('sp_analyzing', 'Analyzing...'), 'info'); }
    function hideConnectionsLoading() { /* no-op */ }
    function renderConnections(connections) {
        renderConnectionsList();
        SP.updateAllCounts?.();
    }

    function renderConnectionsList() {
        /* uses SP.threads, SP.elements.connectionsList,
           SP.getMessage, SP.escapeHtml, SP.activeThreadId,
           SP.renderThreadList, SP.renderActiveThread */
    }

    async function handleConnectionAction(action, targetId) {
        /* uses SP.threads, SP.activeThreadId,
           SP.addMessageToDOM, SP.sendToGemini (compare),
           SP.saveThreadsToStorage, SP.renderThreadList,
           SP.renderActiveThread (merge) */

        // NOTE merge: use splice() instead of filter() reassignment
    }

    // ── Expose ──
    SP.updateDeepAngleUI = updateDeepAngleUI;
    SP.analyzeConnections = analyzeConnections;
    SP.renderConnectionsList = renderConnectionsList;
    SP.handleConnectionAction = handleConnectionAction;
    SP.generateDeepAngleFromConnections = generateDeepAngleFromConnections;
})();
```

---

## 10. Load Order

```diff
 <script src="sp_llm.js"></script>
+<script src="sp_smartlink.js"></script>
 <script src="sidepanel.js"></script>
```

`sp_smartlink.js` **PHẢI** sau `sp_llm.js` (dependency: `SP.callLLMAPI`).

---

## 11. Cumulative SP wiring (sau Phase 4b)

Tổng tất cả functions expose qua Phase 1 → Phase 4b:

| Function | Source | Consumers |
|----------|--------|-----------|
| `escapeHtml` | sidepanel.js | sp_undo, sp_search, sp_parking, sp_smartlink |
| `switchToTab` | sidepanel.js | sp_search |
| `renderThreadList` | sidepanel.js | sp_search, sp_parking, sp_smartlink |
| `renderActiveThread` | sidepanel.js | sp_search, sp_parking, sp_smartlink |
| `saveThreadsToStorage` | sidepanel.js | sp_parking, sp_smartlink |
| `updateSessionStats` | sidepanel.js | sp_parking |
| `updateAllCounts` | sidepanel.js | sp_parking, sp_smartlink |
| `hashString` | sidepanel.js | sp_smartlink |
| `normalizeUrl` | sidepanel.js | sp_smartlink |
| `formatMessage` | sidepanel.js | sp_smartlink |
| `addMessageToDOM` | sidepanel.js | sp_smartlink |
| `sendToGemini` | sidepanel.js | sp_smartlink |
| `callLLMAPI` | sp_llm.js | sp_smartlink, sidepanel.js |
| `callGeminiAPI` | sp_llm.js | sp_retention, sidepanel.js |
| `ApiError` | sp_llm.js | sidepanel.js |
| `createUndoableAction` | sp_undo.js | sp_parking |

---

## 12. Xoá khỏi `sidepanel.js`

- [ ] Lines 47-54: `smartLinkMetrics` object
- [ ] Line ~40: `deepAngleByUrl` Map
- [ ] Lines 1553-1558: `recordSmartLinkMetric`
- [ ] Lines 3867-4389: Smart Linking system (13 functions, ~523 lines)
- [ ] Lines 4838-4882: `renderConnectionsList`
- [ ] Update ~10 call sites → gọi qua `SP.*`
- [ ] Thêm SP wiring cho `hashString`, `normalizeUrl`, `formatMessage`, `addMessageToDOM`, `sendToGemini`

**Kết quả:** `sidepanel.js` giảm thêm ~455 lines (tổng với 4a: ~1040 lines)

---

## 13. Verification Checklist

### Smart Linking Tests

- [ ] Highlight text khi có threads trước → "Analyzing connections..." toast
- [ ] Connections detected → Connection items hiện trong Saved tab
- [ ] Click connection item → Switch to đúng thread
- [ ] 0 connections → "No related ideas yet" message hiện

### Deep Angle Tests

- [ ] Deep Angle button visible khi có connections
- [ ] Click "New angle" → Loading spinner → Text generated
- [ ] Deep Angle cached → không re-generate nếu chưa hết TTL (6h)
- [ ] Không có connections → Button disabled

### Connection Actions

- [ ] Compare action → User message appears + AI comparison response
- [ ] Merge action → Threads merged, thread list updated, target removed
- [ ] After merge → Thread count giảm 1

### Semantic Search Integration

- [ ] Embeddings enabled + có vector data → Candidates sorted by similarity
- [ ] Embeddings disabled → Fallback to recency (last 5 threads)
- [ ] Embedding API error → Metric recorded, graceful fallback

### Regression (critical — Phase 4a + 4b combined)

- [ ] Chat flow end-to-end
- [ ] Onboarding
- [ ] Search (Ctrl+F)
- [ ] Undo system
- [ ] Parking Lot
- [ ] Retention tools
- [ ] Export
- [ ] Multi-tab sync

---

## 14. Rollback Plan

Vì Phase 4a đã verify riêng:

1. Chỉ xoá `<script src="sp_smartlink.js">` khỏi `sidepanel.html`
2. Revert Smart Linking code trong `sidepanel.js` (không động 4a)
3. Reload extension
