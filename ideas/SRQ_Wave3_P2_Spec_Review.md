# SRQ Wave 3 P2 Spec — Technical Review
**Date:** 2026-02-08
**Reviewer:** Claude (after Wave 1 P0 + Wave 2 P1 completion)
**Spec Version:** Original Wave 3 P2 Spec

---

## Executive Summary

**Overall Assessment:** ⚠️ **Spec cần bổ sung chi tiết kỹ thuật trước khi triển khai**

**Readiness Score:** 40% ready for implementation

**Key Issues:**
1. ❌ **Missing technical implementation details** (no code examples, no line numbers)
2. ❌ **Vague UX specifications** (no mockups, no specific measurements)
3. ❌ **Incomplete i18n audit scope** (no specific keys to review)
4. ⚠️ **Settings persistence mechanism not detailed**
5. ⚠️ **Density mode CSS changes not specified**
6. ⚠️ **"High-volume list usability" too abstract**
7. ✅ Dependencies clear (requires Wave 1-2 stable)
8. ✅ Non-goals well defined

---

## Detailed Analysis

### 1. ✅ Scope & Goals (Well Defined)

**Strengths:**
- Clear focus on UX polish (not business logic)
- 3 concrete areas: density options, microcopy, list usability
- Non-goals prevent scope creep

**Questions:**
- ❓ What is "nhiều profile người dùng"? Power users vs casual users?
- ❓ "Khi batch nhiều" = how many? 10? 50? 100?

**Score:** 8/10

---

### 2. ❌ Visual Density (Insufficient Detail)

**What's specified:**
- Two modes: `comfortable` (default) and `compact`
- Save in settings
- Apply via CSS classes

**What's MISSING:**
1. **Specific CSS changes:**
   - Line height differences? (`1.6` → `1.4`?)
   - Padding changes? (`16px` → `8px`?)
   - Font size changes? (`14px` → `12px`?)
   - Which elements get compact class?

2. **Visual diff:**
   - No before/after measurements
   - No mockup or reference
   - No specific spacing values

3. **Implementation details:**
   - Where to add toggle UI? (Settings page? Widget header?)
   - How to read setting? (`chrome.storage.sync.get('srqDensityMode')`?)
   - When to apply class? (On widget mount? On setting change?)

**Example missing code:**
```javascript
// Missing: How to apply density mode?
function createWidget(batches, densityMode = 'comfortable') {
    const widget = document.createElement('div');
    widget.className = `srq-widget srq-density-${densityMode}`;  // ← This pattern?
    // ...
}
```

**Score:** 3/10 (concept clear, details missing)

---

### 3. ⚠️ Theme Alignment (Too Vague)

**What's specified:**
- "Tận dụng token hiện hữu"
- "dark/light tương thích"

**What's MISSING:**
1. **Current theme variables:**
   - What tokens exist? (`--surface`, `--border`, `--text-primary`?)
   - Where are they defined? (styles.css? inline?)
   - Are they already used in SRQ?

2. **Dark mode support:**
   - Does extension currently support dark mode?
   - Are SRQ colors hardcoded or use CSS variables?
   - Example: `rgba(255,255,255,0.04)` vs `var(--surface)`

3. **Action items:**
   - Audit current SRQ styles for hardcoded colors?
   - Replace with theme variables?
   - Add dark mode media query?

**Recommendation:**
Run audit first:
```bash
# Find hardcoded colors in SRQ files
grep -r "rgba\|rgb\|#[0-9a-f]" styles/srq.css.js ui/components/srq_widget.js
```

**Score:** 4/10 (needs technical audit before implementation)

---

### 4. ❌ Microcopy Pass (No Specific Keys Listed)

**What's specified:**
- "Rà soát chuỗi i18n"
- Nhất quán động từ
- Rút gọn câu lỗi
- Đồng bộ en/vi parity

**What's MISSING:**
1. **Audit checklist:**
   - Which keys to review? (All `srq_*` keys? Specific subset?)
   - Current count: How many SRQ keys exist? (I count ~30+ from Wave 1-2)

