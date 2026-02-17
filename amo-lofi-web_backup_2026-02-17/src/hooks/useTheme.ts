import { useEffect, useMemo } from 'react';
import { useLofiStore } from '../store/useLofiStore';
import { scenes, type SceneTheme } from '../data/scenes';
import { useCustomScenes } from './useCustomScenes';

/**
 * useTheme — reads active scene & variant → writes CSS custom properties.
 *
 * Components never hardcode colors. They use:
 *   var(--theme-primary)
 *   var(--theme-primary-glow)
 *   var(--theme-panel-bg)
 *   var(--theme-panel-border)
 *   var(--theme-sidebar-bg)
 *   var(--theme-player-bg)
 *   var(--theme-text)
 *   var(--theme-text-muted)
 *   var(--theme-secondary)
 *
 * Switching scene or variant → all UI updates instantly via CSS cascade.
 * AI-generated themes work the same way: just provide a SceneTheme object.
 */

const CSS_VAR_MAP: Record<keyof SceneTheme, string> = {
    primary: '--theme-primary',
    primaryGlow: '--theme-primary-glow',
    secondary: '--theme-secondary',
    panelBg: '--theme-panel-bg',
    panelBorder: '--theme-panel-border',
    sidebarBg: '--theme-sidebar-bg',
    playerBg: '--theme-player-bg',
    textPrimary: '--theme-text',
    textMuted: '--theme-text-muted',
};

export function useTheme() {
    const activeSceneId = useLofiStore((s) => s.activeSceneId);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const customAccent = useLofiStore((s) => s.customAccent);
    const accentGlowEnabled = useLofiStore((s) => s.accentGlowEnabled);
    const { customScenes } = useCustomScenes();

    const theme = useMemo(() => {
        // Search built-in first, then custom scenes
        const scene = scenes.find((s) => s.id === activeSceneId)
            ?? customScenes.find((s) => s.id === activeSceneId)
            ?? scenes[0];
        return scene.theme[activeVariant];
    }, [activeSceneId, activeVariant, customScenes]);

    useEffect(() => {
        const root = document.documentElement;
        for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
            root.style.setProperty(cssVar, theme[key as keyof SceneTheme]);
        }
        // Override primary with user's custom accent color
        if (customAccent) {
            root.style.setProperty('--theme-primary', customAccent);
            root.style.setProperty('--theme-primary-glow', customAccent + '4d');
        }
        // Accent glow toggle — components use this to show/hide colored borders
        root.style.setProperty('--theme-glow-opacity', accentGlowEnabled ? '1' : '0');
    }, [theme, customAccent, accentGlowEnabled]);

    return theme;
}
