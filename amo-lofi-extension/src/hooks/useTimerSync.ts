/**
 * useTimerSync — Listens for timer_sync events from AmoLofi Web
 * via Supabase Realtime, and applies them to the extension timer
 * through chrome.runtime.sendMessage (which wakes the service worker).
 *
 * This runs in the newtab PAGE context (not service worker),
 * so the WebSocket connection stays alive as long as the tab is open.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { sendTimerCommand } from './useTimerState';
import type { RealtimeChannel } from '@supabase/supabase-js';

let _syncInProgress = false;

export function useTimerSync() {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function init() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id || cancelled) return;

            const channelName = `lofi:${session.user.id}`;

            // Avoid duplicate subscriptions
            if (channelRef.current) return;

            const channel = supabase.channel(channelName, {
                config: { broadcast: { self: false } },
            });

            channel.on('broadcast', { event: 'timer_sync' }, ({ payload }) => {
                if (payload?.source === 'extension') return; // ignore own echo
                console.log('[TimerSync:Page] Received from web:', payload?.action);

                _syncInProgress = true;
                switch (payload?.action) {
                    case 'start':
                        sendTimerCommand('start', { task: payload.task });
                        break;
                    case 'pause':
                        sendTimerCommand('pause');
                        break;
                    case 'reset':
                        sendTimerCommand('reset');
                        break;
                    case 'skip':
                        sendTimerCommand('skip');
                        break;
                }
                setTimeout(() => { _syncInProgress = false; }, 100);
            });

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[TimerSync:Page] ✅ Connected: ${channelName}`);
                }
            });

            channelRef.current = channel;
        }

        init();

        // Re-init on auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' && !channelRef.current) {
                init();
            } else if (event === 'SIGNED_OUT' && channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, []);

    return { syncInProgress: _syncInProgress };
}
