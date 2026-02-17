// sidepanel.js - Active Reading 2.0 with Thread System
// Highlight-to-Chat + Thread-based Reading

(function () {
    'use strict';

    // ===========================
    // State
    // ===========================
    let pageContext = null;
    // deepAngleByUrl extracted to sp_smartlink.js (Phase 4b)
    let threads = [];
    let _skipStorageReload = false;
    let activeThreadId = null;
    let activeSessionId = null; // Unified ReadingSession ID
    let isLoading = false;
    let isGeneratingInsight = false; // Prevent duplicate insight generation
    // isGeneratingDeepAngle extracted to sp_smartlink.js (Phase 4b)
    let isInsightDisplayHidden = true; // Default hidden; shown when user creates insight (Ctrl+D)
    let currentTabId = null;
    let currentDomain = null;
    let currentModeId = null;
    // retentionOverlay extracted to sp_retention.js (Phase 3b)
    // retryingState extracted to sp_llm.js (Phase 4a)
    let semanticFlags = {
        embeddingsEnabled: false,
        semanticSearchEnabled: false
    };
    let acceptedCostWarning = false;
    let userPersona = ''; // User's role/expertise for adaptive explanations
    let commandSystemEnabled = false;
    let commandActionExecutor = null;
    // Phase 2: tabController removed (bottom tabs gone)
    let focusWidgetController = null;
    let activeMainTab = 'chat';

    // Session Management
    let sessionStartTime = Date.now();
    // parkingLot extracted to sp_parking.js (Phase 3b)  lives on SP.parkingLot
    let sessionTimer = null;

    // smartLinkMetrics extracted to sp_smartlink.js (Phase 4b)

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
            PILOT_TTL_MS: 900000,
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
            isInsightDisplayHidden = data.sp_insight_display_hidden !== false;
            console.log('[Sidepanel] Loaded Persona:', userPersona);
            const thread = threads.find(t => t.id === activeThreadId);
            syncInsightDisplayUI(thread);
        } catch (e) {
            console.warn('[Sidepanel] Failed to load User Persona:', e);
        }
    }

    const COMMAND_SYSTEM_PROMPT = [
        'COMMAND CAPABILITIES:',
        '- Start focus: [ACTION:FOCUS_START:{"minutes":25}]',
        '- Stop focus: [ACTION:FOCUS_STOP]',
        '- Pause focus: [ACTION:FOCUS_PAUSE]',
        '- Open diary: [ACTION:OPEN_DIARY]',
        '- Open settings: [ACTION:OPEN_SETTINGS]',
        '- Add diary entry: [ACTION:DIARY_ADD:{"content":"...","mood":"neutral","tags":["daily"]}]',
        '- Export saved highlights: [ACTION:EXPORT_SAVED]',
        '',
        'RULES:',
        '1. Use ACTION only when user explicitly asks for an action.',
        '2. Put ACTION on a separate final line.',
        '3. If unclear, ask a follow-up question first.',
        '4. For FOCUS_START, minutes must be between 1 and 180.',
        '5. For DIARY_ADD, infer mood from user text; handle negation (not happy -> sad; no longer anxious -> happy/relieved). If unsure -> neutral. Include 1-3 tags.'
    ].join('\n');

    async function isCommandFeatureEnabled() {
        try {
            if (window.FeatureFlags?.isEnabled) {
                const modern = await window.FeatureFlags.isEnabled('AI_COMMANDS_ENABLED');
                const legacy = await window.FeatureFlags.isEnabled('ENABLE_AI_COMMANDS');
                if (modern || legacy) return true;
            }
        } catch (e) {
            console.warn('[CommandSystem] Failed to read FeatureFlags API:', e);
        }

        try {
            const data = await chrome.storage.local.get([
                'atom_feature_flags_v1',
                'ff_ENABLE_AI_COMMANDS',
                'ff_AI_COMMANDS_ENABLED'
            ]);
            const flags = data.atom_feature_flags_v1 || {};
            return !!(
                flags.AI_COMMANDS_ENABLED ||
                flags.ENABLE_AI_COMMANDS ||
                data.ff_AI_COMMANDS_ENABLED ||
                data.ff_ENABLE_AI_COMMANDS
            );
        } catch (e) {
            console.warn('[CommandSystem] Fallback flag lookup failed:', e);
            return false;
        }
    }

    function registerFocusHandlers() {
        if (!window.CommandRouter) return;

        window.CommandRouter.register(
            'FOCUS_START',
            async function (params) {
                const minutes = Number(params?.minutes ?? 25);
                if (!Number.isFinite(minutes) || minutes < 1) {
                    return {
                        success: false,
                        message: getMessage('cmd_focus_min_too_low', 'Please enter at least 1 minute.')
                    };
                }
                if (minutes > 180) {
                    return {
                        success: false,
                        message: getMessage('cmd_focus_min_too_high', 'Maximum 180 minutes allowed.')
                    };
                }

                const breakMin = Math.max(1, Math.ceil(minutes / 5));
                try {
                    const result = await chrome.runtime.sendMessage({
                        type: 'FOCUS_START',
                        payload: { workMin: minutes, breakMin: breakMin }
                    });
                    if (!result?.ok) {
                        throw new Error('FOCUS_START returned non-ok');
                    }
                    return {
                        success: true,
                        message: getMessageWithArgs(
                            'focusStarted',
                            [String(minutes)],
                            `Started focus for ${minutes} minutes.`
                        ),
                        data: { minutes: minutes, breakMin: breakMin }
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: getMessage('cmdError', getMessage('cmd_error', 'Something went wrong...'))
                    };
                }
            },
            async function () {
                await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
            }
        );

        window.CommandRouter.register(
            'FOCUS_STOP',
            async function () {
                try {
                    const stateRes = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
                    const state = stateRes?.atom_focus_state;
                    if (!state?.enabled) {
                        return {
                            success: false,
                            message: getMessage('focusNotRunning', 'No focus session is currently running.')
                        };
                    }

                    const res = await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
                    if (!res?.ok) {
                        throw new Error('FOCUS_STOP returned non-ok');
                    }

                    return {
                        success: true,
                        message: getMessage('focusStopped', 'Focus session stopped.')
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: getMessage('cmdError', getMessage('cmd_error', 'Something went wrong...'))
                    };
                }
            }
        );

        window.CommandRouter.register(
            'FOCUS_PAUSE',
            async function () {
                try {
                    const pauseRes = await chrome.runtime.sendMessage({ type: 'FOCUS_PAUSE' });

                    if (!pauseRes?.ok) {
                        const reason = pauseRes?.reason || 'unknown';
                        if (reason === 'not_running') {
                            return {
                                success: false,
                                message: getMessage('focusNotRunning', 'No focus session is currently running.')
                            };
                        }
                        return {
                            success: false,
                            message: getMessage('cmdError', getMessage('cmd_error', 'Something went wrong...'))
                        };
                    }

                    return {
                        success: true,
                        message: getMessage('focusPaused', 'Focus paused.')
                    };
                } catch (error) {
                    return {
                        success: false,
                        message: getMessage('cmdError', getMessage('cmd_error', 'Something went wrong...'))
                    };
                }
            }
        );
    }

    function registerNavigationHandlers() {
        if (!window.CommandRouter) return;

        window.CommandRouter.register('OPEN_NOTES', async function () {
            // Phase 2: Notes tab removed. Fallback to memory.html.
            chrome.tabs.create({ url: chrome.runtime.getURL('memory.html') });
            return { success: true, message: '' };
        });

        window.CommandRouter.register('OPEN_MEMORY', async function () {
            chrome.tabs.create({ url: chrome.runtime.getURL('memory.html') });
            return { success: true, message: '' };
        });

        window.CommandRouter.register('OPEN_SAVED', async function () {
            switchMainTab('saved');
            return { success: true, message: '' };
        });

        window.CommandRouter.register('EXPORT_SAVED', async function () {
            try {
                const batchesRes = await chrome.runtime.sendMessage({ type: 'SRQ_GET_BATCHES' });
                const batches = batchesRes?.batches || [];
                if (!Array.isArray(batches) || batches.length === 0) {
                    return {
                        success: true,
                        message: getMessage('savedExportEmpty', 'No saved highlights to export.')
                    };
                }

                let exportedTotal = 0;
                let failed = 0;
                for (const batch of batches) {
                    if (!batch?.topicKey) continue;
                    const res = await chrome.runtime.sendMessage({
                        type: 'SRQ_EXPORT_BATCH',
                        topicKey: batch.topicKey,
                        notebookRef: batch.suggestedNotebook || 'Inbox'
                    });
                    if (res?.ok) {
                        exportedTotal += Number(res.exported || res.exportedCount || 0);
                    } else {
                        failed += 1;
                    }
                }

                if (exportedTotal > 0) {
                    return {
                        success: true,
                        message: getMessageWithArgs(
                            'savedExported',
                            [String(exportedTotal)],
                            `Exported ${exportedTotal} highlights`
                        )
                    };
                }

                return {
                    success: false,
                    message: getMessage('savedExportFailed', 'Export failed. Try again.')
                };
            } catch (e) {
                return {
                    success: false,
                    message: getMessage('savedExportFailed', 'Export failed. Try again.')
                };
            }
        });

        window.CommandRouter.register('OPEN_DIARY', async function () {
            chrome.tabs.create({ url: chrome.runtime.getURL('journal.html') });
            return { success: true, message: '' };
        });

        window.CommandRouter.register('OPEN_SETTINGS', async function () {
            chrome.runtime.openOptionsPage();
            return { success: true, message: '' };
        });
    }

    function registerDiaryHandlers() {
        if (!window.CommandRouter) return;

        window.CommandRouter.register(
            'DIARY_ADD',
            async function (params) {
                const content = String(params?.content ?? '').trim();
                if (!content) {
                    return {
                        success: false,
                        message: getMessage('diaryNoContent', 'Add a short note before saving.')
                    };
                }

                const allowedMoods = new Set([
                    'happy', 'excited', 'sad', 'anxious', 'tired', 'angry', 'focused', 'grateful', 'neutral'
                ]);
                const rawMood = String(params?.mood ?? '').toLowerCase().trim();
                const mood = allowedMoods.has(rawMood) ? rawMood : 'neutral';

                let tags = [];
                if (Array.isArray(params?.tags)) {
                    tags = params.tags
                        .map(t => String(t || '').trim())
                        .filter(Boolean)
                        .slice(0, 3);
                }
                if (tags.length === 0) tags = ['daily'];

                const entry = {
                    id: `journal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    timestamp: Date.now(),
                    input: {
                        context: String(params?.context || getMessage('jnl_title', 'Journal')),
                        duration: 0,
                        user_feeling: mood,
                        user_tags: tags,
                        user_note: content
                    },
                    source: 'ai_command'
                };

                const data = await chrome.storage.local.get(['journal_logs']);
                const logs = data.journal_logs || [];
                logs.push(entry);
                await chrome.storage.local.set({ journal_logs: logs });

                // Trigger AI response generation (fire-and-forget)
                // Background will save ai_response directly to journal_logs
                chrome.runtime.sendMessage({ type: "ANALYZE_JOURNAL" }, function (response) {
                    if (chrome.runtime.lastError) {
                        console.warn('[DIARY_ADD] ANALYZE_JOURNAL failed:', chrome.runtime.lastError.message);
                    }
                });

                return {
                    success: true,
                    message: getMessage('diarySaved', 'Saved to Journal'),
                    data: entry
                };
            },
            async function (data) {
                const storage = await chrome.storage.local.get(['journal_logs']);
                const logs = storage.journal_logs || [];
                const next = logs.filter(l => l.id ? l.id !== data.id : l.timestamp !== data.timestamp);
                await chrome.storage.local.set({ journal_logs: next });
            }
        );

        window.CommandRouter.register(
            'DIARY_SUMMARY',
            async function (params) {
                const period = String(params?.period || 'week').toLowerCase();
                const data = await chrome.storage.local.get(['journal_logs']);
                const logs = data.journal_logs || [];

                const periodMs = {
                    today: 24 * 60 * 60 * 1000,
                    week: 7 * 24 * 60 * 60 * 1000,
                    month: 30 * 24 * 60 * 60 * 1000
                };
                const cutoff = Date.now() - (periodMs[period] || periodMs.week);

                const filtered = logs.filter(log => {
                    const ts = Number(log.timestamp || log.ts || 0);
                    return ts >= cutoff;
                });

                if (filtered.length === 0) {
                    return {
                        success: true,
                        message: getMessage('diarySummaryEmpty', 'No entries yet for this period.')
                    };
                }

                const moodCounts = {};
                const tagCounts = {};
                filtered.forEach(log => {
                    const mood = log.input?.user_feeling || 'neutral';
                    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
                    (log.input?.user_tags || []).forEach(tag => {
                        const key = String(tag || '').trim();
                        if (!key) return;
                        tagCounts[key] = (tagCounts[key] || 0) + 1;
                    });
                });

                const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
                const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

                const periodLabel = ({
                    today: getMessage('periodToday', 'today'),
                    week: getMessage('periodWeek', 'this week'),
                    month: getMessage('periodMonth', 'this month')
                })[period] || getMessage('periodWeek', 'this week');

                const moodLabel = topMood?.[0] || 'neutral';
                const tagLine = topTags.map(([t]) => t).join(', ') || getMessage('diarySummaryTagsEmpty', 'general');

                return {
                    success: true,
                    message:
                        `${getMessage('diarySummaryTitle', 'Journal summary')} (${periodLabel}):\n` +
                        `â€¢ ${filtered.length} ${getMessage('diarySummaryEntries', 'entries')}\n` +
                        `â€¢ ${getMessage('diarySummaryMood', 'Top mood')}: ${moodLabel}\n` +
                        `â€¢ ${getMessage('diarySummaryTags', 'Top tags')}: ${tagLine}`,
                    data: { period: period, totalEntries: filtered.length, moodCounts, tagCounts }
                };
            }
        );

        window.CommandRouter.register(
            'SAVE_TO_NOTES',
            async function (params) {
                let textToSave = typeof params?.content === 'string' ? params.content : '';
                if (!textToSave) {
                    const ctx = await chrome.storage.local.get(['last_highlight', 'current_selection']);
                    textToSave = String(ctx.current_selection || ctx.last_highlight || '');
                }

                textToSave = String(textToSave || '').trim();
                if (!textToSave) {
                    return {
                        success: false,
                        message: getMessage('noteNoContent', 'Select text or provide content first.')
                    };
                }

                let url = '';
                let title = '';
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    url = tabs?.[0]?.url || '';
                    title = tabs?.[0]?.title || '';
                } catch { /* ignore */ }

                let tags = [];
                if (Array.isArray(params?.tags)) {
                    tags = params.tags.map(t => String(t || '').trim()).filter(Boolean);
                }

                const note = {
                    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    selection: textToSave,
                    url,
                    title,
                    created_at: Date.now(),
                    category: String(params?.category || 'general'),
                    tags,
                    source: 'ai_command'
                };

                const res = await chrome.runtime.sendMessage({
                    type: 'ATOM_SAVE_READING_NOTE',
                    payload: { note: note }
                });

                if (!res?.ok) {
                    return {
                        success: false,
                        message: getMessage('noteSaveFailed', 'Could not save note.')
                    };
                }

                return {
                    success: true,
                    message: getMessage('noteSaved', 'Saved to Notes'),
                    data: note
                };
            },
            async function (data) {
                const key = 'atom_reading_notes';
                const storage = await chrome.storage.local.get([key]);
                const list = Array.isArray(storage[key]) ? storage[key] : [];
                const next = list.filter(n => n.id !== data.id);
                await chrome.storage.local.set({ [key]: next });
            }
        );
    }

    async function initCommandSystem() {
        const router = window.CommandRouter;
        const parser = window.IntentParser;
        const executor = window.ActionExecutor;
        const toast = window.ToastManager;

        if (!router || !parser || !executor || !toast) {
            commandSystemEnabled = false;
            commandActionExecutor = null;
            return;
        }

        const enabled = await isCommandFeatureEnabled();
        commandSystemEnabled = enabled;
        router.setEnabled(enabled);

        if (!enabled) {
            commandActionExecutor = null;
            return;
        }

        executor.init(toast);
        commandActionExecutor = executor;

        registerFocusHandlers();
        registerNavigationHandlers();
        registerDiaryHandlers();

        if (window.CommandMenuController) {
            var cmdMenu = new window.CommandMenuController(commandActionExecutor, {
                onAction: handleQuickAction
            });
            cmdMenu.init();
        }

        // Phase 3: QuickDiaryController removed (use /journal command)
    }

    async function showCommandOnboardingIfNeeded() {
        if (!commandSystemEnabled) return;
        try {
            const existing = await chrome.storage.local.get([COMMAND_ONBOARDING_STORAGE_KEY]);
            if (existing[COMMAND_ONBOARDING_STORAGE_KEY]) return;
        } catch (e) {
            return;
        }

        if (document.getElementById('sp-command-onboarding')) return;

        const titleText = getMessage('cmd_onboarding_title', 'New: control with chat');
        const bodyText = getMessage(
            'cmd_onboarding_body',
            'Now you can say:<br>- "Focus 25 minutes"<br>- "Write a diary: feeling tired"<br>- "Save to notes"<br><br>Or tap the quick buttons at the top.'
        );
        const dismissText = getMessage('cmd_onboarding_dismiss', 'Got it');

        const card = document.createElement('div');
        card.id = 'sp-command-onboarding';
        card.className = 'sp-onboarding';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-live', 'polite');

        const titleEl = document.createElement('div');
        titleEl.className = 'sp-onboarding__title';
        titleEl.textContent = titleText;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'sp-onboarding__body';
        bodyEl.innerHTML = bodyText;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sp-onboarding__btn';
        btn.textContent = dismissText;

        btn.addEventListener('click', async () => {
            card.classList.add('hide');
            setTimeout(() => card.remove(), 220);
            try {
                await chrome.storage.local.set({ [COMMAND_ONBOARDING_STORAGE_KEY]: true });
            } catch (e) {
                // ignore
            }
        });

        card.appendChild(titleEl);
        card.appendChild(bodyEl);
        card.appendChild(btn);
        document.body.appendChild(card);
        requestAnimationFrame(() => card.classList.add('show'));
    }

    async function tryHandleIntentLocally(text) {
        if (!commandSystemEnabled || !commandActionExecutor || !window.IntentParser?.parse) {
            return false;
        }

        const intent = window.IntentParser.parse(text);
        if (!intent) return false;

        await commandActionExecutor.handleIntent(intent);
        return true;
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


    // Undo system extracted to sp_undo.js (Phase 3a)
    let toastTimeoutId = null;


    const COMMAND_ONBOARDING_STORAGE_KEY = 'ai_commands_onboarded';

    // Onboarding system extracted to sp_onboarding.js (Phase 2)





    // Search & Filter vars extracted to sp_search.js (Phase 3a)


    // Multi-tab session management extracted to sp_multitab.js (Phase 2)

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
            if (window.AtomI18n) {
                return window.AtomI18n.getMessage(key, null, fallback);
            }
            const msg = chrome.i18n.getMessage(key);
            return msg || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function getMessageWithArgs(key, args, fallback = '') {
        try {
            if (window.AtomI18n) {
                return window.AtomI18n.getMessage(key, args, fallback);
            }
            const msg = chrome.i18n.getMessage(key, args);
            return msg || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function applyI18n() {
        // Use AtomUI.localize() if available (handles data-i18n, data-i18n-placeholder, data-i18n-title)
        if (window.AtomUI) {
            window.AtomUI.localize();
            return;
        }

        // Fallback: Apply data-i18n to textContent
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

        // Ensure i18n locale is loaded before applying
        if (window.AtomI18n) {
            await window.AtomI18n.init();
        }

        // Apply i18n
        applyI18n();

        // New 3-zone layout elements
        elements = {
            // Offline banner
            offlineBanner: document.getElementById('offline-banner'),
            retryConnectionBtn: document.getElementById('btn-retry-connection'),
            mainTabBar: document.getElementById('main-tabbar'),
            cardsGoChatBtn: document.getElementById('btn-cards-go-chat'),

            // Zone 1: Top Bar
            sessionTimerEl: document.getElementById('session-timer'),
            pageTitle: document.getElementById('page-title'),
            contextStatus: document.getElementById('context-status'),
            contextText: document.getElementById('context-text'),
            notebookLink: document.getElementById('notebook-link'),
            notebookLinkText: document.getElementById('notebook-link-text'),
            notebookLinkCount: document.getElementById('notebook-link-count'),
            refreshBtn: document.getElementById('btn-new-chat-top'),
            menuBtn: document.getElementById('btn-menu'),
            menuDropdown: document.getElementById('menu-dropdown'),
            menuSemanticEmbeddings: document.getElementById('menu-semantic-embeddings'),
            menuSemanticSearch: document.getElementById('menu-semantic-search'),
            // Phase 3: menuEmbeddingsStatus + menuSemanticStatus removed (auto-managed)

            // Zone 2: Main View
            currentContext: document.getElementById('current-context'),
            highlightText: document.getElementById('highlight-text'),
            primerRoot: document.getElementById('primer-root'),
            // Phase 3: modeRoot + memoryRoot removed (phantom UI)
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

            // Zone 3: Bottom Tabs — Phase 2: HTML removed, only deep-angle refs kept
            deepAngleBtn: document.getElementById('btn-deep-angle'),
            deepAngleOutput: document.getElementById('deep-angle-output'),
            deepAngleText: document.getElementById('deep-angle-text'),
            deepAngleStatus: document.getElementById('deep-angle-status')
        };

        await initCommandSystem();
        await showCommandOnboardingIfNeeded();
        setupEventListeners();
        setupMenuDropdown();
        updateSemanticMenuUI();
        setupTabs();
        await setupMainTabs();
        setupNotes();
        setupActionBar();
        await initFocusWidget();
        await loadPageContext();
        await loadThreadsFromStorage();
        if (SP.loadParkingLot) await SP.loadParkingLot();
        listenForHighlights();
        updateAllCounts();

        // Initialize onboarding (Phase 2: via SP)
        if (SP.loadOnboardingState) await SP.loadOnboardingState();
        SP.checkAndShowOnboarding?.();

        // Initialize multi-tab handling (Phase 2: via SP)
        SP.initMultiTabHandling?.();

        // â”€â”€ Phase 1: Wire Shared State Bus â”€â”€
        if (window.SP) {
            // Core state
            window.SP.pageContext = pageContext;
            window.SP.threads = threads;
            Object.defineProperty(window.SP, 'activeThreadId', {
                get() { return activeThreadId; },
                set(v) { activeThreadId = v; },
                configurable: true
            });
            window.SP.activeSessionId = activeSessionId;
            window.SP.isLoading = isLoading;
            window.SP.currentTabId = currentTabId;
            window.SP.currentDomain = currentDomain;
            window.SP.currentModeId = currentModeId;
            window.SP.activeMainTab = activeMainTab;
            window.SP.sessionStartTime = sessionStartTime;
            // parkingLot: initialized by sp_parking.js via loadParkingLot()
            window.SP.elements = elements;
            window.SP.API_CONFIG = API_CONFIG;
            window.SP.semanticFlags = semanticFlags;
            window.SP.acceptedCostWarning = acceptedCostWarning;
            window.SP.userPersona = userPersona;

            // Expose helpers as functions
            window.SP.getMessage = getMessage;
            window.SP.getMessageWithArgs = getMessageWithArgs;
            window.SP.getIcon = getIcon;
            window.SP.showToast = showToast;
            window.SP.getApiKey = getApiKey;
            window.SP.switchMainTab = switchMainTab;
            window.SP.loadThreadsFromStorage = loadThreadsFromStorage;

            // Phase 3a: Functions needed by sp_undo, sp_search
            window.SP.escapeHtml = escapeHtml;
            window.SP.switchToTab = switchToTab;
            window.SP.renderThreadList = renderThreadList;
            window.SP.renderActiveThread = renderActiveThread;

            // Phase 3b: Functions needed by sp_retention, sp_parking
            window.SP.getApiKey = getApiKey;
            window.SP.updateSessionStats = updateSessionStats;
            window.SP.updateAllCounts = updateAllCounts;
            window.SP.saveThreadsToStorage = saveThreadsToStorage;

            // Phase 4a: API_CONFIG for sp_llm.js
            window.SP.API_CONFIG = API_CONFIG;

            // Phase 5: sessionStartTime for sp_export.js
            window.SP.sessionStartTime = sessionStartTime;

            // Phase 4b: Functions needed by sp_smartlink.js
            window.SP.hashString = hashString;
            window.SP.normalizeUrl = normalizeUrl;
            window.SP.formatMessage = formatMessage;
            window.SP.addMessageToDOM = addMessageToDOM;
            window.SP.sendToGemini = sendToGemini;

            console.log('[SP] State bus wired âœ“', {
                threads: threads.length,
                elements: Object.keys(elements).length,
                model: API_CONFIG.MODEL_NAME
            });
        }
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

    // Phase 3: initLearningModeUI + updateQuickActionChips removed (mode selector archived)

    function hashString(input) {
        const text = String(input || '');
        let hash = 5381;
        for (let i = 0; i < text.length; i += 1) {
            hash = ((hash << 5) + hash) + text.charCodeAt(i);
            hash &= 0x7fffffff;
        }
        return hash.toString(16);
    }

    // recordSmartLinkMetric extracted to sp_smartlink.js (Phase 4b)

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
        let hasAccess = !!apiKey;
        if (!hasAccess) {
            // Check if user is signed in (can use proxy)
            try {
                const authData = await chrome.storage.local.get('atom_auth_cache');
                hasAccess = !!authData?.atom_auth_cache?.isAuthenticated;
            } catch (e) { /* ignore */ }
        }
        if (!hasAccess) {
            return;
        }
        // Phase 3: Menu badge states removed (semantic auto-managed)
    }

    async function ensureCostWarningAccepted() {
        if (acceptedCostWarning) return true;
        const message = getMessage(
            'sp_semantic_cost_warning',
            'Enabling this may increase AI usage and cost. Continue?'
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
            // Check if user is signed in (can use proxy)
            let isSignedIn = false;
            try {
                const authData = await chrome.storage.local.get('atom_auth_cache');
                isSignedIn = !!authData?.atom_auth_cache?.isAuthenticated;
            } catch (e) { /* ignore */ }
            if (!isSignedIn) {
                showToast(getMessage('sp_semantic_key_required', 'Add your API key in Settings or sign in to enable this.'), 'warning');
                updateSemanticMenuUI();
                return;
            }
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
        try {
            if (!FEATURE_FLAGS.PRE_READING_PRIMER || !elements.primerRoot) return;
            if (!pageContext?.url || !window.PrimerService || !window.PrimerUI) return;

            elements.primerRoot.classList.remove('active');
            elements.primerRoot.innerHTML = '';

            if (!window.PrimerService.shouldShowPrimer(pageContext)) return;
            if (await window.PrimerService.wasPrimerShown(pageContext.url)) return;

            const apiKey = await getApiKey();
            if (!apiKey) {
                // Allow if user is signed in (proxy available)
                try {
                    const authData = await chrome.storage.local.get('atom_auth_cache');
                    if (!authData?.atom_auth_cache?.isAuthenticated) return;
                } catch (e) { return; }
            }

            // Adapter: callLLMAPI has different signature than callGeminiAPI
            const proxyAdapter = async (_key, systemPrompt, conversationHistory) => {
                return await SP.callLLMAPI(systemPrompt, conversationHistory);
            };

            const primerData = await window.PrimerService.generatePrimer(
                pageContext,
                apiKey,
                apiKey ? SP.callGeminiAPI : proxyAdapter
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
        } catch (err) {
            console.warn('[Primer] checkAndShowPrimer error:', err.message);
        }
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
                SP.callGeminiAPI,
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
                    // Auto-dismiss the card after starting comparison
                    elements.memoryRoot?.classList.remove('active');
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

        // Switch to Chat > Discussions
        switchMainTab('chat', false);
        switchToTab('discussions');

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


    // Retention Loop extracted to sp_retention.js (Phase 3b)




    // Search & Filter extracted to sp_search.js (Phase 3a)


    function setupMenuDropdown() {
        // Toggle menu
        elements.menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = elements.menuDropdown?.classList.toggle('show');
            elements.menuBtn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

            // Position dropdown below button (fixed positioning)
            if (isOpen && elements.menuDropdown && elements.menuBtn) {
                const rect = elements.menuBtn.getBoundingClientRect();
                elements.menuDropdown.style.top = (rect.bottom + 4) + 'px';
                elements.menuDropdown.style.right = (window.innerWidth - rect.right) + 'px';
            }

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
        document.getElementById('menu-download')?.addEventListener('click', () => SP.showExportDialog?.());
        document.getElementById('menu-save-all')?.addEventListener('click', () => SP.exportAllToNLM?.());
        elements.menuSemanticEmbeddings?.addEventListener('click', () => toggleSemanticFlag('EMBEDDINGS_ENABLED'));
        elements.menuSemanticSearch?.addEventListener('click', () => toggleSemanticFlag('SEMANTIC_SEARCH_ENABLED'));
        document.getElementById('menu-clear')?.addEventListener('click', clearCurrentThread);
        document.getElementById('menu-new-chat')?.addEventListener('click', handleNewChat);
        document.getElementById('menu-whats-new')?.addEventListener('click', () => {
            const ver = chrome.runtime.getManifest().version;
            chrome.tabs.create({ url: `https://www.amonexus.com/whats-new?v=${encodeURIComponent(ver)}` });
            elements.menuDropdown?.classList.remove('show');
        });
        document.getElementById('menu-finish')?.addEventListener('click', () => SP.endSession?.());

        // Phase 2: Chat History inline thread list
        document.getElementById('menu-threads')?.addEventListener('click', () => {
            elements.menuDropdown?.classList.remove('show');
            toggleInlineThreadList();
        });

        // Phase 2: Memory page (replaces Notes tab)
        document.getElementById('menu-memory')?.addEventListener('click', () => {
            elements.menuDropdown?.classList.remove('show');
            chrome.tabs.create({ url: chrome.runtime.getURL('memory.html') });
        });
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
        // Phase 2: Bottom tabs removed. No-op.
    }

    async function setupMainTabs() {
        const tabBar = elements.mainTabBar;
        if (!tabBar) return;

        const buttons = Array.from(tabBar.querySelectorAll('.sp-main-tab-btn[data-main-tab]'));
        if (!buttons.length) return;

        buttons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.mainTab;
                switchMainTab(tabName, true);
            });

            btn.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const delta = e.key === 'ArrowRight' ? 1 : -1;
                    let nextIndex = index + delta;
                    if (nextIndex < 0) nextIndex = buttons.length - 1;
                    if (nextIndex >= buttons.length) nextIndex = 0;
                    buttons[nextIndex]?.focus();
                    switchMainTab(buttons[nextIndex]?.dataset?.mainTab, true);
                    return;
                }
                if (e.key === 'Home') {
                    e.preventDefault();
                    buttons[0]?.focus();
                    switchMainTab(buttons[0]?.dataset?.mainTab, true);
                    return;
                }
                if (e.key === 'End') {
                    e.preventDefault();
                    const last = buttons[buttons.length - 1];
                    last?.focus();
                    switchMainTab(last?.dataset?.mainTab, true);
                }
            });
        });

        elements.cardsGoChatBtn?.addEventListener('click', () => {
            switchMainTab('chat', true);
        });

        let initial = 'chat';
        try {
            const data = await chrome.storage.local.get(['sp_active_main_tab']);
            const candidate = String(data.sp_active_main_tab || '').trim();
            if (['chat', 'cards', 'saved'].includes(candidate)) {
                initial = candidate;
            }
        } catch (e) {
            // ignore
        }

        switchMainTab(initial, false);
    }

    function switchMainTab(tabName, persist = true) {
        const next = ['chat', 'cards', 'saved'].includes(tabName) ? tabName : 'chat';
        activeMainTab = next;
        if (window.SP) window.SP.activeMainTab = activeMainTab;
        document.body.setAttribute('data-main-tab', next);

        const tabBar = elements.mainTabBar;
        if (tabBar) {
            tabBar.querySelectorAll('.sp-main-tab-btn[data-main-tab]').forEach((btn) => {
                const isActive = btn.dataset.mainTab === next;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                btn.tabIndex = isActive ? 0 : -1;
            });
        }

        if (next === 'chat') {
            // Bottom tabs removed — Phase 2. No switchToTab needed.
        } else if (next === 'saved') {
            mountSRQWidget();
        } else if (next === 'cards') {
            window.ReviewCards?.mount(document.getElementById('review-cards-root'));
        }

        animateMainTabSurface(next);

        if (persist) {
            try {
                chrome.storage.local.set({ sp_active_main_tab: next });
            } catch (e) {
                // ignore
            }
        }
    }

    function animateMainTabSurface(tabName) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        const targets = [];
        if (false) { // Notes tab removed — Phase 2
        } else if (tabName === 'saved') {
            const saved = document.getElementById('srq-widget-container');
            if (saved) targets.push(saved);
        } else if (tabName === 'cards') {
            const cards = document.getElementById('cards-panel');
            if (cards) targets.push(cards);
        } else {
            if (elements.messages) targets.push(elements.messages);
        }

        targets.forEach((el) => {
            el.classList.remove('sp-main-surface-enter');
            requestAnimationFrame(() => {
                el.classList.add('sp-main-surface-enter');
            });
            setTimeout(() => {
                el.classList.remove('sp-main-surface-enter');
            }, 220);
        });
    }

    function toggleBottomTabs(forceCollapsed) {
        // Phase 2: Bottom tabs removed. No-op.
        return;
    }

    async function initFocusWidget() {
        if (!window.FocusBarController) return;
        try {
            if (focusWidgetController?.destroy) focusWidgetController.destroy();
            focusWidgetController = new window.FocusBarController(commandActionExecutor);
            await focusWidgetController.init();
        } catch (e) {
            console.warn('[Sidepanel] FocusBarController init failed:', e);
        }
    }

    function setupNotes() {
        // Phase 2: Notes tab removed. No-op.
    }

    function setupActionBar() {
        // Phase 2: Action bar removed. No-op.
        return;
        document.getElementById('btn-quick-save')?.addEventListener('click', () => {
            SP.quickSaveHighlight?.();
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
        document.getElementById('btn-mark-done')?.addEventListener('click', () => SP.parkCurrentThread?.());

        // Copy insight
        document.getElementById('btn-copy-insight')?.addEventListener('click', () => {
            const text = elements.insightText?.textContent;
            if (text) {
                navigator.clipboard.writeText(text);
                showToast(getMessage('sp_toast_copied', 'Copied'), 'success');
            }
        });

        // Save insight
        document.getElementById('btn-save-insight')?.addEventListener('click', () => SP.saveThreadToNLM?.());
    }

    // getNlmExportFailureToast + quickSaveHighlight extracted to sp_export.js (Phase 5)


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
            // "/" command menu trigger
            if (elements.userInput.value === '/') {
                const cmdDropdown = document.getElementById('cmd-dropdown');
                if (cmdDropdown && !cmdDropdown.classList.contains('show')) {
                    document.getElementById('cmd-trigger')?.click();
                }
                elements.userInput.value = '';
                updateSendButton();
                updateCharCount();
                return;
            }
            elements.userInput.style.height = 'auto';
            elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 120) + 'px';
            updateSendButton();
            updateCharCount();
        });

        // New Chat (Top Bar)
        elements.refreshBtn?.addEventListener('click', handleNewChat);

        // Deep Angle (2-step retrieval + deep analysis)
        elements.deepAngleBtn?.addEventListener('click', () => SP.generateDeepAngle?.());

        // Listen for tab changes
        chrome.tabs.onActivated.addListener(handleTabChange);
        chrome.tabs.onUpdated.addListener(handleTabUpdate);

        // Setup keyboard shortcuts
        setupKeyboardShortcuts();

        // Capture post button (shown dynamically on social media)
        document.getElementById('capture-post-btn')?.addEventListener('click', captureFocusedPost);

        // Show capture-post button on social media sites
        updateCapturePostVisibility();

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
    // Auto-Focus Post Capture
    // ===========================
    async function captureFocusedPost() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                showToast(getMessage('sp_no_active_tab', 'No active tab'), 'warning');
                return;
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                type: 'ATOM_GET_FOCUSED_POST'
            });

            if (response?.ok && response.post) {
                const threadId = `auto_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
                await handleNewHighlight({
                    ...response.post,
                    threadId: threadId
                });
                showToast(getMessage('sp_post_captured', 'Post captured!'), 'success');
            } else {
                showToast(getMessage('sp_no_post_found', 'No focused post found'), 'info');
            }
        } catch (err) {
            console.error('[SidePanel] captureFocusedPost error:', err);
            showToast(getMessage('sp_capture_error', 'Could not capture post'), 'warning');
        }
    }

    // ===========================
    // Capture Post Visibility (Social Media Only)
    // ===========================
    const SOCIAL_MEDIA_DOMAINS = ['facebook.com', 'reddit.com', 'x.com', 'twitter.com'];

    function updateCapturePostVisibility() {
        const btn = document.getElementById('capture-post-btn');
        if (!btn) return;

        const domain = (pageContext?.domain || currentDomain || '').replace(/^www\./, '');
        const isSocial = SOCIAL_MEDIA_DOMAINS.some(d => domain.includes(d));

        if (isSocial) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }

    // ===========================
    // Notebook Smart Link
    // ===========================
    async function updateNotebookLink() {
        const el = elements.notebookLink;
        const textEl = elements.notebookLinkText;
        const countEl = elements.notebookLinkCount;
        if (!el || !textEl) return;

        const url = pageContext?.url;
        if (!url) {
            el.hidden = true;
            return;
        }

        try {
            const res = await chrome.runtime.sendMessage({
                type: "SRQ_GET_NOTEBOOK_FOR_URL",
                url
            });
            if (res?.ok && res.notebookRef) {
                // Use page title if notebook is generic "Inbox"
                let displayName = res.notebookRef;
                if (displayName === "Inbox" && pageContext?.title) {
                    displayName = pageContext.title.length > 30
                        ? pageContext.title.slice(0, 28) + '…'
                        : pageContext.title;
                } else if (displayName.length > 30) {
                    displayName = displayName.slice(0, 28) + '…';
                }

                textEl.textContent = displayName;
                if (countEl) {
                    const label = res.count === 1 ? 'note' : 'notes';
                    countEl.textContent = `· ${res.count} ${label}`;
                }
                el.hidden = false;
                el.onclick = () => {
                    if (res.notebookUrl) {
                        chrome.tabs.create({ url: res.notebookUrl });
                    }
                };
            } else {
                el.hidden = true;
            }
        } catch {
            el.hidden = true;
        }
    }

    // ===========================
    // Keyboard Shortcuts
    // ===========================
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'INPUT';

            // Alt+Z: Toggle compact mode
            if (e.altKey && e.key === 'z') {
                e.preventDefault();
                toggleCompactMode();
                return;
            }

            // Alt+C: Capture focused post
            if (e.altKey && e.key === 'c') {
                e.preventDefault();
                captureFocusedPost();
                return;
            }

            // Ctrl/Cmd + Enter: Send message (works even in input)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSend();
                return;
            }

            // Ctrl/Cmd + D: Key Insight (ÄÃºc káº¿t ngay)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey) {
                e.preventDefault();
                if (activeThreadId) {
                    makeAtomicThought();
                }
                return;
            }

            // Ctrl/Cmd + Shift + D: Mark as Done (Xong pháº§n nÃ y)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                if (activeThreadId) {
                    SP.parkCurrentThread?.();
                }
                return;
            }

            // Phase 2: Ctrl+N Notes shortcut removed (Notes tab gone)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                // no-op: Notes tab removed in Phase 2
                return;
            }

            // Ctrl/Cmd + K: Quick search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                SP.toggleQuickSearch?.();
                return;
            }

            // Ctrl/Cmd + Z: Undo last action
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                SP.undoLastAction?.();
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

            // Phase 2: Tab cycling removed (bottom tabs gone)

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

            // Alt+1..4: Main tab switch
            if (e.altKey && e.key >= '1' && e.key <= '3') {
                e.preventDefault();
                const tabs = ['chat', 'cards', 'saved'];
                const tabIndex = parseInt(e.key) - 1;
                if (tabs[tabIndex]) {
                    switchMainTab(tabs[tabIndex]);
                }
                return;
            }
        });
    }

    function switchToTab(tabName) {
        // Phase 2: Bottom tabs removed. No-op.
    }

    function cycleBottomTabs(direction) {
        // Phase 2: Bottom tabs removed. No-op.
        return;
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
        // Phase 2: Bottom tab badge counts removed (discussionsCount, notesCount, connectionsCount)

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
                if (_skipStorageReload) {
                    _skipStorageReload = false;
                    return;
                }
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
            SP.analyzeConnections?.(thread);
        }

        // Onboarding: Show tooltip for first highlight
        SP.checkAndShowContextualTooltip?.('first_highlight');

        if (highlight?.retentionAction) {
            SP.openRetentionFlow?.(highlight.retentionAction, highlight);
        }
    }

    // Smart Linking System extracted to sp_smartlink.js (Phase 4b)



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
        if (window.SP) window.SP.threads = threads;

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
        if (window.SP) window.SP.threads = threads;
        if (!currentDomain) return;

        const storageKey = `atom_sidepanel_highlight_${currentDomain}`;
        await chrome.storage.local.set({
            [storageKey]: {
                domain: currentDomain,
                threads: threads,
                updatedAt: Date.now(),
                sessionId: SP.SESSION_ID || 'unknown'
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
        SP.broadcastDataUpdate?.();
    }

    // ===========================
    // Conversation Digest Pipeline (Hybrid Memory Phase B)
    // ===========================

    /**
     * Detect user tier for digest quality.
     * Pro = user has own API key (BYOK), Free = shared quota or none.
     */
    async function getUserTier() {
        const apiKey = await getApiKey();
        return apiKey ? 'pro' : 'free';
    }

    /**
     * Check if thread qualifies for digesting.
     */
    function shouldDigestThread(thread) {
        if (!thread || !thread.messages) return false;
        const assistantCount = thread.messages.filter(m => m.role === 'assistant').length;
        if (assistantCount < 2) return false;
        if (thread._digested) return false;
        return true;
    }

    /**
     * Extract topic keywords from page context.
     */
    function extractTopicsFromContext(ctx) {
        const topics = [];
        if (ctx.topicKey) {
            const parts = ctx.topicKey.split(':');
            if (parts.length >= 2) topics.push(parts.slice(1).join(':'));
        }
        if (ctx.domain) topics.push(ctx.domain);
        if (ctx.title) {
            const titleWords = ctx.title
                .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3)
                .slice(0, 2);
            topics.push(...titleWords);
        }
        return [...new Set(topics)].slice(0, 5);
    }

    /**
     * Rule-based digest (Free tier) — extracts Q&A directly from messages.
     */
    function createDigestRuleBased(thread, ctx) {
        const userMsgs = (thread.messages || []).filter(m => m.role === 'user');
        const aiMsgs = (thread.messages || []).filter(m => m.role === 'assistant');
        const messageCount = thread.messages?.length || 0;
        const topics = extractTopicsFromContext(ctx);

        const keyQA = [];
        for (let i = 0; i < Math.min(userMsgs.length, 3); i++) {
            const q = userMsgs[i].content.slice(0, 200).trim();
            const a = (aiMsgs[i]?.content || '').slice(0, 300).trim();
            if (q && a) keyQA.push({ q, a });
        }

        const firstQ = userMsgs[0]?.content?.slice(0, 100) || '';
        const summary = firstQ
            ? `${messageCount} messages about "${(ctx.title || 'page').slice(0, 60)}". Main question: ${firstQ}`
            : `${messageCount} messages about "${(ctx.title || 'page').slice(0, 60)}"`;

        return {
            sessionId: activeSessionId || null,
            threadId: thread.id,
            domain: ctx.domain || currentDomain || '',
            pageUrl: ctx.url || '',
            pageTitle: (ctx.title || '').slice(0, 200),
            summary: summary.slice(0, 300),
            topics,
            keyQA,
            messageCount,
            highlightText: (thread.highlight?.text || '').slice(0, 200),
            digestMethod: 'rule_based'
        };
    }

    /**
     * LLM-based digest (Pro tier) — AI summarizes the conversation.
     */
    async function createDigestLLM(thread, ctx) {
        const conversationLog = (thread.messages || [])
            .slice(-12)
            .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 500)}`)
            .join('\n\n');

        const lang = navigator.language?.startsWith('vi') ? 'Vietnamese' : 'English';

        const digestPrompt = `Summarize this conversation for future reference.
Return JSON only, no markdown:
{
  "summary": "2-3 sentence summary in ${lang}",
  "topics": ["keyword1", "keyword2", "keyword3"],
  "keyQA": [
    {"q": "key question user asked", "a": "essential answer point (1-2 sentences)"}
  ]
}

Page: "${(ctx.title || '').slice(0, 200)}"
Domain: ${ctx.domain || ''}

Conversation:
${conversationLog}`;

        try {
            const systemInstr = 'Return valid JSON only. No markdown wrapping. Max 3 keyQA entries.';
            const history = [{ role: 'user', parts: [{ text: digestPrompt }] }];

            const response = await SP.callLLMAPI(systemInstr, history, {
                priority: 'background',
                allowFallback: true
            });

            if (!response) {
                console.warn('[Digest] LLM returned empty, falling back to rule-based');
                return createDigestRuleBased(thread, ctx);
            }

            const match = response.match(/\{[\s\S]*\}/);
            if (!match) throw new Error('No JSON found in LLM response');
            const parsed = JSON.parse(match[0]);

            return {
                sessionId: activeSessionId || null,
                threadId: thread.id,
                domain: ctx.domain || currentDomain || '',
                pageUrl: ctx.url || '',
                pageTitle: (ctx.title || '').slice(0, 200),
                summary: (parsed.summary || '').slice(0, 300),
                topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 5) : [],
                keyQA: Array.isArray(parsed.keyQA) ? parsed.keyQA.slice(0, 3).map(qa => ({
                    q: (qa.q || '').slice(0, 200),
                    a: (qa.a || '').slice(0, 300)
                })) : [],
                messageCount: thread.messages?.length || 0,
                highlightText: (thread.highlight?.text || '').slice(0, 200),
                digestMethod: 'llm'
            };
        } catch (parseErr) {
            console.warn('[Digest] LLM digest failed, falling back:', parseErr);
            return createDigestRuleBased(thread, ctx);
        }
    }

    /**
     * Embed a digest into VectorStore for semantic search.
     */
    async function embedDigest(digest) {
        if (!window.EmbeddingService || !window.VectorStore) return;

        const textParts = [
            digest.pageTitle || '',
            digest.summary || '',
            ...(digest.topics || []),
            ...(digest.keyQA || []).map(qa => `${qa.q} ${qa.a}`)
        ].filter(Boolean);

        const textToEmbed = textParts.join('\n').trim();
        if (!textToEmbed) return;

        try {
            const apiKey = await getApiKey();
            let embedding;

            if (apiKey) {
                embedding = await EmbeddingService.generateEmbedding(textToEmbed, apiKey);
            } else {
                // Use proxy embedding via background service worker
                const response = await chrome.runtime.sendMessage({
                    type: 'ATOM_PROXY_EMBED',
                    text: textToEmbed
                });
                if (response?.data?.embedding?.values) {
                    embedding = response.data.embedding.values;
                }
            }

            if (embedding) {
                await VectorStore.storeEmbedding(digest.digestId, embedding, {
                    type: 'digest',
                    domain: digest.domain,
                    title: digest.pageTitle,
                    summary: digest.summary
                });
                console.log(`[Digest] Embedded digest ${digest.digestId}`);
            }
        } catch (err) {
            console.warn('[Digest] Embedding failed (non-fatal):', err);
        }
    }

    /**
     * Digest all qualifying threads for the current/old page.
     * Fire-and-forget — does not block UI.
     */
    async function digestActiveThreads(threadsToDigest, ctx) {
        if (!threadsToDigest?.length || !ctx) return;
        if (!window.ConversationDigestStore) return;

        for (const thread of threadsToDigest) {
            if (!shouldDigestThread(thread)) continue;

            try {
                const tier = await getUserTier();
                const digest = tier === 'pro'
                    ? await createDigestLLM(thread, ctx)
                    : createDigestRuleBased(thread, ctx);

                await ConversationDigestStore.addDigest(digest);
                await embedDigest(digest);

                thread._digested = true;
                console.log(`[Digest] Created ${digest.digestMethod} digest for thread ${thread.id}`);
            } catch (err) {
                console.warn('[Digest] Failed for thread:', thread.id, err);
            }
        }
    }

    // Visibility change: digest when sidepanel is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && threads.length > 0 && pageContext) {
            digestActiveThreads([...threads], { ...pageContext });
        }
    });

    /**
     * Reinforce digests when user revisits a page.
     * Fire-and-forget, non-blocking.
     */
    async function reinforceOnPageVisit(pageUrl, domain) {
        if (!window.ConversationDigestStore) return;

        try {
            const digests = await ConversationDigestStore.loadDigests();
            let reinforced = 0;

            for (const d of digests) {
                const urlMatch = d.pageUrl && pageUrl && d.pageUrl === pageUrl;
                const domainMatch = d.domain && domain && d.domain === domain;

                if (urlMatch) {
                    await ConversationDigestStore.reinforceDigest(d.digestId, 0.15);
                    reinforced++;
                } else if (domainMatch) {
                    await ConversationDigestStore.reinforceDigest(d.digestId, 0.05);
                    reinforced++;
                }
            }

            if (reinforced > 0) {
                console.log(`[Memory] Reinforced ${reinforced} digests on page visit`);
            }
        } catch (err) {
            console.warn('[Memory] Reinforcement on page visit failed:', err);
        }
    }

    function renderThreadList() {
        // Phase 2: Render only the inline thread list (bottom tab path removed)
        renderInlineThreadList();
        updateAllCounts();
    }

    // ═══ Phase 2: Inline Thread List (replaces bottom tab) ═══
    let _inlineThreadPanel = null;

    function toggleInlineThreadList() {
        if (_inlineThreadPanel) {
            _inlineThreadPanel.remove();
            _inlineThreadPanel = null;
            return;
        }
        _inlineThreadPanel = document.createElement('div');
        _inlineThreadPanel.className = 'sp-inline-threads';
        _inlineThreadPanel.innerHTML = '<div class="sp-inline-threads__header"><span>' + getMessage('sp_inline_threads_header', 'Chat History') + '</span><button class="sp-inline-threads__close">&times;</button></div><div class="sp-inline-threads__list"></div>';
        const chat = elements.messages;
        if (chat) chat.parentNode.insertBefore(_inlineThreadPanel, chat);
        _inlineThreadPanel.querySelector('.sp-inline-threads__close').addEventListener('click', () => {
            _inlineThreadPanel?.remove();
            _inlineThreadPanel = null;
        });
        renderInlineThreadList();
    }

    function renderInlineThreadList() {
        if (!_inlineThreadPanel) return;
        const listEl = _inlineThreadPanel.querySelector('.sp-inline-threads__list');
        if (!listEl) return;
        const visibleThreads = getVisibleThreads();
        if (!visibleThreads.length) {
            listEl.innerHTML = '<div class="sp-note-empty">' + getMessage('sp_no_discussions', 'No chats yet') + '</div>';
            return;
        }
        listEl.innerHTML = visibleThreads.map(t => {
            const isActive = t.id === activeThreadId;
            const preview = t.isPageDiscussion
                ? (t.highlight?.title || t.highlight?.text || getMessage('sp_thread_page_discussion', 'Page Discussion')).slice(0, 60)
                : (t.highlight?.text || t.highlight?.title || getMessage('sp_thread_empty', 'Empty')).slice(0, 60);
            return `<div class="sp-thread-item ${isActive ? 'active' : ''}" data-thread-id="${t.id}">
                <div class="sp-thread-info"><div class="sp-thread-preview">${escapeHtml(preview)}...</div>
                <div class="sp-thread-meta">${formatTime(t.createdAt)}</div></div>
                <button class="sp-thread-delete" data-del-id="${t.id}" title="Delete">&times;</button></div>`;
        }).reverse().join('');
        listEl.querySelectorAll('.sp-thread-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.sp-thread-delete')) return;
                activeThreadId = item.dataset.threadId;
                renderInlineThreadList();
                renderActiveThread();
                switchMainTab('chat');
            });
        });
        listEl.querySelectorAll('.sp-thread-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const threadId = btn.dataset.delId;
                const idx = threads.findIndex(t => t.id === threadId);
                if (idx === -1) return;
                threads.splice(idx, 1);
                if (threadId === activeThreadId) {
                    const remaining = getVisibleThreads();
                    activeThreadId = remaining.length > 0 ? remaining[remaining.length - 1].id : null;
                }
                _skipStorageReload = true;
                await saveThreadsToStorage();
                renderInlineThreadList();
                renderActiveThread();
            });
        });
        const badge = document.getElementById('menu-threads-count');
        if (badge) badge.textContent = visibleThreads.length;
    }

    const INSIGHT_TOGGLE_ICONS = {
        show: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        hide: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94"></path><path d="M1 1l22 22"></path><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-4.23 5.94"></path><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"></path><path d="M9.88 9.88a3 3 0 0 1 4.24 4.24"></path></svg>`
    };

    function extractInsightTextFromMaybeJson(rawText) {
        const s = String(rawText || '').trim();
        if (!s) return '';

        // Strip markdown code fences and "json" prefix FIRST, before any checks
        let stripped = s
            .replace(/```(?:json)?\s*/gi, '')
            .replace(/```/g, '')
            .replace(/^"?json\s*/i, '')
            .trim();

        // If no JSON-like content, return cleaned text
        if (!stripped.includes('{')) return stripped || s;

        const match = stripped.match(/\{[\s\S]*\}/);
        if (!match) {
            // Fallback for truncated JSON: extract value after "insight" key directly
            const directMatch = stripped.match(/["']?insight["']?\s*:\s*["']([^"']+)/i);
            if (directMatch) return directMatch[1].trim();
            return stripped || s;
        }

        const candidate = match[0];

        // Helper to extract insight from parsed object (case-insensitive key)
        function getInsightValue(obj) {
            if (!obj || typeof obj !== 'object') return null;
            for (const key of ['insight', 'Insight', 'INSIGHT']) {
                if (typeof obj[key] === 'string' && obj[key].trim()) {
                    return obj[key].trim();
                }
            }
            return null;
        }

        try {
            const parsed = JSON.parse(candidate);
            const val = getInsightValue(parsed);
            if (val) return val;
            return stripped || s;
        } catch {
            try {
                const fixed = candidate
                    .replace(/,\s*([}\]])/g, '$1')
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                const parsed = JSON.parse(fixed);
                const val = getInsightValue(parsed);
                if (val) return val;
            } catch {
                // fall through
            }
            return stripped || s;
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
        SP.renderConnectionsList?.();

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
        const currentUrl = normalizeUrl(pageContext?.url);
        const insightThreads = threads.filter(t => t.refinedInsight && (!currentUrl || normalizeUrl(t?.highlight?.url) === currentUrl));

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
                    <span class="sp-insight-item-text">${escapeHtml(extractInsightTextFromMaybeJson(t.refinedInsight))}</span>
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

        // Get key insights from threads matching the current URL only
        const currentUrl = normalizeUrl(pageContext?.url);
        const insights = threads
            .filter(t => t.refinedInsight && (!currentUrl || normalizeUrl(t?.highlight?.url) === currentUrl))
            .map(t => ({ id: t.id, text: extractInsightTextFromMaybeJson(t.refinedInsight), type: 'insight' }))
            .filter(item => item.text);

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
                <div class="sp-session-insight-badge">ðŸ’¡</div>
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

    // renderConnectionsList extracted to sp_smartlink.js (Phase 4b)



    // ===========================
    // Page Context Extraction
    // ===========================
    async function loadPageContext() {
        setContextStatus('loading', 'Reading page...');

        try {
            const previousUrl = pageContext?.url || '';
            // Phase B: Digest old threads before loading new page (fire-and-forget)
            if (threads.length > 0 && pageContext) {
                const oldThreads = [...threads];
                const oldCtx = { ...pageContext };
                setTimeout(() => digestActiveThreads(oldThreads, oldCtx), 0);
            }
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
                if (window.SP) window.SP.pageContext = pageContext;
                SP.updateDeepAngleUI?.();

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
                await checkAndShowPrimer();

                // Phase 3: Check for related memory (non-blocking)
                checkAndShowRelatedMemory().catch(err => {
                    console.warn('[SidePanel] Related memory check failed:', err.message);
                });

                // Phase D: Reinforce digests when user revisits a page
                setTimeout(() => reinforceOnPageVisit(pageContext.url, currentDomain), 2000);

                // Update capture-post button visibility based on domain
                updateCapturePostVisibility();

                // Update notebook smart link (non-blocking)
                updateNotebookLink().catch(() => { });
            } else {
                // Log error only if all retries failed
                if (lastError) {
                    console.warn('[SidePanel] Content script not available:', lastError.message);
                }
                setContextStatus('error', getMessage('sp_page_read_failed', 'Failed to read page'));
                pageContext = null;
                elements.primerRoot?.classList.remove('active');
                if (elements.primerRoot) elements.primerRoot.innerHTML = '';
            }
        } catch (error) {
            console.error('[SidePanel] Error:', error);
            setContextStatus('error', 'Error loading page');
            pageContext = null;
            elements.primerRoot?.classList.remove('active');
            if (elements.primerRoot) elements.primerRoot.innerHTML = '';
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

        if (await tryHandleIntentLocally(message)) {
            elements.userInput.value = '';
            elements.userInput.style.height = 'auto';
            updateSendButton();
            updateCharCount();
            return;
        }

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
    // Quick Actions now merged into "/" command menu
    function showQuickActions() { /* no-op: merged into command menu */ }
    function hideQuickActions() { /* no-op: merged into command menu */ }

    async function handleQuickAction(type) {
        if (isLoading) return;

        // Handle save action separately (doesn't need AI)
        if (type === 'save') {
            if (SP.quickSaveHighlight) await SP.quickSaveHighlight();
            return;
        }

        // Handle quick-diary action â€” show inline widget
        if (type === 'quick-diary') {
            if (window.quickDiaryCtrl) {
                window.quickDiaryCtrl.show();
                window.quickDiaryCtrl.expand();
            }
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

        // If it's a page discussion and no highlight, use full article content
        const isPageLevel = thread.isPageDiscussion;
        const PAGE_LEVEL_MAX_CHARS = 20000; // ~5000 words for full article analysis
        const HIGHLIGHT_MAX_CHARS = 20000; // ~5000 words, same as page-level
        const promptMaxChars = isPageLevel ? PAGE_LEVEL_MAX_CHARS : HIGHLIGHT_MAX_CHARS;
        const highlightText = isPageLevel
            ? (pageContext?.content || '').slice(0, PAGE_LEVEL_MAX_CHARS)
            : (thread.highlight?.text || '');

        // Updated prompts with evidence format requirements
        const prompts = {
            'summarize': `Summarize this text concisely.
Format:
[Key phrases]: list 2-3 key phrases EXACTLY from the text
[Summary]: your summary in Vietnamese

Text: "${highlightText.slice(0, promptMaxChars)}"`,

            'keypoints': `Extract the key points from this text.
Format each point with evidence:
1. "quote" -> [your interpretation in Vietnamese]
(Note: The quote must be EXACTLY from the original text in original language)
2. "quote" -> [your interpretation in Vietnamese]

Text: "${highlightText.slice(0, promptMaxChars)}"`,

            'explain': `Explain this text simply and clearly.
Format:
[Evidence]: "[EXACT QUOTE from text in ORIGINAL LANGUAGE]"
[Explanation]: [Explain key concepts. IF user_persona is set, adapt complexity and use relevant analogies. ELSE, use simple ELI5 style. Contextualize: Who/What/Why? What is the implication?]

Text: "${highlightText.slice(0, promptMaxChars)}"`,

            'counter': `Provide counter-arguments to this text.
Format:
[Author claim]: [EXACT QUOTE from text in ORIGINAL LANGUAGE]
[Counter-argument]: [your counter-point in Vietnamese]
[Considerations]: [balanced view in Vietnamese]

Text: "${highlightText.slice(0, promptMaxChars)}"`,

            'connect': `How does this relate to the broader context?
Format:
[This passage]: [EXACT QUOTE from text in ORIGINAL LANGUAGE]
[Connection]: [how it relates to other concepts in Vietnamese]

Text: "${highlightText.slice(0, promptMaxChars)}"`
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
            // Check if user is signed in (can use proxy even without BYOK key)
            let isSignedIn = false;
            if (!apiKey) {
                try {
                    const authData = await chrome.storage.local.get('atom_auth_cache');
                    isSignedIn = !!authData?.atom_auth_cache?.isAuthenticated;
                } catch (e) { /* ignore */ }
            }
            if (!apiKey && !isSignedIn) {
                hideTypingIndicator();
                addErrorMessageToDOM(
                    getMessage('sp_error_no_api_key', 'AI Access Key not set'),
                    getMessage('sp_error_no_api_key_desc', 'Go to Settings to add your AI Access Key.'),
                    [{ label: getMessage('sp_error_cta_settings', 'Open Settings'), action: 'openSettings' }]
                );
                setLoading(false);
                return;
            }

            // Determine context level based on action and conversation state
            const messageCount = thread.messages?.filter(m => m.role === 'assistant').length || 0;
            const contextLevel = determineContextLevel(action, messageCount);

            // Phase C: Hybrid Recall — find related past conversations
            let recalledDigests = [];
            if (window.HybridRecallService && messageCount <= 8 && !action) {
                try {
                    recalledDigests = await HybridRecallService.hybridRecall(
                        userMessage, pageContext
                    );
                } catch (recallErr) {
                    console.warn('[HybridRecall] Failed:', recallErr);
                }
            }

            // Phase 4: gather reading context (non-blocking)
            let readingContext = null;
            try { readingContext = await buildReadingContext(); } catch { /* proceed without */ }

            const systemPrompt = buildSystemPrompt(thread, contextLevel, action, recalledDigests, readingContext);
            const conversationHistory = buildConversationHistory(thread, userMessage);
            const response = await SP.callLLMAPI(systemPrompt, conversationHistory, {
                priority: 'vip',
                allowFallback: true
            });

            hideTypingIndicator();

            if (response) {
                let renderedResponse = response;
                if (commandSystemEnabled && commandActionExecutor) {
                    try {
                        const handled = await commandActionExecutor.handleAIResponse(response);
                        renderedResponse = handled?.cleanText ?? response;
                    } catch (commandErr) {
                        console.warn('[CommandSystem] AI response handling failed:', commandErr);
                    }
                }

                if (!String(renderedResponse || '').trim()) {
                    renderedResponse = getMessage('cmdDone', 'Done!');
                }

                thread.messages.push({ role: 'assistant', content: renderedResponse });
                addMessageToDOM(renderedResponse, 'assistant');

                // Onboarding: Show tooltip after first chat exchange
                if (thread.messages.filter(m => m.role === 'assistant').length === 1) {
                    SP.checkAndShowContextualTooltip?.('first_chat');
                }

                await maybeAutoSummarize(thread);
            } else {
                addErrorMessageToDOM(
                    getMessage('sp_error_empty_response', 'No response received'),
                    getMessage('sp_error_empty_response_desc', 'The AI did not return a response. Please try again.'),
                    [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
                );
            }
        } catch (error) {
            console.error('[SidePanel] Gemini error:', error);
            hideTypingIndicator();

            // Quota exceeded — show specific toast (not rate limit countdown)
            if (error?.isQuotaExceeded || (SP.QuotaExceededError && error instanceof SP.QuotaExceededError)) {
                showToast(
                    getMessage('quota_exceeded_toast', 'Daily limit reached. Add your own API key in Settings.'),
                    'warning'
                );
                addErrorMessageToDOM(
                    getMessage('trial_banner_limit_reached', 'Daily AI limit reached'),
                    getMessage('quota_exceeded_toast', 'Daily limit reached. Add your own API key in Settings for unlimited use.'),
                    [{ label: getMessage('sp_error_cta_settings', 'Open Settings'), action: 'openSettings' }]
                );
                // Refresh trial banner to show updated usage
                if (typeof initTrialBanner === 'function') initTrialBanner();
                setLoading(false);
                return;
            }

            if (SP.ApiError && error instanceof SP.ApiError && error.status === 429) {
                // Extract retry-after seconds from error message if available
                let retrySeconds = 30; // Default
                const errorMsg = error.message || '';
                const retryMatch = errorMsg.match(/retry\s*(?:in|after)?\s*(\d+(?:\.\d+)?)\s*s/i);
                if (retryMatch) {
                    retrySeconds = Math.ceil(parseFloat(retryMatch[1]));
                }
                SP.showRateLimitCountdown?.(retrySeconds);
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
                actions: [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
            };
        }

        // API errors
        if (SP.ApiError && error instanceof SP.ApiError) {
            switch (error.status) {
                case 401:
                    return {
                        title: getMessage('sp_error_unauthorized', 'Invalid AI Access Key'),
                        description: getMessage('sp_error_unauthorized_desc', 'Your AI Access Key is invalid or expired.'),
                        actions: [{ label: getMessage('sp_error_cta_settings', 'Open Settings'), action: 'openSettings' }]
                    };
                case 429:
                    return {
                        title: getMessage('sp_error_rate_limit', 'Too many requests'),
                        description: getMessage('sp_error_rate_limit_desc', 'Please wait a moment before trying again.'),
                        actions: [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
                    };
                case 500:
                case 502:
                case 503:
                    return {
                        title: getMessage('sp_error_server', 'Server error'),
                        description: getMessage('sp_error_server_desc', 'The AI service is experiencing issues.'),
                        actions: [
                            { label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' },
                            { label: getMessage('sp_report_issue', 'Report issue'), action: 'report' }
                        ]
                    };
                default:
                    return {
                        title: error.message,
                        description: getMessage('sp_error_generic_desc', 'Something went wrong.'),
                        actions: [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
                    };
            }
        }

        // Timeout errors
        if (error.name === 'AbortError') {
            return {
                title: getMessage('sp_error_timeout', 'Request timed out'),
                description: getMessage('sp_error_timeout_desc', 'The request took too long. Please try again.'),
                actions: [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
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
            actions: [{ label: getMessage('sp_error_cta_retry', 'Try Again'), action: 'retry' }]
        };
    }

    function showOfflineMessageUI(message) {
        if (!elements.messages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'sp-message user pending';
        msgDiv.innerHTML = `
            <div class="sp-message-content">${escapeHtml(message)}</div>
            <div class="sp-message-pending-indicator">
                <span class="pending-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
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
                <span class="sp-error-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg></span>
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

    // ═══ Phase 4: Reading Context for AI ═══
    async function buildReadingContext() {
        const ctx = { reading: null, highlights: [], patterns: null };
        try {
            // Reading session stats
            if (activeSessionId && typeof ReadingSessionService !== 'undefined') {
                const session = await ReadingSessionService.getSessionById(activeSessionId);
                if (session) {
                    const elapsed = Date.now() - (session.startedAt || Date.now());
                    ctx.reading = {
                        duration: Math.floor(elapsed / 60000),
                        highlightCount: session.highlights?.length || 0,
                        insightCount: session.insights?.length || 0
                    };
                }
            }

            // Recent SRQ highlights for this page
            if (pageContext?.url) {
                const { loadCards } = await import('./storage/srq_store.js');
                const cards = await loadCards();
                ctx.highlights = cards
                    .filter(c => c.sourceUrl === pageContext.url && c.selectedText)
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 3)
                    .map(c => c.selectedText.slice(0, 120));
            }
        } catch (err) {
            console.warn('[Phase4] buildReadingContext failed:', err);
        }
        return ctx;
    }

    /**
     * Build system prompt with smart context levels
     * @param {Object} thread - Current thread
     * @param {string} contextLevel - MINIMAL, STANDARD, or FULL
     * @param {string} action - Quick action type (optional)
     */
    function buildSystemPrompt(thread, contextLevel = CONTEXT_LEVELS.STANDARD, action = null, recalledDigests = [], readingContext = null) {
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

        // Phase 4: Reading context enrichment
        if (readingContext && contextLevel !== CONTEXT_LEVELS.MINIMAL) {
            let rcBlock = '';
            if (readingContext.reading) {
                rcBlock += `- Reading for: ${readingContext.reading.duration}m`;
                if (readingContext.reading.highlightCount > 0) {
                    rcBlock += `, ${readingContext.reading.highlightCount} highlights`;
                }
                if (readingContext.reading.insightCount > 0) {
                    rcBlock += `, ${readingContext.reading.insightCount} insights`;
                }
                rcBlock += '\n';
            }
            if (readingContext.highlights?.length > 0) {
                rcBlock += `- User saved ${readingContext.highlights.length} note(s) from this page:\n`;
                readingContext.highlights.forEach(h => {
                    rcBlock += `  • "${h}"\n`;
                });
            }
            if (rcBlock) {
                prompt += `\nREADING CONTEXT:\n${rcBlock}`;
            }
        }

        // Add evidence requirement for better grounding
        prompt += `
RESPONSE REQUIREMENTS:
- Focus on the HIGHLIGHTED TEXT when answering
- Be clear and structured; use bullet points when appropriate
- When explaining or analyzing, cite specific phrases from the text using:
  [Evidence]: "exact quote"
  [Explanation]: your analysis
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

        // Phase C: Inject conversation memory
        if (recalledDigests.length > 0 && contextLevel !== CONTEXT_LEVELS.MINIMAL) {
            const memoryBlock = window.HybridRecallService?.formatDigestsForPrompt(recalledDigests);
            if (memoryBlock) {
                prompt += memoryBlock;
            }
        }

        if (commandSystemEnabled) {
            prompt += `\n${COMMAND_SYSTEM_PROMPT}\n`;
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
        if (!apiKey) {
            // Allow if user is signed in (proxy available)
            try {
                const authData = await chrome.storage.local.get('atom_auth_cache');
                if (!authData?.atom_auth_cache?.isAuthenticated) return;
            } catch (e) { return; }
        }

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
            const response = await SP.callGeminiAPI(apiKey, systemPrompt, history, 1, {
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
                <span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg></span>
                <span>${title}</span>
                <button class="sp-auto-summary-dismiss" aria-label="${actionDismiss}">&times;</button>
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
        const insight = data.takeaways.join(' \u2022 ');
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


    // LLM Provider Adapter extracted to sp_llm.js (Phase 4a)


    // Undo system extracted to sp_undo.js (Phase 3a)


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
        formatted = formatted.replace(/^[â€¢\-\*]\s+(.+)$/gm, '<li>$1</li>');
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
        if (window.SP) window.SP.isLoading = isLoading;
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
        SP.createUndoableAction?.(
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


    // Parking Lot extracted to sp_parking.js (Phase 3b)


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

        const llmConfig = await (SP.getLLMProvider ? SP.getLLMProvider() : Promise.resolve({ provider: 'google' }));
        const geminiKey = await getApiKey();
        let hasProviderKey = llmConfig.provider === 'openrouter'
            ? !!llmConfig.openrouterKey
            : !!geminiKey;
        // Also allow if user is signed in (proxy available)
        if (!hasProviderKey) {
            try {
                const authData = await chrome.storage.local.get('atom_auth_cache');
                if (authData?.atom_auth_cache?.isAuthenticated) hasProviderKey = true;
            } catch (e) { /* ignore */ }
        }
        if (!hasProviderKey) {
            showToast(getMessage('sp_error_no_api_key', 'AI Access Key not set'), 'error');
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
                .replace(/^"?json\s*/i, '')
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

            // Fallback for truncated JSON: extract insight value directly via regex
            if (!parsed || typeof parsed !== 'object') {
                const directMatch = stripped.match(/["']?insight["']?\s*:\s*["']([^"']+)/i);
                const catMatch = stripped.match(/["']?category["']?\s*:\s*["']([^"']+)/i);
                if (directMatch) {
                    return {
                        insight: directMatch[1].trim(),
                        category: catMatch ? catMatch[1].trim() : ''
                    };
                }
                return null;
            }
            const insight = typeof parsed.insight === 'string' ? parsed.insight : '';
            const category = typeof parsed.category === 'string' ? parsed.category : '';
            if (!insight && !category) return null;
            return { insight, category };
        };

        const normalizeInsightText = (text) => {
            const s = String(text || '').trim();
            if (!s) return '';
            const parsed = parseAtomicThoughtPayload(s);
            if (parsed?.insight) return parsed.insight.trim();
            // Last resort: try direct regex extraction for truncated JSON
            const directMatch = s.match(/["']?insight["']?\s*:\s*["']([^"']+)/i);
            if (directMatch) return directMatch[1].trim();
            return s;
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
            const response = await SP.callLLMAPI(systemPrompt, conversationHistory, {
                priority: 'vip',
                allowFallback: true,
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 1024
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

    // maybeAddInsightReviewCard + saveThreadToNLM + exportAllToNLM + showExportAllLoading + hideExportAllLoading extracted to sp_export.js (Phase 5)


    function showToast(message, type = 'info') {
        let toast = document.getElementById('sp-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sp-toast';
            document.body.appendChild(toast);
        }

        toast.className = `sp-toast ${type}`;
        toast.textContent = message;
        toast.style.display = 'block';

        // Restart animation when reusing the toast
        toast.style.animation = 'none';
        void toast.offsetHeight;
        toast.style.animation = '';

        if (toastTimeoutId) clearTimeout(toastTimeoutId);
        toastTimeoutId = setTimeout(() => {
            if (toast) toast.style.display = 'none';
        }, 3000);
    }

    // Export Dialog + Session Export + endSession extracted to sp_export.js (Phase 5)

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
            console.log('[SRQ] Saved tab: got', batches.length, 'batches, response:', response);
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
    // ═══ Phase 2E: Chat Nudge System ═══
    function renderChatNudge(nudgeData) {
        if (!elements.messages) return;
        const bubble = document.createElement('div');
        bubble.className = 'sp-nudge-bubble';
        const actionsHtml = (nudgeData.actions || []).map(a =>
            `<button class="sp-nudge-action" data-prompt="${escapeHtml(a.prompt || a.label)}">${escapeHtml(a.label)}</button>`
        ).join('');
        bubble.innerHTML = `<div class="sp-nudge-icon">💡</div><div class="sp-nudge-body"><div class="sp-nudge-text">${escapeHtml(nudgeData.message || '')}</div><div class="sp-nudge-actions">${actionsHtml}</div></div>`;
        bubble.querySelectorAll('.sp-nudge-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                if (prompt && elements.userInput) {
                    elements.userInput.value = prompt;
                    elements.userInput.focus();
                    bubble.remove();
                }
            });
        });
        elements.messages.appendChild(bubble);
        elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'CHAT_NUDGE' && msg.nudge) {
            renderChatNudge(msg.nudge);
            return;
        }
        if (msg?.type === "SRQ_CARDS_UPDATED") {
            // Wave 2 P1: Optional payload (reason, changedIds) - backward compatible
            debouncedRefreshSRQWidget();
            // Refresh notebook smart link when cards are exported
            updateNotebookLink().catch(() => { });
            // Invalidate review cards cache when SRQ data changes
            if (activeMainTab === 'cards') {
                window.ReviewCards?.refresh();
            }
            // Show toast when highlight is auto-exported to NLM
            if (msg.reason === 'auto_exported') {
                showToast(getMessage('sp_toast_auto_exported', 'Saved to Knowledge \u2713'), 'success');
            }
        } else if (msg?.type === "SRQ_SETTINGS_CHANGED") {
            debouncedRefreshSRQWidget();
        }
    });

    // ===========================
    // Start
    // ===========================

    // Theme sync - apply saved theme on load
    function initTheme() {
        chrome.storage.local.get(['atom_theme'], (data) => {
            if (data.atom_theme === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }
        });
    }

    // Listen for theme changes from other pages (popup, options, etc.)
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.atom_theme) {
            if (changes.atom_theme.newValue === 'light') {
                document.body.classList.add('light-mode');
            } else {
                document.body.classList.remove('light-mode');
            }
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        init();
        loadUserPreferences();
        startSessionTimer();
        mountSRQWidget();
        initTrialBanner();
        initUpdateBanner();
    });

    // ===========================
    // Trial / Quota Banner (Phase 1 Monetization)
    // ===========================
    const BANNER_DISMISS_KEY = 'atom_trial_banner_dismissed_until';
    const UPDATE_BANNER_DISMISS_KEY = 'atom_update_banner_dismissed_until';

    async function initTrialBanner() {
        const banner = document.getElementById('trial-banner');
        if (!banner) return;

        // Check if dismissed
        try {
            const { [BANNER_DISMISS_KEY]: dismissedUntil } = await chrome.storage.local.get([BANNER_DISMISS_KEY]);
            if (dismissedUntil && Date.now() < dismissedUntil) return;
        } catch { /* proceed */ }

        try {
            const status = await chrome.runtime.sendMessage({ type: 'ATOM_GET_QUOTA_STATUS' });
            if (!status || status.error) return;

            // BYOK users: no banner needed
            if (status.isByok) return;

            let className = '';
            let icon = '';
            let text = '';
            let usage = '';

            if (status.isTrial && status.trialDaysLeft > 7) {
                // Trial active, plenty of days left
                className = 'trial-active';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>';
                text = getMessage('trial_banner_active', `Early Access Pro — ${status.trialDaysLeft} days left`).replace('$1', status.trialDaysLeft);
                usage = `${status.used}/${status.limit} ${getMessage('trial_banner_today', 'today')}`;
            } else if (status.isTrial && status.trialDaysLeft <= 7) {
                // Trial warning
                className = 'trial-warning';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>';
                text = getMessage('trial_banner_warning', `Trial ending soon — ${status.trialDaysLeft} days left`).replace('$1', status.trialDaysLeft);
                usage = `${status.used}/${status.limit} ${getMessage('trial_banner_today', 'today')}`;
            } else if (!status.isTrial && !status.allowed) {
                // Free tier, limit reached
                className = 'trial-expired';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
                text = getMessage('trial_banner_limit_reached', 'Daily limit reached');
                usage = `${status.used}/${status.limit}`;
            } else if (!status.isTrial) {
                // Free tier, active
                className = 'trial-expired';
                icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>';
                text = getMessage('trial_banner_free', 'Free tier');
                usage = `${status.used}/${status.limit} ${getMessage('trial_banner_today', 'today')}`;
            }

            if (!text) return;

            banner.className = `sp-trial-banner visible ${className}`;
            banner.innerHTML = `
                <span class="sp-trial-banner__icon">${icon}</span>
                <span class="sp-trial-banner__text">${text}
                    <span class="sp-trial-banner__usage">${usage}</span>
                </span>
                <button class="sp-trial-banner__dismiss" aria-label="Dismiss">×</button>
            `;

            banner.querySelector('.sp-trial-banner__dismiss')?.addEventListener('click', () => {
                banner.classList.remove('visible');
                // Dismiss for 24 hours
                chrome.storage.local.set({ [BANNER_DISMISS_KEY]: Date.now() + 24 * 60 * 60 * 1000 });
            });
        } catch (e) {
            console.warn('[TrialBanner] Init failed:', e);
        }
    }

    async function initUpdateBanner() {
        const banner = document.getElementById('update-banner');
        if (!banner) return;

        // Check if dismissed
        try {
            const { [UPDATE_BANNER_DISMISS_KEY]: dismissedUntil } = await chrome.storage.local.get([UPDATE_BANNER_DISMISS_KEY]);
            if (dismissedUntil && Date.now() < dismissedUntil) return;
        } catch { /* proceed */ }

        try {
            const status = await chrome.runtime.sendMessage({ type: 'ATOM_GET_UPDATE_STATUS' });
            if (!status || !status.hasUpdate || status.dismissed) return;

            banner.className = 'sp-trial-banner visible update-available';
            banner.innerHTML = `
                <span class="sp-trial-banner__icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></span>
                <span class="sp-trial-banner__text">
                    ${getMessage('update_available', `v${status.latestVersion} available`)}
                    — <a class="sp-trial-banner__link" href="${status.downloadUrl}" target="_blank">${getMessage('update_download', 'Download')}</a>
                </span>
                <button class="sp-trial-banner__dismiss" aria-label="Dismiss">×</button>
            `;

            banner.querySelector('.sp-trial-banner__dismiss')?.addEventListener('click', () => {
                banner.classList.remove('visible');
                chrome.runtime.sendMessage({ type: 'ATOM_DISMISS_UPDATE' });
                chrome.storage.local.set({ [UPDATE_BANNER_DISMISS_KEY]: Date.now() + 7 * 24 * 60 * 60 * 1000 }); // 7 days
            });
        } catch (e) {
            console.warn('[UpdateBanner] Init failed:', e);
        }
    }

    // Auto-refresh Saved tab when SRQ cards are updated
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        // Silent Brain Phase 1: PONG handler for isSidepanelOpen() detection
        if (msg?.type === 'PING_SIDEPANEL') {
            sendResponse({ pong: true });
            return true;
        }
        if (msg?.type === 'SRQ_CARDS_UPDATED') {
            console.log('[SRQ] Cards updated, refreshing Saved tab');
            const activeTab = document.querySelector('.sp-main-tab-btn.active');
            if (activeTab?.dataset?.tab === 'saved' || activeTab?.textContent?.trim()?.toLowerCase()?.includes('saved')) {
                mountSRQWidget();
            }
        }
    });
})();


