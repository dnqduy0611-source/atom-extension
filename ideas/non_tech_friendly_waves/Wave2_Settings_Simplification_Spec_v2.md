# Non-Tech Friendly Wave 2 Spec v2

**Version:** 2.0
**Date:** 2026-02-08
**Changes from v1:** Resolved tab structure conflict, added detailed implementation guide, i18n mapping, test cases, and Wave 1 compatibility

---

## CRITICAL DECISION: Tab Structure Strategy

**Problem identified in v1:** Spec proposed 3 tabs but code has 4 tabs with different purposes.

**Solution for v2:** Progressive disclosure WITHIN existing tabs, not reorganizing tabs.

### New Approach:
1. **Keep 4 tabs** (`General`, `AI Pilot`, `Connections`, `Advanced`)
2. **Add "Basic vs Advanced" collapsible sections** within each tab
3. **Add first-time user guidance** to help navigate
4. **Simplify tab names** for non-tech users

---

## 1) Mục tiêu và phạm vi

Wave 2 đơn giản hóa Settings bằng cách ẩn complexity sau collapsible sections và cải thiện first-time user experience.

### Mục tiêu định lượng:
1. Giảm số quyết định user phải chọn trong lần setup đầu tiên xuống **≤8 fields** (giảm từ ~20 fields hiện tại)
2. 80% user lần đầu chỉ cần mở tab `General` và không cần mở bất kỳ Advanced section nào
3. Tất cả option nâng cao được ẩn trong `<details>` collapsible và có badge "(Nâng cao)"
4. **[MỚI]** 100% tabs có helper text giải thích mục đích tab đó
5. **[MỚI]** First-time users thấy onboarding checklist (4 bước) khi mở Settings lần đầu

### Phạm vi:
- `options.html`
- `options.js`
- i18n keys cho settings
- **[MỚI]** `options.css` (inline styles) cho onboarding UI

---

## 2) Baseline hiện tại

### Code analysis:
1. **Tab structure**: 4 tabs (`general`, `ai`, `connections`, `advanced`)
   - General: 5 fields (provider, API key, sensitivity, persona, language)
   - AI: 10+ fields (toggles, dropdowns, advanced settings already in collapsible)
   - Connections: 6+ fields (NLM settings, SRQ density)
   - Advanced: Debug + Notification tools

2. **Existing progressive disclosure**: AI and Connections tabs ALREADY have `<details class="advanced-settings">` sections (lines 1220-1298, 1376-1407 in options.html)

3. **Missing guidance**: No first-time user onboarding, no tab descriptions, no visual hierarchy for "what to focus on first"

4. **Tab names**: Technical (`AI Pilot`, `Advanced`) → cần đổi thành non-tech friendly

---

## 3) Non-goals

1. Không đổi số lượng tabs (giữ nguyên 4 tabs)
2. Không di chuyển fields giữa các tabs (chỉ ẩn/hiện progressive disclosure)
3. Không đổi storage key hiện có
4. Không đổi provider backend
5. **[MỚI]** Không force user phải hoàn thành setup wizard (optional, skippable)

---

## 4) IA đề xuất mới (v2)

### 4.1 Tab naming & descriptions

**Đổi tên tabs cho non-tech friendly:**

| Old name (code) | New EN name | New VI name | i18n key | Tab description (EN) | Tab description (VI) |
|-----------------|-------------|-------------|----------|---------------------|---------------------|
| `general` | **Getting Started** | **Bắt đầu** | `opt_tab_general` | "Set up your AI provider and basic preferences" | "Thiết lập nhà cung cấp AI và tùy chọn cơ bản" |
| `ai` | **AI Features** | **Tính năng AI** | `opt_tab_ai` | "Enable AI-powered reading assistance" | "Bật tính năng hỗ trợ đọc bằng AI" |
| `connections` | **Integrations** | **Tích hợp** | `opt_tab_connections` | "Connect with NotebookLM and other tools" | "Kết nối với NotebookLM và công cụ khác" |
| `advanced` | **Developer Tools** | **Công cụ Dev** | `opt_tab_advanced` | "Debugging and diagnostic tools" | "Công cụ gỡ lỗi và chẩn đoán" |

