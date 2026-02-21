/**
 * journalStore — Structured mood journaling with localStorage persistence.
 *
 * Stores journal entries with mood, content, tags, and Amo's reply.
 * Pure client-side — no server dependency.
 */

import { create } from 'zustand';

// ── Types ──

export type JournalMood = '😊' | '😌' | '🤔' | '😤' | '😢' | '🔥' | '😴' | '🌟';

export interface JournalEntry {
    id: string;
    date: string;
    mood: JournalMood;
    content: string;
    tags: string[];
    amoReply: string;
    timestamp: number;
}

interface JournalState {
    entries: JournalEntry[];
    addEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
    getEntriesByDate: (date: string) => JournalEntry[];
    getTodayEntry: () => JournalEntry | null;
    getRecentEntries: (count: number) => JournalEntry[];
}

// ── Constants ──

const JOURNAL_KEY = 'amo_journal';

// ── Helpers ──

function loadEntries(): JournalEntry[] {
    try {
        const raw = localStorage.getItem(JOURNAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveEntries(entries: JournalEntry[]): void {
    try {
        // Keep last 100 entries max
        localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(0, 100)));
    } catch {
        // localStorage full — ignore
    }
}

function generateId(): string {
    return `j_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getToday(): string {
    return new Date().toDateString();
}

// ── Store ──

export const useJournalStore = create<JournalState>((set, get) => ({
    entries: loadEntries(),

    addEntry: (entry) => {
        const newEntry: JournalEntry = {
            ...entry,
            id: generateId(),
            timestamp: Date.now(),
        };

        set(state => {
            const updated = [newEntry, ...state.entries].slice(0, 100);
            saveEntries(updated);
            return { entries: updated };
        });
    },

    getEntriesByDate: (date: string) => {
        return get().entries.filter(e => e.date === date);
    },

    getTodayEntry: () => {
        const today = getToday();
        return get().entries.find(e => e.date === today) || null;
    },

    getRecentEntries: (count: number) => {
        return get().entries.slice(0, count);
    },
}));

// ── Mood labels (for display) ──

export const MOOD_OPTIONS: { emoji: JournalMood; label: string }[] = [
    { emoji: '😊', label: 'Vui vẻ' },
    { emoji: '😌', label: 'Bình yên' },
    { emoji: '🤔', label: 'Suy tư' },
    { emoji: '😤', label: 'Bực bội' },
    { emoji: '😢', label: 'Buồn' },
    { emoji: '🔥', label: 'Hứng khởi' },
    { emoji: '😴', label: 'Mệt mỏi' },
    { emoji: '🌟', label: 'Tự hào' },
];
