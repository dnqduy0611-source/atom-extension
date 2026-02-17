/**
 * UI Prompt Builder - Build prompt payloads for topic routing UI
 *
 * Actions:
 * - open: Open existing notebook
 * - use: Use suggested notebook for this content
 * - create: Create new topic/notebook
 * - skip: Skip export, don't save
 */

import { normalizeString } from "./types.js";

/**
 * Prompt types
 */
export const PROMPT_TYPE = {
    AUTO_SUGGEST: "auto_suggest",    // High confidence, show quick confirm
    ASK_USER: "ask_user",            // Medium confidence, show options
    CREATE_NEW: "create_new",        // Low confidence, suggest creation
    CONFIRM_MAPPING: "confirm_mapping" // After manual selection, confirm save
};

/**
 * Action types
 */
export const ACTION = {
    OPEN: "open",       // Open the notebook
    USE: "use",         // Use this notebook for export
    CREATE: "create",   // Create new topic
    SKIP: "skip",       // Skip/cancel
    SAVE: "save"        // Save mapping to registry
};

/**
 * Build prompt payload based on router decision
 *
 * @param {Object} routerResult - Result from topic_router
 * @param {Object} options - Additional options
 * @param {string} options.locale - Locale for text (en/vi)
 * @returns {Object} Prompt payload
 */
export function buildPromptPayload(routerResult, options = {}) {
    const { locale = "en" } = options;
    const texts = getLocalizedTexts(locale);

    if (!routerResult) {
        return buildCreatePrompt(null, texts);
    }

    switch (routerResult.decision) {
        case "use_existing":
            return buildAutoSuggestPrompt(routerResult, texts);
        case "ask":
            return buildAskPrompt(routerResult, texts);
        case "create":
        default:
            return buildCreatePrompt(routerResult, texts);
    }
}

/**
 * Build auto-suggest prompt (high confidence match)
 */
function buildAutoSuggestPrompt(result, texts) {
    const match = result.bestMatch;

    return {
        type: PROMPT_TYPE.AUTO_SUGGEST,
        title: texts.autoSuggestTitle,
        message: texts.autoSuggestMessage.replace("{notebook}", match.displayTitle),
        confidence: match.score,
        suggestedNotebook: {
            ref: match.notebookRef,
            url: match.notebookUrl,
            title: match.displayTitle
        },
        extractedTopic: {
            key: result.topicKey,
            title: result.displayTitle,
            keywords: result.keywords
        },
        actions: [
            {
                id: ACTION.USE,
                label: texts.actionUse,
                primary: true,
                data: { notebookRef: match.notebookRef, notebookUrl: match.notebookUrl }
            },
            {
                id: ACTION.OPEN,
                label: texts.actionOpen,
                primary: false,
                data: { notebookUrl: match.notebookUrl }
            },
            {
                id: ACTION.CREATE,
                label: texts.actionCreateNew,
                primary: false,
                data: {}
            },
            {
                id: ACTION.SKIP,
                label: texts.actionSkip,
                primary: false,
                data: {}
            }
        ],
        showAlternatives: false,
        alternatives: []
    };
}

/**
 * Build ask prompt (medium confidence, needs user choice)
 */
function buildAskPrompt(result, texts) {
    const match = result.bestMatch;
    const alternatives = result.alternatives || [];

    const allOptions = [match, ...alternatives].filter(Boolean);

    return {
        type: PROMPT_TYPE.ASK_USER,
        title: texts.askTitle,
        message: texts.askMessage,
        confidence: match ? match.score : 0,
        suggestedNotebook: match ? {
            ref: match.notebookRef,
            url: match.notebookUrl,
            title: match.displayTitle
        } : null,
        extractedTopic: {
            key: result.topicKey,
            title: result.displayTitle,
            keywords: result.keywords
        },
        actions: [
            // Primary action: use best match
            ...(match ? [{
                id: ACTION.USE,
                label: `${texts.actionUse} "${match.displayTitle}"`,
                primary: true,
                data: { notebookRef: match.notebookRef, notebookUrl: match.notebookUrl }
            }] : []),
            {
                id: ACTION.CREATE,
                label: texts.actionCreateNew,
                primary: !match,
                data: {}
            },
            {
                id: ACTION.SKIP,
                label: texts.actionSkip,
                primary: false,
                data: {}
            }
        ],
        showAlternatives: alternatives.length > 0,
        alternatives: alternatives.map(alt => ({
            id: ACTION.USE,
            label: alt.displayTitle,
            score: alt.score,
            data: { notebookRef: alt.notebookRef, notebookUrl: alt.notebookUrl }
        }))
    };
}

/**
 * Build create prompt (low confidence, suggest new topic)
 */
