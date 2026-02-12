# Hub-Spoke Architecture - Implementation Phases

**Version:** 2.1
**Updated:** 2026-02-10
**Mục tiêu:** Non-tech friendly, buttons-first, confirm+undo, offline-capable, module split

---

## Tổng quan Phase

```
Phase 0          Phase 1          Phase 2          Phase 3          Phase 4
Foundation  →   Core Router  →   Side Panel   →   Diary + Notes  →  Polish &
+ Toast/Undo    + Focus Cmds     Unification      + SRQ Link        Release
+ Intent Parser + "/" Cmd Menu   + Tabs + Bar

[✅ DONE]       [✅ DONE]        [⚠️ PARTIAL]     [⚠️ PARTIAL]    [❌ TODO]
                                                                  Total: ~6 tuần
```

---

## Phase 0: Foundation ✅ DONE

**Thời gian:** 1 tuần → ✅ Hoàn thành
**Mục tiêu:** Chuẩn bị nền tảng, không ảnh hưởng user hiện tại

### Checklist
- [x] **0.1** Tạo `services/command_router.js` - CommandRouter class, isolated (152 lines)
- [x] **0.2** Tạo `services/intent_parser.js` - Client-side regex intent parser (156 lines)
- [x] **0.3** Tạo `services/action_executor.js` - Confirm + undo + execute pipeline (146 lines)
- [x] **0.4** Tạo `ui/controllers/toast_manager.js` - Toast + undo toast + confirm toast (364 lines)
- [x] **0.5** Thêm feature flag `ENABLE_AI_COMMANDS` (mặc định OFF) trong `config/feature_flags.js`
- [x] **0.6** Chuẩn bị i18n strings với **non-tech vocabulary** (`cmd_*` keys in en/vi)
- [ ] **0.7** ~~Viết unit tests cho CommandRouter, IntentParser, ActionExecutor~~ — chưa viết

### Acceptance Criteria
- ✅ CommandRouter + IntentParser hoạt động trong isolation
- ✅ Toast manager render 4 loại: success, undo, confirm, error
- ✅ Không có thay đổi UI/UX cho user
- ✅ Feature flag bật/tắt dễ dàng
- ✅ Tất cả i18n strings dùng non-tech vocabulary

---

## Phase 1: Core AI Command Router + Focus Commands ✅ DONE

**Thời gian:** 1.5 tuần → ✅ Hoàn thành
**Mục tiêu:** AI và client-side intent hiểu Focus commands, "/" Command Menu

### Checklist
- [x] **1.1** Tích hợp CommandRouter vào `sidepanel.js` (`initCommandSystem()` function)
- [x] **1.2** Tích hợp IntentParser (Tier 1 - client-side, instant) (`tryHandleIntentLocally()`)
- [x] **1.3** Thêm AI System Prompt với command capabilities (`COMMAND_SYSTEM_PROMPT`)
- [x] **1.4** Implement Focus commands: `FOCUS_START`, `FOCUS_STOP`, `FOCUS_PAUSE`
- [x] **1.5** Thêm "/" Command Menu (thay thế Quick Action Chips — gọn hơn, phân nhóm rõ)
  > **Design Change:** Thay vì inline chips, dùng dropdown menu "/" với 4 nhóm:
  > Focus (25/40/50min), AI (Summarize/Explain/Critique/Connect/Save),
  > Tools (Journal/Notes/Saved/Export), Settings.
  > File: `ui/controllers/command_menu.js` + HTML ở `sidepanel.html` lines 4032-4096
- [x] **1.6** Implement confirmation dialog cho Focus Stop (destructive)
- [ ] **1.7** ~~Test với câu lệnh tự nhiên (VI/EN)~~ — chưa test formal

### UX Guidelines
- **"/" Menu first** - "/" Command Menu là primary path, text command là secondary
- **Subtle feedback** - Toast notification nhỏ, fade out 3-5s
- **Confirmation** - AI/IntentParser hỏi xác nhận cho destructive actions
- **Friendly errors** - "Mình chưa hiểu ý bạn" thay vì "Lệnh không hỗ trợ"

### Test Cases
```
CLIENT-SIDE (instant, offline):
"Bật pomodoro 25 phút" → ✅ Confirm toast → Focus starts
"Dừng timer" → ✅ Confirm "Dừng phiên tập trung?" → Focus stops
"Mở ghi chú" → ✅ Switch to Notes tab

"/" Command Menu tap:
/ → Focus 25 min → ✅ Confirm → Focus starts (< 500ms)

AI-PATH (when no client match):
"Focus" (mơ hồ) → AI hỏi "Bạn muốn tập trung bao lâu?"
"Tôi muốn tập trung 40 phút" → AI → FOCUS_START(40)
```

