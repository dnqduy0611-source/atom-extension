/**
 * Supabase Client for Chrome Extension (MV3 Compatible)
 * 
 * @fileoverview Initializes Supabase client with a custom storage adapter
 * that uses chrome.storage.local instead of localStorage (which is not
 * available in MV3 service workers).
 * 
 * Uses locally bundled supabase.min.js to avoid CSP issues with external CDNs.
 * Supports MV3 module service workers by dynamically loading the UMD bundle.
 */

import { SUPABASE_CONFIG, DEBUG_MODE } from '../config/supabase_config.js';

/**
 * Get the supabase library object.
 * 
 * In MV3 module service workers, supabase.min.js is statically imported via
 * background.js (`import './lib/supabase.min.js'`). That file appends
 * `self.supabase = supabase;` so the library is available on the global scope.
 * 
 * In popup/options pages, it's loaded via a <script> tag.
 */
function getSupabaseLib() {
    // 1. On self (service worker — loaded via static import in background.js)
    if (typeof self !== 'undefined' && self.supabase && self.supabase.createClient) {
        return self.supabase;
    }
    // 2. Already available as global (popup, options pages via <script> tag)
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        return supabase;
    }
    // 3. On window (content scripts, popup, options)
    if (typeof window !== 'undefined' && window.supabase) {
        return window.supabase;
    }
    throw new Error('[Supabase] Library not loaded. Make sure supabase.min.js is imported in background.js or included via <script> tag.');
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
let _initPromise = null;

/**
 * Get or create the Supabase client instance (async for service worker support)
 * @returns {Promise<Object>} Supabase client
 */
export async function getSupabaseClient() {
    if (_supabaseClient) {
        return _supabaseClient;
    }

    // Prevent parallel init races
    if (_initPromise) {
        return _initPromise;
    }

    _initPromise = (async () => {
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
    })();

    try {
        return await _initPromise;
    } finally {
        _initPromise = null;
    }
}

// Export a getter for the client (for compatibility)
export const supabaseClient = {
    get client() {
        // NOTE: This is sync and may return null if not yet initialized.
        // Use getSupabaseClient() for async access.
        return _supabaseClient;
    }
};

// Alias for backward compatibility
export { getSupabaseClient as supabase };

