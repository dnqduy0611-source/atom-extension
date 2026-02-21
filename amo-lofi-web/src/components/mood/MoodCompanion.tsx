/**
 * MoodCompanion — Chat UI for Amo Mood Companion.
 *
 * Replaces the old "Bạn đang làm gì?" text field.
 * Glass-morphism chat panel with scrollable messages,
 * typing indicator, and Create Scene button.
 */

import './MoodCompanion.css';
import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { useAmoAgent } from '../../hooks/useAmoAgent';
import { useGeminiTheme } from '../../hooks/useGeminiTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { useProGate } from '../../hooks/useProGate';
import { useAuth } from '../../hooks/useAuth';
import { useCredits } from '../../hooks/useCredits';
import { useFocusStore } from '../../store/useFocusStore';
import { useCustomScenes } from '../../hooks/useCustomScenes';
import { useLofiStore } from '../../store/useLofiStore';
import { getDefaultChips } from '../../utils/intentDetector';
import { SuggestionChips } from './SuggestionChips';
import { InlineTaskSteps } from './InlineTaskSteps';
import { InlineJournal } from './InlineJournal';
import type { StoredScene } from '../../utils/idb';
import type { TaskStep } from '../../types/agent';


// ── Typing Indicator ──

function TypingIndicator() {
    return (
        <div className="mood-typing" style={styles.typingWrap}>
            <span style={styles.typingDot} className="mood-dot mood-dot-1" />
            <span style={styles.typingDot} className="mood-dot mood-dot-2" />
            <span style={styles.typingDot} className="mood-dot mood-dot-3" />
        </div>
    );
}

// ── Main Component ──

