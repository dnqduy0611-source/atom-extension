/**
 * sp_export.js — Export System + NLM Bridge
 * Phase 5 of Sidepanel Module Split
 *
 * Handles: Save to Knowledge (NLM), Quick Save, Bulk Export,
 * Export Dialog (Markdown/JSON/Text), Legacy Session Export,
 * End Session flow.
 *
 * DOES NOT handle: Chat logic, thread CRUD, insight generation.
 *
 * Dependencies (read from window.SP):
 *   SP.threads, SP.activeThreadId, SP.parkingLot, SP.pageContext,
 *   SP.currentDomain, SP.sessionStartTime, SP.elements,
 *   SP.API_CONFIG, SP.getMessage, SP.showToast, SP.getApiKey,
 *   SP.saveThreadsToStorage, SP.renderThreadList, SP.updateSessionStats,
 *   SP.saveParkingLot, SP.renderParkingLot,
 *   SP.checkAndShowContextualTooltip
 *
 * External:
 *   chrome.runtime.sendMessage (NLM bridge, SRQ cards)
 *   window.FlashcardDeck (maybeAddInsightReviewCard)
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Export] SP not found'); return; }

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }

    // ===========================
    // NLM Helpers
    // ===========================
    function getNlmExportFailureToast(reason) {
        const code = String(reason || '').toLowerCase();
        if (code === 'dedupe') {
            return {
                message: getMessage('sp_toast_already_saved', 'Already saved today'),
                type: 'info'
            };
        }
        if (code === 'disabled') {
            return {
                message: getMessage('sp_nlm_disabled', 'NotebookLM export is disabled'),
                type: 'error'
            };
        }
        if (code === 'pii_warning') {
            return {
                message: getMessage('sp_nlm_pii_blocked', 'Sensitive data detected. Export blocked.'),
                type: 'error'
            };
        }
        if (code === 'cloud_export_disabled') {
            return {
                message: getMessage('sp_nlm_cloud_disabled', 'Cloud Export disabled in Settings.'),
                type: 'warning'
            };
        }
        return {
            message: getMessage('sp_error_save', 'Error saving'),
            type: 'error'
        };
    }

    // ===========================
    // Insight Review Card
    // ===========================
    async function maybeAddInsightReviewCard(thread) {
        if (!window.FlashcardDeck) return;
        if (!thread) return;

        const insightText = String(thread.refinedInsight || '').trim();
        if (!insightText) return;

        try {
            const cards = await window.FlashcardDeck.getAllCards();
            const exists = cards.some(card => card?.sourceInsightId === thread.id);
            if (exists) return;

            const pageContext = SP.pageContext;
            const title = thread.highlight?.title || pageContext?.title || '';
            const isVi = navigator.language.startsWith('vi');
            const front = title
                ? (isVi ? `Y chinh tu "${title}" la gi?` : `What is the key insight from "${title}"?`)
                : (isVi ? 'Y chinh la gi?' : 'What is the key insight?');

            const card = window.FlashcardDeck.createFlashcard({
                type: window.FlashcardDeck.CARD_TYPES.INSIGHT,
                front,
                back: insightText,
                sourceInsightId: thread.id,
                sourceUrl: thread.highlight?.url || pageContext?.url || '',
                sourceTitle: title
            });
            await window.FlashcardDeck.saveCard(card);
        } catch (e) {
            console.warn('[Retention] Failed to add insight card:', e);
        }
    }

    // ===========================
    // NLM Bridge — Quick Save
    // ===========================
    /**
     * Quick Save - Save highlight to NotebookLM without requiring insight
     * This allows users to save immediately after highlighting
     */
    async function quickSaveHighlight() {
        const threads = SP.threads || [];
        const activeThreadId = SP.activeThreadId;
        const pageContext = SP.pageContext;

        if (!activeThreadId) {
            showToast(getMessage('sp_no_highlight', 'No highlight selected'), 'warning');
            return;
        }

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        try {
            // Build note object for NLM (without requiring insight)
            const note = {
                id: thread.id,
                url: thread.highlight?.url || pageContext?.url || '',
                title: thread.highlight?.title || pageContext?.title || '',
                selection: thread.highlight?.text || '',
                atomicThought: thread.refinedInsight || '', // May be empty
                aiDiscussionSummary: thread.messages.length > 0
                    ? thread.messages.map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n')
                    : '',
                quickSave: true, // Flag indicating quick save without insight
                created_at: thread.createdAt,
                command: 'sidepanel_quick_save'
            };

            // Send to background for NLM processing (also saves to local memory)
            const response = await chrome.runtime.sendMessage({
                type: 'ATOM_SAVE_THREAD_TO_NLM',
                payload: note
            });

            // Treat as success if NLM export worked OR data was saved to local memory
            const saved = response?.ok || response?.savedToMemory;

            if (saved) {
                // Mark thread state
                if (response?.ok) {
                    thread.nlmExported = true;
                    thread.nlmExportedAt = Date.now();
                }
                if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();
                if (SP.renderThreadList) SP.renderThreadList();
                SP.checkAndShowContextualTooltip?.('first_save');

                // Show appropriate toast message
                const msg = thread.refinedInsight
                    ? getMessage('sp_toast_saved', 'Saved to Knowledge!')
                    : getMessage('sp_toast_quick_saved', 'Highlight saved!');
                showToast(msg, 'success');
            } else {
                const failure = getNlmExportFailureToast(response?.reason || response?.error);
                showToast(failure.message, failure.type);
            }

            // Always create SRQ card so Saved tab shows this highlight
            // (independent of NLM export success)
            try {
                const srqRes = await chrome.runtime.sendMessage({
                    type: 'SRQ_CREATE_CARD',
                    payload: {
                        url: thread.highlight?.url || pageContext?.url || '',
                        title: thread.highlight?.title || pageContext?.title || '',
                        domain: new URL(thread.highlight?.url || pageContext?.url || 'https://unknown').hostname,
                        selectedText: thread.highlight?.text || '',
                        command: 'sidepanel_quick_save',
                        atomicThought: thread.refinedInsight || ''
                    }
                });
                console.log('[QuickSave] SRQ card result:', srqRes);
            } catch (srqErr) {
                console.warn('[QuickSave] SRQ card creation failed:', srqErr);
            }

        } catch (e) {
            console.error('[QuickSave] Error:', e);
            showToast(getMessage('sp_error_save', 'Error saving'), 'error');
        }
    }

    // ===========================
    // NLM Bridge — Save Thread
    // ===========================
    /**
     * Save current thread to NotebookLM via Bridge
     */
    async function saveThreadToNLM() {
        const threads = SP.threads || [];
        const activeThreadId = SP.activeThreadId;
        const pageContext = SP.pageContext;

        const thread = threads.find(t => t.id === activeThreadId);
        if (!thread) return;

        // Build discussion summary from messages
        let discussionSummary = '';
        if (thread.messages.length > 0) {
            discussionSummary = thread.messages.map(m =>
                `${m.role === 'user' ? '[User]' : '[AI]'} ${m.content.slice(0, 500)}`
            ).join('\n\n');
        }

        // Build note object for bridge service
        const note = {
            id: thread.id,
            url: thread.highlight?.url || pageContext?.url || '',
            title: thread.highlight?.title || pageContext?.title || '',
            selection: thread.highlight?.text || '',
            atomicThought: thread.refinedInsight || '',
            aiDiscussionSummary: discussionSummary,
            refinedInsight: thread.refinedInsight || '',
            connections: thread.connections || [],
            created_at: thread.createdAt,
            command: 'sidepanel_thread',
            tags: []
        };

        try {
            // Send to background for NLM processing
            const response = await chrome.runtime.sendMessage({
                type: 'ATOM_SAVE_THREAD_TO_NLM',
                payload: note
            });

            if (response?.ok) {
                thread.status = 'saved';
                thread.nlmExported = true;
                thread.nlmExportedAt = Date.now();
                if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();
                if (SP.renderThreadList) SP.renderThreadList();
                if (SP.updateSessionStats) SP.updateSessionStats();

                await maybeAddInsightReviewCard(thread);
                showToast(getMessage('sp_toast_saved', 'Saved to Knowledge!'), 'success');
                SP.checkAndShowContextualTooltip?.('first_save');
            } else {
                if (response?.savedToMemory) {
                    await maybeAddInsightReviewCard(thread);
                    showToast(getMessage('sp_toast_saved_local', 'Saved locally. Cloud export blocked.'), 'info');
                    SP.checkAndShowContextualTooltip?.('first_save');
                } else {
                    const failure = getNlmExportFailureToast(response?.reason || response?.error);
                    showToast(failure.message, failure.type);
                }
            }

            // Always create SRQ card so Saved tab shows this highlight
            // (independent of NLM export success)
            try {
                const srqRes = await chrome.runtime.sendMessage({
                    type: 'SRQ_CREATE_CARD',
                    payload: {
                        url: thread.highlight?.url || pageContext?.url || '',
                        title: thread.highlight?.title || pageContext?.title || '',
                        domain: new URL(thread.highlight?.url || pageContext?.url || 'https://unknown').hostname,
                        selectedText: thread.highlight?.text || '',
                        command: 'sidepanel_thread',
                        atomicThought: thread.refinedInsight || ''
                    }
                });
                console.log('[SaveToNLM] SRQ card result:', srqRes);
            } catch (srqErr) {
                console.warn('[SaveToNLM] SRQ card creation failed:', srqErr);
            }
        } catch (e) {
            console.error('[NLM] Save error:', e);
            showToast(getMessage('sp_nlm_save_error', 'Error saving to NotebookLM'), 'error');
        }
    }

    // ===========================
    // NLM Bridge — Export All
    // ===========================
    /**
     * Export all threads to NotebookLM
     */
    async function exportAllToNLM() {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;

        if (threads.length === 0) {
            alert('No threads to export.');
            return;
        }

        const unsavedThreads = threads.filter(t => t.status !== 'saved');
        if (unsavedThreads.length === 0) {
            alert('All threads already saved.');
            return;
        }

        const confirmMsg = getMessage('sp_confirm_export_all', 'Save all chats to Knowledge?');
        const confirm = window.confirm(
            `${confirmMsg}\n(${unsavedThreads.length} chats)`
        );
        if (!confirm) return;

        showExportAllLoading();

        let successCount = 0;
        let failCount = 0;

        for (const thread of unsavedThreads) {
            try {
                const note = {
                    id: thread.id,
                    url: thread.highlight?.url || pageContext?.url || '',
                    title: thread.highlight?.title || pageContext?.title || '',
                    selection: thread.highlight?.text || '',
                    atomicThought: thread.refinedInsight || '',
                    aiDiscussionSummary: thread.messages.length > 0 ?
                        thread.messages.map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n') : '',
                    refinedInsight: thread.refinedInsight || '',
                    connections: thread.connections || [],
                    created_at: thread.createdAt,
                    command: 'sidepanel_bulk_export'
                };

                const response = await chrome.runtime.sendMessage({
                    type: 'ATOM_SAVE_THREAD_TO_NLM',
                    payload: note
                });

                if (response?.ok) {
                    thread.status = 'saved';
                    thread.nlmExported = true;
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
        }

        if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();
        if (SP.renderThreadList) SP.renderThreadList();
        if (SP.updateSessionStats) SP.updateSessionStats();
        hideExportAllLoading();

        showToast(`Exported: ${successCount} success, ${failCount} failed`,
            failCount === 0 ? 'success' : 'warning');
        if (successCount > 0) {
            SP.checkAndShowContextualTooltip?.('first_save');
        }
    }

    // ===========================
    // Export All Loading UI
    // ===========================
    function showExportAllLoading() {
        const btn = document.getElementById('btn-export-all-nlm');
        if (btn) {
            btn.disabled = true;
            const exportingMsg = getMessage('sp_exporting', 'Exporting...');
            btn.innerHTML = `<span class="btn-spinner"></span> ${exportingMsg}`;
        }
    }

    function hideExportAllLoading() {
        const btn = document.getElementById('btn-export-all-nlm');
        if (btn) {
            btn.disabled = false;
            const saveAllLabel = getMessage('sp_btn_save_all_knowledge', 'Save All to Knowledge');
            btn.innerHTML = saveAllLabel;
        }
    }

    // ===========================
    // Session Summary (AI)
    // ===========================
    async function generateSessionSummary() {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;
        const apiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));
        if (!apiKey || threads.length === 0) return null;

        const allHighlights = threads.map((t, idx) =>
            `[${idx + 1}] "${t.highlight?.text?.slice(0, 300) || 'N/A'}"`
        ).join('\n\n');

        const prompt = `Summarize this reading session. The user highlighted these passages from "${pageContext?.title || 'a web page'}":

${allHighlights}

Provide:
1. Main themes/topics discovered (2-3 bullet points)
2. Key insights from the session (2-3 bullet points)
3. Suggested next steps or questions to explore

Be concise. Respond in ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}.`;

        try {
            const cfg = SP.API_CONFIG || {};
            const url = `${cfg.API_BASE}/${cfg.MODEL_NAME}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 }
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error('[Session] Summary error:', e);
            return null;
        }
    }

    // ===========================
    // Export Dialog & Multiple Formats
    // ===========================
    function showExportDialog() {
        const threads = SP.threads || [];
        if (threads.length === 0 && (SP.parkingLot || []).length === 0) {
            showToast(getMessage('sp_export_empty', 'Nothing to export'), 'info');
            return;
        }

        // Remove existing dialog
        document.getElementById('export-dialog')?.remove();

        const dialog = document.createElement('div');
        dialog.id = 'export-dialog';
        dialog.className = 'sp-welcome-overlay';

        const dialogTitle = getMessage('sp_export_title', 'Download Notes');
        const formatLabel = getMessage('sp_export_format', 'Format:');
        const contentLabel = getMessage('sp_export_content', 'Include:');
        const btnCancel = getMessage('sp_export_cancel', 'Cancel');
        const btnExport = getMessage('sp_export_download', 'Download');

        dialog.innerHTML = `
            <div class="sp-export-card">
                <div class="sp-export-header">
                    <h3>${dialogTitle}</h3>
                </div>

                <div class="sp-export-body">
                    <div class="sp-export-section">
                        <label class="sp-export-label">${formatLabel}</label>
                        <div class="sp-export-formats">
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="markdown" checked>
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">MD</span>
                                    <span class="sp-format-name">Markdown</span>
                                    <span class="sp-format-ext">.md</span>
                                </span>
                            </label>
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="json">
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">{}</span>
                                    <span class="sp-format-name">JSON</span>
                                    <span class="sp-format-ext">.json</span>
                                </span>
                            </label>
                            <label class="sp-format-option">
                                <input type="radio" name="export-format" value="text">
                                <span class="sp-format-label">
                                    <span class="sp-format-icon">TXT</span>
                                    <span class="sp-format-name">Plain Text</span>
                                    <span class="sp-format-ext">.txt</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div class="sp-export-section">
                        <label class="sp-export-label">${contentLabel}</label>
                        <div class="sp-export-options">
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-insights" checked>
                                <span>${getMessage('sp_export_opt_insights', 'Key Insights')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-notes" checked>
                                <span>${getMessage('sp_export_opt_notes', 'Quick Notes')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-chat">
                                <span>${getMessage('sp_export_opt_chat', 'Full Chat History')}</span>
                            </label>
                            <label class="sp-checkbox-option">
                                <input type="checkbox" id="export-source" checked>
                                <span>${getMessage('sp_export_opt_source', 'Source Info')}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="sp-export-footer">
                    <button class="sp-welcome-btn secondary" id="btn-export-cancel">${btnCancel}</button>
                    <button class="sp-welcome-btn primary" id="btn-export-confirm">${btnExport}</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        document.getElementById('btn-export-cancel')?.addEventListener('click', () => {
            closeExportDialog();
        });

        document.getElementById('btn-export-confirm')?.addEventListener('click', () => {
            const format = document.querySelector('input[name="export-format"]:checked')?.value || 'markdown';
            const options = {
                insights: document.getElementById('export-insights')?.checked,
                notes: document.getElementById('export-notes')?.checked,
                chat: document.getElementById('export-chat')?.checked,
                source: document.getElementById('export-source')?.checked
            };
            closeExportDialog();
            exportWithFormat(format, options);
        });

        // Close on background click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeExportDialog();
            }
        });
    }

    function closeExportDialog() {
        const dialog = document.getElementById('export-dialog');
        if (dialog) {
            dialog.classList.add('hiding');
            setTimeout(() => dialog.remove(), 200);
        }
    }

    // ===========================
    // Format Routing
    // ===========================
    async function exportWithFormat(format, options) {
        showToast(getMessage('sp_exporting', 'Exporting...'), 'info');

        const sessionDuration = Math.floor((Date.now() - (SP.sessionStartTime || Date.now())) / 60000);
        const exportDate = new Date().toISOString().split('T')[0];
        const fileName = `reading-notes-${exportDate}`;

        let content = '';
        let mimeType = '';
        let extension = '';

        switch (format) {
            case 'markdown':
                content = await generateMarkdownExport(options, sessionDuration, exportDate);
                mimeType = 'text/markdown';
                extension = 'md';
                break;
            case 'json':
                content = generateJsonExport(options, sessionDuration);
                mimeType = 'application/json';
                extension = 'json';
                break;
            case 'text':
                content = generateTextExport(options, sessionDuration, exportDate);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
        }

        downloadFile(content, `${fileName}.${extension}`, mimeType);
        showToast(getMessage('sp_export_success', 'Downloaded!'), 'success');
    }

    // ===========================
    // Format Generators
    // ===========================
    async function generateMarkdownExport(options, sessionDuration, exportDate) {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;

        let md = `# Reading Session: ${pageContext?.title || 'Unknown Page'}\n\n`;

        if (options.source) {
            md += `**URL:** ${pageContext?.url || 'N/A'}\n`;
            md += `**Date:** ${exportDate}\n`;
            md += `**Duration:** ${sessionDuration} minutes\n`;
            md += `**Highlights:** ${threads.length}\n\n`;
            md += `---\n\n`;
        }

        // Key Insights
        if (options.insights) {
            const insightThreads = threads.filter(t => t.refinedInsight);
            if (insightThreads.length > 0) {
                md += `## Key Insights\n\n`;
                insightThreads.forEach((t, i) => {
                    md += `${i + 1}. ${t.refinedInsight}\n`;
                });
                md += `\n`;
            }
        }

        // Quick Notes
        if (options.notes && (SP.parkingLot || []).length > 0) {
            md += `## Quick Notes\n\n`;
            (SP.parkingLot || []).forEach((note, i) => {
                md += `- ${note.text}\n`;
            });
            md += `\n`;
        }

        // Full Chat History
        if (options.chat) {
            md += `## Discussions\n\n`;
            threads.forEach((thread, idx) => {
                md += `### ${idx + 1}. Highlight\n\n`;
                md += `> ${thread.highlight?.text || 'N/A'}\n\n`;

                if (thread.messages && thread.messages.length > 0) {
                    thread.messages.forEach(msg => {
                        const role = msg.role === 'user' ? '**You:**' : '**AI:**';
                        md += `${role} ${msg.content}\n\n`;
                    });
                }
                md += `---\n\n`;
            });
        }

        md += `\n---\n*Exported from ATOM Active Reading*\n`;

        return md;
    }

    function generateJsonExport(options, sessionDuration) {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;

        const exportData = {
            meta: {
                exportedAt: new Date().toISOString(),
                sessionDuration: sessionDuration,
                version: '2.0'
            },
            source: options.source ? {
                url: pageContext?.url || null,
                title: pageContext?.title || null,
                domain: SP.currentDomain
            } : undefined,
            insights: options.insights ? threads
                .filter(t => t.refinedInsight)
                .map(t => ({
                    insight: t.refinedInsight,
                    sourceText: t.highlight?.text?.slice(0, 200),
                    createdAt: t.createdAt
                })) : undefined,
            notes: options.notes ? (SP.parkingLot || []).map(n => ({
                text: n.text,
                createdAt: n.createdAt
            })) : undefined,
            threads: options.chat ? threads.map(t => ({
                id: t.id,
                highlight: t.highlight?.text,
                insight: t.refinedInsight,
                status: t.status,
                messages: t.messages,
                connections: t.connections,
                createdAt: t.createdAt
            })) : undefined
        };

        // Remove undefined keys
        Object.keys(exportData).forEach(key => {
            if (exportData[key] === undefined) {
                delete exportData[key];
            }
        });

        return JSON.stringify(exportData, null, 2);
    }

    function generateTextExport(options, sessionDuration, exportDate) {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;

        let txt = `READING SESSION NOTES\n`;
        txt += `${'='.repeat(40)}\n\n`;

        if (options.source) {
            txt += `Title: ${pageContext?.title || 'Unknown'}\n`;
            txt += `URL: ${pageContext?.url || 'N/A'}\n`;
            txt += `Date: ${exportDate}\n`;
            txt += `Duration: ${sessionDuration} minutes\n`;
            txt += `\n${'='.repeat(40)}\n\n`;
        }

        if (options.insights) {
            const insightThreads = threads.filter(t => t.refinedInsight);
            if (insightThreads.length > 0) {
                txt += `KEY INSIGHTS\n`;
                txt += `${'-'.repeat(20)}\n`;
                insightThreads.forEach((t, i) => {
                    txt += `${i + 1}. ${t.refinedInsight}\n\n`;
                });
            }
        }

        if (options.notes && (SP.parkingLot || []).length > 0) {
            txt += `QUICK NOTES\n`;
            txt += `${'-'.repeat(20)}\n`;
            (SP.parkingLot || []).forEach(note => {
                txt += `* ${note.text}\n`;
            });
            txt += `\n`;
        }

        if (options.chat) {
            txt += `DISCUSSIONS\n`;
            txt += `${'-'.repeat(20)}\n`;
            threads.forEach((thread, idx) => {
                txt += `\n[${idx + 1}] ${thread.highlight?.text?.slice(0, 100) || 'Discussion'}...\n`;
                if (thread.messages) {
                    thread.messages.forEach(msg => {
                        const role = msg.role === 'user' ? 'You' : 'AI';
                        txt += `  ${role}: ${msg.content}\n`;
                    });
                }
            });
        }

        txt += `\n${'='.repeat(40)}\n`;
        txt += `Exported from ATOM Active Reading\n`;

        return txt;
    }

    // ===========================
    // Download Utilities
    // ===========================
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadMarkdown(content, filename) {
        downloadFile(content, filename, 'text/markdown');
    }

    // ===========================
    // Legacy Export (used by endSession)
    // ===========================
    async function exportSession() {
        const threads = SP.threads || [];
        const pageContext = SP.pageContext;
        const sessionDuration = Math.floor((Date.now() - (SP.sessionStartTime || Date.now())) / 60000);
        const exportDate = new Date().toISOString().split('T')[0];

        // Generate AI summary
        showExportLoading();
        const aiSummary = await generateSessionSummary();
        hideExportLoading();

        // Build Markdown content
        let markdown = `# Reading Session: ${pageContext?.title || 'Unknown Page'}

**URL:** ${pageContext?.url || 'N/A'}
**Date:** ${exportDate}
**Duration:** ${sessionDuration} minutes
**Highlights:** ${threads.length}

---

`;

        if (aiSummary) {
            markdown += `## Session Summary (AI Generated)

${aiSummary}

---

`;
        }

        markdown += `## Highlights & Discussions

`;

        threads.forEach((thread, idx) => {
            const statusEmoji = thread.status === 'saved' ? '✔' :
                thread.status === 'parked' ? 'P' : '-';

            markdown += `### ${idx + 1}. ${statusEmoji} Highlight

> ${thread.highlight?.text || 'N/A'}

`;

            if (thread.connections && thread.connections.length > 0) {
                markdown += `**Connections:**
`;
                thread.connections.forEach(conn => {
                    markdown += `- ${conn.type}: ${conn.explanation}\n`;
                });
                markdown += '\n';
            }

            if (thread.messages && thread.messages.length > 0) {
                markdown += `**Discussion:**
`;
                thread.messages.forEach(msg => {
                    const role = msg.role === 'user' ? 'You' : 'AI';
                    markdown += `\n${role}:\n${msg.content}\n`;
                });
                markdown += '\n';
            }

            markdown += `---

`;
        });

        if ((SP.parkingLot || []).length > 0) {
            markdown += `## Parking Lot (Ideas to Revisit)

`;
            (SP.parkingLot || []).forEach((item, idx) => {
                markdown += `${idx + 1}. ${item.text}\n`;
            });
        }

        markdown += `
---
*Exported from ATOM Active Reading*
`;

        // Download as file
        downloadMarkdown(markdown, `reading-session-${exportDate}.md`);

        return markdown;
    }

    // ===========================
    // Export Loading UI
    // ===========================
    function showExportLoading() {
        const btn = document.getElementById('btn-export-session');
        if (btn) {
            btn.disabled = true;
            const exportingMsg = getMessage('sp_exporting', 'Exporting...');
            btn.innerHTML = `<span class="btn-spinner"></span> ${exportingMsg}`;
        }
    }

    function hideExportLoading() {
        const btn = document.getElementById('btn-export-session');
        if (btn) {
            btn.disabled = false;
            const downloadLabel = getMessage('sp_btn_download_notes', 'Download Notes');
            btn.innerHTML = downloadLabel;
        }
    }

    // ===========================
    // Knowledge Graph — Connection Detection
    // ===========================
    /**
     * Detect connections for a session and store as Knowledge Graph edges.
     * Fire-and-forget: does not block UI. Rate-limited to 3 calls/hour.
     *
     * Phase 1 of Neural Memory integration.
     * Ref: ideas/neural_memory/phase_1_activate_connection_detector.md
     */
    async function detectAndStoreConnections(sessionId) {
        if (!sessionId || !window.ConnectionDetectorService) return;

        // Rate limit: max 3 calls/hour
        const RATE_KEY = 'atom_kg_detect_timestamps';
        const MAX_PER_HOUR = 3;
        const now = Date.now();

        try {
            const { [RATE_KEY]: rawTimestamps } = await chrome.storage.local.get([RATE_KEY]);
            const timestamps = Array.isArray(rawTimestamps) ? rawTimestamps : [];
            const recentCalls = timestamps.filter(t => (now - t) < 3600000);

            if (recentCalls.length >= MAX_PER_HOUR) {
                console.log('[KG] Rate limit reached, skipping connection detection');
                return;
            }

            const apiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));
            if (!apiKey) return;

            // Use existing connection detector
            const connections = await window.ConnectionDetectorService.detectConnections(
                sessionId, apiKey, SP.callGeminiAPI
            );

            if (!connections || connections.length === 0) {
                console.log('[KG] No connections detected');
                return;
            }

            // Store to Knowledge Graph
            const KG_KEY = 'atom_knowledge_graph_v1';
            const KG_MAX = 1000;
            const { [KG_KEY]: rawEdges } = await chrome.storage.local.get([KG_KEY]);
            const edges = Array.isArray(rawEdges) ? rawEdges : [];

            for (const conn of connections) {
                const edge = {
                    edgeId: conn.id || `edge_${now}_${Math.random().toString(36).substring(2, 8)}`,
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    type: conn.type,
                    confidence: conn.confidence,
                    explanation: conn.explanation,
                    strength: 1.0,
                    activationCount: 0,
                    lastActivatedAt: null,
                    createdAt: conn.createdAt || now,
                    createdBy: conn.createdBy || 'auto',
                    similarity: conn.similarity || 0
                };

                // Dedup: same pair + same type → update existing
                const dupIdx = edges.findIndex(e =>
                    e.sourceId === edge.sourceId &&
                    e.targetId === edge.targetId &&
                    e.type === edge.type
                );

                if (dupIdx >= 0) {
                    edges[dupIdx].confidence = Math.max(edges[dupIdx].confidence || 0, edge.confidence);
                    edges[dupIdx].strength = Math.max(edges[dupIdx].strength || 0, edge.strength);
                    edges[dupIdx].explanation = edge.explanation || edges[dupIdx].explanation;
                } else {
                    edges.push(edge);
                }
            }

            // Evict weakest if over capacity
            let finalEdges = edges;
            if (finalEdges.length > KG_MAX) {
                finalEdges.sort((a, b) => (a.strength ?? 1) - (b.strength ?? 1));
                finalEdges = finalEdges.slice(finalEdges.length - KG_MAX);
            }

            await chrome.storage.local.set({ [KG_KEY]: finalEdges });

            // Update rate limit
            recentCalls.push(now);
            await chrome.storage.local.set({ [RATE_KEY]: recentCalls.slice(-10) });

            console.log(`[KG] Stored ${connections.length} edges (total: ${finalEdges.length})`);
        } catch (err) {
            console.error('[KG] detectAndStoreConnections failed:', err);
        }
    }

    // ===========================
    // End Session
    // ===========================
    async function endSession() {
        const threads = SP.threads || [];
        const elements = SP.elements || {};

        if (threads.length === 0) {
            alert('No highlights in this session.');
            return;
        }

        const confirmMsg = getMessage('sp_confirm_end_session', 'Finish this reading session?');
        const statsDiscussions = getMessage('sp_stats_discussions', 'chats');
        const quickNoteTitle = getMessage('sp_quick_note_title', 'Quick Notes');
        const confirmEnd = window.confirm(
            `${confirmMsg}\n\n` +
            `• ${threads.length} ${statsDiscussions}\n` +
            `• ${(SP.parkingLot || []).length} ${quickNoteTitle}`
        );

        if (!confirmEnd) return;

        // Export first
        await exportSession();

        // Fire-and-forget: detect connections and store to Knowledge Graph
        // Must capture sessionId BEFORE clearing session data
        const sessionIdForKG = SP.activeSessionId;
        if (sessionIdForKG) {
            detectAndStoreConnections(sessionIdForKG).catch(err => {
                console.warn('[KG] Background connection detection failed:', err);
            });
        }

        // Clear session data — use .length = 0 to clear in-place (preserve SP reference)
        threads.length = 0;
        if (Array.isArray(SP.parkingLot)) SP.parkingLot.length = 0;
        SP.activeThreadId = null;
        SP.sessionStartTime = Date.now();

        if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();
        if (SP.saveParkingLot) await SP.saveParkingLot();

        if (SP.renderThreadList) SP.renderThreadList();
        SP.renderParkingLot?.();
        if (SP.updateSessionStats) SP.updateSessionStats();

        // Show empty state
        if (elements.emptyState) {
            elements.emptyState.style.display = 'flex';
        }
        if (elements.currentHighlight) {
            elements.currentHighlight.style.display = 'none';
        }
        if (elements.messages) {
            elements.messages.innerHTML = '';
            elements.messages.appendChild(elements.emptyState);
        }
    }

    // ── Expose API on SP ──
    SP.getNlmExportFailureToast = getNlmExportFailureToast;
    SP.quickSaveHighlight = quickSaveHighlight;
    SP.saveThreadToNLM = saveThreadToNLM;
    SP.exportAllToNLM = exportAllToNLM;
    SP.showExportDialog = showExportDialog;
    SP.endSession = endSession;
    SP.exportSession = exportSession;

    console.log('[SP:Export] Module loaded');
})();
