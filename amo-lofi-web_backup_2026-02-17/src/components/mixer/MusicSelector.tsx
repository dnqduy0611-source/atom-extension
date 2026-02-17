import { useLofiStore } from '../../store/useLofiStore';
import { musicTracks } from '../../data/musicTracks';
import {
    X, Piano, Guitar, Music2, Sparkles, Volume2,
    type LucideIcon,
} from 'lucide-react';

const GENRE_ICON: Record<string, LucideIcon> = {
    lofi: Piano,
    synthwave: Guitar,
    classical: Music2,
    ambient: Sparkles,
};

interface Props {
    onClose: () => void;
}

export function MusicSelector({ onClose }: Props) {
    const musicTrack = useLofiStore((s) => s.musicTrack);
    const setMusicTrack = useLofiStore((s) => s.setMusicTrack);
    const setMusicVolume = useLofiStore((s) => s.setMusicVolume);

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
                <h3 className="text-base font-semibold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                    Music
                </h3>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={onClose}
                >
                    <X size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* Track list */}
            <div className="px-3 pb-3 space-y-0.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                {musicTracks.map((track) => {
                    const isActive = musicTrack?.id === track.id;
                    const GenreIcon = GENRE_ICON[track.genre] ?? Music2;

                    return (
                        <button
                            key={track.id}
                            onClick={() => setMusicTrack(track.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer group"
                            style={{
                                background: isActive
                                    ? 'color-mix(in srgb, var(--theme-primary) 12%, transparent)'
                                    : 'transparent',
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                        >
                            {/* Genre icon */}
                            <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all"
                                style={{
                                    background: isActive
                                        ? 'color-mix(in srgb, var(--theme-primary) 18%, transparent)'
                                        : 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${isActive ? 'var(--theme-primary)' : 'transparent'}`,
                                }}
                            >
                                <GenreIcon
                                    size={16}
                                    style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                                />
                            </div>

                            {/* Track info */}
                            <div className="flex-1 min-w-0">
                                <div
                                    className="text-[13px] font-medium truncate"
                                    style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text)' }}
                                >
                                    {track.name}
                                </div>
                                <div className="text-[11px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                                    {track.artist} · {track.genre}
                                </div>
                            </div>

                            {/* Active pulse */}
                            {isActive && (
                                <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse"
                                    style={{
                                        background: 'var(--theme-primary)',
                                        boxShadow: '0 0 8px var(--theme-primary-glow)',
                                    }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Volume control */}
            {musicTrack && (
                <div
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderTop: `1px solid var(--theme-panel-border)` }}
                >
                    <Volume2 size={15} style={{ color: 'var(--theme-text-muted)' }} />
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((musicTrack.volume ?? 0.5) * 100)}
                        onChange={(e) => setMusicVolume(+e.target.value / 100)}
                        className="volume-slider flex-1"
                    />
                    <span className="mono text-[11px] w-8 text-right" style={{ color: 'var(--theme-text-muted)' }}>
                        {Math.round((musicTrack.volume ?? 0.5) * 100)}
                    </span>
                </div>
            )}
        </div>
    );
}
