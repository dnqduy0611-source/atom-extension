# Phase 2: Side Panel Unification - Detailed Spec

**Version:** 2.0
**Duration:** 1.5 tuần
**Prerequisites:** Phase 1 (Core Router) completed

---

## Mục tiêu Phase 2

Biến Side Panel thành **hub trung tâm** với:
1. **Module split** sidepanel.js TRƯỚC khi thêm features (code health)
2. **Tab navigation**: Chat | Ghi chú | Thẻ ôn | Đã lưu
3. **Focus Widget** compact ở bottom bar
4. **SRQ tab** ("Đã lưu") integrated
5. Smooth animations, responsive, accessible

---

## Task Breakdown

### 2.1 Module Split sidepanel.js (CRITICAL - DO FIRST)
**Effort:** 2 ngày

Side Panel hiện ~6950 lines. **Phải tách trước khi thêm bất kỳ feature nào.**

#### Strategy: Extract, Don't Rewrite

Không rewrite sidepanel.js. Chỉ **extract** các block code thành modules, giữ nguyên logic.

#### Extraction Plan

```
sidepanel.js (~6950 lines)
    │
    ├─► KEEP in sidepanel.js (~2500 lines):
    │   • DOM init + event listeners
    │   • AI chat flow (send/receive/render)
    │   • Existing feature orchestration
    │   • Import + wire new modules
    │
    ├─► EXTRACT to ui/controllers/tab_controller.js (NEW ~200 lines):
    │   • Tab switching logic
    │   • Lazy loading
    │   • State persistence
    │
    ├─► EXTRACT to ui/controllers/focus_widget.js (NEW ~300 lines):
    │   • Focus timer widget (idle/compact/expanded)
    │   • Real-time tick updates
    │   • Start/stop/pause controls
    │
    └─► EXTRACT to ui/controllers/quick_actions.js (from Phase 1, ~150 lines):
        • Context-aware chip rendering
        • Chip tap handling
```

#### Module interface pattern

```javascript
// Each extracted module follows this pattern:

// ui/controllers/tab_controller.js
class TabController {
    constructor(options) { /* ... */ }
    init() { /* bind events, restore state */ }
    switchTo(tabName) { /* ... */ }
    destroy() { /* cleanup */ }
}

export { TabController };

// sidepanel.js imports and wires:
import { TabController } from './ui/controllers/tab_controller.js';

const tabCtrl = new TabController({
    onTabChange: (tab) => { /* sidepanel responds */ }
});
tabCtrl.init();
```

#### Acceptance Criteria
- [ ] sidepanel.js reduced to ~2500 lines (orchestration only)
- [ ] All extracted modules work identically to before
- [ ] No regressions in any existing feature
- [ ] Each module is independently testable
- [ ] Clean imports, no circular dependencies

---

### 2.2 Tab Navigation System
**Effort:** 2 ngày

#### Design

```
┌─────────────────────────────────────┐
│ 💬 Chat │ 📝 Ghi chú│🃏 Thẻ ôn│📋 Đã lưu│
├─────────────────────────────────────┤
│         [Active tab content]         │
└─────────────────────────────────────┘

Active tab: underline indicator (2px primary color)
Inactive: muted color
Transition: 200ms fade + slight slide
```

#### HTML (`sidepanel.html`)

```html
<!-- After header, before content -->
<nav class="sp-tab-bar" role="tablist">
    <button class="sp-tab active" data-tab="chat" role="tab" aria-selected="true">
        <span class="sp-tab-icon">💬</span>
        <span class="sp-tab-label" data-i18n="tabChat">Chat</span>
    </button>
    <button class="sp-tab" data-tab="notes" role="tab" aria-selected="false">
        <span class="sp-tab-icon">📝</span>
        <span class="sp-tab-label" data-i18n="tabNotes">Ghi chú</span>
    </button>
    <button class="sp-tab" data-tab="cards" role="tab" aria-selected="false">
        <span class="sp-tab-icon">🃏</span>
        <span class="sp-tab-label" data-i18n="tabCards">Thẻ ôn</span>
    </button>
    <button class="sp-tab" data-tab="saved" role="tab" aria-selected="false">
        <span class="sp-tab-icon">📋</span>
        <span class="sp-tab-label" data-i18n="tabSaved">Đã lưu</span>
    </button>
</nav>

<div class="sp-tab-panels">
    <div class="sp-tab-panel active" data-panel="chat" role="tabpanel">
        <!-- Existing chat content stays here -->
    </div>
    <div class="sp-tab-panel" data-panel="notes" role="tabpanel">
        <!-- Lazy loaded -->
    </div>
    <div class="sp-tab-panel" data-panel="cards" role="tabpanel">
        <!-- Lazy loaded -->
    </div>
    <div class="sp-tab-panel" data-panel="saved" role="tabpanel">
        <!-- Lazy loaded - SRQ widget -->
    </div>
</div>
```

