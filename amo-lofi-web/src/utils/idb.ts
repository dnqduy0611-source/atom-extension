/**
 * idb.ts — Lightweight IndexedDB wrapper for Amo Lofi personalization.
 *
 * DB: amo-lofi-personalization (v1)
 * Stores:
 *   - custom-wallpapers: { id, sceneId, name, blob, tint, createdAt }
 *   - custom-scenes:     { id, name, description, theme, background, ... }
 */

const DB_NAME = 'amo-lofi-personalization';
const DB_VERSION = 1;
const WALLPAPER_STORE = 'custom-wallpapers';
const SCENE_STORE = 'custom-scenes';

// ── Stored Types ──

export interface StoredWallpaper {
    id: string;
    sceneId: string;
    name: string;
    blob: Blob;
    tint: string;
    createdAt: number;
}

export interface StoredScene {
    id: string;
    name: string;
    description: string;
    theme: {
        day: Record<string, string>;
        night: Record<string, string>;
    } | { day: import('../data/scenes').SceneTheme; night: import('../data/scenes').SceneTheme };
    backgroundBlob: Blob | null;
    tint: { day: string; night: string };
    tags: string[];
    defaultAmbience: string[];
    createdAt: number;
    /** AI-generated SVG path strings for sidebar icons (optional) */
    iconPaths?: {
        music: string;
        scenes: string;
        focus: string;
        zen: string;
        timer: string;
        tasks: string;
    };
}

// ── DB Connection ──

let _dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise;

    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(WALLPAPER_STORE)) {
                const ws = db.createObjectStore(WALLPAPER_STORE, { keyPath: 'id' });
                ws.createIndex('byScene', 'sceneId', { unique: false });
            }
            if (!db.objectStoreNames.contains(SCENE_STORE)) {
                db.createObjectStore(SCENE_STORE, { keyPath: 'id' });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
            _dbPromise = null;
            reject(req.error);
        };
    });

    return _dbPromise;
}

// ── Wallpaper CRUD ──

export async function getAllWallpapers(sceneId: string): Promise<StoredWallpaper[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLPAPER_STORE, 'readonly');
        const idx = tx.objectStore(WALLPAPER_STORE).index('byScene');
        const req = idx.getAll(sceneId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function addWallpaper(data: StoredWallpaper): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLPAPER_STORE, 'readwrite');
        tx.objectStore(WALLPAPER_STORE).put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function deleteWallpaper(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WALLPAPER_STORE, 'readwrite');
        tx.objectStore(WALLPAPER_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ── Scene CRUD ──

export async function getAllScenes(): Promise<StoredScene[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SCENE_STORE, 'readonly');
        const req = tx.objectStore(SCENE_STORE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function addScene(scene: StoredScene): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SCENE_STORE, 'readwrite');
        tx.objectStore(SCENE_STORE).put(scene);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function deleteScene(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SCENE_STORE, 'readwrite');
        tx.objectStore(SCENE_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
