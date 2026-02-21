/**
 * Scene Sync Service — Fetches the user's active scene from Supabase
 * and syncs it to chrome.storage.local for the extension.
 *
 * Fallback chain:
 * 1. Supabase `lofi_state.active_config.scene_id` (logged in + online)
 * 2. chrome.storage.local `selectedScene` (cached or user-set)
 * 3. Hardcoded default: 'cyberpunk_alley'
 */

import { supabase } from './supabaseClient';

const DEFAULT_SCENE = 'cyberpunk_alley';

/**
 * Fetch the synced scene from Supabase and cache locally.
 * Returns the scene ID to use.
 */
export async function syncSceneFromCloud(): Promise<string> {
    try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            // Not logged in — use local preference
            return getLocalScene();
        }

        const { data, error } = await supabase
            .from('lofi_state')
            .select('active_config')
            .eq('user_id', session.user.id)
            .single();

        if (error || !data?.active_config) {
            console.warn('[SceneSync] Supabase fetch failed, using local:', error?.message);
            return getLocalScene();
        }

        const config = data.active_config as Record<string, unknown>;
        const sceneId = (config.scene_id as string) || DEFAULT_SCENE;

        // Cache locally for offline access
        await chrome.storage.local.set({ selectedScene: sceneId });

        console.log('[SceneSync] Synced scene from cloud:', sceneId);
        return sceneId;
    } catch (err) {
        console.warn('[SceneSync] Sync error, using local:', err);
        return getLocalScene();
    }
}

/**
 * Push the extension's current scene to Supabase (so web app can pick it up).
 */
export async function pushSceneToCloud(sceneId: string): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // Not logged in, skip

        // Read existing config to merge
        const { data } = await supabase
            .from('lofi_state')
            .select('active_config')
            .eq('user_id', session.user.id)
            .single();

        const existingConfig = (data?.active_config as Record<string, unknown>) || {};

        await supabase.from('lofi_state').upsert({
            user_id: session.user.id,
            active_config: {
                ...existingConfig,
                scene_id: sceneId,
            },
            last_device: 'extension',
            last_active_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        console.log('[SceneSync] Pushed scene to cloud:', sceneId);
    } catch (err) {
        console.warn('[SceneSync] Push error:', err);
    }
}

/** Get scene from local storage with fallback */
async function getLocalScene(): Promise<string> {
    const result = await chrome.storage.local.get('selectedScene');
    return (result.selectedScene as string) || DEFAULT_SCENE;
}
