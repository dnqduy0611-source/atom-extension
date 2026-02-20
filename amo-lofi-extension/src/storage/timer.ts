/**
 * Timer state management via chrome.storage.local.
 * All timer state persists across SW restarts and syncs across tabs.
 */

export interface TimerState {
    mode: 'idle' | 'focus' | 'break';
    remaining: number;       // seconds remaining
    duration: number;        // total duration in seconds
    task: string;            // current focus task text
    isRunning: boolean;
    lastTick: number;        // Date.now() of last tick
}

export const DEFAULT_TIMER: TimerState = {
    mode: 'idle',
    remaining: 25 * 60,
    duration: 25 * 60,
    task: '',
    isRunning: false,
    lastTick: 0,
};

export const TIMER_PRESETS = {
    focus: [15, 25, 30, 45, 60],
    break: [5, 10, 15],
    default: { focus: 25, break: 5 },
};

export async function getTimerState(): Promise<TimerState> {
    const result = await chrome.storage.local.get('timerState');
    return (result.timerState as TimerState) || { ...DEFAULT_TIMER };
}

export async function saveTimerState(state: TimerState): Promise<void> {
    await chrome.storage.local.set({ timerState: state });
}
