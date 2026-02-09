// content.js - FIXED: OPT-IN JOURNAL & EVENT LISTENER BUG

// ===== AUTO-FOCUS POST DETECTION (SYNCHRONOUS INIT - outside IIFE) =====
// Must be synchronous and before IIFE to ensure it's ready for messages
(function initPostFocusObserver() {
    if (window.__ATOM_POST_FOCUS_OBSERVER__) return; // Already initialized
    if (window.top !== window) return; // Skip iframes

    // Check if this is a supported platform
    const host = location.hostname.replace(/^www\./, '');
    const supportedPlatforms = ['facebook.com', 'reddit.com'];
    if (!supportedPlatforms.includes(host)) return;

    window.__ATOM_POST_FOCUS_OBSERVER__ = {
        cachedContent: null,
        platform: host,

        // NEW APPROACH: Find post by element at center of viewport
        detectFocusedPost() {
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;

            // Sample multiple points in the center area to find the main content
            const samplePoints = [
                { x: viewportWidth * 0.3, y: viewportHeight * 0.4 },
                { x: viewportWidth * 0.3, y: viewportHeight * 0.5 },
                { x: viewportWidth * 0.3, y: viewportHeight * 0.6 },
                { x: viewportWidth * 0.4, y: viewportHeight * 0.5 },
            ];

            for (const point of samplePoints) {
                const element = document.elementFromPoint(point.x, point.y);
                if (!element) continue;

                // Walk up the DOM to find a suitable post container
                const postContainer = this.findPostContainer(element);
                if (postContainer) {
                    return postContainer;
                }
            }

            return null;
        },

        // Find the post container by walking up the DOM
        findPostContainer(element) {
            let el = element;
            let bestCandidate = null;
            let bestScore = 0;

            for (let i = 0; i < 25 && el && el !== document.body; i++) {
                const score = this.scoreAsPostContainer(el);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = el;
                }
                el = el.parentElement;
            }

            // Only return if we have a reasonably good candidate
            return bestScore >= 3 ? bestCandidate : null;
        },

        // Score how likely this element is a post container
        scoreAsPostContainer(el) {
            let score = 0;

            // Check role attribute (legacy Facebook)
            if (el.getAttribute('role') === 'article') score += 5;

            // Check for common post indicators
            const text = el.innerText || '';
            const textLength = text.length;

            // Good text length for a post (100-10000 chars)
            if (textLength > 100 && textLength < 10000) score += 2;
            if (textLength > 300) score += 1;

            // Has reasonable height
            const rect = el.getBoundingClientRect();
            if (rect.height > 150 && rect.height < 2000) score += 1;

            // Contains typical post elements
            if (el.querySelector('a[href*="/posts/"], a[href*="/photo"], a[href*="/reel"]')) score += 2;
            if (el.querySelector('img')) score += 1;
            if (el.querySelector('[role="button"]')) score += 1;

            // Contains timestamp-like patterns
            if (text.match(/\d+\s*(h|m|d|phút|giờ|ngày|hour|minute|day)/i)) score += 2;

            // Reddit specific
            if (this.platform === 'reddit.com') {
                if (el.tagName === 'SHREDDIT-POST') score += 5;
                if (el.getAttribute('data-testid') === 'post-container') score += 5;
            }

            return score;
        },

        extractPostContent(postElement) {
            if (!postElement) return null;

            const textWalker = document.createTreeWalker(
                postElement,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;
                        if (parent.closest('script, style, noscript, [aria-hidden="true"]'))
                            return NodeFilter.FILTER_REJECT;
                        const text = node.textContent;
                        if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            let fullText = '';
            while (textWalker.nextNode()) {
                fullText += textWalker.currentNode.textContent + ' ';
            }

            const cleanText = fullText.replace(/\s+/g, ' ').trim();
            if (!cleanText || cleanText.length < 50) return null; // Need at least 50 chars

            return {
                text: cleanText.slice(0, 8000),
                url: window.location.href,
                title: document.title,
                domain: this.platform,
                source: 'auto_focus_post',
                postId: postElement.getAttribute('aria-posinset')
                    || postElement.id
                    || `post_${Date.now()}`
            };
        },

        update() {
            const post = this.detectFocusedPost();
            this.cachedContent = post ? this.extractPostContent(post) : null;
            console.log('[ATOM] PostFocusObserver.update():', this.cachedContent ? 'Found post ✓' : 'No post');
            return this.cachedContent;
        }
    };

    console.log('[ATOM] PostFocusObserver initialized (sync) for:', host);
})();

