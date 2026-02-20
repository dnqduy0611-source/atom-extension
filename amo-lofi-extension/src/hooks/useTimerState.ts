import { useState, useEffect } from 'react';
import { getTimerState, type TimerState, DEFAULT_TIMER } from '../storage/timer';

/**
 * useTimerState — Reactive timer state hook.
 * Loads initial state from chrome.storage.local, then listens for changes
 * from the Service Worker or other tabs via chrome.storage.onChanged.
 *
 * Also runs a local 1s interval to keep countdown display accurate
 * (since chrome.alarms has ~1min minimum and may delay).
 */
export function useTimerState() {
    const [state, setState] = useState<TimerState>({ ...DEFAULT_TIMER });

    useEffect(() => {
        // Load initial
        getTimerState().then(setState);

        // Listen for storage changes (multi-tab sync)
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            if (area === 'local' && changes.timerState) {
                setState(changes.timerState.newValue as TimerState);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Local countdown for smooth display
    // Service Worker alarm is the source of truth, but we interpolate locally
    useEffect(() => {
        if (!state.isRunning) return;

        const interval = setInterval(() => {
            setState((prev) => {
                if (!prev.isRunning || prev.remaining <= 0) return prev;
                const elapsed = Math.floor((Date.now() - prev.lastTick) / 1000);
                const remaining = Math.max(0, prev.duration - (prev.duration - prev.remaining + elapsed));
                return { ...prev, remaining: Math.max(0, prev.remaining - 1) };
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [state.isRunning, state.lastTick]);

    return state;
}

/**
 * Send a timer command to the Service Worker.
 */
export function sendTimerCommand(action: string, payload?: any) {
    chrome.runtime.sendMessage({ type: 'timer', action, payload });
}
