/**
 * Topic Extractor - Extract topic information from reading context
 *
 * topicKey v1 Spec Implementation:
 * - 3-tier priority: Tag (tag:slug) → Domain (dom:registrableDomain) → Keywords (kw:fingerprint)
 * - Output: topicKey, topicSource, topicLabel
 *
 * Rule priority: user-confirmed tags → domain → keyword fingerprint
 */

import { normalizeString, normalizeArray } from "./types.js";

// Common stop words to filter out from keywords (EN + VI per spec)
const STOP_WORDS = new Set([
    // EN stopwords (spec section 7)
    "the", "a", "an", "of", "to", "and", "or", "in", "for", "with", "on", "by", "from", "at", "as", "is", "are",
    // Extended EN
    "was", "were", "been", "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "this", "that", "these", "those", "it", "its", "i", "you", "he",
    "she", "we", "they", "what", "which", "who", "whom", "how", "when",
    "where", "why", "all", "each", "every", "both", "few", "more", "most",
    "other", "some", "such", "no", "not", "only", "same", "so", "than",
    "too", "very", "just", "also", "now", "here", "there", "then",
    // VI stopwords (spec section 7)
    "là", "và", "của", "cho", "với", "trong", "một", "các", "những", "từ", "về", "ở", "theo", "khi", "như",
    // Extended VI
    "hoặc", "nhưng", "trên", "tại", "để", "bởi", "đã", "được", "có", "này", "đó",
    "hai", "ba", "nhiều", "ít", "rất", "cũng"
]);

// Broad domains that should use keyword fingerprint instead of domain-based topicKey (spec section 3C)
const BROAD_DOMAINS = new Set([
    "google.com",
    "youtube.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "wikipedia.org",
    "github.com",
    "medium.com",
    "substack.com"
]);

// Domain prefix map for keyword-based topicKey (spec section 4, Rule 2)
const DOMAIN_PREFIX_MAP = {
    "youtube.com": "yt-",
    "github.com": "gh-",
    "reddit.com": "rd-",
    "twitter.com": "tw-",
    "x.com": "tw-"
};

// Tag aliases for canonicalization (spec section 4, Rule 1)
const TAG_ALIASES = {
    "deep-brain-stimulation": "dbs",
    "atom-extension": "atom"
};

// Domain to topic mapping hints (legacy, kept for extractKeywordsFromText compatibility)
const DOMAIN_TOPIC_HINTS = {
    "github.com": { keywords: ["code", "programming", "development"], category: "tech" },
    "stackoverflow.com": { keywords: ["programming", "coding", "debug"], category: "tech" },
    "medium.com": { keywords: ["article", "blog", "reading"], category: "articles" },
    "dev.to": { keywords: ["development", "programming"], category: "tech" },
    "youtube.com": { keywords: ["video", "learning"], category: "media" },
    "arxiv.org": { keywords: ["research", "paper", "academic"], category: "research" },
    "scholar.google.com": { keywords: ["research", "academic", "paper"], category: "research" },
    "docs.google.com": { keywords: ["document", "writing"], category: "docs" },
    "notion.so": { keywords: ["notes", "documentation"], category: "docs" },
    "figma.com": { keywords: ["design", "ui", "ux"], category: "design" },
    "dribbble.com": { keywords: ["design", "inspiration"], category: "design" },
    "twitter.com": { keywords: ["social", "news"], category: "social" },
    "x.com": { keywords: ["social", "news"], category: "social" },
    "reddit.com": { keywords: ["discussion", "community"], category: "social" },
    "news.ycombinator.com": { keywords: ["tech", "news", "startup"], category: "news" }
};

// ============================================
// topicKey v1 Helper Functions (per spec)
// ============================================

/**
 * Remove Vietnamese diacritics from text
 * @param {string} text - Input text
 * @returns {string} Text without diacritics
 */
function removeDiacritics(text) {
    if (!text) return "";
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
}

