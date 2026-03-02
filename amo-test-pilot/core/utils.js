/**
 * core/utils.js — Shared utility functions
 *
 * Consolidates duplicated helpers across modules.
 */

/**
 * Strip markdown code block fencing from AI-generated code.
 * Handles ```lang ... ``` wrapping. Returns the largest code block found.
 * @param {string} code - Raw AI output that may contain markdown fencing
 * @returns {string} Clean code without markdown fencing
 */
export function stripCodeBlock(code) {
    if (!code) return '';
    const str = code.trim();
    // Find all fenced code blocks (supports ``` and ````)
    const blocks = [];
    const pattern = /(`{3,})(?:\w+)?\n([\s\S]*?)\1/g;
    let match;
    while ((match = pattern.exec(str)) !== null) {
        blocks.push(match[2].trim());
    }

    if (blocks.length > 0) {
        // Return the largest block (most likely the actual code, not small examples)
        return blocks.reduce((a, b) => a.length >= b.length ? a : b);
    }

    // No code block found — check for trailing text after closing brace/def
    const lastBraceIdx = str.lastIndexOf('}');
    if (lastBraceIdx > 0 && lastBraceIdx < str.length - 10) {
        return str.slice(0, lastBraceIdx + 1);
    }
    return str;
}
