import { useMemo, useEffect, useState } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatDuration } from '../../utils/formatTime';
import { useTranslation } from '../../hooks/useTranslation';
import { FocusHeatmap } from './FocusHeatmap';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { BarChart3, TrendingUp, Clock, Zap, Calendar, X } from 'lucide-react';

/**
 * StatsDashboard — V8: Futuristic Glassmorphism.
 * Deep Purple aesthetic, neon glow, glassmorphism cards.
 * Theme-synced via --theme-primary.
 */

interface Props { onClose: () => void }
type View = 'overview' | 'weekly' | 'hours' | 'today' | 'activity';

/* ── Read --theme-primary ── */
function useThemeColor(): string {
    const [c, setC] = useState('#a78bfa');
    useEffect(() => {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim();
        if (v) setC(v);
    }, []);
    return c;
}

/* ── Muted text color (theme-aware gray-purple) ── */
const MUTED = '#928FB0';

/* ── Neon SVG Defs (multi-layer glow) ── */
function NeonDefs({ tc, id }: { tc: string; id: string }) {
    return (
        <defs>
            <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="b3" />
                <feMerge><feMergeNode in="b3" /><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tc} stopOpacity="0.18" /><stop offset="100%" stopColor={tc} stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={tc} /><stop offset="100%" stopColor={tc} stopOpacity="0.6" />
            </linearGradient>
        </defs>
    );
}

/* ── Sparkline (mini chart in stat cards) ── */
function Sparkline({ data, color, h = 32 }: { data: number[]; color: string; h?: number }) {
    if (data.length < 2 || data.every(v => v === 0)) {
        return <svg width="100%" height={h}><line x1="0" y1={h / 2} x2="100%" y2={h / 2} stroke="rgba(255,255,255,0.03)" /></svg>;
    }
    const max = Math.max(...data, 1), step = 100 / (data.length - 1);
    const pts = data.map((v, i) => ({ x: i * step, y: 2 + (h - 4) * (1 - v / max) }));
    let line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) line += ` Q ${(pts[i - 1].x + pts[i].x) / 2} ${pts[i - 1].y} ${pts[i].x} ${pts[i].y}`;
    const area = line + ` L 100 ${h} L 0 ${h} Z`;
    const gid = `sp${color.replace(/\W/g, '')}`;
    return (
        <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="block">
            <defs>
                <filter id={`${gid}-gl`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} /><path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" filter={`url(#${gid}-gl)`} />
        </svg>
    );
}

/* ══════════════════════
   VIEW: OVERVIEW
   ══════════════════════ */
