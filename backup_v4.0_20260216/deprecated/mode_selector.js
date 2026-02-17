// ui/components/mode_selector.js
// Reading mode selector UI component

(function () {
    'use strict';

    function createModeSelectorUI(currentModeId, strings, onModeChange) {
        const container = document.createElement('div');
        container.className = 'sp-mode-selector';

        const label = strings?.label || 'Reading mode';
        const skimLabel = strings?.skimLabel || 'Skim';
        const skimDesc = strings?.skimDesc || 'Quick overview';
        const deepLabel = strings?.deepLabel || 'Deep';
        const deepDesc = strings?.deepDesc || 'Full analysis';

        container.innerHTML = `
            <div class="sp-mode-label">${escapeHtml(label)}</div>
            <div class="sp-mode-options" role="radiogroup" aria-label="${escapeHtml(label)}">
                <button class="sp-mode-option" type="button" data-mode="skim" role="radio" aria-checked="false">
                    <span class="sp-mode-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </span>
                    <span class="sp-mode-text">
                        <span class="sp-mode-title">${escapeHtml(skimLabel)}</span>
                        <span class="sp-mode-desc">${escapeHtml(skimDesc)}</span>
                    </span>
                </button>
                <button class="sp-mode-option" type="button" data-mode="deep" role="radio" aria-checked="false">
                    <span class="sp-mode-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                    </span>
                    <span class="sp-mode-text">
                        <span class="sp-mode-title">${escapeHtml(deepLabel)}</span>
                        <span class="sp-mode-desc">${escapeHtml(deepDesc)}</span>
                    </span>
                </button>
            </div>
        `;

        const options = container.querySelectorAll('.sp-mode-option');
        options.forEach((btn) => {
            const modeId = btn.getAttribute('data-mode');
            if (modeId === currentModeId) {
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
            }
            btn.addEventListener('click', () => {
                options.forEach(o => {
                    o.classList.remove('active');
                    o.setAttribute('aria-checked', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                onModeChange?.(modeId);
            });
        });

        return container;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.ModeSelectorUI = {
        createModeSelectorUI
    };
})();
