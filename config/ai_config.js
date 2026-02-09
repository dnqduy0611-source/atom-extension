// config/ai_config.js - Centralized AI Configuration
// Dual-access: ES Module export + Chrome Storage sync for IIFE modules

/**
 * AI Model Tiers:
 * - PILOT: Backend/Background tasks (doomscrolling detection, strategy generation)
 *          Optimized for speed & cost
 * - USER:  Frontend/User-facing tasks (Chat, Active Reading, Context Menu)
 *          Optimized for reasoning quality
 */
/**
 * Supported LLM Providers
 */
export const PROVIDERS = {
    GOOGLE: 'google',
    OPENROUTER: 'openrouter'
};

export const AI_CONFIG = {
    // Active provider (default: Google Gemini)
    PROVIDER: PROVIDERS.GOOGLE,

    MODELS: {
        // Backend: Optimized for speed & cost (Doomscrolling, Strategy)
        PILOT: {
            primary: "gemini-2.5-flash-lite",
            fallback: "gemini-2.5-flash"
        },
        // Frontend: Optimized for reasoning & nuance (Chat, Active Reading)
        // Using gemini-3-flash-preview
        USER: {
            primary: "gemini-2.5-flash", // "2.5 Flash"
            fallback: "gemini-2.5-flash-lite",
            fallback_chain: [
                "gemini-2.5-flash-lite", // "2.5 Flash-lite"
                "gemini-3-flash-preview", // "3.0 Flash"
                "openrouter"
            ]
        }
    },
    API: {
        // Google Gemini
        GOOGLE: {
            BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models"
        },
        // OpenRouter (OpenAI-compatible)
        OPENROUTER: {
            BASE_URL: "https://openrouter.ai/api/v1",
            DEFAULT_MODEL: "stepfun/step-3.5-flash:free",
            FALLBACK_CHAIN: [
                "stepfun/step-3.5-flash:free",
                "meta-llama/llama-3.3-70b-instruct:free",
                "deepseek/deepseek-r1:free"
            ],
            // Popular free models for reference:
            // - google/gemini-2.0-flash-exp:free
            // - meta-llama/llama-3.3-70b-instruct:free
            // - deepseek/deepseek-r1:free
            // - mistralai/mistral-small-3.1-24b-instruct:free
            HEADERS: {
                'HTTP-Referer': 'https://atomextension.com',
                'X-Title': 'ATOM Extension'
            }
        }
    },
    DEFAULTS: {
        TIMEOUT_MS: 30000,
        MAX_OUTPUT_TOKENS: 2048,
        TEMPERATURE: {
            PRECISE: 0.4,    // Analysis, Strategy, Evaluation
            BALANCED: 0.5,   // General purpose
            CREATIVE: 0.7    // Chat, Creative writing
        }
    },
    RETRY: {
        MAX_ATTEMPTS: 3,
        BASE_DELAY_MS: 1000,
        BACKOFF_MULTIPLIER: 2
    },
    CACHE: {
        STRATEGY_TTL_MS: 30000,      // 30s for strategy cache
        PILOT_TTL_MS: 300000,        // 5 min for pilot classification cache
        SMARTLINK_TTL_MS: 600000,    // 10 min
        RELATED_MEMORY_TTL_MS: 600000, // 10 min
        DEEP_ANGLE_TTL_MS: 21600000, // 6 hours
        DEFAULT_BACKGROUND_TTL_MS: 300000, // 5 min
        VIP_CACHE_ENABLED: false     // VIP should not cache
    }
};

// Storage key for runtime access (sidepanel.js, content.js)
export const AI_CONFIG_STORAGE_KEY = "atom_ai_config_v1";

/**
 * Sync config to Chrome Storage for IIFE modules (sidepanel.js)
 * Call once at background.js startup
 */
export async function syncConfigToStorage() {
    try {
        await chrome.storage.local.set({
            [AI_CONFIG_STORAGE_KEY]: AI_CONFIG
        });
        console.log("[AI Config] Synced to storage");
    } catch (error) {
        console.error("[AI Config] Failed to sync:", error);
    }
}

/**
 * Get model name for a tier
 * @param {'PILOT'|'USER'} tier - The model tier
 * @param {boolean} useFallback - Use fallback model instead of primary
 * @returns {string} Model name
 */
export function getModel(tier, useFallback = false) {
    const modelConfig = AI_CONFIG.MODELS[tier];
    if (!modelConfig) {
        console.warn(`[AI Config] Unknown tier: ${tier}, defaulting to USER`);
        return AI_CONFIG.MODELS.USER.primary;
    }
    return useFallback ? modelConfig.fallback : modelConfig.primary;
}

/**
 * Get temperature for a task type
 * @param {'PRECISE'|'BALANCED'|'CREATIVE'} type - Temperature type
 * @returns {number} Temperature value
 */
export function getTemperature(type) {
    return AI_CONFIG.DEFAULTS.TEMPERATURE[type] ?? AI_CONFIG.DEFAULTS.TEMPERATURE.BALANCED;
}
