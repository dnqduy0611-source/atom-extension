// brain/habit_tracker.js — Skeleton for Phase 4
// Track reading patterns: thời gian đọc, domains hay vào, thói quen scroll.
// Phase 1: chỉ export placeholder interface.

const HABIT_STORAGE_KEY = 'atom_habit_data_v1';

/**
 * Track a reading event for habit analysis.
 * Phase 4: implement real tracking logic.
 */
export async function trackReading(tabId, sessionData) {
    // Phase 4: implement real tracking
    console.log('[HabitTracker] Placeholder — will track in Phase 4');
}

/**
 * Get user reading patterns.
 * Phase 4: return real computed patterns from storage.
 */
export async function getPatterns() {
    return {
        avgSessionDuration: 0,
        pagesReadToday: 0,
        totalReadingToday: 0,
        topDomains: [],
        readingHours: []
    };
}

export async function getAvgSessionDuration() { return 0; }
export async function getPagesReadToday() { return 0; }
export async function getTotalReadingToday() { return 0; }
