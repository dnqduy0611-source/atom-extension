import type { FC } from 'react';
import type { IconProps, SceneIconPack } from '../types';

/* ═══════════════════════════════════════════════════════════
 *  Cyberpunk Alley Icon Pack
 *  ─────────────────────────────────────────────────────────
 *  Aesthetic: glitched circuits, sharp angles, neon glow
 *  Colors: cyan #00ffd5, magenta #ff2d95, electric blue
 *  Motif: data lines, hexagons, circuit traces, HUD elements
 * ═══════════════════════════════════════════════════════════ */

// ── Helper ──
const I = (d: string, vb = '0 0 24 24'): FC<IconProps> =>
    ({ size = 24, color = 'currentColor', style, className }) => (
        <svg width={size} height={size} viewBox={vb} fill="none"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={style} className={className}>
            <path d={d} />
        </svg>
    );

// Multi-path helper
const M = (paths: string[], vb = '0 0 24 24'): FC<IconProps> =>
    ({ size = 24, color = 'currentColor', style, className }) => (
        <svg width={size} height={size} viewBox={vb} fill="none"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={style} className={className}>
            {paths.map((d, i) => <path key={i} d={d} />)}
        </svg>
    );

// ── UI Icons ──

// Music — equalizer with glitch bars
const music = M([
    'M3 18V10l3-3h2v11', 'M10 18V7l3-3h2v14', 'M17 18V4l3-3h1v17',
    'M3 14h4', 'M10 11h4',
]);

// Scenes — hexagonal grid (HUD)
const scenes = M([
    'M12 2l5 3v6l-5 3-5-3V5z',
    'M7 14l-5 3v4l5 3 5-3', 'M17 14l5 3v4l-5 3-5-3',
]);

// Focus — crosshair reticle
const focus = M([
    'M12 2v4', 'M12 18v4', 'M2 12h4', 'M18 12h4',
    'M12 8a4 4 0 100 8 4 4 0 000-8z',
]);

// Play — angular play with circuit trace
const play = M([
    'M6 3l14 9-14 9V3z', 'M6 12h-4', 'M20 12h2',
]);

// Pause — glitched pause bars
const pause = M([
    'M8 4v16', 'M16 4v16', 'M6 8h4', 'M14 16h4',
]);

// Skip Next — double chevron with data line
const skipNext = M([
    'M5 4l8 8-8 8', 'M13 4l8 8-8 8', 'M3 12h2',
]);

// Skip Prev
const skipPrev = M([
    'M19 20l-8-8 8-8', 'M11 20l-8-8 8-8', 'M19 12h2',
]);

// Volume High — signal waves
const volumeHigh = M([
    'M3 9v6h4l5 5V4L7 9H3z', 'M16 8a5 5 0 010 8', 'M19 5a9 9 0 010 14',
]);

// Volume Low
const volumeLow = M([
    'M3 9v6h4l5 5V4L7 9H3z', 'M16 9a3 3 0 010 6',
]);

// Volume Mute — X through speaker
const volumeMute = M([
    'M3 9v6h4l5 5V4L7 9H3z', 'M16 9l6 6', 'M22 9l-6 6',
]);

// Sun — digital sun / sector
const sun = M([
    'M12 5a7 7 0 100 14 7 7 0 000-14z',
    'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42',
    'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42',
]);

// Moon — crescent with data dots
const moon = M([
    'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
    'M16 6h.01', 'M19 10h.01',
]);

// Fullscreen — corner brackets (HUD frame)
const fullscreen = M([
    'M3 3h6', 'M3 3v6', 'M21 3h-6', 'M21 3v6',
    'M3 21h6', 'M3 21v-6', 'M21 21h-6', 'M21 21v-6',
]);

// Zen — VR visor eye
const zen = M([
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z',
    'M12 9a3 3 0 100 6 3 3 0 000-6z',
    'M3 6l2 2', 'M21 6l-2 2',
]);

// Close — X with corner accents
const close = M([
    'M6 6l12 12', 'M18 6L6 18',
    'M4 4h2', 'M4 4v2', 'M20 20h-2', 'M20 20v-2',
]);

// Check — angular checkmark
const check = I('M4 12l6 6L20 6');

// Timer — digital countdown ring
const timer = M([
    'M12 2a10 10 0 100 20 10 10 0 000-20z',
    'M12 6v6l4 2',
    'M10 1h4', 'M12 1v2',
]);

// Tasks — circuit checklist
const tasks = M([
    'M4 6h2', 'M10 6h10',
    'M4 12h2', 'M10 12h10',
    'M4 18h2', 'M10 18h10',
    'M4 5v2', 'M4 11v2', 'M4 17v2',
]);

// Stats — bar graph with data line
const stats = M([
    'M4 20V14', 'M9 20V10', 'M14 20V6', 'M19 20V8',
    'M4 14l5-4 5 2 5-6',
]);

