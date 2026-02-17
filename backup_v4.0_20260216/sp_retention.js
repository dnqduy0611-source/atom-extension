/**
 * sp_retention.js — Retention Loop System
 * Phase 3b of Sidepanel Module Split
 *
 * Handles: Quiz flow, Teach-back flow, Flashcard review,
 * comprehension scoring, retention overlay UI.
 *
 * Dependencies (read from window.SP):
 *   SP.getMessage, SP.showToast, SP.getApiKey, SP.callGeminiAPI,
 *   SP.activeSessionId, SP.pageContext
 *
 * External services (accessed directly via window.*):
 *   QuizGeneratorService, QuizUI, TeachBackService, TeachBackUI,
 *   FlashcardDeck, FlashcardUI, SpacedRepetitionService,
 *   ComprehensionScoringService, ReadingSessionService
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Retention] SP not found'); return; }

    // ── State ──
    let retentionOverlay = null;

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }
    async function getApiKey() { return SP.getApiKey ? SP.getApiKey() : null; }
    function callGeminiAPI(...args) { return SP.callGeminiAPI ? SP.callGeminiAPI(...args) : Promise.reject('No API'); }

    // ===========================
    // Retention String Helpers
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

    // ===========================
    // Overlay UI
    // ===========================
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

    // ===========================
    // History & Scoring
    // ===========================
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

    // ===========================
    // Main Entry Point
    // ===========================
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

    // ===========================
    // Quiz Flow
    // ===========================
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
            title: highlight.title || SP.pageContext?.title || '',
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

                const activeSessionId = SP.activeSessionId;
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

    // ===========================
    // Teach-back Flow
    // ===========================
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

                const activeSessionId = SP.activeSessionId;
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
                const activeSessionId = SP.activeSessionId;
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

    // ===========================
    // Flashcard Review Flow
    // ===========================
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

    // ── Expose API on SP ──
    SP.openRetentionFlow = openRetentionFlow;
    SP.closeRetentionOverlay = closeRetentionOverlay;

    console.log('[SP:Retention] Module loaded');
})();
