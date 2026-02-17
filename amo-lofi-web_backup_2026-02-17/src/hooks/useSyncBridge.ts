/**
 * useSyncBridge — Broadcast AmoLofi state to Extension via Supabase Realtime
 *
 * Subscribes to Zustand store changes and broadcasts `config_change` and
 * `playback_change` events to the `lofi:{userId}` Supabase Realtime channel.
 * The Extension's `lofi_sync.js` listens on the same channel.
 *
 * Debounces rapid changes (e.g., volume slider dragging) to avoid flooding.
 */

import { useEffect, useRef } from 'react';
import { useLofiStore } from '../store/useLofiStore';
import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 300; // debounce rapid state changes

export function useSyncBridge(userId: string | null | undefined) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevSnapshotRef = useRef<string>('');

    // ── Connect / Disconnect channel based on userId ──
    useEffect(() => {
        if (!userId) {
            // Disconnect if logged out
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                console.log('[SyncBridge] Disconnected (no user)');
            }
            return;
        }

        const channelName = `lofi:${userId}`;
        const channel = supabase.channel(channelName, {
            config: { broadcast: { self: false } },
        });

        // Also listen for incoming config from Extension
        channel.on('broadcast', { event: 'config_change' }, ({ payload }) => {
            if (payload?.source === 'web') return; // ignore own echo
            // Extension sent config → apply to store
            const config = payload?.config;
            if (config?.scene_id) {
                useLofiStore.getState().applyConfig({
                    scene_id: config.scene_id,
                    variant: config.variant || 'day',
                    music: config.music || null,
                    ambience: (config.ambience || []).map((a: { id: string; volume: number }) => ({
                        id: a.id,
                        volume: a.volume ?? 0.5,
                    })),
                });
            }
        });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[SyncBridge] ✅ Connected: ${channelName}`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[SyncBridge] ❌ Channel error: ${channelName}`);
            }
        });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
            console.log('[SyncBridge] Cleanup');
        };
    }, [userId]);

    // ── Watch store and broadcast changes ──
    useEffect(() => {
        if (!userId) return;

        const unsubscribe = useLofiStore.subscribe((state) => {
            // Build snapshot of sync-relevant fields
            const activeLayers = state.ambienceLayers
                .filter((l) => l.active)
                .map((l) => ({ id: l.id, volume: l.volume }));

            const snapshot = JSON.stringify({
                s: state.activeSceneId,
                v: state.activeVariant,
                m: state.musicTrack,
                a: activeLayers,
                p: state.isPlaying,
                vol: state.masterVolume,
            });

            // Skip if nothing changed
            if (snapshot === prevSnapshotRef.current) return;
            prevSnapshotRef.current = snapshot;

            // Debounce to avoid flooding during slider drags
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                const channel = channelRef.current;
                if (!channel) return;

                channel.send({
                    type: 'broadcast',
                    event: 'config_change',
                    payload: {
                        source: 'web',
                        config: {
                            scene_id: state.activeSceneId,
                            variant: state.activeVariant,
                            music: state.musicTrack,
                            ambience: activeLayers,
                            isPlaying: state.isPlaying,
                            masterVolume: state.masterVolume,
                        },
                        timestamp: Date.now(),
                    },
                });
            }, DEBOUNCE_MS);
        });

        return () => {
            unsubscribe();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [userId]);
}
