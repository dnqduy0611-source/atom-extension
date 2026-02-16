// config/feature_flags.js
// Central feature flags for Phase 1+ features

(function () {
    'use strict';

    const FEATURE_FLAGS = {
        // Phase 1: UX Foundation
        PRIMER_ENABLED: true,           // Pre-reading primer with guiding questions
        READING_MODES_ENABLED: true,    // Skim/Deep mode selection
        NUDGES_ENABLED: true,           // Smart nudges for passive reading
        TIMER_INTEGRATION_ENABLED: true, // Focus timer linkage with recall

        // Phase 2: Retention Loop (ready but disabled)
        QUIZ_ENABLED: false,            // Spaced quiz after reading
        TEACH_BACK_ENABLED: false,      // Self-explanation assessment
        FLASHCARDS_ENABLED: false,      // Auto-generated flashcards
        SPACED_REPETITION_ENABLED: false, // SM-2 algorithm for review scheduling

        // Phase 3: Semantic Brain (ready but disabled)
        EMBEDDINGS_ENABLED: false,      // Vector embeddings for semantic search
        KNOWLEDGE_GRAPH_ENABLED: false, // Connection visualization
        SEMANTIC_SEARCH_ENABLED: false, // Natural language search

        // Nudge thresholds (configurable)
        NUDGE_PASSIVE_INTERVAL_MS: 30000,  // 30 seconds of no interaction
        NUDGE_FAST_SCROLL_THRESHOLD: 3000, // pixels per second
        NUDGE_AUTO_DISMISS_MS: 12000,      // Auto-dismiss after 12 seconds

        // Primer settings
        PRIMER_MIN_CONTENT_LENGTH: 500,    // Minimum content length to show primer
        PRIMER_MAX_QUESTIONS: 3,           // Max guiding questions

        // Timer settings
        TIMER_RECALL_QUESTION_ENABLED: true, // Show recall question at end of work phase

        // Phase 0: AI Command Routing (behind flag, OFF by default)
        AI_COMMANDS_ENABLED: true,         // Hub-Spoke command routing system

        // Metrics collection
        METRICS_ENABLED: true,             // Collect reading/interaction metrics
        METRICS_SCROLL_DEPTH_ENABLED: true,
        METRICS_TIME_TRACKING_ENABLED: true
    };

    const STORAGE_KEY = 'atom_feature_flags_v1';
    const AI_COMMANDS_ROLLOUT_PERCENT = 5;

    async function getManualAiCommandsOverride() {
        const data = await chrome.storage.local.get([
            STORAGE_KEY,
            'ff_ENABLE_AI_COMMANDS',
            'ff_AI_COMMANDS_ENABLED'
        ]);

        if (typeof data.ff_ENABLE_AI_COMMANDS === 'boolean') {
            return data.ff_ENABLE_AI_COMMANDS;
        }
        if (typeof data.ff_AI_COMMANDS_ENABLED === 'boolean') {
            return data.ff_AI_COMMANDS_ENABLED;
        }

        const stored = data[STORAGE_KEY] || {};
        if (Object.prototype.hasOwnProperty.call(stored, 'AI_COMMANDS_ENABLED')) {
            return !!stored.AI_COMMANDS_ENABLED;
        }
        if (Object.prototype.hasOwnProperty.call(stored, 'ENABLE_AI_COMMANDS')) {
            return !!stored.ENABLE_AI_COMMANDS;
        }

        return null;
    }

    async function shouldEnableAiCommands() {
        const manual = await getManualAiCommandsOverride();
        if (typeof manual === 'boolean') return manual;

        // Respect code default — skip rollout when flag is explicitly true
        if (FEATURE_FLAGS.AI_COMMANDS_ENABLED) return true;

        // Gradual rollout only when default is false
        const installData = await chrome.storage.local.get(['atom_install_id']);
        let installId = installData.atom_install_id;
        if (!installId) {
            installId = crypto.randomUUID();
            await chrome.storage.local.set({ atom_install_id: installId });
        }

        const hash = simpleHash(installId);
        return (hash % 100) < AI_COMMANDS_ROLLOUT_PERCENT;
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i += 1) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash &= hash;
        }
        return Math.abs(hash);
    }

    async function getFlags() {
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        return { ...FEATURE_FLAGS, ...(data[STORAGE_KEY] || {}) };
    }

    async function setFlag(key, value) {
        if (!(key in FEATURE_FLAGS)) {
            console.warn('[FeatureFlags] Unknown flag:', key);
            return;
        }
        const data = await chrome.storage.local.get([STORAGE_KEY]);
        const current = data[STORAGE_KEY] || {};
        current[key] = value;
        await chrome.storage.local.set({ [STORAGE_KEY]: current });
        console.log('[FeatureFlags] Set', key, '=', value);
    }

    async function isEnabled(key) {
        if (key === 'AI_COMMANDS_ENABLED' || key === 'ENABLE_AI_COMMANDS') {
            return shouldEnableAiCommands();
        }
        const flags = await getFlags();
        return !!flags[key];
    }

    async function getValue(key) {
        const flags = await getFlags();
        return flags[key];
    }

    async function resetToDefaults() {
        await chrome.storage.local.remove([STORAGE_KEY]);
        console.log('[FeatureFlags] Reset to defaults');
    }

    window.FeatureFlags = {
        DEFAULTS: FEATURE_FLAGS,
        getFlags,
        setFlag,
        isEnabled,
        getValue,
        resetToDefaults
    };
})();
