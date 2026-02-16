import { normalizeString } from "./types.js";

function normalizeRuleList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((rule) => ({
            tag: normalizeString(rule?.tag),
            intent: normalizeString(rule?.intent),
            domain: normalizeString(rule?.domain).toLowerCase(),
            notebookRef: normalizeString(rule?.notebookRef)
        }))
        .filter((rule) => rule.notebookRef);
}

function matchByTag(tags, rules) {
    if (!Array.isArray(tags) || !tags.length) return null;
    const tagSet = new Set(tags.map((t) => normalizeString(t).toLowerCase()).filter(Boolean));
    for (const rule of rules) {
        const tag = normalizeString(rule.tag).toLowerCase();
        if (tag && tagSet.has(tag)) return rule.notebookRef;
    }
    return null;
}

function matchByIntent(intent, rules) {
    const target = normalizeString(intent).toLowerCase();
    if (!target) return null;
    for (const rule of rules) {
        const ruleIntent = normalizeString(rule.intent).toLowerCase();
        if (ruleIntent && ruleIntent === target) return rule.notebookRef;
    }
    return null;
}

function matchByDomain(domain, rules) {
    const target = normalizeString(domain).toLowerCase();
    if (!target) return null;
    for (const rule of rules) {
        const ruleDomain = normalizeString(rule.domain).toLowerCase();
        if (!ruleDomain) continue;
        if (target === ruleDomain || target.endsWith(`.${ruleDomain}`)) {
            return rule.notebookRef;
        }
    }
    return null;
}

export function resolveNotebookRef(bundle, rules, defaultNotebookRef) {
    const byTag = normalizeRuleList(rules?.byTag);
    const byIntent = normalizeRuleList(rules?.byIntent);
    const byDomain = normalizeRuleList(rules?.byDomain);

    const tagHit = matchByTag(bundle?.tags || [], byTag);
    if (tagHit) return tagHit;

    const intentHit = matchByIntent(bundle?.userIntentLabel || "", byIntent);
    if (intentHit) return intentHit;

    const domainHit = matchByDomain(bundle?.domain || "", byDomain);
    if (domainHit) return domainHit;

    return normalizeString(defaultNotebookRef) || "Inbox";
}

