# Phase 1: Core Services - Detailed Specification

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for Execution  
**Parent Spec:** [auth_infrastructure_spec.md](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/auth_infrastructure_spec.md)  
**Prerequisite:** [Phase 0 Completed](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/phase0_external_setup_spec.md)  
**Estimated Time:** 4-6 hours

---

## Overview

This phase creates the core JavaScript services for authentication. By the end of this phase, you will have:
- Supabase client configured for Chrome Extension MV3
- Auth service with Google sign-in/sign-out
- Cache service for offline support
- Updated manifest.json with required permissions

---

## Prerequisites

Before starting, ensure you have from Phase 0:
- [ ] `SUPABASE_URL` 
- [ ] `SUPABASE_ANON_KEY`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `EXTENSION_ID`

---

## File Structure

After this phase, you will have these new files:

```
ATOM_Extension_V2.8_public/
├── config/
│   └── supabase_config.js       # [NEW] Credentials (gitignored)
├── lib/
│   └── supabase_client.js       # [NEW] Supabase initialization
├── services/
│   ├── auth_service.js          # [NEW] Authentication logic
│   └── auth_cache_service.js    # [NEW] Auth state caching
├── manifest.json                # [MODIFY] Add identity permission
└── .gitignore                   # [MODIFY] Add config file
```

---

## Step 1: Create Config File (10 min)

### 1.1 Create `config/supabase_config.js`

```javascript
/**
 * Supabase Configuration
 * 
 * ⚠️ IMPORTANT: This file contains sensitive credentials.
 * DO NOT commit this file to version control!
 * 
 * @file config/supabase_config.js
 */

export const SUPABASE_CONFIG = {
  // Get these from Supabase Dashboard → Settings → API
  URL: 'https://YOUR_PROJECT_ID.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

export const GOOGLE_CONFIG = {
  // Get this from Google Cloud Console → Credentials
  CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com'
};

export const AUTH_CONFIG = {
  // Cache TTL settings
  REMEMBER_ME_TTL: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
  DEFAULT_TTL: 24 * 60 * 60 * 1000,           // 24 hours in ms
  
  // Session settings
  MAX_SESSIONS: 5,
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_CACHE: 'atom_auth_cache',
    USER_PROFILE: 'atom_user_profile',
    SESSION: 'supabase.auth.token'
  }
};
```

### 1.2 Update `.gitignore`

Add this line to `.gitignore`:
```
# Supabase credentials (sensitive)
config/supabase_config.js
```

### 1.3 Create Template File

Create `config/supabase_config.template.js` (safe to commit):

```javascript
/**
 * Supabase Configuration Template
 * 
 * Copy this file to supabase_config.js and fill in your values.
 * The actual config file is gitignored for security.
 */

export const SUPABASE_CONFIG = {
  URL: 'https://YOUR_PROJECT_ID.supabase.co',
  ANON_KEY: 'YOUR_ANON_KEY'
};

export const GOOGLE_CONFIG = {
  CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com'
};

export const AUTH_CONFIG = {
  REMEMBER_ME_TTL: 7 * 24 * 60 * 60 * 1000,
  DEFAULT_TTL: 24 * 60 * 60 * 1000,
  MAX_SESSIONS: 5,
  STORAGE_KEYS: {
    AUTH_CACHE: 'atom_auth_cache',
    USER_PROFILE: 'atom_user_profile',
    SESSION: 'supabase.auth.token'
  }
};
```

**Verification:**
- [ ] `config/supabase_config.js` exists with real values
- [ ] `config/supabase_config.template.js` exists (for other developers)
- [ ] `.gitignore` includes `config/supabase_config.js`

---

## Step 2: Create Supabase Client (30 min)

### 2.1 Install Supabase SDK (Option A: Bundle)

Since Chrome Extensions can't use npm directly, we'll use a bundled version.

**Option A: Download from CDN**
```bash
# Download the UMD bundle
curl -o lib/supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
```

**Option B: Use ES Module import (recommended for MV3)**

In `lib/supabase_client.js`, we'll use dynamic import from CDN.

### 2.2 Create `lib/supabase_client.js`

