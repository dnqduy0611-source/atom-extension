/**
 * Forest Cabin Icon Pack
 * ──────────────────────
 * Style: Hand-drawn, rough, organic, rustic.
 * Stroke width: 1.8–2.2 | Cap: round | Join: round
 * Feel: Earthy, warm, woodsy, handcrafted.
 */

import type { IconProps } from '../types';
import type { SceneIconPack } from '../types';

const svg = (size: number, props: Omit<IconProps, 'size'>) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: props.color ?? 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Acoustic guitar */
const ForestMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="11" cy="16" r="5" />
        <circle cx="11" cy="16" r="1.5" />
        <line x1="16" y1="14" x2="20" y2="3" strokeWidth={1.8} />
        <line x1="18" y1="3" x2="22" y2="4" />
    </svg>
);

/** Pine trees / cabin */
const ForestScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M8 21l4 -8 4 8" />
        <path d="M9 17l3 -5 3 5" />
        <path d="M10 13l2 -3 2 3" />
        <line x1="12" y1="21" x2="12" y2="18" opacity={0.3} />
        <path d="M3 21h18" strokeWidth={1.5} />
    </svg>
);

/** Sundial */
const ForestFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="14" r="7" />
        <line x1="12" y1="14" x2="12" y2="9" strokeWidth={1.8} />
        <line x1="12" y1="14" x2="15" y2="12" />
        <path d="M9 3h6" />
        <line x1="12" y1="3" x2="12" y2="7" />
    </svg>
);

/** Warm sunrise through trees */
const ForestSun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
);

/** Moon with pine silhouette */
const ForestMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        <path d="M18 18l-1 -3 -1 3" opacity={0.3} />
        <path d="M17.5 16.5l-.5 -1 -.5 1" opacity={0.3} />
    </svg>
);

/** Owl eyes — zen */
const ForestZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="9" cy="11" r="2" />
        <circle cx="15" cy="11" r="2" />
        <circle cx="9" cy="11" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="11" r="0.5" fill="currentColor" stroke="none" />
        <path d="M10 15c1 1 3 1 4 0" />
    </svg>
);

/** Log cabin window expand */
const ForestFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8V5a2 2 0 0 1 2 -2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1 -2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1 -2 -2v-3" />
    </svg>
);

/** Organic play */
const ForestPlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12 -7.5a1 1 0 0 0 0 -1.72l-12 -7.5A1 1 0 0 0 7 4.5z" />
    </svg>
);

/** Thick pause bars */
const ForestPause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="5" y="4" width="4.5" height="16" rx="2" />
        <rect x="14.5" y="4" width="4.5" height="16" rx="2" />
    </svg>
);

const ForestSkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 4l8 8 -8 8" />
        <path d="M13 4l8 8 -8 8" />
    </svg>
);

const ForestSkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M19 20l-8 -8 8 -8" />
        <path d="M11 20l-8 -8 8 -8" />
    </svg>
);

const ForestVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18 5a9 9 0 0 1 0 14" opacity={0.5} />
    </svg>
);

const ForestVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

const ForestVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
);

/** Twig X */
const ForestClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
    </svg>
);

/** Leaf check */
const ForestCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12l5 5L20 7" strokeWidth={2.5} />
    </svg>
);

/** Wooden hourglass */
const ForestTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 2h12" strokeWidth={2.5} />
        <path d="M6 22h12" strokeWidth={2.5} />
        <path d="M7 2v4c0 2.5 2 4 5 6c-3 2 -5 3.5 -5 6v4" />
        <path d="M17 2v4c0 2.5 -2 4 -5 6c3 2 5 3.5 5 6v4" />
    </svg>
);

/** Birch bark notepad */
const ForestTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="14" y2="12" />
        <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
);

/** Stacked logs — stats */
const ForestStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="6" cy="19" rx="3" ry="2" />
        <ellipse cx="12" cy="19" rx="3" ry="2" />
        <ellipse cx="18" cy="19" rx="3" ry="2" />
        <ellipse cx="9" cy="15" rx="3" ry="2" />
        <ellipse cx="15" cy="15" rx="3" ry="2" />
        <ellipse cx="12" cy="11" rx="3" ry="2" />
    </svg>
);

/** Twig plus */
const ForestAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

