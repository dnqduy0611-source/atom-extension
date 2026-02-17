/**
 * Space Station Icon Pack
 * ───────────────────────
 * Style: Minimal, thin-line, geometric, sci-fi.
 * Stroke width: 1.2–1.5 | Cap: round | Join: miter
 * Feel: Futuristic, clean, precise, weightless.
 */

import type { IconProps } from '../types';
import type { SceneIconPack } from '../types';

// ── Helper: shared SVG wrapper ──
const svg = (size: number, props: Omit<IconProps, 'size'>) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: props.color ?? 'currentColor',
    strokeWidth: 1.3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'miter' as const,
    className: props.className,
    style: props.style,
});

// ═══════════════════════════════
//  UI Icons
// ═══════════════════════════════

/** Waveform / signal icon */
const SpaceMusic = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="4" y1="8" x2="4" y2="16" />
        <line x1="7.5" y1="5" x2="7.5" y2="19" />
        <line x1="11" y1="9" x2="11" y2="15" />
        <line x1="14.5" y1="3" x2="14.5" y2="21" />
        <line x1="18" y1="7" x2="18" y2="17" />
        <line x1="21" y1="10" x2="21" y2="14" />
    </svg>
);

/** Hexagonal grid — scene selector */
const SpaceScenes = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="12,2 17,5 17,11 12,14 7,11 7,5" />
        <polygon points="7,13 12,16 12,22 7,19 2,16 2,10" opacity={0.5} />
        <polygon points="17,13 22,10 22,16 17,19 12,22 12,16" opacity={0.5} />
    </svg>
);

/** Digital timer / circuit clock */
const SpaceFocus = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M8 9v2h3v2H8v2" strokeLinejoin="round" />
        <path d="M14 9h2v2h-2v2h2v2" strokeLinejoin="round" />
        <line x1="3" y1="5" x2="5" y2="3" opacity={0.3} />
        <line x1="21" y1="5" x2="19" y2="3" opacity={0.3} />
    </svg>
);

/** Solar radiation — minimal */
const SpaceSun = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="5.6" y1="5.6" x2="7.8" y2="7.8" />
        <line x1="16.2" y1="16.2" x2="18.4" y2="18.4" />
        <line x1="5.6" y1="18.4" x2="7.8" y2="16.2" />
        <line x1="16.2" y1="7.8" x2="18.4" y2="5.6" />
    </svg>
);

/** Crescent with orbit ring */
const SpaceMoon = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M20 12.8A8 8 0 1 1 11.2 4a6 6 0 0 0 8.8 8.8z" />
        <circle cx="18" cy="6" r="1" strokeWidth={0.8} />
        <circle cx="20" cy="9" r="0.5" fill="currentColor" stroke="none" opacity={0.5} />
    </svg>
);

/** Single horizontal line — minimal zen */
const SpaceZen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="9" strokeWidth={1} />
        <line x1="7" y1="10" x2="10" y2="10" />
        <line x1="14" y1="10" x2="17" y2="10" />
        <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
);

/** Geometric expand — sharp corners */
const SpaceFullscreen = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="3,8 3,3 8,3" />
        <polyline points="16,3 21,3 21,8" />
        <polyline points="21,16 21,21 16,21" />
        <polyline points="8,21 3,21 3,16" />
        <line x1="3" y1="3" x2="8" y2="8" opacity={0.3} />
        <line x1="21" y1="3" x2="16" y2="8" opacity={0.3} />
        <line x1="21" y1="21" x2="16" y2="16" opacity={0.3} />
        <line x1="3" y1="21" x2="8" y2="16" opacity={0.3} />
    </svg>
);

/** Flat geometric play chevron */
const SpacePlay = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="7,4 20,12 7,20" strokeLinejoin="round" />
    </svg>
);

/** Two thin vertical bars */
const SpacePause = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="8" y1="5" x2="8" y2="19" strokeWidth={2} />
        <line x1="16" y1="5" x2="16" y2="19" strokeWidth={2} />
    </svg>
);

