# SRQ Wave 1 P0 — Implementation Status Report
**Date:** 2026-02-08
**Spec:** SRQ_Wave1_P0_Spec.md
**Overall completion:** ~15% ❌

---

## Executive Summary

**SRQ Wave 1 P0 spec chưa được triển khai.** Hầu hết các tính năng cốt lõi của spec này (idempotency, upsert, UX states, error codes) **không có trong codebase hiện tại**.

Implementation hiện tại vẫn dùng **Phase 1 baseline**: append-only store, không có duplicate detection, silent fail patterns, và không có standardized error handling.

---

## Detailed Assessment by Feature

### 1. ✅ Idempotency Key — **0% Complete**

**Spec yêu cầu:**
- Function `buildIdempotencyKey(captureData)` trong `srq_enricher.js`
- Key format: `${origin+pathname}:${normalizedTitle}:${normalizedSelectionPrefix}:${timeBucket60s}:v1`
- timeBucket = 60s UTC, floor
- Field `idempotencyKey: string` trong ResearchCard

**Hiện trạng:**
```bash
❌ `buildIdempotencyKey()` KHÔNG tồn tại
❌ `idempotencyKey` field KHÔNG có trong ResearchCard schema
❌ timeBucket logic KHÔNG được implement
```

**Evidence:**
```bash
$ grep -r "buildIdempotencyKey" .
# Only found in: ideas/SRQ_Wave1_P0_Spec.md

$ grep -r "idempotencyKey" services/srq_enricher.js
# No matches
```

**File hiện tại:** `services/srq_enricher.js:118-158`
```javascript
// Build card
const card = {
    cardId: generateCardId(),  // Random timestamp-based ID
    createdAt: Date.now(),
    status: "pending_review",
    // ... no idempotencyKey field
};
```

---

### 2. ✅ Upsert Semantics — **0% Complete**

**Spec yêu cầu:**
- Function `findCardByIdempotencyKey(key)` trong `srq_store.js`
- Function `upsertCard(card)` trong `srq_store.js`
- Merge patch khi key trùng, cập nhật `updatedAt`

**Hiện trạng:**
```bash
❌ `findCardByIdempotencyKey()` KHÔNG tồn tại
❌ `upsertCard()` KHÔNG tồn tại
✅ `updatedAt` field CÓ trong updateCard(), nhưng không dùng trong upsert flow
```

**Evidence:**
```bash
$ grep -r "upsertCard" storage/srq_store.js
# No matches

$ grep -r "findCardByIdempotencyKey" storage/srq_store.js
# No matches
```

**File hiện tại:** `storage/srq_store.js:65-73`
```javascript
export async function addCard(card) {
    if (!card?.cardId) throw new Error("[srq_store] addCard: cardId required");

    const cards = await loadCards();
    cards.push(card);  // ⚠️ Append-only, no duplicate check
    const trimmed = evictIfNeeded(cards);
    await saveCards(trimmed);
    return card;
}
```

**Notes:**
- `updateCard()` có set `updatedAt: Date.now()` (line 88), nhưng không dùng cho upsert logic
- Chỉ có `addCard()` (append-only) và `updateCard()` (find by cardId)

---

### 3. ✅ UX State Machine — **10% Complete**

**Spec yêu cầu:**
- 4 states: `loading`, `ready`, `empty`, `error`
- Error state có retry button
- Widget + sidepanel mount hiển thị state rõ ràng

**Hiện trạng:**
```bash
✅ `ready` state: implicit khi có batches
✅ `empty` state: implicit khi không có batches (widget returns null)
❌ `loading` state: KHÔNG hiển thị
❌ `error` state: KHÔNG hiển thị (silent fail)
❌ Retry button: KHÔNG có
```

**Evidence:**

**File:** `ui/components/srq_widget.js:73-77`
```javascript
function createWidget(batches) {
    if (!batches || batches.length === 0) return null;  // ⚠️ Empty state = null
    const totalCards = batches.reduce((sum, b) => sum + (b.cards?.length || 0), 0);
    if (totalCards === 0) return null;
    // ... widget rendered
}
```

**File:** `sidepanel.js:6915-6933`
```javascript
async function mountSRQWidget() {
    const container = document.getElementById('srq-widget-container');
    if (!container) return;

    try {
        const response = await chrome.runtime.sendMessage({ type: "SRQ_GET_BATCHES" });
        if (!response?.ok || !response.batches?.length) {
            container.innerHTML = '';  // ⚠️ Silent empty state
            return;
        }

        container.innerHTML = '';
        const widget = window.SRQWidget?.create(response.batches);
        if (widget) container.appendChild(widget);
    } catch (err) {
        console.warn('[ATOM SRQ] Widget mount failed:', err.message);
        container.innerHTML = '';  // ⚠️ Silent error state
    }
}
```

