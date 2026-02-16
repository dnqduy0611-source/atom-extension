import { useState, useRef, useCallback } from 'react';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useGeminiTheme } from '../../hooks/useGeminiTheme';
import type { CreateSceneResult } from '../../hooks/useGeminiTheme';
import type { StoredScene } from '../../utils/idb';
import { useCredits } from '../../hooks/useCredits';
import { useAuth } from '../../hooks/useAuth';

/**
 * SceneCreator — AI-powered custom scene creation form.
 *
 * Credit system flow:
 *   - Not logged in → show login prompt
 *   - Logged in + trial available → "Create Free (Trial)"
 *   - Logged in + has credits → "Create with AI (10 credits)"
 *   - Logged in + no credits + no trial → disable + show "Buy Credits"
 *
 * Scene generation is handled server-side via create-scene Edge Function.
 * No API key needed.
 */

type Phase = 'idle' | 'theme' | 'image';

const CREDITS_PER_SCENE = 10;

interface Props {
    onSave: (scene: StoredScene) => Promise<void>;
    onClose: () => void;
    onShowLogin?: () => void;
    onShowUpgrade?: () => void;
}

export function SceneCreator({ onSave, onClose, onShowLogin, onShowUpgrade }: Props) {
    const icons = useSceneIcons();
    const { generate, isGenerating, error: genError } = useGeminiTheme();
    const { user } = useAuth();
    const { balance, trialUsed, refresh: refreshCredits } = useCredits();

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    // Generation state
    const [result, setResult] = useState<CreateSceneResult | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [bgBlob, setBgBlob] = useState<Blob | null>(null);
    const [bgPreview, setBgPreview] = useState<string | null>(null);
    const [bgFile, setBgFile] = useState<File | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);

    // Save state
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Derived
    const canUseTrial = !trialUsed;
    const canUseCredits = balance >= CREDITS_PER_SCENE;
    const canGenerate = name.trim().length > 0 && description.trim().length >= 10 && !!user && (canUseTrial || canUseCredits);
    const isBusy = isGenerating || phase !== 'idle';

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBgFile(file);
            setBgBlob(null);
            setBgPreview(URL.createObjectURL(file));
        }
    }, []);

    // ── Full generation via server proxy ──
    const handleGenerate = useCallback(async () => {
        setSaveError(null);
        setImageError(null);

        try {
            setPhase('theme');
            const res = await generate(name, description);
            setResult(res);

            // Image from server
            if (res.imageBlob) {
                setBgBlob(res.imageBlob);
                setBgFile(null);
                setBgPreview(URL.createObjectURL(res.imageBlob));
            } else {
                setImageError('Image generation failed — upload manually');
            }

            // Refresh credits after successful generation
            await refreshCredits();
        } catch (err) {
            const code = (err as { code?: string }).code;
            if (code === 'INSUFFICIENT_CREDITS') {
                onShowUpgrade?.();
            }
        } finally {
            setPhase('idle');
        }
    }, [name, description, generate, refreshCredits, onShowUpgrade]);

    const handleSave = useCallback(async () => {
        if (!result) return;
        setIsSaving(true);
        setSaveError(null);

        try {
            const stored: StoredScene = {
                id: `custom_scene_${Date.now()}`,
                name,
                description,
                theme: result.generatedTheme.theme,
                backgroundBlob: bgBlob ?? bgFile,
                tint: result.generatedTheme.suggestedTint,
                tags: result.generatedTheme.tags,
                defaultAmbience: result.generatedTheme.defaultAmbience,
                createdAt: Date.now(),
                iconPaths: result.generatedTheme.icons,
            };
            await onSave(stored);
            onClose();
        } catch (err) {
            setSaveError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    }, [result, name, description, bgBlob, bgFile, onSave, onClose]);

    // ── Button label logic ──
    function getButtonLabel(): string {
        if (!user) return 'Đăng nhập để tạo';
        if (isBusy) return phase === 'theme' ? 'Đang thiết kế...' : 'Đang tạo hình nền...';
        if (result) return 'Tạo lại';
        if (canUseTrial) return '✨ Tạo miễn phí (Dùng thử)';
        if (canUseCredits) return `✨ Tạo bằng AI (${CREDITS_PER_SCENE} credits)`;
        return 'Hết credits — Mua thêm';
    }

    function handleMainButton() {
        if (!user) {
            onShowLogin?.();
            return;
        }
        if (!canUseTrial && !canUseCredits) {
            onShowUpgrade?.();
            return;
        }
        handleGenerate();
    }

    return (
        <div
            className="sc-panel fade-in"
            style={{
                background: 'var(--theme-panel-bg)',
                border: '1px solid var(--theme-panel-border)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
        >
            {/* ── Header ── */}
            <div className="sc-header">
                <div className="sc-header-inner">
                    <div className="sc-header-left">
                        <span className="sc-header-icon">✨</span>
                        <h3 className="sc-title" style={{ color: 'var(--theme-text)' }}>Create Scene</h3>
                    </div>
                    <button className="sc-close" onClick={onClose}>
                        <icons.ui.close size={14} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>
                </div>
            </div>

            {/* ── Form body ── */}
            <div className="sc-body custom-scrollbar">
                {/* Credits banner */}
                {user && (
                    <div className="sc-credits-banner">
                        <div className="sc-credits-left">
                            <span className="sc-credits-icon">💎</span>
                            <span className="sc-credits-text">
                                {balance} credits
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {!trialUsed && (
                                <span className="sc-trial-badge">
                                    🎁 1 lượt thử miễn phí
                                </span>
                            )}
                            <button
                                onClick={() => onShowUpgrade?.()}
                                className="sc-buy-credits-btn"
                            >
                                + Buy Credits
                            </button>
                        </div>
                    </div>
                )}

                {/* Name */}
                <div className="sc-field">
                    <label className="sc-label" style={{ color: 'var(--theme-text-muted)' }}>
                        Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Rainy Tokyo"
                        maxLength={40}
                        className="sc-input"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--theme-text)',
                        }}
                    />
                </div>

                {/* Description */}
                <div className="sc-field">
                    <label className="sc-label" style={{ color: 'var(--theme-text-muted)' }}>
                        Describe your scene
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A rain-soaked Tokyo street at dusk with neon signs reflecting in puddles..."
                        rows={3}
                        className="sc-input sc-textarea"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--theme-text)',
                        }}
                    />
                </div>

                {/* Generate button */}
                <button
                    disabled={isBusy || (!user ? false : !canGenerate)}
                    onClick={handleMainButton}
                    className="sc-generate-btn"
                    style={{
                        background: (canGenerate || !user) && !isBusy
                            ? `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))`
                            : (!canUseTrial && !canUseCredits && user)
                                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                                : 'rgba(255,255,255,0.06)',
                        color: 'white',
                        boxShadow: (canGenerate || !user) && !isBusy ? `0 4px 24px var(--theme-primary-glow)` : 'none',
                    }}
                >
                    {isBusy ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {getButtonLabel()}
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            {getButtonLabel()}
                        </span>
                    )}
                </button>

                {/* Errors */}
                {(genError || imageError || saveError) && (
                    <div className="sc-error">
                        {genError || imageError || saveError}
                    </div>
                )}

                {/* ── Background Preview ── */}
                {result && (
                    <div className="sc-field">
                        <div className="flex items-center justify-between">
                            <p className="sc-section-label" style={{ color: 'var(--theme-text-muted)' }}>
                                Background
                            </p>
                            <div className="flex gap-1.5">
                                <button
                                    className="sc-small-btn"
                                    style={{ color: 'var(--theme-text-muted)' }}
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        Upload
                                    </span>
                                </button>
                            </div>
                        </div>

                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {bgPreview ? (
                            <div className="relative rounded-xl overflow-hidden" style={{ height: '160px' }}>
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${bgPreview})` }}
                                />
                                {/* Tint overlay preview */}
                                <div
                                    className="absolute inset-0"
                                    style={{ background: result.generatedTheme.suggestedTint.day }}
                                />
                                <button
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors cursor-pointer backdrop-blur-sm"
                                    onClick={() => { setBgBlob(null); setBgFile(null); setBgPreview(null); }}
                                >
                                    <icons.ui.close size={12} color="white" />
                                </button>
                                {bgBlob && (
                                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/50 text-white/80 backdrop-blur-sm">
                                        AI Generated
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div
                                className="rounded-xl flex flex-col items-center justify-center gap-2"
                                style={{
                                    height: '100px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '2px dashed rgba(255,255,255,0.1)',
                                    color: 'var(--theme-text-muted)',
                                }}
                            >
                                {imageError ? (
                                    <>
                                        <span className="text-xs">Image generation failed</span>
                                        <span className="text-[11px] opacity-60">Upload your own</span>
                                    </>
                                ) : (
                                    <span className="text-xs opacity-60">No background yet</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── AI Prompt Preview (debug/test) ── */}
                {result?.generatedTheme.imagePrompt && (
                    <details className="sc-field">
                        <summary
                            className="text-[11px] cursor-pointer select-none"
                            style={{ color: 'var(--theme-text-muted)', opacity: 0.6 }}
                        >
                            View AI prompt
                        </summary>
                        <p
                            className="mt-2 text-[11px] leading-relaxed rounded-lg p-3"
                            style={{
                                color: 'var(--theme-text-muted)',
                                background: 'rgba(255,255,255,0.04)',
                            }}
                        >
                            {result.generatedTheme.imagePrompt}
                        </p>
                    </details>
                )}

                {/* ── Theme Preview ── */}
                {result && (
                    <div className="sc-preview-section">
                        <p className="sc-section-label" style={{ color: 'var(--theme-text-muted)' }}>
                            Theme
                        </p>
                        <div className="flex gap-3">
                            {(['day', 'night'] as const).map((variant) => {
                                const t = result.generatedTheme.theme[variant];
                                return (
                                    <div
                                        key={variant}
                                        className="flex-1 rounded-xl p-4 space-y-2"
                                        style={{
                                            background: t.panelBg,
                                            border: `1px solid ${t.panelBorder}`,
                                        }}
                                    >
                                        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: t.textMuted }}>
                                            {variant}
                                        </p>
                                        <div className="flex gap-1.5">
                                            <div className="w-6 h-6 rounded-full" style={{ background: t.primary, boxShadow: `0 0 10px ${t.primaryGlow}` }} title="Primary" />
                                            <div className="w-6 h-6 rounded-full" style={{ background: t.secondary }} title="Secondary" />
                                        </div>
                                        <p className="text-[11px]" style={{ color: t.textPrimary }}>Sample text</p>
                                        <p className="text-[11px]" style={{ color: t.textMuted }}>Muted text</p>
                                    </div>
                                );
                            })}
                        </div>

                        {result.generatedTheme.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {result.generatedTheme.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="px-2.5 py-1 rounded-full text-[11px] font-medium"
                                        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-muted)' }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Save / Cancel ── */}
                {result && (
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onClose}
                            className="sc-cancel-btn"
                            style={{ color: 'var(--theme-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="sc-save-btn"
                            style={{
                                background: 'var(--theme-primary)',
                                color: 'white',
                                boxShadow: `0 4px 16px var(--theme-primary-glow)`,
                            }}
                        >
                            {isSaving ? 'Saving...' : (
                                <span className="flex items-center justify-center gap-2">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    Save Scene
                                </span>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .sc-panel {
                    width: 420px;
                    border-radius: 20px;
                    backdrop-filter: blur(24px) saturate(1.4);
                    overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
                }
                .sc-header {
                    background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .sc-header-inner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px 24px 16px;
                }
                .sc-header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .sc-header-icon { font-size: 20px; }
                .sc-title {
                    font-size: 18px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    margin: 0;
                }
                .sc-close {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.06);
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .sc-close:hover { background: rgba(255,255,255,0.08); }

                .sc-body {
                    padding: 20px 24px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .sc-credits-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    border-radius: 12px;
                    background: rgba(102,126,234,0.08);
                    border: 1px solid rgba(102,126,234,0.15);
                }
                .sc-credits-left {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .sc-credits-icon { font-size: 16px; }
                .sc-credits-text {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.85);
                }
                .sc-trial-badge {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 8px;
                    background: rgba(16,185,129,0.12);
                    color: #34d399;
                    border: 1px solid rgba(16,185,129,0.2);
                }
                .sc-buy-credits-btn {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 4px 12px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,211,238,0.15));
                    color: #4ade80;
                    border: 1px solid rgba(74,222,128,0.2);
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .sc-buy-credits-btn:hover {
                    background: linear-gradient(135deg, rgba(74,222,128,0.25), rgba(34,211,238,0.25));
                    transform: scale(1.03);
                }

                .sc-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .sc-label {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.2px;
                }
                .sc-input {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    line-height: 1.5;
                }
                .sc-input:focus {
                    border-color: var(--theme-primary) !important;
                    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 15%, transparent);
                }
                .sc-textarea { resize: none; }

                .sc-generate-btn {
                    width: 100%;
                    padding: 14px;
                    border-radius: 14px;
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    cursor: pointer;
                    transition: all 0.25s;
                    border: none;
                }
                .sc-generate-btn:not(:disabled):hover {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }
                .sc-generate-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .sc-small-btn {
                    font-size: 11px;
                    font-weight: 600;
                    padding: 4px 10px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.06);
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .sc-small-btn:hover { background: rgba(255,255,255,0.1); }
                .sc-small-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .sc-error {
                    padding: 12px 16px;
                    border-radius: 12px;
                    font-size: 13px;
                    background: rgba(239,68,68,0.12);
                    color: #f87171;
                    border: 1px solid rgba(239,68,68,0.15);
                }

                .sc-preview-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .sc-section-label {
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.2px;
                    margin: 0;
                }

                .sc-cancel-btn {
                    flex: 1;
                    padding: 12px;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    background: transparent;
                    transition: background 0.2s;
                }
                .sc-cancel-btn:hover { background: rgba(255,255,255,0.06); }

                .sc-save-btn {
                    flex: 1;
                    padding: 12px;
                    border-radius: 14px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }
                .sc-save-btn:not(:disabled):hover {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }
                .sc-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
