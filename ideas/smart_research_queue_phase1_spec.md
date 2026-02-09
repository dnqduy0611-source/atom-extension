# Smart Research Queue (SRQ) - Phase 1 Specification

> **Status:** Draft v1.0
> **Target:** ATOM Extension v2.9
> **Replaces:** OpenClaw CDP Automation (Section 2.1 of openclaw_integration_spec.md)
> **Principle:** Zero new dependencies. User-in-the-loop. Build on existing modules.

---

## 1. Overview

Smart Research Queue (SRQ) enriches every captured clip with topic context, groups
clips into batches by topic, and presents a unified review-then-export flow. It
replaces the proposed CDP automation with a safe, extension-native pipeline that
keeps the user in control.

### 1.1 Goals

| # | Goal | Metric |
|:--|:-----|:-------|
| G1 | Every clip carries topicKey + readingMode before reaching queue | 100% enrichment rate |
| G2 | Clips with the same topicKey auto-group into batches | Grouping accuracy > 90% |
| G3 | User reviews batches in sidepanel OR on NotebookLM page | < 2 clicks to batch-export |
| G4 | No CDP, no external server, no new permissions | 0 new `manifest.json` permissions |
| G5 | Reinforce memory through review moment | Review = 1 retrieval practice event |

### 1.2 Non-Goals (Phase 1)

- OpenClaw / MCP integration (Phase 2)
- Heartbeat autonomous research (Phase 2)
- Visual Anchor / screenshot capture (Phase 2)
- Comprehension Gate auto-pause (Phase 2)

---

## 2. Architecture

### 2.1 Data Flow

```
User highlights text on any page
       |
       v
[nlm_floating_button.js]          ← EXISTING - captures selection
       |
       v
[① SRQ Enricher]                  ← NEW module: services/srq_enricher.js
  • topic_extractor.extractTopic() → topicKey, topicLabel, confidence
  • bridge_service.deriveReadingMode() → skim|deep|reference|reread
  • related_memory scan (async, non-blocking) → relatedSessions[]
  • connection_detector.CONNECTION_TYPES → connectionHint (optional)
       |
       v
[② Research Card]                  ← NEW data structure in storage
  • Stored in chrome.storage.local under SRQ_CARDS_KEY
  • Immutable once created (append-only)
       |
       v
[③ SRQ Grouper]                   ← NEW module: services/srq_grouper.js
  • Groups cards by topicKey
  • Computes batch priority from readingMode weights
  • Maps batch → suggestedNotebook via topic_router
       |
       v
[④ SRQ UI]                        ← NEW UI components
  A) Sidepanel widget (always visible when sidepanel open)
  B) NLM page banner (via nlm_passive_learning.js)
       |
       v
[⑤ Batch Export]                   ← EXISTING pipeline enhanced
  • clip_format.formatAtomClip() per card
  • export_queue.enqueueExportJob() per batch
  • queue_processor handles retry/badge
```

### 2.2 Module Dependency Map

```
NEW modules (to create):
  services/srq_enricher.js      → imports: topic_extractor, bridge_service, related_memory
  services/srq_grouper.js       → imports: srq_enricher, topic_router, mapping_rules
  storage/srq_store.js          → imports: types.js (storage keys)
  ui/components/srq_widget.js   → imports: srq_store, srq_grouper (for sidepanel)

EXISTING modules (to modify):
  bridge/nlm_floating_button.js → add SRQ card creation path
  bridge/nlm_passive_learning.js→ add pending-batch banner
  sidepanel.js                  → mount SRQ widget
  background.js                 → register SRQ alarm for stale-card cleanup
  manifest.json                 → add new JS files to content_scripts / web_accessible_resources
```

---

## 3. Data Structures

### 3.1 Research Card

```javascript
/**
 * @typedef {Object} ResearchCard
 * @property {string}   cardId          - Unique ID: `src_{timestamp}_{random8hex}`
 * @property {number}   createdAt       - Date.now() at capture time
 * @property {string}   status          - "pending_review" | "approved" | "exported" | "dismissed"
 *
 * --- Source Context ---
 * @property {string}   url             - Full page URL
 * @property {string}   domain          - Registrable domain (from topic_extractor.registrableDomain)
 * @property {string}   title           - Page title
 * @property {string}   selectedText    - User-highlighted text
 * @property {string}   viewportExcerpt - Fallback if no selection (existing field in clip_format)
 *
 * --- Topic (from topic_extractor.extractTopic) ---
 * @property {string}   topicKey        - "tag:xxx" | "dom:xxx" | "kw:xxx"
 * @property {string}   topicSource     - "tag" | "domain" | "keyword"
 * @property {string}   topicLabel      - Human-readable topic name
 * @property {number}   topicConfidence - 0.0-1.0
 * @property {string[]} keywords        - Extracted keywords
 *
 * --- Reading Signal (from bridge_service.deriveReadingMode) ---
 * @property {string}   readingMode     - "skim" | "deep" | "reference" | "reread"
 * @property {string}   command         - Original command if any (e.g. "critique", "quiz")
 *
 * --- Enrichment (async, may arrive after creation) ---
 * @property {string}   atomicThought   - AI-generated atomic thought (if available)
 * @property {string}   refinedInsight  - AI-generated insight (if available)
 * @property {Array}    relatedSessions - [{sessionId, title, similarity}] from related_memory
 * @property {string|null} connectionHint - "supports"|"contradicts"|"extends"|"similar"|"applies"
 *
 * --- Export Tracking ---
 * @property {string|null} suggestedNotebook - Auto-mapped notebook ref from topic_router
 * @property {string|null} exportedJobId     - Links to export_queue job after export
 * @property {number|null} exportedAt        - Timestamp of export
 *
 * --- User Tags (optional, user can add during review) ---
 * @property {string[]} userTags        - Manually added tags during review
 * @property {string}   userNote        - Free-text annotation
 */
```

