# Phase 1 — Activate Connection Detector

> **Status:** Sẵn sàng implement
> **Date:** 2026-02-11
> **Prerequisite:** Phase 0 (Knowledge Graph Store) ✅
> **Ref:** [00_overview.md](./00_overview.md) §2.1, §4

---

## 1. Mục tiêu

Kích hoạt `connection_detector.js` (đang bị bỏ phí) và nối output vào Knowledge Graph Store.

**Hiện trạng:**
- `connection_detector.js` loaded trong `sidepanel.html` → `window.ConnectionDetectorService`
- `detectConnections(sessionId, apiKey, callGeminiAPI)` → dùng `SemanticSearchService` + Gemini API
- Output lưu vào `atom_connections_v1` (flat list, max 500) — **không ai đọc**
- Hàm `detectConnections()` **không ai gọi**

**Kết quả mong muốn:**
- Tự động chạy `detectConnections()` khi user kết thúc session (`endSession()`)
- Convert output → KG edges → lưu vào `atom_knowledge_graph_v1`
- Rate limit: max 3 calls/hour (tránh spam Gemini)
- Không ảnh hưởng UX (chạy fire-and-forget)

---

## 2. Approach: Bridge trong `sp_export.js`

Thay vì tạo file mới, hook vào `endSession()` trong `sp_export.js` — nơi session kết thúc tự nhiên.

### Why `endSession()`:
- Session đã có đủ highlights + insights (data tốt nhất cho analysis)
- User đã xong → không gây lag
- `activeSessionId` + `apiKey` + `callGeminiAPI` đều available

---

## 3. Implementation

### 3.1 Thêm bridge function: `detectAndStoreConnections()`

```javascript
// In sp_export.js (or new sp_knowledge_graph.js)

async function detectAndStoreConnections(sessionId) {
    if (!sessionId) return;
    if (!window.ConnectionDetectorService) return;

    // Rate limit check
    const now = Date.now();
    const RATE_KEY = 'atom_kg_detect_timestamps';
    const MAX_PER_HOUR = 3;
    
    const { [RATE_KEY]: timestamps = [] } = await chrome.storage.local.get([RATE_KEY]);
    const recentCalls = timestamps.filter(t => (now - t) < 3600000);
    if (recentCalls.length >= MAX_PER_HOUR) {
        console.log('[KG] Rate limit: skipping connection detection');
        return;
    }

    const apiKey = await SP.getApiKey();
    if (!apiKey) return;

    try {
        // Fire detectConnections (existing code)
        const connections = await window.ConnectionDetectorService.detectConnections(
            sessionId, apiKey, SP.callGeminiAPI
        );

        if (!connections || connections.length === 0) return;

        // Import KG store (ES module import via dynamic import won't work in IIFE context)
        // → Use chrome.storage.local directly with same key as knowledge_graph.js
        const KG_KEY = 'atom_knowledge_graph_v1';
        const KG_MAX = 1000;

        const { [KG_KEY]: existingEdges = [] } = await chrome.storage.local.get([KG_KEY]);

        // Convert connections → KG edges
        for (const conn of connections) {
            const edge = {
                edgeId: conn.id || `edge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                sourceId: conn.sourceId,
                targetId: conn.targetId,
                type: conn.type,
                confidence: conn.confidence,
                explanation: conn.explanation,
                strength: 1.0,
                activationCount: 0,
                lastActivatedAt: null,
                createdAt: conn.createdAt || Date.now(),
                createdBy: conn.createdBy || 'auto',
                similarity: conn.similarity || 0
            };

            // Dedup check
            const duplicate = existingEdges.find(e =>
                e.sourceId === edge.sourceId &&
                e.targetId === edge.targetId &&
                e.type === edge.type
            );

            if (duplicate) {
                // Update existing
                duplicate.confidence = Math.max(duplicate.confidence || 0, edge.confidence);
                duplicate.strength = Math.max(duplicate.strength || 0, edge.strength);
                duplicate.explanation = edge.explanation || duplicate.explanation;
            } else {
                existingEdges.push(edge);
            }
        }

        // Evict if needed
        let finalEdges = existingEdges;
        if (finalEdges.length > KG_MAX) {
            finalEdges.sort((a, b) => (a.strength ?? 1) - (b.strength ?? 1));
            finalEdges = finalEdges.slice(finalEdges.length - KG_MAX);
        }

        await chrome.storage.local.set({ [KG_KEY]: finalEdges });

        // Update rate limit timestamps
        recentCalls.push(now);
        await chrome.storage.local.set({ [RATE_KEY]: recentCalls.slice(-10) });

        console.log(`[KG] Stored ${connections.length} edges (total: ${finalEdges.length})`);
    } catch (err) {
        console.error('[KG] detectAndStoreConnections failed:', err);
    }
}
```

### 3.2 Hook vào `endSession()`

```diff
 async function endSession() {
     // ... existing code ...
     await exportSession();
+
+    // Fire-and-forget: detect connections and store to KG
+    const sessionIdForKG = SP.activeSessionId;
+    if (sessionIdForKG) {
+        detectAndStoreConnections(sessionIdForKG).catch(err => {
+            console.warn('[KG] Background connection detection failed:', err);
+        });
+    }

     // Clear session data
     threads.length = 0;
     // ... rest of existing code ...
 }
```

---

## 4. File Changes Summary

| File | Thay đổi |
|------|---------|
| `sp_export.js` | **[MODIFY]** +80 lines: `detectAndStoreConnections()` + hook in `endSession()` |

**Không cần file mới, không sửa manifest.**

---

## 5. Decisions

| Quyết định | Lý do |
|------------|-------|
| Hook ở `endSession()` | Session hoàn chỉnh nhất, user đã xong nên không lag |
| Fire-and-forget | Không block UI, connection detection có thể fail/skip |
| Rate limit 3/hour | `detectConnections()` gọi Gemini cho mỗi candidate → tránh API cost |
| Duplicate KG constants | IIFE context không import ES module → dùng literal strings |
| Giữ `atom_connections_v1` | Backward compat, connection_detector vẫn ghi vào đó |

---

## 6. Verification

1. Load extension, highlight vài nội dung, click "Finish session"
2. Chrome DevTools → Application → Storage → `atom_knowledge_graph_v1`
3. Verify edges xuất hiện với đúng format
4. Verify rate limit: finish 4 sessions liên tiếp → session 4 bị skip

```javascript
// Quick verify in sidepanel console:
const { atom_knowledge_graph_v1: edges } = await chrome.storage.local.get(['atom_knowledge_graph_v1']);
console.log('KG edges:', edges?.length, edges);
```
