/**
 * useCredits — Credit balance + daily free + trial status hook for AmoLofi
 *
 * Fetches from the `get-credits` Edge Function.
 * Provides balance, daily free remaining, trial info, loading state, and refresh.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';

interface CreditsState {
    balance: number;
    trialUsed: boolean;
    dailyFreeRemaining: number;
    maxDaily: number;
    isInTrial: boolean;
    trialDaysLeft: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useCredits(): CreditsState {
    const [balance, setBalance] = useState(0);
    const [trialUsed, setTrialUsed] = useState(false);
    const [dailyFreeRemaining, setDailyFreeRemaining] = useState(1);
    const [maxDaily, setMaxDaily] = useState(1);
    const [isInTrial, setIsInTrial] = useState(false);
    const [trialDaysLeft, setTrialDaysLeft] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            setError(null);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setBalance(0);
                setTrialUsed(false);
                setDailyFreeRemaining(0);
                setMaxDaily(0);
                setIsInTrial(false);
                setTrialDaysLeft(0);
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
            setDailyFreeRemaining(data.dailyFreeRemaining ?? 0);
            setMaxDaily(data.maxDaily ?? 1);
            setIsInTrial(data.isInTrial ?? false);
            setTrialDaysLeft(data.trialDaysLeft ?? 0);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        balance, trialUsed,
        dailyFreeRemaining, maxDaily, isInTrial, trialDaysLeft,
        isLoading, error, refresh,
    };
}
