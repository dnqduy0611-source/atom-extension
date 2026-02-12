# Phase 3 — Memory Strength & Decay

> **Status:** Implementing
> **Date:** 2026-02-11
> **Prerequisite:** Phase 0-2 ✅
> **Ref:** [00_overview.md](./00_overview.md) §5

---

## 1. Mục tiêu

Add forgetting curve to edges and SRQ cards. Memories decay over time unless reinforced through user interaction.

---

## 2. Changes

### `background.js`
- Add `chrome.alarms.create('atom_kg_decay_cycle', { periodInMinutes: 360 })` (6 hours)
- Add alarm handler: recalculate edge strengths, remove dead edges (< 0.05)

### `storage/srq_store.js`
- Upgrade `evictIfNeeded()`: FIFO → strength-based (weakest first)

### `storage/knowledge_graph.js`
- Add `reinforceEdge(edgeId, boost)` function
- Add `runDecayCycle()` function

---

## 3. Forgetting Curve

```
strength_now = initial_strength × e^(-decayRate × daysSinceLastReinforce)
```

Default `decayRate = 0.05` → ~50% strength after 14 days without reinforcement.

### Reinforcement Events

| Event | Boost | Where |
|-------|-------|-------|
| Spreading activation traversal | +0.05 | `spreading_activation.js` ✅ done |
| Session revisit (same URL) | +0.2 | `background.js` (future) |
| SRQ card approved | +0.15 | `background.js` alarm handler |
