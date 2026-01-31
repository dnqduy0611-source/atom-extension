/**
 * ATOM Memory - Reading Notes & Open-to-Recall UI
 *
 * Per spec section 5.3 (Recall & Retrieval):
 * - User searches in ATOM Memory (search/tag/time)
 * - Shows list of notes "exported to which notebook"
 * - Button: Open NotebookLM (opens correct notebookRef)
 * - Button: Copy question (suggested question based on bundle + tags)
 */

const atomMsg = (key, substitutions, fallback) => {
    if (window.AtomI18n) {
        return window.AtomI18n.getMessage(key, substitutions, fallback);
    }
    return chrome.i18n.getMessage(key, substitutions) || fallback || key;
};

// State
const state = {
    notes: [],
    filteredNotes: [],
    filter: "all", // "all" | "exported" | "not-exported"
    searchQuery: "",
    page: 1,
    pageSize: 10
};

document.addEventListener("DOMContentLoaded", async () => {
    if (window.AtomI18n) {
        await window.AtomI18n.init();
    }

    // Load notes
    await loadNotes();

    // Setup event listeners
    setupFilterChips();
    setupSearch();
    setupPagination();

    // Initial render
    applyFilters();
    renderNotes();
    updateStats();
});

/**
 * Load reading notes from storage
 */
async function loadNotes() {
    try {
        const data = await chrome.storage.local.get(["atom_reading_notes"]);
        const notes = data.atom_reading_notes || [];
        // Sort by created_at descending (newest first)
        state.notes = notes.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        state.filteredNotes = [...state.notes];
    } catch (error) {
        console.error("[ATOM Memory] Failed to load notes:", error);
        state.notes = [];
        state.filteredNotes = [];
    }
}

/**
 * Setup filter chip buttons
 */
function setupFilterChips() {
    const chips = document.querySelectorAll(".filter-chip");
    chips.forEach(chip => {
        chip.addEventListener("click", () => {
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            state.filter = chip.dataset.filter;
            state.page = 1;
            applyFilters();
            renderNotes();
        });
    });
}

/**
 * Setup search input
 */
function setupSearch() {
    const searchInput = document.getElementById("search-input");
    let debounceTimer;

    searchInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.searchQuery = e.target.value.trim().toLowerCase();
            state.page = 1;
            applyFilters();
            renderNotes();
        }, 300);
    });
}

/**
 * Setup pagination buttons
 */
function setupPagination() {
    const btnPrev = document.getElementById("btn-prev");
    const btnNext = document.getElementById("btn-next");

    btnPrev.addEventListener("click", () => {
        if (state.page > 1) {
            state.page--;
            renderNotes();
        }
    });

    btnNext.addEventListener("click", () => {
        const maxPage = Math.ceil(state.filteredNotes.length / state.pageSize);
        if (state.page < maxPage) {
            state.page++;
            renderNotes();
        }
    });
}

/**
 * Apply filters to notes
 */
function applyFilters() {
    let filtered = [...state.notes];

    // Apply export filter
    if (state.filter === "exported") {
        filtered = filtered.filter(note => note.nlm && note.nlm.notebookRef);
    } else if (state.filter === "not-exported") {
        filtered = filtered.filter(note => !note.nlm || !note.nlm.notebookRef);
    }

    // Apply search
    if (state.searchQuery) {
        filtered = filtered.filter(note => {
            const title = (note.title || "").toLowerCase();
            const selection = (note.selection || "").toLowerCase();
            const url = (note.url || "").toLowerCase();
            const tags = (note.tags || []).join(" ").toLowerCase();
            const notebook = (note.nlm?.notebookRef || "").toLowerCase();

            return title.includes(state.searchQuery) ||
                selection.includes(state.searchQuery) ||
                url.includes(state.searchQuery) ||
                tags.includes(state.searchQuery) ||
                notebook.includes(state.searchQuery);
        });
    }

    state.filteredNotes = filtered;
}

