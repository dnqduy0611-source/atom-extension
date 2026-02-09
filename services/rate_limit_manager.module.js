// services/rate_limit_manager.module.js
// Shared rate limiting + queue manager for Gemini API calls (ES module)

import { RateLimitMetrics } from './rate_limit_metrics.js';

const DEFAULT_CONFIG = {
    rpmTotal: 15,
    rpmBackground: 10,
    cacheTtlMs: 5 * 60 * 1000
};

const STORAGE_KEY = 'atom_rate_limit_state_v1';

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
        this.REPEATED_429_THRESHOLD = 2;
        this.GLOBAL_COOLDOWN_MS = 30000;
        this.storageKey = typeof config.storageKey === 'string' ? config.storageKey : STORAGE_KEY;
        this.persistState = config.persistState !== false;

        // Quota tracking
        this.quota = {
            requestsThisMinute: 0,
            errors429Recent: 0,
            lastMinuteReset: Date.now(),
            lastStatusLevel: 'normal'  // 'normal', 'warning', 'critical'
        };

        // Warning thresholds (based on 15 RPM limit)
        this.WARNING_THRESHOLDS = {
            rpmWarning: Math.floor(this.config.rpmTotal * 0.8),      // 80% = 12
            rpmCritical: Math.floor(this.config.rpmTotal * 0.93),   // 93% = 14
            errors429Warning: 3,
            errors429Critical: 5
        };

        // Event listeners for UI updates
        this._listeners = new Map();

        // Block all requests until persisted state is loaded
        this._readyPromise = this._loadPersistedState().catch((err) => {
            console.warn('[RateLimit] Failed to load state:', err);
        });
        this._startQuotaResetTimer();
    }

    setCooldown(ms, reason = '') {
        const until = Date.now() + Math.max(0, ms || 0);
        if (until > this.cooldownUntil) {
            this.cooldownUntil = until;
            if (reason) {
                console.warn('[RateLimit] Cooldown set:', reason, ms);
            }
            this.metrics.record('cooldown');
            this._persistState();
            return true;
        }
        return false;
    }

    record429Error(source = 'unknown') {
        const now = Date.now();
        this._pruneRecentErrors(now);
        this.recentErrors.push({ timestamp: now, source });
        this.metrics.record('429', { source });
        this._trackError429();  // Track for quota warning

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

    /**
     * Check if currently in cooldown
     * @returns {boolean}
     */
    isInCooldown() {
        return Date.now() < this.cooldownUntil;
    }

    /**
     * Get remaining cooldown time in ms
     * @returns {number}
     */
    getCooldownRemainingMs() {
        return Math.max(0, this.cooldownUntil - Date.now());
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

        if (this._readyPromise) {
            await this._readyPromise;
        }

        this.metrics.record('request', { priority: priorityLabel });

        // If skipDuringCooldown is set and we're in cooldown, reject immediately
        if (skipDuringCooldown && !allowDuringCooldown && this.isInCooldown()) {
            this.metrics.record('skipped_cooldown');
            return Promise.reject(new Error(`Rate limit cooldown active, ${Math.ceil(this.getCooldownRemainingMs() / 1000)}s remaining`));
        }

        if (cacheKey) {
            const cached = this._getCache(cacheKey);
            if (cached !== null) {
                this.metrics.record('cache_hit');
                return Promise.resolve(cached);
            }
            this.metrics.record('cache_miss');
        }


        return new Promise((resolve, reject) => {
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
            const job = this.queue.shift();
            if (!job) break;

            await this._waitForSlot(job);

            try {
                const result = await job.task();
                this._trackRequest();  // Track for quota warning
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

    /**
     * Get debug state for visualization
     * @returns {Object} Current rate limiter state
     */
    getDebugState() {
        const now = Date.now();
        const cooldownRemaining = Math.max(0, this.cooldownUntil - now);
        return {
            cooldownUntil: this.cooldownUntil,
            cooldownRemainingMs: cooldownRemaining,
            cooldownRemainingSec: Math.ceil(cooldownRemaining / 1000),
            isInCooldown: cooldownRemaining > 0,
            queueLength: this.queue.length,
            isProcessing: this.running,
            recentErrors: this.recentErrors.map(e => ({
                ...e,
                ageMs: now - e.timestamp,
                ageSec: Math.floor((now - e.timestamp) / 1000)
            })),
            config: {
                rpmTotal: this.config.rpmTotal,
                rpmBackground: this.config.rpmBackground,
                cacheTtlMs: this.config.cacheTtlMs
            },
            metrics: this.getMetrics()
        };
    }

    /**
     * Subscribe to rate limit events
     * @param {string} event - Event name: 'status_change', 'cooldown_start', 'cooldown_end'
     * @param {Function} callback - Event handler
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
    }

    /**
     * Unsubscribe from events
     */
    off(event, callback) {
        if (!this._listeners.has(event)) return;
        const callbacks = this._listeners.get(event);
        const idx = callbacks.indexOf(callback);
        if (idx !== -1) callbacks.splice(idx, 1);
    }

    /**
     * Emit event to all listeners
     */
    _emitEvent(event, data = {}) {
        if (!this._listeners.has(event)) return;
        for (const callback of this._listeners.get(event)) {
            try {
                callback(data);
            } catch (e) {
                console.warn('[RateLimit] Event listener error:', e);
            }
        }
    }

    /**
     * Start timer to reset quota every minute
     */
    _startQuotaResetTimer() {
        setInterval(() => {
            const now = Date.now();
            if (now - this.quota.lastMinuteReset >= 60000) {
                this.quota.requestsThisMinute = 0;
                this.quota.lastMinuteReset = now;
                this._checkAndUpdateStatus();
            }
        }, 5000);  // Check every 5 seconds
    }

    /**
     * Track a request for quota purposes
     */
    _trackRequest() {
        this.quota.requestsThisMinute++;
        this._checkAndUpdateStatus();
    }

    /**
     * Track 429 error for quota/warning purposes
     */
    _trackError429() {
        this.quota.errors429Recent++;
        this._checkAndUpdateStatus();
        // Decay error count after 10 minutes
        setTimeout(() => {
            this.quota.errors429Recent = Math.max(0, this.quota.errors429Recent - 1);
            this._checkAndUpdateStatus();
        }, 10 * 60 * 1000);
    }

    /**
     * Check quota status and emit event if changed
     */
    _checkAndUpdateStatus() {
        let newLevel = 'normal';
        const { rpmWarning, rpmCritical, errors429Warning, errors429Critical } = this.WARNING_THRESHOLDS;

        // Check if in cooldown
        if (this.isInCooldown()) {
            newLevel = 'critical';
        }
        // Check 429 error count
        else if (this.quota.errors429Recent >= errors429Critical) {
            newLevel = 'critical';
        } else if (this.quota.errors429Recent >= errors429Warning) {
            newLevel = 'warning';
        }
        // Check RPM
        else if (this.quota.requestsThisMinute >= rpmCritical) {
            newLevel = 'critical';
        } else if (this.quota.requestsThisMinute >= rpmWarning) {
            newLevel = 'warning';
        }

        if (newLevel !== this.quota.lastStatusLevel) {
            this.quota.lastStatusLevel = newLevel;
            this._emitEvent('status_change', {
                level: newLevel,
                requestsThisMinute: this.quota.requestsThisMinute,
                rpmLimit: this.config.rpmTotal,
                errors429Recent: this.quota.errors429Recent,
                cooldownRemainingSec: Math.ceil(this.getCooldownRemainingMs() / 1000)
            });
        }
    }

    /**
     * Get current quota status
     */
    getQuotaStatus() {
        return {
            level: this.quota.lastStatusLevel,
            requestsThisMinute: this.quota.requestsThisMinute,
            rpmLimit: this.config.rpmTotal,
            rpmPercent: Math.round((this.quota.requestsThisMinute / this.config.rpmTotal) * 100),
            errors429Recent: this.quota.errors429Recent,
            isInCooldown: this.isInCooldown(),
            cooldownRemainingSec: Math.ceil(this.getCooldownRemainingMs() / 1000)
        };
    }

    /**
     * Clear cooldown manually (for debugging)
     */
    clearCooldown() {
        this.cooldownUntil = 0;
        this.recentErrors = [];
        this.quota.errors429Recent = 0;
        this._persistState();
        this._checkAndUpdateStatus();
        console.log('[RateLimit] Cooldown cleared manually');
    }
}

function parseRetryAfterSeconds(message) {
    if (!message) return null;
    const text = String(message);
    const match = text.match(/retry in\\s+([0-9.]+)\\s*s/i);
    if (!match) return null;
    const seconds = Number.parseFloat(match[1]);
    return Number.isFinite(seconds) ? seconds : null;
}

export { RateLimitManager, parseRetryAfterSeconds };
