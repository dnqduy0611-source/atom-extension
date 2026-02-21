import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { getAllScenes, addScene, deleteScene } from '../utils/idb';
import type { StoredScene } from '../utils/idb';
import type { Scene, SceneTheme } from '../data/scenes';
import { registerIconPack } from '../icons';
import { createAIIconPack } from '../icons/packs/aiPackFactory';
import { supabase } from '../lib/supabaseClient';

/**
 * useCustomScenes — CRUD for AI-generated custom scenes.
 *
 * Uses module-level shared state so all consumers (SceneSelector, useTheme,
 * SceneBackground) share the same data — prevents flickering from independent
 * IDB loads causing cascading re-renders.
 *
 * Scenes are scoped per Supabase user_id to prevent data leaks between accounts.
 */

/** Convert a StoredScene (IndexedDB) → Scene (runtime, matching built-in shape) */
function toRuntimeScene(stored: StoredScene): Scene {
    const bgBlobUrl = stored.backgroundBlob
        ? URL.createObjectURL(stored.backgroundBlob)
        : '/scenes/cafe_day.jpg'; // fallback

    // Register AI-generated icon pack if available
    if (stored.iconPaths) {
        registerIconPack(stored.id, createAIIconPack(stored.id, stored.iconPaths));
    }

    return {
        id: stored.id,
        name: stored.name,
        description: stored.description,
        thumbnail: bgBlobUrl,
        video: { day: '', night: '' },
        background: {
            day: bgBlobUrl,
            night: bgBlobUrl,
            tint: stored.tint,
        },
        wallpapers: [
            {
                id: `${stored.id}_default`,
                name: stored.name,
                src: bgBlobUrl,
                thumbnail: bgBlobUrl,
                tint: stored.tint.day,
            },
        ],
        theme: stored.theme as { day: SceneTheme; night: SceneTheme },
        staticFallback: bgBlobUrl,
        defaultAmbience: stored.defaultAmbience,
        tags: [...stored.tags, 'custom'],
    };
}

// ── Shared module-level store ──

let _scenes: Scene[] = [];
let _loadedForUser: string | null = null; // track which userId was loaded
let _loading = false;
const _listeners = new Set<() => void>();

function notify() {
    _listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
}

function getSnapshot(): Scene[] {
    return _scenes;
}

/** Load scenes for a specific user (or clear if no user) */
async function loadForUser(userId: string | null) {
    if (_loadedForUser === userId && !_loading) return;
    _loading = true;
    try {
        if (!userId) {
            // No user → no custom scenes
            _scenes = [];
            _loadedForUser = null;
            notify();
            return;
        }
        const stored = await getAllScenes(userId);
        _scenes = stored.map(toRuntimeScene);
        _loadedForUser = userId;
        notify();
    } catch (err) {
        console.error('[CustomScenes] Load error:', err);
    } finally {
        _loading = false;
    }
}

// ── Auth listener (module-level, runs once) ──
let _authListenerActive = false;

function initAuthListener() {
    if (_authListenerActive) return;
    _authListenerActive = true;

    // Load for current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
        loadForUser(session?.user?.id ?? null);
    });

    // Reload when user changes
    supabase.auth.onAuthStateChange((_event, session) => {
        const newUserId = session?.user?.id ?? null;
        if (newUserId !== _loadedForUser) {
            loadForUser(newUserId);
        }
    });
}

// ── Hook ──

/**
 * Compress an image blob to WebP at target quality using Canvas.
 * Returns the compressed blob (typically 50-70% smaller than PNG).
 */
async function compressBlob(blob: Blob, quality = 0.82): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const compressed = await canvas.convertToBlob({ type: 'image/webp', quality });
    console.log(
        `[CustomScenes] Compressed ${(blob.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${((1 - compressed.size / blob.size) * 100).toFixed(0)}% saved)`,
    );
    return compressed;
}

/**
 * Upload an AI-generated background to Supabase Storage (fire-and-forget).
 * This enables cross-device sync via the extension.
 *
 * Steps:
 *   0. Compress blob → WebP
 *   1. Upload blob → user-backgrounds bucket
 *   2. Insert metadata → user_backgrounds table
 *   3. Map to scene → scene_backgrounds table
 */
