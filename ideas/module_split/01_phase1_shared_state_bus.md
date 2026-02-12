# Phase 1: Shared State Bus (`sp_state.js`)
**Parent:** [00_overview.md](./00_overview.md)  
**Status:** Ready to implement  
**Risk:** 🟢 Thấp  
**Effort:** 2-3 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tạo `window.SP` shared state bus — foundation cho toàn bộ module split.  
**Không thay đổi logic nào** — chỉ expose state + helpers cho future modules.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_state.js` | **NEW** | ~80 lines — khai báo `window.SP` |
| `sidepanel.html` | **MODIFY** | +1 line — thêm `<script>` tag |
| `sidepanel.js` | **MODIFY** | +35 lines — wire aliases trong `init()` + sync setters |

---

## 3. Chi tiết: `sp_state.js` (NEW)

```javascript
/**
 * sp_state.js — Shared State Bus for Sidepanel Modules
 * 
 * Phase 1 of Module Split. This file MUST load before all other
 * sidepanel scripts. It declares window.SP which acts as a bridge
 * between the main orchestrator (sidepanel.js) and extracted modules.
 * 
 * RULES:
 * - sidepanel.js owns the source of truth (closure vars)
 * - sidepanel.js syncs closure vars → window.SP after mutations
 * - Extracted modules read/write via window.SP
 * - Helpers (getMessage, showToast, etc.) are set by sidepanel.js in init()
 */

(function () {
    'use strict';

    if (window.SP) {
        console.warn('[SP] window.SP already exists, skipping re-init');
        return;
    }

    window.SP = {
        // ── Core State (synced by sidepanel.js) ──
        pageContext: null,
        threads: [],
        activeThreadId: null,
        activeSessionId: null,
        isLoading: false,
        isGeneratingInsight: false,
        isGeneratingDeepAngle: false,
        isInsightDisplayHidden: true,
        currentTabId: null,
        currentDomain: null,
        currentModeId: null,
        activeMainTab: 'chat',
        sessionStartTime: Date.now(),
        parkingLot: [],

        // ── Undo State ──
        undoStack: [],
        activeUndoToast: null,

        // ── Semantic Flags ──
        semanticFlags: {
            embeddingsEnabled: false,
            semanticSearchEnabled: false
        },
        acceptedCostWarning: false,
        userPersona: '',

        // ── API Configuration (default, overwritten by loadAIConfig) ──
        API_CONFIG: {
            MODEL_NAME: "gemini-3-flash-preview",
            FALLBACK_MODEL: "gemini-2.5-flash",
            API_BASE: "https://generativelanguage.googleapis.com/v1beta/models",
            MAX_CONTEXT_CHARS: 100000,
            TIMEOUT_MS: 30000,
            RETRY_MAX_ATTEMPTS: 3,
            RETRY_BASE_DELAY_MS: 1000,
            FALLBACK_CHAIN: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
            CACHE: {
                STRATEGY_TTL_MS: 30000,
                PILOT_TTL_MS: 900000,
                SMARTLINK_TTL_MS: 600000,
                RELATED_MEMORY_TTL_MS: 600000,
                DEEP_ANGLE_TTL_MS: 21600000,
                DEFAULT_BACKGROUND_TTL_MS: 300000,
                VIP_CACHE_ENABLED: false
            }
        },

        // ── DOM Elements (populated by sidepanel.js init) ──
        elements: {},

        // ── Shared Helpers (set by sidepanel.js after init) ──
        // Modules gọi: SP.getMessage('key', 'fallback')
        getMessage: null,
        getMessageWithArgs: null,
        getIcon: null,
        showToast: null,
        getApiKey: null,
        switchMainTab: null,

        // ── Debug ──
        _debug: false,
        log(label, ...args) {
            if (this._debug) console.debug(`[SP:${label}]`, ...args);
        }
    };

    console.log('[SP] State bus initialized');
})();
```

---

## 4. Chi tiết: `sidepanel.html` (MODIFY)

**Vị trí:** Sau line 4900 (`config/feature_flags.js`), trước line 4901 (`services/rate_limit_manager.js`).

```diff
 <script src="config/feature_flags.js"></script>
+<script src="sp_state.js"></script>
 <script src="services/rate_limit_manager.js"></script>
