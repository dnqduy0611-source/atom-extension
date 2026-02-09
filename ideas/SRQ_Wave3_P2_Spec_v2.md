# SRQ Remediation Wave 3 (P2) Spec v2
**Version:** 2.0 (with complete audit results)
**Date:** 2026-02-08
**Prerequisites:** Wave 1 P0 + Wave 2 P1 complete
**Audits Completed:** Visual, i18n, High-volume analysis

---

## Executive Summary

Wave 3 P2 focuses on **UX polish and scalability** after stable Wave 1-2 foundation:

1. ✅ **Density modes:** Comfortable (current) + Compact (-25% spacing)
2. ✅ **Theme compatibility:** Replace 30+ hardcoded colors with CSS variables
3. ✅ **Microcopy improvements:** Fix 6 EN/VI keys for consistency + clarity
4. ✅ **Pagination:** Handle > 10 batches gracefully (10 items/page)
5. ✅ **Sticky header:** Modal header stays visible when scrolling

**Impact:** Better readability, faster scanning, scalable to 100+ batches

---

## 1) Mục tiêu & Phạm vi

### Goals
1. **User preference:** Add density mode setting (comfortable/compact)
2. **Consistency:** Fix terminology issues ("clips" → "highlights" in EN)
3. **Clarity:** Improve error messages with actionable guidance
4. **Scalability:** Support 50+ batches without performance/UX degradation
5. **Theme:** Replace hardcoded colors → CSS variables for future-proofing

### Non-goals
- ❌ No business logic changes (export/dismiss flow unchanged)
- ❌ No new message contracts (keep Wave 1-2 events)
- ❌ No new permissions
- ❌ No visual redesign (enhance existing design only)

---

## 2) Audit Results Summary

### Visual Audit ([Full Report](SRQ_Wave3_Visual_Audit.md))
- **Current spacing:** ~85px per batch card (comfortable)
- **Proposed spacing:** ~65px per batch card (compact) **[-24%]**
- **Hardcoded colors:** 30+ colors need CSS var replacement
- **Density potential:** High (many values reducible without readability loss)

### i18n Audit ([Full Report](SRQ_Wave3_i18n_Audit.md))
- **Parity:** ✅ Perfect (40 EN keys, 40 VI keys)
- **Quality issues:** 6 keys need fixes (EN consistency, VI length, error clarity)
- **Effort:** ~2 hours to fix + test

### High-Volume Audit (Visual Audit Section 8)
- **Current limit:** Comfortable up to ~20 batches
- **Issue at 50+:** Excessive scrolling, slow render
- **Solution:** Pagination at 10 batches/page

---

## 3) Feature 1: Density Modes

### 3.1 CSS Changes

#### Class Strategy
```css
/* Add density modifier to parent container */
.srq-widget.srq-density-compact { ... }
.srq-modal.srq-density-compact { ... }
```

#### Compact Mode Spacing Table

| Element | Property | Comfortable | Compact | Reduction |
|---------|----------|-------------|---------|-----------|
| `.srq-header` | `padding` | `10px 12px` | `8px 10px` | -20% |
| `.srq-header` | `gap` | `8px` | `6px` | -25% |
| `.srq-batches` | `padding` | `0 8px 8px` | `0 6px 6px` | -25% |
| `.srq-batch` | `padding` | `10px` | `8px` | -20% |
| `.srq-batch` | `margin-bottom` | `6px` | `4px` | -33% |
| `.srq-batch-header` | `gap` | `6px` | `4px` | -33% |
| `.srq-batch-header` | `margin-bottom` | `4px` | `3px` | -25% |
| `.srq-batch-modes` | `margin-bottom` | `6px` | `4px` | -33% |
| `.srq-mode-pill` | `font-size` | `10px` | `9px` | -10% |
| `.srq-mode-pill` | `line-height` | `16px` | `14px` | -12.5% |
| `.srq-batch-meta` | `margin-bottom` | `8px` | `6px` | -25% |
| `.srq-batch-actions` | `gap` | `6px` | `4px` | -33% |
| `.srq-btn` | `padding` | `4px 10px` | `3px 8px` | -25% |
| `.srq-modal-header` | `padding` | `16px` | `12px` | -25% |
| `.srq-modal-body` | `padding` | `12px 16px` | `10px 12px` | -20% |
| `.srq-modal-footer` | `padding` | `12px 16px` | `10px 12px` | -20% |
| `.srq-review-card` | `padding` | `12px` | `10px` | -17% |
| `.srq-review-card` | `margin-bottom` | `8px` | `6px` | -25% |
| `.srq-review-text` | `line-height` | `1.5` | `1.4` | -6.7% |
| `.srq-review-text` | `margin-bottom` | `6px` | `4px` | -33% |
| `.srq-review-meta` | `margin-bottom` | `6px` | `4px` | -33% |
| `.srq-btn-primary` | `padding` | `6px 14px` | `5px 12px` | -17% |
| `.srq-btn-secondary` | `padding` | `6px 12px` | `5px 10px` | -17% |

