# Phase 3: Semantic Brain - Implementation Spec

**Version:** 1.0
**Duration:** 4-6 weeks
**Priority:** MEDIUM
**Dependencies:** Phase 2 complete

---

## Overview

Phase 3 implements the "Semantic Brain" - enabling ATOM to understand relationships between reading sessions, surface related past knowledge, and visualize the user's growing knowledge network through vector embeddings and semantic search.

---

## Task 3.1: Embedding Service

### Objective
Generate and store vector embeddings for reading sessions to enable semantic similarity search.

### Implementation Steps

#### Step 1: Create Embedding Service

**File:** `services/embedding_service.js` (NEW)

```javascript
/**
 * Embedding Service
 * Generates and manages vector embeddings using Gemini API.
 */

const EMBEDDING_CONFIG = {
  model: 'text-embedding-004',
  dimension: 768,
  maxTextLength: 10000,  // Chars
  cacheSize: 100         // Max cached embeddings
};

// In-memory cache for session embeddings
const embeddingCache = new Map();

/**
 * Generates embedding for text using Gemini API.
 * @param {string} text - Text to embed
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text, apiKey) {
  // Truncate if too long
  const truncatedText = text.slice(0, EMBEDDING_CONFIG.maxTextLength);

  // Check cache first
  const cacheKey = hashText(truncatedText);
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_CONFIG.model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ text: truncatedText }]
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.embedding.values;

    // Cache the result
    if (embeddingCache.size >= EMBEDDING_CONFIG.cacheSize) {
      // Remove oldest entry
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(cacheKey, embedding);

    return embedding;

  } catch (err) {
    console.error('[Embedding] Generation failed:', err);
    throw err;
  }
}

/**
 * Generates embedding for a reading session.
 * Combines title, highlights, and insights into single embedding.
 * @param {Object} session - ReadingSession object
 * @param {string} apiKey - API key
 * @returns {Promise<number[]>}
 */
async function embedSession(session, apiKey) {
  // Combine session content for embedding
  const contentParts = [
    session.title,
    ...session.highlights.map(h => h.text),
    ...session.insights.map(i => i.text)
  ];

  const combinedText = contentParts.filter(Boolean).join('\n\n');

  if (!combinedText.trim()) {
    throw new Error('Session has no content to embed');
  }

  return await generateEmbedding(combinedText, apiKey);
}

/**
 * Calculates cosine similarity between two vectors.
 * @param {number[]} a - First vector
 * @param {number[]} b - Second vector
 * @returns {number} Similarity score (-1 to 1)
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Finds top-K most similar embeddings.
 * @param {number[]} queryEmbedding - Query vector
 * @param {Array<{id: string, embedding: number[]}>} candidates - Candidate embeddings
 * @param {number} topK - Number of results
 * @returns {Array<{id: string, similarity: number}>}
 */
function findTopKSimilar(queryEmbedding, candidates, topK = 5) {
  const similarities = candidates.map(candidate => ({
    id: candidate.id,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding)
  }));

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Simple hash function for cache keys.
 */
function hashText(text) {
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 1000); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export {
  EMBEDDING_CONFIG,
  generateEmbedding,
  embedSession,
  cosineSimilarity,
  findTopKSimilar
};
```

#### Step 2: Create Vector Storage (IndexedDB)

**File:** `storage/vector_store.js` (NEW)

```javascript
/**
 * Vector Store
 * Stores embeddings in IndexedDB for persistence.
 */

const DB_NAME = 'atom_vectors';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';

let dbInstance = null;

/**
 * Opens/creates the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
async function openDatabase() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create embeddings store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('domain', 'domain', { unique: false });
      }
    };
  });
}

/**
 * Stores an embedding for a session.
 * @param {string} sessionId - Session ID
 * @param {number[]} embedding - Vector embedding
 * @param {Object} metadata - Additional metadata
 */
async function storeEmbedding(sessionId, embedding, metadata = {}) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      sessionId,
      embedding,
      timestamp: Date.now(),
      ...metadata
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets an embedding by session ID.
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
async function getEmbedding(sessionId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets all embeddings.
 * @returns {Promise<Array>}
 */
async function getAllEmbeddings() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Deletes an embedding.
 * @param {string} sessionId
 */
async function deleteEmbedding(sessionId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(sessionId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets embeddings by domain.
 * @param {string} domain
 * @returns {Promise<Array>}
 */
async function getEmbeddingsByDomain(domain) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('domain');

    const request = index.getAll(domain);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets count of stored embeddings.
 * @returns {Promise<number>}
 */
async function getEmbeddingCount() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears all embeddings (for testing/reset).
 */
async function clearAllEmbeddings() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export {
  openDatabase,
  storeEmbedding,
  getEmbedding,
  getAllEmbeddings,
  deleteEmbedding,
  getEmbeddingsByDomain,
  getEmbeddingCount,
  clearAllEmbeddings
};
```

#### Step 3: Auto-embed Sessions on Save

**File:** `storage/reading_session.js` (UPDATE)

