/**
 * NLM Floating Button - Floating button for NotebookLM export AND Active Reading
 * Appears when user selects text
 */

(function () {
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

    // i18n helper
    function getMessage(key, fallback = '') {
        try {
            const msg = chrome.i18n?.getMessage?.(key);
            return msg || fallback;
        } catch {
            return fallback;
        }
    }

    // Styles
    const STYLES = `
        :root {
            --atom-green-primary: #10B981;
            --atom-green-dark: #059669;
            --atom-green-glow: rgba(16, 185, 129, 0.4);
            --atom-bg-dark: #050505;
            --atom-bg-surface: rgba(255, 255, 255, 0.05); /* Glass feel */
            --atom-border: rgba(255, 255, 255, 0.1);
            --atom-text-main: #ffffff;
            --atom-text-muted: #a3a3a3;
        }

        .atom-nlm-floating-btn {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--atom-green-primary) 0%, var(--atom-green-dark) 100%);
            color: white;
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px var(--atom-green-glow);
            z-index: ${CONFIG.zIndex};
            opacity: 0;
            transform: translateY(10px) scale(0.9);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            padding: 0;
            overflow: hidden;
        }
        .atom-nlm-floating-btn.visible {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        .atom-nlm-floating-btn:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6);
        }
        .atom-nlm-floating-btn.expanded {
            width: auto;
            height: auto;
            border-radius: 12px;
            padding: 6px;
            background: var(--atom-bg-dark);
            border: 1px solid var(--atom-green-glow);
            transform: translateY(0) scale(1);
        }
        .atom-nlm-floating-btn svg {
            width: 20px;
            height: 20px;
        }
        
        /* Main Icon Container */
        .atom-main-icon-container {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }
        .atom-nlm-floating-btn.expanded .atom-main-icon-container {
            display: none;
        }

        /* Action Menu */
        .atom-action-menu {
            display: none;
            flex-direction: row;
            gap: 4px;
            align-items: center;
        }
        .atom-nlm-floating-btn.expanded .atom-action-menu {
            display: flex;
        }

        .atom-action-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: transparent;
            border: none;
            border-radius: 8px;
            color: var(--atom-text-main);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            white-space: nowrap;
        }
        .atom-action-btn:hover {
            background: var(--atom-bg-surface);
            color: var(--atom-green-primary);
        }
        .atom-action-btn svg {
            width: 16px;
            height: 16px;
            color: var(--atom-text-muted);
            transition: color 0.2s;
        }
        .atom-action-btn:hover svg {
            color: var(--atom-green-primary);
        }
        .atom-divider {
            width: 1px;
            height: 20px;
            background: var(--atom-border);
            margin: 0 4px;
        }

        /* Prompt Modal */
        .atom-nlm-prompt-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(5, 5, 5, 0.85); /* Deep black glass */
            backdrop-filter: blur(8px);
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
            background: var(--atom-bg-dark);
            border: 1px solid var(--atom-border);
            border-radius: 16px;
            padding: 24px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
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
            background: linear-gradient(135deg, var(--atom-green-primary), var(--atom-green-dark));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px var(--atom-green-glow);
        }
        .atom-nlm-prompt-icon svg {
            width: 24px;
            height: 24px;
            color: white;
        }
        .atom-nlm-prompt-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--atom-text-main);
        }
        .atom-nlm-prompt-subtitle {
            font-size: 13px;
            color: var(--atom-text-muted);
        }
        .atom-nlm-prompt-content {
            margin-bottom: 20px;
        }
        .atom-nlm-prompt-message {
            font-size: 14px;
            color: #d1d5db;
            line-height: 1.5;
            margin-bottom: 16px;
        }
        .atom-nlm-prompt-topic {
            background: rgba(16, 185, 129, 0.05); /* Green tint */
            border: 1px solid var(--atom-green-glow);
            border-radius: 10px;
            padding: 12px;
        }
        .atom-nlm-prompt-topic-label {
            font-size: 12px;
            color: var(--atom-text-muted);
            margin-bottom: 4px;
        }
        .atom-nlm-prompt-topic-value {
            font-size: 15px;
            color: var(--atom-green-primary);
            font-weight: 500;
        }
        .atom-nlm-prompt-keywords {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
        }
        .atom-nlm-prompt-keyword {
            background: rgba(16, 185, 129, 0.1);
            color: #6ee7b7;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
        }
        .atom-nlm-prompt-match {
            background: rgba(16, 185, 129, 0.05);
            border: 1px solid rgba(16, 185, 129, 0.2);
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
            color: var(--atom-green-primary);
        }
        .atom-nlm-prompt-match-title {
            font-size: 14px;
            color: var(--atom-green-primary);
            font-weight: 500;
        }
        .atom-nlm-prompt-match-notebook {
            font-size: 15px;
            color: var(--atom-text-main);
            font-weight: 500;
        }
        .atom-nlm-prompt-match-score {
            font-size: 12px;
            color: var(--atom-text-muted);
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
            background: linear-gradient(135deg, var(--atom-green-primary), var(--atom-green-dark));
            color: white;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .atom-nlm-prompt-btn-primary:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        .atom-nlm-prompt-btn-secondary {
            background: var(--atom-bg-surface);
            color: var(--atom-text-main);
            border: 1px solid var(--atom-border);
        }
        .atom-nlm-prompt-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        .atom-nlm-prompt-btn-ghost {
            background: transparent;
            color: var(--atom-text-muted);
        }
        .atom-nlm-prompt-btn-ghost:hover {
            color: var(--atom-text-main);
        }
        .atom-nlm-prompt-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            color: var(--atom-text-muted);
            cursor: pointer;
            padding: 4px;
            font-size: 20px;
            line-height: 1;
        }
        .atom-nlm-prompt-close:hover {
            color: white;
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
            border: 3px solid rgba(16, 185, 129, 0.2);
            border-top-color: var(--atom-green-primary);
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
            background: var(--atom-bg-dark);
            border: 1px solid var(--atom-border);
            border-radius: 10px;
            padding: 12px 20px;
            color: var(--atom-text-main);
            font-size: 14px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: ${CONFIG.zIndex + 1};
            opacity: 0;
            transition: transform 0.3s, opacity 0.3s;
        }
        .atom-nlm-toast.visible {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        .atom-nlm-toast.success {
            border-color: var(--atom-green-primary);
            color: var(--atom-green-primary);
        }
        .atom-nlm-toast.error {
            border-color: #ef4444;
            color: #ef4444;
        }

        /* Topic Input */
        .atom-nlm-prompt-topic-input {
            width: 100%;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--atom-border);
            border-radius: 8px;
            color: white;
            font-size: 15px;
            font-weight: 500;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s, background 0.2s;
        }
        .atom-nlm-prompt-topic-input:focus {
            border-color: var(--atom-green-primary);
            background: rgba(16, 185, 129, 0.05);
        }
        .atom-nlm-prompt-topic-input::placeholder {
            color: var(--atom-text-muted);
        }
        .atom-nlm-prompt-topic-hint {
            font-size: 12px;
            color: var(--atom-text-muted);
            margin-top: 6px;
        }
        .atom-nlm-prompt-edit-btn {
            background: none;
            border: none;
            color: var(--atom-green-primary);
            cursor: pointer;
            padding: 4px 8px;
            font-size: 12px;
            margin-left: 8px;
        }
        .atom-nlm-prompt-edit-btn:hover {
            text-decoration: underline;
            color: #34d399;
        }
        .atom-nlm-prompt-topic-display {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        /* Markdown Preview */
        .atom-nlm-markdown-preview {
            background: rgba(0, 0, 0, 0.5);
            border-radius: 8px;
            padding: 12px;
            margin-top: 12px;
            max-height: 150px;
            overflow-y: auto;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 11px;
            line-height: 1.5;
            color: #9ca3af;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--atom-border);
        }
        .atom-nlm-markdown-preview-label {
            font-size: 11px;
            color: var(--atom-text-muted);
            margin-top: 12px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .atom-nlm-markdown-preview-label svg {
            width: 14px;
            height: 14px;
        }

        /* AI Status Indicator */
        .atom-nlm-ai-status {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--atom-green-primary);
            margin-top: 8px;
        }
        .atom-nlm-ai-status.loading {
            color: #fbbf24;
        }
        .atom-nlm-ai-status .spinner-small {
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: atomSpin 1s linear infinite;
        }
    `;

    // Icons
    const ICONS = {
        atom: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9 9 9 0 0 0 9 9z"/>
            <path d="M3.6 9h16.8"/>
            <path d="M3.6 15h16.8"/>
        </svg>`,
        summarize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="10" x2="3" y2="10"/>
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="14" x2="3" y2="14"/>
            <line x1="21" y1="18" x2="3" y2="18"/>
        </svg>`,
        critique: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>`,
        quiz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
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

    // Helper functions for markdown preview
    function generateMarkdownPreviewText({ title, url, pageTitle, domain, highlight, hasSummary }) {
        const date = new Date().toISOString().split('T')[0];
        let preview = `# ${title}\n\n`;
        preview += `> 📎 Source: [${pageTitle || domain}](${url})\n`;
        preview += `> 📅 Captured: ${date}\n`;
        preview += `> 🌐 Domain: ${domain}\n\n`;
        preview += `## Highlight\n\n${highlight}`;
        if (hasSummary) {
            preview += `\n\n## AI Summary\n> [Will be generated...]`;
        }
        preview += `\n\n---\n*Exported via ATOM Extension*`;
        return preview;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeHtmlContent(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    /**
     * Format rich markdown for NotebookLM export
     * @param {string} title - Notebook title
     * @param {string} content - Selected content
     * @param {string|null} summary - AI-generated summary (from background response)
     * @returns {Promise<string>} Rich markdown string
     */
    async function formatRichMarkdown(title, content, summary = null) {
        const date = new Date().toISOString().split('T')[0];
        const url = window.location.href;
        const pageTitle = document.title;
        const domain = window.location.hostname;

        let markdown = `# ${title}\n\n`;
        markdown += `> 📎 Source: [${pageTitle || domain}](${url})\n`;
        markdown += `> 📅 Captured: ${date}\n`;
        markdown += `> 🌐 Domain: ${domain}\n\n`;
        markdown += `## Highlight\n\n${content}\n`;

        // Add summary if provided
        if (summary) {
            markdown += `\n## AI Summary\n\n> ${summary}\n`;
        }

        markdown += `\n---\n*Exported via ATOM Extension*`;

        return markdown;
    }

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

        const btn = document.createElement('div');
        btn.className = 'atom-nlm-floating-btn';

        // Main Atom Icon
        btn.innerHTML = `
            <div class="atom-main-icon-container">
                ${ICONS.atom}
            </div>
            <div class="atom-action-menu">
                <button class="atom-action-btn" data-tooltip="Summarize" data-action="summarize">
                    ${ICONS.summarize} Tóm tắt
                </button>
                <button class="atom-action-btn" data-tooltip="Critique" data-action="critique">
                    ${ICONS.critique} Phản biện
                </button>
                <button class="atom-action-btn" data-tooltip="Quiz" data-action="quiz">
                    ${ICONS.quiz} Quiz
                </button>
                <div class="atom-divider"></div>
                <button class="atom-action-btn" data-tooltip="Save to NotebookLM" data-action="nlm">
                    ${ICONS.notebook} Lưu
                </button>
            </div>
        `;

        // Prevent text deselection when clicking on button
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // Bind events
        btn.querySelector('.atom-main-icon-container').addEventListener('click', toggleMenu);
        btn.querySelectorAll('.atom-action-btn').forEach(b => {
            b.addEventListener('click', (e) => handleActionClick(e, b.dataset.action));
        });

        document.body.appendChild(btn);
        floatingButton = btn;
        return btn;
    }

    function toggleMenu(e) {
        e.stopPropagation();
        e.preventDefault();
        if (floatingButton) {
            floatingButton.classList.toggle('expanded');
        }
    }

    async function handleActionClick(e, action) {
        e.stopPropagation();
        e.preventDefault();
        if (!currentSelection || !currentSelection.text) return;

        // Hide UI
        hideButton();

        if (action === 'nlm') {
            showPrompt();
        } else {
            // Trigger Active Reading
            const command = `atom-reading-${action}`;
            try {
                // Dispatch message to background
                await chrome.runtime.sendMessage({
                    type: "ATOM_REQUEST_READING",
                    payload: {
                        command: command,
                        text: currentSelection.text
                    }
                });

                // SRQ: Save to Research Queue (fire-and-forget)
                try {
                    chrome.runtime.sendMessage({
                        type: "SRQ_CREATE_CARD",
                        payload: {
                            url: window.location.href,
                            title: document.title,
                            domain: window.location.hostname,
                            selectedText: currentSelection.text || "",
                            command: command
                        }
                    });
                } catch (_srq) { /* SRQ is supplementary, silent fail */ }
            } catch (err) {
                console.error("ATOM Request Failed", err);
                showToast("Cannot contact ATOM. Refresh page?", "error");
            }
        }
    }

    /**
     * Show floating button near selection
     */
    function showButton(selection) {
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!floatingButton) createFloatingButton();

        // Ensure button resets to collapsed state
        floatingButton.classList.remove('expanded');

        // Position button above selection
        const btnWidth = 36; // Collapsed size
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
            setTimeout(() => {
                floatingButton.classList.remove('expanded');
            }, 200);
        }
    }

    /**
     * Show prompt modal (Existing Logic)
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

                // SRQ: Save enriched card with topic routing data (fire-and-forget)
                try {
                    chrome.runtime.sendMessage({
                        type: "SRQ_CREATE_CARD",
                        payload: {
                            url: window.location.href,
                            title: document.title,
                            domain: window.location.hostname,
                            selectedText: currentSelection?.text || "",
                            tags: response.routerResult?.keywords || [],
                            tagsSource: "ai"
                        }
                    });
                } catch (_srq) { /* SRQ is supplementary */ }
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

        // Always use editable title
        const displayTitle = result.aiGeneratedTitle || result.displayTitle || 'Untitled';
        const aiGenerated = !!result.aiGeneratedTitle;

        // Generate markdown preview
        const previewText = generateMarkdownPreviewText({
            title: displayTitle,
            url: window.location.href,
            pageTitle: document.title,
            domain: window.location.hostname,
            highlight: currentSelection.text.slice(0, 200) + (currentSelection.text.length > 200 ? '...' : ''),
            hasSummary: currentSelection.text.length > 500
        });

        modal.innerHTML = `
            <button class="atom-nlm-prompt-close">×</button>
            <div class="atom-nlm-prompt-header">
                <div class="atom-nlm-prompt-icon">${ICONS.notebook}</div>
                <div>
                    <div class="atom-nlm-prompt-title">${getMessage('nlm_prompt_save_title', 'Save to NotebookLM')}</div>
                    <div class="atom-nlm-prompt-subtitle">${currentSelection.text.length} ${getMessage('nlm_chars_selected', 'characters selected')}</div>
                </div>
            </div>
            <div class="atom-nlm-prompt-content">
                <div class="atom-nlm-prompt-topic">
                    <div class="atom-nlm-prompt-topic-label">${getMessage('nlm_notebook_title', 'Notebook Title')}</div>
                    <input type="text"
                           class="atom-nlm-prompt-topic-input"
                           id="atom-topic-name-input"
                           value="${escapeAttr(displayTitle)}"
                           placeholder="${getMessage('nlm_title_placeholder', 'Enter notebook name...')}"
                           autocomplete="off"
                           spellcheck="false">
                    ${aiGenerated ? `
                        <div class="atom-nlm-ai-status">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
                                <circle cx="12" cy="12" r="4"/>
                            </svg>
                            ${getMessage('nlm_ai_suggested', 'AI-suggested title')}
                        </div>
                    ` : `
                        <div class="atom-nlm-prompt-topic-hint">${getMessage('nlm_title_hint', 'Edit the title before saving')}</div>
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
                            <span class="atom-nlm-prompt-match-title">${getMessage('nlm_suggested_notebook', 'Suggested Notebook')}</span>
                        </div>
                        <div class="atom-nlm-prompt-match-notebook">${result.bestMatch.displayTitle}</div>
                        <div class="atom-nlm-prompt-match-score">${Math.round(matchScore * 100)}% match</div>
                    </div>
                ` : ''}
                <div class="atom-nlm-markdown-preview-label">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    ${getMessage('nlm_preview_label', 'Content Preview')}
                </div>
                <div class="atom-nlm-markdown-preview">${escapeHtmlContent(previewText)}</div>
            </div>
            <div class="atom-nlm-prompt-actions">
                ${hasMatch ? `
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-primary" data-action="use">
                        ${getMessage('nlm_use_notebook', 'Use This Notebook')}
                    </button>
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-secondary" data-action="create">
                        ${getMessage('nlm_create_new', 'Create New')}
                    </button>
                ` : `
                    <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-primary" data-action="create">
                        ${getMessage('nlm_create_notebook', 'Create Notebook')}
                    </button>
                `}
                <button class="atom-nlm-prompt-btn atom-nlm-prompt-btn-ghost" data-action="skip">
                    ${getMessage('nlm_cancel', 'Cancel')}
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

            // Always get title from input (mandatory editing)
            const input = document.querySelector('#atom-topic-name-input');
            let displayTitle = input?.value?.trim() || result.displayTitle || 'Untitled';

            // Generate topicKey from displayTitle
            let topicKey = displayTitle
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);

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
                    // Copy rich markdown to clipboard and open notebook
                    const richMarkdown = await formatRichMarkdown(displayTitle, currentSelection.text, response.summary);
                    await copyToClipboard(richMarkdown);
                    showToast(`${getMessage('nlm_copied_rich', 'Rich content copied!')}${savedMsg} ${getMessage('nlm_opening', 'Opening notebook...')}`, 'success');
                    setTimeout(() => {
                        window.open(response.notebookUrl, '_blank');
                    }, 500);
                } else if (action === 'create') {
                    // Copy rich markdown to clipboard
                    const richMarkdown = await formatRichMarkdown(displayTitle, currentSelection.text, response.summary);
                    await copyToClipboard(richMarkdown);
                    showToast(`${getMessage('nlm_copied_rich', 'Rich content copied!')}${savedMsg} ${getMessage('nlm_creating', 'Creating')} "${displayTitle}"...`, 'success');
                } else if (action === 'skip') {
                    showToast(getMessage('nlm_cancelled', 'Cancelled'), 'info');
                }
            }

            closePrompt();
        } catch (error) {
            console.error('[ATOM NLM] Action error:', error);
            // Handle extension context invalidated
            if (error.message?.includes('Extension context invalidated') ||
                error.message?.includes('Extension was updated') ||
                !chrome.runtime?.id) {
                closePrompt();
                showToast(getMessage('nlm_extension_updated', 'Extension updated. Please refresh the page.'), 'error');
            } else {
                showToast(getMessage('nlm_error_prefix', 'Error: ') + error.message, 'error');
            }
        }
    }

    /**
     * Close prompt modal
     */
    function closePrompt() {
        if (promptModal) {
            const overlay = promptModal;
            promptModal = null; // Prevent re-entry
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
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
            setTimeout(() => toast.remove(), 3000);
        }, 3000);
    }

    /**
     * Handle selection change
     */
    function handleSelectionChange() {
        if (isPromptOpen) return;

        // Don't hide if menu is expanded (user is interacting)
        if (floatingButton && floatingButton.classList.contains('expanded')) {
            return;
        }

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
        // Don't process if clicking inside the button
        if (floatingButton && floatingButton.contains(e.target)) {
            return;
        }
        if (floatingButton) {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                hideButton();
            } else {
                // If text is still selected but clicked outside bubble, collapse menu
                floatingButton.classList.remove('expanded');
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
