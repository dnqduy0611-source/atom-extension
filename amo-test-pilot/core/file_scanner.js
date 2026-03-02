/**
 * core/file_scanner.js — Recursive file scanner with ignore rules
 *
 * P1.1: Replaces flat readdirSync in batch operations.
 * Supports recursive walk, ignore patterns, extension filters, and file limits.
 */
import { readdirSync, statSync } from 'fs';
import { resolve, relative, extname, basename } from 'path';

// Default ignore directories
const DEFAULT_IGNORES = [
    'node_modules', '.git', 'dist', 'build', '__pycache__',
    '.next', '.nuxt', '.cache', 'coverage', '.nyc_output',
    'output', '.venv', 'venv', 'env',
];

// Default ignore file patterns
const TEST_FILE_PATTERNS = [
    /\.test\./,       // foo.test.js
    /\.spec\./,       // foo.spec.js
    /^test_/,         // test_foo.py
    /\.d\.ts$/,       // foo.d.ts (type definitions)
    /\.min\./,        // foo.min.js
];

/**
 * Recursively scan a directory for source files.
 * @param {string} dirPath - Root directory to scan
 * @param {object} [options]
 * @param {string[]} [options.extensions] - Allowed file extensions (e.g. ['.js', '.py'])
 * @param {string[]} [options.ignore] - Additional directory names to ignore
 * @param {number} [options.maxFiles] - Maximum files to return (default: 50)
 * @param {number} [options.maxDepth] - Maximum recursion depth (default: 10)
 * @param {boolean} [options.includeTests] - Include test files (default: false)
 * @returns {{ files: string[], scanned: number, skipped: number, truncated: boolean }}
 */
export function scanFiles(dirPath, options = {}) {
    const {
        extensions = ['.js', '.ts', '.mjs', '.py'],
        ignore = [],
        maxFiles = 50,
        maxDepth = 10,
        includeTests = false,
    } = options;

    const ignoreSet = new Set([...DEFAULT_IGNORES, ...ignore]);
    const result = [];
    let scanned = 0;
    let skipped = 0;
    let truncated = false;

    function walk(dir, depth) {
        if (depth > maxDepth || truncated) return;

        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch { /* permission denied or inaccessible dir — skip silently */
            skipped++;
            return;
        }

        for (const entry of entries) {
            if (truncated) return;

            const fullPath = resolve(dir, entry.name);

            if (entry.isDirectory()) {
                if (ignoreSet.has(entry.name) || entry.name.startsWith('.')) {
                    skipped++;
                    continue;
                }
                walk(fullPath, depth + 1);
            } else if (entry.isFile()) {
                scanned++;
                const ext = extname(entry.name);
                if (!extensions.includes(ext)) continue;

                // Skip test files unless explicitly included
                if (!includeTests) {
                    const name = basename(entry.name);
                    if (TEST_FILE_PATTERNS.some(p => p.test(name))) continue;
                }

                // Check file size (skip very large files)
                try {
                    const stat = statSync(fullPath);
                    if (stat.size > 200000) { // 200KB
                        skipped++;
                        continue;
                    }
                } catch { /* stat failure — skip file */
                    continue;
                }

                result.push(fullPath);

                if (result.length >= maxFiles) {
                    truncated = true;
                    return;
                }
            }
        }
    }

    walk(dirPath, 0);

    return {
        files: result,
        scanned,
        skipped,
        truncated,
    };
}
