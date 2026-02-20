/**
 * Lofi Sync Service — Supabase Realtime Bridge
 * 
 * @fileoverview Subscribes to the Supabase Realtime channel `lofi:{user_id}`
 * to receive config changes from AmoLofi Web, transforms them into mirror
 * configs, and broadcasts to all content scripts via chrome.tabs.sendMessage.
 * 
 * MV3 Service Worker Lifecycle:
 * - init() called when user signs in or extension starts with active session
 * - disconnect() called on sign-out or manual disconnect
 * - Service worker may be killed → on wake, check storage for auth and reinit
 */

import { getSupabaseClient } from '../lib/supabase_client.js';
import { DEBUG_MODE } from '../config/supabase_config.js';

const LOFI_BASE = 'https://lofi.amonexus.com';

// ── Scene Registry (mirrors content.js, amo-lofi-web/src/data/scenes.ts) ──
const SCENE_REGISTRY = {
    cozy_cafe: {
        bg: { day: '/scenes/cafe_day.jpg', night: '/scenes/cafe_night.jpg' },
        tint: { day: 'rgba(30,15,5,0.4)', night: 'rgba(10,5,2,0.55)' },
        primary: { day: '#f59e0b', night: '#fb923c' }
    },
    japanese_garden: {
        bg: { day: '/scenes/garden_day.jpg', night: '/scenes/garden_night.jpg' },
        tint: { day: 'rgba(15,10,20,0.3)', night: 'rgba(15,5,25,0.5)' },
        primary: { day: '#ec4899', night: '#a855f7' }
    },
    city_night: {
        bg: { day: '/scenes/city_day.jpg', night: '/scenes/city_night.jpg' },
        tint: { day: 'rgba(10,5,30,0.4)', night: 'rgba(5,2,15,0.45)' },
        primary: { day: '#8b5cf6', night: '#e879f9' }
    },
    forest_cabin: {
        bg: { day: '/scenes/forest_day.jpg', night: '/scenes/forest_night.jpg' },
        tint: { day: 'rgba(5,15,5,0.35)', night: 'rgba(3,8,3,0.5)' },
        primary: { day: '#22c55e', night: '#34d399' }
    },
    ocean_cliff: {
        bg: { day: '/scenes/ocean_day.jpg', night: '/scenes/ocean_night.jpg' },
        tint: { day: 'rgba(5,10,25,0.3)', night: 'rgba(2,5,15,0.5)' },
        primary: { day: '#06b6d4', night: '#38bdf8' }
    },
    space_station: {
        bg: { day: '/scenes/space_day.jpg', night: '/scenes/space_night.jpg' },
        tint: { day: 'rgba(3,3,15,0.35)', night: 'rgba(0,0,5,0.45)' },
        primary: { day: '#6366f1', night: '#a78bfa' }
    },
    cyberpunk_alley: {
        bg: { day: '/scenes/cyberpunk_day.jpg', night: '/scenes/cyberpunk_night.jpg' },
        tint: { day: 'rgba(0,5,15,0.12)', night: 'rgba(0,3,10,0.18)' },
        primary: { day: '#00ffd5', night: '#ff2d95' }
    },
    ghibli_meadow: {
        bg: { day: '/scenes/ghibli_day.jpg', night: '/scenes/ghibli_night.jpg' },
        tint: { day: 'rgba(20,15,5,0.2)', night: 'rgba(10,8,20,0.4)' },
        primary: { day: '#4ade80', night: '#c084fc' }
    },
};

let _channel = null;
let _userId = null;

/**
 * Initialize Lofi Sync — subscribe to Supabase Realtime channel
 * @param {string} userId - Authenticated user's ID
 */
export async function initLofiSync(userId) {
    if (_channel) {
        console.log('[Lofi Sync] Already connected, skipping init');
        return;
    }
    if (!userId) {
        console.warn('[Lofi Sync] No userId, cannot init');
        return;
    }

    _userId = userId;

    try {
        const client = await getSupabaseClient();
        const channelName = `lofi:${userId}`;

        _channel = client.channel(channelName, {
            config: { broadcast: { self: false } }  // don't receive own broadcasts
        });

        // Listen for config changes from AmoLofi Web
        _channel.on('broadcast', { event: 'config_change' }, ({ payload }) => {
            if (DEBUG_MODE) console.log('[Lofi Sync] config_change received:', payload);
            handleConfigChange(payload);
        });

        // Listen for playback changes
        _channel.on('broadcast', { event: 'playback_change' }, ({ payload }) => {
            if (DEBUG_MODE) console.log('[Lofi Sync] playback_change received:', payload);
            handlePlaybackChange(payload);
        });

        // Listen for focus commands (enter_zen, exit_zen)
        _channel.on('broadcast', { event: 'focus_command' }, ({ payload }) => {
            if (DEBUG_MODE) console.log('[Lofi Sync] focus_command received:', payload);
            handleFocusCommand(payload);
        });

        // Subscribe to the channel
        _channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[Lofi Sync] ✅ Connected to channel: ${channelName}`);
                chrome.storage.local.set({ atom_lofi_sync_status: 'connected' });
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[Lofi Sync] ❌ Channel error: ${channelName}`);
                chrome.storage.local.set({ atom_lofi_sync_status: 'error' });
            } else if (status === 'CLOSED') {
                console.log(`[Lofi Sync] Channel closed: ${channelName}`);
                chrome.storage.local.set({ atom_lofi_sync_status: 'disconnected' });
            }
        });

    } catch (error) {
        console.error('[Lofi Sync] Init failed:', error);
    }
}

