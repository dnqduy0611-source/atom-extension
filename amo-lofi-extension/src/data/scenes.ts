/**
 * Scene data for AmoLofi Extension.
 * Images load from lofi.amonexus.com CDN.
 * Each scene now includes a wallpapers[] gallery for variant selection.
 */

export interface SceneTheme {
    primary: string;
    primaryGlow: string;
    textPrimary: string;
    textMuted: string;
}

export interface SceneWallpaper {
    id: string;
    name: string;
    /** CDN image path (appended to CDN_BASE) */
    src: string;
    tint: string;
}

export interface Scene {
    id: string;
    name: string;
    emoji: string;
    /** Default CDN image path */
    background: string;
    tint: string;
    theme: SceneTheme;
    wallpapers: SceneWallpaper[];
}

export const CDN_BASE = 'https://lofi.amonexus.com';

export const scenes: Scene[] = [
    {
        id: 'cozy_cafe',
        name: 'Cozy Cafe',
        emoji: '☕',
        background: '/scenes/cafe_night.jpg',
        tint: 'rgba(10,5,2,0.55)',
        theme: {
            primary: '#fb923c',
            primaryGlow: 'rgba(251,146,60,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(255,220,180,0.45)',
        },
        wallpapers: [
            { id: 'cafe_day', name: 'Morning Café', src: '/scenes/cafe_day.jpg', tint: 'rgba(30,15,5,0.4)' },
            { id: 'cafe_night', name: 'Evening Café', src: '/scenes/cafe_night.jpg', tint: 'rgba(10,5,2,0.55)' },
        ],
    },
    {
        id: 'japanese_garden',
        name: 'Japanese Garden',
        emoji: '🌸',
        background: '/scenes/garden_night.jpg',
        tint: 'rgba(15,5,25,0.5)',
        theme: {
            primary: '#a855f7',
            primaryGlow: 'rgba(168,85,247,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(220,200,255,0.45)',
        },
        wallpapers: [
            { id: 'garden_spring', name: 'Spring Garden', src: '/scenes/garden_day.jpg', tint: 'rgba(15,10,20,0.3)' },
            { id: 'garden_moonlit', name: 'Moonlit Garden', src: '/scenes/garden_night.jpg', tint: 'rgba(15,5,25,0.5)' },
        ],
    },
    {
        id: 'city_night',
        name: 'City Night',
        emoji: '🌃',
        background: '/scenes/city_night.jpg',
        tint: 'rgba(5,2,15,0.45)',
        theme: {
            primary: '#e879f9',
            primaryGlow: 'rgba(232,121,249,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(240,200,255,0.45)',
        },
        wallpapers: [
            { id: 'city_neon_street', name: 'Neon Street', src: '/scenes/city_day.jpg', tint: 'rgba(10,5,30,0.4)' },
            { id: 'city_rainy_night', name: 'Rainy Night', src: '/scenes/city_night.jpg', tint: 'rgba(5,2,15,0.45)' },
            { id: 'city_panorama', name: 'City Panorama', src: '/scenes/city_panorama.jpg', tint: 'rgba(5,3,20,0.4)' },
        ],
    },
    {
        id: 'forest_cabin',
        name: 'Forest Cabin',
        emoji: '🌲',
        background: '/scenes/forest_night.jpg',
        tint: 'rgba(3,8,3,0.5)',
        theme: {
            primary: '#34d399',
            primaryGlow: 'rgba(52,211,153,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(190,240,210,0.45)',
        },
        wallpapers: [
            { id: 'forest_summer', name: 'Summer Forest', src: '/scenes/forest_day.jpg', tint: 'rgba(5,15,5,0.35)' },
            { id: 'forest_winter', name: 'Winter Night', src: '/scenes/forest_night.jpg', tint: 'rgba(3,8,3,0.5)' },
        ],
    },
    {
        id: 'ocean_cliff',
        name: 'Ocean Cliff',
        emoji: '🌊',
        background: '/scenes/ocean_night.jpg',
        tint: 'rgba(2,5,15,0.5)',
        theme: {
            primary: '#38bdf8',
            primaryGlow: 'rgba(56,189,248,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(180,220,255,0.45)',
        },
        wallpapers: [
            { id: 'ocean_sunset', name: 'Sunset Cliff', src: '/scenes/ocean_day.jpg', tint: 'rgba(5,10,25,0.3)' },
            { id: 'ocean_storm', name: 'Storm Night', src: '/scenes/ocean_night.jpg', tint: 'rgba(2,5,15,0.5)' },
        ],
    },
    {
        id: 'space_station',
        name: 'Space Station',
        emoji: '🚀',
        background: '/scenes/space_night.jpg',
        tint: 'rgba(0,0,5,0.45)',
        theme: {
            primary: '#a78bfa',
            primaryGlow: 'rgba(167,139,250,0.25)',
            textPrimary: 'rgba(255,255,255,0.9)',
            textMuted: 'rgba(210,200,255,0.45)',
        },
        wallpapers: [
            { id: 'space_earth', name: 'Earth View', src: '/scenes/space_day.jpg', tint: 'rgba(3,3,15,0.35)' },
            { id: 'space_deep', name: 'Deep Space', src: '/scenes/space_night.jpg', tint: 'rgba(0,0,5,0.45)' },
        ],
    },
    {
        id: 'cyberpunk_alley',
        name: 'Cyberpunk Alley',
        emoji: '⚡',
        background: '/scenes/cyberpunk_night.jpg',
        tint: 'rgba(0,3,10,0.18)',
        theme: {
            primary: '#ff2d95',
            primaryGlow: 'rgba(255,45,149,0.28)',
            textPrimary: 'rgba(255,255,255,0.92)',
            textMuted: 'rgba(255,150,200,0.45)',
        },
        wallpapers: [
            { id: 'cyberpunk_neon_alley', name: 'Neon Alley', src: '/scenes/cyberpunk_day.jpg', tint: 'rgba(0,5,15,0.12)' },
            { id: 'cyberpunk_rain', name: 'Rain District', src: '/scenes/cyberpunk_night.jpg', tint: 'rgba(0,3,10,0.18)' },
            { id: 'cyberpunk_rooftop', name: 'Rooftop Hacker', src: '/scenes/cyberpunk_rooftop.jpg', tint: 'rgba(3,0,12,0.15)' },
            { id: 'cyberpunk_market', name: 'Neon Market', src: '/scenes/cyberpunk_market.jpg', tint: 'rgba(5,2,10,0.12)' },
            { id: 'cyberpunk_station', name: 'Train Station', src: '/scenes/cyberpunk_station.jpg', tint: 'rgba(3,0,12,0.15)' },
            { id: 'cyberpunk_nomad', name: 'Digital Nomad', src: '/scenes/cyberpunk_nomad.jpg', tint: 'rgba(5,2,15,0.12)' },
            { id: 'cyberpunk_skyline', name: 'Dubai Skyline', src: '/scenes/cyberpunk_skyline.jpg', tint: 'rgba(2,0,10,0.1)' },
        ],
    },
    {
        id: 'ghibli_meadow',
        name: 'Ghibli Meadow',
        emoji: '🍃',
        background: '/scenes/ghibli_night.jpg',
        tint: 'rgba(10,8,20,0.4)',
        theme: {
            primary: '#c084fc',
            primaryGlow: 'rgba(192,132,252,0.25)',
            textPrimary: 'rgba(255,255,255,0.92)',
            textMuted: 'rgba(220,200,255,0.48)',
        },
        wallpapers: [
            { id: 'ghibli_sunny_hill', name: 'Sunny Hillside', src: '/scenes/ghibli_day.jpg', tint: 'rgba(15,10,5,0.1)' },
            { id: 'ghibli_starry_night', name: 'Starry Night', src: '/scenes/ghibli_night.jpg', tint: 'rgba(5,3,15,0.2)' },
            { id: 'ghibli_cherry', name: 'Cherry Blossoms', src: '/scenes/ghibli_cherry.jpg', tint: 'rgba(10,5,8,0.1)' },
            { id: 'ghibli_river', name: 'River Valley', src: '/scenes/ghibli_river.jpg', tint: 'rgba(5,8,10,0.1)' },
            { id: 'ghibli_japan', name: 'Japan Village', src: '/scenes/ghibli_japan.jpg', tint: 'rgba(10,8,5,0.12)' },
            { id: 'ghibli_stars', name: 'Shooting Stars', src: '/scenes/ghibli_stars.jpg', tint: 'rgba(3,2,12,0.18)' },
        ],
    },
];

export const DEFAULT_SCENE = scenes[0];

export function getSceneById(id: string): Scene {
    return scenes.find((s) => s.id === id) ?? DEFAULT_SCENE;
}

/** Find a wallpaper within a scene by wallpaper ID */
export function getWallpaper(scene: Scene, wallpaperId?: string): SceneWallpaper | undefined {
    if (!wallpaperId) return undefined;
    return scene.wallpapers.find((w) => w.id === wallpaperId);
}
