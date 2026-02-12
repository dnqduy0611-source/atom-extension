# Neural Memory Integration — ATOM Extension V2.8

> Lấy cảm hứng từ [nhadaututtheky/neural-memory](https://github.com/nhadaututtheky/neural-memory): bộ nhớ liên kết cho AI agents, hoạt động theo cơ chế spreading activation giống não người.

Status: **Draft**
Date: 2026-02-10
Author: Claude + Amo

---

## 1. Tóm tắt

Spec này tổng hợp 3 ý tưởng cốt lõi từ dự án NeuralMemory và áp dụng vào kiến trúc ATOM Extension hiện tại:

| # | Ý tưởng | Mô tả ngắn | Tận dụng code có sẵn |
|---|---------|-------------|----------------------|
| A | **Spreading Activation** | Gợi nhớ multi-hop: A→B→C thay vì chỉ tìm giống | `connection_detector.js`, `semantic_search.js` |
| B | **Memory Strength & Decay** | Memories có "sức mạnh", yếu dần nếu không revisit | `srq_store.js`, `reading_session.js` |
| C | **Explicit Relationship Graph** | Edges có type (SUPPORTS, CONTRADICTS, EXTENDS…) dùng được | `connection_detector.js` (đang bỏ phí) |

**Không lấy gì:** Python codebase, FastAPI server, MCP integration, CLI, heavy graph DB.
**Nguyên tắc:** Tất cả chạy client-side trên `chrome.storage.local` + `IndexedDB`. Zero backend.

---

## 2. Hiện trạng — Cái đang có nhưng chưa nối

### 2.1 Code có sẵn nhưng chưa kích hoạt

| File | Có gì | Vấn đề |
|------|-------|--------|
| `services/connection_detector.js` | Detect 5 relationship types, lưu max 500 connections vào `atom_connections_v1` | **Không ai gọi** `detectConnections()`. Code tồn tại nhưng disconnected khỏi flow chính |
| `services/related_memory.js` | Surface related sessions khi đọc trang mới | Chỉ show toast → dismiss → **không lưu** connection. Kết quả bay mất |
| `storage/reading_session.js` | Session có `connections[]` array, `metrics.assessmentMetrics` | Array `connections[]` luôn rỗng. Metrics chưa bao giờ được populate |

### 2.2 Gaps chính

| Gap | Mô tả |
|-----|-------|
| **No graph layer** | Connections lưu flat list, không có adjacency lookup. Không thể traverse A→B→C |
| **No memory strength** | Cards/sessions chỉ có timestamp, không có "strength" hoặc "importance" score |
| **No decay** | SRQ eviction theo FIFO (cứ cũ nhất bị xóa), không quan tâm đến giá trị/relevance |
| **1-hop only** | Semantic search trả kết quả 1 bước nhảy (cosine similarity). Không chain |
| **Embedding quá thô** | 1 embedding/session (768-dim). Không có per-highlight embedding |
| **Silo storage** | SRQ cards, sessions, notes, journal, flashcards — tách rời, không cross-reference |

---

## 3. Kiến trúc đề xuất

### 3.1 Tổng quan

```
┌─────────────────────────────────────────────────┐
│                 USER READS PAGE                 │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Reading Session Created    │
│   (existing flow)            │
└──────────────┬───────────────┘
               │
     ┌─────────┼──────────┐
     ▼         ▼          ▼
┌─────────┐ ┌──────┐ ┌────────────────┐
│ SRQ     │ │Vector│ │Knowledge Graph │  ← NEW
│ Card    │ │Store │ │(edges + index) │
└─────────┘ └──────┘ └───────┬────────┘
                             │
                    ┌────────┼────────┐
                    ▼        ▼        ▼
              ┌─────────┐ ┌────┐ ┌────────┐
              │Spreading│ │Decay│ │Recall  │
              │Activation│ │Timer│ │Ranking │
              └─────────┘ └────┘ └────────┘
                    │        │        │
                    └────────┼────────┘
                             ▼
                    ┌────────────────┐
                    │  Sidepanel UI  │
                    │ "Gợi nhớ liên │
                    │  quan" widget  │
                    └────────────────┘
```

### 3.2 Storage footprint

| Store | Backend | Giới hạn | Ghi chú |
|-------|---------|----------|---------|
| Knowledge Graph edges | `chrome.storage.local` key `atom_knowledge_graph_v1` | Max 1000 edges | ~150KB at most |
| Adjacency index | In-memory (rebuilt on load) | Lazy build | Map<nodeId, Set<edgeId>> |
| Memory strength | Inline field trên sessions + SRQ cards | No extra storage | `strength: 0.0-1.0` |
| Decay schedule | `chrome.storage.local` key `atom_decay_schedule_v1` | Max 500 entries | Next-review timestamps |

**Tổng overhead:** ~200KB thêm vào `chrome.storage.local` (quota = 10MB, hiện dùng ~2-3MB).

---

## 4. Pillar A — Knowledge Graph + Spreading Activation

### 4.1 Data Schema: Edge

```javascript
/**
 * Knowledge Graph Edge
 * Stored in: atom_knowledge_graph_v1 (chrome.storage.local)
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

  // Strength (NeuralMemory-inspired)
  strength: 1.0,                        // 0.0 - 1.0, decays over time
  activationCount: 0,                   // times this edge was traversed in recall
  lastActivatedAt: null,                // timestamp of last activation

  // Metadata
  createdAt: 1707550000000,
  createdBy: "auto",                    // "auto" | "user" | "enrichment"
  similarity: 0.78                      // original cosine similarity
}
```

### 4.2 Adjacency Index (in-memory)

```javascript
// Rebuilt on service worker / sidepanel startup
// Map<sessionId, Array<{ edgeId, targetId, type, strength }>>
const adjacencyIndex = new Map();

// Build from edges array
function buildAdjacencyIndex(edges) {
  const index = new Map();
  for (const edge of edges) {
    // Bidirectional
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

### 4.3 Spreading Activation Algorithm

```javascript
/**
 * Spreading activation recall
 *
 * Bắt đầu từ 1 session (seed), lan truyền activation qua graph.
 * Mỗi bước: activation * edge.strength * decay_factor
 * Dừng khi: activation < threshold HOẶC maxHops reached
 *
 * @param {string} seedSessionId - Starting session
 * @param {Object} options
 * @param {number} options.maxHops - Max traversal depth (default: 3)
 * @param {number} options.minActivation - Stop threshold (default: 0.1)
 * @param {number} options.decayFactor - Activation decay per hop (default: 0.6)
 * @param {string[]} options.preferTypes - Prefer edge types (e.g., ["extends", "applies"])
 * @returns {Array<{ sessionId, activation, path, hops }>} Activated memories sorted by activation
 */
function spreadingActivation(seedSessionId, options = {}) {
  const {
    maxHops = 3,
    minActivation = 0.1,
    decayFactor = 0.6,
    preferTypes = null
  } = options;

  const activated = new Map(); // sessionId → { activation, path, hops }
  const queue = [{ sessionId: seedSessionId, activation: 1.0, path: [], hops: 0 }];

  while (queue.length > 0) {
    // Sort by activation descending (best-first)
    queue.sort((a, b) => b.activation - a.activation);
    const current = queue.shift();

    if (current.activation < minActivation) continue;
    if (current.hops > maxHops) continue;

    // Skip seed itself
    if (current.sessionId !== seedSessionId) {
      const existing = activated.get(current.sessionId);
      if (!existing || existing.activation < current.activation) {
        activated.set(current.sessionId, {
          activation: current.activation,
          path: current.path,
          hops: current.hops
        });
      }
    }

    // Get neighbors
    const neighbors = adjacencyIndex.get(current.sessionId) || [];

    for (const neighbor of neighbors) {
      if (current.path.includes(neighbor.neighborId)) continue; // No cycles

      // Type preference bonus
      let typeBonus = 1.0;
      if (preferTypes && preferTypes.includes(neighbor.type)) {
        typeBonus = 1.3;
      }

      const nextActivation = current.activation * neighbor.strength * decayFactor * typeBonus;

      if (nextActivation >= minActivation) {
        queue.push({
          sessionId: neighbor.neighborId,
          activation: nextActivation,
          path: [...current.path, current.sessionId],
          hops: current.hops + 1
        });
      }
    }
  }

  // Sort by activation descending
  return Array.from(activated.entries())
    .map(([sessionId, data]) => ({ sessionId, ...data }))
    .sort((a, b) => b.activation - a.activation);
}
```

### 4.4 Auto-detect connections (kích hoạt code đang bỏ phí)

**Trigger points:**

| Event | Action | File |
|-------|--------|------|
| Session tạo mới + có ≥1 highlight | Chạy `detectConnections()` (background, debounce 30s) | `background.js` |
| SRQ card approved | Tạo edge giữa card's session và related sessions | `background.js` |
| User xem "Related" toast | Lưu connection nếu user clicks "Keep" | `sidepanel.js` |

**Implementation — Hook vào existing flow:**

```javascript
// background.js — thêm vào handler "SAVE_READING_SESSION"
case "SAVE_READING_SESSION": {
  // ... existing save logic ...

  // NEW: Auto-detect connections (fire-and-forget)
  if (session.highlights.length >= 1) {
    setTimeout(async () => {
      try {
        const connections = await window.ConnectionDetectorService
          .detectConnections(session.id, apiKey, callGeminiAPI);
        if (connections.length > 0) {
          await KnowledgeGraphService.addEdges(connections);
        }
      } catch (e) {
        console.warn('[KnowledgeGraph] Auto-detect failed:', e);
      }
    }, 30000); // 30s debounce
  }
  break;
}
```

---

## 5. Pillar B — Memory Strength & Decay

### 5.1 Strength Model

Mỗi memory (session, SRQ card, edge) có `strength` field:

```javascript
{
  strength: 1.0,           // khởi tạo = 1.0
  lastReinforcedAt: Date.now(),
  reinforceCount: 0,       // số lần được "nhắc lại"
  decayRate: 0.05          // tốc độ quên (configurable per type)
}
```

**Forgetting curve đơn giản:**

```javascript
/**
 * Ebbinghaus-inspired decay function
 * strength_now = initial_strength * e^(-decayRate * daysSinceLastReinforce)
 *
 * @param {number} initialStrength - Strength at last reinforcement (0-1)
 * @param {number} daysSince - Days since last reinforcement
 * @param {number} decayRate - Decay rate (default 0.05)
 * @returns {number} Current strength (0-1)
 */
function computeCurrentStrength(initialStrength, daysSince, decayRate = 0.05) {
  return initialStrength * Math.exp(-decayRate * daysSince);
}
```

**Reinforcement events (tăng strength):**

| Event | Strength boost | Ghi chú |
|-------|---------------|---------|
| User revisit page (same topicKey) | +0.2 (cap 1.0) | Via `reading_session.js` |
| User highlight on related page | +0.1 | Via `srq_enricher.js` |
| Spreading activation traverses edge | +0.05 | Via recall |
| User manually marks "important" | Set to 1.0 | Future UI action |
| SRQ card approved | +0.15 | Via `srq_store.js` |

### 5.2 Decay Scheduler

```javascript
/**
 * Runs periodically (every 6 hours via chrome.alarms)
 * Recalculates strength for all edges and sessions
 * Cleans up dead memories (strength < 0.05)
 */
async function runDecayCycle() {
  const edges = await loadEdges();
  const now = Date.now();
  const updated = [];
  const dead = [];

  for (const edge of edges) {
    const daysSince = (now - (edge.lastReinforcedAt || edge.createdAt)) / 86400000;
    const newStrength = computeCurrentStrength(
      edge.strength || 1.0,
      daysSince,
      edge.decayRate || 0.05
    );

    if (newStrength < 0.05) {
      dead.push(edge.edgeId);
    } else {
      edge.strength = Math.round(newStrength * 100) / 100;
      updated.push(edge);
    }
  }

  // Save updated, remove dead
  await saveEdges(updated);

  console.log(`[Decay] Updated ${updated.length} edges, removed ${dead.length} dead`);
}
```

### 5.3 Smart Eviction (thay thế FIFO)

Hiện tại SRQ dùng FIFO — cũ nhất bị xóa trước. Thay bằng **strength-based eviction**:

```javascript
/**
 * Evict weakest cards instead of oldest
 * Only evicts exported/dismissed cards (preserve learning content)
 */
function evictByStrength(cards) {
  if (cards.length < SRQ_MAX_CARDS) return cards;

  const evictable = cards
    .filter(c => ["exported", "dismissed"].includes(c.status))
    .sort((a, b) => (a.strength || 0) - (b.strength || 0)); // weakest first

  const toRemove = new Set();
  for (const card of evictable) {
    if (cards.length - toRemove.size < SRQ_MAX_CARDS) break;
    toRemove.add(card.cardId);
  }

  return cards.filter(c => !toRemove.has(c.cardId));
}
```

---

## 6. Pillar C — Explicit Relationships in UI

### 6.1 Non-tech Friendly Labels (critical UX requirement)

| Internal type | English UI | Vietnamese UI | Icon |
|---------------|-----------|---------------|------|
| `supports` | Backs up | Củng cố | ✅ |
| `contradicts` | Conflicts with | Mâu thuẫn với | ⚠️ |
| `extends` | Builds on | Mở rộng từ | ➕ |
| `similar` | Related to | Liên quan đến | 🔗 |
| `applies` | Used in | Áp dụng vào | 🔧 |

### 6.2 Relationship UI — "Knowledge Map" card in Sidepanel

Hiển thị trong Sidepanel tab "Saved highlights" dưới mỗi SRQ card:

```
┌─────────────────────────────────────┐
│ 📄 React Hooks Deep Dive            │
│ react.dev · 3 highlights · 2 days   │
│                                     │
│ 🔗 Connected to:                    │
│  ➕ Builds on "JavaScript Closures" │
│  🔧 Used in "Todo App Project"      │
│  ✅ Backs up "State Management"     │
│                                     │
│ [See connections] [Explore deeper]  │
└─────────────────────────────────────┘
```

**"Explore deeper" (Khám phá thêm)** → triggers spreading activation:

```
┌─────────────────────────────────────┐
│ 🧠 Deeper connections               │
│                                     │
│ From "React Hooks" we found:        │
│                                     │
│ 1 hop: JavaScript Closures (92%)    │
│ 2 hops: Functional Programming (71%)│
│        via JavaScript Closures      │
│ 2 hops: Todo App Project (65%)      │
│        via State Management         │
│                                     │
│ [Close]                             │
└─────────────────────────────────────┘
```

### 6.3 i18n keys cần thêm

```json
// _locales/en/messages.json
{
  "kg_connected_to": { "message": "Connected to" },
  "kg_builds_on": { "message": "Builds on" },
  "kg_backs_up": { "message": "Backs up" },
  "kg_conflicts_with": { "message": "Conflicts with" },
  "kg_related_to": { "message": "Related to" },
  "kg_used_in": { "message": "Used in" },
  "kg_explore_deeper": { "message": "Explore deeper" },
  "kg_deeper_connections": { "message": "Deeper connections" },
  "kg_from_we_found": { "message": "From \"$TITLE$\" we found:" },
  "kg_hop_via": { "message": "via $SOURCE$" },
  "kg_no_connections": { "message": "No connections yet" },
  "kg_memory_strength": { "message": "Memory strength" },
  "kg_fading": { "message": "Fading" },
  "kg_strong": { "message": "Strong" },
  "kg_review_suggested": { "message": "Review suggested" }
}
```

```json
// _locales/vi/messages.json
{
  "kg_connected_to": { "message": "Kết nối với" },
  "kg_builds_on": { "message": "Mở rộng từ" },
  "kg_backs_up": { "message": "Củng cố" },
  "kg_conflicts_with": { "message": "Mâu thuẫn với" },
  "kg_related_to": { "message": "Liên quan đến" },
  "kg_used_in": { "message": "Áp dụng vào" },
  "kg_explore_deeper": { "message": "Khám phá thêm" },
  "kg_deeper_connections": { "message": "Kết nối sâu hơn" },
  "kg_from_we_found": { "message": "Từ \"$TITLE$\" chúng tôi tìm thấy:" },
  "kg_hop_via": { "message": "qua $SOURCE$" },
  "kg_no_connections": { "message": "Chưa có kết nối" },
  "kg_memory_strength": { "message": "Độ nhớ" },
  "kg_fading": { "message": "Đang mờ dần" },
  "kg_strong": { "message": "Nhớ rõ" },
  "kg_review_suggested": { "message": "Nên ôn lại" }
}
```

---

## 7. Implementation Phases

### Phase 0 — Foundation: Knowledge Graph Store (1-2 ngày)

**Mục tiêu:** Tạo storage layer cho graph edges, không thay đổi UI.

**File mới:**
- `storage/knowledge_graph.js` — CRUD cho edges + adjacency index

**Tác vụ:**
1. Tạo `storage/knowledge_graph.js` với:
   - `loadEdges()` / `saveEdges(edges)` — chrome.storage.local
   - `addEdge(edge)` / `addEdges(edges)` — with dedup by sourceId+targetId
   - `getEdgesForSession(sessionId)` — both directions
   - `getEdgesByTopicKey(topicKey)` — query by topic
   - `removeEdge(edgeId)` / `removeWeakEdges(threshold)`
   - `buildAdjacencyIndex(edges)` — in-memory Map
   - `getStats()` — count by type
2. Thêm storage key vào `bridge/types.js`:
   ```javascript
   export const KG_EDGES_KEY = "atom_knowledge_graph_v1";
   export const KG_MAX_EDGES = 1000;
   export const KG_DECAY_ALARM = "atom_kg_decay_cycle";
   ```
3. Đăng ký trong `manifest.json` (nếu cần script mới)
4. Unit test cơ bản

**Không thay đổi:** UI, existing flows, sidepanel.

---

### Phase 1 — Kích hoạt Connection Detector (1-2 ngày)

**Mục tiêu:** Tự động detect connections khi user tạo highlights, lưu vào Knowledge Graph.

**File sửa:**
- `background.js` — hook auto-detect vào session save flow
- `services/connection_detector.js` — output edges sang Knowledge Graph format

**Tác vụ:**
1. Trong `background.js`, handler `SAVE_READING_SESSION`:
   - Sau khi save session thành công, fire-and-forget `detectAndStoreConnections()`
   - Debounce 30 giây (dùng `setTimeout`) để tránh API spam
   - Guard: chỉ chạy nếu session có ≥1 highlight VÀ có API key
2. Tạo bridge function `detectAndStoreConnections(sessionId)`:
   - Gọi `ConnectionDetectorService.detectConnections()`
   - Convert output sang edge format
   - Gọi `KnowledgeGraphService.addEdges()`
3. Thêm rate limit: max 5 detect calls/hour (tránh Gemini quota)
4. Log: `[KnowledgeGraph] Auto-detected N connections for session X`

**Không thay đổi:** UI. Edges được lưu im lặng, ready cho Phase 2.

---

### Phase 2 — Spreading Activation Engine (2-3 ngày)

**Mục tiêu:** Build recall engine, expose qua internal API.

**File mới:**
- `services/spreading_activation.js` — core algorithm

**Tác vụ:**
1. Implement `spreadingActivation(seedSessionId, options)` như mô tả ở Section 4.3
2. Implement `recallForContext(pageContext)`:
   - Tìm session matching current page
   - Chạy spreading activation từ session đó
   - Kết hợp với semantic search (hybrid: graph + vector)
   - Return top-5 memories sorted by activation score
3. Implement `recallForTopicKey(topicKey)`:
   - Tìm tất cả sessions có topicKey match
   - Chạy spreading activation từ mỗi seed
   - Merge + deduplicate results
4. Expose qua message passing: `request.type = "KG_RECALL"`
5. Benchmark: spreading activation trên 500 edges phải < 50ms

---

### Phase 3 — Memory Strength & Decay (1-2 ngày)

**Mục tiêu:** Thêm strength vào edges + sessions, setup decay cycle.

**File sửa:**
- `storage/knowledge_graph.js` — thêm strength tracking
- `storage/srq_store.js` — thêm `strength` field, sửa eviction
- `background.js` — đăng ký `chrome.alarms` cho decay cycle

**Tác vụ:**
1. Thêm `strength`, `lastReinforcedAt`, `reinforceCount` vào edge schema
2. Implement `reinforceEdge(edgeId, boost)` — tăng strength khi activated
3. Implement `reinforceByTopicKey(topicKey, boost)` — tăng khi user revisit topic
4. Implement decay cycle:
   - Đăng ký `chrome.alarms.create("atom_kg_decay_cycle", { periodInMinutes: 360 })` (6 giờ)
   - Handler: recalculate strength, remove dead edges (< 0.05)
5. Sửa `srq_store.js`:
   - Thêm `strength: 1.0` khi `addCard()`
   - Sửa `evictIfNeeded()` → sort by strength thay vì createdAt
   - Thêm `reinforceCard(cardId, boost)`
6. Hook reinforcement events:
   - Session revisit → +0.2 (trong `background.js` handler)
   - SRQ card approved → +0.15
   - Spreading activation traversal → +0.05 per edge

---

### Phase 4 — Sidepanel UI: Connections Display (2-3 ngày)

**Mục tiêu:** Hiển thị connections dưới mỗi SRQ card + "Explore deeper" button.

**File sửa:**
- `sidepanel.js` — thêm connections rendering
- `ui/components/srq_widget.js` — thêm connection chips
- `styles/srq.css.js` — styles cho connections
- `_locales/en/messages.json` — i18n keys
- `_locales/vi/messages.json` — i18n keys

**File mới:**
- `ui/components/knowledge_map.js` — "Explore deeper" modal/panel

**Tác vụ:**
1. Khi render SRQ card, load connections cho card's sessionId
2. Hiển thị max 3 connections dưới card (chips format):
   - Icon + type label + target title (truncated)
   - Click → navigate to target session
3. "Explore deeper" button:
   - Trigger spreading activation
   - Show modal với kết quả multi-hop
   - Group by hops (1 hop, 2 hops, 3 hops)
   - Show activation % as "relevance"
4. Memory strength indicator:
   - Nhỏ, subtle bar dưới card
   - Màu: green (>0.7) → yellow (0.3-0.7) → red (<0.3)
   - Tooltip: "Nhớ rõ" / "Đang mờ dần" / "Nên ôn lại"
5. i18n: thêm tất cả keys ở Section 6.3

---

### Phase 5 — Hybrid Recall: Graph + Vector (1-2 ngày)

**Mục tiêu:** Kết hợp spreading activation với semantic search cho recall tốt hơn.

**File sửa:**
- `services/related_memory.js` — upgrade để dùng hybrid recall
- `services/semantic_search.js` — optional: expose score normalization

**Tác vụ:**
1. Sửa `checkForRelatedMemory()` để dùng hybrid:
   ```
   hybrid_score = α * cosine_similarity + (1-α) * activation_score
   ```
   Với `α = 0.6` (ưu tiên semantic, graph bổ sung)
2. Khi graph có connections cho current page → boost related results
3. Khi graph không có connections → fallback 100% semantic (backward compatible)
4. Lưu connection nếu user interacts với toast (click "Keep" / "Useful")

---

### Phase 6 — Topic Hierarchy (Future/Optional)

**Mục tiêu:** Thêm parent-child relationships giữa topics.

**Ví dụ:**
```
tag:javascript
  ├── tag:react-hooks
  ├── tag:closures
  └── tag:async-await
```

**Scope:** Chỉ plan, chưa implement. Phụ thuộc vào Phase 0-5 hoàn thành.

---

## 8. File Changes Summary

### Files mới (tạo)

| File | Mô tả | Phase |
|------|--------|-------|
| `storage/knowledge_graph.js` | CRUD cho graph edges + adjacency index | P0 |
| `services/spreading_activation.js` | Spreading activation algorithm | P2 |
| `ui/components/knowledge_map.js` | "Explore deeper" UI component | P4 |

### Files sửa

| File | Thay đổi | Phase |
|------|----------|-------|
| `bridge/types.js` | Thêm KG_* constants | P0 |
| `manifest.json` | Đăng ký files mới (nếu cần) | P0 |
| `background.js` | Hook auto-detect, decay alarm, reinforcement events | P1, P3 |
| `services/connection_detector.js` | Output format → KG edge format | P1 |
| `storage/srq_store.js` | Thêm strength field, sửa eviction | P3 |
| `sidepanel.js` | Render connections, "Explore deeper" | P4 |
| `ui/components/srq_widget.js` | Connection chips UI | P4 |
| `styles/srq.css.js` | Connection + strength styles | P4 |
| `services/related_memory.js` | Hybrid recall | P5 |
| `_locales/en/messages.json` | i18n keys | P4 |
| `_locales/vi/messages.json` | i18n keys | P4 |

---

## 9. Constraints & Risks

### 9.1 Storage limits

| Resource | Limit | Mitigation |
|----------|-------|------------|
| `chrome.storage.local` | 10 MB total | Max 1000 edges (~150KB). Monitor with `chrome.storage.local.getBytesInUse()` |
| IndexedDB (VectorStore) | ~50 MB practical | Unchanged |
| In-memory adjacency index | Service worker RAM | Lazy rebuild, max 1000 nodes |

### 9.2 API budget (Gemini)

| Operation | Cost | Frequency | Budget impact |
|-----------|------|-----------|---------------|
| `detectConnections()` | 1-10 API calls/session | Max 5/hour | Medium |
| `analyzeRelationship()` | 1 call per pair | Batched | Low (existing) |
| Spreading activation | 0 API calls | Pure compute | Zero |
| Decay cycle | 0 API calls | Pure compute | Zero |

**Mitigation:** Rate limit detect to 5 calls/hour. Cache results. Spreading activation + decay are zero-cost.

### 9.3 Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| `buildAdjacencyIndex(1000 edges)` | < 10ms | O(n) |
| `spreadingActivation(500 edges, 3 hops)` | < 50ms | BFS with priority queue |
| `runDecayCycle(1000 edges)` | < 100ms | O(n) |
| `loadEdges()` from storage | < 20ms | Single chrome.storage.local.get |

### 9.4 Backward compatibility

- **Zero breaking changes**: strength fields default to 1.0 if missing
- **Gradual activation**: Feature flag `KG_ENABLED` (default false initially)
- **SRQ eviction fallback**: If no strength data, fall back to FIFO
- **Existing connection_detector.js**: Keep working as-is, just add bridge to KG

---

## 10. Metrics & Success Criteria

| Metric | Target | How to measure |
|--------|--------|----------------|
| Edges created per week | 20-50 | `KnowledgeGraphService.getStats()` |
| Spreading activation recall accuracy | User clicks related memory ≥ 30% | Track clicks on recalled items |
| Memory strength distribution | Bell curve, not all-1.0 or all-0 | Histogram of strength values |
| API calls for connection detect | < 5/hour average | Rate limit counter |
| Storage overhead | < 300KB | `chrome.storage.local.getBytesInUse()` |

---

## 11. So sánh: Trước vs. Sau

| Khía cạnh | Trước (hiện tại) | Sau (với Neural Memory) |
|-----------|-------------------|-------------------------|
| Tìm related content | Cosine similarity 1-hop | Spreading activation multi-hop |
| Memory lifecycle | FIFO eviction (cũ = xóa) | Strength-based decay (quên có chọn lọc) |
| Connection types | 5 types defined, 0 displayed | 5 types with UI labels + navigation |
| Graph structure | Flat list (no traversal) | Adjacency index (BFS/DFS) |
| Connection detection | Manual only (never called) | Auto-detect on highlight |
| Recall ranking | Similarity only | Hybrid: similarity × activation × strength |
| Storage cost | ~0 KB for connections | ~150 KB for 1000 edges |
| API cost for recall | 1 embedding call | 0 (spreading activation = pure compute) |

---

## Appendix A — Glossary

| Term | Definition |
|------|------------|
| **Spreading activation** | Thuật toán gợi nhớ: bắt đầu từ 1 node, lan truyền "activation" qua edges. Activation giảm dần mỗi hop. Giống cách não liên tưởng |
| **Memory strength** | Số 0-1 thể hiện "độ nhớ". 1.0 = vừa học, giảm dần theo thời gian. Tăng lại khi revisit |
| **Decay** | Quá trình strength giảm theo thời gian (Ebbinghaus forgetting curve) |
| **Reinforcement** | Sự kiện làm tăng strength: revisit, highlight, approve card |
| **Edge** | Một kết nối giữa 2 sessions trong Knowledge Graph, có type + strength |
| **Adjacency index** | Cấu trúc in-memory cho phép lookup nhanh: "session X nối với ai?" |
| **Hybrid recall** | Kết hợp vector similarity + graph activation để rank results |

## Appendix B — NeuralMemory Feature Map

| NeuralMemory Feature | ATOM Equivalent | Status |
|----------------------|-----------------|--------|
| Spreading activation recall | `services/spreading_activation.js` | Phase 2 |
| Memory decay (forgetting curve) | Decay cycle via `chrome.alarms` | Phase 3 |
| Explicit relationship types | `connection_detector.js` CONNECTION_TYPES | Phase 1 (activate existing) |
| Memory consolidation | Merge weak edges with same topic | Phase 6 (future) |
| Content validation | PII check in `srq_enricher.js` | Already exists |
| MCP integration | N/A (Chrome extension, not AI editor) | Skip |
| CLI interface | N/A (has sidepanel UI) | Skip |
| FastAPI server | N/A (client-side only) | Skip |
| Graph database | `chrome.storage.local` + in-memory index | Phase 0 |
| Brain isolation | topicKey system (tag:/dom:/kw:) | Already exists |
