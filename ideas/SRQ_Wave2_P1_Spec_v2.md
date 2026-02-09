# SRQ Remediation Wave 2 (P1) Spec v2
**Version:** 2.0 (revised after Wave 1 P0 completion)
**Date:** 2026-02-08
**Prerequisites:** Wave 1 P0 complete (idempotency, upsert, error codes, state machine)

---

## 1) Mục tiêu & phạm vi

Wave 2 xử lý **runtime consistency** và **keyboard accessibility**:

1. ✅ **Race condition prevention:** In-flight guards cho export/dismiss operations
2. ✅ **Optimistic locking:** Async enrichment không overwrite user changes
3. ✅ **Debounced refresh:** Giảm UI flicker khi nhiều updates liên tiếp
4. ✅ **Keyboard navigation:** Full keyboard support cho widget + modal
5. ✅ **Accessibility:** ARIA labels, focus management, screen reader friendly

**Scope:** SRQ operations only. Không ảnh hưởng export queue, NLM bridge, hoặc topic system.

---

## 2) Non-goals

- ❌ Không thay đổi data schema lớn (chỉ thêm runtime metadata nhẹ)
- ❌ Không visual redesign (giữ nguyên UI Wave 1 P0)
- ❌ Không thêm MCP/OpenClaw features
- ❌ Không thay đổi topic extraction hoặc routing logic
- ❌ Không implement undo/redo system

---

## 3) Hiện trạng / rủi ro

### Từ Wave 1 P0:
✅ Idempotency prevents duplicate card creation
✅ Error codes standardized
✅ State machine (loading/ready/empty/error)

### Vẫn còn:
❌ **Race conditions:** User click Export nhiều lần → multiple export jobs
❌ **Async conflicts:** Enrichment overwrite user-initiated status changes
❌ **UI flicker:** 10 rapid updates → widget re-renders 10 times
❌ **Keyboard inaccessible:** Modal không dùng được bằng Tab/Esc/Enter
❌ **No focus management:** Modal mở không auto-focus, close không return focus

---

## 4) Thiết kế giải pháp

### 4.1 Operation Sequencing

**Định nghĩa rõ action pipeline:**

```
Card Creation:
capture → buildCard → upsertCard → broadcast → async enrichCardAsync

Export Operation:
user click → acquire lock → updateStatus → createExportJob → release lock → broadcast

Dismiss Operation:
user click → acquire lock → updateStatus("dismissed") → release lock → broadcast

Enrichment:
triggered → read card (record updatedAt) → process → optimistic update (check updatedAt) → broadcast if success
```

**Key insight:** Export/dismiss must complete atomically before enrichment can proceed.

---

### 4.2 In-flight Guard (detailed)

#### 4.2.1 Data Structure

```javascript
// In background.js (module-level)
const inFlightOps = new Map();
const IN_FLIGHT_TIMEOUT_MS = 10000;  // 10 seconds

// Key format: "${opType}:${targetType}:${targetId}"
// Examples:
// - "export:card:src_1738900000000_abc123"
// - "dismiss:batch:tag:machine-learning"
// - "enrich:src_1738900000000_abc123"

// Value structure:
{
    requestId: string,           // For tracing
    opType: "export" | "dismiss" | "enrich",
    targetType: "card" | "batch",
    targetId: string,
    startedAt: number,           // Date.now()
    timeout: number              // IN_FLIGHT_TIMEOUT_MS
}
```

#### 4.2.2 Lock Acquisition

```javascript
/**
 * Acquire operation lock. Returns true if acquired, false if already in-flight.
 */
function acquireOpLock(opType, targetType, targetId, requestId) {
    const key = `${opType}:${targetType}:${targetId}`;

    if (inFlightOps.has(key)) {
        const existing = inFlightOps.get(key);
        console.warn("[SRQ] Operation already in-flight:", {
            key,
            existing: existing.requestId,
            attempted: requestId
        });
        return false;  // Lock not acquired
    }

    inFlightOps.set(key, {
        requestId,
        opType,
        targetType,
        targetId,
        startedAt: Date.now(),
        timeout: IN_FLIGHT_TIMEOUT_MS
    });

    return true;  // Lock acquired
}

/**
 * Release operation lock.
 */
function releaseOpLock(opType, targetType, targetId) {
    const key = `${opType}:${targetType}:${targetId}`;
    inFlightOps.delete(key);
}

/**
 * Cleanup expired locks (run every 5 seconds).
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, op] of inFlightOps.entries()) {
        if (now - op.startedAt > op.timeout) {
            console.warn("[SRQ] Operation timeout, cleaning up:", key);
            inFlightOps.delete(key);
        }
    }
}, 5000);
```

#### 4.2.3 Usage Pattern

