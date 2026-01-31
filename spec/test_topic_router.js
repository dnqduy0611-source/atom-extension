/**
 * Test script for Topic Router modules
 * Run with: node spec/test_topic_router.js
 */

// Mock chrome.storage.local
global.chrome = {
    storage: {
        local: {
            _data: {},
            async get(keys) {
                const result = {};
                for (const key of keys) {
                    if (this._data[key] !== undefined) {
                        result[key] = this._data[key];
                    }
                }
                return result;
            },
            async set(obj) {
                Object.assign(this._data, obj);
            },
            async remove(keys) {
                for (const key of keys) {
                    delete this._data[key];
                }
            }
        }
    },
    runtime: {
        sendMessage: async () => ({ ok: true }),
        lastError: null
    },
    tabs: {
        create: async () => ({})
    }
};

// Test helpers
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        testsPassed++;
    } else {
        console.log(`  ✗ ${message}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log("\n========================================");
    console.log("Topic Router Module Tests");
    console.log("========================================\n");

    // Test 1: topic_extractor.js
    console.log("1. Testing topic_extractor.js");
    try {
        const { extractTopic, extractKeywordsFromText, simplifyDomain } = await import("../bridge/topic_extractor.js");

        // Test extractKeywordsFromText
        const keywords = extractKeywordsFromText("JavaScript programming tutorial for beginners", 3);
        assert(keywords.length > 0, "extractKeywordsFromText returns keywords");
        assert(keywords.includes("javascript") || keywords.includes("programming"), "Keywords include relevant terms");

        // Test simplifyDomain
        assert(simplifyDomain("www.github.com") === "github", "simplifyDomain removes www and TLD");
        assert(simplifyDomain("docs.google.com") === "google", "simplifyDomain handles subdomains");

        // Test extractTopic
        const topic = extractTopic({
            title: "Learn React Hooks",
            selection: "useState and useEffect are the most common hooks",
            tags: ["react", "frontend"],
            domain: "reactjs.org"
        });
        assert(topic.topicKey, "extractTopic returns topicKey");
        assert(topic.displayTitle, "extractTopic returns displayTitle");
        assert(Array.isArray(topic.keywords), "extractTopic returns keywords array");
        assert(topic.source === "tags", "extractTopic prioritizes tags");
        assert(topic.confidence >= 0.8, "Tags give high confidence");

        console.log("   topic_extractor.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Test 2: topic_scoring.js
    console.log("2. Testing topic_scoring.js");
    try {
        const { scoreTopicMatch, findBestMatches, getDecision, SCORE_THRESHOLD_AUTO_SUGGEST, SCORE_THRESHOLD_ASK } = await import("../bridge/topic_scoring.js");

        // Test thresholds
        assert(SCORE_THRESHOLD_AUTO_SUGGEST === 0.70, "Auto-suggest threshold is 0.70");
        assert(SCORE_THRESHOLD_ASK === 0.45, "Ask threshold is 0.45");

        // Test getDecision
        assert(getDecision(0.8) === "use_existing", "Score 0.8 → use_existing");
        assert(getDecision(0.5) === "ask", "Score 0.5 → ask");
        assert(getDecision(0.3) === "create", "Score 0.3 → create");

        // Test scoreTopicMatch
        const extracted = { topicKey: "react", keywords: ["react", "hooks"], displayTitle: "React" };
        const registryItem = { topicKey: "react", keywords: ["react", "frontend"], displayTitle: "React", usageCount: 5 };
        const result = scoreTopicMatch(extracted, registryItem);

        assert(result.score > 0, "scoreTopicMatch returns positive score");
        assert(Array.isArray(result.reasons), "scoreTopicMatch returns reasons array");
        assert(result.score >= SCORE_THRESHOLD_AUTO_SUGGEST, "Exact topicKey match gives high score");

        // Test findBestMatches
        const registry = [
            { topicKey: "react", keywords: ["react"], displayTitle: "React", usageCount: 10 },
            { topicKey: "vue", keywords: ["vue"], displayTitle: "Vue", usageCount: 5 }
        ];
        const matches = findBestMatches(extracted, registry, 2);
        assert(matches.length > 0, "findBestMatches returns matches");
        assert(matches[0].entry.topicKey === "react", "Best match is correct");

        console.log("   topic_scoring.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Test 3: topic_registry.js
    console.log("3. Testing topic_registry.js");
    try {
        const { loadRegistry, saveRegistry, upsertTopic, recordUsage, generateTopicKey, getPendingTopic, setPendingTopic, clearPendingTopic } = await import("../bridge/topic_registry.js");

        // Clear storage
        chrome.storage.local._data = {};

        // Test empty registry
        let registry = await loadRegistry();
        assert(Array.isArray(registry) && registry.length === 0, "Empty registry returns empty array");

        // Test generateTopicKey
        assert(generateTopicKey("Hello World!") === "hello_world", "generateTopicKey normalizes text");

        // Test upsertTopic
        const entry = await upsertTopic({
            displayTitle: "Test Topic",
            keywords: ["test", "demo"],
            notebookRef: "notebook123",
            notebookUrl: "https://notebooklm.google.com/notebook/123"
        });
        assert(entry.topicKey === "test_topic", "upsertTopic generates topicKey");
        assert(entry.usageCount === 0, "New entry has usageCount 0");

        // Test loadRegistry after insert
        registry = await loadRegistry();
        assert(registry.length === 1, "Registry has 1 entry after insert");

        // Test recordUsage
        const updated = await recordUsage("test_topic");
        assert(updated.usageCount === 1, "recordUsage increments count");

        // Test pending topic
        await setPendingTopic({
            topicKey: "pending_test",
            displayTitle: "Pending Test",
            keywords: ["pending"],
            context: { url: "https://example.com" }
        });
        let pending = await getPendingTopic();
        assert(pending && pending.topicKey === "pending_test", "setPendingTopic works");

        await clearPendingTopic();
        pending = await getPendingTopic();
        assert(pending === null, "clearPendingTopic works");

        console.log("   topic_registry.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Test 4: topic_router.js
    console.log("4. Testing topic_router.js");
    try {
        const { routeTopic, quickMatchCheck } = await import("../bridge/topic_router.js");
        const { saveRegistry } = await import("../bridge/topic_registry.js");

        // Setup test registry
        await saveRegistry([
            { topicKey: "javascript", keywords: ["js", "javascript", "programming"], displayTitle: "JavaScript", notebookRef: "js-notebook", notebookUrl: "https://nlm/js", usageCount: 10, lastUsedAt: Date.now() }
        ]);

        // Test routeTopic with match
        const result = await routeTopic({
            title: "Advanced JavaScript Tutorial",
            tags: ["javascript"],
            domain: "example.com"
        }, { savePending: false });

        assert(result.decision, "routeTopic returns decision");
        assert(["use_existing", "ask", "create"].includes(result.decision), "Decision is valid");
        assert(result.topicKey, "routeTopic returns topicKey");

        // Test quickMatchCheck
        const quick = await quickMatchCheck({ tags: ["javascript"] });
        assert(typeof quick.hasMatch === "boolean", "quickMatchCheck returns hasMatch");

        console.log("   topic_router.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Test 5: ui_prompt.js
    console.log("5. Testing ui_prompt.js");
    try {
        const { buildPromptPayload, buildConfirmMappingPrompt, PROMPT_TYPE, ACTION } = await import("../bridge/ui_prompt.js");

        // Test buildPromptPayload with use_existing
        const routerResult = {
            decision: "use_existing",
            bestMatch: { notebookRef: "test-nb", notebookUrl: "https://nlm/test", displayTitle: "Test", score: 0.85 },
            topicKey: "test",
            displayTitle: "Test",
            keywords: ["test"]
        };
        const prompt = buildPromptPayload(routerResult, { locale: "en" });

        assert(prompt.type === PROMPT_TYPE.AUTO_SUGGEST, "Auto-suggest prompt type correct");
        assert(Array.isArray(prompt.actions), "Prompt has actions");
        assert(prompt.actions.some(a => a.id === ACTION.USE), "Prompt has USE action");
        assert(prompt.actions.some(a => a.id === ACTION.SKIP), "Prompt has SKIP action");

        // Test buildConfirmMappingPrompt
        const confirmPrompt = buildConfirmMappingPrompt(
            { topicKey: "test", displayTitle: "Test" },
            { ref: "notebook", url: "https://nlm/nb", title: "Notebook" },
            { locale: "vi" }
        );
        assert(confirmPrompt.type === PROMPT_TYPE.CONFIRM_MAPPING, "Confirm mapping prompt type correct");
        assert(confirmPrompt.actions.some(a => a.id === ACTION.SAVE), "Confirm prompt has SAVE action");

        console.log("   ui_prompt.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Test 6: topic_router_logging.js
    console.log("6. Testing topic_router_logging.js");
    try {
        const { logRouterEvent, getRouterLogs, clearRouterLogs, NLM_ROUTER_EVENTS } = await import("../bridge/topic_router_logging.js");

        // Clear logs
        await clearRouterLogs();

        // Test log event
        await logRouterEvent(NLM_ROUTER_EVENTS.ROUTE_START, { domain: "test.com" });
        await logRouterEvent(NLM_ROUTER_EVENTS.SUGGESTED, { topicKey: "test" });

        // Get logs
        const logs = await getRouterLogs(10);
        assert(logs.length >= 2, "Logs are saved");
        assert(logs[0].event === NLM_ROUTER_EVENTS.SUGGESTED, "Most recent log first");

        console.log("   topic_router_logging.js: PASSED\n");
    } catch (e) {
        console.log(`   ERROR: ${e.message}\n`);
        testsFailed++;
    }

    // Summary
    console.log("========================================");
    console.log(`Results: ${testsPassed} passed, ${testsFailed} failed`);
    console.log("========================================\n");

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(e => {
    console.error("Test runner error:", e);
    process.exit(1);
});