```javascript
/**
 * Supabase Client for Chrome Extension MV3
 * 
 * Provides a Supabase client with custom storage adapter
 * that uses chrome.storage.local instead of localStorage.
 * 
 * @file lib/supabase_client.js
 */

import { SUPABASE_CONFIG, AUTH_CONFIG } from '../config/supabase_config.js';

// ============================================================
// MV3 Storage Adapter
// ============================================================

/**
 * Custom storage adapter for Chrome Extension MV3.
 * Supabase normally uses localStorage, which doesn't exist
 * in Service Workers. This adapter uses chrome.storage.local.
 */
const chromeStorageAdapter = {
  /**
   * Get item from storage
   * @param {string} key 
   * @returns {Promise<string|null>}
   */
  getItem: async (key) => {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error('[Supabase Storage] getItem error:', error);
      return null;
    }
  },

  /**
   * Set item in storage
   * @param {string} key 
   * @param {string} value 
   */
  setItem: async (key, value) => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('[Supabase Storage] setItem error:', error);
    }
  },

  /**
   * Remove item from storage
   * @param {string} key 
   */
  removeItem: async (key) => {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('[Supabase Storage] removeItem error:', error);
    }
  }
};

// ============================================================
// Supabase Client Initialization
// ============================================================

let supabaseClient = null;

/**
 * Initialize and get Supabase client (singleton)
 * @returns {Promise<SupabaseClient>}
 */
export async function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Dynamic import of Supabase (works in MV3)
  const { createClient } = await import(
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
  );

  supabaseClient = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false  // Not applicable for extensions
    }
  });

  console.log('[ATOM Supabase] Client initialized');
  return supabaseClient;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get current session
 * @returns {Promise<Session|null>}
 */
export async function getSession() {
  const supabase = await getSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('[ATOM Supabase] getSession error:', error);
    return null;
  }
  
  return session;
}

/**
 * Get current user
 * @returns {Promise<User|null>}
 */
export async function getUser() {
  const supabase = await getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('[ATOM Supabase] getUser error:', error);
    return null;
  }
  
  return user;
}

/**
 * Query profiles table
 * @param {string} userId 
 * @returns {Promise<Profile|null>}
 */
export async function getProfile(userId) {
  const supabase = await getSupabaseClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[ATOM Supabase] getProfile error:', error);
    return null;
  }

  return data;
}
```

**Verification:**
- [ ] File created at `lib/supabase_client.js`
- [ ] Imports work (check for syntax errors)

---

## Step 3: Create Cache Service (30 min)

### 3.1 Create `services/auth_cache_service.js`

