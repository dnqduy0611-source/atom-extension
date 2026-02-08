// sidepanel.js - Active Reading 2.0 with Thread System
// Highlight-to-Chat + Thread-based Reading

(function () {
    'use strict';

    // ===========================
    // State
    // ===========================
    let pageContext = null;
    // Per-panel in-memory cache for "Deep Angle" output (keyed by normalized URL).
    // Keeps UX snappy without persisting potentially sensitive content.
    const deepAngleByUrl = new Map();
    let threads = [];
    let activeThreadId = null;
    let activeSessionId = null; // Unified ReadingSession ID
    let isLoading = false;
    let isGeneratingInsight = false; // Prevent duplicate insight generation
    let isGeneratingDeepAngle = false; // Prevent duplicate Deep Angle clicks
    let isInsightDisplayHidden = false; // User preference: hide/show Key Insight box
    let currentTabId = null;
    let currentDomain = null;
    let currentModeId = null;
    let retentionOverlay = null;
    let retryingState = {
        active: false,
        previousText: '',
        previousStatusClass: ''
    };
    let semanticFlags = {
        embeddingsEnabled: false,
        semanticSearchEnabled: false
    };
    let acceptedCostWarning = false;
    let userPersona = ''; // User's role/expertise for adaptive explanations

    // Session Management
    let sessionStartTime = Date.now();
    let parkingLot = []; // Ideas not ready to save
    let sessionTimer = null;

    const smartLinkMetrics = {
        connections_detected_count: 0,
        semantic_candidates_count: 0,
        deep_angle_generated_count: 0,
        fallback_to_recency_count: 0,
        embedding_api_errors: 0
    };

    // DOM Elements (will be populated after DOM ready)
    let elements = {};

    // ===========================
    // API Configuration
    // ===========================
    // Default config (fallback if centralized config not loaded)
    let API_CONFIG = {
        MODEL_NAME: "gemini-3-flash-preview",
        FALLBACK_MODEL: "gemini-2.5-flash",
        API_BASE: "https://generativelanguage.googleapis.com/v1beta/models",
        MAX_CONTEXT_CHARS: 100000,
        TIMEOUT_MS: 30000,
        RETRY_MAX_ATTEMPTS: 3,
        RETRY_BASE_DELAY_MS: 1000,
        FALLBACK_CHAIN: ["gemini-2.5-flash", "gemini-2.5-flash-lite"], // Multi-level fallback sequence
        CACHE: {
            STRATEGY_TTL_MS: 30000,
            PILOT_TTL_MS: 300000,
            SMARTLINK_TTL_MS: 600000,
            RELATED_MEMORY_TTL_MS: 600000,
            DEEP_ANGLE_TTL_MS: 21600000,
            DEFAULT_BACKGROUND_TTL_MS: 300000,
            VIP_CACHE_ENABLED: false
        }
    };

    // Load centralized AI config from Chrome Storage
    // This syncs with config/ai_config.js via background.js
    async function loadAIConfig() {
        try {
            const data = await chrome.storage.local.get(['atom_ai_config_v1']);
            const config = data.atom_ai_config_v1;
            if (config) {
                // Use null-safe access to prevent overwriting defaults with undefined
                if (config.MODELS?.USER?.primary) {
                    API_CONFIG.MODEL_NAME = config.MODELS.USER.primary;
                }
                if (config.MODELS?.USER?.fallback_chain) {
                    API_CONFIG.FALLBACK_CHAIN = config.MODELS.USER.fallback_chain;
                    console.log("[AI Config] Loaded Fallback Chain:", API_CONFIG.FALLBACK_CHAIN);
                } else if (config.MODELS?.USER?.fallback) {
                    API_CONFIG.FALLBACK_MODEL = config.MODELS.USER.fallback;
                }
                if (config.API?.BASE_URL) {
                    API_CONFIG.API_BASE = config.API.BASE_URL;
                }
                if (config.DEFAULTS?.TIMEOUT_MS) {
                    API_CONFIG.TIMEOUT_MS = config.DEFAULTS.TIMEOUT_MS;
                }
                if (config.RETRY?.MAX_ATTEMPTS) {
                    API_CONFIG.RETRY_MAX_ATTEMPTS = config.RETRY.MAX_ATTEMPTS;
                }
                if (config.RETRY?.BASE_DELAY_MS) {
                    API_CONFIG.RETRY_BASE_DELAY_MS = config.RETRY.BASE_DELAY_MS;
                }
                if (config.CACHE) {
                    API_CONFIG.CACHE = { ...API_CONFIG.CACHE, ...config.CACHE };
                }
                console.log('[Sidepanel] Loaded AI config:', API_CONFIG.MODEL_NAME, 'API:', API_CONFIG.API_BASE);
            }
        } catch (e) {
            console.warn('[Sidepanel] Using default AI config:', e);
        }
    }

    async function loadFeatureFlags() {
        try {
            if (window.FeatureFlags?.getFlags) {
                const flags = await window.FeatureFlags.getFlags();
                semanticFlags.embeddingsEnabled = !!flags.EMBEDDINGS_ENABLED;
                semanticFlags.semanticSearchEnabled = !!flags.SEMANTIC_SEARCH_ENABLED;
                const ack = await chrome.storage.local.get(['accepted_cost_warning']);
                acceptedCostWarning = !!ack.accepted_cost_warning;
                return;
            }
        } catch (e) {
            console.warn('[Sidepanel] Failed to load FeatureFlags:', e);
        }

        try {
            const data = await chrome.storage.local.get(['atom_feature_flags_v1', 'accepted_cost_warning']);
            const flags = data.atom_feature_flags_v1 || {};
            semanticFlags.embeddingsEnabled = !!flags.EMBEDDINGS_ENABLED;
            semanticFlags.semanticSearchEnabled = !!flags.SEMANTIC_SEARCH_ENABLED;
            acceptedCostWarning = !!data.accepted_cost_warning;
        } catch (e) {
            console.warn('[Sidepanel] Using default semantic flags:', e);
        }
    }

    async function loadUserPreferences() {
        try {
            const data = await chrome.storage.local.get(['user_persona', 'sp_insight_display_hidden']);
            userPersona = data.user_persona || '';
            isInsightDisplayHidden = !!data.sp_insight_display_hidden;
            console.log('[Sidepanel] Loaded Persona:', userPersona);
            const thread = threads.find(t => t.id === activeThreadId);
            syncInsightDisplayUI(thread);
        } catch (e) {
            console.warn('[Sidepanel] Failed to load User Persona:', e);
        }
    }

    // ===========================
    // Context Levels for Token Optimization
    // ===========================
    const CONTEXT_LEVELS = {
        MINIMAL: 'minimal',   // ~500 chars - highlight only (after 3+ messages)
        STANDARD: 'standard', // ~1500 chars - highlight + paragraph + heading
        FULL: 'full'          // ~12000 chars - includes page content (for summarize/analyze)
    };

    // Actions that require full page context
    const FULL_CONTEXT_ACTIONS = ['summarize_page', 'analyze_structure', 'overview', 'outline'];
    const AUTO_SUMMARY_THRESHOLD = 3;

    // ===========================
    // Feature Flags (Phase 1)
    // ===========================
    const FEATURE_FLAGS = {
        PRE_READING_PRIMER: true,
        LEARNING_OBJECTIVES: true,
        RELATED_MEMORY: true  // Phase 3: Semantic Brain
    };

    /**
     * Determine appropriate context level based on action and conversation state
     */
    function determineContextLevel(action, messageCount) {
        // Full context only for specific actions that need entire page
        if (action && FULL_CONTEXT_ACTIONS.includes(action)) {
            return CONTEXT_LEVELS.FULL;
        }

        // After 3+ exchanges, use minimal context (conversation has enough context)
        if (messageCount >= 3) {
            return CONTEXT_LEVELS.MINIMAL;
        }

        // Default: standard context with surrounding paragraph
        return CONTEXT_LEVELS.STANDARD;
    }

    // ===========================
    // Network State Management
    // ===========================
    let isOnline = navigator.onLine;
    let pendingMessages = []; // Queue for offline messages

    // ===========================
    // Undo System
    // ===========================
    const UNDO_TIMEOUT_MS = 5000; // 5 seconds
    let undoStack = []; // Stack of undoable actions
    let activeUndoToast = null; // Currently displayed undo toast

    const ONBOARDING_STORAGE_KEY = 'atom_sidepanel_onboarding';
    const ONBOARDING_MENU_ID = 'menu-onboarding-guide';
    const ONBOARDING_STATES = Object.freeze({
        NOT_STARTED: 'not_started',
        STARTED: 'started',
        FIRST_HIGHLIGHT_DONE: 'first_highlight_done',
        FIRST_AI_REPLY_DONE: 'first_ai_reply_done',
        FIRST_SAVE_DONE: 'first_save_done',
        COMPLETED: 'completed'
    });
    const ONBOARDING_ORDER = [
        ONBOARDING_STATES.NOT_STARTED,
        ONBOARDING_STATES.STARTED,
        ONBOARDING_STATES.FIRST_HIGHLIGHT_DONE,
        ONBOARDING_STATES.FIRST_AI_REPLY_DONE,
        ONBOARDING_STATES.FIRST_SAVE_DONE,
        ONBOARDING_STATES.COMPLETED
    ];
    let onboardingState = {
        state: ONBOARDING_STATES.NOT_STARTED,
        onboarding_completed_at: null,
        skipped_at: null,
        updated_at: null
    };
    let onboardingOverlayEscHandler = null;
    let onboardingLastFocusedElement = null;
    let activeTooltipEscHandler = null;

    // ===========================
    // Onboarding System (Wave 4)
    // ===========================
    function getOnboardingStateIndex(state) {
        return ONBOARDING_ORDER.indexOf(state);
    }

    function isOnboardingStateAtLeast(state) {
        return getOnboardingStateIndex(onboardingState.state) >= getOnboardingStateIndex(state);
    }

    function isOnboardingCompleted() {
        return onboardingState.state === ONBOARDING_STATES.COMPLETED;
    }

    function normalizeOnboardingState(rawState) {
        if (!rawState || typeof rawState !== 'object') {
            return { ...onboardingState };
        }

        let normalizedState = ONBOARDING_STATES.NOT_STARTED;
        let completedAt = null;
        let skippedAt = null;

        if (typeof rawState.state === 'string' && ONBOARDING_ORDER.includes(rawState.state)) {
            normalizedState = rawState.state;
        } else if (rawState.completedAt || rawState.onboarding_completed_at || rawState.tooltipsShown?.done) {
            normalizedState = ONBOARDING_STATES.COMPLETED;
        } else if (rawState.tooltipsShown?.chat) {
            normalizedState = ONBOARDING_STATES.FIRST_AI_REPLY_DONE;
        } else if (rawState.tooltipsShown?.highlight) {
            normalizedState = ONBOARDING_STATES.FIRST_HIGHLIGHT_DONE;
        } else if (rawState.welcomed) {
            normalizedState = ONBOARDING_STATES.STARTED;
        }

        completedAt = rawState.onboarding_completed_at || rawState.completedAt || null;
        skippedAt = rawState.skipped_at || null;

        if (normalizedState === ONBOARDING_STATES.COMPLETED && !completedAt) {
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
            const data = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY]);
            onboardingState = normalizeOnboardingState(data[ONBOARDING_STORAGE_KEY]);
        } catch (e) {
            console.error('[Onboarding] Load error:', e);
        }
    }

    async function saveOnboardingState() {
        try {
            await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: onboardingState });
        } catch (e) {
            console.error('[Onboarding] Save error:', e);
        }
    }

    async function updateOnboardingState(nextState, options = {}) {
        if (!ONBOARDING_ORDER.includes(nextState)) return false;

        const currentIndex = getOnboardingStateIndex(onboardingState.state);
        const nextIndex = getOnboardingStateIndex(nextState);
        if (nextIndex < currentIndex) return false;
        if (nextIndex === currentIndex && !options.force) return false;

        onboardingState.state = nextState;
        onboardingState.updated_at = Date.now();

        if (nextState === ONBOARDING_STATES.COMPLETED && !onboardingState.onboarding_completed_at) {
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
        if (state === ONBOARDING_STATES.FIRST_AI_REPLY_DONE || state === ONBOARDING_STATES.FIRST_SAVE_DONE) {
            return 'sp_onboarding_progress_step3';
        }
        if (state === ONBOARDING_STATES.FIRST_HIGHLIGHT_DONE) {
            return 'sp_onboarding_progress_step2';
        }
        return 'sp_onboarding_progress_step1';
    }

    function getOnboardingTaskKey(state) {
        if (state === ONBOARDING_STATES.FIRST_AI_REPLY_DONE || state === ONBOARDING_STATES.FIRST_SAVE_DONE) {
            return 'sp_onboard_step3';
        }
        if (state === ONBOARDING_STATES.FIRST_HIGHLIGHT_DONE) {
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
        const menu = elements.menuDropdown;
        if (!menu || document.getElementById(ONBOARDING_MENU_ID)) return;

        const item = document.createElement('div');
        item.className = 'sp-menu-item';
        item.id = ONBOARDING_MENU_ID;
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
            elements.menuDropdown?.classList.remove('show');
            elements.menuBtn?.setAttribute('aria-expanded', 'false');
        });

        updateOnboardingMenuItemLabel();
    }

    function updateOnboardingMenuItemLabel() {
        const labelEl = document.querySelector(`#${ONBOARDING_MENU_ID} .sp-menu-label`);
        if (!labelEl) return;
        const key = isOnboardingCompleted() ? 'sp_onboarding_reopen_menu' : 'sp_onboarding_menu_item';
        labelEl.textContent = getMessage(key, 'Open onboarding guide');
    }

    function checkAndShowOnboarding() {
        ensureOnboardingMenuItem();
        renderOnboardingProgress();
        if (onboardingState.state === ONBOARDING_STATES.NOT_STARTED) {
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
            await updateOnboardingState(ONBOARDING_STATES.STARTED);
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
        const moved = await updateOnboardingState(ONBOARDING_STATES.COMPLETED);
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

        await updateOnboardingState(ONBOARDING_STATES.COMPLETED, { skipped: true });
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
                const advanced = await updateOnboardingState(ONBOARDING_STATES.FIRST_HIGHLIGHT_DONE);
                if (advanced) {
                    setTimeout(() => {
                        const summarizeBtn = document.querySelector('.sp-quick-chip[data-action="summarize"]');
                        showTooltip(
                            summarizeBtn || elements.userInput,
                            getMessage('sp_tooltip_first_highlight', 'Great. Next, press Summarize.'),
                            'top'
                        );
                    }, 400);
                }
                break;
            }
            case 'first_chat': {
                const advanced = await updateOnboardingState(ONBOARDING_STATES.FIRST_AI_REPLY_DONE);
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
                const moved = await updateOnboardingState(ONBOARDING_STATES.FIRST_SAVE_DONE);
                if (moved || isOnboardingStateAtLeast(ONBOARDING_STATES.FIRST_SAVE_DONE)) {
                    await maybeCompleteOnboarding();
                }
                break;
            }
        }
    }

    // ===========================
    // Search & Filter System
    // ===========================
    let searchQuery = '';
    let activeFilter = 'all'; // 'all', 'today', 'week', 'insights', 'notes'
    let isSearchOpen = false;

    // ===========================
    // Multi-Tab Session Management
    // ===========================
    const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let broadcastChannel = null;

    // ===========================
    // Icon Helper
    // ===========================
    function getIcon(name, className = '') {
        const icons = {
            'thread': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            'check': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><polyline points="20 6 9 17 4 12"/></svg>`,
            'save': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
            'note': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
            'remove': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
            'insight': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
            'promote': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
            'info': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
            'search': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
            'book': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
            'user': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            'keyboard': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M6 12h.001"/><path d="M10 12h.001"/><path d="M14 12h.001"/><path d="M18 12h.001"/><path d="M7 16h10"/></svg>`,
            'hand': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
            'num1': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M10 10l2-2"/></svg>`,
            'num2': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="12" cy="12" r="10"/><path d="M10 9c0-.6.4-1 1-1h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H10l3 4v.01H10"/></svg>`,
            'num3': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="12" cy="12" r="10"/><path d="M9 9h3.5a1.5 1.5 0 0 1 0 3H12h.5a1.5 1.5 0 0 1 0 3H9"/></svg>`,
            'num4': `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}"><circle cx="12" cy="12" r="10"/><path d="M13 16V8l-3 5h4"/></svg>`
        };
        return icons[name] || '';
    }

    // ===========================
    // i18n Helper
    // ===========================
    function getMessage(key, fallback = '') {
        try {
            const msg = chrome.i18n.getMessage(key);
            return msg || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function applyI18n() {
        // Apply data-i18n to textContent
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const msg = getMessage(key);
            if (msg) el.textContent = msg;
        });

        // Apply data-i18n-placeholder to placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const msg = getMessage(key);
            if (msg) el.placeholder = msg;
        });
    }

    // ===========================
    // Initialization
    // ===========================
    async function init() {
        // Load centralized AI config first (synced from background.js)
        await loadAIConfig();
        await loadFeatureFlags();

        // Apply i18n
        applyI18n();

        // New 3-zone layout elements
        elements = {
            // Offline banner
            offlineBanner: document.getElementById('offline-banner'),
            retryConnectionBtn: document.getElementById('btn-retry-connection'),

            // Zone 1: Top Bar
            sessionTimerEl: document.getElementById('session-timer'),
            pageTitle: document.getElementById('page-title'),
            contextStatus: document.getElementById('context-status'),
            contextText: document.getElementById('context-text'),
            refreshBtn: document.getElementById('btn-new-chat-top'),
            menuBtn: document.getElementById('btn-menu'),
            menuDropdown: document.getElementById('menu-dropdown'),
            menuSemanticEmbeddings: document.getElementById('menu-semantic-embeddings'),
            menuSemanticSearch: document.getElementById('menu-semantic-search'),
            menuEmbeddingsStatus: document.getElementById('menu-embeddings-status'),
            menuSemanticStatus: document.getElementById('menu-semantic-status'),

            // Zone 2: Main View
            currentContext: document.getElementById('current-context'),
            highlightText: document.getElementById('highlight-text'),
            primerRoot: document.getElementById('primer-root'),
            modeRoot: document.getElementById('mode-selector-root'),
            memoryRoot: document.getElementById('memory-root'),
            quickActions: document.getElementById('quick-actions'),
            insightsSummary: document.getElementById('insights-summary'),
            insightsList: document.getElementById('insights-list'),
            insightsCount: document.getElementById('insights-count'),
            messages: document.getElementById('messages'),
            emptyState: document.getElementById('empty-state'),
            insightDisplay: document.getElementById('insight-display'),
            insightText: document.getElementById('insight-text'),
            insightHideBtn: document.getElementById('btn-insight-hide'),
            insightToggleBtn: document.getElementById('btn-toggle-insight'),
            actionBar: document.getElementById('action-bar'),
            charCount: document.getElementById('char-count'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('btn-send'),

            // Zone 3: Bottom Tabs
            threadList: document.getElementById('thread-list'),
            discussionsCount: document.getElementById('discussions-count'),
            notesList: document.getElementById('notes-list'),
            notesCount: document.getElementById('notes-count'),
            noteInput: document.getElementById('note-input'),
            connectionsList: document.getElementById('connections-list'),
            connectionsCount: document.getElementById('connections-count'),
            deepAngleBtn: document.getElementById('btn-deep-angle'),
            deepAngleOutput: document.getElementById('deep-angle-output'),
            deepAngleText: document.getElementById('deep-angle-text'),
            deepAngleStatus: document.getElementById('deep-angle-status'),

            // Toggle
            toggleTabsBtn: document.getElementById('btn-toggle-tabs'),
            bottomTabsContainer: document.querySelector('.sp-bottom-tabs')
        };

        setupEventListeners();
        setupMenuDropdown();
        updateSemanticMenuUI();
        setupTabs();
        setupNotes();
        setupActionBar();
        await loadPageContext();
        await loadThreadsFromStorage();
        await loadParkingLot();
        listenForHighlights();
        updateAllCounts();

        // Restore collapsed state
        try {
            const collapsedState = await chrome.storage.local.get(['sp_tabs_collapsed']);
            if (collapsedState.sp_tabs_collapsed && elements.bottomTabsContainer) {
                elements.bottomTabsContainer.classList.add('collapsed');
            }
        } catch (e) {
            console.warn('Failed to restore tabs state', e);
        }

        // Initialize onboarding
        await loadOnboardingState();
        checkAndShowOnboarding();

        // Initialize multi-tab handling
        initMultiTabHandling();
    }

    // ===========================
    // Phase 1: Primer + Learning Mode
    // ===========================
    async function ensureActiveSession() {
        if (!pageContext || typeof ReadingSessionService === 'undefined') return null;
        try {
            const session = await ReadingSessionService.getOrCreateSession(
                pageContext.url || '',
                pageContext.title || '',
                pageContext.domain || currentDomain || ''
            );
            activeSessionId = session.id;
            return session;
        } catch (e) {
            console.error('[ReadingSession] Failed to ensure session:', e);
            return null;
        }
    }

    async function initLearningModeUI() {
        if (!FEATURE_FLAGS.LEARNING_OBJECTIVES || !elements.modeRoot) return;
        if (!window.LearningObjectiveService || !window.ModeSelectorUI) return;

        const mode = await window.LearningObjectiveService.getSessionMode(activeSessionId);
        currentModeId = mode?.id || 'deep';

        elements.modeRoot.innerHTML = '';
        const modeUi = window.ModeSelectorUI.createModeSelectorUI(
            currentModeId,
            {
                label: getMessage('sp_mode_label', 'Reading mode'),
                skimLabel: getMessage('sp_mode_skim_label', 'Skim'),
                skimDesc: getMessage('sp_mode_skim_desc', 'Quick overview'),
                deepLabel: getMessage('sp_mode_deep_label', 'Deep'),
                deepDesc: getMessage('sp_mode_deep_desc', 'Full analysis')
            },
            async (modeId) => {
                currentModeId = modeId;
                await window.LearningObjectiveService.setSessionMode(activeSessionId, modeId);
                await window.LearningObjectiveService.setUserDefaultMode(modeId);
                updateQuickActionChips();
            }
        );

        elements.modeRoot.appendChild(modeUi);
        elements.modeRoot.classList.add('active');
        updateQuickActionChips();
    }

    function updateQuickActionChips() {
        if (!elements.quickActions) return;
        if (!window.LearningObjectiveService || !currentModeId) {
            elements.quickActions.querySelectorAll('.sp-quick-chip').forEach((chip) => {
                chip.style.display = 'inline-flex';
            });
            return;
        }

        const allowed = window.LearningObjectiveService.getChipsForMode(currentModeId) || [];
        const chips = elements.quickActions.querySelectorAll('.sp-quick-chip');
        chips.forEach((chip) => {
            const action = chip.getAttribute('data-action');
            const shouldShow = allowed.includes(action);
            chip.style.display = shouldShow ? 'inline-flex' : 'none';

            const bloomMeta = window.LearningObjectiveService.getBloomMeta?.(action);
            if (bloomMeta) {
                const label = getMessage(bloomMeta.key, bloomMeta.fallback);
                chip.setAttribute('data-bloom-level', String(bloomMeta.level));
                chip.setAttribute('data-bloom-label', label);
                chip.title = `${label} • ${chip.title || ''}`.trim();
            } else {
                chip.removeAttribute('data-bloom-level');
                chip.removeAttribute('data-bloom-label');
            }
        });
    }

    function hashString(input) {
        const text = String(input || '');
        let hash = 5381;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i);
            hash &= 0x7fffffff;
        }
        return hash.toString(16);
    }

    function recordSmartLinkMetric(name, delta = 1) {
        if (!Object.prototype.hasOwnProperty.call(smartLinkMetrics, name)) return;
        const increment = Number.isFinite(delta) ? delta : 1;
        smartLinkMetrics[name] += increment;
        window.__ATOM_SMARTLINK_METRICS__ = { ...smartLinkMetrics };
    }

    function setMenuBadgeState(element, state) {
        if (!element) return;
        const labelOn = getMessage('sp_toggle_on', 'On');
        const labelOff = getMessage('sp_toggle_off', 'Off');
        const labelLocked = getMessage('sp_toggle_locked', 'Key');
        let label = labelOff;
        let className = 'off';
        if (state === 'on') {
            label = labelOn;
            className = 'on';
        } else if (state === 'locked') {
            label = labelLocked;
            className = 'off';
        }
        element.textContent = label;
        element.classList.toggle('on', className === 'on');
        element.classList.toggle('off', className !== 'on');
    }

    async function updateSemanticMenuUI() {
        const apiKey = await getApiKey();
        const hasKey = !!apiKey;
        if (!hasKey) {
            setMenuBadgeState(elements.menuEmbeddingsStatus, 'locked');
            setMenuBadgeState(elements.menuSemanticStatus, 'locked');
            return;
        }
        setMenuBadgeState(elements.menuEmbeddingsStatus, semanticFlags.embeddingsEnabled ? 'on' : 'off');
        setMenuBadgeState(elements.menuSemanticStatus, semanticFlags.semanticSearchEnabled ? 'on' : 'off');
    }

    async function ensureCostWarningAccepted() {
        if (acceptedCostWarning) return true;
        const message = getMessage(
            'sp_semantic_cost_warning',
            'This may increase Gemini API usage and cost. Do you want to continue?'
        );
        const accepted = window.confirm(message);
        if (accepted) {
            acceptedCostWarning = true;
            await chrome.storage.local.set({ accepted_cost_warning: true });
        }
        return accepted;
    }

    async function persistSemanticFlags(patch) {
        const data = await chrome.storage.local.get(['atom_feature_flags_v1']);
        const current = data.atom_feature_flags_v1 || {};
        const next = { ...current, ...patch };
        await chrome.storage.local.set({ atom_feature_flags_v1: next });
        semanticFlags.embeddingsEnabled = !!next.EMBEDDINGS_ENABLED;
        semanticFlags.semanticSearchEnabled = !!next.SEMANTIC_SEARCH_ENABLED;
        return next;
    }

    async function toggleSemanticFlag(flagKey) {
        const apiKey = await getApiKey();
        if (!apiKey) {
            showToast(getMessage('sp_semantic_key_required', 'Add your API key in Settings to enable this.'), 'warning');
            updateSemanticMenuUI();
            return;
        }

        const currentValue = flagKey === 'EMBEDDINGS_ENABLED'
            ? semanticFlags.embeddingsEnabled
            : semanticFlags.semanticSearchEnabled;
        const nextValue = !currentValue;

        if (nextValue) {
            const accepted = await ensureCostWarningAccepted();
            if (!accepted) return;
        }

        const nextFlags = await persistSemanticFlags({ [flagKey]: nextValue });
        updateSemanticMenuUI();

        if (flagKey === 'SEMANTIC_SEARCH_ENABLED' && nextValue && !nextFlags.EMBEDDINGS_ENABLED) {
            showToast(getMessage('sp_semantic_needs_embeddings', 'Semantic Search works best with Embeddings on.'), 'info');
        }
    }

    async function checkAndShowPrimer() {
        if (!FEATURE_FLAGS.PRE_READING_PRIMER || !elements.primerRoot) return;
        if (!pageContext || !window.PrimerService || !window.PrimerUI) return;

        elements.primerRoot.classList.remove('active');
        elements.primerRoot.innerHTML = '';

        if (!window.PrimerService.shouldShowPrimer(pageContext)) return;
        if (await window.PrimerService.wasPrimerShown(pageContext.url)) return;

        const apiKey = await getApiKey();
        if (!apiKey) return;

        const primerData = await window.PrimerService.generatePrimer(
            pageContext,
            apiKey,
            callGeminiAPI
        );

        if (!primerData?.success) return;

        const primerUi = window.PrimerUI.createPrimerUI(
            primerData,
            {
                title: getMessage('sp_primer_title', 'Before you read...'),
                topicLabel: getMessage('sp_primer_topic_label', 'This article covers:'),
                objectivesLabel: getMessage('sp_primer_objectives', 'Reading objectives:'),
                startLabel: getMessage('sp_primer_start', 'Start reading'),
                skipLabel: getMessage('sp_primer_skip', 'Skip')
            },
            async (questions) => {
                await handlePrimerAccept(questions);
            },
            () => {
                handlePrimerSkip();
            }
        );

        elements.primerRoot.appendChild(primerUi);
        elements.primerRoot.classList.add('active');
        await window.PrimerService.markPrimerShown(pageContext.url);
    }

    async function handlePrimerAccept(questions) {
        const questionTexts = Array.isArray(questions)
            ? questions.map(q => q?.question).filter(Boolean)
            : [];

        if (activeSessionId && typeof ReadingSessionService !== 'undefined') {
            // Check if we need to reset for new page context (if session mismatch)
            if (pageContext?.url && activeSessionId) {
                const session = await ReadingSessionService.getSessionById(activeSessionId);
                // If the active session URL is different from current page, force a reset
                // But typically ensureActiveSession handles this. 
                // We enforce a UI clear if the user explicitly clicked "Start Reading" on a new page
                // to avoid "ghost" threads from previous page if they weren't cleared.
            }

            await ReadingSessionService.updateSession(activeSessionId, {
                learningObjective: {
                    mode: currentModeId || 'deep',
                    questions: questionTexts,
                    acceptedAt: Date.now()
                }
            });

            // Explicitly refresh thread view to ensure we are seeing only relevant threads
            // (Though loadPageContext calls loadThreadsFromStorage which filters by domain/url)
            renderThreadList();
        }

        elements.primerRoot?.classList.remove('active');
        if (elements.primerRoot) elements.primerRoot.innerHTML = '';
        showToast(getMessage('sp_primer_started', 'Reading objectives set!'), 'success');
    }

    function handlePrimerSkip() {
        elements.primerRoot?.classList.remove('active');
        if (elements.primerRoot) elements.primerRoot.innerHTML = '';
        showToast(getMessage('sp_primer_skipped', 'Primer skipped'), 'info');
    }

    // ===========================
    // Phase 3: Semantic Brain - Related Memory
    // ===========================
    async function checkAndShowRelatedMemory() {
        if (!FEATURE_FLAGS.RELATED_MEMORY || !elements.memoryRoot) return;

        // Clear previous
        elements.memoryRoot.classList.remove('active');
        elements.memoryRoot.innerHTML = '';

        // Check dependencies
        if (!window.RelatedMemoryService || !window.RelatedMemoryUI) {
            console.log('[SidePanel] Related Memory services not available');
            return;
        }

        if (!pageContext) return;

        try {
            const rateManager = window.__ATOM_RATE_MANAGER__;
            if (rateManager?.isInCooldown?.() || rateManager?.isInProbation?.()) {
                return;
            }

            // Get API key
            const { gemini_api_key, apiKey } = await chrome.storage.local.get(['gemini_api_key', 'apiKey']);
            const key = gemini_api_key || apiKey;

            // Check for related memory
            const memoryData = await window.RelatedMemoryService.checkForRelatedMemory(
                pageContext,
                key,
                callGeminiAPI,
                {
                    priority: 'background',
                    allowFallback: true,
                    skipDuringCooldown: true,
                    errorSource: 'related-memory',
                    cacheKeyPrefix: 'related-memory',
                    cacheTtlMs: API_CONFIG.CACHE.RELATED_MEMORY_TTL_MS || 10 * 60 * 1000
                }
            );

            if (!memoryData) return;

            // Inject styles
            window.RelatedMemoryUI.injectRelatedMemoryStyles();

            // Get i18n strings
            const strings = {
                title: getMessage('sp_memory_title', 'Related from your Memory'),
                intro: getMessage('sp_memory_intro', 'This reminds me of your notes on:'),
                similarLabel: getMessage('sp_memory_similar', 'similar'),
                insightsLabel: getMessage('sp_memory_insights', 'insights'),
                viewNotes: getMessage('sp_memory_view', 'View Notes'),
                compare: getMessage('sp_memory_compare', 'Compare Concepts'),
                dismiss: getMessage('sp_memory_dismiss', 'Dismiss'),
                alsoRelated: getMessage('sp_memory_also', 'Also related:')
            };

            // Create UI
            const memoryUi = window.RelatedMemoryUI.createRelatedMemoryUI(memoryData, strings, {
                onViewNotes: (sessionId) => {
                    // Navigate to session in threads tab
                    handleViewRelatedSession(sessionId);
                },
                onCompare: (currentPage, match) => {
                    handleCompareWithRelated(currentPage, match);
                },
                onDismiss: () => {
                    window.RelatedMemoryService.dismissForUrl(pageContext?.url);
                    elements.memoryRoot?.classList.remove('active');
                }
            });

            if (memoryUi) {
                elements.memoryRoot.appendChild(memoryUi);
                elements.memoryRoot.classList.add('active');
                window.RelatedMemoryService.markSuggestionShown();
            }

        } catch (err) {
            console.error('[SidePanel] Related Memory check failed:', err);
        }
    }

    /**
  * Handles "View Notes" from Related Memory
  * @param {string} sessionId - Target session ID
  * @param {string} url - Target URL (optional)
  */
    async function handleViewRelatedSession(sessionId, url) {
        if (!sessionId) return;

        // Normalizing URLs for comparison
        const normalize = (u) => (u || '').split('#')[0].replace(/\/$/, '');
        const currentUrl = normalize(pageContext?.url);
        const targetUrl = normalize(url);

        // Case 1: Different URL -> Open in new tab
        if (url && targetUrl && targetUrl !== currentUrl) {
            showToast(getMessage('sp_opening_new_tab', 'Opening in new tab...'), 'info');
            chrome.tabs.create({ url: url });
            return;
        }

        // Case 2: Same URL -> Switch to thread
        // Find thread with this sessionId
        // Note: sessionId in threads is usually `thread_<timestamp>` or mapped via ReadingSession
        // Checking if we have a thread with this ID directly or via property
        let targetThread = threads.find(t => t.id === sessionId || t.sessionId === sessionId);

        if (!targetThread) {
            // Fallback: Try to hydrate from historic session
            console.log('[SidePanel] Thread not found active, attempting hydration for:', sessionId);
            const hydrated = await hydrateSessionToThread(sessionId);
            if (hydrated) {
                targetThread = hydrated;
                showToast(getMessage('sp_session_restored', 'Session restored'), 'success');
            } else {
                console.warn('[SidePanel] Failed to hydrate session:', sessionId);
                showToast(getMessage('sp_session_not_loaded', 'Session not active in this thread list'), 'warning');
                return;
            }
        }

        // Switch to Discussions tab
        const tabBtn = document.querySelector('.sp-tab-btn[data-tab="discussions"]');
        if (tabBtn) tabBtn.click();

        // Set active thread
        activeThreadId = targetThread.id;
        renderThreadList();
        renderActiveThread();

        // Scroll to thread item
        setTimeout(() => {
            const el = document.querySelector(`.sp-thread-item[data-id="${activeThreadId}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-pulse');
                setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
            }
        }, 100);

        showToast(getMessage('sp_memory_viewing', 'Viewing related discussion'), 'success');
    }

    /**
     * Hydrate a historic ReadingSession into a SidePanel Thread
     * @param {string} sessionId 
     * @returns {Promise<Object|null>}
     */
    async function hydrateSessionToThread(sessionId) {
        if (!window.ReadingSessionService) return null;

        try {
            const session = await ReadingSessionService.getSessionById(sessionId);
            if (!session) return null;

            // Construct thread object
            const newThread = {
                id: session.id,
                sessionId: session.id, // Ensure link
                highlight: {
                    text: session.highlights?.[0]?.text || '',
                    url: session.url,
                    title: session.title,
                    domain: session.domain,
                    timestamp: session.createdAt
                },
                messages: session.thread?.messages || [],
                connections: session.connections || [],
                status: session.thread?.status || 'active',
                createdAt: session.createdAt,
                hydrated: true
            };

            // Add to threads list
            threads.push(newThread);

            // Save to storage to persist the "restored" state for this session
            await saveThreadsToStorage();
            return newThread;
        } catch (e) {
            console.error('[SidePanel] Hydration error:', e);
            return null;
        }
    }

    async function handleCompareWithRelated(currentPage, match) {
        // Validate inputs
        if (!currentPage?.title || !match?.title) {
            showToast(getMessage('sp_comparison_failed', 'Missing topic information'), 'error');
            return;
        }

        // Create comparison prompt
        const comparisonPrompt = `🔗 **So sánh Khái niệm**

So sánh hai chủ đề đọc này và giải thích cách chúng kết nối:

**Chủ đề hiện tại:** "${currentPage.title}"
**Ghi chú liên quan:** "${match.title}" - ${match.preview || '(Không có preview)'}

Hãy cung cấp so sánh ngắn gọn bao gồm:
1. **Điểm tương đồng** chính
2. **Điểm khác biệt** chính  
3. **Cách chúng bổ sung/xây dựng lẫn nhau**

Trả lời ngắn gọn (2-3 câu mỗi điểm).`;

        // Ensure we have an active thread
        if (!activeThreadId && threads.length > 0) {
            activeThreadId = threads[threads.length - 1].id;
        }

        if (!activeThreadId) {
            // Create a new thread if none exists
            const newThread = {
                id: 'thread_' + Date.now(),
                title: 'Compare Concepts',
                createdAt: Date.now(),
                messages: []
            };
            threads.push(newThread);
            activeThreadId = newThread.id;
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) {
            showToast(getMessage('sp_comparison_failed', 'No active thread'), 'error');
            return;
        }

        // Add user message and send via standard flow
        thread.messages.push({ role: 'user', content: comparisonPrompt });
        addMessageToDOM(comparisonPrompt, 'user');

        try {
            await sendToGemini(comparisonPrompt, thread, 'compare');
            await saveThreadsToStorage();
            // Toast is now handled by sendToGemini or only shown on success
        } catch (err) {
            console.error('[SidePanel] Compare failed:', err);
            showToast(getMessage('sp_comparison_failed', 'Failed to generate comparison'), 'error');
        }
    }

    // ===========================
    // Phase 2: Retention Loop
    // ===========================
    function getRetentionStrings() {
        return {
            quizTitle: getMessage('sp_retention_quiz_title', 'Quiz'),
            teachbackTitle: getMessage('sp_retention_teachback_title', 'Teach-back'),
            flashcardTitle: getMessage('sp_retention_flashcard_title', 'Flashcards'),
            closeLabel: getMessage('sp_retention_close', 'Close'),
            noHighlight: getMessage('sp_retention_no_highlight', 'Please select a section you care about.')
        };
    }

    function getQuizStrings() {
        return {
            skip: getMessage('sp_quiz_skip', 'Skip'),
            submit: getMessage('sp_quiz_submit', 'Submit Answer'),
            evaluating: getMessage('sp_quiz_evaluating', 'Evaluating...'),
            continue: getMessage('sp_quiz_continue', 'Continue'),
            placeholder: getMessage('sp_quiz_placeholder', 'Type your answer here...'),
            questionLabel: getMessage('sp_quiz_question', 'Question'),
            ofLabel: getMessage('sp_quiz_of', 'of'),
            summaryTitle: getMessage('sp_quiz_summary_title', 'Quiz complete'),
            addToReview: getMessage('sp_quiz_add_review', 'Add to Review Deck'),
            done: getMessage('sp_quiz_done', 'Done'),
            correctLabel: getMessage('sp_quiz_correct_label', 'What you got right'),
            missingLabel: getMessage('sp_quiz_missing_label', 'What you missed'),
            evidenceLabel: getMessage('sp_quiz_evidence_label', 'From the text')
        };
    }

    function getTeachBackStrings() {
        return {
            title: getMessage('sp_teachback_title', 'Teach-back'),
            promptLabel: getMessage('sp_teachback_prompt_label', 'Explain it in your own words'),
            hintLabel: getMessage('sp_teachback_hint', 'Hint'),
            submit: getMessage('sp_teachback_submit', 'Evaluate'),
            retry: getMessage('sp_teachback_retry', 'Try again'),
            addToReview: getMessage('sp_teachback_add_review', 'Add to Review Deck'),
            placeholder: getMessage('sp_teachback_placeholder', 'Type your explanation...'),
            feedbackTitle: getMessage('sp_teachback_feedback_title', 'Feedback'),
            suggestionsTitle: getMessage('sp_teachback_suggestions_title', 'Suggestions'),
            misconceptionsTitle: getMessage('sp_teachback_misconceptions_title', 'Misconceptions')
        };
    }

    function getFlashcardStrings() {
        return {
            showAnswer: getMessage('sp_flashcard_show_answer', 'Show Answer'),
            rateAgain: getMessage('sp_flashcard_rate_again', 'Again'),
            rateHard: getMessage('sp_flashcard_rate_hard', 'Hard'),
            rateGood: getMessage('sp_flashcard_rate_good', 'Good'),
            rateEasy: getMessage('sp_flashcard_rate_easy', 'Easy'),
            reviewTitle: getMessage('sp_flashcard_review_title', 'Review session'),
            done: getMessage('sp_flashcard_review_done', 'Done'),
            empty: getMessage('sp_flashcard_review_empty', 'No cards ready for review.')
        };
    }

    function closeRetentionOverlay() {
        if (!retentionOverlay) return;
        retentionOverlay.classList.add('hiding');
        setTimeout(() => retentionOverlay?.remove(), 150);
        retentionOverlay = null;
    }

    function createRetentionOverlay(title) {
        closeRetentionOverlay();
        const overlay = document.createElement('div');
        overlay.className = 'sp-retention-overlay';

        const card = document.createElement('div');
        card.className = 'sp-retention-card';

        const header = document.createElement('div');
        header.className = 'sp-retention-header';
        const closeLabel = getMessage('sp_retention_close', 'Close');
        header.innerHTML = `
            <span>${title}</span>
            <button class="sp-retention-close" type="button" aria-label="${closeLabel}" title="${closeLabel}">×</button>
        `;

        const body = document.createElement('div');
        body.className = 'sp-retention-body';

        card.appendChild(header);
        card.appendChild(body);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        header.querySelector('.sp-retention-close')?.addEventListener('click', closeRetentionOverlay);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeRetentionOverlay();
        });

        retentionOverlay = overlay;
        return { overlay, body };
    }

    function renderRetentionLoading(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div class="sp-retention-loading">${message || getMessage('sp_loading', 'Loading...')}</div>
        `;
    }

    async function appendHistory(storageKey, entry) {
        try {
            const data = await chrome.storage.local.get([storageKey]);
            const list = Array.isArray(data[storageKey]) ? data[storageKey] : [];
            list.push(entry);
            const trimmed = list.slice(-200);
            await chrome.storage.local.set({ [storageKey]: trimmed });
        } catch (e) {
            console.warn('[Retention] Failed to append history:', e);
        }
    }

    async function updateComprehensionScore(sessionId) {
        if (!sessionId || !window.ComprehensionScoringService || !window.ReadingSessionService) return null;
        try {
            const session = await ReadingSessionService.getSession(sessionId);
            if (!session?.metrics) return null;
            const result = window.ComprehensionScoringService.calculateComprehensionScore(session.metrics);
            await appendHistory('atom_comprehension_scores', {
                sessionId,
                score: result?.overall,
                breakdown: result?.breakdown,
                level: result?.level,
                createdAt: Date.now()
            });
            return result;
        } catch (e) {
            console.warn('[Retention] Comprehension score failed:', e);
            return null;
        }
    }

    async function openRetentionFlow(action, highlight) {
        const strings = getRetentionStrings();
        const safeHighlight = highlight && typeof highlight === 'object' ? highlight : {};
        const highlightText = String(safeHighlight.text || '').trim();
        if (!highlightText) {
            showToast(strings.noHighlight, 'warning');
            return;
        }

        const titleMap = {
            quiz: strings.quizTitle,
            teachback: strings.teachbackTitle,
            flashcard: strings.flashcardTitle
        };
        const { body } = createRetentionOverlay(titleMap[action] || strings.quizTitle);
        renderRetentionLoading(body, getMessage('sp_retention_loading', 'Preparing...'));

        if (action === 'quiz') {
            await startQuizFlow(body, safeHighlight);
        } else if (action === 'teachback') {
            await startTeachBackFlow(body, safeHighlight);
        } else if (action === 'flashcard') {
            await startFlashcardFlow(body);
        }
    }

    async function startQuizFlow(container, highlight) {
        if (!window.QuizGeneratorService || !window.QuizUI) {
            renderRetentionLoading(container, getMessage('sp_retention_unavailable', 'Retention tools unavailable.'));
            return;
        }

        const apiKey = await getApiKey();
        if (!apiKey) {
            renderRetentionLoading(container, getMessage('sp_retention_missing_key', 'Missing API key.'));
            return;
        }

        const context = {
            title: highlight.title || pageContext?.title || '',
            section: highlight.sectionHeading || ''
        };

        const questions = await window.QuizGeneratorService.generateQuizSet(
            highlight.text,
            context,
            apiKey,
            callGeminiAPI
        );

        if (!questions || questions.length === 0) {
            renderRetentionLoading(container, getMessage('sp_retention_empty_quiz', 'Could not generate quiz.'));
            return;
        }

        container.innerHTML = '';
        const quizStrings = getQuizStrings();
        const quizUI = window.QuizUI.createQuizSessionUI(
            questions,
            quizStrings,
            async (question, answer) => window.QuizGeneratorService.evaluateAnswer(
                question,
                answer,
                apiKey,
                callGeminiAPI
            ),
            async (sessionResult) => {
                const results = sessionResult?.results || [];
                const avg = results.length
                    ? Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length)
                    : 0;

                if (activeSessionId && window.ReadingSessionService) {
                    await ReadingSessionService.updateMetrics(activeSessionId, {
                        assessmentMetrics: { quizScore: avg }
                    });
                    await appendHistory('atom_quiz_history', {
                        sessionId: activeSessionId,
                        highlightText: highlight.text.slice(0, 200),
                        avgScore: avg,
                        results,
                        createdAt: Date.now()
                    });
                    await updateComprehensionScore(activeSessionId);
                }

                if (sessionResult?.addToReview && window.FlashcardDeck) {
                    const sessionData = activeSessionId
                        ? await ReadingSessionService.getSession(activeSessionId)
                        : null;

                    for (const question of questions) {
                        const card = window.FlashcardDeck.createFromQuiz(question, sessionData || {});
                        await window.FlashcardDeck.saveCard(card);
                    }
                    showToast(getMessage('sp_quiz_added_review', 'Added to review deck.'), 'success');
                }

                closeRetentionOverlay();
            }
        );

        container.appendChild(quizUI);
    }

    async function startTeachBackFlow(container, highlight) {
        if (!window.TeachBackService || !window.TeachBackUI) {
            renderRetentionLoading(container, getMessage('sp_retention_unavailable', 'Retention tools unavailable.'));
            return;
        }

        const apiKey = await getApiKey();
        if (!apiKey) {
            renderRetentionLoading(container, getMessage('sp_retention_missing_key', 'Missing API key.'));
            return;
        }

        const concept = highlight.sectionHeading || highlight.title || '';
        const promptData = await window.TeachBackService.generateTeachBackPrompt(
            concept,
            highlight.text,
            apiKey,
            callGeminiAPI
        );

        container.innerHTML = '';
        const teachbackUI = window.TeachBackUI.createTeachBackUI(promptData, getTeachBackStrings(), {
            onHint: () => window.TeachBackService.getHint(promptData, Math.floor(Math.random() * 3)),
            onSubmit: async (explanation) => {
                const result = await window.TeachBackService.evaluateExplanation(
                    promptData,
                    explanation,
                    apiKey,
                    callGeminiAPI
                );

                if (activeSessionId && window.ReadingSessionService) {
                    await ReadingSessionService.updateMetrics(activeSessionId, {
                        assessmentMetrics: { teachBackScore: Number.isFinite(result?.score) ? result.score : null }
                    });
                    await appendHistory('atom_teachback_history', {
                        sessionId: activeSessionId,
                        highlightText: highlight.text.slice(0, 200),
                        score: result?.score ?? null,
                        result,
                        createdAt: Date.now()
                    });
                    await updateComprehensionScore(activeSessionId);
                }

                return result;
            },
            onAddToReview: async (explanation, result) => {
                if (!window.FlashcardDeck) return;
                const sessionData = activeSessionId
                    ? await ReadingSessionService.getSession(activeSessionId)
                    : {};
                const keyPoints = Array.isArray(promptData.keyPointsToMention)
                    ? promptData.keyPointsToMention.filter(Boolean)
                    : [];
                const backText = keyPoints.length ? keyPoints.join('\n') : (result?.feedback || highlight.text.slice(0, 200));

                const card = window.FlashcardDeck.createFlashcard({
                    type: window.FlashcardDeck.CARD_TYPES.TEACHBACK,
                    front: promptData.prompt || `Explain ${promptData.concept || 'this concept'}`,
                    back: backText,
                    sourceSessionId: sessionData?.id,
                    sourceUrl: sessionData?.url || highlight.url,
                    sourceTitle: sessionData?.title || highlight.title
                });
                await window.FlashcardDeck.saveCard(card);
                showToast(getMessage('sp_teachback_added_review', 'Added to review deck.'), 'success');
            }
        });

        container.appendChild(teachbackUI);
    }

    async function startFlashcardFlow(container) {
        if (!window.FlashcardUI || !window.FlashcardDeck || !window.SpacedRepetitionService) {
            renderRetentionLoading(container, getMessage('sp_retention_unavailable', 'Retention tools unavailable.'));
            return;
        }

        const queue = await window.FlashcardDeck.getReviewQueue();
        const cards = [];
        const seen = new Set();

        const pushCard = (card) => {
            if (!card || !card.id || seen.has(card.id)) return;
            seen.add(card.id);
            cards.push(card);
        };

        (queue.overdue || []).forEach(pushCard);
        (queue.dueToday || []).forEach(pushCard);
        if (queue.stats?.new) {
            (await window.FlashcardDeck.getAllCards())
                .filter(c => c.reviewCount === 0)
                .forEach(pushCard);
        }

        container.innerHTML = '';
        const flashcardUI = window.FlashcardUI.createReviewSessionUI(
            cards,
            getFlashcardStrings(),
            async (card, quality) => {
                await window.SpacedRepetitionService.processReview(card.id, quality);
            },
            async (results) => {
                await window.SpacedRepetitionService.recordReviewSession(results.length);
                closeRetentionOverlay();
            }
        );

        container.appendChild(flashcardUI);
    }

    // ===========================
    // Multi-Tab Handling
    // ===========================
    function initMultiTabHandling() {
        // Create broadcast channel for tab communication
        try {
            broadcastChannel = new BroadcastChannel('atom_sidepanel_sync');

            broadcastChannel.onmessage = (event) => {
                handleBroadcastMessage(event.data);
            };

            // Announce this session
            broadcastSessionActive();

            // Listen for page unload to cleanup
            window.addEventListener('beforeunload', () => {
                broadcastChannel?.postMessage({
                    type: 'SESSION_CLOSED',
                    sessionId: SESSION_ID,
                    domain: currentDomain
                });
            });

        } catch (e) {
            console.log('[MultiTab] BroadcastChannel not supported');
        }

        // Check for existing sessions on same URL
        checkForExistingSessions();
    }

    function broadcastSessionActive() {
        broadcastChannel?.postMessage({
            type: 'SESSION_ACTIVE',
            sessionId: SESSION_ID,
            domain: currentDomain,
            url: pageContext?.url,
            timestamp: Date.now()
        });
    }

    function handleBroadcastMessage(data) {
        if (data.sessionId === SESSION_ID) return; // Ignore own messages

        switch (data.type) {
            case 'SESSION_ACTIVE':
                // Another session is active on the same domain
                if (data.domain === currentDomain && data.url === pageContext?.url) {
                    showMultiTabWarning(data);
                }
                break;

            case 'SESSION_CLOSED':
                // Another session closed - hide warning if shown
                hideMultiTabWarning();
                break;

            case 'DATA_UPDATED':
                // Another session updated data - offer to refresh
                if (data.domain === currentDomain) {
                    showDataSyncNotification(data);
                }
                break;

            case 'REQUEST_ACTIVE_SESSIONS':
                // Respond with our session info
                if (data.domain === currentDomain) {
                    broadcastSessionActive();
                }
                break;
        }
    }

    async function checkForExistingSessions() {
        // Request active sessions for this domain
        broadcastChannel?.postMessage({
            type: 'REQUEST_ACTIVE_SESSIONS',
            sessionId: SESSION_ID,
            domain: currentDomain
        });
    }

    function showMultiTabWarning(otherSession) {
        // Remove existing warning
        document.getElementById('multitab-warning')?.remove();

        const warning = document.createElement('div');
        warning.id = 'multitab-warning';
        warning.className = 'sp-multitab-warning';

        const warningMsg = getMessage('sp_multitab_warning', 'This article is open in another tab');
        const btnContinue = getMessage('sp_multitab_continue', 'Continue here');
        const btnSwitch = getMessage('sp_multitab_switch', 'Switch to other tab');

        warning.innerHTML = `
            <div class="sp-multitab-content">
                <span class="sp-multitab-icon">${getIcon('info')}</span>
                <span class="sp-multitab-text">${warningMsg}</span>
            </div>
            <div class="sp-multitab-actions">
                <button class="sp-multitab-btn" id="btn-multitab-continue">${btnContinue}</button>
            </div>
        `;

        // Insert after offline banner
        const offlineBanner = document.getElementById('offline-banner');
        offlineBanner?.insertAdjacentElement('afterend', warning);

        // Event handlers
        document.getElementById('btn-multitab-continue')?.addEventListener('click', () => {
            hideMultiTabWarning();
        });
    }

    function hideMultiTabWarning() {
        const warning = document.getElementById('multitab-warning');
        if (warning) {
            warning.classList.add('hiding');
            setTimeout(() => warning.remove(), 200);
        }
    }

    function showDataSyncNotification(data) {
        // Only show if we have local changes that might conflict
        if (threads.length === 0) {
            // No local data, just reload
            loadThreadsFromStorage();
            return;
        }

        const syncMsg = getMessage('sp_data_sync', 'Data updated in another tab');
        showToast(syncMsg, 'info');
    }

    // Broadcast when data changes
    function broadcastDataUpdate() {
        broadcastChannel?.postMessage({
            type: 'DATA_UPDATED',
            sessionId: SESSION_ID,
            domain: currentDomain,
            timestamp: Date.now()
        });
    }

    // ===========================
    // Search & Filter System
    // ===========================
    function toggleQuickSearch() {
        if (isSearchOpen) {
            closeQuickSearch();
        } else {
            openQuickSearch();
        }
    }

    function openQuickSearch() {
        // Remove existing search modal
        document.getElementById('quick-search-modal')?.remove();

        isSearchOpen = true;

        const modal = document.createElement('div');
        modal.id = 'quick-search-modal';
        modal.className = 'sp-search-modal';

        const searchPlaceholder = getMessage('sp_search_placeholder', 'Search in insights and notes...');
        const filterAll = getMessage('sp_filter_all', 'All');
        const filterToday = getMessage('sp_filter_today', 'Today');
        const filterWeek = getMessage('sp_filter_week', 'This Week');
        const filterInsights = getMessage('sp_filter_insights', 'Insights');
        const filterNotes = getMessage('sp_filter_notes', 'Notes');

        modal.innerHTML = `
            <div class="sp-search-container">
                <div class="sp-search-header">
                    <span class="sp-search-icon">${getIcon('search')}</span>
                    <input type="text" class="sp-search-input" id="search-input" placeholder="${searchPlaceholder}" autofocus>
                    <kbd class="sp-search-esc">Esc</kbd>
                </div>

                <div class="sp-search-filters">
                    <button class="sp-filter-btn active" data-filter="all">${filterAll}</button>
                    <button class="sp-filter-btn" data-filter="today">${filterToday}</button>
                    <button class="sp-filter-btn" data-filter="week">${filterWeek}</button>
                    <button class="sp-filter-btn" data-filter="insights">${filterInsights}</button>
                    <button class="sp-filter-btn" data-filter="notes">${filterNotes}</button>
                </div>

                <div class="sp-search-results" id="search-results">
                    <div class="sp-search-empty">${getMessage('sp_search_hint', 'Type to search...')}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus input
        const searchInput = document.getElementById('search-input');
        searchInput?.focus();

        // Search input handler
        searchInput?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            performSearch();
        });

        // Filter buttons
        modal.querySelectorAll('.sp-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.sp-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                performSearch();
            });
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeQuickSearch();
            }
        });

        // Keyboard navigation
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeQuickSearch();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectSearchResult();
            }
        });
    }

    function closeQuickSearch() {
        const modal = document.getElementById('quick-search-modal');
        if (modal) {
            modal.classList.add('hiding');
            setTimeout(() => modal.remove(), 200);
        }
        isSearchOpen = false;
        searchQuery = '';
    }

    function performSearch() {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        const query = searchQuery.toLowerCase().trim();

        // Get all searchable items
        let items = [];

        // Add threads/discussions
        threads.forEach(thread => {
            items.push({
                type: 'thread',
                id: thread.id,
                title: thread.highlight?.text?.slice(0, 100) || 'Discussion',
                content: thread.refinedInsight || thread.highlight?.text || '',
                hasInsight: !!thread.refinedInsight,
                timestamp: thread.createdAt,
                status: thread.status
            });
        });

        // Add parking lot notes
        parkingLot.forEach(note => {
            items.push({
                type: 'note',
                id: note.id,
                title: 'Quick Note',
                content: note.text,
                hasInsight: false,
                timestamp: note.createdAt
            });
        });

        // Apply filters
        items = applyFilters(items);

        // Apply search query
        if (query) {
            items = items.filter(item =>
                item.content.toLowerCase().includes(query) ||
                item.title.toLowerCase().includes(query)
            );
        }

        // Render results
        if (items.length === 0) {
            const noResults = getMessage('sp_search_no_results', 'No results found');
            resultsContainer.innerHTML = `<div class="sp-search-empty">${noResults}</div>`;
            return;
        }

        resultsContainer.innerHTML = items.map((item, index) => {
            const icon = item.type === 'note' ? getIcon('note') :
                item.hasInsight ? getIcon('insight') :
                    item.status === 'parked' ? getIcon('check') : getIcon('thread');

            const preview = highlightMatch(item.content.slice(0, 120), query);
            const time = formatRelativeTime(item.timestamp);

            return `
                <div class="sp-search-result ${index === 0 ? 'selected' : ''}"
                     data-type="${item.type}" data-id="${item.id}">
                    <span class="sp-result-icon">${icon}</span>
                    <div class="sp-result-content">
                        <div class="sp-result-preview">${preview}...</div>
                        <div class="sp-result-meta">${time}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        resultsContainer.querySelectorAll('.sp-search-result').forEach(result => {
            result.addEventListener('click', () => {
                const type = result.dataset.type;
                const id = result.dataset.id;
                handleSearchResultClick(type, id);
            });
        });
    }

    function applyFilters(items) {
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const oneWeekMs = 7 * oneDayMs;

        switch (activeFilter) {
            case 'today':
                return items.filter(item => now - item.timestamp < oneDayMs);
            case 'week':
                return items.filter(item => now - item.timestamp < oneWeekMs);
            case 'insights':
                return items.filter(item => item.hasInsight);
            case 'notes':
                return items.filter(item => item.type === 'note');
            default:
                return items;
        }
    }

    function highlightMatch(text, query) {
        if (!query) return escapeHtml(text);

        const escaped = escapeHtml(text);
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return getMessage('sp_time_just_now', 'Just now');
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;

        return new Date(timestamp).toLocaleDateString();
    }

    function navigateSearchResults(direction) {
        const results = document.querySelectorAll('.sp-search-result');
        if (results.length === 0) return;

        const currentIndex = Array.from(results).findIndex(r => r.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = results.length - 1;
        if (newIndex >= results.length) newIndex = 0;

        results.forEach((r, i) => {
            r.classList.toggle('selected', i === newIndex);
        });

        // Scroll into view
        results[newIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function selectSearchResult() {
        const selected = document.querySelector('.sp-search-result.selected');
        if (selected) {
            const type = selected.dataset.type;
            const id = selected.dataset.id;
            handleSearchResultClick(type, id);
        }
    }

    function handleSearchResultClick(type, id) {
        closeQuickSearch();

        if (type === 'thread') {
            activeThreadId = id;
            switchToTab('discussions');
            renderThreadList();
            renderActiveThread();
        } else if (type === 'note') {
            switchToTab('notes');
            // Highlight the note
            setTimeout(() => {
                const noteEl = document.querySelector(`.sp-note-item[data-id="${id}"]`);
                if (noteEl) {
                    noteEl.classList.add('highlighted');
                    noteEl.scrollIntoView({ block: 'center' });
                    setTimeout(() => noteEl.classList.remove('highlighted'), 2000);
                }
            }, 100);
        }
    }

    function setupMenuDropdown() {
        // Toggle menu
        elements.menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = elements.menuDropdown?.classList.toggle('show');
            elements.menuBtn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

            // Focus first menu item when opening
            if (isOpen) {
                setTimeout(() => {
                    elements.menuDropdown?.querySelector('.sp-menu-item')?.focus();
                }, 50);
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', () => {
            elements.menuDropdown?.classList.remove('show');
            elements.menuBtn?.setAttribute('aria-expanded', 'false');
        });

        // Keyboard navigation in menu
        elements.menuDropdown?.addEventListener('keydown', (e) => {
            const items = elements.menuDropdown.querySelectorAll('.sp-menu-item');
            const currentIndex = Array.from(items).indexOf(document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % items.length;
                items[nextIndex]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
                items[prevIndex]?.focus();
            } else if (e.key === 'Escape') {
                elements.menuDropdown?.classList.remove('show');
                elements.menuBtn?.setAttribute('aria-expanded', 'false');
                elements.menuBtn?.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.activeElement?.click();
            }
        });

        // Menu items
        document.getElementById('menu-download')?.addEventListener('click', showExportDialog);
        document.getElementById('menu-save-all')?.addEventListener('click', exportAllToNLM);
        elements.menuSemanticEmbeddings?.addEventListener('click', () => toggleSemanticFlag('EMBEDDINGS_ENABLED'));
        elements.menuSemanticSearch?.addEventListener('click', () => toggleSemanticFlag('SEMANTIC_SEARCH_ENABLED'));
        document.getElementById('menu-clear')?.addEventListener('click', clearCurrentThread);
        document.getElementById('menu-new-chat')?.addEventListener('click', handleNewChat);
        document.getElementById('menu-finish')?.addEventListener('click', endSession);
    }

    async function handleNewChat() {
        if (!confirm(getMessage('sp_confirm_new_chat', 'Start a new chat? This will keep your history and open a fresh thread.'))) {
            return;
        }

        // Create a fresh thread while keeping domain history
        const base = threads.find(t => t.id === activeThreadId);
        const now = Date.now();
        const newThread = {
            id: `thread_${now}_${Math.random().toString(16).slice(2, 6)}`,
            highlight: {
                text: base?.highlight?.text || getMessage('sp_page_discussion', 'Page Discussion'),
                url: base?.highlight?.url || pageContext?.url || '',
                title: base?.highlight?.title || pageContext?.title || ''
            },
            messages: [],
            status: 'active',
            isPageDiscussion: !!base?.isPageDiscussion || !base,
            createdAt: now,
            connections: [],
            deepAngle: null
        };

        threads.push(newThread);
        activeThreadId = newThread.id;
        await saveThreadsToStorage();

        renderThreadList();
        renderActiveThread();
        updateAllCounts();

        showToast(getMessage('sp_new_chat_started', 'New chat started'), 'success');

        // Close menu
        elements.menuDropdown?.classList.remove('show');
    }

    function setupTabs() {
        document.querySelectorAll('.sp-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                // Update active tab button with ARIA
                document.querySelectorAll('.sp-tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');

                // Update active tab panel with ARIA
                document.querySelectorAll('.sp-tab-panel').forEach(p => {
                    p.classList.remove('active');
                    p.setAttribute('hidden', '');
                });
                const panel = document.getElementById(`tab-${tabId}`);
                if (panel) {
                    panel.classList.add('active');
                    panel.removeAttribute('hidden');
                }

                // If collapsed, expand when clicking a tab
                if (elements.bottomTabsContainer?.classList.contains('collapsed')) {
                    toggleBottomTabs();
                }
            });
        });

        // Setup toggle button
        elements.toggleTabsBtn?.addEventListener('click', toggleBottomTabs);
    }

    function toggleBottomTabs() {
        if (!elements.bottomTabsContainer) return;

        const isCollapsed = elements.bottomTabsContainer.classList.toggle('collapsed');

        // Save state
        try {
            chrome.storage.local.set({ 'sp_tabs_collapsed': isCollapsed });
        } catch (e) {
            console.warn('Failed to save tabs state', e);
        }
    }

    function setupNotes() {
        // Add note button
        document.getElementById('btn-add-note')?.addEventListener('click', () => {
            const input = elements.noteInput;
            const idea = input?.value?.trim();
            if (idea) {
                addToParkingLot(idea);
                input.value = '';
            }
        });

        // Note input enter key
        elements.noteInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('btn-add-note')?.click();
            }
        });
    }

    function setupActionBar() {
        // Quick Save button (NEW - saves without requiring insight)
        document.getElementById('btn-quick-save')?.addEventListener('click', () => {
            quickSaveHighlight();
        });

        // Insight Hide Button
        if (elements.insightHideBtn) {
            elements.insightHideBtn.addEventListener('click', () => {
                setInsightDisplayHidden(true);
            });
        }

        // Insight Toggle Button (show/hide)
        if (elements.insightToggleBtn) {
            elements.insightToggleBtn.addEventListener('click', () => {
                const thread = threads.find(t => t.id === activeThreadId);
                const hasInsight = !!getThreadInsightText(thread);
                if (!hasInsight) {
                    showToast(getMessage('sp_key_insight_empty', 'No Key Insight yet'), 'info');
                    return;
                }
                setInsightDisplayHidden(!isInsightDisplayHidden);
            });
        }

        // Key Insight button
        document.getElementById('btn-key-insight')?.addEventListener('click', makeAtomicThought);

        // Mark as Done button
        document.getElementById('btn-mark-done')?.addEventListener('click', parkCurrentThread);

        // Copy insight
        document.getElementById('btn-copy-insight')?.addEventListener('click', () => {
            const text = elements.insightText?.textContent;
            if (text) {
                navigator.clipboard.writeText(text);
                showToast(getMessage('sp_toast_copied', 'Copied'), 'success');
            }
        });

        // Save insight
        document.getElementById('btn-save-insight')?.addEventListener('click', saveThreadToNLM);
    }

    function getNlmExportFailureToast(reason) {
        const code = String(reason || '').toLowerCase();
        if (code === 'dedupe') {
            return {
                message: getMessage('sp_toast_already_saved', 'Already saved today'),
                type: 'info'
            };
        }
        if (code === 'disabled') {
            return {
                message: getMessage('sp_nlm_disabled', 'NotebookLM export is disabled'),
                type: 'error'
            };
        }
        if (code === 'pii_warning') {
            return {
                message: getMessage('sp_nlm_pii_blocked', 'Sensitive data detected. Export blocked.'),
                type: 'error'
            };
        }
        if (code === 'cloud_export_disabled') {
            return {
                message: getMessage('sp_nlm_cloud_disabled', 'Cloud Export disabled in Settings.'),
                type: 'warning'
            };
        }
        return {
            message: getMessage('sp_error_save', 'Error saving'),
            type: 'error'
        };
    }

    /**
     * Quick Save - Save highlight to NotebookLM without requiring insight
     * This allows users to save immediately after highlighting
     */
    async function quickSaveHighlight() {
        if (!activeThreadId) {
            showToast(getMessage('sp_no_highlight', 'No highlight selected'), 'warning');
            return;
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        try {
            // Build note object for NLM (without requiring insight)
            const note = {
                id: thread.id,
                url: thread.highlight?.url || pageContext?.url || '',
                title: thread.highlight?.title || pageContext?.title || '',
                selection: thread.highlight?.text || '',
                atomicThought: thread.refinedInsight || '', // May be empty
                aiDiscussionSummary: thread.messages.length > 0
                    ? thread.messages.map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n')
                    : '',
                quickSave: true, // Flag indicating quick save without insight
                created_at: thread.createdAt,
                command: 'sidepanel_quick_save'
            };

            // Send to background for NLM processing
            const response = await chrome.runtime.sendMessage({
                type: 'ATOM_SAVE_THREAD_TO_NLM',
                payload: note
            });

            if (response?.ok) {
                // Mark as exported
                thread.nlmExported = true;
                thread.nlmExportedAt = Date.now();
                await saveThreadsToStorage();
                renderThreadList();
                checkAndShowContextualTooltip('first_save');

                // Show appropriate toast message
                const msg = thread.refinedInsight
                    ? getMessage('sp_toast_saved', 'Saved to Knowledge!')
                    : getMessage('sp_toast_quick_saved', 'Highlight saved!');
                showToast(msg, 'success');
            } else {
                const failure = getNlmExportFailureToast(response?.reason || response?.error);
                showToast(failure.message, failure.type);
            }

        } catch (e) {
            console.error('[QuickSave] Error:', e);
            showToast(getMessage('sp_error_save', 'Error saving'), 'error');
        }
    }

    function setupEventListeners() {
        // Send button
        elements.sendBtn?.addEventListener('click', handleSend);

        // Enter to send (Shift+Enter for new line)
        elements.userInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea & char count
        elements.userInput?.addEventListener('input', () => {
            elements.userInput.style.height = 'auto';
            elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 120) + 'px';
            updateSendButton();
            updateCharCount();
        });

        // New Chat (Top Bar)
        elements.refreshBtn?.addEventListener('click', handleNewChat);

        // Quick Action Chips
        setupQuickActionChips();

        // Deep Angle (2-step retrieval + deep analysis)
        elements.deepAngleBtn?.addEventListener('click', generateDeepAngle);

        // Listen for tab changes
        chrome.tabs.onActivated.addListener(handleTabChange);
        chrome.tabs.onUpdated.addListener(handleTabUpdate);

        // Setup keyboard shortcuts
        setupKeyboardShortcuts();

        // Setup network status listeners
        setupNetworkListeners();
    }

    // ===========================
    // Network Status Management
    // ===========================
    function setupNetworkListeners() {
        // Listen for online/offline events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Retry connection button
        elements.retryConnectionBtn?.addEventListener('click', handleRetryConnection);

        // Initial status check
        updateNetworkStatus();
    }

    function handleOnline() {
        isOnline = true;
        updateNetworkStatus();
        showToast(getMessage('sp_network_restored', 'Connection restored'), 'success');

        // Remove pending indicators from messages
        document.querySelectorAll('.sp-message.pending').forEach(msg => {
            msg.classList.remove('pending');
            msg.querySelector('.sp-message-pending-indicator')?.remove();
        });

        // Process pending messages
        processPendingMessages();
    }

    function handleOffline() {
        isOnline = false;
        updateNetworkStatus();
        showToast(getMessage('sp_network_lost', 'No internet connection'), 'warning');
    }

    function handleRetryConnection() {
        // Force a network check
        if (navigator.onLine) {
            handleOnline();
        } else {
            showToast(getMessage('sp_still_offline', 'Still offline. Check your connection.'), 'warning');
        }
    }

    function updateNetworkStatus() {
        const statusDot = elements.contextStatus;
        const statusText = elements.contextText;
        const offlineBanner = elements.offlineBanner;

        if (!isOnline) {
            // Show offline banner
            if (offlineBanner) {
                offlineBanner.classList.add('show');
            }

            // Update status indicator
            if (statusDot) {
                statusDot.className = 'status-dot';
                statusDot.style.background = '#F59E0B'; // Warning yellow
            }
            if (statusText) {
                statusText.textContent = getMessage('sp_offline_mode', 'Offline mode');
            }
        } else {
            // Hide offline banner
            if (offlineBanner) {
                offlineBanner.classList.remove('show');
            }

            // Reset status indicator (will be updated by loadPageContext if needed)
            if (statusDot) {
                statusDot.style.background = '';
            }
        }
    }

    async function processPendingMessages() {
        if (pendingMessages.length === 0) return;

        const pendingCount = pendingMessages.length;
        showToast(getMessage('sp_sending_pending', `Sending ${pendingCount} pending message(s)...`), 'info');

        let successCount = 0;
        let failCount = 0;

        for (const pending of [...pendingMessages]) {
            try {
                // Remove from queue before sending
                pendingMessages = pendingMessages.filter(p => p !== pending);
                await sendToGemini(pending.message, pending.thread);
                successCount++;
            } catch (e) {
                console.error('[Pending] Failed to send:', e);
                failCount++;
            }
        }

        if (successCount > 0) {
            await saveThreadsToStorage();
        }

        if (failCount > 0) {
            showToast(getMessage('sp_pending_partial', `Sent ${successCount}, failed ${failCount}`), 'warning');
        }
    }

    // ===========================
    // Keyboard Shortcuts
    // ===========================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'INPUT';

            // Ctrl/Cmd + Enter: Send message (works even in input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSend();
                return;
            }

            // Ctrl/Cmd + D: Key Insight (Đúc kết ngay)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
                e.preventDefault();
                if (activeThreadId) {
                    makeAtomicThought();
                }
                return;
            }

            // Ctrl/Cmd + Shift + D: Mark as Done (Xong phần này)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                if (activeThreadId) {
                    parkCurrentThread();
                }
                return;
            }

            // Ctrl/Cmd + N: New quick note (focus note input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                // Switch to notes tab
                switchToTab('notes');
                // Focus the note input
                setTimeout(() => elements.noteInput?.focus(), 100);
                return;
            }

            // Ctrl/Cmd + K: Quick search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggleQuickSearch();
                return;
            }

            // Ctrl/Cmd + Z: Undo last action
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undoLastAction();
                return;
            }

            // Escape: Close menu / Deselect thread / Blur input
            if (e.key === 'Escape') {
                e.preventDefault();
                // Close menu if open
                elements.menuDropdown?.classList.remove('show');
                // Blur any focused input
                if (isInputFocused) {
                    document.activeElement.blur();
                }
                return;
            }

            // Don't process navigation shortcuts if input is focused
            if (isInputFocused) return;

            // Tab: Cycle through bottom tabs
            if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                cycleBottomTabs(e.shiftKey ? -1 : 1);
                return;
            }

            // Arrow Up/Down: Navigate threads
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                navigateThreads(e.key === 'ArrowUp' ? -1 : 1);
                return;
            }

            // Enter: Select thread (if in thread list)
            if (e.key === 'Enter') {
                // Already handled by thread click
                return;
            }

            // Number keys 1-3: Quick tab switch
            if (e.key >= '1' && e.key <= '3' && (e.altKey)) {
                e.preventDefault();
                const tabs = ['discussions', 'notes', 'connections'];
                const tabIndex = parseInt(e.key) - 1;
                if (tabs[tabIndex]) {
                    switchToTab(tabs[tabIndex]);
                }
                return;
            }
        });
    }

    function switchToTab(tabName) {
        const tabBtn = document.querySelector(`.sp-tab-btn[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.click();
        }
    }

    function cycleBottomTabs(direction) {
        const tabs = ['discussions', 'notes', 'connections'];
        const activeTab = document.querySelector('.sp-tab-btn.active');
        const currentIndex = tabs.indexOf(activeTab?.dataset.tab);
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = tabs.length - 1;
        if (newIndex >= tabs.length) newIndex = 0;

        switchToTab(tabs[newIndex]);
    }

    const DOMAIN_DISCUSSIONS_MAX = 30;

    function normalizeUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const u = new URL(raw);
            // Hash/search never change content identity for our use-case (utm, anchors, etc.).
            u.hash = '';
            u.search = '';

            const path = (u.pathname || '').replace(/\/$/, '');
            return `${u.origin}${path}`;
        } catch {
            return raw.replace(/\/$/, '');
        }
    }

    function normalizeDomain(domain) {
        return String(domain || '').trim().toLowerCase().replace(/^www\./, '');
    }

    function getThreadsForCurrentUrl() {
        const currentUrl = normalizeUrl(pageContext?.url);
        if (!currentUrl) return [];
        return threads.filter(t => normalizeUrl(t?.highlight?.url) === currentUrl);
    }

    function getRecentDomainThreads(limit = DOMAIN_DISCUSSIONS_MAX) {
        const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(limit, 200)) : DOMAIN_DISCUSSIONS_MAX;
        return [...threads]
            .sort((a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0))
            .slice(0, safeLimit);
    }

    function getVisibleThreads() {
        if (!pageContext?.url) return [];
        // Show all threads for this domain to ensure user can access full history
        return threads;
    }

    function navigateThreads(direction) {
        const visibleThreads = getVisibleThreads();
        if (visibleThreads.length === 0) return;

        const currentIndex = visibleThreads.findIndex(t => t.id === activeThreadId);

        let newIndex;
        if (currentIndex === -1) {
            // If active thread not in visible list, start from end or beginning
            newIndex = direction > 0 ? 0 : visibleThreads.length - 1;
        } else {
            newIndex = currentIndex + direction;
            if (newIndex < 0) newIndex = visibleThreads.length - 1;
            if (newIndex >= visibleThreads.length) newIndex = 0;
        }

        activeThreadId = visibleThreads[newIndex].id;
        renderThreadList();
        renderActiveThread();
    }

    function updateCharCount() {
        const count = elements.userInput?.value?.length || 0;
        if (elements.charCount) {
            elements.charCount.textContent = count;
        }
    }

    function updateAllCounts() {
        // Discussions count
        if (elements.discussionsCount) {
            const visibleCount = getVisibleThreads().length;
            const prevCount = parseInt(elements.discussionsCount.textContent) || 0;
            elements.discussionsCount.textContent = visibleCount;
            if (visibleCount > prevCount) {
                pulseBadge(elements.discussionsCount);
            }
        }

        // Notes count
        if (elements.notesCount) {
            const prevCount = parseInt(elements.notesCount.textContent) || 0;
            elements.notesCount.textContent = parkingLot.length;
            if (parkingLot.length > prevCount) {
                pulseBadge(elements.notesCount);
            }
        }

        // Connections count
        const connCount = threads.reduce((sum, t) => sum + (t.connections?.length || 0), 0);
        if (elements.connectionsCount) {
            elements.connectionsCount.textContent = connCount;
        }

        // Insights count
        const insightCount = threads.filter(t => t.refinedInsight).length;
        if (elements.insightsCount) {
            elements.insightsCount.textContent = `(${insightCount})`;
        }

        // Update timer
        updateTimer();

        // Update progress bar
        updateProgressBar();
    }

    function pulseBadge(badge) {
        if (!badge) return;
        badge.classList.add('pulse');
        setTimeout(() => badge.classList.remove('pulse'), 500);
    }

    function updateProgressBar() {
        const progressBar = document.getElementById('progress-bar');
        const progressFill = document.getElementById('progress-fill');
        if (!progressBar || !progressFill) return;

        const insightCount = threads.filter(t => t.refinedInsight).length;
        const targetGoal = 5; // Default goal: 5 insights

        if (threads.length > 0) {
            progressBar.classList.add('active');
            const progress = Math.min((insightCount / targetGoal) * 100, 100);
            progressFill.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', Math.round(progress));
        } else {
            progressBar.classList.remove('active');
        }
    }

    function updateTimer() {
        const minutes = Math.floor((Date.now() - sessionStartTime) / 60000);
        if (elements.sessionTimerEl) {
            elements.sessionTimerEl.textContent = `${minutes}m`;
        }
    }

    // ===========================
    // Storage Listener for Highlights
    // ===========================
    const HIGHLIGHT_DEDUPE_WINDOW_MS = 2000;
    const recentHighlightSignatures = new Map();

    function getHighlightSignature(highlight) {
        if (!highlight || typeof highlight !== 'object') return '';
        const parts = [
            highlight.id || '',
            highlight.highlightId || '',
            highlight.threadId || '',
            highlight.text || '',
            highlight.url || '',
            highlight.title || '',
            highlight.sectionHeading || '',
            highlight.position || ''
        ];
        const raw = parts.join('|').slice(0, 2000);
        if (typeof hashString === 'function') {
            return `hash:${hashString(raw)}`;
        }
        return `raw:${raw}`;
    }

    function isDuplicateHighlight(highlight) {
        const signature = getHighlightSignature(highlight);
        if (!signature) return false;
        const now = Date.now();
        for (const [key, ts] of recentHighlightSignatures.entries()) {
            if (now - ts > HIGHLIGHT_DEDUPE_WINDOW_MS) {
                recentHighlightSignatures.delete(key);
            }
        }
        if (recentHighlightSignatures.has(signature)) {
            return true;
        }
        recentHighlightSignatures.set(signature, now);
        return false;
    }

    function listenForHighlights() {
        // Listen for storage changes (new highlights)
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace !== 'local') return;

            // Check for pending highlight
            if (changes.atom_sidepanel_pending_highlight?.newValue) {
                const highlight = changes.atom_sidepanel_pending_highlight.newValue;
                handleNewHighlight(highlight);

                // Clear the pending highlight
                chrome.storage.local.remove('atom_sidepanel_pending_highlight');
            }

            // Check for thread updates from this domain
            const storageKey = `atom_sidepanel_highlight_${currentDomain}`;
            if (changes[storageKey]?.newValue) {
                loadThreadsFromStorage();
            }
        });

        // Check for any pending highlight on load
        chrome.storage.local.get(['atom_sidepanel_pending_highlight'], (data) => {
            if (data.atom_sidepanel_pending_highlight) {
                handleNewHighlight(data.atom_sidepanel_pending_highlight);
                chrome.storage.local.remove('atom_sidepanel_pending_highlight');
            }
        });
    }

    async function handleNewHighlight(highlight) {
        if (isDuplicateHighlight(highlight)) {
            console.log('[SidePanel] Skipping duplicate highlight');
            return;
        }
        // Find or create thread for this highlight
        let thread = threads.find(t => t.id === highlight.threadId);

        if (!thread) {
            thread = {
                id: highlight.threadId || `thread_${Date.now()}`,
                highlight: highlight,
                messages: [],
                connections: [], // Smart Linking connections
                status: 'active',
                createdAt: Date.now()
            };
            threads.push(thread);
        }

        activeThreadId = thread.id;
        renderThreadList();
        renderActiveThread();

        // Hide empty state
        if (elements.emptyState) {
            elements.emptyState.style.display = 'none';
        }

        // Sync with unified ReadingSession
        try {
            if (typeof ReadingSessionService !== 'undefined') {
                const session = await ReadingSessionService.getOrCreateSession(
                    highlight.url || pageContext?.url || '',
                    highlight.title || pageContext?.title || '',
                    highlight.domain || currentDomain || ''
                );
                activeSessionId = session.id;

                // Add highlight to session
                await ReadingSessionService.addHighlight(session.id, {
                    text: highlight.text,
                    surroundingContext: highlight.surroundingContext,
                    sectionHeading: highlight.sectionHeading,
                    position: highlight.position
                });

                // Update thread data in session
                await ReadingSessionService.updateThread(session.id, {
                    messages: thread.messages,
                    status: thread.status
                });

                console.log('[ReadingSession] Synced highlight to session:', session.id);
            }
        } catch (e) {
            console.error('[ReadingSession] Sync error:', e);
        }

        // Smart Linking: Analyze connections with other threads
        if (threads.length > 1) {
            analyzeConnections(thread);
        }

        // Onboarding: Show tooltip for first highlight
        checkAndShowContextualTooltip('first_highlight');

        if (highlight?.retentionAction) {
            openRetentionFlow(highlight.retentionAction, highlight);
        }
    }

    // ===========================
    // Smart Linking System
    // ===========================
    function getDeepAngleCacheKey(thread) {
        const connectionKey = (thread?.connections || [])
            .map((conn) => `${conn.type || ''}:${conn.targetId || conn.targetIndex || ''}:${Math.round((conn.confidence || 0) * 100)}`)
            .join('|');
        return hashString(`${thread?.id || 'thread'}::${connectionKey}`);
    }

    function getCurrentDeepAngleKey() {
        return normalizeUrl(pageContext?.url || '');
    }

    function updateDeepAngleUI() {
        if (!elements.deepAngleBtn || !elements.deepAngleOutput || !elements.deepAngleText) return;
        const hasPageContext = !!pageContext?.url;
        const cacheKey = getCurrentDeepAngleKey();
        const cached = cacheKey ? deepAngleByUrl.get(cacheKey) : null;

        elements.deepAngleBtn.disabled = !hasPageContext;
        if (elements.deepAngleStatus) {
            elements.deepAngleStatus.textContent = hasPageContext
                ? getMessage('sp_deep_angle_hint', 'Generate a deep angle using your recent reading history.')
                : getMessage('sp_deep_angle_empty', 'No page context available.');
            elements.deepAngleStatus.style.display = 'block';
        }

        if (hasPageContext && cached?.text) {
            elements.deepAngleText.innerHTML = formatMessage(cached.text);
            elements.deepAngleOutput.hidden = false;
        } else {
            elements.deepAngleOutput.hidden = true;
            elements.deepAngleText.textContent = '';
        }
    }

    function setDeepAngleLoading(isLoading) {
        if (!elements.deepAngleBtn) return;
        if (isLoading) {
            const loadingLabel = getMessage('sp_deep_angle_loading', 'Generating...');
            elements.deepAngleBtn.classList.add('sp-action-loading');
            elements.deepAngleBtn.setAttribute('aria-busy', 'true');
            elements.deepAngleBtn.disabled = true;
            elements.deepAngleBtn.innerHTML = `<span class="btn-spinner"></span> ${loadingLabel}`;
        } else {
            const label = getMessage('sp_deep_angle', 'Deep Angle');
            elements.deepAngleBtn.classList.remove('sp-action-loading');
            elements.deepAngleBtn.setAttribute('aria-busy', 'false');
            elements.deepAngleBtn.disabled = !pageContext?.url;
            elements.deepAngleBtn.innerHTML = `🧠 ${label}`;
        }
    }

    async function generateDeepAngleFromConnections(thread) {
        if (!thread?.connections?.length) {
            showToast('No connections available.', 'info');
            updateDeepAngleUI();
            return;
        }

        const ttlMs = API_CONFIG.CACHE.DEEP_ANGLE_TTL_MS || 6 * 60 * 60 * 1000;
        const cacheKey = getDeepAngleCacheKey(thread);
        const now = Date.now();
        if (thread.deepAngle?.cacheKey === cacheKey && (now - (thread.deepAngle.generatedAt || 0)) < ttlMs) {
            updateDeepAngleUI();
            return;
        }

        const apiKey = await getApiKey();
        if (!apiKey) {
            showToast(getMessage('sp_error_no_api_key', 'API key not set'), 'error');
            return;
        }

        const counts = thread.connections.reduce((acc, conn) => {
            const type = String(conn.type || '').toLowerCase();
            if (type === 'supports') acc.supports += 1;
            if (type === 'contradicts') acc.contradicts += 1;
            if (type === 'extends') acc.extends += 1;
            return acc;
        }, { supports: 0, contradicts: 0, extends: 0 });

        const hasTension = thread.connections.some(c => c.type === 'contradicts' && (c.confidence || 0) >= 0.7);
        let angleType = 'Evolution';
        if (hasTension) {
            angleType = 'Tension';
        } else if (counts.supports >= counts.extends && counts.supports >= counts.contradicts) {
            angleType = 'Evidence';
        }

        const lang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const prompt = `You are a critical thinking coach. Create a 1-2 sentence Deep Angle suggestion in ${lang}.

Angle type: ${angleType}

Connections:
${thread.connections.map((conn, idx) => (
            `[${idx + 1}] ${conn.type?.toUpperCase() || 'UNKNOWN'} (${Math.round((conn.confidence || 0) * 100)}%): ${conn.explanation || ''}\nPreview: ${conn.targetPreview || ''}`
        )).join('\n\n')}

Rules:
- 1-2 sentences only
- Focus on the angle type
- Avoid repeating the connection text verbatim`;

        try {
            setDeepAngleLoading(true);
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callLLMAPI('You generate concise deep angles.', conversationHistory, {
                priority: 'background',
                allowFallback: true,
                cacheKey: `deep-angle:${thread.id}:${cacheKey}`,
                cacheTtlMs: ttlMs,
                generationConfig: { temperature: 0.4, maxOutputTokens: 256 }
            });


            const text = (response || '').trim();
            if (!text) {
                showToast(getMessage('sp_error_empty_response', 'No response received'), 'error');
                return;
            }

            thread.deepAngle = {
                text,
                cacheKey,
                angleType,
                generatedAt: Date.now()
            };
            recordSmartLinkMetric('deep_angle_generated_count', 1);
            await saveThreadsToStorage();
            updateDeepAngleUI();
        } catch (err) {
            // Silently ignore PROBATION_ACTIVE errors - expected during rate limit recovery
            if (err?.message?.startsWith('PROBATION_ACTIVE')) {
                console.log('[DeepAngle] Skipped due to probation mode:', err.message);
            } else {
                console.error('[DeepAngle] Error:', err);
                showToast(getMessage('sp_deep_angle_error', 'Failed to generate Deep Angle.'), 'error');
            }
        } finally {
            setDeepAngleLoading(false);
        }
    }

    async function getSemanticCandidateThreads(newThread, otherThreads) {
        if (!semanticFlags.embeddingsEnabled || !semanticFlags.semanticSearchEnabled) {
            return null;
        }
        if (!window.SemanticSearchService || !window.EmbeddingService || !window.VectorStore) {
            return null;
        }

        const queryText = newThread?.highlight?.text || '';
        if (!queryText.trim()) return null;

        const domain = newThread?.highlight?.domain || currentDomain;
        if (!domain) return null;

        const newUrl = normalizeUrl(newThread?.highlight?.url || '');
        const configTtl = window.SemanticSearchService?.SEARCH_CONFIG?.domainTtlMs?.[domain];
        const maxAgeMs = Number.isFinite(configTtl) ? configTtl : 14 * 24 * 60 * 60 * 1000;

        try {
            const related = await window.SemanticSearchService.searchWithinDomain(queryText, domain, 10, {
                maxAgeMs,
                onError: () => recordSmartLinkMetric('embedding_api_errors', 1)
            });

            if (!Array.isArray(related) || related.length === 0) {
                return [];
            }

            const filtered = related.filter(r => {
                const url = normalizeUrl(r.url || '');
                return url && url !== newUrl;
            });

            const threadByUrl = new Map();
            otherThreads.forEach((thread) => {
                const url = normalizeUrl(thread.highlight?.url || '');
                if (!url) return;
                const existing = threadByUrl.get(url);
                if (!existing || (thread.createdAt || 0) > (existing.createdAt || 0)) {
                    threadByUrl.set(url, thread);
                }
            });

            const candidates = filtered.map((result) => {
                const url = normalizeUrl(result.url || '');
                const thread = threadByUrl.get(url);
                if (!thread?.highlight?.text) return null;
                return {
                    thread,
                    similarity: Number.isFinite(result.similarity) ? result.similarity : 0,
                    createdAt: thread.createdAt || 0
                };
            }).filter(Boolean);

            if (candidates.length === 0) {
                return [];
            }

            candidates.sort((a, b) => {
                const diff = b.similarity - a.similarity;
                if (Math.abs(diff) <= 0.01) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }
                return diff;
            });

            recordSmartLinkMetric('semantic_candidates_count', candidates.length);
            const topThreads = candidates.slice(0, 5).map(c => c.thread);
            return topThreads;
        } catch (err) {
            recordSmartLinkMetric('embedding_api_errors', 1);
            console.warn('[SmartLink] Semantic candidate selection failed:', err);
            return [];
        }
    }
    async function analyzeConnections(newThread) {
        const otherThreads = threads.filter(t => t.id !== newThread.id && t.highlight?.text);

        if (otherThreads.length === 0) return;

        // Show loading indicator for connections
        showConnectionsLoading();

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                hideConnectionsLoading();
                return;
            }

            // Prepare highlights for comparison
            const newText = newThread.highlight?.text || '';
            if (!newText.trim()) {
                hideConnectionsLoading();
                return;
            }

            let candidateThreads = await getSemanticCandidateThreads(newThread, otherThreads);
            if (!candidateThreads || candidateThreads.length === 0) {
                recordSmartLinkMetric('fallback_to_recency_count', 1);
                candidateThreads = otherThreads.slice(-5);
                console.log('[SmartLink] Using recency fallback candidates:', candidateThreads.length);
            } else {
                console.log('[SmartLink] Using semantic candidates:', candidateThreads.length);
            }

            const previousHighlights = candidateThreads.map((t, idx) => ({
                id: t.id,
                index: idx + 1,
                text: t.highlight?.text?.slice(0, 500) || ''
            }));

            if (previousHighlights.length === 0) {
                hideConnectionsLoading();
                return;
            }

            const connections = await detectConnections(apiKey, newText, previousHighlights);

            if (connections && connections.length > 0) {
                recordSmartLinkMetric('connections_detected_count', connections.length);
                newThread.connections = connections;
                newThread.deepAngle = null;
                renderConnections(connections);
                await saveThreadsToStorage();
            } else {
                hideConnectionsLoading();
            }
        } catch (error) {
            // Silently ignore PROBATION_ACTIVE errors - expected during rate limit recovery
            if (error?.message?.startsWith('PROBATION_ACTIVE')) {
                console.log('[SmartLink] Skipped due to probation mode:', error.message);
            } else {
                console.error('[SmartLink] Error:', error);
            }
            hideConnectionsLoading();
        }
    }

    async function detectConnections(apiKey, newText, previousHighlights) {
        const lang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const rateManager = window.RateLimitManager
            ? (window.__ATOM_RATE_MANAGER__ || (window.__ATOM_RATE_MANAGER__ = new window.RateLimitManager({
                rpmTotal: 15,
                rpmBackground: 8,
                cacheTtlMs: API_CONFIG.CACHE.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000
            })))
            : null;

        const prompt = `Analyze the relationship between a NEW highlighted text and PREVIOUS highlights from the same reading session.

NEW HIGHLIGHT:
"${newText.slice(0, 800)}"

PREVIOUS HIGHLIGHTS:
${previousHighlights.map(h => `[#${h.index}] "${h.text}"`).join('\n\n')}

For each previous highlight, determine if the NEW highlight:
1. CONTRADICTS it (opposing viewpoints, conflicting data)
2. SUPPORTS it (adds evidence, reinforces the point)
3. EXTENDS it (builds upon, adds new dimension)
4. UNRELATED (no meaningful connection)

Respond in JSON format:
{
  "connections": [
    {
      "targetIndex": 1,
      "type": "contradicts|supports|extends|unrelated",
      "confidence": 0.8,
      "explanation": "Brief explanation in ${lang}"
    }
  ]
}

Only include connections with confidence >= 0.6. If no strong connections, return empty array.`;

        const url = `${API_CONFIG.API_BASE}/${API_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;

        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                responseMimeType: "application/json"
            }
        };

        try {
            const cacheKey = `smartlink:${hashString(`${newText.slice(0, 500)}::${previousHighlights.map(h => h.text).join('|')}`)}`;
            const runRequest = async () => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) {
                    if (response.status === 429 && rateManager) {
                        rateManager.record429Error('smartlink');
                        const retryAfterHeader = response.headers.get('Retry-After');
                        const retryAfterHeaderSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
                        const errorText = await response.text().catch(() => '');
                        const retryAfterSeconds = window.parseRetryAfterSeconds
                            ? window.parseRetryAfterSeconds(errorText)
                            : null;
                        const retrySeconds = Number.isFinite(retryAfterHeaderSeconds)
                            ? retryAfterHeaderSeconds
                            : retryAfterSeconds;
                        if (Number.isFinite(retrySeconds)) {
                            rateManager.setCooldown((retrySeconds + 1) * 1000, 'smartlink-429');
                        }
                    }
                    throw new Error(`SmartLink API error ${response.status}`);
                }
                return response.json();
            };
            const data = rateManager
                ? await rateManager.enqueue(runRequest, {
                    priority: 'background',
                    cacheKey,
                    cacheTtlMs: API_CONFIG.CACHE.SMARTLINK_TTL_MS || 10 * 60 * 1000,
                    skipDuringCooldown: true  // Skip if in cooldown to prevent queue buildup
                })
                : await runRequest();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Helper to clean and parse JSON
            const parseRobustJSON = (text) => {
                // Guard: return empty connections if text is empty/undefined
                if (!text || typeof text !== 'string' || !text.trim()) {
                    console.warn('[SmartLink] Empty response from API, returning empty connections');
                    return { connections: [] };
                }

                // Robust JSON Cleaner & Parser
                const cleanAndParseJson = (text) => {
                    if (!text) return {};
                    // 1. Remove markdown
                    let clean = text.replace(/```json\s*|\s*```/g, '').trim();
                    // 2. Extract JSON object
                    const match = clean.match(/\{[\s\S]*\}/);
                    if (match) clean = match[0];

                    // 3. Try standard parse
                    try { return JSON.parse(clean); } catch (e) { }

                    // 4. Fix common issues (single quotes, trailing commas, unquoted keys)
                    try {
                        // Replace simple single quotes
                        // Simple regex fix for trailing commas
                        let fixed = clean.replace(/,\s*([}\]])/g, '$1');
                        // Add quotes to unquoted keys
                        fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');

                        return JSON.parse(fixed);
                    } catch (e) {
                        // 5. Last resort: specific extraction for "connections"
                        console.warn('[SmartLink] Strict parse failed, trying fallback extraction. Raw:', clean.slice(0, 100));

                        // Try to find ANY array pattern if connections key is missing
                        let arrayMatch = clean.match(/"connections"\s*:\s*\[([\s\S]*?)\]/);
                        if (!arrayMatch) arrayMatch = clean.match(/connections\s*:\s*\[([\s\S]*?)\]/);
                        if (!arrayMatch) arrayMatch = clean.match(/\[([\s\S]*?)\]/); // Broadest fallback

                        if (arrayMatch) {
                            try {
                                // Sanitizer for key names
                                const content = arrayMatch[1];
                                // Fix unquoted keys: { type: ... } -> { "type": ... }
                                const sanitized = content.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                                // Fix trailing commas
                                const noTrailing = sanitized.replace(/,\s*([}\]])/g, '$1');

                                return JSON.parse(`{"connections": [${noTrailing}]}`);
                            } catch (err) {
                                console.warn('[SmartLink] Fallback construction failed:', err);
                            }
                        }
                        throw new Error('Failed to parse JSON');
                    }
                };

                return cleanAndParseJson(text);
            };

            const parsed = parseRobustJSON(rawText);
            const validConnections = parsed.connections;

            return validConnections;
        } catch (error) {
            console.error('[SmartLink] Parse error:', error);
            // Non-critical feature, just return empty
            return [];
        }
    }

    function showConnectionsLoading() {
        // Show loading state in connections tab (can be enhanced later)
        showToast(getMessage('sp_analyzing', 'Analyzing connections...'), 'info');
    }

    function hideConnectionsLoading() {
        // No longer needed with new tab layout
    }

    function renderConnections(connections) {
        // Update the connections list in bottom tab
        renderConnectionsList();
        updateAllCounts();
    }

    async function handleConnectionAction(action, targetId) {
        const currentThread = threads.find(t => t.id === activeThreadId);
        const targetThread = threads.find(t => t.id === targetId);

        if (!currentThread || !targetThread) return;

        if (action === 'compare') {
            // Generate a comparison between the two highlights
            const comparePrompt = `Compare these two highlighted passages and explain how they relate:

PASSAGE 1:
"${currentThread.highlight?.text?.slice(0, 500)}"

PASSAGE 2:
"${targetThread.highlight?.text?.slice(0, 500)}"

Provide a clear analysis of:
1. Key similarities
2. Key differences
3. How they complement each other (if at all)`;

            currentThread.messages.push({ role: 'user', content: comparePrompt });
            addMessageToDOM(comparePrompt, 'user');
            await sendToGemini(comparePrompt, currentThread);
            await saveThreadsToStorage();

        } else if (action === 'merge') {
            // Merge target thread into current thread
            const mergedHighlight = `${currentThread.highlight?.text || ''}\n\n---\n\n${targetThread.highlight?.text || ''}`;
            currentThread.highlight.text = mergedHighlight;
            currentThread.messages = [...targetThread.messages, ...currentThread.messages];

            // Remove target thread
            threads = threads.filter(t => t.id !== targetId);

            await saveThreadsToStorage();
            renderThreadList();
            renderActiveThread();

            // Hide connections after merge
            hideConnectionsLoading();
        }
    }

    function jumpToThread(threadId) {
        activeThreadId = threadId;
        renderThreadList();
        renderActiveThread();
    }

    // ===========================
    // Thread Management
    // ===========================
    async function loadThreadsFromStorage() {
        if (!currentDomain) return;

        const storageKey = `atom_sidepanel_highlight_${currentDomain}`;
        const altDomains = new Set();
        try {
            const host = new URL(pageContext?.url || '').hostname;
            const hostRaw = String(host || '').trim();
            const hostNormalized = normalizeDomain(hostRaw);
            if (hostRaw) altDomains.add(hostRaw);
            if (hostRaw && hostRaw !== hostRaw.toLowerCase()) altDomains.add(hostRaw.toLowerCase());
            if (hostNormalized) altDomains.add(hostNormalized);
            if (hostNormalized && hostNormalized !== `www.${hostNormalized}`) altDomains.add(`www.${hostNormalized}`);
        } catch {
            // ignore
        }
        altDomains.delete(currentDomain);

        const legacyKeys = [...altDomains].map(d => `atom_sidepanel_highlight_${d}`);
        const data = await chrome.storage.local.get([storageKey, ...legacyKeys]);

        const mergeThreads = (lists) => {
            const byId = new Map();
            for (const list of lists) {
                if (!Array.isArray(list)) continue;
                for (const t of list) {
                    const id = t?.id;
                    if (!id) continue;
                    const existing = byId.get(id);
                    const tCreated = Number(t?.createdAt) || 0;
                    const eCreated = Number(existing?.createdAt) || 0;
                    if (!existing || tCreated >= eCreated) {
                        byId.set(id, t);
                    }
                }
            }
            return [...byId.values()];
        };

        const lists = [];
        if (Array.isArray(data[storageKey]?.threads)) lists.push(data[storageKey].threads);
        legacyKeys.forEach((key) => {
            if (Array.isArray(data[key]?.threads)) lists.push(data[key].threads);
        });

        if (lists.length > 0) {
            threads = mergeThreads(lists);
        } else {
            threads = [];
        }

        renderThreadList();

        // Auto-select only when there are threads for this exact URL.
        // Domain fallback list should not steal focus automatically.
        const urlThreads = getThreadsForCurrentUrl();
        if (urlThreads.length > 0 && !activeThreadId) {
            activeThreadId = urlThreads[urlThreads.length - 1].id;
            renderActiveThread();
        } else if (!activeThreadId) {
            renderActiveThread();
        }
    }


    async function saveThreadsToStorage() {
        if (!currentDomain) return;

        const storageKey = `atom_sidepanel_highlight_${currentDomain}`;
        await chrome.storage.local.set({
            [storageKey]: {
                domain: currentDomain,
                threads: threads,
                updatedAt: Date.now(),
                sessionId: SESSION_ID
            }
        });

        // Sync active thread to ReadingSession
        if (activeSessionId && activeThreadId && typeof ReadingSessionService !== 'undefined') {
            try {
                const thread = threads.find(t => t.id === activeThreadId);
                if (thread) {
                    await ReadingSessionService.updateThread(activeSessionId, {
                        messages: thread.messages,
                        status: thread.status
                    });
                }
            } catch (e) {
                console.error('[ReadingSession] Sync error on save:', e);
            }
        }

        // Notify other tabs about data update
        broadcastDataUpdate();
    }

    function renderThreadList() {
        if (!elements.threadList) return;

        const visibleThreads = getVisibleThreads();

        // Render thread items in bottom tab
        if (visibleThreads.length === 0) {
            elements.threadList.innerHTML = `<div class="sp-note-empty">${getMessage('sp_empty_desc', 'No discussions yet')}</div>`;
        } else {
            elements.threadList.innerHTML = visibleThreads.map(thread => {
                const isActive = thread.id === activeThreadId;
                const preview = (() => {
                    const highlightText = String(thread.highlight?.text || '');
                    const highlightTitle = String(thread.highlight?.title || '');

                    // Page discussions all share the same label; show the page title for clarity.
                    if (thread.isPageDiscussion) {
                        return (highlightTitle || highlightText || getMessage('sp_page_discussion', 'Page Discussion')).slice(0, 60);
                    }

                    return (highlightText || highlightTitle || getMessage('sp_empty_title', 'Empty')).slice(0, 60);
                })();
                const statusIcon = thread.status === 'parked' ? getIcon('check') :
                    thread.status === 'saved' ? getIcon('save') : getIcon('thread');

                return `
                    <div class="sp-thread-item ${isActive ? 'active' : ''}" data-thread-id="${thread.id}">
                        <span class="sp-thread-status">${statusIcon}</span>
                        <div class="sp-thread-info">
                            <div class="sp-thread-preview">${escapeHtml(preview)}...</div>
                            <div class="sp-thread-meta">${formatTime(thread.createdAt)}</div>
                        </div>
                    </div>
                `;
            }).reverse().join(''); // Show newest first
        }

        // Add click handlers
        elements.threadList.querySelectorAll('.sp-thread-item').forEach(item => {
            item.addEventListener('click', () => {
                activeThreadId = item.dataset.threadId;
                renderThreadList();
                renderActiveThread();
            });
        });

        updateAllCounts();
    }

    const INSIGHT_TOGGLE_ICONS = {
        show: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        hide: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94"></path><path d="M1 1l22 22"></path><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-4.23 5.94"></path><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"></path><path d="M9.88 9.88a3 3 0 0 1 4.24 4.24"></path></svg>`
    };

    function extractInsightTextFromMaybeJson(rawText) {
        const s = String(rawText || '').trim();
        if (!s) return '';
        if (!s.startsWith('{')) return s;

        const stripped = s
            .replace(/```(?:json)?\s*/gi, '')
            .replace(/```/g, '')
            .trim();

        const match = stripped.match(/\{[\s\S]*\}/);
        if (!match) return s;

        const candidate = match[0];
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed.insight === 'string' && parsed.insight.trim()) {
                return parsed.insight.trim();
            }
            return s;
        } catch {
            try {
                const fixed = candidate
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                const parsed = JSON.parse(fixed);
                if (parsed && typeof parsed.insight === 'string' && parsed.insight.trim()) {
                    return parsed.insight.trim();
                }
            } catch {
                // fall through
            }
            return s;
        }
    }

    function getThreadInsightText(thread) {
        return extractInsightTextFromMaybeJson(thread?.refinedInsight || '').trim();
    }

    function updateInsightToggleButton(thread) {
        if (!elements.insightToggleBtn) return;
        const insightText = getThreadInsightText(thread);
        const hasInsight = !!insightText;
        elements.insightToggleBtn.disabled = !hasInsight;
        elements.insightToggleBtn.innerHTML = isInsightDisplayHidden ? INSIGHT_TOGGLE_ICONS.show : INSIGHT_TOGGLE_ICONS.hide;
        elements.insightToggleBtn.title = hasInsight
            ? (isInsightDisplayHidden
                ? getMessage('sp_key_insight_show', 'Show Key Insight')
                : getMessage('sp_key_insight_hide', 'Hide Key Insight'))
            : getMessage('sp_key_insight_empty', 'No Key Insight yet');
        elements.insightToggleBtn.setAttribute('aria-pressed', String(!isInsightDisplayHidden));
    }

    function syncInsightDisplayUI(thread) {
        const insightText = getThreadInsightText(thread);
        const shouldShow = !!insightText && !isInsightDisplayHidden;

        if (elements.insightText) {
            elements.insightText.textContent = insightText;
        }
        if (elements.insightDisplay) {
            elements.insightDisplay.classList.toggle('active', shouldShow);
        }
        updateInsightToggleButton(thread);
    }

    function setInsightDisplayHidden(nextHidden, persist = true) {
        isInsightDisplayHidden = !!nextHidden;
        if (persist) {
            chrome.storage.local.set({ sp_insight_display_hidden: isInsightDisplayHidden });
        }
        const thread = threads.find(t => t.id === activeThreadId);
        syncInsightDisplayUI(thread);
    }

    function renderActiveThread() {
        const thread = threads.find(t => t.id === activeThreadId);

        if (!thread) {
            // No active thread - show empty state
            if (elements.currentContext) elements.currentContext.classList.remove('active');
            if (elements.actionBar) elements.actionBar.classList.remove('active');
            if (elements.insightDisplay) elements.insightDisplay.classList.remove('active');
            if (elements.emptyState) elements.emptyState.style.display = 'flex';
            updateInsightToggleButton(null);

            // Allow quick actions (like summarize page) even without an active thread
            showQuickActions();

            if (elements.messages) {
                elements.messages.innerHTML = '';
                elements.messages.appendChild(elements.emptyState);
            }
            // Show insights summary if we have any
            renderInsightsSummary();
            return;
        }

        // Show highlight context
        if (elements.currentContext && elements.highlightText) {
            elements.currentContext.classList.add('active');
            elements.highlightText.textContent = thread.highlight?.text || '';
        }

        // Show quick action chips for fresh threads (has highlight but no messages yet)
        const hasHighlight = thread.highlight?.text?.length > 0;
        const hasMessages = thread.messages?.length > 0;
        if (hasHighlight && !hasMessages) {
            showQuickActions();
        } else {
            hideQuickActions();
        }

        // Hide insights summary when in active discussion
        if (elements.insightsSummary) {
            elements.insightsSummary.classList.remove('active');
        }

        // Show action bar with active class
        if (elements.actionBar) {
            elements.actionBar.classList.add('active');
        }

        // Show/hide insight display based on user preference
        syncInsightDisplayUI(thread);

        // Render connections in bottom tab
        renderConnectionsList();

        // Render session insights (from Reading Card)
        renderSessionInsights();

        // Render messages
        if (elements.messages) {
            elements.messages.innerHTML = '';

            // Hide empty state
            if (elements.emptyState) {
                elements.emptyState.style.display = 'none';
            }

            thread.messages.forEach(msg => {
                addMessageToDOM(msg.content, msg.role);
            });
        }

        if (thread.autoSummaryData && !thread.autoSummaryDismissed) {
            renderAutoSummary(thread);
        }

        updateSendButton();
    }

    function renderInsightsSummary() {
        const insightThreads = threads.filter(t => t.refinedInsight);

        if (insightThreads.length === 0) {
            if (elements.insightsSummary) elements.insightsSummary.classList.remove('active');
            return;
        }

        if (elements.insightsSummary) elements.insightsSummary.classList.add('active');
        if (elements.insightsCount) elements.insightsCount.textContent = `(${insightThreads.length})`;

        if (elements.insightsList) {
            elements.insightsList.innerHTML = insightThreads.map(t => `
                <div class="sp-insight-item" data-thread-id="${t.id}">
                    <span class="sp-insight-item-icon">${getIcon('insight')}</span>
                    <span class="sp-insight-item-text">${escapeHtml(String(t.refinedInsight || '').trim())}</span>
                </div>
            `).join('');

            // Click to view thread
            elements.insightsList.querySelectorAll('.sp-insight-item').forEach(item => {
                item.addEventListener('click', () => {
                    activeThreadId = item.dataset.threadId;
                    renderThreadList();
                    renderActiveThread();
                });
            });
        }
    }

    /**
     * Render session insights from Reading Card
     * Shows key points and insights from context menu actions
     */
    /**
     * Render session insights from Reading Card
     * Shows key points and insights from context menu actions
     */
    async function renderSessionInsights() {
        if (!elements.sessionInsights) return;

        // Get key insights from ALL threads
        const insights = threads
            .filter(t => t.refinedInsight)
            .map(t => ({ id: t.id, text: t.refinedInsight, type: 'insight' }));

        if (insights.length === 0) {
            elements.sessionInsights.classList.remove('active');
            elements.sessionInsights.innerHTML = '';
            return;
        }

        elements.sessionInsights.classList.add('active');

        // Check if we already rendered the header to preserve state
        const existingHeader = elements.sessionInsights.querySelector('.sp-insights-header');
        const isCollapsed = existingHeader ? existingHeader.getAttribute('data-collapsed') === 'true' : false;

        const icon = getIcon('lightbulb', 'sp-icon-sm');

        let html = `
            <div class="sp-insights-header" data-collapsed="${isCollapsed}" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: ${isCollapsed ? '0' : '8px'};">
                <h4 style="margin: 0; display: flex; align-items: center; gap: 6px;">
                    ${icon} Key Insight (${insights.length})
                </h4>
                <button class="sp-action-btn" style="border: none; background: transparent; padding: 2px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${isCollapsed ? '-90deg' : '0deg'}); transition: transform 0.2s;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
            </div>
            <div class="sp-insights-list" style="display: ${isCollapsed ? 'none' : 'block'};">
        `;

        html += `<ul>`;
        insights.forEach(item => {
            html += `
            <li class="sp-session-insight-item" data-id="${item.id}">
                <div class="sp-session-insight-badge">💡</div>
                <div class="sp-session-insight-text">${item.text}</div>
            </li>`;
        });
        html += `</ul></div>`;

        elements.sessionInsights.innerHTML = html;

        // Add toggle listener
        const header = elements.sessionInsights.querySelector('.sp-insights-header');
        if (header) {
            header.addEventListener('click', () => {
                const list = elements.sessionInsights.querySelector('.sp-insights-list');
                const chevron = header.querySelector('svg');
                const wasCollapsed = header.getAttribute('data-collapsed') === 'true';

                if (wasCollapsed) {
                    // Expand
                    list.style.display = 'block';
                    header.setAttribute('data-collapsed', 'false');
                    header.style.marginBottom = '8px';
                    chevron.style.transform = 'rotate(0deg)';
                } else {
                    // Collapse
                    list.style.display = 'none';
                    header.setAttribute('data-collapsed', 'true');
                    header.style.marginBottom = '0';
                    chevron.style.transform = 'rotate(-90deg)';
                }
            });
        }
    }

    function renderConnectionsList() {
        if (!elements.connectionsList) return;

        const allConnections = [];
        threads.forEach(thread => {
            if (thread.connections) {
                thread.connections.forEach(conn => {
                    allConnections.push({ ...conn, threadId: thread.id });
                });
            }
        });

        if (allConnections.length === 0) {
            elements.connectionsList.innerHTML = `<div class="sp-connection-empty">${getMessage('sp_connections_title', 'No connections found yet')}</div>`;
            updateDeepAngleUI();
            return;
        }

        const typeLabels = {
            'contradicts': getMessage('sp_connection_contradicts', 'Contradicts'),
            'supports': getMessage('sp_connection_supports', 'Supports'),
            'extends': getMessage('sp_connection_extends', 'Extends')
        };

        elements.connectionsList.innerHTML = allConnections.map(conn => `
            <div class="sp-connection-item ${conn.type}" data-thread-id="${conn.threadId}">
                <div class="sp-connection-type">
                    ${conn.type === 'contradicts' ? '⚡' : conn.type === 'supports' ? '✓' : '➕'}
                    ${typeLabels[conn.type] || conn.type}
                </div>
                <div class="sp-connection-preview">"${escapeHtml(conn.targetPreview?.slice(0, 50) || '')}..."</div>
            </div>
        `).join('');

        // Click to view thread
        elements.connectionsList.querySelectorAll('.sp-connection-item').forEach(item => {
            item.addEventListener('click', () => {
                activeThreadId = item.dataset.threadId;
                renderThreadList();
                renderActiveThread();
            });
        });

        updateDeepAngleUI();
    }

    // ===========================
    // Page Context Extraction
    // ===========================
    async function loadPageContext() {
        setContextStatus('loading', 'Reading page...');

        try {
            const previousUrl = pageContext?.url || '';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                setContextStatus('error', 'No active tab');
                return;
            }

            currentTabId = tab.id;
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                setContextStatus('error', 'Cannot read this page');
                pageContext = null;
                return;
            }

            currentTabId = tab.id;
            try {
                currentDomain = normalizeDomain(new URL(tab.url).hostname) || 'local';
            } catch (e) {
                currentDomain = 'local';
            }
            elements.pageTitle.textContent = tab.title || tab.url;

            // Request content from content script with retry
            let response = null;
            let lastError = null;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    response = await chrome.tabs.sendMessage(tab.id, { type: 'ATOM_GET_PAGE_CONTENT' });
                    break; // Success, exit loop
                } catch (err) {
                    lastError = err;
                    // Content script not ready, wait and retry
                    if (attempt < 2) {
                        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                    }
                }
            }

            if (response?.ok) {
                pageContext = {
                    content: response.content,
                    url: response.url,
                    title: response.title,
                    domain: response.domain,
                    headings: response.headings || []
                };
                updateDeepAngleUI();

                // If we navigated within the same tab (same domain), keep the domain threads
                // but clear active selection so we don't keep chatting about the previous URL.
                if (normalizeUrl(previousUrl) !== normalizeUrl(pageContext.url)) {
                    activeThreadId = null;
                }

                const wordCount = pageContext.content.split(/\s+/).length;
                setContextStatus('ready', `Ready (${wordCount} words)`);
                elements.sendBtn.disabled = false;

                // Load threads for this domain
                await loadThreadsFromStorage();

                // Ensure session + mode UI + primer
                await ensureActiveSession();
                await initLearningModeUI();
                await checkAndShowPrimer();

                // Phase 3: Check for related memory (non-blocking)
                checkAndShowRelatedMemory().catch(err => {
                    console.warn('[SidePanel] Related memory check failed:', err.message);
                });
            } else {
                // Log error only if all retries failed
                if (lastError) {
                    console.warn('[SidePanel] Content script not available:', lastError.message);
                }
                setContextStatus('error', getMessage('sp_page_read_failed', 'Failed to read page'));
                pageContext = null;
                elements.primerRoot?.classList.remove('active');
                if (elements.primerRoot) elements.primerRoot.innerHTML = '';
                elements.modeRoot?.classList.remove('active');
                if (elements.modeRoot) elements.modeRoot.innerHTML = '';
                elements.memoryRoot?.classList.remove('active');
                if (elements.memoryRoot) elements.memoryRoot.innerHTML = '';
            }
        } catch (error) {
            console.error('[SidePanel] Error:', error);
            setContextStatus('error', 'Error loading page');
            pageContext = null;
            elements.primerRoot?.classList.remove('active');
            if (elements.primerRoot) elements.primerRoot.innerHTML = '';
            elements.modeRoot?.classList.remove('active');
            if (elements.modeRoot) elements.modeRoot.innerHTML = '';
            elements.memoryRoot?.classList.remove('active');
            if (elements.memoryRoot) elements.memoryRoot.innerHTML = '';
        }
    }

    // ===========================
    // Tab Change Handling
    // ===========================
    async function handleTabChange(activeInfo) {
        if (activeInfo.tabId !== currentTabId) {
            threads = [];
            activeThreadId = null;
            await loadPageContext();
        }
    }

    function handleTabUpdate(tabId, changeInfo) {
        if (tabId === currentTabId && changeInfo.status === 'complete') {
            loadPageContext();
        }
    }

    // ===========================
    // Chat Functions
    // ===========================
    async function handleSend() {
        const message = elements.userInput.value.trim();
        if (!message || isLoading) return;

        if (!pageContext?.url) {
            showToast(getMessage('sp_page_read_failed', 'Failed to read page'), 'error');
            return;
        }

        // If we navigated to a new URL but still have an old active thread selected,
        // reset to avoid sending messages using the previous page's context.
        if (activeThreadId) {
            const current = threads.find(t => t.id === activeThreadId);
            const currentUrl = normalizeUrl(pageContext?.url);
            const threadUrl = normalizeUrl(current?.highlight?.url);
            if (currentUrl && threadUrl && currentUrl !== threadUrl) {
                activeThreadId = null;
            }
        }

        // Ensure we have an active thread for THIS URL.
        // If user navigates to a new article and starts typing without highlighting,
        // we should create/select a page discussion thread for the current page
        // instead of reusing the previous page's thread.
        if (!activeThreadId) {
            const urlThreads = getThreadsForCurrentUrl();
            if (urlThreads.length > 0) {
                activeThreadId = urlThreads[urlThreads.length - 1].id;
            } else {
                const newThread = {
                    id: `thread_${Date.now()}`,
                    highlight: {
                        text: getMessage('sp_page_discussion', 'Page Discussion'),
                        url: pageContext?.url,
                        title: pageContext?.title
                    },
                    messages: [],
                    status: 'active',
                    isPageDiscussion: true,
                    createdAt: Date.now()
                };
                threads.push(newThread);
                activeThreadId = newThread.id;
            }

            renderThreadList();
            renderActiveThread();
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        // Add user message
        thread.messages.push({ role: 'user', content: message });
        addMessageToDOM(message, 'user');

        elements.userInput.value = '';
        elements.userInput.style.height = 'auto';
        updateSendButton();

        // Send to Gemini
        await sendToGemini(message, thread);

        // Save threads
        await saveThreadsToStorage();
    }

    // ===========================
    // Quick Action Chips
    // ===========================
    function setupQuickActionChips() {
        // 1. Setup Chip Clicks
        const chips = document.querySelectorAll('.sp-quick-chip[data-action]');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const action = chip.getAttribute('data-action');
                if (action) {
                    handleQuickAction(action);
                    // Hide chips after action (user is now chatting)
                    hideQuickActions();
                }
            });
        });

        // 2. Setup Toggle Header
        const toggleBtn = document.getElementById('btn-toggle-actions');
        const actionsGrid = document.getElementById('quick-actions-grid');

        if (toggleBtn && actionsGrid) {
            toggleBtn.addEventListener('click', () => {
                const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

                // Toggle State
                if (isExpanded) {
                    // Collapse
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    actionsGrid.classList.add('collapsed');
                } else {
                    // Expand
                    toggleBtn.setAttribute('aria-expanded', 'true');
                    actionsGrid.classList.remove('collapsed');
                }
            });
        }
    }

    function showQuickActions() {
        if (elements.quickActions) {
            updateQuickActionChips();
            elements.quickActions.classList.remove('hidden');
        }
    }

    function hideQuickActions() {
        if (elements.quickActions) {
            elements.quickActions.classList.add('hidden');
        }
    }

    async function handleQuickAction(type) {
        if (isLoading) return;

        // Handle save action separately (doesn't need AI)
        if (type === 'save') {
            await quickSaveHighlight();
            return;
        }

        // Ensure actions operate on the current page (not a previously selected thread from another URL).
        if (activeThreadId) {
            const current = threads.find(t => t.id === activeThreadId);
            const currentUrl = normalizeUrl(pageContext?.url);
            const threadUrl = normalizeUrl(current?.highlight?.url);
            if (currentUrl && threadUrl && currentUrl !== threadUrl) {
                activeThreadId = null;
            }
        }

        // 1. Ensure we have an active thread for this URL.
        if (!activeThreadId) {
            const urlThreads = getThreadsForCurrentUrl();
            if (urlThreads.length > 0) {
                activeThreadId = urlThreads[urlThreads.length - 1].id;
                renderThreadList();
                renderActiveThread();
            } else {
                const newThread = {
                    id: `thread_${Date.now()}`,
                    highlight: {
                        text: getMessage('sp_page_discussion', 'Page Discussion'),
                        url: pageContext?.url,
                        title: pageContext?.title
                    },
                    messages: [],
                    status: 'active',
                    isPageDiscussion: true,
                    createdAt: Date.now()
                };
                threads.push(newThread);
                activeThreadId = newThread.id;
                renderThreadList();
                renderActiveThread(); // UI update
            }
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        // If it's a page discussion and no highlight, use page content
        const isPageLevel = thread.isPageDiscussion;
        const highlightText = isPageLevel
            ? (pageContext?.content || '').slice(0, 5000)
            : (thread.highlight?.text || '');

        // Updated prompts with evidence format requirements
        const prompts = {
            'summarize': `Summarize this text concisely.
Format:
📍 Key phrases: [list 2-3 key phrases EXACTLY from the text]
📝 Summary: [your summary in Vietnamese]

Text: "${highlightText.slice(0, 1500)}"`,

            'keypoints': `Extract the key points from this text.
Format each point with evidence:
1. 📍 "quote" → [your interpretation in Vietnamese]
(Note: The quote must be EXACTLY from the original text in original language)
2. 📍 "quote" → [your interpretation in Vietnamese]

Text: "${highlightText.slice(0, 1500)}"`,

            'explain': `Explain this text simply and clearly.
Format:
📍 Evidence: "[EXACT QUOTE from text in ORIGINAL LANGUAGE]"
💡 Explanation: [Explain key concepts. IF user_persona is set, adapt complexity and use relevant analogies. ELSE, use simple ELI5 style. Contextualize: Who/What/Why? What is the implication?]

Text: "${highlightText.slice(0, 1500)}"`,

            'counter': `Provide counter-arguments to this text.
Format:
📍 Author's claim: [EXACT QUOTE from text in ORIGINAL LANGUAGE]
🤔 Counter-argument: [your counter-point in Vietnamese]
⚖️ Considerations: [balanced view in Vietnamese]

Text: "${highlightText.slice(0, 1500)}"`,

            'connect': `How does this relate to the broader context?
Format:
📍 This passage: [EXACT QUOTE from text in ORIGINAL LANGUAGE]
🔗 Connection: [how it relates to other concepts in Vietnamese]

Text: "${highlightText.slice(0, 1500)}"`
        };

        const bloomPrompt = window.LearningObjectiveService?.getBloomPrompt?.(type) || '';
        const base = prompts[type] || prompts['summarize'];
        const message = bloomPrompt ? `${bloomPrompt}\n\n${base}` : base;

        // Ensure active thread
        if (!activeThreadId && threads.length > 0) {
            activeThreadId = threads[threads.length - 1].id;
        }

        if (!activeThreadId) return;

        const thread2 = threads.find(t => t.id === activeThreadId);
        if (!thread2) return;

        thread2.messages.push({ role: 'user', content: message });
        addMessageToDOM(message, 'user');

        // Pass action type for context level determination
        await sendToGemini(message, thread2, type);
        await saveThreadsToStorage();
    }

    async function sendToGemini(userMessage, thread, action = null) {
        // Check for offline mode
        if (!isOnline) {
            // Queue message for later
            pendingMessages.push({ message: userMessage, thread: thread, action: action });
            showOfflineMessageUI(userMessage);
            showToast(getMessage('sp_message_queued', 'Message saved. Will send when online.'), 'warning');
            return;
        }

        setLoading(true);
        showTypingIndicator();

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                hideTypingIndicator();
                addErrorMessageToDOM(
                    getMessage('sp_error_no_api_key', 'API key not set'),
                    getMessage('sp_error_no_api_key_desc', 'Go to Settings to configure your Gemini API key.'),
                    [{ label: getMessage('sp_open_settings', 'Open Settings'), action: 'openSettings' }]
                );
                setLoading(false);
                return;
            }

            // Determine context level based on action and conversation state
            const messageCount = thread.messages?.filter(m => m.role === 'assistant').length || 0;
            const contextLevel = determineContextLevel(action, messageCount);
            const systemPrompt = buildSystemPrompt(thread, contextLevel, action);
            const conversationHistory = buildConversationHistory(thread, userMessage);
            const response = await callLLMAPI(systemPrompt, conversationHistory, {
                priority: 'vip',
                allowFallback: true
            });

            hideTypingIndicator();

            if (response) {
                thread.messages.push({ role: 'assistant', content: response });
                addMessageToDOM(response, 'assistant');

                // Onboarding: Show tooltip after first chat exchange
                if (thread.messages.filter(m => m.role === 'assistant').length === 1) {
                    checkAndShowContextualTooltip('first_chat');
                }

                await maybeAutoSummarize(thread);
            } else {
                addErrorMessageToDOM(
                    getMessage('sp_error_empty_response', 'No response received'),
                    getMessage('sp_error_empty_response_desc', 'The AI did not return a response. Please try again.'),
                    [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
                );
            }
        } catch (error) {
            console.error('[SidePanel] Gemini error:', error);
            hideTypingIndicator();

            if (error instanceof ApiError && error.status === 429) {
                // Extract retry-after seconds from error message if available
                let retrySeconds = 30; // Default
                const errorMsg = error.message || '';
                const retryMatch = errorMsg.match(/retry\s*(?:in|after)?\s*(\d+(?:\.\d+)?)\s*s/i);
                if (retryMatch) {
                    retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
                }
                showRateLimitCountdown(retrySeconds);
                setLoading(false);
                return;
            }


            // Display user-friendly error based on error type
            const errorInfo = getErrorInfo(error);
            addErrorMessageToDOM(
                errorInfo.title,
                errorInfo.description,
                errorInfo.actions
            );
        }

        setLoading(false);
    }

    function getErrorInfo(error) {
        // Helper to detect network errors
        const isNetworkError = (err) => {
            if (!err) return false;
            const msg = (err.message || '').toLowerCase();
            return err instanceof TypeError && msg.includes('fetch') ||
                msg.includes('network') ||
                msg.includes('failed to fetch') ||
                err.name === 'NetworkError';
        };

        // Network/Offline errors
        if (!isOnline || isNetworkError(error)) {
            return {
                title: getMessage('sp_error_network', 'Connection lost'),
                description: getMessage('sp_error_network_desc', 'Check your internet connection and try again.'),
                actions: [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
            };
        }

        // API errors
        if (error instanceof ApiError) {
            switch (error.status) {
                case 401:
                    return {
                        title: getMessage('sp_error_unauthorized', 'Invalid API key'),
                        description: getMessage('sp_error_unauthorized_desc', 'Your API key is invalid or expired.'),
                        actions: [{ label: getMessage('sp_open_settings', 'Open Settings'), action: 'openSettings' }]
                    };
                case 429:
                    return {
                        title: getMessage('sp_error_rate_limit', 'Too many requests'),
                        description: getMessage('sp_error_rate_limit_desc', 'Please wait a moment before trying again.'),
                        actions: [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
                    };
                case 500:
                case 502:
                case 503:
                    return {
                        title: getMessage('sp_error_server', 'Server error'),
                        description: getMessage('sp_error_server_desc', 'The AI service is experiencing issues.'),
                        actions: [
                            { label: getMessage('sp_retry', 'Try again'), action: 'retry' },
                            { label: getMessage('sp_report_issue', 'Report issue'), action: 'report' }
                        ]
                    };
                default:
                    return {
                        title: error.message,
                        description: getMessage('sp_error_generic_desc', 'Something went wrong.'),
                        actions: [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
                    };
            }
        }

        // Timeout errors
        if (error.name === 'AbortError') {
            return {
                title: getMessage('sp_error_timeout', 'Request timed out'),
                description: getMessage('sp_error_timeout_desc', 'The request took too long. Please try again.'),
                actions: [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
            };
        }

        // DOMException (extension context invalidated, network abort, etc.)
        if (error instanceof DOMException || error.name === 'DOMException') {
            return {
                title: getMessage('sp_error_context', 'Context lost'),
                description: getMessage('sp_error_context_desc', 'The extension context was interrupted. Please reload the page.'),
                actions: [{ label: getMessage('sp_reload', 'Reload Page'), action: 'reload' }]
            };
        }

        // Generic errors
        return {
            title: getMessage('sp_error_unknown', 'An error occurred'),
            description: error.message || getMessage('sp_error_generic_desc', 'Something went wrong.'),
            actions: [{ label: getMessage('sp_retry', 'Try again'), action: 'retry' }]
        };
    }

    function showOfflineMessageUI(message) {
        if (!elements.messages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'sp-message user pending';
        msgDiv.innerHTML = `
            <div class="sp-message-content">${escapeHtml(message)}</div>
            <div class="sp-message-pending-indicator">
                <span class="pending-icon">⏳</span>
                <span class="pending-text">${getMessage('sp_waiting_connection', 'Waiting for connection...')}</span>
            </div>
        `;
        elements.messages.appendChild(msgDiv);
        scrollToBottom();
    }

    function addErrorMessageToDOM(title, description, actions = []) {
        if (!elements.messages) return;

        const actionsHtml = actions.map(action =>
            `<button class="sp-error-action" data-action="${action.action}">${action.label}</button>`
        ).join('');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'sp-message error';
        errorDiv.innerHTML = `
            <div class="sp-error-header">
                <span class="sp-error-icon">⚠️</span>
                <span class="sp-error-title">${escapeHtml(title)}</span>
            </div>
            <div class="sp-error-description">${escapeHtml(description)}</div>
            ${actionsHtml ? `<div class="sp-error-actions">${actionsHtml}</div>` : ''}
        `;

        // Add action handlers
        errorDiv.querySelectorAll('.sp-error-action').forEach(btn => {
            btn.addEventListener('click', () => handleErrorAction(btn.dataset.action));
        });

        elements.messages.appendChild(errorDiv);
        scrollToBottom();
    }

    function handleErrorAction(action) {
        switch (action) {
            case 'retry':
                // Re-send the last user message
                const thread = threads.find(t => t.id === activeThreadId);
                if (thread && thread.messages.length > 0) {
                    const lastUserMsg = [...thread.messages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                        // Remove the last user message to resend
                        thread.messages = thread.messages.filter(m => m !== lastUserMsg);
                        elements.userInput.value = lastUserMsg.content;
                        handleSend();
                    }
                }
                break;
            case 'openSettings':
                chrome.runtime.openOptionsPage?.() || window.open(chrome.runtime.getURL('options.html'));
                break;
            case 'report':
                window.open('https://github.com/anthropics/claude-code/issues', '_blank');
                break;
        }
    }

    /**
     * Build system prompt with smart context levels
     * @param {Object} thread - Current thread
     * @param {string} contextLevel - MINIMAL, STANDARD, or FULL
     * @param {string} action - Quick action type (optional)
     */
    function buildSystemPrompt(thread, contextLevel = CONTEXT_LEVELS.STANDARD, action = null) {
        const lang = navigator.language.startsWith('vi') ? 'Vietnamese' : 'English';
        const highlight = thread?.highlight || {};
        const highlightText = highlight.text || '';
        const modePrompt = window.LearningObjectiveService?.getResponseStylePrompt?.(currentModeId) || '';

        // Start building prompt
        let prompt = `You are a helpful reading assistant. The user is reading a web page and discussing specific content.

LANGUAGE: Respond in ${lang}.
`;

        // Inject User Persona if set
        if (userPersona) {
            prompt += `
USER PERSONA: The user is a ${userPersona}.
ADAPTATION INSTRUCTION: Adjust your explanations to match the user's expertise level.
- If the topic is within their field, use appropriate professional terminology and depth.
- If the topic is outside their field, use analogies relevant to their background (e.g., explain per their persona's mental model).
`;
        }


        // Always include focused text
        if (highlightText && !thread?.isPageDiscussion) {
            prompt += `
HIGHLIGHTED TEXT (user's focus):
"""
${highlightText.slice(0, 2000)}
"""
`;
        } else if (thread?.isPageDiscussion) {
            prompt += `
TOPIC: You are discussing the entire page content.
`;
        }

        // STANDARD & FULL: Add surrounding context
        if (contextLevel !== CONTEXT_LEVELS.MINIMAL) {
            // Add surrounding paragraph if available
            if (highlight.surroundingContext) {
                prompt += `
SURROUNDING PARAGRAPH:
"""
${highlight.surroundingContext.slice(0, 800)}
"""
`;
            }

            // Add section heading if available
            if (highlight.sectionHeading) {
                prompt += `SECTION: ${highlight.sectionHeading}\n`;
            }

            // Add page outline for context
            if (highlight.pageOutline) {
                prompt += `
PAGE STRUCTURE:
${highlight.pageOutline.slice(0, 500)}
`;
            }
        }

        // FULL only: Add page content (for summarize/analyze actions)
        if (contextLevel === CONTEXT_LEVELS.FULL && pageContext?.content) {
            prompt += `
FULL PAGE CONTENT:
${pageContext.content.slice(0, 12000)}
`;
        }

        // Add evidence requirement for better grounding
        prompt += `
RESPONSE REQUIREMENTS:
- Focus on the HIGHLIGHTED TEXT when answering
- Be clear and structured; use bullet points when appropriate
- When explaining or analyzing, cite specific phrases from the text using:
  📍 Evidence: "exact quote"
  💡 Explanation: your analysis
`;

        if (modePrompt) {
            prompt += `\n${modePrompt}\n`;
        }

        // If Page Discussion, force FULL context level if standard or minimal
        if (thread?.isPageDiscussion && contextLevel !== CONTEXT_LEVELS.FULL) {
            prompt += `
FULL PAGE CONTENT FOR REFERENCE:
${(pageContext?.content || '').slice(0, 10000)}
`;
        }

        // Log context level for monitoring
        console.log(`[Token] Context: ${contextLevel}, Prompt length: ${prompt.length} chars`);

        return prompt;
    }

    function buildConversationHistory(thread, currentMessage) {
        const history = [];

        // Add previous messages from this thread
        for (const msg of (thread.messages || []).slice(-10)) {
            history.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        }

        // Add current message
        history.push({
            role: 'user',
            parts: [{ text: currentMessage }]
        });

        return history;
    }

    // ===========================
    // Auto Summary (Task 1.6)
    // ===========================
    function shouldAutoSummarize(thread) {
        if (!thread || thread.autoSummarized || thread.autoSummaryDismissed) return false;
        const assistantCount = thread.messages?.filter(m => m.role === 'assistant').length || 0;
        return assistantCount >= AUTO_SUMMARY_THRESHOLD;
    }

    async function maybeAutoSummarize(thread) {
        if (!shouldAutoSummarize(thread)) return;
        const apiKey = await getApiKey();
        if (!apiKey) return;

        const summaryData = await generateThreadSummary(thread, apiKey);
        if (!summaryData) return;

        thread.autoSummarized = true;
        thread.autoSummaryData = summaryData;
        await saveThreadsToStorage();

        renderAutoSummary(thread);
    }

    async function generateThreadSummary(thread, apiKey) {
        const highlightText = thread.highlight?.text || '';
        const conversationLog = (thread.messages || [])
            .slice(-8)
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
            .join('\n\n');

        const prompt = `Summarize this reading thread and suggest next steps.

Highlighted text:
"${highlightText.slice(0, 1000)}"

Conversation:
${conversationLog}

Return JSON only:
{
  "takeaways": ["...", "..."],
  "suggestions": ["...", "..."]
}
Language: ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}`;

        try {
            const systemPrompt = 'Return JSON only. No markdown.';
            const history = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callGeminiAPI(apiKey, systemPrompt, history, 1, {
                priority: 'background',
                allowFallback: true
            });
            if (!response) return null;
            const match = response.match(/\{[\s\S]*\}/);
            if (!match) return null;
            const parsed = JSON.parse(match[0]);
            return {
                takeaways: Array.isArray(parsed.takeaways) ? parsed.takeaways.slice(0, 3) : [],
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : []
            };
        } catch (e) {
            console.warn('[AutoSummary] Failed:', e);
            return null;
        }
    }

    function renderAutoSummary(thread) {
        if (!elements.messages || !thread?.autoSummaryData) return;

        const summaryData = thread.autoSummaryData;
        const container = document.createElement('div');
        container.className = 'sp-auto-summary';

        const title = getMessage('sp_auto_summary_title', 'Thread Summary');
        const takeawaysLabel = getMessage('sp_auto_summary_takeaways', 'Key takeaways');
        const suggestionsLabel = getMessage('sp_auto_summary_suggestions', 'Suggested next questions');
        const actionInsight = getMessage('sp_auto_summary_create_insight', 'Create Insight');
        const actionAsk = getMessage('sp_auto_summary_ask_followup', 'Ask Follow-up');
        const actionDismiss = getMessage('sp_auto_summary_dismiss', 'Move On');

        container.innerHTML = `
            <div class="sp-auto-summary-header">
                <span>💡</span>
                <span>${title}</span>
                <button class="sp-auto-summary-dismiss" aria-label="${actionDismiss}">×</button>
            </div>
            <div class="sp-auto-summary-body">
                <div class="sp-auto-summary-section">
                    <div class="sp-auto-summary-label">${takeawaysLabel}</div>
                    <ul>
                        ${(summaryData.takeaways || []).map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                    </ul>
                </div>
                <div class="sp-auto-summary-section">
                    <div class="sp-auto-summary-label">${suggestionsLabel}</div>
                    <ul>
                        ${(summaryData.suggestions || []).map((s, idx) => `
                            <li class="sp-auto-summary-suggestion" data-index="${idx}">
                                ${escapeHtml(s)}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            <div class="sp-auto-summary-actions">
                <button class="sp-action-btn primary" data-action="insight">${actionInsight}</button>
                <button class="sp-action-btn" data-action="ask">${actionAsk}</button>
                <button class="sp-action-btn" data-action="dismiss">${actionDismiss}</button>
            </div>
        `;

        elements.messages.appendChild(container);
        scrollToBottom();

        container.querySelector('.sp-auto-summary-dismiss')?.addEventListener('click', () => {
            dismissAutoSummary(thread, container);
        });

        container.querySelectorAll('.sp-auto-summary-suggestion').forEach((item) => {
            item.addEventListener('click', () => {
                const idx = Number(item.getAttribute('data-index'));
                askSuggestedQuestion(thread, idx);
            });
        });

        container.querySelector('[data-action="insight"]')?.addEventListener('click', () => {
            createInsightFromSummary(thread);
        });
        container.querySelector('[data-action="ask"]')?.addEventListener('click', () => {
            askSuggestedQuestion(thread, 0);
        });
        container.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
            dismissAutoSummary(thread, container);
        });
    }

    function dismissAutoSummary(thread, container) {
        if (thread) {
            thread.autoSummaryDismissed = true;
            saveThreadsToStorage();
        }
        container?.remove();
    }

    function createInsightFromSummary(thread) {
        const data = thread?.autoSummaryData;
        if (!data || !data.takeaways?.length) return;
        const insight = data.takeaways.join(' • ');
        thread.refinedInsight = insight;
        saveThreadsToStorage();
        renderAtomicThought(insight);

        if (activeSessionId && typeof ReadingSessionService !== 'undefined') {
            ReadingSessionService.addInsight(activeSessionId, insight, 'thread').catch(() => { });
        }
    }

    function askSuggestedQuestion(thread, index) {
        const data = thread?.autoSummaryData;
        const suggestion = data?.suggestions?.[index];
        if (!suggestion) return;
        if (elements.userInput) {
            elements.userInput.value = suggestion;
            updateSendButton();
            handleSend();
        }
    }

    // ===========================
    // LLM Provider Adapter (OpenRouter Integration)
    // ===========================
    async function getLLMProvider() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'atom_llm_provider',
                'atom_openrouter_key',
                'atom_openrouter_model'
            ], (result) => {
                resolve({
                    provider: result.atom_llm_provider || 'google',
                    openrouterKey: result.atom_openrouter_key || '',
                    // Default to Llama 3.3, avoiding the broken Gemini Free model
                    openrouterModel: result.atom_openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free'
                });
            });
        });
    }

    // Convert Gemini 'contents' format to OpenAI 'messages' format
    function convertToOpenRouterMessages(systemPrompt, geminiContents) {
        const messages = [];

        // Add system message
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Convert Gemini contents to OpenAI messages
        for (const item of geminiContents) {
            const role = item.role === 'model' ? 'assistant' : 'user';
            const text = item.parts?.map(p => p.text).join('\n') || '';
            if (text.trim()) {
                messages.push({ role, content: text });
            }
        }

        return messages;
    }

    async function callOpenRouterAPI(openrouterKey, model, messages, generationConfig = {}) {
        const url = 'https://openrouter.ai/api/v1/chat/completions';

        // Intercept broken/unavailable model and swap to Step 3.5 Flash (High Availability)
        let targetModel = model;
        if (targetModel === 'google/gemini-2.0-flash-exp:free') {
            console.warn('[ATOM AI] Intercepting broken model request. Swapping to Step 3.5 Flash.');
            targetModel = 'stepfun/step-3.5-flash:free';
        }

        const body = {
            model: targetModel,
            messages: messages,
            temperature: generationConfig.temperature ?? 0.7,
            max_tokens: generationConfig.maxOutputTokens ?? 2048,
            stream: false
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://atomextension.com',
                'X-Title': 'ATOM Extension'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `OpenRouter API error ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    }

    // Unified LLM caller - automatically routes to appropriate provider with fallback
    async function callLLMAPI(systemPrompt, conversationHistory, options = {}) {
        const llmConfig = await getLLMProvider();
        const geminiKey = await getApiKey();

        // 1. Forced OpenRouter Mode
        if (llmConfig.provider === 'openrouter') {
            if (llmConfig.openrouterKey) {
                const messages = convertToOpenRouterMessages(systemPrompt, conversationHistory);

                try {
                    return await callOpenRouterAPI(
                        llmConfig.openrouterKey,
                        llmConfig.openrouterModel,
                        messages,
                        options.generationConfig || {}
                    );
                } catch (primaryError) {
                    console.warn('[ATOM AI] Primary OpenRouter model failed. Trying fallbacks...', primaryError);
                    showToast(getMessage('sp_switching_fallback', 'Model unavailable. Trying backup...'), 'info');

                    // Fallback 1: Step 3.5 Flash (High Uptime)
                    try {
                        return await callOpenRouterAPI(
                            llmConfig.openrouterKey,
                            "stepfun/step-3.5-flash:free",
                            messages,
                            options.generationConfig || {}
                        );
                    } catch (stepError) {
                        console.warn('[ATOM AI] Step 3.5 failed. Trying Gemini Flash Lite...', stepError);

                        // Fallback 2: Gemini Flash Lite
                        try {
                            return await callOpenRouterAPI(
                                llmConfig.openrouterKey,
                                "google/gemini-2.0-flash-lite-preview-02-05:free",
                                messages,
                                options.generationConfig || {}
                            );
                        } catch (geminiError) {
                            console.warn('[ATOM AI] Gemini Flash Lite failed. Trying Mistral...', geminiError);

                            // Fallback 3: Mistral
                            try {
                                return await callOpenRouterAPI(
                                    llmConfig.openrouterKey,
                                    "mistralai/mistral-small-24b-instruct-2501:free",
                                    messages,
                                    options.generationConfig || {}
                                );
                            } catch (finalError) {
                                throw primaryError; // Throw original error if all fail
                            }
                        }
                    }
                }
            } else {
                throw new Error('OpenRouter provider selected but no API Key set.');
            }
        }

        // 2. Default Gemini Mode (with auto-fallback)
        if (!geminiKey) {
            throw new Error('No API key configured');
        }

        try {
            return await callGeminiAPI(geminiKey, systemPrompt, conversationHistory, 1, options);
        } catch (error) {
            // Check for Rate Limit (429) to trigger fallback
            if (error instanceof ApiError && error.status === 429) {
                console.warn('[ATOM AI] Gemini Rate Limited (429). Attempting OpenRouter Fallback...');

                // Fallback Strategy: Use OpenRouter (Step 3.5 -> Gemini Flash Lite -> Mistral)
                if (llmConfig.openrouterKey) {
                    showToast(getMessage('sp_switching_fallback', 'Switching to Step 3.5 Flash (Fallback)...'), 'info');
                    const messages = convertToOpenRouterMessages(systemPrompt, conversationHistory);

                    // Explicitly use Step 3.5 Flash as first choice
                    const fallbackModel = "stepfun/step-3.5-flash:free";

                    try {
                        return await callOpenRouterAPI(
                            llmConfig.openrouterKey,
                            fallbackModel,
                            messages,
                            options.generationConfig || {}
                        );
                    } catch (stepError) {
                        console.warn('[ATOM AI] Step 3.5 Fallback failed, trying Gemini Flash Lite:', stepError);

                        // Second layer: Gemini Flash Lite
                        try {
                            return await callOpenRouterAPI(
                                llmConfig.openrouterKey,
                                "google/gemini-2.0-flash-lite-preview-02-05:free",
                                messages,
                                options.generationConfig || {}
                            );
                        } catch (geminiError) {
                            console.warn('[ATOM AI] Gemini Flash Lite failed, trying Mistral:', geminiError);

                            // Third layer: Mistral
                            try {
                                return await callOpenRouterAPI(
                                    llmConfig.openrouterKey,
                                    "mistralai/mistral-small-24b-instruct-2501:free",
                                    messages,
                                    options.generationConfig || {}
                                );
                            } catch (mistralError) {
                                console.error('[ATOM AI] All fallbacks failed.');
                                throw error; // Throw original Gemini error
                            }
                        }
                    }
                } else {
                    // No OpenRouter Key set - Prompt user?
                    // For now, allow it to fail, but maybe show a helpful toast
                    console.warn('[ATOM AI] No OpenRouter key for fallback.');
                    // Optional: You could implement a public proxy here if you had one, but strict adherence to user rules means we stick to their keys.
                }
            }
            throw error;
        }
    }

    async function callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt = 1, options = {}) {
        const priority = options?.priority === 'background' ? 'background' : 'vip';
        const shouldShowRetryState = priority === 'vip';
        const modelOverride = typeof options?.modelOverride === 'string' ? options.modelOverride : '';
        const modelName = modelOverride || API_CONFIG.MODEL_NAME;

        // Fallback Logic Setup
        let fallbackChain = [];
        if (options?.fallbackChain && Array.isArray(options.fallbackChain)) {
            fallbackChain = options.fallbackChain;
        } else if (!modelOverride && API_CONFIG.FALLBACK_CHAIN && API_CONFIG.FALLBACK_CHAIN.length > 0) {
            // Initial call: load chain from config
            fallbackChain = [...API_CONFIG.FALLBACK_CHAIN];
        } else if (!modelOverride && API_CONFIG.FALLBACK_MODEL) {
            // Legacy single fallback support
            fallbackChain = [API_CONFIG.FALLBACK_MODEL];
        }

        const allowFallback = typeof options?.allowFallback === 'boolean'
            ? options.allowFallback
            : true; // Default to true unless explicitly disabled

        const errorSource = typeof options?.errorSource === 'string'
            ? options.errorSource
            : (priority === 'background' ? 'sidepanel-background' : 'sidepanel-chat');
        const url = `${API_CONFIG.API_BASE}/${modelName}:generateContent?key=${apiKey}`;
        const rateManager = window.RateLimitManager
            ? (window.__ATOM_RATE_MANAGER__ || (window.__ATOM_RATE_MANAGER__ = new window.RateLimitManager({
                rpmTotal: 15,
                rpmBackground: 8,
                cacheTtlMs: API_CONFIG.CACHE.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000
            })))
            : null;
        const vipCacheEnabled = API_CONFIG.CACHE?.VIP_CACHE_ENABLED === true;
        let cacheKey = typeof options?.cacheKey === 'string' ? options.cacheKey : '';
        let cacheTtlMs = Number.isFinite(options?.cacheTtlMs) ? options.cacheTtlMs : undefined;

        if (priority === 'vip' && !vipCacheEnabled) {
            cacheKey = '';
            cacheTtlMs = 0;
        } else if (cacheKey && !Number.isFinite(cacheTtlMs)) {
            cacheTtlMs = API_CONFIG.CACHE.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000;
        }

        const rateOptions = {
            priority,
            cacheKey,
            cacheTtlMs
        };
        if (typeof options?.allowDuringCooldown === 'boolean') {
            rateOptions.allowDuringCooldown = options.allowDuringCooldown;
        }
        // Default background jobs to skip during cooldown to prevent infinite retry loop
        if (typeof options?.skipDuringCooldown === 'boolean') {
            rateOptions.skipDuringCooldown = options.skipDuringCooldown;
        } else if (priority === 'background') {
            rateOptions.skipDuringCooldown = true; // Auto-skip background jobs during cooldown
        }

        const generationConfig = {
            temperature: 0.7,
            maxOutputTokens: 8192,
            ...(options && typeof options.generationConfig === 'object'
                ? options.generationConfig
                : {})
        };

        const body = {
            contents: conversationHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig
        };

        try {
            const runRequest = async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return response;
                } catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                }
            };

            const response = rateManager
                ? await rateManager.enqueue(runRequest, rateOptions)
                : await runRequest();

            if (!response.ok) {
                const errorData = await parseApiError(response);
                if (response.status === 429 && rateManager) {
                    rateManager.record429Error(errorSource);
                    // Use standard rate limit handling/cooldown even if falling back
                    const retryAfterHeader = response.headers.get('Retry-After');
                    const retryAfterHeaderSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
                    const retryAfterSeconds = window.parseRetryAfterSeconds
                        ? window.parseRetryAfterSeconds(errorData.message)
                        : null;
                    const retrySeconds = Number.isFinite(retryAfterHeaderSeconds)
                        ? retryAfterHeaderSeconds
                        : retryAfterSeconds;

                    if (Number.isFinite(retrySeconds)) {
                        const cooldownMs = (retrySeconds + 1) * 1000;
                        rateManager.setCooldown(cooldownMs, 'sidepanel-429');
                        // Only show toast if NOT falling back (fallback happens silently/quickly)
                        if (!allowFallback || fallbackChain.length === 0) {
                            const seconds = Math.ceil(cooldownMs / 1000);
                            const msg = typeof getMessage === 'function'
                                ? getMessage('sp_rate_limit_cooldown', `Rate limit exceeded. Waiting ${seconds}s...`)
                                : `Rate limit exceeded. Waiting ${seconds}s...`;
                            showToast(msg, 'warning');
                        }
                    }
                }

                if (response.status >= 500 && rateManager) {
                    rateManager.recordServerError();
                }

                // FALLBACK LOGIC (CHAIN)
                if ((response.status === 429 || response.status >= 500) && allowFallback) {
                    if (fallbackChain.length > 0) {
                        const nextModel = fallbackChain[0];
                        const remainingChain = fallbackChain.slice(1);
                        console.log(`[ATOM AI] ${response.status} received. Falling back to: ${nextModel}. Remaining: ${remainingChain.length}`);

                        if (rateManager) rateManager.recordFallback();

                        return callGeminiAPI(apiKey, systemPrompt, conversationHistory, 1, {
                            ...options,
                            priority,
                            modelOverride: nextModel,
                            fallbackChain: remainingChain, // Pass remaining chain
                            allowFallback: true, // Keep allowing fallback until chain empty
                            // Allow next call to bypass cooldown of *this* model (since it's a diff model)
                            // Note: RateManager tracks global domain cooldown. We might need to implement per-model tracking later.
                            // For now, assume changing model helps.
                            skipDuringCooldown: false,
                            allowDuringCooldown: true
                        });
                    } else {
                        console.warn('[ATOM AI] Fallback chain exhausted.');
                    }
                }

                // Check if error is retryable (only if NOT falling back or chain exhausted)
                if (isRetryableError(response.status) && attempt < API_CONFIG.RETRY_MAX_ATTEMPTS) {
                    if (rateManager && rateManager.isInCooldown()) {
                        console.log('[API] In cooldown, aborting retry to prevent infinite loop');
                        if (shouldShowRetryState) clearRetryingState();
                        throw new ApiError(
                            'Rate limit cooldown active. Please wait before retrying.',
                            response.status,
                            'COOLDOWN_ACTIVE'
                        );
                    }

                    const delay = calculateRetryDelay(attempt);
                    console.log(`[API] Retry attempt ${attempt + 1} after ${delay}ms`);
                    showRetryNotification(attempt, API_CONFIG.RETRY_MAX_ATTEMPTS, priority);
                    if (rateManager) {
                        rateManager.recordRetry();
                    }
                    await sleep(delay);
                    return callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt + 1, options);
                }

                if (shouldShowRetryState) {
                    clearRetryingState();
                }
                throw new ApiError(errorData.message, response.status, errorData.code);
            }

            if (shouldShowRetryState) {
                clearRetryingState();
            }
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (error) {
            // Handle network errors with retry
            // Similar fallback could apply to network errors if we wanted, but usually network is global.
            if (isNetworkError(error) && attempt < API_CONFIG.RETRY_MAX_ATTEMPTS) {
                if (rateManager && rateManager.isInCooldown()) {
                    console.log('[API] In cooldown, aborting network retry to prevent infinite loop');
                    if (shouldShowRetryState) clearRetryingState();
                    throw error;
                }

                const delay = calculateRetryDelay(attempt);
                console.log(`[API] Network error, retry attempt ${attempt + 1} after ${delay}ms`);
                showRetryNotification(attempt, API_CONFIG.RETRY_MAX_ATTEMPTS, priority);
                if (rateManager) {
                    rateManager.recordRetry();
                }
                await sleep(delay);
                return callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt + 1, options);
            }

            if (shouldShowRetryState) {
                clearRetryingState();
            }
            throw error;
        }
    }

    // ===========================
    // Error Handling Utilities
    // ===========================
    class ApiError extends Error {
        constructor(message, status, code) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = code;
        }
    }

    async function parseApiError(response) {
        try {
            const data = await response.json();
            const error = data.error || {};
            return {
                message: error.message || getStatusMessage(response.status),
                code: error.code || response.status,
                status: response.status
            };
        } catch (e) {
            return {
                message: getStatusMessage(response.status),
                code: response.status,
                status: response.status
            };
        }
    }

    function getStatusMessage(status) {
        const messages = {
            400: getMessage('sp_error_bad_request', 'Invalid request'),
            401: getMessage('sp_error_unauthorized', 'API key is invalid'),
            403: getMessage('sp_error_forbidden', 'Access denied'),
            404: getMessage('sp_error_not_found', 'API endpoint not found'),
            429: getMessage('sp_error_rate_limit', 'Too many requests. Please wait.'),
            500: getMessage('sp_error_server', 'Server error. Try again later.'),
            502: getMessage('sp_error_server', 'Server error. Try again later.'),
            503: getMessage('sp_error_unavailable', 'Service unavailable. Try again later.'),
            504: getMessage('sp_error_timeout', 'Request timed out. Try again.')
        };
        return messages[status] || getMessage('sp_error_unknown', 'An error occurred');
    }

    function isRetryableError(status) {
        // Retry on server errors and rate limits
        return status >= 500 || status === 429;
    }

    function isNetworkError(error) {
        return error.name === 'AbortError' ||
            error.name === 'TypeError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError');
    }

    function calculateRetryDelay(attempt) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        return API_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showRetryingState(attempt, maxAttempts) {
        if (!elements.contextText || !elements.contextStatus) return;

        if (!retryingState.active) {
            retryingState.active = true;
            retryingState.previousText = elements.contextText.textContent || '';
            retryingState.previousStatusClass = elements.contextStatus.className || 'status-dot';
        }

        const retryMsg = getMessage('sp_retrying', 'Retrying');
        elements.contextText.textContent = `${retryMsg} (${attempt}/${maxAttempts})...`;
        elements.contextText.classList.add('status-retrying');
        elements.contextStatus.className = 'status-dot loading';
    }

    function clearRetryingState() {
        if (!retryingState.active) return;
        if (elements.contextText) {
            elements.contextText.classList.remove('status-retrying');
            if (retryingState.previousText) {
                elements.contextText.textContent = retryingState.previousText;
            }
        }
        if (elements.contextStatus && retryingState.previousStatusClass) {
            elements.contextStatus.className = retryingState.previousStatusClass;
        }
        retryingState = {
            active: false,
            previousText: '',
            previousStatusClass: ''
        };
    }

    function showRetryNotification(attempt, maxAttempts, priority) {
        if (priority === 'vip') {
            showRetryingState(attempt, maxAttempts);
        }
        const retryMsg = getMessage('sp_retrying', 'Retrying');
        showToast(`${retryMsg} (${attempt}/${maxAttempts})...`, 'info');
    }

    // ===========================
    // Rate Limit Countdown Display
    // ===========================
    let rateLimitCountdownInterval = null;

    function showRateLimitCountdown(seconds) {
        // Clear any existing countdown
        clearRateLimitCountdown();

        if (!elements.contextText || !elements.contextStatus) return;

        // Save previous state
        const previousText = elements.contextText.textContent || '';
        const previousStatusClass = elements.contextStatus.className || 'status-dot';

        // Set initial countdown display
        let remaining = Math.ceil(seconds);
        const updateDisplay = () => {
            const waitMsg = getMessage('sp_rate_limit_countdown', 'Retry in');
            elements.contextText.textContent = `${waitMsg} ${remaining}s...`;
            elements.contextText.classList.add('status-cooldown');
            elements.contextStatus.className = 'status-dot cooldown';
        };

        updateDisplay();

        // Show toast with wait time
        const toastMsg = getMessage('sp_rate_limit_wait', 'Rate limit reached. Please wait');
        showToast(`${toastMsg} ${remaining}s`, 'warning');

        // Start countdown
        rateLimitCountdownInterval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearRateLimitCountdown();
                // Restore previous state
                elements.contextText.textContent = previousText || getMessage('sp_ready', 'Ready');
                elements.contextText.classList.remove('status-cooldown');
                elements.contextStatus.className = previousStatusClass;
                showToast(getMessage('sp_rate_limit_ready', 'Ready to continue'), 'success');
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    function clearRateLimitCountdown() {
        if (rateLimitCountdownInterval) {
            clearInterval(rateLimitCountdownInterval);
            rateLimitCountdownInterval = null;
        }
        if (elements.contextText) {
            elements.contextText.classList.remove('status-cooldown');
        }
        if (elements.contextStatus) {
            elements.contextStatus.classList.remove('cooldown');
        }
    }

    // ===========================
    // Undo System
    // ===========================


    /**
     * Create an undoable action
     * @param {string} type - Action type (e.g., 'park_thread', 'delete_note', 'clear_chat')
     * @param {string} message - Message to show in toast
     * @param {object} data - Data needed to undo the action
     * @param {function} undoFn - Function to call when undoing
     * @param {function} commitFn - Function to call when action is committed (optional)
     */
    function createUndoableAction(type, message, data, undoFn, commitFn = null) {
        // Cancel any existing undo toast
        cancelActiveUndo();

        const action = {
            id: `undo_${Date.now()}`,
            type,
            message,
            data,
            undoFn,
            commitFn,
            createdAt: Date.now(),
            timeoutId: null
        };

        // Set timeout for auto-commit
        action.timeoutId = setTimeout(() => {
            commitAction(action);
        }, UNDO_TIMEOUT_MS);

        undoStack.push(action);
        showUndoToast(action);

        return action;
    }

    function showUndoToast(action) {
        // Remove existing undo toast
        document.getElementById('undo-toast')?.remove();

        const toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'sp-undo-toast';

        const undoLabel = getMessage('sp_undo', 'Undo');

        toast.innerHTML = `
            <div class="sp-undo-content">
                <span class="sp-undo-icon">✓</span>
                <span class="sp-undo-message">${escapeHtml(action.message)}</span>
            </div>
            <div class="sp-undo-actions">
                <button class="sp-undo-btn" id="btn-undo">${undoLabel}</button>
                <div class="sp-undo-countdown">
                    <svg class="sp-countdown-ring" viewBox="0 0 20 20">
                        <circle class="sp-countdown-bg" cx="10" cy="10" r="8"/>
                        <circle class="sp-countdown-progress" cx="10" cy="10" r="8"/>
                    </svg>
                    <span class="sp-countdown-text" id="undo-countdown">5</span>
                </div>
            </div>
        `;

        document.body.appendChild(toast);
        activeUndoToast = toast;

        // Add undo button handler
        toast.querySelector('#btn-undo')?.addEventListener('click', () => {
            undoAction(action);
        });

        // Start countdown animation
        startCountdownAnimation(action);
    }

    function startCountdownAnimation(action) {
        const countdownText = document.getElementById('undo-countdown');
        const progressCircle = document.querySelector('.sp-countdown-progress');

        if (!countdownText || !progressCircle) return;

        // Set up the countdown ring animation
        const circumference = 2 * Math.PI * 8; // r=8
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = 0;

        let remainingSeconds = 5;

        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (countdownText) {
                countdownText.textContent = remainingSeconds;
            }

            // Update circle progress
            const progress = (5 - remainingSeconds) / 5;
            if (progressCircle) {
                progressCircle.style.strokeDashoffset = circumference * progress;
            }

            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);

        // Store interval ID for cleanup
        action.countdownInterval = countdownInterval;
    }

    function undoAction(action) {
        // Clear the timeout
        if (action.timeoutId) {
            clearTimeout(action.timeoutId);
        }
        if (action.countdownInterval) {
            clearInterval(action.countdownInterval);
        }

        // Remove from stack
        undoStack = undoStack.filter(a => a.id !== action.id);

        // Execute undo function
        if (action.undoFn) {
            action.undoFn(action.data);
        }

        // Remove toast
        hideUndoToast();

        // Show confirmation
        const undoneMsg = getMessage('sp_action_undone', 'Action undone');
        showToast(undoneMsg, 'success');
    }

    function commitAction(action) {
        // Clear intervals
        if (action.countdownInterval) {
            clearInterval(action.countdownInterval);
        }

        // Remove from stack
        undoStack = undoStack.filter(a => a.id !== action.id);

        // Execute commit function if provided
        if (action.commitFn) {
            action.commitFn(action.data);
        }

        // Remove toast
        hideUndoToast();
    }

    function cancelActiveUndo() {
        // Cancel all pending undo actions
        undoStack.forEach(action => {
            if (action.timeoutId) {
                clearTimeout(action.timeoutId);
            }
            if (action.countdownInterval) {
                clearInterval(action.countdownInterval);
            }
            // Commit the action immediately
            if (action.commitFn) {
                action.commitFn(action.data);
            }
        });
        undoStack = [];
        hideUndoToast();
    }

    function hideUndoToast() {
        const toast = document.getElementById('undo-toast');
        if (toast) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 200);
        }
        activeUndoToast = null;
    }

    function undoLastAction() {
        if (undoStack.length === 0) {
            showToast(getMessage('sp_nothing_to_undo', 'Nothing to undo'), 'info');
            return;
        }

        // Get the most recent action
        const lastAction = undoStack[undoStack.length - 1];
        undoAction(lastAction);
    }

    // ===========================
    // UI Helpers
    // ===========================
    function addMessageToDOM(content, type) {
        if (!elements.messages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `sp-message ${type}`;

        if (type === 'assistant') {
            msgDiv.innerHTML = formatMessage(content);
        } else {
            msgDiv.textContent = content;
        }

        elements.messages.appendChild(msgDiv);
        scrollToBottom();
    }

    function formatMessage(text) {
        let formatted = escapeHtml(text);

        // Code blocks
        formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Bullet points
        formatted = formatted.replace(/^[•\-\*]\s+(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function showTypingIndicator() {
        if (!elements.messages) return;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'sp-typing';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        elements.messages.appendChild(typingDiv);
        scrollToBottom();
    }

    function hideTypingIndicator() {
        document.getElementById('typing-indicator')?.remove();
    }

    function scrollToBottom() {
        if (elements.messages) {
            elements.messages.scrollTop = elements.messages.scrollHeight;
        }
    }

    function setContextStatus(status, text) {
        if (!elements.contextStatus) return;
        elements.contextStatus.className = 'status-dot';
        if (status === 'ready') elements.contextStatus.classList.add('ready');
        else if (status === 'loading') elements.contextStatus.classList.add('loading');
        if (elements.contextText) elements.contextText.textContent = text;
    }

    function setLoading(loading) {
        isLoading = loading;
        updateSendButton();
        if (elements.userInput) elements.userInput.disabled = loading;
    }

    function updateSendButton() {
        if (elements.sendBtn) {
            elements.sendBtn.disabled = isLoading || !elements.userInput?.value?.trim();
        }
    }

    function clearCurrentThread() {
        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread || thread.messages.length === 0) return;

        const previousMessages = [...thread.messages];

        // Clear immediately (optimistic update)
        thread.messages = [];
        renderActiveThread();

        const clearedMsg = getMessage('sp_chat_cleared', 'Chat cleared');
        createUndoableAction(
            'clear_chat',
            clearedMsg,
            { threadId: thread.id, previousMessages },
            // Undo function
            (data) => {
                const t = threads.find(th => th.id === data.threadId);
                if (t) {
                    t.messages = data.previousMessages;
                    saveThreadsToStorage();
                    renderActiveThread();
                }
            },
            // Commit function
            (data) => {
                saveThreadsToStorage();
            }
        );
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Legacy function - now uses updateAllCounts
    function updateSessionStats() {
        updateAllCounts();
    }

    function startSessionTimer() {
        if (sessionTimer) clearInterval(sessionTimer);
        sessionTimer = setInterval(() => {
            updateTimer();
        }, 60000); // Update every minute
    }

    // ===========================
    // Parking Lot System
    // ===========================
    async function loadParkingLot() {
        if (!currentDomain) return;
        const key = `atom_parking_lot_${currentDomain}`;
        const data = await chrome.storage.local.get([key]);
        parkingLot = data[key] || [];
        renderParkingLot();
    }

    async function saveParkingLot() {
        if (!currentDomain) return;
        const key = `atom_parking_lot_${currentDomain}`;
        await chrome.storage.local.set({ [key]: parkingLot });
    }

    function addToParkingLot(idea) {
        const item = {
            id: `park_${Date.now()}`,
            text: idea,
            threadId: activeThreadId,
            createdAt: Date.now()
        };
        parkingLot.push(item);
        saveParkingLot();
        renderParkingLot();
        updateSessionStats();
    }

    function removeFromParkingLot(itemId, withUndo = true) {
        const item = parkingLot.find(p => p.id === itemId);
        if (!item) return;

        const itemIndex = parkingLot.indexOf(item);

        // Remove immediately (optimistic update)
        parkingLot = parkingLot.filter(p => p.id !== itemId);
        renderParkingLot();
        updateSessionStats();

        if (withUndo) {
            const deletedMsg = getMessage('sp_note_deleted', 'Note deleted');
            createUndoableAction(
                'delete_note',
                deletedMsg,
                { item, index: itemIndex },
                // Undo function
                (data) => {
                    // Restore the note at its original position
                    parkingLot.splice(data.index, 0, data.item);
                    saveParkingLot();
                    renderParkingLot();
                    updateSessionStats();
                },
                // Commit function
                (data) => {
                    saveParkingLot();
                }
            );
        } else {
            saveParkingLot();
        }
    }

    function renderParkingLot() {
        // Update notes count in tab badge
        if (elements.notesCount) {
            elements.notesCount.textContent = parkingLot.length;
        }

        if (!elements.notesList) return;

        if (parkingLot.length === 0) {
            const emptyMsg = getMessage('sp_quick_note_empty', 'No notes yet');
            elements.notesList.innerHTML = `<div class="sp-note-empty">${emptyMsg}</div>`;
            return;
        }

        elements.notesList.innerHTML = parkingLot.map(item => `
            <div class="sp-note-item" data-id="${item.id}">
                <div class="sp-note-text">${escapeHtml(item.text)}</div>
                <div class="sp-note-actions">
                    <button class="sp-note-btn" data-action="promote" title="Convert to discussion">${getIcon('promote')}</button>
                    <button class="sp-note-btn" data-action="remove" title="Remove">${getIcon('remove')}</button>
                </div>
            </div>
        `).join('');

        // Add event handlers
        elements.notesList.querySelectorAll('.sp-note-item').forEach(item => {
            const id = item.dataset.id;

            item.querySelector('[data-action="promote"]')?.addEventListener('click', () => {
                promoteFromParkingLot(id);
            });

            item.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
                removeFromParkingLot(id);
            });
        });

        updateAllCounts();
    }

    function promoteFromParkingLot(itemId) {
        const item = parkingLot.find(p => p.id === itemId);
        if (!item) return;

        // Create a new thread from parked idea
        const newThread = {
            id: `thread_${Date.now()}`,
            highlight: {
                text: item.text,
                url: pageContext?.url,
                title: pageContext?.title,
                domain: currentDomain,
                timestamp: Date.now()
            },
            messages: [],
            connections: [],
            status: 'active',
            createdAt: Date.now(),
            promotedFromParking: true
        };

        threads.push(newThread);
        activeThreadId = newThread.id;

        removeFromParkingLot(itemId, false); // Don't trigger undo for promote action
        saveThreadsToStorage();
        renderThreadList();
        renderActiveThread();
    }

    function parkCurrentThread() {
        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        const previousStatus = thread.status;

        // Apply the change immediately (optimistic update)
        thread.status = 'parked';
        renderThreadList();
        updateSessionStats();

        // Create undoable action
        const doneMsg = getMessage('sp_marked_done', 'Marked as done');
        createUndoableAction(
            'park_thread',
            doneMsg,
            { threadId: thread.id, previousStatus },
            // Undo function
            (data) => {
                const t = threads.find(th => th.id === data.threadId);
                if (t) {
                    t.status = data.previousStatus;
                    saveThreadsToStorage();
                    renderThreadList();
                    renderActiveThread();
                    updateSessionStats();
                }
            },
            // Commit function
            (data) => {
                saveThreadsToStorage();
            }
        );
    }

    // ===========================
    // NotebookLM Bridge Integration
    // ===========================

    // Flag to prevent multiple insight generations (defined at top scope)

    /**
     * Generate Atomic Thought - Distill thread conversation into one insight
     */
    async function makeAtomicThought() {
        if (!pageContext?.url) {
            showToast(getMessage('sp_page_read_failed', 'Failed to read page'), 'error');
            return;
        }

        // Allow creating a Key Insight without requiring a highlight first.
        // If there is no active thread, create a page-level discussion thread.
        if (!activeThreadId) {
            const newThread = {
                id: `thread_${Date.now()}`,
                highlight: {
                    text: getMessage('sp_page_discussion', 'Page Discussion'),
                    url: pageContext?.url,
                    title: pageContext?.title
                },
                messages: [],
                status: 'active',
                isPageDiscussion: true,
                createdAt: Date.now()
            };
            threads.push(newThread);
            activeThreadId = newThread.id;
            renderThreadList();
            renderActiveThread();
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        const llmConfig = await getLLMProvider();
        const geminiKey = await getApiKey();
        const hasProviderKey = llmConfig.provider === 'openrouter'
            ? !!llmConfig.openrouterKey
            : !!geminiKey;
        if (!hasProviderKey) {
            showToast(getMessage('sp_error_no_api_key', 'API key not set'), 'error');
            return;
        }

        const isPageDiscussion = !!thread.isPageDiscussion;
        const highlightText = isPageDiscussion ? '' : (thread.highlight?.text || '');
        const conversationLog = thread.messages.map(m =>
            `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`
        ).join('\n\n');

        const pageExcerpt = (pageContext?.content || '').slice(0, 6000);

        if (!highlightText && !conversationLog && !pageExcerpt) {
            showToast(getMessage('sp_no_content', 'No content to distill.'), 'warning');
            return;
        }

        if (isGeneratingInsight) return;
        isGeneratingInsight = true;
        showAtomicThoughtLoading();

        const parseAtomicThoughtPayload = (rawText) => {
            if (!rawText || typeof rawText !== 'string') return null;
            const stripped = rawText
                .replace(/```(?:json)?\s*/gi, '')
                .replace(/```/g, '')
                .trim();

            const match = stripped.match(/\{[\s\S]*\}/);
            const candidate = (match ? match[0] : stripped).trim();
            if (!candidate.startsWith('{')) return null;

            const tryParse = (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return null;
                }
            };

            let parsed = tryParse(candidate);
            if (!parsed) {
                const fixed = candidate
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                parsed = tryParse(fixed);
            }

            if (!parsed || typeof parsed !== 'object') return null;
            const insight = typeof parsed.insight === 'string' ? parsed.insight : '';
            const category = typeof parsed.category === 'string' ? parsed.category : '';
            if (!insight && !category) return null;
            return { insight, category };
        };

        const normalizeInsightText = (text) => {
            const s = String(text || '').trim();
            if (!s) return '';
            const parsed = parseAtomicThoughtPayload(s);
            return String(parsed?.insight || s).trim();
        };

        const systemPrompt = `You are a knowledge distillation expert. Respond with valid JSON only. Language: ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}`;
        const prompt = `Analyze this page/thread and create ONE atomic thought + a broad category.

        ${highlightText ? `HIGHLIGHTED TEXT:\n"${highlightText.slice(0, 1200)}"\n` : ''}
        ${pageExcerpt ? `PAGE EXCERPT:\n"""${pageExcerpt}"""\n` : ''}
        ${conversationLog ? `DISCUSSION:\n${conversationLog.slice(0, 2500)}` : ''}

        Return JSON format:
        {
          "insight": "Your single, self-contained atomic thought (max 3 sentences)",
          "category": "One broad category (e.g., Technology, Health, Education, Business, Science, Lifestyle)"
        }`;

        try {
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callLLMAPI(systemPrompt, conversationHistory, {
                priority: 'vip',
                allowFallback: true,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 512
                }
            });

            const parsed = parseAtomicThoughtPayload(response || '');
            const atomicThought = normalizeInsightText(parsed?.insight || response || '');
            const category = String(parsed?.category || '').trim() || 'Other';

            if (atomicThought) {
                // If user triggers Key Insight, ensure the box is visible.
                isInsightDisplayHidden = false;
                chrome.storage.local.set({ sp_insight_display_hidden: false });

                thread.refinedInsight = atomicThought;
                thread.category = category; // Save to thread model
                await saveThreadsToStorage();
                renderAtomicThought(atomicThought);

                // Save Key Insight to local Memory immediately.
                // Using 'sidepanel_thread' command to OVERWRITE/UPDATE the same memory entry
                // instead of creating a duplicate with 'sidepanel_key_insight'.
                try {
                    const isPageDiscussion = !!thread.isPageDiscussion;
                    const note = {
                        id: thread.id,
                        command: "sidepanel_thread", // Consolidated command
                        url: thread.highlight?.url || pageContext?.url || "",
                        title: thread.highlight?.title || pageContext?.title || "",
                        selection: isPageDiscussion ? "" : (thread.highlight?.text || ""),
                        atomicThought: atomicThought,
                        refinedInsight: atomicThought,
                        category: category,
                        tags: category ? [category] : [], // Also add category as tag
                        created_at: thread.createdAt || Date.now(),
                        source: "sidepanel"
                    };
                    await chrome.runtime.sendMessage({ type: "ATOM_UPSERT_MEMORY_NOTE", payload: note });

                    showToast(`Insight saved! (${category})`, 'success');
                } catch (e) {
                    console.warn("[Memory] Failed to save key insight:", e);
                }

                // Sync insight to ReadingSession
                if (activeSessionId && typeof ReadingSessionService !== 'undefined') {
                    try {
                        await ReadingSessionService.addInsight(activeSessionId, atomicThought, 'thread');
                        console.log('[ReadingSession] Synced insight to session:', activeSessionId);
                    } catch (e) {
                        console.error('[ReadingSession] Insight sync error:', e);
                    }
                }

            } else {
                showToast(getMessage('sp_error_empty_response', 'No response received'), 'warning');
            }
        } catch (e) {
            console.error('[Atomic] Error:', e);
            const errorInfo = getErrorInfo(e);
            showToast(errorInfo.title, 'error');
        } finally {
            hideAtomicThoughtLoading();
            isGeneratingInsight = false;
        }
    }

    function showAtomicThoughtLoading() {
        const btn = document.getElementById('btn-key-insight');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('sp-action-loading');
            btn.setAttribute('aria-busy', 'true');
        }
    }

    function hideAtomicThoughtLoading() {
        const btn = document.getElementById('btn-key-insight');
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('sp-action-loading');
            btn.setAttribute('aria-busy', 'false');
        }
    }

    function renderAtomicThought(thought) {
        // Keep the latest insight text, but respect user's hide/show preference.
        if (elements.insightText) {
            elements.insightText.textContent = extractInsightTextFromMaybeJson(thought);
        }
        if (elements.insightDisplay) {
            elements.insightDisplay.classList.toggle('active', !isInsightDisplayHidden);
        }
        const thread = threads.find(t => t.id === activeThreadId);
        updateInsightToggleButton(thread);

        // Update insights summary
        renderInsightsSummary();
        updateAllCounts();
    }

    async function maybeAddInsightReviewCard(thread) {
        if (!window.FlashcardDeck) return;
        if (!thread) return;

        const insightText = String(thread.refinedInsight || '').trim();
        if (!insightText) return;

        try {
            const cards = await window.FlashcardDeck.getAllCards();
            const exists = cards.some(card => card?.sourceInsightId === thread.id);
            if (exists) return;

            const title = thread.highlight?.title || pageContext?.title || '';
            const isVi = navigator.language.startsWith('vi');
            const front = title
                ? (isVi ? `Y chinh tu "${title}" la gi?` : `What is the key insight from "${title}"?`)
                : (isVi ? 'Y chinh la gi?' : 'What is the key insight?');

            const card = window.FlashcardDeck.createFlashcard({
                type: window.FlashcardDeck.CARD_TYPES.INSIGHT,
                front,
                back: insightText,
                sourceInsightId: thread.id,
                sourceUrl: thread.highlight?.url || pageContext?.url || '',
                sourceTitle: title
            });
            await window.FlashcardDeck.saveCard(card);
        } catch (e) {
            console.warn('[Retention] Failed to add insight card:', e);
        }
    }

    /**
     * Save current thread to NotebookLM via Bridge
     */
    async function saveThreadToNLM() {
        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        // Build discussion summary from messages
        let discussionSummary = '';
        if (thread.messages.length > 0) {
            discussionSummary = thread.messages.map(m =>
                `${m.role === 'user' ? '👤' : '🤖'} ${m.content.slice(0, 500)}`
            ).join('\n\n');
        }

        // Build note object for bridge service
        const note = {
            id: thread.id,
            url: thread.highlight?.url || pageContext?.url || '',
            title: thread.highlight?.title || pageContext?.title || '',
            selection: thread.highlight?.text || '',
            atomicThought: thread.refinedInsight || '',
            aiDiscussionSummary: discussionSummary,
            refinedInsight: thread.refinedInsight || '',
            connections: thread.connections || [],
            created_at: thread.createdAt,
            command: 'sidepanel_thread',
            tags: []
        };

        try {
            // Send to background for NLM processing
            const response = await chrome.runtime.sendMessage({
                type: 'ATOM_SAVE_THREAD_TO_NLM',
                payload: note
            });

            if (response?.ok) {
                thread.status = 'saved';
                thread.nlmExported = true;
                thread.nlmExportedAt = Date.now();
                await saveThreadsToStorage();
                renderThreadList();
                updateSessionStats();

                await maybeAddInsightReviewCard(thread);
                showToast(getMessage('sp_toast_saved', 'Saved to Knowledge!'), 'success');
                checkAndShowContextualTooltip('first_save');
            } else {
                if (response?.savedToMemory) {
                    await maybeAddInsightReviewCard(thread);
                    showToast(getMessage('sp_toast_saved_local', 'Saved locally. Cloud export blocked.'), 'info');
                    checkAndShowContextualTooltip('first_save');
                } else {
                    const failure = getNlmExportFailureToast(response?.reason || response?.error);
                    showToast(failure.message, failure.type);
                }
            }
        } catch (e) {
            console.error('[NLM] Save error:', e);
            showToast(getMessage('sp_nlm_save_error', 'Error saving to NotebookLM'), 'error');
        }
    }

    /**
     * Export all threads to NotebookLM
     */
    async function exportAllToNLM() {
        if (threads.length === 0) {
            alert('No threads to export.');
            return;
        }

        const unsavedThreads = threads.filter(t => t.status !== 'saved');
        if (unsavedThreads.length === 0) {
            alert('All threads already saved.');
            return;
        }

        const confirmMsg = getMessage('sp_confirm_export_all', 'Save all discussions to Knowledge?');
        const confirm = window.confirm(
            `${confirmMsg}\n(${unsavedThreads.length} discussions)`
        );
        if (!confirm) return;

        showExportAllLoading();

        let successCount = 0;
        let failCount = 0;

        for (const thread of unsavedThreads) {
            try {
                const note = {
                    id: thread.id,
                    url: thread.highlight?.url || pageContext?.url || '',
                    title: thread.highlight?.title || pageContext?.title || '',
                    selection: thread.highlight?.text || '',
                    atomicThought: thread.refinedInsight || '',
                    aiDiscussionSummary: thread.messages.length > 0 ?
                        thread.messages.map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n') : '',
                    refinedInsight: thread.refinedInsight || '',
                    connections: thread.connections || [],
                    created_at: thread.createdAt,
                    command: 'sidepanel_bulk_export'
                };

                const response = await chrome.runtime.sendMessage({
                    type: 'ATOM_SAVE_THREAD_TO_NLM',
                    payload: note
                });

                if (response?.ok) {
                    thread.status = 'saved';
                    thread.nlmExported = true;
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
        }

        await saveThreadsToStorage();
        renderThreadList();
        updateSessionStats();
        hideExportAllLoading();

        showToast(`Exported: ${successCount} success, ${failCount} failed`,
            failCount === 0 ? 'success' : 'warning');
        if (successCount > 0) {
            checkAndShowContextualTooltip('first_save');
        }
    }

    function showExportAllLoading() {
        const btn = document.getElementById('btn-export-all-nlm');
        if (btn) {
            btn.disabled = true;
            const exportingMsg = getMessage('sp_exporting', 'Exporting...');
            btn.innerHTML = `<span class="btn-spinner"></span> ${exportingMsg}`;
        }
    }

    function hideExportAllLoading() {
        const btn = document.getElementById('btn-export-all-nlm');
        if (btn) {
            btn.disabled = false;
            const saveAllLabel = getMessage('sp_btn_save_all_knowledge', 'Save All to Knowledge');
            btn.innerHTML = `📚 ${saveAllLabel}`;
        }
    }

    function showToast(message, type = 'info') {
        // Remove existing toast
        document.getElementById('sp-toast')?.remove();

        const toast = document.createElement('div');
        toast.id = 'sp-toast';
        toast.className = `sp-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto remove after 3s
        setTimeout(() => toast.remove(), 3000);
    }

    // ===========================
    // Session Dump / Export
    // ===========================
    async function generateSessionSummary() {
        const apiKey = await getApiKey();
        if (!apiKey || threads.length === 0) return null;

        const allHighlights = threads.map((t, idx) =>
            `[${idx + 1}] "${t.highlight?.text?.slice(0, 300) || 'N/A'}"`
        ).join('\n\n');

        const prompt = `Summarize this reading session. The user highlighted these passages from "${pageContext?.title || 'a web page'}":

${allHighlights}

Provide:
1. Main themes/topics discovered (2-3 bullet points)
2. Key insights from the session (2-3 bullet points)
3. Suggested next steps or questions to explore

Be concise. Respond in ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}.`;

        try {
            const url = `${API_CONFIG.API_BASE}/${API_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error('[Session] Summary error:', e);
            return null;
        }
    }

    // ===========================
    // Export Dialog & Multiple Formats
    // ===========================
    function showExportDialog() {
        if (threads.length === 0 && parkingLot.length === 0) {
            showToast(getMessage('sp_export_empty', 'Nothing to export'), 'info');
            return;
        }

        // Remove existing dialog
        document.getElementById('export-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'export-dialog';
        dialog.className = 'sp-welcome-overlay';

        const dialogTitle = getMessage('sp_export_title', 'Download Notes');
        const formatLabel = getMessage('sp_export_format', 'Format:');
        const contentLabel = getMessage('sp_export_content', 'Include:');
        const btnCancel = getMessage('sp_export_cancel', 'Cancel');
        const btnExport = getMessage('sp_export_download', 'Download');

        dialog.innerHTML = `
            <div class="sp-export-card">
                <div class="sp-export-header">
                    <h3>📥 ${dialogTitle}</h3>
                </div>

                <div class="sp-export-body">
                    <div class="sp-export-section">
                        <label class="sp-export-label">${formatLabel}</label>
                        <div class="sp-export-formats">
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="markdown" checked>
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">📝</span>
                                    <span class="sp-format-name">Markdown</span>
                                    <span class="sp-format-ext">.md</span>
                                </span>
                            </label>
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="json">
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">📦</span>
                                    <span class="sp-format-name">JSON</span>
                                    <span class="sp-format-ext">.json</span>
                                </span>
                            </label>
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="text">
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">📄</span>
                                    <span class="sp-format-name">Plain Text</span>
                                    <span class="sp-format-ext">.txt</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="sp-export-section">
                        <label class="sp-export-label">${contentLabel}</label>
                        <div class="sp-export-options">
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-insights" checked>
                                <span>💡 ${getMessage('sp_export_opt_insights', 'Key Insights')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-notes" checked>
                                <span>📝 ${getMessage('sp_export_opt_notes', 'Quick Notes')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-chat">
                                <span>💬 ${getMessage('sp_export_opt_chat', 'Full Chat History')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-source" checked>
                                <span>🔗 ${getMessage('sp_export_opt_source', 'Source Info')}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="sp-export-footer">
                    <button class="sp-welcome-btn secondary" id="btn-export-cancel">${btnCancel}</button>
                    <button class="sp-welcome-btn primary" id="btn-export-confirm">${btnExport}</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        document.getElementById('btn-export-cancel')?.addEventListener('click', () => {
            closeExportDialog();
        });

        document.getElementById('btn-export-confirm')?.addEventListener('click', () => {
            const format = document.querySelector('input[name="export-format"]:checked')?.value || 'markdown';
            const options = {
                insights: document.getElementById('export-insights')?.checked,
                notes: document.getElementById('export-notes')?.checked,
                chat: document.getElementById('export-chat')?.checked,
                source: document.getElementById('export-source')?.checked
            };
            closeExportDialog();
            exportWithFormat(format, options);
        });

        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeExportDialog();
            }
        });
    }

    function closeExportDialog() {
        const dialog = document.getElementById('export-dialog');
        if (dialog) {
            dialog.classList.add('hiding');
            setTimeout(() => dialog.remove(), 200);
        }
    }

    async function exportWithFormat(format, options) {
        showToast(getMessage('sp_exporting', 'Exporting...'), 'info');

        const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 60000);
        const exportDate = new Date().toISOString().split('T')[0];
        const fileName = `reading-notes-${exportDate}`;

        let content = '';
        let mimeType = '';
        let extension = '';

        switch (format) {
            case 'markdown':
                content = await generateMarkdownExport(options, sessionDuration, exportDate);
                mimeType = 'text/markdown';
                extension = 'md';
                break;
            case 'json':
                content = generateJsonExport(options, sessionDuration);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'text':
                content = generateTextExport(options, sessionDuration, exportDate);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
        }

        downloadFile(content, `${fileName}.${extension}`, mimeType);
        showToast(getMessage('sp_export_success', 'Downloaded!'), 'success');
    }

    async function generateMarkdownExport(options, sessionDuration, exportDate) {
        let md = `# Reading Session: ${pageContext?.title || 'Unknown Page'}\n\n`;

        if (options.source) {
            md += `**URL:** ${pageContext?.url || 'N/A'}\n`;
            md += `**Date:** ${exportDate}\n`;
            md += `**Duration:** ${sessionDuration} minutes\n`;
            md += `**Highlights:** ${threads.length}\n\n`;
            md += `---\n\n`;
        }

        // Key Insights
        if (options.insights) {
            const insightThreads = threads.filter(t => t.refinedInsight);
            if (insightThreads.length > 0) {
                md += `## 💡 Key Insights\n\n`;
                insightThreads.forEach((t, i) => {
                    md += `${i + 1}. ${t.refinedInsight}\n`;
                });
                md += `\n`;
            }
        }

        // Quick Notes
        if (options.notes && parkingLot.length > 0) {
            md += `## 📝 Quick Notes\n\n`;
            parkingLot.forEach((note, i) => {
                md += `- ${note.text}\n`;
            });
            md += `\n`;
        }

        // Full Chat History
        if (options.chat) {
            md += `## 💬 Discussions\n\n`;
            threads.forEach((thread, idx) => {
                md += `### ${idx + 1}. Highlight\n\n`;
                md += `> ${thread.highlight?.text || 'N/A'}\n\n`;

                if (thread.messages && thread.messages.length > 0) {
                    thread.messages.forEach(msg => {
                        const role = msg.role === 'user' ? '**You:**' : '**AI:**';
                        md += `${role} ${msg.content}\n\n`;
                    });
                }
                md += `---\n\n`;
            });
        }

        md += `\n---\n*Exported from ATOM Active Reading*\n`;

        return md;
    }

    function generateJsonExport(options, sessionDuration) {
        const exportData = {
            meta: {
                exportedAt: new Date().toISOString(),
                sessionDuration: sessionDuration,
                version: '2.0'
            },
            source: options.source ? {
                url: pageContext?.url || null,
                title: pageContext?.title || null,
                domain: currentDomain
            } : undefined,
            insights: options.insights ? threads
                .filter(t => t.refinedInsight)
                .map(t => ({
                    insight: t.refinedInsight,
                    sourceText: t.highlight?.text?.slice(0, 200),
                    createdAt: t.createdAt
                })) : undefined,
            notes: options.notes ? parkingLot.map(n => ({
                text: n.text,
                createdAt: n.createdAt
            })) : undefined,
            threads: options.chat ? threads.map(t => ({
                id: t.id,
                highlight: t.highlight?.text,
                insight: t.refinedInsight,
                status: t.status,
                messages: t.messages,
                connections: t.connections,
                createdAt: t.createdAt
            })) : undefined
        };

        // Remove undefined keys
        Object.keys(exportData).forEach(key => {
            if (exportData[key] === undefined) {
                delete exportData[key];
            }
        });

        return JSON.stringify(exportData, null, 2);
    }

    function generateTextExport(options, sessionDuration, exportDate) {
        let txt = `READING SESSION NOTES\n`;
        txt += `${'='.repeat(40)}\n\n`;

        if (options.source) {
            txt += `Title: ${pageContext?.title || 'Unknown'}\n`;
            txt += `URL: ${pageContext?.url || 'N/A'}\n`;
            txt += `Date: ${exportDate}\n`;
            txt += `Duration: ${sessionDuration} minutes\n`;
            txt += `\n${'='.repeat(40)}\n\n`;
        }

        if (options.insights) {
            const insightThreads = threads.filter(t => t.refinedInsight);
            if (insightThreads.length > 0) {
                txt += `KEY INSIGHTS\n`;
                txt += `${'-'.repeat(20)}\n`;
                insightThreads.forEach((t, i) => {
                    txt += `${i + 1}. ${t.refinedInsight}\n\n`;
                });
            }
        }

        if (options.notes && parkingLot.length > 0) {
            txt += `QUICK NOTES\n`;
            txt += `${'-'.repeat(20)}\n`;
            parkingLot.forEach(note => {
                txt += `* ${note.text}\n`;
            });
            txt += `\n`;
        }

        if (options.chat) {
            txt += `DISCUSSIONS\n`;
            txt += `${'-'.repeat(20)}\n`;
            threads.forEach((thread, idx) => {
                txt += `\n[${idx + 1}] ${thread.highlight?.text?.slice(0, 100) || 'Discussion'}...\n`;
                if (thread.messages) {
                    thread.messages.forEach(msg => {
                        const role = msg.role === 'user' ? 'You' : 'AI';
                        txt += `  ${role}: ${msg.content}\n`;
                    });
                }
            });
        }

        txt += `\n${'='.repeat(40)}\n`;
        txt += `Exported from ATOM Active Reading\n`;

        return txt;
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Legacy export function (still used by endSession)
    async function exportSession() {
        const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 60000);
        const exportDate = new Date().toISOString().split('T')[0];

        // Generate AI summary
        showExportLoading();
        const aiSummary = await generateSessionSummary();
        hideExportLoading();

        // Build Markdown content
        let markdown = `# Reading Session: ${pageContext?.title || 'Unknown Page'}

**URL:** ${pageContext?.url || 'N/A'}
**Date:** ${exportDate}
**Duration:** ${sessionDuration} minutes
**Highlights:** ${threads.length}

---

`;

        if (aiSummary) {
            markdown += `## Session Summary (AI Generated)

${aiSummary}

---

`;
        }

        markdown += `## Highlights & Discussions

`;

        threads.forEach((thread, idx) => {
            const statusEmoji = thread.status === 'saved' ? '✓' :
                thread.status === 'parked' ? '🅿️' : '📝';

            markdown += `### ${idx + 1}. ${statusEmoji} Highlight

> ${thread.highlight?.text || 'N/A'}

`;

            if (thread.connections && thread.connections.length > 0) {
                markdown += `**Connections:**
`;
                thread.connections.forEach(conn => {
                    markdown += `- ${conn.type}: ${conn.explanation}\n`;
                });
                markdown += '\n';
            }

            if (thread.messages && thread.messages.length > 0) {
                markdown += `**Discussion:**
`;
                thread.messages.forEach(msg => {
                    const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
                    markdown += `\n${role}:\n${msg.content}\n`;
                });
                markdown += '\n';
            }

            markdown += `---

`;
        });

        if (parkingLot.length > 0) {
            markdown += `## Parking Lot (Ideas to Revisit)

`;
            parkingLot.forEach((item, idx) => {
                markdown += `${idx + 1}. ${item.text}\n`;
            });
        }

        markdown += `
---
*Exported from ATOM Active Reading*
`;

        // Download as file
        downloadMarkdown(markdown, `reading-session-${exportDate}.md`);

        return markdown;
    }

    function downloadMarkdown(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showExportLoading() {
        const btn = document.getElementById('btn-export-session');
        if (btn) {
            btn.disabled = true;
            const exportingMsg = getMessage('sp_exporting', 'Exporting...');
            btn.innerHTML = `<span class="btn-spinner"></span> ${exportingMsg}`;
        }
    }

    function hideExportLoading() {
        const btn = document.getElementById('btn-export-session');
        if (btn) {
            btn.disabled = false;
            const downloadLabel = getMessage('sp_btn_download_notes', 'Download Notes');
            btn.innerHTML = `📥 ${downloadLabel}`;
        }
    }

    async function endSession() {
        if (threads.length === 0) {
            alert('No highlights in this session.');
            return;
        }

        const confirmMsg = getMessage('sp_confirm_end_session', 'Finish this reading session?');
        const statsDiscussions = getMessage('sp_stats_discussions', 'discussions');
        const quickNoteTitle = getMessage('sp_quick_note_title', 'Quick Notes');
        const confirmEnd = window.confirm(
            `${confirmMsg}\n\n` +
            `• ${threads.length} ${statsDiscussions}\n` +
            `• ${parkingLot.length} ${quickNoteTitle}`
        );

        if (!confirmEnd) return;

        // Export first
        await exportSession();

        // Clear session data
        threads = [];
        parkingLot = [];
        activeThreadId = null;
        sessionStartTime = Date.now();

        await saveThreadsToStorage();
        await saveParkingLot();

        renderThreadList();
        renderParkingLot();
        updateSessionStats();

        // Show empty state
        if (elements.emptyState) {
            elements.emptyState.style.display = 'flex';
        }
        if (elements.currentHighlight) {
            elements.currentHighlight.style.display = 'none';
        }
        if (elements.messages) {
            elements.messages.innerHTML = '';
            elements.messages.appendChild(elements.emptyState);
        }
    }

    // ===========================
    // Deep Angle Logic
    // ===========================
    async function selectRelevantThreads(currentTitle, currentText, candidates) {
        if (!candidates || candidates.length === 0) return [];
        if (candidates.length <= 5) return candidates;

        // 1. Semantic Selection via AI (Re-ranking)
        const listSnippet = candidates.map((t, i) => `${i}. [${t.highlight?.title}]: ${t.highlight?.text?.slice(0, 80)}`).join('\n');
        const targetTitle = String(currentTitle || '').slice(0, 180);
        const targetExcerpt = String(currentText || '').replace(/\s+/g, ' ').trim().slice(0, 400);

        const rankingPrompt = `You are a context retrieval system.
        Target:
        - Title: "${targetTitle}"
        - Excerpt: "${targetExcerpt}"
        
        Candidate Items:
        ${listSnippet}
        
        Task: Select the 5 most relevant items to the Target Topic.
        Output: Return ONLY the indices of the selected items as a JSON array (e.g. [0, 4, 12]).`;

        try {
            // Use JSON mode if model supports it, or just parse text
            const response = await callLLMAPI("Context Selector", [{ role: 'user', parts: [{ text: rankingPrompt }] }], {
                priority: 'vip',
                generationConfig: { temperature: 0.1, maxOutputTokens: 64, response_mime_type: "application/json" }
            });

            const text = response || '[]';
            const jsonMatch = text.match(/\[.*\]/s);
            const raw = jsonMatch ? jsonMatch[0] : '[]';
            const parsed = JSON.parse(raw);
            const indices = Array.isArray(parsed) ? parsed : [];

            if (indices.length > 0) {
                const selected = [];
                const seen = new Set();
                for (const value of indices) {
                    const idx = Number(value);
                    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) continue;
                    if (seen.has(idx)) continue;
                    seen.add(idx);
                    selected.push(candidates[idx]);
                    if (selected.length >= 5) break;
                }
                if (selected.length > 0) return selected;
            }
        } catch (e) {
            console.warn('[Deep Angle] Re-ranking failed, using recent.', e);
        }

        // Fallback: Just return recent ones
        return candidates.slice(0, 5);
    }

    // ===========================
    // Deep Angle Logic
    // ===========================
    async function generateDeepAngle() {
        if (!pageContext?.url) {
            showToast(getMessage('sp_page_read_failed', 'Failed to read page'), 'error');
            return;
        }

        if (isGeneratingDeepAngle) return;

        const llmConfig = await getLLMProvider();
        const geminiKey = await getApiKey();
        const hasProviderKey = llmConfig.provider === 'openrouter'
            ? !!llmConfig.openrouterKey
            : !!geminiKey;
        if (!hasProviderKey) {
            showToast(getMessage('sp_error_no_api_key', 'API key not set'), 'error');
            return;
        }

        isGeneratingDeepAngle = true;
        setDeepAngleLoading(true);

        try {
            // 1. Identify Contexts
            const currentUrl = pageContext.url;
            const currentUrlKey = normalizeUrl(currentUrl || '');

            // A. Current Page Threads
            const currentThreads = threads.filter(t => {
                return normalizeUrl(t.highlight?.url || '') === currentUrlKey;
            });

            // B. Candidate Threads (History from other pages)
            // Get last 30 threads from this domain (excluding current page)
            const candidates = threads
                .filter(t => {
                    return normalizeUrl(t.highlight?.url || '') !== currentUrlKey;
                })
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 30);

            // C. AI Selection (Re-rank candidates)
            let relatedThreads = [];
            if (candidates.length > 0) {
                // Determine relevance using AI
                const analyzing = getMessage('sp_deep_angle_analyzing', 'AI is finding connections...');
                showToast(analyzing, 'info');
                if (elements.deepAngleStatus) {
                    elements.deepAngleStatus.style.display = 'block';
                    elements.deepAngleStatus.textContent = analyzing;
                }
                relatedThreads = await selectRelevantThreads(pageContext.title, pageContext.content?.slice(0, 500), candidates);
            }

            // 2. Prepare Final Prompt
            const highlightContext = currentThreads.map(t => `- "${t.highlight?.text?.slice(0, 200)}"`).join('\n');
            const relatedContext = relatedThreads.map(t => `- [${t.highlight?.title}]: "${t.highlight?.text?.slice(0, 150)}"`).join('\n');
            const pageExcerpt = (pageContext?.content || '').slice(0, 5000);

            const systemPrompt = `You are a profound system thinker. Your goal is to find hidden structures, counter-intuitive insights, or "deep angles" that average readers miss. Language: ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}`;

            const userPrompt = `Analyze this content and provide ONE "Deep Angle" insight.

            CONTEXT:
            Title: ${pageContext.title}
            
            ${highlightContext ? `USER HIGHLIGHTS (Current Page):\n${highlightContext}\n` : ''}
            
            ${relatedContext ? `CONNECTED KNOWLEDGE (From your history):\n${relatedContext}\n` : ''}
            
            PAGE EXCERPT:
            """${pageExcerpt}"""

            Task:
            1. Identify a systems-level connection, a hidden incentive, or a counter-intuitive truth.
            2. SYNTHESIZE the "Connected Knowledge" to find patterns across articles.
            3. Write a single, powerful paragraph (approx 60-80 words).
            4. Tone: Intellectual, sharp, profound.`;

            // 3. Generate Insight
            const response = await callLLMAPI(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
                priority: 'vip',
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
            });

            const deepAngle = (response || '').trim();

            if (deepAngle) {
                deepAngleByUrl.set(currentUrlKey, { text: deepAngle, generatedAt: Date.now() });
                recordSmartLinkMetric('deep_angle_generated_count', 1);
                updateDeepAngleUI();
                elements.deepAngleOutput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                showToast(getMessage('sp_error_empty_response', 'No response received'), 'warning');
            }

        } catch (e) {
            console.error('Deep Angle Error:', e);
            showToast(getMessage('sp_deep_angle_error', 'Failed to generate Deep Angle.'), 'error');
        } finally {
            setDeepAngleLoading(false);
            updateDeepAngleUI();
            isGeneratingDeepAngle = false;
        }
    }
    async function getApiKey() {
        const data = await chrome.storage.local.get(['user_gemini_key', 'gemini_api_key', 'apiKey']);
        return data.user_gemini_key || data.gemini_api_key || data.apiKey || null;
    }

    // ===========================
    // Smart Research Queue Widget
    // ===========================

    // Wave 2 P1: Debounce timer for widget refresh
    let refreshDebounceTimer = null;
    const REFRESH_DEBOUNCE_MS = 300;

    async function mountSRQWidget() {
        const container = document.getElementById('srq-widget-container');
        if (!container) return "error";

        let srqDensityMode = 'comfortable';
        try {
            const setting = await chrome.storage.sync.get({ srqDensityMode: 'comfortable' });
            srqDensityMode = setting?.srqDensityMode === 'compact' ? 'compact' : 'comfortable';
        } catch {
            srqDensityMode = 'comfortable';
        }

        const applyDensity = (el) => {
            if (el && srqDensityMode === 'compact') {
                el.classList.add('srq-density-compact');
            }
            return el;
        };

        const renderIntoContainer = (el) => {
            container.innerHTML = '';
            const next = applyDensity(el);
            if (next) {
                container.appendChild(next);
            }
        };

        // Wave 1 P0: Show loading state
        renderIntoContainer(window.SRQWidget?.createLoadingState());

        try {
            const response = await chrome.runtime.sendMessage({ type: "SRQ_GET_BATCHES" });

            // Check for error response
            if (!response?.ok) {
                renderIntoContainer(window.SRQWidget?.createErrorState(() => mountSRQWidget()));
                return "error";
            }

            // Check for empty state
            const batches = Array.isArray(response.batches) ? response.batches : [];
            if (batches.length === 0) {
                renderIntoContainer(window.SRQWidget?.createEmptyState());
                return "empty";
            }

            // Ready state: show widget with batches
            const widget = window.SRQWidget?.create(batches, srqDensityMode);
            if (!widget) {
                renderIntoContainer(window.SRQWidget?.createEmptyState());
                return "empty";
            }

            renderIntoContainer(widget);
            return "ready";

        } catch (err) {
            console.warn('[ATOM SRQ] Widget mount failed:', err.message);
            renderIntoContainer(window.SRQWidget?.createErrorState(() => mountSRQWidget()));
            return "error";
        }
    }

    /**
     * Wave 2 P1: Debounced refresh to prevent UI flicker.
     * Accumulates rapid updates and refreshes once after silence.
     */
    function debouncedRefreshSRQWidget() {
        if (refreshDebounceTimer) {
            clearTimeout(refreshDebounceTimer);
        }

        refreshDebounceTimer = setTimeout(() => {
            refreshDebounceTimer = null;
            mountSRQWidget();
        }, REFRESH_DEBOUNCE_MS);
    }

    // Listen for SRQ card changes to refresh widget (debounced)
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "SRQ_CARDS_UPDATED") {
            // Wave 2 P1: Optional payload (reason, changedIds) - backward compatible
            debouncedRefreshSRQWidget();
        } else if (msg?.type === "SRQ_SETTINGS_CHANGED") {
            debouncedRefreshSRQWidget();
        }
    });

    // ===========================
    // Start
    // ===========================
    document.addEventListener('DOMContentLoaded', () => {
        init();
        loadUserPreferences();
        startSessionTimer();
        mountSRQWidget();
    });
})();


