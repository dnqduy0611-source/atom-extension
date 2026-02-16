import { normalizeArray, normalizeString } from "./types.js";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /\b(?:\+?\d[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/;

// Specific ID patterns to reduce false positives
const ID_PATTERNS = [
    // SSN (US): XXX-XX-XXXX or XXXXXXXXX (9 digits)
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b\d{9}\b/,
    // Credit card: 13-16 digits with optional separators
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}\b/,
    // Vietnamese CCCD/CMND: 12 digits (new) or 9 digits (old) - standalone
    /\b\d{12}\b/,
    // Passport-like: 1-2 letters followed by 6-9 digits
    /\b[A-Z]{1,2}\d{6,9}\b/i,
    // Generic national ID: letter + digits pattern (e.g., A123456789)
    /\b[A-Z]\d{8,11}\b/i,
    // Bank account-like: 10-14 digits
    /\b\d{10,14}\b/
];

function containsIdPattern(text) {
    if (!text) return false;
    return ID_PATTERNS.some(pattern => pattern.test(text));
}

export function containsPii(text) {
    const safe = normalizeString(text);
    if (!safe) return false;
    return EMAIL_RE.test(safe) || PHONE_RE.test(safe) || containsIdPattern(safe);
}

export function getPiiSummary(text) {
    const safe = normalizeString(text);
    const types = [];
    if (!safe) return { types, count: 0 };
    if (EMAIL_RE.test(safe)) types.push("email");
    if (PHONE_RE.test(safe)) types.push("phone");
    if (containsIdPattern(safe)) types.push("id");
    return { types, count: types.length };
}

function normalizeDomainPattern(pattern) {
    const value = normalizeString(pattern).toLowerCase();
    if (!value) return "";
    return value.replace(/\s+/g, "");
}

function domainMatchesPattern(domain, pattern) {
    if (!domain || !pattern) return false;
    if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(2);
        return domain === suffix || domain.endsWith(`.${suffix}`);
    }
    if (pattern.includes("*")) {
        const escaped = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
        const re = new RegExp(`^${escaped}$`, "i");
        return re.test(domain);
    }
    return domain === pattern || domain.endsWith(`.${pattern}`);
}

export function normalizeSensitiveDomains(list) {
    const raw = normalizeArray(list);
    const normalized = raw.map(normalizeDomainPattern).filter(Boolean);
    return Array.from(new Set(normalized));
}

export function isSensitiveUrl(url, domains) {
    const safe = normalizeString(url);
    if (!safe) return false;
    let host = "";
    try {
        host = new URL(safe).hostname.toLowerCase();
    } catch {
        return false;
    }
    const patterns = normalizeSensitiveDomains(domains);
    return patterns.some((pattern) => domainMatchesPattern(host, pattern));
}
