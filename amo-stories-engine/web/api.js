/**
 * API Service — handles all backend communication
 * Supports both REST and SSE streaming endpoints
 */

const BASE = '/api';

/** Generic REST helper with timeout */
async function request(method, path, body = null, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = { 'Content-Type': 'application/json' };
    // Attach JWT when available (production Supabase auth)
    const token = localStorage.getItem('amo_auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = {
        method,
        headers,
        signal: controller.signal,
    };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(`${BASE}${path}`, opts);
        clearTimeout(timer);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new Error(err.detail || 'API Error');
        }
        return res.json();
    } catch (e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') {
            throw new Error('Server không phản hồi — vui lòng thử lại sau');
        }
        throw e;
    }
}

// ── Player ──

export async function onboardPlayer(userId, name, quizAnswers) {
    return request('POST', '/player/onboard', {
        user_id: userId,
        name,
        quiz_answers: quizAnswers,
    });
}

export async function getPlayer(userId) {
    return request('GET', `/player/${userId}`);
}

export async function getPlayerIdentity(userId) {
    return request('GET', `/player/${userId}/identity`);
}

// ── Story REST ──

export async function createStory(userId, preferenceTags = '', backstory = '', protagonistName = '', tone = '') {
    const params = new URLSearchParams({
        user_id: userId,
        preference_tags: preferenceTags,
        backstory,
        protagonist_name: protagonistName,
        tone,
    });
    const res = await fetch(`${BASE}/story/create?${params}`, { method: 'POST' });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Create story failed');
    }
    return res.json();
}

export async function startStory(userId, preferenceTags = [], backstory = '', protagonistName = '', quizAnswers = null) {
    return request('POST', '/story/start', {
        user_id: userId,
        preference_tags: preferenceTags,
        backstory,
        protagonist_name: protagonistName,
        quiz_answers: quizAnswers,
    });
}

export async function continueStory(storyId, choiceId = '', freeInput = '') {
    return request('POST', '/story/continue', {
        story_id: storyId,
        choice_id: choiceId,
        free_input: freeInput,
    });
}

export async function getStoryState(storyId) {
    return request('GET', `/story/${storyId}/state`);
}

export async function listUserStories(userId) {
    return request('GET', `/story/user/${userId}`);
}

// ── Story SSE Streaming ──

/**
 * Stream story start via SSE
 * @param {object} params - { user_id, preference_tags, backstory, protagonist_name }
 * @param {object} handlers - { onStatus, onProse, onChoices, onMetadata, onIdentity, onDone, onError }
 * @returns {EventSource}
 */
export function streamStart(params, handlers) {
    const qs = new URLSearchParams({
        user_id: params.user_id,
        preference_tags: params.preference_tags || '',
        backstory: params.backstory || '',
        protagonist_name: params.protagonist_name || '',
        tone: params.tone || '',
    });

    return _connectSSE(`${BASE}/story/stream/start?${qs}`, handlers);
}

/**
 * Stream story continue via SSE
 * @param {object} params - { story_id, choice_id?, free_input? }
 * @param {object} handlers - event handlers
 * @returns {EventSource}
 */
export function streamContinue(params, handlers) {
    const qs = new URLSearchParams({
        story_id: params.story_id,
    });
    if (params.choice_id) qs.set('choice_id', params.choice_id);
    if (params.free_input) qs.set('free_input', params.free_input);

    return _connectSSE(`${BASE}/story/stream/continue?${qs}`, handlers);
}

// ── Scene SSE Streaming ──

/**
 * Stream scene-based story start via SSE
 * @param {object} params - { user_id, preference_tags, backstory, protagonist_name, tone }
 * @param {object} handlers - { onStatus, onSceneProse, onScene, onMetadata, onIdentity, onDone, onError }
 * @returns {EventSource}
 */
export function streamSceneStart(params, handlers) {
    const qs = new URLSearchParams({
        user_id: params.user_id,
        preference_tags: params.preference_tags || '',
        backstory: params.backstory || '',
        protagonist_name: params.protagonist_name || '',
        tone: params.tone || '',
    });

    return _connectSSE(`${BASE}/story/stream/scene-start?${qs}`, handlers, true);
}

/**
 * Stream scene-based story continue via SSE
 * @param {object} params - { story_id, choice_id?, free_input? }
 * @param {object} handlers - { onStatus, onSceneProse, onScene, onMetadata, onIdentity, onDone, onError }
 * @returns {EventSource}
 */
export function streamSceneContinue(params, handlers) {
    const qs = new URLSearchParams({
        story_id: params.story_id,
    });
    if (params.choice_id) qs.set('choice_id', params.choice_id);
    if (params.free_input) qs.set('free_input', params.free_input);

    return _connectSSE(`${BASE}/story/stream/scene-continue?${qs}`, handlers, true);
}

/**
 * Stream interactive scene-first via SSE (Phase B)
 * Plans a new chapter + generates ONLY scene 1
 * @param {object} params - { story_id, user_id, choice_id?, free_input? }
 * @param {object} handlers - { onStatus, onSceneProse, onScene, onMetadata, onIdentity, onDone, onError }
 * @returns {EventSource}
 */
