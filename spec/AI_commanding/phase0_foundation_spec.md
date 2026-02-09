# Phase 0: Foundation - Detailed Spec

**Version:** 2.0
**Duration:** 1 tuần
**Prerequisites:** None

---

## Mục tiêu Phase 0

Xây dựng **toàn bộ nền tảng** cho AI Command Routing mà **không ảnh hưởng user hiện tại**:
- CommandRouter: parse AI response → extract action → route to handler
- IntentParser: client-side regex cho deterministic commands (offline, instant)
- ActionExecutor: confirmation + execute + undo pipeline
- ToastManager: 4 loại toast (success, undo, confirm, error)
- Feature flag OFF by default
- i18n strings với non-tech vocabulary

---

## Task Breakdown

### 0.1 CommandRouter Class
**Effort:** 1.5 ngày

#### File: `services/command_router.js`

```javascript
// services/command_router.js

class CommandRouter {
    constructor() {
        this.handlers = new Map();
        this.undoHandlers = new Map();
        this.enabled = false;
    }

    setEnabled(flag) {
        this.enabled = flag;
    }

    register(command, handler, undoHandler = null) {
        this.handlers.set(command, handler);
        if (undoHandler) {
            this.undoHandlers.set(command, undoHandler);
        }
    }

    /**
     * Parse AI response text for [ACTION:CMD:params] tag
     * Returns null if no action found or disabled
     */
    parseResponse(aiText) {
        if (!this.enabled) return null;

        // Match [ACTION:COMMAND_NAME] or [ACTION:COMMAND_NAME:{"key":"value"}]
        const regex = /\[ACTION:(\w+)(?::(\{[^}]*\}))?\]/;
        const match = aiText.match(regex);

        if (!match) return null;

        let params = {};
        if (match[2]) {
            try {
                params = JSON.parse(match[2]);
            } catch (e) {
                console.warn('[CommandRouter] Invalid JSON in action:', match[2]);
                return null; // Malformed JSON → ignore silently
            }
        }

        return {
            command: match[1],
            params,
            cleanText: aiText.replace(regex, '').trim()
        };
    }

    /**
     * Execute a command handler
     * Returns { success, message, data } or null if unknown
     */
    async execute(command, params = {}) {
        if (!this.enabled) return null;

        const handler = this.handlers.get(command);
        if (!handler) {
            console.warn(`[CommandRouter] Unknown command: ${command}`);
            return {
                success: false,
                message: chrome.i18n.getMessage('cmdUnknown') || 'Mình chưa hiểu ý bạn.'
            };
        }

        try {
            return await handler(params);
        } catch (error) {
            console.error(`[CommandRouter] Error executing ${command}:`, error);
            return {
                success: false,
                message: chrome.i18n.getMessage('cmdError') || 'Có lỗi xảy ra, thử lại nhé!'
            };
        }
    }

    /**
     * Undo a previously executed command
     */
    async undo(command, data) {
        const undoHandler = this.undoHandlers.get(command);
        if (!undoHandler) return false;

        try {
            await undoHandler(data);
            return true;
        } catch (error) {
            console.error(`[CommandRouter] Undo failed for ${command}:`, error);
            return false;
        }
    }

    hasCommand(command) {
        return this.handlers.has(command);
    }

    canUndo(command) {
        return this.undoHandlers.has(command);
    }
}

export const commandRouter = new CommandRouter();
```

#### Acceptance Criteria
- [ ] `parseResponse` extracts command + params correctly
- [ ] `parseResponse` returns null for malformed JSON (no crash)
- [ ] `parseResponse` strips action tag from cleanText
- [ ] `execute` routes to correct handler
- [ ] `execute` returns friendly error for unknown commands
- [ ] `undo` calls registered undo handler
- [ ] `setEnabled(false)` disables all parsing/execution

---

### 0.2 IntentParser Class
**Effort:** 1 ngày

#### File: `services/intent_parser.js`

