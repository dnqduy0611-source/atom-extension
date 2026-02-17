// background.js - V3 ADAPTER

import './config/build_flags.js';
import './utils/console_guard.js';
import { SignalExtractor, DecisionEngine } from './core_logic.js';
import { StrategyLayer } from './strategy_layer.js';
import { SelectionLogic } from './selection_logic.js';
import { InterventionManager } from './intervention_manager.js';
import { AIService } from './ai_service.js';
import { AIPilotService } from './ai_pilot_service.js';
import { initI18n, getMessage as atomGetMessage, getActiveLocale } from './i18n_bridge.js';
import { getEffectiveLanguage } from './utils/i18n_utils.js';
import { prepareNlmExportFromNote, buildReadingBundle, loadNlmSettings } from './bridge/bridge_service.js';
import { loadExportQueue, markDedupeHit, dequeueJob, updateJob, createExportJob, enqueueExportJob, buildDedupeKey, isDedupeHit } from './bridge/export_queue.js';
import { formatAtomClip } from './bridge/clip_format.js';
import { resolveNotebookUrl } from './bridge/notebooklm_connector.js';
import { NLM_RETRY_DELAYS_MS } from './bridge/types.js';
import { evaluateIdeaIncubator, loadIdeaSuggestions, recordIdeaDismiss, updateIdeaSuggestionStatus } from './bridge/idea_incubator.js';
import { setPendingTopic } from './bridge/topic_registry.js';
import { addPendingJob, buildPendingJob, isJobExpired, takePendingJob } from './bridge/pending_jobs.js';
import { registerAlarms, handleAlarm } from './brain/scheduler.js';
import { runKGDecay, runDigestDecay } from './pipelines/memory_maintenance.js';
import { handleTopicRouterMessage, handleTopicRoute, handleTopicAction, handleGetRegistry } from './bridge/topic_router_handlers.js';
import { AI_CONFIG, syncConfigToStorage, getModel } from './config/ai_config.js';
import { ReadingSessionService } from './storage/reading_session.module.js';
import { RateLimitManager, parseRetryAfterSeconds } from './services/rate_limit_manager.module.js';
import { initQuota, checkQuota, incrementQuota, resetDailyQuota, getQuotaDisplayStatus } from './services/quota_service.js';
import { checkForGitHubUpdate, isSideloaded, getUpdateStatus, dismissUpdate } from './services/github_update_checker.js';
import { isProxyAvailable, callGeminiProxy, callEmbeddingProxy } from './services/proxy_service.js';
import { buildContext } from './brain/context_builder.js';

// Smart Research Queue (SRQ)
import { addCard, getCardStats, getCardsByTopicKey, updateCard, updateCardStatus, dismissCard, getPendingCards, cleanupStaleCards, loadCards, upsertCard, findCardByIdempotencyKey, getWeeklyStats, bulkUpdateReviewedAt } from './storage/srq_store.js';
import { createResearchCard, buildIdempotencyKey, enrichCardAsync } from './services/srq_enricher.js';
import { getBatchesForExport } from './services/srq_grouper.js';
import { captureVisualAnchor, cleanupAnchors } from './services/srq_visual_anchor.js';
import { SRQ_ERROR_CODES } from './bridge/types.js';

// Lofi Sync (AmoLofi Web → Extension bridge)
import { initLofiSync, disconnectLofiSync, tryAutoInitLofiSync, isLofiSyncActive } from './services/lofi_sync.js';

const BUILD_FLAGS = globalThis.ATOM_BUILD_FLAGS || { DEBUG: false };
const DEBUG_BUILD_ENABLED = !!BUILD_FLAGS.DEBUG;
console.log('[ATOM] Topic Router imported, type:', typeof handleTopicRouterMessage);

// Sync AI config to storage for sidepanel.js access
syncConfigToStorage().catch(err => console.error('[ATOM] Failed to sync AI config:', err));

// Auto-init Lofi Sync if user is authenticated
tryAutoInitLofiSync().catch(err => console.warn('[ATOM] Lofi sync auto-init skipped:', err));

// Global test functions for debugging
if (DEBUG_BUILD_ENABLED) {
    globalThis.testTopicRouter = async function (payload = {}) {
        const defaultPayload = {
            title: "Test Article",
            domain: "test.com",
            tags: ["test"]
        };
        const result = await handleTopicRoute({ payload: { ...defaultPayload, ...payload } });
        console.log('[ATOM] Topic Router Test Result:', result);
        return result;
    };

    globalThis.testSaveMapping = async function (data) {
        const result = await handleTopicAction({
            action: "save",
            data: data || {
                topicKey: "test_topic",
                displayTitle: "Test Topic",
                keywords: ["test"],
                notebookRef: "test-notebook",
                notebookUrl: "https://notebooklm.google.com/notebook/test"
            }
        });
        console.log('[ATOM] Save Mapping Result:', result);
        return result;
    };

    globalThis.testGetRegistry = async function () {
        const result = await handleGetRegistry();
        console.log('[ATOM] Registry:', result);
        return result;
    };
}

const i18nReady = initI18n();
const atomMsg = (key, substitutions, fallback) => atomGetMessage(key, substitutions, fallback);
const isVietnamese = () => getActiveLocale().startsWith("vi");
const rateManager = new RateLimitManager({ rpmTotal: 15, rpmBackground: 8, cacheTtlMs: 5 * 60 * 1000 });
const getLanguageName = () => (isVietnamese() ? "Vietnamese" : "English");

// ===========================
// ATOM Debug Hub (MV3)
// ===========================
const ATOM_DEBUG_STORAGE_KEY = "atom_debug_events";
const ATOM_DEBUG_BYTAB_KEY = "atom_debug_events_by_tab";
const ATOM_DEBUG = {
    enabled: false,
    maxEvents: 50,
    events: [],
    byTab: new Map(),
    subscribers: new Set()
};
let debugPersistTimer = null;
let debugLoadPromise = null;

function normalizeDebug01(value) {
    if (typeof value !== "number" || value < 0 || value > 1) return null;
    return value;
}

function scheduleDebugPersist() {
    if (!ATOM_DEBUG.enabled) return;
    if (debugPersistTimer) clearTimeout(debugPersistTimer);
    debugPersistTimer = setTimeout(async () => {
        try {
            const byTab = {};
            for (const [tabId, list] of ATOM_DEBUG.byTab.entries()) {
                byTab[String(tabId)] = Array.isArray(list) ? list.slice(-ATOM_DEBUG.maxEvents) : [];
            }
            await chrome.storage.local.set({
                [ATOM_DEBUG_STORAGE_KEY]: ATOM_DEBUG.events.slice(-ATOM_DEBUG.maxEvents),
                [ATOM_DEBUG_BYTAB_KEY]: byTab
            });
        } catch (e) {
            // ignore storage errors in debug-only path
        }
    }, 300);
}

async function loadDebugStateFromStorage() {
    if (debugLoadPromise) return debugLoadPromise;
    debugLoadPromise = (async () => {
        try {
            const data = await chrome.storage.local.get([
                ATOM_DEBUG_STORAGE_KEY,
                ATOM_DEBUG_BYTAB_KEY
            ]);
            const events = Array.isArray(data[ATOM_DEBUG_STORAGE_KEY]) ? data[ATOM_DEBUG_STORAGE_KEY] : [];
            ATOM_DEBUG.events = events.slice(-ATOM_DEBUG.maxEvents);
            ATOM_DEBUG.byTab = new Map();
            const byTabRaw = data[ATOM_DEBUG_BYTAB_KEY];
            if (byTabRaw && typeof byTabRaw === "object") {
                for (const [tabId, list] of Object.entries(byTabRaw)) {
                    const parsedId = Number(tabId);
                    if (!Number.isFinite(parsedId)) continue;
                    ATOM_DEBUG.byTab.set(parsedId, Array.isArray(list) ? list.slice(-ATOM_DEBUG.maxEvents) : []);
                }
            }
        } catch (e) {
            ATOM_DEBUG.events = [];
            ATOM_DEBUG.byTab = new Map();
        }
    })();
    return debugLoadPromise;
}

function atomDebugPush(evt) {
    if (!ATOM_DEBUG.enabled) return;

    const event = {
        ...evt,
        ts: evt?.ts || Date.now()
    };

    if ("confidence" in event) {
        const normalized = normalizeDebug01(event.confidence);
        if (normalized === null) delete event.confidence;
        else event.confidence = normalized;
    }

    if ("minConfidence" in event) {
        const normalized = normalizeDebug01(event.minConfidence);
        if (normalized === null) delete event.minConfidence;
        else event.minConfidence = normalized;
    }

    ATOM_DEBUG.events.push(event);
    if (ATOM_DEBUG.events.length > ATOM_DEBUG.maxEvents) {
        ATOM_DEBUG.events.shift();
    }

    if (typeof event.tabId === "number") {
        const arr = ATOM_DEBUG.byTab.get(event.tabId) || [];
        arr.push(event);
        if (arr.length > ATOM_DEBUG.maxEvents) arr.shift();
        ATOM_DEBUG.byTab.set(event.tabId, arr);
    }

    for (const port of ATOM_DEBUG.subscribers) {
        try {
            port.postMessage({ type: "ATOM_DEBUG_EVENT", payload: event });
        } catch (_) { }
    }

    scheduleDebugPersist();
}

chrome.runtime.onConnect.addListener((port) => {
    if (!DEBUG_BUILD_ENABLED) return;
    if (port.name !== "ATOM_DEBUG_PORT") return;
    ATOM_DEBUG.subscribers.add(port);
    port.onDisconnect.addListener(() => ATOM_DEBUG.subscribers.delete(port));
    try {
        port.postMessage({ type: "ATOM_DEBUG_SNAPSHOT", payload: { events: ATOM_DEBUG.events } });
    } catch (_) { }
});

// Debug mode flag - loaded from storage, can be toggled in Settings
let DEBUG_PIPELINE = false;
if (DEBUG_BUILD_ENABLED) {
    chrome.storage.local.get(['debug_mode'], (res) => {
        DEBUG_PIPELINE = !!res.debug_mode;
        ATOM_DEBUG.enabled = !!res.debug_mode;
        if (ATOM_DEBUG.enabled) {
            loadDebugStateFromStorage().catch(() => { });
        }
    });
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.debug_mode) {
            DEBUG_PIPELINE = !!changes.debug_mode.newValue;
            ATOM_DEBUG.enabled = !!changes.debug_mode.newValue;
            if (ATOM_DEBUG.enabled) {
                loadDebugStateFromStorage().catch(() => { });
            }
            console.log("ATOM: Debug Mode changed to", DEBUG_PIPELINE);
        }
    });
}
chrome.storage.onChanged.addListener((changes) => {
    if (changes.atom_ui_language) {
        interventionManager = null;
        rebuildContextMenus().catch(() => { });
        broadcastI18nUpdate().catch(() => { });
    }
    if (changes.ai_pilot_enabled || changes.ai_pilot_accuracy_level || changes.ai_max_viewport_chars || changes.ai_max_selected_chars ||
        changes.atom_ai_pilot_enabled || changes.atom_ai_pilot_accuracy_level || changes.atom_ai_max_viewport_chars || changes.atom_ai_max_selected_chars) {
        loadAndBroadcastAiPilotConfig().catch(() => { });
    }
});

// --- KHỞI TẠO BIẾN TOÀN CỤC ---
// Biến này nằm trên RAM để truy xuất cực nhanh trong handleTick
let snoozeUntil = 0;
let sessionState = {
    interventionCount: 0,
    lastInterventionTime: 0,
    lastInterventionType: null
};

const OFFLINE_QUOTE_KEYS = [
    "offline_quote_1", "offline_quote_2", "offline_quote_3", "offline_quote_4", "offline_quote_5"
];
const THRESHOLDS_MAP = {
    gentle: { SCROLL_THRESHOLD_SEC: 300, PRESENCE_THRESHOLD_SEC: 150, INTERVENTION_CAP: 2, RESISTANCE_THRESHOLD: 5 },
    balanced: { SCROLL_THRESHOLD_SEC: 180, PRESENCE_THRESHOLD_SEC: 90, INTERVENTION_CAP: 2, RESISTANCE_THRESHOLD: 4 },
    // [FIX POINT 3] Giữ Cap = 2 cho Strict để tránh spam khi hệ thống log chưa hoàn hảo
    strict: { SCROLL_THRESHOLD_SEC: 60, PRESENCE_THRESHOLD_SEC: 30, INTERVENTION_CAP: 2, RESISTANCE_THRESHOLD: 3 }
};
let cachedSensitivity = 'balanced';
// 1. Khởi tạo Cache khi Extension vừa bật
chrome.storage.local.get(['user_sensitivity'], (res) => {
    // [FIX POINT 2] Fallback ngay từ khâu load
    cachedSensitivity = res.user_sensitivity || 'balanced';
    // console.log("ATOM: Initial Sensitivity:", cachedSensitivity);
});

// 2. Lắng nghe thay đổi để update Cache ngay lập tức (Sync)
chrome.storage.onChanged.addListener((changes) => {
    if (changes.user_sensitivity) {
        cachedSensitivity = changes.user_sensitivity.newValue || 'balanced';
        console.log("ATOM: Sensitivity updated to", cachedSensitivity);
    }
});
const DEFAULT_WHITELIST = [
    // --- Collaboration & Work ---
    "notion.so",
    "figma.com",
    "linear.app",
    "trello.com",
    "slack.com",
    "docs.google.com",
    "drive.google.com",

    // --- Knowledge & Dev ---
    "github.com",
    "stackoverflow.com",
    "chatgpt.com",
    "claude.ai",
    "localhost",

    // --- Education ---
    "coursera.org",
    "udemy.com",
    "duolingo.com",
    "wikipedia.org",
    "canvas.instructure.com"
];
// ===== ATOM FOCUS POMODORO (v1) =====
const FOCUS_CONFIG_KEY = "atom_focus_config";
const FOCUS_STATE_KEY = "atom_focus_state";
const FOCUS_ALARM_NAME = "ATOM_FOCUS_PHASE_END";

const DEFAULT_FOCUS_CONFIG = {
    workMin: 25,
    breakMin: 5,
    allowSec: 60,
    allowMaxPerWork: 2,
    breakPolicy: "FREE",
    escalation: {
        microAt: 2,
        hardAt: 3,
        hardModeCycle: ["BREATH", "TAP", "STILLNESS"]
    },
    attemptCooldownMs: 8000
};

function normalizeDomainFromUrl(url) {
    try {
        const h = new URL(url).hostname.toLowerCase();
        return h.replace(/^www\./, "");
    } catch {
        return "";
    }
}

async function loadFocusConfig() {
    const data = await chrome.storage.local.get([FOCUS_CONFIG_KEY]);
    const cfg = data[FOCUS_CONFIG_KEY];
    if (!cfg) {
        await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: DEFAULT_FOCUS_CONFIG });
        return { ...DEFAULT_FOCUS_CONFIG };
    }
    return {
        ...DEFAULT_FOCUS_CONFIG,
        ...cfg,
        escalation: { ...DEFAULT_FOCUS_CONFIG.escalation, ...(cfg.escalation || {}) }
    };
}

async function loadFocusState() {
    const data = await chrome.storage.local.get([FOCUS_STATE_KEY]);
    return data[FOCUS_STATE_KEY] || null;
}

async function saveFocusState(state) {
    await chrome.storage.local.set({ [FOCUS_STATE_KEY]: state });
}

function resetWorkCounters(state) {
    state.attempts = {};
    state.lastAttemptAt = {};
    state.allowUntil = {};
    state.allowUsedCount = 0;
}

function scheduleFocusAlarm(whenMs) {
    chrome.alarms.create(FOCUS_ALARM_NAME, { when: whenMs });
}

async function broadcastFocusState(state) {
    // 1. Broadcast to extension pages (sidepanel, popup, options etc.)
    try {
        chrome.runtime.sendMessage({
            type: "ATOM_FOCUS_STATE_UPDATED",
            payload: { atom_focus_state: state }
        }, () => {
            // Ignore "no receiver" errors - they happen when no extension page is open
            if (chrome.runtime.lastError) {
                // Expected when sidepanel is closed
            }
        });
    } catch {
        // ignore
    }

    // 2. Broadcast to content scripts in all tabs
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
        tabs.map(async (t) => {
            if (!t.id || !t.url) return;
            const u = t.url;
            if (u.startsWith("chrome://") || u.startsWith("edge://") || u.startsWith("about:") || u.startsWith("chrome-extension://")) return;
            try {
                chrome.tabs.sendMessage(t.id, { type: "ATOM_FOCUS_STATE_UPDATED", payload: { atom_focus_state: state } }, () => {
                    if (chrome.runtime.lastError) {
                        // ignore
                    }
                });
            } catch {
                // ignore
            }
        })
    );
}

function pickHardMode(config, attempt) {
    const { hardAt, hardModeCycle } = config.escalation;
    const cycle = Array.isArray(hardModeCycle) && hardModeCycle.length ? hardModeCycle : ["BREATH", "TAP", "STILLNESS"];
    const idx = ((attempt - hardAt) % cycle.length + cycle.length) % cycle.length;
    return cycle[idx];
}

const READING_COOLDOWN_KEY = "atom_reading_cooldown_until";
const READING_COOLDOWN_STRIKES_KEY = "atom_reading_cooldown_strikes";
const READING_COOLDOWN_MS = 60 * 1000;
const READING_COOLDOWN_MAX_MS = 15 * 60 * 1000;
const READING_COOLDOWN_MAX_STRIKES = 4;
let readingCooldownUntil = 0;
let readingCooldownStrikes = 0;
chrome.storage.local.get([READING_COOLDOWN_KEY], (result) => {
    if (result[READING_COOLDOWN_KEY]) {
        readingCooldownUntil = result[READING_COOLDOWN_KEY];
    }
});
chrome.storage.local.get([READING_COOLDOWN_STRIKES_KEY], (result) => {
    if (typeof result[READING_COOLDOWN_STRIKES_KEY] === "number") {
        readingCooldownStrikes = result[READING_COOLDOWN_STRIKES_KEY];
    }
});

async function getReadingCooldownUntil() {
    if (readingCooldownUntil && Date.now() < readingCooldownUntil) {
        return readingCooldownUntil;
    }
    const data = await chrome.storage.local.get([
        READING_COOLDOWN_KEY,
        READING_COOLDOWN_STRIKES_KEY
    ]);
    readingCooldownUntil = data[READING_COOLDOWN_KEY] || 0;
    if (typeof data[READING_COOLDOWN_STRIKES_KEY] === "number") {
        readingCooldownStrikes = data[READING_COOLDOWN_STRIKES_KEY];
    }
    return readingCooldownUntil;
}

function startReadingCooldown(ms) {
    const until = Date.now() + ms;
    readingCooldownUntil = until;
    chrome.storage.local.set({ [READING_COOLDOWN_KEY]: until });
    return until;
}

function startReadingCooldownWithBackoff(baseMs) {
    readingCooldownStrikes = Math.min(
        readingCooldownStrikes + 1,
        READING_COOLDOWN_MAX_STRIKES
    );
    const backoffMs = Math.min(
        baseMs * Math.pow(2, readingCooldownStrikes),
        READING_COOLDOWN_MAX_MS
    );
    chrome.storage.local.set({
        [READING_COOLDOWN_STRIKES_KEY]: readingCooldownStrikes
    });
    return startReadingCooldown(backoffMs);
}

function resetReadingCooldownBackoff() {
    if (readingCooldownStrikes === 0) return;
    readingCooldownStrikes = 0;
    chrome.storage.local.set({ [READING_COOLDOWN_STRIKES_KEY]: 0 });
}

function formatCooldownMessage(remainingMs) {
    const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
    const msg = atomMsg("reading_cooldown_summary", [String(seconds)]);
    return msg || `Rate limit hit. Active Reading pauses for ${seconds} seconds.`;
}

async function rebuildContextMenus() {
    await i18nReady;
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "atom-whitelist-domain",
            title: atomMsg("ctx_whitelist_domain") || "AmoNexus: Always ignore this site (Safe Zone)",
            contexts: ["page"]
        });
        // [DISABLED] Active Reading floating panel removed — context menus disabled
        // chrome.contextMenus.create({
        //     id: "atom-reading-parent",
        //     title: atomMsg("ctx_reading_parent") || "AmoNexus: Active Reading",
        //     contexts: ["selection"]
        // });
        // chrome.contextMenus.create({
        //     id: "atom-reading-summarize",
        //     parentId: "atom-reading-parent",
        //     title: atomMsg("ctx_reading_summarize") || "Summarize this selection (2 sentences)",
        //     contexts: ["selection"]
        // });
        // chrome.contextMenus.create({
        //     id: "atom-reading-critique",
        //     parentId: "atom-reading-parent",
        //     title: atomMsg("ctx_reading_critique") || "Critique / weak points",
        //     contexts: ["selection"]
        // });
        // chrome.contextMenus.create({
        //     id: "atom-reading-quiz",
        //     parentId: "atom-reading-parent",
        //     title: atomMsg("ctx_reading_quiz") || "Create 3 recall questions",
        //     contexts: ["selection"]
        // });
        // Side Panel - Chat with Page
        chrome.contextMenus.create({
            id: "atom-chat-with-page",
            title: atomMsg("ctx_chat_with_page") || "AmoNexus: Chat with this page",
            contexts: ["page"]
        });
    });
}

// --- 2. CONTEXT MENU HANDLER ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "atom-chat-with-page") {
        // Open Side Panel
        if (tab && tab.id) {
            chrome.sidePanel.open({ tabId: tab.id });
        }
        return;
    }

    // Logic cho các menu khác (nếu logic xử lý chưa có trong content script thì thêm ở đây)
    // Hiện tại các menu Active Reading (reading-summarize, etc.) chủ yếu được xử lý bởi Content Script 
    // thông qua lắng nghe message hoặc logic nội bộ. 
    // Tuy nhiên, MV3 Context Menu chuẩn thường bắn event về background.
    // Nếu Content Script của bạn đã tự listen 'contextmenu' event thì OK. 
    // Nếu dùng chrome.contextMenus API thì phải bắn message về tab.

    if (info.menuItemId.startsWith("atom-reading-")) {
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, {
                type: "ATOM_CONTEXT_MENU_ACTION",
                action: info.menuItemId,
                selectionText: info.selectionText
            });
        }
    }

    if (info.menuItemId === "atom-whitelist-domain") {
        // Logic whitelist domain
        if (tab && tab.url) {
            const domain = normalizeDomainFromUrl(tab.url);
            if (domain) {
                chrome.storage.local.get(['atom_whitelist'], (res) => {
                    const list = res.atom_whitelist || [];
                    if (!list.includes(domain)) {
                        const newList = [...list, domain];
                        chrome.storage.local.set({ atom_whitelist: newList }, () => {
                            console.log(`[ATOM] Added ${domain} to whitelist.`);
                            // Optionally reload tab
                        });
                    }
                });
            }
        }
    }
});

async function broadcastI18nUpdate() {
    const tabs = await chrome.tabs.query({});
    const sends = tabs.map((tab) => {
        if (!tab?.id) return null;
        return new Promise((resolve) => {
            try {
                chrome.tabs.sendMessage(tab.id, { type: "ATOM_I18N_UPDATE" }, () => {
                    if (chrome.runtime.lastError) {
                        // ignore error
                    }
                    resolve();
                });
            } catch {
                resolve();
            }
        });
    }).filter(Boolean);
    await Promise.allSettled(sends);
}

const aiService = new AIService();

// ============================================================
// Memory Auto-Categorization Queue (background, best-effort)
// ============================================================
const MEMORY_CATEGORIZE_QUEUE = [];
const MEMORY_CATEGORIZE_PENDING = new Set();
let memoryCategorizeRunning = false;

