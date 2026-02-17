/**
 * LoginModal — Premium dark-glass sign-in overlay.
 * Matches QuickSettings & panel aesthetic.
 */

import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
    onClose: () => void;
    message?: string;
}

export function LoginModal({ onClose, message }: Props) {
    const { signIn, isLoading } = useAuth();
    const { t } = useTranslation();

    const handleSignIn = async () => {
        await signIn();
    };

    return (
        <div
            className="login-modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="login-modal-card">
                {/* Gradient accent top line */}
                <div className="login-accent-line" />

                {/* Close button */}
                <button className="login-close-btn" onClick={onClose} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Logo */}
                <div className="login-logo">
                    <img src="/amo-icon.png" alt="AmoLofi" width={40} height={40} className="rounded-full" />
                </div>

                {/* Title */}
                <h2 className="login-title">{t('auth.loginTitle')}</h2>

                {/* Subtitle */}
                <p className="login-subtitle">
                    {message || t('auth.loginSubtitle')}
                </p>

                {/* Google Sign-In Button */}
                <button
                    className="login-google-btn"
                    onClick={handleSignIn}
                    disabled={isLoading}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {isLoading ? t('auth.processing') : t('auth.signInWithGoogle')}
                </button>

                {/* Trial hint */}
                <div className="login-hint">
                    <span className="login-hint-icon">🎁</span>
                    <span>{t('auth.trialHint')}</span>
                </div>
            </div>

            <style>{`
                .login-modal-backdrop {
                    position: fixed;
                    inset: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.65);
                    backdrop-filter: blur(16px);
                    animation: loginFadeIn 0.25s ease-out;
                }
                @keyframes loginFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }

                .login-modal-card {
                    width: 380px;
                    max-width: 90vw;
                    border-radius: 20px;
                    background: rgba(18, 18, 24, 0.94);
                    backdrop-filter: blur(24px) saturate(1.4);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow:
                        0 16px 64px rgba(0, 0, 0, 0.5),
                        0 0 0 1px rgba(255, 255, 255, 0.04),
                        inset 0 1px 0 rgba(255, 255, 255, 0.06);
                    overflow: hidden;
                    position: relative;
                    padding: 40px 32px 32px;
                    text-align: center;
                    animation: loginCardIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
                }
                @keyframes loginCardIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .login-accent-line {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, #4ade80, #22d3ee, #8b5cf6);
                    border-radius: 2px 2px 0 0;
                }

                .login-close-btn {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.35);
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .login-close-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: rgba(255, 255, 255, 0.7);
                }

                .login-logo {
                    width: 56px;
                    height: 56px;
                    margin: 0 auto 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,211,238,0.15));
                    border: 1px solid rgba(74,222,128,0.2);
                    padding: 8px;
                }
                .login-logo img {
                    filter: drop-shadow(0 0 6px rgba(74,222,128,0.4));
                }

                .login-title {
                    margin: 0 0 8px;
                    font-size: 20px;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.92);
                    letter-spacing: -0.01em;
                }

                .login-subtitle {
                    margin: 0 0 28px;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.45);
                    line-height: 1.6;
                }

                .login-google-btn {
                    width: 100%;
                    padding: 13px 20px;
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.06);
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: all 0.2s;
                    letter-spacing: 0.2px;
                }
                .login-google-btn:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.18);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }
                .login-google-btn:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }

                .login-hint {
                    margin-top: 20px;
                    padding: 10px 14px;
                    border-radius: 10px;
                    background: rgba(74, 222, 128, 0.06);
                    border: 1px solid rgba(74, 222, 128, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.5);
                    line-height: 1.5;
                }
                .login-hint-icon {
                    font-size: 14px;
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
}
