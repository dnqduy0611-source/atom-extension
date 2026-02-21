/**
 * userModel — Behavior tracking + Adaptive Prompt engine for Amo Agent.
 *
 * Tracks user patterns in localStorage:
 *   - Basic metrics (chat count, focus minutes, scene switches)
 *   - Task history (recent tasks, domain detection, step completion)
 *   - Mood patterns (stress detection, common emotions)
 *
 * Generates adaptive hints that adjust Gemini's behavior:
 *   - Step sizing (merge small steps if user skips them)
 *   - Domain awareness (user studies React → more specific steps)
 *   - Tone adjustment (stressed → gentler, productive → encouraging)
 */

// ── Types ──

export interface TaskHistoryEntry {
    /** Task name/description */
    task: string;
    /** Number of steps generated */
    stepCount: number;
    /** Number of steps completed */
    stepsCompleted: number;
    /** Timestamp */
    timestamp: number;
}

export interface UserModel {
    // ── Basic metrics ──
    totalFocusMinutes: number;
    tasksCompletedToday: number;
    chatCountToday: number;
    preferredScenes: string[];
    commonMoods: string[];
    lastActiveTime: number;
    date: string;
    sceneSwitchCount: number;
    taskBreakdownCount: number;

    // ── Enhanced: Task history ──
    /** Recent task descriptions (last 10) for domain detection */
    recentTasks: string[];
    /** Full task history with completion data (last 20) */
    taskHistory: TaskHistoryEntry[];
    /** Auto-detected work domain */
    detectedDomain: string | null;
    /** Average step completion rate (0-1) */
    completionRate: number;
    /** Average preferred step duration in minutes */
    averageStepMinutes: number;
    /** Hours when user is most active */
    activeHours: number[];
}

export type UserEvent =
    | { type: 'chat' }
    | { type: 'task_breakdown'; taskName: string; stepCount: number }
    | { type: 'scene_switch'; sceneId: string }
    | { type: 'focus_complete'; minutes: number }
    | { type: 'task_complete' }
    | { type: 'task_step_complete'; taskName: string; stepsCompleted: number; totalSteps: number }
    | { type: 'mood_detected'; mood: string };

// ── Constants ──

const USER_MODEL_KEY = 'amo_user_model';
const MAX_RECENT_TASKS = 10;
const MAX_TASK_HISTORY = 20;

// ── Domain detection keywords ──

const DOMAIN_KEYWORDS: Record<string, string[]> = {
    'lập trình': ['code', 'coding', 'react', 'javascript', 'typescript', 'python', 'api', 'component', 'function', 'bug', 'debug', 'deploy', 'git', 'css', 'html', 'database', 'server', 'frontend', 'backend', 'app', 'web', 'lập trình', 'viết code'],
    'học tập': ['ôn thi', 'bài tập', 'học', 'study', 'exam', 'revision', 'flashcard', 'ghi chú', 'note', 'summary', 'tóm tắt', 'chương', 'chapter', 'lecture', 'bài giảng'],
    'viết lách': ['viết', 'write', 'essay', 'blog', 'article', 'báo cáo', 'report', 'thesis', 'luận văn', 'draft', 'nháp', 'outline', 'content'],
    'thiết kế': ['design', 'figma', 'ui', 'ux', 'mockup', 'prototype', 'layout', 'wireframe', 'thiết kế', 'icon', 'illustration'],
    'công việc': ['presentation', 'thuyết trình', 'slide', 'meeting', 'email', 'họp', 'deadline', 'project', 'dự án', 'kế hoạch', 'plan'],
};

// ── Helpers ──

function getToday(): string {
    return new Date().toDateString();
}

function getCurrentHour(): number {
    return new Date().getHours();
}

function detectDomain(tasks: string[]): string | null {
    if (tasks.length === 0) return null;

    const combined = tasks.join(' ').toLowerCase();
    let bestDomain: string | null = null;
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
        const score = keywords.filter(kw => combined.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestDomain = domain;
        }
    }

    return bestScore >= 2 ? bestDomain : null;
}

function getDefaultModel(): UserModel {
    return {
        totalFocusMinutes: 0,
        tasksCompletedToday: 0,
        chatCountToday: 0,
        preferredScenes: [],
        commonMoods: [],
        lastActiveTime: Date.now(),
        date: getToday(),
        sceneSwitchCount: 0,
        taskBreakdownCount: 0,
        recentTasks: [],
        taskHistory: [],
        detectedDomain: null,
        completionRate: 0,
        averageStepMinutes: 0,
        activeHours: [],
    };
}

