# Wave 4: Onboarding End-to-End - QA Test Checklist

**Status**: ⏳ Pending Testing
**Estimated Time**: 0.5-1 ngày (3-5 giờ)
**Prerequisites**: Extension loaded, có API key sẵn để test

---

## Phase 1: Manual Testing (4 giờ)

### Test 1: Happy Path - User mới onboard thành công ✅

**Preparation:**
```javascript
// Reset onboarding state để test như user mới
// Mở Chrome DevTools Console, chạy:
chrome.storage.local.remove('atom_sidepanel_onboarding')
```

**Test Steps:**

#### 1. Mở popup ⏱️ START TIMER
- [ ] Thấy onboarding card với title "Start in 1 minute" / "Bắt đầu trong 1 phút"
- [ ] Thấy 3 bước: (1) Highlight, (2) Summarize, (3) Save
- [ ] Button "Open Side Panel" / "Mở thanh bên" hiển thị

#### 2. Click "Open Side Panel"
- [ ] Sidepanel mở ra
- [ ] Thấy welcome screen overlay với emoji 👋
- [ ] Thấy 3 bước trong welcome screen
- [ ] Button "Start now" / "Bắt đầu ngay" có focus (màu viền)

#### 3. Click "Start now"
- [ ] Welcome screen đóng lại
- [ ] Thấy progress indicator "Step 1/3" / "Bước 1/3" ở đầu sidepanel
- [ ] Text hướng dẫn: "Highlight one short paragraph" / "Bôi đen 1 đoạn văn ngắn"

#### 4. Highlight text trên webpage
- [ ] Floating button xuất hiện
- [ ] Click floating button → text gửi vào sidepanel
- [ ] Progress chuyển sang "Step 2/3" / "Bước 2/3"
- [ ] Thấy tooltip nhấp nháy ở button "Summarize" / "Tóm tắt"
- [ ] Text hướng dẫn: "Press Summarize" / "Nhấn Tóm tắt"

#### 5. Click "Summarize"
- [ ] AI trả lời (loading → response hiển thị)
- [ ] Progress chuyển sang "Step 3/3" / "Bước 3/3"
- [ ] Thấy tooltip nhấp nháy ở button "Save" / "Lưu"
- [ ] Text hướng dẫn: "Press Save" / "Nhấn Lưu"

#### 6. Click "Save" ⏱️ STOP TIMER
- [ ] Thấy success toast: "You completed the basic setup" / "Bạn đã hoàn thành thiết lập cơ bản"
- [ ] Progress indicator biến mất
- [ ] Tooltips không còn hiển thị nữa

**⏱️ Duration Recorded**: _______ seconds (target: < 90s)

#### 7. Verify persistence
- [ ] Reload extension (Ctrl+R hoặc đóng/mở lại sidepanel)
- [ ] Onboarding card trong popup đã hidden
- [ ] Không thấy welcome screen hay tooltips nữa
- [ ] Sidepanel hoạt động bình thường

**Pass Criteria:**
- ✅ Tất cả checkboxes pass
- ✅ Thời gian < 90s
- ✅ Không có UI bug

**Notes/Issues:**
```
[Ghi chú bugs hoặc observations ở đây]
```

---

### Test 2: User không có API key ⚠️

**Preparation:**
```javascript
// Remove API keys
chrome.storage.local.remove(['user_gemini_key', 'atom_openrouter_key'])
chrome.storage.local.remove('atom_sidepanel_onboarding')
```

**Test Steps:**

#### 1. Mở popup
- [ ] Thấy onboarding card
- [ ] Description khác: "Open Settings to add your AI Access Key..." / "Mở Cài đặt để thêm khóa truy cập AI..."
- [ ] Button "Open Settings" / "Mở Cài đặt" hiển thị (thay vì "Open Side Panel")

#### 2. Click "Open Settings"
- [ ] Settings page mở ra (options.html)
- [ ] Thấy API key input fields

#### 3. Paste API key → Click Save
- [ ] Settings saved thành công
- [ ] Quay lại popup
- [ ] Description đã đổi thành "Open the side panel and follow 3 quick steps."
- [ ] Button "Open Side Panel" hiển thị
- [ ] Button "Open Settings" đã hidden

