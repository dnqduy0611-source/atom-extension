// brain/scheduler.js — Consolidated alarms: 8 → 3 recurring + dynamic giữ nguyên
// Source: background.js L978-L1106

/**
 * BEFORE (8 alarms):
 *   check-store-update         (360 min)
 *   atom_srq_cleanup           (720 min)  
 *   atom_kg_decay_cycle        (360 min)
 *   atom_daily_quota_reset     (60 min)
 *   atom_github_update         (360 min)
 *   atom_srq_auto_export_retry (15 min)
 *   nlm_export_queue_tick      (dynamic)
 *   ATOM_FOCUS_PHASE_END       (dynamic)
 *
 * AFTER (3 recurring + 2 dynamic giữ nguyên):
 *   atom_brain_maintenance     (360 min) — gom 4 alarms cùng period
 *   atom_sync_retry            (15 min)  — gom export retries
 *   atom_quota_reset           (60 min)  — giữ riêng
 *   ATOM_FOCUS_PHASE_END       (dynamic, giữ nguyên)
 *   nlm_export_queue_tick      (dynamic, giữ nguyên)
 */

import { checkAndEnableSemantics } from './auto_enable_semantics.js';

// SRQ Cleanup internal timing (was 720 min alarm, now run every 2nd maintenance cycle)
const SRQ_CLEANUP_KEY = 'atom_last_srq_cleanup';
const SRQ_CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h

export const ALARMS = {
    // 1. Brain Maintenance — chạy 6h/lần
    //    Gom: kg_decay + digest_decay + srq_cleanup + store_update + github_update + auto_semantics
    BRAIN_MAINTENANCE: {
        name: 'atom_brain_maintenance',
        periodInMinutes: 360,
        handler: async (deps) => {
            // 0. Auto-enable semantics nếu đủ data
            await checkAndEnableSemantics();

            // 1. KG + Digest Decay (was: atom_kg_decay_cycle)
            await deps.runKGDecay();
            await deps.runDigestDecay();

            // 2. SRQ Cleanup — only if 12h+ since last run (was: atom_srq_cleanup @ 720 min)
            const { [SRQ_CLEANUP_KEY]: lastCleanup } = await chrome.storage.local.get([SRQ_CLEANUP_KEY]);
            if (!lastCleanup || (Date.now() - lastCleanup) >= SRQ_CLEANUP_INTERVAL_MS) {
                const settings = await deps.loadNlmSettings();
                const removed = await deps.cleanupStaleCards(settings?.srqStaleCardDays || 14);
                if (removed > 0) console.log(`[Brain] Cleaned ${removed} stale SRQ cards`);
                await chrome.storage.local.set({ [SRQ_CLEANUP_KEY]: Date.now() });
            }

            // 3. Update checks (was: check-store-update + atom_github_update)
            await deps.checkForStoreUpdate();
            await deps.checkForGitHubUpdate();

            console.log('[Brain] Maintenance cycle complete');
        }
    },

    // 2. Sync Retry — chạy 15min/lần
    //    Gom: srq_auto_export_retry + NLM queue processing
    SYNC_RETRY: {
        name: 'atom_sync_retry',
        periodInMinutes: 15,
        handler: async (deps) => {
            // 1. SRQ auto-export retry (was: atom_srq_auto_export_retry)
            await deps.retryFailedExports();

            // 2. NLM queue processing (was: nlm_export_queue_tick — gộp vào đây)
            await deps.processNlmExportQueue('sync_retry');
        }
    },

    // 3. Quota Reset — giữ riêng vì interval khác (1h)
    QUOTA_RESET: {
        name: 'atom_quota_reset',
        periodInMinutes: 60,
        handler: async (deps) => {
            await deps.resetDailyQuota();
        }
    }
};

/**
 * Register consolidated alarms.
 * Call once during background.js initialization.
 * Replaces 6 chrome.alarms.create() calls with 3.
 */
export function registerAlarms() {
    for (const alarm of Object.values(ALARMS)) {
        chrome.alarms.create(alarm.name, { periodInMinutes: alarm.periodInMinutes });
    }
    console.log('[Brain Scheduler] Registered', Object.keys(ALARMS).length, 'consolidated alarms');
}

/**
 * Route alarm event to correct handler.
 * Returns true if handled, false if not our alarm (e.g. Focus timer).
 * 
 * @param {string} alarmName - The alarm name from onAlarm event
 * @param {Object} deps - Dependencies object with all handler functions
 * @returns {boolean} true if this alarm was handled
 */
export async function handleAlarm(alarmName, deps) {
    const alarm = Object.values(ALARMS).find(a => a.name === alarmName);
    if (!alarm) return false;

    try {
        await alarm.handler(deps);
    } catch (err) {
        console.error(`[Brain Scheduler] ${alarmName} failed:`, err);
    }
    return true;
}
