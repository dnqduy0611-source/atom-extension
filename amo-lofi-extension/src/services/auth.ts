/**
 * Auth service for AmoLofi Extension.
 *
 * Uses chrome.identity.launchWebAuthFlow for Google OAuth.
 * Exchanges the auth code with Supabase to get a session.
 */

import { supabase, SUPABASE_URL } from './supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Sign in with Google using chrome.identity.launchWebAuthFlow.
 *
 * Flow:
 * 1. Open Supabase's Google OAuth URL in a Chrome auth popup
 * 2. User authenticates with Google
 * 3. Supabase redirects to chrome-extension redirect URL with tokens in hash
 * 4. We extract tokens and set the session
 */
export async function signInWithGoogle(): Promise<{ session: Session | null; error: string | null }> {
    try {
        const redirectUrl = chrome.identity.getRedirectURL('auth');

        // Build Supabase OAuth URL
        const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
        authUrl.searchParams.set('provider', 'google');
        authUrl.searchParams.set('redirect_to', redirectUrl);
        authUrl.searchParams.set('skip_http_redirect', 'true');

        // Launch Chrome's auth popup
        const responseUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true,
        });

        if (!responseUrl) {
            return { session: null, error: 'Auth flow cancelled' };
        }

        // Extract tokens from the redirect URL hash fragment
        const hashParams = new URLSearchParams(
            responseUrl.includes('#')
                ? responseUrl.split('#')[1]
                : responseUrl.split('?')[1],
        );

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
            return { session: null, error: 'No access token received' };
        }

        // Set the session in Supabase client
        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
        });

        if (error) {
            return { session: null, error: error.message };
        }

        return { session: data.session, error: null };
    } catch (err: any) {
        console.error('[AmoLofi Auth]', err);
        return { session: null, error: err?.message || 'Unknown auth error' };
    }
}

/**
 * Sign out and clear session.
 */
export async function signOut(): Promise<void> {
    await supabase.auth.signOut();
}

/**
 * Get current session (may return null if not logged in).
 */
export async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/**
 * Get current user.
 */
export async function getUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
}
