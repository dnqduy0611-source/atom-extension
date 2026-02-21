/**
 * moodAudioMap.ts — Maps mood/vibe keywords to FULL immersive presets.
 *
 * Each preset defines: scene + track + ambience = holistic mood experience.
 * When Amo detects a mood, it applies everything at once via applyConfig().
 *
 * Track IDs must match TRACK_ORDER in useLofiStore.ts
 * Ambience IDs must match ambienceLayers in useLofiStore.ts
 * Scene IDs must match scenes in the scene list
 */

import type { MixerConfig } from '../store/useLofiStore';

// ── Mood Preset Definition ──

interface MoodPreset {
    /** Scene to switch to (holistic experience) */
    sceneId: string;
    /** Day or night variant */
    variant: 'day' | 'night';
    /** Track to play */
    trackId: string;
    trackVolume: number;
    /** Ambience layers to activate with volumes */
    ambience: { id: string; volume: number }[];
    /** Emoji for Amo's reply */
    emoji: string;
    /** Vietnamese description for Amo */
    description: string;
}

// ── Mood Presets ──
// Each preset = scene + music + ambience → complete immersive environment

const MOOD_PRESETS: Record<string, MoodPreset> = {
    // Sad / Melancholic → cozy rainy cabin
    sad: {
        sceneId: 'forest_cabin',
        variant: 'night',
        trackId: 'lofi_chill_01',
        trackVolume: 0.4,
        ambience: [
            { id: 'rain', volume: 0.6 },
            { id: 'fire', volume: 0.3 },
        ],
        emoji: '🌧️',
        description: 'cabin rừng đêm mưa + lofi nhẹ nhàng + lửa ấm, lặng lẽ nghe mưa',
    },

    // Happy / Energetic → bright meadow
    happy: {
        sceneId: 'ghibli_meadow',
        variant: 'day',
        trackId: 'lofi_chill_02',
        trackVolume: 0.6,
        ambience: [
            { id: 'wind', volume: 0.3 },
        ],
        emoji: '🌸',
        description: 'đồng cỏ Ghibli + lofi vui vẻ + gió nhẹ, bay bổng~',
    },

    // Stressed / Anxious → ocean cliff
    stressed: {
        sceneId: 'ocean_cliff',
        variant: 'day',
        trackId: 'ambient_01',
        trackVolume: 0.4,
        ambience: [
            { id: 'ocean', volume: 0.5 },
            { id: 'wind', volume: 0.3 },
        ],
        emoji: '🌊',
        description: 'vách đá biển + ambient + sóng biển, thả stress ra biển luôn',
    },

    // Tired / Sleepy → forest cabin
    tired: {
        sceneId: 'forest_cabin',
        variant: 'night',
        trackId: 'ambient_01',
        trackVolume: 0.3,
        ambience: [
            { id: 'rain', volume: 0.4 },
            { id: 'fire', volume: 0.4 },
        ],
        emoji: '🔥',
        description: 'cabin trong rừng đêm + mưa và lửa bập bùng, ấm cúng cực',
    },

    // Focused / Productive → space station
    focused: {
        sceneId: 'space_station',
        variant: 'night',
        trackId: 'classical_01',
        trackVolume: 0.35,
        ambience: [
            { id: 'white_noise', volume: 0.2 },
        ],
        emoji: '🚀',
        description: 'trạm vũ trụ + classical + white noise, zone in kiểu NASA',
    },

    // Chill / Relaxed → cozy cafe
    chill: {
        sceneId: 'cozy_cafe',
        variant: 'day',
        trackId: 'lofi_chill_01',
        trackVolume: 0.5,
        ambience: [
            { id: 'rain', volume: 0.3 },
            { id: 'coffee_shop', volume: 0.4 },
        ],
        emoji: '☕',
        description: 'quán café ấm áp + lofi + mưa nhẹ ngoài cửa kính',
    },

    // Lonely / Missing someone → city night
    lonely: {
        sceneId: 'city_night',
        variant: 'night',
        trackId: 'lofi_chill_02',
        trackVolume: 0.4,
        ambience: [
            { id: 'rain', volume: 0.5 },
            { id: 'wind', volume: 0.2 },
        ],
        emoji: '🌃',
        description: 'thành phố đêm + mưa và gió, lặng lẽ giữa phố vắng',
    },

    // Angry / Frustrated → cyberpunk
    angry: {
        sceneId: 'cyberpunk_alley',
        variant: 'night',
        trackId: 'synthwave_01',
        trackVolume: 0.5,
        ambience: [
            { id: 'thunder', volume: 0.4 },
        ],
        emoji: '⚡',
        description: 'hẻm cyberpunk neon + synthwave + sấm sét, xả hết năng lượng',
    },

    // Peaceful / Zen → japanese garden
    peaceful: {
        sceneId: 'japanese_garden',
        variant: 'day',
        trackId: 'ambient_01',
        trackVolume: 0.35,
        ambience: [
            { id: 'wind', volume: 0.3 },
            { id: 'ocean', volume: 0.2 },
        ],
        emoji: '🍃',
        description: 'vườn Nhật yên bình + ambient + gió nhẹ, tĩnh tâm',
    },

    // Night / Late night → forest cabin night
    night: {
        sceneId: 'forest_cabin',
        variant: 'night',
        trackId: 'ambient_01',
        trackVolume: 0.3,
        ambience: [
            { id: 'rain', volume: 0.3 },
            { id: 'fire', volume: 0.5 },
        ],
        emoji: '🌙',
        description: 'cabin đêm + lửa bập bùng + mưa xa xa, cozy max',
    },

    // Epic / Adventure → cyberpunk
    epic: {
        sceneId: 'cyberpunk_alley',
        variant: 'night',
        trackId: 'synthwave_01',
        trackVolume: 0.6,
        ambience: [
            { id: 'dungeon_air', volume: 0.3 },
            { id: 'wind', volume: 0.2 },
        ],
        emoji: '⚔️',
        description: 'cyberpunk neon + synthwave epic + gió huyền bí, adventure ON',
    },

    // Study → japanese garden day
    study: {
        sceneId: 'japanese_garden',
        variant: 'day',
        trackId: 'classical_01',
        trackVolume: 0.3,
        ambience: [
            { id: 'wind', volume: 0.2 },
        ],
        emoji: '📚',
        description: 'vườn Nhật yên tĩnh + classical nhẹ, perfect cho học bài',
    },
};

