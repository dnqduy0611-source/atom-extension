/**
 * Supabase Client for AmoLofi Web App
 *
 * Uses browser localStorage for session persistence.
 * Credentials match the extension's supabase_config.js.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zdvbjuxcithcrvsdzumj.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdmJqdXhjaXRoY3J2c2R6dW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjQ3NjYsImV4cCI6MjA4NjIwMDc2Nn0.A5T62IvsRd5MhX3aoeVA-l9dXlpAXSsLdgTcjOTLtJ4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Handles OAuth redirect + extension bridge via URL hash
    },
});

export { SUPABASE_URL };
