import { useLofiStore } from './store/useLofiStore';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAutoHide } from './hooks/useAutoHide';
import { useTheme } from './hooks/useTheme';
import { useBinauralBeats } from './hooks/useBinauralBeats';
import { SceneBackground } from './components/scene/SceneBackground';
import { SceneSelector } from './components/scene/SceneSelector';
import { Sidebar } from './components/layout/Sidebar';
import { LoadingScreen } from './components/layout/LoadingScreen';
import { OverlayEffects } from './components/effects/OverlayEffects';
import { AmbientGlow } from './components/effects/AmbientGlow';
import { SoundMixer } from './components/mixer/SoundMixer';
import { FocusPanel } from './components/focus/FocusPanel';
import { StatsDashboard } from './components/focus/StatsDashboard';
import { TimerPill } from './components/focus/TimerPill';
import { PlayerBar } from './components/audio/PlayerBar';
import { ProUpgradeModal } from './components/pro/ProUpgradeModal';
import { useProGate } from './hooks/useProGate';
import { useTranslation } from './hooks/useTranslation';

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
  const { isPro, upsellVisible, showUpsell, dismissUpsell } = useProGate();
  const { t } = useTranslation();


  return (
    <>
      <LoadingScreen />

      <div className="relative w-full h-full overflow-hidden">
        {/* ═══ Full-Screen Background ═══ */}
        <SceneBackground>
          <OverlayEffects />
          <AmbientGlow />

          {/* ═══ HUD Layer — auto-hides after idle ═══ */}
          <div
            className={`absolute inset-0 z-30 pointer-events-none transition-opacity duration-800
              ${hudVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* Hover Sidebar */}
            <div className="pointer-events-auto">
              <Sidebar />
            </div>

            {/* ── AmoLofi branding — top left ── */}
            {!zenMode && (
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

            {/* Timer Pill — top center */}
            <div className="pointer-events-auto">
              <TimerPill />
            </div>

            {/* Zen exit button */}
            {zenMode && (
              <div className="pointer-events-auto absolute top-4 right-4">
                <button
                  className="px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10
                    text-xs text-white/40 hover:text-white hover:bg-black/60 transition-all cursor-pointer"
                  onClick={toggleZenMode}
                >
                  Exit Zen
                </button>
              </div>
            )}
          </div>

          {/* ═══ Floating Panels ═══ */}
          {activePanel && (
            <>
              {/* Click-outside overlay */}
              <div
                className="absolute inset-0 z-35"
                onClick={() => togglePanel(activePanel)}
              />

              {/* Panel container — Scenes (centered) */}
              {activePanel === 'scenes' && (
                <div className="absolute z-40 top-1/2 left-20 -translate-y-1/2">
                  <div className="animate-panel-in">
                    <SceneSelector onClose={() => togglePanel('scenes')} />
                  </div>
                </div>
              )}

              {/* Panel container — Focus (full-height) */}
              {activePanel === 'focus' && (
                <div className="absolute z-40 top-3 bottom-16 left-20 flex flex-col">
                  <div className="animate-panel-in h-full">
                    <FocusPanel onClose={() => togglePanel('focus')} />
                  </div>
                </div>
              )}

              <div className="absolute z-40 top-3 bottom-16 right-4 flex flex-col">
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
          <div className={`
            absolute bottom-0 left-0 right-0 z-20
            transition-opacity duration-800
            ${zenMode ? 'opacity-0 pointer-events-none' : hudVisible ? 'opacity-100' : 'opacity-30 hover:opacity-100'}
          `}>
            <PlayerBar />
          </div>

          {/* ═══ Playing indicator (always visible tiny dot) ═══ */}
          {!zenMode && !hudVisible && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--theme-primary)' }} />
            </div>
          )}
        </SceneBackground>
      </div>

      {/* ═══ Pro Upgrade Modal (global) ═══ */}
      {upsellVisible && <ProUpgradeModal onClose={dismissUpsell} />}
    </>
  );
}

export default App;
