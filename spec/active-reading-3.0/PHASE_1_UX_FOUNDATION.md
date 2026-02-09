# Phase 1: UX Foundation - Implementation Spec

**Version:** 1.0
**Duration:** 2-3 weeks
**Priority:** HIGH
**Dependencies:** Phase 0 complete

---

## Overview

Phase 1 transforms ATOM from a reactive assistant to a proactive learning companion by adding pre-reading guidance, learning modes, smart nudges, and timer integration.

---

## Task 1.1: Pre-reading Primer

### Objective
When user opens a new article, proactively suggest 3 guiding questions to focus their reading.

### User Flow
```
User opens article → System detects new page → AI generates 3 guiding questions
→ Sidepanel shows primer → User accepts or skips → Reading begins with objectives
```

### Implementation Steps

#### Step 1: Create Primer Service

**File:** `services/primer_service.js` (NEW)

```javascript
/**
 * Pre-reading Primer Service
 * Generates guiding questions for articles before reading.
 */

import { callGeminiAPI } from '../ai_service.js';

/**
 * Configuration for primer generation.
 */
const PRIMER_CONFIG = {
  minContentLength: 500,  // Minimum chars to trigger primer
  maxQuestionsDisplay: 3,
  cacheExpiryMs: 24 * 60 * 60 * 1000,  // 24 hours
  excludedDomains: [
    'google.com',
    'facebook.com',
    'twitter.com',
    'youtube.com',
    'linkedin.com',
    'github.com'  // Code repos don't need primers
  ]
};

/**
 * Checks if a page should receive a primer.
 * @param {Object} pageContext - Page context from content.js
 * @returns {boolean}
 */
function shouldShowPrimer(pageContext) {
  // Check domain exclusion
  const domain = pageContext.domain || new URL(pageContext.url).hostname;
  if (PRIMER_CONFIG.excludedDomains.some(d => domain.includes(d))) {
    return false;
  }

  // Check content length
  if (!pageContext.content || pageContext.content.length < PRIMER_CONFIG.minContentLength) {
    return false;
  }

  // Check if it looks like an article (has headings, sufficient text)
  const hasHeadings = pageContext.headings && pageContext.headings.length > 0;
  const isArticleLike = hasHeadings || pageContext.content.length > 2000;

  return isArticleLike;
}

/**
 * Extracts page outline from headings.
 * @param {Array} headings - Heading elements from page
 * @returns {string}
 */
function extractOutline(headings) {
  if (!headings || headings.length === 0) return 'No clear structure detected';

  return headings
    .slice(0, 10)  // Max 10 headings
    .map(h => `${'  '.repeat(h.level - 1)}• ${h.text}`)
    .join('\n');
}

/**
 * Generates pre-reading primer questions.
 * @param {Object} pageContext - Page context
 * @returns {Promise<Object>} Primer data
 */
async function generatePrimer(pageContext) {
  const outline = extractOutline(pageContext.headings);
  const firstParagraphs = pageContext.content.slice(0, 2000);

  const prompt = `Analyze this article and generate 3 guiding questions for a reader.

Article Title: ${pageContext.title}

Structure:
${outline}

Opening content:
${firstParagraphs}

Generate 3 questions following Bloom's Taxonomy levels:
1. UNDERSTANDING question - What is the core concept/problem being discussed?
2. APPLICATION question - How could this be applied in practice?
3. EVALUATION question - What are the trade-offs or implications?

