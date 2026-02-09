# Phase 4: End-to-End Testing - Detailed Specification

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for Execution  
**Parent Spec:** [auth_infrastructure_spec.md](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/auth_infrastructure_spec.md)  
**Prerequisite:** [Phase 3 Completed](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/phase3_i18n_spec.md)  
**Estimated Time:** 4-6 hours

---

## Overview

This phase performs comprehensive end-to-end testing of the authentication system. By the end of this phase:
- All auth flows verified working
- Edge cases handled correctly
- Performance acceptable
- Security validated

---

## Prerequisites

Before starting, ensure all previous phases complete:
- [ ] Phase 0: Supabase + Google OAuth configured
- [ ] Phase 1: Core services implemented
- [ ] Phase 2: UI integrated
- [ ] Phase 3: i18n complete

---

## Test Environment Setup

### Required Tools
- Chrome browser (latest stable)
- Chrome DevTools
- Network throttling (for offline tests)
- Multiple Google accounts (for testing)

### Test Accounts
Prepare at least 2 Google accounts:

| Account | Purpose |
|---------|---------|
| `test1@gmail.com` | Primary testing |
| `test2@gmail.com` | Multi-account testing |

> [!IMPORTANT]
> Add test accounts to Google OAuth consent screen (Test users section).

---

## Test Categories

| Category | Tests | Priority |
|----------|-------|----------|
| **A. Happy Path** | 5 | P0 |
| **B. Error Handling** | 6 | P0 |
| **C. Session Management** | 5 | P0 |
| **D. Offline Behavior** | 4 | P1 |
| **E. UI/UX Verification** | 5 | P1 |
| **F. Security Testing** | 4 | P0 |
| **G. Performance** | 3 | P2 |

---

## A. Happy Path Tests (P0)

### Test A1: First-Time Google Sign-In

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open Options page | Page loads | [ ] |
| 2 | Click "Account" tab | Account panel shows | [ ] |
| 3 | Verify logged-out state | Sign-in hero visible | [ ] |
| 4 | Check "Remember me" | Checkbox is checked | [ ] |
| 5 | Click "Sign in with Google" | OAuth popup opens | [ ] |
| 6 | Select Google account | Popup processes | [ ] |
| 7 | Wait for redirect | Popup closes automatically | [ ] |
| 8 | Verify logged-in state | User card shows avatar, name, email | [ ] |
| 9 | Verify plan badge | Shows "Free" | [ ] |
| 10 | Check toast message | "Signed in successfully!" | [ ] |

**Console Verification:**
```javascript
// Run in DevTools Console
chrome.storage.local.get(['atom_auth_cache'], console.log);
// Expected: Object with isAuthenticated: true, user object, expires_at
```

---

### Test A2: Sign Out

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | While logged in, click "Sign Out" | Button shows loading | [ ] |
| 2 | Wait for completion | UI switches to logged-out | [ ] |
| 3 | Verify hero section visible | Sign-in button shows | [ ] |
| 4 | Check toast message | "Signed out successfully" | [ ] |

**Console Verification:**
```javascript
chrome.storage.local.get(['atom_auth_cache'], console.log);
// Expected: undefined or null (cache cleared)
```

---

### Test A3: Return User (Session Persistence)

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in with "Remember me" checked | Successfully signed in | [ ] |
| 2 | Close browser completely | Browser closed | [ ] |
| 3 | Wait 10 seconds | - | [ ] |
| 4 | Open browser | Browser opens | [ ] |
| 5 | Open Options page | Page loads | [ ] |
| 6 | Click "Account" tab | Already logged in! | [ ] |
| 7 | Verify user info shown | Correct name/email | [ ] |

---

### Test A4: Sign In Without Remember Me

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Uncheck "Remember me" | Checkbox unchecked | [ ] |
| 2 | Sign in with Google | Success | [ ] |
| 3 | Check cache TTL | Expires in ~24 hours | [ ] |

**Console Verification:**
```javascript
chrome.storage.local.get(['atom_auth_cache'], (r) => {
  const cache = r.atom_auth_cache;
  const ttlHours = (cache.expires_at - cache.cached_at) / 1000 / 60 / 60;
  console.log('TTL (hours):', ttlHours);
  // Expected: ~24 (not 168 for 7 days)
});
```

---

### Test A5: Profile Data Integrity

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Open Supabase Dashboard | Dashboard loads | [ ] |
| 3 | Go to Table Editor → profiles | Table shows | [ ] |
| 4 | Find test user row | Row exists | [ ] |
| 5 | Verify columns | email, display_name, avatar_url populated | [ ] |
| 6 | Check is_pro | false | [ ] |
| 7 | Check subscription_status | "free" | [ ] |

---

## B. Error Handling Tests (P0)

### Test B1: OAuth Popup Cancelled

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Sign in with Google" | Popup opens | [ ] |
| 2 | Close popup (X button) | Popup closes | [ ] |
| 3 | Verify error handling | Button returns to normal | [ ] |
| 4 | Check UI state | Still on logged-out state | [ ] |
| 5 | No crash or hang | Extension still responsive | [ ] |

