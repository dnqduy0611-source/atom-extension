// services/quota_service.js
// Daily AI call quota tracking & trial management
// Part of Monetization Phase 1

const TRIAL_KEY = 'atom_trial';
const DAILY_USAGE_KEY = 'atom_daily_usage';
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const LIMITS = {
    TRIAL: 30,      // 30 calls/day during trial
    FREE: 10,       // 10 calls/day after trial expires
    BYOK: Infinity  // Unlimited for BYOK users
};

/**
 * Initialize trial data on first install.
 * Safe to call multiple times — only writes if data is missing.
 */
export async function initQuota() {
    const data = await chrome.storage.local.get([TRIAL_KEY]);
    if (data[TRIAL_KEY]?.install_date) return; // Already initialized

    const now = Date.now();
    await chrome.storage.local.set({
        [TRIAL_KEY]: {
            install_date: now,
            trial_end_date: now + TRIAL_DURATION_MS
        },
        [DAILY_USAGE_KEY]: {
            date: getTodayString(),
            count: 0
        }
    });
    console.log('[Quota] Initialized trial — 30 days from', new Date(now).toISOString());
}

/**
 * Check if user has their own API key (BYOK).
 * BYOK users bypass daily limits entirely.
 * @returns {Promise<boolean>}
 */
export async function isByok() {
    const data = await chrome.storage.local.get([
        'user_gemini_key', 'gemini_api_key', 'apiKey', 'atom_openrouter_key'
    ]);
    return !!(data.user_gemini_key || data.gemini_api_key || data.apiKey || data.atom_openrouter_key);
}

/**
 * Check if the current user is allowed to make an AI call.
 * @returns {Promise<QuotaStatus>}
 *
 * @typedef {Object} QuotaStatus
 * @property {boolean} allowed - Whether the call is allowed
 * @property {number} used - Calls used today
 * @property {number} limit - Daily limit
 * @property {boolean} isByok - Whether user has own key
 * @property {boolean} isTrial - Whether trial is active
 * @property {number} trialDaysLeft - Days remaining in trial (-1 if expired, -1 if BYOK)
 * @property {string} [reason] - Reason if not allowed
 */
export async function checkQuota() {
    const byok = await isByok();

    // BYOK always allowed
    if (byok) {
        return {
            allowed: true,
            used: 0,
            limit: LIMITS.BYOK,
            isByok: true,
            isTrial: false,
            trialDaysLeft: -1
        };
    }

    // Get trial info
    const trialData = await chrome.storage.local.get([TRIAL_KEY]);
    const trial = trialData[TRIAL_KEY] || {};
    const now = Date.now();
    const isTrial = trial.trial_end_date ? now < trial.trial_end_date : false;
    const trialDaysLeft = trial.trial_end_date
        ? Math.max(0, Math.ceil((trial.trial_end_date - now) / (24 * 60 * 60 * 1000)))
        : 0;

    // Get daily usage
    const usageData = await chrome.storage.local.get([DAILY_USAGE_KEY]);
    let usage = usageData[DAILY_USAGE_KEY] || { date: getTodayString(), count: 0 };

    // Reset if new day
    const today = getTodayString();
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
        await chrome.storage.local.set({ [DAILY_USAGE_KEY]: usage });
    }

    const limit = isTrial ? LIMITS.TRIAL : LIMITS.FREE;
    const allowed = usage.count < limit;

    return {
        allowed,
        used: usage.count,
        limit,
        isByok: false,
        isTrial,
        trialDaysLeft,
        ...(!allowed ? { reason: 'daily_limit_reached' } : {})
    };
}

/**
 * Increment daily usage counter after a successful AI call.
 * Should be called AFTER the API call succeeds.
 * @returns {Promise<number>} New count
 */
export async function incrementQuota() {
    const byok = await isByok();
    if (byok) return 0; // Don't track BYOK usage

    const data = await chrome.storage.local.get([DAILY_USAGE_KEY]);
    let usage = data[DAILY_USAGE_KEY] || { date: getTodayString(), count: 0 };

    const today = getTodayString();
    if (usage.date !== today) {
        usage = { date: today, count: 0 };
    }

    usage.count += 1;
    await chrome.storage.local.set({ [DAILY_USAGE_KEY]: usage });

    return usage.count;
}

/**
 * Reset daily quota (called by alarm or on new day detection).
 */
export async function resetDailyQuota() {
    const today = getTodayString();
    const data = await chrome.storage.local.get([DAILY_USAGE_KEY]);
    const usage = data[DAILY_USAGE_KEY];

    if (!usage || usage.date !== today) {
        await chrome.storage.local.set({
            [DAILY_USAGE_KEY]: { date: today, count: 0 }
        });
        console.log('[Quota] Daily counter reset for', today);
    }
}

/**
 * Get full quota status for UI display.
 * @returns {Promise<QuotaDisplayStatus>}
 */
export async function getQuotaDisplayStatus() {
    const status = await checkQuota();
    const trialData = await chrome.storage.local.get([TRIAL_KEY]);
    const trial = trialData[TRIAL_KEY] || {};

    return {
        ...status,
        installDate: trial.install_date || null,
        trialEndDate: trial.trial_end_date || null,
        percentUsed: status.limit === Infinity ? 0 : Math.round((status.used / status.limit) * 100)
    };
}

// --- Helpers ---

function getTodayString() {
    // Use VN timezone for consistency with daily rollup
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${d}`;
}
