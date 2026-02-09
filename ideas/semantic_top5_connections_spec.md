# Semantic Top-5 Thread Selection and Deep Angle Suggestions

Status: Draft
Date: 2026-02-03

## Summary
Replace Smart Linking candidate selection from last 5 highlights to top 5 semantically related highlights within the same domain. Exclude threads from the same URL. Add an optional Deep Angle suggestion derived from existing connections.

## Goals
- Improve connection quality by selecting semantically related highlights.
- Keep cost and latency bounded with top 5 candidates.
- Preserve existing behavior when embeddings are unavailable.
- Provide a deeper insight summary based on connections.

## Non-goals
- No cross-domain linking.
- No new UI for full knowledge graph.
- No automatic merging of threads.

## Current behavior
- analyzeConnections(newThread) selects otherThreads.slice(-5) and runs detectConnections.
- Selection is recency-based, not relevance-based.

## Proposed behavior
- Build a relevance-ranked candidate set using embeddings.
- Exclude threads whose highlight URL matches the new highlight URL (normalized origin + pathname).
- Select top 5 by similarity, tie-break by recency if similarity within epsilon.
- Fallback to last 5 when embeddings or semantic search are unavailable.

## Selection algorithm
1. Ensure embeddings feature is enabled and EmbeddingService plus VectorStore are available.
2. Compute query text from new highlight (highlight.text).
3. Use SemanticSearchService.searchWithinDomain(queryText, domain, topK=10).
4. Filter out results whose session URL matches new highlight URL.
5. Map sessions to threads by matching thread.highlight.url to session.url and pick the most recent thread per session.
6. Sort by similarity desc; if abs(simA - simB) <= 0.01 use thread.createdAt desc.
7. Take top 5 threads and pass their highlight text to detectConnections.
8. If no candidates or error, fallback to last 5 threads.

## Embedding and storage
- Use existing EmbeddingService with model text-embedding-004.
- Persist embeddings in VectorStore with metadata: domain, url, title, highlightCount, insightCount, timestamp.
- TTL policy: ignore embeddings older than 14 days when selecting candidates. Configurable per domain.
- Future: allow user-configured TTL (e.g., 30 days) for topics or areas of interest.
- In-memory LRU cache remains for per-session embedding reuse.

## Deep Angle suggestion
- Trigger: on-demand only (user clicks a "Deep Angle" action).
- Input: connection list (type, explanation, targetPreview, confidence).
- Logic:
- If any contradicts with confidence >= 0.7, angle type = Tension.
- Else if supports dominate, angle type = Evidence.
- Else if extends dominate, angle type = Evolution.
- Output: 1-2 sentence Deep Angle suggestion.
- Implementation options:
- Template-based output using the above logic.
- LLM-based output using a short prompt, cached per threadId plus connectionIds.

## Rate limit and caching
- Use RateLimitManager with background priority for embedding and Deep Angle calls.
- Cache embedding and Deep Angle outputs with TTL to avoid repeated calls.
- Skip during cooldown or on 429.

## Metrics
- connections_detected_count
- semantic_candidates_count
- deep_angle_generated_count
- fallback_to_recency_count
- embedding_api_errors

## Edge cases
- No API key or embeddings disabled yields fallback to recency.
- Vector store empty yields fallback to recency.
- Same URL only yields no candidate threads and fallback.
- Thread has no highlight text yields skip.

## Rollout
- Gate via FeatureFlags.EMBEDDINGS_ENABLED and SEMANTIC_SEARCH_ENABLED.
- Add log to confirm candidate selection path.

## Open questions
- Confirm UI placement for "Deep Angle" action (Connections tab vs Quick Actions).
