// bug_report.js - Bug Report Logic with GitHub Integration

const atomMsg = (key, substitutions, fallback) => {
    if (window.AtomI18n) {
        return window.AtomI18n.getMessage(key, substitutions, fallback);
    }
    return chrome.i18n.getMessage(key, substitutions) || fallback || key;
};

// ========================================
// 🔧 CONFIGURATION - YOUR GITHUB REPO
// ========================================
const GITHUB_REPO = "dnqduy0611-source/atom-extension";
const GITHUB_ISSUES_URL = `https://github.com/${GITHUB_REPO}/issues/new`;

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.AtomI18n) {
        await window.AtomI18n.init();
    }
    // 1. Collect and display system info
    await collectSystemInfo();

    // 2. Set up form handlers
    setupFormHandlers();

    // 3. Privacy link
    document.getElementById('privacy-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('PRIVACY.md') });
    });
});

// ========================================
// COLLECT SYSTEM INFO
// ========================================
async function collectSystemInfo() {
    // Extension version
    const manifest = chrome.runtime.getManifest();
    document.getElementById('info-version').textContent = `v${manifest.version}`;

    // Browser info
    const ua = navigator.userAgent;
    let browser = atomMsg('bug_unknown');
    if (ua.includes('Chrome/')) {
        const match = ua.match(/Chrome\/(\d+)/);
        browser = match ? `Chrome ${match[1]}` : 'Chrome';
    } else if (ua.includes('Firefox/')) {
        const match = ua.match(/Firefox\/(\d+)/);
        browser = match ? `Firefox ${match[1]}` : 'Firefox';
    } else if (ua.includes('Edg/')) {
        const match = ua.match(/Edg\/(\d+)/);
        browser = match ? `Edge ${match[1]}` : 'Edge';
    }
    document.getElementById('info-browser').textContent = browser;

    // OS info
    let os = atomMsg('bug_unknown');
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';
    document.getElementById('info-os').textContent = os;

    // Language
    const data = await chrome.storage.local.get(['atom_ui_language']);
    const override = data.atom_ui_language || 'auto';
    const uiLang = override === 'auto' ? chrome.i18n.getUILanguage() : override;
    const label = override === 'auto' ? uiLang : atomMsg('bug_lang_override', [uiLang]);
    document.getElementById('info-lang').textContent = label;

    // Try to get current tab URL
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && !tab.url.startsWith('chrome')) {
            document.getElementById('bug-url').value = tab.url;
        }
    } catch (e) {
        // Ignore - URL field will remain empty
    }
}

// ========================================
// COLLECT DEBUG DATA
// ========================================
async function collectDebugData() {
    try {
        const data = await chrome.storage.local.get(null);

        return {
            settings: {
                sensitivity: data.user_sensitivity || 'balanced',
                debug_mode: data.debug_mode || false,
                has_api_key: !!data.user_gemini_key
            },
            state: {
                snooze_until: data.snoozeUntil ? new Date(data.snoozeUntil).toISOString() : null,
                adaptive_multiplier: data.adaptive_multiplier || 1.0,
                whitelist_count: (data.atom_whitelist || []).length
            },
            recent_reactions: (data.atom_reactions || []).slice(-10),
            recent_events: (data.atom_events || []).slice(-15)
        };
    } catch (e) {
        return { error: atomMsg('bug_debug_failed') };
    }
}

// ========================================
// BUILD ISSUE BODY
// ========================================
async function buildIssueBody() {
    const bugType = document.getElementById('bug-type').value;
    const bugUrl = document.getElementById('bug-url').value.trim();
    const bugDescription = document.getElementById('bug-description').value.trim();
    const bugExpected = document.getElementById('bug-expected').value.trim();
    const includeDebug = document.getElementById('include-debug').checked;

    // System info
    const version = document.getElementById('info-version').textContent;
    const browser = document.getElementById('info-browser').textContent;
    const os = document.getElementById('info-os').textContent;
    const lang = document.getElementById('info-lang').textContent;

    let body = `## Environment

| Item | Value |
|------|-------|
| Extension Version | ${version} |
| Browser | ${browser} |
| OS | ${os} |
| Language | ${lang} |

## Bug Type
${bugType}

`;

    if (bugUrl) {
        body += `## URL
${bugUrl}

`;
    }

    body += `## Steps to Reproduce
${bugDescription}

`;

    if (bugExpected) {
        body += `## Expected vs Actual
${bugExpected}

`;
    }

    if (includeDebug) {
        const debugData = await collectDebugData();
        body += `## Debug Data
<details>
<summary>Click to expand debug data</summary>

\`\`\`json
${JSON.stringify(debugData, null, 2)}
\`\`\`

</details>
`;
    }

    body += `
---
*Submitted via ATOM Bug Reporter*`;

    return body;
}

// ========================================
// FORM HANDLERS
// ========================================
function setupFormHandlers() {
    const form = document.getElementById('bug-form');
    const btnSubmit = document.getElementById('btn-submit');
    const btnCopy = document.getElementById('btn-copy');
    const statusMsg = document.getElementById('status-msg');

    // Submit to GitHub
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>' + atomMsg('bug_submitting') + '</span>';

        try {
            const title = document.getElementById('bug-title').value.trim();
            const bugType = document.getElementById('bug-type').value;
            const body = await buildIssueBody();

            // Build labels based on bug type
            const labelMap = {
                'intervention': 'bug,intervention',
                'ui': 'bug,ui',
                'performance': 'bug,performance',
                'crash': 'bug,critical',
                'ai': 'bug,ai',
                'other': 'bug'
            };
            const labels = labelMap[bugType] || 'bug';

            // Build GitHub issue URL with pre-filled data
            const params = new URLSearchParams({
                title: `[Bug] ${title}`,
                body: body,
                labels: labels
            });

            const issueUrl = `${GITHUB_ISSUES_URL}?${params.toString()}`;

            // Open GitHub in new tab
            chrome.tabs.create({ url: issueUrl });

            // Show success
            statusMsg.className = 'status-msg success';
            statusMsg.textContent = atomMsg('bug_success');
            statusMsg.style.display = 'block';

            btnSubmit.innerHTML = '<span>' + atomMsg('bug_btn_submit') + '</span>';
            btnSubmit.disabled = false;

        } catch (err) {
            console.error('Bug report error:', err);
            statusMsg.className = 'status-msg error';
            statusMsg.textContent = atomMsg('bug_error', [err.message]);
            statusMsg.style.display = 'block';

            btnSubmit.innerHTML = '<span>' + atomMsg('bug_btn_submit') + '</span>';
            btnSubmit.disabled = false;
        }
    });

    // Copy to clipboard
    btnCopy.addEventListener('click', async () => {
        try {
            const title = document.getElementById('bug-title').value.trim() || atomMsg('bug_default_title');
            const body = await buildIssueBody();
            const fullReport = `# ${title}\n\n${body}`;

            await navigator.clipboard.writeText(fullReport);

            statusMsg.className = 'status-msg success';
            statusMsg.textContent = atomMsg('bug_copied');
            statusMsg.style.display = 'block';

            btnCopy.textContent = atomMsg('bug_copied_btn');
            setTimeout(() => {
                btnCopy.innerHTML = '<span>' + atomMsg('bug_btn_copy') + '</span>';
            }, 2000);

        } catch (err) {
            statusMsg.className = 'status-msg error';
            statusMsg.textContent = atomMsg('bug_copy_error');
            statusMsg.style.display = 'block';
        }
    });
}

