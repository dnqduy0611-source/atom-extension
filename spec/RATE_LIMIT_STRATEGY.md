# Rate Limit Strategy Specification

**Project:** ATOM Extension  
**Scope:** Gemini API rate-limit mitigation across UI + background  
**Goal:** Reduce 429 errors, preserve UX, prevent request bursts  
**Status:** Draft for implementation

---

## Overview

This spec defines a multi-phase strategy to reduce Gemini API rate-limit errors and improve user experience. The approach prioritizes user-facing chat requests, throttles background tasks, adds intelligent backoff, and introduces caching + model fallback where safe.

---

## Constraints

- Do not block user-initiated chat flows.
- Minimize visible error messages for 429.
- Avoid significant latency for primary user actions.
- Keep behavior predictable and debuggable.

---

## Definitions

- **VIP request:** User-initiated chat / active reading actions.
- **Background request:** SmartLink, Related Memory, AI Pilot, or other auto tasks.
- **RPM:** Requests per minute.

---

## Phase 1: Global Queue + Concurrency Control (Immediate Impact)

### Task 1.1 - Centralized Request Queue
**Goal:** Funnel all Gemini calls through a single queue with priority.

**Tasks:**
- Create a queue manager (priority: VIP > background).
- Enforce concurrency = 1 (only one in-flight request).
- Provide enqueue API with priority and metadata.

**Acceptance Criteria:**
- When multiple requests fire, only one is in-flight.
- VIP requests always run before background requests.
- No UI freeze; queue works in background.

---

### Task 1.2 - Global Rate Gate (RPM Cap)
**Goal:** Prevent burst requests even across modules.

**Tasks:**
- Add token-bucket or leaky-bucket limiter.
- Default safe cap: 12-15 RPM total.
- Reserve burst headroom for VIP requests.

**Acceptance Criteria:**
- Background tasks never exceed 10 RPM.
- VIP requests can preempt background.
- Logs show rate gate decisions.

---

## Phase 2: 429 Backoff + Retry (User-Friendly Recovery)

### Task 2.1 - Retry-After Parsing
**Goal:** Respect server-provided wait time.

**Tasks:**
- Parse "Please retry in Xs" from error text.
- If `Retry-After` header exists, prefer it.
- Add +1s safety margin.

**Acceptance Criteria:**
- 429 errors trigger wait for correct duration.
- Retry happens automatically up to 2 times.
- No red error toast for 429.

---

### Task 2.2 - Cooldown on Repeated 429
**Goal:** Prevent immediate repeated failures.

**Tasks:**
- If 2+ 429 within 1 minute, set global cooldown.
- Pause background tasks during cooldown.

**Acceptance Criteria:**
- Background tasks stop during cooldown window.
- VIP tasks still allowed but throttled.

---

## Phase 3: Smart Caching (Reduce Duplicate Calls)

### Task 3.1 - Prompt+URL Cache
**Goal:** Serve repeated requests from cache.

**Tasks:**
- Cache key = hash(prompt + url + mode).
- TTL default: 5 minutes for background tasks.
- Bypass cache for VIP chat.

**Acceptance Criteria:**
- Same background prompt within 5 min returns cached result.
- Cache misses fall back to API.

---

### Task 3.2 - Module-specific Cache Rules
**Goal:** Tune per module.

**Tasks:**
- SmartLink: cache 10 min.
- Related Memory: cache 10 min.
- AI Pilot: cache 5 min.

**Acceptance Criteria:**
- Each module respects its TTL without manual override.

---

## Phase 4: Model Fallback (Stability Under Load)

### Task 4.1 - Background Model Fallback
**Goal:** Reduce congestion on primary model.

**Tasks:**
- If 429 on primary model, retry background tasks with fallback model.
- Never fallback for VIP chat.

**Acceptance Criteria:**
- Background tasks switch model after 429.
- VIP chat remains on primary model.

---

## Phase 5: UX & Telemetry

### Task 5.1 - UX State Indicators
**Goal:** Keep user informed without noise.

**Tasks:**
- Show subtle "Processing..." or "Retrying..." state.
- Avoid error popups for 429.

**Acceptance Criteria:**
- Users see delay feedback, not hard errors.

---

### Task 5.2 - Metrics & Logging
**Goal:** Track effectiveness.

**Tasks:**
- Log queue length, wait time, 429 count.
- Track retries and fallback usage.

**Acceptance Criteria:**
- Logs accessible via console/debug panel.
- Metrics show reduced 429 after deployment.

---

## Success Metrics

- 429 errors reduced by at least 70%.
- VIP chat response time remains under 2s average (excluding model compute).
- Background task throughput stable without user-visible errors.

---

## Implementation Notes

- Centralize Gemini calls at `sidepanel.js` and any shared API service.
- Apply rate-limit policies consistently for popup, content, and background usage.
- Provide a single source-of-truth configuration object (RPM caps, TTL, fallback model).

