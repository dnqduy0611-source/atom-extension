/**
 * SRQ Styles - Smart Research Queue UI styles
 * Injected via JS to follow existing pattern (micro_closure.css.js)
 */
(function () {
    'use strict';

    if (document.getElementById('atom-srq-styles')) return;

    const style = document.createElement('style');
    style.id = 'atom-srq-styles';
    style.textContent = `
        /* ===========================
           SRQ Widget (Sidepanel)
           =========================== */

        .srq-widget {
            margin: 8px 0;
            border-radius: 12px;
            background: var(--surface, rgba(255,255,255,0.04));
            border: 1px solid var(--border, rgba(255,255,255,0.08));
            overflow: hidden;
            transition: all 0.2s ease-out;
        }

        .srq-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            cursor: pointer;
            user-select: none;
            transition: background 0.15s;
        }

        .srq-header:hover {
            background: var(--srq-surface-soft, rgba(255,255,255,0.05));
        }

        .srq-icon {
            font-size: 14px;
            flex-shrink: 0;
        }

        .srq-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-primary, #e5e5e5);
            flex: 1;
        }

        .srq-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            border-radius: 10px;
            background: var(--srq-accent-primary, #10B981);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
        }

        .srq-toggle {
            background: none;
            border: none;
            color: var(--text-secondary, #a3a3a3);
            font-size: 10px;
            cursor: pointer;
            padding: 2px;
            transition: transform 0.2s;
        }

        .srq-widget.expanded .srq-toggle {
            transform: rotate(180deg);
        }

        /* Batch list */
        .srq-batches {
            display: none;
            max-height: 300px;
            overflow-y: auto;
            padding: 0 8px 8px;
        }

        .srq-widget.expanded .srq-batches {
            display: block;
        }

        /* Single batch card */
        .srq-batch {
            background: var(--srq-surface-subtle, rgba(255,255,255,0.03));
            border: 1px solid var(--srq-border-subtle, rgba(255,255,255,0.06));
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 6px;
            transition: border-color 0.15s;
        }

        .srq-batch:hover {
            border-color: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.3);
        }

        .srq-batch:last-child {
            margin-bottom: 0;
        }

        /* ===========================
           Pagination (Wave 3 P2)
           =========================== */

        .srq-pagination {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 0 4px;
            border-top: 1px solid var(--srq-border-subtle, rgba(255,255,255,0.06));
            margin-top: 8px;
        }

        .srq-pagination-btn {
            min-width: 32px;
            padding: 4px 8px;
            font-size: 12px;
        }

        .srq-pagination-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        .srq-pagination-info {
            font-size: 10px;
            color: var(--text-secondary, #a3a3a3);
            min-width: 80px;
            text-align: center;
        }

        .srq-batch-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }

        .srq-batch-label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-primary, #e5e5e5);
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .srq-batch-count {
            font-size: 11px;
            color: var(--text-secondary, #a3a3a3);
            flex-shrink: 0;
        }

        /* Reading mode pills */
        .srq-batch-modes {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            margin-bottom: 6px;
        }

        .srq-mode-pill {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 500;
            line-height: 16px;
        }

        .srq-mode-deep {
            background: var(--srq-mode-deep-bg, rgba(59, 130, 246, 0.15));
            color: var(--srq-mode-deep-text, #60A5FA);
        }

        .srq-mode-skim {
            background: var(--srq-mode-skim-bg, rgba(156, 163, 175, 0.15));
            color: var(--srq-mode-skim-text, #9CA3AF);
        }

        .srq-mode-reference {
            background: var(--srq-mode-ref-bg, rgba(245, 158, 11, 0.15));
            color: var(--srq-mode-ref-text, #FBBF24);
        }

        .srq-mode-reread {
            background: var(--srq-mode-reread-bg, rgba(139, 92, 246, 0.15));
            color: var(--srq-mode-reread-text, #A78BFA);
        }

        /* Batch meta (notebook suggestion) */
        .srq-batch-meta {
            font-size: 11px;
            color: var(--text-secondary, #a3a3a3);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .srq-batch-meta .srq-arrow {
            color: var(--srq-accent-primary, #10B981);
        }

        /* Action buttons */
        .srq-batch-actions {
            display: flex;
            gap: 6px;
        }

        .srq-btn {
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid var(--srq-border-strong, rgba(255,255,255,0.1));
            background: var(--srq-surface-soft, rgba(255,255,255,0.05));
            color: var(--text-primary, #e5e5e5);
            cursor: pointer;
            transition: all 0.15s;
            line-height: 1.4;
        }

        .srq-btn:hover {
            background: rgba(255,255,255,0.1);
        }

        .srq-btn-export {
            background: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.15);
            border-color: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.3);
            color: var(--srq-accent-success, #34D399);
        }

        .srq-btn-export:hover {
            background: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.25);
        }

        .srq-btn-dismiss {
            background: none;
            border: none;
            color: var(--text-secondary, #a3a3a3);
            padding: 4px 6px;
            font-size: 12px;
        }

        .srq-btn-dismiss:hover {
            color: var(--srq-accent-error, #EF4444);
        }

        /* ===========================
           Review Modal
           =========================== */

        .srq-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: srqFadeIn 0.15s ease-out;
        }

        @keyframes srqFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .srq-modal {
            background: var(--bg-primary, #1a1a1a);
            border: 1px solid var(--srq-border-strong, rgba(255,255,255,0.1));
            border-radius: 16px;
            width: 90%;
            max-width: 420px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: srqSlideUp 0.2s ease-out;
        }

        @keyframes srqSlideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .srq-modal-header {
            padding: 16px;
            border-bottom: 1px solid var(--srq-border-subtle, rgba(255,255,255,0.06));
            position: sticky;
            top: 0;
            z-index: 10;
            background: var(--bg-primary, #1a1a1a);
        }

        .srq-modal-header.scrolled {
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .srq-modal-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-primary, #e5e5e5);
            margin: 0 0 4px 0;
        }

        .srq-modal-subtitle {
            font-size: 11px;
            color: var(--text-secondary, #a3a3a3);
        }

        .srq-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
        }

        /* Review card */
        .srq-review-card {
            background: var(--srq-surface-subtle, rgba(255,255,255,0.03));
            border: 1px solid var(--srq-border-strong, rgba(255,255,255,0.1));
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 8px;
            transition: border-color 0.15s;
        }

        .srq-review-card:last-child {
            margin-bottom: 0;
        }

        .srq-review-card.selected {
            border-color: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.4);
            background: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.05);
        }

        .srq-review-text {
            font-size: 12px;
            color: var(--text-primary, #e5e5e5);
            line-height: 1.5;
            margin-bottom: 6px;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .srq-review-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            color: var(--text-secondary, #a3a3a3);
            margin-bottom: 6px;
        }

        .srq-review-meta .srq-dot {
            width: 3px;
            height: 3px;
            border-radius: 50%;
            background: var(--text-secondary, #a3a3a3);
        }

        .srq-review-insight {
            font-size: 11px;
            color: var(--srq-accent-warning, #FBBF24);
            margin-bottom: 6px;
            padding-left: 8px;
            border-left: 2px solid rgba(var(--srq-accent-warning-rgb, 251, 191, 36), 0.3);
        }

        .srq-review-related {
            font-size: 10px;
            color: var(--srq-accent-info, #60A5FA);
            margin-bottom: 6px;
        }

        .srq-pii-warning {
            font-size: 10px;
            color: var(--srq-accent-error, #EF4444);
            background: rgba(var(--srq-accent-error-rgb, 239, 68, 68), 0.1);
            padding: 4px 8px;
            border-radius: 4px;
            margin-bottom: 6px;
        }

        .srq-review-actions {
            display: flex;
            gap: 6px;
        }

        /* Modal footer */
        .srq-modal-footer {
            padding: 12px 16px;
            border-top: 1px solid var(--srq-border-subtle, rgba(255,255,255,0.06));
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .srq-modal-footer .srq-target {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--text-secondary, #a3a3a3);
        }

        .srq-modal-footer .srq-target select {
            background: var(--srq-surface-soft, rgba(255,255,255,0.05));
            border: 1px solid var(--srq-border-strong, rgba(255,255,255,0.1));
            color: var(--text-primary, #e5e5e5);
            font-size: 11px;
            padding: 3px 6px;
            border-radius: 4px;
            max-width: 120px;
        }

        .srq-btn-primary {
            background: var(--srq-accent-primary, #10B981);
            border: none;
            color: #fff;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
        }

        .srq-btn-primary:hover {
            background: color-mix(in srgb, var(--srq-accent-primary, #10B981) 85%, black);
        }

        .srq-btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .srq-btn-secondary {
            background: none;
            border: 1px solid var(--srq-border-strong, rgba(255,255,255,0.1));
            color: var(--text-secondary, #a3a3a3);
            font-size: 12px;
            padding: 6px 12px;
            border-radius: 8px;
            cursor: pointer;
        }

        .srq-btn-secondary:hover {
            background: var(--srq-surface-soft, rgba(255,255,255,0.05));
        }

        /* ===========================
           NLM Page Banner
           =========================== */

        .atom-srq-nlm-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 99999;
            background: linear-gradient(135deg, #065F46 0%, #064E3B 100%);
            color: #D1FAE5;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: srqBannerSlide 0.3s ease-out;
        }

        @keyframes srqBannerSlide {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }

        .atom-srq-nlm-banner .srq-banner-text {
            flex: 1;
        }

        .atom-srq-nlm-banner button {
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: background 0.15s;
            white-space: nowrap;
        }

        .atom-srq-nlm-banner button:hover {
            background: rgba(255,255,255,0.25);
        }

        .atom-srq-nlm-banner .srq-banner-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.6);
            font-size: 16px;
            padding: 4px;
            min-width: auto;
        }

        .atom-srq-nlm-banner .srq-banner-close:hover {
            color: #fff;
        }

        /* ===========================
           State Components (Wave 1 P0)
           =========================== */

        .srq-state-loading,
        .srq-state-empty,
        .srq-state-error {
            margin: 8px 0;
            border-radius: 12px;
            background: var(--surface, rgba(255,255,255,0.04));
            border: 1px solid var(--border, rgba(255,255,255,0.08));
            padding: 16px;
        }

        .srq-state-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            text-align: center;
        }

        .srq-state-icon {
            font-size: 24px;
            opacity: 0.6;
        }

        .srq-state-text {
            font-size: 12px;
            color: var(--text-secondary, #a3a3a3);
            line-height: 1.4;
        }

        .srq-retry-btn {
            margin-top: 4px;
            font-size: 11px;
            padding: 4px 12px;
            border-radius: 6px;
            border: 1px solid rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.3);
            background: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.15);
            color: var(--srq-accent-success, #34D399);
            cursor: pointer;
            transition: all 0.15s;
        }

        .srq-retry-btn:hover {
            background: rgba(var(--srq-accent-primary-rgb, 16, 185, 129), 0.25);
        }

        /* ===========================
           Density Mode: Compact (Wave 3 P2)
           =========================== */

        .srq-widget.srq-density-compact .srq-header {
            padding: 8px 10px;
            gap: 6px;
        }

        .srq-widget.srq-density-compact .srq-batches {
            padding: 0 6px 6px;
        }

        .srq-widget.srq-density-compact .srq-batch {
            padding: 8px;
            margin-bottom: 4px;
        }

        .srq-widget.srq-density-compact .srq-batch-header {
            gap: 4px;
            margin-bottom: 3px;
        }

        .srq-widget.srq-density-compact .srq-batch-modes {
            margin-bottom: 4px;
        }

        .srq-widget.srq-density-compact .srq-mode-pill {
            font-size: 9px;
            line-height: 14px;
        }

        .srq-widget.srq-density-compact .srq-batch-meta {
            margin-bottom: 6px;
        }

        .srq-widget.srq-density-compact .srq-batch-actions {
            gap: 4px;
        }

        .srq-widget.srq-density-compact .srq-btn {
            padding: 3px 8px;
        }

        .srq-widget.srq-density-compact .srq-pagination {
            padding: 8px 0 3px;
            margin-top: 6px;
        }

        .srq-modal.srq-density-compact .srq-modal-header {
            padding: 12px;
        }

        .srq-modal.srq-density-compact .srq-modal-body {
            padding: 10px 12px;
        }

        .srq-modal.srq-density-compact .srq-modal-footer {
            padding: 10px 12px;
        }

        .srq-modal.srq-density-compact .srq-review-card {
            padding: 10px;
            margin-bottom: 6px;
        }

        .srq-modal.srq-density-compact .srq-review-text {
            line-height: 1.4;
            margin-bottom: 4px;
        }

        .srq-modal.srq-density-compact .srq-review-meta {
            margin-bottom: 4px;
        }

        .srq-modal.srq-density-compact .srq-btn-primary {
            padding: 5px 12px;
        }

        .srq-modal.srq-density-compact .srq-btn-secondary {
            padding: 5px 10px;
        }

        /* ===========================
           Utility
           =========================== */

        .srq-hidden { display: none !important; }

        .srq-loading {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255,255,255,0.2);
            border-top-color: var(--srq-accent-primary, #10B981);
            border-radius: 50%;
            animation: srqSpin 0.6s linear infinite;
        }

        @keyframes srqSpin {
            to { transform: rotate(360deg); }
        }
    `;

    document.head.appendChild(style);
})();
