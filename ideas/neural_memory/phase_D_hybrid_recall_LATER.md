# Hybrid Recall (Graph + Vector) — Spec

> **Prerequisite:** Phase 0-3 của `neural_memory_integration_spec.md` phải hoàn thành trước (Knowledge Graph + Spreading Activation + Memory Strength).
>
> Status: **Implemented ✅**
> Date: 2026-02-11
> Author: Claude + Amo

---

## 1. Tóm tắt

Kết hợp **cosine similarity** (vector search hiện tại) với **spreading activation score** (graph) để tạo hybrid ranking tốt hơn cho Related Memory feature.

**Công thức:**
```
hybrid_score = α × cosine_similarity + (1-α) × activation_score
             = 0.6 × cosine         + 0.4 × activation
```

**Kết quả mong đợi:**
- Tìm được nội dung **liên quan logic** mà cosine bỏ lỡ (multi-hop connections)
- Giữ nguyên chất lượng tìm kiếm **giống ngữ nghĩa** (cosine vẫn chiếm 60%)
- 100% backward compatible: khi graph trống → fallback về cosine only

---

## 2. Hiện trạng cần sửa

### File chính: `services/related_memory.js`

```javascript
// Dòng 132-138 hiện tại — 100% cosine
const related = await window.SemanticSearchService.findRelatedToPage(
    pageContext,
    MEMORY_CONFIG.maxResults
);
const strongMatches = related.filter(r => r.similarity >= MEMORY_CONFIG.minSimilarity);
```

**Vấn đề:** `findRelatedToPage()` chỉ dùng cosine similarity. Không biết gì về graph connections.

---

## 3. Kiến trúc Hybrid Recall

### 3.1 Flow diagram

```
                 pageContext (url, title, content)
                         │
              ┌──────────┼──────────┐
              ▼                      ▼
    ┌──────────────────┐   ┌──────────────────┐
    │  Vector Search   │   │  Graph Recall    │
    │  (cosine sim)    │   │  (spreading act) │
    │                  │   │                  │
    │  findRelatedTo   │   │  recallForPage   │
    │  Page()          │   │  Context()       │
    └────────┬─────────┘   └────────┬─────────┘
             │                      │
             │ [{sessionId,         │ [{sessionId,
             │   similarity}]       │   activation}]
             │                      │
             └──────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │  Merge & Score   │
              │                  │
              │  hybrid_score =  │
              │  0.6×cos + 0.4×act│
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  Sort & Return   │
              │  top-K results   │
              └──────────────────┘
```

### 3.2 Score normalization

Cả hai score cần normalize về [0, 1] trước khi kết hợp:

| Source | Range gốc | Normalization |
|--------|-----------|---------------|
| Cosine similarity | 0.0 - 1.0 | Đã chuẩn |
| Activation score | 0.0 - 1.0 (seed = 1.0, decay per hop) | Đã chuẩn |

Không cần normalize thêm vì cả hai đều sẵn [0, 1].

---

## 4. Implementation chi tiết

### 4.1 Hàm mới: `hybridRecall()`

