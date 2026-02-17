/**
 * Ocean Cliff Icon Pack
 * ─────────────────────
 * Style: Fluid, wave-inspired curves, nautical.
 * Stroke width: 1.5–1.8 | Cap: round | Join: round
 * Feel: Open, free, powerful yet calm, oceanic.
 */

import type { IconProps } from '../types';
import type { SceneIconPack } from '../types';

const svg = (size: number, props: Omit<IconProps, 'size'>) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: props.color ?? 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Conch shell */
const OceanMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M19 5c-3 2 -5 5 -5 9a5 5 0 0 1 -10 0c0 -5 3 -10 8 -12" />
        <path d="M14 14c0 -3 1 -5 3 -7" opacity={0.4} />
        <circle cx="8" cy="14" r="2" opacity={0.3} />
        <path d="M19 5c1 0 2 1 2 2" opacity={0.5} />
    </svg>
);

/** Lighthouse beacon */
const OceanScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M9 21h6" />
        <path d="M10 21V11l2 -7 2 7v10" />
        <line x1="10" y1="14" x2="14" y2="14" />
        <line x1="10" y1="17" x2="14" y2="17" />
        <path d="M8 6l-4 -2" opacity={0.4} />
        <path d="M16 6l4 -2" opacity={0.4} />
        <path d="M12 3v-1" opacity={0.4} />
    </svg>
);

/** Compass rose */
const OceanFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <polygon points="12,4 13.5,10.5 12,9 10.5,10.5" fill="currentColor" opacity={0.2} stroke="none" />
        <polygon points="12,4 13.5,10.5 12,12 10.5,10.5" />
        <polygon points="12,20 10.5,13.5 12,15 13.5,13.5" />
        <line x1="3" y1="12" x2="7" y2="12" opacity={0.3} />
        <line x1="17" y1="12" x2="21" y2="12" opacity={0.3} />
    </svg>
);

/** Sun over horizon */
const OceanSun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 16h20" />
        <path d="M5 16a7 7 0 0 1 14 0" />
        <line x1="12" y1="3" x2="12" y2="5" />
        <line x1="5.6" y1="5.6" x2="7.1" y2="7.1" />
        <line x1="18.4" y1="5.6" x2="16.9" y2="7.1" />
        <line x1="2" y1="10" x2="4" y2="10" opacity={0.5} />
        <line x1="20" y1="10" x2="22" y2="10" opacity={0.5} />
        <path d="M3 20c3 -2 5 -2 8 0s5 2 8 0" opacity={0.3} />
    </svg>
);

/** Moon over water */
const OceanMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M20 11.79A8 8 0 1 1 12.21 4a6 6 0 0 0 7.79 7.79z" />
        <path d="M3 20c3 -1.5 5 -1.5 8 0s5 1.5 8 0" opacity={0.3} />
    </svg>
);

/** Seabird — zen */
const OceanZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 12c3 -4 6 -4 9 0c3 -4 6 -4 9 0" />
        <path d="M5 16c3 -3 5 -3 7 0c2 -3 4 -3 7 0" opacity={0.4} />
    </svg>
);

/** Wave expand corners */
const OceanFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8V5a2 2 0 0 1 2 -2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1 -2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1 -2 -2v-3" />
    </svg>
);

/** Wave-shaped play */
const OceanPlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M7 4v16l13 -8z" />
    </svg>
);

/** Rounded pause */
const OceanPause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="5" y="4" width="4.5" height="16" rx="1.5" />
        <rect x="14.5" y="4" width="4.5" height="16" rx="1.5" />
    </svg>
);

const OceanSkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 4l8 8 -8 8" />
        <line x1="18" y1="4" x2="18" y2="20" />
    </svg>
);

const OceanSkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M19 20l-8 -8 8 -8" />
        <line x1="6" y1="4" x2="6" y2="20" />
    </svg>
);

const OceanVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18 5a9 9 0 0 1 0 14" opacity={0.5} />
    </svg>
);

const OceanVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

const OceanVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
    </svg>
);

/** Wave X */
const OceanClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
    </svg>
);

/** Anchor check */
const OceanCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12l5 5L20 7" strokeWidth={2} />
    </svg>
);

/** Ship's clock */
const OceanTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="7" opacity={0.15} />
        <path d="M12 8v4l3 2" />
        <line x1="12" y1="3" x2="12" y2="5" opacity={0.4} />
        <line x1="21" y1="12" x2="19" y2="12" opacity={0.4} />
        <line x1="3" y1="12" x2="5" y2="12" opacity={0.4} />
        <line x1="12" y1="19" x2="12" y2="21" opacity={0.4} />
    </svg>
);

