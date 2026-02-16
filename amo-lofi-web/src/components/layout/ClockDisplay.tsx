import { useState, useEffect } from 'react';
import { useLofiStore } from '../../store/useLofiStore';
import type { ClockStyle } from '../../store/useLofiStore';

/**
 * ClockDisplay — A large, centered clock with selectable font styles.
 * Inspired by Beeziee's clock customization.
 * 6 styles: Classic, Serif, Bold, Soft, Creative, Mono.
 * Supports 12h/24h format and optional date display.
 */

const CLOCK_FONTS: Record<ClockStyle, { fontFamily: string; fontWeight: number; letterSpacing: string }> = {
    classic: { fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 300, letterSpacing: '4px' },
    serif: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, letterSpacing: '3px' },
    bold: { fontFamily: "'Inter', -apple-system, sans-serif", fontWeight: 800, letterSpacing: '2px' },
    soft: { fontFamily: "'Quicksand', sans-serif", fontWeight: 400, letterSpacing: '6px' },
    creative: { fontFamily: "'Caveat', cursive", fontWeight: 400, letterSpacing: '2px' },
    mono: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 400, letterSpacing: '6px' },
};

const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES_VI = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const MONTH_NAMES_VI = ['Th01', 'Th02', 'Th03', 'Th04', 'Th05', 'Th06', 'Th07', 'Th08', 'Th09', 'Th10', 'Th11', 'Th12'];

export function ClockDisplay() {
    const clockStyle = useLofiStore((s) => s.clockStyle);
    const use24hFormat = useLofiStore((s) => s.use24hFormat);
    const showDate = useLofiStore((s) => s.showDate);
    const locale = useLofiStore((s) => s.locale);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Time formatting
    let hours: number | string = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    let ampm = '';

    if (!use24hFormat) {
        ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
    }
    hours = String(hours).padStart(2, '0');

    // Date formatting
    const dayNames = locale === 'vi' ? DAY_NAMES_VI : DAY_NAMES_EN;
    const monthNames = locale === 'vi' ? MONTH_NAMES_VI : MONTH_NAMES_EN;
    const dateStr = `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`;

    const font = CLOCK_FONTS[clockStyle];

    return (
        <div className="clock-display" style={{ pointerEvents: 'none' }}>
            <div
                className="clock-time"
                style={{
                    fontFamily: font.fontFamily,
                    fontWeight: font.fontWeight,
                    letterSpacing: font.letterSpacing,
                }}
            >
                <span>{hours}</span>
                <span className="clock-colon">:</span>
                <span>{minutes}</span>
                {!use24hFormat && (
                    <span className="clock-ampm">{ampm}</span>
                )}
            </div>

            {showDate && (
                <div className="clock-date" style={{ fontFamily: font.fontFamily }}>
                    {dateStr}
                </div>
            )}

            <style>{`
                .clock-display {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 15;
                    user-select: none;
                    text-align: center;
                }
                .clock-time {
                    font-size: clamp(64px, 10vw, 120px);
                    color: rgba(255, 255, 255, 0.85);
                    text-shadow:
                        0 2px 20px rgba(0, 0, 0, 0.4),
                        0 0 60px rgba(0, 0, 0, 0.2);
                    line-height: 1;
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                }
                .clock-colon {
                    opacity: 0.6;
                    animation: clockPulse 2s ease-in-out infinite;
                    margin: 0 2px;
                }
                .clock-ampm {
                    font-size: 0.25em;
                    font-weight: 400;
                    opacity: 0.5;
                    margin-left: 8px;
                    letter-spacing: 2px;
                    align-self: flex-end;
                    margin-bottom: 0.1em;
                }
                .clock-date {
                    margin-top: 8px;
                    font-size: clamp(14px, 2vw, 18px);
                    font-weight: 400;
                    color: rgba(255, 255, 255, 0.45);
                    letter-spacing: 2px;
                    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.3);
                }
                @keyframes clockPulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.2; }
                }
            `}</style>
        </div>
    );
}
