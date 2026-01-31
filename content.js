// content.js - FIXED: OPT-IN JOURNAL & EVENT LISTENER BUG
(async () => {
    console.log("🔥 ATOM content.js injected", window.location.href);
    if (window.top !== window) {
        return;
    }

    if (!window.__ATOM_READING_QUEUE__) {
        window.__ATOM_READING_QUEUE__ = [];
    }
    if (!window.__ATOM_READING_SEEN__) {
        window.__ATOM_READING_SEEN__ = new Set();
    }
    if (!window.__ATOM_READING_LISTENER__) {
        window.__ATOM_READING_LISTENER__ = true;
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message?.type === "ATOM_READING_RESULT") {
                const payload = message.payload || {};
                if (typeof window.__ATOM_READING_DISPATCH__ === "function") {
                    window.__ATOM_READING_DISPATCH__(payload);
                } else {
                    window.__ATOM_READING_QUEUE__.push(payload);
                }
                sendResponse({ ok: true });
                return true;
            }
            if (message?.type === "ATOM_READING_EVAL_RESULT") {
                if (typeof window.__ATOM_READING_EVAL_DISPATCH__ === "function") {
                    window.__ATOM_READING_EVAL_DISPATCH__(message.payload || {});
                }
                sendResponse({ ok: true });
                return true;
            }
            if (message?.type === "ATOM_I18N_UPDATE") {
                if (typeof window.__ATOM_READING_I18N_REFRESH__ === "function") {
                    window.__ATOM_READING_I18N_REFRESH__();
                }
                sendResponse({ ok: true });
                return true;
            }
        });
    }

    // ✅ GUARD: tránh inject/khởi chạy nhiều lần trên cùng 1 frame
    if (window.__ATOM_CONTENT_STARTED__) {
        console.log("ATOM: content already started");
        return;
    }
    window.__ATOM_CONTENT_STARTED__ = true;

    let atomMsg = (key, substitutions, fallback) =>
        chrome.i18n.getMessage(key, substitutions) || fallback || key;
    const i18nReady = (async () => {
        try {
            const mod = await import(chrome.runtime.getURL("i18n_bridge.js"));
            await mod.initI18n();
            atomMsg = (key, substitutions, fallback) => mod.getMessage(key, substitutions, fallback);
        } catch (e) {
            console.warn("ATOM: i18n override unavailable", e);
        }
    })();

    await i18nReady;
    // --- 0. KHỞI TẠO ---
    // ===== AI-PILOT CONFIG (optional) =====
    let __ATOM_AI_PILOT_CFG__ = {
        enabled: false,
        accuracyLevel: "balanced", // "balanced" | "high"
        maxViewportChars: 1200,
        maxSelectedChars: 400
    };
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "ATOM_AI_PILOT_CONFIG" && msg?.payload) {
            __ATOM_AI_PILOT_CFG__ = { ...__ATOM_AI_PILOT_CFG__, ...msg.payload };
        }
    });

    let sessionStartTime = Date.now();
    let isInterventionActive = false;
    let isJournalActive = false;
    let microRenderer = null;
    let activeScrollSeconds = 0;   // Tổng thời gian lướt thực tế (tích lũy)
    let totalPixelsScrolled = 0;   // [NEW] Biến đếm tổng pixel đã cuộn
    let lastScrollY = window.scrollY; // [NEW] Mốc vị trí cuộn trước đó
    let lastActivityTime = Date.now(); // Thời điểm cuối cùng user tương tác
    let lastInteractionTime = Date.now(); // [NEW] Thời điểm tương tác thực (không tính mousemove)
    let pendingMicroClosureTimer = null; // [NEW] Timer chờ Idle Trigger
    let lastTickAt = Date.now();
    const IDLE_THRESHOLD = 7000;   // 7 giây không làm gì -> Coi là đang nghỉ (không tính giờ)
    const SESSION_RESET_TIME = 60000; // 60 giây nghỉ -> Reset phiên (coi như lướt lại từ đầu)
    const microRendererReady = (async () => {
        try {
            const src = chrome.runtime.getURL('MicroClosureRenderer.js');
            const module = await import(src);
            microRenderer = new module.MicroClosureRenderer();
            console.log("ATOM: MicroClosureRenderer loaded successfully.");
        } catch (err) {
            console.error("ATOM: Failed to load MicroClosureRenderer", err);
            microRenderer = null;
        }
    })();
    let breathTimer1, breathTimer2;
    let tapAutoDismissTimer;      // Timer đếm ngược 5s
    let breathDismissTimer;
    let shouldShowJournal = true; // Biến cờ: Có hiện nhật ký hay không?

    // ===== AI-PILOT OBS FRAME (rolling 60s) =====
    const FRAME_WINDOW_MS = 60000;
    const MAX_VIEWPORT_SNIPPET = 1200;
    const MAX_SELECTED_SNIPPET = 400;
    const MAX_HEADING_COUNT = 6;

    let lastScrollEventAt = Date.now();
    let lastScrollDelta = 0;
    let prevScrollDelta = 0;

    const scrollEvents = []; // { t, delta }
    const dwellEvents = [];  // { t, ms }
    const activeEvents = []; // { t, dt }
    const directionChangeEvents = []; // { t }
    const scrollBackEvents = []; // { t }

    const actionEvents = {
        select: [],
        copy: [],
        find: [],
        openLink: [],
        nav: [],
        typing: []
    };

    const pruneTimed = (arr, now) => {
        while (arr.length && now - arr[0].t > FRAME_WINDOW_MS) arr.shift();
    };

    const pruneTs = (arr, now) => {
        while (arr.length && now - arr[0] > FRAME_WINDOW_MS) arr.shift();
    };

    const recordAction = (type) => {
        const now = Date.now();
        const list = actionEvents[type];
        if (!list) return;
        list.push(now);
        pruneTs(list, now);
    };

    const countActions = (type, now) => {
        const list = actionEvents[type];
        if (!list) return 0;
        pruneTs(list, now);
        return list.length;
    };

    const sanitizeSnippet = (text) => {
        if (!text) return "";
        return text
            .replace(/\b\d{6,}\b/g, "[number]")
            .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig, "[email]")
            .replace(/\s+/g, " ")
            .trim();
    };

    const normalizeUrlParts = (url) => {
        try {
            const u = new URL(url);
            return {
                url: u.href,
                domain: u.hostname.replace(/^www\./, "").toLowerCase(),
                path: u.pathname || "/"
            };
        } catch {
            return { url: url || "", domain: "", path: "" };
        }
    };

    const collectHeadingSample = () => {
        const nodes = document.querySelectorAll("h1, h2, h3");
        const out = [];
        for (const node of nodes) {
            if (out.length >= MAX_HEADING_COUNT) break;
            const text = (node.textContent || "").replace(/\s+/g, " ").trim();
            if (text) out.push(text.slice(0, 80));
        }
        return out;
    };

    const isElementVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (!style || style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
        if (rect.right < 0 || rect.left > window.innerWidth) return false;
        return true;
    };

    const collectViewportText = (maxChars, ctx = {}) => {
        let out = "";
        if (!document.body) return out;
        if (ctx.isFocusBlockActive || ctx.isInterventionActive || ctx.isJournalActive) return out;

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const text = node.textContent;
                    if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (parent.closest("input, textarea, [contenteditable='true']")) return NodeFilter.FILTER_REJECT;
                    if (parent.getAttribute("aria-hidden") === "true") return NodeFilter.FILTER_REJECT;
                    if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        while (walker.nextNode() && out.length < maxChars) {
            const chunk = walker.currentNode.textContent.replace(/\s+/g, " ").trim();
            if (!chunk) continue;
            if (out.length) out += " ";
            out += chunk;
        }

        return sanitizeSnippet(out.slice(0, maxChars));
    };

    const getSelectedText = () => {
        const sel = window.getSelection();
        const text = sel ? sel.toString() : "";
        return sanitizeSnippet(text.slice(0, MAX_SELECTED_SNIPPET));
    };

    const estimateWordCount = (text) => {
        if (!text) return 0;
        const parts = text.trim().split(/\s+/);
        return parts[0] ? parts.length : 0;
    };

    const detectPageType = () => {
        const url = window.location.href || "";
        if (url.toLowerCase().endsWith(".pdf")) return "pdf";
        if (document.querySelector("embed[type='application/pdf'], object[type='application/pdf']")) return "pdf";
        if (document.querySelector("video")) return "video";
        const feed = document.querySelector("[role='feed']");
        if (feed) return "feed";
        const articleCount = document.querySelectorAll("article").length;
        if (articleCount >= 1) return "article";
        const commentNodes = document.querySelectorAll("[class*='comment'], [id*='comment']").length;
        if (commentNodes >= 8) return "forum";
        return "unknown";
    };

    const buildObservationFrameV2 = () => {
        const now = Date.now();

        pruneTimed(scrollEvents, now);
        pruneTimed(dwellEvents, now);
        pruneTimed(activeEvents, now);
        pruneTimed(directionChangeEvents, now);
        pruneTimed(scrollBackEvents, now);

        const scrollPxTotal = scrollEvents.reduce((acc, e) => acc + Math.abs(e.delta), 0);
        const scrollPxPerSec = Math.round(scrollPxTotal / 60);
        const continuousScrollSec = Math.round(activeEvents.reduce((acc, e) => acc + e.dt, 0));

        const dwellValues = dwellEvents.map(e => e.ms);
        const dwellMeanMs = dwellValues.length
            ? Math.round(dwellValues.reduce((a, b) => a + b, 0) / dwellValues.length)
            : 0;
        let dwellP90Ms = 0;
        if (dwellValues.length) {
            const sorted = [...dwellValues].sort((a, b) => a - b);
            const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
            dwellP90Ms = sorted[idx] || 0;
        }

        const idleSec = Math.min(60, Math.round((now - lastActivityTime) / 1000));

        const includeSnippet = __ATOM_AI_PILOT_CFG__.enabled && __ATOM_AI_PILOT_CFG__.accuracyLevel === "high";
        const viewportMax = __ATOM_AI_PILOT_CFG__.maxViewportChars || MAX_VIEWPORT_SNIPPET;
        const selectedMax = __ATOM_AI_PILOT_CFG__.maxSelectedChars || MAX_SELECTED_SNIPPET;
        const viewportText = includeSnippet
            ? collectViewportText(viewportMax, { isFocusBlockActive, isInterventionActive, isJournalActive })
            : "";
        let selectedText = "";
        if (includeSnippet) {
            const liveSel = getSelectedText();
            selectedText = (liveSel || "").slice(0, selectedMax);
        }
        const { url, domain, path } = normalizeUrlParts(window.location.href);
        const headingSample = includeSnippet ? collectHeadingSample() : [];
        const pageType = detectPageType();
        const wordCountApprox = includeSnippet ? estimateWordCount(viewportText) : 0;

        return {
            v: 2,
            ts: now,
            tabId: null,
            page: {
                url,
                domain,
                path,
                title: (document.title || "").slice(0, 200),
                lang: document.documentElement?.lang || "",
                pageType,
                isInfiniteScrollLikely: document.body ? document.body.scrollHeight > window.innerHeight * 3 : false,
                hasVideoLikely: !!document.querySelector("video"),
                wordCountApprox,
                headingSample
            },
            snippet: {
                viewportText,
                viewportTextChars: viewportText.length,
                selectedText,
                selectedTextChars: selectedText.length
            },
            behavior_60s: {
                dwellMeanMs,
                dwellP90Ms,
                scrollPxTotal,
                scrollPxPerSec,
                continuousScrollSec,
                directionChanges: directionChangeEvents.length,
                scrollBackEvents: scrollBackEvents.length,
                idleSec
            },
            actions_60s: {
                selectCount: countActions("select", now),
                copyCount: countActions("copy", now),
                findCount: countActions("find", now),
                openLinkCount: countActions("openLink", now),
                backForwardCount: countActions("nav", now),
                typingCount: countActions("typing", now)
            },
            state: {
                focusEnabled: atomFocusPhase !== null,
                focusPhase: atomFocusPhase || null,
                focusAllowRemainingSec: null,
                atomSensitivity: null,
                lastInterventionType: null,
                lastInterventionAgoSec: null,
                resistanceScore: null
            }
        };
    };

    // ===== ATOM FOCUS (Pomodoro) =====
    let isFocusBlockActive = false;
    let atomFocusPhase = null; // [NEW] Track active phase locally
    let lastFocusUrl = location.href;
    let focusRecheckTimer = null;
    let focusAllowTimer = null;

    // expose hook để gọi lại sau hard-interrupt
    // expose hook để gọi lại sau hard-interrupt
    window.__ATOM_FOCUS_ENFORCE__ = (reason) => {
        requestEnforce(reason);
    };

    // [NEW] Debounce Enforce Logic
    let enforceTimer = null;
    function requestEnforce(reason) {
        if (enforceTimer) return; // Ignore if pending
        enforceTimer = setTimeout(() => {
            enforceTimer = null;
            enforceFocusIfNeeded(reason).catch(() => { });
        }, 100); // 100ms debounce
    }

    // [NEW] Triggers for "Turning Back"
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) requestEnforce("visible");
    });
    window.addEventListener("focus", () => requestEnforce("window_focus"));
    window.addEventListener("pageshow", () => requestEnforce("pageshow"));
    window.addEventListener("popstate", () => {
        recordAction("nav");
        requestEnforce("nav_popstate");
    });
    window.addEventListener("hashchange", () => {
        recordAction("nav");
        requestEnforce("nav_hashchange");
    });

    // [NEW] Handle Ping from Background
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === "ATOM_FOCUS_PING") {
            requestEnforce("ping");
        }
    });

    // ===== ATOM: Anti carry-over reset =====
    // --- 5. ANTI CARRY-OVER RESET (Robust Implementation) ---
    // Giúp reset session nếu user quay lại sau một khoảng thời gian dài (8s)

    const REENTRY_RESET_GAP_MS = 20000;
    let lastInactiveAt = null;

    function resetScrollSession(reason) {
        console.log(`%c[ATOM] resetScrollSession: ${reason}`, "color: #ff9800; font-weight: bold;");
        activeScrollSeconds = 0;
        totalPixelsScrolled = 0;
        // Reset lastTickAt để tránh tính dt quá lớn cho tick tiếp theo
        lastTickAt = Date.now();

        // Nếu đang có micro-closure thì xóa luôn để không hiện oan
        if (microRenderer && microRenderer.isVisible) {
            microRenderer.remove();
        }
        // [NEW] Cleanup pending timer
        if (pendingMicroClosureTimer) {
            clearTimeout(pendingMicroClosureTimer);
            pendingMicroClosureTimer = null;
        }
    }

    function maybeReset(reason) {
        if (lastInactiveAt == null) return;
        const gap = Date.now() - lastInactiveAt;
        if (gap > REENTRY_RESET_GAP_MS) {
            resetScrollSession(`${reason} gap ${gap}ms`);
        }
        lastInactiveAt = null; // chặn reset kép (focus + reentry)
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            lastInactiveAt = Date.now();
        } else {
            maybeReset("reentry");
        }
    });

    window.addEventListener("focus", () => {
        // focus rất noisy -> chỉ dùng như fallback nếu đã inactive
        if (lastInactiveAt != null) maybeReset("focus");
    });

    window.addEventListener("blur", () => {
        // blur cũng noisy -> chỉ set nếu thật sự hidden
        setTimeout(() => {
            if (document.hidden) lastInactiveAt = Date.now();
        }, 0);
    });
    // --- [LOG V2] Intervention session tracking (SHOWN <-> REACTION) ---
    let currentIntervention = null;

    function makeInterventionId() {
        return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }

    function emitAtomEvent(event, mode, extra = {}) {
        const payload = {
            event, // "SHOWN" | "REACTION"
            mode,  // "BREATH" | "TAP" | "STILLNESS" | ...
            ...extra,
        };

        // Log ngay trong console của page để bạn nhìn thấy
        console.log(`[ATOM EVT] ${event} | ${mode}`, payload);

        // Gửi về background để lưu (analytics)
        chrome.runtime.sendMessage(
            { type: "LOG_EVENT", payload },
            (ack) => {
                if (chrome.runtime.lastError) {
                    // console.warn("ATOM LOG_EVENT failed:", chrome.runtime.lastError.message);
                } else {
                    console.log("[ATOM LOG_EVENT ACK]", ack);
                }
            }
        );
    }

    // --- 1. SETUP UI ---
    const host = document.createElement('div');
    host.id = 'atom-extension-root';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const styleLink = document.createElement('link');
    styleLink.setAttribute('rel', 'stylesheet');
    styleLink.setAttribute('href', chrome.runtime.getURL('styles.css'));
    shadow.appendChild(styleLink);

    // 1.1 Overlay Chặn
    const overlay = document.createElement('div');
    overlay.id = 'atom-overlay';
    overlay.innerHTML = `
  <div id="ui-breath" class="ui-mode hidden">
    <div class="breath-circle" id="breath-circle">
        <div class="core-light"></div>
        <!-- Minimalist Breath Icon -->
        <svg class="breath-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
            <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
            <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
        </svg>
    </div>
    <div class="hint-text" id="breath-text">...</div>
  </div>

  <div id="ui-taphold" class="ui-mode hidden" style="flex-direction:column; align-items:center;">
    <div class="tap-circle" id="tap-btn">
        <!-- Background Circle Stroked -->
        <svg class="ring-svg" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="58" stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="none"></circle>
            <circle class="progress-ring-circle" id="progress-ring" cx="60" cy="60" r="58" stroke-dasharray="364" stroke-dashoffset="364"></circle>
        </svg>
        <!-- Lucide Hand Icon (Path only) -->
        <svg class="tap-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 11.25v-3.75a3.75 3.75 0 1 0-7.5 0v10.5h-1.5a2.25 2.25 0 0 0-2.25 2.25v.75a2.25 2.25 0 0 0 2.25 2.25h10.5a3.75 3.75 0 0 0 3.75-3.75v-6a3.75 3.75 0 0 0-3.75-3.75H15.75Z"/>
        </svg>
    </div>
    <div class="hint-text" id="tap-text">${atomMsg("ui_tap_hold")}</div>
  </div>

  <div id="ui-stillness" class="ui-mode hidden" style="flex-direction:column; align-items:center;">
    <div class="still-circle">
        <svg class="ring-svg" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="78" stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="none"></circle>
            <circle id="stillness-ring" class="progress-ring-circle" cx="80" cy="80" r="78" stroke-dasharray="490" stroke-dashoffset="0"></circle>
        </svg>
        <div class="still-timer-text" id="stillness-timer">7</div>
    </div>
    <div class="hint-text" id="stillness-text">${atomMsg("ui_stillness_hint")}</div>
  </div>
`;
    shadow.appendChild(overlay);

    // 1.2 Presence Orb
    const presenceOrb = document.createElement('div');
    presenceOrb.id = 'atom-presence-orb';
    presenceOrb.innerHTML = '<div class="orb-core-light"></div>';
    shadow.appendChild(presenceOrb);

    // 1.3 Active Reading Stack (mini neon companion)
    const readingStack = document.createElement('div');
    readingStack.id = 'atom-reading-stack';
    shadow.appendChild(readingStack);

    const readingVault = document.createElement('div');
    readingVault.id = 'atom-reading-vault';
    readingVault.innerHTML = `
    <div class="reading-vault-header">
        <div class="reading-vault-title">ATOM - Reading Vault</div>
        <button class="reading-vault-close" type="button" aria-label="Close">x</button>
    </div>
    <div class="reading-vault-empty"></div>
    <div class="reading-vault-list"></div>
    `;
    shadow.appendChild(readingVault);

    const msg = (key, fallback) => {
        const value = atomMsg(key);
        return value || fallback || key;
    };

    const readingVaultTitle = readingVault.querySelector('.reading-vault-title');
    readingVaultTitle.textContent = msg("reading_vault_title", "ATOM - Reading Vault");
    const readingVaultClose = readingVault.querySelector('.reading-vault-close');
    const readingVaultList = readingVault.querySelector('.reading-vault-list');
    const readingVaultEmpty = readingVault.querySelector('.reading-vault-empty');

    const MAX_READING_CARDS = 3;
    const READING_CARD_LIFETIME_MS = 20000;

    const readingLabels = {
        points: msg("reading_card_key_points", "Key points"),
        questions: msg("reading_card_questions", "Questions"),
        summaryFallback: msg("reading_card_summary_fallback", "No summary available."),
        answerPlaceholder: msg("reading_card_answer_placeholder", "Type your answer..."),
        evalTitle: msg("reading_card_eval_title", "Evaluation"),
        evalAction: msg("reading_card_eval_action", "Evaluate answers"),
        evalPending: msg("reading_card_eval_pending", "Evaluating..."),
        save: msg("reading_card_save", "Save"),
        saved: msg("reading_card_saved", "Saved"),
        openVault: msg("reading_card_open_vault", "Open Vault"),
        vaultEmpty: msg("reading_vault_empty", "No reading notes yet.")
    };
    const readingLabelsRef = readingLabels;

    function formatReadingMode(command) {
        const map = {
            "atom-reading-summarize": msg("reading_mode_summary", "Summary"),
            "atom-reading-critique": msg("reading_mode_critique", "Critique"),
            "atom-reading-quiz": msg("reading_mode_quiz", "Quiz")
        };
        return map[command] || msg("reading_mode_summary", "Summary");
    }

    function fillList(listEl, items) {
        listEl.textContent = "";
        items.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            listEl.appendChild(li);
        });
    }

    function fillQuestionList(listEl, items, placeholder) {
        listEl.textContent = "";
        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'reading-card-question-item';

            const question = document.createElement('div');
            question.className = 'reading-card-question-text';
            question.textContent = item;

            const input = document.createElement('textarea');
            input.className = 'reading-card-question-input';
            input.rows = 2;
            input.placeholder = placeholder;

            // [FIX] Stop propagation to prevent page hotkeys (e.g. YouTube spacebar)
            input.addEventListener('keydown', (e) => e.stopPropagation());
            input.addEventListener('keypress', (e) => e.stopPropagation());
            input.addEventListener('keyup', (e) => e.stopPropagation());

            li.appendChild(question);
            li.appendChild(input);
            listEl.appendChild(li);
        });
    }

    function removeReadingCard(card) {
        card.classList.remove('state-visible');
        setTimeout(() => card.remove(), 250);
    }

    let nlmConfirmOverlay = null;
    let nlmConfirmProceed = null;
    let nlmConfirmCancel = null;
    let nlmConfirmTypes = null;
    let nlmConfirmTitle = null;
    let nlmConfirmDesc = null;
    let nlmToast = null;
    let nlmToastTimer = null;
    let nlmActionToast = null;
    let nlmActionTimer = null;
    let geminiKeyAvailable = null;

    function ensureNlmConfirmUI() {
        if (nlmConfirmOverlay) return;
        nlmConfirmOverlay = document.createElement('div');
        nlmConfirmOverlay.className = 'nlm-confirm-overlay';
        nlmConfirmOverlay.innerHTML = `
            <div class="nlm-confirm-card">
                <div class="nlm-confirm-title"></div>
                <div class="nlm-confirm-desc"></div>
                <div class="nlm-confirm-types"></div>
                <div class="nlm-confirm-actions">
                    <button type="button" class="nlm-confirm-cancel"></button>
                    <button type="button" class="nlm-confirm-proceed"></button>
                </div>
            </div>
        `;
        shadow.appendChild(nlmConfirmOverlay);
        nlmConfirmTitle = nlmConfirmOverlay.querySelector('.nlm-confirm-title');
        nlmConfirmDesc = nlmConfirmOverlay.querySelector('.nlm-confirm-desc');
        nlmConfirmTypes = nlmConfirmOverlay.querySelector('.nlm-confirm-types');
        nlmConfirmProceed = nlmConfirmOverlay.querySelector('.nlm-confirm-proceed');
        nlmConfirmCancel = nlmConfirmOverlay.querySelector('.nlm-confirm-cancel');
        nlmConfirmOverlay.addEventListener('click', (e) => {
            if (e.target === nlmConfirmOverlay) {
                nlmConfirmOverlay.classList.remove('is-visible');
            }
        });
    }

    function showNlmConfirmModal(piiSummary, onProceed, onCancel) {
        ensureNlmConfirmUI();
        const types = Array.isArray(piiSummary?.types) ? piiSummary.types : [];
        const labels = {
            email: atomMsg("nlm_pii_type_email", null, "Email"),
            phone: atomMsg("nlm_pii_type_phone", null, "Phone"),
            id: atomMsg("nlm_pii_type_id", null, "ID")
        };
        const typeText = types.length ? types.map((t) => labels[t] || t).join(", ") : atomMsg("nlm_pii_type_unknown", null, "Sensitive data");
        if (nlmConfirmTitle) nlmConfirmTitle.textContent = atomMsg("nlm_pii_title", null, "Potential sensitive data detected");
        if (nlmConfirmDesc) nlmConfirmDesc.textContent = atomMsg("nlm_pii_desc", null, "This clip may contain sensitive information. Do you want to export anyway?");
        if (nlmConfirmTypes) nlmConfirmTypes.textContent = typeText;
        if (nlmConfirmCancel) nlmConfirmCancel.textContent = atomMsg("nlm_pii_cancel", null, "Cancel");
        if (nlmConfirmProceed) nlmConfirmProceed.textContent = atomMsg("nlm_pii_proceed", null, "Proceed");

        if (nlmConfirmCancel) {
            nlmConfirmCancel.onclick = () => {
                nlmConfirmOverlay.classList.remove('is-visible');
                if (typeof onCancel === "function") onCancel();
            };
        }
        if (nlmConfirmProceed) {
            nlmConfirmProceed.onclick = () => {
                nlmConfirmOverlay.classList.remove('is-visible');
                if (typeof onProceed === "function") onProceed();
            };
        }
        nlmConfirmOverlay.classList.add('is-visible');
    }

    function ensureNlmToast() {
        if (nlmToast) return;
        nlmToast = document.createElement('div');
        nlmToast.className = 'nlm-toast';
        shadow.appendChild(nlmToast);
    }

    function showNlmToast(message, tone = "neutral") {
        ensureNlmToast();
        nlmToast.textContent = message;
        nlmToast.classList.remove('is-success', 'is-error');
        if (tone === "success") nlmToast.classList.add('is-success');
        if (tone === "error") nlmToast.classList.add('is-error');
        nlmToast.classList.add('is-visible');
        if (nlmToastTimer) clearTimeout(nlmToastTimer);
        nlmToastTimer = setTimeout(() => {
            nlmToast.classList.remove('is-visible');
        }, 2200);
    }

    function ensureNlmActionToast() {
        if (nlmActionToast) return;
        nlmActionToast = document.createElement('div');
        nlmActionToast.className = 'nlm-toast nlm-toast-action';
        nlmActionToast.innerHTML = `
            <span class="nlm-toast-action-text"></span>
            <button type="button" class="nlm-toast-action-btn"></button>
        `;
        shadow.appendChild(nlmActionToast);
    }

    function showNlmActionToast(message, actionLabel, onAction) {
        ensureNlmActionToast();
        const textEl = nlmActionToast.querySelector('.nlm-toast-action-text');
        const btnEl = nlmActionToast.querySelector('.nlm-toast-action-btn');
        if (textEl) textEl.textContent = message;
        if (btnEl) btnEl.textContent = actionLabel || "Retry now";
        if (btnEl) btnEl.onclick = () => {
            nlmActionToast.classList.remove('is-visible');
            if (typeof onAction === "function") onAction();
        };
        nlmActionToast.classList.add('is-visible');
        if (nlmActionTimer) clearTimeout(nlmActionTimer);
        nlmActionTimer = setTimeout(() => {
            nlmActionToast.classList.remove('is-visible');
        }, 6000);
    }

    async function getGeminiKeyAvailable() {
        if (geminiKeyAvailable !== null) return geminiKeyAvailable;
        return new Promise((resolve) => {
            chrome.storage.local.get(['user_gemini_key'], (res) => {
                geminiKeyAvailable = !!res.user_gemini_key;
                resolve(geminiKeyAvailable);
            });
        });
    }

    function triggerNotebookLmExport(nlmPayload) {
        if (!nlmPayload) return;
        if (nlmPayload.reason === "pii_warning") {
            const jobId = nlmPayload.jobId;
            const nonce = nlmPayload.nonce;
            showNlmConfirmModal(nlmPayload.piiSummary, () => {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_EXPORT_CONFIRM",
                    payload: { jobId, nonce }
                }, (resp) => {
                    if (resp && resp.ok) {
                        triggerNotebookLmExport(resp);
                    } else {
                        showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                    }
                });
            }, () => {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_EXPORT_CANCEL",
                    payload: { jobId }
                }, () => {
                    // ignore response
                });
            });
            return;
        }

        const clipText = nlmPayload?.clipText || "";
        const notebookUrl = nlmPayload?.notebookUrl || "";
        const jobId = nlmPayload?.jobId || "";
        if (!clipText || !notebookUrl) return;
        navigator.clipboard.writeText(clipText).then(() => {
            showNlmToast(atomMsg("nlm_toast_copied", null, "Copied"), "success");
            chrome.runtime.sendMessage({
                type: "ATOM_NLM_OPEN_NOTEBOOK",
                payload: { url: notebookUrl, source: "export" }
            }, () => {
                showNlmToast(atomMsg("nlm_toast_opened", null, "Opened"), "success");
            });
            if (jobId) {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_EXPORT_RESULT",
                    payload: { jobId, status: "success" }
                }, () => { });
            }
        }).catch(() => {
            showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
            if (jobId) {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_EXPORT_RESULT",
                    payload: { jobId, status: "failed", error: "clipboard_denied" }
                }, () => { });
            }
        });
    }

    function showIdeaPrompt(suggestion) {
        if (!suggestion) return;
        if (shadow.getElementById("atom-nlm-idea-prompt")) return;

        const container = document.createElement("div");
        container.id = "atom-nlm-idea-prompt";
        container.className = "nlm-idea-prompt";

        const title = suggestion.displayTitle || "New Notebook";
        const reason = suggestion.reason || {};
        const metaLine = `Bundles: ${reason.totalBundles || 0} • Deep: ${reason.deepCount || 0} • Score: ${reason.engagementScore || 0}`;

        const header = document.createElement("div");
        header.className = "nlm-idea-header";

        const titleEl = document.createElement("div");
        titleEl.className = "nlm-idea-title";
        titleEl.textContent = atomMsg("nlm_idea_title", null, "Start a new notebook?");

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "nlm-idea-close";
        closeBtn.setAttribute("aria-label", "Close");
        closeBtn.textContent = "×";

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = "nlm-idea-body";

        const topicEl = document.createElement("div");
        topicEl.className = "nlm-idea-topic";
        topicEl.textContent = title;

        const metaEl = document.createElement("div");
        metaEl.className = "nlm-idea-meta";
        metaEl.textContent = metaLine;

        const descEl = document.createElement("div");
        descEl.className = "nlm-idea-desc";
        descEl.textContent = atomMsg("nlm_idea_desc", null, "You seem to be collecting ideas around this topic.");

        body.appendChild(topicEl);
        body.appendChild(metaEl);
        body.appendChild(descEl);

        const actions = document.createElement("div");
        actions.className = "nlm-idea-actions";

        const createBtn = document.createElement("button");
        createBtn.type = "button";
        createBtn.className = "nlm-idea-btn primary";
        createBtn.dataset.action = "create";
        createBtn.textContent = atomMsg("nlm_idea_create", null, "Create (Pending)");

        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "nlm-idea-btn secondary";
        openBtn.dataset.action = "open";
        openBtn.textContent = atomMsg("nlm_idea_open", null, "Open NotebookLM");

        const notNowBtn = document.createElement("button");
        notNowBtn.type = "button";
        notNowBtn.className = "nlm-idea-btn ghost";
        notNowBtn.dataset.action = "not_now";
        notNowBtn.textContent = atomMsg("nlm_idea_not_now", null, "Not now");

        const dontAskBtn = document.createElement("button");
        dontAskBtn.type = "button";
        dontAskBtn.className = "nlm-idea-btn ghost";
        dontAskBtn.dataset.action = "dont_ask";
        dontAskBtn.textContent = atomMsg("nlm_idea_dont_ask", null, "Don't ask again");

        actions.appendChild(createBtn);
        actions.appendChild(openBtn);
        actions.appendChild(notNowBtn);
        actions.appendChild(dontAskBtn);

        container.appendChild(header);
        container.appendChild(body);
        container.appendChild(actions);

        closeBtn.onclick = () => {
            container.remove();
            chrome.runtime.sendMessage({
                type: "ATOM_NLM_IDEA_ACTION",
                payload: {
                    action: "not_now",
                    topicKey: suggestion.topicKey
                }
            }, () => { });
        };

        actions.querySelectorAll("[data-action]").forEach((btn) => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_IDEA_ACTION",
                    payload: {
                        action,
                        topicKey: suggestion.topicKey,
                        displayTitle: suggestion.displayTitle,
                        keywords: suggestion.keywords || [],
                        context: suggestion.context || {}
                    }
                }, () => { });
                container.remove();
            };
        });

        shadow.appendChild(container);
        requestAnimationFrame(() => container.classList.add("is-visible"));
    }

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.type === "ATOM_NLM_RETRY_PROMPT") {
            const jobId = msg?.payload?.jobId || "";
            const noteId = msg?.payload?.noteId || "";
            showNlmActionToast(
                atomMsg("nlm_retry_toast", null, "Export pending. Click to retry."),
                atomMsg("nlm_retry_cta", null, "Retry now"),
                () => {
                    chrome.runtime.sendMessage({
                        type: "ATOM_NLM_RETRY_NOW",
                        payload: { jobId, noteId }
                    }, (resp) => {
                        if (resp?.ok && resp?.nlm) {
                            triggerNotebookLmExport(resp.nlm);
                        } else {
                            showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                        }
                    });
                }
            );
            sendResponse({ ok: true });
            return true;
        }
        if (msg?.type === "ATOM_NLM_IDEA_PROMPT") {
            showIdeaPrompt(msg.payload);
            sendResponse({ ok: true });
            return true;
        }
    });

    function renderIdeaSuggestions(suggestions, parent) {
        const list = Array.isArray(suggestions) ? suggestions.filter((s) => s?.status === "open") : [];
        if (!list.length) return;

        const section = document.createElement("div");
        section.className = "reading-vault-suggestions";

        const title = document.createElement("div");
        title.className = "reading-vault-suggestions-title";
        title.textContent = atomMsg("nlm_idea_vault_title", null, "Suggested notebooks");
        section.appendChild(title);

        list.forEach((item) => {
            const card = document.createElement("div");
            card.className = "reading-vault-suggestion-card";

            const label = document.createElement("div");
            label.className = "reading-vault-suggestion-topic";
            label.textContent = item.displayTitle || item.topicKey;

            const meta = document.createElement("div");
            meta.className = "reading-vault-suggestion-meta";
            const reason = item.reason || {};
            meta.textContent = `Bundles ${reason.totalBundles || 0} · Deep ${reason.deepCount || 0} · Score ${reason.engagementScore || 0}`;

            const actions = document.createElement("div");
            actions.className = "reading-vault-suggestion-actions";

            const createBtn = document.createElement("button");
            createBtn.type = "button";
            createBtn.className = "reading-vault-item-action";
            createBtn.textContent = atomMsg("nlm_idea_create", null, "Create (Pending)");
            createBtn.onclick = () => {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_IDEA_ACTION",
                    payload: {
                        action: "create",
                        topicKey: item.topicKey,
                        displayTitle: item.displayTitle,
                        keywords: item.keywords || [],
                        context: item.context || {}
                    }
                }, () => { });
                card.remove();
            };

            const openBtn = document.createElement("button");
            openBtn.type = "button";
            openBtn.className = "reading-vault-item-action secondary";
            openBtn.textContent = atomMsg("nlm_idea_open", null, "Open NotebookLM");
            openBtn.onclick = () => {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_IDEA_ACTION",
                    payload: {
                        action: "open",
                        topicKey: item.topicKey
                    }
                }, () => { });
            };

            const dismissBtn = document.createElement("button");
            dismissBtn.type = "button";
            dismissBtn.className = "reading-vault-item-action secondary";
            dismissBtn.textContent = atomMsg("nlm_idea_not_now", null, "Not now");
            dismissBtn.onclick = () => {
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_IDEA_ACTION",
                    payload: {
                        action: "not_now",
                        topicKey: item.topicKey
                    }
                }, () => { });
                card.remove();
            };

            actions.appendChild(createBtn);
            actions.appendChild(openBtn);
            actions.appendChild(dismissBtn);

            card.appendChild(label);
            card.appendChild(meta);
            card.appendChild(actions);

            section.appendChild(card);
        });

        parent.appendChild(section);
    }

    function renderReadingVault(notes, suggestions = []) {
        const list = Array.isArray(notes) ? notes.slice(-30).reverse() : [];
        readingVaultList.textContent = "";
        readingVaultEmpty.textContent = readingLabels.vaultEmpty;

        const hasSuggestions = Array.isArray(suggestions) && suggestions.some((s) => s?.status === "open");
        if (!list.length && !hasSuggestions) {
            readingVaultEmpty.style.display = "block";
            readingVaultList.style.display = "none";
            return;
        }

        readingVaultEmpty.style.display = "none";
        readingVaultList.style.display = "grid";
        renderIdeaSuggestions(suggestions, readingVaultList);

        list.forEach((note) => {
            const item = document.createElement('div');
            item.className = 'reading-vault-item';

            const mode = formatReadingMode(note.command);
            const title = note.title || note.url || "";
            const summary = (note.result && note.result.summary) ? note.result.summary : "";
            const time = note.created_at ? new Date(note.created_at).toLocaleString() : "";
            const answers = Array.isArray(note.answers) ? note.answers.filter((ans) => ans && ans.trim()) : [];
            const evaluation = typeof note.evaluation === "string" ? note.evaluation.trim() : "";
            const notebookRef = note?.nlm?.notebookRef || "";
            const notebookUrl = note?.nlm?.notebookUrl || "";
            const suggestedQuestion = note?.nlm?.suggestedQuestion || "";
            const exportStatus = note?.nlm?.exportStatus || "";
            const noteId = note?.id || "";

            const titleEl = document.createElement('div');
            titleEl.className = 'reading-vault-item-title';
            titleEl.textContent = mode;
            const metaEl = document.createElement('div');
            metaEl.className = 'reading-vault-item-meta';
            metaEl.textContent = time;
            const summaryEl = document.createElement('div');
            summaryEl.className = 'reading-vault-item-summary';
            summaryEl.textContent = summary;
            const sourceEl = document.createElement('div');
            sourceEl.className = 'reading-vault-item-source';
            sourceEl.textContent = title;

            item.appendChild(titleEl);
            item.appendChild(metaEl);
            item.appendChild(summaryEl);
            if (answers.length) {
                const answersEl = document.createElement('div');
                answersEl.className = 'reading-vault-item-answers';
                answersEl.textContent = answers.join(" | ");
                item.appendChild(answersEl);
            }
            if (evaluation) {
                const evalEl = document.createElement('div');
                evalEl.className = 'reading-vault-item-eval';
                evalEl.textContent = evaluation;
                item.appendChild(evalEl);
            }
            item.appendChild(sourceEl);

            const actions = document.createElement('div');
            actions.className = 'reading-vault-item-actions';

            const openBtn = document.createElement('button');
            openBtn.type = 'button';
            openBtn.className = 'reading-vault-item-action';
            openBtn.textContent = atomMsg("reading_vault_open_nlm", null, "Open NotebookLM");
            openBtn.addEventListener('click', () => {
                const url = notebookUrl || "";
                const target = url || "https://notebooklm.google.com";
                chrome.runtime.sendMessage({
                    type: "ATOM_NLM_OPEN_NOTEBOOK",
                    payload: { url: target, source: "vault" }
                }, () => { });
                showNlmToast(atomMsg("nlm_toast_opened", null, "Opened"), "success");
            });
            actions.appendChild(openBtn);

            if (noteId && (exportStatus === "needs_user_action" || exportStatus === "failed")) {
                const retryBtn = document.createElement('button');
                retryBtn.type = 'button';
                retryBtn.className = 'reading-vault-item-action secondary';
                retryBtn.textContent = atomMsg("reading_vault_retry_nlm", null, "Retry export");
                retryBtn.addEventListener('click', () => {
                    chrome.runtime.sendMessage({
                        type: "ATOM_NLM_RETRY_NOW",
                        payload: { noteId }
                    }, (resp) => {
                        if (resp?.ok && resp?.nlm) {
                            triggerNotebookLmExport(resp.nlm);
                        } else {
                            showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                        }
                    });
                });
                actions.appendChild(retryBtn);
            }

            if (suggestedQuestion) {
                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'reading-vault-item-action secondary';
                copyBtn.textContent = atomMsg("reading_vault_copy_question", null, "Copy question");
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(suggestedQuestion).then(() => {
                        showNlmToast(atomMsg("nlm_toast_copied", null, "Copied"), "success");
                    }).catch(() => {
                        showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                    });
                });
                actions.appendChild(copyBtn);
            } else if (noteId) {
                const genBtn = document.createElement('button');
                genBtn.type = 'button';
                genBtn.className = 'reading-vault-item-action secondary';
                genBtn.textContent = atomMsg("reading_vault_generate_question", null, "Generate question");
                genBtn.addEventListener('click', () => {
                    getGeminiKeyAvailable().then((hasKey) => {
                        if (!hasKey) {
                            showNlmToast(atomMsg("nlm_toast_no_key", null, "Missing API key"), "error");
                            return;
                        }
                        genBtn.disabled = true;
                        genBtn.textContent = atomMsg("reading_vault_generating", null, "Generating...");
                        chrome.runtime.sendMessage({
                            type: "ATOM_NLM_GENERATE_QUESTION",
                            payload: { noteId }
                        }, (resp) => {
                            if (chrome.runtime.lastError) {
                                genBtn.textContent = atomMsg("reading_vault_generate_failed", null, "Failed");
                                setTimeout(() => {
                                    genBtn.textContent = atomMsg("reading_vault_generate_question", null, "Generate question");
                                    genBtn.disabled = false;
                                }, 1500);
                                return;
                            }
                            if (resp && resp.ok && resp.question) {
                                const question = resp.question;
                                const copyBtn = document.createElement('button');
                                copyBtn.type = 'button';
                                copyBtn.className = 'reading-vault-item-action secondary';
                                copyBtn.textContent = atomMsg("reading_vault_copy_question", null, "Copy question");
                                copyBtn.addEventListener('click', () => {
                                    navigator.clipboard.writeText(question).then(() => {
                                        showNlmToast(atomMsg("nlm_toast_copied", null, "Copied"), "success");
                                    }).catch(() => {
                                        showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                                    });
                                });
                                actions.replaceChild(copyBtn, genBtn);
                                showNlmToast(atomMsg("nlm_toast_generated", null, "Generated"), "success");
                            } else {
                                genBtn.textContent = atomMsg("reading_vault_generate_failed", null, "Failed");
                                setTimeout(() => {
                                    genBtn.textContent = atomMsg("reading_vault_generate_question", null, "Generate question");
                                    genBtn.disabled = false;
                                }, 1500);
                                showNlmToast(atomMsg("nlm_toast_failed", null, "Failed"), "error");
                            }
                        });
                    });
                });
                actions.appendChild(genBtn);
                getGeminiKeyAvailable().then((hasKey) => {
                    if (!hasKey) {
                        genBtn.disabled = true;
                        genBtn.classList.add('is-disabled');
                        genBtn.textContent = atomMsg("reading_vault_generate_disabled", null, "API key required");
                    }
                });
            }

            item.appendChild(actions);
            readingVaultList.appendChild(item);
        });
    }

    function openReadingVault() {
        chrome.storage.local.get(['atom_reading_notes', 'atom_nlm_idea_suggestions_v1'], (result) => {
            renderReadingVault(result.atom_reading_notes || [], result.atom_nlm_idea_suggestions_v1 || []);
            readingVault.classList.add('state-visible');
        });
    }

    readingVaultClose.addEventListener('click', () => {
        readingVault.classList.remove('state-visible');
    });

    function extractSummaryFromJsonish(text) {
        if (!text || typeof text !== "string") return null;
        const keyToken = "\"summary\"";
        const keyStart = text.indexOf(keyToken);
        if (keyStart === -1) return null;
        let i = text.indexOf(":", keyStart + keyToken.length);
        if (i === -1) return null;
        i += 1;
        while (i < text.length && /\s/.test(text[i])) i += 1;
        if (text[i] !== "\"") return null;
        i += 1;
        let out = "";
        let escaped = false;
        for (; i < text.length; i += 1) {
            const ch = text[i];
            if (escaped) {
                out += ch;
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                out += ch;
                continue;
            }
            if (ch === "\"") break;
            out += ch;
        }
        return out
            .replace(/\\\\/g, "\\")
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, "\"");
    }

    function coerceReadingResult(result) {
        if (result && typeof result === "object") return result;
        if (typeof result !== "string") {
            return { summary: String(result || "") };
        }
        const trimmed = result.trim();
        const tryParse = (value) => {
            try {
                return JSON.parse(value);
            } catch {
                return null;
            }
        };
        const direct = tryParse(trimmed);
        if (direct) return direct;
        if (trimmed.startsWith("{") && trimmed.includes("\"summary\"")) {
            const summaryText = extractSummaryFromJsonish(trimmed);
            if (summaryText) {
                return {
                    summary: summaryText
                        .replace(/\\n/g, "\n")
                        .replace(/\\t/g, "\t")
                        .replace(/\\"/g, "\"")
                };
            }
        }
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            const sliced = trimmed.slice(start, end + 1);
            const extracted = tryParse(sliced);
            if (extracted) return extracted;
        }
        return { summary: trimmed };
    }

    function maybeParseSummaryAsJson(safe) {
        if (!safe || typeof safe !== "object") return safe;
        if (typeof safe.summary !== "string") return safe;
        const trimmed = safe.summary.trim();
        if (!trimmed.startsWith("{")) return safe;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
                return parsed;
            }
        } catch {
            // ignore parse failure and keep original summary
        }
        return safe;
    }

    function normalizeSummaryText(safe) {
        if (!safe || typeof safe !== "object") return safe;
        if (typeof safe.summary !== "string") return safe;
        const trimmed = safe.summary.trim();
        if (!trimmed.startsWith("{")) return safe;

        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") {
                return { ...safe, ...parsed };
            }
        } catch {
            // fall through to regex extraction
        }

        const summaryText = extractSummaryFromJsonish(trimmed);
        if (summaryText) {
            safe.summary = summaryText
                .replace(/\\n/g, "\n")
                .replace(/\\t/g, "\t")
                .replace(/\\"/g, "\"");
        }
        return safe;
    }

    function formatSummaryText(text) {
        if (!text || typeof text !== "string") return text;
        const normalized = text.replace(/\r\n/g, "\n").trim();
        if (normalized.includes("\n")) return normalized;
        return normalized.replace(/([.!?])\s+/g, "$1\n");
    }

    function parseLooseReadingText(text) {
        if (!text || typeof text !== "string") {
            return { summary: "", key_points: [], questions: [], hasSections: false };
        }

        const normalized = text.replace(/\r\n/g, "\n").trim();
        if (!normalized) {
            return { summary: "", key_points: [], questions: [], hasSections: false };
        }

        const headingMap = [
            { key: "summary", re: /^(summary|tóm tắt|tom tat|tóm lược|tom luoc)\b/i },
            { key: "key_points", re: /^(key points?|ý chính|y chinh|điểm chính|diem chinh)\b/i },
            { key: "questions", re: /^(questions?|câu hỏi|cau hoi)\b/i },
            { key: "summary", re: /^(critique|weak points?|điểm yếu|diem yeu|phê bình|phe binh)\b/i }
        ];

        const stripBullet = (line) => line
            .replace(/^[-*•\u2022]+\s+/, "")
            .replace(/^\d+[.)]\s+/, "")
            .trim();

        const detectHeading = (line) => {
            const cleaned = line.replace(/\s*[:\-–—]\s*$/, "").trim();
            for (const entry of headingMap) {
                if (entry.re.test(cleaned)) return entry.key;
            }
            return null;
        };

        const summaryLines = [];
        const keyPoints = [];
        const questions = [];
        let current = "summary";
        let hasSections = false;

        const pushLine = (target, line) => {
            const cleaned = stripBullet(line);
            if (!cleaned) return;
            if (target === "key_points") {
                keyPoints.push(cleaned);
            } else if (target === "questions") {
                questions.push(cleaned);
            } else {
                summaryLines.push(cleaned);
            }
        };

        const lines = normalized.split("\n");
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const heading = detectHeading(line);
            if (heading) {
                hasSections = true;
                current = heading;
                const inline = line.replace(/^[^:]+:\s*/, "").trim();
                if (inline && inline !== line) {
                    pushLine(current, inline);
                }
                continue;
            }
            pushLine(current, line);
        }

        const summary = summaryLines.join("\n").trim();
        return {
            summary: summary || (hasSections ? "" : normalized),
            key_points: keyPoints,
            questions,
            hasSections
        };
    }

    function mergeLooseReadingResult(safe) {
        if (!safe || typeof safe !== "object") return safe;
        if (typeof safe.summary !== "string") return safe;

        const parsed = parseLooseReadingText(safe.summary);
        if (!parsed.hasSections) return safe;

        const out = { ...safe };
        out.summary = parsed.summary || safe.summary;
        if (!Array.isArray(out.key_points) || out.key_points.length === 0) {
            out.key_points = parsed.key_points;
        }
        if (!Array.isArray(out.questions) || out.questions.length === 0) {
            out.questions = parsed.questions;
        }
        return out;
    }

    function createReadingCard(command, result, note, saved) {
        const card = document.createElement('div');
        card.className = 'atom-reading-card';
        card.innerHTML = `
        <div class="reading-card-glow"></div>
        <div class="reading-card-inner">
            <div class="reading-card-header">
                <div class="reading-card-title">${msg("reading_card_title", "ATOM - Active Reading")}</div>
                <button class="reading-card-close" type="button" aria-label="Close">x</button>
            </div>
            <div class="reading-card-meta"></div>
            <div class="reading-card-summary"></div>
            <div class="reading-card-section reading-card-points-wrap">
                <div class="reading-card-section-title">${readingLabels.points}</div>
                <ul class="reading-card-list reading-card-points"></ul>
            </div>
            <div class="reading-card-section reading-card-questions-wrap">
                <div class="reading-card-section-title">${readingLabels.questions}</div>
                <ul class="reading-card-list reading-card-questions"></ul>
            </div>
            <div class="reading-card-section reading-card-eval-wrap">
                <div class="reading-card-section-title">${readingLabels.evalTitle}</div>
                <div class="reading-card-eval"></div>
            </div>
            <div class="reading-card-actions">
                <button class="reading-card-action reading-card-save" type="button">${readingLabels.save}</button>
                <button class="reading-card-action reading-card-open" type="button">${readingLabels.openVault}</button>
                <button class="reading-card-action reading-card-eval" type="button">${readingLabels.evalAction}</button>
            </div>
        </div>
        `;

        const metaEl = card.querySelector('.reading-card-meta');
        const summaryEl = card.querySelector('.reading-card-summary');
        const pointsWrap = card.querySelector('.reading-card-points-wrap');
        const pointsEl = card.querySelector('.reading-card-points');
        const questionsWrap = card.querySelector('.reading-card-questions-wrap');
        const questionsEl = card.querySelector('.reading-card-questions');
        const evalWrap = card.querySelector('.reading-card-eval-wrap');
        const evalEl = card.querySelector('.reading-card-eval');
        const closeBtn = card.querySelector('.reading-card-close');
        const saveBtn = card.querySelector('.reading-card-save');
        const openBtn = card.querySelector('.reading-card-open');
        const evalBtn = card.querySelector('.reading-card-eval');

        const safe = mergeLooseReadingResult(
            normalizeSummaryText(maybeParseSummaryAsJson(coerceReadingResult(result)))
        );
        const summary = formatSummaryText((safe.summary || "").trim()) || readingLabels.summaryFallback;
        const keyPoints = Array.isArray(safe.key_points) ? safe.key_points.filter(Boolean) : [];
        const questions = Array.isArray(safe.questions)
            ? safe.questions.filter(Boolean).slice(0, 3)
            : [];
        const noteId = note && note.id ? note.id : "";
        const storedAnswers = Array.isArray(note?.answers) ? note.answers : [];
        const storedEval = typeof note?.evaluation === "string" ? note.evaluation : "";

        metaEl.textContent = `${formatReadingMode(command)} - ${new Date().toLocaleTimeString()}`;
        summaryEl.textContent = summary;

        if (keyPoints.length > 0) {
            fillList(pointsEl, keyPoints);
            pointsWrap.style.display = "";
        } else {
            pointsWrap.style.display = "none";
        }

        if (questions.length > 0) {
            fillQuestionList(questionsEl, questions, readingLabels.answerPlaceholder);
            questionsWrap.style.display = "";
        } else {
            questionsWrap.style.display = "none";
        }

        if (storedEval) {
            evalEl.textContent = storedEval;
            evalWrap.style.display = "";
        } else {
            evalWrap.style.display = "none";
        }

        if (saved) {
            saveBtn.textContent = readingLabels.saved;
            saveBtn.disabled = true;
            saveBtn.classList.add('is-disabled');
        }

        closeBtn.addEventListener('click', () => removeReadingCard(card));

        saveBtn.addEventListener('click', () => {
            if (saveBtn.disabled) return;
            if (!note) return;

            chrome.runtime.sendMessage({
                type: "ATOM_SAVE_READING_NOTE",
                payload: { note }
            }, (resp) => {
                if (chrome.runtime.lastError) return;
                if (resp && resp.saved) {
                    saveBtn.textContent = readingLabels.saved;
                    saveBtn.disabled = true;
                    saveBtn.classList.add('is-disabled');
                }
                if (resp?.nlm) {
                    triggerNotebookLmExport(resp.nlm);
                }
            });
        });

        openBtn.addEventListener('click', () => {
            openReadingVault();
        });

        if (!noteId) {
            evalBtn.disabled = true;
            evalBtn.classList.add('is-disabled');
        }

        if (storedAnswers.length && questions.length) {
            const inputs = questionsEl.querySelectorAll('.reading-card-question-input');
            inputs.forEach((input, idx) => {
                if (typeof storedAnswers[idx] === "string") {
                    input.value = storedAnswers[idx];
                }
            });
        }

        let answerSaveTimer = null;
        const scheduleSaveAnswers = () => {
            if (!noteId) return;
            if (answerSaveTimer) clearTimeout(answerSaveTimer);
            answerSaveTimer = setTimeout(() => {
                const inputs = questionsEl.querySelectorAll('.reading-card-question-input');
                const answers = Array.from(inputs).map((input) => input.value.trim());
                chrome.runtime.sendMessage({
                    type: "ATOM_READING_SAVE_ANSWERS",
                    payload: { noteId, answers }
                }, () => {
                    if (chrome.runtime.lastError) {
                        // ignore
                    }
                });
            }, 400);
        };

        questionsEl.addEventListener('input', () => scheduleSaveAnswers());

        evalBtn.addEventListener('click', () => {
            if (!noteId) return;
            const inputs = questionsEl.querySelectorAll('.reading-card-question-input');
            const answers = Array.from(inputs).map((input) => input.value.trim());
            evalBtn.disabled = true;
            evalBtn.classList.add('is-disabled');
            evalBtn.textContent = readingLabels.evalPending;
            chrome.runtime.sendMessage({
                type: "ATOM_READING_EVAL",
                payload: { noteId, answers, questions }
            }, (resp) => {
                const err = chrome.runtime.lastError;
                if (err || !resp || !resp.ok) {
                    evalBtn.disabled = false;
                    evalBtn.classList.remove('is-disabled');
                    evalBtn.textContent = readingLabels.evalAction;
                }
            });
        });

        readingStack.prepend(card);
        requestAnimationFrame(() => card.classList.add('state-visible'));

        while (readingStack.children.length > MAX_READING_CARDS) {
            const last = readingStack.lastElementChild;
            if (last) removeReadingCard(last);
        }

        const timer = setTimeout(() => {
            removeReadingCard(card);
        }, READING_CARD_LIFETIME_MS);

        card.addEventListener('mouseenter', () => {
            clearTimeout(timer);
        }, { once: true });

        card.dataset.noteId = noteId;
        card.dataset.command = command || "";
        return card;
    }

    function updateReadingEvaluation(payload) {
        const noteId = payload?.noteId;
        if (!noteId) return;
        const card = readingStack.querySelector(`.atom-reading-card[data-note-id="${noteId}"]`);
        if (!card) return;
        const evalEl = card.querySelector('.reading-card-eval');
        const evalWrap = card.querySelector('.reading-card-eval-wrap');
        const evalBtn = card.querySelector('.reading-card-eval');
        if (evalBtn) {
            evalBtn.disabled = false;
            evalBtn.classList.remove('is-disabled');
            evalBtn.textContent = readingLabels.evalAction;
        }
        if (evalEl && evalWrap) {
            evalEl.textContent = payload?.evaluation || "";
            evalWrap.style.display = evalEl.textContent ? "" : "none";
        }
    }

    window.__ATOM_READING_DISPATCH__ = (payload) => {
        if (payload && payload.requestId) {
            if (window.__ATOM_READING_SEEN__.has(payload.requestId)) {
                return;
            }
            window.__ATOM_READING_SEEN__.add(payload.requestId);
            if (window.__ATOM_READING_SEEN__.size > 50) {
                const iter = window.__ATOM_READING_SEEN__.values();
                const oldest = iter.next().value;
                if (oldest) window.__ATOM_READING_SEEN__.delete(oldest);
            }
        }
        if (payload?.nlm) {
            triggerNotebookLmExport(payload.nlm);
        }
        createReadingCard(payload.command, payload.result, payload.note, payload.saved);
    };
    window.__ATOM_READING_EVAL_DISPATCH__ = (payload) => {
        updateReadingEvaluation(payload);
    };

    window.__ATOM_READING_I18N_REFRESH__ = async () => {
        try {
            const mod = await import(chrome.runtime.getURL("i18n_bridge.js"));
            await mod.initI18n(true);
            const msgNext = (key, fallback) => mod.getMessage(key, null, fallback || key);
            readingLabelsRef.points = msgNext("reading_card_key_points", "Key points");
            readingLabelsRef.questions = msgNext("reading_card_questions", "Questions");
            readingLabelsRef.summaryFallback = msgNext("reading_card_summary_fallback", "No summary available.");
            readingLabelsRef.answerPlaceholder = msgNext("reading_card_answer_placeholder", "Type your answer...");
            readingLabelsRef.evalTitle = msgNext("reading_card_eval_title", "Evaluation");
            readingLabelsRef.evalAction = msgNext("reading_card_eval_action", "Evaluate answers");
            readingLabelsRef.evalPending = msgNext("reading_card_eval_pending", "Evaluating...");
            readingLabelsRef.save = msgNext("reading_card_save", "Save");
            readingLabelsRef.saved = msgNext("reading_card_saved", "Saved");
            readingLabelsRef.openVault = msgNext("reading_card_open_vault", "Open Vault");
            readingLabelsRef.vaultEmpty = msgNext("reading_vault_empty", "No reading notes yet.");

            readingVaultTitle.textContent = msgNext("reading_vault_title", "ATOM - Reading Vault");
            readingVaultEmpty.textContent = readingLabelsRef.vaultEmpty;

            const cards = readingStack.querySelectorAll('.atom-reading-card');
            cards.forEach((card) => {
                const titleEl = card.querySelector('.reading-card-title');
                if (titleEl) titleEl.textContent = msgNext("reading_card_title", "ATOM - Active Reading");
                const command = card.dataset.command || "";
                const modeMap = {
                    "atom-reading-summarize": msgNext("reading_mode_summary", "Summary"),
                    "atom-reading-critique": msgNext("reading_mode_critique", "Critique"),
                    "atom-reading-quiz": msgNext("reading_mode_quiz", "Quiz")
                };
                const metaEl = card.querySelector('.reading-card-meta');
                if (metaEl) {
                    const timePart = metaEl.textContent.split(" - ").slice(1).join(" - ").trim();
                    const modeLabel = modeMap[command] || msgNext("reading_mode_summary", "Summary");
                    metaEl.textContent = timePart ? `${modeLabel} - ${timePart}` : modeLabel;
                }
                const pointsTitle = card.querySelector('.reading-card-points-wrap .reading-card-section-title');
                if (pointsTitle) pointsTitle.textContent = readingLabelsRef.points;
                const questionsTitle = card.querySelector('.reading-card-questions-wrap .reading-card-section-title');
                if (questionsTitle) questionsTitle.textContent = readingLabelsRef.questions;
                const evalTitle = card.querySelector('.reading-card-eval-wrap .reading-card-section-title');
                if (evalTitle) evalTitle.textContent = readingLabelsRef.evalTitle;
                const saveBtn = card.querySelector('.reading-card-save');
                if (saveBtn) {
                    saveBtn.textContent = saveBtn.disabled ? readingLabelsRef.saved : readingLabelsRef.save;
                }
                const openBtn = card.querySelector('.reading-card-open');
                if (openBtn) openBtn.textContent = readingLabelsRef.openVault;
                const evalBtn = card.querySelector('.reading-card-eval');
                if (evalBtn) {
                    if (evalBtn.textContent === readingLabelsRef.evalPending) return;
                    evalBtn.textContent = evalBtn.disabled ? readingLabelsRef.evalAction : readingLabelsRef.evalAction;
                }
                const inputs = card.querySelectorAll('.reading-card-question-input');
                inputs.forEach((input) => {
                    input.placeholder = readingLabelsRef.answerPlaceholder;
                });
            });

            const updateText = (selector, key, fallback) => {
                const el = shadow.querySelector(selector);
                if (el) el.textContent = msgNext(key, fallback);
            };
            const updatePlaceholder = (selector, key, fallback) => {
                const el = shadow.querySelector(selector);
                if (el) el.setAttribute("placeholder", msgNext(key, fallback));
            };

            updateText('#tap-text', 'ui_tap_hold', 'Hold to pause');
            updateText('#stillness-text', 'ui_stillness_hint', 'Stay still');
            updateText('#journal-step-ask .journal-title', 'journal_ask_title', 'How are you feeling?');
            updateText('#btn-ask-no', 'journal_btn_skip', 'Skip');
            updateText('#btn-ask-yes', 'journal_btn_write', 'Write');
            updateText('#form-title', 'journal_form_title', 'How do you feel?');
            updateText('#btn-expand-text', 'journal_btn_expand', 'Expand');
            updateText('#btn-save', 'journal_btn_saved', 'Saved');
            updatePlaceholder('#journal-input-wrap textarea.journal-input', 'journal_placeholder', 'Share a thought');

            const tagMap = {
                habit: 'tag_habit',
                procrastinate: 'tag_procrastinate',
                stress: 'tag_stress',
                fomo: 'tag_fomo',
                inspiration: 'tag_inspiration'
            };
            Object.entries(tagMap).forEach(([val, key]) => {
                const tag = shadow.querySelector(`.journal-tag[data-val="${val}"]`);
                if (tag) tag.textContent = msgNext(key, val);
            });

            if (readingVault.classList.contains('state-visible')) {
                chrome.storage.local.get(['atom_reading_notes', 'atom_nlm_idea_suggestions_v1'], (result) => {
                    renderReadingVault(result.atom_reading_notes || [], result.atom_nlm_idea_suggestions_v1 || []);
                });
            }
        } catch (e) {
            console.warn("ATOM: i18n refresh failed", e);
        }
    };

    if (Array.isArray(window.__ATOM_READING_QUEUE__) && window.__ATOM_READING_QUEUE__.length) {
        const queued = window.__ATOM_READING_QUEUE__.slice();
        window.__ATOM_READING_QUEUE__.length = 0;
        queued.forEach((payload) => window.__ATOM_READING_DISPATCH__(payload));
    }


    // --- 1.3 Journal Dialog (CẤU TRÚC MỚI: 2 BƯỚC) ---
    const journalDialog = document.createElement('div');
    journalDialog.id = 'atom-journal-dialog';
    journalDialog.innerHTML = `
    <div id="btn-close-x" style="position:absolute; top:12px; right:15px; cursor:pointer; font-size:18px; color:rgba(255,255,255,0.5); padding:5px; z-index:10;">✕</div>

    <div id="journal-step-ask">
        <div class="journal-title" style="margin-bottom: 20px;">
            ${atomMsg("journal_ask_title")}
        </div>
        <div style="display:flex; justify-content: center; gap: 15px;">
            <button id="btn-ask-no" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:#ccc; padding:8px 20px; border-radius:20px; cursor:pointer;">
                ${atomMsg("journal_btn_skip")}
            </button>
            <button id="btn-ask-yes" style="background:#A7F3D0; border:none; color:#064E3B; padding:8px 25px; border-radius:20px; font-weight:bold; cursor:pointer;">
                ${atomMsg("journal_btn_write")}
            </button>
        </div>
    </div>

    <div id="journal-step-form" style="display:none;">
        <div class="journal-title" id="form-title">
            ${atomMsg("journal_form_title")}
        </div>
        
        <div class="emoji-row">
            <button class="emoji-btn" data-val="focused">😌</button>
            <button class="emoji-btn" data-val="bored">😐</button>
            <button class="emoji-btn" data-val="anxious">😰</button>
            <button class="emoji-btn" data-val="tired">😴</button>
            <button class="emoji-btn" data-val="angry">😤</button>
        </div>

        <div class="tag-container" id="journal-tags">
            <span class="journal-tag" data-val="habit">${atomMsg("tag_habit")}</span>
            <span class="journal-tag" data-val="procrastinate">${atomMsg("tag_procrastinate")}</span>
            <span class="journal-tag" data-val="stress">${atomMsg("tag_stress")}</span>
            <span class="journal-tag" data-val="fomo">${atomMsg("tag_fomo")}</span>
            <span class="journal-tag" data-val="inspiration">${atomMsg("tag_inspiration")}</span>
        </div>

        <div class="journal-footer">
            <span id="btn-expand-text" style="cursor:pointer; text-decoration:underline;">
                ${atomMsg("journal_btn_expand")}
            </span>
            <span class="btn-save-journal" id="btn-save">
                ${atomMsg("journal_btn_saved")}
            </span>
        </div>
        
        <div class="journal-input-area" id="journal-input-wrap">
            <textarea class="journal-input" rows="2" placeholder="${atomMsg("journal_placeholder")}"></textarea>
        </div>

        <div id="ai-response-area" style="display:none; margin-top:15px; padding:15px; background:rgba(167, 243, 208, 0.1); border-radius:8px; border:1px solid rgba(167, 243, 208, 0.3); color:#A7F3D0; font-size:14px; line-height:1.5; max-height: 200px; overflow-y: auto;"></div>
    </div>
`;
    shadow.appendChild(journalDialog);

    // ===== ATOM FOCUS BLOCK UI (Pomodoro) =====
    const focusBlock = document.createElement('div');
    focusBlock.id = 'atom-focus-block';
    focusBlock.classList.add('hidden');

    // [ATOM ATMOSPHERE]
    // Background Layer
    const bgLayer = document.createElement('div');
    bgLayer.id = 'atom-focus-bg-layer';
    focusBlock.appendChild(bgLayer);

    // Content Layer (z-index higher)
    const contentLayer = document.createElement('div');
    contentLayer.className = 'focus-content-layer';
    focusBlock.appendChild(contentLayer);

    // Build Content - Desk Widget Style
    contentLayer.innerHTML = `
      <div class="focus-widget">
        <!-- LEFT: Info & Timer -->
        <div class="widget-section info">
            <div class="widget-header">
                <div class="focus-indicator">●</div>
                <div class="focus-title">Focus Mode</div>
            </div>
            <div class="focus-timer" id="atom-focus-timer">00:00</div>
        </div>

        <!-- CENTER: Message (Optional/Hover) or Minimal -->
        <div class="widget-divider"></div>

        <!-- RIGHT: Actions -->
        <div class="widget-section actions">
            <button class="focus-btn primary" id="atom-focus-back">Quay lại</button>
            <div class="allow-group">
                <button class="focus-btn icon-only" id="atom-focus-allow-60" title="Allow 60s">+1m</button>
                <button class="focus-btn icon-only" id="atom-focus-allow-120" title="Allow 2m">+2m</button>
            </div>
            <div class="widget-divider small"></div>
            <button id="atom-focus-reset-btn" class="widget-icon-btn" title="${atomMsg('focus_btn_reset')}">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                </svg>
            </button>
            <button id="atom-focus-mute-btn" class="widget-icon-btn" title="Mute Sound">
                <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                    <path class="sound-waves" d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    <path class="sound-waves" d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
            </button>
            <select id="atom-focus-sound-select" class="focus-sound-select" title="Chọn âm thanh">
                <option value="rain">🌧️ Rain</option>
                <option value="forest">🔥 Forest</option>
            </select>
            <button class="focus-btn ghost" id="atom-focus-add-safe" title="Thêm vào Safe Zone">+ Safe</button>
        </div>
      </div>
      
      <!-- Hidden elements required for logic but maybe not shown in widget mode, OR handled via hover -->
      <div id="atom-focus-sub" class="hidden"></div> 
      <div id="atom-focus-micro" class="hidden"></div>
    `;
    shadow.appendChild(focusBlock);

    // [ATOM ATMOSPHERE] Audio Logic - Single Track Selection
    let focusAudioRain = null;
    let focusAudioForest = null;
    let isMuted = false;
    let selectedSound = localStorage.getItem("atom_focus_sound") || "rain";

    function initFocusAudio() {
        if (focusAudioRain && focusAudioForest) return;
        try {
            // Rain sound
            const rainUrl = chrome.runtime.getURL("icons/light_rain.mp3");
            focusAudioRain = new Audio(rainUrl);
            focusAudioRain.loop = true;
            focusAudioRain.volume = 0.5;

            // Forest/campfire ambient
            const forestUrl = chrome.runtime.getURL("icons/forest.mp3");
            focusAudioForest = new Audio(forestUrl);
            focusAudioForest.loop = true;
            focusAudioForest.volume = 0.5;
        } catch (e) {
            console.warn("[ATOM] Audio init failed:", e);
        }
    }

    function getActiveAudio() {
        return selectedSound === "forest" ? focusAudioForest : focusAudioRain;
    }

    function updateMuteState() {
        const btn = shadow.getElementById("atom-focus-mute-btn");
        if (!btn) return;

        // Toggle muted class on button (CSS will handle visual change)
        btn.classList.toggle("muted", isMuted);

        // update active audio
        const activeAudio = getActiveAudio();
        if (activeAudio) activeAudio.muted = isMuted;

        // Save preference
        localStorage.setItem("atom_focus_muted", isMuted ? "1" : "0");
    }

    // Load saved mute state
    const savedMute = localStorage.getItem("atom_focus_muted");
    if (savedMute === "1") isMuted = true;

    // Bind Mute Click & Sound Selector
    setTimeout(() => {
        const muteBtn = shadow.getElementById("atom-focus-mute-btn");
        if (muteBtn) {
            muteBtn.onclick = (e) => {
                e.stopPropagation();
                isMuted = !isMuted;
                updateMuteState();
            };
            updateMuteState();
        }

        const soundSelect = shadow.getElementById("atom-focus-sound-select");
        if (soundSelect) {
            // Set initial value from saved preference
            soundSelect.value = selectedSound;

            soundSelect.onchange = (e) => {
                e.stopPropagation();
                const newSound = soundSelect.value;
                const wasPlaying = isFocusBlockActive && !focusBlock.classList.contains('hidden');

                // Stop current sound
                if (focusAudioRain) { focusAudioRain.pause(); focusAudioRain.currentTime = 0; }
                if (focusAudioForest) { focusAudioForest.pause(); focusAudioForest.currentTime = 0; }

                // Switch
                selectedSound = newSound;
                localStorage.setItem("atom_focus_sound", newSound);

                // Play new sound if was playing
                if (wasPlaying) {
                    const newAudio = getActiveAudio();
                    if (newAudio && !isMuted) {
                        newAudio.play().catch(e => console.log("Autoplay blocked:", e));
                    } else if (newAudio && isMuted) {
                        newAudio.play().catch(() => { });
                        newAudio.muted = true;
                    }
                }
            };
        }
    }, 500);

    function toggleFocusAtmosphere(active) {
        if (active) {
            initFocusAudio();
            const activeAudio = getActiveAudio();
            if (activeAudio && !isMuted) {
                activeAudio.play().catch(e => console.log("Autoplay blocked:", e));
            } else if (activeAudio && isMuted) {
                activeAudio.play().catch(() => { });
                activeAudio.muted = true;
            }
        } else {
            // Stop both tracks (for BREAK phase)
            if (focusAudioRain) {
                focusAudioRain.pause();
                focusAudioRain.currentTime = 0;
            }
            if (focusAudioForest) {
                focusAudioForest.pause();
                focusAudioForest.currentTime = 0;
            }
        }
    }


    // === Focus Block Helper Functions ===
    function fmtFocusRemaining(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }

    function getCurrentDomain() {
        try {
            return new URL(location.href).hostname.toLowerCase().replace(/^www\./, "");
        } catch { return ""; }
    }

    function showFocusBlockUI() {
        if (!focusBlock) return;
        focusBlock.classList.remove('hidden');
        isFocusBlockActive = true;
        toggleFocusAtmosphere(true); // [ATOM ATMOSPHERE] ON
    }

    function hideFocusBlockUI() {
        if (!focusBlock) return;
        focusBlock.classList.add('hidden');
        isFocusBlockActive = false;
        // ẩn micro hint nếu có
        const micro = shadow.getElementById("atom-focus-micro");
        micro?.classList.add("hidden");
        toggleFocusAtmosphere(false); // [ATOM ATMOSPHERE] OFF
    }

    async function enforceFocusIfNeeded(reason = "tick") {
        // [FIX] If Journal is open, do not interrupt with Focus Block
        if (isJournalActive) return;

        const domain = getCurrentDomain();
        if (!domain) return;

        const store = await chrome.storage.local.get(["atom_whitelist", "atom_focus_state", "atom_focus_config"]);
        const st = store.atom_focus_state;
        const cfg = store.atom_focus_config;

        // Focus off → đảm bảo tắt block
        if (!st?.enabled) {
            hideFocusBlockUI();
            return;
        }

        // BREAK default FREE → không block
        if (st.phase !== "WORK") {
            atomFocusPhase = st.phase; // Sync phase locally
            hideFocusBlockUI();
            return;
        }

        // Sync Work Phase
        atomFocusPhase = "WORK";

        const whitelist = store.atom_whitelist || [];
        const isSafe = Array.isArray(whitelist) && whitelist.some(w => {
            return domain === w || domain.endsWith("." + w);
        });

        // allow window
        const allowUntil = st.allowUntil?.[domain] || 0;
        const now = Date.now();
        const isAllowed = now < allowUntil;

        // timer text
        const timerEl = shadow.getElementById("atom-focus-timer");
        if (timerEl) timerEl.textContent = `${atomMsg("focus_timer_work", [], "WORK còn")} ${fmtFocusRemaining(st.phaseEndsAt - now)}`;

        if (isSafe || isAllowed) {
            hideFocusBlockUI();
            return;
        }

        // blocked
        showFocusBlockUI();

        // cập nhật quota allow
        const allow60 = shadow.getElementById("atom-focus-allow-60");
        const allow120 = shadow.getElementById("atom-focus-allow-120");
        const used = st.allowUsedCount || 0;
        const max = cfg?.allowMaxPerWork ?? 2;
        const allowOk = used < max;
        if (allow60) allow60.style.display = allowOk ? "inline-flex" : "none";
        if (allow120) allow120.style.display = allowOk ? "inline-flex" : "none";

        // report attempt (background sẽ cooldown)
        const attemptResp = await chrome.runtime.sendMessage({
            type: "FOCUS_REPORT_ATTEMPT",
            payload: { domain, url: location.href }
        });

        if (attemptResp?.ok) {
            console.log("ATOM FOCUS ATTEMPT RESP:", attemptResp); // DEBUG LOG
            const microEl = shadow.getElementById("atom-focus-micro");
            if (attemptResp.escalation === "MICRO") {
                microEl?.classList.remove("hidden");
            } else if (attemptResp.escalation === "HARD") {
                // gọi hard interrupt mode có sẵn
                const mode = attemptResp.hardMode || "BREATH";
                console.log("ATOM FOCUS TRIGGER HARD:", mode); // DEBUG LOG

                // đảm bảo không bị pipeline xen ngang - để mode function tự set
                // isInterventionActive = true; 
                microRenderer?.remove?.();
                // resetUI(); // Mode function sẽ tự gọi resetUI

                // Mở overlay cứng - Mode function sẽ tự handle
                // overlay.classList.add('state-visible');
                // overlay.style.display = 'flex';

                if (mode === "STILLNESS") {
                    if (typeof startStillnessMode === 'function') startStillnessMode();
                    else console.error("startStillnessMode missing");
                }
                else if (mode === "TAP") {
                    if (typeof startTapHoldMode === 'function') startTapHoldMode();
                    else console.error("startTapHoldMode missing");
                }
                else {
                    if (typeof startBreathingMode === 'function') startBreathingMode();
                    else console.error("startBreathingMode missing");
                }
            }
        }
    }

    // bind Focus Block buttons (1 lần)
    const btnFocusBack = shadow.getElementById("atom-focus-back");
    const btnFocusAllow60 = shadow.getElementById("atom-focus-allow-60");
    const btnFocusAllow120 = shadow.getElementById("atom-focus-allow-120");
    const btnFocusAddSafe = shadow.getElementById("atom-focus-add-safe");

    if (btnFocusBack) btnFocusBack.onclick = async () => {
        // ưu tiên history.back
        if (history.length > 1) {
            history.back();
            setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("back"), 350);
        } else {
            try {
                chrome.runtime.sendMessage({ type: "FOCUS_CLOSE_TAB" });
            } catch (e) {
                console.warn("[ATOM] Context invalidated during Focus Close:", e.message);
            }
        }
    };

    async function doFocusAllow(sec) {
        try {
            const domain = getCurrentDomain();
            const resp = await chrome.runtime.sendMessage({ type: "FOCUS_ALLOW_TEMP", payload: { domain, sec } });
            if (resp?.ok) {
                hideFocusBlockUI();
                clearTimeout(focusAllowTimer);
                focusAllowTimer = setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("allow_expired"), sec * 1000 + 50);
            }
        } catch (e) {
            console.warn("[ATOM] Context invalidated during Focus Allow:", e.message);
        }
    }

    if (btnFocusAllow60) btnFocusAllow60.onclick = () => doFocusAllow(60);
    if (btnFocusAllow120) btnFocusAllow120.onclick = () => doFocusAllow(120);

    if (btnFocusAddSafe) btnFocusAddSafe.onclick = async () => {
        const domain = getCurrentDomain();
        try {
            await chrome.runtime.sendMessage({ type: "FOCUS_ADD_WHITELIST", payload: { domain } });
        } catch (e) {
            console.warn("[ATOM] Extension context invalidated, ignoring:", e.message);
        }
        hideFocusBlockUI();
    };

    const btnFocusReset = shadow.getElementById("atom-focus-reset-btn");
    if (btnFocusReset) btnFocusReset.onclick = async () => {
        try {
            await chrome.runtime.sendMessage({ type: "FOCUS_RESET_PHASE" });
            const timerEl = shadow.getElementById("atom-focus-timer");
            if (timerEl) timerEl.textContent = "Updating...";
        } catch (e) {
            console.warn("[ATOM] Reset request failed:", e.message);
        }
    };

    // Listener for Focus state updates from background
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.type === "ATOM_FOCUS_STATE_UPDATED") {
            // state update → enforce ngay
            window.__ATOM_FOCUS_ENFORCE__?.("broadcast");
            sendResponse({ ok: true });
            return true;
        }
    });

    // Hàm cập nhật timer liên tục để đồng bộ với popup
    let focusTimerInterval = null;
    async function updateFocusTimer() {
        if (!chrome.runtime?.id) return;
        if (!isFocusBlockActive) return;

        let store;
        try {
            store = await chrome.storage.local.get(["atom_focus_state"]);
        } catch (e) {
            return;
        }
        const st = store.atom_focus_state;

        if (!st?.enabled || st.phase !== "WORK") return;

        const timerEl = shadow.getElementById("atom-focus-timer");
        const now = Date.now();
        if (timerEl) {
            timerEl.textContent = `${atomMsg("focus_timer_work", [], "WORK còn")} ${fmtFocusRemaining(st.phaseEndsAt - now)}`;
        }
    }

    // SPA URL watcher: mỗi 1s check url đổi + cập nhật timer
    focusRecheckTimer = setInterval(() => {
        if (!chrome.runtime?.id) {
            clearInterval(focusRecheckTimer);
            return;
        }
        if (location.href !== lastFocusUrl) {
            lastFocusUrl = location.href;
            window.__ATOM_FOCUS_ENFORCE__?.("url_changed");
        }
        // Cập nhật timer mỗi giây để đồng bộ với popup
        updateFocusTimer().catch(() => { });
    }, 1000);

    // enforce ngay khi load
    setTimeout(() => window.__ATOM_FOCUS_ENFORCE__?.("init"), 500);

    // --- 2. LOGIC ĐIỀU KHIỂN UI ---

    function resetUI() {
        overlay.classList.remove('state-visible');
        // Ẩn tất cả các mode
        shadow.querySelectorAll('.ui-mode').forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none'; // Cưỡng ép ẩn bằng CSS inline
        });

        // Xóa toàn bộ timer để tránh việc mode cũ "nhảy" vào mode mới
        clearTimeout(breathTimer1);
        clearTimeout(breathTimer2);
        clearTimeout(tapAutoDismissTimer);
        if (breathDismissTimer) clearTimeout(breathDismissTimer);
    }

    function updatePresenceState(presenceConfig) {
        const orb = shadow.querySelector('#atom-presence-orb');
        if (!orb) return;

        // Chấp nhận cả boolean (tương thích cũ) hoặc Object config (V3)
        const isActive = typeof presenceConfig === 'object' ? presenceConfig.show_orb : presenceConfig;
        const level = presenceConfig?.level || 'medium';

        if (isActive) {
            // 1. Hiển thị Orb với hiệu ứng mượt mà
            orb.classList.add('visible');
            orb.classList.add('orb-pulse');

            // 2. Điều chỉnh độ sáng/màu sắc dựa trên Intensity (V3)
            // Silence B (Fatigue) có thể mờ hơn Silence C (Approaching)
            orb.style.opacity = level === 'low' ? "0.4" : "0.8";

            // 3. Hiệu ứng môi trường (Tinh túy V2)
            // Chỉ áp dụng sepia nếu không đang có Overlay chặn để tránh nhìn quá tối
            if (!isInterventionActive) {
                document.documentElement.style.filter = "sepia(0.25) brightness(0.92) contrast(0.95)";
                document.documentElement.style.transition = "filter 3s ease-in-out";
            }
        } else {
            // 4. Tắt Orb
            orb.classList.remove('visible');
            orb.classList.remove('orb-pulse');

            // Trả lại màu sắc ban đầu một cách chậm rãi
            if (!isInterventionActive) {
                document.documentElement.style.filter = "none";
            }
        }
    }

    // Thay thế hàm cũ bằng hàm này
    function closeIntervention(finalAction = "COMPLETED", forcedMode = null) {
        isInterventionActive = false;
        activeScrollSeconds = 0;

        let activeMode = forcedMode || "UNKNOWN";
        if (!forcedMode) {
            if (!shadow.querySelector('#ui-breath').classList.contains('hidden')) activeMode = "BREATH";
            else if (!shadow.querySelector('#ui-taphold').classList.contains('hidden')) activeMode = "TAP";
            else if (!shadow.querySelector('#ui-stillness').classList.contains('hidden')) activeMode = "STILLNESS";
        }

        const reactedAt = Date.now();
        const interventionId = currentIntervention?.id || makeInterventionId();
        const shownAt = currentIntervention?.shownAt || reactedAt;
        const durationMs = reactedAt - shownAt;

        console.log(`[ATOM REACTION] ${finalAction} | mode=${activeMode} | ${durationMs}ms`);

        // 1) Log REACTION (kết quả)
        // 1) Log REACTION (kết quả)
        if (chrome.runtime?.id) {
            try {
                chrome.runtime.sendMessage(
                    {
                        type: "LOG_REACTION",
                        payload: {
                            action: finalAction,
                            type: activeMode,
                            kind: currentIntervention?.kind || null,
                            intervention_id: interventionId,
                            shown_at: shownAt,
                            reacted_at: reactedAt,
                            duration_ms: durationMs
                        }
                    },
                    (ack) => {
                        if (chrome.runtime.lastError) { /* ignore */ }
                        else console.log("[ATOM LOG_REACTION ACK]", ack);
                    }
                );
            } catch (e) {
                // ignore invalidation
            }
        }

        // 2) Reset
        currentIntervention = null;
        resetUI();

        if (finalAction !== "COMPLETED") shouldShowJournal = false;
        if (finalAction === "COMPLETED" && shouldShowJournal) {
            setTimeout(showJournalPrompt, 500);
        }
    }


    // --- 3. LOGIC JOURNAL (ĐÃ SỬA LỖI & THÊM BƯỚC HỎI) ---
    let journalData = { emoji: null, tags: [], text: "" };

    // --- AUTO-HIDE STATE ---
    let journalAutoDismissTimer = null;
    let isJournalSaved = false;
    let isJournalFormActive = false;

    // 3.1 Hàm hiển thị bước hỏi (Step 1)
    function showJournalPrompt() {
        if (isJournalActive) return;
        isJournalActive = true; // Khóa
        journalDialog.classList.add('visible');

        // Reset State
        isJournalSaved = false;
        isJournalFormActive = false;

        // Reset view về Step 1
        shadow.querySelector('#journal-step-ask').style.display = 'block';
        shadow.querySelector('#journal-step-form').style.display = 'none';

        // START 10s Timer (Auto-dismiss if ignored)
        if (journalAutoDismissTimer) clearTimeout(journalAutoDismissTimer);
        journalAutoDismissTimer = setTimeout(() => {
            if (!isJournalFormActive) { // Chỉ đóng nếu vẫn đang ở bước hỏi
                closeJournal();
            }
        }, 10000);
    }

    // 3.2 Hàm chuyển sang form viết (Step 2)
    function switchToJournalForm() {
        // Stop Timer 10s
        if (journalAutoDismissTimer) clearTimeout(journalAutoDismissTimer);
        isJournalFormActive = true;

        // Ẩn Step 1, hiện Step 2
        shadow.querySelector('#journal-step-ask').style.display = 'none';
        shadow.querySelector('#journal-step-form').style.display = 'block';

        // Reset dữ liệu form
        journalData = { emoji: null, tags: [], text: "" };
        shadow.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
        shadow.querySelectorAll('.journal-tag').forEach(t => t.classList.remove('selected'));
        shadow.querySelector('#journal-tags').classList.remove('expanded');
        shadow.querySelector('#journal-input-wrap').style.display = 'none';
        shadow.querySelector('#ai-response-area').style.display = 'none';
        shadow.querySelector('.emoji-row').style.display = 'flex';
        shadow.querySelector('#journal-tags').style.display = 'flex';
        shadow.querySelector('.journal-input').value = "";

        shadow.querySelector('#btn-expand-text').style.display = 'inline';
        // Reset tiêu đề
        shadow.querySelector('#form-title').innerText = atomMsg("journal_form_title");

        // QUAN TRỌNG: Reset nút Save về trạng thái ban đầu
        const btnSave = shadow.querySelector('#btn-save');
        btnSave.style.display = 'none'; // Ẩn nút save khi chưa chọn gì
        btnSave.innerText = atomMsg("journal_btn_saved");
        btnSave.style.opacity = "1";
        btnSave.style.cursor = "pointer";

        // Gán lại sự kiện click gốc cho nút save
        btnSave.onclick = handleSaveJournal;
    }

    // 3.3 Hàm đóng toàn bộ
    function closeJournal() {
        if (journalAutoDismissTimer) clearTimeout(journalAutoDismissTimer);

        journalDialog.classList.remove('visible');
        isJournalActive = false;

        // --- NEW: reset session sau journal để tránh trigger ngay ---
        activeScrollSeconds = 0;
        lastTickAt = Date.now();
        lastActivityTime = Date.now();

        sessionStartTime = Date.now(); // Reset mốc thời gian về hiện tại
    }

    // --- XỬ LÝ SỰ KIỆN (EVENT LISTENERS) ---

    // Nút X và Nút "Bỏ qua"
    shadow.querySelector('#btn-close-x').onclick = closeJournal;
    shadow.querySelector('#btn-ask-no').onclick = closeJournal;

    // Nút "Viết Nhật Ký" -> Chuyển sang form
    shadow.querySelector('#btn-ask-yes').onclick = switchToJournalForm;

    // Chọn Emoji
    shadow.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.onclick = () => {
            shadow.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            journalData.emoji = btn.dataset.val;

            // Hiện tags
            shadow.querySelector('#journal-tags').classList.add('expanded');
        };
    });

    // [FIX] Prevent Space key propagation for Journal Textarea
    const journalTextarea = shadow.querySelector('.journal-input');
    if (journalTextarea) {
        journalTextarea.addEventListener('keydown', (e) => e.stopPropagation());
        journalTextarea.addEventListener('keypress', (e) => e.stopPropagation());
        journalTextarea.addEventListener('keyup', (e) => e.stopPropagation());
    }

    // Chọn Tag
    shadow.querySelectorAll('.journal-tag').forEach(tag => {
        tag.onclick = () => {
            tag.classList.toggle('selected');
            const val = tag.dataset.val;
            if (journalData.tags.includes(val)) {
                journalData.tags = journalData.tags.filter(t => t !== val);
            } else {
                journalData.tags.push(val);
            }
            // Hiện nút Save khi đã có thao tác
            shadow.querySelector('#btn-save').style.display = 'block';
        };
    });

    // --- CUSTOM TAG LOGIC ---
    // 1. Thêm nút trigger và input vào HTML (nếu chưa có - thực tế là sửa HTML string ở trên, 
    // nhưng ở đây ta thao tác DOM vì HTML string nằm tít trên dòng 1300+)

    // Tìm container tags
    const tagContainer = shadow.querySelector('#journal-tags');
    if (tagContainer && !shadow.querySelector('#btn-custom-tag')) {
        // Tạo nút Trigger
        const btnCustom = document.createElement('span');
        btnCustom.className = 'journal-tag custom-tag-trigger';
        btnCustom.id = 'btn-custom-tag';
        btnCustom.innerText = '+ Other...'; // Hoặc lấy từ atomMsg nếu cần
        tagContainer.appendChild(btnCustom);

        // Tạo Input Wrap
        const wrapCustom = document.createElement('div');
        wrapCustom.className = 'custom-tag-input-wrap';
        wrapCustom.id = 'custom-tag-wrap';
        wrapCustom.style.display = 'none';

        const inputCustom = document.createElement('input');
        inputCustom.type = 'text';
        inputCustom.className = 'custom-tag-input';
        inputCustom.id = 'custom-tag-input';
        inputCustom.placeholder = 'Type tag...';
        inputCustom.maxLength = 20;

        // [FIX] Stop propagation
        inputCustom.addEventListener('keydown', (e) => e.stopPropagation());
        inputCustom.addEventListener('keypress', (e) => e.stopPropagation());
        inputCustom.addEventListener('keyup', (e) => e.stopPropagation());


        wrapCustom.appendChild(inputCustom);
        tagContainer.appendChild(wrapCustom);

        // Bind Events
        btnCustom.onclick = () => {
            btnCustom.style.display = 'none';
            wrapCustom.style.display = 'block';
            inputCustom.focus();
        };

        const addCustomTag = () => {
            const val = inputCustom.value.trim();
            if (val) {
                // Thêm vào data
                if (!journalData.tags.includes(val)) {
                    journalData.tags.push(val);
                }

                // Tạo visual tag mới đứng NGAY TRƯỚC nút trigger
                const newTag = document.createElement('span');
                newTag.className = 'journal-tag selected';
                newTag.innerText = val;
                newTag.dataset.val = val;
                newTag.onclick = () => {
                    newTag.classList.toggle('selected');
                    if (journalData.tags.includes(val)) {
                        journalData.tags = journalData.tags.filter(t => t !== val);
                    } else {
                        journalData.tags.push(val);
                    }
                };

                // Chèn trước nút custom
                tagContainer.insertBefore(newTag, btnCustom);

                // Reset input
                inputCustom.value = '';
                wrapCustom.style.display = 'none';
                btnCustom.style.display = 'inline-flex'; // Hiện lại nút trigger

                // Hiện nút save
                shadow.querySelector('#btn-save').style.display = 'block';
            } else {
                // Nếu rỗng thì cứ đóng lại thôi
                wrapCustom.style.display = 'none';
                btnCustom.style.display = 'inline-flex';
            }
        };

        inputCustom.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCustomTag();
            }
        };

        inputCustom.onblur = () => {
            // Tùy chọn: blur có tự add không? Hay blur là hủy?
            // Thường UX blur mà có text thì nên add luôn cho tiện
            if (inputCustom.value.trim()) {
                addCustomTag();
            } else {
                wrapCustom.style.display = 'none';
                btnCustom.style.display = 'inline-flex';
            }
        };
    }

    // Mở rộng Text Area
    shadow.querySelector('#btn-expand-text').onclick = () => {
        shadow.querySelector('#journal-input-wrap').style.display = 'block';
        shadow.querySelector('#btn-expand-text').style.display = 'none';
        setTimeout(() => {
            shadow.querySelector('.journal-input').focus();
        }, 100);
    };

    // --- HÀM XỬ LÝ LƯU (ĐƯỢC TÁCH RA ĐỂ TRÁNH LỖI OVERWRITE) ---
    async function handleSaveJournal() {
        const btnSave = shadow.querySelector('#btn-save');
        const aiArea = shadow.querySelector('#ai-response-area');

        // 1. Lấy dữ liệu text
        const textInput = shadow.querySelector('.journal-input').value;
        if (textInput) journalData.text = textInput;

        // 2. Lưu Storage
        const durationSec = (Date.now() - sessionStartTime) / 1000;
        const trainingDataPoint = {
            timestamp: Date.now(),
            input: {
                context: window.location.hostname,
                duration: durationSec,
                user_feeling: journalData.emoji,
                user_tags: journalData.tags,
                user_note: journalData.text
            }
        };

        await new Promise((resolve) => {
            chrome.storage.local.get(['journal_logs'], function (result) {
                const logs = result.journal_logs || [];
                logs.push(trainingDataPoint);
                chrome.storage.local.set({ journal_logs: logs }, resolve);
            });
        });

        // 3. UI Loading
        btnSave.innerText = atomMsg("journal_btn_processing");
        btnSave.style.opacity = "0.7";
        btnSave.style.cursor = "wait";

        // Ngắt click tạm thời để tránh spam
        btnSave.onclick = null;

        // 4. Gọi AI
        chrome.runtime.sendMessage({ type: "ANALYZE_JOURNAL" }, (response) => {
            if (response && response.success) {
                // Hiển thị kết quả AI
                aiArea.style.display = 'block';
                aiArea.innerText = "✨ " + response.message;

                // Ẩn form nhập liệu cho gọn
                shadow.querySelector('.emoji-row').style.display = 'none';
                shadow.querySelector('#journal-tags').style.display = 'none';
                shadow.querySelector('#journal-input-wrap').style.display = 'none';
                shadow.querySelector('#btn-expand-text').style.display = 'none';
                shadow.querySelector('#form-title').innerText = atomMsg("journal_ai_title");

                // Chuyển nút Save thành nút Đóng
                btnSave.innerText = atomMsg("journal_btn_understood");
                btnSave.className = "btn-closed";
                btnSave.style.opacity = "1";
                btnSave.style.cursor = "pointer";

                // Gán hành động Đóng cho lần click tiếp theo
                btnSave.onclick = closeJournal;

                // Mark as saved so blur listener can close it
                isJournalSaved = true;
            } else {
                // Lỗi thì đóng luôn
                closeJournal();
            }
        });
    };


    // --- 4. CÁC MODE CAN THIỆP (GIỮ NGUYÊN) ---

    // MODE A: BREATH 
    // MODE A: BREATH (Anti-Cheat & Auto-Dismiss)

    // content.js - CẬP NHẬT LOGIC BREATH ĐỂ TRÁNH NHẢY NHẬT KÝ SỚM

    // content.js - LOGIC BREATH (ĐÃ SỬA THEO YÊU CẦU: 3s DISMISS - 4s HOLD)

    // content.js - LOGIC BREATH (VISUAL: 4-7-8, RULE: MIN 4s)

    function startBreathingMode(passedId = null) {
        if (isInterventionActive) return;
        isInterventionActive = true;
        shouldShowJournal = false; // Mặc định là false (nếu bỏ qua)

        const ui = shadow.querySelector('#ui-breath');
        const label = shadow.querySelector('#breath-text');
        const circle = shadow.querySelector('#breath-circle');

        resetUI();
        overlay.classList.add('state-visible');
        overlay.style.display = 'flex'; // Ensure flex display
        ui.classList.remove('hidden');
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column';
        ui.style.alignItems = 'center';
        ui.style.justifyContent = 'center';
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - BREATH
        currentIntervention = { id: passedId || makeInterventionId(), mode: "BREATH", kind: "HARD_INTERRUPT", shownAt: Date.now() };
        emitAtomEvent("SHOWN", "BREATH", {
            intervention_id: currentIntervention.id,
            shown_at: currentIntervention.shownAt
        });

        label.innerText = atomMsg("ui_breath_hold_start");
        label.style.color = "#FFFFFF";

        circle.classList.remove('anim-breathe', 'active');
        void circle.offsetWidth; // Reset animation

        // 1. Timer tự biến mất nếu không chạm (3s)
        const startDismissTimer = () => {
            if (breathDismissTimer) clearTimeout(breathDismissTimer);
            breathDismissTimer = setTimeout(() => {
                if (!circle.classList.contains('active')) {
                    shouldShowJournal = false;
                    closeIntervention("IGNORED", "BREATH"); // <--- GỌI THẾ NÀY
                }
            }, 3000);
        };
        startDismissTimer();

        let holdStartTime = 0;

        // 2. KHI ẤN GIỮ (Bắt đầu chu trình 4-7-8)
        const onHoldStart = (e) => {
            e.stopPropagation();
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.preventDefault();

            clearTimeout(breathDismissTimer); // Hủy tự đóng

            // Reset chữ và timer cũ
            clearTimeout(breathTimer1);
            clearTimeout(breathTimer2);

            holdStartTime = Date.now();
            circle.classList.add('active');
            circle.classList.add('anim-breathe'); // Animation CSS chạy (4s to - 7s stay - 8s small)

            // --- PHASE 1: HÍT VÀO (0s - 4s) ---
            label.innerText = atomMsg("ui_breath_inhale");
            label.style.color = "#A7F3D0"; // Xanh nhẹ

            // --- PHASE 2: GIỮ HƠI (4s - 11s) ---
            breathTimer1 = setTimeout(() => {
                if (circle.classList.contains('active')) {
                    label.innerText = atomMsg("ui_breath_hold");
                    label.style.color = "#FBBF24"; // Vàng
                }
            }, 4000);

            // --- PHASE 3: THỞ RA (11s - 19s) ---
            breathTimer2 = setTimeout(() => {
                if (circle.classList.contains('active')) {
                    label.innerText = atomMsg("ui_breath_exhale");
                    label.style.color = "#60A5FA"; // Xanh dương
                }
            }, 11000); // 4s + 7s = 11s
        };

        // 3. KHI THẢ TAY (Kiểm tra xem đủ 4s chưa)
        const onRelease = () => {
            if (!circle.classList.contains('active')) return;

            circle.classList.remove('active', 'anim-breathe');

            // Xóa các timer đổi chữ (để không nhảy chữ lung tung khi đã thả tay)
            clearTimeout(breathTimer1);
            clearTimeout(breathTimer2);

            const holdDuration = Date.now() - holdStartTime;

            // RULE: Chỉ cần giữ > 4 giây (Hết pha Hít vào) là tính Thành công
            if (holdDuration >= 4000) {
                label.innerText = atomMsg("ui_breath_success");
                label.style.color = "#FBBF24";

                shouldShowJournal = true; // Bật nhật ký
                setTimeout(closeIntervention, 500);
            } else {
                // Chưa đủ 4s
                label.innerText = atomMsg("ui_breath_fail");
                label.style.color = "#F87171";
                startDismissTimer(); // Đếm ngược lại 3s để tự tắt
            }
        };

        // Bind Events
        circle.onmousedown = onHoldStart;
        circle.ontouchstart = onHoldStart;
        circle.onmouseup = onRelease;
        circle.onmouseleave = onRelease;
        circle.ontouchend = onRelease;
    }

    // MODE B: TAP & HOLD
    // content.js - TỐI ƯU TAP & HOLD: CHỐNG NHẢY NHẬT KÝ & GIỮ TIMER ỔN ĐỊNH

    function startTapHoldMode(text, duration = 3000, passedId = null) {
        if (isInterventionActive) return;
        isInterventionActive = true;
        shouldShowJournal = true; // Mặc định hiện nhật ký khi hoàn thành

        const ui = shadow.querySelector('#ui-taphold');
        const label = shadow.querySelector('#tap-text');
        const btn = shadow.querySelector('#tap-btn');
        const progressRing = shadow.querySelector('#progress-ring');

        // SVG logic update for radius=58
        const circumference = 364;
        progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        progressRing.style.strokeDashoffset = circumference;

        resetUI();
        overlay.classList.add('state-visible');
        overlay.style.display = 'flex'; // Ensure flex display
        ui.classList.remove('hidden');
        ui.style.display = 'flex';
        ui.style.flexDirection = 'column';
        ui.style.alignItems = 'center';
        ui.style.justifyContent = 'center';
        label.innerText = text || atomMsg("ui_tap_hold");
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - TAP
        currentIntervention = { id: passedId || makeInterventionId(), mode: "TAP", kind: "HARD_INTERRUPT", shownAt: Date.now() };
        emitAtomEvent("SHOWN", "TAP", {
            intervention_id: currentIntervention.id,
            shown_at: currentIntervention.shownAt
        });

        let timer = null;
        let isHolding = false;

        // --- 1. HÀM TỰ ĐỘNG ĐÓNG (AUTO-DISMISS) ---
        // Nếu sau 5s không ai chạm vào, tắt UI và KHÔNG hiện nhật ký
        const startAutoDismiss = () => {
            if (tapAutoDismissTimer) clearTimeout(tapAutoDismissTimer);
            // Mới:
            tapAutoDismissTimer = setTimeout(() => {
                if (!isHolding) {
                    shouldShowJournal = false;
                    closeIntervention("IGNORED", "TAP"); // <--- GỌI THẾ NÀY
                }
            }, 5000);
        };

        startAutoDismiss();

        progressRing.style.transition = 'none';
        progressRing.style.strokeDashoffset = String(circumference);

        const onDown = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            e.preventDefault();

            // Xóa ngay timer tự đóng khi user bắt đầu tương tác
            clearTimeout(tapAutoDismissTimer);

            isHolding = true;
            btn.classList.add('active');

            // Bắt đầu chạy vòng tiến trình
            progressRing.style.transition = `stroke-dashoffset ${duration}ms linear`;
            progressRing.style.strokeDashoffset = '0';

            timer = setTimeout(() => {
                if (isHolding) {
                    closeIntervention(); // Hoàn thành -> Hiện nhật ký
                }
            }, duration);
        };

        const onUp = () => {
            if (!isHolding) return;

            isHolding = false;
            btn.classList.remove('active');
            clearTimeout(timer); // Ngừng đếm ngược hoàn thành

            // Reset vòng tiến trình về ban đầu
            progressRing.style.transition = 'stroke-dashoffset 0.3s ease-out';
            progressRing.style.strokeDashoffset = circumference;

            // Nếu nhả ra sớm, khởi động lại timer tự đóng 5s
            startAutoDismiss();

            label.innerText = atomMsg("ui_tap_fail"); // Thay cho "Giữ lâu hơn..."
            label.style.color = "#F87171"; // Cảnh báo nhẹ
        };

        btn.onmousedown = onDown;
        btn.ontouchstart = onDown;
        btn.onmouseup = onUp;
        btn.onmouseleave = onUp;
        btn.ontouchend = onUp;
    }
    // content.js - MODE C: STILLNESS (UPDATED: 3s MOVE = IGNORE, 7s STILL = SUCCESS)

    function startStillnessMode(passedId = null) {
        if (isInterventionActive) return;
        isInterventionActive = true;

        // Mặc định là thành công (True), nếu vi phạm sẽ set về False
        shouldShowJournal = true;

        const ui = shadow.querySelector('#ui-stillness');
        const label = shadow.querySelector('#stillness-text');
        const timerText = shadow.querySelector('#stillness-timer');
        const ring = shadow.querySelector('#stillness-ring');

        // Reset UI
        resetUI();
        overlay.classList.add('state-visible');
        overlay.style.display = 'flex'; // Ensure flex display
        ui.classList.remove('hidden');
        ui.style.display = 'flex'; // Ensure flex display
        ui.style.flexDirection = 'column';
        ui.style.alignItems = 'center';
        ui.style.justifyContent = 'center';
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - STILLNESS
        currentIntervention = { id: passedId || makeInterventionId(), mode: "STILLNESS", kind: "HARD_INTERRUPT", shownAt: Date.now() };
        emitAtomEvent("SHOWN", "STILLNESS", {
            intervention_id: currentIntervention.id,
            shown_at: currentIntervention.shownAt
        });

        // CẤU HÌNH THỜI GIAN
        const TARGET_DURATION = 7000; // 7 giây tĩnh lặng để thành công
        const MOVE_LIMIT = 2000;      // Giảm xuống 2s cho nhạy

        // Config SVG
        const circumference = 490; // radius 78 * 2 * PI
        ring.style.strokeDasharray = `${circumference}`;
        ring.style.strokeDashoffset = '0';

        let startTime = Date.now();
        let movementStartTime = null; // Thời điểm bắt đầu chuỗi di chuyển
        let moveStopDebounce = null;  // Timer để xác định khi nào user ngừng di chuyển
        let animationFrameId = null;
        let isFailed = false;         // Cờ đánh dấu đã thất bại

        // 1. VÒNG LẶP KIỂM TRA TIẾN ĐỘ (SUCCESS LOOP)
        const checkProgress = () => {
            if (!isInterventionActive || isFailed) return;

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, TARGET_DURATION - elapsed);

            // Cập nhật Text
            timerText.innerText = Math.ceil(remaining / 1000);

            // Cập nhật Ring (chạy ngược chiều kim đồng hồ hoặc giảm dần)
            // Offset dần tăng lên 490 để biến mất
            const offset = (elapsed / TARGET_DURATION) * circumference;
            ring.style.strokeDashoffset = Math.min(offset, circumference);

            // --- THÀNH CÔNG: ĐỦ 7 GIÂY ---
            if (elapsed >= TARGET_DURATION) {
                cleanupListeners(); // Dọn dẹp sự kiện chuột
                label.innerText = atomMsg("ui_stillness_success");
                label.style.color = "#FBBF24"; // Màu vàng thành công
                timerText.innerText = "✓";

                // shouldShowJournal vẫn là true
                setTimeout(closeIntervention, 500);
            } else {
                animationFrameId = requestAnimationFrame(checkProgress);
            }
        };

        // 2. LOGIC PHÁT HIỆN DI CHUYỂN (FAILURE LOGIC)
        const onMouseMove = () => {
            if (isFailed) return;

            const now = Date.now();

            // Nếu đây là lần đầu di chuyển sau một khoảng tĩnh
            if (!movementStartTime) {
                movementStartTime = now;
            }

            // Tính thời gian đã di chuyển liên tục
            const movingDuration = now - movementStartTime;

            // Cập nhật UI cảnh báo
            label.innerText = atomMsg("ui_stillness_warning");
            label.style.color = "#F87171"; // Màu đỏ cảnh báo

            // Reset lại thời gian tĩnh lặng (bắt buộc phải tĩnh lại từ đầu)
            startTime = Date.now();
            ring.style.strokeDashoffset = '0';
            timerText.innerText = Math.ceil(TARGET_DURATION / 1000);

            // --- THẤT BẠI: DI CHUYỂN QUÁ 3 GIÂY ---
            if (movingDuration > MOVE_LIMIT) {
                isFailed = true;
                shouldShowJournal = false; // Bỏ qua -> Không hiện nhật ký

                label.innerText = atomMsg("ui_stillness_fail");
                cleanupListeners();

                // --- THAY TOÀN BỘ ĐOẠN sendMessage VÀ closeIntervention CŨ BẰNG DÒNG NÀY ---
                closeIntervention("IGNORED", "STILLNESS");

                return;
            }
            // --- CƠ CHẾ DEBOUNCE: Xác định khi nào user NGỪNG di chuyển ---
            // Nếu trong 300ms không có sự kiện move nào -> coi như đã dừng
            clearTimeout(moveStopDebounce);
            moveStopDebounce = setTimeout(() => {
                if (!isFailed) {
                    movementStartTime = null; // Reset chuỗi di chuyển
                    label.innerText = atomMsg("ui_stillness_hint");
                    label.style.color = "#FFFFFF"; // Trả lại màu trắng
                    startTime = Date.now(); // Bắt đầu đếm lại 7s từ lúc này
                }
            }, 300);
        };

        // 3. DỌN DẸP
        const cleanupListeners = () => {
            window.removeEventListener('mousemove', onMouseMove);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (moveStopDebounce) clearTimeout(moveStopDebounce);
        };

        // Khởi chạy
        window.addEventListener('mousemove', onMouseMove);
        animationFrameId = requestAnimationFrame(checkProgress);
    }

    // --- 5. ADAPTER ---
    function dispatchFromPipeline(data) {
        // 1. Chặn tuyệt đối nếu đang trong bất kỳ tiến trình nào (Intervention hoặc Journal)
        if (isInterventionActive || isJournalActive) return;

        // ✅ Chỉ Presence Orb khi Selection yêu cầu: type === 'presence_signal'
        if (data.type === 'presence_signal') {
            const presenceData = data.payload?.presence;
            if (presenceData) {
                updatePresenceState(presenceData);
                if (presenceData.show_orb) {
                    console.log(`ATOM presence_signal: ${presenceData.level}`);
                }
            }
            return; // presence_signal xử lý xong là xong
        }
        updatePresenceState(false);
        // --- MỚI: XỬ LÝ MICRO CLOSURE (LAYER 1.5) ---
        if (data.type === 'micro_closure') {
            if (!microRenderer?.render) {
                console.warn("ATOM: microRenderer not ready, skip micro_closure");
                return;
            }

            // [FIX RISK 1] Lock: Nếu đang chờ 1 cái rồi thì đừng chồng thêm cái nữa
            if (pendingMicroClosureTimer) {
                console.log("ATOM: Micro pending locked, ignoring new request.");
                return;
            }

            // [NEW] IDLE TRIGGER LOGIC (2.5s Delay)
            console.log("ATOM: Micro requested. Waiting for idle (2.5s)...");
            const requestTime = Date.now();

            pendingMicroClosureTimer = setTimeout(() => {
                pendingMicroClosureTimer = null; // Release Lock

                // [FIX RISK 3] Kiểm tra tương tác trong lúc chờ
                // Nếu user vừa click/keydown/scroll SAU lúc request -> Hủy
                if (lastInteractionTime > requestTime) {
                    console.log("ATOM: Micro aborted due to user activity.");
                    chrome.runtime.sendMessage({
                        type: "INTERVENTION_ABORTED",
                        payload: { url: window.location.href }
                    });
                    return;
                }

                // Trigger thật
                isInterventionActive = true;
                shouldShowJournal = false;
                microRenderer.render(data.payload, (action) => {
                    console.log("ATOM Micro Action:", action);

                    if (action === 'finish_session') {
                        activeScrollSeconds = 0;
                    }
                    else if (action === 'snooze_delay') {
                        activeScrollSeconds = Math.max(0, activeScrollSeconds - 60);
                    }
                    else if (action === 'AUTO_DISMISSED_BY_SCROLL') {
                        activeScrollSeconds = 0;
                    }
                    else if (action === 'FAST_DISMISS_BY_SCROLL' || action === 'TIMEOUT_IGNORED' || action === 'IGNORED_BY_SCROLL') {
                        activeScrollSeconds = 0;
                    }
                    isInterventionActive = false;
                });

            }, 2500);

            return;
        }

        // 2. Xử lý các loại lệnh can thiệp mạnh (Layer 1)
        if (data.type === 'hard_interrupt' || data.type === 'ghost_overlay') {
            // Khi có can thiệp mạnh, tạm ẩn Orb để tập trung vào Overlay
            updatePresenceState(false);
            microRenderer?.remove?.();
            resetUI();

            const mode = data.payload?.mode;
            const interventionId = data.payload?.intervention_id;

            if (mode === 'STILLNESS') {
                startStillnessMode(interventionId);
            } else if (mode === 'BREATH') {
                startBreathingMode(interventionId);
            } else if (mode === 'TAP') {
                startTapHoldMode(data.payload?.text, 3000, interventionId);
            } else {
                // Dự phòng (Fallback) nếu background gửi thiếu mode
                startBreathingMode(interventionId);
            }
            return;
        }

        // 3. Xử lý Silence loại A (Respectful Silence)
        if (data.type === 'none') {
            updatePresenceState(false);
            microRenderer?.remove?.();
            resetUI();
            return;
        }
    }
    const updateActivity = (e) => {
        const now = Date.now();

        // Tính toán khoảng cách vừa cuộn
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;
        const absDelta = Math.abs(delta);

        // Cộng dồn vào tổng số (chỉ tính khi có thay đổi)
        if (absDelta > 0) {
            totalPixelsScrolled += absDelta;
            lastScrollY = currentScrollY;
            lastScrollDelta = delta;
        } else {
            lastScrollDelta = 0;
        }

        lastActivityTime = now;

        // [NEW] Logic phân loại tương tác (Bỏ qua mousemove cho Idle Trigger)
        if (e && e.type !== 'mousemove') {
            lastInteractionTime = now;
        }
    };

    const handleScrollEvent = () => {
        const now = Date.now();
        if (!lastScrollDelta) return;

        const dwellMs = Math.max(0, now - lastScrollEventAt);
        if (dwellMs > 0 && dwellMs < 30000) {
            dwellEvents.push({ t: now, ms: dwellMs });
            pruneTimed(dwellEvents, now);
        }

        scrollEvents.push({ t: now, delta: lastScrollDelta });
        pruneTimed(scrollEvents, now);

        if (prevScrollDelta && Math.sign(prevScrollDelta) !== Math.sign(lastScrollDelta)) {
            directionChangeEvents.push({ t: now });
            pruneTimed(directionChangeEvents, now);
        }

        if (lastScrollDelta < -80) {
            scrollBackEvents.push({ t: now });
            pruneTimed(scrollBackEvents, now);
        }

        prevScrollDelta = lastScrollDelta;
        lastScrollEventAt = now;
    };

    const handleKeydown = (e) => {
        updateActivity(e);
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "f") {
            recordAction("find");
        }
        const isTyping = e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (isTyping) recordAction("typing");
    };

    // Chỉ bắt sự kiện Scroll, Click, Keydown và MouseMove
    // Đây là dấu hiệu người dùng ĐANG THỰC SỰ SỬ DỤNG
    window.addEventListener('scroll', (e) => {
        updateActivity(e);
        handleScrollEvent();
    }, { passive: true });
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('mousemove', updateActivity);

    let lastSelectAt = 0;
    document.addEventListener("selectionchange", () => {
        const now = Date.now();
        if (now - lastSelectAt < 1000) return;
        const text = getSelectedText();
        if (text) {
            lastSelectAt = now;
            recordAction("select");
        }
    });

    document.addEventListener("copy", () => recordAction("copy"));

    document.addEventListener("click", (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const link = target ? target.closest("a") : null;
        if (link && link.href) recordAction("openLink");
    }, true);

    // --- GLOBAL EVENT: AUTO-CLOSE JOURNAL ON BLUR ---
    function handleJournalFocusLoss() {
        if (!isJournalActive) return;

        // Case 1: Đang ở bước hỏi (Step 1) -> User switch tab -> Đóng luôn
        if (!isJournalFormActive) {
            closeJournal();
            return;
        }

        // Case 2: Đang viết (Step 2) -> User switch tab -> KHÔNG ĐÓNG (để user ko mất bài)

        // Case 3: Đã lưu (Saved) -> User switch tab -> Đóng luôn
        if (isJournalSaved) {
            closeJournal();
        }
    }

    window.addEventListener('blur', handleJournalFocusLoss);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) handleJournalFocusLoss();
    });

    // --- 6. SERVER COMMUNICATION ---
    async function sendTick() {
        if (!chrome.runtime?.id) return;
        if (document.hidden) {
            lastTickAt = Date.now(); // để khỏi dt nhảy khi quay lại
            return;
        }
        // Nếu đang bị can thiệp hoặc viết nhật ký -> Không đếm giờ
        // Thêm isFocusBlockActive để dừng TICK khi Focus block đang hiện
        // [UPDATED] Nếu là BREAK phase -> Cũng dừng TICK luôn (nghỉ ngơi hoàn toàn)
        if (isInterventionActive || isJournalActive || isFocusBlockActive || atomFocusPhase === "BREAK") {
            lastTickAt = Date.now(); // <-- NEW: tránh dtSec nhảy sau khi pause
            return;
        }

        const now = Date.now();
        const dtSec = Math.min((now - lastTickAt) / 1000, 10); // clamp 10s
        lastTickAt = now;
        const timeSinceLastAct = now - lastActivityTime;

        // ĐIỀU KIỆN 1: Tab phải đang hiển thị (Không bị ẩn, không minimized, không ở tab khác)
        const isTabVisible = !document.hidden;

        // ĐIỀU KIỆN 2: Người dùng phải có thao tác trong 5 giây gần nhất
        const isUserActive = timeSinceLastAct <= IDLE_THRESHOLD;

        if (isTabVisible && isUserActive) {
            activeScrollSeconds += dtSec;
            activeEvents.push({ t: now, dt: dtSec });
            pruneTimed(activeEvents, now);

            console.log(`ATOM Tracking: Active ${activeScrollSeconds}s`);

            try {
                const response = await chrome.runtime.sendMessage({
                    type: "TICK",
                    payload: {
                        url: window.location.href,
                        continuous_scroll_sec: activeScrollSeconds, // Gửi thời gian thực tế
                        scroll_px: totalPixelsScrolled,
                        frame_v2: buildObservationFrameV2()
                    }
                });

                if (response && response.type && !isJournalActive) {
                    // (Paste lại hàm dispatchFromPipeline ở code cũ nếu chưa có)
                    if (typeof dispatchFromPipeline === 'function') {
                        dispatchFromPipeline(response);
                    }
                }
            } catch (error) {
                // Ignored
            }
        } else {
            // Nếu user nghỉ quá lâu (vd: 60s), có thể reset bộ đếm để tính là phiên mới?
            // Hiện tại logic này: Nếu ngừng lướt -> Timer đứng yên. Lướt tiếp -> Timer chạy tiếp.
            if (timeSinceLastAct > SESSION_RESET_TIME && activeScrollSeconds > 0) {
                console.log("ATOM: Session reset due to inactivity.");
                activeScrollSeconds = 0; // Reset nếu bỏ đi quá lâu
            }
        }
    }

    // --- 7. FIX INPUT EVENTS ---
    const journalInput = shadow.querySelector('.journal-input');
    const stopPropagation = (e) => e.stopPropagation();

    if (journalInput) {
        journalInput.addEventListener('keydown', stopPropagation);
        journalInput.addEventListener('keypress', stopPropagation);
        journalInput.addEventListener('keyup', stopPropagation);
    }

    // [QUAN TRỌNG - Fix A] Chỉ start loop sau khi microRenderer init xong
    microRendererReady.finally(() => {
        console.log("ATOM: Pipeline started after renderer init.");
        const tickInterval = setInterval(() => {
            if (!chrome.runtime?.id) {
                clearInterval(tickInterval);
                return;
            }
            sendTick();
        }, 5000);
    });
})();

