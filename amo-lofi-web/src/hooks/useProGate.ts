import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from './useAuth';

/**
 * useProGate — Pro feature gate backed by real Supabase auth.
 *
 * isPro: true when user is authenticated (basic gate for credit-based features).
 *        For subscription-level Pro, check profiles.is_pro via a separate query.
 *
 * The modal system (upsellVisible/showUpsell/dismissUpsell) remains unchanged
 * for showing LoginModal or ProUpgradeModal.
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
    const isPro = !!user; // Authenticated = can use credit-gated features
    const upsellVisible = useSyncExternalStore(subscribeModal, getModalSnapshot);

    const showUpsell = useCallback((_feature?: string) => {
        setModalVisible(true);
    }, []);

    const dismissUpsell = useCallback(() => {
        setModalVisible(false);
    }, []);

    return { isPro, upsellVisible, showUpsell, dismissUpsell };
}
