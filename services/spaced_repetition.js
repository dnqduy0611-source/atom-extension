// services/spaced_repetition.js
// SM-2 spaced repetition scheduling

(function () {
    'use strict';

    function calculateNextReview(card, quality) {
        const safeCard = card && typeof card === 'object' ? card : {};
        const interval = Number.isFinite(safeCard.interval) ? safeCard.interval : 1;
        const easeFactor = Number.isFinite(safeCard.easeFactor) ? safeCard.easeFactor : 2.5;
        const reviewCount = Number.isFinite(safeCard.reviewCount) ? safeCard.reviewCount : 0;
        const now = Date.now();

        if (quality < 3) {
            return {
                interval: 1,
                easeFactor: Math.max(1.3, easeFactor - 0.2),
                dueDate: now + 1 * 60 * 1000,
                reviewCount: reviewCount + 1,
                lastReviewDate: now,
                lastQuality: quality,
                correctCount: Number.isFinite(safeCard.correctCount) ? safeCard.correctCount : 0,
                incorrectCount: (Number.isFinite(safeCard.incorrectCount) ? safeCard.incorrectCount : 0) + 1
            };
        }

        let newInterval;
        if (reviewCount === 0) {
            newInterval = 1;
        } else if (reviewCount === 1) {
            newInterval = 3;
        } else {
            newInterval = Math.round(interval * easeFactor);
        }

        if (quality === 3) {
            newInterval = Math.round(newInterval * 0.8);
        } else if (quality === 5) {
            newInterval = Math.round(newInterval * 1.3);
        }

        newInterval = Math.min(newInterval, 365);

        const newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

        return {
            interval: newInterval,
            easeFactor: Math.max(1.3, newEaseFactor),
            dueDate: now + newInterval * 24 * 60 * 60 * 1000,
            reviewCount: reviewCount + 1,
            lastReviewDate: now,
            lastQuality: quality,
            correctCount: (Number.isFinite(safeCard.correctCount) ? safeCard.correctCount : 0) + 1,
            incorrectCount: Number.isFinite(safeCard.incorrectCount) ? safeCard.incorrectCount : 0
        };
    }

    async function processReview(cardId, quality) {
        try {
            if (!window.FlashcardDeck) {
                console.error('[SR] FlashcardDeck missing');
                return null;
            }

            const cards = await window.FlashcardDeck.getAllCards();
            const card = cards.find(c => c.id === cardId);

            if (!card) {
                console.error('[SR] Card not found:', cardId);
                return null;
            }

            const updates = calculateNextReview(card, quality);
            const updatedCard = { ...card, ...updates };

            await window.FlashcardDeck.saveCard(updatedCard);
            console.log(`[SR] Card ${cardId}: quality=${quality}, next review in ${updates.interval} days`);

            return updatedCard;
        } catch (err) {
            console.error('[SR] Failed to process review:', err);
            return null;
        }
    }

    async function getDailyStats() {
        try {
            if (!window.FlashcardDeck) {
                return { dueNow: 0, newAvailable: 0, recommended: 0, streak: 0 };
            }

            const queue = await window.FlashcardDeck.getReviewQueue();
            return {
                dueNow: queue.dueToday.length + queue.overdue.length,
                newAvailable: queue.stats.new,
                recommended: Math.min(20, queue.dueToday.length + Math.min(5, queue.stats.new)),
                streak: await getReviewStreak()
            };
        } catch (err) {
            console.error('[SR] Failed to get daily stats:', err);
            return { dueNow: 0, newAvailable: 0, recommended: 0, streak: 0 };
        }
    }

    async function getReviewStreak() {
        return new Promise(resolve => {
            try {
                chrome.storage.local.get(['atom_review_history'], result => {
                    const history = result.atom_review_history || [];

                    if (history.length === 0) {
                        resolve(0);
                        return;
                    }

                    let streak = 0;
                    const today = new Date().toDateString();
                    const dates = history.map(h => new Date(h.date).toDateString());

                    if (dates[dates.length - 1] !== today) {
                        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
                        if (dates[dates.length - 1] !== yesterday) {
                            resolve(0);
                            return;
                        }
                    }

                    let checkDate = new Date();
                    for (let i = 0; i < 365; i += 1) {
                        const dateStr = checkDate.toDateString();
                        if (dates.includes(dateStr)) {
                            streak += 1;
                            checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
                        } else {
                            break;
                        }
                    }

                    resolve(streak);
                });
            } catch (err) {
                console.error('[SR] Failed to get review streak:', err);
                resolve(0);
            }
        });
    }

    async function recordReviewSession(cardsReviewed) {
        return new Promise(resolve => {
            try {
                chrome.storage.local.get(['atom_review_history'], result => {
                    const history = result.atom_review_history || [];

                    history.push({
                        date: Date.now(),
                        cardsReviewed: cardsReviewed
                    });

                    const trimmed = history.slice(-365);
                    chrome.storage.local.set({ atom_review_history: trimmed }, resolve);
                });
            } catch (err) {
                console.error('[SR] Failed to record review session:', err);
                resolve(null);
            }
        });
    }

    async function getReviewForecast() {
        try {
            if (!window.FlashcardDeck) {
                return [];
            }

            const cards = await window.FlashcardDeck.getAllCards();
            const forecast = [];

            for (let i = 0; i < 7; i += 1) {
                const dayStart = Date.now() + i * 24 * 60 * 60 * 1000;
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;

                const dueOnDay = cards.filter(c =>
                    Number.isFinite(c.dueDate) && c.dueDate >= dayStart && c.dueDate < dayEnd
                ).length;

                forecast.push({
                    date: new Date(dayStart),
                    count: dueOnDay
                });
            }

            return forecast;
        } catch (err) {
            console.error('[SR] Failed to get review forecast:', err);
            return [];
        }
    }

    window.SpacedRepetitionService = {
        calculateNextReview,
        processReview,
        getDailyStats,
        getReviewStreak,
        recordReviewSession,
        getReviewForecast
    };
})();
