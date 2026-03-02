/**
 * modules/unit_gen.js — AI Unit Test Generator
 * Phase 1: Core module
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, basename, extname, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { parse as babelParse } from '@babel/parser';
import { AIClient } from '../core/ai_client.js';
import { CONFIG, requireApiKey } from '../core/config.js';
import { validateAndFix } from '../core/validator.js';
import { stripCodeBlock } from '../core/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Language detection ──────────────────────────────────────────────────────

export function detectLanguage(filePath) {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.py') return 'python';
    return 'javascript'; // .js .ts .mjs .cjs
}

// ─── AST Extraction ──────────────────────────────────────────────────────────

/**
 * Extract functions/classes từ source code bằng AST.
 * JS: @babel/parser | Python: built-in ast module
 * @returns {Array<{name: string, type: string, startLine: number, endLine: number}>}
 */
export function extractCodeItemsAST(sourceCode, lang) {
    if (lang === 'python') {
        return extractPythonItemsAST(sourceCode);
    }
    return extractJSItemsAST(sourceCode);
}

function extractJSItemsAST(sourceCode) {
    let ast;
    try {
        ast = babelParse(sourceCode, {
            sourceType: 'unambiguous',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
        });
    } catch {
        // Nếu babel fail hoàn toàn, trả về outline rỗng — AI vẫn nhận full source
        return [];
    }

    const items = [];

    function visit(node) {
        if (!node || typeof node !== 'object') return;

        if (node.type === 'FunctionDeclaration' && node.id) {
            items.push({
                name: node.id.name,
                type: 'function',
                startLine: node.loc?.start?.line ?? 0,
                endLine: node.loc?.end?.line ?? 0,
            });
        }

        if (
            node.type === 'VariableDeclarator' &&
            node.init &&
            (node.init.type === 'ArrowFunctionExpression' || node.init.type === 'FunctionExpression') &&
            node.id?.name
        ) {
            items.push({
                name: node.id.name,
                type: 'function',
                startLine: node.loc?.start?.line ?? 0,
                endLine: node.loc?.end?.line ?? 0,
            });
        }

        if (node.type === 'ClassDeclaration' && node.id) {
            items.push({
                name: node.id.name,
                type: 'class',
                startLine: node.loc?.start?.line ?? 0,
                endLine: node.loc?.end?.line ?? 0,
            });
        }

        // Traverse children
        for (const key of Object.keys(node)) {
            if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
            const child = node[key];
            if (Array.isArray(child)) {
                child.forEach(visit);
            } else if (child && typeof child === 'object' && child.type) {
                visit(child);
            }
        }
    }

    visit(ast.program);
    return items;
}

// Python AST extractor script — tuỳ chỉnh quotes để tránh shell escaping
const PYTHON_AST_SCRIPT = `import ast, json, sys
src = sys.stdin.read()
try:
    tree = ast.parse(src)
except SyntaxError:
    print(json.dumps([]))
    sys.exit(0)
items = []
for node in ast.walk(tree):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        items.append({"name": node.name, "type": "function", "startLine": node.lineno, "endLine": getattr(node, "end_lineno", node.lineno)})
    elif isinstance(node, ast.ClassDef):
        items.append({"name": node.name, "type": "class", "startLine": node.lineno, "endLine": getattr(node, "end_lineno", node.lineno)})
print(json.dumps(items))
`;

