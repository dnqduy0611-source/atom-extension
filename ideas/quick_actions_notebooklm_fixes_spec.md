# Quick Actions NotebookLM Fixes

Status: Draft  
Date: 2026-02-03

## Summary
Fix reliability and correctness issues for Quick Actions: Save to NotebookLM and Key Insight. Align payload shapes, handle export failures accurately, and route Key Insight through the shared rate-limit and retry pipeline. Mark Done persistence change is deferred.

## Scope
- Quick Save payload and success handling.
- Key Insight API calls.
- Mark Done persistence change deferred.

## Out of Scope
- New UI design or new buttons.
- Changes to NotebookLM export queue logic.
- Cross-domain behavior changes.

## Current Issues (Code + Evidence)
1. **Quick Save payload mismatch**
   - `quickSaveHighlight()` sends `{ payload: { note } }` while background expects `request.payload` to be the note object.
   - Result: `prepareNlmExportFromNote()` receives an invalid shape and can fail or export empty fields.
   - Files: `sidepanel.js`, `background.js`, `bridge/bridge_service.js`.
2. **Quick Save shows success even on failure**
   - UI sets `thread.nlmExported = true` and shows success toast without checking `response.ok`.
   - If NotebookLM is disabled, deduped, or PII‑blocked, user still sees “saved”.
   - Files: `sidepanel.js`, `bridge/bridge_service.js`.
3. **Key Insight API call is not rate‑limited**
   - `makeAtomicThought()` calls Gemini directly via `fetch` without `RateLimitManager`, retry, or timeout policy.
   - Screenshot evidence shows `API Error` and alert “Failed to generate atomic thought”.
   - File: `sidepanel.js`.
4. **Mark Done persistence is delayed**
   - `parkCurrentThread()` changes status in memory, but storage is only updated after the 5s undo window.
   - If the panel closes/crashes before commit, the status can be lost.
   - File: `sidepanel.js`.
   - Decision: defer change (keep current behavior for now).

## Goals
- Ensure Quick Save always sends a correct note payload.
- Accurately reflect success/failure in UI for NotebookLM exports.
- Route Key Insight through shared rate-limit/retry logic to reduce 429/timeout errors.

## Proposed Changes

### 1) Quick Save payload alignment
- Standardize `ATOM_SAVE_THREAD_TO_NLM` to accept **either**:
  - `payload: note`, or
  - `payload: { note }` (backward compatible).
- Update `quickSaveHighlight()` to send `payload: note` to match `saveThreadToNLM()`.
- In background handler, normalize:
  - `const note = request.payload?.note || request.payload;`

### 2) Quick Save success handling
- Only mark `thread.nlmExported = true` when `response.ok === true`.
- For failures, show accurate toast based on `response.error` or `reason`.
- Suggested mapping:
  - `disabled` → “NotebookLM export is disabled”
  - `pii_warning` → “Sensitive data detected. Export blocked.”
  - `dedupe` → “Already saved today”
  - default → “Failed to save”

### 3) Key Insight API path
- Replace direct `fetch` with shared Gemini call pipeline:
  - Use `callGeminiAPI` or `RateLimitManager.enqueue` with priority `background`.
  - Reuse existing retry/backoff and timeout configs from `API_CONFIG`.
- On failure:
  - Show a toast error (instead of `alert`) and keep button state consistent.
  - Surface a user‑friendly message (network/429/timeout).

### 4) Mark Done persistence with undo (Deferred)
- Keep current behavior (persist after undo window).
- Revisit if users report lost status in practice.

## Acceptance Criteria
- Quick Save sends correct payload and no longer fails due to shape mismatch.
- Quick Save only shows success when export is queued successfully.
- Key Insight uses the shared rate‑limit/retry pipeline and no longer triggers `API Error` for transient failures.
- Mark Done behavior unchanged (still commits after undo window).

## Test Plan
Manual:
1. **Quick Save success**
   - With NotebookLM enabled, click Quick Save. Expect toast “Saved” and `thread.nlmExported = true`.
2. **Quick Save disabled**
   - Disable NotebookLM export. Click Quick Save. Expect error toast and no `nlmExported`.
3. **Key Insight transient failure**
   - Simulate network offline or 429. Expect error toast and button reset without crash.
4. **Mark Done (no change)**
   - Verify behavior unchanged (undo window still applies).

## Rollout
- No migrations required.
- Changes are local to sidepanel + background messaging logic.

## Open Questions
- Preferred copy for Quick Save failure reasons.
- Should we log export errors for QA?
