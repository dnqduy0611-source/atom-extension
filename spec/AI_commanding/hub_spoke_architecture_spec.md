# Hub-Spoke Architecture + AI Command Routing Specification

**Version:** 2.0
**Created:** 2026-02-09
**Updated:** 2026-02-09
**Status:** Draft v2

---

## 1. Overview

### 1.1 Problem Statement
AmoNexus hiện có kiến trúc rời rạc:
- **Popup** xử lý Focus Timer, hiển thị stats
- **Side Panel** xử lý AI chat, Active Reading
- **Memory/Journal** là các trang riêng biệt
- **SRQ (Saved Highlights)** chỉ accessible từ Side Panel
- User phải nhảy giữa nhiều UI khác nhau → mất tập trung, khó hiểu flow

### 1.2 Solution
**Hub-Spoke Architecture** với **Side Panel là hub trung tâm**, kết hợp:
- **AI Command Routing** cho phép điều khiển bằng ngôn ngữ tự nhiên
- **Client-side Intent Parser** cho deterministic commands (không phụ thuộc AI)
- **Quick Action Chips** cho 1-tap access, không cần gõ

### 1.3 Design Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **No jargon** | "Ghi chú" thay vì "Memory", "Thẻ ôn" thay vì "Flashcard" |
| 2 | **Buttons first, text second** | Non-tech users tin tưởng nút bấm hơn gõ text |
| 3 | **Confirm before acting** | Mọi action có confirmation, destructive action có undo |
| 4 | **Works without AI** | Focus, Journal, Navigation hoạt động offline qua client-side intent |
| 5 | **Progressive disclosure** | Features xuất hiện khi cần, không overwhelm |
| 6 | **Forgiving** | AI đoán ý user, hỏi xác nhận nếu không chắc |

### 1.4 Vocabulary Standard (Critical)

Mọi UI text PHẢI tuân theo bảng này. Đây là **quy tắc bắt buộc**, không phải suggestion.

| Technical term | Vietnamese (UI) | English (UI) | Ghi chú |
|----------------|-----------------|--------------|---------|
| Memory | Ghi chú | Notes | Cả tab name, toast, tooltip |
| Flashcard / Cards | Thẻ ôn tập | Review cards | Không dùng "flashcard" trên UI |
| Journal | Nhật ký | Diary | "Quick Journal" → "Ghi nhanh" |
| Focus Timer | Tập trung | Focus | Giữ "Focus" vì đã phổ biến |
| WORK phase | Đang tập trung | Focusing | Không dùng "WORK" |
| BREAK phase | Nghỉ giải lao | Break time | |
| Export | Lưu / Xuất | Save | Tùy context |
| SRQ / Research Queue | Ghi chú đã lưu | Saved highlights | |
| Command | (ẩn) | (hidden) | User không bao giờ thấy từ "command" |
| Error | (thân thiện) | (friendly) | "Mình chưa hiểu ý bạn" thay vì "Lệnh không hỗ trợ" |

---

## 2. Architecture Design

### 2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIDE PANEL (HUB)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    AI Chat Interface                     │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  ┌──────────────────┐  ┌──────────────────┐     │    │   │
│  │  │  │ Client Intent    │  │ AI Command       │     │    │   │
│  │  │  │ Parser (fast)    │  │ Router (fallback)│     │    │   │
│  │  │  │ "Bật focus 25p"  │  │ Ambiguous intents│     │    │   │
│  │  │  │ → instant action │  │ → AI resolves    │     │    │   │
│  │  │  └──────────────────┘  └──────────────────┘     │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Quick Action Chips (1-tap, no typing needed)        │      │
│  │  [Tập trung 25p] [Ghi nhật ký] [Ôn tập thẻ]        │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  💬 Chat │  │ 📝 Ghi  │  │ 🃏 Thẻ  │  │ 📋 Đã   │      │
│  │          │  │   chú    │  │  ôn tập  │  │   lưu    │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        🎯 Focus Widget (Collapsible, always visible)    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   ┌────▼────┐           ┌───────▼───────┐        ┌──────▼──────┐
   │ POPUP   │           │  BACKGROUND   │        │  CONTENT.JS │
   │ (Spoke) │           │   (Engine)    │        │   (Spoke)   │
   │         │           │               │        │             │
   │ • Status│           │ • Focus Logic │        │ • Signals   │
   │ • Badge │◄─────────►│ • AI Calls    │◄──────►│ • Nudges    │
   │ • Quick │           │ • Storage     │        │ • Highlight │
   │   Open  │           │ • Commands    │        │ • SRQ Cards │
   └─────────┘           └───────────────┘        └─────────────┘
