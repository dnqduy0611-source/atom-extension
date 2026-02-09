// ui/components/quiz.js
// Quiz UI component for Active Reading retention flow

(function () {
    'use strict';

    const DEFAULT_STRINGS = {
        skip: 'Skip',
        submit: 'Submit Answer',
        evaluating: 'Evaluating...',
        continue: 'Continue',
        placeholder: 'Type your answer here...',
        questionLabel: 'Question',
        ofLabel: 'of',
        summaryTitle: 'Quiz complete',
        addToReview: 'Add to Review Deck',
        done: 'Done',
        correctLabel: 'What you got right',
        missingLabel: 'What you missed',
        evidenceLabel: 'From the text'
    };

    function normalizeStrings(strings) {
        return { ...DEFAULT_STRINGS, ...(strings || {}) };
    }

    function createQuizQuestionUI(question, strings, onEvaluate, onResult) {
        const labels = normalizeStrings(strings);
        const container = document.createElement('div');
        container.className = 'sp-quiz-card';
        container.dataset.questionId = question?.id || '';

        const header = document.createElement('div');
        header.className = 'sp-quiz-header';

        const tierWrap = document.createElement('div');
        tierWrap.className = 'sp-quiz-tier';
        const tierMeta = window.QuizGeneratorService?.QUIZ_TIERS?.[question?.tier];
        const tierLabel = document.createElement('span');
        tierLabel.className = `sp-quiz-tier-badge tier-${question?.tier || 1}`;
        tierLabel.textContent = tierMeta?.label || `Tier ${question?.tier || 1}`;
        const tierBloom = document.createElement('span');
        tierBloom.className = 'sp-quiz-tier-bloom';
        tierBloom.textContent = tierMeta?.bloomLevel || '';
        tierWrap.appendChild(tierLabel);
        if (tierBloom.textContent) tierWrap.appendChild(tierBloom);

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'sp-quiz-skip';
        skipBtn.textContent = labels.skip;

        header.appendChild(tierWrap);
        header.appendChild(skipBtn);

        const questionWrap = document.createElement('div');
        questionWrap.className = 'sp-quiz-question';

        if (question?.scenario) {
            const scenario = document.createElement('div');
            scenario.className = 'sp-quiz-scenario';
            scenario.textContent = question.scenario;
            questionWrap.appendChild(scenario);
        }

        const questionText = document.createElement('div');
        questionText.className = 'sp-quiz-question-text';
        questionText.textContent = question?.question || '';
        questionWrap.appendChild(questionText);

        const answerWrap = document.createElement('div');
        answerWrap.className = 'sp-quiz-answer';

        let textarea = null;
        if (question?.type === 'multiple_choice') {
            const optionsWrap = document.createElement('div');
            optionsWrap.className = 'sp-quiz-options';

            (question.options || []).forEach((opt, idx) => {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'sp-quiz-option';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `quiz-${question.id || 'q'}`;
                radio.value = String(idx);

                const letter = document.createElement('span');
                letter.className = 'sp-quiz-option-letter';
                letter.textContent = String.fromCharCode(65 + idx);

                const optionText = document.createElement('span');
                optionText.className = 'sp-quiz-option-text';
                optionText.textContent = opt;

                optionLabel.appendChild(radio);
                optionLabel.appendChild(letter);
                optionLabel.appendChild(optionText);
                optionsWrap.appendChild(optionLabel);
            });

            answerWrap.appendChild(optionsWrap);
        } else {
            textarea = document.createElement('textarea');
            textarea.className = 'sp-quiz-textarea';
            textarea.rows = 4;
            textarea.placeholder = labels.placeholder;
            answerWrap.appendChild(textarea);
        }

        const actions = document.createElement('div');
        actions.className = 'sp-quiz-actions';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'sp-quiz-submit';
        submitBtn.textContent = labels.submit;
        submitBtn.disabled = true;

        actions.appendChild(submitBtn);

        const feedback = document.createElement('div');
        feedback.className = 'sp-quiz-feedback';
        feedback.style.display = 'none';

        container.appendChild(header);
        container.appendChild(questionWrap);
        container.appendChild(answerWrap);
        container.appendChild(actions);
        container.appendChild(feedback);

        const enableSubmit = () => {
            if (question?.type === 'multiple_choice') {
                const checked = container.querySelector('input[type="radio"]:checked');
                submitBtn.disabled = !checked;
                return;
            }
            submitBtn.disabled = !textarea || textarea.value.trim().length < 10;
        };

        if (question?.type === 'multiple_choice') {
            container.querySelectorAll('input[type="radio"]').forEach((radio) => {
                radio.addEventListener('change', enableSubmit);
            });
        } else if (textarea) {
            textarea.addEventListener('input', enableSubmit);
        }

        skipBtn.addEventListener('click', () => {
            onResult?.({
                questionId: question?.id || '',
                tier: question?.tier || 1,
                skipped: true,
                score: 0
            });
        });

        submitBtn.addEventListener('click', async () => {
            submitBtn.disabled = true;
            submitBtn.textContent = labels.evaluating;
            let answer;
            if (question?.type === 'multiple_choice') {
                const checked = container.querySelector('input[type="radio"]:checked');
                answer = checked ? Number(checked.value) : null;
            } else {
                answer = textarea ? textarea.value.trim() : '';
            }

            let result = null;
            if (typeof onEvaluate === 'function') {
                result = await onEvaluate(question, answer);
            }
            result = result || { score: 0, feedback: '' };

            showFeedback(feedback, result, labels);
            actions.style.display = 'none';
            answerWrap.style.opacity = '0.6';
            answerWrap.style.pointerEvents = 'none';

            const continueBtn = feedback.querySelector('.sp-quiz-continue');
            continueBtn?.addEventListener('click', () => {
                onResult?.({
                    questionId: question?.id || '',
                    tier: question?.tier || 1,
                    userAnswer: answer,
                    ...result
                });
            });
        });

        return container;
    }

    function showFeedback(container, result, strings) {
        const passed = Number(result?.score) >= 70;
        container.style.display = 'block';
        container.className = `sp-quiz-feedback ${passed ? 'is-correct' : 'is-wrong'}`;

        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'sp-quiz-feedback-header';
        header.innerHTML = `<span class="sp-quiz-feedback-icon">${passed ? '✅' : '❌'}</span>
            <span class="sp-quiz-feedback-score">${Number.isFinite(result?.score) ? Math.round(result.score) : 0}%</span>`;

        const text = document.createElement('div');
        text.className = 'sp-quiz-feedback-text';
        text.textContent = result?.feedback || '';

        container.appendChild(header);
        if (text.textContent) container.appendChild(text);

        if (Array.isArray(result?.correctPoints) && result.correctPoints.length) {
            const correct = document.createElement('div');
            correct.className = 'sp-quiz-feedback-block';
            correct.innerHTML = `<strong>${strings.correctLabel}:</strong>`;
            const list = document.createElement('ul');
            result.correctPoints.forEach((point) => {
                const li = document.createElement('li');
                li.textContent = point;
                list.appendChild(li);
            });
            correct.appendChild(list);
            container.appendChild(correct);
        }

        if (Array.isArray(result?.missingPoints) && result.missingPoints.length) {
            const missing = document.createElement('div');
            missing.className = 'sp-quiz-feedback-block';
            missing.innerHTML = `<strong>${strings.missingLabel}:</strong>`;
            const list = document.createElement('ul');
            result.missingPoints.forEach((point) => {
                const li = document.createElement('li');
                li.textContent = point;
                list.appendChild(li);
            });
            missing.appendChild(list);
            container.appendChild(missing);
        }

        if (result?.evidence) {
            const evidence = document.createElement('div');
            evidence.className = 'sp-quiz-feedback-evidence';
            evidence.textContent = `${strings.evidenceLabel}: "${result.evidence}"`;
            container.appendChild(evidence);
        }

        const continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'sp-quiz-continue';
        continueBtn.textContent = strings.continue;
        container.appendChild(continueBtn);
    }

    function createQuizSessionUI(questions, strings, onEvaluate, onComplete) {
        const items = Array.isArray(questions) ? questions : [];
        const labels = normalizeStrings(strings);
        const results = [];
        let currentIndex = 0;

        const container = document.createElement('div');
        container.className = 'sp-quiz-session';

        const progress = document.createElement('div');
        progress.className = 'sp-quiz-progress';
        progress.innerHTML = `
            <div class="sp-quiz-progress-text">
                ${labels.questionLabel} <span class="sp-quiz-progress-current">1</span> ${labels.ofLabel} ${items.length}
            </div>
            <div class="sp-quiz-progress-bar"><div class="sp-quiz-progress-fill"></div></div>
        `;

        const body = document.createElement('div');
        body.className = 'sp-quiz-body';

        container.appendChild(progress);
        container.appendChild(body);

        const updateProgress = () => {
            const currentEl = progress.querySelector('.sp-quiz-progress-current');
            const fill = progress.querySelector('.sp-quiz-progress-fill');
            if (currentEl) currentEl.textContent = String(Math.min(currentIndex + 1, items.length));
            if (fill) {
                const ratio = items.length ? (currentIndex / items.length) * 100 : 0;
                fill.style.width = `${Math.min(100, ratio)}%`;
            }
        };

        const showSummary = () => {
            const totalScore = results.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
            const avgScore = results.length ? Math.round(totalScore / results.length) : 0;

            body.innerHTML = '';
            const summary = document.createElement('div');
            summary.className = 'sp-quiz-summary';
            summary.innerHTML = `
                <div class="sp-quiz-summary-title">${labels.summaryTitle}</div>
                <div class="sp-quiz-summary-score">${avgScore}%</div>
                <div class="sp-quiz-summary-actions">
                    <button type="button" class="sp-quiz-summary-add">${labels.addToReview}</button>
                    <button type="button" class="sp-quiz-summary-done">${labels.done}</button>
                </div>
            `;

            summary.querySelector('.sp-quiz-summary-add')?.addEventListener('click', () => {
                onComplete?.({ results, addToReview: true });
            });
            summary.querySelector('.sp-quiz-summary-done')?.addEventListener('click', () => {
                onComplete?.({ results, addToReview: false });
            });

            body.appendChild(summary);
        };

        const showQuestion = (index) => {
            body.innerHTML = '';
            if (!items.length) {
                showSummary();
                return;
            }

            if (index >= items.length) {
                showSummary();
                return;
            }

            const card = createQuizQuestionUI(
                items[index],
                labels,
                onEvaluate,
                (result) => {
                    results.push(result || {});
                    currentIndex += 1;
                    updateProgress();
                    setTimeout(() => showQuestion(currentIndex), 200);
                }
            );
            body.appendChild(card);
        };

        updateProgress();
        showQuestion(0);
        return container;
    }

    window.QuizUI = {
        createQuizSessionUI
    };
})();
