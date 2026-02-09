# ATOM Active Reading 3.0 - Master Specification

**Version:** 1.0
**Date:** 2025-02-01
**Authors:** Development Team
**Status:** Draft for Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Vision & Goals](#3-vision--goals)
4. [Architecture Overview](#4-architecture-overview)
5. [Phase 0: Technical Debt](#5-phase-0-technical-debt)
6. [Phase 1: UX Foundation](#6-phase-1-ux-foundation)
7. [Phase 2: Retention Loop](#7-phase-2-retention-loop)
8. [Phase 3: Semantic Brain](#8-phase-3-semantic-brain)
9. [Data Models](#9-data-models)
10. [API & Integration](#10-api--integration)
11. [Testing Strategy](#11-testing-strategy)
12. [Rollout Plan](#12-rollout-plan)
13. [Success Metrics](#13-success-metrics)
14. [Appendix](#14-appendix)

---

## 1. Executive Summary

### 1.1 Problem Statement

ATOM Extension v2.6 has strong **capture** capabilities but weak **retention** mechanisms:

| Capability | Current State | Gap |
|------------|---------------|-----|
| Highlight & Chat | ✅ Excellent | - |
| Save to NotebookLM | ✅ Good | UX friction |
| Knowledge Recall | ❌ Missing | No spaced repetition |
| Proactive Learning | ❌ Missing | Reactive only |
| Cross-session Memory | ❌ Missing | No semantic linking |
| Timer-Reading Integration | ❌ Missing | Disconnected systems |

### 1.2 Solution Overview

Transform ATOM from a **reading assistant** to a **learning companion** through 4 phases:

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 0: Technical Debt (1-2 weeks)                            │
│  Fix foundations: Token optimization, Evidence grounding,       │
│  Data sync, Save UX                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: UX Foundation (2-3 weeks)                             │
│  Pre-reading primer, Learning objectives, Smart nudges,         │
│  Timer integration, Bloom's taxonomy                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: Retention Loop (3-4 weeks)                            │
│  Quiz system, Flashcards, Spaced repetition, Teach-back,        │
│  Comprehension scoring                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Semantic Brain (4-6 weeks)                            │
│  Embeddings, Cross-session memory, Knowledge graph,              │
│  "Related from your Memory", Auto-connections                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Expected Outcomes

| Metric | Current | Target | Impact |
|--------|---------|--------|--------|
| Knowledge retention (7-day) | ~20% | 70%+ | Spaced repetition |
| API cost per session | $X | $0.15X | Token optimization |
| User engagement (highlights/session) | 2-3 | 5-7 | Proactive nudges |
| Cross-session connections | 0 | 10+/week | Semantic linking |

---

## 2. Current State Analysis

### 2.1 Chat (Side Panel) - `sidepanel.js`

#### Strengths
- Thread-based organization per highlight
- Status management (active/parked/saved)
- Connection detection between threads
- Quick action chips (Summarize, Explain, Counter-argue, etc.)
- Robust retry/offline queue system
- Good error UX with actionable messages
- Contextual prompts with page + highlight
- Atomic thought extraction
- Direct NotebookLM integration

#### Weaknesses
| Issue | Location | Impact |
|-------|----------|--------|
| Sends ~15k chars every request | `buildSystemPrompt()` L2318 | High token cost, diluted focus |
| History limited to 10 messages | `buildConversationHistory()` | Lost context in long sessions |
| No evidence/grounding mechanism | System prompt | Potential hallucinations |
| No learning objective framework | Quick actions | Random exploration |
| No quality feedback from user | Chat flow | Can't improve |
| Save button hidden | `insight-display` | Low discovery |

#### Proposed Improvements
1. Smart context levels (MINIMAL/STANDARD/FULL)
2. Evidence snippets required in responses
3. Bloom's Taxonomy-based action chips
4. Learning objective selector (skim/deep)
5. Auto-summarize after 2-3 exchanges
6. Teach-back mode with mini quiz
7. Always-visible Save button

### 2.2 Active Reading - `content.js`, `background.js`

#### Strengths
- Context menu with 3 modes (Summary/Critique/Quiz)
- Reading card with key points + questions + evaluation
- Vault storage system
- i18n support (EN/VI)
- Saved state indicators
- Cooldown to prevent abuse

#### Weaknesses
| Issue | Location | Impact |
|-------|----------|--------|
| Only 3 questions, no difficulty levels | `generateQuiz()` | Limited assessment |
| No spaced repetition scheduling | Storage | Knowledge decay |
| Disconnected from Thread system | Data model | Fragmented experience |
| No learning path/objectives | UX flow | Aimless reading |

#### Proposed Improvements
1. Difficulty-tiered questions (Easy → Hard)
2. Learning loop: Read → Answer → Evaluate → Next card
3. Spaced repetition scheduler
4. Unified session model (Card + Thread)
5. Insight sync between Card and Thread

### 2.3 Focus Timer - `popup.js`, `background.js`

#### Strengths
- Pomodoro presets (25/40/50 min)
- Auto-calculated break time
- Domain blocking during focus
- Phase tracking (WORK/BREAK)

#### Weaknesses
| Issue | Impact |
|-------|--------|
| Doesn't know what user is reading | No context for review |
| No end-of-session prompt | Missed recall opportunity |
| No session-article association | Can't track learning by article |

#### Proposed Improvements
1. Capture active URL/title when session starts
2. Track reading metrics during session
3. End-of-session review prompt with quiz
4. Session summary saved with article context

### 2.4 Memory System - `memory.js`

#### Current State
- Simple localStorage/chrome.storage
- No semantic understanding
- No cross-session connections

#### Proposed Evolution
1. Vector embeddings via Gemini
2. Semantic similarity search
3. "Related from your Memory" feature
4. Knowledge graph visualization

---

## 3. Vision & Goals

### 3.1 Vision Statement

> Transform ATOM from a **passive reading assistant** into an **active learning companion** that helps users not just capture, but truly understand and remember what they read.

### 3.2 Core Principles

| Principle | Description |
|-----------|-------------|
| **Capture → Retain** | Every highlight should become lasting knowledge |
| **Reactive → Proactive** | System initiates engagement, not just responds |
| **Isolated → Connected** | Knowledge links across sessions and topics |
| **Read → Learn → Apply** | Complete learning loop, not just reading |

### 3.3 User Stories

#### Epic 1: Intentional Reading
```
As a learner,
I want to set a learning objective before reading,
So that my reading is focused and purposeful.
```

#### Epic 2: Active Engagement
```
As a reader who tends to skim,
I want the system to nudge me when I'm reading too fast,
So that I don't miss important concepts.
```

#### Epic 3: Knowledge Retention
```
As a student,
I want to be quizzed on what I read yesterday,
So that I can strengthen my memory.
```

#### Epic 4: Connected Learning
```
As a researcher,
I want to see how today's article relates to what I read last week,
So that I can build a connected understanding.
```

#### Epic 5: Integrated Focus
```
As a focused reader,
I want my Pomodoro session to know what article I'm reading,
So that I can review key points when the timer ends.
```

---

## 4. Architecture Overview

### 4.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  popup.js    │  │  content.js  │  │ sidepanel.js │          │
│  │  (Timer UI)  │  │  (Page DOM)  │  │  (Chat UI)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                    ┌───────▼───────┐                            │
│                    │ background.js │                            │
│                    │ (Service Wkr) │                            │
│                    └───────┬───────┘                            │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                  │                  │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼─────┐           │
│  │ ai_service  │  │ chrome.storage  │  │  bridge/  │           │
│  │  (Gemini)   │  │    (Local)      │  │   (NLM)   │           │
│  └─────────────┘  └─────────────────┘  └───────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Target Architecture (v3.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ATOM ACTIVE READING 3.0                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED SESSION LAYER                  │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │              ReadingSession Object                   │ │   │
│  │  │  - highlights[]  - card{}  - thread{}  - insights[] │ │   │
│  │  │  - focusSession{}  - metrics{}  - connections[]     │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │              │
│  ┌──────▼──────┐     ┌───────▼───────┐    ┌──────▼──────┐      │
│  │  CAPTURE    │     │   PROCESS     │    │   RETAIN    │      │
│  │             │     │               │    │             │      │
│  │ • Highlight │     │ • Chat        │    │ • Quiz      │      │
│  │ • Context   │     │ • Quick Acts  │    │ • Flashcard │      │
│  │ • Timer     │     │ • Insight Gen │    │ • Spaced Rep│      │
│  │ • Nudges    │     │ • Evidence    │    │ • Review    │      │
│  └─────────────┘     └───────────────┘    └─────────────┘      │
│                              │                                   │
│                      ┌───────▼───────┐                          │
│                      │    CONNECT    │                          │
│                      │               │                          │
│                      │ • Embeddings  │                          │
│                      │ • Similarity  │                          │
│                      │ • Graph       │                          │
│                      └───────────────┘                          │
│                              │                                   │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                     STORAGE LAYER                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ Sessions DB │  │ Vectors DB  │  │ Review Queue│        │  │
│  │  │ (chrome.st) │  │ (IndexedDB) │  │ (chrome.st) │        │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                      ┌───────▼───────┐                          │
│                      │   EXTERNAL    │                          │
│                      │  • Gemini API │                          │
│                      │  • NotebookLM │                          │
│                      └───────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 New Modules

| Module | Purpose | Phase |
|--------|---------|-------|
| `storage/reading_session.js` | Unified session management | 0 |
| `services/context_extractor.js` | Smart context extraction | 0 |
| `services/evidence_validator.js` | Response grounding | 0 |
| `services/learning_objective.js` | Bloom's taxonomy | 1 |
| `services/nudge_engine.js` | Proactive interventions | 1 |
| `services/timer_integration.js` | Focus-Reading bridge | 1 |
| `services/quiz_generator.js` | Tiered quiz creation | 2 |
| `services/spaced_repetition.js` | Review scheduling | 2 |
| `services/flashcard_deck.js` | Flashcard management | 2 |
| `services/embedding_service.js` | Vector operations | 3 |
| `services/semantic_search.js` | Similarity search | 3 |
| `services/knowledge_graph.js` | Connection visualization | 3 |

---

## 5. Phase 0: Technical Debt

**Duration:** 1-2 weeks
**Priority:** CRITICAL
**Dependency:** None (foundation for all phases)

### 5.1 Item 1: Token Optimization

#### Problem
```javascript
// Current: sidepanel.js L2318
${pageContext.content.slice(0, 15000)}  // 15k chars EVERY request
```

#### Solution
```javascript
const CONTEXT_LEVELS = {
  MINIMAL: 'minimal',   // ~500 chars - highlight only
  STANDARD: 'standard', // ~1500 chars - highlight + paragraph + heading
  FULL: 'full'          // ~12000 chars - includes page content
};

function determineContextLevel(action, messageCount) {
  if (['summarize_page', 'analyze_structure'].includes(action)) return 'full';
  if (messageCount > 3) return 'minimal';
  return 'standard';
}
```

#### Implementation
1. Add `extractSmartContext()` to content.js
2. Update `buildSystemPrompt()` with context levels
3. Add console logging for monitoring

#### Success Criteria
- [ ] Default context < 2,000 chars
- [ ] 90%+ token reduction for typical use

### 5.2 Item 2: Evidence Snippets

#### Problem
AI responses lack grounding, potential hallucinations

#### Solution
```markdown
📍 Evidence: "exact quote from the highlight"

💡 Analysis: Your explanation here...
```

#### Implementation
1. Update system prompt with evidence format requirement
2. Update all quick action prompts
3. Add optional response validator

#### Success Criteria
- [ ] 90%+ responses contain evidence citations
- [ ] Users can verify claims against source

### 5.3 Item 3: Note ↔ Thread Synchronization

#### Problem
Reading Card (content.js) and Thread (sidepanel.js) are disconnected

#### Solution
Unified `ReadingSession` object:
```javascript
interface ReadingSession {
  id: string;
  url: string;
  title: string;
  highlights: Highlight[];
  card?: ReadingCard;      // From context menu
  thread?: ChatThread;     // From sidepanel
  insights: Insight[];     // Merged from both
  focusSession?: FocusSession;
  connections: Connection[];
}
```

#### Implementation
1. Create `storage/reading_session.js`
2. Update content.js to use unified service
3. Update sidepanel.js to use unified service
4. Create migration script for existing data

#### Success Criteria
- [ ] Single source of truth for reading data
- [ ] Insights visible in both Card and Thread views
- [ ] Old data migrated without loss

### 5.4 Item 4: Save Button UX

#### Problem
Save button hidden behind Key Insight step

#### Solution
```
Quick Actions: [📋 Tóm tắt] [💡 Giải thích] ... [💾 Save]  ← Always visible
Action Bar:    [💾 Save] [💡 Insight] [✅ Done]            ← Save first
```

#### Implementation
1. Add Save chip to quick actions
2. Add Save button to action bar
3. Allow save without insight (quickSave mode)

#### Success Criteria
- [ ] Save button visible immediately when thread active
- [ ] Can save without creating insight first

---

## 6. Phase 1: UX Foundation

**Duration:** 2-3 weeks
**Priority:** HIGH
**Dependency:** Phase 0 complete

### 6.1 Feature: Pre-reading Primer

#### Concept
When user opens a new article, proactively suggest 3 guiding questions.

#### User Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  User opens article about "React Hooks"                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Sidepanel shows:                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  📚 Before you read...                                      │ │
│  │                                                             │ │
│  │  This article covers: React Hooks                           │ │
│  │                                                             │ │
│  │  🎯 Reading objectives:                                     │ │
│  │  1. What problem do Hooks solve?                            │ │
│  │  2. How do Hooks differ from class components?              │ │
│  │  3. When should you create custom Hooks?                    │ │
│  │                                                             │ │
│  │  [Start Reading] [Skip]                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation
```javascript
async function generatePreReadingPrimer(pageTitle, pageOutline) {
  const prompt = `
    Article: ${pageTitle}
    Structure: ${pageOutline}

    Generate 3 guiding questions a reader should answer by the end.
    Focus on: understanding, application, and critical thinking.

    Format:
    1. [Understanding question]
    2. [Application question]
    3. [Critical thinking question]
  `;

  return await callGeminiAPI(prompt);
}
```

#### Success Criteria
- [ ] Primer shown for new articles (first visit)
- [ ] Questions are relevant to article topic
- [ ] User can skip or accept objectives

### 6.2 Feature: Learning Objective Selector

#### Concept
Let user choose reading depth which controls AI behavior.

#### UI Component
```
┌─────────────────────────────────────────────────────────────────┐
│  Reading Mode:                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  ⚡ Skim          │  │  🔬 Deep         │                     │
│  │  Quick overview   │  │  Full analysis   │                     │
│  │  Key points only  │  │  Examples        │                     │
│  │                   │  │  Counter-args    │                     │
│  └──────────────────┘  └──────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Behavior Differences

| Aspect | Skim Mode | Deep Mode |
|--------|-----------|-----------|
| Quick Actions | Summarize, Key Points | All + Analyze, Counter-argue |
| AI Responses | Concise bullets | Detailed with examples |
| Auto-prompts | None | Suggest follow-up questions |
| Insights | 1-sentence | Multi-sentence with context |

#### Implementation
```javascript
const READING_MODES = {
  SKIM: {
    chips: ['summarize', 'keypoints', 'explain'],
    responseStyle: 'concise',
    maxTokens: 500,
    autoPrompt: false
  },
  DEEP: {
    chips: ['summarize', 'keypoints', 'explain', 'analyze', 'counter', 'connect', 'apply'],
    responseStyle: 'detailed',
    maxTokens: 1500,
    autoPrompt: true
  }
};
```

### 6.3 Feature: Bloom's Taxonomy Quick Actions

#### Concept
Organize quick actions by cognitive level.

#### Taxonomy Mapping
```
┌─────────────────────────────────────────────────────────────────┐
│  BLOOM'S TAXONOMY → QUICK ACTIONS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 1: REMEMBER                                               │
│    📋 Summarize - "What does this say?"                          │
│    🔑 Key Points - "What are the main ideas?"                    │
│                                                                  │
│  Level 2: UNDERSTAND                                             │
│    💡 Explain - "What does this mean?"                           │
│    🔄 Paraphrase - "Say this differently"                        │
│                                                                  │
│  Level 3: APPLY                                                  │
│    🔧 Example - "Show me a real-world example"                   │
│    💻 Code - "Show me how to implement this"                     │
│                                                                  │
│  Level 4: ANALYZE                                                │
│    🔍 Structure - "How is this organized?"                       │
│    ⚖️ Compare - "How does this compare to X?"                    │
│                                                                  │
│  Level 5: EVALUATE                                               │
│    🤔 Counter - "What are the counter-arguments?"                │
│    ✅ Critique - "What are the strengths/weaknesses?"            │
│                                                                  │
│  Level 6: CREATE                                                 │
│    ✨ Extend - "How could this be applied to...?"                │
│    🔗 Connect - "How does this relate to...?"                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### UI Implementation
```html
<div class="sp-quick-actions" data-mode="deep">
  <!-- Level 1-2: Always visible -->
  <div class="chip-group basic">
    <button data-action="summarize" data-level="1">📋 Tóm tắt</button>
    <button data-action="keypoints" data-level="1">🔑 Ý chính</button>
    <button data-action="explain" data-level="2">💡 Giải thích</button>
  </div>

  <!-- Level 3-6: Visible in Deep mode -->
  <div class="chip-group advanced">
    <button data-action="example" data-level="3">🔧 Ví dụ</button>
    <button data-action="analyze" data-level="4">🔍 Phân tích</button>
    <button data-action="counter" data-level="5">🤔 Phản biện</button>
    <button data-action="connect" data-level="6">🔗 Liên kết</button>
  </div>

  <!-- Always visible -->
  <button data-action="save" class="chip-save">💾 Save</button>
</div>
```

### 6.4 Feature: Smart Nudges

#### Concept
Proactive interventions when detecting passive reading.

#### Nudge Types

| Trigger | Detection | Nudge |
|---------|-----------|-------|
| Fast scroll | scrollSpeed > threshold, no highlights | "Đoạn này có ý quan trọng, bạn muốn dừng lại không?" |
| Long passive | 5+ min reading, 0 highlights | "Có gì đáng chú ý trong phần bạn vừa đọc?" |
| Section end | Reached H2/H3 boundary | "Trước khi tiếp tục, ý chính phần vừa rồi là gì?" |
| Completion | Reached end of article | "Bạn có thể tóm tắt 3 điểm chính không?" |

#### Implementation
```javascript
class NudgeEngine {
  constructor() {
    this.lastHighlightTime = Date.now();
    this.scrollHistory = [];
    this.highlightCount = 0;
  }

  checkScrollPattern(scrollData) {
    this.scrollHistory.push(scrollData);

    // Detect fast continuous scroll
    const recentScrolls = this.scrollHistory.slice(-10);
    const avgSpeed = recentScrolls.reduce((a, b) => a + b.speed, 0) / recentScrolls.length;
    const hasHighlight = this.highlightCount > 0;

    if (avgSpeed > 500 && !hasHighlight) {
      return {
        type: 'fast_scroll',
        message: 'Bạn đang đọc khá nhanh. Có muốn dừng lại tóm tắt?',
        actions: ['pause', 'continue']
      };
    }

    return null;
  }

  checkPassiveReading() {
    const timeSinceHighlight = Date.now() - this.lastHighlightTime;

    if (timeSinceHighlight > 5 * 60 * 1000 && this.highlightCount === 0) {
      return {
        type: 'passive_reading',
        message: 'Đã 5 phút rồi. Có điều gì đáng chú ý không?',
        actions: ['highlight_now', 'nothing_important', 'remind_later']
      };
    }

    return null;
  }
}
```

#### Nudge UI
```
┌─────────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  💭 Một phút suy nghĩ...                                    │ │
│  │                                                             │ │
│  │  Bạn vừa đọc qua đoạn về "State Management".                │ │
│  │  Ý chính của phần này là gì?                                │ │
│  │                                                             │ │
│  │  [Trả lời ngay] [Quay lại đọc] [Bỏ qua]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6.5 Feature: Timer ↔ Reading Integration

#### Concept
Link Focus Timer sessions with reading context.

#### Data Model Extension
```javascript
interface FocusSession {
  sessionId: string;
  startedAt: number;
  workMin: number;
  breakMin: number;
  phase: 'WORK' | 'BREAK';
  phaseEndsAt: number;

  // NEW: Reading context
  readingContext: {
    url: string;
    title: string;
    readingSessionId: string;  // Link to ReadingSession
  };

  // NEW: Metrics during session
  metrics: {
    highlightsCreated: number;
    insightsCreated: number;
    messagesExchanged: number;
    scrollDepth: number;
  };
}
```

#### Enhanced Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER STARTS FOCUS SESSION                                    │
├─────────────────────────────────────────────────────────────────┤
│  Popup captures:                                                 │
│  - Current tab URL and title                                     │
│  - Creates/links to ReadingSession                               │
│  - Initializes metrics tracking                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. DURING WORK PHASE                                            │
├─────────────────────────────────────────────────────────────────┤
│  Sidepanel tracks:                                               │
│  - Highlights created (increment metrics.highlightsCreated)      │
│  - Insights saved (increment metrics.insightsCreated)            │
│  - Chat messages (increment metrics.messagesExchanged)           │
│  - Scroll depth via content.js                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. WORK PHASE ENDS → REVIEW PROMPT                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ⏱️ Focus session complete!                                 │ │
│  │                                                             │ │
│  │  📖 You read: "Understanding React Hooks"                   │ │
│  │  ✨ Session stats:                                          │ │
│  │     • 3 highlights                                          │ │
│  │     • 1 insight created                                     │ │
│  │     • 78% scroll depth                                      │ │
│  │                                                             │ │
│  │  🧠 Quick recall:                                           │ │
│  │  "What are the 2 rules of Hooks?"                           │ │
│  │                                                             │ │
│  │  [Answer] [Skip to Break] [End Session]                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. SESSION SUMMARY SAVED                                        │
├─────────────────────────────────────────────────────────────────┤
│  Stored in ReadingSession:                                       │
│  {                                                               │
│    focusSession: {                                               │
│      duration: 25,                                               │
│      metrics: { highlights: 3, insights: 1, ... },               │
│      recallQuestion: "What are the 2 rules of Hooks?",           │
│      recallAnswer: "...",                                        │
│      recallScore: 0.8                                            │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.6 Feature: Auto-Summarize Thread

#### Concept
After 2-3 chat exchanges, offer to summarize and suggest next steps.

#### Trigger Logic
```javascript
function checkAutoSummarize(thread) {
  const messageCount = thread.messages.filter(m => m.role === 'assistant').length;

  if (messageCount >= 3 && !thread.autoSummarized) {
    return true;
  }
  return false;
}
```

#### UI
```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Thread Summary                                               │
│                                                                  │
│  You've explored this passage in depth. Here's a summary:        │
│                                                                  │
│  📝 Key takeaways:                                               │
│  • React Hooks simplify state management                         │
│  • useEffect replaces lifecycle methods                          │
│                                                                  │
│  🤔 Suggested next questions:                                    │
│  • How do custom Hooks work?                                     │
│  • What are the performance implications?                        │
│                                                                  │
│  [Create Insight] [Ask Follow-up] [Move On]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Phase 2: Retention Loop

**Duration:** 3-4 weeks
**Priority:** HIGH
**Dependency:** Phase 1 complete

### 7.1 Feature: Tiered Quiz System

#### Concept
Generate questions at multiple difficulty levels.

#### Difficulty Tiers
```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: RECALL (Easy)                                           │
│  "What does the author say about X?"                             │
│  Multiple choice, answer directly in text                        │
├─────────────────────────────────────────────────────────────────┤
│  TIER 2: UNDERSTAND (Medium)                                     │
│  "Why does X happen according to the author?"                    │
│  Short answer, requires paraphrasing                             │
├─────────────────────────────────────────────────────────────────┤
│  TIER 3: APPLY (Hard)                                            │
│  "How would you apply X to situation Y?"                         │
│  Open-ended, requires transfer of knowledge                      │
├─────────────────────────────────────────────────────────────────┤
│  TIER 4: ANALYZE (Expert)                                        │
│  "Compare X with Z. What are the trade-offs?"                    │
│  Requires synthesis and critical thinking                        │
└─────────────────────────────────────────────────────────────────┘
```

#### Implementation
```javascript
async function generateTieredQuiz(highlight, tier = 1) {
  const prompts = {
    1: `Generate a recall question about this text. Answer should be directly stated.
        Text: "${highlight}"
        Format: { question, options: [4 choices], correctIndex, explanation }`,

    2: `Generate an understanding question requiring paraphrasing.
        Text: "${highlight}"
        Format: { question, sampleAnswer, rubric }`,

    3: `Generate an application question for this concept.
        Text: "${highlight}"
        Format: { question, scenario, sampleAnswer, rubric }`,

    4: `Generate an analysis question comparing or evaluating.
        Text: "${highlight}"
        Format: { question, context, sampleAnswer, rubric }`
  };

  return await callGeminiAPI(prompts[tier]);
}
```

#### Adaptive Difficulty
```javascript
function determineNextDifficulty(previousResults) {
  const recentCorrect = previousResults.slice(-5).filter(r => r.correct).length;

  if (recentCorrect >= 4) return Math.min(currentTier + 1, 4);  // Move up
  if (recentCorrect <= 1) return Math.max(currentTier - 1, 1);  // Move down
  return currentTier;  // Stay same
}
```

### 7.2 Feature: Teach-Back Mode

#### Concept
User explains concept back to AI, which evaluates understanding.

#### User Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  🎓 Teach-Back Challenge                                         │
│                                                                  │
│  You've read about: "React Hooks vs Class Components"            │
│                                                                  │
│  Explain this concept as if teaching a beginner:                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  [User types explanation here...]                           │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Submit] [Get Hints] [Skip]                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📊 Evaluation                                                   │
│                                                                  │
│  Understanding Score: 75%                                        │
│                                                                  │
│  ✅ You correctly explained:                                     │
│     • Hooks eliminate need for classes                           │
│     • useState replaces this.state                               │
│                                                                  │
│  ⚠️ Could improve:                                               │
│     • Didn't mention useEffect for side effects                  │
│     • Missing the "rules of Hooks"                               │
│                                                                  │
│  💡 Suggested review: Re-read section on useEffect               │
│                                                                  │
│  [Add to Review Queue] [Mark as Understood] [Try Again]          │
└─────────────────────────────────────────────────────────────────┘
```

#### Evaluation Prompt
```javascript
async function evaluateTeachBack(highlight, userExplanation) {
  const prompt = `
    Original text: "${highlight}"

    User's explanation: "${userExplanation}"

    Evaluate the explanation:
    1. What concepts were correctly explained?
    2. What was missing or incorrect?
    3. Overall understanding score (0-100)
    4. Suggested areas for review

    Format as JSON.
  `;

  return await callGeminiAPI(prompt);
}
```

### 7.3 Feature: Flashcard Deck

#### Concept
Convert insights and Q&A into flashcards for review.

#### Card Types
```
┌─────────────────────────────────────────────────────────────────┐
│  TYPE 1: Insight Card                                            │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │ FRONT              │    │ BACK               │             │
│  │                    │ →  │                    │             │
│  │ What's the key     │    │ Hooks simplify     │             │
│  │ benefit of Hooks?  │    │ state management   │             │
│  │                    │    │ by eliminating...  │             │
│  └─────────────────────┘    └─────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  TYPE 2: Cloze Card                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │ React Hooks must   │    │ React Hooks must   │             │
│  │ be called at the   │ →  │ be called at the   │             │
│  │ _____ of the       │    │ TOP of the         │             │
│  │ component.         │    │ component.         │             │
│  └─────────────────────┘    └─────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  TYPE 3: Quiz Card                                               │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │ Which Hook is used │    │ Answer: B          │             │
│  │ for side effects?  │ →  │                    │             │
│  │ A) useState        │    │ useEffect handles  │             │
│  │ B) useEffect       │    │ side effects like  │             │
│  │ C) useContext      │    │ API calls, timers  │             │
│  └─────────────────────┘    └─────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

#### Data Model
```javascript
interface Flashcard {
  id: string;
  type: 'insight' | 'cloze' | 'quiz';
  front: string;
  back: string;
  sourceSessionId: string;
  sourceHighlight: string;

  // Spaced repetition fields
  interval: number;       // Days until next review
  easeFactor: number;     // Difficulty multiplier
  dueDate: number;        // Timestamp
  reviewCount: number;
  lastReviewDate: number;
}
```

#### Add to Deck Flow
```javascript
async function addToDeck(insight, type = 'insight') {
  const card = await generateFlashcard(insight, type);

  const deck = await loadDeck();
  deck.cards.push({
    ...card,
    interval: 1,           // First review tomorrow
    easeFactor: 2.5,       // Default ease
    dueDate: Date.now() + 24 * 60 * 60 * 1000,
    reviewCount: 0
  });

  await saveDeck(deck);
  showToast('Added to review deck!', 'success');
}
```

### 7.4 Feature: Spaced Repetition Scheduler

#### Concept
Schedule reviews based on forgetting curve.

#### Algorithm (SM-2 Variant)
```javascript
function calculateNextReview(card, quality) {
  // quality: 0-5 (0=complete fail, 5=perfect recall)

  if (quality < 3) {
    // Failed - reset to beginning
    return {
      interval: 1,
      easeFactor: Math.max(1.3, card.easeFactor - 0.2)
    };
  }

  let newInterval;
  if (card.reviewCount === 0) {
    newInterval = 1;
  } else if (card.reviewCount === 1) {
    newInterval = 3;
  } else {
    newInterval = Math.round(card.interval * card.easeFactor);
  }

  const newEase = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  return {
    interval: Math.min(newInterval, 365),  // Cap at 1 year
    easeFactor: Math.max(1.3, newEase)
  };
}
```

#### Review Schedule Visualization
```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Your Review Schedule                                         │
│                                                                  │
│  Today (5 cards due)                                             │
│  ├── React Hooks basics (3 days overdue!)                        │
│  ├── useState vs useReducer                                      │
│  ├── Custom Hooks patterns                                       │
│  ├── useEffect cleanup                                           │
│  └── Rules of Hooks                                              │
│                                                                  │
│  Tomorrow (2 cards)                                              │
│  ├── Vue Composition API                                         │
│  └── Reactive references                                         │
│                                                                  │
│  This Week (8 cards)                                             │
│  └── [View all...]                                               │
│                                                                  │
│  [Start Review Session]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 Feature: Learning Loop

#### Concept
Complete cycle: Read → Quiz → Evaluate → Create Next Card

#### Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                        LEARNING LOOP                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  │
│   │  READ   │ ──→ │  QUIZ   │ ──→ │ EVALUATE│ ──→ │  NEXT   │  │
│   │         │     │         │     │         │     │  CARD   │  │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘  │
│       ↑                                               │         │
│       └───────────────────────────────────────────────┘         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: READ                                                    │
│  - Highlight text                                                │
│  - Chat with AI                                                  │
│  - Create insight                                                │
│                                                                  │
│  Step 2: QUIZ                                                    │
│  - Auto-generated from highlight                                 │
│  - Tiered difficulty                                             │
│  - Immediate feedback                                            │
│                                                                  │
│  Step 3: EVALUATE                                                │
│  - Comprehension score                                           │
│  - Identify gaps                                                 │
│  - Suggest review areas                                          │
│                                                                  │
│  Step 4: NEXT CARD                                               │
│  - Add to flashcard deck                                         │
│  - Schedule for spaced repetition                                │
│  - Connect to knowledge graph                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.6 Feature: Comprehension Scoring

#### Metrics
```javascript
interface ComprehensionMetrics {
  sessionId: string;

  // Reading engagement
  readingMetrics: {
    timeSpent: number;           // ms
    scrollDepth: number;         // 0-100%
    highlightCount: number;
    highlightDensity: number;    // highlights per 1000 words
  };

  // Interaction quality
  interactionMetrics: {
    questionsAsked: number;
    bloomLevelReached: number;   // 1-6
    insightsCreated: number;
  };

  // Assessment results
  assessmentMetrics: {
    quizScore: number;           // 0-100%
    teachBackScore: number;      // 0-100%
    recallAccuracy: number;      // 0-100%
  };

  // Computed
  overallScore: number;          // Weighted average
  comprehensionLevel: 'surface' | 'developing' | 'proficient' | 'deep';
}
```

#### Score Calculation
```javascript
function calculateComprehensionScore(metrics) {
  const weights = {
    readingEngagement: 0.2,
    interactionQuality: 0.3,
    assessmentResults: 0.5
  };

  const readingScore = (
    metrics.readingMetrics.scrollDepth * 0.3 +
    Math.min(metrics.readingMetrics.highlightDensity * 20, 100) * 0.4 +
    Math.min(metrics.readingMetrics.timeSpent / 600000, 1) * 100 * 0.3
  );

  const interactionScore = (
    Math.min(metrics.interactionMetrics.questionsAsked * 15, 100) * 0.3 +
    (metrics.interactionMetrics.bloomLevelReached / 6) * 100 * 0.4 +
    Math.min(metrics.interactionMetrics.insightsCreated * 25, 100) * 0.3
  );

  const assessmentScore = (
    metrics.assessmentMetrics.quizScore * 0.4 +
    metrics.assessmentMetrics.teachBackScore * 0.4 +
    metrics.assessmentMetrics.recallAccuracy * 0.2
  );

  return (
    readingScore * weights.readingEngagement +
    interactionScore * weights.interactionQuality +
    assessmentScore * weights.assessmentResults
  );
}
```

---

## 8. Phase 3: Semantic Brain

**Duration:** 4-6 weeks
**Priority:** MEDIUM
**Dependency:** Phase 2 complete

### 8.1 Feature: Embedding Service

#### Concept
Vector representations of notes for semantic search.

#### Implementation
```javascript
class EmbeddingService {
  constructor() {
    this.model = 'text-embedding-004';  // Gemini embedding model
    this.dimension = 768;
    this.cache = new Map();
  }

  async embed(text) {
    const cacheKey = this.hashText(text);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] }
        })
      }
    );

    const data = await response.json();
    const embedding = data.embedding.values;

    this.cache.set(cacheKey, embedding);
    return embedding;
  }

  async embedSession(session) {
    // Combine session content for embedding
    const content = [
      session.title,
      ...session.highlights.map(h => h.text),
      ...session.insights.map(i => i.text)
    ].join('\n\n');

    return await this.embed(content);
  }

  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

#### Storage (IndexedDB)
```javascript
const VECTOR_DB = 'atom_vectors';
const VECTOR_STORE = 'embeddings';

async function storeEmbedding(sessionId, embedding) {
  const db = await openDB(VECTOR_DB, 1, {
    upgrade(db) {
      db.createObjectStore(VECTOR_STORE, { keyPath: 'sessionId' });
    }
  });

  await db.put(VECTOR_STORE, {
    sessionId,
    embedding,
    timestamp: Date.now()
  });
}
```

### 8.2 Feature: Semantic Search

#### Concept
Find related notes by meaning, not just keywords.

#### Implementation
```javascript
async function findRelated(queryText, topK = 5) {
  const queryEmbedding = await embeddingService.embed(queryText);

  // Get all stored embeddings
  const db = await openDB(VECTOR_DB);
  const allEmbeddings = await db.getAll(VECTOR_STORE);

  // Calculate similarities
  const similarities = allEmbeddings.map(item => ({
    sessionId: item.sessionId,
    similarity: embeddingService.cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // Sort and return top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

### 8.3 Feature: "Related from Memory"

#### Concept
Show relevant past notes when reading new content.

#### User Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  User opens article about "Vue Composition API"                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  System:                                                         │
│  1. Extract page title + first paragraphs                        │
│  2. Generate embedding                                           │
│  3. Search against stored embeddings                             │
│  4. Find: "React Hooks" session (0.87 similarity)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Sidepanel shows:                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  💭 Related from your Memory                                │ │
│  │                                                             │ │
│  │  This reminds me of your notes on:                          │ │
│  │                                                             │ │
│  │  📚 "React Hooks Explained" (87% similar)                   │ │
│  │     Read 3 days ago • 2 insights                            │ │
│  │     "Hooks simplify state management by..."                 │ │
│  │                                                             │ │
│  │  🔗 Connection: Both discuss reactive state patterns        │ │
│  │                                                             │ │
│  │  [View Notes] [Compare Concepts] [Dismiss]                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Feature: Auto-Connection Detection

#### Concept
Automatically identify relationships between sessions.

#### Connection Types
```javascript
const CONNECTION_TYPES = {
  SUPPORTS: {
    id: 'supports',
    label: 'Supports',
    icon: '✅',
    color: '#10B981',
    description: 'This reinforces or provides evidence for'
  },
  CONTRADICTS: {
    id: 'contradicts',
    label: 'Contradicts',
    icon: '⚠️',
    color: '#EF4444',
    description: 'This conflicts or disagrees with'
  },
  EXTENDS: {
    id: 'extends',
    label: 'Extends',
    icon: '➕',
    color: '#3B82F6',
    description: 'This builds upon or elaborates on'
  },
  SIMILAR: {
    id: 'similar',
    label: 'Similar',
    icon: '🔄',
    color: '#8B5CF6',
    description: 'This covers similar concepts to'
  },
  APPLIES: {
    id: 'applies',
    label: 'Applies',
    icon: '🔧',
    color: '#F59E0B',
    description: 'This is a practical application of'
  }
};
```

#### Detection Logic
```javascript
async function detectConnections(currentSession, candidateSessions) {
  const connections = [];

  for (const candidate of candidateSessions) {
    // Skip if same session
    if (candidate.id === currentSession.id) continue;

    // Check semantic similarity
    const similarity = await calculateSimilarity(currentSession, candidate);
    if (similarity < 0.6) continue;  // Skip low similarity

    // Analyze relationship type using AI
    const relationship = await analyzeRelationship(
      currentSession.insights,
      candidate.insights
    );

    if (relationship.confidence > 0.7) {
      connections.push({
        sourceId: currentSession.id,
        targetId: candidate.id,
        type: relationship.type,
        confidence: relationship.confidence,
        explanation: relationship.explanation
      });
    }
  }

  return connections;
}

async function analyzeRelationship(insights1, insights2) {
  const prompt = `
    Compare these two sets of insights:

    Set A: ${JSON.stringify(insights1)}
    Set B: ${JSON.stringify(insights2)}

    Determine the relationship:
    - SUPPORTS: A provides evidence for B (or vice versa)
    - CONTRADICTS: A disagrees with B
    - EXTENDS: A builds upon B
    - SIMILAR: A and B cover similar topics
    - APPLIES: A is a practical application of B
    - NONE: No meaningful relationship

    Respond with JSON: { type, confidence, explanation }
  `;

  return await callGeminiAPI(prompt);
}
```

### 8.5 Feature: Knowledge Graph Visualization

#### Concept
Visual map of connected knowledge.

#### Data Structure
```javascript
interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    label: string;
    type: 'session' | 'insight' | 'topic';
    metadata: {
      url?: string;
      date?: number;
      score?: number;
    };
  }>;

  edges: Array<{
    source: string;
    target: string;
    type: ConnectionType;
    weight: number;
  }>;
}
```

#### Visualization (Canvas-based)
```
┌─────────────────────────────────────────────────────────────────┐
│  🗺️ Your Knowledge Map                                          │
│                                                                  │
│                    ┌─────────────┐                               │
│                    │  React      │                               │
│                    │  Ecosystem  │                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│           ┌───────────────┼───────────────┐                     │
│           │               │               │                      │
│     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐              │
│     │  Hooks    │───│   State   │───│  Effects  │              │
│     └───────────┘   │ Management│   └───────────┘              │
│           │         └───────────┘         │                      │
│           │               │               │                      │
│     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐              │
│     │  useState │   │  Redux    │   │ useEffect │              │
│     └───────────┘   └───────────┘   └───────────┘              │
│                           │                                      │
│                     ┌─────▼─────┐                                │
│                     │   Zustand │  ← Similar to Vue Pinia        │
│                     └───────────┘                                │
│                                                                  │
│  [Zoom In] [Filter by Date] [Filter by Topic] [Export]          │
└─────────────────────────────────────────────────────────────────┘
```

### 8.6 Feature: Cross-Domain Alerts

#### Concept
Notify when new reading connects to past knowledge.

#### Alert Types
```javascript
const ALERT_TEMPLATES = {
  SIMILAR_CONCEPT: {
    title: "This looks familiar!",
    template: "'{current}' is similar to '{past}' you read {timeAgo}."
  },
  CONTRADICTION: {
    title: "Different perspective!",
    template: "This contradicts what you read about '{topic}' in '{past}'."
  },
  BUILDING_BLOCK: {
    title: "Building on your knowledge!",
    template: "This extends your understanding of '{topic}' from '{past}'."
  },
  PRACTICAL_APPLICATION: {
    title: "Now you can apply it!",
    template: "This shows how to apply '{concept}' you learned in '{past}'."
  }
};
```

#### Trigger Flow
```
┌─────────────────────────────────────────────────────────────────┐
│  1. User highlights text about "Composition API"                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. System generates embedding, searches memory                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Finds high similarity with "React Hooks" session             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Shows alert:                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  💡 This looks familiar!                                    │ │
│  │                                                             │ │
│  │  "Composition API" is similar to "React Hooks" you read     │ │
│  │  3 days ago.                                                │ │
│  │                                                             │ │
│  │  Both are about: reactive state management                  │ │
│  │                                                             │ │
│  │  [Compare Side-by-Side] [Add Connection] [Dismiss]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Models

### 9.1 Core Models

```typescript
// ==========================================
// READING SESSION (Unified)
// ==========================================

interface ReadingSession {
  id: string;
  url: string;
  title: string;
  domain: string;
  createdAt: number;
  updatedAt: number;

  // Pre-reading
  learningObjective?: {
    mode: 'skim' | 'deep';
    questions: string[];
    acceptedAt: number;
  };

  // Highlights
  highlights: Highlight[];

  // Reading Card (from context menu)
  card?: {
    mode: 'summary' | 'critique' | 'quiz';
    keyPoints: string[];
    questions: Question[];
    evaluation?: string;
    score?: number;
  };

  // Chat Thread (from sidepanel)
  thread?: {
    messages: Message[];
    status: 'active' | 'parked' | 'done';
  };

  // Insights (from both)
  insights: Insight[];

  // Focus Session
  focusSession?: FocusSession;

  // Connections
  connections: Connection[];

  // Metrics
  metrics: ComprehensionMetrics;

  // Export
  exportedToNLM: boolean;
  exportedAt?: number;

  // Embedding
  embedding?: number[];
  embeddedAt?: number;
}

// ==========================================
// HIGHLIGHT
// ==========================================

interface Highlight {
  id: string;
  text: string;
  surroundingContext: string;
  sectionHeading?: string;
  position: {
    paragraphIndex: number;
    charOffset: number;
  };
  createdAt: number;
}

// ==========================================
// MESSAGE
// ==========================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;

  // Evidence (for assistant messages)
  evidence?: {
    quote: string;
    location: string;
  }[];

  // Metadata
  action?: string;  // Quick action that triggered this
  contextLevel?: 'minimal' | 'standard' | 'full';
}

// ==========================================
// INSIGHT
// ==========================================

interface Insight {
  id: string;
  text: string;
  source: 'card' | 'thread' | 'user' | 'ai';
  highlightId?: string;
  createdAt: number;

  // Review
  addedToFlashcards: boolean;
  flashcardId?: string;
}

// ==========================================
// FLASHCARD
// ==========================================

interface Flashcard {
  id: string;
  type: 'insight' | 'cloze' | 'quiz';
  front: string;
  back: string;

  // Source
  sourceSessionId: string;
  sourceHighlightId?: string;
  sourceInsightId?: string;

  // Spaced Repetition
  interval: number;
  easeFactor: number;
  dueDate: number;
  reviewCount: number;
  lastReviewDate?: number;
  lastQuality?: number;

  // Stats
  correctCount: number;
  incorrectCount: number;
}

// ==========================================
// CONNECTION
// ==========================================

interface Connection {
  id: string;
  sourceSessionId: string;
  targetSessionId: string;
  type: 'supports' | 'contradicts' | 'extends' | 'similar' | 'applies';
  confidence: number;
  explanation: string;
  createdAt: number;
  createdBy: 'auto' | 'user';
}

// ==========================================
// FOCUS SESSION
// ==========================================

interface FocusSession {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  workMin: number;
  breakMin: number;

  // Metrics during session
  metrics: {
    highlightsCreated: number;
    insightsCreated: number;
    messagesExchanged: number;
    scrollDepth: number;
  };

  // End-of-session review
  review?: {
    recallQuestion: string;
    recallAnswer?: string;
    recallScore?: number;
  };
}

// ==========================================
// NUDGE
// ==========================================

interface Nudge {
  id: string;
  type: 'fast_scroll' | 'passive_reading' | 'section_end' | 'completion';
  message: string;
  actions: string[];
  triggeredAt: number;
  response?: {
    action: string;
    timestamp: number;
  };
}

// ==========================================
// REVIEW QUEUE
// ==========================================

interface ReviewQueue {
  dueToday: Flashcard[];
  upcoming: {
    tomorrow: Flashcard[];
    thisWeek: Flashcard[];
    later: Flashcard[];
  };
  overdue: Flashcard[];

  stats: {
    totalCards: number;
    masteredCards: number;
    learningCards: number;
    newCards: number;
  };
}
```

### 9.2 Storage Keys

```javascript
const STORAGE_KEYS = {
  // Core
  SESSIONS: 'atom_reading_sessions_v3',
  FLASHCARDS: 'atom_flashcard_deck_v1',
  CONNECTIONS: 'atom_connections_v1',

  // Config
  USER_PREFERENCES: 'atom_user_prefs_v1',
  AI_CONFIG: 'atom_ai_config_v1',

  // Vectors (IndexedDB)
  VECTOR_DB: 'atom_vectors',

  // Review
  REVIEW_SCHEDULE: 'atom_review_schedule_v1',
  REVIEW_HISTORY: 'atom_review_history_v1',

  // Analytics
  COMPREHENSION_METRICS: 'atom_comprehension_v1',
  NUDGE_HISTORY: 'atom_nudge_history_v1',

  // Migration
  MIGRATION_STATUS: 'atom_migration_status'
};
```

---

## 10. API & Integration

### 10.1 Gemini API Usage

| Feature | Model | Purpose |
|---------|-------|---------|
| Chat | gemini-2.0-flash | Fast responses for chat |
| Quiz Generation | gemini-2.0-flash | Generate questions |
| Teach-Back Eval | gemini-2.0-flash | Evaluate explanations |
| Insight Generation | gemini-2.0-flash | Create atomic thoughts |
| Pre-reading Primer | gemini-2.0-flash | Generate objectives |
| Embeddings | text-embedding-004 | Semantic vectors |
| Connection Analysis | gemini-2.0-flash | Relationship detection |

### 10.2 Token Budget

| Phase | Est. Tokens/Session | Monthly (100 sessions) |
|-------|---------------------|------------------------|
| Current | ~50,000 | 5M tokens |
| After Phase 0 | ~10,000 | 1M tokens (-80%) |
| With Phase 2 | ~15,000 | 1.5M tokens |
| With Phase 3 | ~20,000 | 2M tokens |

### 10.3 NotebookLM Integration

```javascript
interface NLMExport {
  mode: 'ui-assisted' | 'api';

  // UI-Assisted
  clipFormat: {
    title: string;
    url: string;
    capturedAt: string;
    readingMode: string;
    highlightedPassage: string;
    keyInsight: string;
    tags: string[];
  };

  // API (future)
  apiPayload?: {
    notebookId: string;
    sourceType: 'text';
    content: string;
  };
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

```javascript
// tests/unit/

describe('ReadingSessionService', () => {
  it('creates new session for new URL');
  it('returns existing session for same URL within 24h');
  it('adds highlight to session');
  it('syncs insights between card and thread');
});

describe('TokenOptimization', () => {
  it('uses MINIMAL context after 3 messages');
  it('uses FULL context for summarize action');
  it('produces prompt < 2000 chars for STANDARD');
});

describe('SpacedRepetition', () => {
  it('calculates next interval correctly');
  it('decreases interval on failure');
  it('increases ease factor on success');
});

describe('EmbeddingService', () => {
  it('generates consistent embeddings');
  it('calculates similarity correctly');
  it('caches embeddings');
});
```

### 11.2 Integration Tests

```javascript
// tests/integration/

describe('Full Learning Loop', () => {
  it('highlight → chat → insight → flashcard → review');
  it('pre-reading → reading → quiz → score');
  it('focus timer → reading → end review');
});

describe('Cross-Session Connections', () => {
  it('detects similar sessions');
  it('shows "Related from Memory"');
  it('creates connections');
});
```

### 11.3 Manual Testing Checklist

| Feature | Test Case | Expected |
|---------|-----------|----------|
| Token Opt | Send 5 messages, check console | Context level changes |
| Evidence | Ask about highlight | Response has 📍 Evidence |
| Pre-reading | Open new article | Primer shown |
| Nudge | Scroll fast without highlighting | Nudge appears |
| Timer | Start focus, end session | Review prompt shown |
| Quiz | Generate quiz from highlight | 3 tiered questions |
| Flashcard | Add insight to deck | Card created |
| Review | Complete review session | Interval updated |
| Semantic | Read similar article | "Related" shown |

---

## 12. Rollout Plan

### 12.1 Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│  WEEK 1-2: Phase 0                                               │
│  - Token optimization                                            │
│  - Evidence snippets                                             │
│  - Data sync                                                     │
│  - Save button UX                                                │
│  - Migration script                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  WEEK 3-5: Phase 1                                               │
│  - Pre-reading primer                                            │
│  - Learning objective selector                                   │
│  - Bloom's taxonomy chips                                        │
│  - Smart nudges                                                  │
│  - Timer integration                                             │
│  - Auto-summarize                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  WEEK 6-9: Phase 2                                               │
│  - Tiered quiz system                                            │
│  - Teach-back mode                                               │
│  - Flashcard deck                                                │
│  - Spaced repetition                                             │
│  - Learning loop                                                 │
│  - Comprehension scoring                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  WEEK 10-15: Phase 3                                             │
│  - Embedding service                                             │
│  - Semantic search                                               │
│  - "Related from Memory"                                         │
│  - Auto-connections                                              │
│  - Knowledge graph                                               │
│  - Cross-domain alerts                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Release Strategy

| Version | Phase | Key Features |
|---------|-------|--------------|
| v2.7 | 0 | Technical debt fixes |
| v2.8 | 1a | Pre-reading, Learning modes |
| v2.9 | 1b | Nudges, Timer integration |
| v3.0 | 2a | Quiz, Flashcards |
| v3.1 | 2b | Spaced repetition, Scoring |
| v3.2 | 3a | Embeddings, Semantic search |
| v3.3 | 3b | Knowledge graph, Connections |

### 12.3 Feature Flags

```javascript
const FEATURE_FLAGS = {
  // Phase 0
  SMART_CONTEXT: true,
  EVIDENCE_REQUIRED: true,
  UNIFIED_SESSIONS: true,
  QUICK_SAVE: true,

  // Phase 1
  PRE_READING_PRIMER: false,
  LEARNING_OBJECTIVES: false,
  BLOOM_TAXONOMY: false,
  SMART_NUDGES: false,
  TIMER_INTEGRATION: false,

  // Phase 2
  TIERED_QUIZ: false,
  TEACH_BACK: false,
  FLASHCARDS: false,
  SPACED_REPETITION: false,

  // Phase 3
  EMBEDDINGS: false,
  SEMANTIC_SEARCH: false,
  KNOWLEDGE_GRAPH: false,
  CROSS_DOMAIN_ALERTS: false
};
```

---

## 13. Success Metrics

### 13.1 Phase 0 Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Avg prompt length | 16,000 chars | < 2,000 chars | Console logging |
| Grounded responses | Unknown | > 90% | Sample review |
| Data integrity | Disconnected | 100% synced | Unit tests |
| Save discovery | ~30% | 100% | UI visible |

### 13.2 Phase 1 Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Pre-reading adoption | 0% | 60% | Analytics |
| Highlights/session | 2-3 | 5-7 | Tracking |
| Nudge response rate | N/A | 50% | Analytics |
| Timer sessions linked | 0% | 80% | Tracking |

### 13.3 Phase 2 Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Quiz completion | 0% | 70% | Analytics |
| Flashcard creation | 0% | 50% of insights | Tracking |
| Review streak | N/A | 5+ days avg | Analytics |
| 7-day retention | ~20% | 70% | Quiz retake |

### 13.4 Phase 3 Metrics

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Sessions with embeddings | 0% | 100% | Database |
| Related shown | 0% | 30% of sessions | Analytics |
| Connections created | 0 | 10+/week | Tracking |
| Graph interactions | 0 | 5+/week | Analytics |

---

## 14. Appendix

### 14.1 Glossary

| Term | Definition |
|------|------------|
| **Atomic Thought** | A single, concise insight distilled from discussion |
| **Bloom's Taxonomy** | 6-level framework for cognitive learning objectives |
| **Cloze Card** | Flashcard with fill-in-the-blank format |
| **Evidence Snippet** | Direct quote from source text in AI response |
| **Forgetting Curve** | Rate at which memory decays without review |
| **Grounding** | Connecting AI responses to source material |
| **Learning Loop** | Cycle of Read → Quiz → Evaluate → Create |
| **Nudge** | Proactive intervention to encourage engagement |
| **Pre-reading Primer** | Guiding questions before reading |
| **Semantic Similarity** | Meaning-based closeness between texts |
| **SM-2** | Spaced repetition algorithm |
| **Teach-Back** | Learning technique where student explains concept |
| **Thread** | Conversation chain about a specific highlight |

### 14.2 References

1. Bloom's Taxonomy: https://cft.vanderbilt.edu/guides-sub-pages/blooms-taxonomy/
2. SM-2 Algorithm: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
3. Forgetting Curve: Ebbinghaus, H. (1885)
4. Active Reading Strategies: https://learningcenter.unc.edu/tips-and-tools/reading-strategies/
5. Gemini API: https://ai.google.dev/docs

### 14.3 File Structure (Target)

```
ATOM_Extension_V3/
├── manifest.json
├── background.js
├── content.js
├── sidepanel.html
├── sidepanel.js
├── popup.html
├── popup.js
├── options.html
├── options.js
│
├── services/
│   ├── reading_session.js      # Unified session management
│   ├── context_extractor.js    # Smart context extraction
│   ├── evidence_validator.js   # Response grounding
│   ├── learning_objective.js   # Bloom's taxonomy
│   ├── nudge_engine.js         # Proactive interventions
│   ├── timer_integration.js    # Focus-Reading bridge
│   ├── quiz_generator.js       # Tiered quiz creation
│   ├── spaced_repetition.js    # Review scheduling
│   ├── flashcard_deck.js       # Flashcard management
│   ├── embedding_service.js    # Vector operations
│   ├── semantic_search.js      # Similarity search
│   └── knowledge_graph.js      # Connection visualization
│
├── storage/
│   ├── session_store.js        # Chrome storage wrapper
│   ├── vector_store.js         # IndexedDB for embeddings
│   └── migration.js            # Data migration scripts
│
├── ui/
│   ├── components/
│   │   ├── primer.js           # Pre-reading primer
│   │   ├── nudge.js            # Nudge popups
│   │   ├── quiz.js             # Quiz interface
│   │   ├── flashcard.js        # Flashcard UI
│   │   ├── review.js           # Review session
│   │   └── graph.js            # Knowledge graph
│   └── styles/
│       ├── primer.css
│       ├── nudge.css
│       ├── quiz.css
│       └── graph.css
│
├── bridge/
│   └── (existing NLM bridge files)
│
├── config/
│   ├── ai_config.js
│   └── feature_flags.js
│
├── _locales/
│   ├── en/messages.json
│   └── vi/messages.json
│
├── spec/
│   ├── MASTER_SPEC_ACTIVE_READING_3.0.md  # This document
│   ├── PHASE_0_TECHNICAL_DEBT.md
│   └── (other specs)
│
└── tests/
    ├── unit/
    └── integration/
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-02-01 | Dev Team | Initial comprehensive spec |

---

**End of Specification**
