import { useLofiStore } from '../../store/useLofiStore';
import { musicTracks } from '../../data/musicTracks';
import { formatTime } from '../../utils/formatTime';
import { useEffect, useState, useRef } from 'react';
import { useSceneIcons } from '../../hooks/useSceneIcons';

/**
 * PlayerBar — Slim 40px bar.
 * Glass-on-hover: transparent when idle, backdrop-blur on hover.
 * Full-width 2px progress line at top edge.
 */
export function PlayerBar() {
    const accentGlowEnabled = useLofiStore((s) => s.accentGlowEnabled);
    const {
        isPlaying,
        togglePlay,
        musicTrack,
        masterVolume,
        setMasterVolume,
        nextTrack,
        prevTrack,
    } = useLofiStore();
    const icons = useSceneIcons();
    const [hovered, setHovered] = useState(false);

    const track = musicTracks.find((t) => t.id === musicTrack?.id);

    // ── Elapsed time tracking ──
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setElapsed((prev) => {
                    const duration = track?.duration ?? 180;
                    return prev >= duration ? 0 : prev + 1;
                });
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isPlaying, track]);

    useEffect(() => {
        setElapsed(0);
    }, [musicTrack?.id]);

    const duration = track?.duration ?? 180;
    const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
    const VolumeIcon = masterVolume === 0 ? icons.ui.volumeMute : masterVolume < 0.5 ? icons.ui.volumeLow : icons.ui.volumeHigh;

    return (
        <div
            className="relative group"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* ── Full-width progress line (2px, top edge) ── */}
            <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                    className="h-full transition-[width] duration-1000 ease-linear"
                    style={{
                        width: `${progress}%`,
                        background: 'var(--theme-primary)',
                        boxShadow: accentGlowEnabled ? '0 0 8px var(--theme-primary-glow)' : 'none',
                    }}
                />
            </div>

            {/* ── Player content — 40px slim ── */}
            <div
                className="grid items-center transition-all duration-300"
                style={{
                    height: 56,
                    padding: '0 24px',
                    gridTemplateColumns: '1fr auto 1fr',
                    background: hovered
                        ? 'var(--theme-player-bg)'
                        : 'transparent',
                    backdropFilter: hovered ? 'blur(20px) saturate(1.3)' : 'none',
                    WebkitBackdropFilter: hovered ? 'blur(20px) saturate(1.3)' : 'none',
                    borderTop: hovered ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
                }}
            >
                {/* Left: Track info */}
                <div className="flex items-center gap-3 min-w-0">
                    {isPlaying && (
                        <div className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--theme-primary)' }} />
                    )}
                    <div className="truncate">
                        <span className="text-[14px] font-medium" style={{ color: 'var(--theme-text)' }}>
                            {track?.name ?? 'No Track'}
                        </span>
                        {track && (
                            <span className="text-[13px] ml-2" style={{ color: 'var(--theme-text-muted)' }}>
                                {track.artist}
                            </span>
                        )}
                    </div>
                </div>

                {/* Center: Controls — compact */}
                <div className="flex items-center gap-2">
                    <button
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={prevTrack}
                    >
                        <icons.ui.skipPrev size={16} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>

                    <button
                        className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 transition-all cursor-pointer"
                        style={{
                            background: isPlaying ? 'var(--theme-primary)' : 'rgba(255,255,255,0.12)',
                            boxShadow: isPlaying && accentGlowEnabled ? '0 0 14px var(--theme-primary-glow)' : 'none',
                        }}
                        onClick={togglePlay}
                    >
                        {isPlaying
                            ? <icons.ui.pause size={18} color="white" />
                            : <icons.ui.play size={18} color="white" style={{ marginLeft: 2 }} />
                        }
                    </button>

                    <button
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={nextTrack}
                    >
                        <icons.ui.skipNext size={16} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>
                </div>

                {/* Right: Time + Volume */}
                <div className="flex items-center justify-end gap-4">
                    <div className="flex items-center gap-1.5">
                        <span className="mono text-[12px]" style={{ color: 'var(--theme-primary)' }}>
                            {formatTime(elapsed)}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>/</span>
                        <span className="mono text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
                            {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <VolumeIcon size={16} style={{ color: 'var(--theme-text-muted)' }} />
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(masterVolume * 100)}
                            onChange={(e) => setMasterVolume(+e.target.value / 100)}
                            className="volume-slider w-24"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
