# Review Cards — AI-Powered Flashcard Spec

## 1) Mục tiêu & phạm vi

Biến tab **Review** (hiện đang là placeholder tĩnh) thành hệ thống flashcard ôn tập thông minh:

1. **Fix display bug**: Review panel bị cắt nội dung do CSS thiếu `overflow` + `flex-direction`.
2. **AI Flashcard Generation**: Dùng Gemini/OpenRouter (qua `callLLMAPI()` có sẵn) để tạo câu hỏi ôn tập từ highlights đã lưu trong SRQ.
3. **3 loại card**: Recall, Concept, Connect — mỗi loại test một kỹ năng khác nhau.
4. **Caching**: Lưu cache câu hỏi đã generate để tránh lãng phí API call.

## 2) Non-goals
- Không thêm permission mới trong `manifest.json`.
- Không thay đổi data model SRQ cards hiện tại (`atom_srq_cards_v1`).
- Không implement spaced repetition algorithm (để phase sau).
- Không tạo UI cho user tự tạo flashcard thủ công.
- Không thay đổi flow của tab Saved / SRQ widget hiện tại.

## 3) Hiện trạng / vấn đề

### Display Bug
- Tab Review (`data-main-tab="cards"`) hiện chỉ có placeholder tĩnh trong `#cards-panel`.
- CSS `.sp-cards-panel` thiếu `flex-direction: column` và `overflow-y: auto`, khiến nội dung bị cắt khi panel nhỏ.
- Nút "Back to chat" bị tràn ra ngoài viewport.

### Thiếu Logic
- `#cards-panel` chỉ chứa HTML tĩnh: tiêu đề "Practice" + mô tả + nút quay lại.
- Không có logic nào generate card từ dữ liệu SRQ.
- `switchMainTab('cards')` chỉ toggle CSS class, không mount component nào.

## 4) Thiết kế giải pháp

### 4.1 Ba loại Flashcard

#### Recall (Nhớ lại) — ⭐ Dễ
| Mặt | Nội dung |
|-----|----------|
| **Front** | Topic label + 1-2 câu đầu của highlight (cắt bớt) |
| **Back** | Câu hỏi AI-generated + đáp án đầy đủ |

**AI Prompt**: Dựa trên đoạn highlight, tạo 1 câu hỏi kiểm tra xem người đọc có nhớ ý chính không.

#### Concept (Khái niệm) — ⭐⭐ Trung bình
| Mặt | Nội dung |
|-----|----------|
| **Front** | AI-generated concept summary (paraphrase của insight) |
| **Back** | Highlight gốc + nguồn (title + domain) |

**AI Prompt**: Tóm tắt khái niệm chính từ đoạn highlight bằng cách diễn đạt khác.

#### Connect (Kết nối) — ⭐⭐⭐ Khó
| Mặt | Nội dung |
|-----|----------|
| **Front** | 2 highlights khác nhau cùng topic |
| **Back** | AI-generated insight về mối liên hệ giữa 2 đoạn |

**AI Prompt**: Giải thích mối liên hệ/pattern giữa 2 đoạn highlight cùng chủ đề.

> **Lưu ý**: Connect card chỉ tạo được khi có ≥2 cards cùng `topicKey`.

### 4.2 Card Generation Flow

```
┌───────────────┐     ┌──────────────────┐     ┌──────────────┐
│ User clicks   │────▶│ Load SRQ cards   │────▶│ Check cache  │
│ Review tab    │     │ (SRQ_GET_ALL_    │     │ (storage)    │
│               │     │  CARDS)          │     │              │
└───────────────┘     └──────────────────┘     └──────┬───────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          │ Cache hit?              │
                                          ├─────YES────┐            │
                                          │            ▼            │
                                          │   Render from cache     │
                                          │                         │
                                          ├─────NO─────┐            │
                                          │            ▼            │
                                          │   Select eligible cards │
                                          │   (max 5 per session)   │
                                          │            │            │
                                          │            ▼            │
                                          │   Build batch prompt    │
                                          │   (1 API call)          │
                                          │            │            │
                                          │            ▼            │
                                          │   callLLMAPI()          │
                                          │   (Gemini/OpenRouter)   │
                                          │            │            │
                                          │            ▼            │
                                          │   Parse JSON response   │
                                          │   Save to cache         │
                                          │   Render flashcards     │
                                          └─────────────────────────┘
```

