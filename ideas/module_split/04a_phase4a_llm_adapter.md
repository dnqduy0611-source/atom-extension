# Phase 4a: LLM Provider Adapter (~585 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** Phase 1 (State Bus)  
**Status:** Planning  
**Risk:** 🟡 Trung bình  
**Effort:** 2-3 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tách **LLM Provider Adapter Layer** — provider routing, API calls, retry, fallback, error handling — thành module riêng. Core chat logic (`sendToGemini`, `handleSend`, message rendering) **giữ nguyên** trong `sidepanel.js`.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_llm.js` | **NEW** | ~600 lines — LLM provider adapter |
| `sidepanel.html` | **MODIFY** | +1 line — thêm `<script>` |
| `sidepanel.js` | **MODIFY** | -585 lines, +8 lines SP calls |

---

## 3. Tại sao tách

`callLLMAPI` / `callGeminiAPI` / `callOpenRouterAPI` tạo thành **adapter layer** hoàn chỉnh:
- Provider routing (Gemini vs OpenRouter)
- Multi-level fallback chains (3+ models)
- Retry with exponential backoff
- Rate limiting integration (RateLimitManager)
- Error classification (retryable vs fatal)
- Retry UI state management (countdown, status dot)

Tất cả đều **không liên quan** đến chat logic — chỉ nhận prompt và trả text.

---

## 4. Code cần extract từ `sidepanel.js`

### 4a. State variables

| Variable | Line | Type | Ghi chú |
|----------|------|------|---------|
| `retryingState` | 25-29 | `{ active, previousText, previousStatusClass }` | Mutable |
| `rateLimitCountdownInterval` | 6297 | `null \| number` | Timer ID |

### 4b. Functions (17 items)

| # | Function | Lines | Size | Scope |
|---|----------|-------|------|-------|
| 1 | `getLLMProvider` | 5769-5784 | 16 | Internal — chrome.storage |
| 2 | `convertToOpenRouterMessages` | 5787-5805 | 19 | Internal |
| 3 | `callOpenRouterAPI` | 5807-5843 | 37 | Internal |
| 4 | `callLLMAPI` | 5846-5971 | 126 | **Expose → SP** |
| 5 | `callGeminiAPI` | 5973-6185 | 213 | **Expose → SP** |
| 6 | `ApiError` (class) | 6190-6197 | 8 | **Expose → SP** |
| 7 | `parseApiError` | 6199-6215 | 17 | Internal |
| 8 | `getStatusMessage` | 6217-6230 | 14 | Internal |
| 9 | `isRetryableError` | 6232-6235 | 4 | Internal |
| 10 | `isNetworkError` | 6237-6242 | 6 | Internal |
| 11 | `calculateRetryDelay` | 6244-6247 | 4 | Internal |
| 12 | `sleep` | 6249-6251 | 3 | Internal (**duplicate giữ lại** trong sidepanel.js) |
| 13 | `showRetryingState` | 6253-6266 | 14 | Internal — UI |
| 14 | `clearRetryingState` | 6268-6284 | 17 | Internal — UI |
| 15 | `showRetryNotification` | 6286-6292 | 7 | Internal |
| 16 | `showRateLimitCountdown` | 6299-6338 | 40 | **Expose → SP** |
| 17 | `clearRateLimitCountdown` | 6340-6351 | 12 | **Expose → SP** |

> [!NOTE]
> `sleep()` rất đơn giản (3 lines). Giữ 1 bản trong `sidepanel.js`, 1 bản trong `sp_llm.js` — không cần expose qua SP.

---

## 5. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.API_CONFIG              // model name, API base, timeouts, retry config, cache TTLs
SP.getMessage(key, fb)     // i18n cho error messages, retry UI
SP.showToast(msg, type)    // feedback
SP.getApiKey()             // API key retrieval
SP.elements.contextText    // retry UI state
SP.elements.contextStatus  // retry UI state
```

**External window services:**
```
window.RateLimitManager         // rate limiting
window.__ATOM_RATE_MANAGER__    // singleton instance
window.parseRetryAfterSeconds   // retry-after parsing
```

> [!IMPORTANT]
> `callGeminiAPI` đọc `API_CONFIG` trực tiếp. Cần thay bằng `SP.API_CONFIG`:
> ```diff
> - const url = `${API_CONFIG.API_BASE}/${modelName}:generateContent?key=${apiKey}`;
> + const url = `${SP.API_CONFIG.API_BASE}/${modelName}:generateContent?key=${apiKey}`;
> ```
> Tương tự cho `API_CONFIG.RETRY_MAX_ATTEMPTS`, `API_CONFIG.TIMEOUT_MS`, `API_CONFIG.CACHE.*`, etc.

---

## 6. Public API

```javascript
if (window.SP) {
    SP.callLLMAPI = callLLMAPI;
    SP.callGeminiAPI = callGeminiAPI;
    SP.ApiError = ApiError;
    SP.showRateLimitCountdown = showRateLimitCountdown;
    SP.clearRateLimitCountdown = clearRateLimitCountdown;
}
```

---

## 7. Call sites cần update trong `sidepanel.js`

### `callLLMAPI` (5 call sites)

| Line | Context | Update |
|------|---------|--------|
| 3976 | Deep Angle → sẽ tách vào `sp_smartlink.js` (Phase 4b) | Không cần update ngay |
| 5252 | `sendToGemini()` | `SP.callLLMAPI(...)` |
| 7008 | Key Insight generation | `SP.callLLMAPI(...)` |
| 7891 | Context selector | `SP.callLLMAPI(...)` |
| 8005 | Related memory | `SP.callLLMAPI(...)` |

