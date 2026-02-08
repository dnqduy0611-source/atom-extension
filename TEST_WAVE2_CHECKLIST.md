# Wave 2 Settings Simplification - Test Checklist

## 🎯 Quick Test Guide

### Prerequisites
1. Open Chrome DevTools (F12) → Console tab
2. Load unpacked extension from this directory
3. Have a test Google AI Studio key ready (or use fake key for UI testing)

---

## ✅ Test Case 1: First-Time User Onboarding

**Goal:** Verify onboarding checklist shows for new users

### Steps:
1. **Clear extension data:**
   ```javascript
   // Run in Console on any page:
   chrome.storage.local.remove(['atom_options_setup_completed', 'user_gemini_key', 'atom_openrouter_key'])
   ```

2. **Open Options page:**
   - Click extension icon → Right-click → Options
   - OR navigate to `chrome-extension://[your-id]/options.html`

3. **Verify onboarding checklist visible:**
   - [ ] Checklist card appears at top of "Getting Started" tab
   - [ ] Title: "Quick Setup (4 steps)"
   - [ ] Step 1 has ☑ (auto-completed)
   - [ ] Steps 2, 3, 4 have ☐ (not completed)
   - [ ] Dismiss button (×) visible in top-right

4. **Test Step 3 auto-completion:**
   - Paste a fake key "AIzaSyTest123" into "AI Access Key" field
   - [ ] Step 3 icon changes to ☑ immediately (without clicking Save)
   - [ ] Step 3 text color changes to green (primary color)

5. **Test Save button:**
   - Click "Save Settings"
   - [ ] Success message appears
   - [ ] Step 3 remains ☑ after save

6. **Test Complete Setup button:**
   - Click "Complete Setup" at bottom of checklist
   - [ ] Checklist disappears
   - [ ] Success message: "Setup completed! You can now start using ATOM."

7. **Verify persistence:**
   - Close and reopen Options page
   - [ ] Checklist does NOT reappear
   - Check storage:
     ```javascript
     chrome.storage.local.get('atom_options_setup_completed', (r) => console.log(r))
     // Should return: { atom_options_setup_completed: true }
     ```

### Expected Result:
✅ All 7 checks passed → First-time user flow works correctly

---

## ✅ Test Case 2: Tab Names & Descriptions

**Goal:** Verify tab renames and descriptions are visible

### Steps:
1. **Check nav sidebar tabs:**
   - [ ] Tab 1: "Getting Started" (not "General")
   - [ ] Tab 2: "AI Features" (not "AI Pilot")
   - [ ] Tab 3: "Integrations" (not "Connections")
   - [ ] Tab 4: "Developer Tools" (not "Advanced")

2. **Check tab descriptions:**
   - Click "Getting Started" tab
   - [ ] Description visible below title: "Set up your AI provider and basic preferences"

   - Click "AI Features" tab
   - [ ] Description: "Enable AI-powered reading assistance"

   - Click "Integrations" tab
   - [ ] Description: "Connect with NotebookLM and other tools"

   - Click "Developer Tools" tab
   - [ ] Description: "Debugging and diagnostic tools"

### Expected Result:
✅ All tabs renamed + descriptions visible

---

## ✅ Test Case 3: User Persona Collapsible

**Goal:** Verify User Persona field is now in Advanced section

### Steps:
1. Go to "Getting Started" tab
2. Scroll down to Language dropdown
3. **Below Language, find "Advanced Settings" section:**
   - [ ] "Advanced Settings" collapsible section visible
   - [ ] Badge text: "(For advanced users)"
   - [ ] Section is COLLAPSED by default

4. **Expand Advanced Settings:**
   - Click the "Advanced Settings" line
   - [ ] Section expands smoothly
   - [ ] "User Role" field visible inside
   - [ ] Placeholder: "e.g. Doctor, Student, Engineer..."
   - [ ] Hint text: "AI will adjust explanations to match your expertise."

5. **Collapse it back:**
   - Click "Advanced Settings" line again
   - [ ] Section collapses, hiding User Role field

### Expected Result:
✅ User Persona now hidden in collapsible section

---

## ✅ Test Case 4: Dismiss Onboarding Flow

**Goal:** Verify dismiss button works without marking complete

### Steps:
1. **Reset to first-time state:**
   ```javascript
   chrome.storage.local.remove('atom_options_setup_completed')
   ```