/** Captain's log */
const OceanTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="14" y2="12" />
        <line x1="8" y1="16" x2="12" y2="16" />
        <path d="M4 3l1 -1h14l1 1" opacity={0.3} />
    </svg>
);

/** Tide chart — stats */
const OceanStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 20c3 -5 5 -8 7 -10c2 -2 4 -1 5 2c1 3 3 4 6 -2" />
        <line x1="3" y1="20" x2="21" y2="20" opacity={0.3} />
        <line x1="3" y1="3" x2="3" y2="20" opacity={0.3} />
    </svg>
);

/** Anchor plus */
const OceanAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

/** Overboard — delete */
const OceanTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1 -2 2H8a2 2 0 0 1 -2 -2L5 6" />
    </svg>
);

// ═══════════════════════════════
//  Dashboard Nav Icons
// ═══════════════════════════════

/** Wave tide chart — overview */
const OceanDashOverview = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 17c3 -4 5 -7 7 -9c2 -2 4 -1 5 2c1 3 3 3 6 -1" />
        <line x1="3" y1="20" x2="21" y2="20" opacity={0.3} />
        <line x1="3" y1="3" x2="3" y2="20" opacity={0.3} />
        <path d="M3 20c3 -1 5 -1 8 0s5 1 8 0" opacity={0.2} />
    </svg>
);

/** Tide line — weekly */
const OceanDashWeekly = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 8c3 -3 5 -3 8 0s5 3 8 0" />
        <path d="M2 13c3 -2 5 -2 8 0s5 2 8 0" opacity={0.5} />
        <path d="M2 18c3 -1 5 -1 8 0s5 1 8 0" opacity={0.3} />
        <line x1="6" y1="3" x2="6" y2="6" opacity={0.3} />
        <line x1="12" y1="2" x2="12" y2="5" opacity={0.3} />
        <line x1="18" y1="3" x2="18" y2="6" opacity={0.3} />
    </svg>
);

/** Ship's clock — hours */
const OceanDashHours = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="7" opacity={0.15} />
        <path d="M12 8v4l3 2" />
        <line x1="12" y1="3" x2="12" y2="5" opacity={0.4} />
        <line x1="21" y1="12" x2="19" y2="12" opacity={0.4} />
        <line x1="3" y1="12" x2="5" y2="12" opacity={0.4} />
        <line x1="12" y1="19" x2="12" y2="21" opacity={0.4} />
    </svg>
);

/** Anchor — today */
const OceanDashToday = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="5" r="2" />
        <line x1="12" y1="7" x2="12" y2="21" />
        <path d="M6 15c0 4 3 6 6 6s6 -2 6 -6" />
        <line x1="5" y1="12" x2="12" y2="12" />
        <line x1="12" y1="12" x2="19" y2="12" />
    </svg>
);

/** Shell grid — activity */
const OceanDashActivity = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 4c1 1 3 1 4 0" opacity={0.3} />
        <path d="M10 4c1 1 3 1 4 0" opacity={0.7} />
        <path d="M16 4c1 1 3 1 4 0" />
        <path d="M4 10c1 1 3 1 4 0" opacity={0.6} />
        <path d="M10 10c1 1 3 1 4 0" />
        <path d="M16 10c1 1 3 1 4 0" opacity={0.4} />
        <path d="M4 16c1 1 3 1 4 0" opacity={0.8} />
        <path d="M10 16c1 1 3 1 4 0" opacity={0.2} />
        <path d="M16 16c1 1 3 1 4 0" opacity={0.5} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Drizzle over waves */
const OceanRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="5" y1="3" x2="5" y2="7" />
        <line x1="10" y1="2" x2="10" y2="6" />
        <line x1="15" y1="4" x2="15" y2="8" />
        <line x1="20" y1="2" x2="20" y2="6" />
        <path d="M2 12c3 -2 5 -2 8 0s5 2 8 0" />
        <path d="M2 17c3 -2 5 -2 8 0s5 2 8 0" opacity={0.5} />
    </svg>
);

/** Storm over sea */
const OceanThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 12a4 4 0 0 1 -.5 -3.97A6 6 0 0 1 17.5 4 4 4 0 0 1 18 12H6z" />
        <polyline points="13,12 10,17 14,17 11,22" strokeWidth={1.8} />
    </svg>
);

/** Sea breeze with gull */
const OceanWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8h9c2 0 3 -2 3 -3" />
        <path d="M5 14h13c2 0 3 2 3 3" />
        <path d="M17 5c-1 -2 -2 -2 -3 -1" opacity={0.4} />
        <path d="M21 7c-1 -1 -2 -1 -3 0" opacity={0.3} />
    </svg>
);

