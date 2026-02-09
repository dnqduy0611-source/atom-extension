// services/learning_objective.js
// Reading mode and learning objective management

(function () {
    'use strict';

    const READING_MODES = {
        skim: {
            id: 'skim',
            label: 'Skim',
            description: 'Quick overview',
            chips: ['summarize', 'keypoints', 'explain', 'save'],
            responseStyle: 'concise'
        },
        deep: {
            id: 'deep',
            label: 'Deep',
            description: 'Full analysis',
            chips: ['summarize', 'keypoints', 'explain', 'analyze', 'example', 'counter', 'connect', 'save'],
            responseStyle: 'detailed'
        }
    };

    const MODE_STORAGE_KEY = 'atom_reading_mode_default';

    const BLOOM_LEVELS = {
        1: { key: 'sp_bloom_level_1', fallback: 'Remember' },
        2: { key: 'sp_bloom_level_2', fallback: 'Understand' },
        3: { key: 'sp_bloom_level_3', fallback: 'Apply' },
        4: { key: 'sp_bloom_level_4', fallback: 'Analyze' },
        5: { key: 'sp_bloom_level_5', fallback: 'Evaluate' },
        6: { key: 'sp_bloom_level_6', fallback: 'Create' }
    };

    const BLOOM_ACTION_MAP = {
        summarize: 2,
        keypoints: 1,
        explain: 2,
        analyze: 4,
        example: 3,
        counter: 5,
        connect: 4
    };

    async function getSessionMode(sessionId) {
        if (sessionId && typeof ReadingSessionService !== 'undefined') {
            const session = await ReadingSessionService.getSession(sessionId);
            const modeId = session?.learningObjective?.mode;
            if (modeId && READING_MODES[modeId]) {
                return READING_MODES[modeId];
            }
        }

        return getUserDefaultMode();
    }

    async function setSessionMode(sessionId, modeId) {
        if (!sessionId || !READING_MODES[modeId]) return null;
        if (typeof ReadingSessionService === 'undefined') return null;

        const session = await ReadingSessionService.getSession(sessionId);
        if (!session) return null;

        const nextObjective = {
            ...(session.learningObjective || {}),
            mode: modeId,
            updatedAt: Date.now()
        };

        return ReadingSessionService.updateSession(sessionId, {
            learningObjective: nextObjective
        });
    }

    async function getUserDefaultMode() {
        const result = await chrome.storage.local.get([MODE_STORAGE_KEY]);
        const modeId = result[MODE_STORAGE_KEY] || 'deep';
        return READING_MODES[modeId] || READING_MODES.deep;
    }

    async function setUserDefaultMode(modeId) {
        if (!READING_MODES[modeId]) return;
        await chrome.storage.local.set({ [MODE_STORAGE_KEY]: modeId });
    }

    function getChipsForMode(modeId) {
        const mode = READING_MODES[modeId] || READING_MODES.deep;
        return mode.chips || [];
    }

    function getResponseStylePrompt(modeId) {
        const mode = READING_MODES[modeId] || READING_MODES.deep;
        if (mode.responseStyle === 'concise') {
            return [
                'RESPONSE STYLE: CONCISE',
                '- Keep responses brief and to the point',
                '- Use bullet points when listing items',
                '- Focus on key takeaways only',
                '- Avoid long digressions'
            ].join('\n');
        }

        return [
            'RESPONSE STYLE: DETAILED',
            '- Provide clear explanations with context',
            '- Include relevant examples when helpful',
            '- Explore implications or trade-offs',
            '- Suggest follow-up questions if useful'
        ].join('\n');
    }

    function getBloomMeta(actionId) {
        const level = BLOOM_ACTION_MAP[actionId];
        if (!level) return null;
        return { level, ...BLOOM_LEVELS[level] };
    }

    function getBloomPrompt(actionId) {
        const meta = getBloomMeta(actionId);
        if (!meta) return '';
        return `COGNITIVE LEVEL: ${meta.fallback} (Level ${meta.level})`;
    }

    window.LearningObjectiveService = {
        READING_MODES,
        getSessionMode,
        setSessionMode,
        getUserDefaultMode,
        setUserDefaultMode,
        getChipsForMode,
        getResponseStylePrompt,
        getBloomMeta,
        getBloomPrompt
    };
})();
