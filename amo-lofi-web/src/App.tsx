import { useLofiStore } from './store/useLofiStore';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoHide } from './hooks/useAutoHide';
import { useTheme } from './hooks/useTheme';
import { useBinauralBeats } from './hooks/useBinauralBeats';
import { SceneBackground } from './components/scene/SceneBackground';
import { SceneSelector } from './components/scene/SceneSelector';
import { Sidebar } from './components/layout/Sidebar';
import { MobileMenu } from './components/layout/MobileMenu';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { OverlayEffects } from './components/effects/OverlayEffects';
import { AmbientGlow } from './components/effects/AmbientGlow';
import { SoundMixer } from './components/mixer/SoundMixer';
import { FocusPanel } from './components/focus/FocusPanel';
import { StatsDashboard } from './components/focus/StatsDashboard';
import { HeroTimer } from './components/focus/HeroTimer';

import { ClockDisplay } from './components/layout/ClockDisplay';
import { QuickSettings } from './components/layout/QuickSettings';
import { UserProfile } from './components/auth/UserProfile';
import { PlayerBar } from './components/audio/PlayerBar';
import { ProUpgradeModal } from './components/pro/ProUpgradeModal';
import { useProGate } from './hooks/useProGate';
import { useTranslation } from './hooks/useTranslation';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { LoginModal } from './components/auth/LoginModal';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { useState, useRef, useEffect } from 'react';
import { useSyncBridge } from './hooks/useSyncBridge';

