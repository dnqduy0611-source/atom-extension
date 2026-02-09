# SRQ i18n Audit — EN/VI Parity & Quality Check
**Date:** 2026-02-08
**Sources:** `_locales/en/messages.json`, `_locales/vi/messages.json`
**Purpose:** Identify copy improvements for Wave 3 P2

---

## Executive Summary

**Total SRQ keys:** 40 keys (EN: 40, VI: 40)
**Parity status:** ✅ 100% parity (all keys present in both locales)
**Missing keys:** None
**Quality issues:** 8 minor improvements needed
**Effort:** ~2 hours to refine copy + translate

---

## 1. Parity Check

| Metric | EN | VI | Status |
|--------|----|----|--------|
| **Total keys** | 40 | 40 | ✅ Match |
| **Keys present** | All | All | ✅ Perfect parity |
| **Keys missing** | None | None | ✅ No gaps |
| **Placeholder consistency** | All use `$1` | All use `$1` | ✅ Consistent |

**Verdict:** ✅ **No parity issues**. All keys exist in both EN and VI.

---

## 2. Complete Key Comparison

| # | Key | EN | VI | Category | Quality |
|---|-----|----|----|----------|---------|
| 1 | `srq_widget_title` | Saved highlights | Ghi chú đã lưu | Widget | ✅ Good |
| 2 | `srq_clips_label` | items | mục | Widget | ✅ Good |
| 3 | `srq_clips_count` | $1 clips | $1 đoạn | Widget | ⚠️ EN: "clips" should be "highlights" |
| 4 | `srq_uncategorized` | General | Chung | Batch | ✅ Good |
| 5 | `srq_export_all` | Save all | Lưu tất cả | Action | ✅ Good |
| 6 | `srq_export` | Save | Lưu | Action | ✅ Good |
| 7 | `srq_review` | Review | Xem lại | Action | ✅ Good |
| 8 | `srq_dismiss` | Remove | Bỏ qua | Action | ⚠️ EN: "Remove" → "Dismiss" (consistency) |
| 9 | `srq_toggle` | Show more | Xem thêm | Widget | ✅ Good |
| 10 | `srq_toggle_collapse` | Show less | Thu gọn | Widget | ✅ Good |
| 11 | `srq_review_title` | Review: $1 | Xem lại: $1 | Modal | ✅ Good |
| 12 | `srq_review_subtitle` | $1 highlights ready to save | $1 đoạn ghi chú sẵn sàng lưu | Modal | ⚠️ VI: too long |
| 13 | `srq_target_notebook` | Save to: | Lưu vào: | Modal | ✅ Good |
| 14 | `srq_export_selected` | Save selected ($1) | Lưu đã chọn ($1) | Modal | ✅ Good |
| 15 | `srq_cancel` | Cancel | Hủy | Modal | ✅ Good |
| 16 | `srq_select` | Select | Chọn | Modal | ✅ Good (unused?) |
| 17 | `srq_selected` | Selected | Đã chọn | Modal | ✅ Good (unused?) |
| 18 | `srq_skip` | Skip | Bỏ qua | Modal | ✅ Good (unused?) |
| 19 | `srq_exporting` | Saving... | Đang lưu... | Status | ✅ Good |
| 20 | `srq_exported_success` | Saved $1 clips | Đã lưu $1 đoạn | Status | ⚠️ EN: "clips" → "highlights" |
| 21 | `srq_export_error` | Could not save | Không thể lưu | Status | ⚠️ Too vague, should explain why |
| 22 | `srq_in_flight` | Already processing... | Đang xử lý... | Status | ✅ Good |
| 23 | `srq_related_to` | Related to: $1 | Liên quan đến: $1 | Review card | ✅ Good |
| 24 | `srq_pii_warning` | This highlight may contain personal information. Please review before saving. | Đoạn này có thể chứa thông tin cá nhân. Hãy xem lại trước khi lưu. | Review card | ✅ Good |
| 25 | `srq_mode_deep` | Focused | Đọc kỹ | Mode pill | ✅ Excellent (non-tech) |
| 26 | `srq_mode_skim` | Quick read | Đọc nhanh | Mode pill | ✅ Excellent (non-tech) |
| 27 | `srq_mode_reference` | For reference | Tra cứu | Mode pill | ✅ Good |
| 28 | `srq_mode_reread` | Revisited | Đọc lại | Mode pill | ✅ Good |
| 29 | `srq_time_now` | just now | vừa xong | Timestamp | ✅ Good |
| 30 | `srq_time_mins` | $1 min ago | $1 phút trước | Timestamp | ⚠️ EN: "min" → "mins" (plural) |
| 31 | `srq_time_hours` | $1h ago | $1 giờ trước | Timestamp | ✅ Good |
| 32 | `srq_time_yesterday` | yesterday | hôm qua | Timestamp | ✅ Good |
| 33 | `srq_time_days` | $1 days ago | $1 ngày trước | Timestamp | ✅ Good |
| 34 | `srq_nlm_banner` | $1 highlights ready to save | $1 đoạn ghi chú sẵn sàng lưu | Banner | ⚠️ Same as subtitle (redundant?) |
| 35 | `srq_nlm_export_current` | Save all to this notebook | Lưu tất cả vào sổ này | Banner | ✅ Good |
| 36 | `srq_nlm_open_sidepanel` | Open in sidebar | Mở thanh bên | Banner | ✅ Good |
| 37 | `srq_loading` | Loading... | Đang tải... | State | ✅ Good |
| 38 | `srq_empty_state` | No highlights waiting to save. | Chưa có đoạn trích nào chờ lưu. | State | ⚠️ EN: inconsistent "highlights" vs "clips" |
| 39 | `srq_error_state` | Could not load highlights. | Không tải được dữ liệu. | State | ⚠️ VI: "dữ liệu" too technical |
| 40 | `srq_retry` | Try again | Thử lại | State | ✅ Good |

