// content.js - FIXED: OPT-IN JOURNAL & EVENT LISTENER BUG
(() => {
    console.log("🔥 ATOM content.js injected", window.location.href);
    if (window.top !== window) {
        return;
    }

    // ✅ GUARD: tránh inject/khởi chạy nhiều lần trên cùng 1 frame
    if (window.__ATOM_CONTENT_STARTED__) {
        console.log("ATOM: content already started");
        return;
    }
    window.__ATOM_CONTENT_STARTED__ = true;
    // --- 0. KHỞI TẠO ---
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
            (ack) => console.log("[ATOM LOG_EVENT ACK]", ack)
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
        <svg class="tap-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
            <path d="M16.5 22a2.12 2.12 0 0 1-2.06 1.76h-5.22a6 6 0 0 1-5.69-4.12l-1.53-5.22a2 2 0 0 1 2.37-2.48l1.63.41"></path>
            <path d="M6 12.38V18"></path>
        </svg>
    </div>
    <div class="hint-text" id="tap-text">${chrome.i18n.getMessage("ui_tap_hold")}</div>
  </div>

  <div id="ui-stillness" class="ui-mode hidden" style="flex-direction:column; align-items:center;">
    <div class="still-circle">
        <svg class="ring-svg" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="78" stroke="rgba(255,255,255,0.1)" stroke-width="4" fill="none"></circle>
            <circle id="stillness-ring" class="progress-ring-circle" cx="80" cy="80" r="78" stroke-dasharray="490" stroke-dashoffset="0"></circle>
        </svg>
        <div class="still-timer-text" id="stillness-timer">7</div>
    </div>
    <div class="hint-text" id="stillness-text">${chrome.i18n.getMessage("ui_stillness_hint")}</div>
  </div>
`;
    shadow.appendChild(overlay);

    // 1.2 Presence Orb
    const presenceOrb = document.createElement('div');
    presenceOrb.id = 'atom-presence-orb';
    presenceOrb.innerHTML = '<div class="orb-core-light"></div>';
    shadow.appendChild(presenceOrb);

    // --- 1.3 Journal Dialog (CẤU TRÚC MỚI: 2 BƯỚC) ---
    const journalDialog = document.createElement('div');
    journalDialog.id = 'atom-journal-dialog';
    journalDialog.innerHTML = `
    <div id="btn-close-x" style="position:absolute; top:12px; right:15px; cursor:pointer; font-size:18px; color:rgba(255,255,255,0.5); padding:5px; z-index:10;">✕</div>

    <div id="journal-step-ask">
        <div class="journal-title" style="margin-bottom: 20px;">
            ${chrome.i18n.getMessage("journal_ask_title")}
        </div>
        <div style="display:flex; justify-content: center; gap: 15px;">
            <button id="btn-ask-no" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:#ccc; padding:8px 20px; border-radius:20px; cursor:pointer;">
                ${chrome.i18n.getMessage("journal_btn_skip")}
            </button>
            <button id="btn-ask-yes" style="background:#A7F3D0; border:none; color:#064E3B; padding:8px 25px; border-radius:20px; font-weight:bold; cursor:pointer;">
                ${chrome.i18n.getMessage("journal_btn_write")}
            </button>
        </div>
    </div>

    <div id="journal-step-form" style="display:none;">
        <div class="journal-title" id="form-title">
            ${chrome.i18n.getMessage("journal_form_title")}
        </div>
        
        <div class="emoji-row">
            <button class="emoji-btn" data-val="focused">😌</button>
            <button class="emoji-btn" data-val="bored">😐</button>
            <button class="emoji-btn" data-val="anxious">😰</button>
            <button class="emoji-btn" data-val="tired">😴</button>
            <button class="emoji-btn" data-val="angry">😤</button>
        </div>

        <div class="tag-container" id="journal-tags">
            <span class="journal-tag" data-val="habit">${chrome.i18n.getMessage("tag_habit")}</span>
            <span class="journal-tag" data-val="procrastinate">${chrome.i18n.getMessage("tag_procrastinate")}</span>
            <span class="journal-tag" data-val="stress">${chrome.i18n.getMessage("tag_stress")}</span>
            <span class="journal-tag" data-val="fomo">${chrome.i18n.getMessage("tag_fomo")}</span>
            <span class="journal-tag" data-val="inspiration">${chrome.i18n.getMessage("tag_inspiration")}</span>
        </div>

        <div class="journal-footer">
            <span id="btn-expand-text" style="cursor:pointer; text-decoration:underline;">
                ${chrome.i18n.getMessage("journal_btn_expand")}
            </span>
            <span class="btn-save-journal" id="btn-save">
                ${chrome.i18n.getMessage("journal_btn_saved")}
            </span>
        </div>
        
        <div class="journal-input-area" id="journal-input-wrap">
            <textarea class="journal-input" rows="2" placeholder="${chrome.i18n.getMessage("journal_placeholder")}"></textarea>
        </div>

        <div id="ai-response-area" style="display:none; margin-top:15px; padding:15px; background:rgba(167, 243, 208, 0.1); border-radius:8px; border:1px solid rgba(167, 243, 208, 0.3); color:#A7F3D0; font-size:14px; line-height:1.5; max-height: 200px; overflow-y: auto;"></div>
    </div>
`;
    shadow.appendChild(journalDialog);

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
        chrome.runtime.sendMessage(
            {
                type: "LOG_REACTION",
                payload: {
                    action: finalAction,
                    type: activeMode,
                    kind: currentIntervention?.kind || null,   // <-- NEW
                    intervention_id: interventionId,
                    shown_at: shownAt,
                    reacted_at: reactedAt,
                    duration_ms: durationMs
                }
            },
            (ack) => console.log("[ATOM LOG_REACTION ACK]", ack)
        );

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

    // 3.1 Hàm hiển thị bước hỏi (Step 1)
    function showJournalPrompt() {
        if (isJournalActive) return;
        isJournalActive = true; // Khóa
        journalDialog.classList.add('visible');

        // Reset view về Step 1
        shadow.querySelector('#journal-step-ask').style.display = 'block';
        shadow.querySelector('#journal-step-form').style.display = 'none';
    }

    // 3.2 Hàm chuyển sang form viết (Step 2)
    function switchToJournalForm() {
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
        shadow.querySelector('#form-title').innerText = chrome.i18n.getMessage("journal_form_title");

        // QUAN TRỌNG: Reset nút Save về trạng thái ban đầu
        const btnSave = shadow.querySelector('#btn-save');
        btnSave.style.display = 'none'; // Ẩn nút save khi chưa chọn gì
        btnSave.innerText = chrome.i18n.getMessage("journal_btn_saved");
        btnSave.style.opacity = "1";
        btnSave.style.cursor = "pointer";

        // Gán lại sự kiện click gốc cho nút save
        btnSave.onclick = handleSaveJournal;
    }

    // 3.3 Hàm đóng toàn bộ
    function closeJournal() {
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
        btnSave.innerText = chrome.i18n.getMessage("journal_btn_processing");
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
                shadow.querySelector('#form-title').innerText = chrome.i18n.getMessage("journal_ai_title");

                // Chuyển nút Save thành nút Đóng
                btnSave.innerText = chrome.i18n.getMessage("journal_btn_understood");
                btnSave.className = "btn-closed";
                btnSave.style.opacity = "1";
                btnSave.style.cursor = "pointer";

                // Gán hành động Đóng cho lần click tiếp theo
                btnSave.onclick = closeJournal;
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

    function startBreathingMode() {
        if (isInterventionActive) return;
        isInterventionActive = true;
        shouldShowJournal = false; // Mặc định là false (nếu bỏ qua)

        const ui = shadow.querySelector('#ui-breath');
        const label = shadow.querySelector('#breath-text');
        const circle = shadow.querySelector('#breath-circle');

        resetUI();
        ui.classList.remove('hidden');
        ui.style.display = 'flex';
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - BREATH
        currentIntervention = { id: makeInterventionId(), mode: "BREATH", kind: "HARD_INTERRUPT", shownAt: Date.now() };
        emitAtomEvent("SHOWN", "BREATH", {
            intervention_id: currentIntervention.id,
            shown_at: currentIntervention.shownAt
        });

        label.innerText = chrome.i18n.getMessage("ui_breath_hold_start");
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
            label.innerText = chrome.i18n.getMessage("ui_breath_inhale");
            label.style.color = "#A7F3D0"; // Xanh nhẹ

            // --- PHASE 2: GIỮ HƠI (4s - 11s) ---
            breathTimer1 = setTimeout(() => {
                if (circle.classList.contains('active')) {
                    label.innerText = chrome.i18n.getMessage("ui_breath_hold");
                    label.style.color = "#FBBF24"; // Vàng
                }
            }, 4000);

            // --- PHASE 3: THỞ RA (11s - 19s) ---
            breathTimer2 = setTimeout(() => {
                if (circle.classList.contains('active')) {
                    label.innerText = chrome.i18n.getMessage("ui_breath_exhale");
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
                label.innerText = chrome.i18n.getMessage("ui_breath_success");
                label.style.color = "#FBBF24";

                shouldShowJournal = true; // Bật nhật ký
                setTimeout(closeIntervention, 500);
            } else {
                // Chưa đủ 4s
                label.innerText = chrome.i18n.getMessage("ui_breath_fail");
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

    function startTapHoldMode(text, duration = 3000) {
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
        ui.classList.remove('hidden');
        ui.style.display = 'flex';
        label.innerText = text || chrome.i18n.getMessage("ui_tap_hold");
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - TAP
        currentIntervention = { id: makeInterventionId(), mode: "TAP", kind: "HARD_INTERRUPT", shownAt: Date.now() };
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

            label.innerText = chrome.i18n.getMessage("ui_tap_fail"); // Thay cho "Giữ lâu hơn..."
            label.style.color = "#F87171"; // Cảnh báo nhẹ
        };

        btn.onmousedown = onDown;
        btn.ontouchstart = onDown;
        btn.onmouseup = onUp;
        btn.onmouseleave = onUp;
        btn.ontouchend = onUp;
    }
    // content.js - MODE C: STILLNESS (UPDATED: 3s MOVE = IGNORE, 7s STILL = SUCCESS)

    function startStillnessMode() {
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
        ui.classList.remove('hidden');
        ui.style.display = 'flex';
        overlay.classList.add('state-visible');
        // [LOG V2] SHOWN - STILLNESS
        currentIntervention = { id: makeInterventionId(), mode: "STILLNESS", kind: "HARD_INTERRUPT", shownAt: Date.now() };
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
                label.innerText = chrome.i18n.getMessage("ui_stillness_success");
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
            label.innerText = chrome.i18n.getMessage("ui_stillness_warning");
            label.style.color = "#F87171"; // Màu đỏ cảnh báo

            // Reset lại thời gian tĩnh lặng (bắt buộc phải tĩnh lại từ đầu)
            startTime = Date.now();
            ring.style.strokeDashoffset = '0';
            timerText.innerText = Math.ceil(TARGET_DURATION / 1000);

            // --- THẤT BẠI: DI CHUYỂN QUÁ 3 GIÂY ---
            if (movingDuration > MOVE_LIMIT) {
                isFailed = true;
                shouldShowJournal = false; // Bỏ qua -> Không hiện nhật ký

                label.innerText = chrome.i18n.getMessage("ui_stillness_fail");
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
                    label.innerText = chrome.i18n.getMessage("ui_stillness_hint");
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

            if (mode === 'STILLNESS') {
                startStillnessMode();
            } else if (mode === 'BREATH') {
                startBreathingMode();
            } else if (mode === 'TAP') {
                startTapHoldMode(data.payload?.text);
            } else {
                // Dự phòng (Fallback) nếu background gửi thiếu mode
                startBreathingMode();
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
        const delta = Math.abs(currentScrollY - lastScrollY);

        // Cộng dồn vào tổng số (chỉ tính khi có thay đổi)
        if (delta > 0) {
            totalPixelsScrolled += delta;
            lastScrollY = currentScrollY;
        }

        lastActivityTime = now;

        // [NEW] Logic phân loại tương tác (Bỏ qua mousemove cho Idle Trigger)
        if (e && e.type !== 'mousemove') {
            lastInteractionTime = now;
        }
    };

    // Chỉ bắt sự kiện Scroll, Click, Keydown và MouseMove
    // Đây là dấu hiệu người dùng ĐANG THỰC SỰ SỬ DỤNG
    window.addEventListener('scroll', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('mousemove', updateActivity);

    // --- 6. SERVER COMMUNICATION ---
    async function sendTick() {
        if (document.hidden) {
            lastTickAt = Date.now(); // để khỏi dt nhảy khi quay lại
            return;
        }
        // Nếu đang bị can thiệp hoặc viết nhật ký -> Không đếm giờ
        if (isInterventionActive || isJournalActive) {
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

            console.log(`ATOM Tracking: Active ${activeScrollSeconds}s`);

            try {
                const response = await chrome.runtime.sendMessage({
                    type: "TICK",
                    payload: {
                        url: window.location.href,
                        continuous_scroll_sec: activeScrollSeconds, // Gửi thời gian thực tế
                        scroll_px: totalPixelsScrolled
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
        setInterval(sendTick, 5000);
    });
})();