function sanitizeMemoryTags(tags, maxItems = 10) {
    if (!Array.isArray(tags)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of tags) {
        const t = String(raw || "").replace(/^#/, "").replace(/\s+/g, " ").trim();
        if (!t) continue;
        const normalized = t.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(t.slice(0, 32));
        if (out.length >= maxItems) break;
    }
    return out;
}

function enqueueMemoryCategorization(noteId) {
    if (!noteId) return;
    if (MEMORY_CATEGORIZE_PENDING.has(noteId)) return;
    MEMORY_CATEGORIZE_PENDING.add(noteId);
    MEMORY_CATEGORIZE_QUEUE.push(noteId);
    drainMemoryCategorizationQueue().catch(() => { });
}

async function drainMemoryCategorizationQueue() {
    if (memoryCategorizeRunning) return;
    memoryCategorizeRunning = true;
    try {
        while (MEMORY_CATEGORIZE_QUEUE.length > 0) {
            const noteId = MEMORY_CATEGORIZE_QUEUE.shift();
            MEMORY_CATEGORIZE_PENDING.delete(noteId);

            try {
                const note = await atomGetReadingNote(noteId);
                if (!note) continue;
                if (note.category && Array.isArray(note.tags) && note.tags.length > 0) continue;

                const hasText = !!(note.selection || note.title || note.atomicThought || note.refinedInsight || note.aiDiscussionSummary);
                if (!hasText) continue;

                const result = await aiService.categorizeMemoryNote(note);
                const category = String(result?.category || "").trim();
                const tags = sanitizeMemoryTags(result?.tags, 5);
                if (!category && tags.length === 0) continue;

                const existingTags = Array.isArray(note.tags) ? note.tags : [];
                const mergedTags = sanitizeMemoryTags([...existingTags, ...tags], 10);
                const patch = {
                    ...(category ? { category } : {}),
                    ...(mergedTags.length ? { tags: mergedTags } : {})
                };
                if (Object.keys(patch).length === 0) continue;

                await atomUpdateReadingNote(noteId, patch);
            } catch (e) {
                console.warn("[ATOM Memory] Categorization skipped:", e?.message || e);
            }
        }
    } finally {
        memoryCategorizeRunning = false;
    }
}
const aiPilotService = new AIPilotService(aiService);

async function broadcastAiPilotConfig(config) {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(
        tabs.map(async (t) => {
            if (!t.id || !t.url) return;
            const u = t.url;
            if (u.startsWith("chrome://") || u.startsWith("edge://") || u.startsWith("about:") || u.startsWith("chrome-extension://")) return;
            try {
                chrome.tabs.sendMessage(
                    t.id,
                    { type: "ATOM_AI_PILOT_CONFIG", payload: config },
                    () => {
                        if (chrome.runtime.lastError) {
                            // ignore
                        }
                    }
                );
            } catch {
                // ignore
            }
        })
    );
}

async function migrateAiPilotSettings() {
    const data = await chrome.storage.local.get([
        'ai_pilot_enabled',
        'ai_pilot_mode',
        'ai_pilot_accuracy_level',
        'ai_min_confidence',
        'ai_timeout_ms',
        'ai_budget_per_day',
        'ai_cache_ttl_ms',
        'ai_max_viewport_chars',
        'ai_max_selected_chars',
        'ai_provider',
        'ai_proxy_url',
        'atom_ai_pilot_enabled',
        'atom_ai_pilot_mode',
        'atom_ai_pilot_accuracy_level',
        'atom_ai_confidence_threshold_primary',
        'atom_ai_timeout_ms',
        'atom_ai_budget_daily_cap',
        'atom_ai_cache_ttl_ms',
        'atom_ai_max_viewport_chars',
        'atom_ai_max_selected_chars',
        'atom_ai_provider',
        'atom_ai_proxy_url'
    ]);

    const updates = {};
    if (data.atom_ai_pilot_enabled === undefined && data.ai_pilot_enabled !== undefined) updates.atom_ai_pilot_enabled = data.ai_pilot_enabled;
    if (!data.atom_ai_pilot_mode && data.ai_pilot_mode) updates.atom_ai_pilot_mode = data.ai_pilot_mode;
    if (!data.atom_ai_pilot_accuracy_level && data.ai_pilot_accuracy_level) updates.atom_ai_pilot_accuracy_level = data.ai_pilot_accuracy_level;
    if (data.atom_ai_confidence_threshold_primary === undefined && data.ai_min_confidence !== undefined) {
        updates.atom_ai_confidence_threshold_primary = data.ai_min_confidence;
    }
    if (data.atom_ai_timeout_ms === undefined && data.ai_timeout_ms !== undefined) updates.atom_ai_timeout_ms = data.ai_timeout_ms;
    if (data.atom_ai_budget_daily_cap === undefined && data.ai_budget_per_day !== undefined) updates.atom_ai_budget_daily_cap = data.ai_budget_per_day;
    if (data.atom_ai_cache_ttl_ms === undefined && data.ai_cache_ttl_ms !== undefined) updates.atom_ai_cache_ttl_ms = data.ai_cache_ttl_ms;
    if (data.atom_ai_max_viewport_chars === undefined && data.ai_max_viewport_chars !== undefined) updates.atom_ai_max_viewport_chars = data.ai_max_viewport_chars;
    if (data.atom_ai_max_selected_chars === undefined && data.ai_max_selected_chars !== undefined) updates.atom_ai_max_selected_chars = data.ai_max_selected_chars;
    if (!data.atom_ai_provider && data.ai_provider) updates.atom_ai_provider = data.ai_provider;
    if (!data.atom_ai_proxy_url && data.ai_proxy_url) updates.atom_ai_proxy_url = data.ai_proxy_url;

    if (Object.keys(updates).length) {
        await chrome.storage.local.set(updates);
    }
}

async function loadAndBroadcastAiPilotConfig() {
    const data = await chrome.storage.local.get([
        'ai_pilot_enabled',
        'ai_pilot_accuracy_level',
        'ai_max_viewport_chars',
        'ai_max_selected_chars',
        'atom_ai_pilot_enabled',
        'atom_ai_pilot_accuracy_level',
        'atom_ai_max_viewport_chars',
        'atom_ai_max_selected_chars'
    ]);
    const payload = {
        enabled: data.atom_ai_pilot_enabled ?? data.ai_pilot_enabled ?? false,
        accuracyLevel: data.atom_ai_pilot_accuracy_level || data.ai_pilot_accuracy_level || "balanced",
        maxViewportChars: data.atom_ai_max_viewport_chars || data.ai_max_viewport_chars || 1200,
        maxSelectedChars: data.atom_ai_max_selected_chars || data.ai_max_selected_chars || 400
    };
    await broadcastAiPilotConfig(payload);
}
// --- 1. SETUP KHI CÀI ĐẶT (CONTEXT MENU) ---
// --- 1. SETUP KHI CÀI ĐẶT & UPDATE (AUTO-MIGRATION) ---
chrome.runtime.onInstalled.addListener(async (details) => {
    const currentVersion = chrome.runtime.getManifest().version;
    console.log(`ATOM: Installed/Updated (Reason: ${details.reason}, Prev: ${details.previousVersion}, Curr: ${currentVersion})`);

    // 1. Lấy dữ liệu hiện tại
    const { atom_whitelist, adaptive_multiplier, atom_reactions } = await chrome.storage.local.get([
        'atom_whitelist',
        'adaptive_multiplier',
        'atom_reactions'
    ]);

    // 2. SETUP MẶC ĐỊNH (Cho người cài mới hoàn toàn)
    if (!atom_whitelist) {
        await chrome.storage.local.set({ atom_whitelist: DEFAULT_WHITELIST });
    }

    // 3. DI TRÚ DỮ LIỆU (Chỉ chạy khi Update phiên bản)
    if (details.reason === "update") {
        console.log("ATOM: Checking migration needs...");

        // A. Nâng cấp cấu trúc atom_reactions (V2 -> V3)
        // Đảm bảo mọi log đều có trường 'mode' và 'event' để AI không bị lỗi
        if (atom_reactions && atom_reactions.length > 0) {
            let needsUpdate = false;
            const migratedReactions = atom_reactions.map(r => {
                let rNew = { ...r };

                // Fix lỗi thiếu mode (bản rất cũ) -> Gán mặc định
                if (!rNew.mode) {
                    rNew.mode = "UNKNOWN";
                    needsUpdate = true;
                }

                // Fix lỗi thiếu event (bản cũ dùng key 'action') -> Map sang 'event'
                if (!rNew.event && rNew.action) {
                    rNew.event = rNew.action;
                    needsUpdate = true;
                }
                return rNew;
            });

            if (needsUpdate) {
                await chrome.storage.local.set({ atom_reactions: migratedReactions });
                console.log("✅ ATOM: Migrated reactions to V3 format.");
            }
        }

        // B. Khởi tạo biến mới cho tính năng AI (Adaptive Multiplier)
        // Nếu user cũ chưa có, cho họ khởi đầu ở mức "dễ thở" (1.0)
        if (!adaptive_multiplier) {
            await chrome.storage.local.set({ adaptive_multiplier: 1.0 });
            console.log("✅ ATOM: Initialized adaptive_multiplier for AI.");
        }

        // C. Migrate Reading Threads/Cards to unified ReadingSessions (v2.7)
        try {
            const migrationResult = await ReadingSessionService.migrateOldData();
            if (migrationResult.migrated) {
                console.log(`✅ ATOM: Migrated ${migrationResult.sessions} reading sessions.`);
            }
        } catch (e) {
            console.error("ATOM: ReadingSession migration error:", e);
        }
    }

    // 4. Tái khởi tạo Context Menu (Xóa đi tạo lại để tránh lỗi duplicate)
    await rebuildContextMenus();

    // 5. Kiểm tra cập nhật từ Store (chỉ chạy khi cài đặt hoặc update)
    checkForStoreUpdate();

    // 6. Migrate + Broadcast AI Pilot config
    await migrateAiPilotSettings();
    loadAndBroadcastAiPilotConfig().catch(() => { });

    // 7. Setup Side Panel
    try {
        await chrome.sidePanel.setOptions({
            enabled: true
        });
        // Keep popup as default - user clicks icon → popup → "Chat with Page" → sidepanel
        // Explicitly disable openPanelOnActionClick to ensure popup works
        await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: false
        });
        console.log("ATOM: Side Panel enabled, popup preserved.");
    } catch (e) {
        console.warn("ATOM: Side Panel setup skipped:", e.message);
    }

    // 8. Initialize Quota & Trial tracking (Phase 1 Monetization)
    initQuota().catch(e => console.warn('[ATOM] Quota init failed:', e));

    // 9. Check GitHub update for sideloaded builds
    checkForGitHubUpdate().catch(e => console.warn('[ATOM] GitHub update check failed:', e));

    // 10. What's New — auto-open on first install or version update
    try {
        const shouldShow =
            details.reason === 'install' ||
            (details.reason === 'update' && details.previousVersion !== currentVersion);

        if (shouldShow) {
            await chrome.storage.local.set({ atom_whats_new_unseen: true });
            const wnUrl = `https://www.amonexus.com/whats-new?v=${encodeURIComponent(currentVersion)}&reason=${details.reason}`;
            chrome.tabs.create({ url: wnUrl });
            console.log(`[ATOM] What's New page opened (${details.reason}, v${currentVersion})`);
        }
    } catch (e) {
        console.warn('[ATOM] What\'s New auto-open failed:', e);
    }
});

// =========================
// KEYBOARD SHORTCUT HANDLER
// =========================
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'open-sidepanel') {
        try {
            await chrome.storage.local.set({
                atom_open_sidepanel_on_popup: true,
                atom_open_sidepanel_on_popup_ts: Date.now()
            });

            if (chrome.action?.openPopup) {
                await chrome.action.openPopup();
                console.log('[ATOM] Popup opened via keyboard shortcut');
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                await chrome.sidePanel.open({ tabId: tab.id });
                console.log('[ATOM] Sidepanel opened via keyboard shortcut');
            }
        } catch (e) {
            console.error('[ATOM] Failed to open sidepanel via shortcut:', e);
        }
    }
});

// =========================
// AUTO UPDATE NOTIFICATION
// =========================
const UPDATE_CHECK_URL = "https://raw.githubusercontent.com/dnqduy0611-source/atom-extension/main/version.json";
const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 giờ

async function checkForStoreUpdate() {
    try {
        // Kiểm tra xem đã tắt thông báo chưa
        const { update_dismissed } = await chrome.storage.local.get(['update_dismissed']);
        if (update_dismissed) return;

        // Fetch version.json từ GitHub
        const response = await fetch(UPDATE_CHECK_URL, { cache: 'no-store' });
        if (!response.ok) return;

        const data = await response.json();

        // Nếu Store đã có bản chính thức
        if (data.store_available && data.store_url) {
            // Lưu thông tin để popup hiển thị
            await chrome.storage.local.set({
                store_update_available: true,
                store_url: data.store_url,
                store_message_vi: data.message_vi,
                store_message_en: data.message_en
            });

            // Hiển thị notification (nếu browser hỗ trợ)
            const useVi = isVietnamese();
            const message = useVi ? data.message_vi : data.message_en;

            chrome.notifications.create('atom-store-update', {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'AmoNexus - Update Available!',
                message: message,
                buttons: [
                    { title: useVi ? 'Mở Chrome Store' : 'Open Chrome Store' },
                    { title: useVi ? 'Để sau' : 'Later' }
                ],
                priority: 2
            });

            console.log("✅ ATOM: Store version available!", data.store_url);
        }
    } catch (error) {
        console.log("ATOM: Update check failed (this is normal if offline)", error.message);
    }
}

// Xử lý click notification
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === 'atom-store-update') {
        if (buttonIndex === 0) {
            // Mở Chrome Store
            chrome.storage.local.get(['store_url'], (result) => {
                if (result.store_url) {
                    chrome.tabs.create({ url: result.store_url });
                }
            });
        } else {
            // Tắt thông báo (không hiển thị lại)
            chrome.storage.local.set({ update_dismissed: true });
        }
        chrome.notifications.clear(notificationId);
    }
    if (notificationId.startsWith(NLM_NOTIFICATION_PREFIX)) {
        if (buttonIndex === 0) {
            const fallbackJobId = notificationId.replace(NLM_NOTIFICATION_PREFIX, "");
            const entry = nlmRetryNotificationIndex.get(notificationId) || {};
            sendNlmRetryPromptToActiveTab({
                jobId: entry.jobId || fallbackJobId,
                noteId: entry.noteId || ""
            });
        }
        chrome.notifications.clear(notificationId);
        nlmRetryNotificationIndex.delete(notificationId);
    }
});

// Handle notification click (not button, just the notification itself)
chrome.notifications.onClicked.addListener(async (notificationId) => {
    if (notificationId === 'atom-focus-phase-change') {
        chrome.notifications.clear(notificationId);
        // Open popup or sidepanel
        try {
            if (chrome.action?.openPopup) {
                await chrome.action.openPopup();
            } else {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.sidePanel.open({ tabId: tab.id });
                }
            }
        } catch (e) {
            console.warn("[ATOM] Failed to open popup/sidepanel from notification:", e.message);
        }
    }
});

// ═══ Silent Brain Phase 1: Consolidated Alarms (8 → 3) ═══
// Old alarms replaced: check-store-update, atom_srq_cleanup, atom_kg_decay_cycle,
//   atom_daily_quota_reset, atom_github_update, atom_srq_auto_export_retry
// Kept: ATOM_FOCUS_PHASE_END (dynamic), NLM_QUEUE_ALARM (dynamic)

registerAlarms();

// Retry failed auto-exports (extracted from inline alarm handler)
async function retryFailedExports() {
    try {
        const autoExport = await getSrqFlag('SRQ_AUTO_EXPORT');
        if (!autoExport) return;

        const allCards = await loadCards();
        const stuck = allCards.filter(c => c.status === 'approved' && !c.exportedJobId);
        if (stuck.length === 0) return;

        console.log(`[SRQ AutoFlow Retry] Found ${stuck.length} approved cards to retry`);
        let exported = 0;
        for (const card of stuck.slice(0, 5)) { // Max 5 per cycle
            try {
                const notebookRef = card.suggestedNotebook || 'Inbox';
                await handleSrqSingleExport(card.cardId, notebookRef);
                exported++;
            } catch (err) {
                console.warn(`[SRQ AutoFlow Retry] Card ${card.cardId} failed:`, err.message);
            }
        }
        if (exported > 0) {
            console.log(`[SRQ AutoFlow Retry] Exported ${exported} cards`);
            chrome.runtime.sendMessage({ type: 'SRQ_CARDS_UPDATED', reason: 'auto_retry_exported' }).catch(() => { });
        }
    } catch (err) {
        console.warn('[SRQ AutoFlow Retry] Failed:', err);
    }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
    // Consolidated alarms — brain/scheduler.js handles routing
    const handled = await handleAlarm(alarm.name, {
        checkForStoreUpdate,
        checkForGitHubUpdate,
        runKGDecay,
        runDigestDecay,
        cleanupStaleCards,
        loadNlmSettings,
        retryFailedExports,
        processNlmExportQueue,
        resetDailyQuota
    });
    if (handled) return;

    // Dynamic alarms (giữ nguyên — không gom)
    if (alarm.name === FOCUS_ALARM_NAME) {
        await focusHandlePhaseEnd();
        return;
    }
    if (alarm.name === NLM_QUEUE_ALARM) {
        await processNlmExportQueue("alarm");
        return;
    }
});

chrome.runtime.onStartup.addListener(() => {
    scheduleNlmQueueAlarm();
});

scheduleNlmQueueAlarm();

async function focusHandlePhaseEnd() {
    const cfg = await loadFocusConfig();
    const st = await loadFocusState();
    if (!st?.enabled) return;

    const now = Date.now();
    if (now < st.phaseEndsAt) {
        scheduleFocusAlarm(st.phaseEndsAt);
        return;
    }

    const prevPhase = st.phase;
    const nextPhase = prevPhase === "WORK" ? "BREAK" : "WORK";

    st.phase = nextPhase;
    st.phaseStartedAt = now;
    st.workMin = cfg.workMin;
    st.breakMin = cfg.breakMin;
    st.phaseEndsAt = now + (nextPhase === "WORK" ? cfg.workMin : cfg.breakMin) * 60 * 1000;
    resetWorkCounters(st);
    st.lastStateUpdatedAt = now;

    await saveFocusState(st);

    // [ATOM] System Notification for Phase Change
    const isBreakNow = nextPhase === "BREAK";
    const notifTitle = isBreakNow
        ? (atomMsg("focus_phase_work_end_title") || "🎯 Phiên tập trung hoàn thành!")
        : (atomMsg("focus_phase_break_end_title") || "☕ Hết giờ nghỉ!");
    const notifMsg = isBreakNow
        ? (atomMsg("focus_phase_work_end_msg") || "Mở AmoNexus để review những gì bạn vừa học.")
        : (atomMsg("focus_phase_break_end_msg") || "Sẵn sàng quay lại làm việc?");

    console.log("[ATOM] Phase Change detected. Triggering Notification:", notifTitle, notifMsg);

    // [ATOM] Store pending review for popup to pickup (WORK → BREAK only)
    if (isBreakNow) {
        try {
            const linkedData = await chrome.storage.local.get(['atom_focus_linked_session_v1']);
            const linked = linkedData.atom_focus_linked_session_v1;
            if (linked?.sessionId) {
                await chrome.storage.local.set({
                    atom_focus_pending_review: {
                        readingSessionId: linked.sessionId,
                        focusSessionId: st.sessionId,
                        triggeredAt: now,
                        title: linked.title || '',
                        url: linked.url || ''
                    }
                });
                console.log("[ATOM] Pending review stored for sessionId:", linked.sessionId);
            }
        } catch (e) {
            console.warn("[ATOM] Failed to store pending review:", e.message);
        }
    }

    chrome.notifications.create('atom-focus-phase-change', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: notifTitle,
        message: notifMsg,
        priority: 2,
        requireInteraction: isBreakNow  // Keep notification visible for WORK end
    }, (id) => {
        if (chrome.runtime.lastError) {
            console.error("[ATOM] Notification Error:", chrome.runtime.lastError.message);
        } else {
            console.log("[ATOM] Notification created with ID:", id);
        }
    });

    scheduleFocusAlarm(st.phaseEndsAt);
    await broadcastFocusState(st);
}

async function focusEnsureRecoveryOnStartup() {
    const st = await loadFocusState();
    if (!st?.enabled) return;

    const now = Date.now();
    if (now >= st.phaseEndsAt) {
        await focusHandlePhaseEnd();
        return;
    }
    scheduleFocusAlarm(st.phaseEndsAt);
    await broadcastFocusState(st);
}

focusEnsureRecoveryOnStartup().catch(() => { });
migrateAiPilotSettings().then(() => loadAndBroadcastAiPilotConfig()).catch(() => { });
// =========================
// DAILY ROLLUP (VN timezone)
// =========================
const ROLLUP_STORAGE_KEY = "atom_daily_rollups";
const ROLLUP_KEEP_DAYS = 120; // giữ 120 ngày, tuỳ bạn

function getLocalDayKeyVN(ts = Date.now()) {
    // YYYY-MM-DD theo Asia/Ho_Chi_Minh
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(ts));

    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    return `${y}-${m}-${d}`; // en-CA format
}

function ensureObj(obj, key, fallback) {
    if (!obj[key]) obj[key] = fallback;
    return obj[key];
}

function inc(obj, key, n = 1) {
    obj[key] = (obj[key] || 0) + n;
}

function pruneOldDays(rollups) {
    const keys = Object.keys(rollups).sort(); // YYYY-MM-DD sort OK
    if (keys.length <= ROLLUP_KEEP_DAYS) return rollups;
    const toDelete = keys.slice(0, keys.length - ROLLUP_KEEP_DAYS);
    for (const k of toDelete) delete rollups[k];
    return rollups;
}

async function updateDailyRollupFromEvent(log) {
    // log: {event, mode, shown_at?, duration_ms?, ...}
    const dayKey = getLocalDayKeyVN(log.timestamp || Date.now());

    const data = await chrome.storage.local.get([ROLLUP_STORAGE_KEY]);
    const rollups = data[ROLLUP_STORAGE_KEY] || {};

    const day = ensureObj(rollups, dayKey, {
        day: dayKey,
        shown: {},                // shown[mode]
        reaction: {},             // reaction[mode][action]
        duration_sum_ms: {},      // sum per mode
        duration_count: {},       // count per mode
        duration_avg_ms: {},      // computed
        last_updated: 0
    });

    const mode = (log.mode || "UNKNOWN").toUpperCase();
    const event = (log.event || "UNKNOWN").toUpperCase();

    if (event === "SHOWN") {
        inc(day.shown, mode, 1);
    } else {
        // treat anything else as REACTION-style action
        // e.g. COMPLETED/IGNORED/SNOOZED/DISMISSED/TRIGGERED...
        const perMode = ensureObj(day.reaction, mode, {});
        inc(perMode, event, 1);

        const dur = Number(log.duration_ms);
        if (Number.isFinite(dur) && dur >= 0) {
            inc(day.duration_sum_ms, mode, dur);
            inc(day.duration_count, mode, 1);
            day.duration_avg_ms[mode] = Math.round(day.duration_sum_ms[mode] / day.duration_count[mode]);
        }
    }

    day.last_updated = Date.now();

    pruneOldDays(rollups);
    await chrome.storage.local.set({ [ROLLUP_STORAGE_KEY]: rollups });
}
let rollupWriteQueue = Promise.resolve();
function enqueueRollupWrite(fn) {
    rollupWriteQueue = rollupWriteQueue.then(fn).catch(() => { });
    return rollupWriteQueue;
}

// --- HELPER: CHECK HOST MATCHING (AN TOÀN) ---
function hostMatches(host, domain) {
    // Match chính xác hoặc subdomain (vd: mail.google.com match google.com)
    return host === domain || host.endsWith("." + domain);
}

function extractHost(url) {
    if (!url) return "";
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return "";
    }
}

function buildSuggestedQuestion(note) {
    const title = (note?.title || "").trim();
    if (title) {
        return `What are the key takeaways from "${title}"?`;
    }
    return "What are the key takeaways from this note?";
}

function logNlmEvent(event, context = {}) {
    const now = Date.now();
    chrome.storage.local.get(['atom_events'], (r) => {
        const cur = r.atom_events || [];
        cur.push({
            timestamp: now,
            event,
            mode: "NLM_BRIDGE",
            context
        });
        chrome.storage.local.set({ atom_events: cur.slice(-2000) });
    });
}

const NLM_QUEUE_ALARM = "nlm_export_queue_tick";
const NLM_MAX_RETRY_ATTEMPTS = 3;
const NLM_NOTIFICATION_PREFIX = "nlm_retry_";
const nlmRetryNotificationIndex = new Map();

function getRetryDelayMs(attemptIndex) {
    if (!Array.isArray(NLM_RETRY_DELAYS_MS) || NLM_RETRY_DELAYS_MS.length === 0) {
        return 5000;
    }
    if (attemptIndex < 0) return NLM_RETRY_DELAYS_MS[0];
    if (attemptIndex >= NLM_RETRY_DELAYS_MS.length) {
        return NLM_RETRY_DELAYS_MS[NLM_RETRY_DELAYS_MS.length - 1];
    }
    return NLM_RETRY_DELAYS_MS[attemptIndex];
}

async function scheduleNlmQueueAlarm() {
    const queue = await loadExportQueue();
    const now = Date.now();
    const nextAt = queue
        .map((job) => job?.nextAttemptAt || null)
        .filter((ts) => Number.isFinite(ts) && ts > now)
        .sort((a, b) => a - b)[0];

    if (!nextAt) {
        await chrome.alarms.clear(NLM_QUEUE_ALARM);
        return;
    }

    chrome.alarms.create(NLM_QUEUE_ALARM, { when: nextAt });
}

async function notifyNlmRetry(job, note, reason = "retry_pending") {
    const title = note?.title ? `Retry export: ${note.title}` : "Retry NotebookLM export";
    const message = reason === "retry_exhausted"
        ? "Export needs your action. Click to retry."
        : "Export pending. Click to retry now.";
    const notificationId = `${NLM_NOTIFICATION_PREFIX}${job.jobId}`;

    chrome.notifications.create(notificationId, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title,
        message,
        buttons: [{ title: "Retry now" }]
    });
    nlmRetryNotificationIndex.set(notificationId, { jobId: job.jobId, noteId: job.bundleId });
}

async function updateNlmNoteStatus(noteId, patch) {
    if (!noteId) return null;
    const current = await atomGetReadingNote(noteId);
    const nextNlm = { ...(current?.nlm || {}), ...(patch?.nlm || {}) };
    return atomUpdateReadingNote(noteId, { nlm: nextNlm });
}

async function markNlmNeedsUserAction(job, reason) {
    const attempts = Number.isFinite(job?.attempts) ? job.attempts : 0;
    const nextAttempts = attempts + 1;
    if (nextAttempts >= NLM_MAX_RETRY_ATTEMPTS) {
        await finalizeNlmJobFailure({ ...job, attempts: nextAttempts }, reason);
        return;
    }
    const nextDelay = getRetryDelayMs(nextAttempts);
    const nextAttemptAt = Date.now() + nextDelay;

    await updateJob(job.jobId, {
        status: "needs_user_action",
        attempts: nextAttempts,
        lastError: reason,
        nextAttemptAt
    });

    await updateNlmNoteStatus(job.bundleId, {
        nlm: {
            exportStatus: "needs_user_action",
            lastError: reason,
            attempts: nextAttempts,
            updatedAt: Date.now()
        }
    });

    const note = await atomGetReadingNote(job.bundleId);
    await notifyNlmRetry(job, note, reason);
    logNlmEvent("nlm_bridge.export_failed", { source: "queue_worker", noteId: job.bundleId, reason });
}

async function finalizeNlmJobFailure(job, reason = "retry_exhausted") {
    await dequeueJob(job.jobId);
    await updateNlmNoteStatus(job.bundleId, {
        nlm: {
            exportStatus: "needs_user_action",
            lastError: reason,
            attempts: job.attempts,
            updatedAt: Date.now()
        }
    });
    logNlmEvent("nlm_bridge.export_failed", { source: "queue_worker", noteId: job.bundleId, reason });
    const note = await atomGetReadingNote(job.bundleId);
    await notifyNlmRetry(job, note, reason);
}

async function processNlmExportQueue(reason = "alarm") {
    const queue = await loadExportQueue();
    if (!Array.isArray(queue) || queue.length === 0) {
        await chrome.alarms.clear(NLM_QUEUE_ALARM);
        return;
    }

    const now = Date.now();
    const dueJobs = queue.filter((job) => Number.isFinite(job?.nextAttemptAt) && job.nextAttemptAt <= now);

    const reasonTag = reason === "alarm" ? "scheduled_retry" : reason;
    for (const job of dueJobs) {
        const attempts = Number.isFinite(job?.attempts) ? job.attempts : 0;
        if (attempts >= NLM_MAX_RETRY_ATTEMPTS) {
            await finalizeNlmJobFailure(job, "retry_exhausted");
            continue;
        }
        await markNlmNeedsUserAction(job, reasonTag);
    }

    await scheduleNlmQueueAlarm();
}

async function sendNlmRetryPromptToActiveTab(payload) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0];
        if (!tab?.id) return false;
        await chrome.tabs.sendMessage(tab.id, {
            type: "ATOM_NLM_RETRY_PROMPT",
            payload
        });
        return true;
    } catch {
        return false;
    }
}

async function sendIdeaPromptToTab(tabId, suggestion) {
    if (!tabId || !suggestion) return false;
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: "ATOM_NLM_IDEA_PROMPT",
            payload: suggestion
        });
        return true;
    } catch {
        return false;
    }
}

async function maybeTriggerIdeaIncubator(note, tabId) {
    const settings = await loadNlmSettings();
    if (!settings?.enabled) return;
    const result = await evaluateIdeaIncubator(note);
    if (result?.shouldPrompt && result?.suggestion) {
        await sendIdeaPromptToTab(tabId, result.suggestion);
    }
}

async function buildNlmRetryPayload(note, notebookRef, baseUrl, jobId) {
    if (!note) return { ok: false, reason: "missing_note" };
    const settings = await loadNlmSettings();
    if (!settings?.enabled) return { ok: false, reason: "disabled" };
    if (!settings?.allowCloudExport) return { ok: false, reason: "cloud_export_disabled" };

    const bundle = buildReadingBundle(note, settings);
    if (!bundle) return { ok: false, reason: "missing_bundle" };
    const clipText = formatAtomClip(bundle, { maxChars: settings.exportMaxChars || 0 });
    const resolvedRef = notebookRef || note?.nlm?.notebookRef || settings.defaultNotebookRef || "Inbox";
    const notebookUrl = resolveNotebookUrl(resolvedRef, baseUrl || settings.baseUrl);

    return {
        ok: true,
        clipText,
        notebookUrl,
        notebookRef: resolvedRef,
        jobId
    };
}

async function createPendingNlmJob(note, nlmResult, tabId, originUrl) {
    const suggestedQuestion = nlmResult?.suggestedQuestion || buildSuggestedQuestion(note);
    const pending = buildPendingJob({
        bundleId: note?.id || "",
        notebookRef: nlmResult?.notebookRef || "",
        notebookUrl: nlmResult?.notebookUrl || "",
        clipText: nlmResult?.clipText || "",
        dedupeKey: nlmResult?.dedupeKey || "",
        suggestedQuestion,
        tabId: tabId || null,
        originHost: extractHost(originUrl || note?.url || "")
    });
    await addPendingJob(pending);
    return pending;
}

// --- HELPER: SEND ACTIVE READING RESULT (ensure content receiver) ---
async function sendReadingResult(tabId, payload) {
    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, {
                type: "ATOM_READING_RESULT",
                payload
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn("[ATOM Reading] sendMessage failed:", chrome.runtime.lastError.message);
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log("[ATOM Reading] sendMessage ok");
                    resolve({ ok: true });
                }
            });
        } catch (e) {
            console.warn("[ATOM Reading] sendMessage threw:", e?.message || String(e));
            resolve({ ok: false, error: e?.message || String(e) });
        }
    });
}

async function sendReadingEvalResult(tabId, payload) {
    return new Promise((resolve) => {
        try {
            chrome.tabs.sendMessage(tabId, {
                type: "ATOM_READING_EVAL_RESULT",
                payload
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn("[ATOM Reading] sendEval failed:", chrome.runtime.lastError.message);
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log("[ATOM Reading] sendEval ok");
                    resolve({ ok: true });
                }
            });
        } catch (e) {
            console.warn("[ATOM Reading] sendEval threw:", e?.message || String(e));
            resolve({ ok: false, error: e?.message || String(e) });
        }
    });
}

