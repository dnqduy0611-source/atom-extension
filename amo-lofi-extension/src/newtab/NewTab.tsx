import { useState, useEffect, lazy, Suspense } from 'react';
import { SceneBackground } from '../components/SceneBackground';
import { CinematicClock } from '../components/CinematicClock';
import { TimerPanel } from '../components/TimerPanel';
import { TeleportToast } from '../components/TeleportToast';
import { Dock } from '../components/Dock';
import { TopSites } from '../components/TopSites';
import { useTimerState } from '../hooks/useTimerState';
import { useTimerSync } from '../hooks/useTimerSync';
import { useScene } from '../hooks/useScene';

// ── Lazy-loaded components (not needed at first paint) ──
const ParkingLot = lazy(() => import('../components/ParkingLot').then(m => ({ default: m.ParkingLot })));
const SettingsPanel = lazy(() => import('../components/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const Onboarding = lazy(() => import('../components/Onboarding').then(m => ({ default: m.Onboarding })));
const RatingPrompt = lazy(() => import('../components/RatingPrompt').then(m => ({ default: m.RatingPrompt })));

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
}

/** Simple search icon SVG */
const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
    </svg>
);

function isUrl(text: string): boolean {
    return /^(https?:\/\/|www\.)/.test(text) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(text);
}

/** Hook to get parking lot count reactively via batched storage read */
function useParkingCount(): number {
    const [count, setCount] = useState(0);
    useEffect(() => {
        chrome.storage.local.get('parkingLot').then((result) => {
            setCount((result.parkingLot as any[])?.length || 0);
        });
        const listener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            if (area === 'local' && changes.parkingLot) {
                setCount((changes.parkingLot.newValue as any[])?.length || 0);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);
    return count;
}

export function NewTab() {
    const [greeting] = useState(getGreeting());
    const { sceneId, wallpaperId, cloudBgUrl } = useScene();
    const [focusTask, setFocusTask] = useState('');
    const [taskSubmitted, setTaskSubmitted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTimer, setShowTimer] = useState(false);
    const [showParking, setShowParking] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [ready, setReady] = useState(false);
    const timer = useTimerState();
    useTimerSync(); // Supabase Realtime sync with AmoLofi Web
    const parkingCount = useParkingCount();

    const timerActive = timer.mode !== 'idle' || showTimer;

    // Fade-in after mount
    useEffect(() => {
        requestAnimationFrame(() => setReady(true));
    }, []);

    // Load persisted focus task from chrome.storage
    useEffect(() => {
        chrome.storage.local.get('focusTask').then((result) => {
            if (result.focusTask) {
                setFocusTask(result.focusTask as string);
                setTaskSubmitted(true);
            }
        });
    }, []);

    const handleTaskSubmit = () => {
        const trimmed = focusTask.trim();
        if (!trimmed) return;
        setTaskSubmitted(true);
        setShowTimer(true);
        chrome.storage.local.set({ focusTask: trimmed });
    };

    const handleTaskClear = () => {
        setFocusTask('');
        setTaskSubmitted(false);
        chrome.storage.local.remove('focusTask');
    };

    const handleSearch = () => {
        const q = searchQuery.trim();
        if (!q) return;
        if (isUrl(q)) {
            const url = q.startsWith('http') ? q : `https://${q}`;
            window.location.href = url;
        } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        }
    };

    /** SVG target icon for focus task */
    const FocusIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );

    return (
        <SceneBackground sceneId={sceneId} wallpaperId={wallpaperId} cloudBgUrl={cloudBgUrl}>
            <div className={`sanctuary ${ready ? 'ready' : ''}`}>
                <TeleportToast />
                <Suspense fallback={null}>
                    <Onboarding />
                    <RatingPrompt />
                </Suspense>

                {/* Center content */}
                <div className="center-content">
                    {timerActive ? (
                        <>
                            <TimerPanel />
                            {/* Focus task below timer */}
                            {taskSubmitted && (
                                <div className="focus-task-display">
                                    <span className="focus-task-icon"><FocusIcon /></span>
                                    <span className="focus-task-text">{focusTask}</span>
                                    <button
                                        className="focus-task-clear"
                                        onClick={handleTaskClear}
                                        title="Clear task"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <CinematicClock />

                            {taskSubmitted ? (
                                /* ── Focus Task Display (no timer) ── */
                                <div className="focus-task-display">
                                    <span className="focus-task-icon"><FocusIcon /></span>
                                    <span className="focus-task-text">{focusTask}</span>
                                    <button
                                        className="focus-task-clear"
                                        onClick={handleTaskClear}
                                        title="Clear task"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="greeting">{greeting}.</p>
                                    <input
                                        type="text"
                                        className="focus-input"
                                        placeholder="What is your main focus today?"
                                        value={focusTask}
                                        onChange={(e) => setFocusTask(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && focusTask.trim()) {
                                                handleTaskSubmit();
                                            }
                                        }}
                                    />
                                </>
                            )}

                            {/* Google Search Bar */}
                            <div className="search-bar">
                                <span className="search-bar-icon"><SearchIcon /></span>
                                <input
                                    type="text"
                                    className="search-bar-input"
                                    placeholder="Search Google or type a URL"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch();
                                    }}
                                />
                            </div>
                            <TopSites />
                        </>
                    )}
                </div>

                {/* Lazy-loaded panels */}
                <Suspense fallback={null}>
                    <ParkingLot
                        visible={showParking}
                        onClose={() => setShowParking(false)}
                    />
                </Suspense>

                <Suspense fallback={null}>
                    <SettingsPanel
                        visible={showSettings}
                        onClose={() => setShowSettings(false)}
                    />
                </Suspense>

                {/* Dock */}
                <Dock
                    onToggleTimer={() => setShowTimer((v) => !v)}
                    timerActive={timerActive}
                    onToggleParking={() => setShowParking((v) => !v)}
                    parkingCount={parkingCount}
                    onOpenSettings={() => setShowSettings((v) => !v)}
                />
            </div>
        </SceneBackground>
    );
}
