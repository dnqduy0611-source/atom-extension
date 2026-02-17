/**
 * i18n Utilities for ATOM Extension
 * Standardizes language detection across Background, Sidepanel, and Services.
 * Supports both ES Module import and Global Window access.
 */

const getEffectiveLanguage = async () => {
    try {
        // 1. Check User Preference in Storage (highest priority)
        // 'atom_ui_language' is set in Options page
        const storage = await chrome.storage.local.get(['atom_ui_language']);
        const pref = storage.atom_ui_language;

        if (pref && pref !== 'auto') {
            return mapLocaleToName(pref);
        }

        // 2. Fallback to Browser UI Language
        const uiLang = chrome.i18n.getUILanguage();
        return mapLocaleToName(uiLang);

    } catch (e) {
        console.warn('[i18n] Language detection failed, defaulting to English', e);
        return 'English';
    }
};

/**
 * Maps locale codes (vi, en-US) to AI-friendly language names.
 * @param {string} locale 
 * @returns {string} 'Vietnamese' | 'English'
 */
const mapLocaleToName = (locale) => {
    if (!locale) return 'English';
    const normalized = locale.toLowerCase();
    if (normalized.startsWith('vi')) return 'Vietnamese';
    // Add other languages here if supported
    return 'English';
};

// Export for ES Modules
export { getEffectiveLanguage, mapLocaleToName };

// Expose to Global Scope (for non-module scripts)
if (typeof window !== 'undefined') {
    window.i18nUtils = {
        getEffectiveLanguage,
        mapLocaleToName
    };
}
