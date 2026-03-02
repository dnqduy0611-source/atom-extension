/**
 * auth.js — Supabase Magic Link authentication
 *
 * Uses Supabase's REST API directly (no JS SDK needed).
 * Requires environment variables:
 *   VITE_SUPABASE_URL   = https://<project>.supabase.co
 *   VITE_SUPABASE_ANON_KEY = <anon-public-key>
 *
 * Magic Link flow:
 *   1. User enters email → sendMagicLink(email) → Supabase sends OTP email
 *   2. User clicks link → redirected back with #access_token=... in URL hash
 *   3. On load: extractTokenFromHash() detects the token, stores it, fires callbacks
 */

let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
try {
    SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
    SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
} catch {
    // Running outside Vite (e.g. python -m http.server) — env vars unavailable
}

const TOKEN_KEY = 'amo_auth_token';
const REFRESH_KEY = 'amo_auth_refresh';
const USER_KEY = 'amo_auth_user';

let _token = localStorage.getItem(TOKEN_KEY) || null;
let _user = (() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
})();

const _listeners = new Set();

function _notify() {
    _listeners.forEach(cb => cb({ token: _token, user: _user }));
}

/** Subscribe to auth state changes. Returns unsubscribe fn. */
export function onAuthStateChange(cb) {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
}

/** Current access token or null */
export function getToken() { return _token; }

/** Current user object or null */
export function getUser() { return _user; }

/** True if user has a valid session */
export function isAuthenticated() { return !!_token; }

/**
 * Send a magic link OTP to the given email.
 * Returns { ok: true } or throws Error with message.
 */
export async function sendMagicLink(email) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase chưa được cấu hình. Liên hệ admin.');
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, create_user: true }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.msg || err.message || 'Gửi link thất bại');
    }

    return { ok: true };
}

/**
 * Call after a successful auth to store token + user.
 * Note: amo_user_id (player identifier) is intentionally NOT changed here —
 * the player's story data lives under their original UUID (guest or Supabase).
 * A backend migration endpoint can later link guest → authenticated sessions.
 */
function _setSession(token, refreshToken, user) {
    _token = token;
    _user = user;
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    _notify();
}

/** Clear session (sign out) */
export function signOut() {
    _token = null;
    _user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    _notify();
}

/**
 * Parse URL hash for access_token after magic link redirect.
 * Call once on page load. Returns true if a token was found + stored.
 */
export function extractTokenFromHash() {
    const hash = window.location.hash.slice(1); // Remove '#'
    if (!hash) return false;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken) return false;

    // Decode user from JWT payload (no signature check needed — server verifies)
    let user = null;
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        user = { id: payload.sub, email: payload.email || '' };
    } catch {
        user = { id: 'unknown' };
    }

    _setSession(accessToken, refreshToken, user);

    // Clean hash from URL (no page reload)
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);

    return true;
}

/**
 * Whether Supabase is configured (env vars present).
 * If not configured, the auth UI shows a disabled state.
 */
export function isConfigured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Sign in with Google OAuth via Supabase redirect flow.
 * Redirects to Google consent screen → Supabase callback → back to app with #access_token=...
 *
 * IMPORTANT: Saves a pre-auth breadcrumb so the page reload after OAuth
 * doesn't lose the current view (e.g. Soul Forge complete → setup screen).
 */
export function signInWithGoogle() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase chưa được cấu hình. Liên hệ admin.');
    }

    // Save breadcrumb — tells init() where to resume after page reload
    try {
        localStorage.setItem('amo_auth_redirect', JSON.stringify({
            returnView: 'story-setup',   // resume to setup screen
            timestamp: Date.now(),
        }));
    } catch { /* localStorage full — non-fatal */ }

    // Build the OAuth URL — Supabase handles the Google OAuth dance
    const redirectTo = window.location.origin + window.location.pathname;
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize`
        + `?provider=google`
        + `&redirect_to=${encodeURIComponent(redirectTo)}`;

    // Redirect to Google consent screen
    window.location.href = authUrl;
}
