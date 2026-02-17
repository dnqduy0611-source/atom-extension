/**
 * Topic Registry - CRUD operations for topic-notebook mappings
 * Supports passive learning from user behavior
 */
console.log('[ATOM] Loading topic_registry.js...');

import {
    NLM_TOPIC_REGISTRY_KEY,
    NLM_PENDING_TOPIC_KEY,
    normalizeString
} from "./types.js";
import { computeTopicKey as extractorComputeTopicKey } from "./topic_extractor.js";

/**
 * Registry entry structure:
 * {
 *   topicKey: string,           // unique identifier (lowercase, normalized)
 *   displayTitle: string,       // human-readable title
 *   keywords: string[],         // associated keywords
 *   notebookRef: string,        // notebook reference/ID
 *   notebookUrl: string,        // full notebook URL
 *   usageCount: number,         // times this mapping was used
 *   lastUsedAt: number,         // timestamp of last use
 *   createdAt: number,          // timestamp of creation
 *   source: string              // "auto" | "manual" | "learned"
 * }
 */

/**
 * Load the entire topic registry from storage
 * @returns {Promise<Array>} Array of registry entries
 */
export async function loadRegistry() {
    const data = await chrome.storage.local.get([NLM_TOPIC_REGISTRY_KEY]);
    const registry = data[NLM_TOPIC_REGISTRY_KEY];
    if (!Array.isArray(registry)) return [];
    return registry;
}

/**
 * Save the entire registry to storage
 * @param {Array} list - Array of registry entries
 */
export async function saveRegistry(list) {
    if (!Array.isArray(list)) {
        console.warn("[topic_registry] saveRegistry: invalid list provided");
        return;
    }
    await chrome.storage.local.set({ [NLM_TOPIC_REGISTRY_KEY]: list });
}

/**
 * Generate a normalized topic key from display title
 * NOTE: This is a legacy fallback. Prefer using computeTopicKey from topic_extractor.js
 * which generates spec-compliant keys with prefix (tag:/dom:/kw:)
 *
 * @param {string} title - Display title
 * @returns {string} Normalized topic key (legacy format without prefix)
 * @deprecated Use computeTopicKey from topic_extractor.js for v1 spec compliance
 */
export function generateTopicKey(title) {
    return normalizeString(title)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50);
}

/**
 * Generate topic key using v1 spec format
 * @param {Object} context - Context with tags, domain, title
 * @returns {string} Spec-compliant topicKey with prefix
 */
export function generateTopicKeyV1(context) {
    const result = extractorComputeTopicKey(context);
    return result.topicKey;
}

/**
 * Find an entry by topic key
 * @param {Array} registry - Registry array
 * @param {string} topicKey - Topic key to find
 * @returns {Object|null} Entry or null
 */
export function findByTopicKey(registry, topicKey) {
    const normalized = normalizeString(topicKey).toLowerCase();
    return registry.find(entry => entry.topicKey === normalized) || null;
}

/**
 * Find an entry by notebook reference
 * @param {Array} registry - Registry array
 * @param {string} notebookRef - Notebook reference to find
 * @returns {Object|null} Entry or null
 */
export function findByNotebookRef(registry, notebookRef) {
    const normalized = normalizeString(notebookRef);
    return registry.find(entry => entry.notebookRef === normalized) || null;
}

/**
 * Insert or update a topic entry in registry
 * @param {Object} entry - Entry to upsert
 * @param {string} entry.topicKey - Unique topic key (optional, generated from displayTitle if missing)
 * @param {string} entry.displayTitle - Human-readable title
 * @param {string[]} entry.keywords - Associated keywords
 * @param {string} entry.notebookRef - Notebook reference
 * @param {string} entry.notebookUrl - Notebook URL
 * @param {string} entry.source - Source: "auto" | "manual" | "learned"
 * @returns {Promise<Object>} The upserted entry
 */
export async function upsertTopic(entry) {
    const registry = await loadRegistry();
    const now = Date.now();

    // Generate topicKey if not provided, always store as lowercase normalized
    const rawTopicKey = normalizeString(entry.topicKey) || generateTopicKey(entry.displayTitle);
    const topicKey = (typeof rawTopicKey === "string" ? rawTopicKey.toLowerCase() : "");

    if (!topicKey) {
        throw new Error("[topic_registry] upsertTopic: topicKey or displayTitle required");
    }

    const existingIndex = registry.findIndex(e => e.topicKey === topicKey);

    const newEntry = {
        topicKey,
        displayTitle: normalizeString(entry.displayTitle) || topicKey,
        keywords: Array.isArray(entry.keywords) ? entry.keywords.map(k => normalizeString(k).toLowerCase()).filter(Boolean) : [],
        notebookRef: normalizeString(entry.notebookRef) || "",
        notebookUrl: normalizeString(entry.notebookUrl) || "",
        usageCount: 0,
        lastUsedAt: now,
        createdAt: now,
        source: entry.source || "manual"
    };

    if (existingIndex >= 0) {
        // Update existing entry, preserve usage stats
        const existing = registry[existingIndex];
        newEntry.usageCount = existing.usageCount || 0;
        newEntry.createdAt = existing.createdAt || now;
        newEntry.lastUsedAt = now;

        // Merge keywords (unique)
        const mergedKeywords = [...new Set([...existing.keywords || [], ...newEntry.keywords])];
        newEntry.keywords = mergedKeywords;

        registry[existingIndex] = newEntry;
    } else {
        // Add new entry
        registry.push(newEntry);
    }

    await saveRegistry(registry);
    return newEntry;
}