// Add — plus in hexagon
const add = M([
    'M12 7v10', 'M7 12h10',
    'M12 2l8 4.5v11L12 22l-8-4.5v-11z',
]);

// Trash — data wipe
const trash = M([
    'M3 6h18', 'M8 6V4h8v2',
    'M5 6l1 14h12l1-14',
    'M10 10v7', 'M14 10v7',
]);

// ── Dashboard Nav Icons ──

// Overview — HUD bar graph
const dashOverview = M([
    'M4 20V14', 'M8 20V8', 'M12 20V11', 'M16 20V5', 'M20 20V9',
    'M2 20h20',
]);

// Weekly — data trend line
const dashWeekly = M([
    'M3 17l4-7 4 5 4-9 4 6',
    'M3 20h18', 'M3 3v17',
]);

// Hours — countdown ring
const dashHours = M([
    'M12 2a10 10 0 100 20 10 10 0 000-20z',
    'M12 6v6l4 2',
    'M10 1h4', 'M12 1v2',
]);

// Today — energy spike
const dashToday = M([
    'M13 2L5 14h6l-2 8 8-12h-6z',
    'M18 4h3', 'M19 8h2',
]);

// Activity — data matrix grid
const dashActivity = M([
    'M4 4h3v3H4z', 'M10.5 4h3v3h-3z', 'M17 4h3v3h-3z',
    'M4 10.5h3v3H4z', 'M10.5 10.5h3v3h-3z', 'M17 10.5h3v3h-3z',
    'M4 17h3v3H4z', 'M10.5 17h3v3h-3z', 'M17 17h3v3h-3z',
]);


// Rain — glitch rain drops
const rain = M([
    'M8 2v6', 'M12 4v8', 'M16 1v5', 'M6 12v6', 'M10 14v5', 'M14 13v6', 'M18 11v5',
    'M4 10h16',
]);

// Thunder — lightning bolt with circuit
const thunder = M([
    'M13 2L5 14h6l-2 8 8-12h-6z',
    'M18 4h3', 'M19 8h2',
]);

// Wind — data stream lines
const wind = M([
    'M2 6h13a3 3 0 000-6H8', 'M2 12h17a3 3 0 010 6H12', 'M2 18h9a3 3 0 000-6',
]);

// Fire — digital flame
const fire = M([
    'M12 2C8 6 4 10 4 14a8 8 0 0016 0c0-4-4-8-8-12z',
    'M12 18a3 3 0 003-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 003 3z',
]);

// Coffee — cyber coffee
const coffee_shop = M([
    'M3 8h14v6a4 4 0 01-4 4H7a4 4 0 01-4-4V8z',
    'M17 10h2a2 2 0 010 4h-2',
    'M7 3v3', 'M10 2v4', 'M13 3v3',
]);

// Ocean — sine wave signal
const ocean = M([
    'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
    'M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
    'M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
]);

// WhiteNoise — static interference
const white_noise = M([
    'M2 6h4l2-3 2 6 2-4 2 5 2-3 2 4 2-5h4',
    'M2 12h3l2 4 2-6 2 3 2-5 2 6 2-3 2 4h3',
    'M2 18h4l2-2 2 4 2-3 2 5 2-4 2 2h4',
]);

// ── Genre Icons ──

// Lofi — chip/circuit piano
const lofi = M([
    'M4 14h16v6H4z', 'M7 14V8l10-2v8',
    'M7 17v3', 'M10 17v3', 'M14 17v3', 'M17 17v3',
]);

// HipHop — turntable disc
const synthwave = M([
    'M12 4a8 8 0 100 16 8 8 0 000-16z',
    'M12 10a2 2 0 100 4 2 2 0 000-4z',
    'M3 3l4 4', 'M20 12h2',
]);

// Classical — violin/circuit
const classical = M([
    'M12 2v4', 'M9 6h6', 'M10 6v6a5 5 0 005 5 5 5 0 005-5V8',
    'M12 17v5', 'M9 22h6',
]);

// Electronic — waveform
const ambient = M([
    'M2 12l3-8 3 16 3-12 3 10 3-14 3 10',
    'M2 12h20',
]);

// ═══════════════════════════════════════════════════════
export const cyberpunkPack: SceneIconPack = {
    id: 'cyberpunk_alley',
    ui: {
        music, scenes, focus, play, pause, skipNext, skipPrev,
        volumeHigh, volumeLow, volumeMute,
        sun, moon, fullscreen, zen, close, check,
        timer, tasks, stats, add, trash,
        dashOverview, dashWeekly, dashHours, dashToday, dashActivity,
    },
    ambience: { rain, thunder, wind, fire, coffee_shop, ocean, white_noise },
    genre: { lofi, synthwave, classical, ambient },
};