/**
 * Slugify tag for topicKey (spec section 3A)
 * - lowercase
 * - remove Vietnamese diacritics
 * - replace spaces with -
 * - remove special characters
 *
 * @param {string} tag - Input tag
 * @returns {string} Slugified tag
 */
function slugifyTag(tag) {
    if (!tag) return "";

    let slug = normalizeString(tag).toLowerCase();

    // Check alias map first
    if (TAG_ALIASES[slug]) {
        return TAG_ALIASES[slug];
    }

    // Remove diacritics
    slug = removeDiacritics(slug);

    // Replace spaces with -
    slug = slug.replace(/\s+/g, "-");

    // Remove special characters (keep alphanumeric and -)
    slug = slug.replace(/[^a-z0-9-]/g, "");

    // Remove consecutive dashes
    slug = slug.replace(/-+/g, "-");

    // Trim dashes from ends
    slug = slug.replace(/^-|-$/g, "");

    return slug || "untitled";
}

/**
 * Extract registrable domain from full domain (spec section 3B)
 * Examples:
 * - news.ycombinator.com → ycombinator.com
 * - scholar.google.com → google.com
 * - pubmed.ncbi.nlm.nih.gov → ncbi.nlm.nih.gov
 *
 * @param {string} domain - Full domain
 * @returns {string} Registrable domain
 */
function registrableDomain(domain) {
    if (!domain) return "";

    let normalized = normalizeString(domain).toLowerCase();

    // Remove www prefix
    normalized = normalized.replace(/^www\./, "");

    const parts = normalized.split(".");
    if (parts.length <= 2) {
        return normalized;
    }

    // Handle special TLDs (.co.uk, .com.vn, etc.)
    const specialTlds = ["co.uk", "com.vn", "com.au", "co.jp", "co.kr", "com.br", "org.uk", "gov.uk"];
    const lastTwo = parts.slice(-2).join(".");

    if (specialTlds.includes(lastTwo)) {
        // Return last 3 parts (e.g., example.co.uk)
        return parts.slice(-3).join(".");
    }

    // Handle multi-part domains like ncbi.nlm.nih.gov
    // Heuristic: if 3rd-level is a known subdomain pattern, go deeper
    const knownSubdomains = ["www", "m", "mobile", "en", "vi", "blog", "news", "docs", "scholar", "pubmed"];

    if (parts.length >= 3 && knownSubdomains.includes(parts[0])) {
        return parts.slice(1).join(".");
    }

    // Default: return last 2 parts (registrable domain)
    return parts.slice(-2).join(".");
}

/**
 * Create keyword fingerprint from title (spec section 3C)
 * Algorithm:
 * 1. Tokenize by space
 * 2. Remove stopwords
 * 3. Remove tokens < 3 chars
 * 4. Remove numeric/ID tokens
 * 5. Take top 3 tokens (by length, then position)
 * 6. Sort alphabetically
 * 7. Join with -
 *
 * @param {string} title - Page title
 * @returns {string|null} Keyword fingerprint or null if insufficient keywords
 */
function keywordFingerprint(title) {
    if (!title) return null;

    const normalized = normalizeString(title).toLowerCase();

    // Tokenize by non-word characters
    const tokens = normalized
        .split(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF-]+/)
        .map(t => removeDiacritics(t).toLowerCase())
        .filter(t => {
            // Remove if too short
            if (t.length < 3) return false;

            // Remove stopwords
            if (STOP_WORDS.has(t)) return false;

            // Remove pure numeric tokens
            if (/^\d+$/.test(t)) return false;

            // Remove ID-like patterns (e.g., v1, 2024, abc123)
            if (/^[a-z]?\d+[a-z]?$/i.test(t)) return false;

            return true;
        });

    // Need at least 3 valid keywords (spec section 4, Rule 3)
    if (tokens.length < 3) return null;

    // Score tokens: longer = better, earlier position = tiebreaker
    const scored = tokens.map((token, idx) => ({
        token,
        score: token.length * 100 - idx // Prioritize length, then position
    }));

    // Sort by score descending, take top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3).map(s => s.token);

    // Sort alphabetically for stability
    top3.sort();

    return top3.join("-");
}

