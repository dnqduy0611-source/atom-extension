// brain/auto_enable_semantics.js
// Auto-enable Semantic features khi user có đủ data.
// Hook vào atom_brain_maintenance alarm (mỗi 6h).

const MIN_CARDS_FOR_SEMANTICS = 10;
const FLAGS_KEY = 'atom_feature_flags_v1';

/**
 * Check và auto-enable Semantics nếu đủ điều kiện.
 * Gọi từ scheduler.js > brain_maintenance handler.
 * 
 * Điều kiện: atom_srq_cards_v3.length >= 10
 * Action:    flip EMBEDDINGS_ENABLED + SEMANTIC_SEARCH_ENABLED
 */
export async function checkAndEnableSemantics() {
    try {
        // Đã enable rồi thì skip
        const data = await chrome.storage.local.get([FLAGS_KEY]);
        const currentFlags = data[FLAGS_KEY] || {};
        if (currentFlags.EMBEDDINGS_ENABLED && currentFlags.SEMANTIC_SEARCH_ENABLED) {
            return false; // Đã bật rồi
        }

        // Check card count
        const { atom_srq_cards_v3: cards } = await chrome.storage.local.get(['atom_srq_cards_v3']);
        const cardCount = Array.isArray(cards) ? cards.length : 0;

        if (cardCount >= MIN_CARDS_FOR_SEMANTICS) {
            currentFlags.EMBEDDINGS_ENABLED = true;
            currentFlags.SEMANTIC_SEARCH_ENABLED = true;
            await chrome.storage.local.set({ [FLAGS_KEY]: currentFlags });
            console.log(`[Brain] Auto-enabled Semantics (${cardCount} cards)`);
            return true;
        }

        return false;
    } catch (err) {
        console.warn('[Brain] Auto-enable semantics failed:', err);
        return false;
    }
}
