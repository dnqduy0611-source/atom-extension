/**
 * modules/e2e_gen.js — E2E API Integration Test Generator for Amoisekai
 *
 * Generates pytest integration tests for FastAPI endpoints.
 * Covers: auth mocking, DB fixtures, orchestrator mocking, response schema validation.
 *
 * Usage:
 *   node pilot.js e2e ../amo-stories-engine/app/routers/story.py
 *   node pilot.js e2e ../amo-stories-engine              (scans all routers)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AIClient } from '../core/ai_client.js';
import { CONFIG, requireApiKey } from '../core/config.js';
import { validateAndFix } from '../core/validator.js';
import { stripCodeBlock } from '../core/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load system prompt ────────────────────────────────────────────────────────

function loadE2EPrompt() {
    const promptPath = resolve(__dirname, '../prompts/e2e_gen_amoisekai.md');
    if (!existsSync(promptPath)) {
        throw new Error(`E2E system prompt not found: ${promptPath}`);
    }
    return readFileSync(promptPath, 'utf-8');
}

// ─── Router endpoint extractor ─────────────────────────────────────────────────

/**
 * Extract endpoint signatures from a FastAPI router file.
 * Uses simple regex — good enough for consistent FastAPI patterns.
 */
export function extractEndpoints(sourceCode) {
    const endpoints = [];

    // Match: @router.METHOD("path", response_model=...) + async def function_name(...)
    const pattern = /@router\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["'][^)]*\)\s*\nasync def (\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = pattern.exec(sourceCode)) !== null) {
        const [, method, path, funcName, params] = match;
        endpoints.push({
            method: method.toUpperCase(),
            path,
            funcName,
            hasAuth: params.includes('current_user') || params.includes('Depends'),
            hasPathParam: path.includes('{'),
            hasBody: method === 'post' || method === 'put' || method === 'patch',
        });
    }

    return endpoints;
}

// ─── Output path ───────────────────────────────────────────────────────────────

