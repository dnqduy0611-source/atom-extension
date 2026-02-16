/**
 * SRQ Enricher - Creates and enriches Smart Research Queue cards
 *
 * Flow: captureData → extract topic → derive reading mode → PII check → save card
 * Async enrichment: routeTopic for notebook suggestion + related sessions
 */

import { normalizeString, NLM_SENSITIVE_DOMAINS_KEY, DEFAULT_NLM_SENSITIVE_DOMAINS, SRQ_IDEMPOTENCY_TIME_BUCKET_MS, SRQ_IDEMPOTENCY_KEY_VERSION } from "../bridge/types.js";
import { extractTopic } from "../bridge/topic_extractor.js";
import { containsPii, getPiiSummary, isSensitiveUrl, normalizeSensitiveDomains } from "../bridge/privacy_guard.js";
import { addCard, updateCard, loadCards } from "../storage/srq_store.js";
import { routeTopic } from "../bridge/topic_router.js";

/**
 * Derive reading mode from capture signals.
 * Replicates logic from bridge_service.deriveReadingMode (unexported).
 *
 * @param {Object} data - Capture data
 * @returns {"skim"|"deep"|"reference"|"reread"}
 */
function deriveReadingMode(data) {
    if (!data) return "skim";

    const command = normalizeString(data.command).toLowerCase();
    if (command.includes("critique") || command.includes("quiz") || command.includes("analyze")) {
        return "deep";
    }
    if (command.includes("reference") || command.includes("cite")) {
        return "reference";
    }

    const selection = normalizeString(data.selectedText);
    if (selection.length > 500) return "deep";

    return "skim";
}

/**
 * Generate a unique card ID
 * @returns {string} ID like "src_1738900000000_a3f2b1c8"
 */
function generateCardId() {
    const ts = Date.now();
    const rand = Math.random().toString(16).slice(2, 10);
    return `src_${ts}_${rand}`;
}

/**
 * Load sensitive domains from storage
 * @returns {Promise<string[]>} Sensitive domain patterns
 */
async function loadSensitiveDomains() {
    try {
        const data = await chrome.storage.local.get([NLM_SENSITIVE_DOMAINS_KEY]);
        const raw = data[NLM_SENSITIVE_DOMAINS_KEY];
        return Array.isArray(raw) ? raw : DEFAULT_NLM_SENSITIVE_DOMAINS;
    } catch {
        return DEFAULT_NLM_SENSITIVE_DOMAINS;
    }
}

/**
 * Build idempotency key for duplicate detection (Wave 1 P0).
 *
 * Format: ${origin+pathname}:${normalizedTitle}:${selectionPrefix}:${timeBucket}:v1
 *
 * @param {Object} data - Capture data
 * @returns {string} Stable idempotency key
 */
export function buildIdempotencyKey(data) {
    if (!data) return "";

    try {
        // Parse URL for origin + pathname
        const url = new URL(normalizeString(data.url) || "");
        const base = `${url.origin}${url.pathname}`;

        // Normalized title
        const title = normalizeString(data.title || "").toLowerCase().trim();

        // Selection prefix (first 120 chars, normalized)
        const selection = normalizeString(data.selectedText || data.viewportExcerpt || "");
        const selectionPrefix = selection.substring(0, 120).toLowerCase().trim();

        // Time bucket: floor to 60s UTC
        const nowMs = Date.now();
        const bucketStartMs = Math.floor(nowMs / SRQ_IDEMPOTENCY_TIME_BUCKET_MS) * SRQ_IDEMPOTENCY_TIME_BUCKET_MS;

        // Build key
        const key = `${base}:${title}:${selectionPrefix}:${bucketStartMs}:${SRQ_IDEMPOTENCY_KEY_VERSION}`;
        return key;
    } catch (err) {
        console.warn("[SRQ] buildIdempotencyKey failed:", err.message);
        // Fallback: use timestamp-based key (not ideal but prevents crash)
        return `fallback:${Date.now()}:${SRQ_IDEMPOTENCY_KEY_VERSION}`;
    }
}

/**
 * Create a new Research Card from captured data.
 *
 * @param {Object} captureData
 * @param {string} captureData.url - Page URL
 * @param {string} captureData.title - Page title
 * @param {string} captureData.domain - Page domain
 * @param {string} captureData.selectedText - Highlighted text
 * @param {string} [captureData.viewportExcerpt] - Fallback excerpt
 * @param {string[]} [captureData.tags] - User tags
 * @param {string} [captureData.tagsSource] - "user" | "ai"
 * @param {string} [captureData.command] - Command used (critique, quiz, etc.)
 * @param {string} [captureData.atomicThought] - AI atomic thought
 * @param {string} [captureData.refinedInsight] - AI refined insight
 * @returns {Promise<Object|null>} Created card or null if skipped
 */
