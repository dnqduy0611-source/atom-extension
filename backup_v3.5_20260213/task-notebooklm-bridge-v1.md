# Task: NotebookLM Bridge v1 (UI-Assisted)

## Goal
Implement the NotebookLM Bridge v1 using UI-assisted flow only (clipboard + open notebook + user paste/confirm), while keeping a connector interface for future Enterprise API mode.

## Scope (v1)
- Export ReadingBundle as “ATOM Clip” Markdown (snippet + metadata only).
- Mapping rules: byTag > byIntent > byDomain > default (Inbox).
- MV3-safe ExportQueue with dedupe + retry.
- Open-to-Recall: open correct notebook from Memory.
- Options UI section “NotebookLM Bridge” in existing options page.
- Privacy guardrails: allowCloudExport toggle, PII warning, sensitive domains list.

## Out of Scope (v1)
- Enterprise API integration.
- Auto-scrape full page.
- Two-way sync from NotebookLM to ATOM.

## Architecture Decisions
- UI-assisted connector only for v1, but keep `NotebookConnector` interface.
- Storage in `chrome.storage.local` with versioned keys.
- Export payload uses Markdown “ATOM Clip” template; never full page.
- No auto-inject into NotebookLM UI; only open tab + clipboard copy.

## Milestones
1) Core data + queue + connector (background/service worker)
2) UI/Options wiring (options page + content/popup hooks)
3) Recall flow + logging + privacy guardrails
4) QA + docs

## Task Breakdown

### 1) Data Model + Storage Schema (Backend)
**Agent:** backend-specialist  
**Skills:** clean-code, api-patterns  
**Input → Output → Verify**
- Input: spec ReadingBundle / ExportJob / NotebookTargetRule
- Output: shared types + storage keys + validation helpers
- Verify: unit tests or simple runtime assertions for schema validation

### 2) ExportQueue + Dedupe + Retry (Background)
**Agent:** backend-specialist  
**Skills:** clean-code, testing-patterns  
**Input → Output → Verify**
- Input: queue rules (dedupeKey, retry policy, MV3 constraints)
- Output: queue manager module with enqueue/process/retry + storage persistence
- Verify: simulated enqueue → success/fail → retry in dev logs

### 3) Connector Interface (UI-Assisted)
**Agent:** backend-specialist  
**Skills:** clean-code  
**Input → Output → Verify**
- Input: UI-assisted flow spec
- Output: `NotebookConnector` interface + `UIAssistedConnector`
- Verify: clipboard copy + open notebook URL on manual trigger

### 4) Notebook Mapping Rules
**Agent:** backend-specialist  
**Skills:** clean-code  
**Input → Output → Verify**
- Input: priority rules (byTag/byIntent/byDomain/default)
- Output: deterministic resolver + unit tests for priority ordering
- Verify: sample bundles map to expected notebookRef

### 5) Options UI: NotebookLM Bridge Section
**Agent:** frontend-specialist  
**Skills:** modern-web-architect, ui-ux-pro-max  
**Input → Output → Verify**
- Input: UI requirements (enable toggle, default notebook, rules, privacy)
- Output: new section in `options.html` + wiring in `options.js`
- Verify: save/restore settings + i18n strings render correctly

### 6) Privacy/PII Guardrails
**Agent:** security-auditor  
**Skills:** security-armor  
**Input → Output → Verify**
- Input: PII heuristic + sensitive domains list
- Output: PII detector + block/confirm flow + user-configurable domain list
- Verify: known PII strings trigger warning; sensitive domain blocks export

### 7) Export Trigger (Save/Export UI)
**Agent:** frontend-specialist  
**Skills:** clean-code  
**Input → Output → Verify**
- Input: existing “Save” entry points (context menu, popup, selection)
- Output: bridge export hook that builds ReadingBundle + enqueues
- Verify: user can save highlight → clipboard filled → NotebookLM opened

### 8) Open-to-Recall Flow
**Agent:** backend-specialist  
**Skills:** ai-engineer  
**Input → Output → Verify**
- Input: memory item with notebookRef + suggested question
- Output: open notebook button + optional “copy question”
- Verify: correct notebook opens from memory view

### 9) Logging + Telemetry
**Agent:** backend-specialist  
**Skills:** metrics  
**Input → Output → Verify**
- Input: event list from spec
- Output: `nlm_bridge.*` event journal entries
- Verify: events visible in debug log / journal export

### 10) Docs + Changelog
**Agent:** documentation-writer  
**Skills:** api-documenter  
**Input → Output → Verify**
- Input: new behavior + settings
- Output: README/notes updated + new options explained
- Verify: docs reflect new bridge settings and limitations

## Likely File Touch List (Initial)
- `background.js`
- `content.js`
- `options.html`
- `options.js`
- `journal.js` (if used for logging events)
- `_locales/en/messages.json`
- `_locales/vi/messages.json`
- New modules (suggested):
  - `bridge/notebooklm_connector.js`
  - `bridge/export_queue.js`
  - `bridge/mapping_rules.js`
  - `bridge/clip_format.js`
  - `bridge/privacy_guard.js`
  - `bridge/types.js`

## Acceptance Criteria (v1)
1) Save highlight/insight → NotebookLM in ≤ 2 user actions (UI-assisted).
2) Default “Inbox” notebook prevents data drop.
3) Dedupe prevents repeated spam within 24h.
4) Open-to-Recall opens correct notebook in 1 click.
5) No full-page export; only clip + metadata.

## Verification Checklist
- Manual: save flow, dedupe prompt, PII warning, sensitive domain block.
- Manual: options save/restore + i18n labels.
- Manual: open-to-recall from memory.
- Optional: run `python .agent/scripts/checklist.py .` if tests/scripts exist.

