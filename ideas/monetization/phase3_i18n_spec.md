# Phase 3: i18n & Localization - Detailed Specification

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for Execution  
**Parent Spec:** [auth_infrastructure_spec.md](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/auth_infrastructure_spec.md)  
**Prerequisite:** [Phase 2 Completed](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/phase2_ui_integration_spec.md)  
**Estimated Time:** 1-2 hours

---

## Overview

This phase adds English and Vietnamese translations for all authentication UI strings. By the end of this phase:
- All auth UI text is localized
- Switching browser language shows correct translations
- All `data-i18n` attributes work correctly

---

## Prerequisites

Before starting, ensure Phase 2 is complete:
- [ ] Account tab visible in Options page
- [ ] All UI elements have `data-i18n` attributes
- [ ] `options.js` uses `chrome.i18n.getMessage()` for dynamic text

---

## File Changes

| File | Action | Keys Added |
|------|--------|------------|
| `_locales/en/messages.json` | MODIFY | 18 keys |
| `_locales/vi/messages.json` | MODIFY | 18 keys |

---

## Step 1: English Translations (20 min)

### 1.1 Add to `_locales/en/messages.json`

Add these keys to the existing JSON file:

```json
{
  "opt_tab_account": {
    "message": "Account",
    "description": "Account tab label in options navigation"
  },
  "opt_account_title": {
    "message": "Account",
    "description": "Account panel title"
  },
  "opt_account_signin_title": {
    "message": "Sign in to AmoNexus",
    "description": "Sign in hero title"
  },
  "opt_account_signin_desc": {
    "message": "Sign in to sync your data across devices and unlock Pro features.",
    "description": "Sign in hero description"
  },
  "opt_account_signin_google": {
    "message": "Sign in with Google",
    "description": "Google sign in button text"
  },
  "opt_account_signing_in": {
    "message": "Signing in...",
    "description": "Sign in button loading state"
  },
  "opt_account_signin_success": {
    "message": "Signed in successfully!",
    "description": "Toast message after successful sign in"
  },
  "opt_account_signin_error": {
    "message": "Sign in failed. Please try again.",
    "description": "Generic sign in error message"
  },
  "opt_account_signin_cancelled": {
    "message": "Sign in cancelled.",
    "description": "Error when user closes OAuth popup"
  },
  "opt_account_remember_me": {
    "message": "Remember me for 7 days",
    "description": "Remember me checkbox label"
  },
  "opt_account_privacy_note": {
    "message": "We only use your email for account management. Your data stays on your device.",
    "description": "Privacy assurance text"
  },
  "opt_account_signout": {
    "message": "Sign Out",
    "description": "Sign out button text"
  },
  "opt_account_signout_success": {
    "message": "Signed out successfully",
    "description": "Toast message after sign out"
  },
  "opt_account_upgrade": {
    "message": "Upgrade to Pro",
    "description": "Upgrade button text"
  },
  "opt_account_manage": {
    "message": "Manage Subscription",
    "description": "Manage subscription button text"
  },
  "opt_account_sync_info": {
    "message": "Your settings are stored locally. Cloud sync coming soon!",
    "description": "Sync status info text"
  },
  "opt_account_loading": {
    "message": "Loading...",
    "description": "Loading state text"
  },
  "opt_account_error_title": {
    "message": "Something went wrong",
    "description": "Error state title"
  },
  "opt_account_retry": {
    "message": "Try Again",
    "description": "Retry button text"
  },
  "opt_account_network_error": {
    "message": "Network error. Check your internet connection.",
    "description": "Network error message"
  },
  "opt_account_session_expired": {
    "message": "Session expired. Please sign in again.",
    "description": "Session expiry message"
  }
}
```

---

## Step 2: Vietnamese Translations (30 min)

### 2.1 Add to `_locales/vi/messages.json`

Add these keys to the existing JSON file:

