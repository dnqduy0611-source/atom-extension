/**
 * Timer logic for Service Worker.
 * Uses chrome.alarms instead of setInterval (MV3 SW gets killed after ~30s).
 * Elapsed-time calculation handles SW sleep/delay gracefully.
 */

import {
    getTimerState,
    saveTimerState,
    DEFAULT_TIMER,
    TIMER_PRESETS,
    type TimerState,
} from '../storage/timer';

const ALARM_NAME = 'amo-timer-tick';

/** Increment rating session count (for CWS rating prompt) */
async function incrementRatingCount() {
    const result = await chrome.storage.local.get('ratingState');
    const state = (result.ratingState as { sessionsCompleted: number; dismissed: boolean; nextPromptAt: number })
        ?? { sessionsCompleted: 0, dismissed: false, nextPromptAt: 5 };
    state.sessionsCompleted++;
    await chrome.storage.local.set({ ratingState: state });
}

// ── Notification helper ──
function showNotification(title: string, message: string) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
        title,
        message,
    });
}

// ── Timer commands (called via chrome.runtime.onMessage) ──

export async function handleTimerCommand(action: string, payload?: any) {
    const state = await getTimerState();

    switch (action) {
        case 'start': {
            if (state.mode === 'idle') {
                state.mode = 'focus';
                state.remaining = state.duration;
            }
            state.isRunning = true;
            state.lastTick = Date.now();
            if (payload?.task) state.task = payload.task;
            await saveTimerState(state);
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
            break;
        }

        case 'pause': {
            // Calculate remaining before pausing
            if (state.isRunning) {
                const elapsed = Math.floor((Date.now() - state.lastTick) / 1000);
                state.remaining = Math.max(0, state.remaining - elapsed);
            }
            state.isRunning = false;
            state.lastTick = 0;
            await saveTimerState(state);
            chrome.alarms.clear(ALARM_NAME);
            break;
        }

        case 'reset': {
            const resetState: TimerState = {
                ...DEFAULT_TIMER,
                duration: TIMER_PRESETS.default.focus * 60,
                remaining: TIMER_PRESETS.default.focus * 60,
            };
            await saveTimerState(resetState);
            chrome.alarms.clear(ALARM_NAME);
            break;
        }

        case 'skip': {
            chrome.alarms.clear(ALARM_NAME);
            if (state.mode === 'focus') {
                const breakState: TimerState = {
                    mode: 'break',
                    remaining: TIMER_PRESETS.default.break * 60,
                    duration: TIMER_PRESETS.default.break * 60,
                    task: state.task,
                    isRunning: false,
                    lastTick: 0,
                };
                await saveTimerState(breakState);
                showNotification('Focus skipped', 'Time for a break 🎉');
            } else {
                await saveTimerState({
                    ...DEFAULT_TIMER,
                    duration: TIMER_PRESETS.default.focus * 60,
                    remaining: TIMER_PRESETS.default.focus * 60,
                });
                showNotification('Break skipped', 'Ready for another focus session?');
            }
            break;
        }

        case 'setDuration': {
            if (payload?.minutes && !state.isRunning) {
                state.duration = payload.minutes * 60;
                state.remaining = payload.minutes * 60;
                await saveTimerState(state);
            }
            break;
        }
    }
}

// ── Alarm tick handler ──

export async function handleTimerTick() {
    const state = await getTimerState();

    if (!state.isRunning) {
        chrome.alarms.clear(ALARM_NAME);
        return;
    }

    const now = Date.now();
    const elapsed = Math.floor((now - state.lastTick) / 1000);
    state.remaining = Math.max(0, state.remaining - elapsed);
    state.lastTick = now;

    if (state.remaining <= 0) {
        // Timer completed
        state.isRunning = false;
        chrome.alarms.clear(ALARM_NAME);

        if (state.mode === 'focus') {
            state.mode = 'break';
            state.remaining = TIMER_PRESETS.default.break * 60;
            state.duration = TIMER_PRESETS.default.break * 60;
            showNotification('Focus complete! 🎉', `Great work on "${state.task || 'your task'}"! Time for a break.`);
            // Track completed sessions for CWS rating prompt
            incrementRatingCount();
        } else {
            state.mode = 'idle';
            state.remaining = TIMER_PRESETS.default.focus * 60;
            state.duration = TIMER_PRESETS.default.focus * 60;
            state.task = '';
            showNotification('Break over! 💪', 'Ready for another focus session?');
        }
    }

    await saveTimerState(state);
}
