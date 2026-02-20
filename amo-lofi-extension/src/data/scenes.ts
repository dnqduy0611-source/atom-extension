/**
 * Scene data for AmoLofi Extension.
 * Simplified from web app — images load from lofi.amonexus.com CDN.
 */

export interface SceneTheme {
    primary: string;
    primaryGlow: string;
    textPrimary: string;
    textMuted: string;
}

export interface Scene {
    id: string;
    name: string;
    emoji: string;
    /** CDN image path (appended to CDN_BASE) */
    background: string;
    tint: string;
    theme: SceneTheme;
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
    },
];

export const DEFAULT_SCENE = scenes[0];

export function getSceneById(id: string): Scene {
    return scenes.find((s) => s.id === id) ?? DEFAULT_SCENE;
}
