/**
 * useMoodCompanion — AI-powered mood chat hook for Amo Mood Companion.
 *
 * Handles:
 *   - Conversation state management
 *   - Gemini Flash calls via gemini-proxy Edge Function
 *   - Daily reset via localStorage
 *   - Offline fallback detection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseClient';

// ── Types ──

export interface MoodMessage {
    role: 'user' | 'amo';
    content: string;
    timestamp: number;
}

export interface SceneConcept {
    description: string;
    mood: string;
    style: string;
}

export type MoodPhase =
    | 'idle'
    | 'thinking'
    | 'chatting'
    | 'suggesting'
    | 'confirmed'
    | 'creating'
    | 'done';

export interface UseMoodCompanion {
    messages: MoodMessage[];
    phase: MoodPhase;
    sceneConcept: SceneConcept | null;
    error: string | null;
    isOnline: boolean;

    sendMessage: (text: string) => Promise<void>;
    confirmScene: () => void;
    dismiss: () => void;
    reset: () => void;
}

// ── Constants ──

const MOOD_STORAGE_KEY = 'amo_mood_today';
const GEMINI_MODEL = 'gemini-2.0-flash-lite';

// ── Time of day helper ──

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
}

// ── System prompt ──

function buildSystemPrompt(timeOfDay: string, currentScene?: string): string {
    return `Bạn là Amo — người bạn thân của user trong app AmoLofi (ứng dụng nghe lofi và focus).

TÍNH CÁCH:
- Xưng "mình", gọi user là "bạn"
- Thân thiện, gần gũi, nói chuyện tự nhiên như bạn bè
- Dùng tiếng lóng nhẹ nhàng: "Vậy à~", "Hehe", "Woahh", "Yay!"
- Emoji vừa đủ (1-2 mỗi message), không spam
- Auto-detect ngôn ngữ: user gõ English → reply English, user gõ Việt → reply Việt

NHIỆM VỤ:
1. Lắng nghe cảm xúc của user
2. Phản hồi chân thành — dành ít nhất 2-3 câu để THỂ HIỆN SỰ ĐỒNG CẢM trước
3. SAU KHI đã thấu hiểu, tự nhiên gợi ý MỘT ý tưởng scene phù hợp tâm trạng
4. Mô tả scene bằng CẢM GIÁC (ánh sáng, âm thanh, không khí), KHÔNG dùng thuật ngữ kỹ thuật
5. Hỏi nhẹ nhàng "Bạn thích ý tưởng này chứ?" — KHÔNG nói "Bạn có muốn tạo không?"

QUY TẮC:
- TUYỆT ĐỐI KHÔNG mention credit, Pro, pricing, upgrade, subscription
- Nếu user không hứng thú → kết thúc nhẹ nhàng, KHÔNG ép
- Nếu user muốn chỉnh sửa → vui vẻ adjust, nói "Oke vậy thì..."
- Nếu user CHỈ MUỐN TÂM SỰ → KHÔNG gợi ý scene, chỉ lắng nghe và đồng cảm
- Mỗi message: 60-120 từ
- Trả lời bằng ngôn ngữ user sử dụng

CONTEXT:
- Thời điểm: ${timeOfDay}
- Scene hiện tại: ${currentScene || 'default'}

OUTPUT FORMAT — Trả lời CHÍNH XÁC dạng JSON (không có markdown fences):
{
  "amoReply": "nội dung trả lời",
  "sceneConcept": {
    "description": "mô tả scene 1-2 câu",
    "mood": "relaxed|happy|stressed|focused|sad|neutral",
    "style": "realistic|anime|watercolor|minimalist|cyberpunk"
  },
  "detectedMood": "relaxed|happy|stressed|focused|sad|neutral",
  "showCreateButton": false
}

QUY TẮC VỀ showCreateButton:
- "showCreateButton": false → MẶC ĐỊNH. Dùng khi bạn đang gợi ý, hỏi ý kiến, hoặc user chưa đồng ý.
- "showCreateButton": true → CHỈ KHI user đã XÁC NHẬN ĐỒNG Ý tạo scene (nói "oke", "thích", "tạo đi", "yes", "được", v.v.)
- KHÔNG BAO GIỜ set true ở lần trả lời đầu tiên.

Nếu chưa nên gợi ý scene (user chỉ tâm sự, hoặc chưa đủ context), set:
"sceneConcept": null`;
}

// ── localStorage helpers ──

function loadTodayMood(): { messages: MoodMessage[]; sceneConcept: SceneConcept | null; phase: MoodPhase } | null {
    try {
        const saved = localStorage.getItem(MOOD_STORAGE_KEY);
        if (!saved) return null;

        const { date, messages, sceneConcept, phase } = JSON.parse(saved);
        const today = new Date().toDateString();

        if (date !== today) {
            localStorage.removeItem(MOOD_STORAGE_KEY);
            return null;
        }
        return { messages, sceneConcept: sceneConcept || null, phase: phase || 'chatting' };
    } catch {
        return null;
    }
}

function saveTodayMood(messages: MoodMessage[], sceneConcept: SceneConcept | null, phase: MoodPhase) {
    try {
        localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify({
            date: new Date().toDateString(),
            messages,
            sceneConcept,
            phase,
        }));
    } catch {
        // localStorage full — ignore silently
    }
}

// ── Robust JSON extraction ──

function extractJsonFromText(text: string): Record<string, unknown> | null {
    // 1. Try direct parse
    try { return JSON.parse(text.trim()); } catch { /* continue */ }

    // 2. Strip markdown fences and try again
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try { return JSON.parse(stripped); } catch { /* continue */ }

    // 3. Find first { ... } block using brace counting
    const start = text.indexOf('{');
    if (start !== -1) {
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}') depth--;
            if (depth === 0) {
                try { return JSON.parse(text.slice(start, i + 1)); } catch { break; }
            }
        }
    }

    // 4. Regex fallback: extract amoReply field
    const replyMatch = text.match(/"amoReply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (replyMatch) {
        return { amoReply: replyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') };
    }

    return null;
}

