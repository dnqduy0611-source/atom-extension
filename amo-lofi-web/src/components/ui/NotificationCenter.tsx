import { useState, useRef, useEffect } from 'react';
import { Bell, Sparkles, Gift, BarChart3, Timer, MessageCircle, ListChecks, Percent, X } from 'lucide-react';

/**
 * NotificationCenter — Bell icon button (next to Settings gear)
 * Shows a dropdown with announcements & feature updates.
 * Tracks "last read" timestamp in localStorage to show unread badge.
 */

const STORAGE_KEY = 'amo_notif_last_read';

interface Notification {
    id: string;
    icon: React.ReactNode;
    title: string;
    titleVi: string;
    desc: string;
    descVi: string;
    date: string; // ISO date string
    color: string;
}

// ── Announcements data — add new items at the TOP ──
const NOTIFICATIONS: Notification[] = [
    {
        id: 'auto-break-2026-02',
        icon: <Timer size={15} />,
        title: 'Smart Auto-Break — Task-Driven Flow',
        titleVi: 'Auto-Break Thông Minh — Focus theo Task',
        desc: 'Complete a task → auto 5-min break → next task starts automatically. Just tick when done!',
        descVi: 'Tick xong task → tự nghỉ 5 phút → tự focus task tiếp theo. Chỉ cần tick khi xong!',
        date: '2026-02-22',
        color: '#8b5cf6',
    },
    {
        id: 'ai-task-breakdown-2026-02',
        icon: <ListChecks size={15} />,
        title: 'AI Task Breakdown — Smaller Steps, Easier Focus',
        titleVi: 'AI Chia Nhỏ Task — Bước nhỏ, dễ làm hơn',
        desc: 'Tell Amo what you need to do and get an actionable step-by-step plan with time estimates.',
        descVi: 'Nói với Amo bạn cần làm gì, AI sẽ chia nhỏ thành các bước cụ thể kèm thời gian ước tính.',
        date: '2026-02-22',
        color: '#10b981',
    },
    {
        id: 'smart-chat-2026-02',
        icon: <MessageCircle size={15} />,
        title: 'Smart Chat — All-in-One Focus Companion',
        titleVi: 'Khung Chat Thông Minh — Tất Cả Trong Một',
        desc: 'One chat to do it all: break down tasks, get encouragement, journal your mood, and control your focus session.',
        descVi: 'Một khung chat làm tất cả: chia nhỏ task, nhận động viên, ghi nhật ký tâm trạng, và điều khiển phiên focus.',
        date: '2026-02-22',
        color: '#ec4899',
    },
    {
        id: 'pro-discount-2026-02',
        icon: <Percent size={15} />,
        title: '🎉 Pro 50% OFF — Limited Time!',
        titleVi: '🎉 Pro Giảm 50% — Có hạn!',
        desc: 'Upgrade to Pro at half price. Unlimited AI scenes, weekly insights, cloud sync & more.',
        descVi: 'Nâng cấp Pro chỉ nửa giá. AI scene không giới hạn, insights hàng tuần, đồng bộ cloud & nhiều hơn.',
        date: '2026-02-22',
        color: '#f97316',
    },
    {
        id: 'free-tier-2026-02',
        icon: <Gift size={15} />,
        title: 'Free AI Scene Creation — Every Day!',
        titleVi: 'Tạo Scene AI miễn phí — Mỗi ngày!',
        desc: 'All logged-in users can now create 1 free AI scene per day. New users get 3/day during 14-day trial.',
        descVi: 'Tất cả user đăng nhập có thể tạo 1 AI scene miễn phí/ngày. User mới được 3/ngày trong 14 ngày trial.',
        date: '2026-02-21',
        color: '#4ade80',
    },
    {
        id: 'dashboard-unlock-2026-02',
        icon: <BarChart3 size={15} />,
        title: 'Dashboard Monthly & Yearly — Now Free',
        titleVi: 'Dashboard Tháng & Năm — Miễn phí',
        desc: 'Monthly and yearly stats views are now available to all users. No Pro required!',
        descVi: 'Xem thống kê tháng & năm miễn phí cho tất cả. Không cần Pro!',
        date: '2026-02-21',
        color: '#22d3ee',
    },
    {
        id: 'ai-insights-2026-02',
        icon: <Sparkles size={15} />,
        title: 'AI Weekly Insights',
        titleVi: 'AI Insights Hàng Tuần',
        desc: 'Pro users now get weekly AI-powered productivity reports with score tracking.',
        descVi: 'User Pro nhận báo cáo năng suất AI hàng tuần kèm điểm số.',
        date: '2026-02-21',
        color: '#f59e0b',
    },
];

