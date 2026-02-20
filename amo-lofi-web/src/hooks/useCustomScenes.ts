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
    }, []);

    const remove = useCallback(async (id: string) => {
        await deleteScene(id);
        _scenes = _scenes.filter((s) => s.id !== id);
        notify();
    }, []);

    return {
        customScenes,
        addCustomScene: add,
        removeCustomScene: remove,
        isLoading: _loading,
    };
}