```

### 2.2 Dual-Path Command Flow

```
User Input (Text / Button tap / Quick Action Chip)
        │
        ▼
┌───────────────────────────────┐
│   Client-side Intent Parser   │  ← FAST PATH (< 50ms)
│   Regex match on known cmds   │
│   "Bật focus 25" → match!     │
└─────────┬─────────────────────┘
          │
     ┌────▼────┐
     │ Match?  │
     └────┬────┘
      Yes │          No
          │           │
          ▼           ▼
┌──────────────┐  ┌───────────────────┐
│ Confirm      │  │   Send to AI      │  ← SMART PATH (~2s)
│ + Execute    │  │   (Gemini API)    │
│ locally      │  └─────────┬─────────┘
└──────┬───────┘            │
       │                    ▼
       │         ┌─────────────────────┐
       │         │  AI Response +      │
       │         │  [ACTION:...] tag   │
       │         └──────────┬──────────┘
       │                    │
       ▼                    ▼
┌──────────────────────────────────────┐
│         Action Executor              │
│  ├─ Confirm (if destructive)         │
│  ├─ Execute handler                  │
│  ├─ Show toast + undo option         │
│  └─ Update UI feedback              │
└──────────────────────────────────────┘
```

**Tại sao Dual-Path?**
- **Fast Path** cho commands đơn giản: Focus start/stop, Open tab, Navigation → không cần AI, không cần internet, instant
- **Smart Path** cho ambiguous/complex: "Tóm tắt journal tuần này", mood detection, content generation → cần AI

---

## 3. AI Command Routing System

### 3.1 Command Format

AI trả về action tag ở cuối response:
```
[Nội dung trả lời bình thường cho user]

[ACTION:COMMAND_NAME:{"param1":"value1","param2":"value2"}]
```

### 3.2 Supported Commands

#### Focus Commands
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `FOCUS_START` | `{"minutes": number}` | "Bắt đầu tập trung {n} phút" |
| `FOCUS_STOP` | `{}` | "Đã dừng phiên tập trung" + undo 5s |
| `FOCUS_PAUSE` | `{}` | "Tạm dừng" |

#### Notes Commands (Memory)
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `SAVE_TO_NOTES` | `{"content": string, "category": string}` | "Đã lưu vào Ghi chú" + undo |
| `OPEN_NOTES` | `{}` | Switch to Notes tab |

#### Diary Commands (Journal)
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `DIARY_ADD` | `{"content": string, "mood": string, "tags": string[]}` | "Đã ghi vào Nhật ký {emoji}" + undo |
| `DIARY_SUMMARY` | `{"period": "today"\|"week"\|"month"}` | Inline summary message |
| `OPEN_DIARY` | `{}` | Open diary page |

#### Review Cards Commands (Flashcard)
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `CREATE_CARD` | `{"front": string, "back": string}` | "Đã tạo thẻ ôn tập" + undo |
| `START_REVIEW` | `{"count": number}` | Switch to Review tab |

#### Saved Highlights Commands (SRQ)
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `OPEN_SAVED` | `{}` | Switch to Saved tab |
| `EXPORT_SAVED` | `{"format": "text"\|"markdown"}` | "Đã xuất {n} ghi chú" |

#### Navigation Commands
| Command | Parameters | UI Feedback |
|---------|------------|-------------|
| `OPEN_SETTINGS` | `{}` | Open options page |
| `SUMMARIZE_PAGE` | `{}` | Inline summary |

### 3.3 Client-side Intent Parser

Commands được chia 2 tier: **deterministic** (client regex) và **AI-dependent**.

```javascript
// services/intent_parser.js
// Tier 1: Client-side, instant, offline-capable