function extractPythonItemsAST(sourceCode) {
    // Dùng temp file thay vì -c flag để tránh shell escaping phức tạp trên Windows
    const tmpScript = resolve(CONFIG.OUTPUT_DIR, `_ast_extractor_${Date.now()}.py`);
    try {
        mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
        writeFileSync(tmpScript, PYTHON_AST_SCRIPT);
        const result = execSync(`python "${tmpScript}"`, {
            input: sourceCode,
            encoding: 'utf-8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return JSON.parse(result.trim() || '[]');
    } catch {
        return [];
    } finally {
        // Cleanup temp script
        try { unlinkSync(tmpScript); } catch { /* ignore */ }
    }
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Chia file lớn thành chunks theo function groups.
 * Mỗi chunk giữ context header (imports, top-level defs) + một nhóm functions.
 */
export function splitByFunctionGroups(sourceCode, codeItems, { maxChunkSize = 40000 } = {}) {
    if (sourceCode.length <= CONFIG.CHUNK_THRESHOLD) {
        return [{ code: sourceCode, items: codeItems }];
    }

    const lines = sourceCode.split('\n');

    // Lấy header: từ đầu file đến function đầu tiên (imports, constants, class defs)
    const firstItemLine = codeItems.length > 0
        ? Math.max(0, Math.min(...codeItems.map(i => i.startLine)) - 1)
        : 0;
    const headerLines = lines.slice(0, firstItemLine);
    const header = headerLines.join('\n');

    if (codeItems.length === 0) {
        // Không parse được — chia đơn giản theo maxChunkSize
        const chunks = [];
        for (let i = 0; i < sourceCode.length; i += maxChunkSize) {
            chunks.push({ code: sourceCode.slice(i, i + maxChunkSize), items: [] });
        }
        return chunks;
    }

    // Nhóm items vào chunks sao cho mỗi chunk <= maxChunkSize
    const chunks = [];
    let currentItems = [];
    let currentSize = header.length;

    for (const item of codeItems) {
        const itemCode = lines.slice(item.startLine - 1, item.endLine).join('\n');
        const itemSize = itemCode.length;

        if (currentSize + itemSize > maxChunkSize && currentItems.length > 0) {
            // Flush chunk hiện tại
            const chunkCode = buildChunk(header, lines, currentItems);
            chunks.push({ code: chunkCode, items: [...currentItems] });
            currentItems = [];
            currentSize = header.length;
        }

        currentItems.push(item);
        currentSize += itemSize;
    }

    if (currentItems.length > 0) {
        chunks.push({ code: buildChunk(header, lines, currentItems), items: currentItems });
    }

    return chunks.length > 0 ? chunks : [{ code: sourceCode, items: codeItems }];
}

function buildChunk(header, allLines, items) {
    const parts = [header];
    for (const item of items) {
        parts.push(allLines.slice(item.startLine - 1, item.endLine).join('\n'));
    }
    return parts.filter(Boolean).join('\n\n');
}

// ─── Existing test finder ─────────────────────────────────────────────────────

export function findExistingTests(filePath) {
    const base = basename(filePath, extname(filePath));
    const dir = dirname(filePath);

    const candidates = [
        resolve(dir, `${base}.test.js`),
        resolve(dir, `${base}.test.ts`),
        resolve(dir, `${base}.spec.js`),
        resolve(dir, `${base}.spec.ts`),
        resolve(dir, `__tests__/${base}.test.js`),
        resolve(dir, `tests/test_${base}.py`),
        resolve(CONFIG.OUTPUT_DIR, `unit/${base}.test.js`),
    ];

    for (const p of candidates) {
        if (existsSync(p)) {
            return readFileSync(p, 'utf-8');
        }
    }
    return null;
}

// ─── Project context ──────────────────────────────────────────────────────────

const AMO_STORIES_MARKERS = ['amo-stories-engine', 'app/narrative', 'app/routers', 'app/models', 'app/engine'];

/**
 * Detect project context from file path.
 * Returns richer context for known projects (amoisekai, atom-extension).
 * @param {string} [filePath] - Optional source file path for project detection
 */
export function getProjectContext(filePath = '') {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // ── Amoisekai (amo-stories-engine) detection ──────────────────────────────
    const isAmoisekai = AMO_STORIES_MARKERS.some(m => normalizedPath.includes(m));
    if (isAmoisekai) {
        // Detect sub-module type from path
        const subModule = normalizedPath.includes('/routers/') ? 'router'
            : normalizedPath.includes('/narrative/') ? 'agent'
                : normalizedPath.includes('/models/') ? 'model'
                    : normalizedPath.includes('/engine/') ? 'engine'
                        : normalizedPath.includes('/security/') ? 'security'
                            : 'unknown';

        return {
            project: 'amoisekai',
            packageName: 'amo-stories-engine',
            framework: 'langraph+fastapi',
            language: 'python',
            subModule,
            patterns: [
                'LangGraph pipeline with async agents',
                'Pydantic v2 models (NarrativeState, PlayerState, etc.)',
                'FastAPI routers',
                'LangChain LLMs (ChatGoogleGenerativeAI) — must be mocked with AsyncMock',
                'Agent functions: async def run_xxx(state: NarrativeState, llm) -> dict',
            ],
        };
    }

    // ── ATOM Chrome Extension detection ───────────────────────────────────────
    const pkgPath = resolve(CONFIG.EXTENSION_PATH, 'package.json');
    const tsconfigPath = resolve(CONFIG.EXTENSION_PATH, 'tsconfig.json');

    const ctx = { project: 'atom-extension' };
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            ctx.packageName = pkg.name;
            ctx.type = pkg.type;
            ctx.dependencies = Object.keys(pkg.dependencies || {});
        } catch { /* ignore */ }
    }
    if (existsSync(tsconfigPath)) {
        ctx.hasTypeScript = true;
    }
    return ctx;
}

// ─── Model schema extraction ─────────────────────────────────────────────────

/**
 * Scan source code for `from app.models.xxx import Yyy` patterns,
 * read the actual model files, and extract Pydantic field signatures.
 * Returns a compact schema string the AI can use for correct fixtures.
 *
 * @param {string} sourceCode - Source code to scan for model imports
 * @param {string} sourceFilePath - Absolute path to the source file
 * @returns {string} Compact model schema block, or '' if none found
 */
export function extractModelSchemas(sourceCode, sourceFilePath) {
    // Find all `from app.models.xxx import Yyy, Zzz` lines
    // Also catches imports inside `if TYPE_CHECKING:` blocks
    const importPattern = /^\s*from\s+(app\.models\.[\w.]+)\s+import\s+(.+)$/gm;
    const modelImports = [];
    let match;
    while ((match = importPattern.exec(sourceCode)) !== null) {
        const modulePath = match[1];  // e.g. "app.models.world_state"
        const names = match[2].split(',').map(s => s.trim()).filter(Boolean);
        modelImports.push({ modulePath, names });
    }

    // Also scan type annotations for model references not caught by imports
    // e.g. `def track_empire_resonance(ws: WorldState, delta: int)` — WorldState may be in TYPE_CHECKING
    if (modelImports.length === 0) {
        // Fallback: scan for known Amoisekai model names in type annotations
        const knownModels = {
            'WorldState': 'app.models.world_state',
            'NarrativeState': 'app.models.pipeline',
            'PlayerState': 'app.models.player',
            'Weapon': 'app.models.weapon',
            'CombatState': 'app.models.combat',
            'Choice': 'app.models.story',
            'StoryState': 'app.models.story',
            'SoulForgeState': 'app.models.soul_forge',
            'SkillCatalogEntry': 'app.models.skill_catalog',
            'UniqueSkillGrowth': 'app.models.unique_skill_growth',
        };
        for (const [className, modulePath] of Object.entries(knownModels)) {
            // Check if class name appears as type annotation: `: ClassName` or `-> ClassName`
            const colonPattern = new RegExp(`:\\s*${className}\\b`);
            const arrowPattern = new RegExp(`->\\s*${className}\\b`);
            if (colonPattern.test(sourceCode) || arrowPattern.test(sourceCode)) {
                modelImports.push({ modulePath, names: [className] });
            }
        }
    }

    if (modelImports.length === 0) return '';

    // Resolve model file paths relative to the source file
    const normalized = sourceFilePath.replace(/\\/g, '/');
    const appIdx = normalized.indexOf('/app/');
    if (appIdx === -1) return '';
    const projectRoot = normalized.slice(0, appIdx);

    const schemas = [];
    const seen = new Set();

    for (const { modulePath, names } of modelImports) {
        // Convert app.models.world_state → app/models/world_state.py
        const relPath = modulePath.replace(/\./g, '/') + '.py';
        const absPath = resolve(projectRoot, relPath);

        if (seen.has(absPath) || !existsSync(absPath)) continue;
        seen.add(absPath);

        try {
            const modelSource = readFileSync(absPath, 'utf-8');
            const extracted = extractPydanticFields(modelSource, names);
            if (extracted) {
                schemas.push(`# ${modulePath} — imported: ${names.join(', ')}\n${extracted}`);
            }
        } catch { /* file read error — skip */ }
    }

    if (schemas.length === 0) return '';
    return schemas.join('\n\n');
}

/**
 * Extract Pydantic field definitions from a model source file.
 * Only extracts fields for the classes specified in `targetNames`.
 * Returns a compact representation: `ClassName(field: type = default, ...)`
 */
function extractPydanticFields(modelSource, targetNames) {
    const results = [];
    const lines = modelSource.split(/\r?\n/);

    for (const targetName of targetNames) {
        // Find `class TargetName(BaseModel):` or `class TargetName(SomeParent):`
        const classPattern = new RegExp(`^class\\s+${targetName}\\s*\\(`);
        let classStart = -1;
        for (let i = 0; i < lines.length; i++) {
            if (classPattern.test(lines[i].trimStart())) {
                classStart = i;
                break;
            }
        }
        if (classStart === -1) continue;

        // Collect fields until next class/function or end of indented block
        const fields = [];
        let inDocstring = false;
        let inMethod = false;    // Track method body to skip it entirely
        let methodIndent = 0;    // Indentation level of the method definition
        for (let i = classStart + 1; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trimStart();
            const indent = line.length - line.trimStart().length;

            // Track multi-line docstring state
            if (inDocstring) {
                if (trimmed.includes('"""') || trimmed.includes("'''")) {
                    inDocstring = false;
                }
                continue;
            }
            // Opening docstring — check if single-line or multi-line
            if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                const quote = trimmed.slice(0, 3);
                if (trimmed.indexOf(quote, 3) === -1) {
                    inDocstring = true;
                }
                continue;
            }

            // End of class: non-indented non-blank line
            if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#')) {
                break;
            }

            // Track method blocks — skip everything inside def/async def
            if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
                inMethod = true;
                methodIndent = indent;
                continue;
            }
            if (inMethod) {
                // Exit method when we see a line at same or lesser indentation
                // that isn't blank and isn't more indented than the def line
                if (trimmed && indent <= methodIndent) {
                    inMethod = false;
                    // Fall through — this line might be a field or another method
                    if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
                        inMethod = true;
                        methodIndent = indent;
                        continue;
                    }
                } else {
                    continue; // Still inside method body
                }
            }

            // Skip comments, decorators, blank lines
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) {
                continue;
            }
            // Match field: `name: type = default` or `name: type = Field(...)`
            const fieldMatch = trimmed.match(/^(\w+)\s*:\s*(.+?)\s*(?:=\s*(.+?))?\s*$/);
            if (fieldMatch) {
                const [, name, type, defaultVal] = fieldMatch;
                // Skip lines that look like method parameters (trailing comma)
                if (defaultVal && defaultVal.endsWith(',')) continue;
                // Skip obvious local variables (lowercase single words assigned to literals)
                if (name === 'parts' || name === 'result' || name === 'items') continue;
                if (defaultVal) {
                    const shortDefault = defaultVal.length > 60 ? defaultVal.slice(0, 57) + '...' : defaultVal;
                    fields.push(`${name}: ${type} = ${shortDefault}`);
                } else {
                    fields.push(`${name}: ${type}`);
                }
            }
        }

        if (fields.length > 0) {
            // Compact format: one field per line, indented
            results.push(`class ${targetName}:\n  ${fields.join('\n  ')}`);
        }
    }

    return results.join('\n\n');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function loadSystemPrompt() {
    const promptPath = resolve(__dirname, '../prompts/unit_gen_system.md');
    if (!existsSync(promptPath)) {
        throw new Error(`System prompt not found: ${promptPath}`);
    }
    return readFileSync(promptPath, 'utf-8');
}

