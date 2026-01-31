/**
 * Topic Scoring - Calculate match scores between extracted topics and registry entries
 *
 * Thresholds:
 * - ≥0.70: auto-suggest (high confidence match)
 * - 0.45-0.69: ask (medium confidence, prompt user)
 * - <0.45: create (low confidence, suggest new topic)
 */

import { normalizeString } from "./types.js";

// Scoring thresholds
export const SCORE_THRESHOLD_AUTO_SUGGEST = 0.70;
export const SCORE_THRESHOLD_ASK = 0.45;

// Scoring weights
const WEIGHTS = {
    EXACT_TOPIC_KEY: 1.0,      // Exact topic key match
    EXACT_KEYWORD: 0.25,       // Each exact keyword match
    PARTIAL_KEYWORD: 0.10,     // Partial keyword match (substring)
    DISPLAY_TITLE_SIMILAR: 0.3, // Display title similarity
    USAGE_BONUS: 0.05,         // Bonus per usage (capped)
    RECENCY_BONUS: 0.10        // Bonus for recent use
};

// Maximum bonuses
const MAX_KEYWORD_SCORE = 0.6;
const MAX_USAGE_BONUS = 0.15;

/**
 * Calculate string similarity using Levenshtein distance
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Similarity score 0-1
 */
function stringSimilarity(s1, s2) {
    const a = normalizeString(s1).toLowerCase();
    const b = normalizeString(s2).toLowerCase();

    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    // Simple containment check
    if (a.includes(b) || b.includes(a)) {
        const minLen = Math.min(a.length, b.length);
        const maxLen = Math.max(a.length, b.length);
        return minLen / maxLen;
    }

    // Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const distance = matrix[b.length][a.length];
    const maxLen = Math.max(a.length, b.length);
    return 1 - distance / maxLen;
}

/**
 * Check if keyword matches (exact or partial)
 * @param {string} kw1 - First keyword
 * @param {string} kw2 - Second keyword
 * @returns {{ exact: boolean, partial: boolean }}
 */
function keywordMatch(kw1, kw2) {
    const a = normalizeString(kw1).toLowerCase();
    const b = normalizeString(kw2).toLowerCase();

    if (a === b) {
        return { exact: true, partial: false };
    }

    if (a.includes(b) || b.includes(a)) {
        return { exact: false, partial: true };
    }

    return { exact: false, partial: false };
}

/**
 * Calculate recency bonus based on last used timestamp
 * @param {number} lastUsedAt - Timestamp
 * @returns {number} Bonus score 0-RECENCY_BONUS
 */
function calculateRecencyBonus(lastUsedAt) {
    if (!lastUsedAt) return 0;

    const now = Date.now();
    const daysSinceUse = (now - lastUsedAt) / (1000 * 60 * 60 * 24);

    // Full bonus if used within 7 days, decreasing after
    if (daysSinceUse <= 7) return WEIGHTS.RECENCY_BONUS;
    if (daysSinceUse <= 30) return WEIGHTS.RECENCY_BONUS * 0.5;
    if (daysSinceUse <= 90) return WEIGHTS.RECENCY_BONUS * 0.2;
    return 0;
}

/**
 * Calculate usage bonus based on usage count
 * @param {number} usageCount - Number of times used
 * @returns {number} Bonus score 0-MAX_USAGE_BONUS
 */
function calculateUsageBonus(usageCount) {
    if (!usageCount || usageCount <= 0) return 0;

    // Logarithmic scaling: diminishing returns
    const bonus = Math.log10(usageCount + 1) * WEIGHTS.USAGE_BONUS;
    return Math.min(bonus, MAX_USAGE_BONUS);
}

/**
 * Score a match between extracted topic and a registry entry
 *
 * @param {Object} extracted - Extracted topic from topic_extractor
 * @param {string} extracted.topicKey - Topic key
 * @param {string[]} extracted.keywords - Keywords
 * @param {string} extracted.displayTitle - Display title
 * @param {Object} registryItem - Registry entry
 * @param {string} registryItem.topicKey - Topic key
 * @param {string[]} registryItem.keywords - Keywords
 * @param {string} registryItem.displayTitle - Display title
 * @param {number} registryItem.usageCount - Usage count
 * @param {number} registryItem.lastUsedAt - Last used timestamp
 * @returns {{ score: number, reasons: string[], breakdown: Object }}
 */
