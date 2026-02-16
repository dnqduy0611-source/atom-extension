/**
 * Knowledge Graph Store — CRUD operations for graph edges
 *
 * Storage key: atom_knowledge_graph_v1
 * Max edges: 1000 (evicts weakest when full)
 *
 * Phase 0 of Neural Memory integration.
 * Ref: ideas/neural_memory/phase_0_knowledge_graph_store.md
 */

import { KG_EDGES_KEY, KG_MAX_EDGES } from "../bridge/types.js";

// ─── Edge ID ────────────────────────────────────────────────

/**
 * Generate a unique edge ID.
 * @returns {string} Format: edge_{timestamp}_{random}
 */
export function createEdgeId() {
    const rand = Math.random().toString(36).substring(2, 8);
    return `edge_${Date.now()}_${rand}`;
}

// ─── Core CRUD ──────────────────────────────────────────────

/**
 * Load all edges from storage.
 * @returns {Promise<Array>} Array of Edge objects
 */
export async function loadEdges() {
    const data = await chrome.storage.local.get([KG_EDGES_KEY]);
    const list = data[KG_EDGES_KEY];
    return Array.isArray(list) ? list : [];
}

/**
 * Save all edges to storage.
 * @param {Array} edges - Array of Edge objects
 */
export async function saveEdges(edges) {
    const safe = Array.isArray(edges) ? edges : [];
    await chrome.storage.local.set({ [KG_EDGES_KEY]: safe });
}

/**
 * Add a single edge to the graph.
 * De-duplicates by (sourceId, targetId, type) — if exists, updates confidence/strength.
 * Evicts weakest edges if at capacity.
 *
 * @param {Object} edge - Edge object (must have edgeId, sourceId, targetId, type)
 * @returns {Promise<Object>} The added or updated edge
 */
export async function addEdge(edge) {
    if (!edge?.edgeId || !edge?.sourceId || !edge?.targetId || !edge?.type) {
        throw new Error("[knowledge_graph] addEdge: edgeId, sourceId, targetId, type required");
    }

    const edges = await loadEdges();

    // Dedup: same pair + same type → update existing
    const existingIdx = edges.findIndex(e =>
        e.sourceId === edge.sourceId &&
        e.targetId === edge.targetId &&
        e.type === edge.type
    );

    if (existingIdx >= 0) {
        // Update: keep higher confidence/strength, refresh explanation
        const existing = edges[existingIdx];
        edges[existingIdx] = {
            ...existing,
            confidence: Math.max(existing.confidence || 0, edge.confidence || 0),
            strength: Math.max(existing.strength || 0, edge.strength || 0),
            explanation: edge.explanation || existing.explanation,
            similarity: edge.similarity ?? existing.similarity,
            updatedAt: Date.now()
        };
        await saveEdges(edges);
        return edges[existingIdx];
    }

    // New edge
    edges.push(edge);

    // Evict if over capacity
    const trimmed = evictWeakestEdges(edges, KG_MAX_EDGES);
    await saveEdges(trimmed);

    return edge;
}

/**
 * Remove an edge by ID.
 * @param {string} edgeId - Edge ID to remove
 * @returns {Promise<boolean>} True if edge was found and removed
 */
export async function removeEdge(edgeId) {
    if (!edgeId) return false;

    const edges = await loadEdges();
    const before = edges.length;
    const filtered = edges.filter(e => e?.edgeId !== edgeId);

    if (filtered.length === before) return false;

    await saveEdges(filtered);
    return true;
}

/**
 * Remove all edges involving a session (as source or target).
 * Call this when a session is deleted.
 *
 * @param {string} sessionId - Session ID
 * @returns {Promise<number>} Number of edges removed
 */
export async function removeEdgesForSession(sessionId) {
    if (!sessionId) return 0;

    const edges = await loadEdges();
    const kept = edges.filter(e =>
        e?.sourceId !== sessionId && e?.targetId !== sessionId
    );

    const removed = edges.length - kept.length;
    if (removed > 0) {
        await saveEdges(kept);
    }
    return removed;
}

// ─── Query ──────────────────────────────────────────────────

/**
 * Get all edges involving a session (as source or target).
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Matching edges
 */
export async function getEdgesForSession(sessionId) {
    if (!sessionId) return [];

    const edges = await loadEdges();
    return edges.filter(e =>
        e?.sourceId === sessionId || e?.targetId === sessionId
    );
}

/**
 * Get 1-hop neighbors of a session from the adjacency index.
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array<{ edgeId, neighborId, type, strength }>>}
 */
export async function getNeighbors(sessionId) {
    if (!sessionId) return [];

    const edges = await loadEdges();
    const index = buildAdjacencyIndex(edges);
    return index.get(sessionId) || [];
}

/**
 * Check if the graph has any edges.
 * @returns {Promise<boolean>}
 */
export async function hasEdges() {
    const edges = await loadEdges();
    return edges.length > 0;
}

/**
 * Get basic graph statistics.
 * @returns {Promise<Object>} { total, byType, byCreator }
 */
