# AMOISEKAI — PHASE 2 MMO INFRA + AGENT COUNCIL SPEC (MVP)

**Date:** 2026-03-01  
**Status:** Draft (implementation-oriented)  
**Depends on:** `PHASE2_MMO_WORLD_SIM_SPEC.md`, `AGENT_COUNCIL_SPEC.md`, `NEURALMEMORY_V2_COHERENCE_SPEC.md`

---

## 1) Executive Answer (Cloud Sync?)

## Q: Có cần sync cloud không?
**A: Có, bắt buộc** nếu muốn MMO thật.

Lý do ngắn gọn:
1. Cần **world state chung** cho nhiều người chơi.
2. Cần **server-authoritative** để chống cheat/exploit.
3. Cần **tick simulation tập trung** + persistence liên phiên/thiết bị.
4. Cần broadcast world update theo realm.

Không cloud sync => chỉ là pseudo-MMO (mỗi client 1 thế giới), không thể quyết định cục diện chung.

---

## 2) MVP Scope (6-8 tuần)

## In-scope
- 1-2 realms production
- Shared world state (faction + territory + global meters)
- Influence ingestion + anti-exploit cơ bản
- Tick simulation mỗi 15 phút
- Story feedback loop từ world context
- **Agent Council v2 cho MMO decisions**

## Out-of-scope
- realtime PvP combat đa người
- economy auction house full stack
- cross-realm war phức tạp

---

## 3) System Architecture (MVP)

## 3.1 Services
1. **API Gateway** (public API + auth)
2. **Story Engine** (existing, extended with world_context)
3. **World Sim Service** (new)
4. **Influence Service** (new)
5. **Council Service** (new, can be internal worker first)
6. **Realtime Feed Service** (SSE/WebSocket)
7. **Scheduler/Worker** (tick jobs, curation jobs)

## 3.2 Data/Infra
- PostgreSQL (authoritative)
- Redis (queue, cache, throttling)
- Object storage (optional logs/artifacts)
- Monitoring stack (Prometheus/Grafana or hosted equivalent)

## 3.3 Event bus
MVP: Redis Streams  
Scale-up: Kafka/NATS

---

## 4) Minimal Deployment Topology

## 4.1 Environment tiers
- **dev**: single VM + docker-compose
- **staging**: 2 app nodes + managed Postgres + Redis
- **prod**: 3 app nodes (gateway/story/world workers), managed DB + Redis

## 4.2 Runtime suggestion
- Python FastAPI for Story + World + Influence endpoints
- Separate worker process for tick + council batch decisions
- Reverse proxy (Nginx/Caddy/Cloudflare)

---

## 5) Data Contracts (MVP)

## 5.1 Internal event: `impact_candidate`
```json
{
  "event_id": "uuid",
  "realm_id": "realm-1",
  "user_id": "u-123",
  "story_id": "s-123",
  "chapter_id": "c-012",
  "action_type": "faction_quest_complete",
  "faction_id": "empire",
  "base_points": 25,
  "evidence": {"risk": 4, "stakes": "regional"},
  "created_at": "ISO8601"
}
```

## 5.2 Internal event: `world_tick_result`
```json
{
  "realm_id": "realm-1",
  "tick_number": 1042,
  "faction_deltas": {"empire": 1.2, "veil": -0.7},
  "territory_changes": [{"territory_id":"t-3","from":"veil","to":"empire"}],
  "trigger_fired": ["age_of_iron"],
  "snapshot_id": "snap-1042"
}
```

---

## 6) Agent Council in MMO (New Layer)

## 6.1 Why council is needed in MMO
Single-agent decisions trong MMO dễ gây:
- imbalance world outcome
- unfair exploit acceptance
- narrative incoherence across realms

Council dùng để tăng chất lượng quyết định ở các điểm **high impact**.

## 6.2 Council invocation policy
Chỉ gọi council khi thuộc 1 trong các nhóm:
1. `world-impact score >= threshold`
2. trigger có thể đổi cục diện realm
3. sovereign action request
4. conflict giữa canon vs player-impact

Default low-impact action: fast path, không gọi council.

## 6.3 MMO Council members (v1)
1. **World Governor Agent**
   - kiểm tra macro balance world/faction
2. **Fairness Judge Agent**
   - kiểm tra anti-whale, anti-spam, anti-exploit
3. **Lore Consistency Agent**
   - chặn outcome phá canon world
