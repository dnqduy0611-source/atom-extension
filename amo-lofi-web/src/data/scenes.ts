/**
 * Scene Theme System
 * ──────────────────
 * Each scene owns its visual identity. Components read CSS custom
 * properties set by useTheme() — never hardcode colors.
 *
 * Adding a new scene:
 *   1. Put 2 images in /public/scenes/{id}_day.jpg + _night.jpg
 *   2. Add one entry to `scenes[]` below
 *   → All UI components theme-sync automatically
 *
 * AI theme generation:
 *   AI outputs a SceneTheme JSON → useTheme() applies it → done.
 */

// ── Theme Token Interface ──

export interface SceneTheme {
    /** Main accent color (buttons, active states, progress bars) */
    primary: string;
    /** Glow / shadow color for primary */
    primaryGlow: string;
    /** Secondary accent */
    secondary: string;
    /** Panel / card glass background */
    panelBg: string;
    /** Panel border color */
    panelBorder: string;
    /** Sidebar glass background */
    sidebarBg: string;
    /** Player bar hover background */
    playerBg: string;
    /** Text primary color */
    textPrimary: string;
    /** Text muted / secondary */
    textMuted: string;
}

// ── Scene Background Config ──

export interface SceneBackground {
    day: string;
    night: string;
    tint: { day: string; night: string };
}

// ── Wallpaper Gallery ──

export interface SceneWallpaper {
    /** Unique key, e.g. 'city_balcony_sunset' */
    id: string;
    /** Display name: 'Balcony Sunset' */
    name: string;
    /** Full-res image path */
    src: string;
    /** Small thumbnail for picker */
    thumbnail: string;
    /** Overlay tint applied on top */
    tint: string;
}

// ── Full Scene Interface ──

export interface Scene {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    video: {
        day: string;
        night: string;
    };
    background: SceneBackground;
    /** Selectable wallpaper gallery for this scene */
    wallpapers: SceneWallpaper[];
    /** Visual theme — colors, glass, glow */
    theme: {
        day: SceneTheme;
        night: SceneTheme;
    };
    staticFallback: string;
    defaultAmbience: string[];
    tags: string[];
}

// ── Scenes ──