export function buildUnitPrompt({ sourceCode, codeItems, lang, testFramework, existingTests, projectContext, isChunk, chunkIndex, modelSchemas }) {
    const itemsSummary = codeItems.length > 0
        ? `\nFunctions/Classes detected:\n${codeItems.map(i => `  - ${i.name} (${i.type}, line ${i.startLine}-${i.endLine})`).join('\n')}`
        : '\n(Could not parse AST — analyze source code directly)';

    const chunkNote = isChunk
        ? `\n\n> NOTE: This is chunk ${chunkIndex + 1} of a large file. Generate tests for ONLY the functions shown in this chunk. Use the same describe block name as other chunks would use.`
        : '';

    const existingNote = existingTests
        ? `\n\nExisting tests (do NOT duplicate these):\n\`\`\`\n${existingTests.slice(0, 2000)}\n\`\`\``
        : '';

    // Build project context header
    let ctxNote = '';
    if (projectContext.project === 'amoisekai') {
        // Prominent Amoisekai context block so AI applies the right mock patterns
        ctxNote = `
Project: amoisekai (amo-stories-engine)
Sub-module: ${projectContext.subModule}
Framework: LangGraph + FastAPI + Pydantic v2
Test framework: ${testFramework}

IMPORTANT — Apply Amoisekai-specific patterns from the system prompt:
- Mock LLMs with AsyncMock (NEVER instantiate ChatGoogleGenerativeAI)
- Use @pytest.mark.asyncio for all async agent functions
- Agent functions follow: async def run_xxx(state: NarrativeState, llm) -> dict
- Import NarrativeState from app.models.pipeline for fixtures
${projectContext.subModule === 'router' ? '- Use FastAPI TestClient (from fastapi.testclient import TestClient)' : ''}
${projectContext.subModule === 'agent' ? '- Test both happy path AND JSON parse failure (invalid json from llm)' : ''}
${projectContext.subModule === 'model' ? '- Test Pydantic field defaults, validators, and type coercion' : ''}`;
    } else if (projectContext.packageName) {
        ctxNote = `\nProject: ${projectContext.packageName} (${projectContext.type || 'commonjs'})`;
    }

    // Error-path context for the AI
    const errorPathNote = projectContext.project === 'amoisekai'
        ? `\nINCLUDE ERROR-PATH TESTS: LLM returns invalid JSON, LLM returns empty string, LLM throws exception, missing state fields.`
        : `\nINCLUDE ERROR-PATH TESTS: null/undefined inputs, network failures, malformed responses, boundary values.`;

    // Model schema context for correct fixtures
    const schemaNote = modelSchemas
        ? `\n\nMODEL SCHEMAS (use these exact fields for fixtures — do NOT guess constructor args):\n${modelSchemas}`
        : '';

    return `Language: ${lang}${ctxNote}${itemsSummary}${chunkNote}${existingNote}${schemaNote}

Source code to test:
\`\`\`${lang === 'python' ? 'python' : 'javascript'}
${sourceCode}
\`\`\`

Generate comprehensive unit tests for ALL functions/classes in the source code above.${errorPathNote}`;
}

