import { useState, useRef } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import { scenes } from '../../data/scenes';
import type { Scene } from '../../data/scenes';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useCustomWallpapers } from '../../hooks/useCustomWallpapers';
import { useCustomScenes } from '../../hooks/useCustomScenes';
import { useProGate } from '../../hooks/useProGate';
import { useTranslation } from '../../hooks/useTranslation';
import { useBackgrounds } from '../../hooks/useBackgrounds';
import { useCredits } from '../../hooks/useCredits';
import { useAuth } from '../../hooks/useAuth';

// ── Sample AI Scenes (locked previews to showcase AI capability) ──
const SAMPLE_AI_SCENES = [
    {
        id: '_sample_city_day',
        name: 'City Day',
        description: 'A vibrant city skyline in daylight',
        thumbnail: '/scenes/city_night.jpg',
    },
    {
        id: '_sample_green_forest',
        name: 'Green Forest',
        description: 'A peaceful forest bathed in sunlight',
        thumbnail: '/scenes/forest_day.jpg',
    },
];
import { SceneCreator } from './SceneCreator';
import { AIBackgroundGenerator } from './AIBackgroundGenerator';

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
    const { wallpapers: customWallpapers, removeWallpaper } = useCustomWallpapers(activeSceneId);
    const { customScenes, addCustomScene, removeCustomScene } = useCustomScenes();
    const { backgrounds: cloudBgs, upload: uploadCloudBg, remove: removeCloudBg, isFull: bgFull, refresh: refreshBgs } = useBackgrounds();
    console.log('[SceneSelector] cloudBgs count:', cloudBgs.length);
    const { dailyFreeRemaining, refresh: refreshCredits } = useCredits();
    const { user, signIn } = useAuth();
    const [showCreator, setShowCreator] = useState(false);
    const [showAIBgGen, setShowAIBgGen] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const cloudFileRef = useRef<HTMLInputElement>(null);

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



    // Cloud background upload (Pro, costs 1 credit)
    const handleCloudUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null);
        setIsUploading(true);
        try {
            await uploadCloudBg(file, undefined, activeSceneId);
            await refreshCredits();
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code === 'NOT_PRO') {
                showUpsell('cloud_background');
            } else {
                setUploadError((err as Error).message);
                setTimeout(() => setUploadError(null), 4000);
            }
        } finally {
            setIsUploading(false);
            if (cloudFileRef.current) cloudFileRef.current.value = '';
        }
    };

    if (showCreator) {
        return (
            <SceneCreator
                onSave={addCustomScene}
                onClose={() => setShowCreator(false)}
            />
        );
    }

    if (showAIBgGen) {
        const activeScene = allScenes.find((s) => s.id === activeSceneId);
        return (
            <AIBackgroundGenerator
                sceneName={activeScene?.name || ''}
                sceneDescription={''}

                sceneId={activeSceneId}
                onClose={() => { setShowAIBgGen(false); refreshBgs(); }}
                onGenerated={async () => {
                    await refreshCredits();
                    await refreshBgs();
                }}
            />
        );
    }

    return (
        <div
            className="ss-panel glass-card glass-card-glow fade-in flex flex-col"
            style={{
                borderRadius: '16px',
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


            <input
                ref={cloudFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCloudUpload}
                className="hidden"
            />

            {/* ── Sample AI Scenes (locked previews for discovery) ── */}
            {!isPro && (
                <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {SAMPLE_AI_SCENES.map((sample) => (
                        <button
                            key={sample.id}
                            className="ss-card group"
                            style={{
                                height: '90px',
                                borderColor: 'rgba(139,92,246,0.25)',
                            } as React.CSSProperties}
                            onClick={() => {
                                if (!user) { signIn(); return; }
                                setShowCreator(true);
                            }}
                        >
                            {/* Blurred background */}
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${sample.thumbnail})`,
                                    filter: 'blur(2px) brightness(0.5)',
                                    transform: 'scale(1.05)',
                                }}
                            />
                            {/* Gradient overlay */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.15))',
                                }}
                            />
                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <span className="ss-card-name" style={{ fontSize: '14px' }}>
                                    ✨ {sample.name}
                                </span>
                                <span style={{
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontWeight: 500,
                                    letterSpacing: '0.5px',
                                }}>
                                    AI Generated • Bấm để tạo
                                </span>
                            </div>
                            {/* AI badge */}
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(236,72,153,0.4))',
                                    color: 'rgba(255,255,255,0.9)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                }}
                            >
                                ✦ AI
                            </div>
                        </button>
                    ))}
                </div>
            )}

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
                            {isActive && (<>
                                <div
                                    className="flex gap-1.5 px-2 py-2 overflow-x-auto custom-scrollbar rounded-xl mt-[40px] mb-[50px]"
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

                                    {/* Cloud backgrounds for this scene */}
                                    {cloudBgs.filter(bg => bg.signedUrl && (bg.scene_ids.length === 0 || bg.scene_ids.includes(scene.id))).map((bg) => {
                                        const cloudWpId = `cloud_url:${bg.signedUrl}`;
                                        const isSelected = activeWallpaperId === cloudWpId;
                                        return (
                                            <div key={`cloud_${bg.id}`} className="shrink-0 relative group/cb">
                                                <button
                                                    onClick={() => setWallpaper(cloudWpId)}
                                                    className="w-16 h-10 rounded-lg overflow-hidden bg-cover bg-center transition-all duration-200 cursor-pointer hover:opacity-100"
                                                    style={{
                                                        backgroundImage: `url(${bg.signedUrl})`,
                                                        backgroundColor: 'rgba(139,92,246,0.4)',
                                                        border: isSelected
                                                            ? `2px solid ${sceneAccent}`
                                                            : '2px solid rgba(255,255,255,0.3)',
                                                        opacity: isSelected ? 1 : 0.7,
                                                        boxShadow: isSelected
                                                            ? `0 0 8px color-mix(in srgb, ${sceneAccent} 40%, transparent)`
                                                            : 'none',
                                                    }}
                                                    title={bg.name || 'Cloud background'}
                                                />
                                                {/* Cloud badge */}
                                                <span className="absolute bottom-0.5 right-0.5 text-[8px] opacity-60">☁️</span>
                                                {/* Delete */}
                                                <button
                                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover/cb:opacity-100 transition-opacity hover:bg-red-500 cursor-pointer z-10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeCloudBg(bg.id);
                                                        if (activeWallpaperId === cloudWpId) setWallpaper(null);
                                                    }}
                                                >
                                                    <icons.ui.close size={8} color="white" />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Add background button */}
                                    <button
                                        className="shrink-0 w-16 h-10 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer group/add"
                                        style={{
                                            border: '2px dashed rgba(255,255,255,0.2)',
                                            background: 'rgba(255,255,255,0.03)',
                                        }}
                                        onClick={() => {
                                            if (!user) { signIn(); return; }
                                            setShowAddMenu((v) => !v);
                                        }}
                                        title={t('scene.addWallpaper')}
                                    >
                                        {isUploading ? (
                                            <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <span className="text-xs transition-transform group-hover/add:scale-110" style={{ color: 'var(--theme-text-muted)' }}>
                                                +
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Add menu — cinematic style */}
                                {showAddMenu && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '6px',
                                        marginTop: '6px',
                                    }}>
                                        <button
                                            className="transition-all duration-200 cursor-pointer"
                                            style={{
                                                flex: 1,
                                                padding: '8px 6px',
                                                borderRadius: '8px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                color: 'rgba(255,255,255,0.7)',
                                                fontSize: '10px',
                                                fontWeight: 500,
                                                letterSpacing: '0.3px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                            }}
                                            onClick={() => { setShowAddMenu(false); setShowAIBgGen(true); }}
                                        >
                                            <span style={{ fontSize: '11px', opacity: 0.7 }}>✦</span>
                                            <span>AI Generate</span>
                                            <span style={{ opacity: 0.3, fontSize: '9px' }}>10 cr</span>
                                        </button>
                                        <button
                                            className="transition-all duration-200 cursor-pointer"
                                            style={{
                                                flex: 1,
                                                padding: '8px 6px',
                                                borderRadius: '8px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                color: 'rgba(255,255,255,0.7)',
                                                fontSize: '10px',
                                                fontWeight: 500,
                                                letterSpacing: '0.3px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px',
                                                opacity: bgFull ? 0.3 : 1,
                                            }}
                                            onClick={() => {
                                                setShowAddMenu(false);
                                                if (bgFull) return;
                                                cloudFileRef.current?.click();
                                            }}
                                        >
                                            <span style={{ fontSize: '11px', opacity: 0.7 }}>↑</span>
                                            <span>Upload</span>
                                            <span style={{ opacity: 0.3, fontSize: '9px' }}>1 cr</span>
                                        </button>
                                    </div>
                                )}
                            </>)}
                        </div>
                    );
                })}
            </div>

            {/* ── Footer: Create Scene + Hidden Scenes (always visible) ── */}
            <div className="ss-footer">
                {/* ── Create Scene button — smart CTA based on user state ── */}
                {isPro ? (
                    <button
                        className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.01]"
                        style={{
                            background: `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))`,
                            color: 'white',
                            boxShadow: `0 0 20px var(--theme-primary-glow)`,
                        }}
                        onClick={() => setShowCreator(true)}
                    >
                        <span style={{ fontSize: '16px' }}>✨</span>
                        <span>{t('scene.createScene')}</span>
                    </button>
                ) : !user ? (
                    /* Not logged in — invite to login */
                    <button
                        className="group/create w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                        style={{ padding: '2px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899, #f59e0b)' }}
                        onClick={() => signIn()}
                    >
                        <div
                            className="flex items-center justify-center gap-2.5 py-4 rounded-[10px] transition-all duration-300 group-hover/create:bg-black/60"
                            style={{ background: 'rgba(0,0,0,0.75)' }}
                        >
                            <span className="text-base transition-transform duration-300 group-hover/create:scale-110">✨</span>
                            <span className="text-sm font-semibold bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                                Đăng nhập để tạo cảnh AI
                            </span>
                        </div>
                    </button>
                ) : dailyFreeRemaining > 0 ? (
                    /* Logged in + daily free available — highlight free */
                    <button
                        className="group/create w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.01] animate-pulse-subtle"
                        style={{ padding: '2px', background: 'linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6)' }}
                        onClick={() => setShowCreator(true)}
                    >
                        <div
                            className="flex items-center justify-center gap-2.5 py-4 rounded-[10px] transition-all duration-300 group-hover/create:bg-black/60"
                            style={{ background: 'rgba(0,0,0,0.75)' }}
                        >
                            <span className="text-base transition-transform duration-300 group-hover/create:scale-110">✨</span>
                            <span className="text-sm font-semibold bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                                Tạo Cảnh AI — Còn {dailyFreeRemaining} free hôm nay
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>🎁 FREE</span>
                        </div>
                    </button>
                ) : (
                    /* Logged in + no daily free remaining — show buy credits */
                    <button
                        className="group/create w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                        style={{ padding: '2px', background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)' }}
                        onClick={() => setShowCreator(true)}
                    >
                        <div
                            className="flex items-center justify-center gap-2.5 py-4 rounded-[10px] transition-all duration-300 group-hover/create:bg-black/60"
                            style={{ background: 'rgba(0,0,0,0.75)' }}
                        >
                            <span className="text-base transition-transform duration-300 group-hover/create:scale-110">✨</span>
                            <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 via-pink-400 to-violet-400 bg-clip-text text-transparent">
                                {t('scene.createScene')}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Credits</span>
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
                    max-height: 85vh;
                    border-radius: 16px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                }
                .ss-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 16px 16px;
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
                    padding: 0 14px 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    flex: 1;
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

                @keyframes pulse-subtle {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
                    50% { box-shadow: 0 0 16px 2px rgba(16,185,129,0.15); }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 3s ease-in-out infinite;
                }
            `}</style>
        </div >
    );
}
