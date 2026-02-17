/**
 * ai/providers/openrouter.js — OpenRouter API Provider
 * Phase 4: AI Layer
 *
 * Pure fetch logic for OpenRouter (OpenAI-compatible API).
 * No retry, no UI — those concerns are handled by sp_llm.js.
 *
 * IIFE — exposes via window.AtomProviders.openrouter
 * Used in sidepanel context (loaded as <script> tag)
 */
(function () {
    'use strict';

    const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const OPENROUTER_HEADERS = {
        'HTTP-Referer': 'https://atomextension.com',
        'X-Title': 'ATOM Extension'
    };

    /**
     * Known broken models — auto-swap to working alternatives
     */
    const MODEL_REDIRECTS = {
        'google/gemini-2.0-flash-exp:free': 'stepfun/step-3.5-flash:free'
    };

    /**
     * Default fallback chain when primary model fails
     */
    const FALLBACK_CHAIN = [
        'stepfun/step-3.5-flash:free',
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'mistralai/mistral-small-24b-instruct-2501:free'
    ];

    /**
     * Call OpenRouter API.
     *
     * @param {Object} params
     * @param {string} params.apiKey - OpenRouter API key
     * @param {string} params.model - Model identifier
     * @param {Array}  params.messages - OpenAI-format messages [{role, content}]
     * @param {Object} [params.generationConfig] - Temperature, maxOutputTokens
     * @param {number} [params.timeoutMs=30000] - Request timeout
     * @returns {Promise<string|null>} The response text or null
     */
    async function callOpenRouter({
        apiKey,
        model,
        messages,
        generationConfig = {},
        timeoutMs = 30000
    }) {
        // Auto-redirect broken models
        const targetModel = MODEL_REDIRECTS[model] || model;
        if (targetModel !== model) {
            console.warn(`[OpenRouter] Redirecting broken model ${model} → ${targetModel}`);
        }

        const body = {
            model: targetModel,
            messages,
            temperature: generationConfig.temperature ?? 0.7,
            max_tokens: generationConfig.maxOutputTokens ?? 4096,
            stream: false
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(OPENROUTER_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    ...OPENROUTER_HEADERS
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.error?.message || `OpenRouter API error ${response.status}`);
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || null;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    /**
     * Convert Gemini 'contents' format to OpenAI 'messages' format.
     *
     * @param {string} systemPrompt - System instruction text
     * @param {Array} geminiContents - Gemini-format contents [{role, parts}]
     * @returns {Array} OpenAI-format messages [{role, content}]
     */
    function convertToOpenRouterMessages(systemPrompt, geminiContents) {
        const messages = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        for (const item of geminiContents) {
            const role = item.role === 'model' ? 'assistant' : 'user';
            const text = item.parts?.map(p => p.text).join('\n') || '';
            if (text.trim()) {
                messages.push({ role, content: text });
            }
        }

        return messages;
    }

    /**
     * Get saved OpenRouter provider config from storage.
     * @returns {Promise<{provider: string, openrouterKey: string, openrouterModel: string}>}
     */
    async function getConfig() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'atom_llm_provider',
                'atom_openrouter_key',
                'atom_openrouter_model'
            ], (result) => {
                resolve({
                    provider: result.atom_llm_provider || 'google',
                    openrouterKey: result.atom_openrouter_key || '',
                    openrouterModel: result.atom_openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free'
                });
            });
        });
    }

    // ── Expose on window ──
    window.AtomProviders = window.AtomProviders || {};
    window.AtomProviders.openrouter = {
        call: callOpenRouter,
        convertMessages: convertToOpenRouterMessages,
        getConfig,
        FALLBACK_CHAIN,
        MODEL_REDIRECTS
    };

    console.log('[AI Provider] OpenRouter provider loaded');
})();