/**
 * Disconnect from Lofi Sync channel
 */
export async function disconnectLofiSync() {
    if (_channel) {
        try {
            const client = await getSupabaseClient();
            client.removeChannel(_channel);
        } catch (e) {
            console.warn('[Lofi Sync] Disconnect error:', e);
        }
        _channel = null;
    }
    _userId = null;

    // Clear mirror config and notify content scripts
    chrome.storage.local.set({
        atom_lofi_config: { active: false },
        atom_lofi_sync_status: 'disconnected'
    });

    broadcastToTabs({ type: 'LOFI_DISCONNECTED' });
    console.log('[Lofi Sync] Disconnected');
}

/**
 * Check if sync is currently active
 */
export function isLofiSyncActive() {
    return _channel !== null;
}

/**
 * Send a focus command to AmoLofi Web via Realtime channel
 * @param {'enter_zen'|'exit_zen'|'toggle_play'} command
 * @param {Record<string, unknown>} [data]
 */
export function sendFocusCommand(command, data = {}) {
    if (!_channel) {
        if (DEBUG_MODE) console.log('[Lofi Sync] sendFocusCommand skipped — no channel');
        return;
    }
    _channel.send({
        type: 'broadcast',
        event: 'focus_command',
        payload: { command, data, source: 'extension', timestamp: Date.now() },
    });
    if (DEBUG_MODE) console.log('[Lofi Sync] focus_command sent:', command);
}

// ── Shared Mirror Config Builder ──

function buildMirrorConfig(config, isPlaying, masterVolume) {
    const sceneData = SCENE_REGISTRY[config.scene_id];
    const variant = config.variant || 'day';

    // For known scenes, build URL from registry. For custom/AI scenes, use payload data.
    let bg_url, bg_tint, primary_color;
    if (sceneData) {
        bg_url = `${LOFI_BASE}${sceneData.bg[variant] || sceneData.bg.day}`;
        bg_tint = sceneData.tint[variant] || 'rgba(0,0,0,0.4)';
        primary_color = sceneData.primary[variant] || '#10b981';
    } else {
        // Custom/AI scene — use metadata from sync payload
        bg_url = config.bg_url ? (config.bg_url.startsWith('/') ? `${LOFI_BASE}${config.bg_url}` : config.bg_url) : '';
        bg_tint = config.tint || 'rgba(0,0,0,0.4)';
        primary_color = config.primary_color || '#10b981';
    }

    return {
        active: true,
        updated_at: Date.now(),
        scene_id: config.scene_id,
        variant: variant,
        bg_url: bg_url,
        bg_tint: bg_tint,
        primary_color: primary_color,
        audio_layers: (config.ambience || []).map(a => ({
            id: a.id,
            volume: a.volume ?? 0.5,
            src: `${LOFI_BASE}/assets/audio/ambience/${a.id}.mp3`,
        })),
        music: config.music ? {
            id: config.music.id,
            name: config.music.name || config.music.id,
            artist: config.music.artist || 'Amo',
            volume: config.music.volume ?? 0.4,
            src: `${LOFI_BASE}/assets/audio/music/${config.music.id}.mp3`,
        } : null,
        is_playing: isPlaying !== false,
        master_volume: masterVolume ?? 0.7,
    };
}

// ── Internal Handlers ──

function handleConfigChange(payload) {
    if (payload.source === 'extension') return; // ignore own echo

    const config = payload.config;
    if (!config?.scene_id) return;

    const mirrorConfig = buildMirrorConfig(config, config.isPlaying, config.masterVolume);

    // Persist to storage
    chrome.storage.local.set({ atom_lofi_config: mirrorConfig });

    // Broadcast to all content scripts
    broadcastToTabs({ type: 'LOFI_CONFIG_UPDATED', config: mirrorConfig });

    if (DEBUG_MODE) console.log('[Lofi Sync] Mirror config saved & broadcast:', mirrorConfig.scene_id);
}

