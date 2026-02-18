/**
 * AIBackgroundGenerator — Panel for generating backgrounds via Gemini AI.
 *
 * Features:
 *   - Scene name auto-fill
 *   - Style dropdown (Realistic, Anime, Watercolor, Minimalist, Cyberpunk)
 *   - Optional description textarea
 *   - Preview area with loading states
 *   - Retry with cost confirmation
 *   - Save to library
 */

import { useState } from 'react';
import { useGenerateBackground } from '../../hooks/useGenerateBackground';
import { useBackgrounds } from '../../hooks/useBackgrounds';
import { useCredits } from '../../hooks/useCredits';

interface Props {
    sceneName: string;
    sceneDescription: string;
    sceneId: string;
    onClose: () => void;
    onGenerated?: () => void;
}

const STYLES = [
    { value: 'realistic', label: '📷 Realistic', desc: 'Photo-realistic scene' },
    { value: 'anime', label: '🎨 Anime', desc: 'Japanese anime style' },
    { value: 'watercolor', label: '🖌️ Watercolor', desc: 'Soft watercolor painting' },
    { value: 'minimalist', label: '⬜ Minimalist', desc: 'Clean, minimal design' },
    { value: 'cyberpunk', label: '🌆 Cyberpunk', desc: 'Neon sci-fi aesthetic' },
    { value: 'fantasy', label: '🏰 Fantasy', desc: 'Magical fantasy world' },
    { value: 'vintage', label: '📜 Vintage', desc: 'Retro nostalgic feel' },
];