export function getE2EOutputPath(filePath, overwrite = false) {
    const base = basename(filePath, extname(filePath));
    const e2eDir = resolve(CONFIG.OUTPUT_DIR, 'e2e');
    mkdirSync(e2eDir, { recursive: true });

    if (overwrite) {
        return resolve(e2eDir, `test_e2e_${base}.py`);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return resolve(e2eDir, `test_e2e_${base}_${ts}.py`);
}

// ─── Conftest generator ────────────────────────────────────────────────────────

/**
 * Generate a conftest.py with shared fixtures for E2E tests.
 * Written once per e2e/ output directory.
 */
export function generateConftest(outputDir) {
    const conftestPath = resolve(outputDir, 'conftest.py');
    if (existsSync(conftestPath)) return; // Don't overwrite existing

    const content = `"""Shared fixtures for Amoisekai E2E integration tests."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient

from app.main import app
from app.security import get_current_user
from app.memory.state import StoryStateDB


TEST_USER_ID = "test_user_id_abc123"


@pytest.fixture
def mock_db():
    """In-memory SQLite database for isolation."""
    db = StoryStateDB(":memory:")
    db.connect()
    yield db
    db.close()


@pytest.fixture(autouse=False)
def override_auth():
    """Override JWT auth — returns TEST_USER_ID for all requests."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    yield TEST_USER_ID
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(autouse=False)
def override_db(mock_db):
    """Inject test DB into app."""
    import app.main as main_module
    original = main_module._db
    main_module._db = mock_db
    yield mock_db
    main_module._db = original


@pytest.fixture
async def client(override_auth, override_db):
    """Async test client with auth + DB overrides."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_orchestrator():
    """Mock StoryOrchestrator to prevent real LLM calls."""
    with patch("app.engine.orchestrator.StoryOrchestrator") as MockOrch:
        instance = MockOrch.return_value
        instance.start_new_story = AsyncMock()
        instance.generate_chapter = AsyncMock()
        yield instance
`;
    writeFileSync(conftestPath, content);
    console.log(`  conftest.py written to: ${conftestPath}`);
}

// ─── User prompt builder ───────────────────────────────────────────────────────

function buildE2EUserPrompt({ sourceCode, endpoints, routerName, mainPySnippet }) {
    const endpointSummary = endpoints.length > 0
        ? `\nEndpoints detected:\n${endpoints.map(e =>
            `  ${e.method} ${e.path} → ${e.funcName}(auth=${e.hasAuth}, body=${e.hasBody})`
        ).join('\n')}`
        : '\n(No endpoints auto-detected — analyze source code directly)';

    return `Router file: ${routerName}
${endpointSummary}

app/main.py structure (for import context):
\`\`\`python
${mainPySnippet}
\`\`\`

Router source code:
\`\`\`python
${sourceCode}
\`\`\`

Generate comprehensive FastAPI integration tests for ALL endpoints above.
Use the conftest.py fixtures (client, mock_orchestrator, override_auth, override_db, TEST_USER_ID).
Do NOT redefine fixtures already in conftest.py.

INCLUDE ERROR-PATH TESTS for each endpoint: orchestrator throws exception, invalid request body (422), empty required fields, non-existent resource (404), wrong user access (403).`;
}

// ─── Test counter (reuse pytest counter) ──────────────────────────────────────

function countPytestTests(code) {
    return (code.match(/def test_/g) || []).length;
}

// ─── Main entry ────────────────────────────────────────────────────────────────

const MAIN_PY_SNIPPET = `from app.main import app, get_db
from app.security import get_current_user
from app.engine.orchestrator import StoryOrchestrator
from app.memory.state import StoryStateDB

# app exposes: /api/story, /api/stream, /api/player, /api/soul-forge, /api/scene, /api/skill
# Auth: Depends(get_current_user) → returns user_id string (JWT validated)
# DB: get_db() → StoryStateDB singleton (SQLite)`;

/**
 * Generate E2E integration tests for a FastAPI router file.
 * @param {string} filePath - Path to the router .py file
 * @param {{ model?: string, overwrite?: boolean }} options
 */
export async function generateE2ETests(filePath, options = {}) {
    requireApiKey();

    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
    }

    const sourceCode = readFileSync(resolvedPath, 'utf-8');
    const routerName = basename(resolvedPath);

    // Detect it's a FastAPI router
    if (!sourceCode.includes('@router.') && !sourceCode.includes('APIRouter')) {
        throw new Error(`Not a FastAPI router file: ${routerName}. E2E generator targets router files.`);
    }

    console.log(`  Router: ${routerName}`);

    const endpoints = extractEndpoints(sourceCode);
    console.log(`  Endpoints detected: ${endpoints.length}`);

    const outputPath = getE2EOutputPath(resolvedPath, options.overwrite);
    const e2eDir = resolve(CONFIG.OUTPUT_DIR, 'e2e');

    // Generate conftest.py once per e2e dir
    generateConftest(e2eDir);

    const SYSTEM_PROMPT = loadE2EPrompt();
    const aiClient = new AIClient(CONFIG.OPENROUTER_API_KEY, {
        model: options.model || CONFIG.E2E_GEN_MODEL,
    });

    const userPrompt = buildE2EUserPrompt({
        sourceCode,
        endpoints,
        routerName,
        mainPySnippet: MAIN_PY_SNIPPET,
    });

    const testCode = await aiClient.call({
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.25,
        maxTokens: CONFIG.MAX_TOKENS_PER_CALL,
    });

    // Strip markdown if AI wrapped output
    const cleaned = stripCodeBlock(testCode);

    // Validate: ensure it's Python-like (has def test_ or import pytest)
    const hasPytest = cleaned.includes('def test_') || cleaned.includes('import pytest');
    if (!hasPytest) {
        const errorPath = outputPath + '.error.txt';
        writeFileSync(errorPath, `No pytest test functions detected in AI output.\n\n--- RAW OUTPUT ---\n${testCode}`);
        console.warn(`  [!] AI output may not be valid pytest code. Raw saved to: ${errorPath}`);
    }

    writeFileSync(outputPath, cleaned);

    // ─── Validation loop: run + auto-fix ──────────────────────────────────────────
    let validationResult = null;
    if (options.validate !== false && CONFIG.VALIDATE_AFTER_GENERATE && hasPytest) {
        console.log(`  🔄 Running validation loop...`);
        validationResult = await validateAndFix(outputPath, {
            lang: 'python',
            sourceCode,
            model: options.model || CONFIG.E2E_GEN_MODEL,
        });
    }

    const testCount = countPytestTests(readFileSync(outputPath, 'utf-8'));
    return { outputPath, testCount, endpoints: endpoints.length, routerName, validation: validationResult };
}

// stripMarkdown replaced by shared stripCodeBlock from core/utils.js
