// services/related_memory.js
// Proactively surfaces relevant past knowledge

(function () {
    'use strict';

    const MEMORY_CONFIG = {
        minSimilarity: 0.7,
        maxResults: 3,
        cooldownMs: 5 * 60 * 1000, // 5 minutes
        minSessionsRequired: 5
    };

    let lastSuggestionTime = 0;
    const dismissedUrls = new Set();

    function normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
        } catch {
            return url || '';
        }
    }

    function isRateLimitError(err) {
        const msg = String(err?.message || err || '').toLowerCase();
        return msg.includes('429')
            || msg.includes('quota')
            || msg.includes('resource_exhausted')
            || msg.includes('rate limit');
    }

    function buildCacheKey(currentPage, relatedSession, prefix) {
        const safePrefix = prefix || 'related-memory';
        const currentUrl = normalizeUrl(currentPage?.url || '');
        const relatedId = relatedSession?.sessionId || relatedSession?.url || relatedSession?.title || '';
        return `${safePrefix}:${currentUrl}:${relatedId}`;
    }

    /**
     * Gets API key from storage.
     */
    async function getApiKey() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(['gemini_api_key', 'apiKey'], (result) => {
                const key = result.gemini_api_key || result.apiKey;
                if (key) {
                    resolve(key);
                } else {
                    reject(new Error('api_key_not_configured'));
                }
            });
        });
    }

    /**
     * Generates an explanation of how content is connected.
     */
    async function generateConnectionExplanation(currentPage, relatedSession, apiKey, callGeminiAPI, options = {}) {
        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return 'Similar topic to your previous reading';
        }

        const prompt = [
            'Briefly explain how these two topics are connected:',
            '',
            `Current reading: "${currentPage.title || ''}"`,
            `Previous reading: "${relatedSession.title || ''}" (${relatedSession.preview || ''})`,
            '',
            'In 1 sentence, explain the connection. Focus on conceptual relationship.',
            'Example: "Both discuss reactive state management patterns in JavaScript frameworks."',
            '',
            'Connection:'
        ].join('\n');

        try {
            const systemPrompt = 'You are a helpful assistant. Be concise.';
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const safeOptions = options && typeof options === 'object' ? { ...options } : {};
            if (!safeOptions.cacheKey) {
                safeOptions.cacheKey = buildCacheKey(currentPage, relatedSession, safeOptions.cacheKeyPrefix);
            }
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory, 1, safeOptions);
            return (response || '').trim() || 'Similar topic to your previous reading';
        } catch (err) {
            if (isRateLimitError(err)) {
                markSuggestionShown();
            }
            return 'Similar topic to your previous reading';
        }
    }

    // ─── Hybrid Recall (Phase D) ─────────────────────────────
    /**
     * Hybrid recall: combines vector similarity with graph activation.
     * hybrid_score = α × cosine + (1-α) × activation
     *
     * @param {Object} pageContext - Current page context { url, title, content }
     * @param {Object} [options]
     * @param {number} [options.alpha=0.6] - Weight for cosine (0-1)
     * @param {number} [options.maxResults=5] - Max results to return
     * @param {number} [options.minHybridScore=0.3] - Min score threshold
     * @returns {Promise<Array<{ sessionId, hybridScore, cosineScore, activationScore, source }>>}
     */
    async function hybridRecall(pageContext, options = {}) {
        const {
            alpha = 0.6,
            maxResults = 5,
            minHybridScore = 0.3
        } = options;

        // 1. Vector search (existing)
        let vectorResults = [];
        try {
            vectorResults = await window.SemanticSearchService.findRelatedToPage(
                pageContext,
                maxResults * 2  // Fetch more, will re-rank
            );
        } catch (err) {
            console.warn('[HybridRecall] Vector search failed:', err);
        }

        // 2. Graph recall (via SpreadingActivationService)
        let graphResults = [];
        try {
            if (window.SpreadingActivationService) {
                graphResults = await window.SpreadingActivationService.recallForPageContext(pageContext);
            }
        } catch (err) {
            console.warn('[HybridRecall] Graph recall failed:', err);
        }

        // 3. Merge results by sessionId
        const merged = new Map();

        for (const vr of vectorResults) {
            const sid = vr.sessionId;
            if (!sid) continue;
            if (!merged.has(sid)) {
                merged.set(sid, { cosine: 0, activation: 0, data: vr });
            }
            merged.get(sid).cosine = vr.similarity || 0;
        }

        for (const gr of graphResults) {
            const sid = gr.sessionId;
            if (!sid) continue;
            if (!merged.has(sid)) {
                merged.set(sid, { cosine: 0, activation: 0, data: gr });
            }
            merged.get(sid).activation = gr.activation || 0;
        }

        // 4. Compute hybrid scores
        const scored = [];
        for (const [sessionId, { cosine, activation, data }] of merged) {
            const hybridScore = alpha * cosine + (1 - alpha) * activation;

            if (hybridScore >= minHybridScore) {
                scored.push({
                    sessionId,
                    hybridScore: Math.round(hybridScore * 1000) / 1000,
                    cosineScore: Math.round(cosine * 1000) / 1000,
                    activationScore: Math.round(activation * 1000) / 1000,
                    source: cosine > 0 && activation > 0 ? 'both'
                        : cosine > 0 ? 'vector'
                            : 'graph',
                    similarity: hybridScore,  // compat with existing UI
                    title: data.title || '',
                    url: data.url || '',
                    preview: data.preview || ''
                });
            }
        }

        // 5. Sort by hybrid score descending
        scored.sort((a, b) => b.hybridScore - a.hybridScore);
        return scored.slice(0, maxResults);
    }

    /**
     * Checks if Knowledge Graph has edges (for hybrid/fallback decision).
     * @returns {Promise<boolean>}
     */
    async function graphHasEdges() {
        try {
            const KG_KEY = 'atom_knowledge_graph_v1';
            const data = await chrome.storage.local.get([KG_KEY]);
            const edges = data[KG_KEY];
            return Array.isArray(edges) && edges.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Checks if we should show "Related from Memory" for current page.
     * Uses hybrid recall (vector + graph) when graph is available,
     * falls back to vector-only for backward compatibility.
     *
     * @param {Object} pageContext - Current page context
     * @param {string} apiKey - API key
     * @param {Function} callGeminiAPI - API call function
     * @param {Object} options - Optional call settings (cache, priority)
     * @returns {Promise<Object|null>} Related content or null
     */
    async function checkForRelatedMemory(pageContext, apiKey, callGeminiAPI, options = {}) {
        // Validate input
        if (!pageContext || typeof pageContext !== 'object') {
            return null;
        }

        // Check cooldown
        if (Date.now() - lastSuggestionTime < MEMORY_CONFIG.cooldownMs) {
            return null;
        }

        // Check if user dismissed this URL
        const normalizedUrl = normalizeUrl(pageContext.url);
        if (dismissedUrls.has(normalizedUrl)) {
            return null;
        }

        // Check dependencies
        if (!window.SemanticSearchService || !window.VectorStore) {
            return null;
        }

        try {
            // Check if we have enough history
            const embeddingCount = await window.VectorStore.getEmbeddingCount();
            if (embeddingCount < MEMORY_CONFIG.minSessionsRequired) {
                return null;
            }

            // Decide: hybrid vs vector-only
            let strongMatches;
            let recallMode = 'vector';

            const hasGraph = window.SpreadingActivationService && await graphHasEdges();

            if (hasGraph) {
                // Hybrid mode: vector + graph
                recallMode = 'hybrid';
                strongMatches = await hybridRecall(pageContext, {
                    maxResults: MEMORY_CONFIG.maxResults,
                    minHybridScore: 0.4
                });
            } else {
                // Fallback: vector-only (backward compatible)
                const related = await window.SemanticSearchService.findRelatedToPage(
                    pageContext,
                    MEMORY_CONFIG.maxResults
                );
                strongMatches = related
                    .filter(r => r.similarity >= MEMORY_CONFIG.minSimilarity)
                    .map(r => ({
                        ...r,
                        hybridScore: r.similarity,
                        cosineScore: r.similarity,
                        activationScore: 0,
                        source: 'vector'
                    }));
            }

            if (strongMatches.length === 0) {
                return null;
            }

            // Generate connection explanation for top match
            const connection = await generateConnectionExplanation(
                pageContext,
                strongMatches[0],
                apiKey,
                callGeminiAPI,
                options
            );

            return {
                matches: strongMatches,
                connection: connection,
                recallMode: strongMatches[0]?.source === 'both' ? 'hybrid' : recallMode,
                currentPage: {
                    title: pageContext.title || '',
                    url: pageContext.url || ''
                }
            };

        } catch (err) {
            console.error('[RelatedMemory] Check failed:', err);
            return null;
        }
    }

    /**
     * Marks suggestion as shown (updates cooldown).
     */
    function markSuggestionShown() {
        lastSuggestionTime = Date.now();
    }

    /**
     * Dismisses related memory for a URL.
     */
    function dismissForUrl(url) {
        dismissedUrls.add(normalizeUrl(url));
    }

    /**
     * Resets dismissed URLs.
     */
    function resetDismissed() {
        dismissedUrls.clear();
    }

    /**
     * Gets cooldown remaining in ms.
     */
    function getCooldownRemaining() {
        const elapsed = Date.now() - lastSuggestionTime;
        return Math.max(0, MEMORY_CONFIG.cooldownMs - elapsed);
    }

    /**
     * Checks if related memory feature is available.
     */
    async function isAvailable() {
        if (!window.SemanticSearchService || !window.VectorStore) {
            return false;
        }

        try {
            const count = await window.VectorStore.getEmbeddingCount();
            return count >= MEMORY_CONFIG.minSessionsRequired;
        } catch {
            return false;
        }
    }

    window.RelatedMemoryService = {
        MEMORY_CONFIG,
        checkForRelatedMemory,
        hybridRecall,
        markSuggestionShown,
        dismissForUrl,
        resetDismissed,
        getCooldownRemaining,
        isAvailable
    };
})();
