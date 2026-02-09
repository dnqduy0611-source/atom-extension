# Phase 0: Technical Debt - Implementation Spec

**Version:** 1.0
**Duration:** 1-2 weeks
**Priority:** CRITICAL
**Dependencies:** None (foundation for all phases)

---

## Overview

Phase 0 focuses on fixing foundational technical issues that must be resolved before implementing new features. These changes will reduce API costs by ~80% and create a unified data model for future development.

---

## Task 0.1: Token Optimization (Smart Context)

### Objective
Reduce Gemini API token usage from ~50,000 tokens/session to ~10,000 tokens/session by implementing smart context extraction.

### Current Problem
```javascript
// sidepanel.js L2318 - buildSystemPrompt()
${pageContext.content.slice(0, 15000)}  // 15k chars sent EVERY request
```

### Implementation Steps

#### Step 1: Create Context Extractor Service

**File:** `services/context_extractor.js` (NEW)

```javascript
/**
 * Context Extractor Service
 * Intelligently extracts relevant context based on action and conversation state.
 */

const CONTEXT_LEVELS = {
  MINIMAL: 'minimal',   // ~500 chars - highlight only + immediate context
  STANDARD: 'standard', // ~1500 chars - highlight + paragraph + heading
  FULL: 'full'          // ~12000 chars - includes page content
};

const CONTEXT_CONFIG = {
  minimal: {
    maxChars: 500,
    includeHighlight: true,
    includeSurrounding: true,  // 1 sentence before/after
    includeHeading: false,
    includePageContent: false
  },
  standard: {
    maxChars: 1500,
    includeHighlight: true,
    includeSurrounding: true,  // Full paragraph
    includeHeading: true,
    includePageContent: false
  },
  full: {
    maxChars: 12000,
    includeHighlight: true,
    includeSurrounding: true,
    includeHeading: true,
    includePageContent: true
  }
};

/**
 * Determines the appropriate context level based on action and conversation state.
 * @param {string} action - The quick action being performed
 * @param {number} messageCount - Number of messages in current thread
 * @param {boolean} isFirstMessage - Whether this is the first message in thread
 * @returns {string} Context level: 'minimal' | 'standard' | 'full'
 */
function determineContextLevel(action, messageCount, isFirstMessage) {
  // Full context actions - need entire page
  const fullContextActions = [
    'summarize_page',
    'analyze_structure',
    'overview',
    'outline'
  ];

  if (fullContextActions.includes(action)) {
    return CONTEXT_LEVELS.FULL;
  }

  // After 3 messages, AI has context - use minimal
  if (messageCount > 3) {
    return CONTEXT_LEVELS.MINIMAL;
  }

  // First message or early conversation - use standard
  return CONTEXT_LEVELS.STANDARD;
}

/**
 * Extracts smart context based on the determined level.
 * @param {Object} pageContext - Full page context from content.js
 * @param {Object} highlight - Current highlight object
 * @param {string} level - Context level to extract
 * @returns {Object} Extracted context
 */
function extractSmartContext(pageContext, highlight, level) {
  const config = CONTEXT_CONFIG[level];
  const context = {
    level: level,
    highlight: null,
    surrounding: null,
    heading: null,
    pageContent: null,
    totalChars: 0
  };

  // Always include highlight
  if (config.includeHighlight && highlight) {
    context.highlight = highlight.text;
    context.totalChars += highlight.text.length;
  }

  // Include surrounding context
  if (config.includeSurrounding && highlight) {
    context.surrounding = extractSurroundingText(
      pageContext,
      highlight,
      level === 'minimal' ? 100 : 300  // chars before/after
    );
    context.totalChars += (context.surrounding?.length || 0);
  }

  // Include section heading
  if (config.includeHeading) {
    context.heading = findNearestHeading(pageContext, highlight);
    context.totalChars += (context.heading?.length || 0);
  }

  // Include page content (truncated)
  if (config.includePageContent) {
    const remainingChars = config.maxChars - context.totalChars;
    context.pageContent = pageContext.content?.slice(0, remainingChars);
    context.totalChars += (context.pageContent?.length || 0);
  }

  return context;
}

/**
 * Extracts text surrounding the highlight.
 */
function extractSurroundingText(pageContext, highlight, charLimit) {
  if (!pageContext.content || !highlight.text) return null;

  const content = pageContext.content;
  const highlightIndex = content.indexOf(highlight.text);

  if (highlightIndex === -1) return null;

  const start = Math.max(0, highlightIndex - charLimit);
  const end = Math.min(content.length, highlightIndex + highlight.text.length + charLimit);

  let surrounding = content.slice(start, end);

  // Clean up - try to start/end at sentence boundaries
  if (start > 0) {
    const sentenceStart = surrounding.indexOf('. ');
    if (sentenceStart !== -1 && sentenceStart < 50) {
      surrounding = surrounding.slice(sentenceStart + 2);
    }
  }

  return surrounding;
}

/**
 * Finds the nearest heading before the highlight.
 */
function findNearestHeading(pageContext, highlight) {
  if (!pageContext.headings || !pageContext.headings.length) return null;

  // pageContext.headings should be an array of {text, position}
  // Find the heading closest to but before the highlight position
  const highlightPos = highlight.position?.charOffset || 0;

  let nearestHeading = null;
  for (const heading of pageContext.headings) {
    if (heading.position <= highlightPos) {
      nearestHeading = heading.text;
    }
  }

  return nearestHeading;
}

/**
 * Builds optimized context string for system prompt.
 */
function buildContextString(smartContext) {
  const parts = [];

  if (smartContext.heading) {
    parts.push(`Section: ${smartContext.heading}`);
  }

  if (smartContext.highlight) {
    parts.push(`Highlighted text: "${smartContext.highlight}"`);
  }

  if (smartContext.surrounding && smartContext.level !== 'minimal') {
    parts.push(`Context: ...${smartContext.surrounding}...`);
  }

  if (smartContext.pageContent) {
    parts.push(`Page content:\n${smartContext.pageContent}`);
  }

  return parts.join('\n\n');
}

// Export functions
export {
  CONTEXT_LEVELS,
  determineContextLevel,
  extractSmartContext,
  buildContextString
};
```

