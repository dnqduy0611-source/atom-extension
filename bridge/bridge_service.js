import {
    DEFAULT_NLM_RULES,
    DEFAULT_NLM_SETTINGS,
    NLM_RULES_KEY,
    NLM_SETTINGS_KEY,
    NLM_SENSITIVE_DOMAINS_KEY,
    normalizeString
} from "./types.js";
import { formatAtomClip } from "./clip_format.js";
import { resolveNotebookRef } from "./mapping_rules.js";
import { containsPii, getPiiSummary, isSensitiveUrl, normalizeSensitiveDomains } from "./privacy_guard.js";
import { buildDedupeKey, createExportJob, enqueueExportJob, isDedupeHit, markDedupeHit } from "./export_queue.js";
import { resolveNotebookUrl } from "./notebooklm_connector.js";
import { logExportAttempt, logExportSuccess, logExportFailed } from "./topic_router_logging.js";

export async function loadNlmSettings() {
    const data = await chrome.storage.local.get([NLM_SETTINGS_KEY]);
    return { ...DEFAULT_NLM_SETTINGS, ...(data[NLM_SETTINGS_KEY] || {}) };
}

export async function loadNlmRules() {
    const data = await chrome.storage.local.get([NLM_RULES_KEY]);
    return { ...DEFAULT_NLM_RULES, ...(data[NLM_RULES_KEY] || {}) };
}

export async function loadSensitiveDomains() {
    const data = await chrome.storage.local.get([NLM_SENSITIVE_DOMAINS_KEY]);
    const raw = data[NLM_SENSITIVE_DOMAINS_KEY] || [];
    return normalizeSensitiveDomains(raw);
}

/**
 * Derive reading mode from note signals
 * @param {Object} note - Note object
 * @returns {"skim" | "deep" | "reference" | "reread"}
 */
function deriveReadingMode(note) {
    if (!note) return "skim";

    // Use existing readingMode if provided
    const existing = normalizeString(note.readingMode).toLowerCase();
    if (["skim", "deep", "reference", "reread"].includes(existing)) {
        return existing;
    }

    // Check command type
    const command = normalizeString(note.command).toLowerCase();
    if (command.includes("critique") || command.includes("quiz") || command.includes("analyze")) {
        return "deep";
    }
    if (command.includes("reference") || command.includes("cite")) {
        return "reference";
    }

    // Check selection length
    const selection = normalizeString(note.selection);
    const selectionLen = selection.length;

    // Long selection suggests deep reading
    if (selectionLen > 500) return "deep";

    // Has atomic thought suggests deep engagement
    if (normalizeString(note.atomicThought)) return "deep";

    // Has user-confirmed tags suggests intentional reading
    if (note.tagsConfirmed || note.tagsSource === "user") return "deep";

    // Short selection or summary-only suggests skim
    if (selectionLen > 0 && selectionLen < 100) return "skim";

    // Default to skim
    return "skim";
}

/**
 * Derive confidence score from note signals
 * @param {Object} note - Note object
 * @returns {number} Confidence 0-1
 */
