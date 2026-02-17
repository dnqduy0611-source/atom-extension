/**
 * LoginModal — "Sign in with Google" overlay for AmoLofi
 *
 * Shown when an unauthenticated user tries to access a Pro feature
 * (e.g., Create Scene). Matches ProUpgradeModal styling.
 */

import { useAuth } from '../../hooks/useAuth';

interface Props {
    onClose: () => void;
    message?: string;
}

export function LoginModal({ onClose, message }: Props) {
    const { signIn, isLoading } = useAuth();

    const handleSignIn = async () => {
        await signIn();
        // After OAuth redirect, modal won't be visible anymore
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(12px)',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    width: 420,
                    maxWidth: '90vw',
                    background: 'rgba(18, 18, 24, 0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    padding: '48px 36px',
                    textAlign: 'center',
                    position: 'relative',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: 22,
                        cursor: 'pointer',
                        padding: 4,
                        lineHeight: 1,
                    }}
                    aria-label="Close"
                >
                    ✕
                </button>

                {/* Logo / Icon */}
                <div
                    style={{
                        width: 72,
                        height: 72,
                        margin: '0 auto 24px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 32,
                    }}
                >
                    🎵
                </div>

                {/* Title */}
                <h2
                    style={{
                        margin: '0 0 12px',
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '-0.02em',
                    }}
                >
                    Đăng nhập vào AmoLofi
                </h2>

                {/* Subtitle */}
                <p
                    style={{
                        margin: '0 0 32px',
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.5,
                    }}
                >
                    {message || 'Đăng nhập để dùng thử tạo cảnh miễn phí và mở khóa tính năng Pro.'}
                </p>

                {/* Google Sign-In Button */}
                <button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: '#fff',
                        color: '#1a1a2e',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: isLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        opacity: isLoading ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                        if (!isLoading) {
                            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(102,126,234,0.25)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = '';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
                    }}
                >
                    {/* Google logo SVG */}
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    {isLoading ? 'Đang xử lý...' : 'Đăng nhập bằng Google'}
                </button>

                {/* Trial hint */}
                <div
                    style={{
                        marginTop: 24,
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: 'rgba(102,126,234,0.08)',
                        border: '1px solid rgba(102,126,234,0.15)',
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: 'rgba(255,255,255,0.65)',
                            lineHeight: 1.5,
                        }}
                    >
                        🎁 <strong style={{ color: '#667eea' }}>Dùng thử miễn phí</strong> — Tạo 1 cảnh AI miễn phí sau khi đăng nhập
                    </p>
                </div>
            </div>
        </div>
    );
}