**Vấn đề:**
- Không có loading spinner khi fetch batches
- Error bị catch nhưng UI chỉ empty container (user không biết lỗi)
- Không có retry mechanism

**i18n keys:**
```bash
❌ "srq_loading" — KHÔNG có
❌ "srq_empty_state" — KHÔNG có
❌ "srq_error_state" — KHÔNG có
❌ "srq_retry" — KHÔNG có
✅ "srq_exporting" — CÓ (line 1332 in en/messages.json)
✅ "srq_export_error" — CÓ (line 1334 in en/messages.json)
```

---

### 4. ✅ Error Code Enum — **0% Complete**

**Spec yêu cầu:**
- `SRQ_GET_BATCHES` và tất cả handlers trả lỗi với schema:
  ```javascript
  { ok: false, errorCode: "INVALID_PARAM"|"UNAUTHORIZED"|..., message: string }
  ```
- 9 error codes được chốt

**Hiện trạng:**
```bash
❌ errorCode enum KHÔNG được define
❌ Error responses KHÔNG có errorCode field
❌ Handlers chỉ throw exception hoặc return { ok: false, error: err.message }
```

**Evidence:**
```bash
$ grep -r "errorCode" background.js
# No matches in SRQ handlers

$ grep -r "INVALID_PARAM\|TRANSIENT\|RATE_LIMIT" background.js
# No matches
```

**File hiện tại:** `background.js:5219-5222`
```javascript
} catch (err) {
    console.error("[ATOM SRQ] Handler error:", err);
    sendResponse({ ok: false, error: err.message });  // ⚠️ Generic error
}
```

**Vấn đề:**
- Không có standardized error codes
- Client không thể phân biệt transient error (retry) vs permanent error (no retry)

---

### 5. ✅ Data Model Changes — **33% Complete**

**Spec yêu cầu:**
- Field `idempotencyKey: string`
- Field `updatedAt: number`

**Hiện trạng:**
```bash
❌ `idempotencyKey` — KHÔNG có
✅ `updatedAt` — CÓ trong updateCard() (line 88 of srq_store.js)
```

**Evidence:**

**File:** `storage/srq_store.js:81-91`
```javascript
export async function updateCard(cardId, patch) {
    if (!cardId) return null;

    const cards = await loadCards();
    const idx = cards.findIndex(c => c?.cardId === cardId);
    if (idx < 0) return null;

    cards[idx] = { ...cards[idx], ...patch, updatedAt: Date.now() };  // ✅ updatedAt
    await saveCards(cards);
    return cards[idx];
}
```

**Nhưng:** `updatedAt` chỉ được dùng trong `updateCard()`, không dùng trong create flow hay upsert flow.

---

### 6. ✅ Background Handler Changes — **5% Complete**

**Spec yêu cầu:**
- `SRQ_CREATE_CARD` chuyển sang idempotent flow: create payload → upsertCard → broadcast
- Chỉ broadcast `SRQ_CARDS_UPDATED` sau khi write thành công

**Hiện trạng:**
```bash
✅ Broadcast `SRQ_CARDS_UPDATED` sau write — OK
❌ Idempotent flow với upsertCard — KHÔNG có
❌ Error handling với errorCode — KHÔNG có
```

**Evidence:**

**File:** `background.js:5147-5153`
```javascript
case "SRQ_CREATE_CARD": {
    const card = await createResearchCard(request.payload);  // ⚠️ Always creates new
    sendResponse({ ok: true, card });
    // Notify sidepanel of change
    chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED" }).catch(() => {});
    break;
}
```

**Vấn đề:**
- `createResearchCard()` → `addCard()` → always append, no duplicate check
- Không có idempotency key check

---

### 7. ✅ Rollback Flag — **0% Complete**

**Spec yêu cầu:**
- Flag `SRQ_USE_LEGACY_ADD_CARD` (boolean) trong background.js
- Default: `false`
- Rollback pattern với `rollbackApplied` tracking

**Hiện trạng:**
```bash
❌ `SRQ_USE_LEGACY_ADD_CARD` — KHÔNG tồn tại
❌ Rollback logic — KHÔNG có
```

**Evidence:**
```bash
$ grep -r "SRQ_USE_LEGACY\|rollback" background.js
# No matches
```

---

### 8. ✅ i18n Keys — **10% Complete**

**Spec yêu cầu:**
- Keys cho loading/error/empty/retry states

**Hiện trạng:**
```bash
❌ "srq_loading" — Missing
❌ "srq_empty_state" — Missing
❌ "srq_error_state" — Missing
❌ "srq_retry" — Missing
✅ "srq_exporting" — Present (line 1332)
✅ "srq_export_error" — Present (line 1334)
```

**Partial coverage:** Chỉ có error messages cho export actions, không có cho widget/batch loading.

---

