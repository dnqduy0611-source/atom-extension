const LANGUAGE_KEY = "atom_ui_language";
const SUPPORTED_LOCALES = ["en", "vi"];
const DEFAULT_LOCALE = chrome.runtime.getManifest().default_locale || "en";

let overrideLocale = null;
let messages = null;
let initPromise = null;

function normalizeLocale(value) {
    if (!value) return null;
    const lowered = String(value).toLowerCase();
    if (lowered === "auto") return null;
    if (lowered.startsWith("vi")) return "vi";
    if (lowered.startsWith("en")) return "en";
    return SUPPORTED_LOCALES.includes(lowered) ? lowered : null;
}

function applySubstitutions(text, substitutions) {
    if (!substitutions || !text) return text;
    const list = Array.isArray(substitutions) ? substitutions : [substitutions];
    let out = text;
    list.forEach((value, idx) => {
        const token = `$${idx + 1}`;
        out = out.split(token).join(String(value));
    });
    return out;
}

async function loadMessages(locale) {
    try {
        const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load locale ${locale}`);
        return res.json();
    } catch {
        // fetch may fail in content scripts, silently fallback to chrome.i18n
        return null;
    }
}

export async function initI18n(force = false) {
    if (initPromise && !force) return initPromise;
    initPromise = (async () => {
        const data = await chrome.storage.local.get([LANGUAGE_KEY]);
        overrideLocale = normalizeLocale(data[LANGUAGE_KEY]);
        if (!overrideLocale) {
            messages = null;
            return null;
        }
        messages = await loadMessages(overrideLocale);
        return messages;
    })();
    return initPromise;
}

export function getMessage(key, substitutions, fallback = "") {
    if (messages && messages[key] && typeof messages[key].message === "string") {
        return applySubstitutions(messages[key].message, substitutions);
    }
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || fallback;
}

export function getActiveLocale() {
    return overrideLocale || normalizeLocale(chrome.i18n.getUILanguage()) || DEFAULT_LOCALE;
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes[LANGUAGE_KEY]) {
        initI18n(true).catch(() => { });
    }
});