**New i18n keys needed:**
```json
{
  "opt_tab_general": { "message": "Getting Started" },
  "opt_tab_general_desc": { "message": "Set up your AI provider and basic preferences" },
  "opt_tab_ai": { "message": "AI Features" },
  "opt_tab_ai_desc": { "message": "Enable AI-powered reading assistance" },
  "opt_tab_connections": { "message": "Integrations" },
  "opt_tab_connections_desc": { "message": "Connect with NotebookLM and other tools" },
  "opt_tab_advanced": { "message": "Developer Tools" },
  "opt_tab_advanced_desc": { "message": "Debugging and diagnostic tools" }
}
```

### 4.2 Field prioritization: Essential vs Advanced

**General (Getting Started) tab:**

**Essential fields (always visible):**
1. AI Provider dropdown (Google Gemini / OpenRouter)
2. AI Access Key input
3. Sensitivity level (3 radio cards)
4. Language dropdown

**Advanced fields (wrap in collapsible):**
- User Persona (optional)

**Result**: 4 visible decisions → meets ≤8 target ✅

---

**AI Features tab:**

**Essential fields (always visible):**
1. Enable AI Pilot toggle
2. Meaning Analysis toggle (if API key exists)
3. Find by Meaning toggle (if API key exists)

**Advanced fields (already in collapsible in code):**
- AI Mode dropdown
- Accuracy Level dropdown
- Min Confidence, Timeout, Budget, Cache TTL, Viewport/Selected chars, Provider, Proxy URL

**Result**: 3 visible toggles → meets target ✅

---

**Integrations (Connections) tab:**

**Essential fields (always visible):**
1. NotebookLM Bridge toggle
2. Default Notebook input
3. SRQ Density dropdown

**Advanced fields (already in collapsible in code):**
- Bridge Mode, PII Warning, Allow Cloud Export, Base URL, Max Chars, Sensitive Domains, JSON Rules

**Result**: 3 visible fields → meets target ✅

---

**Developer Tools (Advanced) tab:**

**No changes needed** - This tab is already self-explanatory for tech users.

---

### 4.3 First-time user onboarding checklist

**Add dismissible onboarding card** at top of General tab on first visit:

```
┌─────────────────────────────────────────────────────┐
│ 🎯 Quick Setup (4 steps)                      [×]   │
├─────────────────────────────────────────────────────┤
│ ☑ Step 1: Choose your AI provider                  │
│ ☑ Step 2: Get your free API key (click link below) │
│ ☐ Step 3: Paste your key and click Save            │
│ ☐ Step 4: Start highlighting text on any webpage   │
│                                                      │
│ [Complete Setup]                                     │
└─────────────────────────────────────────────────────┘
```

**Logic:**
- Show if: `atom_options_setup_completed !== true` in storage
- Dismiss on: Click [×] or [Complete Setup] button
- Progress tracking: Auto-check steps as user completes them
- Storage key: `atom_options_setup_completed: boolean`

**New i18n keys:**
```json
{
  "opt_onboarding_title": { "message": "Quick Setup (4 steps)" },
  "opt_onboarding_step1": { "message": "Choose your AI provider" },
  "opt_onboarding_step2": { "message": "Get your free API key (click link below)" },
  "opt_onboarding_step3": { "message": "Paste your key and click Save" },
  "opt_onboarding_step4": { "message": "Start highlighting text on any webpage" },
  "opt_onboarding_btn_complete": { "message": "Complete Setup" },
  "opt_onboarding_btn_dismiss": { "message": "Dismiss" }
}
```

---

## 5) Luồng hành vi

### 5.1 First-time user flow

1. User clicks extension icon → Popup shows "Open Settings" CTA
2. Options page opens → **General (Getting Started)** tab active
3. **Onboarding checklist** visible at top
4. User sees 4 essential fields + hero box with "Get Free Key" button
5. User clicks "Get Free Key" → Opens Google AI Studio in new tab
6. User copies key → Pastes into "AI Access Key" field
7. User clicks "Save Settings" → Success message + onboarding checklist auto-completes Step 3
8. Onboarding checklist shows "Complete Setup" button
9. User clicks "Complete Setup" → Checklist dismisses, `atom_options_setup_completed = true`

