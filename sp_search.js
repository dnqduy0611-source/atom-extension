/**
 * sp_search.js — Quick Search & Filter System
 * Phase 3a of Sidepanel Module Split
 *
 * Handles: Ctrl+F/Ctrl+K search modal, filter buttons,
 * keyboard nav, result clicks → thread/note switching.
 *
 * Dependencies (read from window.SP):
 *   SP.threads, SP.parkingLot, SP.getMessage, SP.getIcon,
 *   SP.escapeHtml, SP.switchMainTab, SP.switchToTab,
 *   SP.renderThreadList, SP.renderActiveThread, SP.activeThreadId
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Search] SP not found'); return; }

    // ── State ──
    let searchQuery = '';
    let activeFilter = 'all'; // 'all', 'today', 'week', 'insights', 'notes'
    let isSearchOpen = false;

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function getIcon(name) { return SP.getIcon ? SP.getIcon(name) : ''; }
    function escapeHtml(text) { return SP.escapeHtml ? SP.escapeHtml(text) : text; }

    // ===========================
    // Search & Filter System
    // ===========================
    function toggleQuickSearch() {
        if (isSearchOpen) {
            closeQuickSearch();
        } else {
            openQuickSearch();
        }
    }

    function openQuickSearch() {
        // Remove existing search modal
        document.getElementById('quick-search-modal')?.remove();

        isSearchOpen = true;

        const modal = document.createElement('div');
        modal.id = 'quick-search-modal';
        modal.className = 'sp-search-modal';

        const searchPlaceholder = getMessage('sp_search_placeholder', 'Search in insights and notes...');
        const filterAll = getMessage('sp_filter_all', 'All');
        const filterToday = getMessage('sp_filter_today', 'Today');
        const filterWeek = getMessage('sp_filter_week', 'This Week');
        const filterInsights = getMessage('sp_filter_insights', 'Insights');
        const filterNotes = getMessage('sp_filter_notes', 'Notes');

        modal.innerHTML = `
            <div class="sp-search-container">
                <div class="sp-search-header">
                    <span class="sp-search-icon">${getIcon('search')}</span>
                    <input type="text" class="sp-search-input" id="search-input" placeholder="${searchPlaceholder}" autofocus>
                    <kbd class="sp-search-esc">Esc</kbd>
                </div>

                <div class="sp-search-filters">
                    <button class="sp-filter-btn active" data-filter="all">${filterAll}</button>
                    <button class="sp-filter-btn" data-filter="today">${filterToday}</button>
                    <button class="sp-filter-btn" data-filter="week">${filterWeek}</button>
                    <button class="sp-filter-btn" data-filter="insights">${filterInsights}</button>
                    <button class="sp-filter-btn" data-filter="notes">${filterNotes}</button>
                </div>

                <div class="sp-search-results" id="search-results">
                    <div class="sp-search-empty">${getMessage('sp_search_hint', 'Type to search...')}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus input
        const searchInput = document.getElementById('search-input');
        searchInput?.focus();

        // Search input handler
        searchInput?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            performSearch();
        });

        // Filter buttons
        modal.querySelectorAll('.sp-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.querySelectorAll('.sp-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                performSearch();
            });
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeQuickSearch();
            }
        });

        // Keyboard navigation
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeQuickSearch();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectSearchResult();
            }
        });
    }

    function closeQuickSearch() {
        const modal = document.getElementById('quick-search-modal');
        if (modal) {
            modal.classList.add('hiding');
            setTimeout(() => modal.remove(), 200);
        }
        isSearchOpen = false;
        searchQuery = '';
    }

    function performSearch() {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        const query = searchQuery.toLowerCase().trim();

        // Get all searchable items
        let items = [];

        // Add threads/discussions
        (SP.threads || []).forEach(thread => {
            items.push({
                type: 'thread',
                id: thread.id,
                title: thread.highlight?.text?.slice(0, 100) || 'Discussion',
                content: thread.refinedInsight || thread.highlight?.text || '',
                hasInsight: !!thread.refinedInsight,
                timestamp: thread.createdAt,
                status: thread.status
            });
        });

        // Add parking lot notes
        (SP.parkingLot || []).forEach(note => {
            items.push({
                type: 'note',
                id: note.id,
                title: 'Quick Note',
                content: note.text,
                hasInsight: false,
                timestamp: note.createdAt
            });
        });

        // Apply filters
        items = applyFilters(items);

        // Apply search query
        if (query) {
            items = items.filter(item =>
                item.content.toLowerCase().includes(query) ||
                item.title.toLowerCase().includes(query)
            );
        }

        // Render results
        if (items.length === 0) {
            const noResults = getMessage('sp_search_no_results', 'No results found');
            resultsContainer.innerHTML = `<div class="sp-search-empty">${noResults}</div>`;
            return;
        }

        resultsContainer.innerHTML = items.map((item, index) => {
            const icon = item.type === 'note' ? getIcon('note') :
                item.hasInsight ? getIcon('insight') :
                    item.status === 'parked' ? getIcon('check') : getIcon('thread');

            const preview = highlightMatch(item.content.slice(0, 120), query);
            const time = formatRelativeTime(item.timestamp);

            return `
                <div class="sp-search-result ${index === 0 ? 'selected' : ''}"
                     data-type="${item.type}" data-id="${item.id}">
                    <span class="sp-result-icon">${icon}</span>
                    <div class="sp-result-content">
                        <div class="sp-result-preview">${preview}...</div>
                        <div class="sp-result-meta">${time}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        resultsContainer.querySelectorAll('.sp-search-result').forEach(result => {
            result.addEventListener('click', () => {
                const type = result.dataset.type;
                const id = result.dataset.id;
                handleSearchResultClick(type, id);
            });
        });
    }

    function applyFilters(items) {
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const oneWeekMs = 7 * oneDayMs;

        switch (activeFilter) {
            case 'today':
                return items.filter(item => now - item.timestamp < oneDayMs);
            case 'week':
                return items.filter(item => now - item.timestamp < oneWeekMs);
            case 'insights':
                return items.filter(item => item.hasInsight);
            case 'notes':
                return items.filter(item => item.type === 'note');
            default:
                return items;
        }
    }

    function highlightMatch(text, query) {
        if (!query) return escapeHtml(text);

        const escaped = escapeHtml(text);
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return escaped.replace(regex, '<mark>$1</mark>');
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return getMessage('sp_time_just_now', 'Just now');
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;

        return new Date(timestamp).toLocaleDateString();
    }

    function navigateSearchResults(direction) {
        const results = document.querySelectorAll('.sp-search-result');
        if (results.length === 0) return;

        const currentIndex = Array.from(results).findIndex(r => r.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = results.length - 1;
        if (newIndex >= results.length) newIndex = 0;

        results.forEach((r, i) => {
            r.classList.toggle('selected', i === newIndex);
        });

        // Scroll into view
        results[newIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function selectSearchResult() {
        const selected = document.querySelector('.sp-search-result.selected');
        if (selected) {
            const type = selected.dataset.type;
            const id = selected.dataset.id;
            handleSearchResultClick(type, id);
        }
    }

    function handleSearchResultClick(type, id) {
        closeQuickSearch();

        if (type === 'thread') {
            SP.activeThreadId = id;
            SP.switchMainTab?.('chat', false);
            SP.switchToTab?.('discussions');
            SP.renderThreadList?.();
            SP.renderActiveThread?.();
        } else if (type === 'note') {
            SP.switchMainTab?.('notes', false);
            SP.switchToTab?.('notes');
            // Highlight the note
            setTimeout(() => {
                const noteEl = document.querySelector(`.sp-note-item[data-id="${id}"]`);
                if (noteEl) {
                    noteEl.classList.add('highlighted');
                    noteEl.scrollIntoView({ block: 'center' });
                    setTimeout(() => noteEl.classList.remove('highlighted'), 2000);
                }
            }, 100);
        }
    }

    // ── Expose API on SP ──
    SP.toggleQuickSearch = toggleQuickSearch;
    SP.closeQuickSearch = closeQuickSearch;

    console.log('[SP:Search] Module loaded');
})();
