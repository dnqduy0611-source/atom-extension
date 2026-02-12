/**
 * ATOM UI Utilities
 * Shared logic for Options, Popup, and Journal pages.
 */

let atomI18nModule = null;
let atomI18nReady = null;

async function ensureI18n() {
    if (atomI18nReady) return atomI18nReady;
    atomI18nReady = (async () => {
        const mod = await import(chrome.runtime.getURL("i18n_bridge.js"));
        await mod.initI18n();
        atomI18nModule = mod;
        return mod;
    })();
    return atomI18nReady;
}

const AtomI18n = {
    async init(force = false) {
        const mod = await ensureI18n();
        if (force) {
            await mod.initI18n(true);
        }
        return mod;
    },
    getMessage(key, substitutions, fallback) {
        if (atomI18nModule) {
            return atomI18nModule.getMessage(key, substitutions, fallback);
        }
        return chrome.i18n.getMessage(key, substitutions) || fallback || key;
    },
    async setOverride(locale) {
        await chrome.storage.local.set({ atom_ui_language: locale });
        const mod = await ensureI18n();
        await mod.initI18n(true);
    }
};

const AtomUI = {
    /**
     * Localizes the HTML page using data-i18n attributes.
     */
    localize: function () {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const message = AtomI18n.getMessage(key);
            if (message) {
                // Use innerHTML to allow simple formatting like bold tags if needed
                element.innerHTML = message;
            }
        });

        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const message = AtomI18n.getMessage(key);
            if (message) {
                element.setAttribute('placeholder', message);
            }
        });

        const titles = document.querySelectorAll('[data-i18n-title]');
        titles.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const message = AtomI18n.getMessage(key);
            if (message) {
                element.setAttribute('title', message);
            }
        });
    },

    /**
     * Initializes the theme based on storage and sets up the toggle button.
     * @param {string} toggleBtnId - The ID of the theme toggle button (default: 'btn-theme-toggle').
     */
    initTheme: function (toggleBtnId = 'btn-theme-toggle') {
        const body = document.body;
        const btnTheme = document.getElementById(toggleBtnId);

        console.log('AtomUI: initTheme running', { btnTheme, toggleBtnId });

        // 1. Load saved theme
        chrome.storage.local.get(['atom_theme'], (data) => {
            console.log('AtomUI: Loaded theme', data.atom_theme);
            if (data.atom_theme === 'light') {
                body.classList.add('light-mode');
            }
        });

        // 2. Setup toggle listener
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                console.log('AtomUI: Theme toggle clicked');
                body.classList.toggle('light-mode');
                const isLight = body.classList.contains('light-mode');
                chrome.storage.local.set({ atom_theme: isLight ? 'light' : 'dark' });
                console.log('AtomUI: Saved theme', isLight ? 'light' : 'dark');
            });
        } else {
            console.log('AtomUI: Theme toggle button not found (expected in popup/sidepanel)', toggleBtnId);
        }
    }
};

// Auto-run localization on DOMContentLoaded if not called manually
document.addEventListener('DOMContentLoaded', async () => {
    await AtomI18n.init();
    AtomUI.localize();
    AtomUI.initTheme();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.atom_ui_language) {
        AtomI18n.init(true).then(() => {
            AtomUI.localize();
        });
    }
});

window.AtomI18n = AtomI18n;
window.AtomUI = AtomUI;
