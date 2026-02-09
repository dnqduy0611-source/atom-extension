# Wave 3 Localization Completion Spec - Review & Analysis

**Date**: 2026-02-08
**Reviewer**: Claude Code
**Status**: ⚠️ **Requires Updates Before Implementation**

---

## Executive Summary

Wave 3 spec has **solid structure and clear goals**, but contains **outdated baseline data** and lacks **practical batching strategy** for the large translation workload.

**Key Findings**:
- ✅ Clear objectives and test plan
- ⚠️ **BLOCKER**: Baseline numbers are outdated (off by ~40 keys)
- ⚠️ **CRITICAL**: 225 keys in `sp_*` domain need strategic batching
- ⚠️ Missing implementation guidance for large-scale translation workflow
- ✅ Good parity check tool proposal
- ✅ No placeholder mismatches in existing keys (clean foundation)

---

## 1. Current State Analysis (Updated Baseline)

### Actual Numbers vs Spec:
| Metric | Spec Claims | Actual Reality | Δ |
|--------|------------|----------------|---|
| EN keys | 755 | **797** | +42 |
| VI keys | 488 | **545** | +57 |
| Missing in VI | 267 | **252** | -15 |
| Missing in EN | - | **0** | ✅ |

**Note**: The improvement (missing reduced from 267 to 252) is because Wave 1 and Wave 2 added keys to BOTH EN and VI, not just EN.

### Missing Keys by Domain:
```
sp_*         → 225 keys (89.3%) 🚨 HUGE BATCH
focus_*      → 13 keys (5.2%)
sidepanel_*  → 8 keys (3.2%)
reading_*    → 3 keys (1.2%)
ctx_*        → 1 key (0.4%)
opt_*        → 1 key (0.4%)
popup_*      → 1 key (0.4%)
────────────────────────────
TOTAL        → 252 keys
```

**Critical Insight**: 89% of missing keys are in `sp_*` domain (sidepanel UI). This is NOT mentioned in the spec and requires special handling.

---

## 2. Issues Found

### 🔴 BLOCKER Issues:

#### Issue #1: Outdated Baseline
**Problem**: Spec uses old baseline (EN: 755, VI: 488) from before Wave 1/2 implementations.

**Impact**:
- Translation workload estimate is inaccurate
- Missing keys count is off by 15
- Developer may start work with wrong scope

**Fix Required**:
Update section 2 with:
```markdown
## 2) Baseline hien tai (Cap nhat 2026-02-08)
1. EN: 797 keys.
2. VI: 545 keys.
3. Missing in VI: 252 keys.
4. Placeholder mismatches: 0 (clean state).
5. Khong co gate tu dong trong repo de bao loi missing key.
```

#### Issue #2: No Batching Strategy for 225 sp_* Keys
**Problem**: Spec mentions "nhom theo domain key de chia batch review" but doesn't specify HOW to batch 225 keys.

**Impact**:
- 225 keys is too large for one sitting
- Risk of translation fatigue → quality drop
- No clear PR review strategy

**Fix Required**:
Add detailed batching plan in section 5.1:

```markdown
### 5.1.1 Batch Strategy for sp_* Keys (225 keys)

Chia thanh 5 batch theo chu de chuc nang:

**Batch 1: Core UI & Navigation (40 keys)**
- sp_title, sp_threads_label, sp_highlighted_text
- sp_menu_*, sp_toggle_*, sp_btn_*
- sp_input_placeholder, sp_no_*, sp_from_*

**Batch 2: Retention Features (45 keys)**
- sp_retention_*, sp_quiz_*, sp_teachback_*, sp_flashcard_*
- sp_bloom_level_*

**Batch 3: Learning Features (50 keys)**
- sp_primer_*, sp_mode_*, sp_stats_*, sp_connections_*
- sp_deep_angle_*, sp_semantic_*

**Batch 4: Actions & Feedback (45 keys)**
- sp_action_*, sp_chip_*, sp_nudge_*
- sp_toast_*, sp_shortcut_*
- sp_auto_summary_*

**Batch 5: Errors & Edge Cases (45 keys)**
- sp_error_*, sp_offline_*, sp_network_*
- sp_export_*, sp_multitab_*, sp_confirm_*
- sp_undo, sp_retry, sp_retrying, sp_waiting_connection

**Implementation Order**: Batch 1 → 2 → 3 → 4 → 5
**Review cadence**: 1 batch/PR, QA test after each merge.
```

---

### ⚠️ WARNING Issues:

#### Issue #3: No Runtime Fallback Audit Detail
**Problem**: Section 5.3 mentions "rasoat fallback hardcoded" but doesn't specify:
- Which files have the most fallbacks?
- What pattern to look for?
- How to prioritize?

**Recommendation**:
Add code pattern examples:
```javascript
// ❌ Bad fallback (technical jargon)
const msg = chrome.i18n.getMessage('key') || 'API key not found';

// ✅ Good fallback (plain language)
const msg = chrome.i18n.getMessage('key') || 'AI access key is missing. Please add it in Settings.';
```

