/**
 * Topic Router Handlers - Message handlers for topic routing operations
 * To be called from background.js message listener
 */
console.log('[ATOM] Loading topic_router_handlers.js...');

import { routeTopic, routeTopicWithCandidates, quickMatchCheck, getRoutingStats } from "./topic_router.js";
console.log('[ATOM] Imported topic_router.js');
import { loadRegistry, upsertTopic, recordUsage, completePendingTopic, getPendingTopic, setPendingTopic, clearPendingTopic, deleteTopic } from "./topic_registry.js";
import { buildPromptPayload, buildConfirmMappingPrompt, buildToastPayload, ACTION } from "./ui_prompt.js";
import { formatAtomClip } from "./clip_format.js";
import { resolveNotebookUrl } from "./notebooklm_connector.js";
import { loadNlmSettings } from "./bridge_service.js";
import {
    logRouterEvent,
    logSuggested,
    logChosenExisting,
    logCreatedNew,
    logSkipped,
    logMappingSaved,
    logError,
    logOpenToRecall,
    NLM_ROUTER_EVENTS
} from "./topic_router_logging.js";
import {
    processQueue,
    retryJob,
    cancelJob,
    getJobsForDisplay,
    clearFailedJobs,
    setupQueueProcessor,
    handleQueueAlarm
} from "./queue_processor.js";

// Re-export for background.js
export { setupQueueProcessor, handleQueueAlarm };
import { getQueueSummary } from "./export_queue.js";

// AI Title Generator (lazy loaded to avoid startup overhead)
let aiTitleGenerator = null;
async function getAITitleGenerator() {
    if (!aiTitleGenerator) {
        try {
            aiTitleGenerator = await import("../services/ai_title_generator.js");
        } catch (e) {
            console.warn('[ATOM] AI title generator not available:', e.message);
            return null;
        }
    }
    return aiTitleGenerator;
}

/**
 * Log topic router events (wrapper for backward compatibility)
 * @param {string} event - Event name
 * @param {Object} context - Event context
 */
function logTopicRouterEvent(event, context = {}) {
    logRouterEvent(event, context);
}

/**
 * Handle NLM_TOPIC_ROUTE message
 * Routes content to determine best notebook destination
 *
 * @param {Object} request - Message request
 * @param {Object} request.payload - Routing context
 * @param {string} request.payload.title - Page title
 * @param {string} request.payload.selection - Selected text
 * @param {string[]} request.payload.tags - User tags
 * @param {string} request.payload.intent - User intent
 * @param {string} request.payload.domain - Domain
 * @param {string} request.payload.url - Full URL
 * @returns {Promise<Object>} Router result with prompt payload
 */