```javascript
// services/intent_parser.js
// Tier 1: Client-side deterministic intent detection
// Works offline, instant (< 10ms), no AI dependency

const INTENTS = {
    FOCUS_START: {
        patterns: [
            /(?:bật|bắt đầu|start)\s*(?:pomodoro|focus|tập trung)\s*(\d+)?\s*(?:phút|p|minutes?|m)?/i,
            /(?:focus|tập trung)\s*(\d+)\s*(?:phút|p|minutes?|m)/i,
            /(\d+)\s*(?:phút|p|minutes?|m)\s*(?:focus|tập trung|pomodoro)/i,
        ],
        extractParams: (match) => ({
            minutes: parseInt(match[1]) || 25
        }),
        validate: (params) => {
            if (params.minutes < 1) return { valid: false, hintKey: 'focusMinTooLow' };
            if (params.minutes > 180) return { valid: false, hintKey: 'focusMinTooHigh' };
            return { valid: true };
        },
        confirm: true,
        undoable: true
    },

    FOCUS_STOP: {
        patterns: [
            /(?:dừng|tắt|stop|end|kết thúc)\s*(?:pomodoro|focus|timer|tập trung)/i,
            /(?:dừng|stop)\s*(?:lại|timer)?$/i,
            /(?:tắt|off)\s*(?:timer|pomodoro)?$/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: true,
        undoable: false
    },

    FOCUS_PAUSE: {
        patterns: [
            /(?:tạm dừng|pause)\s*(?:pomodoro|focus|timer|tập trung)?/i,
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false,
        undoable: false
    },

    OPEN_NOTES: {
        patterns: [
            /(?:mở|open|xem)\s*(?:ghi chú|notes?|memory|bộ nhớ)/i,
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false,
        undoable: false
    },

    OPEN_DIARY: {
        patterns: [
            /(?:mở|open|xem)\s*(?:nhật ký|diary|journal)/i,
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false,
        undoable: false
    },

    OPEN_SAVED: {
        patterns: [
            /(?:mở|open|xem)\s*(?:ghi chú đã lưu|saved|highlights?|đã lưu)/i,
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false,
        undoable: false
    },

    OPEN_SETTINGS: {
        patterns: [
            /(?:mở|open)\s*(?:cài đặt|settings?|tùy chỉnh|options?)/i,
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false,
        undoable: false
    }
};

class IntentParser {
    constructor() {
        this.intents = INTENTS;
    }

    /**
     * Try to match user text against known intents
     * Returns { command, params, confirm, undoable } or null
     */
    parse(text) {
        const trimmed = text.trim();

        for (const [command, config] of Object.entries(this.intents)) {
            for (const pattern of config.patterns) {
                const match = trimmed.match(pattern);
                if (match) {
                    const params = config.extractParams(match);
                    const validation = config.validate(params);

                    if (!validation.valid) {
                        return {
                            command: null,
                            error: true,
                            hintKey: validation.hintKey,
                            originalCommand: command
                        };
                    }

                    return {
                        command,
                        params,
                        confirm: config.confirm,
                        undoable: config.undoable
                    };
                }
            }
        }

        return null; // No match → forward to AI
    }
}

export const intentParser = new IntentParser();
```

#### Acceptance Criteria
- [ ] Parses "Bật pomodoro 25 phút" → FOCUS_START(25)
- [ ] Parses "Focus 40 phút" → FOCUS_START(40)
- [ ] Parses "Dừng timer" → FOCUS_STOP
- [ ] Parses "Mở ghi chú" → OPEN_NOTES
- [ ] Parses "Mở nhật ký" → OPEN_DIARY
- [ ] Returns null for ambiguous text (→ forward to AI)
- [ ] Returns validation error for "Focus -5 phút"
- [ ] Returns validation error for "Focus 999 phút"
- [ ] All parsing < 10ms

---

### 0.3 ActionExecutor
**Effort:** 1 ngày

#### File: `services/action_executor.js`

