document.addEventListener('DOMContentLoaded', async () => {
    const domainLabel = document.getElementById('current-domain');
    const btnToggleSafe = document.getElementById('btn-toggle-safe');
    const btnJournal = document.getElementById('btn-journal');
    const btnSettings = document.getElementById('btn-open-settings');
    const btnExport = document.getElementById('btn-export');
    const btnClear = document.getElementById('btn-clear');
    const btnWeb = document.getElementById('btn-website');
    const btnReportBug = document.getElementById('btn-report-bug');
    const updateBanner = document.getElementById('update-banner');

    // Check for Store update and show banner
    checkAndShowUpdateBanner();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
        try {
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
                domainLabel.innerText = chrome.i18n.getMessage("pop_system_page");
                if (btnToggleSafe) btnToggleSafe.style.display = 'none';
            } else {
                const urlObj = new URL(tab.url);
                const currentDomain = urlObj.hostname.replace('www.', '').toLowerCase();
                domainLabel.innerText = currentDomain;
                checkSafeZoneStatus(currentDomain);
            }
        } catch (e) {
            domainLabel.innerText = chrome.i18n.getMessage("pop_unknown_page");
            if (btnToggleSafe) btnToggleSafe.style.display = 'none';
        }
    } else {
        domainLabel.innerText = "No Active Tab";
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
            btnToggleSafe.innerHTML = iconCompass + chrome.i18n.getMessage("pop_btn_safe_remove_new");
            if (statusDot) statusDot.classList.add('active');
            if (statusText) {
                statusText.innerText = chrome.i18n.getMessage("pop_status_off");
                statusText.style.color = "var(--muted)";
            }
        } else {
            btnToggleSafe.className = "btn-toggle-status";
            btnToggleSafe.innerHTML = iconBan + chrome.i18n.getMessage("pop_btn_safe_add_new");
            if (statusDot) statusDot.classList.remove('active');
            if (statusText) {
                statusText.innerText = chrome.i18n.getMessage("pop_status_running");
                statusText.style.color = "var(--primary)";
            }
        }
    }

    if (btnJournal) {
        btnJournal.addEventListener('click', () => {
            chrome.tabs.create({ url: 'journal.html' });
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
            btnExport.innerText = chrome.i18n.getMessage("popup_msg_packing");
            try {
                const data = await chrome.storage.local.get(null);
                const exportData = {
                    _meta: {
                        exported_at: new Date().toISOString(),
                        user_agent: navigator.userAgent,
                        version: "1.4.9"
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
                btnExport.innerText = chrome.i18n.getMessage("popup_msg_downloaded");
                setTimeout(() => { btnExport.innerText = originalText; }, 2000);
            } catch (err) {
                console.error(err);
                btnExport.innerText = chrome.i18n.getMessage("popup_msg_error") + err.message;
            }
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const confirmMsg = chrome.i18n.getMessage("popup_confirm_reset");
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

});