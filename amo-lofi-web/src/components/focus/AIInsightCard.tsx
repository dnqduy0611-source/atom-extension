import { Sparkles, Lock, RefreshCw, ChevronDown, ChevronUp, Clock, Target } from 'lucide-react';
import { useAIInsight } from '../../hooks/useAIInsight';
import { useState } from 'react';

/**
 * AIInsightCard — AI Weekly Insight (AI-2 Full UI)
 *
 * Pro: Headline, circular score, body text, actionable tip, archive, cooldown
 * Free: Blurred fake content + CTA overlay
 */

const MUTED = '#928FB0';

// ── Circular Score Component ──

function ScoreRing({ score, tc, size = 72 }: { score: number; tc: string; size?: number }) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const getScoreLabel = (s: number) => {
        if (s >= 81) return 'Elite';
        if (s >= 61) return 'Strong';
        if (s >= 41) return 'Growing';
        if (s >= 21) return 'Starting';
        return 'Low';
    };

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background ring */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4}
                />
                {/* Score ring */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={tc} strokeWidth={4}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{
                        transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: `drop-shadow(0 0 6px ${tc})`,
                    }}
                />
            </svg>
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Sora, sans-serif' }}>
                    {score}
                </span>
                <span style={{ fontSize: 8, color: MUTED, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {getScoreLabel(score)}
                </span>
            </div>
        </div>
    );
}

// ── Main Component ──

interface Props {
    isPro: boolean;
    showUpsell: () => void;
    tc: string;
}

