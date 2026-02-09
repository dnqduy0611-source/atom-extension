# Hub-Spoke Architecture - Implementation Phases

**Version:** 2.0
**Updated:** 2026-02-09
**Mục tiêu:** Non-tech friendly, buttons-first, confirm+undo, offline-capable, module split

---

## Tổng quan Phase

```
Phase 0          Phase 1          Phase 2          Phase 3          Phase 4
Foundation  →   Core Router  →   Side Panel   →   Diary + Notes  →  Polish &
+ Toast/Undo    + Focus Cmds     Unification      + SRQ Link        Release
+ Intent Parser + Quick Chips    + Module Split

[1 tuần]        [1.5 tuần]       [1.5 tuần]       [1 tuần]        [1 tuần]
                                                                  Total: ~6 tuần
```

---

## Phase 0: Foundation

**Thời gian:** 1 tuần
**Mục tiêu:** Chuẩn bị nền tảng, không ảnh hưởng user hiện tại

### Checklist
- [ ] **0.1** Tạo `services/command_router.js` - CommandRouter class, isolated
- [ ] **0.2** Tạo `services/intent_parser.js` - Client-side regex intent parser (Tier 1)
- [ ] **0.3** Tạo `services/action_executor.js` - Confirm + undo + execute pipeline
- [ ] **0.4** Tạo `ui/controllers/toast_manager.js` - Toast + undo toast + confirm toast
- [ ] **0.5** Thêm feature flag `ENABLE_AI_COMMANDS` (mặc định OFF)
- [ ] **0.6** Chuẩn bị i18n strings với **non-tech vocabulary** (xem Vocabulary Standard)
- [ ] **0.7** Viết unit tests cho CommandRouter, IntentParser, ActionExecutor

### Acceptance Criteria
- CommandRouter + IntentParser hoạt động trong isolation
- Toast manager render 4 loại: success, undo, confirm, error
- Không có thay đổi UI/UX cho user
- Feature flag bật/tắt dễ dàng
- Tất cả i18n strings dùng non-tech vocabulary

---

## Phase 1: Core AI Command Router + Focus Commands

**Thời gian:** 1.5 tuần
**Mục tiêu:** AI và client-side intent hiểu Focus commands, Quick Action Chips

### Checklist
- [ ] **1.1** Tích hợp CommandRouter vào `sidepanel.js`
- [ ] **1.2** Tích hợp IntentParser (Tier 1 - client-side, instant)
- [ ] **1.3** Thêm AI System Prompt với command capabilities (Tier 2)
- [ ] **1.4** Implement Focus commands: `FOCUS_START`, `FOCUS_STOP`, `FOCUS_PAUSE`
- [ ] **1.5** Thêm Quick Action Chips (context-aware: focus state, current tab)
- [ ] **1.6** Implement confirmation dialog cho Focus Stop (destructive)
- [ ] **1.7** Test với câu lệnh tự nhiên (VI/EN) + Quick Action tap

### UX Guidelines
- **Buttons first** - Quick Action Chips là primary path, text command là secondary
- **Subtle feedback** - Toast notification nhỏ, fade out 3-5s
- **Confirmation** - AI/IntentParser hỏi xác nhận cho destructive actions
- **Friendly errors** - "Mình chưa hiểu ý bạn" thay vì "Lệnh không hỗ trợ"

### Test Cases
```
CLIENT-SIDE (instant, offline):
"Bật pomodoro 25 phút" → ✅ Confirm toast → Focus starts
"Dừng timer" → ✅ Confirm "Dừng phiên tập trung?" → Focus stops
"Mở ghi chú" → ✅ Switch to Notes tab

Quick Action Chip tap:
[🎯 Tập trung 25p] → ✅ Confirm → Focus starts (< 500ms)

AI-PATH (when no client match):
"Focus" (mơ hồ) → AI hỏi "Bạn muốn tập trung bao lâu?"
"Tôi muốn tập trung 40 phút" → AI → FOCUS_START(40)
```

---

## Phase 2: Side Panel Unification

**Thời gian:** 1.5 tuần
**Mục tiêu:** Side Panel = hub, module split, tabs, Focus Widget

### Checklist
- [ ] **2.1** **Module split sidepanel.js** (TRƯỚC khi thêm features mới)
  - Tách TabController → `ui/controllers/tab_controller.js`
  - Tách FocusWidget → `ui/controllers/focus_widget.js`
  - Tách QuickActions → `ui/controllers/quick_actions.js`
  - sidepanel.js chỉ giữ orchestration (~2000 lines max)
