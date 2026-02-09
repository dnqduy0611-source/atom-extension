# Phase 3: Diary + Notes + SRQ Integration - Detailed Spec (v3)

**Version:** 3.0
**Duration:** 1 week
**Prerequisites:** Phase 2 (Side Panel Unification) completed

---

## Muc tieu Phase 3

Tich hop Diary (Journal), Notes (Memory), va SRQ vao AI Command Routing theo codebase hien tai:
- DIARY_ADD voi AI-powered mood detection (qua prompt, khong regex client-side)
- DIARY_SUMMARY voi loc theo thoi gian
- SAVE_TO_NOTES luu vao atom_reading_notes (Memory)
- OPEN_SAVED / EXPORT_SAVED cho SRQ
- Quick Diary widget (Ghi nhanh) trong tab Chat
- Cross-linking Notes <-> Diary (heuristic v1)
- Undo support cho cac hanh dong tao du lieu

---

## Alignment voi codebase hien tai (bat buoc)

- Sidepanel dung script IIFE/global. Controller moi phai attach vao window (khong ES module export).
- Command handlers duoc register thong qua window.CommandRouter.register trong sidepanel context.
- UI-triggered command phai goi window.ActionExecutor.run(...) de dung confirm/undo/toast pipeline.
- Notes/Memory su dung storage key: atom_reading_notes (khong tao atom_memory moi).
- Diary/Journal su dung storage key: journal_logs va schema tuong thich journal.js.
- OPEN_SAVED trong sidepanel da co; dung switchMainTab('saved') (khong dung window.__tabController).

---

## Task Breakdown

### 3.1 DIARY_ADD voi AI-powered Mood Detection
**Effort:** 2 days

#### AI-powered thay vi regex
Regex khong xu ly duoc phu dinh/ngu canh. Mood detection phai duoc AI tao ra trong response va tra ve [ACTION:DIARY_ADD:...].

#### AI System Prompt (chat path)

```
### Mood Detection cho DIARY_ADD

Khi user chia se cam xuc hoac yeu cau ghi nhat ky:

1. Detect mood tu NOI DUNG + NGU CANH (chu y phu dinh)
2. Chon 1 mood phu hop nhat:
   - happy, excited, sad, anxious, tired, angry, focused, grateful, neutral
3. Suggest 1-3 tags:
   work, learning, health, relationship, finance, personal, creative, gratitude, reflection

Quan trong:
- "Khong vui" -> sad (khong phai happy)
- "Het lo lang" -> happy/relieved
- "Co gang khong stress" -> anxious
- Khong chac -> neutral

Output theo format:
[ACTION:DIARY_ADD:{"content":"...","mood":"tired","tags":["health"]}]
```

#### Command Handler (aligned schema)

