/**
 * InlineTaskSteps — Render AI-generated task steps inline in chat bubble.
 *
 * Shows each step with SVG icon, text, estimate, and toggle completion.
 * Per-step play button to start Pomodoro for that specific step.
 * Active step is highlighted when the timer is running.
 * Glassmorphism card styling consistent with MoodCompanion UI.
 */

import { type CSSProperties } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import type { TaskStep } from '../../types/agent';

// ── SVG Icon Components ──

function CheckIcon({ checked }: { checked: boolean }) {
    if (checked) {
        return (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, cursor: 'pointer' }}>
                <rect x="1" y="1" width="14" height="14" rx="4" fill="rgba(139,92,246,0.3)" stroke="rgba(139,92,246,0.6)" strokeWidth="1.2" />
                <path d="M4.5 8.5L7 11L11.5 5.5" stroke="rgba(200,180,255,0.95)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, cursor: 'pointer' }}>
            <rect x="1" y="1" width="14" height="14" rx="4" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" />
        </svg>
    );
}

function StepNumberIcon({ number, isActive }: { number: number; isActive: boolean }) {
    const colors = [
        { bg: 'rgba(139,92,246,0.2)', border: 'rgba(139,92,246,0.4)', text: 'rgba(200,180,255,0.9)' },
        { bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.4)', text: 'rgba(180,210,255,0.9)' },
        { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)', text: 'rgba(180,240,220,0.9)' },
        { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: 'rgba(255,220,180,0.9)' },
        { bg: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.4)', text: 'rgba(255,200,220,0.9)' },
        { bg: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.4)', text: 'rgba(190,190,255,0.9)' },
        { bg: 'rgba(14,165,233,0.2)', border: 'rgba(14,165,233,0.4)', text: 'rgba(180,220,250,0.9)' },
    ];
    const c = colors[(number - 1) % colors.length];

    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="8" fill={isActive ? c.border : c.bg} stroke={c.border} strokeWidth={isActive ? 1.5 : 1} />
            <text x="9" y="9" textAnchor="middle" dominantBaseline="central" fill={isActive ? '#fff' : c.text} fontSize="9" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">
                {number}
            </text>
        </svg>
    );
}

function PlayStepIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6.5" stroke="rgba(139,92,246,0.4)" strokeWidth="1" fill="rgba(139,92,246,0.1)" />
            <path d="M5.5 4L10 7L5.5 10V4Z" fill="rgba(200,180,255,0.85)" />
        </svg>
    );
}

function PauseStepIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6.5" stroke="rgba(16,185,129,0.5)" strokeWidth="1" fill="rgba(16,185,129,0.15)" />
            <rect x="4.5" y="4" width="1.8" height="6" rx="0.5" fill="rgba(180,240,220,0.9)" />
            <rect x="7.7" y="4" width="1.8" height="6" rx="0.5" fill="rgba(180,240,220,0.9)" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 3, verticalAlign: 'middle' }}>
            <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <path d="M6 3V6L8 7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function PlayIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginRight: 4, verticalAlign: 'middle' }}>
            <path d="M2 1L8.5 5L2 9V1Z" fill="rgba(200,180,255,0.9)" />
        </svg>
    );
}

// ── Main Component ──

interface InlineTaskStepsProps {
    steps: TaskStep[];
    onStartTimer?: () => void;
}

