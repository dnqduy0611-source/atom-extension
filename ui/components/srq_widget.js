/**
 * SRQ Widget - Sidepanel widget + Review modal for Smart Research Queue
 *
 * UX Principle: Non-tech friendly. No jargon on screen.
 * All user-facing text uses i18n keys with plain language fallbacks.
 */

(function () {
    'use strict';

    // i18n helper with plain-language fallbacks
    function msg(key, fallback, substitutions) {
        try {
            if (chrome?.i18n?.getMessage) {
                const result = chrome.i18n.getMessage(key, substitutions);
                if (result) return result;
            }
        } catch { }
        if (!substitutions) return fallback;

        const values = Array.isArray(substitutions) ? substitutions : [substitutions];
        let text = fallback;
        for (let i = 0; i < values.length; i++) {
            const token = `$${i + 1}`;
            text = text.split(token).join(String(values[i] ?? ''));
        }
        return text;
    }

    /**
     * Friendly reading mode labels (non-tech)
     */
    function modeLabelAndClass(mode) {
        switch (mode) {
            case 'deep': return { label: msg('srq_mode_deep', 'Focused'), cls: 'srq-mode-deep' };
            case 'reference': return { label: msg('srq_mode_reference', 'For reference'), cls: 'srq-mode-reference' };
            case 'reread': return { label: msg('srq_mode_reread', 'Revisited'), cls: 'srq-mode-reread' };
            default: return { label: msg('srq_mode_skim', 'Quick read'), cls: 'srq-mode-skim' };
        }
    }

    /**
     * Friendly time-ago format
     */
    function timeAgo(ts) {
        if (!ts) return '';
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return msg('srq_time_now', 'just now');
        if (mins < 60) return msg('srq_time_mins', '$1 min ago', [String(mins)]);
        const hours = Math.floor(mins / 60);
        if (hours < 24) return msg('srq_time_hours', '$1h ago', [String(hours)]);
        const days = Math.floor(hours / 24);
        if (days === 1) return msg('srq_time_yesterday', 'yesterday');
        return msg('srq_time_days', '$1 days ago', [String(days)]);
    }

    /**
     * Truncate text safely
     */
    function truncate(text, max = 100) {
        if (!text || text.length <= max) return text || '';
        return text.substring(0, max) + '...';
    }

    /**
     * Extract clean domain for display (non-tech: just the site name)
     */
    function friendlyDomain(domain) {
        if (!domain) return '';
        return domain.replace(/^www\./, '').split('.')[0];
    }

    function buildTextElement(tagName, className, text) {
        const el = document.createElement(tagName);
        if (className) el.className = className;
        el.textContent = text;
        return el;
    }

    function setButtonLoadingState(button, label) {
        button.textContent = '';
        const spinner = document.createElement('span');
        spinner.className = 'srq-loading';
        spinner.setAttribute('aria-hidden', 'true');
        button.appendChild(spinner);
        button.appendChild(document.createTextNode(` ${label}`));
    }

    function updateModalSelectionState(selectedSet) {
        const selectedCount = selectedSet.size;
        const exportBtn = document.getElementById('srq-modal-export-btn');
        if (exportBtn) {
            exportBtn.textContent = msg('srq_export_selected', 'Save selected ($1)', [String(selectedCount)]);
            exportBtn.setAttribute(
                'aria-label',
                msg('srq_modal_export_aria', 'Save $1 selected highlights', [String(selectedCount)])
            );
            exportBtn.disabled = selectedCount === 0;
        }

        const subtitle = document.getElementById('srq-modal-subtitle');
        if (subtitle) {
            subtitle.textContent = msg('srq_review_subtitle', '$1 highlights ready to save', [String(selectedCount)]);
        }
    }

    // ===========================
    // State Helpers (Wave 1 P0)
    // ===========================

    /**
     * Create loading state widget
     * @returns {HTMLElement}
     */
    function createLoadingState() {
        const container = document.createElement('div');
        container.className = 'srq-widget srq-state-loading';

        const content = document.createElement('div');
        content.className = 'srq-state-content';
        content.setAttribute('aria-live', 'polite');
        content.setAttribute('aria-busy', 'true');

        const spinner = document.createElement('span');
        spinner.className = 'srq-loading';
        spinner.setAttribute('aria-label', msg('srq_loading', 'Loading...'));

        const text = buildTextElement('span', 'srq-state-text', msg('srq_loading', 'Loading...'));

        content.appendChild(spinner);
        content.appendChild(text);
        container.appendChild(content);
        return container;
    }

    /**
     * Create empty state widget
     * @returns {HTMLElement|null}
     */
    function createEmptyState() {
        const container = document.createElement('div');
        container.className = 'srq-widget srq-state-empty';

        const content = document.createElement('div');
        content.className = 'srq-state-content';

        const icon = buildTextElement('span', 'srq-state-icon', '\u{1F4D6}');
        const text = buildTextElement('span', 'srq-state-text', msg('srq_empty_state', 'No highlights waiting to save.'));

        content.appendChild(icon);
        content.appendChild(text);
        container.appendChild(content);
        return container;
    }

    /**
     * Create error state widget with retry button
     * @param {Function} onRetry - Callback when retry is clicked
     * @returns {HTMLElement}
     */
    function createErrorState(onRetry) {
        const container = document.createElement('div');
        container.className = 'srq-widget srq-state-error';

        const content = document.createElement('div');
        content.className = 'srq-state-content';
        content.setAttribute('role', 'alert');
        content.setAttribute('aria-live', 'assertive');

        const icon = buildTextElement('span', 'srq-state-icon', '\u26A0');
        const text = buildTextElement('span', 'srq-state-text', msg('srq_error_state', "Failed to load. Tap 'Try again'."));
        const retryBtn = buildTextElement('button', 'srq-btn srq-retry-btn', msg('srq_retry', 'Try again'));
        retryBtn.setAttribute('aria-label', msg('srq_retry', 'Try again'));

        content.appendChild(icon);
        content.appendChild(text);
        content.appendChild(retryBtn);
        container.appendChild(content);

        if (retryBtn && onRetry) {
            retryBtn.addEventListener('click', onRetry);
        }

        return container;
    }

    // ===========================
    // Widget (compact + expanded)
    // ===========================

    const PAGE_SIZE = 10;

    async function getDensityMode() {
        try {
            const result = await chrome.storage.sync.get({ srqDensityMode: 'comfortable' });
            return result?.srqDensityMode === 'compact' ? 'compact' : 'comfortable';
        } catch {
            return 'comfortable';
        }
    }

    function createWidget(batches, densityMode = 'comfortable', currentPage = 1) {
        if (!batches || batches.length === 0) return null;

        const totalCards = batches.reduce((sum, b) => sum + (b.cards?.length || 0), 0);
        if (totalCards === 0) return null;

        const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
        const safePage = Math.min(Math.max(Number(currentPage) || 1, 1), totalPages);
        const needsPagination = batches.length > PAGE_SIZE;
        const visibleBatches = needsPagination
            ? batches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
            : batches;

        const widget = document.createElement('div');
        widget.className = 'srq-widget';
        if (densityMode === 'compact') {
            widget.classList.add('srq-density-compact');
        }
        widget.setAttribute('role', 'region');
        widget.setAttribute('aria-label', msg('srq_widget_title', 'Saved highlights'));

        // Header
        const header = document.createElement('div');
        header.className = 'srq-header';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-controls', 'srq-batches');

        const icon = buildTextElement('span', 'srq-icon', '\u{1F4D6}');
        icon.setAttribute('aria-hidden', 'true');

        const title = buildTextElement('span', 'srq-title', msg('srq_widget_title', 'Saved highlights'));

        const badge = buildTextElement('span', 'srq-badge', String(totalCards));
        badge.setAttribute('aria-label', `${totalCards} ${msg('srq_clips_label', 'items')}`);

        const toggleBtn = buildTextElement('button', 'srq-toggle', '\u25BE');
        toggleBtn.setAttribute('aria-label', msg('srq_toggle', 'Show more'));
        toggleBtn.title = msg('srq_toggle', 'Show more');

        header.appendChild(icon);
        header.appendChild(title);
        header.appendChild(badge);
        header.appendChild(toggleBtn);

        const setExpandedState = (isExpanded) => {
            widget.classList.toggle('expanded', !!isExpanded);
            const toggleLabel = isExpanded ? msg('srq_toggle_collapse', 'Show less') : msg('srq_toggle', 'Show more');
            toggleBtn.setAttribute('aria-label', toggleLabel);
            toggleBtn.title = toggleLabel;
            header.setAttribute('aria-expanded', String(isExpanded));
        };

        const toggleExpanded = () => {
            setExpandedState(!widget.classList.contains('expanded'));
        };

        header.addEventListener('click', toggleExpanded);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleExpanded();
            }
        });
        widget.appendChild(header);

        // Batch list
        const batchList = document.createElement('div');
        batchList.id = 'srq-batches';
        batchList.className = 'srq-batches';
        // Wave 2 P1: ARIA role for list
        batchList.setAttribute('role', 'list');

        for (const batch of visibleBatches) {
            batchList.appendChild(createBatchCard(batch));
        }

        if (needsPagination) {
            const pagination = createPaginationControls(safePage, totalPages, batches, densityMode);
            batchList.appendChild(pagination);
        }

        widget.__setExpandedState = setExpandedState;
        widget.appendChild(batchList);
        return widget;
    }

    function createPaginationControls(currentPage, totalPages, allBatches, densityMode) {
        const container = document.createElement('div');
        container.className = 'srq-pagination';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'srq-btn srq-pagination-btn';
        prevBtn.textContent = '\u2190';
        prevBtn.disabled = currentPage === 1;
        prevBtn.setAttribute('aria-label', msg('srq_pagination_prev', 'Previous page'));
        prevBtn.addEventListener('click', () => {
            refreshWidget(allBatches, densityMode, currentPage - 1, true);
        });

        const pageInfo = document.createElement('span');
        pageInfo.className = 'srq-pagination-info';
        pageInfo.textContent = msg('srq_pagination_info', 'Page $1 of $2', [String(currentPage), String(totalPages)]);
        pageInfo.setAttribute('aria-live', 'polite');

        const nextBtn = document.createElement('button');
        nextBtn.className = 'srq-btn srq-pagination-btn';
        nextBtn.textContent = '\u2192';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.setAttribute('aria-label', msg('srq_pagination_next', 'Next page'));
        nextBtn.addEventListener('click', () => {
            refreshWidget(allBatches, densityMode, currentPage + 1, true);
        });

        container.appendChild(prevBtn);
        container.appendChild(pageInfo);
        container.appendChild(nextBtn);

        return container;
    }

    function refreshWidget(batches, densityMode, newPage, keepExpanded = false) {
        const container = document.getElementById('srq-widget-container');
        if (!container) return;

        const previousWidget = container.querySelector('.srq-widget');
        const wasExpanded = !!previousWidget?.classList.contains('expanded');

        container.innerHTML = '';
        const widget = createWidget(batches, densityMode, newPage);
        if (!widget) return;

        if (keepExpanded || wasExpanded) {
            if (typeof widget.__setExpandedState === 'function') {
                widget.__setExpandedState(true);
            } else {
                widget.classList.add('expanded');
            }
        }
        container.appendChild(widget);
    }

    function createBatchCard(batch) {
        const el = document.createElement('div');
        el.className = 'srq-batch';
        el.dataset.topic = batch.topicKey;
        // Wave 2 P1: ARIA role
        el.setAttribute('role', 'listitem');

        const cardCount = batch.cards?.length || 0;
        const topicLabel = batch.topicLabel || msg('srq_uncategorized', 'General');
        const topicLabelDisplay = truncate(topicLabel, 30);
        const topicLabelShort = truncate(topicLabel, 25);

        // Header row
        const headerDiv = document.createElement('div');
        headerDiv.className = 'srq-batch-header';
        const label = buildTextElement('span', 'srq-batch-label', topicLabelDisplay);
        label.title = String(batch.topicLabel || '');
        const count = buildTextElement('span', 'srq-batch-count', msg('srq_clips_count', '$1 highlights', [String(cardCount)]));
        headerDiv.appendChild(label);
        headerDiv.appendChild(count);
        el.appendChild(headerDiv);

        // Mode pills
        const modesDiv = document.createElement('div');
        modesDiv.className = 'srq-batch-modes';
        const modes = ['deep', 'skim', 'reference', 'reread'];
        for (const mode of modes) {
            const count = batch.stats?.[mode] || 0;
            if (count > 0) {
                const info = modeLabelAndClass(mode);
                const pill = document.createElement('span');
                pill.className = `srq-mode-pill ${info.cls}`;
                pill.textContent = `${count} ${info.label}`;
                modesDiv.appendChild(pill);
            }
        }
        el.appendChild(modesDiv);

        // Notebook suggestion
        if (batch.suggestedNotebook && batch.suggestedNotebook !== 'Inbox') {
            const meta = document.createElement('div');
            meta.className = 'srq-batch-meta';
            const arrow = buildTextElement('span', 'srq-arrow', '\u27F6');
            const notebookText = document.createTextNode(` ${truncate(batch.suggestedNotebook, 25)}`);
            meta.appendChild(arrow);
            meta.appendChild(notebookText);
            el.appendChild(meta);
        }

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'srq-batch-actions';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'srq-btn srq-btn-export';
        exportBtn.textContent = cardCount > 1
            ? msg('srq_export_all', 'Save all')
            : msg('srq_export', 'Save');
        // Wave 2 P1: ARIA label
        exportBtn.setAttribute(
            'aria-label',
            msg('srq_batch_export_aria', 'Save $1 highlights from $2', [String(cardCount), topicLabelShort])
        );
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleBatchExport(batch, exportBtn);
        });

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'srq-btn';
        reviewBtn.textContent = msg('srq_review', 'Review');
        // Wave 2 P1: ARIA label
        reviewBtn.setAttribute(
            'aria-label',
            msg('srq_batch_review_aria', 'Review $1 highlights from $2', [String(cardCount), topicLabelShort])
        );
        reviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openReviewModal(batch);
        });

        // Wave 2 P1: Keyboard support
        reviewBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openReviewModal(batch);
            }
        });

        const dismissBtn = document.createElement('button');
        dismissBtn.className = 'srq-btn srq-btn-dismiss';
        dismissBtn.textContent = '\u2715';
        dismissBtn.title = msg('srq_dismiss', 'Dismiss');
        // Wave 2 P1: ARIA label
        dismissBtn.setAttribute(
            'aria-label',
            msg('srq_batch_dismiss_aria', 'Dismiss $1 batch', [topicLabelShort])
        );
        dismissBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleBatchDismiss(batch, el);
        });

        actions.appendChild(exportBtn);
        actions.appendChild(reviewBtn);
        actions.appendChild(dismissBtn);
        el.appendChild(actions);

        return el;
    }

    // ===========================
    // Review Modal
    // ===========================

    async function openReviewModal(batch) {
        const densityMode = await getDensityMode();

        // Close any existing modal
        closeReviewModal();

        const cardCount = batch.cards?.length || 0;
        const selected = new Set(batch.cards.map(c => c.cardId));
        const topicLabel = batch.topicLabel || msg('srq_uncategorized', 'General');

        const overlay = document.createElement('div');
        overlay.className = 'srq-modal-overlay';
        overlay.id = 'srq-review-modal';
        // Wave 2 P1: ARIA attributes
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'srq-modal-title');

        // Wave 2 P1: Store trigger element for focus return
        overlay.__triggerElement = document.activeElement;

        const modal = document.createElement('div');
        modal.className = 'srq-modal';
        if (densityMode === 'compact') {
            modal.classList.add('srq-density-compact');
        }

        // Header
        const headerEl = document.createElement('div');
        headerEl.className = 'srq-modal-header';

        const title = buildTextElement('h2', 'srq-modal-title', msg('srq_review_title', 'Review: $1', [truncate(topicLabel, 25)]));
        title.id = 'srq-modal-title';

        const subtitle = buildTextElement('p', 'srq-modal-subtitle', msg('srq_review_subtitle', '$1 highlights ready to save', [String(cardCount)]));
        subtitle.id = 'srq-modal-subtitle';
        subtitle.setAttribute('aria-live', 'polite');

        headerEl.appendChild(title);
        headerEl.appendChild(subtitle);
        modal.appendChild(headerEl);

        // Body - card list
        const body = document.createElement('div');
        body.className = 'srq-modal-body';

        for (const card of batch.cards) {
            body.appendChild(createReviewCard(card, selected));
        }
        modal.appendChild(body);

        body.addEventListener('scroll', () => {
            if (body.scrollTop > 10) {
                headerEl.classList.add('scrolled');
            } else {
                headerEl.classList.remove('scrolled');
            }
        }, { passive: true });

        // Footer
        const footer = document.createElement('div');
        footer.className = 'srq-modal-footer';

        const targetDiv = document.createElement('div');
        targetDiv.className = 'srq-target';
        const targetLabel = buildTextElement('span', '', msg('srq_target_notebook', 'Save to:'));
        targetDiv.appendChild(targetLabel);
        const select = document.createElement('select');
        const notebookOption = document.createElement('option');
        const notebookValue = batch.suggestedNotebook || 'Inbox';
        notebookOption.value = notebookValue;
        notebookOption.textContent = notebookValue;
        select.appendChild(notebookOption);
        targetDiv.appendChild(select);
        footer.appendChild(targetDiv);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'srq-btn-secondary';
        cancelBtn.textContent = msg('srq_cancel', 'Cancel');
        cancelBtn.addEventListener('click', closeReviewModal);

        const exportBtn = document.createElement('button');
        exportBtn.className = 'srq-btn-primary';
        exportBtn.id = 'srq-modal-export-btn';
        exportBtn.textContent = msg('srq_export_selected', 'Save selected ($1)', [String(selected.size)]);
        exportBtn.setAttribute(
            'aria-label',
            msg('srq_modal_export_aria', 'Save $1 selected highlights', [String(selected.size)])
        );
        exportBtn.disabled = selected.size === 0;
        exportBtn.addEventListener('click', () => {
            const notebook = select.value || 'Inbox';
            handleModalExport(batch, selected, notebook, exportBtn);
        });

        footer.appendChild(cancelBtn);
        footer.appendChild(exportBtn);
        modal.appendChild(footer);

        overlay.appendChild(modal);

        // Wave 2 P1: Keyboard handlers
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeReviewModal();
                return;
            }
            if (e.key === 'Enter') {
                const activeEl = document.activeElement;
                const isInteractive = activeEl?.matches?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!isInteractive) {
                    e.preventDefault();
                    exportBtn.click();
                }
            }
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeReviewModal();
        });

        document.body.appendChild(overlay);

        // Wave 2 P1: Focus trap + auto-focus
        trapFocus(overlay);
        updateModalSelectionState(selected);
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        firstFocusable?.focus();
    }

    function createReviewCard(card, selectedSet) {
        const el = document.createElement('div');
        el.className = 'srq-review-card' + (selectedSet.has(card.cardId) ? ' selected' : '');
        el.dataset.cardId = card.cardId;

        // Selection text
        const textEl = document.createElement('div');
        textEl.className = 'srq-review-text';
        textEl.textContent = truncate(card.selectedText || card.viewportExcerpt || '', 200);
        el.appendChild(textEl);

        // Meta: domain + time + mode
        const meta = document.createElement('div');
        meta.className = 'srq-review-meta';
        const mode = modeLabelAndClass(card.readingMode);
        const domainEl = buildTextElement('span', '', friendlyDomain(card.domain));
        const dot1 = document.createElement('span');
        dot1.className = 'srq-dot';
        const timeEl = buildTextElement('span', '', timeAgo(card.createdAt));
        const dot2 = document.createElement('span');
        dot2.className = 'srq-dot';
        const modeEl = buildTextElement('span', `srq-mode-pill ${mode.cls}`, mode.label);
        modeEl.style.margin = '0';
        meta.appendChild(domainEl);
        meta.appendChild(dot1);
        meta.appendChild(timeEl);
        meta.appendChild(dot2);
        meta.appendChild(modeEl);
        el.appendChild(meta);

        // Atomic thought (insight)
        if (card.atomicThought) {
            const insight = document.createElement('div');
            insight.className = 'srq-review-insight';
            insight.textContent = truncate(card.atomicThought, 120);
            el.appendChild(insight);
        }

        // Related sessions
        if (card.relatedSessions?.length > 0) {
            const related = document.createElement('div');
            related.className = 'srq-review-related';
            related.textContent = msg('srq_related_to', 'Related to: $1', [
                card.relatedSessions.map(r => r.title).join(', ')
            ]);
            el.appendChild(related);
        }

        // PII warning
        if (card.piiWarning) {
            const warning = document.createElement('div');
            warning.className = 'srq-pii-warning';
            warning.textContent = msg('srq_pii_warning', 'This highlight may contain personal information. Please review before saving.');
            el.appendChild(warning);
        }

        // Actions: select/deselect + skip
        const actions = document.createElement('div');
        actions.className = 'srq-review-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'srq-btn' + (selectedSet.has(card.cardId) ? ' srq-btn-export' : '');
        toggleBtn.textContent = selectedSet.has(card.cardId)
            ? msg('srq_selected', 'Selected')
            : msg('srq_select', 'Select');
        toggleBtn.addEventListener('click', () => {
            if (selectedSet.has(card.cardId)) {
                selectedSet.delete(card.cardId);
                el.classList.remove('selected');
                toggleBtn.classList.remove('srq-btn-export');
                toggleBtn.textContent = msg('srq_select', 'Select');
            } else {
                selectedSet.add(card.cardId);
                el.classList.add('selected');
                toggleBtn.classList.add('srq-btn-export');
                toggleBtn.textContent = msg('srq_selected', 'Selected');
            }
            updateModalSelectionState(selectedSet);
        });

        const skipBtn = document.createElement('button');
        skipBtn.className = 'srq-btn srq-btn-dismiss';
        skipBtn.textContent = msg('srq_skip', 'Skip');
        skipBtn.addEventListener('click', () => {
            selectedSet.delete(card.cardId);
            el.style.opacity = '0';
            el.style.transform = 'translateX(30px)';
            el.style.transition = 'all 0.2s';
            setTimeout(() => {
                el.remove();
                // Dismiss the card
                chrome.runtime.sendMessage({ type: "SRQ_DISMISS_CARD", cardId: card.cardId }).catch(() => {});
                updateModalSelectionState(selectedSet);
            }, 200);
        });

        actions.appendChild(toggleBtn);
        actions.appendChild(skipBtn);
        el.appendChild(actions);

        return el;
    }

    function closeReviewModal() {
        const modal = document.getElementById('srq-review-modal');
        if (!modal) return;

        // Wave 2 P1: Return focus to trigger element
        const triggerElement = modal.__triggerElement;
        modal.remove();
        triggerElement?.focus();
    }

    /**
     * Wave 2 P1: Trap focus within modal boundaries.
     * @param {HTMLElement} modalElement - Modal overlay element
     */
    function trapFocus(modalElement) {
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = modalElement.querySelectorAll(focusableSelector);
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        if (!firstFocusable || !lastFocusable) return;

        modalElement.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                // Shift+Tab: loop to last if at first
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab: loop to first if at last
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        });
    }

    // ===========================
    // Actions
    // ===========================

    async function handleBatchExport(batch, btn) {
        if (!batch?.topicKey) return;

        const originalText = btn.textContent;

        // Wave 2 P1: Disable button during operation
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        setButtonLoadingState(btn, msg('srq_exporting', 'Saving...'));

        try {
            const response = await chrome.runtime.sendMessage({
                type: "SRQ_EXPORT_BATCH",
                topicKey: batch.topicKey,
                notebookRef: batch.suggestedNotebook || "Inbox"
            });

            if (response?.ok) {
                btn.textContent = msg('srq_exported_success', 'Saved $1 highlights', [String(response.exported || 0)]);
                btn.style.background = 'rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.3)';
                // Widget will refresh via SRQ_CARDS_UPDATED message
            } else if (response?.errorCode === 'CONFLICT') {
                // Wave 2 P1: In-flight conflict
                btn.textContent = msg('srq_in_flight', 'Already processing...');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.removeAttribute('aria-disabled');
                }, 2000);
            } else {
                btn.textContent = msg('srq_export_error', 'Save failed. Try again.');
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
                setTimeout(() => { btn.textContent = originalText; }, 2000);
            }
        } catch (err) {
            console.error("[SRQ Widget] Export failed:", err);
            btn.textContent = originalText;
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
        }
    }

    async function handleBatchDismiss(batch, el) {
        if (!batch?.topicKey) return;

        el.style.opacity = '0.5';
        el.style.transition = 'opacity 0.2s';

        try {
            await chrome.runtime.sendMessage({
                type: "SRQ_DISMISS_BATCH",
                topicKey: batch.topicKey
            });
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            el.style.transition = 'all 0.2s';
            setTimeout(() => el.remove(), 200);
        } catch {
            el.style.opacity = '1';
        }
    }

    async function handleModalExport(batch, selectedSet, notebook, btn) {
        if (selectedSet.size === 0) return;

        btn.disabled = true;
        setButtonLoadingState(btn, msg('srq_exporting', 'Saving...'));

        try {
            // Mark unselected cards as dismissed first
            for (const card of batch.cards) {
                if (!selectedSet.has(card.cardId)) {
                    await chrome.runtime.sendMessage({ type: "SRQ_DISMISS_CARD", cardId: card.cardId }).catch(() => {});
                }
            }

            // Export the batch
            const response = await chrome.runtime.sendMessage({
                type: "SRQ_EXPORT_BATCH",
                topicKey: batch.topicKey,
                notebookRef: notebook
            });

            if (response?.ok) {
                btn.textContent = msg('srq_exported_success', 'Saved $1 highlights', [String(response.exported || 0)]);
                setTimeout(closeReviewModal, 1200);
            } else {
                btn.textContent = msg('srq_export_error', 'Save failed. Try again.');
                btn.disabled = false;
            }
        } catch {
            btn.textContent = msg('srq_export_error', 'Save failed. Try again.');
            btn.disabled = false;
        }
    }

    // ===========================
    // Public API
    // ===========================

    window.SRQWidget = {
        create: createWidget,
        openReview: openReviewModal,
        closeReview: closeReviewModal,
        // Wave 1 P0: State helpers
        createLoadingState,
        createEmptyState,
        createErrorState
    };

})();
