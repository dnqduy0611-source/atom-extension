/**
 * content/floating_save.js — Lightweight Floating Save Button
 * Silent Brain Phase 1: Rewrite of bridge/nlm_floating_button.js (44KB → ~5KB)
 * 
 * Core flow:
 *   User highlights text → selectionchange event
 *   → text.length >= 20 ? showButton(selection) : hideButton()
 *   → User clicks button → quickSave()
 *   → SRQ_CREATE_CARD message → background.js
 *   → showToast('Saved ✓')
 */

(function () {
    'use strict';

    // === CONFIG ===
    const MIN_SELECTION = 20;
    const BUTTON_Z = 2147483646;
    const SHOW_DELAY = 300;
    const HIDE_DELAY = 200;

    // === STATE ===
    let btn = null;
    let toast = null;
    let showTimer = null;
    let hideTimer = null;
    let currentText = '';

    // === ICON ===
    const SAVE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="10"/><path d="M3.6 9h16.8"/><path d="M3.6 15h16.8"/></svg>`;

    // === STYLES ===
    function injectStyles() {
        if (document.getElementById('atom-fs-styles')) return;
        const el = document.createElement('style');
        el.id = 'atom-fs-styles';
        el.textContent = `
            .atom-fs-btn {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: linear-gradient(135deg, #10B981, #059669);
                color: #fff;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(16,185,129,0.4);
                z-index: ${BUTTON_Z};
                opacity: 0;
                transform: translateY(10px) scale(0.9);
                transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                padding: 0;
            }
            .atom-fs-btn.visible {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
            .atom-fs-btn:hover {
                transform: translateY(-2px) scale(1.05);
                box-shadow: 0 6px 16px rgba(16,185,129,0.6);
            }

            .atom-fs-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(80px);
                background: #050505;
                border: 1px solid rgba(16,185,129,0.4);
                border-radius: 10px;
                padding: 10px 18px;
                color: #10B981;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: ${BUTTON_Z + 1};
                opacity: 0;
                transition: transform 0.3s, opacity 0.3s;
                pointer-events: none;
            }
            .atom-fs-toast.visible {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            .atom-fs-toast.error {
                border-color: #ef4444;
                color: #ef4444;
            }
        `;
        document.head.appendChild(el);
    }

    // === BUTTON ===
    function ensureButton() {
        if (btn) return btn;
        injectStyles();
        btn = document.createElement('div');
        btn.className = 'atom-fs-btn';
        btn.setAttribute('data-atom-ui', 'floating-save');
        btn.innerHTML = SAVE_ICON;

        // Prevent deselection
        btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
        btn.addEventListener('click', handleClick);

        document.body.appendChild(btn);
        return btn;
    }

    function showButton(selection) {
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        ensureButton();

        // Position above selection, centered
        const size = 36;
        let left = rect.left + (rect.width / 2) - (size / 2) + window.scrollX;
        let top = rect.top - size - 10 + window.scrollY;

        // Keep within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - size - 10));
        if (top < window.scrollY + 10) {
            top = rect.bottom + 10 + window.scrollY;
        }

        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;

        requestAnimationFrame(() => btn.classList.add('visible'));

        currentText = selection.toString().trim();
    }

    function hideButton() {
        if (btn) btn.classList.remove('visible');
        currentText = '';
    }

    // === TOAST ===
    function showToast(msg, type = 'success') {
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'atom-fs-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = `atom-fs-toast ${type}`;
        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
        }, 2000);
    }

    // === ACTIONS ===
    async function handleClick(e) {
        e.stopPropagation();
        e.preventDefault();
        if (!currentText) return;

        hideButton();
        try {
            chrome.runtime.sendMessage({
                type: 'SRQ_CREATE_CARD',
                payload: {
                    url: window.location.href,
                    title: document.title,
                    domain: window.location.hostname,
                    selectedText: currentText,
                    command: 'atom-reading-quick-save'
                }
            });
            const savedMsg = chrome.i18n?.getMessage?.('nlm_quick_saved') || 'Saved ✓';
            showToast(savedMsg);
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    // === SELECTION LISTENER ===
    document.addEventListener('selectionchange', () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);

        const selection = window.getSelection();
        const text = selection?.toString().trim() || '';

        if (text.length >= MIN_SELECTION) {
            showTimer = setTimeout(() => showButton(selection), SHOW_DELAY);
        } else {
            hideTimer = setTimeout(hideButton, HIDE_DELAY);
        }
    });

    // Hide on click outside
    document.addEventListener('mousedown', (e) => {
        if (btn && !btn.contains(e.target)) {
            hideButton();
        }
    });

    // Hide on scroll (debounced — only big scrolls)
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (Math.abs(window.scrollY - lastScrollY) > 100) {
            hideButton();
            lastScrollY = window.scrollY;
        }
    }, { passive: true });

})();