/** Axe chop — delete */
const ForestTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1 -2 2H8a2 2 0 0 1 -2 -2L5 6" />
    </svg>
);

// ═══════════════════════════════
//  Dashboard Nav Icons
// ═══════════════════════════════

/** Stacked logs chart — overview */
const ForestDashOverview = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="7" cy="19" rx="4" ry="2" />
        <ellipse cx="17" cy="19" rx="4" ry="2" />
        <ellipse cx="12" cy="15" rx="4" ry="2" />
        <ellipse cx="12" cy="11" rx="3" ry="1.5" opacity={0.5} />
        <ellipse cx="12" cy="8" rx="2" ry="1" opacity={0.3} />
    </svg>
);

/** Tree ring chart — weekly */
const ForestDashWeekly = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="6" opacity={0.5} />
        <circle cx="12" cy="12" r="3" opacity={0.3} />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" opacity={0.2} />
        <line x1="12" y1="3" x2="12" y2="21" opacity={0.15} />
        <line x1="3" y1="12" x2="21" y2="12" opacity={0.15} />
    </svg>
);

/** Sundial — hours */
const ForestDashHours = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="14" r="7" />
        <line x1="12" y1="14" x2="12" y2="9" strokeWidth={1.8} />
        <line x1="12" y1="14" x2="15" y2="12" />
        <path d="M9 3h6" />
        <line x1="12" y1="3" x2="12" y2="7" />
    </svg>
);

/** Acorn — today */
const ForestDashToday = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 6c-3 0 -6 3 -6 7a6 6 0 0 0 12 0c0 -4 -3 -7 -6 -7z" />
        <path d="M8 6c0 -2 2 -4 4 -4s4 2 4 4" />
        <line x1="12" y1="2" x2="12" y2="6" opacity={0.4} />
        <path d="M10 11c1 1 3 1 4 0" opacity={0.3} />
    </svg>
);

/** Leaf grid — activity */
const ForestDashActivity = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="5" cy="5" r="2" opacity={0.3} />
        <circle cx="12" cy="5" r="2" opacity={0.7} />
        <circle cx="19" cy="5" r="2" />
        <circle cx="5" cy="12" r="2" opacity={0.5} />
        <circle cx="12" cy="12" r="2" />
        <circle cx="19" cy="12" r="2" opacity={0.4} />
        <circle cx="5" cy="19" r="2" opacity={0.8} />
        <circle cx="12" cy="19" r="2" opacity={0.2} />
        <circle cx="19" cy="19" r="2" opacity={0.6} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Heavy droplets */
const ForestRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 3c-2 3 -4 5 -4 8a4 4 0 0 0 8 0c0 -3 -2 -5 -4 -8z" />
        <path d="M6 14c-1 1.5 -2 2.5 -2 4a2 2 0 0 0 4 0c0 -1.5 -1 -2.5 -2 -4z" opacity={0.5} />
        <path d="M19 12c-1 1.5 -2 2.5 -2 4a2 2 0 0 0 4 0c0 -1.5 -1 -2.5 -2 -4z" opacity={0.5} />
    </svg>
);

/** Cloud with angular bolt */
const ForestThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 16a4 4 0 0 1 -.5 -7.97A6 6 0 0 1 17.5 8 4 4 0 0 1 18 16H6z" />
        <path d="M12 16l-1 3h3l-2 4" strokeWidth={2.2} />
    </svg>
);

/** Leaves blowing */
const ForestWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8h9c2 0 3 -2 3 -3" />
        <path d="M4 14h12c2 0 3 2 3 3" />
        <path d="M16 6c0 0 1 -1 2 0s0 2 0 2" opacity={0.4} />
        <path d="M20 12c0 0 1 -1 2 0s0 2 0 2" opacity={0.4} />
    </svg>
);

/** Campfire with logs */
const ForestFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2c-2 4 -5 5 -5 10a5 5 0 0 0 10 0c0 -5 -3 -6 -5 -10z" />
        <path d="M12 22c-.8 -1.5 -2 -2 -2 -4a2 2 0 0 1 4 0c0 2 -1.2 2.5 -2 4z" fill="currentColor" opacity={0.15} stroke="none" />
        <line x1="3" y1="20" x2="9" y2="22" strokeWidth={2.5} />
        <line x1="15" y1="22" x2="21" y2="20" strokeWidth={2.5} />
    </svg>
);

