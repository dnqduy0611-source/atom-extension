# AMOISEKAI — PHASE 2 MMO WORLD SIM SPEC (v1)

**Date:** 2026-03-01  
**Status:** Draft for implementation  
**Owner:** Product + Backend + Narrative Systems

---

## 1) Vision

Biến Amoisekai từ single-player narrative thành **Shared World Narrative MMO**:

- Mỗi người chơi vẫn có story arc riêng.
- Toàn bộ người chơi cùng tác động một **World State** chung theo realm.
- Quyết định cá nhân ảnh hưởng cục diện thế giới qua cơ chế chuẩn hoá, chống phá game.

---

## 2) Product Principles

1. **Server-authoritative world:** client không quyết định world outcome.
2. **Bounded impact:** người chơi ảnh hưởng lớn nhưng không phá canon tức thời.
3. **Persistent consequences:** ảnh hưởng được lưu event-sourcing + snapshot.
4. **Fairness:** anti-bot, anti-whale-overrun, diminishing returns.
5. **Narrative coherence first:** world changes phải feed ngược vào story engine có kiểm soát.

---

## 3) Scope (Phase 2)

## In-scope (v1)
- Realm-based shared world state.
- Faction influence system.
- Territory control simulation (tick-based).
- World events/triggers theo ngưỡng.
- Influence ledger từ player actions.
- Story feedback loop (world context -> planner/writer).

## Out-of-scope (v1)
- Real-time PvP arena.
- Open-world movement simulation.
- Player-to-player economy full-stack.
- Voice/chat moderation MMO scale.

---

## 4) High-Level Architecture

1. **Story Engine Service** (đã có, mở rộng input world context)
2. **World Simulation Service** (mới)
3. **Influence Ingestion Service** (mới)
4. **Event Bus / Queue** (Redis streams hoặc RabbitMQ/Kafka tùy load)
5. **World API Gateway** (public read + protected write)
6. **Realtime Feed** (SSE/WebSocket broadcast world updates)

Flow:
- Player action -> Story Engine emits `impact_candidate` -> Influence Ingestion validates -> append `world_event` -> World Sim tick apply -> snapshot update -> push world feed -> Story Engine consume latest world context.

---

## 5) Realm Model

`realm` là đơn vị MMO độc lập (theo region/season).

- `realm_id`
- `name`
- `status` (`active`, `maintenance`, `season_end`)
- `season_id`
- `world_clock`

Mỗi user thuộc 1 realm tại 1 thời điểm (v1: cố định theo account hoặc signup cohort).

---

## 6) Core Domain Models

## 6.1 `world_state_snapshots`
- `id`
- `realm_id`
- `tick_number`
- `faction_state_json`
- `territory_state_json`
- `resource_state_json`
- `global_tension`
- `catastrophe_meter`
- `created_at`

## 6.2 `world_events` (append-only)
- `id`
- `realm_id`
- `source_type` (`player`, `system`, `gm`)
- `source_id`
- `event_type` (`influence_gain`, `territory_push`, `relic_claim`, `decree`, ...)
- `payload_json`
- `weight`
- `validity_status` (`accepted`, `quarantined`, `rejected`)
- `reason`
- `created_at`

## 6.3 `influence_ledger`
- `id`
- `realm_id`
- `user_id`
- `faction_id`
- `influence_points`
- `source_event_id`
- `normalized_points`
- `daily_cap_bucket`
- `created_at`

## 6.4 `territories`
- `id`
- `realm_id`
- `name`
- `controller_faction_id`
- `control_score_json` (per faction)
- `strategic_value`
- `instability`
- `last_changed_tick`

## 6.5 `world_triggers`
- `id`
- `realm_id`
- `trigger_key`
- `condition_json`
- `cooldown_ticks`
- `last_triggered_tick`
- `effect_json`

## 6.6 `sovereign_actions`
- `id`
- `realm_id`
- `faction_id`
- `initiator_user_id`
- `action_type`
- `cost`
- `status`
- `created_at`

---

## 7) Influence Engine (Player -> World)

## 7.1 Input sources
- Chapter outcomes
- Combat milestone results
- Faction quest completion
- Rare discovery / relic interactions
- Community campaign participation

## 7.2 Normalization formula

`normalized = base_points * quality_factor * anti_spam_factor * fairness_factor`

Where:
- `quality_factor`: dựa trên stakes + narrative significance
- `anti_spam_factor`: giảm khi hành động lặp pattern ngắn hạn
- `fairness_factor`: giảm lợi thế tuyệt đối của top spenders/whales

## 7.3 Caps
- User daily cap (hard)
- Faction burst cap per tick
- Source-type cap (anti farm by one action type)

---

## 8) World Simulation Tick

## 8.1 Tick cadence
- Default: mỗi 15 phút (configurable)
- Batch process theo realm

## 8.2 Tick steps
1. Load last snapshot
2. Pull accepted events since last tick
3. Apply influence deltas
4. Resolve territory contests
5. Update global meters
6. Evaluate world triggers
7. Emit derived events
8. Persist new snapshot

