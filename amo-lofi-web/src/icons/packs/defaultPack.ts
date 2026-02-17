/**
 * Default Icon Pack — wraps lucide-react icons.
 * Used as fallback when a scene doesn't have a custom pack.
 *
 * lucide-react icons already accept { size, color, className, style }
 * so they conform to our IconProps interface directly.
 */

import {
    // Sidebar
    Music, Palette, Timer, Sun, Moon, Eye, Maximize,
    // Player
    Play, Pause, SkipForward, SkipBack,
    Volume2, Volume1, VolumeX,
    // Panel shared
    X, Check,
    // Focus
    Clock, ListTodo, BarChart3, Plus, Trash2,
    // Dashboard nav
    LayoutDashboard, TrendingUp, Clock3, Zap, CalendarDays,
    // Ambience
    CloudRain, CloudLightning, Wind, Flame, Coffee, Waves, Radio,
    // Genre
    Piano, Guitar, Music2, Sparkles,
} from 'lucide-react';

import type { SceneIconPack } from '../types';

export const defaultPack: SceneIconPack = {
    id: 'default',

    ui: {
        // Sidebar
        music: Music,
        scenes: Palette,
        focus: Timer,
        sun: Sun,
        moon: Moon,
        zen: Eye,
        fullscreen: Maximize,

        // Player
        play: Play,
        pause: Pause,
        skipNext: SkipForward,
        skipPrev: SkipBack,
        volumeHigh: Volume2,
        volumeLow: Volume1,
        volumeMute: VolumeX,

        // Panel
        close: X,
        check: Check,

        // Focus
        timer: Clock,
        tasks: ListTodo,
        stats: BarChart3,
        add: Plus,
        trash: Trash2,

        // Dashboard
        dashOverview: LayoutDashboard,
        dashWeekly: TrendingUp,
        dashHours: Clock3,
        dashToday: Zap,
        dashActivity: CalendarDays,
    },

    ambience: {
        rain: CloudRain,
        thunder: CloudLightning,
        wind: Wind,
        fire: Flame,
        coffee_shop: Coffee,
        ocean: Waves,
        white_noise: Radio,
    },

    genre: {
        lofi: Piano,
        synthwave: Guitar,
        classical: Music2,
        ambient: Sparkles,
    },
};