async function uploadAIBackgroundToCloud(
    blob: Blob,
    sceneId: string,
    sceneName: string,
    description: string,
    userId: string,
): Promise<void> {
    const compressed = await compressBlob(blob);
    const ts = Date.now();
    const storagePath = `${userId}/ai_${sceneId}_${ts}.webp`;

    console.log('[CustomScenes] Uploading AI background to cloud:', storagePath);

    // 1. Upload compressed blob to Storage
    const { error: uploadError } = await supabase.storage
        .from('user-backgrounds')
        .upload(storagePath, compressed, {
            contentType: 'image/webp',
            upsert: false,
        });

    if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 2. Insert metadata into user_backgrounds
    const { data: bgRow, error: insertError } = await supabase
        .from('user_backgrounds')
        .insert({
            user_id: userId,
            name: sceneName,
            description,
            source: 'ai_generated',
            storage_path: storagePath,
            file_size_bytes: compressed.size,
            ai_prompt: description,
            ai_model: 'gemini',
        })
        .select('id')
        .single();

    if (insertError) {
        throw new Error(`Metadata insert failed: ${insertError.message}`);
    }

    // 3. Map background to scene
    await supabase.from('scene_backgrounds').upsert({
        user_id: userId,
        scene_id: sceneId,
        background_id: bgRow.id,
        is_active: true,
    });

    console.log('[CustomScenes] AI background uploaded successfully:', bgRow.id);
}

/**
 * Clean up cloud storage when a custom scene is deleted.
 * Finds backgrounds mapped to this scene, deletes Storage files + DB rows.
 */
async function cleanupCloudBackground(sceneId: string, userId: string): Promise<void> {
    console.log('[CustomScenes] Cleaning up cloud background for scene:', sceneId);

    // 1. Find background IDs mapped to this scene
    const { data: mappings } = await supabase
        .from('scene_backgrounds')
        .select('background_id')
        .eq('user_id', userId)
        .eq('scene_id', sceneId);

    if (!mappings || mappings.length === 0) {
        console.log('[CustomScenes] No cloud backgrounds to clean up for scene:', sceneId);
        return;
    }

    const bgIds = mappings.map((m: { background_id: string }) => m.background_id);

    // 2. Get storage paths for these backgrounds
    const { data: bgs } = await supabase
        .from('user_backgrounds')
        .select('id, storage_path')
        .in('id', bgIds);

    if (bgs && bgs.length > 0) {
        // 3. Delete files from Storage
        const paths = bgs.map((bg: { storage_path: string }) => bg.storage_path);
        await supabase.storage.from('user-backgrounds').remove(paths);

        // 4. Delete rows from user_backgrounds (cascade deletes scene_backgrounds)
        await supabase
            .from('user_backgrounds')
            .delete()
            .in('id', bgIds);
    }

    console.log('[CustomScenes] Cloud cleanup complete for scene:', sceneId);
}

export function useCustomScenes() {
    const customScenes = useSyncExternalStore(subscribe, getSnapshot);

    // Initialize auth listener on first mount
    useEffect(() => { initAuthListener(); }, []);

    const add = useCallback(async (stored: StoredScene) => {
        // Ensure user_id is set
        if (!_loadedForUser) {
            console.warn('[CustomScenes] Cannot add scene: no user logged in');
            return;
        }
        const sceneWithUser: StoredScene = { ...stored, user_id: _loadedForUser };
        await addScene(sceneWithUser);
        _scenes = [..._scenes, toRuntimeScene(sceneWithUser)];
        notify();

        // Fire-and-forget: upload AI background to Supabase Storage for cross-device sync
        if (sceneWithUser.backgroundBlob) {
            uploadAIBackgroundToCloud(
                sceneWithUser.backgroundBlob,
                sceneWithUser.id,
                sceneWithUser.name,
                sceneWithUser.description || '',
                _loadedForUser,
            ).catch((err: unknown) => {
                console.warn('[CustomScenes] Cloud upload failed (non-blocking):', err);
            });
        }
    }, []);

    const remove = useCallback(async (id: string) => {
        await deleteScene(id);
        _scenes = _scenes.filter((s) => s.id !== id);
        notify();

        // Fire-and-forget: clean up cloud storage
        if (_loadedForUser) {
            cleanupCloudBackground(id, _loadedForUser).catch((err: unknown) => {
                console.warn('[CustomScenes] Cloud cleanup failed (non-blocking):', err);
            });
        }
    }, []);

    return {
        customScenes,
        addCustomScene: add,
        removeCustomScene: remove,
        isLoading: _loading,
    };
}
