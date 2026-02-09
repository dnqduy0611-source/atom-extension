// ui/controllers/toast_manager.js
// Command-system Toast Manager — success, undo, confirm, error toasts.
// Coexists with existing showToast()/showUndoToast() in sidepanel.js.
// Phase 0: Foundation

(function () {
    'use strict';

    var CONTAINER_ID = 'atom-cmd-toast-container';
    var STYLES_ID = 'atom-cmd-toast-styles';
    var container = null;

    function msg(key, fallback) {
        try { var r = chrome.i18n.getMessage(key); if (r) return r; } catch (e) { /* */ }
        return fallback;
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ---- CSS injection (CSS-in-JS pattern) ----

    function injectStyles() {
        if (document.getElementById(STYLES_ID)) return;

        var style = document.createElement('style');
        style.id = STYLES_ID;
        style.textContent = [
            '.cmd-toast-container {',
            '  position: fixed;',
            '  bottom: 80px;',
            '  left: 50%;',
            '  transform: translateX(-50%);',
            '  z-index: 10000;',
            '  display: flex;',
            '  flex-direction: column-reverse;',
            '  gap: 8px;',
            '  pointer-events: none;',
            '  width: calc(100% - 32px);',
            '  max-width: 360px;',
            '}',

            '.cmd-toast {',
            '  pointer-events: auto;',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 10px;',
            '  padding: 10px 14px;',
            '  border-radius: 10px;',
            '  font-size: 13px;',
            '  line-height: 1.4;',
            '  color: var(--foreground, #fff);',
            '  background: var(--surface, rgba(255,255,255,0.05));',
            '  border: 1px solid var(--border, rgba(255,255,255,0.1));',
            '  backdrop-filter: blur(12px);',
            '  box-shadow: 0 4px 16px rgba(0,0,0,0.3);',
            '  animation: cmdToastIn 0.25s ease-out;',
            '  transition: opacity 0.2s, transform 0.2s;',
            '}',

            '.cmd-toast.removing {',
            '  opacity: 0;',
            '  transform: translateY(8px);',
            '}',

            '.cmd-toast-icon {',
            '  flex-shrink: 0;',
            '  font-size: 16px;',
            '}',

            '.cmd-toast-body {',
            '  flex: 1;',
            '  min-width: 0;',
            '}',

            '.cmd-toast-title {',
            '  font-weight: 600;',
            '  font-size: 13px;',
            '}',

            '.cmd-toast-subtitle {',
            '  font-size: 12px;',
            '  color: var(--muted, #a3a3a3);',
            '  margin-top: 2px;',
            '}',

            '.cmd-toast-actions {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 8px;',
            '  flex-shrink: 0;',
            '}',

            '.cmd-toast-btn {',
            '  background: none;',
            '  border: 1px solid var(--border, rgba(255,255,255,0.15));',
            '  color: var(--primary, #10B981);',
            '  font-size: 12px;',
            '  font-weight: 600;',
            '  padding: 4px 10px;',
            '  border-radius: 6px;',
            '  cursor: pointer;',
            '  transition: background 0.15s;',
            '}',

            '.cmd-toast-btn:hover {',
            '  background: rgba(255,255,255,0.08);',
            '}',

            '.cmd-toast-btn.primary {',
            '  background: var(--primary, #10B981);',
            '  color: #fff;',
            '  border-color: transparent;',
            '}',

            '.cmd-toast-btn.primary:hover {',
            '  filter: brightness(1.1);',
            '}',

            '.cmd-toast-btn.cancel {',
            '  color: var(--muted, #a3a3a3);',
            '}',

            /* Undo countdown ring */
            '.cmd-countdown {',
            '  display: flex;',
            '  align-items: center;',
            '  gap: 4px;',
            '}',

            '.cmd-countdown-ring {',
            '  width: 20px;',
            '  height: 20px;',
            '  transform: rotate(-90deg);',
            '}',

            '.cmd-countdown-ring .bg {',
            '  fill: none;',
            '  stroke: var(--border, rgba(255,255,255,0.1));',
            '  stroke-width: 2;',
            '}',

            '.cmd-countdown-ring .progress {',
            '  fill: none;',
            '  stroke: var(--primary, #10B981);',
            '  stroke-width: 2;',
            '  stroke-linecap: round;',
            '  transition: stroke-dashoffset 1s linear;',
            '}',

            '.cmd-countdown-text {',
            '  font-size: 11px;',
            '  color: var(--muted, #a3a3a3);',
            '  min-width: 12px;',
            '  text-align: center;',
            '}',

            /* Success accent */
            '.cmd-toast.success { border-left: 3px solid var(--primary, #10B981); }',
            '.cmd-toast.error   { border-left: 3px solid #ef4444; }',
            '.cmd-toast.undo    { border-left: 3px solid #f59e0b; }',
            '.cmd-toast.confirm { border-left: 3px solid #6366f1; }',

            '@keyframes cmdToastIn {',
            '  from { opacity: 0; transform: translateY(12px); }',
            '  to   { opacity: 1; transform: translateY(0); }',
            '}'
        ].join('\n');

        document.head.appendChild(style);
    }

    // ---- Container ----

    function ensureContainer() {
        if (container && document.body.contains(container)) return container;
        injectStyles();
        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.className = 'cmd-toast-container';
        document.body.appendChild(container);
        return container;
    }

    // ---- Helpers ----

    function removeToast(el, delay) {
        setTimeout(function () {
            el.classList.add('removing');
            setTimeout(function () { el.remove(); }, 220);
        }, delay);
    }

    // ---- Public API ----

    /**
     * Show a success toast (auto-dismiss).
     * @param {string} message
     * @param {number} [duration=3000]
     */
    function showSuccess(message, duration) {
        if (duration === undefined) duration = 3000;
        var c = ensureContainer();
        var el = document.createElement('div');
        el.className = 'cmd-toast success';
        el.innerHTML =
            '<span class="cmd-toast-icon">✓</span>' +
            '<span class="cmd-toast-body">' + escapeHtml(message) + '</span>';
        c.appendChild(el);
        removeToast(el, duration);
    }

    /**
     * Show an error toast (auto-dismiss).
     * @param {string} message
     * @param {number} [duration=4000]
     */
    function showError(message, duration) {
        if (duration === undefined) duration = 4000;
        var c = ensureContainer();
        var el = document.createElement('div');
        el.className = 'cmd-toast error';
        el.innerHTML =
            '<span class="cmd-toast-icon">✕</span>' +
            '<span class="cmd-toast-body">' + escapeHtml(message) + '</span>';
        c.appendChild(el);
        removeToast(el, duration);
    }

    /**
     * Show an undo toast with countdown.
     * @param {string} message
     * @param {function} undoCallback - called if user clicks undo
     * @param {number} [duration=5000]
     */
    function showUndo(message, undoCallback, duration) {
        if (duration === undefined) duration = 5000;
        var seconds = Math.round(duration / 1000);
        var c = ensureContainer();
        var el = document.createElement('div');
        el.className = 'cmd-toast undo';

        var undoLabel = msg('cmd_undo', 'Undo');
        var circumference = 2 * Math.PI * 8; // r=8

        el.innerHTML =
            '<span class="cmd-toast-icon">↩</span>' +
            '<span class="cmd-toast-body">' + escapeHtml(message) + '</span>' +
            '<div class="cmd-toast-actions">' +
                '<button class="cmd-toast-btn">' + escapeHtml(undoLabel) + '</button>' +
                '<div class="cmd-countdown">' +
                    '<svg class="cmd-countdown-ring" viewBox="0 0 20 20">' +
                        '<circle class="bg" cx="10" cy="10" r="8"/>' +
                        '<circle class="progress" cx="10" cy="10" r="8" ' +
                            'style="stroke-dasharray:' + circumference + ';stroke-dashoffset:0"/>' +
                    '</svg>' +
                    '<span class="cmd-countdown-text">' + seconds + '</span>' +
                '</div>' +
            '</div>';

        c.appendChild(el);

        var btn = el.querySelector('.cmd-toast-btn');
        var progressCircle = el.querySelector('.progress');
        var countdownText = el.querySelector('.cmd-countdown-text');
        var remaining = seconds;
        var undone = false;

        var interval = setInterval(function () {
            remaining--;
            if (countdownText) countdownText.textContent = remaining;
            if (progressCircle) {
                var offset = circumference * ((seconds - remaining) / seconds);
                progressCircle.style.strokeDashoffset = offset;
            }
            if (remaining <= 0) clearInterval(interval);
        }, 1000);

        btn.addEventListener('click', function () {
            if (undone) return;
            undone = true;
            clearInterval(interval);
            el.classList.add('removing');
            setTimeout(function () { el.remove(); }, 220);
            if (typeof undoCallback === 'function') undoCallback();
        });

        // Auto-dismiss
        setTimeout(function () {
            if (undone) return;
            clearInterval(interval);
            el.classList.add('removing');
            setTimeout(function () { el.remove(); }, 220);
        }, duration);
    }

    /**
     * Show a confirm toast (blocking decision).
     * Returns a Promise that resolves to true (confirm) or false (cancel).
     * @param {object} opts
     * @param {string} opts.title
     * @param {string} [opts.subtitle]
     * @param {string} [opts.confirmLabel]
     * @param {string} [opts.cancelLabel]
     * @returns {Promise<boolean>}
     */
    function showConfirm(opts) {
        var c = ensureContainer();
        var el = document.createElement('div');
        el.className = 'cmd-toast confirm';

        var confirmLabel = opts.confirmLabel || msg('cmd_confirm_yes', 'OK');
        var cancelLabel = opts.cancelLabel || msg('cmd_confirm_no', 'Cancel');

        var body = '<span class="cmd-toast-icon">?</span>' +
            '<div class="cmd-toast-body">' +
                '<div class="cmd-toast-title">' + escapeHtml(opts.title) + '</div>' +
                (opts.subtitle ? '<div class="cmd-toast-subtitle">' + escapeHtml(opts.subtitle) + '</div>' : '') +
            '</div>' +
            '<div class="cmd-toast-actions">' +
                '<button class="cmd-toast-btn cancel" data-role="cancel">' + escapeHtml(cancelLabel) + '</button>' +
                '<button class="cmd-toast-btn primary" data-role="confirm">' + escapeHtml(confirmLabel) + '</button>' +
            '</div>';

        el.innerHTML = body;
        c.appendChild(el);

        return new Promise(function (resolve) {
            function cleanup(result) {
                el.classList.add('removing');
                setTimeout(function () { el.remove(); }, 220);
                resolve(result);
            }

            el.querySelector('[data-role="confirm"]').addEventListener('click', function () {
                cleanup(true);
            });

            el.querySelector('[data-role="cancel"]').addEventListener('click', function () {
                cleanup(false);
            });
        });
    }

    /**
     * Init — ensure container & styles are ready.
     * Safe to call multiple times.
     */
    function init() {
        ensureContainer();
    }

    window.ToastManager = {
        init: init,
        showSuccess: showSuccess,
        showError: showError,
        showUndo: showUndo,
        showConfirm: showConfirm
    };
})();