#### Step 2: Update content.js - Add heading extraction

**File:** `content.js`
**Location:** In `getPageContext()` function (or similar)

Add heading extraction:
```javascript
/**
 * Extracts headings from the page with their positions.
 * @returns {Array<{text: string, position: number, level: number}>}
 */
function extractHeadings() {
  const headings = [];
  const headingElements = document.querySelectorAll('h1, h2, h3, h4');

  headingElements.forEach(el => {
    // Calculate approximate character position
    const range = document.createRange();
    range.selectNode(el);
    const rect = range.getBoundingClientRect();

    headings.push({
      text: el.textContent.trim(),
      level: parseInt(el.tagName.charAt(1)),
      position: el.offsetTop  // Use for relative comparison
    });
  });

  return headings;
}

// Update getPageContext to include headings
function getPageContext() {
  return {
    url: window.location.href,
    title: document.title,
    content: document.body.innerText.slice(0, 50000),
    headings: extractHeadings(),  // ADD THIS
    domain: window.location.hostname
  };
}
```

#### Step 3: Update sidepanel.js - Use Smart Context

**File:** `sidepanel.js`
**Location:** `buildSystemPrompt()` function (~L2318)

Replace the current implementation:
```javascript
// BEFORE (remove this):
// ${pageContext.content.slice(0, 15000)}

// AFTER:
import { determineContextLevel, extractSmartContext, buildContextString } from './services/context_extractor.js';

function buildSystemPrompt(thread, pageContext, action) {
  const messageCount = thread.messages?.length || 0;
  const isFirstMessage = messageCount === 0;

  // Determine context level
  const contextLevel = determineContextLevel(action, messageCount, isFirstMessage);

  // Extract smart context
  const smartContext = extractSmartContext(
    pageContext,
    thread.highlight,
    contextLevel
  );

  // Build context string
  const contextString = buildContextString(smartContext);

  // Log for monitoring (remove in production)
  console.log(`[ATOM Context] Level: ${contextLevel}, Chars: ${smartContext.totalChars}`);

  // Build system prompt with optimized context
  return `You are ATOM, an active reading assistant...

${contextString}

[Rest of system prompt...]`;
}
```

#### Step 4: Add Console Logging for Monitoring

Add logging to track token reduction:
```javascript
// In sidepanel.js - before API call
function logContextUsage(smartContext, action) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: action,
    contextLevel: smartContext.level,
    totalChars: smartContext.totalChars,
    hasHighlight: !!smartContext.highlight,
    hasPageContent: !!smartContext.pageContent
  };

  console.log('[ATOM Token Tracking]', logEntry);

  // Optional: Store for analytics
  // chrome.storage.local.get(['tokenLogs'], (result) => {
  //   const logs = result.tokenLogs || [];
  //   logs.push(logEntry);
  //   chrome.storage.local.set({ tokenLogs: logs.slice(-100) });
  // });
}
```

### Success Criteria
- [ ] Default context < 2,000 characters for standard actions
- [ ] 90%+ token reduction for typical chat interactions
- [ ] Console logging shows context level for each request
- [ ] All existing quick actions still work correctly

### Testing
```javascript
// Test cases
describe('Context Extractor', () => {
  it('returns FULL for summarize_page action', () => {
    const level = determineContextLevel('summarize_page', 0, true);
    expect(level).toBe('full');
  });

  it('returns MINIMAL after 3 messages', () => {
    const level = determineContextLevel('explain', 4, false);
    expect(level).toBe('minimal');
  });

  it('returns STANDARD for first message', () => {
    const level = determineContextLevel('explain', 0, true);
    expect(level).toBe('standard');
  });

  it('extracts context under char limit', () => {
    const context = extractSmartContext(mockPage, mockHighlight, 'standard');
    expect(context.totalChars).toBeLessThan(1500);
  });
});
```

---

## Task 0.2: Evidence Snippets (Response Grounding)

### Objective
Ensure AI responses cite source text to prevent hallucinations and improve user trust.

### Current Problem
AI responses lack direct references to the highlighted text, making it difficult to verify accuracy.

### Implementation Steps

#### Step 1: Update System Prompt

**File:** `sidepanel.js` or `ai_service.js`
**Location:** System prompt template

Add evidence requirement to system prompt:
```javascript
const SYSTEM_PROMPT_EVIDENCE = `
IMPORTANT: Your responses MUST include evidence from the source text.

Format your responses as follows:
1. Start with a direct quote from the highlighted text as evidence
2. Then provide your analysis

Use this format:
---
📍 **Evidence:** "exact quote from the highlight or surrounding context"

💡 **Analysis:** Your explanation, interpretation, or answer here...
---

If making multiple points, cite evidence for each:
---
📍 **Evidence 1:** "quote supporting first point"
💡 **Point 1:** Your first observation...

📍 **Evidence 2:** "quote supporting second point"
💡 **Point 2:** Your second observation...
---

NEVER make claims that cannot be traced back to the source text.
If asked about something not in the text, explicitly say "This is not mentioned in the text, but..."
`;
```

#### Step 2: Update Quick Action Prompts

**File:** `sidepanel.js`
**Location:** Quick action definitions

Update each quick action to require evidence:
```javascript
const QUICK_ACTIONS = {
  summarize: {
    label: 'Tóm tắt',
    icon: '📋',
    prompt: `Summarize the highlighted text.

REQUIRED FORMAT:
📍 **Key passages:** Quote 2-3 key sentences from the text
💡 **Summary:** Your concise summary based on these passages`,
    requiresEvidence: true
  },

  explain: {
    label: 'Giải thích',
    icon: '💡',
    prompt: `Explain what this text means in simpler terms.

