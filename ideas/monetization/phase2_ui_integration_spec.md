# Phase 2: UI Integration - Detailed Specification

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for Execution  
**Parent Spec:** [auth_infrastructure_spec.md](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/auth_infrastructure_spec.md)  
**Prerequisite:** [Phase 1 Completed](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/phase1_core_services_spec.md)  
**Estimated Time:** 4-5 hours

---

## Overview

This phase creates the user interface for authentication in the Options page. By the end of this phase, you will have:
- Account tab in Options navigation
- Sign-in/Sign-out UI
- User profile display
- Responsive styling

---

## Prerequisites

Before starting, ensure Phase 1 is complete:
- [ ] `lib/supabase_client.js` exists
- [ ] `services/auth_service.js` exists
- [ ] `services/auth_cache_service.js` exists
- [ ] `manifest.json` has `identity` permission

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `options.html` | MODIFY | Add Account tab + panel |
| `options.js` | MODIFY | Add auth UI logic |
| `ui_shared.css` | MODIFY | Add auth component styles |

---

## Step 1: Add Account Tab Navigation (15 min)

### 1.1 Find Navigation Section in `options.html`

Look for the existing tab buttons (e.g., Settings, About, etc.)

### 1.2 Add Account Tab Button

Add this button to the navigation section:

```html
<!-- Account Tab - Add after other nav-tabs -->
<button class="nav-tab" data-tab="account">
  <span class="nav-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </span>
  <span data-i18n="opt_tab_account">Account</span>
</button>
```

---

## Step 2: Add Account Panel (45 min)

### 2.1 Add Panel HTML

Add this after other `tab-panel` divs in `options.html`:

```html
<!-- ============================================== -->
<!-- ACCOUNT PANEL -->
<!-- ============================================== -->
<div id="panel-account" class="tab-panel">
  
  <!-- Panel Header -->
  <h2 class="panel-title">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
    <span data-i18n="opt_account_title">Account</span>
  </h2>

  <!-- ========== LOGGED OUT STATE ========== -->
  <div id="auth-logged-out" class="auth-section">
    <div class="auth-hero">
      <div class="auth-hero-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <h3 class="auth-hero-title" data-i18n="opt_account_signin_title">
        Sign in to AmoNexus
      </h3>
      <p class="auth-hero-desc" data-i18n="opt_account_signin_desc">
        Sign in to sync your data across devices and unlock Pro features.
      </p>
      
      <!-- Google Sign In Button -->
      <button id="btn-google-signin" class="btn-google-signin">
        <svg class="google-icon" width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span data-i18n="opt_account_signin_google">Sign in with Google</span>
      </button>
      
      <!-- Remember Me Checkbox -->
      <label class="auth-remember-me">
        <input type="checkbox" id="auth-remember-me" checked>
        <span class="checkmark"></span>
        <span data-i18n="opt_account_remember_me">Remember me for 7 days</span>
      </label>
    </div>
    
    <!-- Privacy Note -->
    <div class="auth-privacy-note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
      <span data-i18n="opt_account_privacy_note">
        We only use your email for account management. Your data stays on your device.
      </span>
    </div>
  </div>

  <!-- ========== LOGGED IN STATE ========== -->
  <div id="auth-logged-in" class="auth-section" style="display: none;">
    
    <!-- User Profile Card -->
    <div class="user-profile-card">
      <img id="user-avatar" 
           src="icons/default-avatar.png" 
           alt="User avatar" 
           class="user-avatar"
           onerror="this.src='icons/default-avatar.png'">
      <div class="user-info">
        <span id="user-name" class="user-name">User Name</span>
        <span id="user-email" class="user-email">email@example.com</span>
        <span id="user-plan-badge" class="plan-badge plan-free">Free</span>
      </div>
    </div>

    <!-- Subscription Info (for Pro users) -->
    <div id="subscription-info" class="subscription-info" style="display: none;">
      <div class="subscription-status">
        <span class="status-label">Status:</span>
        <span id="subscription-status" class="status-value">Active</span>
      </div>
      <div class="subscription-renew">
        <span class="renew-label">Renews:</span>
        <span id="subscription-renew-date" class="renew-value">-</span>
      </div>
    </div>

    <!-- Account Actions -->
    <div class="account-actions">
      <!-- Upgrade Button (Free users only) -->
      <button id="btn-upgrade-pro" class="btn-action btn-upgrade">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span data-i18n="opt_account_upgrade">Upgrade to Pro</span>
      </button>
      
      <!-- Manage Subscription (Pro users only) -->
      <button id="btn-manage-subscription" class="btn-action btn-manage" style="display: none;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
        <span data-i18n="opt_account_manage">Manage Subscription</span>
      </button>
      
      <!-- Sign Out Button -->
      <button id="btn-signout" class="btn-action btn-signout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span data-i18n="opt_account_signout">Sign Out</span>
      </button>
    </div>

    <!-- Sync Status -->
    <div class="sync-status-card">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span data-i18n="opt_account_sync_info">
        Your settings are stored locally. Cloud sync coming soon!
      </span>
    </div>
  </div>

  <!-- ========== LOADING STATE ========== -->
  <div id="auth-loading" class="auth-section" style="display: none;">
    <div class="auth-loading-spinner">
      <div class="spinner"></div>
      <span data-i18n="opt_account_loading">Loading...</span>
    </div>
  </div>

  <!-- ========== ERROR STATE ========== -->
  <div id="auth-error" class="auth-section" style="display: none;">
    <div class="auth-error-card">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h4 data-i18n="opt_account_error_title">Something went wrong</h4>
      <p id="auth-error-message" class="error-message"></p>
      <button id="btn-retry-signin" class="btn-action btn-retry">
        <span data-i18n="opt_account_retry">Try Again</span>
      </button>
    </div>
  </div>
</div>
```