**Storage key:** `atom_srq_cards_v1`
**Max cards:** 200 (FIFO eviction of `exported` and `dismissed` cards)

### 3.2 Research Batch

Batches are **computed on-the-fly** (not stored separately). The grouper creates
them from cards with matching `topicKey`:

```javascript
/**
 * @typedef {Object} ResearchBatch
 * @property {string}   topicKey          - Shared topicKey of all cards in batch
 * @property {string}   topicLabel        - Human-readable topic name
 * @property {string}   suggestedNotebook - Best notebook match from topic_router
 * @property {number}   priority          - Computed priority score (0-100)
 * @property {ResearchCard[]} cards       - Cards in this batch, sorted by createdAt desc
 * @property {Object}   stats             - { total, deep, skim, reference, reread }
 * @property {number}   oldestCardAge     - ms since oldest card.createdAt
 */
```

### 3.3 SRQ Settings

Stored under existing `atom_nlm_settings_v1` (extend DEFAULT_NLM_SETTINGS):

```javascript
// Additions to DEFAULT_NLM_SETTINGS in types.js
{
    // ... existing fields ...
    srqEnabled: true,                    // Master toggle
    srqAutoEnrich: true,                 // Auto-run enrichment on capture
    srqShowSidepanelWidget: true,        // Show widget in sidepanel
    srqShowNlmBanner: true,              // Show banner on NotebookLM page
    srqMaxCardsPerBatch: 20,             // Max cards in one batch export
    srqStaleCardDays: 14,               // Auto-dismiss cards older than N days
    srqNotifyThreshold: 3               // Show notification when N+ cards pending
}
```

---

## 4. Module Specifications

### 4.1 `storage/srq_store.js` - Card CRUD

```
Storage key: SRQ_CARDS_KEY = "atom_srq_cards_v1"
Max size: SRQ_MAX_CARDS = 200

Exports:
  loadCards()                    → Promise<ResearchCard[]>
  saveCards(cards)               → Promise<void>
  addCard(card)                  → Promise<ResearchCard>    // append + FIFO evict
  updateCard(cardId, patch)      → Promise<ResearchCard>    // partial update
  updateCardStatus(cardId, status) → Promise<ResearchCard>
  getCardsByStatus(status)       → Promise<ResearchCard[]>
  getCardsByTopicKey(topicKey)   → Promise<ResearchCard[]>
  getPendingCards()              → Promise<ResearchCard[]>  // status=pending_review
  dismissCard(cardId)            → Promise<void>            // status→dismissed
  cleanupStaleCards(maxAgeDays)  → Promise<number>          // returns count removed
  getCardStats()                 → Promise<{pending,approved,exported,dismissed,total}>
```

**FIFO Eviction Logic:**
When `cards.length >= SRQ_MAX_CARDS`, remove oldest cards with status
`exported` or `dismissed` first. Never auto-evict `pending_review` or
`approved` cards.

### 4.2 `services/srq_enricher.js` - Card Creation & Enrichment

```
Exports:
  createResearchCard(captureData) → Promise<ResearchCard>
  enrichCardAsync(cardId)         → Promise<ResearchCard>   // non-blocking enrichment

Dependencies:
  - topic_extractor.extractTopic()
  - bridge_service.deriveReadingMode() (NOTE: currently unexported IIFE,
    needs refactor to export or replicate logic)
  - related_memory (via chrome.runtime.sendMessage to background)
```

#### 4.2.1 `createResearchCard(captureData)` Flow

