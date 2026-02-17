/**
 * Cozy Cafe Icon Pack
 * ───────────────────
 * Style: Warm, rounded, organic strokes.
 * Stroke width: 1.8–2.0 | Cap: round | Join: round
 * Feel: Inviting, comfortable, handcrafted warmth.
 */

import type { IconProps } from '../types';
import type { SceneIconPack } from '../types';

// ── Helper: shared SVG wrapper props ──
const svg = (size: number, props: Omit<IconProps, 'size'>) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: props.color ?? 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Coffee cup with steam + music note */
const CafeMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12h10a3 3 0 0 0 3-3V6H5v6z" />
        <path d="M18 8h1a2 2 0 0 1 0 4h-1" />
        <path d="M5 18h10" strokeWidth={2} />
        <path d="M8 3c.4.8.4 1.6 0 2.4" opacity={0.6} />
        <path d="M11 2c.4.8.4 1.6 0 2.4" opacity={0.6} />
    </svg>
);

/** Cafe window with curtain drape */
const CafeScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <path d="M3 5c3 2 6 2 9 0" opacity={0.5} />
        <path d="M12 5c3 2 6 2 9 0" opacity={0.5} />
    </svg>
);

/** Vintage hourglass */
const CafeFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 2h12" />
        <path d="M6 22h12" />
        <path d="M7 2v4c0 2.5 2 4 5 6c-3 2-5 3.5-5 6v4" />
        <path d="M17 2v4c0 2.5-2 4-5 6c3 2 5 3.5 5 6v4" />
        <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" opacity={0.4} />
    </svg>
);

/** Warm sun with wavy rays */
const CafeSun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" /><path d="M12 20v2" />
        <path d="M4.93 4.93l1.41 1.41" /><path d="M17.66 17.66l1.41 1.41" />
        <path d="M2 12h2" /><path d="M20 12h2" />
        <path d="M4.93 19.07l1.41-1.41" /><path d="M17.66 6.34l1.41-1.41" />
    </svg>
);

/** Crescent moon with star */
const CafeMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        <circle cx="18" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
);

/** Closed eyes — zen/meditation */
const CafeZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 11c1 1.2 2 1.2 3 0" />
        <path d="M13 11c1 1.2 2 1.2 3 0" />
        <path d="M9 16c1.5 1 4.5 1 6 0" />
    </svg>
);

/** Rounded expand arrows */
const CafeFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8V5a2 2 0 0 1 2-2h3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    </svg>
);

/** Soft rounded play triangle */
const CafePlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"
            fill="currentColor" stroke="none" opacity={0.15} />
        <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
);

/** Rounded pause bars */
const CafePause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="6" y="4" width="4" height="16" rx="1.5" />
        <rect x="14" y="4" width="4" height="16" rx="1.5" />
    </svg>
);

/** Skip forward — rounded double chevron */
const CafeSkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 4l8 8-8 8" />
        <path d="M13 4l8 8-8 8" />
    </svg>
);

/** Skip back — rounded double chevron */
const CafeSkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M19 20l-8-8 8-8" />
        <path d="M11 20l-8-8 8-8" />
    </svg>
);

/** Volume high — warm speaker */
const CafeVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18 5a9 9 0 0 1 0 14" />
    </svg>
);

/** Volume low */
const CafeVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
);

/** Volume mute — with X */
const CafeVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
);

/** Soft rounded X close */
const CafeClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" opacity={0.1} fill="currentColor" stroke="none" />
        <path d="M15 9l-6 6" />
        <path d="M9 9l6 6" />
    </svg>
);

/** Rounded check */
const CafeCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M5 12l5 5L20 7" strokeWidth={2.2} />
    </svg>
);

/** Vintage clock face */
const CafeTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5" />
        <path d="M12 5V3" />
        <path d="M10 2h4" />
    </svg>
);

/** Notepad with lines */
const CafeTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="14" y2="12" />
        <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
);

/** Bar chart — warm rounded */
const CafeStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
);

/** Rounded plus in circle */
const CafeAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

/** Soft trash can */
const CafeTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
);

// ═══════════════════════════════
//  Dashboard Nav Icons
// ═══════════════════════════════

/** Steaming latte with chart steam */
const CafeDashOverview = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 15h12a1 1 0 0 0 1-1V9H3v5a1 1 0 0 0 1 1z" />
        <path d="M17 11h1.5a2 2 0 0 1 0 4H17" />
        <path d="M5 18h10" strokeWidth={2} />
        <path d="M7 7c.3-.8.3-1.5 0-2.3" opacity={0.5} />
        <path d="M10 6c.3-.8.3-1.5 0-2.3" opacity={0.5} />
        <path d="M13 7c.3-.8.3-1.5 0-2.3" opacity={0.5} />
    </svg>
);

/** Open recipe book with lines — weekly */
const CafeDashWeekly = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" />
        <line x1="12" y1="2" x2="12" y2="22" opacity={0.3} />
        <line x1="7" y1="7" x2="10" y2="7" />
        <line x1="7" y1="10" x2="10" y2="10" />
        <line x1="7" y1="13" x2="9" y2="13" />
        <path d="M15 8l1 3 1-3" opacity={0.6} />
    </svg>
);

/** Pocket watch — peak hours */
const CafeDashHours = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2" />
        <path d="M12 5V3" />
        <path d="M10 2h4" />
        <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" opacity={0.15} />
    </svg>
);

/** Warm espresso — today */
const CafeDashToday = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 14h8a1 1 0 0 0 1-1v-3H5v3a1 1 0 0 0 1 1z" />
        <path d="M15 11h1a2 2 0 0 1 0 4h-1" />
        <path d="M6 17h8" strokeWidth={1.8} />
        <circle cx="12" cy="4" r="2" opacity={0.2} fill="currentColor" stroke="none" />
        <path d="M9 5c.4-.9.4-1.8 0-2.5" opacity={0.5} />
    </svg>
);