```javascript
case "SRQ_EXPORT_CARD": {
    const { cardId, notebookRef } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    // Try to acquire lock
    if (!acquireOpLock("export", "card", cardId, requestId)) {
        sendResponse({
            ok: false,
            errorCode: SRQ_ERROR_CODES.CONFLICT,
            message: "Export already in progress for this card"
        });
        break;
    }

    try {
        const result = await handleSrqSingleExport(cardId, notebookRef);
        sendResponse({ ok: true, ...result });
        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED" }).catch(() => {});
    } catch (err) {
        console.error("[SRQ] Export error:", err);
        sendResponse({
            ok: false,
            errorCode: SRQ_ERROR_CODES.TRANSIENT,
            message: err.message
        });
    } finally {
        releaseOpLock("export", "card", cardId);
    }
    break;
}
```

---

### 4.3 Optimistic Locking for Enrichment

#### 4.3.1 Algorithm

Sử dụng `updatedAt` timestamp (có sẵn từ Wave 1 P0) để detect conflicts:

```javascript
/**
 * Async enrichment with optimistic locking.
 * Prevents enrichment from overwriting user-initiated changes.
 */
export async function enrichCardAsync(cardId) {
    if (!cardId) return null;

    // Step 1: Read card and record timestamp
    const allCards = await loadCards();
    const card = allCards.find(c => c?.cardId === cardId);
    if (!card) return null;

    const initialUpdatedAt = card.updatedAt || card.createdAt;
    const initialStatus = card.status;

    // Step 2: Perform enrichment (topic routing, related sessions)
    let enrichedData = {};

    try {
        // Route topic to suggest notebook
        if (card.topicKey) {
            const routeResult = await routeTopic(card.topicKey, card.topicConfidence);
            if (routeResult?.decision === "use_existing") {
                enrichedData.suggestedNotebook = routeResult.notebookRef;
            }
        }

        // Find related sessions (placeholder - Phase 2 feature)
        // enrichedData.relatedSessions = await findRelatedSessions(card);

    } catch (err) {
        console.warn("[SRQ] Enrichment processing failed:", err.message);
        return null;
    }

    // Step 3: Optimistic update - check if card changed during enrichment
    const currentCards = await loadCards();
    const currentCard = currentCards.find(c => c?.cardId === cardId);

    if (!currentCard) {
        console.warn("[SRQ] Enrich skipped: card was deleted", cardId);
        return null;
    }

    const currentUpdatedAt = currentCard.updatedAt || currentCard.createdAt;
    const currentStatus = currentCard.status;

    // Conflict detection
    if (currentUpdatedAt > initialUpdatedAt) {
        console.warn("[SRQ] Enrich skipped: card was updated during enrichment", {
            cardId,
            initialUpdatedAt,
            currentUpdatedAt,
            initialStatus,
            currentStatus
        });
        return null;  // Skip update silently
    }

    // Safe to update
    const updated = await updateCard(cardId, enrichedData);

    // Broadcast update (low priority, no need to refresh UI immediately)
    chrome.runtime.sendMessage({
        type: "SRQ_CARDS_UPDATED",
        reason: "enrichment_completed",
        changedIds: [cardId]
    }).catch(() => {});

    return updated;
}
```

#### 4.3.2 Conflict Scenarios

| Scenario | Initial Status | During Enrich | Current Status | Action |
|----------|----------------|---------------|----------------|--------|
| Normal | pending_review | (no change) | pending_review | ✅ Update |
| User exported | pending_review | User clicks Export | exported | ❌ Skip (preserve "exported") |
| User dismissed | pending_review | User clicks Dismiss | dismissed | ❌ Skip (preserve "dismissed") |
| User edited | pending_review | User adds tags | pending_review (updatedAt++) | ❌ Skip (preserve fresh data) |

**Key insight:** `updatedAt` increment indicates ANY change, so enrichment defers to fresher data.

---

### 4.4 Debounced Refresh

#### 4.4.1 Implementation

```javascript
// In sidepanel.js
let refreshDebounceTimer = null;
const REFRESH_DEBOUNCE_MS = 300;  // 300ms trailing debounce

/**
 * Debounced widget refresh.
 * Accumulates rapid updates and refreshes once after silence.
 */
function debouncedRefreshSRQWidget() {
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
    }

    refreshDebounceTimer = setTimeout(() => {
        refreshDebounceTimer = null;
        mountSRQWidget();
    }, REFRESH_DEBOUNCE_MS);
}

// Listen for card updates
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SRQ_CARDS_UPDATED") {
        debouncedRefreshSRQWidget();
    }
});
```

#### 4.4.2 Behavior

```
t=0ms:   SRQ_CARDS_UPDATED (card 1 exported) → schedule refresh at t=300ms
t=50ms:  SRQ_CARDS_UPDATED (card 2 exported) → cancel previous, schedule at t=350ms
t=100ms: SRQ_CARDS_UPDATED (card 3 exported) → cancel previous, schedule at t=400ms
t=150ms: SRQ_CARDS_UPDATED (card 4 exported) → cancel previous, schedule at t=450ms
t=200ms: SRQ_CARDS_UPDATED (card 5 exported) → cancel previous, schedule at t=500ms
t=500ms: (silence for 300ms) → refresh widget ONCE with all 5 cards updated
```