REQUIRED FORMAT:
📍 **Original:** Quote the key phrase or sentence being explained
💡 **Explanation:** Your simplified explanation`,
    requiresEvidence: true
  },

  keypoints: {
    label: 'Ý chính',
    icon: '🔑',
    prompt: `Extract the main points from this text.

REQUIRED FORMAT:
For each key point:
📍 **Evidence:** "quote that supports this point"
💡 **Key point:** Your description of the point`,
    requiresEvidence: true
  },

  counter: {
    label: 'Phản biện',
    icon: '🤔',
    prompt: `Provide counter-arguments or alternative perspectives.

REQUIRED FORMAT:
📍 **Author's claim:** "quote the claim being countered"
💡 **Counter-argument:** Your alternative perspective

Note: Counter-arguments should reference what the author said, even if disagreeing.`,
    requiresEvidence: true
  },

  // ... update all other actions similarly
};
```

#### Step 3: Create Evidence Validator (Optional Enhancement)

**File:** `services/evidence_validator.js` (NEW)

```javascript
/**
 * Evidence Validator Service
 * Validates that AI responses contain proper evidence citations.
 */

/**
 * Checks if response contains evidence markers.
 * @param {string} response - AI response text
 * @returns {Object} Validation result
 */
function validateEvidence(response) {
  const evidenceMarkers = ['📍', '**Evidence**', '**Evidence:**', 'Evidence:'];
  const hasEvidence = evidenceMarkers.some(marker => response.includes(marker));

  // Check for quoted text (text in quotation marks)
  const quotePattern = /"[^"]{10,}"/g;  // At least 10 chars in quotes
  const quotes = response.match(quotePattern) || [];

  return {
    hasEvidenceMarker: hasEvidence,
    quotedTextCount: quotes.length,
    isValid: hasEvidence && quotes.length > 0,
    quotes: quotes
  };
}

/**
 * Extracts evidence citations from response.
 * @param {string} response - AI response text
 * @returns {Array<{quote: string, analysis: string}>}
 */
function extractEvidencePairs(response) {
  const pairs = [];

  // Pattern: 📍 **Evidence:** "quote" followed by 💡 **Analysis:** text
  const pattern = /📍\s*\*?\*?Evidence[^:]*:\*?\*?\s*"([^"]+)"[\s\S]*?💡\s*\*?\*?[^:]*:\*?\*?\s*([^📍💡]+)/gi;

  let match;
  while ((match = pattern.exec(response)) !== null) {
    pairs.push({
      quote: match[1].trim(),
      analysis: match[2].trim()
    });
  }

  return pairs;
}

/**
 * Verifies that quoted evidence exists in source text.
 * @param {string} quote - Quoted text from response
 * @param {string} sourceText - Original source text
 * @returns {boolean}
 */
function verifyQuoteInSource(quote, sourceText) {
  // Normalize both texts for comparison
  const normalizedQuote = quote.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedSource = sourceText.toLowerCase().replace(/\s+/g, ' ');

  // Check for exact match or fuzzy match (80% of words present)
  if (normalizedSource.includes(normalizedQuote)) {
    return true;
  }

  // Fuzzy match - check if most words are present in order
  const quoteWords = normalizedQuote.split(' ');
  const threshold = Math.floor(quoteWords.length * 0.8);

  let foundCount = 0;
  let lastIndex = 0;

  for (const word of quoteWords) {
    const wordIndex = normalizedSource.indexOf(word, lastIndex);
    if (wordIndex !== -1) {
      foundCount++;
      lastIndex = wordIndex + word.length;
    }
  }

  return foundCount >= threshold;
}

export {
  validateEvidence,
  extractEvidencePairs,
  verifyQuoteInSource
};
```

#### Step 4: Display Evidence Nicely in UI

**File:** `sidepanel.js` or sidepanel CSS
**Location:** Message rendering

Add CSS for evidence display:
```css
/* Add to sidepanel.css or inline styles */
.evidence-block {
  background: #f0f9ff;
  border-left: 3px solid #3b82f6;
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 0 4px 4px 0;
}

.evidence-quote {
  font-style: italic;
  color: #1e40af;
}

.analysis-block {
  margin-top: 8px;
}

.evidence-marker {
  font-weight: 600;
  color: #3b82f6;
}

.analysis-marker {
  font-weight: 600;
  color: #059669;
}
```

Parse and render evidence in messages:
```javascript
function renderMessageWithEvidence(content) {
  // Replace evidence markers with styled HTML
  let html = content
    .replace(/📍\s*\*?\*?Evidence[^:]*:\*?\*?/gi, '<span class="evidence-marker">📍 Evidence:</span>')
    .replace(/💡\s*\*?\*?[^:]+:\*?\*?/gi, (match) => `<span class="analysis-marker">${match}</span>`)
    .replace(/"([^"]+)"/g, '<span class="evidence-quote">"$1"</span>');

  return html;
}
```

### Success Criteria
- [ ] 90%+ of AI responses contain evidence citations
- [ ] Evidence is visually distinct in the UI
- [ ] Users can easily verify claims against source text
- [ ] Counter-arguments still reference the original claim

### Testing
```javascript
describe('Evidence Validator', () => {
  it('validates response with proper evidence', () => {
    const response = '📍 **Evidence:** "React Hooks simplify state"\n💡 **Analysis:** This means...';
    const result = validateEvidence(response);
    expect(result.isValid).toBe(true);
  });

  it('fails response without evidence', () => {
    const response = 'React Hooks are great for managing state.';
    const result = validateEvidence(response);
    expect(result.isValid).toBe(false);
  });

  it('verifies quote exists in source', () => {
    const quote = 'React Hooks simplify state';
    const source = 'Using React Hooks simplify state management in functional components.';
    expect(verifyQuoteInSource(quote, source)).toBe(true);
  });
});
```