async function ensureReadingUI(tabId) {
    let insertedCss = false;
    let insertedScript = false;

    try {
        await chrome.scripting.insertCSS({ target: { tabId }, files: ["styles.css"] });
        insertedCss = true;
    } catch (e) {
        console.warn("[ATOM Reading] insertCSS failed:", e?.message || String(e));
    }

    try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
        insertedScript = true;
    } catch (e) {
        console.warn("[ATOM Reading] executeScript failed:", e?.message || String(e));
    }

    console.log("[ATOM Reading] ensureReadingUI result:", {
        insertedCss,
        insertedScript
    });
}

function delayMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- 2. XỬ LÝ SỰ KIỆN MENU CHUỘT PHẢI ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Side Panel - Chat with Page
    if (info.menuItemId === "atom-chat-with-page") {
        if (!tab?.id) return;
        try {
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (e) {
            console.error("ATOM: Failed to open side panel:", e);
        }
        return;
    }

    // 1) Nh?nh whitelist hi?n t?i gi? nguy?n
    if (info.menuItemId === "atom-whitelist-domain") {
        if (!tab?.url) return;

        try {
            // Normalize domain v? lowercase ?? tr?nh tr?ng l?p
            const urlObj = new URL(tab.url);
            const domain = urlObj.hostname.toLowerCase();

            const { atom_whitelist } = await chrome.storage.local.get(['atom_whitelist']);
            const current = Array.isArray(atom_whitelist) ? atom_whitelist : DEFAULT_WHITELIST;

            if (!current.includes(domain)) {
                const newList = [...current, domain];
                await chrome.storage.local.set({ atom_whitelist: newList });
                console.log(`ATOM: Added ${domain} to Safe Zone.`);

                // Reload tab ?? ?p d?ng ngay
                chrome.tabs.reload(tab.id);
            }
        } catch (e) {
            console.error("ATOM whitelist error:", e);
        }
        return;
    }

    // 2) Nh?nh Active Reading
    const readingIds = new Set([
        "atom-reading-summarize",
        "atom-reading-critique",
        "atom-reading-quiz",
    ]);

    if (!readingIds.has(info.menuItemId)) return;
    if (!tab?.id || !tab?.url) return;

    const selected = (info.selectionText || "").trim();
    if (!selected) return;

    // Ch?n qu? d?i ?? tr?nh t?n token + lag
    const MAX_CHARS = 4000;
    const clipped = selected.length > MAX_CHARS ? selected.slice(0, MAX_CHARS) : selected;

    try {
        const result = await atomGenerateReadingArtifact({
            command: info.menuItemId,
            text: clipped,
            meta: {
                url: tab.url,
                title: tab.title || "",
                ts: Date.now()
            }
        });

        const note = {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            command: info.menuItemId,
            url: tab.url,
            title: tab.title || "",
            selection: clipped,
            result,
            created_at: Date.now()
        };

        let nlmPayload = null;
        try {
            logNlmEvent("nlm_bridge.export_attempt", { source: "context_menu", noteId: note.id, url: note.url });
            const nlmResult = await prepareNlmExportFromNote(note);
            if (nlmResult && nlmResult.ok) {
                const suggestedQuestion = buildSuggestedQuestion(note);
                await markDedupeHit(nlmResult.job?.dedupeKey);
                note.nlm = {
                    notebookRef: nlmResult.notebookRef,
                    notebookUrl: nlmResult.notebookUrl,
                    exportStatus: "queued",
                    exportedAt: Date.now(),
                    dedupeKey: nlmResult.job?.dedupeKey,
                    jobId: nlmResult.job?.jobId,
                    suggestedQuestion
                };
                nlmPayload = {
                    clipText: nlmResult.clipText,
                    notebookUrl: nlmResult.notebookUrl,
                    notebookRef: nlmResult.notebookRef,
                    suggestedQuestion,
                    jobId: nlmResult.job?.jobId || ""
                };
                scheduleNlmQueueAlarm();
                logNlmEvent("nlm_bridge.export_success", { source: "context_menu", noteId: note.id, notebookRef: nlmResult.notebookRef });
            } else if (nlmResult && nlmResult.reason === "pii_warning") {
                const pending = await createPendingNlmJob(note, nlmResult, tab.id, tab.url);
                note.nlm = {
                    notebookRef: nlmResult.notebookRef,
                    notebookUrl: nlmResult.notebookUrl,
                    exportStatus: "pending_pii",
                    exportedAt: Date.now(),
                    dedupeKey: nlmResult.dedupeKey,
                    jobId: pending.jobId,
                    suggestedQuestion: pending.suggestedQuestion
                };
                nlmPayload = {
                    reason: "pii_warning",
                    jobId: pending.jobId,
                    nonce: pending.nonce,
                    piiSummary: nlmResult.piiSummary || { types: [], count: 0 },
                    suggestedQuestion: pending.suggestedQuestion
                };
                logNlmEvent("nlm_bridge.export_failed", { source: "context_menu", noteId: note.id, reason: "pii_warning" });
            } else if (nlmResult && !nlmResult.ok) {
                logNlmEvent("nlm_bridge.export_failed", { source: "context_menu", noteId: note.id, reason: nlmResult.reason });
            }
        } catch (e) {
            // ignore export errors for reading flow
            logNlmEvent("nlm_bridge.export_failed", { source: "context_menu", noteId: note.id, reason: "error" });
        }

        // L?u Vault
        await atomAppendReadingNote(note);
        await maybeTriggerIdeaIncubator(note, tab.id);

        // G?i v? content.js ?? hi?n card
        const requestId = note.id;
        let sent = await sendReadingResult(tab.id, {
            command: info.menuItemId,
            result,
            note,
            saved: true,
            requestId,
            nlm: nlmPayload
        });
        if (!sent.ok) {
            await ensureReadingUI(tab.id);
            await delayMs(200);
            await sendReadingResult(tab.id, {
                command: info.menuItemId,
                result,
                note,
                saved: true,
                requestId,
                nlm: nlmPayload
            });
        }

    } catch (e) {
        console.warn("ATOM Reading error:", e);
        const errorSummary = e && e.userMessage
            ? e.userMessage
            : (atomMsg("reading_error_summary")
                || "ATOM hit an error analyzing this selection. Please try again.");
        const requestId = `err_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        let sent = await sendReadingResult(tab.id, {
            command: info.menuItemId,
            result: { summary: errorSummary },
            saved: false,
            requestId
        });
        if (!sent.ok) {
            await ensureReadingUI(tab.id);
            await delayMs(200);
            await sendReadingResult(tab.id, {
                command: info.menuItemId,
                result: { summary: errorSummary },
                saved: false,
                requestId
            });
        }
    }
});

// 1. KHI SERVICE WORKER THỨC DẬY:
// Ngay lập tức đọc từ ổ cứng lên để cập nhật lại biến snoozeUntil
chrome.storage.local.get(['snoozeUntil'], (result) => {
    if (result.snoozeUntil) {
        snoozeUntil = result.snoozeUntil;
        //console.log("♻️ Đã khôi phục trạng thái Snooze đến:", new Date(snoozeUntil).toLocaleTimeString());
    }
});

// --- 1. KHỞI TẠO CÁC MODULE ---
const signalExtractor = new SignalExtractor();
const decisionEngine = new DecisionEngine();
const strategyLayer = new StrategyLayer();
const selectionLogic = new SelectionLogic();
let interventionManager = null;

async function getGeminiKey() {
    // Lấy key user đã nhập trong trang Options
    const data = await chrome.storage.local.get(['user_gemini_key']);
    return data.user_gemini_key || null;
}

async function atomGenerateReadingArtifact({ command, text, meta }) {
    const cooldownUntil = await getReadingCooldownUntil();
    if (cooldownUntil && Date.now() < cooldownUntil) {
        const remainingMs = cooldownUntil - Date.now();
        const cooldownErr = new Error("READING_COOLDOWN");
        cooldownErr.userMessage = formatCooldownMessage(remainingMs);
        cooldownErr.cooldownUntil = cooldownUntil;
        throw cooldownErr;
    }

    const key = await getGeminiKey();
    if (!key) {
        // Offline fallback t?i gi?n
        return { summary: "(Offline) B?n ch?a nh?p Gemini API key trong Options." };
    }

    // Use centralized AI config
    const API_BASE = AI_CONFIG.API.BASE_URL;
    const DEFAULT_MODELS = [
        getModel('USER'),           // Primary: gemini-3-flash-preview
        getModel('USER', true),     // Fallback: gemini-2.0-flash
        "gemini-1.5-flash-8b"       // Legacy fallback
    ];

    const lang = getLanguageName();

    const MODE_MAP = {
        "atom-reading-summarize": "SUMMARY",
        "atom-reading-critique": "CRITIQUE",
        "atom-reading-quiz": "QUIZ",
    };

    const mode = MODE_MAP[command] || "SUMMARY";

    const prompt = `
You are ATOM Reading Companion.
Language: ${lang}.
Task mode: ${mode}.

Context:
- Page title: ${meta.title}
- URL: ${meta.url}

User selected text:
"""${text}"""

Instructions based on mode:
${mode === "SUMMARY" ? `
- Provide a 3-5 sentence summary
- List 4-6 key points as bullets
- questions: empty array []
` : ""}
${mode === "CRITIQUE" ? `
- Analyze weaknesses and provide critique in summary (3-5 sentences)
- List 4-6 weak points or areas for improvement as key_points
- questions: empty array []
` : ""}
${mode === "QUIZ" ? `
- Provide a brief 2-3 sentence summary of the content
- key_points: empty array []
- Generate exactly 3 recall/comprehension questions about this text
` : ""}

Output JSON strictly with keys:
- summary: string (required)
- key_points: array of strings (can be empty)
- questions: array of strings (can be empty)
Output only JSON. No markdown, no code fences.
Tone: calm, helpful, not preachy.
`.trim();

    console.log("[ATOM Reading] Selection length:", text.length);
    const RESPONSE_SCHEMA = {
        type: "object",
        properties: {
            summary: { type: "string" },
            key_points: { type: "array", items: { type: "string" } },
            questions: { type: "array", items: { type: "string" } }
        },
        required: ["summary", "key_points", "questions"]
    };
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
        }
    };
    const fallbackBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2500
        }
    };

    async function callGemini(url, body) {
        const runRequest = async () => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 30000);
            try {
                return await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(t);
            }
        };

        const res = await rateManager.enqueue(runRequest, { priority: 'vip' });
        const resText = await res.text();
        if (!res.ok) {
            if (res.status === 429) {
                rateManager.record429Error('reading');
                const retryHeader = res.headers.get("Retry-After");
                const retryHeaderSeconds = retryHeader ? Number(retryHeader) : null;
                const retrySeconds = Number.isFinite(retryHeaderSeconds)
                    ? retryHeaderSeconds
                    : parseRetryAfterSeconds(resText);
                if (Number.isFinite(retrySeconds)) {
                    rateManager.setCooldown((retrySeconds + 1) * 1000, 'reading-429');
                }
            } else if (res.status >= 500) {
                rateManager.recordServerError();
            }
            const err = new Error(`Gemini API error ${res.status}: ${resText}`);
            err.status = res.status;
            err.body = resText;
            throw err;
        }

        console.log("[ATOM Reading] Response length:", resText.length);
        return JSON.parse(resText);
    }

    function parseGeminiJson(raw) {
        const cleaned = String(raw || "").replace(/```json|```/g, '').trim();
        if (!cleaned) {
            throw new Error("Empty Gemini response");
        }

        const extractJsonStringValue = (text, key) => {
            const keyToken = `"${key}"`;
            const keyStart = text.indexOf(keyToken);
            if (keyStart === -1) return null;
            let i = text.indexOf(":", keyStart + keyToken.length);
            if (i === -1) return null;
            i += 1;
            while (i < text.length && /\s/.test(text[i])) i += 1;
            if (text[i] !== "\"") return null;
            i += 1;
            let out = "";
            let escaped = false;
            for (; i < text.length; i += 1) {
                const ch = text[i];
                if (escaped) {
                    out += ch;
                    escaped = false;
                    continue;
                }
                if (ch === "\\") {
                    escaped = true;
                    out += ch;
                    continue;
                }
                if (ch === "\"") break;
                out += ch;
            }
            return out
                .replace(/\\\\/g, "\\")
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, "\"");
        };
        const extractLooseSummaryBlock = (text) => {
            const keyToken = "\"summary\"";
            const start = text.indexOf(keyToken);
            if (start === -1) return null;
            let colon = text.indexOf(":", start + keyToken.length);
            if (colon === -1) return null;
            let sliceStart = colon + 1;
            const keyPointsIndex = text.indexOf("\"key_points\"", sliceStart);
            const questionsIndex = text.indexOf("\"questions\"", sliceStart);
            const endCandidates = [keyPointsIndex, questionsIndex].filter((idx) => idx !== -1);
            let end = endCandidates.length ? Math.min(...endCandidates) : text.indexOf("}", sliceStart);
            if (end === -1) end = text.length;
            let chunk = text.slice(sliceStart, end).trim();
            if (chunk.startsWith("\"")) chunk = chunk.slice(1);
            chunk = chunk.replace(/[,\\s]*$/g, "");
            if (chunk.endsWith("\"")) chunk = chunk.slice(0, -1);
            return chunk
                .replace(/\\\\/g, "\\")
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, "\"")
                .trim();
        };

        const tryParse = (value) => {
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        };

        const direct = tryParse(cleaned);
        if (direct) return direct;

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            const sliced = cleaned.slice(start, end + 1);
            const extracted = tryParse(sliced);
            if (extracted) return extracted;
        }

        const summaryText = extractJsonStringValue(cleaned, "summary");
        if (summaryText != null) return { summary: summaryText };
        const looseSummary = extractLooseSummaryBlock(cleaned);
        if (looseSummary != null) return { summary: looseSummary };

        return { summary: cleaned };
    }

    function normalizeGeminiPayload(result) {
        if (!result || typeof result !== "object") return result;
        const summary = typeof result.summary === "string" ? result.summary.trim() : "";
        if (!summary.startsWith("{") || summary.indexOf("\"summary\"") === -1) {
            return result;
        }

        try {
            const parsed = JSON.parse(summary);
            if (parsed && typeof parsed === "object") return parsed;
        } catch {
            // fall through to regex extraction
        }

        const out = { ...result };
        const summaryMatch = summary.match(/\"summary\"\s*:\s*\"([\s\S]*?)\"/);
        if (summaryMatch && summaryMatch[1]) {
            out.summary = summaryMatch[1].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, "\"");
        }

        const parseStringArray = (key) => {
            const match = summary.match(new RegExp(`\\"${key}\\"\\s*:\\s*\\[([\\s\\S]*?)\\]`));
            if (!match || !match[1]) return [];
            const block = match[1];
            const unescape = (value) => value
                .replace(/\\\\/g, "\\")
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, "\"");
            const quoted = [];
            const re = /\"((?:\\.|[^\"\\])*)\"/g;
            let m;
            while ((m = re.exec(block)) !== null) {
                if (m[1]) quoted.push(unescape(m[1]));
            }
            if (quoted.length) return quoted;
            return block
                .split("\n")
                .join(" ")
                .split(",")
                .map((item) => item.trim())
                .map((item) => item.replace(/^\"|\"$/g, ""))
                .map((item) => unescape(item))
                .filter(Boolean);
        };

        const keyPoints = parseStringArray("key_points");
        const questions = parseStringArray("questions");
        if (keyPoints.length) out.key_points = keyPoints;
        if (questions.length) out.questions = questions;

        return out;
    }

    async function getCachedModel() {
        const data = await chrome.storage.local.get(['atom_gemini_model']);
        return data.atom_gemini_model || null;
    }

    async function cacheModel(modelName) {
        await chrome.storage.local.set({ atom_gemini_model: modelName });
    }

    async function listModels() {
        const url = `${API_BASE}?key=${key}`;
        const res = await fetch(url, { method: "GET" });
        const resText = await res.text();
        if (!res.ok) {
            const err = new Error(`Gemini API error ${res.status}: ${resText}`);
            err.status = res.status;
            err.body = resText;
            throw err;
        }
        const data = JSON.parse(resText);
        const models = Array.isArray(data.models) ? data.models : [];
        return models
            .filter((m) => Array.isArray(m.supportedGenerationMethods)
                && m.supportedGenerationMethods.includes("generateContent"))
            .map((m) => String(m.name || "").replace(/^models\//, ""))
            .filter(Boolean);
    }

    function uniq(list) {
        const seen = new Set();
        const out = [];
        for (const item of list) {
            if (!item || seen.has(item)) continue;
            seen.add(item);
            out.push(item);
        }
        return out;
    }

    let lastError = null;
    const cached = await getCachedModel();
    let candidates = uniq([cached, ...DEFAULT_MODELS]);

    function isRateLimitError(err) {
        const status = err && err.status;
        const msg = String(err && err.message ? err.message : "");
        return status === 429 || msg.includes(" 429");
    }

    async function tryModels(list) {
        for (const modelName of list) {
            const url = `${API_BASE}/${modelName}:generateContent?key=${key}`;
            try {
                const data = await callGemini(url, body);
                const parts = data.candidates?.[0]?.content?.parts || [];
                const raw = parts.map((part) => part && part.text ? part.text : "").join("");
                if (!raw) throw new Error("Empty Gemini response");
                console.log("[ATOM Reading] Raw parts count:", parts.length);
                console.log("[ATOM Reading] Raw text length:", String(raw).length);
                console.log("[ATOM Reading] Raw text preview:", String(raw).slice(0, 200));
                await cacheModel(modelName);
                let parsed = normalizeGeminiPayload(parseGeminiJson(raw));
                let summaryLen = parsed && typeof parsed.summary === "string" ? parsed.summary.length : 0;
                console.log("[ATOM Reading] Parsed summary length:", summaryLen);
                const needsFallback = text.length > 600 && summaryLen < 120;
                if (needsFallback) {
                    const retry = await callGemini(url, fallbackBody);
                    const retryParts = retry.candidates?.[0]?.content?.parts || [];
                    const retryRaw = retryParts.map((part) => part && part.text ? part.text : "").join("");
                    if (retryRaw) {
                        const retryParsed = normalizeGeminiPayload(parseGeminiJson(retryRaw));
                        const retrySummaryLen = retryParsed && typeof retryParsed.summary === "string"
                            ? retryParsed.summary.length
                            : 0;
                        if (retrySummaryLen > summaryLen) {
                            parsed = retryParsed;
                            summaryLen = retrySummaryLen;
                            console.log("[ATOM Reading] Fallback summary length:", summaryLen);
                        }
                    }
                }
                resetReadingCooldownBackoff();
                return parsed;
            } catch (err) {
                const msg = String(err && err.message ? err.message : err);
                lastError = err;
                if (isRateLimitError(err)) {
                    const until = startReadingCooldownWithBackoff(READING_COOLDOWN_MS);
                    const cooldownErr = new Error("READING_COOLDOWN");
                    cooldownErr.userMessage = formatCooldownMessage(until - Date.now());
                    cooldownErr.cooldownUntil = until;
                    throw cooldownErr;
                }
                if (msg.includes('Gemini API error 404')) {
                    continue;
                }
                throw err;
            }
        }
        return null;
    }

    const firstPass = await tryModels(candidates);
    if (firstPass) return firstPass;

    try {
        const listed = await listModels();
        candidates = uniq([...listed, ...DEFAULT_MODELS]);
        const secondPass = await tryModels(candidates);
        if (secondPass) return secondPass;
    } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
            const until = startReadingCooldownWithBackoff(READING_COOLDOWN_MS);
            const cooldownErr = new Error("READING_COOLDOWN");
            cooldownErr.userMessage = formatCooldownMessage(until - Date.now());
            cooldownErr.cooldownUntil = until;
            throw cooldownErr;
        }
    }

    throw lastError || new Error("Gemini API error: model not found");
}

async function atomEvaluateReadingAnswers({ note, questions, answers }) {
    if (!note) {
        throw new Error("Missing reading note");
    }
    const payload = {
        selection: note.selection || "",
        summary: note?.result?.summary || "",
        questions,
        answers
    };
    const result = await aiService.evaluateReadingAnswers(payload);
    return result && typeof result.evaluation === "string" ? result.evaluation.trim() : "";
}

async function atomAppendReadingNote(note) {
    const KEY = "atom_reading_notes";
    const { [KEY]: current } = await chrome.storage.local.get([KEY]);
    const list = Array.isArray(current) ? current : [];

    // Primary dedupe: check by note.id first (handles Page Discussion with empty selection)
    let existingIndex = -1;
    if (note?.id) {
        existingIndex = list.findIndex(item => item?.id === note.id);
    }

    // Fallback dedupe: check if note with same URL + selection already exists
    if (existingIndex < 0 && note?.selection?.trim()) {
        existingIndex = list.findIndex(item =>
            item?.url === note?.url &&
            item?.selection?.trim() &&
            item.selection.trim() === note.selection.trim()
        );
    }

    if (existingIndex >= 0) {
        // Update existing note instead of creating new
        const existing = list[existingIndex];
        const merged = {
            ...existing,
            ...note,
            id: existing.id,  // Keep original ID
            created_at: existing.created_at,  // Keep original timestamp
            updated_at: Date.now()
        };
        list[existingIndex] = merged;
        await chrome.storage.local.set({ [KEY]: list });
        console.log("[ATOM] Note dedupe: updated existing note", existing.id);

        // Re-categorize if needed
        if (!merged.category || !Array.isArray(merged.tags) || merged.tags.length === 0) {
            enqueueMemoryCategorization(existing.id);
        }
        return;
    }

    // No duplicate found, create new note
    const noteId = note?.id || `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const normalized = { ...(note || {}), id: noteId, created_at: note?.created_at || Date.now() };
    const next = [...list, normalized].slice(-200); // giữ 200 notes gần nhất
    await chrome.storage.local.set({ [KEY]: next });

    // Best-effort categorization for new notes (async, do not block save).
    // Only runs if category/tags are missing.
    if (!normalized.category || !Array.isArray(normalized.tags) || normalized.tags.length === 0) {
        enqueueMemoryCategorization(noteId);
    }
}

async function atomGetReadingNote(noteId) {
    const KEY = "atom_reading_notes";
    const { [KEY]: current } = await chrome.storage.local.get([KEY]);
    const list = Array.isArray(current) ? current : [];
    return list.find((item) => item?.id === noteId) || null;
}

async function atomUpdateReadingNote(noteId, patch) {
    if (!noteId) return null;
    const KEY = "atom_reading_notes";
    const { [KEY]: current } = await chrome.storage.local.get([KEY]);
    const list = Array.isArray(current) ? current : [];
    let updated = null;
    const next = list.map((item) => {
        if (!item || item.id !== noteId) return item;
        updated = { ...item, ...patch, updated_at: Date.now() };
        return updated;
    });
    if (updated) {
        await chrome.storage.local.set({ [KEY]: next });
    }
    return updated;
}


const AI_PILOT_DEFAULTS = {
    enabled: false,
    mode: "shadow",
    minConfidence: 0.65,
    timeoutMs: 800,
    budgetPerDay: 30,
    provider: "gemini",
    proxyUrl: "",
    cacheTtlMs: 15000
};

const AI_PILOT_LOG_KEY = "atom_ai_pilot_logs_v1";
const AI_PILOT_LOG_CAP = 1000;
const AI_BUDGET_KEY = "atom_ai_budget_state";
const AI_COOLDOWN_KEY = "atom_ai_cooldown_until";

// Pending reactions tracker (RAM) for reaction_later logging
// Map<intervention_id, { logId, triggeredAt }>
const pendingReactionTracker = new Map();
const REACTION_LATER_WINDOW_MS = 30000; // 30 seconds

function generateLogId() {
    return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function hashTextFNV1a(text) {
    if (!text) return "";
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

function mapAiRecommendToCategory(recommend) {
    switch (recommend) {
        case "presence":
            return "presence_signal";
        case "micro":
            return "micro_closure";
        case "gentle":
            return "gentle_reflection";
        case "hard":
            return "hard_interrupt";
        default:
            return null;
    }
}

function clampAiCategoryByGuardrails(category, hardCooldownOk) {
    if (category === "hard_interrupt" && !hardCooldownOk) return "micro_closure";
    return category;
}

const CATEGORY_ORDER = {
    none: 0,
    presence_signal: 1,
    micro_closure: 2,
    gentle_reflection: 3,
    hard_interrupt: 4
};

function mergeAssistCategory(ruleCategory, aiCategory, signals) {
    if (!aiCategory) return ruleCategory || null;
    if (!ruleCategory) {
        if (aiCategory === "hard_interrupt" && !signals.attention_risk) return null;
        if (aiCategory === "micro_closure" && !signals.attention_risk && !signals.approaching_risk) return null;
        return aiCategory;
    }
    const ruleOrder = CATEGORY_ORDER[ruleCategory] ?? 0;
    const aiOrder = CATEGORY_ORDER[aiCategory] ?? 0;
    if (aiOrder === ruleOrder) return ruleCategory;
    if (aiOrder < ruleOrder) return aiCategory; // downgrade allowed
    if (signals.attention_risk) return aiCategory; // upgrade only in red zone
    return ruleCategory;
}

async function appendAiPilotLog(entry) {
    const data = await chrome.storage.local.get([AI_PILOT_LOG_KEY]);
    const list = Array.isArray(data[AI_PILOT_LOG_KEY]) ? data[AI_PILOT_LOG_KEY] : [];
    const next = [...list, entry].slice(-AI_PILOT_LOG_CAP);
    await chrome.storage.local.set({ [AI_PILOT_LOG_KEY]: next });
}

// Update AI Pilot log entry with reaction_later when user reacts within 30s
async function updateAiPilotLogReaction(interventionId, userAction) {
    const pending = pendingReactionTracker.get(interventionId);
    if (!pending) return false; // No pending entry for this intervention

    const withinSec = Math.floor((Date.now() - pending.triggeredAt) / 1000);
    if (withinSec > 30) {
        pendingReactionTracker.delete(interventionId);
        return false; // Past 30s window
    }

    // Update the log entry in storage
    const data = await chrome.storage.local.get([AI_PILOT_LOG_KEY]);
    const list = Array.isArray(data[AI_PILOT_LOG_KEY]) ? data[AI_PILOT_LOG_KEY] : [];

    // Find and update the entry by logId
    const updatedList = list.map(entry => {
        if (entry.logId === pending.logId) {
            return {
                ...entry,
                reaction_later: {
                    within_sec: withinSec,
                    user_action: userAction
                }
            };
        }
        return entry;
    });

    await chrome.storage.local.set({ [AI_PILOT_LOG_KEY]: updatedList });
    pendingReactionTracker.delete(interventionId);

    console.log(`[ATOM] Updated reaction_later for ${interventionId}: ${userAction} (${withinSec}s)`);
    return true;
}

// Cleanup expired pending entries (called periodically)
function cleanupExpiredPendingReactions() {
    const now = Date.now();
    for (const [id, data] of pendingReactionTracker.entries()) {
        if (now - data.triggeredAt > REACTION_LATER_WINDOW_MS) {
            pendingReactionTracker.delete(id);
        }
    }
}

async function loadAiBudgetState() {
    const data = await chrome.storage.local.get([AI_BUDGET_KEY]);
    const state = data[AI_BUDGET_KEY] || null;
    const dayKey = getLocalDayKeyVN(Date.now());
    if (!state || state.dayKey !== dayKey) {
        return { dayKey, usedCount: 0 };
    }
    return state;
}

async function consumeAiBudget(state) {
    const next = { ...state, usedCount: (state.usedCount || 0) + 1 };
    await chrome.storage.local.set({ [AI_BUDGET_KEY]: next });
    return next;
}

function deriveRuleReasonCodes(s) {
    const codes = [];

    if (s.focusHardBlock) {
        codes.push("RULE_GUARD_FOCUS_HARD_BLOCK");
        if (s.focusEnabled && s.focusPhase === "WORK") codes.push("RULE_FOCUS_PHASE_WORK");
        if (s.focusAllowExpired) codes.push("RULE_FOCUS_ALLOW_EXPIRED");
        return codes;
    }

    if (s.isSystemUrl) codes.push("RULE_GUARD_SYSTEM_URL_SKIP");
    if (s.isWhitelisted) codes.push("RULE_GUARD_WHITELIST_SKIP");
    if (s.isPrivacySensitiveDomain) codes.push("RULE_GUARD_PRIVACY_SENSITIVE_DOMAIN");
    if (s.snoozeActive) codes.push("RULE_GUARD_SNOOZE_ACTIVE");
    if (s.cooldownAnyActive) codes.push("RULE_GUARD_COOLDOWN_ACTIVE_ANY");
    if (s.cooldownHardActive) codes.push("RULE_GUARD_COOLDOWN_ACTIVE_HARD");
    if (s.aiBudgetExhausted) codes.push("RULE_GUARD_BUDGET_EXHAUSTED_AI");

    if (s.focusEnabled && s.focusPhase === "WORK") codes.push("RULE_FOCUS_PHASE_WORK");
    if (s.focusEnabled && s.focusPhase === "BREAK") codes.push("RULE_FOCUS_PHASE_BREAK");
    if (s.focusAllowActive) codes.push("RULE_FOCUS_ALLOW_ACTIVE");
    if (s.focusAllowExpired) codes.push("RULE_FOCUS_ALLOW_EXPIRED");

    if (s.zone === "green") codes.push("RULE_ZONE_GREEN_SAFE");
    if (s.zone === "yellow") codes.push("RULE_ZONE_YELLOW_SUSPECT");
    if (s.zone === "red") codes.push("RULE_ZONE_RED_SCROLL");

    if (s.zone === "red") {
        if (s.continuousScrollSec >= s.th.redContinuousScrollSec) codes.push("RULE_RED_ZONE_CONTINUOUS_SCROLL");
        if (s.scrollPxPerSec >= s.th.redScrollPxPerSec) codes.push("RULE_RED_ZONE_HIGH_SCROLL_VELOCITY");
        if (s.idleSec <= s.th.redMaxIdleSec) codes.push("RULE_RED_ZONE_LOW_IDLE");
    } else if (s.zone === "yellow") {
        if (s.continuousScrollSec >= s.th.yellowContinuousScrollSec) codes.push("RULE_YELLOW_ZONE_MEDIUM_PATTERN");
    }

    if (typeof s.resistanceScore === "number" && s.resistanceScore >= 70) codes.push("RULE_HIGH_RESISTANCE_SCORE");
    if (typeof s.ignoredStreak === "number" && s.ignoredStreak >= 3) codes.push("RULE_IGNORED_STREAK_HIGH");
    if (typeof s.triggeredCount30m === "number" && s.triggeredCount30m >= 3) codes.push("RULE_TRIGGER_COUNT_HIGH_30M");
    if (s.attemptCooldownOk) codes.push("RULE_ATTEMPT_COOLDOWN_OK");
    if (s.hardEligibleCooldownOk) codes.push("RULE_HARD_ELIGIBLE_COOLDOWN_OK");
    if (s.hardEligibleCooldownOk === false) codes.push("RULE_HARD_BLOCKED_BY_COOLDOWN");
    if (s.userSensitivity === "gentle" && s.zone !== "green") {
        codes.push("RULE_DOWNGRADE_DUE_TO_GENTLE_PROFILE");
    }

    switch (s.pageTypeRule) {
        case "feed": codes.push("RULE_PAGE_FEED_LIKELY"); break;
        case "article": codes.push("RULE_PAGE_ARTICLE_LIKELY"); break;
        case "forum": codes.push("RULE_PAGE_FORUM_LIKELY"); break;
        case "pdf": codes.push("RULE_PAGE_PDF_LIKELY"); break;
        case "video": codes.push("RULE_PAGE_VIDEO_LIKELY"); break;
        case "doc": codes.push("RULE_PAGE_DOC_LIKELY"); break;
        default: codes.push("RULE_PAGE_UNKNOWN");
    }

    return codes;
}

async function handleTick(payload, sender) {
    try {
        if (Date.now() < snoozeUntil) {
            if (DEBUG_PIPELINE) console.log("[PIPELINE] blocked by snoozeUntil", snoozeUntil);
            return { type: "none" };
        }
        if (DEBUG_PIPELINE) {
            console.log("[PIPELINE:START]", payload?.url, {
                continuous: payload?.continuous_scroll_sec,
                px: payload?.scroll_px
            });
        }
        // 1. LẤY DỮ LIỆU CẢNH BÁO & NGỮ CẢNH (Context)
        const storage = await chrome.storage.local.get([
            'journal_logs',
            'atom_reactions',
            'last_category',
            'atom_whitelist',
            'user_sensitivity',
            'adaptive_multiplier',
            'ai_pilot_enabled',
            'ai_pilot_mode',
            'ai_min_confidence',
            'ai_timeout_ms',
            'ai_budget_per_day',
            'ai_provider',
            'ai_proxy_url',
            'ai_cache_ttl_ms',
            'atom_ai_pilot_enabled',
            'atom_ai_pilot_mode',
            'atom_ai_confidence_threshold_primary',
            'atom_ai_timeout_ms',
            'atom_ai_budget_daily_cap',
            'atom_ai_cache_ttl_ms',
            'atom_ai_provider',
            'atom_ai_proxy_url',
            AI_BUDGET_KEY,
            AI_COOLDOWN_KEY
        ]);
        const currentSensitivity = storage.user_sensitivity || 'balanced';
        const aiEnabled = storage.atom_ai_pilot_enabled ?? storage.ai_pilot_enabled ?? AI_PILOT_DEFAULTS.enabled;
        const aiMode = storage.atom_ai_pilot_mode || storage.ai_pilot_mode || AI_PILOT_DEFAULTS.mode;
        const aiMinConfidence = typeof storage.atom_ai_confidence_threshold_primary === "number"
            ? storage.atom_ai_confidence_threshold_primary
            : (typeof storage.ai_min_confidence === "number"
                ? storage.ai_min_confidence
                : AI_PILOT_DEFAULTS.minConfidence);
        const aiTimeoutMs = typeof storage.atom_ai_timeout_ms === "number"
            ? storage.atom_ai_timeout_ms
            : (typeof storage.ai_timeout_ms === "number"
                ? storage.ai_timeout_ms
                : AI_PILOT_DEFAULTS.timeoutMs);
        const aiBudgetPerDay = typeof storage.atom_ai_budget_daily_cap === "number"
            ? storage.atom_ai_budget_daily_cap
            : (typeof storage.ai_budget_per_day === "number"
                ? storage.ai_budget_per_day
                : AI_PILOT_DEFAULTS.budgetPerDay);
        const aiCacheTtlMs = typeof storage.atom_ai_cache_ttl_ms === "number"
            ? storage.atom_ai_cache_ttl_ms
            : (typeof storage.ai_cache_ttl_ms === "number"
                ? storage.ai_cache_ttl_ms
                : AI_PILOT_DEFAULTS.cacheTtlMs);
        const aiCooldownUntil = typeof storage[AI_COOLDOWN_KEY] === "number"
            ? storage[AI_COOLDOWN_KEY]
            : 0;
        const frameFromPayload = payload?.frame_v2 || null;
        const frame = frameFromPayload ? { ...frameFromPayload } : null;
        if (frame && sender?.tab?.id) {
            frame.tabId = sender.tab.id;
        }
        // [MỚI 2] TÍNH TOÁN NGƯỠNG ĐÀN HỒI (ELASTIC THRESHOLDS)
        // Lấy ngưỡng gốc
        const baseThresholds = THRESHOLDS_MAP[currentSensitivity] || THRESHOLDS_MAP.balanced;

        // Lấy hệ số nhân (Mặc định 1.0 nếu chưa có)
        const multiplier = storage.adaptive_multiplier || 1.0;
        // Tạo bản sao của thresholds để không sửa đè vào config gốc
        const thresholds = { ...baseThresholds };

        // Áp dụng hệ số nhân vào thời gian cuộn giới hạn
        // Ví dụ: 180s * 1.15 = 207s
        thresholds.SCROLL_THRESHOLD_SEC = Math.round(baseThresholds.SCROLL_THRESHOLD_SEC * multiplier);
        thresholds.PRESENCE_THRESHOLD_SEC = Math.round(baseThresholds.PRESENCE_THRESHOLD_SEC * multiplier);
        console.log(`[THRESH] Mode: ${currentSensitivity.toUpperCase()} | Multiplier: ${multiplier}x | ScrollLimit: ${thresholds.SCROLL_THRESHOLD_SEC}s | PresenceLimit: ${thresholds.PRESENCE_THRESHOLD_SEC}s`);
        // --- [STEP A] SAFE ZONE CHECK (FAIL-FAST) ---
        // Check ngay lập tức trước khi chạy bất kỳ logic nặng nào
        const whitelist = storage.atom_whitelist || DEFAULT_WHITELIST;
        const currentUrl = payload.url || "";
        // [MỚI] CHÈN VÀO ĐÂY: Check các trang hệ thống trước
        if (currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://") || currentUrl.startsWith("about:")) {
            return { type: "none" };
        }
        let host = "";
        try {
            host = new URL(currentUrl).hostname.toLowerCase();
        } catch { /* ignore invalid url */ }

        // Nếu domain nằm trong whitelist -> Bỏ qua luôn
        const isSafe = host && whitelist.some(d => hostMatches(host, d));
        if (isSafe) {
            return { type: "none" };
        }
        // --- [STEP B] TIẾP TỤC PIPELINE NẾU KHÔNG PHẢI SAFE ZONE ---
        const reactions = storage.atom_reactions || [];
        // FIX: HARD COOLDOWN (Chống Spam Loop từ phía Server)
        // Nếu vừa mới trigger xong (trong vòng 60s) thì bỏ qua ngay,
        // bất kể content.js có gửi yêu cầu gì lên.
        const lastTrigger = reactions.filter(r => r.event === 'TRIGGERED').pop();
        if (lastTrigger && (Date.now() - lastTrigger.timestamp < 60000)) {
            // console.log("ATOM: Đang trong thời gian nghỉ ngơi (Hard Cooldown)");
            return { type: "none" };
        }

        // --- [NEW] TÍNH TOÁN INTERVENTION CAP ---
        // Tính xem trong 30 phút qua đã can thiệp bao nhiêu lần rồi
        const recentCount = countRecentInterventions(reactions, 30);

        // --- [MỚI] TÍNH TOÁN ESCALATION STATS (Thêm dòng này) ---
        // Gọi hàm helper chúng ta vừa thêm ở Bước 1
        const escalationStats = computeEscalationStats(reactions, 30);

        // Load focus state for frame enrichment
        const focusState = await loadFocusState();
        const currentDomain = normalizeDomainFromUrl(payload.url || "");

        if (frame && frame.state) {
            frame.state.atomSensitivity = currentSensitivity;
            frame.state.resistanceScore = escalationStats.resistanceScore;

            // Focus state from atom_focus_state (storage)
            frame.state.focusEnabled = focusState?.isActive || false;
            frame.state.focusPhase = focusState?.phase || null;

            // Calculate allow remaining seconds
            if (focusState?.allowUntil?.[currentDomain]) {
                const remainingMs = focusState.allowUntil[currentDomain] - Date.now();
                frame.state.focusAllowRemainingSec = Math.max(0, Math.floor(remainingMs / 1000));
            } else {
                frame.state.focusAllowRemainingSec = null;
            }

            // Intervention tracking from sessionState (RAM)
            frame.state.lastInterventionType = sessionState.lastInterventionType;
            if (sessionState.lastInterventionTime > 0) {
                frame.state.lastInterventionAgoSec = Math.floor((Date.now() - sessionState.lastInterventionTime) / 1000);
            } else {
                frame.state.lastInterventionAgoSec = null;
            }
        }

        // 3. ENRICH PAYLOAD (Bổ sung dữ liệu cho Extractor)
        const enrichedPayload = {
            ...payload, // Giữ nguyên url, continuous_scroll_sec từ content gửi lên
            intervention_count_recent: recentCount, // <--- Dữ liệu còn thiếu đây!
            // --- [QUAN TRỌNG] GỬI KÈM DỮ LIỆU LEO THANG ---
            // Để SignalExtractor và StrategyLayer có thể đọc được
            escalation: escalationStats
        };

        // 2. SIGNAL EXTRACTION (Giác quan)
        const signals = signalExtractor.extract(enrichedPayload, thresholds);
        console.log("[SIGNALS]", signals);
        // console.log(`Debug: Resistance Score: ${escalationStats.resistanceScore} | HardOK: ${escalationStats.hardCooldownOk}`);

        // 3. DECISION ENGINE (The Guard - Quyết định nhị phân)
        const decision = decisionEngine.decide(signals);
        const strategyContext = StrategyLayer.parseContext(storage);
        const strategy = strategyLayer.buildStrategy(signals, strategyContext);

        // Nếu Decision bảo cho phép (Allowed), dừng pipeline ngay lập tức
        // -----------------------------------------------------------------
        // 🕵️ SHADOW MODE (MV3 Optimized: Soft Await)
        // -----------------------------------------------------------------
        // Chỉ chạy khi hệ thống quyết định can thiệp (Rủi ro cao)
        if (!decision.is_safe_to_scroll && !aiEnabled) {

            // 1. Chuẩn bị dữ liệu sạch cho AI (Khớp với ai_service.js)
            const aiCtx = {
                depth: payload.continuous_scroll_sec,
                resistance: escalationStats.resistanceScore,
                streak: escalationStats.ignoredStreak,
                sentiment_tags: [strategyContext.sentiment].filter(Boolean) // Lọc bỏ null/undefined
            };

            // 2. Tạo cuộc đua (Race): AI vs Thời gian
            // - AI chạy: Có thể nhanh (cache) hoặc chậm (network)
            // - Timeout: Giới hạn 300ms. Nếu AI lâu hơn -> Bỏ qua để giữ hiệu năng.
            const aiPromise = aiService.generateStrategy(aiCtx).catch(err => null); // Catch lỗi để không sập
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 300));

            // Kỹ thuật "Soft Await": Chờ cái nào xong trước
            const aiStrategy = await Promise.race([aiPromise, timeoutPromise]);

            // 3. Nếu AI kịp trả lời (hoặc có Cache), ghi lại nhật ký
            if (aiStrategy) {
                // A. Log Console (Màu cam để dễ nhìn)
                console.log(
                    `%c[SHADOW] Rule: ${strategy?.intent || 'SILENCE'} | AI: ${aiStrategy.intent}`,
                    "color: orange; font-weight: bold;"
                );

                // B. Lưu Storage (Full Context để phân tích sau này)
                const shadowLog = {
                    timestamp: Date.now(),
                    event: "SHADOW_COMPARE",
                    mode: "AI_VS_RULE",
                    context: {
                        signals: aiCtx,              // Input: Tình huống là gì?
                        rule_result: strategy,       // Code chọn gì? (Cứng nhắc)
                        ai_result: aiStrategy,       // AI chọn gì? (Thấu hiểu)
                        // So sánh: True nếu Code và AI đồng ý kiến
                        match: (strategy?.intent === aiStrategy.intent)
                    }
                };

                // Lưu vào atom_reactions (không cần await để trả response nhanh cho UI)
                chrome.storage.local.get(['atom_reactions'], (result) => {
                    const currentLogs = result.atom_reactions || [];
                    // Giữ 50 log gần nhất để không đầy bộ nhớ
                    const updatedLogs = [...currentLogs, shadowLog].slice(-50);
                    chrome.storage.local.set({ atom_reactions: updatedLogs });
                });
            }
        }
        // -----------------------------------------------------------------
        const selectionContext = {
            intervention_fatigue: strategyContext.intervention_fatigue,
            recent_category: storage.last_category,
            dismissal_frequency: strategyContext.resistance_signal,
            last_successful_intervention: storage.last_successful_intervention
        };

        const ruleCategory = selectionLogic.selectCategory(strategy, selectionContext);
        let finalCategory = ruleCategory;
        let finalSource = "rule";
        let aiDecision = null;
        let aiCategory = null;
        let aiDecisionSource = null;

        const now = Date.now();
        const aiBudgetState = await loadAiBudgetState();
        const aiBudgetExhausted = aiBudgetPerDay > 0 && aiBudgetState.usedCount >= aiBudgetPerDay;
        const aiCooldownActive = aiCooldownUntil && now < aiCooldownUntil;
        const frameHasSignal = !!frame && (
            (frame.snippet?.viewportTextChars || 0) >= 200 ||
            (frame.snippet?.selectedTextChars || 0) > 0
        );
        const pageType = frame?.page?.pageType || "unknown";
        // Derive zone early for AI gating
        const zone = signals.attention_risk ? "red" : (signals.approaching_risk ? "yellow" : "green");
        // Hybrid Rule-First: only call AI in yellow (ambiguous) zone
        // Green = safe (rules sufficient), Red = clear doomscroll (rules sufficient)
        const zoneNeedsAi = zone === "yellow";
        const shouldCallAi = aiEnabled
            && !!frame
            && frameHasSignal
            && !aiBudgetExhausted
            && !aiCooldownActive
            && zoneNeedsAi;
        if (aiEnabled && !shouldCallAi && DEBUG_PIPELINE) {
            const skipReason = aiBudgetExhausted ? "budget" : aiCooldownActive ? "cooldown" : !zoneNeedsAi ? `zone=${zone}` : "no_signal";
            console.log(`[TICK:AI_SKIP] ${skipReason} | scroll=${payload.continuous_scroll_sec}s`);
        }

        let aiLatencyMs = null;
        let aiError = null;
        if (shouldCallAi) {
            const tabId = frame?.tabId;
            const cacheKey = tabId ? `tab:${tabId}` : null;
            try {
                const startedAt = Date.now();
                aiDecision = await aiPilotService.classify(frame, {
                    timeoutMs: aiTimeoutMs,
                    cacheKey,
                    cacheTtlMs: aiCacheTtlMs
                });
                aiLatencyMs = aiDecision?.fromCache ? 0 : (Date.now() - startedAt);
                aiDecisionSource = aiDecision?.fromCache ? "cache" : "live";
                await consumeAiBudget(aiBudgetState);
            } catch (e) {
                aiDecision = null;
                aiLatencyMs = null;
                aiError = e;
            }
        }

        if (aiDecision?.ok && aiDecision.sanitized) {
            aiCategory = mapAiRecommendToCategory(aiDecision.sanitized.recommend);
            aiCategory = clampAiCategoryByGuardrails(aiCategory, escalationStats.hardCooldownOk);

            const aiConfident = aiDecision.sanitized.confidence >= aiMinConfidence;
            if (aiMode === "primary" && aiConfident) {
                finalCategory = aiCategory;
                finalSource = "ai";
            } else if (aiMode === "assist" && aiConfident) {
                const merged = mergeAssistCategory(ruleCategory, aiCategory, signals);
                finalCategory = merged;
                finalSource = merged === ruleCategory ? "rule" : "ai";
            }

            if (aiDecision.sanitized.cooldown_s > 0) {
                const until = now + aiDecision.sanitized.cooldown_s * 1000;
                chrome.storage.local.set({ [AI_COOLDOWN_KEY]: until });
            }
        }

        if (shouldCallAi) {
            const tabId = frame?.tabId;
            const url = payload.url || frame?.page?.url || "";
            const label = aiDecision?.sanitized?.recommend || ruleCategory || "unknown";
            const metaBase = { pageType, mode: aiMode, source: aiDecisionSource || "none" };

            if (aiError) {
                const isTimeout = aiError?.name === "AbortError";
                atomDebugPush({
                    kind: isTimeout ? "ai_timeout" : "ai_error",
                    label,
                    minConfidence: aiMinConfidence,
                    usedAI: false,
                    reason: isTimeout ? "timeout_fallback" : "error_fallback",
                    latencyMs: aiLatencyMs ?? null,
                    tabId,
                    url,
                    meta: { ...metaBase, errorMessage: String(aiError?.message || aiError) }
                });
            } else if (aiDecision) {
                if (!aiDecision.ok) {
                    atomDebugPush({
                        kind: "ai_error",
                        label,
                        confidence: aiDecision?.sanitized?.confidence,
                        minConfidence: aiMinConfidence,
                        usedAI: false,
                        reason: "invalid_output_fallback",
                        latencyMs: aiLatencyMs ?? null,
                        tabId,
                        url,
                        meta: { ...metaBase, errors: aiDecision.errors || [], warnings: aiDecision.warnings || [] }
                    });
                } else {
                    const confidence = aiDecision?.sanitized?.confidence;
                    const usedAI = finalSource === "ai";
                    const reason = usedAI
                        ? "pass_threshold"
                        : (confidence < aiMinConfidence ? "below_threshold" : "rule_preferred");
                    atomDebugPush({
                        kind: "ai_decision",
                        label,
                        confidence,
                        minConfidence: aiMinConfidence,
                        usedAI,
                        reason,
                        latencyMs: aiLatencyMs ?? null,
                        tabId,
                        url,
                        meta: metaBase
                    });
                }
            }
        }

        if (!finalCategory || finalCategory === 'none') {
            if (DEBUG_PIPELINE) {
                const reason =
                    (Date.now() < snoozeUntil) ? "SNOOZED" :
                        (!decision.needs_processing) ? "SAFE_TO_SCROLL" :
                            (strategyContext.intervention_fatigue === "high") ? "FATIGUE_SILENCE" : "UNKNOWN";

                console.log(`[TICK:OUT] none | Reason: ${reason} | Scroll: ${payload.continuous_scroll_sec}s`);
            }
            if (aiDecision || aiEnabled) {
                const zone = signals.attention_risk ? "red" : (signals.approaching_risk ? "yellow" : "green");
                const ruleState = {
                    isSystemUrl: currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://") || currentUrl.startsWith("about:"),
                    isWhitelisted: isSafe,
                    isPrivacySensitiveDomain: false,
                    snoozeActive: Date.now() < snoozeUntil,
                    cooldownAnyActive: false,
                    cooldownHardActive: !escalationStats.hardCooldownOk,
                    aiBudgetExhausted,
                    focusEnabled: false,
                    focusPhase: null,
                    focusAllowActive: false,
                    focusAllowExpired: false,
                    focusHardBlock: false,
                    zone,
                    continuousScrollSec: payload.continuous_scroll_sec || 0,
                    scrollPxPerSec: frame?.behavior_60s?.scrollPxPerSec || 0,
                    idleSec: frame?.behavior_60s?.idleSec || 0,
                    th: {
                        redContinuousScrollSec: thresholds.SCROLL_THRESHOLD_SEC,
                        redScrollPxPerSec: 3000,
                        redMaxIdleSec: 3,
                        yellowContinuousScrollSec: thresholds.PRESENCE_THRESHOLD_SEC
                    },
                    resistanceScore: escalationStats.resistanceScore,
                    ignoredStreak: escalationStats.ignoredStreak,
                    triggeredCount30m: escalationStats.triggeredCount,
                    attemptCooldownOk: true,
                    hardEligibleCooldownOk: escalationStats.hardCooldownOk,
                    userSensitivity: currentSensitivity,
                    pageTypeRule: pageType
                };

                const ruleReasons = deriveRuleReasonCodes(ruleState);
                const aiReasons = aiDecision?.sanitized?.ai_reason_codes || [];
                const expectedCodes = aiDecision?.expectedCodes || [];
                const titleHash = hashTextFNV1a(frame?.page?.title || "");
                const snippetHash = hashTextFNV1a(`${frame?.snippet?.viewportText || ""}|${frame?.snippet?.selectedText || ""}`);
                const disagreementType = !aiDecision
                    ? "AI_TIMEOUT_FALLBACK_RULE"
                    : (!aiDecision.ok ? "AI_INVALID_JSON_FALLBACK_RULE"
                        : (aiDecision.sanitized.confidence < aiMinConfidence ? "AI_LOW_CONFIDENCE_FALLBACK_RULE" : "AI_AND_RULE_AGREE"));

                await appendAiPilotLog({
                    ts: Date.now(),
                    tabId: frame?.tabId || null,
                    domain: frame?.page?.domain || "",
                    pageType: pageType,
                    frame_digest: {
                        behavior_60s: frame?.behavior_60s || {},
                        actions_60s: frame?.actions_60s || {},
                        title_hash: titleHash,
                        snippet_hash: snippetHash
                    },
                    rule: { zone, suggest: ruleCategory || "none", reason_codes: ruleReasons },
                    ai: aiDecision?.sanitized
                        ? {
                            mode: aiDecision.sanitized.mode,
                            intent: aiDecision.sanitized.intent_score,
                            compulsion: aiDecision.sanitized.compulsion_score,
                            recommend: aiDecision.sanitized.recommend,
                            confidence: aiDecision.sanitized.confidence,
                            latency_ms: aiLatencyMs,
                            ai_reason_codes: aiReasons,
                            expected_reason_codes: expectedCodes,
                            source: aiDecisionSource || "none"
                        }
                        : null,
                    final: { intervention: "none", hard_mode: null, source: finalSource },
                    disagreement: { type: disagreementType, notes: "" },
                    reaction_later: { within_sec: 0, user_action: "none" }
                });
            }
            return { type: "none" };
        }

        // renderV3 sẽ tự trả type none/presence_signal/... phù hợp
        if (!interventionManager) {
            await i18nReady;
            interventionManager = new InterventionManager();
        }
        const intervention = await interventionManager.renderV3(finalCategory, strategy);
        if (intervention.type !== 'none' && intervention.type !== 'presence_signal') {
            // Update sessionState (RAM)
            sessionState.lastInterventionTime = Date.now();
            sessionState.lastInterventionType = intervention.type;
            sessionState.interventionCount++;

            const triggerLog = {
                timestamp: Date.now(),
                url: payload.url || "unknown",
                event: "TRIGGERED",
                mode: intervention.type.toUpperCase()
            };

            const newReactions = [...reactions, triggerLog].slice(-50);
            try {
                await chrome.storage.local.set({ atom_reactions: newReactions });
            } catch (e) {
                console.warn("ATOM: Storage write failed", e);
            }
        }

        await chrome.storage.local.set({ 'last_category': finalCategory });

        if (aiDecision || aiEnabled) {
            const zone = signals.attention_risk ? "red" : (signals.approaching_risk ? "yellow" : "green");
            const ruleState = {
                isSystemUrl: currentUrl.startsWith("chrome://") || currentUrl.startsWith("edge://") || currentUrl.startsWith("about:"),
                isWhitelisted: isSafe,
                isPrivacySensitiveDomain: false,
                snoozeActive: Date.now() < snoozeUntil,
                cooldownAnyActive: false,
                cooldownHardActive: !escalationStats.hardCooldownOk,
                aiBudgetExhausted,
                focusEnabled: false,
                focusPhase: null,
                focusAllowActive: false,
                focusAllowExpired: false,
                focusHardBlock: false,
                zone,
                continuousScrollSec: payload.continuous_scroll_sec || 0,
                scrollPxPerSec: frame?.behavior_60s?.scrollPxPerSec || 0,
                idleSec: frame?.behavior_60s?.idleSec || 0,
                th: {
                    redContinuousScrollSec: thresholds.SCROLL_THRESHOLD_SEC,
                    redScrollPxPerSec: 3000,
                    redMaxIdleSec: 3,
                    yellowContinuousScrollSec: thresholds.PRESENCE_THRESHOLD_SEC
                },
                resistanceScore: escalationStats.resistanceScore,
                ignoredStreak: escalationStats.ignoredStreak,
                triggeredCount30m: escalationStats.triggeredCount,
                attemptCooldownOk: true,
                hardEligibleCooldownOk: escalationStats.hardCooldownOk,
                userSensitivity: currentSensitivity,
                pageTypeRule: pageType
            };

            const ruleReasons = deriveRuleReasonCodes(ruleState);
            const aiReasons = aiDecision?.sanitized?.ai_reason_codes || [];
            const expectedCodes = aiDecision?.expectedCodes || [];
            const titleHash = hashTextFNV1a(frame?.page?.title || "");
            const snippetHash = hashTextFNV1a(`${frame?.snippet?.viewportText || ""}|${frame?.snippet?.selectedText || ""}`);
            let disagreementType = "AI_AND_RULE_AGREE";
            if (!aiDecision) disagreementType = "AI_TIMEOUT_FALLBACK_RULE";
            else if (!aiDecision.ok) disagreementType = "AI_INVALID_JSON_FALLBACK_RULE";
            else if (aiDecision.sanitized.confidence < aiMinConfidence) disagreementType = "AI_LOW_CONFIDENCE_FALLBACK_RULE";
            else if (aiCategory && ruleCategory && aiCategory !== ruleCategory) {
                const aiOrder = CATEGORY_ORDER[aiCategory] ?? 0;
                const ruleOrder = CATEGORY_ORDER[ruleCategory] ?? 0;
                disagreementType = aiOrder < ruleOrder ? "RULE_ESCALATE_BUT_AI_DOWNGRADE" : "AI_DOOMSCROLL_BUT_RULE_SAFE";
            } else if (aiCategory && !ruleCategory) {
                disagreementType = "AI_DOOMSCROLL_BUT_RULE_SAFE";
            }

            // Generate unique IDs for reaction tracking
            const logId = generateLogId();
            const interventionId = intervention?.payload?.intervention_id || null;

            await appendAiPilotLog({
                logId,
                intervention_id: interventionId,
                ts: Date.now(),
                tabId: frame?.tabId || null,
                domain: frame?.page?.domain || "",
                pageType: pageType,
                frame_digest: {
                    behavior_60s: frame?.behavior_60s || {},
                    actions_60s: frame?.actions_60s || {},
                    title_hash: titleHash,
                    snippet_hash: snippetHash
                },
                rule: { zone, suggest: ruleCategory || "none", reason_codes: ruleReasons },
                ai: aiDecision?.sanitized
                    ? {
                        mode: aiDecision.sanitized.mode,
                        intent: aiDecision.sanitized.intent_score,
                        compulsion: aiDecision.sanitized.compulsion_score,
                        recommend: aiDecision.sanitized.recommend,
                        confidence: aiDecision.sanitized.confidence,
                        latency_ms: aiLatencyMs,
                        ai_reason_codes: aiReasons,
                        expected_reason_codes: expectedCodes,
                        source: aiDecisionSource || "none"
                    }
                    : null,
                final: { intervention: finalCategory, hard_mode: intervention?.payload?.mode || null, source: finalSource },
                disagreement: { type: disagreementType, notes: "" },
                reaction_later: { within_sec: 0, user_action: "none" }
            });

            // Register pending reaction for tracking
            if (interventionId && finalCategory !== "none" && finalCategory !== "presence_signal") {
                pendingReactionTracker.set(interventionId, {
                    logId,
                    triggeredAt: Date.now()
                });
            }
        }

        return intervention;

    } catch (error) {
        console.error("Pipeline Error:", error);
        return { type: "none" }; // Fail-safe: Im lặng nếu có lỗi
    }
}


function countRecentInterventions(reactions, windowMinutes = 30) {
    if (!reactions || reactions.length === 0) return 0;

    const now = Date.now();
    const threshold = now - (windowMinutes * 60 * 1000);

    return reactions.filter(r =>
        r.timestamp > threshold &&
        r.event === "TRIGGERED" // <--- CHỈ ĐẾM SỐ LẦN ĐÃ KÍCH HOẠT
    ).length;
}
// background.js - NÂNG CẤP HÀM ASK GEMINI

async function callGeminiBackground(url, payload, label = "background") {
    const runRequest = async () => fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const res = await rateManager.enqueue(runRequest, {
        priority: "background",
        skipDuringCooldown: true  // Skip if in cooldown to prevent queue buildup
    });
    const text = await res.text();
    if (!res.ok) {
        if (res.status === 429) {
            const sourceLabel = label ? String(label) : 'background';
            rateManager.record429Error(sourceLabel);
            const retryHeader = res.headers.get("Retry-After");
            const retryHeaderSeconds = retryHeader ? Number(retryHeader) : null;
            const retrySeconds = Number.isFinite(retryHeaderSeconds)
                ? retryHeaderSeconds
                : parseRetryAfterSeconds(text);
            if (Number.isFinite(retrySeconds)) {
                rateManager.setCooldown((retrySeconds + 1) * 1000, `${label}-429`);
            }
        } else if (res.status >= 500) {
            rateManager.recordServerError();
        }
        throw new Error(`Gemini API error ${res.status}: ${text}`);
    }
    return JSON.parse(text);
}

function parseGeminiStatus(error) {
    const msg = String(error?.message || error || '');
    const match = msg.match(/Gemini API error\s+(\d+)/i);
    return match ? Number(match[1]) : null;
}

function isNetworkFetchError(error) {
    const msg = String(error?.message || error || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error');
}

function isRetryableGeminiStatus(status) {
    return status === 429 || (Number.isFinite(status) && status >= 500);
}

function getUserFallbackChain() {
    const configuredChain = Array.isArray(AI_CONFIG.MODELS?.USER?.fallback_chain)
        ? AI_CONFIG.MODELS.USER.fallback_chain
        : [];
    if (configuredChain.length > 0) {
        return configuredChain.filter(Boolean);
    }
    if (AI_CONFIG.MODELS?.USER?.fallback) {
        return [AI_CONFIG.MODELS.USER.fallback].filter(Boolean);
    }
    return [];
}

async function getLLMProviderConfig() {
    const result = await chrome.storage.local.get([
        'atom_llm_provider',
        'atom_openrouter_key',
        'atom_openrouter_model'
    ]);
    return {
        provider: result.atom_llm_provider || 'google',
        openrouterKey: result.atom_openrouter_key || '',
        openrouterModel: result.atom_openrouter_model || AI_CONFIG.API.OPENROUTER.DEFAULT_MODEL || 'stepfun/step-3.5-flash:free'
    };
}

function convertToOpenRouterMessages(systemPrompt, geminiContents) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    for (const item of geminiContents || []) {
        const role = item.role === 'model' ? 'assistant' : 'user';
        const text = item.parts?.map(p => p.text).join('\n') || '';
        if (text.trim()) {
            messages.push({ role, content: text });
        }
    }
    return messages;
}

async function callOpenRouterAPI(openrouterKey, model, messages, generationConfig = {}) {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    let targetModel = model;
    if (targetModel === 'google/gemini-2.0-flash-exp:free') {
        console.warn('[ATOM AI] Intercepting broken model request. Swapping to Step 3.5 Flash.');
        targetModel = 'stepfun/step-3.5-flash:free';
    }

    const body = {
        model: targetModel,
        messages,
        temperature: generationConfig.temperature ?? 0.7,
        max_tokens: generationConfig.maxOutputTokens ?? 4096,
        stream: false
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`,
            ...(AI_CONFIG.API.OPENROUTER?.HEADERS || {})
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenRouter API error ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
}

function buildOpenRouterFallbackChain(primaryModel) {
    const defaults = [
        'stepfun/step-3.5-flash:free',
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'mistralai/mistral-small-24b-instruct-2501:free'
    ];
    const configured = Array.isArray(AI_CONFIG.API.OPENROUTER?.FALLBACK_CHAIN)
        ? AI_CONFIG.API.OPENROUTER.FALLBACK_CHAIN
        : [];
    const chain = [primaryModel, ...configured, ...defaults].filter(Boolean);
    return [...new Set(chain)];
}

async function callOpenRouterWithFallback(openrouterKey, primaryModel, messages, generationConfig = {}) {
    const chain = buildOpenRouterFallbackChain(primaryModel);
    let lastError;
    for (const model of chain) {
        try {
            return await callOpenRouterAPI(openrouterKey, model, messages, generationConfig);
        } catch (error) {
            lastError = error;
            console.warn('[ATOM AI] OpenRouter model failed:', model, error);
        }
    }
    throw lastError;
}

async function callGeminiBackgroundWithFallback(userKey, prompt, label = 'journal') {
    const primaryModel = getModel('USER');
    const fallbackChain = getUserFallbackChain().filter(model => model !== primaryModel);
    const models = [primaryModel, ...fallbackChain];
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    let lastError;

    for (const model of models) {
        const url = `${AI_CONFIG.API.BASE_URL}/${model}:generateContent?key=${userKey}`;
        try {
            return await callGeminiBackground(url, payload, label);
        } catch (error) {
            lastError = error;
            const status = parseGeminiStatus(error);
            if (!isRetryableGeminiStatus(status)) break;
        }
    }

    throw lastError;
}

async function askGemini(journalLogs, reactions, history) {
    const aiSettings = await chrome.storage.local.get(['atom_ai_pilot_enabled', 'ai_pilot_enabled']);
    const aiEnabled = aiSettings.atom_ai_pilot_enabled ?? aiSettings.ai_pilot_enabled ?? AI_PILOT_DEFAULTS.enabled;
    if (!aiEnabled) {
        return atomMsg("journal_ai_disabled");
    }

    const llmConfig = await getLLMProviderConfig();
    const userKey = await getGeminiKey();
    const hasGeminiKey = !!userKey;
    const hasOpenRouterKey = !!llmConfig.openrouterKey;
    console.debug('[Journal AI] Request', {
        provider: llmConfig.provider,
        hasGeminiKey,
        hasOpenRouterKey
    });

    if (!journalLogs.length && !reactions.length) {
        return "Tôi chưa thấy hoạt động nào đáng chú ý. Hãy cứ là chính mình nhé!";
    }
    // --- CHẾ ĐỘ OFFLINE ---
    if (!userKey && llmConfig.provider !== 'openrouter') {
        console.warn('[Journal AI] No Gemini key found. Falling back to offline response.');
        const randomKey = OFFLINE_QUOTE_KEYS[Math.floor(Math.random() * OFFLINE_QUOTE_KEYS.length)];
        const quote = atomMsg(randomKey);
        // Lưu ý: Nếu muốn thêm text hướng dẫn
        return `(Offline) ${quote}`;
    }
    // --- CHẾ ĐỘ ONLINE ---
    const lang = getLanguageName();
    // 1. Tóm tắt nhật ký cảm xúc
    const logSummary = journalLogs.slice(-5).map(log => {
        return `- Mood: ${log.input.user_feeling}, Note: "${log.input.user_note}" tại ${log.input.context}`;
    }).join("\n");

    // 2. Tóm tắt phản kháng (Sự thật ngầm hiểu)
    const totalIgnored = reactions.filter(r => r.event === "IGNORED").length;
    const mostIgnoredMode = reactions.reduce((acc, curr) => {
        acc[curr.mode] = (acc[curr.mode] || 0) + 1;
        return acc;
    }, {});

    const prompt = `
    Roleplay as Amo, an empathetic AI companion.
    User Language: ${lang} (You MUST reply in this language).
    
    USER STATUS:
    - Recent Journal: ${logSummary || "User hasn't shared much yet."}
    - Ignored Interventions: ${totalIgnored} times.
    - Screen blocks encountered: ${history.length} times.

    YOUR MISSION:
    1. Don't list stats like a report. Use them to infer if the User is overwhelmed or just distracted.
    2. Be a gentle friend sitting next to them. Do NOT preach or scold.
    3. If Resistance is high, ask yourself: "Was I too harsh?" instead of blaming them.
    4. Keep advice short, soft, and validating.
    5. End with a caring question about their physical state (shoulders, eyes, breath?).
    
    Reply in ${lang} only. Under 80 words. End with a complete sentence.
    `;

    const generationConfig = { temperature: 0.6, maxOutputTokens: 512 };
    const geminiContents = [{ role: 'user', parts: [{ text: prompt }] }];

    try {
        if (llmConfig.provider === 'openrouter') {
            if (!llmConfig.openrouterKey) {
                console.warn('[Journal AI] OpenRouter provider selected but key missing.');
                throw new Error('OpenRouter provider selected but no API Key set.');
            }
            const messages = convertToOpenRouterMessages('', geminiContents);
            const response = await callOpenRouterWithFallback(
                llmConfig.openrouterKey,
                llmConfig.openrouterModel,
                messages,
                generationConfig
            );
            return response || atomMsg("ai_thinking_error");
        }

        const data = await callGeminiBackgroundWithFallback(userKey, prompt, 'journal');
        if (data.error) return atomMsg("ai_thinking_error");
        return data.candidates?.[0]?.content?.parts?.[0]?.text || atomMsg("ai_thinking_error");
    } catch (error) {
        const status = parseGeminiStatus(error);
        const isNetworkError = isNetworkFetchError(error);
        console.warn('[Journal AI] Error', {
            status,
            isNetworkError,
            provider: llmConfig.provider,
            hasGeminiKey,
            hasOpenRouterKey,
            message: String(error?.message || error)
        });
        if ((status === 429 || isNetworkError) && llmConfig.openrouterKey) {
            try {
                console.warn('[Journal AI] Gemini failed. Attempting OpenRouter fallback.');
                const messages = convertToOpenRouterMessages('', geminiContents);
                const response = await callOpenRouterWithFallback(
                    llmConfig.openrouterKey,
                    llmConfig.openrouterModel,
                    messages,
                    generationConfig
                );
                return response || atomMsg("ai_thinking_error");
            } catch (fallbackError) {
                console.warn('[ATOM AI] Journal OpenRouter fallback failed:', fallbackError);
            }
        }

        const randomKey = OFFLINE_QUOTE_KEYS[Math.floor(Math.random() * OFFLINE_QUOTE_KEYS.length)];
        return `(Offline) ${atomMsg(randomKey)}`;
    }
}
// Thêm logic này vào background.js
async function evolveCopyLibrary(logs, reactions) {
    const userKey = await getGeminiKey();
    if (!userKey) return; // Không có key thì không update library

    // Use centralized AI config
    const MODEL_NAME = getModel('PILOT');
    const GEMINI_URL = `${AI_CONFIG.API.BASE_URL}/${MODEL_NAME}:generateContent?key=${userKey}`;

    const effectiveLang = await getEffectiveLanguage();
    const prompt = `
    Based on the user's journal: ${JSON.stringify(logs.slice(-10))}
    And resistance history: ${JSON.stringify(reactions.slice(-10))}
    
    Generate 5 NEW dialogue lines for ATOM.
    
    Guidelines:
    - If user is stressed, use a comforting tone.
    - If user ignores reminders, use a whispering, curiosity-driven tone instead of commanding.
    - Format: Return ONLY a JSON array of strings.
    
    Target Language: ${effectiveLang} (Output strictly in this language).
    `;

    try {
        const result = await callGeminiBackground(
            GEMINI_URL,
            { contents: [{ parts: [{ text: prompt }] }] },
            "copy-library"
        );

        if (result.error) {
            console.error("ATOM: Lỗi khi tạo lời thoại mới từ Gemini", result.error);
            return;
        }

        const text = result.candidates[0].content.parts[0].text;
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const newCopy = JSON.parse(cleanJson);

        await chrome.storage.local.set({ dynamic_copy_library: newCopy });
        console.log("ATOM: Đã cập nhật kho lời thoại mới:", newCopy);
    } catch (e) {
        console.error("ATOM: Lỗi khi tạo lời thoại mới", e);
    }
}

// --- 3. TRUNG TÂM ĐIỀU PHỐI MESSAGE ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // === SRQ Messages — route to dedicated handler ===
    if (request?.type?.startsWith("SRQ_")) {
        handleSrqMessage(request, sender, sendResponse);
        return true; // async response
    }
    // === NLM TOPIC ACTION - Special handling to also save to Memory ===
    if (request?.type === "NLM_TOPIC_ACTION") {
        (async () => {
            try {
                const { action, data = {} } = request;

                // First, let the topic router handle routing logic
                const routerResult = await new Promise((resolve) => {
                    handleTopicRouterMessage(request, resolve);
                });

                // If action is "use" or "create" and we have selection, also save to Memory
                if ((action === "use" || action === "create") && data.selection && data.selection.trim().length > 0) {
                    const quickNote = {
                        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        command: "nlm_quick_save",
                        url: data.sourceUrl || "",
                        title: data.sourceTitle || "",
                        selection: data.selection.trim().substring(0, 5000), // Limit selection size
                        context: `Quick capture from ${data.sourceDomain || "unknown"}`,
                        created_at: Date.now(),
                        source: "floating_button",
                        nlm: {
                            topicKey: data.topicKey,
                            displayTitle: data.displayTitle,
                            notebookRef: data.notebookRef || routerResult?.notebookRef,
                            notebookUrl: data.notebookUrl || routerResult?.notebookUrl,
                            exportStatus: action === "use" ? "manual" : "pending",
                            exportedAt: Date.now()
                        }
                    };

                    await atomAppendReadingNote(quickNote);
                    logNlmEvent("nlm_bridge.quick_save_to_memory", {
                        source: "floating_button",
                        noteId: quickNote.id,
                        action: action,
                        topicKey: data.topicKey
                    });

                    // Trigger Idea Incubator if applicable
                    if (sender?.tab?.id) {
                        await maybeTriggerIdeaIncubator(quickNote, sender.tab.id);
                    }

                    // Add savedToMemory flag to response
                    sendResponse({ ...routerResult, savedToMemory: true, noteId: quickNote.id });
                } else {
                    sendResponse(routerResult);
                }
            } catch (e) {
                console.error("[ATOM] NLM_TOPIC_ACTION error:", e);
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    // === OTHER NLM TOPIC ROUTER MESSAGES ===
    if (request?.type?.startsWith("NLM_TOPIC_")) {
        const handled = handleTopicRouterMessage(request, sendResponse);
        if (handled) return true;
    }

    // === SIDE PANEL - Open from popup ===
    // Note: sidePanel.open() requires user gesture. Messages from content scripts
    // are NOT considered user gestures. This handler is kept for backwards compat
    // but will likely fail. Popup should call sidePanel.open() directly.
    if (request?.type === "ATOM_OPEN_SIDEPANEL") {
        (async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    await chrome.sidePanel.open({ tabId: tab.id });
                    sendResponse({ ok: true });
                } else {
                    sendResponse({ ok: false, error: "No active tab" });
                }
            } catch (e) {
                // Expected to fail when called from content script (not a user gesture)
                // Store a flag so sidepanel knows to open when user manually opens it
                await chrome.storage.local.set({
                    atom_sidepanel_pending_open: {
                        timestamp: Date.now(),
                        source: sender?.tab?.url || 'unknown'
                    }
                });
                console.log("[ATOM] Side panel will open when user clicks extension icon");
                sendResponse({ ok: false, error: "user_gesture_required", hint: "Click extension icon to open side panel" });
            }
        })();
        return true;
    }

    // === SIDE PANEL - Highlight to Chat ===
    if (request?.type === "ATOM_HIGHLIGHT_TO_SIDEPANEL") {
        (async () => {
            try {
                const tabId = sender?.tab?.id;
                const domain = request.payload?.domain || 'unknown';

                // Store highlight for side panel to pick up
                const storageKey = `atom_sidepanel_highlight_${domain}`;
                const { [storageKey]: existingData } = await chrome.storage.local.get([storageKey]);

                const threads = existingData?.threads || [];
                const newThread = {
                    id: `thread_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
                    highlight: request.payload,
                    messages: [],
                    status: 'active', // active | parked | saved
                    createdAt: Date.now()
                };

                threads.push(newThread);

                // Keep only last 50 threads per domain
                const trimmedThreads = threads.slice(-50);

                await chrome.storage.local.set({
                    [storageKey]: {
                        domain,
                        threads: trimmedThreads,
                        updatedAt: Date.now()
                    },
                    // Also set a "pending highlight" for immediate pickup
                    atom_sidepanel_pending_highlight: {
                        ...request.payload,
                        threadId: newThread.id
                    }
                });

                // Try to open side panel (will only work if this is considered user gesture)
                if (tabId) {
                    try {
                        await chrome.sidePanel.open({ tabId });
                    } catch (e) {
                        // Side panel couldn't auto-open, that's ok
                        // User can open it manually
                        console.log("[ATOM] Side panel auto-open not available, highlight stored for later");
                    }
                }

                sendResponse({ ok: true, threadId: newThread.id });
            } catch (e) {
                console.error("[ATOM] Highlight to sidepanel error:", e);
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    // === SIDE PANEL - Save Thread to NotebookLM ===
    if (request?.type === "ATOM_SAVE_THREAD_TO_NLM") {
        (async () => {
            try {
                const note = request.payload?.note || request.payload;
                if (!note) {
                    sendResponse({ ok: false, error: "No note data" });
                    return;
                }

                // Use existing NLM bridge to export (if possible)
                let result = null;
                try {
                    result = await prepareNlmExportFromNote(note);
                } catch (err) {
                    console.error("[ATOM] NLM export error:", err);
                    result = { ok: false, reason: err?.message || "Export failed" };
                }

                const memoryNote = {
                    id: note.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    command: note.command || "sidepanel_export",
                    url: note.url,
                    title: note.title,
                    selection: note.selection,
                    atomicThought: note.atomicThought,
                    aiDiscussionSummary: note.aiDiscussionSummary,
                    refinedInsight: note.refinedInsight,
                    created_at: note.created_at || Date.now(),
                    source: "sidepanel"
                };

                if (result?.ok) {
                    memoryNote.nlm = {
                        notebookRef: result.notebookRef,
                        notebookUrl: result.notebookUrl,
                        exportStatus: "queued",
                        exportedAt: Date.now()
                    };
                    scheduleNlmQueueAlarm();
                }

                await atomAppendReadingNote(memoryNote);

                if (result?.ok) {
                    sendResponse({
                        ok: true,
                        notebookRef: result.notebookRef,
                        notebookUrl: result.notebookUrl,
                        savedToMemory: true
                    });
                } else {
                    const reason = result?.reason || "Export failed";
                    sendResponse({
                        ok: false,
                        error: reason,
                        reason,
                        savedToMemory: true
                    });
                }
            } catch (e) {
                console.error("[ATOM] Save thread to NLM error:", e);
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    // === SIDE PANEL - Upsert Note to Local Memory (no cloud required) ===
    if (request?.type === "ATOM_UPSERT_MEMORY_NOTE") {
        (async () => {
            try {
                const note = request.payload?.note || request.payload;
                if (!note || typeof note !== "object") {
                    sendResponse({ ok: false, error: "No note data" });
                    return;
                }

                const noteId = note.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                const existing = await atomGetReadingNote(noteId);

                const normalized = {
                    ...note,
                    id: noteId,
                    created_at: note.created_at || Date.now()
                };

                if (existing) {
                    await atomUpdateReadingNote(noteId, normalized);
                } else {
                    await atomAppendReadingNote(normalized);
                }

                // If user explicitly upserts a note, treat it as a save trigger for categorization.
                if (!normalized.category || !Array.isArray(normalized.tags) || normalized.tags.length === 0) {
                    enqueueMemoryCategorization(noteId);
                }

                sendResponse({ ok: true, id: noteId });
            } catch (e) {
                console.error("[ATOM] Upsert memory note error:", e);
                sendResponse({ ok: false, error: e.message });
            }
        })();
        return true;
    }

    if (request?.type === "ATOM_DEBUG_PUSH") {
        if (!DEBUG_BUILD_ENABLED) {
            sendResponse?.({ ok: false, disabled: true });
            return true;
        }
        const tabId = sender?.tab?.id ?? request.payload?.tabId;
        atomDebugPush({ ...(request.payload || {}), tabId });
        sendResponse?.({ ok: true });
        return true;
    }

    if (request?.type === "ATOM_DEBUG_GET_STATE") {
        if (!DEBUG_BUILD_ENABLED) {
            sendResponse?.({
                ok: true,
                enabled: false,
                maxEvents: ATOM_DEBUG.maxEvents,
                events: [],
                tabEvents: []
            });
            return true;
        }
        const tabId = request.tabId;
        const tabEvents = typeof tabId === "number" ? (ATOM_DEBUG.byTab.get(tabId) || []) : [];
        sendResponse?.({
            ok: true,
            enabled: ATOM_DEBUG.enabled,
            maxEvents: ATOM_DEBUG.maxEvents,
            events: ATOM_DEBUG.events,
            tabEvents
        });
        return true;
    }

    if (request.type === "FOCUS_TEST_NOTIFICATION") {
        console.log("[ATOM] Manual Test Notification requested.");
        chrome.notifications.create('atom-test-notif', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: "ATOM Test Notification",
            message: "This is a test notification.",
            priority: 2
        }, (id) => {
            if (chrome.runtime.lastError) {
                console.error("[ATOM] Test Notif Error:", chrome.runtime.lastError.message);
                sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            } else {
                console.log("[ATOM] Test Notif created ID:", id);
                sendResponse({ ok: true, id });
            }
        });
        return true;
    }

    // ===== ROUTE FOCUS (Pomodoro) =====
    if (request.type === "FOCUS_GET_STATE") {
        (async () => {
            const st = await loadFocusState();
            sendResponse({ ok: true, atom_focus_state: st });
        })();
        return true;
    }

    if (request.type === "FOCUS_START") {
        (async () => {
            const cfg = await loadFocusConfig();
            const now = Date.now();

            const workMin = Number(request.payload?.workMin ?? cfg.workMin);
            const breakMin = Number(request.payload?.breakMin ?? cfg.breakMin);

            const nextCfg = { ...cfg, workMin, breakMin };
            await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: nextCfg });

            const st = {
                enabled: true,
                sessionId: `${now}_${Math.random().toString(16).slice(2)}`,
                phase: "WORK",
                phaseStartedAt: now,
                phaseEndsAt: now + workMin * 60 * 1000,
                workMin,
                breakMin,
                attempts: {},
                lastAttemptAt: {},
                allowUntil: {},
                allowUsedCount: 0,
                lastStateUpdatedAt: now
            };

            await saveFocusState(st);
            scheduleFocusAlarm(st.phaseEndsAt);
            await broadcastFocusState(st);

            chrome.storage.local.get(['atom_events'], (r) => {
                const cur = r.atom_events || [];
                cur.push({ timestamp: now, event: "FOCUS_START", mode: "FOCUS", context: {} });
                chrome.storage.local.set({ atom_events: cur.slice(-2000) });
            });

            sendResponse({ ok: true, atom_focus_state: st });
        })();
        return true;
    }

    if (request.type === "FOCUS_RESET_PHASE") {
        (async () => {
            const cfg = await loadFocusConfig();
            const st = await loadFocusState();
            const now = Date.now();

            if (!st?.enabled) {
                sendResponse({ ok: false, reason: "NOT_ENABLED" });
                return;
            }

            const isWork = st.phase === "WORK";
            const durationMin = isWork ? cfg.workMin : cfg.breakMin;

            st.phaseStartedAt = now;
            st.phaseEndsAt = now + durationMin * 60 * 1000;
            st.lastStateUpdatedAt = now;

            // Reset counters if restarting a work block
            if (isWork) {
                resetWorkCounters(st);
            }

            await saveFocusState(st);
            scheduleFocusAlarm(st.phaseEndsAt);
            await broadcastFocusState(st);

            // Log event
            chrome.storage.local.get(['atom_events'], (r) => {
                const cur = r.atom_events || [];
                cur.push({ timestamp: now, event: "FOCUS_RESET", mode: "FOCUS", context: { phase: st.phase } });
                chrome.storage.local.set({ atom_events: cur.slice(-2000) });
            });

            console.log(`[ATOM] Focus Phase Reset: ${st.phase} (Reset to ${durationMin}m)`);
            sendResponse({ ok: true, atom_focus_state: st });
        })();
        return true;
    }

    if (request.type === "FOCUS_STOP") {
        (async () => {
            const st = await loadFocusState();
            const now = Date.now();
            chrome.alarms.clear(FOCUS_ALARM_NAME);

            const next = st ? { ...st, enabled: false, lastStateUpdatedAt: now } : { enabled: false };
            await saveFocusState(next);
            await broadcastFocusState(next);

            chrome.storage.local.get(['atom_events'], (r) => {
                const cur = r.atom_events || [];
                cur.push({ timestamp: now, event: "FOCUS_STOP", mode: "FOCUS", context: {} });
                chrome.storage.local.set({ atom_events: cur.slice(-2000) });
            });

            sendResponse({ ok: true, atom_focus_state: next });
        })();
        return true;
    }

    if (request.type === "FOCUS_PAUSE") {
        (async () => {
            const st = await loadFocusState();
            const now = Date.now();
            chrome.alarms.clear(FOCUS_ALARM_NAME);

            if (!st?.enabled) {
                sendResponse({ ok: false, reason: "not_running" });
                return;
            }

            const next = { ...st, enabled: false, paused: true, lastStateUpdatedAt: now };
            await saveFocusState(next);
            await broadcastFocusState(next);

            chrome.storage.local.get(['atom_events'], (r) => {
                const cur = r.atom_events || [];
                cur.push({ timestamp: now, event: "FOCUS_PAUSE", mode: "FOCUS", context: {} });
                chrome.storage.local.set({ atom_events: cur.slice(-2000) });
            });

            sendResponse({ ok: true, atom_focus_state: next });
        })();
        return true;
    }

    if (request.type === "FOCUS_UPDATE_CONFIG") {
        (async () => {
            const cfg = await loadFocusConfig();
            const patch = request.payload || {};
            const next = {
                ...cfg,
                ...patch,
                escalation: { ...cfg.escalation, ...(patch.escalation || {}) }
            };
            await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: next });
            sendResponse({ ok: true, atom_focus_config: next });
        })();
        return true;
    }

    if (request.type === "FOCUS_ALLOW_TEMP") {
        (async () => {
            const cfg = await loadFocusConfig();
            const st = await loadFocusState();
            const now = Date.now();
            const domain = (request.payload?.domain || "").toLowerCase();
            const sec = Number(request.payload?.sec ?? cfg.allowSec);

            if (!st?.enabled || st.phase !== "WORK") {
                sendResponse({ ok: false, reason: "NOT_IN_WORK" });
                return;
            }
            if (st.allowUsedCount >= cfg.allowMaxPerWork) {
                sendResponse({ ok: false, reason: "ALLOW_QUOTA_EXCEEDED" });
                return;
            }

            st.allowUntil = st.allowUntil || {};
            st.allowUntil[domain] = now + sec * 1000;
            st.allowUsedCount = (st.allowUsedCount || 0) + 1;
            st.lastStateUpdatedAt = now;

            await saveFocusState(st);
            await broadcastFocusState(st);

            sendResponse({ ok: true, allowUntil: st.allowUntil[domain], allowUsedCount: st.allowUsedCount });
        })();
        return true;
    }

    if (request.type === "FOCUS_REPORT_ATTEMPT") {
        (async () => {
            const cfg = await loadFocusConfig();
            const st = await loadFocusState();
            const now = Date.now();
            const domain = (request.payload?.domain || "").toLowerCase();

            if (!st?.enabled || st.phase !== "WORK") {
                sendResponse({ ok: false, reason: "NOT_IN_WORK" });
                return;
            }

            st.lastAttemptAt = st.lastAttemptAt || {};
            st.attempts = st.attempts || {};
            const lastAt = st.lastAttemptAt[domain] || 0;

            if (now - lastAt < cfg.attemptCooldownMs) {
                const attempt = st.attempts[domain] || 0;
                console.log(`ATOM FOCUS: Cooldown hit for ${domain}. Left: ${cfg.attemptCooldownMs - (now - lastAt)}ms`);
                sendResponse({ ok: true, attempt, escalation: "NONE" });
                return;
            }

            const attempt = (st.attempts[domain] || 0) + 1;
            st.attempts[domain] = attempt;
            st.lastAttemptAt[domain] = now;
            st.lastStateUpdatedAt = now;

            await saveFocusState(st);
            await broadcastFocusState(st);

            let escalation = "NONE";
            let hardMode = null;

            if (attempt >= cfg.escalation.hardAt) {
                escalation = "HARD";
                hardMode = pickHardMode(cfg, attempt);
            } else if (attempt >= cfg.escalation.microAt) {
                escalation = "MICRO";
            }

            console.log(`ATOM FOCUS: Attempt ${attempt} for ${domain} -> Escalation: ${escalation} (HardMode: ${hardMode})`);

            sendResponse({ ok: true, attempt, escalation, hardMode });
        })();
        return true;
    }

    if (request.type === "FOCUS_ADD_WHITELIST") {
        (async () => {
            const domain = (request.payload?.domain || "").toLowerCase().replace(/^www\./, "");
            const { atom_whitelist } = await chrome.storage.local.get(['atom_whitelist']);
            const list = Array.isArray(atom_whitelist) ? atom_whitelist : DEFAULT_WHITELIST;

            if (!list.includes(domain)) {
                await chrome.storage.local.set({ atom_whitelist: [...list, domain] });
            }
            const st = await loadFocusState();
            if (st?.enabled) await broadcastFocusState(st);

            sendResponse({ ok: true });
        })();
        return true;
    }

    if (request.type === "FOCUS_CLOSE_TAB") {
        const tabId = sender.tab?.id;
        if (tabId) chrome.tabs.remove(tabId);
        sendResponse({ ok: true });
        return true;
    }

    // ROUTE 1: Xử lý TICK (Vòng lặp kiểm soát)
    if (request.type === "TICK") {
        // 1) Log ngay khi nhận tick (để debug chắc chắn)
        console.log("[TICK:IN]", request.payload?.url, request.payload?.continuous_scroll_sec, request.payload?.scroll_px);

        handleTick(request.payload, sender)
            .then((responsePayload) => {
                // 2) Log output để thấy pipeline quyết định gì
                console.log("[TICK:OUT]", responsePayload?.type, responsePayload);
                // --- [ĐOẠN MỚI THÊM VÀO Ở ĐÂY] ---
                // Nếu ATOM quyết định can thiệp (không phải 'none'), hãy bơm CSS ngay lập tức
                if (responsePayload.type !== 'none' && sender.tab?.id) {
                    injectInterventionStyles(sender.tab.id);
                }
                // ---------------------------------
                sendResponse(responsePayload);
            })
            .catch((err) => {
                console.error("[TICK:ERR]", err);
                // Fail-safe: luôn trả response để content.js không bị pending
                sendResponse({ type: "none", payload: {} });
            });

        return true; // Giữ cổng async response cho MV3*/
    }


    // ROUTE 2: (Nhật ký & AI) - ĐÃ CẬP NHẬT CÁ NHÂN HÓA
    // ROUTE 2: (Nhật ký & AI) - ĐÃ CẬP NHẬT HIDDEN EMPATHY (THẤU HIỂU ẨN DỤ)
    if (request.type === "ANALYZE_JOURNAL") {
        chrome.storage.local.get(['journal_logs', 'atom_reactions', 'atom_history'], async function (result) {
            const logs = result.journal_logs || [];
            const reactions = result.atom_reactions || [];
            const history = result.atom_history || [];
            const lastLog = logs[logs.length - 1];

            // 1. Lấy lời khuyên dài cho Journal (Vẫn giữ logic cũ hoặc chuyển sang aiService sau)
            const advice = await askGemini(logs, reactions, history);

            //LƯU LỜI KHUYÊN VÀO DB ---
            const lastLogIndex = logs.length - 1;
            if (lastLogIndex >= 0) {
                // Gắn thêm trường ai_response vào log cuối cùng
                logs[lastLogIndex].ai_response = advice;
                // Lưu ngược lại vào storage ngay lập tức
                await chrome.storage.local.set({ journal_logs: logs });
            }
            // 2. TẠO LỜI NHẮN RIÊNG (FEATURE-BASED & PRIVACY-FIRST)
            // Wrap in try/catch to ensure sendResponse is always called
            try {
                if (lastLog) {
                    const note = lastLog.input.user_note || "";

                    // [UPDATED] Regex song ngữ (Việt + Anh)
                    let detectedTopic = "general";
                    const keywords = {
                        work: /(bệnh viện|trực|mổ|khám|thuốc|work|job|shift|hospital|meeting|deadline)/i,
                        study: /(học|thi|bài|đồ án|study|exam|homework|assignment|class)/i,
                        mood: /(buồn|chán|mệt|cô đơn|sad|tired|lonely|bored|stress|anxious)/i,
                        distraction: /(facebook|tiktok|reels|youtube|scroll|lướt)/i
                    };

                    if (keywords.work.test(note)) detectedTopic = "work";
                    else if (keywords.study.test(note)) detectedTopic = "study";
                    else if (keywords.mood.test(note)) detectedTopic = "mood";
                    else if (keywords.distraction.test(note)) detectedTopic = "distraction";

                    // [UPDATED] Regex tìm địa điểm (Hỗ trợ "at" tiếng Anh và "ở/tại" tiếng Việt)
                    // Match: "at Home", "ở Chợ Rẫy", "tại Cafe"
                    const locMatch = note.match(/(?:ở|tại|at)\s+([A-ZÀ-Ỹa-zA-Z0-9]+(?:\s+[A-ZÀ-Ỹa-zA-Z0-9]+)*)/);
                    const rawLocation = locMatch ? locMatch[1] : null;

                    const features = {
                        sentiment: lastLog.input.user_feeling || "neutral",
                        topic: detectedTopic
                    };

                    const template = await aiService.generateCopy(features);

                    if (template) {
                        // [UPDATED] Dùng chrome.i18n cho các từ điền vào chỗ trống
                        const fallbackAct = detectedTopic === "work"
                            ? atomMsg("fallback_activity_work")
                            : atomMsg("fallback_activity_general");

                        const finalMessage = fillEmpathyTemplate(template, {
                            locationRaw: rawLocation,
                            activityRaw: fallbackAct
                        });

                        await chrome.storage.local.set({
                            'atom_personalized_msg': {
                                text: finalMessage,
                                timestamp: Date.now()
                            }
                        });
                    }
                }
            } catch (personalizeErr) {
                console.warn('[Journal AI] Personalized message generation failed (non-critical):', personalizeErr?.message || personalizeErr);
            }
            sendResponse({ success: true, message: advice });
        });
        return true;
    }

    if (request.type === "LOG_EVENT") {
        const payload = request.payload || {};
        const event = (payload.event || "UNKNOWN").toUpperCase(); // SHOWN, REACTION
        const mode = (payload.mode || "UNKNOWN").toUpperCase(); // BREATH/TAP/...

        // Handle REACTION events for reaction_later logging
        if (event === "REACTION" && payload.intervention_id) {
            // Map reaction types to user_action values per spec
            const reactionType = (payload.reaction || "").toLowerCase();
            let userAction = "none";
            switch (reactionType) {
                case "completed": userAction = "stopped"; break;
                case "dismissed": userAction = "dismissed"; break;
                case "snoozed": userAction = "snoozed"; break;
                case "ignored": userAction = "ignored"; break;
                case "allowed": userAction = "allowed"; break;
                default: userAction = reactionType || "none";
            }

            // Update AI Pilot log with reaction (fire-and-forget)
            updateAiPilotLogReaction(payload.intervention_id, userAction).catch(e => {
                console.warn("[ATOM] Failed to update reaction_later:", e);
            });
        }

        // Cleanup expired pending reactions periodically
        cleanupExpiredPendingReactions();

        // enrich url
        let cleanUrl = "unknown";
        let fullUrlLen = 0;
        try {
            if (sender.tab?.url) {
                cleanUrl = new URL(sender.tab.url).hostname.replace('www.', '');
                fullUrlLen = sender.tab.url.length;
            }
        } catch { }

        const log = {
            timestamp: Date.now(),
            event, // SHOWN, REACTION
            mode,
            intervention_id: payload.intervention_id || null,
            shown_at: payload.shown_at || null,
            reaction: payload.reaction || null,
            context: { url: cleanUrl, url_len: fullUrlLen }
        };

        // ✅ daily rollup (fire-and-forget)
        // ✅ daily rollup (queued) - tránh mất count khi event dồn dập
        enqueueRollupWrite(() => updateDailyRollupFromEvent({
            timestamp: log.timestamp,
            event: log.event,
            mode: log.mode,
            duration_ms: null
        }));


        // ✅ raw events nên lưu riêng, không chung atom_reactions
        chrome.storage.local.get(['atom_events'], (result) => {
            const current = result.atom_events || [];
            const updated = [...current, log].slice(-2000); // analytics giữ nhiều hơn
            chrome.storage.local.set({ atom_events: updated }, () => {
                console.log("[LOG_EVENT]", log);
                sendResponse({ ok: true });
            });
        });

        return true;
    }


    // ROUTE 2.5: GỠ BỎ TRIGGER ẢO (Ghost Trigger Fix)

    if (request.type === "LOG_REACTION") {
        const payload = request.payload || {};
        const interventionId = payload.intervention_id;
        const action = payload.action; // "COMPLETED", "IGNORED", ...

        if (interventionId) {
            // Map legacy action to user_action
            let userAction = "none";
            const rawAction = (action || "").toLowerCase();
            switch (rawAction) {
                case "completed": userAction = "stopped"; break;
                case "dismissed": userAction = "dismissed"; break;
                case "snoozed": userAction = "snoozed"; break;
                case "ignored": userAction = "ignored"; break;
                case "allowed": userAction = "allowed"; break; // if any
                default: userAction = rawAction;
            }

            updateAiPilotLogReaction(interventionId, userAction).catch(e => {
                console.warn("[ATOM] Failed to update reaction_later via LOG_REACTION:", e);
            });
        }

        sendResponse({ ok: true });
        return true;
    }

    if (request.type === "ATOM_SAVE_READING_NOTE") {
        (async () => {
            try {
                const note = request.payload?.note;
                if (!note || !note.id) {
                    sendResponse({ ok: false, saved: false });
                    return;
                }

                const KEY = "atom_reading_notes";
                const { [KEY]: current } = await chrome.storage.local.get([KEY]);
                const list = Array.isArray(current) ? current : [];

                // Check by ID first
                let exists = list.some((item) => item?.id === note.id);
                let existingNoteId = exists ? note.id : null;

                // Content-based dedupe: check URL + selection if no ID match
                if (!exists && note.url && note.selection) {
                    const contentMatch = list.find(item =>
                        item?.url === note.url &&
                        item?.selection?.trim() === note.selection.trim()
                    );
                    if (contentMatch) {
                        exists = true;
                        existingNoteId = contentMatch.id;
                        note.id = contentMatch.id;  // Use existing ID
                        console.log("[ATOM] Content dedupe: found existing note", existingNoteId);
                    }
                }

                let nlmResponse = null;
                let nlmMeta = null;

                try {
                    logNlmEvent("nlm_bridge.export_attempt", { source: "save_button", noteId: note.id, url: note.url });
                    const nlmResult = await prepareNlmExportFromNote(note);
                    if (nlmResult && nlmResult.ok) {
                        const suggestedQuestion = buildSuggestedQuestion(note);
                        await markDedupeHit(nlmResult.job?.dedupeKey);
                        nlmMeta = {
                            notebookRef: nlmResult.notebookRef,
                            notebookUrl: nlmResult.notebookUrl,
                            exportStatus: "queued",
                            exportedAt: Date.now(),
                            dedupeKey: nlmResult.job?.dedupeKey,
                            jobId: nlmResult.job?.jobId,
                            suggestedQuestion
                        };
                        nlmResponse = {
                            clipText: nlmResult.clipText,
                            notebookUrl: nlmResult.notebookUrl,
                            notebookRef: nlmResult.notebookRef,
                            suggestedQuestion,
                            jobId: nlmResult.job?.jobId || ""
                        };
                        scheduleNlmQueueAlarm();
                        logNlmEvent("nlm_bridge.export_success", { source: "save_button", noteId: note.id, notebookRef: nlmResult.notebookRef });
                    } else if (nlmResult && nlmResult.reason === "pii_warning") {
                        const pending = await createPendingNlmJob(note, nlmResult, sender.tab?.id, sender.tab?.url);
                        nlmMeta = {
                            notebookRef: nlmResult.notebookRef,
                            notebookUrl: nlmResult.notebookUrl,
                            exportStatus: "pending_pii",
                            exportedAt: Date.now(),
                            dedupeKey: nlmResult.dedupeKey,
                            jobId: pending.jobId,
                            suggestedQuestion: pending.suggestedQuestion
                        };
                        nlmResponse = {
                            reason: "pii_warning",
                            jobId: pending.jobId,
                            nonce: pending.nonce,
                            piiSummary: nlmResult.piiSummary || { types: [], count: 0 },
                            suggestedQuestion: pending.suggestedQuestion
                        };
                        logNlmEvent("nlm_bridge.export_failed", { source: "save_button", noteId: note.id, reason: "pii_warning" });
                    } else if (nlmResult && !nlmResult.ok) {
                        nlmResponse = { error: nlmResult.reason };
                        logNlmEvent("nlm_bridge.export_failed", { source: "save_button", noteId: note.id, reason: nlmResult.reason });
                    }
                } catch (e) {
                    nlmResponse = { error: "export_failed" };
                    logNlmEvent("nlm_bridge.export_failed", { source: "save_button", noteId: note.id, reason: "error" });
                }

                if (!exists) {
                    const nextNote = nlmMeta ? { ...note, nlm: nlmMeta } : note;
                    const next = [...list, nextNote].slice(-200);
                    await chrome.storage.local.set({ [KEY]: next });
                    await maybeTriggerIdeaIncubator(nextNote, sender.tab?.id);
                } else if (nlmMeta) {
                    await atomUpdateReadingNote(note.id, { nlm: nlmMeta });
                    const refreshed = await atomGetReadingNote(note.id);
                    await maybeTriggerIdeaIncubator(refreshed || note, sender.tab?.id);
                }

                sendResponse({ ok: true, saved: true, existed: exists, nlm: nlmResponse });
            } catch (e) {
                console.error("ATOM save reading note error:", e);
                sendResponse({ ok: false, saved: false });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_READING_SAVE_ANSWERS") {
        (async () => {
            try {
                const noteId = request.payload?.noteId;
                const answers = Array.isArray(request.payload?.answers) ? request.payload.answers : [];
                if (!noteId) {
                    sendResponse({ ok: false });
                    return;
                }
                await atomUpdateReadingNote(noteId, { answers });
                sendResponse({ ok: true });
            } catch (e) {
                console.error("ATOM save reading answers error:", e);
                sendResponse({ ok: false });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_READING_EVAL") {
        (async () => {
            try {
                const noteId = request.payload?.noteId;
                const questions = Array.isArray(request.payload?.questions) ? request.payload.questions : [];
                const answers = Array.isArray(request.payload?.answers) ? request.payload.answers : [];
                if (!noteId) {
                    sendResponse({ ok: false });
                    return;
                }
                const note = await atomGetReadingNote(noteId);
                if (!note) {
                    sendResponse({ ok: false });
                    return;
                }
                await atomUpdateReadingNote(noteId, { answers, questions });
                const evaluation = await atomEvaluateReadingAnswers({ note, questions, answers });
                await atomUpdateReadingNote(noteId, { evaluation, answers, questions });
                if (sender.tab?.id) {
                    await sendReadingEvalResult(sender.tab.id, { noteId, evaluation });
                }
                sendResponse({ ok: true });
            } catch (e) {
                const msg = String(e?.message || e);
                const errorSummary = atomMsg("reading_error_summary")
                    || "ATOM hit an error analyzing this selection. Please try again.";
                if (msg.includes("429")) {
                    const until = startReadingCooldownWithBackoff(READING_COOLDOWN_MS);
                    console.warn("ATOM Reading eval rate limit; cooldown until", until);
                }
                console.error("ATOM reading evaluation error:", e);
                if (sender.tab?.id && request.payload?.noteId) {
                    await sendReadingEvalResult(sender.tab.id, {
                        noteId: request.payload.noteId,
                        evaluation: errorSummary
                    });
                }
                sendResponse({ ok: false });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_GENERATE_QUESTION") {
        (async () => {
            try {
                const noteId = request.payload?.noteId;
                if (!noteId) {
                    sendResponse({ ok: false, reason: "missing_note" });
                    return;
                }
                const note = await atomGetReadingNote(noteId);
                if (!note) {
                    sendResponse({ ok: false, reason: "not_found" });
                    return;
                }
                const payload = {
                    selection: note.selection || "",
                    summary: note?.result?.summary || "",
                    title: note.title || ""
                };
                const result = await aiService.generateReadingQuestion(payload);
                const question = (result && typeof result.question === "string") ? result.question.trim() : "";
                if (!question) {
                    sendResponse({ ok: false, reason: "empty" });
                    return;
                }
                const nextNlm = {
                    ...(note.nlm || {}),
                    suggestedQuestion: question
                };
                await atomUpdateReadingNote(noteId, { nlm: nextNlm });
                sendResponse({ ok: true, question });
            } catch (e) {
                const msg = String(e?.message || e);
                console.error("ATOM NLM generate question error:", e);
                sendResponse({ ok: false, reason: msg.includes("API Error 400") ? "api_400" : "error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_OPEN_NOTEBOOK") {
        (async () => {
            try {
                const url = request.payload?.url;
                if (!url || typeof url !== "string") {
                    sendResponse({ ok: false });
                    return;
                }
                await chrome.tabs.create({ url });
                if (request.payload?.source === "vault") {
                    logNlmEvent("nlm_bridge.open_to_recall", { source: "vault", url });
                }
                sendResponse({ ok: true });
            } catch (e) {
                console.error("ATOM open NotebookLM error:", e);
                sendResponse({ ok: false });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_IDEA_ACTION") {
        (async () => {
            try {
                const action = request.payload?.action || "";
                const topicKey = request.payload?.topicKey || "";
                const displayTitle = request.payload?.displayTitle || "";
                const keywords = Array.isArray(request.payload?.keywords) ? request.payload.keywords : [];
                const context = request.payload?.context || {};

                if (!topicKey) {
                    sendResponse({ ok: false, reason: "missing_topic" });
                    return;
                }

                if (action === "open") {
                    const settings = await loadNlmSettings();
                    const target = settings?.baseUrl || "https://notebooklm.google.com";
                    await chrome.tabs.create({ url: target });
                    sendResponse({ ok: true });
                    return;
                }

                if (action === "create") {
                    const suggestions = await loadIdeaSuggestions();
                    const match = suggestions.find((s) => s?.topicKey === topicKey) || {};
                    const finalTitle = match.displayTitle || displayTitle || topicKey;
                    const finalKeywords = match.keywords || keywords || [];
                    const finalContext = match.context || context || {};

                    await setPendingTopic({
                        topicKey,
                        displayTitle: finalTitle,
                        keywords: finalKeywords,
                        context: {
                            url: finalContext.url || "",
                            title: finalContext.title || "",
                            domain: finalContext.domain || "",
                            selection: finalContext.selection || ""
                        }
                    });

                    await updateIdeaSuggestionStatus(topicKey, "accepted", { acceptedAt: Date.now() });
                    logNlmEvent("nlm_bridge.idea_incubator_created", { source: "idea_prompt", topicKey, displayTitle: finalTitle });
                    sendResponse({ ok: true });
                    return;
                }

                if (action === "dont_ask") {
                    await recordIdeaDismiss(topicKey, "dont_ask");
                    await updateIdeaSuggestionStatus(topicKey, "muted", { dismissedAt: Date.now() });
                    sendResponse({ ok: true });
                    return;
                }

                if (action === "not_now" || action === "dismiss") {
                    await recordIdeaDismiss(topicKey, "not_now");
                    await updateIdeaSuggestionStatus(topicKey, "dismissed", { dismissedAt: Date.now() });
                    sendResponse({ ok: true });
                    return;
                }

                sendResponse({ ok: false, reason: "unknown_action" });
            } catch (e) {
                console.error("ATOM NLM idea action error:", e);
                sendResponse({ ok: false, reason: "error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_EXPORT_RESULT") {
        (async () => {
            try {
                const jobId = request.payload?.jobId;
                const status = request.payload?.status;
                const error = request.payload?.error || "";
                if (!jobId || !status) {
                    sendResponse({ ok: false, reason: "invalid_payload" });
                    return;
                }

                if (status === "success") {
                    const job = await updateJob(jobId, {
                        status: "success",
                        lastError: "",
                        nextAttemptAt: null
                    });
                    await dequeueJob(jobId);
                    if (job?.bundleId) {
                        await updateNlmNoteStatus(job.bundleId, {
                            nlm: {
                                exportStatus: "success",
                                lastError: "",
                                attempts: job.attempts || 0,
                                updatedAt: Date.now()
                            }
                        });
                    }
                    await scheduleNlmQueueAlarm();
                    sendResponse({ ok: true });
                    return;
                }

                const job = await updateJob(jobId, { lastError: error || "export_failed" });
                if (!job) {
                    sendResponse({ ok: false, reason: "not_found" });
                    return;
                }

                await markNlmNeedsUserAction(job, error || "export_failed");
                await scheduleNlmQueueAlarm();
                sendResponse({ ok: true });
            } catch (e) {
                console.error("ATOM NLM export result error:", e);
                sendResponse({ ok: false, reason: "error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_RETRY_NOW") {
        (async () => {
            try {
                const jobId = request.payload?.jobId || "";
                const noteId = request.payload?.noteId || "";
                let job = null;

                if (jobId) {
                    const queue = await loadExportQueue();
                    job = queue.find((item) => item?.jobId === jobId) || null;
                }

                let note = null;
                if (job?.bundleId) {
                    note = await atomGetReadingNote(job.bundleId);
                } else if (noteId) {
                    note = await atomGetReadingNote(noteId);
                }

                if (!note) {
                    sendResponse({ ok: false, reason: "missing_note" });
                    return;
                }

                let notebookRef = job?.notebookRef || note?.nlm?.notebookRef || "";

                if (!job) {
                    const settings = await loadNlmSettings();
                    const bundle = buildReadingBundle(note, settings);
                    if (!bundle) {
                        sendResponse({ ok: false, reason: "missing_bundle" });
                        return;
                    }
                    notebookRef = notebookRef || settings.defaultNotebookRef || "Inbox";
                    const dedupeKey = await buildDedupeKey({
                        url: bundle.url,
                        selectedText: bundle.selectedText || bundle.viewportExcerpt,
                        notebookRef,
                        capturedAt: bundle.capturedAt
                    });
                    job = createExportJob({ bundleId: note.id, notebookRef, dedupeKey });
                    await enqueueExportJob(job);
                    await scheduleNlmQueueAlarm();
                }

                const retryPayload = await buildNlmRetryPayload(note, notebookRef, null, job?.jobId || "");
                if (!retryPayload?.ok) {
                    sendResponse({ ok: false, reason: retryPayload?.reason || "build_failed" });
                    return;
                }

                sendResponse({ ok: true, nlm: retryPayload });
            } catch (e) {
                console.error("ATOM NLM retry error:", e);
                sendResponse({ ok: false, reason: "error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_EXPORT_CONFIRM") {
        (async () => {
            try {
                const note = request.payload?.note;
                if (!note || !note.id) {
                    sendResponse({ ok: false, error: "invalid_note" });
                    return;
                }

                // Call with bypassPii = true
                const nlmResult = await prepareNlmExportFromNote(note, true);
                let nlmResponse = null;

                if (nlmResult && nlmResult.ok) {
                    await markDedupeHit(nlmResult.job?.dedupeKey);

                    const nlmMeta = {
                        notebookRef: nlmResult.notebookRef,
                        exportStatus: "queued",
                        exportedAt: Date.now(),
                        dedupeKey: nlmResult.job?.dedupeKey,
                        jobId: nlmResult.job?.jobId
                    };

                    nlmResponse = {
                        clipText: nlmResult.clipText,
                        notebookUrl: nlmResult.notebookUrl,
                        notebookRef: nlmResult.notebookRef,
                        jobId: nlmResult.job?.jobId || ""
                    };

                    // Update the note in storage with the new NLM status
                    await atomUpdateReadingNote(note.id, { nlm: nlmMeta });
                    scheduleNlmQueueAlarm();
                } else if (nlmResult && !nlmResult.ok) {
                    nlmResponse = { error: nlmResult.reason };
                }

                sendResponse({ ok: true, nlm: nlmResponse });
            } catch (e) {
                console.error("ATOM NLM Export Confirm Error:", e);
                sendResponse({ ok: false, error: "unexpected_error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_EXPORT_CONFIRM") {
        (async () => {
            try {
                const jobId = request.payload?.jobId;
                const nonce = request.payload?.nonce;
                if (!jobId || !nonce) {
                    sendResponse({ ok: false, reason: "missing_job" });
                    return;
                }
                const job = await takePendingJob(jobId);
                if (!job) {
                    sendResponse({ ok: false, reason: "not_found" });
                    return;
                }
                if (isJobExpired(job)) {
                    sendResponse({ ok: false, reason: "expired" });
                    return;
                }
                if (job.nonce !== nonce) {
                    sendResponse({ ok: false, reason: "nonce_mismatch" });
                    return;
                }
                if (job.tabId && sender.tab?.id && job.tabId !== sender.tab.id) {
                    sendResponse({ ok: false, reason: "tab_mismatch" });
                    return;
                }
                const senderHost = extractHost(sender.tab?.url || "");
                if (job.originHost && senderHost && job.originHost !== senderHost) {
                    sendResponse({ ok: false, reason: "origin_mismatch" });
                    return;
                }

                await markDedupeHit(job.dedupeKey);
                if (job.bundleId) {
                    await atomUpdateReadingNote(job.bundleId, {
                        nlm: {
                            notebookRef: job.notebookRef,
                            notebookUrl: job.notebookUrl || "",
                            exportStatus: "confirmed",
                            exportedAt: Date.now(),
                            dedupeKey: job.dedupeKey,
                            jobId: job.jobId,
                            suggestedQuestion: job.suggestedQuestion || ""
                        }
                    });
                }
                logNlmEvent("nlm_bridge.export_success", { source: "pii_confirm", noteId: job.bundleId, notebookRef: job.notebookRef });

                sendResponse({
                    ok: true,
                    clipText: job.clipText || "",
                    notebookUrl: job.notebookUrl || "",
                    notebookRef: job.notebookRef || "",
                    suggestedQuestion: job.suggestedQuestion || ""
                });
            } catch (e) {
                console.error("ATOM NLM confirm error:", e);
                sendResponse({ ok: false, reason: "error" });
            }
        })();
        return true;
    }

    if (request.type === "ATOM_NLM_EXPORT_CANCEL") {
        (async () => {
            try {
                const jobId = request.payload?.jobId;
                if (!jobId) {
                    sendResponse({ ok: false, reason: "missing_job" });
                    return;
                }
                const job = await takePendingJob(jobId);
                if (job?.bundleId) {
                    await atomUpdateReadingNote(job.bundleId, {
                        nlm: {
                            notebookRef: job.notebookRef || "",
                            notebookUrl: job.notebookUrl || "",
                            exportStatus: "blocked",
                            exportedAt: Date.now(),
                            dedupeKey: job.dedupeKey || "",
                            jobId: job.jobId || "",
                            suggestedQuestion: job.suggestedQuestion || ""
                        }
                    });
                }
                logNlmEvent("nlm_bridge.export_failed", { source: "pii_cancel", noteId: job?.bundleId, reason: "user_cancel" });
                sendResponse({ ok: true });
            } catch (e) {
                console.error("ATOM NLM cancel error:", e);
                sendResponse({ ok: false, reason: "error" });
            }
        })();
        return true;
    }

    if (request.type === "INTERVENTION_ABORTED") {
        const abortedUrl = request.payload?.url || "unknown";
        console.log("ATOM: Handling Aborted Intervention for", abortedUrl);

        chrome.storage.local.get(['atom_reactions'], (result) => {
            const current = result.atom_reactions || [];
            if (current.length === 0) return;

            // Tìm log TRIGGERED gần nhất (trong 15s) của loại MICRO_CLOSURE
            const CUTOFF_MS = 15000;
            const now = Date.now();

            // Tìm từ cuối lên (gần nhất)
            // [RISK 2 FIX] Chỉ xóa nếu mode là MICRO_CLOSURE
            const index = current.findLastIndex(r =>
                r.event === 'TRIGGERED' &&
                r.mode === 'MICRO_CLOSURE' &&
                (now - r.timestamp < CUTOFF_MS)
            );

            if (index !== -1) {
                console.log(`ATOM: Removing ghost trigger at index ${index} (Timestamp: ${current[index].timestamp})`);
                current.splice(index, 1);
                chrome.storage.local.set({ atom_reactions: current });
            } else {
                console.warn("ATOM: Could not find trigger to abort.");
            }
        });
        return true;
    }



    // ROUTE 3: Ghi nhận phản kháng & Cập nhật AI (Optimized V4.1)
    if (request.type === "LOG_REACTION") {
        const rawAction = request.payload.action || "UNKNOWN";
        const action = rawAction.toUpperCase();
        const rawMode = request.payload.type || "UNKNOWN";
        const mode = rawMode.toUpperCase();

        // 1. Xử lý Snooze logic (Logic nghiệp vụ giữ nguyên)
        let newSnoozeTime = 0;
        if (action === "SNOOZED") {
            newSnoozeTime = Date.now() + 60000;
            console.log("ATOM: Snoozed by User (60s)");
        } else if (action === "COMPLETED" && mode === "MICRO_CLOSURE") {
            newSnoozeTime = Date.now() + 30000;
            console.log("ATOM: Grace period for closure (30s)");
        }

        // --- [NEW] Post-hard cooldown: sau khi hoàn thành hard interrupt thì im lặng 3-5 phút ---
        const kind = (request.payload?.kind || "").toUpperCase();

        if (action === "COMPLETED" && kind === "HARD_INTERRUPT") {
            const ms = 3 * 60 * 1000; // 3 phút (bạn có thể tăng 5 phút nếu vẫn bị spam)
            newSnoozeTime = Math.max(newSnoozeTime, Date.now() + ms);
            console.log(`ATOM: Post-hard cooldown (${ms}ms)`);
        }

        // Cập nhật biến Snooze
        if (newSnoozeTime > 0) {
            snoozeUntil = newSnoozeTime;
            chrome.storage.local.set({ snoozeUntil: newSnoozeTime });
        }

        // --- 2. ENRICHMENT & ELASTICITY (Single-Get Block) ---
        // [FIX QUAN TRỌNG]: Đọc storage MỘT LẦN cho cả việc tính toán và ghi log
        chrome.storage.local.get(['atom_reactions', 'user_sensitivity'], (result) => {
            const currentReactions = result.atom_reactions || [];
            const sensitivity = result.user_sensitivity || 'balanced';

            // A. Tính toán Stats hiện tại (Snapshot trước khi log mới)
            const stats = computeEscalationStats(currentReactions, 30);

            // B. Chuẩn bị Streak cho Elasticity
            // Nếu hành động là tiêu cực, Streak phạt phải là (quá khứ + 1) để AI phạt đúng lúc
            // [UPDATED] Thêm IGNORED_PASSIVE, loại AUTO_DISMISSED
            const isNegativeAction = ['IGNORED', 'DISMISSED', 'IGNORED_BY_SCROLL', 'IGNORED_PASSIVE'].includes(action);
            const streakForPenalty = isNegativeAction ? (stats.ignoredStreak + 1) : 0;

            // C. Gọi Update Elasticity (Async - Fire & Forget nhưng có catch)
            // Lưu ý: Hàm này dùng config V4.1 mới
            updateElasticMultiplier(action, streakForPenalty).catch(err => console.warn("Elastic update failed", err));

            // D. Chuẩn bị Log Object cho AI (AI-Ready Data V2)
            let cleanUrl = "unknown";
            let fullUrlLen = 0;
            try {
                if (sender.tab?.url) {
                    cleanUrl = new URL(sender.tab.url).hostname.replace('www.', '');
                    fullUrlLen = sender.tab.url.length;
                }
            } catch (e) { }

            const aiReadyLog = {
                timestamp: Date.now(),
                event: action,
                mode: mode,

                intervention_id: request.payload?.intervention_id || null,
                shown_at: request.payload?.shown_at || null,
                reacted_at: request.payload?.reacted_at || null,
                duration_ms: request.payload?.duration_ms || null,

                context: { url: cleanUrl, url_len: fullUrlLen },
                user_state: {
                    sensitivity: sensitivity,
                    resistance_score: stats.resistanceScore, // Score lúc ra quyết định
                    streak_before: stats.ignoredStreak,      // Streak cũ (trước hành động này)
                    streak_after: isNegativeAction ? (stats.ignoredStreak + 1) : 0 // Streak mới (hệ quả)
                }
            };
            // ✅ daily rollup (fire-and-forget)
            // ✅ daily rollup (queued) - tránh race condition khi nhiều reaction liên tiếp
            enqueueRollupWrite(() => updateDailyRollupFromEvent({
                timestamp: aiReadyLog.timestamp,
                event: aiReadyLog.event,
                mode: aiReadyLog.mode,
                duration_ms: aiReadyLog.duration_ms
            }));



            const updatedReactions = [...currentReactions, aiReadyLog].slice(-50);

            chrome.storage.local.set({ atom_reactions: updatedReactions }, () => {
                // Debug Log (chạy sau khi save xong)
                if (typeof DEBUG_PIPELINE !== 'undefined' && DEBUG_PIPELINE) {
                    console.log("[LOG:AI]", aiReadyLog);
                }

                // ACK về content.js (để bạn thấy COMPLETE/IGNORED có phản hồi)
                sendResponse({ ok: true, saved: true });
            });
        });
        return true;
    }
});
// --- HELPER MỚI: TÍNH ĐIỂM KHÁNG CỰ & LEO THANG ---
// background.js - Updated Helper

function computeEscalationStats(reactions, windowMinutes = 30) {
    if (!reactions || reactions.length === 0) {
        return { resistanceScore: 0, lastHardTs: 0, hardCooldownOk: true, triggeredCount: 0, ignoredStreak: 0 };
    }

    const now = Date.now();
    const windowStart = now - (windowMinutes * 60 * 1000);

    // 1. Lọc các event trong cửa sổ thời gian
    const recentEvents = reactions
        .filter(r => r.timestamp >= windowStart)
        .sort((a, b) => a.timestamp - b.timestamp);

    let resistanceScore = 0;
    let lastHardTs = 0;
    let triggeredCount = 0;
    let ignoredStreak = 0;

    // [MỚI] Biến theo dõi lần cuối cùng ATOM can thiệp để tính Decay
    let lastTriggerTime = windowStart;

    // 2. Duyệt để tính điểm cơ bản
    for (const r of recentEvents) {
        // --- XỬ LÝ SỰ KIỆN TRIGGER ---
        if (r.event === 'TRIGGERED') {
            triggeredCount++;
            lastTriggerTime = Math.max(lastTriggerTime, r.timestamp); // Cập nhật mốc thời gian trigger cuối

            if ((r.mode || '').toUpperCase() === 'HARD_INTERRUPT') lastHardTs = r.timestamp;

        }

        // --- XỬ LÝ PHẢN ỨNG ---
        else if (r.event === 'IGNORED' || r.event === 'DISMISSED') {
            resistanceScore += 2;
            ignoredStreak++;
        }
        else if (r.event === 'IGNORED_PASSIVE') {
            resistanceScore += 1;
            ignoredStreak++;
        }
        else if (r.event === 'AUTO_DISMISSED') {
            // 0 điểm, không tăng streak
        }
        else if (r.event === 'SNOOZED') {
            resistanceScore += 1;
            ignoredStreak = 0;
        }
        else if (r.event === 'COMPLETED' || r.event === 'ACCEPTED') {
            resistanceScore -= 3;
            ignoredStreak = 0;
        }
    }

    // 3. [MỚI] LOGIC DECAY (HẠ NHIỆT THEO THỜI GIAN)
    // Nếu user "ngoan" (không bị trigger) trong một khoảng thời gian, hãy giảm điểm kháng cự
    const minutesSinceLastTrigger = (now - lastTriggerTime) / (60 * 1000);

    if (minutesSinceLastTrigger >= 10) {
        // Cứ mỗi 10 phút yên lặng -> Trừ 1 điểm
        const decayPoints = Math.floor(minutesSinceLastTrigger / 10);
        resistanceScore -= decayPoints;
        // console.log(`ATOM Decay: User yên lặng ${minutesSinceLastTrigger.toFixed(1)}p -> Giảm ${decayPoints} điểm kháng cự.`);
    }

    // 4. Chuẩn hóa kết quả (Kẹp từ 0 đến 10)
    resistanceScore = Math.max(0, Math.min(resistanceScore, 10));

    // Kiểm tra Cooldown (15 phút) cho Hard Interrupt
    const timeSinceLastHard = now - lastHardTs;
    const hardCooldownOk = (lastHardTs === 0) || (timeSinceLastHard > 15 * 60 * 1000);

    return {
        resistanceScore,
        lastHardTs,
        hardCooldownOk,
        triggeredCount,
        ignoredStreak
    };
}


// Cấu hình độ đàn hồi
// --- CONFIG ELASTICITY & HELPER ---

const ELASTIC_CONFIG = {
    DEFAULT: 1.0,
    MIN: 0.8,
    MAX: 2.5,

    // Phạt (Momentum)
    PENALTY_BASE: 0.15,
    PENALTY_STREAK: 0.05,

    // Thưởng
    REWARD_BASE: 0.10,

    // Tha thứ (Decay)
    DECAY_RATE_PER_HOUR: 0.05
};

/**
 * Cập nhật hệ số đàn hồi dựa trên hành vi (V4.1 Optimized)
 * @param {string} reactionType - COMPLETED, IGNORED, SNOOZED...
 * @param {number} currentStreak - Streak tính toán (đã +1 nếu là negative)
 */
async function updateElasticMultiplier(reactionType, currentStreak = 0) {
    // 1. Chỉ đọc những gì cần thiết (tiết kiệm IO)
    const data = await chrome.storage.local.get(['adaptive_multiplier', 'last_elastic_update']);

    let multiplier = data.adaptive_multiplier ?? ELASTIC_CONFIG.DEFAULT;
    const lastUpdate = data.last_elastic_update ?? Date.now();
    const now = Date.now();

    // --- A. TIME DECAY (Mean-reversion bậc thang) ---
    const hoursPassed = (now - lastUpdate) / (1000 * 60 * 60);
    if (hoursPassed >= 1) {
        const decayAmount = Math.floor(hoursPassed) * ELASTIC_CONFIG.DECAY_RATE_PER_HOUR;

        if (multiplier > 1.0) multiplier = Math.max(1.0, multiplier - decayAmount);
        else if (multiplier < 1.0) multiplier = Math.min(1.0, multiplier + decayAmount);
    }

    const prev = multiplier;

    // --- B. MOMENTUM (Thưởng phạt có quán tính) ---
    // Lưu ý: reactionType ở đây nhận từ message (đã chuẩn hóa thành COMPLETED/IGNORED...)
    // [UPDATED] Thêm IGNORED_PASSIVE
    if (['IGNORED', 'DISMISSED', 'IGNORED_BY_SCROLL', 'IGNORED_PASSIVE'].includes(reactionType)) {
        // Streak đã được xử lý +1 ở bên ngoài -> Tính toán chính xác
        const dynamicPenalty = ELASTIC_CONFIG.PENALTY_BASE + (ELASTIC_CONFIG.PENALTY_STREAK * currentStreak);
        multiplier += dynamicPenalty;
    }
    else if (['ACCEPTED', 'COMPLETED'].includes(reactionType)) {
        multiplier -= ELASTIC_CONFIG.REWARD_BASE;
        // Bonus: Nếu user đang bị siết quá chặt (>2.0), thưởng thêm để khích lệ
        if (multiplier > 2.0) multiplier -= 0.1;
    }
    // SNOOZED: Giữ nguyên (Neutral strategy)

    // --- C. CLAMP (Vùng an toàn) ---
    multiplier = Math.min(Math.max(multiplier, ELASTIC_CONFIG.MIN), ELASTIC_CONFIG.MAX);
    multiplier = Math.round(multiplier * 100) / 100;

    // 2. Write-back
    await chrome.storage.local.set({
        adaptive_multiplier: multiplier,
        last_elastic_update: now
    });

    console.log(`%c[ELASTIC] ${reactionType} (Streak=${currentStreak}) | ${prev} -> ${multiplier}`, "color: #A7F3D0; font-weight: bold;");

    return multiplier;
}
// --- [NEW] HÀM SỬ DỤNG QUYỀN SCRIPTING (HELPER) ---
// Hàm này giúp ATOM "bắn" lại CSS vào trang web để đảm bảo giao diện chặn không bị vỡ
async function injectInterventionStyles(tabId) {
    try {
        await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ["styles.css"] // Đảm bảo styles.css luôn được ưu tiên
        });
        // console.log("ATOM: Dynamic CSS injected via Scripting API");
    } catch (err) {
        // Bỏ qua lỗi nếu không inject được (ví dụ tab settings hoặc trang chrome://)
        // console.warn("ATOM Scripting Error:", err);
    }
}
// background.js - Helper xử lý Thấu hiểu ẩn dụ

/**
 * Biến template của AI thành tin nhắn hoàn chỉnh
 * @param {string} template - Vd: "Ở {location} áp lực lắm phải không?"
 * @param {Object} rawContext - Dữ liệu thô từ máy (chưa qua lọc)
 */
function fillEmpathyTemplate(template, rawContext) {
    if (!template) return "";
    let message = template;

    // [UPDATED] Fallback dùng i18n
    const defaultLocation = atomMsg("fallback_location"); // "nơi này" hoặc "this place"

    const locationName = rawContext.locationRaw || defaultLocation;
    message = message.replace(/\{location\}/gi, locationName);

    const activityName = rawContext.activityRaw || "activity"; // Fallback cứng này ít khi dùng vì bên trên đã truyền vào rồi
    message = message.replace(/\{activity\}/gi, activityName);

    return message;
}

// --- 5. ENFORCE FOCUS ON TAB ACTIVATE (SAFE SEND PING) ---
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (!tab || !tab.url) return;

        // Ignore internal pages
        if (tab.url.startsWith("chrome://") ||
            tab.url.startsWith("edge://") ||
            tab.url.startsWith("about:") ||
            tab.url.startsWith("chrome-extension://")) {
            return;
        }

        const state = await loadFocusState();
        // Check if Focus is enabled and in WORK phase
        if (state && state.enabled && state.phase === "WORK") {
            try {
                // Safe send: ignore if content script not ready
                chrome.tabs.sendMessage(activeInfo.tabId, { type: "ATOM_FOCUS_PING" }, () => {
                    if (chrome.runtime.lastError) {
                        // Content script not ready or not injected - acceptable, ignore.
                    }
                });
            } catch (e) {
                // Ignore errors
            }
        }
    } catch (err) {
        // Tab closed or other error
    }
});


// ===== NLM LOG EVENT HANDLER (for Memory page) =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NLM_LOG_EVENT') {
        const { event, context } = message;
        if (event && typeof logNlmEvent === 'function') {
            logNlmEvent(event, context || {});
        }
        sendResponse({ ok: true });
        return false;
    }
});

// ===== QUOTA & UPDATE STATUS HANDLERS (Phase 1 Monetization) =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ATOM_GET_QUOTA_STATUS') {
        getQuotaDisplayStatus().then(status => sendResponse(status)).catch(e => {
            console.warn('[Quota] Status error:', e);
            sendResponse({ error: e.message });
        });
        return true; // async
    }
    if (message.type === 'ATOM_INCREMENT_QUOTA') {
        incrementQuota().then(count => sendResponse({ count })).catch(e => {
            sendResponse({ error: e.message });
        });
        return true; // async
    }
    if (message.type === 'ATOM_CHECK_QUOTA') {
        checkQuota().then(result => sendResponse(result)).catch(e => {
            sendResponse({ allowed: true, error: e.message }); // Fail open
        });
        return true; // async
    }
    if (message.type === 'ATOM_GET_UPDATE_STATUS') {
        getUpdateStatus().then(status => sendResponse(status || {})).catch(e => {
            sendResponse({});
        });
        return true; // async
    }
    if (message.type === 'ATOM_DISMISS_UPDATE') {
        dismissUpdate().then(() => sendResponse({ ok: true })).catch(e => {
            sendResponse({ error: e.message });
        });
        return true; // async
    }
    if (message.type === 'ATOM_CHECK_SIDELOADED') {
        isSideloaded().then(result => sendResponse({ sideloaded: result })).catch(() => {
            sendResponse({ sideloaded: false });
        });
        return true; // async
    }
    // ── Phase 3B: Proxy Handlers ──
    if (message.type === 'ATOM_CHECK_PROXY') {
        isProxyAvailable().then(result => sendResponse(result)).catch(e => {
            sendResponse({ available: false, error: e.message });
        });
        return true;
    }
    if (message.type === 'ATOM_PROXY_GEMINI') {
        (async () => {
            try {
                // Get session token
                const proxyStatus = await isProxyAvailable();
                console.log('[Proxy BG] isProxyAvailable:', {
                    available: proxyStatus.available,
                    hasToken: !!proxyStatus.accessToken,
                    tokenPreview: proxyStatus.accessToken?.substring(0, 20) + '...'
                });
                if (!proxyStatus.available || !proxyStatus.accessToken) {
                    sendResponse({ error: 'Not signed in', code: 'AUTH_REQUIRED' });
                    return;
                }
                const result = await callGeminiProxy({
                    model: message.model,
                    contents: message.contents,
                    systemInstruction: message.systemInstruction,
                    generationConfig: message.generationConfig,
                    accessToken: proxyStatus.accessToken
                });
                sendResponse({ data: result });
            } catch (e) {
                sendResponse({
                    error: e.message || 'Proxy call failed',
                    status: e.status,
                    code: e.code,
                    isQuotaExceeded: !!e.isQuotaExceeded
                });
            }
        })();
        return true;
    }
    if (message.type === 'ATOM_PROXY_EMBED') {
        (async () => {
            try {
                const proxyStatus = await isProxyAvailable();
                if (!proxyStatus.available || !proxyStatus.accessToken) {
                    sendResponse({ error: 'Not signed in', code: 'AUTH_REQUIRED' });
                    return;
                }
                const result = await callEmbeddingProxy({
                    text: message.text,
                    accessToken: proxyStatus.accessToken,
                    model: message.model,
                    outputDimensionality: message.outputDimensionality
                });
                sendResponse({ data: result });
            } catch (e) {
                sendResponse({
                    error: e.message || 'Proxy embed failed',
                    status: e.status,
                    code: e.code
                });
            }
        })();
        return true;
    }
    // ── Phase 4: Context Builder Handler ──
    if (message.type === 'ATOM_BUILD_CONTEXT') {
        (async () => {
            try {
                const context = await buildContext(message.tabId);
                sendResponse({ context });
            } catch (e) {
                console.warn('[Context Builder] Build failed:', e.message);
                sendResponse({ context: null, error: e.message });
            }
        })();
        return true;
    }
});

// ===== NOTIFICATION TEST HANDLER =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ATOM_TEST_NOTIFICATION') {
        const title = chrome.i18n.getMessage("opt_notif_test_title") || "ATOM - Test Notification";
        const msgBody = chrome.i18n.getMessage("opt_notif_test_msg") || "If you see this, notifications are working normally!";

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: title,
            message: msgBody,
            priority: 2,
            requireInteraction: true
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.error('[ATOM] Test notification error:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('[ATOM] Test notification created:', notificationId);
                sendResponse({ success: true, id: notificationId });
            }
        });
        return true; // async response
    }
});

// ==========================================
// [ATOM V2.5] UNIFIED SMART BUBBLE HANDLERS
// ==========================================

// Shared Active Reading Handler (Called by Context Menu OR Smart Bubble)
async function handleActiveReadingRequest(tab, command, text) {
    if (!tab?.id || !text) return;

    // Limit length to avoid token waste
    const MAX_CHARS = 4000;
    const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    try {
        const result = await atomGenerateReadingArtifact({
            command: command,
            text: clipped,
            meta: {
                url: tab.url,
                title: tab.title || "",
                ts: Date.now()
            }
        });

        const note = {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            command: command,
            url: tab.url,
            title: tab.title || "",
            selection: clipped,
            result,
            created_at: Date.now()
        };

        // NLM Bridge Integration
        let nlmPayload = null;
        try {
            logNlmEvent("nlm_bridge.export_attempt", { source: "smart_bubble", noteId: note.id, url: note.url });
            const nlmResult = await prepareNlmExportFromNote(note);

            if (nlmResult && nlmResult.ok) {
                const suggestedQuestion = buildSuggestedQuestion(note);
                await markDedupeHit(nlmResult.job?.dedupeKey);

                note.nlm = {
                    notebookRef: nlmResult.notebookRef,
                    notebookUrl: nlmResult.notebookUrl,
                    exportStatus: "queued",
                    exportedAt: Date.now(),
                    dedupeKey: nlmResult.job?.dedupeKey,
                    jobId: nlmResult.job?.jobId,
                    suggestedQuestion
                };

                nlmPayload = {
                    clipText: nlmResult.clipText,
                    notebookUrl: nlmResult.notebookUrl,
                    notebookRef: nlmResult.notebookRef,
                    suggestedQuestion,
                    jobId: nlmResult.job?.jobId || ""
                };

                scheduleNlmQueueAlarm();
                logNlmEvent("nlm_bridge.export_success", { source: "smart_bubble", noteId: note.id, notebookRef: nlmResult.notebookRef });

            } else if (nlmResult && nlmResult.reason === "pii_warning") {
                const pending = await createPendingNlmJob(note, nlmResult, tab.id, tab.url);
                note.nlm = {
                    notebookRef: nlmResult.notebookRef,
                    notebookUrl: nlmResult.notebookUrl,
                    exportStatus: "pending_pii",
                    exportedAt: Date.now(),
                    dedupeKey: nlmResult.dedupeKey,
                    jobId: pending.jobId,
                    suggestedQuestion: pending.suggestedQuestion
                };
                nlmPayload = {
                    reason: "pii_warning",
                    jobId: pending.jobId,
                    nonce: pending.nonce,
                    piiSummary: nlmResult.piiSummary || { types: [], count: 0 },
                    suggestedQuestion: pending.suggestedQuestion
                };
                logNlmEvent("nlm_bridge.export_failed", { source: "smart_bubble", noteId: note.id, reason: "pii_warning" });
            } else if (nlmResult && !nlmResult.ok) {
                logNlmEvent("nlm_bridge.export_failed", { source: "smart_bubble", noteId: note.id, reason: nlmResult.reason });
            }
        } catch (e) {
            logNlmEvent("nlm_bridge.export_failed", { source: "smart_bubble", noteId: note.id, reason: "error" });
        }

        // Save to Vault
        await atomAppendReadingNote(note);
        await maybeTriggerIdeaIncubator(note, tab.id);

        // Send Result to Content Script (to show the Card)
        const requestId = note.id;
        const payload = {
            command: command,
            result,
            note,
            saved: true,
            requestId,
            nlm: nlmPayload
        };

        let sent = await sendReadingResult(tab.id, payload);
        if (!sent.ok) {
            await ensureReadingUI(tab.id);
            await delayMs(200);
            await sendReadingResult(tab.id, payload);
        }

    } catch (e) {
        console.warn("ATOM Active Reading Error:", e);
        const errorSummary = e && e.userMessage
            ? e.userMessage
            : (atomMsg("reading_error_summary") || "ATOM hit an error. Please try again.");

        const requestId = `err_${Date.now()}`;
        const errPayload = {
            command: command,
            result: { summary: errorSummary },
            saved: false,
            requestId
        };

        let sent = await sendReadingResult(tab.id, errPayload);
        if (!sent.ok) {
            await ensureReadingUI(tab.id);
            await delayMs(200);
            await sendReadingResult(tab.id, errPayload);
        }
    }
}

// Unified Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ATOM_REQUEST_READING") {
        const { command, text } = message.payload || {};
        if (sender.tab && command && text) {
            handleActiveReadingRequest(sender.tab, command, text);
            sendResponse({ ok: true });
        }
        return true;
    }
});

// Connect Topic Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (handleTopicRouterMessage(request, sendResponse)) {
        return true; // async response
    }
});

// ===========================
// Lofi Sync Message Handlers
// ===========================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'LOFI_SYNC_INIT' && request.userId) {
        initLofiSync(request.userId).then(() => {
            sendResponse({ success: true, status: 'connected' });
        }).catch(err => {
            sendResponse({ success: false, error: err.message });
        });
        return true; // async response
    }
    if (request.type === 'LOFI_SYNC_DISCONNECT') {
        disconnectLofiSync();
        sendResponse({ success: true });
        return false;
    }
    if (request.type === 'LOFI_SYNC_STATUS') {
        sendResponse({ active: isLofiSyncActive() });
        return false;
    }
});

// ===========================
// Smart Research Queue (SRQ)
// ===========================

/**
 * Wave 1 P0: Rollback flag for legacy addCard flow
 * Default: false (use new upsert flow)
 * Set to true to fallback to old append-only behavior
 */
const SRQ_USE_LEGACY_ADD_CARD = false;

/**
 * Wave 2 P1: In-flight operation guard
 * Prevents race conditions from duplicate export/dismiss clicks
 */
const inFlightOps = new Map();
const IN_FLIGHT_TIMEOUT_MS = 10000;  // 10 seconds

/**
 * Acquire operation lock. Returns true if acquired, false if already in-flight.
 * @param {string} opType - "export" | "dismiss" | "enrich"
 * @param {string} targetType - "card" | "batch"
 * @param {string} targetId - cardId or topicKey
 * @param {string} requestId - Unique request identifier for tracing
 * @returns {boolean} True if lock acquired, false if already locked
 */
function acquireOpLock(opType, targetType, targetId, requestId) {
    const key = `${opType}:${targetType}:${targetId}`;

    if (inFlightOps.has(key)) {
        const existing = inFlightOps.get(key);
        console.warn("[SRQ] Operation already in-flight:", {
            key,
            existing: existing.requestId,
            attempted: requestId
        });
        return false;  // Lock not acquired
    }

    inFlightOps.set(key, {
        requestId,
        opType,
        targetType,
        targetId,
        startedAt: Date.now(),
        timeout: IN_FLIGHT_TIMEOUT_MS
    });

    return true;  // Lock acquired
}

/**
 * Release operation lock.
 * @param {string} opType - "export" | "dismiss" | "enrich"
 * @param {string} targetType - "card" | "batch"
 * @param {string} targetId - cardId or topicKey
 */
function releaseOpLock(opType, targetType, targetId) {
    const key = `${opType}:${targetType}:${targetId}`;
    inFlightOps.delete(key);
}

// Cleanup expired locks every 5 seconds (prevents permanent deadlock)
setInterval(() => {
    const now = Date.now();
    for (const [key, op] of inFlightOps.entries()) {
        if (now - op.startedAt > op.timeout) {
            console.warn("[SRQ] Operation timeout, cleaning up:", key);
            inFlightOps.delete(key);
        }
    }
}, 5000);

/**
 * SRQ: Find related reading sessions using vector similarity.
 * Self-contained — accesses IndexedDB and Gemini API directly from service worker.
 */
const SRQ_RELATED_CONFIG = {
    model: 'gemini-embedding-001',
    dimension: 768,
    minSimilarity: 0.7,
    maxResults: 3,
    maxTextLength: 10000
};

function srqCosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const mag = Math.sqrt(normA) * Math.sqrt(normB);
    return mag === 0 ? 0 : dot / mag;
}

async function srqOpenVectorDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('atom_vectors', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('embeddings')) {
                const store = db.createObjectStore('embeddings', { keyPath: 'sessionId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('domain', 'domain', { unique: false });
            }
        };
    });
}

async function srqGetAllEmbeddings() {
    try {
        const db = await srqOpenVectorDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['embeddings'], 'readonly');
            const store = tx.objectStore('embeddings');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[SRQ] Failed to read vector store:', err.message);
        return [];
    }
}

async function srqGenerateEmbedding(text, apiKey) {
    const truncated = (text || '').trim().slice(0, SRQ_RELATED_CONFIG.maxTextLength);
    if (!truncated || !apiKey) return null;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${SRQ_RELATED_CONFIG.model}:embedContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: { parts: [{ text: truncated }] },
                outputDimensionality: SRQ_RELATED_CONFIG.dimension
            })
        }
    );

    if (!response.ok) {
        console.warn('[SRQ] Embedding API error:', response.status);
        return null;
    }

    const data = await response.json();
    return Array.isArray(data?.embedding?.values) ? data.embedding.values : null;
}

async function findRelatedForSRQ(url, title) {
    try {
        // Get API key
        const storage = await chrome.storage.local.get(['gemini_api_key', 'apiKey']);
        const apiKey = storage.gemini_api_key || storage.apiKey;
        if (!apiKey) return [];

        // Get all stored embeddings
        const allEmbeddings = await srqGetAllEmbeddings();
        if (!allEmbeddings.length) return [];

        // Generate query embedding from title
        const queryEmbedding = await srqGenerateEmbedding(title || '', apiKey);
        if (!queryEmbedding) return [];

        // Compute similarities
        const scored = allEmbeddings
            .filter(e => e?.sessionId && Array.isArray(e.embedding) && e.embedding.length === queryEmbedding.length)
            .map(e => ({
                sessionId: e.sessionId,
                similarity: Math.round(srqCosineSimilarity(queryEmbedding, e.embedding) * 100) / 100,
                title: e.title || 'Unknown',
                url: e.url || '',
                domain: e.domain || ''
            }))
            .filter(e => e.similarity >= SRQ_RELATED_CONFIG.minSimilarity)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, SRQ_RELATED_CONFIG.maxResults);

        return scored;
    } catch (err) {
        console.warn('[SRQ] findRelatedForSRQ failed:', err.message);
        return [];
    }
}

/**
 * Export all pending cards in a batch (by topicKey) to NotebookLM export queue.
 * Uses existing clip_format + export_queue pipeline.
 */
async function handleSrqBatchExport(topicKey, notebookRef) {
    const batchCards = await getCardsByTopicKey(topicKey);
    const pending = batchCards.filter(c => c.status === "pending_review" || c.status === "approved");
    const targetNotebook = notebookRef || "Inbox";

    let exported = 0;
    let skipped = 0;
    const cardIds = [];  // Wave 2 P1: Track exported card IDs

    for (const card of pending) {
        const clipText = formatAtomClip({
            title: card.title,
            url: card.url,
            selectedText: card.selectedText,
            viewportExcerpt: card.viewportExcerpt,
            readingMode: card.readingMode,
            confidence: card.topicConfidence,
            tags: [...(card.keywords || []), ...(card.userTags || [])],
            atomicThought: card.atomicThought,
            refinedInsight: card.refinedInsight,
            threadConnections: (card.relatedSessions || []).map(r => ({
                type: card.connectionHint || "related",
                explanation: `${r.title} (${Math.round((r.similarity || 0) * 100)}%)`
            })),
            whySaved: card.userNote || null,
            capturedAt: card.createdAt
        });

        if (!clipText) { skipped++; continue; }

        const dedupeKey = await buildDedupeKey({
            url: card.url,
            selectedText: card.selectedText,
            notebookRef: targetNotebook,
            capturedAt: card.createdAt
        });

        const isDupe = await (async () => {
            try {
                return isDedupeHit(dedupeKey);
            } catch { return false; }
        })();

        if (isDupe) { skipped++; continue; }

        const job = createExportJob({
            bundleId: card.cardId,
            notebookRef: targetNotebook,
            dedupeKey
        });
        await enqueueExportJob(job);
        await markDedupeHit(dedupeKey);

        await updateCardStatus(card.cardId, "exported");
        await updateCard(card.cardId, { exportedJobId: job.jobId, exportedAt: Date.now() });
        exported++;
        cardIds.push(card.cardId);  // Wave 2 P1: Track exported card ID
    }

    return { exported, skipped, total: pending.length, cardIds };
}

/**
 * Export a single SRQ card to NotebookLM export queue.
 */
async function handleSrqSingleExport(cardId, notebookRef) {
    const allCards = await loadCards();
    const card = allCards.find(c => c?.cardId === cardId);
    if (!card) return { exported: 0, error: "Card not found" };
    if (card.status === "exported") return { exported: 0, error: "Already exported" };

    // Reuse batch export logic with a virtual single-card batch
    const targetNotebook = notebookRef || card.suggestedNotebook || "Inbox";

    const clipText = formatAtomClip({
        title: card.title,
        url: card.url,
        selectedText: card.selectedText,
        viewportExcerpt: card.viewportExcerpt,
        readingMode: card.readingMode,
        confidence: card.topicConfidence,
        tags: [...(card.keywords || []), ...(card.userTags || [])],
        atomicThought: card.atomicThought,
        refinedInsight: card.refinedInsight,
        capturedAt: card.createdAt
    });

    if (!clipText) return { exported: 0, error: "Empty clip" };

    const dedupeKey = await buildDedupeKey({
        url: card.url,
        selectedText: card.selectedText,
        notebookRef: targetNotebook,
        capturedAt: card.createdAt
    });

    const job = createExportJob({
        bundleId: card.cardId,
        notebookRef: targetNotebook,
        dedupeKey
    });
    await enqueueExportJob(job);
    await markDedupeHit(dedupeKey);
    await updateCardStatus(card.cardId, "exported");
    await updateCard(card.cardId, { exportedJobId: job.jobId, exportedAt: Date.now() });

    return { exported: 1 };
}

// --- SRQ Auto-Flow: Read feature flags from chrome.storage (service worker context) ---
const SRQ_FLAG_STORAGE_KEY = 'atom_feature_flags_v1';
const SRQ_FLAG_DEFAULTS = { SRQ_AUTO_SAVE: true, SRQ_AUTO_EXPORT: true };

async function getSrqFlag(key) {
    try {
        const data = await chrome.storage.local.get([SRQ_FLAG_STORAGE_KEY]);
        const stored = data[SRQ_FLAG_STORAGE_KEY] || {};
        return Object.prototype.hasOwnProperty.call(stored, key)
            ? !!stored[key]
            : (SRQ_FLAG_DEFAULTS[key] ?? false);
    } catch {
        return SRQ_FLAG_DEFAULTS[key] ?? false;
    }
}

// =============================================
// S2b: Topic Similarity Helpers for Smart Suggest
// =============================================

const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'not', 'no', 'nor', 'so', 'than',
    'too', 'very', 'just', 'about', 'above', 'after', 'before', 'between',
    'each', 'all', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'only', 'own', 'same', 'into', 'out', 'up', 'down', 'over', 'under',
    'again', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'các', 'của', 'và', 'là', 'trong', 'cho', 'với', 'không', 'được',
    'một', 'những', 'này', 'đó', 'có', 'từ', 'đến', 'về', 'theo', 'như'
]);

