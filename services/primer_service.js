// services/primer_service.js
// Pre-reading primer generation and caching

(function () {
    'use strict';

    const PRIMER_CONFIG = {
        minContentLength: 500,
        maxQuestionsDisplay: 3,
        cacheExpiryMs: 24 * 60 * 60 * 1000,
        excludedDomains: [
            'google.com',
            'facebook.com',
            'twitter.com',
            'youtube.com',
            'linkedin.com',
            'github.com'
        ]
    };

    function normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
        } catch {
            return url || '';
        }
    }

    function shouldShowPrimer(pageContext) {
        if (!pageContext || !pageContext.url) return false;

        const domain = pageContext.domain
            ? String(pageContext.domain)
            : (() => {
                try {
                    return new URL(pageContext.url).hostname;
                } catch {
                    return '';
                }
            })();

        if (PRIMER_CONFIG.excludedDomains.some(d => domain.includes(d))) {
            return false;
        }

        if (!pageContext.content || pageContext.content.length < PRIMER_CONFIG.minContentLength) {
            return false;
        }

        const hasHeadings = Array.isArray(pageContext.headings) && pageContext.headings.length > 0;
        const isArticleLike = hasHeadings || pageContext.content.length > 2000;
        return isArticleLike;
    }

    function extractOutline(headings) {
        if (!Array.isArray(headings) || headings.length === 0) {
            return 'No clear structure detected';
        }

        return headings
            .slice(0, 10)
            .map(h => {
                const level = Number.isFinite(h.level) ? h.level : 1;
                const indent = Math.max(0, Math.min(level - 1, 4));
                const text = String(h.text || '').trim();
                return `${'  '.repeat(indent)}• ${text}`;
            })
            .join('\n');
    }

    async function generatePrimer(pageContext, apiKey, callGeminiAPI) {
        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return { success: false, error: 'missing_api' };
        }

        const outline = extractOutline(pageContext.headings);
        const firstChunk = String(pageContext.content || '').slice(0, 2000);

        const targetLang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const prompt = `Analyze this article and generate 3 guiding questions for a reader.
        
Target Language: ${targetLang} (Questions must be in this language).

Article Title: ${pageContext.title || 'Untitled'}

Structure:
${outline}

Opening content:
${firstChunk}

Generate 3 questions following Bloom's Taxonomy levels:
1. UNDERSTANDING question - What is the core concept/problem being discussed?
2. APPLICATION question - How could this be applied in practice?
3. EVALUATION question - What are the trade-offs or implications?

Format your response as JSON:
{
  "topic": "Brief topic summary (5-10 words)",
  "questions": [
    { "level": "understanding", "question": "...", "hint": "Look for... (10 words max)" },
    { "level": "application", "question": "...", "hint": "Consider... (10 words max)" },
    { "level": "evaluation", "question": "...", "hint": "Compare... (10 words max)" }
  ]
}

Return ONLY valid JSON, no markdown.`;

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = [{
                role: 'user',
                parts: [{ text: prompt }]
            }];

            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            if (!response) throw new Error('empty_response');

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('invalid_json');

            const data = JSON.parse(jsonMatch[0]);
            if (!data || !Array.isArray(data.questions)) throw new Error('invalid_payload');

            return {
                success: true,
                topic: String(data.topic || '').trim(),
                questions: data.questions.slice(0, PRIMER_CONFIG.maxQuestionsDisplay),
                generatedAt: Date.now()
            };
        } catch (err) {
            return { success: false, error: err.message || 'generation_failed' };
        }
    }

    async function wasPrimerShown(url) {
        const normalizedUrl = normalizeUrl(url);
        const result = await chrome.storage.local.get(['atom_primers_shown']);
        const shown = result.atom_primers_shown || {};
        const entry = shown[normalizedUrl];
        if (!entry) return false;
        const isExpired = Date.now() - entry.shownAt > PRIMER_CONFIG.cacheExpiryMs;
        return !isExpired;
    }

    async function markPrimerShown(url) {
        const normalizedUrl = normalizeUrl(url);
        const result = await chrome.storage.local.get(['atom_primers_shown']);
        const shown = result.atom_primers_shown || {};
        shown[normalizedUrl] = { shownAt: Date.now() };

        const entries = Object.entries(shown);
        if (entries.length > 100) {
            const sorted = entries.sort((a, b) => b[1].shownAt - a[1].shownAt);
            const trimmed = Object.fromEntries(sorted.slice(0, 100));
            await chrome.storage.local.set({ atom_primers_shown: trimmed });
            return;
        }

        await chrome.storage.local.set({ atom_primers_shown: shown });
    }

    window.PrimerService = {
        PRIMER_CONFIG,
        shouldShowPrimer,
        generatePrimer,
        wasPrimerShown,
        markPrimerShown
    };
})();
