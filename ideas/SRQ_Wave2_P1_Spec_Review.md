# SRQ Wave 2 P1 Spec — Review & Recommendations
**Date:** 2026-02-08
**Reviewer:** Claude (after completing Wave 1 P0)
**Verdict:** ⚠️ **Needs refinement before implementation**

---

## Executive Summary

Wave 2 P1 spec có mục tiêu tốt (race conditions, in-flight guards, keyboard/a11y) nhưng **thiếu chi tiết kỹ thuật cụ thể** so với Wave 1 P0. Cần bổ sung:

1. ✅ In-flight map structure rõ ràng
2. ✅ Optimistic locking algorithm cụ thể
3. ✅ Debounce timing + strategy
4. ✅ Keyboard interaction model đầy đủ
5. ✅ Toast notification approach
6. ⚠️ Backward compatibility cho SRQ_CARDS_UPDATED payload
7. ⚠️ Code structure details (line numbers, examples)

**Khuyến nghị:** Bổ sung spec theo template dưới đây trước khi implement.

---

## Detailed Analysis

### ✅ STRENGTHS

| Aspect | Assessment |
|--------|------------|
| **Clear objectives** | ✅ 3 goals rõ ràng: race conditions, in-flight guards, keyboard/a11y |
| **Non-goals** | ✅ Ranh giới rõ (no schema change, no visual redesign) |
| **Dependencies** | ✅ Correctly depends on Wave 1 P0 |
| **Rollout plan** | ✅ Has flag-based rollout strategy |

### ⚠️ GAPS & AMBIGUITIES

#### 1. In-flight Map Structure (Critical Gap)

**Spec says:**
> "key: `operationType:targetId`"

**Problems:**
- What is `targetId` for batch operations? `topicKey` or `cardId`?
- What about concurrent single-card exports within a batch?
- Map structure not specified (Map? Object? TTL?)

**Recommendation:**

```javascript
// In-flight map design (add to spec)
const inFlightOps = new Map();

// Key format:
// - Card operations: "export:card:{cardId}" | "dismiss:card:{cardId}"
// - Batch operations: "export:batch:{topicKey}" | "dismiss:batch:{topicKey}"
// - Enrich operations: "enrich:{cardId}"

// Value structure:
{
    requestId: "req_1738900000000_abc123",
    opType: "export" | "dismiss" | "enrich",
    targetType: "card" | "batch",
    targetId: string,
    startedAt: number,
    timeout: 10000  // Auto-clear after 10s
}

// Cleanup: setInterval to remove expired ops (startedAt + timeout < now)
```

**Add to spec section 4.2:**
```markdown
### 4.2 In-flight map (detailed)

Structure:
- Type: `Map<string, InFlightOp>`
- Key format: `${opType}:${targetType}:${targetId}`
- Auto-cleanup: Remove entries > 10s old every 5s
- Lock acquisition: `if (inFlightOps.has(key)) reject`
- Lock release: Always in finally block

Example keys:
- `"export:card:src_1738900000000_abc123"`
- `"dismiss:batch:tag:machine-learning"`
- `"enrich:src_1738900000000_abc123"`
```

---

#### 2. Optimistic Locking Algorithm (Critical Gap)

**Spec says:**
> "check `updatedAt` / version guard"

**Problems:**
- No algorithm specified
- Should we add `version` field or use `updatedAt`?
- What happens on conflict? Retry? Fail?

**Recommendation:**

Since Wave 1 P0 already has `updatedAt`, **use timestamp-based optimistic locking** (no new field needed).

**Algorithm:**
```javascript
// In enrichCardAsync() before update:
async function enrichCardAsync(cardId) {
    const card = await findCardById(cardId);
    if (!card) return null;

    const initialUpdatedAt = card.updatedAt || card.createdAt;

    // Do enrichment (topic routing, related sessions, etc.)
    const enrichedData = await performEnrichment(card);

    // Optimistic lock: only update if card hasn't changed
    const current = await findCardById(cardId);
    if (!current) return null;  // Card was deleted

    const currentUpdatedAt = current.updatedAt || current.createdAt;
    if (currentUpdatedAt > initialUpdatedAt) {
        console.warn("[SRQ] Enrich skipped: card was updated during enrichment", {
            cardId,
            initialUpdatedAt,
            currentUpdatedAt
        });
        return null;  // Skip update to preserve newer state
    }

    // Safe to update
    return updateCard(cardId, enrichedData);
}
```