**Time estimate:** 3-5 minutes for non-tech user

---

### 5.2 Advanced fields access flow

**No modal confirm needed** (different from v1 approach) - just use collapsible sections.

**Rationale:**
- Code already has `<details>` sections for advanced settings
- Adding modal confirm would require state management (`atom_options_advanced_confirmed`)
- Simpler approach: Rely on visual hierarchy (collapsed by default, "(For advanced users)" badge)

**Result:** User can expand/collapse advanced sections freely without friction.

---

## 6) File-level implementation

### 6.1 `options.html`

**Changes:**

1. **Update tab labels** (lines 845, 862, 873, 885):
   ```html
   <!-- OLD -->
   <span class="nav-label" data-i18n="opt_tab_general">Chung</span>

   <!-- NEW -->
   <span class="nav-label" data-i18n="opt_tab_general">Getting Started</span>
   ```

2. **Add tab descriptions** under each tab title (e.g., line 910):
   ```html
   <h2>
       <svg>...</svg>
       <span data-i18n="opt_tab_general">Getting Started</span>
   </h2>
   <!-- ADD THIS -->
   <p class="tab-description" data-i18n="opt_tab_general_desc">
       Set up your AI provider and basic preferences
   </p>
   ```

3. **Add onboarding checklist** (insert after line 912, before provider selector):
   ```html
   <!-- Onboarding Checklist (shown on first visit) -->
   <div id="onboarding-checklist" class="onboarding-card" style="display: none;">
       <div class="onboarding-header">
           <h3 data-i18n="opt_onboarding_title">Quick Setup (4 steps)</h3>
           <button class="onboarding-dismiss" aria-label="Dismiss">×</button>
       </div>
       <ul class="onboarding-steps">
           <li id="onboarding-step-1" class="completed">
               <span class="step-icon">☑</span>
               <span data-i18n="opt_onboarding_step1">Choose your AI provider</span>
           </li>
           <li id="onboarding-step-2">
               <span class="step-icon">☐</span>
               <span data-i18n="opt_onboarding_step2">Get your free API key (click link below)</span>
           </li>
           <li id="onboarding-step-3">
               <span class="step-icon">☐</span>
               <span data-i18n="opt_onboarding_step3">Paste your key and click Save</span>
           </li>
           <li id="onboarding-step-4">
               <span class="step-icon">☐</span>
               <span data-i18n="opt_onboarding_step4">Start highlighting text on any webpage</span>
           </li>
       </ul>
       <button id="btn-complete-setup" class="btn-action" style="width: 100%; margin-top: 12px;" data-i18n="opt_onboarding_btn_complete">
           Complete Setup
       </button>
   </div>
   ```

4. **Wrap User Persona in collapsible** (line 1063):
   ```html
   <!-- User Persona Section -->
   <details class="advanced-settings" style="margin-top: 16px;">
       <summary>
           <span data-i18n="opt_advanced_settings_title">Advanced Settings</span>
           <span class="advanced-badge" data-i18n="opt_advanced_badge">(For advanced users)</span>
       </summary>
       <div class="advanced-content">
           <div class="setting-section">
               <label for="userPersona" data-i18n="opt_user_persona_title">User Role</label>
               <input type="text" id="userPersona" placeholder="e.g. Doctor, Student, Engineer..."
                   data-i18n-placeholder="opt_user_persona_placeholder">
               <p class="hint-text" data-i18n="opt_user_persona_desc">AI will adjust explanations to match your expertise.</p>
           </div>
       </div>
   </details>
   ```

