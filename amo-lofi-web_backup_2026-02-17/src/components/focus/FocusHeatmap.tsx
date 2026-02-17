import { useMemo, useState } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatDuration } from '../../utils/formatTime';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * FocusHeatmap — GitHub-style activity grid showing daily focus minutes.
 * Displays last 13 weeks (91 days). Rows = Mon–Sun, columns = weeks.
 * Sized to fill 480px panel width.
 */

const WEEKS = 13;
const DAYS = WEEKS * 7;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function generateDates(): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = DAYS - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

function getLevel(minutes: number): number {
    if (minutes === 0) return 0;
    if (minutes <= 15) return 1;
    if (minutes <= 45) return 2;
    if (minutes <= 90) return 3;
    return 4;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Sizing: fill ~410px available (480 - 40 padding - 32 card padding)
const CELL = 22;
const GAP = 4;
const LABEL_W = 32;
const HEADER_H = 18;

export function FocusHeatmap() {
    const { t } = useTranslation();
    const focusHistory = useFocusStore((s) => s.stats.focusHistory);
    const [tooltip, setTooltip] = useState<{ date: string; minutes: number; x: number; y: number } | null>(null);

    const { grid, monthLabels, totalActive } = useMemo(() => {
        const dates = generateDates();

        const firstDate = new Date(dates[0] + 'T12:00:00');
        const firstDow = (firstDate.getDay() + 6) % 7;
        const padded: (string | null)[] = Array(firstDow).fill(null).concat(dates);

        const grid: (string | null)[][] = [];
        for (let w = 0; w < Math.ceil(padded.length / 7); w++) {
            const week: (string | null)[] = [];
            for (let d = 0; d < 7; d++) {
                week.push(padded[w * 7 + d] ?? null);
            }
            grid.push(week);
        }

        const monthLabels: { label: string; col: number }[] = [];
        let lastMonth = '';
        grid.forEach((week, colIdx) => {
            const firstValid = week.find((d) => d !== null);
            if (!firstValid) return;
            const month = new Date(firstValid + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
            if (month !== lastMonth) {
                monthLabels.push({ label: month, col: colIdx });
                lastMonth = month;
            }
        });

        let totalActive = 0;
        for (const date of dates) {
            if ((focusHistory[date] ?? 0) > 0) totalActive++;
        }

        return { grid, monthLabels, totalActive };
    }, [focusHistory]);

    const gridW = grid.length * (CELL + GAP);
    const gridH = 7 * (CELL + GAP);
    const svgW = LABEL_W + gridW + 4;
    const svgH = HEADER_H + gridH + 2;

    return (
        <div>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-3">
                <h4 className="text-[15px] font-semibold" style={{ color: 'var(--theme-text)' }}>
                    {t('heatmap.activity')}
                </h4>
                <span className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
                    {t('heatmap.activeDays', totalActive, totalActive === 1 ? t('heatmap.day') : t('heatmap.days'))}
                </span>
            </div>

            {/* Heatmap Card */}
            <div
                className="rounded-xl px-4 pt-3 pb-3 relative"
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <div className="relative overflow-x-auto custom-scrollbar">
                    <svg width={svgW} height={svgH} className="block mx-auto">
                        {/* Month labels */}
                        {monthLabels.map((m) => (
                            <text
                                key={m.label + m.col}
                                x={LABEL_W + m.col * (CELL + GAP) + CELL / 2}
                                y={12}
                                fontSize={10}
                                fill="var(--theme-text-muted)"
                                opacity={0.6}
                                textAnchor="middle"
                            >
                                {m.label}
                            </text>
                        ))}

                        {/* Day labels */}
                        {DAY_LABELS.map((label, i) =>
                            label ? (
                                <text
                                    key={i}
                                    x={LABEL_W - 6}
                                    y={HEADER_H + i * (CELL + GAP) + CELL / 2 + 4}
                                    fontSize={10}
                                    fill="var(--theme-text-muted)"
                                    opacity={0.45}
                                    textAnchor="end"
                                >
                                    {label}
                                </text>
                            ) : null,
                        )}

                        {/* Cells */}
                        {grid.map((week, colIdx) =>
                            week.map((date, rowIdx) => {
                                if (!date) return null;
                                const minutes = focusHistory[date] ?? 0;
                                const level = getLevel(minutes);
                                const x = LABEL_W + colIdx * (CELL + GAP);
                                const y = HEADER_H + rowIdx * (CELL + GAP);

                                return (
                                    <rect
                                        key={date}
                                        x={x}
                                        y={y}
                                        width={CELL}
                                        height={CELL}
                                        rx={4}
                                        fill={
                                            level === 0
                                                ? 'rgba(255,255,255,0.05)'
                                                : `color-mix(in srgb, var(--theme-primary) ${20 + level * 20}%, transparent)`
                                        }
                                        className="cursor-pointer transition-[fill] duration-150"
                                        onMouseEnter={(e) => {
                                            const rect = (e.target as SVGRectElement).getBoundingClientRect();
                                            const parent = (e.target as SVGRectElement).closest('.relative')!.getBoundingClientRect();
                                            setTooltip({
                                                date,
                                                minutes,
                                                x: rect.left - parent.left + CELL / 2,
                                                y: rect.top - parent.top - 6,
                                            });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                );
                            }),
                        )}
                    </svg>

                    {/* Tooltip */}
                    {tooltip && (
                        <div
                            className="absolute pointer-events-none px-3 py-2 rounded-lg text-[11px] whitespace-nowrap z-10"
                            style={{
                                left: tooltip.x,
                                top: tooltip.y,
                                transform: 'translate(-50%, -100%)',
                                background: 'rgba(0,0,0,0.9)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'white',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                            }}
                        >
                            <span className="font-medium" style={{ color: 'var(--theme-primary)' }}>
                                {tooltip.minutes > 0 ? formatDuration(tooltip.minutes) : t('heatmap.noActivity')}
                            </span>
                            <span style={{ opacity: 0.5 }}>{' '}— {formatDate(tooltip.date)}</span>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-2.5">
                    <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }}>{t('heatmap.less')}</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                        <div
                            key={level}
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: 3,
                                background: level === 0
                                    ? 'rgba(255,255,255,0.05)'
                                    : `color-mix(in srgb, var(--theme-primary) ${20 + level * 20}%, transparent)`,
                            }}
                        />
                    ))}
                    <span className="text-[10px]" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }}>{t('heatmap.more')}</span>
                </div>
            </div>
        </div>
    );
}
