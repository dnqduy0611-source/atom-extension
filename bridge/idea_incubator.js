import {
    NLM_IDEA_STATS_KEY,
    NLM_IDEA_SUGGESTIONS_KEY,
    NLM_IDEA_COOLDOWN_KEY,
    normalizeString
} from "./types.js";
import { extractTopic } from "./topic_extractor.js";
import { logIdeaIncubatorCreated } from "./topic_router_logging.js";

const IDEA_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const IDEA_MIN_BUNDLES = 5;
const IDEA_MIN_DEEP = 2;
const IDEA_SCORE_MIN = 8;
const IDEA_SUGGESTION_CAP = 20;

const COOLDOWN_NOT_NOW_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_DONT_ASK_MS = 90 * 24 * 60 * 60 * 1000;
const COOLDOWN_ESCALATE_MS = 30 * 24 * 60 * 60 * 1000;
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function getDomainFromUrl(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return "";
    }
}

function getReadingModeProxy(note) {
    const mode = normalizeString(note?.readingMode).toLowerCase();
    if (mode === "deep" || mode === "reread") return mode;
    const command = normalizeString(note?.command).toLowerCase();
    if (command.includes("critique") || command.includes("quiz")) return "deep";
    return "skim";
}

function hasUserConfirmedTags(note) {
    if (note?.tagsConfirmed === true) return true;
    if (note?.tagsSource === "user") return true;
    const tags = Array.isArray(note?.tags) ? note.tags : [];
    return tags.length > 0 && note?.tagsSource === "user";
}

function buildEntry(note) {
    const url = normalizeString(note?.url);
    const selection = normalizeString(note?.selection);
    return {
        ts: note?.created_at || Date.now(),
        url,
        domain: getDomainFromUrl(url),
        selectionLen: selection.length,
        hasSelection: !!selection,
        hasAtomicThought: !!normalizeString(note?.atomicThought),
        hasUserTags: hasUserConfirmedTags(note),
        readingMode: getReadingModeProxy(note),
        title: normalizeString(note?.title)
    };
}

function pruneEntries(entries, now) {
    const cutoff = now - IDEA_WINDOW_MS;
    return Array.isArray(entries) ? entries.filter((e) => (e?.ts || 0) >= cutoff) : [];
}

function buildUrlCounts(entries) {
    const counts = new Map();
    for (const entry of entries) {
        const url = entry?.url || "";
        if (!url) continue;
        counts.set(url, (counts.get(url) || 0) + 1);
    }
    return counts;
}

function computeEngagementScore(entries, urlCounts) {
    let score = 0;
    for (const entry of entries) {
        if (entry?.hasSelection) score += 2;
        if (entry?.hasAtomicThought) score += 2;
        if (entry?.hasUserTags) score += 1;
        if (entry?.url && (urlCounts.get(entry.url) || 0) >= 2) score += 1;
    }
    return score;
}

function computeDeepCount(entries, urlCounts) {
    let count = 0;
    for (const entry of entries) {
        const rereadProxy = entry?.url && (urlCounts.get(entry.url) || 0) >= 2;
        if (entry?.readingMode === "deep" || entry?.readingMode === "reread" || rereadProxy) {
            count += 1;
        }
    }
    return count;
}

function computeSelectionRepeat(entries) {
    const withSelection = entries.filter((e) => e?.hasSelection);
    return withSelection.length >= 3;
}

async function loadMap(key) {
    const data = await chrome.storage.local.get([key]);
    return data[key] && typeof data[key] === "object" ? data[key] : {};
}

async function saveMap(key, value) {
    await chrome.storage.local.set({ [key]: value });
    return value;
}

async function loadSuggestions() {
    const data = await chrome.storage.local.get([NLM_IDEA_SUGGESTIONS_KEY]);
    return Array.isArray(data[NLM_IDEA_SUGGESTIONS_KEY]) ? data[NLM_IDEA_SUGGESTIONS_KEY] : [];
}

async function saveSuggestions(list) {
    const safe = Array.isArray(list) ? list : [];
    await chrome.storage.local.set({ [NLM_IDEA_SUGGESTIONS_KEY]: safe });
    return safe;
}

function isCooldownActive(cooldowns, topicKey, now) {
    const entry = cooldowns[topicKey];
    if (!entry) return false;
    if (entry.hardUntil && now < entry.hardUntil) return true;
    if (entry.until && now < entry.until) return true;
    return false;
}