```javascript
/**
 * Auth Cache Service
 * 
 * Manages caching of authentication state for offline support
 * and performance optimization.
 * 
 * @file services/auth_cache_service.js
 */

import { AUTH_CONFIG } from '../config/supabase_config.js';

const { STORAGE_KEYS, REMEMBER_ME_TTL, DEFAULT_TTL } = AUTH_CONFIG;

// ============================================================
// Types (JSDoc for documentation)
// ============================================================

/**
 * @typedef {Object} CachedAuthState
 * @property {boolean} isAuthenticated
 * @property {Object|null} user
 * @property {Object|null} profile
 * @property {boolean} isPro
 * @property {string} subscriptionStatus
 * @property {boolean} rememberMe
 * @property {number} cached_at - Timestamp when cached
 * @property {number} expires_at - Timestamp when cache expires
 * @property {boolean} [expired] - Added when checking cache
 */

// ============================================================
// Cache Operations
// ============================================================

/**
 * Cache auth state with TTL
 * @param {Object} authState - Auth state to cache
 * @param {boolean} rememberMe - Use extended TTL
 * @returns {Promise<void>}
 */
export async function cacheAuthState(authState, rememberMe = true) {
  const ttl = rememberMe ? REMEMBER_ME_TTL : DEFAULT_TTL;
  const now = Date.now();

  const cacheData = {
    ...authState,
    rememberMe,
    cached_at: now,
    expires_at: now + ttl
  };

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_CACHE]: cacheData
    });

    const expiryDate = new Date(cacheData.expires_at).toLocaleString();
    console.log(`[ATOM Cache] Auth state cached. Expires: ${expiryDate}`);
  } catch (error) {
    console.error('[ATOM Cache] Failed to cache auth state:', error);
  }
}

/**
 * Get cached auth state
 * @returns {Promise<CachedAuthState|null>}
 */
export async function getCachedAuthState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_CACHE);
    const cached = result[STORAGE_KEYS.AUTH_CACHE];

    if (!cached) {
      console.log('[ATOM Cache] No cached auth state found');
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > cached.expires_at) {
      console.log('[ATOM Cache] Auth cache expired');
      cached.expired = true;
    } else {
      cached.expired = false;
    }

    return cached;
  } catch (error) {
    console.error('[ATOM Cache] Failed to get cached auth state:', error);
    return null;
  }
}

/**
 * Clear all auth-related cache
 * @returns {Promise<void>}
 */
export async function clearAuthCache() {
  try {
    await chrome.storage.local.remove([
      STORAGE_KEYS.AUTH_CACHE,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.SESSION,
      // Also clear any Supabase internal keys
      'sb-' + new URL(SUPABASE_CONFIG?.URL || '').hostname.split('.')[0] + '-auth-token'
    ]);

    console.log('[ATOM Cache] Auth cache cleared');
  } catch (error) {
    console.error('[ATOM Cache] Failed to clear cache:', error);
  }
}

/**
 * Check if cache is valid (exists and not expired)
 * @returns {Promise<boolean>}
 */
export async function isCacheValid() {
  const cached = await getCachedAuthState();
  return cached !== null && !cached.expired;
}

/**
 * Get time remaining until cache expires
 * @returns {Promise<number>} Milliseconds until expiry, or 0 if expired/no cache
 */
export async function getCacheTimeRemaining() {
  const cached = await getCachedAuthState();
  if (!cached || cached.expired) {
    return 0;
  }
  return Math.max(0, cached.expires_at - Date.now());
}

/**
 * Update specific fields in cached auth state
 * @param {Partial<CachedAuthState>} updates 
 * @returns {Promise<void>}
 */
export async function updateCachedAuthState(updates) {
  const cached = await getCachedAuthState();
  if (!cached) {
    console.warn('[ATOM Cache] Cannot update: no cached state exists');
    return;
  }

  const updated = {
    ...cached,
    ...updates,
    cached_at: Date.now() // Refresh cache timestamp
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTH_CACHE]: updated
  });

  console.log('[ATOM Cache] Auth state updated');
}
```

**Verification:**
- [ ] File created at `services/auth_cache_service.js`
- [ ] No syntax errors

---

## Step 4: Create Auth Service (60 min)

### 4.1 Create `services/auth_service.js`

