// ui/components/related_memory.js
// UI component for displaying related memory cards

(function () {
    'use strict';

    const DEFAULT_STRINGS = {
        title: 'Related from your Memory',
        intro: 'This reminds me of your notes on:',
        similarLabel: 'similar',
        insightsLabel: 'insights',
        viewNotes: 'View Notes',
        compare: 'Compare Concepts',
        dismiss: 'Dismiss',
        alsoRelated: 'Also related:'
    };

    function normalizeStrings(strings) {
        return { ...DEFAULT_STRINGS, ...(strings || {}) };
    }

    function formatTimeAgo(timestamp) {
        if (!timestamp) return '';

        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} min ago`;
        return 'Just now';
    }

    function fadeOutAndRemove(element) {
        if (!element) return;
        element.classList.add('sp-memory-dismissed');
        setTimeout(() => element.remove(), 300);
    }

    /**
     * Creates the "Related from Memory" card.
     * @param {Object} memoryData - Data from checkForRelatedMemory
     * @param {Object} strings - i18n strings
     * @param {Object} callbacks - Event callbacks
     * @returns {HTMLElement}
     */
    function createRelatedMemoryUI(memoryData, strings, callbacks) {
        const labels = normalizeStrings(strings);
        const data = memoryData || {};
        const matches = Array.isArray(data.matches) ? data.matches : [];
        const connection = data.connection || '';
        const currentPage = data.currentPage || {};

        if (matches.length === 0) {
            return null;
        }

        const topMatch = matches[0];

        const container = document.createElement('div');
        container.className = 'sp-related-memory';

        // Header
        const header = document.createElement('div');
        header.className = 'sp-memory-header';
        header.innerHTML = `
            <span class="sp-memory-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="sp-memory-title">${labels.title}</span>
            <button type="button" class="sp-memory-dismiss" title="${labels.dismiss}">×</button>
        `;

        // Content
        const content = document.createElement('div');
        content.className = 'sp-memory-content';

        // Intro
        const intro = document.createElement('div');
        intro.className = 'sp-memory-intro';
        intro.textContent = labels.intro;

        // Top match
        const matchBox = document.createElement('div');
        matchBox.className = 'sp-memory-match';
        matchBox.innerHTML = `
            <div class="sp-memory-match-info">
                <span class="sp-memory-match-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </span>
                <div class="sp-memory-match-details">
                    <div class="sp-memory-match-title">"${topMatch.title || 'Unknown'}"</div>
                    <div class="sp-memory-match-meta">
                        <span class="sp-memory-match-similarity">${Math.round((topMatch.similarity || 0) * 100)}% ${labels.similarLabel}</span>
                        <span class="sp-memory-match-age">${formatTimeAgo(topMatch.createdAt)}</span>
                        <span class="sp-memory-match-stats">${topMatch.insightCount || 0} ${labels.insightsLabel}</span>
                    </div>
                </div>
            </div>
            ${topMatch.preview ? `<div class="sp-memory-match-preview">"${topMatch.preview}"</div>` : ''}
        `;

        // Connection explanation
        const connectionBox = document.createElement('div');
        connectionBox.className = 'sp-memory-connection';
        connectionBox.innerHTML = `
            <span class="sp-memory-connection-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span>
            <span class="sp-memory-connection-text">${connection}</span>
        `;

        content.appendChild(intro);
        content.appendChild(matchBox);
        if (connection) {
            content.appendChild(connectionBox);
        }

        // More matches
        if (matches.length > 1) {
            const moreBox = document.createElement('div');
            moreBox.className = 'sp-memory-more';
            moreBox.innerHTML = `<span>${labels.alsoRelated}</span>`;

            matches.slice(1).forEach(m => {
                const mini = document.createElement('span');
                mini.className = 'sp-memory-mini-match';
                mini.dataset.sessionId = m.sessionId || '';
                mini.dataset.url = m.url || '';
                mini.textContent = `${(m.title || '').slice(0, 30)}... (${Math.round((m.similarity || 0) * 100)}%)`;
                moreBox.appendChild(mini);
            });

            content.appendChild(moreBox);
        }

        // Actions
        const actions = document.createElement('div');
        actions.className = 'sp-memory-actions';
        actions.innerHTML = `
            <button type="button" class="sp-memory-btn sp-memory-btn-primary" id="sp-memory-view">${labels.viewNotes}</button>
            <button type="button" class="sp-memory-btn" id="sp-memory-compare">${labels.compare}</button>
            <button type="button" class="sp-memory-btn" id="sp-memory-dismiss">${labels.dismiss}</button>
        `;

        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(actions);

        // Event handlers
        const dismissHandler = () => {
            if (typeof callbacks?.onDismiss === 'function') {
                callbacks.onDismiss();
            }
            fadeOutAndRemove(container);
        };

        header.querySelector('.sp-memory-dismiss')?.addEventListener('click', dismissHandler);
        actions.querySelector('#sp-memory-dismiss')?.addEventListener('click', dismissHandler);

        actions.querySelector('#sp-memory-view')?.addEventListener('click', () => {
            if (typeof callbacks?.onViewNotes === 'function') {
                callbacks.onViewNotes(topMatch.sessionId, topMatch.url);
            }
        });

        actions.querySelector('#sp-memory-compare')?.addEventListener('click', () => {
            if (typeof callbacks?.onCompare === 'function') {
                callbacks.onCompare(currentPage, topMatch);
            }
        });

        // Mini match clicks
        content.querySelectorAll('.sp-memory-mini-match').forEach(el => {
            el.addEventListener('click', () => {
                const sessionId = el.dataset.sessionId;
                const url = el.dataset.url;
                if (sessionId && typeof callbacks?.onViewNotes === 'function') {
                    callbacks.onViewNotes(sessionId, url);
                }
            });
        });

        return container;
    }

    // CSS Styles
    const RELATED_MEMORY_STYLES = `
.sp-related-memory {
    margin: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    animation: spMemorySlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

@keyframes spMemorySlideIn {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.sp-memory-dismissed {
    animation: spMemorySlideOut 0.3s ease-in forwards;
}

@keyframes spMemorySlideOut {
    to {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
}

.sp-memory-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--border);
}

.sp-memory-icon {
    display: flex;
    color: var(--primary);
}

.sp-memory-title {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--foreground);
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.sp-memory-dismiss {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--muted);
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s;
}

.sp-memory-dismiss:hover {
    color: var(--foreground);
    background: rgba(255, 255, 255, 0.1);
}

.sp-memory-content {
    padding: 16px;
}

.sp-memory-intro {
    color: var(--primary);
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
}

.sp-memory-match {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
}

.sp-memory-match-info {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
}

.sp-memory-match-icon {
    color: var(--primary);
}

.sp-memory-match-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground);
    margin-bottom: 4px;
    line-height: 1.4;
}

