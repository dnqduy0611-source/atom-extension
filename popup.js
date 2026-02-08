const atomMsg = (key, substitutions, fallback) => {
    if (window.AtomI18n) {
        return window.AtomI18n.getMessage(key, substitutions, fallback);
    }
    return chrome.i18n.getMessage(key, substitutions) || fallback || key;
};

const BUILD_FLAGS = window.ATOM_BUILD_FLAGS || { DEBUG: false };
const BUILD_DEBUG_ENABLED = !!BUILD_FLAGS.DEBUG;
const ONBOARDING_STORAGE_KEY = 'atom_sidepanel_onboarding';
const ONBOARDING_ORDER = [
    'not_started',
    'started',
    'first_highlight_done',
    'first_ai_reply_done',
    'first_save_done',
    'completed'
];

document.addEventListener('DOMContentLoaded', async () => {
    if (window.AtomI18n) {
        await window.AtomI18n.init();
    }
    let currentTabInfo = null;
    let lastFocusPhase = null;
    let focusLinkedSessionId = null;
    let reviewVisible = false;
    const domainLabel = document.getElementById('current-domain');
    const btnToggleSafe = document.getElementById('btn-toggle-safe');
    const btnJournal = document.getElementById('btn-journal');
    const btnSettings = document.getElementById('btn-open-settings');
    const btnExport = document.getElementById('btn-export');
    const btnClear = document.getElementById('btn-clear');
    const btnWeb = document.getElementById('btn-website');
    const btnReportBug = document.getElementById('btn-report-bug');
    const btnDebug = document.getElementById('btn-debug-panel');
    const updateBanner = document.getElementById('update-banner');
    const retentionDue = document.getElementById('retention-due');
    const retentionNew = document.getElementById('retention-new');
    const retentionRecommended = document.getElementById('retention-recommended');
    const retentionStreak = document.getElementById('retention-streak');
    const retentionStreakLabel = document.getElementById('retention-streak-label');
    const retentionGrid = document.getElementById('retention-grid');
    const retentionEmpty = document.getElementById('retention-empty');
    const onboardingCard = document.getElementById('popup-onboarding-card');
    const onboardingDesc = document.getElementById('popup-onboarding-desc');
    const btnOnboardingSidepanel = document.getElementById('btn-onboarding-sidepanel');
    const btnOnboardingSettings = document.getElementById('btn-onboarding-settings');

    // Check for Store update and show banner
    checkAndShowUpdateBanner();

    // Display current sensitivity mode
    displaySensitivityMode();
    updateRetentionStats();

    // Show debug panel link only when build + debug_mode are enabled
    if (btnDebug) {
        if (!BUILD_DEBUG_ENABLED) {
            btnDebug.style.display = 'none';
        } else {
            const debugState = await chrome.storage.local.get(['debug_mode']);
            if (debugState.debug_mode) {
                btnDebug.style.display = 'inline-flex';
                btnDebug.addEventListener('click', () => {
                    chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
                });
            }
        }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        try {
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
                domainLabel.innerText = atomMsg("pop_system_page");
                if (btnToggleSafe) btnToggleSafe.style.display = 'none';
            } else {
                const urlObj = new URL(tab.url);
                const currentDomain = urlObj.hostname.replace('www.', '').toLowerCase();
                currentTabInfo = { url: tab.url, title: tab.title || '' };
                domainLabel.innerText = currentDomain;
                checkSafeZoneStatus(currentDomain);
            }
        } catch (e) {
            domainLabel.innerText = atomMsg("pop_unknown_page");
            if (btnToggleSafe) btnToggleSafe.style.display = 'none';
        }
    } else {
        domainLabel.innerText = atomMsg("popup_no_active_tab");
        if (btnToggleSafe) btnToggleSafe.style.display = 'none';
    }

    function getOnboardingIndex(state) {
        return ONBOARDING_ORDER.indexOf(state);
    }

    function normalizeOnboardingState(rawState) {
        if (!rawState || typeof rawState !== 'object') {
            return { state: 'not_started', onboarding_completed_at: null, updated_at: null };
        }

        if (typeof rawState.state === 'string' && ONBOARDING_ORDER.includes(rawState.state)) {
            return rawState;
        }

        if (rawState.completedAt || rawState.onboarding_completed_at || rawState.tooltipsShown?.done) {
            return {
                state: 'completed',
                onboarding_completed_at: rawState.completedAt || rawState.onboarding_completed_at || Date.now(),
                updated_at: rawState.updated_at || Date.now()
            };
        }

        if (rawState.welcomed || rawState.tooltipsShown?.highlight || rawState.tooltipsShown?.chat) {
            return {
                state: 'started',
                onboarding_completed_at: null,
                updated_at: rawState.updated_at || Date.now()
            };
        }

        return { state: 'not_started', onboarding_completed_at: null, updated_at: rawState.updated_at || null };
    }

    async function getOnboardingStateSnapshot() {
        const data = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY]);
        return normalizeOnboardingState(data[ONBOARDING_STORAGE_KEY]);
    }

    async function hasAnyApiKeyConfigured() {
        const data = await chrome.storage.local.get(['user_gemini_key', 'gemini_api_key', 'apiKey', 'atom_openrouter_key']);
        return Boolean(data.user_gemini_key || data.gemini_api_key || data.apiKey || data.atom_openrouter_key);
    }

    async function markOnboardingStarted() {
        const snapshot = await getOnboardingStateSnapshot();
        const currentIndex = getOnboardingIndex(snapshot.state);
        const startedIndex = getOnboardingIndex('started');
        if (currentIndex < startedIndex) {
            await chrome.storage.local.set({
                [ONBOARDING_STORAGE_KEY]: {
                    ...snapshot,
                    state: 'started',
                    updated_at: Date.now()
                }
            });
        }
    }

    function openSettingsPage() {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    }

    async function openSidePanelForActiveTab(markStarted = false) {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!activeTab?.id) return;
            if (markStarted) {
                await markOnboardingStarted();
            }
            await chrome.sidePanel.open({ tabId: activeTab.id });
            window.close();
        } catch (e) {
            console.error("ATOM: Failed to open side panel:", e);
        }
    }

    async function refreshPopupOnboardingCard() {
        if (!onboardingCard) return;

        const [snapshot, hasApiKey] = await Promise.all([
            getOnboardingStateSnapshot(),
            hasAnyApiKeyConfigured()
        ]);

        if (snapshot.state === 'completed') {
            onboardingCard.classList.add('hidden');
            return;
        }

        onboardingCard.classList.remove('hidden');
        if (btnOnboardingSettings) {
            btnOnboardingSettings.style.display = hasApiKey ? 'none' : 'inline-flex';
        }
        if (onboardingDesc) {
            onboardingDesc.textContent = hasApiKey
                ? atomMsg('popup_onboarding_desc', null, 'Open the side panel and follow 3 quick steps.')
                : atomMsg('popup_onboarding_desc_no_key', null, 'Open Settings to add your AI Access Key, then continue in the side panel.');
        }
    }

    await refreshPopupOnboardingCard();

    async function checkSafeZoneStatus(domain) {
        const data = await chrome.storage.local.get(['atom_whitelist']);
        const whitelist = data.atom_whitelist || [];
        const isSafe = whitelist.includes(domain);
        updateSafeBtnUI(isSafe);

        if (btnToggleSafe) {
            btnToggleSafe.onclick = async () => {
                const newData = await chrome.storage.local.get(['atom_whitelist']);
                let currentList = newData.atom_whitelist || [];
                if (isSafe) {
                    currentList = currentList.filter(d => d !== domain);
                    await chrome.storage.local.set({ atom_whitelist: currentList });
                    updateSafeBtnUI(false);
                    if (tab.id) chrome.tabs.reload(tab.id);
                } else {
                    if (!currentList.includes(domain)) currentList.push(domain);
                    await chrome.storage.local.set({ atom_whitelist: currentList });
                    updateSafeBtnUI(true);
                    if (tab.id) chrome.tabs.reload(tab.id);
                }
                checkSafeZoneStatus(domain);
            };
        }
    }

    function updateSafeBtnUI(isSafe) {
        if (!btnToggleSafe) return;

        const statusDot = document.getElementById('site-status');
        const statusText = document.getElementById('safe-zone-status');

        // Icons from landing page context
        // Compass (Leaf-like) -> For enabling ATOM (Compass Approach)
        const iconCompass = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

        // Ban (Blocker-like) -> For disabling ATOM (Jail Approach / Stop)
        const iconBan = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;

        if (isSafe) {
            btnToggleSafe.className = "btn-toggle-status active";
            btnToggleSafe.innerHTML = iconCompass + atomMsg("pop_btn_safe_remove_new");
            if (statusDot) statusDot.classList.add('active');
            if (statusText) {
                statusText.innerText = atomMsg("pop_status_off");
                statusText.style.color = "var(--muted)";
            }
        } else {
            btnToggleSafe.className = "btn-toggle-status";
            btnToggleSafe.innerHTML = iconBan + atomMsg("pop_btn_safe_add_new");
            if (statusDot) statusDot.classList.remove('active');
            if (statusText) {
                statusText.innerText = atomMsg("pop_status_running");
                statusText.style.color = "var(--primary)";
            }
        }
    }

    if (btnJournal) {
        btnJournal.addEventListener('click', () => {
            chrome.tabs.create({ url: 'journal.html' });
        });
    }

    const btnMemory = document.getElementById('btn-memory');
    if (btnMemory) {
        btnMemory.addEventListener('click', () => {
            chrome.tabs.create({ url: 'memory.html' });
        });
    }

    // Chat with Amo button - opens Side Panel
    const btnChatPage = document.getElementById('btn-chat-page');
    if (btnChatPage) {
        btnChatPage.addEventListener('click', async () => openSidePanelForActiveTab(true));
    }

    if (btnOnboardingSidepanel) {
        btnOnboardingSidepanel.addEventListener('click', async () => openSidePanelForActiveTab(true));
    }

    if (btnOnboardingSettings) {
        btnOnboardingSettings.addEventListener('click', openSettingsPage);
    }

    const shortcutFlag = await chrome.storage.local.get([
        'atom_open_sidepanel_on_popup',
        'atom_open_sidepanel_on_popup_ts'
    ]);
    if (shortcutFlag.atom_open_sidepanel_on_popup) {
        await chrome.storage.local.remove([
            'atom_open_sidepanel_on_popup',
            'atom_open_sidepanel_on_popup_ts'
        ]);
        try {
            await openSidePanelForActiveTab(true);
        } catch (e) {
            console.error("ATOM: Failed to open side panel from shortcut popup:", e);
        }
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', openSettingsPage);
    }

    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const originalText = btnExport.innerText;
            btnExport.innerText = atomMsg("popup_msg_packing");
            try {
                const data = await chrome.storage.local.get(null);
                const exportData = {
                    _meta: {
                        exported_at: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        version: chrome.runtime.getManifest().version
                    },
                    ...data
                };
                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                a.download = `ATOM_Data_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                btnExport.innerText = atomMsg("popup_msg_downloaded");
                setTimeout(() => { btnExport.innerText = originalText; }, 2000);
            } catch (err) {
                console.error(err);
                btnExport.innerText = atomMsg("popup_msg_error") + err.message;
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const confirmMsg = atomMsg("popup_confirm_reset");
            if (confirm(confirmMsg)) {
                await chrome.storage.local.clear();
                chrome.runtime.reload();
                window.close();
            }
        });
    }

    if (btnWeb) {
        btnWeb.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://atom-web-gamma.vercel.app/' });
        });
    }

    // Report Bug button
    if (btnReportBug) {
        btnReportBug.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('bug_report.html') });
        });
    }

    // Check and show update banner
    async function checkAndShowUpdateBanner() {
        try {
            const data = await chrome.storage.local.get(['store_update_available', 'store_url', 'update_dismissed']);

            if (data.store_update_available && data.store_url && !data.update_dismissed) {
                const banner = document.getElementById('update-banner');
                if (banner) {
                    banner.style.display = 'block';

                    // Click to open Store
                    banner.addEventListener('click', () => {
                        chrome.tabs.create({ url: data.store_url });
                    });
                }
            }
        } catch (e) {
            console.log("ATOM: Update banner check failed", e);
        }
    }

    // Display current sensitivity mode in popup
    async function displaySensitivityMode() {
        try {
            const data = await chrome.storage.local.get(['user_sensitivity', 'adaptive_multiplier']);
            const sensitivity = data.user_sensitivity || 'balanced';
            const multiplier = data.adaptive_multiplier || 1.0;

            const badge = document.getElementById('sensitivity-badge');
            const label = document.getElementById('sensitivity-label');

            if (badge && label) {
                // Remove all mode classes first
                badge.classList.remove('gentle', 'balanced', 'strict');
                badge.classList.add(sensitivity);

                // Set label text with multiplier info if not 1.0
                const modeLabels = {
                    gentle: atomMsg('opt_sens_gentle_title'),
                    balanced: atomMsg('opt_sens_balanced_title'),
                    strict: atomMsg('opt_sens_strict_title')
                };

                let labelText = modeLabels[sensitivity] || atomMsg('opt_sens_balanced_title');
                if (multiplier !== 1.0) {
                    labelText += ` x${multiplier.toFixed(1)}`;
                }
                label.innerText = labelText;
            }
        } catch (e) {
            console.log("ATOM: Failed to display sensitivity mode", e);
        }
    }

    async function updateRetentionStats() {
        if (!window.SpacedRepetitionService || !window.FlashcardDeck) return;

        try {
            const [stats, cards] = await Promise.all([
                window.SpacedRepetitionService.getDailyStats(),
                window.FlashcardDeck.getAllCards()
            ]);

            if (!cards.length) {
                if (retentionGrid) retentionGrid.style.display = 'none';
                if (retentionEmpty) retentionEmpty.style.display = 'block';
                if (retentionStreakLabel) retentionStreakLabel.textContent = '';
                return;
            }

            if (retentionGrid) retentionGrid.style.display = 'grid';
            if (retentionEmpty) retentionEmpty.style.display = 'none';

            if (retentionDue) retentionDue.textContent = String(stats?.dueNow ?? 0);
            if (retentionNew) retentionNew.textContent = String(stats?.newAvailable ?? 0);
            if (retentionRecommended) retentionRecommended.textContent = String(stats?.recommended ?? 0);
            if (retentionStreak) retentionStreak.textContent = String(stats?.streak ?? 0);
            if (retentionStreakLabel) {
                retentionStreakLabel.textContent = stats?.streak ? `🔥 ${stats.streak}` : '';
            }
        } catch (e) {
            console.log("ATOM: Failed to update retention stats", e);
        }
    }

    // Focus Section Elements
    const focusSection = document.getElementById("focus-section");
    const focusToggle = document.getElementById("focus-toggle");
    const focusTimerBadge = document.getElementById("focus-timer-badge");
    const focusReview = document.getElementById("focus-review");
    const btnStart = document.getElementById("focus-start");
    const btnStop = document.getElementById("focus-stop");
    const btnReset = document.getElementById("focus-reset");
    const inWork = document.getElementById("focus-work");
    const breakPreview = document.getElementById("focus-break-preview");

    // Toggle Focus Section collapse/expand
    if (focusToggle && focusSection) {
        focusToggle.addEventListener('click', () => {
            focusSection.classList.toggle('open');
            // Save state
            chrome.storage.local.set({ atom_popup_focus_open: focusSection.classList.contains('open') });
        });

        // Restore collapse state
        chrome.storage.local.get(['atom_popup_focus_open']).then(data => {
            if (data.atom_popup_focus_open) {
                focusSection.classList.add('open');
            }
        });
    }

    // Tự động tính Break = 1/5 Focus time
    function calcBreak(workMin) {
        return Math.ceil(workMin / 5);
    }

    // Cập nhật preview Break khi user nhập Focus time
    function updateBreakPreview() {
        const w = Number(inWork?.value || 0);
        if (w > 0 && breakPreview) {
            breakPreview.textContent = `${calcBreak(w)}m`;
        } else if (breakPreview) {
            breakPreview.textContent = "-";
        }
    }

    if (inWork) {
        inWork.addEventListener("input", updateBreakPreview);
    }

    function fmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }

    async function getFocusState() {
        const resp = await chrome.runtime.sendMessage({ type: "FOCUS_GET_STATE" });
        return resp?.atom_focus_state || null;
    }

    function renderFocus(st) {
        // Update timer badge in header
        if (focusTimerBadge) {
            if (!st?.enabled) {
                focusTimerBadge.textContent = atomMsg("popup_focus_off", null, "OFF");
                focusTimerBadge.classList.add('off');
            } else {
                const now = Date.now();
                const remaining = fmt(st.phaseEndsAt - now);
                focusTimerBadge.textContent = `${st.phase} ${remaining}`;
                focusTimerBadge.classList.remove('off');
                // Auto-expand when active
                if (focusSection && !focusSection.classList.contains('open')) {
                    focusSection.classList.add('open');
                }
            }
        }

        // Update buttons
        if (!st?.enabled) {
            if (btnStart) btnStart.style.display = "inline-flex";
            if (btnStop) btnStop.style.display = "none";
            if (btnReset) btnReset.style.display = "none";
        } else {
            if (btnStart) btnStart.style.display = "none";
            if (btnStop) btnStop.style.display = "inline-flex";
            if (btnReset) btnReset.style.display = "inline-flex";
        }
    }

    async function startFocus(workMin, breakMin) {
        const resp = await chrome.runtime.sendMessage({ type: "FOCUS_START", payload: { workMin, breakMin } });
        const st = resp?.atom_focus_state || await getFocusState();
        renderFocus(st);

        if (st?.sessionId && currentTabInfo && window.TimerIntegration) {
            const session = await window.TimerIntegration.startFocusTracking({
                sessionId: st.sessionId,
                workMin,
                breakMin
            }, currentTabInfo);
            focusLinkedSessionId = session?.id || focusLinkedSessionId;
        }
    }

    async function stopFocus() {
        await chrome.runtime.sendMessage({ type: "FOCUS_STOP" });
        const st = await getFocusState();
        renderFocus(st);
        if (window.TimerIntegration) {
            await window.TimerIntegration.clearLinkedSession();
        }
        focusLinkedSessionId = null;
        hideFocusReview();
    }

    if (btnStart) btnStart.onclick = async () => {
        const w = Number(inWork?.value || 25);
        const b = calcBreak(w);
        await startFocus(w, b);
    };

    if (btnStop) btnStop.onclick = stopFocus;

    if (btnReset) btnReset.onclick = async () => {
        try {
            await chrome.runtime.sendMessage({ type: "FOCUS_RESET_PHASE" });
            const st = await getFocusState();
            renderFocus(st);
        } catch (e) {
            console.warn("[ATOM] Popup reset failed:", e);
        }
    };

    // Preset buttons (25m, 40m, 50m)
    const preset = (id, w) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = () => {
            if (inWork) inWork.value = w;
            updateBreakPreview();
            startFocus(w, calcBreak(w));
        };
    };
    preset("focus-preset-25", 25);
    preset("focus-preset-40", 40);
    preset("focus-preset-50", 50);

    let focusUiTimer = null;
    (async () => {
        const st = await getFocusState();
        renderFocus(st);
        lastFocusPhase = st?.phase || null;
        if (window.TimerIntegration) {
            const linked = await window.TimerIntegration.getLinkedSession();
            focusLinkedSessionId = linked?.sessionId || null;
        }
        clearInterval(focusUiTimer);
        focusUiTimer = setInterval(async () => {
            const st2 = await getFocusState();
            renderFocus(st2);
            if (st2?.phase && lastFocusPhase && st2.phase !== lastFocusPhase) {
                if (lastFocusPhase === "WORK" && st2.phase === "BREAK") {
                    await maybeShowReview();
                }
                lastFocusPhase = st2.phase;
            }
        }, 1000);
    })();

    async function maybeShowReview() {
        if (reviewVisible || !window.TimerIntegration) return;
        if (!focusLinkedSessionId) {
            const linked = await window.TimerIntegration.getLinkedSession();
            focusLinkedSessionId = linked?.sessionId || null;
        }
        if (!focusLinkedSessionId) return;
        const reviewData = await window.TimerIntegration.onWorkPhaseEnd(focusLinkedSessionId);
        if (reviewData) {
            showFocusReview(reviewData);
        }
    }

    function showFocusReview(reviewData) {
        if (!focusReview) return;
        reviewVisible = true;
        focusReview.classList.add('active');

        const stats = reviewData.summary?.stats || {};
        const title = reviewData.summary?.title || '';

        focusReview.innerHTML = `
            <div class="review-header">
                <div>
                    <div>⏱️ ${atomMsg('focus_review_title', null, 'Focus check-in')}</div>
                    <div class="review-subtitle">${atomMsg('focus_review_subtitle', null, 'Lock in what you just learned')}</div>
                </div>
            </div>
            <div class="review-section">
                <div class="review-label">${atomMsg('focus_review_read', null, 'You read')}</div>
                <div class="review-title">${title}</div>
            </div>
            <div class="review-section">
                <div class="review-label">${atomMsg('focus_review_stats', null, 'Session stats')}</div>
                <div class="review-stats">
                    <div class="review-stat">
                        <span class="review-stat-value">${stats.highlights ?? 0}</span>
                        <span class="review-stat-label">${atomMsg('focus_review_stat_highlights', null, 'highlights')}</span>
                    </div>
                    <div class="review-stat">
                        <span class="review-stat-value">${stats.insights ?? 0}</span>
                        <span class="review-stat-label">${atomMsg('focus_review_stat_insights', null, 'insights')}</span>
                    </div>
                    <div class="review-stat">
                        <span class="review-stat-value">${stats.messages ?? 0}</span>
                        <span class="review-stat-label">${atomMsg('focus_review_stat_messages', null, 'messages')}</span>
                    </div>
                </div>
            </div>
            <div class="review-section">
                <div class="review-label">${atomMsg('focus_review_question_label', null, 'Quick recall')}</div>
                <div class="review-question">"${reviewData.recallQuestion || ''}"</div>
                <div class="review-hint">${atomMsg('focus_review_hint', null, 'Write 1-2 sentences. Don’t check the page.')}</div>
                <textarea class="review-textarea" id="focus-recall-answer" placeholder="${atomMsg('focus_review_placeholder', null, 'Type your answer...')}"></textarea>
                <div class="review-feedback" id="focus-recall-feedback"></div>
            </div>
            <div class="review-section">
                <div class="review-actions">
                    <button class="btn-toggle-status active" id="focus-recall-submit">${atomMsg('focus_review_submit', null, 'Save recall')}</button>
                    <button class="btn-toggle-status" id="focus-recall-skip">${atomMsg('focus_review_skip', null, 'Skip')}</button>
                </div>
            </div>
        `;

        focusReview.querySelector('#focus-recall-submit')?.addEventListener('click', async () => {
            const answer = focusReview.querySelector('#focus-recall-answer')?.value || '';
            if (!answer.trim()) return;
            const score = await window.TimerIntegration.recordRecallAnswer(reviewData.sessionId, answer.trim());
            const feedbackEl = focusReview.querySelector('#focus-recall-feedback');
            if (feedbackEl) {
                const feedbackText = score?.feedback || atomMsg('focus_review_feedback_saved', null, 'Saved.');
                const scoreText = Number.isFinite(score?.score) ? ` (${score.score}%)` : '';
                feedbackEl.textContent = `${feedbackText}${scoreText}`;
            }
        });

        focusReview.querySelector('#focus-recall-skip')?.addEventListener('click', hideFocusReview);
    }

    function hideFocusReview() {
        if (!focusReview) return;
        reviewVisible = false;
        focusReview.classList.remove('active');
        focusReview.innerHTML = '';
    }

});

