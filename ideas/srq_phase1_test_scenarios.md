# Smart Research Queue (Phase 1) - Test Scenarios

Primary plan reference: `ideas/Smart_Research_queue_phase1_plan.txt`

## A. Static/Code-Level Checks

1. **Storage constants/settings present**
   - File: `bridge/types.js`
   - Expect: `SRQ_CARDS_KEY`, `SRQ_MAX_CARDS`, and SRQ settings in `DEFAULT_NLM_SETTINGS`.

2. **SRQ store CRUD exported**
   - File: `storage/srq_store.js`
   - Expect exports: `loadCards`, `saveCards`, `addCard`, `updateCard`, `updateCardStatus`, `getCardsByStatus`, `getCardsByTopicKey`, `getPendingCards`, `dismissCard`, `cleanupStaleCards`, `getCardStats`.

3. **SRQ enricher exported**
   - File: `services/srq_enricher.js`
   - Expect exports: `createResearchCard`, `enrichCardAsync`.

4. **SRQ grouper exported**
   - File: `services/srq_grouper.js`
   - Expect exports: `computeBatches`, `computeBatchPriority`, `getBatchesForExport`.

5. **Background message handlers present**
   - File: `background.js`
   - Expect handlers for `SRQ_CREATE_CARD`, `SRQ_GET_PENDING_COUNT`, `SRQ_GET_CARDS`, `SRQ_GET_BATCHES`, `SRQ_EXPORT_BATCH`, `SRQ_DISMISS_BATCH`, `SRQ_DISMISS_CARD`.

6. **Sidepanel widget mount present**
   - Files: `sidepanel.html`, `sidepanel.js`
   - Expect container + script includes + `mountSRQWidget` + refresh on `SRQ_CARDS_UPDATED`.

7. **Floating button creates SRQ card**
   - File: `bridge/nlm_floating_button.js`
   - Expect fire-and-forget `SRQ_CREATE_CARD` message.

8. **NLM banner hook present**
   - File: `bridge/nlm_passive_learning.js`
   - Expect `checkAndShowSRQBanner`.

9. **Manifest resources include SRQ assets**
   - File: `manifest.json`
   - Expect `styles/srq.css.js` and `ui/components/srq_widget.js` in `web_accessible_resources`.

## B. Runtime Manual Checks (DevTools)

1. Create a card via:
```js
chrome.runtime.sendMessage({
  type: 'SRQ_CREATE_CARD',
  payload: {
    url: 'https://arxiv.org/abs/2301.00001',
    title: 'Sparse Attention Mechanisms',
    domain: 'arxiv.org',
    selectedText: 'Sparse attention reduces quadratic complexity...',
    tags: ['ai','attention'],
    tagsSource: 'user'
  }
}, console.log)
```

2. Verify pending count:
```js
chrome.runtime.sendMessage({type: 'SRQ_GET_PENDING_COUNT'}, console.log)
```

3. Verify grouped batches:
```js
chrome.runtime.sendMessage({type: 'SRQ_GET_BATCHES'}, console.log)
```

4. Export a batch:
```js
chrome.runtime.sendMessage({type: 'SRQ_EXPORT_BATCH', topicKey: 'YOUR_TOPIC'}, console.log)
```

5. Verify sidepanel widget auto-refreshes after export/dismiss.

## C. Optional Edge Cases

- Sensitive domain URL => no card created.
- PII text => card has `piiWarning`.
- 200+ cards => FIFO evicts oldest `exported`/`dismissed` only.
- Empty queue => sidepanel widget hidden.
- Banner cooldown (30 min) after dismiss.