/**
 * Extract keywords from text — tokenize, lowercase, strip stopwords.
 * @param {string} text - Raw text to extract from
 * @returns {Set<string>} Set of lowercase keyword tokens
 */
function extractKeywordsFromText(text) {
    if (!text) return new Set();
    return new Set(
        text.toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // keep Unicode letters + numbers
            .split(/\s+/)
            .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    );
}

/**
 * Compute similarity between notebook context and a card.
 * Returns 0.0-1.0+ score.
 *
 * Scoring:
 * - Topic key exact match: 1.0
 * - Keyword Jaccard overlap: 0.0-1.0
 * - Source title partial match: bonus up to 0.3
 * - Domain bonus: +0.1 if card domain appears in notebook context
 */
function computeTopicSimilarity(nbTitleLower, nbKeywords, nbSources, card) {
    let score = 0;

    const cardTopicKey = (card.topicKey || "").toLowerCase();
    const cardKeywords = new Set(
        (card.keywords || []).map(k => k.toLowerCase())
    );
    const cardTitle = (card.title || "").toLowerCase();
    const cardDomain = (card.domain || "").toLowerCase();

    // 1. Topic key exact match (highest signal)
    if (cardTopicKey && nbTitleLower.includes(cardTopicKey)) {
        score = Math.max(score, 0.8);
    }
    if (cardTopicKey && nbKeywords.has(cardTopicKey)) {
        score = Math.max(score, 1.0);
    }

    // 1b. Card title word overlap with notebook title (handles sparse context)
    if (cardTitle && nbTitleLower) {
        const cardWords = cardTitle.split(/\s+/).filter(w => w.length >= 3);
        if (cardWords.length > 0) {
            let titleMatch = 0;
            for (const w of cardWords) {
                if (nbTitleLower.includes(w)) titleMatch++;
            }
            const titleOverlap = titleMatch / cardWords.length;
            if (titleOverlap >= 0.3) {
                score = Math.max(score, 0.3 + titleOverlap * 0.4); // 0.3-0.7 range
            }
        }
    }

    // 2. Keyword Jaccard overlap
    if (cardKeywords.size > 0 && nbKeywords.size > 0) {
        let intersection = 0;
        for (const kw of cardKeywords) {
            if (nbKeywords.has(kw)) intersection++;
        }
        const union = new Set([...cardKeywords, ...nbKeywords]).size;
        const jaccard = union > 0 ? intersection / union : 0;

        // Weighted: more overlap = higher score
        // Also consider absolute matches (2+ keyword matches = strong signal)
        const keywordScore = Math.max(jaccard, intersection >= 2 ? 0.5 : 0);
        score = Math.max(score, keywordScore);
    }

    // 3. Source title matching — card title appears in any source title
    if (nbSources.length > 0 && cardTitle) {
        const sourcesLower = nbSources.map(s => s.toLowerCase());
        for (const src of sourcesLower) {
            // Partial match: if card title words appear in source
            const cardWords = cardTitle.split(/\s+/).filter(w => w.length >= 3);
            let matchCount = 0;
            for (const word of cardWords) {
                if (src.includes(word)) matchCount++;
            }
            if (cardWords.length > 0 && matchCount / cardWords.length >= 0.5) {
                score = Math.max(score, 0.6);
                break;
            }
        }
    }

    // 4. Domain bonus
    if (cardDomain && nbTitleLower.includes(cardDomain)) {
        score += 0.1;
    }
    // Also check if domain appears in source URLs
    if (cardDomain && nbSources.some(s => s.toLowerCase().includes(cardDomain))) {
        score += 0.1;
    }

    return Math.min(score, 1.5); // Cap at 1.5
}

