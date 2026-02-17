import type { FC } from 'react';
import type { IconProps, SceneIconPack } from '../types';

/* ═══════════════════════════════════════════════════════════
 *  Ghibli Meadow Icon Pack
 *  ─────────────────────────────────────────────────────────
 *  Aesthetic: soft hand-drawn, whimsical curves, organic shapes
 *  Colors: leaf green, soft pink, sky blue, warm amber
 *  Motif: rounded petals, acorns, clouds, storybook elements
 * ═══════════════════════════════════════════════════════════ */

// ── Helper ──
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

// Music — wind chime with notes
const music = M([
    'M12 2v8', 'M8 4h8',
    'M8 10a3 3 0 100 6 3 3 0 000-6z',
    'M16 10a3 3 0 100 6 3 3 0 000-6z',
    'M6 20c1-2 3-2 4 0', 'M14 20c1-2 3-2 4 0',
]);

// Scenes — rolling hills
const scenes = M([
    'M2 20c3-6 6-10 10-10s7 4 10 10',
    'M1 22h22',
    'M6 14c2-3 4-5 7-5',
]);

// Focus — flower bud / seed focus
const focus = M([
    'M12 4C9 4 6 7 6 12s3 8 6 8 6-3 6-8-3-8-6-8z',
    'M12 2v2', 'M12 20v2',
    'M4 12H2', 'M22 12h-2',
]);

// Play — leaf-shaped play
const play = M([
    'M7 4c0 0 12 6 12 8s-12 8-12 8V4z',
]);

// Pause — two tall leaves
const pause = M([
    'M8 4c-1 0-2 1-2 2v12c0 1 1 2 2 2s2-1 2-2V6c0-1-1-2-2-2z',
    'M16 4c-1 0-2 1-2 2v12c0 1 1 2 2 2s2-1 2-2V6c0-1-1-2-2-2z',
]);

// Skip Next — bouncing forward
const skipNext = M([
    'M5 5c0 0 8 5 8 7s-8 7-8 7',
    'M13 5c0 0 8 5 8 7s-8 7-8 7',
]);

// Skip Prev
const skipPrev = M([
    'M19 19c0 0-8-5-8-7s8-7 8-7',
    'M11 19c0 0-8-5-8-7s8-7 8-7',
]);

// Volume High — cloud speaker
const volumeHigh = M([
    'M3 9v6h3l5 5V4L6 9H3z',
    'M16 8c1.5 1 2.5 3 2.5 4s-1 3-2.5 4',
    'M19 5c2.5 2 4 5 4 7s-1.5 5-4 7',
]);

// Volume Low
const volumeLow = M([
    'M3 9v6h3l5 5V4L6 9H3z',
    'M16 9c1 .8 2 2 2 3s-1 2.2-2 3',
]);

// Volume Mute
const volumeMute = M([
    'M3 9v6h3l5 5V4L6 9H3z',
    'M16 9l6 6', 'M22 9l-6 6',
]);

// Sun — Totoro-style warm sun
const sun = M([
    'M12 6a6 6 0 100 12 6 6 0 000-12z',
    'M12 1v3', 'M12 20v3',
    'M4.2 4.2l2.1 2.1', 'M17.7 17.7l2.1 2.1',
    'M1 12h3', 'M20 12h3',
    'M4.2 19.8l2.1-2.1', 'M17.7 6.3l2.1-2.1',
]);

// Moon — crescent with star
const moon = M([
    'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
    'M18 4l.5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5z',
]);

// Fullscreen — rounded cloud corners
const fullscreen = M([
    'M3 8V5a2 2 0 012-2h3', 'M16 3h3a2 2 0 012 2v3',
    'M21 16v3a2 2 0 01-2 2h-3', 'M8 21H5a2 2 0 01-2-2v-3',
]);

// Zen — sleeping Totoro eye
const zen = M([
    'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z',
    'M12 10a2 2 0 100 4 2 2 0 000-4z',
]);

// Close — petal X
const close = M([
    'M7 7l10 10', 'M17 7L7 17',
    'M12 5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z',
]);

// Check — sprout checkmark
const check = M([
    'M4 12l5 6L20 6',
    'M9 18v3',
]);

// Timer — acorn clock
const timer = M([
    'M12 5a7 7 0 100 14 7 7 0 000-14z',
    'M12 8v4l3 2',
    'M10 2c1-.5 3-.5 4 0', 'M12 2v3',
]);

// Tasks — mushroom checklist
const tasks = M([
    'M5 7h2', 'M10 7h9',
    'M5 12h2', 'M10 12h9',
    'M5 17h2', 'M10 17h9',
]);

// Stats — hill chart
const stats = M([
    'M2 20c3-4 5-10 8-10s3 3 5 3 3-6 7-10',
    'M2 20h20',
]);

