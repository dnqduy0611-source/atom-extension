# SRQ Visual Audit — Current Styles Analysis
**Date:** 2026-02-08
**Source:** styles/srq.css.js (558 lines)
**Purpose:** Baseline for Wave 3 P2 density modes

---

## Executive Summary

**Total CSS:** 558 lines
**Components:** 5 major (Widget, Batch Card, Modal, Review Card, State Components)
**Theme compatibility:** Partial (uses some CSS vars, many hardcoded colors)
**Density potential:** High (many spacing values can be reduced)

---

## 1. Spacing Audit

### Widget Container
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-widget` | `margin` | `8px 0` | Could reduce to `6px 0` |
| `.srq-widget` | `border-radius` | `12px` | Keep (visual identity) |
| `.srq-header` | `padding` | `10px 12px` | **Compact:** `8px 10px` |
| `.srq-header` | `gap` | `8px` | **Compact:** `6px` |

### Batch List
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-batches` | `max-height` | `300px` | Could increase to `400px` in compact |
| `.srq-batches` | `padding` | `0 8px 8px` | **Compact:** `0 6px 6px` |

### Batch Card
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-batch` | `padding` | `10px` | **Compact:** `8px` (-20%) |
| `.srq-batch` | `margin-bottom` | `6px` | **Compact:** `4px` (-33%) |
| `.srq-batch` | `border-radius` | `8px` | Keep |
| `.srq-batch-header` | `gap` | `6px` | **Compact:** `4px` |
| `.srq-batch-header` | `margin-bottom` | `4px` | **Compact:** `3px` |
| `.srq-batch-modes` | `gap` | `4px` | Keep (already tight) |
| `.srq-batch-modes` | `margin-bottom` | `6px` | **Compact:** `4px` |
| `.srq-batch-meta` | `margin-bottom` | `8px` | **Compact:** `6px` |
| `.srq-batch-actions` | `gap` | `6px` | **Compact:** `4px` |

### Modal
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-modal-header` | `padding` | `16px` | **Compact:** `12px` (-25%) |
| `.srq-modal-body` | `padding` | `12px 16px` | **Compact:** `10px 12px` |
| `.srq-modal-footer` | `padding` | `12px 16px` | **Compact:** `10px 12px` |

### Review Card
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-review-card` | `padding` | `12px` | **Compact:** `10px` |
| `.srq-review-card` | `margin-bottom` | `8px` | **Compact:** `6px` |
| `.srq-review-text` | `margin-bottom` | `6px` | **Compact:** `4px` |
| `.srq-review-meta` | `margin-bottom` | `6px` | **Compact:** `4px` |

### Buttons
| Element | Property | Current Value | Density Impact |
|---------|----------|---------------|----------------|
| `.srq-btn` | `padding` | `4px 10px` | **Compact:** `3px 8px` |
| `.srq-btn-primary` | `padding` | `6px 14px` | **Compact:** `5px 12px` |
| `.srq-btn-secondary` | `padding` | `6px 12px` | **Compact:** `5px 10px` |

**Spacing reduction summary:**
- **Comfortable (current):** Total vertical spacing ~60-70px for typical batch
- **Compact (proposed):** Total vertical spacing ~40-50px (-25-30%)

---

## 2. Typography Audit

### Font Sizes
| Element | Current Size | Line Height | Weight | Density Impact |
|---------|--------------|-------------|--------|----------------|
| `.srq-title` (widget header) | `12px` | default | `600` | Keep |
| `.srq-badge` | `11px` | `1` | `700` | Keep |
| `.srq-batch-label` | `12px` | default | `600` | Keep |
| `.srq-batch-count` | `11px` | default | normal | Keep |
| `.srq-mode-pill` | `10px` | `16px` | `500` | **Compact:** `9px`, `line-height: 14px` |
| `.srq-batch-meta` | `11px` | default | normal | Keep |
| `.srq-btn` | `11px` | `1.4` | normal | Keep |
| `.srq-modal-title` | `14px` | default | `700` | Keep |
| `.srq-modal-subtitle` | `11px` | default | normal | Keep |
| `.srq-review-text` | `12px` | `1.5` | normal | **Compact:** `line-height: 1.4` |
| `.srq-review-meta` | `10px` | default | normal | Keep |
| `.srq-btn-primary` | `12px` | default | `600` | Keep |

**Typography recommendation:**
- **Comfortable:** Keep all current sizes
- **Compact:** Only reduce line-heights (1.5 → 1.4), reduce pill font (10px → 9px)
- **Do NOT reduce** button/label fonts (readability priority)

---

## 3. Color Audit

### Hardcoded Colors (Need Theme Variables)

#### Background Colors
| Element | Property | Current Value | Theme Var Available? | Recommendation |
|---------|----------|---------------|----------------------|----------------|
| `.srq-widget` | `background` | `var(--surface, rgba(255,255,255,0.04))` | ✅ Yes | Good |
| `.srq-widget` | `border` | `var(--border, rgba(255,255,255,0.08))` | ✅ Yes | Good |
| `.srq-badge` | `background` | `#10B981` (green) | ❌ No | Add `var(--accent-green, #10B981)` |
| `.srq-batch` | `background` | `rgba(255,255,255,0.03)` | ⚠️ No var | Add `var(--surface-subtle, ...)` |
| `.srq-batch` | `border` | `rgba(255,255,255,0.06)` | ⚠️ No var | Add `var(--border-subtle, ...)` |
| `.srq-modal` | `background` | `var(--bg-primary, #1a1a1a)` | ✅ Yes | Good |

