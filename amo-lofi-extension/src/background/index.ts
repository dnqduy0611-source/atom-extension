// AmoLofi Extension — Service Worker (Background)
// Handles timer, notifications, blocker, and message routing.

import { handleTimerCommand, handleTimerTick } from './timer';
import { initBlocker } from './blocker';
import { supabase } from '../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ALARM_NAME = 'amo-timer-tick';

// ── Timer Sync State ──
let _syncChannel: RealtimeChannel | null = null;
let _timerSyncInProgress = false;

// ── Install ──
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[AmoLofi] Extension installed successfully.');
    }
});

// ── Initialize blocker ──
initBlocker();

// ── Alarm handler ──
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        await handleTimerTick();
    }
});

// ── Message handler ──
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'timer') {
        handleTimerCommand(message.action, message.payload)
            .then(() => sendResponse({ ok: true }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true; // keep channel open for async response
    }
});

// ══════════════════════════════════════════════════════
//  TIMER SYNC — Supabase Realtime (lofi:{userId})
// ══════════════════════════════════════════════════════

/**
 * Initialize timer sync channel for bidirectional sync with AmoLofi Web.
 */
async function initTimerSync() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
            console.log('[TimerSync] No auth session, skipping');
            return;
        }

        const userId = session.user.id;
        const channelName = `lofi:${userId}`;

        // Don't reconnect if already on same channel
        if (_syncChannel) {
            console.log('[TimerSync] Already connected');
            return;
        }

        _syncChannel = supabase.channel(channelName, {
            config: { broadcast: { self: false } },
        });

        // Listen for timer sync from AmoLofi Web
        _syncChannel.on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
            if (payload?.source === 'extension') return;
            console.log('[TimerSync] Received from web:', payload?.action);
            handleRemoteTimerSync(payload);
        });

        _syncChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[TimerSync] ✅ Connected to ${channelName}`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[TimerSync] ❌ Channel error`);
                _syncChannel = null;
            }
        });
    } catch (e) {
        console.warn('[TimerSync] Init failed:', e);
    }
}

/**
 * Handle incoming timer sync from web → apply to extension timer state.
 */
async function handleRemoteTimerSync(payload: any) {
    _timerSyncInProgress = true;
    try {
        switch (payload?.action) {
            case 'start':
                await handleTimerCommand('start', {
                    task: payload.task,
                });
                // Also set duration if provided
                if (payload.duration) {
                    await handleTimerCommand('setDuration', {
                        minutes: Math.round(payload.duration / 60),
                    });
                    await handleTimerCommand('start', { task: payload.task });
                }
                break;
            case 'pause':
                await handleTimerCommand('pause');
                break;
            case 'reset':
                await handleTimerCommand('reset');
                break;
            case 'skip':
                await handleTimerCommand('skip');
                break;
        }
    } catch (e) {
        console.warn('[TimerSync] Apply failed:', e);
    } finally {
        setTimeout(() => { _timerSyncInProgress = false; }, 100);
    }
}

/**
 * Broadcast a timer event to the web via Supabase Realtime.
 */
function broadcastTimerSync(action: string, data: Record<string, unknown> = {}) {
    if (!_syncChannel) return;
    _syncChannel.send({
        type: 'broadcast',
        event: 'timer_sync',
        payload: { action, ...data, source: 'extension', timestamp: Date.now() },
    });
    console.log('[TimerSync] Sent to web:', action);
}

import { type TimerState } from '../storage/timer';

// ── Watch timer state changes → broadcast to web ──
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.timerState || _timerSyncInProgress || !_syncChannel) return;

    const oldState = (changes.timerState.oldValue || {}) as Partial<TimerState>;
    const newState = (changes.timerState.newValue || {}) as Partial<TimerState>;

    // Detect start
    if (newState.isRunning && !oldState.isRunning) {
        broadcastTimerSync('start', {
            duration: newState.duration,
            remaining: newState.remaining,
            task: newState.task,
            mode: newState.mode === 'focus' ? 'work' : 'shortBreak',
        });
    }
    // Detect pause
    else if (!newState.isRunning && oldState.isRunning) {
        broadcastTimerSync('pause', {
            remaining: newState.remaining,
            mode: newState.mode === 'focus' ? 'work' : 'shortBreak',
        });
    }
    // Detect mode change (skip/complete)
    else if (newState.mode !== oldState.mode && !newState.isRunning) {
        if (newState.mode === 'idle') {
            broadcastTimerSync('reset', {});
        } else {
            broadcastTimerSync('skip', {
                mode: newState.mode === 'focus' ? 'work' : 'shortBreak',
                remaining: newState.remaining,
            });
        }
    }
});

// ── Auto-init timer sync on startup ──
initTimerSync();

// ── Re-init on auth state changes ──
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!_syncChannel) initTimerSync();
    } else if (event === 'SIGNED_OUT') {
        if (_syncChannel) {
            supabase.removeChannel(_syncChannel);
            _syncChannel = null;
        }
    }
});
