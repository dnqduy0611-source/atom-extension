# Phase 2: Onboarding + Multi-Tab (~656 lines)
**Parent:** [00_overview.md](./00_overview.md)  
**Depends on:** [Phase 1 — Shared State Bus](./01_phase1_shared_state_bus.md)  
**Status:** Planning  
**Risk:** 🟢 Thấp  
**Effort:** 3-4 giờ  
**Date:** 2026-02-11

---

## 1. Mục tiêu

Tách 2 hệ thống **tự chứa nhất** ra khỏi `sidepanel.js`:
- **Onboarding** (~512 lines) — welcome screen, tooltips, progress tracking
- **Multi-Tab** (~144 lines) — BroadcastChannel, session detection, warnings

Cả hai đều có lifecycle riêng, ít coupling với core chat logic.

---

## 2. Files thay đổi

| File | Action | Mô tả |
|------|--------|-------|
| `sp_onboarding.js` | **NEW** | ~530 lines — onboarding system + constants |
| `sp_multitab.js` | **NEW** | ~160 lines — multi-tab handling + constants |
| `sidepanel.html` | **MODIFY** | +2 lines — thêm `<script>` tags |
| `sidepanel.js` | **MODIFY** | -656 lines, +15 lines — remove code, add SP calls |

---

## 3. Module: `sp_onboarding.js` (NEW)

### 3a. Code cần extract từ `sidepanel.js`

**Constants** (lines 762-789):
```
ONBOARDING_STORAGE_KEY
COMMAND_ONBOARDING_STORAGE_KEY  ← giữ lại (dùng bởi command system)
ONBOARDING_MENU_ID
ONBOARDING_STATES
ONBOARDING_ORDER
onboardingState (mutable)
onboardingOverlayEscHandler
onboardingLastFocusedElement
activeTooltipEscHandler
```

**Functions** (lines 791-1302):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `getOnboardingStateIndex` | 794-796 | Internal |
| `isOnboardingStateAtLeast` | 798-800 | Internal |
| `isOnboardingCompleted` | 802-804 | Expose qua SP |
| `normalizeOnboardingState` | 806-840 | Internal |
| `loadOnboardingState` | 842-849 | Expose qua SP |
| `saveOnboardingState` | 851-857 | Internal |
| `updateOnboardingState` | 859-881 | Internal |
| `getOnboardingStepLabelKey` | 883-891 | Internal |
| `getOnboardingTaskKey` | 893-901 | Internal |
| `ensureOnboardingProgressStyles` | 903-953 | Internal |
| `ensureOnboardingProgressRegion` | 955-986 | Internal |
| `renderOnboardingProgress` | 988-1012 | Internal |
| `ensureOnboardingMenuItem` | 1014-1046 | Expose qua SP |
| `updateOnboardingMenuItemLabel` | 1048-1053 | Internal |
| `checkAndShowOnboarding` | 1055-1061 | Expose qua SP |
| `showWelcomeScreen` | 1063-1140 | Internal |
| `closeWelcomeScreen` | 1142-1162 | Internal |
| `dismissActiveTooltip` | 1164-1180 | Internal |
| `showTooltip` | 1185-1234 | Internal |
| `maybeCompleteOnboarding` | 1236-1243 | Internal |
| `confirmSkipOnboarding` | 1245-1259 | Internal |
| `checkAndShowContextualTooltip` | 1261-1302 | **Expose qua SP** (gọi từ 6 nơi) |

### 3b. Dependencies (đọc từ SP)

```javascript
// Đọc từ window.SP
const SP = window.SP;
SP.getMessage(key, fallback)       // i18n
SP.getIcon(name)                   // icon SVGs
SP.showToast(msg, type)            // feedback
SP.elements.menuDropdown           // DOM ref cho menu item
SP.elements.menuBtn                // DOM ref
SP.elements.userInput              // DOM ref for tooltip anchor
```

### 3c. Public API (expose lên SP)

```javascript
// Trong sp_onboarding.js cuối file:
if (window.SP) {
    window.SP.loadOnboardingState = loadOnboardingState;
    window.SP.checkAndShowOnboarding = checkAndShowOnboarding;
    window.SP.checkAndShowContextualTooltip = checkAndShowContextualTooltip;
    window.SP.isOnboardingCompleted = isOnboardingCompleted;
}
```

