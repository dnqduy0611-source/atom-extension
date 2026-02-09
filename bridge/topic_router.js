/**
 * Topic Router - Orchestrates topic extraction, scoring, and routing decisions
 *
 * Flow: extract topic → score against registry → return decision
 *
 * Decision types:
 * - "use_existing": High confidence match, auto-suggest existing notebook
 * - "ask": Medium confidence, prompt user to confirm
 * - "create": Low confidence, suggest creating new topic
 */
console.log('[ATOM] Loading topic_router.js...');

import { loadRegistry, setPendingTopic } from "./topic_registry.js";
console.log('[ATOM] Imported topic_registry.js');
import { AI_SERVICE } from "../ai_service.js";
import { extractTopic, extractTopicCandidates } from "./topic_extractor.js";
import {
    findBestMatches,
    getDecision,
    SCORE_THRESHOLD_AUTO_SUGGEST,
    SCORE_THRESHOLD_ASK
} from "./topic_scoring.js";
import { normalizeString } from "./types.js";

/**
 * Router result structure:
 * {
 *   decision: "use_existing" | "ask" | "create",
 *   bestMatch?: {
 *     notebookRef: string,
 *     notebookUrl: string,
 *     score: number,
 *     displayTitle: string,
 *     reasons: string[]
 *   },
 *   alternatives?: Array<{ ... }>,  // Other potential matches
 *   topicKey: string,
 *   displayTitle: string,
 *   keywords: string[],
 *   source: string,
 *   confidence: number
 * }
 */

/**
 * Route a reading context to determine the best notebook destination
 *
 * @param {Object} context - Reading context
 * @param {string} context.title - Page title
 * @param {string} context.selection - Selected text
 * @param {string[]} context.tags - User tags
 * @param {string} context.intent - User intent label
 * @param {string} context.domain - Website domain
 * @param {string} context.url - Full URL
 * @param {Object} options - Router options
 * @param {boolean} options.savePending - Save as pending topic if no match
 * @param {number} options.maxAlternatives - Max alternative matches to return
 * @returns {Promise<Object>} Router result
 */
export async function routeTopic(context, options = {}) {
    const {
        savePending = true,
        maxAlternatives = 3
    } = options;

    // Step 1: Extract topic from context
    const extracted = extractTopic(context);

    // Step 2: Load registry
    const registry = await loadRegistry();

    // Step 3: If registry is empty, suggest creating new topic
    if (registry.length === 0) {
        const result = {
            decision: "create",
            bestMatch: null,
            alternatives: [],
            // v1 spec fields
            topicKey: extracted.topicKey,
            topicSource: extracted.topicSource,
            topicLabel: extracted.topicLabel,
            // Legacy fields
            displayTitle: extracted.displayTitle,
            keywords: extracted.keywords,
            source: extracted.source,
            confidence: extracted.confidence,
            reason: "Registry is empty"
        };

        if (savePending) {
            await setPendingTopic({
                topicKey: extracted.topicKey,
                displayTitle: extracted.displayTitle,
                keywords: extracted.keywords,
                context: {
                    url: context.url || "",
                    title: context.title || "",
                    domain: context.domain || "",
                    selection: context.selection || ""
                }
            });
        }

        return result;
    }

    // Step 4: Find best matches
    const matches = findBestMatches(extracted, registry, maxAlternatives + 1);

    // Step 5: Determine decision based on best match
    const bestMatch = matches[0] || null;
    const alternatives = matches.slice(1, maxAlternatives + 1);

    let decision;
    let reason;

    if (!bestMatch || bestMatch.score < SCORE_THRESHOLD_ASK) {
        decision = "create";
        reason = bestMatch
            ? `Best match score (${Math.round(bestMatch.score * 100)}%) below threshold`
            : "No matches found";
    } else if (bestMatch.score >= SCORE_THRESHOLD_AUTO_SUGGEST) {
        decision = "use_existing";
        reason = `High confidence match (${Math.round(bestMatch.score * 100)}%)`;
    } else {
        decision = "ask";
        reason = `Medium confidence match (${Math.round(bestMatch.score * 100)}%), user confirmation needed`;
    }

    // Step 6: Build result
    let finalDisplayTitle = extracted.displayTitle;
    let finalTopicKey = extracted.topicKey;

    // v2: Use AI Smart Naming if creating new notebook
    if (decision === "create" || decision === "ask") {
        try {
            console.log('[ATOM Bridge] Generating smart title...');
            const smartTitle = await AI_SERVICE.generateTitle(context.selection, {
                domain: context.domain
            });

            if (smartTitle) {
                finalDisplayTitle = smartTitle;
                // CRITICAL FIX: Do NOT change topicKey. Key must remain algorithmic (kw:...)
                // for consistent re-findability on future visits.
                // finalTopicKey = ... (REMOVED)
                console.log('[ATOM Bridge] Smart title generated:', smartTitle);
            }
        } catch (err) {
            console.warn('[ATOM Bridge] Smart naming failed, falling back to regex:', err);
        }
    }

    const result = {
        decision,
        bestMatch: bestMatch ? {
            notebookRef: bestMatch.entry.notebookRef,
            notebookUrl: bestMatch.entry.notebookUrl,
            score: bestMatch.score,
            displayTitle: bestMatch.entry.displayTitle,
            topicKey: bestMatch.entry.topicKey,
            reasons: bestMatch.reasons
        } : null,
        alternatives: alternatives.map(alt => ({
            notebookRef: alt.entry.notebookRef,
            notebookUrl: alt.entry.notebookUrl,
            score: alt.score,
            displayTitle: alt.entry.displayTitle,
            topicKey: alt.entry.topicKey,
            reasons: alt.reasons
        })),
        // v1 spec fields
        topicKey: finalTopicKey,
        topicSource: extracted.topicSource,
        topicLabel: extracted.topicLabel,
        // Legacy fields
        displayTitle: finalDisplayTitle,
        keywords: extracted.keywords,
        source: extracted.source,
        confidence: extracted.confidence,
        reason
    };

    // Step 7: Save pending topic if decision is "ask" or "create"
    if (savePending && (decision === "ask" || decision === "create")) {
        await setPendingTopic({
            topicKey: extracted.topicKey,
            displayTitle: extracted.displayTitle,
            keywords: extracted.keywords,
            context: {
                url: context.url || "",
                title: context.title || "",
                domain: context.domain || "",
                selection: context.selection || ""
            }
        });
    }

    return result;
}

