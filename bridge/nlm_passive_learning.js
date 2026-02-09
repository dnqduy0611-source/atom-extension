/**
 * NLM Passive Learning - Content script for NotebookLM pages
 * Detects when user opens/creates notebooks and prompts to save mapping
 *
 * This script should be injected into notebooklm.google.com pages
 */

(function () {
    "use strict";

    const CONFIG = {
        INITIAL_DELAY: 2000,      // Wait for page to stabilize
        CHECK_INTERVAL: 3000,     // Check every 3 seconds
        MAX_RETRIES: 10,          // Max retries to find notebook info
        PROMPT_COOLDOWN: 30000    // Don't show prompt again for 30s
    };

    let promptShownAt = 0;
    let checkInterval = null;
    let retryCount = 0;

    // i18n helper
    function getMessage(key, fallback = '') {
        try {
            const msg = chrome.i18n?.getMessage?.(key);
            return msg || fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Extract notebook info from current page
     * NotebookLM is a SPA, so we need to look for dynamic elements
     */
    function extractNotebookInfo() {
        const url = window.location.href;

        // Extract notebook ID from URL
        // URL format: https://notebooklm.google.com/notebook/NOTEBOOK_ID
        const match = url.match(/\/notebook\/([a-zA-Z0-9_-]+)/);
        const notebookId = match ? match[1] : null;

        if (!notebookId) {
            return null;
        }

        // Try multiple selectors to find notebook title
        // NotebookLM may use different elements
        const titleSelectors = [
            'h1',
            '[data-notebook-title]',
            '.notebook-title',
            '[aria-label*="notebook"]',
            'header h1',
            'main h1',
            // Material Design input for title
            'input[aria-label*="title"]',
            'input[placeholder*="Untitled"]'
        ];

        let notebookTitle = "";

        for (const selector of titleSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                const text = el.value || el.textContent || el.getAttribute('aria-label');
                if (text && text.trim() && text.length < 100) {
                    notebookTitle = text.trim();
                    break;
                }
            }
        }

        // Fallback: try document title
        if (!notebookTitle) {
            const docTitle = document.title || "";
            notebookTitle = docTitle
                .replace(" - NotebookLM", "")
                .replace("NotebookLM", "")
                .trim();
        }

        // Last fallback
        if (!notebookTitle || notebookTitle === "NotebookLM") {
            notebookTitle = "Untitled Notebook";
        }

        return {
            url: url,
            notebookId: notebookId,
            title: notebookTitle,
            ref: notebookId
        };
    }

    /**
     * Check if extension context is still valid
     */
    function isExtensionValid() {
        try {
            return !!chrome.runtime?.id;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if we have a pending topic that needs mapping
     */
    async function checkPendingTopic() {
        if (!isExtensionValid()) {
            console.log("[ATOM NLM] Extension context invalidated, stopping");
            return null;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: "NLM_TOPIC_GET_PENDING"
            });

            if (response && response.ok && response.pending) {
                console.log("[ATOM NLM] Found pending topic:", response.pending.displayTitle);
                return response.pending;
            }
        } catch (e) {
            if (e.message?.includes('Extension context invalidated')) {
                console.log("[ATOM NLM] Extension was reloaded, please refresh the page");
                // Stop all checking
                if (checkInterval) {
                    clearInterval(checkInterval);
                    checkInterval = null;
                }
            } else {
                console.log("[ATOM NLM] Could not check pending topic:", e.message);
            }
        }
        return null;
    }

    /**
     * Copy text to clipboard
     */
    async function copyToClipboard(text) {
        if (!text) return false;
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            } catch (e2) {
                console.error('[ATOM NLM] Copy failed:', e2);
                return false;
            }
        }
    }

    /**
     * Show passive learning prompt
     */
    async function showMappingPrompt(pendingTopic, notebookInfo) {
        // Check cooldown
        if (Date.now() - promptShownAt < CONFIG.PROMPT_COOLDOWN) {
            console.log("[ATOM NLM] Prompt cooldown active, skipping");
            return;
        }

        // Don't show if prompt already exists
        if (document.getElementById("atom-nlm-mapping-prompt")) {
            return;
        }

        promptShownAt = Date.now();

        console.log("[ATOM NLM] Showing mapping prompt for:", pendingTopic.displayTitle, "→", notebookInfo.title);

        // Get the selected text from pending topic context
        const selectedText = pendingTopic.context?.selection || "";

        // Auto-copy text to clipboard when prompt appears
        if (selectedText) {
            const copied = await copyToClipboard(selectedText);
            if (copied) {
                console.log("[ATOM NLM] Auto-copied text to clipboard:", selectedText.substring(0, 50) + "...");
            }
        }

        // Create and show prompt UI
        const container = createPromptUI(pendingTopic, notebookInfo, selectedText);
        document.body.appendChild(container);

        // Auto-focus save button
        setTimeout(() => {
            const saveBtn = container.querySelector('[data-action="save"]');
            if (saveBtn) saveBtn.focus();
        }, 100);
    }

    /**
     * Create prompt UI element
     */
    function createPromptUI(topic, notebook, selectedText = "") {
        const container = document.createElement("div");
        container.id = "atom-nlm-mapping-prompt";

        // Store selected text for copy button
        container.dataset.selectedText = selectedText;

        // Inject styles
        const style = document.createElement("style");
        style.textContent = `
            #atom-nlm-mapping-prompt {
                position: fixed;
                bottom: 24px;
                right: 24px;
                max-width: 380px;
                background: #050505;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(16, 185, 129, 0.1);
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: white;
                animation: atomSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes atomSlideIn {
                from { transform: translateY(20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            #atom-nlm-mapping-prompt * {
                box-sizing: border-box;
            }
            .atom-nlm-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }
            .atom-nlm-icon {
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #10B981, #059669);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
            }
            .atom-nlm-icon svg {
                width: 22px;
                height: 22px;
                color: white;
            }
            .atom-nlm-title {
                font-size: 16px;
                font-weight: 600;
                color: white;
            }
            .atom-nlm-subtitle {
                font-size: 12px;
                color: #a3a3a3;
                margin-top: 2px;
            }
            .atom-nlm-mapping {
                background: rgba(16, 185, 129, 0.05);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 10px;
                padding: 14px;
                margin-bottom: 16px;
            }
            .atom-nlm-mapping-row {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            .atom-nlm-mapping-label {
                color: #a3a3a3;
                font-size: 12px;
                margin-bottom: 4px;
            }
            .atom-nlm-mapping-value {
                color: #10B981;
                font-weight: 500;
            }
            .atom-nlm-mapping-arrow {
                color: #525252;
                margin: 8px 0;
            }
            .atom-nlm-mapping-notebook {
                color: white;
                font-weight: 500;
            }
            .atom-nlm-buttons {
                display: flex;
                gap: 10px;
            }
            .atom-nlm-btn {
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
            .atom-nlm-btn:hover {
                transform: translateY(-1px);
            }
            .atom-nlm-btn-primary {
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            }
            .atom-nlm-btn-primary:hover {
                background: linear-gradient(135deg, #34d399, #10B981);
            }
            .atom-nlm-btn-secondary {
                background: rgba(255, 255, 255, 0.05);
                color: #a3a3a3;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .atom-nlm-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
            .atom-nlm-close {
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                color: #525252;
                cursor: pointer;
                padding: 4px 8px;
                font-size: 18px;
                line-height: 1;
                border-radius: 4px;
            }
            .atom-nlm-close:hover {
                color: white;
                background: rgba(255,255,255,0.05);
            }
            .atom-nlm-reminder {
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.2);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 16px;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            .atom-nlm-reminder-icon {
                color: #fbbf24;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .atom-nlm-reminder-content {
                flex: 1;
            }
            .atom-nlm-reminder-title {
                color: #fbbf24;
                font-weight: 600;
                font-size: 13px;
                margin-bottom: 4px;
            }
            .atom-nlm-reminder-text {
                color: #d4d4d4;
                font-size: 12px;
                line-height: 1.4;
            }
            .atom-nlm-copy-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(16, 185, 129, 0.1);
                border: 1px solid rgba(16, 185, 129, 0.2);
                border-radius: 6px;
                padding: 8px 12px;
                color: #10B981;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 10px;
            }
            .atom-nlm-copy-btn:hover {
                background: rgba(16, 185, 129, 0.2);
                color: #34d399;
            }
            .atom-nlm-copy-btn.copied {
                background: rgba(34, 197, 94, 0.2);
                border-color: rgba(34, 197, 94, 0.3);
                color: #22c55e;
            }
            .atom-nlm-copy-btn svg {
                width: 14px;
                height: 14px;
            }
            
            /* v2 Styles */
            .atom-nlm-steps-guide {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .atom-nlm-step-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            }
            .atom-nlm-step-row:last-child { margin-bottom: 0; }
            .step-num {
                width: 20px;
                height: 20px;
                background: #10B981;
                border-radius: 50%;
                font-size: 11px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                color: black;
            }
            .step-text {
                font-size: 13px;
                color: #d0d0d0;
            }
            .highlight-text {
                color: #10B981;
                font-weight: 600;
            }
            .atom-nlm-action-row {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            .secondary-btn {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.1);
                color: #a3a3a3;
            }
            .secondary-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }
        `;
        container.appendChild(style);

        // Text preview (truncated)
        const textPreview = selectedText
            ? selectedText.substring(0, 150) + (selectedText.length > 150 ? '...' : '')
            : '';

        // Content
        container.innerHTML += `
            <button class="atom-nlm-close" aria-label="Close">×</button>
            <div class="atom-nlm-header">
                <div class="atom-nlm-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                </div>
                <div>
                    <div class="atom-nlm-title">Save this mapping?</div>
                    <div class="atom-nlm-subtitle">Remember for future exports</div>
                </div>
            </div>

            ${selectedText ? `
            
            <!-- v2: 3-Step Guide -->
            <div class="atom-nlm-steps-guide">
                <div class="atom-nlm-step-row">
                    <span class="step-num">1</span>
                    <span class="step-text">Click <strong class="highlight-text">Add source</strong> on the left</span>
                </div>
                <div class="atom-nlm-step-row">
                    <span class="step-num">2</span>
                    <span class="step-text">Select <strong class="highlight-text">Copied text</strong> option</span>
                </div>
                <div class="atom-nlm-step-row">
                    <span class="step-num">3</span>
                    <span class="step-text">Paste (Ctrl+V) into the box</span>
                </div>
            </div>

            <div class="atom-nlm-reminder">
                <div class="atom-nlm-reminder-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <div class="atom-nlm-reminder-content">
                    <div class="atom-nlm-reminder-title">Ready to Paste</div>
                    <div class="atom-nlm-reminder-text">Content is in your clipboard. Follow the steps above to add it as a source.</div>
                    
                    <div class="atom-nlm-action-row">
                        <button class="atom-nlm-copy-btn" data-action="copy">
                            <span>📋 Copy Text</span>
                        </button>
                        ${topic.context?.url ? `
                        <button class="atom-nlm-copy-btn secondary-btn" data-action="copy-link">
                            <span>🔗 Copy Link</span>
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="atom-nlm-mapping">
                <div class="atom-nlm-mapping-label">Topic</div>
                <div class="atom-nlm-mapping-value">${escapeHtml(topic.displayTitle || topic.topicKey)}</div>
                <div class="atom-nlm-mapping-arrow">↓</div>
                <div class="atom-nlm-mapping-label">Notebook</div>
                <div class="atom-nlm-mapping-notebook">${escapeHtml(notebook.title)}</div>
            </div>
            <div class="atom-nlm-buttons">
                <button class="atom-nlm-btn atom-nlm-btn-primary" data-action="save">
                    Yes, Remember
                </button>
                <button class="atom-nlm-btn atom-nlm-btn-secondary" data-action="skip">
                    No Thanks
                </button>
            </div>
        `;

        // Event listeners
        container.querySelector('.atom-nlm-close').onclick = () => {
            container.remove();
        };

        // Copy button handler (Text)
        const copyBtn = container.querySelector('[data-action="copy"]');
        if (copyBtn && selectedText) {
            copyBtn.onclick = async () => {
                const success = await copyToClipboard(selectedText);
                if (success) {
                    copyBtn.classList.add('copied');
                    copyBtn.querySelector('span').textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.querySelector('span').textContent = '📋 Copy Text';
                    }, 2000);
                }
            };
        }

        // Copy button handler (Link)
        const copyLinkBtn = container.querySelector('[data-action="copy-link"]');
        if (copyLinkBtn && topic.context?.url) {
            copyLinkBtn.onclick = async () => {
                const success = await copyToClipboard(topic.context.url);
                if (success) {
                    copyLinkBtn.classList.add('copied');
                    copyLinkBtn.querySelector('span').textContent = 'Copied!';
                    setTimeout(() => {
                        copyLinkBtn.classList.remove('copied');
                        copyLinkBtn.querySelector('span').textContent = '🔗 Copy Link';
                    }, 2000);
                }
            };
        }

        // Trigger visual blink on "Add source" button if found
        highlightAddSourceButton();

        container.querySelector('[data-action="save"]').onclick = async () => {
            try {
                if (!isExtensionValid()) {
                    showToast("Extension updated. Please refresh.");
                    container.remove();
                    return;
                }
                await chrome.runtime.sendMessage({
                    type: "NLM_TOPIC_ACTION",
                    action: "save",
                    data: {
                        topicKey: topic.topicKey,
                        displayTitle: topic.displayTitle,
                        keywords: topic.keywords || [],
                        notebookRef: notebook.ref,
                        notebookUrl: notebook.url,
                        source: "learned"
                    }
                });
                showToast("Mapping saved! ✓");
            } catch (e) {
                console.error("[ATOM NLM] Save error:", e);
                if (e.message?.includes('Extension context invalidated')) {
                    showToast("Extension updated. Please refresh.");
                } else {
                    showToast("Failed to save mapping");
                }
            }
            container.remove();
        };

        container.querySelector('[data-action="skip"]').onclick = async () => {
            try {
                if (isExtensionValid()) {
                    await chrome.runtime.sendMessage({
                        type: "NLM_TOPIC_ACTION",
                        action: "skip"
                    });
                }
            } catch (e) {
                // Ignore
            }
            container.remove();
        };

        return container;
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    /**
     * Show toast notification
     */
    function showToast(message) {
        const toast = document.createElement("div");
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(0);
            background: #1a1a2e;
            border: 1px solid rgba(124, 58, 237, 0.3);
            border-radius: 8px;
            padding: 12px 20px;
            color: #e0e0e0;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 16px rgba(0,0,0,0.3);
            z-index: 2147483647;
            animation: atomToastIn 0.3s ease-out;
        `;
        toast.textContent = message;

        const style = document.createElement("style");
        style.textContent = `
            @keyframes atomToastIn {
                from { transform: translateX(-50%) translateY(20px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        toast.appendChild(style);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transition = "opacity 0.3s";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Main check function - runs periodically
     */
    async function checkAndPrompt() {
        // Check extension validity first
        if (!isExtensionValid()) {
            console.log("[ATOM NLM] Extension context invalidated, stopping checks");
            return false;
        }

        // Only run on notebook pages
        if (!window.location.href.includes("/notebook/")) {
            console.log("[ATOM NLM] Not on notebook page, skipping");
            return false;
        }

        // Check for pending topic
        const pendingTopic = await checkPendingTopic();
        if (!pendingTopic) {
            console.log("[ATOM NLM] No pending topic");
            return false;
        }

        // Extract notebook info
        const notebookInfo = extractNotebookInfo();
        if (!notebookInfo || !notebookInfo.notebookId) {
            retryCount++;
            console.log(`[ATOM NLM] Could not extract notebook info (retry ${retryCount}/${CONFIG.MAX_RETRIES})`);
            return retryCount < CONFIG.MAX_RETRIES; // Continue checking if under max retries
        }

        // Show prompt
        await showMappingPrompt(pendingTopic, notebookInfo);

        // Stop checking after showing prompt
        return false;
    }

    /**
     * Start periodic checking
     */
    function startChecking() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }

        retryCount = 0;

        // Initial check after delay
        setTimeout(async () => {
            const shouldContinue = await checkAndPrompt();

            if (shouldContinue) {
                // Start periodic checking
                checkInterval = setInterval(async () => {
                    const shouldContinue = await checkAndPrompt();
                    if (!shouldContinue && checkInterval) {
                        clearInterval(checkInterval);
                        checkInterval = null;
                    }
                }, CONFIG.CHECK_INTERVAL);
            }
        }, CONFIG.INITIAL_DELAY);
    }

    /**
     * Handle navigation (SPA)
     */
    function setupNavigationListener() {
        let lastUrl = window.location.href;

        // Use MutationObserver to detect SPA navigation
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                console.log("[ATOM NLM] URL changed:", lastUrl, "→", window.location.href);
                lastUrl = window.location.href;

                // Reset and start checking again
                if (checkInterval) {
                    clearInterval(checkInterval);
                    checkInterval = null;
                }
                promptShownAt = 0;
                startChecking();
            }
        });

        observer.observe(document.body, { subtree: true, childList: true });

        // Also listen to popstate for back/forward navigation
        window.addEventListener('popstate', () => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                startChecking();
            }
        });
    }

    /**
     * Initialize
     */
    function init() {
        console.log("[ATOM NLM] Passive learning script initializing...");

        setupNavigationListener();

        // Start checking when page is ready
        if (document.readyState === "complete") {
            startChecking();
        } else {
            window.addEventListener("load", startChecking);
        }

        console.log("[ATOM NLM] Passive learning script ready");
    }

    /**
     * Visual helper to find the "Add Source" button
     */
    function highlightAddSourceButton() {
        const potentialButtons = [
            'button[aria-label*="Add source"]',
            'button[aria-label*="Thêm nguồn"]',
            '.add-source-button',
            // Generic fallback - look for plus icon near left nav
            'mat-icon[data-mat-icon-name="add_box"]',
            'button:has(mat-icon)' // Less specific, be careful
        ];

        let targetBtn = null;
        for (const selector of potentialButtons) {
            try {
                const els = document.querySelectorAll(selector);
                for (const el of els) {
                    // Simple heuristic: likely on the left side
                    const rect = el.getBoundingClientRect();
                    if (rect.left < 400 && rect.top > 50) {
                        targetBtn = el.closest('button') || el;
                        break;
                    }
                }
                if (targetBtn) break;
            } catch (e) { }
        }

        if (targetBtn) {
            targetBtn.style.transition = 'all 0.5s ease';
            targetBtn.style.boxShadow = '0 0 0 2px #7c3aed, 0 0 20px rgba(124, 58, 237, 0.5)';
            targetBtn.style.zIndex = '1000';

            // Remove highlight after 10s
            setTimeout(() => {
                targetBtn.style.boxShadow = '';
                targetBtn.style.zIndex = '';
            }, 10000);
        }
    }

    // SRQ banner on NotebookLM page
    async function checkAndShowSRQBanner() {
        try {
            const response = await chrome.runtime.sendMessage({ type: "SRQ_GET_PENDING_COUNT" });
            const pending = response?.ok ? Number(response?.stats?.pending || 0) : 0;
            if (!pending) return;

            const lastDismiss = Number(sessionStorage.getItem("srq_banner_dismiss") || 0);
            if (lastDismiss && Date.now() - lastDismiss < 30 * 60 * 1000) return;
            if (document.getElementById("atom-srq-banner")) return;

            const banner = document.createElement("div");
            banner.id = "atom-srq-banner";
            banner.className = "atom-srq-nlm-banner";
            const bannerText = getMessage('srq_nlm_banner', `${pending} highlights ready to save`).replace('$1', pending);
            const exportText = getMessage('srq_nlm_export_current', 'Save all to this notebook');
            const sidebarText = getMessage('srq_nlm_open_sidepanel', 'Open in sidebar');

            banner.innerHTML = `
                <span class="srq-banner-text">📋 ${bannerText}</span>
                <button id="atom-srq-export-current">${escapeHtml(exportText)}</button>
                <button id="atom-srq-open-sidepanel">${escapeHtml(sidebarText)}</button>
                <button id="atom-srq-dismiss-banner" class="srq-banner-close" aria-label="Close">✕</button>
            `;

            const style = document.createElement("style");
            style.textContent = `
                #atom-srq-banner{position:fixed;top:0;left:0;right:0;z-index:2147483646;background:linear-gradient(135deg,#065F46,#064E3B);color:#D1FAE5;padding:10px 14px;display:flex;align-items:center;gap:10px;font:13px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.28)}
                #atom-srq-banner .srq-banner-text{flex:1}
                #atom-srq-banner button{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;padding:6px 10px;border-radius:6px;cursor:pointer}
                #atom-srq-banner .srq-banner-close{background:transparent;border:none;color:rgba(255,255,255,.75);font-size:16px;padding:2px 6px}
            `;
            banner.appendChild(style);
            document.body.prepend(banner);

            document.getElementById("atom-srq-export-current")?.addEventListener("click", async () => {
                try {
                    const notebook = extractNotebookInfo();
                    const notebookRef = notebook?.ref || "Inbox";
                    const batchesRes = await chrome.runtime.sendMessage({ type: "SRQ_GET_BATCHES" });
                    const batches = Array.isArray(batchesRes?.batches) ? batchesRes.batches : [];
                    for (const batch of batches) {
                        await chrome.runtime.sendMessage({
                            type: "SRQ_EXPORT_BATCH",
                            topicKey: batch.topicKey,
                            notebookRef
                        });
                    }
                    banner.remove();
                } catch {}
            });

            document.getElementById("atom-srq-open-sidepanel")?.addEventListener("click", () => {
                chrome.runtime.sendMessage({ type: "ATOM_OPEN_SIDEPANEL" }).catch(() => {});
            });
            document.getElementById("atom-srq-dismiss-banner")?.addEventListener("click", () => {
                banner.remove();
                sessionStorage.setItem("srq_banner_dismiss", String(Date.now()));
            });
        } catch {
            // Ignore when background is unavailable
        }
    }

    // Initialize
    init();
    setTimeout(checkAndShowSRQBanner, CONFIG.INITIAL_DELAY + 1000);
})();