export async function createResearchCard(captureData) {
    if (!captureData) return null;

    const url = normalizeString(captureData.url);
    const selectedText = normalizeString(captureData.selectedText);
    const viewportExcerpt = normalizeString(captureData.viewportExcerpt);

    // Skip if no content to save
    if (!selectedText && !viewportExcerpt) return null;

    // Skip sensitive domains
    const sensitiveDomains = await loadSensitiveDomains();
    if (url && isSensitiveUrl(url, sensitiveDomains)) {
        console.log("[SRQ] Skipping sensitive domain:", captureData.domain);
        return null;
    }

    // Extract topic
    const topic = extractTopic({
        title: captureData.title || "",
        selection: selectedText,
        tags: captureData.tags || [],
        domain: captureData.domain || "",
        tagsSource: captureData.tagsSource || "ai"
    });

    // Derive reading mode
    const readingMode = deriveReadingMode(captureData);

    // PII check
    let piiWarning = false;
    let piiTypes = [];
    if (containsPii(selectedText)) {
        const summary = getPiiSummary(selectedText);
        piiWarning = true;
        piiTypes = summary.types;
        console.warn("[SRQ] PII detected:", summary.types);
    }

    // Build idempotency key (Wave 1 P0)
    const idempotencyKey = buildIdempotencyKey(captureData);

    // Build card
    const card = {
        cardId: generateCardId(),
        createdAt: Date.now(),
        idempotencyKey,
        status: "pending_review",
        // Source context
        url,
        domain: normalizeString(captureData.domain),
        title: normalizeString(captureData.title),
        selectedText: piiWarning ? selectedText.substring(0, 100) + "..." : selectedText,
        viewportExcerpt,
        // Topic
        topicKey: topic.topicKey,
        topicSource: topic.topicSource,
        topicLabel: topic.topicLabel,
        topicConfidence: topic.confidence,
        keywords: topic.keywords || [],
        // Reading signal
        readingMode,
        command: normalizeString(captureData.command) || null,
        // Enrichment (sync available, async fills rest)
        atomicThought: normalizeString(captureData.atomicThought) || null,
        refinedInsight: normalizeString(captureData.refinedInsight) || null,
        relatedSessions: [],
        connectionHint: null,
        // Export tracking
        suggestedNotebook: null,
        exportedJobId: null,
        exportedAt: null,
        // User annotations
        userTags: [],
        userNote: "",
        // PII
        piiWarning,
        piiTypes
    };

    // Note: Card is NOT saved here (Wave 1 P0 change)
    // Handler in background.js will upsert the card
    // This allows centralized idempotency + rollback logic

    return card;
}

/**
 * Async enrichment: find suggested notebook + related sessions.
 * Runs after card creation, does not block the user.
 *
 * @param {string} cardId - Card to enrich
 * @returns {Promise<Object|null>} Updated card
 */
/**
 * Async enrichment: find suggested notebook + related sessions.
 * Wave 2 P1: Optimistic locking to prevent overwriting user changes.
 *
 * @param {string} cardId - Card to enrich
 * @returns {Promise<Object|null>} Updated card or null if skipped
 */
export async function enrichCardAsync(cardId) {
    if (!cardId) return null;

    // Step 1: Read card and record timestamp
    const allCards = await loadCards();
    const card = allCards.find(c => c?.cardId === cardId);
    if (!card) return null;

    const initialUpdatedAt = card.updatedAt || card.createdAt;
    const initialStatus = card.status;

    // Step 2: Perform enrichment (topic routing, related sessions)
    const patch = {};

    try {
        // Find suggested notebook via topic router
        try {
            const routeResult = await routeTopic({
                title: card.title,
                selection: card.selectedText,
                tags: card.keywords,
                domain: card.domain,
                url: card.url
            }, { savePending: false });

            if (routeResult?.decision === "use_existing" && routeResult.bestMatch) {
                patch.suggestedNotebook = routeResult.bestMatch.notebookRef;
            } else if (routeResult?.decision === "ask" && routeResult.bestMatch) {
                patch.suggestedNotebook = routeResult.bestMatch.notebookRef;
            }
        } catch (err) {
            console.warn("[SRQ] Topic routing failed:", err.message);
        }

        // Find related sessions via background message
        try {
            const response = await chrome.runtime.sendMessage({
                type: "SRQ_FIND_RELATED",
                url: card.url,
                title: card.title
            });
            if (response?.ok && Array.isArray(response.sessions)) {
                patch.relatedSessions = response.sessions
                    .filter(s => s.similarity >= 0.7)
                    .slice(0, 3);
            }
        } catch {
            // Related sessions are optional enrichment
        }

    } catch (err) {
        console.warn("[SRQ] Enrichment processing failed:", err.message);
        return null;
    }

    // Step 3: Optimistic update - check if card changed during enrichment
    const currentCards = await loadCards();
    const currentCard = currentCards.find(c => c?.cardId === cardId);

    if (!currentCard) {
        console.warn("[SRQ] Enrich skipped: card was deleted", cardId);
        return null;
    }

    const currentUpdatedAt = currentCard.updatedAt || currentCard.createdAt;
    const currentStatus = currentCard.status;

    // Conflict detection — allow auto-approve (pending_review → approved)
    const autoApproved = initialStatus === "pending_review" && currentStatus === "approved";
    if (currentUpdatedAt > initialUpdatedAt && !autoApproved) {
        console.warn("[SRQ] Enrich skipped: card was updated during enrichment", {
            cardId,
            initialUpdatedAt,
            currentUpdatedAt,
            initialStatus,
            currentStatus
        });
        return null;  // Skip update silently
    }

    // Safe to update
    if (Object.keys(patch).length > 0) {
        const updated = await updateCard(cardId, patch);

        // Broadcast update (low priority)
        chrome.runtime.sendMessage({
            type: "SRQ_CARDS_UPDATED",
            reason: "enrichment_completed",
            changedIds: [cardId]
        }).catch(() => { });

        return updated;
    }

    return currentCard;
}