**Total vertical space reduction:** ~25-30%

#### Complete CSS Code

**File:** `styles/srq.css.js` (add after line ~533)

```css
/* ===========================
   Density Mode: Compact (Wave 3 P2)
   =========================== */

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

**Estimated LOC:** +65 lines

### 3.2 Settings Persistence

**Storage key:** `srqDensityMode: "comfortable" | "compact"`

**Default:** `"comfortable"` (backward compatible)

**Storage location:** `chrome.storage.sync` (syncs across devices)

#### Settings API

**File:** Create `storage/srq_settings.js` (new file)

```javascript
/**
 * SRQ Settings - User preferences for Smart Research Queue
 * Wave 3 P2: Density mode preference
 */

const DEFAULT_SETTINGS = {
    srqDensityMode: 'comfortable',  // "comfortable" | "compact"
    srqShowHints: true              // Reserved for future use
};

/**
 * Get SRQ settings with defaults
 * @returns {Promise<Object>} Settings object
 */
export async function getSRQSettings() {
    const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return {
        srqDensityMode: result.srqDensityMode || DEFAULT_SETTINGS.srqDensityMode,
        srqShowHints: result.srqShowHints !== undefined ? result.srqShowHints : DEFAULT_SETTINGS.srqShowHints
    };
}

/**
 * Update SRQ settings
 * @param {Object} updates - Settings to update
 * @returns {Promise<void>}
 */
export async function updateSRQSettings(updates) {
    await chrome.storage.sync.set(updates);

    // Broadcast setting change (optional, for live update)
    chrome.runtime.sendMessage({
        type: 'SRQ_SETTINGS_CHANGED',
        settings: updates
    }).catch(() => {});
}

/**
 * Reset to defaults
 * @returns {Promise<void>}
 */
export async function resetSRQSettings() {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
}
```

**Estimated LOC:** +45 lines (new file)

### 3.3 UI Integration

#### Apply Density Class

**File:** `sidepanel.js` (update `mountSRQWidget`, line ~6915)

```javascript
async function mountSRQWidget() {
    const container = document.getElementById('srq-widget-container');
    if (!container) return;

    // Wave 3 P2: Load density preference
    const { srqDensityMode } = await chrome.storage.sync.get({ srqDensityMode: 'comfortable' });

    // Wave 1 P0: Show loading state
    container.innerHTML = '';
    const loadingState = window.SRQWidget?.createLoadingState();
    if (loadingState) {
        // Wave 3 P2: Apply density class
        if (srqDensityMode === 'compact') {
            loadingState.classList.add('srq-density-compact');
        }
        container.appendChild(loadingState);
    }

    try {
        const response = await chrome.runtime.sendMessage({ type: "SRQ_GET_BATCHES" });

        container.innerHTML = '';

        if (!response?.ok) {
            const errorState = window.SRQWidget?.createErrorState(() => mountSRQWidget());
            if (errorState) {
                if (srqDensityMode === 'compact') {
                    errorState.classList.add('srq-density-compact');
                }
                container.appendChild(errorState);
            }
            return;
        }

        if (!response.batches || response.batches.length === 0) {
            const emptyState = window.SRQWidget?.createEmptyState();
            if (emptyState) {
                if (srqDensityMode === 'compact') {
                    emptyState.classList.add('srq-density-compact');
                }
                container.appendChild(emptyState);
            }
            return;
        }

        // Wave 3 P2: Pass density mode to widget
        const widget = window.SRQWidget?.create(response.batches, srqDensityMode);
        if (widget) container.appendChild(widget);

    } catch (err) {
        console.warn('[ATOM SRQ] Widget mount failed:', err.message);
        container.innerHTML = '';
        const errorState = window.SRQWidget?.createErrorState(() => mountSRQWidget());
        if (errorState) {
            if (srqDensityMode === 'compact') {
                errorState.classList.add('srq-density-compact');
            }
            container.appendChild(errorState);
        }
    }
}
```

**File:** `ui/components/srq_widget.js` (update `createWidget`, line ~133)

```javascript
function createWidget(batches, densityMode = 'comfortable') {
    if (!batches || batches.length === 0) return null;

    const totalCards = batches.reduce((sum, b) => sum + (b.cards?.length || 0), 0);
    if (totalCards === 0) return null;

    const widget = document.createElement('div');
    widget.className = 'srq-widget';
    // Wave 3 P2: Apply density class
    if (densityMode === 'compact') {
        widget.classList.add('srq-density-compact');
    }
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', msg('srq_widget_title', 'Saved highlights'));

    // ... rest of widget creation ...
}
```

**File:** `ui/components/srq_widget.js` (update `openReviewModal`, line ~256)

```javascript
async function openReviewModal(batch) {
    // Wave 3 P2: Load density preference
    const { srqDensityMode } = await chrome.storage.sync.get({ srqDensityMode: 'comfortable' });

    // Close any existing modal
    closeReviewModal();

    // ... existing modal creation code ...

    const modal = document.createElement('div');
    modal.className = 'srq-modal';
    // Wave 3 P2: Apply density class
    if (srqDensityMode === 'compact') {
        modal.classList.add('srq-density-compact');
    }

    // ... rest of modal creation ...
}
```

### 3.4 Settings UI (Options Page)

**File:** `options.html` (add after existing settings, line ~TBD)

```html
<!-- Wave 3 P2: SRQ Density Mode -->
<div class="setting-group">
    <h3>Smart Research Queue</h3>
    <div class="setting-item">
        <label for="srq-density-mode">Display density:</label>
        <select id="srq-density-mode">
            <option value="comfortable">Comfortable (default)</option>
            <option value="compact">Compact (more items per screen)</option>
        </select>
        <p class="setting-description">
            Comfortable mode: More spacing, easier to read.<br>
            Compact mode: Less spacing, see more highlights at once.
        </p>
    </div>
