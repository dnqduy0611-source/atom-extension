// ui/components/primer.js
// Pre-reading primer UI component

(function () {
    'use strict';

    function createPrimerUI(primerData, strings, onAccept, onSkip) {
        const container = document.createElement('div');
        container.className = 'sp-primer-card';

        const title = strings?.title || 'Before you read...';
        const topicLabel = strings?.topicLabel || 'This article covers:';
        const objectivesLabel = strings?.objectivesLabel || 'Reading objectives:';
        const startLabel = strings?.startLabel || 'Start reading';
        const skipLabel = strings?.skipLabel || 'Skip';

        const questionsHtml = (primerData.questions || [])
            .map((q) => `
                <li class="sp-primer-question" data-level="${q.level || ''}">
                    <div class="sp-primer-question-text">${escapeHtml(q.question || '')}</div>
                    ${q.hint ? `<div class="sp-primer-question-hint"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> ${escapeHtml(q.hint)}</div>` : ''}
                </li>
            `)
            .join('');

        container.innerHTML = `
            <div class="sp-primer-header">
                <span class="sp-primer-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </span>
                <span class="sp-primer-title">${escapeHtml(title)}</span>
            </div>
            <div class="sp-primer-body">
                <div class="sp-primer-topic">
                    <span class="sp-primer-label">${escapeHtml(topicLabel)}</span>
                    <span class="sp-primer-topic-text">${escapeHtml(primerData.topic || '')}</span>
                </div>
                <div class="sp-primer-questions">
                    <div class="sp-primer-questions-header">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                        ${escapeHtml(objectivesLabel)}
                    </div>
                    <ol class="sp-primer-questions-list">
                        ${questionsHtml}
                    </ol>
                </div>
            </div>
            <div class="sp-primer-actions">
                <button class="sp-primer-btn sp-primer-btn-primary" type="button" data-action="accept">${escapeHtml(startLabel)}</button>
                <button class="sp-primer-btn sp-primer-btn-secondary" type="button" data-action="skip">${escapeHtml(skipLabel)}</button>
            </div>
        `;

        container.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
            onAccept?.(primerData.questions || []);
        });
        container.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
            onSkip?.();
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

    window.PrimerUI = {
        createPrimerUI
    };
})();
