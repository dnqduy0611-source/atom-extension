/**
 * ConversationDigestStore — Storage layer for conversation digests
 * 
 * Stores summarized conversation threads for cross-session memory.
 * Each digest captures key Q&A pairs, topics, and summary from a thread.
 * 
 * Supports:
 * - CRUD operations
 * - De-duplication by threadId
 * - Strength-based eviction (max 200 digests)
 * - Memory decay (Ebbinghaus-style)
 * - Reinforcement on recall
 */
(function () {
    'use strict';

    const DIGESTS_KEY = 'atom_conversation_digests_v1';
    const MAX_DIGESTS = 200;

    // ── ID Generation ──
    function createDigestId() {
        return `digest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // ── Load / Save ──
    async function loadDigests() {
        try {
            const data = await chrome.storage.local.get(DIGESTS_KEY);
            return data[DIGESTS_KEY] || [];
        } catch (err) {
            console.error('[DigestStore] Load failed:', err);
            return [];
        }
    }

    async function saveDigests(digests) {
        try {
            await chrome.storage.local.set({ [DIGESTS_KEY]: digests });
        } catch (err) {
            console.error('[DigestStore] Save failed:', err);
        }
    }

    // ── Add Digest ──
    // De-duplicates by threadId. If exists, updates with new data.
    async function addDigest(digest) {
        const digests = await loadDigests();

        // Check for existing by threadId
        const existingIdx = digests.findIndex(d => d.threadId === digest.threadId);

        if (existingIdx >= 0) {
            // Update existing, preserve original timestamp
            digests[existingIdx] = {
                ...digests[existingIdx],
                ...digest,
                createdAt: digests[existingIdx].createdAt
            };
        } else {
            // Add new with defaults
            digest.digestId = digest.digestId || createDigestId();
            digest.createdAt = digest.createdAt || Date.now();
            digest.strength = digest.strength ?? 1.0;
            digest.lastAccessedAt = digest.lastAccessedAt || Date.now();
            digest.accessCount = digest.accessCount || 0;
            digests.push(digest);
        }

        // Evict if over capacity
        const trimmed = evictWeakDigests(digests, MAX_DIGESTS);
        await saveDigests(trimmed);

        console.log(`[DigestStore] ${existingIdx >= 0 ? 'Updated' : 'Added'} digest for thread ${digest.threadId}`);
        return digest;
    }

    // ── Query ──
    async function getDigestsBySession(sessionId) {
        const digests = await loadDigests();
        return digests.filter(d => d.sessionId === sessionId);
    }

    async function getDigestsByDomain(domain) {
        const digests = await loadDigests();
        return digests.filter(d => d.domain === domain);
    }

    async function getDigestById(digestId) {
        const digests = await loadDigests();
        return digests.find(d => d.digestId === digestId) || null;
    }

    async function getDigestByThreadId(threadId) {
        const digests = await loadDigests();
        return digests.find(d => d.threadId === threadId) || null;
    }

    async function getRecentDigests(limit = 20) {
        const digests = await loadDigests();
        return digests
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, limit);
    }

    // ── Delete ──
    async function removeDigest(digestId) {
        const digests = await loadDigests();
        const filtered = digests.filter(d => d.digestId !== digestId);
        if (filtered.length < digests.length) {
            await saveDigests(filtered);
            return true;
        }
        return false;
    }

    async function removeDigestsForSession(sessionId) {
        const digests = await loadDigests();
        const filtered = digests.filter(d => d.sessionId !== sessionId);
        const removed = digests.length - filtered.length;
        if (removed > 0) {
            await saveDigests(filtered);
        }
        return removed;
    }

    // ── Reinforcement ──
    async function reinforceDigest(digestId, boost = 0.1) {
        const digests = await loadDigests();
        const digest = digests.find(d => d.digestId === digestId);
        if (!digest) return null;

        digest.strength = Math.min(1.0, (digest.strength || 0) + boost);
        digest.lastAccessedAt = Date.now();
        digest.accessCount = (digest.accessCount || 0) + 1;

        await saveDigests(digests);
        return digest;
    }

    // ── Eviction (strength-based) ──
    function evictWeakDigests(digests, maxCount = MAX_DIGESTS) {
        if (digests.length <= maxCount) return digests;

        // Sort by strength ASC, then by createdAt ASC (weakest + oldest first)
        const sorted = [...digests].sort((a, b) => {
            const sa = a.strength ?? 1.0;
            const sb = b.strength ?? 1.0;
            if (sa !== sb) return sa - sb;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });

        // Keep the strongest (last N items)
        const evicted = sorted.length - maxCount;
        console.log(`[DigestStore] Evicting ${evicted} weak digests`);
        return sorted.slice(evicted);
    }

    // ── Decay ──
    // Called by decay cycle alarm (shared with KG edges)
    async function runDigestDecay(decayRate = 0.03) {
        const digests = await loadDigests();
        const now = Date.now();
        const surviving = [];
        let removed = 0;

        for (const d of digests) {
            const daysSince = (now - (d.lastAccessedAt || d.createdAt || now)) / 86400000;
            const newStrength = (d.strength || 1.0) * Math.exp(-decayRate * daysSince);

            if (newStrength < 0.05) {
                removed++;
                // Cleanup embedding from VectorStore
                if (window.VectorStore?.deleteEmbedding) {
                    window.VectorStore.deleteEmbedding(d.digestId).catch(() => { });
                }
                continue;
            }

            d.strength = Math.round(newStrength * 100) / 100;
            surviving.push(d);
        }

        await saveDigests(surviving);
        console.log(`[DigestDecay] ${surviving.length} survived, ${removed} removed`);
        return { survived: surviving.length, removed };
    }

    // ── Stats ──
    async function getStats() {
        const digests = await loadDigests();
        const byMethod = { llm: 0, rule_based: 0 };
        for (const d of digests) {
            if (d.digestMethod === 'llm') byMethod.llm++;
            else byMethod.rule_based++;
        }
        return {
            total: digests.length,
            byMethod,
            avgStrength: digests.length > 0
                ? Math.round(digests.reduce((s, d) => s + (d.strength || 0), 0) / digests.length * 100) / 100
                : 0
        };
    }

    // ── Export ──
    window.ConversationDigestStore = {
        loadDigests,
        saveDigests,
        addDigest,
        getDigestsBySession,
        getDigestsByDomain,
        getDigestById,
        getDigestByThreadId,
        getRecentDigests,
        removeDigest,
        removeDigestsForSession,
        reinforceDigest,
        evictWeakDigests,
        runDigestDecay,
        getStats,
        createDigestId,
        DIGESTS_KEY,
        MAX_DIGESTS
    };

    console.log('[ConversationDigestStore] Module loaded');
})();