```javascript
/**
 * Hybrid recall: combines vector similarity with graph activation.
 *
 * @param {Object} pageContext - Current page context { url, title, content }
 * @param {Object} options
 * @param {number} options.alpha - Weight for cosine (default 0.6)
 * @param {number} options.maxResults - Max results to return (default 5)
 * @param {number} options.minHybridScore - Min hybrid score threshold (default 0.3)
 * @returns {Promise<Array<{ sessionId, hybridScore, cosineScore, activationScore, source }>>}
 */
async function hybridRecall(pageContext, options = {}) {
    const {
        alpha = 0.6,
        maxResults = 5,
        minHybridScore = 0.3
    } = options;

    // 1. Vector search (existing)
    let vectorResults = [];
    try {
        vectorResults = await window.SemanticSearchService.findRelatedToPage(
            pageContext,
            maxResults * 2  // Fetch more, will re-rank
        );
    } catch (err) {
        console.warn('[HybridRecall] Vector search failed:', err);
    }

    // 2. Graph recall (new — from spreading_activation.js)
    let graphResults = [];
    try {
        if (window.KnowledgeGraphService) {
            graphResults = await window.KnowledgeGraphService.recallForPageContext(pageContext);
        }
    } catch (err) {
        console.warn('[HybridRecall] Graph recall failed:', err);
    }

    // 3. Merge results by sessionId
    const merged = new Map(); // sessionId → { cosine, activation }

    for (const vr of vectorResults) {
        const sid = vr.sessionId;
        if (!merged.has(sid)) {
            merged.set(sid, { cosine: 0, activation: 0, data: vr });
        }
        merged.get(sid).cosine = vr.similarity || 0;
    }

    for (const gr of graphResults) {
        const sid = gr.sessionId;
        if (!merged.has(sid)) {
            merged.set(sid, { cosine: 0, activation: 0, data: gr });
        }
        merged.get(sid).activation = gr.activation || 0;
    }

    // 4. Compute hybrid scores
    const scored = [];
    for (const [sessionId, { cosine, activation, data }] of merged) {
        const hybridScore = alpha * cosine + (1 - alpha) * activation;

        if (hybridScore >= minHybridScore) {
            scored.push({
                sessionId,
                hybridScore: Math.round(hybridScore * 1000) / 1000,
                cosineScore: Math.round(cosine * 1000) / 1000,
                activationScore: Math.round(activation * 1000) / 1000,
                source: cosine > 0 && activation > 0 ? 'both'
                      : cosine > 0 ? 'vector'
                      : 'graph',
                title: data.title || '',
                url: data.url || '',
                preview: data.preview || ''
            });
        }
    }

    // 5. Sort by hybrid score descending
    scored.sort((a, b) => b.hybridScore - a.hybridScore);

    return scored.slice(0, maxResults);
}
```

### 4.2 Sửa `checkForRelatedMemory()` trong `related_memory.js`

```diff
 async function checkForRelatedMemory(pageContext, apiKey, callGeminiAPI, options = {}) {
     // ... existing validation, cooldown, dismiss checks ...

     try {
-        // Find related content
-        const related = await window.SemanticSearchService.findRelatedToPage(
-            pageContext,
-            MEMORY_CONFIG.maxResults
-        );
-
-        // Filter by higher threshold
-        const strongMatches = related.filter(r => r.similarity >= MEMORY_CONFIG.minSimilarity);
+        // Hybrid recall: vector + graph (fallback to vector-only if graph unavailable)
+        let strongMatches;
+
+        if (window.KnowledgeGraphService && await window.KnowledgeGraphService.hasEdges()) {
+            // Hybrid mode
+            strongMatches = await hybridRecall(pageContext, {
+                maxResults: MEMORY_CONFIG.maxResults,
+                minHybridScore: 0.4
+            });
+        } else {
+            // Fallback: vector-only (backward compatible)
+            const related = await window.SemanticSearchService.findRelatedToPage(
+                pageContext,
+                MEMORY_CONFIG.maxResults
+            );
+            strongMatches = related
+                .filter(r => r.similarity >= MEMORY_CONFIG.minSimilarity)
+                .map(r => ({
+                    ...r,
+                    hybridScore: r.similarity,
+                    cosineScore: r.similarity,
+                    activationScore: 0,
+                    source: 'vector'
+                }));
+        }

         if (strongMatches.length === 0) {
             return null;
         }

         // Generate connection explanation for top match
+        // Include graph path info if available
         const connection = await generateConnectionExplanation(
             pageContext,
             strongMatches[0],
             apiKey,
             callGeminiAPI,
             options
         );

         return {
             matches: strongMatches,
             connection: connection,
+            recallMode: strongMatches[0]?.source === 'both' ? 'hybrid' : 'vector',
             currentPage: {
                 title: pageContext.title || '',
                 url: pageContext.url || ''
             }
         };
     } catch (err) {
         console.error('[RelatedMemory] Check failed:', err);
         return null;
     }
 }
```

### 4.3 Dependency: `KnowledgeGraphService.recallForPageContext()`

Hàm này phải có sẵn từ Phase 2 (Spreading Activation Engine). Signature cần thiết:

```javascript
/**
 * Recall memories related to current page via knowledge graph.
 *
 * 1. Find sessions matching page (by URL/topicKey)
 * 2. Run spreading activation from each seed
 * 3. Return activated sessions sorted by activation score
 *
 * @param {Object} pageContext - { url, title, topicKey? }
 * @returns {Promise<Array<{ sessionId, activation, path, hops }>>}
 */
async function recallForPageContext(pageContext) { ... }

/**
 * Check if graph has any edges (used for hybrid/fallback decision).
 * @returns {Promise<boolean>}
 */
async function hasEdges() { ... }
```