#### Text Colors
| Element | Property | Current Value | Theme Var Available? | Recommendation |
|---------|----------|---------------|----------------------|----------------|
| `.srq-title` | `color` | `var(--text-primary, #e5e5e5)` | ✅ Yes | Good |
| `.srq-batch-count` | `color` | `var(--text-secondary, #a3a3a3)` | ✅ Yes | Good |
| `.srq-btn-export` | `color` | `#34D399` (green) | ❌ No | Add `var(--accent-green-light, ...)` |

#### Accent Colors (Hardcoded, need vars)
| Purpose | Current Color | Element | Recommendation |
|---------|---------------|---------|----------------|
| **Primary accent** | `#10B981` (green) | Badge, export button, arrows | Add `--accent-primary` |
| **Success** | `#34D399` (light green) | Button text | Add `--accent-success` |
| **Warning** | `#FBBF24` (yellow) | Reference mode pill | Add `--accent-warning` |
| **Error** | `#EF4444` (red) | Dismiss hover | Add `--accent-error` |
| **Info** | `#60A5FA` (blue) | Deep mode pill | Add `--accent-info` |
| **Subtle** | `#9CA3AF` (gray) | Skim mode pill | Add `--text-tertiary` |

#### Mode Pill Colors (All Hardcoded)
| Mode | Background | Text | Need Theme Var? |
|------|------------|------|-----------------|
| Deep | `rgba(59, 130, 246, 0.15)` | `#60A5FA` | ✅ Add `--mode-deep-bg`, `--mode-deep-text` |
| Skim | `rgba(156, 163, 175, 0.15)` | `#9CA3AF` | ✅ Add `--mode-skim-bg`, `--mode-skim-text` |
| Reference | `rgba(245, 158, 11, 0.15)` | `#FBBF24` | ✅ Add `--mode-ref-bg`, `--mode-ref-text` |
| Reread | `rgba(139, 92, 246, 0.15)` | `#A78BFA` | ✅ Add `--mode-reread-bg`, `--mode-reread-text` |

**Color issues summary:**
- ✅ **Good:** Text colors use vars (`--text-primary`, `--text-secondary`)
- ⚠️ **Partial:** Some backgrounds use vars, some hardcoded
- ❌ **Poor:** All accent colors hardcoded (green, blue, yellow, etc.)
- ❌ **Poor:** Mode pills completely hardcoded

