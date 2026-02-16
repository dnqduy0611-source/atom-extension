// ui/quota_indicator.js
// Displays API quota status in sidepanel header

(function () {
    'use strict';

    const LEVELS = {
        normal: { color: 'var(--success, #22c55e)', label: '' },
        warning: { color: 'var(--warning, #f59e0b)', label: 'Quota: ' },
        critical: { color: 'var(--error, #ef4444)', label: 'Rate Limited' }
    };

    let indicatorEl = null;
    let tooltipEl = null;
    let updateInterval = null;

    // i18n helper
    function getMessage(key, fallback = '', substitutions = []) {
        try {
            let msg = chrome.i18n?.getMessage?.(key, substitutions);
            return msg || fallback;
        } catch {
            return fallback;
        }
    }

    function createIndicator() {
        // Find or create container
        const topbar = document.querySelector('.sp-topbar');
        if (!topbar) return null;

        // Check if already exists
        if (document.getElementById('quota-indicator')) {
            return document.getElementById('quota-indicator');
        }

        // Create indicator element
        indicatorEl = document.createElement('div');
        indicatorEl.id = 'quota-indicator';
        indicatorEl.style.cssText = `
            display: none;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
            cursor: help;
            margin-left: auto;
            transition: all 0.2s ease;
        `;

        // Create dot
        const dot = document.createElement('span');
        dot.className = 'quota-dot';
        dot.style.cssText = `
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
        `;

        // Create label
        const label = document.createElement('span');
        label.className = 'quota-label';

        indicatorEl.appendChild(dot);
        indicatorEl.appendChild(label);

        // Create tooltip
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'quota-tooltip';
        tooltipEl.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            background: var(--surface, #1e1e1e);
            border: 1px solid var(--border, #333);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 11px;
            color: var(--text, #fff);
            white-space: nowrap;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        indicatorEl.style.position = 'relative';
        indicatorEl.appendChild(tooltipEl);

        indicatorEl.addEventListener('mouseenter', () => {
            tooltipEl.style.display = 'block';
        });
        indicatorEl.addEventListener('mouseleave', () => {
            tooltipEl.style.display = 'none';
        });

        // Insert into topbar
        topbar.appendChild(indicatorEl);

        return indicatorEl;
    }

    function updateIndicator() {
        const rm = window.__ATOM_RATE_MANAGER__;
        if (!rm || !rm.getQuotaStatus) return;

        const status = rm.getQuotaStatus();
        if (!indicatorEl) {
            indicatorEl = createIndicator();
        }
        if (!indicatorEl) return;

        const levelConfig = LEVELS[status.level] || LEVELS.normal;
        const label = indicatorEl.querySelector('.quota-label');

        if (status.level === 'normal') {
            indicatorEl.style.display = 'none';
            return;
        }

        indicatorEl.style.display = 'flex';
        indicatorEl.style.color = levelConfig.color;
        indicatorEl.style.background = `${levelConfig.color}20`;

        if (status.isInCooldown) {
            label.textContent = getMessage('quota_wait_seconds', `Wait ${status.cooldownRemainingSec}s`, [status.cooldownRemainingSec]);
        } else if (status.level === 'critical') {
            label.textContent = `${status.rpmPercent}% RPM`;
        } else {
            label.textContent = `${status.rpmPercent}% RPM`;
        }

        // Update tooltip
        if (tooltipEl) {
            tooltipEl.innerHTML = `
                <div><strong>API Quota Status</strong></div>
                <div style="margin-top:4px">Requests/min: ${status.requestsThisMinute}/${status.rpmLimit}</div>
                <div>Recent 429 errors: ${status.errors429Recent}</div>
                ${status.isInCooldown ? `<div style="color:${LEVELS.critical.color}">Cooldown: ${status.cooldownRemainingSec}s</div>` : ''}
            `;
        }
    }

    function init() {
        // Wait for DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Create indicator after a short delay to ensure topbar exists
        setTimeout(() => {
            createIndicator();
            updateIndicator();

            // Subscribe to status changes
            const rm = window.__ATOM_RATE_MANAGER__;
            if (rm && rm.on) {
                rm.on('status_change', updateIndicator);
            }

            // Also poll for updates (backup)
            updateInterval = setInterval(updateIndicator, 2000);
        }, 500);
    }

    // Cleanup on unload
    window.addEventListener('beforeunload', () => {
        if (updateInterval) clearInterval(updateInterval);
    });

    // Start initialization
    init();
})();