```javascript
/**
 * Authentication Service
 * 
 * Handles user authentication via Google OAuth using Supabase Auth.
 * Designed for Chrome Extension Manifest V3.
 * 
 * @file services/auth_service.js
 */

import { getSupabaseClient, getSession, getUser, getProfile } from '../lib/supabase_client.js';
import { cacheAuthState, getCachedAuthState, clearAuthCache } from './auth_cache_service.js';
import { GOOGLE_CONFIG } from '../config/supabase_config.js';

// ============================================================
// Types (JSDoc)
// ============================================================

/**
 * @typedef {Object} AuthState
 * @property {boolean} isAuthenticated
 * @property {Object|null} user
 * @property {Object|null} profile
 * @property {boolean} isPro
 * @property {string} subscriptionStatus
 */

/**
 * @typedef {Object} SignInResult
 * @property {boolean} success
 * @property {AuthState|null} authState
 * @property {string|null} error
 */

// ============================================================
// Sign In
// ============================================================

/**
 * Sign in with Google OAuth
 * Uses chrome.identity.launchWebAuthFlow for secure OAuth in extension
 * 
 * @param {boolean} rememberMe - Keep user signed in for 7 days
 * @returns {Promise<SignInResult>}
 */
export async function signInWithGoogle(rememberMe = true) {
  try {
    console.log('[ATOM Auth] Starting Google sign-in...');
    
    const supabase = await getSupabaseClient();

    // Step 1: Get OAuth URL from Supabase
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chrome.identity.getRedirectURL(),
        skipBrowserRedirect: true  // We handle redirect manually
      }
    });

    if (oauthError) {
      throw new Error(`OAuth init failed: ${oauthError.message}`);
    }

    // Step 2: Launch OAuth popup via chrome.identity
    const authUrl = data.url;
    console.log('[ATOM Auth] Launching OAuth popup...');

    const redirectUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { 
          url: authUrl, 
          interactive: true 
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!responseUrl) {
            reject(new Error('No response URL received'));
          } else {
            resolve(responseUrl);
          }
        }
      );
    });

    console.log('[ATOM Auth] OAuth popup completed');

    // Step 3: Extract tokens from redirect URL
    const url = new URL(redirectUrl);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    // Step 4: Set session in Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }

    console.log('[ATOM Auth] Session established');

    // Step 5: Fetch user profile from database
    const profile = await getProfile(sessionData.user.id);

    // Step 6: Build and cache auth state
    const authState = {
      isAuthenticated: true,
      user: {
        id: sessionData.user.id,
        email: sessionData.user.email,
        displayName: sessionData.user.user_metadata?.full_name || sessionData.user.email?.split('@')[0],
        avatarUrl: sessionData.user.user_metadata?.avatar_url
      },
      profile: profile,
      isPro: profile?.is_pro ?? false,
      subscriptionStatus: profile?.subscription_status ?? 'free'
    };

    await cacheAuthState(authState, rememberMe);

    console.log('[ATOM Auth] Sign-in complete');
    return { success: true, authState, error: null };

  } catch (error) {
    console.error('[ATOM Auth] Sign-in failed:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Sign in failed. Please try again.';
    if (error.message.includes('closed')) {
      errorMessage = 'Sign in cancelled.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Check your internet connection.';
    }

    return { success: false, authState: null, error: errorMessage };
  }
}

// ============================================================
// Sign Out
// ============================================================

/**
 * Sign out current user
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function signOut() {
  try {
    console.log('[ATOM Auth] Signing out...');
    
    const supabase = await getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('[ATOM Auth] Supabase signOut error:', error);
      // Continue anyway - we still want to clear local state
    }

    // Always clear local cache
    await clearAuthCache();

    console.log('[ATOM Auth] Sign-out complete');
    return { success: true, error: null };

  } catch (error) {
    console.error('[ATOM Auth] Sign-out failed:', error);
    
    // Still try to clear cache even if signOut failed
    await clearAuthCache();
    
    return { success: false, error: error.message };
  }
}

// ============================================================
// Get Auth State
// ============================================================

/**
 * Get current authentication state
 * Uses cache if valid, otherwise fetches fresh state
 * 
 * @param {boolean} forceRefresh - Skip cache and fetch fresh
 * @returns {Promise<AuthState>}
 */
export async function getAuthState(forceRefresh = false) {
  // Try cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCachedAuthState();
    if (cached && !cached.expired) {
      console.log('[ATOM Auth] Using cached auth state');
      return cached;
    }
  }

  console.log('[ATOM Auth] Fetching fresh auth state...');

  try {
    // Check for active session
    const session = await getSession();
    
    if (!session) {
      console.log('[ATOM Auth] No active session');
      return {
        isAuthenticated: false,
        user: null,
        profile: null,
        isPro: false,
        subscriptionStatus: 'free'
      };
    }

    // Get user and profile
    const user = session.user;
    const profile = await getProfile(user.id);

    const authState = {
      isAuthenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0],
        avatarUrl: user.user_metadata?.avatar_url
      },
      profile: profile,
      isPro: profile?.is_pro ?? false,
      subscriptionStatus: profile?.subscription_status ?? 'free'
    };

    // Update cache
    const cached = await getCachedAuthState();
    const rememberMe = cached?.rememberMe ?? true;
    await cacheAuthState(authState, rememberMe);

    return authState;

  } catch (error) {
    console.error('[ATOM Auth] Failed to get auth state:', error);
    
    // Fall back to expired cache if available
    const cached = await getCachedAuthState();
    if (cached) {
      console.log('[ATOM Auth] Using expired cache as fallback');
      return cached;
    }

    return {
      isAuthenticated: false,
      user: null,
      profile: null,
      isPro: false,
      subscriptionStatus: 'free'
    };
  }
}

// ============================================================
// Auth State Listener
// ============================================================

/**
 * Listen for auth state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export async function onAuthStateChange(callback) {
  const supabase = await getSupabaseClient();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('[ATOM Auth] Auth state changed:', event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const authState = await getAuthState(true);
        callback(event, authState);
      } else if (event === 'SIGNED_OUT') {
        await clearAuthCache();
        callback(event, { isAuthenticated: false });
      }
    }
  );

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if user is authenticated (quick check)
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const cached = await getCachedAuthState();
  if (cached && !cached.expired) {
    return cached.isAuthenticated;
  }
  
  const session = await getSession();
  return !!session;
}

/**
 * Check if user has Pro subscription
 * @returns {Promise<boolean>}
 */
export async function isPro() {
  const authState = await getAuthState();
  return authState.isPro;
}

/**
 * Refresh auth state (useful after subscription changes)
 * @returns {Promise<AuthState>}
 */
export async function refreshAuthState() {
  return getAuthState(true);
}
```

