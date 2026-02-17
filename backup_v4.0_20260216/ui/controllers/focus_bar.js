// ui/controllers/focus_bar.js
// Inline focus timer bar — compact replacement for FocusWidget.
// Only shows when focus IS active. No idle state rendering.

(function () {
    'use strict';

    function msg(key, fallback) {
        try { var r = chrome.i18n.getMessage(key); if (r) return r; } catch (e) { /* ignore */ }
        return fallback;
    }

    function FocusBarController(actionExecutor) {
        this.executor = actionExecutor;
        this.el = null;
        this.state = null;
        this.rafId = null;
        this.lastTick = 0;
        this._onMsg = this._onMsg.bind(this);
    }

    FocusBarController.prototype.init = async function () {
        this.el = document.getElementById('focus-bar');
        if (!this.el) return;

        var self = this;
        document.getElementById('focus-bar-pause')?.addEventListener('click', function () { self._pause(); });
        document.getElementById('focus-bar-stop')?.addEventListener('click', function () { self._stop(); });

        chrome.runtime.onMessage.addListener(this._onMsg);
        await this._refresh();
        this._startTick();
    };

    FocusBarController.prototype.destroy = function () {
        chrome.runtime.onMessage.removeListener(this._onMsg);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    };

    FocusBarController.prototype._onMsg = function (message) {
        var type = message && message.type;
        if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED') return;
        this.state = (message.payload && message.payload.atom_focus_state) || message.payload || null;
        this._render();
    };

    FocusBarController.prototype._refresh = async function () {
        try {
            var res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
            this.state = (res && res.atom_focus_state) || null;
        } catch (e) {
            this.state = null;
        }
        this._render();
    };

    FocusBarController.prototype._startTick = function () {
        var self = this;
        function tick(ts) {
            if (self.state && self.state.enabled) {
                if (!self.lastTick || ts - self.lastTick >= 1000) {
                    self.lastTick = ts;
                    self._render();
                }
            } else {
                self.lastTick = 0;
            }
            self.rafId = requestAnimationFrame(tick);
        }
        this.rafId = requestAnimationFrame(tick);
    };

    FocusBarController.prototype._render = function () {
        if (!this.el) return;

        if (!this.state || !this.state.enabled) {
            this.el.classList.remove('active');
            this.el.style.display = 'none';
            return;
        }

        this.el.classList.add('active');
        this.el.style.display = 'flex';

        var phase = String(this.state.phase || '').toUpperCase();
        var isBreak = phase === 'BREAK';

        var labelEl = document.getElementById('focus-bar-label');
        if (labelEl) labelEl.textContent = isBreak ? msg('focusBreak', 'Break') : msg('focusWorking', 'Focus');

        var remaining = Math.max(0, (this.state.phaseEndsAt || 0) - Date.now());
        var totalSec = Math.floor(remaining / 1000);
        var m = String(Math.floor(totalSec / 60)).padStart(2, '0');
        var s = String(totalSec % 60).padStart(2, '0');

        var timeEl = document.getElementById('focus-bar-time');
        if (timeEl) timeEl.textContent = m + ':' + s;

        var totalMs = isBreak
            ? Math.max(0, (this.state.breakMin || 0) * 60000)
            : Math.max(0, (this.state.workMin || 0) * 60000);
        var pct = totalMs ? Math.round(((totalMs - remaining) / totalMs) * 100) : 0;

        var fillEl = document.getElementById('focus-bar-fill');
        if (fillEl) {
            fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
            if (isBreak) {
                fillEl.classList.add('break');
            } else {
                fillEl.classList.remove('break');
            }
        }

        var pauseBtn = document.getElementById('focus-bar-pause');
        if (pauseBtn) pauseBtn.style.display = isBreak ? 'none' : '';
    };

    FocusBarController.prototype._pause = async function () {
        if (this.executor && this.executor.handleIntent) {
            await this.executor.handleIntent({ command: 'FOCUS_PAUSE', params: {}, confirm: false, undoable: false });
        }
    };

    FocusBarController.prototype._stop = async function () {
        if (this.executor && this.executor.handleIntent) {
            await this.executor.handleIntent({ command: 'FOCUS_STOP', params: {}, confirm: true, undoable: false });
        }
    };

    window.FocusBarController = FocusBarController;
})();