## 8.3 Conflict resolution
Nếu 2 faction tranh cùng territory:
- Weighted score from influence + strategic modifiers + instability
- Clamp change per tick để tránh flip quá nhanh

---

## 9) World Trigger System

Ví dụ trigger:
1. `age_of_iron`: Empire influence >70% trong 3 ticks liên tiếp
2. `veil_fracture`: chaos meter vượt threshold
3. `relic_storm`: 2 relic bị tranh chấp cùng tick

Trigger effect có thể:
- mở event chain toàn realm
- thay đổi quest pool
- buff/debuff faction tạm thời
- đổi style context cho story writer

---

## 10) Story Feedback Loop

Story engine mỗi chapter nhận `world_context`:
- current realm summary
- faction standings
- territory tension near player thread
- active global events
- relevant trigger effects

Planner rules:
- weave world state vào chapter hook
- không override personal arc vô lý
- ưu tiên local relevance trước global spam

Writer rules:
- refer world change khi có liên quan nhân vật/faction user
- giữ canon + timeline consistency

---

## 11) MMO Fairness & Anti-Exploit

## 11.1 Controls
- Idempotency key cho impact events
- Replay protection
- Duplicate pattern detector
- Velocity anomaly detection per user/device/session
- Quarantine queue for suspicious events

## 11.2 Diminishing returns
- Hành động giống nhau trong short window bị giảm điểm mạnh
- Khuyến khích hành vi đa dạng (combat/explore/social)

## 11.3 Sovereign action safeguards
- Limited uses / season
- Costly activation
- Cooldown
- Counterplay window cho faction đối lập

---

## 12) Realtime Delivery

## 12.1 Public world feed
- SSE/WebSocket channel per realm
- Broadcast: tick result, territory shifts, trigger alerts

## 12.2 Player-specific feed
- Personal notification when user action materially affected world
- “You contributed to X outcome” recap

---

## 13) API Surface (v1)

## 13.1 World read APIs
- `GET /api/world/{realm_id}/summary`
- `GET /api/world/{realm_id}/factions`
- `GET /api/world/{realm_id}/territories`
- `GET /api/world/{realm_id}/events?since_tick=`

## 13.2 Internal write APIs
- `POST /internal/world/impact-candidate`
- `POST /internal/world/events/ingest`
- `POST /internal/world/tick/run`

## 13.3 Realtime
- `GET /api/world/{realm_id}/stream` (SSE)

---

## 14) Storage & Infra Recommendation

## Minimum production stack
- PostgreSQL (authoritative state + event store)
- Redis (queue + cache + rate limit counters)
- FastAPI workers (ingestion + sim)
- Scheduler (cron/worker beat)

## Scale-up options
- Kafka for high throughput events
- Separate read replicas for world feed endpoints
- Realm sharding by database/schema

---

## 15) Cloud Sync Decision (Critical)

**Có — bắt buộc sync cloud nếu muốn MMO thật.**

Lý do:
1. MMO cần world state chung giữa nhiều người chơi.
2. Cần persistence + coordination liên session/device.
3. Cần tick simulation tập trung và authoritative server.

Không cloud sync thì chỉ làm được:
- pseudo-MMO local/co-op giả lập,
- không có thế giới chung đáng tin cậy.

**Tối thiểu cloud sync cần có:**
- account identity
- realm assignment
- world events ingestion
- snapshot distribution
- anti-cheat server-side validation

---

## 16) Rollout Plan

## Phase 2A (MVP MMO, 4-6 tuần)
- 1 realm
- 3 factions
- 5-8 territories
- influence ledger + 1 tick worker
- 2 world triggers
- world summary feed to story

## Phase 2B (6-10 tuần)
- multi-realm
- sovereign actions lite
- faction campaigns
- anti-exploit quarantine

## Phase 2C
- season transitions
- governance loops
- richer world economy hooks

---

## 17) KPIs

1. `% active users contributing world impact`
2. `realm event participation rate`
3. `world-state relevance score` (player cảm thấy world change có ý nghĩa)
4. `D7/D30 retention uplift vs non-MMO cohort`
5. `exploit rejection precision/recall`

---

## 18) Risks & Mitigation

1. **World chaos / narrative incoherence**
   - Mitigation: bounded impact + trigger clamps + contradiction guard.

2. **Whale domination**
   - Mitigation: normalization + caps + diminishing returns.

3. **Infra cost spike**
   - Mitigation: tick batching, snapshot caching, phased realm rollout.

4. **Latency UX issues**
   - Mitigation: async world effect (tick-based), clear recap messaging.

---

## 19) Definition of Done (Phase 2A)

- Realm world sim chạy ổn định theo tick.
- Player actions tạo influence events có kiểm chứng.
- Territory/faction state thay đổi dựa trên cộng đồng.
- Story chapter đọc được world context và phản ánh hợp lý.
- Có cloud sync production path cho identity + world state.
