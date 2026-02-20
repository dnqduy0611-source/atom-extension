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

    const RING_CIRC = 2 * Math.PI * 36; // ~226.19 (r=36 in 80×80 SVG)

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
        if (st?.enabled || st?.paused) {
            focusState = st;
            showFocusActive();
        }
    });

    // Listen for focus broadcasts
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'ATOM_FOCUS_STATE_UPDATED' || msg.type === 'FOCUS_STATE_UPDATED') {
            const st = msg?.payload?.atom_focus_state || msg?.payload || null;
            focusState = st;
            if (st?.enabled || st?.paused) {
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

    // Reset: if running → reset phase + pause (like AmoLofi). If already paused → stop completely.
    document.getElementById('focus-reset')?.addEventListener('click', () => {
        if (focusState?.paused) {
            // Already paused → stop completely
            chrome.runtime.sendMessage({ type: 'FOCUS_STOP' }, () => {
                if (chrome.runtime.lastError) return;
                showFocusIdle();
            });
        } else {
            // Running → reset phase + pause
            chrome.runtime.sendMessage({ type: 'FOCUS_RESET_PHASE' }, (res) => {
                if (chrome.runtime.lastError) return;
                const st = res?.atom_focus_state;
                if (st?.enabled || st?.paused) {
                    focusState = st;
                    showFocusActive();
                }
            });
        }
    });

    // Pause / Resume focus
    document.getElementById('focus-pause')?.addEventListener('click', () => {
        if (!focusState?.enabled && !focusState?.paused) return;
        const isPaused = focusState.paused;
        const msgType = isPaused ? 'FOCUS_RESUME' : 'FOCUS_PAUSE';
        chrome.runtime.sendMessage({ type: msgType }, (res) => {
            if (chrome.runtime.lastError) return;
            const st = res?.atom_focus_state;
            if (st) {
                focusState = st;
                updatePauseIcon();
            }
        });
    });

    // Skip to next phase
    document.getElementById('focus-skip')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'FOCUS_SKIP' }, (res) => {
            if (chrome.runtime.lastError) return;
            const st = res?.atom_focus_state;
            if (st?.enabled) {
                focusState = st;
                showFocusActive();
            } else {
                showFocusIdle();
            }
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
        updatePauseIcon();
        if (focusTickId) clearInterval(focusTickId);
        // Only tick when actually running (not paused)
        if (!focusState?.paused) {
            focusTickId = setInterval(updateFocusDisplay, 1000);
        } else {
            focusTickId = null;
        }
    }

    function showFocusIdle() {
        focusState = null;
        focusActive.classList.add('hidden');
        focusIdle.classList.remove('hidden');
        if (focusTickId) { clearInterval(focusTickId); focusTickId = null; }
    }

    function updateFocusDisplay() {
        if (!focusState?.enabled && !focusState?.paused) return;

        // When paused, show frozen remaining time
        const now = Date.now();
        const remaining = focusState.paused
            ? (focusState.pausedRemainingMs || 0)
            : Math.max(0, focusState.phaseEndsAt - now);
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
            chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' }, (res) => {
                if (chrome.runtime.lastError) return;
                const st = res?.atom_focus_state;
                if (!st?.enabled) showFocusIdle();
                else focusState = st;
            });
        }
    }

    function updatePauseIcon() {
        const btn = document.getElementById('focus-pause');
        if (!btn) return;
        const isPaused = focusState?.paused;
        // Play icon ▶ when paused, Pause icon ⏸ when running
        btn.innerHTML = isPaused
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>';
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
