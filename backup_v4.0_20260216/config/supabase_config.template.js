/**
 * Supabase Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file and rename to `supabase_config.js`
 * 2. Fill in your credentials from Supabase and Google Cloud Console
 * 3. Never commit supabase_config.js to version control
 * 
 * @fileoverview Template for Supabase and OAuth credentials
 */

export const SUPABASE_CONFIG = {
    // Get from: Supabase Dashboard -> Settings -> API -> Project URL
    URL: 'https://YOUR_PROJECT_ID.supabase.co',

    // Get from: Supabase Dashboard -> Settings -> API -> anon public key
    ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
};

export const GOOGLE_CONFIG = {
    // Get from: Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs
    CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
};

export const EXTENSION_CONFIG = {
    // Get from: chrome://extensions/ (with Developer mode enabled)
    ID: 'YOUR_EXTENSION_ID'
};

// Set to false in production
export const DEBUG_MODE = true;
