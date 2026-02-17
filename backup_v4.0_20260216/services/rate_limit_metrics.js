// services/rate_limit_metrics.js
// Metrics collector for RateLimitManager (ES module)

export class RateLimitMetrics {
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