// ── Hook ──

export function useMoodCompanion(): UseMoodCompanion {
    // Load persisted state
    const saved = useRef(loadTodayMood());

    const [messages, setMessages] = useState<MoodMessage[]>(saved.current?.messages || []);
    const [phase, setPhase] = useState<MoodPhase>(
        saved.current ? (saved.current.phase as MoodPhase) : 'idle',
    );
    const [sceneConcept, setSceneConcept] = useState<SceneConcept | null>(
        saved.current?.sceneConcept || null,
    );
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Online/offline detection
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // Persist on change
    useEffect(() => {
        if (messages.length > 0) {
            saveTodayMood(messages, sceneConcept, phase);
        }
    }, [messages, sceneConcept, phase]);

    // ── Call AI ──
    const callMoodChat = useCallback(async (
        userText: string,
        history: MoodMessage[],
    ): Promise<{ amoReply: string; sceneConcept: SceneConcept | null; detectedMood: string; showCreateButton: boolean }> => {
        // Try to get session — if logged in use bearer token, otherwise anonymous
        const { data: { session } } = await supabase.auth.getSession();

        const timeOfDay = getTimeOfDay();

        // Build conversation history for Gemini
        const contents = history.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        // Add current message
        contents.push({
            role: 'user',
            parts: [{ text: userText }],
        });

        // Build headers — auth is optional
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
        };
        if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: GEMINI_MODEL,
                contents,
                systemInstruction: {
                    parts: [{ text: buildSystemPrompt(timeOfDay) }],
                },
                generationConfig: {
                    temperature: 0.9,
                    topP: 0.95,
                    maxOutputTokens: 500,
                },
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (res.status === 429) {
                throw new Error('Hôm nay bạn đã chat nhiều rồi~ Quay lại ngày mai nhé');
            }
            throw new Error(errData.error || `Server error (${res.status})`);
        }

        const data = await res.json();

        // Extract text from Gemini response
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON response (robust extraction)
        const parsed = extractJsonFromText(rawText);
        if (parsed && parsed.amoReply) {
            return {
                amoReply: parsed.amoReply as string,
                sceneConcept: (parsed.sceneConcept as SceneConcept) || null,
                detectedMood: (parsed.detectedMood as string) || 'neutral',
                showCreateButton: parsed.showCreateButton === true,
            };
        }

        // Final fallback: use raw text but clean up any JSON artifacts
        const cleanText = rawText.replace(/[{}"]/g, '').replace(/amoReply\s*:/gi, '').trim();
        return {
            amoReply: cleanText || 'Mình không hiểu lắm, bạn nói lại được không?',
            sceneConcept: null,
            detectedMood: 'neutral',
            showCreateButton: false,
        };
    }, []);

    // ── Send message ──
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        const userMsg: MoodMessage = {
            role: 'user',
            content: text.trim(),
            timestamp: Date.now(),
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setPhase('thinking');
        setError(null);

        try {
            const result = await callMoodChat(text.trim(), messages);

            const amoMsg: MoodMessage = {
                role: 'amo',
                content: result.amoReply,
                timestamp: Date.now(),
            };

            const updatedMessages = [...newMessages, amoMsg];
            setMessages(updatedMessages);

            if (result.sceneConcept) {
                setSceneConcept(result.sceneConcept);
                // Only show button when AI confirms user agreed
                if (result.showCreateButton) {
                    setPhase('suggesting');
                } else {
                    setPhase('chatting');
                }
            } else {
                setPhase('chatting');
            }
        } catch (err) {
            setError((err as Error).message);
            setPhase('chatting');
        }
    }, [messages, callMoodChat]);

    // ── Confirm scene ──
    const confirmScene = useCallback(() => {
        setPhase('confirmed');
    }, []);

    // ── Dismiss ──
    const dismiss = useCallback(() => {
        setPhase('chatting');
        setSceneConcept(null);
    }, []);

    // ── Reset ──
    const reset = useCallback(() => {
        setMessages([]);
        setPhase('idle');
        setSceneConcept(null);
        setError(null);
        localStorage.removeItem(MOOD_STORAGE_KEY);
    }, []);

    return {
        messages,
        phase,
        sceneConcept,
        error,
        isOnline,
        sendMessage,
        confirmScene,
        dismiss,
        reset,
    };
}