/** Sharp chevron next */
const SpaceSkipNext = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="5,4 13,12 5,20" />
        <line x1="18" y1="4" x2="18" y2="20" />
    </svg>
);

/** Sharp chevron prev */
const SpaceSkipPrev = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="19,20 11,12 19,4" />
        <line x1="6" y1="4" x2="6" y2="20" />
    </svg>
);

/** Volume — geometric speaker */
const SpaceVolumeHigh = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <path d="M16 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5.5a9 9 0 0 1 0 13" />
    </svg>
);

const SpaceVolumeLow = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <path d="M16 8.5a5 5 0 0 1 0 7" />
    </svg>
);

const SpaceVolumeMute = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polygon points="3,9 3,15 7,15 12,19 12,5 7,9" strokeLinejoin="round" />
        <line x1="22" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="22" y2="15" />
    </svg>
);

/** Sharp X */
const SpaceClose = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
);

/** Geometric check */
const SpaceCheck = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="4,12 9,17 20,6" strokeWidth={1.5} />
    </svg>
);

/** Digital countdown clock */
const SpaceTimer = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="13" r="8" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="13" x2="15" y2="15" />
        <line x1="10" y1="2" x2="14" y2="2" />
        <line x1="12" y1="2" x2="12" y2="5" />
    </svg>
);

/** Data list — minimal */
const SpaceTasks = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="9" y1="6" x2="21" y2="6" />
        <line x1="9" y1="12" x2="21" y2="12" />
        <line x1="9" y1="18" x2="21" y2="18" />
        <rect x="3" y="4.5" width="3" height="3" rx="0.5" />
        <rect x="3" y="10.5" width="3" height="3" rx="0.5" />
        <rect x="3" y="16.5" width="3" height="3" rx="0.5" />
    </svg>
);

/** Signal bars — stats */
const SpaceStats = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="4" y1="20" x2="4" y2="16" strokeWidth={2} />
        <line x1="8" y1="20" x2="8" y2="12" strokeWidth={2} />
        <line x1="12" y1="20" x2="12" y2="8" strokeWidth={2} />
        <line x1="16" y1="20" x2="16" y2="5" strokeWidth={2} />
        <line x1="20" y1="20" x2="20" y2="3" strokeWidth={2} />
    </svg>
);

/** Geometric plus */
const SpaceAdd = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

/** Eject / delete — geometric */
const SpaceTrash = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M8 6V4h8v2" />
        <path d="M5 6l1 14h12l1-14" />
        <line x1="10" y1="10" x2="10" y2="16" opacity={0.5} />
        <line x1="14" y1="10" x2="14" y2="16" opacity={0.5} />
    </svg>
);

// ═══════════════════════════════
//  Dashboard Nav Icons
// ═══════════════════════════════

/** HUD grid — overview */
const SpaceDashOverview = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="4" rx="1" />
        <rect x="13" y="9" width="8" height="2" rx="0.5" opacity={0.5} />
        <rect x="3" y="13" width="18" height="8" rx="1" opacity={0.5} />
        <line x1="6" y1="16" x2="10" y2="16" opacity={0.3} />
        <line x1="6" y1="18" x2="14" y2="18" opacity={0.3} />
    </svg>
);

/** Data graph with nodes — weekly */
const SpaceDashWeekly = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="3,16 7,10 11,13 15,6 19,9 21,4" fill="none" />
        <circle cx="7" cy="10" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="19" cy="9" r="1.5" />
        <line x1="3" y1="20" x2="21" y2="20" opacity={0.3} />
    </svg>
);

/** Digital segments — hours */
const SpaceDashHours = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M8 9v2h3" strokeLinejoin="round" />
        <path d="M8 11v2h3" strokeLinejoin="round" />
        <circle cx="15" cy="10" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="0.5" fill="currentColor" stroke="none" />
        <line x1="3" y1="5" x2="5" y2="3" opacity={0.3} />
        <line x1="21" y1="5" x2="19" y2="3" opacity={0.3} />
    </svg>
);

