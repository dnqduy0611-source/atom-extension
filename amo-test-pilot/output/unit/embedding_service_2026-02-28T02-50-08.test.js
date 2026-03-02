import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load IIFE into simulated window ─────────────────────────────────────────
// embedding_service.js dùng pattern IIFE: (function() { window.EmbeddingService = {...} })()
// Functions bên trong là PRIVATE — chỉ test qua window.EmbeddingService (public API)
// Dùng new Function('window', src) để inject window mock làm local variable,
// tránh phụ thuộc vào globalThis.window trong Node.js ESM context.

const SOURCE_PATH = resolve(__dirname, '../../../services/embedding_service.js');
const src = readFileSync(SOURCE_PATH, 'utf-8');

// windowMock được truyền vào IIFE làm tham số `window`
// Các function được extract 1 lần — chúng dùng closure trên cùng embeddingCache
const windowMock = { VectorStore: { deleteEmbedding: vi.fn() } };
const loadService = new Function('window', src);
loadService(windowMock);

const {
    generateEmbedding,
    embedSession,
    cosineSimilarity,
    findTopKSimilar,
    clearCache,
    getCacheStats,
    EMBEDDING_CONFIG,
} = windowMock.EmbeddingService;

// ─── generateEmbedding ───────────────────────────────────────────────────────

describe('generateEmbedding', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        clearCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('throws empty_text for empty string', async () => {
        await expect(generateEmbedding('', 'key')).rejects.toThrow('empty_text');
    });

    it('throws empty_text for whitespace-only string', async () => {
        await expect(generateEmbedding('   ', 'key')).rejects.toThrow('empty_text');
    });

    it('throws missing_api_key for empty API key', async () => {
        await expect(generateEmbedding('valid text', '')).rejects.toThrow('missing_api_key');
    });

    it('throws missing_api_key for null API key', async () => {
        await expect(generateEmbedding('valid text', null)).rejects.toThrow('missing_api_key');
    });

    it('returns embedding array on successful API call', async () => {
        const mockEmbedding = new Array(768).fill(0.1);
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: mockEmbedding } }),
        });

        const result = await generateEmbedding('hello world', 'my-api-key');
        expect(result).toEqual(mockEmbedding);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('calls correct Gemini endpoint with API key', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: [0.1] } }),
        });

        await generateEmbedding('test', 'my-api-key');
        const [url] = vi.mocked(fetch).mock.calls[0];
        expect(url).toContain('gemini-embedding-001');
        expect(url).toContain('my-api-key');
    });

    it('throws embedding_api_error_400 on HTTP 400', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => 'Bad request',
        });
        await expect(generateEmbedding('text', 'key')).rejects.toThrow('embedding_api_error_400');
    });

    it('throws invalid_embedding_response when response has no embedding values', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: null }),
        });
        await expect(generateEmbedding('text', 'key')).rejects.toThrow('invalid_embedding_response');
    });

    it('returns cached result on second identical call (no second fetch)', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: [0.1, 0.2] } }),
        });

        await generateEmbedding('same text', 'key');
        await generateEmbedding('same text', 'key');
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('truncates text to EMBEDDING_CONFIG.maxTextLength', async () => {
        const longText = 'a'.repeat(EMBEDDING_CONFIG.maxTextLength + 1000);
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: [0.1] } }),
        });

        await generateEmbedding(longText, 'key');
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        expect(body.content.parts[0].text.length).toBe(EMBEDDING_CONFIG.maxTextLength);
    });

    it('evicts oldest cache entry when cache reaches cacheSize', async () => {
        // Fill cache to max with unique texts
        for (let i = 0; i < EMBEDDING_CONFIG.cacheSize; i++) {
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ embedding: { values: [i] } }),
            });
            await generateEmbedding(`unique text ${i} padding`, 'key');
        }
        expect(getCacheStats().size).toBe(EMBEDDING_CONFIG.cacheSize);

        // One more — evicts oldest
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ embedding: { values: [999] } }),
        });
        await generateEmbedding('brand new text never seen before', 'key');
        expect(getCacheStats().size).toBe(EMBEDDING_CONFIG.cacheSize);
    });
});

// ─── embedSession ─────────────────────────────────────────────────────────────

