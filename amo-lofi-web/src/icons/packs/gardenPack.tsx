/**
 * Japanese Garden Icon Pack
 * ─────────────────────────
 * Style: Flowing, organic, ink-brush feel.
 * Stroke width: 1.5 | Cap: round | Join: round
 * Feel: Zen, serene, natural, minimalist Japanese.
 */

import type { IconProps } from '../types';
import type { SceneIconPack } from '../types';

const svg = (size: number, props: Omit<IconProps, 'size'>) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: props.color ?? 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Shakuhachi bamboo flute */
const GardenMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 4l1 16" strokeWidth={2} />
        <circle cx="7" cy="10" r="1" fill="currentColor" stroke="none" opacity={0.4} />
        <circle cx="7" cy="13" r="1" fill="currentColor" stroke="none" opacity={0.4} />
        <circle cx="7" cy="16" r="1" fill="currentColor" stroke="none" opacity={0.4} />
        <path d="M6 4c2-1 5-1 7 1" />
        <path d="M13 5c1.5 1 2 3 1 5" opacity={0.4} />
    </svg>
);

/** Mini torii gate */
const GardenScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="5" y1="6" x2="19" y2="6" strokeWidth={2} />
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="7" y1="9" x2="7" y2="21" />
        <line x1="17" y1="9" x2="17" y2="21" />
        <path d="M3 6c4 -3 14 -3 18 0" strokeWidth={1.8} />
    </svg>
);

/** Zen garden rake pattern */
const GardenFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="8" cy="12" r="3" />
        <path d="M2 7c6 0 10 2 20 0" opacity={0.4} />
        <path d="M2 12c3 0 3.5 -2 5 -2" opacity={0.4} />
        <path d="M11 10c3 -1 6 -1 11 -1" opacity={0.4} />
        <path d="M2 17c6 0 10 2 20 0" opacity={0.4} />
        <path d="M11 14c3 1 6 1 11 1" opacity={0.4} />
    </svg>
);

/** Rising sun with rays */
const GardenSun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 18h20" />
        <path d="M12 18a7 7 0 0 1 -7 -7c0 -4 3.5 -7 7 -7s7 3 7 7a7 7 0 0 1 -7 7z" />
        <path d="M5 10l-2 -1" opacity={0.5} />
        <path d="M19 10l2 -1" opacity={0.5} />
        <path d="M12 4V2" opacity={0.5} />
        <path d="M7 5l-1 -2" opacity={0.5} />
        <path d="M17 5l1 -2" opacity={0.5} />
    </svg>
);

/** Crescent with bamboo */
const GardenMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        <path d="M16 16v-5" opacity={0.3} />
        <path d="M16 11c1 -1 2 -1 3 0" opacity={0.3} />
    </svg>
);

/** Enso circle — zen meditation */
const GardenZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 3a9 9 0 1 1 -1 0" strokeWidth={2} strokeDasharray="0" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" opacity={0.3} />
    </svg>
);

/** Sliding shoji screen */
const GardenFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <path d="M3 8h9" opacity={0.3} />
        <path d="M3 13h9" opacity={0.3} />
        <path d="M3 18h9" opacity={0.3} />
        <path d="M8 3l-3 9" opacity={0.15} />
    </svg>
);

/** Flowing leaf play */
const GardenPlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M7 4v16l12 -8z" />
    </svg>
);

/** Bamboo pause bars */
const GardenPause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="8" y1="4" x2="8" y2="20" strokeWidth={2} />
        <line x1="16" y1="4" x2="16" y2="20" strokeWidth={2} />
        <path d="M7.5 4c0.5 -0.5 1 -0.5 1 0" opacity={0.3} />
        <path d="M15.5 4c0.5 -0.5 1 -0.5 1 0" opacity={0.3} />
    </svg>
);

const GardenSkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 4l8 8 -8 8" />
        <line x1="18" y1="4" x2="18" y2="20" />
    </svg>
);

const GardenSkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M19 20l-8 -8 8 -8" />
        <line x1="6" y1="4" x2="6" y2="20" />
    </svg>
);

const GardenVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18 5a9 9 0 0 1 0 14" opacity={0.5} />
    </svg>
);

const GardenVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

const GardenVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
);

/** Brush stroke X close */
const GardenClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 6c4 4 8 8 12 12" strokeWidth={1.8} />
        <path d="M18 6c-4 4 -8 8 -12 12" strokeWidth={1.8} />
    </svg>
);

/** Flowing check stroke */
const GardenCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12c2 2 3 4 4 5c3 -4 6 -8 10 -10" strokeWidth={2} />
    </svg>
);

/** Water clock — dripping time */
const GardenTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2" />
        <path d="M10 2h4" />
        <path d="M12 2v3" />
    </svg>
);

/** Scroll / task list */
const GardenTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 3c0 0 0 2 2 2h10c2 0 2 -2 2 -2" />
        <rect x="5" y="5" width="14" height="16" rx="1" />
        <line x1="9" y1="9" x2="15" y2="9" opacity={0.5} />
        <line x1="9" y1="12.5" x2="14" y2="12.5" opacity={0.5} />
        <line x1="9" y1="16" x2="12" y2="16" opacity={0.5} />
    </svg>
);

/** Stacked stones — stats */
const GardenStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="12" cy="19" rx="5" ry="1.5" />
        <ellipse cx="12" cy="15" rx="3.5" ry="1.2" />
        <ellipse cx="12" cy="11.5" rx="2.5" ry="1" />
        <ellipse cx="12" cy="8.5" rx="1.5" ry="0.8" />
        <circle cx="12" cy="5.5" r="1" fill="currentColor" opacity={0.3} stroke="none" />
    </svg>
);

/** Bamboo plus */
const GardenAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

/** Falling leaf — delete */
const GardenTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1 -2 2H8a2 2 0 0 1 -2 -2L5 6" />
    </svg>
);

// ═══════════════════════════════
//  Dashboard Nav Icons
// ═══════════════════════════════

/** Zen rock garden with rake — overview */
const GardenDashOverview = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="8" cy="14" rx="3" ry="1.5" />
        <path d="M2 18c5 0 8 -2 20 0" opacity={0.4} />
        <path d="M2 21c5 -1 8 -2 20 0" opacity={0.3} />
        <path d="M11 10c3 -1 5 -1 8 0" opacity={0.4} />
        <ellipse cx="17" cy="8" rx="2" ry="1" />
    </svg>
);

/** Bamboo scroll — weekly */
const GardenDashWeekly = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 3c-1 0 -2 1 -2 2v14c0 1 1 2 2 2" />
        <path d="M6 3h12c1 0 2 1 2 2v14c0 1 -1 2 -2 2H6" />
        <line x1="9" y1="8" x2="17" y2="8" opacity={0.4} />
        <line x1="9" y1="11" x2="15" y2="11" opacity={0.4} />
        <line x1="9" y1="14" x2="13" y2="14" opacity={0.4} />
        <path d="M9 17l2 -3 2 2 3 -4" opacity={0.6} />
    </svg>
);

/** Water clock — hours */
const GardenDashHours = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M10 2h4" />
        <path d="M12 2v3" />
        <path d="M12 17c0 -1 1 -2 2 -2" opacity={0.3} />
    </svg>
);

/** Cherry blossom — today */
const GardenDashToday = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity={0.2} stroke="none" />
        <path d="M12 4c-1 2 -1 4 0 6" />
        <path d="M12 4c1 2 1 4 0 6" />
        <path d="M6 9c2 0 4 1 5 3" />
        <path d="M6 9c1 1 2 3 5 3" opacity={0.5} />
        <path d="M18 9c-2 0 -4 1 -5 3" />
        <path d="M18 9c-1 1 -2 3 -5 3" opacity={0.5} />
        <path d="M8 18c1 -2 2 -3 4 -4" opacity={0.5} />
        <path d="M16 18c-1 -2 -2 -3 -4 -4" opacity={0.5} />
    </svg>
);

