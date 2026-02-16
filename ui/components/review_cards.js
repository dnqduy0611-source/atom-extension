// ui/components/review_cards.js
// AI-powered Flashcard Review Cards for the Review tab
// Phase A: Foundation + Empty/NoApiKey states
// Phase B: Card generation + AI integration
// Phase C: Card rendering + flip + navigation + cache

(function () {
    'use strict';

    // ===========================
    // Constants & Config
    // ===========================

    const CACHE_KEY = 'atom_review_cards_cache';
    const CACHE_TTL = 3600000; // 1 hour
    const MAX_CARDS_PER_SESSION = 5;
    const MIN_TEXT_LENGTH = 30;
    const SIMILARITY_THRESHOLD = 0.65;

    const ELIGIBLE_STATUSES = ['exported', 'pending_review', 'approved'];

    // ===========================
    // i18n Helper
    // ===========================

    function msg(key, fallback) {
        // Route through SP.getMessage which respects atom_ui_language user preference
        if (window.SP?.getMessage) {
            return window.SP.getMessage(key, fallback);
        }
        // Fallback: direct chrome.i18n (only uses browser locale)
        if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
            return chrome.i18n.getMessage(key) || fallback;
        }
        return fallback;
    }

    // ===========================
    // State
    // ===========================

    let mounted = false;
    let currentContainer = null;
    let currentState = 'idle'; // idle | empty | no_api_key | loading | ready | error | done
    let currentDeck = [];      // FlashcardItem[]
    let sourceCards = [];       // SRQ cards used as input
    let currentIndex = 0;

    // ===========================
    // mount() — Entry point
    // ===========================

    function mount(container) {
        if (!container) return;
        currentContainer = container;
        mounted = true;

        // Inject CSS
        // (styles/review_cards.css.js handles injection via script tag)

        // Start the flow
        startReviewFlow();
    }

    async function startReviewFlow() {
        if (!currentContainer) return;

        // Check if we have an API key
        const hasKey = await checkApiKey();
        if (!hasKey) {
            renderNoApiKeyState();
            return;
        }

        // Check cache first
        const cached = await checkCache();
        if (cached) {
            currentDeck = cached.flashcards;
            sourceCards = cached.sourceCardIds;
            currentIndex = 0;
            renderDeck();
            return;
        }

        // Load eligible cards
        renderLoadingState();

        try {
            const allCards = await loadEligibleCards();
            if (!allCards || allCards.length === 0) {
                renderEmptyState();
                return;
            }

            const { cards, types } = selectCardsForReview(allCards);
            if (cards.length === 0) {
                renderEmptyState();
                return;
            }

            const flashcards = await generateFlashcards(cards, types);
            if (!flashcards || flashcards.length === 0) {
                renderErrorState(msg('review_error', "Couldn't generate cards."), () => startReviewFlow());
                return;
            }

            // Save to cache
            await saveCache(cards.map(c => c.id), flashcards);

            currentDeck = flashcards;
            sourceCards = cards;
            currentIndex = 0;
            renderDeck();

        } catch (err) {
            console.error('[ReviewCards] Generation failed:', err);
            renderErrorState(
                msg('review_error', "Couldn't generate cards."),
                () => startReviewFlow()
            );
        }
    }

    // ===========================
    // API Key Check
    // ===========================

    async function checkApiKey() {
        try {
            const data = await chrome.storage.local.get([
                'user_gemini_key', 'gemini_api_key', 'apiKey', 'atom_openrouter_key'
            ]);
            return !!(data.user_gemini_key || data.gemini_api_key ||
                data.apiKey || data.atom_openrouter_key);
        } catch (e) {
            return false;
        }
    }

    // ===========================
    // Load Eligible SRQ Cards
    // ===========================

    function loadEligibleCards() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage({ type: 'SRQ_GET_ALL_CARDS' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[ReviewCards] SRQ_GET_ALL_CARDS error:', chrome.runtime.lastError);
                        resolve([]);
                        return;
                    }

                    const allCards = response?.cards || response?.data || [];
                    const eligible = allCards.filter(c =>
                        c.selectedText?.length > MIN_TEXT_LENGTH &&
                        ELIGIBLE_STATUSES.includes(c.status)
                    );

                    resolve(eligible);
                });
            } catch (e) {
                console.error('[ReviewCards] loadEligibleCards error:', e);
                resolve([]);
            }
        });
    }

    // ===========================
    // Card Selection Algorithm
    // ===========================

    function selectCardsForReview(allCards) {
        if (!allCards || allCards.length === 0) return { cards: [], types: [] };

        // Shuffle
        const shuffled = shuffleArray([...allCards]);
        const selected = shuffled.slice(0, MAX_CARDS_PER_SESSION);

        // Assign types
        const types = [];
        for (let i = 0; i < selected.length; i++) {
            if (i < 2) types.push('recall');
            else if (i < 4) types.push('concept');
            else types.push('connect');
        }

        // Check if Connect is possible (need ≥2 cards same topicKey)
        const lastIdx = types.lastIndexOf('connect');
        if (lastIdx >= 0) {
            const topicGroups = {};
            allCards.forEach(c => {
                const key = c.topicKey || c.topic || 'unknown';
                if (!topicGroups[key]) topicGroups[key] = [];
                topicGroups[key].push(c);
            });
            const connectableTopic = Object.keys(topicGroups).find(k => topicGroups[k].length >= 2);
            if (!connectableTopic) {
                types[lastIdx] = 'concept'; // Fallback
            }
        }

        return { cards: selected, types };
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ===========================
    // AI Prompt & Generation
    // ===========================

    async function generateFlashcards(cards, types) {
        // Build batch prompt
        const highlights = cards.map((card, i) => {
            const type = types[i] || 'recall';
            let entry = `---\nIndex ${i} (${type}): "${card.selectedText || ''}"`;
            entry += `\nTopic: ${card.topicKey || card.topic || 'General'}`;
            entry += `\nSource: ${card.title || 'Unknown'} (${card.domain || ''})`;

            if (card.refinedInsight || card.atomicThought) {
                entry += `\nInsight: "${card.refinedInsight || card.atomicThought}"`;
            }

            // For connect type, try to find a second highlight
            if (type === 'connect' && i > 0) {
                const pairCard = cards.find((c, j) =>
                    j !== i && (c.topicKey || c.topic) === (card.topicKey || card.topic)
                ) || cards[0];
                entry += `\n  Highlight A: "${card.selectedText}"`;
                entry += `\n  Highlight B: "${pairCard.selectedText}"`;
            }

            return entry;
        }).join('\n');

        const systemPrompt = 'You are a study assistant. Generate flashcard questions from reading highlights.\nReturn ONLY valid JSON array. No markdown, no explanation.';

        const userPrompt = `Generate flashcard questions for these highlights. Return JSON array with this exact structure:

[
  {
    "index": 0,
    "type": "recall",
    "question": "What is the key concept described in this highlight?",
    "answer": "The answer based on the highlight.",
    "hint": "A brief hint..."
  },
  {
    "index": 1,
    "type": "concept",
    "conceptSummary": "A paraphrased summary of the concept",
    "sourceTitle": "Title",
    "sourceDomain": "domain.com"
  },
  {
    "index": 2,
    "type": "connect",
    "connectionQuestion": "How do these two concepts relate?",
    "connectionInsight": "The relationship between them...",
    "highlightA": "First highlight text",
    "highlightB": "Second highlight text"
  }
]

Highlights:
${highlights}
---`;

        // Use existing callLLMAPI from SP module
        const callFn = window.SP?.callLLMAPI;
        if (typeof callFn !== 'function') {
            throw new Error('callLLMAPI not available — SP module not loaded');
        }

        const history = [{ role: 'user', parts: [{ text: userPrompt }] }];

        const response = await callFn(systemPrompt, history, {
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096
            }
        });

        return parseAIResponse(response, cards);
    }

    function parseAIResponse(responseText, originalCards) {
        if (!responseText) return null;

        let text = typeof responseText === 'string' ? responseText :
            responseText?.text || responseText?.content || '';

        // Strip markdown code blocks if present
        text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) return null;

            // Attach sourceCardId references
            return parsed.map((item, i) => {
                if (originalCards[item.index] || originalCards[i]) {
                    item.sourceCardId = (originalCards[item.index] || originalCards[i])?.id;
                }
                return item;
            });
        } catch (e) {
            console.error('[ReviewCards] JSON parse failed:', e);

            // Try to extract JSON array from response
            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
                try {
                    const parsed = JSON.parse(match[0]);
                    return Array.isArray(parsed) ? parsed : null;
                } catch (e2) {
                    // Ignore
                }
            }

            // Try to recover truncated JSON by closing open strings/objects
            let truncated = text.replace(/\[([\s\S]*)$/, '[$1');
            // Try progressively closing the JSON
            const closers = ['"}]', '}]', ']'];
            for (const closer of closers) {
                try {
                    const lastComma = truncated.lastIndexOf('},');
                    if (lastComma > 0) {
                        const partial = truncated.substring(0, lastComma + 1) + ']';
                        const parsed = JSON.parse(partial);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            console.log('[ReviewCards] Recovered', parsed.length, 'cards from truncated JSON');
                            return parsed;
                        }
                    }
                } catch (e3) {
                    // try next closer
                }
            }
            return null;
        }
    }

    // ===========================
    // Cache Management
    // ===========================

    async function checkCache() {
        try {
            const data = await chrome.storage.local.get([CACHE_KEY]);
            const cache = data[CACHE_KEY];
            if (!cache) return null;

            const now = Date.now();
            if (now - cache.generatedAt > (cache.ttl || CACHE_TTL)) {
                return null; // Expired
            }

            // Verify source cards haven't changed
            const currentCards = await loadEligibleCards();
            const currentIds = currentCards.map(c => c.id).sort().join(',');
            const cachedIds = (cache.sourceCardIds || []).sort().join(',');

            // If source has changed significantly, invalidate
            if (currentIds !== cachedIds && currentCards.length !== cache.sourceCardIds?.length) {
                return null;
            }

            return cache;
        } catch (e) {
            return null;
        }
    }

    async function saveCache(sourceCardIds, flashcards) {
        try {
            await chrome.storage.local.set({
                [CACHE_KEY]: {
                    generatedAt: Date.now(),
                    ttl: CACHE_TTL,
                    sourceCardIds,
                    flashcards
                }
            });
        } catch (e) {
            console.warn('[ReviewCards] Cache save failed:', e);
        }
    }

    async function invalidateCache() {
        try {
            await chrome.storage.local.remove(CACHE_KEY);
        } catch (e) {
            // ignore
        }
    }

    // ===========================
    // Render: Empty State
    // ===========================

    function renderEmptyState() {
        if (!currentContainer) return;
        currentState = 'empty';
        currentContainer.innerHTML = '';

        const el = document.createElement('div');
        el.className = 'rc-empty rc-fade-in';
        el.innerHTML = `
            <svg class="rc-empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            <div class="rc-empty-title">${msg('review_title', 'Review')}</div>
            <div class="rc-empty-desc">${msg('review_empty', 'Save highlights while reading to start practicing.')}</div>
            <button class="rc-empty-btn" type="button">${msg('review_empty_cta', 'Go to Chat')}</button>
        `;

        el.querySelector('.rc-empty-btn')?.addEventListener('click', () => {
            // Switch to chat tab
            if (typeof window.switchMainTab === 'function') {
                window.switchMainTab('chat', true);
            } else {
                document.body.setAttribute('data-main-tab', 'chat');
                document.querySelectorAll('.sp-main-tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mainTab === 'chat');
                    btn.setAttribute('aria-selected', btn.dataset.mainTab === 'chat' ? 'true' : 'false');
                });
            }
        });

        currentContainer.appendChild(el);
    }

    // ===========================
    // Render: No API Key State
    // ===========================

    function renderNoApiKeyState() {
        if (!currentContainer) return;
        currentState = 'no_api_key';
        currentContainer.innerHTML = '';

        const el = document.createElement('div');
        el.className = 'rc-empty rc-fade-in';
        el.innerHTML = `
            <svg class="rc-empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
            <div class="rc-empty-title">${msg('review_no_key', 'Set up an API key in Settings to use Review.')}</div>
            <div class="rc-empty-desc">${msg('review_no_key_desc', 'Review needs a Gemini or OpenRouter API key to generate flashcards from your highlights.')}</div>
            <button class="rc-empty-btn" type="button">${msg('review_open_settings', 'Open Settings')}</button>
        `;

        el.querySelector('.rc-empty-btn')?.addEventListener('click', () => {
            try {
                chrome.runtime.openOptionsPage();
            } catch (e) {
                // fallback
            }
        });

        currentContainer.appendChild(el);
    }

    // ===========================
    // Render: Loading State
    // ===========================

    function renderLoadingState() {
        if (!currentContainer) return;
        currentState = 'loading';
        currentContainer.innerHTML = '';

        const el = document.createElement('div');
        el.className = 'rc-loading rc-fade-in';
        el.innerHTML = `
            <div class="rc-skeleton-card"></div>
            <div class="rc-spinner"></div>
            <div class="rc-loading-text">${msg('review_loading', 'Generating study cards...')}</div>
        `;

        currentContainer.appendChild(el);
    }

    // ===========================
    // Render: Error State
    // ===========================

    function renderErrorState(message, retryFn) {
        if (!currentContainer) return;
        currentState = 'error';
        currentContainer.innerHTML = '';

        const el = document.createElement('div');
        el.className = 'rc-error rc-fade-in';
        el.innerHTML = `
            <svg class="rc-error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div class="rc-error-text">${message}</div>
            <button class="rc-empty-btn" type="button">${msg('review_retry', 'Try again')}</button>
            <button class="rc-empty-btn" type="button" style="opacity:0.7">${msg('review_empty_cta', 'Go to Chat')}</button>
        `;

        const buttons = el.querySelectorAll('.rc-empty-btn');
        buttons[0]?.addEventListener('click', () => {
            if (retryFn) retryFn();
        });
        buttons[1]?.addEventListener('click', () => {
            document.body.setAttribute('data-main-tab', 'chat');
        });

        currentContainer.appendChild(el);
    }

    // ===========================
    // Render: Deck (Ready State)
    // ===========================

    function renderDeck() {
        if (!currentContainer || !currentDeck.length) return;
        currentState = 'ready';
        currentContainer.innerHTML = '';

        const root = document.createElement('div');
        root.className = 'rc-root rc-fade-in';

        // Header
        const header = document.createElement('div');
        header.className = 'rc-header';
        header.innerHTML = `
            <div class="rc-title">${msg('review_title', 'Review')}</div>
            <div class="rc-counter">
                <span class="rc-current">${currentIndex + 1}</span> / ${currentDeck.length}
            </div>
        `;
        root.appendChild(header);

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'rc-progress-bar';
        const progressFill = document.createElement('div');
        progressFill.className = 'rc-progress-fill';
        progressFill.style.width = `${((currentIndex + 1) / currentDeck.length) * 100}%`;
        progressBar.appendChild(progressFill);
        root.appendChild(progressBar);

        // Card container
        const cardContainer = document.createElement('div');
        cardContainer.className = 'rc-card-container';
        const cardEl = renderCard(currentDeck[currentIndex], sourceCards[currentIndex]);
        cardContainer.appendChild(cardEl);
        root.appendChild(cardContainer);

        // Navigation
        const nav = document.createElement('div');
        nav.className = 'rc-nav';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'rc-nav-btn';
        prevBtn.textContent = msg('review_prev', 'Previous');
        prevBtn.disabled = currentIndex === 0;
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) {
                currentIndex--;
                renderDeck();
            }
        });

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'rc-refresh-btn';
        refreshBtn.textContent = msg('review_refresh', 'New cards');
        refreshBtn.addEventListener('click', () => refresh());

        const nextBtn = document.createElement('button');
        nextBtn.className = 'rc-nav-btn';
        nextBtn.textContent = currentIndex === currentDeck.length - 1
            ? msg('review_finish', 'Finish')
            : msg('review_next', 'Next');
        nextBtn.addEventListener('click', () => {
            if (currentIndex < currentDeck.length - 1) {
                currentIndex++;
                renderDeck();
            } else {
                renderDoneState();
            }
        });

        nav.appendChild(prevBtn);
        nav.appendChild(refreshBtn);
        nav.appendChild(nextBtn);
        root.appendChild(nav);

        currentContainer.appendChild(root);
    }

    // ===========================
    // Render: Single Card
    // ===========================

    function renderCard(flashcard) {
        const card = document.createElement('div');
        card.className = 'rc-card';

        const type = flashcard?.type || 'recall';

        // FRONT
        const front = document.createElement('div');
        front.className = 'rc-card-front';

        const badge = document.createElement('div');
        badge.className = `rc-type-badge rc-type-${type}`;
        badge.textContent = msg(`review_type_${type}`,
            type === 'recall' ? 'Recall' : type === 'concept' ? 'Concept' : 'Connect');
        front.appendChild(badge);

        if (type === 'recall') {
            const question = document.createElement('div');
            question.className = 'rc-card-question';
            question.textContent = flashcard.question || '';
            front.appendChild(question);

            if (flashcard.hint) {
                const hint = document.createElement('div');
                hint.className = 'rc-card-hint';
                hint.textContent = flashcard.hint;
                front.appendChild(hint);
            }
        } else if (type === 'concept') {
            const summary = document.createElement('div');
            summary.className = 'rc-card-question';
            summary.textContent = flashcard.conceptSummary || '';
            front.appendChild(summary);
        } else if (type === 'connect') {
            const q = document.createElement('div');
            q.className = 'rc-card-question';
            q.textContent = flashcard.connectionQuestion || 'How do these ideas connect?';
            front.appendChild(q);

            if (flashcard.highlightA) {
                const labelA = document.createElement('div');
                labelA.className = 'rc-connect-label';
                labelA.textContent = 'Highlight A';
                front.appendChild(labelA);

                const hlA = document.createElement('div');
                hlA.className = 'rc-connect-highlight';
                hlA.textContent = flashcard.highlightA;
                front.appendChild(hlA);
            }

            if (flashcard.highlightB) {
                const labelB = document.createElement('div');
                labelB.className = 'rc-connect-label';
                labelB.textContent = 'Highlight B';
                front.appendChild(labelB);

                const hlB = document.createElement('div');
                hlB.className = 'rc-connect-highlight';
                hlB.textContent = flashcard.highlightB;
                front.appendChild(hlB);
            }
        }

        const flipHint = document.createElement('div');
        flipHint.className = 'rc-card-flip-hint';
        flipHint.textContent = msg('review_card_flip', 'Tap to reveal');
        front.appendChild(flipHint);

        // BACK
        const back = document.createElement('div');
        back.className = 'rc-card-back';

        const backBadge = badge.cloneNode(true);
        back.appendChild(backBadge);

        if (type === 'recall') {
            const answer = document.createElement('div');
            answer.className = 'rc-card-answer';
            answer.textContent = flashcard.answer || '';
            back.appendChild(answer);
        } else if (type === 'concept') {
            const original = document.createElement('div');
            original.className = 'rc-card-answer';
            original.textContent = msg('review_original', 'Original highlight:');
            back.appendChild(original);

            if (flashcard.sourceTitle || flashcard.sourceDomain) {
                const source = document.createElement('div');
                source.className = 'rc-card-source';
                source.innerHTML = `<span class="rc-card-source-title">${flashcard.sourceTitle || ''}</span> ${flashcard.sourceDomain || ''}`;
                back.appendChild(source);
            }
        } else if (type === 'connect') {
            const insight = document.createElement('div');
            insight.className = 'rc-card-answer';
            insight.textContent = flashcard.connectionInsight || '';
            back.appendChild(insight);
        }

        card.appendChild(front);
        card.appendChild(back);

        // Flip on click
        card.addEventListener('click', () => {
            card.classList.toggle('flipped');
        });

        return card;
    }

    // ===========================
    // Render: Session Complete
    // ===========================

    function renderDoneState() {
        if (!currentContainer) return;
        currentState = 'done';
        currentContainer.innerHTML = '';

        const el = document.createElement('div');
        el.className = 'rc-done rc-fade-in';

        const count = currentDeck.length;
        el.innerHTML = `
            <div class="rc-done-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none"
                    stroke="var(--primary, #10B981)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </div>
            <div class="rc-done-title">${msg('review_done_title', 'Session complete!')}</div>
            <div class="rc-done-desc">${msg('review_done_desc', 'You reviewed $1 cards.').replace('$1', count)}</div>
            <button class="rc-empty-btn" type="button">${msg('review_done_again', 'Practice again')}</button>
        `;

        el.querySelector('.rc-empty-btn')?.addEventListener('click', () => refresh());

        currentContainer.appendChild(el);
    }

    // ===========================
    // refresh() — Force regenerate
    // ===========================

    async function refresh() {
        await invalidateCache();
        currentDeck = [];
        sourceCards = [];
        currentIndex = 0;
        startReviewFlow();
    }

    // ===========================
    // Public API
    // ===========================

    window.ReviewCards = {
        mount,
        refresh
    };
})();
