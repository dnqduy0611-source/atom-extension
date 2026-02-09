# Phase 2: Retention Loop - Implementation Spec

**Version:** 1.0
**Duration:** 3-4 weeks
**Priority:** HIGH
**Dependencies:** Phase 1 complete

---

## Overview

Phase 2 implements the core retention mechanisms: tiered quizzes, teach-back mode, flashcards, and spaced repetition scheduling to transform passive reading into active learning with measurable retention.

---

## Task 2.1: Tiered Quiz System

### Objective
Generate questions at multiple difficulty levels following Bloom's Taxonomy.

### Implementation Steps

#### Step 1: Create Quiz Generator Service

**File:** `services/quiz_generator.js` (NEW)

```javascript
/**
 * Quiz Generator Service
 * Creates tiered questions based on Bloom's Taxonomy.
 */

import { callGeminiAPI } from '../ai_service.js';

/**
 * Quiz difficulty tiers aligned with Bloom's Taxonomy.
 */
const QUIZ_TIERS = {
  1: {
    id: 1,
    name: 'recall',
    label: 'Easy',
    bloomLevel: 'Remember',
    description: 'Direct recall from text',
    questionType: 'multiple_choice',
    promptTemplate: `Generate a RECALL question about this text.
The answer should be directly stated in the text.

Text: "{text}"

Create a multiple-choice question with 4 options.
Return JSON:
{
  "question": "What does the author say about...?",
  "options": ["option A", "option B", "option C", "option D"],
  "correctIndex": 0,
  "explanation": "The text states '...' which directly answers this.",
  "evidence": "exact quote from text"
}`
  },

  2: {
    id: 2,
    name: 'understand',
    label: 'Medium',
    bloomLevel: 'Understand',
    description: 'Requires paraphrasing or interpretation',
    questionType: 'short_answer',
    promptTemplate: `Generate an UNDERSTANDING question about this text.
The answer requires paraphrasing or explaining the meaning.

Text: "{text}"

Create a short-answer question.
Return JSON:
{
  "question": "Why does... / What does the author mean by...?",
  "sampleAnswer": "A good answer would explain...",
  "rubric": {
    "excellent": "Fully explains the concept with own words",
    "good": "Captures main idea but misses nuance",
    "partial": "Shows some understanding",
    "poor": "Misses the point"
  },
  "keyPoints": ["point 1", "point 2"],
  "evidence": "relevant quote"
}`
  },

  3: {
    id: 3,
    name: 'apply',
    label: 'Hard',
    bloomLevel: 'Apply',
    description: 'Transfer knowledge to new situation',
    questionType: 'scenario',
    promptTemplate: `Generate an APPLICATION question about this text.
The answer requires applying the concept to a new situation.

Text: "{text}"

Create a scenario-based question.
Return JSON:
{
  "question": "How would you apply this concept to...?",
  "scenario": "Imagine you are... and need to...",
  "sampleAnswer": "You would...",
  "rubric": {
    "excellent": "Correctly applies concept with justification",
    "good": "Applies concept but weak justification",
    "partial": "Attempts application but has errors",
    "poor": "Cannot apply concept"
  },
  "keyPoints": ["must mention X", "should consider Y"]
}`
  },

  4: {
    id: 4,
    name: 'analyze',
    label: 'Expert',
    bloomLevel: 'Analyze/Evaluate',
    description: 'Compare, contrast, or evaluate',
    questionType: 'open_ended',
    promptTemplate: `Generate an ANALYSIS question about this text.
The answer requires comparing, contrasting, or evaluating.

Text: "{text}"

Create an open-ended analytical question.
Return JSON:
{
  "question": "Compare X with Y... / What are the trade-offs of...?",
  "context": "Additional context for the question",
  "sampleAnswer": "A thorough analysis would...",
  "rubric": {
    "excellent": "Comprehensive analysis with multiple perspectives",
    "good": "Good analysis but misses some angles",
    "partial": "Surface-level comparison",
    "poor": "No real analysis"
  },
  "evaluationCriteria": ["considers pros and cons", "provides evidence", "draws conclusions"]
}`
  }
};

/**
 * Generates a quiz question at the specified tier.
 * @param {string} highlightText - The source text
 * @param {number} tier - Difficulty tier (1-4)
 * @param {Object} context - Additional context (title, section, etc.)
 * @returns {Promise<Object>} Generated question
 */
async function generateQuestion(highlightText, tier = 1, context = {}) {
  const tierConfig = QUIZ_TIERS[tier] || QUIZ_TIERS[1];

  const prompt = tierConfig.promptTemplate
    .replace('{text}', highlightText)
    .replace('{title}', context.title || '')
    .replace('{section}', context.section || '');

  try {
    const response = await callGeminiAPI(prompt);

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response');
    }

    const questionData = JSON.parse(jsonMatch[0]);

    return {
      id: generateQuestionId(),
      tier: tier,
      tierName: tierConfig.name,
      bloomLevel: tierConfig.bloomLevel,
      type: tierConfig.questionType,
      ...questionData,
      sourceText: highlightText,
      generatedAt: Date.now()
    };

  } catch (err) {
    console.error('[Quiz] Generation failed:', err);
    throw err;
  }
}

/**
 * Generates a complete quiz set (one question per tier).
 * @param {string} highlightText - The source text
 * @param {Object} context - Additional context
 * @returns {Promise<Array>} Array of questions
 */
async function generateQuizSet(highlightText, context = {}) {
  const questions = [];

  for (let tier = 1; tier <= 4; tier++) {
    try {
      const question = await generateQuestion(highlightText, tier, context);
      questions.push(question);
    } catch (err) {
      console.error(`[Quiz] Failed to generate tier ${tier}:`, err);
    }
  }

  return questions;
}

/**
 * Evaluates a user's answer.
 * @param {Object} question - The question object
 * @param {string} userAnswer - User's answer
 * @returns {Promise<Object>} Evaluation result
 */
async function evaluateAnswer(question, userAnswer) {
  // Multiple choice - direct comparison
  if (question.type === 'multiple_choice') {
    const isCorrect = userAnswer === question.correctIndex ||
                      userAnswer === question.options[question.correctIndex];

    return {
      correct: isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect
        ? 'Correct! ' + question.explanation
        : `Incorrect. The answer was: ${question.options[question.correctIndex]}. ${question.explanation}`,
      evidence: question.evidence
    };
  }

  // Short answer / open-ended - AI evaluation
  const evalPrompt = `Evaluate this answer:

Question: ${question.question}
${question.scenario ? `Scenario: ${question.scenario}` : ''}

User's Answer: "${userAnswer}"

Sample Answer: ${question.sampleAnswer}
Key Points: ${JSON.stringify(question.keyPoints || [])}

Rubric:
${JSON.stringify(question.rubric, null, 2)}

Evaluate and return JSON:
{
  "score": 0-100,
  "level": "excellent|good|partial|poor",
  "feedback": "Specific feedback on their answer",
  "correctPoints": ["what they got right"],
  "missingPoints": ["what they missed"],
  "suggestions": "How to improve"
}`;

  try {
    const response = await callGeminiAPI(evalPrompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      score: 50,
      level: 'partial',
      feedback: 'Could not evaluate automatically.',
      correctPoints: [],
      missingPoints: []
    };
  }
}

/**
 * Determines next difficulty based on recent performance.
 * @param {Array} recentResults - Last 5 quiz results
 * @param {number} currentTier - Current tier
 * @returns {number} Recommended next tier
 */
function determineNextTier(recentResults, currentTier) {
  if (!recentResults || recentResults.length < 3) {
    return currentTier;
  }

  const recent = recentResults.slice(-5);
  const avgScore = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
  const correctCount = recent.filter(r => r.score >= 70).length;

  // Move up if doing well
  if (correctCount >= 4 && avgScore >= 80) {
    return Math.min(currentTier + 1, 4);
  }

  // Move down if struggling
  if (correctCount <= 1 && avgScore < 50) {
    return Math.max(currentTier - 1, 1);
  }

  return currentTier;
}

function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export {
  QUIZ_TIERS,
  generateQuestion,
  generateQuizSet,
  evaluateAnswer,
  determineNextTier
};
```

