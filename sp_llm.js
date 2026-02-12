/**
 * sp_llm.js — LLM Provider Adapter Layer
 * Phase 4a of Sidepanel Module Split
 *
 * Handles: Provider routing (Gemini/OpenRouter), multi-model fallback,
 * retry with exponential backoff, rate limiting, error handling.
 *
 * DOES NOT handle: Chat logic, message rendering, thread management.
 * Those stay in sidepanel.js's sendToGemini().
 *
 * Dependencies (read from window.SP):
 *   SP.API_CONFIG, SP.getMessage, SP.showToast, SP.getApiKey, SP.elements
 *
 * External window services:
 *   window.RateLimitManager, window.__ATOM_RATE_MANAGER__,
 *   window.parseRetryAfterSeconds
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[LLM] SP not found'); return; }

    // ── State ──
    let retryingState = {
        active: false,
        previousText: '',
        previousStatusClass: ''
    };
    let rateLimitCountdownInterval = null;

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }

    // ── Error Types ──
    class ApiError extends Error {
        constructor(message, status, code) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = code;
        }
    }

    // ===========================
    // Error Handling Utilities
    // ===========================
    async function parseApiError(response) {
        try {
            const data = await response.json();
            const error = data.error || {};
            return {
                message: error.message || getStatusMessage(response.status),
                code: error.code || response.status,
                status: response.status
            };
        } catch (e) {
            return {
                message: getStatusMessage(response.status),
                code: response.status,
                status: response.status
            };
        }
    }

    function getStatusMessage(status) {
        const messages = {
            400: getMessage('sp_error_bad_request', 'Invalid request'),
            401: getMessage('sp_error_unauthorized', 'API key is invalid'),
            403: getMessage('sp_error_forbidden', 'Access denied'),
            404: getMessage('sp_error_not_found', 'API endpoint not found'),
            429: getMessage('sp_error_rate_limit', 'Too many requests. Please wait.'),
            500: getMessage('sp_error_server', 'Server error. Try again later.'),
            502: getMessage('sp_error_server', 'Server error. Try again later.'),
            503: getMessage('sp_error_unavailable', 'Service unavailable. Try again later.'),
            504: getMessage('sp_error_timeout', 'Request timed out. Try again.')
        };
        return messages[status] || getMessage('sp_error_unknown', 'An error occurred');
    }

    function isRetryableError(status) {
        // Retry on server errors and rate limits
        return status >= 500 || status === 429;
    }

    function isNetworkError(error) {
        return error.name === 'AbortError' ||
            error.name === 'TypeError' ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError');
    }

    function calculateRetryDelay(attempt) {
        // Exponential backoff: 1s, 2s, 4s, 8s...
        const cfg = SP.API_CONFIG || {};
        return (cfg.RETRY_BASE_DELAY_MS || 1000) * Math.pow(2, attempt - 1);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===========================
    // Retry UI State
    // ===========================
    function showRetryingState(attempt, maxAttempts) {
        const elements = SP.elements || {};
        if (!elements.contextText || !elements.contextStatus) return;

        if (!retryingState.active) {
            retryingState.active = true;
            retryingState.previousText = elements.contextText.textContent || '';
            retryingState.previousStatusClass = elements.contextStatus.className || 'status-dot';
        }

        const retryMsg = getMessage('sp_retrying', 'Retrying');
        elements.contextText.textContent = `${retryMsg} (${attempt}/${maxAttempts})...`;
        elements.contextText.classList.add('status-retrying');
        elements.contextStatus.className = 'status-dot loading';
    }

    function clearRetryingState() {
        const elements = SP.elements || {};
        if (!retryingState.active) return;
        if (elements.contextText) {
            elements.contextText.classList.remove('status-retrying');
            if (retryingState.previousText) {
                elements.contextText.textContent = retryingState.previousText;
            }
        }
        if (elements.contextStatus && retryingState.previousStatusClass) {
            elements.contextStatus.className = retryingState.previousStatusClass;
        }
        retryingState = {
            active: false,
            previousText: '',
            previousStatusClass: ''
        };
    }

    function showRetryNotification(attempt, maxAttempts, priority) {
        if (priority === 'vip') {
            showRetryingState(attempt, maxAttempts);
        }
        const retryMsg = getMessage('sp_retrying', 'Retrying');
        showToast(`${retryMsg} (${attempt}/${maxAttempts})...`, 'info');
    }

    // ===========================
    // Rate Limit Countdown Display
    // ===========================
    function showRateLimitCountdown(seconds) {
        // Clear any existing countdown
        clearRateLimitCountdown();

        const elements = SP.elements || {};
        if (!elements.contextText || !elements.contextStatus) return;

        // Save previous state
        const previousText = elements.contextText.textContent || '';
        const previousStatusClass = elements.contextStatus.className || 'status-dot';

        // Set initial countdown display
        let remaining = Math.ceil(seconds);
        const updateDisplay = () => {
            const waitMsg = getMessage('sp_rate_limit_countdown', 'Retry in');
            elements.contextText.textContent = `${waitMsg} ${remaining}s...`;
            elements.contextText.classList.add('status-cooldown');
            elements.contextStatus.className = 'status-dot cooldown';
        };

        updateDisplay();

        // Show toast with wait time
        const toastMsg = getMessage('sp_rate_limit_wait', 'Rate limit reached. Please wait');
        showToast(`${toastMsg} ${remaining}s`, 'warning');

        // Start countdown
        rateLimitCountdownInterval = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearRateLimitCountdown();
                // Restore previous state
                elements.contextText.textContent = previousText || getMessage('sp_ready', 'Ready');
                elements.contextText.classList.remove('status-cooldown');
                elements.contextStatus.className = previousStatusClass;
                showToast(getMessage('sp_rate_limit_ready', 'Ready to continue'), 'success');
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    function clearRateLimitCountdown() {
        if (rateLimitCountdownInterval) {
            clearInterval(rateLimitCountdownInterval);
            rateLimitCountdownInterval = null;
        }
        const elements = SP.elements || {};
        if (elements.contextText) {
            elements.contextText.classList.remove('status-cooldown');
        }
        if (elements.contextStatus) {
            elements.contextStatus.classList.remove('cooldown');
        }
    }

    // ===========================
    // LLM Provider Adapter
    // ===========================
    async function getLLMProvider() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'atom_llm_provider',
                'atom_openrouter_key',
                'atom_openrouter_model'
            ], (result) => {
                resolve({
                    provider: result.atom_llm_provider || 'google',
                    openrouterKey: result.atom_openrouter_key || '',
                    // Default to Llama 3.3, avoiding the broken Gemini Free model
                    openrouterModel: result.atom_openrouter_model || 'meta-llama/llama-3.3-70b-instruct:free'
                });
            });
        });
    }

    // Convert Gemini 'contents' format to OpenAI 'messages' format
    function convertToOpenRouterMessages(systemPrompt, geminiContents) {
        const messages = [];

        // Add system message
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Convert Gemini contents to OpenAI messages
        for (const item of geminiContents) {
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

        // Intercept broken/unavailable model and swap to Step 3.5 Flash (High Availability)
        let targetModel = model;
        if (targetModel === 'google/gemini-2.0-flash-exp:free') {
            console.warn('[ATOM AI] Intercepting broken model request. Swapping to Step 3.5 Flash.');
            targetModel = 'stepfun/step-3.5-flash:free';
        }

        const body = {
            model: targetModel,
            messages: messages,
            temperature: generationConfig.temperature ?? 0.7,
            max_tokens: generationConfig.maxOutputTokens ?? 4096,
            stream: false
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openrouterKey}`,
                'HTTP-Referer': 'https://atomextension.com',
                'X-Title': 'ATOM Extension'
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

    // ===========================
    // Main API Functions
    // ===========================

    // Unified LLM caller - automatically routes to appropriate provider with fallback
    async function callLLMAPI(systemPrompt, conversationHistory, options = {}) {
        const llmConfig = await getLLMProvider();
        const geminiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));

        // 1. Forced OpenRouter Mode
        if (llmConfig.provider === 'openrouter') {
            if (llmConfig.openrouterKey) {
                const messages = convertToOpenRouterMessages(systemPrompt, conversationHistory);

                try {
                    return await callOpenRouterAPI(
                        llmConfig.openrouterKey,
                        llmConfig.openrouterModel,
                        messages,
                        options.generationConfig || {}
                    );
                } catch (primaryError) {
                    console.warn('[ATOM AI] Primary OpenRouter model failed. Trying fallbacks...', primaryError);
                    showToast(getMessage('sp_switching_fallback', 'Model unavailable. Trying backup...'), 'info');

                    // Fallback 1: Step 3.5 Flash (High Uptime)
                    try {
                        return await callOpenRouterAPI(
                            llmConfig.openrouterKey,
                            "stepfun/step-3.5-flash:free",
                            messages,
                            options.generationConfig || {}
                        );
                    } catch (stepError) {
                        console.warn('[ATOM AI] Step 3.5 failed. Trying Gemini Flash Lite...', stepError);

                        // Fallback 2: Gemini Flash Lite
                        try {
                            return await callOpenRouterAPI(
                                llmConfig.openrouterKey,
                                "google/gemini-2.0-flash-lite-preview-02-05:free",
                                messages,
                                options.generationConfig || {}
                            );
                        } catch (geminiError) {
                            console.warn('[ATOM AI] Gemini Flash Lite failed. Trying Mistral...', geminiError);

                            // Fallback 3: Mistral
                            try {
                                return await callOpenRouterAPI(
                                    llmConfig.openrouterKey,
                                    "mistralai/mistral-small-24b-instruct-2501:free",
                                    messages,
                                    options.generationConfig || {}
                                );
                            } catch (finalError) {
                                throw primaryError; // Throw original error if all fail
                            }
                        }
                    }
                }
            } else {
                throw new Error('OpenRouter provider selected but no API Key set.');
            }
        }

        // 2. Default Gemini Mode (with auto-fallback)
        if (!geminiKey) {
            throw new Error('No API key configured');
        }

        try {
            return await callGeminiAPI(geminiKey, systemPrompt, conversationHistory, 1, options);
        } catch (error) {
            // Check for Rate Limit (429) to trigger fallback
            if (error instanceof ApiError && error.status === 429) {
                console.warn('[ATOM AI] Gemini Rate Limited (429). Attempting OpenRouter Fallback...');

                // Fallback Strategy: Use OpenRouter (Step 3.5 -> Gemini Flash Lite -> Mistral)
                if (llmConfig.openrouterKey) {
                    showToast(getMessage('sp_switching_fallback', 'Switching to Step 3.5 Flash (Fallback)...'), 'info');
                    const messages = convertToOpenRouterMessages(systemPrompt, conversationHistory);

                    // Explicitly use Step 3.5 Flash as first choice
                    const fallbackModel = "stepfun/step-3.5-flash:free";

                    try {
                        return await callOpenRouterAPI(
                            llmConfig.openrouterKey,
                            fallbackModel,
                            messages,
                            options.generationConfig || {}
                        );
                    } catch (stepError) {
                        console.warn('[ATOM AI] Step 3.5 Fallback failed, trying Gemini Flash Lite:', stepError);

                        // Second layer: Gemini Flash Lite
                        try {
                            return await callOpenRouterAPI(
                                llmConfig.openrouterKey,
                                "google/gemini-2.0-flash-lite-preview-02-05:free",
                                messages,
                                options.generationConfig || {}
                            );
                        } catch (geminiError) {
                            console.warn('[ATOM AI] Gemini Flash Lite failed, trying Mistral:', geminiError);

                            // Third layer: Mistral
                            try {
                                return await callOpenRouterAPI(
                                    llmConfig.openrouterKey,
                                    "mistralai/mistral-small-24b-instruct-2501:free",
                                    messages,
                                    options.generationConfig || {}
                                );
                            } catch (mistralError) {
                                console.error('[ATOM AI] All fallbacks failed.');
                                throw error; // Throw original Gemini error
                            }
                        }
                    }
                } else {
                    // No OpenRouter Key set - Prompt user?
                    // For now, allow it to fail, but maybe show a helpful toast
                    console.warn('[ATOM AI] No OpenRouter key for fallback.');
                    // Optional: You could implement a public proxy here if you had one, but strict adherence to user rules means we stick to their keys.
                }
            }
            throw error;
        }
    }

    async function callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt = 1, options = {}) {
        const cfg = SP.API_CONFIG || {};
        const priority = options?.priority === 'background' ? 'background' : 'vip';
        const shouldShowRetryState = priority === 'vip';
        const modelOverride = typeof options?.modelOverride === 'string' ? options.modelOverride : '';
        const modelName = modelOverride || cfg.MODEL_NAME;

        // Fallback Logic Setup
        let fallbackChain = [];
        if (options?.fallbackChain && Array.isArray(options.fallbackChain)) {
            fallbackChain = options.fallbackChain;
        } else if (!modelOverride && cfg.FALLBACK_CHAIN && cfg.FALLBACK_CHAIN.length > 0) {
            // Initial call: load chain from config
            fallbackChain = [...cfg.FALLBACK_CHAIN];
        } else if (!modelOverride && cfg.FALLBACK_MODEL) {
            // Legacy single fallback support
            fallbackChain = [cfg.FALLBACK_MODEL];
        }

        const allowFallback = typeof options?.allowFallback === 'boolean'
            ? options.allowFallback
            : true; // Default to true unless explicitly disabled

        const errorSource = typeof options?.errorSource === 'string'
            ? options.errorSource
            : (priority === 'background' ? 'sidepanel-background' : 'sidepanel-chat');
        const url = `${cfg.API_BASE}/${modelName}:generateContent?key=${apiKey}`;
        const rateManager = window.RateLimitManager
            ? (window.__ATOM_RATE_MANAGER__ || (window.__ATOM_RATE_MANAGER__ = new window.RateLimitManager({
                rpmTotal: 15,
                rpmBackground: 8,
                cacheTtlMs: cfg.CACHE?.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000
            })))
            : null;
        const vipCacheEnabled = cfg.CACHE?.VIP_CACHE_ENABLED === true;
        let cacheKey = typeof options?.cacheKey === 'string' ? options.cacheKey : '';
        let cacheTtlMs = Number.isFinite(options?.cacheTtlMs) ? options.cacheTtlMs : undefined;

        if (priority === 'vip' && !vipCacheEnabled) {
            cacheKey = '';
            cacheTtlMs = 0;
        } else if (cacheKey && !Number.isFinite(cacheTtlMs)) {
            cacheTtlMs = cfg.CACHE?.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000;
        }

        const rateOptions = {
            priority,
            cacheKey,
            cacheTtlMs
        };
        if (typeof options?.allowDuringCooldown === 'boolean') {
            rateOptions.allowDuringCooldown = options.allowDuringCooldown;
        }
        // Default background jobs to skip during cooldown to prevent infinite retry loop
        if (typeof options?.skipDuringCooldown === 'boolean') {
            rateOptions.skipDuringCooldown = options.skipDuringCooldown;
        } else if (priority === 'background') {
            rateOptions.skipDuringCooldown = true; // Auto-skip background jobs during cooldown
        }

        const generationConfig = {
            temperature: 0.7,
            maxOutputTokens: 8192,
            ...(options && typeof options.generationConfig === 'object'
                ? options.generationConfig
                : {})
        };

        const body = {
            contents: conversationHistory,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig
        };

        try {
            const runRequest = async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), cfg.TIMEOUT_MS || 30000);
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return response;
                } catch (err) {
                    clearTimeout(timeoutId);
                    throw err;
                }
            };

            const response = rateManager
                ? await rateManager.enqueue(runRequest, rateOptions)
                : await runRequest();

            if (!response.ok) {
                const errorData = await parseApiError(response);
                if (response.status === 429 && rateManager) {
                    rateManager.record429Error(errorSource);
                    // Use standard rate limit handling/cooldown even if falling back
                    const retryAfterHeader = response.headers.get('Retry-After');
                    const retryAfterHeaderSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
                    const retryAfterSeconds = window.parseRetryAfterSeconds
                        ? window.parseRetryAfterSeconds(errorData.message)
                        : null;
                    const retrySeconds = Number.isFinite(retryAfterHeaderSeconds)
                        ? retryAfterHeaderSeconds
                        : retryAfterSeconds;

                    if (Number.isFinite(retrySeconds)) {
                        const cooldownMs = (retrySeconds + 1) * 1000;
                        rateManager.setCooldown(cooldownMs, 'sidepanel-429');
                        // Only show toast if NOT falling back (fallback happens silently/quickly)
                        if (!allowFallback || fallbackChain.length === 0) {
                            const seconds = Math.ceil(cooldownMs / 1000);
                            const msg = getMessage('sp_rate_limit_cooldown', `Rate limit exceeded. Waiting ${seconds}s...`);
                            showToast(msg, 'warning');
                        }
                    }
                }

                if (response.status >= 500 && rateManager) {
                    rateManager.recordServerError();
                }

                // FALLBACK LOGIC (CHAIN)
                if ((response.status === 429 || response.status >= 500) && allowFallback) {
                    if (fallbackChain.length > 0) {
                        const nextModel = fallbackChain[0];
                        const remainingChain = fallbackChain.slice(1);
                        console.log(`[ATOM AI] ${response.status} received. Falling back to: ${nextModel}. Remaining: ${remainingChain.length}`);

                        if (rateManager) rateManager.recordFallback();

                        return callGeminiAPI(apiKey, systemPrompt, conversationHistory, 1, {
                            ...options,
                            priority,
                            modelOverride: nextModel,
                            fallbackChain: remainingChain, // Pass remaining chain
                            allowFallback: true, // Keep allowing fallback until chain empty
                            // Allow next call to bypass cooldown of *this* model (since it's a diff model)
                            // Note: RateManager tracks global domain cooldown. We might need to implement per-model tracking later.
                            // For now, assume changing model helps.
                            skipDuringCooldown: false,
                            allowDuringCooldown: true
                        });
                    } else {
                        console.warn('[ATOM AI] Fallback chain exhausted.');
                    }
                }

                // Check if error is retryable (only if NOT falling back or chain exhausted)
                const maxAttempts = cfg.RETRY_MAX_ATTEMPTS || 3;
                if (isRetryableError(response.status) && attempt < maxAttempts) {
                    if (rateManager && rateManager.isInCooldown()) {
                        console.log('[API] In cooldown, aborting retry to prevent infinite loop');
                        if (shouldShowRetryState) clearRetryingState();
                        throw new ApiError(
                            'Rate limit cooldown active. Please wait before retrying.',
                            response.status,
                            'COOLDOWN_ACTIVE'
                        );
                    }

                    const delay = calculateRetryDelay(attempt);
                    console.log(`[API] Retry attempt ${attempt + 1} after ${delay}ms`);
                    showRetryNotification(attempt, maxAttempts, priority);
                    if (rateManager) {
                        rateManager.recordRetry();
                    }
                    await sleep(delay);
                    return callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt + 1, options);
                }

                if (shouldShowRetryState) {
                    clearRetryingState();
                }
                throw new ApiError(errorData.message, response.status, errorData.code);
            }

            if (shouldShowRetryState) {
                clearRetryingState();
            }
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (error) {
            // Handle network errors with retry
            const maxAttempts = cfg.RETRY_MAX_ATTEMPTS || 3;
            if (isNetworkError(error) && attempt < maxAttempts) {
                if (rateManager && rateManager.isInCooldown()) {
                    console.log('[API] In cooldown, aborting network retry to prevent infinite loop');
                    if (shouldShowRetryState) clearRetryingState();
                    throw error;
                }

                const delay = calculateRetryDelay(attempt);
                console.log(`[API] Network error, retry attempt ${attempt + 1} after ${delay}ms`);
                showRetryNotification(attempt, maxAttempts, priority);
                if (rateManager) {
                    rateManager.recordRetry();
                }
                await sleep(delay);
                return callGeminiAPI(apiKey, systemPrompt, conversationHistory, attempt + 1, options);
            }

            if (shouldShowRetryState) {
                clearRetryingState();
            }
            throw error;
        }
    }

    // ── Expose API on SP ──
    SP.callLLMAPI = callLLMAPI;
    SP.callGeminiAPI = callGeminiAPI;
    SP.getLLMProvider = getLLMProvider;
    SP.ApiError = ApiError;
    SP.showRateLimitCountdown = showRateLimitCountdown;
    SP.clearRateLimitCountdown = clearRateLimitCountdown;

    console.log('[SP:LLM] Module loaded');
})();
