/**
 * Teleport Blocker — intercepts navigation to blocked sites during Focus Mode.
 * Redirects to Sanctuary (New Tab) with context for toast notification.
 */

import { getTimerState } from '../storage/timer';
import { getBlocklist, isBlocked } from '../storage/blocklist';
import { addToParkingLot } from '../storage/parkingLot';

// Track recently redirected tabs to prevent rapid-fire redirects
const recentlyRedirected = new Map<number, number>(); // tabId → timestamp
const REDIRECT_COOLDOWN = 2000; // 2 seconds

/**
 * Initialize the blocker — call once from Service Worker.
 */
export function initBlocker() {
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
}

async function handleTabUpdate(
    tabId: number,
    changeInfo: { url?: string },
    _tab: chrome.tabs.Tab,
) {
    // Only act on URL changes (not title/favicon/loading state)
    if (!changeInfo.url) return;

    const url = changeInfo.url;

    // ── Skip safe URLs ──
    // Don't block chrome internal pages
    if (url.startsWith('chrome://')) return;
    if (url.startsWith('chrome-extension://')) return;
    if (url.startsWith('about:')) return;
    if (url.startsWith('edge://')) return;

    // Don't block our own extension pages (prevent redirect loop!)
    if (url.startsWith(chrome.runtime.getURL(''))) return;

    // ── Cooldown check (prevent rapid-fire redirects) ──
    const lastRedirect = recentlyRedirected.get(tabId);
    if (lastRedirect && Date.now() - lastRedirect < REDIRECT_COOLDOWN) return;

    // ── Focus Mode gate ──
    const timer = await getTimerState();
    if (timer.mode !== 'focus' || !timer.isRunning) return;

    // ── Check blocklist ──
    const blocklist = await getBlocklist();
    if (!isBlocked(url, blocklist)) return;

    // ── TELEPORT: Redirect to Sanctuary ──
    recentlyRedirected.set(tabId, Date.now());

    const redirectUrl = chrome.runtime.getURL(
        `src/newtab/index.html?reason=blocked&url=${encodeURIComponent(url)}`,
    );

    chrome.tabs.update(tabId, { url: redirectUrl });

    // Save to Parking Lot
    await addToParkingLot(url);

    console.log(`[AmoLofi] Blocked: ${url} → Sanctuary`);

    // Clean up old cooldown entries
    if (recentlyRedirected.size > 50) {
        const now = Date.now();
        for (const [id, ts] of recentlyRedirected) {
            if (now - ts > 10000) recentlyRedirected.delete(id);
        }
    }
}
