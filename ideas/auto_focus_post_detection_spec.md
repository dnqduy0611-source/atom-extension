# Auto-Focus Post Detection Spec

## Mục tiêu
Cho phép sidepanel tự động nhận diện bài viết đang focus trên newsfeed (Facebook, Reddit) mà không cần highlight text.

## Behavior
Khi user **click nút "Capture Post"** hoặc **nhấn Alt+C**, extension sẽ:
1. Tìm bài viết chiếm >30% viewport
2. Extract toàn bộ nội dung (kể cả tràn màn hình)
3. Gửi như "virtual highlight" để sidepanel xử lý

---

## Platform Selectors

| Platform | Selector |
|----------|----------|
| Facebook | `[role="article"][aria-posinset]` |
| Reddit | `shreddit-post, [data-testid="post-container"]` |

---

## Implementation

### Phase 1: Content.js - PostFocusObserver

```javascript
class PostFocusObserver {
    constructor() {
        this.cachedContent = null;
        this.platformSelectors = {
            'facebook.com': '[role="article"][aria-posinset]',
            'reddit.com': 'shreddit-post, [data-testid="post-container"]'
        };
    }

    getSelector() {
        const host = location.hostname.replace('www.', '');
        return this.platformSelectors[host] || null;
    }

    detectFocusedPost() {
        const selector = this.getSelector();
        if (!selector) return null;

        const posts = document.querySelectorAll(selector);
        let maxRatio = 0;
        let focusedPost = null;

        for (const post of posts) {
            const rect = post.getBoundingClientRect();
            const visibleHeight = Math.min(rect.bottom, window.innerHeight) 
                                - Math.max(rect.top, 0);
            const ratio = visibleHeight / window.innerHeight;
            
            if (ratio > maxRatio && ratio > 0.3) {
                maxRatio = ratio;
                focusedPost = post;
            }
        }
        return focusedPost;
    }

    extractPostContent(postElement) {
        if (!postElement) return null;

        const textWalker = document.createTreeWalker(
            postElement,
            NodeFilter.SHOW_TEXT,
            { acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('script, style, noscript')) 
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }}
        );

        let fullText = '';
        while (textWalker.nextNode()) {
            fullText += textWalker.currentNode.textContent + ' ';
        }

        return {
            text: fullText.replace(/\s+/g, ' ').trim().slice(0, 8000),
            url: window.location.href,
            title: document.title,
            domain: location.hostname.replace('www.', ''),
            source: 'auto_focus_post'
        };
    }

    update() {
        const post = this.detectFocusedPost();
        this.cachedContent = post ? this.extractPostContent(post) : null;
        return this.cachedContent;
    }
}
```

### Phase 2: Message Handler (content.js)

```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'ATOM_GET_FOCUSED_POST') {
        const content = postFocusObserver?.update();
        sendResponse({ ok: !!content, post: content });
        return true;
    }
});
```

### Phase 3: Sidepanel.js - Capture Function

```javascript
async function captureFocusedPost() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { 
        type: 'ATOM_GET_FOCUSED_POST' 
    });

    if (response?.ok && response.post) {
        handleNewHighlight({
            ...response.post,
            threadId: `auto_${Date.now()}_${Math.random().toString(16).slice(2)}`
        });
    } else {
        showToast(getMessage('sp_no_post_found', 'Không tìm thấy bài viết'), 'info');
    }
}
```

---

## UI Changes

### Sidepanel Header Button
```html
<button id="capture-post-btn" class="sp-header-btn" title="Capture Post (Alt+C)">
    📌
</button>
```

### Hotkey
- **Alt+C**: Capture focused post

---

## Files to Modify

| File | Changes |
|------|---------|
| `content.js` | Add `PostFocusObserver` class + message handler |
| `sidepanel.js` | Add `captureFocusedPost()` + button + hotkey |
| `sidepanel.html` | Add capture button in header |
| `styles.css` | Style for new button |
| `_locales/*/messages.json` | Add i18n strings |