/**
 * Record usage of a topic (increment counter, update timestamp)
 * @param {string} topicKey - Topic key to record usage for
 * @returns {Promise<Object|null>} Updated entry or null if not found
 */
export async function recordUsage(topicKey) {
    const registry = await loadRegistry();
    const normalized = normalizeString(topicKey).toLowerCase();
    const index = registry.findIndex(e => e.topicKey === normalized);

    if (index < 0) {
        console.warn(`[topic_registry] recordUsage: topicKey "${topicKey}" not found`);
        return null;
    }

    registry[index].usageCount = (registry[index].usageCount || 0) + 1;
    registry[index].lastUsedAt = Date.now();

    await saveRegistry(registry);
    return registry[index];
}

/**
 * Delete a topic from registry
 * @param {string} topicKey - Topic key to delete
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteTopic(topicKey) {
    const registry = await loadRegistry();
    const normalized = normalizeString(topicKey).toLowerCase();
    const index = registry.findIndex(e => e.topicKey === normalized);

    if (index < 0) return false;

    registry.splice(index, 1);
    await saveRegistry(registry);
    return true;
}

/**
 * Get all topics sorted by usage (most used first)
 * @returns {Promise<Array>} Sorted registry entries
 */
export async function getTopicsByUsage() {
    const registry = await loadRegistry();
    return [...registry].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
}

/**
 * Get all topics sorted by recency (most recent first)
 * @returns {Promise<Array>} Sorted registry entries
 */
export async function getTopicsByRecency() {
    const registry = await loadRegistry();
    return [...registry].sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

// ============================================
// Pending Topic Operations
// ============================================

/**
 * Pending topic structure:
 * {
 *   topicKey: string,
 *   displayTitle: string,
 *   keywords: string[],
 *   context: {
 *     url: string,
 *     title: string,
 *     domain: string,
 *     selection: string
 *   },
 *   createdAt: number
 * }
 */

/**
 * Get the current pending topic (awaiting notebook assignment)
 * @returns {Promise<Object|null>} Pending topic or null
 */
export async function getPendingTopic() {
    const data = await chrome.storage.local.get([NLM_PENDING_TOPIC_KEY]);
    return data[NLM_PENDING_TOPIC_KEY] || null;
}

/**
 * Set a pending topic (when user initiates export but hasn't chosen notebook)
 * @param {Object} topic - Pending topic data
 * @returns {Promise<void>}
 */
export async function setPendingTopic(topic) {
    if (!topic) {
        await clearPendingTopic();
        return;
    }

    const pending = {
        topicKey: (normalizeString(topic.topicKey) || generateTopicKey(topic.displayTitle)).toLowerCase(),
        displayTitle: normalizeString(topic.displayTitle) || "",
        keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
        context: {
            url: normalizeString(topic.context?.url) || "",
            title: normalizeString(topic.context?.title) || "",
            domain: normalizeString(topic.context?.domain) || "",
            selection: normalizeString(topic.context?.selection) || ""
        },
        createdAt: Date.now()
    };

    await chrome.storage.local.set({ [NLM_PENDING_TOPIC_KEY]: pending });
}

/**
 * Clear the pending topic
 * @returns {Promise<void>}
 */
export async function clearPendingTopic() {
    await chrome.storage.local.remove([NLM_PENDING_TOPIC_KEY]);
}

/**
 * Complete pending topic by assigning a notebook and saving to registry
 * @param {string} notebookRef - Notebook reference
 * @param {string} notebookUrl - Notebook URL
 * @returns {Promise<Object|null>} Created registry entry or null
 */
export async function completePendingTopic(notebookRef, notebookUrl) {
    const pending = await getPendingTopic();
    if (!pending) return null;

    const entry = await upsertTopic({
        topicKey: pending.topicKey,
        displayTitle: pending.displayTitle,
        keywords: pending.keywords,
        notebookRef,
        notebookUrl,
        source: "learned"
    });

    await clearPendingTopic();
    return entry;
}
