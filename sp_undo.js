/**
 * sp_undo.js — Undo System
 * Phase 3a of Sidepanel Module Split
 *
 * Handles: Undo toast with countdown, action stack,
 * auto-commit after timeout, undoLastAction (Ctrl+Z).
 *
 * Dependencies (read from window.SP):
 *   SP.getMessage, SP.showToast, SP.escapeHtml
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Undo] SP not found'); return; }

    // ── Constants ──
    const UNDO_TIMEOUT_MS = 5000; // 5 seconds

    // ── State ──
    let undoStack = []; // Stack of undoable actions
    let activeUndoToast = null; // Currently displayed undo toast

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }
    function escapeHtml(text) { return SP.escapeHtml ? SP.escapeHtml(text) : text; }

    // ===========================
    // Undo System
    // ===========================

    /**
     * Create an undoable action with a timed auto-commit
     * @param {string} type - Action type identifier
     * @param {string} message - Display message for undo toast
     * @param {object} data - Action data payload
     * @param {function} undoFn - Function to call when undoing
     * @param {function} commitFn - Function to call when action is committed (optional)
     */
    function createUndoableAction(type, message, data, undoFn, commitFn = null) {
        // Cancel any existing undo toast
        cancelActiveUndo();

        const action = {
            id: `undo_${Date.now()}`,
            type,
            message,
            data,
            undoFn,
            commitFn,
            createdAt: Date.now(),
            timeoutId: null
        };

        // Set timeout for auto-commit
        action.timeoutId = setTimeout(() => {
            commitAction(action);
        }, UNDO_TIMEOUT_MS);

        undoStack.push(action);
        showUndoToast(action);

        return action;
    }

    function showUndoToast(action) {
        let toast = document.getElementById('undo-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'undo-toast';
        }
        toast.className = 'sp-undo-toast';
        toast.removeAttribute('hidden');

        const undoLabel = getMessage('sp_undo', 'Undo');

        // Add "View Journal" link for diary actions
        const viewJournalBtn = action.type === 'DIARY_ADD'
            ? `<button class="sp-undo-btn sp-view-journal-btn" id="btn-view-journal"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></button>`
            : '';

        toast.innerHTML = `
            <div class="sp-undo-content">
                <span class="sp-undo-icon">✓</span>
                <span class="sp-undo-message">${escapeHtml(action.message)}</span>
            </div>
            <div class="sp-undo-actions">
                ${viewJournalBtn}
                <button class="sp-undo-btn" id="btn-undo">${undoLabel}</button>
                <div class="sp-undo-countdown">
                    <svg class="sp-countdown-ring" viewBox="0 0 20 20">
                        <circle class="sp-countdown-bg" cx="10" cy="10" r="8"/>
                        <circle class="sp-countdown-progress" cx="10" cy="10" r="8"/>
                    </svg>
                    <span class="sp-countdown-text" id="undo-countdown">5</span>
                </div>
            </div>
        `;

        if (!toast.parentElement) {
            document.body.appendChild(toast);
        }
        activeUndoToast = toast;

        // Add undo button handler
        toast.querySelector('#btn-undo')?.addEventListener('click', () => {
            undoAction(action);
        });

        // Add "View Journal" button handler for diary actions
        toast.querySelector('#btn-view-journal')?.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('journal.html') });
        });

        // Restart animation when reusing the toast
        toast.style.animation = 'none';
        void toast.offsetHeight;
        toast.style.animation = '';

        // Start countdown animation
        startCountdownAnimation(action);
    }

    function startCountdownAnimation(action) {
        const countdownText = document.getElementById('undo-countdown');
        const progressCircle = document.querySelector('.sp-countdown-progress');

        if (!countdownText || !progressCircle) return;

        // Set up the countdown ring animation
        const circumference = 2 * Math.PI * 8; // r=8
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = 0;

        let remainingSeconds = 5;

        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            if (countdownText) {
                countdownText.textContent = remainingSeconds;
            }

            // Update circle progress
            const progress = (5 - remainingSeconds) / 5;
            if (progressCircle) {
                progressCircle.style.strokeDashoffset = circumference * progress;
            }

            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);

        // Store interval ID for cleanup
        action.countdownInterval = countdownInterval;
    }

    function undoAction(action) {
        // Clear the timeout
        if (action.timeoutId) {
            clearTimeout(action.timeoutId);
        }
        if (action.countdownInterval) {
            clearInterval(action.countdownInterval);
        }

        // Remove from stack
        undoStack = undoStack.filter(a => a.id !== action.id);

        // Execute undo function
        if (action.undoFn) {
            action.undoFn(action.data);
        }

        // Remove toast
        hideUndoToast();

        // Show confirmation
        const undoneMsg = getMessage('sp_action_undone', 'Action undone');
        showToast(undoneMsg, 'success');
    }

    function commitAction(action) {
        // Clear intervals
        if (action.countdownInterval) {
            clearInterval(action.countdownInterval);
        }

        // Remove from stack
        undoStack = undoStack.filter(a => a.id !== action.id);

        // Execute commit function if provided
        if (action.commitFn) {
            action.commitFn(action.data);
        }

        // Remove toast
        hideUndoToast();
    }

    function cancelActiveUndo() {
        // Cancel all pending undo actions
        undoStack.forEach(action => {
            if (action.timeoutId) {
                clearTimeout(action.timeoutId);
            }
            if (action.countdownInterval) {
                clearInterval(action.countdownInterval);
            }
            // Commit the action immediately
            if (action.commitFn) {
                action.commitFn(action.data);
            }
        });
        undoStack = [];
        hideUndoToast();
    }

    function hideUndoToast() {
        const toast = document.getElementById('undo-toast');
        if (toast) {
            toast.classList.add('hiding');
            setTimeout(() => {
                toast.classList.remove('hiding');
                toast.setAttribute('hidden', '');
            }, 200);
        }
        activeUndoToast = null;
    }

    function undoLastAction() {
        if (undoStack.length === 0) {
            showToast(getMessage('sp_nothing_to_undo', 'Nothing to undo'), 'info');
            return;
        }

        // Get the most recent action
        const lastAction = undoStack[undoStack.length - 1];
        undoAction(lastAction);
    }

    // ── Expose API on SP ──
    SP.createUndoableAction = createUndoableAction;
    SP.undoLastAction = undoLastAction;
    SP.cancelActiveUndo = cancelActiveUndo;

    console.log('[SP:Undo] Module loaded');
})();