**Quality breakdown:**
- ✅ **Good (30 keys):** Clear, concise, non-tech friendly
- ⚠️ **Needs improvement (8 keys):** Minor clarity/consistency issues
- ❌ **Poor (0 keys):** None

---

## 3. Identified Issues

### Issue 1: Inconsistent "clips" vs "highlights" (EN)

**Problem:** Mixing terminology reduces clarity.

| Key | Current EN | Should Be |
|-----|------------|-----------|
| `srq_clips_count` | "$1 clips" | "$1 highlights" |
| `srq_exported_success` | "Saved $1 clips" | "Saved $1 highlights" |
| `srq_widget_title` | "Saved highlights" | (OK) |
| `srq_empty_state` | "No highlights waiting to save." | (OK) |

**Recommendation:** Replace all "clips" with "highlights" for consistency.

**Impact:** 2 keys to update

---

### Issue 2: "Remove" vs "Dismiss" (EN)

**Problem:** Button says "Remove" but action is "dismiss" (status change).

| Current | Problem | Recommendation |
|---------|---------|----------------|
| `srq_dismiss: "Remove"` | "Remove" implies delete (permanent) | "Dismiss" (matches action) or "Hide" |

**Rationale:** "Dismiss" is more accurate (cards are just hidden, not deleted).

**Impact:** 1 key to update

---

### Issue 3: Vague Error Messages (EN + VI)

**Problem:** "Could not save" and "Could not load" don't explain why or what to do.

| Key | Current EN | Current VI | Recommendation EN | Recommendation VI |
|-----|------------|------------|-------------------|-------------------|
| `srq_export_error` | "Could not save" | "Không thể lưu" | "Save failed. Try again or check connection." | "Lưu thất bại. Thử lại hoặc kiểm tra kết nối." |
| `srq_error_state` | "Could not load highlights." | "Không tải được dữ liệu." | "Failed to load. Tap 'Try again'." | "Tải thất bại. Nhấn 'Thử lại'." |

**Rationale:** Users need actionable guidance when errors occur.

**Impact:** 2 keys to update

---

### Issue 4: Vietnamese Subtitle Too Long

**Problem:** `srq_review_subtitle` VI is 26 characters, may overflow on small screens.

| Current VI | Length | Recommendation VI | Length |
|------------|--------|-------------------|--------|
| "$1 đoạn ghi chú sẵn sàng lưu" | 26 chars | "$1 ghi chú chờ lưu" | 16 chars (-38%) |

**Rationale:** Shorter text improves readability and prevents overflow.

**Impact:** 1 key to update

---

### Issue 5: Technical Terms in Vietnamese

**Problem:** `srq_error_state` VI uses "dữ liệu" (data) which is technical.

| Current VI | Issue | Recommendation VI |
|------------|-------|-------------------|
| "Không tải được dữ liệu." | "dữ liệu" = data (tech term) | "Không tải được ghi chú." (highlights, not data) |

