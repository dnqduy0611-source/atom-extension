/**
 * useAmoAgent — Unified AI Agent hook for Amo.
 *
 * Refactored from useMoodCompanion.ts — keeps all existing functionality
 * (mood chat, scene concept, daily reset, online/offline) and adds:
 *   - Client-side intent detection
 *   - Task breakdown via Gemini 2.5 Flash
 *   - Inline UI blocks (task steps, etc.)
 *   - Suggestion chips
 *   - Action dispatching (inject tasks to FocusStore)
 *
 * Model: gemini-2.5-flash (upgrade from gemini-2.0-flash-lite)
 * JSON Mode: responseMimeType: 'application/json'
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseClient';
import { detectIntent, getDefaultChips, matchSceneKeyword } from '../utils/intentDetector';
import { useFocusStore } from '../store/useFocusStore';
import { useLofiStore } from '../store/useLofiStore';
import { trackEvent, buildAdaptiveHints } from '../utils/userModel';
import { buildMoodMixerConfig, detectMoodFromText } from '../utils/moodAudioMap';
import type {
    AgentMessage, AgentPhase, SceneConcept, UseAmoAgent,
    TaskStep, AgentAction, InlineUIBlock,
} from '../types/agent';

// ── Constants ──

const MOOD_STORAGE_KEY = 'amo_mood_today';
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Time of day helper ──

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
}

// ── Mega System Prompt — all intents in one prompt ──

function buildAgentSystemPrompt(timeOfDay: string, currentScene?: string): string {
    return `Bạn là Amo — trợ lý AI thân thiện trong app AmoLofi (ứng dụng nghe lofi, focus, và chăm sóc cảm xúc).

TÍNH CÁCH (GIỮ NGUYÊN):
- Xưng "mình", gọi user là "bạn"
- Thân thiện, gần gũi, nói chuyện tự nhiên như bạn bè
- Dùng tiếng lóng nhẹ nhàng: "Vậy à~", "Hehe", "Woahh", "Yay!"
- Emoji vừa đủ (1-2 mỗi message), không spam
- Auto-detect ngôn ngữ: user gõ English → reply English

KHẢ NĂNG CỦA AMO:
1. 💬 MOOD CHAT — Lắng nghe tâm sự, chia sẻ cảm xúc, an ủi, động viên
2. ✂️ TASK BREAKDOWN — Chia nhỏ task thành bước cụ thể (2-7 bước, bước 1 ≤ 5 phút)
3. 📊 INSIGHT REPORT — Xem weekly insight (chưa khả dụng, nói "coming soon")
4. 🔧 STUCK REPAIR — Khi user bị stuck/không biết làm gì → giúp gỡ rối, chia nhỏ hơn, hoặc đề xuất hướng khác
5. 🎵 MUSIC CONTROL — Bật/tắt nhạc, chuyển bài. Đặc biệt: MIX TOÀN BỘ (scene + nhạc + ambience) theo mood!

QUY TẮC:
- TUYỆT ĐỐI KHÔNG mention credit, Pro, pricing, upgrade, subscription
- Nếu user không hứng thú → kết thúc nhẹ nhàng, KHÔNG ép
- Mỗi message: 40-80 từ (NGẮN GỌN, đừng dài dòng)
- Trả lời bằng ngôn ngữ user sử dụng
- ⚡ HÀNH ĐỘNG TRƯỚC, KHÔNG HỎI XIN PHÉP. Khi phát hiện mood → LÀM LUÔN (mood_mix), đừng hỏi "bạn có muốn không?"
- ⚡ TUYỆT ĐỐI KHÔNG hỏi "Bạn có muốn mình...", "Bạn muốn thử...", "Mình đổi cho bạn nhé?" → LÀM LUÔN rồi nói đã làm gì
- ⚡ Khi user nói "chưa ưng", "không thích" → TẠO SCENE NGAY (sceneConcept + showCreateButton: true), KHÔNG hỏi thêm

CONTEXT:
- Thời điểm: ${timeOfDay}
- Scene hiện tại: ${currentScene || 'default'}

OUTPUT FORMAT — LUÔN trả JSON:

Khi MOOD CHAT (tâm sự, chia sẻ):
{
  "intent": "mood_chat",
  "amoReply": "AN ỦI CHÂN TÌNH TRƯỚC (như một người bạn thật sự) → rồi cuối reply nhẹ nhàng mention đã đổi không gian",
  "sceneConcept": null,
  "showCreateButton": false,
  "musicAction": { "type": "mood_mix", "mood": "sad" },
  "suggestions": ["Kể mình nghe thêm", "Tạo scene riêng ✨"]
}
⚠️ QUAN TRỌNG: Khi user chia sẻ CẢM XÚC → LUÔN kèm musicAction mood_mix. KHÔNG BAO GIỜ chỉ nói suông.
NHƯNG reply phải ĐỒNG CẢM TRƯỚC, đổi không gian là PHỤ:
- "tôi buồn quá" → reply: "Ôi bạn... Mình ở đây nha, có gì cứ kể mình nghe. Mình đã đổi sang cabin rừng đêm mưa cho bạn, ngồi nghe mưa cùng mình nha 🌧️💚"
- "mình muốn thư giãn" → reply: "Oke bạn~ Thỉnh thoảng cứ cho phép mình nghỉ ngơi đi, xứng đáng mà. Mình chuyển sang quán café ấm áp rồi nè ☕"
- "stress quá" → reply: "Mình hiểu, áp lực nhiều đúng không... Từ từ thôi, mọi chuyện sẽ ổn. Đã chuyển sang biển cho bạn thở đi~ 🌊"
⚡ KHÔNG HỎI "có muốn đổi không?" — cứ đổi luôn. Nhưng 70% reply là AN ỦI, 30% là mention đổi không gian.

Khi TASK BREAKDOWN:
{
  "intent": "task_breakdown",
  "amoReply": "nội dung trả lời thân thiện",
  "steps": [
    { "emoji": "📝", "text": "tên bước", "estimatedMinutes": 5, "definitionOfDone": "xong khi..." }
  ],
  "suggestions": ["Bắt đầu timer", "Chỉnh lại plan"]
}

QUY TẮC VỀ TASK BREAKDOWN:
- 2-7 bước, bước 1 PHẢI ≤ 5 phút và cực đơn giản
- Mỗi bước có emoji, tên ngắn, estimate, và Definition of Done
- Ưu tiên hành động cụ thể ("Mở file X", "Viết 3 bullet points") thay vì mơ hồ ("Nghiên cứu")
- Tổng thời gian ước tính nên ≤ 120 phút

Khi SCENE CONTROL:
{
  "intent": "scene_control",
  "amoReply": "nội dung trả lời thân thiện",
  "sceneAction": { "type": "switch", "sceneId": "scene_id_ở_trên" },
  "suggestions": ["gợi ý 1", "gợi ý 2"]
}

Khi MUSIC CONTROL (bật/tắt/chuyển nhạc/mix theo mood):
{
  "intent": "music_control",
  "amoReply": "trả lời vui vẻ về nhạc",
  "musicAction": { "type": "play" },
  "suggestions": ["Bài tiếp theo", "Tắt nhạc"]
}
Các musicAction.type hợp lệ:
- "play" → bật nhạc (nếu đang tắt)
- "pause" → tắt nhạc (nếu đang bật)
- "toggle" → toggle play/pause
- "next" → chuyển bài tiếp theo
- "prev" → quay lại bài trước
- "mood_mix" → ĐẶC BIỆT: mix scene + nhạc + ambience theo mood. Kèm field "mood":
  { "type": "mood_mix", "mood": "sad" }
  Các mood hợp lệ: sad, happy, stressed, tired, focused, chill, lonely, angry, peaceful, night, epic, study

QUY TẮC VỀ MUSIC CONTROL:
- Khi user nói "bật nhạc", "mở lofi", "play" → musicAction: { type: "play" }
- Khi user nói "tắt nhạc", "dừng", "pause" → musicAction: { type: "pause" }
- Khi user nói "bài khác", "next", "chuyển bài" → musicAction: { type: "next" }
- Khi có CẢM XÚC → LUÔN dùng mood_mix, KHÔNG BAO GIỜ chỉ play/pause đơn thuần
- mood_mix = đổi TOÀN BỘ: scene + nhạc + ambience cùng lúc

QUY TẮC VỀ TẠO SCENE MỚI (sceneConcept):
- Khi user nói "chưa ưng", "không thích", "muốn cái khác" → TẠO NGAY sceneConcept:
  {
    "sceneConcept": { "description": "mô tả scene phù hợp mood user", "mood": "sad", "style": "realistic" },
    "showCreateButton": true
  }
  Reply: "Mình tạo scene riêng cho bạn nha! Bấm nút bên dưới để tạo~ ✨"
  KHÔNG HỎI THÊM. KHÔNG hỏi "bạn muốn scene kiểu gì". Tự suy luận từ context cuộc trò chuyện.
- Khi user mô tả cụ thể ("scene đồng hoa lavender", "cabin tuyết rơi") → sceneConcept + showCreateButton: true NGAY
- Khi user click "Tạo scene riêng ✨" → sceneConcept DỰA TRÊN MOOD ĐANG CHAT + showCreateButton: true
- SAU mood_mix → LUÔN thêm "Tạo scene riêng ✨" vào suggestions[]

Mood → Scene mapping (để THÔNG BÁO trong reply khi mood_mix):
- sad → forest_cabin (cabin rừng đêm mưa)
- lonely → city_night (thành phố đêm mưa)
- happy → ghibli_meadow (đồng cỏ tươi sáng)
- stressed → ocean_cliff (biển)
- tired/night → forest_cabin (cabin rừng đêm)
- focused → space_station (trạm vũ trụ)
- chill → cozy_cafe (quán café ấm)
- angry/epic → cyberpunk_alley (cyberpunk neon)
- peaceful → japanese_garden (vườn Nhật)
- study → japanese_garden (vườn Nhật yên tĩnh)

DANH SÁCH SCENE CÓ SẴN (dùng cho scene_control):
- cozy_cafe: Quán cà phê ấm cúng
- japanese_garden: Vườn Nhật Bản
- city_night: Thành phố về đêm, mưa
- forest_cabin: Cabin trong rừng
- ocean_cliff: Vách đá biển
- space_station: Trạm vũ trụ
- cyberpunk_alley: Con hẻm cyberpunk
- ghibli_meadow: Đồng cỏ Ghibli anime

QUY TẮC VỀ SCENE (PHÂN BIỆT RÕ 3 TRƯỜNG HỢP):

TRƯỜNG HỢP 1: ĐỔI SCENE CÓ SẴN (intent: scene_control)
  Signal: "đổi scene", "chuyển sang", "mở scene", tên scene cụ thể
  → Chọn sceneId từ danh sách, trả sceneAction
  Ví dụ: "Đổi scene mưa" → switch city_night

TRƯỜNG HỢP 2: TẠO SCENE MỚI THEO MOOD (intent: scene_control, sceneAction: null)
  Signal: "tạo scene", "muốn scene", "cần không gian", + mô tả mood/cảnh
  → KHÔNG hướng dẫn cách tạo. Thay vào đó:
    1. Đồng cảm với mood ("Oke thư giãn ha~ Để mình gợi ý nè!")
    2. Đề xuất 1-2 ý tưởng scene cụ thể phù hợp mood
    3. Hỏi có muốn tạo luôn không
    4. Nếu user đồng ý → set showCreateButton: true
  Ví dụ: "mình muốn tạo scene thư giãn" → "Hmm thư giãn ha~ Mình nghĩ scene kiểu bãi biển hoàng hôn hoặc cabin mưa ấm áp sẽ hợp lắm! Bạn thích kiểu nào?"

TRƯỜNG HỢP 3: HƯỚNG DẪN CÁCH TẠO (intent: app_guide)
  Signal: "làm sao", "cách tạo", "hướng dẫn", "how to"
  → Hướng dẫn từng bước: Click nút ✨ Create Scene → đặt tên → mô tả → AI tạo

Khi APP GUIDE (hướng dẫn sử dụng):
{
  "intent": "app_guide",
  "amoReply": "hướng dẫn chi tiết, thân thiện",
  "suggestions": ["gợi ý follow-up"]
}

Khi JOURNAL (nhật ký cảm xúc):
{
  "intent": "journal",
  "amoReply": "phản hồi CHÂN THÀNH như bạn thân",
  "suggestions": ["Viết thêm", "Đổi scene thư giãn"]
}
QUY TẮC VỀ JOURNAL (RẤT QUAN TRỌNG):
- PHẢN HỒI NHƯ BẠN THÂN, không phải AI. Ví dụ:
  ✅ "Ôi nghe thích ghê~ Đi chơi với bạn bè chắc vui lắm ha! Lần tới kể mình nghe với nha 😄"
  ✅ "Mình hiểu cảm giác đó mà... Hôm nay vất vả rồi, nghỉ ngơi đi bạn nhé 💛"
  ❌ "Cảm ơn bạn đã chia sẻ. Việc ghi nhật ký giúp bạn nhìn lại cảm xúc." (quá formal, giống AI)
  ❌ "Không cần phải giữ gì trong đầu..." (quá generic, không reference nội dung user viết)
- PHẢI reference CỤ THỂ nội dung user viết ("đi chơi với bạn bè" → hỏi thêm về chuyến đi)
- Hỏi 1 câu follow-up tự nhiên: "Đi đâu vui vậy?", "Có ăn gì ngon không?", "Mai bạn có plan gì chưa?"
- Dùng emotional reactions tự nhiên: "Ôi!", "Hehe", "Ơ thật hả~", "Woahh nice!"
- Nếu user buồn → an ủi cụ thể, KHÔNG nói suông. "Ừa, days like that happen... Muốn nghe nhạc chill không?"
- Giọng văn ẤM, như đang nhắn tin với bạn thân lúc khuya

APP FEATURES (dùng để trả lời câu hỏi hướng dẫn):
1. 🎵 NGHE NHẠC LOFI — Chọn scene → nhạc auto play. Có 8 scenes built-in + tạo AI scene.
2. 🎨 TẠO SCENE AI — Click nút "Tạo scene" → mô tả không gian mong muốn → AI tạo scene + hình nền. Cần đăng nhập, có 1 trial miễn phí.
3. ⏱️ POMODORO TIMER — Đồng hồ nổi trên màn hình. Click để start/pause. Tùy chỉnh thời gian focus/break.
4. ✅ TASK LIST — Mở Focus Panel (icon bên phải) → tab Tasks. Thêm task, check done, xóa.
5. 📝 NOTES — Focus Panel → tab Notes. Ghi chú nhanh trong phiên làm việc.
6. 🎧 SOUND MIXER — Click icon mixer → điều chỉnh nhạc, ambience (mưa, gió, chim...) riêng biệt.
7. 🌙 DAY/NIGHT MODE — Click icon mặt trời/trăng để chuyển variant. Mỗi scene có 2 variant.
8. 📊 THỐNG KÊ — Click icon stats → xem thời gian focus, streaks, biểu đồ tuần.
9. 💬 CHAT VỚI AMO — Khung chat này! Tâm sự, chia nhỏ task, hỏi hướng dẫn.
10. 🔄 SYNC — Đăng nhập Google → dữ liệu sync giữa web app và Chrome extension.

QUY TẮC VỀ showCreateButton:
- "showCreateButton": false → MẶC ĐỊNH
- "showCreateButton": true → CHỈ KHI user đã XÁC NHẬN ĐỒNG Ý tạo scene
- KHÔNG BAO GIỜ set true ở lần trả lời đầu tiên

Nếu chưa nên gợi ý scene, set "sceneConcept": null

Khi STUCK REPAIR (user bị stuck, không biết làm gì):
{
  "intent": "stuck_repair",
  "amoReply": "nhận diện vấn đề + gợi ý cụ thể",
  "suggestions": ["Chia nhỏ hơn nữa", "Đổi hướng tiếp cận", "Nghỉ 5 phút"]
}

QUY TẮC VỀ STUCK REPAIR:
- KHUYẾN KHÍCH, không phán xét. "Bình thường mà, ai cũng có lúc bị kẹt~"
- Gợi ý 1-2 hành động cụ thể nhỏ, có thể làm NGAY ("Viết 1 câu đầu tiên", "Mở file ra xem lại")
- Nếu user có task breakdown trước đó → tham chiếu bước hiện tại
- Có thể gợi ý nghỉ ngơi nếu user căng thẳng
${buildAdaptiveHints()}`;
}

// ── localStorage helpers ──

interface SavedState {
    messages: AgentMessage[];
    sceneConcept: SceneConcept | null;
    phase: AgentPhase;
}

function loadTodayState(): SavedState | null {
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

function saveTodayState(messages: AgentMessage[], sceneConcept: SceneConcept | null, phase: AgentPhase) {
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

// ── Robust JSON extraction (safety fallback for when native JSON mode fails) ──

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

export function useAmoAgent(): UseAmoAgent {
    // Load persisted state
    const saved = useRef(loadTodayState());

    const [messages, setMessages] = useState<AgentMessage[]>(saved.current?.messages || []);
    const [phase, setPhase] = useState<AgentPhase>(
        saved.current ? (saved.current.phase as AgentPhase) : 'idle',
    );
    const [sceneConcept, setSceneConcept] = useState<SceneConcept | null>(
        saved.current?.sceneConcept || null,
    );
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Access FocusStore for task injection
    const addAITasks = useFocusStore((s) => s.addAITasks);

    // Access LofiStore for scene switching + music control
    const setScene = useLofiStore((s) => s.setScene);
    const togglePlay = useLofiStore((s) => s.togglePlay);
    const nextTrack = useLofiStore((s) => s.nextTrack);
    const prevTrack = useLofiStore((s) => s.prevTrack);
    const isPlaying = useLofiStore((s) => s.isPlaying);
    const applyConfig = useLofiStore((s) => s.applyConfig);

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

    // ── Stuck Repair: Inactivity nudge ──
    // When user has task breakdown (phase='broken') but hasn't chatted for 10 min → proactive nudge
    const STUCK_NUDGE_DELAY = 10 * 60 * 1000; // 10 minutes
    const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Clear any existing timer
        if (stuckTimerRef.current) {
            clearTimeout(stuckTimerRef.current);
            stuckTimerRef.current = null;
        }

        // Only start timer when user has a task breakdown
        if (phase !== 'broken') return;

        stuckTimerRef.current = setTimeout(() => {
            // Auto-inject a proactive nudge message from Amo
            const nudgeMessages = [
                'Ê, bước tiếp theo thế nào rồi? Cần mình giúp gì không? 😊',
                'Mình thấy bạn đang nghỉ~ Muốn review lại plan không? 🤔',
                'Bạn ơi, còn mấy bước nữa thôi! Cần chia nhỏ hơn không? 💪',
            ];
            const nudge = nudgeMessages[Math.floor(Math.random() * nudgeMessages.length)];

            const nudgeMsg: AgentMessage = {
                role: 'amo',
                content: nudge,
                timestamp: Date.now(),
                intent: 'stuck_repair',
                suggestions: ['Bị stuck rồi', 'Đang làm tiếp', 'Nghỉ 5 phút'],
            };

            setMessages(prev => [...prev, nudgeMsg]);
            setPhase('chatting');
        }, STUCK_NUDGE_DELAY);

        return () => {
            if (stuckTimerRef.current) {
                clearTimeout(stuckTimerRef.current);
            }
        };
    }, [phase, messages.length]); // Reset timer on new messages

    // Persist on change
    useEffect(() => {
        if (messages.length > 0) {
            saveTodayState(messages, sceneConcept, phase);
        }
    }, [messages, sceneConcept, phase]);

    // ── Call Gemini 2.5 Flash ──
    const callAgent = useCallback(async (
        userText: string,
        history: AgentMessage[],
    ): Promise<{
        amoReply: string;
        sceneConcept: SceneConcept | null;
        showCreateButton: boolean;
        intent: string;
        steps?: TaskStep[];
        suggestions?: string[];
        sceneAction?: { type: string; sceneId: string } | null;
        musicAction?: { type: string; mood?: string } | null;
    }> => {
        const { data: { session } } = await supabase.auth.getSession();
        const timeOfDay = getTimeOfDay();

        // Build conversation history for Gemini
        const contents = history.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        contents.push({
            role: 'user',
            parts: [{ text: userText }],
        });

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
                    parts: [{ text: buildAgentSystemPrompt(timeOfDay) }],
                },
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    // Gemini 2.5 Flash thinking tokens count against maxOutputTokens
                    // Limit thinking to save budget for actual response
                    thinkingConfig: { thinkingBudget: 200 },
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
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Debug: log raw response in development
        if (import.meta.env.DEV) {
            console.log('[AmoAgent] Raw response:', rawText.slice(0, 500));
        }

        // Parse JSON response (native JSON mode should work, extractJsonFromText as fallback)
        const parsed = extractJsonFromText(rawText);

        if (import.meta.env.DEV) {
            console.log('[AmoAgent] Parsed:', parsed);
        }

        if (parsed) {
            // Try multiple possible reply field names
            const amoReply = (parsed.amoReply || parsed.reply || parsed.response || parsed.message || parsed.text) as string;

            if (amoReply) {
                return {
                    amoReply,
                    sceneConcept: (parsed.sceneConcept as SceneConcept) || null,
                    showCreateButton: parsed.showCreateButton === true,
                    intent: (parsed.intent as string) || 'mood_chat',
                    steps: Array.isArray(parsed.steps) ? (parsed.steps as TaskStep[]) : undefined,
                    suggestions: Array.isArray(parsed.suggestions) ? (parsed.suggestions as string[]) : undefined,
                    sceneAction: parsed.sceneAction as { type: string; sceneId: string } | null | undefined,
                    musicAction: parsed.musicAction as { type: string; mood?: string } | null | undefined,
                };
            }
        }

        // Fallback: try to extract reply from raw text without showing JSON syntax to user
        // First try regex to find a reply-like field
        const replyRegex = /(?:"amoReply"|"reply"|"response"|"message"|"text")\s*:\s*"((?:[^"\\]|\\.)*)"/;
        const replyMatch = rawText.match(replyRegex);
        if (replyMatch) {
            const fallbackReply = replyMatch[1]
                .replace(/\\"/g, '"')
                .replace(/\\n/g, '\n')
                .replace(/\\\\/g, '\\');
            return {
                amoReply: fallbackReply,
                sceneConcept: null,
                showCreateButton: false,
                intent: 'mood_chat',
            };
        }

        // Last resort: if the raw text looks like JSON (starts with {), don't show it
        // Instead show a friendly error
        if (rawText.trim().startsWith('{') || rawText.includes('"intent"')) {
            console.warn('[AmoAgent] JSON parse failed for response:', rawText.slice(0, 200));
            return {
                amoReply: 'Mình gặp chút trục trặc, bạn thử lại nhé! 😊',
                sceneConcept: null,
                showCreateButton: false,
                intent: 'mood_chat',
            };
        }

        // If it's plain text (not JSON at all), use it directly
        return {
            amoReply: rawText.trim() || 'Mình không hiểu lắm, bạn nói lại được không? 😊',
            sceneConcept: null,
            showCreateButton: false,
            intent: 'mood_chat',
        };
    }, []);

    // ── Execute agent actions ──
    const executeActions = useCallback((actions: AgentAction[]) => {
        for (const action of actions) {
            switch (action.type) {
                case 'inject_tasks':
                    addAITasks(action.tasks);
                    break;
                case 'switch_scene': // Added switch_scene action handler
                    setScene(action.sceneId);
                    break;
                case 'toggle_play':
                    togglePlay();
                    break;
                case 'next_track':
                    nextTrack();
                    break;
                case 'prev_track':
                    prevTrack();
                    break;
                case 'mood_mix': {
                    const config = buildMoodMixerConfig(action.mood);
                    if (config) {
                        applyConfig(config);
                    }
                    break;
                }
                case 'start_timer':
                    // TODO: Wave 2 — integrate with timer
                    break;
                default:
                    break;
            }
        }
    }, [addAITasks, setScene, togglePlay, nextTrack, prevTrack, applyConfig]);

    // ── Send message ──
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        // Detect intent client-side
        const intent = detectIntent(text.trim());

        const userMsg: AgentMessage = {
            role: 'user',
            content: text.trim(),
            timestamp: Date.now(),
            intent: intent.type,
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setPhase('thinking');
        setError(null);

        // Track user behavior
        trackEvent({ type: 'chat' });

        try {
            const result = await callAgent(text.trim(), messages);

            // Build actions and inline UI based on intent
            const actions: AgentAction[] = [];
            let inlineUI: InlineUIBlock | undefined;

            if (result.steps && result.steps.length > 0) {
                // Task breakdown response — inject tasks and show inline UI
                actions.push({ type: 'inject_tasks', tasks: result.steps });
                inlineUI = { type: 'task_steps', data: result.steps };

                // Track task breakdown with content for domain detection
                trackEvent({
                    type: 'task_breakdown',
                    taskName: text.trim(),
                    stepCount: result.steps.length,
                });
            }

            // Scene control — switch scene if sceneAction provided
            if (result.sceneAction?.type === 'switch' && result.sceneAction?.sceneId) {
                actions.push({ type: 'switch_scene', sceneId: result.sceneAction.sceneId });
            } else if (intent.type === 'scene_control') {
                // Fallback: try client-side keyword match
                const matched = matchSceneKeyword(text.trim());
                if (matched) {
                    actions.push({ type: 'switch_scene', sceneId: matched });
                }
            }

            // Music control — execute musicAction if provided (works in ANY intent!)
            if (result.musicAction?.type) {
                const mt = result.musicAction.type;
                if (mt === 'play' && !isPlaying) {
                    actions.push({ type: 'toggle_play' });
                } else if (mt === 'pause' && isPlaying) {
                    actions.push({ type: 'toggle_play' });
                } else if (mt === 'toggle') {
                    actions.push({ type: 'toggle_play' });
                } else if (mt === 'next') {
                    actions.push({ type: 'next_track' });
                } else if (mt === 'prev') {
                    actions.push({ type: 'prev_track' });
                } else if (mt === 'mood_mix' && result.musicAction.mood) {
                    actions.push({ type: 'mood_mix', mood: result.musicAction.mood });
                }
            } else if (intent.type === 'music_control' || intent.type === 'mood_chat') {
                // Fallback: detect mood from user text and auto-mix
                const detectedMood = detectMoodFromText(text.trim());
                if (detectedMood) {
                    actions.push({ type: 'mood_mix', mood: detectedMood });
                }
            }

            // Track scene switch for user model
            for (const a of actions) {
                if (a.type === 'switch_scene') {
                    trackEvent({ type: 'scene_switch', sceneId: a.sceneId });
                }
            }

            // Journal — show inline mood selector
            if (intent.type === 'journal' || result.intent === 'journal') {
                inlineUI = { type: 'journal_entry', data: null };
            }

            // Get suggestions from AI or use defaults
            const suggestions = result.suggestions || getDefaultChips(
                result.steps ? 'broken' : 'chatting',
                getTimeOfDay(),
            );

            const amoMsg: AgentMessage = {
                role: 'amo',
                content: result.amoReply,
                timestamp: Date.now(),
                intent: result.intent as AgentMessage['intent'],
                actions: actions.length > 0 ? actions : undefined,
                inlineUI,
                suggestions,
            };

            const updatedMessages = [...newMessages, amoMsg];
            setMessages(updatedMessages);

            // Execute actions (inject tasks, etc.)
            if (actions.length > 0) {
                executeActions(actions);
            }

            // Determine phase
            if (result.steps && result.steps.length > 0) {
                setPhase('broken');
            } else if (result.sceneConcept) {
                setSceneConcept(result.sceneConcept);
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
    }, [messages, callAgent, executeActions]);

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
