import { useState, useEffect } from 'react';

/**
 * CinematicClock — Large center clock with date.
 * Inspired by AmoLofi web but adapted for extension New Tab.
 */
export function CinematicClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}`;

    return (
        <div className="clock-container">
            <div className="clock-time">
                <span className="clock-hours">{hours}</span>
                <span className="clock-separator">:</span>
                <span className="clock-minutes">{minutes}</span>
            </div>
            <div className="clock-date">{dateStr}</div>
        </div>
    );
}