.sp-memory-match-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 11px;
    color: var(--muted);
}

.sp-memory-match-similarity {
    color: var(--primary);
    font-weight: 600;
}

.sp-memory-match-preview {
    font-style: italic;
    color: var(--muted);
    font-size: 13px;
    padding-left: 34px;
    line-height: 1.5;
    opacity: 0.8;
}

.sp-memory-connection {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    background: rgba(245, 158, 11, 0.1); /* Amber glass */
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 10px;
    margin-bottom: 16px;
}

.sp-memory-connection-icon {
    color: #fbbf24;
    margin-top: 2px;
}

.sp-memory-connection-text {
    color: #fbbf24;
    font-size: 13px;
    line-height: 1.5;
}

.sp-memory-more {
    font-size: 11px;
    color: var(--muted);
    margin-top: 12px;
}

.sp-memory-mini-match {
    display: inline-block;
    background: var(--background);
    color: var(--muted);
    padding: 4px 10px;
    border-radius: 6px;
    margin: 6px 6px 0 0;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid var(--border);
    font-size: 11px;
}

.sp-memory-mini-match:hover {
    background: var(--surface);
    color: var(--foreground);
    border-color: var(--primary);
}

.sp-memory-actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-top: 1px solid var(--border);
}

.sp-memory-btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
}

.sp-memory-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--foreground);
}

.sp-memory-btn-primary {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
    color: var(--primary);
}

.sp-memory-btn-primary:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: var(--primary);
    color: var(--primary);
}

/* Light Mode Overrides (if sp-related-memory is used in a light context) */
:root.light-mode .sp-related-memory {
    background: white;
    border-color: #e5e7eb;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
:root.light-mode .sp-memory-header {
    background: #f9fafb;
    border-bottom-color: #e5e7eb;
}
:root.light-mode .sp-memory-match {
    background: #f9fafb;
    border-color: #e5e7eb;
}
`;

    function injectRelatedMemoryStyles() {
        if (document.getElementById('related-memory-styles')) return;
        const style = document.createElement('style');
        style.id = 'related-memory-styles';
        style.textContent = RELATED_MEMORY_STYLES;
        document.head.appendChild(style);
    }

    window.RelatedMemoryUI = {
        createRelatedMemoryUI,
        injectRelatedMemoryStyles
    };
})();
