import { normalizeString } from "./types.js";

function formatLine(label, value) {
    const safe = normalizeString(value);
    return safe ? `- ${label}: ${safe}` : null;
}

/**
 * Truncate text to maxChars, adding ellipsis if truncated
 * @param {string} text - Text to truncate
 * @param {number} maxChars - Maximum characters (0 = unlimited)
 * @returns {string} Truncated text
 */
function truncateText(text, maxChars) {
    if (!maxChars || maxChars <= 0) return text;
    if (!text || text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
}

/**
 * Format bundle into ATOM Clip format for NotebookLM export
 * @param {Object} bundle - Reading bundle
 * @param {Object} options - Format options
 * @param {number} options.maxChars - Max total characters (0 = unlimited)
 * @returns {string} Formatted clip text
 */
export function formatAtomClip(bundle, options = {}) {
    if (!bundle) return "";
    const { maxChars = 0 } = options;
    const lines = [];

    const title = normalizeString(bundle.title) || normalizeString(bundle.url) || "Untitled";
    lines.push(`# ATOM Clip - ${title}`);
    lines.push("");

    const urlLine = formatLine("Source URL", bundle.url);
    if (urlLine) lines.push(urlLine);
    const capturedAt = bundle.capturedAt ? new Date(bundle.capturedAt).toISOString() : "";
    const capturedLine = formatLine("CapturedAt", capturedAt);
    if (capturedLine) lines.push(capturedLine);

    const modeLine = formatLine("Mode", bundle.readingMode);
    if (modeLine) lines.push(modeLine);
    const confidenceLine = Number.isFinite(bundle.confidence)
        ? `- Confidence: ${bundle.confidence.toFixed(2)}`
        : null;
    if (confidenceLine) lines.push(confidenceLine);

    const intentLine = formatLine("Intent", bundle.userIntentLabel);
    if (intentLine) lines.push(intentLine);
    if (Array.isArray(bundle.tags) && bundle.tags.length) {
        lines.push(`- Tags: ${bundle.tags.join(", ")}`);
    }

    lines.push("");
    const selectedText = normalizeString(bundle.selectedText);
    const viewportExcerpt = normalizeString(bundle.viewportExcerpt);
    const highlight = selectedText || viewportExcerpt;
    if (highlight) {
        lines.push("## Highlight");
        lines.push("");
        lines.push(highlight);
        lines.push("");
    }

    const thought = normalizeString(bundle.atomicThought);
    if (thought) {
        lines.push("## Atomic Thought");
        lines.push("");
        lines.push(thought);
        lines.push("");
    }

    const whySaved = normalizeString(bundle.whySaved);
    if (whySaved) {
        lines.push("## Why Saved");
        lines.push("");
        lines.push(whySaved);
        lines.push("");
    }

    const result = lines.join("\n").trim();
    return truncateText(result, maxChars);
}

