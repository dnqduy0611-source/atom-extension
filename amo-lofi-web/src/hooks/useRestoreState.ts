/**
 * useRestoreState — Load last mixer config from Supabase `lofi_state` on app open.
 *
 * On mount (logged-in user): queries lofi_state → applies via applyConfig().
 * Only restores once per session to avoid overwriting user changes.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useLofiStore } from '../store/useLofiStore';
import { useAuth } from './useAuth';

export function useRestoreState() {
    const { user } = useAuth();
    const restoredRef = useRef(false);

    useEffect(() => {
        if (!user || restoredRef.current) return;

        async function restore() {
            try {
                const { data, error } = await supabase
                    .from('lofi_state')
                    .select('active_config, is_playing, master_volume')
                    .eq('user_id', user!.id)
                    .single();

                if (error || !data?.active_config) return;

                const config = data.active_config;

                // Validate config shape before applying
                if (!config.scene_id) return;

                useLofiStore.getState().applyConfig({
                    scene_id: config.scene_id,
                    variant: config.variant || 'day',
                    music: config.music || null,
                    ambience: (config.ambience || []).map((a: { id: string; volume: number }) => ({
                        id: a.id,
                        volume: a.volume ?? 0.5,
                    })),
                });

                // Restore volume
                if (typeof data.master_volume === 'number') {
                    useLofiStore.getState().setMasterVolume(data.master_volume);
                }

                // Note: we intentionally do NOT restore is_playing
                // to avoid auto-playing audio on page load (bad UX + browser policy)

                restoredRef.current = true;
                console.log('[RestoreState] ✅ Restored config:', config.scene_id);
            } catch (err) {
                console.warn('[RestoreState] Restore error:', err);
            }
        }

        restore();
    }, [user]);
}