---

### Test B2: Network Disconnected During Sign-In

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open DevTools → Network tab | DevTools open | [ ] |
| 2 | Set "Offline" mode | Network throttled | [ ] |
| 3 | Click "Sign in with Google" | Attempt sign-in | [ ] |
| 4 | Verify error message | Shows network error | [ ] |
| 5 | Re-enable network | Network restored | [ ] |
| 6 | Click retry or sign-in again | Should work now | [ ] |

---

### Test B3: Invalid/Expired Token

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in successfully | Logged in | [ ] |
| 2 | Open DevTools Console | Console open | [ ] |
| 3 | Corrupt the token: | - | [ ] |
```javascript
chrome.storage.local.get(['atom_auth_cache'], (r) => {
  r.atom_auth_cache.user = null;
  chrome.storage.local.set(r);
});
```
| 4 | Reload Options page | Page reloads | [ ] |
| 5 | Verify graceful handling | Shows logged-out or refreshes | [ ] |

---

### Test B4: Supabase Service Down

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Block Supabase in DevTools: | - | [ ] |
| | Network → Block request URL → `*.supabase.co` | | |
| 2 | Try to sign in | Attempt fails | [ ] |
| 3 | Verify error message | Shows connection error | [ ] |
| 4 | Unblock Supabase | Network restored | [ ] |
| 5 | Sign in works | Success | [ ] |

---

### Test B5: Multiple Rapid Sign-In Clicks

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Sign in" rapidly 5 times | Button clicked 5x | [ ] |
| 2 | Verify only 1 popup opens | Single popup | [ ] |
| 3 | Button should be disabled | Prevents multiple clicks | [ ] |

---

### Test B6: Sign-In with Different Account

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in with test1@gmail.com | Success | [ ] |
| 2 | Sign out | Logged out | [ ] |
| 3 | Sign in with test2@gmail.com | Success | [ ] |
| 4 | Verify different user shown | test2's info displayed | [ ] |
| 5 | Check Supabase profiles | Both users exist | [ ] |

---

## C. Session Management Tests (P0)

### Test C1: Token Refresh

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Note current access_token (in storage) | Noted | [ ] |
| 3 | Wait 55+ minutes (or manually expire) | Token near expiry | [ ] |
| 4 | Perform action requiring auth | Action triggered | [ ] |
| 5 | Check if token refreshed | New access_token | [ ] |

---

### Test C2: Session Across Extension Pages

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in on Options page | Success | [ ] |
| 2 | Open Popup | Popup opens | [ ] |
| 3 | Check if auth state available | Can read user info | [ ] |
| 4 | Open Side Panel (if applicable) | Panel opens | [ ] |
| 5 | Verify consistent auth state | Same user everywhere | [ ] |

---

### Test C3: Cache Expiry (7-day)

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in with Remember me | Success | [ ] |
| 2 | Manually set expired cache: | - | [ ] |
```javascript
chrome.storage.local.get(['atom_auth_cache'], (r) => {
  r.atom_auth_cache.expires_at = Date.now() - 1000;
  chrome.storage.local.set(r);
});
```
| 3 | Reload Options page | Page reloads | [ ] |
| 4 | Verify behavior | Fetches fresh state (if valid Supabase session) or shows logged-out | [ ] |

---

### Test C4: Cache Expiry (24-hour)

Same as C3, but without Remember me:
- Verify 24-hour TTL expires correctly
- User prompted to sign in again

---

### Test C5: Concurrent Sign-In Attempts

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open Options in 2 tabs | 2 tabs open | [ ] |
| 2 | Click sign-in in Tab 1 | OAuth starts | [ ] |
| 3 | Click sign-in in Tab 2 | Should be blocked or queued | [ ] |
| 4 | Complete in Tab 1 | Success | [ ] |
| 5 | Tab 2 updates automatically | Shows logged in | [ ] |

---

## D. Offline Behavior Tests (P1)

### Test D1: Offline with Valid Cache

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in (online) | Success | [ ] |
| 2 | Set browser offline | Offline mode | [ ] |
| 3 | Reload Options page | Page loads | [ ] |
| 4 | Verify cached user shown | User info visible | [ ] |
| 5 | Click Sign Out | Should work (clears local) | [ ] |

---

### Test D2: Offline with Expired Cache

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Manually expire cache (see C3) | Cache expired | [ ] |
| 3 | Set browser offline | Offline mode | [ ] |
| 4 | Reload Options page | Page loads | [ ] |
| 5 | Verify offline UI | Shows offline message or expired state | [ ] |

---

### Test D3: Offline Sign-In Attempt

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Start offline (not signed in) | Offline, logged out | [ ] |
| 2 | Click "Sign in with Google" | Attempt sign in | [ ] |
| 3 | Verify error | Shows network error message | [ ] |
| 4 | Go online | Online | [ ] |
| 5 | Retry sign in | Success | [ ] |

---

### Test D4: Network Restoration

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in (online) | Success | [ ] |
| 2 | Go offline | Offline | [ ] |
| 3 | Go back online | Online | [ ] |
| 4 | Perform action | Should work seamlessly | [ ] |
| 5 | Token refresh if needed | Automatic | [ ] |

