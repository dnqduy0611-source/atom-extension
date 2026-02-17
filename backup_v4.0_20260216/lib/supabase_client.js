/**
 * Supabase Client for Chrome Extension (MV3 Compatible)
 * 
 * @fileoverview Initializes Supabase client with a custom storage adapter
 * that uses chrome.storage.local instead of localStorage (which is not
 * available in MV3 service workers).
 * 
 * Uses locally bundled supabase.min.js to avoid CSP issues with external CDNs.
 */

import { SUPABASE_CONFIG, DEBUG_MODE } from '../config/supabase_config.js';

// Wait for supabase global to be available (loaded via script tag)
function getSupabaseLib() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        return supabase;
    }
    // Fallback: check window object
    if (typeof window !== 'undefined' && window.supabase) {
        return window.supabase;
    }
    throw new Error('Supabase library not loaded. Make sure supabase.min.js is included in the page.');
}

/**
 * Custom storage adapter for Chrome Extension MV3
 * Uses chrome.storage.local instead of localStorage
 */
const chromeStorageAdapter = {
    getItem: async (key) => {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] ?? null;
        } catch (error) {
            if (DEBUG_MODE) console.error('[Supabase Storage] getItem error:', error);
            return null;
        }
    },

    setItem: async (key, value) => {
        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            if (DEBUG_MODE) console.error('[Supabase Storage] setItem error:', error);
        }
    },

    removeItem: async (key) => {
        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            if (DEBUG_MODE) console.error('[Supabase Storage] removeItem error:', error);
        }
    }
};

// Lazy initialization of client
let _supabaseClient = null;

/**
 * Get or create the Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabaseClient() {
    if (_supabaseClient) {
        return _supabaseClient;
    }

    const lib = getSupabaseLib();
    _supabaseClient = lib.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
        auth: {
            storage: chromeStorageAdapter,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
            flowType: 'implicit' // Match auth_service.js token extraction logic
        }
    });

    if (DEBUG_MODE) {
        console.log('[Supabase] Client initialized with custom storage adapter');
    }

    return _supabaseClient;
}

// Export a getter for the client (for compatibility)
export const supabaseClient = {
    get client() {
        return getSupabaseClient();
    }
};

// Alias for backward compatibility
export { getSupabaseClient as supabase };
