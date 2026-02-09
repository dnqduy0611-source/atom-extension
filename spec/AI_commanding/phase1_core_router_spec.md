# Phase 1: Core Router + Focus Commands - Detailed Spec

**Version:** 2.0
**Duration:** 1.5 tuần
**Prerequisites:** Phase 0 (Foundation) completed

---

## Mục tiêu Phase 1

Cho phép user **điều khiển Focus Timer** qua 3 cách:
1. **Quick Action Chips** - 1-tap, không cần gõ (primary path)
2. **Text command** - Client-side intent, instant, offline (secondary path)
3. **AI chat** - Natural language → AI returns action tag (fallback path)

**Không thay đổi UI layout hiện tại** - Chỉ thêm Quick Action Chips + command capability.

---

## Task Breakdown

### 1.1 Tích hợp CommandRouter vào sidepanel.js
**Effort:** 1 ngày

#### Implementation

```javascript
// sidepanel.js - Thêm vào đầu file

import { commandRouter } from './services/command_router.js';
import { intentParser } from './services/intent_parser.js';
import { ActionExecutor } from './services/action_executor.js';
import { toastManager } from './ui/controllers/toast_manager.js';
import { isFeatureEnabled } from './config/feature_flags.js';

let actionExecutor;

async function initCommandSystem() {
    const enabled = await isFeatureEnabled('ENABLE_AI_COMMANDS');
    commandRouter.setEnabled(enabled);

    if (enabled) {
        actionExecutor = new ActionExecutor(toastManager);
        toastManager.init();
        registerFocusHandlers();
        registerNavigationHandlers();
        initQuickActions();
    }
}

// Call during sidepanel init
initCommandSystem();
```

#### Acceptance Criteria
- [ ] CommandRouter imported and initialized
- [ ] Feature flag controls enable/disable
- [ ] No errors when feature flag is OFF
- [ ] No visible changes when feature flag is OFF

---

### 1.2 Client-side Intent + AI Dual-Path
**Effort:** 1.5 ngày

#### User input flow

```javascript
// sidepanel.js - Modified send handler

async function handleUserMessage(text) {
    // === PATH 1: Client-side intent (instant, offline) ===
    if (commandRouter.enabled) {
        const intent = intentParser.parse(text);

        if (intent && intent.error) {
            // Validation failed → show hint
            const hintMsg = chrome.i18n.getMessage(intent.hintKey) || 'Giá trị không hợp lệ';
            toastManager.showError(hintMsg);
            return;
        }

        if (intent && intent.command) {
            // Matched! Execute locally (no AI call needed)
            await actionExecutor.handleIntent(intent);
            return;
        }
    }

    // === PATH 2: Send to AI (normal chat + possible action) ===
    appendMessage('user', text);
    const aiText = await sendToAI(text); // existing AI call

    // Parse AI response for action tags
    if (commandRouter.enabled) {
        const { cleanText, actionExecuted } = await actionExecutor.handleAIResponse(aiText);
        appendMessage('ai', cleanText);
    } else {
        appendMessage('ai', aiText);
    }
}
```

#### Acceptance Criteria
- [ ] Client intent match → executes locally, no AI call
- [ ] Client intent miss → falls through to AI
- [ ] AI response with action → action executed, tag stripped from display
- [ ] AI response without action → displayed normally
- [ ] Validation errors → friendly hint toast

---

### 1.3 Focus Command Handlers
**Effort:** 2 ngày