---

## Phase 2: Side Panel Unification ⚠️ PARTIAL

**Thời gian:** 1.5 tuần → ⚠️ Đang tiến hành
**Mục tiêu:** Side Panel = hub, module split, tabs, Focus Bar

### Checklist
- [/] **2.1** **Module split sidepanel.js**
  - [x] Tách TabController → `ui/controllers/tab_controller.js` (150 lines)
  - [x] ~~Tách FocusWidget~~ → Thay bằng `ui/controllers/focus_bar.js` (133 lines)
  - [x] ~~Tách QuickActions~~ → Thay bằng `ui/controllers/command_menu.js` (120 lines)
  - [ ] sidepanel.js giảm xuống ≤3000 lines (hiện 8010 lines)
- [x] **2.2** Thêm Main Tab Navigation (đã implement)
  ```
  💬 Chat  |  📝 Notes  |  🃏 Review  |  📋 Saved
  ```
  > HTML: `sidepanel.html` lines 3873-3878, class `sp-main-tab-btn`, attribute `data-main-tab`
- [ ] **2.3** ~~Di chuyển Memory view vào tab "Notes"~~ — Notes tab exists nhưng chưa tích hợp full Memory
- [x] **2.4** SRQ view accessible via Main Tab "Saved" + "/" Menu
- [x] **2.5** Focus Bar inline (thay thế Focus Widget compact)
  > **Design Change:** Thay vì FocusWidget 3-state (idle/active/break), dùng FocusBar inline:
  > - Chỉ hiện khi focus session đang active
  > - Auto-hide khi idle (gọn hơn, không chiếm không gian)
  > - HTML: `sidepanel.html` lines 3977-3986, class `sp-focus-bar`
- [ ] **2.6** ~~Implement smooth tab transitions~~ — transitions chưa có animation
- [ ] **2.7** ~~Responsive design (280px - 500px+)~~ — chưa implement
- [x] **2.8** (Bonus) Bottom Tabs: Chats | Notes | Related (collapsible panel)
  > HTML: `sidepanel.html` lines 4116-4197, class `sp-bottom-tabs`

### UX Guidelines
- **Max 4 main tabs** - không overwhelm user ✅
- **Smooth transitions** - Fade/slide animations < 300ms (TODO)
- **Persistent state** - Nhớ tab cuối user đang dùng (TODO)
- **Focus Bar** - Inline, auto-show khi active, auto-hide khi idle ✅
- **Non-tech tab names** - "Notes" thay vì "Memory", "Saved" thay vì "SRQ" ✅

### Design Specs (Actual Implementation)
```
┌─────────────────────────────────────┐
│ 💬 Chat │ 📝 Notes │🃏 Review│📋 Saved│  ← Main Tab Bar
├─────────────────────────────────────┤
│                                     │
│         [Tab Content Area]          │  ← Dynamic
│                                     │
├─────────────────────────────────────┤
│ 🎯 Focus  23:45 ████░░ ⏸️ ⏹️       │  ← Focus Bar (only when active)
├─────────────────────────────────────┤
│ [/]  [Ask a question...]     [Send] │  ← Input + "/" Command Menu
├─────────────────────────────────────┤
│ 💬 Chats │ 📝 Notes │ 🔗 Related │▼ │ ← Bottom Tabs (collapsible)
│  [collapsed content panel]          │
└─────────────────────────────────────┘
```

---

## Phase 3: Diary + Notes + SRQ Integration ⚠️ PARTIAL

**Thời gian:** 1 tuần → ⚠️ Handlers done, UI widgets chưa wire
**Mục tiêu:** AI commands cho Diary, Notes, SRQ. AI-powered mood detection.

### Checklist
- [x] **3.1** Implement `DIARY_ADD` command với **AI-powered mood detection**
  - AI detect mood từ context + phủ định ("không vui" = sad)
  - KHÔNG dùng client regex cho mood (quá nhiều false positive)
- [x] **3.2** Implement `DIARY_SUMMARY` command (local summary)
- [x] **3.3** Implement `SAVE_TO_NOTES` command (auto-source from highlight/selection)
- [x] **3.4** "/" Menu tích hợp Journal, Notes, Saved, Export (thay thế Quick Diary widget riêng)
- [x] **3.5** Implement SRQ commands: `OPEN_SAVED`, `EXPORT_SAVED`
- [ ] **3.6** Cross-linking Notes ↔ Diary (AI-powered semantic matching) — chưa implement
- [x] **3.7** Undo support cho DIARY_ADD, SAVE_TO_NOTES

