// options.js

document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();   // 2. Sau đó mới load dữ liệu

    // Debug Mode Toggle listener
    const debugToggle = document.getElementById('debugModeToggle');
    if (debugToggle) {
        debugToggle.addEventListener('change', (e) => {
            chrome.storage.local.set({ debug_mode: e.target.checked }, () => {
                console.log("ATOM: Debug Mode =", e.target.checked);
            });
        });
    }

    // Export Debug Log button
    const btnExportDebug = document.getElementById('btn-export-debug');
    if (btnExportDebug) {
        btnExportDebug.addEventListener('click', exportDebugLog);
    }
});

document.getElementById('btn-save').addEventListener('click', saveOptions);

// 1. Lưu Key vào Chrome Storage
function saveOptions() {
    const key = document.getElementById('apiKeyInput').value.trim();
    const sensitivity = document.querySelector('input[name="sensitivity"]:checked').value;
    const debugMode = document.getElementById('debugModeToggle')?.checked || false;
    const status = document.getElementById('status');
    const btn = document.getElementById('btn-save');

    // Hiệu ứng "Đang lưu..."
    btn.textContent = '...';
    btn.disabled = true;

    chrome.storage.local.set({
        user_gemini_key: key,
        user_sensitivity: sensitivity,
        debug_mode: debugMode
    }, () => {
        // Feedback UI: Dùng text từ file ngôn ngữ
        // key "opt_save_success" = "Đã lưu thành công!"
        status.textContent = '✅ ' + chrome.i18n.getMessage("opt_save_success");
        status.className = 'success';

        btn.textContent = '✅ OK';
        btn.style.backgroundColor = '#059669'; // Đổi màu xanh
        btn.disabled = false;

        // Log kiểm tra
        console.log("ATOM: Saved Key =", key ? "***" : "Empty");
        console.log("ATOM: Saved Sensitivity =", sensitivity);
        console.log("ATOM: Saved Debug Mode =", debugMode);

        setTimeout(() => {
            status.textContent = '';
            // Trả lại text gốc của nút bấm (Lưu Cài Đặt / Save Settings)
            btn.textContent = chrome.i18n.getMessage("opt_btn_save");
            btn.style.backgroundColor = '#374151'; // Về màu gốc
        }, 2000);
    });
}

// 2. Khôi phục Key đã lưu khi mở trang
function restoreOptions() {
    // Lấy cả Key và Sensitivity từ bộ nhớ
    chrome.storage.local.get(['user_gemini_key', 'user_sensitivity', 'debug_mode'], (result) => {
        console.log("ATOM: Restoring Data...", result);
        // 1. Khôi phục Key
        if (result.user_gemini_key) {
            document.getElementById('apiKeyInput').value = result.user_gemini_key;
        }

        // 2. Khôi phục Sensitivity (Mặc định 'balanced' nếu chưa có)
        const savedMode = result.user_sensitivity || 'balanced';
        const radioToCheck = document.querySelector(`input[name="sensitivity"][value="${savedMode}"]`);
        if (radioToCheck) {
            radioToCheck.checked = true;
        }

        // 3. Khôi phục Debug Mode
        const debugToggle = document.getElementById('debugModeToggle');
        if (debugToggle) {
            debugToggle.checked = result.debug_mode || false;
        }
    });
}

// 3. Export Debug Log - Collect all relevant data for bug reports
async function exportDebugLog() {
    const btn = document.getElementById('btn-export-debug');
    const originalHTML = btn.innerHTML;

    btn.innerHTML = '<span>' + chrome.i18n.getMessage('opt_debug_collecting') + '</span>';
    btn.disabled = true;

    try {
        // Collect all storage data
        const data = await chrome.storage.local.get(null);

        // Build debug report
        const debugReport = {
            _meta: {
                exported_at: new Date().toISOString(),
                extension_version: chrome.runtime.getManifest().version,
                user_agent: navigator.userAgent,
                language: chrome.i18n.getUILanguage()
            },
            settings: {
                sensitivity: data.user_sensitivity || 'balanced',
                debug_mode: data.debug_mode || false,
                has_api_key: !!data.user_gemini_key // Don't expose actual key
            },
            state: {
                snooze_until: data.snoozeUntil ? new Date(data.snoozeUntil).toISOString() : null,
                adaptive_multiplier: data.adaptive_multiplier || 1.0,
                whitelist_count: (data.atom_whitelist || []).length
            },
            recent_reactions: (data.atom_reactions || []).slice(-20),
            recent_events: (data.atom_events || []).slice(-30),
            daily_rollups: data.atom_daily_rollups || {}
        };

        // Format as JSON string
        const jsonStr = JSON.stringify(debugReport, null, 2);

        // Copy to clipboard
        await navigator.clipboard.writeText(jsonStr);

        btn.innerHTML = '<span>' + chrome.i18n.getMessage('opt_debug_copied') + '</span>';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = 'var(--primary)';

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2500);

    } catch (err) {
        console.error("ATOM: Export failed", err);
        btn.innerHTML = '<span>' + chrome.i18n.getMessage('opt_debug_failed') + '</span>';
        btn.style.borderColor = 'var(--danger)';
        btn.style.color = 'var(--danger)';

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2500);
    }
}