**Result:** Batch of 5 exports → 5 broadcasts → 1 UI refresh (no flicker).

---

### 4.5 Keyboard Navigation & Accessibility

#### 4.5.1 Keyboard Shortcuts

| Context | Key | Action | Implementation |
|---------|-----|--------|----------------|
| **Review Modal** | `Esc` | Close modal | `keydown` handler on modal overlay |
| | `Enter` | Trigger "Save selected" (primary action) | `keydown` on modal, check if focus is on button |
| | `Tab` | Navigate forward through focusable elements | Native browser behavior + focus trap |
| | `Shift+Tab` | Navigate backward | Native browser behavior + focus trap |
| | `Space` | Activate focused button or toggle card selection | `keydown` on card elements |
| **Widget (collapsed)** | `Enter` | Expand widget | `keydown` on header |
| | `Space` | Expand widget | `keydown` on header |
| **Widget (expanded)** | `Enter` on batch | Open review modal for batch | `keydown` on batch element |
| | `Enter` on "Save all" | Trigger batch export | Native button behavior |
| **Error State** | `Enter` on "Try again" | Retry loading | Native button behavior |
| **Anywhere** | `Esc` (in modal) | Close modal | `keydown` on document with modal check |

#### 4.5.2 Focus Management

```javascript
/**
 * Open modal with focus management.
 */
function openReviewModal(batch) {
    // ... create modal DOM ...

    // Store trigger element for focus return
    const triggerElement = document.activeElement;

    // Trap focus within modal
    trapFocus(overlay, triggerElement);

    // Add keyboard handlers
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeReviewModal();
        }
    });

    document.body.appendChild(overlay);

    // Auto-focus first interactive element
    const firstFocusable = overlay.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
}

/**
 * Close modal and return focus.
 */
function closeReviewModal() {
    const modal = document.getElementById('srq-review-modal');
    if (!modal) return;

    // Return focus to trigger element (stored in trapFocus)
    const triggerElement = modal.__triggerElement;
    modal.remove();
    triggerElement?.focus();
}

/**
 * Trap focus within modal boundaries.
 */
function trapFocus(modalElement, triggerElement) {
    // Store trigger for focus return
    modalElement.__triggerElement = triggerElement;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalElement.querySelectorAll(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            // Shift+Tab: loop to last if at first
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            // Tab: loop to first if at last
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });
}
```

#### 4.5.3 ARIA Attributes

Add to existing modal/widget HTML:

```html
<!-- Modal -->
<div class="srq-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="srq-modal-title">
    <div class="srq-modal">
        <div class="srq-modal-header">
            <h2 id="srq-modal-title" class="srq-modal-title">Review: Machine Learning</h2>
            <p class="srq-modal-subtitle" aria-live="polite">5 highlights ready to save</p>
        </div>
        <!-- ... -->
    </div>
</div>

<!-- Widget header (collapsed) -->
<div class="srq-header" role="button" tabindex="0" aria-expanded="false" aria-controls="srq-batches">
    <!-- ... -->
</div>

<!-- Batch list -->
<div id="srq-batches" class="srq-batches" role="list">
    <div class="srq-batch" role="listitem">
        <!-- ... -->
    </div>
</div>

<!-- Error state -->
<div class="srq-state-content" role="alert" aria-live="assertive">
    <span class="srq-state-text">Could not load highlights.</span>
    <button class="srq-retry-btn" aria-label="Retry loading highlights">Try again</button>
</div>

<!-- Loading state -->
<div class="srq-state-content" aria-live="polite" aria-busy="true">
    <span class="srq-loading" aria-label="Loading"></span>
    <span class="srq-state-text">Loading...</span>
</div>
```

---

### 4.6 SRQ_CARDS_UPDATED Payload (Backward Compatible)

#### 4.6.1 Message Evolution

**Before Wave 2 (current):**
```javascript
{
    type: "SRQ_CARDS_UPDATED"
}
```

**After Wave 2 (additive):**
```javascript
{
    type: "SRQ_CARDS_UPDATED",
    reason: "card_created" | "card_exported" | "batch_dismissed" | "enrichment_completed",  // Optional
    changedIds: ["src_123", "src_456"],  // Optional: affected card IDs
    timestamp: 1738900000000  // Optional: event timestamp
}
```

#### 4.6.2 Receiver Compatibility

All receivers must handle both formats:

```javascript
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SRQ_CARDS_UPDATED") {
        // Optional fields are safe to ignore
        const reason = msg.reason || "unknown";
        const changedIds = msg.changedIds || [];

        // Always refresh (debounced)
        debouncedRefreshSRQWidget();
    }
});
```