```javascript
// sidepanel.js or services/focus_commands.js

function registerFocusHandlers() {
    // FOCUS_START
    commandRouter.register('FOCUS_START',
        async ({ minutes = 25 }) => {
            const breakMin = Math.ceil(minutes / 5);
            try {
                const result = await chrome.runtime.sendMessage({
                    type: 'FOCUS_START',
                    payload: { workMin: minutes, breakMin }
                });
                return {
                    success: true,
                    message: chrome.i18n.getMessage('focusStarted', [String(minutes)])
                        || `Bắt đầu tập trung ${minutes} phút`,
                    data: { minutes, breakMin }
                };
            } catch (error) {
                return {
                    success: false,
                    message: chrome.i18n.getMessage('cmdError')
                        || 'Có lỗi xảy ra, thử lại nhé!'
                };
            }
        },
        // Undo handler: stop the timer
        async () => {
            await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
        }
    );

    // FOCUS_STOP
    commandRouter.register('FOCUS_STOP',
        async () => {
            try {
                await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
                return {
                    success: true,
                    message: chrome.i18n.getMessage('focusStopped')
                        || 'Đã kết thúc phiên tập trung'
                };
            } catch (error) {
                return {
                    success: false,
                    message: chrome.i18n.getMessage('cmdError')
                        || 'Có lỗi xảy ra, thử lại nhé!'
                };
            }
        }
        // No undo for stop
    );

    // FOCUS_PAUSE
    commandRouter.register('FOCUS_PAUSE',
        async () => {
            try {
                await chrome.runtime.sendMessage({ type: 'FOCUS_PAUSE' });
                return {
                    success: true,
                    message: chrome.i18n.getMessage('focusPaused')
                        || 'Tạm dừng'
                };
            } catch (error) {
                return {
                    success: false,
                    message: chrome.i18n.getMessage('cmdError')
                        || 'Có lỗi xảy ra, thử lại nhé!'
                };
            }
        }
    );
}

function registerNavigationHandlers() {
    commandRouter.register('OPEN_NOTES', async () => {
        // Will be implemented in Phase 2 (tab switch)
        // For now, open memory.html
        chrome.tabs.create({ url: chrome.runtime.getURL('memory.html') });
        return { success: true, message: '' }; // Silent navigation
    });

    commandRouter.register('OPEN_DIARY', async () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('journal.html') });
        return { success: true, message: '' };
    });

    commandRouter.register('OPEN_SETTINGS', async () => {
        chrome.runtime.openOptionsPage();
        return { success: true, message: '' };
    });
}
```

#### Acceptance Criteria
- [ ] FOCUS_START sends correct message to background, shows success toast
- [ ] FOCUS_STOP sends stop message, shows success toast
- [ ] FOCUS_PAUSE sends pause message, shows success toast
- [ ] FOCUS_START undo → stops the timer
- [ ] Navigation commands open correct pages
- [ ] Error handling: friendly message, no crash
- [ ] All messages use i18n strings

---

### 1.4 Quick Action Chips
**Effort:** 1.5 ngày

Quick Action Chips = **primary path** for non-tech users. Buttons > text.

#### Design

```
Khi Side Panel mở, KHÔNG có Focus session:
┌─────────────────────────────────────┐
│ [🎯 Tập trung 25p] [📝 Ghi nhanh] │
│ [🃏 Ôn tập thẻ]                    │
└─────────────────────────────────────┘

Khi ĐANG Focus:
┌─────────────────────────────────────┐
│ [⏸️ Tạm dừng] [⏹️ Dừng tập trung]  │
└─────────────────────────────────────┘
```

#### HTML

```html
<!-- sidepanel.html - Above chat input area -->
<div class="sp-quick-actions" id="quick-actions" role="toolbar" aria-label="Quick actions">
    <!-- Dynamically rendered -->
</div>
```

#### JavaScript: `ui/controllers/quick_actions.js`

