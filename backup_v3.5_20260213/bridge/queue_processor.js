/**
 * Queue Processor - Utility functions for queue management UI
 *
 * NOTE: Alarm-based retry processing is handled in background.js
 * This module provides utility functions for UI display and manual actions
 *
 * Per spec (UI-assisted mode):
 * - Max attempts: 3
 * - Backoff: 5s → 30s → 2m
 * - UI-assisted: retry = "remind user to retry", not auto background
 */

import {
    loadExportQueue,
    saveExportQueue,
    getJobsReadyForRetry,
    getPendingJobsCount,
    cleanupOldJobs,
    updateJob
} from "./export_queue.js";

/**
 * Setup queue processor - placeholder for compatibility
 * NOTE: Actual alarm setup is in background.js (NLM_QUEUE_ALARM)
 */
export async function setupQueueProcessor() {
    console.log("[ATOM NLM] Queue processor utilities loaded");
}

/**
 * Handle alarm - placeholder for compatibility
 * NOTE: Actual alarm handling is in background.js (processNlmExportQueue)
 */
export async function handleQueueAlarm(alarm) {
    // Handled by background.js
}

/**
 * Process queue - utility for manual trigger
 * Updates badge and returns summary
 */
export async function processQueue() {
    try {
        // 1. Cleanup old jobs first
        const cleaned = await cleanupOldJobs();
        if (cleaned > 0) {
            console.log(`[ATOM NLM] Cleaned ${cleaned} old jobs`);
        }

        // 2. Get jobs ready for retry
        const retryJobs = await getJobsReadyForRetry();

        // 3. Get counts for badge
        const counts = await getPendingJobsCount();

        // 4. Update badge
        await updateBadge(counts);

        // 5. Log status
        if (counts.total > 0) {
            console.log(`[ATOM NLM] Queue status: ${counts.pending} pending, ${counts.failed} failed`);
        }

        return {
            cleaned,
            retryReady: retryJobs.length,
            counts
        };
    } catch (error) {
        console.error("[ATOM NLM] Queue processor error:", error);
        return { error: error.message };
    }
}

/**
 * Update extension badge based on queue status
 * @param {{ pending: number, failed: number, total: number }} counts
 */
async function updateBadge(counts) {
    try {
        if (counts.total === 0) {
            // Clear badge
            await chrome.action.setBadgeText({ text: "" });
            return;
        }

        // Show count on badge
        const text = counts.total > 99 ? "99+" : String(counts.total);
        await chrome.action.setBadgeText({ text });

        // Color: orange for pending, red for failed
        const color = counts.failed > 0 ? "#ef4444" : "#f59e0b";
        await chrome.action.setBadgeBackgroundColor({ color });
    } catch (error) {
        // Badge API may not be available in all contexts
        console.log("[ATOM NLM] Could not update badge:", error.message);
    }
}

/**
 * Manually trigger retry for a specific job (user-initiated)
 * @param {string} jobId - Job ID to retry
 * @returns {Promise<Object>} Updated job
 */
export async function retryJob(jobId) {
    const job = await updateJob(jobId, {
        status: "queued",
        lastError: null,
        nextAttemptAt: Date.now()
    });

    if (job) {
        console.log(`[ATOM NLM] Job ${jobId} queued for retry`);
    }

    return job;
}

/**
 * Cancel a job (remove from queue)
 * @param {string} jobId - Job ID to cancel
 * @returns {Promise<boolean>} True if cancelled
 */
export async function cancelJob(jobId) {
    const queue = await loadExportQueue();
    const filtered = queue.filter(job => job?.jobId !== jobId);

    if (filtered.length < queue.length) {
        await saveExportQueue(filtered);
        console.log(`[ATOM NLM] Job ${jobId} cancelled`);

        // Update badge
        const counts = await getPendingJobsCount();
        await updateBadge(counts);

        return true;
    }

    return false;
}

/**
 * Get all jobs for display in UI
 * @returns {Promise<Array>} All jobs with status
 */
export async function getJobsForDisplay() {
    const queue = await loadExportQueue();
    return queue.map(job => ({
        jobId: job.jobId,
        notebookRef: job.notebookRef,
        status: job.status,
        attempts: job.attempts || 0,
        maxAttempts: 3,
        createdAt: job.createdAt,
        lastAttemptAt: job.lastAttemptAt,
        lastError: job.lastError,
        canRetry: job.status === "failed" && (job.attempts || 0) < 3
    }));
}

/**
 * Clear all failed jobs from queue
 * @returns {Promise<number>} Number of jobs cleared
 */
export async function clearFailedJobs() {
    const queue = await loadExportQueue();
    const filtered = queue.filter(job =>
        job?.status !== "failed" && job?.status !== "max_retries"
    );

    const cleared = queue.length - filtered.length;

    if (cleared > 0) {
        await saveExportQueue(filtered);

        // Update badge
        const counts = await getPendingJobsCount();
        await updateBadge(counts);
    }

    return cleared;
}
