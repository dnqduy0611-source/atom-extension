import { memo } from 'react';
import { useLofiStore } from '../../store/useLofiStore';

/**
 * AmbientGlow — Ambilight-style edge glow.
 * Now reads from CSS theme vars (--theme-primary-glow) instead
 * of hardcoded per-scene colors. Automatically adapts to scene changes.
 * Respects accentGlowEnabled toggle from store.
 */
export const AmbientGlow = memo(function AmbientGlow() {
    const accentGlowEnabled = useLofiStore((s) => s.accentGlowEnabled);

    if (!accentGlowEnabled) return null;

    return (
        <div
            className="absolute inset-0 z-[4] pointer-events-none transition-all duration-1000"
            style={{
                boxShadow: `
                    inset 0 80px 120px -40px var(--theme-primary-glow),
                    inset 0 -80px 120px -40px var(--theme-primary-glow),
                    inset 80px 0 120px -40px var(--theme-primary-glow),
                    inset -80px 0 120px -40px var(--theme-primary-glow)
                `,
                animation: 'ambientPulse 6s ease-in-out infinite',
            }}
        />
    );
});
