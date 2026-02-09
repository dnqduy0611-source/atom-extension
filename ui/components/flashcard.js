// ui/components/flashcard.js
// Flashcard review UI components for Active Reading retention flow

(function () {
    'use strict';

    const DEFAULT_STRINGS = {
        showAnswer: 'Show Answer',
        rateAgain: 'Again',
        rateHard: 'Hard',
        rateGood: 'Good',
        rateEasy: 'Easy',
        reviewTitle: 'Review session',
        done: 'Done',
        empty: 'No cards ready for review.'
    };

    function normalizeStrings(strings) {
        return { ...DEFAULT_STRINGS, ...(strings || {}) };
    }

    function createFlashcardUI(card, strings, onRate) {
        const labels = normalizeStrings(strings);
        const container = document.createElement('div');
        container.className = 'sp-flashcard';
        container.dataset.cardId = card?.id || '';

        const front = document.createElement('div');
        front.className = 'sp-flashcard-front';

        const frontText = document.createElement('div');
        frontText.className = 'sp-flashcard-text';
        frontText.textContent = card?.front || '';

        const flipBtn = document.createElement('button');
        flipBtn.type = 'button';
        flipBtn.className = 'sp-flashcard-flip';
        flipBtn.textContent = labels.showAnswer;

        front.appendChild(frontText);
        front.appendChild(flipBtn);

        const back = document.createElement('div');
        back.className = 'sp-flashcard-back';
        back.style.display = 'none';

        const backText = document.createElement('div');
        backText.className = 'sp-flashcard-text';
        backText.textContent = card?.back || '';

        const rating = document.createElement('div');
        rating.className = 'sp-flashcard-rating';

        const buttons = [
            { label: labels.rateAgain, quality: 0, tone: 'again' },
            { label: labels.rateHard, quality: 3, tone: 'hard' },
            { label: labels.rateGood, quality: 4, tone: 'good' },
            { label: labels.rateEasy, quality: 5, tone: 'easy' }
        ];

        buttons.forEach((btn) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = `sp-flashcard-rate ${btn.tone}`;
            el.textContent = btn.label;
            el.addEventListener('click', () => {
                onRate?.(card, btn.quality);
            });
            rating.appendChild(el);
        });

        back.appendChild(backText);
        back.appendChild(rating);

        container.appendChild(front);
        container.appendChild(back);

        flipBtn.addEventListener('click', () => {
            front.style.display = 'none';
            back.style.display = 'flex';
            container.classList.add('is-flipped');
        });

        return container;
    }

    function createReviewSessionUI(cards, strings, onRate, onComplete) {
        const labels = normalizeStrings(strings);
        const items = Array.isArray(cards) ? cards : [];
        let currentIndex = 0;
        const results = [];

        const container = document.createElement('div');
        container.className = 'sp-review-session';

        const header = document.createElement('div');
        header.className = 'sp-review-header';
        header.innerHTML = `
            <div class="sp-review-title">${labels.reviewTitle}</div>
            <div class="sp-review-progress"><span class="sp-review-current">1</span> / ${items.length}</div>
        `;

        const body = document.createElement('div');
        body.className = 'sp-review-body';

        container.appendChild(header);
        container.appendChild(body);

        const updateProgress = () => {
            const currentEl = header.querySelector('.sp-review-current');
            if (currentEl) currentEl.textContent = String(Math.min(currentIndex + 1, items.length));
        };

        const showSummary = () => {
            body.innerHTML = '';
            const summary = document.createElement('div');
            summary.className = 'sp-review-summary';
            const total = results.length;
            const remembered = results.filter(r => r.quality >= 3).length;
            summary.innerHTML = `
                <div class="sp-review-summary-score">${total ? Math.round((remembered / total) * 100) : 0}%</div>
                <div class="sp-review-summary-sub">${remembered}/${total} remembered</div>
                <button type="button" class="sp-review-summary-done">${labels.done}</button>
            `;
            summary.querySelector('.sp-review-summary-done')?.addEventListener('click', () => {
                onComplete?.(results);
            });
            body.appendChild(summary);
        };

        const showCard = (index) => {
            body.innerHTML = '';
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'sp-review-empty';
                empty.textContent = labels.empty;
                body.appendChild(empty);
                return;
            }
            if (index >= items.length) {
                showSummary();
                return;
            }

            const cardUI = createFlashcardUI(items[index], labels, async (card, quality) => {
                results.push({ cardId: card.id, quality });
                if (typeof onRate === 'function') {
                    await onRate(card, quality);
                }
                currentIndex += 1;
                updateProgress();
                setTimeout(() => showCard(currentIndex), 200);
            });
            body.appendChild(cardUI);
        };

        updateProgress();
        showCard(0);
        return container;
    }

    window.FlashcardUI = {
        createReviewSessionUI
    };
})();
