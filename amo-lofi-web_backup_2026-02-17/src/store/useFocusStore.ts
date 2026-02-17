import { create } from 'zustand';

// ══════════════════════════════════════════════════════
//  Focus Tools Store
//  Pomodoro Timer + Task List + Session Stats + Streaks
// ══════════════════════════════════════════════════════

export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface Task {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
}

interface FocusStats {
    totalFocusMinutes: number;
    sessionsCompleted: number;
    tasksCompleted: number;
    currentStreak: number;
    /** YYYY-MM-DD of last completed work session (for daily streak) */
    lastSessionDate: string;
    /** Consecutive days with at least 1 focus session */
    dayStreak: number;
    /** Highest day streak ever achieved */
    bestDayStreak: number;
    /** Focus minutes logged today */
    todayMinutes: number;
    /** YYYY-MM-DD for todayMinutes tracking */
    todayDate: string;
    /** Daily focus history: YYYY-MM-DD → minutes (kept ~90 days) */
    focusHistory: Record<string, number>;
    /** Hourly focus history: hour (0-23) → session count */
    hourlyHistory: Record<string, number>;
}

// ── localStorage persistence ──

const STORAGE_KEY = 'amo-lofi-focus-stats';
const NOTES_KEY = 'amo-lofi-focus-notes';

function loadNotes(): string {
    try { return localStorage.getItem(NOTES_KEY) ?? ''; } catch { return ''; }
}
function saveNotes(text: string): void {
    try { localStorage.setItem(NOTES_KEY, text); } catch { /* ignore */ }
}

function todayStr(): string {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

/** Prune focusHistory to keep only last ~90 days */
function pruneHistory(history: Record<string, number>): Record<string, number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const pruned: Record<string, number> = {};
    for (const [date, mins] of Object.entries(history)) {
        if (date >= cutoffStr) pruned[date] = mins;
    }
    return pruned;
}

function loadStats(): FocusStats {
    const defaults: FocusStats = {
        totalFocusMinutes: 0,
        sessionsCompleted: 0,
        tasksCompleted: 0,
        currentStreak: 0,
        lastSessionDate: '',
        dayStreak: 0,
        bestDayStreak: 0,
        todayMinutes: 0,
        todayDate: todayStr(),
        focusHistory: {},
        hourlyHistory: {},
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaults;
        const saved = JSON.parse(raw) as Partial<FocusStats>;
        const stats = { ...defaults, ...saved };
        // Reset todayMinutes if it's a new day
        if (stats.todayDate !== todayStr()) {
            stats.todayMinutes = 0;
            stats.todayDate = todayStr();
        }
        // Ensure focusHistory is an object
        if (!stats.focusHistory || typeof stats.focusHistory !== 'object') {
            stats.focusHistory = {};
        }
        if (!stats.hourlyHistory || typeof stats.hourlyHistory !== 'object') {
            stats.hourlyHistory = {};
        }
        return stats;
    } catch {
        return defaults;
    }
}