**Add to spec section 4.1:**
```markdown
### 4.1 Optimistic locking for async enrichment

Use `updatedAt` timestamp for conflict detection:

1. **Read phase:** Record `initialUpdatedAt = card.updatedAt`
2. **Process phase:** Perform enrichment (topic routing, etc.)
3. **Write phase:**
   - Re-read card to get `currentUpdatedAt`
   - If `currentUpdatedAt > initialUpdatedAt` → skip update (card changed)
   - Else → apply enrichment via updateCard()

**Rationale:** Prevents enrichment from overwriting user-initiated changes (dismiss, export, manual edits).

**No retry:** If conflict detected, skip silently. Enrichment is best-effort, not critical.
```

---

#### 3. Debounce Timing Not Specified (Medium Gap)

**Spec says:**
> "Debounce refresh khi nhận nhiều `SRQ_CARDS_UPDATED` liên tiếp"

**Problems:**
- How long? 100ms? 300ms?
- Leading or trailing debounce?

**Recommendation:**

Use **300ms trailing debounce** (standard for UI updates).

**Implementation:**
```javascript
// In sidepanel.js
let refreshDebounceTimer = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SRQ_CARDS_UPDATED") {
        // Clear existing timer
        if (refreshDebounceTimer) {
            clearTimeout(refreshDebounceTimer);
        }

        // Set new timer (300ms trailing)
        refreshDebounceTimer = setTimeout(() => {
            refreshDebounceTimer = null;
            mountSRQWidget();
        }, 300);
    }
});
```

**Add to spec section 5:**
```markdown
### `sidepanel.js` (detailed)
- Debounce `SRQ_CARDS_UPDATED` refresh: **300ms trailing**
- Cancel pending refresh on new update
- Ensures UI updates only after burst of changes completes
- Example: Batch export of 5 cards → 5 broadcasts → 1 UI refresh
```

---

#### 4. SRQ_CARDS_UPDATED Payload Change (Breaking Change Risk)

**Spec says:**
> "`SRQ_CARDS_UPDATED` có thể kèm payload nhẹ `{ reason, changedIds }`"

**Problems:**
- Current implementation: `{ type: "SRQ_CARDS_UPDATED" }` (no payload)
- Adding payload is fine, but must be **additive** (backward compatible)
- Widget/sidepanel must handle both old and new format

**Recommendation:**

Make payload **optional and additive**:

```javascript
// Old format (still works):
{ type: "SRQ_CARDS_UPDATED" }

// New format (Wave 2 P1):
{
    type: "SRQ_CARDS_UPDATED",
    reason: "card_created" | "card_exported" | "batch_dismissed" | "enrichment_completed",
    changedIds: ["src_123", "src_456"],  // Optional: affected card IDs
    timestamp: 1738900000000
}

// Widget/sidepanel handles both:
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SRQ_CARDS_UPDATED") {
        // msg.reason and msg.changedIds are optional
        // Always refresh regardless (debounced)
        debouncedRefresh();
    }
});
```

**Add to spec section 6:**
```markdown
### Message contracts (backward compatible)

`SRQ_CARDS_UPDATED` payload evolution:

**Before Wave 2:**
```json
{ "type": "SRQ_CARDS_UPDATED" }
```

**After Wave 2 (additive):**
```json
{
    "type": "SRQ_CARDS_UPDATED",
    "reason": "card_created",
    "changedIds": ["src_123"],
    "timestamp": 1738900000000
}
```

All fields except `type` are **optional**. Receivers must handle both formats.
```

---

#### 5. Keyboard Interaction Model Incomplete (Medium Gap)

**Spec says:**
> "Esc đóng review modal. Trap focus trong modal. Tab order ổn định."

**Problems:**
- What about Enter key? Should it trigger primary action?
- What about arrow keys for card navigation?
- What about Space key on checkboxes?