// ── Core functions ──

export function getUserModel(): UserModel {
    try {
        const raw = localStorage.getItem(USER_MODEL_KEY);
        if (!raw) return getDefaultModel();

        const defaults = getDefaultModel();
        // Merge with defaults to handle old data missing new fields
        const model: UserModel = { ...defaults, ...JSON.parse(raw) };

        // Ensure arrays are always arrays (old data might be missing them)
        if (!Array.isArray(model.recentTasks)) model.recentTasks = [];
        if (!Array.isArray(model.taskHistory)) model.taskHistory = [];
        if (!Array.isArray(model.activeHours)) model.activeHours = [];
        if (!Array.isArray(model.preferredScenes)) model.preferredScenes = [];
        if (!Array.isArray(model.commonMoods)) model.commonMoods = [];

        // Daily reset for daily counters only
        if (model.date !== getToday()) {
            return {
                ...model,
                tasksCompletedToday: 0,
                chatCountToday: 0,
                date: getToday(),
                lastActiveTime: Date.now(),
            };
        }

        return model;
    } catch {
        return getDefaultModel();
    }
}

function saveModel(model: UserModel): void {
    try {
        localStorage.setItem(USER_MODEL_KEY, JSON.stringify(model));
    } catch {
        // localStorage full — ignore
    }
}

export function trackEvent(event: UserEvent): void {
    const model = getUserModel();
    model.lastActiveTime = Date.now();

    // Track active hours
    const hour = getCurrentHour();
    if (!model.activeHours.includes(hour)) {
        model.activeHours = [...model.activeHours, hour].slice(-24);
    }

    switch (event.type) {
        case 'chat':
            model.chatCountToday++;
            break;

        case 'task_breakdown':
            model.taskBreakdownCount++;
            // Store task description for domain detection
            model.recentTasks = [event.taskName, ...model.recentTasks].slice(0, MAX_RECENT_TASKS);
            model.taskHistory = [{
                task: event.taskName,
                stepCount: event.stepCount,
                stepsCompleted: 0,
                timestamp: Date.now(),
            }, ...model.taskHistory].slice(0, MAX_TASK_HISTORY);
            // Re-detect domain
            model.detectedDomain = detectDomain(model.recentTasks);
            break;

        case 'task_step_complete': {
            // Update completion data for matching task
            const entry = model.taskHistory.find(t => t.task === event.taskName);
            if (entry) {
                entry.stepsCompleted = event.stepsCompleted;
            }
            // Recalculate completion rate
            const withSteps = model.taskHistory.filter(t => t.stepCount > 0);
            if (withSteps.length > 0) {
                model.completionRate = withSteps.reduce(
                    (sum, t) => sum + (t.stepsCompleted / t.stepCount), 0
                ) / withSteps.length;
            }
            break;
        }

        case 'scene_switch':
            model.sceneSwitchCount++;
            if (!model.preferredScenes.includes(event.sceneId)) {
                model.preferredScenes = [event.sceneId, ...model.preferredScenes].slice(0, 5);
            }
            break;

        case 'focus_complete':
            model.totalFocusMinutes += event.minutes;
            break;

        case 'task_complete':
            model.tasksCompletedToday++;
            break;

        case 'mood_detected':
            if (!model.commonMoods.includes(event.mood)) {
                model.commonMoods = [event.mood, ...model.commonMoods].slice(0, 5);
            }
            break;
    }

    saveModel(model);
}

// ── Adaptive Prompt Builder ──

/**
 * Generate adaptive hints for the system prompt.
 * These hints adjust Gemini's behavior based on learned user patterns.
 */