#### JavaScript: `ui/controllers/tab_controller.js`

```javascript
class TabController {
    constructor({ onTabChange }) {
        this.tabs = document.querySelectorAll('.sp-tab');
        this.panels = document.querySelectorAll('.sp-tab-panel');
        this.activeTab = 'chat';
        this.loadedTabs = new Set(['chat']);
        this.onTabChange = onTabChange;
    }

    init() {
        this.restoreActiveTab();
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTo(tab.dataset.tab));
        });
        // Keyboard navigation
        this.tabs.forEach(tab => {
            tab.addEventListener('keydown', (e) => this.handleKeyboard(e));
        });
    }

    async switchTo(tabName) {
        if (tabName === this.activeTab) return;

        // Update ARIA + classes
        this.tabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });

        this.panels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === tabName);
        });

        // Lazy load
        if (!this.loadedTabs.has(tabName)) {
            await this.loadTab(tabName);
            this.loadedTabs.add(tabName);
        }

        const prev = this.activeTab;
        this.activeTab = tabName;
        this.saveActiveTab();
        this.onTabChange?.(tabName, prev);
    }

    async loadTab(tabName) {
        const panel = document.querySelector(`[data-panel="${tabName}"]`);
        panel.innerHTML = '<div class="sp-loading"></div>';

        switch (tabName) {
            case 'notes': await this.loadNotesTab(panel); break;
            case 'cards': await this.loadCardsTab(panel); break;
            case 'saved': await this.loadSavedTab(panel); break;
        }
    }

    async loadNotesTab(panel) {
        const data = await chrome.storage.local.get(['atom_memory']);
        const items = (data.atom_memory || []).slice(-20).reverse();

        if (items.length === 0) {
            panel.innerHTML = `
                <div class="sp-empty">
                    <span class="sp-empty__icon">📝</span>
                    <p class="sp-empty__text" data-i18n="notesEmpty">Chưa có ghi chú nào</p>
                </div>`;
            return;
        }

        const grouped = this.groupByDate(items);
        panel.innerHTML = `
            <div class="sp-notes">
                <input type="text" class="sp-notes__search"
                       placeholder="${chrome.i18n.getMessage('searchNotes') || 'Tìm trong ghi chú...'}"
                       id="notes-search">
                <div class="sp-notes__list" id="notes-list">
                    ${this.renderNoteGroups(grouped)}
                </div>
            </div>`;

        // Debounced search
        let timeout;
        document.getElementById('notes-search')?.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => this.filterNotes(e.target.value, items), 200);
        });
    }

    async loadCardsTab(panel) {
        // Placeholder until flashcard system is ready
        panel.innerHTML = `
            <div class="sp-empty">
                <span class="sp-empty__icon">🃏</span>
                <p class="sp-empty__text" data-i18n="cardsEmpty">Chưa có thẻ ôn tập</p>
                <p class="sp-empty__hint">Thẻ ôn tập sẽ được tạo khi bạn học</p>
            </div>`;
    }

    async loadSavedTab(panel) {
        // Load SRQ widget content
        // Import existing SRQ widget or render saved highlights
        try {
            const { renderSRQPanel } = await import('../components/srq_widget.js');
            renderSRQPanel(panel);
        } catch {
            panel.innerHTML = `
                <div class="sp-empty">
                    <span class="sp-empty__icon">📋</span>
                    <p class="sp-empty__text" data-i18n="savedEmpty">Chưa có ghi chú đã lưu</p>
                </div>`;
        }
    }

    groupByDate(items) {
        const groups = {};
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        items.forEach(item => {
            const date = new Date(item.ts).toDateString();
            let label = new Date(item.ts).toLocaleDateString();
            if (date === today) label = chrome.i18n.getMessage('dateToday') || 'Hôm nay';
            else if (date === yesterday) label = chrome.i18n.getMessage('dateYesterday') || 'Hôm qua';
            if (!groups[label]) groups[label] = [];
            groups[label].push(item);
        });
        return groups;
    }

    renderNoteGroups(grouped) {
        return Object.entries(grouped).map(([date, items]) => `
            <div class="sp-notes__group">
                <div class="sp-notes__date">${date}</div>
                ${items.map(item => `
                    <div class="sp-notes__card" data-id="${item.id || ''}">
                        <div class="sp-notes__text">${this.truncate(item.text, 120)}</div>
                        <div class="sp-notes__meta">
                            ${new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            ${item.url ? ` · ${new URL(item.url).hostname}` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    filterNotes(query, allItems) {
        const list = document.getElementById('notes-list');
        if (!list) return;
        const q = query.toLowerCase();
        const filtered = q ? allItems.filter(i => i.text?.toLowerCase().includes(q)) : allItems;
        const grouped = this.groupByDate(filtered);
        list.innerHTML = filtered.length
            ? this.renderNoteGroups(grouped)
            : `<div class="sp-empty"><p>Không tìm thấy kết quả</p></div>`;
    }

    truncate(text, max) {
        if (!text || text.length <= max) return text || '';
        return text.slice(0, max) + '…';
    }

    handleKeyboard(e) {
        const tabArr = Array.from(this.tabs);
        const idx = tabArr.indexOf(e.target);
        let newIdx;

        if (e.key === 'ArrowRight') newIdx = (idx + 1) % tabArr.length;
        else if (e.key === 'ArrowLeft') newIdx = (idx - 1 + tabArr.length) % tabArr.length;
        else return;

        e.preventDefault();
        tabArr[newIdx].focus();
        this.switchTo(tabArr[newIdx].dataset.tab);
    }

    saveActiveTab() {
        chrome.storage.local.set({ sp_active_tab: this.activeTab });
    }

    async restoreActiveTab() {
        const data = await chrome.storage.local.get(['sp_active_tab']);
        if (data.sp_active_tab && data.sp_active_tab !== 'chat') {
            this.switchTo(data.sp_active_tab);
        }
    }
}

export { TabController };
```

#### CSS

```css
/* Tab Bar */
.sp-tab-bar {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    padding: 0 4px;
    position: sticky;
    top: 0;
    z-index: 100;
}

.sp-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 6px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    position: relative;
    transition: color 0.2s;
}

.sp-tab:hover { color: var(--foreground); }
.sp-tab.active { color: var(--primary); }

.sp-tab::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    background: var(--primary);
    border-radius: 2px 2px 0 0;
    transform: scaleX(0);
    transition: transform 0.2s ease;
}
.sp-tab.active::after { transform: scaleX(1); }

.sp-tab-icon { font-size: 14px; }
.sp-tab-label { font-size: 11px; }

/* Tab Panels */
.sp-tab-panels {
    flex: 1;
    overflow: hidden;
    position: relative;
}

.sp-tab-panel {
    display: none;
    overflow-y: auto;
    height: 100%;
}
.sp-tab-panel.active {
    display: block;
    animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Responsive */
@media (max-width: 300px) {
    .sp-tab-label { display: none; }
    .sp-tab-icon { font-size: 16px; }
}

/* Empty state */
.sp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--muted);
}
.sp-empty__icon { font-size: 32px; margin-bottom: 12px; }
.sp-empty__text { font-size: 14px; font-weight: 500; }
.sp-empty__hint { font-size: 12px; margin-top: 4px; }

/* Notes tab */
.sp-notes { padding: 12px; }
.sp-notes__search {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--foreground);
    font-size: 13px;
    margin-bottom: 12px;
}
.sp-notes__search:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}
.sp-notes__date {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    margin: 12px 0 6px 4px;
}
.sp-notes__card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.2s;
}
.sp-notes__card:hover {
    border-color: var(--primary);
    transform: translateY(-1px);
}
.sp-notes__text { font-size: 13px; line-height: 1.5; margin-bottom: 4px; }
.sp-notes__meta { font-size: 11px; color: var(--muted); }

/* Loading */
.sp-loading {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 40px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

#### Acceptance Criteria
- [ ] 4 tabs render correctly
- [ ] Active tab indicator (underline)
- [ ] Smooth transition on switch (< 200ms)
- [ ] Remember last active tab across sessions
- [ ] Lazy load Notes, Cards, Saved tabs
- [ ] Notes tab: grouped by date, search works
- [ ] Saved tab: loads SRQ widget
- [ ] Cards tab: empty state (placeholder)
- [ ] Keyboard navigation (arrow keys)
- [ ] ARIA attributes correct
- [ ] Responsive: icon-only on narrow panels

---

### 2.3 Focus Widget
**Effort:** 2 ngày

#### 3 States

```
IDLE (no session):
┌─────────────────────────────────────┐
│ 🎯 Tập trung  [25p] [40p] [50p]    │
└─────────────────────────────────────┘

COMPACT (active session):
┌─────────────────────────────────────┐
│ 🎯 Đang tập trung  23:45  ⏸️ ⏹️     │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░                   │
└─────────────────────────────────────┘

BREAK:
┌─────────────────────────────────────┐
│ ☕ Nghỉ giải lao  4:30              │
│ ▓▓▓▓░░░░░░░░░░░                    │
└─────────────────────────────────────┘
```

#### File: `ui/controllers/focus_widget.js`

```javascript
class FocusWidget {
    constructor(actionExecutor) {
        this.container = document.getElementById('focus-widget');
        this.executor = actionExecutor;
        this.state = null;
        this.tickInterval = null;
    }

    async init() {
        await this.refreshState();
        this.render();
        this.listenStateUpdates();
        this.startTick();
    }

    async refreshState() {
        try {
            const res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
            this.state = res?.atom_focus_state || null;
        } catch { this.state = null; }
    }

    listenStateUpdates() {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'FOCUS_STATE_UPDATED') {
                this.state = msg.payload;
                this.render();
            }
        });
    }

    startTick() {
        this.tickInterval = setInterval(() => {
            if (this.state?.active) this.render();
        }, 1000);
    }

    render() {
        if (!this.container) return;

        if (!this.state?.active) {
            this.renderIdle();
        } else if (this.state.phase === 'break') {
            this.renderBreak();
        } else {
            this.renderCompact();
        }
    }

    renderIdle() {
        const label = chrome.i18n.getMessage('focusIdle') || 'Tập trung';
        this.container.innerHTML = `
            <div class="fw-idle">
                <span class="fw-icon">🎯</span>
                <span class="fw-label">${label}</span>
                <div class="fw-presets">
                    <button class="fw-preset" data-min="25">25p</button>
                    <button class="fw-preset" data-min="40">40p</button>
                    <button class="fw-preset" data-min="50">50p</button>
                </div>
            </div>`;

        this.container.querySelectorAll('.fw-preset').forEach(btn => {
            btn.addEventListener('click', () => this.startFocus(+btn.dataset.min));
        });
    }

    renderCompact() {
        const time = this.formatTime(this.state.remaining);
        const progress = this.state.progress || 0;
        const label = chrome.i18n.getMessage('focusWorking') || 'Đang tập trung';
        const pauseLabel = chrome.i18n.getMessage('btnPause') || 'Tạm dừng';
        const stopLabel = chrome.i18n.getMessage('btnStop') || 'Dừng';

        this.container.innerHTML = `
            <div class="fw-active">
                <div class="fw-row">
                    <span class="fw-icon">🎯</span>
                    <span class="fw-phase">${label}</span>
                    <span class="fw-time">${time}</span>
                    <button class="fw-btn" id="fw-pause" title="${pauseLabel}">⏸️</button>
                    <button class="fw-btn" id="fw-stop" title="${stopLabel}">⏹️</button>
                </div>
                <div class="fw-progress"><div class="fw-bar" style="width:${progress}%"></div></div>
            </div>`;

        this.bindControls();
    }

    renderBreak() {
        const time = this.formatTime(this.state.remaining);
        const progress = this.state.progress || 0;
        const label = chrome.i18n.getMessage('focusBreak') || 'Nghỉ giải lao';

        this.container.innerHTML = `
            <div class="fw-break">
                <div class="fw-row">
                    <span class="fw-icon">☕</span>
                    <span class="fw-phase">${label}</span>
                    <span class="fw-time">${time}</span>
                </div>
                <div class="fw-progress"><div class="fw-bar fw-bar--break" style="width:${progress}%"></div></div>
            </div>`;
    }

    bindControls() {
        document.getElementById('fw-pause')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.executor.handleIntent({ command: 'FOCUS_PAUSE', params: {}, confirm: false, undoable: false });
        });
        document.getElementById('fw-stop')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.executor.handleIntent({ command: 'FOCUS_STOP', params: {}, confirm: true, undoable: false });
        });
    }

    async startFocus(minutes) {
        await this.executor.handleIntent({
            command: 'FOCUS_START',
            params: { minutes },
            confirm: true,
            undoable: true
        });
    }

    formatTime(seconds) {
        if (!seconds || seconds < 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    destroy() {
        if (this.tickInterval) clearInterval(this.tickInterval);
    }
}

export { FocusWidget };
```

#### Acceptance Criteria
- [ ] Idle state: 3 preset buttons (25p, 40p, 50p)
- [ ] Active state: phase label + timer + progress bar + controls
- [ ] Break state: different icon (☕), different color
- [ ] Timer updates every second
- [ ] Start → confirmation → focus begins
- [ ] Stop → confirmation → focus ends
- [ ] Pause → immediate (no confirmation)
- [ ] Syncs with popup focus state
- [ ] Non-tech labels (i18n): "Đang tập trung", "Nghỉ giải lao"

---

### 2.4 Smooth Transitions & Animations
**Effort:** 0.5 ngày

All animations < 300ms. Support `prefers-reduced-motion`.

```css
/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
    .sp-tab-panel.active { animation: none; }
    .sp-toast { transition: opacity 0.1s; }
    .fw-bar { transition: none; }
}
```

---

### 2.5 Responsive Design
**Effort:** 0.5 ngày

```css
/* Narrow (280px - default Chrome side panel) */
@media (max-width: 300px) {
    .sp-tab-label { display: none; }
    .fw-presets { flex-wrap: wrap; }
    .sp-quick-actions { gap: 4px; }
}

