import { useEffect } from 'react';
import { useLofiStore } from '../store/useLofiStore';

/**
 * Global keyboard shortcuts for the Lofi player.
 *
 *  Space  — Play / Pause
 *  N      — Next track
 *  P      — Previous track
 *  M      — Toggle mixer panel
 *  S      — Toggle scene selector
 *  Z      — Toggle Zen Mode
 *  D      — Toggle Day/Night variant
 *  ↑      — Volume up 5%
 *  ↓      — Volume down 5%
 */
export function useKeyboardShortcuts() {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const state = useLofiStore.getState();

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    state.togglePlay();
                    break;
                case 'n':
                    state.nextTrack();
                    break;
                case 'p':
                    state.prevTrack();
                    break;
                case 'm':
                    state.togglePanel('mixer');
                    break;
                case 's':
                    state.togglePanel('scenes');
                    break;
                case 'f':
                    state.togglePanel('focus');
                    break;
                case 'z':
                    state.toggleZenMode();
                    break;
                case 'd':
                    state.toggleVariant();
                    break;
                case 'arrowup':
                    e.preventDefault();
                    state.setMasterVolume(Math.min(1, state.masterVolume + 0.05));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    state.setMasterVolume(Math.max(0, state.masterVolume - 0.05));
                    break;
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
}
