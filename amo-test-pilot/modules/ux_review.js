/**
 * modules/ux_review.js — Narrative Quality Reviewer for Amoisekai
 *
 * AI-powered review of generated narrative content: prose quality,
 * choice design, pacing, coherence, and Vietnamese writing quality.
 *
 * Usage:
 *   node pilot.js ux --file chapter_output.json      (from saved API response)
 *   node pilot.js ux --prose "Bầu trời tím thẫm..."  (raw prose string)
 *   node pilot.js ux --api http://localhost:8001 --story-id xyz --chapter 3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AIClient } from '../core/ai_client.js';
import { CONFIG, requireApiKey } from '../core/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load system prompt ────────────────────────────────────────────────────────

function loadUXPrompt() {
    const promptPath = resolve(__dirname, '../prompts/ux_narrative_review.md');
    if (!existsSync(promptPath)) {
        throw new Error(`UX review prompt not found: ${promptPath}`);
    }
    return readFileSync(promptPath, 'utf-8');
}

// ─── Input readers ─────────────────────────────────────────────────────────────

/**
 * Parse a chapter JSON response (from /api/story/start or /api/story/continue).
 * Extracts prose and choices for review.
 */
function parseChapterJson(jsonContent) {
    const data = JSON.parse(jsonContent);

    // Handle StartResponse or ContinueResponse wrapping
    const chapter = data.chapter || data;
    const prose = chapter.prose || data.prose || '';
    const choices = chapter.choices || data.choices || data.final_choices || [];
    const title = chapter.title || data.title || data.chapter_title || '';
    const criticScore = chapter.critic_score ?? data.critic_score ?? null;
    const chapterNumber = chapter.number ?? chapter.chapter_number ?? data.chapter_number ?? null;

    if (!prose) {
        throw new Error('No prose found in JSON. Expected chapter.prose or prose field.');
    }

    return { prose, choices, title, criticScore, chapterNumber };
}

/**
 * Fetch chapter from live Amoisekai API.
 */
