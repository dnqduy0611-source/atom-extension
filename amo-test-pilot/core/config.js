/**
 * core/config.js — Configuration & environment management
 */
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

// Load .env từ amo-test-pilot/ folder
if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
} else {
    console.warn('[Config] .env not found. Copy .env.example → .env and fill in OPENROUTER_API_KEY');
}

// Kiểm tra .gitignore có chứa .env chưa
function checkGitignoreSafety() {
    const gitignorePath = resolve(__dirname, '../../.gitignore');
    if (!existsSync(gitignorePath)) return;
    const content = readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('amo-test-pilot/.env') && !content.includes('.env')) {
        console.warn('[Config] WARNING: amo-test-pilot/.env is NOT in .gitignore — risk of committing API key!');
    }
}
checkGitignoreSafety();

export const CONFIG = {
    // API
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',

    // Models
    UNIT_GEN_MODEL: process.env.ATP_UNIT_MODEL || 'deepseek/deepseek-chat-v3',
    E2E_GEN_MODEL: process.env.ATP_E2E_MODEL || 'deepseek/deepseek-chat-v3',
    BROWSER_E2E_MODEL: process.env.ATP_BROWSER_MODEL || 'deepseek/deepseek-chat-v3',
    UX_REVIEW_MODEL: process.env.ATP_UX_MODEL || 'google/gemini-2.0-flash-001',

    // Paths
    OUTPUT_DIR: resolve(__dirname, '../output'),
    PROMPTS_DIR: resolve(__dirname, '../prompts'),

    // Extension
    EXTENSION_PATH: process.env.EXTENSION_PATH || 'd:/Amo/ATOM_Extension_V2.8_public',
    WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:5173',

    // Limits
    MAX_FILE_SIZE: 200000,   // 200KB — tránh skip background.js (~150-200KB)
    CHUNK_THRESHOLD: 50000,   // >50KB → chunking mode
    MAX_TOKENS_PER_CALL: 8192,
    MAX_BATCH_FILES: parseInt(process.env.ATP_MAX_BATCH_FILES || '50', 10),

    // Validation loop
    VALIDATE_AFTER_GENERATE: process.env.ATP_VALIDATE !== 'false',  // default: true
    MAX_AUTO_FIX_ROUNDS: parseInt(process.env.ATP_MAX_FIX_ROUNDS || '2', 10),

    // Cost guardrails
    MAX_CALLS_PER_RUN: parseInt(process.env.ATP_MAX_CALLS || '50', 10),
    MAX_COST_EST_USD: parseFloat(process.env.ATP_MAX_COST || '2.0'),
};

/**
 * Validate API key exists — call trước khi gọi AI
 */
export function requireApiKey() {
    if (!CONFIG.OPENROUTER_API_KEY) {
        console.error('[Config] OPENROUTER_API_KEY is not set.');
        console.error('         1. Copy amo-test-pilot/.env.example → amo-test-pilot/.env');
        console.error('         2. Set OPENROUTER_API_KEY=<your-key>');
        console.error('         Get a key at: https://openrouter.ai/keys');
        process.exit(1);
    }
}