/* Normal (300-400px) */
@media (min-width: 300px) and (max-width: 400px) {
    .sp-tab-label { font-size: 10px; }
}

/* Wide (400px+) */
@media (min-width: 400px) {
    .sp-notes__card { display: flex; gap: 12px; }
}
```

#### Acceptance Criteria
- [ ] Works at 280px minimum
- [ ] Scales to 500px+
- [ ] Touch targets >= 44px
- [ ] Text never cut off

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `sidepanel.js` | MODIFY | Module split (reduce to ~2500 lines) |
| `sidepanel.html` | MODIFY | Tab structure, focus widget container |
| `ui/controllers/tab_controller.js` | NEW | Tab navigation + lazy load |
| `ui/controllers/focus_widget.js` | NEW | Focus timer widget |
| `styles/sidepanel_tabs.css.js` | NEW | Tab + widget + notes styles |
| `_locales/*/messages.json` | MODIFY | Tab labels, empty states |

---

## Definition of Done

- [ ] sidepanel.js split into modules (< 2500 lines orchestration)
- [ ] 4 tabs work: Chat, Ghi chú, Thẻ ôn, Đã lưu
- [ ] Notes tab loads + searches
- [ ] Saved tab loads SRQ content
- [ ] Focus Widget: idle/active/break states
- [ ] All animations < 300ms
- [ ] Responsive 280px - 500px
- [ ] Keyboard navigation + ARIA
- [ ] No regressions in chat flow
- [ ] **No jargon on any UI element**

---

## Timeline

```
Day 1-2:   2.1 - Module split sidepanel.js
Day 3-4:   2.2 - Tab navigation + Notes/Saved tab
Day 5-6:   2.3 - Focus Widget
Day 7:     2.4 + 2.5 - Animations + Responsive
Day 8-10:  Testing + Bug fixes + Review
```
