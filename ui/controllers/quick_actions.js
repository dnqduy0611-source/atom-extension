// ui/controllers/quick_actions.js
// Phase 1: Focus command chips (separate from existing summarize chips).

(function () {
    'use strict';

    function getMessage(key, fallback) {
        try {
            const value = chrome.i18n.getMessage(key);
            if (value) return value;
        } catch (e) {
            // ignore
        }
        return fallback;
    }

    function isFocusActive(state) {
        if (!state) return false;
        if (typeof state.active === 'boolean') return state.active;
        return !!state.enabled;
    }

    function safeParseJSON(raw, fallback) {
        try {
            return JSON.parse(raw || '{}');
        } catch (e) {
            return fallback || {};
        }
    }

    class QuickActionsController {
        constructor(actionExecutor, opts) {
            this.executor = actionExecutor;
            this.containerId = opts?.containerId || 'quick-actions-command';
            this.container = null;
            this.focusActive = false;
            this.lastClickAt = 0;
            this.minTapIntervalMs = 350;
            this.onRuntimeMessage = this.onRuntimeMessage.bind(this);
        }

        async init() {
            this.container = document.getElementById(this.containerId);
            if (!this.container || !this.executor) return;
            this.container.classList.add('active');
            this.render();
            await this.refreshFocusState();
            this.listenFocusState();
        }

        destroy() {
            chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
        }

        getDefaultChips() {
            return [
                {
                    icon: '🎯',
                    label: getMessage('chipFocus25', 'Focus 25m'),
                    command: 'FOCUS_START',
                    params: { minutes: 25 },
                    confirm: true,
                    undoable: true
                },
                {
                    icon: '📝',
                    label: getMessage('chipQuickDiary', 'Quick note'),
                    command: 'OPEN_DIARY'
                },
                {
                    icon: '🃏',
                    label: getMessage('chipReview', 'Saved items'),
                    command: 'OPEN_SAVED'
                }
            ];
        }

        getFocusActiveChips() {
            return [
                {
                    icon: '⏸️',
                    label: getMessage('btnPause', 'Pause'),
                    command: 'FOCUS_PAUSE'
                },
                {
                    icon: '⏹️',
                    label: getMessage('btnStop', 'Stop'),
                    command: 'FOCUS_STOP',
                    confirm: true
                }
            ];
        }

        render() {
            if (!this.container) return;

            // Hide when focus active — FocusWidget already has Pause/Stop buttons
            if (this.focusActive) {
                this.container.innerHTML = '';
                this.container.classList.remove('active');
                return;
            }
            this.container.classList.add('active');

            const chips = this.getDefaultChips();

            this.container.innerHTML = chips.map((chip) => {
                const params = JSON.stringify(chip.params || {});
                const confirm = chip.confirm ? '1' : '0';
                const undoable = chip.undoable ? '1' : '0';
                return (
                    `<button class="sp-cmd-chip" type="button"` +
                    ` data-command="${chip.command}"` +
                    ` data-params='${params}'` +
                    ` data-confirm="${confirm}"` +
                    ` data-undoable="${undoable}">` +
                    `<span class="sp-cmd-chip__icon" aria-hidden="true">${chip.icon}</span>` +
                    `<span class="sp-cmd-chip__label">${chip.label}</span>` +
                    `</button>`
                );
            }).join('');

            const chipButtons = this.container.querySelectorAll('.sp-cmd-chip');
            chipButtons.forEach((btn) => {
                btn.addEventListener('click', () => this.onChipTap(btn));
            });
        }

        async onChipTap(btn) {
            const now = Date.now();
            if (now - this.lastClickAt < this.minTapIntervalMs) return;
            this.lastClickAt = now;

            const command = btn.dataset.command;
            const params = safeParseJSON(btn.dataset.params, {});
            const confirm = btn.dataset.confirm === '1';
            const undoable = btn.dataset.undoable === '1';

            if (!command || !this.executor) return;
            await this.executor.handleIntent({
                command,
                params,
                confirm,
                undoable
            });
        }

        listenFocusState() {
            chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
        }

        onRuntimeMessage(msg) {
            const type = msg?.type;
            if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED' && type !== 'FOCUS_TICK') {
                return;
            }
            const payloadState = msg?.payload?.atom_focus_state || msg?.payload || null;
            this.updateFocusState(payloadState);
        }

        updateFocusState(state) {
            const next = isFocusActive(state);
            if (next === this.focusActive) return;
            this.focusActive = next;
            this.render();
        }

        async refreshFocusState() {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
                const state = response?.atom_focus_state || null;
                this.focusActive = isFocusActive(state);
                this.render();
            } catch (e) {
                this.focusActive = false;
                this.render();
            }
        }
    }

    window.QuickActionsController = QuickActionsController;
})();