```javascript
import * as EmbeddingService from '../services/embedding_service.js';
import * as VectorStore from './vector_store.js';

/**
 * Saves session AND generates embedding if content changed.
 */
async function saveSession(session, options = { generateEmbedding: true }) {
  // Existing save logic...
  const sessions = await getAllSessions();
  const index = sessions.findIndex(s => s.id === session.id);

  session.updatedAt = Date.now();

  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }

  await new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: sessions }, resolve);
  });

  // Generate embedding if enabled and session has content
  if (options.generateEmbedding && shouldEmbed(session)) {
    try {
      const apiKey = await getApiKey();
      const embedding = await EmbeddingService.embedSession(session, apiKey);

      await VectorStore.storeEmbedding(session.id, embedding, {
        title: session.title,
        domain: session.domain,
        url: session.url,
        highlightCount: session.highlights.length,
        insightCount: session.insights.length
      });

      session.embeddedAt = Date.now();
      console.log(`[Embedding] Session ${session.id} embedded`);

    } catch (err) {
      console.error('[Embedding] Auto-embed failed:', err);
      // Don't fail the save, just skip embedding
    }
  }
}

/**
 * Determines if session should be embedded.
 */
function shouldEmbed(session) {
  // Need at least 1 highlight or insight
  if (session.highlights.length === 0 && session.insights.length === 0) {
    return false;
  }

  // Skip if recently embedded (within 1 hour)
  if (session.embeddedAt && Date.now() - session.embeddedAt < 60 * 60 * 1000) {
    return false;
  }

  return true;
}
```

### Success Criteria
- [ ] Embeddings generated via Gemini API
- [ ] Stored in IndexedDB for persistence
- [ ] Cosine similarity calculation works
- [ ] Auto-embedding on session save
- [ ] Caching prevents redundant API calls

---

## Task 3.2: Semantic Search

### Objective
Find related notes by meaning, not just keywords.

### Implementation

**File:** `services/semantic_search.js` (NEW)

```javascript
/**
 * Semantic Search Service
 * Finds related content using vector similarity.
 */

import * as EmbeddingService from './embedding_service.js';
import * as VectorStore from '../storage/vector_store.js';
import * as SessionService from '../storage/reading_session.js';

const SEARCH_CONFIG = {
  minSimilarity: 0.6,    // Minimum similarity to consider related
  topK: 5,               // Default number of results
  excludeSameSession: true
};

/**
 * Finds sessions related to a query text.
 * @param {string} queryText - Text to find related content for
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Related sessions with similarity scores
 */
async function findRelated(queryText, options = {}) {
  const {
    topK = SEARCH_CONFIG.topK,
    minSimilarity = SEARCH_CONFIG.minSimilarity,
    excludeSessionId = null
  } = options;

  const apiKey = await getApiKey();

  // Generate query embedding
  const queryEmbedding = await EmbeddingService.generateEmbedding(queryText, apiKey);

  // Get all stored embeddings
  const allEmbeddings = await VectorStore.getAllEmbeddings();

  // Filter out excluded session
  const candidates = excludeSessionId
    ? allEmbeddings.filter(e => e.sessionId !== excludeSessionId)
    : allEmbeddings;

  if (candidates.length === 0) {
    return [];
  }

  // Find similar
  const similar = EmbeddingService.findTopKSimilar(queryEmbedding, candidates, topK);

  // Filter by minimum similarity
  const filtered = similar.filter(s => s.similarity >= minSimilarity);

  // Enrich with session data
  const results = await Promise.all(
    filtered.map(async (item) => {
      const session = await SessionService.getSessionById(item.id);
      const embeddingData = candidates.find(c => c.sessionId === item.id);

      return {
        sessionId: item.id,
        similarity: Math.round(item.similarity * 100) / 100,
        title: session?.title || embeddingData?.title || 'Unknown',
        url: session?.url || embeddingData?.url,
        domain: embeddingData?.domain,
        highlightCount: session?.highlights?.length || 0,
        insightCount: session?.insights?.length || 0,
        preview: getSessionPreview(session),
        createdAt: session?.createdAt
      };
    })
  );

  return results;
}

/**
 * Finds sessions related to a specific session.
 * @param {string} sessionId - Source session ID
 * @param {number} topK - Number of results
 * @returns {Promise<Array>}
 */
async function findRelatedToSession(sessionId, topK = 5) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Combine session content for query
  const queryText = [
    session.title,
    ...session.highlights.slice(0, 5).map(h => h.text),
    ...session.insights.slice(0, 3).map(i => i.text)
  ].join('\n');

  return findRelated(queryText, {
    topK,
    excludeSessionId: sessionId
  });
}

/**
 * Finds sessions related to current page content.
 * @param {Object} pageContext - Page context from content.js
 * @param {number} topK - Number of results
 * @returns {Promise<Array>}
 */
async function findRelatedToPage(pageContext, topK = 5) {
  // Use title and first part of content
  const queryText = [
    pageContext.title,
    pageContext.content?.slice(0, 2000) || ''
  ].join('\n');

  return findRelated(queryText, { topK });
}

/**
 * Searches within a specific domain.
 * @param {string} queryText
 * @param {string} domain
 * @param {number} topK
 */
async function searchWithinDomain(queryText, domain, topK = 5) {
  const apiKey = await getApiKey();
  const queryEmbedding = await EmbeddingService.generateEmbedding(queryText, apiKey);

  // Get embeddings for domain only
  const domainEmbeddings = await VectorStore.getEmbeddingsByDomain(domain);

  if (domainEmbeddings.length === 0) {
    return [];
  }

  const similar = EmbeddingService.findTopKSimilar(queryEmbedding, domainEmbeddings, topK);
  return similar.filter(s => s.similarity >= SEARCH_CONFIG.minSimilarity);
}

/**
 * Gets a preview snippet from session.
 */
function getSessionPreview(session) {
  if (!session) return '';

  // Prefer insight, then highlight
  if (session.insights?.length > 0) {
    return session.insights[0].text.slice(0, 100) + '...';
  }

  if (session.highlights?.length > 0) {
    return session.highlights[0].text.slice(0, 100) + '...';
  }

  return '';
}

/**
 * Gets API key from storage.
 */
async function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['gemini_api_key', 'apiKey'], (result) => {
      const key = result.gemini_api_key || result.apiKey;
      if (key) {
        resolve(key);
      } else {
        reject(new Error('API key not configured'));
      }
    });
  });
}

export {
  SEARCH_CONFIG,
  findRelated,
  findRelatedToSession,
  findRelatedToPage,
  searchWithinDomain
};
```

