import { useLofiStore } from '../../store/useLofiStore';
import { ambienceSounds } from '../../data/ambienceSounds';
import {
    X, CloudRain, CloudLightning, Wind, Flame, Coffee,
    Waves, Radio, type LucideIcon,
} from 'lucide-react';

const AMBIENCE_ICONS: Record<string, LucideIcon> = {
    rain: CloudRain,
    thunder: CloudLightning,
    wind: Wind,
    fire: Flame,
    coffee_shop: Coffee,
    ocean: Waves,
    white_noise: Radio,
};

interface Props {
    onClose: () => void;
}

export function AmbienceMixer({ onClose }: Props) {
    const ambienceLayers = useLofiStore((s) => s.ambienceLayers);
    const toggleAmbienceLayer = useLofiStore((s) => s.toggleAmbienceLayer);
    const setAmbienceVolume = useLofiStore((s) => s.setAmbienceVolume);

    const activeLayers = ambienceLayers.filter((l) => l.active);

    return (
        <div
            className="w-[300px] rounded-2xl backdrop-blur-xl fade-in overflow-hidden"
            style={{
                background: 'var(--theme-panel-bg)',
                border: `1px solid var(--theme-panel-border)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                        Ambience
                    </h3>
                    <span
                        className="text-[11px] px-2 py-0.5 rounded-full mono"
                        style={{
                            background: activeLayers.length > 0
                                ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                                : 'rgba(255,255,255,0.05)',
                            color: activeLayers.length > 0
                                ? 'var(--theme-primary)'
                                : 'var(--theme-text-muted)',
                        }}
                    >
                        {activeLayers.length}/3
                    </span>
                </div>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={onClose}
                >
                    <X size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* Sound grid — 2 columns */}
            <div className="px-3 pb-4 grid grid-cols-2 gap-2">
                {ambienceSounds.map((sound) => {
                    const layer = ambienceLayers.find((l) => l.id === sound.id);
                    const isActive = layer?.active ?? false;
                    const SoundIcon = AMBIENCE_ICONS[sound.id] ?? Radio;

                    return (
                        <div key={sound.id} className="flex flex-col">
                            {/* Toggle button */}
                            <button
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer w-full text-left"
                                style={{
                                    background: isActive
                                        ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
                                        : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isActive ? 'var(--theme-primary)' : 'var(--theme-panel-border)'}`,
                                    boxShadow: isActive
                                        ? '0 0 12px var(--theme-primary-glow)'
                                        : 'none',
                                }}
                                onClick={() => toggleAmbienceLayer(sound.id)}
                            >
                                <SoundIcon
                                    size={18}
                                    style={{
                                        color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                        flexShrink: 0,
                                    }}
                                />
                                <span
                                    className="text-[13px] font-medium truncate"
                                    style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                                >
                                    {sound.name}
                                </span>
                            </button>

                            {/* Volume slider — only when active */}
                            {isActive && (
                                <div className="flex items-center gap-1.5 px-2 pt-1.5">
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={Math.round((layer?.volume ?? 0.5) * 100)}
                                        onChange={(e) => setAmbienceVolume(sound.id, +e.target.value / 100)}
                                        className="volume-slider flex-1"
                                    />
                                    <span className="mono text-[10px] w-6 text-right" style={{ color: 'var(--theme-text-muted)' }}>
                                        {Math.round((layer?.volume ?? 0.5) * 100)}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