---

## Step 3: Add CSS Styles (60 min)

### 3.1 Add to `ui_shared.css` (or inline in options.html)

```css
/* ============================================= */
/* AUTH UI COMPONENTS */
/* ============================================= */

/* Auth Sections */
.auth-section {
  padding: 1.5rem;
}

/* Hero Section (Logged Out) */
.auth-hero {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, 
    var(--bg-secondary, #f8fafc) 0%, 
    var(--bg-primary, #ffffff) 100%);
  border-radius: 16px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.auth-hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  margin-bottom: 1.5rem;
}

.auth-hero-icon svg {
  stroke: white;
}

.auth-hero-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #1a202c);
  margin-bottom: 0.5rem;
}

.auth-hero-desc {
  color: var(--text-secondary, #64748b);
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

/* Google Sign In Button */
.btn-google-signin {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #3c4043;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.btn-google-signin:hover {
  background: #f8f9fa;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}

.btn-google-signin:active {
  background: #f1f3f4;
}

.btn-google-signin:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-google-signin .google-icon {
  flex-shrink: 0;
}

/* Remember Me Checkbox */
.auth-remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 1rem;
  font-size: 14px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  justify-content: center;
}

.auth-remember-me input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #667eea;
}

/* Privacy Note */
.auth-privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 1.5rem;
  padding: 12px 16px;
  background: var(--bg-secondary, #f1f5f9);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted, #94a3b8);
}

.auth-privacy-note svg {
  flex-shrink: 0;
  margin-top: 2px;
}

/* ============================================= */
/* USER PROFILE CARD */
/* ============================================= */

.user-profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.user-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #1a202c);
}

.user-email {
  font-size: 14px;
  color: var(--text-secondary, #64748b);
}

/* Plan Badge */
.plan-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
  width: fit-content;
}

.plan-badge.plan-free {
  background: #e2e8f0;
  color: #64748b;
}

.plan-badge.plan-pro {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #78350f;
}

/* ============================================= */
/* SUBSCRIPTION INFO */
/* ============================================= */

.subscription-info {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 8px;
  margin-top: 16px;
}

.subscription-status,
.subscription-renew {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-label,
.renew-label {
  font-size: 12px;
  color: #92400e;
}

.status-value,
.renew-value {
  font-size: 14px;
  font-weight: 600;
  color: #78350f;
}

/* ============================================= */
/* ACCOUNT ACTIONS */
/* ============================================= */

.account-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-upgrade {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-upgrade:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-manage {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #1a202c);
  border: 1px solid var(--border-color, #e2e8f0);
}

.btn-manage:hover {
  background: var(--bg-tertiary, #e2e8f0);
}

.btn-signout {
  background: transparent;
  color: #ef4444;
  border: 1px solid #fecaca;
}

.btn-signout:hover {
  background: #fef2f2;
  border-color: #f87171;
}

.btn-retry {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #1a202c);
}

/* ============================================= */
/* SYNC STATUS CARD */
/* ============================================= */

.sync-status-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 14px 16px;
  background: #eff6ff;
  border-radius: 8px;
  font-size: 13px;
  color: #1e40af;
}

.sync-status-card svg {
  flex-shrink: 0;
  stroke: #3b82f6;
}

/* ============================================= */
/* LOADING STATE */
/* ============================================= */

.auth-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color, #e2e8f0);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ============================================= */
/* ERROR STATE */
/* ============================================= */

.auth-error-card {
  text-align: center;
  padding: 2rem;
}

.auth-error-card svg {
  stroke: #ef4444;
  margin-bottom: 1rem;
}

.auth-error-card h4 {
  color: var(--text-primary, #1a202c);
  margin-bottom: 0.5rem;
}

.error-message {
  color: #ef4444;
  margin-bottom: 1rem;
}

/* ============================================= */
/* DARK MODE SUPPORT */
/* ============================================= */

@media (prefers-color-scheme: dark) {
  .auth-hero {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-color: #334155;
  }
  
  .btn-google-signin {
    background: #1e293b;
    border-color: #475569;
    color: #e2e8f0;
  }
  
  .btn-google-signin:hover {
    background: #334155;
  }
  
  .user-profile-card {
    background: #1e293b;
    border-color: #334155;
  }
  
  .plan-badge.plan-free {
    background: #334155;
    color: #94a3b8;
  }
  
  .sync-status-card {
    background: #1e3a5f;
    color: #93c5fd;
  }
}
```

