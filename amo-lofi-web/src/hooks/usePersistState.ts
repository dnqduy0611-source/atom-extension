/**
 * usePersistState — Debounced save of current mixer config → Supabase `lofi_state`.
 *
 * Only saves for logged-in users. Debounces rapid changes (e.g. volume slider).
 * Does NOT handle restore (see useRestoreState for that).
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLofiStore } from '../store/useLofiStore';
import { useAuth } from './useAuth';
import { scenes } from '../data/scenes';

const DEBOUNCE_MS = 2000; // 2s debounce — avoid excessive writes

export function usePersistState() {
    const { user } = useAuth();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevSnapshotRef = useRef<string>('');

    useEffect(() => {
        if (!user) return;

        const unsubscribe = useLofiStore.subscribe((state) => {
            // Build snapshot of sync-relevant state
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

            // Debounce writes
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const { error } = await supabase.from('lofi_state').upsert({
                        user_id: user.id,
                        active_config: {
                            scene_id: state.activeSceneId,
                            variant: state.activeVariant,
                            music: state.musicTrack,
                            ambience: activeLayers,
                            // Include scene visuals for extension sync
                            bg_url: (() => {
                                const s = scenes.find(s => s.id === state.activeSceneId);
                                return s?.background?.[state.activeVariant] || s?.background?.day || '';
                            })(),
                            tint: (() => {
                                const s = scenes.find(s => s.id === state.activeSceneId);
                                return s?.background?.tint?.[state.activeVariant] || 'rgba(0,0,0,0.4)';
                            })(),
                            primary_color: (() => {
                                const s = scenes.find(s => s.id === state.activeSceneId);
                                return s?.theme?.[state.activeVariant]?.primary || '#10b981';
                            })(),
                        },
                        is_playing: state.isPlaying,
                        master_volume: state.masterVolume,
                        last_device: 'web',
                        last_active_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' });

                    if (error) {
                        console.warn('[PersistState] Save failed:', error.message);
                    }
                } catch (err) {
                    console.warn('[PersistState] Save error:', err);
                }
            }, DEBOUNCE_MS);
        });

        return () => {
            unsubscribe();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [user]);
}
