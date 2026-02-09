/**
 * SRQ Store - CRUD operations for Smart Research Queue cards
 *
 * Storage key: atom_srq_cards_v1
 * Max cards: 200 (FIFO eviction of exported/dismissed cards)
 */

import { SRQ_CARDS_KEY, SRQ_MAX_CARDS, normalizeString } from "../bridge/types.js";

/**
 * Load all research cards from storage
 * @returns {Promise<Array>} Array of ResearchCard objects
 */
export async function loadCards() {
    const data = await chrome.storage.local.get([SRQ_CARDS_KEY]);
    const list = data[SRQ_CARDS_KEY];
    return Array.isArray(list) ? list : [];
}

/**
 * Save all cards to storage
 * @param {Array} cards - Array of ResearchCard objects
 */
export async function saveCards(cards) {
    const safe = Array.isArray(cards) ? cards : [];
    await chrome.storage.local.set({ [SRQ_CARDS_KEY]: safe });
}

/**
 * FIFO eviction: remove oldest exported/dismissed cards when at capacity.
 * Never auto-evict pending_review or approved cards.
 * @param {Array} cards - Current card list
 * @returns {Array} Trimmed card list
 */
function evictIfNeeded(cards) {
    if (!Array.isArray(cards) || cards.length < SRQ_MAX_CARDS) return cards;

    const evictable = ["exported", "dismissed"];
    const next = [...cards];

    // Sort evictable candidates by createdAt ascending (oldest first)
    const candidates = next
        .map((card, idx) => ({ card, idx }))
        .filter(({ card }) => evictable.includes(card?.status))
        .sort((a, b) => (a.card.createdAt || 0) - (b.card.createdAt || 0));

    let removed = 0;
    const toRemove = new Set();

    for (const { idx } of candidates) {
        if (next.length - toRemove.size < SRQ_MAX_CARDS) break;
        toRemove.add(idx);
        removed++;
    }

    if (removed === 0) return next;
    return next.filter((_, idx) => !toRemove.has(idx));
}

/**
 * Add a new research card to the store
 * @param {Object} card - ResearchCard object (must have cardId)
 * @returns {Promise<Object>} The added card
 */
export async function addCard(card) {
    if (!card?.cardId) throw new Error("[srq_store] addCard: cardId required");

    const cards = await loadCards();
    cards.push(card);
    const trimmed = evictIfNeeded(cards);
    await saveCards(trimmed);
    return card;
}

/**
 * Update a card with a partial patch
 * @param {string} cardId - Card ID to update
 * @param {Object} patch - Fields to merge
 * @returns {Promise<Object|null>} Updated card or null if not found
 */
export async function updateCard(cardId, patch) {
    if (!cardId) return null;

    const cards = await loadCards();
    const idx = cards.findIndex(c => c?.cardId === cardId);
    if (idx < 0) return null;

    cards[idx] = { ...cards[idx], ...patch, updatedAt: Date.now() };
    await saveCards(cards);
    return cards[idx];
}

/**
 * Update card status
 * @param {string} cardId - Card ID
 * @param {string} status - New status: pending_review | approved | exported | dismissed
 * @returns {Promise<Object|null>} Updated card or null
 */
export async function updateCardStatus(cardId, status) {
    return updateCard(cardId, { status });
}

/**
 * Get cards filtered by status
 * @param {string} status - Status to filter
 * @returns {Promise<Array>} Matching cards
 */
export async function getCardsByStatus(status) {
    const cards = await loadCards();
    const target = normalizeString(status).toLowerCase();
    return cards.filter(c => c?.status === target);
}

/**
 * Get cards filtered by topicKey
 * @param {string} topicKey - TopicKey to filter
 * @returns {Promise<Array>} Matching cards
 */
export async function getCardsByTopicKey(topicKey) {
    const cards = await loadCards();
    const target = normalizeString(topicKey).toLowerCase();
    return cards.filter(c => (c?.topicKey || "").toLowerCase() === target);
}

/**
 * Get all pending cards (status = pending_review)
 * @returns {Promise<Array>} Pending cards
 */
export async function getPendingCards() {
    return getCardsByStatus("pending_review");
}

/**
 * Dismiss a card (set status to dismissed)
 * @param {string} cardId - Card ID
 */
export async function dismissCard(cardId) {
    await updateCardStatus(cardId, "dismissed");
}

/**
 * Remove stale cards older than maxAgeDays with status exported or dismissed
 * @param {number} maxAgeDays - Max age in days (default 14)
 * @returns {Promise<number>} Number of cards removed
 */
export async function cleanupStaleCards(maxAgeDays = 14) {
    const cards = await loadCards();
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const staleStatuses = ["exported", "dismissed"];

    const kept = [];
    let removed = 0;

    for (const card of cards) {
        if (!card) { removed++; continue; }

        const age = now - (card.createdAt || 0);
        if (age > maxAgeMs && staleStatuses.includes(card.status)) {
            removed++;
        } else {
            kept.push(card);
        }
    }

    if (removed > 0) {
        await saveCards(kept);
    }
    return removed;
}

/**
 * Find card by idempotency key (Wave 1 P0)
 * @param {string} idempotencyKey - Idempotency key to search
 * @returns {Promise<Object|null>} Card or null if not found
 */
export async function findCardByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;

    const cards = await loadCards();
    return cards.find(c => c?.idempotencyKey === idempotencyKey) || null;
}

/**
 * Upsert card: insert new or update existing by idempotencyKey (Wave 1 P0)
 *
 * If idempotencyKey exists: merge patch into existing card, update updatedAt
 * If not found: add as new card
 *
 * @param {Object} card - ResearchCard object (must have cardId + idempotencyKey)
 * @returns {Promise<Object>} The created or updated card
 */
export async function upsertCard(card) {
    if (!card?.cardId) throw new Error("[srq_store] upsertCard: cardId required");
    if (!card?.idempotencyKey) throw new Error("[srq_store] upsertCard: idempotencyKey required");

    const cards = await loadCards();
    const existingIdx = cards.findIndex(c => c?.idempotencyKey === card.idempotencyKey);

    if (existingIdx >= 0) {
        // Update existing card
        const existing = cards[existingIdx];
        cards[existingIdx] = {
            ...existing,
            ...card,
            cardId: existing.cardId,  // Preserve original cardId
            createdAt: existing.createdAt,  // Preserve original createdAt
            updatedAt: Date.now()
        };
        await saveCards(cards);
        return cards[existingIdx];
    } else {
        // Add new card
        cards.push(card);
        const trimmed = evictIfNeeded(cards);
        await saveCards(trimmed);
        return card;
    }
}

/**
 * Get card count stats by status
 * @returns {Promise<Object>} { pending, approved, exported, dismissed, total }
 */
export async function getCardStats() {
    const cards = await loadCards();
    const stats = { pending: 0, approved: 0, exported: 0, dismissed: 0, total: cards.length };

    for (const card of cards) {
        if (!card?.status) continue;
        switch (card.status) {
            case "pending_review": stats.pending++; break;
            case "approved": stats.approved++; break;
            case "exported": stats.exported++; break;
            case "dismissed": stats.dismissed++; break;
        }
    }

    return stats;
}