2. **Specific issues:**
   - No examples of current inconsistencies
   - No before/after comparisons
   - No list of keys needing changes

3. **Parity gaps:**
   - Are there keys in EN but not VI (or vice versa)?
   - Are there untranslated placeholders?

**Recommended pre-work:**
```bash
# Extract all SRQ keys
grep -o '"srq_[^"]*"' _locales/en/messages.json | sort > en_keys.txt
grep -o '"srq_[^"]*"' _locales/vi/messages.json | sort > vi_keys.txt
diff en_keys.txt vi_keys.txt  # Find parity gaps
```

**Example missing:**
```
Current issues (examples needed in spec):
- "srq_export_all" vs "srq_export_batch" - inconsistent naming?
- "Could not save" - too vague, should be "Save failed. Try again."?
- VI: "Đang xử lý" vs "Đang lưu" - consistent verb tense?
```

**Score:** 2/10 (needs concrete audit results)

---

### 5. ❌ High-Volume List Usability (Too Abstract)

**What's specified:**
- Header sticky trong review modal
- Badge/color nhẹ
- Pagination nhẹ hoặc collapse nhóm dài (nếu cần)

**What's MISSING:**

#### 5.1 Sticky Header
- **CSS implementation:**
  ```css
  /* Missing: Exact CSS for sticky header */
  .srq-modal-header {
      position: sticky;
      top: 0;
      z-index: ???;  /* What z-index? */
      background: ???;  /* Solid or gradient? */
  }
  ```

- **Shadow on scroll:**
  Should header have shadow when scrolled? How to detect scroll state?

#### 5.2 Badge/Color System
- **What badges?**
  - Card count badge? (already exists)
  - Priority badge? (new feature?)
  - Reading mode badge? (already exists as pills)

- **What colors?**
  - Current: mode pills have colors (green/blue/yellow/gray)
  - Should these change? Less saturated?
  - Example: `rgba(16, 185, 129, 0.3)` → `rgba(16, 185, 129, 0.15)`?

#### 5.3 Pagination vs Collapse
- **When to trigger?**
  - Pagination at > 20 cards?
  - Collapse at > 10 batches?
  - Spec says "pagination nhẹ hoặc collapse" — which one? Both? User choice?

- **Implementation:**
  ```javascript
  // Missing: Pagination logic
  function createBatchList(batches, page = 1, pageSize = 10) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const visible = batches.slice(start, end);
      // ... render pagination controls?
  }
  ```

**Score:** 2/10 (needs concrete design decisions)

---

### 6. ⚠️ Settings Persistence (Mechanism Not Detailed)

**What's specified:**
- Save `srqDensityMode` and `srqShowHints` in settings

**What's MISSING:**
1. **Where to save?**
   - `chrome.storage.sync` (syncs across devices)?
   - `chrome.storage.local` (per-device)?
   - Existing settings key structure?

2. **How to read?**
   ```javascript
   // Missing: Settings API pattern
   async function getSRQSettings() {
       const { srqDensityMode = 'comfortable', srqShowHints = true } =
           await chrome.storage.sync.get(['srqDensityMode', 'srqShowHints']);
       return { srqDensityMode, srqShowHints };
   }
   ```

3. **When to apply?**
   - On sidepanel load?
   - On settings change (listener)?
   - Broadcast to update live widget?

4. **UI for settings:**
   - Where is the toggle? (Options page? Widget header?)
   - How to expose to user?

**Score:** 4/10 (storage API exists, but integration not specified)

---

### 7. ✅ Message Contracts (Appropriate)

**Strengths:**
- No new required events (good — keeps it simple)
- Optional `SRQ_UI_PREF_CHANGED` for internal use only

**Score:** 9/10

---

### 8. ⚠️ Data Model Changes (Incomplete)

**What's specified:**
- `srqDensityMode: "comfortable" | "compact"`
- `srqShowHints: boolean` (optional)

**Questions:**
1. **What are hints?**
   - No mention of hints in goals or UI section
   - What do hints show? (Tooltips? Onboarding?)
   - When are they displayed?

