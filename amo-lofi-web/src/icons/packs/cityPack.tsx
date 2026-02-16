/**
 * City Night Icon Pack
 * ────────────────────
 * Style: Sharp, angular, neon-glow-ready, cyberpunk.
 * Stroke width: 1.5 | Cap: round | Join: miter
 * Feel: Electric, energetic, urban, futuristic.
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
    strokeLinejoin: 'miter' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Equalizer bars — neon */
const CityMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="14" width="3" height="7" rx="0.5" />
        <rect x="7.5" y="8" width="3" height="13" rx="0.5" />
        <rect x="12" y="11" width="3" height="10" rx="0.5" />
        <rect x="16.5" y="4" width="3" height="17" rx="0.5" />
        <line x1="3" y1="3" x2="19.5" y2="3" opacity={0.1} strokeDasharray="1 2" />
    </svg>
);

/** Skyscraper grid */
const CityScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="8" width="5" height="13" rx="0.5" />
        <rect x="9.5" y="3" width="5" height="18" rx="0.5" />
        <rect x="16" y="10" width="5" height="11" rx="0.5" />
        <rect x="4.5" y="10" width="1.5" height="1.5" fill="currentColor" opacity={0.3} stroke="none" />
        <rect x="4.5" y="13" width="1.5" height="1.5" fill="currentColor" opacity={0.2} stroke="none" />
        <rect x="11" y="5" width="1.5" height="1.5" fill="currentColor" opacity={0.3} stroke="none" />
        <rect x="11" y="8" width="1.5" height="1.5" fill="currentColor" opacity={0.2} stroke="none" />
        <rect x="17.5" y="12" width="1.5" height="1.5" fill="currentColor" opacity={0.3} stroke="none" />
    </svg>
);

/** Digital clock display */
const CityFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M7 10v1.5h3v1.5H7V15" strokeLinejoin="round" />
        <path d="M14 10h3v1.5h-3v1.5h3v2" strokeLinejoin="round" />
        <circle cx="12" cy="11" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="14" r="0.5" fill="currentColor" stroke="none" />
    </svg>
);

/** Neon sun burst */
const CitySun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="5" y1="5" x2="7.5" y2="7.5" />
        <line x1="16.5" y1="16.5" x2="19" y2="19" />
        <line x1="5" y1="19" x2="7.5" y2="16.5" />
        <line x1="16.5" y1="7.5" x2="19" y2="5" />
    </svg>
);

/** Neon crescent */
const CityMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
);

/** VR headset — zen */
const CityZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="2" y="8" width="20" height="9" rx="3" />
        <line x1="2" y1="12" x2="4" y2="12" opacity={0.3} />
        <line x1="20" y1="12" x2="22" y2="12" opacity={0.3} />
        <line x1="12" y1="8" x2="12" y2="17" opacity={0.2} />
        <path d="M7 12a2 2 0 1 0 4 0 2 2 0 1 0 -4 0z" opacity={0.4} />
        <path d="M13 12a2 2 0 1 0 4 0 2 2 0 1 0 -4 0z" opacity={0.4} />
    </svg>
);

/** Sharp expand arrows */
const CityFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="3,8 3,3 8,3" />
        <polyline points="16,3 21,3 21,8" />
        <polyline points="21,16 21,21 16,21" />
        <polyline points="8,21 3,21 3,16" />
    </svg>
);

/** Angular play triangle */
const CityPlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="7,4 20,12 7,20" strokeLinejoin="round" />
    </svg>
);

/** Sharp pause bars */
const CityPause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="5" y="4" width="4" height="16" rx="0.5" />
        <rect x="15" y="4" width="4" height="16" rx="0.5" />
    </svg>
);

const CitySkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="5,4 14,12 5,20" strokeLinejoin="round" />
        <line x1="19" y1="4" x2="19" y2="20" strokeWidth={2} />
    </svg>
);

const CitySkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="19,20 10,12 19,4" strokeLinejoin="round" />
        <line x1="5" y1="4" x2="5" y2="20" strokeWidth={2} />
    </svg>
);

const CityVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <path d="M16 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5.5a9 9 0 0 1 0 13" opacity={0.5} />
    </svg>
);

const CityVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <path d="M16 8.5a5 5 0 0 1 0 7" />
    </svg>
);

const CityVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <line x1="22" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="22" y2="15" />
    </svg>
);

/** Neon X */
const CityClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="6" y1="6" x2="18" y2="18" strokeWidth={1.8} />
        <line x1="18" y1="6" x2="6" y2="18" strokeWidth={1.8} />
    </svg>
);

/** Angular check */
const CityCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="4,12 9,17 20,6" strokeWidth={2} />
    </svg>
);

/** Stopwatch — sharp */
const CityTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="13" x2="15" y2="15" />
        <line x1="10" y1="2" x2="14" y2="2" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="19" y1="6" x2="20.5" y2="4.5" />
    </svg>
);

/** Terminal list */
const CityTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="7" y1="8" x2="9" y2="8" strokeWidth={2} />
        <line x1="11" y1="8" x2="17" y2="8" />
        <line x1="7" y1="12" x2="9" y2="12" strokeWidth={2} />
        <line x1="11" y1="12" x2="16" y2="12" />
        <line x1="7" y1="16" x2="9" y2="16" strokeWidth={2} />
        <line x1="11" y1="16" x2="14" y2="16" />
    </svg>
);

/** Signal strength bars */
const CityStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="4" y1="20" x2="4" y2="17" strokeWidth={2.5} />
        <line x1="8" y1="20" x2="8" y2="13" strokeWidth={2.5} />
        <line x1="12" y1="20" x2="12" y2="9" strokeWidth={2.5} />
        <line x1="16" y1="20" x2="16" y2="6" strokeWidth={2.5} />
        <line x1="20" y1="20" x2="20" y2="3" strokeWidth={2.5} />
    </svg>
);

/** Neon plus */
const CityAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="12" y1="5" x2="12" y2="19" strokeWidth={1.8} />
        <line x1="5" y1="12" x2="19" y2="12" strokeWidth={1.8} />
    </svg>
);

/** Delete — sharp */
const CityTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M8 6V4h8v2" />
        <path d="M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1 -1l1 -14" />
        <line x1="10" y1="10" x2="10" y2="17" opacity={0.4} />
        <line x1="14" y1="10" x2="14" y2="17" opacity={0.4} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Neon rain with reflection */
const CityRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="4" y1="3" x2="3" y2="9" />
        <line x1="9" y1="2" x2="8" y2="8" />
        <line x1="14" y1="4" x2="13" y2="10" />
        <line x1="19" y1="2" x2="18" y2="8" />
        <line x1="6" y1="12" x2="5" y2="18" opacity={0.5} />
        <line x1="11" y1="14" x2="10" y2="20" opacity={0.5} />
        <line x1="16" y1="12" x2="15" y2="18" opacity={0.5} />
        <line x1="21" y1="14" x2="20" y2="20" opacity={0.5} />
        <line x1="2" y1="22" x2="22" y2="22" opacity={0.15} />
    </svg>
);

/** Electric angular bolt */
const CityThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="14,2 8,11 14,11 8,22" strokeWidth={2} />
        <line x1="17" y1="8" x2="22" y2="8" opacity={0.3} />
        <line x1="18" y1="14" x2="22" y2="14" opacity={0.2} />
    </svg>
);

/** Urban wind — sharp lines */
const CityWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 8h10c2 0 3 -2 3 -3" />
        <path d="M3 14h16c2 0 2 2 2 3" />
        <path d="M3 11h5" opacity={0.4} />
    </svg>
);

/** Neon fire / gas burner */
const CityFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M12 2c-2 4 -6 6 -6 11a6 6 0 0 0 12 0c0 -5 -4 -7 -6 -11z" />
        <path d="M12 22c-1 -2 -2.5 -3 -2.5 -5a2.5 2.5 0 0 1 5 0c0 2 -1.5 3 -2.5 5z" opacity={0.3} />
    </svg>
);

