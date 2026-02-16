/**
 * UserProfile — Beeziee-style profile modal
 *
 * Shows user avatar, welcome message, plan status,
 * user info, linked Google account, and sign out.
 */

import { useAuth } from '../../hooks/useAuth';
import { useProGate } from '../../hooks/useProGate';
import { useTranslation } from '../../hooks/useTranslation';

interface Props {
    onClose: () => void;
    onUpgrade: () => void;
}

export function UserProfile({ onClose, onUpgrade }: Props) {
    const { user, signOut } = useAuth();
    const { isPro } = useProGate();
    const { t } = useTranslation();

    if (!user) return null;

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const avatarUrl = user.user_metadata?.avatar_url;
    const email = user.email || '';
    const initial = (displayName[0] || 'U').toUpperCase();
    const provider = user.app_metadata?.provider || 'google';

    const handleSignOut = async () => {
        await signOut();
        onClose();
    };

    return (
        <div
            className="up-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="up-modal">
                {/* Close */}
                <button className="up-close" onClick={onClose} aria-label="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                </button>

                {/* ── Welcome Header ── */}
                <div className="up-header">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="up-avatar" />
                    ) : (
                        <div className="up-avatar up-avatar-fallback">{initial}</div>
                    )}
                    <div className="up-header-info">
                        <h2 className="up-welcome">{t('profile.welcome')}, {displayName.split(' ')[0]}</h2>
                        <p className="up-subtitle">{t('profile.subtitle')}</p>
                    </div>
                </div>

                {/* ── Plan Badge ── */}
                <div className="up-plan-row">
                    <div className="up-plan-left">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                            <path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" />
                        </svg>
                        <div>
                            <span className="up-plan-label">{isPro ? 'Pro Plan' : t('profile.freePlan')}</span>
                            <span className="up-plan-desc">{isPro ? t('profile.proDesc') : t('profile.freeDesc')}</span>
                        </div>
                    </div>
                    {!isPro && (
                        <button className="up-upgrade-btn" onClick={() => { onClose(); onUpgrade(); }}>
                            {t('profile.upgradePro')}
                        </button>
                    )}
                </div>

                {/* ── User Info Section ── */}
                <div className="up-section">
                    <h3 className="up-section-title">{t('profile.userInfo')}</h3>

                    <div className="up-info-row">
                        <div className="up-info-left">
                            <span className="up-info-label">{t('profile.displayName')}</span>
                            <span className="up-info-desc">{t('profile.displayNameDesc')}</span>
                        </div>
                        <span className="up-info-value">{displayName}</span>
                    </div>

                    <div className="up-divider" />

                    <div className="up-info-row">
                        <div className="up-info-left">
                            <span className="up-info-label">Email</span>
                            <span className="up-info-desc">{t('profile.emailDesc')}</span>
                        </div>
                        <span className="up-info-value">{email}</span>
                    </div>
                </div>

                {/* ── Linked Accounts ── */}
                <div className="up-section">
                    <h3 className="up-section-title">{t('profile.linkedAccounts')}</h3>

                    <div className="up-info-row">
                        <div className="up-info-left" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {/* Google icon */}
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <div>
                                <span className="up-info-label">Google</span>
                                <span className="up-info-desc">{t('profile.googleDesc')}</span>
                            </div>
                        </div>
                        <span className="up-connected-badge">{provider === 'google' ? t('profile.connected') : t('profile.notConnected')}</span>
                    </div>
                </div>

                {/* ── Sign Out ── */}
                <div className="up-section" style={{ borderBottom: 'none' }}>
                    <button className="up-signout-btn" onClick={handleSignOut}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {t('auth.signOut')}
                    </button>
                </div>
            </div>

            <style>{`
                .up-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(12px);
                    animation: upFadeIn 0.2s ease;
                }
                @keyframes upFadeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }

                .up-modal {
                    width: 520px;
                    max-width: 92vw;
                    max-height: 85vh;
                    overflow-y: auto;
                    background: rgba(18, 18, 24, 0.96);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 24px;
                    position: relative;
                    animation: upSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .up-modal::-webkit-scrollbar { width: 4px; }
                .up-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

                @keyframes upSlideIn {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .up-close {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.35);
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    transition: all 0.15s;
                    z-index: 2;
                }
                .up-close:hover {
                    color: rgba(255, 255, 255, 0.8);
                    background: rgba(255, 255, 255, 0.06);
                }

                /* ── Header ── */
                .up-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 32px 28px 24px;
                    background: linear-gradient(135deg, rgba(74,222,128,0.06), rgba(34,211,238,0.04));
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .up-avatar {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    border: 3px solid rgba(74, 222, 128, 0.35);
                    flex-shrink: 0;
                    object-fit: cover;
                }
                .up-avatar-fallback {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #4ade80, #22d3ee);
                    color: #0a0a0a;
                    border: none;
                }
                .up-header-info {
                    flex: 1;
                    min-width: 0;
                }
                .up-welcome {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: -0.02em;
                }
                .up-subtitle {
                    margin: 4px 0 0;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.45);
                }

                /* ── Plan ── */
                .up-plan-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 28px;
                    margin: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .up-plan-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .up-plan-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.85);
                }
                .up-plan-desc {
                    display: block;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.35);
                }
                .up-upgrade-btn {
                    padding: 8px 20px;
                    border-radius: 10px;
                    border: none;
                    background: linear-gradient(135deg, #4ade80, #22d3ee);
                    color: #0a0a0a;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .up-upgrade-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(74, 222, 128, 0.3);
                }

                /* ── Sections ── */
                .up-section {
                    padding: 20px 28px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .up-section-title {
                    margin: 0 0 14px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: rgba(255, 255, 255, 0.35);
                }

                /* ── Info Rows ── */
                .up-info-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }
                .up-info-left {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    min-width: 0;
                }
                .up-info-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: rgba(255, 255, 255, 0.85);
                }
                .up-info-desc {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.3);
                }
                .up-info-value {
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.55);
                    text-align: right;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 200px;
                }
                .up-divider {
                    height: 1px;
                    margin: 12px 0;
                    background: rgba(255, 255, 255, 0.04);
                }

                /* ── Connected Badge ── */
                .up-connected-badge {
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    background: rgba(74, 222, 128, 0.12);
                    color: #4ade80;
                    border: 1px solid rgba(74, 222, 128, 0.15);
                }

                /* ── Sign Out ── */
                .up-signout-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    border-radius: 10px;
                    border: 1px solid rgba(255, 80, 80, 0.12);
                    background: rgba(255, 80, 80, 0.06);
                    color: rgba(255, 120, 120, 0.8);
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    width: 100%;
                    justify-content: center;
                }
                .up-signout-btn:hover {
                    background: rgba(255, 80, 80, 0.12);
                    color: #ff6b6b;
                    border-color: rgba(255, 80, 80, 0.25);
                }
            `}</style>
        </div>
    );
}
