// popup_minimal.js — Phase 3 Minimal Status Dashboard
// Loads today's stats + handles focus, sidepanel, settings, toggle

// i18n helper — delegates to AtomI18n (from utils_ui.js) which respects atom_ui_language,
// falls back to chrome.i18n.getMessage only if AtomI18n is not loaded
function getMessage(key, fallback) {
    try {
        if (window.AtomI18n) {
            return window.AtomI18n.getMessage(key, null, fallback || key);
        }
        return chrome.i18n.getMessage(key) || fallback || key;
    } catch { return fallback || key; }
}

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('master-toggle');
    const statusEl = document.getElementById('status-indicator');
    const focusIdle = document.getElementById('focus-idle');
    const focusActive = document.getElementById('focus-active');
    const focusTimeEl = document.getElementById('focus-time');
    const focusPhaseEl = document.getElementById('focus-phase');
    const focusRing = document.getElementById('focus-ring-progress');
    let focusTickId = null;
    let focusState = null;

    const RING_CIRC = 2 * Math.PI * 21; // ~131.95

    // 0. Theme sync
    const { atom_theme } = await chrome.storage.local.get(['atom_theme']);
    if (atom_theme === 'light') document.body.classList.add('light-mode');

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.atom_theme) {
            document.body.classList.toggle('light-mode', changes.atom_theme.newValue === 'light');
        }
    });

    // 1. Load state from storage
    const data = await chrome.storage.local.get([
        'atom_today_pages',
        'atom_today_highlights',
        'atom_today_connections',
        'atom_is_active'
    ]);

    document.getElementById('stat-pages').textContent = data.atom_today_pages || 0;
    document.getElementById('stat-highlights').textContent = data.atom_today_highlights || 0;
    document.getElementById('stat-connections').textContent = data.atom_today_connections || 0;

    if (data.atom_is_active === false) {
        toggle.checked = false;
        setDisabled(true);
    }

    // 2. Focus — check current state
    chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' }, (res) => {
        if (chrome.runtime.lastError) return;
        const st = res?.atom_focus_state;
        if (st?.enabled) {
            focusState = st;
            showFocusActive();
        }
    });

    // Listen for focus broadcasts
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'ATOM_FOCUS_STATE_UPDATED' || msg.type === 'FOCUS_STATE_UPDATED') {
            const st = msg?.payload?.atom_focus_state || msg?.payload || null;
            focusState = st;
            if (st?.enabled) {
                showFocusActive();
            } else {
                showFocusIdle();
            }
        }
    });

    // Start focus
    document.querySelector('.pm-focus-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const minutes = parseInt(btn.dataset.minutes) || 25;
        chrome.runtime.sendMessage({ type: 'FOCUS_START', minutes }, (res) => {
            if (chrome.runtime.lastError) return;
            const st = res?.atom_focus_state;
            if (st?.enabled) {
                focusState = st;
                showFocusActive();
            }
        });
    });

    // Stop focus
    document.getElementById('focus-stop')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'FOCUS_STOP' }, () => {
            if (chrome.runtime.lastError) return;
            showFocusIdle();
        });
    });

    // 3. Open Sidepanel
    document.getElementById('open-panel')?.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.sidePanel.open({ tabId: tabs[0].id });
                window.close();
            }
        });
    });

    // 4. Settings
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 4b. Amo Lofi
    document.getElementById('open-lofi')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://lofi.amonexus.com' });
        window.close();
    });

    // 4c. Open Web
    document.getElementById('open-web')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.amonexus.com' });
        window.close();
    });

    // 5. Master Toggle
    toggle.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        chrome.storage.local.set({ atom_is_active: isOn });
        setDisabled(!isOn);
    });

    // === Helpers ===

    function showFocusActive() {
        focusIdle.classList.add('hidden');
        focusActive.classList.remove('hidden');
        updateFocusDisplay();
        if (focusTickId) clearInterval(focusTickId);
        focusTickId = setInterval(updateFocusDisplay, 1000);
    }

    function showFocusIdle() {
        focusState = null;
        focusActive.classList.add('hidden');
        focusIdle.classList.remove('hidden');
        if (focusTickId) { clearInterval(focusTickId); focusTickId = null; }
    }

    function updateFocusDisplay() {
        if (!focusState?.enabled) return;
        const now = Date.now();
        const remaining = Math.max(0, focusState.phaseEndsAt - now);
        const total = focusState.phaseEndsAt - focusState.phaseStartedAt;

        // Timer text
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        focusTimeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Phase label
        const isWork = focusState.phase === 'WORK';
        focusPhaseEl.textContent = isWork
            ? getMessage('popup_focus_work', 'Work')
            : getMessage('popup_break_label', 'Break');
        focusPhaseEl.classList.toggle('break', !isWork);

        // Ring progress (dashoffset: 0 = full, CIRC = empty)
        const progress = total > 0 ? remaining / total : 0;
        const offset = RING_CIRC * (1 - progress);
        focusRing.style.strokeDashoffset = offset.toFixed(1);

        // Auto-switch to idle if time's up and state not refreshed
        if (remaining <= 0 && focusState.enabled) {
            // Re-check state from background
            chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' }, (res) => {
                if (chrome.runtime.lastError) return;
                const st = res?.atom_focus_state;
                if (!st?.enabled) showFocusIdle();
                else focusState = st; // phase may have changed to BREAK
            });
        }
    }

    function setDisabled(off) {
        if (off) {
            statusEl.textContent = getMessage('popup_status_disabled', 'Disabled');
            statusEl.classList.add('disabled');
            document.body.classList.add('disabled');
        } else {
            statusEl.textContent = getMessage('popup_status_active', 'Active');
            statusEl.classList.remove('disabled');
            document.body.classList.remove('disabled');
        }
    }
});