4. **Narrative Impact Agent**
   - đảm bảo outcome có payoff narrative (không dry numbers)
5. **Risk Sentinel Agent**
   - phát hiện pattern bất thường, yêu cầu quarantine

Orchestrator quyết định final verdict theo weighted vote + hard veto rules.

---

## 7) Council Decision Protocol

## 7.1 Input envelope
```json
{
  "decision_type": "sovereign_action|major_trigger|impact_dispute",
  "realm_id": "realm-1",
  "proposed_change": {},
  "world_snapshot": {},
  "supporting_events": [],
  "risk_flags": [],
  "lore_constraints": []
}
```

## 7.2 Output contract
```json
{
  "final_verdict": "approve|modify|reject|quarantine",
  "confidence": 0.0,
  "reasons": [],
  "required_modifications": [],
  "audit_tags": ["balance", "canon_safe"]
}
```

## 7.3 Hard veto rules
Nếu một trong các rule vi phạm => reject/quarantine:
- Canon lock violation
- Exploit suspicion high
- Realm collapse risk above threshold

---

## 8) Anti-Exploit Pipeline (MVP)

1. Validate event schema + signature/idempotency key
2. Rate-limit per user/device/session
3. Detect duplicate/replay pattern
4. Score anomaly (velocity + entropy)
5. Route:
   - low risk -> accepted
   - medium -> council review async
   - high -> quarantine

---

## 9) Story Integration Rules

Story Engine receives `world_context` payload:
- current faction ranking
- local territory control near player thread
- active world trigger summary
- player contribution recap

Planner must:
- weave world impact naturally
- preserve personal arc continuity
- avoid injecting irrelevant global noise every chapter

---

## 10) APIs (MVP)

## Public
- `GET /api/world/{realm}/summary`
- `GET /api/world/{realm}/stream`
- `GET /api/world/{realm}/contribution/me`

## Internal
- `POST /internal/influence/submit`
- `POST /internal/world/tick/run`
- `POST /internal/council/review`
- `POST /internal/world/apply-decision`

---

## 11) Security & Trust (must-have)

1. JWT auth required for all write endpoints
2. Service-to-service auth token for `/internal/*`
3. Input schema strict validation
4. Server-only scoring; client cannot submit normalized points
5. Immutable audit log for council decisions
6. Redaction for sensitive logs

---

## 12) Observability

## Metrics
- tick duration p95
- influence accepted/rejected ratio
- council invocation rate
- quarantine rate
- world event lag

## Tracing
- correlation id from player action -> impact event -> tick -> story feedback

## Alerts
- tick stalled > 2 cycles
- sudden anomaly spikes
- council reject rate abnormal

---

## 13) Cost Envelope (rough MVP)

Depends on DAU and council frequency.

### Infra baseline (small production)
- Managed Postgres + Redis + 2-3 app nodes: **~150–500 USD/month**

### AI Council cost
- Keep council only for high-impact decisions (e.g. 5-15% events)
- Estimated **~100–800 USD/month** at early-mid scale, configurable by thresholds/model choice

Total early range: **~250–1300 USD/month** (before large-scale growth)

---

## 14) Rollout Plan

## Week 1-2
- World tables + influence ingestion + simple tick
- single realm, no council (log-only)

## Week 3-4
- Add Council Service (review-only, no hard block)
- Add audit logs + contribution recap

## Week 5-6
- Enable hard veto on critical rules
- Activate realtime stream + story feedback integration

## Week 7-8
- Tune thresholds, anti-exploit, fairness weights
- load test + resilience drills

---

## 15) Acceptance Criteria

- Shared world changes observed by multiple users in same realm
- Player contribution reflected in world summaries
- Council handles high-impact decisions with auditable verdicts
- No critical canon-break decisions applied in production test window
- Tick system stable for 7 consecutive days

---

## 16) Immediate Build Checklist

1. Create DB migrations for world/influence/council audit tables
2. Implement `impact_candidate -> influence_ledger` validator
3. Implement tick worker with snapshot writing
4. Add council review endpoint + orchestrator policy
5. Integrate world_context into planner input
6. Add dashboards + alerts for tick and exploit metrics

---

## 17) Final Recommendation

For Phase 2 MMO, chọn strategy:
- **Cloud sync bắt buộc**
- **Tick-based world sim** (không realtime per action)
- **Agent Council chỉ cho quyết định high-impact**

Cách này cho hiệu quả cao nhất giữa: gameplay impact, coherence, fairness, cost.
