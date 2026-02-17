// ui/components/nudge.js
// Smart nudge overlay UI for content pages

(function () {
    'use strict';

    function injectNudgeStyles() {
        if (document.getElementById('atom-nudge-styles')) return;

        const style = document.createElement('style');
        style.id = 'atom-nudge-styles';
        style.textContent = `
            .atom-nudge-overlay {
                position: fixed;
                inset: auto 16px 16px 16px;
                z-index: 2147483647;
                display: flex;
                justify-content: center;
                pointer-events: none;
                font-family: system-ui, -apple-system, Segoe UI, sans-serif;
            }
            .atom-nudge-card {
                pointer-events: auto;
                max-width: 420px;
                width: 100%;
                background: #0b1220; /* Deep blue/black background */
                color: #e5e7eb;
                border: 1px solid rgba(255,255,255,0.12); /* Slightly clearer border */
                border-radius: 14px;
                box-shadow: 0 12px 30px rgba(0,0,0,0.5); /* Stronger shadow */
                overflow: hidden;
                animation: nudge-slide-in 0.25s ease-out;
            }
            .atom-nudge-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 14px;
                background: rgba(16, 185, 129, 0.2); /* More visible header bg */
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-weight: 600;
                font-size: 13px;
                color: #ffffff; /* White header text */
            }
            .atom-nudge-body {
                padding: 14px 14px; /* More padding */
                font-size: 13px;    /* Larger text */
                line-height: 1.5;
                color: #e2e8f0;     /* Lighter gray */
            }
            .atom-nudge-actions {
                display: flex;
                gap: 10px;
                padding: 0 14px 14px;
            }
            .atom-nudge-btn {
                flex: 1;
                padding: 10px 12px; /* Larger touch target */
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.2); /* Much sharper border */
                background: rgba(255,255,255,0.1);       /* More opaque background */
                color: #ffffff;
                font-size: 12px;                         /* Larger font */
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .atom-nudge-btn:hover {
                background: rgba(255,255,255,0.2);
                transform: translateY(-1px);
                border-color: rgba(255,255,255,0.4);
            }
            .atom-nudge-btn.primary {
                background: #10b981;
                border-color: #10b981;
                color: #022c22; /* High contrast black-green text */
                font-weight: 700;
            }
            .atom-nudge-btn.primary:hover {
                background: #34d399; /* Lighter on hover */
                border-color: #34d399;
            }
            .atom-nudge-dismiss {
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 18px;
                padding: 4px;
                line-height: 1;
                border-radius: 4px;
            }
            .atom-nudge-dismiss:hover {
                background: rgba(255,255,255,0.1);
                color: #ffffff;
            }
            .atom-nudge-overlay.dismissed .atom-nudge-card {
                animation: nudge-slide-out 0.2s ease forwards;
            }
            @keyframes nudge-slide-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes nudge-slide-out {
                to { opacity: 0; transform: translateY(10px); }
            }
        `;
        document.head.appendChild(style);
    }

    function createNudgeUI(nudgeData, onAction) {
        const overlay = document.createElement('div');
        overlay.className = 'atom-nudge-overlay';

        const actions = Array.isArray(nudgeData.actions) ? nudgeData.actions : [];
        const actionsHtml = actions.map(action => `
            <button class="atom-nudge-btn ${action.primary ? 'primary' : ''}" data-action="${action.id}">
                ${escapeHtml(action.label)}
            </button>
        `).join('');

        overlay.innerHTML = `
            <div class="atom-nudge-card">
                <button class="atom-nudge-dismiss" aria-label="Dismiss">×</button>
                <div class="atom-nudge-header">
                    <span>${nudgeData.icon || `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`}</span>
                    <span>${escapeHtml(nudgeData.title || 'Quick nudge')}</span>
                </div>
                <div class="atom-nudge-body">${escapeHtml(nudgeData.message || '')}</div>
                <div class="atom-nudge-actions">${actionsHtml}</div>
            </div>
        `;

        overlay.querySelectorAll('.atom-nudge-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.getAttribute('data-action');
                onAction?.(actionId, nudgeData);
            });
        });

        overlay.querySelector('.atom-nudge-dismiss')?.addEventListener('click', () => {
            overlay.classList.add('dismissed');
            setTimeout(() => overlay.remove(), 200);
        });

        return overlay;
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.NudgeUI = {
        injectNudgeStyles,
        createNudgeUI
    };
})();
