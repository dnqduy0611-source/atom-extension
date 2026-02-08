// options.js

const atomMsg = (key, substitutions, fallback) => {
    if (window.AtomI18n) {
        return window.AtomI18n.getMessage(key, substitutions, fallback);
    }
    return chrome.i18n.getMessage(key, substitutions) || fallback || key;
};

const BUILD_FLAGS = window.ATOM_BUILD_FLAGS || { DEBUG: false };
const BUILD_DEBUG_ENABLED = !!BUILD_FLAGS.DEBUG;

// Helper: Localize placeholders
function localizePlaceholders() {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const msg = atomMsg(key);
        if (msg && msg !== key) {
            el.setAttribute('placeholder', msg);
        }
    });
}

function applyDebugVisibility() {
    const debugSection = document.getElementById('debug-section');
    const debugToggle = document.getElementById('debugModeToggle');
    const btnExportDebug = document.getElementById('btn-export-debug');

    if (!BUILD_DEBUG_ENABLED) {
        if (debugSection) debugSection.style.display = 'none';
        if (debugToggle) {
            debugToggle.checked = false;
            debugToggle.disabled = true;
        }
        if (btnExportDebug) btnExportDebug.style.display = 'none';
    }

    return BUILD_DEBUG_ENABLED;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.AtomI18n) {
        await window.AtomI18n.init();
    }

    // Explicitly run placeholder localization
    localizePlaceholders();
    const debugAvailable = applyDebugVisibility();

    // Initialize Tab Navigation
    setupTabs();
    restoreLastTab();

    // Initialize Custom Dropdowns
    setupCustomDropdown('languageDropdown', 'languageSelect');
    setupCustomDropdown('aiPilotModeDropdown', 'aiPilotMode');
    setupCustomDropdown('aiAccuracyLevelDropdown', 'aiAccuracyLevel');
    setupCustomDropdown('aiProviderDropdown', 'aiProvider');
    setupCustomDropdown('providerDropdown', 'providerSelect');

    // Setup Provider Toggle (show/hide appropriate key sections)
    setupProviderToggle();

    restoreOptions();   // Then load saved data

    const apiKeyInput = document.getElementById('apiKeyInput');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            const hasKey = apiKeyInput.value.trim().length > 0;
            updateSemanticToggleAvailability(hasKey);
        });
    }

    // Debug Mode Toggle listener
    const debugToggle = document.getElementById('debugModeToggle');
    if (debugToggle && debugAvailable) {
        debugToggle.addEventListener('change', (e) => {
            chrome.storage.local.set({ debug_mode: e.target.checked }, () => {
                console.log("ATOM: Debug Mode =", e.target.checked);
            });
        });
    }

    // Export Debug Log button
    const btnExportDebug = document.getElementById('btn-export-debug');
    if (btnExportDebug && debugAvailable) {
        btnExportDebug.addEventListener('click', exportDebugLog);
    }
});