</div>
```

**File:** `options.js` (add handlers)

```javascript
// Wave 3 P2: Load SRQ density setting
async function loadSRQSettings() {
    const { srqDensityMode } = await chrome.storage.sync.get({ srqDensityMode: 'comfortable' });
    const select = document.getElementById('srq-density-mode');
    if (select) {
        select.value = srqDensityMode;
    }
}

// Wave 3 P2: Save SRQ density setting
async function saveSRQDensity() {
    const select = document.getElementById('srq-density-mode');
    if (!select) return;

    const srqDensityMode = select.value;
    await chrome.storage.sync.set({ srqDensityMode });

    // Show saved confirmation
    showSavedToast('Density mode updated');
}

// Add listeners
document.addEventListener('DOMContentLoaded', () => {
    // ... existing init ...
    loadSRQSettings();

    const densitySelect = document.getElementById('srq-density-mode');
    if (densitySelect) {
        densitySelect.addEventListener('change', saveSRQDensity);
    }
});
```

**Estimated LOC:** +25 lines (options page integration)

---

## 4) Feature 2: Theme Compatibility

### 4.1 Color Audit Results

**Hardcoded colors found:** 30+ instances
**Categories:** Accent (5), Mode pills (8), Surfaces (4), Text (already using vars ✅)

### 4.2 Theme Variables

**File:** `styles.css` or root theme file (add theme variables)

```css
/* Wave 3 P2: SRQ Theme Variables */
:root {
    /* Accent colors */
    --srq-accent-primary: #10B981;
    --srq-accent-success: #34D399;
    --srq-accent-warning: #FBBF24;
    --srq-accent-error: #EF4444;
    --srq-accent-info: #60A5FA;

    /* Mode colors */
    --srq-mode-deep-bg: rgba(59, 130, 246, 0.15);
    --srq-mode-deep-text: #60A5FA;
    --srq-mode-skim-bg: rgba(156, 163, 175, 0.15);
    --srq-mode-skim-text: #9CA3AF;
    --srq-mode-ref-bg: rgba(245, 158, 11, 0.15);
    --srq-mode-ref-text: #FBBF24;
    --srq-mode-reread-bg: rgba(139, 92, 246, 0.15);
    --srq-mode-reread-text: #A78BFA;

    /* Subtle surfaces */
    --srq-surface-subtle: rgba(255,255,255,0.03);
    --srq-border-subtle: rgba(255,255,255,0.06);
}
```

**Estimated LOC:** +20 lines

### 4.3 Replace Hardcoded Colors

**File:** `styles/srq.css.js` (replace colors with vars)

| Line | Current | Replace With |
|------|---------|--------------|
| ~60 | `background: #10B981;` | `background: var(--srq-accent-primary);` |
| ~95 | `background: rgba(255,255,255,0.03);` | `background: var(--srq-surface-subtle);` |
| ~96 | `border: 1px solid rgba(255,255,255,0.06);` | `border: 1px solid var(--srq-border-subtle);` |
| ~104 | `border-color: rgba(16, 185, 129, 0.3);` | `border-color: rgba(var(--srq-accent-primary-rgb), 0.3);` (*) |
| ~151-168 | Mode pill colors | Use `var(--srq-mode-*-bg)` and `var(--srq-mode-*-text)` |
| ~181 | `color: #10B981;` | `color: var(--srq-accent-primary);` |
| ~207-214 | Export button colors | Use `var(--srq-accent-primary)` and `var(--srq-accent-success)` |
| ~225 | `color: #EF4444;` | `color: var(--srq-accent-error);` |
| ~392 | `background: #10B981;` | `background: var(--srq-accent-primary);` |
| ~404 | `background: #059669;` | `background: color-mix(in srgb, var(--srq-accent-primary) 85%, black);` |

