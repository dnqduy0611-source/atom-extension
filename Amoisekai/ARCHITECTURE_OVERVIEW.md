# 🗺️ AMOISEKAI — Architecture Overview (Phase 1→4)

> Bản đồ tổng thể để biết hướng đi. Chỉ Phase 1 có tech spec chi tiết.

---

## Evolution Map

```
Phase 1                    Phase 2                  Phase 3                 Phase 4
Single Player              Shared World             MMO Systems             Full Universe
─────────────────────────────────────────────────────────────────────────────────────────

┌──────────┐           ┌──────────────┐         ┌───────────────┐      ┌──────────────┐
│ 1 Player │           │ N Players    │         │ Factions      │      │ Nations      │
│ 1 Story  │    →      │ 1 Universe   │    →    │ Collisions    │  →   │ Empire War   │
│ SQLite   │           │ Supabase     │         │ Anti-snowball │      │ Cosmic Arc   │
└──────────┘           └──────────────┘         └───────────────┘      └──────────────┘

 3-4 tuần                4-5 tuần                 6-8 tuần                8+ tuần
```

---

## System Architecture by Phase

### Phase 1 — Single Player Isekai

```
┌─────────────────────────────────────────────┐
│                  CLIENT                      │
│  React Web App (Vite)                       │
│  ├─ Onboarding Quiz                         │
│  ├─ Story Reader (SSE)                      │
│  ├─ Choice Panel (3 + free input)           │
│  └─ Identity Card                           │
└──────────────┬──────────────────────────────┘
               │ HTTP + SSE
               ▼
┌─────────────────────────────────────────────┐
│              FASTAPI BACKEND                 │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │        7-Agent Pipeline (LangGraph)    │  │
│  │  Input Parser → Planner → Sim+Ctx     │  │
│  │  → Writer (SSE) → Critic → Identity   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │  SQLite DB   │  │  NeuralMemory        │  │
│  │  stories     │  │  1 Brain / player    │  │
│  │  chapters    │  │  identity, arcs,     │  │
│  │  players     │  │  relationships,      │  │
│  │  flags       │  │  causal chains       │  │
│  └─────────────┘  └───────────────────────┘  │
│                                              │
│  ┌─────────────┐  ┌───────────────────────┐  │
│  │ CRNG Engine │  │  Gemini 2.5 Flash     │  │
│  │ Fate Buffer │  │  (all agents)         │  │
│  └─────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Deliverable:** 1 player có thể chơi 20-30 chương liên tục với identity system hoạt động.

---

### Phase 2 — Shared World

```
                    ┌─────────────────────────┐
                    │      SUPABASE           │
                    │  ┌──────────────────┐   │
                    │  │ Auth (users)     │   │
                    │  │ Players (state)  │   │
                    │  │ World State      │   │
                    │  │ World Events     │   │
                    │  └──────────────────┘   │
                    └────────────┬────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐      ┌──────────┐
        │ Player A │     │ Player B │      │ Player C │
        │ Brain A  │     │ Brain B  │      │ Brain C  │
        │ Ch. 47   │     │ Ch. 12   │      │ Ch. 3    │
        └──────────┘     └──────────┘      └──────────┘

              ┌─────────────────────────────────────┐
              │         WORLD UPDATE CRON            │
              │  (mỗi 6-24h)                        │
              │                                      │
              │  Collect deltas → Recalculate:       │
              │  • Threat level                      │
              │  • Faction power balance             │
              │  • World events feed                 │
              │  • Leaderboard titles                │
              │                                      │
              │  ┌──────────────────────────────┐    │
              │  │  NeuralMemory Global Brain   │    │
              │  │  factions, artifacts, threats │    │
              │  └──────────────────────────────┘    │
              └─────────────────────────────────────┘
