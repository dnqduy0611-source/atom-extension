import { useEffect, useRef, memo } from 'react';
import { useLofiStore } from '../../store/useLofiStore';

/**
 * Canvas-based overlay effects per scene.
 * Rain for city_night, fireflies for forest_cabin, etc.
 * Lightweight — uses requestAnimationFrame with frame limiting.
 */

interface Particle {
    x: number;
    y: number;
    speed: number;
    size: number;
    opacity: number;
    angle?: number;
    drift?: number;
}

type EffectType = 'rain' | 'snow' | 'fireflies' | 'stars' | 'petals' | 'embers';

const SCENE_EFFECTS: Record<string, EffectType> = {
    cozy_cafe: 'snow',
    japanese_garden: 'petals',
    city_night: 'rain',
    forest_cabin: 'fireflies',
    ocean_cliff: 'rain',
    space_station: 'stars',
};

function createParticles(type: EffectType, w: number, h: number): Particle[] {
    const count = type === 'stars' ? 80 : type === 'fireflies' ? 25 : type === 'petals' ? 20 : 60;
    return Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: type === 'stars' ? 0 : 0.5 + Math.random() * 2,
        size: type === 'rain' ? 1 : type === 'stars' ? Math.random() * 2 : 2 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.5,
    }));
}

function drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    type: EffectType,
    w: number,
    h: number,
    time: number
) {
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
        ctx.globalAlpha = p.opacity;

        switch (type) {
            case 'rain':
                ctx.strokeStyle = 'rgba(180, 210, 255, 0.4)';
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + 1, p.y + 12);
                ctx.stroke();
                p.y += p.speed * 4;
                p.x += 0.3;
                if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
                break;

            case 'snow':
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                p.y += p.speed * 0.5;
                p.x += Math.sin(time * 0.001 + (p.angle ?? 0)) * 0.3;
                if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
                break;

            case 'fireflies':
                const glow = 0.3 + Math.sin(time * 0.003 + (p.angle ?? 0) * 5) * 0.3;
                ctx.globalAlpha = glow;
                ctx.fillStyle = '#4ade80';
                ctx.shadowColor = '#4ade80';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                p.x += Math.sin(time * 0.001 + (p.angle ?? 0)) * 0.8;
                p.y += Math.cos(time * 0.0012 + (p.angle ?? 0)) * 0.6;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                break;

            case 'stars':
                const twinkle = 0.2 + Math.sin(time * 0.002 + (p.angle ?? 0) * 10) * 0.3;
                ctx.globalAlpha = twinkle;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'petals':
                ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(time * 0.001 + (p.angle ?? 0));
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                p.y += p.speed * 0.4;
                p.x += Math.sin(time * 0.001 + (p.angle ?? 0)) * 0.5 + (p.drift ?? 0);
                if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
                break;

            case 'embers':
                const emberGlow = 0.4 + Math.sin(time * 0.004 + (p.angle ?? 0)) * 0.3;
                ctx.globalAlpha = emberGlow;
                ctx.fillStyle = '#f97316';
                ctx.shadowColor = '#f97316';
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                p.y -= p.speed * 0.3;
                p.x += Math.sin(time * 0.002 + (p.angle ?? 0)) * 0.4;
                if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
                break;
        }
    }
    ctx.globalAlpha = 1;
}

export const OverlayEffects = memo(function OverlayEffects() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animRef = useRef<number>(0);
    const activeSceneId = useLofiStore((s) => s.activeSceneId);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            const effect = SCENE_EFFECTS[activeSceneId] ?? 'stars';
            particlesRef.current = createParticles(effect, canvas.width, canvas.height);
        };

        resize();
        window.addEventListener('resize', resize);

        let lastFrame = 0;
        const FPS = 30;
        const frameInterval = 1000 / FPS;

        const animate = (time: number) => {
            if (time - lastFrame >= frameInterval) {
                lastFrame = time;
                const effect = SCENE_EFFECTS[activeSceneId] ?? 'stars';
                drawParticles(ctx, particlesRef.current, effect, canvas.width, canvas.height, time);
            }
            animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [activeSceneId]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-[6] pointer-events-none"
            style={{ mixBlendMode: 'screen' }}
        />
    );
});
