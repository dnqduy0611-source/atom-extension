# AMOISEKAI — NEURALMEMORY V2 (COHERENCE & CONSISTENCY) SPEC

**Date:** 2026-02-28  
**Status:** Draft for implementation  
**Owner:** Narrative/AI Systems Team  
**Primary Goal:** Xây dựng memory architecture giúp cốt truyện liền mạch, có chiều sâu, ít mâu thuẫn, thích nghi theo từng playstyle user.

---

## 1) Product Goals

## 1.1 Core outcomes
1. **Coherence:** Chapter sau không phá logic chapter trước.
2. **Consistency:** Nhân vật, world rules, consequences nhất quán dài hạn.
3. **Depth:** Plot threads có buildup/payoff, không bị “quên”.
4. **Adaptivity:** Câu chuyện đổi nhịp theo playstyle riêng của mỗi user.

## 1.2 Non-goals (v2)
- Không build multi-player shared world.
- Không build fully autonomous long-term planner vượt ngoài story session.
- Không thay toàn bộ writer pipeline hiện tại trong 1 lần.

---

## 2) Vấn đề hiện tại (Problem Statement)

NeuralMemory hiện tại có nền tốt nhưng chưa đủ mạnh ở 4 điểm:
1. Retrieval thiên về semantic similarity, thiếu causal relevance.
2. Không có contradiction gate chuẩn trước khi publish chapter.
3. Plot threads chưa được quản lý như first-class objects.
4. Personalization theo playstyle chưa ảnh hưởng rõ lên planning layer.

---

## 3) Architecture Overview (V2)

NeuralMemory V2 gồm **4 lớp memory + 2 lớp control**:

1. **Episodic Memory** — event log theo thời gian (ai làm gì, hậu quả gì)
2. **Semantic Memory** — facts/canon ổn định (world rules, entity facts)
3. **Character/Relation Memory** — quan hệ động (trust, fear, debt, secrets)
4. **Playstyle Memory** — profile hành vi user (combat/politics/explore/romance...)
5. **Contradiction Guard** — chặn mâu thuẫn trước output
6. **Thread Orchestrator** — theo dõi mở/đóng plot thread

---

## 4) Data Model (Canonical)

## 4.1 `memory_events` (episodic)
- `id` (uuid)
- `story_id`
- `user_id`
- `chapter_id`
- `scene_id`
- `event_type` (`combat`, `dialogue`, `discovery`, `betrayal`, `world_shift`, ...)
- `actors` (jsonb)
- `targets` (jsonb)
- `location_id`
- `summary`
- `causes` (array[event_id])
- `effects` (array[event_id])
- `stakes_delta` (jsonb)
- `salience_score` (float 0..1)
- `created_at`

## 4.2 `memory_facts` (semantic)
- `id`
- `scope` (`global_world`, `story`, `character`, `faction`)
- `scope_id`
- `fact_key` (e.g. `archon_fragment_unique`)
- `fact_value` (jsonb)
- `confidence` (0..1)
- `source_event_id`
- `valid_from_chapter`
- `valid_to_chapter` (nullable)
- `is_canon_locked` (bool)
- `updated_at`

## 4.3 `character_states`
- `id`
- `story_id`
- `character_id`
- `public_persona` (jsonb)
- `private_motives` (jsonb)
- `relationship_state` (jsonb map character->scores)
- `arc_phase` (`intro`, `tension`, `fracture`, `resolution`, ...)
- `consistency_tags` (jsonb)
- `last_updated_chapter`

## 4.4 `plot_threads`
- `id`
- `story_id`
- `thread_type` (`mystery`, `revenge`, `romance`, `faction_war`, ...)
- `title`
- `status` (`open`, `active`, `dormant`, `resolved`, `abandoned`)
- `priority` (1..5)
- `introduced_chapter`
- `last_progress_chapter`
- `expected_payoff_window` (jsonb: min/max chapters)
- `linked_entities` (jsonb)
- `resolution_conditions` (jsonb)

