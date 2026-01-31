import {
    NLM_EXPORT_QUEUE_KEY,
    NLM_EXPORT_INDEX_KEY,
    getLocalDayKey,
    NLM_MAX_QUEUE_SIZE,
    NLM_RETRY_DELAYS_MS
} from "./types.js";

// Retry constants per spec
const MAX_ATTEMPTS = 3;
const JOB_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

async function sha256Hex(input) {
    const text = typeof input === "string" ? input : String(input || "");
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function buildDedupeKey({ url, selectedText, notebookRef, capturedAt }) {
    const dayKey = getLocalDayKey(capturedAt || Date.now());
    const textHash = await sha256Hex(selectedText || "");
    return sha256Hex(`${url || ""}|${textHash}|${dayKey}|${notebookRef || ""}`);
}

export async function loadExportQueue() {
    const data = await chrome.storage.local.get([NLM_EXPORT_QUEUE_KEY]);
    const list = Array.isArray(data[NLM_EXPORT_QUEUE_KEY]) ? data[NLM_EXPORT_QUEUE_KEY] : [];
    return list;
}

export async function saveExportQueue(list) {
    const safe = Array.isArray(list) ? list : [];
    await chrome.storage.local.set({ [NLM_EXPORT_QUEUE_KEY]: safe });
    return safe;
}

export async function loadDedupeIndex() {
    const data = await chrome.storage.local.get([NLM_EXPORT_INDEX_KEY]);
    const index = data[NLM_EXPORT_INDEX_KEY];
    return index && typeof index === "object" ? index : {};
}

export async function saveDedupeIndex(index) {
    const safe = index && typeof index === "object" ? index : {};
    await chrome.storage.local.set({ [NLM_EXPORT_INDEX_KEY]: safe });
    return safe;
}

export async function isDedupeHit(dedupeKey, windowMs = 24 * 60 * 60 * 1000) {
    if (!dedupeKey) return false;
    const index = await loadDedupeIndex();
    const ts = index[dedupeKey];
    if (!ts) return false;
    return Date.now() - ts < windowMs;
}

export async function markDedupeHit(dedupeKey, ts = Date.now()) {
    if (!dedupeKey) return null;
    const index = await loadDedupeIndex();
    index[dedupeKey] = ts;
    await saveDedupeIndex(index);
    return ts;
}

export function createExportJob({ bundleId, notebookRef, dedupeKey }) {
    const now = Date.now();
    const firstDelay = Array.isArray(NLM_RETRY_DELAYS_MS) && NLM_RETRY_DELAYS_MS.length
        ? NLM_RETRY_DELAYS_MS[0]
        : 5000;
    return {
        jobId: `${now}_${Math.random().toString(16).slice(2, 10)}`,
        bundleId,
        notebookRef,
        dedupeKey,
        mode: "ui_assisted",
        status: "queued",
        attempts: 0,
        createdAt: now,
        nextAttemptAt: now + firstDelay
    };
}

function dropOldestQueued(list, maxSize) {
    if (!Array.isArray(list)) return [];
    if (!Number.isFinite(maxSize) || maxSize <= 0) return list;
    if (list.length <= maxSize) return list;

    const next = [...list];
    let idx = 0;
    while (next.length > maxSize && idx < next.length) {
        if (next[idx]?.status === "queued") {
            next.splice(idx, 1);
            continue;
        }
        idx += 1;
    }
    return next;
}

export async function enqueueExportJob(job) {
    const queue = await loadExportQueue();
    queue.push(job);
    const trimmed = dropOldestQueued(queue, NLM_MAX_QUEUE_SIZE);
    await saveExportQueue(trimmed);
    return job;
}

export async function updateJobStatus(jobId, status, lastError) {
    if (!jobId) return null;
    const queue = await loadExportQueue();
    let updated = null;
    const next = queue.map((job) => {
        if (!job || job.jobId !== jobId) return job;
        updated = {
            ...job,
            status,
            attempts: status === "running" ? job.attempts + 1 : job.attempts,
            lastError: lastError || job.lastError
        };
        return updated;
    });
    await saveExportQueue(next);
    return updated;
}

export async function dequeueJob(jobId) {
    const queue = await loadExportQueue();
    const next = queue.filter((job) => job?.jobId !== jobId);
    await saveExportQueue(next);
    return next;
}

export async function updateJob(jobId, patch = {}) {
    if (!jobId) return null;
    const queue = await loadExportQueue();
    let updated = null;
    const next = queue.map((job) => {
        if (!job || job.jobId !== jobId) return job;
        updated = { ...job, ...patch };
        return updated;
    });
    if (updated) {
        await saveExportQueue(next);
    }
    return updated;
}

// ============================================
// Retry Logic (per spec: max 3 attempts, backoff 5s → 30s → 2m)
// ============================================

/**
 * Get retry delay based on attempt count
 * @param {number} attempts - Number of attempts made
 * @returns {number} Delay in ms before next retry
 */
export function getRetryDelay(attempts) {
    const delays = Array.isArray(NLM_RETRY_DELAYS_MS) ? NLM_RETRY_DELAYS_MS : [5000, 30000, 120000];
    const index = Math.min(attempts, delays.length - 1);
    return delays[index] || delays[delays.length - 1] || 120000;
}

/**
 * Check if job can be retried
 * @param {Object} job - Export job
 * @returns {boolean} True if can retry
 */
export function canRetry(job) {
    if (!job) return false;
    return (job.attempts || 0) < MAX_ATTEMPTS;
}

/**
 * Mark job as failed and schedule retry if possible
 * @param {string} jobId - Job ID
 * @param {string} error - Error message
 * @returns {Promise<Object|null>} Updated job or null
 */
export async function markJobFailed(jobId, error) {
    if (!jobId) return null;
    const queue = await loadExportQueue();
    let updated = null;
    const now = Date.now();

    const next = queue.map((job) => {
        if (!job || job.jobId !== jobId) return job;

        const attempts = (job.attempts || 0) + 1;
        const canRetryJob = attempts < MAX_ATTEMPTS;

        updated = {
            ...job,
            attempts,
            lastError: error || "Unknown error",
            lastAttemptAt: now,
            status: canRetryJob ? "failed" : "max_retries",
            nextAttemptAt: canRetryJob ? now + getRetryDelay(attempts) : null
        };
        return updated;
    });

    await saveExportQueue(next);
    return updated;
}

/**
 * Mark job as successful and remove from queue
 * @param {string} jobId - Job ID
 * @returns {Promise<boolean>} True if removed
 */
export async function markJobSuccess(jobId) {
    if (!jobId) return false;
    const queue = await loadExportQueue();
    const next = queue.filter((job) => job?.jobId !== jobId);
    await saveExportQueue(next);
    return true;
}

/**
 * Get jobs that are ready for retry
 * @returns {Promise<Array>} Jobs ready for retry
 */
export async function getJobsReadyForRetry() {
    const queue = await loadExportQueue();
    const now = Date.now();

    return queue.filter((job) => {
        if (!job) return false;
        // Job is failed and ready for next attempt
        if (job.status === "failed" && job.nextAttemptAt && job.nextAttemptAt <= now) {
            return canRetry(job);
        }
        return false;
    });
}

/**
 * Get count of pending/failed jobs (for badge)
 * @returns {Promise<{ pending: number, failed: number, total: number }>}
 */
export async function getPendingJobsCount() {
    const queue = await loadExportQueue();
    let pending = 0;
    let failed = 0;

    for (const job of queue) {
        if (!job) continue;
        if (job.status === "queued" || job.status === "running") {
            pending++;
        } else if (job.status === "failed") {
            failed++;
        }
    }

    return { pending, failed, total: pending + failed };
}

/**
 * Cleanup old/expired jobs from queue
 * @returns {Promise<number>} Number of jobs removed
 */
export async function cleanupOldJobs() {
    const queue = await loadExportQueue();
    const now = Date.now();
    let removed = 0;

    const next = queue.filter((job) => {
        if (!job) {
            removed++;
            return false;
        }
        // Remove jobs older than 24h that are completed or max retries
        const age = now - (job.createdAt || 0);
        if (age > JOB_EXPIRY_MS) {
            if (job.status === "success" || job.status === "max_retries") {
                removed++;
                return false;
            }
        }
        return true;
    });

    if (removed > 0) {
        await saveExportQueue(next);
    }
    return removed;
}

/**
 * Get queue summary for UI display
 * @returns {Promise<Object>} Queue summary
 */
export async function getQueueSummary() {
    const queue = await loadExportQueue();
    const counts = { queued: 0, running: 0, failed: 0, max_retries: 0, success: 0 };

    for (const job of queue) {
        if (job?.status && counts.hasOwnProperty(job.status)) {
            counts[job.status]++;
        }
    }

    return {
        total: queue.length,
        ...counts,
        hasActionable: counts.queued > 0 || counts.failed > 0
    };
}
