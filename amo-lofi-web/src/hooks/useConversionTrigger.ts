/**
 * useConversionTrigger — One-shot upsell trigger system.
 * Checks user stats against thresholds and returns a trigger message
 * to display as a toast/banner if conditions are met (once per trigger).
 */

const STORAGE_KEY = 'amo_upsell_triggers';

interface TriggerState {
    streak7: boolean;       // 7-day streak achieved
    sessions50: boolean;    // 50 sessions completed
    dashboard5: boolean;    // Dashboard opened 5+ times
    focus100: boolean;      // 100 total focus minutes
    streak14: boolean;      // 14-day streak (second conversion point)
}

interface TriggerMessage {
    id: string;
    emoji: string;
    text: string;
    cta: string;
}

const TRIGGER_DEFS: { key: keyof TriggerState; check: (stats: any, dashCount: number) => boolean; msg: TriggerMessage }[] = [
    {
        key: 'streak7',
        check: (stats) => stats.dayStreak >= 7,
        msg: { id: 'streak7', emoji: '🔥', text: 'Amazing! 7 days in a row! Protect your streak with Freeze.', cta: 'Get Streak Freeze' },
    },
    {
        key: 'sessions50',
        check: (stats) => stats.sessionsCompleted >= 50,
        msg: { id: 'sessions50', emoji: '🎯', text: '50 sessions! Unlock AI Insights to optimize your flow.', cta: 'See Your Insights' },
    },
    {
        key: 'dashboard5',
        check: (_, dashCount) => dashCount >= 5,
        msg: { id: 'dashboard5', emoji: '📊', text: 'Love checking your stats? See monthly trends with Pro.', cta: 'Unlock Trends' },
    },
    {
        key: 'focus100',
        check: (stats) => stats.totalFocusMinutes >= 100,
        msg: { id: 'focus100', emoji: '⚡', text: '100 minutes of deep focus! You deserve the full experience.', cta: 'Upgrade to Pro' },
    },
    {
        key: 'streak14',
        check: (stats) => stats.dayStreak >= 14,
        msg: { id: 'streak14', emoji: '💎', text: '14-day streak! You\'re in the top 5% of focused users.', cta: 'Join Pro' },
    },
];

function loadState(): TriggerState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { streak7: false, sessions50: false, dashboard5: false, focus100: false, streak14: false };
}

function saveState(state: TriggerState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDashboardOpenCount(): number {
    const key = 'amo_dash_open_count';
    const count = parseInt(localStorage.getItem(key) ?? '0', 10) + 1;
    localStorage.setItem(key, String(count));
    return count;
}

/**
 * Check triggers and return the first unshown trigger that matches.
 * Returns null if no trigger should fire.
 * Should only be called for Free users.
 */
export function checkConversionTriggers(stats: any, isPro: boolean): TriggerMessage | null {
    if (isPro) return null;

    const state = loadState();
    const dashCount = getDashboardOpenCount();

    for (const def of TRIGGER_DEFS) {
        if (state[def.key]) continue; // already shown
        if (def.check(stats, dashCount)) {
            // Mark as shown
            state[def.key] = true;
            saveState(state);
            return def.msg;
        }
    }

    return null;
}
