/**
 * sp_onboarding.js — Onboarding System
 * Phase 2 of Sidepanel Module Split
 * 
 * Handles: Welcome screen, tooltip coach marks,
 * progress tracking, onboarding state machine.
 * 
 * Dependencies (read from window.SP):
 *   SP.getMessage, SP.getIcon, SP.showToast, SP.elements
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Onboarding] SP not found'); return; }

    // ── Constants ──
    const STORAGE_KEY = 'atom_sidepanel_onboarding';
    const MENU_ID = 'menu-onboarding-guide';
    const STATES = Object.freeze({
        NOT_STARTED: 'not_started',
        STARTED: 'started',
        FIRST_HIGHLIGHT_DONE: 'first_highlight_done',
        FIRST_AI_REPLY_DONE: 'first_ai_reply_done',
        FIRST_SAVE_DONE: 'first_save_done',
        COMPLETED: 'completed'
    });
    const ORDER = [
        STATES.NOT_STARTED,
        STATES.STARTED,
        STATES.FIRST_HIGHLIGHT_DONE,
        STATES.FIRST_AI_REPLY_DONE,
        STATES.FIRST_SAVE_DONE,
        STATES.COMPLETED
    ];

    // ── Mutable State ──
    let onboardingState = {
        state: STATES.NOT_STARTED,
        onboarding_completed_at: null,
        skipped_at: null,
        updated_at: null
    };
    let onboardingOverlayEscHandler = null;
    let onboardingLastFocusedElement = null;
    let activeTooltipEscHandler = null;

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function getIcon(name) { return SP.getIcon ? SP.getIcon(name) : ''; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }

    // ===========================
    // Onboarding System
    // ===========================
    function getOnboardingStateIndex(state) {
        return ORDER.indexOf(state);
    }

    function isOnboardingStateAtLeast(state) {
        return getOnboardingStateIndex(onboardingState.state) >= getOnboardingStateIndex(state);
    }

    function isOnboardingCompleted() {
        return onboardingState.state === STATES.COMPLETED;
    }

    function normalizeOnboardingState(rawState) {
        if (!rawState || typeof rawState !== 'object') {
            return { ...onboardingState };
        }

        let normalizedState = STATES.NOT_STARTED;
        let completedAt = null;
        let skippedAt = null;

        if (typeof rawState.state === 'string' && ORDER.includes(rawState.state)) {
            normalizedState = rawState.state;
        } else if (rawState.completedAt || rawState.onboarding_completed_at || rawState.tooltipsShown?.done) {
            normalizedState = STATES.COMPLETED;
        } else if (rawState.tooltipsShown?.chat) {
            normalizedState = STATES.FIRST_AI_REPLY_DONE;
        } else if (rawState.tooltipsShown?.highlight) {
            normalizedState = STATES.FIRST_HIGHLIGHT_DONE;
        } else if (rawState.welcomed) {
            normalizedState = STATES.STARTED;
        }

        completedAt = rawState.onboarding_completed_at || rawState.completedAt || null;
        skippedAt = rawState.skipped_at || null;

        if (normalizedState === STATES.COMPLETED && !completedAt) {
            completedAt = Date.now();
        }

        return {
            state: normalizedState,
            onboarding_completed_at: completedAt,
            skipped_at: skippedAt,
            updated_at: rawState.updated_at || Date.now()
        };
    }

    async function loadOnboardingState() {
        try {
            const data = await chrome.storage.local.get([STORAGE_KEY]);
            onboardingState = normalizeOnboardingState(data[STORAGE_KEY]);
        } catch (e) {
            console.error('[Onboarding] Load error:', e);
        }
    }

    async function saveOnboardingState() {
        try {
            await chrome.storage.local.set({ [STORAGE_KEY]: onboardingState });
        } catch (e) {
            console.error('[Onboarding] Save error:', e);
        }
    }

    async function updateOnboardingState(nextState, options = {}) {
        if (!ORDER.includes(nextState)) return false;

        const currentIndex = getOnboardingStateIndex(onboardingState.state);
        const nextIndex = getOnboardingStateIndex(nextState);
        if (nextIndex < currentIndex) return false;
        if (nextIndex === currentIndex && !options.force) return false;

        onboardingState.state = nextState;
        onboardingState.updated_at = Date.now();

        if (nextState === STATES.COMPLETED && !onboardingState.onboarding_completed_at) {
            onboardingState.onboarding_completed_at = Date.now();
        }
        if (options.skipped) {
            onboardingState.skipped_at = Date.now();
        }

        await saveOnboardingState();
        renderOnboardingProgress();
        updateOnboardingMenuItemLabel();
        return true;
    }

    function getOnboardingStepLabelKey(state) {
        if (state === STATES.FIRST_AI_REPLY_DONE || state === STATES.FIRST_SAVE_DONE) {
            return 'sp_onboarding_progress_step3';
        }
        if (state === STATES.FIRST_HIGHLIGHT_DONE) {
            return 'sp_onboarding_progress_step2';
        }
        return 'sp_onboarding_progress_step1';
    }

    function getOnboardingTaskKey(state) {
        if (state === STATES.FIRST_AI_REPLY_DONE || state === STATES.FIRST_SAVE_DONE) {
            return 'sp_onboard_step3';
        }
        if (state === STATES.FIRST_HIGHLIGHT_DONE) {
            return 'sp_onboard_step2';
        }
        return 'sp_onboard_step1';
    }

    function ensureOnboardingProgressStyles() {
        if (document.getElementById('sp-onboarding-progress-style')) return;
        const style = document.createElement('style');
        style.id = 'sp-onboarding-progress-style';
        style.textContent = `
            .sp-onboarding-progress {
                display: none;
                margin: 10px 0 12px;
                padding: 10px 12px;
                border: 1px dashed rgba(16, 185, 129, 0.45);
                border-radius: 10px;
                background: rgba(16, 185, 129, 0.08);
            }
            .sp-onboarding-progress-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 6px;
            }
            .sp-onboarding-progress-title {
                font-size: 11px;
                font-weight: 600;
                color: var(--foreground);
            }
            .sp-onboarding-progress-step {
                font-size: 11px;
                color: var(--primary);
                font-weight: 600;
                margin-bottom: 4px;
            }
            .sp-onboarding-progress-task {
                font-size: 12px;
                color: var(--foreground);
            }
            .sp-onboarding-skip {
                background: transparent;
                border: 1px solid var(--border);
                color: var(--muted);
                border-radius: 6px;
                padding: 3px 8px;
                font-size: 10px;
                cursor: pointer;
            }
            .sp-onboarding-skip:hover {
                border-color: var(--primary);
                color: var(--primary);
            }
        `;
        document.head.appendChild(style);
    }

    function ensureOnboardingProgressRegion() {
        let region = document.getElementById('onboarding-progress');
        if (region) return region;

        const host = document.querySelector('.sp-main');
        if (!host) return null;

        ensureOnboardingProgressStyles();
        region = document.createElement('section');
        region.id = 'onboarding-progress';
        region.className = 'sp-onboarding-progress';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        region.innerHTML = `
            <div class="sp-onboarding-progress-header">
                <span class="sp-onboarding-progress-title" id="onboarding-progress-title"></span>
                <button type="button" class="sp-onboarding-skip" id="btn-onboarding-skip-inline"></button>
            </div>
            <div class="sp-onboarding-progress-step" id="onboarding-progress-step"></div>
            <div class="sp-onboarding-progress-task" id="onboarding-progress-task"></div>
        `;

        const anchor = document.getElementById('srq-widget-container');
        if (anchor && anchor.parentElement === host) {
            host.insertBefore(region, anchor.nextSibling);
        } else {
            host.insertBefore(region, host.firstChild);
        }

        region.querySelector('#btn-onboarding-skip-inline')?.addEventListener('click', confirmSkipOnboarding);
        return region;
    }

    function renderOnboardingProgress() {
        const region = ensureOnboardingProgressRegion();
        if (!region) return;

        if (isOnboardingCompleted()) {
            region.style.display = 'none';
            return;
        }

        region.style.display = 'block';
        const stepLabel = getMessage(getOnboardingStepLabelKey(onboardingState.state), 'Step 1/3');
        const taskLabel = getMessage(getOnboardingTaskKey(onboardingState.state), 'Highlight one short paragraph.');
        const titleLabel = getMessage('sp_onboarding_progress_title', 'Onboarding progress');
        const skipLabel = getMessage('sp_onboarding_skip', 'Skip guide');

        const titleEl = region.querySelector('#onboarding-progress-title');
        const stepEl = region.querySelector('#onboarding-progress-step');
        const taskEl = region.querySelector('#onboarding-progress-task');
        const skipEl = region.querySelector('#btn-onboarding-skip-inline');

        if (titleEl) titleEl.textContent = titleLabel;
        if (stepEl) stepEl.textContent = stepLabel;
        if (taskEl) taskEl.textContent = taskLabel;
        if (skipEl) skipEl.textContent = skipLabel;
    }

    function ensureOnboardingMenuItem() {
        const menu = SP.elements.menuDropdown;
        if (!menu || document.getElementById(MENU_ID)) return;

        const item = document.createElement('div');
        item.className = 'sp-menu-item';
        item.id = MENU_ID;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '0');
        item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span class="sp-menu-label"></span>
        `;

        const divider = menu.querySelector('.sp-menu-divider');
        if (divider) {
            menu.insertBefore(item, divider);
        } else {
            menu.appendChild(item);
        }

        item.addEventListener('click', () => {
            showWelcomeScreen({ force: true });
            SP.elements.menuDropdown?.classList.remove('show');
            SP.elements.menuBtn?.setAttribute('aria-expanded', 'false');
        });

        updateOnboardingMenuItemLabel();
    }

    // ── What's New menu item in sidepanel dropdown ──
    const WHATS_NEW_MENU_ID = 'menu-whats-new';

    function ensureWhatsNewMenuItem() {
        const menu = SP.elements.menuDropdown;
        if (!menu || document.getElementById(WHATS_NEW_MENU_ID)) return;

        const item = document.createElement('div');
        item.className = 'sp-menu-item';
        item.id = WHATS_NEW_MENU_ID;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('tabindex', '0');
        item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span class="sp-menu-label">${getMessage('menu_whats_new', "What's New")}</span>
        `;

        // Insert after onboarding item, or before divider
        const onboardingItem = document.getElementById(MENU_ID);
        if (onboardingItem && onboardingItem.nextSibling) {
            menu.insertBefore(item, onboardingItem.nextSibling);
        } else {
            const divider = menu.querySelector('.sp-menu-divider');
            if (divider) {
                menu.insertBefore(item, divider);
            } else {
                menu.appendChild(item);
            }
        }

        item.addEventListener('click', () => {
            const ver = chrome.runtime.getManifest().version;
            chrome.tabs.create({
                url: `https://www.amonexus.com/whats-new?v=${encodeURIComponent(ver)}`
            });
            chrome.storage.local.set({ atom_whats_new_unseen: false });
            SP.elements.menuDropdown?.classList.remove('show');
            SP.elements.menuBtn?.setAttribute('aria-expanded', 'false');
        });
    }

    function updateOnboardingMenuItemLabel() {
        const labelEl = document.querySelector(`#${MENU_ID} .sp-menu-label`);
        if (!labelEl) return;
        const key = isOnboardingCompleted() ? 'sp_onboarding_reopen_menu' : 'sp_onboarding_menu_item';
        labelEl.textContent = getMessage(key, 'Open onboarding guide');
    }

    function checkAndShowOnboarding() {
        ensureOnboardingMenuItem();
        ensureWhatsNewMenuItem();
        renderOnboardingProgress();
        if (onboardingState.state === STATES.NOT_STARTED) {
            showWelcomeScreen();
        }
    }

    function showWelcomeScreen({ force = false } = {}) {
        if (isOnboardingCompleted() && !force) return;
        if (document.getElementById('welcome-overlay')) return;

        onboardingLastFocusedElement = document.activeElement;
        const overlay = document.createElement('div');
        overlay.id = 'welcome-overlay';
        overlay.className = 'sp-welcome-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'onboarding-dialog-title');

        const step1 = getMessage('sp_onboard_step1', 'Highlight one short paragraph.');
        const step2 = getMessage('sp_onboard_step2', 'Press Summarize.');
        const step3 = getMessage('sp_onboard_step3', 'Press Save.');
        const welcomeTitle = getMessage('sp_welcome_title', 'Start in one minute');
        const welcomeDesc = getMessage('sp_welcome_desc', 'Follow 3 quick steps to get your first value.');
        const stepsTitle = getMessage('sp_welcome_steps', '3 quick steps');
        const btnStart = getMessage('sp_welcome_start', 'Start now');
        const btnSkip = getMessage('sp_onboarding_skip', 'Skip guide');

        overlay.innerHTML = `
            <div class="sp-welcome-card">
                <div class="sp-welcome-header">
                    <span class="sp-welcome-emoji">${getIcon('hand')}</span>
                    <h2 id="onboarding-dialog-title">${welcomeTitle}</h2>
                    <p>${welcomeDesc}</p>
                </div>

                <div class="sp-welcome-divider"></div>

                <div class="sp-welcome-steps">
                    <h3>${stepsTitle}</h3>
                    <div class="sp-welcome-step">
                        <span class="sp-step-number">1</span>
                        <span class="sp-step-text">${step1}</span>
                    </div>
                    <div class="sp-welcome-step">
                        <span class="sp-step-number">2</span>
                        <span class="sp-step-text">${step2}</span>
                    </div>
                    <div class="sp-welcome-step">
                        <span class="sp-step-number">3</span>
                        <span class="sp-step-text">${step3}</span>
                    </div>
                </div>

                <div class="sp-welcome-divider"></div>

                <div class="sp-welcome-actions">
                    <button class="sp-welcome-btn primary" id="btn-welcome-start">${btnStart}</button>
                    <button class="sp-welcome-btn secondary" id="btn-welcome-skip">${btnSkip}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-welcome-start')?.addEventListener('click', () => {
            closeWelcomeScreen({ markStarted: true });
        });
        document.getElementById('btn-welcome-skip')?.addEventListener('click', confirmSkipOnboarding);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeWelcomeScreen({ markStarted: true });
            }
        });

        onboardingOverlayEscHandler = (e) => {
            if (e.key === 'Escape') {
                closeWelcomeScreen({ markStarted: true });
            }
        };
        document.addEventListener('keydown', onboardingOverlayEscHandler);

        document.getElementById('btn-welcome-start')?.focus();
    }

    async function closeWelcomeScreen({ markStarted = true } = {}) {
        const overlay = document.getElementById('welcome-overlay');
        if (overlay) {
            overlay.classList.add('hiding');
            setTimeout(() => overlay.remove(), 200);
        }

        if (onboardingOverlayEscHandler) {
            document.removeEventListener('keydown', onboardingOverlayEscHandler);
            onboardingOverlayEscHandler = null;
        }

        if (markStarted && !isOnboardingCompleted()) {
            await updateOnboardingState(STATES.STARTED);
        }

        if (onboardingLastFocusedElement && typeof onboardingLastFocusedElement.focus === 'function') {
            onboardingLastFocusedElement.focus();
        }
        onboardingLastFocusedElement = null;
    }

    function dismissActiveTooltip({ callOnDismiss = false } = {}) {
        const tooltip = document.querySelector('.sp-tooltip');
        if (!tooltip) return;

        const dismissCallback = tooltip._onDismiss;
        tooltip.classList.add('hiding');
        setTimeout(() => tooltip.remove(), 200);

        if (activeTooltipEscHandler) {
            document.removeEventListener('keydown', activeTooltipEscHandler);
            activeTooltipEscHandler = null;
        }

        if (callOnDismiss && typeof dismissCallback === 'function') {
            dismissCallback();
        }
    }

    // ===========================
    // Tooltip Coach Marks
    // ===========================
    function showTooltip(targetElement, message, position = 'bottom', onDismiss = null) {
        dismissActiveTooltip();
        if (!targetElement) return;

        const tooltip = document.createElement('div');
        tooltip.className = `sp-tooltip sp-tooltip-${position}`;
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-live', 'polite');
        tooltip._onDismiss = onDismiss;

        const okBtn = getMessage('sp_tooltip_ok', 'OK, got it');
        tooltip.innerHTML = `
            <div class="sp-tooltip-content">
                <span class="sp-tooltip-icon">${getIcon('insight')}</span>
                <span class="sp-tooltip-text">${message}</span>
            </div>
            <button class="sp-tooltip-btn">${okBtn}</button>
        `;

        document.body.appendChild(tooltip);

        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.bottom + 10;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;

        if (position === 'top') {
            top = rect.top - tooltipRect.height - 10;
        } else if (position === 'left') {
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.left - tooltipRect.width - 10;
        } else if (position === 'right') {
            top = rect.top + (rect.height - tooltipRect.height) / 2;
            left = rect.right + 10;
        }

        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;

        const dismiss = (withCallback = true) => dismissActiveTooltip({ callOnDismiss: withCallback });
        tooltip.querySelector('.sp-tooltip-btn')?.addEventListener('click', () => dismiss(true));
        activeTooltipEscHandler = (e) => {
            if (e.key === 'Escape') dismiss(true);
        };
        document.addEventListener('keydown', activeTooltipEscHandler);
        tooltip.querySelector('.sp-tooltip-btn')?.focus();
    }

    async function maybeCompleteOnboarding() {
        if (isOnboardingCompleted()) return;
        const moved = await updateOnboardingState(STATES.COMPLETED);
        if (moved) {
            dismissActiveTooltip();
            showToast(getMessage('sp_onboarding_complete', 'You completed the basic setup.'), 'success');
        }
    }

    async function confirmSkipOnboarding() {
        const confirmText = getMessage(
            'sp_onboarding_skip_confirm',
            'Skip onboarding now? You can open it again from the menu.'
        );
        if (!window.confirm(confirmText)) return;

        await updateOnboardingState(STATES.COMPLETED, { skipped: true });
        await closeWelcomeScreen({ markStarted: false });
        dismissActiveTooltip();
        showToast(
            getMessage('sp_onboarding_skipped', 'Guide skipped. You can reopen it from the menu.'),
            'info'
        );
    }

    async function checkAndShowContextualTooltip(context) {
        if (isOnboardingCompleted()) return;

        switch (context) {
            case 'first_highlight': {
                const advanced = await updateOnboardingState(STATES.FIRST_HIGHLIGHT_DONE);
                if (advanced) {
                    setTimeout(() => {
                        const summarizeBtn = document.querySelector('.sp-quick-chip[data-action="summarize"]');
                        showTooltip(
                            summarizeBtn || SP.elements.userInput,
                            getMessage('sp_tooltip_first_highlight', 'Great. Next, press Summarize.'),
                            'top'
                        );
                    }, 400);
                }
                break;
            }
            case 'first_chat': {
                const advanced = await updateOnboardingState(STATES.FIRST_AI_REPLY_DONE);
                if (advanced) {
                    setTimeout(() => {
                        const saveBtn = document.getElementById('btn-quick-save') || document.getElementById('btn-save-insight');
                        showTooltip(
                            saveBtn,
                            getMessage('sp_tooltip_first_chat', 'Great. Now press Save to keep this highlight.'),
                            'top'
                        );
                    }, 400);
                }
                break;
            }
            case 'first_save':
            case 'first_done': {
                const moved = await updateOnboardingState(STATES.FIRST_SAVE_DONE);
                if (moved || isOnboardingStateAtLeast(STATES.FIRST_SAVE_DONE)) {
                    await maybeCompleteOnboarding();
                }
                break;
            }
        }
    }

    // ── Expose API on SP ──
    SP.loadOnboardingState = loadOnboardingState;
    SP.checkAndShowOnboarding = checkAndShowOnboarding;
    SP.checkAndShowContextualTooltip = checkAndShowContextualTooltip;
    SP.isOnboardingCompleted = isOnboardingCompleted;

    console.log('[SP:Onboarding] Module loaded');
})();
