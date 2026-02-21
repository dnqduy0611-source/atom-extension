/**
 * Blocklist storage — manages blocked sites list via chrome.storage.local.
 * Sites are blocked only during Focus Mode (checked by blocker.ts).
 */

export interface BlockedSite {
    domain: string;      // e.g. "facebook.com"
    addedAt: number;     // Date.now() timestamp
    enabled: boolean;    // toggle without deleting
}

export const DEFAULT_BLOCKLIST: BlockedSite[] = [
    { domain: 'facebook.com', addedAt: 0, enabled: true },
    { domain: 'youtube.com', addedAt: 0, enabled: true },
    { domain: 'twitter.com', addedAt: 0, enabled: true },
    { domain: 'x.com', addedAt: 0, enabled: true },
    { domain: 'reddit.com', addedAt: 0, enabled: true },
];

// Free tier limit
export const FREE_BLOCKLIST_LIMIT = 5;

// ── Storage helpers ──

export async function getBlocklist(): Promise<BlockedSite[]> {
    const result = await chrome.storage.local.get('blocklist');
    return (result.blocklist as BlockedSite[]) || [...DEFAULT_BLOCKLIST];
}

export async function saveBlocklist(list: BlockedSite[]): Promise<void> {
    await chrome.storage.local.set({ blocklist: list });
}

export async function addToBlocklist(domain: string): Promise<{ ok: boolean; reason?: string }> {
    const list = await getBlocklist();

    // Normalize domain
    const normalized = domain.toLowerCase().replace(/^www\./, '');

    // Already exists?
    if (list.find((s) => s.domain === normalized)) {
        return { ok: false, reason: 'already_exists' };
    }

    // Free tier check
    if (list.length >= FREE_BLOCKLIST_LIMIT) {
        return { ok: false, reason: 'limit_reached' };
    }

    list.push({ domain: normalized, addedAt: Date.now(), enabled: true });
    await saveBlocklist(list);
    return { ok: true };
}

export async function removeFromBlocklist(domain: string): Promise<void> {
    const list = await getBlocklist();
    const filtered = list.filter((s) => s.domain !== domain);
    await saveBlocklist(filtered);
}

export async function toggleBlockedSite(domain: string): Promise<void> {
    const list = await getBlocklist();
    const site = list.find((s) => s.domain === domain);
    if (site) {
        site.enabled = !site.enabled;
        await saveBlocklist(list);
    }
}

// ── URL Matching ──

/**
 * Check if a URL matches any enabled site in the blocklist.
 * Matches exact domain and subdomains (e.g. m.facebook.com matches facebook.com).
 */
export function isBlocked(url: string, blocklist: BlockedSite[]): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        return blocklist.some((site) => {
            if (!site.enabled) return false;
            const domain = site.domain.toLowerCase();

            // Exact match: facebook.com
            if (hostname === domain) return true;

            // Subdomain match: m.facebook.com, www.facebook.com
            if (hostname.endsWith('.' + domain)) return true;

            return false;
        });
    } catch {
        return false; // Invalid URL → don't block
    }
}
