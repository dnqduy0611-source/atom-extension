import { useFocusStore } from '../../store/useFocusStore';
import { useLofiStore } from '../../store/useLofiStore';
import { formatTime } from '../../utils/formatTime';
import { Pause, Play, SkipForward } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * TimerPill — scene-themed, compact top-center pill.
 * Uses CSS theme vars for glass + glow that matches the scene.
 */
export function TimerPill() {
    const { t } = useTranslation();
    const {
        timerMode,
        timeRemaining,
        isTimerRunning,
        pomodoroCount,
        startTimer,
        pauseTimer,
        skipTimer,
    } = useFocusStore();

    const togglePanel = useLofiStore((s) => s.togglePanel);

    if (!isTimerRunning && timeRemaining === (timerMode === 'work' ? 25 * 60 : timerMode === 'shortBreak' ? 5 * 60 : 15 * 60)) {
        return null;
    }

    // Mode-specific tints (subtle — main theming comes from CSS vars)
    const modeAccent = {
        work: 'var(--theme-primary)',
        shortBreak: '#60a5fa',
        longBreak: '#a78bfa',
    };

    const accent = modeAccent[timerMode];
    const cyclePosition = pomodoroCount % 4;

    return (
        <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 cursor-pointer"
            onClick={() => togglePanel('focus')}
        >
            <div
                className="flex items-center gap-2.5 px-4 py-2 rounded-full
                    backdrop-blur-xl transition-all duration-300 hover:scale-105"
                style={{
                    background: 'var(--theme-panel-bg)',
                    border: `1px solid var(--theme-panel-border)`,
                    boxShadow: `0 0 20px var(--theme-primary-glow)`,
                }}
            >
                {/* Play/Pause */}
                <button
                    className="w-6 h-6 flex items-center justify-center rounded-full
                        bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); isTimerRunning ? pauseTimer() : startTimer(); }}
                >
                    {isTimerRunning
                        ? <Pause size={11} color="white" fill="white" />
                        : <Play size={11} color="white" fill="white" style={{ marginLeft: 1 }} />
                    }
                </button>

                {/* Time */}
                <span className="mono text-sm font-semibold tracking-wide" style={{ color: 'var(--theme-text)' }}>
                    {formatTime(timeRemaining)}
                </span>

                {/* Mode label */}
                <span className="text-[10px] uppercase tracking-wider" style={{ color: accent }}>
                    {timerMode === 'work' ? t('timerPill.focus') : timerMode === 'shortBreak' ? t('timerPill.break') : t('timerPill.rest')}
                </span>

                {/* Cycle dots */}
                <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === cyclePosition && timerMode === 'work' ? 'animate-pulse' : ''
                                }`}
                            style={{
                                background: i < cyclePosition || (i === cyclePosition && timerMode === 'work')
                                    ? 'var(--theme-primary)'
                                    : 'rgba(255,255,255,0.2)',
                            }}
                        />
                    ))}
                </div>

                {/* Skip */}
                <button
                    className="w-5 h-5 flex items-center justify-center rounded-full
                        hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); skipTimer(); }}
                    title={t('timer.skip')}
                >
                    <SkipForward size={10} style={{ color: 'var(--theme-text-muted)' }} />
                </button>
            </div>
        </div>
    );
}