---

## Task 0.3: Note ↔ Thread Synchronization (Unified ReadingSession)

### Objective
Create a single source of truth for reading data that unifies Reading Cards (content.js) and Chat Threads (sidepanel.js).

### Current Problem
- Reading Card and Thread are disconnected
- Insights created in one don't appear in the other
- No unified session concept

### Implementation Steps

#### Step 1: Create ReadingSession Data Model

**File:** `storage/reading_session.js` (NEW)

```javascript
/**
 * ReadingSession Service
 * Unified session management for reading data.
 */

const STORAGE_KEY = 'atom_reading_sessions_v3';

/**
 * ReadingSession Interface
 * @typedef {Object} ReadingSession
 * @property {string} id - Unique session ID
 * @property {string} url - Page URL
 * @property {string} title - Page title
 * @property {string} domain - Page domain
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 * @property {Array<Highlight>} highlights - All highlights in session
 * @property {Object|null} card - Reading card data
 * @property {Object|null} thread - Chat thread data
 * @property {Array<Insight>} insights - Merged insights from all sources
 * @property {Object|null} focusSession - Linked focus timer session
 * @property {Array<Connection>} connections - Semantic connections
 * @property {Object} metrics - Comprehension metrics
 * @property {boolean} exportedToNLM - Whether exported to NotebookLM
 */

/**
 * Generates a unique session ID.
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generates a unique ID for sub-objects.
 */
function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Creates a new ReadingSession object.
 * @param {string} url - Page URL
 * @param {string} title - Page title
 * @returns {ReadingSession}
 */
function createSession(url, title) {
  const domain = new URL(url).hostname;

  return {
    id: generateSessionId(),
    url: url,
    title: title,
    domain: domain,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    highlights: [],
    card: null,
    thread: null,
    insights: [],
    focusSession: null,
    connections: [],
    metrics: {
      readingMetrics: {
        timeSpent: 0,
        scrollDepth: 0,
        highlightCount: 0,
        highlightDensity: 0
      },
      interactionMetrics: {
        questionsAsked: 0,
        bloomLevelReached: 1,
        insightsCreated: 0
      },
      assessmentMetrics: {
        quizScore: null,
        teachBackScore: null,
        recallAccuracy: null
      }
    },
    exportedToNLM: false
  };
}

/**
 * Gets or creates a session for the given URL.
 * Returns existing session if within 24 hours, otherwise creates new.
 * @param {string} url - Page URL
 * @param {string} title - Page title
 * @returns {Promise<ReadingSession>}
 */
async function getOrCreateSession(url, title) {
  const sessions = await getAllSessions();

  // Normalize URL for comparison (remove hash, trailing slash)
  const normalizedUrl = normalizeUrl(url);

  // Find existing session for this URL within 24 hours
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const existingSession = sessions.find(s =>
    normalizeUrl(s.url) === normalizedUrl &&
    s.createdAt > oneDayAgo
  );

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  const newSession = createSession(url, title);
  await saveSession(newSession);
  return newSession;
}

/**
 * Normalizes URL for comparison.
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Gets all sessions from storage.
 * @returns {Promise<Array<ReadingSession>>}
 */
async function getAllSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

/**
 * Gets a session by ID.
 * @param {string} sessionId
 * @returns {Promise<ReadingSession|null>}
 */
async function getSessionById(sessionId) {
  const sessions = await getAllSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Saves a session (creates or updates).
 * @param {ReadingSession} session
 * @returns {Promise<void>}
 */
async function saveSession(session) {
  const sessions = await getAllSessions();
  const index = sessions.findIndex(s => s.id === session.id);

  session.updatedAt = Date.now();

  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }

  // Keep only last 100 sessions
  const trimmedSessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: trimmedSessions }, resolve);
  });
}

/**
 * Adds a highlight to a session.
 * @param {string} sessionId
 * @param {Object} highlightData
 * @returns {Promise<Highlight>}
 */
async function addHighlight(sessionId, highlightData) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const highlight = {
    id: generateId('hl'),
    text: highlightData.text,
    surroundingContext: highlightData.surroundingContext || '',
    sectionHeading: highlightData.sectionHeading || null,
    position: highlightData.position || { paragraphIndex: 0, charOffset: 0 },
    createdAt: Date.now()
  };

  session.highlights.push(highlight);
  session.metrics.readingMetrics.highlightCount = session.highlights.length;

  await saveSession(session);
  return highlight;
}

/**
 * Adds an insight to a session.
 * @param {string} sessionId
 * @param {Object} insightData
 * @returns {Promise<Insight>}
 */
async function addInsight(sessionId, insightData) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const insight = {
    id: generateId('ins'),
    text: insightData.text,
    source: insightData.source || 'user',  // 'card' | 'thread' | 'user' | 'ai'
    highlightId: insightData.highlightId || null,
    createdAt: Date.now(),
    addedToFlashcards: false,
    flashcardId: null
  };

  session.insights.push(insight);
  session.metrics.interactionMetrics.insightsCreated = session.insights.length;

  await saveSession(session);
  return insight;
}

/**
 * Updates the thread in a session.
 * @param {string} sessionId
 * @param {Object} threadData
 * @returns {Promise<void>}
 */
async function updateThread(sessionId, threadData) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.thread = {
    messages: threadData.messages || [],
    status: threadData.status || 'active',
    highlight: threadData.highlight || null,
    updatedAt: Date.now()
  };

  // Update metrics
  const assistantMessages = session.thread.messages.filter(m => m.role === 'assistant');
  session.metrics.interactionMetrics.questionsAsked = assistantMessages.length;

  await saveSession(session);
}

/**
 * Updates the reading card in a session.
 * @param {string} sessionId
 * @param {Object} cardData
 * @returns {Promise<void>}
 */
async function updateCard(sessionId, cardData) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.card = {
    mode: cardData.mode,
    keyPoints: cardData.keyPoints || [],
    questions: cardData.questions || [],
    evaluation: cardData.evaluation || null,
    score: cardData.score || null,
    updatedAt: Date.now()
  };

  await saveSession(session);
}

/**
 * Links a focus session to a reading session.
 * @param {string} sessionId
 * @param {Object} focusData
 * @returns {Promise<void>}
 */
async function linkFocusSession(sessionId, focusData) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.focusSession = {
    sessionId: focusData.sessionId,
    startedAt: focusData.startedAt,
    endedAt: focusData.endedAt || null,
    workMin: focusData.workMin,
    breakMin: focusData.breakMin,
    metrics: {
      highlightsCreated: 0,
      insightsCreated: 0,
      messagesExchanged: 0,
      scrollDepth: 0
    }
  };

  await saveSession(session);
}

/**
 * Updates comprehension metrics.
 * @param {string} sessionId
 * @param {Object} metricsUpdate - Partial metrics to update
 * @returns {Promise<void>}
 */
async function updateMetrics(sessionId, metricsUpdate) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  // Deep merge metrics
  if (metricsUpdate.readingMetrics) {
    Object.assign(session.metrics.readingMetrics, metricsUpdate.readingMetrics);
  }
  if (metricsUpdate.interactionMetrics) {
    Object.assign(session.metrics.interactionMetrics, metricsUpdate.interactionMetrics);
  }
  if (metricsUpdate.assessmentMetrics) {
    Object.assign(session.metrics.assessmentMetrics, metricsUpdate.assessmentMetrics);
  }

  await saveSession(session);
}

/**
 * Marks session as exported to NotebookLM.
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function markExported(sessionId) {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  session.exportedToNLM = true;
  session.exportedAt = Date.now();

  await saveSession(session);
}

// Export all functions
export {
  STORAGE_KEY,
  createSession,
  getOrCreateSession,
  getAllSessions,
  getSessionById,
  saveSession,
  addHighlight,
  addInsight,
  updateThread,
  updateCard,
  linkFocusSession,
  updateMetrics,
  markExported,
  generateId
};
```

