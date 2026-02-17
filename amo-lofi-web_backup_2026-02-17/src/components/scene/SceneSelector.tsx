import { useState, useRef } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { scenes } from '../../data/scenes';
import type { Scene } from '../../data/scenes';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useCustomWallpapers } from '../../hooks/useCustomWallpapers';
import { useCustomScenes } from '../../hooks/useCustomScenes';
import { useProGate } from '../../hooks/useProGate';
import { useTranslation } from '../../hooks/useTranslation';
import { SceneCreator } from './SceneCreator';

/**
 * SceneSelector — Beeziee-inspired vertical gallery.
 * Tall cards with centered names, rich gradient overlays.
 * Supports: custom wallpapers (Pro), custom AI scenes (Pro).
 */

interface Props {
    onClose: () => void;
}

export function SceneSelector({ onClose }: Props) {
    const activeSceneId = useLofiStore((s) => s.activeSceneId);
    const activeVariant = useLofiStore((s) => s.activeVariant);
    const activeWallpaperId = useLofiStore((s) => s.activeWallpaperId);
    const setScene = useLofiStore((s) => s.setScene);
    const setWallpaper = useLofiStore((s) => s.setWallpaper);
    const hiddenSceneIds = useLofiStore((s) => s.hiddenSceneIds);
    const hideScene = useLofiStore((s) => s.hideScene);
    const unhideScene = useLofiStore((s) => s.unhideScene);
    const icons = useSceneIcons();
    const { isPro, showUpsell } = useProGate();
    const { t } = useTranslation();
    const [showHidden, setShowHidden] = useState(false);

    // Custom data
    const { wallpapers: customWallpapers, addWallpaper, removeWallpaper, isFull } = useCustomWallpapers(activeSceneId);
    const { customScenes, addCustomScene, removeCustomScene } = useCustomScenes();
    const [showCreator, setShowCreator] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Merge built-in + custom scenes
    const allScenes: (Scene & { isCustom?: boolean })[] = [
        ...scenes,
        ...customScenes.map((s) => ({ ...s, isCustom: true })),
    ];

    // Filter out hidden scenes (unless showHidden is on)
    const visibleScenes = allScenes.filter(
        (s) => !hiddenSceneIds.includes(s.id)
    );
    const hiddenScenes = allScenes.filter(
        (s) => hiddenSceneIds.includes(s.id)
    );

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null);
        try {
            await addWallpaper(file);
        } catch (err) {
            setUploadError((err as Error).message);
            setTimeout(() => setUploadError(null), 3000);
        }
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (showCreator) {
        return (
            <SceneCreator
                onSave={addCustomScene}
                onClose={() => setShowCreator(false)}
            />
        );
    }

    return (
        <div
            className="ss-panel fade-in"
            style={{
                background: 'var(--theme-panel-bg)',
                border: `1px solid var(--theme-panel-border)`,
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
        >
            {/* Header */}
            <div className="ss-header">
                <div className="ss-close" style={{ visibility: 'hidden' }} />
                <div className="ss-header-center">
                    <h3 className="ss-title" style={{ color: 'var(--theme-text)' }}>
                        {t('scene.scenes')}
                    </h3>
                    <span className="ss-count" style={{ color: 'var(--theme-text-muted)' }}>
                        {visibleScenes.length}
                    </span>
                </div>
                <button
                    className="ss-close"
                    onClick={onClose}
                >
                    <icons.ui.close size={12} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* Upload error toast */}
            {
                uploadError && (
                    <div className="mx-4 mb-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        {uploadError}
                    </div>
                )
            }

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
            />

            <div className="ss-gallery custom-scrollbar">
                {visibleScenes.map((scene) => {
                    const isActive = scene.id === activeSceneId;
                    const bgImage = activeVariant === 'day' ? scene.background.day : scene.background.night;
                    const sceneAccent = scene.theme[activeVariant].primary;
                    const isCustom = 'isCustom' in scene && scene.isCustom;

                    return (
                        <div key={scene.id}>
                            <button
                                onClick={() => setScene(scene.id)}
                                className="ss-card group"
                                style={{
                                    '--card-accent': sceneAccent,
                                    height: isActive ? '160px' : '130px',
                                    borderColor: isActive ? sceneAccent : 'rgba(255,255,255,0.06)',
                                    boxShadow: isActive
                                        ? `0 4px 24px color-mix(in srgb, ${sceneAccent} 25%, transparent)`
                                        : '0 2px 8px rgba(0,0,0,0.15)',
                                } as React.CSSProperties}
                            >
                                {/* Background image */}
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                                    style={{ backgroundImage: `url(${bgImage})` }}
                                />

                                {/* Gradient overlay — stronger at center-bottom for text */}
                                <div
                                    className="absolute inset-0"
                                    style={{
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.05) 100%)',
                                    }}
                                />

                                {/* Scene name — centered */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="ss-card-name">
                                        {isCustom && <span className="mr-1">✨</span>}
                                        {scene.name}
                                    </span>
                                </div>

                                {/* Badges — top right */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                    {/* Hide scene button */}
                                    {!isCustom && (
                                        <button
                                            className="w-6 h-6 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                hideScene(scene.id);
                                            }}
                                            title={t('scene.hideScene')}
                                        >
                                            <icons.ui.close size={10} color="white" />
                                        </button>
                                    )}

                                    {/* Delete custom scene */}
                                    {isCustom && (
                                        <button
                                            className="w-6 h-6 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeCustomScene(scene.id);
                                            }}
                                            title={t('scene.deleteScene')}
                                        >
                                            <icons.ui.trash size={10} color="white" />
                                        </button>
                                    )}

                                    {/* Active check */}
                                    {isActive && (
                                        <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm"
                                            style={{
                                                background: sceneAccent,
                                                boxShadow: `0 0 12px ${sceneAccent}`,
                                            }}
                                        >
                                            <icons.ui.check size={13} color="white" />
                                        </div>
                                    )}
                                </div>

                                {/* Hover border glow */}
                                <div
                                    className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                    style={{
                                        boxShadow: `inset 0 0 40px color-mix(in srgb, ${sceneAccent} 15%, transparent)`,
                                    }}
                                />
                            </button>

                            {/* ── Wallpaper thumbnail strip (built-in + custom) ── */}
                            {isActive && (
                                <div
                                    className="flex gap-1.5 px-2 py-2 overflow-x-auto custom-scrollbar rounded-xl mt-1.5"
                                    style={{ background: 'rgba(0,0,0,0.25)' }}
                                >
                                    {/* Built-in wallpapers */}
                                    {scene.wallpapers.map((wp) => {
                                        const isSelected = activeWallpaperId === wp.id
                                            || (!activeWallpaperId && wp.id === scene.wallpapers[0]?.id);
                                        return (
                                            <button
                                                key={wp.id}
                                                onClick={() => setWallpaper(wp.id)}
                                                className="shrink-0 w-16 h-10 rounded-lg overflow-hidden bg-cover bg-center transition-all duration-200 cursor-pointer hover:opacity-100"
                                                style={{
                                                    backgroundImage: `url(${wp.thumbnail})`,
                                                    border: isSelected
                                                        ? `2px solid ${sceneAccent}`
                                                        : '2px solid rgba(255,255,255,0.1)',
                                                    opacity: isSelected ? 1 : 0.55,
                                                    boxShadow: isSelected
                                                        ? `0 0 8px color-mix(in srgb, ${sceneAccent} 40%, transparent)`
                                                        : 'none',
                                                }}
                                                title={wp.name}
                                            />
                                        );
                                    })}

                                    {/* Custom wallpapers */}
                                    {customWallpapers.map((cw) => {
                                        const isSelected = activeWallpaperId === cw.id;
                                        return (
                                            <div key={cw.id} className="shrink-0 relative group/cw">
                                                <button
                                                    onClick={() => setWallpaper(cw.id)}
                                                    className="w-16 h-10 rounded-lg overflow-hidden bg-cover bg-center transition-all duration-200 cursor-pointer hover:opacity-100"
                                                    style={{
                                                        backgroundImage: `url(${cw.blobUrl})`,
                                                        border: isSelected
                                                            ? `2px solid ${sceneAccent}`
                                                            : '2px solid rgba(255,255,255,0.1)',
                                                        opacity: isSelected ? 1 : 0.55,
                                                        boxShadow: isSelected
                                                            ? `0 0 8px color-mix(in srgb, ${sceneAccent} 40%, transparent)`
                                                            : 'none',
                                                    }}
                                                    title={cw.name}
                                                />
                                                {/* Delete button */}
                                                <button
                                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover/cw:opacity-100 transition-opacity hover:bg-red-500 cursor-pointer z-10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeWallpaper(cw.id);
                                                        if (activeWallpaperId === cw.id) setWallpaper(null);
                                                    }}
                                                >
                                                    <icons.ui.close size={8} color="white" />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Upload button (Pro-gated) */}
                                    <button
                                        className="shrink-0 w-16 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer group/add"
                                        style={{
                                            border: !isPro
                                                ? '2px solid rgba(245,158,11,0.25)'
                                                : '2px dashed rgba(255,255,255,0.2)',
                                            background: !isPro
                                                ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(236,72,153,0.08))'
                                                : 'rgba(255,255,255,0.03)',
                                            opacity: isFull && isPro ? 0.3 : 1,
                                        }}
                                        onClick={() => {
                                            if (!isPro) {
                                                showUpsell('custom_wallpaper');
                                                return;
                                            }
                                            if (isFull) return;
                                            fileInputRef.current?.click();
                                        }}
                                        title={!isPro ? t('scene.proFeature') : isFull ? t('scene.maxWallpapers') : t('scene.addWallpaper')}
                                    >
                                        <span className="text-xs transition-transform group-hover/add:scale-110" style={{ color: !isPro ? '#f59e0b' : 'var(--theme-text-muted)' }}>
                                            {!isPro ? '👑' : '+'}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer: Create Scene + Hidden Scenes (always visible) ── */}
            <div className="ss-footer">
                {/* ── Create Scene button (Pro-gated) ── */}
                {isPro ? (
                    <button
                        className="w-full py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.01]"
                        style={{
                            background: `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))`,
                            color: 'white',
                            boxShadow: `0 0 20px var(--theme-primary-glow)`,
                        }}
                        onClick={() => setShowCreator(true)}
                    >
                        <span>✨</span>
                        <span>{t('scene.createScene')}</span>
                    </button>
                ) : (
                    <button
                        className="group/create w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                        style={{ padding: '1px', background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)' }}
                        onClick={() => showUpsell('create_scene')}
                    >
                        <div
                            className="flex items-center justify-center gap-2 py-3.5 rounded-[11px] transition-all duration-300 group-hover/create:bg-black/60"
                            style={{ background: 'rgba(0,0,0,0.75)' }}
                        >
                            <span className="text-sm transition-transform duration-300 group-hover/create:scale-110">👑</span>
                            <span className="text-xs font-semibold bg-gradient-to-r from-amber-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                                {t('scene.createScene')}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">PRO</span>
                        </div>
                    </button>
                )}

                {/* ── Hidden scenes section ── */}
                {hiddenScenes.length > 0 && (
                    <div className="mt-1">
                        <button
                            className="w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-between transition-all duration-200 cursor-pointer"
                            style={{
                                background: 'rgba(255,255,255,0.04)',
                                color: 'var(--theme-text-muted)',
                            }}
                            onClick={() => setShowHidden(!showHidden)}
                        >
                            <span>{hiddenScenes.length > 1 ? t('scene.hiddenScenesPlural', hiddenScenes.length) : t('scene.hiddenScenes', hiddenScenes.length)}</span>
                            <span style={{ transform: showHidden ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                        </button>

                        {showHidden && (
                            <div className="flex flex-col gap-2 mt-2">
                                {hiddenScenes.map((scene) => {
                                    const bgImage = activeVariant === 'day' ? scene.background.day : scene.background.night;
                                    return (
                                        <div
                                            key={scene.id}
                                            className="flex items-center gap-2.5 p-2 rounded-xl transition-all duration-200"
                                            style={{ background: 'rgba(255,255,255,0.04)' }}
                                        >
                                            <div
                                                className="w-12 h-8 rounded-lg bg-cover bg-center shrink-0"
                                                style={{
                                                    backgroundImage: `url(${bgImage})`,
                                                    opacity: 0.6,
                                                }}
                                            />
                                            <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--theme-text-muted)' }}>
                                                {scene.name}
                                            </span>
                                            <button
                                                className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer hover:bg-white/10"
                                                style={{
                                                    color: 'var(--theme-primary)',
                                                    background: 'rgba(255,255,255,0.06)',
                                                }}
                                                onClick={() => unhideScene(scene.id)}
                                            >
                                                {t('scene.show')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                .ss-panel {
                    width: 380px;
                    border-radius: 16px;
                    backdrop-filter: blur(24px) saturate(1.4);
                    overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                }
                .ss-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 16px 12px;
                }
                .ss-header-center {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ss-title {
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                    margin: 0;
                }
                .ss-count {
                    font-size: 11px;
                    font-weight: 500;
                    padding: 1px 7px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.06);
                }
                .ss-close {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .ss-close:hover { background: rgba(255,255,255,0.08); }

                .ss-gallery {
                    padding: 0 12px 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-height: 420px;
                    overflow-y: auto;
                }
                .ss-footer {
                    padding: 10px 12px 12px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .ss-card {
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                    display: block;
                    border: 2px solid;
                    background: #111;
                }
                .ss-card:hover {
                    transform: scale(1.01);
                }

                .ss-card-name {
                    font-size: 16px;
                    font-weight: 600;
                    color: white;
                    letter-spacing: 0.5px;
                    text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5);
                    text-align: center;
                    padding: 0 20px;
                }
            `}</style>
        </div >
    );
}
