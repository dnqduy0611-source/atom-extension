import { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

export function LoadingScreen() {
    const { t } = useTranslation();
    const [show, setShow] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => setShow(false), 600);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div
            className={`
        fixed inset-0 z-[100] flex items-center justify-center
        bg-[var(--amo-bg)] transition-opacity duration-600
        ${fadeOut ? 'opacity-0' : 'opacity-100'}
      `}
        >
            <div className="text-center">
                {/* Logo */}
                <div className="mb-6">
                    <span className="text-5xl">🎵</span>
                </div>
                <h1 className="text-2xl font-semibold bg-gradient-to-r from-[var(--amo-primary)] to-[var(--amo-accent)] bg-clip-text text-transparent mb-2">
                    Amo Lofi
                </h1>
                <p className="text-sm text-[var(--amo-text-muted)]">
                    {t('loading.tagline')}
                </p>

                {/* Loading bar */}
                <div className="w-40 h-0.5 bg-white/10 rounded-full mt-6 mx-auto overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--amo-primary)] to-[var(--amo-accent)] rounded-full"
                        style={{
                            animation: 'loadingBar 1.5s ease-in-out',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