/** Stone garden grid — activity */
const GardenDashActivity = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="6" cy="6" rx="2.5" ry="1.2" opacity={0.3} />
        <ellipse cx="12" cy="6" rx="2.5" ry="1.2" opacity={0.7} />
        <ellipse cx="18" cy="6" rx="2.5" ry="1.2" />
        <ellipse cx="6" cy="12" rx="2.5" ry="1.2" opacity={0.5} />
        <ellipse cx="12" cy="12" rx="2.5" ry="1.2" />
        <ellipse cx="18" cy="12" rx="2.5" ry="1.2" opacity={0.4} />
        <ellipse cx="6" cy="18" rx="2.5" ry="1.2" opacity={0.8} />
        <ellipse cx="12" cy="18" rx="2.5" ry="1.2" opacity={0.2} />
        <ellipse cx="18" cy="18" rx="2.5" ry="1.2" opacity={0.6} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Japanese diagonal rain — fine lines */
const GardenRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="4" y1="3" x2="2" y2="9" opacity={0.6} />
        <line x1="9" y1="2" x2="7" y2="8" />
        <line x1="14" y1="4" x2="12" y2="10" opacity={0.6} />
        <line x1="19" y1="2" x2="17" y2="8" />
        <line x1="6" y1="12" x2="4" y2="18" opacity={0.6} />
        <line x1="11" y1="11" x2="9" y2="17" />
        <line x1="16" y1="13" x2="14" y2="19" opacity={0.6} />
        <line x1="21" y1="12" x2="19" y2="18" />
    </svg>
);

/** Cloud with energy */
const GardenThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 16a4 4 0 0 1 -.5 -7.97A6 6 0 0 1 17.5 8 4 4 0 0 1 18 16H6z" />
        <path d="M12 16l-1 3h3l-2 4" strokeWidth={1.8} />
    </svg>
);

/** Sakura branch in wind */
const GardenWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8h9c2 0 3 -2 3 -3" />
        <path d="M5 14h13c2 0 3 2 3 3" />
        <circle cx="15" cy="7" r="1.5" fill="currentColor" opacity={0.2} stroke="none" />
        <circle cx="8" cy="11" r="1" fill="currentColor" opacity={0.15} stroke="none" />
        <circle cx="20" cy="12" r="1.2" fill="currentColor" opacity={0.2} stroke="none" />
    </svg>
);

/** Lantern flame */
const GardenFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M8 21h8" />
        <path d="M10 21V18" />
        <path d="M14 21V18" />
        <rect x="8" y="10" width="8" height="8" rx="1" />
        <path d="M12 6c-1 2 -2 3 -2 4.5a2 2 0 0 0 4 0c0 -1.5 -1 -2.5 -2 -4.5z" fill="currentColor" opacity={0.15} stroke="none" />
        <path d="M12 3c-1.5 3 -3 4.5 -3 7a3 3 0 0 0 6 0c0 -2.5 -1.5 -4 -3 -7z" />
    </svg>
);

/** Tea ceremony — steaming cup */
const GardenCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12h10c0 4 -2 7 -5 7s-5 -3 -5 -7z" />
        <path d="M15 13h1a2.5 2.5 0 0 1 0 5h-1" />
        <path d="M8 9c.3 -.8.3 -1.5 0 -2.3" opacity={0.5} />
        <path d="M12 9c.3 -.8.3 -1.5 0 -2.3" opacity={0.5} />
    </svg>
);

/** Great Wave inspired */
const GardenOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 12c2 -3 4 -3 6 0s4 3 6 0 4 -3 6 0" strokeWidth={1.8} />
        <path d="M2 17c2 -2 4 -2 6 0s4 2 6 0 4 -2 6 0" opacity={0.4} />
        <path d="M2 7c1 -1 2 -1 3 0" opacity={0.3} />
        <path d="M8 6c1 -2 2 -2 3 0" opacity={0.3} />
    </svg>
);