## 4.5 `playstyle_profiles`
- `user_id`
- `story_id`
- `style_vector` (jsonb, normalized)
  - `combat`, `exploration`, `strategy`, `social`, `romance`, `darkness_tolerance`, `risk_appetite`
- `choice_behavior_stats` (jsonb)
- `pace_preference` (`fast`, `balanced`, `slow_burn`)
- `last_recomputed_at`

## 4.6 `consistency_violations`
- `id`
- `story_id`
- `chapter_id`
- `violation_type` (`canon_conflict`, `character_ooc`, `timeline_conflict`, `thread_drop`)
- `severity` (`low`, `medium`, `high`, `critical`)
- `details`
- `suggested_fix`
- `resolved` (bool)

---

## 5) Retrieval V2 (Hybrid + Scoring)

## 5.1 Retrieval sources
1. **Vector retrieval**: semantic similar context
2. **Graph traversal**: causal chain, character links, thread dependencies
3. **Relational filters**: chapter window, entity scope, canon lock

## 5.2 Composite scoring formula

`final_score = 0.30*semantic + 0.20*causal + 0.15*character + 0.15*thread + 0.10*recency + 0.10*salience`

Where:
- `semantic`: cosine similarity
- `causal`: match with event causes/effects chain
- `character`: overlap actor/target + relationship relevance
- `thread`: overlap unresolved active threads
- `recency`: time decay by chapter distance
- `salience`: precomputed significance

## 5.3 Retrieval contract for Planner/Writer
Output structure:
- `must_use_facts[]` (canon locks)
- `high_relevance_events[]`
- `active_threads[]`
- `character_constraints[]`
- `playstyle_hints[]`

---

## 6) Contradiction Guard Pipeline

Run **before final chapter output**.

## 6.1 Checks
1. **Canon conflict check**
2. **Character consistency check**
3. **Timeline/order check**
4. **Thread continuity check**

## 6.2 Violation policy
- `low`: log only
- `medium`: rewrite suggestion
- `high`: force one rewrite pass
- `critical`: block publish, escalate to planner rewrite

## 6.3 Rewrite strategy
- Patch minimal conflicting paragraphs (do not regenerate full chapter if avoidable)
- Preserve style tone of original prose

---

## 7) Plot Thread Orchestrator

## 7.1 Thread lifecycle
`open -> active -> dormant -> resolved`

Rules:
- Thread `open` > N chapters without progress => auto-flag `thread_drop_risk`
- High-priority thread must receive progress within configurable window
- Resolution must satisfy `resolution_conditions`

## 7.2 Chapter planning constraint
Mỗi chapter phải:
- advance ít nhất 1 active thread **hoặc**
- intentionally deepen 1 character arc with explicit future hook

---

## 8) Playstyle Adaptation Engine

## 8.1 Input signals
- Choice categories
- Free-input intent class
- Encounter engagement pattern
- Session length/drop points

## 8.2 Adaptation outputs
- Choice bundle composition (e.g. 2 combat + 1 diplomacy + 1 risky wildcard)
- Pacing profile
- Consequence framing (hard/soft)
- Scene density (action vs introspection)

## 8.3 Safety bounds
- Không overfit: luôn giữ diversity floor cho story richness
- Không phá canon chỉ để chiều preference

---

## 9) Integration with Current Amoisekai Pipeline

## 9.1 Existing nodes impact
- `orchestrator`: enrich pipeline_input with V2 memory package
- `planner`: must honor `must_use_facts` + `active_threads`
- `writer`: consume `character_constraints` + `playstyle_hints`
- `critic`: add consistency dimension score

## 9.2 New modules (proposed)
1. `app/memory/retrieval_v2.py`
2. `app/memory/thread_orchestrator.py`
3. `app/memory/contradiction_guard.py`
4. `app/memory/playstyle_profiler.py`
5. `app/memory/memory_curator.py` (batch summarizer/compressor)

