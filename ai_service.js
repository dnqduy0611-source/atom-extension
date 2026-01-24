// ai_service.js - PRODUCTION GRADE ADAPTER (V3.0 FIXED)
// Fixed: Cache Value, Schema Types, Retry Logic, Sanitization

export class AIService {
    constructor() {
        this.MODEL_NAME = "gemini-1.5-flash"; 
        this.API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
        
        // Cache In-Memory
        this.cache = new Map();
        this.CACHE_TTL = 30000; // 30s TTL
    }

    // =================================================================
    // 1. CRITICAL PATH: RA QUYẾT ĐỊNH
    // =================================================================
    
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
            required: ["intent", "intensity", "risk_tolerance"],
            additionalProperties: false // [FIX 2] Khóa chặt output
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
            required: ["template"],
            additionalProperties: false
        };

        const lang = chrome.i18n.getUILanguage().startsWith('vi') ? 'Vietnamese' : 'English';

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
    // 3. CORE ENGINE (Robust API Call)
    // =================================================================

    /**
     * Gọi Gemini với cơ chế Retry & Timeout
     * @param {number} retries - Số lần thử lại nếu gặp lỗi 429/5xx
     */
    async _callCloudGemini(prompt, responseSchema, timeoutMs = 8000, retries = 1) {
        const key = await this._getApiKey();
        if (!key) throw new Error("Missing API Key");

        const url = `${this.API_BASE}/${this.MODEL_NAME}:generateContent?key=${key}`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 100,
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        };

        let lastError;

        // [FIX 5] Vòng lặp Retry
        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                // Nếu thành công -> Thoát vòng lặp
                if (response.ok) {
                    clearTimeout(timeoutId);
                    const data = await response.json();
                    const rawJSON = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!rawJSON) throw new Error("Empty Response");
                    return JSON.parse(rawJSON);
                }

                // Nếu lỗi Client (400, 401, 404) -> Không Retry, lỗi luôn
                if (response.status < 500 && response.status !== 429) {
                    throw new Error(`API Error ${response.status}`);
                }

                // Nếu lỗi Server (5xx) hoặc Rate Limit (429) -> Ném lỗi để catch bên dưới xử lý retry
                throw new Error(`Retryable Error ${response.status}`);

            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                
                // Nếu là lần thử cuối cùng thì throw luôn
                if (attempt === retries) break;

                // Backoff: Đợi 1s * 2^attempt (1s, 2s, 4s...)
                const delay = 1000 * Math.pow(2, attempt);
                // console.log(`ATOM Retry ${attempt + 1}/${retries} after ${delay}ms`);
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