/** Calendar with coffee bean — activity */
const CafeDashActivity = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="5" />
        <line x1="16" y1="2" x2="16" y2="5" />
        <path d="M10 14c1-2 3-2 4 0s-1 3-2 4c-1-1-3-2-2-4z" opacity={0.5} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Soft raindrops */
const CafeRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M8 15a3 3 0 0 1-3-3c0-2.5 3-6 3-6s3 3.5 3 6a3 3 0 0 1-3 3z" />
        <path d="M16 19a3 3 0 0 1-3-3c0-2.5 3-6 3-6s3 3.5 3 6a3 3 0 0 1-3 3z" />
        <path d="M12 10a2 2 0 0 1-2-2c0-1.5 2-4 2-4s2 2.5 2 4a2 2 0 0 1-2 2z" opacity={0.6} />
    </svg>
);

/** Warm cloud with lightning */
const CafeThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M6 16a4 4 0 0 1-.5-7.97A6 6 0 0 1 17.5 8 4 4 0 0 1 18 16H6z" />
        <path d="M13 16l-2 4h3l-2 4" strokeWidth={2} />
    </svg>
);

/** Gentle breeze with curved lines */
const CafeWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8h8a3 3 0 1 0-3-3" />
        <path d="M4 14h12a3 3 0 1 1-3 3" />
        <path d="M2 11h6" opacity={0.5} />
    </svg>
);

/** Cozy fireplace with dancing flame */
const CafeFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2c-2 4-6 6-6 11a6 6 0 0 0 12 0c0-5-4-7-6-11z" />
        <path d="M12 22c-1-2-3-3-3-5.5a3 3 0 0 1 6 0c0 2.5-2 3.5-3 5.5z"
            fill="currentColor" opacity={0.15} stroke="none" />
    </svg>
);

/** Detailed steaming coffee cup */
const CafeCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 15h12a1 1 0 0 0 1-1V8H3v6a1 1 0 0 0 1 1z" />
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
        <path d="M6 19h8" strokeWidth={2} />
        <path d="M7 4c.3.8.3 1.5 0 2.3" opacity={0.5} />
        <path d="M10 3c.3.8.3 1.5 0 2.3" opacity={0.5} />
        <path d="M13 4c.3.8.3 1.5 0 2.3" opacity={0.5} />
    </svg>
);

/** Soft rolling waves */
const CafeOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity={0.6} />
        <path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" opacity={0.3} />
    </svg>
);

/** Warm radio static */
const CafeWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <path d="M3 9h18" opacity={0.2} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Piano keys — warm rounded */
const CafeLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <line x1="6" y1="6" x2="6" y2="18" opacity={0.3} />
        <line x1="10" y1="6" x2="10" y2="18" opacity={0.3} />
        <line x1="14" y1="6" x2="14" y2="18" opacity={0.3} />
        <line x1="18" y1="6" x2="18" y2="18" opacity={0.3} />
        <rect x="5" y="6" width="2.5" height="7" rx="0.5" fill="currentColor" opacity={0.15} stroke="none" />
        <rect x="9" y="6" width="2.5" height="7" rx="0.5" fill="currentColor" opacity={0.15} stroke="none" />
        <rect x="15" y="6" width="2.5" height="7" rx="0.5" fill="currentColor" opacity={0.15} stroke="none" />
    </svg>
);

/** Acoustic guitar silhouette */
const CafeSynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2v6" />
        <circle cx="12" cy="14" r="7" />
        <circle cx="12" cy="14" r="2.5" />
        <line x1="12" y1="8" x2="16" y2="5" opacity={0.4} />
    </svg>
);

/** Treble clef / classical note */
const CafeClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="8" cy="18" r="3" />
        <path d="M11 18V5" />
        <path d="M11 5c4 0 6 2 6 5s-2 4-6 5" />
    </svg>
);

/** Sparkle / shimmer effect */
const CafeAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
        <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" opacity={0.6} />
        <path d="M4 16l.7 2.3L7 19l-2.3.7L4 22l-.7-2.3L1 19l2.3-.7L4 16z" opacity={0.4} />
    </svg>
);

// ═══════════════════════════════
//  Export Pack
// ═══════════════════════════════

export const cafePack: SceneIconPack = {
    id: 'cozy_cafe',
    ui: {
        music: CafeMusic,
        scenes: CafeScenes,
        focus: CafeFocus,
        sun: CafeSun,
        moon: CafeMoon,
        zen: CafeZen,
        fullscreen: CafeFullscreen,
        play: CafePlay,
        pause: CafePause,
        skipNext: CafeSkipNext,
        skipPrev: CafeSkipPrev,
        volumeHigh: CafeVolumeHigh,
        volumeLow: CafeVolumeLow,
        volumeMute: CafeVolumeMute,
        close: CafeClose,
        check: CafeCheck,
        timer: CafeTimer,
        tasks: CafeTasks,
        stats: CafeStats,
        add: CafeAdd,
        trash: CafeTrash,
        dashOverview: CafeDashOverview,
        dashWeekly: CafeDashWeekly,
        dashHours: CafeDashHours,
        dashToday: CafeDashToday,
        dashActivity: CafeDashActivity,
    },
    ambience: {
        rain: CafeRain,
        thunder: CafeThunder,
        wind: CafeWind,
        fire: CafeFire,
        coffee_shop: CafeCoffeeShop,
        ocean: CafeOcean,
        white_noise: CafeWhiteNoise,
    },
    genre: {
        lofi: CafeLofi,
        synthwave: CafeSynthwave,
        classical: CafeClassical,
        ambient: CafeAmbient,
    },
};

export default cafePack;
