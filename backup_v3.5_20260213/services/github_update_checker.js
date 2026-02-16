// services/github_update_checker.js
// Checks for new GitHub releases for sideloaded (developer mode) builds
// Part of Monetization Phase 1

const GITHUB_REPO = 'dnqduy0611-source/atom-extension';
const UPDATE_STORAGE_KEY = 'atom_github_update';

/**
 * Check if the extension is sideloaded (developer mode) vs Chrome Web Store.
 * @returns {Promise<boolean>} true if sideloaded
 */
export async function isSideloaded() {
    try {
        const self = await chrome.management.getSelf();
        return self.installType === 'development';
    } catch {
        // If management API not available, assume not sideloaded
        return false;
    }
}

/**
 * Check GitHub for a newer release.
 * Only runs for sideloaded builds.
 * @returns {Promise<{hasUpdate: boolean, latestVersion?: string, downloadUrl?: string} | null>}
 */
export async function checkForGitHubUpdate() {
    // Only run for sideloaded builds
    const sideloaded = await isSideloaded();
    if (!sideloaded) {
        return null;
    }

    try {
        const currentVersion = chrome.runtime.getManifest().version;
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
            {
                headers: { 'Accept': 'application/vnd.github.v3+json' },
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            console.log('[GitHubUpdate] API response not OK:', response.status);
            return null;
        }

        const release = await response.json();
        const latestTag = (release.tag_name || '').replace(/^v/, '');

        if (!latestTag) return null;

        const hasUpdate = compareVersions(latestTag, currentVersion) > 0;

        const result = {
            hasUpdate,
            currentVersion,
            latestVersion: latestTag,
            downloadUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
            releaseName: release.name || `v${latestTag}`,
            publishedAt: release.published_at,
            checkedAt: Date.now()
        };

        // Save to storage for UI to read
        await chrome.storage.local.set({ [UPDATE_STORAGE_KEY]: result });

        if (hasUpdate) {
            console.log(`[GitHubUpdate] New version available: ${latestTag} (current: ${currentVersion})`);
        }

        return result;
    } catch (error) {
        console.log('[GitHubUpdate] Check failed (normal if offline):', error.message);
        return null;
    }
}

/**
 * Get the last update check result from storage.
 * @returns {Promise<Object|null>}
 */
export async function getUpdateStatus() {
    const data = await chrome.storage.local.get([UPDATE_STORAGE_KEY]);
    return data[UPDATE_STORAGE_KEY] || null;
}

/**
 * Dismiss the update notification.
 * User won't be notified again until a newer version is released.
 */
export async function dismissUpdate() {
    const data = await chrome.storage.local.get([UPDATE_STORAGE_KEY]);
    const status = data[UPDATE_STORAGE_KEY];
    if (status) {
        status.dismissed = true;
        status.dismissedVersion = status.latestVersion;
        await chrome.storage.local.set({ [UPDATE_STORAGE_KEY]: status });
    }
}

// --- Helpers ---

/**
 * Compare two semver-like version strings.
 * @returns {number} 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    const len = Math.max(pa.length, pb.length);

    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}
