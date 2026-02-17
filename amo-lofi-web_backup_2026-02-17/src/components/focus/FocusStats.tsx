import { useFocusStore } from '../../store/useFocusStore';
import { formatDuration } from '../../utils/formatTime';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { Brain, CheckCircle2, TrendingUp } from 'lucide-react';
import { FocusHeatmap } from './FocusHeatmap';

export function FocusStats() {
    const icons = useSceneIcons();
    const stats = useFocusStore((s) => s.stats);
    const pomodoroCount = useFocusStore((s) => s.pomodoroCount);
    const tasks = useFocusStore((s) => s.tasks);

    const completedTasks = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length;

    const tc = 'var(--theme-primary)';

    // Streak milestone
    const milestones = [3, 7, 14, 30, 60, 100];
    const nextMilestone = milestones.find((m) => m > stats.dayStreak) ?? milestones[milestones.length - 1];
    const streakPct = Math.min(stats.dayStreak / nextMilestone, 1);

    return (
        <div className="space-y-6">

            {/* ═══════════════════════════════════════════════
                STREAK HERO
            ═══════════════════════════════════════════════ */}
            <div
                className="rounded-2xl p-6 relative overflow-hidden"
                style={{
                    background: stats.dayStreak > 0
                        ? `linear-gradient(135deg,
                            color-mix(in srgb, ${tc} 20%, rgba(0,0,0,0.3)),
                            color-mix(in srgb, ${tc} 6%, rgba(0,0,0,0.5)))`
                        : 'rgba(255,255,255,0.04)',
                    border: stats.dayStreak > 0
                        ? `1px solid color-mix(in srgb, ${tc} 20%, transparent)`
                        : '1px solid rgba(255,255,255,0.06)',
                }}
            >
                {stats.dayStreak > 0 && (
                    <div
                        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
                        style={{ background: tc }}
                    />
                )}

                <div className="relative flex items-center gap-5">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: stats.dayStreak > 0
                                ? `color-mix(in srgb, ${tc} 18%, transparent)`
                                : 'rgba(255,255,255,0.06)',
                        }}
                    >
                        <icons.ambience.fire size={32} style={{
                            color: stats.dayStreak > 0 ? tc : 'var(--theme-text-muted)',
                        }} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2.5">
                            <span className="mono text-4xl font-bold leading-none" style={{ color: tc }}>
                                {stats.dayStreak}
                            </span>
                            <span className="text-[15px] font-medium" style={{ color: 'var(--theme-text)' }}>
                                day streak
                            </span>
                        </div>

                        {stats.dayStreak > 0 ? (
                            <div className="mt-3">
                                <div className="flex justify-between text-[11px] mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                                    <span>{stats.dayStreak} / {nextMilestone} days</span>
                                    <span>Best: {stats.bestDayStreak}</span>
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
                        ) : (
                            <div className="text-[13px] mt-1.5" style={{ color: 'var(--theme-text-muted)' }}>
                                Complete a focus session to start
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                STATS ROW — 4 metrics in a clean row
            ═══════════════════════════════════════════════ */}
            <div
                className="rounded-2xl overflow-hidden"
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <div className="grid grid-cols-4 divide-x divide-white/5">
                    {([
                        { label: 'Today', value: formatDuration(stats.todayMinutes), Icon: TrendingUp },
                        { label: 'Total', value: formatDuration(stats.totalFocusMinutes), Icon: icons.ui.timer },
                        { label: 'Sessions', value: String(stats.sessionsCompleted), Icon: Brain },
                        { label: 'Tasks', value: `${completedTasks}/${totalTasks}`, Icon: CheckCircle2 },
                    ] as const).map((item) => (
                        <div key={item.label} className="py-4 px-2 text-center">
                            <item.Icon size={16} style={{ color: tc, margin: '0 auto 8px' }} />
                            <div className="mono text-[17px] font-bold leading-tight" style={{ color: tc }}>
                                {item.value}
                            </div>
                            <div className="text-[11px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                ACTIVITY HEATMAP
            ═══════════════════════════════════════════════ */}
            <FocusHeatmap />

            {/* ═══════════════════════════════════════════════
                POMODORO CYCLE
            ═══════════════════════════════════════════════ */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>
                        Pomodoro Cycle
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
                                className="flex-1 h-3 rounded-full overflow-hidden"
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
                <div className="text-[12px] mt-2 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                    {4 - (pomodoroCount % 4)} more until long break
                </div>
            </div>
        </div>
    );
}