**Recommendation:**

**Full keyboard interaction spec:**

| Context | Key | Action |
|---------|-----|--------|
| **Review Modal** | Esc | Close modal |
| | Enter | Trigger "Save selected" button (primary action) |
| | Tab / Shift+Tab | Navigate focusable elements (trapped in modal) |
| | Space | Toggle card selection (when card focused) |
| **Widget (collapsed)** | Enter / Space | Expand widget |
| **Widget (expanded)** | Enter / Space on batch | Open review modal for that batch |
| | Enter / Space on "Save all" | Trigger batch export |
| **Error state** | Enter / Space on "Try again" | Retry |

**Focus trap implementation:**
```javascript
function trapFocus(modalElement) {
    const focusableElements = modalElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            } else if (!e.shiftKey && document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });

    // Auto-focus first element on open
    firstFocusable?.focus();
}
```

**Add to spec section 4.3:**
```markdown
### 4.3 Keyboard & a11y (detailed)

**Keyboard shortcuts:**
- `Esc`: Close modal (any context)
- `Enter`: Trigger primary action (context-dependent)
- `Space`: Activate button or toggle selection
- `Tab/Shift+Tab`: Navigate (trapped in modal)

**Focus management:**
- Modal open: Auto-focus first interactive element
- Modal close: Return focus to trigger element
- Focus trap: Tab loops within modal boundaries

**ARIA attributes:**
- `role="dialog"` on modal
- `aria-modal="true"` on modal
- `aria-label` on icon-only buttons
- `aria-live="polite"` on status messages
- `aria-disabled="true"` on in-flight buttons
```

---

#### 6. Toast Notification Implementation (New Dependency)

**Spec says:**
> "toast nhẹ `Tác vụ đang chạy, vui lòng đợi.`"

**Problem:**
- No toast system exists in current codebase
- Need to implement or use existing pattern

**Options:**

**Option A:** Use existing `showToast()` from `nlm_passive_learning.js`
```javascript
// Check if showToast already exists in codebase
// If yes, reuse it. If no, implement minimal toast.
```

**Option B:** Implement minimal toast in `srq_widget.js`
```javascript
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'srq-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('srq-toast-fadeout');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
```

**Recommendation:** Check if `showToast()` exists in `nlm_passive_learning.js` or elsewhere. If yes, reuse. If no, implement minimal version in `srq_widget.js`.

**Add to spec section 8:**
```markdown
### UX states & copy (detailed)

**Toast notifications:**

Use case: Inform user without blocking UI.

Implementation:
- Check if `showToast()` exists in codebase (nlm_passive_learning.js)
- If yes: Reuse via message passing or shared utility
- If no: Implement minimal toast in srq_widget.js

Toast messages:
- In-flight: "Processing... please wait" / "Đang xử lý... vui lòng đợi"
- Conflict: "Data updated, refreshing..." / "Dữ liệu đã thay đổi, đang tải lại..."
- Success: "Saved successfully" / "Đã lưu thành công"
```

---

#### 7. Missing Code Structure Details (Low Priority but Helpful)

**Problem:**
- Wave 1 P0 spec had line numbers, code examples, file structure
- Wave 2 P1 spec lacks these details

**Recommendation:**

Add detailed file-level implementation plan similar to Wave 1 P0 format:

```markdown
## 5) Chi tiết thay đổi theo file (detailed)

### `background.js`
**Line ~5035:** Add in-flight map
```javascript
const inFlightOps = new Map();
const IN_FLIGHT_TIMEOUT_MS = 10000;
```

**Line ~5040:** Add cleanup interval
```javascript
setInterval(() => {
    const now = Date.now();
    for (const [key, op] of inFlightOps.entries()) {
        if (now - op.startedAt > IN_FLIGHT_TIMEOUT_MS) {
            inFlightOps.delete(key);
        }
    }
}, 5000);
```

**Line ~5155-5192 (SRQ_CREATE_CARD):** Already has rollback logic, no change needed

**Line ~5199-5211 (SRQ_EXPORT_BATCH):** Wrap with in-flight guard
... (etc.)
```

---

## Revised Acceptance Criteria

