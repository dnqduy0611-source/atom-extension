# Rate Limit Implementation Plan

**Reference:** [RATE_LIMIT_STRATEGY.md](./RATE_LIMIT_STRATEGY.md)
**Status:** Ready for implementation
**Priority:** High - Reduces 429 errors by 70%+

---

## Current State Summary

| Phase | Completion | Key Gaps |
|-------|------------|----------|
| Phase 1: Queue + Concurrency | 90% | Missing rate decision logging |
| Phase 2: 429 Backoff + Retry | 75% | Missing repeated 429 tracking |
| Phase 3: Smart Caching | 70% | Inconsistent TTL, VIP bypass |
| Phase 4: Model Fallback | 40% | Only partial fallback on 400 |
| Phase 5: UX & Telemetry | 30% | No metrics, no debug panel |

---

## Implementation Tasks

### Task 1: Enhanced 429 Tracking & Global Cooldown
**Priority:** P0
**Files:** `services/rate_limit_manager.module.js`

#### 1.1 Track repeated 429 errors
```javascript
// Add to RateLimitManager class
this.recentErrors = [];  // { timestamp, source }
this.REPEATED_429_WINDOW_MS = 60000;  // 1 minute
this.REPEATED_429_THRESHOLD = 2;
this.GLOBAL_COOLDOWN_MS = 30000;  // 30s cooldown when threshold hit
```

#### 1.2 Implementation
```javascript
record429Error(source = 'unknown') {
    const now = Date.now();
    // Clean old errors
    this.recentErrors = this.recentErrors.filter(
        e => now - e.timestamp < this.REPEATED_429_WINDOW_MS
    );
    this.recentErrors.push({ timestamp: now, source });

    // Check threshold
    if (this.recentErrors.length >= this.REPEATED_429_THRESHOLD) {
        this.setCooldown(this.GLOBAL_COOLDOWN_MS, 'repeated-429-threshold');
        this.recentErrors = []; // Reset after cooldown
        return true; // Indicates global cooldown triggered
    }
    return false;
}
```

#### 1.3 Update callers
- `ai_service.js:297-307` - Call `rateManager.record429Error('ai-service')`
- `sidepanel.js:2363-2375` - Call `record429Error('smartlink')`
- `sidepanel.js:3641-3653` - Call `record429Error('sidepanel-chat')`
- `background.js:1619-1627` - Call `record429Error('reading')`

#### Acceptance Criteria
- [ ] 2+ 429 errors within 1 minute triggers 30s global cooldown
- [ ] All background tasks pause during global cooldown
- [ ] VIP tasks still allowed but throttled
- [ ] Console logs show "repeated-429-threshold" when triggered

---

### Task 2: Model Fallback for 429 Errors
**Priority:** P0
**Files:** `ai_service.js`, `config/ai_config.js`

#### 2.1 Add fallback logic to `_callCloudGemini`
```javascript
async _callCloudGemini(prompt, responseSchema, timeoutMs = 8000, retries = 1, options = {}) {
    const { modelOverride = '', priority = 'background', allowFallback = true } = options;

    // ... existing code ...

    // On 429, try fallback model for background tasks
    if (response.status === 429 && priority === 'background' && allowFallback && !modelOverride) {
        const fallbackModel = getModel('USER', true); // Get fallback
        console.log('[ATOM AI] 429 received, trying fallback model:', fallbackModel);
        return this._callCloudGemini(prompt, responseSchema, timeoutMs, 0, {
            ...options,
            modelOverride: fallbackModel,
            allowFallback: false  // Prevent infinite loop
        });
    }
}
```

#### 2.2 Ensure VIP never uses fallback
```javascript
// In sidepanel.js callGeminiAPI
const rateOptions = {
    priority: isUserChat ? 'vip' : 'background',
    allowFallback: !isUserChat  // VIP = no fallback
};
```

#### Acceptance Criteria
- [ ] Background tasks retry with fallback model on 429
- [ ] VIP chat always uses primary model
- [ ] Fallback only attempted once (no infinite loop)
- [ ] Console logs model switch

---

### Task 3: Consistent Caching Strategy
**Priority:** P1
**Files:** `services/rate_limit_manager.module.js`, `ai_service.js`, `sidepanel.js`, `config/ai_config.js`