export function AIBackgroundGenerator({ sceneName, sceneDescription, sceneId, onClose, onGenerated }: Props) {
    const { generate, isGenerating, phase, error, preview, reset } = useGenerateBackground();
    const { refresh: refreshBgs } = useBackgrounds();
    const { balance } = useCredits();

    const [style, setStyle] = useState('realistic');
    const [description, setDescription] = useState(sceneDescription || '');
    const [lastPrompt, setLastPrompt] = useState<string | null>(null);
    const [showRetryConfirm, setShowRetryConfirm] = useState(false);
    const [saved, setSaved] = useState(false);

    const COST = 10;
    const hasEnoughCredits = balance >= COST;

    const handleGenerate = async () => {
        try {
            const result = await generate(sceneName, description, style, sceneId);
            setLastPrompt(result.imagePrompt);
            await refreshBgs();
            onGenerated?.();
            setSaved(true); // Auto-saved by EF
        } catch {
            // Error already set in hook
        }
    };

    const handleRetry = async () => {
        setShowRetryConfirm(false);
        setSaved(false);
        reset();
        await handleGenerate();
    };

    const phaseLabel: Record<string, string> = {
        idle: '',
        prompting: '🧠 Crafting image prompt...',
        generating: '🎨 Generating background...',
        saving: '💾 Saving to library...',
        done: '✅ Done!',
        error: '❌ Failed',
    };

    return (
        <div
            className="ss-panel fade-in"
            style={{
                background: 'var(--theme-panel-bg)',
                border: '1px solid var(--theme-panel-border)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
        >
            {/* Header */}
            <div className="ss-header" style={{ padding: '16px 16px 12px' }}>
                <button
                    className="ss-close"
                    onClick={onClose}
                    title="Back"
                >
                    <span style={{ color: 'var(--theme-text-muted)', fontSize: '14px' }}>←</span>
                </button>
                <div className="ss-header-center">
                    <h3 className="ss-title" style={{ color: 'var(--theme-text)' }}>
                        🤖 AI Background
                    </h3>
                </div>
                <button className="ss-close" onClick={onClose}>
                    <span style={{ color: 'var(--theme-text-muted)', fontSize: '12px' }}>✕</span>
                </button>
            </div>

            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Scene info */}
                <div
                    style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <div style={{ fontSize: '10px', color: 'var(--theme-text-muted)', marginBottom: '2px' }}>
                        Scene
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--theme-text)' }}>
                        {sceneName || 'Custom Scene'}
                    </div>
                </div>

                {/* Style selector */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--theme-text-muted)', marginBottom: '6px', display: 'block' }}>
                        Style
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                        {STYLES.map((s) => (
                            <button
                                key={s.value}
                                onClick={() => setStyle(s.value)}
                                style={{
                                    padding: '6px 4px',
                                    borderRadius: '8px',
                                    border: style === s.value
                                        ? '1.5px solid var(--theme-primary)'
                                        : '1.5px solid rgba(255,255,255,0.08)',
                                    background: style === s.value
                                        ? 'rgba(var(--theme-primary-rgb, 139,92,246), 0.12)'
                                        : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    textAlign: 'center',
                                }}
                                disabled={isGenerating}
                                title={s.desc}
                            >
                                <div style={{ fontSize: '14px', lineHeight: 1 }}>{s.label.split(' ')[0]}</div>
                                <div style={{ fontSize: '9px', color: style === s.value ? 'var(--theme-primary)' : 'var(--theme-text-muted)', marginTop: '2px' }}>
                                    {s.label.split(' ').slice(1).join(' ')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--theme-text-muted)', marginBottom: '6px', display: 'block' }}>
                        Description (optional)
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="E.g. Rainy Tokyo street at night with neon lights..."
                        disabled={isGenerating}
                        maxLength={300}
                        style={{
                            width: '100%',
                            height: '60px',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'var(--theme-text)',
                            fontSize: '12px',
                            resize: 'none',
                            fontFamily: 'inherit',
                            outline: 'none',
                        }}
                    />
                    <div style={{ fontSize: '9px', color: 'var(--theme-text-muted)', textAlign: 'right', marginTop: '2px' }}>
                        {description.length}/300
                    </div>
                </div>

                {/* Preview area */}
                {(preview || isGenerating) && (
                    <div
                        style={{
                            borderRadius: '12px',
                            overflow: 'hidden',
                            aspectRatio: '16/9',
                            background: 'rgba(0,0,0,0.4)',
                            position: 'relative',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}
                    >
                        {preview ? (
                            <img
                                src={preview}
                                alt="Generated background"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                        ) : (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}>
                                <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                <span style={{ fontSize: '11px', color: 'var(--theme-text-muted)' }}>
                                    {phaseLabel[phase] || 'Processing...'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* AI prompt used */}
                {lastPrompt && (
                    <div
                        style={{
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: 'rgba(139,92,246,0.06)',
                            border: '1px solid rgba(139,92,246,0.12)',
                            fontSize: '9px',
                            color: 'rgba(196,181,253,0.7)',
                            lineHeight: 1.4,
                            maxHeight: '48px',
                            overflow: 'hidden',
                        }}
                    >
                        <span style={{ fontWeight: 600 }}>Prompt: </span>
                        {lastPrompt}
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#f87171',
                            fontSize: '11px',
                        }}
                    >
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {phase === 'done' ? (
                        <>
                            {/* Retry */}
                            <button
                                onClick={() => setShowRetryConfirm(true)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'var(--theme-text)',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                🔄 Retry ({COST} cr)
                            </button>
                            {/* Done */}
                            <button
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
                                    color: 'white',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}
                            >
                                ✅ {saved ? 'Saved!' : 'Save'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !hasEnoughCredits}
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '12px',
                                border: 'none',
                                background: isGenerating
                                    ? 'rgba(139,92,246,0.15)'
                                    : !hasEnoughCredits
                                        ? 'rgba(255,255,255,0.06)'
                                        : 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(59,130,246,0.9))',
                                color: isGenerating ? 'var(--theme-text-muted)' : !hasEnoughCredits ? 'rgba(255,255,255,0.3)' : 'white',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: isGenerating || !hasEnoughCredits ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                    {phaseLabel[phase]}
                                </>
                            ) : !hasEnoughCredits ? (
                                `Cần ${COST} credits (còn ${balance})`
                            ) : (
                                <>
                                    <span>🤖</span>
                                    <span>Generate ({COST} credits)</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Credit balance */}
                <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--theme-text-muted)' }}>
                    Credits: {balance} • Cost: {COST} credits
                </div>
            </div>

            {/* Retry confirmation modal */}
            {showRetryConfirm && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'inherit',
                        zIndex: 50,
                    }}
                >
                    <div
                        style={{
                            padding: '20px',
                            borderRadius: '16px',
                            background: 'var(--theme-panel-bg)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            maxWidth: '280px',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--theme-text)', marginBottom: '4px' }}>
                            Generate lại?
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--theme-text-muted)', marginBottom: '16px' }}>
                            Tốn thêm {COST} credits. Ảnh hiện tại đã được lưu.<br />
                            Credits còn lại: {balance}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setShowRetryConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'transparent',
                                    color: 'var(--theme-text-muted)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRetry}
                                disabled={!hasEnoughCredits}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: hasEnoughCredits
                                        ? 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(59,130,246,0.9))'
                                        : 'rgba(255,255,255,0.06)',
                                    color: hasEnoughCredits ? 'white' : 'rgba(255,255,255,0.3)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: hasEnoughCredits ? 'pointer' : 'not-allowed',
                                }}
                            >
                                Retry ({COST} cr)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Panel styles (reuses ss-panel from SceneSelector) */}
            <style>{`
                .aibg-panel {
                    position: relative;
                }
            `}</style>
        </div>
    );
}