---

## Step 4: Add JavaScript Logic (90 min)

### 4.1 Add to `options.js`

Add at the top of the file (imports):

```javascript
// Auth imports
import { 
  signInWithGoogle, 
  signOut, 
  getAuthState, 
  onAuthStateChange,
  isAuthenticated 
} from './services/auth_service.js';
```

### 4.2 Add Auth UI Functions

Add these functions to `options.js`:

```javascript
// ============================================= 
// AUTH UI - State Management
// =============================================

const AUTH_UI_STATES = {
  LOADING: 'loading',
  LOGGED_OUT: 'logged-out',
  LOGGED_IN: 'logged-in',
  ERROR: 'error'
};

/**
 * Initialize authentication UI
 */
async function initAuthUI() {
  console.log('[ATOM Options] Initializing auth UI...');
  
  // Show loading state initially
  setAuthUIState(AUTH_UI_STATES.LOADING);
  
  try {
    // Get current auth state
    const authState = await getAuthState();
    
    if (authState.isAuthenticated) {
      updateLoggedInUI(authState);
      setAuthUIState(AUTH_UI_STATES.LOGGED_IN);
    } else {
      setAuthUIState(AUTH_UI_STATES.LOGGED_OUT);
    }
    
    // Set up event listeners
    setupAuthEventListeners();
    
    // Listen for auth state changes
    onAuthStateChange((event, data) => {
      console.log('[ATOM Options] Auth state changed:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        updateLoggedInUI(data);
        setAuthUIState(AUTH_UI_STATES.LOGGED_IN);
      } else if (event === 'SIGNED_OUT') {
        setAuthUIState(AUTH_UI_STATES.LOGGED_OUT);
      }
    });
    
  } catch (error) {
    console.error('[ATOM Options] Auth init error:', error);
    showAuthError('Failed to load account information.');
  }
}

/**
 * Set the visible auth UI state
 * @param {string} state - One of AUTH_UI_STATES
 */
function setAuthUIState(state) {
  const sections = {
    'loading': document.getElementById('auth-loading'),
    'logged-out': document.getElementById('auth-logged-out'),
    'logged-in': document.getElementById('auth-logged-in'),
    'error': document.getElementById('auth-error')
  };
  
  // Hide all sections
  Object.values(sections).forEach(el => {
    if (el) el.style.display = 'none';
  });
  
  // Show the requested section
  const targetSection = sections[state];
  if (targetSection) {
    targetSection.style.display = 'block';
  }
}

/**
 * Update UI with logged-in user data
 * @param {Object} authState 
 */
function updateLoggedInUI(authState) {
  // User info
  const avatarEl = document.getElementById('user-avatar');
  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const badgeEl = document.getElementById('user-plan-badge');
  
  if (avatarEl && authState.user?.avatarUrl) {
    avatarEl.src = authState.user.avatarUrl;
  }
  
  if (nameEl) {
    nameEl.textContent = authState.user?.displayName || 'User';
  }
  
  if (emailEl) {
    emailEl.textContent = authState.user?.email || '';
  }
  
  // Plan badge
  if (badgeEl) {
    if (authState.isPro) {
      badgeEl.textContent = 'Pro ⭐';
      badgeEl.className = 'plan-badge plan-pro';
    } else {
      badgeEl.textContent = 'Free';
      badgeEl.className = 'plan-badge plan-free';
    }
  }
  
  // Show/hide buttons based on plan
  const upgradeBtn = document.getElementById('btn-upgrade-pro');
  const manageBtn = document.getElementById('btn-manage-subscription');
  const subscriptionInfo = document.getElementById('subscription-info');
  
  if (authState.isPro) {
    if (upgradeBtn) upgradeBtn.style.display = 'none';
    if (manageBtn) manageBtn.style.display = 'flex';
    if (subscriptionInfo) {
      subscriptionInfo.style.display = 'flex';
      // Update subscription details
      const statusEl = document.getElementById('subscription-status');
      const renewEl = document.getElementById('subscription-renew-date');
      if (statusEl) statusEl.textContent = authState.subscriptionStatus || 'Active';
      if (renewEl && authState.profile?.subscription_end_date) {
        renewEl.textContent = new Date(authState.profile.subscription_end_date).toLocaleDateString();
      }
    }
  } else {
    if (upgradeBtn) upgradeBtn.style.display = 'flex';
    if (manageBtn) manageBtn.style.display = 'none';
    if (subscriptionInfo) subscriptionInfo.style.display = 'none';
  }
}

/**
 * Show error state with message
 * @param {string} message 
 */
function showAuthError(message) {
  const errorMsgEl = document.getElementById('auth-error-message');
  if (errorMsgEl) {
    errorMsgEl.textContent = message;
  }
  setAuthUIState(AUTH_UI_STATES.ERROR);
}

// =============================================
// AUTH UI - Event Listeners
// =============================================

function setupAuthEventListeners() {
  // Google Sign In button
  const signInBtn = document.getElementById('btn-google-signin');
  if (signInBtn) {
    signInBtn.addEventListener('click', handleGoogleSignIn);
  }
  
  // Sign Out button
  const signOutBtn = document.getElementById('btn-signout');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', handleSignOut);
  }
  
  // Upgrade button
  const upgradeBtn = document.getElementById('btn-upgrade-pro');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', handleUpgrade);
  }
  
  // Manage subscription button
  const manageBtn = document.getElementById('btn-manage-subscription');
  if (manageBtn) {
    manageBtn.addEventListener('click', handleManageSubscription);
  }
  
  // Retry button
  const retryBtn = document.getElementById('btn-retry-signin');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      setAuthUIState(AUTH_UI_STATES.LOGGED_OUT);
    });
  }
}

/**
 * Handle Google sign-in button click
 */
async function handleGoogleSignIn() {
  const btn = document.getElementById('btn-google-signin');
  const rememberMe = document.getElementById('auth-remember-me')?.checked ?? true;
  
  try {
    // Disable button and show loading
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>
        <span>${chrome.i18n.getMessage('opt_account_signing_in') || 'Signing in...'}</span>
      `;
    }
    
    // Attempt sign in
    const result = await signInWithGoogle(rememberMe);
    
    if (result.success) {
      updateLoggedInUI(result.authState);
      setAuthUIState(AUTH_UI_STATES.LOGGED_IN);
      showToast(chrome.i18n.getMessage('opt_account_signin_success') || 'Signed in successfully!', 'success');
    } else {
      showAuthError(result.error);
    }
    
  } catch (error) {
    console.error('[ATOM Options] Sign in error:', error);
    showAuthError(error.message || 'Sign in failed.');
  } finally {
    // Restore button
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="google-icon" width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>${chrome.i18n.getMessage('opt_account_signin_google') || 'Sign in with Google'}</span>
      `;
    }
  }
}

/**
 * Handle sign-out button click
 */
async function handleSignOut() {
  const btn = document.getElementById('btn-signout');
  
  try {
    if (btn) btn.disabled = true;
    
    const result = await signOut();
    
    if (result.success) {
      setAuthUIState(AUTH_UI_STATES.LOGGED_OUT);
      showToast(chrome.i18n.getMessage('opt_account_signout_success') || 'Signed out', 'success');
    }
    
  } catch (error) {
    console.error('[ATOM Options] Sign out error:', error);
    showToast('Sign out failed', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Handle upgrade button click
 */
function handleUpgrade() {
  // TODO: Open upgrade page (Phase 3 - Payment)
  console.log('[ATOM Options] Upgrade clicked');
  showToast('Pro upgrade coming soon!', 'info');
}

/**
 * Handle manage subscription click
 */
function handleManageSubscription() {
  // TODO: Open Lemon Squeezy customer portal (Phase 3 - Payment)
  console.log('[ATOM Options] Manage subscription clicked');
  showToast('Subscription management coming soon!', 'info');
}
```

### 4.3 Call initAuthUI on DOMContentLoaded

Find the `DOMContentLoaded` event listener and add:

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing initialization code ...
  
  // Initialize auth UI
  await initAuthUI();
});
```

---

## Step 5: Add Default Avatar (5 min)

Create or download a default avatar image:
- Save as `icons/default-avatar.png`
- Size: 128x128 pixels
- Simple user silhouette or placeholder

You can use this SVG converted to PNG:
```xml
<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <circle cx="64" cy="64" r="64" fill="#e2e8f0"/>
  <circle cx="64" cy="50" r="24" fill="#94a3b8"/>
  <ellipse cx="64" cy="110" rx="40" ry="30" fill="#94a3b8"/>