---

## 5) Chi tiết thay đổi theo file

### `background.js`

#### Line ~5035-5050: Add in-flight guard infrastructure

```javascript
// ===========================
// Smart Research Queue (SRQ)
// ===========================

/**
 * Wave 1 P0: Rollback flag for legacy addCard flow
 */
const SRQ_USE_LEGACY_ADD_CARD = false;

/**
 * Wave 2 P1: In-flight operation guard
 */
const inFlightOps = new Map();
const IN_FLIGHT_TIMEOUT_MS = 10000;

function acquireOpLock(opType, targetType, targetId, requestId) {
    const key = `${opType}:${targetType}:${targetId}`;
    if (inFlightOps.has(key)) {
        const existing = inFlightOps.get(key);
        console.warn("[SRQ] Operation already in-flight:", { key, existing: existing.requestId, attempted: requestId });
        return false;
    }
    inFlightOps.set(key, { requestId, opType, targetType, targetId, startedAt: Date.now(), timeout: IN_FLIGHT_TIMEOUT_MS });
    return true;
}

function releaseOpLock(opType, targetType, targetId) {
    const key = `${opType}:${targetType}:${targetId}`;
    inFlightOps.delete(key);
}

// Cleanup expired locks every 5 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, op] of inFlightOps.entries()) {
        if (now - op.startedAt > op.timeout) {
            console.warn("[SRQ] Operation timeout, cleaning up:", key);
            inFlightOps.delete(key);
        }
    }
}, 5000);
```

#### Line ~5207-5220: Wrap SRQ_EXPORT_BATCH with lock

```javascript
case "SRQ_EXPORT_BATCH": {
    const { topicKey, notebookRef } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (!acquireOpLock("export", "batch", topicKey, requestId)) {
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.CONFLICT, message: "Export already in progress for this batch" });
        break;
    }

    try {
        const result = await handleSrqBatchExport(topicKey, notebookRef);
        sendResponse({ ok: true, ...result });
        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "batch_exported", changedIds: result.cardIds || [] }).catch(() => {});
    } catch (err) {
        console.error("[SRQ] Batch export error:", err);
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.TRANSIENT, message: err.message });
    } finally {
        releaseOpLock("export", "batch", topicKey);
    }
    break;
}
```

#### Line ~5213-5225: Wrap SRQ_EXPORT_CARD with lock

```javascript
case "SRQ_EXPORT_CARD": {
    const { cardId, notebookRef } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (!acquireOpLock("export", "card", cardId, requestId)) {
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.CONFLICT, message: "Export already in progress for this card" });
        break;
    }

    try {
        const result = await handleSrqSingleExport(cardId, notebookRef);
        sendResponse({ ok: true, ...result });
        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "card_exported", changedIds: [cardId] }).catch(() => {});
    } catch (err) {
        console.error("[SRQ] Export error:", err);
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.TRANSIENT, message: err.message });
    } finally {
        releaseOpLock("export", "card", cardId);
    }
    break;
}
```

#### Line ~5183-5190: Wrap SRQ_DISMISS_CARD with lock

```javascript
case "SRQ_DISMISS_CARD": {
    const { cardId } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (!acquireOpLock("dismiss", "card", cardId, requestId)) {
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.CONFLICT, message: "Dismiss already in progress for this card" });
        break;
    }

    try {
        await dismissCard(cardId);
        sendResponse({ ok: true });
        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "card_dismissed", changedIds: [cardId] }).catch(() => {});
    } catch (err) {
        console.error("[SRQ] Dismiss error:", err);
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.TRANSIENT, message: err.message });
    } finally {
        releaseOpLock("dismiss", "card", cardId);
    }
    break;
}
```

#### Line ~5189-5205: Wrap SRQ_DISMISS_BATCH with lock

```javascript
case "SRQ_DISMISS_BATCH": {
    const { topicKey } = request;
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    if (!acquireOpLock("dismiss", "batch", topicKey, requestId)) {
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.CONFLICT, message: "Dismiss already in progress for this batch" });
        break;
    }

    try {
        const batchCards = await getCardsByTopicKey(topicKey);
        let dismissed = 0;
        const dismissedIds = [];
        for (const card of batchCards) {
            if (card.status === "pending_review" || card.status === "approved") {
                await updateCardStatus(card.cardId, "dismissed");
                dismissed++;
                dismissedIds.push(card.cardId);
            }
        }
        sendResponse({ ok: true, dismissed });
        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "batch_dismissed", changedIds: dismissedIds }).catch(() => {});
    } catch (err) {
        console.error("[SRQ] Batch dismiss error:", err);
        sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.TRANSIENT, message: err.message });
    } finally {
        releaseOpLock("dismiss", "batch", topicKey);
    }
    break;
}
```

---

### `services/srq_enricher.js`

