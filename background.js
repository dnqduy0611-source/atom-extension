// background.js - V3 ADAPTER

import { SignalExtractor, DecisionEngine } from './core_logic.js';
import { StrategyLayer } from './strategy_layer.js';
import { SelectionLogic } from './selection_logic.js';
import { InterventionManager } from './intervention_manager.js';
import { AIService } from './ai_service.js';

// Debug mode flag - loaded from storage, can be toggled in Settings
let DEBUG_PIPELINE = false;
chrome.storage.local.get(['debug_mode'], (res) => {
    DEBUG_PIPELINE = res.debug_mode || false;
});
chrome.storage.onChanged.addListener((changes) => {
    if (changes.debug_mode) {
        DEBUG_PIPELINE = changes.debug_mode.newValue || false;
        console.log("ATOM: Debug Mode changed to", DEBUG_PIPELINE);
    }
});

// --- KHỞI TẠO BIẾN TOÀN CỤC ---
// Biến này nằm trên RAM để truy xuất cực nhanh trong handleTick
let snoozeUntil = 0;
let sessionState = {
    interventionCount: 0,
    lastInterventionTime: 0
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
    "docs.google.com",
    "drive.google.com",
    "figma.com",
    "notion.so",
    "github.com",
    "localhost",
    "canvas.instructure.com" // Ví dụ LMS
];
const aiService = new AIService();
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
    }

    // 4. Tái khởi tạo Context Menu (Xóa đi tạo lại để tránh lỗi duplicate)
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "atom-whitelist-domain",
            title: "🛡️ ATOM: Luôn bỏ qua trang này (Safe Zone)",
            contexts: ["page"]
        });
    });
});
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

