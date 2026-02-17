import { useEffect, useRef, useState } from 'react';

/**
 * Auto-hide HUD system.
 * Tracks mouse movement and hides UI after `delay` ms of inactivity.
 * Returns `hudVisible` state.
 */
export function useAutoHide(delay = 5000) {
    const [hudVisible, setHudVisible] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const resetTimer = () => {
            setHudVisible(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setHudVisible(false), delay);
        };

        // Start initial timer
        timerRef.current = setTimeout(() => setHudVisible(false), delay);

        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('mousedown', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('touchstart', resetTimer);

        return () => {
            clearTimeout(timerRef.current);
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('mousedown', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('touchstart', resetTimer);
        };
    }, [delay]);

    return hudVisible;
}