function OverviewView({ stats, tc, spark, completedTasks, totalTasks, perfScore }: {
    stats: any; tc: string; spark: number[]; completedTasks: number; totalTasks: number; perfScore: number;
}) {
    const avgDur = stats.sessionsCompleted > 0 ? Math.round(stats.totalFocusMinutes / stats.sessionsCompleted) : 0;
    const r = 58, circ = 2 * Math.PI * r, offset = circ * (1 - Math.min(perfScore / 100, 1));
    const CARDS = [
        { label: 'Sessions', val: String(stats.sessionsCompleted), sub: 'completed' },
        { label: 'Focus', val: formatDuration(stats.totalFocusMinutes), sub: 'total time' },
        { label: 'Average', val: avgDur > 0 ? `${avgDur}m` : '—', sub: 'per session' },
        { label: 'Streak', val: `${stats.dayStreak}d`, sub: `best ${stats.bestDayStreak}d` },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Performance gauge — glassmorphism hero card */}
            <div className="dash-card" style={{ padding: '44px 36px', display: 'flex', alignItems: 'center', gap: 52, justifyContent: 'center' }}>
                {/* Gauge */}
                <div className="relative flex items-center justify-center" style={{ width: 220, height: 220, flexShrink: 0 }}>
                    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                        <NeonDefs tc={tc} id="g" />
                        {/* Decorative orbit rings */}
                        <circle cx="100" cy="100" r="96" fill="none" stroke={tc} strokeOpacity="0.04" strokeWidth="0.5" />
                        <circle cx="100" cy="100" r="96" fill="none" stroke={tc} strokeOpacity="0.12" strokeWidth="0.7"
                            strokeDasharray="4 14" filter="url(#g-glow)"
                            className="animate-[spin_30s_linear_infinite]" style={{ transformOrigin: '100px 100px' }} />
                        <circle cx="100" cy="100" r="86" fill="none" stroke={tc} strokeOpacity="0.03" strokeWidth="0.5" />
                        {/* Orbiting dots */}
                        <circle cx="196" cy="100" r="2.5" fill={tc} opacity="0.5" filter="url(#g-glow)"
                            className="animate-[spin_20s_linear_infinite]" style={{ transformOrigin: '100px 100px' }} />
                        <circle cx="4" cy="100" r="1.5" fill={tc} opacity="0.25"
                            className="animate-[spin_25s_linear_infinite_reverse]" style={{ transformOrigin: '100px 100px' }} />
                        {/* Track */}
                        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"
                            className="-rotate-90" style={{ transformOrigin: '100px 100px' }} />
                        {/* Progress arc */}
                        <circle cx="100" cy="100" r={r} fill="none" stroke={tc} strokeWidth="8"
                            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                            filter="url(#g-glow)"
                            className="-rotate-90 transition-[stroke-dashoffset] duration-1000 ease-out"
                            style={{ transformOrigin: '100px 100px' }} />
                        <circle cx="100" cy="100" r="44" fill="none" stroke={tc} strokeOpacity="0.04" strokeWidth="0.5" />
                    </svg>
                    <div className="relative flex flex-col items-center">
                        <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 44, fontWeight: 700, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em' }}>
                            {perfScore}<span style={{ fontSize: 24, fontWeight: 400, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>%</span>
                        </span>
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: MUTED, letterSpacing: '0.14em', marginTop: 10, textTransform: 'uppercase' as const }}>
                            Performance
                        </span>
                    </div>
                </div>

                {/* Right side stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div style={{ display: 'flex', gap: 36 }}>
                        <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, color: '#fff' }}>{stats.sessionsCompleted}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>Sessions</div>
                        </div>
                        <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, color: '#fff' }}>{formatDuration(stats.totalFocusMinutes)}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>Focus Time</div>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 1, background: `color-mix(in srgb, ${tc} 10%, transparent)` }} />
                    <div style={{ display: 'flex', gap: 36 }}>
                        <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, color: '#fff' }}>{completedTasks}/{totalTasks}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>Tasks Done</div>
                        </div>
                        <div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 30, fontWeight: 700, color: '#fff' }}>{stats.dayStreak}d</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>Day Streak</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat cards row */}
            <div className="dash-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {CARDS.map(c => (
                    <div key={c.label} className="dash-card animate-dash-in group hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-300"
                        style={{ padding: '22px 22px 14px', position: 'relative', overflow: 'hidden' }}>
                        {/* Hover glow blob */}
                        <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                            style={{ background: tc }} />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{c.label}</div>
                            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 28, fontWeight: 700, color: '#fff', marginTop: 8, lineHeight: 1, letterSpacing: '-0.02em' }}>{c.val}</div>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(146,143,176,0.6)', marginTop: 5 }}>{c.sub}</div>
                        </div>
                        <div style={{ marginTop: 12, marginLeft: -8, marginRight: -8, marginBottom: -8 }}>
                            <Sparkline data={spark} color={tc} h={28} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ══════════════════════
   VIEW: WEEKLY
   ══════════════════════ */