```javascript
// services/action_executor.js
// Pipeline: validate → confirm (if needed) → execute → toast + undo

import { commandRouter } from './command_router.js';

class ActionExecutor {
    constructor(toastManager) {
        this.toast = toastManager;
    }

    /**
     * Execute a command with full pipeline
     */
    async run(command, params, options = {}) {
        const { confirm = false, undoable = true } = options;

        // Step 1: Confirmation (if needed)
        if (confirm) {
            const msg = this.getConfirmMessage(command, params);
            const confirmed = await this.toast.showConfirm(msg);
            if (!confirmed) return { cancelled: true };
        }

        // Step 2: Execute
        const result = await commandRouter.execute(command, params);
        if (!result) return null;

        // Step 3: Show feedback
        if (result.success && undoable && commandRouter.canUndo(command)) {
            this.toast.showUndo(result.message, async () => {
                const undone = await commandRouter.undo(command, result.data);
                if (undone) {
                    this.toast.showSuccess(
                        chrome.i18n.getMessage('cmdUndone') || 'Đã hoàn tác!'
                    );
                }
            });
        } else if (result.success) {
            this.toast.showSuccess(result.message);
        } else {
            this.toast.showError(result.message);
        }

        return result;
    }

    /**
     * Handle AI response: parse + execute
     */
    async handleAIResponse(aiText) {
        const parsed = commandRouter.parseResponse(aiText);
        if (!parsed) {
            return { cleanText: aiText, actionExecuted: false };
        }

        const canUndo = commandRouter.canUndo(parsed.command);
        const result = await this.run(parsed.command, parsed.params, {
            confirm: false, // AI already confirmed in conversation
            undoable: canUndo
        });

        return {
            cleanText: parsed.cleanText,
            actionExecuted: result?.success || false,
            result
        };
    }

    /**
     * Handle client-side intent match
     */
    async handleIntent(intentResult) {
        return this.run(intentResult.command, intentResult.params, {
            confirm: intentResult.confirm,
            undoable: intentResult.undoable
        });
    }

    getConfirmMessage(command, params) {
        switch (command) {
            case 'FOCUS_START':
                return {
                    title: chrome.i18n.getMessage('confirmFocusStart',
                        [String(params.minutes)]) ||
                        `Bắt đầu tập trung ${params.minutes} phút?`,
                    confirmLabel: chrome.i18n.getMessage('btnStart') || 'Bắt đầu',
                    cancelLabel: chrome.i18n.getMessage('btnCancel') || 'Hủy'
                };
            case 'FOCUS_STOP':
                return {
                    title: chrome.i18n.getMessage('confirmFocusStop') ||
                        'Dừng phiên tập trung?',
                    subtitle: chrome.i18n.getMessage('confirmFocusStopHint') ||
                        'Tiến độ phiên hiện tại sẽ được lưu lại.',
                    confirmLabel: chrome.i18n.getMessage('btnStop') || 'Dừng',
                    cancelLabel: chrome.i18n.getMessage('btnContinue') || 'Tiếp tục'
                };
            default:
                return {
                    title: chrome.i18n.getMessage('confirmGeneric') || 'Thực hiện?',
                    confirmLabel: 'OK',
                    cancelLabel: chrome.i18n.getMessage('btnCancel') || 'Hủy'
                };
        }
    }
}

export { ActionExecutor };
```

#### Acceptance Criteria
- [ ] `run()` shows confirm toast when `confirm: true`
- [ ] `run()` skips confirm when `confirm: false`
- [ ] `run()` shows undo toast for undoable commands
- [ ] `run()` shows error toast for failed commands
- [ ] `handleAIResponse()` strips action tag from display text
- [ ] `handleIntent()` uses confirm/undoable from intent config
- [ ] Confirm messages use i18n
- [ ] Cancellation returns `{ cancelled: true }`

---

### 0.4 ToastManager
**Effort:** 1 ngày

#### File: `ui/controllers/toast_manager.js`

4 toast types:

| Type | Icon | Duration | Features |
|------|------|----------|----------|
| success | ✅ | 3s | Auto-dismiss, progress bar |
| undo | ✅ | 5s | "Hoàn tác" button + progress bar |
| confirm | ❓ | Manual | 2 buttons (confirm/cancel), blocks UI |
| error | 🤔 | 4s | Friendly message + suggestion |