/** Signal pulse — today */
const SpaceDashToday = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="2,12 6,12 8,6 10,18 12,8 14,14 16,12 22,12" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" opacity={0.4} />
    </svg>
);

/** Data matrix — activity */
const SpaceDashActivity = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="3" y="3" width="4" height="4" rx="0.5" opacity={0.2} />
        <rect x="10" y="3" width="4" height="4" rx="0.5" opacity={0.5} />
        <rect x="17" y="3" width="4" height="4" rx="0.5" />
        <rect x="3" y="10" width="4" height="4" rx="0.5" opacity={0.7} />
        <rect x="10" y="10" width="4" height="4" rx="0.5" opacity={0.3} />
        <rect x="17" y="10" width="4" height="4" rx="0.5" opacity={0.6} />
        <rect x="3" y="17" width="4" height="4" rx="0.5" opacity={0.4} />
        <rect x="10" y="17" width="4" height="4" rx="0.5" />
        <rect x="17" y="17" width="4" height="4" rx="0.5" opacity={0.2} />
    </svg>
);

// ═══════════════════════════════
//  Ambience Icons
// ═══════════════════════════════

/** Falling data streams / rain */
const SpaceRain = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="5" y1="3" x2="5" y2="8" />
        <line x1="10" y1="6" x2="10" y2="14" />
        <line x1="15" y1="2" x2="15" y2="9" />
        <line x1="20" y1="5" x2="20" y2="11" />
        <line x1="3" y1="14" x2="3" y2="19" opacity={0.5} />
        <line x1="8" y1="16" x2="8" y2="22" opacity={0.5} />
        <line x1="17" y1="13" x2="17" y2="20" opacity={0.5} />
    </svg>
);

/** Electric discharge */
const SpaceThunder = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="13,2 8,12 13,12 9,22" strokeWidth={1.5} />
        <line x1="16" y1="6" x2="19" y2="6" opacity={0.4} />
        <line x1="17" y1="10" x2="21" y2="10" opacity={0.3} />
        <line x1="16" y1="16" x2="20" y2="16" opacity={0.4} />
    </svg>
);

/** Data stream / particle wind */
const SpaceWind = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="2" y1="6" x2="14" y2="6" />
        <line x1="5" y1="12" x2="22" y2="12" />
        <line x1="3" y1="18" x2="16" y2="18" />
        <circle cx="17" cy="6" r="1" strokeWidth={1} />
        <circle cx="19" cy="18" r="1" strokeWidth={1} />
    </svg>
);

/** Reactor / energy core */
const SpaceFire = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" strokeDasharray="3 3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <line x1="12" y1="2" x2="12" y2="5" opacity={0.5} />
        <line x1="12" y1="19" x2="12" y2="22" opacity={0.5} />
        <line x1="2" y1="12" x2="5" y2="12" opacity={0.5} />
        <line x1="19" y1="12" x2="22" y2="12" opacity={0.5} />
    </svg>
);

/** Space station module / pod */
const SpaceCoffeeShop = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <rect x="5" y="8" width="14" height="8" rx="1" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <line x1="5" y1="10" x2="3" y2="8" opacity={0.4} />
        <line x1="19" y1="10" x2="21" y2="8" opacity={0.4} />
        <line x1="5" y1="14" x2="3" y2="16" opacity={0.4} />
        <line x1="19" y1="14" x2="21" y2="16" opacity={0.4} />
    </svg>
);

/** Sine wave pattern */
const SpaceOcean = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <path d="M2 12 Q5 6 8 12 T14 12 T20 12 T26 12" />
        <path d="M2 17 Q5 11 8 17 T14 17 T20 17" opacity={0.4} />
        <path d="M2 7 Q5 1 8 7 T14 7 T20 7" opacity={0.4} />
    </svg>
);

