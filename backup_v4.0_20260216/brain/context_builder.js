// brain/context_builder.js — Phase 4: Rich context for AI calls
// Used by background.js (ES6 module context)
// Gathers reading session, highlights, and patterns for AI enrichment.

import { loadCards } from '../storage/srq_store.js';

/**
 * Build rich context for background AI calls.
 * Non-blocking, max ~50ms. Returns partial data on failure.
 *
 * @param {number} tabId - Chrome tab ID
 * @returns {Object} Context object for AI
 */
export async function buildContext(tabId) {
    const ctx = { page: null, reading: null, highlights: [], patterns: null };

    try {
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url;
        const domain = new URL(url).hostname;

        ctx.page = { title: tab.title, url, domain };

        // Gather data in parallel, each with its own error handling
        const [highlights, patterns] = await Promise.all([
            getHighlightsForUrl(url).catch(() => []),
            getReadingPatterns(domain).catch(() => null)
        ]);

        ctx.highlights = highlights;
        ctx.patterns = patterns;
    } catch {
        // Tab may not exist — return minimal context
    }

    return ctx;
}

/**
 * Get recent SRQ highlights for a specific URL.
 * Returns up to 5 most recent cards.
 */
async function getHighlightsForUrl(url) {
    const cards = await loadCards();
    return cards
        .filter(c => c.sourceUrl === url && c.selectedText)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 5)
        .map(c => ({
            text: c.selectedText.slice(0, 150),
            status: c.status
        }));
}

/**
 * Get reading patterns for a domain.
 * Reads from aggregated reading stats in storage.
 */
async function getReadingPatterns(domain) {
    try {
        const data = await chrome.storage.local.get(['atom_reading_stats']);
        const stats = data.atom_reading_stats;
        if (!stats) return null;

        const domainStats = stats[domain];
        if (!domainStats) return null;

        return {
            visitCount: domainStats.visitCount || 0,
            totalReadingTime: domainStats.totalReadingTime || 0
        };
    } catch {
        return null;
    }
}

/**
 * Build a system prompt section from context data.
 * Appends reading context info to any base system prompt.
 *
 * @param {string} basePrompt - The original system prompt
 * @param {Object} context - Context from buildContext()
 * @returns {string} Enriched system prompt
 */
export function buildSystemPrompt(basePrompt, context) {
    if (!context || !context.page) return basePrompt;

    const parts = [basePrompt];
    parts.push(`\n\n[READING CONTEXT]`);
    parts.push(`User is reading: "${context.page.title}" on ${context.page.domain}`);

    if (context.highlights && context.highlights.length > 0) {
        parts.push(`\nRecent highlights from this page:`);
        context.highlights.forEach((h, i) => {
            parts.push(`  ${i + 1}. "${h.text}" (${h.status})`);
        });
    }

    if (context.patterns) {
        const mins = Math.round((context.patterns.totalReadingTime || 0) / 60);
        parts.push(`\nReading history: ${context.patterns.visitCount} visits, ${mins}min total on this domain.`);
    }

    return parts.join('\n');
}