(*) Note: For RGBA with custom alpha, need to either:
- Use `color-mix()` (modern CSS)
- Define RGB variant: `--srq-accent-primary-rgb: 16, 185, 129;`

**Recommended approach:** Add RGB variants for colors needing alpha:

```css
:root {
    --srq-accent-primary: #10B981;
    --srq-accent-primary-rgb: 16, 185, 129;  /* For rgba() usage */
}

/* Usage */
.srq-batch:hover {
    border-color: rgba(var(--srq-accent-primary-rgb), 0.3);
}
```

**Estimated LOC:** ~30 replacements (no new lines, just edits)

**Effort:** ~1 hour to replace all colors

---

## 5) Feature 3: Microcopy Improvements

### 5.1 Changes Required

**Based on i18n audit**, fix 6 keys:

| # | Key | Current EN | Proposed EN | Current VI | Proposed VI |
|---|-----|------------|-------------|------------|-------------|
| 1 | `srq_clips_count` | "$1 clips" | "$1 highlights" | "$1 đoạn" | (unchanged) |
| 2 | `srq_exported_success` | "Saved $1 clips" | "Saved $1 highlights" | "Đã lưu $1 đoạn" | (unchanged) |
| 3 | `srq_dismiss` | "Remove" | "Dismiss" | "Bỏ qua" | (unchanged) |
| 4 | `srq_export_error` | "Could not save" | "Save failed. Try again." | "Không thể lưu" | "Lưu thất bại. Thử lại." |
| 5 | `srq_error_state` | "Could not load highlights." | "Failed to load. Tap 'Try again'." | "Không tải được dữ liệu." | "Tải thất bại. Nhấn 'Thử lại'." |
| 6 | `srq_review_subtitle` | (unchanged) | (unchanged) | "$1 đoạn ghi chú sẵn sàng lưu" | "$1 ghi chú chờ lưu" |

### 5.2 Implementation

**File:** `_locales/en/messages.json` (lines 2180, 2197, 2185, 2198, 2216)

```json
{
  "srq_clips_count": { "message": "$1 highlights", "placeholders": { "count": { "content": "$1" } } },
  "srq_exported_success": { "message": "Saved $1 highlights", "placeholders": { "count": { "content": "$1" } } },
  "srq_dismiss": { "message": "Dismiss" },
  "srq_export_error": { "message": "Save failed. Try again." },
  "srq_error_state": { "message": "Failed to load. Tap 'Try again'." }
}
```

**File:** `_locales/vi/messages.json` (lines 1334, 1352, 1325)

```json
{
  "srq_export_error": { "message": "Lưu thất bại. Thử lại." },
  "srq_error_state": { "message": "Tải thất bại. Nhấn 'Thử lại'." },
  "srq_review_subtitle": { "message": "$1 ghi chú chờ lưu", "placeholders": { "count": { "content": "$1" } } }
}
```

**Estimated LOC:** 6 EN edits + 3 VI edits = 9 edits (no new lines)

**Effort:** ~15 minutes

---

## 6) Feature 4: Pagination (High-Volume Support)

### 6.1 Strategy