#### Line ~200-250: Update enrichCardAsync with optimistic locking

Replace existing `enrichCardAsync` with:

```javascript
/**
 * Async enrichment: find suggested notebook + related sessions.
 * Wave 2 P1: Optimistic locking to prevent overwriting user changes.
 *
 * @param {string} cardId - Card to enrich
 * @returns {Promise<Object|null>} Updated card or null if skipped
 */
export async function enrichCardAsync(cardId) {
    if (!cardId) return null;

    // Step 1: Read card and record timestamp
    const allCards = await loadCards();
    const card = allCards.find(c => c?.cardId === cardId);
    if (!card) return null;

    const initialUpdatedAt = card.updatedAt || card.createdAt;
    const initialStatus = card.status;

    // Step 2: Perform enrichment
    let enrichedData = {};

    try {
        // Route topic to suggest notebook
        if (card.topicKey) {
            try {
                const routeResult = await routeTopic(card.topicKey, card.topicConfidence);
                if (routeResult?.decision === "use_existing") {
                    enrichedData.suggestedNotebook = routeResult.notebookRef;
                }
            } catch (err) {
                console.warn("[SRQ] Topic routing failed:", err.message);
            }
        }

        // Find related sessions (placeholder for Phase 2)
        // const related = await chrome.runtime.sendMessage({ type: "SRQ_FIND_RELATED", url: card.url });
        // if (related?.ok && related.sessions) {
        //     enrichedData.relatedSessions = related.sessions;
        // }

    } catch (err) {
        console.warn("[SRQ] Enrichment processing failed:", err.message);
        return null;
    }

    // Step 3: Optimistic update - check if card changed during enrichment
    const currentCards = await loadCards();
    const currentCard = currentCards.find(c => c?.cardId === cardId);

    if (!currentCard) {
        console.warn("[SRQ] Enrich skipped: card was deleted", cardId);
        return null;
    }

    const currentUpdatedAt = currentCard.updatedAt || currentCard.createdAt;
    const currentStatus = currentCard.status;

    // Conflict detection
    if (currentUpdatedAt > initialUpdatedAt) {
        console.warn("[SRQ] Enrich skipped: card was updated during enrichment", {
            cardId,
            initialUpdatedAt,
            currentUpdatedAt,
            initialStatus,
            currentStatus
        });
        return null;  // Skip update silently
    }

    // Safe to update
    const updated = await updateCard(cardId, enrichedData);

    // Broadcast update (low priority)
    chrome.runtime.sendMessage({
        type: "SRQ_CARDS_UPDATED",
        reason: "enrichment_completed",
        changedIds: [cardId]
    }).catch(() => {});

    return updated;
}
```

---

### `ui/components/srq_widget.js`

#### Line ~420-450: Add keyboard handlers to batch cards

```javascript
function createBatchCard(batch) {
    const el = document.createElement('div');
    el.className = 'srq-batch';
    el.dataset.topic = batch.topicKey;
    el.setAttribute('role', 'listitem');

    // ... existing header/modes/meta ...

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'srq-batch-actions';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'srq-btn srq-btn-export';
    exportBtn.textContent = cardCount > 1 ? msg('srq_export_all', 'Save all') : msg('srq_export', 'Save');
    exportBtn.setAttribute('aria-label', `Export ${cardCount} highlights from ${batch.topicLabel}`);
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleBatchExport(batch, exportBtn);
    });

    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'srq-btn';
    reviewBtn.textContent = msg('srq_review', 'Review');
    reviewBtn.setAttribute('aria-label', `Review ${cardCount} highlights from ${batch.topicLabel}`);
    reviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openReviewModal(batch);
    });

    // Wave 2 P1: Keyboard support
    reviewBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openReviewModal(batch);
        }
    });

    // ... existing dismiss button ...

    actions.appendChild(exportBtn);
    actions.appendChild(reviewBtn);
    actions.appendChild(dismissBtn);
    el.appendChild(actions);

    return el;
}
```

#### Line ~250-320: Update openReviewModal with focus management

