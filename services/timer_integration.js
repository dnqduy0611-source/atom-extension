// services/timer_integration.js
// Focus timer linkage with ReadingSession + recall review

(function () {
    'use strict';

    const LINK_KEY = 'atom_focus_linked_session_v1';

    async function getApiKey() {
        const data = await chrome.storage.local.get(['user_gemini_key']);
        return data.user_gemini_key || null;
    }

    async function getAiConfig() {
        const data = await chrome.storage.local.get(['atom_ai_config_v1']);
        const config = data.atom_ai_config_v1 || {};
        return {
            model: config.MODELS?.USER?.primary || 'gemini-2.0-flash',
            apiBase: config.API?.BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models',
            timeoutMs: config.DEFAULTS?.TIMEOUT_MS || 30000
        };
    }

    async function callGemini(apiKey, prompt, config) {
        const url = `${config.apiBase}/${config.model}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 512 }
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`API ${response.status}`);
            }
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    }

    async function startFocusTracking(focusState, pageContext) {
        if (!focusState?.sessionId || !pageContext?.url) return null;
        if (typeof ReadingSessionService === 'undefined') return null;

        const url = pageContext.url;
        const title = pageContext.title || '';
        let domain = '';
        try {
            domain = new URL(url).hostname;
        } catch {
            domain = '';
        }

        const session = await ReadingSessionService.getOrCreateSession(url, title, domain);
        const focusSession = {
            sessionId: focusState.sessionId,
            startedAt: Date.now(),
            workMin: focusState.workMin,
            breakMin: focusState.breakMin,
            metrics: {
                highlightsCreated: session.highlights?.length || 0,
                insightsCreated: session.insights?.length || 0,
                messagesExchanged: session.thread?.messages?.length || 0,
                scrollDepth: 0
            }
        };

        await ReadingSessionService.updateSession(session.id, {
            focusSession
        });

        await chrome.storage.local.set({
            [LINK_KEY]: {
                focusSessionId: focusState.sessionId,
                sessionId: session.id,
                url,
                title,
                startedAt: focusSession.startedAt
            }
        });

        return session;
    }

    async function getLinkedSession() {
        const data = await chrome.storage.local.get([LINK_KEY]);
        return data[LINK_KEY] || null;
    }

    async function clearLinkedSession() {
        await chrome.storage.local.remove([LINK_KEY]);
    }

    async function onWorkPhaseEnd(sessionId) {
        if (!sessionId || typeof ReadingSessionService === 'undefined') return null;
        const session = await ReadingSessionService.getSession(sessionId);
        if (!session) return null;

        const recallQuestion = await generateRecallQuestion(session);
        if (session.focusSession) {
            session.focusSession.review = {
                recallQuestion,
                createdAt: Date.now()
            };
            await ReadingSessionService.updateSession(sessionId, { focusSession: session.focusSession });
        }

        return {
            sessionId,
            recallQuestion,
            summary: {
                title: session.title,
                stats: {
                    highlights: session.highlights?.length || 0,
                    insights: session.insights?.length || 0,
                    messages: session.thread?.messages?.length || 0,
                    scrollDepth: session.focusSession?.metrics?.scrollDepth || 0
                }
            }
        };
    }

    async function generateRecallQuestion(session) {
        const fallback = 'What are the 2-3 key points you just read?';
        const apiKey = await getApiKey();
        if (!apiKey) return fallback;

        const config = await getAiConfig();
        const highlights = (session.highlights || []).slice(0, 3).map(h => h.text).join('\n');
        const insights = (session.insights || []).slice(0, 3).map(i => i.text).join('\n');

        const targetLang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const prompt = `Based on this reading session, generate ONE recall question.

Target Language: ${targetLang} (Question must be in this language).

Title: ${session.title || 'Untitled'}

Highlights:
${highlights || 'None'}

Insights:
${insights || 'None'}

Return ONLY the question.`;

        try {
            const text = await callGemini(apiKey, prompt, config);
            const cleaned = String(text || '').trim().replace(/^["'`]+|["'`]+$/g, '');
            return cleaned || fallback;
        } catch (err) {
            console.error('[TimerIntegration] generateRecallQuestion error:', err.message || err);
            return fallback;
        }
    }

    async function recordRecallAnswer(sessionId, answer) {
        if (!sessionId || typeof ReadingSessionService === 'undefined') return null;
        const session = await ReadingSessionService.getSession(sessionId);
        if (!session?.focusSession?.review) return null;

        const score = await scoreRecallAnswer(session, session.focusSession.review.recallQuestion, answer);
        session.focusSession.review.recallAnswer = answer;
        session.focusSession.review.recallScore = score?.score ?? null;
        session.focusSession.review.recallFeedback = score?.feedback || '';

        await ReadingSessionService.updateSession(sessionId, { focusSession: session.focusSession });
        return score;
    }

    async function scoreRecallAnswer(session, question, answer) {
        const fallback = {
            score: null,
            feedback: 'Saved. Review your notes to reinforce recall.'
        };
        const apiKey = await getApiKey();
        if (!apiKey) return fallback;

        const config = await getAiConfig();
        const context = (session.highlights || []).slice(0, 3).map(h => h.text).join('\n');
        const targetLang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const prompt = `Score this recall answer in 1-2 sentences.

Target Language: ${targetLang} (Feedback must be in this language).

Question: ${question}
Answer: ${answer}

Context:
${context || 'N/A'}

Return JSON: {"score":0-100,"feedback":"..."} only.`;

        try {
            const text = await callGemini(apiKey, prompt, config);
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    score: Number.isFinite(parsed.score) ? parsed.score : null,
                    feedback: String(parsed.feedback || '')
                };
            }
        } catch (err) {
            console.error('[TimerIntegration] scoreRecallAnswer error:', err.message || err);
            return fallback;
        }

        return fallback;
    }

    window.TimerIntegration = {
        startFocusTracking,
        onWorkPhaseEnd,
        recordRecallAnswer,
        getLinkedSession,
        clearLinkedSession
    };
})();