**Trigger:** Paginate when > 10 batches
**Page size:** 10 batches/page
**UI:** Simple prev/next + page indicator

### 6.2 Implementation

**File:** `ui/components/srq_widget.js` (update `createWidget`, line ~133)

```javascript
function createWidget(batches, densityMode = 'comfortable', currentPage = 1) {
    if (!batches || batches.length === 0) return null;

    const totalCards = batches.reduce((sum, b) => sum + (b.cards?.length || 0), 0);
    if (totalCards === 0) return null;

    // Wave 3 P2: Pagination logic
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil(batches.length / PAGE_SIZE);
    const needsPagination = batches.length > PAGE_SIZE;

    let visibleBatches = batches;
    if (needsPagination) {
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        visibleBatches = batches.slice(start, end);
    }

    const widget = document.createElement('div');
    widget.className = 'srq-widget';
    if (densityMode === 'compact') {
        widget.classList.add('srq-density-compact');
    }
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', msg('srq_widget_title', 'Saved highlights'));

    // Header
    const header = document.createElement('div');
    header.className = 'srq-header';
    header.innerHTML = `
        <span class="srq-icon" aria-hidden="true">&#128278;</span>
        <span class="srq-title">${msg('srq_widget_title', 'Saved highlights')}</span>
        <span class="srq-badge" aria-label="${totalCards} ${msg('srq_clips_label', 'items')}">${totalCards}</span>
        <button class="srq-toggle" aria-label="${msg('srq_toggle', 'Show more')}" title="${msg('srq_toggle', 'Show more')}">&#9660;</button>
    `;
    header.addEventListener('click', () => {
        widget.classList.toggle('expanded');
        const toggleBtn = header.querySelector('.srq-toggle');
        const isExpanded = widget.classList.contains('expanded');
        toggleBtn.setAttribute('aria-label', isExpanded ? msg('srq_toggle_collapse', 'Show less') : msg('srq_toggle', 'Show more'));
    });
    widget.appendChild(header);

    // Batch list
    const batchList = document.createElement('div');
    batchList.className = 'srq-batches';
    batchList.setAttribute('role', 'list');

    for (const batch of visibleBatches) {
        batchList.appendChild(createBatchCard(batch));
    }

    // Wave 3 P2: Pagination controls (if needed)
    if (needsPagination) {
        const pagination = createPaginationControls(currentPage, totalPages, batches, densityMode);
        batchList.appendChild(pagination);
    }

    widget.appendChild(batchList);
    return widget;
}

/**
 * Wave 3 P2: Create pagination controls
 */
function createPaginationControls(currentPage, totalPages, allBatches, densityMode) {
    const container = document.createElement('div');
    container.className = 'srq-pagination';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'srq-btn srq-pagination-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.setAttribute('aria-label', 'Previous page');
    prevBtn.addEventListener('click', () => {
        refreshWidget(allBatches, densityMode, currentPage - 1);
    });

    const pageInfo = document.createElement('span');
    pageInfo.className = 'srq-pagination-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    pageInfo.setAttribute('aria-live', 'polite');

    const nextBtn = document.createElement('button');
    nextBtn.className = 'srq-btn srq-pagination-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.setAttribute('aria-label', 'Next page');
    nextBtn.addEventListener('click', () => {
        refreshWidget(allBatches, densityMode, currentPage + 1);
    });

    container.appendChild(prevBtn);
    container.appendChild(pageInfo);
    container.appendChild(nextBtn);

    return container;
}

/**
 * Refresh widget with new page
 */
function refreshWidget(batches, densityMode, newPage) {
    const container = document.getElementById('srq-widget-container');
    if (!container) return;

    container.innerHTML = '';
    const widget = createWidget(batches, densityMode, newPage);
    if (widget) {
        widget.classList.add('expanded');  // Keep expanded state
        container.appendChild(widget);
    }
}
```

**Estimated LOC:** +60 lines

### 6.3 Pagination CSS

**File:** `styles/srq.css.js` (add after batch styles, line ~227)

```css
/* ===========================
   Pagination (Wave 3 P2)
   =========================== */

.srq-pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 0 4px;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin-top: 8px;
}

.srq-pagination-btn {
    min-width: 32px;
    padding: 4px 8px;
    font-size: 12px;
}

.srq-pagination-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.srq-pagination-info {
    font-size: 10px;
    color: var(--text-secondary, #a3a3a3);
    min-width: 80px;
    text-align: center;
}

/* Compact mode pagination */
.srq-widget.srq-density-compact .srq-pagination {
    padding: 8px 0 3px;
    margin-top: 6px;
}
```

