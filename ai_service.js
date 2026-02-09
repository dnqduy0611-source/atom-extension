// ai_service.js - PRODUCTION GRADE ADAPTER (V3.0 FIXED)
// Fixed: Cache Value, Schema Types, Retry Logic, Sanitization

import { initI18n, getActiveLocale } from './i18n_bridge.js';
import { AI_CONFIG, getModel } from './config/ai_config.js';
import { RateLimitManager, parseRetryAfterSeconds } from './services/rate_limit_manager.module.js';

const i18nReady = initI18n();
const getLanguageName = () => (getActiveLocale().startsWith('vi') ? 'Vietnamese' : 'English');

export class AIService {
    constructor() {
        // Use centralized config
        this.API_BASE = AI_CONFIG.API.BASE_URL;

        // Cache In-Memory
        this.cache = new Map();
        this.CACHE_TTL = AI_CONFIG.CACHE.STRATEGY_TTL_MS;
        this.rateManager = new RateLimitManager({
            rpmTotal: 15,
            rpmBackground: 8,
            cacheTtlMs: AI_CONFIG.CACHE.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000
        });
    }

    // =================================================================
    // 1. CRITICAL PATH: RA QUYẾT ĐỊNH
    // =================================================================

    async classify(prompt, responseSchema, timeoutMs = 800, retries = 0) {
        return this._callCloudGemini(prompt, responseSchema, timeoutMs, retries);
    }

    async generateStrategy(rawContext) {
        // [FIX 4] Sanitize Input (Làm sạch dữ liệu đầu vào)
        const context = this._sanitizeContext(rawContext);

        // [FIX 3] Cache Key thông minh hơn (Gồm cả tags)
        const tagsHash = (context.sentiment_tags || []).sort().join("|");
        const cacheKey = `STRAT_${context.resistance}_${context.streak}_${context.depth}_${tagsHash}`;

        // [FIX 1] Lấy value chuẩn từ cache
        const cached = this._getCacheValue(cacheKey);
        if (cached) return cached;

        // [FIX 2] Schema chuẩn JSON Schema (Lowercase + Strict)
        const STRATEGY_SCHEMA = {
            type: "object", // Sửa thành chữ thường
            properties: {
                intent: {
                    type: "string",
                    enum: ["restore_awareness", "enable_closure", "reduce_resistance", "gentle_reflection", "allow_continue"]
                },
                intensity: {
                    type: "string",
                    enum: ["low", "medium", "high"]
                },
                risk_tolerance: {
                    type: "string",
                    enum: ["conservative", "balanced", "aggressive"]
                }
            },
            required: ["intent", "intensity", "risk_tolerance"]
        };

        const systemPrompt = `
        Analyze user signals and output a strategy.
        CONTEXT:
        - Scroll Duration: ${context.depth}s
        - Resistance (0-10): ${context.resistance}
        - Streak: ${context.streak}
        - Tags: ${JSON.stringify(context.sentiment_tags)}
        `;

        try {
            // Timeout 5s, Retry 2 lần
            const result = await this._callCloudGemini(systemPrompt, STRATEGY_SCHEMA, 5000, 2);
            this._setCache(cacheKey, result);
            return result;
        } catch (error) {
            console.warn("[ATOM AI] Strategy Fallback:", error.message);
            return null;
        }
    }

    // =================================================================
    // 2. CREATIVE PATH: VIẾT LỜI THOẠI
    // =================================================================

    async generateCopy(features) {
        const sentiment = (features.sentiment || "neutral").toLowerCase().trim();
        const topic = (features.topic || "general").toLowerCase().trim();

        const cacheKey = `COPY_${sentiment}_${topic}`;
        const cached = this._getCacheValue(cacheKey);
        if (cached) return cached;

        const COPY_SCHEMA = {
            type: "object",
            properties: {
                template: { type: "string" }
            },
            required: ["template"]
        };

        const lang = getLanguageName();

        const systemPrompt = `
        Write a short, empathetic notification (under 20 words) for a user.
        - Sentiment: ${features.sentiment}
        - Topic: ${features.topic}
        - Use placeholders: {location} for place, {activity} for action.
        - Language: ${lang}. 
        `;
        try {
            // Timeout 8s, Retry 1 lần (Creative ít quan trọng hơn)
            const result = await this._callCloudGemini(systemPrompt, COPY_SCHEMA, 8000, 1);
            this._setCache(cacheKey, result.template);
            return result.template;
        } catch (error) {
            return null;
        }
    }

