# Phase 4: Polish & Release - Detailed Spec

**Version:** 2.0
**Duration:** 1 tuần
**Prerequisites:** Phase 3 (Diary + Notes + SRQ) completed

---

## Mục tiêu Phase 4

Hoàn thiện và release AI Command Routing:
1. **Popup simplification** (chỉ status + launcher)
2. **End-to-end testing** toàn bộ commands
3. **Performance optimization**
4. **Onboarding tooltip** cho first-time users
5. **Gradual rollout** 5% → 100%

---

## Task Breakdown

### 4.1 Popup Simplification
**Effort:** 1 ngày

#### Current → New

```
CURRENT (Complex):               NEW (Minimal):
┌────────────────────┐          ┌────────────────────┐
│  AmoNexus          │          │  🟢 AmoNexus       │
│  ──────────────    │          │  ──────────────    │
│  Focus Timer:      │          │  🎯 Đang tập trung  │
│  [25m] [40m] [50m] │    →     │     23:45           │
│  [  Start  ]       │          │  ──────────────    │
│  ──────────────    │          │  [Mở bảng điều khiển]│
│  Stats, Charts...  │          │  ──────────────    │
│  ──────────────    │          │  ⚙️   🌐   💬       │
│  [Open Panel]      │          └────────────────────┘
└────────────────────┘
```

#### New popup.html

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="ui_shared.css">
    <style>
        body { width: 220px; margin: 0; padding: 0; }
        .pm { padding: 16px; background: var(--background); color: var(--foreground); }
        .pm-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .pm-logo { width: 24px; height: 24px; }
        .pm-title { flex: 1; font-weight: 700; font-size: 14px; }

        .pm-focus {
            display: flex; align-items: center; gap: 8px; padding: 12px;
            background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3);
            border-radius: 10px; margin-bottom: 12px;
        }
        .pm-focus-phase { font-size: 12px; font-weight: 600; color: var(--primary); }
        .pm-focus-time { margin-left: auto; font-size: 16px; font-weight: 600; font-family: monospace; }

        .pm-no-focus { text-align: center; padding: 12px; color: var(--muted); font-size: 12px; margin-bottom: 12px; }

        .pm-cta {
            width: 100%; padding: 12px; border: none; border-radius: 10px;
            background: var(--primary); color: #000; font-weight: 600;
            font-size: 13px; cursor: pointer; margin-bottom: 12px; transition: all 0.2s;
        }
        .pm-cta:hover { filter: brightness(1.1); transform: translateY(-1px); }

        .pm-actions { display: flex; justify-content: center; gap: 8px; }
        .pm-action {
            width: 36px; height: 36px; border-radius: 8px;
            border: 1px solid var(--border); background: var(--surface);
            font-size: 16px; cursor: pointer; transition: all 0.2s;
        }
        .pm-action:hover { border-color: var(--primary); transform: scale(1.05); }
    </style>
</head>
<body>
    <div class="pm">
        <div class="pm-header">
            <img src="icons/icon48.png" class="pm-logo" alt="AmoNexus">
            <span class="pm-title">AmoNexus</span>
            <span id="status-dot">🟢</span>
        </div>

        <div class="pm-focus" id="focus-badge" style="display:none;">
            <span>🎯</span>
            <span class="pm-focus-phase" id="focus-phase"></span>
            <span class="pm-focus-time" id="focus-time"></span>
        </div>

        <div class="pm-no-focus" id="no-focus">
            <span data-i18n="popupNoFocus">Chưa có phiên tập trung</span>
        </div>

        <button class="pm-cta" id="open-panel" data-i18n="openPanel">
            Mở bảng điều khiển
        </button>

        <div class="pm-actions">
            <button class="pm-action" id="btn-settings" title="Cài đặt">⚙️</button>
            <button class="pm-action" id="btn-website" title="Website">🌐</button>
            <button class="pm-action" id="btn-feedback" title="Góp ý">💬</button>
        </div>
    </div>

    <script src="popup_minimal.js" type="module"></script>
