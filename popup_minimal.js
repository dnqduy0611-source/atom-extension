// popup_minimal.js - Minimal status + launcher popup
(function () {
    'use strict';

    let focusState = null;
    let tickTimer = null;

    // Theme sync
    function initTheme() {
        chrome.storage.local.get(['atom_theme'], (data) => {
            if (data.atom_theme === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }
        });
    }

    // Listen for theme changes from other pages
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.atom_theme) {
            if (changes.atom_theme.newValue === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }
        }
    });

    function msg(key, fallback) {
        try {
            const text = chrome.i18n.getMessage(key);
            if (text) return text;
        } catch (e) {
            // ignore
        }
        return fallback || '';
    }

    function applyI18n() {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const key = el.getAttribute('data-i18n');
            const text = msg(key, '');
            if (text) el.textContent = text;
        });

        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            const text = msg(key, '');
            if (text) {
                el.title = text;
                el.setAttribute('aria-label', text);
            }
        });
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const total = Math.floor(seconds);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function getRemainingSeconds(state) {
        if (!state) return 0;
        if (Number.isFinite(state.remaining)) return Math.max(0, Math.floor(state.remaining));
        if (Number.isFinite(state.phaseEndsAt)) {
            return Math.max(0, Math.round((state.phaseEndsAt - Date.now()) / 1000));
        }
        return 0;
    }

    function renderFocus() {
        const badge = document.getElementById('focus-badge');
        const noFocus = document.getElementById('no-focus');
        const phaseEl = document.getElementById('focus-phase');
        const timeEl = document.getElementById('focus-time');

        if (!badge || !noFocus || !phaseEl || !timeEl) return;

        if (!focusState?.enabled) {
            badge.style.display = 'none';
            noFocus.style.display = 'block';
            return;
        }

        badge.style.display = 'flex';
        noFocus.style.display = 'none';

        const phase = String(focusState?.phase || '').toUpperCase();
        const phaseLabel = phase === 'BREAK'
            ? msg('focusBreak', 'Break')
            : msg('focusWorking', 'Focus');
        phaseEl.textContent = phaseLabel;
        timeEl.textContent = formatTime(getRemainingSeconds(focusState));
    }

    async function refreshFocusState() {
        try {
            const res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
            focusState = res?.atom_focus_state || null;
        } catch (e) {
            focusState = null;
        }
        renderFocus();
    }

    function startTick() {
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(() => {
            if (!focusState?.enabled) return;
            renderFocus();
            if (focusState?.phaseEndsAt && Date.now() > Number(focusState.phaseEndsAt) + 1000) {
                refreshFocusState();
            }
        }, 1000);
    }

    function listenFocusUpdates() {
        chrome.runtime.onMessage.addListener((message) => {
            const type = message?.type;
            if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED') return;
            focusState = message?.payload?.atom_focus_state || message?.payload || null;
            renderFocus();
        });
    }

    document.addEventListener('DOMContentLoaded', async () => {
        initTheme();
        applyI18n();
        await refreshFocusState();
        startTick();
        listenFocusUpdates();

        document.getElementById('open-panel')?.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id != null && chrome.sidePanel?.open) {
                    await chrome.sidePanel.open({ tabId: tab.id });
                }
            } catch (e) {
                // ignore
            } finally {
                window.close();
            }
        });

        document.getElementById('btn-settings')?.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
        document.getElementById('btn-website')?.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://www.amonexus.com/' });
        });
        document.getElementById('btn-feedback')?.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('bug_report.html') });
        });
    });
})();
