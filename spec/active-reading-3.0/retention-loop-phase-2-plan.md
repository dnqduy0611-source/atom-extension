# retention-loop-phase-2-plan.md

## Overview
Implement Phase 2 Retention Loop for Active Reading 3.0 in ATOM_Extension_V2.7. This phase adds tiered quizzes, teach-back mode, flashcards with spaced repetition (SM-2), and comprehension scoring. UI entry points are manual buttons inside each highlight card. If no highlight is selected, show a gentle prompt: "Ban hay chon phan ma ban quan tam".

## Source Spec
- D:\Amo\ATOM_Extension_V2.6\spec\active-reading-3.0\PHASE_2_RETENTION_LOOP.md

## Goals
- Build core retention mechanisms: quiz, teach-back, flashcards, spaced repetition, comprehension scoring.
- Integrate with existing extension flows without breaking Phase 1.
- Persist all retention data in chrome.storage.local.
- Provide clear, fast UI flows from highlight cards.

## Non-Goals
- Cloud sync or multi-device support.
- New AI provider or changes to callGeminiAPI.
- Major redesign of sidepanel or popup layouts.

## Assumptions
- callGeminiAPI is available and stable for quiz/teach-back evaluation.
- Storage uses chrome.storage.local for all new data.
- Manual trigger only (no auto popup after highlight).

## Scope Summary
### New Services
- services/quiz_generator.js
- services/teachback_service.js
- services/flashcard_deck.js
- services/spaced_repetition.js
- services/comprehension_scoring.js

### New UI Components
- ui/components/quiz.js
- ui/components/teachback.js
- ui/components/flashcard.js

### Files to Modify
- sidepanel.js (manual triggers in highlight card, empty-state message)
- popup.js (review stats + streak display)
- storage/reading_session.js (link cards and scores to session)

## User Experience Decisions
- Entry points for quiz and teach-back are buttons inside each highlight card.
- If no highlight is selected, show: "Ban hay chon phan ma ban quan tam".

## Plan by Phase
### Phase 1 - Service Foundation (Week 1)
1. Quiz generator service
2. Teach-back service
3. Flashcard deck service
4. Spaced repetition scheduler (SM-2)
5. Comprehension scoring

### Phase 2 - UI Components (Week 2)
1. Quiz UI (single + session)
2. Teach-back UI
3. Flashcard + review session UI

### Phase 3 - Integration (Week 3)
1. Sidepanel integration
2. Popup stats integration
3. Reading session linkage

### Phase 4 - QA and Polish (Week 4)
1. Edge cases and fallback behavior
2. Performance and UX tuning
3. Validation scripts (if applicable)

## Task Breakdown (Agent, Skills, IO, Verify)
Each task includes agent assignment, required skills, and verification steps.

### T2.1 Quiz Generator Service
- Agent: backend-specialist
- Skills: api-patterns, nodejs-best-practices (if available)
- Input: highlightText, tier, context
- Output: question JSON + evaluation result
- Verify:
  - JSON parsing handles malformed AI output
  - Tier fallback works
  - Multiple choice scoring correct

### T2.2 Teach-back Service
- Agent: backend-specialist
- Skills: api-patterns, nodejs-best-practices (if available)
- Input: user summary, rubric
- Output: score, feedback, suggestions
- Verify:
  - JSON parsing + fallback when AI output invalid
  - Rubric fields mapped

### T2.3 Flashcard Deck Service
- Agent: backend-specialist
- Skills: database-design (if available)
- Input: card objects, review results
- Output: persisted deck, queues, stats
- Verify:
  - CRUD via chrome.storage.local
  - Queue filters for due/overdue/new

### T2.4 Spaced Repetition (SM-2)
- Agent: backend-specialist
- Skills: clean-code
- Input: card state, quality (0-5)
- Output: updated interval, dueDate, easeFactor
- Verify:
  - quality < 3 resets interval
  - quality = 5 increases interval
  - interval cap at 365 days

### T2.5 Comprehension Scoring
- Agent: backend-specialist
- Skills: clean-code
- Input: session metrics
- Output: overall score, level, suggestions
- Verify:
  - Handles missing assessment data
  - Score weights correct

### T2.6 Quiz UI Component
- Agent: frontend-specialist
- Skills: frontend-design (if available)
- Input: question object
- Output: DOM node with handlers
- Verify:
  - submit/skip/feedback flow works
  - progress updates correctly

### T2.7 Teach-back UI Component
- Agent: frontend-specialist
- Skills: frontend-design (if available)
- Input: prompt + user response
- Output: DOM node + evaluation view
- Verify:
  - validation for minimum input
  - evaluation display and retry

### T2.8 Flashcard UI + Review Session
- Agent: frontend-specialist
- Skills: frontend-design (if available)
- Input: cards list
- Output: flip UI + rating flow
- Verify:
  - rating updates + summary
  - review session progression

### T2.9 Sidepanel Integration
- Agent: orchestrator
- Skills: app-builder (if available)
- Input: services + UI components
- Output: highlight card buttons, empty-state prompt
- Verify:
  - manual trigger launches quiz/teach-back
  - empty-state message shown without highlight

### T2.10 Popup Integration
- Agent: frontend-specialist
- Skills: frontend-design (if available)
- Input: review stats, streak
- Output: popup stats UI
- Verify:
  - stats render without errors

### T2.11 Reading Session Linkage
- Agent: backend-specialist
- Skills: database-design (if available)
- Input: session metrics + cards
- Output: session entries with retention data
- Verify:
  - session read/write stable
  - card references preserved

## Data Model Notes
- Store new data under chrome.storage.local namespaces:
  - atom_flashcards
  - atom_review_history
  - atom_quiz_history
  - atom_teachback_history
  - atom_comprehension_scores

## Risks and Mitigations
- AI returns invalid JSON -> strict parsing + fallback
- Large sessions degrade UI -> lazy render + paging
- SM-2 errors -> unit tests + guardrails

## Acceptance Criteria
- All services created and wired per spec
- UI flows functional from highlight card
- SM-2 scheduling works with streaks and forecast
- Comprehension scoring displayed
- No regressions to Phase 1

## Verification Plan
- Unit tests for SM-2 and scoring logic
- Manual smoke flow: highlight -> quiz -> add to review -> rate -> streak updated
- Run repository checklist scripts if present

## Deliverables
- New services and UI files
- Sidepanel/popup/storage updates
- Documentation notes if behavior changes