// Add — flower plus
const add = M([
    'M12 5v14', 'M5 12h14',
    'M12 3a2 2 0 100 2 2 2 0 000-2z',
]);

// Trash — compost bin
const trash = M([
    'M4 7h16', 'M9 7V5h6v2',
    'M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12',
    'M10 11v5', 'M14 11v5',
]);

// ── Dashboard Nav Icons ──

// Overview — rolling hills chart
const dashOverview = M([
    'M2 18c3-6 5-12 8-12s4 3 6 3 3-3 6-6',
    'M2 20h20', 'M2 4v16',
]);

// Weekly — cloud trend line
const dashWeekly = M([
    'M3 16l4-5 3 3 4-7 4 4 3-5',
    'M3 20h18', 'M3 3v17',
]);

// Hours — acorn clock
const dashHours = M([
    'M12 5a7 7 0 100 14 7 7 0 000-14z',
    'M12 8v4l3 2',
    'M10 2c1-.5 3-.5 4 0', 'M12 2v3',
]);

// Today — sprout energy
const dashToday = M([
    'M12 22v-8',
    'M8 14c0-4 4-8 4-12 0 4 4 8 4 12',
    'M6 18c2-2 4-3 6-4', 'M18 18c-2-2-4-3-6-4',
]);

// Activity — flower petal grid
const dashActivity = M([
    'M5 5a2 2 0 100 0', 'M12 5a2 2 0 100 0', 'M19 5a2 2 0 100 0',
    'M5 12a2 2 0 100 0', 'M12 12a2 2 0 100 0', 'M19 12a2 2 0 100 0',
    'M5 19a2 2 0 100 0', 'M12 19a2 2 0 100 0', 'M19 19a2 2 0 100 0',
]);


// Rain — soft drizzle with cloud
const rain = M([
    'M4 10a5 5 0 019-3 5 5 0 014 0A4 4 0 0120 10a4 4 0 01-1 8H5a4 4 0 01-1-8z',
    'M8 20v2', 'M12 20v3', 'M16 20v2',
]);

// Thunder — cloud with gentle bolt
const thunder = M([
    'M4 10a5 5 0 019-3 5 5 0 014 0A4 4 0 0120 10a4 4 0 01-1 8H5a4 4 0 01-1-8z',
    'M13 18l-2 4 4-2-2 4',
]);

// Wind — curly breeze
const wind = M([
    'M2 8h10a3 3 0 100-6',
    'M2 14h14a3 3 0 110 6',
    'M5 20h5a2 2 0 100-4',
]);

// Fire — cozy campfire
const fire = M([
    'M12 2c-3 5-7 8-7 12a7 7 0 0014 0c0-4-4-7-7-12z',
    'M12 22a3 3 0 003-3c0-2-3-4-3-4s-3 2-3 4a3 3 0 003 3z',
]);

// Coffee — teacup with steam
const coffee_shop = M([
    'M5 12h10v5a4 4 0 01-4 4H9a4 4 0 01-4-4v-5z',
    'M15 14h2a2 2 0 010 4h-2',
    'M8 8c0-2 1-3 2-3', 'M12 7c0-2 1-4 2-4',
]);

// Ocean — gentle waves
const ocean = M([
    'M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
    'M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
    'M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0',
]);

// WhiteNoise — cricket chirps
const white_noise = M([
    'M3 12c1-2 2-4 4-4s3 2 4 0 2-4 4-4 3 2 4 0 1 4 3 4',
    'M5 18h.01', 'M9 6h.01', 'M15 18h.01', 'M19 8h.01',
]);

// ── Genre Icons ──

// Lofi — music box / piano
const lofi = M([
    'M3 8l9-5 9 5v10l-9 5-9-5V8z',
    'M3 8l9 5 9-5', 'M12 13v10',
]);

// HipHop — vinyl with flower
const synthwave = M([
    'M12 4a8 8 0 100 16 8 8 0 000-16z',
    'M12 10a2 2 0 100 4 2 2 0 000-4z',
    'M12 2v2', 'M20 12h2',
]);

// Classical — harp strings
const classical = M([
    'M6 2c0 0 0 18 6 20',
    'M6 4h8c2 0 4 2 4 4v10c0 2-2 4-4 4',
    'M10 4v16', 'M14 6v12',
]);

// Electronic — music wand / sparkle
const ambient = M([
    'M4 20l16-16', 'M14 4l2 2 2-2',
    'M8 8l.5 1.5L10 10l-1.5.5L8 12l-.5-1.5L6 10l1.5-.5z',
    'M16 14l.5 1.5L18 16l-1.5.5L16 18l-.5-1.5L14 16l1.5-.5z',
]);

// ═══════════════════════════════════════════════════════
export const ghibliPack: SceneIconPack = {
    id: 'ghibli_meadow',
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