### Success Criteria
- [ ] Finds semantically related content
- [ ] Results sorted by similarity
- [ ] Minimum threshold filters noise
- [ ] Can search across all or within domain
- [ ] Returns enriched session data

---

## Task 3.3: "Related from Memory" Feature

### Objective
Proactively show relevant past notes when reading new content.

### Implementation Steps

#### Step 1: Create Related Memory Service

**File:** `services/related_memory.js` (NEW)

```javascript
/**
 * Related Memory Service
 * Surfaces relevant past knowledge proactively.
 */

import * as SemanticSearch from './semantic_search.js';
import * as SessionService from '../storage/reading_session.js';

const MEMORY_CONFIG = {
  minSimilarity: 0.7,      // Higher threshold for proactive display
  maxResults: 3,            // Don't overwhelm user
  cooldownMs: 5 * 60 * 1000, // 5 minutes between suggestions
  minSessionsRequired: 5    // Need some history first
};

// Track when we last showed related memory
let lastSuggestionTime = 0;
let dismissedUrls = new Set();

/**
 * Checks if we should show "Related from Memory" for current page.
 * @param {Object} pageContext - Current page context
 * @returns {Promise<Object|null>} Related content or null
 */
async function checkForRelatedMemory(pageContext) {
  // Check cooldown
  if (Date.now() - lastSuggestionTime < MEMORY_CONFIG.cooldownMs) {
    return null;
  }

  // Check if user dismissed this URL
  const normalizedUrl = normalizeUrl(pageContext.url);
  if (dismissedUrls.has(normalizedUrl)) {
    return null;
  }

  // Check if we have enough history
  const embeddingCount = await VectorStore.getEmbeddingCount();
  if (embeddingCount < MEMORY_CONFIG.minSessionsRequired) {
    return null;
  }

  try {
    // Find related content
    const related = await SemanticSearch.findRelatedToPage(pageContext, MEMORY_CONFIG.maxResults);

    // Filter by higher threshold
    const strongMatches = related.filter(r => r.similarity >= MEMORY_CONFIG.minSimilarity);

    if (strongMatches.length === 0) {
      return null;
    }

    // Generate connection explanation
    const connection = await generateConnectionExplanation(
      pageContext,
      strongMatches[0]
    );

    return {
      matches: strongMatches,
      connection: connection,
      currentPage: {
        title: pageContext.title,
        url: pageContext.url
      }
    };

  } catch (err) {
    console.error('[RelatedMemory] Check failed:', err);
    return null;
  }
}

/**
 * Generates an explanation of how content is connected.
 */
async function generateConnectionExplanation(currentPage, relatedSession) {
  const prompt = `Briefly explain how these two topics are connected:

Current reading: "${currentPage.title}"
Previous reading: "${relatedSession.title}" (${relatedSession.preview})

In 1 sentence, explain the connection. Focus on conceptual relationship.
Example: "Both discuss reactive state management patterns in JavaScript frameworks."

Connection:`;

  try {
    const response = await callGeminiAPI(prompt);
    return response.trim();
  } catch {
    return `Similar topic to your previous reading`;
  }
}

/**
 * Marks suggestion as shown (updates cooldown).
 */
function markSuggestionShown() {
  lastSuggestionTime = Date.now();
}

/**
 * Dismisses related memory for a URL.
 */
function dismissForUrl(url) {
  dismissedUrls.add(normalizeUrl(url));
}

/**
 * Resets dismissed URLs (e.g., on new day).
 */
function resetDismissed() {
  dismissedUrls.clear();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export {
  MEMORY_CONFIG,
  checkForRelatedMemory,
  markSuggestionShown,
  dismissForUrl,
  resetDismissed
};
```

#### Step 2: Create Related Memory UI Component

**File:** `ui/components/related_memory.js` (NEW)

