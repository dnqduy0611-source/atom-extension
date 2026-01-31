/**
 * NLM Floating Button - Floating button for NotebookLM export
 * Appears when user selects text
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        minSelectionLength: 20,      // Minimum characters to show button
        buttonShowDelay: 300,        // Delay before showing button (ms)
        buttonHideDelay: 200,        // Delay before hiding button (ms)
        zIndex: 2147483646           // Just below max z-index
    };

    // State
    let floatingButton = null;
    let promptModal = null;
    let showTimeout = null;
    let hideTimeout = null;
    let currentSelection = null;
    let isPromptOpen = false;

    // Styles
    const STYLES = `
        .atom-nlm-floating-btn {
            position: absolute;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
            color: white;
            border: none;
            border-radius: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
            z-index: ${CONFIG.zIndex};
            opacity: 0;
            transform: translateY(10px) scale(0.9);
            transition: opacity 0.2s, transform 0.2s;
            white-space: nowrap;
        }
        .atom-nlm-floating-btn.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .atom-nlm-floating-btn:hover {
            background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            box-shadow: 0 6px 16px rgba(124, 58, 237, 0.5);
        }
        .atom-nlm-floating-btn:active {
            transform: scale(0.95);
        }
        .atom-nlm-floating-btn svg {
            width: 16px;
            height: 16px;
        }

        /* Prompt Modal */
        .atom-nlm-prompt-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: ${CONFIG.zIndex};
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .atom-nlm-prompt-overlay.visible {
            opacity: 1;
        }
        .atom-nlm-prompt-modal {
            background: #1a1a2e;
            border: 1px solid #4a4a6a;
            border-radius: 16px;
            padding: 24px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            transform: translateY(20px) scale(0.95);
            transition: transform 0.2s;
        }
        .atom-nlm-prompt-overlay.visible .atom-nlm-prompt-modal {
            transform: translateY(0) scale(1);
        }
        .atom-nlm-prompt-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }
        .atom-nlm-prompt-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #7c3aed, #5b21b6);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .atom-nlm-prompt-icon svg {
            width: 24px;
            height: 24px;
            color: white;
        }
        .atom-nlm-prompt-title {
            font-size: 18px;
            font-weight: 600;
            color: #e0e0e0;
        }
        .atom-nlm-prompt-subtitle {
            font-size: 13px;
            color: #8a8a9a;
        }
        .atom-nlm-prompt-content {
            margin-bottom: 20px;
        }
        .atom-nlm-prompt-message {
            font-size: 14px;
            color: #c0c0c0;
            line-height: 1.5;
            margin-bottom: 16px;
        }
        .atom-nlm-prompt-topic {
            background: rgba(124, 58, 237, 0.1);
            border: 1px solid rgba(124, 58, 237, 0.3);
            border-radius: 10px;
            padding: 12px;
        }
        .atom-nlm-prompt-topic-label {
            font-size: 12px;
            color: #8a8a9a;
            margin-bottom: 4px;
        }
        .atom-nlm-prompt-topic-value {
            font-size: 15px;
            color: #a78bfa;
            font-weight: 500;
        }
        .atom-nlm-prompt-keywords {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
        }
        .atom-nlm-prompt-keyword {
            background: rgba(124, 58, 237, 0.2);
            color: #c4b5fd;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
        }
        .atom-nlm-prompt-match {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 10px;
            padding: 12px;
            margin-top: 12px;
        }
        .atom-nlm-prompt-match-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .atom-nlm-prompt-match-icon {
            color: #22c55e;
        }
        .atom-nlm-prompt-match-title {
            font-size: 14px;
            color: #22c55e;
            font-weight: 500;
        }
        .atom-nlm-prompt-match-notebook {
            font-size: 15px;
            color: #e0e0e0;
            font-weight: 500;
        }
        .atom-nlm-prompt-match-score {
            font-size: 12px;
            color: #8a8a9a;
            margin-top: 4px;
        }
        .atom-nlm-prompt-actions {
            display: flex;
            gap: 10px;
        }
        .atom-nlm-prompt-btn {
            flex: 1;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            font-family: inherit;
        }
        .atom-nlm-prompt-btn-primary {
            background: linear-gradient(135deg, #7c3aed, #5b21b6);
            color: white;
        }
        .atom-nlm-prompt-btn-primary:hover {
            background: linear-gradient(135deg, #8b5cf6, #6d28d9);
            transform: translateY(-1px);
        }
        .atom-nlm-prompt-btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #c0c0c0;
            border: 1px solid #4a4a6a;
        }
        .atom-nlm-prompt-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
        }
        .atom-nlm-prompt-btn-ghost {
            background: transparent;
            color: #8a8a9a;
        }
        .atom-nlm-prompt-btn-ghost:hover {
            color: #c0c0c0;
        }
        .atom-nlm-prompt-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: #6a6a8a;
            cursor: pointer;
            padding: 4px;
            font-size: 20px;
            line-height: 1;
        }
        .atom-nlm-prompt-close:hover {
            color: #a0a0a0;
        }

        /* Loading state */
        .atom-nlm-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
        }
        .atom-nlm-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(124, 58, 237, 0.3);
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: atom-spin 0.8s linear infinite;
        }
        @keyframes atom-spin {
            to { transform: rotate(360deg); }
        }

        /* Toast */
        .atom-nlm-toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: #1a1a2e;
            border: 1px solid #4a4a6a;
            border-radius: 10px;
            padding: 12px 20px;
            color: #e0e0e0;
            font-size: 14px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
            z-index: ${CONFIG.zIndex + 1};
            opacity: 0;
            transition: transform 0.3s, opacity 0.3s;
        }
        .atom-nlm-toast.visible {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        .atom-nlm-toast.success {
            border-color: #22c55e;
        }
        .atom-nlm-toast.error {
            border-color: #ef4444;
        }

        /* Topic Input */
        .atom-nlm-prompt-topic-input {
            width: 100%;
            padding: 10px 12px;
            background: rgba(124, 58, 237, 0.1);
            border: 2px solid rgba(124, 58, 237, 0.3);
            border-radius: 8px;
            color: #e0e0e0;
            font-size: 15px;
            font-weight: 500;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, background 0.2s;
        }
        .atom-nlm-prompt-topic-input:focus {
            border-color: #7c3aed;
            background: rgba(124, 58, 237, 0.15);
        }
        .atom-nlm-prompt-topic-input::placeholder {
            color: #6a6a8a;
        }
        .atom-nlm-prompt-topic-hint {
            font-size: 12px;
            color: #6a6a8a;
            margin-top: 6px;
        }
        .atom-nlm-prompt-edit-btn {
            background: none;
            border: none;
            color: #7c3aed;
            cursor: pointer;
            padding: 4px 8px;
            font-size: 12px;
            margin-left: 8px;
        }
        .atom-nlm-prompt-edit-btn:hover {
            color: #a78bfa;
            text-decoration: underline;
        }
        .atom-nlm-prompt-topic-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    `;

    // Icons
    const ICONS = {
        notebook: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>`,
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>`,
        plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>`,
        sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
            <circle cx="12" cy="12" r="4"/>
        </svg>`
    };

    /**
     * Inject styles into page
     */
    function injectStyles() {
        if (document.getElementById('atom-nlm-styles')) return;
        const style = document.createElement('style');
        style.id = 'atom-nlm-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    /**
     * Create floating button element
     */
    function createFloatingButton() {
        if (floatingButton) return floatingButton;

        const btn = document.createElement('button');
        btn.className = 'atom-nlm-floating-btn';
        btn.innerHTML = `${ICONS.notebook} <span>Save to Notebook</span>`;
        btn.addEventListener('click', handleButtonClick);
        document.body.appendChild(btn);

        floatingButton = btn;
        return btn;
    }

    /**
     * Show floating button near selection
     */
    function showButton(selection) {
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!floatingButton) createFloatingButton();

        // Position button above selection
        const btnWidth = 160;
        const btnHeight = 36;
        let left = rect.left + (rect.width / 2) - (btnWidth / 2) + window.scrollX;
        let top = rect.top - btnHeight - 10 + window.scrollY;

        // Keep within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - btnWidth - 10));
        if (top < window.scrollY + 10) {
            top = rect.bottom + 10 + window.scrollY; // Show below if no space above
        }

        floatingButton.style.left = `${left}px`;
        floatingButton.style.top = `${top}px`;

        // Show with animation
        requestAnimationFrame(() => {
            floatingButton.classList.add('visible');
        });

        currentSelection = {
            text: selection.toString().trim(),
            range: range.cloneRange()
        };
    }

    /**
     * Hide floating button
     */
    function hideButton() {
        if (floatingButton) {
            floatingButton.classList.remove('visible');
        }
    }

    /**
     * Handle floating button click
     */
    async function handleButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!currentSelection || !currentSelection.text) return;

        hideButton();
        showPrompt();
    }

    /**
     * Show prompt modal
     */
    async function showPrompt() {
        isPromptOpen = true;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'atom-nlm-prompt-overlay';
        overlay.innerHTML = `
            <div class="atom-nlm-prompt-modal">
                <button class="atom-nlm-prompt-close">×</button>
                <div class="atom-nlm-loading">
                    <div class="atom-nlm-spinner"></div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        promptModal = overlay;

        // Show overlay
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });

        // Close button
        overlay.querySelector('.atom-nlm-prompt-close').onclick = closePrompt;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePrompt();
        });

        // Get routing result
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                throw new Error('Extension was updated. Please refresh the page.');
            }

            const response = await chrome.runtime.sendMessage({
                type: 'NLM_TOPIC_ROUTE',
                payload: {
                    title: document.title,
                    selection: currentSelection.text,
                    domain: window.location.hostname,
                    url: window.location.href,
                    tags: []
                }
            });

            if (response && response.ok) {
                renderPromptContent(response.routerResult, response.promptPayload);
            } else {
                renderError(response?.error || 'Failed to analyze content');
            }
        } catch (error) {
            console.error('[ATOM NLM] Route error:', error);
            // Handle extension context invalidated
            if (error.message?.includes('Extension context invalidated') ||
                error.message?.includes('Extension was updated') ||
                !chrome.runtime?.id) {
                renderError('Extension was updated. Please refresh this page to continue.');
            } else {
                renderError(error.message);
            }
        }
    }

    /**
     * Render prompt content based on router result
     */
    function renderPromptContent(result, prompt) {
        const modal = promptModal.querySelector('.atom-nlm-prompt-modal');

        const hasMatch = result.bestMatch && result.decision !== 'create';
        const matchScore = result.bestMatch?.score || 0;
        const isCreateMode = !hasMatch;

        modal.innerHTML = `
            <button class="atom-nlm-prompt-close">×</button>
            <div class="atom-nlm-prompt-header">
                <div class="atom-nlm-prompt-icon">${ICONS.notebook}</div>
                <div>
                    <div class="atom-nlm-prompt-title">Save to NotebookLM</div>
                    <div class="atom-nlm-prompt-subtitle">${currentSelection.text.length} characters selected</div>
                </div>
            </div>
            <div class="atom-nlm-prompt-content">
                <div class="atom-nlm-prompt-message">
                    ${hasMatch
                        ? `Found a matching notebook for this content.`
                        : `No matching notebook found. Name your new notebook:`}
                </div>
                <div class="atom-nlm-prompt-topic">
                    <div class="atom-nlm-prompt-topic-label">${isCreateMode ? 'Notebook Name' : 'Detected Topic'}</div>
                    ${isCreateMode ? `
                        <input type="text"
                               class="atom-nlm-prompt-topic-input"
                               id="atom-topic-name-input"
                               value="${result.displayTitle}"
                               placeholder="Enter notebook name..."
                               autocomplete="off"
                               spellcheck="false">
                        <div class="atom-nlm-prompt-topic-hint">You can edit the name above before creating</div>
                    ` : `
                        <div class="atom-nlm-prompt-topic-display">
                            <span class="atom-nlm-prompt-topic-value">${result.displayTitle}</span>
                        </div>
                    `}
                    ${result.keywords?.length > 0 ? `
                        <div class="atom-nlm-prompt-keywords">
                            ${result.keywords.slice(0, 5).map(k =>
                                `<span class="atom-nlm-prompt-keyword">${k}</span>`
                            ).join('')}
                        </div>
                    ` : ''}
                </div>
                ${hasMatch ? `
                    <div class="atom-nlm-prompt-match">
                        <div class="atom-nlm-prompt-match-header">
                            <span class="atom-nlm-prompt-match-icon">${ICONS.check}</span>
                            <span class="atom-nlm-prompt-match-title">Suggested Notebook</span>
                        </div>
                        <div class="atom-nlm-prompt-match-notebook">${result.bestMatch.displayTitle}</div>
                        <div class="atom-nlm-prompt-match-score">${Math.round(matchScore * 100)}% match</div>
                    </div>
                ` : ''}
            </div>
            <div class="atom-nlm-prompt-actions">
                ${hasMatch ? `
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-primary" data-action="use">
                        Use This Notebook
                    </button>
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-secondary" data-action="create">
                        Create New
                    </button>
                ` : `
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-primary" data-action="create">
                        Create Notebook
                    </button>
                `}
                <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-ghost" data-action="skip">
                    Cancel
                </button>
            </div>
        `;

        // Add event listeners
        modal.querySelector('.atom-nlm-prompt-close').onclick = closePrompt;
        modal.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => handlePromptAction(btn.dataset.action, result);
        });

        // Focus input if in create mode
        if (isCreateMode) {
            const input = modal.querySelector('#atom-topic-name-input');
            if (input) {
                setTimeout(() => {
                    input.focus();
                    input.select();
                }, 100);

                // Handle Enter key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePromptAction('create', result);
                    }
                });
            }
        }
    }

    /**
     * Render error state
     */
    function renderError(message) {
        const modal = promptModal.querySelector('.atom-nlm-prompt-modal');
        modal.innerHTML = `
            <button class="atom-nlm-prompt-close">×</button>
            <div class="atom-nlm-prompt-header">
                <div class="atom-nlm-prompt-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                    ${ICONS.sparkles}
                </div>
                <div>
                    <div class="atom-nlm-prompt-title">Oops!</div>
                    <div class="atom-nlm-prompt-subtitle">Something went wrong</div>
                </div>
            </div>
            <div class="atom-nlm-prompt-content">
                <div class="atom-nlm-prompt-message">${message}</div>
            </div>
            <div class="atom-nlm-prompt-actions">
                <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-secondary" data-action="skip">
                    Close
                </button>
            </div>
        `;
        modal.querySelector('.atom-nlm-prompt-close').onclick = closePrompt;
        modal.querySelector('[data-action]').onclick = closePrompt;
    }

    /**
     * Handle prompt action
     */
    async function handlePromptAction(action, result) {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                throw new Error('Extension was updated');
            }

            // Get custom topic name from input if exists (for create action)
            let displayTitle = result.displayTitle;
            let topicKey = result.topicKey;

            if (action === 'create') {
                const input = document.querySelector('#atom-topic-name-input');
                if (input && input.value.trim()) {
                    displayTitle = input.value.trim();
                    // Generate topicKey from displayTitle
                    topicKey = displayTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9\s]/g, '')
                        .replace(/\s+/g, '_')
                        .substring(0, 50);
                }
            }

            const response = await chrome.runtime.sendMessage({
                type: 'NLM_TOPIC_ACTION',
                action: action,
                data: {
                    topicKey: topicKey,
                    displayTitle: displayTitle,
                    keywords: result.keywords,
                    notebookRef: result.bestMatch?.notebookRef,
                    notebookUrl: result.bestMatch?.notebookUrl,
                    selection: currentSelection.text,
                    // Source info for pending topic
                    sourceUrl: window.location.href,
                    sourceTitle: document.title,
                    sourceDomain: window.location.hostname
                }
            });

            closePrompt();

            if (response?.ok) {
                const savedMsg = response.savedToMemory ? ' + Saved to Memory' : '';
                if (action === 'use' && response.notebookUrl) {
                    // Copy text to clipboard and open notebook
                    await copyToClipboard(currentSelection.text);
                    showToast(`Text copied!${savedMsg} Opening notebook...`, 'success');
                    setTimeout(() => {
                        window.open(response.notebookUrl, '_blank');
                    }, 500);
                } else if (action === 'create') {
                    await copyToClipboard(currentSelection.text);
                    showToast(`Text copied!${savedMsg} Creating "${displayTitle}"...`, 'success');
                } else if (action === 'skip') {
                    showToast('Cancelled', 'info');
                }
            }
        } catch (error) {
            console.error('[ATOM NLM] Action error:', error);
            // Handle extension context invalidated
            if (error.message?.includes('Extension context invalidated') ||
                error.message?.includes('Extension was updated') ||
                !chrome.runtime?.id) {
                closePrompt();
                showToast('Extension updated. Please refresh the page.', 'error');
            } else {
                showToast('Error: ' + error.message, 'error');
            }
        }
    }

    /**
     * Close prompt modal
     */
    function closePrompt() {
        if (promptModal) {
            promptModal.classList.remove('visible');
            setTimeout(() => {
                promptModal.remove();
                promptModal = null;
            }, 200);
        }
        isPromptOpen = false;
    }

    /**
     * Copy text to clipboard
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        }
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `atom-nlm-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Handle selection change
     */
    function handleSelectionChange() {
        if (isPromptOpen) return;

        clearTimeout(hideTimeout);
        clearTimeout(showTimeout);

        const selection = window.getSelection();
        const text = selection?.toString().trim() || '';

        if (text.length < CONFIG.minSelectionLength) {
            hideTimeout = setTimeout(hideButton, CONFIG.buttonHideDelay);
            return;
        }

        showTimeout = setTimeout(() => {
            showButton(selection);
        }, CONFIG.buttonShowDelay);
    }

    /**
     * Handle click outside
     */
    function handleClickOutside(e) {
        if (isPromptOpen) return;
        if (floatingButton && !floatingButton.contains(e.target)) {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                hideButton();
            }
        }
    }

    /**
     * Check if NLM Bridge is enabled
     */
    async function isNlmEnabled() {
        try {
            if (!chrome.runtime?.id) return false;
            const response = await chrome.runtime.sendMessage({ type: 'NLM_TOPIC_GET_SETTINGS' });
            return response?.ok && response?.settings?.enabled === true;
        } catch (e) {
            console.log('[ATOM NLM] Could not check NLM settings:', e.message);
            return false;
        }
    }

    /**
     * Initialize
     */
    async function init() {
        // Don't run on NotebookLM itself
        if (window.location.hostname.includes('notebooklm.google.com')) {
            return;
        }

        // Check if NLM Bridge is enabled before setting up
        const enabled = await isNlmEnabled();
        if (!enabled) {
            console.log('[ATOM NLM] Floating button disabled (NLM Bridge not enabled)');
            return;
        }

        injectStyles();

        // Event listeners
        document.addEventListener('selectionchange', handleSelectionChange);
        document.addEventListener('mousedown', handleClickOutside);

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideButton();
                closePrompt();
            }
        });

        console.log('[ATOM NLM] Floating button initialized');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
