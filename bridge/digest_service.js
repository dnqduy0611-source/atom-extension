/**
 * Digest Service - Weekly/Project Digest for NotebookLM Bridge
 *
 * Per spec section 5.4:
 * - Trigger: weekly or by project
 * - Gemini creates digest from atomic thoughts/traces (local)
 * - User clicks "Save digest to NotebookLM"
 * - Bridge exports digest as textContent to notebook "Project" or "Digest"
 *
 * NOTE: NotebookLM does NOT generate digest for ATOM (per spec)
 */

import { normalizeString } from "./types.js";
import { loadNlmSettings } from "./bridge_service.js";
import { resolveNotebookUrl } from "./notebooklm_connector.js";
import { logBridgeEvent } from "./topic_router_logging.js";

const NLM_DIGEST_KEY = "atom_nlm_digest_v1";
const NLM_DIGEST_HISTORY_KEY = "atom_nlm_digest_history_v1";

const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_DIGEST_HISTORY = 12; // Keep ~3 months of digests

/**
 * Digest entry structure
 * @typedef {Object} DigestEntry
 * @property {string} id - Unique digest ID
 * @property {string} type - "weekly" | "project"
 * @property {string} title - Digest title
 * @property {number} periodStart - Start timestamp
 * @property {number} periodEnd - End timestamp
 * @property {string} projectTag - Project tag (if type=project)
 * @property {Object} stats - Summary statistics
 * @property {Array} highlights - Key highlights
 * @property {Array} insights - Atomic thoughts collected
 * @property {Array} topTopics - Top topics by frequency
 * @property {string} summary - AI-generated summary (optional)
 * @property {number} createdAt - Creation timestamp
 * @property {boolean} exportedToNlm - Whether exported to NotebookLM
 * @property {string} notebookRef - Target notebook (if exported)
 */

/**
 * Load digest history from storage
 * @returns {Promise<Array>} Digest history
 */
async function loadDigestHistory() {
    const data = await chrome.storage.local.get([NLM_DIGEST_HISTORY_KEY]);
    return Array.isArray(data[NLM_DIGEST_HISTORY_KEY]) ? data[NLM_DIGEST_HISTORY_KEY] : [];
}

/**
 * Save digest history to storage
 * @param {Array} history - Digest history
 */
async function saveDigestHistory(history) {
    const trimmed = Array.isArray(history) ? history.slice(-MAX_DIGEST_HISTORY) : [];
    await chrome.storage.local.set({ [NLM_DIGEST_HISTORY_KEY]: trimmed });
}

/**
 * Load notes from ATOM storage for digest generation
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @param {string} [projectTag] - Optional project tag filter
 * @returns {Promise<Array>} Notes in period
 */
async function loadNotesForPeriod(startTime, endTime, projectTag = null) {
    try {
        const data = await chrome.storage.local.get(["atom_notes"]);
        const notes = data.atom_notes || [];

        return notes.filter(note => {
            if (!note) return false;

            const noteTime = note.created_at || 0;
            if (noteTime < startTime || noteTime > endTime) return false;

            // Filter by project tag if specified
            if (projectTag) {
                const tags = Array.isArray(note.tags) ? note.tags : [];
                const normalizedTags = tags.map(t => normalizeString(t).toLowerCase());
                if (!normalizedTags.includes(normalizeString(projectTag).toLowerCase())) {
                    return false;
                }
            }

            return true;
        });
    } catch (error) {
        console.error("[Digest] Failed to load notes:", error);
        return [];
    }
}

/**
 * Extract atomic thoughts from notes
 * @param {Array} notes - Notes array
 * @returns {Array} Atomic thoughts with context
 */
function extractAtomicThoughts(notes) {
    const thoughts = [];

    for (const note of notes) {
        const atomicThought = normalizeString(note.atomicThought);
        if (atomicThought) {
            thoughts.push({
                thought: atomicThought,
                url: note.url || "",
                title: note.title || "",
                tags: note.tags || [],
                createdAt: note.created_at || Date.now()
            });
        }

        // Also extract from AI result if available
        const aiInsight = note.result?.atomicThought || note.result?.insight;
        if (aiInsight && aiInsight !== atomicThought) {
            thoughts.push({
                thought: normalizeString(aiInsight),
                url: note.url || "",
                title: note.title || "",
                tags: note.tags || [],
                createdAt: note.created_at || Date.now(),
                source: "ai"
            });
        }
    }

    return thoughts;
}