export function buildAdaptiveHints(): string {
    const m = getUserModel();
    const hints: string[] = [];

    // ── Domain awareness ──
    if (m.detectedDomain) {
        hints.push(`User chủ yếu làm về "${m.detectedDomain}". Khi chia nhỏ task, dùng thuật ngữ và bước cụ thể cho lĩnh vực này.`);
    }

    if (m.recentTasks.length > 0) {
        hints.push(`Tasks gần đây: ${m.recentTasks.slice(0, 5).join(', ')}`);
    }

    // ── Step sizing ──
    if (m.completionRate > 0) {
        if (m.completionRate < 0.4) {
            hints.push('User hay bỏ dở steps → chia ÍT bước hơn (2-3), mỗi bước DÀI hơn, actionable hơn.');
        } else if (m.completionRate > 0.8) {
            hints.push('User hoàn thành tốt → có thể chia chi tiết hơn (5-7 bước).');
        }
    }

    // ── Chat style ──
    if (m.chatCountToday >= 8) {
        hints.push('User đã chat nhiều hôm nay → trả lời NGẮN GỌN hơn, đi thẳng vào vấn đề.');
    }

    // ── Productivity ──
    if (m.totalFocusMinutes > 60) {
        hints.push(`User đã focus ${m.totalFocusMinutes} phút → khen ngợi nhẹ khi phù hợp.`);
    }

    if (m.tasksCompletedToday >= 3) {
        hints.push(`User hoàn thành ${m.tasksCompletedToday} tasks hôm nay, rất năng suất!`);
    }

    // ── Mood awareness ──
    const stressMoods = ['stressed', 'sad', 'tired', 'overwhelmed', 'buồn', 'mệt', 'stress'];
    const isStressed = m.commonMoods.some(mood => stressMoods.includes(mood.toLowerCase()));
    if (isStressed) {
        hints.push('User có dấu hiệu căng thẳng → ưu tiên an ủi, động viên, nhẹ nhàng. Đừng push quá nhiều.');
    }

    // ── Time awareness ──
    if (m.activeHours.length >= 5) {
        const peakHours = m.activeHours.sort((a, b) => a - b);
        hints.push(`Giờ hay hoạt động: ${peakHours.slice(0, 3).map(h => `${h}h`).join(', ')}`);
    }

    // ── User context stats ──
    const stats: string[] = [];
    if (m.chatCountToday > 0) stats.push(`chat hôm nay: ${m.chatCountToday}`);
    if (m.taskBreakdownCount > 0) stats.push(`task breakdowns: ${m.taskBreakdownCount}`);
    if (m.preferredScenes.length > 0) stats.push(`scenes yêu thích: ${m.preferredScenes.join(', ')}`);

    if (stats.length > 0) {
        hints.push(`Stats: ${stats.join(' | ')}`);
    }

    if (hints.length === 0) return '';

    return `\n\nADAPTIVE CONTEXT (điều chỉnh behavior theo user):\n${hints.map(h => `- ${h}`).join('\n')}`;
}

/**
 * @deprecated Use buildAdaptiveHints() instead. Kept for backward compat.
 */
export function getUserContextString(): string {
    return buildAdaptiveHints();
}

/**
 * Build scene creation hints based on user preferences.
 * Appended to scene description to guide Gemini toward user taste.
 */
export function buildSceneHints(): string {
    const m = getUserModel();
    const hints: string[] = [];

    // Preferred scenes → style preference
    if (m.preferredScenes.length > 0) {
        const sceneNames = m.preferredScenes.slice(0, 3).join(', ');
        hints.push(`User thích các scene: ${sceneNames}. Hãy tạo scene phù hợp phong cách tương tự.`);
    }

    // Mood → atmosphere preference
    if (m.commonMoods.length > 0) {
        const recentMood = m.commonMoods[0];
        const moodAtmosphere: Record<string, string> = {
            'stressed': 'calming, peaceful, natural elements',
            'happy': 'vibrant, warm, lively atmosphere',
            'tired': 'cozy, soft lighting, gentle ambience',
            'focused': 'clean, minimal distractions, cool tones',
            'sad': 'warm, comforting, intimate lighting',
        };
        const atmo = moodAtmosphere[recentMood];
        if (atmo) hints.push(`User mood: ${recentMood} → prefer ${atmo}`);
    }

    // Time of day → lighting preference
    const hour = getCurrentHour();
    if (hour >= 22 || hour < 6) {
        hints.push('Night time → prefer darker, cozier scenes with warm artificial lighting');
    } else if (hour >= 6 && hour < 12) {
        hints.push('Morning → prefer fresh, bright, natural light scenes');
    } else if (hour >= 17 && hour < 22) {
        hints.push('Evening → prefer sunset/golden hour, warm ambient lighting');
    }

    // Domain → context
    if (m.detectedDomain) {
        const domainScene: Record<string, string> = {
            'lập trình': 'tech-inspired, dark mode friendly, cyberpunk or modern workspace vibes',
            'học tập': 'library, study room, academic atmosphere',
            'viết lách': 'literary, vintage, cozy writing nook',
            'thiết kế': 'creative studio, colorful, artistic',
            'công việc': 'professional, modern office, clean aesthetic',
        };
        const context = domainScene[m.detectedDomain];
        if (context) hints.push(`Work domain: ${m.detectedDomain} → ${context}`);
    }

    if (hints.length === 0) return '';

    return '\n\n[User Preferences: ' + hints.join('. ') + ']';
}