**Verification:**
- [ ] File created at `services/auth_service.js`
- [ ] No syntax errors

---

## Step 5: Update Manifest (15 min)

### 5.1 Modify `manifest.json`

Add the `identity` permission and `oauth2` config:

```json
{
  "manifest_version": 3,
  "name": "AmoNexus",
  "version": "2.8",
  
  "permissions": [
    "storage",
    "tabs",
    "scripting",
    "alarms",
    "contextMenus",
    "notifications",
    "sidePanel",
    "identity"
  ],
  
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "openid",
      "email",
      "profile"
    ]
  }
}
```

> [!IMPORTANT]
> Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID from Google Cloud Console.

**Verification:**
- [ ] `identity` added to permissions array
- [ ] `oauth2` section added with correct client_id

---

## Step 6: Create lib Directory (5 min)

If `lib/` directory doesn't exist:

```bash
mkdir lib
```

Or create it manually in your file explorer.

---

## Deliverables Checklist

| File | Status | Notes |
|------|--------|-------|
| `config/supabase_config.js` | [ ] | Real credentials, gitignored |
| `config/supabase_config.template.js` | [ ] | Template for other devs |
| `.gitignore` | [ ] | Includes config file |
| `lib/supabase_client.js` | [ ] | MV3 storage adapter |
| `services/auth_cache_service.js` | [ ] | Cache with TTL |
| `services/auth_service.js` | [ ] | Sign in/out + state |
| `manifest.json` | [ ] | identity + oauth2 |

---

## Verification Tests

### Test 1: Config Import
```javascript
// In browser console (background page)
import { SUPABASE_CONFIG } from './config/supabase_config.js';
console.log(SUPABASE_CONFIG.URL);
// Expected: Your Supabase URL
```

### Test 2: Supabase Client Init
```javascript
import { getSupabaseClient } from './lib/supabase_client.js';
const client = await getSupabaseClient();
console.log(client);
// Expected: Supabase client object, no errors
```

### Test 3: Cache Service
```javascript
import { cacheAuthState, getCachedAuthState } from './services/auth_cache_service.js';
await cacheAuthState({ test: true }, true);
const cached = await getCachedAuthState();
console.log(cached);
// Expected: Object with test: true, expires_at, etc.
```

---

## Troubleshooting

### Error: "Cannot find module"
- Check import paths (relative paths must be correct)
- Ensure files exist in correct locations

### Error: "identity permission"
- Reload extension after updating manifest.json
- Check Chrome developer mode is enabled

### Error: "Invalid URL"
- Check SUPABASE_URL ends with `.supabase.co` (no trailing slash)
- Verify credentials in supabase_config.js

---

## Next Steps

Once all tests pass, proceed to:
→ **Phase 2: UI Integration** - Add Account tab to Options page

---

**Document History:**
- v1.0 (2026-02-09): Initial spec created

