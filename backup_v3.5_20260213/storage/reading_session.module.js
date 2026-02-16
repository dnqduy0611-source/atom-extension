/**
 * ReadingSessionService - Unified storage for Reading Cards and Threads
 * Version: 2.7.0
 *
 * This service unifies:
 * - Reading Cards (from context menu: Summary/Critique/Quiz)
 * - Threads (from sidepanel chat)
 *
 * Both now share a single ReadingSession object per page.
 */

const SESSIONS_KEY = 'atom_reading_sessions_v3';

class ReadingSessionService {

    /**
     * Get or create session for current page
     * @param {string} url - Page URL
     * @param {string} title - Page title
     * @param {string} domain - Page domain
     * @returns {Promise<Object>} Session object
     */
    static async getOrCreateSession(url, title, domain) {
        const sessions = await this.getAllSessions();

        // Find existing session for this URL (within 24 hours)
        const existing = sessions.find(s =>
            s.url === url &&
            Date.now() - s.createdAt < 24 * 60 * 60 * 1000
        );

        if (existing) {
            console.log('[ReadingSession] Found existing session:', existing.id);
            return existing;
        }

        // Create new session
        const newSession = {
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url,
            title,
            domain,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            highlights: [],
            card: null,
            thread: null,
            insights: [],
            connections: [],
            exportedToNLM: false,
            // Phase 2 ready: Metrics for comprehension scoring
            metrics: {
                readingMetrics: {
                    timeSpent: 0,
                    scrollDepth: 0,
                    highlightCount: 0,
                    highlightDensity: 0
                },
                interactionMetrics: {
                    questionsAsked: 0,
                    bloomLevelReached: 1,
                    insightsCreated: 0
                },
                assessmentMetrics: {
                    quizScore: null,
                    teachBackScore: null,
                    recallAccuracy: null
                }
            },
            // Learning objective from Phase 1
            learningObjective: null,
            // Focus session from timer integration
            focusSession: null
        };

        sessions.push(newSession);
        await this.saveSessions(sessions);

        console.log('[ReadingSession] Created new session:', newSession.id);
        return newSession;
    }

    /**
     * Get session by ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object|null>} Session or null
     */
    static async getSession(sessionId) {
        const sessions = await this.getAllSessions();
        return sessions.find(s => s.id === sessionId) || null;
    }

    /**
     * Update session with a patch object
     * @param {string} sessionId - Session ID
     * @param {Object} patch - Partial session fields to update
     * @returns {Promise<Object>} Updated session
     */
    static async updateSession(sessionId, patch) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        Object.assign(session, patch || {});
        session.updatedAt = Date.now();

