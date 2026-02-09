const atomMsg = (key, substitutions, fallback) => {
    if (window.AtomI18n) {
        return window.AtomI18n.getMessage(key, substitutions, fallback);
    }
    return chrome.i18n.getMessage(key, substitutions) || fallback || key;
};

document.addEventListener('DOMContentLoaded', async () => {
    if (window.AtomI18n) {
        await window.AtomI18n.init();
    }
    const container = document.getElementById('timeline-container');
    const composeEmoji = document.querySelectorAll('#compose-emoji .emoji-btn');
    const composeTags = document.querySelectorAll('#compose-tags .journal-tag');
    const composeText = document.getElementById('compose-text');
    const composeSave = document.getElementById('compose-save');
    const composeAi = document.getElementById('compose-ai');

    const composeState = {
        mood: null,
        customEmoji: null,
        tags: new Set()
    };

    // --- AUTO-HIDE Logic State ---
    let isJournalSubmitted = false;
    let hasInteracted = false;
    let initialTimeout = null;
    const composeContainer = document.querySelector('.journal-compose');

    function hideCompose() {
        if (composeContainer) {
            composeContainer.style.display = 'none';
        }
    }

    // 1. Initial 10s Timeout (Auto-hide if ignored)
    initialTimeout = setTimeout(() => {
        if (!hasInteracted) {
            hideCompose();
        }
    }, 10000);

    // 2. Interaction Tracking (User started writing -> Cancel timeout)
    function markInteraction() {
        if (!hasInteracted) {
            hasInteracted = true;
            if (initialTimeout) clearTimeout(initialTimeout);
        }
    }

    if (composeContainer) {
        composeContainer.addEventListener('click', markInteraction);
        composeContainer.addEventListener('input', markInteraction);
        composeContainer.addEventListener('focusin', markInteraction);
    }

    // 3. Blur / Visibility Logic
    function handleFocusLoss() {
        // Case A: User ignored prompt -> Hide immediate
        if (!hasInteracted) {
            hideCompose();
            return;
        }
        // Case B: User submitted -> Hide on switch
        if (isJournalSubmitted) {
            hideCompose();
            return;
        }
        // Case C: User is writing -> Keep visible (Do nothing)
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleFocusLoss();
    });
    window.addEventListener('blur', handleFocusLoss);


    function renderTimeline(logs) {
        container.innerHTML = '';

        if (logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h2>${atomMsg("jnl_empty_title")}</h2>
                    <p>${atomMsg("jnl_empty_desc")}</p>
                </div>
            `;
            return;
        }

        logs.forEach(log => {
            const logTs = Number(log.timestamp || log.ts || Date.now());
            const dateStr = new Date(logTs).toLocaleString(navigator.language, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const emojiMap = {
                "focused": "😌", "bored": "😐", "anxious": "😰",
                "tired": "😴", "angry": "😤", "neutral": "😶",
                // Extended emoji picker values
                "happy": "😊", "laughing": "😄", "loving": "🥰",
                "heart_eyes": "😍", "excited": "🤩", "celebrating": "🎉",
                "crying": "😢", "sobbing": "😭", "pleading": "🥺",
                "disappointed": "😞", "pensive": "😔", "heartbroken": "💔",
                "anxious_face": "😰", "fearful": "😨", "screaming": "😱",
                "exploding": "🤯", "dizzy": "😵‍💫",
                "sleeping": "😴", "sleepy": "😪", "yawning": "🥱",
                "weary": "😩", "exhausted": "😫",
                "huffing": "😤", "angry_face": "😡", "cursing": "🤬",
                "pouting": "😠", "rage": "💢",
                "neutral_face": "😐", "thinking": "🤔", "rolling_eyes": "🙄",
                "no_mouth": "😶", "meh": "🫤"
            };
            const moodIcon = emojiMap[log.input.user_feeling] || "📝";

            const tagsHtml = (log.input.user_tags || []).map(tag =>
                `<span class="tag">#${tag}</span>`
            ).join('');

            const aiResponse = log.ai_response ? log.ai_response : atomMsg("jnl_ai_waiting");

            const noteText = log.input.user_note || atomMsg("jnl_no_note");
            const contextText = log.input.context || atomMsg("jnl_unknown_context");
            const atLabel = atomMsg("jnl_at");
            const aiLabel = atomMsg("jnl_label_ai");
            const durationSec = Number.isFinite(log.input.duration) ? Math.round(log.input.duration) : 0;

            const html = `
                <div class="journal-card" data-log-id="${log.id || ''}" data-log-ts="${logTs}">
                    <div class="meta-row">
                        <div class="date">${dateStr}</div>
                        <div class="mood" title="${log.input.user_feeling}">${moodIcon}</div>
                    </div>

                    <div class="content-box">
                        <div class="tags">${tagsHtml}</div>
                        <div class="user-note">"${noteText}"</div>
                        <div style="font-size:12px; color:#94A3B8; margin-top:5px;">
                            ${atLabel} ${contextText} (${durationSec}s)
                        </div>
                    </div>

                    <div class="ai-reply-box">
                        <span class="ai-label">${aiLabel}</span>
                        <div class="ai-text">${aiResponse}</div>
                    </div>
                </div>
            `;

            container.insertAdjacentHTML('beforeend', html);
        });
    }

    async function loadLogs() {
        const data = await chrome.storage.local.get(['journal_logs']);
        const logs = data.journal_logs || [];
        logs.sort((a, b) => b.timestamp - a.timestamp);
        return logs;
    }

    async function refreshTimeline() {
        const logs = await loadLogs();
        renderTimeline(logs);
        await focusJournalEntry();
    }

    async function focusJournalEntry() {
        try {
            const data = await chrome.storage.local.get(['journal_focus_id', 'journal_focus_ts']);
            const focusId = String(data.journal_focus_id || '');
            const focusTs = String(data.journal_focus_ts || '');
            if (!focusId && !focusTs) return;

            let target = null;
            if (focusId) {
                target = document.querySelector(`.journal-card[data-log-id="${focusId}"]`);
            }
            if (!target && focusTs) {
                target = document.querySelector(`.journal-card[data-log-ts="${focusTs}"]`);
            }
            if (target) {
                target.classList.add('focused');
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            await chrome.storage.local.remove(['journal_focus_id', 'journal_focus_ts']);
        } catch (e) {
            // ignore
        }
    }

    function resetComposeForm() {
        composeState.mood = null;
        composeState.customEmoji = null;
        composeState.tags.clear();
        composeEmoji.forEach(btn => btn.classList.remove('selected'));
        composeTags.forEach(tag => tag.classList.remove('selected'));
        composeText.value = '';
        // Reset emoji picker
        const pickerBtn = document.getElementById('emoji-picker-btn');
        const pickerPopup = document.getElementById('emoji-picker-popup');
        if (pickerBtn) {
            pickerBtn.classList.remove('selected');
            pickerBtn.innerHTML = '+ ' + atomMsg('emoji_picker_more');
        }
        if (pickerPopup) {
            pickerPopup.classList.remove('show');
        }
    }

    function setComposeBusy(isBusy) {
        composeSave.disabled = isBusy;
        composeSave.innerText = isBusy
            ? atomMsg("journal_btn_processing")
            : atomMsg("journal_btn_saved");
    }

    composeEmoji.forEach(btn => {
        btn.addEventListener('click', () => {
            composeEmoji.forEach(other => other.classList.remove('selected'));
            // Also deselect emoji picker
            const pickerBtn = document.getElementById('emoji-picker-btn');
            if (pickerBtn) {
                pickerBtn.classList.remove('selected');
                pickerBtn.innerHTML = '+ ' + atomMsg('emoji_picker_more');
            }
            const pickerPopup = document.getElementById('emoji-picker-popup');
            if (pickerPopup) pickerPopup.classList.remove('show');

            btn.classList.add('selected');
            composeState.mood = btn.dataset.val;
            composeState.customEmoji = null;
        });
    });

    // Emoji Picker Logic
    const emojiPickerBtn = document.getElementById('emoji-picker-btn');
    const emojiPickerPopup = document.getElementById('emoji-picker-popup');
    const emojiOptions = document.querySelectorAll('.emoji-option');

    if (emojiPickerBtn && emojiPickerPopup) {
        emojiPickerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPickerPopup.classList.toggle('show');
        });

        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiPickerPopup.contains(e.target) && e.target !== emojiPickerBtn) {
                emojiPickerPopup.classList.remove('show');
            }
        });

        emojiOptions.forEach(option => {
            option.addEventListener('click', () => {
                const emojiVal = option.dataset.val;
                const emoji = option.dataset.emoji;

                // Deselect all default emoji buttons
                composeEmoji.forEach(btn => btn.classList.remove('selected'));

                // Update picker button to show selected emoji
                emojiPickerBtn.classList.add('selected');
                emojiPickerBtn.innerHTML = emoji;

                // Update state
                composeState.mood = emojiVal;
                composeState.customEmoji = emoji;

                // Close popup
                emojiPickerPopup.classList.remove('show');
            });
        });
    }

    composeTags.forEach(tag => {
        if (tag.classList.contains('custom-tag-trigger')) return;
        tag.addEventListener('click', () => {
            tag.classList.toggle('selected');
            const val = tag.dataset.val;
            if (composeState.tags.has(val)) {
                composeState.tags.delete(val);
            } else {
                composeState.tags.add(val);
            }
        });
    });

    // Custom Tag Handler
    const customTagTrigger = document.querySelector('.custom-tag-trigger');
    const customTagWrap = document.getElementById('custom-tag-wrap');
    const customTagInput = document.getElementById('custom-tag-input');

    if (customTagTrigger && customTagWrap && customTagInput) {
        customTagTrigger.addEventListener('click', () => {
            customTagTrigger.classList.add('selected');
            customTagWrap.style.display = 'block';
            customTagInput.focus();
        });

        customTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const customValue = customTagInput.value.trim();
                if (customValue && !composeState.tags.has(customValue)) {
                    composeState.tags.add(customValue);
                }
                customTagInput.value = '';
            }
        });

        customTagInput.addEventListener('blur', () => {
            const customValue = customTagInput.value.trim();
            if (customValue && !composeState.tags.has(customValue)) {
                composeState.tags.add(customValue);
            }
        });
    }

    composeSave.addEventListener('click', async () => {
        const note = composeText.value.trim();
        const mood = composeState.mood || "neutral";
        const tags = Array.from(composeState.tags);

        if (!note && tags.length === 0 && !composeState.mood) {
            return;
        }

        setComposeBusy(true);
        composeAi.style.display = 'none';

        const entry = {
            timestamp: Date.now(),
            input: {
                context: atomMsg("jnl_title"),
                duration: 0,
                user_feeling: mood,
                user_tags: tags,
                user_note: note
            }
        };

        const data = await chrome.storage.local.get(['journal_logs']);
        const logs = data.journal_logs || [];
        logs.push(entry);
        await chrome.storage.local.set({ journal_logs: logs });

        chrome.runtime.sendMessage({ type: "ANALYZE_JOURNAL" }, async (response) => {
            const aiLabel = atomMsg("jnl_label_ai");
            if (response && response.success) {
                composeAi.innerText = `${aiLabel}: ${response.message}`;
            } else {
                composeAi.innerText = atomMsg("journal_ai_error");
            }
            composeAi.style.display = 'block';
            setComposeBusy(false);
            resetComposeForm();
            await refreshTimeline();

            // Keep compose visible for consecutive entries
            isJournalSubmitted = false;
            if (composeContainer) {
                composeContainer.style.display = '';
            }
        });
    });

    if (composeText) {
        composeText.setAttribute('placeholder', atomMsg("journal_placeholder"));
    }

    await refreshTimeline();
});