/** Wind chime — white noise */
const GardenWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="6" y1="3" x2="18" y2="3" />
        <line x1="8" y1="3" x2="8" y2="10" />
        <line x1="12" y1="3" x2="12" y2="12" />
        <line x1="16" y1="3" x2="16" y2="9" />
        <circle cx="8" cy="11" r="1" />
        <circle cx="12" cy="13" r="1" />
        <circle cx="16" cy="10" r="1" />
        <path d="M12 14v2" opacity={0.4} />
        <path d="M11 17l2 -1" opacity={0.3} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Koto strings */
const GardenLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 20L20 4" strokeWidth={1.8} />
        <line x1="7" y1="14" x2="7" y2="18" opacity={0.4} />
        <line x1="10" y1="11" x2="10" y2="15" opacity={0.4} />
        <line x1="13" y1="8" x2="13" y2="12" opacity={0.4} />
        <line x1="16" y1="5" x2="16" y2="9" opacity={0.4} />
    </svg>
);

/** Taiko drum */
const GardenSynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="12" cy="14" rx="8" ry="5" />
        <ellipse cx="12" cy="10" rx="8" ry="5" />
        <line x1="4" y1="10" x2="4" y2="14" />
        <line x1="20" y1="10" x2="20" y2="14" />
    </svg>
);

/** Shamisen / classical instrument */
const GardenClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="10" cy="17" r="4" />
        <line x1="13" y1="14" x2="19" y2="3" strokeWidth={1.8} />
        <line x1="17" y1="3" x2="21" y2="5" />
    </svg>
);

/** Floating petals — ambient */
const GardenAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 3c-2 3 -1 6 1 8c-3 -1 -6 0 -8 2" opacity={0.5} />
        <path d="M12 3c2 3 1 6 -1 8c3 -1 6 0 8 2" opacity={0.5} />
        <circle cx="7" cy="18" r="1.5" fill="currentColor" opacity={0.15} stroke="none" />
        <circle cx="17" cy="16" r="1" fill="currentColor" opacity={0.15} stroke="none" />
        <circle cx="12" cy="20" r="1.2" fill="currentColor" opacity={0.15} stroke="none" />
        <circle cx="5" cy="13" r="0.8" fill="currentColor" opacity={0.1} stroke="none" />
    </svg>
);

// ═══════════════════════════════
//  Export
// ═══════════════════════════════

export const gardenPack: SceneIconPack = {
    id: 'japanese_garden',
    ui: {
        music: GardenMusic,
        scenes: GardenScenes,
        focus: GardenFocus,
        sun: GardenSun,
        moon: GardenMoon,
        zen: GardenZen,
        fullscreen: GardenFullscreen,
        play: GardenPlay,
        pause: GardenPause,
        skipNext: GardenSkipNext,
        skipPrev: GardenSkipPrev,
        volumeHigh: GardenVolumeHigh,
        volumeLow: GardenVolumeLow,
        volumeMute: GardenVolumeMute,
        close: GardenClose,
        check: GardenCheck,
        timer: GardenTimer,
        tasks: GardenTasks,
        stats: GardenStats,
        add: GardenAdd,
        trash: GardenTrash,
        dashOverview: GardenDashOverview,
        dashWeekly: GardenDashWeekly,
        dashHours: GardenDashHours,
        dashToday: GardenDashToday,
        dashActivity: GardenDashActivity,
    },
    ambience: {
        rain: GardenRain,
        thunder: GardenThunder,
        wind: GardenWind,
        fire: GardenFire,
        coffee_shop: GardenCoffeeShop,
        ocean: GardenOcean,
        white_noise: GardenWhiteNoise,
    },
    genre: {
        lofi: GardenLofi,
        synthwave: GardenSynthwave,
        classical: GardenClassical,
        ambient: GardenAmbient,
    },
};

export default gardenPack;
