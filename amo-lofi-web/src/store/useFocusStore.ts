import { create } from 'zustand';
import { trackProductEvent } from '../utils/analytics';

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
    // AI-generated task metadata (optional)
    isAIGenerated?: boolean;
    emoji?: string;
    estimatedMinutes?: number;
    definitionOfDone?: string;
}

export interface FocusStats {
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
    /** Streak Freeze — Pro only */
    streakFreezes: number;          // remaining freezes this month (max 2)
    freezesUsedThisMonth: number;   // how many used this month
    lastFreezeResetMonth: string;   // 'YYYY-MM' of last reset
    frozenDates: string[];          // YYYY-MM-DD dates where freeze was used
}

// ── localStorage persistence ──

const STORAGE_KEY = 'amo-lofi-focus-stats';
const NOTES_KEY = 'amo-lofi-focus-notes';
const TASK_LABEL_KEY = 'amo-lofi-task-label';

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
    const currentMonth = todayStr().slice(0, 7); // YYYY-MM
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
        streakFreezes: 2,
        freezesUsedThisMonth: 0,
        lastFreezeResetMonth: currentMonth,
        frozenDates: [],
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
        // Monthly freeze reset
        if (stats.lastFreezeResetMonth !== currentMonth) {
            stats.streakFreezes = 2;
            stats.freezesUsedThisMonth = 0;
            stats.lastFreezeResetMonth = currentMonth;
        }
        // Ensure frozenDates array
        if (!Array.isArray(stats.frozenDates)) {
            stats.frozenDates = [];
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

/** Compute updated day streak after completing a work session.
 *  isPro controls whether streak freezes are used on missed days. */
function computeDayStreak(stats: FocusStats, isPro = false): Pick<FocusStats, 'dayStreak' | 'bestDayStreak' | 'lastSessionDate' | 'streakFreezes' | 'freezesUsedThisMonth' | 'frozenDates'> {
    const today = todayStr();
    const yesterday = yesterdayStr();
    let dayStreak = stats.dayStreak;
    let streakFreezes = stats.streakFreezes;
    let freezesUsedThisMonth = stats.freezesUsedThisMonth;
    let frozenDates = [...stats.frozenDates];

    if (stats.lastSessionDate === today) {
        // Already counted today — no change
    } else if (stats.lastSessionDate === yesterday) {
        // Consecutive day — extend streak
        dayStreak += 1;
    } else if (stats.lastSessionDate && stats.dayStreak > 0) {
        // Gap detected — check how many days missed
        const lastDate = new Date(stats.lastSessionDate + 'T00:00:00');
        const todayDate = new Date(today + 'T00:00:00');
        const gapDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000) - 1;

        if (isPro && gapDays > 0 && gapDays <= streakFreezes) {
            // Use freezes to cover missed days
            for (let i = 1; i <= gapDays; i++) {
                const missedDate = new Date(lastDate);
                missedDate.setDate(missedDate.getDate() + i);
                frozenDates.push(missedDate.toISOString().slice(0, 10));
            }
            streakFreezes -= gapDays;
            freezesUsedThisMonth += gapDays;
            dayStreak += gapDays + 1; // extend streak through frozen days + today
        } else {
            // No freezes or not Pro — reset streak
            dayStreak = 1;
        }
    } else {
        // First ever session
        dayStreak = 1;
    }

    // Keep only last 90 days of frozenDates
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    frozenDates = frozenDates.filter(d => new Date(d + 'T00:00:00') >= cutoff);

    return {
        dayStreak,
        bestDayStreak: Math.max(stats.bestDayStreak, dayStreak),
        lastSessionDate: today,
        streakFreezes,
        freezesUsedThisMonth,
        frozenDates,
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

    // ── Task Label ──
    taskLabel: string;

    // ── Notes ──
    focusNotes: string;

    // ── Auto-Flow (task-driven auto-break) ──
    autoFlowEnabled: boolean;           // toggle task-driven breaks
    pendingNextStepIndex: number | null; // step to auto-start after break

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

    // ── AI Task Actions ──
    addAITasks: (steps: import('../types/agent').TaskStep[]) => void;

    // ── Step-Timer Sync ──
    activeStepIndex: number | null;
    startStepTimer: (index: number, minutes: number) => void;
    clearActiveStep: () => void;

    // ── Auto-Flow Actions ──
    setAutoFlow: (enabled: boolean) => void;

    // ── Task Label Actions ──
    setTaskLabel: (text: string) => void;

    // ── Notes Actions ──
    setFocusNotes: (text: string) => void;

    // ── Timer complete flash ──
    timerJustCompleted: TimerMode | null;
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
    taskLabel: (() => { try { return localStorage.getItem(TASK_LABEL_KEY) ?? ''; } catch { return ''; } })(),
    focusNotes: loadNotes(),
    timerJustCompleted: null,
    activeStepIndex: null,
    autoFlowEnabled: false,
    pendingNextStepIndex: null,

    // ── Pomodoro ──
    startTimer: () => {
        const state = get();
        if (state.timerMode === 'work') {
            trackProductEvent('focus_start', {
                workDuration: Math.round(state.workDuration / 60),
                timerMode: state.timerMode,
            });
        }
        set({ isTimerRunning: true });
    },

    pauseTimer: () => set({ isTimerRunning: false }),

    resetTimer: () => {
        const state = get();
        if (state.isTimerRunning && state.timerMode === 'work') {
            trackProductEvent('focus_abort', {
                timeRemaining: state.timeRemaining,
                workDuration: Math.round(state.workDuration / 60),
            });
        }
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
            const wasBreak = !wasWork;
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
            if (wasWork) {
                saveStats(newStats);
                trackProductEvent('focus_complete', {
                    minutes: addedMinutes,
                    pomodoroCount: newCount,
                });
            }

            // ── Auto-Flow: break ended → auto-start next step ──
            if (wasBreak && state.autoFlowEnabled && state.pendingNextStepIndex !== null) {
                const pendingIdx = state.pendingNextStepIndex;
                // Find the AI task at this step index to get its duration
                const aiTasks = state.tasks.filter(t => t.isAIGenerated);
                const nextTask = aiTasks[pendingIdx];
                const nextMinutes = nextTask?.estimatedMinutes || 25;
                const nextSeconds = Math.max(1, nextMinutes) * 60;

                set({
                    timerMode: 'work',
                    workDuration: nextSeconds,
                    timeRemaining: nextSeconds,
                    isTimerRunning: true,
                    pomodoroCount: newCount,
                    stats: newStats,
                    timerJustCompleted: state.timerMode,
                    activeStepIndex: pendingIdx,
                    pendingNextStepIndex: null,
                });
                // Auto-clear flash after 3s
                setTimeout(() => set({ timerJustCompleted: null }), 3000);
                return;
            }

            set({
                timerMode: nextMode,
                timeRemaining: getDuration(nextMode, state),
                isTimerRunning: false,
                pomodoroCount: newCount,
                stats: newStats,
                timerJustCompleted: state.timerMode,
            });
            // Auto-clear flash after 3s
            setTimeout(() => set({ timerJustCompleted: null }), 3000);
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

    toggleTask: (id) => {
        const state = get();
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;

        const wasCompleted = task.completed;
        const isNowCompleting = !wasCompleted; // ticking ON
        const newStats = isNowCompleting
            ? { ...state.stats, tasksCompleted: state.stats.tasksCompleted + 1 }
            : { ...state.stats, tasksCompleted: Math.max(0, state.stats.tasksCompleted - 1) };
        saveStats(newStats);

        const updatedTasks = state.tasks.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
        );

        // ── Auto-Flow: completing a task during work → auto break ──
        if (
            isNowCompleting &&
            state.autoFlowEnabled &&
            state.timerMode === 'work' &&
            state.isTimerRunning &&
            task.isAIGenerated
        ) {
            // Find next uncompleted AI step
            const aiTasks = updatedTasks.filter(t => t.isAIGenerated);
            const nextIdx = aiTasks.findIndex(t => !t.completed);

            // Calculate actual focused minutes for this session
            const elapsedSeconds = state.workDuration - state.timeRemaining;
            const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

            // Update stats with actual time
            const autoStats = {
                ...newStats,
                sessionsCompleted: newStats.sessionsCompleted + 1,
                totalFocusMinutes: newStats.totalFocusMinutes + actualMinutes,
                currentStreak: newStats.currentStreak + 1,
                todayMinutes: (newStats.todayDate === todayStr() ? newStats.todayMinutes : 0) + actualMinutes,
                todayDate: todayStr(),
                focusHistory: recordHistory(newStats.focusHistory, actualMinutes),
                hourlyHistory: recordHourly(newStats.hourlyHistory),
                ...computeDayStreak(newStats),
            };
            saveStats(autoStats);

            set({
                tasks: updatedTasks,
                stats: autoStats,
                // Skip to break & auto-start it
                timerMode: 'shortBreak',
                timeRemaining: state.shortBreakDuration,
                isTimerRunning: true,   // auto-start break
                pomodoroCount: state.pomodoroCount + 1,
                timerJustCompleted: 'work',
                pendingNextStepIndex: nextIdx >= 0 ? nextIdx : null,
                activeStepIndex: null,  // clear current step
            });
            setTimeout(() => set({ timerJustCompleted: null }), 3000);
            return;
        }

        set({ tasks: updatedTasks, stats: newStats });
    },

    removeTask: (id) =>
        set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
        })),

    clearCompletedTasks: () =>
        set((state) => ({
            tasks: state.tasks.filter((t) => !t.completed),
        })),

    // ── AI Tasks ──
    addAITasks: (steps) => {
        trackProductEvent('task_breakdown', { stepCount: steps.length });
        set((state) => ({
            tasks: [
                ...state.tasks,
                ...steps.map((step) => ({
                    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    text: `${step.emoji} ${step.text}`,
                    completed: false,
                    createdAt: Date.now(),
                    isAIGenerated: true,
                    emoji: step.emoji,
                    estimatedMinutes: step.estimatedMinutes,
                    definitionOfDone: step.definitionOfDone,
                })),
            ],
            activeStepIndex: null,
            autoFlowEnabled: true,
            pendingNextStepIndex: null,
        }));
    },

    // ── Step-Timer Sync ──
    startStepTimer: (index, minutes) => {
        const seconds = Math.max(1, minutes) * 60;
        set({
            activeStepIndex: index,
            workDuration: seconds,
            timeRemaining: seconds,
            timerMode: 'work',
            isTimerRunning: true,
        });
    },

    clearActiveStep: () => set({ activeStepIndex: null }),

    // ── Auto-Flow ──
    setAutoFlow: (enabled) => set({ autoFlowEnabled: enabled, pendingNextStepIndex: null }),

    // ── Task Label ──
    setTaskLabel: (text) => {
        try { localStorage.setItem(TASK_LABEL_KEY, text); } catch { /* ignore */ }
        set({ taskLabel: text });
    },

    // ── Notes ──
    setFocusNotes: (text) => {
        saveNotes(text);
        set({ focusNotes: text });
    },
}));