#### Step 2: Create Quiz UI Component

**File:** `ui/components/quiz.js` (NEW)

```javascript
/**
 * Quiz UI Component
 */

import { QUIZ_TIERS, evaluateAnswer } from '../../services/quiz_generator.js';

/**
 * Creates quiz UI for a single question.
 * @param {Object} question - Question data
 * @param {Function} onComplete - Callback when answered
 * @returns {HTMLElement}
 */
function createQuizUI(question, onComplete) {
  const container = document.createElement('div');
  container.className = 'sp-quiz-container';
  container.dataset.questionId = question.id;

  const tierInfo = QUIZ_TIERS[question.tier];

  container.innerHTML = `
    <div class="sp-quiz-header">
      <div class="sp-quiz-tier">
        <span class="tier-badge tier-${question.tier}">${tierInfo.label}</span>
        <span class="tier-bloom">${tierInfo.bloomLevel}</span>
      </div>
      <button class="sp-quiz-skip" title="Skip question">Skip</button>
    </div>

    <div class="sp-quiz-question">
      ${question.scenario ? `<div class="sp-quiz-scenario">${question.scenario}</div>` : ''}
      <div class="sp-quiz-question-text">${question.question}</div>
    </div>

    <div class="sp-quiz-answer">
      ${renderAnswerInput(question)}
    </div>

    <div class="sp-quiz-actions">
      <button class="sp-quiz-submit btn-primary" disabled>Submit Answer</button>
    </div>

    <div class="sp-quiz-feedback" style="display: none;"></div>
  `;

  // Setup handlers
  setupQuizHandlers(container, question, onComplete);

  return container;
}

/**
 * Renders appropriate answer input based on question type.
 */
function renderAnswerInput(question) {
  if (question.type === 'multiple_choice') {
    return `
      <div class="sp-quiz-options">
        ${question.options.map((opt, i) => `
          <label class="sp-quiz-option">
            <input type="radio" name="quiz-${question.id}" value="${i}">
            <span class="option-letter">${String.fromCharCode(65 + i)}</span>
            <span class="option-text">${opt}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  // Short answer / open-ended
  return `
    <textarea
      class="sp-quiz-textarea"
      placeholder="Type your answer here..."
      rows="4"
    ></textarea>
  `;
}

/**
 * Sets up event handlers for quiz UI.
 */
function setupQuizHandlers(container, question, onComplete) {
  const submitBtn = container.querySelector('.sp-quiz-submit');
  const skipBtn = container.querySelector('.sp-quiz-skip');
  const feedbackDiv = container.querySelector('.sp-quiz-feedback');

  // Enable submit when answer provided
  if (question.type === 'multiple_choice') {
    container.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        submitBtn.disabled = false;
      });
    });
  } else {
    const textarea = container.querySelector('.sp-quiz-textarea');
    textarea.addEventListener('input', () => {
      submitBtn.disabled = textarea.value.trim().length < 10;
    });
  }

  // Submit answer
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Evaluating...';

    let userAnswer;
    if (question.type === 'multiple_choice') {
      const selected = container.querySelector('input[type="radio"]:checked');
      userAnswer = parseInt(selected.value);
    } else {
      userAnswer = container.querySelector('.sp-quiz-textarea').value;
    }

    // Evaluate
    const result = await evaluateAnswer(question, userAnswer);

    // Show feedback
    showQuizFeedback(container, question, result);

    // Callback
    setTimeout(() => {
      onComplete({
        questionId: question.id,
        tier: question.tier,
        userAnswer,
        ...result
      });
    }, 2000);
  });

  // Skip
  skipBtn.addEventListener('click', () => {
    onComplete({
      questionId: question.id,
      tier: question.tier,
      skipped: true,
      score: 0
    });
  });
}

/**
 * Shows feedback after answering.
 */
function showQuizFeedback(container, question, result) {
  const feedbackDiv = container.querySelector('.sp-quiz-feedback');
  const answerDiv = container.querySelector('.sp-quiz-answer');
  const actionsDiv = container.querySelector('.sp-quiz-actions');

  // Hide answer area
  answerDiv.style.opacity = '0.5';
  answerDiv.style.pointerEvents = 'none';
  actionsDiv.style.display = 'none';

  // Show feedback
  feedbackDiv.style.display = 'block';
  feedbackDiv.className = `sp-quiz-feedback ${result.score >= 70 ? 'correct' : 'incorrect'}`;

  feedbackDiv.innerHTML = `
    <div class="feedback-header">
      <span class="feedback-icon">${result.score >= 70 ? '✅' : '❌'}</span>
      <span class="feedback-score">${result.score}%</span>
    </div>

    <div class="feedback-text">${result.feedback}</div>

    ${result.correctPoints?.length ? `
      <div class="feedback-correct">
        <strong>What you got right:</strong>
        <ul>${result.correctPoints.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${result.missingPoints?.length ? `
      <div class="feedback-missing">
        <strong>What you missed:</strong>
        <ul>${result.missingPoints.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
    ` : ''}

    ${result.evidence ? `
      <div class="feedback-evidence">
        <strong>From the text:</strong> "${result.evidence}"
      </div>
    ` : ''}

    <button class="btn-secondary feedback-continue">Continue</button>
  `;
}

/**
 * Creates a full quiz session UI (multiple questions).
 */
function createQuizSessionUI(questions, onSessionComplete) {
  let currentIndex = 0;
  const results = [];

  const container = document.createElement('div');
  container.className = 'sp-quiz-session';

  // Progress bar
  const progressBar = document.createElement('div');
  progressBar.className = 'sp-quiz-progress';
  progressBar.innerHTML = `
    <div class="progress-text">Question <span id="current-q">1</span> of ${questions.length}</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
  `;
  container.appendChild(progressBar);

  // Question container
  const questionContainer = document.createElement('div');
  questionContainer.className = 'sp-quiz-question-container';
  container.appendChild(questionContainer);

  // Show first question
  function showQuestion(index) {
    questionContainer.innerHTML = '';

    if (index >= questions.length) {
      showSessionSummary(container, results, onSessionComplete);
      return;
    }

    const quizUI = createQuizUI(questions[index], (result) => {
      results.push(result);
      currentIndex++;

      // Update progress
      container.querySelector('#current-q').textContent = currentIndex + 1;
      container.querySelector('.progress-fill').style.width =
        `${(currentIndex / questions.length) * 100}%`;

      // Next question after delay
      setTimeout(() => showQuestion(currentIndex), 500);
    });

    questionContainer.appendChild(quizUI);
  }

  showQuestion(0);
  return container;
}

/**
 * Shows quiz session summary.
 */
function showSessionSummary(container, results, onComplete) {
  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
  const avgScore = Math.round(totalScore / results.length);
  const correctCount = results.filter(r => r.score >= 70).length;

  container.innerHTML = `
    <div class="sp-quiz-summary">
      <div class="summary-header">
        <span class="summary-icon">${avgScore >= 70 ? '🎉' : '📚'}</span>
        <span class="summary-title">Quiz Complete!</span>
      </div>

      <div class="summary-score">
        <div class="score-circle ${avgScore >= 70 ? 'good' : 'needs-work'}">
          <span class="score-value">${avgScore}%</span>
        </div>
        <div class="score-detail">${correctCount}/${results.length} correct</div>
      </div>

      <div class="summary-breakdown">
        ${results.map((r, i) => `
          <div class="breakdown-item ${r.score >= 70 ? 'correct' : 'incorrect'}">
            <span class="breakdown-tier">Tier ${r.tier}</span>
            <span class="breakdown-score">${r.skipped ? 'Skipped' : r.score + '%'}</span>
          </div>
        `).join('')}
      </div>

      <div class="summary-actions">
        <button class="btn-primary" id="add-to-review">Add to Review Deck</button>
        <button class="btn-secondary" id="close-quiz">Done</button>
      </div>
    </div>
  `;

  container.querySelector('#add-to-review').addEventListener('click', () => {
    onComplete({ results, addToReview: true });
  });

  container.querySelector('#close-quiz').addEventListener('click', () => {
    onComplete({ results, addToReview: false });
  });
}

// CSS Styles
const QUIZ_STYLES = `
.sp-quiz-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
  margin: 16px 0;
}

.sp-quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.sp-quiz-tier {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tier-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.tier-1 { background: #dcfce7; color: #166534; }
.tier-2 { background: #fef9c3; color: #854d0e; }
.tier-3 { background: #fed7aa; color: #c2410c; }
.tier-4 { background: #fecaca; color: #dc2626; }

.tier-bloom {
  font-size: 12px;
  color: #6b7280;
}

.sp-quiz-skip {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 13px;
}

.sp-quiz-question {
  padding: 16px;
}

.sp-quiz-scenario {
  background: #fef3c7;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-style: italic;
  color: #92400e;
}

.sp-quiz-question-text {
  font-size: 16px;
  line-height: 1.5;
  color: #1f2937;
}

.sp-quiz-answer {
  padding: 0 16px 16px;
}

.sp-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sp-quiz-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.sp-quiz-option:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.sp-quiz-option input:checked + .option-letter {
  background: #3b82f6;
  color: white;
}

.sp-quiz-option input {
  display: none;
}

.option-letter {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
}

.option-text {
  flex: 1;
}

.sp-quiz-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  resize: none;
  font-size: 14px;
}

.sp-quiz-textarea:focus {
  border-color: #3b82f6;
  outline: none;
}

.sp-quiz-actions {
  padding: 0 16px 16px;
}

.sp-quiz-submit {
  width: 100%;
  padding: 12px;
}

.sp-quiz-feedback {
  padding: 16px;
  margin: 0 16px 16px;
  border-radius: 8px;
}

.sp-quiz-feedback.correct {
  background: #dcfce7;
  border: 1px solid #86efac;
}

.sp-quiz-feedback.incorrect {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.feedback-icon {
  font-size: 20px;
}

.feedback-score {
  font-weight: 600;
  font-size: 18px;
}

.feedback-text {
  margin-bottom: 12px;
}

.feedback-correct, .feedback-missing {
  font-size: 13px;
  margin-bottom: 8px;
}

.feedback-correct { color: #166534; }
.feedback-missing { color: #dc2626; }

.feedback-evidence {
  font-size: 13px;
  font-style: italic;
  color: #6b7280;
  padding: 8px;
  background: rgba(255,255,255,0.5);
  border-radius: 4px;
}

/* Quiz Session Styles */
.sp-quiz-progress {
  padding: 12px 16px;
  background: #f9fafb;
}

.progress-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.3s;
}

/* Summary Styles */
.sp-quiz-summary {
  padding: 24px;
  text-align: center;
}

.summary-header {
  margin-bottom: 24px;
}

.summary-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 8px;
}

.summary-title {
  font-size: 24px;
  font-weight: 600;
}

.score-circle {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 8px;
}

.score-circle.good {
  background: #dcfce7;
  border: 4px solid #22c55e;
}

.score-circle.needs-work {
  background: #fef3c7;
  border: 4px solid #f59e0b;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
}

.summary-breakdown {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 24px 0;
}

.breakdown-item {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.breakdown-item.correct {
  background: #dcfce7;
}

.breakdown-item.incorrect {
  background: #fef2f2;
}

.summary-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
`;

function injectQuizStyles() {
  if (document.getElementById('quiz-styles')) return;
  const style = document.createElement('style');
  style.id = 'quiz-styles';
  style.textContent = QUIZ_STYLES;
  document.head.appendChild(style);
}

export {
  createQuizUI,
  createQuizSessionUI,
  injectQuizStyles
};
```

#### Step 3: Integrate Quiz into Sidepanel

**File:** `sidepanel.js`

```javascript
import * as QuizGenerator from './services/quiz_generator.js';
import { createQuizSessionUI, injectQuizStyles } from './ui/components/quiz.js';

/**
 * Starts a quiz session for current highlight.
 */
async function startQuizSession() {
  if (!currentSession?.thread?.highlight) {
    showToast('Highlight text first to generate a quiz', 'warning');
    return;
  }

  injectQuizStyles();

  // Show loading
  const contentArea = document.querySelector('.sp-content');
  contentArea.innerHTML = '<div class="sp-loading">Generating quiz questions...</div>';

  try {
    // Generate questions
    const questions = await QuizGenerator.generateQuizSet(
      currentSession.thread.highlight.text,
      { title: currentSession.title }
    );

    if (questions.length === 0) {
      throw new Error('No questions generated');
    }

    // Show quiz UI
    const quizUI = createQuizSessionUI(questions, handleQuizComplete);
    contentArea.innerHTML = '';
    contentArea.appendChild(quizUI);

  } catch (err) {
    console.error('[Quiz] Failed:', err);
    showToast('Could not generate quiz', 'error');
    renderThread(currentSession);  // Restore thread view
  }
}

/**
 * Handles quiz session completion.
 */
async function handleQuizComplete({ results, addToReview }) {
  // Calculate average score
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;

  // Update session metrics
  await SessionService.updateMetrics(currentSession.id, {
    assessmentMetrics: {
      quizScore: avgScore
    }
  });

  if (addToReview) {
    // Add questions to flashcard deck (covered in Task 2.3)
    await addQuizToFlashcards(currentSession, results);
    showToast('Added to review deck!', 'success');
  }

  // Restore thread view
  renderThread(currentSession);
}

// Add quiz quick action
QUICK_ACTIONS.quiz = {
  id: 'quiz',
  label: 'Quiz',
  icon: '❓',
  handler: startQuizSession
};
```

### Success Criteria
- [ ] Generates questions at 4 difficulty tiers
- [ ] Multiple choice for tier 1, open-ended for tiers 2-4
- [ ] AI evaluates open-ended answers with rubric
- [ ] Adaptive difficulty based on performance
- [ ] Results tracked in session metrics

---

## Task 2.2: Teach-Back Mode

### Objective
User explains concept back to AI, which evaluates understanding.

### Implementation Steps

#### Step 1: Create Teach-Back Service

**File:** `services/teachback_service.js` (NEW)

```javascript
/**
 * Teach-Back Service
 * Evaluates user explanations of concepts.
 */

import { callGeminiAPI } from '../ai_service.js';

/**
 * Generates a teach-back prompt for a concept.
 * @param {string} concept - The concept to explain
 * @param {string} sourceText - Original text about the concept
 * @returns {Promise<Object>}
 */
async function generateTeachBackPrompt(concept, sourceText) {
  const prompt = `Based on this text, identify the key concept and create a teach-back challenge.

Text: "${sourceText}"

Create a teach-back prompt asking the user to explain this concept.
The prompt should be specific but not give away the answer.

Return JSON:
{
  "concept": "The main concept name",
  "prompt": "Explain [concept] as if teaching a beginner...",
  "keyPointsToMention": ["point 1", "point 2", "point 3"],
  "commonMisconceptions": ["misconception 1", "misconception 2"],
  "hints": ["hint if stuck 1", "hint if stuck 2"]
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[TeachBack] Prompt generation failed:', err);
    return {
      concept: 'the concept',
      prompt: 'Explain what you just read as if teaching a beginner.',
      keyPointsToMention: [],
      commonMisconceptions: [],
      hints: []
    };
  }
}

/**
 * Evaluates user's teach-back explanation.
 * @param {Object} teachBackData - The teach-back challenge data
 * @param {string} userExplanation - User's explanation
 * @returns {Promise<Object>} Evaluation result
 */
async function evaluateExplanation(teachBackData, userExplanation) {
  const prompt = `Evaluate this teach-back explanation:

Concept: ${teachBackData.concept}

Key points that should be mentioned:
${teachBackData.keyPointsToMention.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Common misconceptions to watch for:
${teachBackData.commonMisconceptions.map((m, i) => `- ${m}`).join('\n')}

User's explanation:
"${userExplanation}"

Evaluate the explanation:
1. Which key points were correctly explained?
2. Which key points were missing?
3. Were there any misconceptions?
4. How clear and complete is the explanation?

Return JSON:
{
  "score": 0-100,
  "level": "excellent|good|partial|poor",
  "correctPoints": ["points they got right"],
  "missingPoints": ["points they missed"],
  "misconceptions": ["any misconceptions detected"],
  "clarityScore": 0-100,
  "completenessScore": 0-100,
  "feedback": "Detailed feedback paragraph",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "reviewAreas": ["area to review 1", "area to review 2"]
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[TeachBack] Evaluation failed:', err);
    return {
      score: 50,
      level: 'partial',
      feedback: 'Could not evaluate automatically.',
      correctPoints: [],
      missingPoints: [],
      misconceptions: []
    };
  }
}

/**
 * Provides a hint for the teach-back.
 * @param {Object} teachBackData - The teach-back data
 * @param {number} hintIndex - Which hint to show (0-based)
 * @returns {string}
 */
function getHint(teachBackData, hintIndex) {
  if (teachBackData.hints && teachBackData.hints[hintIndex]) {
    return teachBackData.hints[hintIndex];
  }

  // Generic hints
  const genericHints = [
    'Think about the main problem this concept solves.',
    'Consider how you would use this in practice.',
    'What makes this different from alternatives?'
  ];

  return genericHints[hintIndex % genericHints.length];
}

export {
  generateTeachBackPrompt,
  evaluateExplanation,
  getHint
};
```

#### Step 2: Create Teach-Back UI Component

**File:** `ui/components/teachback.js` (NEW)

```javascript
/**
 * Teach-Back UI Component
 */

import * as TeachBackService from '../../services/teachback_service.js';

/**
 * Creates teach-back UI.
 * @param {Object} teachBackData - Challenge data
 * @param {Function} onComplete - Callback when done
 * @returns {HTMLElement}
 */
function createTeachBackUI(teachBackData, onComplete) {
  const container = document.createElement('div');
  container.className = 'sp-teachback-container';

  let hintsUsed = 0;

  container.innerHTML = `
    <div class="sp-teachback-header">
      <span class="teachback-icon">🎓</span>
      <span class="teachback-title">Teach-Back Challenge</span>
    </div>

    <div class="sp-teachback-content">
      <div class="teachback-concept">
        <span class="label">You've read about:</span>
        <span class="concept-name">"${teachBackData.concept}"</span>
      </div>

      <div class="teachback-prompt">
        ${teachBackData.prompt}
      </div>

      <div class="teachback-input">
        <textarea
          id="teachback-explanation"
          placeholder="Type your explanation here... (minimum 50 characters)"
          rows="6"
        ></textarea>
        <div class="char-count">
          <span id="char-current">0</span>/50 characters minimum
        </div>
      </div>

      <div class="teachback-hints">
        <button class="hint-btn" id="get-hint">
          💡 Get Hint (<span id="hints-remaining">${teachBackData.hints?.length || 3}</span> remaining)
        </button>
        <div class="hint-text" id="hint-display" style="display: none;"></div>
      </div>
    </div>

    <div class="sp-teachback-actions">
      <button class="btn-primary" id="submit-explanation" disabled>Submit</button>
      <button class="btn-secondary" id="skip-teachback">Skip</button>
    </div>

    <div class="sp-teachback-feedback" style="display: none;"></div>
  `;

  // Setup handlers
  const textarea = container.querySelector('#teachback-explanation');
  const submitBtn = container.querySelector('#submit-explanation');
  const skipBtn = container.querySelector('#skip-teachback');
  const hintBtn = container.querySelector('#get-hint');
  const charCount = container.querySelector('#char-current');

  // Character count
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = len;
    submitBtn.disabled = len < 50;
  });

  // Hints
  hintBtn.addEventListener('click', () => {
    const hint = TeachBackService.getHint(teachBackData, hintsUsed);
    hintsUsed++;

    const hintDisplay = container.querySelector('#hint-display');
    hintDisplay.style.display = 'block';
    hintDisplay.innerHTML += `<div class="hint-item">💡 ${hint}</div>`;

    const remaining = Math.max(0, (teachBackData.hints?.length || 3) - hintsUsed);
    container.querySelector('#hints-remaining').textContent = remaining;

    if (remaining === 0) {
      hintBtn.disabled = true;
    }
  });

  // Submit
  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Evaluating...';

    const explanation = textarea.value;
    const result = await TeachBackService.evaluateExplanation(teachBackData, explanation);

    showTeachBackFeedback(container, result, onComplete, hintsUsed);
  });

  // Skip
  skipBtn.addEventListener('click', () => {
    onComplete({
      skipped: true,
      score: 0,
      hintsUsed
    });
  });

  return container;
}