export async function handleTopicRoute(request) {
    try {
        const context = request.payload || {};
        logRouterEvent(NLM_ROUTER_EVENTS.ROUTE_START, { domain: context.domain });

        const routerResult = await routeTopic(context, { savePending: true });
        const settings = await loadNlmSettings();
        const locale = settings.locale || "en";

        // Try to generate AI-powered title (non-blocking fallback to regex)
        let aiGeneratedTitle = null;
        try {
            const generator = await getAITitleGenerator();
            if (generator && generator.generateSmartTitle) {
                aiGeneratedTitle = await Promise.race([
                    generator.generateSmartTitle({
                        title: context.title,
                        selection: context.selection,
                        intent: context.intent,
                        domain: context.domain
                    }),
                    new Promise(resolve => setTimeout(() => resolve(null), 5000)) // 5s timeout
                ]);
            }
        } catch (e) {
            console.warn('[ATOM] AI title generation failed, using fallback:', e.message);
        }

        // Merge AI title into result if available
        if (aiGeneratedTitle) {
            routerResult.aiGeneratedTitle = aiGeneratedTitle;
        }

        const promptPayload = buildPromptPayload(routerResult, { locale });

        logRouterEvent(NLM_ROUTER_EVENTS.ROUTE_COMPLETE, {
            decision: routerResult.decision,
            topicKey: routerResult.topicKey,
            hasMatch: !!routerResult.bestMatch,
            hasAITitle: !!aiGeneratedTitle
        });

        // Log suggested if there's a match
        if (routerResult.bestMatch && (routerResult.decision === "use_existing" || routerResult.decision === "ask")) {
            logSuggested({
                topicKey: routerResult.topicKey,
                notebookRef: routerResult.bestMatch.notebookRef,
                score: routerResult.bestMatch.score,
                decision: routerResult.decision
            });
        }

        return {
            ok: true,
            routerResult,
            promptPayload
        };
    } catch (error) {
        logError({ error: error.message, source: "handleTopicRoute" });
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_QUICK_CHECK message
 * Quick check if there's a likely match (for UI hints)
 *
 * @param {Object} request - Message request
 * @returns {Promise<Object>} Quick check result
 */
export async function handleTopicQuickCheck(request) {
    try {
        const context = request.payload || {};
        const result = await quickMatchCheck(context);
        return { ok: true, ...result };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_ACTION message
 * Process user action from topic prompt UI
 *
 * @param {Object} request - Message request
 * @param {string} request.action - Action type (use, open, create, skip, save)
 * @param {Object} request.data - Action data
 * @returns {Promise<Object>} Action result
 */
export async function handleTopicAction(request) {
    const { action, data = {} } = request;

    try {
        switch (action) {
            case ACTION.USE:
                return await handleUseExisting(data);

            case ACTION.OPEN:
                return await handleOpenNotebook(data);

            case ACTION.CREATE:
                return await handleCreateNew(data);

            case ACTION.SAVE:
                return await handleSaveMapping(data);

            case ACTION.SKIP:
                return await handleSkip();

            default:
                return { ok: false, error: `Unknown action: ${action}` };
        }
    } catch (error) {
        logTopicRouterEvent("nlm_router.action_error", { action, error: error.message });
        return { ok: false, error: error.message };
    }
}

/**
 * Handle "use" action - Use existing notebook
 */
async function handleUseExisting(data) {
    const { notebookRef, notebookUrl, topicKey, selection } = data;

    logChosenExisting({ notebookRef, topicKey });

    // Record usage if topicKey provided
    if (topicKey) {
        await recordUsage(topicKey);
    }

    // Clear pending topic
    await clearPendingTopic();

    // Generate summary for long content (>500 chars)
    let summary = null;
    if (selection && selection.length > 500) {
        try {
            const generator = await getAITitleGenerator();
            if (generator && generator.generateSummary) {
                summary = await Promise.race([
                    generator.generateSummary(selection),
                    new Promise(resolve => setTimeout(() => resolve(null), 5000))
                ]);
            }
        } catch (e) {
            console.warn('[ATOM] Summary generation failed:', e.message);
        }
    }

    return {
        ok: true,
        action: "use",
        notebookRef,
        notebookUrl,
        summary,
        toast: buildToastPayload(`Using notebook: ${notebookRef}`, "success")
    };
}

/**
 * Handle "open" action - Open notebook in new tab
 */
async function handleOpenNotebook(data) {
    const { notebookUrl, notebookRef, topicKey } = data;

    if (!notebookUrl) {
        return { ok: false, error: "No notebook URL provided" };
    }

    // Log open to recall event (per spec section 9)
    logOpenToRecall({
        notebookUrl,
        notebookRef,
        topicKey,
        source: "memory_recall"
    });

    // Open notebook in new tab
    await chrome.tabs.create({ url: notebookUrl });

    return {
        ok: true,
        action: "open",
        notebookUrl
    };
}

/**
 * Handle "create" action - Create new topic/notebook
 * Does NOT save to registry - only saves pending topic for later mapping
 */
async function handleCreateNew(data) {
    const { topicKey, displayTitle, keywords = [], selection = "" } = data;

    logCreatedNew({ topicKey, displayTitle });

    // Save/update pending topic with user's custom name
    // This will be used by nlm_passive_learning.js to prompt mapping
    await setPendingTopic({
        topicKey: topicKey,
        displayTitle: displayTitle,
        keywords: keywords,
        context: {
            url: data.sourceUrl || "",
            title: data.sourceTitle || "",
            domain: data.sourceDomain || "",
            // v2: Use formatted CLIP (Markdown) as the payload for paste
            // We store this in 'selection' because that's what nlm_passive_learning copies
            selection: formatAtomClip({
                title: data.sourceTitle,
                url: data.sourceUrl,
                selectedText: selection,
                capturedAt: Date.now(),
                tags: keywords
            })
        }
    });

    // Get settings for base URL
    const settings = await loadNlmSettings();
    const createUrl = `${settings.baseUrl || "https://notebooklm.google.com"}`;

    // Open NotebookLM (home page - user will create notebook there)
    await chrome.tabs.create({ url: createUrl });

    // Return info - NOT saved to registry yet
    // Generate summary for long content (>500 chars)
    let summary = null;
    if (selection && selection.length > 500) {
        try {
            const generator = await getAITitleGenerator();
            if (generator && generator.generateSummary) {
                summary = await Promise.race([
                    generator.generateSummary(selection),
                    new Promise(resolve => setTimeout(() => resolve(null), 5000))
                ]);
            }
        } catch (e) {
            console.warn('[ATOM] Summary generation failed:', e.message);
        }
    }

    return {
        ok: true,
        action: "create",
        pendingTopic: { topicKey, displayTitle, keywords },
        createUrl,
        needsMapping: true, // Flag that we need to capture the created notebook
        summary,
        toast: buildToastPayload(`Opening NotebookLM... Create notebook "${displayTitle}"`, "info")
    };
}

/**
 * Handle "save" action - Save mapping to registry
 */
async function handleSaveMapping(data) {
    const { topicKey, displayTitle, keywords, notebookRef, notebookUrl, source = "learned" } = data;

    if (!notebookRef) {
        return { ok: false, error: "No notebook reference provided" };
    }

    logMappingSaved({ topicKey, notebookRef });

    // Try to complete pending topic first
    const pending = await getPendingTopic();
    let entry;

    if (pending && (!topicKey || pending.topicKey === topicKey)) {
        // Complete pending topic
        entry = await completePendingTopic(notebookRef, notebookUrl);
    } else {
        // Create/update topic directly
        entry = await upsertTopic({
            topicKey,
            displayTitle,
            keywords: keywords || [],
            notebookRef,
            notebookUrl,
            source
        });
    }

    return {
        ok: true,
        action: "save",
        entry,
        toast: buildToastPayload(`Mapping saved: ${entry.displayTitle} → ${notebookRef}`, "success")
    };
}

/**
 * Handle "skip" action - Skip export
 */
async function handleSkip() {
    logSkipped({});

    // Clear pending topic
    await clearPendingTopic();

    return {
        ok: true,
        action: "skip",
        toast: buildToastPayload("Export skipped", "info")
    };
}

/**
 * Handle NLM_TOPIC_GET_REGISTRY message
 * Get all topics from registry
 *
 * @returns {Promise<Object>} Registry entries
 */
export async function handleGetRegistry() {
    try {
        const registry = await loadRegistry();
        return { ok: true, registry };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_DELETE message
 * Delete a topic from registry
 *
 * @param {Object} request - Message request
 * @returns {Promise<Object>} Delete result
 */
export async function handleDeleteTopic(request) {
    try {
        const { topicKey } = request;
        const deleted = await deleteTopic(topicKey);
        return { ok: deleted, deleted };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_GET_STATS message
 * Get routing statistics for debugging
 *
 * @param {Object} request - Message request
 * @returns {Promise<Object>} Routing stats
 */
export async function handleGetRoutingStats(request) {
    try {
        const context = request.payload || {};
        const stats = await getRoutingStats(context);
        return { ok: true, stats };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_CONFIRM_MAPPING_PROMPT message
 * Build a confirm mapping prompt after user manually selects notebook
 *
 * @param {Object} request - Message request
 * @returns {Promise<Object>} Prompt payload
 */
export async function handleConfirmMappingPrompt(request) {
    try {
        const { topic, notebook } = request;
        const settings = await loadNlmSettings();
        const locale = settings.locale || "en";

        const promptPayload = buildConfirmMappingPrompt(
            topic || await getPendingTopic() || {},
            notebook,
            { locale }
        );

        return { ok: true, promptPayload };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_TOPIC_GET_PENDING message
 * Get the current pending topic
 *
 * @returns {Promise<Object>} Pending topic or null
 */
export async function handleGetPendingTopic() {
    try {
        const pending = await getPendingTopic();
        return { ok: true, pending };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_GET_SETTINGS message
 * Get NLM Bridge settings (used by content scripts to check if enabled)
 *
 * @returns {Promise<Object>} Settings object
 */
export async function handleGetSettings() {
    try {
        const settings = await loadNlmSettings();
        return { ok: true, settings };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

// ============================================
// Queue Management Handlers
// ============================================

/**
 * Handle NLM_QUEUE_GET_JOBS message
 * Get all jobs for UI display
 */
export async function handleGetQueueJobs() {
    try {
        const jobs = await getJobsForDisplay();
        const summary = await getQueueSummary();
        return { ok: true, jobs, summary };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_QUEUE_RETRY_JOB message
 * Retry a specific failed job
 */
export async function handleRetryJob(request) {
    try {
        const { jobId } = request;
        if (!jobId) {
            return { ok: false, error: "Job ID required" };
        }
        const job = await retryJob(jobId);
        return { ok: !!job, job };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_QUEUE_CANCEL_JOB message
 * Cancel/remove a job from queue
 */
export async function handleCancelJob(request) {
    try {
        const { jobId } = request;
        if (!jobId) {
            return { ok: false, error: "Job ID required" };
        }
        const cancelled = await cancelJob(jobId);
        return { ok: cancelled };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_QUEUE_CLEAR_FAILED message
 * Clear all failed jobs
 */
export async function handleClearFailedJobs() {
    try {
        const cleared = await clearFailedJobs();
        return { ok: true, cleared };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Handle NLM_QUEUE_PROCESS message
 * Manually trigger queue processing
 */
export async function handleProcessQueue() {
    try {
        const result = await processQueue();
        return { ok: true, ...result };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

/**
 * Register all topic router message handlers
 * Call this from background.js message listener
 *
 * @param {Object} request - Message request
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} True if handled, false otherwise
 */
export function handleTopicRouterMessage(request, sendResponse) {
    const { type } = request;

    switch (type) {
        case "NLM_TOPIC_ROUTE":
            handleTopicRoute(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_QUICK_CHECK":
            handleTopicQuickCheck(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_ACTION":
            handleTopicAction(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_GET_REGISTRY":
            handleGetRegistry().then(sendResponse);
            return true;

        case "NLM_TOPIC_DELETE":
            handleDeleteTopic(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_GET_STATS":
            handleGetRoutingStats(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_CONFIRM_MAPPING_PROMPT":
            handleConfirmMappingPrompt(request).then(sendResponse);
            return true;

        case "NLM_TOPIC_GET_PENDING":
            handleGetPendingTopic().then(sendResponse);
            return true;

        case "NLM_TOPIC_GET_SETTINGS":
            handleGetSettings().then(sendResponse);
            return true;

        // Queue management
        case "NLM_QUEUE_GET_JOBS":
            handleGetQueueJobs().then(sendResponse);
            return true;

        case "NLM_QUEUE_RETRY_JOB":
            handleRetryJob(request).then(sendResponse);
            return true;

        case "NLM_QUEUE_CANCEL_JOB":
            handleCancelJob(request).then(sendResponse);
            return true;

        case "NLM_QUEUE_CLEAR_FAILED":
            handleClearFailedJobs().then(sendResponse);
            return true;

        case "NLM_QUEUE_PROCESS":
            handleProcessQueue().then(sendResponse);
            return true;

        default:
            return false; // Not handled
    }
}
