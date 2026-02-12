# Consolidation (Prune + Merge) — Spec

> **Prerequisite:** Phase 0-3 + Phase D (Hybrid Recall) hoàn thành. Graph cần ổn định ít nhất 2-4 tuần.
>
> Status: **Draft — THỰC HIỆN SAU**
> Date: 2026-02-11
> Author: Claude + Amo

---

## 1. Tóm tắt

Sau vài tháng sử dụng, Knowledge Graph tích lũy **rác**: edges yếu, edges trùng, sessions mồ côi. Consolidation tự động dọn dẹp giống cách não bỏ đi ký ức không cần thiết.

**3 chiến lược:**

| Strategy | Mô tả | Tần suất |
|----------|-------|----------|
| **Prune** | Xóa edges yếu (strength < 0.05) + sessions mồ côi | Mỗi 24 giờ |
| **Merge** | Gộp edges trùng source+target | Mỗi 7 ngày |
| **Summarize** | Tạo "concept clusters" từ nhóm sessions cùng topic | Mỗi 14 ngày |

---

## 2. Strategy A — Prune (Dọn rác)

### 2.1 Mục tiêu

Xóa edges có strength quá thấp sau thời gian dài không ai truy cập.

### 2.2 Điều kiện prune

Một edge bị prune khi **tất cả** điều kiện sau đúng:

```javascript
const shouldPrune =
    edge.strength < PRUNE_THRESHOLD          // < 0.05
    && daysSinceLastActive >= MIN_INACTIVE_DAYS  // >= 7 ngày
    && !isBridgeEdge(edge)                   // Không phải cầu nối duy nhất
    && !isProtected(edge);                   // Không được user đánh dấu quan trọng
```

### 2.3 Bridge edge protection

**Bridge edge** = edge duy nhất nối session A với phần còn lại của graph. Xóa nó → session A bị cô lập.

```javascript
/**
 * Check if edge is the only connection for its source or target.
 * Bridge edges should not be pruned even when weak.
 *
 * @param {Object} edge - Edge to check
 * @param {Map} adjacencyIndex - Current adjacency index
 * @returns {boolean} True if this is a bridge edge
 */
function isBridgeEdge(edge, adjacencyIndex) {
    const sourceNeighbors = adjacencyIndex.get(edge.sourceId) || [];
    const targetNeighbors = adjacencyIndex.get(edge.targetId) || [];

    // If removing this edge would isolate either node
    return sourceNeighbors.length <= 1 || targetNeighbors.length <= 1;
}
```

### 2.4 Orphan cleanup

Sau khi prune edges, check sessions không còn edge nào → xóa khỏi adjacency index (không xóa session data — chỉ xóa khỏi graph).

### 2.5 Implementation

```javascript
/**
 * Prune weak edges and orphaned graph entries.
 *
 * @param {Object} options
 * @param {number} options.pruneThreshold - Min strength to keep (default: 0.05)
 * @param {number} options.minInactiveDays - Days inactive before eligible (default: 7)
 * @param {boolean} options.dryRun - If true, report only, don't delete
 * @returns {Promise<PruneReport>}
 */
async function pruneWeakEdges(options = {}) {
    const {
        pruneThreshold = 0.05,
        minInactiveDays = 7,
        dryRun = false
    } = options;

    const edges = await loadEdges();
    const adjacencyIndex = buildAdjacencyIndex(edges);
    const now = Date.now();

    const kept = [];
    const pruned = [];

    for (const edge of edges) {
        const lastActive = edge.lastActivatedAt || edge.lastReinforcedAt || edge.createdAt;
        const daysSince = (now - lastActive) / 86400000;

        const shouldPrune =
            (edge.strength || 1.0) < pruneThreshold
            && daysSince >= minInactiveDays
            && !isBridgeEdge(edge, adjacencyIndex)
            && edge.createdBy !== 'user';  // User-created edges protected

        if (shouldPrune) {
            pruned.push(edge);
        } else {
            kept.push(edge);
        }
    }

    if (!dryRun && pruned.length > 0) {
        await saveEdges(kept);
    }

    return {
        total: edges.length,
        pruned: pruned.length,
        kept: kept.length,
        prunedEdgeIds: pruned.map(e => e.edgeId)
    };
}
```

---

## 3. Strategy B — Merge (Gộp trùng lặp)

### 3.1 Mục tiêu

Khi cùng source+target có nhiều edges (ví dụ: auto-detect tạo "similar", user click tạo thêm "extends") → gộp thành 1 edge mạnh hơn.

### 3.2 Merge rule