export const scenes: Scene[] = [
    {
        id: 'cozy_cafe',
        name: 'Cozy Cafe',
        description: 'A warm corner café with soft lighting and gentle chatter',
        thumbnail: '/assets/images/cozy_cafe_thumb.webp',
        video: {
            day: '/assets/video/cozy_cafe_day.webm',
            night: '/assets/video/cozy_cafe_night.webm',
        },
        background: {
            day: '/scenes/cafe_day.jpg',
            night: '/scenes/cafe_night.jpg',
            tint: { day: 'rgba(30,15,5,0.4)', night: 'rgba(10,5,2,0.55)' },
        },
        wallpapers: [
            { id: 'cafe_day', name: 'Morning Café', src: '/scenes/cafe_day.jpg', thumbnail: '/scenes/cafe_day.jpg', tint: 'rgba(30,15,5,0.4)' },
            { id: 'cafe_night', name: 'Evening Café', src: '/scenes/cafe_night.jpg', thumbnail: '/scenes/cafe_night.jpg', tint: 'rgba(10,5,2,0.55)' },
        ],
        theme: {
            day: {
                primary: '#f59e0b',
                primaryGlow: 'rgba(245,158,11,0.3)',
                secondary: '#d97706',
                panelBg: 'rgba(45,27,14,0.75)',
                panelBorder: 'rgba(245,158,11,0.15)',
                sidebarBg: 'rgba(35,20,10,0.8)',
                playerBg: 'rgba(45,27,14,0.6)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(255,235,200,0.5)',
            },
            night: {
                primary: '#fb923c',
                primaryGlow: 'rgba(251,146,60,0.25)',
                secondary: '#ea580c',
                panelBg: 'rgba(25,12,5,0.8)',
                panelBorder: 'rgba(251,146,60,0.12)',
                sidebarBg: 'rgba(20,10,5,0.85)',
                playerBg: 'rgba(25,12,5,0.65)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(255,220,180,0.45)',
            },
        },
        staticFallback: '/assets/images/cozy_cafe_static.webp',
        defaultAmbience: ['coffee_shop'],
        tags: ['warm', 'social', 'comfortable', 'indoor'],
    },
    {
        id: 'japanese_garden',
        name: 'Japanese Garden',
        description: 'Tranquil cherry blossoms and a gentle koi pond',
        thumbnail: '/assets/images/japanese_garden_thumb.webp',
        video: {
            day: '/assets/video/japanese_garden_spring.webm',
            night: '/assets/video/japanese_garden_rain.webm',
        },
        background: {
            day: '/scenes/garden_day.jpg',
            night: '/scenes/garden_night.jpg',
            tint: { day: 'rgba(15,10,20,0.3)', night: 'rgba(15,5,25,0.5)' },
        },
        wallpapers: [
            { id: 'garden_spring', name: 'Spring Garden', src: '/scenes/garden_day.jpg', thumbnail: '/scenes/garden_day.jpg', tint: 'rgba(15,10,20,0.3)' },
            { id: 'garden_moonlit', name: 'Moonlit Garden', src: '/scenes/garden_night.jpg', thumbnail: '/scenes/garden_night.jpg', tint: 'rgba(15,5,25,0.5)' },
        ],
        theme: {
            day: {
                primary: '#ec4899',
                primaryGlow: 'rgba(236,72,153,0.3)',
                secondary: '#f472b6',
                panelBg: 'rgba(30,15,25,0.7)',
                panelBorder: 'rgba(236,72,153,0.15)',
                sidebarBg: 'rgba(25,10,20,0.8)',
                playerBg: 'rgba(30,15,25,0.55)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(255,200,230,0.5)',
            },
            night: {
                primary: '#a855f7',
                primaryGlow: 'rgba(168,85,247,0.25)',
                secondary: '#c084fc',
                panelBg: 'rgba(20,8,30,0.8)',
                panelBorder: 'rgba(168,85,247,0.12)',
                sidebarBg: 'rgba(15,5,25,0.85)',
                playerBg: 'rgba(20,8,30,0.6)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(220,200,255,0.45)',
            },
        },
        staticFallback: '/assets/images/japanese_garden_static.webp',
        defaultAmbience: ['wind'],
        tags: ['calm', 'nature', 'japanese', 'serene'],
    },
    {
        id: 'city_night',
        name: 'City Night',
        description: 'Neon-lit rooftop overlooking a sprawling cyberpunk metropolis',
        thumbnail: '/assets/images/city_night_thumb.webp',
        video: {
            day: '/assets/video/city_night_neon.webm',
            night: '/assets/video/city_night_rainy.webm',
        },
        background: {
            day: '/scenes/city_day.jpg',
            night: '/scenes/city_night.jpg',
            tint: { day: 'rgba(10,5,30,0.4)', night: 'rgba(5,2,15,0.45)' },
        },
        wallpapers: [
            { id: 'city_neon_street', name: 'Neon Street', src: '/scenes/city_day.jpg', thumbnail: '/scenes/city_day.jpg', tint: 'rgba(10,5,30,0.4)' },
            { id: 'city_rainy_night', name: 'Rainy Night', src: '/scenes/city_night.jpg', thumbnail: '/scenes/city_night.jpg', tint: 'rgba(5,2,15,0.45)' },
            { id: 'city_panorama', name: 'City Panorama', src: '/scenes/city_panorama.jpg', thumbnail: '/scenes/city_panorama.jpg', tint: 'rgba(5,3,20,0.4)' },
        ],
        theme: {
            day: {
                primary: '#8b5cf6',
                primaryGlow: 'rgba(139,92,246,0.3)',
                secondary: '#a78bfa',
                panelBg: 'rgba(15,8,40,0.75)',
                panelBorder: 'rgba(139,92,246,0.15)',
                sidebarBg: 'rgba(10,5,30,0.8)',
                playerBg: 'rgba(15,8,40,0.55)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(200,190,255,0.5)',
            },
            night: {
                primary: '#e879f9',
                primaryGlow: 'rgba(232,121,249,0.25)',
                secondary: '#f0abfc',
                panelBg: 'rgba(10,3,25,0.8)',
                panelBorder: 'rgba(232,121,249,0.12)',
                sidebarBg: 'rgba(8,2,20,0.85)',
                playerBg: 'rgba(10,3,25,0.6)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(240,200,255,0.45)',
            },
        },
        staticFallback: '/assets/images/city_night_static.webp',
        defaultAmbience: ['rain'],
        tags: ['urban', 'neon', 'cyberpunk', 'night', 'energetic'],
    },
    {
        id: 'forest_cabin',
        name: 'Forest Cabin',
        description: 'A cozy woodland cabin with a crackling fireplace',
        thumbnail: '/assets/images/forest_cabin_thumb.webp',
        video: {
            day: '/assets/video/forest_cabin_summer.webm',
            night: '/assets/video/forest_cabin_winter.webm',
        },
        background: {
            day: '/scenes/forest_day.jpg',
            night: '/scenes/forest_night.jpg',
            tint: { day: 'rgba(5,15,5,0.35)', night: 'rgba(3,8,3,0.5)' },
        },
        wallpapers: [
            { id: 'forest_summer', name: 'Summer Forest', src: '/scenes/forest_day.jpg', thumbnail: '/scenes/forest_day.jpg', tint: 'rgba(5,15,5,0.35)' },
            { id: 'forest_winter', name: 'Winter Night', src: '/scenes/forest_night.jpg', thumbnail: '/scenes/forest_night.jpg', tint: 'rgba(3,8,3,0.5)' },
        ],
        theme: {
            day: {
                primary: '#22c55e',
                primaryGlow: 'rgba(34,197,94,0.3)',
                secondary: '#4ade80',
                panelBg: 'rgba(10,28,12,0.7)',
                panelBorder: 'rgba(34,197,94,0.15)',
                sidebarBg: 'rgba(8,22,10,0.8)',
                playerBg: 'rgba(10,28,12,0.55)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(200,255,210,0.5)',
            },
            night: {
                primary: '#34d399',
                primaryGlow: 'rgba(52,211,153,0.25)',
                secondary: '#6ee7b7',
                panelBg: 'rgba(5,18,8,0.8)',
                panelBorder: 'rgba(52,211,153,0.12)',
                sidebarBg: 'rgba(3,14,5,0.85)',
                playerBg: 'rgba(5,18,8,0.6)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(190,240,210,0.45)',
            },
        },
        staticFallback: '/assets/images/forest_cabin_static.webp',
        defaultAmbience: ['fire', 'wind'],
        tags: ['warm', 'nature', 'cozy', 'rustic'],
    },
    {
        id: 'ocean_cliff',
        name: 'Ocean Cliff',
        description: 'Dramatic coastal cliffs with crashing waves and a lighthouse',
        thumbnail: '/assets/images/ocean_cliff_thumb.webp',
        video: {
            day: '/assets/video/ocean_cliff_sunset.webm',
            night: '/assets/video/ocean_cliff_storm.webm',
        },
        background: {
            day: '/scenes/ocean_day.jpg',
            night: '/scenes/ocean_night.jpg',
            tint: { day: 'rgba(5,10,25,0.3)', night: 'rgba(2,5,15,0.5)' },
        },
        wallpapers: [
            { id: 'ocean_sunset', name: 'Sunset Cliff', src: '/scenes/ocean_day.jpg', thumbnail: '/scenes/ocean_day.jpg', tint: 'rgba(5,10,25,0.3)' },
            { id: 'ocean_storm', name: 'Storm Night', src: '/scenes/ocean_night.jpg', thumbnail: '/scenes/ocean_night.jpg', tint: 'rgba(2,5,15,0.5)' },
        ],
        theme: {
            day: {
                primary: '#06b6d4',
                primaryGlow: 'rgba(6,182,212,0.3)',
                secondary: '#22d3ee',
                panelBg: 'rgba(8,20,40,0.7)',
                panelBorder: 'rgba(6,182,212,0.15)',
                sidebarBg: 'rgba(5,15,30,0.8)',
                playerBg: 'rgba(8,20,40,0.55)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(200,235,255,0.5)',
            },
            night: {
                primary: '#38bdf8',
                primaryGlow: 'rgba(56,189,248,0.25)',
                secondary: '#7dd3fc',
                panelBg: 'rgba(3,10,25,0.8)',
                panelBorder: 'rgba(56,189,248,0.12)',
                sidebarBg: 'rgba(2,8,20,0.85)',
                playerBg: 'rgba(3,10,25,0.6)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(180,220,255,0.45)',
            },
        },
        staticFallback: '/assets/images/ocean_cliff_static.webp',
        defaultAmbience: ['ocean'],
        tags: ['nature', 'ocean', 'dramatic', 'open'],
    },
    {
        id: 'space_station',
        name: 'Space Station',
        description: 'Orbiting Earth in a serene, minimalist space habitat',
        thumbnail: '/assets/images/space_station_thumb.webp',
        video: {
            day: '/assets/video/space_station_earth.webm',
            night: '/assets/video/space_station_deep.webm',
        },
        background: {
            day: '/scenes/space_day.jpg',
            night: '/scenes/space_night.jpg',
            tint: { day: 'rgba(3,3,15,0.35)', night: 'rgba(0,0,5,0.45)' },
        },
        wallpapers: [
            { id: 'space_earth', name: 'Earth View', src: '/scenes/space_day.jpg', thumbnail: '/scenes/space_day.jpg', tint: 'rgba(3,3,15,0.35)' },
            { id: 'space_deep', name: 'Deep Space', src: '/scenes/space_night.jpg', thumbnail: '/scenes/space_night.jpg', tint: 'rgba(0,0,5,0.45)' },
        ],
        theme: {
            day: {
                primary: '#6366f1',
                primaryGlow: 'rgba(99,102,241,0.3)',
                secondary: '#818cf8',
                panelBg: 'rgba(8,8,28,0.75)',
                panelBorder: 'rgba(99,102,241,0.15)',
                sidebarBg: 'rgba(5,5,20,0.8)',
                playerBg: 'rgba(8,8,28,0.55)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(200,200,255,0.5)',
            },
            night: {
                primary: '#a78bfa',
                primaryGlow: 'rgba(167,139,250,0.25)',
                secondary: '#c4b5fd',
                panelBg: 'rgba(3,3,15,0.8)',
                panelBorder: 'rgba(167,139,250,0.12)',
                sidebarBg: 'rgba(2,2,10,0.85)',
                playerBg: 'rgba(3,3,15,0.6)',
                textPrimary: 'rgba(255,255,255,0.9)',
                textMuted: 'rgba(210,200,255,0.45)',
            },
        },
        staticFallback: '/assets/images/space_station_static.webp',
        defaultAmbience: ['white_noise'],
        tags: ['scifi', 'minimal', 'focus', 'dark', 'futuristic'],
    },
    {
        id: 'cyberpunk_alley',
        name: 'Cyberpunk Alley',
        description: 'A rain-soaked neon alley in a dystopian megacity',
        thumbnail: '/scenes/cyberpunk_day.jpg',
        video: {
            day: '/assets/video/cyberpunk_alley_day.webm',
            night: '/assets/video/cyberpunk_alley_night.webm',
        },
        background: {
            day: '/scenes/cyberpunk_day.jpg',
            night: '/scenes/cyberpunk_night.jpg',
            tint: { day: 'rgba(0,5,15,0.12)', night: 'rgba(0,3,10,0.18)' },
        },
        wallpapers: [
            { id: 'cyberpunk_neon_alley', name: 'Neon Alley', src: '/scenes/cyberpunk_day.jpg', thumbnail: '/scenes/cyberpunk_day.jpg', tint: 'rgba(0,5,15,0.12)' },
            { id: 'cyberpunk_rain', name: 'Rain District', src: '/scenes/cyberpunk_night.jpg', thumbnail: '/scenes/cyberpunk_night.jpg', tint: 'rgba(0,3,10,0.18)' },
            { id: 'cyberpunk_rooftop', name: 'Rooftop Hacker', src: '/scenes/cyberpunk_rooftop.jpg', thumbnail: '/scenes/cyberpunk_rooftop.jpg', tint: 'rgba(3,0,12,0.15)' },
            { id: 'cyberpunk_market', name: 'Neon Market', src: '/scenes/cyberpunk_market.jpg', thumbnail: '/scenes/cyberpunk_market.jpg', tint: 'rgba(5,2,10,0.12)' },
            { id: 'cyberpunk_station', name: 'Train Station', src: '/scenes/cyberpunk_station.jpg', thumbnail: '/scenes/cyberpunk_station.jpg', tint: 'rgba(3,0,12,0.15)' },
            { id: 'cyberpunk_nomad', name: 'Digital Nomad', src: '/scenes/cyberpunk_nomad.jpg', thumbnail: '/scenes/cyberpunk_nomad.jpg', tint: 'rgba(5,2,15,0.12)' },
            { id: 'cyberpunk_skyline', name: 'Dubai Skyline', src: '/scenes/cyberpunk_skyline.jpg', thumbnail: '/scenes/cyberpunk_skyline.jpg', tint: 'rgba(2,0,10,0.1)' },
        ],
        theme: {
            day: {
                primary: '#00ffd5',
                primaryGlow: 'rgba(0,255,213,0.3)',
                secondary: '#00e5ff',
                panelBg: 'rgba(0,15,25,0.78)',
                panelBorder: 'rgba(0,255,213,0.15)',
                sidebarBg: 'rgba(0,10,18,0.82)',
                playerBg: 'rgba(0,15,25,0.58)',
                textPrimary: 'rgba(220,255,250,0.95)',
                textMuted: 'rgba(0,255,213,0.45)',
            },
            night: {
                primary: '#ff2d95',
                primaryGlow: 'rgba(255,45,149,0.28)',
                secondary: '#ff6ec7',
                panelBg: 'rgba(5,0,15,0.82)',
                panelBorder: 'rgba(255,45,149,0.12)',
                sidebarBg: 'rgba(3,0,10,0.88)',
                playerBg: 'rgba(5,0,15,0.62)',
                textPrimary: 'rgba(255,255,255,0.92)',
                textMuted: 'rgba(255,150,200,0.45)',
            },
        },
        staticFallback: '/assets/images/cyberpunk_alley_static.webp',
        defaultAmbience: ['rain'],
        tags: ['cyberpunk', 'neon', 'rain', 'dark', 'futuristic', 'urban'],
    },
    {
        id: 'ghibli_meadow',
        name: 'Ghibli Meadow',
        description: 'A dreamy pastoral hillside straight from a Ghibli film',
        thumbnail: '/scenes/ghibli_day.jpg',
        video: {
            day: '/assets/video/ghibli_meadow_day.webm',
            night: '/assets/video/ghibli_meadow_night.webm',
        },
        background: {
            day: '/scenes/ghibli_day.jpg',
            night: '/scenes/ghibli_night.jpg',
            tint: { day: 'rgba(20,15,5,0.2)', night: 'rgba(10,8,20,0.4)' },
        },
        wallpapers: [
            { id: 'ghibli_sunny_hill', name: 'Sunny Hillside', src: '/scenes/ghibli_day.jpg', thumbnail: '/scenes/ghibli_day.jpg', tint: 'rgba(15,10,5,0.1)' },
            { id: 'ghibli_starry_night', name: 'Starry Night', src: '/scenes/ghibli_night.jpg', thumbnail: '/scenes/ghibli_night.jpg', tint: 'rgba(5,3,15,0.2)' },
            { id: 'ghibli_cherry', name: 'Cherry Blossoms', src: '/scenes/ghibli_cherry.jpg', thumbnail: '/scenes/ghibli_cherry.jpg', tint: 'rgba(10,5,8,0.1)' },
            { id: 'ghibli_river', name: 'River Valley', src: '/scenes/ghibli_river.jpg', thumbnail: '/scenes/ghibli_river.jpg', tint: 'rgba(5,8,10,0.1)' },
            { id: 'ghibli_japan', name: 'Japan Village', src: '/scenes/ghibli_japan.jpg', thumbnail: '/scenes/ghibli_japan.jpg', tint: 'rgba(10,8,5,0.12)' },
            { id: 'ghibli_stars', name: 'Shooting Stars', src: '/scenes/ghibli_stars.jpg', thumbnail: '/scenes/ghibli_stars.jpg', tint: 'rgba(3,2,12,0.18)' },
        ],
        theme: {
            day: {
                primary: '#4ade80',
                primaryGlow: 'rgba(74,222,128,0.3)',
                secondary: '#86efac',
                panelBg: 'rgba(25,35,15,0.65)',
                panelBorder: 'rgba(74,222,128,0.15)',
                sidebarBg: 'rgba(20,28,12,0.72)',
                playerBg: 'rgba(25,35,15,0.5)',
                textPrimary: 'rgba(255,255,255,0.95)',
                textMuted: 'rgba(200,240,200,0.55)',
            },
            night: {
                primary: '#c084fc',
                primaryGlow: 'rgba(192,132,252,0.25)',
                secondary: '#e9d5ff',
                panelBg: 'rgba(15,10,30,0.75)',
                panelBorder: 'rgba(192,132,252,0.12)',
                sidebarBg: 'rgba(12,8,25,0.82)',
                playerBg: 'rgba(15,10,30,0.55)',
                textPrimary: 'rgba(255,255,255,0.92)',
                textMuted: 'rgba(220,200,255,0.48)',
            },
        },
        staticFallback: '/assets/images/ghibli_meadow_static.webp',
        defaultAmbience: ['wind'],
        tags: ['ghibli', 'anime', 'pastoral', 'whimsical', 'nature', 'warm'],
    },
];
