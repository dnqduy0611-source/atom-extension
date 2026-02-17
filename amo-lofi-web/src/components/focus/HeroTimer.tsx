import { useState, useRef, useEffect } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { useLofiStore } from '../../store/useLofiStore';
import { formatTime } from '../../utils/formatTime';
import { Pause, Play, SkipForward, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

const WORK_DURATIONS = [15, 25, 30, 45, 60];

/**
 * HeroTimer — Large centered timer with multiple visual styles.
 * The focal point of the entire Amo Lofi experience.
 *
 * Hero Styles:
 *  - minimal:        Original clean ring + time
 *  - glassmorphism:  Frosted-glass card with backdrop blur
 *  - neon:           Bright neon glow, cyberpunk aesthetic
 *  - floating:       Elevated bubble, soft shadows, no ring
 *  - analog:         SVG clock face with hour markers
 *  - dashboard:      Horizontal card with date/time/session info
 */
export function HeroTimer() {
    const { t } = useTranslation();
    const heroStyle = useLofiStore((s) => s.heroStyle);
    const {
        timerMode,
        timeRemaining,
        isTimerRunning,
        pomodoroCount,
        workDuration,
        shortBreakDuration,
        longBreakDuration,
        startTimer,
        pauseTimer,
        resetTimer,
        skipTimer,
        tick,
        setWorkDuration,
        taskLabel,
        setTaskLabel,
    } = useFocusStore();

    const timerJustCompleted = useFocusStore((s) => s.timerJustCompleted);

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [hovered, setHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Timer tick engine — always mounted, runs independently ──
    const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    useEffect(() => {
        if (isTimerRunning) {
            intervalRef.current = setInterval(tick, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isTimerRunning, tick]);

    // ── Real-time clock tick for analog style ──
    const [, setClockTick] = useState(0);
    useEffect(() => {
        if (heroStyle !== 'analog') return;
        const id = setInterval(() => setClockTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [heroStyle]);

    // Auto-focus input when editing
    useEffect(() => {
        if (isEditingLabel && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditingLabel]);

    // Calculate total duration for ring progress
    const totalDuration = timerMode === 'work'
        ? workDuration
        : timerMode === 'shortBreak'
            ? shortBreakDuration
            : longBreakDuration;

    const progress = 1 - (timeRemaining / totalDuration);

    // Ring SVG calculations
    const ringSize = 240;
    const strokeWidth = 4;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    // Mode colors — indie warm tones
    const modeColors: Record<string, { primary: string; glow: string; indie: string }> = {
        work: { primary: 'var(--theme-primary, #4ade80)', glow: 'var(--theme-primary-glow, rgba(74,222,128,0.3))', indie: 'rgba(251,191,36,0.15)' },
        shortBreak: { primary: '#60a5fa', glow: 'rgba(96,165,250,0.3)', indie: 'rgba(167,139,250,0.12)' },
        longBreak: { primary: '#a78bfa', glow: 'rgba(167,139,250,0.3)', indie: 'rgba(244,114,182,0.12)' },
    };
    const colors = modeColors[timerMode];

    // Timer is "active" (has been started at least once or is running)
    const isActive = isTimerRunning || timeRemaining !== totalDuration;
    const cyclePosition = pomodoroCount % 4;

    // ── Shared sub-components ──

    const timerFlash = timerJustCompleted && (
        <div
            className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            style={{ animation: 'timerFlash 3s ease-out forwards' }}
        >
            <div
                className="text-center"
                style={{ animation: 'timerFlashScale 3s ease-out forwards' }}
            >
                <div
                    className="text-3xl font-bold tracking-wider mb-2"
                    style={{
                        color: timerJustCompleted === 'work' ? '#60a5fa' : 'var(--theme-primary)',
                        textShadow: `0 0 40px ${timerJustCompleted === 'work' ? 'rgba(96,165,250,0.6)' : 'var(--theme-primary-glow)'}`,
                    }}
                >
                    {timerJustCompleted === 'work' ? '☕ Break Time!' : '🧠 Focus!'}
                </div>
                <div className="text-sm text-white/50 tracking-widest uppercase">
                    {timerJustCompleted === 'work' ? 'Great work! Take a break.' : 'Let\'s get back to it.'}
                </div>
            </div>
        </div>
    );

    const controls = (
        <div
            className={`flex items-center gap-3 transition-all duration-300 ${hovered || !isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                }`}
        >
            {isActive && (
                <button
                    className="w-9 h-9 flex items-center justify-center rounded-full
                        backdrop-blur-xl transition-all duration-200 cursor-pointer hover:scale-110"
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onClick={() => resetTimer()}
                    title={t('timer.reset') || 'Reset'}
                >
                    <RotateCcw size={14} color="rgba(255,255,255,0.7)" />
                </button>
            )}
            <button
                className="w-11 h-11 flex items-center justify-center rounded-full
                    backdrop-blur-xl transition-all duration-200 cursor-pointer hover:scale-110"
                style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.12)',
                }}
                onClick={() => isTimerRunning ? pauseTimer() : startTimer()}
                title={isTimerRunning ? 'Pause' : 'Start'}
            >
                {isTimerRunning
                    ? <Pause size={16} color="white" fill="white" />
                    : <Play size={16} color="white" fill="white" style={{ marginLeft: 2 }} />
                }
            </button>
            {isActive && (
                <button
                    className="w-9 h-9 flex items-center justify-center rounded-full
                        backdrop-blur-xl transition-all duration-200 cursor-pointer hover:scale-110"
                    style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onClick={() => skipTimer()}
                    title={t('timer.skip') || 'Skip'}
                >
                    <SkipForward size={14} color="rgba(255,255,255,0.7)" />
                </button>
            )}
        </div>
    );

    const durationSelector = hovered && !isTimerRunning && timerMode === 'work' && !isActive && (
        <div className="flex items-center gap-2 mt-1">
            {WORK_DURATIONS.map((min) => (
                <button
                    key={min}
                    className="text-[11px] px-3 py-1.5 rounded-full transition-all cursor-pointer backdrop-blur-sm"
                    style={{
                        background: workDuration === min * 60
                            ? `color-mix(in srgb, ${colors.primary} 25%, rgba(255,255,255,0.1))`
                            : 'rgba(255,255,255,0.08)',
                        color: workDuration === min * 60
                            ? colors.primary
                            : 'rgba(255,255,255,0.5)',
                        border: workDuration === min * 60
                            ? `1px solid color-mix(in srgb, ${colors.primary} 30%, transparent)`
                            : '1px solid rgba(255,255,255,0.08)',
                        fontWeight: workDuration === min * 60 ? 600 : 400,
                        textShadow: workDuration === min * 60
                            ? `0 0 8px ${colors.glow}` : 'none',
                    }}
                    onClick={() => setWorkDuration(min)}
                >
                    {min}m
                </button>
            ))}
        </div>
    );

    const cycleDots = isActive && (
        <div className="flex gap-2 mt-1">
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${i === cyclePosition && timerMode === 'work' ? 'hero-timer-dot-pulse' : ''
                        }`}
                    style={{
                        background: i < cyclePosition || (i === cyclePosition && timerMode === 'work')
                            ? colors.primary
                            : 'rgba(255,255,255,0.15)',
                        boxShadow: i < cyclePosition
                            ? `0 0 6px ${colors.glow}`
                            : 'none',
                    }}
                />
            ))}
        </div>
    );

    const taskLabelInput = (
        <div className="mt-2 text-center max-w-[320px]">
            {isEditingLabel ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={taskLabel}
                    onChange={(e) => setTaskLabel(e.target.value)}
                    onBlur={() => setIsEditingLabel(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingLabel(false); }}
                    maxLength={60}
                    className="w-full text-center text-sm bg-transparent border-none outline-none
                        placeholder:text-white/40"
                    style={{
                        color: 'rgba(255,255,255,0.8)',
                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                        paddingBottom: 4,
                    }}
                    placeholder={t('heroTimer.placeholder') || 'What are you working on?'}
                />
            ) : (
                <button
                    className="text-sm cursor-pointer transition-all duration-200 hover:text-white/80"
                    style={{
                        color: taskLabel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
                        background: 'none',
                        border: 'none',
                        textShadow: '0 1px 6px rgba(0,0,0,0.3)',
                    }}
                    onClick={() => setIsEditingLabel(true)}
                >
                    {taskLabel || (t('heroTimer.placeholder') || 'What are you working on?')}
                </button>
            )}
        </div>
    );

    // ── Mode label ──
    const modeLabel = isActive && (
        <span
            className="text-[11px] uppercase tracking-[0.2em] font-medium mt-1 transition-opacity duration-300"
            style={{ color: colors.primary }}
        >
            {timerMode === 'work'
                ? (t('timerPill.focus') || 'Focus')
                : timerMode === 'shortBreak'
                    ? (t('timerPill.break') || 'Break')
                    : (t('timerPill.rest') || 'Rest')}
        </span>
    );

    // ── SVG Ring (shared by minimal + neon) ──
    const svgRing = (neonMode = false) => (
        <svg
            width={ringSize}
            height={ringSize}
            className="hero-timer-ring"
            style={{ transform: 'rotate(-90deg)' }}
        >
            <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={neonMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}
                strokeWidth={neonMode ? 6 : strokeWidth}
            />
            {isActive && (
                <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth={neonMode ? 6 : strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                    style={{
                        filter: neonMode
                            ? `drop-shadow(0 0 16px ${colors.primary}) drop-shadow(0 0 40px ${colors.glow})`
                            : `drop-shadow(0 0 8px ${colors.glow})`,
                    }}
                />
            )}
        </svg>
    );

    // ── Time display ──
    const timeDisplay = (extraStyle: React.CSSProperties = {}) => (
        <span
            className="font-light tracking-wider transition-all duration-300"
            style={{
                fontSize: 'clamp(48px, 8vw, 72px)',
                color: 'rgba(255,255,255,0.9)',
                textShadow: isActive
                    ? `0 0 var(--variant-glow-spread, 40px) ${colors.glow}, 0 0 80px ${colors.indie}, var(--variant-text-shadow, 0 2px 8px rgba(0,0,0,0.3))`
                    : `0 0 30px rgba(251,191,36,0.08), var(--variant-text-shadow, 0 2px 8px rgba(0,0,0,0.3))`,
                opacity: isActive ? 1 : 0.6,
                ...extraStyle,
            }}
        >
            {formatTime(timeRemaining)}
        </span>
    );

    // ══════════════════════════════════════════════════════
    //  RENDER STYLES
    // ══════════════════════════════════════════════════════

    const renderMinimal = () => (
        <div
            className="relative flex flex-col items-center gap-3 pointer-events-auto"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative flex items-center justify-center">
                {svgRing()}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {timeDisplay()}
                    {modeLabel}
                </div>
                {isTimerRunning && (
                    <div
                        className="absolute inset-0 rounded-full pointer-events-none hero-timer-glow"
                        style={{
                            boxShadow: `0 0 calc(60px * var(--variant-glow-strength, 1)) 10px ${colors.glow}, 0 0 calc(120px * var(--variant-glow-strength, 1)) 30px ${colors.indie}`,
                        }}
                    />
                )}
                <div
                    className="absolute inset-[-20px] rounded-full pointer-events-none"
                    style={{
                        background: `radial-gradient(circle, ${colors.indie} 0%, transparent 70%)`,
                        opacity: isActive ? 0.8 : 0.3,
                        transition: 'opacity 1s ease',
                    }}
                />
            </div>
            {controls}
            {durationSelector}
            {cycleDots}
            {taskLabelInput}
        </div>
    );

    const renderGlassmorphism = () => (
        <div
            className="relative flex flex-col items-center gap-3 pointer-events-auto"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className="relative flex flex-col items-center justify-center rounded-3xl p-8"
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(20px) saturate(1.6)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: isActive
                        ? `0 8px 40px rgba(0,0,0,0.4), 0 0 60px ${colors.indie}, inset 0 1px 0 rgba(255,255,255,0.1)`
                        : '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                    minWidth: 280,
                    transition: 'box-shadow 0.6s ease',
                }}
            >
                {/* Accent line on top */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                        width: 60,
                        height: 3,
                        background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
                        opacity: isActive ? 1 : 0.3,
                        transition: 'opacity 0.6s',
                    }}
                />

                {/* Ring inside glass */}
                <div className="relative flex items-center justify-center">
                    {svgRing()}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        {timeDisplay()}
                        {modeLabel}
                    </div>
                    {isTimerRunning && (
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none hero-timer-glow"
                            style={{
                                boxShadow: `0 0 40px 5px ${colors.glow}, 0 0 80px 15px ${colors.indie}`,
                            }}
                        />
                    )}
                </div>
            </div>
            {controls}
            {durationSelector}
            {cycleDots}
            {taskLabelInput}
        </div>
    );

    const renderNeon = () => (
        <div
            className="relative flex flex-col items-center gap-3 pointer-events-auto"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="relative flex items-center justify-center">
                {svgRing(true)}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {timeDisplay({
                        textShadow: isActive
                            ? `0 0 20px ${colors.primary}, 0 0 60px ${colors.glow}, 0 0 120px ${colors.indie}`
                            : `0 0 10px rgba(255,255,255,0.1)`,
                        fontWeight: 300,
                    })}
                    {modeLabel}
                </div>
                {/* Strong outer glow ring */}
                {isTimerRunning && (
                    <div
                        className="absolute inset-[-8px] rounded-full pointer-events-none hero-timer-glow"
                        style={{
                            boxShadow: `0 0 30px 4px ${colors.primary}, 0 0 80px 15px ${colors.glow}, 0 0 160px 40px ${colors.indie}`,
                        }}
                    />
                )}
                {/* Subtle neon border circle */}
                <div
                    className="absolute inset-[-3px] rounded-full pointer-events-none"
                    style={{
                        border: `1px solid ${isActive ? colors.primary : 'rgba(255,255,255,0.06)'}`,
                        opacity: 0.3,
                        transition: 'all 0.6s ease',
                    }}
                />
            </div>
            {controls}
            {durationSelector}
            {cycleDots}
            {taskLabelInput}
        </div>
    );

    const renderFloating = () => (
        <div
            className="relative flex flex-col items-center gap-3 pointer-events-auto"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div
                className="relative flex flex-col items-center justify-center rounded-full"
                style={{
                    width: 240,
                    height: 240,
                    background: `radial-gradient(circle at 50% 40%, rgba(255,255,255,0.1), rgba(255,255,255,0.03) 70%)`,
                    boxShadow: isActive
                        ? `0 20px 60px rgba(0,0,0,0.5), 0 0 80px ${colors.indie}, inset 0 2px 0 rgba(255,255,255,0.1)`
                        : '0 20px 60px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(8px)',
                    transition: 'box-shadow 0.6s ease',
                }}
            >
                {timeDisplay({ fontSize: 'clamp(40px, 7vw, 60px)' })}
                {modeLabel}
            </div>
            {controls}
            {durationSelector}
            {cycleDots}
            {taskLabelInput}
        </div>
    );

    const renderAnalog = () => {
        const clockSize = 220;
        const center = clockSize / 2;
        const faceR = 100;

        // Real time for clock hands
        const now = new Date();
        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const hourAngle = (hours + minutes / 60) * 30;     // 360/12 = 30° per hour
        const minuteAngle = (minutes + seconds / 60) * 6;  // 360/60 = 6° per minute
        const secondAngle = seconds * 6;                    // 360/60 = 6° per second

        const accent = colors.primary;

        return (
            <div
                className="relative flex flex-col items-center gap-5 pointer-events-auto"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Clock face */}
                <div
                    className="relative flex items-center justify-center"
                    style={{
                        width: clockSize,
                        height: clockSize,
                    }}
                >
                    <svg width={clockSize} height={clockSize}>
                        {/* Dark face with edge glow */}
                        <circle cx={center} cy={center} r={faceR}
                            fill="rgba(10,10,20,0.85)"
                            stroke={accent}
                            strokeWidth={isActive ? 2 : 1}
                            opacity={isActive ? 1 : 0.3}
                            style={{
                                filter: isActive ? `drop-shadow(0 0 12px ${colors.glow}) drop-shadow(0 0 30px ${colors.indie})` : 'none',
                                transition: 'all 0.6s',
                            }}
                        />

                        {/* Progress ring on face edge */}
                        {isActive && (
                            <circle cx={center} cy={center} r={faceR}
                                fill="none" stroke={accent} strokeWidth={2}
                                strokeDasharray={2 * Math.PI * faceR}
                                strokeDashoffset={2 * Math.PI * faceR * (1 - progress)}
                                strokeLinecap="round"
                                style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                                opacity={0.4}
                            />
                        )}

                        {/* Hour hand */}
                        <line
                            x1={center} y1={center}
                            x2={center + Math.cos((hourAngle - 90) * Math.PI / 180) * 48}
                            y2={center + Math.sin((hourAngle - 90) * Math.PI / 180) * 48}
                            stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round"
                        />

                        {/* Minute hand */}
                        <line
                            x1={center} y1={center}
                            x2={center + Math.cos((minuteAngle - 90) * Math.PI / 180) * 70}
                            y2={center + Math.sin((minuteAngle - 90) * Math.PI / 180) * 70}
                            stroke="rgba(255,255,255,0.7)" strokeWidth={1.8} strokeLinecap="round"
                        />

                        {/* Second hand */}
                        <line
                            x1={center} y1={center}
                            x2={center + Math.cos((secondAngle - 90) * Math.PI / 180) * 78}
                            y2={center + Math.sin((secondAngle - 90) * Math.PI / 180) * 78}
                            stroke={accent} strokeWidth={1} strokeLinecap="round"
                            opacity={0.7}
                        />

                        {/* Center dot */}
                        <circle cx={center} cy={center} r={3.5}
                            fill="rgba(255,255,255,0.9)"
                        />
                    </svg>
                </div>

                {/* Digital time */}
                <div className="flex flex-col items-center gap-1">
                    {timeDisplay({ fontSize: 'clamp(36px, 6vw, 52px)' })}
                    {modeLabel}
                </div>

                {controls}
                {durationSelector}
                {cycleDots}
                {taskLabelInput}
            </div>
        );
    };

    const renderDashboard = () => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');

        return (
            <div
                className="relative flex flex-col items-center gap-3 pointer-events-auto"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                <div
                    className="relative flex items-center gap-8 rounded-2xl px-10 py-7"
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(20px) saturate(1.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                >
                    {/* Current time */}
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">Now</span>
                        <span className="text-2xl font-light tracking-wider text-white/60" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {hrs}:{mins}
                        </span>
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,0.08)' }} />

                    {/* Timer */}
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] uppercase tracking-[0.15em] mb-1"
                            style={{ color: isActive ? colors.primary : 'rgba(255,255,255,0.3)' }}>
                            {timerMode === 'work' ? (t('timerPill.focus') || 'Focus') : timerMode === 'shortBreak' ? (t('timerPill.break') || 'Break') : (t('timerPill.rest') || 'Rest')}
                        </span>
                        {timeDisplay({ fontSize: 'clamp(36px, 6vw, 56px)' })}
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 50, background: 'rgba(255,255,255,0.08)' }} />

                    {/* Session info */}
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">Session</span>
                        <div className="flex gap-1.5">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === cyclePosition && timerMode === 'work' ? 'hero-timer-dot-pulse' : ''}`}
                                    style={{
                                        background: i < cyclePosition || (i === cyclePosition && timerMode === 'work')
                                            ? colors.primary
                                            : 'rgba(255,255,255,0.15)',
                                        boxShadow: i < cyclePosition
                                            ? `0 0 6px ${colors.glow}`
                                            : 'none',
                                    }}
                                />
                            ))}
                        </div>
                        <span className="text-[10px] text-white/30 mt-0.5">#{pomodoroCount + 1}</span>
                    </div>
                </div>

                {controls}
                {durationSelector}
                {taskLabelInput}
            </div>
        );
    };

    // ── Style router ──
    const renderContent = () => {
        switch (heroStyle) {
            case 'glassmorphism': return renderGlassmorphism();
            case 'neon': return renderNeon();
            case 'floating': return renderFloating();
            case 'analog': return renderAnalog();
            case 'dashboard': return renderDashboard();
            case 'minimal':
            default: return renderMinimal();
        }
    };

    return (
        <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none"
        >
            {timerFlash}
            {renderContent()}
        </div>
    );
}