/**
 * Calculate topic frequency from notes
 * @param {Array} notes - Notes array
 * @returns {Array} Top topics sorted by frequency
 */
function calculateTopTopics(notes) {
    const topicCounts = new Map();

    for (const note of notes) {
        // Count tags
        const tags = Array.isArray(note.tags) ? note.tags : [];
        for (const tag of tags) {
            const normalized = normalizeString(tag).toLowerCase();
            if (normalized) {
                topicCounts.set(normalized, (topicCounts.get(normalized) || 0) + 1);
            }
        }

        // Count domain
        if (note.url) {
            try {
                const domain = new URL(note.url).hostname.replace(/^www\./, "");
                topicCounts.set(`domain:${domain}`, (topicCounts.get(`domain:${domain}`) || 0) + 1);
            } catch { }
        }
    }

    // Sort by count and return top 10
    return Array.from(topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));
}

/**
 * Calculate reading statistics for period
 * @param {Array} notes - Notes array
 * @returns {Object} Statistics
 */
function calculateStats(notes) {
    let totalSelectionLength = 0;
    let deepReadCount = 0;
    let hasAtomicThought = 0;
    const domains = new Set();
    const uniqueUrls = new Set();

    for (const note of notes) {
        // Selection stats
        const selection = normalizeString(note.selection);
        totalSelectionLength += selection.length;

        // Reading mode
        const mode = normalizeString(note.readingMode || note.command).toLowerCase();
        if (mode.includes("deep") || mode.includes("critique") || mode.includes("quiz")) {
            deepReadCount++;
        }

        // Atomic thoughts
        if (normalizeString(note.atomicThought)) {
            hasAtomicThought++;
        }

        // Domains
        if (note.url) {
            uniqueUrls.add(note.url);
            try {
                domains.add(new URL(note.url).hostname.replace(/^www\./, ""));
            } catch { }
        }
    }

    return {
        totalNotes: notes.length,
        totalSelectionLength,
        avgSelectionLength: notes.length > 0 ? Math.round(totalSelectionLength / notes.length) : 0,
        deepReadCount,
        deepReadPercent: notes.length > 0 ? Math.round((deepReadCount / notes.length) * 100) : 0,
        atomicThoughtCount: hasAtomicThought,
        uniqueDomains: domains.size,
        uniqueUrls: uniqueUrls.size
    };
}

/**
 * Extract key highlights from notes
 * @param {Array} notes - Notes array
 * @param {number} maxHighlights - Maximum highlights to return
 * @returns {Array} Key highlights
 */