// ─── Syntax validation ────────────────────────────────────────────────────────

/**
 * Validate generated test code syntax.
 * JS: @babel/parser | Python: python compile()
 * Logs warning + saves .error.txt if invalid (không crash batch).
 */
export function validateTestSyntax(code, lang, outputPath = null) {
    if (!code || !code.trim()) {
        throw new Error('AI returned empty code');
    }

    if (lang === 'python') {
        return validatePythonSyntax(code, outputPath);
    }
    return validateJSSyntax(code, outputPath);
}

function validateJSSyntax(code, outputPath) {
    // Thử parse thẳng
    try {
        babelParse(code, { sourceType: 'module', plugins: ['typescript'], errorRecovery: false });
        return code;
    } catch (firstErr) {
        // Thử strip trailing markdown nếu AI bọc trong ```
        const stripped = stripCodeBlock(code);
        try {
            babelParse(stripped, { sourceType: 'module', plugins: ['typescript'], errorRecovery: false });
            return stripped;
        } catch (secondErr) {
            const errMsg = `Parse error at line ${secondErr.loc?.line || '?'}: ${secondErr.message}`;
            if (outputPath) {
                writeFileSync(outputPath + '.error.txt', `${errMsg}\n\n--- RAW OUTPUT ---\n${code}`);
                console.warn(`  [!] Syntax error in generated code. Saved raw output to ${outputPath}.error.txt`);
            }
            throw new Error(errMsg);
        }
    }
}