export function InlineTaskSteps({ steps }: InlineTaskStepsProps) {
    const tasks = useFocusStore((s) => s.tasks);
    const toggleTask = useFocusStore((s) => s.toggleTask);
    const activeStepIndex = useFocusStore((s) => s.activeStepIndex);
    const startStepTimer = useFocusStore((s) => s.startStepTimer);
    const isTimerRunning = useFocusStore((s) => s.isTimerRunning);
    const timerMode = useFocusStore((s) => s.timerMode);
    const pendingNextStepIndex = useFocusStore((s) => s.pendingNextStepIndex);

    // Find matching AI tasks in store by matching text
    const getTaskId = (stepText: string): string | undefined => {
        const found = tasks.find((t) =>
            t.text === stepText || t.text.includes(stepText) || stepText.includes(t.text),
        );
        return found?.id;
    };

    const totalMinutes = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

    // Find next uncompleted step index
    const nextUncompletedIndex = steps.findIndex((step) => {
        const taskId = getTaskId(step.text);
        if (!taskId) return true; // Not in store = uncompleted
        return !tasks.find((t) => t.id === taskId)?.completed;
    });

    const handleStartStep = (index: number) => {
        const step = steps[index];
        if (step) {
            startStepTimer(index, step.estimatedMinutes);
        }
    };

    const handleStartNext = () => {
        const idx = nextUncompletedIndex >= 0 ? nextUncompletedIndex : 0;
        handleStartStep(idx);
    };

    const isOnBreak = timerMode !== 'work' && isTimerRunning;

    return (
        <div style={styles.container}>
            {/* Steps list */}
            <div style={styles.stepList}>
                {steps.map((step, i) => {
                    const taskId = getTaskId(step.text);
                    const isCompleted = taskId
                        ? tasks.find((t) => t.id === taskId)?.completed ?? false
                        : false;
                    const isActive = activeStepIndex === i && isTimerRunning;
                    const isPending = pendingNextStepIndex === i && isOnBreak;

                    return (
                        <div
                            key={i}
                            style={{
                                ...styles.step,
                                ...(isActive ? styles.stepActive : {}),
                                ...(isPending ? styles.stepPending : {}),
                                opacity: isCompleted ? 0.5 : 1,
                            }}
                        >
                            {/* Checkbox — toggle completion */}
                            <span onClick={(e) => { e.stopPropagation(); taskId && toggleTask(taskId); }}>
                                <CheckIcon checked={isCompleted} />
                            </span>

                            {/* Step number */}
                            <StepNumberIcon number={i + 1} isActive={isActive || isPending} />

                            {/* Step text */}
                            <span style={{
                                ...styles.stepText,
                                textDecoration: isCompleted ? 'line-through' : 'none',
                                fontWeight: (isActive || isPending) ? 600 : 400,
                            }}>
                                {step.text}
                            </span>

                            {/* Pending badge */}
                            {isPending && (
                                <span style={styles.pendingBadge}>tiếp theo</span>
                            )}

                            {/* Time estimate */}
                            <span style={styles.stepTime}>
                                <ClockIcon />~{step.estimatedMinutes}m
                            </span>

                            {/* Play/Pause button for this step */}
                            {!isCompleted && !isPending && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStartStep(i); }}
                                    style={styles.stepPlayBtn}
                                    title={`Focus ${step.estimatedMinutes} phút`}
                                >
                                    {isActive ? <PauseStepIcon /> : <PlayStepIcon />}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary + actions */}
            <div style={styles.footer}>
                <span style={styles.totalTime}>
                    <ClockIcon /> Tổng ~{totalMinutes} phút
                </span>
                <button
                    onClick={handleStartNext}
                    style={styles.actionBtn}
                    className="mood-chip"
                >
                    <PlayIcon />
                    {isOnBreak && pendingNextStepIndex !== null
                        ? `Đang nghỉ… → step ${pendingNextStepIndex + 1}`
                        : activeStepIndex !== null && isTimerRunning
                            ? `Đang focus step ${activeStepIndex + 1}`
                            : 'Bắt đầu'}
                </button>
            </div>
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    container: {
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
    },
    stepList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    step: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 6px',
        borderRadius: 8,
        transition: 'all 0.2s ease',
    },
    stepActive: {
        background: 'rgba(139,92,246,0.1)',
        border: '1px solid rgba(139,92,246,0.2)',
        padding: '3px 5px', // Account for border
    },
    stepPending: {
        background: 'rgba(16,185,129,0.08)',
        border: '1px solid rgba(16,185,129,0.2)',
        padding: '3px 5px',
    },
    pendingBadge: {
        fontSize: 10,
        color: 'rgba(16,185,129,0.8)',
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: 6,
        padding: '1px 6px',
        fontWeight: 500,
        flexShrink: 0,
    },
    stepText: {
        flex: 1,
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 1.4,
        transition: 'font-weight 0.2s ease',
    },
    stepTime: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        display: 'flex',
        alignItems: 'center',
    },
    stepPlayBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        borderRadius: 8,
        flexShrink: 0,
        transition: 'transform 0.15s ease',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    totalTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        display: 'flex',
        alignItems: 'center',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '5px 14px',
        borderRadius: 14,
        border: '1px solid rgba(139,92,246,0.3)',
        background: 'rgba(139,92,246,0.15)',
        color: 'rgba(200,180,255,0.9)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};

export default InlineTaskSteps;
