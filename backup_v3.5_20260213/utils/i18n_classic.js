/**
 * i18n Utilities for ATOM Extension (Classic Script Version)
 * Used in HTML files via <script> tag to avoid SyntaxError with 'export'.
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

// Expose to Global Scope (strictly)
if (typeof window !== 'undefined') {
    window.i18nUtils = {
        getEffectiveLanguage,
        mapLocaleToName
    };
} else if (typeof self !== 'undefined') {
    self.i18nUtils = {
        getEffectiveLanguage,
        mapLocaleToName
    };
}