5. **Add CSS for onboarding card** (insert in `<style>` block after line 758):
   ```css
   /* Onboarding Checklist */
   .onboarding-card {
       background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%);
       border: 2px solid var(--primary);
       border-radius: 14px;
       padding: 20px;
       margin-bottom: 24px;
   }

   .onboarding-header {
       display: flex;
       justify-content: space-between;
       align-items: center;
       margin-bottom: 16px;
   }

   .onboarding-header h3 {
       margin: 0;
       font-size: 16px;
       color: var(--foreground);
   }

   .onboarding-dismiss {
       background: none;
       border: none;
       font-size: 24px;
       color: var(--muted);
       cursor: pointer;
       padding: 0;
       width: 28px;
       height: 28px;
       display: flex;
       align-items: center;
       justify-content: center;
       border-radius: 50%;
       transition: all 0.2s;
   }

   .onboarding-dismiss:hover {
       background: rgba(0, 0, 0, 0.1);
       color: var(--foreground);
   }

   .onboarding-steps {
       list-style: none;
       padding: 0;
       margin: 0 0 16px 0;
   }

   .onboarding-steps li {
       display: flex;
       align-items: center;
       gap: 12px;
       padding: 10px 0;
       font-size: 14px;
       color: var(--foreground);
   }

   .onboarding-steps .step-icon {
       font-size: 18px;
       width: 24px;
       text-align: center;
   }

   .onboarding-steps li.completed {
       color: var(--primary);
   }

   .onboarding-steps li.completed .step-icon {
       color: var(--primary);
   }

   .tab-description {
       font-size: 13px;
       color: var(--muted);
       margin: -16px 0 24px 0;
       line-height: 1.5;
   }
   ```

---

### 6.2 `options.js`

**Changes:**

1. **Add onboarding checklist logic** (insert after line 92):
   ```javascript
   // Initialize onboarding checklist
   initOnboarding();
   ```

2. **Implement `initOnboarding()` function** (insert before line 853):
   ```javascript
   // ============================================================
   // Onboarding Checklist System
   // ============================================================

   async function initOnboarding() {
       const result = await chrome.storage.local.get(['atom_options_setup_completed', 'user_gemini_key', 'atom_openrouter_key']);
       const setupCompleted = result.atom_options_setup_completed === true;
       const hasKey = !!(result.user_gemini_key || result.atom_openrouter_key);

       const checklistEl = document.getElementById('onboarding-checklist');
       if (!checklistEl) return;

       // Show checklist if setup not completed
       if (!setupCompleted) {
           checklistEl.style.display = 'block';

           // Update step states
           updateOnboardingStep('onboarding-step-1', true); // Provider selection (always completed if page loaded)
           updateOnboardingStep('onboarding-step-3', hasKey); // API key (completed if key exists)
       }

       // Dismiss button handler
       const dismissBtn = checklistEl.querySelector('.onboarding-dismiss');
       if (dismissBtn) {
           dismissBtn.addEventListener('click', dismissOnboarding);
       }

       // Complete setup button handler
       const completeBtn = document.getElementById('btn-complete-setup');
       if (completeBtn) {
           completeBtn.addEventListener('click', completeOnboarding);
       }

       // Watch for API key changes to update step 3
       const apiKeyInput = document.getElementById('apiKeyInput');
       if (apiKeyInput) {
           apiKeyInput.addEventListener('input', () => {
               const hasKey = apiKeyInput.value.trim().length > 0;
               updateOnboardingStep('onboarding-step-3', hasKey);
           });
       }

       const openrouterKeyInput = document.getElementById('openrouterKeyInput');
       if (openrouterKeyInput) {
           openrouterKeyInput.addEventListener('input', () => {
               const hasKey = openrouterKeyInput.value.trim().length > 0;
               updateOnboardingStep('onboarding-step-3', hasKey);
           });
       }
   }

   function updateOnboardingStep(stepId, completed) {
       const stepEl = document.getElementById(stepId);
       if (!stepEl) return;

       if (completed) {
           stepEl.classList.add('completed');
           stepEl.querySelector('.step-icon').textContent = '☑';
       } else {
           stepEl.classList.remove('completed');
           stepEl.querySelector('.step-icon').textContent = '☐';
       }
   }

   function dismissOnboarding() {
       const checklistEl = document.getElementById('onboarding-checklist');
       if (checklistEl) {
           checklistEl.style.display = 'none';
       }
       // Don't set atom_options_setup_completed to allow checklist to reappear if user reopens settings
   }

   async function completeOnboarding() {
       const checklistEl = document.getElementById('onboarding-checklist');
       if (checklistEl) {
           checklistEl.style.display = 'none';
       }

       // Mark setup as completed
       await chrome.storage.local.set({ atom_options_setup_completed: true });

       // Show success message
       const status = document.getElementById('status');
       if (status) {
           status.textContent = atomMsg('opt_onboarding_completed', null, 'Setup completed! You can now start using ATOM.');
           status.className = 'success';

           setTimeout(() => {
               status.textContent = '';
           }, 3000);
       }
   }
   ```