describe('embedSession', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: [0.1, 0.2] } }),
        }));
        clearCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('throws invalid_session for null', async () => {
        await expect(embedSession(null, 'key')).rejects.toThrow('invalid_session');
    });

    it('throws invalid_session for non-object (string)', async () => {
        await expect(embedSession('string', 'key')).rejects.toThrow('invalid_session');
    });

    it('throws session_no_content for empty session object', async () => {
        await expect(embedSession({}, 'key')).rejects.toThrow('session_no_content');
    });

    it('throws session_no_content when all content parts are empty', async () => {
        await expect(embedSession({ title: '', highlights: [], insights: [] }, 'key'))
            .rejects.toThrow('session_no_content');
    });

    it('generates embedding from title alone', async () => {
        const result = await embedSession({ title: 'My Article' }, 'key');
        expect(result).toEqual([0.1, 0.2]);
    });

    it('combines title + highlights + insights in request body', async () => {
        const session = {
            title: 'Article Title',
            highlights: [{ text: 'highlight one' }, { text: 'highlight two' }],
            insights: [{ text: 'insight one' }],
        };
        await embedSession(session, 'key');
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1].body);
        const text = body.content.parts[0].text;
        expect(text).toContain('Article Title');
        expect(text).toContain('highlight one');
        expect(text).toContain('insight one');
    });

    it('filters out null/undefined items from highlights and insights', async () => {
        const session = {
            highlights: [null, { text: 'valid highlight' }, undefined],
            insights: [null],
        };
        // Should not throw — filters nulls and uses 'valid highlight'
        const result = await embedSession(session, 'key');
        expect(result).toBeDefined();
    });
});

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
    it('returns 1.0 for identical vectors', () => {
        const v = [1, 2, 3];
        expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
    });

    it('returns 0 for orthogonal vectors', () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });

    it('returns 0 for zero-magnitude vector', () => {
        expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    });

    it('returns 0 for dimension mismatch', () => {
        expect(cosineSimilarity([1, 2], [1])).toBe(0);
    });

    it('returns 0 for non-array inputs', () => {
        expect(cosineSimilarity(null, [1, 0])).toBe(0);
        expect(cosineSimilarity([1, 0], 'string')).toBe(0);
    });

    it('returns correct similarity for [1,1] vs [1,0] → 1/√2', () => {
        expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(1 / Math.sqrt(2));
    });

    it('returns -1 for opposite vectors', () => {
        expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    });
});

// ─── findTopKSimilar ──────────────────────────────────────────────────────────

describe('findTopKSimilar', () => {
    beforeEach(() => {
        // Reset VectorStore mock giữa các tests
        windowMock.VectorStore = { deleteEmbedding: vi.fn() };
    });

    it('returns empty array for null queryEmbedding', () => {
        expect(findTopKSimilar(null, [], 5)).toEqual([]);
    });

    it('returns empty array for non-array candidates', () => {
        expect(findTopKSimilar([1, 0], 'invalid', 5)).toEqual([]);
    });

    it('filters out invalid candidates (null, no sessionId, no embedding, wrong type)', () => {
        const candidates = [
            null,
            { sessionId: '1', embedding: [1, 0] },
            { sessionId: '2' },                        // missing embedding
            { sessionId: '3', embedding: 'not array' }, // wrong type
        ];
        const result = findTopKSimilar([1, 0], candidates, 5);
        expect(result).toHaveLength(1);
        expect(result[0].sessionId).toBe('1');
    });

    it('returns results sorted by descending similarity', () => {
        const candidates = [
            { sessionId: 'low', embedding: [0, 1] },  // orthogonal to [1,0] → 0
            { sessionId: 'high', embedding: [1, 0] }, // same as query → 1
        ];
        const result = findTopKSimilar([1, 0], candidates, 5);
        expect(result[0].sessionId).toBe('high');
        expect(result[1].sessionId).toBe('low');
    });

    it('respects topK limit', () => {
        const candidates = Array.from({ length: 10 }, (_, i) => ({
            sessionId: `s${i}`,
            embedding: [1, 0],
        }));
        expect(findTopKSimilar([1, 0], candidates, 3)).toHaveLength(3);
    });

    it('defaults topK to 5 when given invalid value (0 or negative)', () => {
        const candidates = Array.from({ length: 10 }, (_, i) => ({
            sessionId: `s${i}`,
            embedding: [1, 0],
        }));
        expect(findTopKSimilar([1, 0], candidates, 0)).toHaveLength(5);
        expect(findTopKSimilar([1, 0], candidates, -1)).toHaveLength(5);
    });

    it('calls VectorStore.deleteEmbedding for candidates with wrong dimension', () => {
        const candidates = [
            { sessionId: 'stale', embedding: [1] },    // 1D — wrong for 2D query
            { sessionId: 'good', embedding: [1, 0] },  // 2D — correct
        ];
        findTopKSimilar([1, 0], candidates, 5);
        expect(windowMock.VectorStore.deleteEmbedding).toHaveBeenCalledWith('stale');
        expect(windowMock.VectorStore.deleteEmbedding).not.toHaveBeenCalledWith('good');
    });
});

// ─── clearCache & getCacheStats ───────────────────────────────────────────────

describe('clearCache', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ embedding: { values: [0.1] } }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        clearCache();
    });

    it('empties the cache after entries were added', async () => {
        await generateEmbedding('some cached text', 'key');
        expect(getCacheStats().size).toBeGreaterThan(0);
        clearCache();
        expect(getCacheStats().size).toBe(0);
    });
});

describe('getCacheStats', () => {
    beforeEach(() => {
        clearCache();
    });

    it('returns size 0 on empty cache', () => {
        expect(getCacheStats()).toEqual({ size: 0, maxSize: EMBEDDING_CONFIG.cacheSize });
    });

    it('returns correct maxSize matching EMBEDDING_CONFIG.cacheSize (100)', () => {
        expect(getCacheStats().maxSize).toBe(100);
    });
});