    // =================================================================
    // 3. READING ANSWER EVALUATION
    // =================================================================

    async evaluateReadingAnswers(payload) {
        const selection = (payload?.selection || "").trim();
        const summary = (payload?.summary || "").trim();
        const questions = Array.isArray(payload?.questions) ? payload.questions : [];
        const answers = Array.isArray(payload?.answers) ? payload.answers : [];
        const lang = getLanguageName();

        const pairs = questions.map((q, idx) => {
            const a = typeof answers[idx] === "string" ? answers[idx].trim() : "";
            return `Q: ${q}\nA: ${a || "(no answer)"}`;
        }).join("\n\n");

        const EVAL_SCHEMA = {
            type: "object",
            properties: {
                evaluation: { type: "string" }
            },
            required: ["evaluation"]
        };

        const systemPrompt = `
        You are a supportive study coach.
        Language: ${lang}.
        Task: Evaluate the user's answers in 2-3 sentences.
        Mention correctness, gaps, and one suggestion to improve.
        Context summary (if any):
        """${summary || selection}"""
        Questions and answers:
        ${pairs}
        Output JSON only: { "evaluation": "..." }
        `.trim();

        return this._callCloudGemini(systemPrompt, EVAL_SCHEMA, 8000, 1);
    }

    // =================================================================
    // 4. READING QUESTION GENERATION (On-demand)
    // =================================================================

