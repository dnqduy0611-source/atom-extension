/**
 * Hybrid Recall Engine — Conversation Memory
 *
 * Combines:
 * - Semantic search (cosine similarity on digest embeddings)
 * - Graph recall (spreading activation from Knowledge Graph)
 *
 * Score fusion: hybrid = α × semantic + (1-α) × graph
 * Default α = 0.6 (semantic-heavy, graph supplements)
 */
(function () {
    'use strict';

    const RECALL_CONFIG = {
        alpha: 0.6,              // semantic weight (0-1)
        maxResults: 3,           // max digests to inject
        minScore: 0.3,           // minimum hybrid score to include
        maxPromptChars: 1200,    // hard cap for injected text
        maxQAPerDigest: 2,       // max Q&A pairs per digest in prompt
        maxSummaryChars: 200,    // max summary chars per digest
        maxAnswerChars: 150,     // max answer chars per Q&A
        semanticTopK: 5,         // candidates from semantic search
        graphTopK: 5,            // candidates from graph recall
        skipIfMessagesOver: 8,   // skip recall if thread already long
        cooldownMs: 10000,       // min time between recalls (prevent spam)
    };

    let lastRecallTimestamp = 0;

    // ── Main entry point ──
    /**
     * Find related conversation digests using hybrid approach.
     *
     * @param {string} userMessage - Current user message
     * @param {Object} pageContext - { url, title, domain, topicKey }
     * @param {Object} [options] - Override RECALL_CONFIG
     * @returns {Promise<Array>} Top digests with scores
     */
    async function hybridRecall(userMessage, pageContext, options = {}) {
        const config = { ...RECALL_CONFIG, ...options };

        // Cooldown check
        const now = Date.now();
        if (now - lastRecallTimestamp < config.cooldownMs) {
            console.log('[HybridRecall] Cooldown active, skipping');
            return [];
        }
        lastRecallTimestamp = now;

        // Run semantic + graph in parallel
        const [semanticResults, graphResults] = await Promise.allSettled([
            semanticRecall(userMessage, config.semanticTopK),
            graphRecall(pageContext, config.graphTopK)
        ]);

        const semantic = semanticResults.status === 'fulfilled' ? semanticResults.value : [];
        const graph = graphResults.status === 'fulfilled' ? graphResults.value : [];

        console.log(`[HybridRecall] Semantic: ${semantic.length}, Graph: ${graph.length}`);

        if (semantic.length === 0 && graph.length === 0) return [];

        // Merge and rank
        const ranked = mergeAndRank(semantic, graph, config.alpha);

        // Filter by min score
        const qualified = ranked.filter(r => r.hybrid >= config.minScore);

        // Load full digests for top-K
        const topK = qualified.slice(0, config.maxResults);
        const digests = await loadFullDigests(topK);

        // Reinforce recalled digests (strengthens memory)
        reinforceRecalledDigests(digests);

        console.log(`[HybridRecall] Returning ${digests.length} digests`);
        return digests;
    }

    // ── Semantic Search branch ──
    async function semanticRecall(queryText, topK) {
        if (!window.EmbeddingService || !window.VectorStore) return [];

        try {
            // Get digest embeddings only
            const digestEmbeddings = await VectorStore.getEmbeddingsByType('digest');
            if (digestEmbeddings.length === 0) return [];

            // Generate query embedding
            let queryEmbedding;
            const apiKey = await window.SP?.getApiKey?.();
            if (apiKey && window.EmbeddingService) {
                queryEmbedding = await EmbeddingService.generateEmbedding(queryText, apiKey);
            } else {
                // Use proxy embedding via background service worker
                const response = await chrome.runtime.sendMessage({
                    type: 'ATOM_PROXY_EMBED',
                    text: queryText
                });
                if (response?.data?.embedding?.values) {
                    queryEmbedding = response.data.embedding.values;
                }
            }

            if (!queryEmbedding) return [];

            // Find similar
            const results = EmbeddingService.findTopKSimilar(
                queryEmbedding,
                digestEmbeddings.map(e => ({ sessionId: e.sessionId, embedding: e.embedding })),
                topK
            );

            return results.map(r => ({
                digestId: r.sessionId,  // VectorStore uses sessionId key for digest too
                semantic: r.similarity,
                graph: 0,
                hybrid: 0
            }));
        } catch (err) {
            console.warn('[HybridRecall] Semantic search failed:', err);
            return [];
        }
    }

    // ── Graph Recall branch ──
    async function graphRecall(pageContext, topK) {
        if (!window.SpreadingActivationService?.recallForPageContext) return [];
        if (!pageContext) return [];

        try {
            const results = await SpreadingActivationService.recallForPageContext(
                pageContext,
                { maxHops: 2, topK, minActivation: 0.1 }
            );

            // Map session IDs to digest IDs
            if (!window.ConversationDigestStore) return [];
            const allDigests = await ConversationDigestStore.loadDigests();

            return results
                .map(r => {
                    const digest = allDigests.find(d => d.sessionId === r.sessionId);
                    if (!digest) return null;
                    return {
                        digestId: digest.digestId,
                        semantic: 0,
                        graph: r.activation,
                        hybrid: 0
                    };
                })
                .filter(Boolean)
                .slice(0, topK);
        } catch (err) {
            console.warn('[HybridRecall] Graph recall failed:', err);
            return [];
        }
    }

    // ── Score Fusion ──
    function mergeAndRank(semantic, graph, alpha) {
        const scoreMap = new Map();

        for (const r of semantic) {
            scoreMap.set(r.digestId, {
                digestId: r.digestId,
                semantic: r.semantic,
                graph: 0,
                hybrid: 0
            });
        }

        for (const r of graph) {
            const existing = scoreMap.get(r.digestId);
            if (existing) {
                existing.graph = r.graph;
            } else {
                scoreMap.set(r.digestId, {
                    digestId: r.digestId,
                    semantic: 0,
                    graph: r.graph,
                    hybrid: 0
                });
            }
        }

        // Calculate hybrid score
        for (const [, scores] of scoreMap) {
            scores.hybrid = alpha * scores.semantic + (1 - alpha) * scores.graph;
        }

        return [...scoreMap.values()].sort((a, b) => b.hybrid - a.hybrid);
    }

    // ── Load Full Digests ──
    async function loadFullDigests(rankedResults) {
        if (!window.ConversationDigestStore) return [];

        const digests = [];
        for (const r of rankedResults) {
            const digest = await ConversationDigestStore.getDigestById(r.digestId);
            if (digest) {
                digest._hybridScore = r.hybrid;
                digest._semanticScore = r.semantic;
                digest._graphScore = r.graph;
                digests.push(digest);
            }
        }
        return digests;
    }

    // ── Reinforce recalled digests (fire-and-forget) ──
    function reinforceRecalledDigests(digests) {
        if (!window.ConversationDigestStore?.reinforceDigest) return;
        for (const d of digests) {
            ConversationDigestStore.reinforceDigest(d.digestId, 0.05).catch(() => { });
        }
    }

    // ── Format for System Prompt ──
    /**
     * Format digests into a string for system prompt injection.
     *
     * @param {Array} digests
     * @param {Object} [config] - Formatting config
     * @returns {string} Formatted string for prompt, or '' if none
     */
    function formatDigestsForPrompt(digests, config = {}) {
        const {
            maxPromptChars = RECALL_CONFIG.maxPromptChars,
            maxQAPerDigest = RECALL_CONFIG.maxQAPerDigest,
            maxSummaryChars = RECALL_CONFIG.maxSummaryChars,
            maxAnswerChars = RECALL_CONFIG.maxAnswerChars
        } = config;

        if (!digests?.length) return '';

        const parts = [];
        let totalChars = 0;

        for (const d of digests) {
            const section = [];
            section.push(`Page: "${(d.pageTitle || '').slice(0, 80)}" (${d.domain || '?'})`);
            section.push(`Summary: ${(d.summary || '').slice(0, maxSummaryChars)}`);

            // Add key Q&A
            const qas = (d.keyQA || []).slice(0, maxQAPerDigest);
            for (const qa of qas) {
                section.push(`Q: ${(qa.q || '').slice(0, 150)}`);
                section.push(`A: ${(qa.a || '').slice(0, maxAnswerChars)}`);
            }

            const block = '---\n' + section.join('\n') + '\n---';

            if (totalChars + block.length > maxPromptChars) break;
            parts.push(block);
            totalChars += block.length;
        }

        if (parts.length === 0) return '';

        return `
PREVIOUS CONVERSATIONS (from your memory):
${parts.join('\n')}

MEMORY INSTRUCTION: You can reference these previous conversations naturally.
If the user asks about something discussed before, refer to it.
If these memories are not relevant to the current question, ignore them.
Do NOT mention "digest" or "memory injection" — just reference naturally.`;
    }

    // ── Export ──
    window.HybridRecallService = {
        hybridRecall,
        mergeAndRank,
        formatDigestsForPrompt,
        RECALL_CONFIG
    };

    console.log('[HybridRecall] Service loaded');
})();
