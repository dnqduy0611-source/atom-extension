import { useState, useEffect } from 'react';
import { useTimerState, sendTimerCommand } from '../hooks/useTimerState';
import { getSession } from '../services/auth';

// ── SVG Icons ──

const PlayIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

const PauseIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
);

const ResetIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
);

const SkipIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 4 15 12 5 20 5 4" />
        <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const ExternalIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);

const UserIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

// ── Popup Component ──

export function Popup() {
    const timer = useTimerState();
    const [user, setUser] = useState<{ email?: string } | null>(null);
    const [hovered, setHovered] = useState('');

    const minutes = Math.floor(timer.remaining / 60);
    const seconds = timer.remaining % 60;
    const progress = timer.duration > 0 ? 1 - timer.remaining / timer.duration : 0;
    const isActive = timer.mode !== 'idle';
    const isFocus = timer.mode === 'focus';

    // SVG ring
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference * (1 - progress);

    useEffect(() => {
        getSession().then(s => {
            if (s?.user) setUser({ email: s.user.email });
        });
    }, []);

    const openLofiWeb = () => {
        chrome.tabs.create({ url: 'https://lofi.amonexus.com' });
        window.close();
    };

    const openNewTab = () => {
        chrome.tabs.create({ url: 'chrome://newtab' });
        window.close();
    };

    const accentColor = isFocus ? '#4dd0e1' : '#34d399';
    const accentGlow = isFocus ? 'rgba(77,208,225,0.3)' : 'rgba(52,211,153,0.3)';

    return (
        <div style={{
            width: 320,
            minHeight: 380,
            background: 'linear-gradient(160deg, #0c0e1a 0%, #151929 40%, #0f1320 100%)',
            color: '#e8eaf0',
            fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Ambient glow */}
            <div style={{
                position: 'absolute',
                top: -60,
                right: -40,
                width: 200,
                height: 200,
                background: `radial-gradient(circle, ${accentGlow} 0%, transparent 70%)`,
                filter: 'blur(40px)',
                pointerEvents: 'none',
                transition: 'background 0.5s ease',
            }} />
            <div style={{
                position: 'absolute',
                bottom: -40,
                left: -30,
                width: 160,
                height: 160,
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, padding: '20px 20px 16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <img
                        src="/icons/icon-48.png"
                        alt="AmoLofi"
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            flexShrink: 0,
                        }}
                    />
                    <div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            background: `linear-gradient(135deg, #ffffff, ${accentColor})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            color: '#ffffff',
                        }}>
                            Amo Lofi
                        </div>
                        <div style={{
                            fontSize: '0.65rem',
                            color: 'rgba(255,255,255,0.6)',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            marginTop: 1,
                        }}>
                            Cinematic Focus
                        </div>
                    </div>
                </div>

                {/* Timer Card */}
                <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '20px',
                    marginBottom: 14,
                    textAlign: 'center',
                }}>
                    {/* Timer ring + time */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        <svg width="84" height="84" viewBox="0 0 84 84">
                            {/* Bg ring */}
                            <circle
                                cx="42" cy="42" r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="3"
                            />
                            {/* Progress ring */}
                            <circle
                                cx="42" cy="42" r={radius}
                                fill="none"
                                stroke={accentColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeOffset}
                                style={{
                                    transform: 'rotate(-90deg)',
                                    transformOrigin: 'center',
                                    transition: 'stroke-dashoffset 0.5s ease',
                                    filter: `drop-shadow(0 0 6px ${accentGlow})`,
                                }}
                            />
                            {/* Time text */}
                            <text
                                x="42" y="42"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#e8eaf0"
                                fontSize="16"
                                fontWeight="600"
                                fontFamily="'Inter', 'SF Mono', monospace"
                            >
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </text>
                        </svg>

                        <div style={{ textAlign: 'left' }}>
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: accentColor,
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                marginBottom: 4,
                            }}>
                                {isActive
                                    ? (isFocus ? '● Tập trung' : '☕ Nghỉ ngơi')
                                    : '○ Sẵn sàng'}
                            </div>
                            {timer.task && (
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    maxWidth: 140,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {timer.task}
                                </div>
                            )}
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'rgba(255,255,255,0.5)',
                                marginTop: 2,
                            }}>
                                {timer.isRunning ? 'Đang chạy' : (isActive ? 'Đã tạm dừng' : 'Bấm để bắt đầu')}
                            </div>
                        </div>
                    </div>

                    {/* Timer controls */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 14,
                    }}>
                        {/* Play/Pause */}
                        <button
                            onClick={() => sendTimerCommand(timer.isRunning ? 'pause' : 'start')}
                            onMouseEnter={() => setHovered('play')}
                            onMouseLeave={() => setHovered('')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '7px 16px',
                                borderRadius: 10,
                                border: 'none',
                                background: hovered === 'play'
                                    ? accentColor
                                    : 'rgba(255,255,255,0.08)',
                                color: hovered === 'play' ? '#0c0e1a' : '#e8eaf0',
                                fontSize: '0.72rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {timer.isRunning ? <PauseIcon /> : <PlayIcon />}
                            {timer.isRunning ? 'Pause' : 'Start'}
                        </button>

                        {isActive && (
                            <>
                                <button
                                    onClick={() => sendTimerCommand('skip')}
                                    onMouseEnter={() => setHovered('skip')}
                                    onMouseLeave={() => setHovered('')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '7px 12px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: hovered === 'skip'
                                            ? 'rgba(255,255,255,0.12)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.6)',
                                        fontSize: '0.72rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <SkipIcon />
                                    Skip
                                </button>
                                <button
                                    onClick={() => sendTimerCommand('reset')}
                                    onMouseEnter={() => setHovered('reset')}
                                    onMouseLeave={() => setHovered('')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '7px 12px',
                                        borderRadius: 10,
                                        border: 'none',
                                        background: hovered === 'reset'
                                            ? 'rgba(255,255,255,0.12)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: 'rgba(255,255,255,0.6)',
                                        fontSize: '0.72rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <ResetIcon />
                                    Reset
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={openLofiWeb}
                        onMouseEnter={() => setHovered('web')}
                        onMouseLeave={() => setHovered('')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '10px 0',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: hovered === 'web'
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(255,255,255,0.03)',
                            color: '#e8eaf0',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <ExternalIcon />
                        AmoLofi Web
                    </button>
                    <button
                        onClick={openNewTab}
                        onMouseEnter={() => setHovered('newtab')}
                        onMouseLeave={() => setHovered('')}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '10px 0',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: hovered === 'newtab'
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(255,255,255,0.03)',
                            color: '#e8eaf0',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                        </svg>
                        New Tab
                    </button>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.5)',
                    }}>
                        <UserIcon />
                        {user?.email
                            ? user.email.split('@')[0]
                            : 'Chưa đăng nhập'}
                    </div>
                    <div style={{
                        fontSize: '0.6rem',
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.05em',
                    }}>
                        v1.5.0
                    </div>
                </div>
            </div>
        </div>
    );
}