```
Input captureData: {
  url, title, domain, selectedText, viewportExcerpt,
  tags, tagsSource, command, atomicThought, refinedInsight
}

Step 1: Extract topic
  const topic = extractTopic({
    title: captureData.title,
    selection: captureData.selectedText,
    tags: captureData.tags,
    domain: captureData.domain,
    tagsSource: captureData.tagsSource
  });

Step 2: Derive reading mode
  Apply same logic as bridge_service.deriveReadingMode():
    - command includes "critique"/"quiz"/"analyze" → "deep"
    - command includes "reference"/"cite" → "reference"
    - selectedText.length > 500 → "deep"
    - else → "skim"

Step 3: Build card
  const card = {
    cardId: `src_${Date.now()}_${crypto.randomUUID().slice(0,8)}`,
    createdAt: Date.now(),
    status: "pending_review",
    // source context
    url, domain, title, selectedText, viewportExcerpt,
    // topic
    topicKey: topic.topicKey,
    topicSource: topic.topicSource,
    topicLabel: topic.topicLabel,
    topicConfidence: topic.confidence,
    keywords: topic.keywords,
    // reading signal
    readingMode,
    command: captureData.command || null,
    // enrichment (sync available)
    atomicThought: captureData.atomicThought || null,
    refinedInsight: captureData.refinedInsight || null,
    relatedSessions: [],
    connectionHint: null,
    // export tracking
    suggestedNotebook: null,
    exportedJobId: null,
    exportedAt: null,
    // user annotations
    userTags: [],
    userNote: ""
  };

Step 4: Save card
  await srq_store.addCard(card);

Step 5: Trigger async enrichment (non-blocking)
  enrichCardAsync(card.cardId).catch(console.warn);

Step 6: Return card
```

#### 4.2.2 `enrichCardAsync(cardId)` Flow

```
Step 1: Load card from store

Step 2: Run topic_router.routeTopic() for suggestedNotebook
  const routeResult = await routeTopic({
    title: card.title,
    selection: card.selectedText,
    tags: card.keywords,
    domain: card.domain,
    url: card.url
  }, { savePending: false });

  if (routeResult.decision === "use_existing") {
    card.suggestedNotebook = routeResult.bestMatch.notebookRef;
  }

Step 3: Find related sessions (via message to background)
  Send: { action: "srq_find_related", url: card.url, title: card.title }
  Receive: relatedSessions[] with {sessionId, title, similarity}
  Only keep similarity >= 0.7, max 3 results

Step 4: Update card in store
  await srq_store.updateCard(cardId, {
    suggestedNotebook,
    relatedSessions,
    connectionHint (if relatedSessions exist, use first match type)
  });
```

### 4.3 `services/srq_grouper.js` - Batch Computation

```
Exports:
  computeBatches(cards)           → ResearchBatch[]
  computeBatchPriority(batch)     → number (0-100)
  getBatchesForExport()           → Promise<ResearchBatch[]>  // only pending_review + approved

Dependencies:
  - srq_store (for loading cards)
  - topic_router (for notebook suggestion fallback)
```

#### 4.3.1 `computeBatches(cards)` Algorithm

```
Step 1: Filter cards to status "pending_review" or "approved"

Step 2: Group by topicKey
  const groups = new Map();  // topicKey → ResearchCard[]
  for (const card of filteredCards) {
    const key = card.topicKey || "uncategorized";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }

Step 3: Build batch objects
  for each [topicKey, cards] in groups:
    batch = {
      topicKey,
      topicLabel: cards[0].topicLabel,
      suggestedNotebook: resolveBatchNotebook(cards),
      priority: computeBatchPriority({ cards }),
      cards: cards.sort((a,b) => b.createdAt - a.createdAt),
      stats: {
        total: cards.length,
        deep: cards.filter(c => c.readingMode === "deep").length,
        skim: cards.filter(c => c.readingMode === "skim").length,
        reference: cards.filter(c => c.readingMode === "reference").length,
        reread: cards.filter(c => c.readingMode === "reread").length
      },
      oldestCardAge: Date.now() - Math.min(...cards.map(c => c.createdAt))
    };

Step 4: Sort batches by priority desc

Step 5: Return batches[]
```

#### 4.3.2 `computeBatchPriority(batch)` Formula

```
Priority = (modeWeight * 40) + (sizeWeight * 30) + (ageWeight * 30)

modeWeight (0-1):
  deepRatio   = batch.stats.deep / batch.stats.total
  rereadRatio = batch.stats.reread / batch.stats.total
  modeWeight  = deepRatio * 1.0 + rereadRatio * 0.8 + referenceRatio * 0.5 + skimRatio * 0.2

sizeWeight (0-1):
  Capped log scale: min(1, log2(batch.stats.total + 1) / log2(11))
  → 1 card = 0.30, 3 cards = 0.58, 5 cards = 0.72, 10 cards = 1.0

ageWeight (0-1):
  Hours since oldest card: age = batch.oldestCardAge / (1000*60*60)
  ageWeight = min(1, age / 168)  // 168h = 7 days → max urgency
```

