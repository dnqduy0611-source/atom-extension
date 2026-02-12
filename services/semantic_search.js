// services/semantic_search.js
// Semantic search using vector similarity

(function () {
    'use strict';

    const SEARCH_CONFIG = {
        minSimilarity: 0.6,
        topK: 5,
        excludeSameSession: true,
        maxAgeMs: 14 * 24 * 60 * 60 * 1000,
        domainTtlMs: {}
    };

    /**
     * Gets API key from storage. Returns null if not configured.
     * @returns {Promise<string|null>}
     */
    async function getApiKey() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['user_gemini_key', 'gemini_api_key', 'apiKey'], (result) => {
                resolve(result.user_gemini_key || result.gemini_api_key || result.apiKey || null);
            });
        });
    }

    /**
     * Checks if user is signed in (proxy available).
     */
    async function isUserSignedIn() {
        try {
            const data = await chrome.storage.local.get('atom_auth_cache');
            return !!data?.atom_auth_cache?.isAuthenticated;
        } catch {
            return false;
        }
    }

    /**
     * Gets a preview snippet from session.
     */
    function getSessionPreview(session) {
        if (!session) return '';

        if (Array.isArray(session.insights) && session.insights.length > 0) {
            const text = session.insights[0]?.text || '';
            return text.slice(0, 100) + (text.length > 100 ? '...' : '');
        }

        if (Array.isArray(session.highlights) && session.highlights.length > 0) {
            const text = session.highlights[0]?.text || '';
            return text.slice(0, 100) + (text.length > 100 ? '...' : '');
        }

        return '';
    }

    /**
     * Generate embedding via proxy (background service worker).
     */
    async function generateProxyEmbedding(queryText) {
        const response = await chrome.runtime.sendMessage({
            type: 'ATOM_PROXY_EMBED',
            text: queryText
        });
        if (response?.error) {
            throw new Error(response.error);
        }
        if (!response?.data?.embedding?.values) {
            throw new Error('invalid_proxy_embedding_response');
        }
        return response.data.embedding.values;
    }

    async function generateQueryEmbedding(queryText, apiKey) {
        // Use proxy if no API key
        if (!apiKey) {
            return generateProxyEmbedding(queryText);
        }

        const rateManager = window.RateLimitManager
            ? (window.__ATOM_RATE_MANAGER__ || (window.__ATOM_RATE_MANAGER__ = new window.RateLimitManager({
                rpmTotal: 15,
                rpmBackground: 8,
                cacheTtlMs: 5 * 60 * 1000
            })))
            : null;
        const runEmbedding = () => window.EmbeddingService.generateEmbedding(queryText, apiKey);
        return rateManager
            ? await rateManager.enqueue(runEmbedding, { priority: 'background' })
            : await runEmbedding();
    }

    /**
     * Finds sessions related to a query text.
     * @param {string} queryText - Text to find related content for
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Related sessions with similarity scores
     */
    async function findRelated(queryText, options) {
        const opts = options || {};
        const topK = Number.isFinite(opts.topK) ? opts.topK : SEARCH_CONFIG.topK;
        const minSimilarity = Number.isFinite(opts.minSimilarity) ? opts.minSimilarity : SEARCH_CONFIG.minSimilarity;
        const excludeSessionId = opts.excludeSessionId || null;

        if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
            return [];
        }

        if (!window.EmbeddingService || !window.VectorStore) {
            console.warn('[SemanticSearch] Dependencies missing');
            return [];
        }

        try {
            const apiKey = await getApiKey();
            if (!apiKey && !(await isUserSignedIn())) {
                return [];
            }

            // Generate query embedding
            const queryEmbedding = await generateQueryEmbedding(queryText, apiKey);

            // Get all stored embeddings
            const allEmbeddings = await window.VectorStore.getAllEmbeddings();

            // Filter out excluded session
            const candidates = excludeSessionId
                ? allEmbeddings.filter(e => e.sessionId !== excludeSessionId)
                : allEmbeddings;

            if (candidates.length === 0) {
                return [];
            }

            // Find similar
            const similar = window.EmbeddingService.findTopKSimilar(queryEmbedding, candidates, topK);

            // Filter by minimum similarity
            const filtered = similar.filter(s => s.similarity >= minSimilarity);

            // Enrich with session data
            const results = await Promise.all(
                filtered.map(async (item) => {
                    let session = null;
                    if (window.ReadingSessionService) {
                        session = await window.ReadingSessionService.getSessionById(item.sessionId);
                    }
                    const embeddingData = candidates.find(c => c.sessionId === item.sessionId);

                    return {
                        sessionId: item.sessionId,
                        similarity: Math.round(item.similarity * 100) / 100,
                        title: session?.title || embeddingData?.title || 'Unknown',
                        url: session?.url || embeddingData?.url || '',
                        domain: embeddingData?.domain || '',
                        highlightCount: session?.highlights?.length || embeddingData?.highlightCount || 0,
                        insightCount: session?.insights?.length || embeddingData?.insightCount || 0,
                        preview: getSessionPreview(session),
                        createdAt: session?.createdAt || embeddingData?.timestamp
                    };
                })
            );

            return results;

        } catch (err) {
            console.error('[SemanticSearch] findRelated failed:', err);
            return [];
        }
    }

    /**
     * Finds sessions related to a specific session.
     * @param {string} sessionId - Source session ID
     * @param {number} topK - Number of results
     * @returns {Promise<Array>}
     */
    async function findRelatedToSession(sessionId, topK) {
        if (!sessionId) return [];

        let session = null;
        if (window.ReadingSessionService) {
            session = await window.ReadingSessionService.getSessionById(sessionId);
        }

        if (!session) {
            console.warn('[SemanticSearch] Session not found:', sessionId);
            return [];
        }

        // Combine session content for query
        const parts = [
            session.title || '',
            ...(Array.isArray(session.highlights) ? session.highlights.slice(0, 5).map(h => h?.text || '') : []),
            ...(Array.isArray(session.insights) ? session.insights.slice(0, 3).map(i => i?.text || '') : [])
        ].filter(Boolean);

        const queryText = parts.join('\n');

        return findRelated(queryText, {
            topK: topK || 5,
            excludeSessionId: sessionId
        });
    }

    /**
     * Finds sessions related to current page content.
     * @param {Object} pageContext - Page context
     * @param {number} topK - Number of results
     * @returns {Promise<Array>}
     */
    async function findRelatedToPage(pageContext, topK) {
        if (!pageContext || typeof pageContext !== 'object') return [];

        const queryText = [
            pageContext.title || '',
            (pageContext.content || '').slice(0, 2000)
        ].filter(Boolean).join('\n');

        return findRelated(queryText, { topK: topK || 5 });
    }

    /**
     * Searches within a specific domain.
     * @param {string} queryText
     * @param {string} domain
     * @param {number} topK
     */
    async function searchWithinDomain(queryText, domain, topK, options) {
        if (!queryText || !domain) return [];

        if (!window.EmbeddingService || !window.VectorStore) {
            console.warn('[SemanticSearch] Dependencies missing');
            return [];
        }

        try {
            const apiKey = await getApiKey();
            if (!apiKey && !(await isUserSignedIn())) {
                return [];
            }
            const opts = options && typeof options === 'object' ? options : {};
            const minSimilarity = Number.isFinite(opts.minSimilarity)
                ? opts.minSimilarity
                : SEARCH_CONFIG.minSimilarity;
            const maxAgeMs = Number.isFinite(opts.maxAgeMs)
                ? opts.maxAgeMs
                : (SEARCH_CONFIG.domainTtlMs?.[domain] ?? SEARCH_CONFIG.maxAgeMs);
            const queryEmbedding = await generateQueryEmbedding(queryText, apiKey);

            // Get embeddings for domain only
            const domainEmbeddings = await window.VectorStore.getEmbeddingsByDomain(domain);
            const cutoff = Number.isFinite(maxAgeMs) ? Date.now() - maxAgeMs : null;
            const recentEmbeddings = cutoff
                ? domainEmbeddings.filter(e => (e.timestamp || 0) >= cutoff)
                : domainEmbeddings;

            if (recentEmbeddings.length === 0) {
                return [];
            }

            const similar = window.EmbeddingService.findTopKSimilar(queryEmbedding, recentEmbeddings, topK || 5);
            const filtered = similar.filter(s => s.similarity >= minSimilarity);

            const results = await Promise.all(
                filtered.map(async (item) => {
                    let session = null;
                    if (window.ReadingSessionService) {
                        session = await window.ReadingSessionService.getSessionById(item.sessionId);
                    }
                    const embeddingData = recentEmbeddings.find(c => c.sessionId === item.sessionId);

                    return {
                        sessionId: item.sessionId,
                        similarity: Math.round(item.similarity * 100) / 100,
                        title: session?.title || embeddingData?.title || 'Unknown',
                        url: session?.url || embeddingData?.url || '',
                        domain: embeddingData?.domain || domain,
                        highlightCount: session?.highlights?.length || embeddingData?.highlightCount || 0,
                        insightCount: session?.insights?.length || embeddingData?.insightCount || 0,
                        preview: getSessionPreview(session),
                        createdAt: session?.createdAt || embeddingData?.timestamp,
                        timestamp: embeddingData?.timestamp
                    };
                })
            );

            return results;

        } catch (err) {
            const onError = options && typeof options.onError === 'function' ? options.onError : null;
            if (onError) {
                onError(err);
            }
            console.error('[SemanticSearch] searchWithinDomain failed:', err);
            return [];
        }
    }

    /**
     * Checks if semantic search is available (has API key or signed in, and has embeddings).
     */
    async function isAvailable() {
        try {
            const apiKey = await getApiKey();
            if (!apiKey && !(await isUserSignedIn())) {
                return false;
            }
            const count = await window.VectorStore?.getEmbeddingCount() || 0;
            return count > 0;
        } catch {
            return false;
        }
    }

    window.SemanticSearchService = {
        SEARCH_CONFIG,
        findRelated,
        findRelatedToSession,
        findRelatedToPage,
        searchWithinDomain,
        isAvailable
    };
})();