/**
 * Render notes to the grid
 */
function renderNotes() {
    const container = document.getElementById("notes-container");
    const pagination = document.getElementById("pagination");

    if (state.filteredNotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>${atomMsg("mem_empty_title", null, "No notes found")}</h2>
                <p>${atomMsg("mem_empty_desc", null, "Start reading and saving highlights to build your memory.")}</p>
            </div>
        `;
        pagination.style.display = "none";
        return;
    }

    // Pagination
    const totalPages = Math.ceil(state.filteredNotes.length / state.pageSize);
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    const pageNotes = state.filteredNotes.slice(start, end);

    // Render notes
    container.innerHTML = pageNotes.map(note => renderNoteCard(note)).join("");

    // Update pagination UI
    pagination.style.display = "flex";
    document.getElementById("page-info").textContent = `${state.page} / ${totalPages}`;
    document.getElementById("btn-prev").disabled = state.page <= 1;
    document.getElementById("btn-next").disabled = state.page >= totalPages;

    // Attach event listeners to action buttons
    attachNoteActions();
}

/**
 * Render a single note card
 */
function renderNoteCard(note) {
    const date = new Date(note.created_at || Date.now());
    const dateStr = date.toLocaleDateString(navigator.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    const domain = getDomain(note.url);
    const isExported = note.nlm && note.nlm.notebookRef;
    const exportedClass = isExported ? "exported" : "";

    // Tags HTML
    const tagsHtml = (note.tags || []).map(tag =>
        `<span class="note-tag">#${escapeHtml(tag)}</span>`
    ).join("");

    // Selection preview (truncated)
    const selection = note.selection || "";
    const selectionPreview = selection.length > 300
        ? selection.substring(0, 300) + "..."
        : selection;

    // AI Result
    const aiResult = note.result?.summary || note.result?.critique || note.result?.quiz || "";
    const aiHtml = aiResult ? `
        <div class="note-ai-result">
            <div class="note-ai-label">${atomMsg("mem_ai_insight", null, "AI Insight")}</div>
            <div>${escapeHtml(aiResult.substring(0, 200))}${aiResult.length > 200 ? "..." : ""}</div>
        </div>
    ` : "";

    // NLM Badge
    const nlmBadgeHtml = isExported ? `
        <div class="nlm-badge" title="${atomMsg("mem_exported_to", null, "Exported to")} ${escapeHtml(note.nlm.notebookRef)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span>${escapeHtml(note.nlm.notebookRef)}</span>
        </div>
    ` : "";

    // Actions
    const openNlmBtn = isExported ? `
        <button class="note-btn primary" data-action="open-nlm" data-url="${escapeHtml(note.nlm.notebookUrl || "")}" data-ref="${escapeHtml(note.nlm.notebookRef || "")}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            ${atomMsg("mem_btn_open_nlm", null, "Open in NotebookLM")}
        </button>
    ` : "";

    const copyQuestionBtn = note.nlm?.suggestedQuestion ? `
        <button class="note-btn" data-action="copy-question" data-question="${escapeHtml(note.nlm.suggestedQuestion)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            ${atomMsg("mem_btn_copy_question", null, "Copy Question")}
        </button>
    ` : "";

    const copySelectionBtn = selection ? `
        <button class="note-btn" data-action="copy-selection" data-text="${escapeHtml(selection)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            ${atomMsg("mem_btn_copy", null, "Copy")}
        </button>
    ` : "";

    const openSourceBtn = note.url ? `
        <button class="note-btn" data-action="open-source" data-url="${escapeHtml(note.url)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            ${atomMsg("mem_btn_source", null, "Source")}
        </button>
    ` : "";

    return `
        <div class="note-card ${exportedClass}" data-note-id="${note.id}">
            <div class="note-header">
                <div class="note-title">
                    ${note.url ? `<a href="${escapeHtml(note.url)}" target="_blank" rel="noopener">${escapeHtml(note.title || "Untitled")}</a>` : escapeHtml(note.title || "Untitled")}
                </div>
                ${nlmBadgeHtml}
            </div>

            <div class="note-meta">
                <span class="note-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    ${dateStr}
                </span>
                ${domain ? `
                <span class="note-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    ${escapeHtml(domain)}
                </span>
                ` : ""}
                ${note.command ? `
                <span class="note-meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    ${formatCommand(note.command)}
                </span>
                ` : ""}
            </div>

            ${tagsHtml ? `<div class="note-tags">${tagsHtml}</div>` : ""}

            ${selectionPreview ? `
            <div class="note-selection" data-full="${escapeHtml(selection)}">
                "${escapeHtml(selectionPreview)}"
                ${selection.length > 300 ? '<div class="note-selection-fade"></div>' : ""}
            </div>
            ` : ""}

            ${aiHtml}

            <div class="note-actions">
                ${openNlmBtn}
                ${copyQuestionBtn}
                ${copySelectionBtn}
                ${openSourceBtn}
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to note action buttons
 */
function attachNoteActions() {
    // Open NotebookLM
    document.querySelectorAll('[data-action="open-nlm"]').forEach(btn => {
        btn.addEventListener("click", async () => {
            const url = btn.dataset.url;
            const ref = btn.dataset.ref;

            if (url) {
                // Log open-to-recall event
                try {
                    await chrome.runtime.sendMessage({
                        type: "NLM_LOG_EVENT",
                        event: "nlm_bridge.open_to_recall",
                        context: { notebookRef: ref, notebookUrl: url }
                    });
                } catch (e) {
                    // Ignore
                }

                chrome.tabs.create({ url });
                showToast(atomMsg("mem_toast_opened_nlm", null, "Opened NotebookLM"));
            } else {
                // Fallback: open NotebookLM homepage
                chrome.tabs.create({ url: "https://notebooklm.google.com" });
            }
        });
    });

    // Copy Question
    document.querySelectorAll('[data-action="copy-question"]').forEach(btn => {
        btn.addEventListener("click", async () => {
            const question = btn.dataset.question;
            if (question) {
                await copyToClipboard(question);
                showToast(atomMsg("mem_toast_copied_question", null, "Question copied!"));
            }
        });
    });

    // Copy Selection
    document.querySelectorAll('[data-action="copy-selection"]').forEach(btn => {
        btn.addEventListener("click", async () => {
            const text = btn.dataset.text;
            if (text) {
                await copyToClipboard(text);
                showToast(atomMsg("mem_toast_copied", null, "Copied to clipboard!"));
            }
        });
    });

    // Open Source
    document.querySelectorAll('[data-action="open-source"]').forEach(btn => {
        btn.addEventListener("click", () => {
            const url = btn.dataset.url;
            if (url) {
                chrome.tabs.create({ url });
            }
        });
    });

    // Expand selection on click
    document.querySelectorAll(".note-selection").forEach(el => {
        el.addEventListener("click", () => {
            el.classList.toggle("expanded");
        });
    });
}

/**
 * Update stats display
 */
function updateStats() {
    const total = state.notes.length;
    const exported = state.notes.filter(n => n.nlm && n.nlm.notebookRef).length;

    // Count notes from this week
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = state.notes.filter(n => (n.created_at || 0) >= weekAgo).length;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-exported").textContent = exported;
    document.getElementById("stat-week").textContent = thisWeek;
}

/**
 * Helper: Get domain from URL
 */
function getDomain(url) {
    if (!url) return "";
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

/**
 * Helper: Format command name
 */
function formatCommand(command) {
    if (!command) return "";
    return command
        .replace(/^atom-reading-/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

/**
 * Helper: Copy to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        // Fallback
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
    }
}

/**
 * Show toast notification
 */
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}
