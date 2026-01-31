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
    const domainLabel = document.getElementById('current-domain');
    const btnToggleSafe = document.getElementById('btn-toggle-safe');
    const btnJournal = document.getElementById('btn-journal');
    const btnSettings = document.getElementById('btn-open-settings');
    const btnExport = document.getElementById('btn-export');
    const btnClear = document.getElementById('btn-clear');
    const btnWeb = document.getElementById('btn-website');
    const btnReportBug = document.getElementById('btn-report-bug');
    const btnDebug = document.getElementById('btn-debug-panel');
    const updateBanner = document.getElementById('update-banner');

    // Check for Store update and show banner
    checkAndShowUpdateBanner();

    // Display current sensitivity mode
    displaySensitivityMode();

    // Show debug panel link only when debug_mode is enabled
    if (btnDebug) {
        const debugState = await chrome.storage.local.get(['debug_mode']);
        if (debugState.debug_mode) {
            btnDebug.style.display = 'inline-flex';
            btnDebug.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('debug.html') });
            });
        }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        try {
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
                domainLabel.innerText = atomMsg("pop_system_page");
                if (btnToggleSafe) btnToggleSafe.style.display = 'none';
            } else {
                const urlObj = new URL(tab.url);
                const currentDomain = urlObj.hostname.replace('www.', '').toLowerCase();
                domainLabel.innerText = currentDomain;
                checkSafeZoneStatus(currentDomain);
            }
        } catch (e) {
            domainLabel.innerText = atomMsg("pop_unknown_page");
            if (btnToggleSafe) btnToggleSafe.style.display = 'none';
        }
    } else {
        domainLabel.innerText = atomMsg("popup_no_active_tab");
        if (btnToggleSafe) btnToggleSafe.style.display = 'none';
    }

    async function checkSafeZoneStatus(domain) {
        const data = await chrome.storage.local.get(['atom_whitelist']);
        const whitelist = data.atom_whitelist || [];
        const isSafe = whitelist.includes(domain);
        updateSafeBtnUI(isSafe);

        if (btnToggleSafe) {
            btnToggleSafe.onclick = async () => {
                const newData = await chrome.storage.local.get(['atom_whitelist']);
                let currentList = newData.atom_whitelist || [];
                if (isSafe) {
                    currentList = currentList.filter(d => d !== domain);
                    await chrome.storage.local.set({ atom_whitelist: currentList });
                    updateSafeBtnUI(false);
                    if (tab.id) chrome.tabs.reload(tab.id);
                } else {
                    if (!currentList.includes(domain)) currentList.push(domain);
                    await chrome.storage.local.set({ atom_whitelist: currentList });
                    updateSafeBtnUI(true);
                    if (tab.id) chrome.tabs.reload(tab.id);
                }
                checkSafeZoneStatus(domain);
            };
        }
    }

    function updateSafeBtnUI(isSafe) {
        if (!btnToggleSafe) return;

        const statusDot = document.getElementById('site-status');
        const statusText = document.getElementById('safe-zone-status');

        // Icons from landing page context
        // Compass (Leaf-like) -> For enabling ATOM (Compass Approach)
        const iconCompass = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`;

        // Ban (Blocker-like) -> For disabling ATOM (Jail Approach / Stop)
        const iconBan = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;

        if (isSafe) {
            btnToggleSafe.className = "btn-toggle-status active";
            btnToggleSafe.innerHTML = iconCompass + atomMsg("pop_btn_safe_remove_new");
            if (statusDot) statusDot.classList.add('active');
            if (statusText) {
                statusText.innerText = atomMsg("pop_status_off");
                statusText.style.color = "var(--muted)";
            }
        } else {
            btnToggleSafe.className = "btn-toggle-status";
            btnToggleSafe.innerHTML = iconBan + atomMsg("pop_btn_safe_add_new");
            if (statusDot) statusDot.classList.remove('active');
            if (statusText) {
                statusText.innerText = atomMsg("pop_status_running");
                statusText.style.color = "var(--primary)";
            }
        }
    }

    if (btnJournal) {
        btnJournal.addEventListener('click', () => {
            chrome.tabs.create({ url: 'journal.html' });
        });
    }

    const btnMemory = document.getElementById('btn-memory');
    if (btnMemory) {
        btnMemory.addEventListener('click', () => {
            chrome.tabs.create({ url: 'memory.html' });
        });
    }

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    }

    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const originalText = btnExport.innerText;
            btnExport.innerText = atomMsg("popup_msg_packing");
            try {
                const data = await chrome.storage.local.get(null);
                const exportData = {
                    _meta: {
                        exported_at: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        version: chrome.runtime.getManifest().version
                    },
                    ...data
                };
                const jsonStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                a.download = `ATOM_Data_${timestamp}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                btnExport.innerText = atomMsg("popup_msg_downloaded");
                setTimeout(() => { btnExport.innerText = originalText; }, 2000);
            } catch (err) {
                console.error(err);
                btnExport.innerText = atomMsg("popup_msg_error") + err.message;
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const confirmMsg = atomMsg("popup_confirm_reset");
            if (confirm(confirmMsg)) {
                await chrome.storage.local.clear();
                chrome.runtime.reload();
                window.close();
            }
        });
    }

    if (btnWeb) {
        btnWeb.addEventListener('click', () => {
            chrome.tabs.create({ url: 'https://atom-web-gamma.vercel.app/' });
        });
    }

    // Report Bug button
    if (btnReportBug) {
        btnReportBug.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('bug_report.html') });
        });
    }

    // Check and show update banner
    async function checkAndShowUpdateBanner() {
        try {
            const data = await chrome.storage.local.get(['store_update_available', 'store_url', 'update_dismissed']);

            if (data.store_update_available && data.store_url && !data.update_dismissed) {
                const banner = document.getElementById('update-banner');
                if (banner) {
                    banner.style.display = 'block';

                    // Click to open Store
                    banner.addEventListener('click', () => {
                        chrome.tabs.create({ url: data.store_url });
                    });
                }
            }
        } catch (e) {
            console.log("ATOM: Update banner check failed", e);
        }
    }

    // Display current sensitivity mode in popup
    async function displaySensitivityMode() {
        try {
            const data = await chrome.storage.local.get(['user_sensitivity', 'adaptive_multiplier']);
            const sensitivity = data.user_sensitivity || 'balanced';
            const multiplier = data.adaptive_multiplier || 1.0;

            const badge = document.getElementById('sensitivity-badge');
            const label = document.getElementById('sensitivity-label');

            if (badge && label) {
                // Remove all mode classes first
                badge.classList.remove('gentle', 'balanced', 'strict');
                badge.classList.add(sensitivity);

                // Set label text with multiplier info if not 1.0
                const modeLabels = {
                    gentle: atomMsg('opt_sens_gentle_title'),
                    balanced: atomMsg('opt_sens_balanced_title'),
                    strict: atomMsg('opt_sens_strict_title')
                };

                let labelText = modeLabels[sensitivity] || atomMsg('opt_sens_balanced_title');
                if (multiplier !== 1.0) {
                    labelText += ` x${multiplier.toFixed(1)}`;
                }
                label.innerText = labelText;
            }
        } catch (e) {
            console.log("ATOM: Failed to display sensitivity mode", e);
        }
    }

    const elStatus = document.getElementById("focus-status");
    const btnStart = document.getElementById("focus-start");
    const btnStop = document.getElementById("focus-stop");
    const btnReset = document.getElementById("focus-reset");
    const inWork = document.getElementById("focus-work");
    const breakPreview = document.getElementById("focus-break-preview");

    // Tự động tính Break = 1/5 Focus time
    function calcBreak(workMin) {
        return Math.ceil(workMin / 5);
    }

    // Cập nhật preview Break khi user nhập Focus time
    function updateBreakPreview() {
        const w = Number(inWork?.value || 0);
        if (w > 0 && breakPreview) {
            breakPreview.textContent = `${calcBreak(w)}m`;
        } else if (breakPreview) {
            breakPreview.textContent = "-";
        }
    }

    if (inWork) {
        inWork.addEventListener("input", updateBreakPreview);
    }

    function fmt(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        const mm = String(Math.floor(s / 60)).padStart(2, "0");
        const ss = String(s % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }

    async function getFocusState() {
        const resp = await chrome.runtime.sendMessage({ type: "FOCUS_GET_STATE" });
        return resp?.atom_focus_state || null;
    }

    function renderFocus(st) {
        if (!elStatus) return;
        if (!st?.enabled) {
            elStatus.textContent = "Focus: OFF";
            if (btnStart) btnStart.style.display = "inline-flex";
            if (btnStop) btnStop.style.display = "none";
            if (btnReset) btnReset.style.display = "none";
            return;
        }
        const now = Date.now();
        elStatus.textContent = `${st.phase} còn ${fmt(st.phaseEndsAt - now)}`;
        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "inline-flex";
        if (btnReset) btnReset.style.display = "inline-flex";
    }

    async function startFocus(workMin, breakMin) {
        await chrome.runtime.sendMessage({ type: "FOCUS_START", payload: { workMin, breakMin } });
        const st = await getFocusState();
        renderFocus(st);
    }

    async function stopFocus() {
        await chrome.runtime.sendMessage({ type: "FOCUS_STOP" });
        const st = await getFocusState();
        renderFocus(st);
    }

    if (btnStart) btnStart.onclick = async () => {
        const w = Number(inWork?.value || 25);
        const b = calcBreak(w); // Tự động tính Break = Focus / 5
        await startFocus(w, b);
    };

    if (btnStop) btnStop.onclick = stopFocus;

    if (btnReset) btnReset.onclick = async () => {
        try {
            await chrome.runtime.sendMessage({ type: "FOCUS_RESET_PHASE" });
            const st = await getFocusState();
            renderFocus(st);
        } catch (e) {
            console.warn("[ATOM] Popup reset failed:", e);
        }
    };

    // Preset chỉ cần Focus time, Break tự động tính
    const preset = (id, w) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = () => {
            if (inWork) inWork.value = w;
            updateBreakPreview();
            startFocus(w, calcBreak(w));
        };
    };
    preset("focus-preset-10", 10);
    preset("focus-preset-25", 25);
    preset("focus-preset-30", 30);
    preset("focus-preset-40", 40);
    preset("focus-preset-50", 50);

    let focusUiTimer = null;
    (async () => {
        const st = await getFocusState();
        renderFocus(st);
        clearInterval(focusUiTimer);
        focusUiTimer = setInterval(async () => {
            const st2 = await getFocusState();
            renderFocus(st2);
        }, 1000);
    })();

});