**Estimated LOC:** +35 lines

---

## 7) Feature 5: Sticky Modal Header

### 7.1 CSS Implementation

**File:** `styles/srq.css.js` (update `.srq-modal-header`, line ~266)

```css
.srq-modal-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    /* Wave 3 P2: Sticky header */
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-primary, #1a1a1a);
    /* Add shadow when scrolled (optional, via JS) */
}

.srq-modal-header.scrolled {
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}
```

### 7.2 Scroll Detection (Optional Enhancement)

**File:** `ui/components/srq_widget.js` (in `openReviewModal`)

```javascript
// Wave 3 P2: Add scroll shadow to sticky header
const modalBody = modal.querySelector('.srq-modal-body');
const modalHeader = modal.querySelector('.srq-modal-header');

if (modalBody && modalHeader) {
    modalBody.addEventListener('scroll', () => {
        if (modalBody.scrollTop > 10) {
            modalHeader.classList.add('scrolled');
        } else {
            modalHeader.classList.remove('scrolled');
        }
    });
}
```

**Estimated LOC:** +15 lines

---

## 8) File-by-File Implementation Plan

### Files to Modify: 6

| File | Changes | LOC Added/Modified |
|------|---------|-------------------|
| `styles/srq.css.js` | Density CSS + theme vars + pagination CSS + sticky header | +120 |
| `ui/components/srq_widget.js` | Density mode param + pagination logic + sticky header detection | +80 |
| `sidepanel.js` | Load density setting + apply class | +20 |
| `options.html` | Add density mode selector UI | +15 |
| `options.js` | Load/save density setting | +25 |
| `_locales/en/messages.json` | Fix 5 keys | 5 edits |
| `_locales/vi/messages.json` | Fix 3 keys | 3 edits |

### Files to Create: 1 (Optional)

| File | Purpose | LOC |
|------|---------|-----|
| `storage/srq_settings.js` | Settings API (optional, can inline in sidepanel.js) | +45 |

**Total estimated LOC:** ~305 new lines + 38 edits

---

## 9) Data Model Changes

### Storage Schema

**New key:** `srqDensityMode: "comfortable" | "compact"`

**Storage location:** `chrome.storage.sync` (syncs across devices)

**Default value:** `"comfortable"` (backward compatible with existing users)

**Migration:** None needed (default value handles missing key)

---

## 10) Message/Event Contracts

### No Breaking Changes

**Existing events unchanged:**
- `SRQ_CARDS_UPDATED` (from Wave 2 P1)
- All Wave 1-2 request/response contracts preserved

### Optional New Event (Internal Use)

**Event:** `SRQ_SETTINGS_CHANGED`

**Payload:**
```javascript
{
    type: "SRQ_SETTINGS_CHANGED",
    settings: { srqDensityMode: "compact" }
}
```

**Usage:** Broadcast from options page → sidepanel can listen and refresh widget

**Not required:** Widget refresh on settings change is optional (user can reload sidepanel)

---

## 11) Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | User can toggle density mode in options page | Options → select compact → reload sidepanel → widget uses compact spacing |
| 2 | Compact mode reduces vertical space by ~25% | Measure batch card height: comfortable ~85px, compact ~65px |
| 3 | Copy EN/VI is consistent ("highlights" not "clips") | Visual check all messages in EN |
| 4 | Error messages have actionable guidance | Trigger error → see "Try again" instruction |
| 5 | Pagination appears when > 10 batches | Create 15 batches → widget shows "Page 1 of 2" |
| 6 | Pagination prev/next work correctly | Click next → see batches 11-15, page 2 of 2 |
| 7 | Sticky header stays visible when scrolling modal | Open modal with 10 cards → scroll down → header stays at top |
| 8 | Theme variables work (no hardcoded colors) | Check CSS → all colors use `var(--...)` |
| 9 | Settings persist after extension reload | Set compact → reload extension → still compact |
| 10 | No regression in Wave 1-2 functionality | Test export/dismiss/keyboard nav → all work |

---

## 12) Test Plan

### Unit Tests

- [ ] `createWidget()` applies density class when `densityMode === 'compact'`
- [ ] Pagination logic: 15 batches → page 1 shows items 1-10, page 2 shows 11-15
- [ ] Settings API: `getSRQSettings()` returns defaults if key missing

### Manual Tests

