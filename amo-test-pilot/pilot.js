#!/usr/bin/env node
/**
 * pilot.js — AMO TEST PILOT CLI entry point
 * Usage: node pilot.js <command> [args] [options]
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { readdirSync, statSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { generateUnitTests } from './modules/unit_gen.js';
import { generateE2ETests } from './modules/e2e_gen.js';
import { generateBrowserTests, listFlowTemplates } from './modules/browser_e2e_gen.js';
import { reviewNarrativeQuality } from './modules/ux_review.js';
import { CONFIG } from './core/config.js';
import { scanFiles } from './core/file_scanner.js';
import { createCostTracker } from './core/cost_tracker.js';
import { createRunReport } from './core/run_report.js';
import { scanProject, formatScanReport } from './core/code_scanner.js';

// ─── Global error safety net ──────────────────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('\n[ATP] Unhandled async error:'), reason);
    process.exit(1);
});

const program = new Command();

program
    .name('atp')
    .description('AMO Test Pilot — AI-powered test generator')
    .version('2.1.0');

// ─── unit command ─────────────────────────────────────────────────────────────

program
    .command('unit <file>')
    .description('Generate unit tests for a JS/TS/Python file or folder')
    .option('--batch', 'Scan entire folder and generate tests for all files')
    .option('--lang <lang>', 'Force language (javascript | python)')
    .option('--overwrite', 'Overwrite existing output file (default: append timestamp)')
    .option('--model <model>', 'Override AI model (default: deepseek/deepseek-chat-v3)')
    .option('--no-validate', 'Skip validation loop (just generate, don\'t run)')
    .action(async (file, opts) => {
        const targetPath = resolve(file);
        const isBatch = opts.batch || statSync(targetPath).isDirectory();

        if (isBatch) {
            await runBatchUnit(targetPath, opts);
        } else {
            await runSingleUnit(targetPath, opts);
        }
    });

async function runSingleUnit(filePath, opts) {
    console.log(chalk.cyan(`\n[ATP] Generating unit tests for: ${filePath}`));
    try {
        const result = await generateUnitTests(filePath, {
            model: opts.model,
            overwrite: opts.overwrite,
            lang: opts.lang,
            validate: opts.validate,  // --no-validate sets this to false
        });
        console.log(chalk.green(`\n  Done!`));
        console.log(`  Tests generated : ${chalk.bold(result.testCount)}`);
        console.log(`  Output          : ${chalk.underline(result.outputPath)}`);
        if (result.chunksUsed > 1) {
            console.log(`  Chunks used     : ${result.chunksUsed} (file was large)`);
        }
        if (result.validation) {
            const v = result.validation;
            const icon = v.passed ? '✅' : '❌';
            console.log(`  Validation      : ${icon} ${v.passed ? 'PASSED' : 'FAILED'} (${v.fixRounds} fix round${v.fixRounds !== 1 ? 's' : ''})`);
        }
        console.log(chalk.gray(`\n  Run tests: npx vitest run "${result.outputPath}"`));
    } catch (err) {
        console.error(chalk.red(`\n  [ERROR] ${err.message}`));
        process.exit(1);
    }
}

async function runBatchUnit(dirPath, opts) {
    const extensions = opts.lang === 'python'
        ? ['.py']
        : ['.js', '.ts', '.mjs'];

    // P1.1: Recursive scan with ignore rules
    console.log(chalk.cyan(`\n[ATP] Scanning ${dirPath} recursively...`));
    const scan = scanFiles(dirPath, {
        extensions,
        maxFiles: CONFIG.MAX_BATCH_FILES,
    });

    if (scan.files.length === 0) {
        console.log(chalk.yellow('No matching source files found.'));
        return;
    }

    console.log(chalk.cyan(`  Found ${scan.files.length} files (scanned ${scan.scanned}, skipped ${scan.skipped}${scan.truncated ? ', truncated' : ''})\n`));

    // P1.2 + P1.3: Cost tracker + run report
    const tracker = createCostTracker();
    const report = createRunReport('unit');
    let success = 0;
    let failed = 0;

    for (const filePath of scan.files) {
        // Budget check
        const budget = tracker.shouldStop();
        if (budget.stop) {
            console.log(chalk.yellow(`\n  ⚠️  Stopping: ${budget.reason}`));
            report.addResult({ inputFile: filePath, status: 'skipped', error: budget.reason });
            break;
        }

        const relPath = filePath.replace(dirPath, '').replace(/^[\\/]/, '');
        process.stdout.write(`  ${relPath} ... `);
        try {
            const result = await generateUnitTests(filePath, {
                model: opts.model,
                overwrite: opts.overwrite,
                lang: opts.lang,
                validate: opts.validate,
            });
            console.log(chalk.green(`OK (${result.testCount} tests)`));
            tracker.trackCall(opts.model || CONFIG.UNIT_GEN_MODEL, 4000, result.testCount * 500);
            report.addResult({
                inputFile: filePath,
                outputFile: result.outputPath,
                status: 'success',
                testCount: result.testCount,
                validation: result.validation || null,
            });
            success++;
        } catch (err) {
            console.log(chalk.red(`FAIL: ${err.message}`));
            report.addResult({ inputFile: filePath, status: 'failed', error: err.message });
            failed++;
        }
    }

    // Summary
    console.log(chalk.cyan(`\n[ATP] Batch complete: ${success} OK, ${failed} failed`));
    console.log(chalk.gray(`  Output dir : ${resolve(CONFIG.OUTPUT_DIR, 'unit')}`));

    // Cost summary
    const cost = tracker.getSummary();
    if (cost.totalCalls > 0) {
        console.log(chalk.gray(`  AI calls   : ${cost.totalCalls} (est. $${cost.totalCostUSD.toFixed(4)})\n`));
    }

    // Save report
    const reportPath = report.save(cost);
    console.log(chalk.gray(`  Report     : ${reportPath}`));
}

// ─── run command ──────────────────────────────────────────────────────────────

program
    .command('run')
    .description('Run all generated tests (default: unit + e2e + browser)')
    .option('--unit', 'Run only unit tests (Vitest)')
    .option('--e2e', 'Run only E2E tests (pytest)')
    .option('--browser', 'Run only browser tests (Playwright)')
    .action((opts) => {
        const hasFlag = opts.unit || opts.e2e || opts.browser;
        const runUnit = opts.unit || !hasFlag;
        const runE2E = opts.e2e || !hasFlag;
        const runBrowser = opts.browser || !hasFlag;

        if (runUnit) {
            const unitDir = resolve(CONFIG.OUTPUT_DIR, 'unit');
            console.log(chalk.cyan(`\n[ATP] Running unit tests in: ${unitDir}`));
            try {
                execSync(`npx vitest run "${unitDir}"`, { stdio: 'inherit' });
            } catch {
                if (opts.unit) process.exit(1);
            }
        }

        if (runE2E) {
            const e2eDir = resolve(CONFIG.OUTPUT_DIR, 'e2e');
            if (existsSync(e2eDir) && readdirSync(e2eDir).some(f => f.endsWith('.py'))) {
                console.log(chalk.cyan(`\n[ATP] Running E2E tests in: ${e2eDir}`));
                try {
                    execSync(`python -m pytest "${e2eDir}" -v --tb=short`, { stdio: 'inherit' });
                } catch {
                    if (opts.e2e) process.exit(1);
                }
            } else if (opts.e2e) {
                console.log(chalk.yellow('[ATP] No E2E test files found in output/e2e/'));
            }
        }

        if (runBrowser) {
            const browserDir = resolve(CONFIG.OUTPUT_DIR, 'browser');
            if (existsSync(browserDir) && readdirSync(browserDir).some(f => f.endsWith('.spec.js'))) {
                console.log(chalk.cyan(`\n[ATP] Running browser tests in: ${browserDir}`));
                try {
                    execSync(`npx playwright test "${browserDir}"`, { stdio: 'inherit' });
                } catch {
                    if (opts.browser) process.exit(1);
                }
            } else if (opts.browser) {
                console.log(chalk.yellow('[ATP] No browser test files found in output/browser/'));
            }
        }
    });

// ─── e2e command (API integration tests for FastAPI routers) ──────────────────

program
    .command('e2e <file>')
    .description('Generate FastAPI integration tests for a router file or folder')
    .option('--overwrite', 'Overwrite existing output file')
    .option('--model <model>', 'Override AI model')
    .option('--no-validate', 'Skip validation loop')
    .action(async (file, opts) => {
        const targetPath = resolve(file);

        let files;
        try {
            if (statSync(targetPath).isDirectory()) {
                // P1.1: Recursive scan with ignore rules
                console.log(chalk.cyan(`\n[ATP] Scanning ${targetPath} recursively for .py files...`));
                const scan = scanFiles(targetPath, {
                    extensions: ['.py'],
                    maxFiles: CONFIG.MAX_BATCH_FILES,
                });
                files = scan.files;
                console.log(chalk.cyan(`  Found ${files.length} files (scanned ${scan.scanned}, skipped ${scan.skipped}${scan.truncated ? ', truncated' : ''})\n`));
            } else {
                files = [targetPath];
            }
        } catch (err) {
            console.error(chalk.red(`Cannot access: ${err.message}`));
            process.exit(1);
        }

        console.log(chalk.cyan(`[ATP] E2E generator: ${files.length} router file(s)\n`));

        // P1.2 + P1.3: Cost tracker + run report
        const tracker = createCostTracker();
        const report = createRunReport('e2e');
        let success = 0, failed = 0;
        for (const filePath of files) {
            // Budget check
            const budget = tracker.shouldStop();
            if (budget.stop) {
                console.log(chalk.yellow(`\n  ⚠️  Stopping: ${budget.reason}`));
                report.addResult({ inputFile: filePath, status: 'skipped', error: budget.reason });
                break;
            }

            process.stdout.write(`  ${filePath.split(/[\\/]/).pop()} ... `);
            try {
                const result = await generateE2ETests(filePath, {
                    model: opts.model,
                    overwrite: opts.overwrite,
                    validate: opts.validate,
                });
                console.log(chalk.green(`OK (${result.testCount} tests, ${result.endpoints} endpoints)`));
                tracker.trackCall(opts.model || CONFIG.E2E_GEN_MODEL, 4000, result.testCount * 500);
                report.addResult({
                    inputFile: filePath,
                    outputFile: result.outputPath,
                    status: 'success',
                    testCount: result.testCount,
                    validation: result.validation || null,
                });
                success++;
            } catch (err) {
                console.log(chalk.red(`FAIL: ${err.message}`));
                report.addResult({ inputFile: filePath, status: 'failed', error: err.message });
                failed++;
            }
        }

        console.log(chalk.cyan(`\n[ATP] E2E complete: ${success} OK, ${failed} failed`));
        console.log(chalk.gray(`  Output dir : ${resolve(CONFIG.OUTPUT_DIR, 'e2e')}`));

        // Cost summary + report (only for batch)
        if (files.length > 1) {
            const cost = tracker.getSummary();
            if (cost.totalCalls > 0) {
                console.log(chalk.gray(`  AI calls   : ${cost.totalCalls} (est. $${cost.totalCostUSD.toFixed(4)})\n`));
            }
            const reportPath = report.save(cost);
            console.log(chalk.gray(`  Report     : ${reportPath}`));
        }
    });

// ─── browser command (Playwright browser E2E tests) ──────────────────────────

program
    .command('browser [flow]')
    .description('Generate Playwright browser E2E tests for a flow')
    .option('--url <url>', 'Dev server URL (live mode, no mocks)')
    .option('--model <model>', 'Override AI model')
    .option('--overwrite', 'Overwrite existing output file')
    .option('--no-validate', 'Skip validation loop')
    .option('--list', 'List available flow templates')
    .action(async (flow, opts) => {
        if (opts.list) {
            console.log(chalk.cyan('\n[ATP] Available flow templates:\n'));
            listFlowTemplates().forEach(t => console.log(`  • ${t}`));
            console.log(chalk.gray('\n  Usage: node pilot.js browser "onboarding"'));
            console.log(chalk.gray('         node pilot.js browser "Custom flow description"'));
            return;
        }

        if (!flow) {
            console.error(chalk.red('\n  [ERROR] Flow description required.'));
            console.log(chalk.gray('  Usage: node pilot.js browser "onboarding"'));
            console.log(chalk.gray('         node pilot.js browser --list'));
            process.exit(1);
        }

        console.log(chalk.cyan(`\n[ATP] Browser E2E generator\n`));
        try {
            const result = await generateBrowserTests(flow, {
                url: opts.url,
                model: opts.model,
                overwrite: opts.overwrite,
                validate: opts.validate,
            });

            console.log(chalk.green(`\n  Done!`));
            console.log(`  Flow           : ${chalk.bold(result.flow)}`);
            console.log(`  Tests generated: ${chalk.bold(result.testCount)}`);
            console.log(`  Output         : ${chalk.underline(result.outputPath)}`);
            if (result.validation) {
                const v = result.validation;
                const icon = v.passed ? '✅' : '❌';
                console.log(`  Validation     : ${icon} ${v.passed ? 'PASSED' : 'FAILED'} (${v.fixRounds} fix rounds)`);
            }
            console.log(chalk.gray(`\n  Run: npx playwright test "${result.outputPath}"`));
        } catch (err) {
            console.error(chalk.red(`\n  [ERROR] ${err.message}`));
            process.exit(1);
        }
    });

// ─── ux command (Narrative quality review) ────────────────────────────────────

program
    .command('ux')
    .description('AI review — narrative quality or visual UX')
    .option('--narrative', 'Narrative quality review (text-based)')
    .option('--visual', 'Visual UX review from screenshot [Phase 5]')
    .option('--file <path>', 'Chapter JSON file to review')
    .option('--prose <text>', 'Raw prose string to review')
    .option('--api <url>', 'Fetch chapter from live API')
    .option('--story-id <id>', 'Story ID (used with --api)')
    .option('--chapter <num>', 'Chapter number (used with --api)')
    .option('--model <model>', 'Override AI model')
    .option('--overwrite', 'Overwrite existing report')
    .action(async (opts) => {
        // Visual mode — Phase 5 (not yet implemented)
        if (opts.visual) {
            console.log(chalk.yellow('[ATP] Visual UX review will be available in Phase 5.'));
            console.log(chalk.gray('  Narrative review is available now: node pilot.js ux --narrative --file <path>'));
            return;
        }

        // Default to narrative mode
        if (!opts.narrative && !opts.visual) {
            opts.narrative = true;
        }

        // Determine input type
        let input;
        if (opts.file) {
            input = { type: 'file', filePath: opts.file };
        } else if (opts.prose) {
            input = { type: 'prose', prose: opts.prose };
        } else if (opts.api) {
            if (!opts.storyId) {
                console.error(chalk.red('  [ERROR] --story-id is required with --api'));
                process.exit(1);
            }
            input = { type: 'api', apiUrl: opts.api, storyId: opts.storyId, chapterNum: opts.chapter ? Number(opts.chapter) : null };
        } else {
            console.error(chalk.red('  [ERROR] Provide input: --file <path>, --prose <text>, or --api <url>'));
            process.exit(1);
        }

        console.log(chalk.cyan(`\n[ATP] Narrative quality review\n`));

        try {
            const { outputPath, report } = await reviewNarrativeQuality(input, {
                model: opts.model,
                overwrite: opts.overwrite,
            });

            // Console output
            const overall = report.overall_score ?? '?';
            const grade = overall >= 8 ? '🟢 Excellent' : overall >= 6 ? '🟡 Good' : overall >= 4 ? '🟠 Needs Work' : '🔴 Poor';
            console.log(chalk.green(`\n  Overall Score: ${overall}/10 — ${grade}`));

            if (report.dimensions) {
                console.log('\n  Dimensions:');
                for (const [key, val] of Object.entries(report.dimensions)) {
                    const bar = '█'.repeat(Math.round(val)) + '░'.repeat(10 - Math.round(val));
                    console.log(`    ${key.padEnd(22)} ${bar} ${val}/10`);
                }
            }

            if (report.top_recommendation) {
                console.log(chalk.yellow(`\n  💡 ${report.top_recommendation}`));
            }

            console.log(chalk.gray(`\n  Full report: ${outputPath}`));
        } catch (err) {
            console.error(chalk.red(`\n  [ERROR] ${err.message}`));
            process.exit(1);
        }
    });

// ─── scan command ─────────────────────────────────────────────────────────────

program
    .command('scan')
    .description('Scan source files for failure patterns (EF-Node static analysis)')
    .argument('<path>', 'Directory or file to scan')
    .option('--ext <exts>', 'File extensions to scan (comma-separated)', '.js,.ts,.mjs,.py')
    .option('--max-files <n>', 'Maximum files to scan', '100')
    .option('--json', 'Output as JSON')
    .action(async (targetPath, opts) => {
        const absPath = resolve(targetPath);
        console.log(chalk.cyan('\n[ATP] Failure Pattern Scan\n'));

        // Gather files
        let files;
        if (existsSync(absPath) && statSync(absPath).isFile()) {
            files = [absPath];
            console.log(`  Scanning file: ${targetPath}`);
        } else if (existsSync(absPath) && statSync(absPath).isDirectory()) {
            const extensions = opts.ext.split(',').map(e => e.startsWith('.') ? e : '.' + e);
            const scan = scanFiles(absPath, {
                extensions,
                maxFiles: Number(opts.maxFiles),
                includeTests: false,
            });
            files = scan.files;
            console.log(`  Scanned: ${scan.scanned} files, using: ${files.length} (skipped: ${scan.skipped}${scan.truncated ? ', truncated' : ''})`);
        } else {
            console.error(chalk.red(`  [ERROR] Path not found: ${absPath}`));
            process.exit(1);
        }

        // Run pattern scan
        const report = scanProject(files);

        // Output
        if (opts.json) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            const sevColor = report.bySeverity.high > 0 ? chalk.red
                : report.bySeverity.medium > 0 ? chalk.yellow
                    : chalk.green;

            console.log(sevColor(`\n  Findings: ${report.totalFindings}`));
            console.log(`  🔴 High: ${report.bySeverity.high || 0}  🟡 Medium: ${report.bySeverity.medium || 0}  🟢 Low: ${report.bySeverity.low || 0}\n`);

            if (report.files.length > 0) {
                console.log(formatScanReport(report));
            } else {
                console.log(chalk.green('  No failure patterns detected. ✅'));
            }

            // Pattern summary
            if (Object.keys(report.byDomain).length > 0) {
                console.log('  Pattern breakdown:');
                for (const [id, count] of Object.entries(report.byDomain)) {
                    console.log(`    ${id}: ${count}×`);
                }
            }
        }
    });

program.parse(process.argv);

