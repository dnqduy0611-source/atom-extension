/**
 * modules/browser_e2e_gen.js — Browser E2E Test Generator for Amoisekai
 *
 * Generates Playwright browser tests from a flow description.
 * Uses DOM scanner + API scanner to provide context to AI.
 *
 * Usage:
 *   node pilot.js browser "Full onboarding quiz"
 *   node pilot.js browser "Soul forge complete" --url http://localhost:5173
 *   node pilot.js browser "Story continue + choice" --model deepseek/deepseek-chat-v3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AIClient } from '../core/ai_client.js';
import { CONFIG, requireApiKey } from '../core/config.js';
import { scanDOM, scanAPI, formatScanContext } from '../core/web_scanner.js';
import { validateAndFix } from '../core/validator.js';
import { stripCodeBlock } from '../core/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Predefined flow templates ────────────────────────────────────────────────

const FLOW_TEMPLATES = {
    onboarding: {
        name: 'Onboarding Quiz',
        description: 'Complete onboarding quiz: answer 5-7 questions, verify progression, verify transition to soul forge',
        views: ['view-loading', 'view-onboarding', 'view-soul-forge'],
        apiCalls: ['onboardPlayer'],
    },
    'soul-forge': {
        name: 'Soul Forge Complete',
        description: 'Complete soul forge: 5 scenes with choices, fragment input, backstory, naming, forge result',
        views: ['view-soul-forge'],
        apiCalls: ['soulForgeStart', 'soulForgeChoice', 'soulForgeFragment', 'soulForgeForge'],
    },
    'story-setup': {
        name: 'Story Setup',
        description: 'Configure and start a story: select preference tags, choose tone, click start',
        views: ['view-story-setup', 'view-game'],
        apiCalls: ['streamSceneFirst'],
    },
    'story-continue': {
        name: 'Story Continue + Choice',
        description: 'Continue a story: read prose, select a choice, verify next scene loads',
        views: ['view-game'],
        apiCalls: ['streamSceneNext'],
    },
    combat: {
        name: 'Combat Encounter',
        description: 'Handle combat: detect combat panel, select action, verify combat resolution',
        views: ['view-game'],
        apiCalls: ['streamSceneNext'],
    },
    'full-flow': {
        name: 'Full Flow (Onboarding → Game)',
        description: 'End-to-end: onboarding quiz → soul forge → story setup → first scene → make choice',
        views: ['view-loading', 'view-onboarding', 'view-soul-forge', 'view-story-setup', 'view-game'],
        apiCalls: ['onboardPlayer', 'soulForgeStart', 'soulForgeChoice', 'soulForgeFragment', 'soulForgeForge', 'streamSceneFirst'],
    },
    'security-xss': {
        name: 'Security: XSS Injection',
        description: 'Test all user input fields for XSS vulnerabilities: inject <script>, onerror, javascript: URI, and HTML entities into fragment input, backstory fields, and name input. Verify inputs are sanitized before rendering and before sending to API.',
        views: ['view-soul-forge'],
        apiCalls: ['soulForgeStart', 'soulForgeChoice', 'soulForgeFragment', 'soulForgeForge'],
        security: true,
    },
    'security-input': {
        name: 'Security: Input Validation',
        description: 'Test input boundary conditions: empty strings, max-length strings (10000+ chars), unicode/emoji, SQL injection patterns, null bytes, and special characters in fragment textarea, backstory fields, and character name. Verify UI handles gracefully without crashing.',
        views: ['view-soul-forge'],
        apiCalls: ['soulForgeFragment', 'soulForgeForge'],
        security: true,
    },
    'security-render': {
        name: 'Security: Prose Render Safety',
        description: 'Test that SSE-streamed prose content is safely rendered: mock SSE to return HTML tags, script tags, and event handlers in prose text. Verify #prose-content uses textContent/innerText (not innerHTML) or sanitizes HTML. Verify no script execution via pageErrors.',
        views: ['view-game'],
        apiCalls: ['streamSceneFirst', 'streamSceneNext'],
        security: true,
    },
};

// ─── Load system prompt ────────────────────────────────────────────────────────

function loadBrowserPrompt() {
    const promptPath = resolve(__dirname, '../prompts/browser_e2e_system.md');
    if (!existsSync(promptPath)) {
        throw new Error(`Browser E2E system prompt not found: ${promptPath}`);
    }
    return readFileSync(promptPath, 'utf-8');
}

// ─── Main generator ────────────────────────────────────────────────────────────

/**
 * Generate Playwright browser E2E tests for a given flow.
 * @param {string} flowDescription - Natural language description or template key
 * @param {{ model?: string, overwrite?: boolean, url?: string, validate?: boolean }} options
 * @returns {Promise<{ outputPath: string, testCount: number, flow: string, validation?: object }>}
 */
