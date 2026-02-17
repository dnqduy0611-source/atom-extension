/**
 * AI Title Generator - Generate smart notebook titles using Gemini Flash
 * Used by NLM Bridge for creating semantic, concise notebook names
 */

import { AI_CONFIG, getModel } from '../config/ai_config.js';
import { getEffectiveLanguage } from '../utils/i18n_utils.js';

// Cache for generated titles (URL+selection hash → title)
const titleCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a smart title for a notebook using AI
 * @param {Object} context - Context for title generation
 * @param {string} context.title - Page title
 * @param {string} context.selection - Selected text (first 200 chars used)
 * @param {string} context.intent - User's reading intent if available
 * @param {string} context.domain - Source domain
 * @returns {Promise<string|null>} Generated title or null on failure
 */
export async function generateSmartTitle(context) {
    const { title = '', selection = '', intent = '', domain = '' } = context || {};

    // Generate cache key
    const cacheKey = hashContext(title, selection);
    const cached = getFromCache(cacheKey);
    if (cached) {
        console.log('[ATOM NLM] Using cached title:', cached);
        return cached;
    }

    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            console.warn('[ATOM NLM] No API key for title generation');
            return null;
        }

        const targetLanguage = await getEffectiveLanguage();
        const prompt = buildTitlePrompt({ title, selection, intent, domain, targetLanguage });
        const generatedTitle = await callGeminiForTitle(apiKey, prompt);

        if (generatedTitle) {
            setCache(cacheKey, generatedTitle);
            console.log('[ATOM NLM] Generated title:', generatedTitle);
            return generatedTitle;
        }
    } catch (error) {
        console.warn('[ATOM NLM] Title generation failed:', error.message);
    }

    return null;
}

/**
 * Generate an AI summary for long content
 * @param {string} text - Content to summarize
 * @returns {Promise<string|null>} 2-sentence summary or null if content too short/failed
 */
export async function generateSummary(text) {
    if (!text || text.length <= 500) {
        return null;
    }

    try {
        const apiKey = await getApiKey();
        if (!apiKey) return null;

        // Limit content for summarization
        const contentToSummarize = text.slice(0, 3000);

        const prompt = `Summarize this text in exactly 2 concise sentences (max 60 words total):

"""
${contentToSummarize}
"""

Output only the summary, no other text.`;

        const model = getModel('BACKGROUND');
        const url = `${AI_CONFIG.API.BASE_URL}/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 150
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error ${response.status}`);
        }

        const data = await response.json();
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (summary && summary.length > 10) {
            console.log('[ATOM NLM] Generated summary:', summary.slice(0, 50) + '...');
            return summary;
        }
    } catch (error) {
        console.warn('[ATOM NLM] Summary generation failed:', error.message);
    }

    return null;
}

/**
 * Build prompt for title generation
 */
function buildTitlePrompt({ title, selection, intent, domain, targetLanguage }) {
    const selectionExcerpt = selection ? selection.slice(0, 200) : '';

    return `Generate a concise notebook title (max 40 chars) for this content.
    
Context:
- Page title: ${title || 'Unknown'}
- Domain: ${domain || 'Unknown'}
- Selected text: "${selectionExcerpt}"
${intent ? `- Intent: ${intent}` : ''}

Rules:
1. Target Language: ${targetLanguage || 'English'}. Output title in THIS language.
2. If Vietnamese: Use "Title Case" style (Capitalize first letter of words).
3. Do NOT use generic single words like "Diện Tích", "Thông Tin". Use specific phrases like "Quy Định Tách Thửa", "Diện Tích Tối Thiểu".
4. Max 40 characters.
5. No quotes/special chars.

Output only the title.`;
}

/**
 * Call Gemini API for title generation
 */
async function callGeminiForTitle(apiKey, prompt) {
    const model = getModel('BACKGROUND');
    const url = `${AI_CONFIG.API.BASE_URL}/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 60
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API Error ${response.status}`);
        }

        const data = await response.json();
        let generatedTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (generatedTitle) {
            // Clean up the title
            generatedTitle = generatedTitle
                .replace(/^["'`]+|["'`]+$/g, '') // Remove quotes
                .replace(/[\n\r]/g, ' ')          // Remove newlines
                .trim()
                .slice(0, 50);                    // Enforce max length

            if (generatedTitle.length >= 3) {
                return generatedTitle;
            }
        }
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }

    return null;
}

/**
 * Get API key from storage
 */
async function getApiKey() {
    try {
        const data = await chrome.storage.local.get(['user_gemini_key']);
        return data.user_gemini_key || null;
    } catch {
        return null;
    }
}

/**
 * Simple hash function for cache key
 */
function hashContext(title, selection) {
    const str = `${title}_${(selection || '').slice(0, 100)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `title_${hash}`;
}

/**
 * Get from cache with TTL check
 */
function getFromCache(key) {
    const entry = titleCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        titleCache.delete(key);
        return null;
    }
    return entry.value;
}

/**
 * Set cache with TTL
 */
function setCache(key, value) {
    // Limit cache size
    if (titleCache.size > 100) {
        const firstKey = titleCache.keys().next().value;
        titleCache.delete(firstKey);
    }
    titleCache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}