function deriveConfidence(note) {
    if (!note) return 0.3;

    let confidence = 0.4; // Base confidence

    const selection = normalizeString(note.selection);
    const selectionLen = selection.length;

    // Has selection: +0.2
    if (selectionLen > 0) {
        confidence += 0.2;
    }

    // Long selection (>200 chars): +0.1
    if (selectionLen > 200) {
        confidence += 0.1;
    }

    // Has atomic thought: +0.15
    if (normalizeString(note.atomicThought)) {
        confidence += 0.15;
    }

    // Has user-confirmed tags: +0.1
    if (note.tagsConfirmed || note.tagsSource === "user") {
        confidence += 0.1;
    }

    // Has AI result/summary: +0.05
    if (note.result?.summary || note.result?.critique) {
        confidence += 0.05;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
}

export function buildReadingBundle(note, settings) {
    if (!note) return null;
    const url = normalizeString(note.url);
    const title = normalizeString(note.title);
    let domain = "";
    if (url) {
        try {
            domain = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
        } catch {
            domain = "";
        }
    }
    const selection = normalizeString(note.selection);
    const summary = normalizeString(note?.result?.summary || "");
    const allowCloudExport = !!settings.allowCloudExport;
    const piiDetected = containsPii(selection || summary);

    // Derive reading mode and confidence from note signals
    const readingMode = deriveReadingMode(note);
    const confidence = deriveConfidence(note);

    // Extract additional fields from note if available
    const userIntentLabel = normalizeString(note.intent || note.userIntentLabel) || null;
    const atomicThought = normalizeString(note.atomicThought) || "";
    const tags = Array.isArray(note.tags) ? note.tags.filter(Boolean) : [];

    // NEW: Side Panel Active Reading fields
    const aiDiscussionSummary = normalizeString(note.aiDiscussionSummary) || "";
    const refinedInsight = normalizeString(note.refinedInsight) || "";
    const threadConnections = Array.isArray(note.connections) ? note.connections : [];

    return {
        id: note.id,
        url,
        title,
        domain,
        capturedAt: note.created_at || Date.now(),
        readingMode,
        confidence,
        selectedText: selection || "",
        viewportExcerpt: selection ? "" : summary,
        userIntentLabel,
        atomicThought,
        tags,
        sourceType: "web",
        privacy: {
            containsPII: piiDetected,
            allowCloudExport
        },
        // NEW: Active Reading 2.0 fields
        aiDiscussionSummary,
        refinedInsight,
        threadConnections
    };
}

export async function prepareNlmExportFromNote(note, bypassPii = false) {
    const settings = await loadNlmSettings();
    if (!settings.enabled) {
        return { ok: false, reason: "disabled" };
    }

    const bundle = buildReadingBundle(note, settings);
    if (!bundle) return { ok: false, reason: "missing_bundle" };

    if (!bundle.privacy.allowCloudExport) {
        return { ok: false, reason: "cloud_export_disabled" };
    }

    const sensitiveDomains = await loadSensitiveDomains();
    if (isSensitiveUrl(bundle.url, sensitiveDomains)) {
        return { ok: false, reason: "sensitive_domain" };
    }

    const notebookRules = await loadNlmRules();
    const notebookRef = resolveNotebookRef(bundle, notebookRules, settings.defaultNotebookRef);
    const dedupeKey = await buildDedupeKey({
        url: bundle.url,
        selectedText: bundle.selectedText || bundle.viewportExcerpt,
        notebookRef,
        capturedAt: bundle.capturedAt
    });

    if (await isDedupeHit(dedupeKey)) {
        return { ok: false, reason: "dedupe" };
    }

    const clipText = formatAtomClip(bundle, { maxChars: settings.exportMaxChars || 0 });
    const notebookUrl = resolveNotebookUrl(notebookRef, settings.baseUrl);

    if (bundle.privacy.containsPII && settings.piiWarning && !bypassPii) {
        return {
            ok: false,
            reason: "pii_warning",
            bundle,
            clipText,
            notebookRef,
            notebookUrl,
            dedupeKey,
            piiSummary: getPiiSummary(bundle.selectedText || bundle.viewportExcerpt || "")
        };
    }

    // Log export attempt
    logExportAttempt({
        noteId: bundle.id,
        notebookRef,
        url: bundle.url,
        readingMode: bundle.readingMode,
        confidence: bundle.confidence
    });

    const job = createExportJob({ bundleId: bundle.id, notebookRef, dedupeKey });
    await enqueueExportJob(job);
    await markDedupeHit(dedupeKey);

    // Log export success (queued for UI-assisted export)
    logExportSuccess({
        noteId: bundle.id,
        jobId: job.jobId,
        notebookRef,
        notebookUrl,
        mode: "ui_assisted"
    });

    return {
        ok: true,
        bundle,
        clipText,
        notebookRef,
        notebookUrl,
        job
    };
}