```javascript
// ui/controllers/quick_actions.js

class QuickActionsController {
    constructor(actionExecutor) {
        this.container = document.getElementById('quick-actions');
        this.executor = actionExecutor;
        this.focusActive = false;

        this.render();
        this.listenFocusState();
    }

    render() {
        if (!this.container) return;

        const chips = this.focusActive
            ? this.getFocusActiveChips()
            : this.getDefaultChips();

        this.container.innerHTML = chips.map(chip => `
            <button class="sp-chip" data-command="${chip.command}"
                    data-params='${JSON.stringify(chip.params || {})}'>
                <span class="sp-chip__icon">${chip.icon}</span>
                <span class="sp-chip__label">${chip.label}</span>
            </button>
        `).join('');

        this.container.querySelectorAll('.sp-chip').forEach(btn => {
            btn.addEventListener('click', () => this.onChipTap(btn));
        });
    }

    getDefaultChips() {
        return [
            {
                icon: '🎯',
                label: chrome.i18n.getMessage('chipFocus25') || 'Tập trung 25p',
                command: 'FOCUS_START',
                params: { minutes: 25 }
            },
            {
                icon: '📝',
                label: chrome.i18n.getMessage('chipQuickDiary') || 'Ghi nhanh',
                command: 'QUICK_DIARY' // Opens quick diary widget
            },
            {
                icon: '🃏',
                label: chrome.i18n.getMessage('chipReview') || 'Ôn tập thẻ',
                command: 'OPEN_CARDS'
            }
        ];
    }

    getFocusActiveChips() {
        return [
            {
                icon: '⏸️',
                label: chrome.i18n.getMessage('btnPause') || 'Tạm dừng',
                command: 'FOCUS_PAUSE'
            },
            {
                icon: '⏹️',
                label: chrome.i18n.getMessage('btnStop') || 'Dừng tập trung',
                command: 'FOCUS_STOP'
            }
        ];
    }

    async onChipTap(btn) {
        const command = btn.dataset.command;
        const params = JSON.parse(btn.dataset.params || '{}');

        // Special: Quick Diary opens widget, not a command
        if (command === 'QUICK_DIARY') {
            document.getElementById('quick-diary')?.classList.add('expanded');
            return;
        }

        // Special: Open Cards tab (Phase 2)
        if (command === 'OPEN_CARDS') {
            // Phase 2 will switch tab. For now, do nothing or show coming soon
            return;
        }

        // Get intent config for confirm/undoable settings
        const intent = {
            command,
            params,
            confirm: ['FOCUS_START', 'FOCUS_STOP'].includes(command),
            undoable: command === 'FOCUS_START'
        };

        await this.executor.handleIntent(intent);
    }

    listenFocusState() {
        // Listen for focus state changes
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'FOCUS_STATE_UPDATED' || msg.type === 'FOCUS_TICK') {
                const wasActive = this.focusActive;
                this.focusActive = msg.payload?.active || false;
                if (wasActive !== this.focusActive) {
                    this.render();
                }
            }
        });

        // Get initial state
        chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' }).then(res => {
            this.focusActive = res?.atom_focus_state?.active || false;
            this.render();
        });
    }
}

export { QuickActionsController };
```

#### CSS

```css
.sp-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
}

.sp-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--foreground);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.sp-chip:hover {
    border-color: var(--primary);
    color: var(--primary);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
}

.sp-chip:active {
    transform: translateY(0);
}

.sp-chip__icon {
    font-size: 14px;
}

.sp-chip__label {
    font-size: 12px;
}

/* Responsive: narrower side panel */
@media (max-width: 300px) {
    .sp-chip__label { display: none; }
    .sp-chip { padding: 8px 10px; }
    .sp-chip__icon { font-size: 16px; }
}
```

#### Acceptance Criteria
- [ ] Default chips: Focus 25p, Ghi nhanh, Ôn tập thẻ
- [ ] When Focus active: chips change to Tạm dừng, Dừng
- [ ] Chip tap → confirmation → execute (< 500ms)
- [ ] Context-aware: chips update when focus state changes
- [ ] Responsive: icon-only on narrow panels
- [ ] i18n for all labels
- [ ] Accessible: `role="toolbar"`, keyboard navigation

---

### 1.5 AI System Prompt Enhancement
**Effort:** 0.5 ngày

```javascript
// config/ai_config.js or background.js

const COMMAND_SYSTEM_PROMPT = `
## COMMAND CAPABILITIES

Bạn có thể thực hiện các hành động khi user yêu cầu:

### Focus (Tập trung)
- Bật Focus: [ACTION:FOCUS_START:{"minutes":25}]
- Dừng Focus: [ACTION:FOCUS_STOP]

### Quy tắc
1. Chỉ dùng ACTION khi user YÊU CẦU RÕ RÀNG
2. Đặt ACTION tag ở CUỐI response, trên dòng riêng
3. Nếu không chắc chắn, HỎI lại user
4. Luôn XÁC NHẬN sau khi thực hiện
5. minutes phải là số từ 1-180

### Ví dụ
User: "Bật pomodoro 25 phút"
AI: "Được rồi, bắt đầu tập trung 25 phút nhé! 🎯
[ACTION:FOCUS_START:{"minutes":25}]"

User: "Focus"
AI: "Bạn muốn tập trung bao lâu? Thường thì 25 phút là phổ biến nhất."

User: "Dừng timer"
AI: "Đã dừng phiên tập trung. Bạn làm tốt lắm! 💪
[ACTION:FOCUS_STOP]"
`;

// Append to existing system prompt
function buildSystemPrompt(existingPrompt) {
    if (!commandRouter.enabled) return existingPrompt;
    return existingPrompt + '\n\n' + COMMAND_SYSTEM_PROMPT;
}
```

#### Acceptance Criteria
- [ ] System prompt appended only when feature enabled
- [ ] Doesn't break existing prompt
- [ ] AI understands and responds with correct ACTION format

