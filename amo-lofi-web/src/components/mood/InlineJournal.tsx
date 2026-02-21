/**
 * InlineJournal — Mood selector + journal entry inline in chat bubble.
 *
 * Shows emoji mood grid for quick mood selection.
 * Glassmorphism card styling consistent with InlineTaskSteps.
 */

import { useState, type CSSProperties } from 'react';
import { useJournalStore, MOOD_OPTIONS, type JournalMood } from '../../store/journalStore';

interface InlineJournalProps {
    onJournalSubmit?: (mood: JournalMood, content: string) => void;
    amoReply?: string;
}

export function InlineJournal({ onJournalSubmit, amoReply }: InlineJournalProps) {
    const [selectedMood, setSelectedMood] = useState<JournalMood | null>(null);
    const [content, setContent] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const addEntry = useJournalStore((s) => s.addEntry);

    const handleSubmit = () => {
        if (!selectedMood) return;

        const today = new Date().toDateString();

        addEntry({
            date: today,
            mood: selectedMood,
            content: content.trim(),
            tags: [], // Auto-tagging can be added later
            amoReply: amoReply || '',
        });

        onJournalSubmit?.(selectedMood, content);
        setSubmitted(true);
    };

    if (submitted) {
        const entryCount = useJournalStore.getState().entries.length;
        const now = new Date();
        const dateStr = now.toLocaleDateString('vi-VN', {
            weekday: 'long', day: 'numeric', month: 'long',
        });
        const timeStr = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit',
        });

        return (
            <div style={styles.container}>
                <div style={styles.submitted}>
                    <span style={styles.submittedEmoji}>{selectedMood}</span>
                    <div>
                        <div style={styles.submittedText}>
                            Đã lưu nhật ký {dateStr} ✨
                        </div>
                        <div style={styles.savedNote}>
                            📒 Bài #{entryCount} · {timeStr} · Lưu trên máy của bạn
                        </div>
                    </div>
                </div>
                {content && (
                    <p style={styles.journalPreview}>"{content}"</p>
                )}
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Mood grid */}
            <p style={styles.label}>Hôm nay bạn cảm thấy thế nào?</p>
            <div style={styles.moodGrid}>
                {MOOD_OPTIONS.map(({ emoji, label }) => (
                    <button
                        key={emoji}
                        style={{
                            ...styles.moodBtn,
                            ...(selectedMood === emoji ? styles.moodBtnActive : {}),
                        }}
                        onClick={() => setSelectedMood(emoji)}
                        title={label}
                    >
                        <span style={styles.moodEmoji}>{emoji}</span>
                        <span style={styles.moodLabel}>{label}</span>
                    </button>
                ))}
            </div>

            {/* Journal text - shows after mood selection */}
            {selectedMood && (
                <>
                    <textarea
                        style={styles.textarea}
                        placeholder="Viết gì đó nếu muốn... (không bắt buộc)"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={2}
                    />
                    <div style={styles.footer}>
                        <button
                            onClick={handleSubmit}
                            style={styles.submitBtn}
                            className="mood-chip"
                        >
                            ✍️ Lưu nhật ký
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    container: {
        marginTop: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
    },
    label: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
        marginTop: 0,
    },
    moodGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
    },
    moodBtn: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: 2,
        padding: '6px 4px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    moodBtnActive: {
        border: '1px solid rgba(139,92,246,0.5)',
        background: 'rgba(139,92,246,0.15)',
        transform: 'scale(1.05)',
    },
    moodEmoji: {
        fontSize: 20,
    },
    moodLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
    },
    textarea: {
        width: '100%',
        marginTop: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        fontFamily: 'inherit',
        resize: 'none' as const,
        outline: 'none',
        lineHeight: 1.5,
        boxSizing: 'border-box' as const,
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    submitBtn: {
        padding: '5px 14px',
        borderRadius: 14,
        border: '1px solid rgba(139,92,246,0.3)',
        background: 'rgba(139,92,246,0.15)',
        color: 'rgba(200,180,255,0.9)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    submitted: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    submittedEmoji: {
        fontSize: 24,
    },
    submittedText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
    },
    savedNote: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        marginTop: 2,
    },
    journalPreview: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        fontStyle: 'italic',
        marginTop: 6,
        marginBottom: 0,
        lineHeight: 1.4,
    },
};

export default InlineJournal;
