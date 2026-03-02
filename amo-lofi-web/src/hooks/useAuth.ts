/**
 * useAuth — Authentication hook for AmoLofi Web App
 *
 * Supports dual login:
 *   1. Extension bridge: session passed via URL hash params (#access_token=...)
 *   2. Standalone: Google OAuth redirect via Supabase
 *
 * Supabase's `detectSessionInUrl: true` handles both cases automatically.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import { trackProductEvent } from '../utils/analytics';

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Get initial session (handles both stored session and URL params)
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            setIsLoading(false);

            // Clean URL hash after extension bridge login
            if (window.location.hash.includes('access_token')) {
                window.history.replaceState(null, '', window.location.pathname);
            }
        });

        // 2. Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, s) => {
                setSession(s);
                setUser(s?.user ?? null);
                setIsLoading(false);

                // Track signup event for funnel analytics
                if (_event === 'SIGNED_IN' && s?.user) {
                    trackProductEvent('signup_success', {
                        provider: s.user.app_metadata?.provider ?? 'unknown',
                    });
                }
            },
        );

        // 3. Listen for Extension auth sync via postMessage
        const handleAuthMessage = async (event: MessageEvent) => {
            // Only accept messages from same origin
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'AMO_AUTH_SYNC') {
                const { access_token, refresh_token } = event.data.payload || {};
                if (access_token && refresh_token) {
                    console.log('[Auth] Received session from Extension');
                    await supabase.auth.setSession({ access_token, refresh_token });
                }
            }

            if (event.data?.type === 'AMO_AUTH_LOGOUT') {
                console.log('[Auth] Received logout from Extension');
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
            }
        };

        window.addEventListener('message', handleAuthMessage);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('message', handleAuthMessage);
        };
    }, []);

    const signIn = useCallback(async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    }, []);

    return { user, session, isLoading, signIn, signOut };
}
