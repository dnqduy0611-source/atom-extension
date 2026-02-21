import { useState, useEffect, useRef } from 'react';

const INTRO_KEY = 'amo_intro_done';
const INTRO_SESSION_COOKIE = 'amo_intro_session';

/**
 * LoadingScreen — Plays the AmoLofi intro video (3s) then fades out.
 * Falls back to a static logo splash if video fails to load.
 * Uses session cookie + localStorage: plays once per Chrome session.
 */
export function LoadingScreen() {
    // Session cookie = cleared when Chrome closes
    const isExistingSession = document.cookie.includes(`${INTRO_SESSION_COOKIE}=1`);

    if (!isExistingSession) {
        // New Chrome session → clear old "done" flag & set session cookie
        localStorage.removeItem(INTRO_KEY);
        document.cookie = `${INTRO_SESSION_COOKIE}=1; path=/; SameSite=Lax`;
    }

    const alreadyPlayed = localStorage.getItem(INTRO_KEY) === '1';
    const [show, setShow] = useState(!alreadyPlayed);
    const [fadeOut, setFadeOut] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const markDone = () => {
        localStorage.setItem(INTRO_KEY, '1');
    };

    // Fallback: if video doesn't end in 3.5s, force fade out
    useEffect(() => {
        if (!show || fadeOut) return;

        const fallback = setTimeout(() => {
            markDone();
            setFadeOut(true);
            setTimeout(() => setShow(false), 800);
        }, 3500);

        // Cut video at 3s mark
        const video = videoRef.current;
        if (video) {
            const onTime = () => {
                if (video.currentTime >= 3) {
                    video.removeEventListener('timeupdate', onTime);
                    handleVideoEnd();
                }
            };
            video.addEventListener('timeupdate', onTime);
            return () => {
                clearTimeout(fallback);
                video.removeEventListener('timeupdate', onTime);
            };
        }

        return () => clearTimeout(fallback);
    }, [show, fadeOut]);

    const handleVideoEnd = () => {
        markDone();
        setFadeOut(true);
        setTimeout(() => setShow(false), 800);
    };

    const handleVideoError = () => {
        setVideoError(true);
        // Show static fallback for 2s then fade
        setTimeout(() => {
            setFadeOut(true);
            setTimeout(() => setShow(false), 800);
        }, 2000);
    };

    if (!show) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a14',
                transition: 'opacity 0.8s ease-out',
                opacity: fadeOut ? 0 : 1,
            }}
        >
            {!videoError ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onEnded={handleVideoEnd}
                    onError={handleVideoError}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                >
                    <source src="/assets/intro.mp4" type="video/mp4" />
                </video>
            ) : (
                /* Fallback: static logo */
                <div style={{ textAlign: 'center' }}>
                    <img
                        src="/amo-icon.png"
                        alt="AmoLofi"
                        width={80}
                        height={80}
                        style={{
                            borderRadius: '50%',
                            filter: 'drop-shadow(0 0 20px rgba(74,222,128,0.5))',
                            marginBottom: 16,
                        }}
                    />
                    <h1
                        style={{
                            fontSize: 24,
                            fontWeight: 600,
                            background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            margin: 0,
                        }}
                    >
                        Amo Lofi
                    </h1>
                </div>
            )}
        </div>
    );
}
