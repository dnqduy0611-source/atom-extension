/**
 * Authentication Service
 * 
 * @fileoverview Handles Google OAuth sign-in/sign-out, session management,
 * and user profile retrieval for AmoNexus extension.
 */

import { getSupabaseClient } from '../lib/supabase_client.js';
import { GOOGLE_CONFIG, EXTENSION_CONFIG, DEBUG_MODE } from '../config/supabase_config.js';
import { cacheAuthState, getCachedAuthState, clearAuthCache } from './auth_cache_service.js';

// Get client instance (lazy loaded)
function getClient() {
    return getSupabaseClient();
}

/**
 * Sign in with Google OAuth
 * Uses chrome.identity.launchWebAuthFlow to get Google ID Token directly,
 * then signs into Supabase using signInWithIdToken.
 * 
 * @param {boolean} rememberMe - Whether to remember session for 7 days
 * @returns {Promise<{success: boolean, authState?: Object, error?: string}>}
 */
export async function signInWithGoogle(rememberMe = true) {
    try {
        if (DEBUG_MODE) console.log('[Auth] Starting Google sign-in (ID Token flow)...');

        // Step 1: Build Google OAuth URL directly (for ID Token)
        const redirectUri = `https://${EXTENSION_CONFIG.ID}.chromiumapp.org/`;
        const nonce = crypto.randomUUID(); // For security

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CONFIG.CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'id_token token'); // Get ID token directly
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('nonce', nonce);
        authUrl.searchParams.set('prompt', 'select_account');

        if (DEBUG_MODE) {
            console.log('[Auth] Google OAuth URL:', authUrl.toString());
            console.log('[Auth] Redirect URI:', redirectUri);
        }

        // Step 2: Launch auth flow in popup
        const responseUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow(
                { url: authUrl.toString(), interactive: true },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (!response) {
                        reject(new Error('No response URL received'));
                    } else {
                        resolve(response);
                    }
                }
            );
        });

        if (DEBUG_MODE) console.log('[Auth] Response URL received');

        // Step 3: Extract ID token from response URL fragment
        const url = new URL(responseUrl);
        const hashParams = new URLSearchParams(url.hash.substring(1));

        // Check for error first
        const error = hashParams.get('error');
        if (error) {
            const errorDesc = hashParams.get('error_description');
            console.error('[Auth] Google OAuth error:', error, errorDesc);
            return { success: false, error: errorDesc || error };
        }

        const idToken = hashParams.get('id_token');
        const accessToken = hashParams.get('access_token');

        if (!idToken) {
            console.error('[Auth] No ID token in response');
            return { success: false, error: 'No ID token received from Google' };
        }

        if (DEBUG_MODE) console.log('[Auth] ID Token received, signing into Supabase...');

        // Step 4: Sign into Supabase with the Google ID Token
        const { data: sessionData, error: signInError } = await getClient().auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
            access_token: accessToken, // Optional but helpful
            nonce: nonce
        });

        if (signInError) {
            console.error('[Auth] Supabase signInWithIdToken error:', signInError);
            return { success: false, error: signInError.message };
        }

        if (DEBUG_MODE) console.log('[Auth] Supabase session created successfully');

        // Step 5: Get auth state and cache it
        const authState = await getAuthState();
        await cacheAuthState(authState, rememberMe);

        return { success: true, authState };

    } catch (error) {
        console.error('[Auth] Sign-in error:', error);

        // Handle user cancellation
        if (error.message.includes('The user did not approve') ||
            error.message.includes('cancelled') ||
            error.message.includes('closed')) {
            return { success: false, error: 'Sign in cancelled' };
        }

        return { success: false, error: error.message || 'Sign in failed' };
    }
}

/**
 * Sign out current user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function signOut() {
    try {
        if (DEBUG_MODE) console.log('[Auth] Signing out...');

        const { error } = await getClient().auth.signOut();

        if (error) {
            console.error('[Auth] Sign-out error:', error);
            return { success: false, error: error.message };
        }

        // Clear local cache
        await clearAuthCache();

        if (DEBUG_MODE) console.log('[Auth] Sign-out complete');
        return { success: true };

    } catch (error) {
        console.error('[Auth] Sign-out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current authentication state
 * First checks cache, then verifies with Supabase
 * 
 * @param {boolean} forceRefresh - Skip cache and fetch fresh state
 * @returns {Promise<Object>} Auth state object
 */
export async function getAuthState(forceRefresh = false) {
    try {
        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = await getCachedAuthState();
            if (cached && !cached.expired) {
                if (DEBUG_MODE) console.log('[Auth] Using cached state');
                return cached;
            }
        }

        // Get session from Supabase
        const { data: { session }, error } = await getClient().auth.getSession();

        if (error) {
            console.error('[Auth] getSession error:', error);
            return createEmptyAuthState();
        }

        if (!session) {
            if (DEBUG_MODE) console.log('[Auth] No active session');
            return createEmptyAuthState();
        }

        // Get user profile from database
        const profile = await getUserProfile(session.user.id);

        const authState = {
            isAuthenticated: true,
            user: {
                id: session.user.id,
                email: session.user.email,
                displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                avatarUrl: session.user.user_metadata?.avatar_url || null
            },
            isPro: profile?.is_pro || false,
            subscriptionStatus: profile?.subscription_status || 'free',
            profile: profile
        };

        return authState;

    } catch (error) {
        console.error('[Auth] getAuthState error:', error);
        return createEmptyAuthState();
    }
}

/**
 * Get user profile from database
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile(userId) {
    try {
        const { data, error } = await getClient()
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            if (DEBUG_MODE) console.log('[Auth] Profile not found:', error.message);
            return null;
        }

        return data;
    } catch (error) {
        console.error('[Auth] getUserProfile error:', error);
        return null;
    }
}

/**
 * Check if user is currently authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
    const authState = await getAuthState();
    return authState.isAuthenticated;
}

/**
 * Listen for auth state changes
 * @param {Function} callback - Called with (event, authState) on changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
    const { data: { subscription } } = getClient().auth.onAuthStateChange(
        async (event, session) => {
            if (DEBUG_MODE) console.log('[Auth] State change event:', event);

            let authState;
            if (session) {
                authState = await getAuthState(true);
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    const cached = await getCachedAuthState();
                    await cacheAuthState(authState, cached?.remember_me ?? true);
                }
            } else {
                authState = createEmptyAuthState();
                await clearAuthCache();
            }

            callback(event, authState);
        }
    );

    return () => subscription.unsubscribe();
}

/**
 * Create empty auth state object
 * @returns {Object} Empty auth state
 */
function createEmptyAuthState() {
    return {
        isAuthenticated: false,
        user: null,
        isPro: false,
        subscriptionStatus: 'free',
        profile: null
    };
}

/**
 * Refresh the current session
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function refreshSession() {
    try {
        const { data, error } = await getClient().auth.refreshSession();

        if (error) {
            console.error('[Auth] Refresh error:', error);
            return { success: false, error: error.message };
        }

        if (data.session) {
            const authState = await getAuthState(true);
            const cached = await getCachedAuthState();
            await cacheAuthState(authState, cached?.remember_me ?? true);
            return { success: true };
        }

        return { success: false, error: 'No session after refresh' };
    } catch (error) {
        console.error('[Auth] Refresh error:', error);
        return { success: false, error: error.message };
    }
}