3. **Auto-complete step 3 after save** (modify `saveOptions()` function, insert after line 420):
   ```javascript
   // Auto-complete onboarding step 3 if key was saved
   if (key || openrouterKey) {
       updateOnboardingStep('onboarding-step-3', true);
   }
   ```

---

### 6.3 `_locales/en/messages.json`

**Add new keys:**

```json
{
  "opt_tab_general": {
    "message": "Getting Started",
    "description": "Tab name for general/basic settings"
  },
  "opt_tab_general_desc": {
    "message": "Set up your AI provider and basic preferences"
  },
  "opt_tab_ai": {
    "message": "AI Features",
    "description": "Tab name for AI-related settings"
  },
  "opt_tab_ai_desc": {
    "message": "Enable AI-powered reading assistance"
  },
  "opt_tab_connections": {
    "message": "Integrations",
    "description": "Tab name for external integrations"
  },
  "opt_tab_connections_desc": {
    "message": "Connect with NotebookLM and other tools"
  },
  "opt_tab_advanced": {
    "message": "Developer Tools",
    "description": "Tab name for debugging tools"
  },
  "opt_tab_advanced_desc": {
    "message": "Debugging and diagnostic tools"
  },
  "opt_onboarding_title": {
    "message": "Quick Setup (4 steps)"
  },
  "opt_onboarding_step1": {
    "message": "Choose your AI provider"
  },
  "opt_onboarding_step2": {
    "message": "Get your free API key (click link below)"
  },
  "opt_onboarding_step3": {
    "message": "Paste your key and click Save"
  },
  "opt_onboarding_step4": {
    "message": "Start highlighting text on any webpage"
  },
  "opt_onboarding_btn_complete": {
    "message": "Complete Setup"
  },
  "opt_onboarding_btn_dismiss": {
    "message": "Dismiss"
  },
  "opt_onboarding_completed": {
    "message": "Setup completed! You can now start using ATOM."
  },
  "opt_user_persona_title": {
    "message": "User Role"
  }
}
```

---

### 6.4 `_locales/vi/messages.json`

**Mirror EN keys:**

```json
{
  "opt_tab_general": {
    "message": "Bắt đầu"
  },
  "opt_tab_general_desc": {
    "message": "Thiết lập nhà cung cấp AI và tùy chọn cơ bản"
  },
  "opt_tab_ai": {
    "message": "Tính năng AI"
  },
  "opt_tab_ai_desc": {
    "message": "Bật tính năng hỗ trợ đọc bằng AI"
  },
  "opt_tab_connections": {
    "message": "Tích hợp"
  },
  "opt_tab_connections_desc": {
    "message": "Kết nối với NotebookLM và công cụ khác"
  },
  "opt_tab_advanced": {
    "message": "Công cụ Dev"
  },
  "opt_tab_advanced_desc": {
    "message": "Công cụ gỡ lỗi và chẩn đoán"
  },
  "opt_onboarding_title": {
    "message": "Thiết lập nhanh (4 bước)"
  },
  "opt_onboarding_step1": {
    "message": "Chọn nhà cung cấp AI"
  },
  "opt_onboarding_step2": {
    "message": "Nhận khóa API miễn phí (nhấp vào link bên dưới)"
  },
  "opt_onboarding_step3": {
    "message": "Dán khóa của bạn và nhấp Lưu"
  },
  "opt_onboarding_step4": {
    "message": "Bắt đầu tô sáng văn bản trên bất kỳ trang web nào"
  },
  "opt_onboarding_btn_complete": {
    "message": "Hoàn tất thiết lập"
  },
  "opt_onboarding_btn_dismiss": {
    "message": "Bỏ qua"
  },
  "opt_onboarding_completed": {
    "message": "Thiết lập hoàn tất! Bạn có thể bắt đầu sử dụng ATOM."
  },
  "opt_user_persona_title": {
    "message": "Vai trò của bạn"
  }
}
```

