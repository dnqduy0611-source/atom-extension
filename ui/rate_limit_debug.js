// Rate Limit Debug Panel
// Toggle with Ctrl+Shift+R or call toggleRateLimitDebug() in console

(function () {
    const buildEnabled = !!(window.ATOM_BUILD_FLAGS && window.ATOM_BUILD_FLAGS.DEBUG);
    const panel = document.getElementById('rl-debug-panel');

    if (!buildEnabled) {
        if (panel) panel.style.display = 'none';
        return;
    }

    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        const content = document.getElementById('rl-debug-content');
        const closeBtn = document.getElementById('rl-debug-close');
        let updateInterval = null;

        function getRateManager() {
            return window.__ATOM_RATE_MANAGER__ || null;
        }

        function updateDebugPanel() {
            const rm = getRateManager();
            if (!rm || !rm.getDebugState) {
                if (content) {
                    content.innerHTML = '<div style="color:#EF4444">RateLimitManager not loaded</div>';
                }
                return;
            }
            const state = rm.getDebugState();
            const cooldownClass = state.isInCooldown ? 'error' : '';
            const queueClass = state.queueLength > 0 ? 'warn' : '';

            let html = `
                <div class="rl-debug-row">
                    <span class="rl-debug-label">Cooldown:</span>
                    <span class="rl-debug-value ${cooldownClass}">${state.isInCooldown ? state.cooldownRemainingSec + 's' : 'None'}</span>
                </div>
                <div class="rl-debug-row">
                    <span class="rl-debug-label">Queue:</span>
                    <span class="rl-debug-value ${queueClass}">${state.queueLength} jobs</span>
                </div>
                <div class="rl-debug-row">
                    <span class="rl-debug-label">Processing:</span>
                    <span class="rl-debug-value">${state.isProcessing ? 'Yes' : 'No'}</span>
                </div>
                <div class="rl-debug-section">
                    <div class="rl-debug-section-title">Config</div>
                    <div class="rl-debug-row">
                        <span class="rl-debug-label">RPM Total:</span>
                        <span class="rl-debug-value">${state.config.rpmTotal}</span>
                    </div>
                    <div class="rl-debug-row">
                        <span class="rl-debug-label">RPM Background:</span>
                        <span class="rl-debug-value">${state.config.rpmBackground}</span>
                    </div>
                </div>
                <div class="rl-debug-section">
                    <div class="rl-debug-section-title">Recent 429 Errors (${state.recentErrors.length})</div>
            `;
            if (state.recentErrors.length === 0) {
                html += '<div style="color:#A3A3A3">No recent errors</div>';
            } else {
                state.recentErrors.forEach(e => {
                    html += `<div class="rl-debug-row">
                        <span class="rl-debug-label">${e.source}</span>
                        <span class="rl-debug-value warn">${e.ageSec}s ago</span>
                    </div>`;
                });
            }
            html += '</div>';

            if (state.metrics) {
                html += `
                    <div class="rl-debug-section">
                        <div class="rl-debug-section-title">Metrics</div>
                        <div class="rl-debug-row">
                            <span class="rl-debug-label">Requests:</span>
                            <span class="rl-debug-value">${state.metrics.requests || 0}</span>
                        </div>
                        <div class="rl-debug-row">
                            <span class="rl-debug-label">Cache Hits:</span>
                            <span class="rl-debug-value">${state.metrics.cacheHits || 0}</span>
                        </div>
                        <div class="rl-debug-row">
                            <span class="rl-debug-label">429 Errors:</span>
                            <span class="rl-debug-value error">${state.metrics.errors429 || 0}</span>
                        </div>
                    </div>
                `;
            }

            html += '<button class="rl-debug-btn" id="rl-debug-clear">Clear Cooldown</button>';
            if (content) {
                content.innerHTML = html;
            }

            document.getElementById('rl-debug-clear')?.addEventListener('click', () => {
                const rm = getRateManager();
                if (rm && rm.clearCooldown) {
                    rm.clearCooldown();
                    updateDebugPanel();
                }
            });
        }

        function togglePanel() {
            if (!panel) return;
            const isVisible = panel.classList.toggle('show');
            if (isVisible) {
                updateDebugPanel();
                updateInterval = setInterval(updateDebugPanel, 1000);
            } else {
                clearInterval(updateInterval);
                updateInterval = null;
            }
        }

        closeBtn?.addEventListener('click', togglePanel);

        // Ctrl+Shift+R to toggle debug panel
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                togglePanel();
            }
        });

        // Expose globally for console access
        window.toggleRateLimitDebug = togglePanel;
    }

    function maybeInit(enabled) {
        if (enabled) {
            if (panel) panel.style.display = '';
            init();
        } else if (panel) {
            panel.style.display = 'none';
        }
    }

    chrome.storage?.local?.get(['debug_mode'], (res) => {
        maybeInit(!!res?.debug_mode);
    });
    chrome.storage?.onChanged?.addListener((changes) => {
        if (changes.debug_mode) {
            maybeInit(!!changes.debug_mode.newValue);
        }
    });
})();