/** Log cabin interior */
const ForestCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 10l9 -7 9 7" />
        <rect x="5" y="10" width="14" height="11" rx="1" />
        <rect x="9" y="14" width="6" height="7" rx="0.5" />
        <line x1="12" y1="14" x2="12" y2="21" opacity={0.3} />
    </svg>
);

/** Stream / creek */
const ForestOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 10c3 -2 5 -2 8 0s5 2 8 0" />
        <path d="M4 15c3 -2 5 -2 8 0s5 2 6 0" opacity={0.5} />
        <path d="M6 20c2 -1 4 -1 6 0s4 1 6 0" opacity={0.3} />
    </svg>
);

/** Cricket / nature sounds */
const ForestWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 5a7 7 0 0 1 5.5 2.5" opacity={0.3} />
        <path d="M12 5a7 7 0 0 0 -5.5 2.5" opacity={0.3} />
        <path d="M12 19a7 7 0 0 0 5.5 -2.5" opacity={0.3} />
        <path d="M12 19a7 7 0 0 1 -5.5 -2.5" opacity={0.3} />
        <circle cx="12" cy="12" r="9" strokeDasharray="3 4" opacity={0.2} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Campfire guitar */
const ForestLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="8" cy="18" r="3" />
        <path d="M11 18V5" />
        <path d="M11 8l4 -3" />
        <path d="M11 6l4 -2" />
    </svg>
);

/** Banjo / folk string */
const ForestSynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="15" r="6" />
        <circle cx="12" cy="15" r="2" />
        <line x1="12" y1="9" x2="12" y2="3" strokeWidth={1.8} />
        <line x1="10" y1="3" x2="14" y2="3" />
    </svg>
);

/** Bird song — nature sounds */
const ForestClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 8c3 0 5 -2 6 -4" />
        <circle cx="12" cy="10" r="4" />
        <path d="M8 10l-4 4" />
        <path d="M16 12l2 2" opacity={0.4} />
        <path d="M10 14l-1 4 3 -2 3 2 -1 -4" />
    </svg>
);

/** Mushroom / forest ambient */
const ForestAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 3c-5 0 -8 4 -8 8h16c0 -4 -3 -8 -8 -8z" />
        <rect x="10" y="11" width="4" height="8" rx="1" />
        <line x1="6" y1="21" x2="18" y2="21" />
        <circle cx="8" cy="7" r="1" fill="currentColor" opacity={0.15} stroke="none" />
        <circle cx="14" cy="6" r="1.2" fill="currentColor" opacity={0.15} stroke="none" />
    </svg>
);

// ═══════════════════════════════
//  Export
// ═══════════════════════════════

export const forestPack: SceneIconPack = {
    id: 'forest_cabin',
    ui: {
        music: ForestMusic,
        scenes: ForestScenes,
        focus: ForestFocus,
        sun: ForestSun,
        moon: ForestMoon,
        zen: ForestZen,
        fullscreen: ForestFullscreen,
        play: ForestPlay,
        pause: ForestPause,
        skipNext: ForestSkipNext,
        skipPrev: ForestSkipPrev,
        volumeHigh: ForestVolumeHigh,
        volumeLow: ForestVolumeLow,
        volumeMute: ForestVolumeMute,
        close: ForestClose,
        check: ForestCheck,
        timer: ForestTimer,
        tasks: ForestTasks,
        stats: ForestStats,
        add: ForestAdd,
        trash: ForestTrash,
        dashOverview: ForestDashOverview,
        dashWeekly: ForestDashWeekly,
        dashHours: ForestDashHours,
        dashToday: ForestDashToday,
        dashActivity: ForestDashActivity,
    },
    ambience: {
        rain: ForestRain,
        thunder: ForestThunder,
        wind: ForestWind,
        fire: ForestFire,
        coffee_shop: ForestCoffeeShop,
        ocean: ForestOcean,
        white_noise: ForestWhiteNoise,
    },
    genre: {
        lofi: ForestLofi,
        synthwave: ForestSynthwave,
        classical: ForestClassical,
        ambient: ForestAmbient,
    },
};

export default forestPack;