</body>
</html>
```

#### popup_minimal.js

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    // Focus state
    try {
        const res = await chrome.runtime.sendMessage({ type: 'FOCUS_GET_STATE' });
        const state = res?.atom_focus_state;

        if (state?.active) {
            document.getElementById('focus-badge').style.display = 'flex';
            document.getElementById('no-focus').style.display = 'none';

            const phaseLabels = {
                work: chrome.i18n.getMessage('focusWorking') || 'Đang tập trung',
                break: chrome.i18n.getMessage('focusBreak') || 'Nghỉ giải lao'
            };
            document.getElementById('focus-phase').textContent = phaseLabels[state.phase] || '';
            document.getElementById('focus-time').textContent = formatTime(state.remaining);
        }
    } catch { /* ignore */ }

    // Open Side Panel
    document.getElementById('open-panel').addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.sidePanel.open({ tabId: tab.id });
            window.close();
        } catch { /* fallback: just close popup */ }
    });

    // Quick actions
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    document.getElementById('btn-website')?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://www.amonexus.com/' });
    });
    document.getElementById('btn-feedback')?.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('bug_report.html') });
    });
});

function formatTime(seconds) {
    if (!seconds || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

#### Acceptance Criteria
- [ ] Popup width ~220px
- [ ] Focus status badge: phase label (non-tech) + time
- [ ] No focus: "Chưa có phiên tập trung"
- [ ] "Mở bảng điều khiển" opens Side Panel
- [ ] Quick actions work (settings, website, feedback)
- [ ] No jargon (no "WORK", no "BREAK", no "Open Panel")

---

### 4.2 End-to-End Testing
**Effort:** 1.5 ngày

#### Test Suites

##### A. Focus Commands

| # | Test | Steps | Expected |
|---|------|-------|----------|
| A1 | Focus via chip | Tap [🎯 Tập trung 25p] | Confirm → timer starts → toast |
| A2 | Focus via text | Type "Bật pomodoro 25 phút" | Client intent → confirm → start |
| A3 | Focus via AI | Type "Tôi muốn tập trung" | AI asks duration → user says 25 → start |
| A4 | Focus stop | Tap [⏹️ Dừng] | Confirm → timer stops → toast |
| A5 | Focus widget sync | Start via any method | Widget updates immediately |
| A6 | Popup sync | Start via any method | Popup shows status |

##### B. Diary Commands

| # | Test | Steps | Expected |
|---|------|-------|----------|
| B1 | Diary via AI | "Hôm nay mệt quá" | AI detects tired → confirm → save |
| B2 | Mood negation | "Hôm nay không vui" | AI detects sad (NOT happy) |
| B3 | Quick Diary widget | Expand → type → select mood → save | Entry created → toast + undo |
| B4 | Diary undo | Save → tap "Hoàn tác" | Entry removed |
| B5 | Diary summary | "Tóm tắt nhật ký tuần này" | Summary with mood + tags |

##### C. Notes Commands

| # | Test | Steps | Expected |
|---|------|-------|----------|
| C1 | Save with content | "Lưu vào ghi chú: React hooks" | Saved → toast + undo |
| C2 | Save from highlight | Highlight text → "Lưu vào ghi chú" | Highlighted text saved |
| C3 | Save undo | Save → tap "Hoàn tác" | Entry removed |
| C4 | Notes tab search | Switch to Ghi chú → search | Filtered results |

##### D. SRQ Commands

| # | Test | Steps | Expected |
|---|------|-------|----------|
| D1 | Open saved | "Mở ghi chú đã lưu" | Switches to Đã lưu tab |
| D2 | Export saved | "Xuất ghi chú" | Export triggered → toast |

##### E. Navigation Commands

| # | Test | Steps | Expected |
|---|------|-------|----------|
| E1 | Open settings | "Mở cài đặt" | Options page opens |
| E2 | Open diary | "Mở nhật ký" | Journal page opens |
| E3 | Open notes | "Mở ghi chú" | Switches to Notes tab |

##### F. Error Handling

| # | Test | Steps | Expected |
|---|------|-------|----------|
| F1 | Invalid time | "Focus -5 phút" | Hint: "Thời gian ít nhất 1 phút" |
| F2 | Too long | "Focus 999 phút" | Hint: "Tối đa 180 phút" |
| F3 | No content | "Lưu vào ghi chú" (nothing highlighted) | "Không có nội dung để lưu" |
| F4 | Unknown | "Làm cà phê" | AI responds normally, no action |
| F5 | Stop no timer | "Dừng timer" (no timer) | "Không có phiên tập trung nào" |

##### G. Offline / Feature Flag

| # | Test | Steps | Expected |
|---|------|-------|----------|
| G1 | Feature OFF | Disable flag → send command text | Normal chat, no action parsing |
| G2 | Client offline | Disconnect → "Bật focus 25" | Client intent → works (offline) |
| G3 | AI offline | Disconnect → "Ghi nhật ký" | Error: "Cần kết nối mạng..." |

---

### 4.3 Performance Optimization
**Effort:** 1 ngày

#### Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Client intent parse | < 10ms | `performance.now()` |
| AI action parse | < 50ms | `performance.now()` |
| Tab switch | < 100ms | Performance API |
| Notes tab load (20 items) | < 300ms | Performance API |
| Notes tab load (200 items) | < 500ms | Performance API + virtual scroll |
| Toast animation | 60fps | DevTools Performance |
| Quick Diary expand | < 200ms | Visual |
| Focus Widget tick | < 5ms per tick | `performance.now()` |

#### Optimization Techniques

1. **Lazy load tabs** - Only load content when first accessed (already in spec)
2. **Debounced search** - 200ms debounce on Notes search
3. **Virtual scroll** - For Notes tab with 200+ items
4. **DOM recycling** - Reuse toast elements instead of creating new
5. **RequestAnimationFrame** - For Focus Widget tick (not setInterval for DOM)
6. **Cache tab content** - Don't reload if data hasn't changed

```javascript
// Virtual scroll for large note lists
class VirtualNoteScroller {
    constructor(container, items, renderItem, itemHeight = 72) {
        this.container = container;
        this.items = items;
        this.renderItem = renderItem;
        this.itemHeight = itemHeight;

        this.container.style.height = `${items.length * itemHeight}px`;
        this.container.style.position = 'relative';
        this.container.parentElement.addEventListener('scroll', () => this.render());
        this.render();
    }

