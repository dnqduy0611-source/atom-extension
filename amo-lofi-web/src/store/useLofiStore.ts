import { create } from 'zustand';
import type { Locale } from '../i18n';

export type HeroStyle = 'minimal' | 'glassmorphism' | 'neon' | 'floating' | 'analog' | 'dashboard';

// ══════════════════════════════════════════════════════
//  Shared Config Type
//  Both manual UI sliders and future AI (Phase 2) output this shape.
// ══════════════════════════════════════════════════════

export interface MixerConfig {
    scene_id: string;
    variant: 'day' | 'night';
    music: { id: string; volume: number } | null;
    ambience: { id: string; volume: number }[];
}

// ══════════════════════════════════════════════════════
//  Internal State Types
// ══════════════════════════════════════════════════════

interface AmbienceLayer {
    id: string;
    volume: number;
    active: boolean;
}

type Panel = 'scenes' | 'mixer' | 'focus' | 'stats' | null;

interface LofiState {
    // ── Player ──
    isPlaying: boolean;
    masterVolume: number;

    // ── Scene ──
    activeSceneId: string;
    activeVariant: 'day' | 'night';
    activeWallpaperId: string | null;

    // ── Music ──
    musicTrack: { id: string; volume: number } | null;

    // ── Ambience (max 3 active) ──
    ambienceLayers: AmbienceLayer[];

    // ── Binaural Beats ──
    binauralEnabled: boolean;
    binauralVolume: number;
    binauralMode: 'focus' | 'relax' | 'deep';

    // ── Theme Customization ──
    customAccent: string | null;
    tintOpacity: number;
    backgroundDarken: number;
    vignetteEnabled: boolean;
    accentGlowEnabled: boolean;
    heroStyle: HeroStyle;

    // ── Quick Settings: Visibility ──
    showClock: boolean;
    use24hFormat: boolean;
    showDate: boolean;
    showPlayerBar: boolean;
    showBranding: boolean;

    // ── Scene Preferences ──
    hiddenSceneIds: string[];

    // ── i18n ──
    locale: Locale;

    // ── UI ──
    activePanel: Panel;
    zenMode: boolean;

    // ── Sync Tracking ──
    lastChangeTimestamp: number;

    // ── Actions: Player ──
    togglePlay: () => void;
    setMasterVolume: (volume: number) => void;

    // ── Actions: Scene ──
    setScene: (sceneId: string) => void;
    setVariant: (variant: 'day' | 'night') => void;
    toggleVariant: () => void;
    setWallpaper: (id: string | null) => void;

    // ── Actions: Music ──
    setMusicTrack: (trackId: string, volume?: number) => void;
    setMusicVolume: (volume: number) => void;
    clearMusic: () => void;
    nextTrack: () => void;
    prevTrack: () => void;

    // ── Actions: Ambience ──
    toggleAmbienceLayer: (layerId: string) => void;
    setAmbienceVolume: (layerId: string, volume: number) => void;

    // ── Actions: Config (AI-Ready Bridge) ──
    applyConfig: (config: MixerConfig) => void;

    // ── Actions: Binaural Beats ──
    setBinauralEnabled: (enabled: boolean) => void;
    setBinauralVolume: (volume: number) => void;
    setBinauralMode: (mode: 'focus' | 'relax' | 'deep') => void;

    // ── Actions: Theme Customization ──
    setCustomAccent: (color: string | null) => void;
    setTintOpacity: (opacity: number) => void;
    setBackgroundDarken: (value: number) => void;
    setVignetteEnabled: (enabled: boolean) => void;
    setAccentGlowEnabled: (enabled: boolean) => void;
    setHeroStyle: (style: HeroStyle) => void;

    // ── Actions: Quick Settings ──
    setShowClock: (v: boolean) => void;
    setUse24hFormat: (v: boolean) => void;
    setShowDate: (v: boolean) => void;
    setShowPlayerBar: (v: boolean) => void;
    setShowBranding: (v: boolean) => void;

    // ── Actions: Scene Preferences ──
    hideScene: (sceneId: string) => void;
    unhideScene: (sceneId: string) => void;
    resetHiddenScenes: () => void;

    // ── Actions: i18n ──
    setLocale: (locale: Locale) => void;

    // ── Actions: UI ──
    setActivePanel: (panel: Panel) => void;
    togglePanel: (panel: Exclude<Panel, null>) => void;
    setZenMode: (enabled: boolean) => void;
    toggleZenMode: () => void;
}

// ══════════════════════════════════════════════════════
//  Track ID list for prev/next navigation
// ══════════════════════════════════════════════════════

