/**
 * useProfile — Fetch user profile from Supabase profiles table.
 * Returns profile data including country, onboarding status, and Pro status.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export interface Profile {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    country: string | null;
    phone: string | null;
    is_pro: boolean;
    subscription_status: string;
    onboarding_completed: boolean;
}

export function useProfile() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!user) {
            setProfile(null);
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, display_name, avatar_url, country, phone, is_pro, subscription_status, onboarding_completed')
            .eq('id', user.id)
            .single();

        if (error || !data) {
            console.warn('[useProfile] Failed to fetch:', error?.message);
            setProfile(null);
        } else {
            setProfile(data as Profile);
        }
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { profile, isLoading, refresh };
}