```javascript
// Register in sidepanel context (IIFE controller or sidepanel.js)
window.CommandRouter.register(
  'DIARY_ADD',
  async ({ content, mood, tags, context }) => {
    if (!content || !content.trim()) {
      return { success: false, message: msg('diaryNoContent', 'Need some text to save.') };
    }

    const entry = {
      id: `journal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      input: {
        context: context || msg('jnl_title', 'Journal'),
        duration: 0,
        user_feeling: mood || 'neutral',
        user_tags: Array.isArray(tags) && tags.length ? tags : ['daily'],
        user_note: content.trim()
      },
      source: 'ai_command'
    };

    const data = await chrome.storage.local.get(['journal_logs']);
    const logs = data.journal_logs || [];
    logs.push(entry);
    await chrome.storage.local.set({ journal_logs: logs });

    return {
      success: true,
      message: msg('diarySaved', 'Saved to Journal'),
      data: entry // for undo
    };
  },
  async (data) => {
    const storage = await chrome.storage.local.get(['journal_logs']);
    const logs = storage.journal_logs || [];
    const next = logs.filter(l => l.id ? l.id !== data.id : l.timestamp !== data.timestamp);
    await chrome.storage.local.set({ journal_logs: next });
  }
);
```

#### Acceptance Criteria
- AI detects mood correctly (including negation) in chat path
- Entry saved to journal_logs with schema compatible with journal.js
- Unique id per entry for undo
- Undo removes entry
- Friendly toast + Undo
- Empty content -> friendly error
- i18n for all messages

---

### 3.2 DIARY_SUMMARY Command
**Effort:** 1 day

```javascript
window.CommandRouter.register('DIARY_SUMMARY', async ({ period = 'week' }) => {
  const data = await chrome.storage.local.get(['journal_logs']);
  const logs = data.journal_logs || [];

  const periodMs = { today: 86400000, week: 7 * 86400000, month: 30 * 86400000 };
  const cutoff = Date.now() - (periodMs[period] || periodMs.week);
  const filtered = logs.filter(log => (log.timestamp || log.ts || 0) >= cutoff);

  if (filtered.length === 0) {
    return { success: true, message: msg('diarySummaryEmpty', 'No entries yet for this period.') };
  }

  const moodCounts = {};
  const tagCounts = {};
  filtered.forEach(log => {
    const mood = log.input?.user_feeling || 'neutral';
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    (log.input?.user_tags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  // Build summary text (non-tech)
  // ...
  return { success: true, message: '...', data: { moodCounts, tagCounts } };
});
```

#### Acceptance Criteria
- Filters today/week/month
- Mood and tag counts correct
- Summary text non-tech
- Empty state friendly

---

### 3.3 SAVE_TO_NOTES Command (Memory)
**Effort:** 1 day

Notes should be saved into atom_reading_notes via background message to reuse dedupe + categorization.

```javascript
window.CommandRouter.register(
  'SAVE_TO_NOTES',
  async ({ content, category, tags }) => {
    let textToSave = content;
    if (!textToSave) {
      const ctx = await chrome.storage.local.get(['last_highlight', 'current_selection']);
      textToSave = ctx.current_selection || ctx.last_highlight;
    }

    if (!textToSave || !textToSave.trim()) {
      return { success: false, message: msg('noteNoContent', 'Select text or provide content first.') };
    }

    let url = '';
    let title = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      url = tab?.url || '';
      title = tab?.title || '';
    } catch {}

    const note = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      selection: textToSave.trim(),
      url,
      title,
      created_at: Date.now(),
      category: category || 'general',
      tags: Array.isArray(tags) ? tags : [],
      source: 'ai_command'
    };

    const res = await chrome.runtime.sendMessage({
      type: 'ATOM_SAVE_READING_NOTE',
      payload: { note }
    });

    if (!res?.ok) {
      return { success: false, message: msg('noteSaveFailed', 'Could not save note.') };
    }

    return { success: true, message: msg('noteSaved', 'Saved to Notes'), data: note };
  },
  async (data) => {
    const key = 'atom_reading_notes';
    const storage = await chrome.storage.local.get([key]);
    const list = Array.isArray(storage[key]) ? storage[key] : [];
    const next = list.filter(n => n.id !== data.id);
    await chrome.storage.local.set({ [key]: next });
  }
);
```

#### Acceptance Criteria
- Saves explicit content or last highlight fallback
- Stores into atom_reading_notes
- URL and title captured
- Undo removes entry
- Friendly error if empty

---

### 3.4 Quick Diary Widget (Ghi nhanh)
**Effort:** 1 day

#### Controller (IIFE, global)

```javascript
(function () {
  'use strict';

  function QuickDiaryController(actionExecutor) {
    this.container = document.getElementById('quick-diary');
    this.executor = actionExecutor;
    this.selectedMood = null;
    this.init();
  }

  QuickDiaryController.prototype.init = function () {
    if (!this.container || !this.executor) return;
    var self = this;

    this.container.querySelector('.qd-collapsed')?.addEventListener('click', function () {
      self.expand();
    });
    this.container.querySelector('.qd-close')?.addEventListener('click', function () {
      self.collapse();
    });

    this.container.querySelectorAll('.qd-mood').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.container.querySelectorAll('.qd-mood').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        self.selectedMood = btn.dataset.mood;
      });
    });

    this.container.querySelector('.qd-save')?.addEventListener('click', function () { self.save(); });

    this.container.querySelector('.qd-input')?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.save();
      }
    });
  };

  QuickDiaryController.prototype.expand = function () {
    this.container.classList.add('expanded');
    this.container.querySelector('.qd-input')?.focus();
  };

  QuickDiaryController.prototype.collapse = function () {
    this.container.classList.remove('expanded');
    this.reset();
  };

  QuickDiaryController.prototype.reset = function () {
    var input = this.container.querySelector('.qd-input');
    if (input) input.value = '';
    this.container.querySelectorAll('.qd-mood').forEach(function (b) { b.classList.remove('selected'); });
    this.selectedMood = null;
  };

  QuickDiaryController.prototype.save = async function () {
    var input = this.container.querySelector('.qd-input');
    var content = input?.value?.trim();
    if (!content) {
      input?.classList.add('shake');
      setTimeout(function () { input?.classList.remove('shake'); }, 500);
      return;
    }

    var params = { content: content, mood: this.selectedMood || 'neutral', tags: ['daily'] };
    var result = await this.executor.run('DIARY_ADD', params, { confirm: false, undoable: true });
    if (result?.success) this.collapse();
  };

  window.QuickDiaryController = QuickDiaryController;
})();
```

#### HTML (in Chat tab, above input)

```html
<div class="qd-widget" id="quick-diary">
  <div class="qd-collapsed">
    <span class="qd-hint" data-i18n="quickDiaryHint">Quick diary...</span>
  </div>
  <div class="qd-expanded-content">
    <div class="qd-header">
      <span data-i18n="quickDiaryTitle">Quick diary</span>
      <button class="qd-close" type="button">x</button>
    </div>
    <textarea class="qd-input" rows="2" data-i18n-placeholder="quickDiaryPlaceholder"></textarea>
    <div class="qd-moods">
      <button class="qd-mood" data-mood="happy">:)</button>
      <button class="qd-mood" data-mood="sad">:(</button>
      <button class="qd-mood" data-mood="anxious">!</button>
      <button class="qd-mood" data-mood="tired">z</button>
      <button class="qd-mood" data-mood="angry">x</button>
      <button class="qd-mood" data-mood="neutral">-</button>
      <button class="qd-mood" data-mood="focused">*</button>
      <button class="qd-mood" data-mood="grateful">+</button>
    </div>
    <button class="qd-save" data-i18n="diaryBtnSave">Save to journal</button>
  </div>
</div>
```

#### CSS
Add minimal styles in sidepanel.html to match existing surface and spacing; ensure no layout regression in narrow widths.

#### Acceptance Criteria
- Collapsed -> tap -> expanded (smooth)
- Mood buttons single-select
- Save creates DIARY_ADD with ActionExecutor (confirm false, undo true)
- Empty input -> shake
- Enter to save, Shift+Enter newline
- Collapse + reset after save

---

### 3.5 SRQ Commands
**Effort:** 0.5 day

```javascript
window.CommandRouter.register('OPEN_SAVED', async () => {
  switchMainTab('saved');
  return { success: true, message: '' };
});

window.CommandRouter.register('EXPORT_SAVED', async ({ format = 'text' }) => {
  const result = await chrome.runtime.sendMessage({ type: 'SRQ_BATCH_EXPORT', payload: { format } });
  const count = result?.exportedCount || 0;
  return { success: true, message: msg('savedExported', `Exported ${count} items`) };
});
```

---

### 3.6 Cross-linking Notes <-> Diary (heuristic v1)
**Effort:** 0.5 day

Heuristic (same-day + word overlap). AI semantic matching deferred to later phase.

```javascript
async function findRelatedDiary(noteEntry) {
  const data = await chrome.storage.local.get(['journal_logs']);
  const logs = data.journal_logs || [];

  const sameDay = logs.filter(l => isSameDay(l.timestamp || l.ts, noteEntry.created_at));
  if (sameDay.length === 0) return [];

  const noteWords = new Set(
    String(noteEntry.selection || '').toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  return sameDay.filter(log => {
    const logWords = String(log.input?.user_note || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = logWords.filter(w => noteWords.has(w));
    return overlap.length >= 2;
  });
}
```

#### Acceptance Criteria
- Related diary entries shown in Notes or Memory view
- Click navigates to diary entry
- Performance < 50ms for 500 entries
- No false positives from trivial words

---

### 3.7 Undo Support Verification
**Effort:** Testing only

Verify these commands have working undo:

| Command | Undo Action | Toast |
|---------|-------------|-------|
| DIARY_ADD | Remove entry | Saved to Journal + Undo |
| SAVE_TO_NOTES | Remove note | Saved to Notes + Undo |
| CREATE_CARD | Remove card | Card created + Undo |
| FOCUS_START | Stop timer | Focus started + Undo |

---

## Files Summary

| File | Type | Changes |
|------|------|---------|
| sidepanel.js | MODIFY | Register DIARY/SAVE handlers, init QuickDiaryController |
| ui/controllers/quick_diary.js | NEW | Quick diary widget (IIFE) |
| sidepanel.html | MODIFY | Quick diary HTML + CSS |
| background.js | MODIFY | AI prompt updates for mood detection (chat path) |
| _locales/*/messages.json | MODIFY | Diary/notes strings + copy |

---

## Definition of Done

- DIARY_ADD with AI mood detection works in chat path
- DIARY_SUMMARY filters today/week/month correctly
- SAVE_TO_NOTES saves into atom_reading_notes with undo
- Quick Diary widget works (non-tech, low friction)
- SRQ commands OPEN_SAVED/EXPORT_SAVED work
- Heuristic cross-linking Notes <-> Diary works
- Undo works for data-creating commands
- All i18n strings added, copy non-tech
- No regressions

---

## Timeline

Day 1-2: 3.1 DIARY_ADD + AI mood detection
Day 3:   3.2 DIARY_SUMMARY + 3.3 SAVE_TO_NOTES
Day 4:   3.4 Quick Diary widget
Day 5:   3.5 SRQ commands + 3.6 Cross-linking
Day 6:   3.7 Undo verification + testing
Day 7:   Bug fixes + review
