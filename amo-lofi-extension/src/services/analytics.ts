/**
 * analytics.ts — Product Event Tracking for AmoLofi Extension
 *
 * Fire-and-forget event tracking to Supabase `product_events` table.
 * Uses chrome.storage.session for session ID persistence across contexts.
 *
 * Events: app_open, focus_start, focus_complete, focus_abort,
 *         scene_change, signup_success, upgrade_click, pro_purchase_success
 */

import { supabase } from './supabaseClient';

// ── Session ID (unique per browser session) ──

let _cachedSessionId: string | null = null;

async function getSessionId(): Promise<string> {
    if (_cachedSessionId) return _cachedSessionId;

    try {
        const result = await chrome.storage.session.get('amo_analytics_session_id');
        if (result.amo_analytics_session_id) {
            _cachedSessionId = result.amo_analytics_session_id as string;
            return _cachedSessionId;
        }
    } catch {
        // chrome.storage.session may not be available in all contexts
    }

    const sid = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    _cachedSessionId = sid;

    try {
        await chrome.storage.session.set({ amo_analytics_session_id: sid });
    } catch {
        // Ignore — session storage may not be available
    }

    return sid;
}

// ── Dedup guard ──

const _firedEvents = new Set<string>();

function shouldDedupe(eventName: string): boolean {
    const ONCE_PER_SESSION = ['app_open', 'signup_success'];
    if (!ONCE_PER_SESSION.includes(eventName)) return false;
    if (_firedEvents.has(eventName)) return true;
    _firedEvents.add(eventName);
    return false;
}

// ── Core tracker ──

export type ProductEventName =
    | 'app_open'
    | 'focus_start'
    | 'focus_complete'
    | 'focus_abort'
    | 'scene_change'
    | 'signup_success'
    | 'upgrade_click'
    | 'pro_purchase_success';

/**
 * Track a product analytics event. Fire-and-forget — never blocks UI.
 */
export function trackProductEvent(
    eventName: ProductEventName,
    metadata: Record<string, unknown> = {},
): void {
    if (shouldDedupe(eventName)) return;

    _insertEvent(eventName, metadata).catch(() => {
        // Silently ignore — never disrupt UX
    });
}

async function _insertEvent(
    eventName: string,
    metadata: Record<string, unknown>,
): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    const sessionId = await getSessionId();

    await supabase.from('product_events').insert({
        event_name: eventName,
        user_id: userId,
        session_id: sessionId,
        platform: 'extension',
        metadata,
    });
}