### 4.3 Card Selection Algorithm

```javascript
function selectCardsForReview(allCards) {
    // 1. Filter eligible: có selectedText + (refinedInsight hoặc atomicThought hoặc selectedText > 30 chars)
    const eligible = allCards.filter(c =>
        c.selectedText?.length > 30 &&
        (c.status === 'exported' || c.status === 'pending_review' || c.status === 'approved')
    );

    if (eligible.length === 0) return { cards: [], types: [] };

    // 2. Shuffle + pick max 5
    const shuffled = shuffleArray(eligible);
    const selected = shuffled.slice(0, 5);

    // 3. Assign card types
    const types = [];
    // - First 2: Recall (easiest)
    // - Next 1-2: Concept
    // - Last 1: Connect (if ≥2 cards same topic available)
    for (let i = 0; i < selected.length; i++) {
        if (i < 2) types.push('recall');
        else if (i < 4) types.push('concept');
        else types.push('connect');
    }

    // Check if Connect is possible (need ≥2 cards same topicKey)
    const lastIdx = types.lastIndexOf('connect');
    if (lastIdx >= 0) {
        const topicGroups = groupByTopicKey(eligible);
        const connectableTopic = Object.keys(topicGroups).find(k => topicGroups[k].length >= 2);
        if (!connectableTopic) {
            types[lastIdx] = 'concept'; // Fallback to Concept
        }
    }

    return { cards: selected, types };
}
```

### 4.4 AI Prompt Design

**Batch prompt** (1 API call cho tất cả cards):

```
System: You are a study assistant. Generate flashcard questions from reading highlights.
Return ONLY valid JSON array. No markdown, no explanation.

User:
Generate flashcard questions for these highlights. Return JSON array with this exact structure:

[
  {
    "index": 0,
    "type": "recall",
    "question": "What is the key concept described in this highlight?",
    "answer": "Closures capture variables by reference, not by value.",
    "hint": "Think about variable scope..."
  },
  {
    "index": 1,
    "type": "concept",
    "conceptSummary": "A mechanism that preserves access to outer scope variables",
    "sourceTitle": "MDN Web Docs",
    "sourceDomain": "developer.mozilla.org"
  },
  {
    "index": 2,
    "type": "connect",
    "connectionQuestion": "How do these two concepts relate?",
    "connectionInsight": "Both closures and memory leaks involve...",
    "highlightA": "Closures capture variables...",
    "highlightB": "Memory leaks in event listeners..."
  }
]

Highlights:
---
Index 0 (recall): "Closures give you access to an outer function's scope..."
Topic: JavaScript Closures
Source: MDN Web Docs (developer.mozilla.org)
---
Index 1 (concept): "React re-renders when state changes..."
Topic: React Rendering
Source: React Docs (react.dev)
Insight: "Virtual DOM diffing only updates changed elements"
---
Index 2 (connect):
  Highlight A: "Closures capture variables by reference"
  Highlight B: "Memory leaks in event listeners"
  Topic: JavaScript Memory
---
```

**Generation config:**
```javascript
{
    temperature: 0.7,
    maxOutputTokens: 1500
}
```

### 4.5 Caching Strategy

**Storage key**: `atom_review_cards_cache`

```javascript
{
    generatedAt: 1707600000000,   // timestamp
    ttl: 3600000,                 // 1 giờ (ms)
    sourceCardIds: ["card_1", "card_2", ...],  // input cards đã dùng
    flashcards: [                 // kết quả AI
        { index: 0, type: "recall", question: "...", answer: "...", hint: "..." },
        ...
    ]
}
```

**Cache invalidation:**
- TTL hết (1 giờ).
- SRQ cards thay đổi (sourceCardIds không khớp).
- User nhấn nút "Generate new cards" (force refresh).

### 4.6 UX States

| State | Điều kiện | UI |
|-------|-----------|-----|
| `empty` | Không có eligible SRQ cards | Icon 📖 + "Save highlights while reading to practice here." + nút "Go to Chat" |
| `loading` | Đang gọi API generate | Skeleton card + spinner + "Generating questions..." |
| `ready` | Có flashcards | Card stack + progress bar + navigation |
| `error` | API fail | Error message + nút "Try again" + nút "Go to Chat" |
| `no_api_key` | Không có Gemini/OpenRouter key | Message hướng dẫn setup API key |