```json
{
  "opt_tab_account": {
    "message": "Tài khoản",
    "description": "Account tab label in options navigation"
  },
  "opt_account_title": {
    "message": "Tài khoản",
    "description": "Account panel title"
  },
  "opt_account_signin_title": {
    "message": "Đăng nhập AmoNexus",
    "description": "Sign in hero title"
  },
  "opt_account_signin_desc": {
    "message": "Đăng nhập để đồng bộ dữ liệu giữa các thiết bị và mở khóa tính năng Pro.",
    "description": "Sign in hero description"
  },
  "opt_account_signin_google": {
    "message": "Đăng nhập với Google",
    "description": "Google sign in button text"
  },
  "opt_account_signing_in": {
    "message": "Đang đăng nhập...",
    "description": "Sign in button loading state"
  },
  "opt_account_signin_success": {
    "message": "Đăng nhập thành công!",
    "description": "Toast message after successful sign in"
  },
  "opt_account_signin_error": {
    "message": "Đăng nhập thất bại. Vui lòng thử lại.",
    "description": "Generic sign in error message"
  },
  "opt_account_signin_cancelled": {
    "message": "Đã hủy đăng nhập.",
    "description": "Error when user closes OAuth popup"
  },
  "opt_account_remember_me": {
    "message": "Ghi nhớ đăng nhập 7 ngày",
    "description": "Remember me checkbox label"
  },
  "opt_account_privacy_note": {
    "message": "Chúng tôi chỉ sử dụng email của bạn để quản lý tài khoản. Dữ liệu của bạn vẫn được lưu trữ trên thiết bị.",
    "description": "Privacy assurance text"
  },
  "opt_account_signout": {
    "message": "Đăng xuất",
    "description": "Sign out button text"
  },
  "opt_account_signout_success": {
    "message": "Đã đăng xuất",
    "description": "Toast message after sign out"
  },
  "opt_account_upgrade": {
    "message": "Nâng cấp lên Pro",
    "description": "Upgrade button text"
  },
  "opt_account_manage": {
    "message": "Quản lý thuê bao",
    "description": "Manage subscription button text"
  },
  "opt_account_sync_info": {
    "message": "Cài đặt được lưu cục bộ. Đồng bộ đám mây sẽ sớm ra mắt!",
    "description": "Sync status info text"
  },
  "opt_account_loading": {
    "message": "Đang tải...",
    "description": "Loading state text"
  },
  "opt_account_error_title": {
    "message": "Đã xảy ra lỗi",
    "description": "Error state title"
  },
  "opt_account_retry": {
    "message": "Thử lại",
    "description": "Retry button text"
  },
  "opt_account_network_error": {
    "message": "Lỗi mạng. Kiểm tra kết nối internet của bạn.",
    "description": "Network error message"
  },
  "opt_account_session_expired": {
    "message": "Phiên đã hết hạn. Vui lòng đăng nhập lại.",
    "description": "Session expiry message"
  }
}
```

---

## Step 3: Verify HTML data-i18n Attributes (15 min)

### 3.1 Required Attributes in `options.html`

Ensure all these elements have correct `data-i18n` attributes:

| Element | Attribute Value |
|---------|-----------------|
| Account tab button | `data-i18n="opt_tab_account"` |
| Panel title | `data-i18n="opt_account_title"` |
| Sign-in hero title | `data-i18n="opt_account_signin_title"` |
| Sign-in description | `data-i18n="opt_account_signin_desc"` |
| Google button text | `data-i18n="opt_account_signin_google"` |
| Remember me label | `data-i18n="opt_account_remember_me"` |
| Privacy note | `data-i18n="opt_account_privacy_note"` |
| Sign out button | `data-i18n="opt_account_signout"` |
| Upgrade button | `data-i18n="opt_account_upgrade"` |
| Manage button | `data-i18n="opt_account_manage"` |
| Sync info | `data-i18n="opt_account_sync_info"` |
| Loading text | `data-i18n="opt_account_loading"` |
| Error title | `data-i18n="opt_account_error_title"` |
| Retry button | `data-i18n="opt_account_retry"` |

### 3.2 Check Pattern

```html
<!-- Correct pattern -->
<span data-i18n="opt_account_signin_google">Sign in with Google</span>

<!-- The English text inside is the fallback if i18n fails -->
```

---

## Step 4: Update JavaScript for Dynamic Text (15 min)

### 4.1 Helper Function

Ensure this helper exists in `options.js` (or `common_utils.js`):

```javascript
/**
 * Get localized message with fallback
 * @param {string} key - i18n key
 * @param {Array} substitutions - Optional substitutions
 * @param {string} fallback - Fallback if key not found
 * @returns {string}
 */
function atomMsg(key, substitutions = null, fallback = '') {
  const message = chrome.i18n.getMessage(key, substitutions);
  return message || fallback || key;
}
```

### 4.2 Usage in Auth Functions

Update these calls in `options.js`:

```javascript
// Sign-in loading state
btn.innerHTML = `
  <div class="spinner"></div>
  <span>${atomMsg('opt_account_signing_in', null, 'Signing in...')}</span>
