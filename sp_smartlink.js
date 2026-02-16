/**
 * sp_smartlink.js — Smart Linking + Deep Angle + Connections
 * Phase 4b of Sidepanel Module Split
 *
 * Handles: Deep Angle generation, connection detection, semantic analysis,
 * smart link metrics, connection rendering and actions.
 *
 * Dependencies (read from window.SP):
 *   SP.threads, SP.activeThreadId, SP.elements, SP.API_CONFIG,
 *   SP.callGeminiAPI, SP.callLLMAPI, SP.getLLMProvider,
 *   SP.getMessage, SP.showToast, SP.getApiKey, SP.escapeHtml,
 *   SP.hashString, SP.normalizeUrl, SP.formatMessage,
 *   SP.addMessageToDOM, SP.sendToGemini, SP.renderThreadList,
 *   SP.renderActiveThread, SP.saveThreadsToStorage,
 *   SP.updateAllCounts, SP.pageContext, SP.currentDomain,
 *   SP.semanticFlags
 */
(function () {
    'use strict';
    const SP = window.SP;
    if (!SP) { console.error('[SmartLink] SP not found'); return; }

    // ── Helper wrappers ──
    function getMessage(key, fallback) { return SP.getMessage ? SP.getMessage(key, fallback) : fallback; }
    function showToast(msg, type) { if (SP.showToast) SP.showToast(msg, type); }
    function hashString(input) { return SP.hashString ? SP.hashString(input) : String(input); }
    function normalizeUrl(value) { return SP.normalizeUrl ? SP.normalizeUrl(value) : value; }

    // ── State ──
    const deepAngleByUrl = new Map();
    const smartLinkMetrics = {
        connections_detected_count: 0,
        semantic_candidates_count: 0,
        deep_angle_generated_count: 0,
        fallback_to_recency_count: 0,
        embedding_api_errors: 0
    };
    let isGeneratingDeepAngle = false;

    // ===========================
    // Metrics
    // ===========================
    function recordSmartLinkMetric(name, delta = 1) {
        if (!Object.prototype.hasOwnProperty.call(smartLinkMetrics, name)) return;
        const increment = Number.isFinite(delta) ? delta : 1;
        smartLinkMetrics[name] += increment;
        window.__ATOM_SMARTLINK_METRICS__ = { ...smartLinkMetrics };
    }

    // ===========================
    // Deep Angle UI
    // ===========================
    function getDeepAngleCacheKey(thread) {
        const connectionKey = (thread?.connections || [])
            .map((conn) => `${conn.type || ''}:${conn.targetId || conn.targetIndex || ''}:${Math.round((conn.confidence || 0) * 100)}`)
            .join('|');
        return hashString(`${thread?.id || 'thread'}::${connectionKey}`);
    }

    function getCurrentDeepAngleKey() {
        const pageContext = SP.pageContext;
        return normalizeUrl(pageContext?.url || '');
    }

    function updateDeepAngleUI() {
        const elements = SP.elements || {};
        if (!elements.deepAngleBtn || !elements.deepAngleOutput || !elements.deepAngleText) return;
        const pageContext = SP.pageContext;
        const hasPageContext = !!pageContext?.url;
        const cacheKey = getCurrentDeepAngleKey();
        const cached = cacheKey ? deepAngleByUrl.get(cacheKey) : null;

        elements.deepAngleBtn.disabled = !hasPageContext;
        if (elements.deepAngleStatus) {
            elements.deepAngleStatus.textContent = hasPageContext
                ? getMessage('sp_deep_angle_hint', 'See another perspective from your recent highlights.')
                : getMessage('sp_deep_angle_empty', 'Select or save more highlights to unlock this.');
            elements.deepAngleStatus.style.display = 'block';
        }

        if (hasPageContext && cached?.text) {
            elements.deepAngleText.innerHTML = SP.formatMessage ? SP.formatMessage(cached.text) : cached.text;
            elements.deepAngleOutput.hidden = false;
        } else {
            elements.deepAngleOutput.hidden = true;
            elements.deepAngleText.textContent = '';
        }
    }

    function setDeepAngleLoading(isLoading) {
        const elements = SP.elements || {};
        if (!elements.deepAngleBtn) return;
        const pageContext = SP.pageContext;
        if (isLoading) {
            const loadingLabel = getMessage('sp_deep_angle_loading', 'Generating...');
            elements.deepAngleBtn.classList.add('sp-action-loading');
            elements.deepAngleBtn.setAttribute('aria-busy', 'true');
            elements.deepAngleBtn.disabled = true;
            elements.deepAngleBtn.innerHTML = `<span class="btn-spinner"></span> ${loadingLabel}`;
        } else {
            const label = getMessage('sp_deep_angle', 'New angle');
            elements.deepAngleBtn.classList.remove('sp-action-loading');
            elements.deepAngleBtn.setAttribute('aria-busy', 'false');
            elements.deepAngleBtn.disabled = !pageContext?.url;
            elements.deepAngleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8Z"/><path d="M10 22h4"/></svg> ${label}`;
        }
    }

    // ===========================
    // Deep Angle from Connections
    // ===========================
    async function generateDeepAngleFromConnections(thread) {
        if (!thread?.connections?.length) {
            showToast('No connections available.', 'info');
            updateDeepAngleUI();
            return;
        }

        const cfg = SP.API_CONFIG || {};
        const ttlMs = cfg.CACHE?.DEEP_ANGLE_TTL_MS || 6 * 60 * 60 * 1000;
        const cacheKey = getDeepAngleCacheKey(thread);
        const now = Date.now();
        if (thread.deepAngle?.cacheKey === cacheKey && (now - (thread.deepAngle.generatedAt || 0)) < ttlMs) {
            updateDeepAngleUI();
            return;
        }

        const apiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));
        if (!apiKey) {
            showToast(getMessage('sp_error_no_api_key', 'AI Access Key not set'), 'error');
            return;
        }

        const counts = thread.connections.reduce((acc, conn) => {
            const type = String(conn.type || '').toLowerCase();
            if (type === 'supports') acc.supports += 1;
            if (type === 'contradicts') acc.contradicts += 1;
            if (type === 'extends') acc.extends += 1;
            return acc;
        }, { supports: 0, contradicts: 0, extends: 0 });

        const hasTension = thread.connections.some(c => c.type === 'contradicts' && (c.confidence || 0) >= 0.7);
        let angleType = 'Evolution';
        if (hasTension) {
            angleType = 'Tension';
        } else if (counts.supports >= counts.extends && counts.supports >= counts.contradicts) {
            angleType = 'Evidence';
        }

        const lang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const prompt = `You are a critical thinking coach. Create a 1-2 sentence Deep Angle suggestion in ${lang}.

Angle type: ${angleType}

Connections:
${thread.connections.map((conn, idx) => (
            `[${idx + 1}] ${conn.type?.toUpperCase() || 'UNKNOWN'} (${Math.round((conn.confidence || 0) * 100)}%): ${conn.explanation || ''}\nPreview: ${conn.targetPreview || ''}`
        )).join('\n\n')}

Rules:
- 1-2 sentences only
- Focus on the angle type
- Avoid repeating the connection text verbatim`;

        try {
            setDeepAngleLoading(true);
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await SP.callLLMAPI('You generate concise deep angles.', conversationHistory, {
                priority: 'background',
                allowFallback: true,
                cacheKey: `deep-angle:${thread.id}:${cacheKey}`,
                cacheTtlMs: ttlMs,
                generationConfig: { temperature: 0.4, maxOutputTokens: 1024 }
            });


            const text = (response || '').trim();
            if (!text) {
                showToast(getMessage('sp_error_empty_response', 'No response received'), 'error');
                return;
            }

            thread.deepAngle = {
                text,
                cacheKey,
                angleType,
                generatedAt: Date.now()
            };
            recordSmartLinkMetric('deep_angle_generated_count', 1);
            await (SP.saveThreadsToStorage ? SP.saveThreadsToStorage() : Promise.resolve());
            updateDeepAngleUI();
        } catch (err) {
            if (err?.message?.startsWith('PROBATION_ACTIVE')) {
                console.log('[DeepAngle] Skipped due to probation mode:', err.message);
            } else {
                console.error('[DeepAngle] Error:', err);
                showToast(getMessage('sp_deep_angle_error', "Couldn't generate a new angle."), 'error');
            }
        } finally {
            setDeepAngleLoading(false);
        }
    }

    // ===========================
    // Semantic Candidate Selection
    // ===========================
    async function getSemanticCandidateThreads(newThread, otherThreads) {
        const semanticFlags = SP.semanticFlags || {};
        if (!semanticFlags.embeddingsEnabled || !semanticFlags.semanticSearchEnabled) {
            return null;
        }
        if (!window.SemanticSearchService || !window.EmbeddingService || !window.VectorStore) {
            return null;
        }

        const queryText = newThread?.highlight?.text || '';
        if (!queryText.trim()) return null;

        const currentDomain = SP.currentDomain || newThread?.highlight?.domain;
        const domain = newThread?.highlight?.domain || currentDomain;
        if (!domain) return null;

        const newUrl = normalizeUrl(newThread?.highlight?.url || '');
        const configTtl = window.SemanticSearchService?.SEARCH_CONFIG?.domainTtlMs?.[domain];
        const maxAgeMs = Number.isFinite(configTtl) ? configTtl : 14 * 24 * 60 * 60 * 1000;

        try {
            const related = await window.SemanticSearchService.searchWithinDomain(queryText, domain, 10, {
                maxAgeMs,
                onError: () => recordSmartLinkMetric('embedding_api_errors', 1)
            });

            if (!Array.isArray(related) || related.length === 0) {
                return [];
            }

            const filtered = related.filter(r => {
                const url = normalizeUrl(r.url || '');
                return url && url !== newUrl;
            });

            const threadByUrl = new Map();
            otherThreads.forEach((thread) => {
                const url = normalizeUrl(thread.highlight?.url || '');
                if (!url) return;
                const existing = threadByUrl.get(url);
                if (!existing || (thread.createdAt || 0) > (existing.createdAt || 0)) {
                    threadByUrl.set(url, thread);
                }
            });

            const candidates = filtered.map((result) => {
                const url = normalizeUrl(result.url || '');
                const thread = threadByUrl.get(url);
                if (!thread?.highlight?.text) return null;
                return {
                    thread,
                    similarity: Number.isFinite(result.similarity) ? result.similarity : 0,
                    createdAt: thread.createdAt || 0
                };
            }).filter(Boolean);

            if (candidates.length === 0) {
                return [];
            }

            candidates.sort((a, b) => {
                const diff = b.similarity - a.similarity;
                if (Math.abs(diff) <= 0.01) {
                    return (b.createdAt || 0) - (a.createdAt || 0);
                }
                return diff;
            });

            recordSmartLinkMetric('semantic_candidates_count', candidates.length);
            const topThreads = candidates.slice(0, 5).map(c => c.thread);
            return topThreads;
        } catch (err) {
            recordSmartLinkMetric('embedding_api_errors', 1);
            console.warn('[SmartLink] Semantic candidate selection failed:', err);
            return [];
        }
    }

    // ===========================
    // Connection Analysis
    // ===========================
    async function analyzeConnections(newThread) {
        const threads = SP.threads || [];
        const otherThreads = threads.filter(t => t.id !== newThread.id && t.highlight?.text);

        if (otherThreads.length === 0) return;

        showConnectionsLoading();

        try {
            const apiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));
            if (!apiKey) {
                hideConnectionsLoading();
                return;
            }

            const newText = newThread.highlight?.text || '';
            if (!newText.trim()) {
                hideConnectionsLoading();
                return;
            }

            let candidateThreads = await getSemanticCandidateThreads(newThread, otherThreads);
            if (!candidateThreads || candidateThreads.length === 0) {
                recordSmartLinkMetric('fallback_to_recency_count', 1);
                candidateThreads = otherThreads.slice(-5);
                console.log('[SmartLink] Using recency fallback candidates:', candidateThreads.length);
            } else {
                console.log('[SmartLink] Using semantic candidates:', candidateThreads.length);
            }

            const previousHighlights = candidateThreads.map((t, idx) => ({
                id: t.id,
                index: idx + 1,
                text: t.highlight?.text?.slice(0, 500) || ''
            }));

            if (previousHighlights.length === 0) {
                hideConnectionsLoading();
                return;
            }

            const connections = await detectConnections(apiKey, newText, previousHighlights);

            if (connections && connections.length > 0) {
                recordSmartLinkMetric('connections_detected_count', connections.length);
                newThread.connections = connections;
                newThread.deepAngle = null;
                renderConnections(connections);
                await (SP.saveThreadsToStorage ? SP.saveThreadsToStorage() : Promise.resolve());
            } else {
                hideConnectionsLoading();
            }
        } catch (error) {
            if (error?.message?.startsWith('PROBATION_ACTIVE')) {
                console.log('[SmartLink] Skipped due to probation mode:', error.message);
            } else {
                console.error('[SmartLink] Error:', error);
            }
            hideConnectionsLoading();
        }
    }

    // ===========================
    // Connection Detection (Direct API)
    // ===========================
    async function detectConnections(apiKey, newText, previousHighlights) {
        const cfg = SP.API_CONFIG || {};
        const lang = window.i18nUtils ? await window.i18nUtils.getEffectiveLanguage() : 'English';
        const rateManager = window.RateLimitManager
            ? (window.__ATOM_RATE_MANAGER__ || (window.__ATOM_RATE_MANAGER__ = new window.RateLimitManager({
                rpmTotal: 15,
                rpmBackground: 8,
                cacheTtlMs: cfg.CACHE?.DEFAULT_BACKGROUND_TTL_MS || 5 * 60 * 1000
            })))
            : null;

        const prompt = `Analyze the relationship between a NEW highlighted text and PREVIOUS highlights from the same reading session.

NEW HIGHLIGHT:
"${newText.slice(0, 800)}"

PREVIOUS HIGHLIGHTS:
${previousHighlights.map(h => `[#${h.index}] "${h.text}"`).join('\n\n')}

For each previous highlight, determine if the NEW highlight:
1. CONTRADICTS it (opposing viewpoints, conflicting data)
2. SUPPORTS it (adds evidence, reinforces the point)
3. EXTENDS it (builds upon, adds new dimension)
4. UNRELATED (no meaningful connection)

Respond in JSON format:
{
  "connections": [
    {
      "targetIndex": 1,
      "type": "contradicts|supports|extends|unrelated",
      "confidence": 0.8,
      "explanation": "Brief explanation in ${lang}"
    }
  ]
}

Only include connections with confidence >= 0.6. If no strong connections, return empty array.`;

        const url = `${cfg.API_BASE}/${cfg.MODEL_NAME}:generateContent?key=${apiKey}`;

        const body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                responseMimeType: "application/json"
            }
        };

        try {
            const cacheKey = `smartlink:${hashString(`${newText.slice(0, 500)}::${previousHighlights.map(h => h.text).join('|')}`)}`;
            const runRequest = async () => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) {
                    if (response.status === 429 && rateManager) {
                        rateManager.record429Error('smartlink');
                        const retryAfterHeader = response.headers.get('Retry-After');
                        const retryAfterHeaderSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
                        const errorText = await response.text().catch(() => '');
                        const retryAfterSeconds = window.parseRetryAfterSeconds
                            ? window.parseRetryAfterSeconds(errorText)
                            : null;
                        const retrySeconds = Number.isFinite(retryAfterHeaderSeconds)
                            ? retryAfterHeaderSeconds
                            : retryAfterSeconds;
                        if (Number.isFinite(retrySeconds)) {
                            rateManager.setCooldown((retrySeconds + 1) * 1000, 'smartlink-429');
                        }
                    }
                    throw new Error(`SmartLink API error ${response.status}`);
                }
                return response.json();
            };
            const data = rateManager
                ? await rateManager.enqueue(runRequest, {
                    priority: 'background',
                    cacheKey,
                    cacheTtlMs: cfg.CACHE?.SMARTLINK_TTL_MS || 10 * 60 * 1000,
                    skipDuringCooldown: true
                })
                : await runRequest();
            let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const parseRobustJSON = (text) => {
                if (!text || typeof text !== 'string' || !text.trim()) {
                    console.warn('[SmartLink] Empty response from API, returning empty connections');
                    return { connections: [] };
                }

                const cleanAndParseJson = (text) => {
                    if (!text) return {};
                    let clean = text.replace(/```json\s*|\s*```/g, '').trim();
                    const match = clean.match(/\{[\s\S]*\}/);
                    if (match) clean = match[0];

                    try { return JSON.parse(clean); } catch (e) { }

                    try {
                        let fixed = clean.replace(/,\s*([}\]])/g, '$1');
                        fixed = fixed.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                        return JSON.parse(fixed);
                    } catch (e) {
                        console.warn('[SmartLink] Strict parse failed, trying fallback extraction. Raw:', clean.slice(0, 100));

                        let arrayMatch = clean.match(/"connections"\s*:\s*\[([\s\S]*?)\]/);
                        if (!arrayMatch) arrayMatch = clean.match(/connections\s*:\s*\[([\s\S]*?)\]/);
                        if (!arrayMatch) arrayMatch = clean.match(/\[([\s\S]*?)\]/);

                        if (arrayMatch) {
                            try {
                                const content = arrayMatch[1];
                                const sanitized = content.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
                                const noTrailing = sanitized.replace(/,\s*([}\]])/g, '$1');
                                return JSON.parse(`{"connections": [${noTrailing}]}`);
                            } catch (err) {
                                console.warn('[SmartLink] Fallback construction failed:', err);
                            }
                        }

                        const connectionsRaw = clean.match(/"connections"\s*:\s*\[([\s\S]*)/)?.[1]
                            || clean.match(/\[([\s\S]*)/)?.[1]
                            || '';
                        if (connectionsRaw) {
                            const objMatches = [...connectionsRaw.matchAll(/\{[^{}]*\}/g)];
                            const recovered = [];
                            for (const m of objMatches) {
                                try {
                                    let os = m[0].replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":').replace(/,\s*}/g, '}');
                                    const o = JSON.parse(os);
                                    if (o.targetIndex !== undefined || o.type) recovered.push(o);
                                } catch (_) { }
                            }
                            if (recovered.length > 0) {
                                console.log('[SmartLink] Recovered', recovered.length, 'connection(s) from truncated JSON');
                                return { connections: recovered };
                            }
                        }

                        console.warn('[SmartLink] Could not parse connections, returning empty');
                        return { connections: [] };
                    }
                };

                return cleanAndParseJson(text);
            };

            const parsed = parseRobustJSON(rawText);
            const validConnections = parsed.connections;

            return validConnections;
        } catch (error) {
            console.error('[SmartLink] Parse error:', error);
            return [];
        }
    }

    // ===========================
    // Connection Display Helpers
    // ===========================
    function showConnectionsLoading() {
        showToast(getMessage('sp_analyzing', 'Analyzing connections...'), 'info');
    }

    function hideConnectionsLoading() {
        // No longer needed with new tab layout
    }

    function renderConnections(connections) {
        renderConnectionsList();
        if (SP.updateAllCounts) SP.updateAllCounts();
    }

    // ===========================
    // Connection Actions
    // ===========================
    async function handleConnectionAction(action, targetId) {
        const threads = SP.threads || [];
        const activeThreadId = SP.activeThreadId;
        const currentThread = threads.find(t => t.id === activeThreadId);
        const targetThread = threads.find(t => t.id === targetId);

        if (!currentThread || !targetThread) return;

        if (action === 'compare') {
            const comparePrompt = `Compare these two highlighted passages and explain how they relate:

PASSAGE 1:
"${currentThread.highlight?.text?.slice(0, 500)}"

PASSAGE 2:
"${targetThread.highlight?.text?.slice(0, 500)}"

Provide a clear analysis of:
1. Key similarities
2. Key differences
3. How they complement each other (if at all)`;

            currentThread.messages.push({ role: 'user', content: comparePrompt });
            if (SP.addMessageToDOM) SP.addMessageToDOM(comparePrompt, 'user');
            if (SP.sendToGemini) await SP.sendToGemini(comparePrompt, currentThread);
            if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();

        } else if (action === 'merge') {
            const mergedHighlight = `${currentThread.highlight?.text || ''}\n\n---\n\n${targetThread.highlight?.text || ''}`;
            currentThread.highlight.text = mergedHighlight;
            currentThread.messages = [...targetThread.messages, ...currentThread.messages];

            // Remove target thread (splice for mutation)
            const idx = threads.findIndex(t => t.id === targetId);
            if (idx !== -1) threads.splice(idx, 1);

            if (SP.saveThreadsToStorage) await SP.saveThreadsToStorage();
            if (SP.renderThreadList) SP.renderThreadList();
            if (SP.renderActiveThread) SP.renderActiveThread();

            hideConnectionsLoading();
        }
    }

    // ===========================
    // Connections List Rendering
    // ===========================
    function renderConnectionsList() {
        const elements = SP.elements || {};
        if (!elements.connectionsList) return;

        const threads = SP.threads || [];
        const allConnections = [];
        threads.forEach(thread => {
            if (thread.connections) {
                thread.connections.forEach(conn => {
                    allConnections.push({ ...conn, threadId: thread.id });
                });
            }
        });

        if (allConnections.length === 0) {
            elements.connectionsList.innerHTML = `<div class="sp-connection-empty">${getMessage('sp_no_connections', 'No related ideas yet')}</div>`;
            updateDeepAngleUI();
            return;
        }

        const typeLabels = {
            'contradicts': getMessage('sp_connection_contradicts', 'Contradicts'),
            'supports': getMessage('sp_connection_supports', 'Supports'),
            'extends': getMessage('sp_connection_extends', 'Extends')
        };

        const escapeHtml = SP.escapeHtml || ((s) => s);

        elements.connectionsList.innerHTML = allConnections.map(conn => `
            <div class="sp-connection-item ${conn.type}" data-thread-id="${conn.threadId}">
                <div class="sp-connection-type">
                    ${conn.type === 'contradicts' ? '⚡' : conn.type === 'supports' ? '✔' : '➕'}
                    ${typeLabels[conn.type] || conn.type}
                </div>
                <div class="sp-connection-preview">"${escapeHtml(conn.targetPreview?.slice(0, 50) || '')}..."</div>
            </div>
        `).join('');

        // Click to view thread
        elements.connectionsList.querySelectorAll('.sp-connection-item').forEach(item => {
            item.addEventListener('click', () => {
                SP.activeThreadId = item.dataset.threadId;
                if (SP.renderThreadList) SP.renderThreadList();
                if (SP.renderActiveThread) SP.renderActiveThread();
            });
        });

        updateDeepAngleUI();
    }

    // ===========================
    // Deep Angle Button Handler
    // ===========================
    async function selectRelevantThreads(currentTitle, currentText, candidates) {
        if (!candidates || candidates.length === 0) return [];
        if (candidates.length <= 5) return candidates;

        const listSnippet = candidates.map((t, i) => `${i}. [${t.highlight?.title}]: ${t.highlight?.text?.slice(0, 80)}`).join('\n');
        const targetTitle = String(currentTitle || '').slice(0, 180);
        const targetExcerpt = String(currentText || '').replace(/\s+/g, ' ').trim().slice(0, 400);

        const rankingPrompt = `You are a context retrieval system.
        Target:
        - Title: "${targetTitle}"
        - Excerpt: "${targetExcerpt}"
        
        Candidate Items:
        ${listSnippet}
        
        Task: Select the 5 most relevant items to the Target Topic.
        Output: Return ONLY the indices of the selected items as a JSON array (e.g. [0, 4, 12]).`;

        try {
            const response = await SP.callLLMAPI("Context Selector", [{ role: 'user', parts: [{ text: rankingPrompt }] }], {
                priority: 'vip',
                generationConfig: { temperature: 0.1, maxOutputTokens: 64, response_mime_type: "application/json" }
            });

            const text = response || '[]';
            const jsonMatch = text.match(/\[.*\]/s);
            const raw = jsonMatch ? jsonMatch[0] : '[]';
            const parsed = JSON.parse(raw);
            const indices = Array.isArray(parsed) ? parsed : [];

            if (indices.length > 0) {
                const selected = [];
                const seen = new Set();
                for (const value of indices) {
                    const idx = Number(value);
                    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length) continue;
                    if (seen.has(idx)) continue;
                    seen.add(idx);
                    selected.push(candidates[idx]);
                    if (selected.length >= 5) break;
                }
                if (selected.length > 0) return selected;
            }
        } catch (e) {
            console.warn('[Deep Angle] Re-ranking failed, using recent.', e);
        }

        return candidates.slice(0, 5);
    }

    async function generateDeepAngle() {
        const pageContext = SP.pageContext;
        if (!pageContext?.url) {
            showToast(getMessage('sp_page_read_failed', 'Failed to read page'), 'error');
            return;
        }

        if (isGeneratingDeepAngle) return;

        const llmConfig = await (SP.getLLMProvider ? SP.getLLMProvider() : Promise.resolve({ provider: 'google' }));
        const geminiKey = await (SP.getApiKey ? SP.getApiKey() : Promise.resolve(null));
        const hasProviderKey = llmConfig.provider === 'openrouter'
            ? !!llmConfig.openrouterKey
            : !!geminiKey;
        if (!hasProviderKey) {
            showToast(getMessage('sp_error_no_api_key', 'AI Access Key not set'), 'error');
            return;
        }

        isGeneratingDeepAngle = true;
        setDeepAngleLoading(true);

        try {
            const threads = SP.threads || [];
            const elements = SP.elements || {};
            const currentUrl = pageContext.url;
            const currentUrlKey = normalizeUrl(currentUrl || '');

            const currentThreads = threads.filter(t => {
                return normalizeUrl(t.highlight?.url || '') === currentUrlKey;
            });

            const candidates = threads
                .filter(t => {
                    return normalizeUrl(t.highlight?.url || '') !== currentUrlKey;
                })
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 30);

            let relatedThreads = [];
            if (candidates.length > 0) {
                const analyzing = getMessage('sp_deep_angle_analyzing', 'Looking for a fresh angle...');
                showToast(analyzing, 'info');
                if (elements.deepAngleStatus) {
                    elements.deepAngleStatus.style.display = 'block';
                    elements.deepAngleStatus.textContent = analyzing;
                }
                relatedThreads = await selectRelevantThreads(pageContext.title, pageContext.content?.slice(0, 500), candidates);
            }

            const highlightContext = currentThreads.map(t => `- "${t.highlight?.text?.slice(0, 200)}"`).join('\n');
            const relatedContext = relatedThreads.map(t => `- [${t.highlight?.title}]: "${t.highlight?.text?.slice(0, 150)}"`).join('\n');
            const pageExcerpt = (pageContext?.content || '').slice(0, 5000);

            const systemPrompt = `You are a profound system thinker. Your goal is to find hidden structures, counter-intuitive insights, or "deep angles" that average readers miss. Language: ${navigator.language.startsWith('vi') ? 'Vietnamese' : 'English'}`;

            const userPrompt = `Analyze this content and provide ONE "Deep Angle" insight.

            CONTEXT:
            Title: ${pageContext.title}
            
            ${highlightContext ? `USER HIGHLIGHTS (Current Page):\n${highlightContext}\n` : ''}
            
            ${relatedContext ? `CONNECTED KNOWLEDGE (From your history):\n${relatedContext}\n` : ''}
            
            PAGE EXCERPT:
            """${pageExcerpt}"""

            Task:
            1. Identify a systems-level connection, a hidden incentive, or a counter-intuitive truth.
            2. SYNTHESIZE the "Connected Knowledge" to find patterns across articles.
            3. Write a single, powerful paragraph (approx 60-80 words).
            4. Tone: Intellectual, sharp, profound.`;

            const response = await SP.callLLMAPI(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], {
                priority: 'vip',
                generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
            });

            const deepAngle = (response || '').trim();

            if (deepAngle) {
                deepAngleByUrl.set(currentUrlKey, { text: deepAngle, generatedAt: Date.now() });
                recordSmartLinkMetric('deep_angle_generated_count', 1);
                updateDeepAngleUI();
                elements.deepAngleOutput?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                showToast(getMessage('sp_error_empty_response', 'No response received'), 'warning');
            }

        } catch (e) {
            console.error('Deep Angle Error:', e);
            showToast(getMessage('sp_deep_angle_error', "Couldn't generate a new angle."), 'error');
        } finally {
            setDeepAngleLoading(false);
            updateDeepAngleUI();
            isGeneratingDeepAngle = false;
        }
    }

    // ── Expose API on SP ──
    SP.recordSmartLinkMetric = recordSmartLinkMetric;
    SP.updateDeepAngleUI = updateDeepAngleUI;
    SP.setDeepAngleLoading = setDeepAngleLoading;
    SP.generateDeepAngleFromConnections = generateDeepAngleFromConnections;
    SP.analyzeConnections = analyzeConnections;
    SP.handleConnectionAction = handleConnectionAction;
    SP.renderConnectionsList = renderConnectionsList;
    SP.generateDeepAngle = generateDeepAngle;
    SP.deepAngleByUrl = deepAngleByUrl;

    console.log('[SP:SmartLink] Module loaded');
})();