function App() {
  useAudioEngine();
  useBinauralBeats();
  useKeyboardShortcuts();
  const hudVisible = useAutoHide(5000);
  useTheme(); // Applies CSS custom properties for active scene

  const activePanel = useLofiStore((s) => s.activePanel);
  const zenMode = useLofiStore((s) => s.zenMode);
  const togglePanel = useLofiStore((s) => s.togglePanel);
  const toggleZenMode = useLofiStore((s) => s.toggleZenMode);

  const showPlayerBar = useLofiStore((s) => s.showPlayerBar);
  const showBranding = useLofiStore((s) => s.showBranding);
  const isPlaying = useLofiStore((s) => s.isPlaying);
  const { isPro, upsellVisible, showUpsell, dismissUpsell } = useProGate();
  const { t } = useTranslation();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { profile, isLoading: profileLoading, refresh: refreshProfile } = useProfile();
  useSyncBridge(user?.id); // Broadcast state to Extension via Supabase
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true); // default true to avoid flash
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Show onboarding for new users who haven't completed it
  useEffect(() => {
    if (user && !profileLoading && profile) {
      setOnboardingDone(profile.onboarding_completed);
    } else if (!user) {
      setOnboardingDone(true);
    }
  }, [user, profile, profileLoading]);

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  // ── Escape key closes active panel ──
  useEffect(() => {
    if (!activePanel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') togglePanel(activePanel);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activePanel, togglePanel]);


  return (
    <>
      <LoadingScreen />

      <div className="relative w-full h-full overflow-hidden">
        {/* ═══ Full-Screen Background ═══ */}
        <SceneBackground>
          <OverlayEffects />
          <AmbientGlow />

          {/* ═══ Hero Timer — centered, always visible (including Zen) ═══ */}
          <HeroTimer />

          {/* ═══ HUD Layer — auto-hides after idle ═══ */}
          <div
            className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-800
              ${hudVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* Hover Sidebar — hidden in Zen, hidden on mobile (replaced by MobileMenu) */}
            {!zenMode && (
              <div className="pointer-events-auto desktop-sidebar">
                <Sidebar />
              </div>
            )}

            {/* Mobile hamburger menu — shown on mobile, hidden on desktop */}
            {!zenMode && <MobileMenu />}

            {/* ── AmoLofi branding — top left ── */}
            {!zenMode && showBranding && (
              <div className="pointer-events-auto absolute top-4 left-4 flex items-center gap-2 z-50">
                {/* Logo icon */}
                <div className="flex items-center gap-2">
                  <img
                    src="/amo-icon.png"
                    alt="AmoLofi"
                    width={28}
                    height={28}
                    className="shrink-0 rounded-full"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.4))' }}
                  />
                  <span
                    className="text-sm font-semibold tracking-wide"
                    style={{
                      background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: 'none',
                    }}
                  >
                    AmoLofi
                  </span>
                </div>

                {/* Pro crown button */}
                {!isPro && (
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all duration-200 cursor-pointer hover:scale-105"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(139,92,246,0.15))',
                      border: '1px solid rgba(245,158,11,0.25)',
                    }}
                    onClick={() => showUpsell('branding')}
                    title={t('app.upgradeToPro')}
                  >
                    <span className="text-sm">👑</span>
                    <span className="text-[10px] font-semibold bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">
                      PRO
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Date display — top center, controlled by showDate toggle */}
            <ClockDisplay />

            {/* ── Top-right: Auth + Zen exit ── */}
            <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-3 z-50">
              {/* Quick Settings gear */}
              {!zenMode && <QuickSettings />}
              {zenMode && (
                <button
                  className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10
                    text-xs text-white/40 hover:text-white hover:bg-black/60 transition-all duration-300 cursor-pointer"
                  onClick={toggleZenMode}
                >
                  {t('app.exitZen')}
                </button>
              )}

              {/* Auth button */}
              {!zenMode && !authLoading && (
                <>
                  {user ? (
                    <div ref={userMenuRef} className="relative">
                      <button
                        className="flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all duration-200 cursor-pointer hover:bg-white/10"
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          backdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                        onClick={() => setShowUserMenu(prev => !prev)}
                        title={user.email || ''}
                      >
                        {user.user_metadata?.avatar_url ? (
                          <img
                            src={user.user_metadata.avatar_url}
                            alt=""
                            width={26}
                            height={26}
                            className="rounded-full"
                            style={{ border: '2px solid rgba(74,222,128,0.4)' }}
                          />
                        ) : (
                          <div
                            className="flex items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              width: 26, height: 26,
                              background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                              color: '#0a0a0a',
                            }}
                          >
                            {(user.email?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-white/70 max-w-[100px] truncate hidden sm:block">
                          {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                        </span>
                      </button>

                      {/* Dropdown menu */}
                      {showUserMenu && (
                        <div
                          className="absolute right-0 top-full mt-2 overflow-hidden"
                          style={{
                            width: 280,
                            borderRadius: 16,
                            background: 'rgba(18, 18, 24, 0.92)',
                            backdropFilter: 'blur(24px) saturate(1.4)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
                            animation: 'qsIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                          }}
                        >
                          {/* Header — matches QuickSettings header */}
                          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', letterSpacing: 0.2 }}>
                              Account
                            </span>
                          </div>

                          {/* User info row — matches qs-row style */}
                          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            {user.user_metadata?.avatar_url ? (
                              <img
                                src={user.user_metadata.avatar_url}
                                alt=""
                                width={36}
                                height={36}
                                className="rounded-full shrink-0"
                                style={{ border: '2px solid rgba(74,222,128,0.35)' }}
                              />
                            ) : (
                              <div
                                className="flex items-center justify-center rounded-full text-sm font-bold shrink-0"
                                style={{
                                  width: 36, height: 36,
                                  background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                                  color: '#0a0a0a',
                                }}
                              >
                                {(user.email?.[0] || 'U').toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)' }} className="truncate">
                                {user.user_metadata?.full_name || user.email?.split('@')[0]}
                              </p>
                              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255, 255, 255, 0.35)' }} className="truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          {/* Separator */}
                          <div style={{ height: 1, margin: '0 16px', background: 'rgba(255, 255, 255, 0.04)' }} />

                          {/* Plan row — matches qs-row */}
                          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255, 255, 255, 0.85)' }}>
                                {isPro ? '👑 Pro Plan' : '🎵 Free Plan'}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.35)' }}>
                                {isPro ? 'All features unlocked' : 'Upgrade for more'}
                              </span>
                            </div>
                            <button
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '5px 12px',
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,211,238,0.15))',
                                color: '#4ade80',
                                border: '1px solid rgba(74,222,128,0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,222,128,0.25), rgba(34,211,238,0.25))'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(34,211,238,0.15))'; }}
                              onClick={() => {
                                setShowUserMenu(false);
                                showUpsell('dropdown');
                              }}
                            >
                              {isPro ? 'Buy Credits' : 'Upgrade'}
                            </button>
                          </div>

                          {/* Separator */}
                          <div style={{ height: 1, margin: '0 16px', background: 'rgba(255, 255, 255, 0.04)' }} />

                          {/* Menu items — matches qs-row click style */}
                          <div style={{ padding: '6px 0' }}>
                            <button
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: 'transparent',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'rgba(255, 255, 255, 0.85)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowProfile(true);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                              {t('profile.myProfile')}
                            </button>

                            <div style={{ height: 1, margin: '0 16px', background: 'rgba(255, 255, 255, 0.04)' }} />

                            <button
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: 'transparent',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                fontSize: 13,
                                fontWeight: 500,
                                color: 'rgba(255, 120, 120, 0.7)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,80,80,0.06)'; e.currentTarget.style.color = '#ff6b6b'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,120,120,0.7)'; }}
                              onClick={async () => {
                                setShowUserMenu(false);
                                await signOut();
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                              </svg>
                              {t('auth.signOut')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(34,211,238,0.2))',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(74,222,128,0.3)',
                        boxShadow: '0 0 20px rgba(74,222,128,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
                      }}
                      onClick={() => setShowLoginModal(true)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span
                        className="text-sm font-semibold"
                        style={{
                          background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >{t('auth.signIn')}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ═══ Floating Panels ═══ */}
          {activePanel && (
            <>
              {/* Click-outside overlay with subtle dim */}
              <div
                className="absolute inset-0 z-35 animate-panel-backdrop"
                onClick={() => togglePanel(activePanel)}
              />

              {/* Panel container — Scenes (centered) */}
              {activePanel === 'scenes' && (
                <div className="absolute z-40 top-4 bottom-16 left-20 flex flex-col mobile-panel-container">
                  <div className="animate-panel-in flex flex-col max-h-full my-auto">
                    <SceneSelector onClose={() => togglePanel('scenes')} />
                  </div>
                </div>
              )}

              {/* Panel container — Focus (full-height) */}
              {activePanel === 'focus' && (
                <div className="absolute z-40 top-3 bottom-16 left-20 flex flex-col mobile-panel-container">
                  <div className="animate-panel-in h-full">
                    <FocusPanel onClose={() => togglePanel('focus')} />
                  </div>
                </div>
              )}

              <div className="absolute z-40 top-3 bottom-16 right-4 flex flex-col mobile-panel-container">
                <div className="animate-panel-in h-full">
                  {activePanel === 'mixer' && (
                    <SoundMixer onClose={() => togglePanel('mixer')} />
                  )}
                </div>
              </div>

              {/* Stats Dashboard — centered modal overlay */}
              {activePanel === 'stats' && (
                <StatsDashboard onClose={() => togglePanel('stats')} />
              )}
            </>
          )}

          {/* ═══ Player Bar — bottom, always slightly visible ═══ */}
          {showPlayerBar && (
            <div className={`
              absolute bottom-0 left-0 right-0 z-20
              transition-opacity duration-800
              ${zenMode ? 'opacity-0 pointer-events-none' : hudVisible ? 'opacity-100' : 'opacity-30 hover:opacity-100'}
            `}>
              <PlayerBar />
            </div>
          )}

          {/* ═══ Playing indicator — visible when HUD hidden & music playing ═══ */}
          {isPlaying && !hudVisible && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 transition-opacity duration-500">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: 'var(--theme-primary, #4ade80)',
                  boxShadow: '0 0 8px var(--theme-primary-glow, rgba(74,222,128,0.4))',
                  animation: 'playingPulse 2s ease-in-out infinite',
                }}
              />
            </div>
          )}
        </SceneBackground>
      </div>

      {/* ═══ Pro Upgrade Modal (global) ═══ */}
      {upsellVisible && <ProUpgradeModal onClose={dismissUpsell} />}

      {/* ═══ Login Modal ═══ */}
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* ═══ User Profile Modal ═══ */}
      {showProfile && <UserProfile onClose={() => setShowProfile(false)} onUpgrade={() => showUpsell('profile')} />}

      {/* ═══ Onboarding Modal — shown once for new users ═══ */}
      {user && !onboardingDone && !profileLoading && (
        <OnboardingModal onComplete={() => { setOnboardingDone(true); refreshProfile(); }} />
      )}
    </>
  );
}

export default App;