2. **Schema migration:**
   - Do existing users get default values?
   - Backward compatible?

**Score:** 6/10 (schema clear, but "hints" feature unexplained)

---

### 9. ⚠️ UX Copy Examples (Insufficient)

**What's specified:**
4 example strings:
- `Bạn có {n} clip sẵn sàng xuất.`
- `Không có clip chờ.`
- `Xuất thành công {n} clip.`
- `Có lỗi khi xuất. Vui lòng thử lại.`

**What's MISSING:**
1. **English equivalents:**
   - Only Vietnamese examples given
   - Need EN versions for parity check

2. **Existing key mapping:**
   - Which current keys do these replace?
   - `srq_review_subtitle`? `srq_empty_state`? `srq_exported_success`?

3. **Complete audit:**
   - These are 4 examples out of ~30+ SRQ keys
   - Need full before/after table

**Recommended format:**
| Current EN | Current VI | Proposed EN | Proposed VI | Key |
|------------|------------|-------------|-------------|-----|
| "$1 highlights ready to save" | "$1 đoạn trích sẵn sàng lưu" | "You have $1 clips ready to export" | "Bạn có $1 clip sẵn sàng xuất" | `srq_review_subtitle` |
| ... | ... | ... | ... | ... |

**Score:** 3/10 (examples helpful, but incomplete)

---

### 10. ⚠️ Test Plan (Too High-Level)

**What's specified:**
- Unit: Render class theo density mode
- Manual: So sánh comfortable vs compact với 1/5/20 cards
- E2E: Density mode persisted after reload

**What's MISSING:**
1. **Specific test cases:**
   - No acceptance criteria details
   - Example: "Widget height in compact mode should be ≤ 60% of comfortable mode height"

2. **Visual regression:**
   - How to verify UI quality? (Screenshot comparison? Manual review?)
   - No mention of accessibility re-testing after density changes

3. **i18n testing:**
   - How to verify copy improvements?
   - No mention of string length overflow testing

**Score:** 5/10 (basic coverage, lacks specificity)

---

### 11. ✅ Dependencies (Clear)

**Strengths:**
- Explicit: "Wave 1-2 đã ổn định"
- Correct prioritization (polish after core features)

**Score:** 10/10

---

### 12. ⚠️ Effort Estimate (Reasonable but Unvalidated)

**Estimate:** 1.5–2.5 days dev + 0.5 days QA

**Analysis:**
- Seems low if full i18n audit + redesign needed
- If just adding density classes: reasonable
- If includes pagination/collapse: may underestimate

**Depends on scope clarification.**

**Score:** 6/10

---

## Critical Gaps Summary

### 🔴 High Priority (Must address before implementation)

1. **Density Mode CSS Specification**
   - Need exact spacing/font/padding values
   - Need class naming convention
   - Need before/after measurements

2. **i18n Audit Results**
   - Need current state analysis
   - Need specific keys to change
   - Need EN/VI parity gap list

3. **Settings UI Location**
   - Where does user toggle density mode?
   - Mockup or wireframe needed

4. **High-Volume Features Scope**
   - Decide: Pagination OR collapse OR both?
   - Define trigger thresholds (e.g., > 20 cards)
   - Specify implementation approach

### 🟡 Medium Priority (Should clarify)

5. **Theme Token Audit**
   - List current hardcoded colors in SRQ
   - Define replacement strategy

6. **Hints Feature**
   - Explain `srqShowHints` purpose
   - Design hint UI (tooltips? modals?)

7. **Test Acceptance Criteria**
   - Add measurable quality metrics
   - Define visual regression strategy

### 🟢 Low Priority (Nice to have)

8. **Code Examples**
   - Add reference implementations
   - Add file/line number guidance (like Wave 2 P1 spec v2)

---

## Recommendations

### Option 1: Create Wave 3 P2 Spec v2 (Recommended)