Format your response as JSON:
{
  "topic": "Brief topic summary (5-10 words)",
  "questions": [
    {
      "level": "understanding",
      "question": "...",
      "hint": "Look for... (10 words max)"
    },
    {
      "level": "application",
      "question": "...",
      "hint": "Consider... (10 words max)"
    },
    {
      "level": "evaluation",
      "question": "...",
      "hint": "Compare... (10 words max)"
    }
  ]
}

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await callGeminiAPI(prompt);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      topic: data.topic,
      questions: data.questions,
      generatedAt: Date.now()
    };

  } catch (err) {
    console.error('[Primer] Generation failed:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Checks if primer was already shown for this URL.
 * @param {string} url - Page URL
 * @returns {Promise<boolean>}
 */
async function wasPrimerShown(url) {
  const normalizedUrl = normalizeUrl(url);

  return new Promise(resolve => {
    chrome.storage.local.get(['atom_primers_shown'], (result) => {
      const shown = result.atom_primers_shown || {};
      const entry = shown[normalizedUrl];

      if (!entry) {
        resolve(false);
        return;
      }

      // Check if expired
      const isExpired = Date.now() - entry.shownAt > PRIMER_CONFIG.cacheExpiryMs;
      resolve(!isExpired);
    });
  });
}

/**
 * Marks primer as shown for URL.
 * @param {string} url - Page URL
 */
async function markPrimerShown(url) {
  const normalizedUrl = normalizeUrl(url);

  return new Promise(resolve => {
    chrome.storage.local.get(['atom_primers_shown'], (result) => {
      const shown = result.atom_primers_shown || {};
      shown[normalizedUrl] = {
        shownAt: Date.now()
      };

      // Keep only last 100 entries
      const entries = Object.entries(shown);
      if (entries.length > 100) {
        const sorted = entries.sort((a, b) => b[1].shownAt - a[1].shownAt);
        const trimmed = Object.fromEntries(sorted.slice(0, 100));
        chrome.storage.local.set({ atom_primers_shown: trimmed }, resolve);
      } else {
        chrome.storage.local.set({ atom_primers_shown: shown }, resolve);
      }
    });
  });
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

export {
  shouldShowPrimer,
  generatePrimer,
  wasPrimerShown,
  markPrimerShown
};
```

#### Step 2: Create Primer UI Component

**File:** `ui/components/primer.js` (NEW)

```javascript
/**
 * Pre-reading Primer UI Component
 */

/**
 * Creates primer UI element.
 * @param {Object} primerData - Generated primer data
 * @param {Function} onAccept - Callback when user accepts
 * @param {Function} onSkip - Callback when user skips
 * @returns {HTMLElement}
 */
function createPrimerUI(primerData, onAccept, onSkip) {
  const container = document.createElement('div');
  container.className = 'sp-primer-container';
  container.innerHTML = `
    <div class="sp-primer-card">
      <div class="sp-primer-header">
        <span class="sp-primer-icon">📚</span>
        <span class="sp-primer-title">Before you read...</span>
      </div>

      <div class="sp-primer-content">
        <div class="sp-primer-topic">
          <span class="sp-primer-label">This article covers:</span>
          <span class="sp-primer-topic-text">${primerData.topic}</span>
        </div>

        <div class="sp-primer-questions">
          <div class="sp-primer-questions-header">
            <span>🎯</span> Reading objectives:
          </div>
          <ol class="sp-primer-questions-list">
            ${primerData.questions.map((q, i) => `
              <li class="sp-primer-question" data-level="${q.level}">
                <div class="sp-primer-question-text">${q.question}</div>
                <div class="sp-primer-question-hint">💡 ${q.hint}</div>
              </li>
            `).join('')}
          </ol>
        </div>
      </div>

      <div class="sp-primer-actions">
        <button class="sp-primer-btn sp-primer-btn-primary" id="primer-accept">
          ✓ Start Reading
        </button>
        <button class="sp-primer-btn sp-primer-btn-secondary" id="primer-skip">
          Skip
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  container.querySelector('#primer-accept').addEventListener('click', () => {
    onAccept(primerData.questions);
    container.classList.add('sp-primer-dismissed');
    setTimeout(() => container.remove(), 300);
  });

  container.querySelector('#primer-skip').addEventListener('click', () => {
    onSkip();
    container.classList.add('sp-primer-dismissed');
    setTimeout(() => container.remove(), 300);
  });

  return container;
}

/**
 * Primer CSS styles.
 */
const PRIMER_STYLES = `
.sp-primer-container {
  padding: 16px;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sp-primer-dismissed {
  animation: slideOut 0.3s ease-out forwards;
}

@keyframes slideOut {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

.sp-primer-card {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 12px;
  overflow: hidden;
}

.sp-primer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid #bae6fd;
}

.sp-primer-icon {
  font-size: 20px;
}

.sp-primer-title {
  font-weight: 600;
  color: #0369a1;
}

.sp-primer-content {
  padding: 16px;
}

.sp-primer-topic {
  margin-bottom: 16px;
}

.sp-primer-label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.sp-primer-topic-text {
  font-weight: 500;
  color: #0f172a;
}

.sp-primer-questions-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #0369a1;
  margin-bottom: 12px;
}

.sp-primer-questions-list {
  margin: 0;
  padding-left: 20px;
}

.sp-primer-question {
  margin-bottom: 12px;
  padding-left: 4px;
}

.sp-primer-question-text {
  color: #1e293b;
  line-height: 1.4;
}

.sp-primer-question-hint {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.sp-primer-question[data-level="understanding"] {
  border-left: 2px solid #22c55e;
  padding-left: 8px;
  margin-left: -10px;
}

.sp-primer-question[data-level="application"] {
  border-left: 2px solid #3b82f6;
  padding-left: 8px;
  margin-left: -10px;
}

.sp-primer-question[data-level="evaluation"] {
  border-left: 2px solid #a855f7;
  padding-left: 8px;
  margin-left: -10px;
}

.sp-primer-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-top: 1px solid #bae6fd;
}

.sp-primer-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.sp-primer-btn-primary {
  background: #0284c7;
  color: white;
  border: none;
}

.sp-primer-btn-primary:hover {
  background: #0369a1;
}

.sp-primer-btn-secondary {
  background: transparent;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.sp-primer-btn-secondary:hover {
  background: #f1f5f9;
}
`;

/**
 * Injects primer styles into document.
 */
function injectPrimerStyles() {
  if (document.getElementById('primer-styles')) return;

  const style = document.createElement('style');
  style.id = 'primer-styles';
  style.textContent = PRIMER_STYLES;
  document.head.appendChild(style);
}

export { createPrimerUI, injectPrimerStyles };
```

#### Step 3: Integrate Primer into Sidepanel

**File:** `sidepanel.js`
**Location:** On page load / sidepanel open

```javascript
import * as PrimerService from './services/primer_service.js';
import { createPrimerUI, injectPrimerStyles } from './ui/components/primer.js';

/**
 * Checks and shows primer for current page.
 */
async function checkAndShowPrimer(pageContext) {
  // Check if should show primer
  if (!PrimerService.shouldShowPrimer(pageContext)) {
    console.log('[Primer] Skipped - not an article');
    return;
  }

  // Check if already shown
  const alreadyShown = await PrimerService.wasPrimerShown(pageContext.url);
  if (alreadyShown) {
    console.log('[Primer] Skipped - already shown');
    return;
  }

  // Generate primer
  const primerData = await PrimerService.generatePrimer(pageContext);
  if (!primerData.success) {
    console.log('[Primer] Generation failed');
    return;
  }

  // Show primer UI
  injectPrimerStyles();
  const primerUI = createPrimerUI(
    primerData,
    handlePrimerAccept,
    handlePrimerSkip
  );

  const contentArea = document.querySelector('.sp-content') || document.body;
  contentArea.prepend(primerUI);

  // Mark as shown
  await PrimerService.markPrimerShown(pageContext.url);
}

/**
 * Handles user accepting the primer.
 */
async function handlePrimerAccept(questions) {
  console.log('[Primer] Accepted with questions:', questions);

  // Store learning objectives in current session
  if (currentSession) {
    currentSession.learningObjective = {
      mode: 'focused',
      questions: questions.map(q => q.question),
      acceptedAt: Date.now()
    };
    await SessionService.saveSession(currentSession);
  }

  // Show confirmation
  showToast('Reading objectives set! Look for these answers.', 'success');
}

/**
 * Handles user skipping the primer.
 */
function handlePrimerSkip() {
  console.log('[Primer] Skipped');
  showToast('Primer skipped', 'info');
}

// Call on sidepanel load
document.addEventListener('DOMContentLoaded', async () => {
  const pageContext = await getPageContext();
  await checkAndShowPrimer(pageContext);
});
```

### Success Criteria
- [ ] Primer shown for new articles (first visit within 24h)
- [ ] Questions are relevant to article topic
- [ ] Questions follow Bloom's taxonomy levels
- [ ] User can accept or skip
- [ ] Objectives stored in session

### Testing
```javascript
describe('Pre-reading Primer', () => {
  it('shows primer for article pages', async () => {
    const pageContext = {
      url: 'https://example.com/article',
      title: 'Test Article',
      content: 'Long article content...',
      headings: [{ text: 'Introduction', level: 2 }]
    };

    const should = PrimerService.shouldShowPrimer(pageContext);
    expect(should).toBe(true);
  });

  it('skips primer for excluded domains', () => {
    const pageContext = {
      url: 'https://google.com/search',
      content: 'Search results...'
    };

    const should = PrimerService.shouldShowPrimer(pageContext);
    expect(should).toBe(false);
  });

  it('generates 3 questions', async () => {
    const primer = await PrimerService.generatePrimer(mockPageContext);
    expect(primer.questions).toHaveLength(3);
  });
});
```

---

## Task 1.2: Learning Objective Selector

### Objective
Allow users to choose reading depth (Skim vs Deep) which controls AI behavior.

### Implementation Steps

#### Step 1: Create Learning Mode Service

**File:** `services/learning_objective.js` (NEW)

```javascript
/**
 * Learning Objective Service
 * Manages reading modes and their behaviors.
 */

const READING_MODES = {
  SKIM: {
    id: 'skim',
    label: 'Skim',
    icon: '⚡',
    description: 'Quick overview',
    details: 'Key points only',
    chips: ['summarize', 'keypoints', 'explain'],
    responseStyle: 'concise',
    maxResponseTokens: 500,
    autoPrompt: false,
    insightStyle: 'brief'  // 1 sentence
  },
  DEEP: {
    id: 'deep',
    label: 'Deep',
    icon: '🔬',
    description: 'Full analysis',
    details: 'Examples, counter-arguments',
    chips: ['summarize', 'keypoints', 'explain', 'example', 'analyze', 'counter', 'connect', 'apply'],
    responseStyle: 'detailed',
    maxResponseTokens: 1500,
    autoPrompt: true,
    insightStyle: 'detailed'  // Multi-sentence with context
  }
};

// Storage key for user's default mode
const MODE_STORAGE_KEY = 'atom_reading_mode_default';

/**
 * Gets the current reading mode for a session.
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Reading mode config
 */
async function getSessionMode(sessionId) {
  // Try to get from session
  const session = await SessionService.getSessionById(sessionId);
  if (session?.learningObjective?.mode) {
    return READING_MODES[session.learningObjective.mode.toUpperCase()] || READING_MODES.DEEP;
  }

  // Fall back to user default
  return await getUserDefaultMode();
}

/**
 * Sets the reading mode for a session.
 * @param {string} sessionId
 * @param {string} modeId - 'skim' or 'deep'
 */
async function setSessionMode(sessionId, modeId) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session) return;

  session.learningObjective = session.learningObjective || {};
  session.learningObjective.mode = modeId;

  await SessionService.saveSession(session);
}

/**
 * Gets user's default reading mode.
 * @returns {Promise<Object>}
 */
async function getUserDefaultMode() {
  return new Promise(resolve => {
    chrome.storage.local.get([MODE_STORAGE_KEY], (result) => {
      const modeId = result[MODE_STORAGE_KEY] || 'deep';
      resolve(READING_MODES[modeId.toUpperCase()] || READING_MODES.DEEP);
    });
  });
}

/**
 * Sets user's default reading mode.
 * @param {string} modeId
 */
async function setUserDefaultMode(modeId) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [MODE_STORAGE_KEY]: modeId }, resolve);
  });
}

/**
 * Gets available quick action chips for a mode.
 * @param {Object} mode - Reading mode config
 * @returns {Array}
 */
function getChipsForMode(mode) {
  const ALL_CHIPS = {
    summarize: { id: 'summarize', label: 'Tóm tắt', icon: '📋', level: 1 },
    keypoints: { id: 'keypoints', label: 'Ý chính', icon: '🔑', level: 1 },
    explain: { id: 'explain', label: 'Giải thích', icon: '💡', level: 2 },
    paraphrase: { id: 'paraphrase', label: 'Diễn đạt lại', icon: '🔄', level: 2 },
    example: { id: 'example', label: 'Ví dụ', icon: '🔧', level: 3 },
    code: { id: 'code', label: 'Code', icon: '💻', level: 3 },
    analyze: { id: 'analyze', label: 'Phân tích', icon: '🔍', level: 4 },
    compare: { id: 'compare', label: 'So sánh', icon: '⚖️', level: 4 },
    counter: { id: 'counter', label: 'Phản biện', icon: '🤔', level: 5 },
    critique: { id: 'critique', label: 'Đánh giá', icon: '✅', level: 5 },
    connect: { id: 'connect', label: 'Liên kết', icon: '🔗', level: 6 },
    apply: { id: 'apply', label: 'Áp dụng', icon: '✨', level: 6 }
  };

  return mode.chips.map(chipId => ALL_CHIPS[chipId]).filter(Boolean);
}

/**
 * Gets system prompt modifier based on mode.
 * @param {Object} mode
 * @returns {string}
 */
function getResponseStylePrompt(mode) {
  if (mode.id === 'skim') {
    return `
RESPONSE STYLE: CONCISE
- Keep responses brief and to the point
- Use bullet points for lists
- Maximum 3-4 sentences per point
- Focus on key takeaways only
- No deep analysis unless specifically asked`;
  }

  return `
RESPONSE STYLE: DETAILED
- Provide comprehensive explanations
- Include relevant examples
- Explore implications and connections
- Suggest follow-up questions
- Add context where helpful`;
}

export {
  READING_MODES,
  getSessionMode,
  setSessionMode,
  getUserDefaultMode,
  setUserDefaultMode,
  getChipsForMode,
  getResponseStylePrompt
};
```

#### Step 2: Create Mode Selector UI

**File:** `ui/components/mode_selector.js` (NEW)

```javascript
/**
 * Learning Mode Selector UI Component
 */

import { READING_MODES } from '../../services/learning_objective.js';

/**
 * Creates mode selector UI.
 * @param {string} currentModeId - Current active mode
 * @param {Function} onModeChange - Callback when mode changes
 * @returns {HTMLElement}
 */
function createModeSelectorUI(currentModeId, onModeChange) {
  const container = document.createElement('div');
  container.className = 'sp-mode-selector';

  container.innerHTML = `
    <div class="sp-mode-label">Reading Mode:</div>
    <div class="sp-mode-options">
      ${Object.values(READING_MODES).map(mode => `
        <button
          class="sp-mode-option ${mode.id === currentModeId ? 'active' : ''}"
          data-mode="${mode.id}"
        >
          <span class="sp-mode-icon">${mode.icon}</span>
          <div class="sp-mode-info">
            <div class="sp-mode-name">${mode.label}</div>
            <div class="sp-mode-desc">${mode.description}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  // Attach click handlers
  container.querySelectorAll('.sp-mode-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const modeId = btn.dataset.mode;

      // Update UI
      container.querySelectorAll('.sp-mode-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Callback
      onModeChange(modeId);
    });
  });

  return container;
}

const MODE_SELECTOR_STYLES = `
.sp-mode-selector {
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.sp-mode-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.sp-mode-options {
  display: flex;
  gap: 8px;
}

.sp-mode-option {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.sp-mode-option:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.sp-mode-option.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.sp-mode-icon {
  font-size: 20px;
  line-height: 1;
}

.sp-mode-info {
  flex: 1;
}

.sp-mode-name {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
}

.sp-mode-desc {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.sp-mode-option.active .sp-mode-name {
  color: #1d4ed8;
}
`;

function injectModeSelectorStyles() {
  if (document.getElementById('mode-selector-styles')) return;

  const style = document.createElement('style');
  style.id = 'mode-selector-styles';
  style.textContent = MODE_SELECTOR_STYLES;
  document.head.appendChild(style);
}

export { createModeSelectorUI, injectModeSelectorStyles };
```

#### Step 3: Integrate Mode Selector into Sidepanel

**File:** `sidepanel.js`

```javascript
import * as LearningObjective from './services/learning_objective.js';
import { createModeSelectorUI, injectModeSelectorStyles } from './ui/components/mode_selector.js';

let currentMode = null;

/**
 * Initializes mode selector in sidepanel.
 */
async function initModeSelector() {
  injectModeSelectorStyles();

  // Get current mode
  if (currentSession) {
    currentMode = await LearningObjective.getSessionMode(currentSession.id);
  } else {
    currentMode = await LearningObjective.getUserDefaultMode();
  }

  // Create UI
  const modeSelector = createModeSelectorUI(currentMode.id, handleModeChange);

  // Insert after header, before content
  const header = document.querySelector('.sp-header');
  if (header) {
    header.after(modeSelector);
  }

  // Update quick actions based on mode
  updateQuickActionsForMode(currentMode);
}

/**
 * Handles mode change.
 */
async function handleModeChange(modeId) {
  currentMode = LearningObjective.READING_MODES[modeId.toUpperCase()];

  // Update session
  if (currentSession) {
    await LearningObjective.setSessionMode(currentSession.id, modeId);
  }

  // Save as default
  await LearningObjective.setUserDefaultMode(modeId);

  // Update UI
  updateQuickActionsForMode(currentMode);

  showToast(`Switched to ${currentMode.label} mode`, 'info');
}

/**
 * Updates quick action chips based on mode.
 */
function updateQuickActionsForMode(mode) {
  const chips = LearningObjective.getChipsForMode(mode);
  const container = document.querySelector('.sp-quick-actions');

  if (!container) return;

  // Clear existing chips (except Save)
  container.querySelectorAll('.sp-chip:not(.sp-chip-save)').forEach(c => c.remove());

  // Add chips for mode
  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'sp-chip';
    btn.dataset.action = chip.id;
    btn.dataset.level = chip.level;
    btn.innerHTML = `${chip.icon} ${chip.label}`;
    btn.onclick = () => handleQuickAction(chip.id);

    // Insert before Save button
    const saveBtn = container.querySelector('.sp-chip-save');
    if (saveBtn) {
      container.insertBefore(btn, saveBtn);
    } else {
      container.appendChild(btn);
    }
  });
}

/**
 * Builds system prompt with mode-specific instructions.
 */
function buildSystemPromptWithMode(thread, pageContext, action) {
  const basePrompt = buildSmartContext(thread, pageContext, action);
  const modePrompt = LearningObjective.getResponseStylePrompt(currentMode);

  return `${basePrompt}\n\n${modePrompt}`;
}
```

### Success Criteria
- [ ] Mode selector visible in sidepanel
- [ ] Skim mode shows fewer, simpler chips
- [ ] Deep mode shows full chip set
- [ ] AI responses adjust based on mode
- [ ] Mode persists per session and as default

### Testing
```javascript
describe('Learning Mode', () => {
  it('returns correct chips for skim mode', () => {
    const chips = getChipsForMode(READING_MODES.SKIM);
    expect(chips.map(c => c.id)).toEqual(['summarize', 'keypoints', 'explain']);
  });

  it('returns all chips for deep mode', () => {
    const chips = getChipsForMode(READING_MODES.DEEP);
    expect(chips.length).toBeGreaterThan(5);
  });

  it('persists mode to session', async () => {
    await setSessionMode(testSessionId, 'skim');
    const mode = await getSessionMode(testSessionId);
    expect(mode.id).toBe('skim');
  });
});
```

---

## Task 1.3: Bloom's Taxonomy Quick Actions

### Objective
Organize quick actions by cognitive level for progressive learning.

### Implementation

Already implemented in Task 1.2 via `getChipsForMode()`. Additional enhancement:

#### Add Visual Grouping by Level

**File:** `sidepanel.js` or CSS

```css
/* Group chips by cognitive level */
.sp-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
}

/* Basic level chips (1-2) */
.sp-chip[data-level="1"],
.sp-chip[data-level="2"] {
  background: #ecfdf5;
  border-color: #10b981;
  color: #065f46;
}

/* Application level chips (3) */
.sp-chip[data-level="3"] {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1e40af;
}

/* Analysis level chips (4) */
.sp-chip[data-level="4"] {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

/* Evaluation level chips (5) */
.sp-chip[data-level="5"] {
  background: #fce7f3;
  border-color: #ec4899;
  color: #9d174d;
}

/* Creation level chips (6) */
.sp-chip[data-level="6"] {
  background: #f3e8ff;
  border-color: #a855f7;
  color: #6b21a8;
}

/* Add separator between levels in Deep mode */
.sp-quick-actions[data-mode="deep"]::after {
  content: '';
  flex-basis: 100%;
  height: 0;
}

.sp-chip-save {
  margin-left: auto;
}
```

### Success Criteria
- [ ] Chips visually grouped by cognitive level
- [ ] Color coding indicates difficulty
- [ ] Progressive unlocking in Skim vs Deep

---

## Task 1.4: Smart Nudges

### Objective
Proactively intervene when detecting passive reading patterns.

### Implementation Steps

#### Step 1: Create Nudge Engine

**File:** `services/nudge_engine.js` (NEW)

```javascript
/**
 * Nudge Engine
 * Detects passive reading and triggers proactive interventions.
 */

const NUDGE_CONFIG = {
  // Fast scroll detection
  fastScrollThreshold: 500,  // pixels per second
  fastScrollMinEvents: 5,    // consecutive fast scrolls

  // Passive reading detection
  passiveTimeThreshold: 5 * 60 * 1000,  // 5 minutes
  passiveHighlightThreshold: 0,  // 0 highlights = passive

  // Section end detection
  sectionEndBuffer: 100,  // pixels from heading

  // Cooldown between nudges
  nudgeCooldownMs: 2 * 60 * 1000,  // 2 minutes

  // Max nudges per session
  maxNudgesPerSession: 5
};

const NUDGE_TYPES = {
  FAST_SCROLL: {
    id: 'fast_scroll',
    title: 'Đọc nhanh quá!',
    icon: '🏃',
    message: 'Bạn đang lướt khá nhanh. Có muốn dừng lại xem xét đoạn này?',
    actions: [
      { id: 'pause', label: 'Dừng lại', primary: true },
      { id: 'continue', label: 'Tiếp tục' }
    ]
  },
  PASSIVE_READING: {
    id: 'passive_reading',
    title: 'Một phút suy nghĩ...',
    icon: '💭',
    message: 'Đã 5 phút rồi. Có điều gì đáng chú ý trong phần bạn vừa đọc?',
    actions: [
      { id: 'highlight_now', label: 'Highlight ngay', primary: true },
      { id: 'nothing_important', label: 'Không có gì' },
      { id: 'remind_later', label: 'Nhắc sau' }
    ]
  },
  SECTION_END: {
    id: 'section_end',
    title: 'Kết thúc phần',
    icon: '📖',
    message: 'Bạn vừa đọc xong phần "{sectionTitle}". Ý chính là gì?',
    actions: [
      { id: 'summarize', label: 'Tóm tắt', primary: true },
      { id: 'go_back', label: 'Đọc lại' },
      { id: 'continue', label: 'Tiếp tục' }
    ]
  },
  COMPLETION: {
    id: 'completion',
    title: 'Đọc xong!',
    icon: '🎉',
    message: 'Bạn đã đọc xong bài viết. Có thể tóm tắt 3 điểm chính không?',
    actions: [
      { id: 'quiz', label: 'Quiz nhanh', primary: true },
      { id: 'summarize', label: 'Tóm tắt' },
      { id: 'done', label: 'Hoàn thành' }
    ]
  }
};

class NudgeEngine {
  constructor() {
    this.scrollHistory = [];
    this.lastHighlightTime = Date.now();
    this.highlightCount = 0;
    this.lastNudgeTime = 0;
    this.nudgeCount = 0;
    this.passedSections = new Set();
    this.startTime = Date.now();
  }

  /**
   * Records a scroll event.
   */
  recordScroll(scrollData) {
    this.scrollHistory.push({
      ...scrollData,
      timestamp: Date.now()
    });

    // Keep last 20 events
    if (this.scrollHistory.length > 20) {
      this.scrollHistory.shift();
    }
  }

  /**
   * Records a highlight creation.
   */
  recordHighlight() {
    this.highlightCount++;
    this.lastHighlightTime = Date.now();
  }

  /**
   * Records passing a section heading.
   */
  recordSectionPass(sectionTitle) {
    if (!this.passedSections.has(sectionTitle)) {
      this.passedSections.add(sectionTitle);
      return true;  // New section
    }
    return false;
  }

  /**
   * Checks if a nudge can be shown (respects cooldown).
   */
  canShowNudge() {
    if (this.nudgeCount >= NUDGE_CONFIG.maxNudgesPerSession) {
      return false;
    }

    const timeSinceLastNudge = Date.now() - this.lastNudgeTime;
    return timeSinceLastNudge > NUDGE_CONFIG.nudgeCooldownMs;
  }

  /**
   * Checks for fast scrolling pattern.
   * @returns {Object|null} Nudge data or null
   */
  checkFastScroll() {
    if (!this.canShowNudge()) return null;

    const recentScrolls = this.scrollHistory.slice(-NUDGE_CONFIG.fastScrollMinEvents);
    if (recentScrolls.length < NUDGE_CONFIG.fastScrollMinEvents) return null;

    // Calculate average scroll speed
    const avgSpeed = recentScrolls.reduce((sum, s) => sum + s.speed, 0) / recentScrolls.length;

    if (avgSpeed > NUDGE_CONFIG.fastScrollThreshold && this.highlightCount === 0) {
      return {
        ...NUDGE_TYPES.FAST_SCROLL,
        triggerData: { avgSpeed, scrollCount: recentScrolls.length }
      };
    }

    return null;
  }

  /**
   * Checks for passive reading (no highlights in 5+ minutes).
   * @returns {Object|null}
   */
  checkPassiveReading() {
    if (!this.canShowNudge()) return null;

    const timeSinceHighlight = Date.now() - this.lastHighlightTime;
    const readingTime = Date.now() - this.startTime;

    // Only trigger after some reading time
    if (readingTime < NUDGE_CONFIG.passiveTimeThreshold) return null;

    if (timeSinceHighlight > NUDGE_CONFIG.passiveTimeThreshold &&
        this.highlightCount <= NUDGE_CONFIG.passiveHighlightThreshold) {
      return {
        ...NUDGE_TYPES.PASSIVE_READING,
        triggerData: { timeSinceHighlight, highlightCount: this.highlightCount }
      };
    }

    return null;
  }

  /**
   * Checks if user just passed a section boundary.
   * @param {string} sectionTitle - Title of section just passed
   * @returns {Object|null}
   */
  checkSectionEnd(sectionTitle) {
    if (!this.canShowNudge()) return null;
    if (!sectionTitle) return null;

    const isNew = this.recordSectionPass(sectionTitle);
    if (isNew) {
      const nudge = { ...NUDGE_TYPES.SECTION_END };
      nudge.message = nudge.message.replace('{sectionTitle}', sectionTitle);
      nudge.triggerData = { sectionTitle };
      return nudge;
    }

    return null;
  }

  /**
   * Checks if user reached end of article.
   * @param {number} scrollProgress - 0-100 scroll percentage
   * @returns {Object|null}
   */
  checkCompletion(scrollProgress) {
    if (!this.canShowNudge()) return null;

    if (scrollProgress >= 95) {
      return {
        ...NUDGE_TYPES.COMPLETION,
        triggerData: { scrollProgress }
      };
    }

    return null;
  }

  /**
   * Marks that a nudge was shown.
   */
  recordNudgeShown() {
    this.lastNudgeTime = Date.now();
    this.nudgeCount++;
  }

  /**
   * Resets engine state.
   */
  reset() {
    this.scrollHistory = [];
    this.lastHighlightTime = Date.now();
    this.highlightCount = 0;
    this.lastNudgeTime = 0;
    this.nudgeCount = 0;
    this.passedSections.clear();
    this.startTime = Date.now();
  }
}

// Export singleton
const nudgeEngine = new NudgeEngine();

export { nudgeEngine, NUDGE_TYPES, NUDGE_CONFIG };
```

#### Step 2: Create Nudge UI Component

**File:** `ui/components/nudge.js` (NEW)

```javascript
/**
 * Nudge UI Component
 */

/**
 * Creates nudge popup UI.
 * @param {Object} nudgeData - Nudge configuration
 * @param {Function} onAction - Callback for action click
 * @returns {HTMLElement}
 */
function createNudgeUI(nudgeData, onAction) {
  const container = document.createElement('div');
  container.className = 'sp-nudge-overlay';
  container.innerHTML = `
    <div class="sp-nudge-popup">
      <div class="sp-nudge-header">
        <span class="sp-nudge-icon">${nudgeData.icon}</span>
        <span class="sp-nudge-title">${nudgeData.title}</span>
      </div>

      <div class="sp-nudge-content">
        <p class="sp-nudge-message">${nudgeData.message}</p>
      </div>

      <div class="sp-nudge-actions">
        ${nudgeData.actions.map(action => `
          <button
            class="sp-nudge-btn ${action.primary ? 'sp-nudge-btn-primary' : ''}"
            data-action="${action.id}"
          >
            ${action.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Attach handlers
  container.querySelectorAll('.sp-nudge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action;
      onAction(actionId, nudgeData);
      dismissNudge(container);
    });
  });

  // Click outside to dismiss
  container.addEventListener('click', (e) => {
    if (e.target === container) {
      dismissNudge(container);
    }
  });

  return container;
}

function dismissNudge(container) {
  container.classList.add('sp-nudge-dismissed');
  setTimeout(() => container.remove(), 300);
}

const NUDGE_STYLES = `
.sp-nudge-overlay {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  animation: nudgeIn 0.3s ease-out;
}

@keyframes nudgeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sp-nudge-dismissed {
  animation: nudgeOut 0.3s ease-out forwards;
}

@keyframes nudgeOut {
  to {
    opacity: 0;
    transform: translateY(20px);
  }
}

.sp-nudge-popup {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 300px;
  overflow: hidden;
}

.sp-nudge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
}

.sp-nudge-icon {
  font-size: 20px;
}

.sp-nudge-title {
  font-weight: 600;
}

.sp-nudge-content {
  padding: 16px;
}

.sp-nudge-message {
  margin: 0;
  color: #374151;
  line-height: 1.5;
}

.sp-nudge-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.sp-nudge-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.sp-nudge-btn:hover {
  background: #f3f4f6;
}

.sp-nudge-btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.sp-nudge-btn-primary:hover {
  background: #2563eb;
}
`;

function injectNudgeStyles() {
  if (document.getElementById('nudge-styles')) return;

  const style = document.createElement('style');
  style.id = 'nudge-styles';
  style.textContent = NUDGE_STYLES;
  document.head.appendChild(style);
}

export { createNudgeUI, injectNudgeStyles };
```

#### Step 3: Integrate Nudge Engine into Content Script

**File:** `content.js`

```javascript
import { nudgeEngine } from './services/nudge_engine.js';
import { createNudgeUI, injectNudgeStyles } from './ui/components/nudge.js';

let currentNudge = null;

/**
 * Initializes nudge tracking.
 */
function initNudgeTracking() {
  injectNudgeStyles();

  // Track scrolling
  let lastScrollY = window.scrollY;
  let lastScrollTime = Date.now();

  window.addEventListener('scroll', () => {
    const now = Date.now();
    const timeDelta = now - lastScrollTime;
    const scrollDelta = Math.abs(window.scrollY - lastScrollY);

    if (timeDelta > 50) {  // Debounce
      const speed = scrollDelta / (timeDelta / 1000);  // pixels per second

      nudgeEngine.recordScroll({
        speed,
        position: window.scrollY,
        direction: window.scrollY > lastScrollY ? 'down' : 'up'
      });

      // Check for fast scroll nudge
      const nudge = nudgeEngine.checkFastScroll();
      if (nudge) showNudge(nudge);

      lastScrollY = window.scrollY;
      lastScrollTime = now;
    }

    // Check for completion
    const scrollProgress = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
    const completionNudge = nudgeEngine.checkCompletion(scrollProgress);
    if (completionNudge) showNudge(completionNudge);

    // Check for section end (using intersection observer is better)
    checkSectionBoundaries();
  });

  // Track highlight creation
  document.addEventListener('highlight-created', () => {
    nudgeEngine.recordHighlight();
  });

  // Check for passive reading periodically
  setInterval(() => {
    const nudge = nudgeEngine.checkPassiveReading();
    if (nudge) showNudge(nudge);
  }, 60000);  // Check every minute
}

/**
 * Sets up section boundary detection.
 */
function setupSectionObserver() {
  const headings = document.querySelectorAll('h2, h3');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // User scrolled past this heading
        const sectionTitle = entry.target.textContent.trim();
        const nudge = nudgeEngine.checkSectionEnd(sectionTitle);
        if (nudge) showNudge(nudge);
      }
    });
  }, {
    threshold: 0,
    rootMargin: '-100px 0px 0px 0px'
  });

  headings.forEach(h => observer.observe(h));
}

/**
 * Shows a nudge to the user.
 */
function showNudge(nudgeData) {
  // Don't show if one is already visible
  if (currentNudge) return;

  nudgeEngine.recordNudgeShown();

  currentNudge = createNudgeUI(nudgeData, handleNudgeAction);
  document.body.appendChild(currentNudge);

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (currentNudge) {
      currentNudge.classList.add('sp-nudge-dismissed');
      setTimeout(() => {
        currentNudge?.remove();
        currentNudge = null;
      }, 300);
    }
  }, 30000);
}

/**
 * Handles nudge action clicks.
 */
function handleNudgeAction(actionId, nudgeData) {
  currentNudge = null;

  // Log action for analytics
  console.log('[Nudge] Action:', actionId, nudgeData.id);

  switch (actionId) {
    case 'pause':
    case 'highlight_now':
      // Open sidepanel or prompt to highlight
      chrome.runtime.sendMessage({ action: 'openSidepanel' });
      break;

    case 'summarize':
      // Trigger summarize action in sidepanel
      chrome.runtime.sendMessage({
        action: 'triggerQuickAction',
        quickAction: 'summarize'
      });
      break;

    case 'quiz':
      // Trigger quiz
      chrome.runtime.sendMessage({
        action: 'triggerQuickAction',
        quickAction: 'quiz'
      });
      break;

    case 'go_back':
      // Scroll back to section start
      if (nudgeData.triggerData?.sectionTitle) {
        const heading = Array.from(document.querySelectorAll('h2, h3'))
          .find(h => h.textContent.includes(nudgeData.triggerData.sectionTitle));
        if (heading) {
          heading.scrollIntoView({ behavior: 'smooth' });
        }
      }
      break;

    case 'remind_later':
      // Reset passive reading timer
      nudgeEngine.lastHighlightTime = Date.now();
      break;

    case 'continue':
    case 'nothing_important':
    case 'done':
      // Just dismiss
      break;
  }
}

// Initialize on page load
initNudgeTracking();
setupSectionObserver();
```

### Success Criteria
- [ ] Fast scroll nudge appears after 5+ fast scrolls with no highlights
- [ ] Passive reading nudge appears after 5 minutes without highlights
- [ ] Section end nudge appears when passing H2/H3 boundaries
- [ ] Completion nudge appears at 95% scroll
- [ ] Cooldown prevents nudge spam
- [ ] Max 5 nudges per session

### Testing
```javascript
describe('Nudge Engine', () => {
  it('detects fast scrolling', () => {
    const engine = new NudgeEngine();

    // Simulate fast scrolls
    for (let i = 0; i < 6; i++) {
      engine.recordScroll({ speed: 600, position: i * 500 });
    }

    const nudge = engine.checkFastScroll();
    expect(nudge).toBeTruthy();
    expect(nudge.id).toBe('fast_scroll');
  });

  it('detects passive reading', () => {
    const engine = new NudgeEngine();
    engine.startTime = Date.now() - 6 * 60 * 1000;  // 6 min ago
    engine.lastHighlightTime = Date.now() - 6 * 60 * 1000;

    const nudge = engine.checkPassiveReading();
    expect(nudge).toBeTruthy();
    expect(nudge.id).toBe('passive_reading');
  });

  it('respects cooldown', () => {
    const engine = new NudgeEngine();
    engine.recordNudgeShown();

    // Fast scroll detection should fail due to cooldown
    for (let i = 0; i < 6; i++) {
      engine.recordScroll({ speed: 600, position: i * 500 });
    }

    const nudge = engine.checkFastScroll();
    expect(nudge).toBeNull();
  });
});
```

---

## Task 1.5: Timer ↔ Reading Integration

### Objective
Link Focus Timer sessions with reading context to enable end-of-session reviews.

### Implementation Steps

#### Step 1: Create Timer Integration Service

**File:** `services/timer_integration.js` (NEW)

```javascript
/**
 * Timer Integration Service
 * Links Focus Timer with Reading Sessions.
 */

import * as SessionService from '../storage/reading_session.js';

/**
 * Starts tracking a focus session.
 * @param {Object} timerData - Timer configuration
 * @param {Object} pageContext - Current page context
 */
async function startFocusTracking(timerData, pageContext) {
  // Get or create reading session
  const session = await SessionService.getOrCreateSession(
    pageContext.url,
    pageContext.title
  );

  // Link focus session
  await SessionService.linkFocusSession(session.id, {
    sessionId: timerData.sessionId,
    startedAt: Date.now(),
    workMin: timerData.workMin,
    breakMin: timerData.breakMin
  });

  // Start metrics tracking
  startMetricsTracking(session.id);

  return session;
}

/**
 * Tracks metrics during focus session.
 */
let metricsInterval = null;
let currentTrackingSessionId = null;

function startMetricsTracking(sessionId) {
  currentTrackingSessionId = sessionId;

  // Track periodically
  metricsInterval = setInterval(async () => {
    if (!currentTrackingSessionId) return;

    const session = await SessionService.getSessionById(currentTrackingSessionId);
    if (!session || !session.focusSession) return;

    // Update scroll depth
    const scrollDepth = Math.round(
      (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
    );

    session.focusSession.metrics.scrollDepth = Math.max(
      session.focusSession.metrics.scrollDepth || 0,
      scrollDepth
    );

    await SessionService.saveSession(session);
  }, 30000);  // Every 30 seconds
}

function stopMetricsTracking() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  currentTrackingSessionId = null;
}

/**
 * Called when focus session work phase ends.
 * @param {string} sessionId - Reading session ID
 * @returns {Promise<Object>} Session summary and review data
 */
async function onWorkPhaseEnd(sessionId) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session) return null;

  // Generate recall question
  const recallQuestion = await generateRecallQuestion(session);

  // Update session
  if (session.focusSession) {
    session.focusSession.endedAt = Date.now();
    session.focusSession.review = {
      recallQuestion: recallQuestion
    };
    await SessionService.saveSession(session);
  }

  return {
    session,
    summary: buildSessionSummary(session),
    recallQuestion
  };
}

/**
 * Builds session summary for review.
 */
function buildSessionSummary(session) {
  const focusMetrics = session.focusSession?.metrics || {};

  return {
    title: session.title,
    duration: session.focusSession?.workMin || 0,
    stats: {
      highlights: session.highlights.length,
      insights: session.insights.length,
      messages: session.thread?.messages?.length || 0,
      scrollDepth: focusMetrics.scrollDepth || 0
    }
  };
}

/**
 * Generates a recall question based on session content.
 */
async function generateRecallQuestion(session) {
  // Get highlights and insights
  const highlights = session.highlights.map(h => h.text).join('\n');
  const insights = session.insights.map(i => i.text).join('\n');

  if (!highlights && !insights) {
    return 'What was the main topic of what you just read?';
  }

  const prompt = `Based on this reading session, generate ONE recall question to test comprehension:

Title: ${session.title}

Highlights:
${highlights || 'None'}

Insights:
${insights || 'None'}

Generate a specific, testable question about the key concept. Return ONLY the question, nothing else.`;

  try {
    const question = await callGeminiAPI(prompt);
    return question.trim();
  } catch {
    return 'What are the 2-3 key points from what you just read?';
  }
}

/**
 * Records user's recall answer and scores it.
 */
async function recordRecallAnswer(sessionId, answer) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session || !session.focusSession?.review) return null;

  // Score the answer
  const score = await scoreRecallAnswer(
    session,
    session.focusSession.review.recallQuestion,
    answer
  );

  // Update session
  session.focusSession.review.recallAnswer = answer;
  session.focusSession.review.recallScore = score.score;
  session.focusSession.review.recallFeedback = score.feedback;

  await SessionService.saveSession(session);

  return score;
}

/**
 * Scores a recall answer.
 */
async function scoreRecallAnswer(session, question, answer) {
  const prompt = `Score this recall answer:

Question: ${question}

User's Answer: ${answer}

Context (what user read):
${session.highlights.map(h => h.text).slice(0, 3).join('\n')}

Evaluate:
1. Does the answer demonstrate understanding of the main concepts?
2. Is it accurate based on the source material?
3. Is it complete or missing key points?

Return JSON:
{
  "score": 0-100,
  "feedback": "Brief feedback (1-2 sentences)",
  "correct": ["list of correct points"],
  "missing": ["list of missing points"]
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      score: 50,
      feedback: 'Could not evaluate answer automatically.',
      correct: [],
      missing: []
    };
  }
}

/**
 * Updates focus session metrics when highlight is created.
 */
async function recordHighlightDuringFocus(sessionId) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session?.focusSession) return;

  session.focusSession.metrics.highlightsCreated =
    (session.focusSession.metrics.highlightsCreated || 0) + 1;

  await SessionService.saveSession(session);
}

/**
 * Updates focus session metrics when insight is created.
 */
async function recordInsightDuringFocus(sessionId) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session?.focusSession) return;

  session.focusSession.metrics.insightsCreated =
    (session.focusSession.metrics.insightsCreated || 0) + 1;

  await SessionService.saveSession(session);
}

/**
 * Updates focus session metrics when message is sent.
 */
async function recordMessageDuringFocus(sessionId) {
  const session = await SessionService.getSessionById(sessionId);
  if (!session?.focusSession) return;

  session.focusSession.metrics.messagesExchanged =
    (session.focusSession.metrics.messagesExchanged || 0) + 1;

  await SessionService.saveSession(session);
}

export {
  startFocusTracking,
  stopMetricsTracking,
  onWorkPhaseEnd,
  recordRecallAnswer,
  recordHighlightDuringFocus,
  recordInsightDuringFocus,
  recordMessageDuringFocus
};
```

#### Step 2: Update popup.js for Timer Integration

**File:** `popup.js`

```javascript
import * as TimerIntegration from './services/timer_integration.js';

let linkedReadingSession = null;

/**
 * Enhanced startTimer function.
 */
async function startTimer() {
  // Existing timer start logic...
  const timerData = {
    sessionId: generateTimerSessionId(),
    workMin: selectedWorkMin,
    breakMin: selectedBreakMin
  };

  // Get current tab context
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.url && !tab.url.startsWith('chrome://')) {
    // Link with reading session
    linkedReadingSession = await TimerIntegration.startFocusTracking(timerData, {
      url: tab.url,
      title: tab.title
    });

    console.log('[Timer] Linked with reading session:', linkedReadingSession.id);
  }

  // Continue with existing timer logic...
}

/**
 * Called when work phase ends.
 */
async function onWorkPhaseComplete() {
  // Existing break notification logic...

  if (linkedReadingSession) {
    const reviewData = await TimerIntegration.onWorkPhaseEnd(linkedReadingSession.id);

    if (reviewData) {
      showEndOfSessionReview(reviewData);
    }
  }
}

/**
 * Shows end-of-session review UI.
 */
function showEndOfSessionReview(reviewData) {
  const container = document.getElementById('timer-container');

  const reviewUI = document.createElement('div');
  reviewUI.className = 'timer-review';
  reviewUI.innerHTML = `
    <div class="review-header">
      <span class="review-icon">⏱️</span>
      <span>Focus session complete!</span>
    </div>

    <div class="review-article">
      <span class="review-label">📖 You read:</span>
      <span class="review-title">${reviewData.summary.title}</span>
    </div>

    <div class="review-stats">
      <span class="review-stat">
        <span class="stat-value">${reviewData.summary.stats.highlights}</span>
        <span class="stat-label">highlights</span>
      </span>
      <span class="review-stat">
        <span class="stat-value">${reviewData.summary.stats.insights}</span>
        <span class="stat-label">insights</span>
      </span>
      <span class="review-stat">
        <span class="stat-value">${reviewData.summary.stats.scrollDepth}%</span>
        <span class="stat-label">read</span>
      </span>
    </div>

    <div class="review-recall">
      <div class="recall-header">🧠 Quick recall:</div>
      <div class="recall-question">"${reviewData.recallQuestion}"</div>
      <textarea
        id="recall-answer"
        placeholder="Type your answer..."
        rows="3"
      ></textarea>
    </div>

    <div class="review-actions">
      <button id="submit-recall" class="btn-primary">Submit Answer</button>
      <button id="skip-recall" class="btn-secondary">Skip to Break</button>
      <button id="end-session" class="btn-secondary">End Session</button>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(reviewUI);

  // Attach handlers
  document.getElementById('submit-recall').addEventListener('click', async () => {
    const answer = document.getElementById('recall-answer').value;
    if (!answer.trim()) return;

    const score = await TimerIntegration.recordRecallAnswer(
      linkedReadingSession.id,
      answer
    );

    showRecallFeedback(score);
  });

  document.getElementById('skip-recall').addEventListener('click', () => {
    startBreakPhase();
  });

  document.getElementById('end-session').addEventListener('click', () => {
    endFocusSession();
  });
}

/**
 * Shows feedback on recall answer.
 */
function showRecallFeedback(score) {
  const container = document.querySelector('.review-recall');

  const feedbackUI = document.createElement('div');
  feedbackUI.className = 'recall-feedback';
  feedbackUI.innerHTML = `
    <div class="feedback-score ${score.score >= 70 ? 'good' : 'needs-work'}">
      Score: ${score.score}%
    </div>
    <div class="feedback-text">${score.feedback}</div>
    ${score.correct.length ? `
      <div class="feedback-correct">
        ✅ Correct: ${score.correct.join(', ')}
      </div>
    ` : ''}
    ${score.missing.length ? `
      <div class="feedback-missing">
        ⚠️ Missing: ${score.missing.join(', ')}
      </div>
    ` : ''}
    <button id="continue-to-break" class="btn-primary">Continue to Break</button>
  `;

  container.innerHTML = '';
  container.appendChild(feedbackUI);

  document.getElementById('continue-to-break').addEventListener('click', startBreakPhase);
}
```

#### Step 3: Add Review UI Styles

**File:** `popup.css` or inline

```css
.timer-review {
  padding: 16px;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.review-article {
  background: #f3f4f6;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.review-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.review-title {
  display: block;
  font-weight: 500;
  color: #1f2937;
}

.review-stats {
  display: flex;
  justify-content: space-around;
  padding: 12px;
  background: #eff6ff;
  border-radius: 8px;
  margin-bottom: 16px;
}

.review-stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: #1d4ed8;
}

.stat-label {
  font-size: 11px;
  color: #6b7280;
}

.review-recall {
  margin-bottom: 16px;
}

.recall-header {
  font-weight: 500;
  margin-bottom: 8px;
}

.recall-question {
  font-style: italic;
  color: #374151;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #fef3c7;
  border-radius: 6px;
}

#recall-answer {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: none;
}

.review-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recall-feedback {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.feedback-score {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.feedback-score.good {
  color: #059669;
}

.feedback-score.needs-work {
  color: #d97706;
}

.feedback-text {
  margin-bottom: 12px;
}

.feedback-correct {
  color: #059669;
  font-size: 13px;
  margin-bottom: 4px;
}

.feedback-missing {
  color: #d97706;
  font-size: 13px;
  margin-bottom: 12px;
}
```

### Success Criteria
- [ ] Timer captures current tab URL/title when starting
- [ ] Metrics tracked during focus session
- [ ] End-of-session review shown when work phase ends
- [ ] Recall question generated from session content
- [ ] Answer scored with feedback
- [ ] Session summary saved

### Testing
```javascript
describe('Timer Integration', () => {
  it('links focus session to reading session', async () => {
    const timerData = { sessionId: 'timer_123', workMin: 25, breakMin: 5 };
    const pageContext = { url: 'https://example.com', title: 'Test' };

    const session = await startFocusTracking(timerData, pageContext);

    expect(session.focusSession).toBeTruthy();
    expect(session.focusSession.sessionId).toBe('timer_123');
  });

  it('tracks metrics during focus', async () => {
    // Start tracking...
    await recordHighlightDuringFocus(sessionId);
    await recordHighlightDuringFocus(sessionId);

    const session = await getSessionById(sessionId);
    expect(session.focusSession.metrics.highlightsCreated).toBe(2);
  });

  it('generates recall question', async () => {
    const session = createMockSession();
    session.highlights = [{ text: 'React Hooks allow...' }];

    const reviewData = await onWorkPhaseEnd(session.id);
    expect(reviewData.recallQuestion).toBeTruthy();
  });
});
```

---

## Task 1.6: Auto-Summarize Thread

### Objective
After 2-3 chat exchanges, offer to summarize and suggest next steps.

### Implementation Steps

#### Step 1: Add Auto-Summarize Logic

**File:** `sidepanel.js`

```javascript
const AUTO_SUMMARIZE_THRESHOLD = 3;  // messages from assistant

/**
 * Checks if thread should be auto-summarized.
 */
function checkAutoSummarize(thread) {
  if (!thread?.messages) return false;

  const assistantMsgCount = thread.messages.filter(m => m.role === 'assistant').length;

  return assistantMsgCount >= AUTO_SUMMARIZE_THRESHOLD &&
         !thread.autoSummarized;
}

/**
 * Generates thread summary and suggestions.
 */
async function generateThreadSummary(thread) {
  const messages = thread.messages.map(m =>
    `${m.role}: ${m.content.slice(0, 500)}`
  ).join('\n---\n');

  const prompt = `Summarize this conversation thread and suggest next steps:

Highlighted text: "${thread.highlight?.text || 'N/A'}"

Conversation:
${messages}

Provide:
1. Key takeaways (2-3 bullet points)
2. Suggested follow-up questions (2-3)

Format as JSON:
{
  "takeaways": ["takeaway 1", "takeaway 2"],
  "suggestions": ["question 1", "question 2"]
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      takeaways: ['Summary could not be generated'],
      suggestions: ['Ask a follow-up question']
    };
  }
}

/**
 * Shows auto-summary UI.
 */
function showAutoSummary(summaryData) {
  const container = document.createElement('div');
  container.className = 'sp-auto-summary';
  container.innerHTML = `
    <div class="sp-summary-header">
      <span class="sp-summary-icon">💡</span>
      <span>Thread Summary</span>
      <button class="sp-summary-dismiss" onclick="this.closest('.sp-auto-summary').remove()">×</button>
    </div>

    <div class="sp-summary-content">
      <p class="sp-summary-intro">You've explored this passage in depth. Here's a summary:</p>

      <div class="sp-takeaways">
        <div class="sp-takeaways-header">📝 Key takeaways:</div>
        <ul>
          ${summaryData.takeaways.map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>

      <div class="sp-suggestions">
        <div class="sp-suggestions-header">🤔 Suggested next questions:</div>
        <ul>
          ${summaryData.suggestions.map((s, i) => `
            <li class="sp-suggestion-item" data-question="${s}">
              ${s}
            </li>
          `).join('')}
        </ul>
      </div>
    </div>

    <div class="sp-summary-actions">
      <button class="sp-action-btn sp-action-primary" onclick="createInsightFromSummary()">
        💡 Create Insight
      </button>
      <button class="sp-action-btn" onclick="askSuggestedQuestion(0)">
        Ask Follow-up
      </button>
      <button class="sp-action-btn" onclick="dismissSummary()">
        Move On
      </button>
    </div>
  `;

  // Make suggestions clickable
  container.querySelectorAll('.sp-suggestion-item').forEach((item, index) => {
    item.addEventListener('click', () => askSuggestedQuestion(index));
    item.style.cursor = 'pointer';
  });

  // Insert after last message
  const messagesContainer = document.querySelector('.sp-messages');
  messagesContainer.appendChild(container);

  // Mark thread as summarized
  if (currentSession?.thread) {
    currentSession.thread.autoSummarized = true;
    currentSession.thread.summary = summaryData;
    SessionService.saveSession(currentSession);
  }
}

/**
 * Creates insight from summary takeaways.
 */
function createInsightFromSummary() {
  if (!currentSession?.thread?.summary) return;

  const takeaways = currentSession.thread.summary.takeaways;
  const insightText = takeaways.join(' • ');

  document.getElementById('insight-input').value = insightText;
  document.querySelector('.sp-insight-editor').classList.add('active');
}

/**
 * Asks a suggested follow-up question.
 */
function askSuggestedQuestion(index) {
  if (!currentSession?.thread?.summary?.suggestions) return;

  const question = currentSession.thread.summary.suggestions[index];
  if (!question) return;

  // Set as user input and send
  const input = document.getElementById('chat-input');
  input.value = question;
  sendMessage();
}

/**
 * Dismisses the summary and closes thread.
 */
function dismissSummary() {
  document.querySelector('.sp-auto-summary')?.remove();
  // Could mark thread as 'done' here
}

// Check after each message
async function onMessageReceived(thread) {
  if (checkAutoSummarize(thread)) {
    const summaryData = await generateThreadSummary(thread);
    showAutoSummary(summaryData);
  }
}
```

#### Step 2: Add Auto-Summary Styles

```css
.sp-auto-summary {
  margin: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #fcd34d;
  border-radius: 12px;
  overflow: hidden;
}

.sp-summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.sp-summary-icon {
  font-size: 18px;
}

.sp-summary-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #92400e;
}

.sp-summary-content {
  padding: 16px;
}

.sp-summary-intro {
  margin: 0 0 12px;
  color: #78350f;
}

.sp-takeaways-header,
.sp-suggestions-header {
  font-weight: 500;
  margin-bottom: 8px;
  color: #92400e;
}

.sp-takeaways ul,
.sp-suggestions ul {
  margin: 0;
  padding-left: 20px;
}

.sp-takeaways li,
.sp-suggestions li {
  margin-bottom: 6px;
  color: #78350f;
}

.sp-suggestion-item:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.sp-suggestions {
  margin-top: 12px;
}

.sp-summary-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.5);
  border-top: 1px solid #fcd34d;
}

