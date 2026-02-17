import { useState, useEffect } from 'react';
import { useLofiStore } from '../../store/useLofiStore';

/**
 * ClockDisplay — Top-center real-time clock + date.
 * Controlled by the "Show Date" toggle in Quick Settings.
 */

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const MONTH_NAMES_VI = ['Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06', 'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12'];

export function ClockDisplay() {
    const showClock = useLofiStore((s) => s.showClock);
    const use24hFormat = useLofiStore((s) => s.use24hFormat);
    const locale = useLofiStore((s) => s.locale);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        if (!showClock) return;
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, [showClock]);

    if (!showClock) return null;

    // Time
    let hours: number | string = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    let ampm = '';
    if (!use24hFormat) {
        ampm = hours >= 12 ? ' PM' : ' AM';
        hours = hours % 12 || 12;
    }
    hours = String(hours).padStart(2, '0');

    // Date
    const dayNames = locale === 'vi' ? DAY_NAMES_VI : DAY_NAMES_EN;
    const monthNames = locale === 'vi' ? MONTH_NAMES_VI : MONTH_NAMES_EN;
    const dateStr = `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`;

    return (
        <div
            className="pointer-events-none"
            style={{
                position: 'fixed',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 40,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                userSelect: 'none',
            }}
        >
            {/* Real-time clock */}
            <span
                style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.7)',
                    letterSpacing: '1.5px',
                    textShadow: '0 1px 10px rgba(0,0,0,0.4)',
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {hours}:{minutes}{ampm}
            </span>

            {/* Separator */}
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>·</span>

            {/* Date */}
            <span
                style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'rgba(255, 255, 255, 0.5)',
                    letterSpacing: '1.5px',
                    textShadow: '0 1px 10px rgba(0,0,0,0.4)',
                }}
            >
                {dateStr}
            </span>
        </div>
    );
}