```
Trước:
  Session_A ──similar──→ Session_B   (strength: 0.3)
  Session_A ──extends──→ Session_B   (strength: 0.5)

Sau merge:
  Session_A ──extends──→ Session_B   (strength: 0.65)
                                      └── giữ type có strength cao nhất
                                          strength = max + 0.5 * sum(others)
                                          cap at 1.0
```

### 3.3 Implementation

```javascript
/**
 * Merge duplicate edges between same source-target pairs.
 *
 * Rules:
 * - Keep the edge with highest strength
 * - Boost strength: max_strength + 0.5 * sum(other strengths), cap at 1.0
 * - Keep the type of the strongest edge
 * - Merge activationCount
 * - Update explanation to note merge
 *
 * @param {boolean} dryRun - If true, report only
 * @returns {Promise<MergeReport>}
 */
async function mergeDuplicateEdges(dryRun = false) {
    const edges = await loadEdges();

    // Group by normalized pair (smaller ID first for consistency)
    const pairMap = new Map(); // "sourceId|targetId" → [edges]

    for (const edge of edges) {
        const pairKey = [edge.sourceId, edge.targetId].sort().join('|');
        if (!pairMap.has(pairKey)) {
            pairMap.set(pairKey, []);
        }
        pairMap.get(pairKey).push(edge);
    }

    const merged = [];
    let mergeCount = 0;

    for (const [pairKey, group] of pairMap) {
        if (group.length === 1) {
            merged.push(group[0]);
            continue;
        }

        // Sort by strength descending — keep strongest
        group.sort((a, b) => (b.strength || 0) - (a.strength || 0));
        const winner = { ...group[0] };

        // Boost strength from absorbed edges
        const otherStrengths = group.slice(1).reduce((sum, e) => sum + (e.strength || 0), 0);
        winner.strength = Math.min(1.0, (winner.strength || 0) + 0.5 * otherStrengths);
        winner.strength = Math.round(winner.strength * 100) / 100;

        // Merge activation counts
        winner.activationCount = group.reduce((sum, e) => sum + (e.activationCount || 0), 0);

        // Note the merge
        winner.explanation = `[Merged ${group.length} edges] ${winner.explanation || ''}`;

        merged.push(winner);
        mergeCount += group.length - 1;
    }

    if (!dryRun && mergeCount > 0) {
        await saveEdges(merged);
    }

    return {
        totalBefore: edges.length,
        totalAfter: merged.length,
        edgesMerged: mergeCount
    };
}
```

---

## 4. Strategy C — Summarize (Concept Clusters)

### 4.1 Mục tiêu

Khi nhiều sessions cùng topicKey được nối với nhau → tạo "cluster node" đại diện. Giúp spreading activation tìm cả nhóm thay vì chỉ 1 session.

### 4.2 Clustering logic

```
Phát hiện:
  Session "React Hooks Guide" ──extends──→ Session "React State"
  Session "React Effects"     ──similar──→ Session "React State"
  Session "React Performance" ──extends──→ Session "React Hooks Guide"

→ Cluster: { topicKey: "tag:react", sessions: [4 sessions] }
→ Tạo summary edge: Cluster_React ──contains──→ mỗi session
```

### 4.3 Implementation

```javascript
/**
 * Discover topic clusters and create summary metadata.
 * Does NOT create new edges — stores cluster info in a separate key.
 *
 * @param {Object} options
 * @param {number} options.minClusterSize - Min sessions per cluster (default: 3)
 * @param {number} options.topicOverlapThreshold - Min % overlap (default: 0.4)
 * @returns {Promise<Array<Cluster>>}
 */
async function discoverClusters(options = {}) {
    const { minClusterSize = 3, topicOverlapThreshold = 0.4 } = options;

    const edges = await loadEdges();
    const adjacencyIndex = buildAdjacencyIndex(edges);

    // Group sessions by topicKey prefix
    const topicGroups = new Map(); // topicKeyPrefix → Set<sessionId>

    for (const edge of edges) {
        const sourcePrefix = extractTopicPrefix(edge.sourceTopicKey);
        const targetPrefix = extractTopicPrefix(edge.targetTopicKey);

        if (sourcePrefix) {
            if (!topicGroups.has(sourcePrefix)) topicGroups.set(sourcePrefix, new Set());
            topicGroups.get(sourcePrefix).add(edge.sourceId);
        }
        if (targetPrefix) {
            if (!topicGroups.has(targetPrefix)) topicGroups.set(targetPrefix, new Set());
            topicGroups.get(targetPrefix).add(edge.targetId);
        }
    }

    // Filter clusters by min size
    const clusters = [];
    for (const [topicKey, sessionIds] of topicGroups) {
        if (sessionIds.size >= minClusterSize) {
            // Calculate internal connectivity
            let internalEdges = 0;
            const ids = Array.from(sessionIds);
            for (const edge of edges) {
                if (sessionIds.has(edge.sourceId) && sessionIds.has(edge.targetId)) {
                    internalEdges++;
                }
            }

            clusters.push({
                topicKey,
                sessionIds: ids,
                sessionCount: ids.length,
                internalEdges,
                connectivity: ids.length > 1
                    ? internalEdges / (ids.length * (ids.length - 1) / 2)
                    : 0
            });
        }
    }

    // Save cluster metadata
    await chrome.storage.local.set({
        atom_kg_clusters_v1: {
            clusters,
            lastUpdated: Date.now()
        }
    });

    return clusters;
}

function extractTopicPrefix(topicKey) {
    if (!topicKey) return null;
    // "tag:react-hooks" → "tag:react"
    // "dom:react.dev" → "dom:react.dev"
    // "kw:javascript" → "kw:javascript"
    const parts = topicKey.split(':');
    if (parts.length < 2) return topicKey;
    return topicKey; // Keep full key for now, refine later
}
```