#### Step 2: Update content.js to Use Unified Session

**File:** `content.js`

Replace existing storage calls:
```javascript
import * as SessionService from './storage/reading_session.js';

// When creating a reading card
async function createReadingCard(mode, highlightText) {
  // Get or create session for current page
  const session = await SessionService.getOrCreateSession(
    window.location.href,
    document.title
  );

  // Add highlight
  const highlight = await SessionService.addHighlight(session.id, {
    text: highlightText,
    surroundingContext: getHighlightContext(highlightText),
    sectionHeading: findNearestHeading()
  });

  // Generate card content via AI...
  const cardContent = await generateCardContent(mode, highlightText);

  // Update card in session
  await SessionService.updateCard(session.id, {
    mode: mode,
    keyPoints: cardContent.keyPoints,
    questions: cardContent.questions
  });

  // Store session ID for later reference
  currentSessionId = session.id;

  return { session, highlight, cardContent };
}

// When saving an insight from the card
async function saveCardInsight(insightText) {
  if (!currentSessionId) return;

  await SessionService.addInsight(currentSessionId, {
    text: insightText,
    source: 'card',
    highlightId: currentHighlightId
  });
}
```

#### Step 3: Update sidepanel.js to Use Unified Session

**File:** `sidepanel.js`

Replace existing thread management:
```javascript
import * as SessionService from './storage/reading_session.js';

// Track current session
let currentSession = null;

// When user highlights text and opens sidepanel
async function handleNewHighlight(highlightData) {
  // Get or create session
  currentSession = await SessionService.getOrCreateSession(
    highlightData.url,
    highlightData.title
  );

  // Add highlight
  const highlight = await SessionService.addHighlight(currentSession.id, {
    text: highlightData.text,
    surroundingContext: highlightData.context
  });

  // Initialize thread if not exists
  if (!currentSession.thread) {
    await SessionService.updateThread(currentSession.id, {
      messages: [],
      status: 'active',
      highlight: highlight
    });
  }

  // Refresh session
  currentSession = await SessionService.getSessionById(currentSession.id);

  renderThread(currentSession);
}

// When sending a message
async function sendMessage(userMessage) {
  if (!currentSession) return;

  // Add user message
  const messages = currentSession.thread?.messages || [];
  messages.push({
    id: SessionService.generateId('msg'),
    role: 'user',
    content: userMessage,
    timestamp: Date.now()
  });

  // Get AI response...
  const aiResponse = await getAIResponse(userMessage);

  // Add assistant message
  messages.push({
    id: SessionService.generateId('msg'),
    role: 'assistant',
    content: aiResponse,
    timestamp: Date.now()
  });

  // Update thread in session
  await SessionService.updateThread(currentSession.id, {
    messages: messages,
    status: 'active'
  });

  // Refresh session
  currentSession = await SessionService.getSessionById(currentSession.id);
}

// When creating an insight from thread
async function createInsightFromThread(insightText) {
  if (!currentSession) return;

  await SessionService.addInsight(currentSession.id, {
    text: insightText,
    source: 'thread',
    highlightId: currentSession.thread?.highlight?.id
  });

  showToast('Insight saved!', 'success');
}

// Display insights from both sources
function renderInsights(session) {
  const insightsContainer = document.querySelector('.insights-container');
  insightsContainer.innerHTML = '';

  session.insights.forEach(insight => {
    const badge = insight.source === 'card' ? '📋' : '💬';
    const html = `
      <div class="insight-item" data-id="${insight.id}">
        <span class="insight-source">${badge}</span>
        <span class="insight-text">${insight.text}</span>
        <button class="insight-save" onclick="saveToNLM('${insight.id}')">💾</button>
      </div>
    `;
    insightsContainer.innerHTML += html;
  });
}
```