Following Wave 2 P1 pattern, create comprehensive spec with:
1. ✅ Density mode CSS values table
2. ✅ Complete i18n audit results (before/after)
3. ✅ Settings persistence code examples
4. ✅ UI mockups or ASCII art for density modes
5. ✅ Concrete high-volume list strategy (choose one: pagination vs collapse)
6. ✅ File-by-file implementation plan with line numbers
7. ✅ Code examples for all major features

**Effort:** 2-3 hours to write comprehensive spec v2

### Option 2: Break Wave 3 into Sub-waves

**Wave 3a:** Density mode only
**Wave 3b:** i18n microcopy pass
**Wave 3c:** High-volume list usability

Each with detailed spec.

**Advantage:** Smaller, focused implementations
**Disadvantage:** More overhead

### Option 3: Pre-implementation Audit Phase

Before spec v2, run audits:
1. Visual audit: Screenshot all SRQ states, measure current spacing
2. i18n audit: Extract all keys, check EN/VI parity, identify issues
3. Theme audit: List all hardcoded colors
4. Volume testing: Test with 50+ cards, identify pain points

**Effort:** 1 day audit → then write spec v2 with concrete data

---

## Comparison with Wave 2 P1 Spec

| Aspect | Wave 2 P1 Spec v2 | Wave 3 P2 Spec (current) |
|--------|-------------------|--------------------------|
| **Technical details** | ✅ Code examples, line numbers | ❌ High-level only |
| **Implementation clarity** | ✅ File-by-file plan | ⚠️ General file list |
| **UX specifications** | ✅ Exact keyboard shortcuts, ARIA attributes | ❌ Vague "badge/color nhẹ" |
| **Data model** | ✅ Complete schema with examples | ⚠️ Schema defined, but "hints" unclear |
| **Test plan** | ✅ Specific scenarios with verification methods | ⚠️ High-level categories |
| **Code examples** | ✅ 10+ code blocks | ❌ No code examples |
| **LOC estimate** | ✅ ~262 LOC breakdown | ⚠️ No LOC estimate |
| **Readiness** | ✅ 100% ready for implementation | ❌ 40% ready |

**Verdict:** Wave 3 P2 spec needs same level of detail as Wave 2 P1 spec v2 to be implementation-ready.

---

## Suggested Next Steps

### If proceeding with Wave 3:

1. **Run pre-implementation audits** (1 day):
   - Visual: Measure current SRQ spacing/fonts
   - i18n: Extract and compare all EN/VI keys
   - Volume: Test with 50 cards, document issues

2. **Create Wave 3 P2 Spec v2** (2-3 hours):
   - Add audit results
   - Add code examples
   - Add concrete CSS values
   - Add file/line number guidance
   - Define high-volume strategy

3. **Get user approval** on spec v2

4. **Implement** (~2-3 days actual dev time)

### Alternative: Defer Wave 3

Wave 1 P0 + Wave 2 P1 already provide:
- ✅ Idempotency (no duplicates)
- ✅ No race conditions
- ✅ Full keyboard accessibility
- ✅ Smooth UX (debounced refresh)
- ✅ Error handling

Wave 3 is **polish**, not **core functionality**. Consider:
- Ship Wave 1-2 to users first
- Gather feedback on actual pain points
- Then spec Wave 3 based on real usage data

---

## Final Assessment

**Readiness:** 40% (40/100 points)

**Breakdown:**
- Scope/Goals: 8/10
- Density mode: 3/10
- Theme alignment: 4/10
- Microcopy: 2/10
- High-volume usability: 2/10
- Settings persistence: 4/10
- Message contracts: 9/10
- Data model: 6/10
- UX examples: 3/10
- Test plan: 5/10
- Dependencies: 10/10
- Effort estimate: 6/10

**Recommendation:** ⚠️ **Không triển khai ngay. Cần spec v2 hoặc defer to Phase 4.**

**Reason:** Wave 3 là polish layer. Nếu spec không rõ ràng, dễ lãng phí effort vào features user không cần. Better to ship Wave 1-2, get feedback, then polish based on real usage.

---

*Review completed: 2026-02-08*
*Next: User decides - Spec v2 now? Audit first? Or defer Wave 3?*