**Rationale:** Stay non-tech friendly (per UX requirement).

**Impact:** 1 key to update

---

### Issue 6: Plural Inconsistency (EN)

**Problem:** `srq_time_mins` says "min ago" but should be "mins ago" for clarity.

| Current EN | Problem | Recommendation EN |
|------------|---------|-------------------|
| "$1 min ago" | "min" is singular | "$1 mins ago" or "$1 minutes ago" |

**Minor issue** (doesn't affect UX much).

**Impact:** 1 key to update (optional)

---

### Issue 7: Unused Keys (Suspected)

**Keys that may not be used in current code:**

| Key | Likely Used? | Recommendation |
|-----|--------------|----------------|
| `srq_select` | ❓ Unknown | Verify usage, remove if unused |
| `srq_selected` | ❓ Unknown | Verify usage, remove if unused |
| `srq_skip` | ❓ Unknown | Verify usage, remove if unused |

**Action:** Grep codebase to verify usage.

**Impact:** Potential cleanup (low priority)

---

## 4. Recommended Changes

### High Priority (Must Fix)

| # | Key | Current EN | Proposed EN | Current VI | Proposed VI | Reason |
|---|-----|------------|-------------|------------|-------------|--------|
| 1 | `srq_clips_count` | "$1 clips" | "$1 highlights" | "$1 đoạn" | (unchanged) | Consistency |
| 2 | `srq_exported_success` | "Saved $1 clips" | "Saved $1 highlights" | "Đã lưu $1 đoạn" | (unchanged) | Consistency |
| 3 | `srq_dismiss` | "Remove" | "Dismiss" | "Bỏ qua" | (unchanged) | Accuracy |
| 4 | `srq_export_error` | "Could not save" | "Save failed. Try again." | "Không thể lưu" | "Lưu thất bại. Thử lại." | Clarity + guidance |
| 5 | `srq_error_state` | "Could not load highlights." | "Failed to load. Tap 'Try again'." | "Không tải được dữ liệu." | "Tải thất bại. Nhấn 'Thử lại'." | Non-tech + guidance |
| 6 | `srq_review_subtitle` | (unchanged) | (unchanged) | "$1 đoạn ghi chú sẵn sàng lưu" | "$1 ghi chú chờ lưu" | Length reduction |

**Total:** 6 keys to update

### Low Priority (Nice to Have)

| # | Key | Current EN | Proposed EN | Reason |
|---|-----|------------|-------------|--------|
| 7 | `srq_time_mins` | "$1 min ago" | "$1 mins ago" | Plural clarity |

**Total:** 1 key to update

---

## 5. Before/After Comparison

### Example: Export Success

**Before:**
- EN: "Saved $1 clips" ❌ (inconsistent terminology)
- VI: "Đã lưu $1 đoạn" ✅ (good)

**After:**
- EN: "Saved $1 highlights" ✅ (consistent with "Saved highlights")
- VI: "Đã lưu $1 đoạn" ✅ (unchanged)

### Example: Error State

**Before:**
- EN: "Could not load highlights." ❌ (vague)
- VI: "Không tải được dữ liệu." ❌ (technical term)

**After:**
- EN: "Failed to load. Tap 'Try again'." ✅ (actionable)
- VI: "Tải thất bại. Nhấn 'Thử lại'." ✅ (non-tech + actionable)

### Example: Review Subtitle

**Before:**
- VI: "$1 đoạn ghi chú sẵn sàng lưu" (26 chars) ❌ (too long)

**After:**
- VI: "$1 ghi chú chờ lưu" (16 chars) ✅ (-38% shorter)

---

## 6. Usage Verification

Need to verify if these keys are actually used:

```bash
# Check if keys are referenced in code
cd d:\Amo\ATOM_Extension_V2.8_public
grep -r "srq_select" --include="*.js" --include="*.html"
grep -r "srq_selected" --include="*.js" --include="*.html"
grep -r "srq_skip" --include="*.js" --include="*.html"
```

**Action:** Run verification, remove unused keys if confirmed.

---

## 7. String Length Analysis

### Widget Strings (Sidepanel width ~280px)

| Key | EN Length | VI Length | Max Safe Length | Status |
|-----|-----------|-----------|-----------------|--------|
| `srq_widget_title` | 16 chars | 14 chars | 25 chars | ✅ Good |
| `srq_clips_count` | ~8 chars (with $1=99) | ~7 chars | 15 chars | ✅ Good |
| `srq_export_all` | 8 chars | 11 chars | 15 chars | ✅ Good |

### Modal Strings (Modal width ~420px)

| Key | EN Length | VI Length | Max Safe Length | Status |
|-----|-----------|-----------|-----------------|--------|
| `srq_review_subtitle` | ~30 chars (with $1=99) | 26 chars | 40 chars | ✅ Good (after fix) |
| `srq_export_selected` | ~16 chars (with $1=99) | ~13 chars | 25 chars | ✅ Good |
| `srq_pii_warning` | 79 chars | 59 chars | 100 chars | ✅ Good |

**Verdict:** No overflow issues (after VI subtitle fix).

---

## 8. Tone & Voice Analysis

### Current Tone
- **EN:** Casual, friendly ("just now", "Try again")
- **VI:** Polite, slightly formal ("Hãy xem lại", "Vui lòng thử lại")

### Consistency
- ✅ **Good:** Both use imperative mood for actions ("Save", "Lưu")
- ✅ **Good:** Both use present continuous for status ("Saving...", "Đang lưu...")
- ⚠️ **Minor:** VI slightly more formal (e.g., "Vui lòng" = "Please")

### Recommendation
Keep current tone (works well for target audience).

---

## 9. Accessibility Considerations

### Screen Reader Friendliness

| Key | Current | Screen Reader Output | Issue? |
|-----|---------|----------------------|--------|
| `srq_widget_title` | "Saved highlights" | "Saved highlights" | ✅ Clear |
| `srq_clips_count` | "$1 clips" | "5 clips" (after change: "5 highlights") | ⚠️ Should match title |
| `srq_loading` | "Loading..." | "Loading" (ellipsis ignored) | ✅ Good |
| `srq_export_error` | "Could not save" | "Could not save" | ⚠️ No next step |

**Recommendation:** Error messages should include next action for screen reader users.

---

## 10. Implementation Checklist

### Copy Updates

**Files to modify:**
- `_locales/en/messages.json` (6 keys)
- `_locales/vi/messages.json` (4 keys)

**Changes:**

```json
// _locales/en/messages.json
{
  "srq_clips_count": { "message": "$1 highlights", "placeholders": { "count": { "content": "$1" } } },
  "srq_exported_success": { "message": "Saved $1 highlights", "placeholders": { "count": { "content": "$1" } } },
  "srq_dismiss": { "message": "Dismiss" },
  "srq_export_error": { "message": "Save failed. Try again." },
  "srq_error_state": { "message": "Failed to load. Tap 'Try again'." },
  "srq_time_mins": { "message": "$1 mins ago", "placeholders": { "mins": { "content": "$1" } } }
}

// _locales/vi/messages.json
{
  "srq_export_error": { "message": "Lưu thất bại. Thử lại." },
  "srq_error_state": { "message": "Tải thất bại. Nhấn 'Thử lại'." },
  "srq_review_subtitle": { "message": "$1 ghi chú chờ lưu", "placeholders": { "count": { "content": "$1" } } }
}
```

**Effort:** ~30 minutes to apply changes

### Verification

- [ ] Test all changed keys in UI
- [ ] Verify no layout overflow
- [ ] Check screen reader output
- [ ] Verify unused keys (grep)

**Effort:** ~30 minutes

---

## 11. Summary & Recommendations

### Current State
- ✅ **Parity:** Perfect EN/VI parity (40/40 keys)
- ⚠️ **Quality:** 8 minor issues (mostly EN consistency)
- ✅ **Tone:** Friendly, appropriate for target audience
- ✅ **Length:** No overflow issues (after VI subtitle fix)

### Recommendations for Wave 3 P2

**Must do:**
1. Fix EN terminology inconsistency ("clips" → "highlights") — 2 keys
2. Improve error messages (add actionable guidance) — 2 keys
3. Shorten VI subtitle — 1 key
4. Fix VI technical term ("dữ liệu" → "ghi chú") — 1 key

**Nice to have:**
5. Fix EN plural ("min ago" → "mins ago") — 1 key
6. Verify and remove unused keys — TBD

**Total effort:** ~2 hours (30 min changes + 30 min testing + 1 hour review)

---

*Audit completed: 2026-02-08*
*Next: High-volume analysis, then write Wave 3 P2 Spec v2*
