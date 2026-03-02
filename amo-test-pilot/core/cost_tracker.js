/**
 * core/cost_tracker.js — Budget guardrail for AI calls
 *
 * P1.2: Tracks API calls per run, estimates cost, warns/stops on threshold.
 *
 * Usage:
 *   const tracker = createCostTracker();
 *   tracker.trackCall(model, inputTokens, outputTokens);
 *   if (tracker.shouldStop()) { ... }
 *   tracker.getSummary();
 */
import { CONFIG } from './config.js';

// Approximate cost per 1M tokens (USD) — conservative estimates
const MODEL_COSTS = {
    'deepseek/deepseek-chat-v3': { input: 0.27, output: 1.10 },
    'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },
    'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
    'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
    'openai/gpt-4o': { input: 2.50, output: 10.00 },
    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
};

const DEFAULT_COST = { input: 1.0, output: 4.0 }; // conservative fallback

/**
 * Create a cost tracker for a single run.
 * @returns {CostTracker}
 */
export function createCostTracker() {
    const calls = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUSD = 0;
    let warningShown = false;

    const maxCalls = CONFIG.MAX_CALLS_PER_RUN || 50;
    const maxCostUSD = CONFIG.MAX_COST_EST_USD || 2.0;

    return {
        /**
         * Track an AI call.
         * @param {string} model - Model name
         * @param {number} inputTokens - Input token count
         * @param {number} outputTokens - Output token count
         */
        trackCall(model, inputTokens = 0, outputTokens = 0) {
            const costs = MODEL_COSTS[model] || DEFAULT_COST;
            const callCost = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCostUSD += callCost;

            calls.push({
                model,
                inputTokens,
                outputTokens,
                costUSD: callCost,
                timestamp: new Date().toISOString(),
            });

            // Warn at 80% of budget
            if (!warningShown && totalCostUSD > maxCostUSD * 0.8) {
                console.warn(`  ⚠️  Cost warning: $${totalCostUSD.toFixed(4)} / $${maxCostUSD} (${Math.round(totalCostUSD / maxCostUSD * 100)}%)`);
                warningShown = true;
            }
        },

        /**
         * Check if we should stop (exceeded budget or call limit).
         * @returns {{ stop: boolean, reason?: string }}
         */
        shouldStop() {
            if (calls.length >= maxCalls) {
                return { stop: true, reason: `Max calls reached (${maxCalls})` };
            }
            if (totalCostUSD >= maxCostUSD) {
                return { stop: true, reason: `Budget exceeded ($${totalCostUSD.toFixed(4)} >= $${maxCostUSD})` };
            }
            return { stop: false };
        },

        /**
         * Get run summary.
         */
        getSummary() {
            return {
                totalCalls: calls.length,
                totalInputTokens,
                totalOutputTokens,
                totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
                maxCalls,
                maxCostUSD,
                calls,
            };
        },

        /** Number of calls made */
        get callCount() { return calls.length; },

        /** Estimated total cost */
        get estimatedCost() { return totalCostUSD; },
    };
}
