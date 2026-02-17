// services/teachback_service.js
// Teach-back prompt generation and evaluation

(function () {
    'use strict';

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

    function buildConversation(prompt) {
        return [{
            role: 'user',
            parts: [{ text: prompt }]
        }];
    }

    async function generateTeachBackPrompt(concept, sourceText, apiKey, callGeminiAPI) {
        const safeText = clampText(sourceText, 2000);
        const safeConcept = isNonEmptyString(concept) ? concept.trim() : '';

        if (!isNonEmptyString(safeText)) {
            return {
                concept: safeConcept || 'the concept',
                prompt: 'Explain what you just read as if teaching a beginner.',
                keyPointsToMention: [],
                commonMisconceptions: [],
                hints: []
            };
        }

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return {
                concept: safeConcept || 'the concept',
                prompt: 'Explain what you just read as if teaching a beginner.',
                keyPointsToMention: [],
                commonMisconceptions: [],
                hints: []
            };
        }

        const prompt = [
            'Based on this text, identify the key concept and create a teach-back challenge.',
            '',
            `Text: "${safeText}"`,
            '',
            'Create a teach-back prompt asking the user to explain this concept.',
            'The prompt should be specific but not give away the answer.',
            '',
            'Return JSON:',
            '{',
            '  "concept": "The main concept name",',
            '  "prompt": "Explain [concept] as if teaching a beginner...",',
            '  "keyPointsToMention": ["point 1", "point 2", "point 3"],',
            '  "commonMisconceptions": ["misconception 1", "misconception 2"],',
            '  "hints": ["hint if stuck 1", "hint if stuck 2"]',
            '}'
        ].join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = buildConversation(prompt);
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response) || {};

            return {
                concept: isNonEmptyString(parsed.concept) ? parsed.concept.trim() : (safeConcept || 'the concept'),
                prompt: isNonEmptyString(parsed.prompt) ? parsed.prompt.trim() : 'Explain what you just read as if teaching a beginner.',
                keyPointsToMention: normalizeArray(parsed.keyPointsToMention),
                commonMisconceptions: normalizeArray(parsed.commonMisconceptions),
                hints: normalizeArray(parsed.hints)
            };
        } catch (err) {
            console.error('[TeachBack] Prompt generation failed:', err);
            return {
                concept: safeConcept || 'the concept',
                prompt: 'Explain what you just read as if teaching a beginner.',
                keyPointsToMention: [],
                commonMisconceptions: [],
                hints: []
            };
        }
    }

    async function evaluateExplanation(teachBackData, userExplanation, apiKey, callGeminiAPI) {
        const explanation = isNonEmptyString(userExplanation) ? userExplanation.trim() : '';
        const data = teachBackData && typeof teachBackData === 'object' ? teachBackData : {};

        if (!apiKey || typeof callGeminiAPI !== 'function') {
            return {
                score: 50,
                level: 'partial',
                feedback: 'Could not evaluate automatically.',
                correctPoints: [],
                missingPoints: [],
                misconceptions: []
            };
        }

        const keyPoints = normalizeArray(data.keyPointsToMention);
        const misconceptions = normalizeArray(data.commonMisconceptions);

        const prompt = [
            'Evaluate this teach-back explanation:',
            '',
            `Concept: ${data.concept || 'the concept'}`,
            '',
            'Key points that should be mentioned:',
            keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') || 'None provided.',
            '',
            'Common misconceptions to watch for:',
            misconceptions.map(m => `- ${m}`).join('\n') || 'None provided.',
            '',
            `User\'s explanation:`,
            `"${explanation}"`,
            '',
            'Evaluate the explanation:',
            '1. Which key points were correctly explained?',
            '2. Which key points were missing?',
            '3. Were there any misconceptions?',
            '4. How clear and complete is the explanation?',
            '',
            'Return JSON:',
            '{',
            '  "score": 0-100,',
            '  "level": "excellent|good|partial|poor",',
            '  "correctPoints": ["points they got right"],',
            '  "missingPoints": ["points they missed"],',
            '  "misconceptions": ["any misconceptions detected"],',
            '  "clarityScore": 0-100,',
            '  "completenessScore": 0-100,',
            '  "feedback": "Detailed feedback paragraph",',
            '  "suggestions": ["suggestion 1", "suggestion 2"],',
            '  "reviewAreas": ["area to review 1", "area to review 2"]',
            '}'
        ].join('\n');

        try {
            const systemPrompt = 'You are a precise learning assistant. Return JSON only.';
            const conversationHistory = buildConversation(prompt);
            const response = await callGeminiAPI(apiKey, systemPrompt, conversationHistory);
            const parsed = safeJsonParse(response);

            if (!parsed) {
                throw new Error('invalid_eval_payload');
            }

            return parsed;
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

    function getHint(teachBackData, hintIndex) {
        const data = teachBackData && typeof teachBackData === 'object' ? teachBackData : {};
        if (data.hints && data.hints[hintIndex]) {
            return data.hints[hintIndex];
        }

        const genericHints = [
            'Think about the main problem this concept solves.',
            'Consider how you would use this in practice.',
            'What makes this different from alternatives?'
        ];

        const index = Number.isFinite(hintIndex) ? hintIndex : 0;
        return genericHints[index % genericHints.length];
    }

    window.TeachBackService = {
        generateTeachBackPrompt,
        evaluateExplanation,
        getHint
    };
})();