const TRACK_ORDER = [
    'lofi_chill_01',
    'lofi_chill_02',
    'synthwave_01',
    'classical_01',
    'ambient_01',
];

// ══════════════════════════════════════════════════════
//  Store
// ══════════════════════════════════════════════════════

export const useLofiStore = create<LofiState>((set, get) => ({
    // ── Initial State ──
    isPlaying: false,
    masterVolume: 0.7,
    activeSceneId: 'cozy_cafe',
    activeVariant: 'day',
    activeWallpaperId: null,
    musicTrack: { id: 'lofi_chill_01', volume: 0.5 },
    ambienceLayers: [
        { id: 'rain', volume: 0.5, active: false },
        { id: 'thunder', volume: 0.3, active: false },
        { id: 'wind', volume: 0.4, active: false },
        { id: 'fire', volume: 0.5, active: false },
        { id: 'coffee_shop', volume: 0.4, active: false },
        { id: 'ocean', volume: 0.5, active: false },
        { id: 'white_noise', volume: 0.3, active: false },
        { id: 'dungeon_air', volume: 0.4, active: false },
    ],
    binauralEnabled: false,
    binauralVolume: 0.15,
    binauralMode: 'focus' as const,
    customAccent: null,
    tintOpacity: 1.0,
    backgroundDarken: 0.15,
    vignetteEnabled: true,
    accentGlowEnabled: true,
    heroStyle: 'minimal' as HeroStyle,
    showClock: true,
    use24hFormat: true,
    showDate: false,
    showPlayerBar: true,
    showBranding: true,
    hiddenSceneIds: [],
    locale: (typeof window !== 'undefined'
        ? (localStorage.getItem('amo-lofi-locale') as Locale) || 'en'
        : 'en') as Locale,
    activePanel: null,
    zenMode: false,
    lastChangeTimestamp: Date.now(),

    // ── Player ──
    togglePlay: () =>
        set((state) => ({ isPlaying: !state.isPlaying })),

    setMasterVolume: (volume) =>
        set({ masterVolume: Math.max(0, Math.min(1, volume)) }),

    // ── Scene ──
    setScene: (sceneId) =>
        set({
            activeSceneId: sceneId,
            activeWallpaperId: null,
            lastChangeTimestamp: Date.now(),
        }),

    setVariant: (variant) =>
        set({
            activeVariant: variant,
            lastChangeTimestamp: Date.now(),
        }),

    toggleVariant: () =>
        set((state) => ({
            activeVariant: state.activeVariant === 'day' ? 'night' : 'day',
            lastChangeTimestamp: Date.now(),
        })),

    setWallpaper: (id) =>
        set({ activeWallpaperId: id }),

    // ── Music ──
    setMusicTrack: (trackId, volume) =>
        set((state) => ({
            musicTrack: {
                id: trackId,
                volume: volume ?? state.musicTrack?.volume ?? 0.5,
            },
            isPlaying: true,
            lastChangeTimestamp: Date.now(),
        })),

    setMusicVolume: (volume) =>
        set((state) => ({
            musicTrack: state.musicTrack
                ? { ...state.musicTrack, volume: Math.max(0, Math.min(1, volume)) }
                : null,
        })),

    clearMusic: () =>
        set({ musicTrack: null }),

    nextTrack: () =>
        set((state) => {
            if (!state.musicTrack) return {};
            const idx = TRACK_ORDER.indexOf(state.musicTrack.id);
            const nextIdx = (idx + 1) % TRACK_ORDER.length;
            return {
                musicTrack: { ...state.musicTrack, id: TRACK_ORDER[nextIdx] },
                lastChangeTimestamp: Date.now(),
            };
        }),

    prevTrack: () =>
        set((state) => {
            if (!state.musicTrack) return {};
            const idx = TRACK_ORDER.indexOf(state.musicTrack.id);
            const prevIdx = (idx - 1 + TRACK_ORDER.length) % TRACK_ORDER.length;
            return {
                musicTrack: { ...state.musicTrack, id: TRACK_ORDER[prevIdx] },
                lastChangeTimestamp: Date.now(),
            };
        }),

    // ── Ambience ──
    toggleAmbienceLayer: (layerId) =>
        set((state) => {
            const layers = state.ambienceLayers.map((layer) => {
                if (layer.id !== layerId) return layer;
                return { ...layer, active: !layer.active };
            });

            // Enforce max 3 active layers
            const activeCount = layers.filter((l) => l.active).length;
            if (activeCount > 3) {
                // Don't allow toggling on if already at max
                return {};
            }

            return {
                ambienceLayers: layers,
                lastChangeTimestamp: Date.now(),
            };
        }),

    setAmbienceVolume: (layerId, volume) =>
        set((state) => ({
            ambienceLayers: state.ambienceLayers.map((layer) =>
                layer.id === layerId
                    ? { ...layer, volume: Math.max(0, Math.min(1, volume)) }
                    : layer
            ),
        })),

    // ══════════════════════════════════════════════════
    //  applyConfig() — THE AI BRIDGE
    //  Phase 2 AI outputs MixerConfig → this function
    //  updates the entire player. Zero refactoring needed.
    // ══════════════════════════════════════════════════

    applyConfig: (config) =>
        set((state) => {
            // Build ambience layers: activate those in config, deactivate others
            const ambienceLayers = state.ambienceLayers.map((layer) => {
                const configLayer = config.ambience.find((a) => a.id === layer.id);
                if (configLayer) {
                    return { id: layer.id, volume: configLayer.volume, active: true };
                }
                return { ...layer, active: false };
            });

            return {
                activeSceneId: config.scene_id,
                activeVariant: config.variant,
                activeWallpaperId: null, // Clear custom wallpaper so scene change is visible
                musicTrack: config.music,
                ambienceLayers,
                isPlaying: true,
                lastChangeTimestamp: Date.now(),
            };
        }),


    // ── Binaural Beats ──
    setBinauralEnabled: (enabled) =>
        set({ binauralEnabled: enabled }),

    setBinauralVolume: (volume) =>
        set({ binauralVolume: Math.max(0, Math.min(1, volume)) }),

    setBinauralMode: (mode) =>
        set({ binauralMode: mode }),

    // ── Theme Customization ──
    setCustomAccent: (color) =>
        set({ customAccent: color, lastChangeTimestamp: Date.now() }),

    setTintOpacity: (opacity) =>
        set({ tintOpacity: Math.max(0, Math.min(1, opacity)), lastChangeTimestamp: Date.now() }),

    setBackgroundDarken: (value) =>
        set({ backgroundDarken: Math.max(0, Math.min(0.6, value)), lastChangeTimestamp: Date.now() }),

    setVignetteEnabled: (enabled) =>
        set({ vignetteEnabled: enabled, lastChangeTimestamp: Date.now() }),

    setAccentGlowEnabled: (enabled) =>
        set({ accentGlowEnabled: enabled, lastChangeTimestamp: Date.now() }),

    setHeroStyle: (style) =>
        set({ heroStyle: style, lastChangeTimestamp: Date.now() }),

    // ── Quick Settings ──
    setShowClock: (v) => set({ showClock: v, lastChangeTimestamp: Date.now() }),
    setUse24hFormat: (v) => set({ use24hFormat: v, lastChangeTimestamp: Date.now() }),
    setShowDate: (v) => set({ showDate: v, lastChangeTimestamp: Date.now() }),
    setShowPlayerBar: (v) => set({ showPlayerBar: v, lastChangeTimestamp: Date.now() }),
    setShowBranding: (v) => set({ showBranding: v, lastChangeTimestamp: Date.now() }),

    // ── Scene Preferences ──
    hideScene: (sceneId) =>
        set((state) => ({
            hiddenSceneIds: [...state.hiddenSceneIds, sceneId],
            // If hiding the active scene, switch to first visible scene
            ...(state.activeSceneId === sceneId ? { activeSceneId: 'cozy_cafe' } : {}),
            lastChangeTimestamp: Date.now(),
        })),

    unhideScene: (sceneId) =>
        set((state) => ({
            hiddenSceneIds: state.hiddenSceneIds.filter((id) => id !== sceneId),
            lastChangeTimestamp: Date.now(),
        })),

    resetHiddenScenes: () =>
        set({ hiddenSceneIds: [], lastChangeTimestamp: Date.now() }),

    // ── i18n ──
    setLocale: (locale) => {
        localStorage.setItem('amo-lofi-locale', locale);
        set({ locale });
    },

    // ── UI ──
    setActivePanel: (panel) =>
        set({ activePanel: panel }),

    togglePanel: (panel) =>
        set((state) => ({
            activePanel: state.activePanel === panel ? null : panel,
        })),

    setZenMode: (enabled) =>
        set({ zenMode: enabled, activePanel: enabled ? null : get().activePanel }),

    toggleZenMode: () =>
        set((state) => ({
            zenMode: !state.zenMode,
            activePanel: !state.zenMode ? null : state.activePanel,
        })),
}));
