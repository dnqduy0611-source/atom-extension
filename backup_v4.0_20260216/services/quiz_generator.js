// services/quiz_generator.js
// Tiered quiz generation based on Bloom's Taxonomy

(function () {
    'use strict';

    const QUIZ_TIERS = {
        1: {
            id: 1,
            name: 'recall',
            label: 'Easy',
            bloomLevel: 'Remember',
            description: 'Direct recall from text',
            questionType: 'multiple_choice',
            promptTemplate: [
                'Generate a RECALL question about this text.',
                'The answer should be directly stated in the text.',
                '',
                'Text: "{text}"',
                '',
                'Create a multiple-choice question with 4 options.',
                'Return JSON:',
                '{',
                '  "question": "What does the author say about...?",',
                '  "options": ["option A", "option B", "option C", "option D"],',
                '  "correctIndex": 0,',
                '  "explanation": "The text states ... which directly answers this.",',
                '  "evidence": "exact quote from text"',
                '}'
            ].join('\n')
        },
        2: {
            id: 2,
            name: 'understand',
            label: 'Medium',
            bloomLevel: 'Understand',
            description: 'Requires paraphrasing or interpretation',
            questionType: 'short_answer',
            promptTemplate: [
                'Generate an UNDERSTANDING question about this text.',
                'The answer requires paraphrasing or explaining the meaning.',
                '',
                'Text: "{text}"',
                '',
                'Create a short-answer question.',
                'Return JSON:',
                '{',
                '  "question": "Why does... / What does the author mean by...?",',
                '  "sampleAnswer": "A good answer would explain...",',
                '  "rubric": {',
                '    "excellent": "Fully explains the concept with own words",',
                '    "good": "Captures main idea but misses nuance",',
                '    "partial": "Shows some understanding",',
                '    "poor": "Misses the point"',
                '  },',
                '  "keyPoints": ["point 1", "point 2"],',
                '  "evidence": "relevant quote"',
                '}'
            ].join('\n')
        },
        3: {
            id: 3,
            name: 'apply',
            label: 'Hard',
            bloomLevel: 'Apply',
            description: 'Transfer knowledge to new situation',
            questionType: 'scenario',
            promptTemplate: [
                'Generate an APPLICATION question about this text.',
                'The answer requires applying the concept to a new situation.',
                '',
                'Text: "{text}"',
                '',
                'Create a scenario-based question.',
                'Return JSON:',
                '{',
                '  "question": "How would you apply this concept to...?",',
                '  "scenario": "Imagine you are... and need to...",',
                '  "sampleAnswer": "You would...",',
                '  "rubric": {',
                '    "excellent": "Correctly applies concept with justification",',
                '    "good": "Applies concept but weak justification",',
                '    "partial": "Attempts application but has errors",',
                '    "poor": "Cannot apply concept"',
                '  },',
                '  "keyPoints": ["must mention X", "should consider Y"]',
                '}'
            ].join('\n')
        },
        4: {
            id: 4,
            name: 'analyze',
            label: 'Expert',
            bloomLevel: 'Analyze/Evaluate',
            description: 'Compare, contrast, or evaluate',
            questionType: 'open_ended',
            promptTemplate: [
                'Generate an ANALYSIS question about this text.',
                'The answer requires comparing, contrasting, or evaluating.',
                '',
                'Text: "{text}"',
                '',
                'Create an open-ended analytical question.',
                'Return JSON:',
                '{',
                '  "question": "Compare X with Y... / What are the trade-offs of...?",',
                '  "context": "Additional context for the question",',
                '  "sampleAnswer": "A thorough analysis would...",',
                '  "rubric": {',
                '    "excellent": "Comprehensive analysis with multiple perspectives",',
                '    "good": "Good analysis but misses some angles",',
                '    "partial": "Surface-level comparison",',
                '    "poor": "No real analysis"',
                '  },',
                '  "evaluationCriteria": ["considers pros and cons", "provides evidence", "draws conclusions"]',
                '}'
            ].join('\n')
        }
    };

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function clampText(text, limit) {
        if (!isNonEmptyString(text)) return '';
        const trimmed = text.trim();
        return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
    }

    function safeJsonParse(responseText) {
        if (!isNonEmptyString(responseText)) return null;
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }

    function normalizeArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeQuestionData(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const question = isNonEmptyString(raw.question) ? raw.question.trim() : '';
        if (!question) return null;

        return {
            question,
            options: normalizeArray(raw.options),
            correctIndex: Number.isFinite(raw.correctIndex) ? raw.correctIndex : 0,
            explanation: isNonEmptyString(raw.explanation) ? raw.explanation.trim() : '',
            evidence: isNonEmptyString(raw.evidence) ? raw.evidence.trim() : '',
            sampleAnswer: isNonEmptyString(raw.sampleAnswer) ? raw.sampleAnswer.trim() : '',
            rubric: raw.rubric && typeof raw.rubric === 'object' ? raw.rubric : {},
            keyPoints: normalizeArray(raw.keyPoints),
            scenario: isNonEmptyString(raw.scenario) ? raw.scenario.trim() : '',
            context: isNonEmptyString(raw.context) ? raw.context.trim() : '',
            evaluationCriteria: normalizeArray(raw.evaluationCriteria)
        };
    }

    function buildConversation(prompt) {
        return [{
            role: 'user',
            parts: [{ text: prompt }]
        }];
    }

    function generateQuestionId() {
        return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    async function generateQuestion(highlightText, tier, context, apiKey, callGeminiAPI) {
        const tierConfig = QUIZ_TIERS[tier] || QUIZ_TIERS[1];
        const safeText = clampText(highlightText, 2000);
        const meta = context && typeof context === 'object' ? context : {};

        if (!isNonEmptyString(safeText)) {
            throw new Error('missing_text');
        }

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            throw new Error('missing_api');
        }

        const prompt = tierConfig.promptTemplate
            .replace('{text}', safeText)
            .replace('{title}', isNonEmptyString(meta.title) ? meta.title : '')
            .replace('{section}', isNonEmptyString(meta.section) ? meta.section : '');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = buildConversation(prompt);
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);
            const normalized = normalizeQuestionData(parsed);

            if (!normalized) {
                throw new Error('invalid_payload');
            }

            return {
                id: generateQuestionId(),
                tier: tierConfig.id,
                tierName: tierConfig.name,
                bloomLevel: tierConfig.bloomLevel,
                type: tierConfig.questionType,
                sourceText: safeText,
                generatedAt: Date.now(),
                ...normalized
            };
        } catch (err) {
            console.error('[Quiz] Generation failed:', err);
            throw err;
        }
    }

    async function generateQuizSet(highlightText, context, apiKey, callGeminiAPI) {
        const questions = [];
        for (let tier = 1; tier <= 4; tier += 1) {
            try {
                const question = await generateQuestion(highlightText, tier, context, apiKey, callGeminiAPI);
                questions.push(question);
            } catch (err) {
                console.error(`[Quiz] Failed to generate tier ${tier}:`, err);
            }
        }
        return questions;
    }

    async function evaluateAnswer(question, userAnswer, apiKey, callGeminiAPI) {
        if (!question || typeof question !== 'object') {
            return { score: 0, correct: false, feedback: 'Invalid question.' };
        }

        if (question.type === 'multiple_choice') {
            const correctIndex = Number.isFinite(question.correctIndex) ? question.correctIndex : 0;
            const isCorrect = userAnswer === correctIndex || userAnswer === question.options?.[correctIndex];

            return {
                correct: isCorrect,
                score: isCorrect ? 100 : 0,
                feedback: isCorrect
                    ? `Correct! ${question.explanation || ''}`.trim()
                    : `Incorrect. The answer was: ${question.options?.[correctIndex] || ''}. ${question.explanation || ''}`.trim(),
                evidence: question.evidence || ''
            };
        }

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return {
                score: 50,
                level: 'partial',
                feedback: 'Could not evaluate automatically.',
                correctPoints: [],
                missingPoints: []
            };
        }

        const evalPrompt = [
            'Evaluate this answer:',
            '',
            `Question: ${question.question}`,
            question.scenario ? `Scenario: ${question.scenario}` : '',
            '',
            `User\'s Answer: "${isNonEmptyString(userAnswer) ? userAnswer : ''}"`,
            '',
            `Sample Answer: ${question.sampleAnswer || ''}`,
            `Key Points: ${JSON.stringify(question.keyPoints || [])}`,
            '',
            'Rubric:',
            JSON.stringify(question.rubric || {}, null, 2),
            '',
            'Evaluate and return JSON:',
            '{',
            '  "score": 0-100,',
            '  "level": "excellent|good|partial|poor",',
            '  "feedback": "Specific feedback on their answer",',
            '  "correctPoints": ["what they got right"],',
            '  "missingPoints": ["what they missed"],',
            '  "suggestions": "How to improve"',
            '}'
        ].filter(Boolean).join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = buildConversation(evalPrompt);
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);

            if (!parsed) {
                throw new Error('invalid_eval_payload');
            }

            return parsed;
        } catch (err) {
            console.error('[Quiz] Evaluation failed:', err);
            return {
                score: 50,
                level: 'partial',
                feedback: 'Could not evaluate automatically.',
                correctPoints: [],
                missingPoints: []
            };
        }
    }

    function determineNextTier(recentResults, currentTier) {
        if (!Array.isArray(recentResults) || recentResults.length < 3) {
            return currentTier;
        }

        const recent = recentResults.slice(-5);
        const avgScore = recent.reduce((sum, r) => sum + (r.score || 0), 0) / recent.length;
        const correctCount = recent.filter(r => (r.score || 0) >= 70).length;

        if (correctCount >= 4 && avgScore >= 80) {
            return Math.min(currentTier + 1, 4);
        }

        if (correctCount <= 1 && avgScore < 50) {
            return Math.max(currentTier - 1, 1);
        }

        return currentTier;
    }

    window.QuizGeneratorService = {
        QUIZ_TIERS,
        generateQuestion,
        generateQuizSet,
        evaluateAnswer,
        determineNextTier
    };
})();