/** Volcanic vent / thermal */
const OceanFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2c-2 4 -5 6 -5 11a5 5 0 0 0 10 0c0 -5 -3 -7 -5 -11z" />
        <path d="M12 22c-.8 -1.5 -2 -2.5 -2 -4.5a2 2 0 0 1 4 0c0 2 -1.2 3 -2 4.5z" opacity={0.3} />
    </svg>
);

/** Harbor / dock café */
const OceanCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 14h12a1 1 0 0 0 1 -1V8H3v5a1 1 0 0 0 1 1z" />
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
        <path d="M5 18h10" strokeWidth={1.8} />
        <path d="M7 4.5c.3 .8 .3 1.5 0 2.3" opacity={0.4} />
        <path d="M11 3.5c.3 .8 .3 1.5 0 2.3" opacity={0.4} />
    </svg>
);

/** Detailed wave curl */
const OceanOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 10c2 -3 4 -4 6 -3c3 1 3 5 6 5c2 0 3 -1 4 -3" strokeWidth={1.8} />
        <path d="M2 15c3 -2 5 -2 8 0s5 2 8 0" opacity={0.5} />
        <path d="M4 20c3 -1.5 5 -1.5 8 0s5 1.5 6 0" opacity={0.3} />
    </svg>
);

/** Whale song / deep sound */
const OceanWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 12c1 -3 4 -6 9 -6s8 3 9 6" />
        <path d="M3 12c1 3 4 6 9 6s8 -3 9 -6" />
        <circle cx="12" cy="12" r="2" />
        <path d="M8 12h-2" opacity={0.3} />
        <path d="M18 12h-2" opacity={0.3} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Acoustic / ukulele — lofi */
const OceanLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="8" cy="18" r="3" />
        <path d="M11 18V6" />
        <path d="M11 6c3 0 5 1 6 3" />
        <path d="M11 9c2 0 4 1 5 2" opacity={0.4} />
    </svg>
);

/** Steel drums  — synthwave */
const OceanSynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <ellipse cx="12" cy="14" rx="9" ry="5" />
        <ellipse cx="12" cy="10" rx="9" ry="5" />
        <circle cx="8" cy="12" r="1.5" opacity={0.3} />
        <circle cx="15" cy="11" r="1.2" opacity={0.3} />
        <circle cx="12" cy="14" r="1" opacity={0.3} />
    </svg>
);

/** Harp — classical */
const OceanClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 3c0 10 2 16 6 18" />
        <path d="M6 3h10c2 0 3 2 3 4c0 6 -3 11 -7 14" />
        <line x1="8" y1="7" x2="16" y2="7" opacity={0.3} />
        <line x1="8" y1="11" x2="15" y2="10" opacity={0.3} />
        <line x1="9" y1="15" x2="14" y2="13" opacity={0.3} />
    </svg>
);

/** Seashell spiral — ambient */
const OceanAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 12a2 2 0 0 1 2 2a4 4 0 0 1 -4 4a6 6 0 0 1 -6 -6a8 8 0 0 1 8 -8a10 10 0 0 1 10 10" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" opacity={0.4} />
    </svg>
);

// ═══════════════════════════════
//  Export
// ═══════════════════════════════

export const oceanPack: SceneIconPack = {
    id: 'ocean_cliff',
    ui: {
        music: OceanMusic,
        scenes: OceanScenes,
        focus: OceanFocus,
        sun: OceanSun,
        moon: OceanMoon,
        zen: OceanZen,
        fullscreen: OceanFullscreen,
        play: OceanPlay,
        pause: OceanPause,
        skipNext: OceanSkipNext,
        skipPrev: OceanSkipPrev,
        volumeHigh: OceanVolumeHigh,
        volumeLow: OceanVolumeLow,
        volumeMute: OceanVolumeMute,
        close: OceanClose,
        check: OceanCheck,
        timer: OceanTimer,
        tasks: OceanTasks,
        stats: OceanStats,
        add: OceanAdd,
        trash: OceanTrash,
        dashOverview: OceanDashOverview,
        dashWeekly: OceanDashWeekly,
        dashHours: OceanDashHours,
        dashToday: OceanDashToday,
        dashActivity: OceanDashActivity,
    },
    ambience: {
        rain: OceanRain,
        thunder: OceanThunder,
        wind: OceanWind,
        fire: OceanFire,
        coffee_shop: OceanCoffeeShop,
        ocean: OceanOcean,
        white_noise: OceanWhiteNoise,
    },
    genre: {
        lofi: OceanLofi,
        synthwave: OceanSynthwave,
        classical: OceanClassical,
        ambient: OceanAmbient,
    },
};

export default oceanPack;