#### Step 4: Create Migration Script

**File:** `storage/migration.js` (NEW)

```javascript
/**
 * Migration Script
 * Migrates old data format to new ReadingSession format.
 */

const OLD_VAULT_KEY = 'atom_vault';
const OLD_THREADS_KEY = 'atom_threads';
const NEW_SESSIONS_KEY = 'atom_reading_sessions_v3';

/**
 * Runs the migration from v2.x to v3.0 data format.
 * @returns {Promise<{migrated: number, errors: number}>}
 */
async function migrateToV3() {
  const results = { migrated: 0, errors: 0 };

  try {
    // Get old data
    const oldData = await new Promise(resolve => {
      chrome.storage.local.get([OLD_VAULT_KEY, OLD_THREADS_KEY, 'migration_v3_complete'], resolve);
    });

    // Skip if already migrated
    if (oldData.migration_v3_complete) {
      console.log('[Migration] Already migrated to v3');
      return results;
    }

    const oldVault = oldData[OLD_VAULT_KEY] || [];
    const oldThreads = oldData[OLD_THREADS_KEY] || [];

    // Group old data by URL
    const urlGroups = new Map();

    // Process vault items
    for (const item of oldVault) {
      const url = item.url || item.source?.url;
      if (!url) continue;

      if (!urlGroups.has(url)) {
        urlGroups.set(url, { vault: [], threads: [] });
      }
      urlGroups.get(url).vault.push(item);
    }

    // Process threads
    for (const thread of oldThreads) {
      const url = thread.url || thread.pageUrl;
      if (!url) continue;

      if (!urlGroups.has(url)) {
        urlGroups.set(url, { vault: [], threads: [] });
      }
      urlGroups.get(url).threads.push(thread);
    }

    // Convert to new sessions
    const newSessions = [];

    for (const [url, data] of urlGroups) {
      try {
        const session = convertToSession(url, data);
        if (session) {
          newSessions.push(session);
          results.migrated++;
        }
      } catch (err) {
        console.error(`[Migration] Error converting ${url}:`, err);
        results.errors++;
      }
    }

    // Save new sessions
    await new Promise(resolve => {
      chrome.storage.local.set({
        [NEW_SESSIONS_KEY]: newSessions,
        migration_v3_complete: true,
        migration_v3_date: Date.now()
      }, resolve);
    });

    console.log(`[Migration] Complete: ${results.migrated} migrated, ${results.errors} errors`);

  } catch (err) {
    console.error('[Migration] Failed:', err);
    results.errors++;
  }

  return results;
}

/**
 * Converts old data to new session format.
 */
function convertToSession(url, data) {
  const vaultItem = data.vault[0];
  const thread = data.threads[0];

  if (!vaultItem && !thread) return null;

  const session = {
    id: `session_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    url: url,
    title: vaultItem?.title || thread?.pageTitle || 'Untitled',
    domain: new URL(url).hostname,
    createdAt: vaultItem?.savedAt || thread?.createdAt || Date.now(),
    updatedAt: Date.now(),
    highlights: [],
    card: null,
    thread: null,
    insights: [],
    focusSession: null,
    connections: [],
    metrics: {
      readingMetrics: { timeSpent: 0, scrollDepth: 0, highlightCount: 0, highlightDensity: 0 },
      interactionMetrics: { questionsAsked: 0, bloomLevelReached: 1, insightsCreated: 0 },
      assessmentMetrics: { quizScore: null, teachBackScore: null, recallAccuracy: null }
    },
    exportedToNLM: false
  };

  // Convert vault item to card
  if (vaultItem) {
    // Add highlight
    if (vaultItem.highlight || vaultItem.text) {
      session.highlights.push({
        id: `hl_migrated_${Date.now()}`,
        text: vaultItem.highlight || vaultItem.text,
        surroundingContext: '',
        createdAt: vaultItem.savedAt || Date.now()
      });
    }

    // Add insight
    if (vaultItem.insight || vaultItem.keyInsight) {
      session.insights.push({
        id: `ins_migrated_${Date.now()}`,
        text: vaultItem.insight || vaultItem.keyInsight,
        source: 'card',
        createdAt: vaultItem.savedAt || Date.now(),
        addedToFlashcards: false
      });
    }

    // Create card
    session.card = {
      mode: vaultItem.mode || 'summary',
      keyPoints: vaultItem.keyPoints || [],
      questions: vaultItem.questions || []
    };
  }

  // Convert thread
  if (thread) {
    session.thread = {
      messages: (thread.messages || []).map(m => ({
        id: `msg_migrated_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || Date.now()
      })),
      status: thread.status || 'active'
    };

    // Add thread insight if exists
    if (thread.atomicThought) {
      session.insights.push({
        id: `ins_thread_${Date.now()}`,
        text: thread.atomicThought,
        source: 'thread',
        createdAt: thread.updatedAt || Date.now(),
        addedToFlashcards: false
      });
    }
  }

  session.metrics.readingMetrics.highlightCount = session.highlights.length;
  session.metrics.interactionMetrics.insightsCreated = session.insights.length;

  return session;
}

/**
 * Checks if migration is needed and runs it.
 */
async function checkAndMigrate() {
  const data = await new Promise(resolve => {
    chrome.storage.local.get(['migration_v3_complete'], resolve);
  });

  if (!data.migration_v3_complete) {
    console.log('[Migration] Starting v3 migration...');
    return await migrateToV3();
  }

  return { migrated: 0, errors: 0, skipped: true };
}

export { migrateToV3, checkAndMigrate };
```

#### Step 5: Run Migration on Extension Load

**File:** `background.js`

Add migration check on startup:
```javascript
import { checkAndMigrate } from './storage/migration.js';

// Run migration on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update' || details.reason === 'install') {
    const result = await checkAndMigrate();
    console.log('[ATOM] Migration result:', result);
  }
});
```

### Success Criteria
- [ ] Single ReadingSession object contains all related data
- [ ] Insights visible in both Card and Thread views
- [ ] Old data migrated without loss
- [ ] No data duplication between systems

### Testing
```javascript
describe('ReadingSession Service', () => {
  it('creates new session for new URL', async () => {
    const session = await getOrCreateSession('https://example.com/article1', 'Test Article');
    expect(session.id).toBeTruthy();
    expect(session.url).toBe('https://example.com/article1');
  });

  it('returns existing session for same URL within 24h', async () => {
    const session1 = await getOrCreateSession('https://example.com/article1', 'Test');
    const session2 = await getOrCreateSession('https://example.com/article1', 'Test');
    expect(session1.id).toBe(session2.id);
  });

  it('adds highlight to session', async () => {
    const session = await getOrCreateSession('https://example.com/test', 'Test');
    const highlight = await addHighlight(session.id, { text: 'Test highlight' });
    expect(highlight.id).toBeTruthy();

    const updated = await getSessionById(session.id);
    expect(updated.highlights).toHaveLength(1);
  });

  it('syncs insights between card and thread', async () => {
    const session = await getOrCreateSession('https://example.com/test', 'Test');

    await addInsight(session.id, { text: 'Card insight', source: 'card' });
    await addInsight(session.id, { text: 'Thread insight', source: 'thread' });

    const updated = await getSessionById(session.id);
    expect(updated.insights).toHaveLength(2);
    expect(updated.insights.map(i => i.source)).toContain('card');
    expect(updated.insights.map(i => i.source)).toContain('thread');
  });
});

describe('Migration', () => {
  it('migrates old vault data', async () => {
    // Setup old data...
    const result = await migrateToV3();
    expect(result.errors).toBe(0);
  });
});
```

---

## Task 0.4: Save Button UX

### Objective
Make the Save button immediately visible and accessible without requiring an insight first.

### Current Problem
- Save button hidden behind Key Insight step
- Users don't know they can save
- Low discovery rate (~30%)

### Implementation Steps

#### Step 1: Add Save to Quick Actions

**File:** `sidepanel.js` and `sidepanel.html`
**Location:** Quick actions chip group

Add Save as a visible quick action:
```html
<!-- In sidepanel.html or generated by JS -->
<div class="sp-quick-actions">
  <!-- Existing chips -->
  <button class="sp-chip" data-action="summarize">📋 Tóm tắt</button>
  <button class="sp-chip" data-action="keypoints">🔑 Ý chính</button>
  <button class="sp-chip" data-action="explain">💡 Giải thích</button>
  <!-- ... other chips ... -->

  <!-- ADD: Always-visible Save chip -->
  <button class="sp-chip sp-chip-save" data-action="quick_save" title="Save to NotebookLM">
    💾 Save
  </button>
</div>
```

Add CSS for Save chip:
```css
.sp-chip-save {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  font-weight: 500;
}

.sp-chip-save:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.sp-chip-save:active {
  transform: translateY(0);
}

/* Make it stand out */
.sp-quick-actions .sp-chip-save {
  margin-left: auto; /* Push to right side */
}
```

#### Step 2: Add Save to Thread Action Bar

**File:** `sidepanel.js`
**Location:** Thread header/action bar

Add Save button to the thread action area:
```html
<div class="sp-thread-actions">
  <!-- Primary action: Save -->
  <button class="sp-action-btn sp-action-save" onclick="quickSave()">
    💾 Save to NLM
  </button>

  <!-- Secondary actions -->
  <button class="sp-action-btn" onclick="createInsight()">
    💡 Add Insight
  </button>
  <button class="sp-action-btn" onclick="markDone()">
    ✅ Done
  </button>
</div>
```

```css
.sp-thread-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.sp-action-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.sp-action-save {
  background: #3b82f6;
  color: white;
  border: none;
  font-weight: 500;
}

.sp-action-save:hover {
  background: #2563eb;
}
```

#### Step 3: Implement Quick Save (Without Insight)

**File:** `sidepanel.js`

Add quick save functionality:
```javascript
/**
 * Quick Save - saves highlight and conversation without requiring an insight.
 * User can optionally add an insight in the save dialog.
 */
async function quickSave() {
  if (!currentSession || !currentSession.thread?.highlight) {
    showToast('Nothing to save yet', 'warning');
    return;
  }

  // Show save dialog with optional insight
  const dialog = createSaveDialog();
  document.body.appendChild(dialog);
}

/**
 * Creates the save dialog UI.
 */
function createSaveDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'sp-save-dialog-overlay';
  dialog.innerHTML = `
    <div class="sp-save-dialog">
      <div class="sp-save-dialog-header">
        <h3>💾 Save to NotebookLM</h3>
        <button class="sp-dialog-close" onclick="closeSaveDialog()">×</button>
      </div>

      <div class="sp-save-dialog-content">
        <div class="sp-save-preview">
          <div class="sp-save-preview-label">Highlighted text:</div>
          <div class="sp-save-preview-text">"${currentSession.thread.highlight.text.slice(0, 150)}${currentSession.thread.highlight.text.length > 150 ? '...' : ''}"</div>
        </div>

        <div class="sp-save-insight">
          <label for="insight-input">Key insight (optional):</label>
          <textarea
            id="insight-input"
            placeholder="What's the key takeaway from this passage?"
            rows="3"
          ></textarea>
          <button class="sp-generate-insight" onclick="generateInsightSuggestion()">
            ✨ Suggest insight
          </button>
        </div>

        <div class="sp-save-tags">
          <label>Tags:</label>
          <input type="text" id="tags-input" placeholder="Add tags (comma separated)">
        </div>
      </div>

      <div class="sp-save-dialog-footer">
        <button class="sp-btn-secondary" onclick="closeSaveDialog()">Cancel</button>
        <button class="sp-btn-primary" onclick="confirmSave()">
          💾 Save Now
        </button>
      </div>
    </div>
  `;

  return dialog;
}

/**
 * Confirms and executes the save.
 */
async function confirmSave() {
  const insightInput = document.getElementById('insight-input');
  const tagsInput = document.getElementById('tags-input');

  const insight = insightInput?.value?.trim();
  const tags = tagsInput?.value?.split(',').map(t => t.trim()).filter(Boolean);

  // Add insight to session if provided
  if (insight) {
    await SessionService.addInsight(currentSession.id, {
      text: insight,
      source: 'user'
    });
  }

  // Prepare clip data for NotebookLM
  const clipData = {
    title: currentSession.title,
    url: currentSession.url,
    capturedAt: new Date().toISOString(),
    highlightedPassage: currentSession.thread.highlight.text,
    keyInsight: insight || 'No insight added',
    tags: tags,
    conversationSummary: summarizeThread(currentSession.thread.messages)
  };

  // Trigger NLM save (existing bridge functionality)
  try {
    await saveToNotebookLM(clipData);
    await SessionService.markExported(currentSession.id);

    closeSaveDialog();
    showToast('Saved to NotebookLM!', 'success');
  } catch (err) {
    console.error('[ATOM] Save failed:', err);
    showToast('Save failed. Please try again.', 'error');
  }
}

/**
 * Generates an insight suggestion from the conversation.
 */
async function generateInsightSuggestion() {
  const btn = document.querySelector('.sp-generate-insight');
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const messages = currentSession.thread.messages;
    const highlight = currentSession.thread.highlight.text;

    const prompt = `Based on this highlighted text and discussion, generate a single concise insight (1-2 sentences max):

Highlight: "${highlight}"

Discussion:
${messages.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}

Generate ONE key insight that captures the main takeaway:`;

    const insight = await callGeminiAPI(prompt);

    const input = document.getElementById('insight-input');
    input.value = insight.trim();

  } catch (err) {
    console.error('[ATOM] Failed to generate insight:', err);
    showToast('Could not generate insight', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Suggest insight';
  }
}

/**
 * Summarizes thread messages for export.
 */
function summarizeThread(messages) {
  if (!messages || messages.length === 0) return '';

  return messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content.slice(0, 300))
    .join('\n---\n')
    .slice(0, 1000);
}

function closeSaveDialog() {
  const dialog = document.querySelector('.sp-save-dialog-overlay');
  if (dialog) dialog.remove();
}
```

Add dialog CSS:
```css
.sp-save-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.sp-save-dialog {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.sp-save-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.sp-save-dialog-header h3 {
  margin: 0;
  font-size: 16px;
}

.sp-dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}

.sp-save-dialog-content {
  padding: 16px;
}

.sp-save-preview {
  background: #f9fafb;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.sp-save-preview-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.sp-save-preview-text {
  font-style: italic;
  color: #374151;
}

.sp-save-insight label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.sp-save-insight textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  resize: none;
}

.sp-generate-insight {
  margin-top: 8px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.sp-save-tags {
  margin-top: 16px;
}

.sp-save-tags label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

.sp-save-tags input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.sp-save-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.sp-btn-secondary {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
}

.sp-btn-primary {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
}

.sp-btn-primary:hover {
  background: #2563eb;
}
```

### Success Criteria
- [ ] Save button visible immediately when thread is active
- [ ] Can save without creating insight first (quickSave mode)
- [ ] Save dialog allows optional insight addition
- [ ] 100% discoverability (button always visible)

### Testing
```javascript
describe('Save Button UX', () => {
  it('shows Save chip in quick actions', () => {
    renderQuickActions();
    const saveChip = document.querySelector('[data-action="quick_save"]');
    expect(saveChip).toBeTruthy();
  });

  it('opens save dialog on click', () => {
    quickSave();
    const dialog = document.querySelector('.sp-save-dialog-overlay');
    expect(dialog).toBeTruthy();
  });

  it('saves without insight when not provided', async () => {
    // Setup mock session...
    await confirmSave();
    expect(mockSaveToNLM).toHaveBeenCalled();
  });

  it('saves with insight when provided', async () => {
    document.getElementById('insight-input').value = 'Test insight';
    await confirmSave();

    const session = await SessionService.getSessionById(currentSession.id);
    expect(session.insights).toHaveLength(1);
  });
});
```

---

## File Changes Summary

### New Files to Create
1. `services/context_extractor.js` - Smart context extraction
2. `services/evidence_validator.js` - Response grounding validation
3. `storage/reading_session.js` - Unified session management
4. `storage/migration.js` - Data migration script

### Files to Modify
1. `content.js`
   - Add `extractHeadings()` function
   - Update `getPageContext()` to include headings
   - Integrate with ReadingSession service

2. `sidepanel.js`
   - Import and use context_extractor
   - Update `buildSystemPrompt()` for smart context
   - Update all quick action prompts for evidence
   - Integrate with ReadingSession service
   - Add Save button to quick actions and action bar
   - Add quickSave() functionality

3. `background.js`
   - Add migration check on install/update

4. `sidepanel.html` (or CSS file)
   - Add styles for evidence display
   - Add styles for Save dialog

---

## Deployment Checklist

- [ ] Create all new files
- [ ] Update existing files
- [ ] Run migration script testing
- [ ] Test token reduction with console logging
- [ ] Verify evidence appears in responses
- [ ] Test unified session data sync
- [ ] Verify Save button visibility and functionality
- [ ] Test backward compatibility
- [ ] Update version to 2.7

---

## Rollback Plan

If issues occur:
1. Revert to previous version files
2. Set `migration_v3_complete: false` in storage to re-run migration
3. Keep old storage keys intact until Phase 1 complete

---

**End of Phase 0 Specification**
