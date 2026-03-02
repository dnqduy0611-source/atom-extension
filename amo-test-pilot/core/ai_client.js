/**
 * core/ai_client.js — OpenRouter API wrapper for Node.js
 * Rewritten từ ai/providers/openrouter.js (IIFE) thành ES module
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_HEADERS = {
    'HTTP-Referer': 'https://amoisekai.com',
    'X-Title': 'Amo Test Pilot',
};

export class AIClient {
    constructor(apiKey, options = {}) {
        this.apiKey = apiKey;
        this.defaultModel = options.model || 'deepseek/deepseek-chat-v3';
        this.timeout = options.timeout || 120000; // 2 min — code gen có thể chậm
        this.maxRetries = options.maxRetries || 3;
        this.fallbackModels = options.fallbackModels || [
            'deepseek/deepseek-chat-v3',
            'google/gemini-2.0-flash-001',
        ];
    }

    /**
     * Gọi OpenRouter API với retry + fallback.
     * @param {{ model?: string, messages: Array, temperature?: number, maxTokens?: number }} params
     * @returns {Promise<string>}
     */
    async call({ model, messages, temperature, maxTokens }) {
        const targetModel = model || this.defaultModel;
        let lastError;

        // Try primary model with retries
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                return await this._singleCall({ model: targetModel, messages, temperature, maxTokens });
            } catch (err) {
                lastError = err;
                const retryable = err.status === 429 || err.status === 502 || err.status === 503
                    || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed');

                if (!retryable || attempt === this.maxRetries - 1) break;

                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.warn(`  [AI] Retry ${attempt + 1}/${this.maxRetries} after ${delay}ms (${err.status || err.message})`);
                await new Promise(r => setTimeout(r, delay));
            }
        }

        // Try fallback models
        for (const fallback of this.fallbackModels) {
            if (fallback === targetModel) continue;
            console.warn(`  [AI] Trying fallback model: ${fallback}`);
            try {
                return await this._singleCall({ model: fallback, messages, temperature, maxTokens });
            } catch (err) {
                lastError = err;
                console.warn(`  [AI] Fallback ${fallback} failed: ${err.message}`);
            }
        }

        throw lastError;
    }

    /** @private Single API call without retry */
    async _singleCall({ model, messages, temperature, maxTokens }) {
        const response = await fetch(OPENROUTER_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...OPENROUTER_HEADERS,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: temperature ?? 0.3,
                max_tokens: maxTokens ?? 8192,
                stream: false,
            }),
            signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.error?.message || `OpenRouter API error ${response.status}`;
            const err = new Error(msg);
            err.status = response.status;
            throw err;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from AI — check model availability on OpenRouter');
        }
        return content;
    }

    /**
     * Gọi OpenRouter với vision (images embed trong msg.images).
     * Images KHÔNG truyền ở top-level, embed trong từng message object.
     *
     * @param {{ model?: string, messages: Array<{role, content, images?: Array<{mimeType, data}>}>, temperature?: number, maxTokens?: number }} params
     * @returns {Promise<string>}
     */
    async callWithVision({ model, messages, temperature, maxTokens }) {
        const visionMessages = messages.map(msg => {
            if (msg.images && msg.images.length > 0) {
                return {
                    role: msg.role,
                    content: [
                        { type: 'text', text: msg.content },
                        ...msg.images.map(img => ({
                            type: 'image_url',
                            image_url: {
                                url: `data:${img.mimeType};base64,${img.data}`,
                            },
                        })),
                    ],
                };
            }
            return { role: msg.role, content: msg.content };
        });

        return this.call({
            model: model || 'google/gemini-2.0-flash-001',
            messages: visionMessages,
            temperature,
            maxTokens,
        });
    }
}