.sp-action-primary {
  background: #f59e0b !important;
  color: white !important;
  border: none !important;
}
```

### Success Criteria
- [ ] Summary shown after 3 assistant messages
- [ ] Takeaways capture key points
- [ ] Suggested questions are relevant
- [ ] Can create insight from takeaways
- [ ] Can ask suggested questions

### Testing
```javascript
describe('Auto-Summarize', () => {
  it('triggers after 3 assistant messages', () => {
    const thread = {
      messages: [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
        { role: 'assistant', content: 'A2' },
        { role: 'user', content: 'Q3' },
        { role: 'assistant', content: 'A3' },
      ]
    };

    expect(checkAutoSummarize(thread)).toBe(true);
  });

  it('does not trigger twice', () => {
    const thread = {
      messages: [...],
      autoSummarized: true
    };

    expect(checkAutoSummarize(thread)).toBe(false);
  });
});
```

---

## File Changes Summary

### New Files to Create
1. `services/primer_service.js` - Pre-reading primer generation
2. `services/learning_objective.js` - Reading mode management
3. `services/nudge_engine.js` - Passive reading detection
4. `services/timer_integration.js` - Focus timer linking
5. `ui/components/primer.js` - Primer UI component
6. `ui/components/mode_selector.js` - Mode selector UI
7. `ui/components/nudge.js` - Nudge popup UI

### Files to Modify
1. `sidepanel.js`
   - Add primer display on page load
   - Add mode selector
   - Update quick actions based on mode
   - Add auto-summarize logic

2. `content.js`
   - Add nudge tracking (scroll, sections)
   - Add section intersection observer

3. `popup.js`
   - Add timer-reading linkage
   - Add end-of-session review UI

4. CSS files
   - Add primer styles
   - Add mode selector styles
   - Add nudge styles
   - Add review styles
   - Add summary styles

---

## Deployment Checklist

- [ ] Phase 0 complete and stable
- [ ] All new services created
- [ ] UI components styled and responsive
- [ ] Primer generation tested
- [ ] Mode switching works correctly
- [ ] Nudges appear appropriately (not too often)
- [ ] Timer integration tracks metrics
- [ ] End-of-session review functional
- [ ] Auto-summarize triggers correctly
- [ ] Update version to 2.8/2.9

---

**End of Phase 1 Specification**
