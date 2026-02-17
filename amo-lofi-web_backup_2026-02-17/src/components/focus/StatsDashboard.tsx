import { useMemo } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatDuration } from '../../utils/formatTime';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';
import { Brain, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { FocusHeatmap } from './FocusHeatmap';

/**
 * StatsDashboard — Beeziee-inspired large centered modal overlay.
 * Shows productivity report with premium stat cards, heatmap,
 * time distribution, and peak hours charts.
 */

interface Props {
    onClose: () => void;
}

// ── Peak Hours bar chart (0–23h) ──
function PeakHoursChart({ hourlyHistory, peakHoursLabel }: { hourlyHistory: Record<string, number>; peakHoursLabel: string }) {
    const tc = 'var(--theme-primary)';

    const data = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            count: hourlyHistory[String(i)] ?? 0,
        }));
        return hours;
    }, [hourlyHistory]);

    const maxCount = Math.max(...data.map((d) => d.count), 1);

    // Labels every 4 hours
    const LABELS = [0, 4, 8, 12, 16, 20];

    return (
        <div>
            <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
                {peakHoursLabel}
            </h4>
            <div className="flex items-end gap-[3px]" style={{ height: 100 }}>
                {data.map((d) => (
                    <div key={d.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                            className="w-full rounded-t-sm transition-all duration-300 min-h-[2px]"
                            style={{
                                height: d.count > 0 ? `${Math.max((d.count / maxCount) * 100, 8)}%` : '2px',
                                background: d.count > 0 ? tc : 'rgba(255,255,255,0.06)',
                                boxShadow: d.count > 0 ? `0 0 6px color-mix(in srgb, ${tc} 30%, transparent)` : 'none',
                                opacity: d.count > 0 ? 0.6 + (d.count / maxCount) * 0.4 : 1,
                            }}
                            title={`${d.hour}:00 — ${d.count} session${d.count !== 1 ? 's' : ''}`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex mt-2">
                {data.map((d) => (
                    <div key={d.hour} className="flex-1 text-center">
                        {LABELS.includes(d.hour) && (
                            <span className="text-[9px]" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}>
                                {String(d.hour).padStart(2, '0')}:00
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Time Distribution (last 7 days bar chart) ──
function TimeDistributionChart({ focusHistory, thisWeekLabel }: { focusHistory: Record<string, number>; thisWeekLabel: string }) {
    const tc = 'var(--theme-primary)';

    const data = useMemo(() => {
        const days: { label: string; minutes: number; dateStr: string }[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            days.push({
                label: dayName,
                minutes: focusHistory[dateStr] ?? 0,
                dateStr,
            });
        }
        return days;
    }, [focusHistory]);

    const maxMinutes = Math.max(...data.map((d) => d.minutes), 1);

    return (
        <div>
            <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
                {thisWeekLabel}
            </h4>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
                {data.map((d) => (
                    <div key={d.dateStr} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                        <div
                            className="w-full rounded-t transition-all duration-300 min-h-[2px]"
                            style={{
                                height: d.minutes > 0 ? `${Math.max((d.minutes / maxMinutes) * 100, 8)}%` : '2px',
                                background: d.minutes > 0 ? tc : 'rgba(255,255,255,0.06)',
                                boxShadow: d.minutes > 0 ? `0 0 8px color-mix(in srgb, ${tc} 30%, transparent)` : 'none',
                                opacity: d.minutes > 0 ? 0.6 + (d.minutes / maxMinutes) * 0.4 : 1,
                                borderRadius: '4px 4px 0 0',
                            }}
                            title={`${d.label} — ${formatDuration(d.minutes)}`}
                        />
                    </div>
                ))}
            </div>
            <div className="flex gap-2 mt-2">
                {data.map((d) => (
                    <div key={d.dateStr} className="flex-1 text-center">
                        <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}>
                            {d.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Dashboard ──
export function StatsDashboard({ onClose }: Props) {
    const icons = useSceneIcons();
    const { t } = useTranslation();
    const stats = useFocusStore((s) => s.stats);
    const pomodoroCount = useFocusStore((s) => s.pomodoroCount);
    const tasks = useFocusStore((s) => s.tasks);

    const completedTasks = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length;
    const tc = 'var(--theme-primary)';

    // Avg duration per session
    const avgDuration = stats.sessionsCompleted > 0
        ? Math.round(stats.totalFocusMinutes / stats.sessionsCompleted)
        : 0;

    // Streak milestone
    const milestones = [3, 7, 14, 30, 60, 100];
    const nextMilestone = milestones.find((m) => m > stats.dayStreak) ?? milestones[milestones.length - 1];
    const streakPct = Math.min(stats.dayStreak / nextMilestone, 1);

    const STAT_CARDS = [
        {
            label: t('stats.totalSessions'),
            value: String(stats.sessionsCompleted),
            sub: t('stats.sessionsCompleted'),
            Icon: TrendingUp,
        },
        {
            label: t('stats.totalFocusTime'),
            value: formatDuration(stats.totalFocusMinutes),
            sub: t('stats.totalTime'),
            Icon: Clock,
        },
        {
            label: t('stats.avgDuration'),
            value: avgDuration > 0 ? `${avgDuration}m` : '0m',
            sub: t('stats.perSession'),
            Icon: Brain,
        },
        {
            label: t('stats.dayStreak'),
            value: `${stats.dayStreak}`,
            sub: t('stats.bestDays', stats.bestDayStreak),
            Icon: icons.ambience.fire,
        },
    ] as const;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-[920px] max-w-[92vw] max-h-[88vh] overflow-y-auto custom-scrollbar rounded-2xl animate-panel-in"
                style={{
                    background: 'var(--theme-panel-bg)',
                    border: '1px solid var(--theme-panel-border)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(32px) saturate(1.4)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between px-8 pt-7 pb-5">
                    <div />
                    <div className="flex items-center gap-3">
                        <TrendingUp size={22} style={{ color: tc }} />
                        <h2 className="text-xl font-bold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                            {t('stats.title')}
                        </h2>
                    </div>
                    <button
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={onClose}
                    >
                        <icons.ui.close size={16} style={{ color: 'var(--theme-text-muted)' }} />
                    </button>
                </div>

                <div className="px-8 pb-8 space-y-6">

                    {/* ═══ Stat Cards Row ═══ */}
                    <div className="grid grid-cols-4 gap-3">
                        {STAT_CARDS.map((card) => (
                            <div
                                key={card.label}
                                className="rounded-xl p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.02]"
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                {/* Subtle glow on hover */}
                                <div
                                    className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                                    style={{ background: tc }}
                                />

                                <div className="relative">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                                        style={{
                                            background: `color-mix(in srgb, ${tc} 12%, transparent)`,
                                            border: `1px solid color-mix(in srgb, ${tc} 15%, transparent)`,
                                        }}
                                    >
                                        <card.Icon size={20} style={{ color: tc }} />
                                    </div>

                                    <div className="text-[11px] font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                                        {card.label}
                                    </div>

                                    <div className="mono text-2xl font-bold leading-none" style={{ color: 'var(--theme-text)' }}>
                                        {card.value}
                                    </div>

                                    <div className="text-[11px] mt-2" style={{ color: 'var(--theme-text-muted)', opacity: 0.7 }}>
                                        {card.sub}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ═══ Streak Progress ═══ */}
                    {stats.dayStreak > 0 && (
                        <div
                            className="rounded-xl p-5 relative overflow-hidden"
                            style={{
                                background: `linear-gradient(135deg,
                                    color-mix(in srgb, ${tc} 15%, rgba(0,0,0,0.3)),
                                    color-mix(in srgb, ${tc} 5%, rgba(0,0,0,0.4)))`,
                                border: `1px solid color-mix(in srgb, ${tc} 18%, transparent)`,
                            }}
                        >
                            <div
                                className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-15"
                                style={{ background: tc }}
                            />
                            <div className="relative flex items-center gap-5">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                                    style={{ background: `color-mix(in srgb, ${tc} 18%, transparent)` }}
                                >
                                    <icons.ambience.fire size={28} style={{ color: tc }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2.5">
                                        <span className="mono text-3xl font-bold leading-none" style={{ color: tc }}>
                                            {stats.dayStreak}
                                        </span>
                                        <span className="text-[14px] font-medium" style={{ color: 'var(--theme-text)' }}>
                                            {t('stats.dayStreakLabel')}
                                        </span>
                                    </div>
                                    <div className="mt-3">
                                        <div className="flex justify-between text-[11px] mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                                            <span>{t('stats.days', stats.dayStreak, nextMilestone)}</span>
                                            <span>{t('stats.best', stats.bestDayStreak)}</span>
                                        </div>
                                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${streakPct * 100}%`,
                                                    background: tc,
                                                    boxShadow: `0 0 10px color-mix(in srgb, ${tc} 50%, transparent)`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ Charts Row: Time Distribution + Peak Hours ═══ */}
                    <div className="grid grid-cols-2 gap-4">
                        <div
                            className="rounded-xl p-5"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <TimeDistributionChart focusHistory={stats.focusHistory} thisWeekLabel={t('stats.thisWeek')} />
                        </div>
                        <div
                            className="rounded-xl p-5"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <PeakHoursChart hourlyHistory={stats.hourlyHistory} peakHoursLabel={t('stats.peakHours')} />
                        </div>
                    </div>

                    {/* ═══ Bottom Row: Heatmap + Today/Pomodoro ═══ */}
                    <div className="grid grid-cols-2 gap-4">

                        {/* Activity Heatmap */}
                        <div
                            className="rounded-xl p-5"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <FocusHeatmap />
                        </div>

                        {/* Right Column: Today + Pomodoro */}
                        <div className="space-y-4">

                            {/* Today's Summary */}
                            <div
                                className="rounded-xl p-5"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <h4 className="text-[13px] font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
                                    {t('stats.today')}
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="mono text-xl font-bold" style={{ color: tc }}>
                                            {formatDuration(stats.todayMinutes)}
                                        </div>
                                        <div className="text-[11px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                                            {t('stats.focusTime')}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 size={16} style={{ color: tc }} />
                                            <span className="mono text-xl font-bold" style={{ color: tc }}>
                                                {completedTasks}/{totalTasks}
                                            </span>
                                        </div>
                                        <div className="text-[11px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                                            {t('stats.tasksDone')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pomodoro Cycle */}
                            <div
                                className="rounded-xl p-5"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-[13px] font-semibold uppercase tracking-widest" style={{ color: 'var(--theme-text-muted)' }}>
                                        {t('stats.pomodoroCycle')}
                                    </h4>
                                    <span
                                        className="mono text-[13px] font-bold px-2.5 py-1 rounded-lg"
                                        style={{
                                            background: `color-mix(in srgb, ${tc} 12%, transparent)`,
                                            color: tc,
                                        }}
                                    >
                                        #{pomodoroCount}
                                    </span>
                                </div>
                                <div className="flex gap-2.5">
                                    {Array.from({ length: 4 }).map((_, i) => {
                                        const filled = i < (pomodoroCount % 4);
                                        return (
                                            <div
                                                key={i}
                                                className="flex-1 h-3.5 rounded-full overflow-hidden"
                                                style={{ background: 'rgba(255,255,255,0.06)' }}
                                            >
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: filled ? '100%' : '0%',
                                                        background: tc,
                                                        boxShadow: filled ? `0 0 10px color-mix(in srgb, ${tc} 50%, transparent)` : 'none',
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="text-[12px] mt-2.5 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                                    {t('stats.moreUntilLongBreak', 4 - (pomodoroCount % 4))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