---

## E. UI/UX Verification Tests (P1)

### Test E1: Loading States

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Slow network (DevTools throttle) | Network slow | [ ] |
| 2 | Click sign in | Button shows spinner | [ ] |
| 3 | Verify spinner animation | Animates smoothly | [ ] |
| 4 | Text changes to "Signing in..." | Localized text shows | [ ] |

---

### Test E2: Toast Notifications

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in successfully | Toast appears | [ ] |
| 2 | Verify toast styling | Matches app theme | [ ] |
| 3 | Toast auto-dismisses | Fades after 3-5s | [ ] |
| 4 | Sign out | Toast appears | [ ] |

---

### Test E3: Dark Mode

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Enable OS dark mode | Dark mode on | [ ] |
| 2 | Open Options → Account | Page loads | [ ] |
| 3 | Verify colors adapt | Dark background, light text | [ ] |
| 4 | Verify buttons visible | Good contrast | [ ] |
| 5 | Verify avatar visible | Border/shadow visible | [ ] |

---

### Test E4: Responsive Layout

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open Options page | Normal width | [ ] |
| 2 | Resize window narrow | Layout adapts | [ ] |
| 3 | No horizontal scroll | Content fits | [ ] |
| 4 | Buttons remain clickable | Touch targets OK | [ ] |

---

### Test E5: Avatar Fallback

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in with account | Success | [ ] |
| 2 | Corrupt avatar URL in cache: | - | [ ] |
```javascript
chrome.storage.local.get(['atom_auth_cache'], (r) => {
  r.atom_auth_cache.user.avatarUrl = 'invalid://url';
  chrome.storage.local.set(r);
});
```
| 3 | Reload page | Page reloads | [ ] |
| 4 | Verify fallback avatar | Default avatar shown | [ ] |

---

## F. Security Testing (P0)

### Test F1: Token Not Exposed

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Open any webpage | Webpage loads | [ ] |
| 3 | Check if content script can access tokens | Cannot access | [ ] |
| 4 | Tokens only in background/extension pages | Verified | [ ] |

---

### Test F2: RLS Policy Verification

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in as test1 | Success | [ ] |
| 2 | Try to query test2's profile (via console): | - | [ ] |
```javascript
// This should fail or return empty due to RLS
const supabase = await getSupabaseClient();
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('email', 'test2@gmail.com');
console.log(data); // Should be [] or null
```
| 3 | Verify empty result | RLS blocks access | [ ] |

---

### Test F3: HTTPS Only

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Check OAuth URLs | All HTTPS | [ ] |
| 2 | Check Supabase URLs | All HTTPS | [ ] |
| 3 | No HTTP requests | DevTools Network verified | [ ] |

---

### Test F4: Logout Clears All Data

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Note storage keys | Multiple auth keys | [ ] |
| 3 | Sign out | Logged out | [ ] |
| 4 | Check chrome.storage.local | All auth keys removed | [ ] |

---

## G. Performance Testing (P2)

### Test G1: Initial Load Time

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Clear all cache | Fresh state | [ ] |
| 2 | Open Options page | Page loads | [ ] |
| 3 | Measure time to interactive | < 500ms | [ ] |
| 4 | Auth state check time | < 200ms (cached) | [ ] |

---

### Test G2: Sign-In Time

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click sign in | Start timer | [ ] |
| 2 | Complete OAuth | Stop timer | [ ] |
| 3 | Total time | < 5 seconds (normal network) | [ ] |

---

### Test G3: Storage Size

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Sign in | Success | [ ] |
| 2 | Check storage usage: | - | [ ] |
```javascript
chrome.storage.local.getBytesInUse(null, console.log);
```
| 3 | Auth data size | < 10KB | [ ] |

---

## Test Results Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| A. Happy Path | 5 | | | |
| B. Error Handling | 6 | | | |
| C. Session Management | 5 | | | |
| D. Offline Behavior | 4 | | | |
| E. UI/UX | 5 | | | |
| F. Security | 4 | | | |
| G. Performance | 3 | | | |
| **TOTAL** | **32** | | | |

---

## Bug Report Template

If any test fails, document using this template:

```markdown
## Bug: [Short Description]

**Test ID:** [e.g., B2]
**Severity:** P0/P1/P2
**Status:** Open

### Steps to Reproduce
1. 
2. 
3. 

### Expected Result


### Actual Result


### Screenshots/Logs


### Environment
- Chrome Version:
- Extension Version:
- OS:
```

---

## Deliverables Checklist

| Item | Status |
|------|--------|
| All P0 tests passed | [ ] |
| All P1 tests passed | [ ] |
| P2 tests reviewed | [ ] |
| Bug reports filed (if any) | [ ] |
| Test results documented | [ ] |

---

## Next Steps

Once all P0/P1 tests pass, proceed to:
→ **Phase 5: Documentation & Cleanup** - Final documentation and release prep

---

**Document History:**
- v1.0 (2026-02-09): Initial spec created

