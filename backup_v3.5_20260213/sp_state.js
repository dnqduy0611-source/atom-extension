/**
 * sp_state.js — Shared State Bus for Sidepanel Modules
 * 
 * Phase 1 of Module Split. This file MUST load before all other
 * sidepanel scripts. It declares window.SP which acts as a bridge
 * between the main orchestrator (sidepanel.js) and extracted modules.
 * 
 * RULES:
 * - sidepanel.js owns the source of truth (closure vars)
 * - sidepanel.js syncs closure vars → window.SP after mutations
 * - Extracted modules read/write via window.SP
 * - Helpers (getMessage, showToast, etc.) are set by sidepanel.js in init()
 */

(function () {
    'use strict';

    if (window.SP) {
        console.warn('[SP] window.SP already exists, skipping re-init');
        return;
    }

    window.SP = {
        // ── Core State (synced by sidepanel.js) ──
        pageContext: null,
        threads: [],
        activeThreadId: null,
        activeSessionId: null,
        isLoading: false,
        isGeneratingInsight: false,
        isGeneratingDeepAngle: false,
        isInsightDisplayHidden: true,
        currentTabId: null,
        currentDomain: null,
        currentModeId: null,
        activeMainTab: 'chat',
        sessionStartTime: Date.now(),
        parkingLot: [],

        // ── Undo State ──
        undoStack: [],
        activeUndoToast: null,

        // ── Semantic Flags ──
        semanticFlags: {
            embeddingsEnabled: false,
            semanticSearchEnabled: false
        },
        acceptedCostWarning: false,
        userPersona: '',

        // ── API Configuration (default, overwritten by loadAIConfig) ──
        API_CONFIG: {
            MODEL_NAME: "gemini-3-flash-preview",
            FALLBACK_MODEL: "gemini-2.5-flash",
            API_BASE: "https://generativelanguage.googleapis.com/v1beta/models",
            MAX_CONTEXT_CHARS: 100000,
            TIMEOUT_MS: 30000,
            RETRY_MAX_ATTEMPTS: 3,
            RETRY_BASE_DELAY_MS: 1000,
            FALLBACK_CHAIN: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
            CACHE: {
                STRATEGY_TTL_MS: 30000,
                PILOT_TTL_MS: 900000,
                SMARTLINK_TTL_MS: 600000,
                RELATED_MEMORY_TTL_MS: 600000,
                DEEP_ANGLE_TTL_MS: 21600000,
                DEFAULT_BACKGROUND_TTL_MS: 300000,
                VIP_CACHE_ENABLED: false
            }
        },

        // ── DOM Elements (populated by sidepanel.js init) ──
        elements: {},

        // ── Shared Helpers (set by sidepanel.js after init) ──
        // Modules gọi: SP.getMessage('key', 'fallback')
        getMessage: null,
        getMessageWithArgs: null,
        getIcon: null,
        showToast: null,
        getApiKey: null,
        switchMainTab: null,

        // ── Debug ──
        _debug: false,
        log(label, ...args) {
            if (this._debug) console.debug(`[SP:${label}]`, ...args);
        }
    };

    console.log('[SP] State bus initialized');
})();
