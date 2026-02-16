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
            if (window.AtomI18n) {
                return window.AtomI18n.getMessage(key, null, fallback || '');
            }
            const text = chrome.i18n.getMessage(key);
            if (text) return text;
        } catch (e) {
            // ignore
        }
        return fallback || '';
    }

    function applyI18n() {
        // Use AtomUI.localize() if available
        if (window.AtomUI) {
            window.AtomUI.localize();
            return;
        }

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

    // Extension enable/disable toggle
    function initToggle() {
        const toggle = document.getElementById('toggle-enabled');
        if (!toggle) return;

        chrome.storage.local.get(['atom_extension_enabled'], (data) => {
            // Default to enabled if not set
            const enabled = data.atom_extension_enabled !== false;
            toggle.checked = enabled;
            applyDisabledState(!enabled);
        });

        toggle.addEventListener('change', () => {
            const enabled = toggle.checked;
            chrome.storage.local.set({ atom_extension_enabled: enabled });
            applyDisabledState(!enabled);
            // Notify background
            chrome.runtime.sendMessage({
                type: 'ATOM_TOGGLE_ENABLED',
                enabled: enabled
            }).catch(() => { });
        });
    }

    function applyDisabledState(disabled) {
        if (disabled) {
            document.body.classList.add('pm-disabled');
        } else {
            document.body.classList.remove('pm-disabled');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        initTheme();
        applyI18n();
        initToggle();
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

        // Helper: link current active tab to the focus session so review/recall works
        async function linkFocusToActiveTab(workMin, breakMin) {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

                const res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
                const st = res?.atom_focus_state;
                if (!st?.sessionId || !window.TimerIntegration) return;

                st.workMin = workMin;
                st.breakMin = breakMin;
                await window.TimerIntegration.startFocusTracking(st, {
                    url: tab.url,
                    title: tab.title || ''
                });
            } catch (e) {
                console.warn('[Popup] linkFocusToActiveTab:', e.message);
            }
        }

        // Focus preset buttons (idle state)
        document.querySelectorAll('.pm-focus-preset').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                const minutes = Number(btn.dataset.min || 25);
                const breakMin = Math.max(1, Math.ceil(minutes / 5));
                await chrome.runtime.sendMessage({
                    type: 'FOCUS_START',
                    payload: { workMin: minutes, breakMin }
                }).catch(function () { });
                await linkFocusToActiveTab(minutes, breakMin);
            });
        });

        // Custom focus time input
        const customInput = document.getElementById('focus-custom-input');
        const customGo = document.getElementById('focus-custom-go');

        async function startCustomFocus() {
            const minutes = Number(customInput?.value);
            if (!minutes || minutes < 1 || minutes > 120) {
                if (customInput) customInput.focus();
                return;
            }
            const breakMin = Math.max(1, Math.ceil(minutes / 5));
            await chrome.runtime.sendMessage({
                type: 'FOCUS_START',
                payload: { workMin: minutes, breakMin }
            }).catch(function () { });
            await linkFocusToActiveTab(minutes, breakMin);
        }

        customGo?.addEventListener('click', startCustomFocus);
        customInput?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                startCustomFocus();
            }
        });

        // Focus control buttons (active state)
        document.getElementById('popup-pause')?.addEventListener('click', function () {
            chrome.runtime.sendMessage({ type: 'FOCUS_PAUSE' }).catch(function () { });
        });
        document.getElementById('popup-stop')?.addEventListener('click', function () {
            chrome.runtime.sendMessage({ type: 'FOCUS_STOP' }).catch(function () { });
        });

        document.getElementById('btn-notes')?.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('memory.html') });
        });
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
        document.getElementById('btn-feedback')?.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('bug_report.html') });
        });

        // Journal shortcut
        document.getElementById('btn-journal')?.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('journal.html') });
        });

        // Website shortcut
        document.getElementById('btn-website')?.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://www.amonexus.com/' });
        });

        // ===== Safelist Toggle =====
        const safeBtn = document.getElementById('btn-toggle-safe');
        const safeDomainEl = document.getElementById('safelist-domain');
        const safeLabelEl = document.getElementById('safelist-label');

        async function initSafelist() {
            if (!safeBtn) return;
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab?.url) { safeBtn.style.display = 'none'; return; }
                let domain = '';
                try { domain = new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { }
                if (!domain || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
                    safeBtn.style.display = 'none';
                    return;
                }

                const data = await chrome.storage.local.get(['atom_whitelist']);
                const whitelist = data.atom_whitelist || [];
                let isSafe = whitelist.includes(domain);

                safeDomainEl.textContent = domain;
                updateSafeUI(isSafe);

                safeBtn.addEventListener('click', async () => {
                    const newData = await chrome.storage.local.get(['atom_whitelist']);
                    let list = newData.atom_whitelist || [];
                    if (isSafe) {
                        list = list.filter(d => d !== domain);
                    } else {
                        if (!list.includes(domain)) list.push(domain);
                    }
                    await chrome.storage.local.set({ atom_whitelist: list });
                    isSafe = !isSafe;
                    updateSafeUI(isSafe);
                    if (tab.id) chrome.tabs.reload(tab.id);
                });
            } catch (e) {
                safeBtn.style.display = 'none';
            }
        }

        function updateSafeUI(isSafe) {
            if (!safeBtn) return;
            if (isSafe) {
                safeBtn.classList.add('is-safe');
                safeLabelEl.textContent = msg('pop_btn_safe_remove_new', '− Remove');
            } else {
                safeBtn.classList.remove('is-safe');
                safeLabelEl.textContent = msg('pop_btn_safe_add_new', '+ Add to safelist');
            }
        }

        initSafelist();

        // ===== Focus Recall Review =====
        let reviewSessionId = null;
        let reviewShown = false;
        let prevPhase = focusState?.phase || null;

        async function checkPendingReview() {
            try {
                const data = await chrome.storage.local.get(['atom_focus_pending_review']);
                const pending = data.atom_focus_pending_review;
                if (!pending?.readingSessionId) return;

                // Only show if triggered within last 5 minutes
                const age = Date.now() - (pending.triggeredAt || 0);
                if (age > 5 * 60 * 1000) {
                    await chrome.storage.local.remove(['atom_focus_pending_review']);
                    return;
                }

                reviewSessionId = pending.readingSessionId;
                await loadAndShowReview();
                await chrome.storage.local.remove(['atom_focus_pending_review']);
            } catch (e) {
                console.warn('[Popup] checkPendingReview error:', e.message);
            }
        }

        async function loadAndShowReview() {
            if (reviewShown || !reviewSessionId) return;
            if (typeof TimerIntegration === 'undefined' && !window.TimerIntegration) return;

            const TI = window.TimerIntegration;
            const reviewCard = document.getElementById('focus-review-card');
            const reviewBody = document.getElementById('review-body');
            if (!reviewCard || !reviewBody) return;

            // Show loading state
            reviewCard.style.display = '';
            reviewShown = true;
            reviewBody.innerHTML = '<div class="pm-review__loading">' + msg('focus_review_loading', 'Generating recall question…') + '</div>';

            try {
                const reviewData = await TI.onWorkPhaseEnd(reviewSessionId);
                if (!reviewData) {
                    hideReview();
                    return;
                }
                renderReviewContent(reviewBody, reviewData);
            } catch (e) {
                console.warn('[Popup] loadAndShowReview error:', e.message);
                hideReview();
            }
        }

        function renderReviewContent(container, reviewData) {
            const stats = reviewData.summary?.stats || {};
            const title = reviewData.summary?.title || '';

            container.innerHTML = `
                ${title ? `<div class="pm-review__page-title" title="${title}">${title}</div>` : ''}
                <div class="pm-review__stats">
                    <div class="pm-review__stat">
                        <span class="pm-review__stat-val">${stats.highlights ?? 0}</span>
                        <span class="pm-review__stat-label">${msg('focus_review_stat_highlights', 'highlights')}</span>
                    </div>
                    <div class="pm-review__stat">
                        <span class="pm-review__stat-val">${stats.insights ?? 0}</span>
                        <span class="pm-review__stat-label">${msg('focus_review_stat_insights', 'insights')}</span>
                    </div>
                    <div class="pm-review__stat">
                        <span class="pm-review__stat-val">${stats.messages ?? 0}</span>
                        <span class="pm-review__stat-label">${msg('focus_review_stat_messages', 'messages')}</span>
                    </div>
                </div>
                <div class="pm-review__question">"${reviewData.recallQuestion || ''}"</div>
                <div class="pm-review__hint">${msg('focus_review_hint', "Write 1–2 sentences. Don't check the page.")}</div>
                <textarea class="pm-review__textarea" id="recall-answer" placeholder="${msg('focus_review_placeholder', 'Type your answer…')}"></textarea>
                <div class="pm-review__actions">
                    <button class="pm-review__btn pm-review__btn--primary" id="recall-submit">${msg('focus_review_submit', 'Save recall')}</button>
                    <button class="pm-review__btn" id="recall-skip">${msg('focus_review_skip', 'Skip')}</button>
                </div>
            `;

            // Submit handler
            container.querySelector('#recall-submit')?.addEventListener('click', async () => {
                const answer = (container.querySelector('#recall-answer')?.value || '').trim();
                if (!answer) return;
                const TI = window.TimerIntegration;
                if (!TI) return;

                const submitBtn = container.querySelector('#recall-submit');
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '…'; }

                try {
                    const score = await TI.recordRecallAnswer(reviewData.sessionId, answer);
                    const feedbackText = score?.feedback || msg('focus_review_feedback_saved', 'Saved.');
                    const scoreText = Number.isFinite(score?.score) ? ` (${score.score}%)` : '';

                    // Replace actions with feedback
                    const actionsEl = container.querySelector('.pm-review__actions');
                    if (actionsEl) actionsEl.remove();

                    const fb = document.createElement('div');
                    fb.className = 'pm-review__feedback';
                    fb.textContent = `${feedbackText}${scoreText}`;
                    container.appendChild(fb);

                    // Auto-hide after 4 seconds
                    setTimeout(hideReview, 4000);
                } catch (e) {
                    console.warn('[Popup] recordRecallAnswer error:', e.message);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = msg('focus_review_submit', 'Save recall'); }
                }
            });

            // Skip handler
            container.querySelector('#recall-skip')?.addEventListener('click', hideReview);
        }

        function hideReview() {
            const card = document.getElementById('focus-review-card');
            if (card) card.style.display = 'none';
            reviewShown = false;
        }

        // Check for pending review on popup open
        checkPendingReview();

        // Detect WORK→BREAK while popup is open via broadcast
        chrome.runtime.onMessage.addListener((message) => {
            const type = message?.type;
            if (type !== 'ATOM_FOCUS_STATE_UPDATED' && type !== 'FOCUS_STATE_UPDATED') return;
            const newState = message?.payload?.atom_focus_state || message?.payload || null;
            const curPhase = newState?.phase || null;
            if (prevPhase === 'WORK' && curPhase === 'BREAK' && !reviewShown) {
                chrome.storage.local.get(['atom_focus_linked_session_v1']).then((data) => {
                    const linked = data.atom_focus_linked_session_v1;
                    if (linked?.sessionId) {
                        reviewSessionId = linked.sessionId;
                        loadAndShowReview();
                    }
                }).catch(() => { });
            }
            prevPhase = curPhase;
        });
    });
})();