### 3d. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 1485 | `await loadOnboardingState();` | `if (SP.loadOnboardingState) await SP.loadOnboardingState();` |
| 1486 | `checkAndShowOnboarding();` | `if (SP.checkAndShowOnboarding) SP.checkAndShowOnboarding();` |
| 3192 | `checkAndShowContextualTooltip('first_save');` | `SP.checkAndShowContextualTooltip?.('first_save');` |
| 3860 | `checkAndShowContextualTooltip('first_highlight');` | `SP.checkAndShowContextualTooltip?.('first_highlight');` |
| 5279 | `checkAndShowContextualTooltip('first_chat');` | `SP.checkAndShowContextualTooltip?.('first_chat');` |
| 7192 | `checkAndShowContextualTooltip('first_save');` | `SP.checkAndShowContextualTooltip?.('first_save');` |
| 7215 | `checkAndShowContextualTooltip('first_save');` | `SP.checkAndShowContextualTooltip?.('first_save');` |
| 7294 | `checkAndShowContextualTooltip('first_save');` | `SP.checkAndShowContextualTooltip?.('first_save');` |

> [!NOTE]
> Dùng optional chaining (`?.`) để fail gracefully nếu `sp_onboarding.js` chưa load.

---

## 4. Module: `sp_multitab.js` (NEW)

### 4a. Code cần extract từ `sidepanel.js`

**Constants** (lines 1312-1313):
```
SESSION_ID
broadcastChannel (mutable)
```

**Functions** (lines 2328-2471):
| Function | Lines | Ghi chú |
|----------|-------|---------|
| `initMultiTabHandling` | 2331-2358 | Expose qua SP |
| `broadcastSessionActive` | 2360-2368 | Internal |
| `handleBroadcastMessage` | 2370-2400 | Internal |
| `checkForExistingSessions` | 2402-2409 | Internal |
| `showMultiTabWarning` | 2411-2441 | Internal |
| `hideMultiTabWarning` | 2443-2449 | Internal |
| `showDataSyncNotification` | 2451-2461 | Internal (gọi `loadThreadsFromStorage`) |
| `broadcastDataUpdate` | 2464-2471 | **Expose qua SP** (gọi từ `saveThreadsToStorage`) |

### 4b. Dependencies (đọc từ SP)

```javascript
const SP = window.SP;
SP.currentDomain           // check same domain
SP.pageContext?.url         // check same URL
SP.threads                  // check local data length
SP.getMessage(key, fb)      // i18n
SP.getIcon(name)            // icons
SP.showToast(msg, type)     // feedback
```

### 4c. Special dependency: `loadThreadsFromStorage`

`showDataSyncNotification()` gọi `loadThreadsFromStorage()` khi không có local data. Giải pháp:

```javascript
// sp_multitab.js — gọi qua SP
function showDataSyncNotification(data) {
    if (SP.threads.length === 0) {
        SP.loadThreadsFromStorage?.();  // exposed bởi sidepanel.js
        return;
    }
    SP.showToast(SP.getMessage('sp_data_sync', 'Data updated in another tab'), 'info');
}
```

Trong `sidepanel.js` (Phase 1 wiring mở rộng):
```javascript
window.SP.loadThreadsFromStorage = loadThreadsFromStorage;
```

### 4d. Public API (expose lên SP)

```javascript
if (window.SP) {
    window.SP.initMultiTabHandling = initMultiTabHandling;
    window.SP.broadcastDataUpdate = broadcastDataUpdate;
}
```

### 4e. Call sites cần update trong `sidepanel.js`

| Line | Hiện tại | Sau khi tách |
|------|----------|--------------|
| 1489 | `initMultiTabHandling();` | `SP.initMultiTabHandling?.();` |
| 4494 | `broadcastDataUpdate();` | `SP.broadcastDataUpdate?.();` |

---

## 5. Load Order trong `sidepanel.html`

```diff
 <script src="sp_state.js"></script>
 <!-- ...services... -->
+<script src="sp_onboarding.js"></script>
+<script src="sp_multitab.js"></script>
 <!-- ...other UI controllers... -->
 <script src="sidepanel.js"></script>
```

Cần load **trước** `sidepanel.js` và **sau** `sp_state.js`.

---

## 6. Cấu trúc file mới

### `sp_onboarding.js` skeleton

