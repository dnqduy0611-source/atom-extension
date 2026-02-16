// services/flashcard_deck.js
// Flashcard creation, storage, and retrieval

(function () {
    'use strict';

    const FLASHCARD_STORAGE_KEY = 'atom_flashcard_deck_v1';

    const CARD_TYPES = {
        INSIGHT: 'insight',
        CLOZE: 'cloze',
        QUIZ: 'quiz',
        TEACHBACK: 'teachback'
    };

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function clampText(text, limit) {
        if (!isNonEmptyString(text)) return '';
        const trimmed = text.trim();
        return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
    }

    function safeJsonParse(responseText) {
        if (!isNonEmptyString(responseText)) return null;
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }

    function createFlashcard(data) {
        const payload = data && typeof data === 'object' ? data : {};
        const now = Date.now();

        return {
            id: `fc_${now}_${Math.random().toString(36).slice(2, 8)}`,
            type: payload.type || CARD_TYPES.INSIGHT,
            front: isNonEmptyString(payload.front) ? payload.front.trim() : '',
            back: isNonEmptyString(payload.back) ? payload.back.trim() : '',

            sourceSessionId: payload.sourceSessionId || null,
            sourceHighlightId: payload.sourceHighlightId || null,
            sourceInsightId: payload.sourceInsightId || null,
            sourceUrl: payload.sourceUrl || null,
            sourceTitle: payload.sourceTitle || null,

            interval: 1,
            easeFactor: 2.5,
            dueDate: now + 24 * 60 * 60 * 1000,
            reviewCount: 0,
            lastReviewDate: null,
            lastQuality: null,

            correctCount: 0,
            incorrectCount: 0,

            createdAt: now,
            tags: Array.isArray(payload.tags) ? payload.tags : []
        };
    }

    async function createFromInsight(insight, sessionData, apiKey, callGeminiAPI) {
        const safeInsight = insight && typeof insight === 'object' ? insight : {};
        const safeSession = sessionData && typeof sessionData === 'object' ? sessionData : {};
        const insightText = clampText(safeInsight.text, 2000);

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return createFlashcard({
                type: CARD_TYPES.INSIGHT,
                front: `What is the key insight about "${clampText(insightText, 60)}"?`,
                back: insightText,
                sourceSessionId: safeSession.id,
                sourceInsightId: safeInsight.id,
                sourceUrl: safeSession.url,
                sourceTitle: safeSession.title
            });
        }

        const prompt = [
            'Convert this insight into a flashcard:',
            '',
            `Insight: "${insightText}"`,
            `Context: From article "${safeSession.title || ''}"`,
            '',
            'Create a flashcard with:',
            '1. Front: A question that tests recall of this insight',
            '2. Back: The answer (the insight itself, possibly rephrased)',
            '',
            'Return JSON:',
            '{',
            '  "front": "question here",',
            '  "back": "answer here"',
            '}'
        ].join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);

            if (!parsed || !isNonEmptyString(parsed.front) || !isNonEmptyString(parsed.back)) {
                throw new Error('invalid_flashcard_payload');
            }

            return createFlashcard({
                type: CARD_TYPES.INSIGHT,
                front: parsed.front,
                back: parsed.back,
                sourceSessionId: safeSession.id,
                sourceInsightId: safeInsight.id,
                sourceUrl: safeSession.url,
                sourceTitle: safeSession.title
            });
        } catch (err) {
            console.error('[Flashcard] Insight generation failed:', err);
            return createFlashcard({
                type: CARD_TYPES.INSIGHT,
                front: `What is the key insight about "${clampText(insightText, 60)}"?`,
                back: insightText,
                sourceSessionId: safeSession.id,
                sourceInsightId: safeInsight.id,
                sourceUrl: safeSession.url,
                sourceTitle: safeSession.title
            });
        }
    }

    async function createClozeCard(text, sessionData, apiKey, callGeminiAPI) {
        const safeText = clampText(text, 2000);
        const safeSession = sessionData && typeof sessionData === 'object' ? sessionData : {};

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return null;
        }

        const prompt = [
            'Create a cloze (fill-in-the-blank) flashcard from this text:',
            '',
            `Text: "${safeText}"`,
            '',
            'Identify the most important term or phrase and create a blank.',
            '',
            'Return JSON:',
            '{',
            '  "front": "sentence with {{blank}} where the key term should be",',
            '  "back": "the word/phrase that fills the blank",',
            '  "fullSentence": "the complete sentence"',
            '}'
        ].join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);

            if (!parsed || !isNonEmptyString(parsed.front) || !isNonEmptyString(parsed.back)) {
                throw new Error('invalid_cloze_payload');
            }

            return createFlashcard({
                type: CARD_TYPES.CLOZE,
                front: String(parsed.front).replace('{{blank}}', '_____'),
                back: parsed.back,
                sourceSessionId: safeSession.id,
                sourceUrl: safeSession.url,
                sourceTitle: safeSession.title
            });
        } catch (err) {
            console.error('[Flashcard] Cloze generation failed:', err);
            return null;
        }
    }

    function createFromQuiz(question, sessionData) {
        const safeQuestion = question && typeof question === 'object' ? question : {};
        const safeSession = sessionData && typeof sessionData === 'object' ? sessionData : {};
        let front = safeQuestion.question || '';
        let back = '';

        if (safeQuestion.type === 'multiple_choice') {
            const correctIndex = Number.isFinite(safeQuestion.correctIndex) ? safeQuestion.correctIndex : 0;
            const answer = safeQuestion.options?.[correctIndex] || '';
            const explanation = safeQuestion.explanation || '';
            back = `${answer}\n\n${explanation}`.trim();
        } else {
            back = safeQuestion.sampleAnswer || 'See original text for answer.';
        }

        return createFlashcard({
            type: CARD_TYPES.QUIZ,
            front: front,
            back: back,
            sourceSessionId: safeSession.id,
            sourceUrl: safeSession.url,
            sourceTitle: safeSession.title
        });
    }

    async function getAllCards() {
        try {
            return await new Promise(resolve => {
                chrome.storage.local.get([FLASHCARD_STORAGE_KEY], result => {
                    resolve(result[FLASHCARD_STORAGE_KEY] || []);
                });
            });
        } catch (err) {
            console.error('[Flashcard] Failed to load cards:', err);
            return [];
        }
    }

    async function saveCard(card) {
        try {
            const cards = await getAllCards();
            const existingIndex = cards.findIndex(c => c.id === card.id);

            if (existingIndex >= 0) {
                cards[existingIndex] = card;
            } else {
                cards.push(card);
            }

            return await new Promise(resolve => {
                chrome.storage.local.set({ [FLASHCARD_STORAGE_KEY]: cards }, resolve);
            });
        } catch (err) {
            console.error('[Flashcard] Failed to save card:', err);
            return null;
        }
    }

    async function deleteCard(cardId) {
        try {
            const cards = await getAllCards();
            const filtered = cards.filter(c => c.id !== cardId);

            return await new Promise(resolve => {
                chrome.storage.local.set({ [FLASHCARD_STORAGE_KEY]: filtered }, resolve);
            });
        } catch (err) {
            console.error('[Flashcard] Failed to delete card:', err);
            return null;
        }
    }

    async function getDueCards() {
        const cards = await getAllCards();
        const now = Date.now();
        return cards.filter(c => Number.isFinite(c.dueDate) && c.dueDate <= now);
    }

    async function getReviewQueue() {
        const cards = await getAllCards();
        const now = Date.now();
        const tomorrow = now + 24 * 60 * 60 * 1000;
        const nextWeek = now + 7 * 24 * 60 * 60 * 1000;

        return {
            overdue: cards.filter(c => c.dueDate < now - 24 * 60 * 60 * 1000),
            dueToday: cards.filter(c => c.dueDate <= now && c.dueDate >= now - 24 * 60 * 60 * 1000),
            tomorrow: cards.filter(c => c.dueDate > now && c.dueDate <= tomorrow),
            thisWeek: cards.filter(c => c.dueDate > tomorrow && c.dueDate <= nextWeek),
            later: cards.filter(c => c.dueDate > nextWeek),
            stats: {
                total: cards.length,
                mastered: cards.filter(c => c.interval >= 21).length,
                learning: cards.filter(c => c.interval < 21 && c.reviewCount > 0).length,
                new: cards.filter(c => c.reviewCount === 0).length
            }
        };
    }

    window.FlashcardDeck = {
        FLASHCARD_STORAGE_KEY,
        CARD_TYPES,
        createFlashcard,
        createFromInsight,
        createClozeCard,
        createFromQuiz,
        getAllCards,
        saveCard,
        deleteCard,
        getDueCards,
        getReviewQueue
    };
})();
