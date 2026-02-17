/**
 * Proxy Service — Routes AI calls through managed Supabase Edge Function
 * 
 * Used when user has NO own API key (non-BYOK) but IS signed in.
 * The proxy holds the managed Gemini key server-side.
 * 
 * @fileoverview Phase 3B of Monetization
 */

import { SUPABASE_CONFIG } from '../config/supabase_config.js';

const PROXY_URL = `${SUPABASE_CONFIG.URL}/functions/v1/gemini-proxy`;
const PROXY_TIMEOUT_MS = 35000; // Slightly longer than Gemini's own timeout

/**
 * Check if proxy is available (user is signed in with valid session)
 * Reads JWT from atom_proxy_session stored by auth_service.js
 * @returns {Promise<{available: boolean, accessToken?: string}>}
 */
export async function isProxyAvailable() {
    try {
        const data = await chrome.storage.local.get('atom_proxy_session');
        const session = data?.atom_proxy_session;

        if (session?.access_token) {
            // Check if token is expired
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
 * Call Gemini API through the managed proxy
 * 
 * @param {Object} params
 * @param {string} params.model - Gemini model name
 * @param {Array} params.contents - Conversation contents
 * @param {Object} [params.systemInstruction] - System instruction
 * @param {Object} [params.generationConfig] - Generation config
 * @param {string} params.accessToken - Supabase JWT access token
 * @returns {Promise<Object>} Raw Gemini API response
 */
export async function callGeminiProxy({ model, contents, systemInstruction, generationConfig, accessToken }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_CONFIG.ANON_KEY
            },
            body: JSON.stringify({
                model: model || 'gemini-2.0-flash-lite',
                contents,
                systemInstruction,
                generationConfig
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));

            // Map proxy errors to standard error structure
            const error = new Error(errData.error || `Proxy error ${response.status}`);
            error.status = response.status;
            error.code = errData.code || 'PROXY_ERROR';

            // Special handling for quota exceeded from proxy
            if (errData.code === 'QUOTA_EXCEEDED') {
                error.isQuotaExceeded = true;
            }

            throw error;
        }

        return await response.json();

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            const error = new Error('Proxy request timed out');
            error.status = 408;
            error.code = 'PROXY_TIMEOUT';
            throw error;
        }
        throw err;
    }
}

/**
 * Call embedding API through proxy.
 * @param {Object} params - { text, accessToken, model?, outputDimensionality? }
 * @returns {Promise<Object>} Embedding response with { embedding: { values: number[] } }
 */
export async function callEmbeddingProxy({ text, accessToken, model, outputDimensionality }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': SUPABASE_CONFIG.ANON_KEY
            },
            body: JSON.stringify({
                action: 'embed',
                text,
                model: model || 'text-embedding-004',
                outputDimensionality: outputDimensionality || 256
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const error = new Error(errData.error || `Proxy embed error ${response.status}`);
            error.status = response.status;
            error.code = errData.code || 'PROXY_EMBED_ERROR';
            throw error;
        }

        return await response.json();

    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const error = new Error('Proxy embed request timed out');
            error.status = 408;
            error.code = 'PROXY_TIMEOUT';
            throw error;
        }
        throw err;
    }
}