export function AIInsightCard({ isPro, showUpsell, tc }: Props) {
    const {
        insight, isLoading, error, regenerate,
        cooldownDays, canGenerate,
        insufficientData, sessionsNeeded,
        archive,
    } = useAIInsight(isPro);

    const [showArchive, setShowArchive] = useState(false);

    return (
        <div className="dash-card" style={{
            padding: '28px 32px', position: 'relative', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Sparkles size={18} style={{ color: tc, filter: `drop-shadow(0 0 6px ${tc})` }} />
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    AI Weekly Insight
                </span>
                {!isPro && (
                    <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 9,
                        fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em',
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,180,0,0.06))',
                        border: '1px solid rgba(255,215,0,0.2)', color: '#FFD700',
                    }}>
                        PRO
                    </span>
                )}

                {/* Regenerate / Cooldown */}
                {isPro && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!canGenerate && cooldownDays > 0 && (
                            <span style={{
                                fontFamily: 'Inter, sans-serif', fontSize: 10, color: MUTED, opacity: 0.5,
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                                <Clock size={10} /> {cooldownDays}d
                            </span>
                        )}
                        <button onClick={regenerate} disabled={isLoading || !canGenerate}
                            className="cursor-pointer transition-all duration-200 hover:scale-110"
                            style={{
                                background: 'none', border: 'none', padding: 4,
                                color: MUTED, opacity: (isLoading || !canGenerate) ? 0.3 : 0.6,
                            }}
                            title={canGenerate ? 'Analyze my week' : `Next analysis in ${cooldownDays} days`}>
                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}
            </div>

            {isPro ? (
                /* Pro state — full insight UI */
                <div style={{
                    padding: '24px 20px', borderRadius: 14,
                    background: `color-mix(in srgb, ${tc} 5%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${tc} 8%, transparent)`,
                }}>
                    {isLoading ? (
                        /* Loading */
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <Sparkles size={24} style={{ color: tc, opacity: 0.5, marginBottom: 12 }} className="animate-pulse" />
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                                Analyzing your focus patterns...
                            </div>
                        </div>
                    ) : error ? (
                        /* Error */
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,100,100,0.7)', lineHeight: 1.6 }}>
                                {error}
                            </div>
                            {canGenerate && (
                                <button onClick={regenerate}
                                    className="cursor-pointer transition-all duration-200 hover:scale-105"
                                    style={{
                                        marginTop: 12, padding: '6px 16px', borderRadius: 8, border: 'none',
                                        background: `color-mix(in srgb, ${tc} 15%, transparent)`,
                                        fontFamily: 'Inter, sans-serif', fontSize: 11, color: tc,
                                    }}>
                                    Try again
                                </button>
                            )}
                        </div>
                    ) : insufficientData ? (
                        /* Not enough data */
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <Target size={28} style={{ color: tc, opacity: 0.4, marginBottom: 12 }} />
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                                {sessionsNeeded > 0
                                    ? `${sessionsNeeded} more session${sessionsNeeded > 1 ? 's' : ''} this week to unlock your report! 💪`
                                    : 'Complete your first week to get analysis!'
                                }
                            </div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, marginTop: 8, opacity: 0.5 }}>
                                Minimum 3 sessions per week required
                            </div>
                        </div>
                    ) : insight && insight.status === 'success' ? (
                        /* Full insight display */
                        <div>
                            {/* Headline + Score row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
                                <ScoreRing score={insight.score} tc={tc} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 700,
                                        color: '#fff', lineHeight: 1.3, marginBottom: 4,
                                    }}>
                                        {insight.headline}
                                    </div>
                                    <div style={{
                                        fontFamily: 'Inter, sans-serif', fontSize: 10, color: MUTED, opacity: 0.6,
                                    }}>
                                        Week of {insight.weekStart}
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{
                                fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(255,255,255,0.75)',
                                lineHeight: 1.7, marginBottom: insight.actionable_tip ? 16 : 0,
                            }}>
                                {insight.text}
                            </div>

                            {/* Actionable tip badge */}
                            {insight.actionable_tip && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '12px 14px', borderRadius: 10,
                                    background: `color-mix(in srgb, ${tc} 8%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${tc} 12%, transparent)`,
                                }}>
                                    <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>💡</span>
                                    <div style={{
                                        fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'rgba(255,255,255,0.8)',
                                        lineHeight: 1.6, fontWeight: 500,
                                    }}>
                                        {insight.actionable_tip}
                                    </div>
                                </div>
                            )}

                            {/* Meta */}
                            <div style={{
                                fontFamily: 'Inter, sans-serif', fontSize: 10, color: MUTED,
                                marginTop: 14, opacity: 0.5,
                            }}>
                                Generated {new Date(insight.generatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ) : (
                        /* No insight yet */
                        <div style={{ textAlign: 'center' }}>
                            <Sparkles size={28} style={{ color: tc, opacity: 0.4, marginBottom: 12 }} />
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                                Complete your first week to get your<br />personalized AI focus report!
                            </div>
                            {canGenerate && (
                                <button onClick={regenerate}
                                    className="cursor-pointer transition-all duration-200 hover:scale-105"
                                    style={{
                                        marginTop: 14, padding: '8px 20px', borderRadius: 10, border: 'none',
                                        background: `linear-gradient(135deg, ${tc}, color-mix(in srgb, ${tc} 70%, #fff))`,
                                        fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
                                        color: '#fff', letterSpacing: '0.02em',
                                        boxShadow: `0 0 16px color-mix(in srgb, ${tc} 25%, transparent)`,
                                    }}>
                                    Analyze My Week ✨
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Free state — blurred fake content + CTA overlay */
                <div style={{ position: 'relative' }}>
                    <div style={{
                        filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none',
                        padding: '20px 16px', borderRadius: 14,
                        background: `color-mix(in srgb, ${tc} 4%, transparent)`,
                    }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                            🎯 Your peak focus was Tuesday 2-4pm with 94min deep work.
                            Consider scheduling important tasks during this window.
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginTop: 10 }}>
                            💡 You're 23% more productive on mornings. Try shifting
                            your creative work earlier in the day.
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginTop: 10 }}>
                            🔥 7-day streak! Your consistency is building real momentum.
                        </div>
                    </div>

                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 12,
                        background: 'linear-gradient(160deg, rgba(10,10,20,0.3) 0%, rgba(10,10,20,0.6) 100%)',
                        borderRadius: 14,
                    }}>
                        <Lock size={22} style={{ color: tc, opacity: 0.7, filter: `drop-shadow(0 0 8px ${tc})` }} />
                        <span style={{
                            fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
                            color: 'rgba(255,255,255,0.75)', textAlign: 'center', maxWidth: 240, lineHeight: 1.5,
                        }}>
                            Unlock AI analysis to discover your peak focus hours
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); showUpsell(); }}
                            className="cursor-pointer transition-all duration-200 hover:scale-105"
                            style={{
                                padding: '7px 20px', borderRadius: 10, border: 'none',
                                background: `linear-gradient(135deg, ${tc}, color-mix(in srgb, ${tc} 70%, #fff))`,
                                fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
                                color: '#fff', letterSpacing: '0.02em',
                                boxShadow: `0 0 16px color-mix(in srgb, ${tc} 25%, transparent)`,
                            }}>
                            Upgrade to Pro ✨
                        </button>
                    </div>
                </div>
            )}

            {/* Archive toggle */}
            {isPro && archive.length > 1 && (
                <div style={{ marginTop: 16 }}>
                    <button
                        onClick={() => setShowArchive(!showArchive)}
                        className="cursor-pointer transition-all duration-200 hover:opacity-80"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'none', border: 'none', padding: 0,
                            fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, opacity: 0.6,
                        }}
                    >
                        {showArchive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        Past Reports ({archive.length})
                    </button>

                    {showArchive && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {archive.slice(1).map((item) => (
                                <div key={item.weekStart} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 14px', borderRadius: 10,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    {/* Mini score */}
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: `color-mix(in srgb, ${tc} 10%, transparent)`,
                                        border: `1.5px solid color-mix(in srgb, ${tc} 20%, transparent)`,
                                        fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 700, color: tc,
                                        flexShrink: 0,
                                    }}>
                                        {item.score}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
                                            color: 'rgba(255,255,255,0.75)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {item.headline}
                                        </div>
                                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: MUTED, opacity: 0.5 }}>
                                            Week of {item.weekStart}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
