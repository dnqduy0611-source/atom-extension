# rate-limit-implementation.md

## Context
- Source specs: `spec/RATE_LIMIT_STRATEGY.md`, `spec/RATE_LIMIT_IMPLEMENTATION_PLAN.md`
- Scope: External API calls only.
- Priority policy: follow plan (VIP > background).
- State storage: `chrome.storage.local` for rate-limit state when needed.
- Telemetry: no external telemetry; local console/logs only.

## Assumptions
- Background/page reloads may reset in-memory state; any required persistence will use `chrome.storage.local`.
- Task 6 (Debug Panel) is optional per plan; implement only if approved for this iteration.

## Milestones
- M1 (P0): Task 1 + Task 2
- M2 (P1): Task 3 + Task 4
- M3 (P2, optional): Task 5 + Task 6

## Task 1: Enhanced 429 Tracking + Global Cooldown (P0)
Agent Assignment: backend-specialist
Required Skills: clean-code, nodejs-best-practices, testing-patterns
INPUT:
- `services/rate_limit_manager.module.js`
- `ai_service.js`
- `sidepanel.js`
- `background.js`
OUTPUT:
- `record429Error()` with repeated-429 window + threshold
- global cooldown trigger + reset of recent errors
- call sites record 429 with source labels
- persist cooldown state to `chrome.storage.local` if required for cross-reload behavior
VERIFY:
- 2+ 429 within 60s triggers 30s cooldown
- background tasks pause during cooldown
- VIP allowed but throttled
- console shows "repeated-429-threshold"

## Task 2: Model Fallback for 429 (P0)
Agent Assignment: backend-specialist
Required Skills: clean-code, nodejs-best-practices, testing-patterns
INPUT:
- `ai_service.js`
- `config/ai_config.js`
- `sidepanel.js`
OUTPUT:
- `_callCloudGemini` retries with fallback model on 429 for background only
- VIP never uses fallback
- no infinite loop
VERIFY:
- background 429 -> fallback model once
- VIP 429 -> primary model only
- console logs model switch

## Task 3: Consistent Caching Strategy (P1)
Agent Assignment: backend-specialist + frontend-specialist
Required Skills: clean-code, nodejs-best-practices, frontend-design
INPUT:
- `config/ai_config.js`
- `ai_pilot_service.js`
- `sidepanel.js`
OUTPUT:
- centralized CACHE TTLs in `AI_CONFIG`
- AI Pilot TTL = 5 min
- VIP bypasses cache (cacheKey null, ttl 0)
VERIFY:
- TTLs match config
- VIP requests do not cache
- SmartLink/Related Memory TTLs applied

## Task 4: Metrics + Logging (P1)
Agent Assignment: backend-specialist
Required Skills: clean-code, nodejs-best-practices, testing-patterns
INPUT:
- `services/rate_limit_manager.module.js`
- new: `services/rate_limit_metrics.js`
OUTPUT:
- metrics collector class
- RateLimitManager integrates metrics
- `getMetrics()` / `logMetrics()` exposed
VERIFY:
- stats fields update as expected
- `getMetrics()` returns snapshot with timestamp

## Task 5: UX Improvements (P2)
Agent Assignment: frontend-specialist
Required Skills: clean-code, frontend-design
INPUT:
- `sidepanel.js`
- `styles.css`
OUTPUT:
- retrying state UI
- 429 warning toast (no error toast)
- CSS animation for retrying
VERIFY:
- retrying state appears during retries
- no red error popup on 429
- warning toast visible

## Task 6: Debug Panel (P2, Optional)
Agent Assignment: frontend-specialist
Required Skills: clean-code, frontend-design
INPUT:
- `sidepanel.html`
- `sidepanel.js`
OUTPUT:
- hidden debug panel
- Ctrl+Shift+D toggle
- reset stats action
VERIFY:
- panel toggles
- stats displayed
- reset clears metrics

## Task 7: Testing + Docs (All)
Agent Assignment: test-engineer + documentation-writer
Required Skills: testing-patterns, documentation-templates
INPUT:
- tests (if present)
- README or spec docs
OUTPUT:
- unit/integration tests aligned with spec
- docs updated if behavior changes
VERIFY:
- tests pass
- manual smoke checks per spec

## Definition of Done
- Code compiles/runs
- Core tests or smoke commands run
- Docs updated when behavior changes
