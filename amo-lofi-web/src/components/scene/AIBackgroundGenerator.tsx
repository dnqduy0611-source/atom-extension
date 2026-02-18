/**
 * AIBackgroundGenerator — Cinematic panel for generating backgrounds via Gemini AI.
 *
 * Design: Glass-morphism panel matching AmoLofi's cinematic hub aesthetic.
 * - Elegant style cards with gradient accents (no emojis)
 * - Smooth animations and hover states
 * - Premium loading/progress UX
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
    { value: 'realistic', label: 'Realistic', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { value: 'anime', label: 'Anime', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { value: 'watercolor', label: 'Watercolor', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
    { value: 'minimalist', label: 'Minimal', gradient: 'linear-gradient(135deg, #e2e2e2, #c9d6ff)' },
    { value: 'cyberpunk', label: 'Cyberpunk', gradient: 'linear-gradient(135deg, #0ff0fc, #e040fb)' },
    { value: 'fantasy', label: 'Fantasy', gradient: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
    { value: 'vintage', label: 'Vintage', gradient: 'linear-gradient(135deg, #d4a574, #c2956b)' },
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
            await onGenerated?.();
            setSaved(true);
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
        prompting: 'Crafting image prompt…',
        generating: 'Generating background…',
        saving: 'Saving to library…',
        done: 'Complete',
        error: 'Failed',
    };

    const selectedStyle = STYLES.find(s => s.value === style);

    return (
        <div
            className="ss-panel fade-in"
            style={{
                background: 'rgba(12,12,18,0.92)',
                backdropFilter: 'blur(24px) saturate(1.2)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
                maxHeight: 'calc(100vh - 80px)',
                display: 'flex',
                flexDirection: 'column' as const,
                overflowY: 'auto' as const,
            }}
        >
            {/* Header */}
            <div style={{
                padding: '16px 16px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        transition: 'all 0.15s',
                        lineHeight: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    title="Back"
                >
                    ‹
                </button>
                <h3 style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                    color: 'rgba(255,255,255,0.85)',
                }}>
                    AI Background
                </h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        transition: 'all 0.15s',
                        lineHeight: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                    ✕
                </button>
            </div>

            <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' as const, flex: 1, minHeight: 0 }}>
                {/* Scene badge */}
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                }}>
                    <div style={{
                        fontSize: '9px',
                        fontWeight: 500,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        marginBottom: '4px',
                    }}>
                        Scene
                    </div>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.9)',
                    }}>
                        {sceneName || 'Custom Scene'}
                    </div>
                </div>

                {/* Style selector — elegant pill grid */}
                <div>
                    <label style={{
                        fontSize: '9px',
                        fontWeight: 500,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        marginBottom: '8px',
                        display: 'block',
                    }}>
                        Style
                    </label>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '6px',
                    }}>
                        {STYLES.map((s) => {
                            const isActive = style === s.value;
                            return (
                                <button
                                    key={s.value}
                                    onClick={() => setStyle(s.value)}
                                    disabled={isGenerating}
                                    style={{
                                        padding: '8px 4px',
                                        borderRadius: '10px',
                                        border: isActive
                                            ? '1.5px solid rgba(255,255,255,0.2)'
                                            : '1.5px solid rgba(255,255,255,0.04)',
                                        background: isActive
                                            ? 'rgba(255,255,255,0.08)'
                                            : 'rgba(255,255,255,0.02)',
                                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center' as const,
                                        position: 'relative' as const,
                                        overflow: 'hidden',
                                    }}
                                >
                                    {/* Gradient bar at top */}
                                    <div style={{
                                        position: 'absolute' as const,
                                        top: 0,
                                        left: '20%',
                                        right: '20%',
                                        height: isActive ? '2px' : '1px',
                                        background: s.gradient,
                                        opacity: isActive ? 1 : 0.3,
                                        borderRadius: '0 0 4px 4px',
                                        transition: 'all 0.2s',
                                    }} />
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: isActive ? 600 : 400,
                                        color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                                        transition: 'all 0.2s',
                                        marginTop: '2px',
                                    }}>
                                        {s.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Description textarea */}
                <div>
                    <label style={{
                        fontSize: '9px',
                        fontWeight: 500,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '1.2px',
                        color: 'rgba(255,255,255,0.35)',
                        marginBottom: '6px',
                        display: 'block',
                    }}>
                        Description <span style={{ opacity: 0.5, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="E.g. Rainy Tokyo street at night with neon lights..."
                        disabled={isGenerating}
                        maxLength={300}
                        style={{
                            width: '100%',
                            height: '56px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(0,0,0,0.25)',
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: '12px',
                            resize: 'none' as const,
                            fontFamily: 'inherit',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                    />
                    <div style={{
                        fontSize: '9px',
                        color: 'rgba(255,255,255,0.25)',
                        textAlign: 'right' as const,
                        marginTop: '3px',
                    }}>
                        {description.length}/300
                    </div>
                </div>

                {/* Preview area */}
                {(preview || isGenerating) && (
                    <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        maxHeight: '180px',
                        background: 'rgba(0,0,0,0.4)',
                        position: 'relative' as const,
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        {preview ? (
                            <img
                                src={preview}
                                alt="Generated background"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}
                            />
                        ) : (
                            <div style={{
                                position: 'absolute' as const,
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column' as const,
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                            }}>
                                {/* Elegant spinner */}
                                <div style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: '2px solid rgba(255,255,255,0.06)',
                                    borderTopColor: selectedStyle?.gradient ? 'rgba(255,255,255,0.5)' : 'rgba(139,92,246,0.7)',
                                    animation: 'spin 0.8s linear infinite',
                                }} />
                                <span style={{
                                    fontSize: '11px',
                                    color: 'rgba(255,255,255,0.45)',
                                    fontWeight: 500,
                                    letterSpacing: '0.3px',
                                }}>
                                    {phaseLabel[phase] || 'Processing…'}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* AI prompt used */}
                {lastPrompt && (
                    <div style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '9px',
                        color: 'rgba(255,255,255,0.35)',
                        lineHeight: 1.5,
                        maxHeight: '48px',
                        overflow: 'hidden',
                    }}>
                        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Prompt: </span>
                        {lastPrompt}
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        color: 'rgba(248,113,113,0.9)',
                        fontSize: '11px',
                    }}>
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {phase === 'done' ? (
                        <>
                            <button
                                onClick={() => setShowRetryConfirm(true)}
                                style={{
                                    flex: 1,
                                    padding: '11px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.3px',
                                }}
                            >
                                Retry · {COST} cr
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: '11px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'rgba(255,255,255,0.12)',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    letterSpacing: '0.3px',
                                }}
                            >
                                {saved ? 'Saved ✓' : 'Save'}
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
                                    ? 'rgba(255,255,255,0.06)'
                                    : !hasEnoughCredits
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'rgba(255,255,255,0.1)',
                                color: isGenerating
                                    ? 'rgba(255,255,255,0.4)'
                                    : !hasEnoughCredits
                                        ? 'rgba(255,255,255,0.2)'
                                        : 'rgba(255,255,255,0.9)',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: isGenerating || !hasEnoughCredits ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                letterSpacing: '0.4px',
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <span style={{
                                        width: 14,
                                        height: 14,
                                        borderRadius: '50%',
                                        border: '2px solid rgba(255,255,255,0.1)',
                                        borderTopColor: 'rgba(255,255,255,0.5)',
                                        animation: 'spin 0.8s linear infinite',
                                        display: 'inline-block',
                                    }} />
                                    <span>{phaseLabel[phase]}</span>
                                </>
                            ) : !hasEnoughCredits ? (
                                `Need ${COST} credits (${balance} left)`
                            ) : (
                                <>
                                    <span style={{ fontSize: '14px' }}>✦</span>
                                    <span>Generate · {COST} credits</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Credit balance — subtle */}
                <div style={{
                    textAlign: 'center' as const,
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.2)',
                    letterSpacing: '0.5px',
                }}>
                    {balance} credits available
                </div>
            </div>

            {/* Retry confirmation modal */}
            {showRetryConfirm && (
                <div style={{
                    position: 'absolute' as const,
                    inset: 0,
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'inherit',
                    zIndex: 50,
                }}>
                    <div style={{
                        padding: '24px',
                        borderRadius: '16px',
                        background: 'rgba(18,18,24,0.95)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        maxWidth: '260px',
                        textAlign: 'center' as const,
                        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    }}>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.85)',
                            marginBottom: '8px',
                        }}>
                            Regenerate?
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.4)',
                            marginBottom: '18px',
                            lineHeight: 1.5,
                        }}>
                            This will cost {COST} more credits.<br />
                            Current image is saved. Balance: {balance} cr
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setShowRetryConfirm(false)}
                                style={{
                                    flex: 1,
                                    padding: '9px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'transparent',
                                    color: 'rgba(255,255,255,0.5)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRetry}
                                disabled={!hasEnoughCredits}
                                style={{
                                    flex: 1,
                                    padding: '9px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: hasEnoughCredits
                                        ? 'rgba(255,255,255,0.1)'
                                        : 'rgba(255,255,255,0.04)',
                                    color: hasEnoughCredits
                                        ? 'rgba(255,255,255,0.9)'
                                        : 'rgba(255,255,255,0.2)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: hasEnoughCredits ? 'pointer' : 'not-allowed',
                                }}
                            >
                                Retry · {COST} cr
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
