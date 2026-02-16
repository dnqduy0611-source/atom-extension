// ui/controllers/tab_controller.js
// Wave A: Extract bottom-tab switching logic from sidepanel.js.

(function () {
    'use strict';

    class TabController {
        constructor(options) {
            this.root = options?.root || null;
            this.toggleButton = options?.toggleButton || null;
            this.collapsedStorageKey = options?.collapsedStorageKey || 'sp_tabs_collapsed';
            this.onTabChange = typeof options?.onTabChange === 'function' ? options.onTabChange : null;
            this.activeTab = null;
            this._cleanups = [];
        }

        init() {
            if (!this.root) return false;

            this.buttons = Array.from(this.root.querySelectorAll('.sp-tab-btn[data-tab]'));
            this.panels = Array.from(this.root.querySelectorAll('.sp-tab-panel[id^="tab-"]'));

            if (!this.buttons.length || !this.panels.length) return false;

            this.buttons.forEach((btn) => {
                const onClick = () => {
                    const tabId = btn.dataset.tab;
                    this.switchTo(tabId, { expandIfCollapsed: true });
                };
                btn.addEventListener('click', onClick);
                this._cleanups.push(() => btn.removeEventListener('click', onClick));
            });

            if (this.toggleButton) {
                const onToggle = () => this.toggleCollapsed();
                this.toggleButton.addEventListener('click', onToggle);
                this._cleanups.push(() => this.toggleButton.removeEventListener('click', onToggle));
            }

            this.restoreCollapsedState();
            const current = this.getActiveTab() || this.buttons[0]?.dataset?.tab;
            if (current) this.switchTo(current, { expandIfCollapsed: false, emit: false });
            return true;
        }

        destroy() {
            this._cleanups.forEach((fn) => {
                try { fn(); } catch (e) { /* ignore */ }
            });
            this._cleanups = [];
        }

        getActiveTab() {
            const active = this.buttons?.find((btn) => btn.classList.contains('active'));
            return active?.dataset?.tab || this.activeTab || null;
        }

        switchTo(tabId, options) {
            const opts = options || {};
            const emit = opts.emit !== false;
            const expandIfCollapsed = opts.expandIfCollapsed !== false;
            if (!tabId) return false;

            const btn = this.buttons.find((b) => b.dataset.tab === tabId);
            const panel = this.root.querySelector(`#tab-${tabId}`);
            if (!btn || !panel) return false;

            const prev = this.getActiveTab();

            this.buttons.forEach((b) => {
                const isActive = b === btn;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            this.panels.forEach((p) => {
                const isActive = p === panel;
                p.classList.toggle('active', isActive);
                if (isActive) p.removeAttribute('hidden');
                else p.setAttribute('hidden', '');
            });

            this.activeTab = tabId;

            if (expandIfCollapsed && this.isCollapsed()) {
                this.toggleCollapsed(false);
            }

            if (emit && this.onTabChange && prev !== tabId) {
                this.onTabChange(tabId, prev);
            }
            return true;
        }

        cycle(direction) {
            const dir = Number(direction) || 1;
            const ids = this.buttons.map((b) => b.dataset.tab).filter(Boolean);
            if (!ids.length) return null;

            const current = this.getActiveTab();
            const currentIndex = Math.max(0, ids.indexOf(current));
            let nextIndex = currentIndex + dir;

            if (nextIndex < 0) nextIndex = ids.length - 1;
            if (nextIndex >= ids.length) nextIndex = 0;

            const next = ids[nextIndex];
            this.switchTo(next, { expandIfCollapsed: true });
            return next;
        }

        isCollapsed() {
            return !!this.root?.classList.contains('collapsed');
        }

        toggleCollapsed(forceCollapsed) {
            if (!this.root) return false;

            let next = forceCollapsed;
            if (typeof next !== 'boolean') {
                next = !this.isCollapsed();
            }

            this.root.classList.toggle('collapsed', next);
            this.persistCollapsedState(next);
            return next;
        }

        async restoreCollapsedState() {
            try {
                const data = await chrome.storage.local.get([this.collapsedStorageKey]);
                const isCollapsed = !!data?.[this.collapsedStorageKey];
                this.root.classList.toggle('collapsed', isCollapsed);
            } catch (e) {
                // ignore storage failure
            }
        }

        persistCollapsedState(isCollapsed) {
            try {
                chrome.storage.local.set({ [this.collapsedStorageKey]: !!isCollapsed });
            } catch (e) {
                // ignore storage failure
            }
        }
    }

    window.TabController = TabController;
})();