#### Density Mode
- [ ] Options page: Select compact → save → reload sidepanel
- [ ] Widget: Batch cards have reduced spacing in compact mode
- [ ] Modal: Review cards have reduced padding in compact mode
- [ ] Visual: Text still readable in compact mode (no overflow)

#### Microcopy
- [ ] Check all EN messages: "highlights" not "clips"
- [ ] Check error messages: include "Try again" or action
- [ ] VI subtitle: No overflow in compact mode

#### Pagination
- [ ] Create 5 batches → no pagination (< 10)
- [ ] Create 15 batches → pagination appears
- [ ] Click "next" → see page 2/2
- [ ] Click "prev" → back to page 1/2
- [ ] Disabled states: page 1 → prev disabled, page 2 → next disabled

#### Sticky Header
- [ ] Open modal with 10 review cards
- [ ] Scroll modal body → header stays at top
- [ ] (If shadow implemented) Header shows shadow when scrolled

#### Theme
- [ ] Inspect CSS → mode pills use `var(--srq-mode-*)`
- [ ] Inspect CSS → export button uses `var(--srq-accent-primary)`

### E2E Tests

- [ ] Set density → export batch → dismiss batch → density persists
- [ ] Pagination → export from page 2 → pagination updates correctly
- [ ] Settings sync: Set compact on device A → open device B → compact applied

---

## 13) Rollout + Rollback

### Rollout

**Phase 1:** Local testing (1 day)
- Load extension with all changes
- Test all 10 acceptance criteria
- Fix any visual/layout bugs

**Phase 2:** Internal dogfood (optional, 2-3 days)
- Ship to internal testers
- Gather feedback on compact mode readability
- Gather feedback on pagination UX

**Phase 3:** Full rollout
- Ship to all users
- Default to comfortable (no disruption)
- Announce compact mode in release notes

### Rollback

**Scenario 1:** Compact mode has readability issues
- Remove compact option from options.html (hide UI)
- All users stay on comfortable mode
- Fix compact CSS, re-enable later

**Scenario 2:** Pagination confuses users
- Increase `PAGE_SIZE` from 10 to 20 (less frequent pagination)
- Or disable pagination (comment out needsPagination check)

**Scenario 3:** Settings don't persist
- Check `chrome.storage.sync` permissions in manifest
- Fallback to `chrome.storage.local`

---

## 14) Ước Lượng Effort

### Development Breakdown

| Task | Estimated Time |
|------|----------------|
| **Density Mode** ||
| - Add CSS compact classes | 1.5h |
| - Settings persistence API | 1h |
| - UI integration (widget + modal) | 2h |
| - Options page UI | 0.5h |
| **Theme Compatibility** ||
| - Add theme variables | 0.5h |
| - Replace 30+ hardcoded colors | 1.5h |
| **Microcopy** ||
| - Update 9 i18n keys | 0.25h |
| - Test all messages | 0.5h |
| **Pagination** ||
| - Pagination logic | 2h |
| - Pagination UI + CSS | 1h |
| - Testing with 50+ batches | 0.5h |
| **Sticky Header** ||
| - CSS sticky + shadow | 0.5h |
| - Scroll detection | 0.5h |
| **Testing** ||
| - Unit tests | 2h |
| - Manual QA (all features) | 3h |
| **Documentation** ||
| - Update README/CHANGELOG | 0.5h |
| **Total** | **~17.5 hours (~2.5 days)** |

### Dependencies

- ✅ Wave 1 P0 complete (idempotency, state machine)
- ✅ Wave 2 P1 complete (keyboard nav, in-flight guards)
- ❌ No external dependencies

---

## 15) Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Density adoption** | > 20% users try compact | `chrome.storage.sync.get('srqDensityMode')` analytics |
| **Pagination usage** | 0 reports of "too many items" | User feedback |
| **Copy clarity** | 0 confusion reports on error messages | User feedback |
| **Theme compatibility** | 0 visual bugs in dark mode | Manual testing |
| **Performance (50 batches)** | Widget loads in < 500ms | Performance.now() timing |
| **No regressions** | 0 bugs in Wave 1-2 features | E2E testing |

---

## 16) Known Limitations

### 1. Pagination State Not Persisted

**Limitation:** Pagination resets to page 1 on widget refresh.

**Rationale:** Batch list changes frequently (export/dismiss), so page persistence may confuse users.

**Mitigation:** Acceptable. User can navigate back to desired page.

### 2. Settings Require Sidepanel Reload

