# Phase 1 Plan (UX Foundation)

**Scope:** ATOM Active Reading 3.0 – Phase 1 (UX Foundation)
**Timeline:** Follow spec order (Task 1.1 → 1.6)
**Feature Flags:** Default ON
**Structure:** Use `services/` + `ui/components/` as per spec

---

## Milestone M1

### Task 1.1 – Pre‑reading Primer
- **Goal:** Show 3 guiding questions when opening a new article.
- **New Files:**
  - `services/primer_service.js`
  - `ui/components/primer.js`
- **Modify:**
  - `sidepanel.js`
  - Sidepanel CSS
- **Acceptance Criteria (Gherkin):**
  - Given an article with sufficient content, when sidepanel opens, then primer is shown once per 24h.
  - Given user accepts primer, then learning objectives are stored in session.
  - Given excluded domains, then primer never shows.
- **INPUT → OUTPUT → VERIFY:**
  - Input: `pageContext` (title/url/headings/content)
  - Output: primer UI + stored objectives
  - Verify: manual test on 3 URLs (1 excluded) + cache check
- **Priority:** Must

### Task 1.2 – Learning Objective / Mode Selector
- **Goal:** Allow Skim/Deep modes to control chips + response style.
- **New Files:**
  - `services/learning_objective.js`
  - `ui/components/mode_selector.js`
- **Modify:**
  - `sidepanel.js`
  - Sidepanel CSS
- **Acceptance Criteria (Gherkin):**
  - Given mode changes, when user chats, then prompt style follows mode.
  - Given skim mode, then chips are minimal.
  - Given deep mode, then chips are expanded.
- **INPUT → OUTPUT → VERIFY:**
  - Input: mode selection + sessionId
  - Output: stored mode + chips rendered
  - Verify: toggle mode updates chips immediately
- **Priority:** Must

---

## Milestone M2

### Task 1.3 – Smart Nudges
- **Goal:** Nudge when passive reading or fast scrolling.
- **New Files:**
  - `services/nudge_engine.js`
  - `ui/components/nudge.js`
- **Modify:**
  - `content.js`
  - `sidepanel.js`
  - CSS
- **Acceptance Criteria (Gherkin):**
  - Given fast scroll/no highlight, when threshold met, then nudge appears.
  - Given user dismisses, then nudge respects cooldown.
- **INPUT → OUTPUT → VERIFY:**
  - Input: scroll metrics + highlights count
  - Output: nudge UI + log event
  - Verify: scroll test triggers per rule; no spam
- **Priority:** Should

### Task 1.5 – Bloom’s Taxonomy Chips
- **Goal:** Chips mapped to cognitive levels.
- **Modify:**
  - `services/learning_objective.js`
  - `sidepanel.js`
  - CSS
- **Acceptance Criteria (Gherkin):**
  - Given deep mode, chips show level + icon.
  - Given high‑level chip, prompt changes accordingly.
- **INPUT → OUTPUT → VERIFY:**
  - Input: mode + chip id
  - Output: level‑mapped chips
  - Verify: manual click shows prompt changes
- **Priority:** Should

---

## Milestone M3

### Task 1.4 – Timer Integration
- **Goal:** Link Pomodoro to reading session + end review.
- **New Files:**
  - `services/timer_integration.js`
- **Modify:**
  - `popup.js`
  - Popup CSS
- **Acceptance Criteria (Gherkin):**
  - Given focus start, when tab valid, then session linked.
  - Given work phase ends, then review prompt appears.
  - Given recall submitted, then score stored.
- **INPUT → OUTPUT → VERIFY:**
  - Input: timer session + tab url/title
  - Output: focusSession metrics + recall question
  - Verify: run timer → review UI appears + metrics saved
- **Priority:** Should

### Task 1.6 – Auto‑Summarize Thread
- **Goal:** After 2–3 assistant replies, show summary + next questions.
- **Modify:**
  - `sidepanel.js`
  - Sidepanel CSS
- **Acceptance Criteria (Gherkin):**
  - Given ≥3 assistant messages, then summary card appears.
  - Given summary shown, then no repeat in same thread.
- **INPUT → OUTPUT → VERIFY:**
  - Input: thread messages
  - Output: summary UI + suggestions
  - Verify: 3‑turn chat → summary appears once
- **Priority:** Should

---

## Feature Flags (Default ON)
- `PRE_READING_PRIMER`
- `LEARNING_OBJECTIVES`
- `BLOOM_TAXONOMY`
- `SMART_NUDGES`
- `TIMER_INTEGRATION`
- `AUTO_SUMMARIZE`

---

## Risks & Mitigations
- **Token cost spikes:** cache primer + cap context length; only summarize after threshold.
- **Nudge spam:** enforce cooldown + per‑domain rate limit.
- **Review friction:** allow skip path + minimal UI.

---

## Definition of Done
- All tasks implemented in order M1→M3
- Basic manual tests pass per AC
- No runtime errors in sidepanel/content/popup
- Feature flags default ON

