/**
 * SRQ Visual Anchor - Captures contextual thumbnails for research cards.
 *
 * Flow: captureVisibleTab → send to offscreen doc → canvas compress → data URL
 * Runs in background service worker context (MV3).
 *
 * MV3 Constraint: Service workers have no DOM/canvas, so we use an
 * OffscreenDocument to perform image compression.
 */

const VA_MAX_WIDTH = 200;
const VA_MAX_HEIGHT = 120;
const VA_MAX_BYTES = 50 * 1024;  // 50KB
const VA_MAX_ANCHORS = 100;      // Budget: 100 × 50KB = ~5MB max, leaving room for other storage
const VA_OFFSCREEN_URL = 'offscreen_anchor.html';

// Feature flag check — reads from storage directly (background context).
// Must mirror the default from config/feature_flags.js (IIFE, not importable here).
const VA_FLAG_KEY = 'atom_feature_flags_v1';
const VA_DEFAULT_ENABLED = true;

/**
 * Check if visual anchor feature is enabled.
 * Respects explicit storage override, falls back to code default.
 * @returns {Promise<boolean>}
 */
async function isVisualAnchorEnabled() {
    try {
        const data = await chrome.storage.local.get([VA_FLAG_KEY]);
        const stored = data[VA_FLAG_KEY] || {};
        if (Object.prototype.hasOwnProperty.call(stored, 'SRQ_P2_VISUAL_ANCHOR')) {
            return stored.SRQ_P2_VISUAL_ANCHOR === true;
        }
        return VA_DEFAULT_ENABLED;
    } catch {
        return false;
    }
}

/**
 * Ensure offscreen document exists for image processing.
 * @returns {Promise<boolean>} True if ready
 */
async function ensureOffscreenDocument() {
    try {
        // Check if already exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [chrome.runtime.getURL(VA_OFFSCREEN_URL)]
        });
        if (existingContexts.length > 0) return true;

        // Create new offscreen document
        await chrome.offscreen.createDocument({
            url: VA_OFFSCREEN_URL,
            reasons: ['BLOBS'],
            justification: 'SRQ Visual Anchor: Compress screenshot thumbnails for research cards'
        });
        return true;
    } catch (err) {
        console.warn('[SRQ VA] Failed to create offscreen document:', err.message);
        return false;
    }
}

/**
 * Close offscreen document after use.
 */
async function closeOffscreenDocument() {
    try {
        await chrome.offscreen.closeDocument();
    } catch {
        // Already closed or doesn't exist — safe to ignore
    }
}

/**
 * Capture visible tab screenshot and compress to thumbnail.
 * Non-blocking, graceful fallback on any failure.
 *
 * @param {number} tabId - Tab to capture (must be active)
 * @returns {Promise<string|null>} Base64 data URL or null on failure
 */
export async function captureVisualAnchor(tabId) {
    // Gate: check feature flag
    const enabled = await isVisualAnchorEnabled();
    if (!enabled) return null;

    if (!tabId) return null;

    // Gate: storage budget — skip if too many anchors already stored
    try {
        const { loadCards } = await import('../storage/srq_store.js');
        const cards = await loadCards();
        const anchorCount = cards.filter(c => c?.visualAnchor).length;
        if (anchorCount >= VA_MAX_ANCHORS) {
            console.info('[SRQ VA] Anchor budget reached (%d/%d), skipping capture', anchorCount, VA_MAX_ANCHORS);
            return null;
        }
    } catch {
        // Non-fatal — proceed with capture if count check fails
    }

    try {
        // Step 1: Capture full screenshot
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
            format: 'png',
            quality: 90
        });

        if (!dataUrl) {
            console.warn('[SRQ VA] captureVisibleTab returned empty');
            return null;
        }

        // Step 2: Compress via offscreen document
        const offscreenReady = await ensureOffscreenDocument();
        if (!offscreenReady) {
            console.warn('[SRQ VA] Offscreen document not available, skipping compression');
            return null;
        }

        const response = await chrome.runtime.sendMessage({
            type: 'SRQ_COMPRESS_THUMBNAIL',
            dataUrl,
            maxWidth: VA_MAX_WIDTH,
            maxHeight: VA_MAX_HEIGHT,
            maxBytes: VA_MAX_BYTES
        });

        // Step 3: Clean up offscreen document
        await closeOffscreenDocument();

        if (response?.ok && response.thumbnail) {
            return response.thumbnail;
        }

        console.warn('[SRQ VA] Compression failed:', response?.error);
        return null;
    } catch (err) {
        console.warn('[SRQ VA] captureVisualAnchor failed:', err.message);
        // Clean up offscreen on error too
        await closeOffscreenDocument();
        return null;
    }
}

/**
 * Clean up visual anchor data from cards.
 * Call when cards are dismissed or exported to free storage.
 *
 * @param {string[]} cardIds - Card IDs to clean up (not used directly,
 *   but cleanup is done by removing visualAnchor field from saved cards)
 * @returns {Promise<number>} Number of anchors removed
 */
export async function cleanupAnchors(cardIds) {
    if (!Array.isArray(cardIds) || cardIds.length === 0) return 0;

    try {
        const { updateCard } = await import('../storage/srq_store.js');
        let cleaned = 0;
        for (const cardId of cardIds) {
            const result = await updateCard(cardId, { visualAnchor: null });
            if (result) cleaned++;
        }
        return cleaned;
    } catch (err) {
        console.warn('[SRQ VA] cleanupAnchors failed:', err.message);
        return 0;
    }
}