// Tab Navigation Logic
function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;

            // Update tabs
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update panels
            panels.forEach(p => p.classList.remove('active'));
            const targetPanel = document.getElementById(`panel-${targetId}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // Save last tab to storage
            chrome.storage.local.set({ atom_options_last_tab: targetId });
        });
    });
}

// Restore last active tab on page load
async function restoreLastTab() {
    try {
        const result = await chrome.storage.local.get('atom_options_last_tab');
        const lastTab = result.atom_options_last_tab;
        if (lastTab) {
            const tabButton = document.querySelector(`[data-tab="${lastTab}"]`);
            if (tabButton) {
                tabButton.click();
            }
        }
    } catch (error) {
        console.log("ATOM: Could not restore last tab", error);
    }
}

// Custom Dropdown Logic - Generic Setup
function setupCustomDropdown(dropdownId, hiddenInputId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const selected = dropdown.querySelector('.dropdown-selected');
    const options = dropdown.querySelectorAll('.dropdown-option');
    const hiddenInput = document.getElementById(hiddenInputId);
    const textSpan = dropdown.querySelector('.dropdown-text');

    // Toggle dropdown
    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other open dropdowns
        document.querySelectorAll('.custom-dropdown').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    });

    // Handle option selection
    options.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = option.dataset.value;
            const text = option.textContent.replace('✓', '').trim();

            // Update hidden input
            if (hiddenInput) hiddenInput.value = value;

            // Update displayed text
            if (textSpan) {
                textSpan.textContent = text;
                // Sync i18n key so localization doesn't revert it
                if (option.hasAttribute('data-i18n')) {
                    textSpan.setAttribute('data-i18n', option.getAttribute('data-i18n'));
                }
            }

            // Update selected state
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Close dropdown
            dropdown.classList.remove('open');
        });
    });

    // Keyboard accessibility
    selected.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdown.classList.toggle('open');
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('open');
        }
    });
}

// Helper to update custom dropdown UI
function updateDropdownUI(dropdownId, value) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const options = dropdown.querySelectorAll('.dropdown-option');
    const textSpan = dropdown.querySelector('.dropdown-text');
    const hiddenInput = dropdown.parentElement.querySelector(`input[type="hidden"]`) ||
        document.getElementById(dropdownId.replace('Dropdown', ''));

    options.forEach(option => {
        if (option.dataset.value === value) {
            option.classList.add('selected');
            if (textSpan) {
                textSpan.textContent = option.textContent.replace('✓', '').trim();
                // Sync i18n key
                if (option.hasAttribute('data-i18n')) {
                    textSpan.setAttribute('data-i18n', option.getAttribute('data-i18n'));
                }
            }
        } else {
            option.classList.remove('selected');
        }
    });

    if (hiddenInput) {
        hiddenInput.value = value;
    }
}

function updateSemanticToggleAvailability(hasKey) {
    const embeddingsToggle = document.getElementById('semanticEmbeddingsEnabled');
    const searchToggle = document.getElementById('semanticSearchEnabled');
    const keyRequiredNote = document.getElementById('semantic-key-required');

    if (embeddingsToggle) {
        embeddingsToggle.disabled = !hasKey;
        if (!hasKey) embeddingsToggle.checked = false;
    }
    if (searchToggle) {
        searchToggle.disabled = !hasKey;
        if (!hasKey) searchToggle.checked = false;
    }
    if (keyRequiredNote) {
        keyRequiredNote.style.display = hasKey ? 'none' : 'block';
    }
}

// Provider toggle: show/hide Google vs OpenRouter key sections
function setupProviderToggle() {
    const providerDropdown = document.getElementById('providerDropdown');
    if (!providerDropdown) return;

    const options = providerDropdown.querySelectorAll('.dropdown-option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            const provider = option.dataset.value;
            toggleProviderSections(provider);
        });
    });
}

function toggleProviderSections(provider) {
    const googleSection = document.getElementById('google-key-section');
    const openrouterSection = document.getElementById('openrouter-key-section');
    const providerHint = document.getElementById('provider-hint');

    if (provider === 'openrouter') {
        if (googleSection) googleSection.style.display = 'none';
        if (openrouterSection) openrouterSection.style.display = 'block';
        if (providerHint) providerHint.style.display = 'block';
    } else {
        if (googleSection) googleSection.style.display = 'block';
        if (openrouterSection) openrouterSection.style.display = 'none';
        if (providerHint) providerHint.style.display = 'none';
    }
}

// Close dropdowns on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
});

document.getElementById('btn-save').addEventListener('click', saveOptions);

function toNumberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

// 1. Lưu Key vào Chrome Storage
function saveOptions() {
    const key = document.getElementById('apiKeyInput').value.trim();
    const sensitivity = document.querySelector('input[name="sensitivity"]:checked').value;
    const debugMode = BUILD_DEBUG_ENABLED && (document.getElementById('debugModeToggle')?.checked || false);
    const userPersona = document.getElementById('userPersona')?.value.trim() || '';
    const language = document.getElementById('languageSelect')?.value || 'auto';
    const aiPilotEnabled = document.getElementById('aiPilotEnabled')?.checked || false;
    const aiPilotMode = document.getElementById('aiPilotMode')?.value || 'shadow';
    const aiAccuracyLevel = document.getElementById('aiAccuracyLevel')?.value || 'balanced';
    const aiMinConfidence = toNumberOr(document.getElementById('aiMinConfidence')?.value, 0.65);
    const aiTimeoutMs = toNumberOr(document.getElementById('aiTimeoutMs')?.value, 800);
    const aiBudgetPerDay = toNumberOr(document.getElementById('aiBudgetPerDay')?.value, 200);
    const aiMaxViewportChars = toNumberOr(document.getElementById('aiMaxViewportChars')?.value, 1200);
    const aiMaxSelectedChars = toNumberOr(document.getElementById('aiMaxSelectedChars')?.value, 400);
    const aiCacheTtlMs = toNumberOr(document.getElementById('aiCacheTtlMs')?.value, 15000);
    const aiProvider = document.getElementById('aiProvider')?.value || 'gemini';
    const aiProxyUrl = document.getElementById('aiProxyUrl')?.value.trim() || '';
    // LLM Provider config (General tab)
    const llmProvider = document.getElementById('providerSelect')?.value || 'google';
    const openrouterKey = document.getElementById('openrouterKeyInput')?.value.trim() || '';
    const openrouterModel = document.getElementById('openrouterModelInput')?.value.trim() || 'google/gemini-2.0-flash-exp:free';
    const semanticEmbeddingsEnabled = document.getElementById('semanticEmbeddingsEnabled')?.checked || false;
    const semanticSearchEnabled = document.getElementById('semanticSearchEnabled')?.checked || false;
    const nlmEnabledEl = document.getElementById('nlmEnabled');
    const nlmEnabled = nlmEnabledEl?.checked || false;
    console.log('[ATOM Options] NLM checkbox element:', nlmEnabledEl, 'checked:', nlmEnabledEl?.checked, 'final value:', nlmEnabled);
    const nlmMode = document.getElementById('nlmMode')?.value || 'ui_assisted';
    const nlmDefaultNotebook = document.getElementById('nlmDefaultNotebook')?.value.trim() || 'Inbox';
    const nlmBaseUrl = document.getElementById('nlmBaseUrl')?.value.trim() || 'https://notebooklm.google.com';
    const nlmAllowCloud = document.getElementById('nlmAllowCloud')?.checked || false;
    const nlmPiiWarning = document.getElementById('nlmPiiWarning')?.checked ?? true;
    const nlmExportMaxChars = toNumberOr(document.getElementById('nlmExportMaxChars')?.value, 5000);
    const nlmSensitiveDomainsRaw = document.getElementById('nlmSensitiveDomains')?.value || '';
    const nlmRulesRaw = document.getElementById('nlmRulesJson')?.value || '';
    const srqDensityMode = document.getElementById('srq-density-mode')?.value || 'comfortable';
    const status = document.getElementById('status');
    const btn = document.getElementById('btn-save');

    // Hiệu ứng "Đang lưu..."
    btn.textContent = atomMsg('opt_btn_saving');
    btn.disabled = true;

    if ((semanticEmbeddingsEnabled || semanticSearchEnabled) && !key) {
        status.textContent = atomMsg('opt_semantic_key_required', null, 'Add your API key to enable these toggles.');
        status.className = 'error';
        btn.textContent = atomMsg('opt_btn_save');
        btn.disabled = false;
        return;
    }

    chrome.storage.local.get(['atom_feature_flags_v1', 'accepted_cost_warning'], (flagResult) => {
        const currentFlags = flagResult.atom_feature_flags_v1 || {};
        const nextFlags = {
            ...currentFlags,
            EMBEDDINGS_ENABLED: semanticEmbeddingsEnabled,
            SEMANTIC_SEARCH_ENABLED: semanticSearchEnabled
        };
        const nextCostAck = flagResult.accepted_cost_warning || semanticEmbeddingsEnabled || semanticSearchEnabled;

        chrome.storage.local.set({
            user_gemini_key: key,
            user_sensitivity: sensitivity,
            debug_mode: debugMode,
            user_persona: userPersona,
            atom_ui_language: language,
            atom_ai_pilot_enabled: aiPilotEnabled,
            atom_ai_pilot_mode: aiPilotMode,
            atom_ai_pilot_accuracy_level: aiAccuracyLevel,
            atom_ai_confidence_threshold_primary: aiMinConfidence,
            atom_ai_timeout_ms: aiTimeoutMs,
            atom_ai_budget_daily_cap: aiBudgetPerDay,
            atom_ai_cache_ttl_ms: aiCacheTtlMs,
            atom_ai_max_viewport_chars: aiMaxViewportChars,
            atom_ai_max_selected_chars: aiMaxSelectedChars,
            atom_ai_provider: aiProvider,
            atom_ai_proxy_url: aiProxyUrl,
            // OpenRouter Integration
            atom_llm_provider: llmProvider,
            atom_openrouter_key: openrouterKey,
            atom_openrouter_model: openrouterModel,
            atom_nlm_settings_v1: {
                enabled: nlmEnabled === true,  // Ensure boolean
                mode: nlmMode,
                defaultNotebookRef: nlmDefaultNotebook,
                exportFormat: "clip_and_url",
                baseUrl: nlmBaseUrl,
                allowCloudExport: nlmAllowCloud,
                piiWarning: nlmPiiWarning,
                exportMaxChars: nlmExportMaxChars
            },
            atom_nlm_sensitive_domains_v1: nlmSensitiveDomainsRaw
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
            atom_nlm_rules_v1: parseNlmRules(nlmRulesRaw),
            atom_feature_flags_v1: nextFlags,
            accepted_cost_warning: nextCostAck
        }, () => {
            // Feedback UI: Dùng text từ file ngôn ngữ
            status.textContent = atomMsg("opt_save_success");
            status.className = 'success';

            btn.textContent = atomMsg('opt_btn_saved');
            btn.style.backgroundColor = '#059669';
            btn.disabled = false;

            // Log kiểm tra
            console.log("ATOM: Saved Key =", key ? "***" : "Empty");
            console.log("ATOM: Saved Sensitivity =", sensitivity);
            console.log("ATOM: Saved Debug Mode =", debugMode);
            console.log("ATOM: Saved Debug Mode =", debugMode);
            console.log("ATOM: Saved Persona =", userPersona);
            console.log("ATOM: Saved Language =", language);
            console.log("ATOM: Saved AI Pilot =", aiPilotEnabled, aiPilotMode);
            console.log("ATOM: Saved NotebookLM Bridge =", nlmEnabled, nlmDefaultNotebook);

            // Verify NLM settings were saved correctly
            chrome.storage.local.get(['atom_nlm_settings_v1'], (r) => {
                console.log('[ATOM Options] Verified NLM settings in storage:', r.atom_nlm_settings_v1);
            });

            chrome.storage.sync.set({ srqDensityMode }, () => {
                chrome.runtime.sendMessage({
                    type: 'SRQ_SETTINGS_CHANGED',
                    settings: { srqDensityMode }
                }).catch(() => { });
            });

            setTimeout(() => {
                status.textContent = '';
                btn.textContent = atomMsg("opt_btn_save");
                btn.style.backgroundColor = '#374151';
            }, 2000);

            if (window.AtomI18n && window.AtomUI) {
                window.AtomI18n.setOverride(language).then(() => {
                    window.AtomUI.localize();
                    updateDropdownUI('languageDropdown', language);
                });
            }
            updateSemanticToggleAvailability(!!key);
        });
    });
}

// 2. Khôi phục Key đã lưu khi mở trang
function restoreOptions() {
    chrome.storage.local.get([
        'user_gemini_key',
        'user_sensitivity',
        'user_persona',
        'debug_mode',
        'atom_ui_language',
        'atom_feature_flags_v1',
        'ai_pilot_enabled',
        'ai_pilot_mode',
        'ai_pilot_accuracy_level',
        'ai_min_confidence',
        'ai_timeout_ms',
        'ai_budget_per_day',
        'ai_max_viewport_chars',
        'ai_max_selected_chars',
        'ai_cache_ttl_ms',
        'ai_provider',
        'ai_proxy_url',
        'atom_ai_pilot_enabled',
        'atom_ai_pilot_mode',
        'atom_ai_pilot_accuracy_level',
        'atom_ai_confidence_threshold_primary',
        'atom_ai_timeout_ms',
        'atom_ai_budget_daily_cap',
        'atom_ai_cache_ttl_ms',
        'atom_ai_max_viewport_chars',
        'atom_ai_max_selected_chars',
        'atom_ai_provider',
        'atom_ai_proxy_url',
        // OpenRouter Integration
        'atom_llm_provider',
        'atom_openrouter_key',
        'atom_openrouter_model',
        'atom_nlm_settings_v1',
        'atom_nlm_sensitive_domains_v1',
        'atom_nlm_rules_v1'
    ], (result) => {
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



        // 3. Khôi phục Debug Mode
        const debugToggle = document.getElementById('debugModeToggle');
        if (debugToggle) {
            debugToggle.checked = BUILD_DEBUG_ENABLED && (result.debug_mode || false);
        }

        // 3.1 Khôi phục Persona
        if (result.user_persona) {
            const personaInput = document.getElementById('userPersona');
            if (personaInput) personaInput.value = result.user_persona;
        }

        // 4. Khôi phục Language - sử dụng custom dropdown
        const savedLanguage = result.atom_ui_language || 'auto';
        updateDropdownUI('languageDropdown', savedLanguage);

        const featureFlags = result.atom_feature_flags_v1 || {};
        const semanticEmbeddingsToggle = document.getElementById('semanticEmbeddingsEnabled');
        const semanticSearchToggle = document.getElementById('semanticSearchEnabled');
        const hasKey = !!result.user_gemini_key;
        if (semanticEmbeddingsToggle) {
            semanticEmbeddingsToggle.checked = hasKey ? !!featureFlags.EMBEDDINGS_ENABLED : false;
        }
        if (semanticSearchToggle) {
            semanticSearchToggle.checked = hasKey ? !!featureFlags.SEMANTIC_SEARCH_ENABLED : false;
        }
        updateSemanticToggleAvailability(hasKey);

        const aiPilotEnabled = document.getElementById('aiPilotEnabled');
        if (aiPilotEnabled) aiPilotEnabled.checked = result.atom_ai_pilot_enabled ?? result.ai_pilot_enabled ?? false;

        // Restore custom dropdowns for AI settings
        const savedPilotMode = result.atom_ai_pilot_mode || result.ai_pilot_mode || 'shadow';
        updateDropdownUI('aiPilotModeDropdown', savedPilotMode);

        const savedAccuracy = result.atom_ai_pilot_accuracy_level || result.ai_pilot_accuracy_level || 'balanced';
        updateDropdownUI('aiAccuracyLevelDropdown', savedAccuracy);

        const savedProvider = result.atom_ai_provider || result.ai_provider || 'gemini';
        updateDropdownUI('aiProviderDropdown', savedProvider);
        const aiMinConfidence = document.getElementById('aiMinConfidence');
        if (aiMinConfidence) aiMinConfidence.value = (result.atom_ai_confidence_threshold_primary ?? result.ai_min_confidence ?? 0.65);
        const aiTimeoutMs = document.getElementById('aiTimeoutMs');
        if (aiTimeoutMs) aiTimeoutMs.value = (result.atom_ai_timeout_ms ?? result.ai_timeout_ms ?? 800);
        const aiBudgetPerDay = document.getElementById('aiBudgetPerDay');
        if (aiBudgetPerDay) aiBudgetPerDay.value = (result.atom_ai_budget_daily_cap ?? result.ai_budget_per_day ?? 200);
        const aiMaxViewportChars = document.getElementById('aiMaxViewportChars');
        if (aiMaxViewportChars) aiMaxViewportChars.value = (result.atom_ai_max_viewport_chars ?? result.ai_max_viewport_chars ?? 1200);
        const aiMaxSelectedChars = document.getElementById('aiMaxSelectedChars');
        if (aiMaxSelectedChars) aiMaxSelectedChars.value = (result.atom_ai_max_selected_chars ?? result.ai_max_selected_chars ?? 400);
        const aiCacheTtlMs = document.getElementById('aiCacheTtlMs');
        if (aiCacheTtlMs) aiCacheTtlMs.value = (result.atom_ai_cache_ttl_ms ?? result.ai_cache_ttl_ms ?? 15000);

        // Provider handled by custom dropdown update above

        const aiProxyUrl = document.getElementById('aiProxyUrl');
        if (aiProxyUrl) aiProxyUrl.value = result.atom_ai_proxy_url || result.ai_proxy_url || '';

        // OpenRouter Integration - restore provider dropdown and keys
        const savedLlmProvider = result.atom_llm_provider || 'google';
        updateDropdownUI('providerDropdown', savedLlmProvider);
        toggleProviderSections(savedLlmProvider);

        const openrouterKeyInput = document.getElementById('openrouterKeyInput');
        if (openrouterKeyInput) openrouterKeyInput.value = result.atom_openrouter_key || '';

        const openrouterModelInput = document.getElementById('openrouterModelInput');
        if (openrouterModelInput) openrouterModelInput.value = result.atom_openrouter_model || 'google/gemini-2.0-flash-exp:free';

        const nlmSettings = result.atom_nlm_settings_v1 || {};


        const nlmEnabled = document.getElementById('nlmEnabled');
        if (nlmEnabled) nlmEnabled.checked = !!nlmSettings.enabled;
        const nlmMode = document.getElementById('nlmMode');
        if (nlmMode) nlmMode.value = nlmSettings.mode || 'ui_assisted';
        const nlmDefaultNotebook = document.getElementById('nlmDefaultNotebook');
        if (nlmDefaultNotebook) nlmDefaultNotebook.value = nlmSettings.defaultNotebookRef || 'Inbox';
        const nlmBaseUrl = document.getElementById('nlmBaseUrl');
        if (nlmBaseUrl) nlmBaseUrl.value = nlmSettings.baseUrl || 'https://notebooklm.google.com';
        const nlmAllowCloud = document.getElementById('nlmAllowCloud');
        if (nlmAllowCloud) nlmAllowCloud.checked = !!nlmSettings.allowCloudExport;
        const nlmPiiWarning = document.getElementById('nlmPiiWarning');
        if (nlmPiiWarning) nlmPiiWarning.checked = nlmSettings.piiWarning !== false;
        const nlmExportMaxChars = document.getElementById('nlmExportMaxChars');
        if (nlmExportMaxChars) nlmExportMaxChars.value = nlmSettings.exportMaxChars || 5000;
        const nlmSensitiveDomains = document.getElementById('nlmSensitiveDomains');
        const sensitiveList = Array.isArray(result.atom_nlm_sensitive_domains_v1)
            ? result.atom_nlm_sensitive_domains_v1
            : [];
        if (nlmSensitiveDomains) nlmSensitiveDomains.value = sensitiveList.join('\n');
        const nlmRulesJson = document.getElementById('nlmRulesJson');
        const rules = result.atom_nlm_rules_v1 || {};
        if (nlmRulesJson) nlmRulesJson.value = JSON.stringify(rules, null, 2);

        chrome.storage.sync.get({ srqDensityMode: 'comfortable' }, (syncResult) => {
            const densitySelect = document.getElementById('srq-density-mode');
            if (!densitySelect) return;
            densitySelect.value = syncResult?.srqDensityMode === 'compact' ? 'compact' : 'comfortable';
        });
    });
}

function parseNlmRules(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
        return { byTag: [], byIntent: [], byDomain: [] };
    }
    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object") {
            return { byTag: [], byIntent: [], byDomain: [] };
        }
        return {
            byTag: Array.isArray(parsed.byTag) ? parsed.byTag : [],
            byIntent: Array.isArray(parsed.byIntent) ? parsed.byIntent : [],
            byDomain: Array.isArray(parsed.byDomain) ? parsed.byDomain : []
        };
    } catch {
        return { byTag: [], byIntent: [], byDomain: [] };
    }
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.atom_ui_language) {
        const language = changes.atom_ui_language.newValue || 'auto';
        if (changes.atom_ui_language) {
            const language = changes.atom_ui_language.newValue || 'auto';
            updateDropdownUI('languageDropdown', language);
        }
    }
});

// 3. Export Debug Log - Collect all relevant data for bug reports
async function exportDebugLog() {
    const btn = document.getElementById('btn-export-debug');
    const originalHTML = btn.innerHTML;

    btn.innerHTML = '<span>' + atomMsg('opt_debug_collecting') + '</span>';
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
                language: chrome.i18n.getUILanguage(),
                ui_language_override: data.atom_ui_language || 'auto'
            },
            settings: {
                sensitivity: data.user_sensitivity || 'balanced',
                debug_mode: data.debug_mode || false,
                has_api_key: !!data.user_gemini_key,
                ai_pilot_enabled: data.ai_pilot_enabled || false,
                ai_pilot_mode: data.ai_pilot_mode || 'shadow',
                ai_pilot_accuracy_level: data.ai_pilot_accuracy_level || 'balanced',
                ai_min_confidence: data.ai_min_confidence ?? 0.65,
                ai_timeout_ms: data.ai_timeout_ms ?? 800,
                ai_budget_per_day: data.ai_budget_per_day ?? 200,
                ai_max_viewport_chars: data.ai_max_viewport_chars ?? 1200,
                ai_max_selected_chars: data.ai_max_selected_chars ?? 400,
                ai_cache_ttl_ms: data.ai_cache_ttl_ms ?? 15000,
                ai_provider: data.ai_provider || 'gemini',
                ai_proxy_url: data.ai_proxy_url || '',
                atom_ai_pilot_enabled: data.atom_ai_pilot_enabled || false,
                atom_ai_pilot_mode: data.atom_ai_pilot_mode || 'shadow',
                atom_ai_pilot_accuracy_level: data.atom_ai_pilot_accuracy_level || 'balanced',
                atom_ai_confidence_threshold_primary: data.atom_ai_confidence_threshold_primary ?? 0.65,
                atom_ai_timeout_ms: data.atom_ai_timeout_ms ?? 800,
                atom_ai_budget_daily_cap: data.atom_ai_budget_daily_cap ?? 200,
                atom_ai_max_viewport_chars: data.atom_ai_max_viewport_chars ?? 1200,
                atom_ai_max_selected_chars: data.atom_ai_max_selected_chars ?? 400,
                atom_ai_cache_ttl_ms: data.atom_ai_cache_ttl_ms ?? 15000,
                atom_ai_provider: data.atom_ai_provider || 'gemini',
                atom_ai_proxy_url: data.atom_ai_proxy_url || ''
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

        btn.innerHTML = '<span>' + atomMsg('opt_debug_copied') + '</span>';
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
        btn.innerHTML = '<span>' + atomMsg('opt_debug_failed') + '</span>';
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

// 4. Test Notification - Send a test notification to verify system settings
function testNotification() {
    const status = document.getElementById('notif-status');

    chrome.runtime.sendMessage({ type: 'ATOM_TEST_NOTIFICATION' }, (response) => {
        if (chrome.runtime.lastError) {
            status.textContent = atomMsg('opt_notif_error');
            status.style.color = 'var(--danger)';
        } else if (response && response.success) {
            status.textContent = atomMsg('opt_notif_sent');
            status.style.color = 'var(--primary)';
        } else {
            status.textContent = atomMsg('opt_notif_failed');
            status.style.color = 'var(--warning)';
        }

        setTimeout(() => {
            status.textContent = '';
        }, 5000);
    });
}

// Initialize notification buttons on page load
document.addEventListener('DOMContentLoaded', () => {
    const btnTestNotif = document.getElementById('btn-test-notif');
    if (btnTestNotif) {
        btnTestNotif.addEventListener('click', testNotification);
    }

    const btnChromeNotif = document.getElementById('btn-open-chrome-notif');
    if (btnChromeNotif) {
        btnChromeNotif.addEventListener('click', () => {
            chrome.tabs.create({ url: 'chrome://settings/content/notifications' });
        });
    }
});