**Pass Criteria:**
- ✅ User không bị dead-end (luôn có CTA rõ ràng)
- ✅ UI update động khi có/không có API key

**Notes/Issues:**
```
[Ghi chú ở đây]
```

---

### Test 3: User skip onboarding 🔄

**Preparation:**
```javascript
chrome.storage.local.remove('atom_sidepanel_onboarding')
```

**Test Steps:**

#### 1. Mở sidepanel → thấy welcome screen

#### 2. Click "Skip guide" / "Bỏ qua hướng dẫn"
- [ ] Thấy confirmation dialog: "Skip onboarding now? You can open it again from the menu."
- [ ] Click OK trong dialog

#### 3. Verify skip behavior
- [ ] Welcome screen đóng
- [ ] Thấy toast: "Guide skipped. You can reopen it from the menu." / "Đã bỏ qua hướng dẫn..."
- [ ] Progress indicator không hiển thị
- [ ] Sidepanel vẫn hoạt động bình thường

#### 4. Reopen guide from menu
- [ ] Click hamburger menu (☰) trong sidepanel
- [ ] Thấy menu item "Open onboarding again" / "Mở lại hướng dẫn"
- [ ] Click menu item
- [ ] Welcome screen hiển thị lại

**Pass Criteria:**
- ✅ Skip không phá vỡ functionality
- ✅ User có thể reopen guide từ menu

**Notes/Issues:**
```
[Ghi chú ở đây]
```

---

### Test 4: Accessibility ♿

**Test Steps:**

#### 1. Keyboard navigation
- [ ] Mở welcome screen
- [ ] Press Tab nhiều lần
- [ ] Focus di chuyển qua: "Start now" → "Skip guide" → cycle lại
- [ ] Press Enter trên "Start now" → welcome screen đóng
- [ ] Press Tab trên tooltips → có thể navigate được

#### 2. ESC key
- [ ] Mở welcome screen
- [ ] Press ESC
- [ ] Welcome screen đóng (tương đương click "Start now")

#### 3. Focus management
- [ ] Click vào search box trong sidepanel (focus ở đó)
- [ ] Trigger welcome screen (reset state nếu cần)
- [ ] Welcome screen mở → focus tự động chuyển sang "Start now" button
- [ ] Click "Start now" → welcome screen đóng
- [ ] Focus quay lại search box (element trước đó)

**Pass Criteria:**
- ✅ Tất cả actions có thể thực hiện bằng keyboard
- ✅ ESC key hoạt động
- ✅ Focus được manage đúng

**Notes/Issues:**
```
[Ghi chú ở đây]
```

---

### Test 5: i18n Localization (EN/VI) 🌐

**Test Steps:**