```javascript
/**
 * Related Memory UI Component
 */

/**
 * Creates the "Related from Memory" card.
 * @param {Object} memoryData - Data from checkForRelatedMemory
 * @param {Object} callbacks - Event callbacks
 * @returns {HTMLElement}
 */
function createRelatedMemoryUI(memoryData, callbacks) {
  const { matches, connection, currentPage } = memoryData;
  const topMatch = matches[0];

  const container = document.createElement('div');
  container.className = 'sp-related-memory';

  container.innerHTML = `
    <div class="memory-header">
      <span class="memory-icon">💭</span>
      <span class="memory-title">Related from your Memory</span>
      <button class="memory-dismiss" title="Dismiss">×</button>
    </div>

    <div class="memory-content">
      <div class="memory-intro">
        This reminds me of your notes on:
      </div>

      <div class="memory-match">
        <div class="match-info">
          <span class="match-icon">📚</span>
          <div class="match-details">
            <div class="match-title">"${topMatch.title}"</div>
            <div class="match-meta">
              <span class="match-similarity">${Math.round(topMatch.similarity * 100)}% similar</span>
              <span class="match-age">${formatTimeAgo(topMatch.createdAt)}</span>
              <span class="match-stats">${topMatch.insightCount} insights</span>
            </div>
          </div>
        </div>

        <div class="match-preview">"${topMatch.preview}"</div>
      </div>

      <div class="memory-connection">
        <span class="connection-icon">🔗</span>
        <span class="connection-text">${connection}</span>
      </div>

      ${matches.length > 1 ? `
        <div class="more-matches">
          <span>Also related:</span>
          ${matches.slice(1).map(m => `
            <span class="mini-match" data-session-id="${m.sessionId}">
              ${m.title.slice(0, 30)}... (${Math.round(m.similarity * 100)}%)
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <div class="memory-actions">
      <button class="memory-btn memory-btn-primary" id="view-notes">
        View Notes
      </button>
      <button class="memory-btn" id="compare-concepts">
        Compare Concepts
      </button>
      <button class="memory-btn" id="dismiss-memory">
        Dismiss
      </button>
    </div>
  `;

  // Event handlers
  container.querySelector('.memory-dismiss').addEventListener('click', () => {
    callbacks.onDismiss?.();
    fadeOutAndRemove(container);
  });

  container.querySelector('#view-notes').addEventListener('click', () => {
    callbacks.onViewNotes?.(topMatch.sessionId);
  });

  container.querySelector('#compare-concepts').addEventListener('click', () => {
    callbacks.onCompare?.(currentPage, topMatch);
  });

  container.querySelector('#dismiss-memory').addEventListener('click', () => {
    callbacks.onDismiss?.();
    fadeOutAndRemove(container);
  });

  // Mini match clicks
  container.querySelectorAll('.mini-match').forEach(el => {
    el.addEventListener('click', () => {
      const sessionId = el.dataset.sessionId;
      callbacks.onViewNotes?.(sessionId);
    });
  });

  return container;
}

function fadeOutAndRemove(element) {
  element.classList.add('memory-dismissed');
  setTimeout(() => element.remove(), 300);
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';

  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min ago`;
  return 'Just now';
}

// Styles
const RELATED_MEMORY_STYLES = `
.sp-related-memory {
  margin: 16px;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border: 1px solid #86efac;
  border-radius: 12px;
  overflow: hidden;
  animation: memorySlideIn 0.3s ease-out;
}

@keyframes memorySlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.memory-dismissed {
  animation: memorySlideOut 0.3s ease-out forwards;
}

@keyframes memorySlideOut {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

.memory-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid #86efac;
}

.memory-icon {
  font-size: 18px;
}

.memory-title {
  flex: 1;
  font-weight: 600;
  color: #166534;
}

.memory-dismiss {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 0 4px;
}

.memory-content {
  padding: 16px;
}

.memory-intro {
  color: #166534;
  margin-bottom: 12px;
}

.memory-match {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.match-info {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.match-icon {
  font-size: 24px;
}

.match-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
}

.match-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.match-similarity {
  color: #16a34a;
  font-weight: 500;
}

.match-preview {
  font-style: italic;
  color: #4b5563;
  font-size: 14px;
  padding-left: 34px;
}

.memory-connection {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  background: #fef3c7;
  border-radius: 6px;
  margin-bottom: 12px;
}

.connection-icon {
  font-size: 16px;
}

.connection-text {
  color: #92400e;
  font-size: 13px;
  line-height: 1.4;
}

.more-matches {
  font-size: 12px;
  color: #6b7280;
}

.mini-match {
  display: inline-block;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 4px;
  margin: 4px 4px 0 0;
  cursor: pointer;
}

.mini-match:hover {
  background: #d1d5db;
}

.memory-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-top: 1px solid #86efac;
}

.memory-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.memory-btn:hover {
  background: #f3f4f6;
}

.memory-btn-primary {
  background: #16a34a;
  border-color: #16a34a;
  color: white;
}

.memory-btn-primary:hover {
  background: #15803d;
}
`;

function injectRelatedMemoryStyles() {
  if (document.getElementById('related-memory-styles')) return;
  const style = document.createElement('style');
  style.id = 'related-memory-styles';
  style.textContent = RELATED_MEMORY_STYLES;
  document.head.appendChild(style);
}