/**
 * Route with multiple topic candidates
 * Useful when you want to try different extraction strategies
 *
 * @param {Object} context - Reading context
 * @param {Object} options - Router options
 * @returns {Promise<Object>} Best router result among candidates
 */
export async function routeTopicWithCandidates(context, options = {}) {
    const candidates = extractTopicCandidates(context);
    const registry = await loadRegistry();

    if (registry.length === 0 || candidates.length === 0) {
        // Fall back to single extraction
        return routeTopic(context, options);
    }

    let bestResult = null;
    let bestScore = -1;

    for (const candidate of candidates) {
        const matches = findBestMatches(candidate, registry, 1);
        const match = matches[0];

        if (match && match.score > bestScore) {
            bestScore = match.score;
            bestResult = {
                candidate,
                match
            };
        }
    }

    // If we found a good match from candidates, use it
    if (bestResult && bestScore >= SCORE_THRESHOLD_ASK) {
        const { candidate, match } = bestResult;

        return {
            decision: getDecision(bestScore),
            bestMatch: {
                notebookRef: match.entry.notebookRef,
                notebookUrl: match.entry.notebookUrl,
                score: match.score,
                displayTitle: match.entry.displayTitle,
                topicKey: match.entry.topicKey,
                reasons: match.reasons
            },
            alternatives: [],
            topicKey: candidate.topicKey,
            displayTitle: candidate.displayTitle,
            keywords: candidate.keywords,
            source: candidate.source,
            confidence: candidate.confidence,
            reason: `Best candidate match (${Math.round(bestScore * 100)}%)`
        };
    }

    // Fall back to standard routing
    return routeTopic(context, options);
}

/**
 * Quick check if a context likely has a matching topic
 * Used for UI hints without full routing
 *
 * @param {Object} context - Reading context
 * @returns {Promise<{ hasMatch: boolean, topHint?: string, score?: number }>}
 */
export async function quickMatchCheck(context) {
    const extracted = extractTopic(context);
    const registry = await loadRegistry();

    if (registry.length === 0) {
        return { hasMatch: false };
    }

    const matches = findBestMatches(extracted, registry, 1);
    const best = matches[0];

    if (best && best.score >= SCORE_THRESHOLD_ASK) {
        return {
            hasMatch: true,
            topHint: best.entry.displayTitle,
            score: best.score
        };
    }

    return { hasMatch: false };
}

/**
 * Get routing stats for debugging/display
 *
 * @param {Object} context - Reading context
 * @returns {Promise<Object>} Detailed routing stats
 */
export async function getRoutingStats(context) {
    const extracted = extractTopic(context);
    const candidates = extractTopicCandidates(context);
    const registry = await loadRegistry();
    const matches = findBestMatches(extracted, registry, 5);

    return {
        extracted,
        candidates,
        registrySize: registry.length,
        matches: matches.map(m => ({
            topicKey: m.entry.topicKey,
            displayTitle: m.entry.displayTitle,
            score: m.score,
            decision: m.decision,
            reasons: m.reasons,
            breakdown: m.breakdown
        })),
        thresholds: {
            autoSuggest: SCORE_THRESHOLD_AUTO_SUGGEST,
            ask: SCORE_THRESHOLD_ASK
        }
    };
}