/**
 * Check if tag is user-confirmed (spec section 3A)
 * @param {Object} tagObj - Tag object with potential metadata
 * @param {Object} context - Context with tagsSource/tagsConfirmed
 * @returns {boolean} True if user confirmed
 */
function isUserConfirmedTag(tagObj, context) {
    // If context says all tags are user confirmed
    if (context.tagsConfirmed === true || context.tagsSource === "user") {
        return true;
    }

    // If tag is an object with confirmed flag
    if (typeof tagObj === "object" && tagObj !== null) {
        return tagObj.confirmed === true || tagObj.source === "user";
    }

    // For simple string tags, assume user confirmed if tagsSource not specified
    // (backward compatibility - old code didn't track this)
    return context.tagsSource !== "ai";
}

/**
 * Compute topicKey following v1 spec (spec section 5)
 *
 * @param {Object} context - Reading context
 * @param {string[]} context.tags - User tags
 * @param {string} context.domain - Website domain
 * @param {string} context.title - Page title
 * @param {boolean} context.tagsConfirmed - Whether tags are user confirmed
 * @param {string} context.tagsSource - Source of tags ("user" | "ai")
 * @returns {{ topicKey: string, topicSource: string, topicLabel: string }}
 */
function computeTopicKey(context) {
    const { tags = [], domain = "", title = "", tagsConfirmed, tagsSource } = context;

    const normalizedTags = normalizeArray(tags).filter(Boolean);

    // Tầng A: Tag user-confirm (highest priority)
    const confirmedTags = normalizedTags.filter(t => isUserConfirmedTag(t, { tagsConfirmed, tagsSource }));

    if (confirmedTags.length > 0) {
        // Pick primary tag (first one)
        const primaryTag = typeof confirmedTags[0] === "object" ? confirmedTags[0].name || confirmedTags[0].value : confirmedTags[0];
        const slug = slugifyTag(primaryTag);

        return {
            topicKey: `tag:${slug}`,
            topicSource: "tag",
            topicLabel: `#${slug}`
        };
    }

    // Get registrable domain
    const regDomain = registrableDomain(domain);
    if (!regDomain) {
        return {
            topicKey: "dom:unknown",
            topicSource: "domain",
            topicLabel: "unknown"
        };
    }

    // Tầng B/C: Check if broad domain → use keyword fingerprint
    if (BROAD_DOMAINS.has(regDomain)) {
        const fingerprint = keywordFingerprint(title);
        if (fingerprint) {
            // Add domain prefix if configured (e.g., yt-, gh-)
            const prefix = DOMAIN_PREFIX_MAP[regDomain] || "";
            return {
                topicKey: `kw:${prefix}${fingerprint}`,
                topicSource: "keyword",
                topicLabel: fingerprint.replace(/-/g, " ")
            };
        }
        // Fall through to domain if keyword fingerprint fails
    }

    // Tầng B: Domain (default)
    return {
        topicKey: `dom:${regDomain}`,
        topicSource: "domain",
        topicLabel: regDomain
    };
}

// ============================================
// Keyword Extraction (legacy, for scoring)
// ============================================

/**
 * Extract keywords from text
 * @param {string} text - Input text
 * @param {number} maxKeywords - Maximum keywords to return
 * @returns {string[]} Extracted keywords
 */
export function extractKeywordsFromText(text, maxKeywords = 5) {
    if (!text) return [];

    const normalized = normalizeString(text).toLowerCase();

    // Split by non-word characters, filter stop words and short words
    const words = normalized
        .split(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]+/) // Unicode letters support
        .map(w => w.trim())
        .filter(w => w.length >= 3 && !STOP_WORDS.has(w));

    // Count word frequency
    const freq = {};
    for (const word of words) {
        freq[word] = (freq[word] || 0) + 1;
    }

    // Sort by frequency and return top keywords
    return Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
}

