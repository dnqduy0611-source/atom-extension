# ATOM Active Reading 3.0 - Specification Index

**Last Updated:** 2025-02-01
**Master Spec:** `../MASTER_SPEC_ACTIVE_READING_3.0.md`

---

## Overview

This folder contains detailed implementation specifications for ATOM Active Reading 3.0, broken down into 4 phases. Each spec is designed for AI coding agents to understand and implement accurately.

---

## Phase Summary

| Phase | Name | Duration | Priority | Status |
|-------|------|----------|----------|--------|
| 0 | Technical Debt | 1-2 weeks | CRITICAL | Pending |
| 1 | UX Foundation | 2-3 weeks | HIGH | Pending |
| 2 | Retention Loop | 3-4 weeks | HIGH | Pending |
| 3 | Semantic Brain | 4-6 weeks | MEDIUM | Pending |

---

## Spec Files

### [PHASE_0_TECHNICAL_DEBT.md](./PHASE_0_TECHNICAL_DEBT.md)
**Foundation fixes required before new features**

Key deliverables:
- **Task 0.1:** Token Optimization - Reduce API costs by 80%
- **Task 0.2:** Evidence Snippets - Ground AI responses in source text
- **Task 0.3:** Unified ReadingSession - Single data model
- **Task 0.4:** Save Button UX - Always visible save option

New files:
- `services/context_extractor.js`
- `services/evidence_validator.js`
- `storage/reading_session.js`
- `storage/migration.js`

---

### [PHASE_1_UX_FOUNDATION.md](./PHASE_1_UX_FOUNDATION.md)
**Transform from reactive to proactive assistant**

Key deliverables:
- **Task 1.1:** Pre-reading Primer - Guiding questions before reading
- **Task 1.2:** Learning Mode Selector - Skim vs Deep modes
- **Task 1.3:** Bloom's Taxonomy Chips - Cognitive-level quick actions
- **Task 1.4:** Smart Nudges - Detect passive reading
- **Task 1.5:** Timer Integration - Link focus sessions to reading
- **Task 1.6:** Auto-Summarize - Thread summaries after 3 exchanges

New files:
- `services/primer_service.js`
- `services/learning_objective.js`
- `services/nudge_engine.js`
- `services/timer_integration.js`
- `ui/components/primer.js`
- `ui/components/mode_selector.js`
- `ui/components/nudge.js`

---

### [PHASE_2_RETENTION_LOOP.md](./PHASE_2_RETENTION_LOOP.md)
**Knowledge retention through active recall**

Key deliverables:
- **Task 2.1:** Tiered Quiz System - 4-level difficulty (Bloom's)
- **Task 2.2:** Teach-Back Mode - User explains, AI evaluates
- **Task 2.3:** Flashcard Deck - Create cards from insights/quizzes
- **Task 2.4:** Spaced Repetition - SM-2 algorithm scheduling
- **Task 2.5:** Comprehension Scoring - Weighted metrics

New files:
- `services/quiz_generator.js`
- `services/teachback_service.js`
- `services/flashcard_deck.js`
- `services/spaced_repetition.js`
- `services/comprehension_scoring.js`
- `ui/components/quiz.js`
- `ui/components/teachback.js`
- `ui/components/flashcard.js`

---

### [PHASE_3_SEMANTIC_BRAIN.md](./PHASE_3_SEMANTIC_BRAIN.md)
**Cross-session knowledge connections**

Key deliverables:
- **Task 3.1:** Embedding Service - Vector representations via Gemini
- **Task 3.2:** Semantic Search - Find related by meaning
- **Task 3.3:** Related from Memory - Proactive past knowledge surfacing
- **Task 3.4:** Auto-Connection Detection - Relationship classification
- **Task 3.5:** Knowledge Graph - Visual node-link diagram
- **Task 3.6:** Cross-Domain Alerts - Notify on knowledge connections

New files:
- `services/embedding_service.js`
- `services/semantic_search.js`
- `services/related_memory.js`
- `services/connection_detector.js`
- `services/cross_domain_alerts.js`
- `storage/vector_store.js`
- `ui/components/related_memory.js`
- `ui/components/knowledge_graph.js`

---

## Dependencies Graph

```
Phase 0 (Foundation)
    │
    ├──► Phase 1 (UX)
    │       │
    │       └──► Phase 2 (Retention)
    │               │
    │               └──► Phase 3 (Semantic)
    │
    └──► All phases depend on Phase 0
```

---

## For AI Agents: How to Use These Specs

### Starting a Phase

1. Read the phase spec completely before coding
2. Check dependencies are complete
3. Create files in order listed
4. Follow code patterns exactly as shown
5. Run tests after each task

### Code Style

- Use ES6 modules (`import`/`export`)
- JSDoc comments for all functions
- Async/await for all async operations
- Chrome extension APIs via `chrome.*`

### Common Patterns

**Storage Access:**
```javascript
// Get
chrome.storage.local.get([KEY], (result) => {
  const data = result[KEY] || defaultValue;
});

// Set
chrome.storage.local.set({ [KEY]: data }, () => {});
```

**API Calls:**
```javascript
async function callGeminiAPI(prompt) {
  // Use existing ai_service.js patterns
}
```

**UI Components:**
```javascript
function createComponentUI(data, callbacks) {
  const container = document.createElement('div');
  container.className = 'sp-component';
  container.innerHTML = `...`;
  // Attach event handlers
  return container;
}
```

---

## Version History

| Version | Phase | Changes |
|---------|-------|---------|
| 2.7 | 0 | Technical debt fixes |
| 2.8 | 1a | Pre-reading, Learning modes |
| 2.9 | 1b | Nudges, Timer integration |
| 3.0 | 2a | Quiz, Flashcards |
| 3.1 | 2b | Spaced repetition, Scoring |
| 3.2 | 3a | Embeddings, Semantic search |
| 3.3 | 3b | Knowledge graph, Connections |

---

## Quick Reference

### Storage Keys
```javascript
const STORAGE_KEYS = {
  SESSIONS: 'atom_reading_sessions_v3',
  FLASHCARDS: 'atom_flashcard_deck_v1',
  CONNECTIONS: 'atom_connections_v1',
  REVIEW_HISTORY: 'atom_review_history',
  PRIMERS_SHOWN: 'atom_primers_shown',
  READING_MODE: 'atom_reading_mode_default'
};
```

### IndexedDB
```javascript
const VECTOR_DB = 'atom_vectors';
const VECTOR_STORE = 'embeddings';
```

### Feature Flags (for gradual rollout)
```javascript
const FEATURE_FLAGS = {
  // Phase 0
  SMART_CONTEXT: true,
  EVIDENCE_REQUIRED: true,

  // Phase 1
  PRE_READING_PRIMER: false,
  SMART_NUDGES: false,

  // Phase 2
  TIERED_QUIZ: false,
  SPACED_REPETITION: false,

  // Phase 3
  EMBEDDINGS: false,
  KNOWLEDGE_GRAPH: false
};
```

---

## Contact

For questions about these specs, refer to the master spec or project documentation.