function saveStats(stats: FocusStats): void {
    try {
        const toSave = { ...stats, focusHistory: pruneHistory(stats.focusHistory) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* quota exceeded — silently ignore */ }
}

/** Record minutes into focusHistory for today */
function recordHistory(history: Record<string, number>, minutes: number): Record<string, number> {
    const today = todayStr();
    return { ...history, [today]: (history[today] ?? 0) + minutes };
}

/** Record session completion hour (0-23) */
function recordHourly(hourly: Record<string, number>): Record<string, number> {
    const hour = String(new Date().getHours());
    return { ...hourly, [hour]: (hourly[hour] ?? 0) + 1 };
}

/** Compute updated day streak after completing a work session */
function computeDayStreak(stats: FocusStats): Pick<FocusStats, 'dayStreak' | 'bestDayStreak' | 'lastSessionDate'> {
    const today = todayStr();
    const yesterday = yesterdayStr();
    let dayStreak = stats.dayStreak;

    if (stats.lastSessionDate === today) {
        // Already counted today — no change
    } else if (stats.lastSessionDate === yesterday) {
        // Consecutive day — extend streak
        dayStreak += 1;
    } else {
        // Gap — start fresh
        dayStreak = 1;
    }

    return {
        dayStreak,
        bestDayStreak: Math.max(stats.bestDayStreak, dayStreak),
        lastSessionDate: today,
    };
}

interface FocusState {
    // ── Pomodoro ──
    timerMode: TimerMode;
    workDuration: number;       // seconds (default 25min)
    shortBreakDuration: number; // seconds (default 5min)
    longBreakDuration: number;  // seconds (default 15min)
    timeRemaining: number;      // seconds
    isTimerRunning: boolean;
    pomodoroCount: number;      // cycles completed (long break every 4)

    // ── Tasks ──
    tasks: Task[];

    // ── Stats ──
    stats: FocusStats;

    // ── Notes ──
    focusNotes: string;

    // ── Pomodoro Actions ──
    startTimer: () => void;
    pauseTimer: () => void;
    resetTimer: () => void;
    skipTimer: () => void;
    tick: () => void;
    setWorkDuration: (minutes: number) => void;

    // ── Task Actions ──
    addTask: (text: string) => void;
    toggleTask: (id: string) => void;
    removeTask: (id: string) => void;
    clearCompletedTasks: () => void;

    // ── Notes Actions ──
    setFocusNotes: (text: string) => void;
}

function getNextMode(current: TimerMode, pomodoroCount: number): TimerMode {
    if (current === 'work') {
        return (pomodoroCount + 1) % 4 === 0 ? 'longBreak' : 'shortBreak';
    }
    return 'work';
}

function getDuration(mode: TimerMode, state: { workDuration: number; shortBreakDuration: number; longBreakDuration: number }): number {
    switch (mode) {
        case 'work': return state.workDuration;
        case 'shortBreak': return state.shortBreakDuration;
        case 'longBreak': return state.longBreakDuration;
    }
}

export const useFocusStore = create<FocusState>((set, get) => ({
    // ── Initial State ──
    timerMode: 'work',
    workDuration: 25 * 60,
    shortBreakDuration: 5 * 60,
    longBreakDuration: 15 * 60,
    timeRemaining: 25 * 60,
    isTimerRunning: false,
    pomodoroCount: 0,
    tasks: [],
    stats: loadStats(),
    focusNotes: loadNotes(),

    // ── Pomodoro ──
    startTimer: () => set({ isTimerRunning: true }),

    pauseTimer: () => set({ isTimerRunning: false }),

    resetTimer: () => {
        const state = get();
        set({
            timeRemaining: getDuration(state.timerMode, state),
            isTimerRunning: false,
        });
    },

    skipTimer: () => {
        const state = get();
        const wasWork = state.timerMode === 'work';
        const nextMode = getNextMode(state.timerMode, state.pomodoroCount);
        const newCount = wasWork ? state.pomodoroCount + 1 : state.pomodoroCount;

        const addedMinutes = Math.round(state.workDuration / 60);
        const newStats = wasWork
            ? {
                ...state.stats,
                sessionsCompleted: state.stats.sessionsCompleted + 1,
                totalFocusMinutes: state.stats.totalFocusMinutes + addedMinutes,
                currentStreak: state.stats.currentStreak + 1,
                todayMinutes: (state.stats.todayDate === todayStr() ? state.stats.todayMinutes : 0) + addedMinutes,
                todayDate: todayStr(),
                focusHistory: recordHistory(state.stats.focusHistory, addedMinutes),
                hourlyHistory: recordHourly(state.stats.hourlyHistory),
                ...computeDayStreak(state.stats),
            }
            : state.stats;
        if (wasWork) saveStats(newStats);

        set({
            timerMode: nextMode,
            timeRemaining: getDuration(nextMode, state),
            isTimerRunning: false,
            pomodoroCount: newCount,
            stats: newStats,
        });
    },

    tick: () => {
        const state = get();
        if (!state.isTimerRunning) return;

        if (state.timeRemaining <= 1) {
            // Timer complete
            const wasWork = state.timerMode === 'work';
            const nextMode = getNextMode(state.timerMode, state.pomodoroCount);
            const newCount = wasWork ? state.pomodoroCount + 1 : state.pomodoroCount;

            // Play notification sound
            try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = wasWork ? 523.25 : 659.25; // C5 or E5
                gain.gain.value = 0.3;
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
                osc.stop(ctx.currentTime + 1);
            } catch { /* Ignore audio errors */ }

            const addedMinutes = Math.round(state.workDuration / 60);
            const newStats = wasWork
                ? {
                    ...state.stats,
                    sessionsCompleted: state.stats.sessionsCompleted + 1,
                    totalFocusMinutes: state.stats.totalFocusMinutes + addedMinutes,
                    currentStreak: state.stats.currentStreak + 1,
                    todayMinutes: (state.stats.todayDate === todayStr() ? state.stats.todayMinutes : 0) + addedMinutes,
                    todayDate: todayStr(),
                    focusHistory: recordHistory(state.stats.focusHistory, addedMinutes),
                    hourlyHistory: recordHourly(state.stats.hourlyHistory),
                    ...computeDayStreak(state.stats),
                }
                : state.stats;
            if (wasWork) saveStats(newStats);

            set({
                timerMode: nextMode,
                timeRemaining: getDuration(nextMode, state),
                isTimerRunning: false,
                pomodoroCount: newCount,
                stats: newStats,
            });
        } else {
            set({ timeRemaining: state.timeRemaining - 1 });
        }
    },

    setWorkDuration: (minutes) => {
        const seconds = minutes * 60;
        const state = get();
        set({
            workDuration: seconds,
            timeRemaining: state.timerMode === 'work' && !state.isTimerRunning ? seconds : state.timeRemaining,
        });
    },

    // ── Tasks ──
    addTask: (text) =>
        set((state) => ({
            tasks: [
                ...state.tasks,
                { id: Date.now().toString(), text, completed: false, createdAt: Date.now() },
            ],
        })),

    toggleTask: (id) =>
        set((state) => {
            const task = state.tasks.find((t) => t.id === id);
            const wasCompleted = task?.completed ?? false;
            const newStats = !wasCompleted
                ? { ...state.stats, tasksCompleted: state.stats.tasksCompleted + 1 }
                : { ...state.stats, tasksCompleted: Math.max(0, state.stats.tasksCompleted - 1) };
            saveStats(newStats);
            return {
                tasks: state.tasks.map((t) =>
                    t.id === id ? { ...t, completed: !t.completed } : t
                ),
                stats: newStats,
            };
        }),

    removeTask: (id) =>
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
        })),

    clearCompletedTasks: () =>
        set((state) => ({
            tasks: state.tasks.filter((t) => !t.completed),
        })),

    // ── Notes ──
    setFocusNotes: (text) => {
        saveNotes(text);
        set({ focusNotes: text });
    },
}));