```javascript
/**
 * sp_onboarding.js — Onboarding System
 * Phase 2 of Sidepanel Module Split
 * 
 * Handles: Welcome screen, tooltip coach marks,
 * progress tracking, onboarding state machine.
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Onboarding] SP not found'); return; }

    // ── Constants ──
    const STORAGE_KEY = 'atom_sidepanel_onboarding';
    const MENU_ID = 'menu-onboarding-guide';
    const STATES = Object.freeze({ /* ... */ });
    const ORDER = [ /* ... */ ];

    // ── Mutable State ──
    let state = { state: STATES.NOT_STARTED, /* ... */ };
    let overlayEscHandler = null;
    let lastFocusedElement = null;
    let tooltipEscHandler = null;

    // ── [paste all 22 functions here, replacing getMessage→SP.getMessage etc.] ──

    // ── Expose API ──
    SP.loadOnboardingState = loadOnboardingState;
    SP.checkAndShowOnboarding = checkAndShowOnboarding;
    SP.checkAndShowContextualTooltip = checkAndShowContextualTooltip;
    SP.isOnboardingCompleted = isOnboardingCompleted;
})();
```

### `sp_multitab.js` skeleton

```javascript
/**
 * sp_multitab.js — Multi-Tab Session Handling
 * Phase 2 of Sidepanel Module Split
 * 
 * Handles: BroadcastChannel sync, session detection,
 * multi-tab warnings, data sync notifications.
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[MultiTab] SP not found'); return; }

    // ── Constants ──
    const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let broadcastChannel = null;

    // ── [paste all 8 functions here, replacing direct var→SP.var] ──

    // ── Expose API ──
    SP.initMultiTabHandling = initMultiTabHandling;
    SP.broadcastDataUpdate = broadcastDataUpdate;
})();
```

---

## 7. Checklist thay đổi trong `sidepanel.js`

Sau khi extract, xoá khỏi `sidepanel.js`:

- [ ] Lines 762-764: `ONBOARDING_STORAGE_KEY`, `ONBOARDING_MENU_ID` constants
- [ ] Lines 765-789: `ONBOARDING_STATES`, `ONBOARDING_ORDER`, `onboardingState`, escape handlers
- [ ] Lines 791-1302: Tất cả 22 onboarding functions
- [ ] Lines 1312-1313: `SESSION_ID`, `broadcastChannel`
- [ ] Lines 2328-2471: Tất cả 8 multi-tab functions
- [ ] Update 8 call sites (6 onboarding + 2 multitab) → gọi qua `SP.*`
- [ ] Thêm `SP.loadThreadsFromStorage = loadThreadsFromStorage;` vào init wiring

**Kết quả:** `sidepanel.js` giảm ~656 lines (từ 8179 → ~7523)

---

## 8. Verification Checklist

### Smoke Test

- [ ] Extension load không lỗi
- [ ] `typeof SP.checkAndShowContextualTooltip` → `'function'`
- [ ] `typeof SP.initMultiTabHandling` → `'function'`
- [ ] `typeof SP.broadcastDataUpdate` → `'function'`

### Onboarding Tests

- [ ] Clear storage → Reload → Welcome screen hiện
- [ ] Click "Start now" → Welcome đóng, progress bar hiện
- [ ] Highlight text → Tooltip "press Summarize" hiện
- [ ] Summarize → Tooltip "press Save" hiện
- [ ] Save → Onboarding complete toast
- [ ] Menu → "Onboarding guide" item → Re-open welcome
- [ ] Click "Skip guide" → Confirm → Onboarding completed

### Multi-Tab Tests

- [ ] Mở 2 Side Panels cùng URL → Warning hiện ở panel 2
- [ ] Click "Continue here" → Warning biến mất
- [ ] Đóng 1 panel → Warning ở panel còn lại tự ẩn
- [ ] Save thread ở panel 1 → Panel 2 nhận sync notification

### Regression (core chat)

- [ ] Highlight → Chat → AI response → Bình thường
- [ ] Ctrl+F search → Hoạt động
- [ ] Tab switching → Mượt
- [ ] Export → Hoạt động

---

## 9. Rollback Plan

1. Xoá 2 dòng `<script>` trong `sidepanel.html`
2. Revert `sidepanel.js` từ git (restore code đã xoá)
3. Reload extension

Không cần xoá `sp_onboarding.js` / `sp_multitab.js` — chúng sẽ không được load.