export function streamSceneFirst(params, handlers) {
    const qs = new URLSearchParams({
        story_id: params.story_id,
        user_id: params.user_id,
    });
    if (params.choice_id) qs.set('choice_id', params.choice_id);
    if (params.free_input) qs.set('free_input', params.free_input);

    return _connectSSE(`${BASE}/story/stream/scene-first?${qs}`, handlers, true);
}

/**
 * Stream interactive scene-next via SSE (Phase B)
 * Generates the next scene in an existing chapter with user's choice
 * @param {object} params - { story_id, chapter_id, scene_number, choice_id?, free_input?, combat_decisions? }
 * @param {object} handlers - { onStatus, onSceneProse, onScene, onMetadata, onIdentity, onDone, onError }
 * @returns {EventSource}
 */
export function streamSceneNext(params, handlers) {
    const qs = new URLSearchParams({
        story_id: params.story_id,
        chapter_id: params.chapter_id,
        scene_number: String(params.scene_number),
    });
    if (params.choice_id) qs.set('choice_id', params.choice_id);
    if (params.free_input) qs.set('free_input', params.free_input);
    if (params.combat_decisions) {
        qs.set('combat_decisions', JSON.stringify(params.combat_decisions));
    }

    return _connectSSE(`${BASE}/story/stream/scene-next?${qs}`, handlers, true);
}

// ── Scene REST ──

export async function getChapterScenes(storyId, chapterId) {
    return request('GET', `/story/${storyId}/scenes/${chapterId}`);
}

export async function getAllStoryScenes(storyId) {
    return request('GET', `/story/${storyId}/all-scenes`);
}

function _connectSSE(url, handlers, sceneMode = false) {
    // EventSource can't set headers — pass JWT via query param when available
    const token = localStorage.getItem('amo_auth_token');
    const sseUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;
    const source = new EventSource(sseUrl);

    source.addEventListener('status', (e) => {
        const data = JSON.parse(e.data);
        handlers.onStatus?.(data);
    });

    source.addEventListener('prose', (e) => {
        const data = JSON.parse(e.data);
        handlers.onProse?.(data);
    });

    source.addEventListener('choices', (e) => {
        const data = JSON.parse(e.data);
        handlers.onChoices?.(data);
    });

    // Scene-specific events
    if (sceneMode) {
        source.addEventListener('scene_prose', (e) => {
            const data = JSON.parse(e.data);
            handlers.onSceneProse?.(data);
        });

        source.addEventListener('scene', (e) => {
            console.log('[SSE] scene event raw:', e.data?.substring(0, 100));
            const data = JSON.parse(e.data);
            console.log('[SSE] scene parsed:', data.scene_number, '/', data.total_scenes);
            handlers.onScene?.(data);
        });
    }

    source.addEventListener('metadata', (e) => {
        const data = JSON.parse(e.data);
        handlers.onMetadata?.(data);
    });

    source.addEventListener('identity', (e) => {
        const data = JSON.parse(e.data);
        handlers.onIdentity?.(data);
    });

    source.addEventListener('crng', (e) => {
        const data = JSON.parse(e.data);
        handlers.onCrng?.(data);
    });

    source.addEventListener('done', (e) => {
        console.log('[SSE] done event received, sceneBuffer length:', 'see state');
        source.close();
        handlers.onDone?.(JSON.parse(e.data));
    });

    source.addEventListener('error', (e) => {
        console.log('[SSE] server error event:', e.data);
        if (e.data) {
            handlers.onError?.(JSON.parse(e.data));
        }
        source.close();
    });

    source.onerror = () => {
        // EventSource fires onerror on any connection issue.
        // Don't kill immediately — give the browser a chance to reconnect.
        // EventSource readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED
        if (source.readyState === 2) {
            // Fully closed — no auto-reconnect possible
            handlers.onDone?.({ partial: true });
            handlers.onError?.({ message: 'Connection lost' });
        }
        // If readyState is 0 (CONNECTING), the browser is auto-reconnecting.
        // Let it try. The server-side heartbeats will keep the connection alive.
    };

    return source;
}

// ── Soul Forge ──

export async function soulForgeStart(userId, gender = 'neutral') {
    return request('POST', '/soul-forge/start', { user_id: userId, gender });
}

export async function soulForgeChoice(sessionId, choiceIndex, responseTimeMs = 0, hoverCount = 0) {
    return request('POST', '/soul-forge/choice', {
        session_id: sessionId,
        choice_index: choiceIndex,
        response_time_ms: responseTimeMs,
        hover_count: hoverCount,
    }, 30000);
}

export async function soulForgeAdvance(sessionId) {
    return request('POST', '/soul-forge/advance', { session_id: sessionId }, 30000);
}

export async function soulForgeFragment(sessionId, text, typingTimeMs = 0, revisionCount = 0, backstory = '') {
    return request('POST', '/soul-forge/fragment', {
        session_id: sessionId,
        text,
        backstory,
        typing_time_ms: typingTimeMs,
        revision_count: revisionCount,
    });
}

export async function soulForgeForge(sessionId, name = '') {
    return request('POST', '/soul-forge/forge', {
        session_id: sessionId,
        name,
    }, 180000); // 3 min — gemini-2.5-pro writer+critic pipeline can take 90s+
}

