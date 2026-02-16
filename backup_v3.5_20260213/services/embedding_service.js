// services/embedding_service.js
// Vector embedding generation using Gemini API

(function () {
    'use strict';

    const EMBEDDING_CONFIG = {
        // Updated: text-embedding-004 was deprecated Nov 2025 and shut down Jan 14, 2026
        // Using gemini-embedding-001 (GA July 2025) - https://ai.google.dev/gemini-api/docs/embeddings
        model: 'gemini-embedding-001',
        dimension: 768,  // gemini-embedding-001 supports 768/1024/3072, keeping 768 for compatibility
        maxTextLength: 10000,
        cacheSize: 100
    };

    // In-memory cache for embeddings
    const embeddingCache = new Map();

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function clampText(text, limit) {
        if (!isNonEmptyString(text)) return '';
        const trimmed = text.trim();
        return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
    }

    function hashText(text) {
        let hash = 0;
        const sample = text.slice(0, 1000);
        for (let i = 0; i < sample.length; i++) {
            const char = sample.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Generates embedding for text using Gemini API.
     * @param {string} text - Text to embed
     * @param {string} apiKey - Gemini API key
     * @returns {Promise<number[]>} Embedding vector
     */
    async function generateEmbedding(text, apiKey) {
        const truncatedText = clampText(text, EMBEDDING_CONFIG.maxTextLength);

        if (!isNonEmptyString(truncatedText)) {
            throw new Error('empty_text');
        }

        if (!isNonEmptyString(apiKey)) {
            throw new Error('missing_api_key');
        }

        // Check cache first
        const cacheKey = hashText(truncatedText);
        if (embeddingCache.has(cacheKey)) {
            return embeddingCache.get(cacheKey);
        }

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_CONFIG.model}:embedContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: {
                            parts: [{ text: truncatedText }]
                        },
                        outputDimensionality: EMBEDDING_CONFIG.dimension
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Embedding] API error:', response.status, errorText);
                throw new Error(`embedding_api_error_${response.status}`);
            }

            const data = await response.json();

            if (!data.embedding || !Array.isArray(data.embedding.values)) {
                throw new Error('invalid_embedding_response');
            }

            const embedding = data.embedding.values;

            // Cache the result
            if (embeddingCache.size >= EMBEDDING_CONFIG.cacheSize) {
                const firstKey = embeddingCache.keys().next().value;
                embeddingCache.delete(firstKey);
            }
            embeddingCache.set(cacheKey, embedding);

            return embedding;

        } catch (err) {
            console.error('[Embedding] Generation failed:', err);
            throw err;
        }
    }

    /**
     * Generates embedding for a reading session.
     * @param {Object} session - ReadingSession object
     * @param {string} apiKey - API key
     * @returns {Promise<number[]>}
     */
    async function embedSession(session, apiKey) {
        if (!session || typeof session !== 'object') {
            throw new Error('invalid_session');
        }

        const contentParts = [
            session.title || '',
            ...(Array.isArray(session.highlights) ? session.highlights.map(h => h?.text || '') : []),
            ...(Array.isArray(session.insights) ? session.insights.map(i => i?.text || '') : [])
        ].filter(Boolean);

        const combinedText = contentParts.join('\n\n').trim();

        if (!combinedText) {
            throw new Error('session_no_content');
        }

        return await generateEmbedding(combinedText, apiKey);
    }

    /**
     * Calculates cosine similarity between two vectors.
     * @param {number[]} a - First vector
     * @param {number[]} b - Second vector
     * @returns {number} Similarity score (-1 to 1)
     */
    function cosineSimilarity(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b)) {
            return 0;
        }

        if (a.length !== b.length) {
            console.warn('[Embedding] Vector dimension mismatch:', a.length, b.length);
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        if (magnitude === 0) return 0;

        return dotProduct / magnitude;
    }

    /**
     * Finds top-K most similar embeddings.
     * @param {number[]} queryEmbedding - Query vector
     * @param {Array<{sessionId: string, embedding: number[]}>} candidates - Candidate embeddings
     * @param {number} topK - Number of results
     * @returns {Array<{sessionId: string, similarity: number}>}
     */
    function findTopKSimilar(queryEmbedding, candidates, topK) {
        const k = Number.isFinite(topK) && topK > 0 ? topK : 5;

        if (!Array.isArray(queryEmbedding) || !Array.isArray(candidates)) {
            return [];
        }

        const dim = queryEmbedding.length;
        const stale = [];

        const similarities = candidates
            .filter(c => {
                if (!c || !c.sessionId || !Array.isArray(c.embedding)) return false;
                if (c.embedding.length !== dim) {
                    stale.push(c.sessionId);
                    return false;
                }
                return true;
            })
            .map(candidate => ({
                sessionId: candidate.sessionId,
                similarity: cosineSimilarity(queryEmbedding, candidate.embedding)
            }));

        // Lazy cleanup: purge stale embeddings with wrong dimensions
        if (stale.length > 0 && window.VectorStore?.deleteEmbedding) {
            console.info('[Embedding] Purging', stale.length, 'stale embeddings (dimension mismatch)');
            stale.forEach(id => window.VectorStore.deleteEmbedding(id));
        }

        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, k);
    }

    /**
     * Clears the embedding cache.
     */
    function clearCache() {
        embeddingCache.clear();
    }

    /**
     * Gets cache statistics.
     */
    function getCacheStats() {
        return {
            size: embeddingCache.size,
            maxSize: EMBEDDING_CONFIG.cacheSize
        };
    }

    window.EmbeddingService = {
        EMBEDDING_CONFIG,
        generateEmbedding,
        embedSession,
        cosineSimilarity,
        findTopKSimilar,
        clearCache,
        getCacheStats
    };
})();
