# Semantic Top-5 Connections Implementation Plan

Reference: ideas/semantic_top5_connections_spec.md
Status: Ready for implementation
Priority: High

---

## Current State Summary
- Smart Linking uses last 5 threads (recency) in sidepanel.js.
- Semantic search exists but searchWithinDomain returns only similarity and ignores TTL.
- Embeddings are generated but not persisted to VectorStore from ReadingSessionService.

---

## Implementation Tasks

### Task 1: Semantic candidate selection (P0)
Files: sidepanel.js, services/semantic_search.js

1.1 Add gating using FeatureFlags.EMBEDDINGS_ENABLED and SEMANTIC_SEARCH_ENABLED.
1.2 Build query text from new highlight and call SemanticSearchService.searchWithinDomain(queryText, currentDomain, topK=10, { maxAgeMs }).
1.3 Normalize URL (origin + pathname) and filter out same URL as new highlight.
1.4 Map related sessions to threads by matching session.url to thread.highlight.url and keep the most recent thread per URL.
1.5 Sort by similarity desc; tie-break recency if abs(simA - simB) <= 0.01; take top 5.
1.6 Fallback to last 5 threads if dependencies missing, no results, or errors. Increment fallback metric.

Acceptance Criteria
- Semantic selection is used when flags + services are available.
- Same URL threads are excluded.
- Top 5 selection matches spec ordering rules.
- Recency fallback remains unchanged when semantic search is unavailable.

---

### Task 2: Embedding persistence and TTL filtering (P0)
Files: storage/reading_session.js, storage/vector_store.js, services/semantic_search.js, config/ai_config.js (optional)

2.1 Update ReadingSessionService.embedSession to store embeddings in VectorStore with metadata: domain, url, title, highlightCount, insightCount, timestamp.
2.2 Add TTL filtering for domain embeddings in SemanticSearchService.searchWithinDomain (default 14 days).
2.3 Add per-domain TTL override hook (e.g., searchWithinDomain options or config map).
2.4 Ensure enriched search results return url, title, domain, timestamp, and similarity.

Acceptance Criteria
- Domain search ignores embeddings older than TTL.
- Metadata is stored and retrievable for candidate mapping.

---

### Task 3: Deep Angle suggestion (P1)
Files: sidepanel.html, sidepanel.js, styles.css, _locales/en/messages.json, _locales/vi/messages.json, config/ai_config.js (optional)

3.1 Add a "Deep Angle" action in the Connections tab plus an output area.
3.2 Compute angle type from connections:
- If any contradicts with confidence >= 0.7 -> Tension
- Else if supports dominate -> Evidence
- Else -> Evolution
3.3 Generate a 1-2 sentence suggestion using gemini-3-flash-preview via callGeminiAPI with background priority.
3.4 Cache per threadId + connectionIds hash; store result on the thread and apply TTL.
3.5 Respect RateLimitManager cooldowns and 429 handling.

Acceptance Criteria
- Deep Angle only runs on demand.
- Output is cached and reused when connections do not change.
- UI updates in Connections tab without new full-screen UI.

---

### Task 4: Metrics and logging (P1)
Files: sidepanel.js

4.1 Add local metrics counters:
- connections_detected_count
- semantic_candidates_count
- deep_angle_generated_count
- fallback_to_recency_count
- embedding_api_errors
4.2 Log metrics to console and optionally persist to chrome.storage.local for debugging.

Acceptance Criteria
- Metrics increment in all success and fallback paths.

---

## File Changes Summary
- sidepanel.js: semantic candidate selection, Deep Angle logic, metrics
- sidepanel.html: Connections tab action + output container
- styles.css: Deep Angle styling
- services/semantic_search.js: TTL filtering + enriched results
- storage/reading_session.js: persist embeddings to VectorStore
- storage/vector_store.js: optional helpers for TTL or metadata
- _locales/en/messages.json: new Deep Angle strings
- _locales/vi/messages.json: new Deep Angle strings
- config/ai_config.js: optional Deep Angle cache TTL or model override
- config/feature_flags.js + sidepanel.html: wire FeatureFlags into sidepanel

---

## Implementation Order
1. Task 2 (Embedding persistence + TTL)
2. Task 1 (Semantic selection + fallback)
3. Task 3 (Deep Angle UI + LLM)
4. Task 4 (Metrics)

---

## Tests and Manual Checks
- Add a new highlight with embeddings enabled -> semantic top 5 used.
- Turn off embeddings or semantic search -> fallback to last 5.
- Same URL thread does not appear in candidates.
- Deep Angle button generates text and caches for repeated clicks.
- Verify metrics counters in console.
