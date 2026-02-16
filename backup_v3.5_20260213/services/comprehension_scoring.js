// services/comprehension_scoring.js
// Weighted comprehension scoring

(function () {
    'use strict';

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

    function toNumber(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function calculateReadingScore(metrics) {
        const data = metrics || {};
        const timeSpent = toNumber(data.timeSpent, 0);
        const scrollDepth = toNumber(data.scrollDepth, 0);
        const highlightCount = toNumber(data.highlightCount, 0);
        const highlightDensity = toNumber(data.highlightDensity, 0);

        const timeScore = Math.min(100, (timeSpent / 600000) * 100);
        const scrollScore = scrollDepth;
        const highlightScore = Math.min(100, highlightCount * 20);
        const densityScore = Math.min(100, highlightDensity * 40);

        return (
            timeScore * 0.25 +
            scrollScore * 0.25 +
            highlightScore * 0.25 +
            densityScore * 0.25
        );
    }

    function calculateInteractionScore(metrics) {
        const data = metrics || {};
        const questionsAsked = toNumber(data.questionsAsked, 0);
        const bloomLevelReached = toNumber(data.bloomLevelReached, 1);
        const insightsCreated = toNumber(data.insightsCreated, 0);

        const questionsScore = Math.min(100, questionsAsked * 20);
        const bloomScore = ((bloomLevelReached - 1) / 5) * 100;
        const insightsScore = Math.min(100, insightsCreated * 25);

        return (
            questionsScore * 0.3 +
            bloomScore * 0.4 +
            insightsScore * 0.3
        );
    }

    function calculateAssessmentScore(metrics) {
        const data = metrics || {};
        const scores = [data.quizScore, data.teachBackScore, data.recallAccuracy]
            .filter(score => score !== null && Number.isFinite(score));

        if (scores.length === 0) {
            return null;
        }

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    function calculateComprehensionScore(sessionMetrics) {
        const metrics = sessionMetrics || {};
        const readingScore = calculateReadingScore(metrics.readingMetrics || {});
        const interactionScore = calculateInteractionScore(metrics.interactionMetrics || {});
        const assessmentScore = calculateAssessmentScore(metrics.assessmentMetrics || {});

        let overallScore;
        if (assessmentScore === null) {
            overallScore = readingScore * 0.4 + interactionScore * 0.6;
        } else {
            overallScore = (
                readingScore * SCORING_WEIGHTS.readingEngagement +
                interactionScore * SCORING_WEIGHTS.interactionQuality +
                assessmentScore * SCORING_WEIGHTS.assessmentResults
            );
        }

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

    function getSuggestions(comprehensionResult) {
        const suggestions = [];
        const breakdown = comprehensionResult && comprehensionResult.breakdown ? comprehensionResult.breakdown : {};

        if ((breakdown.reading || 0) < 50) {
            suggestions.push({
                area: 'Reading Engagement',
                suggestion: 'Try highlighting key passages as you read',
                priority: 'high'
            });
        }

        if ((breakdown.interaction || 0) < 50) {
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
        } else if ((breakdown.assessment || 0) < 70) {
            suggestions.push({
                area: 'Retention',
                suggestion: 'Review missed concepts and add them to flashcards',
                priority: 'high'
            });
        }

        return suggestions;
    }

    window.ComprehensionScoringService = {
        SCORING_WEIGHTS,
        COMPREHENSION_LEVELS,
        calculateComprehensionScore,
        getSuggestions
    };
})();
