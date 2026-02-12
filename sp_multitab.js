/**
 * sp_multitab.js — Multi-Tab Session Handling
 * Phase 2 of Sidepanel Module Split
 * 
 * Handles: BroadcastChannel sync, session detection,
 * multi-tab warnings, data sync notifications.
 * 
 * Dependencies (read from window.SP):
 *   SP.currentDomain, SP.pageContext, SP.threads,
 *   SP.getMessage, SP.getIcon, SP.showToast,
 *   SP.loadThreadsFromStorage
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[MultiTab] SP not found'); return; }

    // ── Constants ──
    const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let broadcastChannel = null;

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function getIcon(name) { return SP.getIcon ? SP.getIcon(name) : ''; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }

    // ===========================
    // Multi-Tab Handling
    // ===========================
    function initMultiTabHandling() {
        // Create broadcast channel for tab communication
        try {
            broadcastChannel = new BroadcastChannel('atom_sidepanel_sync');

            broadcastChannel.onmessage = (event) => {
                handleBroadcastMessage(event.data);
            };

            // Announce this session
            broadcastSessionActive();

            // Listen for page unload to cleanup
            window.addEventListener('beforeunload', () => {
                broadcastChannel?.postMessage({
                    type: 'SESSION_CLOSED',
                    sessionId: SESSION_ID,
                    domain: SP.currentDomain
                });
            });

        } catch (e) {
            console.log('[MultiTab] BroadcastChannel not supported');
        }

        // Check for existing sessions on same URL
        checkForExistingSessions();
    }

    function broadcastSessionActive() {
        broadcastChannel?.postMessage({
            type: 'SESSION_ACTIVE',
            sessionId: SESSION_ID,
            domain: SP.currentDomain,
            url: SP.pageContext?.url,
            timestamp: Date.now()
        });
    }

    function handleBroadcastMessage(data) {
        if (data.sessionId === SESSION_ID) return; // Ignore own messages

        switch (data.type) {
            case 'SESSION_ACTIVE':
                // Another session is active on the same domain
                if (data.domain === SP.currentDomain && data.url === SP.pageContext?.url) {
                    showMultiTabWarning(data);
                }
                break;

            case 'SESSION_CLOSED':
                // Another session closed - hide warning if shown
                hideMultiTabWarning();
                break;

            case 'DATA_UPDATED':
                // Another session updated data - offer to refresh
                if (data.domain === SP.currentDomain) {
                    showDataSyncNotification(data);
                }
                break;

            case 'REQUEST_ACTIVE_SESSIONS':
                // Respond with our session info
                if (data.domain === SP.currentDomain) {
                    broadcastSessionActive();
                }
                break;
        }
    }

    async function checkForExistingSessions() {
        // Request active sessions for this domain
        broadcastChannel?.postMessage({
            type: 'REQUEST_ACTIVE_SESSIONS',
            sessionId: SESSION_ID,
            domain: SP.currentDomain
        });
    }

    function showMultiTabWarning(otherSession) {
        // Remove existing warning
        document.getElementById('multitab-warning')?.remove();

        const warning = document.createElement('div');
        warning.id = 'multitab-warning';
        warning.className = 'sp-multitab-warning';

        const warningMsg = getMessage('sp_multitab_warning', 'This article is open in another tab');
        const btnContinue = getMessage('sp_multitab_continue', 'Continue here');
        const btnSwitch = getMessage('sp_multitab_switch', 'Switch to other tab');

        warning.innerHTML = `
            <div class="sp-multitab-content">
                <span class="sp-multitab-icon">${getIcon('info')}</span>
                <span class="sp-multitab-text">${warningMsg}</span>
            </div>
            <div class="sp-multitab-actions">
                <button class="sp-multitab-btn" id="btn-multitab-continue">${btnContinue}</button>
            </div>
        `;

        // Insert after offline banner
        const offlineBanner = document.getElementById('offline-banner');
        offlineBanner?.insertAdjacentElement('afterend', warning);

        // Event handlers
        document.getElementById('btn-multitab-continue')?.addEventListener('click', () => {
            hideMultiTabWarning();
        });
    }

    function hideMultiTabWarning() {
        const warning = document.getElementById('multitab-warning');
        if (warning) {
            warning.classList.add('hiding');
            setTimeout(() => warning.remove(), 200);
        }
    }

    function showDataSyncNotification(data) {
        // Only show if we have local changes that might conflict
        if (SP.threads.length === 0) {
            // No local data, just reload
            SP.loadThreadsFromStorage?.();
            return;
        }

        const syncMsg = getMessage('sp_data_sync', 'Data updated in another tab');
        showToast(syncMsg, 'info');
    }

    // Broadcast when data changes
    function broadcastDataUpdate() {
        broadcastChannel?.postMessage({
            type: 'DATA_UPDATED',
            sessionId: SESSION_ID,
            domain: SP.currentDomain,
            timestamp: Date.now()
        });
    }

    // ── Expose API on SP ──
    SP.initMultiTabHandling = initMultiTabHandling;
    SP.broadcastDataUpdate = broadcastDataUpdate;
    SP.SESSION_ID = SESSION_ID;

    console.log('[SP:MultiTab] Module loaded');
})();
