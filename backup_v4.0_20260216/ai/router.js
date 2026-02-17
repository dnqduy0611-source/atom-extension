/**
 * ai/router.js — Unified AI Router ("Traffic Controller")
 * Phase 4: AI Layer
 *
 * Central entry point for AI routing decisions. Handles:
 * 1. Intent-based model/temperature selection
 * 2. Context enrichment via brain/context_builder.js
 * 3. Provider selection logging
 *
 * IIFE — exposes via window.AIRouter
 * Used in sidepanel context (loaded as <script> tag)
 *
 * NOTE: This router handles "what model/temp to use" and "what context to add".
 * It does NOT handle retry, caching, or UI feedback — those stay in sp_llm.js.
 */
(function () {
    'use strict';

    // ── Intent Definitions ──
    // Map intent names to optimal model tier + temperature
    const INTENT_CONFIG = {
        CHAT: { tier: 'USER', temp: 0.7, desc: 'Conversational chat' },
        FACT_CHECK: { tier: 'USER', temp: 0.3, desc: 'Fact verification' },
        SUMMARY: { tier: 'USER', temp: 0.5, desc: 'Content summarization' },
        CLASSIFY: { tier: 'PILOT', temp: 0.2, desc: 'Classification/detection' },
        GENERATE: { tier: 'USER', temp: 0.8, desc: 'Creative content generation' },
        STRATEGY: { tier: 'PILOT', temp: 0.5, desc: 'Strategy/decision making' },
        EVALUATE: { tier: 'USER', temp: 0.5, desc: 'Answer evaluation' }
    };

    /**
     * Route an AI request — returns routing metadata (model, temp, enriched prompt).
     * The actual API call is still made by sp_llm.js.
     *
     * @param {string} prompt - The prompt or system instruction
     * @param {Object} [options={}] - Routing options
     * @param {string} [options.intent='CHAT'] - Intent key
     * @param {number} [options.tabId] - Tab ID for context enrichment
     * @param {Object} [options.context] - Pre-built context (skips auto-build)
     * @param {string} [options.model] - Force specific model
     * @param {number} [options.temperature] - Force specific temperature
     * @param {boolean} [options.enrichContext=true] - Whether to enrich prompt with reading context
     * @returns {Promise<{model: string|null, temperature: number, context: Object|null, enrichedPrompt: string, intent: string}>}
     */
    async function routeRequest(prompt, options = {}) {
        const intent = options.intent || 'CHAT';
        const config = INTENT_CONFIG[intent] || INTENT_CONFIG.CHAT;

        // 1. Determine temperature (model is selected by sp_llm.js from config)
        const temperature = options.temperature ?? config.temp;

        // 2. Build context if requested
        let context = options.context || null;
        if (!context && options.tabId && options.enrichContext !== false) {
            try {
                // buildContext is from brain/context_builder.js (loaded as ES6 by background)
                // In sidepanel, we request context from background via message
                const ctxResult = await chrome.runtime.sendMessage({
                    type: 'ATOM_BUILD_CONTEXT',
                    tabId: options.tabId
                });
                if (ctxResult?.context) {
                    context = ctxResult.context;
                    console.log('[AI Router] Context built:', {
                        page: context.page?.title?.slice(0, 50),
                        highlights: context.highlights?.length || 0,
                        patterns: !!context.patterns
                    });
                }
            } catch (e) {
                console.warn('[AI Router] Context build failed (non-blocking):', e.message);
            }
        }

        // 3. Enrich prompt with context
        let enrichedPrompt = prompt;
        if (context && options.enrichContext !== false) {
            enrichedPrompt = enrichPromptWithContext(prompt, context);
        }

        console.log(`[AI Router] Routing: intent=${intent}, temp=${temperature}, hasContext=${!!context}`);

        return {
            model: options.model || null, // null = let sp_llm.js use default
            temperature,
            context,
            enrichedPrompt,
            intent,
            generationConfig: {
                temperature,
                maxOutputTokens: options.maxOutputTokens || 8192
            }
        };
    }

    /**
     * Enrich a system prompt with reading context from the brain.
     *
     * @param {string} basePrompt - Original system prompt
     * @param {Object} context - Context from buildContext()
     * @returns {string} Enriched prompt
     */
    function enrichPromptWithContext(basePrompt, context) {
        const parts = [basePrompt];

        if (context.page) {
            parts.push(`\n\n[READING CONTEXT]`);
            parts.push(`Page: "${context.page.title}" on ${context.page.domain}`);
        }

        if (context.highlights && context.highlights.length > 0) {
            parts.push(`\nRecent highlights from this page:`);
            context.highlights.forEach((h, i) => {
                parts.push(`  ${i + 1}. "${h.text}" (status: ${h.status})`);
            });
        }

        if (context.patterns) {
            parts.push(`\nReading patterns: ${context.patterns.visitCount} visits, ${Math.round((context.patterns.totalReadingTime || 0) / 60)}min total reading time on this domain.`);
        }

        return parts.join('\n');
    }

    /**
     * Get model recommendation for a given intent.
     *
     * @param {string} intent - Intent key
     * @returns {{temperature: number, tier: string}}
     */
    function getModelForIntent(intent) {
        const config = INTENT_CONFIG[intent] || INTENT_CONFIG.CHAT;
        return {
            temperature: config.temp,
            tier: config.tier
        };
    }

    // ── Expose on window ──
    window.AIRouter = {
        routeRequest,
        getModelForIntent,
        enrichPromptWithContext,
        INTENT_CONFIG
    };

    console.log('[AI Router] Router loaded with intents:', Object.keys(INTENT_CONFIG).join(', '));
})();
