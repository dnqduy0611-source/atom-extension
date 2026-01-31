export const NLM_SETTINGS_KEY = "atom_nlm_settings_v1";
export const NLM_RULES_KEY = "atom_nlm_rules_v1";
export const NLM_SENSITIVE_DOMAINS_KEY = "atom_nlm_sensitive_domains_v1";
export const NLM_EXPORT_QUEUE_KEY = "atom_nlm_export_queue_v1";
export const NLM_EXPORT_INDEX_KEY = "atom_nlm_exports_index_v1";
export const NLM_PENDING_JOBS_KEY = "atom_nlm_pending_jobs_v1";
export const NLM_TOPIC_REGISTRY_KEY = "atom_nlm_topic_registry_v1";
export const NLM_PENDING_TOPIC_KEY = "atom_nlm_pending_topic_v1";
export const NLM_IDEA_STATS_KEY = "atom_nlm_idea_stats_v1";
export const NLM_IDEA_SUGGESTIONS_KEY = "atom_nlm_idea_suggestions_v1";
export const NLM_IDEA_COOLDOWN_KEY = "atom_nlm_idea_cooldown_v1";
export const NLM_MAX_QUEUE_SIZE = 50;
export const NLM_RETRY_DELAYS_MS = [5000, 30000, 120000];

export const DEFAULT_NLM_SETTINGS = {
    enabled: false,
    mode: "ui_assisted",
    defaultNotebookRef: "Inbox",
    exportFormat: "clip_and_url",
    baseUrl: "https://notebooklm.google.com",
    allowCloudExport: false,
    piiWarning: true,
    exportMaxChars: 5000  // Max characters for NLM clip export (0 = unlimited)
};

export const DEFAULT_NLM_RULES = {
    byTag: [],
    byIntent: [],
    byDomain: []
};

export const DEFAULT_NLM_SENSITIVE_DOMAINS = [
    "*.his.*",
    "*.emr.*",
    "*.ehr.*"
];

export function getLocalDayKey(ts) {
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function normalizeString(value) {
    if (typeof value !== "string") return "";
    return value.trim();
}

export function normalizeArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(Boolean);
}
