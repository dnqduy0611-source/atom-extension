/**
 * useCredits — Credit balance + trial status hook for AmoLofi
 *
 * Fetches from the `get-credits` Edge Function.
 * Provides balance, trialUsed, loading state, and refresh function.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';

interface CreditsState {
    balance: number;
    trialUsed: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useCredits(): CreditsState {
    const [balance, setBalance] = useState(0);
    const [trialUsed, setTrialUsed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setError(null);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setBalance(0);
                setTrialUsed(false);
                setIsLoading(false);
                return;
            }

            const res = await fetch(`${SUPABASE_URL}/functions/v1/get-credits`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch credits (${res.status})`);
            }

            const data = await res.json();
            setBalance(data.balance ?? 0);
            setTrialUsed(data.trialUsed ?? false);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { balance, trialUsed, isLoading, error, refresh };
}