**Result:** Score 0-100. Batches with mostly deep-reading cards, more clips,
and older cards bubble to the top.

#### 4.3.3 `resolveBatchNotebook(cards)` Logic

```
Step 1: Count suggestedNotebook frequency across cards
  const counts = {};
  for (const card of cards) {
    if (card.suggestedNotebook) {
      counts[card.suggestedNotebook] = (counts[card.suggestedNotebook] || 0) + 1;
    }
  }

Step 2: Return most frequent, or "Inbox" if no suggestions
  return Object.entries(counts)
    .sort((a,b) => b[1] - a[1])[0]?.[0] || "Inbox";
```

### 4.4 `ui/components/srq_widget.js` - Sidepanel Widget

Mounted inside sidepanel.js. Renders a compact summary of pending batches.

#### 4.4.1 States

**Empty state (0 pending cards):**
```
(no widget shown - do not pollute UI when nothing to show)
```

**Compact state (1+ pending cards):**
```html
<div class="srq-widget">
  <div class="srq-header">
    <span class="srq-icon">📋</span>
    <span class="srq-title">Research Queue</span>
    <span class="srq-badge">4</span>
    <button class="srq-toggle">▼</button>
  </div>
</div>
```

**Expanded state (user clicks toggle):**
```html
<div class="srq-widget expanded">
  <div class="srq-header">...</div>
  <div class="srq-batches">

    <div class="srq-batch" data-topic="kw:sparse-attention">
      <div class="srq-batch-header">
        <span class="srq-batch-label">Sparse Attention</span>
        <span class="srq-batch-count">3 clips</span>
        <span class="srq-batch-modes">
          <span class="mode-deep">2 deep</span>
          <span class="mode-ref">1 ref</span>
        </span>
      </div>
      <div class="srq-batch-meta">
        → AI Research <span class="srq-confidence">85%</span>
      </div>
      <div class="srq-batch-actions">
        <button class="srq-btn-export">Export All</button>
        <button class="srq-btn-review">Review</button>
        <button class="srq-btn-dismiss">✕</button>
      </div>
    </div>

    <div class="srq-batch" data-topic="dom:seriouseats.com">
      <div class="srq-batch-header">
        <span class="srq-batch-label">Cooking</span>
        <span class="srq-batch-count">1 clip</span>
        <span class="srq-batch-modes">
          <span class="mode-skim">1 skim</span>
        </span>
      </div>
      <div class="srq-batch-meta">
        → Inbox
      </div>
      <div class="srq-batch-actions">
        <button class="srq-btn-export">Export</button>
        <button class="srq-btn-review">Review</button>
        <button class="srq-btn-dismiss">✕</button>
      </div>
    </div>

  </div>
</div>
```

#### 4.4.2 Review Modal

When user clicks "Review" on a batch, a modal overlays the sidepanel:

```
┌────────────────────────────────────┐
│ Review: Sparse Attention (3 clips) │
│ Suggested: AI Research notebook    │
├────────────────────────────────────┤
│                                    │
│ ┌── Card 1 (deep) ──────────────┐ │
│ │ "Sparse attention reduces..."  │ │
│ │ arxiv.org · 2h ago             │ │
│ │ 💡 "Reduces O(n²) to O(n√n)" │ │
│ │ 🔗 Related: FlashAttention    │ │
│ │ [✓ Export] [✕ Skip] [✏ Edit] │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌── Card 2 (deep) ──────────────┐ │
│ │ "FlashAttention v2 achieves.." │ │
│ │ arxiv.org · 1d ago             │ │
│ │ 💡 "IO-aware, tiling-based"   │ │
│ │ [✓ Export] [✕ Skip] [✏ Edit] │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌── Card 3 (reference) ─────────┐ │
│ │ "Benchmark results table..."   │ │
│ │ github.com · 3d ago            │ │
│ │ [✓ Export] [✕ Skip] [✏ Edit] │ │
│ └────────────────────────────────┘ │
│                                    │
│  Target: [AI Research ▼]          │
│                                    │
│  [Export Selected (3)]  [Cancel]   │
└────────────────────────────────────┘
```

**Edit mode** (click ✏): Inline edit of `userNote` and `userTags[]` on card.

#### 4.4.3 Interactions

| Action | Effect |
|:-------|:-------|
| Click "Export All" on batch | Mark all cards → `approved`, trigger batch export |
| Click "Export" on single card | Mark card → `approved`, trigger single export |
| Click "Review" on batch | Open review modal |
| Click "✕" on batch | Mark all cards → `dismissed` |
| Click "✕ Skip" on card in review | Mark single card → `dismissed` |
| Click "✏ Edit" on card | Show inline userNote/userTags editor |
| Change target notebook dropdown | Override `suggestedNotebook` for batch |
| Toggle ▼/▲ | Expand/collapse widget |

### 4.5 NLM Page Banner (extension of `nlm_passive_learning.js`)