2. Reload Options page
   - [ ] Onboarding checklist reappears

3. **Click Dismiss button (×):**
   - [ ] Checklist disappears immediately

4. **Reload page again:**
   - [ ] Checklist reappears (because not marked complete)

5. Check storage:
   ```javascript
   chrome.storage.local.get('atom_options_setup_completed', (r) => console.log(r))
   // Should return: {} or { atom_options_setup_completed: undefined }
   ```

### Expected Result:
✅ Dismiss hides checklist temporarily, Complete Setup hides permanently

---

## ✅ Test Case 5: Language Switch (i18n)

**Goal:** Verify all new keys translate to Vietnamese

### Steps:
1. Go to "Getting Started" tab
2. Change Language dropdown to "Tiếng Việt"
3. **Check translations:**
   - [ ] Tab names change to VI:
     - "Bắt đầu", "Tính năng AI", "Tích hợp", "Công cụ Dev"

   - [ ] Tab descriptions translate

   - [ ] Onboarding checklist (if visible):
     - Title: "Thiết lập nhanh (4 bước)"
     - Step 1: "Chọn nhà cung cấp AI"
     - Step 2: "Nhận khóa API miễn phí..."
     - Step 3: "Dán khóa của bạn và nhấp Lưu"
     - Step 4: "Bắt đầu tô sáng văn bản..."
     - Button: "Hoàn tất thiết lập"

   - [ ] Advanced Settings: "Cài đặt nâng cao"
   - [ ] Badge: "(Dành cho người dùng nâng cao)"

4. Switch back to English
   - [ ] All text reverts to English

### Expected Result:
✅ All new UI elements translate properly

---

## ✅ Test Case 6: Regression - Existing Features Still Work

**Goal:** Ensure Wave 2 changes didn't break existing functionality

### Steps:
1. **Provider switching:**
   - Change provider from "Google Gemini" to "OpenRouter"
   - [ ] Google key section hides
   - [ ] OpenRouter key section shows

2. **Sensitivity selection:**
   - Click all 3 sensitivity cards (Gentle, Balanced, Strict)
   - [ ] Selected card highlights with green border

3. **AI Features tab:**
   - Go to "AI Features" tab
   - Expand "Advanced Settings" (already exists)
   - [ ] All AI advanced fields visible (Min Confidence, Timeout, etc.)

4. **Integrations tab:**
   - Go to "Integrations" tab
   - Toggle "NotebookLM Bridge" on/off
   - [ ] Toggle works
   - Expand "Advanced Settings"
   - [ ] NLM advanced fields visible

5. **Save functionality:**
   - Change any setting (e.g., Language to VI)
   - Click "Save Settings"
   - [ ] Success message appears
   - Reload page
   - [ ] Language still set to VI (settings persisted)

### Expected Result:
✅ All existing features work as before

---

## 🐛 Common Issues & Solutions

### Issue 1: Checklist doesn't appear
**Solution:** Check console for errors. Make sure `atom_options_setup_completed` is not set:
```javascript
chrome.storage.local.remove('atom_options_setup_completed')
```

### Issue 2: Step 3 doesn't auto-complete
**Solution:** Check if `updateOnboardingStep()` is being called. Add debug log:
```javascript
// In options.js line ~820
console.log('[Onboarding] Step 3 completed:', hasKey);
```

### Issue 3: Translations missing
**Solution:** Check if i18n keys exist:
```javascript
console.log(chrome.i18n.getMessage('opt_tab_general'))
// Should return: "Getting Started"
console.log(chrome.i18n.getMessage('opt_onboarding_title'))
// Should return: "Quick Setup (4 steps)"
```

### Issue 4: CSS broken (checklist not styled)
**Solution:** Hard refresh (Ctrl+Shift+R) to clear cached CSS

---

## ✨ Success Criteria

**Wave 2 implementation is successful if:**
- ✅ All 6 test cases pass
- ✅ No console errors
- ✅ Onboarding checklist guides new users
- ✅ Tab names are non-tech friendly
- ✅ User Persona hidden in Advanced
- ✅ Translations work (EN/VI)
- ✅ No regressions in existing features

---

## 📝 Report Issues

If any test fails, please note:
1. Which test case failed
2. Browser console errors (screenshot)
3. Steps to reproduce
4. Expected vs actual behavior

---

**Ready to test? Start with Test Case 1!** 🚀
