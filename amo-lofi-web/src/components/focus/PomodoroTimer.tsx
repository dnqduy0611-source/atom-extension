import { useEffect, useRef } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatTime } from '../../utils/formatTime';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';
import {
    RotateCcw,
    Brain, Coffee, Sparkles,
    PenLine,
    type LucideIcon,
} from 'lucide-react';

const MODE_CONFIG: Record<string, { labelKey: string; Icon: LucideIcon; color: string }> = {
    work: { labelKey: 'timer.focus', Icon: Brain, color: 'var(--theme-primary)' },
    shortBreak: { labelKey: 'timer.shortBreak', Icon: Coffee, color: '#60a5fa' },
    longBreak: { labelKey: 'timer.longBreak', Icon: Sparkles, color: '#a78bfa' },
};

const WORK_DURATIONS = [15, 25, 30, 45, 60];

export function PomodoroTimer() {
    const icons = useSceneIcons();
    const { t } = useTranslation();
    const {
        timerMode,
        timeRemaining,
        isTimerRunning,
        pomodoroCount,
        workDuration,
        startTimer,
        pauseTimer,
        resetTimer,
        skipTimer,
        tick,
        setWorkDuration,
        focusNotes,
        setFocusNotes,
    } = useFocusStore();

    // ── Timer tick ──
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    useEffect(() => {
        if (isTimerRunning) {
            intervalRef.current = setInterval(tick, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isTimerRunning, tick]);

    const mode = MODE_CONFIG[timerMode] ?? MODE_CONFIG.work;
    const totalDuration = timerMode === 'work' ? workDuration : timerMode === 'shortBreak' ? 5 * 60 : 15 * 60;
    const progress = totalDuration > 0 ? ((totalDuration - timeRemaining) / totalDuration) * 100 : 0;

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Mode badge */}
            <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2.5">
                    <mode.Icon size={20} style={{ color: mode.color }} />
                    <span className="text-base font-semibold tracking-wide" style={{ color: mode.color }}>
                        {t(mode.labelKey as any)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="w-2.5 h-2.5 rounded-full transition-colors"
                            style={{
                                backgroundColor: i <= (pomodoroCount % 4) ? 'var(--theme-primary)' : 'rgba(255,255,255,0.1)',
                                boxShadow: i <= (pomodoroCount % 4) ? '0 0 6px var(--theme-primary-glow)' : 'none',
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Timer ring */}
            <div className="relative flex items-center justify-center py-2">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                    <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="6"
                    />
                    <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        stroke={mode.color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 52}`}
                        strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                        style={{
                            filter: `drop-shadow(0 0 6px ${mode.color})`,
                        }}
                    />
                </svg>

                {/* Time display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="mono text-3xl font-light" style={{ color: 'var(--theme-text)' }}>
                        {formatTime(timeRemaining)}
                    </span>
                    <span className="text-[10px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                        #{pomodoroCount + 1}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
                <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
                    onClick={resetTimer}
                    title={t('timer.reset')}
                >
                    <RotateCcw size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>

                <button
                    className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
                    style={{
                        backgroundColor: mode.color,
                        color: '#0a0a14',
                        boxShadow: `0 0 20px color-mix(in srgb, ${mode.color} 40%, transparent)`,
                    }}
                    onClick={isTimerRunning ? pauseTimer : startTimer}
                >
                    {isTimerRunning
                        ? <icons.ui.pause size={18} color="currentColor" />
                        : <icons.ui.play size={18} color="currentColor" style={{ marginLeft: 2 }} />
                    }
                </button>

                <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer"
                    onClick={skipTimer}
                    title={t('timer.skipToNext')}
                >
                    <icons.ui.skipNext size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>

            {/* Duration selector */}
            {!isTimerRunning && timerMode === 'work' && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                    {WORK_DURATIONS.map((min) => (
                        <button
                            key={min}
                            className="text-[10px] px-2 py-1 rounded-full transition-all cursor-pointer"
                            style={{
                                background: workDuration === min * 60
                                    ? 'color-mix(in srgb, var(--theme-primary) 15%, transparent)'
                                    : 'rgba(255,255,255,0.05)',
                                color: workDuration === min * 60
                                    ? 'var(--theme-primary)'
                                    : 'var(--theme-text-muted)',
                                fontWeight: workDuration === min * 60 ? 500 : 400,
                            }}
                            onClick={() => setWorkDuration(min)}
                        >
                            {min}m
                        </button>
                    ))}
                </div>
            )}

            {/* ═══ Quick Notes ═══ */}
            <div
                className="flex-1 flex flex-col mt-1 rounded-xl overflow-hidden"
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    minHeight: '120px',
                }}
            >
                <div
                    className="flex items-center gap-2 px-3.5 py-2.5"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                    <PenLine size={13} style={{ color: 'var(--theme-primary)', opacity: 0.8 }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                        {t('timer.quickNotes')}
                    </span>
                </div>
                <textarea
                    className="flex-1 w-full bg-transparent resize-none px-3.5 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-white/15"
                    style={{ color: 'var(--theme-text)', minHeight: '80px' }}
                    placeholder={t('timer.notesPlaceholder')}
                    value={focusNotes}
                    onChange={(e) => setFocusNotes(e.target.value)}
                    spellCheck={false}
                />
            </div>
        </div>
    );
}