```javascript
// ui/controllers/toast_manager.js

class ToastManager {
    constructor() {
        this.container = null;
        this.activeToasts = [];
    }

    init() {
        this.container = document.createElement('div');
        this.container.className = 'sp-toast-container';
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
    }

    showSuccess(message, duration = 3000) {
        return this._show({ type: 'success', icon: '✅', message, duration, dismissable: true });
    }

    showUndo(message, undoCallback, duration = 5000) {
        return this._show({
            type: 'undo', icon: '✅', message, duration, dismissable: true,
            action: {
                label: chrome.i18n.getMessage('btnUndo') || 'Hoàn tác',
                callback: undoCallback
            }
        });
    }

    showConfirm({ title, subtitle, confirmLabel, cancelLabel }) {
        return new Promise((resolve) => {
            this._show({
                type: 'confirm', icon: '❓', message: title, subtitle,
                duration: 0, dismissable: false,
                actions: [
                    { label: cancelLabel || 'Hủy', style: 'secondary', callback: () => resolve(false) },
                    { label: confirmLabel || 'OK', style: 'primary', callback: () => resolve(true) }
                ]
            });
        });
    }

    showError(message, duration = 4000) {
        return this._show({ type: 'error', icon: '🤔', message, duration, dismissable: true });
    }

    _show(config) {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `sp-toast sp-toast--${config.type}`;

        let html = `
            <div class="sp-toast__body">
                <span class="sp-toast__icon">${config.icon}</span>
                <div class="sp-toast__text">
                    <span class="sp-toast__message">${config.message}</span>
                    ${config.subtitle ? `<span class="sp-toast__subtitle">${config.subtitle}</span>` : ''}
                </div>
            </div>
        `;

        if (config.action) {
            html += `<button class="sp-toast__action" data-action="single">${config.action.label}</button>`;
        }

        if (config.actions) {
            html += `<div class="sp-toast__actions">`;
            config.actions.forEach((a, i) => {
                html += `<button class="sp-toast__btn sp-toast__btn--${a.style}" data-action-idx="${i}">${a.label}</button>`;
            });
            html += `</div>`;
        }

        if (config.duration > 0) {
            html += `<div class="sp-toast__progress" style="animation-duration:${config.duration}ms"></div>`;
        }

        toast.innerHTML = html;

        // Bind events
        if (config.action) {
            toast.querySelector('[data-action="single"]')
                .addEventListener('click', () => { config.action.callback(); this._dismiss(toast); });
        }
        if (config.actions) {
            config.actions.forEach((a, i) => {
                toast.querySelector(`[data-action-idx="${i}"]`)
                    .addEventListener('click', () => { a.callback(); this._dismiss(toast); });
            });
        }
        if (config.dismissable) {
            toast.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]') && !e.target.closest('[data-action-idx]')) {
                    this._dismiss(toast);
                }
            });
        }

        this.container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        if (config.duration > 0) setTimeout(() => this._dismiss(toast), config.duration);
        this.activeToasts.push(toast);
        return toast;
    }

    _dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('hide');
        setTimeout(() => {
            toast.remove();
            this.activeToasts = this.activeToasts.filter(t => t !== toast);
        }, 300);
    }

    dismissAll() {
        [...this.activeToasts].forEach(t => this._dismiss(t));
    }
}

export const toastManager = new ToastManager();
```

#### Toast CSS

```css
.sp-toast-container {
    position: fixed;
    bottom: 80px;
    left: 12px;
    right: 12px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
}

.sp-toast {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
    pointer-events: all;
    position: relative;
    overflow: hidden;
}

.sp-toast.show { opacity: 1; transform: translateY(0); }
.sp-toast.hide { opacity: 0; transform: translateY(-10px); }

.sp-toast--success { border-color: var(--primary); }
.sp-toast--undo { border-color: var(--primary); }
.sp-toast--error { border-color: #f59e0b; }
.sp-toast--confirm { border-color: var(--primary); box-shadow: 0 8px 30px rgba(0,0,0,0.25); }

.sp-toast__body { display: flex; align-items: flex-start; gap: 10px; }
.sp-toast__icon { font-size: 16px; flex-shrink: 0; }
.sp-toast__message { font-size: 13px; color: var(--foreground); }
.sp-toast__subtitle { font-size: 11px; color: var(--muted); display: block; margin-top: 4px; }

.sp-toast__action {
    background: none; border: none; color: var(--primary);
    font-weight: 600; font-size: 12px; cursor: pointer;
    padding: 4px 8px; margin-left: auto; flex-shrink: 0;
}
.sp-toast__action:hover { text-decoration: underline; }

.sp-toast__actions { display: flex; gap: 8px; margin-top: 10px; }
.sp-toast__btn {
    flex: 1; padding: 8px 12px; border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;
}
.sp-toast__btn--secondary { background: var(--background); border: 1px solid var(--border); color: var(--foreground); }
.sp-toast__btn--primary { background: var(--primary); border: 1px solid var(--primary); color: #000; }

.sp-toast__progress {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 3px; background: var(--primary);
    animation: toast-countdown linear forwards; transform-origin: left;
}
@keyframes toast-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
```

