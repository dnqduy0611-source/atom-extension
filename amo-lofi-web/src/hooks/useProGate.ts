import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabaseClient';

/**
 * useProGate — Pro feature gate backed by real Supabase profile check.
 *
 * isPro: true only when user has an active subscription (profiles.is_pro = true
 *        OR profiles.subscription_status = 'active').
 *
 * Authenticated users without a subscription can still buy credits and use
 * credit-gated features, but Pro-only UI features remain locked.
 */

// ── Modal visibility (shared global state) ──
let _modalVisible = false;
const _modalListeners = new Set<() => void>();

function notifyModalListeners() {
    _modalListeners.forEach((cb) => cb());
}

function subscribeModal(cb: () => void) {
    _modalListeners.add(cb);
    return () => { _modalListeners.delete(cb); };
}

function getModalSnapshot(): boolean {
    return _modalVisible;
}

function setModalVisible(v: boolean) {
    if (_modalVisible !== v) {
        _modalVisible = v;
        notifyModalListeners();
    }
}

export function useProGate() {
    const { user } = useAuth();
    const [isPro, setIsPro] = useState(false);
    const upsellVisible = useSyncExternalStore(subscribeModal, getModalSnapshot);

    // Fetch Pro status from profiles table
    useEffect(() => {
        if (!user) {
            setIsPro(false);
            return;
        }

        let cancelled = false;

        async function checkProStatus() {
            const { data, error } = await supabase
                .from('profiles')
                .select('is_pro, subscription_status, subscription_end_date')
                .eq('id', user!.id)
                .single();

            if (cancelled) return;

            if (error || !data) {
                console.warn('[ProGate] Failed to fetch profile:', error?.message);
                setIsPro(false);
                return;
            }

            // Pro if: is_pro flag is set, OR subscription_status is 'active'/'trialing'
            const hasActiveSub =
                data.is_pro === true ||
                data.subscription_status === 'active' ||
                data.subscription_status === 'trialing';

            // Also check if subscription hasn't expired
            const notExpired = !data.subscription_end_date ||
                new Date(data.subscription_end_date) > new Date();

            setIsPro(hasActiveSub && notExpired);
        }

        checkProStatus();

        // Re-check when auth state changes (e.g. after webhook updates profile)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            checkProStatus();
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [user]);

    const showUpsell = useCallback((_feature?: string) => {
        setModalVisible(true);
    }, []);

    const dismissUpsell = useCallback(() => {
        setModalVisible(false);
    }, []);

    return { isPro, upsellVisible, showUpsell, dismissUpsell };
}