        await this.saveSessions(sessions);
        return session;
    }

    /**
     * Add highlight to session
     * @param {string} sessionId - Session ID
     * @param {Object} highlight - Highlight data
     * @returns {Promise<Object>} Updated session
     */
    static async addHighlight(sessionId, highlight) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        // Check for duplicate (same text)
        const isDuplicate = session.highlights.some(h =>
            h.text === highlight.text
        );

        if (!isDuplicate) {
            session.highlights.push({
                id: `hl_${Date.now()}`,
                ...highlight,
                createdAt: Date.now()
            });
            session.updatedAt = Date.now();
            await this.saveSessions(sessions);
            console.log('[ReadingSession] Added highlight to session:', sessionId);
        }

        return session;
    }

    /**
     * Update card data (from context menu actions)
     * @param {string} sessionId - Session ID
     * @param {Object} cardData - Card data (mode, keyPoints, questions, etc.)
     * @returns {Promise<Object>} Updated session
     */
    static async updateCard(sessionId, cardData) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        session.card = {
            ...session.card,
            ...cardData,
            updatedAt: Date.now()
        };
        session.updatedAt = Date.now();

        await this.saveSessions(sessions);
        console.log('[ReadingSession] Updated card for session:', sessionId);
        return session;
    }

    /**
     * Update thread data (from sidepanel chat)
     * @param {string} sessionId - Session ID
     * @param {Object} threadData - Thread data (messages, status, etc.)
     * @returns {Promise<Object>} Updated session
     */
    static async updateThread(sessionId, threadData) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        session.thread = {
            ...session.thread,
            ...threadData,
            updatedAt: Date.now()
        };
        session.updatedAt = Date.now();

        await this.saveSessions(sessions);
        console.log('[ReadingSession] Updated thread for session:', sessionId);
        return session;
    }

    /**
     * Add insight (can come from card, thread, or user)
     * @param {string} sessionId - Session ID
     * @param {string} insightText - Insight text
     * @param {string} source - Source: 'card' | 'thread' | 'user'
     * @returns {Promise<Object>} Updated session
     */
    static async addInsight(sessionId, insightText, source) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        session.insights.push({
            id: `insight_${Date.now()}`,
            text: insightText,
            source,
            createdAt: Date.now()
        });
        session.updatedAt = Date.now();

        await this.saveSessions(sessions);
        console.log('[ReadingSession] Added insight to session:', sessionId, 'from', source);
        return session;
    }

    /**
     * Sync insight to another component
     * @param {string} sessionId - Session ID
     * @param {string} insightId - Insight ID
     * @param {string} targetComponent - Target: 'card' | 'thread'
     * @returns {Promise<Object>} Updated session
     */
    static async syncInsight(sessionId, insightId, targetComponent) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        const insight = session.insights.find(i => i.id === insightId);
        if (!insight) throw new Error('Insight not found: ' + insightId);

        // Mark as synced to other component
        insight.syncedTo = insight.syncedTo || [];
        if (!insight.syncedTo.includes(targetComponent)) {
            insight.syncedTo.push(targetComponent);
        }

        await this.saveSessions(sessions);
        return session;
    }

    /**
     * Add connection between sessions
     * @param {string} sessionId - Session ID
     * @param {string} targetSessionId - Target session ID
     * @param {string} type - Connection type: 'supports' | 'contradicts' | 'extends'
     * @param {number} confidence - Confidence score (0-1)
     * @returns {Promise<Object>} Updated session
     */
    static async addConnection(sessionId, targetSessionId, type, confidence = 0.5) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        // Check for duplicate connection
        const exists = session.connections.some(c =>
            c.targetSessionId === targetSessionId && c.type === type
        );

        if (!exists) {
            session.connections.push({
                targetSessionId,
                type,
                confidence,
                createdAt: Date.now()
            });
            session.updatedAt = Date.now();
            await this.saveSessions(sessions);
        }

        return session;
    }

    /**
     * Mark session as exported to NotebookLM
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Updated session
     */
    static async markExported(sessionId) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        session.exportedToNLM = true;
        session.exportedAt = Date.now();
        session.updatedAt = Date.now();

        await this.saveSessions(sessions);
        return session;
    }

    /**
     * Update metrics for a session (Phase 2 ready)
     * @param {string} sessionId - Session ID
     * @param {Object} metricsUpdate - Partial metrics to merge
     * @returns {Promise<Object>} Updated session
     */
    static async updateMetrics(sessionId, metricsUpdate) {
        const sessions = await this.getAllSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) throw new Error('Session not found: ' + sessionId);

        // Initialize metrics if missing (for older sessions)
        if (!session.metrics) {
            session.metrics = {
                readingMetrics: { timeSpent: 0, scrollDepth: 0, highlightCount: 0, highlightDensity: 0 },
                interactionMetrics: { questionsAsked: 0, bloomLevelReached: 1, insightsCreated: 0 },
                assessmentMetrics: { quizScore: null, teachBackScore: null, recallAccuracy: null }
            };
        }

        // Deep merge metrics
        if (metricsUpdate.readingMetrics) {
            Object.assign(session.metrics.readingMetrics, metricsUpdate.readingMetrics);
        }
        if (metricsUpdate.interactionMetrics) {
            Object.assign(session.metrics.interactionMetrics, metricsUpdate.interactionMetrics);
        }
        if (metricsUpdate.assessmentMetrics) {
            Object.assign(session.metrics.assessmentMetrics, metricsUpdate.assessmentMetrics);
        }

        // Auto-update derived metrics
        session.metrics.readingMetrics.highlightCount = session.highlights?.length || 0;
        session.metrics.interactionMetrics.insightsCreated = session.insights?.length || 0;

        session.updatedAt = Date.now();
        await this.saveSessions(sessions);

        console.log('[ReadingSession] Updated metrics for session:', sessionId);
        return session;
    }

    /**
     * Get all sessions
     * @returns {Promise<Array>} All sessions
     */
    static async getAllSessions() {
        const data = await chrome.storage.local.get([SESSIONS_KEY]);
        return data[SESSIONS_KEY] || [];
    }

    /**
     * Get sessions for a specific domain
     * @param {string} domain - Domain to filter by
     * @returns {Promise<Array>} Sessions for domain
     */
    static async getSessionsByDomain(domain) {
        const sessions = await this.getAllSessions();
        return sessions.filter(s => s.domain === domain);
    }

    /**
     * Get recent sessions
     * @param {number} limit - Max sessions to return
     * @returns {Promise<Array>} Recent sessions
     */
    static async getRecentSessions(limit = 20) {
        const sessions = await this.getAllSessions();
        return sessions
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, limit);
    }

    /**
     * Delete session
     * @param {string} sessionId - Session ID
     * @returns {Promise<boolean>} Success
     */
    static async deleteSession(sessionId) {
        const sessions = await this.getAllSessions();
        const index = sessions.findIndex(s => s.id === sessionId);

        if (index === -1) return false;

        sessions.splice(index, 1);
        await this.saveSessions(sessions);
        return true;
    }

    /**
     * Save sessions to storage
     * @param {Array} sessions - Sessions to save
     */
    static async saveSessions(sessions) {
        await chrome.storage.local.set({ [SESSIONS_KEY]: sessions });
    }

    /**
     * Migrate v2 sessions to v3 (add metrics field)
     * Should be called on extension update
     */
    static async migrateV2ToV3() {
        const OLD_KEY = 'atom_reading_sessions_v2';
        const { atom_migration_v3 } = await chrome.storage.local.get(['atom_migration_v3']);

        if (atom_migration_v3) {
            console.log('[Migration] Already migrated to v3');
            return { migrated: false, reason: 'already_done' };
        }

        // Check if v2 data exists
        const v2Data = await chrome.storage.local.get([OLD_KEY]);
        const v2Sessions = v2Data[OLD_KEY] || [];

        if (v2Sessions.length === 0) {
            console.log('[Migration] No v2 sessions to migrate');
            await chrome.storage.local.set({ atom_migration_v3: true });
            return { migrated: false, reason: 'no_data' };
        }

        console.log(`[Migration] Migrating ${v2Sessions.length} sessions from v2 to v3...`);

        // Add metrics field to each session
        const v3Sessions = v2Sessions.map(session => ({
            ...session,
            metrics: session.metrics || {
                readingMetrics: {
                    timeSpent: 0,
                    scrollDepth: 0,
                    highlightCount: session.highlights?.length || 0,
                    highlightDensity: 0
                },
                interactionMetrics: {
                    questionsAsked: 0,
                    bloomLevelReached: 1,
                    insightsCreated: session.insights?.length || 0
                },
                assessmentMetrics: {
                    quizScore: null,
                    teachBackScore: null,
                    recallAccuracy: null
                }
            },
            learningObjective: session.learningObjective || null,
            focusSession: session.focusSession || null
        }));

        // Save to new key and mark as migrated
        await chrome.storage.local.set({
            [SESSIONS_KEY]: v3Sessions,
            atom_migration_v3: true,
            atom_migration_v3_date: Date.now()
        });

        console.log(`[Migration] Successfully migrated ${v3Sessions.length} sessions to v3`);
        return { migrated: true, sessions: v3Sessions.length };
    }

    /**
     * Migrate old data from atom_reading_threads and atom_reading_cards
     * Should be called once on extension update
     */
    static async migrateOldData() {
        // First, try v2 to v3 migration
        await this.migrateV2ToV3();

        // Check if already migrated
        const { atom_migration_v27 } = await chrome.storage.local.get(['atom_migration_v27']);
        if (atom_migration_v27) {
            console.log('[Migration] Already migrated to v2.7');
            return { migrated: false, reason: 'already_done' };
        }

        console.log('[Migration] Starting v2.7 migration...');

        // Get old data
        const { atom_reading_threads, atom_reading_cards } = await chrome.storage.local.get([
            'atom_reading_threads',
            'atom_reading_cards'
        ]);

        const oldThreads = atom_reading_threads || [];
        const oldCards = atom_reading_cards || [];

        console.log(`[Migration] Found ${oldThreads.length} threads and ${oldCards.length} cards`);

        // Map to track sessions by URL
        const sessionsByUrl = new Map();

        // Migrate threads
        for (const thread of oldThreads) {
            const url = thread.highlight?.url || '';

            // Get or create session for this URL
            let session = sessionsByUrl.get(url);
            if (!session) {
                session = {
                    id: `migrated_${thread.id}`,
                    url,
                    title: thread.highlight?.title || '',
                    domain: thread.highlight?.domain || '',
                    createdAt: thread.createdAt,
                    updatedAt: Date.now(),
                    highlights: [],
                    card: null,
                    thread: null,
                    insights: [],
                    connections: [],
                    exportedToNLM: thread.nlmExported || false
                };
                sessionsByUrl.set(url, session);
            }

            // Add highlight
            if (thread.highlight?.text) {
                session.highlights.push({
                    id: `hl_${thread.id}`,
                    text: thread.highlight.text,
                    context: thread.highlight.context,
                    createdAt: thread.createdAt
                });
            }

            // Add thread data
            session.thread = {
                messages: thread.messages || [],
                status: thread.status || 'active'
            };

            // Add insight
            if (thread.refinedInsight) {
                session.insights.push({
                    id: `insight_${thread.id}`,
                    text: thread.refinedInsight,
                    source: 'thread',
                    createdAt: thread.createdAt
                });
            }
        }

        // Migrate cards (merge into existing sessions if same URL)
        for (const card of oldCards) {
            const url = card.url || '';

            let session = sessionsByUrl.get(url);
            if (!session) {
                session = {
                    id: `migrated_card_${card.id || Date.now()}`,
                    url,
                    title: card.title || '',
                    domain: new URL(url).hostname || '',
                    createdAt: card.createdAt || Date.now(),
                    updatedAt: Date.now(),
                    highlights: [],
                    card: null,
                    thread: null,
                    insights: [],
                    connections: [],
                    exportedToNLM: false
                };
                sessionsByUrl.set(url, session);
            }

            // Add card data
            session.card = {
                mode: card.mode || 'summary',
                keyPoints: card.keyPoints || [],
                questions: card.questions || [],
                overallScore: card.overallScore
            };

            // Add key points as insights
            if (card.keyPoints?.length) {
                for (const point of card.keyPoints) {
                    session.insights.push({
                        id: `insight_card_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        text: point,
                        source: 'card',
                        createdAt: card.createdAt || Date.now()
                    });
                }
            }
        }

        // Convert map to array
        const sessions = Array.from(sessionsByUrl.values());

        // Save migrated data
        await chrome.storage.local.set({
            [SESSIONS_KEY]: sessions,
            atom_migration_v27: true,
            atom_migration_v27_date: Date.now()
        });

        console.log(`[Migration] Migrated ${sessions.length} sessions successfully`);

        return {
            migrated: true,
            sessions: sessions.length,
            threads: oldThreads.length,
            cards: oldCards.length
        };
    }
}

// ES module export for background.js
export { ReadingSessionService };
