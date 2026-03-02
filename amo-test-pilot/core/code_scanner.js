/**
 * core/code_scanner.js — Static analysis for failure patterns
 *
 * Scans source files for common Node.js/Python failure patterns from the
 * Engineering Failures knowledge base. Returns findings that can feed into
 * test generation prompts for smarter, risk-aware test coverage.
 *
 * Domains covered:
 *   D01 — Event Loop & Async (sync I/O, await-in-loop, floating promises)
 *   D05 — Resource Management (unclosed streams, zombie processes, unbounded cache)
 *   D07 — Error Handling (empty catch, swallowed errors, no process handler)
 */
import { readFileSync } from 'fs';
import { extname, basename } from 'path';

// ─── Pattern Definitions ─────────────────────────────────────────────────────

const PATTERNS = [
    // ── D01: Async / Event Loop ──────────────────────────────────────────────
    {
        id: 'D01-SYNC-IO',
        domain: 'Async',
        severity: 'high',
        title: 'Synchronous I/O in async context',
        description: 'readFileSync/writeFileSync in async function or request handler blocks the event loop',
        regex: /(?:async\s+(?:function|=>)[\s\S]{0,200})(readFileSync|writeFileSync|appendFileSync)/g,
        lang: ['js', 'ts'],
    },
    {
        id: 'D01-AWAIT-LOOP',
        domain: 'Async',
        severity: 'medium',
        title: 'Sequential await in loop',
        description: 'await inside for/for-of loop — operations may be parallelizable with Promise.all',
        regex: /for\s*\([^)]*\)\s*\{[^}]*await\s/g,
        lang: ['js', 'ts'],
    },
    {
        id: 'D01-FLOATING-PROMISE',
        domain: 'Async',
        severity: 'high',
        title: 'Floating promise (no await/catch)',
        description: 'Async function called without await or .catch() — unhandled rejection risk',
        regex: /^\s+(?!return|await|\.then|\.catch|const|let|var)(\w+)\(.*\)\s*;?\s*$/gm,
        lang: ['js', 'ts'],
        falsePositiveCheck: true, // high FP rate, needs manual review
    },
    {
        id: 'D01-FOREACH-ASYNC',
        domain: 'Async',
        severity: 'high',
        title: 'async callback in forEach',
        description: 'forEach does not await async callbacks — use for-of or Promise.all(map())',
        regex: /\.forEach\(\s*async\s/g,
        lang: ['js', 'ts'],
    },

    // ── D05: Resource Management ─────────────────────────────────────────────
    {
        id: 'D05-ZOMBIE-PROCESS',
        domain: 'Resources',
        severity: 'high',
        title: 'Child process without error/exit handler',
        description: 'spawn() or exec() without handling exit/error events — zombie process risk',
        regex: /(?:spawn|exec|execFile)\([^)]+\)/g,
        lang: ['js', 'ts'],
        contextCheck: (line, lines, idx) => {
            // Check if next 10 lines have .on('exit') or .on('error')
            const block = lines.slice(idx, idx + 15).join('\n');
            return !block.includes(".on('exit'") && !block.includes(".on('error'")
                && !block.includes('execSync');
        },
    },
    {
        id: 'D05-UNCLOSED-STREAM',
        domain: 'Resources',
        severity: 'medium',
        title: 'Stream without proper cleanup',
        description: 'createReadStream/createWriteStream without pipeline() or .on("error")',
        regex: /create(Read|Write)Stream\(/g,
        lang: ['js', 'ts'],
        contextCheck: (line, lines, idx) => {
            const block = lines.slice(idx, idx + 10).join('\n');
            return !block.includes('pipeline') && !block.includes(".on('error'");
        },
    },
    {
        id: 'D05-UNBOUNDED-CACHE',
        domain: 'Resources',
        severity: 'medium',
        title: 'Module-level Map/Set without eviction',
        description: 'Global cache that grows without limit — memory leak risk',
        regex: /^(?:export\s+)?(?:const|let)\s+\w+(?:Cache|Store|Map|Registry)\s*=\s*new\s+(?:Map|Set)\(/gm,
        lang: ['js', 'ts'],
    },

    // ── D07: Error Handling ──────────────────────────────────────────────────
    {
        id: 'D07-EMPTY-CATCH',
        domain: 'Error Handling',
        severity: 'medium',
        title: 'Empty catch block',
        description: 'Errors silently swallowed — may hide bugs',
        regex: /catch\s*(?:\(\w+\))?\s*\{\s*\}/g,
        lang: ['js', 'ts', 'py'],
    },
    {
        id: 'D07-CATCH-LOG-ONLY',
        domain: 'Error Handling',
        severity: 'low',
        title: 'Catch block only logs (no recovery/rethrow)',
        description: 'Error is logged but not re-thrown or handled — caller unaware of failure',
        regex: /catch\s*\(\w+\)\s*\{[^}]*console\.(log|error|warn)\([^}]*\}/g,
        lang: ['js', 'ts'],
    },
    {
        id: 'D07-THROW-STRING',
        domain: 'Error Handling',
        severity: 'medium',
        title: 'Throwing string instead of Error',
        description: 'throw "string" loses stack trace — use throw new Error()',
        regex: /throw\s+['"`]/g,
        lang: ['js', 'ts'],
    },
    {
        id: 'D07-NO-PROCESS-HANDLER',
        domain: 'Error Handling',
        severity: 'high',
        title: 'Missing process error handlers',
        description: 'No process.on("unhandledRejection") or process.on("uncaughtException")',
        regex: null, // file-level check
        lang: ['js', 'ts'],
        fileCheck: (content) => {
            const hasMain = content.includes('program.parse') || content.includes('.listen(')
                || content.includes('createServer');
            if (!hasMain) return false; // not an entry point
            return !content.includes('unhandledRejection') && !content.includes('uncaughtException');
        },
    },

    // ── Python-specific ───────────────────────────────────────────────────────
    {
        id: 'D07-BARE-EXCEPT',
        domain: 'Error Handling',
        severity: 'high',
        title: 'Bare except clause',
        description: 'except: without specifying exception type catches SystemExit, KeyboardInterrupt',
        regex: /^\s*except\s*:\s*$/gm,
        lang: ['py'],
    },
    {
        id: 'D07-PASS-EXCEPT',
        domain: 'Error Handling',
        severity: 'medium',
        title: 'except with only pass',
        description: 'Exception silently ignored — may hide bugs',
        regex: /except[^:]*:\s*\n\s+pass\s*$/gm,
        lang: ['py'],
    },
    {
        id: 'D01-NO-ASYNC-TIMEOUT',
        domain: 'Async',
        severity: 'medium',
        title: 'Async call without timeout',
        description: 'await without asyncio.wait_for() or timeout — can hang indefinitely',
        regex: /await\s+(?!asyncio\.wait_for)\w+\.ainvoke\(/g,
        lang: ['py'],
    },
];

// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * Scan a single file for failure patterns.
 * @param {string} filePath - Absolute path to the file
 * @returns {{ file: string, findings: Array<{ id, severity, title, description, line, snippet }> }}
 */
export function scanFileForPatterns(filePath) {
    const ext = extname(filePath).replace('.', '');
    const langMap = { js: 'js', mjs: 'js', ts: 'ts', tsx: 'ts', py: 'py' };
    const lang = langMap[ext];
    if (!lang) return { file: filePath, findings: [] };

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const findings = [];

    for (const pattern of PATTERNS) {
        if (!pattern.lang.includes(lang)) continue;

        // File-level check (no regex)
        if (pattern.fileCheck) {
            if (pattern.fileCheck(content)) {
                findings.push({
                    id: pattern.id,
                    severity: pattern.severity,
                    title: pattern.title,
                    description: pattern.description,
                    line: 0,
                    snippet: '(file-level check)',
                });
            }
            continue;
        }

        if (!pattern.regex) continue;

        // Reset regex for global matching
        const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
        let match;
        while ((match = regex.exec(content)) !== null) {
            // Find line number
            const before = content.slice(0, match.index);
            const lineNum = (before.match(/\n/g) || []).length + 1;
            const lineText = lines[lineNum - 1]?.trim() || '';

            // Context-based false positive check
            if (pattern.contextCheck) {
                if (!pattern.contextCheck(lineText, lines, lineNum - 1)) continue;
            }

            // Skip false positives tag
            if (pattern.falsePositiveCheck) continue; // skip high-FP patterns

            findings.push({
                id: pattern.id,
                severity: pattern.severity,
                title: pattern.title,
                description: pattern.description,
                line: lineNum,
                snippet: lineText.length > 100 ? lineText.slice(0, 100) + '...' : lineText,
            });
        }
    }

    return { file: basename(filePath), findings };
}

/**
 * Scan multiple files and aggregate results.
 * @param {string[]} filePaths - Array of absolute file paths
 * @returns {{ totalFiles: number, totalFindings: number, bySeverity: object, byDomain: object, files: Array }}
 */
export function scanProject(filePaths) {
    const results = filePaths.map(f => scanFileForPatterns(f));
    const allFindings = results.flatMap(r => r.findings);

    const bySeverity = { high: 0, medium: 0, low: 0 };
    const byDomain = {};

    for (const f of allFindings) {
        bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
        byDomain[f.id] = (byDomain[f.id] || 0) + 1;
    }

    return {
        totalFiles: filePaths.length,
        totalFindings: allFindings.length,
        bySeverity,
        byDomain,
        files: results.filter(r => r.findings.length > 0),
    };
}

/**
 * Format scan results as a human-readable string.
 * @param {object} report - Output from scanProject()
 * @returns {string}
 */
export function formatScanReport(report) {
    let out = '';
    out += `Files scanned: ${report.totalFiles}\n`;
    out += `Total findings: ${report.totalFindings}\n`;
    out += `  High: ${report.bySeverity.high || 0}  Medium: ${report.bySeverity.medium || 0}  Low: ${report.bySeverity.low || 0}\n`;

    if (report.files.length === 0) {
        out += '\nNo failure patterns detected. ✅\n';
        return out;
    }

    out += '\n';
    for (const file of report.files) {
        out += `── ${file.file} (${file.findings.length} findings) ──\n`;
        for (const f of file.findings) {
            const sev = f.severity === 'high' ? '🔴' : f.severity === 'medium' ? '🟡' : '🟢';
            out += `  ${sev} [${f.id}] L${f.line}: ${f.title}\n`;
            if (f.snippet !== '(file-level check)') {
                out += `     ${f.snippet}\n`;
            }
            out += `     → ${f.description}\n`;
        }
        out += '\n';
    }

    return out;
}

/**
 * Convert scan results into a compact context string for AI prompts.
 * @param {object} report - Output from scanProject()
 * @returns {string}
 */
export function formatScanForPrompt(report) {
    if (report.totalFindings === 0) return '';

    let ctx = 'FAILURE PATTERN SCAN RESULTS (focus tests on these risk areas):\n';
    for (const file of report.files) {
        for (const f of file.findings) {
            ctx += `- [${f.severity.toUpperCase()}] ${file.file}:${f.line} — ${f.title}\n`;
        }
    }
    return ctx;
}