const DETERMINISTIC_INTENTS = {
    FOCUS_START: {
        patterns: [
            /(?:bật|bắt đầu|start)\s*(?:pomodoro|focus|tập trung)\s*(\d+)?\s*(?:phút|p|minutes?|m)?/i,
            /(?:focus|tập trung)\s*(\d+)\s*(?:phút|p|minutes?|m)/i,
        ],
        extractParams: (match) => ({
            minutes: parseInt(match[1]) || 25
        }),
        validate: (params) => {
            if (params.minutes < 1 || params.minutes > 180) {
                return { valid: false, hint: 'focusTimeRange' }; // "Thời gian từ 1-180 phút"
            }
            return { valid: true };
        },
        confirm: true // Always confirm before starting
    },

    FOCUS_STOP: {
        patterns: [
            /(?:dừng|tắt|stop|end|kết thúc)\s*(?:pomodoro|focus|timer|tập trung)/i,
            /(?:dừng|stop)\s*(?:lại|timer)?$/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: true, // Destructive: stopping loses progress
        undoable: false
    },

    OPEN_NOTES: {
        patterns: [
            /(?:mở|open|xem)\s*(?:ghi chú|notes?|memory)/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false // Navigation, no confirmation needed
    },

    OPEN_DIARY: {
        patterns: [
            /(?:mở|open|xem)\s*(?:nhật ký|diary|journal)/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false
    },

    OPEN_SAVED: {
        patterns: [
            /(?:mở|open|xem)\s*(?:ghi chú đã lưu|saved|highlights?)/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false
    },

    OPEN_SETTINGS: {
        patterns: [
            /(?:mở|open)\s*(?:cài đặt|settings?|tùy chỉnh)/i
        ],
        extractParams: () => ({}),
        validate: () => ({ valid: true }),
        confirm: false
    }
};

// Tier 2: Requires AI → forwarded to Gemini
const AI_DEPENDENT_INTENTS = [
    'DIARY_ADD',        // Needs mood detection, content generation
    'DIARY_SUMMARY',    // Needs AI summarization
    'SAVE_TO_NOTES',    // May need content extraction from context
    'CREATE_CARD',      // Needs AI to generate front/back
    'SUMMARIZE_PAGE'    // Needs AI summarization
];
```

### 3.4 Confirmation + Undo Pattern

```javascript
// services/action_executor.js

async function executeWithConfirmation(command, params, options = {}) {
    const { confirm = false, undoable = true } = options;

    // Step 1: Confirmation (if needed)
    if (confirm) {
        const confirmed = await showConfirmToast(
            getConfirmMessage(command, params)
        );
        if (!confirmed) return { cancelled: true };
    }

    // Step 2: Execute
    const result = await commandRouter.execute(command, params);

    // Step 3: Show result + undo option
    if (result.success && undoable) {
        showUndoToast(result.message, async () => {
            await commandRouter.undo(command, result.data);
        }, 5000); // 5s undo window
    } else if (result.success) {
        showToast(result.message, 3000);
    } else {
        showErrorToast(result.message);
    }

    return result;
}

// Undo registry
const UNDO_HANDLERS = {
    DIARY_ADD: async (data) => {
        // Remove the entry just created
        const storage = await chrome.storage.local.get(['journal_logs']);
        const logs = (storage.journal_logs || []).filter(l => l.id !== data.id);
        await chrome.storage.local.set({ journal_logs: logs });
    },
    SAVE_TO_NOTES: async (data) => {
        const storage = await chrome.storage.local.get(['atom_memory']);
        const memories = (storage.atom_memory || []).filter(m => m.id !== data.id);
        await chrome.storage.local.set({ atom_memory: memories });
    },
    CREATE_CARD: async (data) => {
        // Remove created card
    },
    FOCUS_START: async () => {
        await chrome.runtime.sendMessage({ type: 'FOCUS_STOP' });
    }
};
```

### 3.5 AI System Prompt Addition

```
## COMMAND CAPABILITIES

Bạn có thể thực hiện các hành động khi user yêu cầu:

### 1. Focus (Tập trung)
- Bật: [ACTION:FOCUS_START:{"minutes":25}]
- Dừng: [ACTION:FOCUS_STOP]

### 2. Nhật ký (Diary)
- Ghi: [ACTION:DIARY_ADD:{"content":"...","mood":"happy","tags":["learning"]}]
- Tóm tắt: [ACTION:DIARY_SUMMARY:{"period":"week"}]

  **Mood detection:** Khi user chia sẻ cảm xúc, tự detect mood:
  - happy/excited → 😊🤩  |  sad → 😢  |  anxious → 😰
  - tired → 😴  |  angry → 😤  |  focused → 🎯  |  neutral → 😐

  **Quan trọng:** Chú ý phủ định. "Không vui" = sad, "Hết stress" = happy/relieved.

### 3. Ghi chú (Notes)
- Lưu: [ACTION:SAVE_TO_NOTES:{"content":"...","category":"general"}]

### 4. Thẻ ôn tập (Review cards)
- Tạo: [ACTION:CREATE_CARD:{"front":"...","back":"..."}]

### 5. Navigation
- Mở cài đặt: [ACTION:OPEN_SETTINGS]
- Mở ghi chú: [ACTION:OPEN_NOTES]
- Mở nhật ký: [ACTION:OPEN_DIARY]
- Mở ghi chú đã lưu: [ACTION:OPEN_SAVED]

### QUY TẮC BẮT BUỘC
1. Chỉ dùng ACTION khi user YÊU CẦU RÕ RÀNG
2. Đặt ACTION tag ở CUỐI response
3. Nếu không chắc chắn, HỎI lại user
4. Phản hồi bằng ngôn ngữ user đang dùng
5. KHÔNG BAO GIỜ hiện action tag trong text - nó sẽ bị ẩn khỏi user
6. Với DIARY_ADD: LUÔN detect mood, chú ý phủ định/ngữ cảnh
7. Validate params: minutes 1-180, content không rỗng
```

---

## 4. UI/UX Changes

### 4.1 Side Panel Enhancements

#### 4.1.1 Quick Action Chips (NEW)
Hiện ở đầu Side Panel, context-aware:

```
Khi không có Focus session:
┌─────────────────────────────────────┐
│ [🎯 Tập trung 25p] [📝 Ghi nhanh] │
│ [🃏 Ôn tập]  [📋 Ghi chú đã lưu]  │
└─────────────────────────────────────┘

Khi đang Focus:
┌─────────────────────────────────────┐
│ [⏸️ Tạm dừng] [📝 Ghi nhanh]       │
│ [📋 Ghi chú đã lưu]                │
└─────────────────────────────────────┘
```

Chips thay đổi theo context: focus state, current tab, time of day.

#### 4.1.2 Tab Navigation
```html
<nav class="sp-nav" role="tablist">
    <button class="sp-nav-item active" data-tab="chat" role="tab">
        💬 <span data-i18n="tabChat">Chat</span>
    </button>
    <button class="sp-nav-item" data-tab="notes" role="tab">
        📝 <span data-i18n="tabNotes">Ghi chú</span>
    </button>
    <button class="sp-nav-item" data-tab="cards" role="tab">
        🃏 <span data-i18n="tabCards">Thẻ ôn</span>
    </button>
    <button class="sp-nav-item" data-tab="saved" role="tab">
        📋 <span data-i18n="tabSaved">Đã lưu</span>
    </button>
</nav>
```

#### 4.1.3 Focus Timer Widget
Floating widget ở bottom Side Panel:
```
Idle:
┌─────────────────────────────────────┐
│ 🎯 Tập trung  [25p] [40p] [50p]    │
└─────────────────────────────────────┘

Active (compact):
┌─────────────────────────────────────┐
│ 🎯 Đang tập trung  23:45           │
│ ▓▓▓▓▓▓▓░░░░░                       │
│ [⏸️ Tạm dừng] [⏹️ Dừng]            │
└─────────────────────────────────────┘

Break:
┌─────────────────────────────────────┐
│ ☕ Nghỉ giải lao  4:30              │
│ ▓▓▓▓░░░░░░                         │
└─────────────────────────────────────┘
```

### 4.2 Popup Simplification

```
┌──────────────────────┐
│     🟢 AmoNexus      │
│  ────────────────    │
│  🎯 Đang tập trung   │  ← Focus status
│     23:45             │
│  ────────────────    │
│  [  Mở bảng điều  ]  │  ← Primary CTA
│  [  khiển          ]  │
│  ────────────────    │
│  ⚙️   🌐   💬        │  ← Settings, Web, Feedback
└──────────────────────┘
```

### 4.3 Toast / Feedback System

```
Success with undo:
┌─────────────────────────────────────────┐
│  ✅ Đã ghi vào Nhật ký 😊    [Hoàn tác] │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ (5s)              │
└─────────────────────────────────────────┘

Success without undo:
┌─────────────────────────────────────┐
│  ✅ Bắt đầu tập trung 25 phút      │
│  ▓▓▓▓▓▓▓▓▓░░░░░ (3s)              │
└─────────────────────────────────────┘

Friendly error:
┌─────────────────────────────────────┐
│  🤔 Mình chưa hiểu ý bạn.          │
│  Thử nói "Tập trung 25 phút"?      │
└─────────────────────────────────────┘

Confirmation:
┌─────────────────────────────────────┐
│  ⏹️ Dừng phiên tập trung?           │
│  Bạn đã tập trung được 18 phút.    │
│  [Dừng] [Tiếp tục]                 │
└─────────────────────────────────────┘
```

---

## 5. Technical Implementation

### 5.1 Module Split Strategy (Critical)

Side Panel hiện ~6950 lines. Để tránh bloat, tách modules:

```
sidepanel.js (orchestrator, ~2000 lines max)
├── services/
│   ├── command_router.js       (NEW) Command parse + execute
│   ├── intent_parser.js        (NEW) Client-side regex intent
│   ├── action_executor.js      (NEW) Confirm + undo + execute
│   ├── mood_detector.js        (NEW) AI-powered mood (Phase 3)
│   └── srq_enricher.js         (existing)
├── ui/controllers/
│   ├── tab_controller.js       (NEW) Tab navigation logic
│   ├── focus_widget.js         (NEW) Focus timer widget
│   ├── quick_actions.js        (NEW) Quick action chips
│   ├── quick_diary.js          (NEW) Quick diary widget
│   └── toast_manager.js        (NEW) Toast + undo system
├── ui/components/
│   └── srq_widget.js           (existing)
└── styles/
    ├── sidepanel_tabs.css.js   (NEW)
    ├── focus_widget.css.js     (NEW)
    └── toast.css.js            (NEW)
```

### 5.2 New Files Summary

| File | Purpose |
|------|---------|
| `services/command_router.js` | Parse AI response, route to handlers |
| `services/intent_parser.js` | Client-side regex intent detection |
| `services/action_executor.js` | Confirmation + undo + execute |
| `ui/controllers/tab_controller.js` | Tab navigation + lazy load |
| `ui/controllers/focus_widget.js` | Focus timer compact widget |
| `ui/controllers/quick_actions.js` | Context-aware quick action chips |
| `ui/controllers/quick_diary.js` | Quick diary entry widget |
| `ui/controllers/toast_manager.js` | Toast notification + undo system |

### 5.3 Modified Files

| File | Changes |
|------|---------|
| `sidepanel.js` | Import modules, orchestration only |
| `sidepanel.html` | Tab structure, focus widget, quick actions |
| `popup.js` | Simplify to status + launcher |
| `popup.html` | Minimal UI |
| `background.js` | Add command system prompt, new message types |
| `_locales/*/messages.json` | Non-tech friendly strings |
| `manifest.json` | New module entries if needed |

### 5.4 Offline Fallback Strategy

```javascript
// Tier 1 commands (client-side) work offline automatically
// Tier 2 commands need graceful degradation:

async function handleOffline(command, params) {
    // Queue for later if possible
    if (['DIARY_ADD', 'SAVE_TO_NOTES'].includes(command)) {
        // Save locally, sync later
        await saveLocally(command, params);
        return {
            success: true,
            message: 'Đã lưu. Sẽ đồng bộ khi có mạng.'
        };
    }

    if (['DIARY_SUMMARY', 'SUMMARIZE_PAGE'].includes(command)) {
        return {
            success: false,
            message: 'Cần kết nối mạng để tóm tắt. Thử lại sau nhé!'
        };
    }
}
```

---

## 6. Migration Strategy

### Phase 0: Foundation (1 tuần)
- CommandRouter class (isolated, unit tested)
- IntentParser class (client-side regex)
- Feature flag `ENABLE_AI_COMMANDS` (default OFF)
- i18n strings với non-tech vocabulary
- Toast + Undo system

### Phase 1: Core Router + Focus Commands (1.5 tuần)
- Integrate CommandRouter vào sidepanel.js
- Client-side intent for Focus start/stop (instant, offline)
- AI system prompt addition
- Quick Action Chips (context-aware)
- Confirmation dialog for destructive actions

### Phase 2: Side Panel Unification (1.5 tuần)
- Module split sidepanel.js trước khi thêm tabs
- Tab Navigation: Chat | Ghi chú | Thẻ ôn | Đã lưu
- Focus Widget compact ở bottom
- Memory tab + SRQ tab integration
- Smooth animations + responsive

### Phase 3: Diary + Notes + SRQ Integration (1 tuần)
- DIARY_ADD với AI-powered mood detection (không dùng regex)
- DIARY_SUMMARY command
- SAVE_TO_NOTES command
- Quick Diary widget
- SRQ commands: OPEN_SAVED, EXPORT_SAVED
- Cross-linking Notes ↔ Diary (AI-powered, không keyword overlap)

### Phase 4: Polish & Release (1 tuần)
- Popup simplification
- End-to-end testing
- Performance optimization
- Onboarding tooltip cho first-time users
- Gradual rollout 5% → 100%

---

## 7. Success Metrics

| Metric | Target | Cách đo |
|--------|--------|---------|
| Commands via text/chip | Track count | Analytics event |
| Time to start Focus | < 2 seconds (chip) | Performance API |
| Page navigation giảm | -50% | Compare before/after |
| Side Panel session duration | +25% | Session timer |
| Command success rate | > 90% | Success/total ratio |
| Undo usage rate | < 10% | Track undo clicks |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI misinterprets commands | Medium | Client-side intent for common cmds, confirmation before execute |
| AI returns malformed action | Medium | Strict JSON validation, graceful fallback |
| Side Panel too complex | High | Module split, lazy load tabs, max 4 tabs |
| Breaking existing workflows | High | Feature flag, gradual rollout |
| Performance degradation | Medium | Lazy load, virtual scroll, debounce |
| Offline/API down | Medium | Client-side intent for Tier 1, local queue for Tier 2 |
| User accidentally triggers action | Medium | Confirmation for destructive, undo for all |
| Non-tech user confused | High | Quick Action Chips (buttons > text), friendly errors |

---

## 9. Open Questions (Resolved)

| Question | Resolution |
|----------|-----------|
| ~~Voice input (speech-to-text)?~~ | Deferred to v3. Text + chips first. |
| ~~Notes tab: full list or recent?~~ | Recent 20, with search + "load more" |
| ~~Focus widget minimizable?~~ | Yes, 3 states: idle/compact/expanded |
| Quick Action Chips: max count? | **Max 4 chips**, context-dependent |
| SRQ integration scope? | Open + Export commands, tab in Phase 2 |
| Mood detection: regex vs AI? | **AI-powered** in Tier 2, no client regex for mood |