```

**New components:**
- Supabase migration (SQLite → Supabase for player/world state)
- Global World Brain (NeuralMemory)
- World Update Cron Job
- World Events Feed API
- Narrative Leaderboard (titles, not numbers)
- Extended pipeline: **+1 agent** (World Context)

---

### Phase 3 — MMO Systems

```
              Player A ─────┐
              Player B ─────┤
              Player C ─────┤
                            ▼
              ┌─────────────────────────┐
              │   FATE COLLISION ENGINE  │
              │                          │
              │  Scan: objectives match? │──→ Shared chapter
              │  Scan: artifact conflict?│──→ Async duel
              │  Scan: faction rivalry?  │──→ Political arc
              └─────────────────────────┘

              ┌─────────────────────────┐
              │   ANTI-SNOWBALL SYSTEM   │
              │                          │
              │  Notoriety → bounties    │
              │  Soft Cap → diminishing  │
              │  World Reaction → spawn  │
              │  counterforce            │
              └─────────────────────────┘

              ┌─────────────────────────┐
              │   FACTION SYSTEM         │
              │                          │
              │  Join / Create faction   │
              │  Territory claims        │
              │  Faction Brain (Neural)  │
              │  Internal politics       │
              └─────────────────────────┘
```

**New components:**
- Fate Collision Engine (cron-based detection)
- Anti-Snowball System (Notoriety, World Reaction)
- Faction System + Faction Brains
- Indirect Player Interaction (traces, rumors, NPC mentions)

---

### Phase 4 — Full Universe

```
                    ┌───────────────────────────┐
                    │    COSMIC ARCHITECTURE     │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │  Enemy Empire (5 tầng)│  │
                    │  │  Arc 1: Outer + Gen.  │  │
                    │  └──────────────────────┘  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │  Cosmic Threat        │  │
                    │  │  Phase 1→3 reveal     │  │
                    │  └──────────────────────┘  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │  Cosmic Democracy     │  │
                    │  │  World Alignment      │  │
                    │  │  Universe Cycles      │  │
                    │  └──────────────────────┘  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │  Nation Building      │  │
                    │  │  Territory + Tax      │  │
                    │  │  Instability + Rebel  │  │
                    │  └──────────────────────┘  │
                    │                            │
                    │  ┌──────────────────────┐  │
                    │  │  3 Axis Power Full    │  │
                    │  │  Combat × Influence   │  │
                    │  │  × Strategic          │  │
                    │  └──────────────────────┘  │
                    └───────────────────────────┘
```

---

## Data Flow Across Phases

```
Phase 1 (SQLite local)
  stories ──┐
  chapters  │
  players   ├──→  Phase 2: migrate to Supabase
  flags     │     + add world_state, world_events tables
  events   ─┘     + add Global Brain

Phase 2 (Supabase)
  + world_state ──┐
  + world_events  ├──→  Phase 3: add factions, collisions tables
  + leaderboard  ─┘     + Faction Brains

Phase 3
  + factions ─────┐
  + collisions    ├──→  Phase 4: add empire, cosmic, nations tables
  + anti_snowball ┘
```

## NeuralMemory Brain Evolution

| Phase | Brains | Count |
|-------|--------|-------|
| 1 | Player Brain | 1/player |
| 2 | + Global World Brain | +1 |
| 3 | + Faction Brains | +1/faction |
| 4 | + Empire Brain (AI enemy memory) | +1 |

## Pipeline Evolution

| Phase | Agents | New |
|-------|--------|-----|
| 1 | 7 (Input→Plan→Sim→Ctx→Write→Critic→Identity) | All |
| 2 | 8 | +World Context Agent |
| 3 | 9 | +Collision Detector |
| 4 | 10 | +Empire Narrator |

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite Phase 1 → Supabase Phase 2 | Không over-engineer sớm, SQLite đủ cho solo testing |
| NeuralMemory per player (not per story) | Player có thể start nhiều story, identity xuyên suốt |
| Async MMO (không real-time) | Solo dev không cần WebSocket infra |
| Cron-based world update | Đơn giản, predictable, dễ debug |
| Gemini Flash cho tất cả agents | Rẻ, nhanh, consistent. Upgrade model sau nếu cần |
| LangGraph (không raw chain) | Built-in state, conditional edges, retry loops |
| Deterministic Identity Agent | Không dùng AI cho score calc → reproducible, fast, free |