export { createRelatedMemoryUI, injectRelatedMemoryStyles };
```

#### Step 3: Integrate into Sidepanel

**File:** `sidepanel.js`

```javascript
import * as RelatedMemory from './services/related_memory.js';
import { createRelatedMemoryUI, injectRelatedMemoryStyles } from './ui/components/related_memory.js';

/**
 * Checks for and displays related memory.
 */
async function checkAndShowRelatedMemory(pageContext) {
  const memoryData = await RelatedMemory.checkForRelatedMemory(pageContext);

  if (!memoryData) return;

  injectRelatedMemoryStyles();

  const memoryUI = createRelatedMemoryUI(memoryData, {
    onViewNotes: (sessionId) => {
      showSessionNotes(sessionId);
    },
    onCompare: (current, past) => {
      showConceptComparison(current, past);
    },
    onDismiss: () => {
      RelatedMemory.dismissForUrl(pageContext.url);
    }
  });

  RelatedMemory.markSuggestionShown();

  // Insert at top of content area
  const contentArea = document.querySelector('.sp-content');
  if (contentArea.firstChild) {
    contentArea.insertBefore(memoryUI, contentArea.firstChild);
  } else {
    contentArea.appendChild(memoryUI);
  }
}

// Call on page context received
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pageContextUpdated') {
    checkAndShowRelatedMemory(message.pageContext);
  }
});
```

### Success Criteria
- [ ] Shows related content proactively
- [ ] Similarity threshold prevents noise
- [ ] Connection explanation helpful
- [ ] Can view past notes directly
- [ ] Respects cooldown and dismissal

---

## Task 3.4: Auto-Connection Detection

### Objective
Automatically identify and store relationships between sessions.

### Implementation

**File:** `services/connection_detector.js` (NEW)

```javascript
/**
 * Connection Detector Service
 * Automatically identifies relationships between sessions.
 */

import * as SemanticSearch from './semantic_search.js';
import * as SessionService from '../storage/reading_session.js';

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

/**
 * Detects connections for a session.
 * @param {string} sessionId - Session to find connections for
 * @returns {Promise<Array>} Detected connections
 */