export function scoreTopicMatch(extracted, registryItem) {
    const reasons = [];
    const breakdown = {
        topicKeyMatch: 0,
        keywordScore: 0,
        titleSimilarity: 0,
        usageBonus: 0,
        recencyBonus: 0
    };

    if (!extracted || !registryItem) {
        return { score: 0, reasons: ["Invalid input"], breakdown };
    }

    const extKey = normalizeString(extracted.topicKey).toLowerCase();
    const regKey = normalizeString(registryItem.topicKey).toLowerCase();
    // Dedupe keywords to prevent score inflation
    const extKeywords = [...new Set((extracted.keywords || []).map(k => normalizeString(k).toLowerCase()).filter(Boolean))];
    const regKeywords = [...new Set((registryItem.keywords || []).map(k => normalizeString(k).toLowerCase()).filter(Boolean))];

    let score = 0;

    // 1. Exact topic key match
    if (extKey && regKey && extKey === regKey) {
        breakdown.topicKeyMatch = WEIGHTS.EXACT_TOPIC_KEY;
        score += WEIGHTS.EXACT_TOPIC_KEY;
        reasons.push(`Exact topic key match: "${extKey}"`);
    }

    // 2. Keyword matching (each keyword can only match once)
    let keywordScore = 0;
    const matchedKeywords = [];
    const usedExtKw = new Set();
    const usedRegKw = new Set();

    // First pass: exact matches (higher priority)
    for (const extKw of extKeywords) {
        if (usedExtKw.has(extKw)) continue;
        for (const regKw of regKeywords) {
            if (usedRegKw.has(regKw)) continue;
            const match = keywordMatch(extKw, regKw);
            if (match.exact) {
                keywordScore += WEIGHTS.EXACT_KEYWORD;
                matchedKeywords.push(`"${extKw}" = "${regKw}"`);
                usedExtKw.add(extKw);
                usedRegKw.add(regKw);
                break; // Move to next extKw
            }
        }
    }

    // Second pass: partial matches (only for unmatched keywords)
    for (const extKw of extKeywords) {
        if (usedExtKw.has(extKw)) continue;
        for (const regKw of regKeywords) {
            if (usedRegKw.has(regKw)) continue;
            const match = keywordMatch(extKw, regKw);
            if (match.partial) {
                keywordScore += WEIGHTS.PARTIAL_KEYWORD;
                matchedKeywords.push(`"${extKw}" ~ "${regKw}"`);
                usedExtKw.add(extKw);
                usedRegKw.add(regKw);
                break; // Move to next extKw
            }
        }
    }

    keywordScore = Math.min(keywordScore, MAX_KEYWORD_SCORE);
    breakdown.keywordScore = keywordScore;
    score += keywordScore;

    if (matchedKeywords.length > 0) {
        reasons.push(`Keyword matches: ${matchedKeywords.join(", ")}`);
    }

    // 3. Display title similarity
    const titleSim = stringSimilarity(
        extracted.displayTitle || "",
        registryItem.displayTitle || ""
    );
    if (titleSim > 0.5) {
        const titleScore = titleSim * WEIGHTS.DISPLAY_TITLE_SIMILAR;
        breakdown.titleSimilarity = titleScore;
        score += titleScore;
        reasons.push(`Title similarity: ${Math.round(titleSim * 100)}%`);
    }

    // 4. Usage bonus
    const usageBonus = calculateUsageBonus(registryItem.usageCount);
    if (usageBonus > 0) {
        breakdown.usageBonus = usageBonus;
        score += usageBonus;
        reasons.push(`Usage bonus: ${registryItem.usageCount} uses`);
    }

    // 5. Recency bonus
    const recencyBonus = calculateRecencyBonus(registryItem.lastUsedAt);
    if (recencyBonus > 0) {
        breakdown.recencyBonus = recencyBonus;
        score += recencyBonus;
        reasons.push(`Recently used`);
    }

    // Normalize score to 0-1 range
    // Max possible score: 1.0 (key) + 0.6 (keywords) + 0.3 (title) + 0.15 (usage) + 0.1 (recency) = 2.15
    // But we cap at 1.0
    score = Math.min(score, 1.0);

    return {
        score: Math.round(score * 100) / 100, // Round to 2 decimals
        reasons,
        breakdown
    };
}

/**
 * Find best matches from registry for an extracted topic
 *
 * @param {Object} extracted - Extracted topic
 * @param {Array} registry - Registry entries
 * @param {number} limit - Max results to return
 * @returns {Array<{ entry: Object, score: number, reasons: string[], decision: string }>}
 */
export function findBestMatches(extracted, registry, limit = 5) {
    if (!extracted || !Array.isArray(registry) || registry.length === 0) {
        return [];
    }

    const scored = registry.map(entry => {
        const result = scoreTopicMatch(extracted, entry);
        return {
            entry,
            score: result.score,
            reasons: result.reasons,
            breakdown: result.breakdown,
            decision: getDecision(result.score)
        };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
}

/**
 * Get decision based on score
 * @param {number} score - Match score
 * @returns {"use_existing" | "ask" | "create"}
 */
export function getDecision(score) {
    if (score >= SCORE_THRESHOLD_AUTO_SUGGEST) {
        return "use_existing";
    }
    if (score >= SCORE_THRESHOLD_ASK) {
        return "ask";
    }
    return "create";
}

/**
 * Get decision label for display
 * @param {string} decision - Decision string
 * @returns {string} Human-readable label
 */
export function getDecisionLabel(decision) {
    switch (decision) {
        case "use_existing":
            return "Auto-suggest";
        case "ask":
            return "Ask user";
        case "create":
            return "Create new";
        default:
            return "Unknown";
    }
}

/**
 * Format score for display
 * @param {number} score - Score 0-1
 * @returns {string} Formatted score
 */
export function formatScore(score) {
    return `${Math.round(score * 100)}%`;
}
