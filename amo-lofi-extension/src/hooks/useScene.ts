/**
 * useScene — Persistent scene + wallpaper selection hook.
 * Reads/writes sceneId and wallpaperId to chrome.storage.local.
 * When logged in, syncs scene from Supabase on mount and pushes changes to cloud.
 * Fallback chain: Supabase → chrome.storage.local → default ('cyberpunk_alley').
 */

import { useState, useEffect, useRef } from 'react';
import { syncSceneFromCloud, pushSceneToCloud } from '../services/sceneSync';
import { trackProductEvent } from '../services/analytics';

const DEFAULT_SCENE_ID = 'cyberpunk_alley';

export function useScene() {
    const [sceneId, setSceneId] = useState(DEFAULT_SCENE_ID);
    const [wallpaperId, setWallpaperId] = useState<string | undefined>(undefined);
    const [cloudBgUrl, setCloudBgUrl] = useState<string | undefined>(undefined);
    const initialSyncDone = useRef(false);

    // Load from storage + cloud sync on mount
    useEffect(() => {
        // 1. Immediately show cached scene + wallpaper + cloud bg
        chrome.storage.local.get(['selectedScene', 'selectedWallpaper', 'cloudBgUrl']).then((result) => {
            if (result.selectedScene) setSceneId(result.selectedScene as string);
            if (result.selectedWallpaper) setWallpaperId(result.selectedWallpaper as string);
            if (result.cloudBgUrl) setCloudBgUrl(result.cloudBgUrl as string);
        });

        // 2. Then try cloud sync (will update if different)
        syncSceneFromCloud().then((cloudScene) => {
            setSceneId(cloudScene);
            initialSyncDone.current = true;
        });

        // 3. Listen for changes (from settings panel or other tabs)
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            if (area === 'local') {
                if (changes.selectedScene) {
                    setSceneId((changes.selectedScene.newValue as string) || DEFAULT_SCENE_ID);
                }
                if (changes.selectedWallpaper) {
                    setWallpaperId(changes.selectedWallpaper.newValue as string | undefined);
                }
                if (changes.cloudBgUrl) {
                    setCloudBgUrl(changes.cloudBgUrl.newValue as string | undefined);
                }
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    /** Select a scene (resets wallpaper to default) */
    const selectScene = (id: string) => {
        trackProductEvent('scene_change', { sceneId: id });
        setSceneId(id);
        setWallpaperId(undefined);
        setCloudBgUrl(undefined);
        chrome.storage.local.set({ selectedScene: id });
        chrome.storage.local.remove(['selectedWallpaper', 'cloudBgUrl']);
        pushSceneToCloud(id);
    };

    /** Select a specific wallpaper within the current scene */
    const selectWallpaper = (scId: string, wpId: string) => {
        setSceneId(scId);
        setWallpaperId(wpId);
        setCloudBgUrl(undefined);
        chrome.storage.local.set({ selectedScene: scId, selectedWallpaper: wpId });
        chrome.storage.local.remove('cloudBgUrl');
        pushSceneToCloud(scId);
    };

    /** Select a cloud-hosted background (signed URL) */
    const selectCloudBackground = (url: string, bgId: string) => {
        setWallpaperId(`cloud_${bgId}`);
        setCloudBgUrl(url);
        chrome.storage.local.set({
            selectedWallpaper: `cloud_${bgId}`,
            cloudBgUrl: url,
        });
    };

    return { sceneId, wallpaperId, cloudBgUrl, selectScene, selectWallpaper, selectCloudBackground };
}