## Acceptance Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Không còn duplicate card với cùng idempotencyKey | ❌ | No idempotency key exists |
| timeBucket chạy theo UTC 60s, key có suffix `:v1` | ❌ | No timeBucket logic exists |
| `SRQ_GET_BATCHES` trả lỗi với errorCode đúng enum | ❌ | No errorCode enum defined |
| SRQ widget luôn hiển thị 1 trong 4 state hợp lệ | ❌ | Only ready/empty (implicit), no loading/error |
| Mọi lỗi fetch chính có retry path | ❌ | No retry buttons |
| Không thêm permission manifest | ✅ | No manifest changes |

**Score:** 1/6 criteria met (17%)

---

## What IS Implemented (Phase 1 Baseline)

The current implementation **is Phase 1**, which includes:

✅ **Basic CRUD:**
- `addCard()` — append-only
- `updateCard()` — find by cardId, patch
- `loadCards()`, `saveCards()`
- `getCardsByStatus()`, `getCardsByTopicKey()`

✅ **FIFO Eviction:**
- Evicts exported/dismissed cards when > 200 total

✅ **Widget:**
- Displays batches when present
- Returns null when empty (implicit empty state)

✅ **Message routing:**
- `SRQ_CREATE_CARD`, `SRQ_GET_BATCHES`, etc. work
- Broadcast `SRQ_CARDS_UPDATED` after mutations

✅ **Export flow:**
- Batch export + single export handlers functional

---

## What Needs to be Done (Wave 1 P0 Spec)

### Critical Path (P0):

1. **Idempotency key** (~4h)
   - Add `buildIdempotencyKey()` to `srq_enricher.js`
   - Add `idempotencyKey` field to ResearchCard
   - Implement timeBucket (60s UTC) + `:v1` suffix

2. **Upsert semantics** (~2h)
   - Add `findCardByIdempotencyKey()` to `srq_store.js`
   - Add `upsertCard()` to `srq_store.js`
   - Update `SRQ_CREATE_CARD` handler to use upsert flow

3. **UX state machine** (~4h)
   - Add loading state to widget
   - Add error state to widget
   - Add retry button
   - Update `mountSRQWidget()` to handle states explicitly

4. **Error code enum** (~2h)
   - Define `SRQ_ERROR_CODES` enum in `types.js`
   - Update all SRQ handlers to use errorCode
   - Update client error handling to check errorCode

5. **i18n keys** (~1h)
   - Add "srq_loading", "srq_empty_state", "srq_error_state", "srq_retry"
   - Add Vietnamese translations

6. **Rollback flag** (~1h)
   - Add `SRQ_USE_LEGACY_ADD_CARD` flag
   - Add rollback logic with `rollbackApplied` tracking

7. **Testing** (~4h)
   - Unit tests for idempotency key stability
   - Manual test: rapid duplicate clicks
   - Manual test: network error → retry
   - E2E: no duplicate exports

---

## Estimated Effort to Complete Wave 1 P0

| Task | Effort | Priority |
|------|--------|----------|
| Idempotency + Upsert | 6h | P0 |
| UX states + retry | 4h | P0 |
| Error codes | 2h | P0 |
| i18n + rollback flag | 2h | P1 |
| Testing | 4h | P0 |
| **Total** | **18h** | ~2.5 days |

---

## Risk Assessment

| Risk | Likelihood | Impact | Notes |
|------|------------|--------|-------|
| Breaking existing Phase 1 flow | Medium | High | Upsert logic changes card creation path |
| timeBucket edge cases (DST, leap seconds) | Low | Medium | Use UTC + floor, should be stable |
| Storage migration needed | Low | Low | `idempotencyKey` is optional field (backward compatible) |
| UX state machine complexity | Low | Medium | Requires careful testing of all states |

---

## Recommendations

### Option 1: Complete Wave 1 P0 (Recommended)
- **Pros:** Fixes duplicate card issue, improves UX, standardizes errors
- **Cons:** 2.5 days effort
- **Timeline:** Sprint 9 (before Phase 2)

### Option 2: Skip to Phase 2
- **Pros:** Faster to new features
- **Cons:** Leaves duplicate card bug + poor error UX
- **Risk:** User frustration with duplicate cards, silent failures

### Option 3: Partial Implementation (Critical only)
- Implement **only** idempotency + upsert (6h)
- Skip UX states, error codes, rollback
- **Pros:** Fixes critical bug fast
- **Cons:** UX still poor, no retry

---

## Conclusion

**SRQ Wave 1 P0 spec is ~15% complete.** Only basic infrastructure (updatedAt field, broadcast pattern) is in place. Core features (idempotency, upsert, UX states, error codes) are **not implemented**.

**Recommendation:** Complete Wave 1 P0 (18h effort) before proceeding to Phase 2 to ensure stable foundation.

---

*Report generated: 2026-02-08*
*Spec version: SRQ_Wave1_P0_Spec.md*
*Codebase version: Phase 1 complete*