```javascript
function openReviewModal(batch) {
    // Close any existing modal
    closeReviewModal();

    const cardCount = batch.cards?.length || 0;
    const selected = new Set(batch.cards.map(c => c.cardId));

    const overlay = document.createElement('div');
    overlay.className = 'srq-modal-overlay';
    overlay.id = 'srq-review-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'srq-modal-title');

    // Store trigger element for focus return
    overlay.__triggerElement = document.activeElement;

    const modal = document.createElement('div');
    modal.className = 'srq-modal';

    // Header
    const headerEl = document.createElement('div');
    headerEl.className = 'srq-modal-header';
    headerEl.innerHTML = `
        <h2 id="srq-modal-title" class="srq-modal-title">${msg('srq_review_title', 'Review: $1', [truncate(batch.topicLabel || '', 25)])}</h2>
        <p class="srq-modal-subtitle" aria-live="polite">${msg('srq_review_subtitle', '$1 highlights ready to save', [String(cardCount)])}</p>
    `;
    modal.appendChild(headerEl);

    // ... body with cards ...

    // Footer
    const footer = document.createElement('div');
    footer.className = 'srq-modal-footer';

    // ... target notebook selector ...

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'srq-btn-secondary';
    cancelBtn.textContent = msg('srq_cancel', 'Cancel');
    cancelBtn.addEventListener('click', closeReviewModal);

    const exportBtn = document.createElement('button');
    exportBtn.className = 'srq-btn-primary';
    exportBtn.id = 'srq-modal-export-btn';
    exportBtn.textContent = msg('srq_export_selected', 'Save selected ($1)', [String(selected.size)]);
    exportBtn.setAttribute('aria-label', `Save ${selected.size} selected highlights`);
    exportBtn.addEventListener('click', () => {
        const notebook = select.value || 'Inbox';
        handleModalExport(batch, selected, notebook, exportBtn);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(exportBtn);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    // Wave 2 P1: Keyboard handlers
    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeReviewModal();
        }
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeReviewModal();
    });

    document.body.appendChild(overlay);

    // Wave 2 P1: Focus trap + auto-focus
    trapFocus(overlay);
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
}

function closeReviewModal() {
    const modal = document.getElementById('srq-review-modal');
    if (!modal) return;

    // Return focus to trigger element
    const triggerElement = modal.__triggerElement;
    modal.remove();
    triggerElement?.focus();
}

function trapFocus(modalElement) {
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalElement.querySelectorAll(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modalElement.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    });
}
```

#### Line ~440-470: Disable buttons during in-flight operations

```javascript
async function handleBatchExport(batch, btn) {
    if (!batch?.topicKey) return;

    const originalText = btn.textContent;

    // Wave 2 P1: Disable button during operation
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = `<span class="srq-loading"></span> ${msg('srq_exporting', 'Saving...')}`;

    try {
        const response = await chrome.runtime.sendMessage({
            type: "SRQ_EXPORT_BATCH",
            topicKey: batch.topicKey,
            notebookRef: batch.suggestedNotebook || "Inbox"
        });

        if (response?.ok) {
            btn.textContent = msg('srq_exported_success', 'Saved $1 clips', [String(response.exported || 0)]);
            btn.style.background = 'rgba(16, 185, 129, 0.3)';
            // Widget will refresh via SRQ_CARDS_UPDATED message
        } else if (response?.errorCode === 'CONFLICT') {
            // In-flight conflict
            btn.textContent = msg('srq_in_flight', 'Already processing...');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
            }, 2000);
        } else {
            btn.textContent = msg('srq_export_error', 'Could not save');
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
    } catch (err) {
        console.error("[SRQ Widget] Export failed:", err);
        btn.textContent = originalText;
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
    }
}
```

---

### `sidepanel.js`

#### Line ~6915-6950: Add debounced refresh

```javascript
// ===========================
// Smart Research Queue Widget
// ===========================

let refreshDebounceTimer = null;
const REFRESH_DEBOUNCE_MS = 300;

async function mountSRQWidget() {
    const container = document.getElementById('srq-widget-container');
    if (!container) return;

    // Wave 1 P0: Show loading state
    container.innerHTML = '';
    const loadingState = window.SRQWidget?.createLoadingState();
    if (loadingState) container.appendChild(loadingState);

    try {
        const response = await chrome.runtime.sendMessage({ type: "SRQ_GET_BATCHES" });

        container.innerHTML = '';

        if (!response?.ok) {
            const errorState = window.SRQWidget?.createErrorState(() => mountSRQWidget());
            if (errorState) container.appendChild(errorState);
            return;
        }

        if (!response.batches || response.batches.length === 0) {
            const emptyState = window.SRQWidget?.createEmptyState();
            if (emptyState) container.appendChild(emptyState);
            return;
        }

        const widget = window.SRQWidget?.create(response.batches);
        if (widget) container.appendChild(widget);

    } catch (err) {
        console.warn('[ATOM SRQ] Widget mount failed:', err.message);
        container.innerHTML = '';
        const errorState = window.SRQWidget?.createErrorState(() => mountSRQWidget());
        if (errorState) container.appendChild(errorState);
    }
}

/**
 * Wave 2 P1: Debounced refresh to prevent UI flicker.
 */
function debouncedRefreshSRQWidget() {
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
    }

    refreshDebounceTimer = setTimeout(() => {
        refreshDebounceTimer = null;
        mountSRQWidget();
    }, REFRESH_DEBOUNCE_MS);
}

// Listen for SRQ card changes (debounced)
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "SRQ_CARDS_UPDATED") {
        // Optional payload: reason, changedIds (backward compatible)
        debouncedRefreshSRQWidget();
    }
});
```

---

### `_locales/en/messages.json`