// --- 2. XỬ LÝ SỰ KIỆN MENU CHUỘT PHẢI ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== "atom-whitelist-domain") return;
    if (!tab?.url) return;

    try {
        // Normalize domain về lowercase để tránh trùng lặp
        const urlObj = new URL(tab.url);
        const domain = urlObj.hostname.toLowerCase();

        const { atom_whitelist } = await chrome.storage.local.get(['atom_whitelist']);
        const current = Array.isArray(atom_whitelist) ? atom_whitelist : DEFAULT_WHITELIST;

        if (!current.includes(domain)) {
            const newList = [...current, domain];
            await chrome.storage.local.set({ atom_whitelist: newList });
            console.log(`ATOM: Added ${domain} to Safe Zone.`);

            // Reload tab để áp dụng ngay
            chrome.tabs.reload(tab.id);
        }
    } catch (e) {
        console.error("ATOM whitelist error:", e);
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
const interventionManager = new InterventionManager();

async function getGeminiKey() {
    // Lấy key user đã nhập trong trang Options
    const data = await chrome.storage.local.get(['user_gemini_key']);
    return data.user_gemini_key || null;
}


async function handleTick(payload) {
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
            'adaptive_multiplier'
        ]);
        const currentSensitivity = storage.user_sensitivity || 'balanced';
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
        console.log("[THRESH]", currentSensitivity, multiplier, thresholds);
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
        if (!decision.is_safe_to_scroll) {

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

        const category = selectionLogic.selectCategory(strategy, selectionContext);
        // --- XỬ LÝ SILENCE (NULL) MƯỢT MÀ ---
        if (!category || category === 'none') {
            if (DEBUG_PIPELINE) {
                const reason =
                    (Date.now() < snoozeUntil) ? "SNOOZED" :
                        (!decision.needs_processing) ? "SAFE_TO_SCROLL" :
                            (strategyContext.intervention_fatigue === "high") ? "FATIGUE_SILENCE" : "UNKNOWN";

                console.log(`[TICK:OUT] none | Reason: ${reason} | Scroll: ${payload.continuous_scroll_sec}s`);
            }
            return { type: "none" };
        }
        // renderV3 sẽ tự trả type none/presence_signal/... phù hợp


        // 6. INTERVENTION MANAGER (The Actor - Thực thi/HOW)
        const intervention = await interventionManager.renderV3(category, strategy);
        if (intervention.type !== 'none' && intervention.type !== 'presence_signal') {
            // Chỉ tính vào Cap nếu là can thiệp cứng (Hard Interrupt hoặc Micro Closure)
            // Không tính Presence Signal (Orb) vào giới hạn làm phiền

            const triggerLog = {
                timestamp: Date.now(),
                url: payload.url || "unknown", // Lấy từ payload đầu vào
                event: "TRIGGERED",            // Event riêng để đếm Cap
                mode: intervention.type.toUpperCase()       // hard_interrupt hoặc micro_closure
            };

            // Đẩy vào storage (thao tác này nhanh, không cần await block UI)
            const newReactions = [...reactions, triggerLog].slice(-50);
            try {
                await chrome.storage.local.set({ atom_reactions: newReactions });
            } catch (e) {
                console.warn("ATOM: Storage write failed", e);
            }

            // Cập nhật lại biến reactions cục bộ để logic bên dưới (nếu có) dùng luôn
            // reactions.push(triggerLog); 
        }

        // LƯU LẠI LỊCH SỬ ĐỂ HỌC (DL-Ready)
        await chrome.storage.local.set({ 'last_category': category });

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

async function askGemini(journalLogs, reactions, history) {
    const userKey = await getGeminiKey();

    if (!journalLogs.length && !reactions.length) {
        return "Tôi chưa thấy hoạt động nào đáng chú ý. Hãy cứ là chính mình nhé!";
    }
    // --- CHẾ ĐỘ OFFLINE ---
    if (!userKey) {
        const randomKey = OFFLINE_QUOTE_KEYS[Math.floor(Math.random() * OFFLINE_QUOTE_KEYS.length)];
        const quote = chrome.i18n.getMessage(randomKey);
        // Lưu ý: Nếu muốn thêm text hướng dẫn
        return `(Offline) ${quote}`;
    }
    // --- CHẾ ĐỘ ONLINE ---
    const MODEL_NAME = "gemini-flash-latest";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${userKey}`;
    const lang = chrome.i18n.getUILanguage().startsWith('vi') ? 'Vietnamese' : 'English';
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
    Roleplay as ATOM, an empathetic AI companion.
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
    
    Reply in ${lang} only. Under 50 words.
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();

        if (data.error) return chrome.i18n.getMessage("ai_thinking_error");
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        const randomKey = OFFLINE_QUOTE_KEYS[Math.floor(Math.random() * OFFLINE_QUOTE_KEYS.length)];
        return `(Offline) ${chrome.i18n.getMessage(randomKey)}`;
    }
}
// Thêm logic này vào background.js
async function evolveCopyLibrary() {
    const userKey = await getGeminiKey();
    if (!userKey) return; // Không có key thì không update library
    // CHÚNG TA GIỮ NGUYÊN BẢN MODEL "gemini-flash-latest" Ở ĐÂY 👇
    const MODEL_NAME = "gemini-flash-latest";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${userKey}`;
    const data = await chrome.storage.local.get(['journal_logs', 'atom_reactions']);
    const logs = data.journal_logs || [];
    const reactions = data.atom_reactions || [];

    const prompt = `
    Dựa trên nhật ký của người dùng: ${JSON.stringify(logs.slice(-10))}
    Và lịch sử phản kháng: ${JSON.stringify(reactions.slice(-10))}
    
    Hãy tạo ra 5 câu lời thoại mới cho ATOM. 
    Yêu cầu: 
    - Nếu user đang stress, hãy dùng tông giọng an ủi. 
    - Nếu user hay bỏ qua lời nhắc, hãy dùng tông giọng thủ thỉ, gợi mở sự tò mò thay vì ra lệnh.
    - Định dạng trả về: Chỉ trả về một mảng JSON các câu nói.
    `;

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const result = await response.json();

        // Parse kết quả trả về từ text sang JSON
        const text = result.candidates[0].content.parts[0].text;
        // Dọn dẹp markdown nếu có (phòng hờ Gemini trả về ```json ... ```)
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

    // ROUTE 1: Xử lý TICK (Vòng lặp kiểm soát)
    if (request.type === "TICK") {
        // 1) Log ngay khi nhận tick (để debug chắc chắn)
        console.log("[TICK:IN]", request.payload?.url, request.payload?.continuous_scroll_sec, request.payload?.scroll_px);

        handleTick(request.payload)
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
            // ... (bên trong ROUTE 2: ANALYZE_JOURNAL)
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
                        ? chrome.i18n.getMessage("fallback_activity_work")
                        : chrome.i18n.getMessage("fallback_activity_general");

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
            sendResponse({ success: true, message: advice });
        });
        return true;
    }

    if (request.type === "LOG_EVENT") {
        const payload = request.payload || {};
        const event = (payload.event || "UNKNOWN").toUpperCase(); // SHOWN
        const mode = (payload.mode || "UNKNOWN").toUpperCase(); // BREATH/TAP/...

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
            event, // SHOWN
            mode,
            intervention_id: payload.intervention_id || null,
            shown_at: payload.shown_at || null,
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
    const defaultLocation = chrome.i18n.getMessage("fallback_location"); // "nơi này" hoặc "this place"

    const locationName = rawContext.locationRaw || defaultLocation;
    message = message.replace(/\{location\}/gi, locationName);

    const activityName = rawContext.activityRaw || "activity"; // Fallback cứng này ít khi dùng vì bên trên đã truyền vào rồi
    message = message.replace(/\{activity\}/gi, activityName);

    return message;
}