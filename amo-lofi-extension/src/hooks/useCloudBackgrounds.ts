/**
 * useCloudBackgrounds — Fetches user's custom backgrounds from Supabase.
 *
 * Returns backgrounds (AI-generated + uploaded) with signed URLs,
 * grouped by scene via the scene_backgrounds mapping table.
 *
 * Only fetches when user is logged in; returns empty array otherwise.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

export interface CloudBackground {
    id: string;
    name: string;
    signedUrl: string;
    source: 'upload' | 'ai_generated' | 'community';
    sceneIds: string[];
}

export function useCloudBackgrounds() {
    const [backgrounds, setBackgrounds] = useState<CloudBackground[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setBackgrounds([]);
                return;
            }

            setLoading(true);

            // 1. Fetch background metadata
            const { data: bgs, error: fetchError } = await supabase
                .from('user_backgrounds')
                .select('id, name, source, storage_path')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (fetchError || !bgs || bgs.length === 0) {
                setBackgrounds([]);
                return;
            }

            // 2. Get signed URLs (24h validity)
            const paths = bgs.map((bg: { storage_path: string }) => bg.storage_path);
            const { data: signedUrls } = await supabase.storage
                .from('user-backgrounds')
                .createSignedUrls(paths, 60 * 60 * 24);

            const urlMap = new Map<string, string>();
            signedUrls?.forEach((item: { path?: string | null; signedUrl?: string }) => {
                if (item.path && item.signedUrl) {
                    urlMap.set(item.path, item.signedUrl);
                    urlMap.set(item.path.replace(/^\//, ''), item.signedUrl);
                }
            });

            // 3. Fetch scene mappings
            const { data: mappings } = await supabase
                .from('scene_backgrounds')
                .select('background_id, scene_id')
                .eq('user_id', session.user.id);

            const sceneMap = new Map<string, string[]>();
            mappings?.forEach((m: { background_id: string; scene_id: string }) => {
                const existing = sceneMap.get(m.background_id) || [];
                existing.push(m.scene_id);
                sceneMap.set(m.background_id, existing);
            });

            // 4. Build result
            const result: CloudBackground[] = bgs
                .map((bg: { id: string; name: string; source: string; storage_path: string }) => ({
                    id: bg.id,
                    name: bg.name,
                    signedUrl: urlMap.get(bg.storage_path) || urlMap.get(bg.storage_path.replace(/^\//, '')) || '',
                    source: bg.source as CloudBackground['source'],
                    sceneIds: sceneMap.get(bg.id) || [],
                }))
                .filter((bg: CloudBackground) => bg.signedUrl); // Only include if URL resolved

            setBackgrounds(result);
        } catch (err) {
            console.warn('[CloudBackgrounds] Failed to fetch:', err);
            setBackgrounds([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch on mount
    useEffect(() => { refresh(); }, [refresh]);

    // Re-fetch when auth state changes
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            refresh();
        });
        return () => subscription.unsubscribe();
    }, [refresh]);

    return { backgrounds, loading, refresh };
}
