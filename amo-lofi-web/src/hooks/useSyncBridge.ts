/**
 * useSyncBridge — Broadcast AmoLofi state to Extension via Supabase Realtime
 *
 * Features:
 *   1. Broadcasts `config_change` events on store changes (debounced)
 *   2. Listens for incoming `config_change` from Extension → applies to store
 *   3. Presence tracking: knows which devices are online (web, extension)
 *   4. Focus commands: `focus_command` (enter/exit Zen), `timer_sync`
 *
 * The Extension's `lofi_sync.js` listens on the same channel.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLofiStore } from '../store/useLofiStore';
import { supabase } from '../lib/supabaseClient';
import { scenes } from '../data/scenes';

/** Resolve scene visual metadata for syncing to extension */
function getSceneVisuals(sceneId: string, variant: 'day' | 'night', customScenes: any[]) {
    const scene = scenes.find(s => s.id === sceneId)
        ?? customScenes.find(s => s.id === sceneId);
    if (!scene) return {};
    return {
        bg_url: scene.background?.[variant] || scene.background?.day || '',
        tint: scene.background?.tint?.[variant] || 'rgba(0,0,0,0.4)',
        primary_color: scene.theme?.[variant]?.primary || '#10b981',
    };
}
import type { RealtimeChannel } from '@supabase/supabase-js';

const DEBOUNCE_MS = 300; // debounce rapid state changes

// ── Types ──

export interface ConnectedDevice {
    device: 'web' | 'extension';
    joined_at: number;
}

export interface SyncBridgeState {
    isConnected: boolean;
    connectedDevices: ConnectedDevice[];
    extensionOnline: boolean;
}

// ── Hook ──

export function useSyncBridge(userId: string | null | undefined) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevSnapshotRef = useRef<string>('');

    // Presence state
    const [syncState, setSyncState] = useState<SyncBridgeState>({
        isConnected: false,
        connectedDevices: [],
        extensionOnline: false,
    });

    // ── Broadcast helper (exposed for external use) ──
    const broadcastFocusCommand = useCallback((command: string, data?: Record<string, unknown>) => {
        channelRef.current?.send({
            type: 'broadcast',
            event: 'focus_command',
            payload: { command, data, source: 'web', timestamp: Date.now() },
        });
    }, []);

    // ── Connect / Disconnect channel based on userId ──
    useEffect(() => {
        if (!userId) {
            // Disconnect if logged out
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setSyncState({ isConnected: false, connectedDevices: [], extensionOnline: false });
                console.log('[SyncBridge] Disconnected (no user)');
            }
            return;
        }

        const channelName = `lofi:${userId}`;
        const channel = supabase.channel(channelName, {
            config: {
                broadcast: { self: false },
                presence: { key: 'web' },
            },
        });

        // ── PRESENCE: Track online devices ──
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const devices: ConnectedDevice[] = [];

            for (const [, presences] of Object.entries(state)) {
                for (const p of presences as Array<Record<string, unknown>>) {
                    devices.push({
                        device: (p.device as 'web' | 'extension') || 'web',
                        joined_at: (p.joined_at as number) || Date.now(),
                    });
                }
            }

            const extensionOnline = devices.some(d => d.device === 'extension');
            setSyncState({
                isConnected: true,
                connectedDevices: devices,
                extensionOnline,
            });

            if (extensionOnline) {
                console.log('[SyncBridge] 🔗 Extension connected');
            }
        });

        // ── BROADCAST: Incoming config from Extension ──
        channel.on('broadcast', { event: 'config_change' }, ({ payload }) => {
            if (payload?.source === 'web') return; // ignore own echo

            const config = payload?.config;
            if (config?.scene_id) {
                // Conflict resolution: only apply if incoming is newer
                const lastLocal = useLofiStore.getState().lastChangeTimestamp;
                const incoming = payload?.timestamp || 0;
                if (incoming > 0 && incoming < lastLocal - 100) {
                    console.log('[SyncBridge] Ignoring stale config from extension');
                    return;
                }

                useLofiStore.getState().applyConfig({
                    scene_id: config.scene_id,
                    variant: config.variant || 'day',
                    music: config.music || null,
                    ambience: (config.ambience || []).map((a: { id: string; volume: number }) => ({
                        id: a.id,
                        volume: a.volume ?? 0.5,
                    })),
                });

                // Also apply master volume if provided
                if (typeof config.masterVolume === 'number') {
                    useLofiStore.getState().setMasterVolume(config.masterVolume);
                }
            }
        });

        // ── BROADCAST: Focus commands from Extension ──
        channel.on('broadcast', { event: 'focus_command' }, ({ payload }) => {
            if (payload?.source === 'web') return;

            switch (payload?.command) {
                case 'enter_zen':
                    useLofiStore.getState().setZenMode(true);
                    break;
                case 'exit_zen':
                    useLofiStore.getState().setZenMode(false);
                    break;
                case 'toggle_play':
                    useLofiStore.getState().togglePlay();
                    break;
            }
        });

        // ── Subscribe + track Presence ──
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[SyncBridge] ✅ Connected: ${channelName}`);

                // Track presence
                await channel.track({ device: 'web', joined_at: Date.now() });

                // ── Initial sync: broadcast current state immediately ──
                const state = useLofiStore.getState();
                const activeLayers = state.ambienceLayers
                    .filter((l) => l.active)
                    .map((l) => ({ id: l.id, volume: l.volume }));

                const visuals = getSceneVisuals(state.activeSceneId, state.activeVariant, []);
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
                            ...visuals,
                        },
                        timestamp: Date.now(),
                    },
                });

                setSyncState(prev => ({ ...prev, isConnected: true }));
                console.log('[SyncBridge] 📡 Initial sync sent:', state.activeSceneId);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[SyncBridge] ❌ Channel error: ${channelName}`);
                setSyncState(prev => ({ ...prev, isConnected: false }));
            }
        });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
            setSyncState({ isConnected: false, connectedDevices: [], extensionOnline: false });
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

                const visuals = getSceneVisuals(state.activeSceneId, state.activeVariant, []);
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
                            ...visuals,
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

    return { syncState, broadcastFocusCommand };
}
