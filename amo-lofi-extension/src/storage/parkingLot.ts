/**
 * Parking Lot storage — saves blocked URLs so user can revisit during breaks.
 * Deduplicates by domain. Uses chrome.storage.local for persistence.
 */

export interface ParkedSite {
    url: string;          // full URL that was blocked
    domain: string;       // e.g. "facebook.com"
    favicon: string;      // Google favicon service URL
    parkedAt: number;     // Date.now() timestamp
}

export async function getParkingLot(): Promise<ParkedSite[]> {
    const result = await chrome.storage.local.get('parkingLot');
    return (result.parkingLot as ParkedSite[]) || [];
}

export async function addToParkingLot(url: string): Promise<void> {
    const list = await getParkingLot();

    let domain: string;
    try {
        domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return; // invalid URL
    }

    // Deduplicate by domain
    if (list.find((s) => s.domain === domain)) return;

    list.push({
        url,
        domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        parkedAt: Date.now(),
    });

    await chrome.storage.local.set({ parkingLot: list });
}

export async function removeFromParkingLot(domain: string): Promise<void> {
    const list = await getParkingLot();
    const filtered = list.filter((s) => s.domain !== domain);
    await chrome.storage.local.set({ parkingLot: filtered });
}

export async function clearParkingLot(): Promise<void> {
    await chrome.storage.local.set({ parkingLot: [] });
}
