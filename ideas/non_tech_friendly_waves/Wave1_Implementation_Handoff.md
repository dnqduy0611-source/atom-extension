# Wave 1 Non-Tech Friendly Implementation - Handoff Document

**Date:** 2026-02-08
**Session:** Phase 1 Complete
**Next Session:** Phase 2-6

---

## ✅ Phase 1: COMPLETED (100%)

**Commit:** `5b3b41b` - "feat(i18n): Wave 1 non-tech terminology - term mappings and new keys"

### What was done:

#### 1. Term Mappings Updated (10 items, EN + VI)

| Old term | New EN | New VI | Status |
|----------|--------|--------|--------|
| API key | AI Access Key | Khóa truy cập AI | ✅ Done |
| Model ID | AI Model | Mẫu AI | ✅ Done |
| Semantic Embeddings | Meaning Analysis | Phân tích ý nghĩa | ✅ Done |
| Semantic Search | Find by Meaning | Tìm theo ý nghĩa | ✅ Done |
| Min Confidence | Minimum confidence level | Độ tin cậy tối thiểu | ✅ Done |
| Timeout (ms) | Time limit | Giới hạn thời gian | ✅ Done |
| Budget / day | Daily quota | Hạn mức hàng ngày | ✅ Done |
| Cache TTL (ms) | Temporary storage time | Thời gian lưu tạm | ✅ Done |
| Proxy URL | Proxy address (advanced) | Địa chỉ proxy (nâng cao) | ✅ Done |
| popup_confirm_reset | "Delete all saved highlights, reading history, and AI chat logs?" | "Xóa toàn bộ ghi chú đã lưu, lịch sử đọc và trò chuyện với AI?" | ✅ Done |

#### 2. New i18n Keys Added (16 keys)

**Hint texts (4 keys):**
- `opt_ai_pilot_timeout_hint` - Explains milliseconds unit
- `opt_ai_pilot_budget_hint` - Explains daily call limit
- `opt_ai_pilot_cache_ttl_hint` - Explains cache duration
- `opt_nlm_export_max_chars_hint` - Explains character limit

**Tooltip texts (5 keys):**
- `opt_gemini_api_key_tooltip` - "Your personal key to use AI features..."
- `opt_semantic_embeddings_tooltip` - "AI analyzes the meaning..."
- `opt_semantic_search_tooltip` - "Find highlights by what they mean..."
- `opt_ai_pilot_budget_tooltip` - "Limit how many times..."
- `opt_ai_pilot_timeout_tooltip` - "How long to wait..."

**Advanced section labels (2 keys):**
- `opt_advanced_settings_title` - "Advanced Settings"
- `opt_advanced_badge` - "(For advanced users)"

**Error CTA labels (3 keys):**
- `sp_error_cta_retry` - "Try Again"
- `sp_error_cta_settings` - "Open Settings"
- `popup_connecting` - "Connecting to AI..."

**Updated messages (2 keys):**
- `opt_semantic_cost_warning` - User-friendly cost warning
- `sp_error_rate_limit_desc` - Now includes $1 seconds placeholder
- `sp_error_timeout_desc` - Added "check internet connection"

#### 3. Files Changed

```
_locales/en/messages.json - 58 insertions, 13 deletions
_locales/vi/messages.json - 58 insertions, 14 deletions
Total: 116 insertions, 27 deletions
```

#### 4. Quality Checks Passed

- ✅ EN JSON validated
- ✅ VI JSON validated
- ✅ No trailing commas
- ✅ All new keys have both EN and VI translations
- ✅ Git committed successfully

---

## 🔄 Phase 2-6: PENDING (Next Session)

### Phase 2: Restructure options.html (~2 hours)

**Files to modify:** `options.html` (~1000 lines)

**Tasks:**
1. Add CSS for advanced sections, tooltips, hint texts (Section 6.3 of spec)
2. Wrap advanced fields in `<details>` collapsible sections
3. Add ⓘ tooltip icons next to relevant labels
4. Add `<small class="hint">` under fields with units
5. Scan and remove hardcoded text → replace with `data-i18n`

**Critical fields to wrap in Advanced section:**
- Time limit (Timeout)
- Minimum confidence level
- Daily quota (Budget)
- Temporary storage time (Cache TTL)
- Viewport max chars
- Selected max chars
- Proxy address
- JSON mapping rules (NotebookLM section)

