// services/rate_limit_manager.js
// Shared rate limiting + queue manager for Gemini API calls (window/global usage)

const DEFAULT_CONFIG = {
    rpmTotal: 20,
    rpmBackground: 12,
    cacheTtlMs: 5 * 60 * 1000
};

const STORAGE_KEY = 'atom_rate_limit_state_v1';

class RateLimitMetrics {
    constructor() {
        this.stats = {
            totalRequests: 0,
            vipRequests: 0,
            backgroundRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors429: 0,
            errors5xx: 0,
            retries: 0,
            fallbackUsed: 0,
            avgWaitTimeMs: 0,
            maxQueueLength: 0,
            cooldownsTriggered: 0
        };
        this.waitTimes = [];
        this.MAX_WAIT_TIMES = 100;
    }

    record(event, data = {}) {
        switch (event) {
            case 'request':
                this.stats.totalRequests += 1;
                if (data.priority === 'vip') {
                    this.stats.vipRequests += 1;
                } else {
                    this.stats.backgroundRequests += 1;
                }
                break;
            case 'cache_hit':
                this.stats.cacheHits += 1;
                break;
            case 'cache_miss':
                this.stats.cacheMisses += 1;
                break;
            case '429':
                this.stats.errors429 += 1;
                break;
            case '5xx':
                this.stats.errors5xx += 1;
                break;
            case 'retry':
                this.stats.retries += 1;
                break;
            case 'fallback':
                this.stats.fallbackUsed += 1;
                break;
            case 'wait':
                this.waitTimes.push(data.ms);
                if (this.waitTimes.length > this.MAX_WAIT_TIMES) {
                    this.waitTimes.shift();
                }
                this.stats.avgWaitTimeMs = Math.round(
                    this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
                );
                break;
            case 'queue_length':
                this.stats.maxQueueLength = Math.max(this.stats.maxQueueLength, data.length);
                break;
            case 'cooldown':
                this.stats.cooldownsTriggered += 1;
                break;
            default:
                break;
        }
    }

    getStats() {
        return { ...this.stats, timestamp: Date.now() };
    }

    reset() {
        Object.keys(this.stats).forEach((key) => {
            this.stats[key] = 0;
        });
        this.waitTimes = [];
    }

    log() {
        console.log('[RateLimit Metrics]', this.getStats());
    }
}

