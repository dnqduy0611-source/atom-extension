/**
 * ai/providers/gemini.js — Google Gemini Direct API Provider
 * Phase 4: AI Layer
 *
 * Pure fetch logic for Gemini API. No retry, no cache, no UI.
 * Those concerns are handled by the caller (sp_llm.js).
 *
 * IIFE — exposes via window.AtomProviders.gemini
 * Used in sidepanel context (loaded as <script> tag)
 */
(function () {
    'use strict';

    const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

    /**
     * Call Gemini API directly with user's API key.
     *
     * @param {Object} params
     * @param {string} params.apiKey - User's Gemini API key
     * @param {string} params.model - Model name (e.g. 'gemini-2.5-flash')
     * @param {Array}  params.contents - Gemini-format contents array
     * @param {Object} [params.systemInstruction] - System instruction object
     * @param {Object} [params.generationConfig] - Temperature, maxOutputTokens, etc.
     * @param {number} [params.timeoutMs=30000] - Request timeout
     * @param {AbortSignal} [params.signal] - External abort signal
     * @returns {Promise<{response: Response}>} Raw fetch response
     */
    async function callGeminiDirect({
        apiKey,
        model,
        contents,
        systemInstruction,
        generationConfig = {},
        timeoutMs = 30000,
        signal
    }) {
        const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

        const body = { contents, generationConfig };
        if (systemInstruction) {
            body.systemInstruction = systemInstruction;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        if (signal) {
            signal.addEventListener('abort', () => controller.abort());
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return { response };
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    /**
     * Extract text content from a Gemini API response.
     * @param {Object} data - Parsed JSON from Gemini API
     * @returns {string|null} The text content or null
     */
    function parseGeminiResponse(data) {
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    /**
     * Build a simple Gemini contents array from a single prompt string.
     * @param {string} prompt - The prompt text
     * @returns {Array} Gemini-format contents
     */
    function promptToContents(prompt) {
        return [{ parts: [{ text: prompt }] }];
    }

    // ── Expose on window ──
    window.AtomProviders = window.AtomProviders || {};
    window.AtomProviders.gemini = {
        callDirect: callGeminiDirect,
        parseResponse: parseGeminiResponse,
        promptToContents,
        BASE_URL: GEMINI_BASE_URL
    };

    console.log('[AI Provider] Gemini provider loaded');
})();