- [ ] **2.2** Thêm Tab Navigation vào Side Panel
  ```
  💬 Chat  |  📝 Ghi chú  |  🃏 Thẻ ôn  |  📋 Đã lưu
  ```
- [ ] **2.3** Di chuyển Memory view vào tab "Ghi chú" (lazy load)
- [ ] **2.4** Di chuyển SRQ view vào tab "Đã lưu" (lazy load)
- [ ] **2.5** Thêm Focus Widget compact ở bottom bar
- [ ] **2.6** Implement smooth tab transitions (animation 200ms)
- [ ] **2.7** Responsive design (280px - 500px+)

### UX Guidelines
- **Max 4 tabs** - không overwhelm user
- **Smooth transitions** - Fade/slide animations < 300ms
- **Persistent state** - Nhớ tab cuối user đang dùng
- **Focus Widget** - 3 states: idle (presets), compact (timer), expanded (full controls)
- **Non-tech tab names** - "Ghi chú" KHÔNG PHẢI "Memory", "Đã lưu" KHÔNG PHẢI "SRQ"

### Design Specs
```
┌─────────────────────────────────────┐
│  💬 Chat │ 📝 Ghi chú│🃏 Thẻ ôn│📋 Đã lưu│  ← Tab bar
├─────────────────────────────────────┤
│  [🎯 Tập trung 25p] [📝 Ghi nhanh]│  ← Quick Action Chips
├─────────────────────────────────────┤
│                                     │
│         [Tab Content Area]          │  ← Dynamic, lazy loaded
│                                     │
├─────────────────────────────────────┤
│ 🎯 Đang tập trung  23:45  ⏸️ ⏹️     │  ← Focus Widget (compact)
└─────────────────────────────────────┘
```

---

## Phase 3: Diary + Notes + SRQ Integration

**Thời gian:** 1 tuần
**Mục tiêu:** AI commands cho Diary, Notes, SRQ. AI-powered mood detection.

### Checklist
- [ ] **3.1** Implement `DIARY_ADD` command với **AI-powered mood detection**
  - AI detect mood từ context + phủ định ("không vui" = sad)
  - KHÔNG dùng client regex cho mood (quá nhiều false positive)
- [ ] **3.2** Implement `DIARY_SUMMARY` command (AI summarization)
- [ ] **3.3** Implement `SAVE_TO_NOTES` command (auto-categorize via AI)
- [ ] **3.4** Thêm "Ghi nhanh" (Quick Diary) widget trong Chat tab
- [ ] **3.5** Implement SRQ commands: `OPEN_SAVED`, `EXPORT_SAVED`
- [ ] **3.6** Cross-linking Notes ↔ Diary (AI-powered semantic matching)
- [ ] **3.7** Undo support cho DIARY_ADD, SAVE_TO_NOTES, CREATE_CARD

### UX Guidelines
- **Mood detection by AI** - Tự động, chính xác hơn regex, hiểu phủ định
- **Quick Diary** - 1-tap expand, mood emoji picker, auto-tag
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

## Phase 4: Polish & Release

**Thời gian:** 1 tuần
**Mục tiêu:** Hoàn thiện, testing, optimize, rollout

### Checklist
- [ ] **4.1** Đơn giản hóa Popup (chỉ status badge + "Mở bảng điều khiển")
- [ ] **4.2** End-to-end testing toàn bộ commands (Focus, Diary, Notes, SRQ, Nav)
- [ ] **4.3** Performance optimization (lazy load, debounce search, virtual scroll)
- [ ] **4.4** Onboarding tooltip cho first-time users
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

1. **No jargon** - "Ghi chú" thay vì "Memory", "Nhật ký" thay vì "Journal"
2. **Buttons first** - Quick Action Chips = primary path, typing = secondary
3. **Forgiving** - AI đoán ý, hỏi xác nhận nếu không chắc
4. **Invisible complexity** - Command parsing "behind the scenes", user chỉ thấy kết quả
5. **Confirm + Undo** - Destructive actions cần confirm, tạo data có undo
6. **Friendly errors** - "Mình chưa hiểu ý bạn" + gợi ý, không "Error code"
7. **Progressive disclosure** - Features xuất hiện khi cần, chips thay đổi theo context

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
