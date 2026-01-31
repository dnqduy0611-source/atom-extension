/**
 * Topic Router Logging - Event logging for NLM topic routing
 *
 * Router Events:
 * - nlm_router.suggested - Router suggested an existing notebook
 * - nlm_router.chosen_existing - User chose to use existing notebook
 * - nlm_router.created_new - User created new topic/notebook
 * - nlm_router.skipped - User skipped the export
 * - nlm_router.mapping_saved - User saved a mapping
 * - nlm_router.route_start - Routing process started
 * - nlm_router.route_complete - Routing process completed
 * - nlm_router.error - Error occurred
 *
 * Bridge Events (per spec):
 * - nlm_bridge.export_attempt - Export attempt started
 * - nlm_bridge.export_success - Export completed successfully
 * - nlm_bridge.export_failed - Export failed
 * - nlm_bridge.open_to_recall - User opened notebook for recall
 * - nlm_bridge.idea_incubator_created - Idea incubator created new notebook
 */

const NLM_ROUTER_LOG_KEY = "atom_nlm_router_events";
const NLM_BRIDGE_LOG_KEY = "atom_nlm_bridge_events";
const MAX_LOG_ENTRIES = 100;

/**
 * Event types for topic router
 */
export const NLM_ROUTER_EVENTS = {
    ROUTE_START: "nlm_router.route_start",
    ROUTE_COMPLETE: "nlm_router.route_complete",
    SUGGESTED: "nlm_router.suggested",
    CHOSEN_EXISTING: "nlm_router.chosen_existing",
    CREATED_NEW: "nlm_router.created_new",
    SKIPPED: "nlm_router.skipped",
    MAPPING_SAVED: "nlm_router.mapping_saved",
    ERROR: "nlm_router.error"
};

/**
 * Event types for NLM bridge (per spec section 9)
 */
export const NLM_BRIDGE_EVENTS = {
    EXPORT_ATTEMPT: "nlm_bridge.export_attempt",
    EXPORT_SUCCESS: "nlm_bridge.export_success",
    EXPORT_FAILED: "nlm_bridge.export_failed",
    OPEN_TO_RECALL: "nlm_bridge.open_to_recall",
    IDEA_INCUBATOR_CREATED: "nlm_bridge.idea_incubator_created"
};

/**
 * Log a topic router event
 *
 * @param {string} event - Event name from NLM_ROUTER_EVENTS
 * @param {Object} context - Event context/metadata
 * @returns {Promise<void>}
 */
export async function logRouterEvent(event, context = {}) {
    const entry = {
        event,
        timestamp: Date.now(),
        context: {
            ...context,
            // Sanitize sensitive data
            selection: context.selection ? `[${context.selection.length} chars]` : undefined
        }
    };

    // Console log for debugging
    console.log(`[ATOM NLM Router] ${event}`, context);

    // Persist to storage
    try {
        const data = await chrome.storage.local.get([NLM_ROUTER_LOG_KEY]);
        const logs = data[NLM_ROUTER_LOG_KEY] || [];

        logs.push(entry);

        // Keep only last MAX_LOG_ENTRIES
        const trimmedLogs = logs.slice(-MAX_LOG_ENTRIES);

        await chrome.storage.local.set({ [NLM_ROUTER_LOG_KEY]: trimmedLogs });

        // Also push to ATOM debug hub if available
        try {
            await chrome.runtime.sendMessage({
                type: "ATOM_DEBUG_PUSH",
                payload: {
                    event,
                    mode: "NLM_ROUTER",
                    context,
                    timestamp: entry.timestamp
                }
            });
        } catch (e) {
            // Debug hub might not be active, ignore
        }
    } catch (error) {
        console.error("[ATOM NLM Router] Failed to log event:", error);
    }
}

/**
 * Get all router event logs
 *
 * @param {number} limit - Maximum entries to return
 * @returns {Promise<Array>} Event logs
 */
export async function getRouterLogs(limit = 50) {
    try {
        const data = await chrome.storage.local.get([NLM_ROUTER_LOG_KEY]);
        const logs = data[NLM_ROUTER_LOG_KEY] || [];
        return logs.slice(-limit).reverse(); // Most recent first
    } catch (error) {
        console.error("[ATOM NLM Router] Failed to get logs:", error);
        return [];
    }
}

/**
 * Clear all router event logs
 *
 * @returns {Promise<void>}
 */
export async function clearRouterLogs() {
    await chrome.storage.local.remove([NLM_ROUTER_LOG_KEY]);
}

/**
 * Get router stats summary
 *
 * @returns {Promise<Object>} Stats summary
 */
export async function getRouterStats() {
    const logs = await getRouterLogs(MAX_LOG_ENTRIES);

    const stats = {
        total: logs.length,
        byEvent: {},
        last24h: 0,
        lastWeek: 0
    };

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    for (const log of logs) {
        // Count by event type
        stats.byEvent[log.event] = (stats.byEvent[log.event] || 0) + 1;

        // Count by time
        const age = now - log.timestamp;
        if (age < day) stats.last24h++;
        if (age < week) stats.lastWeek++;
    }

    return stats;
}

/**
 * Log convenience methods - Router events
 */
