/**
 * Authentication Cache Service
 * 
 * @fileoverview Manages caching of authentication state using chrome.storage.local
 * Provides offline-resilient auth state with configurable TTL.
 */

import { DEBUG_MODE } from '../config/supabase_config.js';

// Cache keys
const CACHE_KEYS = {
    AUTH_STATE: 'atom_auth_cache',
    USER_PROFILE: 'atom_user_profile'
};

// TTL values in milliseconds
const TTL = {
    DEFAULT: 24 * 60 * 60 * 1000,      // 24 hours
    REMEMBER_ME: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Cache authentication state
 * @param {Object} authState - Auth state to cache
 * @param {boolean} authState.isAuthenticated - Whether user is authenticated
 * @param {Object} authState.user - User info (id, email, displayName, avatarUrl)
 * @param {boolean} authState.isPro - Whether user is Pro subscriber
 * @param {boolean} rememberMe - Whether to use extended TTL (7 days)
 * @returns {Promise<void>}
 */
export async function cacheAuthState(authState, rememberMe = true) {
    const ttl = rememberMe ? TTL.REMEMBER_ME : TTL.DEFAULT;
    const now = Date.now();

    const cacheData = {
        ...authState,
        cached_at: now,
        ttl: ttl,
        expires_at: now + ttl,
        remember_me: rememberMe
    };

    try {
        await chrome.storage.local.set({ [CACHE_KEYS.AUTH_STATE]: cacheData });
        if (DEBUG_MODE) console.log('[Auth Cache] State cached, expires:', new Date(cacheData.expires_at));
    } catch (error) {
        console.error('[Auth Cache] Failed to cache state:', error);
    }
}

/**
 * Get cached authentication state
 * @returns {Promise<Object|null>} Cached auth state or null if not found/expired
 */
export async function getCachedAuthState() {
    try {
        const result = await chrome.storage.local.get(CACHE_KEYS.AUTH_STATE);
        const cached = result[CACHE_KEYS.AUTH_STATE];

        if (!cached) {
            if (DEBUG_MODE) console.log('[Auth Cache] No cached state found');
            return null;
        }

        // Check if expired
        const isExpired = Date.now() > cached.expires_at;
        if (isExpired) {
            if (DEBUG_MODE) console.log('[Auth Cache] Cache expired at:', new Date(cached.expires_at));
            cached.expired = true;
        }

        return cached;
    } catch (error) {
        console.error('[Auth Cache] Failed to get cached state:', error);
        return null;
    }
}

/**
 * Check if cached auth state is valid (exists and not expired)
 * @returns {Promise<boolean>}
 */
export async function isCacheValid() {
    const cached = await getCachedAuthState();
    return cached !== null && !cached.expired;
}

/**
 * Clear authentication cache
 * @returns {Promise<void>}
 */
export async function clearAuthCache() {
    try {
        await chrome.storage.local.remove([CACHE_KEYS.AUTH_STATE, CACHE_KEYS.USER_PROFILE]);
        if (DEBUG_MODE) console.log('[Auth Cache] Cache cleared');
    } catch (error) {
        console.error('[Auth Cache] Failed to clear cache:', error);
    }
}

/**
 * Update specific fields in cached auth state
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateCachedAuthState(updates) {
    const cached = await getCachedAuthState();
    if (cached) {
        const updated = { ...cached, ...updates };
        await chrome.storage.local.set({ [CACHE_KEYS.AUTH_STATE]: updated });
        if (DEBUG_MODE) console.log('[Auth Cache] State updated:', Object.keys(updates));
    }
}

/**
 * Get remaining TTL in milliseconds
 * @returns {Promise<number>} Remaining TTL or 0 if expired/not cached
 */
export async function getRemainingTTL() {
    const cached = await getCachedAuthState();
    if (!cached) return 0;

    const remaining = cached.expires_at - Date.now();
    return Math.max(0, remaining);
}