function buildCreatePrompt(result, texts) {
    const extracted = result ? {
        key: result.topicKey,
        title: result.displayTitle,
        keywords: result.keywords
    } : {
        key: "",
        title: texts.untitled,
        keywords: []
    };

    return {
        type: PROMPT_TYPE.CREATE_NEW,
        title: texts.createTitle,
        message: texts.createMessage,
        confidence: 0,
        suggestedNotebook: null,
        extractedTopic: extracted,
        // [NEW] Allow user to edit topic name before creating
        editableTopicName: {
            enabled: true,
            placeholder: texts.topicNamePlaceholder || "Enter topic name...",
            initialValue: extracted.title,
            label: texts.topicNameLabel || "Topic name:"
        },
        actions: [
            {
                id: ACTION.CREATE,
                label: texts.actionCreate,
                primary: true,
                data: { topicKey: extracted.key, displayTitle: extracted.title }
            },
            {
                id: ACTION.SKIP,
                label: texts.actionSkip,
                primary: false,
                data: {}
            }
        ],
        showAlternatives: false,
        alternatives: []
    };
}

/**
 * Build confirm mapping prompt (after user selects notebook manually)
 *
 * @param {Object} topic - Topic info
 * @param {Object} notebook - Selected notebook info
 * @param {Object} options - Options
 * @returns {Object} Prompt payload
 */
export function buildConfirmMappingPrompt(topic, notebook, options = {}) {
    const { locale = "en" } = options;
    const texts = getLocalizedTexts(locale);

    return {
        type: PROMPT_TYPE.CONFIRM_MAPPING,
        title: texts.confirmMappingTitle,
        message: texts.confirmMappingMessage
            .replace("{topic}", topic.displayTitle || topic.topicKey)
            .replace("{notebook}", notebook.title || notebook.ref),
        extractedTopic: {
            key: topic.topicKey,
            title: topic.displayTitle,
            keywords: topic.keywords || []
        },
        selectedNotebook: {
            ref: notebook.ref,
            url: notebook.url,
            title: notebook.title
        },
        actions: [
            {
                id: ACTION.SAVE,
                label: texts.actionSaveMapping,
                primary: true,
                data: {
                    topicKey: topic.topicKey,
                    displayTitle: topic.displayTitle,
                    notebookRef: notebook.ref,
                    notebookUrl: notebook.url
                }
            },
            {
                id: ACTION.SKIP,
                label: texts.actionDontSave,
                primary: false,
                data: {}
            }
        ]
    };
}

/**
 * Get localized texts
 */
function getLocalizedTexts(locale) {
    const texts = {
        en: {
            autoSuggestTitle: "Export to NotebookLM",
            autoSuggestMessage: "This looks like it belongs in \"{notebook}\"",
            askTitle: "Choose Notebook",
            askMessage: "Where would you like to save this?",
            createTitle: "New Topic",
            createMessage: "Create a new notebook for this content?",
            confirmMappingTitle: "Save Mapping",
            confirmMappingMessage: "Remember \"{topic}\" → \"{notebook}\" for future exports?",
            actionUse: "Use this",
            actionOpen: "Open notebook",
            actionCreateNew: "Create new",
            actionCreate: "Create notebook",
            actionSkip: "Skip",
            actionSaveMapping: "Yes, remember",
            actionDontSave: "No, just this once",
            untitled: "Untitled"
        },
        vi: {
            autoSuggestTitle: "Xuất sang NotebookLM",
            autoSuggestMessage: "Nội dung này có vẻ thuộc về \"{notebook}\"",
            askTitle: "Chọn Notebook",
            askMessage: "Bạn muốn lưu nội dung này ở đâu?",
            createTitle: "Chủ đề mới",
            createMessage: "Tạo notebook mới cho nội dung này?",
            confirmMappingTitle: "Lưu liên kết",
            confirmMappingMessage: "Ghi nhớ \"{topic}\" → \"{notebook}\" cho các lần xuất sau?",
            actionUse: "Sử dụng",
            actionOpen: "Mở notebook",
            actionCreateNew: "Tạo mới",
            actionCreate: "Tạo notebook",
            actionSkip: "Bỏ qua",
            actionSaveMapping: "Có, ghi nhớ",
            actionDontSave: "Không, chỉ lần này",
            untitled: "Không có tiêu đề"
        }
    };

    return texts[locale] || texts.en;
}

/**
 * Build minimal toast notification payload
 *
 * @param {string} message - Toast message
 * @param {string} type - Type: success, error, info
 * @returns {Object} Toast payload
 */
export function buildToastPayload(message, type = "info") {
    return {
        type: "toast",
        message: normalizeString(message),
        variant: type,
        duration: type === "error" ? 5000 : 3000
    };
}

/**
 * Build progress indicator payload
 *
 * @param {string} status - Status: pending, processing, complete, error
 * @param {string} message - Status message
 * @returns {Object} Progress payload
 */
export function buildProgressPayload(status, message) {
    return {
        type: "progress",
        status,
        message: normalizeString(message),
        timestamp: Date.now()
    };
}