---

## 10) APIs / Internal Contracts

## 10.1 `build_memory_package(story_id, chapter_context)`
Returns:
```json
{
  "must_use_facts": [],
  "high_relevance_events": [],
  "active_threads": [],
  "character_constraints": [],
  "playstyle_hints": []
}
```

## 10.2 `run_contradiction_guard(chapter_draft, memory_package)`
Returns:
```json
{
  "status": "pass|rewrite_required|blocked",
  "violations": [],
  "rewrite_directives": []
}
```

## 10.3 `update_playstyle_profile(user_id, story_id, chapter_trace)`
- incremental update after each chapter

---

## 11) Memory Curation & Compression

## 11.1 Why
Long stories will cause memory bloat and retrieval noise.

## 11.2 Strategy
- Every 5 chapters: summarize low-salience event clusters
- Keep raw events immutable; store compact overlays for retrieval
- Archive dormant threads snapshot

## 11.3 Anti-loss rule
Never delete canon-locked facts or unresolved thread anchors.

---

## 12) Performance Targets

1. Retrieval package latency p95 < 250ms (excluding LLM calls)
2. Contradiction guard pass latency p95 < 400ms
3. Additional token overhead per chapter < +20%
4. Memory DB growth controlled with curation cycle

---

## 13) Quality Metrics (KPIs)

## 13.1 Coherence KPIs
- `contradiction_rate` per 100 chapters
- `critical_block_rate`
- `thread_drop_rate` (open threads neglected beyond window)

## 13.2 Personalization KPIs
- `choice_acceptance_rate` by style bundle
- `chapter_completion_rate`
- `D7 retention` / `D30 retention` delta after V2

## 13.3 Narrative Depth KPIs
- avg thread lifespan with meaningful progression
- payoff satisfaction score (survey/internal judge)

---

## 14) Rollout Plan

## Phase 1 — Foundation (1-2 weeks)
- Implement schemas + retrieval_v2 scoring
- Log-only contradiction guard
- Basic playstyle profile computation

## Phase 2 — Enforcement (2 weeks)
- Enable rewrite_required for high severity conflicts
- Activate thread orchestrator constraints in planner
- Add memory curation batch jobs

## Phase 3 — Optimization (2+ weeks)
- Tune scoring weights via offline eval
- A/B test personalization strategies
- Add reranker for top-k memory precision

---

## 15) Risk & Mitigation

1. **Over-constrained creativity**
   - Mitigation: allow controlled novelty budget each chapter.

2. **Latency increase**
   - Mitigation: cache memory_package by story/chapter checkpoint.

3. **Profile overfitting**
   - Mitigation: exploration factor in playstyle adaptation.

4. **Too many false contradiction flags**
   - Mitigation: severity calibration + human-reviewed eval set.

---

## 16) Definition of Done (V2)

- Hybrid retrieval package live in planner/writer path.
- Contradiction guard blocks critical conflicts.
- Thread orchestrator prevents silent plot-thread abandonment.
- Playstyle adaptation influences choice/pacing without breaking canon.
- KPIs measurable with dashboard/report pipeline.

---

## 17) Recommended Tech Stack

## Storage
- PostgreSQL + pgvector (recommended first)
- Optional graph extension (Apache AGE) or Neo4j sidecar (phase 2+)

## Retrieval
- ANN vector index + graph traversal + SQL filter fusion
- Optional reranker (cross-encoder) for top-20 -> top-5 refinement

## Orchestration
- Keep existing FastAPI/LangGraph pipeline
- Add V2 memory services as pre/post processing nodes

---

## 18) Immediate Next Tasks (Execution Checklist)

1. Create migration files for 6 new tables.
2. Implement `retrieval_v2.py` with composite score.
3. Add `plot_threads` CRUD + planner integration.
4. Add contradiction guard in draft->final path.
5. Add telemetry events for new KPIs.
6. Run 50-chapter replay benchmark to compare V1 vs V2.
