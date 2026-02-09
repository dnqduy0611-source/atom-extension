# NotebookLM Bridge Refinements (v2)

**Goal:** Improve user experience by addressing "context loss" and "dumb naming" issues.

## 1. Smart Notebook Naming (AI-Powered)
**Problem:** Regex-based naming produces awkward titles (e.g., `keyword-one-two`).
**Solution:** Use Gemini Flash to generate concise, semantic titles.
- **Trigger:** Upon "Save to NotebookLM".
- **Source:** Title + Selection + Intent.
- **Method:** `AI_SERVICE.generateTitle(context)`.
- **Fallback:** Keep existing keyword extractor if API fails.

## 2. Rich Data Flow (Research Card)
**Problem:** Pasting raw text loses context (URL, Author, Date).
**Solution:** Pass full "ATOM Clip" Markdown format.
- **Format:**
  ```markdown
  # Title
  - URL: ...
  - Date: ...
  ## Highlight
  [Content]
  ## Notes
  [User Notes]
  ```
- **Benefit:** NotebookLM "sees" the metadata without needing to crawl.

## 3. Guided Paste Workflow (The "Coach")
**Problem:** User pastes into Chat (Query) instead of Source (Knowledge).
**Solution:** Interactive 3-step guide in `nlm_passive_learning.js`.
- **UI:**
  > 1. Click **(+) Add Source**.
  > 2. Select **Copied Text**.
  > 3. Paste (Ctrl+V).
- **Secondary Option:** Add "📋 Copy Link" button for users who prefer crawling.