    async generateReadingQuestion(payload) {
        const selection = (payload?.selection || "").trim();
        const summary = (payload?.summary || "").trim();
        const title = (payload?.title || "").trim();
        const lang = getLanguageName();

        const QUESTION_SCHEMA = {
            type: "object",
            properties: {
                question: { type: "string" }
            },
            required: ["question"]
        };

        const systemPrompt = `
        You are a study coach.
        Language: ${lang}.
        Task: Write exactly ONE concise recall question (max 20 words).
        Context title: ${title || "N/A"}
        Context summary/selection:
        """${summary || selection}"""
        Output JSON only: { "question": "..." }
        `.trim();

        const parseQuestion = (text) => {
            if (!text) return "";
            const trimmed = String(text).trim();
            if (!trimmed) return "";
            if (trimmed.startsWith("{")) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed && typeof parsed.question === "string") {
                        return parsed.question.trim();
                    }
                } catch {
                    // fall through
                }
            }
            return trimmed.split("\n")[0].replace(/^["'`]+|["'`]+$/g, "").trim();
        };

        try {
            return await this._callCloudGemini(systemPrompt, QUESTION_SCHEMA, 8000, 1);
        } catch (error) {
            const msg = String(error?.message || error);
            if (msg.includes("API Error 400")) {
                // Use fallback model from config
                const fallbackModel = getModel('USER', true);
                try {
                    return await this._callCloudGemini(systemPrompt, QUESTION_SCHEMA, 8000, 1, fallbackModel);
                } catch {
                    const raw = await this._callCloudGemini(systemPrompt, null, 8000, 1, fallbackModel);
                    return { question: parseQuestion(raw) };
                }
            }
            throw error;
        }
    }

    // =================================================================
    // 5. NOTEBOOK TITLING (Smart Naming)
    // =================================================================

    async generateTitle(text, context = {}) {
        const lang = getLanguageName();
        const selection = (text || "").substring(0, 1000); // Limit context
        const domain = context.domain || "";

        const TITLE_SCHEMA = {
            type: "object",
            properties: {
                title: { type: "string" }
            },
            required: ["title"]
        };

        const systemPrompt = `
        You are a research assistant.
        Language: ${lang}.
        Task: specific title for a research notebook (concise, max 10-12 words).
        Domain: ${domain}
        Content:
        """${selection}"""
        Output JSON only: { "title": "..." }
        NO generic names like "Research Note". Be specific to the content.
        `.trim();

        try {
            const result = await this._callCloudGemini(systemPrompt, TITLE_SCHEMA, 5000, 1);
            return result.title;
        } catch (error) {
            console.warn("[ATOM AI] Title Generation Failed:", error);
            return null; // Fallback to keyword extractor
        }
    }

    // =================================================================
    // 6. MEMORY NOTE CATEGORIZATION (Auto Labeling)
    // =================================================================

    async categorizeMemoryNote(note) {
        const title = String(note?.title || "").trim().slice(0, 180);
        const url = String(note?.url || "").trim().slice(0, 500);
        const selection = String(note?.selection || "").trim().slice(0, 900);
        const insight = String(note?.refinedInsight || note?.atomicThought || note?.aiDiscussionSummary || "").trim().slice(0, 500);

        const CATEGORIES = [
            "Tech",
            "Business",
            "Health",
            "Science",
            "Society",
            "Politics",
            "Finance",
            "Education",
            "Culture",
            "Other"
        ];

        const SCHEMA = {
            type: "object",
            properties: {
                category: { type: "string", enum: CATEGORIES },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 5
                }
            },
            required: ["category", "tags"]
        };

        const systemPrompt = `
You are a memory note classifier. Output JSON only.

Category must be one of: ${CATEGORIES.join(", ")}.

Dynamic tags:
- Return 2-5 short tags that help grouping (e.g., "AI Agents", "Mental Models").
- No leading "#".
- Avoid duplicates.

Note:
Title: ${title || "(none)"}
URL: ${url || "(none)"}
Selection:
"""${selection || "(none)"}"""
Key insight (if any):
"""${insight || "(none)"}"""

Output JSON only: { "category": "...", "tags": ["...", "..."] }
        `.trim();

        return this._callCloudGemini(systemPrompt, SCHEMA, 8000, 1, {
            priority: "background",
            allowFallback: true
        });
    }

    // =================================================================
    // 3. CORE ENGINE (Robust API Call)
    // =================================================================

    /**
     * Gọi Gemini với cơ chế Retry & Timeout
     * @param {number} retries - Số lần thử lại nếu gặp lỗi 429/5xx
     */
    async _callCloudGemini(prompt, responseSchema, timeoutMs = 8000, retries = 1, options = {}) {
        const key = await this._getApiKey();
        if (!key) throw new Error("Missing API Key");

        let modelOverride = "";
        let allowFallback = true;
        let priority = 'background';
        let safeOptions = options;
        let fallbackChain = [];

        if (typeof options === 'string') {
            modelOverride = options;
            safeOptions = {};
        } else if (!options || typeof options !== 'object') {
            safeOptions = {};
        }

        if (safeOptions) {
            if (typeof safeOptions.modelOverride === 'string') {
                modelOverride = safeOptions.modelOverride;
            }
            if (safeOptions.priority === 'vip') {
                priority = 'vip';
            }
            if (typeof safeOptions.allowFallback === 'boolean') {
                allowFallback = safeOptions.allowFallback;
            } else {
                allowFallback = priority === 'background';
            }
            if (Array.isArray(safeOptions.fallbackChain)) {
                fallbackChain = safeOptions.fallbackChain;
            }
        }

        if (!modelOverride && fallbackChain.length === 0) {
            const configuredChain = AI_CONFIG.MODELS?.USER?.fallback_chain;
            if (Array.isArray(configuredChain) && configuredChain.length > 0) {
                fallbackChain = [...configuredChain];
            } else if (AI_CONFIG.MODELS?.USER?.fallback) {
                fallbackChain = [AI_CONFIG.MODELS.USER.fallback];
            }
        }

        const model = modelOverride || getModel('USER');
        const url = `${this.API_BASE}/${model}:generateContent?key=${key}`;
        const generationConfig = {
            temperature: 0.5,
            maxOutputTokens: 8192
        };
        if (responseSchema) {
            generationConfig.responseMimeType = "application/json";
            generationConfig.responseSchema = responseSchema;
        }
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig
        };

        let lastError;

        // [FIX 5] Vòng lặp Retry
        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const runRequest = async () => fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });
                const response = await this.rateManager.enqueue(runRequest, {
                    priority,
                    allowDuringCooldown: priority === 'vip',
                    skipDuringCooldown: priority !== 'vip'  // Skip background tasks during cooldown
                });

                // Nếu thành công -> Thoát vòng lặp
                if (response.ok) {
                    clearTimeout(timeoutId);
                    const data = await response.json();
                    const rawJSON = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!rawJSON) throw new Error("Empty Response");
                    if (!responseSchema) {
                        return rawJSON;
                    }
                    return JSON.parse(rawJSON);
                }

                // Nếu lỗi Client (400, 401, 404) -> Không Retry, lỗi luôn
                if (response.status < 500 && response.status !== 429) {
                    const errText = await response.text().catch(() => "");
                    const detail = errText ? `: ${errText.slice(0, 300)}` : "";
                    throw new Error(`API Error ${response.status}${detail}`);
                }

                // Nếu lỗi Server (5xx) hoặc Rate Limit (429) -> Ném lỗi để catch bên dưới xử lý retry
                if (response.status === 429) {
                    this.rateManager.record429Error('ai-service');
                    const retryHeader = response.headers.get("Retry-After");
                    const retryHeaderSeconds = retryHeader ? Number(retryHeader) : null;
                    const errText = await response.text().catch(() => "");
                    const retrySeconds = Number.isFinite(retryHeaderSeconds)
                        ? retryHeaderSeconds
                        : parseRetryAfterSeconds(errText);
                    if (Number.isFinite(retrySeconds)) {
                        this.rateManager.setCooldown((retrySeconds + 1) * 1000, 'ai-service-429');
                    }
                    if (priority === 'background' && allowFallback && fallbackChain.length > 0) {
                        const nextModel = fallbackChain[0];
                        const remainingChain = fallbackChain.slice(1);
                        console.log('[ATOM AI] 429 received, trying fallback model:', nextModel);
                        this.rateManager.recordFallback();
                        return this._callCloudGemini(prompt, responseSchema, timeoutMs, 0, {
                            ...(safeOptions || {}),
                            modelOverride: nextModel,
                            fallbackChain: remainingChain,
                            allowFallback: true,
                            priority
                        });
                    }
                } else if (response.status >= 500) {
                    this.rateManager.recordServerError();
                }
                throw new Error(`Retryable Error ${response.status}`);

            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;

                // Nếu là lần thử cuối cùng thì throw luôn
                if (attempt === retries) break;

                // Backoff: Đợi 1s * 2^attempt (1s, 2s, 4s...)
                const delay = 1000 * Math.pow(2, attempt);
                // console.log(`ATOM Retry ${attempt + 1}/${retries} after ${delay}ms`);
                this.rateManager.recordRetry();
                await new Promise(r => setTimeout(r, delay));
            }
        }

        throw lastError;
    }

    // --- HELPERS ---

    // [FIX 1] Hàm lấy Value chuẩn xác
    _getCacheValue(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.value;
    }

    _setCache(key, value) {
        this.cache.set(key, { value, expiry: Date.now() + this.CACHE_TTL });
    }

    // [FIX 4] Sanitize Input - Kẹp số liệu để cache hiệu quả
    _sanitizeContext(raw) {
        return {
            // Kẹp điểm kháng cự 0-10
            resistance: Math.max(0, Math.min(raw.resistance_score || 0, 10)),
            // Kẹp streak tối đa 20
            streak: Math.min(raw.ignored_streak || 0, 20),
            // Làm tròn scroll depth (vd: 185s -> 180s) để gom nhóm cache
            depth: Math.floor((raw.scroll_depth || 0) / 10) * 10,
            // Giới hạn 5 tags đầu tiên
            sentiment_tags: (raw.sentiment_tags || []).slice(0, 5)
        };
    }

    async _getApiKey() {
        const data = await chrome.storage.local.get(['user_gemini_key']);
        return data.user_gemini_key || null;
    }
}

// Export singleton instance for shared use
export const AI_SERVICE = new AIService();
