import { useState, useEffect } from 'react';

/**
 * TeleportToast — Shows a gentle notification when user is redirected
 * from a blocked site back to Sanctuary during Focus Mode.
 * Reads ?reason=blocked&url=... from URL params, auto-dismisses after 5s.
 */

const ShieldIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

export function TeleportToast() {
    const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const url = params.get('url');
        const reason = params.get('reason');

        if (reason === 'blocked' && url) {
            setBlockedUrl(url);
            // Small delay for enter animation
            requestAnimationFrame(() => setVisible(true));

            // Auto-dismiss after 5 seconds
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(() => setBlockedUrl(null), 400); // wait for exit animation
            }, 5000);

            // Clean URL params (so refresh doesn't re-show toast)
            window.history.replaceState({}, '', window.location.pathname);

            return () => clearTimeout(timer);
        }
    }, []);

    if (!blockedUrl) return null;

    let domain = '';
    try {
        domain = new URL(blockedUrl).hostname;
    } catch {
        domain = blockedUrl;
    }

    return (
        <div className={`teleport-toast ${visible ? 'show' : ''}`}>
            <span className="toast-icon"><ShieldIcon /></span>
            <span className="toast-text">
                Saved <strong>{domain}</strong> for your break. Keep flowing.
            </span>
            <button
                className="toast-dismiss"
                onClick={() => {
                    setVisible(false);
                    setTimeout(() => setBlockedUrl(null), 300);
                }}
                aria-label="Dismiss"
            >
                ×
            </button>
        </div>
    );
}