When user opens NotebookLM and there are pending SRQ cards:

```
┌─────────────────────────────────────────────────────────┐
│ 📋 ATOM: 4 research clips ready to export               │
│                                                         │
│ Sparse Attention (3) · Cooking (1)                      │
│                                                         │
│ [Export All to Current Notebook] [Open in Sidepanel] [✕] │
└─────────────────────────────────────────────────────────┘
```

**Logic:**
1. `nlm_passive_learning.js` already detects notebook context
2. On page load, send message to background: `{ action: "srq_get_pending_count" }`
3. If count > 0, inject banner at top of page
4. "Export All to Current Notebook" → use detected `notebookRef` from URL
5. "Open in Sidepanel" → `chrome.runtime.sendMessage({ action: "open_sidepanel" })`
6. Banner auto-hides after export or dismiss
7. Respect `srqShowNlmBanner` setting
8. Cooldown: don't show banner again for 30 minutes after dismiss

---

## 5. Integration Points

### 5.1 `nlm_floating_button.js` Changes

Current flow when user clicks floating button:
```
selection → prompt modal → AI processes → export to NLM
```

New flow adds SRQ card creation as a parallel path:

```javascript
// In the existing export handler, after bundle is created:
// ADD: Create SRQ card if SRQ is enabled
if (settings.srqEnabled) {
    chrome.runtime.sendMessage({
        action: "srq_create_card",
        data: {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            selectedText: bundle.selectedText || bundle.selection,
            viewportExcerpt: bundle.viewportExcerpt || "",
            tags: bundle.tags || [],
            tagsSource: bundle.tagsSource || "ai",
            command: bundle.command || "",
            atomicThought: bundle.atomicThought || "",
            refinedInsight: bundle.refinedInsight || ""
        }
    });
    // NOTE: This is fire-and-forget. The existing export flow continues unchanged.
    // SRQ is an additional capture path, not a replacement.
}
```

### 5.2 `background.js` Message Handlers

Add these message handlers:

```javascript
// SRQ message handlers
case "srq_create_card":
    // Import srq_enricher, call createResearchCard
    return srqEnricher.createResearchCard(message.data);

case "srq_get_pending_count":
    // Import srq_store, call getCardStats
    const stats = await srqStore.getCardStats();
    return { pending: stats.pending, approved: stats.approved };

case "srq_get_batches":
    // Import srq_grouper, call getBatchesForExport
    return srqGrouper.getBatchesForExport();

case "srq_update_card":
    // Import srq_store, call updateCard
    return srqStore.updateCard(message.cardId, message.patch);

case "srq_dismiss_card":
    return srqStore.dismissCard(message.cardId);

case "srq_dismiss_batch":
    // Dismiss all cards with matching topicKey
    const cards = await srqStore.getCardsByTopicKey(message.topicKey);
    for (const card of cards) {
        await srqStore.updateCardStatus(card.cardId, "dismissed");
    }
    return { dismissed: cards.length };

case "srq_export_batch":
    // Trigger batch export flow (see Section 5.3)
    return handleBatchExport(message.topicKey, message.notebookRef);

case "srq_find_related":
    // Use existing related_memory logic
    // Return top 3 related sessions with similarity >= 0.7
    return findRelatedForSRQ(message.url, message.title);
```

### 5.3 Batch Export Flow

```
srq_export_batch message received
       |
       v
Step 1: Load all cards for topicKey with status "pending_review" or "approved"
Step 2: Mark all cards as status "approved"
Step 3: For each card:
  a) Format using clip_format.formatAtomClip({
       title: card.title,
       url: card.url,
       selectedText: card.selectedText,
       readingMode: card.readingMode,
       confidence: card.topicConfidence,
       tags: [...card.keywords, ...card.userTags],
       atomicThought: card.atomicThought,
       refinedInsight: card.refinedInsight,
       threadConnections: card.relatedSessions.map(r => ({
         type: card.connectionHint || "related",
         explanation: `Related to: ${r.title} (${Math.round(r.similarity*100)}%)`
       })),
       whySaved: card.userNote || null,
       capturedAt: card.createdAt
     })
  b) Build dedupe key using export_queue.buildDedupeKey()
  c) Check export_queue.isDedupeHit() - skip if duplicate
  d) Create job via export_queue.createExportJob({
       bundleId: card.cardId,
       notebookRef: notebookRef,
       dedupeKey
     })
  e) Enqueue via export_queue.enqueueExportJob(job)

Step 4: Update all cards:
  status → "exported"
  exportedJobId → job.jobId
  exportedAt → Date.now()

Step 5: Return { exported: count, skipped: dedupeHits }
```

### 5.4 `sidepanel.js` Integration

Mount SRQ widget after existing UI elements load:

```javascript
// In sidepanel.js initialization, after elements are populated:

async function mountSRQWidget() {
    // Only if enabled
    const settings = await loadNlmSettings();
    if (!settings.srqEnabled || !settings.srqShowSidepanelWidget) return;

    // Load batches
    const response = await chrome.runtime.sendMessage({ action: "srq_get_batches" });
    if (!response || response.length === 0) return;

    // Create and mount widget
    const widget = SRQWidget.create(response);
    const container = document.getElementById('srq-widget-container');
    // Container div should be added to sidepanel.html
    if (container) {
        container.appendChild(widget);
    }
}

// Refresh widget when tab changes or new card is created
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "srq_card_created" || msg.action === "srq_cards_updated") {
        mountSRQWidget();
    }
});
```

### 5.5 `background.js` Alarm for Stale Card Cleanup

```javascript
// Register alarm (alongside existing NLM_QUEUE_ALARM)
const SRQ_CLEANUP_ALARM = "atom_srq_cleanup";

chrome.alarms.create(SRQ_CLEANUP_ALARM, {
    periodInMinutes: 720  // Every 12 hours
});

// In alarm handler:
case SRQ_CLEANUP_ALARM:
    const removed = await srqStore.cleanupStaleCards(
        settings.srqStaleCardDays || 14
    );
    if (removed > 0) {
        console.log(`[ATOM SRQ] Cleaned ${removed} stale cards`);
    }
    break;
```

---

## 6. UI/UX Specifications

### 6.1 Design Tokens (reuse ATOM design system)

```css
/* SRQ uses existing ATOM CSS variables */
--atom-green-primary: #10B981;   /* Actions, badges */
--atom-green-dark: #059669;      /* Hover states */
--atom-bg-dark: #050505;         /* Background */
--atom-bg-surface: rgba(255, 255, 255, 0.05);  /* Card surfaces */
--atom-border: rgba(255, 255, 255, 0.1);        /* Borders */
--atom-text-main: #ffffff;       /* Primary text */
--atom-text-muted: #a3a3a3;      /* Secondary text */

/* Reading mode colors (new) */
--srq-mode-deep: #3B82F6;       /* Blue */
--srq-mode-skim: #9CA3AF;       /* Gray */
--srq-mode-reference: #F59E0B;  /* Amber */
--srq-mode-reread: #8B5CF6;     /* Purple */

/* Priority indicators */
--srq-priority-high: #EF4444;   /* Red - batches with priority > 70 */
--srq-priority-medium: #F59E0B; /* Amber - priority 40-70 */
--srq-priority-low: #6B7280;    /* Gray - priority < 40 */
```

### 6.2 Widget Sizing

- **Collapsed:** 40px height, full sidepanel width
- **Expanded:** max 300px height, scrollable if more batches
- **Review modal:** Full sidepanel overlay, scrollable card list
- **NLM banner:** 80px height, fixed at top of page, auto-dismiss

### 6.3 Animations

- Widget expand/collapse: 200ms ease-out
- Card appear: 150ms fade-in + translateY(8px)
- Badge count change: 100ms scale bounce
- Export success: Card slides right + fades out (300ms)
- Dismiss: Card fades out (200ms)

### 6.4 Responsive States

| Condition | Behavior |
|:----------|:---------|
| 0 pending cards | Widget hidden entirely |
| 1-3 cards | Widget collapsed, badge shows count |
| 4+ cards | Widget collapsed, badge shows count, pulse animation on first appearance |
| Export in progress | Show spinner on "Export" button, disable other actions |
| Export success | Flash green, remove exported cards from list |
| Export error | Show red badge on affected batch, tooltip with error |
| Offline | "Export" buttons disabled, tooltip: "Offline" |

---

## 7. Privacy & Security

### 7.1 PII Filtering

Before creating a Research Card, run existing PII check:

```javascript
import { containsPii, getPiiSummary } from "../bridge/privacy_guard.js";

// In srq_enricher.createResearchCard():
if (containsPii(captureData.selectedText)) {
    const summary = getPiiSummary(captureData.selectedText);
    console.warn("[SRQ] PII detected:", summary.types);
    // Still create card but flag it
    card.piiWarning = true;
    card.piiTypes = summary.types;
}
```

In Review UI, cards with `piiWarning === true` show:
```
⚠️ This clip may contain personal information (email, phone).
Review before exporting.
```

### 7.2 Sensitive Domain Exclusion

Reuse existing `privacy_guard.isSensitiveUrl()`:

```javascript
if (isSensitiveUrl(captureData.url, sensitiveDomains)) {
    // Do NOT create SRQ card for sensitive domains
    console.log("[SRQ] Skipping sensitive domain:", captureData.domain);
    return null;
}
```

### 7.3 Storage Limits

- Max 200 cards in storage (~200KB estimated at ~1KB/card)
- No selectedText stored for cards with piiWarning (store truncated preview only)
- Cards older than `srqStaleCardDays` auto-cleaned