function handleSrqMessage(request, sender, sendResponse) {
    console.warn("[SRQ] Handling:", request.type);

    (async () => {
        try {
            switch (request.type) {
                case "SRQ_CREATE_CARD": {
                    // Wave 1 P0: Idempotent card creation with upsert
                    let rollbackApplied = false;

                    try {
                        const card = await createResearchCard(request.payload);
                        if (!card) {
                            sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.INVALID_PARAM, message: "Card creation failed" });
                            break;
                        }

                        // Upsert with idempotency (or legacy addCard if rollback flag is set)
                        const savedCard = SRQ_USE_LEGACY_ADD_CARD
                            ? await addCard(card)
                            : await upsertCard(card);

                        rollbackApplied = true;

                        // Trigger async enrichment (non-blocking)
                        enrichCardAsync(savedCard.cardId).catch(err => {
                            console.warn("[SRQ] Async enrichment failed:", err.message);
                        });

                        // Visual anchor capture (non-blocking, Phase 2)
                        // When sent from sidepanel, sender.tab is undefined — fall back to active tab
                        let captureTabId = sender?.tab?.id;
                        if (!captureTabId) {
                            try {
                                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                                captureTabId = activeTab?.id;
                            } catch { /* ignore */ }
                        }
                        if (captureTabId) {
                            captureVisualAnchor(captureTabId)
                                .then(thumbnail => {
                                    if (thumbnail) {
                                        updateCard(savedCard.cardId, { visualAnchor: thumbnail });
                                        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "visual_anchor_added" }).catch(() => { });
                                    }
                                })
                                .catch(err => {
                                    console.warn("[SRQ] Visual anchor capture failed:", err.message);
                                });
                        }

                        // --- Auto-Flow S1: Auto-save (auto-approve) ---
                        const autoSave = await getSrqFlag('SRQ_AUTO_SAVE');
                        console.warn("[SRQ AutoFlow] Flag check — autoSave:", autoSave);
                        if (autoSave) {
                            await updateCardStatus(savedCard.cardId, "approved");
                            console.warn("[SRQ AutoFlow] Card auto-approved:", savedCard.cardId);
                        }

                        sendResponse({ ok: true, card: savedCard });

                        // Notify sidepanel of change (only after successful save)
                        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED" }).catch(() => { });

                        // --- Auto-Flow S1: Auto-export to NLM (after response sent) ---
                        if (autoSave) {
                            const autoExport = await getSrqFlag('SRQ_AUTO_EXPORT');
                            console.warn("[SRQ AutoFlow] Flag check — autoExport:", autoExport);
                            if (autoExport) {
                                console.warn("[SRQ AutoFlow] Waiting 3s for enrichment...");
                                // Await delay to let enrichment finish, then export
                                await new Promise(r => setTimeout(r, 3000));
                                console.warn("[SRQ AutoFlow] Delay done, starting export...");
                                try {
                                    // Re-read card to get enriched suggestedNotebook
                                    const freshCards = await loadCards();
                                    const freshCard = freshCards.find(c => c?.cardId === savedCard.cardId);
                                    const notebookRef = freshCard?.suggestedNotebook || "Inbox";
                                    console.warn("[SRQ AutoFlow] Exporting to:", notebookRef);
                                    await handleSrqSingleExport(savedCard.cardId, notebookRef);
                                    console.warn("[SRQ AutoFlow] ✅ Card auto-exported:", savedCard.cardId);
                                    chrome.runtime.sendMessage({
                                        type: "SRQ_CARDS_UPDATED",
                                        reason: "auto_exported",
                                        changedIds: [savedCard.cardId]
                                    }).catch(() => { });
                                } catch (err) {
                                    console.warn("[SRQ AutoFlow] ❌ Auto-export failed, will retry:", err.message);
                                    // Card stays "approved" — retry alarm will pick it up
                                }
                            }
                        }
                    } catch (err) {
                        console.error("[ATOM SRQ] CREATE_CARD error:", {
                            reason: err.message,
                            rollbackApplied,
                            requestType: "SRQ_CREATE_CARD"
                        });
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: err.message
                        });
                    }
                    break;
                }
                case "SRQ_GET_PENDING_COUNT": {
                    const stats = await getCardStats();
                    sendResponse({ ok: true, stats });
                    break;
                }
                case "SRQ_GET_CARDS": {
                    const cards = await getPendingCards();
                    sendResponse({ ok: true, cards });
                    break;
                }
                case "SRQ_GET_ALL_CARDS": {
                    const all = await loadCards();
                    sendResponse({ ok: true, cards: all });
                    break;
                }
                case "SRQ_UPDATE_CARD": {
                    const updated = await updateCard(request.cardId, request.patch);
                    sendResponse({ ok: true, card: updated });
                    chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED" }).catch(() => { });
                    break;
                }
                case "SRQ_DISMISS_CARD": {
                    const { cardId } = request;
                    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

                    // Wave 2 P1: Acquire in-flight lock
                    if (!acquireOpLock("dismiss", "card", cardId, requestId)) {
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.CONFLICT,
                            message: "Dismiss already in progress for this card"
                        });
                        break;
                    }

                    try {
                        await dismissCard(cardId);
                        cleanupAnchors([cardId]).catch(() => { });
                        sendResponse({ ok: true });
                        chrome.runtime.sendMessage({
                            type: "SRQ_CARDS_UPDATED",
                            reason: "card_dismissed",
                            changedIds: [cardId]
                        }).catch(() => { });
                    } catch (err) {
                        console.error("[SRQ] Dismiss error:", err);
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: err.message
                        });
                    } finally {
                        releaseOpLock("dismiss", "card", cardId);
                    }
                    break;
                }
                case "SRQ_DISMISS_BATCH": {
                    const { topicKey } = request;
                    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

                    // Wave 2 P1: Acquire in-flight lock
                    if (!acquireOpLock("dismiss", "batch", topicKey, requestId)) {
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.CONFLICT,
                            message: "Dismiss already in progress for this batch"
                        });
                        break;
                    }

                    try {
                        const batchCards = await getCardsByTopicKey(topicKey);
                        let dismissed = 0;
                        const dismissedIds = [];
                        for (const card of batchCards) {
                            if (card.status === "pending_review" || card.status === "approved") {
                                await updateCardStatus(card.cardId, "dismissed");
                                dismissed++;
                                dismissedIds.push(card.cardId);
                            }
                        }
                        if (dismissedIds.length > 0) {
                            cleanupAnchors(dismissedIds).catch(() => { });
                        }
                        sendResponse({ ok: true, dismissed });
                        chrome.runtime.sendMessage({
                            type: "SRQ_CARDS_UPDATED",
                            reason: "batch_dismissed",
                            changedIds: dismissedIds
                        }).catch(() => { });
                    } catch (err) {
                        console.error("[SRQ] Batch dismiss error:", err);
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: err.message
                        });
                    } finally {
                        releaseOpLock("dismiss", "batch", topicKey);
                    }
                    break;
                }
                case "SRQ_GET_BATCHES": {
                    try {
                        const batches = await getBatchesForExport();
                        sendResponse({ ok: true, batches: batches || [] });
                    } catch (err) {
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: "Failed to load batches"
                        });
                    }
                    break;
                }
                case "SRQ_GET_WEEKLY_STATS": {
                    try {
                        const stats = await getWeeklyStats();
                        sendResponse({ ok: true, stats });
                    } catch (err) {
                        sendResponse({ ok: false, message: err.message });
                    }
                    break;
                }
                case "SRQ_MARK_REVIEWED": {
                    try {
                        const count = await bulkUpdateReviewedAt(request.cardIds || []);
                        sendResponse({ ok: true, updated: count });
                        chrome.runtime.sendMessage({ type: "SRQ_CARDS_UPDATED", reason: "cards_reviewed" }).catch(() => { });
                    } catch (err) {
                        sendResponse({ ok: false, message: err.message });
                    }
                    break;
                }
                case "SRQ_EXPORT_BATCH": {
                    const { topicKey, notebookRef } = request;
                    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

                    // Wave 2 P1: Acquire in-flight lock
                    if (!acquireOpLock("export", "batch", topicKey, requestId)) {
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.CONFLICT,
                            message: "Export already in progress for this batch"
                        });
                        break;
                    }

                    try {
                        const result = await handleSrqBatchExport(topicKey, notebookRef);
                        const exportedIds = result.cardIds || [];
                        if (exportedIds.length > 0) {
                            cleanupAnchors(exportedIds).catch(() => { });
                        }
                        sendResponse({ ok: true, ...result });
                        chrome.runtime.sendMessage({
                            type: "SRQ_CARDS_UPDATED",
                            reason: "batch_exported",
                            changedIds: exportedIds
                        }).catch(() => { });
                    } catch (err) {
                        console.error("[SRQ] Batch export error:", err);
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: err.message
                        });
                    } finally {
                        releaseOpLock("export", "batch", topicKey);
                    }
                    break;
                }
                case "SRQ_EXPORT_CARD": {
                    const { cardId, notebookRef } = request;
                    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

                    // Wave 2 P1: Acquire in-flight lock
                    if (!acquireOpLock("export", "card", cardId, requestId)) {
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.CONFLICT,
                            message: "Export already in progress for this card"
                        });
                        break;
                    }

                    try {
                        const result = await handleSrqSingleExport(cardId, notebookRef);
                        cleanupAnchors([cardId]).catch(() => { });
                        sendResponse({ ok: true, ...result });
                        chrome.runtime.sendMessage({
                            type: "SRQ_CARDS_UPDATED",
                            reason: "card_exported",
                            changedIds: [cardId]
                        }).catch(() => { });
                    } catch (err) {
                        console.error("[SRQ] Export error:", err);
                        sendResponse({
                            ok: false,
                            errorCode: SRQ_ERROR_CODES.TRANSIENT,
                            message: err.message
                        });
                    } finally {
                        releaseOpLock("export", "card", cardId);
                    }
                    break;
                }
                case "SRQ_FIND_RELATED": {
                    try {
                        const sessions = await findRelatedForSRQ(
                            request.url,
                            request.title
                        );
                        sendResponse({ ok: true, sessions });
                    } catch (err) {
                        console.warn('[SRQ] FIND_RELATED error:', err.message);
                        sendResponse({ ok: true, sessions: [] });
                    }
                    break;
                }

                case "SRQ_FIND_RELATED_FOR_NOTEBOOK": {
                    // S2b: Smart Suggest — find cards matching notebook context
                    try {
                        const { notebookContext } = request;
                        if (!notebookContext?.contextText) {
                            sendResponse({ ok: true, suggestions: [] });
                            break;
                        }

                        // Load candidate cards (include exported — they can still be suggested)
                        // Only exclude dismissed cards
                        const allCards = await loadCards();
                        const candidates = allCards.filter(c =>
                            c && c.status !== "dismissed"
                        );

                        if (candidates.length === 0) {
                            console.warn("[SRQ Suggest] No candidate cards found");
                            sendResponse({ ok: true, suggestions: [] });
                            break;
                        }

                        // Extract notebook keywords from contextText
                        const nbKeywords = extractKeywordsFromText(notebookContext.contextText);
                        const nbTitle = (notebookContext.title || "").toLowerCase();

                        // Score each card
                        const scored = candidates.map(card => {
                            const score = computeTopicSimilarity(
                                nbTitle,
                                nbKeywords,
                                notebookContext.sources || [],
                                card
                            );
                            return { ...card, _suggestScore: score };
                        });

                        // Filter & sort
                        const suggestions = scored
                            .filter(c => c._suggestScore >= 0.3)
                            .sort((a, b) => b._suggestScore - a._suggestScore)
                            .slice(0, 5)
                            .map(c => ({
                                cardId: c.cardId,
                                title: c.title,
                                domain: c.domain,
                                selectedText: (c.selectedText || "").slice(0, 80),
                                topicKey: c.topicKey,
                                topicLabel: c.topicLabel,
                                keywords: c.keywords,
                                createdAt: c.createdAt,
                                score: Math.round(c._suggestScore * 100) / 100
                            }));

                        console.warn("[SRQ Suggest] Found", suggestions.length,
                            "suggestions for notebook:", notebookContext.title,
                            "from", candidates.length, "candidates");

                        sendResponse({ ok: true, suggestions });
                    } catch (err) {
                        console.warn("[SRQ Suggest] Error:", err.message);
                        sendResponse({ ok: true, suggestions: [] });
                    }
                    break;
                }
                case "SRQ_GET_NOTEBOOK_FOR_URL": {
                    try {
                        const targetUrl = request.url;
                        if (!targetUrl) {
                            sendResponse({ ok: true, notebookRef: null });
                            break;
                        }
                        const allCards = await loadCards();
                        const exported = allCards.filter(c =>
                            c && c.status === "exported" && c.url === targetUrl
                        );
                        if (exported.length === 0) {
                            sendResponse({ ok: true, notebookRef: null });
                            break;
                        }
                        // Find most common notebook among exported cards
                        const nbCounts = {};
                        for (const c of exported) {
                            const nb = c.suggestedNotebook || "Inbox";
                            nbCounts[nb] = (nbCounts[nb] || 0) + 1;
                        }
                        const topNb = Object.entries(nbCounts)
                            .sort((a, b) => b[1] - a[1])[0];
                        const notebookRef = topNb[0];
                        const notebookUrl = resolveNotebookUrl(notebookRef);
                        sendResponse({
                            ok: true,
                            notebookRef,
                            notebookUrl,
                            count: exported.length
                        });
                    } catch (err) {
                        console.warn("[SRQ] GET_NOTEBOOK_FOR_URL error:", err.message);
                        sendResponse({ ok: true, notebookRef: null });
                    }
                    break;
                }
                default:
                    sendResponse({ ok: false, errorCode: SRQ_ERROR_CODES.UNKNOWN, message: "Unknown SRQ action" });
            }
        } catch (err) {
            console.error("[ATOM SRQ] Handler error:", err);
            // Wave 1 P0: Standardized error responses
            sendResponse({
                ok: false,
                errorCode: SRQ_ERROR_CODES.TRANSIENT,
                message: err.message || "Internal error"
            });
        }
    })();
}



