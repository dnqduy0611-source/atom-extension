/**
 * ATOM UI Utilities
 * Shared logic for Options, Popup, and Journal pages.
 */

const AtomUI = {
    /**
     * Localizes the HTML page using data-i18n attributes.
     */
    localize: function () {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                // Use innerHTML to allow simple formatting like bold tags if needed
                element.innerHTML = message;
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
            console.error('AtomUI: Toggle button not found', toggleBtnId);
        }
    }
};

// Auto-run localization on DOMContentLoaded if not called manually
document.addEventListener('DOMContentLoaded', () => {
    AtomUI.localize();
    AtomUI.initTheme();
});