---

## 8. Background.js Message Routing Summary

```javascript
// All SRQ-related messages and their handlers:

const SRQ_ACTIONS = {
    "srq_create_card":       // content → background → srq_enricher.createResearchCard
    "srq_get_pending_count": // sidepanel/NLM → background → srq_store.getCardStats
    "srq_get_batches":       // sidepanel → background → srq_grouper.getBatchesForExport
    "srq_get_cards":         // sidepanel → background → srq_store.getCardsByStatus
    "srq_update_card":       // sidepanel → background → srq_store.updateCard
    "srq_dismiss_card":      // sidepanel → background → srq_store.dismissCard
    "srq_dismiss_batch":     // sidepanel → background → dismiss all cards in topicKey
    "srq_export_batch":      // sidepanel/NLM → background → batch export flow
    "srq_export_card":       // sidepanel → background → single card export
    "srq_find_related":      // background internal → related_memory lookup
    "srq_card_created":      // background → sidepanel (notification broadcast)
    "srq_cards_updated":     // background → sidepanel (notification broadcast)
    "srq_cleanup":           // alarm → background → srq_store.cleanupStaleCards
};
```

---

## 9. File Manifest

### 9.1 New Files

| File | Type | Size Est. | Description |
|:-----|:-----|:----------|:------------|
| `storage/srq_store.js` | ES module | ~150 LOC | Card CRUD + storage management |
| `services/srq_enricher.js` | ES module | ~120 LOC | Card creation + async enrichment |
| `services/srq_grouper.js` | ES module | ~100 LOC | Batch computation + priority scoring |
| `ui/components/srq_widget.js` | IIFE | ~250 LOC | Sidepanel widget + review modal |
| `styles/srq.css.js` | IIFE (CSS-in-JS) | ~120 LOC | SRQ styles (follows micro_closure.css.js pattern) |

**Total new code estimate:** ~740 LOC

### 9.2 Modified Files

| File | Change | Effort |
|:-----|:-------|:-------|
| `bridge/nlm_floating_button.js` | Add `srq_create_card` message send | Small (~10 lines) |
| `bridge/nlm_passive_learning.js` | Add pending-batch banner injection | Medium (~50 lines) |
| `bridge/types.js` | Add SRQ storage key + settings defaults | Small (~10 lines) |
| `background.js` | Add SRQ message handlers + alarm | Medium (~60 lines) |
| `sidepanel.html` | Add `srq-widget-container` div | Tiny (~2 lines) |
| `sidepanel.js` | Mount SRQ widget + listen for updates | Small (~20 lines) |
| `manifest.json` | Add new JS to content_scripts / web_accessible_resources | Small (~5 lines) |
| `_locales/en/messages.json` | Add SRQ i18n strings | Small (~15 keys) |
| `_locales/vi/messages.json` | Add SRQ i18n strings (Vietnamese) | Small (~15 keys) |

---

## 10. i18n Keys

```json
{
    "srq_widget_title":         { "en": "Research Queue",        "vi": "Hàng chờ nghiên cứu" },
    "srq_clips_count":          { "en": "$1 clips",             "vi": "$1 đoạn" },
    "srq_export_all":           { "en": "Export All",           "vi": "Xuất tất cả" },
    "srq_export":               { "en": "Export",               "vi": "Xuất" },
    "srq_review":               { "en": "Review",               "vi": "Xem lại" },
    "srq_dismiss":              { "en": "Dismiss",              "vi": "Bỏ qua" },
    "srq_skip":                 { "en": "Skip",                 "vi": "Bỏ qua" },
    "srq_edit":                 { "en": "Edit",                 "vi": "Chỉnh sửa" },
    "srq_target_notebook":      { "en": "Target:",              "vi": "Đích:" },
    "srq_export_selected":      { "en": "Export Selected ($1)", "vi": "Xuất đã chọn ($1)" },
    "srq_cancel":               { "en": "Cancel",               "vi": "Hủy" },
    "srq_pii_warning":          { "en": "May contain personal info. Review before exporting.", "vi": "Có thể chứa thông tin cá nhân. Xem lại trước khi xuất." },
    "srq_nlm_banner":           { "en": "$1 research clips ready to export", "vi": "$1 đoạn nghiên cứu sẵn sàng xuất" },
    "srq_nlm_export_current":   { "en": "Export All to Current Notebook", "vi": "Xuất tất cả vào sổ hiện tại" },
    "srq_nlm_open_sidepanel":   { "en": "Open in Sidepanel", "vi": "Mở trong Sidepanel" },
    "srq_mode_deep":            { "en": "deep",                 "vi": "sâu" },
    "srq_mode_skim":            { "en": "skim",                 "vi": "lướt" },
    "srq_mode_reference":       { "en": "ref",                  "vi": "tham chiếu" },
    "srq_mode_reread":          { "en": "reread",               "vi": "đọc lại" },
    "srq_exported_success":     { "en": "Exported $1 clips",   "vi": "Đã xuất $1 đoạn" },
    "srq_empty":                { "en": "No pending clips",     "vi": "Không có đoạn chờ" }
}
```

