// services/cross_domain_alerts.js
// Cross-domain connection alerts when reading connects to past knowledge

(function () {
    'use strict';

    const ALERT_TEMPLATES = {
        SIMILAR_CONCEPT: {
            id: 'similar_concept',
            icon: '✦',
            title: 'This looks familiar!',
            template: '"{current}" is similar to "{past}" you read {timeAgo}.'
        },
        CONTRADICTION: {
            id: 'contradiction',
            icon: '⚠',
            title: 'Different perspective!',
            template: 'This may contradict what you read about "{topic}" in "{past}".'
        },
        BUILDING_BLOCK: {
            id: 'building_block',
            icon: '▦',
            title: 'Building on your knowledge!',
            template: 'This extends your understanding of "{topic}" from "{past}".'
        },
        PRACTICAL_APPLICATION: {
            id: 'practical_application',
            icon: '⚙',
            title: 'Now you can apply it!',
            template: 'This shows how to apply "{concept}" you learned in "{past}".'
        }
    };

    const ALERT_CONFIG = {
        minSimilarity: 0.75,
        maxAlertsPerSession: 3,
        cooldownMs: 10 * 60 * 1000 // 10 minutes
    };

    let alertCount = 0;
    let lastAlertTime = 0;

    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'some time ago';

        const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    }

    /**
     * Determines the appropriate alert type based on content patterns.
     */
    function determineAlertType(currentText, similarity) {
        if (!currentText) return 'SIMILAR_CONCEPT';

        const text = currentText.toLowerCase();

        // Very high similarity suggests same concept
        if (similarity > 0.9) {
            return 'SIMILAR_CONCEPT';
        }

        // Check for application patterns
        if (/how to|example|implement|use case|apply|practical/i.test(text)) {
            return 'PRACTICAL_APPLICATION';
        }

        // Check for extension patterns
        if (/additionally|furthermore|building on|extends|moreover|also/i.test(text)) {
            return 'BUILDING_BLOCK';
        }

        // Check for contradiction patterns
        if (/however|but|contrary|although|despite|whereas|disagree/i.test(text)) {
            return 'CONTRADICTION';
        }

        // Default
        return 'SIMILAR_CONCEPT';
    }

    /**
     * Checks if current highlight triggers a cross-domain alert.
     * @param {Object} highlight - Current highlight data
     * @param {Object} pageContext - Current page context
     * @returns {Promise<Object|null>}
     */
    async function checkForAlert(highlight, pageContext) {
        // Validate input
        if (!highlight || !pageContext) {
            return null;
        }

        // Check limits
        if (alertCount >= ALERT_CONFIG.maxAlertsPerSession) {
            return null;
        }

        if (Date.now() - lastAlertTime < ALERT_CONFIG.cooldownMs) {
            return null;
        }

        // Check dependencies
        if (!window.SemanticSearchService) {
            return null;
        }

        try {
            const highlightText = highlight.text || '';
            if (!highlightText.trim()) {
                return null;
            }

            // Search for related content
            const related = await window.SemanticSearchService.findRelated(highlightText, {
                topK: 3,
                minSimilarity: ALERT_CONFIG.minSimilarity
            });

            if (related.length === 0) {
                return null;
            }

            // Get current domain
            let currentDomain = '';
            try {
                currentDomain = new URL(pageContext.url || '').hostname.replace('www.', '');
            } catch {
                currentDomain = '';
            }

            // Find a match from a different domain
            let topMatch = related[0];

            // Prefer cross-domain matches
            if (currentDomain && topMatch.domain === currentDomain && related.length > 1) {
                const crossDomain = related.find(r => r.domain !== currentDomain);
                if (crossDomain) {
                    topMatch = crossDomain;
                }
            }

            // Determine alert type
            const alertType = determineAlertType(highlightText, topMatch.similarity);

            return {
                type: alertType,
                template: ALERT_TEMPLATES[alertType],
                current: {
                    text: highlightText.slice(0, 100),
                    title: pageContext.title || ''
                },
                past: {
                    sessionId: topMatch.sessionId,
                    title: topMatch.title || 'Unknown',
                    similarity: topMatch.similarity,
                    preview: topMatch.preview || '',
                    createdAt: topMatch.createdAt,
                    domain: topMatch.domain || ''
                },
                isCrossDomain: currentDomain !== topMatch.domain
            };

        } catch (err) {
            console.error('[CrossDomainAlert] Check failed:', err);
            return null;
        }
    }

    /**
     * Marks that an alert was shown.
     */
    function recordAlert() {
        alertCount++;
        lastAlertTime = Date.now();
    }

    /**
     * Resets alert counters.
     */
    function resetAlerts() {
        alertCount = 0;
        lastAlertTime = 0;
    }

    /**
     * Gets current alert state.
     */
    function getAlertState() {
        return {
            alertCount,
            maxAlerts: ALERT_CONFIG.maxAlertsPerSession,
            cooldownRemaining: Math.max(0, ALERT_CONFIG.cooldownMs - (Date.now() - lastAlertTime)),
            canShowAlert: alertCount < ALERT_CONFIG.maxAlertsPerSession &&
                (Date.now() - lastAlertTime >= ALERT_CONFIG.cooldownMs)
        };
    }

    /**
     * Formats the alert message with data.
     */
    function formatAlertMessage(alertData) {
        if (!alertData || !alertData.template) {
            return null;
        }

        const { template, current, past } = alertData;

        let message = template.template
            .replace('{current}', current.title || 'this article')
            .replace('{past}', past.title || 'a previous article')
            .replace('{topic}', (current.text || '').slice(0, 30))
            .replace('{concept}', (current.text || '').slice(0, 30))
            .replace('{timeAgo}', formatTimeAgo(past.createdAt));

        return {
            icon: template.icon,
            title: template.title,
            message: message,
            similarity: Math.round((past.similarity || 0) * 100) + '%',
            isCrossDomain: alertData.isCrossDomain,
            pastSessionId: past.sessionId,
            pastTitle: past.title,
            pastDomain: past.domain
        };
    }

    /**
     * Creates alert UI element.
     */
    function createAlertUI(alertData, callbacks) {
        const formatted = formatAlertMessage(alertData);
        if (!formatted) return null;

        const container = document.createElement('div');
        container.className = 'sp-cross-domain-alert';

        container.innerHTML = `
            <div class="sp-alert-header">
                <span class="sp-alert-icon">${formatted.icon}</span>
                <span class="sp-alert-title">${formatted.title}</span>
                <button type="button" class="sp-alert-close">×</button>
            </div>
            <div class="sp-alert-body">
                <p class="sp-alert-message">${formatted.message}</p>
                <div class="sp-alert-meta">
                    <span class="sp-alert-similarity">${formatted.similarity} match</span>
                    ${formatted.isCrossDomain ? '<span class="sp-alert-cross">Cross-domain</span>' : ''}
                </div>
            </div>
            <div class="sp-alert-actions">
                <button type="button" class="sp-alert-btn sp-alert-btn-primary" id="sp-alert-view">View Notes</button>
                <button type="button" class="sp-alert-btn" id="sp-alert-dismiss">Dismiss</button>
            </div>
        `;

        // Event handlers
        container.querySelector('.sp-alert-close')?.addEventListener('click', () => {
            container.remove();
            if (typeof callbacks?.onDismiss === 'function') {
                callbacks.onDismiss();
            }
        });

        container.querySelector('#sp-alert-dismiss')?.addEventListener('click', () => {
            container.remove();
            if (typeof callbacks?.onDismiss === 'function') {
                callbacks.onDismiss();
            }
        });

        container.querySelector('#sp-alert-view')?.addEventListener('click', () => {
            if (typeof callbacks?.onViewNotes === 'function') {
                callbacks.onViewNotes(formatted.pastSessionId);
            }
        });

        return container;
    }

    // CSS Styles
    const CROSS_DOMAIN_ALERT_STYLES = `
.sp-cross-domain-alert {
    margin: 12px;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 10px;
    overflow: hidden;
    animation: spAlertSlideIn 0.3s ease-out;
}

@keyframes spAlertSlideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.sp-alert-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid rgba(245, 158, 11, 0.3);
}

.sp-alert-icon {
    font-size: 18px;
}

.sp-alert-title {
    flex: 1;
    font-weight: 600;
    color: #92400e;
    font-size: 14px;
}

.sp-alert-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #92400e;
    cursor: pointer;
    padding: 0 4px;
}

.sp-alert-body {
    padding: 12px;
}

.sp-alert-message {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #78350f;
    line-height: 1.4;
}

.sp-alert-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
}

.sp-alert-similarity {
    background: rgba(16, 185, 129, 0.2);
    color: #047857;
    padding: 2px 6px;
    border-radius: 4px;
}

.sp-alert-cross {
    background: rgba(139, 92, 246, 0.2);
    color: #6d28d9;
    padding: 2px 6px;
    border-radius: 4px;
}

.sp-alert-actions {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.3);
    border-top: 1px solid rgba(245, 158, 11, 0.2);
}

.sp-alert-btn {
    flex: 1;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;
}

.sp-alert-btn:hover {
    background: #f3f4f6;
}

.sp-alert-btn-primary {
    background: #f59e0b;
    border-color: #f59e0b;
    color: white;
}

.sp-alert-btn-primary:hover {
    background: #d97706;
}

/* Dark mode */
body.dark-mode .sp-cross-domain-alert,
.dark .sp-cross-domain-alert {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%);
    border-color: rgba(245, 158, 11, 0.4);
}

body.dark-mode .sp-alert-header,
.dark .sp-alert-header {
    background: rgba(0, 0, 0, 0.2);
}

body.dark-mode .sp-alert-title,
.dark .sp-alert-title {
    color: #fcd34d;
}

body.dark-mode .sp-alert-message,
.dark .sp-alert-message {
    color: #fef3c7;
}

body.dark-mode .sp-alert-actions,
.dark .sp-alert-actions {
    background: rgba(0, 0, 0, 0.2);
}
`;

    function injectCrossDomainAlertStyles() {
        if (document.getElementById('cross-domain-alert-styles')) return;
        const style = document.createElement('style');
        style.id = 'cross-domain-alert-styles';
        style.textContent = CROSS_DOMAIN_ALERT_STYLES;
        document.head.appendChild(style);
    }

    window.CrossDomainAlertService = {
        ALERT_TEMPLATES,
        ALERT_CONFIG,
        checkForAlert,
        recordAlert,
        resetAlerts,
        getAlertState,
        formatAlertMessage,
        createAlertUI,
        injectCrossDomainAlertStyles
    };
})();
