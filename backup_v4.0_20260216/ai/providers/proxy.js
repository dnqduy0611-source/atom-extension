/**
 * ai/providers/proxy.js — Managed Proxy Provider Adapter
 * Phase 4: AI Layer
 *
 * Thin adapter for proxy calls in sidepanel context.
 * Uses chrome.runtime.sendMessage to route through background service worker.
 *
 * IIFE — exposes via window.AtomProviders.proxy
 * Used in sidepanel context (loaded as <script> tag)
 */
(function () {
    'use strict';

    /**
     * Check if the managed proxy is available.
     * Reads session token from storage.
     * 
     * @returns {Promise<{available: boolean, accessToken?: string}>}
     */
    async function isProxyAvailable() {
        try {
            const data = await chrome.storage.local.get('atom_proxy_session');
            const session = data?.atom_proxy_session;

            if (session?.access_token) {
                if (session.expires_at && Date.now() / 1000 > session.expires_at) {
                    console.warn('[Proxy] Session token expired');
                    return { available: false };
                }
                return { available: true, accessToken: session.access_token };
            }
            return { available: false };
        } catch (e) {
            console.warn('[Proxy] Session check failed:', e.message);
            return { available: false };
        }
    }

    /**
     * Call Gemini through the managed proxy via background service worker.
     *
     * @param {Object} params
     * @param {string} params.model - Gemini model name
     * @param {Array}  params.contents - Conversation contents
     * @param {string} [params.systemPrompt] - System instruction text
     * @param {Object} [params.generationConfig] - Generation config
     * @returns {Promise<string|null>} The response text or null
     */
    async function callProxyViaBackground({
        model,
        contents,
        systemPrompt,
        generationConfig = {}
    }) {
        const result = await chrome.runtime.sendMessage({
            type: 'ATOM_PROXY_GEMINI',
            model: model || 'gemini-2.0-flash-lite',
            contents,
            systemInstruction: systemPrompt
                ? { parts: [{ text: systemPrompt }] }
                : undefined,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                ...generationConfig
            }
        });

        if (result?.error) {
            const error = new Error(result.error);
            error.status = result.status || 500;
            error.code = result.code || 'PROXY_ERROR';
            if (result.code === 'AUTH_REQUIRED') error.isAuthRequired = true;
            if (result.isQuotaExceeded) error.isQuotaExceeded = true;
            throw error;
        }

        // Extract text from Gemini response format
        return result?.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    // ── Expose on window ──
    window.AtomProviders = window.AtomProviders || {};
    window.AtomProviders.proxy = {
        isAvailable: isProxyAvailable,
        callViaBackground: callProxyViaBackground
    };

    console.log('[AI Provider] Proxy provider loaded');
})();
