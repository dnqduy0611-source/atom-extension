// ui/components/teachback.js
// Teach-back UI component for Active Reading retention flow

(function () {
    'use strict';

    const DEFAULT_STRINGS = {
        title: 'Teach-back',
        promptLabel: 'Explain it in your own words',
        hintLabel: 'Hint',
        submit: 'Evaluate',
        retry: 'Try again',
        addToReview: 'Add to Review Deck',
        placeholder: 'Type your explanation...',
        feedbackTitle: 'Feedback',
        suggestionsTitle: 'Suggestions',
        misconceptionsTitle: 'Misconceptions'
    };

    function normalizeStrings(strings) {
        return { ...DEFAULT_STRINGS, ...(strings || {}) };
    }

    function createTeachBackUI(teachBackData, strings, handlers) {
        const labels = normalizeStrings(strings);
        const data = teachBackData && typeof teachBackData === 'object' ? teachBackData : {};
        const onSubmit = handlers?.onSubmit;
        const onAddToReview = handlers?.onAddToReview;
        const onHint = handlers?.onHint;

        const container = document.createElement('div');
        container.className = 'sp-teachback-card';

        const header = document.createElement('div');
        header.className = 'sp-teachback-header';
        header.textContent = labels.title;

        const prompt = document.createElement('div');
        prompt.className = 'sp-teachback-prompt';
        prompt.textContent = data.prompt || labels.promptLabel;

        const textarea = document.createElement('textarea');
        textarea.className = 'sp-teachback-textarea';
        textarea.placeholder = labels.placeholder;
        textarea.rows = 6;

        const actions = document.createElement('div');
        actions.className = 'sp-teachback-actions';

        const hintBtn = document.createElement('button');
        hintBtn.type = 'button';
        hintBtn.className = 'sp-teachback-btn secondary';
        hintBtn.textContent = labels.hintLabel;

        const submitBtn = document.createElement('button');
        submitBtn.type = 'button';
        submitBtn.className = 'sp-teachback-btn primary';
        submitBtn.textContent = labels.submit;
        submitBtn.disabled = true;

        actions.appendChild(hintBtn);
        actions.appendChild(submitBtn);

        const hintBox = document.createElement('div');
        hintBox.className = 'sp-teachback-hint';
        hintBox.style.display = 'none';

        const feedback = document.createElement('div');
        feedback.className = 'sp-teachback-feedback';
        feedback.style.display = 'none';

        container.appendChild(header);
        container.appendChild(prompt);
        container.appendChild(textarea);
        container.appendChild(actions);
        container.appendChild(hintBox);
        container.appendChild(feedback);

        textarea.addEventListener('input', () => {
            submitBtn.disabled = textarea.value.trim().length < 20;
        });

        hintBtn.addEventListener('click', () => {
            if (typeof onHint !== 'function') return;
            const hint = onHint();
            if (!hint) return;
            hintBox.textContent = hint;
            hintBox.style.display = 'block';
        });

        submitBtn.addEventListener('click', async () => {
            if (typeof onSubmit !== 'function') return;
            submitBtn.disabled = true;
            submitBtn.textContent = labels.submit + '...';
            const explanation = textarea.value.trim();
            const result = await onSubmit(explanation);
            submitBtn.textContent = labels.submit;
            showFeedback(feedback, result, labels, () => {
                feedback.style.display = 'none';
                textarea.value = '';
                submitBtn.disabled = true;
            }, () => {
                if (typeof onAddToReview === 'function') {
                    onAddToReview(explanation, result);
                }
            });
        });

        return container;
    }

    function showFeedback(container, result, labels, onRetry, onAddToReview) {
        const data = result && typeof result === 'object' ? result : {};
        container.style.display = 'block';
        container.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'sp-teachback-feedback-header';
        header.textContent = `${labels.feedbackTitle} (${Number.isFinite(data.score) ? Math.round(data.score) : 0}%)`;

        const text = document.createElement('div');
        text.className = 'sp-teachback-feedback-text';
        text.textContent = data.feedback || '';

        container.appendChild(header);
        if (text.textContent) container.appendChild(text);

        if (Array.isArray(data.misconceptions) && data.misconceptions.length) {
            const block = document.createElement('div');
            block.className = 'sp-teachback-feedback-block';
            block.innerHTML = `<strong>${labels.misconceptionsTitle}:</strong>`;
            const list = document.createElement('ul');
            data.misconceptions.forEach((m) => {
                const li = document.createElement('li');
                li.textContent = m;
                list.appendChild(li);
            });
            block.appendChild(list);
            container.appendChild(block);
        }

        if (Array.isArray(data.suggestions) && data.suggestions.length) {
            const block = document.createElement('div');
            block.className = 'sp-teachback-feedback-block';
            block.innerHTML = `<strong>${labels.suggestionsTitle}:</strong>`;
            const list = document.createElement('ul');
            data.suggestions.forEach((s) => {
                const li = document.createElement('li');
                li.textContent = s;
                list.appendChild(li);
            });
            block.appendChild(list);
            container.appendChild(block);
        }

        const actions = document.createElement('div');
        actions.className = 'sp-teachback-feedback-actions';

        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'sp-teachback-btn secondary';
        retryBtn.textContent = labels.retry;
        retryBtn.addEventListener('click', onRetry);

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'sp-teachback-btn primary';
        addBtn.textContent = labels.addToReview;
        addBtn.addEventListener('click', onAddToReview);

        actions.appendChild(retryBtn);
        actions.appendChild(addBtn);
        container.appendChild(actions);
    }

    window.TeachBackUI = {
        createTeachBackUI
    };
})();
