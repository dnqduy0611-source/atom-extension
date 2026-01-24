document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('timeline-container');

    // 2. Lấy dữ liệu logs
    const data = await chrome.storage.local.get(['journal_logs']);
    const logs = data.journal_logs || [];

    // 3. Sắp xếp: Mới nhất lên đầu
    logs.sort((a, b) => b.timestamp - a.timestamp);

    // 4. Render
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>${chrome.i18n.getMessage("jnl_empty_title")}</h2>
                <p>${chrome.i18n.getMessage("jnl_empty_desc")}</p>
            </div>
        `;
        return;
    }

    logs.forEach(log => {
        // Tự động định dạng ngày giờ theo ngôn ngữ trình duyệt (vi-VN hoặc en-US...)
        const dateStr = new Date(log.timestamp).toLocaleString(navigator.language, {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const emojiMap = {
            "focused": "😌", "bored": "😐", "anxious": "😰",
            "tired": "😴", "angry": "😤", "neutral": "😶"
        };
        const moodIcon = emojiMap[log.input.user_feeling] || "📝";

        const tagsHtml = (log.input.user_tags || []).map(tag =>
            `<span class="tag">#${tag}</span>`
        ).join('');

        const aiResponse = log.ai_response
            ? log.ai_response
            : "...";

        const noteText = log.input.user_note || chrome.i18n.getMessage("jnl_no_note");
        const contextText = log.input.context || chrome.i18n.getMessage("jnl_unknown_context");
        const atLabel = chrome.i18n.getMessage("jnl_at");
        const aiLabel = chrome.i18n.getMessage("jnl_label_ai");

        const html = `
            <div class="journal-card">
                <div class="meta-row">
                    <div class="date">${dateStr}</div>
                    <div class="mood" title="${log.input.user_feeling}">${moodIcon}</div>
                </div>

                <div class="content-box">
                    <div class="tags">${tagsHtml}</div>
                    <div class="user-note">"${noteText}"</div>
                    <div style="font-size:12px; color:#94A3B8; margin-top:5px;">
                        ${atLabel} ${contextText} (${Math.round(log.input.duration)}s)
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
});