export async function getStats() {
    const edges = await loadEdges();

    const byType = {};
    const byCreator = {};

    for (const edge of edges) {
        const t = edge?.type || "unknown";
        byType[t] = (byType[t] || 0) + 1;

        const c = edge?.createdBy || "unknown";
        byCreator[c] = (byCreator[c] || 0) + 1;
    }

    return {
        total: edges.length,
        byType,
        byCreator
    };
}

// ─── Adjacency Index ────────────────────────────────────────

/**
 * Build an in-memory bidirectional adjacency index.
 * Edge A→B creates entries for both A and B.
 *
 * @param {Array} edges - Array of Edge objects
 * @returns {Map<string, Array<{ edgeId, neighborId, type, strength }>>}
 */
export function buildAdjacencyIndex(edges) {
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

// ─── Eviction ───────────────────────────────────────────────

/**
 * Evict weakest edges when over capacity.
 * Sorts by strength ASC → createdAt ASC (oldest weakest first).
 *
 * @param {Array} edges - Current edge list
 * @param {number} maxEdges - Maximum allowed edges
 * @returns {Array} Trimmed edge list
 */
function evictWeakestEdges(edges, maxEdges = KG_MAX_EDGES) {
    if (!Array.isArray(edges) || edges.length <= maxEdges) return edges;

    // Sort: weakest + oldest first
    const sorted = [...edges].sort((a, b) => {
        const strengthDiff = (a.strength ?? 1.0) - (b.strength ?? 1.0);
        if (strengthDiff !== 0) return strengthDiff;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });

    // Remove from front (weakest), keep from end (strongest)
    return sorted.slice(sorted.length - maxEdges);
}

// ─── Memory Strength & Decay (Phase 3) ─────────────────────

/**
 * Ebbinghaus-inspired decay function.
 * strength_now = initial × e^(-decayRate × daysSince)
 *
 * @param {number} initialStrength - Strength at last reinforcement (0-1)
 * @param {number} daysSince - Days since last reinforcement
 * @param {number} [decayRate=0.05] - Decay rate
 * @returns {number} Current strength (0-1)
 */
export function computeDecay(initialStrength, daysSince, decayRate = 0.05) {
    if (daysSince <= 0) return initialStrength;
    return initialStrength * Math.exp(-decayRate * daysSince);
}

/**
 * Reinforce an edge: boost its strength and update metadata.
 *
 * @param {string} edgeId - Edge ID to reinforce
 * @param {number} [boost=0.1] - Strength boost (capped at 1.0)
 * @returns {Promise<Object|null>} Updated edge or null
 */
export async function reinforceEdge(edgeId, boost = 0.1) {
    if (!edgeId) return null;

    const edges = await loadEdges();
    const idx = edges.findIndex(e => e?.edgeId === edgeId);
    if (idx < 0) return null;

    const edge = edges[idx];
    edge.strength = Math.min(1.0, (edge.strength || 1.0) + boost);
    edge.lastReinforcedAt = Date.now();
    edge.reinforceCount = (edge.reinforceCount || 0) + 1;

    await saveEdges(edges);
    return edge;
}

/**
 * Reinforce all edges for a session (both source and target).
 * Called when user revisits a page.
 *
 * @param {string} sessionId - Session ID
 * @param {number} [boost=0.2] - Strength boost per edge
 * @returns {Promise<number>} Number of edges reinforced
 */
export async function reinforceBySession(sessionId, boost = 0.2) {
    if (!sessionId) return 0;

    const edges = await loadEdges();
    let count = 0;
    const now = Date.now();

    for (const edge of edges) {
        if (edge.sourceId === sessionId || edge.targetId === sessionId) {
            edge.strength = Math.min(1.0, (edge.strength || 1.0) + boost);
            edge.lastReinforcedAt = now;
            edge.reinforceCount = (edge.reinforceCount || 0) + 1;
            count++;
        }
    }

    if (count > 0) await saveEdges(edges);
    return count;
}

/**
 * Run decay cycle: recalculate strength for all edges,
 * remove dead edges (strength < 0.05).
 *
 * Intended to run every 6 hours via chrome.alarms.
 *
 * @returns {Promise<{ updated: number, removed: number }>}
 */
export async function runDecayCycle() {
    const edges = await loadEdges();
    if (edges.length === 0) return { updated: 0, removed: 0 };

    const now = Date.now();
    const DEAD_THRESHOLD = 0.05;
    const DEFAULT_DECAY_RATE = 0.05;

    const alive = [];
    let removed = 0;

    for (const edge of edges) {
        const lastActive = edge.lastReinforcedAt || edge.lastActivatedAt || edge.createdAt || now;
        const daysSince = (now - lastActive) / 86400000;

        // Apply decay
        const decayed = computeDecay(
            edge.strength ?? 1.0,
            daysSince,
            edge.decayRate || DEFAULT_DECAY_RATE
        );

        if (decayed < DEAD_THRESHOLD) {
            removed++;
        } else {
            edge.strength = Math.round(decayed * 100) / 100;
            alive.push(edge);
        }
    }

    if (removed > 0 || alive.length !== edges.length) {
        await saveEdges(alive);
    }

    return { updated: alive.length, removed };
}

