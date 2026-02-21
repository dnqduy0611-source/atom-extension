/**
 * useAuth — Reactive auth state hook for the extension.
 * Tracks login status, user info, and provides login/logout actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { signInWithGoogle, signOut } from '../services/auth';
import type { User } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
    });

    // Check session on mount
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setState({
                user: data.session?.user ?? null,
                loading: false,
                error: null,
            });
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setState((prev) => ({
                    ...prev,
                    user: session?.user ?? null,
                    loading: false,
                }));
            },
        );

        return () => subscription.unsubscribe();
    }, []);

    const login = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const result = await signInWithGoogle();
        if (result.error) {
            setState((prev) => ({ ...prev, loading: false, error: result.error }));
        }
        // onAuthStateChange will handle updating user
    }, []);

    const logout = useCallback(async () => {
        setState((prev) => ({ ...prev, loading: true }));
        await signOut();
        setState({ user: null, loading: false, error: null });
    }, []);

    return {
        user: state.user,
        loading: state.loading,
        error: state.error,
        isLoggedIn: !!state.user,
        login,
        logout,
    };
}