```

---

## 5. Chi tiết: `sidepanel.js` (MODIFY)

### 5a. Wire aliases cuối `init()` (sau line 1489)

Thêm block sau trước closing `}` của `init()`:

```javascript
        // ── Phase 1: Wire Shared State Bus ──
        if (window.SP) {
            // Core state
            window.SP.pageContext = pageContext;
            window.SP.threads = threads;
            window.SP.activeThreadId = activeThreadId;
            window.SP.activeSessionId = activeSessionId;
            window.SP.isLoading = isLoading;
            window.SP.currentTabId = currentTabId;
            window.SP.currentDomain = currentDomain;
            window.SP.currentModeId = currentModeId;
            window.SP.activeMainTab = activeMainTab;
            window.SP.sessionStartTime = sessionStartTime;
            window.SP.parkingLot = parkingLot;
            window.SP.elements = elements;
            window.SP.API_CONFIG = API_CONFIG;
            window.SP.semanticFlags = semanticFlags;
            window.SP.acceptedCostWarning = acceptedCostWarning;
            window.SP.userPersona = userPersona;

            // Expose helpers as functions
            window.SP.getMessage = getMessage;
            window.SP.getMessageWithArgs = getMessageWithArgs;
            window.SP.getIcon = getIcon;
            window.SP.showToast = showToast;
            window.SP.getApiKey = getApiKey;
            window.SP.switchMainTab = switchMainTab;

            console.log('[SP] State bus wired ✓', {
                threads: threads.length,
                elements: Object.keys(elements).length,
                model: API_CONFIG.MODEL_NAME
            });
        }
```

### 5b. Sync points — cập nhật SP khi state thay đổi

Thêm 1 dòng sync tại **5 điểm chính**:

| Nơi | Biến | Thêm dòng |
|-----|------|-----------|
| `loadThreadsFromStorage()` — sau khi gán `threads = ...` (khoảng line 4437-4460) | `threads` | `if (window.SP) window.SP.threads = threads;` |
| `saveThreadsToStorage()` — đầu function | `threads` | `if (window.SP) window.SP.threads = threads;` |
| `loadPageContext()` — sau khi gán `pageContext = ...` (khoảng line 4980) | `pageContext` | `if (window.SP) window.SP.pageContext = pageContext;` |
| `setLoading()` — sau `isLoading = loading` (line 6641) | `isLoading` | `if (window.SP) window.SP.isLoading = isLoading;` |
| `switchMainTab()` — sau `activeMainTab = tabName` (line ~2960) | `activeMainTab` | `if (window.SP) window.SP.activeMainTab = activeMainTab;` |

**Ví dụ cụ thể cho `setLoading()`:**

```diff
 function setLoading(loading) {
     isLoading = loading;
+    if (window.SP) window.SP.isLoading = isLoading;
     elements.sendBtn.disabled = loading;
     updateSendButton();
 }
```

---

## 6. Điều gì KHÔNG làm

- ❌ Không thay đổi logic của bất kỳ function nào
- ❌ Không di chuyển code ra khỏi `sidepanel.js`
- ❌ Không thay đổi function signatures
- ❌ Không thêm event listeners mới
- ❌ Không sửa CSS hoặc HTML structure

---

## 7. Verification Checklist

### Smoke Test (bắt buộc)

- [ ] Extension load không lỗi console
- [ ] Side Panel mở bình thường
- [ ] `console.log(window.SP)` → object với đầy đủ properties
- [ ] `typeof window.SP.getMessage` → `'function'`
- [ ] `typeof window.SP.showToast` → `'function'`
- [ ] `typeof window.SP.getApiKey` → `'function'`
- [ ] `Object.keys(window.SP.elements).length > 0` → true

### Functional Test (bắt buộc)

- [ ] Highlight text → Thread tạo mới → `window.SP.threads.length` tăng
- [ ] Gửi chat → AI phản hồi bình thường
- [ ] Ctrl+F → Quick search hoạt động
- [ ] Ctrl+D → Key Insight generate
- [ ] Click tabs (Chat/Notes/Saved/Cards) → Chuyển tab mượt
- [ ] Menu dropdown → Các options hoạt động
- [ ] Onboarding (nếu user mới) → Welcome screen hiện

### Regression Test (khuyến nghị)

- [ ] Export dialog mở → Download file
- [ ] Parking Lot → Add/Remove idea
- [ ] Multi-tab → Mở 2 Side Panel → Warning hiện
- [ ] Focus timer → Start/Stop hoạt động

---

## 8. Rollback Plan

Nếu có lỗi:
1. Remove `<script src="sp_state.js">` khỏi `sidepanel.html`
2. Revert changes trong `sidepanel.js` (xóa các dòng `window.SP` sync)
3. Reload extension

Không cần xóa `sp_state.js` file — nó sẽ không được load nếu không có `<script>` tag.