export function MoodCompanion() {
    const { t } = useTranslation();
    const {
        messages,
        phase,
        sceneConcept,
        error,
        isOnline,
        sendMessage,
        confirmScene,
        dismiss,
        reset,
    } = useAmoAgent();

    const { generate, isGenerating } = useGeminiTheme();
    const { user, signIn } = useAuth();
    const { isPro: _isPro, showUpsell } = useProGate();
    const { balance, dailyFreeRemaining, refresh: refreshCredits } = useCredits();
    const { addCustomScene } = useCustomScenes();
    const setScene = useLofiStore((s) => s.setScene);

    // Fallback to task label when offline
    const { taskLabel, setTaskLabel } = useFocusStore();

    const [input, setInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(phase !== 'idle');
    const [isMinimized, setIsMinimized] = useState(false);

    // Preview state for generated scene
    const [pendingResult, setPendingResult] = useState<import('../../hooks/useGeminiTheme').CreateSceneResult | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-expand when messages exist
    useEffect(() => {
        if (messages.length > 0 && phase !== 'idle') {
            setIsExpanded(true);
        }
    }, [messages.length, phase]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, phase, previewUrl]);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && !isMinimized && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded, isMinimized]);

    // ── Handlers ──

    const handleSend = async () => {
        if (!input.trim() || phase === 'thinking') return;
        const text = input;
        setInput('');
        await sendMessage(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleIdleClick = () => {
        setIsExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    // Generate scene → store result for preview (don't apply yet)
    const handleCreateScene = async () => {
        if (!sceneConcept) return;

        // Gate: must be logged in first
        if (!user) {
            signIn(); // Redirects to Google OAuth; chat state persists in localStorage
            return;
        }

        // Daily free: users get free scenes each day
        const hasDailyFree = dailyFreeRemaining > 0;
        if (!hasDailyFree) {
            // Need credits for additional uses
            if (balance < 10) { showUpsell(); return; }
        }

        try {
            const result = await generate(`Mood: ${sceneConcept.mood}`, sceneConcept.description);
            setPendingResult(result);
            if (result.imageBlob) {
                setPreviewUrl(URL.createObjectURL(result.imageBlob));
            }
            await refreshCredits();
        } catch {
            // Error handled by useGeminiTheme
        }
    };

    // Apply the previewed scene
    const handleApplyScene = async () => {
        if (!pendingResult || !sceneConcept) return;
        const sceneId = `mood_scene_${Date.now()}`;
        const stored: StoredScene = {
            id: sceneId,
            name: `Mood: ${sceneConcept.mood}`,
            description: sceneConcept.description,
            theme: pendingResult.generatedTheme.theme,
            backgroundBlob: pendingResult.imageBlob,
            tint: pendingResult.generatedTheme.suggestedTint,
            tags: pendingResult.generatedTheme.tags,
            defaultAmbience: pendingResult.generatedTheme.defaultAmbience,
            createdAt: Date.now(),
            iconPaths: pendingResult.generatedTheme.icons,
        };
        await addCustomScene(stored);
        setScene(sceneId);
        setPendingResult(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setIsMinimized(true);
    };

    // Retry — discard current preview and regenerate (costs another 10 credits)
    const handleRetryScene = async () => {
        setPendingResult(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        // Trigger new generation immediately
        await handleCreateScene();
    };

    // ── Offline fallback: show old task label input ──
    if (!isOnline) {
        return (
            <div style={styles.offlineFallback}>
                <input
                    type="text"
                    value={taskLabel}
                    onChange={(e) => setTaskLabel(e.target.value)}
                    maxLength={60}
                    placeholder={t('heroTimer.placeholder') || 'What are you working on?'}
                    style={styles.offlineInput}
                />
            </div>
        );
    }

    // ── Idle State ──
    if (!isExpanded && phase === 'idle' && messages.length === 0) {
        return (
            <div
                onClick={handleIdleClick}
                style={styles.idleWrapper}
                className="mood-idle-btn"
            >
                <span style={styles.idleMain}>
                    {'Chat với Amo · ' + (t('mood.placeholder') || 'Hôm nay bạn thấy thế nào?')}
                </span>
                <span style={styles.idleHint}>tâm sự · nhật ký · suy nghĩ</span>
            </div>
        );
    }

    // ── Minimized ──
    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                style={styles.minimizedButton}
                className="mood-min-btn"
            >
                {'Chat với Amo · ' + (t('mood.chatWithAmo') || 'Hôm nay bạn thế nào?')}
            </button>
        );
    }

    // ── Expanded Chat Panel ──
    return (
        <div style={styles.panelWrapper}>
            {/* Preview card — floating beside chat panel */}
            {previewUrl && pendingResult && (
                <div style={styles.previewFloat}>
                    <img src={previewUrl} alt="Scene preview" style={styles.previewImage} />
                </div>
            )}

            <div style={styles.panel} className="mood-panel">
                {/* Header */}
                <div style={styles.header}>
                    <span style={styles.headerTitle}>{t('mood.chatWithAmo') || 'Hôm nay bạn thế nào?'}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={() => { reset(); setIsExpanded(false); setPendingResult(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                            style={styles.minimizeBtn}
                            title={t('mood.newChat') || 'Cuộc trò chuyện mới'}
                        >
                            +
                        </button>
                        <button
                            onClick={() => setIsMinimized(true)}
                            style={styles.minimizeBtn}
                            title="Minimize"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div ref={scrollRef} style={styles.messagesArea}>
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            style={{
                                ...styles.bubble,
                                ...(msg.role === 'user' ? styles.userBubble : styles.amoBubble),
                            }}
                        >
                            <div style={styles.bubbleContent}>{msg.content}</div>
                            {/* Inline Task Steps for task_breakdown messages */}
                            {msg.inlineUI?.type === 'task_steps' && (
                                <InlineTaskSteps
                                    steps={msg.inlineUI.data as TaskStep[]}
                                />
                            )}
                            {msg.inlineUI?.type === 'journal_entry' && (
                                <InlineJournal
                                    amoReply={msg.content}
                                    onJournalSubmit={(mood, content) => {
                                        // Send journal content as follow-up for Amo to respond warmly
                                        const journalMsg = content
                                            ? `[Nhật ký ${mood}] ${content}`
                                            : `[Nhật ký] Hôm nay mình cảm thấy ${mood}`;
                                        sendMessage(journalMsg);
                                    }}
                                />
                            )}
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {phase === 'thinking' && (
                        <div style={{ ...styles.bubble, ...styles.amoBubble }}>
                            <TypingIndicator />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={styles.errorMsg}>
                            {error}
                        </div>
                    )}

                    {/* Preview confirmation — inline in chat */}
                    {pendingResult && (
                        <div style={styles.previewConfirm}>
                            <div style={{ ...styles.bubble, ...styles.amoBubble }}>
                                <div style={styles.bubbleContent}>
                                    Scene đã tạo xong! Bạn thấy thế nào?
                                </div>
                            </div>
                            <div style={styles.inlineActions}>
                                <button onClick={handleApplyScene} style={styles.applyBtn}>
                                    {t('mood.applyScene') || 'Dùng scene này'}
                                </button>
                                <button onClick={handleRetryScene} style={styles.retryBtn}>
                                    Thử lại nhé (10 credits)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Create Scene button — only show when NOT previewing */}
                    {!pendingResult && (phase === 'confirmed' || phase === 'suggesting') && sceneConcept && (
                        <div style={styles.sceneAction}>
                            <button
                                onClick={phase === 'confirmed' ? handleCreateScene : confirmScene}
                                disabled={isGenerating}
                                style={styles.createSceneBtn}
                                className="mood-create-btn"
                            >
                                <span>
                                    {isGenerating
                                        ? (t('mood.creating') || 'Đang tạo...')
                                        : phase === 'confirmed'
                                            ? (t('mood.createScene') || 'Tạo scene')
                                            : (t('mood.likeThis') || 'Tạo scene này')}
                                </span>
                            </button>
                            {phase === 'suggesting' && (
                                <button onClick={dismiss} style={styles.dismissBtn}>
                                    {t('mood.dismiss') || 'Lần sau nhé'}
                                </button>
                            )}
                            <span style={styles.creditNote}>
                                {!user
                                    ? 'Đăng nhập để tạo'
                                    : dailyFreeRemaining > 0
                                        ? `Còn ${dailyFreeRemaining} lượt free hôm nay`
                                        : `10 credits`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Input */}
                {phase !== 'creating' && phase !== 'done' && (
                    <div style={styles.inputArea}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={phase === 'thinking'}
                            placeholder={
                                phase === 'idle'
                                    ? (t('mood.inputPlaceholder') || 'Chia sẻ với mình...')
                                    : (t('mood.replyPlaceholder') || 'Gõ trả lời...')
                            }
                            style={styles.chatInput}
                            maxLength={300}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || phase === 'thinking'}
                            style={{
                                ...styles.sendBtn,
                                opacity: input.trim() && phase !== 'thinking' ? 1 : 0.3,
                            }}
                        >
                            ➤
                        </button>
                    </div>
                )}

                {/* Suggestion Chips */}
                {phase !== 'creating' && phase !== 'done' && (
                    <SuggestionChips
                        chips={
                            // Use last message suggestions if available, otherwise defaults
                            messages.length > 0 && messages[messages.length - 1].suggestions
                                ? messages[messages.length - 1].suggestions!
                                : getDefaultChips(phase)
                        }
                        onChipClick={(text) => {
                            setInput(text);
                            setTimeout(() => inputRef.current?.focus(), 50);
                        }}
                        disabled={phase === 'thinking'}
                    />
                )}
            </div>
        </div>
    );
}

// ── Styles ──

const styles: Record<string, CSSProperties> = {
    // Idle — wider, inviting input area with subtle journaling hint
    idleWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        marginTop: 8,
        width: '100%',
        maxWidth: 480,
        transition: 'all 0.3s ease',
    },
    idleMain: {
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 16,
        padding: '0 0 4px 0',
        textShadow: '0 1px 6px rgba(0,0,0,0.3)',
        textAlign: 'center',
        width: '100%',
    },
    idleHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '1.5px',
        fontWeight: 400,
        textTransform: 'lowercase' as const,
    },

    // Minimized
    minimizedButton: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        cursor: 'pointer',
        padding: '6px 14px',
        borderRadius: 20,
        marginTop: 8,
    },

    // Panel — wider chat panel
    panel: {
        flex: 1,
        minWidth: 0,
        maxWidth: 520,
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        animation: 'moodSlideUp 0.3s ease-out',
        display: 'flex',
        flexDirection: 'column',
    },

    // Header
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'rgba(255,255,255,0.6)',
    },
    headerTitle: {
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
    },
    minimizeBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        padding: 4,
        borderRadius: 4,
        display: 'flex',
    },

    // Messages
    messagesArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxHeight: 180,
        scrollBehavior: 'smooth',
    },

    // Bubbles
    bubble: {
        maxWidth: '85%',
        borderRadius: 14,
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.5,
        wordBreak: 'break-word',
    },
    userBubble: {
        alignSelf: 'flex-end',
        background: 'rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.85)',
        borderBottomRightRadius: 4,
    },
    amoBubble: {
        alignSelf: 'flex-start',
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.8)',
        borderBottomLeftRadius: 4,
    },
    bubbleContent: {
        whiteSpace: 'pre-wrap',
    },

    // Typing
    typingWrap: {
        display: 'flex',
        gap: 4,
        padding: '4px 0',
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.4)',
        animation: 'moodBounce 1.4s ease-in-out infinite',
    },

    // Error
    errorMsg: {
        fontSize: 12,
        color: 'rgba(255,100,100,0.8)',
        textAlign: 'center',
        padding: '4px 8px',
    },

    // Scene action
    sceneAction: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '8px 0',
    },
    createSceneBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 24px',
        borderRadius: 25,
        border: 'none',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
    },
    dismissBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        cursor: 'pointer',
        padding: '4px 8px',
    },
    creditNote: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.3)',
    },

    // Input
    inputArea: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    chatInput: {
        flex: 1,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '8px 16px',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        outline: 'none',
    },
    sendBtn: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.6)',
        cursor: 'pointer',
        padding: 6,
        borderRadius: '50%',
        display: 'flex',
        transition: 'opacity 0.2s',
    },

    // Offline fallback
    offlineFallback: {
        marginTop: 8,
        maxWidth: 320,
    },
    offlineInput: {
        width: '100%',
        textAlign: 'center',
        fontSize: 14,
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        color: 'rgba(255,255,255,0.8)',
        paddingBottom: 4,
        outline: 'none',
    },

    // Panel wrapper — flex row for preview + chat side by side
    panelWrapper: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        marginTop: 12,
        width: '100%',
        maxWidth: 700,
        justifyContent: 'center',
    },

    // Preview floating beside chat
    previewFloat: {
        width: 200,
        minWidth: 200,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        animation: 'moodSlideUp 0.3s ease-out',
    },
    previewImage: {
        width: '100%',
        height: 'auto',
        aspectRatio: '16/10',
        objectFit: 'cover',
        display: 'block',
        borderRadius: 14,
    },

    // Preview confirmation — inline in chat
    previewConfirm: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    inlineActions: {
        display: 'flex',
        gap: 8,
        alignSelf: 'flex-start',
    },
    applyBtn: {
        padding: '6px 16px',
        borderRadius: 16,
        border: 'none',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    retryBtn: {
        padding: '6px 12px',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'none',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
};

export default MoodCompanion;
