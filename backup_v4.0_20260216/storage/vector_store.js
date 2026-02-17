// storage/vector_store.js
// IndexedDB storage for vector embeddings

(function () {
    'use strict';

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

            request.onerror = () => {
                console.error('[VectorStore] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                dbInstance = request.result;
                resolve(dbInstance);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

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
    async function storeEmbedding(sessionId, embedding, metadata) {
        if (!sessionId || !Array.isArray(embedding)) {
            console.warn('[VectorStore] Invalid params for storeEmbedding');
            return;
        }

        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const record = {
                    sessionId,
                    embedding,
                    timestamp: Date.now(),
                    ...(metadata || {})
                };

                const request = store.put(record);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Store embedding failed:', err);
            throw err;
        }
    }

    /**
     * Gets an embedding by session ID.
     * @param {string} sessionId
     * @returns {Promise<Object|null>}
     */
    async function getEmbedding(sessionId) {
        if (!sessionId) return null;

        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.get(sessionId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Get embedding failed:', err);
            return null;
        }
    }

    /**
     * Gets all embeddings.
     * @returns {Promise<Array>}
     */
    async function getAllEmbeddings() {
        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Get all embeddings failed:', err);
            return [];
        }
    }

    /**
     * Deletes an embedding.
     * @param {string} sessionId
     */
    async function deleteEmbedding(sessionId) {
        if (!sessionId) return;

        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.delete(sessionId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Delete embedding failed:', err);
        }
    }

    /**
     * Gets embeddings by domain.
     * @param {string} domain
     * @returns {Promise<Array>}
     */
    async function getEmbeddingsByDomain(domain) {
        if (!domain) return [];

        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const index = store.index('domain');

                const request = index.getAll(domain);
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Get by domain failed:', err);
            return [];
        }
    }

    /**
     * Gets count of stored embeddings.
     * @returns {Promise<number>}
     */
    async function getEmbeddingCount() {
        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.count();
                request.onsuccess = () => resolve(request.result || 0);
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Get count failed:', err);
            return 0;
        }
    }

    /**
     * Clears all embeddings.
     */
    async function clearAllEmbeddings() {
        try {
            const db = await openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.error('[VectorStore] Clear all failed:', err);
        }
    }

    /**
     * Gets recent embeddings (sorted by timestamp).
     * @param {number} limit - Max number of results
     * @returns {Promise<Array>}
     */
    async function getRecentEmbeddings(limit) {
        const maxResults = Number.isFinite(limit) && limit > 0 ? limit : 20;

        try {
            const all = await getAllEmbeddings();
            return all
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, maxResults);
        } catch (err) {
            console.error('[VectorStore] Get recent failed:', err);
            return [];
        }
    }

    /**
     * Gets embeddings filtered by type.
     * @param {string} type - 'session' | 'digest'
     * @returns {Promise<Array>}
     */
    async function getEmbeddingsByType(type) {
        if (!type) return [];
        try {
            const all = await getAllEmbeddings();
            return all.filter(e => e.type === type);
        } catch (err) {
            console.error('[VectorStore] Get by type failed:', err);
            return [];
        }
    }

    window.VectorStore = {
        openDatabase,
        storeEmbedding,
        getEmbedding,
        getAllEmbeddings,
        deleteEmbedding,
        getEmbeddingsByDomain,
        getEmbeddingCount,
        clearAllEmbeddings,
        getRecentEmbeddings,
        getEmbeddingsByType
    };
})();
