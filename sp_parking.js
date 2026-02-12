/**
 * sp_parking.js — Parking Lot System
 * Phase 3b of Sidepanel Module Split
 *
 * Handles: Quick notes (parking lot), promote notes to threads,
 * park current thread, load/save parking lot from storage.
 *
 * Dependencies (read from window.SP):
 *   SP.parkingLot, SP.threads, SP.activeThreadId, SP.currentDomain,
 *   SP.pageContext, SP.elements, SP.getMessage, SP.getIcon, SP.escapeHtml,
 *   SP.updateSessionStats, SP.updateAllCounts, SP.saveThreadsToStorage,
 *   SP.renderThreadList, SP.renderActiveThread, SP.createUndoableAction
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[Parking] SP not found'); return; }

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function getIcon(name) { return SP.getIcon ? SP.getIcon(name) : ''; }
    function escapeHtml(text) { return SP.escapeHtml ? SP.escapeHtml(text) : text; }

    // ===========================
    // Parking Lot System
    // ===========================
    async function loadParkingLot() {
        if (!SP.currentDomain) return;
        const key = `atom_parking_lot_${SP.currentDomain}`;
        const data = await chrome.storage.local.get([key]);
        SP.parkingLot = data[key] || [];
        renderParkingLot();
    }

    async function saveParkingLot() {
        if (!SP.currentDomain) return;
        const key = `atom_parking_lot_${SP.currentDomain}`;
        await chrome.storage.local.set({ [key]: SP.parkingLot });
    }

    function addToParkingLot(idea) {
        const item = {
            id: `park_${Date.now()}`,
            text: idea,
            threadId: SP.activeThreadId,
            createdAt: Date.now()
        };
        SP.parkingLot.push(item);
        saveParkingLot();
        renderParkingLot();
        SP.updateSessionStats?.();
    }

    function removeFromParkingLot(itemId, withUndo = true) {
        const item = SP.parkingLot.find(p => p.id === itemId);
        if (!item) return;

        const itemIndex = SP.parkingLot.indexOf(item);

        // Remove immediately (optimistic update)
        SP.parkingLot = SP.parkingLot.filter(p => p.id !== itemId);
        renderParkingLot();
        SP.updateSessionStats?.();

        if (withUndo) {
            const deletedMsg = getMessage('sp_note_deleted', 'Note deleted');
            SP.createUndoableAction?.(
                'delete_note',
                deletedMsg,
                { item, index: itemIndex },
                // Undo function
                (data) => {
                    // Restore the note at its original position
                    SP.parkingLot.splice(data.index, 0, data.item);
                    saveParkingLot();
                    renderParkingLot();
                    SP.updateSessionStats?.();
                },
                // Commit function
                (data) => {
                    saveParkingLot();
                }
            );
        } else {
            saveParkingLot();
        }
    }

    function renderParkingLot() {
        const elements = SP.elements || {};
        const parkingLot = SP.parkingLot || [];

        // Update notes count in tab badge
        if (elements.notesCount) {
            elements.notesCount.textContent = parkingLot.length;
        }

        if (!elements.notesList) return;

        if (parkingLot.length === 0) {
            const emptyMsg = getMessage('sp_quick_note_empty', 'No notes yet');
            elements.notesList.innerHTML = `<div class="sp-note-empty">${emptyMsg}</div>`;
            return;
        }

        elements.notesList.innerHTML = parkingLot.map(item => `
            <div class="sp-note-item" data-id="${item.id}">
                <div class="sp-note-text">${escapeHtml(item.text)}</div>
                <div class="sp-note-actions">
                    <button class="sp-note-btn" data-action="promote" title="Convert to discussion">${getIcon('promote')}</button>
                    <button class="sp-note-btn" data-action="remove" title="Remove">${getIcon('remove')}</button>
                </div>
            </div>
        `).join('');

        // Add event handlers
        elements.notesList.querySelectorAll('.sp-note-item').forEach(item => {
            const id = item.dataset.id;

            item.querySelector('[data-action="promote"]')?.addEventListener('click', () => {
                promoteFromParkingLot(id);
            });

            item.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
                removeFromParkingLot(id);
            });
        });

        SP.updateAllCounts?.();
    }

    function promoteFromParkingLot(itemId) {
        const item = (SP.parkingLot || []).find(p => p.id === itemId);
        if (!item) return;

        // Create a new thread from parked idea
        const newThread = {
            id: `thread_${Date.now()}`,
            highlight: {
                text: item.text,
                url: SP.pageContext?.url,
                title: SP.pageContext?.title,
                domain: SP.currentDomain,
                timestamp: Date.now()
            },
            messages: [],
            connections: [],
            status: 'active',
            createdAt: Date.now(),
            promotedFromParking: true
        };

        SP.threads.push(newThread);
        SP.activeThreadId = newThread.id;

        removeFromParkingLot(itemId, false); // Don't trigger undo for promote action
        SP.saveThreadsToStorage?.();
        SP.renderThreadList?.();
        SP.renderActiveThread?.();
    }

    function parkCurrentThread() {
        const threads = SP.threads || [];
        const thread = threads.find(t => t.id === SP.activeThreadId);
        if (!thread) return;

        const previousStatus = thread.status;

        // Apply the change immediately (optimistic update)
        thread.status = 'parked';
        SP.renderThreadList?.();
        SP.updateSessionStats?.();

        // Create undoable action
        const doneMsg = getMessage('sp_marked_done', 'Marked as done');
        SP.createUndoableAction?.(
            'park_thread',
            doneMsg,
            { threadId: thread.id, previousStatus },
            // Undo function
            (data) => {
                const t = (SP.threads || []).find(th => th.id === data.threadId);
                if (t) {
                    t.status = data.previousStatus;
                    SP.saveThreadsToStorage?.();
                    SP.renderThreadList?.();
                    SP.renderActiveThread?.();
                    SP.updateSessionStats?.();
                }
            },
            // Commit function
            (data) => {
                SP.saveThreadsToStorage?.();
            }
        );
    }

    // ── Expose API on SP ──
    SP.loadParkingLot = loadParkingLot;
    SP.saveParkingLot = saveParkingLot;
    SP.addToParkingLot = addToParkingLot;
    SP.removeFromParkingLot = removeFromParkingLot;
    SP.renderParkingLot = renderParkingLot;
    SP.promoteFromParkingLot = promoteFromParkingLot;
    SP.parkCurrentThread = parkCurrentThread;

    console.log('[SP:Parking] Module loaded');
})();