async function fetchFromAPI(apiUrl, storyId, chapterNum) {
    const url = `${apiUrl}/api/story/${storyId}/state`;
    console.log(`  Fetching from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const chapters = data.chapters || [];

    if (chapters.length === 0) {
        throw new Error('No chapters found for this story.');
    }

    const chapter = chapterNum != null
        ? chapters.find(c => c.number === chapterNum || c.chapter_number === chapterNum)
        : chapters[chapters.length - 1]; // Last chapter

    if (!chapter) {
        throw new Error(`Chapter ${chapterNum} not found. Available: ${chapters.map(c => c.number).join(', ')}`);
    }

    return {
        prose: chapter.prose || '',
        choices: chapter.choices || [],
        title: chapter.title || '',
        criticScore: chapter.critic_score ?? null,
        chapterNumber: chapter.number ?? chapter.chapter_number ?? null,
    };
}

// ─── User prompt builder ───────────────────────────────────────────────────────

function buildUXPrompt({ prose, choices, title, criticScore, chapterNumber, context }) {
    const chapterInfo = chapterNumber != null ? `Chapter: ${chapterNumber}` : '';
    const titleInfo = title ? `Title: "${title}"` : '';
    const criticInfo = criticScore != null ? `Critic agent score: ${criticScore}/10` : '';
    const contextInfo = context ? `\nPrevious context: ${context.slice(0, 500)}` : '';

    const choicesBlock = choices.length > 0
        ? `\nChoices presented to player:\n${choices.map((c, i) =>
            `  [${i + 1}] "${c.text || c}"${c.risk_level ? ` (risk: ${c.risk_level}/5)` : ''}${c.consequence_hint ? ` — ${c.consequence_hint}` : ''}`
          ).join('\n')}`
        : '\nNo choices (end of arc or chapter).';

    return `${chapterInfo}${titleInfo ? '\n' + titleInfo : ''}${criticInfo ? '\n' + criticInfo : ''}${contextInfo}

--- PROSE TO REVIEW ---
${prose}
--- END PROSE ---
${choicesBlock}

Evaluate the narrative quality comprehensively. Return structured JSON report.`;
}

// ─── Output path ───────────────────────────────────────────────────────────────

function getReportOutputPath(label, overwrite) {
    const reportsDir = resolve(CONFIG.OUTPUT_DIR, 'reports');
    mkdirSync(reportsDir, { recursive: true });

    const slug = label.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    if (overwrite) {
        return resolve(reportsDir, `ux_review_${slug}.json`);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return resolve(reportsDir, `ux_review_${slug}_${ts}.json`);
}

// ─── Report formatter ──────────────────────────────────────────────────────────

function formatReportForConsole(report) {
    const lines = [];
    const r = typeof report === 'string' ? JSON.parse(report) : report;

    lines.push('\n┌─────────────────────────────────────────────────────┐');
    lines.push('│           NARRATIVE QUALITY REVIEW REPORT           │');
    lines.push('└─────────────────────────────────────────────────────┘');

    // Overall score
    const overall = r.overall_score ?? '?';
    const grade = overall >= 8 ? '🟢 Excellent' : overall >= 6 ? '🟡 Good' : overall >= 4 ? '🟠 Needs Work' : '🔴 Poor';
    lines.push(`\nOverall Score: ${overall}/10 — ${grade}\n`);

    // Dimension scores
    if (r.dimensions) {
        lines.push('Dimension Scores:');
        for (const [key, val] of Object.entries(r.dimensions)) {
            const bar = '█'.repeat(Math.round(val)) + '░'.repeat(10 - Math.round(val));
            lines.push(`  ${key.padEnd(20)} ${bar} ${val}/10`);
        }
    }

    // Strengths
    if (r.strengths?.length > 0) {
        lines.push('\n✅ Strengths:');
        r.strengths.forEach(s => lines.push(`  • ${s}`));
    }

    // Issues
    if (r.issues?.length > 0) {
        lines.push('\n⚠️  Issues:');
        r.issues.forEach(i => lines.push(`  • ${i}`));
    }

    // Choice quality
    if (r.choice_analysis) {
        lines.push('\n🎯 Choice Analysis:');
        const ca = r.choice_analysis;
        if (ca.distinct) lines.push(`  • Distinctiveness: ${ca.distinct}`);
        if (ca.consequence_clarity) lines.push(`  • Consequence clarity: ${ca.consequence_clarity}`);
        if (ca.suggestions?.length > 0) {
            lines.push('  • Suggestions:');
            ca.suggestions.forEach(s => lines.push(`    - ${s}`));
        }
    }

    // Vietnamese quality (if applicable)
    if (r.language_quality) {
        lines.push(`\n🇻🇳 Vietnamese Quality: ${r.language_quality.score ?? '?'}/10`);
        if (r.language_quality.note) lines.push(`  ${r.language_quality.note}`);
    }

    // Top recommendation
    if (r.top_recommendation) {
        lines.push(`\n💡 Top Recommendation:\n  ${r.top_recommendation}`);
    }

    lines.push('\n' + '─'.repeat(55));
    return lines.join('\n');
}

// ─── Main entry ────────────────────────────────────────────────────────────────

/**
 * Review narrative quality of a chapter.
 *
 * @param {Object} input - One of:
 *   { type: 'prose', prose: string }
 *   { type: 'file', filePath: string }
 *   { type: 'api', apiUrl: string, storyId: string, chapterNum?: number }
 *
 * @param {{ model?: string, overwrite?: boolean, context?: string, verbose?: boolean }} options
 */
export async function reviewNarrativeQuality(input, options = {}) {
    requireApiKey();

    let reviewInput;
    let inputLabel;

    if (input.type === 'prose') {
        reviewInput = {
            prose: input.prose,
            choices: input.choices || [],
            title: input.title || '',
            criticScore: null,
            chapterNumber: null,
        };
        inputLabel = 'prose_inline';

    } else if (input.type === 'file') {
        const filePath = resolve(input.filePath);
        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const rawContent = readFileSync(filePath, 'utf-8');

        // Try JSON parse first, then treat as raw prose
        try {
            reviewInput = parseChapterJson(rawContent);
        } catch {
            reviewInput = {
                prose: rawContent,
                choices: [],
                title: '',
                criticScore: null,
                chapterNumber: null,
            };
        }
        inputLabel = input.filePath.replace(/[^a-zA-Z0-9]/g, '_').slice(-20);

    } else if (input.type === 'api') {
        reviewInput = await fetchFromAPI(input.apiUrl, input.storyId, input.chapterNum);
        inputLabel = `api_${input.storyId}_ch${input.chapterNum ?? 'latest'}`;

    } else {
        throw new Error(`Unknown input type: ${input.type}. Use 'prose', 'file', or 'api'.`);
    }

    if (!reviewInput.prose || reviewInput.prose.trim().length < 50) {
        throw new Error('Prose is too short or empty for quality review (min 50 chars).');
    }

    console.log(`  Prose length: ${reviewInput.prose.length} chars`);
    console.log(`  Choices: ${reviewInput.choices.length}`);
    if (reviewInput.chapterNumber) console.log(`  Chapter: ${reviewInput.chapterNumber}`);

    const SYSTEM_PROMPT = loadUXPrompt();
    const aiClient = new AIClient(CONFIG.OPENROUTER_API_KEY, {
        model: options.model || CONFIG.UX_REVIEW_MODEL,
    });

    const userPrompt = buildUXPrompt({
        ...reviewInput,
        context: options.context || '',
    });

    const rawResponse = await aiClient.call({
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 4096,
    });

    // Parse and save report
    let report;
    try {
        const jsonStr = rawResponse.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
        report = JSON.parse(jsonStr);
    } catch {
        // AI returned non-JSON — wrap it
        report = { raw_feedback: rawResponse, overall_score: null };
    }

    // Add metadata
    report._meta = {
        input_type: input.type,
        prose_length: reviewInput.prose.length,
        choices_count: reviewInput.choices.length,
        chapter_number: reviewInput.chapterNumber,
        reviewed_at: new Date().toISOString(),
        model: options.model || CONFIG.UX_REVIEW_MODEL,
    };

    const outputPath = getReportOutputPath(inputLabel, options.overwrite);
    writeFileSync(outputPath, JSON.stringify(report, null, 2));

    return { outputPath, report };
}