#### 3.1 Centralize cache TTL config
```javascript
// config/ai_config.js - Add to AI_CONFIG
CACHE: {
    STRATEGY_TTL_MS: 30000,      // 30s for strategy
    PILOT_TTL_MS: 300000,        // 5 min (spec says 5 min, not 15s)
    SMARTLINK_TTL_MS: 600000,    // 10 min
    RELATED_MEMORY_TTL_MS: 600000, // 10 min
    DEFAULT_BACKGROUND_TTL_MS: 300000, // 5 min
    VIP_CACHE_ENABLED: false     // VIP should not cache
}
```

#### 3.2 Update AI Pilot cache TTL
```javascript
// ai_pilot_service.js - Line 240
const cacheTtlMs = options.cacheTtlMs ?? AI_CONFIG.CACHE.PILOT_TTL_MS; // Now 5 min
```

#### 3.3 Ensure VIP bypass cache
```javascript
// sidepanel.js - callGeminiAPI
const rateOptions = {
    priority: isUserChat ? 'vip' : 'background',
    cacheKey: isUserChat ? null : cacheKey,  // VIP = no cache
    cacheTtlMs: isUserChat ? 0 : AI_CONFIG.CACHE.DEFAULT_BACKGROUND_TTL_MS
};
```

#### Acceptance Criteria
- [ ] AI Pilot uses 5 min cache (not 15s)
- [ ] SmartLink uses 10 min cache
- [ ] VIP chat never caches responses
- [ ] All TTL values from centralized config

---

### Task 4: Metrics & Logging System
**Priority:** P1
**Files:** `services/rate_limit_manager.module.js` (new: `services/rate_limit_metrics.js`)

#### 4.1 Create metrics collector
```javascript
// services/rate_limit_metrics.js
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
        this.MAX_WAIT_TIMES = 100; // Rolling window
    }

    record(event, data = {}) {
        switch (event) {
            case 'request':
                this.stats.totalRequests++;
                if (data.priority === 'vip') this.stats.vipRequests++;
                else this.stats.backgroundRequests++;
                break;
            case 'cache_hit':
                this.stats.cacheHits++;
                break;
            case 'cache_miss':
                this.stats.cacheMisses++;
                break;
            case '429':
                this.stats.errors429++;
                break;
            case '5xx':
                this.stats.errors5xx++;
                break;
            case 'retry':
                this.stats.retries++;
                break;
            case 'fallback':
                this.stats.fallbackUsed++;
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
                this.stats.cooldownsTriggered++;
                break;
        }
    }

    getStats() {
        return { ...this.stats, timestamp: Date.now() };
    }

    reset() {
        Object.keys(this.stats).forEach(k => this.stats[k] = 0);
        this.waitTimes = [];
    }

    log() {
        console.log('[RateLimit Metrics]', this.getStats());
    }
}
```

#### 4.2 Integrate with RateLimitManager
```javascript
// rate_limit_manager.module.js
import { RateLimitMetrics } from './rate_limit_metrics.js';

class RateLimitManager {
    constructor(config = {}) {
        // ... existing ...
        this.metrics = new RateLimitMetrics();
    }

    async _waitForSlot(job) {
        // ... existing code ...
        if (waitMs > 0) {
            this.metrics.record('wait', { ms: waitMs });
            await this._sleep(waitMs);
        }
    }

    async _processQueue() {
        // ... existing ...
        this.metrics.record('queue_length', { length: this.queue.length });
    }
}
```

#### 4.3 Expose metrics API
```javascript
// Add to RateLimitManager
getMetrics() {
    return this.metrics.getStats();
}

logMetrics() {
    this.metrics.log();
}
```

#### Acceptance Criteria
- [ ] Track total requests, VIP vs background
- [ ] Track cache hit/miss rate
- [ ] Track 429 and 5xx error counts
- [ ] Track retry and fallback usage
- [ ] Track average wait time
- [ ] Track max queue length
- [ ] Metrics accessible via `rateManager.getMetrics()`

---

### Task 5: UX Improvements
**Priority:** P2
**Files:** `sidepanel.js`, `styles.css`

#### 5.1 Add "Retrying..." state
```javascript
// sidepanel.js - In retry loop
function showRetryingState(attempt, maxAttempts) {
    const statusEl = document.getElementById('ai-status');
    if (statusEl) {
        statusEl.textContent = `Retrying (${attempt}/${maxAttempts})...`;
        statusEl.className = 'status-retrying';
    }
}
```

