# Phase 2 — Spreading Activation Engine

> **Status:** Sẵn sàng implement
> **Date:** 2026-02-11
> **Prerequisite:** Phase 0 (KG Store) ✅, Phase 1 (Connection Detector) ✅
> **Ref:** [00_overview.md](./00_overview.md) §4.3

---

## 1. Mục tiêu

Tạo recall engine dùng spreading activation — lan truyền "activation energy" qua graph edges để tìm connected memories multi-hop.

**Zero API cost** — pure client-side compute.

**Output:** `window.SpreadingActivationService` cho sidepanel sử dụng.

---

## 2. API

### `spreadingActivation(seedId, adjacencyIndex, options)`
Core algorithm. BFS with priority queue.

**Params:**
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `seedId` | string | required | Starting session ID |
| `adjacencyIndex` | Map | required | From `buildAdjacencyIndex()` |
| `maxHops` | number | 3 | Max traversal depth |
| `minActivation` | number | 0.1 | Stop threshold |
| `decayFactor` | number | 0.6 | Activation decay per hop |
| `preferTypes` | string[] | null | Boost these edge types ×1.3 |

**Returns:** `Array<{ sessionId, activation, path, hops }>` sorted by activation DESC.

### `recallForSession(sessionId, options)`
Convenience: load edges → build index → run spreading activation.

### `recallForPageContext(pageContext, options)`
Find sessions matching current page → run activation from each → merge results.

### `getNeighborSummary(sessionId)`
Quick 1-hop summary for UI display ("Connected to: 3 sessions").

---

## 3. Implementation

### File: `services/spreading_activation.js` (IIFE)

```javascript
(function () {
    'use strict';

    const KG_KEY = 'atom_knowledge_graph_v1';

    // ─── Adjacency Index (duplicated from knowledge_graph.js for IIFE context) ──
    function buildAdjacencyIndex(edges) { /* same as Phase 0 */ }

    // ─── Core Algorithm ──
    function spreadingActivation(seedId, adjacencyIndex, options = {}) {
        // BFS with priority queue
        // Returns: [{ sessionId, activation, path, hops }]
    }

    // ─── Convenience ──
    async function recallForSession(sessionId, options = {}) {
        const edges = await loadEdgesFromStorage();
        const index = buildAdjacencyIndex(edges);
        return spreadingActivation(sessionId, index, options);
    }

    async function recallForPageContext(pageContext, options = {}) {
        // Find matching session(s) via ReadingSessionService
        // Run activation from each seed
        // Merge + deduplicate
    }

    // ─── Export ──
    window.SpreadingActivationService = {
        spreadingActivation,
        recallForSession,
        recallForPageContext,
        buildAdjacencyIndex,
        getNeighborSummary
    };
})();
```

### Load in `sidepanel.html`

```html
<script src="services/spreading_activation.js"></script>
```

After `connection_detector.js`, before `sidepanel.js`.

---

## 4. File Changes

| File | Thay đổi |
|------|---------|
| `services/spreading_activation.js` | **[NEW]** ~180 lines |
| `sidepanel.html` | **[MODIFY]** +1 script tag |

---

## 5. Decisions

| Quyết định | Lý do |
|------------|-------|
| IIFE (not ES module) | Sidepanel context uses `window.*` services |
| Duplicate `buildAdjacencyIndex` | Can't import ES module from IIFE |
| No message passing yet | Direct `window.*` call from sidepanel — simpler for now |
| `recallForPageContext` uses `ReadingSessionService` | Already available as window global |

---

## 6. Verification

```javascript
// Sidepanel console:
console.log('Service:', !!window.SpreadingActivationService);

// With test data:
const result = await SpreadingActivationService.recallForSession('session_xxx');
console.log('Recall:', result);
```
