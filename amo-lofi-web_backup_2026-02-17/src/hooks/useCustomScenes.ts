import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { getAllScenes, addScene, deleteScene } from '../utils/idb';
import type { StoredScene } from '../utils/idb';
import type { Scene, SceneTheme } from '../data/scenes';
import { registerIconPack } from '../icons';
import { createAIIconPack } from '../icons/packs/aiPackFactory';

/**
 * useCustomScenes — CRUD for AI-generated custom scenes.
 *
 * Uses module-level shared state so all consumers (SceneSelector, useTheme,
 * SceneBackground) share the same data — prevents flickering from independent
 * IDB loads causing cascading re-renders.
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
let _loaded = false;
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

async function loadOnce() {
    if (_loaded || _loading) return;
    _loading = true;
    try {
        const stored = await getAllScenes();
        _scenes = stored.map(toRuntimeScene);
        _loaded = true;
        notify();
    } catch (err) {
        console.error('[CustomScenes] Load error:', err);
    } finally {
        _loading = false;
    }
}

// ── Hook ──

export function useCustomScenes() {
    const customScenes = useSyncExternalStore(subscribe, getSnapshot);

    // Trigger load once on first mount
    useEffect(() => { loadOnce(); }, []);

    const add = useCallback(async (stored: StoredScene) => {
        await addScene(stored);
        _scenes = [..._scenes, toRuntimeScene(stored)];
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