// ===========================
// Auth Sync: Web → Extension
// ===========================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'WEB_AUTH_DETECTED') return;

    (async () => {
        try {
            const { access_token, refresh_token } = message.payload || {};
            if (!access_token || !refresh_token) {
                sendResponse({ ok: false, reason: 'missing tokens' });
                return;
            }

            // Skip if already authenticated
            const { data: { session: existing } } = await getSupabaseClient().auth.getSession();
            if (existing?.user) {
                sendResponse({ ok: true, reason: 'already authenticated' });
                return;
            }

            // Set session from web tokens
            const { data, error } = await getSupabaseClient().auth.setSession({
                access_token,
                refresh_token,
            });

            if (error) {
                console.warn('[Auth Sync] Failed to set session from web:', error.message);
                sendResponse({ ok: false, reason: error.message });
                return;
            }

            // Cache for proxy usage
            if (data?.session) {
                await chrome.storage.local.set({
                    atom_proxy_session: {
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                        expires_at: data.session.expires_at,
                        user_id: data.session.user?.id
                    }
                });
            }

            console.log('[Auth Sync] Session synced from web successfully');
            sendResponse({ ok: true });
        } catch (err) {
            console.warn('[Auth Sync] Error:', err.message);
            sendResponse({ ok: false, reason: err.message });
        }
    })();
    return true; // async response
});
