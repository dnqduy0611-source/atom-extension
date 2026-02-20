import { useState } from 'react';
import { SceneBackground } from '../components/SceneBackground';
import { CinematicClock } from '../components/CinematicClock';
import { TimerPanel } from '../components/TimerPanel';
import { Dock } from '../components/Dock';
import { useTimerState } from '../hooks/useTimerState';

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

export function NewTab() {
    const [greeting] = useState(getGreeting());
    const [sceneId] = useState('cyberpunk_alley');
    const [focusTask, setFocusTask] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTimer, setShowTimer] = useState(false);
    const timer = useTimerState();

    const timerActive = timer.mode !== 'idle' || showTimer;

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

    return (
        <SceneBackground sceneId={sceneId}>
            <div className="sanctuary">
                {/* Center content */}
                <div className="center-content">
                    {timerActive ? (
                        <TimerPanel />
                    ) : (
                        <>
                            <CinematicClock />
                            <p className="greeting">{greeting}.</p>
                            <input
                                type="text"
                                className="focus-input"
                                placeholder="What is your main focus today?"
                                value={focusTask}
                                onChange={(e) => setFocusTask(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && focusTask.trim()) {
                                        setShowTimer(true);
                                    }
                                }}
                            />
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
                        </>
                    )}
                </div>

                {/* Dock */}
                <Dock
                    onToggleTimer={() => setShowTimer((v) => !v)}
                    timerActive={timerActive}
                />
            </div>
        </SceneBackground>
    );
}