    render() {
        const scrollTop = this.container.parentElement.scrollTop;
        const viewHeight = this.container.parentElement.clientHeight;

        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 5);
        const end = Math.min(this.items.length, Math.ceil((scrollTop + viewHeight) / this.itemHeight) + 5);

        // Only render visible items
        this.container.innerHTML = '';
        for (let i = start; i < end; i++) {
            const el = this.renderItem(this.items[i]);
            el.style.position = 'absolute';
            el.style.top = `${i * this.itemHeight}px`;
            el.style.left = '0';
            el.style.right = '0';
            this.container.appendChild(el);
        }
    }
}
```

---

### 4.4 Onboarding Tooltip
**Effort:** 0.5 ngày

First time user sees command system (after feature flag enabled):

```
┌─────────────────────────────────────┐
│  🎉 Mới: Điều khiển bằng chat!     │
│                                      │
│  Giờ bạn có thể nói:                │
│  • "Tập trung 25 phút"             │
│  • "Ghi nhật ký: hôm nay vui!"     │
│  • "Lưu vào ghi chú"              │
│                                      │
│  Hoặc bấm nút nhanh ở đầu trang.   │
│                                      │
│  [Hiểu rồi!]                        │
└─────────────────────────────────────┘
```

```javascript
async function showOnboardingIfNeeded() {
    const data = await chrome.storage.local.get(['ai_commands_onboarded']);
    if (data.ai_commands_onboarded) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'sp-onboarding';
    tooltip.innerHTML = `
        <div class="sp-onboarding__title">🎉 ${chrome.i18n.getMessage('onboardingTitle') || 'Mới: Điều khiển bằng chat!'}</div>
        <div class="sp-onboarding__body">
            ${chrome.i18n.getMessage('onboardingBody') || `
            Giờ bạn có thể nói:<br>
            • "Tập trung 25 phút"<br>
            • "Ghi nhật ký: hôm nay vui!"<br>
            • "Lưu vào ghi chú"<br><br>
            Hoặc bấm nút nhanh ở đầu trang.`}
        </div>
        <button class="sp-onboarding__btn">${chrome.i18n.getMessage('onboardingDismiss') || 'Hiểu rồi!'}</button>
    `;

    tooltip.querySelector('.sp-onboarding__btn').addEventListener('click', () => {
        tooltip.classList.add('hide');
        setTimeout(() => tooltip.remove(), 300);
        chrome.storage.local.set({ ai_commands_onboarded: true });
    });

    document.body.appendChild(tooltip);
    requestAnimationFrame(() => tooltip.classList.add('show'));
}
```

---

### 4.5 Gradual Rollout
**Effort:** 0.5 ngày

```javascript
// config/feature_flags.js - Enhanced