---

## 7) Data và migration

### Storage keys:

**New keys:**
- `atom_options_setup_completed: boolean` - Whether user completed onboarding checklist

**No changes to existing keys.**

---

## 8) Test plan

### 8.1 Functional tests

#### Test Case 1: First-time setup with onboarding

**Precondition:**
- Fresh install OR `atom_options_setup_completed !== true`
- No API key saved

**Steps:**
1. Open options page
2. Verify "Getting Started" tab is active
3. Verify onboarding checklist is visible
4. Verify Step 1 is auto-checked (provider selection)
5. Click "Get Free Key" button → Google AI Studio opens
6. Paste fake key "AIzaSyTest123" into AI Access Key field
7. Verify Step 3 auto-checks (onboarding checklist updates)
8. Click "Save Settings"
9. Verify success message
10. Click "Complete Setup" button on checklist
11. Verify checklist disappears
12. Close and reopen options page
13. Verify checklist does NOT reappear

**Expected outcomes:**
- ✅ Onboarding checklist visible on first visit
- ✅ Steps auto-complete as user progresses
- ✅ Checklist dismisses after "Complete Setup"
- ✅ Checklist does not reappear after completion

---

#### Test Case 2: Tab descriptions display

**Precondition:** Options page open

**Steps:**
1. Click "Getting Started" tab → Verify description "Set up your AI provider..."
2. Click "AI Features" tab → Verify description "Enable AI-powered..."
3. Click "Integrations" tab → Verify description "Connect with NotebookLM..."
4. Click "Developer Tools" tab → Verify description "Debugging and..."

**Expected outcomes:**
- ✅ All 4 tabs show descriptions below tab title
- ✅ Descriptions use plain language
- ✅ Descriptions match i18n keys

---

#### Test Case 3: Advanced field collapsing

**Precondition:** Options page open, "Getting Started" tab active

**Steps:**
1. Verify only 4 fields visible initially (Provider, API Key, Sensitivity, Language)
2. Scroll down → Verify "Advanced Settings" collapsible section exists
3. Click to expand "Advanced Settings"
4. Verify "User Role" field appears
5. Collapse "Advanced Settings" again
6. Refresh page
7. Verify "Advanced Settings" is collapsed by default

**Expected outcomes:**
- ✅ Advanced settings collapsed by default
- ✅ State does NOT persist across page refresh (always collapse on load)
- ✅ Only essential fields visible for first-time users

---

### 8.2 Regression tests

1. **Existing functionality preserved:**
   - [ ] Save settings still works (all fields save correctly)
   - [ ] Provider toggle (Google/OpenRouter) still works
   - [ ] Semantic toggles disabled when no API key
   - [ ] Advanced settings in AI tab still work
   - [ ] Advanced settings in Integrations tab still work
   - [ ] Debug section hidden when `BUILD_FLAGS.DEBUG=false`

2. **i18n compatibility:**
   - [ ] Switch language to VI → All new text translates
   - [ ] No missing keys (check console for `getMessage` errors)

---

### 8.3 Accessibility

1. **Onboarding checklist:**
   - [ ] Dismiss button has `aria-label`
   - [ ] Keyboard navigation: Tab key focuses Dismiss button, then Complete Setup button
   - [ ] Enter key activates buttons

2. **Tab descriptions:**
   - [ ] Screen reader announces tab description after tab name

---

## 9) Acceptance criteria

### AC1: ≤8 visible fields in first-time setup flow ✅

**Definition:** "Visible fields" = fields user can interact with WITHOUT expanding collapsible sections.

**Measurement:**
1. Fresh install, open options page
2. Count fields in "Getting Started" tab that are visible by default
3. Expected count: 4 fields (Provider, API Key, Sensitivity, Language)

**Pass criteria:** ≤8 fields visible (target met with 4 fields ✅)

---

