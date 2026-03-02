/**
 * core/validator.js — Generate → Run → Auto-fix validation loop
 * 
 * Sau khi sinh test, chạy thử để validate:
 * - JS tests: `npx vitest run <file> --reporter=json`
 * - Python tests: `python -m pytest <file> --tb=short -q`
 * 
 * Nếu fail do syntax/import → gửi error log cho AI fix (max rounds configurable).
 * Nếu vẫn fail → mark `manual_review_required`.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync, unlinkSync } from 'fs';
import { CONFIG } from './config.js';
import { AIClient } from './ai_client.js';
import { stripCodeBlock } from './utils.js';

const DEFAULT_MAX_FIX_ROUNDS = CONFIG.MAX_AUTO_FIX_ROUNDS || 2;

/**
 * Validate a generated test file by running it, then auto-fix if needed.
 *
 * @param {string} testFilePath - Path to generated test file
 * @param {object} opts
 * @param {string} opts.lang - 'python' | 'javascript'
 * @param {string} opts.sourceCode - Original source code the test was generated for
 * @param {string} opts.model - AI model override
 * @returns {Promise<{ passed: boolean, fixRounds: number, finalPath: string, errors?: string }>}
 */
export async function validateAndFix(testFilePath, opts = {}) {
    const { lang = 'python', sourceCode = '', model } = opts;
    const MAX_FIX_ROUNDS = opts.maxFixRounds || DEFAULT_MAX_FIX_ROUNDS;

    // Backup original generated file
    const backupPath = testFilePath + '.original';
    if (!existsSync(backupPath)) {
        copyFileSync(testFilePath, backupPath);
    }

    let lastError = null;
    let fixRound = 0;

    // Round 0: run the original generated test
    const firstResult = runTest(testFilePath, lang);
    if (firstResult.passed) {
        console.log('  ✅ Test passed on first run');
        // Cleanup backup
        try { if (existsSync(backupPath)) unlinkSync(backupPath); } catch { /* cleanup non-critical */ }
        return { passed: true, fixRounds: 0, finalPath: testFilePath };
    }

    lastError = firstResult.error;
    console.log(`  ❌ Test failed on first run — starting auto-fix loop (max ${MAX_FIX_ROUNDS} rounds)`);

    // Auto-fix rounds
    if (!model) {
        console.warn('  [!] No model specified for auto-fix — skipping fix loop');
        return { passed: false, fixRounds: 0, finalPath: testFilePath, errors: lastError };
    }

    const aiClient = new AIClient(CONFIG.OPENROUTER_API_KEY, { model });

    for (fixRound = 1; fixRound <= MAX_FIX_ROUNDS; fixRound++) {
        console.log(`  🔧 Fix round ${fixRound}/${MAX_FIX_ROUNDS}...`);

        const currentTestCode = readFileSync(testFilePath, 'utf-8');

        const fixPrompt = buildFixPrompt({
            testCode: currentTestCode,
            errorLog: lastError,
            lang,
            sourceCode,
        });

        try {
            const fixedCode = await aiClient.call({
                messages: [
                    { role: 'system', content: FIX_SYSTEM_PROMPT },
                    { role: 'user', content: fixPrompt },
                ],
                temperature: 0.2,
                maxTokens: CONFIG.MAX_TOKENS_PER_CALL,
            });

            // Extract code from AI response
            const cleaned = stripCodeBlock(fixedCode);

            // Basic sanity: must have test-like content
            const hasTests = lang === 'python'
                ? cleaned.includes('def test_')
                : cleaned.includes('test(') || cleaned.includes('it(') || cleaned.includes('describe(');

            if (!hasTests) {
                console.log(`  ⚠️ AI fix response has no test functions — skipping`);
                continue;
            }

            writeFileSync(testFilePath, cleaned);

            // Re-run
            const result = runTest(testFilePath, lang);
            if (result.passed) {
                console.log(`  ✅ Test passed after fix round ${fixRound}`);
                // Cleanup backup
                try { if (existsSync(backupPath)) unlinkSync(backupPath); } catch { /* cleanup non-critical */ }
                return { passed: true, fixRounds: fixRound, finalPath: testFilePath };
            }

            lastError = result.error;
            console.log(`  ❌ Still failing after round ${fixRound}`);
        } catch (err) {
            console.warn(`  ⚠️ AI fix call failed: ${err.message}`);
            lastError = err.message;
        }
    }

    // All rounds exhausted — mark for manual review
    const manualPath = testFilePath + '.manual_review';
    writeFileSync(manualPath, [
        `# MANUAL REVIEW REQUIRED`,
        `# Auto-fix failed after ${MAX_FIX_ROUNDS} rounds`,
        `# Last error:`,
        `# ${lastError?.split('\n').join('\n# ')}`,
        ``,
        readFileSync(testFilePath, 'utf-8'),
    ].join('\n'));

    // Restore original for reference
    copyFileSync(backupPath, testFilePath);

    console.log(`  ⚠️ Auto-fix exhausted (${MAX_FIX_ROUNDS} rounds). Saved to: ${manualPath}`);
    return { passed: false, fixRounds: MAX_FIX_ROUNDS, finalPath: testFilePath, errors: lastError };
}

// ─── Test runner ──────────────────────────────────────────────────────────────

/**
 * Run a test file and capture pass/fail + error output.
 * @param {string} filePath
 * @param {string} lang
 * @returns {{ passed: boolean, error?: string }}
 */
function runTest(filePath, lang) {
    try {
        if (lang === 'python') {
            execSync(
                `python -m pytest "${filePath}" --tb=short -q --no-header`,
                { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' }
            );
        } else {
            execSync(
                `npx vitest run "${filePath}" --reporter=verbose`,
                { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' }
            );
        }
        return { passed: true };
    } catch (err) {
        // execSync throws on non-zero exit code
        const output = err.stdout || err.stderr || err.message || 'Unknown error';
        // Truncate to last 2000 chars to keep prompt size manageable
        const truncated = output.length > 2000
            ? '...(truncated)\n' + output.slice(-2000)
            : output;
        return { passed: false, error: truncated };
    }
}

// ─── Fix prompt builder ───────────────────────────────────────────────────────

const FIX_SYSTEM_PROMPT = `You are a test code fixer. You receive a failing test file and its error log.
Your job: fix ONLY the test code so it passes. Do NOT change the intent of the tests.

Rules:
- Fix import errors by adding/correcting imports
- Fix syntax errors
- Fix assertion errors by adjusting expected values IF the original assertion was wrong
- Do NOT remove test cases — only fix them
- Do NOT add explanatory text — output ONLY the complete fixed test code
- Preserve ALL existing test functions
- Output the ENTIRE fixed file, not just the changed parts`;

function buildFixPrompt({ testCode, errorLog, lang, sourceCode }) {
    let prompt = `## Failing test code (${lang})\n\n\`\`\`${lang}\n${testCode}\n\`\`\`\n\n`;
    prompt += `## Error log\n\n\`\`\`\n${errorLog}\n\`\`\`\n\n`;

    if (sourceCode) {
        // Include first 3000 chars of source for context
        const snippet = sourceCode.length > 3000
            ? sourceCode.slice(0, 3000) + '\n# ... (truncated)'
            : sourceCode;
        prompt += `## Original source code being tested\n\n\`\`\`${lang}\n${snippet}\n\`\`\`\n\n`;
    }

    prompt += `Fix the test code above so it passes. Output ONLY the complete fixed code, no explanations.`;
    return prompt;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

// stripCodeBlock imported from core/utils.js