#### Issue #4: Parity Check Tool Location
**Problem**: Spec proposes `tools/i18n/check_parity.mjs` but `tools/` directory doesn't exist in repo.

**Recommendation**:
- Create directory structure: `tools/i18n/`
- OR use existing pattern: `spec/tools/i18n_parity_check.mjs`

---

## 3. What Spec Does Well ✅

1. **Clear quantitative goals**: "missing in vi = 0" is measurable
2. **Good non-goals**: Explicitly states no runtime logic changes
3. **Placeholder preservation rule**: Critical for avoiding bugs
4. **Domain-based key naming**: Helps with organization
5. **Exit code requirement for parity check**: Enables CI integration
6. **UTF-8 validation**: Catches encoding issues early

---

## 4. Implementation Risks Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Translation fatigue (225 keys) | HIGH | HIGH | Use batching strategy |
| Meaning drift from EN | MEDIUM | HIGH | Domain expert review per batch |
| Placeholder syntax errors | LOW | HIGH | Automated parity check |
| JSON syntax errors | LOW | MEDIUM | Pre-commit hook with JSON lint |
| Regression in EN locale | LOW | HIGH | Keep EN unchanged, test both locales |

---

## 5. Recommendations for v2 Spec

### Must-Have Changes:
1. ✅ Update baseline numbers (section 2)
2. ✅ Add sp_* batching strategy (section 5.1.1)
3. ✅ Add batch translation guide with examples
4. ✅ Specify parity check tool location

### Nice-to-Have Additions:
1. Sample translations for each domain (glossary)
2. Translation QA checklist (length, tone, consistency)
3. Rollback plan per batch (not just generic)
4. Estimated time per batch (not just total)

### Optional Enhancements:
1. Add pre-commit hook to auto-run parity check
2. Create translation memory (TM) for consistent terms
3. Add visual regression test screenshots for VI locale

---

## 6. Revised Implementation Plan

### Phase 1: Preparation (0.5 day)
1. Create updated spec v2 with batching strategy
2. Build and test parity check tool
3. Create translation glossary from Wave 1/2 terms

### Phase 2: Translation - Small Domains (0.5 day)
1. Batch: focus_* (13 keys)
2. Batch: sidepanel_* (8 keys)
3. Batch: reading_*, ctx_*, opt_*, popup_* (6 keys)
4. **Total: 27 keys** - Quick wins to build momentum

### Phase 3: Translation - sp_* Batches (2.5 days)
1. Batch 1: Core UI (40 keys) → PR + QA → Merge
2. Batch 2: Retention (45 keys) → PR + QA → Merge
3. Batch 3: Learning (50 keys) → PR + QA → Merge
4. Batch 4: Actions (45 keys) → PR + QA → Merge
5. Batch 5: Errors (45 keys) → PR + QA → Merge

### Phase 4: Validation (0.5 day)
1. Run parity check → verify 0 missing
2. Manual QA: popup, options, sidepanel, focus mode
3. Screenshot comparison EN vs VI

**Revised Total Estimate**: 4 days (vs spec's 2 days)

---

## 7. Acceptance Criteria (Enhanced)

Original criteria from spec:
- ✅ `missing in vi = 0`
- ✅ `missing in en = 0`
- ✅ `placeholder mismatch = 0`
- ✅ QA khong ghi nhan fallback English trong 5 flow chinh

**Additional criteria**:
- ✅ All 5 sp_* batches reviewed and merged
- ✅ Parity check tool integrated in CI (optional)
- ✅ Translation glossary documented for future maintenance
- ✅ No regression in EN locale after VI additions

---

## 8. Decision Points for User

Before proceeding with v2 spec creation, please decide:

### A. Batching Approach:
- **Option 1**: Aggressive (3 large batches, 2 days)
- **Option 2**: Conservative (7 batches as proposed above, 4 days) ← **Recommended**
- **Option 3**: Hybrid (5 batches, 3 days)

### B. Parity Check Tool:
- **Option 1**: Build custom MJS tool as spec suggests
- **Option 2**: Use simple Node.js script without ESM
- **Option 3**: Use existing npm packages (e.g., `i18n-unused`)

### C. Implementation Trigger:
- **Option A**: Create v2 spec first, then wait for approval
- **Option B**: Start with Phases 1-2 (preparation + small domains), then ask
- **Option C**: Implement all at once (risky for 252 keys)

---

## 9. Next Steps

**If user approves v2 spec creation**:
1. Create `Wave3_Localization_Completion_Spec_v2.md` with:
   - Updated baseline
   - Detailed batching strategy
   - Batch-specific acceptance criteria
   - Per-batch test checklist
2. Build parity check tool prototype
3. Create translation glossary from Wave 1/2
4. Start Phase 1 (preparation)

**If user wants to review first**:
- Discuss batching approach choice
- Clarify estimation constraints
- Align on tooling decisions

---

## Conclusion

Wave 3 spec is **structurally sound** but needs **practical updates** to handle the reality of 252 keys (89% in one domain). The proposed batching strategy and updated baseline will make this achievable in 4 days instead of the overly optimistic 2 days.

**Verdict**: ⚠️ **Spec needs v2 revision before implementation** (similar to Wave 2)
