/**
 * RatingPrompt — Shows a gentle CWS rating prompt after the user
 * has completed a certain number of focus sessions.
 *
 * Logic:
 * - Tracks focus session completions via chrome.storage
 * - After 5 completed sessions → show prompt
 * - User can "Rate ⭐" (opens CWS link) or "Later" (snooze 10 sessions)
 * - "No thanks" → dismiss permanently
 */

import { useState, useEffect } from 'react';

const CWS_URL = 'https://chromewebstore.google.com/detail/jaffhfflencnecilfpioacebogjjcoeh';
const PROMPT_THRESHOLD = 5;  // Show after 5 completed sessions
const SNOOZE_COUNT = 10;     // "Later" → show again after 10 more sessions

const StarIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const HeartIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

interface RatingState {
    sessionsCompleted: number;
    dismissed: boolean;      // permanently dismissed
    nextPromptAt: number;    // show again after this many sessions
}

async function getRatingState(): Promise<RatingState> {
    const result = await chrome.storage.local.get('ratingState');
    return (result.ratingState as RatingState) || {
        sessionsCompleted: 0,
        dismissed: false,
        nextPromptAt: PROMPT_THRESHOLD,
    };
}

async function saveRatingState(state: RatingState): Promise<void> {
    await chrome.storage.local.set({ ratingState: state });
}

/** Call this when a focus session completes */
export async function incrementSessionCount(): Promise<void> {
    const state = await getRatingState();
    state.sessionsCompleted++;
    await saveRatingState(state);
}

export function RatingPrompt() {
    const [visible, setVisible] = useState(false);
    const [state, setState] = useState<RatingState | null>(null);

    useEffect(() => {
        getRatingState().then((s) => {
            setState(s);
            if (!s.dismissed && s.sessionsCompleted >= s.nextPromptAt) {
                // Small delay so it doesn't flash on mount
                setTimeout(() => setVisible(true), 2000);
            }
        });
    }, []);

    const handleRate = () => {
        chrome.tabs.create({ url: CWS_URL });
        if (state) {
            saveRatingState({ ...state, dismissed: true });
        }
        setVisible(false);
    };

    const handleLater = () => {
        if (state) {
            saveRatingState({
                ...state,
                nextPromptAt: state.sessionsCompleted + SNOOZE_COUNT,
            });
        }
        setVisible(false);
    };

    const handleDismiss = () => {
        if (state) {
            saveRatingState({ ...state, dismissed: true });
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className={`rating-prompt ${visible ? 'show' : ''}`}>
            <div className="rating-icon"><HeartIcon /></div>
            <div className="rating-content">
                <p className="rating-title">Enjoying Amo Lofi?</p>
                <p className="rating-sub">A quick rating helps us grow 🌱</p>
            </div>
            <div className="rating-actions">
                <button className="rating-cta" onClick={handleRate}>
                    <StarIcon />
                    Rate
                </button>
                <button className="rating-later" onClick={handleLater}>Later</button>
                <button className="rating-dismiss" onClick={handleDismiss}>×</button>
            </div>
        </div>
    );
}