### UX Guidelines
- **Mood detection by AI** - Tự động, chính xác hơn regex, hiểu phủ định
- **"/" Menu** - 1-tap access đến Journal, Notes, Saved từ menu
- **Gentle prompts** - "Muốn ghi lại suy nghĩ này không?"
- **Undo everything** - Toast + "Hoàn tác" cho mọi action tạo data

### Flow Example
```
User: "Hôm nay học React xong, cảm thấy tự tin hơn"
AI: "Tuyệt vời! Bạn muốn ghi vào nhật ký không?"
User: "Có"
AI: "✅ Đã ghi vào Nhật ký 🤩"
    [Toast: "Đã ghi vào Nhật ký 🤩  [Hoàn tác]" - 5s]
```

---

## Phase 4: Polish & Release ❌ NOT STARTED

**Thời gian:** 1 tuần
**Mục tiêu:** Hoàn thiện, testing, optimize, rollout

### Checklist
- [ ] **4.1** Đơn giản hóa Popup (chỉ status badge + "Mở bảng điều khiển")
- [ ] **4.2** End-to-end testing toàn bộ commands (Focus, Diary, Notes, SRQ, Nav)
- [ ] **4.3** Performance optimization (lazy load, debounce search, virtual scroll)
- [/] **4.4** Onboarding tooltip cho first-time users (partial: `showCommandOnboardingIfNeeded()`)
- [ ] **4.5** A/B testing engagement metrics
- [ ] **4.6** Bật feature flag: 5% → 25% → 50% → 100%

### Performance Targets
| Metric | Target |
|--------|--------|
| Tab switch | < 100ms |
| Client-side intent parse | < 10ms |
| AI command parse | < 50ms |
| AI response + action | < 2s |
| Notes/Saved tab load | < 500ms |
| Toast animation | 60fps |

### Rollout Strategy
```
Week 1: 5% users (beta testers) - monitor errors, collect feedback
Week 2: 25% users - A/B test engagement
Week 3: 50% users - scale testing
Week 4: 100% users - full release
```

---

## Dependencies & Order

```
Phase 0 (Foundation)
    │
    ├──► Phase 1 (Core Router + Focus)
    │        │
    │        ├──► Phase 2 (UI Unification)
    │        │        │
    │        │        └──► Phase 4 (Polish & Release)
    │        │                ▲
    │        └──► Phase 3 (Diary + Notes + SRQ)
    │                        │
    │                ────────┘
    │
    Note: Phase 2 & Phase 3 can partially overlap
          (module split in P2 enables P3 development)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| AI misunderstands command | Client-side intent for Tier 1, confirm before execute |
| AI returns malformed JSON | Strict validation + graceful error toast |
| Non-tech users confused | Quick Action Chips (buttons > text), friendly language |
| Performance issues | Module split, lazy load, virtual scroll, debounce |
| Breaking existing flow | Feature flag OFF by default, gradual rollout |
| Offline/API down | Tier 1 works offline, Tier 2 queue + friendly message |
| User triggers wrong action | Confirmation for destructive, undo toast (5s) for all |
| Side Panel code bloat | Module split BEFORE adding tabs (Phase 2 step 1) |

---

## Non-Tech Friendly Principles (Bắt buộc)

1. **No jargon** - "Notes" thay vì "Memory", "Journal" thay vì "Diary"
2. **"/" Menu first** - "/" Command Menu = primary path, typing = secondary
3. **Forgiving** - AI đoán ý, hỏi xác nhận nếu không chắc
4. **Invisible complexity** - Command parsing "behind the scenes", user chỉ thấy kết quả
5. **Confirm + Undo** - Destructive actions cần confirm, tạo data có undo
6. **Friendly errors** - "Mình chưa hiểu ý bạn" + gợi ý, không "Error code"
7. **Progressive disclosure** - Features xuất hiện khi cần, menu items phân nhóm rõ

---

## Definition of Done (mỗi Phase)

- [ ] Tất cả checklist items hoàn thành
- [ ] Unit tests pass
- [ ] Manual QA pass
- [ ] Vocabulary audit: KHÔNG CÓ jargon trên UI
- [ ] No regressions trong existing features
- [ ] Performance targets met
- [ ] Undo works cho mọi data-creating action
- [ ] Feature flag can disable toàn bộ
