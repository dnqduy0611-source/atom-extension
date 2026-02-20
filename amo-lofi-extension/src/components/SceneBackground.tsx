import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CDN_BASE, getSceneById, type Scene } from '../data/scenes';

const prefersReducedMotion =
    typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

interface Props {
    sceneId: string;
    children?: React.ReactNode;
}

/**
 * SceneBackground — Loads cinematic background from CDN.
 * Features: parallax, tint overlay, vignette, film grain, crossfade.
 */
export function SceneBackground({ sceneId, children }: Props) {
    const scene = useMemo(() => getSceneById(sceneId), [sceneId]);
    const bgUrl = `${CDN_BASE}${scene.background}`;

    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageFailed, setImageFailed] = useState(false);
    const [prevBg, setPrevBg] = useState('');
    const [transitioning, setTransitioning] = useState(false);
    const prevBgRef = useRef(bgUrl);

    // ── Mouse Parallax ──
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const rafRef = useRef(0);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (prefersReducedMotion) return;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const x = ((e.clientX / window.innerWidth) - 0.5) * -15;
            const y = ((e.clientY / window.innerHeight) - 0.5) * -8;
            setOffset({ x, y });
        });
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(rafRef.current);
        };
    }, [handleMouseMove]);

    // ── Load image ──
    useEffect(() => {
        setImageLoaded(false);
        setImageFailed(false);
        const img = new Image();
        img.onload = () => setImageLoaded(true);
        img.onerror = () => setImageFailed(true);
        img.src = bgUrl;
    }, [bgUrl]);

    // ── Crossfade on scene change ──
    useEffect(() => {
        if (bgUrl !== prevBgRef.current) {
            setPrevBg(prevBgRef.current);
            setTransitioning(true);
            prevBgRef.current = bgUrl;
            const timer = setTimeout(() => {
                setTransitioning(false);
                setPrevBg('');
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [bgUrl]);

    const parallaxTransform = prefersReducedMotion
        ? 'scale(1.08)'
        : `translate(${offset.x}px, ${offset.y}px) scale(1.08)`;

    const fallbackGradient =
        'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';

    // Apply theme CSS variables
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--theme-primary', scene.theme.primary);
        root.style.setProperty('--theme-primary-glow', scene.theme.primaryGlow);
        root.style.setProperty('--theme-text-primary', scene.theme.textPrimary);
        root.style.setProperty('--theme-text-muted', scene.theme.textMuted);
    }, [scene]);

    return (
        <div style={{
            position: 'absolute', inset: 0,
            overflow: 'hidden', background: '#000',
        }}>
            {/* Previous image (fading out) */}
            {transitioning && prevBg && (
                <div style={{
                    position: 'absolute',
                    inset: -40,
                    backgroundImage: `url(${prevBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transform: parallaxTransform,
                    transition: 'transform 0.4s ease-out',
                    animation: 'bgFadeOut 1.2s ease forwards',
                }} />
            )}

            {/* Current image */}
            <div style={{
                position: 'absolute',
                inset: -40,
                backgroundImage: imageFailed ? fallbackGradient : `url(${bgUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transform: parallaxTransform,
                transition: 'transform 0.4s ease-out',
                opacity: imageLoaded || imageFailed ? 1 : 0,
                animation: transitioning ? 'bgFadeIn 1.2s ease forwards' : undefined,
            }} />

            {/* Loading shimmer (while image loads) */}
            {!imageLoaded && !imageFailed && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 0,
                    background: fallbackGradient,
                }} />
            )}

            {/* Tint overlay */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                backgroundColor: scene.tint,
                transition: 'background-color 1s ease',
            }} />

            {/* Depth gradient */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 2,
                pointerEvents: 'none',
                background: `
          linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%),
          radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.3) 100%)
        `,
                opacity: 0.4,
            }} />

            {/* Film grain */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 3,
                pointerEvents: 'none', opacity: 0.04,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
            }} />

            {/* Vignette */}
            <div style={{
                position: 'absolute', inset: 0, zIndex: 4,
                pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
            }} />

            {/* Content */}
            <div style={{
                position: 'relative', zIndex: 5,
                width: '100%', height: '100%',
            }}>
                {children}
            </div>
        </div>
    );
}