export function NotificationCenter() {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [lastRead, setLastRead] = useState<number>(0);

    const isVi = navigator.language.startsWith('vi');

    // Load last read timestamp
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setLastRead(parseInt(stored, 10));
    }, []);

    // Count unread
    const unreadCount = NOTIFICATIONS.filter(
        (n) => new Date(n.date).getTime() > lastRead
    ).length;

    // Mark all as read when opened
    useEffect(() => {
        if (open && unreadCount > 0) {
            const now = Date.now();
            localStorage.setItem(STORAGE_KEY, now.toString());
            setLastRead(now);
        }
    }, [open]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={panelRef} className="relative">
            {/* Bell button — matches qs-gear-btn style */}
            <button
                className="nc-bell-btn"
                onClick={() => setOpen(!open)}
                title={isVi ? 'Thông báo' : 'Notifications'}
                style={open ? { background: 'rgba(255,255,255,0.12)' } : undefined}
            >
                <Bell size={17} style={{ color: 'rgba(255,255,255,0.6)' }} />
                {/* Unread badge */}
                {unreadCount > 0 && (
                    <span className="nc-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="nc-panel">
                    {/* Header */}
                    <div className="nc-header">
                        <span className="nc-title">
                            {isVi ? '🔔 Thông báo' : '🔔 Notifications'}
                        </span>
                        <button className="nc-close" onClick={() => setOpen(false)}>
                            <X size={14} />
                        </button>
                    </div>

                    {/* Notification list */}
                    <div className="nc-list">
                        {NOTIFICATIONS.map((n, i) => (
                            <div key={n.id}>
                                <div className="nc-item">
                                    <div
                                        className="nc-icon"
                                        style={{ color: n.color, background: `${n.color}15` }}
                                    >
                                        {n.icon}
                                    </div>
                                    <div className="nc-content">
                                        <span className="nc-item-title">
                                            {isVi ? n.titleVi : n.title}
                                        </span>
                                        <span className="nc-item-desc">
                                            {isVi ? n.descVi : n.desc}
                                        </span>
                                        <span className="nc-item-date">
                                            {new Date(n.date).toLocaleDateString(isVi ? 'vi-VN' : 'en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>
                                {i < NOTIFICATIONS.length - 1 && <div className="nc-sep" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .nc-bell-btn {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    background: rgba(0, 0, 0, 0.35);
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                .nc-bell-btn:hover {
                    background: rgba(255, 255, 255, 0.12);
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .nc-bell-btn:hover svg {
                    color: rgba(255, 255, 255, 0.9) !important;
                }

                .nc-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 18px;
                    border-radius: 9px;
                    background: #ef4444;
                    color: white;
                    font-size: 10px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0 4px;
                    box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
                    animation: ncBadgePulse 2s ease-in-out infinite;
                }
                @keyframes ncBadgePulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                .nc-panel {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    width: 340px;
                    max-height: 420px;
                    border-radius: 16px;
                    background: rgba(18, 18, 24, 0.92);
                    backdrop-filter: blur(24px) saturate(1.4);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
                    animation: ncIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                @keyframes ncIn {
                    from { opacity: 0; transform: translateY(-4px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .nc-header {
                    padding: 14px 16px 10px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .nc-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                    letter-spacing: 0.2px;
                }
                .nc-close {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.3);
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .nc-close:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.7);
                }

                .nc-list {
                    padding: 6px 0;
                    overflow-y: auto;
                    flex: 1;
                }

                .nc-item {
                    display: flex;
                    gap: 12px;
                    padding: 12px 16px;
                    transition: background 0.15s;
                }
                .nc-item:hover {
                    background: rgba(255, 255, 255, 0.03);
                }

                .nc-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                .nc-content {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: 0;
                }
                .nc-item-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.85);
                    line-height: 1.3;
                }
                .nc-item-desc {
                    font-size: 12px;
                    font-weight: 400;
                    color: rgba(255, 255, 255, 0.45);
                    line-height: 1.4;
                }
                .nc-item-date {
                    font-size: 10px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.2);
                    margin-top: 2px;
                }

                .nc-sep {
                    height: 1px;
                    margin: 0 16px;
                    background: rgba(255, 255, 255, 0.04);
                }
            `}</style>
        </div>
    );
}