### `callGeminiAPI` (1 indirect call)

| Line | Context | Ghi chú |
|------|---------|---------|
| 5913 | Inside `callLLMAPI` | Đã tách cùng module, không cần update |

### `instanceof ApiError`

```diff
 // sendToGemini error handling (~line 5300)
- if (error instanceof ApiError && error.status === 429) {
+ if (SP.ApiError && error instanceof SP.ApiError && error.status === 429) {
```

### `showRateLimitCountdown` / `clearRateLimitCountdown`

Grep cho callers — nếu gọi từ sidepanel.js → thay bằng `SP.showRateLimitCountdown(...)`.

---

## 8. SP wiring cần thêm trong `sidepanel.js`

```javascript
// Phase 4a wiring — trong init(), SAU khi SP đã tồn tại
// (Không cần thêm gì — sp_llm.js tự expose khi IIFE chạy)
// Chỉ cần đảm bảo API_CONFIG đã wire lên SP từ Phase 1:
SP.API_CONFIG = API_CONFIG;  // Thêm vào Phase 1 wiring nếu chưa có
```

---

## 9. File skeleton

```javascript
/**
 * sp_llm.js — LLM Provider Adapter Layer
 * Phase 4a of Sidepanel Module Split
 * 
 * Handles: Provider routing (Gemini/OpenRouter), multi-model fallback,
 * retry with exponential backoff, rate limiting, error handling.
 * 
 * DOES NOT handle: Chat logic, message rendering, thread management.
 * Those stay in sidepanel.js's sendToGemini().
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[LLM] SP not found'); return; }

    // ── State ──
    let retryingState = { active: false, previousText: '', previousStatusClass: '' };
    let rateLimitCountdownInterval = null;

    // ── Error Types ──
    class ApiError extends Error {
        constructor(message, status, code) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = code;
        }
    }

    // ── Utilities ──
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function isRetryableError(status) { return status >= 500 || status === 429; }
    function isNetworkError(error) {
        return error.name === 'AbortError' ||
            error.name === 'TypeError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError');
    }
    function calculateRetryDelay(attempt) {
        return SP.API_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    }
    async function parseApiError(response) { /* ... */ }
    function getStatusMessage(status) { /* ... uses SP.getMessage */ }

    // ── Retry UI ──
    function showRetryingState(attempt, maxAttempts) { /* ... uses SP.elements */ }
    function clearRetryingState() { /* ... */ }
    function showRetryNotification(attempt, maxAttempts, priority) { /* ... */ }
    function showRateLimitCountdown(seconds) { /* ... */ }
    function clearRateLimitCountdown() { /* ... */ }

    // ── Provider Functions ──
    async function getLLMProvider() { /* ... chrome.storage */ }
    function convertToOpenRouterMessages(systemPrompt, geminiContents) { /* ... */ }
    async function callOpenRouterAPI(openrouterKey, model, messages, generationConfig) { /* ... */ }

    // ── Main API Functions ──
    async function callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt, options) {
        /* Full 213-line function */
    }
    async function callLLMAPI(systemPrompt, conversationHistory, options) {
        /* Full 126-line function */
    }

    // ── Expose ──
    SP.callLLMAPI = callLLMAPI;
    SP.callGeminiAPI = callGeminiAPI;
    SP.ApiError = ApiError;
    SP.showRateLimitCountdown = showRateLimitCountdown;
    SP.clearRateLimitCountdown = clearRateLimitCountdown;
})();
```

---

## 10. Load Order

```diff
 <script src="sp_parking.js"></script>
+<script src="sp_llm.js"></script>
 <script src="sidepanel.js"></script>
```

`sp_llm.js` load trước `sidepanel.js` — expose `SP.callLLMAPI` etc. ngay khi IIFE chạy.

---

## 11. Verification Checklist

### Functional Tests

- [ ] `typeof SP.callLLMAPI === 'function'`
- [ ] `typeof SP.callGeminiAPI === 'function'`
- [ ] `SP.ApiError` → class tồn tại
- [ ] Chat bình thường → AI response hiện (sendToGemini → SP.callLLMAPI)
- [ ] Key Insight (Ctrl+D) → Generate bình thường
- [ ] Context selector → AI ranking hoạt động
- [ ] Related Memory → Generate bình thường

### Error Handling Tests

- [ ] Nhập sai API key → Error message hiện đúng
- [ ] Rate limit (429) → Countdown timer hoạt động
- [ ] Retry → "Retrying (1/3)..." toast hiện
- [ ] Server error (500) → Retry + fallback
- [ ] Network error → Retry

### Provider Tests

- [ ] Gemini mode (default) → Phản hồi bình thường
- [ ] OpenRouter mode (nếu configured) → Phản hồi bình thường
- [ ] Fallback chain triggered → Step 3.5 → Gemini Lite → Mistral

### Regression

- [ ] Onboarding → Hoạt động
- [ ] Search → Hoạt động
- [ ] Undo → Hoạt động
- [ ] Parking Lot → Hoạt động
- [ ] Retention → Hoạt động (vẫn gọi `callGeminiAPI` nếu Phase 3b đã dùng)
- [ ] Smart Linking → Vẫn hoạt động (chưa tách Phase 4b)

---

## 12. Rollback Plan

1. Xoá `<script src="sp_llm.js">` khỏi `sidepanel.html`
2. Revert `sidepanel.js` từ git
3. Reload extension
