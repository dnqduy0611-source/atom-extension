import { NLM_PENDING_JOBS_KEY } from "./types.js";

const DEFAULT_TTL_MS = 120000;

function generateNonce() {
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildPendingJob(payload, ttlMs = DEFAULT_TTL_MS) {
    const now = Date.now();
    return {
        jobId: `${now}_${Math.random().toString(16).slice(2, 10)}`,
        nonce: generateNonce(),
        createdAt: now,
        expiresAt: now + ttlMs,
        ...payload
    };
}

export async function loadPendingJobs() {
    const data = await chrome.storage.local.get([NLM_PENDING_JOBS_KEY]);
    const list = Array.isArray(data[NLM_PENDING_JOBS_KEY]) ? data[NLM_PENDING_JOBS_KEY] : [];
    return list;
}

export async function savePendingJobs(list) {
    const safe = Array.isArray(list) ? list : [];
    await chrome.storage.local.set({ [NLM_PENDING_JOBS_KEY]: safe });
    return safe;
}

export async function addPendingJob(job) {
    const list = await loadPendingJobs();
    list.push(job);
    await savePendingJobs(list);
    return job;
}

export async function takePendingJob(jobId) {
    const list = await loadPendingJobs();
    let found = null;
    const next = list.filter((job) => {
        if (!job || job.jobId !== jobId) return true;
        found = job;
        return false;
    });
    await savePendingJobs(next);
    return found;
}

export async function peekPendingJob(jobId) {
    const list = await loadPendingJobs();
    return list.find((job) => job?.jobId === jobId) || null;
}

export function isJobExpired(job) {
    if (!job) return true;
    return Date.now() > (job.expiresAt || 0);
}

