import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { scenes } from '../../data/scenes';
import { useCustomScenes } from '../../hooks/useCustomScenes';
import { useCustomWallpapers } from '../../hooks/useCustomWallpapers';

// Check reduced-motion preference once
const prefersReducedMotion =
    typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

/**
 * SceneBackground — data-driven from scenes.ts.
 * Uses real photographs with mood overlays, parallax, and crossfade transitions.
 * Adding a new scene requires ZERO changes to this file.
 */

interface Props {
    children?: React.ReactNode;
}

export function SceneBackground({ children }: Props) {
    const activeSceneId = useLofiStore((s) => s.activeSceneId);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const activeWallpaperId = useLofiStore((s) => s.activeWallpaperId);
    const tintOpacity = useLofiStore((s) => s.tintOpacity);
    const vignetteEnabled = useLofiStore((s) => s.vignetteEnabled);
    const backgroundDarken = useLofiStore((s) => s.backgroundDarken);
    const { customScenes } = useCustomScenes();
    const { wallpapers: customWallpapers } = useCustomWallpapers(activeSceneId);

    const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
    const [prevImage, setPrevImage] = useState('');
    const [transitioning, setTransitioning] = useState(false);

    // ── Mouse Parallax ──
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const rafRef = useRef<number>(0);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (prefersReducedMotion) return; // skip parallax for reduced-motion
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const x = ((e.clientX / window.innerWidth) - 0.5) * -20;
            const y = ((e.clientY / window.innerHeight) - 0.5) * -10;
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

    // Resolve scene data (built-in → custom → fallback)
    const scene = useMemo(
        () => scenes.find((s) => s.id === activeSceneId)
            ?? customScenes.find((s) => s.id === activeSceneId)
            ?? scenes[0],
        [activeSceneId, customScenes],
    );

    // Resolve wallpaper: check cloud → custom → built-in
    const isCloudWallpaper = activeWallpaperId?.startsWith('cloud_url:');
    const isCustomWallpaper = activeWallpaperId?.startsWith('custom_');
    const cloudWpUrl = isCloudWallpaper
        ? activeWallpaperId!.replace('cloud_url:', '')
        : null;
    const customWp = isCustomWallpaper
        ? customWallpapers.find(w => w.id === activeWallpaperId)
        : null;
    const builtInWp = !isCustomWallpaper && !isCloudWallpaper && activeWallpaperId
        ? scene.wallpapers.find(w => w.id === activeWallpaperId)
        : null;

    const currentImage = cloudWpUrl ?? customWp?.blobUrl ?? builtInWp?.src ?? scene.background[activeVariant];
    const currentTint = customWp?.tint ?? builtInWp?.tint ?? scene.background.tint[activeVariant];

    // ── Fallback gradient when image fails to load ──
    const imageFailed = failedImages.has(currentImage);
    const fallbackGradient = 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)';

    // Lazy image loading — active scene first, others deferred
    useEffect(() => {
        const preloadSrc = (src: string) => {
            if (loadedImages.has(src) || failedImages.has(src)) return;
            const img = new Image();
            img.onload = () => setLoadedImages((prev) => new Set(prev).add(src));
            img.onerror = () => setFailedImages((prev) => new Set(prev).add(src));
            img.src = src;
        };

        // Priority: preload active scene images immediately
        const activeSrcs = [
            scene.background.day,
            scene.background.night,
            ...scene.wallpapers.map(w => w.src),
        ];
        activeSrcs.forEach(preloadSrc);

        // Defer: preload other scenes when idle
        const idleHandle = ('requestIdleCallback' in window)
            ? window.requestIdleCallback(() => {
                scenes.filter(s => s.id !== activeSceneId).forEach((s) => {
                    [s.background.day, s.background.night, ...s.wallpapers.map(w => w.src)]
                        .forEach(preloadSrc);
                });
            })
            : setTimeout(() => {
                scenes.filter(s => s.id !== activeSceneId).forEach((s) => {
                    [s.background.day, s.background.night, ...s.wallpapers.map(w => w.src)]
                        .forEach(preloadSrc);
                });
            }, 2000);

        return () => {
            if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle as number);
            else clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
        };
    }, [activeSceneId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Track previous image for crossfade
    const prevImageRef = useRef(currentImage);
    useEffect(() => {
        if (currentImage !== prevImageRef.current) {
            setPrevImage(prevImageRef.current);
            setTransitioning(true);
            prevImageRef.current = currentImage;
            const timer = setTimeout(() => {
                setTransitioning(false);
                setPrevImage('');
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [currentImage]);

    const parallaxTransform = prefersReducedMotion
        ? 'scale(1.1)'
        : `translate(${offset.x}px, ${offset.y}px) scale(1.1)`;

    return (
        <div className="absolute inset-0 overflow-hidden bg-black">
            {/* ── Previous image (fading out) ── */}
            {transitioning && prevImage && (
                <div
                    className="absolute inset-[-40px] z-0"
                    style={{
                        backgroundImage: failedImages.has(prevImage) ? fallbackGradient : `url(${prevImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transform: parallaxTransform,
                        transition: 'transform 0.4s ease-out',
                        animation: 'bgFadeOut 1.2s ease forwards',
                    }}
                />
            )}

            {/* ── Current image with parallax (or fallback gradient) ── */}
            <div
                className="absolute inset-[-40px] z-[1]"
                style={{
                    backgroundImage: imageFailed ? fallbackGradient : `url(${currentImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transform: parallaxTransform,
                    transition: 'transform 0.4s ease-out',
                    animation: transitioning ? 'bgFadeIn 1.2s ease forwards' : undefined,
                }}
            />

            {/* ── Scene tint overlay ── */}
            <div
                className="absolute inset-0 z-[2] transition-all duration-1000"
                style={{ backgroundColor: currentTint, opacity: tintOpacity }}
            />

            {/* ── Depth gradient (darken top/bottom edges) — stronger at night ── */}
            <div
                className="absolute inset-0 z-[2] pointer-events-none transition-opacity duration-1000"
                style={{
                    background: `
                        linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%),
                        radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.3) 100%)
                    `,
                    opacity: 'var(--variant-overlay-opacity, 0.3)' as unknown as number,
                }}
            />

            {/* ── Film grain ── */}
            <div
                className="absolute inset-0 z-[3] pointer-events-none opacity-[0.05]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                }}
            />

            {/* ── Vignette ── */}
            {vignetteEnabled && (
                <div
                    className="absolute inset-0 z-[4] pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
                    }}
                />
            )}

            {/* ── Readability overlay — adjustable dark overlay for hero timer contrast ── */}
            <div
                className="absolute inset-0 z-[4] pointer-events-none transition-opacity duration-1000"
                style={{
                    background: 'rgba(0,0,0,1)',
                    opacity: backgroundDarken,
                }}
            />

            {/* ── Content ── */}
            <div className="relative z-[5] w-full h-full">
                {children}
            </div>
        </div>
    );
}