---

## 5. Config & Tuning

### 5.1 Tuning parameters

| Parameter | Default | Range | Ý nghĩa |
|-----------|---------|-------|----------|
| `alpha` | 0.6 | 0.0 - 1.0 | Trọng số cosine. 1.0 = chỉ cosine, 0.0 = chỉ graph |
| `minHybridScore` | 0.3 | 0.1 - 0.8 | Threshold tối thiểu để hiển thị kết quả |
| `maxResults` | 5 | 1 - 10 | Số kết quả trả về |

### 5.2 Tại sao α = 0.6?

- **Cosine ưu tiên hơn** vì hầu hết sessions đều có embedding (vector sẵn sàng). Graph mới, có thể chưa đủ edges ban đầu.
- Khi graph lớn lên, có thể giảm α xuống 0.5 hoặc 0.4 (tăng vai trò graph)
- Nên expose trong settings page để user/developer tune sau

### 5.3 Edge cases

| Tình huống | Behavior |
|------------|----------|
| Graph trống (0 edges) | Fallback 100% cosine (backward compatible) |
| Session chỉ có vector, không có graph edge | `activation = 0`, `hybrid = α × cosine` |
| Session chỉ có graph edge, không có embedding | `cosine = 0`, `hybrid = (1-α) × activation` |
| Cả hai = 0 | Bị filter bởi `minHybridScore` |

---

## 6. Reinforcement khi user tương tác

Khi user click vào kết quả related memory → reinforce edges trên đường đi:

```javascript
/**
 * Reinforce graph edges when user interacts with recalled memory.
 * Called when user clicks "Keep" / "View" on related memory toast.
 *
 * @param {string} sourceSessionId - Current session
 * @param {string} targetSessionId - Clicked related session
 * @param {string} recallSource - "vector" | "graph" | "both"
 */
async function reinforceOnInteraction(sourceSessionId, targetSessionId, recallSource) {
    if (recallSource === 'vector' || recallSource === 'both') {
        // User confirmed relevance → maybe create edge if not exists
        await KnowledgeGraphService.ensureEdge(sourceSessionId, targetSessionId, {
            type: 'similar',
            confidence: 0.7,
            createdBy: 'user_interaction'
        });
    }

    if (recallSource === 'graph' || recallSource === 'both') {
        // Reinforce existing edges on the activation path
        await KnowledgeGraphService.reinforcePathEdges(
            sourceSessionId,
            targetSessionId,
            0.1  // boost
        );
    }
}
```

---

## 7. File Changes Summary

| File | Thay đổi |
|------|---------|
| `services/related_memory.js` | Thêm `hybridRecall()`, sửa `checkForRelatedMemory()` |
| `services/spreading_activation.js` | Expose `recallForPageContext()` (đã có từ Phase 2) |
| `storage/knowledge_graph.js` | Expose `hasEdges()` (đã có từ Phase 0) |

### Dependencies cần có trước

| Phase | File | Phải có |
|-------|------|---------|
| P0 | `storage/knowledge_graph.js` | `loadEdges()`, `hasEdges()` |
| P2 | `services/spreading_activation.js` | `recallForPageContext()` |
| P3 | Strength fields | Để activation dùng strength-weighted traversal |

---

## 8. Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| `hybridRecall()` total | < 200ms | Vector ~100ms + Graph ~50ms + Merge ~5ms |
| Vector search alone | < 150ms | Hiện tại đã đạt |
| Graph recall alone | < 50ms | Spreading activation trên 500 edges |
| Score computation | < 5ms | Simple arithmetic |

---

## 9. Metrics

| Metric | Mục tiêu | Đo bằng |
|--------|----------|---------|
| Hybrid results clicked rate | > 35% (vs. ~25% cosine-only) | Track click events |
| Results from "both" sources | > 20% of displayed results | `source` field |
| Graph-only finds (cosine missed) | > 10% of useful results | `source === 'graph'` |
| Fallback rate | < 5% after Phase 0-3 stable | Count fallback triggers |