**Limitation:** Changing density in options page doesn't update live widget.

**Rationale:** Implementing live update requires broadcast listener + complex re-render logic.

**Mitigation:** Add note in options UI: "Reload sidebar to apply changes."

**Future:** Could add `SRQ_SETTINGS_CHANGED` listener for live update (low priority).

### 3. Compact Mode May Be Too Dense for Some Users

**Limitation:** -25% spacing might feel cramped on small screens or for vision-impaired users.

**Rationale:** Trade-off between "more content" vs "more space."

**Mitigation:** Keep comfortable as default. Users opt-in to compact.

**Future:** Could add accessibility setting or auto-detect screen size.

---

## 17) Future Enhancements (Out of Scope for Wave 3)

### Not Included (Defer to Phase 4)

1. **Light theme support**
   - Requires: Define light mode color palette
   - Effort: ~4 hours
   - Priority: Low (no user request yet)

2. **Virtual scrolling** for 100+ batches
   - Requires: Library or custom implementation
   - Effort: ~8 hours
   - Priority: Low (pagination sufficient)

3. **Density auto-detection** based on screen size
   - Requires: Viewport detection + breakpoints
   - Effort: ~2 hours
   - Priority: Low (user preference preferred)

4. **Custom density** (slider for spacing values)
   - Requires: UI slider + dynamic CSS injection
   - Effort: ~6 hours
   - Priority: Low (2 modes sufficient)

5. **Batch grouping/filtering**
   - Requires: Complex grouping logic + UI
   - Effort: ~12 hours
   - Priority: Medium (defer to user feedback)

---

## 18) Comparison with Wave 1 P0 and Wave 2 P1

| Aspect | Wave 1 P0 | Wave 2 P1 | Wave 3 P2 |
|--------|-----------|-----------|-----------|
| **Focus** | Core stability | Runtime consistency | UX polish |
| **Problem solved** | Duplicate cards | Race conditions | Scalability + aesthetics |
| **User-facing impact** | Invisible (backend fix) | Mostly invisible (guards) | Visible (density, pagination) |
| **LOC added** | ~282 | ~272 | ~305 |
| **Files modified** | 8 | 6 | 6-7 |
| **Breaking changes** | No | No | No |
| **Test complexity** | Medium | Medium-High | Medium |
| **Risk** | Low | Low | Low |
| **Effort** | ~18h (~2.5d) | ~25.5h (~3.2d) | ~17.5h (~2.5d) |

**Wave 3 P2 is similar in scope to Wave 1 P0 but more user-facing.**

---

## 19) Appendix: Complete Code Examples

### A. Density Mode Full Example

See Section 3 for complete CSS and JS code.

### B. Pagination Full Example

See Section 6 for complete implementation.

### C. Theme Variables Full List

See Section 4.2 for complete variable definitions.

---

*Spec version: 2.0*
*Author: Claude (after comprehensive audits)*
*Status: ✅ Ready for implementation*
*Est. Total Effort: ~17.5 hours (2.5 days dev + QA)*

---

## 20) Quick Start Guide for Implementation

### Step 1: Theme Variables (30 min)
1. Add CSS vars to root theme (Section 4.2)
2. Replace hardcoded colors in srq.css.js (Section 4.3)

### Step 2: Density Mode (4 hours)
1. Add compact CSS classes to srq.css.js (Section 3.1)
2. Update createWidget to accept densityMode param (Section 3.3)
3. Load density setting in sidepanel.js (Section 3.3)
4. Add options page UI + handlers (Section 3.4)

### Step 3: Microcopy (1 hour)
1. Update 5 EN keys in messages.json (Section 5.2)
2. Update 3 VI keys in messages.json (Section 5.2)
3. Visual check all changes

### Step 4: Pagination (3 hours)
1. Add pagination logic to createWidget (Section 6.2)
2. Add pagination CSS to srq.css.js (Section 6.3)
3. Test with 15+ batches

### Step 5: Sticky Header (1 hour)
1. Add sticky CSS to .srq-modal-header (Section 7.1)
2. (Optional) Add scroll shadow detection (Section 7.2)

### Step 6: Testing (3 hours)
1. Run all manual tests (Section 12)
2. Verify all 10 acceptance criteria (Section 11)
3. Fix bugs

### Step 7: Ship (30 min)
1. Update version.json
2. Update CHANGELOG.md
3. Load extension and final verification

**Total:** ~13 hours core + 4.5 hours testing/polish = **~17.5 hours**