---

## 11. Implementation Order

```
Week 1: Core Storage & Enrichment
  ├── Task 1.1: Create storage/srq_store.js (CRUD + FIFO eviction)
  ├── Task 1.2: Create services/srq_enricher.js (card creation)
  ├── Task 1.3: Add SRQ storage key + settings to bridge/types.js
  └── Task 1.4: Add background.js message handlers (srq_create_card, srq_get_*)

Week 2: Grouping & Export Pipeline
  ├── Task 2.1: Create services/srq_grouper.js (batch computation + priority)
  ├── Task 2.2: Implement batch export flow in background.js
  ├── Task 2.3: Wire nlm_floating_button.js to send srq_create_card
  └── Task 2.4: Test end-to-end: highlight → card → batch → export

Week 3: Sidepanel UI
  ├── Task 3.1: Create styles/srq.css.js
  ├── Task 3.2: Create ui/components/srq_widget.js (compact + expanded)
  ├── Task 3.3: Create review modal in srq_widget.js
  ├── Task 3.4: Mount widget in sidepanel.js + sidepanel.html
  └── Task 3.5: Add i18n strings

Week 4: NLM Banner & Polish
  ├── Task 4.1: Add banner to nlm_passive_learning.js
  ├── Task 4.2: Add stale card cleanup alarm in background.js
  ├── Task 4.3: Add PII warning UI in review modal
  ├── Task 4.4: Edge case testing (offline, 0 cards, 200 cards, NLM closed)
  └── Task 4.5: Update manifest.json
```

---

## 12. Testing Checklist

### 12.1 Unit Tests (if test framework available)

- [ ] `srq_store`: addCard respects max 200, FIFO evicts correctly
- [ ] `srq_store`: getCardsByTopicKey returns correct grouping
- [ ] `srq_store`: cleanupStaleCards removes only old dismissed/exported
- [ ] `srq_enricher`: createResearchCard populates all required fields
- [ ] `srq_enricher`: PII detection flags card correctly
- [ ] `srq_enricher`: sensitive domain returns null
- [ ] `srq_grouper`: computeBatches groups by topicKey correctly
- [ ] `srq_grouper`: computeBatchPriority returns higher for deep-heavy batches
- [ ] `srq_grouper`: resolveBatchNotebook picks most frequent suggestion

### 12.2 Integration Tests (manual)

- [ ] Highlight text → floating button → card appears in sidepanel widget
- [ ] Multiple highlights same topic → batch groups correctly
- [ ] Click "Export All" → cards flow through existing export_queue pipeline
- [ ] Open NotebookLM → banner shows pending count
- [ ] Click "Export All to Current Notebook" on NLM → correct notebook targeted
- [ ] Dismiss batch → cards marked dismissed, widget updates
- [ ] Review modal → can edit userNote, change target notebook
- [ ] Card with PII → warning shown in review
- [ ] Sensitive domain (banking) → no card created
- [ ] 200+ cards → FIFO eviction works, no storage overflow
- [ ] Stale card alarm → old cards cleaned after 14 days
- [ ] Offline → export button disabled, tooltip shown
- [ ] Settings toggle srqEnabled=false → no cards created, widget hidden

---

## 13. Success Metrics

| Metric | Target | Measurement |
|:-------|:-------|:------------|
| Card creation rate | > 80% of highlights create a card | Count srq_create_card messages vs floating button clicks |
| Batch accuracy | > 90% cards land in correct batch | Manual audit of 50 cards |
| Export conversion | > 50% of pending cards get exported | exported / (exported + dismissed) |
| Time to export | < 2 clicks from sidepanel | UX observation |
| User engagement | Widget opened > 3x/week by active users | srq_widget expand events |
| Zero regressions | Existing NLM export flow unchanged | Run existing test suite |

---

## 14. Future Phase 2 Hooks

SRQ Phase 1 is designed with these extension points for Phase 2:

| Phase 2 Feature | Hook in Phase 1 |
|:----------------|:-----------------|
| **Adaptive Heartbeat** | `relatedSessions[]` on card → Heartbeat uses same similarity scoring |
| **Comprehension Gate** | `readingMode` + integration with `comprehension_scoring.js` → Gate checks if user should review before new content |
| **Visual Anchor** | `viewportExcerpt` field → Phase 2 adds `imageUrl`, `imageAlt` fields to card |
| **MCP Server** | `srq_store` exposes clean CRUD → MCP server wraps these as MCP Resources/Tools |
| **OpenClaw** | `srq_export_batch` flow → OpenClaw could call this instead of CDP |