Original spec had 3 criteria. Suggest adding specifics:

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Không double-export/double-dismiss do multi-click | Click Export 5 times quickly → only 1 export job created |
| 2 | Modal dùng được hoàn toàn bằng bàn phím cơ bản | Open modal → Tab through all elements → Esc closes → Enter triggers action |
| 3 | Broadcast/refresh không gây nhấp nháy hoặc lệch count kéo dài | Export 10 cards rapidly → widget refreshes once after 300ms → count correct |
| **4** | **Enrichment không overwrite user changes** | Export card → enrich completes after → card stays "exported" (not reverted) |
| **5** | **In-flight buttons disabled correctly** | Click Export → button shows "Processing..." + disabled → can't click again |

---

## Recommended Changes to Spec

### Add these sections:

1. **Section 4.2.1:** In-flight map structure (code example)
2. **Section 4.2.2:** Optimistic locking algorithm (code example)
3. **Section 5.1:** Debounce timing (300ms trailing)
4. **Section 6.1:** SRQ_CARDS_UPDATED backward compatibility
5. **Section 4.3.1:** Full keyboard interaction table
6. **Section 8.1:** Toast notification approach
7. **Section 13:** File-level implementation plan (like Wave 1 P0)

### Update these sections:

- **Section 7:** Add note about `updatedAt` already exists from Wave 1 P0
- **Section 11:** Clarify flag name (`srqStrictOpsGuard` vs `SRQ_STRICT_OPS_GUARD` constant)

---

## Dependency Check: Wave 1 P0 Integration

✅ **Wave 1 P0 provides good foundation:**

| Wave 1 P0 Feature | Wave 2 P1 Builds On |
|-------------------|---------------------|
| `updatedAt` field | Used for optimistic locking |
| `upsertCard()` | Already atomic, in-flight guard prevents concurrent upserts |
| Error codes | Reuse `SRQ_ERROR_CODES.CONFLICT` for in-flight rejection |
| State machine | Add "processing" variant to existing states |
| Rollback flag | Add parallel `SRQ_STRICT_OPS_GUARD` flag |

⚠️ **One conflict to resolve:**

**Wave 1 P0 changed `createResearchCard()` to NOT save card** (handler does upsert).
**Wave 2 P1 spec assumes enrichment happens after card save.**

**Resolution:** This is already correct in Wave 1 P0 implementation:
1. Handler upserts card
2. Handler triggers async `enrichCardAsync(cardId)`
3. Enrichment reads card, processes, updates

No change needed, but spec should acknowledge this sequence.

---

## Effort Re-estimation

Original: 2-3 days dev + 1 day QA

With added details:
- In-flight guard: 4h
- Optimistic locking: 3h
- Keyboard/a11y: 4h
- Debounce: 1h
- Toast implementation: 2h
- Testing: 8h

**Total: ~22h (3 days)**

Original estimate is accurate.

---

## Recommendation: Update Spec or Proceed?

### Option 1: Update spec first (Recommended)
- **Pros:** Clear implementation plan, fewer surprises
- **Cons:** 2-3 hours to write detailed spec
- **Timeline:** +0.5 day, but saves debugging time

### Option 2: Implement with current spec + clarify on-the-fly
- **Pros:** Start immediately
- **Cons:** Higher risk of rework, ambiguity during implementation
- **Timeline:** Same total time, but more uncertainty

**My recommendation:** **Option 1** — Spend 2-3 hours refining spec first. Wave 1 P0 showed that detailed specs lead to smooth implementation (completed in one session, 0 major issues).

---

## Suggested Next Steps

1. **Review this assessment** with team/user
2. **Choose approach:** Update spec vs proceed
3. **If updating spec:** Create `SRQ_Wave2_P1_Spec_v2.md` with:
   - In-flight map structure
   - Optimistic locking algorithm
   - Debounce timing
   - Full keyboard spec
   - Toast approach
   - File-level plan
4. **If proceeding:** Reference this document during implementation for clarifications

---

*Review completed: 2026-02-08*
*Spec status: ⚠️ Workable but needs refinement*
*Confidence level: Medium → High (after refinement)*
