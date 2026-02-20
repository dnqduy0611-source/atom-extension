import { formatDuration } from '../../utils/formatTime';
import { exportFocusCSV } from '../../utils/exportCSV';
import { Lock, Download } from 'lucide-react';

/**
 * SessionHistoryList — Shows recent focus sessions with Pro-gating.
 * Free: 10 most recent entries + blurred overflow rows with CTA.
 * Pro: Full history (up to 90 days from focusHistory).
 */

const MUTED = '#928FB0';
const FREE_LIMIT = 10;

interface Props {
    focusHistory: Record<string, number>; // YYYY-MM-DD -> minutes
    hourlyHistory: Record<string, number>; // hour -> count
    isPro: boolean;
    showUpsell: () => void;
    tc: string;
}

export function SessionHistoryList({ focusHistory, hourlyHistory, isPro, showUpsell, tc }: Props) {
    // Sort entries by date descending
    const entries = Object.entries(focusHistory)
        .filter(([, v]) => v > 0)
        .sort(([a], [b]) => b.localeCompare(a));

    const visibleEntries = isPro ? entries : entries.slice(0, FREE_LIMIT);
    const hasOverflow = !isPro && entries.length > FREE_LIMIT;

    if (entries.length === 0) {
        return (
            <div className="dash-card" style={{ padding: '32px 36px', textAlign: 'center' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: MUTED }}>
                    No sessions yet. Start a focus session to see your history!
                </span>
            </div>
        );
    }

    return (
        <div className="dash-card" style={{ padding: '28px 32px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    Session History
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isPro && (
                        <button onClick={(e) => { e.stopPropagation(); exportFocusCSV(focusHistory, hourlyHistory); }}
                            className="cursor-pointer transition-all duration-200 hover:scale-105"
                            title="Export as CSV"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '4px 12px', borderRadius: 8, border: 'none',
                                background: `color-mix(in srgb, ${tc} 10%, transparent)`,
                                fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
                                color: tc, letterSpacing: '0.02em',
                            }}>
                            <Download size={12} /> CSV
                        </button>
                    )}
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                        {entries.length} sessions
                    </span>
                </div>
            </div>

            {/* Session list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {visibleEntries.map(([date, minutes]) => {
                    const d = new Date(date + 'T00:00:00');
                    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return (
                        <div key={date} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.015)',
                            transition: 'background 0.2s',
                        }}
                            className="hover:bg-white/[0.03]"
                        >
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                                {label}
                            </span>
                            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 600, color: tc }}>
                                {formatDuration(minutes)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Blurred overflow rows + CTA for Free users */}
            {hasOverflow && (
                <div style={{ position: 'relative', marginTop: 2 }}>
                    {/* Fake blurred rows */}
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10,
                            filter: `blur(${3 + i * 2}px)`, opacity: 0.4,
                            pointerEvents: 'none',
                        }}>
                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                Mon, Jan 01
                            </span>
                            <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 600, color: tc }}>
                                25m
                            </span>
                        </div>
                    ))}

                    {/* Gradient fade overlay + CTA */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,20,0.8) 60%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                        paddingBottom: 8, gap: 8,
                    }}>
                        <Lock size={14} style={{ color: tc, opacity: 0.6 }} />
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                            See full history with Pro
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); showUpsell(); }}
                            className="cursor-pointer transition-all duration-200 hover:scale-105"
                            style={{
                                padding: '5px 16px', borderRadius: 8, border: 'none',
                                background: `color-mix(in srgb, ${tc} 15%, transparent)`,
                                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
                                color: tc, letterSpacing: '0.02em',
                            }}>
                            Unlock ✨
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
