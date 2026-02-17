// pipelines/memory_maintenance.js — KG + Digest decay
// Extracted từ background.js L1002-1067
// Dùng bởi brain/scheduler.js > BRAIN_MAINTENANCE handler

const KG_KEY = 'atom_knowledge_graph_v1';
const DIGEST_KEY = 'atom_conversation_digests_v1';
const DEAD_THRESHOLD = 0.05;
const KG_DECAY_RATE = 0.05;
const DIGEST_DECAY_RATE = 0.03;

/**
 * KG Edge Decay — exponential decay dựa trên thời gian kể từ last reinforcement.
 * Edges dưới DEAD_THRESHOLD (0.05) bị xóa.
 * 
 * Formula: strength * e^(-0.05 * days_since_last_active)
 */
export async function runKGDecay() {
    try {
        const { [KG_KEY]: rawEdges } = await chrome.storage.local.get([KG_KEY]);
        const edges = Array.isArray(rawEdges) ? rawEdges : [];
        if (edges.length === 0) return;

        const now = Date.now();
        const alive = [];
        let dead = 0;

        for (const edge of edges) {
            const lastActive = edge.lastReinforcedAt || edge.lastActivatedAt || edge.createdAt || now;
            const days = (now - lastActive) / 86400000;
            const decayed = (edge.strength ?? 1.0) * Math.exp(-KG_DECAY_RATE * Math.max(0, days));

            if (decayed < DEAD_THRESHOLD) {
                dead++;
            } else {
                edge.strength = Math.round(decayed * 100) / 100;
                alive.push(edge);
            }
        }

        if (dead > 0) {
            await chrome.storage.local.set({ [KG_KEY]: alive });
            console.log(`[KG Decay] Updated ${alive.length}, removed ${dead} dead edges`);
        }
    } catch (err) {
        console.warn('[KG Decay] Failed:', err);
    }
}

/**
 * Digest Decay — lower rate than KG (memories persist longer).
 * Phase D Hybrid Conversation Memory.
 * 
 * Formula: strength * e^(-0.03 * days_since_last_accessed)
 */
export async function runDigestDecay() {
    try {
        const { [DIGEST_KEY]: rawDigests } = await chrome.storage.local.get([DIGEST_KEY]);
        const digests = Array.isArray(rawDigests) ? rawDigests : [];
        if (digests.length === 0) return;

        const now = Date.now();
        const surviving = [];
        let removed = 0;

        for (const d of digests) {
            const daysSince = (now - (d.lastAccessedAt || d.createdAt || now)) / 86400000;
            const newStrength = (d.strength || 1.0) * Math.exp(-DIGEST_DECAY_RATE * Math.max(0, daysSince));

            if (newStrength < DEAD_THRESHOLD) {
                removed++;
            } else {
                d.strength = Math.round(newStrength * 100) / 100;
                surviving.push(d);
            }
        }

        if (removed > 0) {
            await chrome.storage.local.set({ [DIGEST_KEY]: surviving });
            console.log(`[Digest Decay] ${surviving.length} survived, ${removed} removed`);
        }
    } catch (err) {
        console.warn('[Digest Decay] Failed:', err);
    }
}