**Where to find current structure:**
- Line ~850-1200: AI Pilot section
- Line ~1200-1400: NotebookLM Bridge section

**CSS to add (from spec Section 6.3):**
```css
.advanced-section { /* collapsible container */ }
.advanced-summary { /* clickable header */ }
.advanced-title { /* "Advanced Settings" text */ }
.advanced-badge { /* "(For advanced users)" badge */ }
.toggle-icon { /* ▼ arrow */ }
.advanced-content { /* expandable content */ }
.info-icon { /* ⓘ tooltip trigger */ }
.hint { /* hint text under inputs */ }
```

### Phase 3: Update options.js (~1.5 hours)

**Files to modify:** `options.js` (~500 lines)

**Tasks:**
1. Implement `initTooltips()` function (Section 6.4 of spec)
2. Update all `atomMsg()` fallback strings to new terminology
3. Add tooltip positioning logic
4. Test advanced sections expand/collapse

**Key function to add:**
```javascript
function initTooltips() {
  const tooltipIcons = document.querySelectorAll('[data-tooltip-i18n]');
  // Create tooltip element, show on hover, position dynamically
}
```

**atomMsg calls to update:**
Search for these patterns and update fallback strings:
- `atomMsg('opt_ai_pilot_timeout_ms', 'Timeout (ms)')` → `'Time limit'`
- `atomMsg('opt_ai_pilot_budget_per_day', 'Budget / day')` → `'Daily quota'`
- Any error messages using technical jargon

### Phase 4: Update popup.js (~0.5 hour)

**Files to modify:** `popup.js`

**Tasks:**
1. Update reset confirm dialog to use new `popup_confirm_reset` key
2. Verify no hardcoded fallback strings remain

**Test:**
- Click Reset button → Should show new message (no "machine learning")

### Phase 5: Update sidepanel.js (~2 hours)

**Files to modify:** `sidepanel.js` (~6950 lines)

**Tasks:**
1. Implement `showError()` function with CTA rendering (Section 6.6 of spec)
2. Add CTA button handlers (`openSettings`, `retryRequest`)
3. Update all error handling callsites to use new keys
4. Test each error type shows CTA button

**Error types to handle:**
- `no_api_key` → CTA: "Open Settings"
- `rate_limit` → CTA: "Try Again" (with wait time)
- `timeout` → CTA: "Try Again"
- `network` → CTA: "Try Again"

**Key function structure:**
```javascript
function showError(errorType, errorDetails) {
  const errorConfig = {
    no_api_key: {
      title: atomMsg('sp_error_no_api_key'),
      desc: atomMsg('sp_error_no_api_key_desc'),
      cta: { label: atomMsg('sp_error_cta_settings'), action: () => openSettings() }
    },
    // ... other error types
  };
  // Render error UI with CTA button
}
```

### Phase 6: Testing & QA (~5 hours)

**Tasks:**

#### 6.1 Automated checks (0.5 hour)
- [ ] Run hardcoded text scan on `options.html`
- [ ] Run i18n key parity check EN/VI
- [ ] Validate all JSON files

#### 6.2 Manual test cases (3 hours)
- [ ] Test Case 1: Non-tech user setup flow (≤5 min)
- [ ] Test Case 2: Reset flow comprehension
- [ ] Test Case 3: Error recovery with CTA
- [ ] Test Case 4: Advanced settings discoverability
- [ ] Test Case 5: Terminology consistency check

#### 6.3 Smoke checklist (1 hour)
- [ ] Popup opens without i18n errors
- [ ] Options page loads in EN and VI
- [ ] Sidepanel empty state shows correct message
- [ ] Sidepanel error states show CTA buttons
- [ ] Advanced sections collapsed by default
- [ ] Tooltips display on hover
- [ ] Hint texts visible under relevant fields
- [ ] No technical terms in basic flow
- [ ] Reset confirmation uses new copy

#### 6.4 Cross-browser testing (0.5 hour)
- [ ] Chrome
- [ ] Edge

---

## 📁 Files Ready for Phase 2-6

### Already Modified (Phase 1):
- ✅ `_locales/en/messages.json` - All new keys added
- ✅ `_locales/vi/messages.json` - All new keys added

