/**
 * SRQ Grouper - Groups Research Cards into batches by topic
 *
 * Batches are computed on-the-fly (not stored).
 * Priority scoring: readingMode weight + batch size + age urgency.
 */

import { loadCards } from "../storage/srq_store.js";

/**
 * Reading mode weights for priority calculation.
 * Deep reading = highest value, skim = lowest.
 */
const MODE_WEIGHTS = {
    deep: 1.0,
    reread: 0.8,
    reference: 0.5,
    skim: 0.2
};

/**
 * Compute batch priority score (0-100).
 *
 * Formula: (modeWeight * 40) + (sizeWeight * 30) + (ageWeight * 30)
 *
 * @param {Object} batch - Batch with cards and stats
 * @returns {number} Priority 0-100
 */
export function computeBatchPriority(batch) {
    if (!batch?.cards?.length) return 0;

    const total = batch.stats.total || 1;

    // Mode weight: proportion of deep/reread vs skim
    const modeScore =
        ((batch.stats.deep || 0) * MODE_WEIGHTS.deep +
         (batch.stats.reread || 0) * MODE_WEIGHTS.reread +
         (batch.stats.reference || 0) * MODE_WEIGHTS.reference +
         (batch.stats.skim || 0) * MODE_WEIGHTS.skim) / total;

    // Size weight: logarithmic (1 card=0.30, 3=0.58, 5=0.72, 10=1.0)
    const sizeScore = Math.min(1, Math.log2(total + 1) / Math.log2(11));

    // Age weight: hours since oldest card, max urgency at 7 days (168h)
    const oldestAge = batch.oldestCardAge || 0;
    const ageHours = oldestAge / (1000 * 60 * 60);
    const ageScore = Math.min(1, ageHours / 168);

    const priority = Math.round(modeScore * 40 + sizeScore * 30 + ageScore * 30);
    return Math.min(100, Math.max(0, priority));
}

/**
 * Resolve the best notebook suggestion for a batch.
 * Picks the most frequently suggested notebook across cards.
 *
 * @param {Array} cards - Cards in the batch
 * @returns {string} Notebook reference or "Inbox"
 */
function resolveBatchNotebook(cards) {
    const counts = {};
    for (const card of cards) {
        if (card.suggestedNotebook) {
            counts[card.suggestedNotebook] = (counts[card.suggestedNotebook] || 0) + 1;
        }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || "Inbox";
}

/**
 * Count reading modes in a set of cards.
 * @param {Array} cards
 * @returns {Object} { total, deep, skim, reference, reread }
 */
function countModes(cards) {
    const stats = { total: cards.length, deep: 0, skim: 0, reference: 0, reread: 0 };
    for (const card of cards) {
        const mode = card?.readingMode || "skim";
        if (stats.hasOwnProperty(mode)) {
            stats[mode]++;
        } else {
            stats.skim++;
        }
    }
    return stats;
}

/**
 * Group cards into batches by topicKey.
 *
 * @param {Array} cards - ResearchCard array (should be pre-filtered)
 * @returns {Array} ResearchBatch array sorted by priority desc
 */
export function computeBatches(cards) {
    if (!Array.isArray(cards) || cards.length === 0) return [];

    // Only include actionable cards
    const actionable = cards.filter(c =>
        c?.status === "pending_review" || c?.status === "approved"
    );
    if (actionable.length === 0) return [];

    // Group by topicKey
    const groups = new Map();
    for (const card of actionable) {
        const key = (card.topicKey || "uncategorized").toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(card);
    }

    // Build batch objects
    const now = Date.now();
    const batches = [];

    for (const [topicKey, batchCards] of groups) {
        // Sort cards: newest first
        batchCards.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const stats = countModes(batchCards);
        const oldestCardAge = now - Math.min(...batchCards.map(c => c.createdAt || now));

        const batch = {
            topicKey,
            topicLabel: batchCards[0]?.topicLabel || topicKey,
            suggestedNotebook: resolveBatchNotebook(batchCards),
            cards: batchCards,
            stats,
            oldestCardAge
        };

        batch.priority = computeBatchPriority(batch);
        batches.push(batch);
    }

    // Sort by priority descending
    batches.sort((a, b) => b.priority - a.priority);

    return batches;
}

/**
 * Load pending cards and compute batches ready for export.
 * @returns {Promise<Array>} ResearchBatch array sorted by priority
 */
export async function getBatchesForExport() {
    const cards = await loadCards();
    return computeBatches(cards);
}