export const logSuggested = (context) => logRouterEvent(NLM_ROUTER_EVENTS.SUGGESTED, context);
export const logChosenExisting = (context) => logRouterEvent(NLM_ROUTER_EVENTS.CHOSEN_EXISTING, context);
export const logCreatedNew = (context) => logRouterEvent(NLM_ROUTER_EVENTS.CREATED_NEW, context);
export const logSkipped = (context) => logRouterEvent(NLM_ROUTER_EVENTS.SKIPPED, context);
export const logMappingSaved = (context) => logRouterEvent(NLM_ROUTER_EVENTS.MAPPING_SAVED, context);
export const logError = (context) => logRouterEvent(NLM_ROUTER_EVENTS.ERROR, context);

// ============================================
// Bridge Events (per spec section 9)
// ============================================

/**
 * Log a bridge event
 *
 * @param {string} event - Event name from NLM_BRIDGE_EVENTS
 * @param {Object} context - Event context/metadata
 * @returns {Promise<void>}
 */
export async function logBridgeEvent(event, context = {}) {
    const entry = {
        event,
        timestamp: Date.now(),
        context: {
            ...context,
            // Sanitize sensitive data
            clipText: context.clipText ? `[${context.clipText.length} chars]` : undefined,
            selection: context.selection ? `[${context.selection.length} chars]` : undefined
        }
    };

    // Console log for debugging
    console.log(`[ATOM NLM Bridge] ${event}`, context);

    // Persist to storage
    try {
        const data = await chrome.storage.local.get([NLM_BRIDGE_LOG_KEY]);
        const logs = data[NLM_BRIDGE_LOG_KEY] || [];

        logs.push(entry);

        // Keep only last MAX_LOG_ENTRIES
        const trimmedLogs = logs.slice(-MAX_LOG_ENTRIES);

        await chrome.storage.local.set({ [NLM_BRIDGE_LOG_KEY]: trimmedLogs });

        // Also push to ATOM debug hub if available
        try {
            await chrome.runtime.sendMessage({
                type: "ATOM_DEBUG_PUSH",
                payload: {
                    event,
                    mode: "NLM_BRIDGE",
                    context,
                    timestamp: entry.timestamp
                }
            });
        } catch (e) {
            // Debug hub might not be active, ignore
        }
    } catch (error) {
        console.error("[ATOM NLM Bridge] Failed to log event:", error);
    }
}

/**
 * Get all bridge event logs
 *
 * @param {number} limit - Maximum entries to return
 * @returns {Promise<Array>} Event logs
 */
export async function getBridgeLogs(limit = 50) {
    try {
        const data = await chrome.storage.local.get([NLM_BRIDGE_LOG_KEY]);
        const logs = data[NLM_BRIDGE_LOG_KEY] || [];
        return logs.slice(-limit).reverse(); // Most recent first
    } catch (error) {
        console.error("[ATOM NLM Bridge] Failed to get logs:", error);
        return [];
    }
}

/**
 * Get bridge stats summary
 *
 * @returns {Promise<Object>} Stats summary with metrics
 */
export async function getBridgeStats() {
    const logs = await getBridgeLogs(MAX_LOG_ENTRIES);

    const stats = {
        total: logs.length,
        byEvent: {},
        successRate: 0,
        last24h: { total: 0, success: 0, failed: 0 },
        lastWeek: { total: 0, success: 0, failed: 0 }
    };

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    let successCount = 0;
    let failedCount = 0;

    for (const log of logs) {
        // Count by event type
        stats.byEvent[log.event] = (stats.byEvent[log.event] || 0) + 1;

        // Track success/failed
        if (log.event === NLM_BRIDGE_EVENTS.EXPORT_SUCCESS) {
            successCount++;
        } else if (log.event === NLM_BRIDGE_EVENTS.EXPORT_FAILED) {
            failedCount++;
        }

        // Count by time
        const age = now - log.timestamp;
        if (age < day) {
            stats.last24h.total++;
            if (log.event === NLM_BRIDGE_EVENTS.EXPORT_SUCCESS) stats.last24h.success++;
            if (log.event === NLM_BRIDGE_EVENTS.EXPORT_FAILED) stats.last24h.failed++;
        }
        if (age < week) {
            stats.lastWeek.total++;
            if (log.event === NLM_BRIDGE_EVENTS.EXPORT_SUCCESS) stats.lastWeek.success++;
            if (log.event === NLM_BRIDGE_EVENTS.EXPORT_FAILED) stats.lastWeek.failed++;
        }
    }

    // Calculate success rate
    const totalAttempts = successCount + failedCount;
    if (totalAttempts > 0) {
        stats.successRate = Math.round((successCount / totalAttempts) * 100);
    }

    return stats;
}

/**
 * Log convenience methods - Bridge events
 */
export const logExportAttempt = (context) => logBridgeEvent(NLM_BRIDGE_EVENTS.EXPORT_ATTEMPT, context);
export const logExportSuccess = (context) => logBridgeEvent(NLM_BRIDGE_EVENTS.EXPORT_SUCCESS, context);
export const logExportFailed = (context) => logBridgeEvent(NLM_BRIDGE_EVENTS.EXPORT_FAILED, context);
export const logOpenToRecall = (context) => logBridgeEvent(NLM_BRIDGE_EVENTS.OPEN_TO_RECALL, context);
export const logIdeaIncubatorCreated = (context) => logBridgeEvent(NLM_BRIDGE_EVENTS.IDEA_INCUBATOR_CREATED, context);