/** Neon bar / lounge */
const CityCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="2" y="14" width="20" height="4" rx="1" />
        <rect x="4" y="10" width="4" height="4" rx="0.5" />
        <rect x="10" y="8" width="4" height="6" rx="0.5" />
        <rect x="16" y="11" width="4" height="3" rx="0.5" />
        <line x1="6" y1="18" x2="6" y2="21" />
        <line x1="18" y1="18" x2="18" y2="21" />
    </svg>
);

/** Frequency sine wave */
const CityOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 12c2 -3 4 -3 6 0s4 3 6 0 4 -3 6 0" />
        <path d="M2 17c2 -2 4 -2 6 0s4 2 6 0 4 -2 6 0" opacity={0.4} />
        <path d="M5 7c2 -2 4 -2 6 0" opacity={0.3} />
    </svg>
);

/** Static / interference */
const CityWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 8h2l1 -3 2 6 2 -4 1 3 2 -5 2 4 1 -2 2 5 1 -3 2 4h2" />
        <path d="M2 16h2l1 -2 2 4 2 -3 1 2 2 -4 2 3 1 -1 2 3 1 -2 2 3h2" opacity={0.4} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Headphone — lofi */
const CityLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
        <rect x="2" y="14" width="4" height="6" rx="1" />
        <rect x="18" y="14" width="4" height="6" rx="1" />
    </svg>
);

/** Retro sun / grid — synthwave */
const CitySynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M4 12h16" />
        <path d="M12 4a8 8 0 0 1 8 8" />
        <path d="M12 4a8 8 0 0 0 -8 8" />
        <line x1="5" y1="15" x2="19" y2="15" opacity={0.3} />
        <line x1="4" y1="18" x2="20" y2="18" opacity={0.2} />
        <line x1="3" y1="21" x2="21" y2="21" opacity={0.1} />
        <line x1="8" y1="12" x2="6" y2="21" opacity={0.15} />
        <line x1="16" y1="12" x2="18" y2="21" opacity={0.15} />
    </svg>
);

/** Vinyl disc — classical */
const CityClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        <path d="M12 3a9 9 0 0 1 6 3" opacity={0.15} />
    </svg>
);

/** Prism / refraction — ambient */
const CityAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="12,3 3,20 21,20" />
        <line x1="12" y1="20" x2="8" y2="10" opacity={0.3} />
        <line x1="12" y1="20" x2="16" y2="10" opacity={0.3} />
        <line x1="12" y1="3" x2="12" y2="20" opacity={0.15} />
    </svg>
);

// ═══════════════════════════════
//  Export
// ═══════════════════════════════

export const cityPack: SceneIconPack = {
    id: 'city_night',
    ui: {
        music: CityMusic,
        scenes: CityScenes,
        focus: CityFocus,
        sun: CitySun,
        moon: CityMoon,
        zen: CityZen,
        fullscreen: CityFullscreen,
        play: CityPlay,
        pause: CityPause,
        skipNext: CitySkipNext,
        skipPrev: CitySkipPrev,
        volumeHigh: CityVolumeHigh,
        volumeLow: CityVolumeLow,
        volumeMute: CityVolumeMute,
        close: CityClose,
        check: CityCheck,
        timer: CityTimer,
        tasks: CityTasks,
        stats: CityStats,
        add: CityAdd,
        trash: CityTrash,
    },
    ambience: {
        rain: CityRain,
        thunder: CityThunder,
        wind: CityWind,
        fire: CityFire,
        coffee_shop: CityCoffeeShop,
        ocean: CityOcean,
        white_noise: CityWhiteNoise,
    },
    genre: {
        lofi: CityLofi,
        synthwave: CitySynthwave,
        classical: CityClassical,
        ambient: CityAmbient,
    },
};

export default cityPack;