export async function generateBrowserTests(flowDescription, options = {}) {
    requireApiKey();

    const { url, model, overwrite, validate } = options;

    // Check if it matches a predefined template
    const templateKey = flowDescription.toLowerCase().replace(/\s+/g, '-');
    const template = FLOW_TEMPLATES[templateKey] || null;

    const flowName = template?.name || flowDescription;
    const flowDesc = template?.description || flowDescription;

    console.log(`  Flow: ${flowName}`);

    // Scan DOM + API for context
    console.log(`  Scanning web frontend...`);
    const dom = scanDOM();
    const api = scanAPI();
    const scanContext = formatScanContext(dom, api);

    console.log(`  DOM: ${dom.allIds.length} elements across ${dom.views.length} views`);
    console.log(`  API: ${api.functions.length} functions (${api.sseEndpoints.length} SSE)`);

    // Build prompt
    const SYSTEM_PROMPT = loadBrowserPrompt();
    const userPrompt = buildBrowserPrompt({
        flowName,
        flowDescription: flowDesc,
        scanContext,
        url: url || null,
        template,
    });

    // Call AI
    const aiClient = new AIClient(CONFIG.OPENROUTER_API_KEY, {
        model: model || CONFIG.BROWSER_E2E_MODEL,
    });

    console.log(`  Generating Playwright test...`);
    const testCode = await aiClient.call({
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: CONFIG.MAX_TOKENS_PER_CALL,
    });

    // Strip markdown wrapper
    const cleaned = stripCodeBlock(testCode);

    // Basic validation: must have Playwright imports
    const hasPlaywright = cleaned.includes('@playwright/test') || cleaned.includes('playwright');
    if (!hasPlaywright) {
        const errorPath = resolve(CONFIG.OUTPUT_DIR, 'browser', `${slugify(flowName)}.error.txt`);
        ensureBrowserDir();
        writeFileSync(errorPath, `No Playwright imports detected.\n\n--- RAW OUTPUT ---\n${testCode}`);
        console.warn(`  [!] AI output may not be valid Playwright code. Raw saved to: ${errorPath}`);
    }

    // Save to output/browser/
    const outputPath = getBrowserOutputPath(flowName, overwrite);
    writeFileSync(outputPath, cleaned);
    console.log(`  Saved to: ${outputPath}`);

    // Validation loop
    let validationResult = null;
    if (validate !== false && CONFIG.VALIDATE_AFTER_GENERATE && hasPlaywright) {
        console.log(`  🔄 Running validation loop...`);
        validationResult = await validateAndFix(outputPath, {
            lang: 'javascript',
            sourceCode: '', // no source code for browser tests
            model: model || CONFIG.BROWSER_E2E_MODEL,
        });
    }

    const testCount = countPlaywrightTests(readFileSync(outputPath, 'utf-8'));
    return {
        outputPath,
        testCount,
        flow: flowName,
        validation: validationResult,
    };
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

function buildBrowserPrompt({ flowName, flowDescription, scanContext, url, template }) {
    let prompt = `## Task\n\nGenerate Playwright E2E tests for the flow: **"${flowName}"**\n\n`;
    prompt += `### Flow Description\n${flowDescription}\n\n`;

    if (template) {
        prompt += `### Expected View Transitions\n`;
        prompt += template.views.map(v => `- \`#${v}\``).join('\n') + '\n\n';
        prompt += `### Key API Calls to Mock\n`;
        prompt += template.apiCalls.map(a => `- \`${a}()\``).join('\n') + '\n\n';
    }

    if (url) {
        prompt += `### Mode: LIVE\nTest against running dev server at: \`${url}\`\n`;
        prompt += `Do NOT mock API calls — test real endpoints.\n\n`;
    } else {
        prompt += `### Mode: MOCK\nMock ALL API calls with \`page.route()\`.\n`;
        prompt += `Use realistic mock data that matches the API response schemas.\n\n`;
    }

    prompt += `### Web Frontend Context\n\n${scanContext}\n`;

    prompt += `\n### Requirements\n`;
    prompt += `1. Use \`@playwright/test\` imports\n`;
    prompt += `2. One \`test.describe()\` block per file\n`;
    prompt += `3. Each test must be independent\n`;
    prompt += `4. Use \`page.waitForSelector()\` for dynamic elements\n`;
    prompt += `5. Assert view transitions with \`.active\` class check\n`;
    prompt += `6. Output ONLY valid JavaScript code — no explanations\n`;
    prompt += `7. **ASYNC SAFETY (MANDATORY):**\n`;
    prompt += `   - In \`beforeEach\`: set up \`pageErrors = []\` and \`page.on('pageerror', err => pageErrors.push(err.message))\`\n`;
    prompt += `   - In \`beforeEach\`: set up \`consoleErrors = []\` and \`page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); })\`\n`;
    prompt += `   - In \`afterEach\`: assert \`expect(pageErrors, 'No uncaught JS errors').toEqual([])\`\n`;

    // SSE-specific safety for flows that involve streaming
    const hasSSE = template?.apiCalls?.some(a => a.startsWith('stream')) ?? false;
    if (hasSSE) {
        prompt += `8. **SSE STREAMING SAFETY:**\n`;
        prompt += `   - After mocking SSE endpoints, verify \`#prose-content\` receives text without JS errors\n`;
        prompt += `   - Verify no EventSource \`onerror\` fires by checking \`pageErrors\` stays empty during streaming\n`;
        prompt += `   - Add a dedicated test: "should complete SSE stream without async errors"\n`;
    }

    // Security-specific instructions for security templates
    if (template?.security) {
        prompt += `\n### 🔒 SECURITY TESTING REQUIREMENTS\n`;
        prompt += `This is a **security-focused** test. Apply these rules:\n`;
        prompt += `1. **XSS payloads to inject** (try each in every text input):\n`;
        prompt += `   - \`<script>alert('xss')</script>\`\n`;
        prompt += `   - \`<img src=x onerror=alert('xss')>\`\n`;
        prompt += `   - \`javascript:alert('xss')\`\n`;
        prompt += `   - \`\" onmouseover=\"alert('xss')\`\n`;
        prompt += `2. **Validation payloads** (boundary testing):\n`;
        prompt += `   - Empty string \`\"\"\`\n`;
        prompt += `   - Very long string (5000+ chars): \`'A'.repeat(5000)\`\n`;
        prompt += `   - Unicode/emoji: \`'🎮⚔️🐉 Thiên Vũ'\`\n`;
        prompt += `   - SQL injection: \`\"'; DROP TABLE users; --\"\`\n`;
        prompt += `   - Null bytes: \`'test\\x00evil'\`\n`;
        prompt += `3. **Assertions**:\n`;
        prompt += `   - \`pageErrors\` must remain empty (no JS crash)\n`;
        prompt += `   - Injected HTML must NOT render as DOM elements\n`;
        prompt += `   - Input values must be escaped in API request body\n`;
        prompt += `   - UI must not freeze or enter broken state\n`;
    }

    return prompt;
}

// ─── Output path ──────────────────────────────────────────────────────────────

function ensureBrowserDir() {
    const dir = resolve(CONFIG.OUTPUT_DIR, 'browser');
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getBrowserOutputPath(flowName, overwrite) {
    const dir = ensureBrowserDir();
    const slug = slugify(flowName);
    const basePath = resolve(dir, `${slug}.spec.js`);

    if (overwrite || !existsSync(basePath)) {
        return basePath;
    }

    // Append timestamp to avoid overwrite
    const ts = Date.now();
    return resolve(dir, `${slug}_${ts}.spec.js`);
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 60);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// stripCodeBlock imported from core/utils.js

function countPlaywrightTests(code) {
    // Match test('...') or test('...', ...) but NOT test.describe/beforeEach/afterEach
    const matches = code.match(/\btest\s*\(['"`]/g) || [];
    return matches.length;
}

/**
 * List available flow templates.
 * @returns {string[]}
 */
export function listFlowTemplates() {
    return Object.entries(FLOW_TEMPLATES).map(([key, t]) => `${key}: ${t.name}`);
}
