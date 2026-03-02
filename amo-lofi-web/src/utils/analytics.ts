/**
 * analytics.ts — Product Event Tracking for AmoLofi Web
 *
 * Fire-and-forget event tracking to Supabase `product_events` table.
 * Used for activation & monetization funnel metrics.
 *
 * Events: app_open, focus_start, focus_complete, focus_abort,
 *         scene_change, signup_success, upgrade_click, pro_purchase_success
 */

import { supabase } from '../lib/supabaseClient';

// ── Session ID (unique per browser tab) ──

function getSessionId(): string {
    const KEY = 'amo_analytics_session_id';
    let sid = sessionStorage.getItem(KEY);
    if (!sid) {
        sid = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem(KEY, sid);
    }
    return sid;
}

// ── Dedup guard ──

const _firedEvents = new Set<string>();

function shouldDedupe(eventName: string): boolean {
    // These events should only fire once per session
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
    | 'pro_purchase_success'
    | 'chat_send'
    | 'track_change'
    | 'panel_open'
    | 'task_breakdown';

/**
 * Track a product analytics event. Fire-and-forget — never blocks UI.
 *
 * @param eventName - One of the 8 required event names
 * @param metadata  - Optional JSON metadata for the event
 */
export function trackProductEvent(
    eventName: ProductEventName,
    metadata: Record<string, unknown> = {},
): void {
    // Skip deduped events
    if (shouldDedupe(eventName)) return;

    // Fire-and-forget — don't await
    _insertEvent(eventName, metadata).catch(() => {
        // Silently ignore tracking failures — never disrupt UX
    });
}

async function _insertEvent(
    eventName: string,
    metadata: Record<string, unknown>,
): Promise<void> {
    // Get current user (nullable for guests)
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    await supabase.from('product_events').insert({
        event_name: eventName,
        user_id: userId,
        session_id: getSessionId(),
        platform: 'web',
        metadata,
    });
}