## 5) Chi tiết thay đổi theo file

### [NEW] `ui/components/review_cards.js`
Component chính, bao gồm:

- `mount(container)` — Entry point, gọi khi switch sang tab Review.
- `refresh()` — Force regenerate (bỏ cache).
- `loadEligibleCards()` — Load SRQ cards qua `SRQ_GET_ALL_CARDS`, filter eligible.
- `checkCache()` — Kiểm tra cache trong `chrome.storage.local`.
- `generateFlashcards(cards, types)` — Build prompt + gọi `callLLMAPI()`.
- `parseAIResponse(text)` — Parse JSON từ AI response (có fallback nếu AI trả markdown).
- `renderDeck(flashcards, sourceCards)` — Render card stack UI.
- `renderCard(flashcard, sourceCard)` — Render 1 card với flip animation.
- `renderEmptyState()` — Empty state UI.
- `renderErrorState(error, retryFn)` — Error state UI.
- `renderLoadingState()` — Loading skeleton UI.
- `renderNoApiKeyState()` — Hướng dẫn setup API key.
- `handleFlip(cardEl)` — Toggle flip animation.
- `handleNext() / handlePrev()` — Navigate card deck.

**Public API:**
```javascript
window.ReviewCards = {
    mount: mount,
    refresh: refresh
};
```

### [NEW] `styles/review_cards.css.js`
CSS module (tự inject `<style>` vào `<head>`), bao gồm:

- **Card container**: `max-width: 100%`, centered, padding 12px.
- **Card flip**: CSS 3D `perspective(1000px)` + `rotateY(180deg)` trên `.flipped`.
- **Card front/back**: `backface-visibility: hidden`, absolute positioning.
- **Type badges**: color-coded pills (Recall=🟢 `#10B981`, Concept=🔵 `#3B82F6`, Connect=🟣 `#8B5CF6`).
- **Progress bar**: thin bar top, fills as user advances.
- **Navigation**: prev/next buttons + card counter "2 / 5".
- **Empty/Error/Loading states**: centered flex, consistent with SRQ widget styles.
- **Animations**: fade-in on mount, smooth flip transition 0.5s.

### [MODIFY] `sidepanel.html`

1. **CSS fix** (lines 648-655):
   - Add `flex-direction: column` + `overflow-y: auto` to `.sp-cards-panel`.
   - Remove `align-items: center` + `justify-content: center` + `text-align: center`.

2. **HTML** (lines 4496-4504):
   - Replace static placeholder with: `<div id="review-cards-root"></div>`.

3. **Script tags** (before closing `</body>`):
   ```html
   <script src="styles/review_cards.css.js"></script>
   <script src="ui/components/review_cards.js"></script>
   ```

### [MODIFY] `sidepanel.js`

1. **`switchMainTab()`** (line ~2960):
   ```javascript
   } else if (next === 'cards') {
       window.ReviewCards?.mount(document.getElementById('review-cards-root'));
   }
   ```

2. **SRQ_CARDS_UPDATED listener** (line ~8005): Thêm refresh review cards:
   ```javascript
   if (msg?.type === "SRQ_CARDS_UPDATED") {
       debouncedRefreshSRQWidget();
       // Invalidate review cards cache khi data thay đổi
       if (activeMainTab === 'cards') {
           window.ReviewCards?.refresh();
       }
   }
   ```

3. **Remove `cardsGoChatBtn` listener** (line ~2921): Không cần nữa vì placeholder bị thay.

## 6) Message/Event contracts

Không tạo message type mới. Tái sử dụng:
- `SRQ_GET_ALL_CARDS` — Lấy toàn bộ cards từ background.
- `SRQ_CARDS_UPDATED` — Trigger refresh.

Internal functions (không qua message):
- `callLLMAPI(systemPrompt, history, options)` — Gọi AI (đã có trong `sidepanel.js`).
- `getLLMProvider()` — Lấy config provider (đã có).

## 7) Data model / state changes

