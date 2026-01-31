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
                background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
                border: 1px solid rgba(124, 58, 237, 0.3);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(124, 58, 237, 0.1);
                z-index: 2147483647;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #e0e0e0;
                animation: atomSlideIn 0.3s ease-out;
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
                background: linear-gradient(135deg, #7c3aed, #5b21b6);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .atom-nlm-icon svg {
                width: 22px;
                height: 22px;
                color: white;
            }
            .atom-nlm-title {
                font-size: 16px;
                font-weight: 600;
                color: #f0f0f0;
            }
            .atom-nlm-subtitle {
                font-size: 12px;
                color: #8a8a9a;
                margin-top: 2px;
            }
            .atom-nlm-mapping {
                background: rgba(124, 58, 237, 0.1);
                border: 1px solid rgba(124, 58, 237, 0.2);
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
                color: #8a8a9a;
                font-size: 12px;
                margin-bottom: 4px;
            }
            .atom-nlm-mapping-value {
                color: #a78bfa;
                font-weight: 500;
            }
            .atom-nlm-mapping-arrow {
                color: #6a6a8a;
                margin: 8px 0;
            }
            .atom-nlm-mapping-notebook {
                color: #22c55e;
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
                background: linear-gradient(135deg, #7c3aed, #5b21b6);
                color: white;
            }
            .atom-nlm-btn-primary:hover {
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
            }
            .atom-nlm-btn-secondary {
                background: rgba(255, 255, 255, 0.05);
                color: #a0a0a0;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .atom-nlm-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #c0c0c0;
            }
            .atom-nlm-close {
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                color: #6a6a8a;
                cursor: pointer;
                padding: 4px 8px;
                font-size: 18px;
                line-height: 1;
                border-radius: 4px;
            }
            .atom-nlm-close:hover {
                color: #a0a0a0;
                background: rgba(255,255,255,0.05);
            }
            .atom-nlm-reminder {
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.3);
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
            .atom-nlm-text-preview {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 6px;
                padding: 10px;
                margin-top: 10px;
                max-height: 80px;
                overflow: hidden;
                position: relative;
            }
            .atom-nlm-text-preview-content {
                font-size: 12px;
                color: #a0a0a0;
                line-height: 1.4;
                font-style: italic;
            }
            .atom-nlm-text-preview-fade {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 30px;
                background: linear-gradient(transparent, rgba(0,0,0,0.3));
            }
            .atom-nlm-copy-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: rgba(124, 58, 237, 0.2);
                border: 1px solid rgba(124, 58, 237, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                color: #a78bfa;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.2s;
                margin-top: 10px;
            }
            .atom-nlm-copy-btn:hover {
                background: rgba(124, 58, 237, 0.3);
                color: #c4b5fd;
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
            <div class="atom-nlm-reminder">
                <div class="atom-nlm-reminder-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <div class="atom-nlm-reminder-content">
                    <div class="atom-nlm-reminder-title">Don't forget to paste!</div>
                    <div class="atom-nlm-reminder-text">Your text has been copied to clipboard. Paste it into this notebook (Ctrl+V / Cmd+V).</div>
                    <div class="atom-nlm-text-preview">
                        <div class="atom-nlm-text-preview-content">"${escapeHtml(textPreview)}"</div>
                        <div class="atom-nlm-text-preview-fade"></div>
                    </div>
                    <button class="atom-nlm-copy-btn" data-action="copy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy text again</span>
                    </button>
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

        // Copy button handler
        const copyBtn = container.querySelector('[data-action="copy"]');
        if (copyBtn && selectedText) {
            copyBtn.onclick = async () => {
                const success = await copyToClipboard(selectedText);
                if (success) {
                    copyBtn.classList.add('copied');
                    copyBtn.querySelector('span').textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.querySelector('span').textContent = 'Copy text again';
                    }, 2000);
                }
            };
        }

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

    // Initialize
    init();
})();
