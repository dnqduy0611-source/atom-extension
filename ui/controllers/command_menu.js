// ui/controllers/command_menu.js
// Unified "/" command menu — replaces QuickActionsController + QuickDiaryController.

(function () {
    'use strict';

    function msg(key, fallback) {
        try { var r = chrome.i18n.getMessage(key); if (r) return r; } catch (e) { /* ignore */ }
        return fallback;
    }

    var CMD_MAP = {
        'FOCUS_25': { command: 'FOCUS_START', params: { minutes: 25 }, confirm: true, undoable: true },
        'FOCUS_40': { command: 'FOCUS_START', params: { minutes: 40 }, confirm: true, undoable: true },
        'FOCUS_50': { command: 'FOCUS_START', params: { minutes: 50 }, confirm: true, undoable: true },
        'OPEN_DIARY': { command: 'OPEN_DIARY', params: {}, confirm: false, undoable: false },
        'OPEN_NOTES': { command: 'OPEN_NOTES', params: {}, confirm: false, undoable: false },
        'OPEN_SAVED': { command: 'OPEN_SAVED', params: {}, confirm: false, undoable: false },
        'EXPORT_SAVED': { command: 'EXPORT_SAVED', params: {}, confirm: false, undoable: false },
        'OPEN_SETTINGS': { command: 'OPEN_SETTINGS', params: {}, confirm: false, undoable: false }
    };

    function CommandMenuController(actionExecutor, opts) {
        this.executor = actionExecutor;
        this.onAction = (opts && opts.onAction) || null; // callback for AI actions (data-action)
        this.trigger = null;
        this.dropdown = null;
        this.isOpen = false;
        this.focusActive = false;
        this._onDocClick = this._onDocClick.bind(this);
        this._onRuntimeMessage = this._onRuntimeMessage.bind(this);
    }

    CommandMenuController.prototype.init = function () {
        this.trigger = document.getElementById('cmd-trigger');
        this.dropdown = document.getElementById('cmd-dropdown');
        if (!this.trigger || !this.dropdown) return;

        var self = this;
        this.trigger.addEventListener('click', function () { self.toggle(); });

        this.dropdown.addEventListener('click', function (e) {
            var item = e.target.closest('.sp-cmd-item');
            if (!item) return;
            var cmd = item.dataset.cmd;
            var action = item.dataset.action;
            if (cmd) {
                self._execute(cmd);
            } else if (action && self.onAction) {
                self.close();
                self.onAction(action);
            }
        });

        document.addEventListener('click', this._onDocClick);
        chrome.runtime.onMessage.addListener(this._onRuntimeMessage);
        this._refreshFocusState();
    };

    CommandMenuController.prototype.destroy = function () {
        document.removeEventListener('click', this._onDocClick);
        chrome.runtime.onMessage.removeListener(this._onRuntimeMessage);
    };

    CommandMenuController.prototype.toggle = function () {
        this.isOpen ? this.close() : this.open();
    };

    CommandMenuController.prototype.open = function () {
        if (!this.dropdown) return;
        this.isOpen = true;
        this.dropdown.classList.add('show');
        if (this.trigger) {
            this.trigger.setAttribute('aria-expanded', 'true');
            // Position dropdown above trigger (fixed positioning)
            var rect = this.trigger.getBoundingClientRect();
            this.dropdown.style.left = rect.left + 'px';
            this.dropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        }
        if (this.focusActive) {
            this.dropdown.classList.add('focus-active');
        } else {
            this.dropdown.classList.remove('focus-active');
        }
    };

    CommandMenuController.prototype.close = function () {
        if (!this.dropdown) return;
        this.isOpen = false;
        this.dropdown.classList.remove('show');
        if (this.trigger) this.trigger.setAttribute('aria-expanded', 'false');
    };

    CommandMenuController.prototype._execute = async function (cmdKey) {
        this.close();
        var intent = CMD_MAP[cmdKey];
        if (!intent || !this.executor) return;
        await this.executor.handleIntent(intent);
    };

    CommandMenuController.prototype._onDocClick = function (e) {
        if (!this.isOpen) return;
        if (!e.target.closest('#cmd-menu')) {
            this.close();
        }
    };

    CommandMenuController.prototype._onRuntimeMessage = function (message) {
        var type = message && message.type;
        if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED') return;
        var state = (message.payload && message.payload.atom_focus_state) || message.payload || null;
        this.focusActive = !!(state && state.enabled);
    };

    CommandMenuController.prototype._refreshFocusState = async function () {
        try {
            var res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
            this.focusActive = !!(res && res.atom_focus_state && res.atom_focus_state.enabled);
        } catch (e) {
            this.focusActive = false;
        }
    };

    window.CommandMenuController = CommandMenuController;
})();