function validatePythonSyntax(code, outputPath) {
    const cleaned = stripCodeBlock(code);
    const tmpPath = resolve(CONFIG.OUTPUT_DIR, `_tmp_validate_${Date.now()}.py`);
    try {
        writeFileSync(tmpPath, cleaned);
        execSync(`python -c "compile(open(${JSON.stringify(tmpPath)}).read(), '<string>', 'exec')"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10000,
        });
        try { unlinkSync(tmpPath); } catch { /* ignore */ }
        return cleaned;
    } catch (err) {
        try { unlinkSync(tmpPath); } catch { /* ignore */ }
        const errMsg = err.stderr?.toString() || err.message;
        // Python not installed / Windows alias → not a real syntax error
        // Return stripped code so the file is still usable
        const isPythonMissing = errMsg.includes('was not found') || errMsg.includes('not recognized') || errMsg.includes('No such file');
        if (isPythonMissing) {
            console.warn('  [!] Python not found — skipping syntax check, saving stripped code');
            return cleaned;
        }
        // Real syntax error — save error file and throw
        if (outputPath) {
            writeFileSync(outputPath + '.error.txt', `${errMsg}\n\n--- RAW OUTPUT ---\n${code}`);
            console.warn(`  [!] Python syntax error. Saved raw output to ${outputPath}.error.txt`);
        }
        throw new Error(`Python syntax error: ${errMsg}`);
    }
}

// stripMarkdownCodeBlock replaced by shared stripCodeBlock from core/utils.js

// ─── Output path ──────────────────────────────────────────────────────────────

export function getTestOutputPath(filePath, testFramework, overwrite = false) {
    const base = basename(filePath, extname(filePath));
    const ext = testFramework === 'pytest' ? '.py' : '.test.js';
    const prefix = testFramework === 'pytest' ? 'test_' : '';
    const unitDir = resolve(CONFIG.OUTPUT_DIR, 'unit');

    mkdirSync(unitDir, { recursive: true });

    if (overwrite) {
        return resolve(unitDir, `${prefix}${base}${ext}`);
    }
    // Append timestamp để tránh overwrite
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return resolve(unitDir, `${prefix}${base}_${ts}${ext}`);
}

// ─── Chunk merge ──────────────────────────────────────────────────────────────

export function mergeTestChunks(allTestCode, lang) {
    if (allTestCode.length === 1) return allTestCode[0];

    const cleaned = allTestCode.map(c => stripCodeBlock(c));

    if (lang === 'python') {
        // Deduplicate imports ở đầu mỗi chunk
        const imports = new Set();
        const bodies = [];
        for (const chunk of cleaned) {
            const lines = chunk.split('\n');
            const bodyLines = [];
            for (const line of lines) {
                if (line.startsWith('import ') || line.startsWith('from ')) {
                    imports.add(line);
                } else {
                    bodyLines.push(line);
                }
            }
            bodies.push(bodyLines.join('\n').trim());
        }
        return [...imports].join('\n') + '\n\n' + bodies.join('\n\n');
    }

    // JS: deduplicate import statements
    const imports = new Set();
    const bodies = [];
    for (const chunk of cleaned) {
        const lines = chunk.split('\n');
        const bodyLines = [];
        for (const line of lines) {
            // Bắt tất cả dạng import:
            //   import { x } from 'y'   — named
            //   import x from 'y'       — default
            //   import * as x from 'y'  — namespace
            //   import 'side-effect'    — side-effect (không có 'from')
            const isImport = line.startsWith('import ') && (
                line.includes(' from ') ||
                /^import\s+['"]/.test(line)
            );
            if (isImport) {
                imports.add(line);
            } else {
                bodyLines.push(line);
            }
        }
        bodies.push(bodyLines.join('\n').trim());
    }
    return [...imports].join('\n') + '\n\n' + bodies.join('\n\n');
}

// ─── Test counter ─────────────────────────────────────────────────────────────

export function countTests(code) {
    if (!code) return 0;
    // Vitest: count `it(` or `test(`
    const vitestMatches = (code.match(/\bit\s*\(|test\s*\(/g) || []).length;
    // pytest: count `def test_`
    const pytestMatches = (code.match(/def test_/g) || []).length;
    return vitestMatches + pytestMatches;
}

// ─── Auto-inject missing imports ──────────────────────────────────────────────

/**
 * Convert a source file path to a Python module path.
 * e.g. "d:/Amo/.../amo-stories-engine/app/engine/weapon_bond.py" → "app.engine.weapon_bond"
 * @param {string} filePath - Absolute path to source file
 * @returns {string|null} Python module path or null if cannot determine
 */
function toPythonModulePath(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    // Match from 'app/' onwards (common Python package root)
    const match = normalized.match(/\/(app\/[^.]+)\.py$/);
    if (match) {
        return match[1].replace(/\//g, '.');
    }
    return null;
}

/**
 * Auto-inject missing imports for source functions/classes into generated test code.
 * Scans the test code for bare function/class calls that match the source AST,
 * and prepends the correct `from module import ...` line if missing.
 *
 * @param {string} testCode - Generated test code
 * @param {string} sourceFilePath - Absolute path to the source file being tested
 * @param {Array<{name: string, type: string}>} codeItems - AST-extracted items from source
 * @param {string} lang - 'python' | 'javascript'
 * @returns {string} Test code with imports injected
 */
export function injectMissingImports(testCode, sourceFilePath, codeItems, lang) {
    if (!testCode || codeItems.length === 0) return testCode;

    if (lang === 'python') {
        return injectPythonImports(testCode, sourceFilePath, codeItems);
    }
    // JS: import injection is more complex (ESM vs CJS, relative paths)
    // For now, only auto-inject for Python
    return testCode;
}

function injectPythonImports(testCode, sourceFilePath, codeItems) {
    const modulePath = toPythonModulePath(sourceFilePath);
    if (!modulePath) return testCode;

    // Get all function/class names from source AST
    const sourceNames = codeItems
        .filter(item => !item.name.startsWith('_'))  // skip private
        .map(item => item.name);

    if (sourceNames.length === 0) return testCode;

    // Check which source names are used in test code but not already imported
    const usedNames = sourceNames.filter(name => {
        // Check if name appears as a bare call: name( or name.
        const callPattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
        const attrPattern = new RegExp(`\\b${name}\\.`, 'g');
        return callPattern.test(testCode) || attrPattern.test(testCode);
    });

    if (usedNames.length === 0) return testCode;

    // Check if already imported from the correct module
    const existingImportPattern = new RegExp(
        `from\\s+${modulePath.replace(/\./g, '\\.')}\\s+import\\s+`,
    );
    if (existingImportPattern.test(testCode)) {
        // There's already an import line from this module — check what's missing
        const importMatch = testCode.match(
            new RegExp(`from\\s+${modulePath.replace(/\./g, '\\.')}\\s+import\\s+(.+)`)
        );
        if (importMatch) {
            const alreadyImported = importMatch[1].split(',').map(s => s.trim());
            const missing = usedNames.filter(n => !alreadyImported.includes(n));
            if (missing.length === 0) return testCode;
            // Expand the existing import line
            const allNames = [...alreadyImported, ...missing];
            const newImportLine = allNames.length > 3
                ? `from ${modulePath} import (\n    ${allNames.join(',\n    ')}\n)`
                : `from ${modulePath} import ${allNames.join(', ')}`;
            return testCode.replace(importMatch[0], newImportLine);
        }
    }

    // No existing import — prepend a new import line after the last top-level import
    const importLine = usedNames.length > 3
        ? `from ${modulePath} import (\n    ${usedNames.join(',\n    ')}\n)`
        : `from ${modulePath} import ${usedNames.join(', ')}`;

    // Find insertion point: after the last import/from line
    const lines = testCode.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
            lastImportIdx = i;
        } else if (trimmed !== '' && lastImportIdx >= 0) {
            break; // past the import block
        }
    }

    if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine);
    } else {
        // No imports at all — prepend
        lines.unshift(importLine);
    }

    return lines.join('\n');
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Generate unit tests for a single file.
 * @param {string} filePath - Absolute or relative path to source file
 * @param {{ model?: string, overwrite?: boolean, lang?: string }} options
 */
export async function generateUnitTests(filePath, options = {}) {
    requireApiKey();

    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) {
        throw new Error(`File not found: ${resolvedPath}`);
    }

    const sourceCode = readFileSync(resolvedPath, 'utf-8');

    if (sourceCode.length > CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File too large: ${sourceCode.length} bytes (max ${CONFIG.MAX_FILE_SIZE}). Consider splitting first.`);
    }

    const lang = options.lang || detectLanguage(resolvedPath);
    const testFramework = lang === 'python' ? 'pytest' : 'vitest';

    console.log(`  Language: ${lang} | Framework: ${testFramework}`);

    // Extract code items via AST
    const codeItems = extractCodeItemsAST(sourceCode, lang);
    console.log(`  AST: found ${codeItems.length} functions/classes`);

    // Chunk if needed
    const chunks = splitByFunctionGroups(sourceCode, codeItems, { maxChunkSize: 40000 });
    if (chunks.length > 1) {
        console.log(`  Large file: split into ${chunks.length} chunks`);
    }

    const existingTests = findExistingTests(resolvedPath);
    const projectContext = getProjectContext(resolvedPath);
    const modelSchemas = projectContext.project === 'amoisekai'
        ? extractModelSchemas(sourceCode, resolvedPath)
        : '';
    if (modelSchemas) {
        console.log(`  📋 Injecting model schemas into prompt (${modelSchemas.split('\n').length} lines)`);
    }
    const SYSTEM_PROMPT = loadSystemPrompt();
    const aiClient = new AIClient(CONFIG.OPENROUTER_API_KEY, { model: options.model || CONFIG.UNIT_GEN_MODEL });

    const allTestCode = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunks.length > 1) {
            console.log(`  Generating chunk ${i + 1}/${chunks.length}...`);
        }

        const userPrompt = buildUnitPrompt({
            sourceCode: chunk.code,
            codeItems: chunk.items,
            lang,
            testFramework,
            existingTests,
            projectContext,
            modelSchemas,
            isChunk: chunks.length > 1,
            chunkIndex: i,
        });

        const testCode = await aiClient.call({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            maxTokens: CONFIG.MAX_TOKENS_PER_CALL,
        });

        allTestCode.push(testCode);
    }

    // Merge + auto-inject imports + validate
    let merged = mergeTestChunks(allTestCode, lang);
    merged = injectMissingImports(merged, resolvedPath, codeItems, lang);
    const outputPath = getTestOutputPath(resolvedPath, testFramework, options.overwrite);

    let validated;
    try {
        validated = validateTestSyntax(merged, lang, outputPath);
    } catch (err) {
        console.warn(`  [!] Syntax validation failed: ${err.message}`);
        // Still strip markdown fences even if validation fails
        validated = stripCodeBlock(merged);
    }

    writeFileSync(outputPath, validated);

    // ─── Validation loop: run generated test + auto-fix if needed ─────────
    let validationResult = null;
    if (options.validate !== false && CONFIG.VALIDATE_AFTER_GENERATE) {
        console.log(`  🔄 Running validation loop...`);
        validationResult = await validateAndFix(outputPath, {
            lang,
            sourceCode,
            model: options.model || CONFIG.UNIT_GEN_MODEL,
        });
    }

    const testCount = countTests(readFileSync(outputPath, 'utf-8'));
    return {
        outputPath,
        testCount,
        chunksUsed: chunks.length,
        lang,
        testFramework,
        validation: validationResult,
    };
}
