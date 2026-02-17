import type { CSSProperties, FC } from 'react';

// ══════════════════════════════════════════════════════
//  Icon Props — shared by all icon components
// ══════════════════════════════════════════════════════

export interface IconProps {
    size?: number;
    color?: string;
    className?: string;
    style?: CSSProperties;
}

// ══════════════════════════════════════════════════════
//  Scene Icon Pack — full icon set for one scene
//  Each scene overrides all or part of these slots.
//  Missing slots fallback to defaultPack.
// ══════════════════════════════════════════════════════

export interface SceneIconPack {
    id: string;

    /** UI control icons — sidebar, player, toolbar, panels */
    ui: {
        // Sidebar
        music: FC<IconProps>;        // Sound Mixer toggle
        scenes: FC<IconProps>;       // Scene selector toggle
        focus: FC<IconProps>;        // Focus panel toggle
        sun: FC<IconProps>;          // Day mode
        moon: FC<IconProps>;         // Night mode
        zen: FC<IconProps>;          // Zen mode
        fullscreen: FC<IconProps>;   // Fullscreen toggle

        // Player controls
        play: FC<IconProps>;         // Play
        pause: FC<IconProps>;        // Pause
        skipNext: FC<IconProps>;     // Next track
        skipPrev: FC<IconProps>;     // Previous track
        volumeHigh: FC<IconProps>;   // Volume high
        volumeLow: FC<IconProps>;    // Volume low
        volumeMute: FC<IconProps>;   // Volume muted

        // Panel shared
        close: FC<IconProps>;        // Close button
        check: FC<IconProps>;        // Active / done indicator

        // Focus panel
        timer: FC<IconProps>;        // Pomodoro timer tab
        tasks: FC<IconProps>;        // Task list tab
        stats: FC<IconProps>;        // Statistics tab
        add: FC<IconProps>;          // Add task
        trash: FC<IconProps>;        // Delete task
    };

    /** Ambience sound icons — keyed by sound ID */
    ambience: {
        rain: FC<IconProps>;
        thunder: FC<IconProps>;
        wind: FC<IconProps>;
        fire: FC<IconProps>;
        coffee_shop: FC<IconProps>;
        ocean: FC<IconProps>;
        white_noise: FC<IconProps>;
    };

    /** Music genre icons — keyed by genre */
    genre: {
        lofi: FC<IconProps>;
        synthwave: FC<IconProps>;
        classical: FC<IconProps>;
        ambient: FC<IconProps>;
    };
}