async function shouldEnableForUser() {
    // Check if manually overridden
    const manual = await chrome.storage.local.get(['ff_ENABLE_AI_COMMANDS']);
    if (manual.ff_ENABLE_AI_COMMANDS !== undefined) {
        return manual.ff_ENABLE_AI_COMMANDS;
    }

    // Rollout percentage (update server-side or hardcode per release)
    const ROLLOUT_PERCENT = 5; // Start at 5%

    // Deterministic hash based on install ID
    const installData = await chrome.storage.local.get(['atom_install_id']);
    let installId = installData.atom_install_id;
    if (!installId) {
        installId = crypto.randomUUID();
        await chrome.storage.local.set({ atom_install_id: installId });
    }

    const hash = simpleHash(installId);
    return (hash % 100) < ROLLOUT_PERCENT;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
```

#### Rollout Schedule

```
Week 1:  5% users   → Monitor: errors, performance, engagement
Week 2:  25% users  → A/B: command usage vs non-command users
Week 3:  50% users  → Scale test
Week 4:  100% users → Full release
```

#### Metrics to Monitor

| Metric | Alert if |
|--------|----------|
| Command error rate | > 5% |
| AI action parse failure | > 10% |
| Average response time | > 3s |
| Undo rate | > 20% (= users making mistakes) |
| Feature flag disable requests | > 2% |

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| `popup.html` | REWRITE | Minimal popup |
| `popup.js` | REWRITE | Status + launcher only |
| `config/feature_flags.js` | MODIFY | Rollout logic |
| `sidepanel.js` | MODIFY | Onboarding tooltip |
| `_locales/*/messages.json` | MODIFY | Popup + onboarding strings |

---

## Definition of Done

- [ ] Popup simplified: status + "Mở bảng điều khiển" + quick actions
- [ ] All E2E tests pass (suites A-G)
- [ ] Performance targets met
- [ ] Onboarding tooltip shows for first-time users
- [ ] Rollout infrastructure ready (5% start)
- [ ] **Vocabulary audit passed: zero jargon on any UI**
- [ ] Feature flag can disable everything cleanly
- [ ] No critical bugs
- [ ] Ready for 5% rollout

---

## Timeline

```
Day 1:     4.1 - Popup simplification
Day 2-3:   4.2 - E2E testing
Day 4:     4.3 - Performance optimization
Day 5:     4.4 + 4.5 - Onboarding + rollout setup
Day 6:     Final review + vocabulary audit
Day 7:     🚀 5% rollout
```

---

## Post-Release Monitoring

After 5% rollout:
- Daily: check error rates, command success rate
- Weekly: user engagement metrics, undo rate
- Collect qualitative feedback from beta testers
- Iterate UI based on confusion points
- Scale to 25% when error rate < 3% and undo rate < 15%
