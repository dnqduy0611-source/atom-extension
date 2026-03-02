/**
 * core/run_report.js — Structured JSON run report writer
 *
 * P1.3: Saves run results to output/reports/run_<timestamp>.json
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { CONFIG } from './config.js';

/**
 * Create a run report builder.
 * @param {string} command - Command that was run (unit, e2e, browser)
 * @returns {RunReport}
 */
export function createRunReport(command) {
    const startTime = Date.now();
    const results = [];

    return {
        /**
         * Add a file result to the report.
         * @param {object} entry
         * @param {string} entry.inputFile - Source file path
         * @param {string} entry.outputFile - Generated test file path  
         * @param {string} entry.status - 'success' | 'failed' | 'skipped'
         * @param {number} [entry.testCount] - Number of tests generated
         * @param {object} [entry.validation] - Validation loop result
         * @param {string} [entry.error] - Error message if failed
         */
        addResult(entry) {
            results.push({
                ...entry,
                timestamp: new Date().toISOString(),
            });
        },

        /**
         * Save the report to disk.
         * @param {object} [costSummary] - Cost tracker summary
         * @returns {string} Path to saved report
         */
        save(costSummary = null) {
            const reportsDir = resolve(CONFIG.OUTPUT_DIR, 'reports');
            if (!existsSync(reportsDir)) {
                mkdirSync(reportsDir, { recursive: true });
            }

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const success = results.filter(r => r.status === 'success').length;
            const failed = results.filter(r => r.status === 'failed').length;
            const skipped = results.filter(r => r.status === 'skipped').length;

            const report = {
                command,
                timestamp: new Date().toISOString(),
                duration_seconds: parseFloat(elapsed),
                summary: {
                    total: results.length,
                    success,
                    failed,
                    skipped,
                    total_tests: results.reduce((s, r) => s + (r.testCount || 0), 0),
                },
                cost: costSummary || null,
                results,
            };

            const filename = `run_${command}_${Date.now()}.json`;
            const reportPath = resolve(reportsDir, filename);
            writeFileSync(reportPath, JSON.stringify(report, null, 2));

            return reportPath;
        },
    };
}
