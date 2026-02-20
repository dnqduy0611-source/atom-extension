import { useTimerState, sendTimerCommand } from '../hooks/useTimerState';
import { TIMER_PRESETS } from '../storage/timer';

/**
 * TimerPanel — Full timer display with progress ring, controls, and duration picker.
 * Shows above center content when timer is active.
 */
export function TimerPanel() {
    const timer = useTimerState();
    const minutes = Math.floor(timer.remaining / 60);
    const seconds = timer.remaining % 60;
    const progress = timer.duration > 0 ? 1 - timer.remaining / timer.duration : 0;

    const isActive = timer.mode !== 'idle';
    const isFocus = timer.mode === 'focus';
    const isBreak = timer.mode === 'break';

    // SVG circle math
    const radius = 110;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference * (1 - progress);

    return (
        <div className={`timer-panel ${isActive ? 'active' : ''}`}>
            {/* Progress ring */}
            <div className="timer-ring-container">
                <svg className="timer-ring" viewBox="0 0 260 260">
                    {/* Background ring */}
                    <circle
                        cx="130" cy="130" r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="5"
                    />
                    {/* Progress ring */}
                    <circle
                        cx="130" cy="130" r={radius}
                        fill="none"
                        stroke={isFocus ? 'var(--theme-primary)' : '#34d399'}
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: 'center',
                            transition: 'stroke-dashoffset 0.5s ease',
                            filter: `drop-shadow(0 0 8px ${isFocus ? 'var(--theme-primary-glow)' : 'rgba(52,211,153,0.3)'})`,
                        }}
                    />
                </svg>

                {/* Timer digits inside ring */}
                <div className="timer-inner">
                    <span className="timer-mode-badge">
                        {isFocus && (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="6" />
                                    <circle cx="12" cy="12" r="2" />
                                </svg>
                                {' '}FOCUS
                            </>
                        )}
                        {isBreak && (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                                    <line x1="6" x2="6" y1="2" y2="4" />
                                    <line x1="10" x2="10" y1="2" y2="4" />
                                    <line x1="14" x2="14" y1="2" y2="4" />
                                </svg>
                                {' '}BREAK
                            </>
                        )}
                    </span>
                    <span className="timer-digits">
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </span>
                    {timer.task && <span className="timer-task">{timer.task}</span>}
                </div>
            </div>

            {/* Controls */}
            <div className="timer-controls">
                {timer.isRunning ? (
                    <button
                        className="timer-btn"
                        onClick={() => sendTimerCommand('pause')}
                    >
                        ⏸ Pause
                    </button>
                ) : (
                    <button
                        className="timer-btn primary"
                        onClick={() => sendTimerCommand('start')}
                    >
                        ▶ {isActive ? 'Resume' : 'Start Focus'}
                    </button>
                )}

                {isActive && (
                    <>
                        <button
                            className="timer-btn"
                            onClick={() => sendTimerCommand('skip')}
                        >
                            ⏭ Skip
                        </button>
                        <button
                            className="timer-btn"
                            onClick={() => sendTimerCommand('reset')}
                        >
                            ⏹ Reset
                        </button>
                    </>
                )}
            </div>

            {/* Duration picker (only when idle) */}
            {!isActive && (
                <div className="timer-presets">
                    {TIMER_PRESETS.focus.map((m) => (
                        <button
                            key={m}
                            className={`preset-btn ${timer.duration === m * 60 ? 'active' : ''}`}
                            onClick={() => sendTimerCommand('setDuration', { minutes: m })}
                        >
                            {m}m
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