Add after existing SRQ keys:

```json
  "srq_in_flight": { "message": "Already processing..." }
```

### `_locales/vi/messages.json`

```json
  "srq_in_flight": { "message": "Đang xử lý..." }
```

---

## 6) Message/Event contracts

### SRQ_CARDS_UPDATED (evolved)

**Request:** N/A (broadcast only)

**Broadcast payload:**

```javascript
{
    type: "SRQ_CARDS_UPDATED",
    reason: "card_created" | "card_exported" | "batch_dismissed" | "enrichment_completed",  // Optional
    changedIds: ["src_123", "src_456"],  // Optional
    timestamp: 1738900000000  // Optional
}
```

All fields except `type` are **optional** (backward compatible).

### New response format for locked operations

```javascript
// When operation is already in-flight:
{
    ok: false,
    errorCode: "CONFLICT",
    message: "Export already in progress for this card"
}
```

---

## 7) Data model/state changes

### No new persistent fields

Wave 2 P1 uses existing fields from Wave 1 P0:
- `updatedAt` → for optimistic locking
- `status` → for conflict detection

### Runtime-only state

In-flight map stored in `background.js` memory (not persisted):
- Cleared on extension reload
- Auto-expires after 10 seconds
- No storage quota impact

---

## 8) UX states & copy

### Button states

| State | Visual | ARIA |
|-------|--------|------|
| **Normal** | "Save all" | `aria-disabled="false"` |
| **In-flight** | Spinner + "Saving..." | `aria-disabled="true"` |
| **Success** | "Saved 5 clips" (2s) | `aria-live="polite"` |
| **Conflict** | "Already processing..." (2s) | `aria-live="polite"` |
| **Error** | "Could not save" (2s) | `role="alert"` |

### Toast notifications (optional)

Nếu cần toast system, implement minimal version:

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

**CSS:**
```css
.srq-toast {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 10001;
    animation: srqToastSlideIn 0.3s ease-out;
}

.srq-toast-fadeout {
    animation: srqToastFadeOut 0.3s ease-out;
}

@keyframes srqToastSlideIn {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@keyframes srqToastFadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}
```

---

## 9) Test plan

### Unit tests

- [ ] `acquireOpLock()` returns false if lock already held
- [ ] `releaseOpLock()` allows re-acquisition
- [ ] Lock auto-expires after 10 seconds
- [ ] Optimistic locking skips update when `updatedAt` changed
- [ ] Debounce accumulates rapid updates → 1 refresh

### Manual tests

#### In-flight guard
- [ ] Click "Save all" 5 times rapidly → only 1 export job created
- [ ] Click "Dismiss" on same batch twice → second click gets "CONFLICT" error
- [ ] Export card → wait 11s → can export again (lock expired)

#### Optimistic locking
- [ ] Create card → export immediately → enrichment completes → card stays "exported"
- [ ] Create card → dismiss → enrichment completes → card stays "dismissed"
- [ ] Console shows "Enrich skipped: card was updated during enrichment" log

#### Debounced refresh
- [ ] Export 10 cards in batch → widget refreshes once after 300ms
- [ ] Monitor `mountSRQWidget()` calls (should be 1, not 10)

#### Keyboard navigation
- [ ] Open modal → Tab through elements → loops at end
- [ ] Open modal → Shift+Tab → loops backward
- [ ] Open modal → Esc → closes and returns focus to trigger button
- [ ] Open modal → Enter → triggers "Save selected"
- [ ] Collapse widget → Enter/Space → expands

#### ARIA/screen reader
- [ ] Screen reader announces "Review reminder" when modal opens
- [ ] Screen reader reads button labels correctly
- [ ] Loading state announces "Loading..."
- [ ] Error state announces error message

### E2E tests

- [ ] Spam click Export → no duplicate export jobs in NLM queue
- [ ] Rapid export + dismiss → all operations complete, no lost updates
- [ ] Widget count stays accurate during burst of updates

---

## 10) Acceptance criteria

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | **Không double-export/dismiss do multi-click** | Click Export 5 times quickly → check export queue → only 1 job |
| 2 | **Modal dùng được hoàn toàn bằng bàn phím** | Open modal → navigate with Tab/Esc/Enter → all actions work |
| 3 | **Broadcast/refresh không gây nhấp nháy** | Export 10 cards → widget refreshes once → count correct |
| 4 | **Enrichment không overwrite user changes** | Export card → enrich completes after → card stays "exported" |
| 5 | **Buttons disabled khi in-flight** | Click Export → button shows "Saving..." + disabled → can't click again |
| 6 | **Focus management correct** | Open modal → Esc closes → focus returns to trigger button |
| 7 | **ARIA attributes present** | Inspect modal → has `role="dialog"`, `aria-modal="true"` |
| 8 | **Lock expires after timeout** | Export → wait 11s → can export again |
| 9 | **Debounce accumulates updates** | Trigger 10 updates in 200ms → only 1 refresh after 300ms |
| 10 | **Backward compatible messaging** | Old listeners without payload check → still work |