### Cache object (NEW)
**Storage key**: `atom_review_cards_cache`
```javascript
{
    generatedAt: number,             // Unix timestamp (ms)
    ttl: number,                     // Default: 3600000 (1h)
    sourceCardIds: string[],         // IDs of SRQ cards used as input
    flashcards: FlashcardItem[]      // Generated cards
}
```

### FlashcardItem schema
```javascript
// Type: recall
{
    index: number,
    type: "recall",
    question: string,       // AI-generated question
    answer: string,         // AI-generated answer
    hint: string,           // Optional hint
    sourceCardId: string    // Reference to SRQ card
}

// Type: concept
{
    index: number,
    type: "concept",
    conceptSummary: string, // AI paraphrase of the insight
    sourceCardId: string
}

// Type: connect
{
    index: number,
    type: "connect",
    connectionQuestion: string,
    connectionInsight: string,
    sourceCardIdA: string,
    sourceCardIdB: string
}
```

**Không thay đổi** data model SRQ cards (`atom_srq_cards_v1`).

## 8) UX Copy

### Tiếng Anh (fallback)
| Key | Text |
|-----|------|
| `review_title` | Review |
| `review_loading` | Generating study cards... |
| `review_empty` | Save highlights while reading to start practicing. |
| `review_empty_cta` | Go to Chat |
| `review_error` | Couldn't generate cards. |
| `review_retry` | Try again |
| `review_no_key` | Set up an API key in Settings to use Review. |
| `review_card_flip` | Tap to reveal |
| `review_progress` | $1 of $2 |
| `review_type_recall` | Recall |
| `review_type_concept` | Concept |
| `review_type_connect` | Connect |
| `review_refresh` | New cards |
| `review_done_title` | Session complete! |
| `review_done_desc` | You reviewed $1 cards. |
| `review_done_again` | Practice again |

## 9) Test plan

### Manual Testing
1. **Display fix**: Mở Review tab → nội dung không bị cắt, kể cả khi panel nhỏ (min-width 300px).
2. **Empty state**: Xóa hết SRQ cards → mở Review → hiện "Save highlights...".
3. **Loading state**: Mở Review lần đầu (không cache) → thấy skeleton + "Generating...".
4. **Card generation**: Lưu 3+ highlights → mở Review → AI tạo được cards.
5. **Card flip**: Click card → flip animation smooth, hiện mặt sau.
6. **Navigation**: Next/Prev → chuyển card, progress bar cập nhật.
7. **Cache**: Đóng/mở panel → cards load từ cache (không gọi API lại).
8. **Cache invalidation**: Lưu thêm highlight → mở Review → generate lại.
9. **Error state**: Tắt mạng → mở Review → hiện error + retry.
10. **No API key**: Xóa API key → mở Review → hiện hướng dẫn setup.
11. **Tab switching**: Chat → Review → Notes → Review → state giữ nguyên.

### Edge Cases
- SRQ chỉ có 1 card → không tạo Connect card, fallback sang Concept.
- AI trả response không valid JSON → parse fallback (strip markdown, retry).
- API timeout → hiện error, user nhấn retry.
- Cards đều cùng topic → tất cả Connect cards đều possible.
- Cards đều khác topic → không có Connect card nào.

## 10) Acceptance criteria

- [ ] Review tab không còn bị cắt nội dung (overflow fix).
- [ ] Hiển thị đúng state: empty / loading / ready / error / no_api_key.
- [ ] AI generate được ít nhất 3 flashcards từ 3+ SRQ highlights.
- [ ] 3 loại card (Recall, Concept, Connect) hoạt động đúng mô tả.
- [ ] Card flip animation smooth (CSS 3D transform).
- [ ] Cache hoạt động: không gọi API lại trong 1 giờ nếu data không đổi.
- [ ] Reuse `callLLMAPI()` — Gemini native + OpenRouter fallback chain.
- [ ] Không thêm permission manifest.
- [ ] Không break tab Chat / Notes / Saved hiện tại.

## 11) Effort & phụ thuộc

- **Effort ước tính**: 2-3 giờ dev + 0.5 giờ test.
- **Phụ thuộc**:
  - `callLLMAPI()` + `getLLMProvider()` (có sẵn trong `sidepanel.js`).
  - `SRQ_GET_ALL_CARDS` handler (có sẵn trong `background.js`).
  - `srq.css.js` pattern (tham khảo kiến trúc CSS module).
- **Không có** external dependency mới.