function extractHighlights(notes, maxHighlights = 5) {
    // Score notes by engagement signals
    const scored = notes
        .filter(n => normalizeString(n.selection).length > 50)
        .map(note => {
            let score = 0;

            // Has atomic thought: +3
            if (normalizeString(note.atomicThought)) score += 3;

            // Has tags: +2
            if (Array.isArray(note.tags) && note.tags.length > 0) score += 2;

            // Selection length bonus
            const selLen = normalizeString(note.selection).length;
            if (selLen > 200) score += 2;
            else if (selLen > 100) score += 1;

            // Deep reading mode: +2
            const mode = normalizeString(note.readingMode || note.command).toLowerCase();
            if (mode.includes("deep") || mode.includes("critique")) score += 2;

            return { note, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxHighlights);

    return scored.map(({ note }) => ({
        title: note.title || "Untitled",
        url: note.url || "",
        selection: normalizeString(note.selection).substring(0, 200),
        atomicThought: normalizeString(note.atomicThought),
        tags: note.tags || [],
        createdAt: note.created_at
    }));
}

/**
 * Generate a weekly digest
 * @param {Object} options - Generation options
 * @param {number} [options.weeksAgo=0] - How many weeks ago (0 = current week)
 * @returns {Promise<DigestEntry>} Generated digest
 */
export async function generateWeeklyDigest(options = {}) {
    const { weeksAgo = 0 } = options;

    const now = Date.now();
    const periodEnd = now - (weeksAgo * DIGEST_WINDOW_MS);
    const periodStart = periodEnd - DIGEST_WINDOW_MS;

    const notes = await loadNotesForPeriod(periodStart, periodEnd);

    const digest = {
        id: `weekly_${periodStart}_${Date.now()}`,
        type: "weekly",
        title: `Weekly Digest - ${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}`,
        periodStart,
        periodEnd,
        projectTag: null,
        stats: calculateStats(notes),
        highlights: extractHighlights(notes),
        insights: extractAtomicThoughts(notes),
        topTopics: calculateTopTopics(notes),
        summary: null, // To be filled by Gemini if available
        createdAt: Date.now(),
        exportedToNlm: false,
        notebookRef: null
    };

    // Save to history
    const history = await loadDigestHistory();
    history.push(digest);
    await saveDigestHistory(history);

    console.log("[Digest] Generated weekly digest:", digest.id, "with", notes.length, "notes");

    return digest;
}

/**
 * Generate a project digest
 * @param {string} projectTag - Project tag to filter by
 * @param {Object} options - Generation options
 * @returns {Promise<DigestEntry>} Generated digest
 */
export async function generateProjectDigest(projectTag, options = {}) {
    const { periodDays = 30 } = options;

    const now = Date.now();
    const periodStart = now - (periodDays * 24 * 60 * 60 * 1000);

    const notes = await loadNotesForPeriod(periodStart, now, projectTag);

    const digest = {
        id: `project_${normalizeString(projectTag).toLowerCase()}_${Date.now()}`,
        type: "project",
        title: `Project Digest: ${projectTag}`,
        periodStart,
        periodEnd: now,
        projectTag,
        stats: calculateStats(notes),
        highlights: extractHighlights(notes),
        insights: extractAtomicThoughts(notes),
        topTopics: calculateTopTopics(notes),
        summary: null,
        createdAt: Date.now(),
        exportedToNlm: false,
        notebookRef: null
    };

    // Save to history
    const history = await loadDigestHistory();
    history.push(digest);
    await saveDigestHistory(history);

    console.log("[Digest] Generated project digest:", digest.id, "for", projectTag, "with", notes.length, "notes");

    return digest;
}

/**
 * Format digest as ATOM Clip markdown for NotebookLM
 * @param {DigestEntry} digest - Digest entry
 * @returns {string} Formatted markdown
 */
export function formatDigestAsClip(digest) {
    const lines = [];

    // Header
    lines.push(`# ${digest.title}`);
    lines.push("");
    lines.push(`**Type:** ${digest.type === "weekly" ? "Weekly Digest" : "Project Digest"}`);
    lines.push(`**Period:** ${new Date(digest.periodStart).toLocaleDateString()} - ${new Date(digest.periodEnd).toLocaleDateString()}`);
    if (digest.projectTag) {
        lines.push(`**Project:** #${digest.projectTag}`);
    }
    lines.push(`**Generated:** ${new Date(digest.createdAt).toLocaleString()}`);
    lines.push("");

    // Statistics
    lines.push("## 📊 Statistics");
    lines.push("");
    lines.push(`- **Total reading sessions:** ${digest.stats.totalNotes}`);
    lines.push(`- **Deep reading:** ${digest.stats.deepReadCount} (${digest.stats.deepReadPercent}%)`);
    lines.push(`- **Atomic thoughts captured:** ${digest.stats.atomicThoughtCount}`);
    lines.push(`- **Unique sources:** ${digest.stats.uniqueUrls} from ${digest.stats.uniqueDomains} domains`);
    lines.push(`- **Average highlight length:** ${digest.stats.avgSelectionLength} chars`);
    lines.push("");

    // Top Topics
    if (digest.topTopics.length > 0) {
        lines.push("## 🏷️ Top Topics");
        lines.push("");
        for (const { topic, count } of digest.topTopics.slice(0, 5)) {
            const displayTopic = topic.startsWith("domain:") ? `📍 ${topic.slice(7)}` : `#${topic}`;
            lines.push(`- ${displayTopic}: ${count} mentions`);
        }
        lines.push("");
    }

    // AI Summary (if available)
    if (digest.summary) {
        lines.push("## 💡 Summary");
        lines.push("");
        lines.push(digest.summary);
        lines.push("");
    }

    // Key Insights (Atomic Thoughts)
    if (digest.insights.length > 0) {
        lines.push("## 🧠 Key Insights");
        lines.push("");
        const uniqueThoughts = [...new Set(digest.insights.map(i => i.thought))].slice(0, 10);
        for (const thought of uniqueThoughts) {
            lines.push(`> ${thought}`);
            lines.push("");
        }
    }

    // Highlights
    if (digest.highlights.length > 0) {
        lines.push("## ⭐ Highlights");
        lines.push("");
        for (const highlight of digest.highlights) {
            lines.push(`### ${highlight.title}`);
            if (highlight.url) {
                lines.push(`[Source](${highlight.url})`);
            }
            if (highlight.selection) {
                lines.push("");
                lines.push(`> "${highlight.selection}${highlight.selection.length >= 200 ? "..." : ""}"`);
            }
            if (highlight.atomicThought) {
                lines.push("");
                lines.push(`💭 *${highlight.atomicThought}*`);
            }
            if (highlight.tags && highlight.tags.length > 0) {
                lines.push("");
                lines.push(`Tags: ${highlight.tags.map(t => `#${t}`).join(" ")}`);
            }
            lines.push("");
        }
    }

    // Footer
    lines.push("---");
    lines.push("*Generated by ATOM Extension - NotebookLM Bridge*");

    return lines.join("\n");
}

/**
 * Export digest to NotebookLM (UI-assisted mode)
 * @param {string} digestId - Digest ID
 * @param {string} [notebookRef] - Target notebook reference (default: "Digest")
 * @returns {Promise<Object>} Export result
 */
export async function exportDigestToNlm(digestId, notebookRef = "Digest") {
    const history = await loadDigestHistory();
    const digest = history.find(d => d.id === digestId);

    if (!digest) {
        return { ok: false, error: "Digest not found" };
    }

    const settings = await loadNlmSettings();
    if (!settings.enabled) {
        return { ok: false, error: "NotebookLM Bridge is disabled" };
    }

    if (!settings.allowCloudExport) {
        return { ok: false, error: "Cloud export is disabled" };
    }

    // Format digest as clip
    const clipText = formatDigestAsClip(digest);

    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(clipText);
    } catch (error) {
        // Fallback for service worker context
        console.log("[Digest] Clipboard API not available, returning clip text");
    }

    // Generate notebook URL
    const notebookUrl = resolveNotebookUrl(notebookRef, settings.baseUrl);

    // Open NotebookLM
    await chrome.tabs.create({ url: notebookUrl });

    // Update digest as exported
    digest.exportedToNlm = true;
    digest.notebookRef = notebookRef;
    await saveDigestHistory(history);

    // Log event
    logBridgeEvent("nlm_bridge.digest_exported", {
        digestId,
        digestType: digest.type,
        notebookRef,
        statsTotal: digest.stats.totalNotes
    });

    return {
        ok: true,
        digestId,
        clipText,
        notebookRef,
        notebookUrl
    };
}

/**
 * Get digest history
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Digest history
 */
export async function getDigestHistory(options = {}) {
    const { type, limit = 10 } = options;

    let history = await loadDigestHistory();

    if (type) {
        history = history.filter(d => d.type === type);
    }

    return history.slice(-limit).reverse(); // Most recent first
}

/**
 * Get latest digest (for UI display)
 * @param {string} [type] - Filter by type
 * @returns {Promise<DigestEntry|null>} Latest digest or null
 */
export async function getLatestDigest(type = null) {
    const history = await getDigestHistory({ type, limit: 1 });
    return history[0] || null;
}

/**
 * Check if a new weekly digest is due
 * @returns {Promise<boolean>} True if digest should be generated
 */
export async function isWeeklyDigestDue() {
    const history = await loadDigestHistory();
    const weeklyDigests = history.filter(d => d.type === "weekly");

    if (weeklyDigests.length === 0) return true;

    const latest = weeklyDigests[weeklyDigests.length - 1];
    const daysSinceLastDigest = (Date.now() - latest.createdAt) / (24 * 60 * 60 * 1000);

    return daysSinceLastDigest >= 7;
}

/**
 * Update digest with AI-generated summary
 * @param {string} digestId - Digest ID
 * @param {string} summary - AI summary text
 * @returns {Promise<DigestEntry|null>} Updated digest
 */
export async function updateDigestSummary(digestId, summary) {
    const history = await loadDigestHistory();
    const digest = history.find(d => d.id === digestId);

    if (!digest) return null;

    digest.summary = normalizeString(summary);
    await saveDigestHistory(history);

    return digest;
}