export async function recordIdeaDismiss(topicKey, type = "not_now") {
    const now = Date.now();
    const cooldowns = await loadMap(NLM_IDEA_COOLDOWN_KEY);
    const entry = cooldowns[topicKey] || { dismissCount: 0, lastDismissAt: 0, until: 0, hardUntil: 0 };

    if (type === "dont_ask") {
        entry.hardUntil = now + COOLDOWN_DONT_ASK_MS;
        entry.until = entry.hardUntil;
        entry.dismissCount = 0;
        entry.lastDismissAt = now;
    } else {
        const withinWindow = now - (entry.lastDismissAt || 0) <= DISMISS_WINDOW_MS;
        entry.dismissCount = withinWindow ? (entry.dismissCount || 0) + 1 : 1;
        entry.lastDismissAt = now;

        if (entry.dismissCount >= 2) {
            entry.until = now + COOLDOWN_ESCALATE_MS;
        } else {
            entry.until = now + COOLDOWN_NOT_NOW_MS;
        }
    }

    cooldowns[topicKey] = entry;
    await saveMap(NLM_IDEA_COOLDOWN_KEY, cooldowns);
    return entry;
}

export async function updateIdeaSuggestionStatus(topicKey, status, patch = {}) {
    const list = await loadSuggestions();
    const next = list.map((s) => {
        if (s?.topicKey !== topicKey) return s;
        return { ...s, status, ...patch };
    });
    await saveSuggestions(next);
    return next.find((s) => s?.topicKey === topicKey) || null;
}

export async function evaluateIdeaIncubator(note) {
    if (!note) return { suggestion: null, shouldPrompt: false };

    const topic = extractTopic({
        title: note.title || "",
        selection: note.selection || "",
        tags: note.tags || [],
        intent: note.intent || "",
        domain: getDomainFromUrl(note.url || "")
    });

    const now = Date.now();
    const stats = await loadMap(NLM_IDEA_STATS_KEY);
    const cooldowns = await loadMap(NLM_IDEA_COOLDOWN_KEY);
    const suggestions = await loadSuggestions();

    if (isCooldownActive(cooldowns, topic.topicKey, now)) {
        return { suggestion: null, shouldPrompt: false };
    }

    const existingSuggestion = suggestions.find((s) => s?.topicKey === topic.topicKey && s?.status === "open");
    if (existingSuggestion) {
        return { suggestion: null, shouldPrompt: false };
    }

    const entry = buildEntry(note);
    const record = stats[topic.topicKey] || { entries: [], lastSuggestedAt: 0 };
    const entries = pruneEntries([...(record.entries || []), entry], now);
    record.entries = entries;
    stats[topic.topicKey] = record;
    await saveMap(NLM_IDEA_STATS_KEY, stats);

    const urlCounts = buildUrlCounts(entries);
    const totalBundles = entries.length;
    const deepCount = computeDeepCount(entries, urlCounts);
    const engagementScore = computeEngagementScore(entries, urlCounts);
    const selectionRepeat = computeSelectionRepeat(entries);

    const meetsBundleCount = totalBundles >= IDEA_MIN_BUNDLES;
    const meetsDepth = deepCount >= IDEA_MIN_DEEP;
    const meetsScore = engagementScore >= IDEA_SCORE_MIN;

    if (!meetsBundleCount || !(meetsDepth || meetsScore)) {
        return { suggestion: null, shouldPrompt: false };
    }

    const suggestion = {
        topicKey: topic.topicKey,
        displayTitle: topic.displayTitle || "Untitled",
        keywords: topic.keywords || [],
        suggestedAt: now,
        status: "open",
        notebookName: topic.displayTitle || "Untitled",
        reason: {
            totalBundles,
            deepCount,
            engagementScore,
            selectionRepeat
        },
        context: {
            url: entry.url,
            title: entry.title,
            domain: entry.domain,
            selection: note.selection || ""
        }
    };

    const nextSuggestions = [suggestion, ...suggestions].slice(0, IDEA_SUGGESTION_CAP);
    await saveSuggestions(nextSuggestions);

    record.lastSuggestedAt = now;
    stats[topic.topicKey] = record;
    await saveMap(NLM_IDEA_STATS_KEY, stats);

    // Log idea incubator event (per spec section 9)
    logIdeaIncubatorCreated({
        topicKey: topic.topicKey,
        displayTitle: suggestion.displayTitle,
        totalBundles,
        deepCount,
        engagementScore
    });

    return { suggestion, shouldPrompt: true };
}

export async function loadIdeaSuggestions() {
    return loadSuggestions();
}
