/**
 * Supabase Client for AmoLofi Extension.
 *
 * Uses chrome.storage.local for session persistence (not localStorage).
 * Matches credentials with lofi.amonexus.com web app.
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://zdvbjuxcithcrvsdzumj.supabase.co';
export const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdmJqdXhjaXRoY3J2c2R6dW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjQ3NjYsImV4cCI6MjA4NjIwMDc2Nn0.A5T62IvsRd5MhX3aoeVA-l9dXlpAXSsLdgTcjOTLtJ4';

/**
 * Custom storage adapter — uses chrome.storage.local so auth persists
 * across extension contexts (New Tab, Service Worker, Popup).
 */
const chromeStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        const result = await chrome.storage.local.get(key);
        return (result[key] as string) ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        await chrome.storage.local.set({ [key]: value });
    },
    removeItem: async (key: string): Promise<void> => {
        await chrome.storage.local.remove(key);
    },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // We handle tokens manually in extension
        flowType: 'pkce',
    },
});