</svg>
```

---

## Deliverables Checklist

| Item | File | Status |
|------|------|--------|
| Account tab button | `options.html` | [ ] |
| Account panel (logged-out) | `options.html` | [ ] |
| Account panel (logged-in) | `options.html` | [ ] |
| Account panel (loading) | `options.html` | [ ] |
| Account panel (error) | `options.html` | [ ] |
| Auth CSS styles | `ui_shared.css` | [ ] |
| Auth UI functions | `options.js` | [ ] |
| Event listeners | `options.js` | [ ] |
| Default avatar | `icons/default-avatar.png` | [ ] |

---

## Verification

### Visual Tests
1. [ ] Open Options page → Account tab visible in navigation
2. [ ] Click Account tab → Logged-out state shows sign-in hero
3. [ ] Remember me checkbox is checked by default
4. [ ] Privacy note is visible below sign-in button

### Interaction Tests
1. [ ] Click "Sign in with Google" → Button shows loading spinner
2. [ ] Close OAuth popup → Button returns to normal state
3. [ ] Complete sign-in → UI switches to logged-in state
4. [ ] Click "Sign Out" → UI returns to logged-out state

### Responsive Tests
1. [ ] Resize window → UI adapts (no horizontal scroll)
2. [ ] Enable dark mode → Colors adapt appropriately

---

## Next Steps

Once all checkboxes are verified, proceed to:
→ **Phase 3: i18n & Localization** - Add EN/VI translations

---

**Document History:**
- v1.0 (2026-02-09): Initial spec created