/**
 * Shows evaluation feedback.
 */
function showTeachBackFeedback(container, result, onComplete, hintsUsed) {
  const content = container.querySelector('.sp-teachback-content');
  const actions = container.querySelector('.sp-teachback-actions');
  const feedback = container.querySelector('.sp-teachback-feedback');

  content.style.opacity = '0.5';
  actions.style.display = 'none';
  feedback.style.display = 'block';

  const levelEmoji = {
    excellent: '🌟',
    good: '👍',
    partial: '📚',
    poor: '💪'
  };

  feedback.innerHTML = `
    <div class="feedback-result ${result.score >= 70 ? 'good' : 'needs-work'}">
      <div class="result-header">
        <span class="result-emoji">${levelEmoji[result.level] || '📊'}</span>
        <span class="result-score">Understanding Score: ${result.score}%</span>
      </div>

      <div class="result-bars">
        <div class="bar-item">
          <span class="bar-label">Clarity</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${result.clarityScore || 50}%"></div>
          </div>
        </div>
        <div class="bar-item">
          <span class="bar-label">Completeness</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${result.completenessScore || 50}%"></div>
          </div>
        </div>
      </div>

      ${result.correctPoints?.length ? `
        <div class="result-section correct">
          <strong>✅ You correctly explained:</strong>
          <ul>${result.correctPoints.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      ` : ''}

      ${result.missingPoints?.length ? `
        <div class="result-section missing">
          <strong>⚠️ Could improve:</strong>
          <ul>${result.missingPoints.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      ` : ''}

      ${result.misconceptions?.length ? `
        <div class="result-section misconception">
          <strong>❌ Misconceptions:</strong>
          <ul>${result.misconceptions.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
      ` : ''}

      ${result.reviewAreas?.length ? `
        <div class="result-section review">
          <strong>💡 Suggested review:</strong>
          <p>${result.reviewAreas.join(', ')}</p>
        </div>
      ` : ''}

      <div class="result-actions">
        <button class="btn-primary" id="add-review-btn">Add to Review Queue</button>
        <button class="btn-secondary" id="mark-understood-btn">Mark as Understood</button>
        <button class="btn-secondary" id="try-again-btn">Try Again</button>
      </div>
    </div>
  `;

  // Actions
  feedback.querySelector('#add-review-btn').addEventListener('click', () => {
    onComplete({ ...result, hintsUsed, addToReview: true });
  });

  feedback.querySelector('#mark-understood-btn').addEventListener('click', () => {
    onComplete({ ...result, hintsUsed, understood: true });
  });

  feedback.querySelector('#try-again-btn').addEventListener('click', () => {
    // Reset UI for another attempt
    content.style.opacity = '1';
    actions.style.display = 'flex';
    feedback.style.display = 'none';
    container.querySelector('#teachback-explanation').value = '';
    container.querySelector('#submit-explanation').disabled = true;
    container.querySelector('#char-current').textContent = '0';
  });
}

// Styles
const TEACHBACK_STYLES = `
.sp-teachback-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin: 16px;
  overflow: hidden;
}

.sp-teachback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
  color: white;
  font-weight: 600;
}

.teachback-icon {
  font-size: 24px;
}

.sp-teachback-content {
  padding: 16px;
}

.teachback-concept {
  margin-bottom: 16px;
}

.teachback-concept .label {
  display: block;
  font-size: 12px;
  color: #6b7280;
}

.concept-name {
  font-weight: 600;
  color: #6d28d9;
}

.teachback-prompt {
  background: #f5f3ff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  line-height: 1.5;
  color: #4c1d95;
}

.teachback-input textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
}

.teachback-input textarea:focus {
  border-color: #8b5cf6;
  outline: none;
}

.char-count {
  text-align: right;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.teachback-hints {
  margin-top: 12px;
}

.hint-btn {
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  padding: 8px 16px;
  border-radius: 6px;
  color: #6d28d9;
  cursor: pointer;
}

.hint-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint-text {
  margin-top: 8px;
  padding: 8px;
  background: #fef3c7;
  border-radius: 6px;
}

.hint-item {
  padding: 4px 0;
  color: #92400e;
}

.sp-teachback-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.sp-teachback-feedback {
  padding: 16px;
}

.feedback-result {
  border-radius: 8px;
  padding: 16px;
}

.feedback-result.good {
  background: #f0fdf4;
}

.feedback-result.needs-work {
  background: #fffbeb;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.result-emoji {
  font-size: 32px;
}

.result-score {
  font-size: 20px;
  font-weight: 600;
}

.result-bars {
  margin-bottom: 16px;
}

.bar-item {
  margin-bottom: 8px;
}

.bar-label {
  font-size: 12px;
  color: #6b7280;
}

.bar-track {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  margin-top: 4px;
}

.bar-fill {
  height: 100%;
  background: #8b5cf6;
  border-radius: 4px;
  transition: width 0.5s;
}

.result-section {
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 6px;
}

.result-section.correct { background: #dcfce7; }
.result-section.missing { background: #fef3c7; }
.result-section.misconception { background: #fef2f2; }
.result-section.review { background: #f0f9ff; }

.result-section ul {
  margin: 8px 0 0 20px;
  padding: 0;
}

.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
`;

function injectTeachBackStyles() {
  if (document.getElementById('teachback-styles')) return;
  const style = document.createElement('style');
  style.id = 'teachback-styles';
  style.textContent = TEACHBACK_STYLES;
  document.head.appendChild(style);
}

export { createTeachBackUI, injectTeachBackStyles };
```

### Success Criteria
- [ ] Generates specific teach-back prompts from content
- [ ] Provides hints when user is stuck
- [ ] AI evaluates explanation against key points
- [ ] Identifies correct points, missing points, misconceptions
- [ ] Provides actionable feedback

---

## Task 2.3: Flashcard Deck

### Objective
Convert insights and quiz Q&A into flashcards for spaced repetition review.

### Implementation Steps

#### Step 1: Create Flashcard Service

**File:** `services/flashcard_deck.js` (NEW)

```javascript
/**
 * Flashcard Deck Service
 * Manages flashcard creation, storage, and retrieval.
 */

const FLASHCARD_STORAGE_KEY = 'atom_flashcard_deck_v1';

/**
 * Flashcard types.
 */
const CARD_TYPES = {
  INSIGHT: 'insight',    // From insights
  CLOZE: 'cloze',        // Fill-in-the-blank
  QUIZ: 'quiz',          // From quiz questions
  TEACHBACK: 'teachback' // From teach-back
};

/**
 * Creates a new flashcard.
 * @param {Object} data - Card data
 * @returns {Object} Flashcard object
 */
function createFlashcard(data) {
  return {
    id: `fc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    type: data.type || CARD_TYPES.INSIGHT,
    front: data.front,
    back: data.back,

    // Source tracking
    sourceSessionId: data.sourceSessionId,
    sourceHighlightId: data.sourceHighlightId || null,
    sourceInsightId: data.sourceInsightId || null,
    sourceUrl: data.sourceUrl || null,

    // Spaced repetition fields (SM-2 algorithm)
    interval: 1,           // Days until next review
    easeFactor: 2.5,       // Difficulty multiplier
    dueDate: Date.now() + 24 * 60 * 60 * 1000,  // Tomorrow
    reviewCount: 0,
    lastReviewDate: null,
    lastQuality: null,

    // Stats
    correctCount: 0,
    incorrectCount: 0,

    // Metadata
    createdAt: Date.now(),
    tags: data.tags || []
  };
}

/**
 * Creates a flashcard from an insight.
 */
async function createFromInsight(insight, sessionData) {
  // Generate question from insight
  const prompt = `Convert this insight into a flashcard:

Insight: "${insight.text}"
Context: From article "${sessionData.title}"

Create a flashcard with:
1. Front: A question that tests recall of this insight
2. Back: The answer (the insight itself, possibly rephrased)

Return JSON:
{
  "front": "question here",
  "back": "answer here"
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const cardData = JSON.parse(jsonMatch[0]);

    return createFlashcard({
      type: CARD_TYPES.INSIGHT,
      front: cardData.front,
      back: cardData.back,
      sourceSessionId: sessionData.id,
      sourceInsightId: insight.id,
      sourceUrl: sessionData.url
    });
  } catch (err) {
    // Fallback: use insight directly
    return createFlashcard({
      type: CARD_TYPES.INSIGHT,
      front: `What is the key insight about "${insight.text.slice(0, 50)}..."?`,
      back: insight.text,
      sourceSessionId: sessionData.id,
      sourceInsightId: insight.id
    });
  }
}

/**
 * Creates a cloze (fill-in-blank) flashcard.
 */
async function createClozeCard(text, sessionData) {
  const prompt = `Create a cloze (fill-in-the-blank) flashcard from this text:

Text: "${text}"

Identify the most important term or phrase and create a blank.

Return JSON:
{
  "front": "sentence with {{blank}} where the key term should be",
  "back": "the word/phrase that fills the blank",
  "fullSentence": "the complete sentence"
}`;

  try {
    const response = await callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const cardData = JSON.parse(jsonMatch[0]);

    return createFlashcard({
      type: CARD_TYPES.CLOZE,
      front: cardData.front.replace('{{blank}}', '_____'),
      back: cardData.back,
      sourceSessionId: sessionData.id,
      sourceUrl: sessionData.url
    });
  } catch (err) {
    console.error('[Flashcard] Cloze generation failed:', err);
    return null;
  }
}

/**
 * Creates a flashcard from a quiz question.
 */
function createFromQuiz(question, sessionData) {
  let front, back;

  if (question.type === 'multiple_choice') {
    front = question.question;
    back = `${question.options[question.correctIndex]}\n\n${question.explanation || ''}`;
  } else {
    front = question.question;
    back = question.sampleAnswer || 'See original text for answer.';
  }

  return createFlashcard({
    type: CARD_TYPES.QUIZ,
    front: front,
    back: back,
    sourceSessionId: sessionData.id
  });
}

/**
 * Gets all flashcards from storage.
 */
async function getAllCards() {
  return new Promise(resolve => {
    chrome.storage.local.get([FLASHCARD_STORAGE_KEY], result => {
      resolve(result[FLASHCARD_STORAGE_KEY] || []);
    });
  });
}

/**
 * Saves a flashcard to the deck.
 */
async function saveCard(card) {
  const cards = await getAllCards();
  const existingIndex = cards.findIndex(c => c.id === card.id);

  if (existingIndex >= 0) {
    cards[existingIndex] = card;
  } else {
    cards.push(card);
  }

  return new Promise(resolve => {
    chrome.storage.local.set({ [FLASHCARD_STORAGE_KEY]: cards }, resolve);
  });
}

/**
 * Deletes a flashcard.
 */
async function deleteCard(cardId) {
  const cards = await getAllCards();
  const filtered = cards.filter(c => c.id !== cardId);

  return new Promise(resolve => {
    chrome.storage.local.set({ [FLASHCARD_STORAGE_KEY]: filtered }, resolve);
  });
}

/**
 * Gets cards due for review.
 */
async function getDueCards() {
  const cards = await getAllCards();
  const now = Date.now();

  return cards.filter(c => c.dueDate <= now);
}

/**
 * Gets review queue organized by date.
 */
async function getReviewQueue() {
  const cards = await getAllCards();
  const now = Date.now();
  const tomorrow = now + 24 * 60 * 60 * 1000;
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000;

  return {
    overdue: cards.filter(c => c.dueDate < now - 24 * 60 * 60 * 1000),
    dueToday: cards.filter(c => c.dueDate <= now && c.dueDate >= now - 24 * 60 * 60 * 1000),
    tomorrow: cards.filter(c => c.dueDate > now && c.dueDate <= tomorrow),
    thisWeek: cards.filter(c => c.dueDate > tomorrow && c.dueDate <= nextWeek),
    later: cards.filter(c => c.dueDate > nextWeek),

    stats: {
      total: cards.length,
      mastered: cards.filter(c => c.interval >= 21).length,  // 3+ weeks
      learning: cards.filter(c => c.interval < 21 && c.reviewCount > 0).length,
      new: cards.filter(c => c.reviewCount === 0).length
    }
  };
}

export {
  CARD_TYPES,
  createFlashcard,
  createFromInsight,
  createClozeCard,
  createFromQuiz,
  getAllCards,
  saveCard,
  deleteCard,
  getDueCards,
  getReviewQueue
};
```

#### Step 2: Create Flashcard UI Components

**File:** `ui/components/flashcard.js` (NEW)

```javascript
/**
 * Flashcard UI Component
 */

/**
 * Creates a single flashcard for review.
 */
function createFlashcardUI(card, onRate) {
  const container = document.createElement('div');
  container.className = 'sp-flashcard';
  container.dataset.cardId = card.id;

  container.innerHTML = `
    <div class="flashcard-inner">
      <div class="flashcard-front">
        <div class="card-type">${card.type}</div>
        <div class="card-content">${card.front}</div>
        <button class="flip-btn">Show Answer</button>
      </div>

      <div class="flashcard-back" style="display: none;">
        <div class="card-content">${card.back}</div>

        <div class="card-source">
          Source: ${card.sourceUrl ? new URL(card.sourceUrl).hostname : 'Unknown'}
        </div>

        <div class="rating-section">
          <p>How well did you remember?</p>
          <div class="rating-buttons">
            <button class="rate-btn rate-again" data-quality="0">
              Again<br><small>< 1 min</small>
            </button>
            <button class="rate-btn rate-hard" data-quality="3">
              Hard<br><small>${formatInterval(card.interval * 0.5)}</small>
            </button>
            <button class="rate-btn rate-good" data-quality="4">
              Good<br><small>${formatInterval(card.interval)}</small>
            </button>
            <button class="rate-btn rate-easy" data-quality="5">
              Easy<br><small>${formatInterval(card.interval * 1.5)}</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Flip card
  const flipBtn = container.querySelector('.flip-btn');
  const front = container.querySelector('.flashcard-front');
  const back = container.querySelector('.flashcard-back');

  flipBtn.addEventListener('click', () => {
    front.style.display = 'none';
    back.style.display = 'block';
    container.classList.add('flipped');
  });

  // Rating buttons
  container.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const quality = parseInt(btn.dataset.quality);
      onRate(card.id, quality);
    });
  });

  return container;
}

function formatInterval(days) {
  if (days < 1) return '< 1 day';
  if (days < 7) return `${Math.round(days)} days`;
  if (days < 30) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

/**
 * Creates review session UI.
 */
function createReviewSessionUI(cards, onComplete) {
  let currentIndex = 0;
  const results = [];

  const container = document.createElement('div');
  container.className = 'sp-review-session';

  // Progress
  const progress = document.createElement('div');
  progress.className = 'review-progress';
  progress.innerHTML = `
    <div class="progress-text">Card <span id="current-card">1</span> of ${cards.length}</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
  `;
  container.appendChild(progress);

  // Card container
  const cardContainer = document.createElement('div');
  cardContainer.className = 'review-card-container';
  container.appendChild(cardContainer);

  function showCard(index) {
    cardContainer.innerHTML = '';

    if (index >= cards.length) {
      showReviewSummary(container, results, onComplete);
      return;
    }

    const cardUI = createFlashcardUI(cards[index], (cardId, quality) => {
      results.push({ cardId, quality });
      currentIndex++;

      // Update progress
      container.querySelector('#current-card').textContent = currentIndex + 1;
      container.querySelector('.progress-fill').style.width =
        `${(currentIndex / cards.length) * 100}%`;

      setTimeout(() => showCard(currentIndex), 300);
    });

    cardContainer.appendChild(cardUI);
  }

  showCard(0);
  return container;
}

function showReviewSummary(container, results, onComplete) {
  const goodCount = results.filter(r => r.quality >= 3).length;
  const total = results.length;

  container.innerHTML = `
    <div class="review-summary">
      <div class="summary-icon">🎉</div>
      <h2>Review Complete!</h2>

      <div class="summary-stats">
        <div class="stat">
          <span class="stat-value">${total}</span>
          <span class="stat-label">Cards Reviewed</span>
        </div>
        <div class="stat">
          <span class="stat-value">${goodCount}</span>
          <span class="stat-label">Remembered</span>
        </div>
        <div class="stat">
          <span class="stat-value">${Math.round(goodCount / total * 100)}%</span>
          <span class="stat-label">Success Rate</span>
        </div>
      </div>

      <button class="btn-primary" id="finish-review">Done</button>
    </div>
  `;

  container.querySelector('#finish-review').addEventListener('click', () => {
    onComplete(results);
  });
}

// Styles
const FLASHCARD_STYLES = `
.sp-flashcard {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 24px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.flashcard-front, .flashcard-back {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-type {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.card-content {
  flex: 1;
  font-size: 18px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 20px;
}

.flip-btn {
  width: 100%;
  padding: 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.card-source {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  margin-bottom: 16px;
}

.rating-section {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.rating-section p {
  text-align: center;
  color: #6b7280;
  margin-bottom: 12px;
}

.rating-buttons {
  display: flex;
  gap: 8px;
}

.rate-btn {
  flex: 1;
  padding: 12px 8px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.rate-btn small {
  display: block;
  font-size: 11px;
  opacity: 0.8;
}

.rate-again { background: #fecaca; color: #dc2626; }
.rate-hard { background: #fed7aa; color: #c2410c; }
.rate-good { background: #bbf7d0; color: #16a34a; }
.rate-easy { background: #a5f3fc; color: #0891b2; }

.review-progress {
  margin-bottom: 16px;
}

.progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s;
}

.review-summary {
  text-align: center;
  padding: 40px 20px;
}

.summary-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.summary-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin: 32px 0;
}

.stat-value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  color: #3b82f6;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}
`;

function injectFlashcardStyles() {
  if (document.getElementById('flashcard-styles')) return;
  const style = document.createElement('style');
  style.id = 'flashcard-styles';
  style.textContent = FLASHCARD_STYLES;
  document.head.appendChild(style);
}

export { createFlashcardUI, createReviewSessionUI, injectFlashcardStyles };
```

### Success Criteria
- [ ] Create cards from insights, quizzes, teach-backs
- [ ] Support cloze (fill-in-blank) cards
- [ ] Track source for each card
- [ ] Review UI with flip animation
- [ ] Rating system (Again/Hard/Good/Easy)

---

## Task 2.4: Spaced Repetition Scheduler (SM-2)

### Objective
Schedule reviews based on the forgetting curve using SM-2 algorithm.

### Implementation

**File:** `services/spaced_repetition.js` (NEW)

```javascript
/**
 * Spaced Repetition Service
 * Implements SM-2 algorithm for review scheduling.
 */

import * as FlashcardDeck from './flashcard_deck.js';

/**
 * SM-2 Algorithm Implementation
 *
 * Quality ratings:
 * 0 - Complete blackout
 * 1 - Wrong, but recognized correct answer
 * 2 - Wrong, but correct answer seemed easy to recall
 * 3 - Correct with serious difficulty
 * 4 - Correct with some hesitation
 * 5 - Perfect recall
 */

/**
 * Calculates next review date based on SM-2 algorithm.
 * @param {Object} card - Current card state
 * @param {number} quality - Quality rating (0-5)
 * @returns {Object} Updated card fields
 */
function calculateNextReview(card, quality) {
  let { interval, easeFactor, reviewCount } = card;

  // Failed (quality < 3) - reset to beginning
  if (quality < 3) {
    return {
      interval: 1,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
      dueDate: Date.now() + 1 * 60 * 1000,  // Review again in 1 minute
      reviewCount: reviewCount + 1,
      lastReviewDate: Date.now(),
      lastQuality: quality,
      correctCount: card.correctCount,
      incorrectCount: card.incorrectCount + 1
    };
  }

  // Passed - calculate new interval
  let newInterval;

  if (reviewCount === 0) {
    newInterval = 1;  // First successful review: 1 day
  } else if (reviewCount === 1) {
    newInterval = 3;  // Second successful review: 3 days
  } else {
    // Subsequent reviews: interval * easeFactor
    newInterval = Math.round(interval * easeFactor);
  }

  // Adjust for quality
  if (quality === 3) {
    newInterval = Math.round(newInterval * 0.8);  // Hard: shorter interval
  } else if (quality === 5) {
    newInterval = Math.round(newInterval * 1.3);  // Easy: longer interval
  }

  // Cap at 365 days
  newInterval = Math.min(newInterval, 365);

  // Update ease factor
  const newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  return {
    interval: newInterval,
    easeFactor: Math.max(1.3, newEaseFactor),
    dueDate: Date.now() + newInterval * 24 * 60 * 60 * 1000,
    reviewCount: reviewCount + 1,
    lastReviewDate: Date.now(),
    lastQuality: quality,
    correctCount: card.correctCount + 1,
    incorrectCount: card.incorrectCount
  };
}

/**
 * Processes a review response and updates the card.
 * @param {string} cardId - Card ID
 * @param {number} quality - Quality rating (0-5)
 */
async function processReview(cardId, quality) {
  const cards = await FlashcardDeck.getAllCards();
  const card = cards.find(c => c.id === cardId);

  if (!card) {
    console.error('[SR] Card not found:', cardId);
    return;
  }

  const updates = calculateNextReview(card, quality);
  const updatedCard = { ...card, ...updates };

  await FlashcardDeck.saveCard(updatedCard);

  console.log(`[SR] Card ${cardId}: quality=${quality}, next review in ${updates.interval} days`);

  return updatedCard;
}

/**
 * Gets optimal daily review count.
 * @returns {Promise<Object>}
 */
async function getDailyStats() {
  const queue = await FlashcardDeck.getReviewQueue();

  return {
    dueNow: queue.dueToday.length + queue.overdue.length,
    newAvailable: queue.stats.new,
    recommended: Math.min(20, queue.dueToday.length + Math.min(5, queue.stats.new)),
    streak: await getReviewStreak()
  };
}

/**
 * Gets current review streak.
 */
async function getReviewStreak() {
  return new Promise(resolve => {
    chrome.storage.local.get(['atom_review_history'], result => {
      const history = result.atom_review_history || [];

      if (history.length === 0) {
        resolve(0);
        return;
      }

      // Count consecutive days with reviews
      let streak = 0;
      const today = new Date().toDateString();
      const dates = history.map(h => new Date(h.date).toDateString());

      // Check if reviewed today
      if (dates[dates.length - 1] !== today) {
        // Check if yesterday
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
        if (dates[dates.length - 1] !== yesterday) {
          resolve(0);  // Streak broken
          return;
        }
      }

      // Count streak
      let checkDate = new Date();
      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toDateString();
        if (dates.includes(dateStr)) {
          streak++;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }

      resolve(streak);
    });
  });
}

/**
 * Records that a review session happened today.
 */
async function recordReviewSession(cardsReviewed) {
  return new Promise(resolve => {
    chrome.storage.local.get(['atom_review_history'], result => {
      const history = result.atom_review_history || [];

      history.push({
        date: Date.now(),
        cardsReviewed: cardsReviewed
      });

      // Keep last 365 entries
      const trimmed = history.slice(-365);

      chrome.storage.local.set({ atom_review_history: trimmed }, resolve);
    });
  });
}

/**
 * Gets review forecast for next 7 days.
 */
async function getReviewForecast() {
  const cards = await FlashcardDeck.getAllCards();
  const forecast = [];

  for (let i = 0; i < 7; i++) {
    const dayStart = Date.now() + i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const dueOnDay = cards.filter(c =>
      c.dueDate >= dayStart && c.dueDate < dayEnd
    ).length;

    forecast.push({
      date: new Date(dayStart),
      count: dueOnDay
    });
  }

  return forecast;
}

export {
  calculateNextReview,
  processReview,
  getDailyStats,
  getReviewStreak,
  recordReviewSession,
  getReviewForecast
};
```

### Success Criteria
- [ ] SM-2 algorithm correctly calculates intervals
- [ ] Failed cards reset to short interval
- [ ] Easy factor adjusts difficulty
- [ ] Review streak tracking works
- [ ] Forecast shows upcoming reviews

---

## Task 2.5: Comprehension Scoring

### Objective
Calculate overall comprehension score from multiple metrics.

### Implementation

**File:** `services/comprehension_scoring.js` (NEW)

```javascript
/**
 * Comprehension Scoring Service
 * Calculates weighted comprehension scores.
 */

const SCORING_WEIGHTS = {
  readingEngagement: 0.2,
  interactionQuality: 0.3,
  assessmentResults: 0.5
};

const COMPREHENSION_LEVELS = {
  SURFACE: { min: 0, max: 40, label: 'Surface', description: 'Basic familiarity' },
  DEVELOPING: { min: 40, max: 60, label: 'Developing', description: 'Growing understanding' },
  PROFICIENT: { min: 60, max: 80, label: 'Proficient', description: 'Solid comprehension' },
  DEEP: { min: 80, max: 100, label: 'Deep', description: 'Thorough mastery' }
};

/**
 * Calculates reading engagement score.
 */
function calculateReadingScore(metrics) {
  const { timeSpent, scrollDepth, highlightCount, highlightDensity } = metrics;

  // Time score: up to 100 for 10+ minutes of reading
  const timeScore = Math.min(100, (timeSpent / 600000) * 100);

  // Scroll score: direct percentage
  const scrollScore = scrollDepth;

  // Highlight score: up to 100 for 5+ highlights
  const highlightScore = Math.min(100, highlightCount * 20);

  // Density score: highlights per 1000 words, ideal is 2-3
  const densityScore = Math.min(100, highlightDensity * 40);

  return (
    timeScore * 0.25 +
    scrollScore * 0.25 +
    highlightScore * 0.25 +
    densityScore * 0.25
  );
}

/**
 * Calculates interaction quality score.
 */
function calculateInteractionScore(metrics) {
  const { questionsAsked, bloomLevelReached, insightsCreated } = metrics;

  // Questions score: up to 100 for 5+ questions
  const questionsScore = Math.min(100, questionsAsked * 20);

  // Bloom level score: 1-6 mapped to 0-100
  const bloomScore = ((bloomLevelReached - 1) / 5) * 100;

  // Insights score: up to 100 for 4+ insights
  const insightsScore = Math.min(100, insightsCreated * 25);

  return (
    questionsScore * 0.3 +
    bloomScore * 0.4 +
    insightsScore * 0.3
  );
}

/**
 * Calculates assessment results score.
 */
function calculateAssessmentScore(metrics) {
  const { quizScore, teachBackScore, recallAccuracy } = metrics;

  // Use available scores, default to null (not calculated)
  const scores = [quizScore, teachBackScore, recallAccuracy].filter(s => s !== null);

  if (scores.length === 0) {
    return null;  // No assessments taken
  }

  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * Calculates overall comprehension score.
 * @param {Object} sessionMetrics - Session metrics object
 * @returns {Object} Comprehension result
 */
function calculateComprehensionScore(sessionMetrics) {
  const readingScore = calculateReadingScore(sessionMetrics.readingMetrics);
  const interactionScore = calculateInteractionScore(sessionMetrics.interactionMetrics);
  const assessmentScore = calculateAssessmentScore(sessionMetrics.assessmentMetrics);

  // If no assessment, redistribute weights
  let overallScore;
  if (assessmentScore === null) {
    overallScore = (
      readingScore * 0.4 +
      interactionScore * 0.6
    );
  } else {
    overallScore = (
      readingScore * SCORING_WEIGHTS.readingEngagement +
      interactionScore * SCORING_WEIGHTS.interactionQuality +
      assessmentScore * SCORING_WEIGHTS.assessmentResults
    );
  }

  // Determine level
  let level = 'surface';
  for (const [key, config] of Object.entries(COMPREHENSION_LEVELS)) {
    if (overallScore >= config.min && overallScore < config.max) {
      level = key.toLowerCase();
      break;
    }
  }
  if (overallScore >= 80) level = 'deep';

  return {
    overall: Math.round(overallScore),
    breakdown: {
      reading: Math.round(readingScore),
      interaction: Math.round(interactionScore),
      assessment: assessmentScore !== null ? Math.round(assessmentScore) : null
    },
    level: level,
    levelInfo: COMPREHENSION_LEVELS[level.toUpperCase()]
  };
}

/**
 * Generates improvement suggestions based on score.
 */
function getSuggestions(comprehensionResult) {
  const suggestions = [];
  const { breakdown } = comprehensionResult;

  if (breakdown.reading < 50) {
    suggestions.push({
      area: 'Reading Engagement',
      suggestion: 'Try highlighting key passages as you read',
      priority: 'high'
    });
  }

  if (breakdown.interaction < 50) {
    suggestions.push({
      area: 'Active Learning',
      suggestion: 'Use the quick actions to explore concepts deeper',
      priority: 'high'
    });
  }

  if (breakdown.assessment === null) {
    suggestions.push({
      area: 'Self-Assessment',
      suggestion: 'Take the quiz to test your understanding',
      priority: 'medium'
    });
  } else if (breakdown.assessment < 70) {
    suggestions.push({
      area: 'Retention',
      suggestion: 'Review missed concepts and add them to flashcards',
      priority: 'high'
    });
  }

  return suggestions;
}

export {
  SCORING_WEIGHTS,
  COMPREHENSION_LEVELS,
  calculateComprehensionScore,
  getSuggestions
};
```

### Success Criteria
- [ ] Weighted scoring from multiple sources
- [ ] Clear level thresholds
- [ ] Handles missing assessment data
- [ ] Actionable improvement suggestions

---

## File Changes Summary

### New Files to Create
1. `services/quiz_generator.js` - Tiered quiz generation
2. `services/teachback_service.js` - Teach-back evaluation
3. `services/flashcard_deck.js` - Flashcard management
4. `services/spaced_repetition.js` - SM-2 scheduling
5. `services/comprehension_scoring.js` - Score calculation
6. `ui/components/quiz.js` - Quiz UI
7. `ui/components/teachback.js` - Teach-back UI
8. `ui/components/flashcard.js` - Flashcard/review UI

### Files to Modify
1. `sidepanel.js` - Add quiz, flashcard review integrations
2. `popup.js` - Add review stats, streak display
3. `storage/reading_session.js` - Link flashcards to sessions

---

## Deployment Checklist

- [ ] Phase 1 complete and stable
- [ ] Quiz generation working for all tiers
- [ ] Teach-back evaluation accurate
- [ ] Flashcard deck persists correctly
- [ ] SM-2 intervals calculated properly
- [ ] Review session UI smooth
- [ ] Comprehension scoring displays
- [ ] Update version to 3.0/3.1

---

**End of Phase 2 Specification**