// ── Keyword → Mood Mapping ──

const MOOD_KEYWORDS: [RegExp, string][] = [
    // Sad
    [/buồn|sad|grieve|tủi|thất vọng|disappointment|đau|khóc|cry|nhớ nhà|homesick/i, 'sad'],
    // Happy
    [/vui|happy|hạnh phúc|phấn khích|excited|yay|hehe|tốt|good|great|tuyệt/i, 'happy'],
    // Stressed
    [/stress|căng thẳng|áp lực|pressure|lo lắng|anxiety|overwhelm|quá tải|deadline/i, 'stressed'],
    // Tired
    [/mệt|tired|kiệt sức|exhaust|ngủ|sleepy|buồn ngủ|uể oải/i, 'tired'],
    // Focused
    [/tập trung|focus|productive|làm việc|work|code|coding|lập trình/i, 'focused'],
    // Chill / Relax
    [/chill|relax|thư giãn|thoải mái|nghỉ ngơi|rest|bình yên/i, 'chill'],
    // Lonely
    [/cô đơn|lonely|một mình|alone|nhớ|miss|xa nhà/i, 'lonely'],
    // Angry
    [/tức|angry|bực|frustrated|chán|annoyed|irritate|điên/i, 'angry'],
    // Peaceful / Zen
    [/peaceful|zen|tĩnh lặng|thiền|meditat|yên bình|calm/i, 'peaceful'],
    // Night
    [/khuya|đêm|night|midnight|late|3h sáng|2 giờ sáng/i, 'night'],
    // Epic
    [/epic|phiêu lưu|adventure|game|gaming|battle|chiến|war/i, 'epic'],
    // Study
    [/học bài|study|ôn thi|exam|kiểm tra|bài tập|homework/i, 'study'],
];

/**
 * Detect mood from text (user message / journal content).
 * Returns mood key or null if no match.
 */
export function detectMoodFromText(text: string): string | null {
    const lower = text.toLowerCase();
    for (const [pattern, mood] of MOOD_KEYWORDS) {
        if (pattern.test(lower)) {
            return mood;
        }
    }
    return null;
}

/**
 * Get the mood preset for a given mood key.
 */
export function getMoodPreset(mood: string): MoodPreset | null {
    return MOOD_PRESETS[mood] || null;
}

/**
 * Build a MixerConfig from a mood key.
 * Includes scene switch + music + ambience — full immersive experience.
 * Can be directly passed to useLofiStore.applyConfig().
 */
export function buildMoodMixerConfig(mood: string): MixerConfig | null {
    const preset = MOOD_PRESETS[mood];
    if (!preset) return null;

    return {
        scene_id: preset.sceneId,
        variant: preset.variant,
        music: { id: preset.trackId, volume: preset.trackVolume },
        ambience: preset.ambience,
    };
}

/**
 * Get all available mood names (for prompt context).
 */
export function getAvailableMoods(): string[] {
    return Object.keys(MOOD_PRESETS);
}

/**
 * Get a description string of all mood presets for prompt.
 */
export function getMoodPresetsForPrompt(): string {
    return Object.entries(MOOD_PRESETS)
        .map(([mood, p]) => `${mood}: ${p.emoji} ${p.sceneId} + ${p.description}`)
        .join('\n');
}
