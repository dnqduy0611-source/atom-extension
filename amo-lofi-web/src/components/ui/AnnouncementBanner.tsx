import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { X, Sparkles, Gift, BarChart3, Percent } from 'lucide-react';

/**
 * AnnouncementBanner — Floating card shown once per browser session
 * to announce the new generous free tier changes.
 * Dismisses on click or auto-hides after a timeout.
 * Uses sessionStorage key `amo_announcement_v1` to persist dismissal.
 */

const STORAGE_KEY = 'amo_announcement_v2';
const SESSION_COOKIE = 'amo_session_active';

export function AnnouncementBanner() {
    const [visible, setVisible] = useState(false);
    const [animateOut, setAnimateOut] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        // Session cookie (no expires) = auto-cleared when Chrome closes
        const isExistingSession = document.cookie.includes(`${SESSION_COOKIE}=1`);

        if (!isExistingSession) {
            // New Chrome session → clear old dismiss & set session cookie
            localStorage.removeItem(STORAGE_KEY);
            document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
        }

        const dismissed = localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
            // Delay entrance for smoother UX (let app load first)
            const timer = setTimeout(() => setVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = () => {
        setAnimateOut(true);
        setTimeout(() => {
            setVisible(false);
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }, 400);
    };

    // Auto-dismiss after 15 seconds
    useEffect(() => {
        if (!visible || animateOut) return;
        const timer = setTimeout(dismiss, 15000);
        return () => clearTimeout(timer);
    }, [visible, animateOut]);

    if (!visible) return null;

    const isVi = (t as any)('app.exitZen') === 'Thoát Zen' ||
        document.documentElement.lang === 'vi' ||
        navigator.language.startsWith('vi');

    return (
        <div
            className="fixed z-[999] flex justify-center pointer-events-none"
            style={{
                bottom: 80,
                left: 0,
                right: 0,
            }}
        >
            <div
                className="pointer-events-auto"
                style={{
                    maxWidth: 480,
                    width: '90vw',
                    borderRadius: 20,
                    background: 'rgba(255, 255, 255, 0.07)',
                    backdropFilter: 'blur(20px) saturate(1.3)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 0 1px rgba(255,255,255,0.1)',
                    padding: '20px 22px',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: animateOut
                        ? 'announceFadeOut 0.4s ease-in forwards'
                        : 'announceSlideIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}
            >
                {/* Top-edge glass highlight — simulates light reflection */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 1,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.12) 80%, transparent 100%)',
                        zIndex: 1,
                    }}
                />

                {/* Close button */}
                <button
                    onClick={dismiss}
                    className="absolute cursor-pointer transition-all duration-200 hover:bg-white/10 flex items-center justify-center"
                    style={{
                        top: 10,
                        right: 10,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'transparent',
                        border: 'none',
                    }}
                >
                    <X size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(34,211,238,0.15))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Sparkles size={18} style={{ color: '#4ade80', filter: 'drop-shadow(0 0 4px rgba(74,222,128,0.5))' }} />
                    </div>
                    <div>
                        <h3 style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.01em',
                        }}>
                            {isVi ? '🎉 AmoLofi vừa cập nhật!' : '🎉 AmoLofi just got better!'}
                        </h3>
                    </div>
                </div>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
                    <FeatureRow
                        icon={<Gift size={14} style={{ color: '#4ade80' }} />}
                        text={isVi
                            ? 'Tạo scene AI miễn phí mỗi ngày — không giới hạn thời gian'
                            : 'Free AI scene creation every day — no time limit'}
                    />
                    <FeatureRow
                        icon={<BarChart3 size={14} style={{ color: '#22d3ee' }} />}
                        text={isVi
                            ? 'Dashboard thống kê tháng & năm — miễn phí cho tất cả'
                            : 'Monthly & yearly stats dashboard — free for everyone'}
                    />
                    <FeatureRow
                        icon={<Sparkles size={14} style={{ color: '#f59e0b' }} />}
                        text={isVi
                            ? 'AI Insights hàng tuần — báo cáo năng suất thông minh'
                            : 'Weekly AI Insights — smart productivity reports'}
                    />
                    <FeatureRow
                        icon={<Percent size={14} style={{ color: '#f97316' }} />}
                        text={isVi
                            ? '🎉 Pro giảm 50% — nâng cấp ngay hôm nay!'
                            : '🎉 Pro 50% OFF — upgrade today!'}
                    />
                </div>

                {/* Progress dots (auto-dismiss indicator) */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'rgba(74,222,128,0.15)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #4ade80, #22d3ee)',
                        animation: 'announceProgress 15s linear forwards',
                        transformOrigin: 'left',
                    }} />
                </div>

                {/* Keyframe styles */}
                <style>{`
                    @keyframes announceSlideIn {
                        from { opacity: 0; transform: translateY(30px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    @keyframes announceFadeOut {
                        from { opacity: 1; transform: translateY(0) scale(1); }
                        to { opacity: 0; transform: translateY(20px) scale(0.96); }
                    }
                    @keyframes announceProgress {
                        from { width: 100%; }
                        to { width: 0%; }
                    }
                `}</style>
            </div>
        </div>
    );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
            }}>
                {icon}
            </div>
            <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                lineHeight: 1.3,
            }}>
                {text}
            </span>
        </div>
    );
}
