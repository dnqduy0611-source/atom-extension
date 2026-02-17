/**
 * NLM Markdown Formatter - Format content as rich ATOM Clip markdown
 * Used for exporting to NotebookLM with full context
 */

/**
 * Format content as ATOM Clip markdown
 * @param {Object} options - Formatting options
 * @param {string} options.title - Smart title for the notebook
 * @param {string} options.url - Source URL
 * @param {string} options.pageTitle - Original page title
 * @param {string} options.date - Capture date (ISO format)
 * @param {string} options.domain - Source domain
 * @param {string} options.highlight - Selected/highlighted content
 * @param {string} options.summary - AI-generated summary (optional)
 * @param {string} options.notes - User notes (optional)
 * @param {string[]} options.tags - User tags (optional)
 * @returns {string} Formatted markdown string
 */
export function formatATOMClip({
    title,
    url,
    pageTitle,
    date,
    domain,
    highlight,
    summary = null,
    notes = null,
    tags = []
}) {
    const parts = [];

    // Header with smart title
    parts.push(`# ${title || 'Untitled Note'}`);
    parts.push('');

    // Metadata block
    parts.push(`> 📎 Source: [${pageTitle || domain || 'Web Page'}](${url || '#'})`);
    parts.push(`> 📅 Captured: ${formatDate(date)}`);
    if (domain) {
        parts.push(`> 🌐 Domain: ${domain}`);
    }
    if (tags && tags.length > 0) {
        const tagList = tags.map(t => `#${t}`).join(' ');
        parts.push(`> 🏷️ Tags: ${tagList}`);
    }
    parts.push('');

    // Main highlight content
    parts.push('## Highlight');
    parts.push('');
    parts.push(formatHighlight(highlight));
    parts.push('');

    // AI Summary (only if provided)
    if (summary) {
        parts.push('## AI Summary');
        parts.push('');
        parts.push(`> ${summary}`);
        parts.push('');
    }

    // User notes (only if provided)
    if (notes && notes.trim()) {
        parts.push('## My Notes');
        parts.push('');
        parts.push(notes.trim());
        parts.push('');
    }

    // Footer
    parts.push('---');
    parts.push('*Exported via ATOM Extension*');

    return parts.join('\n');
}

/**
 * Format highlight content with proper markdown
 * @param {string} text - Raw highlight text
 * @returns {string} Formatted text
 */
function formatHighlight(text) {
    if (!text) return '*No content selected*';

    const trimmed = text.trim();

    // If text is short, return as-is
    if (trimmed.length < 200) {
        return trimmed;
    }

    // For longer text, format paragraphs
    const paragraphs = trimmed.split(/\n\s*\n/).filter(p => p.trim());

    if (paragraphs.length <= 1) {
        return trimmed;
    }

    return paragraphs.map(p => p.trim()).join('\n\n');
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    if (!date) {
        return new Date().toISOString().split('T')[0];
    }

    if (typeof date === 'string') {
        // If already in YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
        }
        // Try to parse
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }

    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }

    return new Date().toISOString().split('T')[0];
}

/**
 * Generate a preview of the markdown (truncated for UI display)
 * @param {Object} options - Same as formatATOMClip
 * @param {number} maxLength - Maximum preview length
 * @returns {string} Truncated markdown preview
 */
export function generateMarkdownPreview(options, maxLength = 300) {
    const fullMarkdown = formatATOMClip(options);

    if (fullMarkdown.length <= maxLength) {
        return fullMarkdown;
    }

    // Find a good cut point
    const cutPoint = fullMarkdown.lastIndexOf('\n', maxLength);
    const preview = fullMarkdown.slice(0, cutPoint > 0 ? cutPoint : maxLength);

    return preview + '\n\n*[Preview truncated...]*';
}

/**
 * Escape HTML entities in text
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Check if content is long enough to warrant a summary
 * @param {string} text - Content to check
 * @returns {boolean} True if summary is needed
 */
export function needsSummary(text) {
    return text && text.length > 500;
}