function WeeklyView({ data, maxVal, tc, title }: { data: { key: string; value: number }[]; maxVal: number; tc: string; title: string }) {
    const W = 700, H = 300, PL = 36, PR = 30, PT = 24, PB = 44;
    const plotW = W - PL - PR, plotH = H - PT - PB;
    const step = plotW / (data.length - 1);
    const pts = data.map((d, i) => ({ x: PL + i * step, y: PT + plotH * (1 - d.value / Math.max(maxVal, 1)) }));
    let line = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) line += ` Q ${(pts[i - 1].x + pts[i].x) / 2} ${pts[i - 1].y} ${pts[i].x} ${pts[i].y}`;
    const area = line + ` L ${PL + plotW} ${PT + plotH} L ${PL} ${PT + plotH} Z`;
    const totalMin = data.reduce((a, d) => a + d.value, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="dash-card" style={{ padding: '32px 36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{title}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: MUTED }}>
                        Total: {formatDuration(totalMin)}
                    </span>
                </div>
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block overflow-visible">
                    <NeonDefs tc={tc} id="wk" />
                    {/* Y-axis guide lines — minimalist */}
                    {[.25, .5, .75, 1].map(p => (
                        <g key={p}>
                            <line x1={PL} y1={PT + plotH * (1 - p)} x2={PL + plotW} y2={PT + plotH * (1 - p)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="4 8" />
                            <text x={PL - 10} y={PT + plotH * (1 - p) + 4} textAnchor="end" fill={MUTED} fontSize="10" fontFamily="Inter, sans-serif" opacity="0.6">
                                {Math.round(maxVal * p)}m
                            </text>
                        </g>
                    ))}
                    {/* Area fill */}
                    <path d={area} fill="url(#wk-fill)" />
                    {/* Line with glow */}
                    <path d={line} fill="none" stroke={tc} strokeWidth="3" strokeLinecap="round" filter="url(#wk-glow)" />
                    {/* Data points */}
                    {pts.map((p, i) => (
                        <g key={i}>
                            {data[i].value > 0 && <circle cx={p.x} cy={p.y} r="10" fill={tc} opacity="0.08" />}
                            <circle cx={p.x} cy={p.y} r="5" fill="#120E2E" stroke={tc} strokeWidth="2.5" />
                        </g>
                    ))}
                    {/* Labels */}
                    {data.map((d, i) => (
                        <g key={d.key}>
                            <text x={pts[i].x} y={H - 10} textAnchor="middle"
                                fill={MUTED} fontSize="12" fontFamily="Inter, sans-serif">{d.key}</text>
                            {d.value > 0 && <text x={pts[i].x} y={pts[i].y - 16} textAnchor="middle"
                                fill="rgba(255,255,255,0.55)" fontSize="11" fontFamily="Sora, sans-serif" fontWeight="600">{formatDuration(d.value)}</text>}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
}

/* ══════════════════════
   VIEW: PEAK HOURS
   ══════════════════════ */
function HoursView({ data, maxVal, tc, title }: { data: { key: string; value: number }[]; maxVal: number; tc: string; title: string }) {
    return (
        <div className="dash-card" style={{ padding: '32px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{title}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: MUTED }}>24 hours</span>
            </div>
            {/* Full-width bars */}
            <div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {data.map(d => {
                    const pct = d.value > 0 ? Math.max((d.value / maxVal) * 100, 4) : 0;
                    return (
                        <div key={d.key} className="group" style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', position: 'relative', cursor: 'default' }}>
                            {/* Hover tooltip */}
                            {d.value > 0 && <div className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{
                                bottom: `calc(${pct}% + 14px)`, fontFamily: 'Sora, sans-serif', fontSize: 11, fontWeight: 600, color: tc, whiteSpace: 'nowrap',
                                textShadow: `0 0 8px ${tc}`,
                            }}>{d.value}m</div>}
                            {/* Glow dot at top */}
                            {d.value > 0 && <div style={{
                                position: 'absolute', bottom: `${pct}%`, left: '50%', transform: 'translate(-50%, 50%)',
                                width: 8, height: 8, borderRadius: '50%', background: tc,
                                boxShadow: `0 0 10px ${tc}, 0 0 24px ${tc}`, opacity: 0.5,
                            }} />}
                            {/* Bar */}
                            <div style={{
                                width: '100%', height: pct > 0 ? `${pct}%` : 1, borderRadius: '6px 6px 0 0',
                                background: pct > 0 ? `linear-gradient(to top, color-mix(in srgb, ${tc} 10%, transparent), color-mix(in srgb, ${tc} 55%, transparent))` : 'rgba(255,255,255,0.02)',
                                boxShadow: pct > 0 ? `0 0 20px color-mix(in srgb, ${tc} 10%, transparent)` : 'none',
                                transition: 'height 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                            }} />
                        </div>
                    );
                })}
            </div>
            {/* Hour labels */}
            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                {data.map((d, i) => (
                    <div key={d.key} style={{ flex: 1, textAlign: 'center' }}>
                        {(i % 3 === 0 || i === 23) && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: MUTED, opacity: 0.6 }}>{d.key}h</span>}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ══════════════════════
   VIEW: TODAY
   ══════════════════════ */
function TodayView({ stats, tc, completedTasks, totalTasks, pomodoroCount }: {
    stats: any; tc: string; completedTasks: number; totalTasks: number; pomodoroCount: number;
}) {
    const milestones = [3, 7, 14, 30, 60, 100];
    const nextMS = milestones.find(m => m > stats.dayStreak) ?? 100;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Big stat cards */}
            <div className="dash-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                    { l: 'Focus Time', v: formatDuration(stats.todayMinutes), icon: '⏱' },
                    { l: 'Tasks Done', v: `${completedTasks}/${totalTasks}`, icon: '✓' },
                    { l: 'Day Streak', v: `${stats.dayStreak}/${nextMS}`, icon: '🔥' },
                ].map(s => (
                    <div key={s.l} className="dash-card animate-dash-in" style={{ padding: '36px 28px', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, marginBottom: 14, filter: `drop-shadow(0 0 6px ${tc})` }}>{s.icon}</div>
                        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 38, fontWeight: 700, color: tc, lineHeight: 1, textShadow: `0 0 20px color-mix(in srgb, ${tc} 25%, transparent)` }}>{s.v}</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: MUTED, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s.l}</div>
                    </div>
                ))}
            </div>

            {/* Pomodoro section */}
            <div className="dash-card" style={{ padding: '32px 36px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Pomodoro Cycle</span>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 700, color: tc, textShadow: `0 0 12px color-mix(in srgb, ${tc} 30%, transparent)` }}>#{pomodoroCount}</span>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                    {Array.from({ length: 4 }).map((_, i) => {
                        const filled = i < (pomodoroCount % 4);
                        return (
                            <div key={i} style={{ flex: 1, height: 10, borderRadius: 99, overflow: 'hidden', background: `color-mix(in srgb, ${tc} 7%, transparent)` }}>
                                <div style={{
                                    width: filled ? '100%' : 0, height: '100%', borderRadius: 99,
                                    background: filled ? `linear-gradient(90deg, color-mix(in srgb, ${tc} 20%, transparent), ${tc})` : 'transparent',
                                    boxShadow: filled ? `0 0 14px color-mix(in srgb, ${tc} 35%, transparent)` : 'none',
                                    transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                                }} />
                            </div>
                        );
                    })}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: MUTED, opacity: 0.6, marginTop: 14 }}>
                    {4 - (pomodoroCount % 4)} more until long break
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════
   VIEW: ACTIVITY
   ══════════════════════ */
function ActivityView() {
    return (
        <div className="dash-card" style={{ padding: '32px 36px' }}>
            <FocusHeatmap />
        </div>
    );
}

/* ══════════════════════════════════════
   MAIN DASHBOARD — SIDEBAR + CONTENT
   ══════════════════════════════════════ */
const TAB_DEFS: { id: View; fallbackIcon: any; label: string; iconKey: string }[] = [
    { id: 'overview', fallbackIcon: BarChart3, label: 'Overview', iconKey: 'dashOverview' },
    { id: 'weekly', fallbackIcon: TrendingUp, label: 'This Week', iconKey: 'dashWeekly' },
    { id: 'hours', fallbackIcon: Clock, label: 'Peak Hours', iconKey: 'dashHours' },
    { id: 'today', fallbackIcon: Zap, label: 'Today', iconKey: 'dashToday' },
    { id: 'activity', fallbackIcon: Calendar, label: 'Activity', iconKey: 'dashActivity' },
];

export function StatsDashboard({ onClose }: Props) {
    const { t } = useTranslation();
    const tc = useThemeColor();
    const icons = useSceneIcons();
    const stats = useFocusStore(s => s.stats);
    const pomodoroCount = useFocusStore(s => s.pomodoroCount);
    const tasks = useFocusStore(s => s.tasks);
    const completedTasks = tasks.filter(tk => tk.completed).length;
    const totalTasks = tasks.length;
    const [activeView, setActiveView] = useState<View>('overview');

    const perfScore = useMemo(() => {
        const a = Math.min(stats.dayStreak * 5, 30);
        const b = Math.min(stats.sessionsCompleted * 3, 30);
        const c = Math.min(stats.todayMinutes / 1.2, 25);
        const d = totalTasks > 0 ? (completedTasks / totalTasks) * 15 : 0;
        return Math.round(Math.min(a + b + c + d, 100));
    }, [stats, completedTasks, totalTasks]);

    const weekData = useMemo(() => {
        const now = new Date();
        return Array.from({ length: 7 }, (_, idx) => {
            const d = new Date(now); d.setDate(d.getDate() - (6 - idx));
            return { key: d.toLocaleDateString('en-US', { weekday: 'short' }), value: stats.focusHistory[d.toISOString().slice(0, 10)] ?? 0 };
        });
    }, [stats.focusHistory]);
    const weekMax = Math.max(...weekData.map(d => d.value), 1);
    const spark = useMemo(() => weekData.map(d => d.value), [weekData]);

    const hourData = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => ({ key: String(i).padStart(2, '0'), value: stats.hourlyHistory[String(i)] ?? 0 })),
        [stats.hourlyHistory]);
    const hourMax = Math.max(...hourData.map(d => d.value), 1);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            {/* Backdrop — tinted with theme color */}
            <div className="absolute inset-0 backdrop-blur-sm" style={{ background: `color-mix(in srgb, ${tc} 8%, rgba(10,10,20,0.35))` }} />

            <div
                className="relative animate-dash-in flex"
                style={{
                    width: 940, maxWidth: '95vw', height: 620, maxHeight: '88vh',
                    background: `linear-gradient(160deg, color-mix(in srgb, ${tc} 25%, rgba(10,10,20,0.5)) 0%, color-mix(in srgb, ${tc} 15%, rgba(10,10,20,0.55)) 50%, color-mix(in srgb, ${tc} 8%, rgba(8,6,15,0.6)) 100%)`,
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    border: `1px solid color-mix(in srgb, ${tc} 14%, transparent)`,
                    borderRadius: 28,
                    boxShadow: `0 0 140px color-mix(in srgb, ${tc} 6%, transparent), 0 28px 90px rgba(0,0,0,0.8)`,
                    overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Ambient glow blobs */}
                <div className="absolute top-0 left-1/3 w-96 h-64 rounded-full blur-[140px] pointer-events-none"
                    style={{ background: tc, opacity: 0.04, animation: 'neonPulse 6s ease-in-out infinite' }} />
                <div className="absolute bottom-0 right-1/4 w-72 h-52 rounded-full blur-[120px] pointer-events-none"
                    style={{ background: tc, opacity: 0.03, animation: 'neonPulse 8s ease-in-out infinite 2s' }} />

                {/* ── SIDEBAR ── */}
                <div className="relative flex flex-col items-center py-7 shrink-0" style={{
                    width: 72,
                    borderRight: `1px solid color-mix(in srgb, ${tc} 8%, transparent)`,
                    background: `linear-gradient(180deg, color-mix(in srgb, ${tc} 18%, rgba(10,10,20,0.35)) 0%, color-mix(in srgb, ${tc} 10%, rgba(10,8,18,0.4)) 100%)`,
                    backdropFilter: 'blur(20px)',
                }}>
                    {TAB_DEFS.map(tab => {
                        const active = activeView === tab.id;
                        const Icon = (icons.ui as any)[tab.iconKey] ?? tab.fallbackIcon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveView(tab.id)}
                                className="relative flex items-center justify-center transition-all duration-200 cursor-pointer"
                                style={{
                                    width: 46, height: 46, borderRadius: 14, marginBottom: 8,
                                    background: active ? `color-mix(in srgb, ${tc} 14%, transparent)` : 'transparent',
                                    border: 'none',
                                }}
                                title={tab.label}
                            >
                                {/* Active neon indicator bar */}
                                {active && <div className="absolute left-0 w-[3px] rounded-r-full" style={{
                                    height: 26, background: tc,
                                    boxShadow: `0 0 10px ${tc}, 0 0 20px ${tc}`,
                                }} />}
                                <Icon size={20} style={{ color: active ? tc : 'rgba(255,255,255,0.22)', transition: 'color 0.2s', filter: active ? `drop-shadow(0 0 6px ${tc})` : 'none' }} />
                            </button>
                        );
                    })}

                    {/* Close at bottom */}
                    <div className="mt-auto">
                        <button onClick={onClose} className="flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-white/5"
                            style={{ width: 46, height: 46, borderRadius: 14, border: 'none', background: 'transparent' }}>
                            <X size={18} style={{ color: 'rgba(255,255,255,0.18)' }} />
                        </button>
                    </div>
                </div>

                {/* ── CONTENT AREA ── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative" style={{ padding: '32px 36px' }}>
                    {/* View title */}
                    <div style={{ marginBottom: 28 }}>
                        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.93)', letterSpacing: '-0.01em', margin: 0 }}>
                            {TAB_DEFS.find(t => t.id === activeView)?.label}
                        </h2>
                    </div>

                    {/* Render active view */}
                    <div className="animate-dash-in" key={activeView}>
                        {activeView === 'overview' && <OverviewView stats={stats} tc={tc} spark={spark} completedTasks={completedTasks} totalTasks={totalTasks} perfScore={perfScore} />}
                        {activeView === 'weekly' && <WeeklyView data={weekData} maxVal={weekMax} tc={tc} title={t('stats.thisWeek')} />}
                        {activeView === 'hours' && <HoursView data={hourData} maxVal={hourMax} tc={tc} title={t('stats.peakHours')} />}
                        {activeView === 'today' && <TodayView stats={stats} tc={tc} completedTasks={completedTasks} totalTasks={totalTasks} pomodoroCount={pomodoroCount} />}
                        {activeView === 'activity' && <ActivityView />}
                    </div>
                </div>
            </div>
        </div>
    );
}