### AC2: 80% of new users do not expand Advanced sections ✅

**Measurement (requires analytics):**
- Track: `atom_options_advanced_expanded` event on `<details>` open
- Baseline: % of users who expand Advanced sections in first 7 days after install
- Target: ≤20% of users expand Advanced sections

**Pass criteria:** Analytics show ≤20% expansion rate (post-release verification)

---

### AC3: Onboarding checklist dismisses correctly ✅

**Verification:**
1. Complete Test Case 1
2. Verify `atom_options_setup_completed === true` in storage after "Complete Setup"
3. Verify checklist does not reappear on subsequent visits

**Pass criteria:** 100% functional in manual testing

---

### AC4: All tab names are non-tech friendly ✅

**Verification:**
- Scan tab labels for technical jargon
- Expected labels: "Getting Started", "AI Features", "Integrations", "Developer Tools"

**Pass criteria:** 0/4 tabs use technical jargon in primary label

---

## 10) Rủi ro và rollback

### Rủi ro:

**R1: Onboarding checklist confuses existing users**
- **Likelihood:** Low (only shows if `atom_options_setup_completed !== true`)
- **Impact:** Medium
- **Mitigation:** Existing users likely have API key saved → checklist will auto-complete steps → easy to dismiss

**R2: Collapsing User Persona field hides important setting**
- **Likelihood:** Medium
- **Impact:** Low (Persona is optional feature)
- **Mitigation:**
  - Add tooltip to Sensitivity section mentioning Persona in Advanced
  - Analytics: Track how many users set Persona value (expect <10%)

**R3: Tab renaming breaks user muscle memory**
- **Likelihood:** High
- **Impact:** Low (visual labels change, but tab structure intact)
- **Mitigation:**
  - Add changelog entry explaining tab renames
  - Monitor support channels for confusion

---

### Rollback plan:

**Commit strategy:**
1. **Commit 1:** i18n EN keys (onboarding, tab names, descriptions)
2. **Commit 2:** i18n VI keys (mirror EN)
3. **Commit 3:** options.html structure (onboarding card HTML, CSS, tab descriptions)
4. **Commit 4:** options.js logic (onboarding functions, event handlers)
5. **Commit 5:** User Persona field wrap in collapsible

**Rollback triggers:**
- >20 users report "can't find settings" in first 48 hours
- Onboarding checklist causes crash or performance issue
- Analytics show >30% users expand Advanced sections (indicates essential field was hidden)

**Rollback procedure:**
1. Revert commits 3-5 (keep i18n changes, remove UI changes)
2. Hotfix: Hide onboarding card with `display: none` via injected CSS
3. Post-mortem: Analyze which field users were looking for

---

## 11) Estimate

### Dev time breakdown:

| Task | Time | Notes |
|------|------|-------|
| i18n files (EN/VI) | 1 hour | 20 new keys |
| options.html: Tab descriptions | 0.5 hour | 4 descriptions |
| options.html: Onboarding card HTML + CSS | 2 hours | Complex interactive component |
| options.html: Wrap Persona in collapsible | 0.5 hour | Simple restructure |
| options.js: Onboarding logic | 2 hours | Event handlers, state management |
| options.js: Auto-complete steps | 1 hour | Watch API key input, update checklist |
| Manual testing (self) | 1.5 hours | Run through 3 test cases |
| **Total dev** | **8.5 hours (1 day)** | |

### QA time breakdown:

| Task | Time | Notes |
|------|------|-------|
| Functional tests (3 cases) | 1.5 hours | |
| Regression tests | 1 hour | Existing features still work |
| Accessibility checks | 0.5 hour | Keyboard nav, aria-labels |
| Copy review (VI translations) | 0.5 hour | |
| **Total QA** | **3.5 hours (0.5 day)** | |

### **Total estimate: 1.5 days** ✅

---

## 12) Migration & Communication

### 12.1 Changelog entry

**Version:** v2.8.2
**Title:** Settings Simplification Update