async function detectConnections(sessionId) {
  // Find semantically similar sessions
  const related = await SemanticSearch.findRelatedToSession(sessionId, 10);

  if (related.length === 0) {
    return [];
  }

  const session = await SessionService.getSessionById(sessionId);
  const connections = [];

  for (const candidate of related) {
    // Skip low similarity
    if (candidate.similarity < 0.6) continue;

    // Analyze relationship
    const candidateSession = await SessionService.getSessionById(candidate.sessionId);
    if (!candidateSession) continue;

    const relationship = await analyzeRelationship(session, candidateSession);

    if (relationship && relationship.confidence > 0.7) {
      connections.push({
        id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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
}

/**
 * Analyzes the relationship type between two sessions.
 */
async function analyzeRelationship(session1, session2) {
  const insights1 = session1.insights.map(i => i.text).join('\n');
  const insights2 = session2.insights.map(i => i.text).join('\n');

  if (!insights1 || !insights2) {
    return { type: 'similar', confidence: 0.6, explanation: 'Related topics' };
  }

  const prompt = `Compare these two sets of reading notes and determine their relationship:

Session A: "${session1.title}"
Notes: ${insights1.slice(0, 500)}

Session B: "${session2.title}"
Notes: ${insights2.slice(0, 500)}

Determine the relationship type:
- SUPPORTS: A provides evidence or validation for B
- CONTRADICTS: A disagrees or conflicts with B
- EXTENDS: A builds upon or elaborates B
- SIMILAR: A and B cover similar topics without specific relationship
- APPLIES: A is a practical application of concepts in B

Return JSON:
{
  "type": "supports|contradicts|extends|similar|applies",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of the relationship"
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      type: 'similar',
      confidence: 0.5,
      explanation: 'Related topics'
    };
  }
}

/**
 * Saves connections to storage.
 */
async function saveConnections(newConnections) {
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
 * Gets all connections for a session.
 */
async function getConnectionsForSession(sessionId) {
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
  const connection = {
    id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    sourceId,
    targetId,
    type,
    confidence: 1.0,  // Manual = confident
    explanation,
    createdAt: Date.now(),
    createdBy: 'user'
  };

  await saveConnections([connection]);
  return connection;
}

export {
  CONNECTION_TYPES,
  detectConnections,
  getConnectionsForSession,
  getAllConnections,
  addManualConnection
};
```

### Success Criteria
- [ ] Detects 5 relationship types
- [ ] AI analyzes relationship with confidence
- [ ] Connections stored persistently
- [ ] Supports both auto and manual connections

---

## Task 3.5: Knowledge Graph Visualization

### Objective
Visual map of connected knowledge using Canvas.

### Implementation

**File:** `ui/components/knowledge_graph.js` (NEW)

```javascript
/**
 * Knowledge Graph Visualization Component
 * Canvas-based node-link diagram.
 */

import { CONNECTION_TYPES } from '../../services/connection_detector.js';

const GRAPH_CONFIG = {
  nodeRadius: 20,
  nodeColor: '#3B82F6',
  nodeHoverColor: '#1D4ED8',
  linkWidth: 2,
  fontSize: 12,
  padding: 50,
  repulsion: 100,
  attraction: 0.1,
  damping: 0.9
};

class KnowledgeGraph {
  constructor(container, data) {
    this.container = container;
    this.nodes = data.nodes;
    this.edges = data.edges;

    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;

    this.hoveredNode = null;
    this.selectedNode = null;
    this.isDragging = false;
    this.dragNode = null;

    this.onNodeClick = null;
    this.onNodeHover = null;

    this.init();
  }

  init() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'knowledge-graph-canvas';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Size to container
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize node positions
    this.initPositions();

    // Event listeners
    this.setupEvents();

    // Start animation
    this.animate();
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  initPositions() {
    // Random initial positions
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) / 3;

    this.nodes.forEach((node, i) => {
      const angle = (i / this.nodes.length) * Math.PI * 2;
      node.x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50;
      node.y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50;
      node.vx = 0;
      node.vy = 0;
    });
  }

  setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  findNodeAtPos(pos) {
    return this.nodes.find(node => {
      const dx = node.x - pos.x;
      const dy = node.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) < GRAPH_CONFIG.nodeRadius;
    });
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    if (this.isDragging && this.dragNode) {
      this.dragNode.x = pos.x;
      this.dragNode.y = pos.y;
      this.dragNode.vx = 0;
      this.dragNode.vy = 0;
      return;
    }

    const node = this.findNodeAtPos(pos);
    if (node !== this.hoveredNode) {
      this.hoveredNode = node;
      this.canvas.style.cursor = node ? 'pointer' : 'default';
      this.onNodeHover?.(node);
    }
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);
    const node = this.findNodeAtPos(pos);

    if (node) {
      this.isDragging = true;
      this.dragNode = node;
    }
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.dragNode = null;
  }

  onClick(e) {
    const pos = this.getMousePos(e);
    const node = this.findNodeAtPos(pos);

    if (node) {
      this.selectedNode = node;
      this.onNodeClick?.(node);
    }
  }

  // Physics simulation
  simulate() {
    // Apply forces
    this.nodes.forEach(node => {
      if (node === this.dragNode) return;

      // Repulsion from other nodes
      this.nodes.forEach(other => {
        if (node === other) return;

        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < GRAPH_CONFIG.repulsion * 2) {
          const force = GRAPH_CONFIG.repulsion / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      });

      // Attraction along edges
      this.edges.forEach(edge => {
        let other = null;
        if (edge.source === node.id) {
          other = this.nodes.find(n => n.id === edge.target);
        } else if (edge.target === node.id) {
          other = this.nodes.find(n => n.id === edge.source);
        }

        if (other) {
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          node.vx += dx * GRAPH_CONFIG.attraction;
          node.vy += dy * GRAPH_CONFIG.attraction;
        }
      });

      // Center gravity
      const dx = this.width / 2 - node.x;
      const dy = this.height / 2 - node.y;
      node.vx += dx * 0.001;
      node.vy += dy * 0.001;

      // Apply damping
      node.vx *= GRAPH_CONFIG.damping;
      node.vy *= GRAPH_CONFIG.damping;

      // Update position
      node.x += node.vx;
      node.y += node.vy;

      // Bounds
      node.x = Math.max(GRAPH_CONFIG.padding, Math.min(this.width - GRAPH_CONFIG.padding, node.x));
      node.y = Math.max(GRAPH_CONFIG.padding, Math.min(this.height - GRAPH_CONFIG.padding, node.y));
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw edges
    this.edges.forEach(edge => {
      const source = this.nodes.find(n => n.id === edge.source);
      const target = this.nodes.find(n => n.id === edge.target);

      if (!source || !target) return;

      const connectionType = CONNECTION_TYPES[edge.type?.toUpperCase()] || CONNECTION_TYPES.SIMILAR;

      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(target.x, target.y);
      this.ctx.strokeStyle = connectionType.color;
      this.ctx.lineWidth = GRAPH_CONFIG.linkWidth;
      this.ctx.stroke();
    });

    // Draw nodes
    this.nodes.forEach(node => {
      const isHovered = node === this.hoveredNode;
      const isSelected = node === this.selectedNode;

      // Node circle
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, GRAPH_CONFIG.nodeRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = isHovered || isSelected
        ? GRAPH_CONFIG.nodeHoverColor
        : GRAPH_CONFIG.nodeColor;
      this.ctx.fill();

      if (isSelected) {
        this.ctx.strokeStyle = '#1E40AF';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
      }

      // Node label
      this.ctx.fillStyle = '#1F2937';
      this.ctx.font = `${GRAPH_CONFIG.fontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        truncateText(node.label, 15),
        node.x,
        node.y + GRAPH_CONFIG.nodeRadius + 15
      );
    });
  }

  animate() {
    this.simulate();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    this.canvas.remove();
  }
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Creates knowledge graph UI wrapper.
 */
function createKnowledgeGraphUI(data, onNodeSelect) {
  const container = document.createElement('div');
  container.className = 'sp-knowledge-graph';

  container.innerHTML = `
    <div class="graph-header">
      <h3>🗺️ Your Knowledge Map</h3>
      <div class="graph-controls">
        <select id="graph-filter">
          <option value="all">All Topics</option>
          <option value="recent">Recent (7 days)</option>
          <option value="connected">Most Connected</option>
        </select>
        <button class="graph-btn" id="graph-reset">Reset View</button>
      </div>
    </div>

    <div class="graph-canvas-container"></div>

    <div class="graph-legend">
      ${Object.values(CONNECTION_TYPES).map(type => `
        <span class="legend-item">
          <span class="legend-color" style="background: ${type.color}"></span>
          ${type.label}
        </span>
      `).join('')}
    </div>

    <div class="graph-details" id="node-details" style="display: none;">
      <div class="details-header">
        <span id="details-title"></span>
        <button class="details-close">×</button>
      </div>
      <div class="details-content">
        <div id="details-meta"></div>
        <div id="details-connections"></div>
        <button class="btn-primary" id="view-session">View Full Session</button>
      </div>
    </div>
  `;

  // Initialize graph after container is in DOM
  setTimeout(() => {
    const canvasContainer = container.querySelector('.graph-canvas-container');
    const graph = new KnowledgeGraph(canvasContainer, data);

    graph.onNodeClick = (node) => {
      showNodeDetails(container, node, data.edges);
      onNodeSelect?.(node);
    };

    // Reset button
    container.querySelector('#graph-reset').addEventListener('click', () => {
      graph.initPositions();
    });

    // Filter
    container.querySelector('#graph-filter').addEventListener('change', (e) => {
      // Filter logic would go here
    });

    // Close details
    container.querySelector('.details-close').addEventListener('click', () => {
      container.querySelector('#node-details').style.display = 'none';
    });
  }, 0);

  return container;
}

function showNodeDetails(container, node, edges) {
  const details = container.querySelector('#node-details');
  const connections = edges.filter(e =>
    e.source === node.id || e.target === node.id
  );

  details.querySelector('#details-title').textContent = node.label;
  details.querySelector('#details-meta').innerHTML = `
    <div>Created: ${new Date(node.createdAt).toLocaleDateString()}</div>
    <div>Connections: ${connections.length}</div>
  `;

  details.querySelector('#details-connections').innerHTML = connections.length > 0
    ? connections.map(c => {
        const type = CONNECTION_TYPES[c.type?.toUpperCase()] || CONNECTION_TYPES.SIMILAR;
        return `<span class="connection-badge" style="background: ${type.color}">${type.icon} ${type.label}</span>`;
      }).join('')
    : '<em>No connections yet</em>';

  details.style.display = 'block';
}

// Styles
const KNOWLEDGE_GRAPH_STYLES = `
.sp-knowledge-graph {
  height: 500px;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.graph-header h3 {
  margin: 0;
  font-size: 16px;
}

.graph-controls {
  display: flex;
  gap: 8px;
}

.graph-controls select, .graph-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.graph-canvas-container {
  flex: 1;
  position: relative;
}

.knowledge-graph-canvas {
  display: block;
}

.graph-legend {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.graph-details {
  position: absolute;
  top: 60px;
  right: 16px;
  width: 250px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 10;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
}

.details-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}

.details-content {
  padding: 12px;
}

.connection-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: white;
  margin: 2px;
}
`;

function injectKnowledgeGraphStyles() {
  if (document.getElementById('knowledge-graph-styles')) return;
  const style = document.createElement('style');
  style.id = 'knowledge-graph-styles';
  style.textContent = KNOWLEDGE_GRAPH_STYLES;
  document.head.appendChild(style);
}

export { KnowledgeGraph, createKnowledgeGraphUI, injectKnowledgeGraphStyles };
```

### Success Criteria
- [ ] Interactive node-link diagram
- [ ] Force-directed layout
- [ ] Draggable nodes
- [ ] Click to see details
- [ ] Color-coded connection types
- [ ] Smooth animations

---

## Task 3.6: Cross-Domain Alerts

### Objective
Notify when new reading connects to past knowledge.

### Implementation

**File:** `services/cross_domain_alerts.js` (NEW)

```javascript
/**
 * Cross-Domain Alerts Service
 * Notifies users when reading connects to past knowledge.
 */

import * as SemanticSearch from './semantic_search.js';

const ALERT_TEMPLATES = {
  SIMILAR_CONCEPT: {
    id: 'similar_concept',
    icon: '💡',
    title: 'This looks familiar!',
    template: '"{current}" is similar to "{past}" you read {timeAgo}.'
  },
  CONTRADICTION: {
    id: 'contradiction',
    icon: '⚠️',
    title: 'Different perspective!',
    template: 'This contradicts what you read about "{topic}" in "{past}".'
  },
  BUILDING_BLOCK: {
    id: 'building_block',
    icon: '🧱',
    title: 'Building on your knowledge!',
    template: 'This extends your understanding of "{topic}" from "{past}".'
  },
  PRACTICAL_APPLICATION: {
    id: 'practical_application',
    icon: '🔧',
    title: 'Now you can apply it!',
    template: 'This shows how to apply "{concept}" you learned in "{past}".'
  }
};

const ALERT_CONFIG = {
  minSimilarity: 0.75,
  maxAlertsPerSession: 3,
  cooldownMs: 10 * 60 * 1000  // 10 minutes
};

let alertCount = 0;
let lastAlertTime = 0;

/**
 * Checks if current highlight triggers a cross-domain alert.
 * @param {Object} highlight - Current highlight data
 * @param {Object} pageContext - Current page context
 * @returns {Promise<Object|null>}
 */
async function checkForAlert(highlight, pageContext) {
  // Check limits
  if (alertCount >= ALERT_CONFIG.maxAlertsPerSession) return null;
  if (Date.now() - lastAlertTime < ALERT_CONFIG.cooldownMs) return null;

  try {
    // Search for related content
    const related = await SemanticSearch.findRelated(highlight.text, {
      topK: 3,
      minSimilarity: ALERT_CONFIG.minSimilarity
    });

    if (related.length === 0) return null;

    const topMatch = related[0];

    // Don't alert for same domain (probably same article)
    if (topMatch.domain === pageContext.domain) {
      // Check second match
      if (related.length < 2 || related[1].domain === pageContext.domain) {
        return null;
      }
      topMatch = related[1];
    }

    // Determine alert type
    const alertType = await determineAlertType(highlight.text, topMatch);

    return {
      type: alertType,
      template: ALERT_TEMPLATES[alertType],
      current: {
        text: highlight.text.slice(0, 100),
        title: pageContext.title
      },
      past: {
        sessionId: topMatch.sessionId,
        title: topMatch.title,
        similarity: topMatch.similarity,
        preview: topMatch.preview,
        createdAt: topMatch.createdAt
      }
    };

  } catch (err) {
    console.error('[CrossDomainAlert] Check failed:', err);
    return null;
  }
}

/**
 * Determines the appropriate alert type.
 */
async function determineAlertType(currentText, pastSession) {
  // Simple heuristic - could be enhanced with AI
  const similarity = pastSession.similarity;

  if (similarity > 0.9) {
    return 'SIMILAR_CONCEPT';
  }

  // Check for potential application (current mentions "how to", "example", etc.)
  if (/how to|example|implement|use|apply/i.test(currentText)) {
    return 'PRACTICAL_APPLICATION';
  }

  // Check for extension patterns
  if (/additionally|furthermore|building on|extends/i.test(currentText)) {
    return 'BUILDING_BLOCK';
  }

  // Default
  return 'SIMILAR_CONCEPT';
}

/**
 * Marks that an alert was shown.
 */
function recordAlert() {
  alertCount++;
  lastAlertTime = Date.now();
}

/**
 * Resets alert counters (e.g., on new session).
 */
function resetAlerts() {
  alertCount = 0;
  lastAlertTime = 0;
}

/**
 * Formats the alert message.
 */
function formatAlertMessage(alertData) {
  const { template, current, past } = alertData;

  let message = template.template
    .replace('{current}', current.title)
    .replace('{past}', past.title)
    .replace('{topic}', current.text.slice(0, 30))
    .replace('{concept}', current.text.slice(0, 30))
    .replace('{timeAgo}', formatTimeAgo(past.createdAt));

  return {
    icon: template.icon,
    title: template.title,
    message: message,
    similarity: Math.round(past.similarity * 100) + '%'
  };
}

function formatTimeAgo(timestamp) {
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export {
  ALERT_TEMPLATES,
  checkForAlert,
  recordAlert,
  resetAlerts,
  formatAlertMessage
};
```

### Success Criteria
- [ ] Detects cross-domain connections
- [ ] Multiple alert types
- [ ] Rate limiting prevents spam
- [ ] Clear, actionable messages

---

## File Changes Summary

### New Files to Create
1. `services/embedding_service.js` - Vector embedding generation
2. `services/semantic_search.js` - Similarity search
3. `services/related_memory.js` - Proactive memory surfacing
4. `services/connection_detector.js` - Relationship detection
5. `services/cross_domain_alerts.js` - Connection alerts
6. `storage/vector_store.js` - IndexedDB for embeddings
7. `ui/components/related_memory.js` - Memory UI
8. `ui/components/knowledge_graph.js` - Graph visualization

### Files to Modify
1. `storage/reading_session.js` - Auto-embed on save
2. `sidepanel.js` - Integrate related memory, graph view
3. `content.js` - Trigger cross-domain alerts on highlight

---

## Deployment Checklist

- [ ] Phase 2 complete and stable
- [ ] Gemini embedding API working
- [ ] IndexedDB storage reliable
- [ ] Semantic search accurate
- [ ] Related memory shows appropriately
- [ ] Connection detection meaningful
- [ ] Knowledge graph renders smoothly
- [ ] Cross-domain alerts not annoying
- [ ] Update version to 3.2/3.3

---

## API Cost Considerations

| Operation | Est. Cost | Frequency |
|-----------|-----------|-----------|
| Embed session | ~$0.0001 | Per session save |
| Search query | ~$0.0001 | Per search |
| Relationship analysis | ~$0.001 | Per connection |

**Monthly estimate (100 sessions, 500 searches):** ~$0.15

---

**End of Phase 3 Specification**
