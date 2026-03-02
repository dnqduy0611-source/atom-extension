/**
 * core/web_scanner.js — DOM + API scanner for Amoisekai web frontend
 *
 * 2B: scanDOM()   — Extract element IDs, views, buttons, inputs from index.html
 * 2C: scanAPI()   — Extract API functions + endpoints from api.js
 *
 * Used by browser_e2e_gen.js to provide context to AI when generating tests.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { CONFIG } from './config.js';

// ─── 2B: DOM Scanner ──────────────────────────────────────────────────────────

/**
 * Scan web/index.html and extract structured element map.
 * @param {string} [htmlPath] - Override path to index.html
 * @returns {{ views: object[], allIds: string[], buttons: string[], inputs: string[], textareas: string[], testids: string[] }}
 */
export function scanDOM(htmlPath) {
    const defaultPath = resolve(CONFIG.EXTENSION_PATH, 'amo-stories-engine/web/index.html');
    const filePath = htmlPath || defaultPath;

    if (!existsSync(filePath)) {
        console.warn(`[Scanner] index.html not found: ${filePath}`);
        return { views: [], allIds: [], buttons: [], inputs: [], textareas: [] };
    }

    const html = readFileSync(filePath, 'utf-8');

    // Extract all IDs
    const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
    const allIds = [...idMatches].map(m => m[1]);

    // Extract views (div id="view-*")
    const viewPattern = /<div\s+id=["'](view-[^"']+)["'][^>]*class=["'][^"']*view[^"']*["'][^>]*>/g;
    const viewIds = [...html.matchAll(viewPattern)].map(m => m[1]);

    // Map view → child element IDs
    const views = viewIds.map(viewId => {
        // Find the view's section in HTML and extract its child IDs
        const viewStart = html.indexOf(`id="${viewId}"`);
        if (viewStart === -1) return { id: viewId, children: [] };

        // Find next view or end of app div
        let viewEnd = html.length;
        for (const otherId of viewIds) {
            if (otherId === viewId) continue;
            const otherPos = html.indexOf(`id="${otherId}"`, viewStart + 1);
            if (otherPos > viewStart && otherPos < viewEnd) {
                viewEnd = otherPos;
            }
        }

        const section = html.slice(viewStart, viewEnd);
        const childIds = [...section.matchAll(/id=["']([^"']+)["']/g)]
            .map(m => m[1])
            .filter(id => id !== viewId); // exclude the view itself

        return { id: viewId, children: childIds };
    });

    // Extract buttons with IDs
    const buttonPattern = /<button[^>]*id=["']([^"']+)["']/g;
    const buttons = [...html.matchAll(buttonPattern)].map(m => m[1]);

    // Extract inputs with IDs
    const inputPattern = /<input[^>]*id=["']([^"']+)["']/g;
    const inputs = [...html.matchAll(inputPattern)].map(m => m[1]);

    // Extract textareas with IDs
    const textareaPattern = /<textarea[^>]*id=["']([^"']+)["']/g;
    const textareas = [...html.matchAll(textareaPattern)].map(m => m[1]);

    // Extract data-testid attributes
    const testidPattern = /data-testid=["']([^"']+)["']/g;
    const testids = [...html.matchAll(testidPattern)].map(m => m[1]);

    return { views, allIds, buttons, inputs, textareas, testids };
}

// ─── 2C: API Scanner ──────────────────────────────────────────────────────────

/**
 * Scan web/api.js and extract all API functions + their endpoints.
 * @param {string} [apiPath] - Override path to api.js
 * @returns {{ functions: object[], sseEndpoints: string[], restEndpoints: string[] }}
 */
export function scanAPI(apiPath) {
    const defaultPath = resolve(CONFIG.EXTENSION_PATH, 'amo-stories-engine/web/api.js');
    const filePath = apiPath || defaultPath;

    if (!existsSync(filePath)) {
        console.warn(`[Scanner] api.js not found: ${filePath}`);
        return { functions: [], sseEndpoints: [], restEndpoints: [] };
    }

    const code = readFileSync(filePath, 'utf-8');

    // Extract exported functions
    const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    // Also match object method style: funcName(params) {
    const methodPattern = /^\s{4}(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/gm;

    const functions = [];
    const seen = new Set();

    for (const pattern of [funcPattern, methodPattern]) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const name = match[1];
            if (seen.has(name) || name === 'onerror' || ['if', 'for', 'while', 'switch', 'catch', 'return'].includes(name)) continue;
            seen.add(name);

            // Find HTTP method and path
            const funcStart = match.index;
            const nextFunc = code.indexOf('\nfunction ', funcStart + 1);
            const nextMethod = code.indexOf('\n    async ', funcStart + 1);
            const funcEnd = Math.min(
                nextFunc > -1 ? nextFunc : code.length,
                nextMethod > -1 ? nextMethod : code.length
            );
            const funcBody = code.slice(funcStart, funcEnd);

            // Extract request() calls: request('METHOD', '/path')
            const reqMatch = funcBody.match(/request\s*\(\s*['"](\w+)['"]\s*,\s*['"`]([^'"`]+)/);
            // Extract direct fetch calls
            const fetchMatch = funcBody.match(/fetch\s*\(\s*[`'"]([^`'"]+)/);
            // Extract SSE connections: _connectSSE(url)
            const sseMatch = funcBody.match(/_connectSSE\s*\(\s*[`'"]([^`'"]+)/);

            let method = 'GET';
            let path = '';
            let type = 'rest';

            if (reqMatch) {
                method = reqMatch[1].toUpperCase();
                path = reqMatch[2].replace(/\$\{[^}]+\}/g, '{param}');
            } else if (fetchMatch) {
                path = fetchMatch[1].replace(/\$\{[^}]+\}/g, '{param}');
                if (funcBody.includes("method: 'POST'") || funcBody.includes('method: "POST"')) {
                    method = 'POST';
                }
            }

            // SSE detection: function name starts with 'stream' or is '_connectSSE'
            if (name.startsWith('stream') || name === '_connectSSE') {
                type = 'sse';
                method = 'GET (SSE)';
            }

            // Clean path: remove query params, keep base
            const cleanPath = path.split('?')[0];

            functions.push({
                name,
                params: match[2].trim(),
                method,
                path: cleanPath || '(internal)',
                type,
            });
        }
    }

    // Categorize endpoints
    const sseEndpoints = functions.filter(f => f.type === 'sse').map(f => f.path);
    const restEndpoints = functions.filter(f => f.type === 'rest' && f.path !== '(internal)').map(f => `${f.method} ${f.path}`);

    return { functions, sseEndpoints, restEndpoints };
}

// ─── Format for prompt context ────────────────────────────────────────────────

/**
 * Generate a compact text summary of DOM + API for use in AI prompts.
 * @param {object} dom - Output from scanDOM()
 * @param {object} api - Output from scanAPI()
 * @returns {string}
 */
export function formatScanContext(dom, api) {
    let ctx = '## DOM Structure\n\n';

    for (const view of dom.views) {
        ctx += `### ${view.id}\n`;
        ctx += `Elements: ${view.children.map(c => `#${c}`).join(', ')}\n\n`;
    }

    ctx += `### Interactive elements\n`;
    ctx += `Buttons: ${dom.buttons.map(b => `#${b}`).join(', ')}\n`;
    ctx += `Inputs: ${dom.inputs.map(i => `#${i}`).join(', ')}\n`;
    ctx += `Textareas: ${dom.textareas.map(t => `#${t}`).join(', ')}\n\n`;

    if (dom.testids && dom.testids.length > 0) {
        ctx += `### data-testid selectors (PREFERRED)\n`;
        ctx += dom.testids.map(t => `[data-testid="${t}"]`).join(', ') + '\n\n';
    }

    ctx += '## API Functions\n\n';
    ctx += '| Function | Method | Path | Params |\n';
    ctx += '|----------|--------|------|--------|\n';
    for (const f of api.functions) {
        if (f.path === '(internal)') continue;
        ctx += `| ${f.name} | ${f.method} | ${f.path} | ${f.params || '—'} |\n`;
    }

    ctx += `\n### SSE Endpoints (need EventSource mock)\n`;
    for (const sse of api.sseEndpoints) {
        ctx += `- ${sse}\n`;
    }

    return ctx;
}
