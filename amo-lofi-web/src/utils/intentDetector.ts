/**
 * intentDetector — Client-side intent detection for Amo Agent.
 *
 * Uses keyword/regex matching to classify user messages into intents.
 * Default: mood_chat (user never sees "I don't understand").
 * Cost: $0 — runs entirely on client.
 */

import type { AmoIntent } from '../types/agent';

// ── Pattern definitions ──

interface IntentPattern {
    type: AmoIntent['type'];
    patterns: RegExp[];
    extract?: (text: string, match: RegExpMatchArray) => Partial<AmoIntent>;
}

const INTENT_PATTERNS: IntentPattern[] = [
    {
        type: 'task_breakdown',
        patterns: [
            /(?:chia nhỏ|break\s*down|breakdown|split|tách)\s+(?:task|công việc|việc)?\s*[:\-]?\s*(.+)/i,
            /(?:giúp|help)\s+(?:mình|me|tôi)\s+(?:chia|break|plan|lên kế hoạch)\s+(.+)/i,
            /(?:lên kế hoạch|plan|planning)\s+(?:cho|for)?\s*(.+)/i,
            /(?:chia nhỏ|chia|break|tách)\s+(.+)/i,
        ],
        extract: (_text, match) => ({ taskText: match[1]?.trim() || _text } as Partial<AmoIntent>),
    },
    {
        type: 'insight_report',
        patterns: [
            /(?:xem|show|hiện|thống kê|stats|statistics)\s*(?:insight|report|báo cáo|tuần|weekly)/i,
            /(?:insight|report|báo cáo)\s*(?:tuần|weekly|hôm nay|today)?/i,
            /tuần\s+(?:này|qua|trước)/i,
            /weekly\s+(?:report|insight|summary)/i,
        ],
    },
    {
        type: 'scene_control',
        patterns: [
            /(?:đổi|switch|change|chuyển)\s+(?:scene|cảnh|background|hình nền|không gian)/i,
            /(?:tạo|create|make)\s+scene/i,
            /(?:scene|background|hình nền|không gian)\s+(?:mưa|rain|biển|sea|forest|rừng|café|coffee|night|đêm|city|thành phố|space|vũ trụ|cyberpunk|anime|ghibli)/i,
            /(?:mình muốn|muốn|cho mình|i want)\s+(?:nghe|xem|thấy)?\s*(?:mưa|rain|biển|sea|rừng|forest|cafe|café|đêm|night|thành phố|city|vũ trụ|space|cyberpunk|anime|ghibli)/i,
            /(?:đổi|chuyển|cho)\s+(?:mình\s+)?(?:mưa|rain|biển|sea|rừng|forest|cafe|café|đêm|night|thành phố|city|vũ trụ|space|cyberpunk|anime|ghibli)/i,
        ],
        extract: (text) => ({ query: text } as Partial<AmoIntent>),
    },
    {
        type: 'music_control',
        patterns: [
            /(?:bật|mở|play|start|phát)\\s+(?:nhạc|music|lofi|playlist|bài)/i,
            /(?:tắt|dừng|stop|pause|ngừng)\\s+(?:nhạc|music|lofi|playlist|bài)/i,
            /(?:bài|track|song|nhạc)\\s+(?:tiếp|kế|next|sau|khác)/i,
            /(?:next|skip|chuyển)\\s+(?:bài|track|song|nhạc)/i,
            /(?:prev|back|quay lại|bài trước)/i,
        ],
        extract: (text) => ({ query: text } as Partial<AmoIntent>),
    },
    {
        type: 'app_guide',
        patterns: [
            /(?:cách|how)\s+(?:dùng|use|sử dụng|tạo|modify|chỉnh|xài)/i,
            /(?:hướng dẫn|guide|tutorial)\s+/i,
            /(?:tính năng|feature|chức năng)\s+(?:gì|what|nào)/i,
            /app\s+(?:có|có thể|can)\s+(?:làm|do)\s+(?:gì|what)/i,
        ],
        extract: (text) => ({ question: text } as Partial<AmoIntent>),
    },
    {
        type: 'journal',
        patterns: [
            /(?:nhật ký|journal|diary)\b/i,
            /(?:ghi lại|note|ghi chú|journal)\s+(?:hôm nay|today)/i,
            /(?:viết|write)\s+(?:nhật ký|journal|diary)/i,
        ],
        extract: (text) => ({ entry: text } as Partial<AmoIntent>),
    },
    {
        type: 'stuck_repair',
        patterns: [
            /(?:bị stuck|bị kẹt|mắc kẹt|stuck|blocked)\b/i,
            /(?:không biết|ko biết|chẳng biết)\s+(?:làm gì|bắt đầu|tiếp|ntn)/i,
            /(?:giúp|help)\s+(?:mình|me|tôi)\s+(?:với|đi|please)/i,
            /(?:bước tiếp|next step|tiếp theo)\s+(?:là gì|gì|what)/i,
            /(?:chán|overwhelmed|quá tải|không tập trung|distracted)/i,
        ],
    },
];

// ── Main detection function ──

export function detectIntent(text: string): AmoIntent {
    const trimmed = text.trim();
    if (!trimmed) return { type: 'mood_chat' };

    for (const { type, patterns, extract } of INTENT_PATTERNS) {
        for (const pattern of patterns) {
            const match = trimmed.match(pattern);
            if (match) {
                const base = { type } as AmoIntent;
                if (extract) Object.assign(base, extract(trimmed, match));
                return base;
            }
        }
    }

    // Default: mood_chat — Amo responds as a friend, never "I don't understand"
    return { type: 'mood_chat' };
}

// ── Suggestion chips for each phase ──

export function getDefaultChips(phase: string, timeOfDay?: string): string[] {
    if (phase === 'idle') {
        const chips = ['Chia nhỏ task', 'Tâm sự với Amo'];
        if (timeOfDay === 'morning') chips.push('Lên kế hoạch hôm nay');
        if (timeOfDay === 'evening') chips.push('Review ngày hôm nay');
        return chips.slice(0, 4);
    }

    if (phase === 'broken') {
        return ['Bắt đầu timer', 'Chỉnh lại plan', 'Thêm task khác'];
    }

    if (phase === 'chatting') {
        return ['Chia nhỏ task', 'Đổi scene'];
    }

    return ['Chia nhỏ task', 'Tâm sự với Amo'];
}

// ── Scene keyword → sceneId mapping ──

const SCENE_KEYWORDS: Record<string, string> = {
    // Vietnamese
    'cafe': 'cozy_cafe', 'café': 'cozy_cafe', 'cà phê': 'cozy_cafe',
    'vườn': 'japanese_garden', 'garden': 'japanese_garden', 'nhật bản': 'japanese_garden',
    'thành phố': 'city_night', 'city': 'city_night', 'đêm': 'city_night', 'night': 'city_night',
    'mưa': 'city_night', 'rain': 'city_night',
    'rừng': 'forest_cabin', 'forest': 'forest_cabin',
    'biển': 'ocean_cliff', 'ocean': 'ocean_cliff', 'sea': 'ocean_cliff', 'sóng': 'ocean_cliff',
    'vũ trụ': 'space_station', 'space': 'space_station',
    'cyberpunk': 'cyberpunk_alley', 'neon': 'cyberpunk_alley',
    'anime': 'ghibli_meadow', 'ghibli': 'ghibli_meadow',
};

export function matchSceneKeyword(text: string): string | null {
    const lower = text.toLowerCase();
    for (const [keyword, sceneId] of Object.entries(SCENE_KEYWORDS)) {
        if (lower.includes(keyword)) return sceneId;
    }
    return null;
}