---

## 5. Scheduler — Chạy tự động

### 5.1 Chrome Alarms

```javascript
// background.js — đăng ký khi extension install/update
chrome.runtime.onInstalled.addListener(() => {
    // Prune: mỗi 24 giờ
    chrome.alarms.create('atom_kg_prune', { periodInMinutes: 1440 });

    // Merge: mỗi 7 ngày
    chrome.alarms.create('atom_kg_merge', { periodInMinutes: 10080 });

    // Summarize: mỗi 14 ngày
    chrome.alarms.create('atom_kg_summarize', { periodInMinutes: 20160 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    switch (alarm.name) {
        case 'atom_kg_prune': {
            const report = await ConsolidationService.pruneWeakEdges();
            console.log(`[Consolidation] Pruned ${report.pruned} edges`);
            break;
        }
        case 'atom_kg_merge': {
            const report = await ConsolidationService.mergeDuplicateEdges();
            console.log(`[Consolidation] Merged ${report.edgesMerged} edges`);
            break;
        }
        case 'atom_kg_summarize': {
            const clusters = await ConsolidationService.discoverClusters();
            console.log(`[Consolidation] Found ${clusters.length} clusters`);
            break;
        }
    }
});
```

### 5.2 Feature flag

```javascript
// Consolidation chỉ chạy khi:
// 1. KG_ENABLED = true (từ Phase 0)
// 2. Graph có >= 50 edges (đủ data để consolidate)
// 3. Graph đã tồn tại >= 14 ngày (đủ decay data)

async function shouldRunConsolidation() {
    const settings = await chrome.storage.local.get([
        'atom_kg_enabled',
        'atom_knowledge_graph_v1',
        'atom_kg_first_edge_at'
    ]);

    if (!settings.atom_kg_enabled) return false;

    const edges = settings.atom_knowledge_graph_v1 || [];
    if (edges.length < 50) return false;

    const firstEdge = settings.atom_kg_first_edge_at || Date.now();
    const graphAgeDays = (Date.now() - firstEdge) / 86400000;
    if (graphAgeDays < 14) return false;

    return true;
}
```

---

## 6. File mới

| File | Mô tả |
|------|-------|
| `services/consolidation.js` | Prune, Merge, Summarize functions |

### Dependencies

| Phase | Cần có |
|-------|--------|
| P0 | `storage/knowledge_graph.js` — `loadEdges()`, `saveEdges()`, `buildAdjacencyIndex()` |
| P3 | Strength + decay fields trên edges |
| `background.js` | `chrome.alarms` handlers |

---

## 7. Safety

| Risk | Mitigation |
|------|-----------|
| Prune xóa nhầm edge quan trọng | Bridge protection + user-created edges immune + `dryRun` mode |
| Merge mất thông tin | Giữ explanation gốc, chỉ merge strength/count |
| Summarize tạo cluster sai | Cluster chỉ là metadata (separate storage key), không sửa edges |
| Service worker bị kill giữa chừng | Mỗi operation atomic (load → compute → save một lần) |

---

## 8. Metrics

| Metric | Target |
|--------|--------|
| Edges pruned per cycle | 5-15% of total (healthy decay) |
| Edges merged per cycle | < 5% (few duplicates normal) |
| Clusters discovered | 3-10 after 1 month use |
| Storage freed per prune | ~10-20KB |
| Consolidation runtime | < 200ms total |
