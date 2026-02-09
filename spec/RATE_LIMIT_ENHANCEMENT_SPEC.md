# Rate Limit Enhancement Specification

> **Version**: 1.0  
> **Created**: 2026-02-03  
> **Status**: Draft

## Overview

Implement 3 features to improve rate limit handling and prevent quota exhaustion loops.

---

## Feature 1: Quota Warning Display

### Goal
Show user-friendly alerts when API quota is running low, before hitting hard rate limits.

### Implementation

#### 1.1 Quota Tracking Metrics
```javascript
// Add to RateLimitManager
quotaState: {
    requestsThisMinute: 0,
    requestsToday: 0,
    errors429Today: 0,
    lastResetMinute: Date.now(),
    lastResetDay: Date.now()
}
```

#### 1.2 Warning Thresholds
| Metric | Yellow Warning | Red Warning |
|--------|---------------|-------------|
| RPM (15 limit) | 12 requests/min | 14 requests/min |
| RPD (1500 limit) | 1200 requests/day | 1400 requests/day |
| 429 errors | 3 in 10 min | 5 in 10 min |

#### 1.3 UI Display
- **Location**: Status bar in Side Panel header
- **States**:
  - 🟢 Normal: No indicator
  - 🟡 Warning: "Quota: 80%" + tooltip with details
  - 🔴 Critical: "Rate Limited - Wait Xs" with countdown

#### 1.4 Files to Modify
- `services/rate_limit_manager.module.js` — Add quota tracking
- `sidepanel.js` — Subscribe to quota events
- `sidepanel.html` — Add quota indicator UI

---

## Feature 2: Auto-Pause Background Tasks

### Goal
Automatically pause non-critical background tasks when cooldown is active to preserve quota for user interactions.

### Implementation

#### 2.1 Task Priority Classification
| Priority | Tasks | Behavior During Cooldown |
|----------|-------|-------------------------|
| **VIP (1)** | Chat, User-initiated actions | ✅ Continue (may queue) |
| **Background (0)** | SmartLink, AI Pilot, Auto-summary | ⏸️ Skip immediately |
| **Deferred (-1)** | Analytics, Prefetch | ❌ Cancel |

#### 2.2 Pause Mechanism
```javascript
// RateLimitManager additions
pauseBackgroundTasks() {
    this.backgroundPaused = true;
    this.pausedAt = Date.now();
    this._emitEvent('background_paused');
}

resumeBackgroundTasks() {
    this.backgroundPaused = false;
    this._emitEvent('background_resumed');
}

// Auto-resume when cooldown ends
onCooldownEnd() {
    if (this.backgroundPaused) {
        this.resumeBackgroundTasks();
    }
}
```

#### 2.3 Tasks to Apply `skipDuringCooldown: true`
- [x] SmartLink (already done)
- [ ] AI Pilot decision calls (`background.js`)
- [ ] Active Reading analysis (`background.js`)
- [ ] Related Memory lookup (`sidepanel.js`)
- [ ] Knowledge Graph updates (`sidepanel.js`)
- [ ] Auto-summary generation

#### 2.4 Files to Modify
- `services/rate_limit_manager.module.js` — Add pause/resume
- `background.js` — Apply to AI Pilot, Reading
- `sidepanel.js` — Apply to Related Memory, KG
- `ai_service.js` — Respect pause state

---

## Feature 3: API Key Rotation

### Goal
Support multiple API keys and automatically rotate when one hits rate limits.

### Implementation

#### 3.1 Key Storage Schema
```javascript
// chrome.storage.local
{
    "atom_api_keys": [
        { "key": "AIza...", "label": "Primary", "enabled": true },
        { "key": "AIza...", "label": "Backup 1", "enabled": true },
        { "key": "AIza...", "label": "Backup 2", "enabled": false }
    ],
    "atom_active_key_index": 0,
    "atom_key_cooldowns": {
        "0": 0,           // Primary: no cooldown
        "1": 1770089000   // Backup 1: cooldown until timestamp
    }
}
```

#### 3.2 Rotation Logic
```
┌─────────────────────────────────────────┐
│ Request → Use active key                │
├─────────────────────────────────────────┤
│ If 429:                                 │
│   1. Mark current key in cooldown       │
│   2. Find next enabled key not in CD    │
│   3. Switch to that key                 │
│   4. Retry request                      │
│   5. If no keys available → show error  │
└─────────────────────────────────────────┘
```

#### 3.3 UI in Options Page
- List of API keys with labels
- Add/Remove/Enable/Disable buttons
- Status indicator per key (Active, Cooldown, Disabled)
- "Test Key" button

#### 3.4 Files to Modify
- `services/rate_limit_manager.module.js` — Add key rotation logic
- `options.html` + `options.js` — Multi-key management UI
- `background.js` — Use key from rotation manager
- `sidepanel.js` — Use key from rotation manager
- `ai_service.js` — Use key from rotation manager

---

## Implementation Order

### Phase 1: Auto-Pause (Quick Win)
1. Apply `skipDuringCooldown` to all background tasks
2. Add pause/resume events to rate manager
3. **Effort**: 2-3 hours

### Phase 2: Quota Warning
1. Add quota tracking to rate manager
2. Build warning UI component
3. Connect to side panel status
4. **Effort**: 3-4 hours

### Phase 3: Key Rotation
1. Build multi-key storage schema
2. Implement rotation logic
3. Build Options page UI
4. Update all API call sites
5. **Effort**: 6-8 hours

---

## Testing Checklist

### Auto-Pause
- [ ] SmartLink stops during cooldown
- [ ] AI Pilot stops during cooldown
- [ ] Chat still works during cooldown
- [ ] Tasks resume after cooldown ends

### Quota Warning
- [ ] Yellow warning at 80% RPM
- [ ] Red warning at 90% RPM
- [ ] Countdown shows during cooldown
- [ ] Warning clears when quota resets

### Key Rotation
- [ ] Can add multiple keys in Options
- [ ] Auto-rotates on 429
- [ ] Rotates back after cooldown
- [ ] Shows per-key status
- [ ] Graceful handling when all keys exhausted

---

## Open Questions

1. **Quota persistence**: Should quota counters persist across browser restart?
2. **Key sync**: Should keys sync across devices via Chrome Sync?
3. **Paid tier**: Different limits for paid API keys — need detection?