#### 5.2 Suppress 429 error popups
```javascript
// Instead of error toast, show warning
if (response.status === 429) {
    showWarningToast(getMessage('rate_limit_warning', null, 'Please wait a moment...'));
    // Don't show error toast
    return;
}
```

#### 5.3 Add CSS for states
```css
/* styles.css */
.status-retrying {
    color: #f59e0b;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}
```

#### Acceptance Criteria
- [ ] "Retrying..." shown during retry attempts
- [ ] No red error popup for 429
- [ ] Warning toast instead of error toast
- [ ] Visual feedback during rate limit delays

---

### Task 6: Debug Panel (Optional)
**Priority:** P2
**Files:** `sidepanel.html`, `sidepanel.js`

#### 6.1 Add debug toggle
```html
<!-- sidepanel.html - Hidden debug section -->
<div id="rate-limit-debug" class="debug-panel hidden">
    <h4>Rate Limit Stats</h4>
    <pre id="rate-limit-stats"></pre>
    <button id="reset-rate-stats">Reset</button>
</div>
```

#### 6.2 Keyboard shortcut to toggle
```javascript
// Ctrl+Shift+D to toggle debug panel
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        const panel = document.getElementById('rate-limit-debug');
        panel?.classList.toggle('hidden');
        if (!panel?.classList.contains('hidden')) {
            updateDebugPanel();
        }
    }
});

function updateDebugPanel() {
    const stats = rateManager.getMetrics();
    document.getElementById('rate-limit-stats').textContent =
        JSON.stringify(stats, null, 2);
}
```

#### Acceptance Criteria
- [ ] Ctrl+Shift+D toggles debug panel
- [ ] Shows current rate limit stats
- [ ] Reset button clears metrics

---

## File Changes Summary

| File | Changes |
|------|---------|
| `services/rate_limit_manager.module.js` | Add 429 tracking, metrics integration |
| `services/rate_limit_metrics.js` | **NEW** - Metrics collector class |
| `config/ai_config.js` | Centralize cache TTL config |
| `ai_service.js` | Add model fallback on 429, record errors |
| `ai_pilot_service.js` | Update cache TTL to 5 min |
| `sidepanel.js` | VIP cache bypass, retry UI, record errors |
| `background.js` | Record 429 errors |
| `styles.css` | Add retrying animation |

---

## Implementation Order

```
Week 1:
├── Task 1: Enhanced 429 Tracking (P0)
│   ├── 1.1 Add tracking to RateLimitManager
│   ├── 1.2 Update all callers
│   └── 1.3 Test threshold behavior
│
└── Task 2: Model Fallback (P0)
    ├── 2.1 Add fallback logic
    ├── 2.2 Ensure VIP protection
    └── 2.3 Test fallback works

Week 2:
├── Task 3: Consistent Caching (P1)
│   ├── 3.1 Centralize TTL config
│   ├── 3.2 Update AI Pilot TTL
│   └── 3.3 VIP cache bypass
│
└── Task 4: Metrics System (P1)
    ├── 4.1 Create metrics collector
    ├── 4.2 Integrate with manager
    └── 4.3 Expose API

Week 3 (Optional):
├── Task 5: UX Improvements (P2)
│   ├── 5.1 Retrying state
│   ├── 5.2 Suppress 429 popups
│   └── 5.3 CSS animations
│
└── Task 6: Debug Panel (P2)
    ├── 6.1 HTML structure
    └── 6.2 Keyboard shortcut
```

---

## Testing Checklist

### Unit Tests
- [ ] `RateLimitManager.record429Error()` triggers cooldown at threshold
- [ ] `RateLimitMetrics.record()` tracks all event types
- [ ] Cache TTL values match config
- [ ] VIP requests bypass cache

### Integration Tests
- [ ] Simulate 3 rapid 429 errors → global cooldown triggers
- [ ] Background task on 429 → retries with fallback model
- [ ] VIP task on 429 → stays on primary model
- [ ] Metrics update correctly during real requests

### Manual Tests
- [ ] Open extension, trigger rate limit, see "Retrying..." state
- [ ] No red error popup on 429
- [ ] Ctrl+Shift+D shows debug panel with stats
- [ ] Stats show realistic values after usage

---

## Success Metrics

After implementation:
- 429 errors reduced by **70%+** (target from spec)
- VIP chat response time under **2s** average
- Background tasks stable without user-visible errors
- Debug panel accessible for troubleshooting