---

## 11) Rollout + rollback

### Rollout

**Phase 1:** Local testing (1-2 days)
- Load extension in dev environment
- Run all manual tests
- Monitor console for in-flight conflicts, optimistic skips

**Phase 2:** Soft launch (optional flag, 3-5 days)
- Add flag `srqStrictOpsGuard` in settings (default: true)
- Monitor logs for false positives
- Collect user feedback on keyboard nav

**Phase 3:** Full rollout
- Remove flag (always enabled)
- Update documentation

### Rollback

**Scenario 1:** False positives on in-flight locks
- Set `SRQ_STRICT_OPS_GUARD = false` in background.js
- Operations bypass lock acquisition
- Monitor for actual race conditions

**Scenario 2:** Optimistic locking too aggressive
- Comment out `if (currentUpdatedAt > initialUpdatedAt)` check in enricher
- All enrichments apply (risk overwriting user changes)

**Scenario 3:** Debounce too long (UI feels laggy)
- Reduce `REFRESH_DEBOUNCE_MS` from 300ms to 100ms
- Trade-off: more refreshes, potential flicker

---

## 12) Ước lượng effort + phụ thuộc

### Effort breakdown

| Task | Estimated Time |
|------|----------------|
| In-flight guard infrastructure | 4h |
| Wrap 4 handlers with locks | 2h |
| Optimistic locking in enricher | 3h |
| Debounced refresh | 1h |
| Keyboard handlers (modal + widget) | 3h |
| Focus management + trap | 2h |
| ARIA attributes | 1h |
| i18n keys | 0.5h |
| Toast implementation (optional) | 1h |
| Testing (manual + E2E) | 8h |
| **Total** | **~25.5h (3.2 days)** |

### Dependencies

- ✅ Wave 1 P0 complete (provides `updatedAt`, error codes, state machine)
- ❌ No external dependencies

---

## 13) File manifest

### Files to modify (6)

| File | Changes | LOC Added |
|------|---------|-----------|
| `background.js` | In-flight guard infrastructure + wrap 4 handlers | +120 |
| `services/srq_enricher.js` | Optimistic locking in enrichCardAsync | +40 |
| `ui/components/srq_widget.js` | Keyboard handlers + focus management + disabled buttons | +80 |
| `sidepanel.js` | Debounced refresh | +20 |
| `_locales/en/messages.json` | 1 new key | +1 |
| `_locales/vi/messages.json` | 1 new key | +1 |
| **Total** | | **~262 LOC** |

### Files to create (0)

All changes are modifications to existing files.

---

## 14) Success metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Race condition elimination** | 0 duplicate exports/dismisses | Monitor export queue for duplicates over 1 week |
| **Enrichment conflicts** | < 5% enrichment skip rate | Count "Enrich skipped" logs / total enrichments |
| **UI flicker reduction** | < 2 refreshes per batch operation | Measure `mountSRQWidget()` calls per export batch |
| **Keyboard usability** | 100% keyboard navigable | Manual QA checklist completion |
| **ARIA compliance** | 0 accessibility errors | Lighthouse accessibility audit score |
| **Lock timeout rate** | < 1% operations timeout | Count timeout cleanups / total operations |

---

## 15) Notes & caveats

### Lock timeout edge case

If an operation hangs for > 10s (e.g., slow network), lock expires and another operation can start. This is **by design** — prevents permanent deadlock. Trade-off accepted.

### Optimistic locking silent skip

Enrichment failures are silent (no user notification). This is **intentional** — enrichment is best-effort, non-critical. If routing fails, user can manually select notebook.

### Debounce trade-off

300ms debounce means UI update lags by up to 300ms after action completes. This is **acceptable** — user gets instant button feedback ("Saving..."), widget refresh is secondary.

### Backward compatibility

SRQ_CARDS_UPDATED payload is additive, so Phase 1 implementations ignore new fields. **No migration needed.**

---

## 16) Comparison with Wave 1 P0

| Aspect | Wave 1 P0 | Wave 2 P1 |
|--------|-----------|-----------|
| **Problem** | Duplicate cards | Race conditions + accessibility |
| **Solution** | Idempotency + upsert | In-flight guards + keyboard nav |
| **LOC added** | ~282 | ~262 |
| **Files modified** | 8 | 6 |
| **New concepts** | Idempotency key, error codes | Operation locks, optimistic locking |
| **User-visible** | State machine, retry button | Keyboard shortcuts, disabled buttons |
| **Complexity** | Medium | Medium-High |
| **Risk** | Low (rollback flag) | Low (flag + timeout escape hatch) |

---

*Spec version: 2.0*
*Author: Claude (after Wave 1 P0 completion)*
*Status: ✅ Ready for implementation*
