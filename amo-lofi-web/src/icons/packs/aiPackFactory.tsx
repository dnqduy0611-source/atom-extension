/**
 * AI Icon Pack Factory
 * ────────────────────
 * Converts AI-generated SVG path strings into a full SceneIconPack.
 * Only 6 sidebar icons are AI-generated; all others come from defaultPack.
 *
 * Path format: each icon is one or more `d` attributes joined by "|"
 * e.g. "M5 12h10a3 3 0 0 0 3-3V6H5v6z|M18 8h1a2 2 0 0 1 0 4h-1"
 */

import type { IconProps, SceneIconPack } from '../types';
import { defaultPack } from './defaultPack';

export interface AIIconPaths {
    music: string;
    scenes: string;
    focus: string;
    zen: string;
    timer: string;
    tasks: string;
}

/** Create an SVG icon component from path `d` strings (pipe-separated) */
function makeIcon(paths: string) {
    const segments = paths.split('|').map((d) => d.trim()).filter(Boolean);
    const Icon = ({ size = 24, color, className, style }: IconProps) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color ?? 'currentColor'}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}
        >
            {segments.map((d, i) => (
                <path key={i} d={d} />
            ))}
        </svg>
    );
    Icon.displayName = 'AIIcon';
    return Icon;
}

/**
 * Build a full SceneIconPack from AI-generated paths.
 * Only overrides the 6 sidebar icons; everything else is from defaultPack.
 */
export function createAIIconPack(sceneId: string, paths: AIIconPaths): SceneIconPack {
    return {
        id: sceneId,
        ui: {
            ...defaultPack.ui,
            music: makeIcon(paths.music),
            scenes: makeIcon(paths.scenes),
            focus: makeIcon(paths.focus),
            zen: makeIcon(paths.zen),
            timer: makeIcon(paths.timer),
            tasks: makeIcon(paths.tasks),
        },
        ambience: defaultPack.ambience,
        genre: defaultPack.genre,
    };
}