/** Signal / frequency wave */
const SpaceWhiteNoise = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2a10 10 0 0 1 0 20" strokeDasharray="2 2" opacity={0.3} />
        <path d="M12 2a10 10 0 0 0 0 20" strokeDasharray="2 2" opacity={0.3} />
        <path d="M12 5a7 7 0 0 1 0 14" strokeDasharray="2 2" opacity={0.6} />
        <path d="M12 5a7 7 0 0 0 0 14" strokeDasharray="2 2" opacity={0.6} />
    </svg>
);

// ═══════════════════════════════
//  Genre Icons
// ═══════════════════════════════

/** Minimal waveform — lofi */
const SpaceLofi = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <line x1="3" y1="12" x2="5" y2="12" />
        <line x1="6" y1="8" x2="6" y2="16" />
        <line x1="9" y1="10" x2="9" y2="14" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <line x1="15" y1="9" x2="15" y2="15" />
        <line x1="18" y1="7" x2="18" y2="17" />
        <line x1="21" y1="11" x2="21" y2="13" />
    </svg>
);

/** Lightning bolt — synthwave */
const SpaceSynthwave = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <polyline points="14,2 8,11 13,11 7,22" strokeWidth={1.5} />
        <line x1="16" y1="14" x2="22" y2="14" opacity={0.3} />
        <line x1="17" y1="17" x2="21" y2="17" opacity={0.2} />
        <line x1="18" y1="20" x2="20" y2="20" opacity={0.1} />
    </svg>
);

/** Orbital circle — classical */
const SpaceClassical = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" opacity={0.4} />
    </svg>
);

/** Constellation / star pattern — ambient */
const SpaceAmbient = ({ size = 24, ...p }: IconProps) => (
    <svg {...svg(size, p)}>
        <circle cx="6" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="18" cy="4" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="14" cy="12" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="4" cy="16" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="20" cy="18" r="1" fill="currentColor" stroke="none" />
        <circle cx="10" cy="20" r="0.7" fill="currentColor" stroke="none" />
        <line x1="6" y1="6" x2="14" y2="12" opacity={0.2} />
        <line x1="18" y1="4" x2="14" y2="12" opacity={0.2} />
        <line x1="14" y1="12" x2="20" y2="18" opacity={0.2} />
        <line x1="4" y1="16" x2="10" y2="20" opacity={0.2} />
    </svg>
);

// ═══════════════════════════════
//  Export Pack
// ═══════════════════════════════

export const spacePack: SceneIconPack = {
    id: 'space_station',
    ui: {
        music: SpaceMusic,
        scenes: SpaceScenes,
        focus: SpaceFocus,
        sun: SpaceSun,
        moon: SpaceMoon,
        zen: SpaceZen,
        fullscreen: SpaceFullscreen,
        play: SpacePlay,
        pause: SpacePause,
        skipNext: SpaceSkipNext,
        skipPrev: SpaceSkipPrev,
        volumeHigh: SpaceVolumeHigh,
        volumeLow: SpaceVolumeLow,
        volumeMute: SpaceVolumeMute,
        close: SpaceClose,
        check: SpaceCheck,
        timer: SpaceTimer,
        tasks: SpaceTasks,
        stats: SpaceStats,
        add: SpaceAdd,
        trash: SpaceTrash,
        dashOverview: SpaceDashOverview,
        dashWeekly: SpaceDashWeekly,
        dashHours: SpaceDashHours,
        dashToday: SpaceDashToday,
        dashActivity: SpaceDashActivity,
    },
    ambience: {
        rain: SpaceRain,
        thunder: SpaceThunder,
        wind: SpaceWind,
        fire: SpaceFire,
        coffee_shop: SpaceCoffeeShop,
        ocean: SpaceOcean,
        white_noise: SpaceWhiteNoise,
    },
    genre: {
        lofi: SpaceLofi,
        synthwave: SpaceSynthwave,
        classical: SpaceClassical,
        ambient: SpaceAmbient,
    },
};

export default spacePack;