---

### 1.6 Confirmation Dialog for Destructive Actions
**Effort:** 0.5 ngày

Already implemented in ActionExecutor (Phase 0). In Phase 1, ensure:

- FOCUS_START: confirm = true (show "Bắt đầu tập trung 25 phút?")
- FOCUS_STOP: confirm = true (show "Dừng phiên tập trung? Bạn đã tập trung được X phút.")
- FOCUS_PAUSE: confirm = false (non-destructive)

#### Enhanced FOCUS_STOP confirmation

```javascript
// Get elapsed time for confirmation message
commandRouter.register('FOCUS_STOP', async () => {
    const stateRes = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
    const state = stateRes?.atom_focus_state;

    // Only confirm if actually running
    if (!state?.active) {
        return {
            success: false,
            message: chrome.i18n.getMessage('focusNotRunning')
                || 'Không có phiên tập trung nào đang chạy.'
        };
    }

    await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
    return {
        success: true,
        message: chrome.i18n.getMessage('focusStopped')
            || 'Đã kết thúc phiên tập trung'
    };
});
```

---

### 1.7 Natural Language Testing
**Effort:** 1 ngày

#### Test Matrix: Client-side Intent (Tier 1)

| Input | Path | Expected |
|-------|------|----------|
| "Bật pomodoro 25 phút" | Client | Confirm → FOCUS_START(25) |
| "Focus 40 phút" | Client | Confirm → FOCUS_START(40) |
| "Tập trung 30p" | Client | Confirm → FOCUS_START(30) |
| "Start focus 50 minutes" | Client | Confirm → FOCUS_START(50) |
| "25 phút focus" | Client | Confirm → FOCUS_START(25) |
| "Dừng timer" | Client | Confirm → FOCUS_STOP |
| "Stop focus" | Client | Confirm → FOCUS_STOP |
| "Tạm dừng" | Client | FOCUS_PAUSE |
| "Mở ghi chú" | Client | OPEN_NOTES |
| "Mở cài đặt" | Client | OPEN_SETTINGS |
| [🎯 Tập trung 25p] chip | Chip | Confirm → FOCUS_START(25) |
| [⏹️ Dừng] chip | Chip | Confirm → FOCUS_STOP |

#### Test Matrix: AI Path (Tier 2)

| Input | Path | Expected |
|-------|------|----------|
| "Focus" (mơ hồ) | AI | AI hỏi "Bạn muốn tập trung bao lâu?" |
| "Tôi muốn tập trung" | AI | AI hỏi thời gian |
| "Giúp tôi tập trung" | AI | AI hỏi or suggest 25 phút |
| "Hello" | AI | Normal chat, no action |

#### Edge Cases

| Input | Expected |
|-------|----------|
| "Focus 0 phút" | Error toast: "Thời gian ít nhất 1 phút" |
| "Focus 999 phút" | Error toast: "Tối đa 180 phút" |
| "Dừng" khi không có timer | Toast: "Không có phiên tập trung nào" |
| Rapid chip taps | Debounce, only 1 action |

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `sidepanel.js` | MODIFY | Import router, dual-path handler |
| `sidepanel.html` | MODIFY | Quick action chips container |
| `ui/controllers/quick_actions.js` | NEW | Quick action chips controller |
| `config/ai_config.js` | MODIFY | Command system prompt |
| `background.js` | MODIFY | Append command prompt to AI calls |

---

## Definition of Done

- [ ] Client-side intent works for Focus + Navigation (instant, offline)
- [ ] AI fallback works for ambiguous commands
- [ ] Quick Action Chips render and execute correctly
- [ ] Chips change based on focus state (context-aware)
- [ ] Confirmation dialog for FOCUS_START and FOCUS_STOP
- [ ] Undo toast for FOCUS_START
- [ ] All i18n strings use non-tech vocabulary
- [ ] 90%+ test cases pass
- [ ] No regressions in existing chat flow
- [ ] Feature flag can disable everything

---

## Timeline

```
Day 1:     1.1 - Integrate CommandRouter
Day 2-3:   1.2 - Dual-path handler
Day 4-5:   1.3 - Focus command handlers
Day 6-7:   1.4 - Quick Action Chips
Day 8:     1.5 + 1.6 - AI prompt + confirmation
Day 9:     1.7 - Testing
Day 10:    Buffer + bug fixes
```