/**
 * Extract domain name without TLD
 * @param {string} domain - Full domain
 * @returns {string} Simplified domain name
 */
export function simplifyDomain(domain) {
    if (!domain) return "";

    const normalized = normalizeString(domain).toLowerCase();

    // Remove www prefix
    let simplified = normalized.replace(/^www\./, "");

    // Extract main domain name (before first dot or the whole thing)
    const parts = simplified.split(".");
    if (parts.length >= 2) {
        // Return second-level domain (e.g., "github" from "github.com")
        return parts[parts.length - 2];
    }
    return parts[0];
}

/**
 * Generate display title from context
 * @param {Object} context - Extraction context
 * @returns {string} Display title
 */
function generateDisplayTitle(context) {
    const { tags, intent, title, domain } = context;

    // Priority 1: Use first tag if available
    if (tags && tags.length > 0) {
        const firstTag = normalizeString(tags[0]);
        if (firstTag) {
            // Capitalize first letter
            return firstTag.charAt(0).toUpperCase() + firstTag.slice(1);
        }
    }

    // Priority 2: Use intent
    if (intent) {
        const normalized = normalizeString(intent);
        if (normalized) {
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        }
    }

    // Priority 3: Extract from title (Improved Fallback)
    if (title) {
        // Remove common separators and site names at the end
        // e.g. "Article Title | Site Name" -> "Article Title"
        // Also remove " - VnExpress", etc.
        let cleanTitle = title.split(/[|\-–—:]/).filter(p => p.trim().length > 0)[0].trim();

        // Return first 14 words to give sufficient context
        // e.g., "Diện tích tối thiểu được tách thửa với..."
        const words = cleanTitle.split(/\s+/);
        if (words.length > 0) {
            // Remove quotes if present
            let clipped = words.slice(0, 14).join(" ").replace(/^['"]|['"]$/g, '');
            // Remove trailing punctuation marks (comma, colon, hyphen, etc.)
            clipped = clipped.replace(/[.,:;|\-–—]+$/, "");
            return clipped;
        }
    }

    // Priority 4: Use domain
    if (domain) {
        const simplified = simplifyDomain(domain);
        if (simplified) {
            return simplified.charAt(0).toUpperCase() + simplified.slice(1);
        }
    }

    return "Untitled";
}

/**
 * Generate topic key from display title
 * @param {string} displayTitle - Display title
 * @returns {string} Normalized topic key
 */
function generateTopicKey(displayTitle) {
    return normalizeString(displayTitle)
        .toLowerCase()
        .replace(/[^a-z0-9\s\u00C0-\u024F\u1E00-\u1EFF]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50) || "untitled";
}

/**
 * Extract topic information from reading context
 *
 * topicKey v1 output format (per spec section 6):
 * - topicKey: string like "tag:xxx", "dom:xxx", "kw:xxx"
 * - topicSource: enum "tag"|"domain"|"keyword"
 * - topicLabel: human readable
 *
 * @param {Object} context - Reading context
 * @param {string} context.title - Page title
 * @param {string} context.selection - Selected text
 * @param {string[]} context.tags - User-assigned tags
 * @param {string} context.intent - User intent label
 * @param {string} context.domain - Website domain
 * @param {boolean} context.tagsConfirmed - Whether tags are user confirmed
 * @param {string} context.tagsSource - Source of tags ("user" | "ai")
 * @returns {Object} Extracted topic info: { topicKey, topicSource, topicLabel, keywords, displayTitle, confidence }
 */
export function extractTopic(context) {
    const {
        title = "",
        selection = "",
        tags = [],
        intent = "",
        domain = "",
        tagsConfirmed,
        tagsSource
    } = context || {};

    const normalizedTags = normalizeArray(tags).map(t => normalizeString(t).toLowerCase()).filter(Boolean);
    const normalizedIntent = normalizeString(intent).toLowerCase();
    const normalizedDomain = normalizeString(domain).toLowerCase().replace(/^www\./, "");

    // Compute topicKey using v1 spec algorithm
    const topicKeyResult = computeTopicKey({
        tags,
        domain: normalizedDomain,
        title,
        tagsConfirmed,
        tagsSource
    });

    // Extract keywords for scoring (legacy compatibility)
    let keywords = [];
    let confidence = 0.3; // Base confidence

    // Priority 1: Tags (highest confidence)
    if (normalizedTags.length > 0) {
        keywords = [...normalizedTags];
        confidence = 0.9;
    }

    // Priority 2: Intent
    if (normalizedIntent && keywords.length === 0) {
        keywords = [normalizedIntent];
        confidence = 0.8;
    }

    // Priority 3: Title keywords
    if (keywords.length === 0 && title) {
        keywords = extractKeywordsFromText(title, 5);
        confidence = 0.6;
    }

    // Priority 4: Selection keywords (supplement)
    if (selection) {
        const selectionKeywords = extractKeywordsFromText(selection, 3);
        // Add unique selection keywords
        for (const kw of selectionKeywords) {
            if (!keywords.includes(kw)) {
                keywords.push(kw);
            }
        }
        if (keywords.length > 0 && topicKeyResult.topicSource === "domain") {
            confidence = 0.5;
        }
    }

    // Priority 5: Domain hints
    if (keywords.length === 0) {
        const domainHints = DOMAIN_TOPIC_HINTS[normalizedDomain];
        if (domainHints) {
            keywords = [...domainHints.keywords];
            confidence = 0.4;
        } else {
            // Use simplified domain as keyword
            const simplified = simplifyDomain(normalizedDomain);
            if (simplified && keywords.length === 0) {
                keywords = [simplified];
            }
        }
    }

    // Limit keywords
    keywords = keywords.slice(0, 8);

    // Generate display title (human readable name for UI)
    const displayTitle = generateDisplayTitle({
        tags: normalizedTags,
        intent: normalizedIntent,
        title,
        domain: normalizedDomain
    });

    // Adjust confidence based on topicSource
    if (topicKeyResult.topicSource === "tag") {
        confidence = Math.max(confidence, 0.9);
    } else if (topicKeyResult.topicSource === "keyword") {
        confidence = Math.max(confidence, 0.6);
    } else if (topicKeyResult.topicSource === "domain") {
        confidence = Math.max(confidence, 0.4);
    }

    return {
        // v1 spec required fields
        topicKey: topicKeyResult.topicKey,
        topicSource: topicKeyResult.topicSource,
        topicLabel: topicKeyResult.topicLabel,

        // Legacy/compatibility fields
        keywords,
        displayTitle,
        source: topicKeyResult.topicSource, // Backward compatibility
        confidence,
        context: {
            hadTags: normalizedTags.length > 0,
            hadIntent: !!normalizedIntent,
            hadTitle: !!title,
            hadSelection: !!selection,
            domain: normalizedDomain
        }
    };
}

/**
 * Extract multiple topic candidates from context
 * Returns array sorted by confidence
 *
 * v1 spec: each candidate has topicKey with prefix format (tag:/dom:/kw:)
 *
 * @param {Object} context - Reading context
 * @returns {Object[]} Array of topic candidates
 */
export function extractTopicCandidates(context) {
    const candidates = [];
    const {
        title = "",
        selection = "",
        tags = [],
        intent = "",
        domain = "",
        tagsConfirmed,
        tagsSource
    } = context || {};

    const normalizedTags = normalizeArray(tags).map(t => normalizeString(t).toLowerCase()).filter(Boolean);
    const normalizedIntent = normalizeString(intent).toLowerCase();
    const normalizedDomain = normalizeString(domain).toLowerCase().replace(/^www\./, "");
    const regDomain = registrableDomain(normalizedDomain);

    // Candidate from tags (v1 spec: tag:slug format)
    if (normalizedTags.length > 0) {
        for (const tag of normalizedTags) {
            const slug = slugifyTag(tag);
            candidates.push({
                topicKey: `tag:${slug}`,
                topicSource: "tag",
                topicLabel: `#${slug}`,
                keywords: [tag],
                displayTitle: tag.charAt(0).toUpperCase() + tag.slice(1),
                source: "tag",
                confidence: 0.9
            });
        }
    }

    // Candidate from intent (treat as tag-like)
    if (normalizedIntent) {
        const slug = slugifyTag(normalizedIntent);
        candidates.push({
            topicKey: `tag:${slug}`,
            topicSource: "tag",
            topicLabel: `#${slug}`,
            keywords: [normalizedIntent],
            displayTitle: normalizedIntent.charAt(0).toUpperCase() + normalizedIntent.slice(1),
            source: "intent",
            confidence: 0.8
        });
    }

    // Candidate from title keywords (v1 spec: kw:fingerprint format)
    if (title) {
        const fingerprint = keywordFingerprint(title);
        const titleKeywords = extractKeywordsFromText(title, 5);

        // Better display title logic (same as generateDisplayTitle)
        let cleanTitle = title.split(/[|\-–—:]/).filter(p => p.trim().length > 0)[0].trim();
        const betterDisplayTitle = cleanTitle.split(/\s+/).slice(0, 8).join(" ").replace(/^['"]|['"]$/g, '');

        if (fingerprint) {
            // Add domain prefix if broad domain
            const prefix = BROAD_DOMAINS.has(regDomain) ? (DOMAIN_PREFIX_MAP[regDomain] || "") : "";
            candidates.push({
                topicKey: `kw:${prefix}${fingerprint}`,
                topicSource: "keyword",
                topicLabel: fingerprint.replace(/-/g, " "),
                keywords: titleKeywords,
                displayTitle: betterDisplayTitle,
                source: "title",
                confidence: 0.6
            });
        } else if (titleKeywords.length > 0) {
            // Fallback: use simplified title keywords
            const displayTitle = betterDisplayTitle;
            const simpleFp = titleKeywords.slice(0, 3).sort().join("-");
            candidates.push({
                topicKey: `kw:${simpleFp}`,
                topicSource: "keyword",
                topicLabel: simpleFp.replace(/-/g, " "),
                keywords: titleKeywords,
                displayTitle,
                source: "title",
                confidence: 0.5
            });
        }
    }

    // Candidate from domain (v1 spec: dom:registrableDomain format)
    if (regDomain) {
        const domainHints = DOMAIN_TOPIC_HINTS[normalizedDomain];
        if (domainHints) {
            candidates.push({
                topicKey: `dom:${regDomain}`,
                topicSource: "domain",
                topicLabel: regDomain,
                keywords: domainHints.keywords,
                displayTitle: domainHints.category.charAt(0).toUpperCase() + domainHints.category.slice(1),
                source: "domain_hints",
                confidence: 0.4
            });
        } else {
            candidates.push({
                topicKey: `dom:${regDomain}`,
                topicSource: "domain",
                topicLabel: regDomain,
                keywords: [simplifyDomain(regDomain)],
                displayTitle: simplifyDomain(regDomain).charAt(0).toUpperCase() + simplifyDomain(regDomain).slice(1),
                source: "domain",
                confidence: 0.3
            });
        }
    }

    // Sort by confidence descending
    return candidates.sort((a, b) => b.confidence - a.confidence);
}

// ============================================
// Export v1 spec helper functions
// ============================================

/**
 * Direct access to computeTopicKey for external use
 * @param {Object} context - Context with tags, domain, title
 * @returns {{ topicKey: string, topicSource: string, topicLabel: string }}
 */
export { computeTopicKey };

/**
 * Export helper functions for testing and external use
 */
export {
    registrableDomain,
    keywordFingerprint,
    slugifyTag,
    removeDiacritics
};

/**
 * Export configuration for customization
 */
export {
    BROAD_DOMAINS,
    DOMAIN_PREFIX_MAP,
    TAG_ALIASES,
    STOP_WORDS
};