**Dark mode compatibility:**
- Current approach: Hardcoded RGBA with low opacity → works in dark
- Issue: No light mode support (if app adds light theme later, colors won't adapt)

---

## 4. Layout Measurements

### Widget Dimensions
| Component | Width | Height (collapsed) | Height (expanded, 5 batches) |
|-----------|-------|--------------------|-----------------------------|
| Widget container | 100% | ~42px (header only) | ~350px (300px max-height + padding) |
| Single batch card | 100% | ~80-100px (depends on modes/meta) | N/A |

### Modal Dimensions
| Component | Width | Max Height | Actual Height (5 cards) |
|-----------|-------|------------|-------------------------|
| Modal overlay | 100vw | 100vh | N/A |
| Modal container | 90% parent, max 420px | 80vh (~600px on 750px screen) | ~450px with header/footer |
| Modal body | 100% | Flex grow | ~350px with 5 cards |

### Batch Card Breakdown (Comfortable)
```
Batch card total height: ~85px
├─ Padding: 10px top + 10px bottom = 20px
├─ Header: ~16px (12px font + 4px margin)
├─ Mode pills: ~22px (16px line-height + 6px margin)
├─ Meta (if present): ~19px (11px font + 8px margin)
└─ Actions: ~24px (buttons with padding)
```

### Batch Card Breakdown (Compact - Proposed)
```
Batch card total height: ~65px (-24%)
├─ Padding: 8px top + 8px bottom = 16px (-4px)
├─ Header: ~15px (12px font + 3px margin) (-1px)
├─ Mode pills: ~18px (14px line-height + 4px margin) (-4px)
├─ Meta (if present): ~17px (11px font + 6px margin) (-2px)
└─ Actions: ~21px (buttons with reduced padding) (-3px)
```

**Height savings:** ~20-24% reduction in compact mode

---

## 5. Interaction States

### Hover/Focus Colors
| Element | Hover State | Focus State | Notes |
|---------|-------------|-------------|-------|
| `.srq-header` | `background: rgba(255,255,255,0.04)` | ❌ None | Should add focus ring |
| `.srq-batch` | `border-color: rgba(16, 185, 129, 0.3)` | ❌ None | Should add focus ring |
| `.srq-btn` | `background: rgba(255,255,255,0.1)` | ❌ None | Should add focus ring |
| `.srq-btn-export` | `background: rgba(16, 185, 129, 0.25)` | ❌ None | Should add focus ring |
| `.srq-btn-dismiss` | `color: #EF4444` | ❌ None | Should add focus ring |

**Issue:** No focus ring styles for keyboard navigation (should be added in Wave 2 P1 or Wave 3)

### Transitions
| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| `.srq-widget` | `all` | `0.2s` | `ease-out` |
| `.srq-header` | `background` | `0.15s` | default |
| `.srq-batch` | `border-color` | `0.15s` | default |
| `.srq-btn` | `all` | `0.15s` | default |
| `.srq-toggle` | `transform` | `0.2s` | default |

All transitions are **fast and smooth** (0.15-0.2s) — good UX.

---

## 6. Recommended Density Mode Changes

### Class Strategy
```css
/* Add density modifier classes */
.srq-widget.srq-density-compact { ... }
.srq-batch.srq-density-compact { ... }
.srq-modal.srq-density-compact { ... }
```

### Compact Mode CSS (Additions)
```css
/* Widget compact */
.srq-widget.srq-density-compact .srq-header {
    padding: 8px 10px;
    gap: 6px;
}

.srq-widget.srq-density-compact .srq-batches {
    padding: 0 6px 6px;
}

/* Batch card compact */
.srq-widget.srq-density-compact .srq-batch {
    padding: 8px;
    margin-bottom: 4px;
}

.srq-widget.srq-density-compact .srq-batch-header {
    gap: 4px;
    margin-bottom: 3px;
}

.srq-widget.srq-density-compact .srq-batch-modes {
    margin-bottom: 4px;
}

.srq-widget.srq-density-compact .srq-mode-pill {
    font-size: 9px;
    line-height: 14px;
}

.srq-widget.srq-density-compact .srq-batch-meta {
    margin-bottom: 6px;
}

.srq-widget.srq-density-compact .srq-batch-actions {
    gap: 4px;
}

.srq-widget.srq-density-compact .srq-btn {
    padding: 3px 8px;
}

/* Modal compact */
.srq-modal.srq-density-compact .srq-modal-header {
    padding: 12px;
}

.srq-modal.srq-density-compact .srq-modal-body {
    padding: 10px 12px;
}

.srq-modal.srq-density-compact .srq-modal-footer {
    padding: 10px 12px;
}

.srq-modal.srq-density-compact .srq-review-card {
    padding: 10px;
    margin-bottom: 6px;
}

.srq-modal.srq-density-compact .srq-review-text {
    line-height: 1.4;
    margin-bottom: 4px;
}

.srq-modal.srq-density-compact .srq-review-meta {
    margin-bottom: 4px;
}

.srq-modal.srq-density-compact .srq-btn-primary {
    padding: 5px 12px;
}

.srq-modal.srq-density-compact .srq-btn-secondary {
    padding: 5px 10px;
}
```

**Estimated LOC:** ~60 lines of additional CSS

---

## 7. Theme Compatibility Issues

### Current State
- **Using vars:** `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--bg-primary`
- **Hardcoded:** All accent colors (green, blue, yellow, red, purple, gray)

### Recommendation: Add Theme Variables
```css
/* Add to root theme (styles.css or equivalent) */
:root {
    /* Accent colors */
    --accent-primary: #10B981;
    --accent-success: #34D399;
    --accent-warning: #FBBF24;
    --accent-error: #EF4444;
    --accent-info: #60A5FA;

    /* Mode colors */
    --mode-deep-bg: rgba(59, 130, 246, 0.15);
    --mode-deep-text: #60A5FA;
    --mode-skim-bg: rgba(156, 163, 175, 0.15);
    --mode-skim-text: #9CA3AF;
    --mode-ref-bg: rgba(245, 158, 11, 0.15);
    --mode-ref-text: #FBBF24;
    --mode-reread-bg: rgba(139, 92, 246, 0.15);
    --mode-reread-text: #A78BFA;

    /* Subtle surfaces */
    --surface-subtle: rgba(255,255,255,0.03);
    --border-subtle: rgba(255,255,255,0.06);
}
```

Then replace all hardcoded colors with `var(--...)` in srq.css.js.

**Effort:** ~30 minutes to add vars, ~1 hour to replace all hardcoded colors

---

## 8. High-Volume List Analysis

### Current Behavior
- **Max height:** 300px with `overflow-y: auto`
- **No pagination:** All batches rendered at once
- **Performance:** Good up to ~20 batches (~6KB DOM)

### Issues at Scale
| Batch Count | Total Height | DOM Nodes | Performance | User Experience |
|-------------|--------------|-----------|-------------|-----------------|
| 1-5 | ~100-400px | ~100 | ✅ Excellent | ✅ Excellent |
| 10-20 | ~800px (scrolls) | ~400 | ✅ Good | ⚠️ Some scrolling |
| 50+ | ~4000px (scrolls) | ~1000+ | ⚠️ Slower render | ❌ Excessive scrolling |
| 100+ | ~8000px | ~2000+ | ❌ Janky | ❌ Unusable scroll |

### Recommendations

#### Option 1: Pagination (Recommended)
```javascript
// Pros: Simple, predictable, low DOM
// Cons: Extra clicks to navigate
const PAGE_SIZE = 10;
function paginateBatches(batches, page) {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return batches.slice(start, end);
}
```

**Trigger:** Always paginate if > 10 batches

**UI:** Simple "Page 1 of 5" with prev/next buttons

#### Option 2: Virtual Scrolling
```javascript
// Pros: Smooth scrolling, handles 1000+ items
// Cons: Complex, requires library or custom code
```

**Not recommended:** Too complex for Phase 3

#### Option 3: Collapse/Expand Groups
```javascript
// Pros: User controls density
// Cons: Cluttered UI with many groups
function groupByDomain(batches) {
    // Group by friendlyDomain(batch.domain)
}
```

**Not recommended:** Grouping logic may confuse users

**Decision:** **Pagination with 10 items/page** (simple, effective)

---

## 9. Summary & Recommendations

### Density Mode
| Aspect | Comfortable (Current) | Compact (Proposed) | Change |
|--------|----------------------|-------------------|--------|
| **Batch card height** | ~85px | ~65px | -24% |
| **Widget max height** | ~350px (5 batches) | ~280px (5 batches) | -20% |
| **Typography** | Current sizes | Reduce line-heights only | Minimal |
| **Readability** | ✅ Excellent | ✅ Good (tested in other apps) | Acceptable |

### Theme Compatibility
| Category | Current | Recommended | Effort |
|----------|---------|-------------|--------|
| **Text colors** | ✅ Uses vars | Keep | 0 hours |
| **Surface colors** | ⚠️ Partial | Add `--surface-subtle`, `--border-subtle` | 0.5 hours |
| **Accent colors** | ❌ Hardcoded | Add 5 accent vars | 1 hour |
| **Mode pills** | ❌ Hardcoded | Add 8 mode vars | 0.5 hours |

**Total theme work:** ~2 hours

### High-Volume Strategy
| Option | Trigger | Pros | Cons | Recommendation |
|--------|---------|------|------|----------------|
| **Pagination** | > 10 batches | Simple, predictable | Extra clicks | ✅ Recommended |
| **Virtual scroll** | > 50 batches | Smooth | Complex | ❌ Overkill |
| **Collapse groups** | User choice | Flexible | Cluttered UI | ❌ Not needed |

**Decision:** Pagination with 10 items/page

---

## 10. Implementation Checklist for Wave 3

### Must Have
- [x] Audit current spacing (this document)
- [ ] Add density mode CSS classes (~60 LOC)
- [ ] Add theme variables for colors (~15 vars)
- [ ] Replace hardcoded colors with vars (~30 replacements)
- [ ] Implement pagination for > 10 batches (~50 LOC JS)
- [ ] Add density mode setting to storage
- [ ] Add density mode toggle UI (in settings or widget)

### Nice to Have
- [ ] Add focus ring styles for keyboard nav
- [ ] Sticky modal header (when scrolling review cards)
- [ ] Smooth transitions between density modes

### Won't Do (Defer)
- ❌ Virtual scrolling (too complex)
- ❌ Collapse/expand groups (not needed)
- ❌ Light theme (no requirement yet)

---

*Audit completed: 2026-02-08*
*Next: i18n audit, then write Wave 3 P2 Spec v2*
