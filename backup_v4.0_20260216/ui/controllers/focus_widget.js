// ui/controllers/focus_widget.js
// Wave A: Extract compact focus widget logic.

(function () {
    'use strict';

    function msg(key, fallback) {
        try {
            const text = chrome.i18n.getMessage(key);
            if (text) return text;
        } catch (e) {
            // ignore
        }
        return fallback;
    }

    function isActive(state) {
        return !!state?.enabled;
    }

    function getTotalMs(state) {
        if (!state) return 0;
        const phase = String(state.phase || '').toUpperCase();
        if (phase === 'BREAK') return Math.max(0, Number(state.breakMin || 0) * 60 * 1000);
        return Math.max(0, Number(state.workMin || 0) * 60 * 1000);
    }

    class FocusWidget {
        constructor(options) {
            this.containerId = options?.containerId || 'focus-widget';
            this.executor = options?.actionExecutor || null;
            this.container = null;
            this.state = null;
            this.rafId = null;
            this.lastTickAt = 0;
            this.onRuntimeMessage = this.onRuntimeMessage.bind(this);
        }

        async init() {
            this.container = document.getElementById(this.containerId);
            if (!this.container) return false;

            this.container.classList.add('active');
            await this.refreshState();
            this.render();
            this.listenStateUpdates();
            this.startTick();
            return true;
        }

        destroy() {
            chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
            if (this.rafId) cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        listenStateUpdates() {
            chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
        }

        onRuntimeMessage(message) {
            const type = message?.type;
            if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED') return;
            const nextState = message?.payload?.atom_focus_state || message?.payload || null;
            this.state = nextState;
            this.render();
        }

        async refreshState() {
            try {
                const response = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
                this.state = response?.atom_focus_state || null;
            } catch (e) {
                this.state = null;
            }
        }

        startTick() {
            if (this.rafId) cancelAnimationFrame(this.rafId);
            const tick = (ts) => {
                if (isActive(this.state)) {
                    if (!this.lastTickAt || ts - this.lastTickAt >= 1000) {
                        this.lastTickAt = ts;
                        this.render();
                    }
                } else {
                    this.lastTickAt = ts;
                }
                this.rafId = requestAnimationFrame(tick);
            };
            this.rafId = requestAnimationFrame(tick);
        }

        getRemainingMs() {
            if (!this.state?.phaseEndsAt) return 0;
            return Math.max(0, Number(this.state.phaseEndsAt) - Date.now());
        }

        formatTime(ms) {
            const totalSec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
            const min = Math.floor(totalSec / 60);
            const sec = totalSec % 60;
            return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        }

        getProgressPct() {
            const total = getTotalMs(this.state);
            if (!total) return 0;
            const remaining = this.getRemainingMs();
            const elapsed = Math.max(0, total - remaining);
            return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
        }

        render() {
            if (!this.container) return;
            if (!isActive(this.state)) {
                this.renderIdle();
                return;
            }

            const phase = String(this.state?.phase || '').toUpperCase();
            if (phase === 'BREAK') this.renderBreak();
            else this.renderActive();
        }

        renderIdle() {
            this.container.innerHTML = `
                <div class="sp-focus-widget__idle">
                    <span class="sp-focus-widget__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
                    <span class="sp-focus-widget__label">${msg('focusIdle', 'Ready to focus')}</span>
                    <div class="sp-focus-widget__presets">
                        <button type="button" class="sp-focus-widget__preset" data-min="25">25p</button>
                        <button type="button" class="sp-focus-widget__preset" data-min="40">40p</button>
                        <button type="button" class="sp-focus-widget__preset" data-min="50">50p</button>
                    </div>
                </div>
            `;

            this.container.querySelectorAll('.sp-focus-widget__preset').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const minutes = Number(btn.dataset.min || 25);
                    this.startFocus(minutes);
                });
            });
        }

        renderActive() {
            const remaining = this.getRemainingMs();
            const progressPct = this.getProgressPct();
            this.container.innerHTML = `
                <div class="sp-focus-widget__active">
                    <div class="sp-focus-widget__row">
                        <span class="sp-focus-widget__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
                        <span class="sp-focus-widget__label">${msg('focusWorking', 'In focus')}</span>
                        <span class="sp-focus-widget__time">${this.formatTime(remaining)}</span>
                        <button type="button" class="sp-focus-widget__btn" data-action="pause">${msg('btnPause', 'Pause')}</button>
                        <button type="button" class="sp-focus-widget__btn" data-action="stop">${msg('btnStop', 'Stop')}</button>
                    </div>
                    <div class="sp-focus-widget__progress">
                        <div class="sp-focus-widget__bar" style="width:${progressPct}%"></div>
                    </div>
                </div>
            `;

            this.container.querySelector('[data-action="pause"]')?.addEventListener('click', () => this.pauseFocus());
            this.container.querySelector('[data-action="stop"]')?.addEventListener('click', () => this.stopFocus());
        }

        renderBreak() {
            const remaining = this.getRemainingMs();
            const progressPct = this.getProgressPct();
            this.container.innerHTML = `
                <div class="sp-focus-widget__break">
                    <div class="sp-focus-widget__row">
                        <span class="sp-focus-widget__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg></span>
                        <span class="sp-focus-widget__label">${msg('focusBreak', 'Break time')}</span>
                        <span class="sp-focus-widget__time">${this.formatTime(remaining)}</span>
                    </div>
                    <div class="sp-focus-widget__progress">
                        <div class="sp-focus-widget__bar break" style="width:${progressPct}%"></div>
                    </div>
                </div>
            `;
        }

        async startFocus(minutes) {
            if (this.executor?.handleIntent) {
                await this.executor.handleIntent({
                    command: 'FOCUS_START',
                    params: { minutes: minutes },
                    confirm: true,
                    undoable: true
                });
                return;
            }
            await chrome.runtime.sendMessage({
                type: 'FOCUS_START',
                payload: { workMin: minutes, breakMin: Math.max(1, Math.ceil(minutes / 5)) }
            });
        }

        async pauseFocus() {
            if (this.executor?.handleIntent) {
                await this.executor.handleIntent({
                    command: 'FOCUS_PAUSE',
                    params: {},
                    confirm: false,
                    undoable: false
                });
                return;
            }
            await chrome.runtime.sendMessage({ type: 'FOCUS_PAUSE' });
        }

        async stopFocus() {
            if (this.executor?.handleIntent) {
                await this.executor.handleIntent({
                    command: 'FOCUS_STOP',
                    params: {},
                    confirm: true,
                    undoable: false
                });
                return;
            }
            await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
        }
    }

    window.FocusWidget = FocusWidget;
})();