function handlePlaybackChange(payload) {
    if (payload.source === 'extension') return;

    // Update just the playback state (play/pause/volume)
    chrome.storage.local.get('atom_lofi_config', (data) => {
        const existing = data.atom_lofi_config;
        if (!existing?.active) return;

        const updated = {
            ...existing,
            is_playing: payload.isPlaying !== false,
            master_volume: payload.masterVolume ?? existing.master_volume,
            updated_at: Date.now(),
        };

        chrome.storage.local.set({ atom_lofi_config: updated });
        broadcastToTabs({ type: 'LOFI_CONFIG_UPDATED', config: updated });
    });
}

function handleFocusCommand(payload) {
    if (payload.source === 'extension') return;

    // Focus commands from AmoLofi Web (enter_zen / exit_zen)
    if (payload.command === 'exit_zen') {
        chrome.storage.local.set({ atom_lofi_config: { active: false } });
        broadcastToTabs({ type: 'LOFI_DISCONNECTED' });
    }
    // enter_zen is handled implicitly via config_change
}

// ── Utility ──

function broadcastToTabs(message) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, message).catch(() => { });
        });
    });
}

/**
 * Auto-init on service worker wake if user is authenticated
 * Call this from background.js on startup
 */
export async function tryAutoInitLofiSync() {
    try {
        const data = await chrome.storage.local.get('atom_proxy_session');
        const session = data.atom_proxy_session;
        if (session?.user_id && session?.access_token) {
            // Check if session is still valid (not expired)
            const expiresAt = session.expires_at;
            if (expiresAt && Date.now() / 1000 < expiresAt) {
                await initLofiSync(session.user_id);
                // Also pull latest config from DB (catch-up after SW sleep)
                await pullLatestLofiConfig();
            } else {
                if (DEBUG_MODE) console.log('[Lofi Sync] Session expired, skipping auto-init');
            }
        } else {
            if (DEBUG_MODE) console.log('[Lofi Sync] No auth session, skipping auto-init');
        }
    } catch (e) {
        console.warn('[Lofi Sync] Auto-init failed:', e);
    }
}

/**
 * Pull latest config from Supabase `lofi_state` table.
 * Used as catch-up mechanism when Realtime channel was disconnected
 * (e.g., MV3 service worker went to sleep).
 */
export async function pullLatestLofiConfig() {
    try {
        const data = await chrome.storage.local.get('atom_proxy_session');
        const session = data.atom_proxy_session;
        if (!session?.user_id) return;

        const client = await getSupabaseClient();
        const { data: stateRow, error } = await client
            .from('lofi_state')
            .select('active_config, is_playing, master_volume')
            .eq('user_id', session.user_id)
            .single();

        if (error || !stateRow?.active_config) {
            if (DEBUG_MODE) console.log('[Lofi Sync] No lofi_state found or error:', error?.message);
            return;
        }

        const config = stateRow.active_config;
        if (!config.scene_id) return;

        // Build mirror config (same logic as handleConfigChange)
        const mirrorConfig = buildMirrorConfig(config, stateRow.is_playing, stateRow.master_volume);

        // Check if config actually changed
        const existing = await chrome.storage.local.get('atom_lofi_config');
        const current = existing.atom_lofi_config;
        if (current?.scene_id === mirrorConfig.scene_id && current?.variant === mirrorConfig.variant) {
            if (DEBUG_MODE) console.log('[Lofi Sync] Config unchanged, skipping pull update');
            return;
        }

        // Save & broadcast
        chrome.storage.local.set({ atom_lofi_config: mirrorConfig });
        broadcastToTabs({ type: 'LOFI_CONFIG_UPDATED', config: mirrorConfig });
        console.log('[Lofi Sync] 📥 Config pulled from DB:', mirrorConfig.scene_id, mirrorConfig.variant);
    } catch (e) {
        console.warn('[Lofi Sync] Pull config failed:', e);
    }
}

// ── Auto-init on auth session changes (MV3 resilience) ──
// Watches for atom_proxy_session being written (login, token refresh)
// and automatically connects the Realtime channel.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.atom_proxy_session) return;

    const newSession = changes.atom_proxy_session.newValue;
    if (newSession?.user_id && newSession?.access_token) {
        // New valid session → connect (or reconnect if user changed)
        if (_userId && _userId !== newSession.user_id) {
            // Different user → disconnect old channel first
            disconnectLofiSync();
        }
        if (!_channel) {
            initLofiSync(newSession.user_id).catch(e =>
                console.warn('[Lofi Sync] Auto-init on session change failed:', e)
            );
        }
    } else if (!newSession || !newSession.access_token) {
        // Session removed (logout) → disconnect
        disconnectLofiSync();
    }
});
