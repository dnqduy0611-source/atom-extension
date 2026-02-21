import { formatDuration } from '../../utils/formatTime';
import { exportFocusCSV } from '../../utils/exportCSV';
import { Download } from 'lucide-react';

/**
 * SessionHistoryList — Shows recent focus sessions.
 * All users can see full history and export CSV.
 */

const MUTED = '#928FB0';


interface Props {
    focusHistory: Record<string, number>; // YYYY-MM-DD -> minutes
    hourlyHistory: Record<string, number>; // hour -> count
    isPro: boolean;
    showUpsell: () => void;
    tc: string;
}

export function SessionHistoryList({ focusHistory, hourlyHistory, isPro: _isPro, showUpsell: _showUpsell, tc }: Props) {
    // Sort entries by date descending
    const entries = Object.entries(focusHistory)
        .filter(([, v]) => v > 0)
        .sort(([a], [b]) => b.localeCompare(a));

    const visibleEntries = entries;

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
                    {(
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
        </div>
    );
}
