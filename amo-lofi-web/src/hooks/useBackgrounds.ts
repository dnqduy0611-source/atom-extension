/**
 * useBackgrounds — CRUD hook for user's custom backgrounds (Supabase Storage).
 *
 * Manages background uploads via the upload-background Edge Function.
 * Backgrounds are stored in Supabase Storage and metadata in user_backgrounds table.
 *
 * Unlike useCustomWallpapers (IndexedDB, local-only), this hook syncs with the server
 * and persists across devices for Pro users.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabaseClient';
import { compressImage, validateImageFile } from '../utils/imageProcessing';

export interface UserBackground {
    id: string;
    name: string;
    source: 'upload' | 'ai_generated' | 'community';
    storage_path: string;
    signedUrl: string;
    file_size_bytes: number | null;
    width: number | null;
    height: number | null;
    ai_prompt: string | null;
    created_at: string;
}

const MAX_BACKGROUNDS = 50;

export function useBackgrounds() {
    const [backgrounds, setBackgrounds] = useState<UserBackground[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Fetch all user backgrounds ──
    const refresh = useCallback(async () => {
        try {
            setError(null);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setBackgrounds([]);
                setIsLoading(false);
                return;
            }

            // Fetch metadata
            const { data: bgs, error: fetchError } = await supabase
                .from('user_backgrounds')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (fetchError) {
                throw new Error(fetchError.message);
            }

            if (!bgs || bgs.length === 0) {
                setBackgrounds([]);
                setIsLoading(false);
                return;
            }

            // Get signed URLs for all backgrounds
            const paths = bgs.map((bg) => bg.storage_path);
            const { data: signedUrls } = await supabase.storage
                .from('user-backgrounds')
                .createSignedUrls(paths, 60 * 60 * 24); // 24 hours

            const urlMap = new Map<string, string>();
            signedUrls?.forEach((item) => {
                if (item.signedUrl) {
                    urlMap.set(item.path!, item.signedUrl);
                }
            });

            const mapped: UserBackground[] = bgs.map((bg) => ({
                id: bg.id,
                name: bg.name,
                source: bg.source,
                storage_path: bg.storage_path,
                signedUrl: urlMap.get(bg.storage_path) || '',
                file_size_bytes: bg.file_size_bytes,
                width: bg.width,
                height: bg.height,
                ai_prompt: bg.ai_prompt,
                created_at: bg.created_at,
            }));

            setBackgrounds(mapped);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        refresh();
    }, [refresh]);

    // ── Upload a new background ──
    const upload = useCallback(async (
        file: File,
        name?: string,
        sceneId?: string,
    ): Promise<UserBackground> => {
        // Validate
        validateImageFile(file);

        // Compress client-side
        const compressed = await compressImage(file);

        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not logged in');

        // Call Edge Function
        const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-background`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageBase64: compressed.base64,
                mimeType: 'image/webp',
                name: name || file.name.replace(/\.[^/.]+$/, '') || 'My Background',
                sceneId: sceneId || null,
                width: compressed.width,
                height: compressed.height,
                fileSize: compressed.compressedSize,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            if (data.code === 'INSUFFICIENT_CREDITS') {
                throw Object.assign(new Error('Không đủ credits.'), { code: 'INSUFFICIENT_CREDITS' });
            }
            if (data.code === 'NOT_PRO') {
                throw Object.assign(new Error('Cần nâng cấp Pro.'), { code: 'NOT_PRO' });
            }
            if (data.code === 'STORAGE_LIMIT') {
                throw Object.assign(new Error(`Đã đạt giới hạn ${MAX_BACKGROUNDS} backgrounds.`), { code: 'STORAGE_LIMIT' });
            }
            throw new Error(data.error || 'Upload failed');
        }

        const newBg: UserBackground = {
            id: data.background.id,
            name: data.background.name,
            source: 'upload',
            storage_path: data.background.storage_path,
            signedUrl: data.background.signedUrl || '',
            file_size_bytes: data.background.file_size_bytes,
            width: data.background.width,
            height: data.background.height,
            ai_prompt: null,
            created_at: data.background.created_at,
        };

        setBackgrounds((prev) => [newBg, ...prev]);
        return newBg;
    }, []);

    // ── Delete a background ──
    const remove = useCallback(async (bgId: string) => {
        const bg = backgrounds.find((b) => b.id === bgId);
        if (!bg) return;

        // Delete from storage
        await supabase.storage
            .from('user-backgrounds')
            .remove([bg.storage_path]);

        // Delete metadata
        await supabase
            .from('user_backgrounds')
            .delete()
            .eq('id', bgId);

        // Delete scene mappings
        await supabase
            .from('scene_backgrounds')
            .delete()
            .eq('background_id', bgId);

        setBackgrounds((prev) => prev.filter((b) => b.id !== bgId));
    }, [backgrounds]);

    // ── Apply background to scene ──
    const applyToScene = useCallback(async (bgId: string, sceneId: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await supabase.from('scene_backgrounds').upsert({
            user_id: session.user.id,
            scene_id: sceneId,
            background_id: bgId,
            is_active: true,
        }, {
            onConflict: 'user_id,scene_id,background_id',
        });
    }, []);

    // ── Get backgrounds applied to a scene ──
    const getSceneBackgrounds = useCallback(async (sceneId: string): Promise<UserBackground[]> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const { data: mappings } = await supabase
            .from('scene_backgrounds')
            .select('background_id')
            .eq('user_id', session.user.id)
            .eq('scene_id', sceneId)
            .eq('is_active', true);

        if (!mappings || mappings.length === 0) return [];

        const bgIds = new Set(mappings.map((m) => m.background_id));
        return backgrounds.filter((b) => bgIds.has(b.id));
    }, [backgrounds]);

    return {
        backgrounds,
        isLoading,
        error,
        count: backgrounds.length,
        isFull: backgrounds.length >= MAX_BACKGROUNDS,
        upload,
        remove,
        applyToScene,
        getSceneBackgrounds,
        refresh,
    };
}
