// services/connection_detector.js
// Auto-detect relationships between sessions

(function () {
    'use strict';

    const CONNECTION_TYPES = {
        SUPPORTS: {
            id: 'supports',
            label: 'Supports',
            icon: '✅',
            color: '#10B981',
            description: 'Provides evidence for'
        },
        CONTRADICTS: {
            id: 'contradicts',
            label: 'Contradicts',
            icon: '⚠️',
            color: '#EF4444',
            description: 'Conflicts with'
        },
        EXTENDS: {
            id: 'extends',
            label: 'Extends',
            icon: '➕',
            color: '#3B82F6',
            description: 'Builds upon'
        },
        SIMILAR: {
            id: 'similar',
            label: 'Similar',
            icon: '🔄',
            color: '#8B5CF6',
            description: 'Covers similar topics'
        },
        APPLIES: {
            id: 'applies',
            label: 'Applies',
            icon: '🔧',
            color: '#F59E0B',
            description: 'Practical application of'
        }
    };

    const CONNECTION_STORAGE_KEY = 'atom_connections_v1';

    function safeJsonParse(responseText) {
        if (!responseText || typeof responseText !== 'string') return null;
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }

    /**
     * Analyzes the relationship type between two sessions.
     */
    async function analyzeRelationship(session1, session2, apiKey, callGeminiAPI) {
        const insights1 = Array.isArray(session1?.insights)
            ? session1.insights.map(i => i?.text || '').filter(Boolean).join('\n')
            : '';
        const insights2 = Array.isArray(session2?.insights)
            ? session2.insights.map(i => i?.text || '').filter(Boolean).join('\n')
            : '';

        if (!insights1 || !insights2 || !apiKey || typeof callGeminiAPI !== 'function') {
            return { type: 'similar', confidence: 0.6, explanation: 'Related topics' };
        }

        const prompt = [
            'Compare these two sets of reading notes and determine their relationship:',
            '',
            `Session A: "${session1.title || 'Untitled'}"`,
            `Notes: ${insights1.slice(0, 500)}`,
            '',
            `Session B: "${session2.title || 'Untitled'}"`,
            `Notes: ${insights2.slice(0, 500)}`,
            '',
            'Determine the relationship type:',
            '- SUPPORTS: A provides evidence or validation for B',
            '- CONTRADICTS: A disagrees or conflicts with B',
            '- EXTENDS: A builds upon or elaborates B',
            '- SIMILAR: A and B cover similar topics without specific relationship',
            '- APPLIES: A is a practical application of concepts in B',
            '',
            'Return JSON:',
            '{',
            '  "type": "supports|contradicts|extends|similar|applies",',
            '  "confidence": 0.0-1.0,',
            '  "explanation": "Brief explanation of the relationship"',
            '}'
        ].join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = [{ role: 'user', parts: [{ text: prompt }] }];
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);

            if (parsed && parsed.type && Number.isFinite(parsed.confidence)) {
                return {
                    type: parsed.type.toLowerCase(),
                    confidence: Math.min(1, Math.max(0, parsed.confidence)),
                    explanation: parsed.explanation || 'Related topics'
                };
            }

            return { type: 'similar', confidence: 0.5, explanation: 'Related topics' };

        } catch (err) {
            console.error('[ConnectionDetector] analyzeRelationship failed:', err);
            return { type: 'similar', confidence: 0.5, explanation: 'Related topics' };
        }
    }

    /**
     * Saves connections to storage.
     */
    async function saveConnections(newConnections) {
        if (!Array.isArray(newConnections) || newConnections.length === 0) {
            return;
        }

        return new Promise(resolve => {
            chrome.storage.local.get([CONNECTION_STORAGE_KEY], (result) => {
                const existing = result[CONNECTION_STORAGE_KEY] || [];

                // Avoid duplicates
                const unique = newConnections.filter(nc =>
                    !existing.some(ec =>
                        ec.sourceId === nc.sourceId && ec.targetId === nc.targetId
                    )
                );

                const combined = [...existing, ...unique];

                // Keep last 500 connections
                const trimmed = combined.slice(-500);

                chrome.storage.local.set({ [CONNECTION_STORAGE_KEY]: trimmed }, resolve);
            });
        });
    }

    /**
     * Detects connections for a session.
     * @param {string} sessionId - Session to find connections for
     * @param {string} apiKey - API key
     * @param {Function} callGeminiAPI - API call function
     * @returns {Promise<Array>} Detected connections
     */
    async function detectConnections(sessionId, apiKey, callGeminiAPI) {
        if (!sessionId || !window.SemanticSearchService || !window.ReadingSessionService) {
            return [];
        }

        try {
            // Find semantically similar sessions
            const related = await window.SemanticSearchService.findRelatedToSession(sessionId, 10);

            if (related.length === 0) {
                return [];
            }

            const session = await window.ReadingSessionService.getSessionById(sessionId);
            if (!session) {
                return [];
            }

            const connections = [];

            for (const candidate of related) {
                // Skip low similarity
                if (candidate.similarity < 0.6) continue;

                // Get full session data
                const candidateSession = await window.ReadingSessionService.getSessionById(candidate.sessionId);
                if (!candidateSession) continue;

                // Analyze relationship
                const relationship = await analyzeRelationship(session, candidateSession, apiKey, callGeminiAPI);

                if (relationship && relationship.confidence > 0.7) {
                    connections.push({
                        id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        sourceId: sessionId,
                        targetId: candidate.sessionId,
                        type: relationship.type,
                        confidence: relationship.confidence,
                        explanation: relationship.explanation,
                        similarity: candidate.similarity,
                        createdAt: Date.now(),
                        createdBy: 'auto'
                    });
                }
            }

            // Save connections
            await saveConnections(connections);

            return connections;

        } catch (err) {
            console.error('[ConnectionDetector] detectConnections failed:', err);
            return [];
        }
    }

    /**
     * Gets all connections for a session.
     */
    async function getConnectionsForSession(sessionId) {
        if (!sessionId) return [];

        return new Promise(resolve => {
            chrome.storage.local.get([CONNECTION_STORAGE_KEY], (result) => {
                const connections = result[CONNECTION_STORAGE_KEY] || [];
                const relevant = connections.filter(c =>
                    c.sourceId === sessionId || c.targetId === sessionId
                );
                resolve(relevant);
            });
        });
    }

    /**
     * Gets all connections.
     */
    async function getAllConnections() {
        return new Promise(resolve => {
            chrome.storage.local.get([CONNECTION_STORAGE_KEY], (result) => {
                resolve(result[CONNECTION_STORAGE_KEY] || []);
            });
        });
    }

    /**
     * Manually adds a connection.
     */
    async function addManualConnection(sourceId, targetId, type, explanation) {
        if (!sourceId || !targetId || !type) {
            return null;
        }

        const connection = {
            id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sourceId,
            targetId,
            type: type.toLowerCase(),
            confidence: 1.0, // Manual = confident
            explanation: explanation || '',
            createdAt: Date.now(),
            createdBy: 'user'
        };

        await saveConnections([connection]);
        return connection;
    }

    /**
     * Deletes a connection.
     */
    async function deleteConnection(connectionId) {
        if (!connectionId) return;

        return new Promise(resolve => {
            chrome.storage.local.get([CONNECTION_STORAGE_KEY], (result) => {
                const connections = result[CONNECTION_STORAGE_KEY] || [];
                const filtered = connections.filter(c => c.id !== connectionId);
                chrome.storage.local.set({ [CONNECTION_STORAGE_KEY]: filtered }, resolve);
            });
        });
    }

    /**
     * Gets connection statistics.
     */
    async function getConnectionStats() {
        const connections = await getAllConnections();

        const byType = {};
        Object.keys(CONNECTION_TYPES).forEach(type => {
            byType[type.toLowerCase()] = 0;
        });

        connections.forEach(c => {
            const type = (c.type || 'similar').toLowerCase();
            if (byType[type] !== undefined) {
                byType[type]++;
            }
        });

        return {
            total: connections.length,
            byType,
            autoDetected: connections.filter(c => c.createdBy === 'auto').length,
            manual: connections.filter(c => c.createdBy === 'user').length
        };
    }

    window.ConnectionDetectorService = {
        CONNECTION_TYPES,
        detectConnections,
        getConnectionsForSession,
        getAllConnections,
        addManualConnection,
        deleteConnection,
        getConnectionStats
    };
})();