#### 1. Test EN locale
- [ ] Set Chrome language = English (chrome://settings/languages)
- [ ] Restart Chrome/Reload extension
- [ ] Reset onboarding: `chrome.storage.local.remove('atom_sidepanel_onboarding')`
- [ ] Chạy lại Test 1 (Happy Path)
- [ ] **Verify all text tiếng Anh:**
  - [ ] Popup card title: "Start in 1 minute"
  - [ ] Steps: "Highlight one short paragraph", "Press Summarize", "Press Save"
  - [ ] Button: "Open Side Panel"
  - [ ] Welcome screen: tiếng Anh
  - [ ] Progress: "Step 1/3", "Step 2/3", "Step 3/3"
  - [ ] Completion toast: "You completed the basic setup."
- [ ] Không có fallback key name (e.g., "popup_onboarding_title")

#### 2. Test VI locale
- [ ] Set Chrome language = Tiếng Việt (chrome://settings/languages)
- [ ] Restart Chrome/Reload extension
- [ ] Reset onboarding: `chrome.storage.local.remove('atom_sidepanel_onboarding')`
- [ ] Chạy lại Test 1 (Happy Path)
- [ ] **Verify all text tiếng Việt:**
  - [ ] Popup card title: "Bắt đầu trong 1 phút"
  - [ ] Steps: "Bôi đen 1 đoạn văn ngắn", "Nhấn Tóm tắt", "Nhấn Lưu"
  - [ ] Button: "Mở thanh bên"
  - [ ] Welcome screen: tiếng Việt
  - [ ] Progress: "Bước 1/3", "Bước 2/3", "Bước 3/3"
  - [ ] Completion toast: "Bạn đã hoàn thành thiết lập cơ bản."
- [ ] Không có fallback English text

**Pass Criteria:**
- ✅ Both locales hoạt động đúng
- ✅ Không có missing translation keys
- ✅ Text không bị truncate/overflow

**Notes/Issues:**
```
[Ghi chú ở đây]
```

---

## Phase 2: Bug Fixes (0-2 giờ)

**Bugs Found:**
1. [ ] Bug #1: [Description]
   - Severity: High/Medium/Low
   - Fix: [Description]
   - Re-test: Test case #__

2. [ ] Bug #2: [Description]
   - Severity: High/Medium/Low
   - Fix: [Description]
   - Re-test: Test case #__

**Total bugs**: _____ (Expected: 0-2)

---

## Phase 3: Time-to-First-Value Measurement ⏱️

**Stopwatch Measurements** (Test 1 - Happy Path):

| Run | Duration (seconds) | Notes |
|-----|-------------------|-------|
| 1   | _____ s | |
| 2   | _____ s | |
| 3   | _____ s | |
| **Average** | **_____ s** | **Target: < 90s** |

**Result**: ✅ PASS / ❌ FAIL

---

## Phase 4: Final Report (0.5 giờ)

### Summary

**Test Date**: _______________
**Tested By**: _______________
**Overall Status**: ✅ PASS / ⚠️ PASS WITH NOTES / ❌ FAIL

### Results:

| Test Case | Status | Notes |
|-----------|--------|-------|
| Test 1: Happy Path | ☐ PASS ☐ FAIL | |
| Test 2: No API Key | ☐ PASS ☐ FAIL | |
| Test 3: Skip Guide | ☐ PASS ☐ FAIL | |
| Test 4: Accessibility | ☐ PASS ☐ FAIL | |
| Test 5: i18n (EN/VI) | ☐ PASS ☐ FAIL | |

### Time-to-First-Value:
- Average: _____ seconds
- Target: < 90 seconds
- Result: ✅ Met / ❌ Not met

### Bugs Summary:
- Total bugs found: _____
- High severity: _____
- Medium severity: _____
- Low severity: _____
- All bugs fixed: ☐ Yes ☐ No

### Recommendation:
☐ **Ship to production** - All tests pass, ready to deploy
☐ **Ship with notes** - Minor issues, acceptable for production
☐ **Do not ship** - Critical bugs found, need fixes

### Notes:
```
[Additional observations, edge cases, improvement suggestions]
```

---

## Appendix: Quick Reset Commands

```javascript
// Reset onboarding completely (new user simulation)
chrome.storage.local.remove('atom_sidepanel_onboarding')

// Remove API keys (test no-key flow)
chrome.storage.local.remove(['user_gemini_key', 'atom_openrouter_key'])

// Check current onboarding state
chrome.storage.local.get('atom_sidepanel_onboarding', (r) => console.log(r))

// Force complete onboarding (skip to end state for testing)
chrome.storage.local.set({
  atom_sidepanel_onboarding: {
    state: 'completed',
    onboarding_completed_at: Date.now(),
    updated_at: Date.now()
  }
})
```

---

## Reference Files:
- Popup onboarding: [popup.html:790-809](../../../popup.html#L790-L809)
- Popup logic: [popup.js:174-283](../../../popup.js#L174-L283)
- Sidepanel state machine: [sidepanel.js:209-323](../../../sidepanel.js#L209-L323)
- Welcome screen: [sidepanel.js:507-605](../../../sidepanel.js#L507-L605)
- i18n keys (EN): [_locales/en/messages.json](../../../_locales/en/messages.json)
- i18n keys (VI): [_locales/vi/messages.json](../../../_locales/vi/messages.json)