class RateLimitManager {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...(config || {}) };
        this.queue = [];
        this.running = false;
        this.cooldownUntil = 0;
        this.lastAnyAt = 0;
        this.lastBackgroundAt = 0;
        this.cache = new Map();
        this.metrics = new RateLimitMetrics();
        this.recentErrors = [];
        this.REPEATED_429_WINDOW_MS = 60000;
        this.REPEATED_429_THRESHOLD = 3;  // Increased from 2 to tolerate burst traffic
        this.GLOBAL_COOLDOWN_MS = 30000;
        this.PROBATION_MS = 15000;  // Reduced to 15s probation to improve UX
        this.probationUntil = 0;    // During probation, only VIP requests pass
        this.storageKey = typeof config.storageKey === 'string' ? config.storageKey : STORAGE_KEY;
        this.persistState = config.persistState !== false;

        // Block requests until state is loaded
        this._readyPromise = this._loadPersistedState().catch(err => {
            console.warn('[RateLimit] Failed to load state:', err);
        });

        this._setupStorageListener();
    }

    /**
     * Listen for storage changes to sync state across contexts (sidepanel ↔ background)
     */
    _setupStorageListener() {
        if (typeof chrome === 'undefined' || !chrome?.storage?.onChanged) return;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[this.storageKey]) return;
            const newVal = changes[this.storageKey].newValue;
            if (!newVal || typeof newVal !== 'object') return;
            const now = Date.now();
            // Sync cooldownUntil if the remote value is more restrictive
            if (Number.isFinite(newVal.cooldownUntil) && newVal.cooldownUntil > this.cooldownUntil) {
                this.cooldownUntil = newVal.cooldownUntil;
            }
            // Sync probationUntil
            if (Number.isFinite(newVal.probationUntil) && newVal.probationUntil > this.probationUntil) {
                this.probationUntil = newVal.probationUntil;
            }
            // Merge recentErrors (keep unique by timestamp)
            if (Array.isArray(newVal.recentErrors)) {
                const existingTs = new Set(this.recentErrors.map(e => e.timestamp));
                newVal.recentErrors.forEach(entry => {
                    if (entry?.timestamp && !existingTs.has(entry.timestamp) && now - entry.timestamp < this.REPEATED_429_WINDOW_MS) {
                        this.recentErrors.push(entry);
                    }
                });
            }
        });
    }

    setCooldown(ms, reason = '') {
        const until = Date.now() + Math.max(0, ms || 0);
        if (until > this.cooldownUntil) {
            this.cooldownUntil = until;
            // Probation starts when cooldown ends
            this.probationUntil = until + this.PROBATION_MS;
            if (reason) {
                console.warn('[RateLimit] Cooldown set:', reason, ms, '| Probation until:', new Date(this.probationUntil).toLocaleTimeString());
            }
            this.metrics.record('cooldown');
            this._persistState();
            return true;
        }
        return false;
    }

    /**
     * Reset all rate limit state (cooldown + errors + probation)
     * Call this when switching API keys to start fresh
     */
    reset() {
        this.cooldownUntil = 0;
        this.probationUntil = 0;
        this.recentErrors = [];
        this._persistState();
        console.log('[RateLimit] State reset');
    }

    /**
     * Reset only the cooldown block, keep metrics
     * Call this for soft reset (e.g., user retry)
     */
    resetCooldown() {
        this.cooldownUntil = 0;
        this.probationUntil = 0;
        this._persistState();
        console.log('[RateLimit] Cooldown reset');
    }

    /**
     * Check if currently in probation mode
     * @returns {boolean}
     */
    isInProbation() {
        const now = Date.now();
        return now >= this.cooldownUntil && now < this.probationUntil;
    }

    /**
     * Check if in cooldown (hard block)
     * @returns {boolean}
     */
    isInCooldown() {
        return Date.now() < this.cooldownUntil;
    }

    /**
     * Get remaining probation time in seconds
     * @returns {number}
     */
    getProbationRemainingSec() {
        const remaining = this.probationUntil - Date.now();
        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }

    record429Error(source = 'unknown') {
        // Prevent infinite loops: If already in cooldown, ignore further 429s (real or artificial)
        // This ensures background tasks failing during cooldown don't extend the penalty
        if (this.isInCooldown()) {
            console.log('[RateLimit] Ignoring 429/Block during cooldown to prevent loop:', source);
            return false; // Do not extend cooldown
        }

        const now = Date.now();
        this._pruneRecentErrors(now);
        this.recentErrors.push({ timestamp: now, source });
        this.metrics.record('429', { source });

        let thresholdHit = false;
        if (this.recentErrors.length >= this.REPEATED_429_THRESHOLD) {
            thresholdHit = true;
            const applied = this.setCooldown(this.GLOBAL_COOLDOWN_MS, 'repeated-429-threshold');
            if (!applied) {
                console.warn('[RateLimit] Cooldown set:', 'repeated-429-threshold', this.GLOBAL_COOLDOWN_MS);
            }
            this.recentErrors = [];
        }

        this._persistState();
        return thresholdHit;
    }

    async enqueue(task, options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const priority = opts.priority === 'vip' ? 1 : 0;
        const cacheKey = typeof opts.cacheKey === 'string' ? opts.cacheKey : '';
        const cacheTtlMs = Number.isFinite(opts.cacheTtlMs) ? opts.cacheTtlMs : this.config.cacheTtlMs;
        const allowDuringCooldown = typeof opts.allowDuringCooldown === 'boolean'
            ? opts.allowDuringCooldown
            : priority === 1;
        const skipDuringCooldown = opts.skipDuringCooldown === true;
        const priorityLabel = priority === 1 ? 'vip' : 'background';

        this.metrics.record('request', { priority: priorityLabel });

        if (cacheKey) {
            const cached = this._getCache(cacheKey);
            if (cached !== null) {
                this.metrics.record('cache_hit');
                return cached;
            }
            this.metrics.record('cache_miss');
        }

        // Wait for RateLimitManager to perform initial load of persisted state
        if (this._readyPromise) {
            await this._readyPromise;
        }

        return new Promise((resolve, reject) => {
            // Check implicit probation/cooldown blocks
            if (priority === 0) {
                // If in probation, reject immediately
                if (this.isInProbation()) {
                    const probSec = this.getProbationRemainingSec();
                    console.log(`[RateLimit] Probation active: rejecting background task. ${probSec}s remaining.`);
                    reject(new Error(`PROBATION_ACTIVE:${probSec}`));
                    return;
                }
                // If in cooldown and skipDuringCooldown is requested, reject immediately
                if (this.isInCooldown() && skipDuringCooldown) {
                    const waitSec = Math.ceil((this.cooldownUntil - Date.now()) / 1000);
                    console.log(`[RateLimit] Cooldown active: skipping background task. ${waitSec}s remaining.`);
                    reject(new Error(`COOLDOWN_ACTIVE:${waitSec}`));
                    return;
                }
            }

            this.queue.push({
                task,
                resolve,
                reject,
                priority,
                cacheKey,
                cacheTtlMs,
                allowDuringCooldown,
                enqueuedAt: Date.now()
            });
            this._processQueue();
        });
    }

    async _processQueue() {
        if (this.running) return;
        this.running = true;

        while (this.queue.length > 0) {
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) return b.priority - a.priority;
                return a.enqueuedAt - b.enqueuedAt;
            });

            this.metrics.record('queue_length', { length: this.queue.length });

            // Check if next job is background and we are in probation
            // This catches jobs that were queued before probation started (e.g. during cooldown)
            // or if probation started while queue was processing
            const nextJob = this.queue[0];
            if (nextJob && nextJob.priority === 0 && this.isInProbation()) {
                const probSec = this.getProbationRemainingSec();
                console.log(`[RateLimit] Probation active: pruning background task from queue. ${probSec}s remaining.`);
                const popped = this.queue.shift();
                popped.reject(new Error(`PROBATION_ACTIVE:${probSec}`));
                continue;
            }

            const job = this.queue.shift();
            if (!job) break;

            await this._waitForSlot(job);

            try {
                const result = await job.task();
                if (job.cacheKey) {
                    this._setCache(job.cacheKey, result, job.cacheTtlMs);
                }
                job.resolve(result);
            } catch (err) {
                job.reject(err);
            }
        }

        this.running = false;
    }

    async _waitForSlot(job) {
        const now = Date.now();
        if (job.priority === 0 && !job.allowDuringCooldown && now < this.cooldownUntil) {
            await this._sleep(this.cooldownUntil - now);
        }

        const minVipInterval = 60000 / Math.max(1, this.config.rpmTotal);
        const minBgInterval = 60000 / Math.max(1, this.config.rpmBackground);

        const sinceAny = Date.now() - this.lastAnyAt;
        const sinceBg = Date.now() - this.lastBackgroundAt;

        let waitMs = Math.max(0, minVipInterval - sinceAny);
        if (job.priority === 0) {
            waitMs = Math.max(waitMs, minBgInterval - sinceBg);
        }

        if (waitMs > 0) {
            this.metrics.record('wait', { ms: waitMs });
            await this._sleep(waitMs);
        }

        this.lastAnyAt = Date.now();
        if (job.priority === 0) {
            this.lastBackgroundAt = this.lastAnyAt;
        }
    }

    _canUseStorage() {
        return this.persistState && typeof chrome !== 'undefined' && chrome?.storage?.local;
    }

    async _loadPersistedState() {
        if (!this._canUseStorage()) return;
        try {
            const data = await chrome.storage.local.get([this.storageKey]);
            const state = data ? data[this.storageKey] : null;
            if (!state || typeof state !== 'object') return;

            const now = Date.now();
            if (Number.isFinite(state.cooldownUntil) && state.cooldownUntil > now) {
                this.cooldownUntil = state.cooldownUntil;
            }
            if (Number.isFinite(state.probationUntil) && state.probationUntil > now) {
                this.probationUntil = state.probationUntil;
            }
            if (Array.isArray(state.recentErrors)) {
                this.recentErrors = state.recentErrors.filter((entry) => {
                    if (!entry || !Number.isFinite(entry.timestamp)) return false;
                    return now - entry.timestamp < this.REPEATED_429_WINDOW_MS;
                });
            }
        } catch {
            // Ignore storage errors
        }
    }

    _persistState() {
        if (!this._canUseStorage()) return;
        try {
            const payload = {
                cooldownUntil: this.cooldownUntil,
                probationUntil: this.probationUntil,
                recentErrors: this.recentErrors
            };
            const maybePromise = chrome.storage.local.set({ [this.storageKey]: payload });
            if (maybePromise && typeof maybePromise.catch === 'function') {
                maybePromise.catch(() => { });
            }
        } catch {
            // Ignore storage errors
        }
    }

    _pruneRecentErrors(now) {
        this.recentErrors = this.recentErrors.filter(
            entry => entry && Number.isFinite(entry.timestamp)
                && now - entry.timestamp < this.REPEATED_429_WINDOW_MS
        );
    }

    _getCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    _setCache(key, value, ttlMs) {
        this.cache.set(key, { value, expiry: Date.now() + Math.max(0, ttlMs) });
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    recordRetry() {
        this.metrics.record('retry');
    }

    recordFallback() {
        this.metrics.record('fallback');
    }

    recordServerError() {
        this.metrics.record('5xx');
    }

    getMetrics() {
        return this.metrics.getStats();
    }

    logMetrics() {
        this.metrics.log();
    }
}

function parseRetryAfterSeconds(message) {
    if (!message) return null;
    const text = String(message);
    const match = text.match(/retry in\s+([0-9.]+)\s*s/i);
    if (!match) return null;
    const seconds = Number.parseFloat(match[1]);
    return Number.isFinite(seconds) ? seconds : null;
}

if (typeof window !== 'undefined') {
    window.RateLimitManager = RateLimitManager;
    window.parseRetryAfterSeconds = parseRetryAfterSeconds;
}