### Need to Modify (Phase 2-6):
- ⏳ `options.html` - Add advanced sections, tooltips, hints
- ⏳ `options.js` - Add tooltip logic, update fallbacks
- ⏳ `popup.js` - Update reset confirmation
- ⏳ `sidepanel.js` - Add error CTA rendering

### Reference Files:
- 📄 `ideas/non_tech_friendly_waves/Wave1_Quick_Wins_Copy_Spec_v2.md` - Full spec
- 📄 `ideas/non_tech_friendly_waves/Wave1_Implementation_Handoff.md` - This file
- 📄 `_locales/en/messages.json.backup` - Backup before changes
- 📄 `_locales/vi/messages.json.backup` - Backup before changes

---

## 🎯 Quick Start for Next Session

### 1. Verify Phase 1 Changes

```bash
# Check git status
git log --oneline -1
# Should show: "feat(i18n): Wave 1 non-tech terminology..."

# Verify i18n keys
grep -n "opt_advanced_settings_title" _locales/en/messages.json
grep -n "opt_ai_pilot_timeout_hint" _locales/en/messages.json

# Should see the new keys we added
```

### 2. Start Phase 2 Implementation

```bash
# Read options.html structure
head -100 options.html

# Find where AI Pilot section starts
grep -n "AI Pilot" options.html

# Find where to insert advanced sections
grep -n "aiTimeoutMs" options.html
```

### 3. Use Spec as Reference

Open in parallel:
- `Wave1_Quick_Wins_Copy_Spec_v2.md` - Section 6.3 for options.html changes
- `Wave1_Implementation_Handoff.md` - This file for task checklist

### 4. Follow Appendix B Checklist

From spec v2, use **Appendix B: Implementation Checklist** as task tracker.

---

## 🚨 Important Notes for Next Session

### Critical Points:

1. **Duplicate keys exist in i18n files**
   - Some keys appear twice (e.g., `opt_gemini_api_key` at line 254 and 1127 in EN)
   - This is intentional (backward compatibility)
   - Always use `replace_all: true` when editing these

2. **options.html is ~1000 lines**
   - Large file, work in sections
   - Test frequently in browser during changes
   - Keep CSS changes separate from HTML structure changes

3. **Terminology consistency is critical**
   - Always check against SRQ terminology (already non-tech)
   - "Export" should be "Save" everywhere
   - "Deep" should be "Focused" / "Đọc kỹ"

4. **Advanced section strategy**
   - Use `<details>` native HTML (no JS needed for expand/collapse)
   - Default `open` attribute should be FALSE (collapsed)
   - Only wrap fields listed in spec Section 5.3.1

5. **Error states need visual CTA buttons**
   - Not just text links
   - Must trigger actual actions (openSettings, retryRequest)
   - Test with real error triggers (remove API key, etc.)

### Potential Pitfalls:

❌ **Don't do this:**
- Don't add tooltips to ALL labels (only important ones per spec)
- Don't wrap Core Settings in Advanced section
- Don't change functionality - only UI/copy
- Don't skip testing after each phase

✅ **Do this:**
- Read the spec section before each phase
- Test in browser after HTML changes
- Commit after each phase completes
- Follow exact CSS from spec Section 6.3

---

## 📊 Estimated Time Remaining

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 2 | options.html restructure | 2 hours |
| Phase 3 | options.js tooltip logic | 1.5 hours |
| Phase 4 | popup.js confirm update | 0.5 hour |
| Phase 5 | sidepanel.js error CTAs | 2 hours |
| Phase 6 | Testing & QA | 5 hours |
| **Total** | | **11 hours** |

**Realistic timeline:** 2-3 focused sessions

---

## 🔗 Quick Links

- **Spec v2:** `ideas/non_tech_friendly_waves/Wave1_Quick_Wins_Copy_Spec_v2.md`
- **Commit log:** `git log --grep="Wave 1"`
- **i18n backup:** `_locales/en/messages.json.backup`, `_locales/vi/messages.json.backup`

---

## ✅ Next Session Checklist

When starting next session:

- [ ] Read this handoff document
- [ ] Review Phase 1 commit (`git show 5b3b41b`)
- [ ] Open spec v2 Section 6.3 (options.html guidance)
- [ ] Read options.html lines 1-100 (understand structure)
- [ ] Start Phase 2 implementation
- [ ] Update this file's checklist as you progress

---

**End of Handoff Document**

Last updated: 2026-02-08
Next session: Phase 2-6 implementation