#### Acceptance Criteria
- [ ] Success toast: message + auto-dismiss 3s + progress bar
- [ ] Undo toast: message + "Hoàn tác" button + auto-dismiss 5s
- [ ] Confirm toast: title + subtitle + 2 buttons, blocks until response
- [ ] Error toast: friendly message + auto-dismiss 4s
- [ ] Multiple toasts stack vertically
- [ ] Dismiss animation smooth (300ms)
- [ ] Accessible: `role="status"`, `aria-live="polite"`

---

### 0.5 Feature Flag
**Effort:** 0.5 ngày

```javascript
// config/feature_flags.js

const FEATURE_FLAGS = {
    ENABLE_AI_COMMANDS: false
};

export async function isFeatureEnabled(flag) {
    const stored = await chrome.storage.local.get([`ff_${flag}`]);
    if (stored[`ff_${flag}`] !== undefined) return stored[`ff_${flag}`];
    return FEATURE_FLAGS[flag] || false;
}

export async function setFeatureFlag(flag, value) {
    await chrome.storage.local.set({ [`ff_${flag}`]: value });
}
```

---

### 0.6 i18n Strings (Non-Tech Vocabulary)
**Effort:** 0.5 ngày

See main spec ([hub_spoke_architecture_spec.md](hub_spoke_architecture_spec.md) Section 1.4) for full vocabulary standard.

Key i18n additions (both EN and VI):

| Key | English | Vietnamese |
|-----|---------|-----------|
| tabChat | Chat | Chat |
| tabNotes | Notes | Ghi chú |
| tabCards | Review | Thẻ ôn |
| tabSaved | Saved | Đã lưu |
| focusWorking | Focusing | Đang tập trung |
| focusBreak | Break time | Nghỉ giải lao |
| btnUndo | Undo | Hoàn tác |
| cmdUnknown | I didn't catch that... | Mình chưa hiểu ý bạn... |
| cmdError | Something went wrong... | Có lỗi xảy ra... |

---

### 0.7 Unit Tests
**Effort:** 1 ngày

Test coverage targets:

| Module | Coverage |
|--------|----------|
| CommandRouter | > 95% |
| IntentParser | > 90% |
| ActionExecutor | > 85% |

Key test scenarios: parse valid action, parse malformed JSON, parse no action, intent match VI, intent match EN, intent validation error, intent no match, execute with confirm, execute with undo, undo success, undo failure.

---

## Files Summary

| File | Type | Purpose |
|------|------|---------|
| `services/command_router.js` | NEW | Parse + route + undo |
| `services/intent_parser.js` | NEW | Client-side regex intent |
| `services/action_executor.js` | NEW | Confirm + execute + undo pipeline |
| `ui/controllers/toast_manager.js` | NEW | 4 toast types |
| `config/feature_flags.js` | NEW | Feature flag system |
| `_locales/en/messages.json` | MODIFY | +30 non-tech strings |
| `_locales/vi/messages.json` | MODIFY | +30 non-tech strings |
| `tests/unit/command_router.test.js` | NEW | Unit tests |

---

## Definition of Done

- [ ] CommandRouter parse + execute + undo works
- [ ] IntentParser matches all Tier 1 commands
- [ ] ActionExecutor confirm + undo pipeline works
- [ ] ToastManager renders 4 types correctly
- [ ] Feature flag OFF by default
- [ ] i18n strings added (EN + VI) - **no jargon on UI**
- [ ] Unit tests pass (> 90% core coverage)
- [ ] No changes visible to users
- [ ] All modules importable as ES modules

---

## Timeline

```
Day 1:     0.1 - CommandRouter
Day 2:     0.2 - IntentParser
Day 3:     0.3 - ActionExecutor
Day 4:     0.4 - ToastManager
Day 5:     0.5 + 0.6 - Feature flag + i18n
Day 6-7:   0.7 - Unit tests + fixes
```
