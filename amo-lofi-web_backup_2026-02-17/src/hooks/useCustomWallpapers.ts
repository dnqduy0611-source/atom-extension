import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllWallpapers, addWallpaper, deleteWallpaper } from '../utils/idb';
import type { StoredWallpaper } from '../utils/idb';

/**
 * useCustomWallpapers — CRUD for user-uploaded wallpapers per scene.
 *
 * - Loads blobs from IndexedDB on mount → creates object URLs
 * - Cleans up object URLs on unmount
 * - Validates file size (≤10MB) and type (jpg/png/webp)
 * - Max 5 custom wallpapers per scene
 */

export interface CustomWallpaper {
    id: string;
    name: string;
    sceneId: string;
    blobUrl: string;
    tint: string;
    createdAt: number;
}

const MAX_WALLPAPERS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useCustomWallpapers(sceneId: string) {
    const [wallpapers, setWallpapers] = useState<CustomWallpaper[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const blobUrlsRef = useRef<string[]>([]);

    // Cleanup blob URLs on unmount or scene change
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
        };
    }, [sceneId]);

    // Load from IndexedDB
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            try {
                // Revoke previous URLs
                blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
                blobUrlsRef.current = [];

                const stored = await getAllWallpapers(sceneId);
                if (cancelled) return;

                const mapped: CustomWallpaper[] = stored.map((s) => {
                    const blobUrl = URL.createObjectURL(s.blob);
                    blobUrlsRef.current.push(blobUrl);
                    return {
                        id: s.id,
                        name: s.name,
                        sceneId: s.sceneId,
                        blobUrl,
                        tint: s.tint,
                        createdAt: s.createdAt,
                    };
                });

                setWallpapers(mapped);
            } catch (err) {
                console.error('[CustomWallpapers] Load error:', err);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [sceneId]);

    const add = useCallback(
        async (file: File) => {
            // Validate type
            if (!ALLOWED_TYPES.includes(file.type)) {
                throw new Error(`Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.`);
            }
            // Validate size
            if (file.size > MAX_FILE_SIZE) {
                throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
            }
            // Validate count
            if (wallpapers.length >= MAX_WALLPAPERS) {
                throw new Error(`Maximum ${MAX_WALLPAPERS} custom wallpapers per scene.`);
            }

            const id = `custom_${sceneId}_${Date.now()}`;
            const name = file.name.replace(/\.[^/.]+$/, '') || 'My Photo';

            const stored: StoredWallpaper = {
                id,
                sceneId,
                name,
                blob: file,
                tint: 'rgba(0,0,0,0.15)',
                createdAt: Date.now(),
            };

            await addWallpaper(stored);

            const blobUrl = URL.createObjectURL(file);
            blobUrlsRef.current.push(blobUrl);

            setWallpapers((prev) => [
                ...prev,
                { id, name, sceneId, blobUrl, tint: stored.tint, createdAt: stored.createdAt },
            ]);
        },
        [sceneId, wallpapers.length],
    );

    const remove = useCallback(
        async (id: string) => {
            await deleteWallpaper(id);

            setWallpapers((prev) => {
                const wp = prev.find((w) => w.id === id);
                if (wp) {
                    URL.revokeObjectURL(wp.blobUrl);
                    blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== wp.blobUrl);
                }
                return prev.filter((w) => w.id !== id);
            });
        },
        [],
    );

    return {
        wallpapers,
        addWallpaper: add,
        removeWallpaper: remove,
        isLoading,
        isFull: wallpapers.length >= MAX_WALLPAPERS,
    };
}
