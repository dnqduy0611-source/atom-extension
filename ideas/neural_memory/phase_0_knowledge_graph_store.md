# Phase 0 — Knowledge Graph Store

> **Status:** Sẵn sàng implement
> **Date:** 2026-02-11
> **Prerequisite:** Không
> **Ref:** [00_overview.md](./00_overview.md) §4.1-4.3

---

## 1. Mục tiêu

Tạo storage layer cho Knowledge Graph — nơi lưu trữ và truy vấn edges (connections giữa sessions). Đây là nền tảng cho tất cả phases sau.

**Kết quả:**
- File mới: `storage/knowledge_graph.js`
- Sửa: `bridge/types.js` (thêm 2 constants)
- Không sửa UI, không sửa manifest

---

## 2. Edge Schema

```javascript
/**
 * Knowledge Graph Edge
 * Stored in: chrome.storage.local → atom_knowledge_graph_v1
 */
{
  edgeId: "edge_1707550000_abc123",    // unique ID
  sourceId: "session_170755...",        // reading session ID
  targetId: "session_170742...",        // related session ID
  sourceTopicKey: "tag:react-hooks",    // topicKey of source
  targetTopicKey: "dom:react.dev",      // topicKey of target

  // Relationship metadata
  type: "extends",                      // supports | contradicts | extends | similar | applies
  confidence: 0.85,                     // 0.0 - 1.0
  explanation: "Both discuss...",       // AI-generated 1-liner

  // Strength (chuẩn bị cho Phase 3)
  strength: 1.0,                        // 0.0 - 1.0, decays over time
  activationCount: 0,                   // times this edge was traversed in recall
  lastActivatedAt: null,                // timestamp of last activation

  // Metadata
  createdAt: 1707550000000,
  createdBy: "auto",                    // "auto" | "user" | "enrichment"
  similarity: 0.78                      // original cosine similarity
}
```

---

## 3. Constants cần thêm

File: `bridge/types.js`

```javascript
// Knowledge Graph
export const KG_EDGES_KEY = "atom_knowledge_graph_v1";
export const KG_MAX_EDGES = 1000;
```

---

## 4. API — `storage/knowledge_graph.js`

### 4.1 Core CRUD

| Function | Signature | Mô tả |
|----------|-----------|-------|
| `loadEdges()` | `() → Promise<Edge[]>` | Load tất cả edges |
| `saveEdges(edges)` | `(Edge[]) → Promise<void>` | Save array edges |
| `addEdge(edge)` | `(Edge) → Promise<Edge>` | Thêm edge + dedup + cap 1000 |
| `removeEdge(edgeId)` | `(string) → Promise<boolean>` | Xóa 1 edge |
| `removeEdgesForSession(sessionId)` | `(string) → Promise<number>` | Xóa tất cả edges nối tới session |

### 4.2 Query

| Function | Signature | Mô tả |
|----------|-----------|-------|
| `getEdgesForSession(sessionId)` | `(string) → Promise<Edge[]>` | Lấy edges liên quan đến session |
| `getNeighbors(sessionId)` | `(string) → Promise<Neighbor[]>` | 1-hop neighbors từ adjacency index |
| `hasEdges()` | `() → Promise<boolean>` | Nhanh check graph có empty không |
| `getStats()` | `() → Promise<Stats>` | Count + type distribution |

### 4.3 Index

| Function | Signature | Mô tả |
|----------|-----------|-------|
| `buildAdjacencyIndex(edges)` | `(Edge[]) → Map` | Map<sessionId, Neighbor[]> — bidirectional |
| `createEdgeId()` | `() → string` | `edge_${Date.now()}_${random}` |

### 4.4 Eviction (khi vượt 1000 edges)

Evict edges có `strength` thấp nhất (chuẩn bị cho Phase 3). Fallback: evict cũ nhất.

```javascript
function evictWeakestEdges(edges, maxEdges = KG_MAX_EDGES) {
    if (edges.length <= maxEdges) return edges;

    // Sort by strength ASC, then by createdAt ASC (oldest first for tie-break)
    const sorted = [...edges].sort((a, b) => {
        const diff = (a.strength || 1.0) - (b.strength || 1.0);
        return diff !== 0 ? diff : (a.createdAt || 0) - (b.createdAt || 0);
    });

    // Keep the strongest, remove the weakest
    return sorted.slice(sorted.length - maxEdges);
}
```

---

## 5. Adjacency Index

In-memory Map, rebuild mỗi lần load:

```javascript
function buildAdjacencyIndex(edges) {
    const index = new Map();

    for (const edge of edges) {
        // Bidirectional — edge A→B tạo 2 entries
        if (!index.has(edge.sourceId)) index.set(edge.sourceId, []);
        if (!index.has(edge.targetId)) index.set(edge.targetId, []);

        index.get(edge.sourceId).push({
            edgeId: edge.edgeId,
            neighborId: edge.targetId,
            type: edge.type,
            strength: edge.strength
        });

        index.get(edge.targetId).push({
            edgeId: edge.edgeId,
            neighborId: edge.sourceId,
            type: edge.type,
            strength: edge.strength
        });
    }

    return index;
}
```

---

## 6. Dedup Rule

Khi `addEdge()`, check trùng bằng pair `(sourceId, targetId)` + `type`:
- Nếu đã tồn tại → update `confidence`, `strength` (lấy max), `explanation` → không tạo mới
- Nếu cùng pair nhưng khác type → cho phép (1 pair có thể vừa "extends" vừa "similar")

---

## 7. File Changes Summary

| File | Thay đổi |
|------|---------|
| `storage/knowledge_graph.js` | **[NEW]** ~200 lines |
| `bridge/types.js` | **[MODIFY]** +2 lines (constants) |

---

## 8. Verification

Test trong Chrome DevTools (service worker console):

```javascript
const kg = await import('./storage/knowledge_graph.js');

// 1. Add edge
await kg.addEdge({
    edgeId: kg.createEdgeId(), sourceId: 'A', targetId: 'B',
    type: 'extends', confidence: 0.8, strength: 1.0,
    createdAt: Date.now(), createdBy: 'auto'
});

// 2. Load & verify
console.assert((await kg.loadEdges()).length === 1);

// 3. Adjacency
const idx = kg.buildAdjacencyIndex(await kg.loadEdges());
console.assert(idx.has('A') && idx.has('B'));

// 4. Neighbors
const neighbors = await kg.getNeighbors('A');
console.assert(neighbors.length === 1 && neighbors[0].neighborId === 'B');

// 5. Remove
await kg.removeEdge((await kg.loadEdges())[0].edgeId);
console.assert((await kg.loadEdges()).length === 0);

console.log('✅ Phase 0 — All checks passed');
```