```markdown
## v2.8.2 - Simplified Settings

We've made Settings easier to navigate for first-time users:

**What changed:**
- Tab names are clearer: "Getting Started", "AI Features", "Integrations", "Developer Tools"
- New onboarding checklist guides you through setup (4 simple steps)
- Advanced settings are now hidden by default (expand when needed)
- Each tab now has a description explaining its purpose

**Your data is safe:**
- All settings and data are preserved
- Only the layout changed - functionality is the same

**Why we did this:**
We want new users to get started quickly without feeling overwhelmed by options.
```

---

### 12.2 In-app notification (optional)

**Show once** on first visit after update to v2.8.2:

```
💡 Settings are now easier to navigate! Check out the new onboarding guide.
[Got it]
```

**Storage key:** `atom_options_v282_notice_seen: boolean`

---

## Appendix A: Quick Reference - Tab Structure

| Tab name (UI) | Tab ID (code) | Essential fields | Advanced fields |
|---------------|---------------|------------------|-----------------|
| Getting Started | `general` | 4 fields | 1 field (Persona) |
| AI Features | `ai` | 3 toggles | 9 fields (already collapsible) |
| Integrations | `connections` | 3 fields | 7 fields (already collapsible) |
| Developer Tools | `advanced` | N/A | Debug + Notifications |

---

## Appendix B: Implementation Checklist

### Phase 1: i18n files (1 hour)
- [ ] Add 20 new EN keys (tab names, descriptions, onboarding)
- [ ] Mirror all EN keys to VI
- [ ] Run `node scripts/check_i18n_parity.js` (if exists)
- [ ] Commit: "feat(i18n): Wave 2 settings simplification keys"

### Phase 2: options.html structure (3 hours)
- [ ] Update 4 tab label `data-i18n` attributes
- [ ] Add tab descriptions (4 `<p class="tab-description">` elements)
- [ ] Insert onboarding checklist HTML (after line 912)
- [ ] Add onboarding CSS (after line 758)
- [ ] Wrap User Persona in `<details class="advanced-settings">`
- [ ] Test: Visual inspection in browser
- [ ] Commit: "feat(options): add onboarding checklist and tab descriptions"

### Phase 3: options.js logic (3 hours)
- [ ] Implement `initOnboarding()` function
- [ ] Implement `updateOnboardingStep()` helper
- [ ] Implement `dismissOnboarding()` handler
- [ ] Implement `completeOnboarding()` handler
- [ ] Add onboarding init call in DOMContentLoaded
- [ ] Add auto-complete logic in `saveOptions()`
- [ ] Test: Onboarding flow works end-to-end
- [ ] Commit: "feat(options): implement onboarding checklist logic"

### Phase 4: Testing (5 hours)
- [ ] Execute Test Case 1 (first-time setup)
- [ ] Execute Test Case 2 (tab descriptions)
- [ ] Execute Test Case 3 (advanced collapsing)
- [ ] Run regression checklist (all 6 items)
- [ ] Accessibility checks (keyboard nav, screen reader)
- [ ] Cross-browser test (Chrome, Edge)
- [ ] Document any issues → Fix → Re-test

### Phase 5: QA & Polish (2 hours)
- [ ] Native speaker review VI translations
- [ ] Screenshot first-time setup flow → Verify no jargon
- [ ] Verify storage keys (check `atom_options_setup_completed` saved)
- [ ] Final commit: "chore: Wave 2 QA fixes"

### Phase 6: Release prep (1 hour)
- [ ] Update CHANGELOG.md with Section 12.1 content
- [ ] Tag release: `git tag v2.8.2-wave2`
- [ ] Push to staging for final review

---

**End of Wave 2 Spec v2**

**Changes from v1:**
- **CRITICAL FIX:** Resolved tab structure conflict (keep 4 tabs, add progressive disclosure WITHIN tabs instead of reorganizing)
- Added onboarding checklist feature (4-step guided setup)
- Added tab descriptions for context
- Detailed i18n key mapping
- Detailed file-level implementation guide
- 3 comprehensive test cases with expected outcomes
- Rollback strategy with commit breakdown
- Implementation checklist (Appendix B)
- Quick reference table (Appendix A)

**Review status:** Ready for stakeholder review
**Estimated completion:** 1.5 days (down from 2 days in v1)