`;

// Sign-in success toast
showToast(atomMsg('opt_account_signin_success', null, 'Signed in successfully!'), 'success');

// Sign-out success toast  
showToast(atomMsg('opt_account_signout_success', null, 'Signed out'), 'success');

// Error messages
showAuthError(atomMsg('opt_account_network_error', null, 'Network error.'));
showAuthError(atomMsg('opt_account_session_expired', null, 'Session expired.'));
```

---

## Complete i18n Key Reference

| Key | English | Vietnamese |
|-----|---------|------------|
| `opt_tab_account` | Account | Tài khoản |
| `opt_account_title` | Account | Tài khoản |
| `opt_account_signin_title` | Sign in to AmoNexus | Đăng nhập AmoNexus |
| `opt_account_signin_desc` | Sign in to sync... | Đăng nhập để đồng bộ... |
| `opt_account_signin_google` | Sign in with Google | Đăng nhập với Google |
| `opt_account_signing_in` | Signing in... | Đang đăng nhập... |
| `opt_account_signin_success` | Signed in successfully! | Đăng nhập thành công! |
| `opt_account_signin_error` | Sign in failed... | Đăng nhập thất bại... |
| `opt_account_signin_cancelled` | Sign in cancelled. | Đã hủy đăng nhập. |
| `opt_account_remember_me` | Remember me for 7 days | Ghi nhớ đăng nhập 7 ngày |
| `opt_account_privacy_note` | We only use... | Chúng tôi chỉ sử dụng... |
| `opt_account_signout` | Sign Out | Đăng xuất |
| `opt_account_signout_success` | Signed out successfully | Đã đăng xuất |
| `opt_account_upgrade` | Upgrade to Pro | Nâng cấp lên Pro |
| `opt_account_manage` | Manage Subscription | Quản lý thuê bao |
| `opt_account_sync_info` | Your settings are stored... | Cài đặt được lưu... |
| `opt_account_loading` | Loading... | Đang tải... |
| `opt_account_error_title` | Something went wrong | Đã xảy ra lỗi |
| `opt_account_retry` | Try Again | Thử lại |
| `opt_account_network_error` | Network error... | Lỗi mạng... |
| `opt_account_session_expired` | Session expired... | Phiên đã hết hạn... |

---

## Deliverables Checklist

| Item | Status |
|------|--------|
| EN keys added to `messages.json` | [ ] |
| VI keys added to `messages.json` | [ ] |
| All HTML elements have `data-i18n` | [ ] |
| JS dynamic text uses `atomMsg()` | [ ] |
| No hardcoded strings in auth UI | [ ] |

---

## Verification

### Test 1: English (Default)

1. Set Chrome language to English
2. Open Options page → Account tab
3. Verify all text is in English:
   - [ ] Tab label: "Account"
   - [ ] Hero title: "Sign in to AmoNexus"
   - [ ] Button: "Sign in with Google"
   - [ ] Remember me: "Remember me for 7 days"

### Test 2: Vietnamese

1. Set Chrome language to Vietnamese:
   - Chrome → Settings → Languages → Add Vietnamese → Move to top
2. Restart Chrome
3. Open Options page → Account tab
4. Verify all text is in Vietnamese:
   - [ ] Tab label: "Tài khoản"
   - [ ] Hero title: "Đăng nhập AmoNexus"
   - [ ] Button: "Đăng nhập với Google"
   - [ ] Remember me: "Ghi nhớ đăng nhập 7 ngày"

### Test 3: Dynamic Text

1. Click "Sign in with Google"
2. Verify button shows localized "Signing in..." / "Đang đăng nhập..."
3. Complete or cancel sign-in
4. Verify toast message is localized

### Test 4: Fallback

1. Temporarily rename a key in messages.json (to test fallback)
2. Reload extension
3. Verify fallback English text appears instead of empty string

---

## Troubleshooting

### Text shows key name instead of translation
- Check JSON syntax (missing comma, quote)
- Verify key matches exactly in HTML and JSON
- Reload extension after changes

### Vietnamese characters display incorrectly
- Ensure file is saved as UTF-8
- Check `"default_locale": "en"` in manifest.json

### Some text not translating
- Check for missing `data-i18n` attribute
- Verify dynamic text uses `chrome.i18n.getMessage()`

---

## Next Steps

Once all verifications pass, proceed to:
→ **Phase 4: End-to-End Testing** - Comprehensive auth flow testing

---

**Document History:**
- v1.0 (2026-02-09): Initial spec created

