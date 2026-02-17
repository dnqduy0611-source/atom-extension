import { useState } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { musicTracks } from '../../data/musicTracks';
import { ambienceSounds } from '../../data/ambienceSounds';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';
import { Headphones } from 'lucide-react';
import type { FC } from 'react';
import type { IconProps } from '../../icons/types';

type Tab = 'music' | 'ambience' | 'brainwave';

interface Props {
    onClose: () => void;
}

export function SoundMixer({ onClose }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('music');
    const musicTrackState = useLofiStore((s) => s.musicTrack);
    const isPlaying = useLofiStore((s) => s.isPlaying);
    const setMusicTrack = useLofiStore((s) => s.setMusicTrack);
    const setMusicVolume = useLofiStore((s) => s.setMusicVolume);
    const togglePlay = useLofiStore((s) => s.togglePlay);
    const ambienceLayers = useLofiStore((s) => s.ambienceLayers);
    const toggleAmbienceLayer = useLofiStore((s) => s.toggleAmbienceLayer);
    const setAmbienceVolume = useLofiStore((s) => s.setAmbienceVolume);
    // activeAmbienceCount reserved for future badge display
    const binauralEnabled = useLofiStore((s) => s.binauralEnabled);
    const binauralVolume = useLofiStore((s) => s.binauralVolume);
    const binauralMode = useLofiStore((s) => s.binauralMode);
    const setBinauralEnabled = useLofiStore((s) => s.setBinauralEnabled);
    const setBinauralVolume = useLofiStore((s) => s.setBinauralVolume);
    const setBinauralMode = useLofiStore((s) => s.setBinauralMode);
    const icons = useSceneIcons();
    const { t } = useTranslation();

    // Resolve full track info from the tracks data
    const currentTrack = musicTrackState
        ? musicTracks.find((t) => t.id === musicTrackState.id) ?? null
        : null;
    const musicVolume = musicTrackState?.volume ?? 0.5;

    // Prev / Next track
    const currentIndex = currentTrack ? musicTracks.indexOf(currentTrack) : -1;
    const prevTrack = () => {
        const idx = currentIndex <= 0 ? musicTracks.length - 1 : currentIndex - 1;
        setMusicTrack(musicTracks[idx].id);
    };
    const nextTrack = () => {
        const idx = currentIndex >= musicTracks.length - 1 ? 0 : currentIndex + 1;
        setMusicTrack(musicTracks[idx].id);
    };

    const VolumeIcon = musicVolume === 0 ? icons.ui.volumeMute : musicVolume < 0.5 ? icons.ui.volumeLow : icons.ui.volumeHigh;

    return (
        <div
            className="w-[480px] h-full rounded-2xl backdrop-blur-xl fade-in overflow-hidden flex flex-col"
            style={{
                background: 'var(--theme-panel-bg)',
                border: `1px solid var(--theme-panel-border)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
        >
            {/* ═══ Header ═══ */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="w-7" />
                <div className="flex items-center gap-3">
                    <Headphones size={22} style={{ color: 'var(--theme-primary)' }} />
                    <h3 className="text-lg font-bold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                        {t('mixer.title')}
                    </h3>
                </div>
                <button
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={onClose}
                >
                    <icons.ui.close size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* ═══ Now Playing Card ═══ */}
            {currentTrack && (
                <div className="mx-5 mt-2 mb-4">
                    <div
                        className="rounded-xl p-5 relative overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, 
                                color-mix(in srgb, var(--theme-primary) 25%, rgba(0,0,0,0.4)),
                                color-mix(in srgb, var(--theme-secondary) 15%, rgba(0,0,0,0.6))
                            )`,
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        {/* Subtle glow behind */}
                        <div
                            className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30"
                            style={{ background: 'var(--theme-primary)' }}
                        />

                        {/* Track info */}
                        <div className="relative flex items-start gap-4 mb-5">
                            {/* Album art placeholder */}
                            <div
                                className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }}
                            >
                                <icons.ui.music size={26} style={{ color: 'var(--theme-primary)' }} />
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <div className="text-[18px] font-semibold text-white truncate">
                                    {currentTrack.name}
                                </div>
                                <div className="text-[13px] text-white/50 truncate mt-0.5">
                                    {currentTrack.artist} · {currentTrack.genre}
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="relative flex items-center justify-center gap-5">
                            <button
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all cursor-pointer"
                                onClick={prevTrack}
                            >
                                <icons.ui.skipPrev size={18} color="white" />
                            </button>

                            <button
                                className="w-13 h-13 flex items-center justify-center rounded-full transition-all cursor-pointer hover:scale-105"
                                style={{
                                    background: 'white',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                }}
                                onClick={togglePlay}
                            >
                                {isPlaying
                                    ? <icons.ui.pause size={20} color="#0a0a14" />
                                    : <icons.ui.play size={20} color="#0a0a14" style={{ marginLeft: 2 }} />
                                }
                            </button>

                            <button
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all cursor-pointer"
                                onClick={nextTrack}
                            >
                                <icons.ui.skipNext size={18} color="white" />
                            </button>
                        </div>

                        {/* Volume */}
                        <div className="relative flex items-center gap-3 mt-4">
                            <VolumeIcon size={16} color="rgba(255,255,255,0.5)" />
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={Math.round(musicVolume * 100)}
                                onChange={(e) => setMusicVolume(+e.target.value / 100)}
                                className="volume-slider flex-1"
                            />
                            <span className="mono text-[12px] text-white/40 w-7 text-right">
                                {Math.round(musicVolume * 100)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Tab Switcher ═══ */}
            <div className="flex mx-5 mb-3 rounded-xl p-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <button
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 cursor-pointer"
                    style={{
                        background: activeTab === 'music'
                            ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                            : 'transparent',
                        color: activeTab === 'music'
                            ? 'var(--theme-primary)'
                            : 'var(--theme-text-muted)',
                    }}
                    onClick={() => setActiveTab('music')}
                >
                    <icons.ui.music size={16} />
                    <span>{t('mixer.tracks')}</span>
                </button>
                <button
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 cursor-pointer"
                    style={{
                        background: activeTab === 'ambience'
                            ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                            : 'transparent',
                        color: activeTab === 'ambience'
                            ? 'var(--theme-primary)'
                            : 'var(--theme-text-muted)',
                    }}
                    onClick={() => setActiveTab('ambience')}
                >
                    <icons.ambience.rain size={16} />
                    <span>{t('mixer.ambience')}</span>
                </button>
                <button
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 cursor-pointer"
                    style={{
                        background: activeTab === 'brainwave'
                            ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                            : 'transparent',
                        color: activeTab === 'brainwave'
                            ? 'var(--theme-primary)'
                            : 'var(--theme-text-muted)',
                    }}
                    onClick={() => setActiveTab('brainwave')}
                >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
                    </svg>
                    <span>{t('mixer.brainwave')}</span>
                    {binauralEnabled && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--theme-primary)' }} />
                    )}
                </button>
            </div>

            {/* ═══ Tab Content ═══ */}
            <div className="flex-1 overflow-y-auto px-4 pb-5 custom-scrollbar">
                {activeTab === 'music' && (
                    <div className="space-y-3">
                        {musicTracks.map((track) => {
                            const isActive = musicTrackState?.id === track.id;
                            const GenreIcon = (icons.genre as Record<string, FC<IconProps>>)[track.genre] ?? icons.ui.music;

                            return (
                                <button
                                    key={track.id}
                                    onClick={() => setMusicTrack(track.id)}
                                    className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer group"
                                    style={{
                                        background: isActive
                                            ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)'
                                            : 'transparent',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                        style={{
                                            background: isActive
                                                ? 'color-mix(in srgb, var(--theme-primary) 18%, transparent)'
                                                : 'rgba(255,255,255,0.05)',
                                        }}
                                    >
                                        <GenreIcon
                                            size={18}
                                            style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-[15px] font-medium truncate"
                                            style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text)' }}
                                        >
                                            {track.name}
                                        </div>
                                        <div className="text-[12px] truncate mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                                            {track.artist}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="flex gap-0.5 shrink-0">
                                            {[1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className="w-0.5 rounded-full animate-pulse"
                                                    style={{
                                                        background: 'var(--theme-primary)',
                                                        height: `${8 + i * 3}px`,
                                                        animationDelay: `${i * 150}ms`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'ambience' && (
                    <div className="space-y-3">
                        {ambienceSounds.map((sound) => {
                            const layer = ambienceLayers.find((l) => l.id === sound.id);
                            const isActive = layer?.active ?? false;
                            const SoundIcon = (icons.ambience as Record<string, FC<IconProps>>)[sound.id] ?? icons.ui.music;

                            return (
                                <div key={sound.id}>
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer"
                                        style={{
                                            background: isActive
                                                ? 'color-mix(in srgb, var(--theme-primary) 10%, transparent)'
                                                : 'transparent',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        }}
                                        onClick={() => toggleAmbienceLayer(sound.id)}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                            style={{
                                                background: isActive
                                                    ? 'color-mix(in srgb, var(--theme-primary) 18%, transparent)'
                                                    : 'rgba(255,255,255,0.05)',
                                            }}
                                        >
                                            <SoundIcon
                                                size={20}
                                                style={{
                                                    color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                                }}
                                            />
                                        </div>
                                        <span
                                            className="flex-1 text-[15px] font-medium"
                                            style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text)' }}
                                        >
                                            {sound.name}
                                        </span>
                                        {isActive && (
                                            <div className="flex items-center gap-2 shrink-0" style={{ width: '120px' }}>
                                                <input
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    value={Math.round((layer?.volume ?? 0.5) * 100)}
                                                    onChange={(e) => setAmbienceVolume(sound.id, +e.target.value / 100)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="volume-slider flex-1"
                                                />
                                                <span className="mono text-[11px] w-6 text-right" style={{ color: 'var(--theme-text-muted)' }}>
                                                    {Math.round((layer?.volume ?? 0.5) * 100)}
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'brainwave' && (
                    <div className="space-y-4 px-1">

                        {/* ── Hero Card: Toggle + Description ── */}
                        <div
                            className="rounded-xl p-4 relative overflow-hidden"
                            style={{
                                background: binauralEnabled
                                    ? `linear-gradient(135deg,
                                        color-mix(in srgb, var(--theme-primary) 18%, rgba(0,0,0,0.3)),
                                        color-mix(in srgb, var(--theme-secondary) 10%, rgba(0,0,0,0.4)))`
                                    : 'rgba(255,255,255,0.04)',
                                border: binauralEnabled
                                    ? '1px solid color-mix(in srgb, var(--theme-primary) 25%, transparent)'
                                    : '1px solid rgba(255,255,255,0.06)',
                                transition: 'all 0.3s ease',
                            }}
                        >
                            {/* Glow when active */}
                            {binauralEnabled && (
                                <div
                                    className="absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-20"
                                    style={{ background: 'var(--theme-primary)' }}
                                />
                            )}

                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{
                                            background: binauralEnabled
                                                ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)'
                                                : 'rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <Headphones size={20} style={{
                                            color: binauralEnabled ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                                        }} />
                                    </div>
                                    <div>
                                        <div className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>
                                            {t('mixer.binauralBeats')}
                                        </div>
                                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                                            {t('mixer.headphonesRecommended')}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="relative w-[44px] h-[24px] rounded-full transition-colors duration-200 cursor-pointer border-none p-0 shrink-0"
                                    style={{
                                        background: binauralEnabled ? 'var(--theme-primary)' : 'rgba(255,255,255,0.12)',
                                    }}
                                    onClick={() => setBinauralEnabled(!binauralEnabled)}
                                >
                                    <div
                                        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all duration-200"
                                        style={{
                                            left: binauralEnabled ? '23px' : '3px',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                        }}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* ── Mode Selector ── */}
                        <div
                            className="space-y-3 transition-opacity duration-300"
                            style={{ opacity: binauralEnabled ? 1 : 0.4, pointerEvents: binauralEnabled ? 'auto' : 'none' }}
                        >
                            <div className="grid grid-cols-3 gap-2.5">
                                {([
                                    {
                                        id: 'focus', labelKey: 'brainwave.focus', descKey: 'brainwave.concentration',
                                        icon: 'M12 2L15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5z',
                                    },
                                    {
                                        id: 'relax', labelKey: 'brainwave.relax', descKey: 'brainwave.calmUnwind',
                                        icon: 'M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0',
                                    },
                                    {
                                        id: 'deep', labelKey: 'brainwave.deepRest', descKey: 'brainwave.meditation',
                                        icon: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
                                    },
                                ] as const).map((m) => {
                                    const isActive = binauralMode === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all duration-200 cursor-pointer"
                                            style={{
                                                background: isActive
                                                    ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                                                    : 'rgba(255,255,255,0.03)',
                                                border: isActive
                                                    ? '1px solid color-mix(in srgb, var(--theme-primary) 35%, transparent)'
                                                    : '1px solid rgba(255,255,255,0.06)',
                                            }}
                                            onClick={() => setBinauralMode(m.id)}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center"
                                                style={{
                                                    background: isActive
                                                        ? 'color-mix(in srgb, var(--theme-primary) 20%, transparent)'
                                                        : 'rgba(255,255,255,0.05)',
                                                }}
                                            >
                                                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                                                    style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                                                >
                                                    <path d={m.icon} />
                                                </svg>
                                            </div>
                                            <span className="text-[13px] font-medium" style={{
                                                color: isActive ? 'var(--theme-primary)' : 'var(--theme-text)',
                                            }}>
                                                {t(m.labelKey as any)}
                                            </span>
                                            <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                                                {t(m.descKey as any)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* ── Intensity Slider ── */}
                            <div
                                className="rounded-xl p-4"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[13px] font-medium" style={{ color: 'var(--theme-text)' }}>
                                        {t('mixer.intensity')}
                                    </span>
                                    <span
                                        className="text-[12px] mono px-2 py-0.5 rounded-md"
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            color: 'var(--theme-text-muted)',
                                        }}
                                    >
                                        {Math.round(binauralVolume * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={40}
                                    value={Math.round(binauralVolume * 100)}
                                    onChange={(e) => setBinauralVolume(+e.target.value / 100)}
                                    className="volume-slider w-full"
                                />
                                <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}>
                                    <span>{t('mixer.subtle')}</span>
                                    <span>{t('mixer.strong')}</span>
                                </div>
                            </div>

                            {/* ── Auto-switch Note ── */}
                            <div
                                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-[11px]"
                                style={{ color: 'var(--theme-text-muted)', opacity: 0.7 }}
                            >
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                    <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10z" />
                                    <path d="M12 8v4l3 3" />
                                </svg>
                                <span>
                                    {t('mixer.syncNote')}
                                </span>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
