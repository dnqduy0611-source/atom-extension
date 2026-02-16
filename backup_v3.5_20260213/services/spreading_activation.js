/**
 * Spreading Activation Service — Neural Memory Phase 2
 *
 * Multi-hop recall engine. Starts from a seed session, propagates
 * activation energy through the Knowledge Graph edges.
 *
 * Activation decays per hop:  next = current × edge.strength × decayFactor
 * Stops when:  activation < minActivation  OR  hops > maxHops
 *
 * Zero API cost — pure client-side compute.
 *
 * Ref: ideas/neural_memory/phase_2_spreading_activation.md
 */
(function () {
    'use strict';

    const KG_KEY = 'atom_knowledge_graph_v1';

    // ─── Load edges from storage ──────────────────────────────
    async function loadEdges() {
        const data = await chrome.storage.local.get([KG_KEY]);
        const list = data[KG_KEY];
        return Array.isArray(list) ? list : [];
    }

    // ─── Adjacency Index ──────────────────────────────────────
    // Duplicated from storage/knowledge_graph.js because this IIFE
    // can't import ES modules. Same logic, same output shape.
    function buildAdjacencyIndex(edges) {
        const index = new Map();

        for (const edge of edges) {
            if (!edge?.sourceId || !edge?.targetId) continue;

            if (!index.has(edge.sourceId)) index.set(edge.sourceId, []);
            if (!index.has(edge.targetId)) index.set(edge.targetId, []);

            index.get(edge.sourceId).push({
                edgeId: edge.edgeId,
                neighborId: edge.targetId,
                type: edge.type,
                strength: edge.strength ?? 1.0
            });

            index.get(edge.targetId).push({
                edgeId: edge.edgeId,
                neighborId: edge.sourceId,
                type: edge.type,
                strength: edge.strength ?? 1.0
            });
        }

        return index;
    }

    // ─── Core Algorithm ───────────────────────────────────────
    /**
     * Spreading activation recall.
     *
     * BFS with priority queue. Starts from seed, propagates activation
     * through graph edges. Each hop: activation × edge.strength × decay.
     *
     * @param {string} seedId - Starting session ID
     * @param {Map} adjacencyIndex - From buildAdjacencyIndex()
     * @param {Object} [options]
     * @param {number} [options.maxHops=3] - Max traversal depth
     * @param {number} [options.minActivation=0.1] - Stop threshold
     * @param {number} [options.decayFactor=0.6] - Activation decay per hop
     * @param {string[]} [options.preferTypes] - Boost these edge types ×1.3
     * @returns {Array<{ sessionId, activation, path, hops }>} Sorted by activation DESC
     */
    function spreadingActivation(seedId, adjacencyIndex, options = {}) {
        if (!seedId || !adjacencyIndex) return [];

        const {
            maxHops = 3,
            minActivation = 0.1,
            decayFactor = 0.6,
            preferTypes = null
        } = options;

        const activated = new Map(); // sessionId → { activation, path, hops }
        const queue = [{ sessionId: seedId, activation: 1.0, path: [], hops: 0 }];

        while (queue.length > 0) {
            // Best-first: highest activation processed next
            queue.sort((a, b) => b.activation - a.activation);
            const current = queue.shift();

            if (current.activation < minActivation) continue;
            if (current.hops > maxHops) continue;

            // Skip seed itself, only record reached nodes
            if (current.sessionId !== seedId) {
                const existing = activated.get(current.sessionId);
                if (!existing || existing.activation < current.activation) {
                    activated.set(current.sessionId, {
                        activation: current.activation,
                        path: current.path,
                        hops: current.hops
                    });
                }
            }

            // Expand neighbors
            const neighbors = adjacencyIndex.get(current.sessionId) || [];

            for (const neighbor of neighbors) {
                // No cycles
                if (current.path.includes(neighbor.neighborId)) continue;
                if (neighbor.neighborId === seedId) continue;

                // Type preference bonus
                let typeBonus = 1.0;
                if (preferTypes && preferTypes.includes(neighbor.type)) {
                    typeBonus = 1.3;
                }

                const nextActivation = current.activation
                    * (neighbor.strength ?? 1.0)
                    * decayFactor
                    * typeBonus;

                if (nextActivation >= minActivation) {
                    queue.push({
                        sessionId: neighbor.neighborId,
                        activation: nextActivation,
                        path: [...current.path, current.sessionId],
                        hops: current.hops + 1
                    });
                }
            }
        }

        // Sort by activation descending
        return Array.from(activated.entries())
            .map(([sessionId, data]) => ({ sessionId, ...data }))
            .sort((a, b) => b.activation - a.activation);
    }

    // ─── Convenience: recall from session ─────────────────────
    /**
     * Load graph, build index, run spreading activation for a session.
     *
     * @param {string} sessionId - Starting session ID
     * @param {Object} [options] - Same as spreadingActivation options
     * @returns {Promise<Array<{ sessionId, activation, path, hops }>>}
     */
    async function recallForSession(sessionId, options = {}) {
        if (!sessionId) return [];

        const edges = await loadEdges();
        if (edges.length === 0) return [];

        const index = buildAdjacencyIndex(edges);

        // No connections for this session
        if (!index.has(sessionId)) return [];

        return spreadingActivation(sessionId, index, options);
    }

    // ─── Convenience: recall for current page context ─────────
    /**
     * Find sessions matching current page, then run spreading activation.
     * Uses ReadingSessionService if available to find matching sessions.
     *
     * @param {Object} pageContext - { url, title, topicKey }
     * @param {Object} [options] - Same as spreadingActivation options
     * @returns {Promise<Array<{ sessionId, activation, path, hops }>>}
     */
    async function recallForPageContext(pageContext, options = {}) {
        if (!pageContext) return [];

        const edges = await loadEdges();
        if (edges.length === 0) return [];

        const index = buildAdjacencyIndex(edges);

        // Find seed sessions: all sessions that appear in the graph
        // and match the page context
        const allSessionIds = new Set();
        for (const edge of edges) {
            if (edge.sourceId) allSessionIds.add(edge.sourceId);
            if (edge.targetId) allSessionIds.add(edge.targetId);
        }

        // Try to find matching sessions via ReadingSessionService
        let seedIds = [];

        if (window.ReadingSessionService) {
            try {
                const sessions = await window.ReadingSessionService.getSessionsByUrl(
                    pageContext.url
                );
                seedIds = (sessions || [])
                    .map(s => s.id || s.sessionId)
                    .filter(id => id && allSessionIds.has(id));
            } catch (e) {
                console.warn('[SpreadingActivation] ReadingSessionService error:', e);
            }
        }

        // Fallback: if no sessions found by URL, try topicKey matching
        if (seedIds.length === 0 && pageContext.topicKey) {
            // Scan edges for matching topicKey
            for (const edge of edges) {
                if (edge.sourceTopicKey === pageContext.topicKey) {
                    seedIds.push(edge.sourceId);
                }
                if (edge.targetTopicKey === pageContext.topicKey) {
                    seedIds.push(edge.targetId);
                }
            }
            seedIds = [...new Set(seedIds)];
        }

        if (seedIds.length === 0) return [];

        // Run activation from each seed, merge results
        const mergedMap = new Map();

        for (const seedId of seedIds) {
            if (!index.has(seedId)) continue;

            const results = spreadingActivation(seedId, index, options);
            for (const r of results) {
                const existing = mergedMap.get(r.sessionId);
                if (!existing || existing.activation < r.activation) {
                    mergedMap.set(r.sessionId, r);
                }
            }
        }

        return Array.from(mergedMap.values())
            .sort((a, b) => b.activation - a.activation);
    }

    // ─── Quick 1-hop neighbor summary ─────────────────────────
    /**
     * Get a quick summary of 1-hop neighbors for UI display.
     *
     * @param {string} sessionId - Session ID
     * @returns {Promise<{ count: number, byType: Object, neighbors: Array }>}
     */
    async function getNeighborSummary(sessionId) {
        if (!sessionId) return { count: 0, byType: {}, neighbors: [] };

        const edges = await loadEdges();
        const index = buildAdjacencyIndex(edges);
        const neighbors = index.get(sessionId) || [];

        const byType = {};
        for (const n of neighbors) {
            const t = n.type || 'unknown';
            byType[t] = (byType[t] || 0) + 1;
        }

        return {
            count: neighbors.length,
            byType,
            neighbors
        };
    }

    // ─── Reinforce edges on activation ────────────────────────
    /**
     * Boost strength of edges that were traversed during recall.
     * Called after spreading activation to reinforce used paths.
     *
     * @param {Array<string>} edgeIds - Edge IDs that were traversed
     * @param {number} [boost=0.05] - Strength boost per activation
     */
    async function reinforceTraversedEdges(edgeIds, boost = 0.05) {
        if (!edgeIds || edgeIds.length === 0) return;

        const edges = await loadEdges();
        let changed = false;

        for (const edge of edges) {
            if (edgeIds.includes(edge.edgeId)) {
                edge.strength = Math.min(1.0, (edge.strength || 1.0) + boost);
                edge.activationCount = (edge.activationCount || 0) + 1;
                edge.lastActivatedAt = Date.now();
                changed = true;
            }
        }

        if (changed) {
            await chrome.storage.local.set({ [KG_KEY]: edges });
        }
    }

    // ─── Export ───────────────────────────────────────────────
    window.SpreadingActivationService = {
        spreadingActivation,
        recallForSession,
        recallForPageContext,
        getNeighborSummary,
        reinforceTraversedEdges,
        buildAdjacencyIndex  // exposed for testing
    };

    console.log('[SpreadingActivation] Service loaded');
})();
