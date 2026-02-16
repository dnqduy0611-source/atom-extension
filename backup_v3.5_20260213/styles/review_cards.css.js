/**
 * Review Cards Styles — AI Flashcard UI
 * Injected via JS following srq.css.js pattern
 */
(function () {
    'use strict';

    if (document.getElementById('atom-review-cards-styles')) return;

    const style = document.createElement('style');
    style.id = 'atom-review-cards-styles';
    style.textContent = `

        /* ===========================
           Review Cards Container
           =========================== */

        .rc-root {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            padding: 12px;
            box-sizing: border-box;
            overflow: hidden;
        }

        /* ===========================
           Header & Progress
           =========================== */

        .rc-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
            flex-shrink: 0;
        }

        .rc-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--foreground, #e5e5e5);
        }

        .rc-counter {
            font-size: 12px;
            color: var(--muted, #a3a3a3);
            font-weight: 500;
        }

        .rc-progress-bar {
            height: 3px;
            background: var(--border, rgba(255,255,255,0.08));
            border-radius: 2px;
            margin-bottom: 12px;
            overflow: hidden;
            flex-shrink: 0;
        }

        .rc-progress-fill {
            height: 100%;
            background: var(--primary, #10B981);
            border-radius: 2px;
            transition: width 0.3s ease;
            width: 0%;
        }

        /* ===========================
           Card Container — NO flip, use show/hide
           =========================== */

        .rc-card-container {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }

        .rc-card {
            width: 100%;
            cursor: pointer;
            border-radius: 12px;
            border: 1px solid var(--border, rgba(255,255,255,0.08));
            background: var(--surface, rgba(255,255,255,0.04));
            padding: 16px;
            box-sizing: border-box;
            transition: box-shadow 0.2s ease;
        }

        .rc-card:hover {
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }

        /* Front face — visible by default */
        .rc-card-front {
            display: flex;
            flex-direction: column;
        }

        /* Back face — hidden by default */
        .rc-card-back {
            display: none;
            flex-direction: column;
        }

        /* When flipped: hide front, show back */
        .rc-card.flipped .rc-card-front {
            display: none;
        }
        .rc-card.flipped .rc-card-back {
            display: flex;
        }

        /* Flip transition indicator */
        .rc-card.flipped {
            border-color: var(--primary, #10B981);
            background: rgba(16, 185, 129, 0.04);
        }

        /* ===========================
           Type Badges
           =========================== */

        .rc-type-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            width: fit-content;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .rc-type-recall {
            background: rgba(16, 185, 129, 0.15);
            color: #10B981;
        }

        .rc-type-concept {
            background: rgba(59, 130, 246, 0.15);
            color: #3B82F6;
        }

        .rc-type-connect {
            background: rgba(139, 92, 246, 0.15);
            color: #8B5CF6;
        }

        /* ===========================
           Card Content
           =========================== */

        .rc-card-question {
            font-size: 13px;
            font-weight: 500;
            color: var(--foreground, #e5e5e5);
            line-height: 1.55;
        }

        .rc-card-hint {
            font-size: 11px;
            color: var(--muted, #a3a3a3);
            margin-top: 8px;
            font-style: italic;
        }

        .rc-card-flip-hint {
            font-size: 11px;
            color: var(--muted, #a3a3a3);
            text-align: center;
            margin-top: 12px;
            opacity: 0.7;
        }

        .rc-card-answer {
            font-size: 13px;
            color: var(--foreground, #e5e5e5);
            line-height: 1.55;
        }

        .rc-card-source {
            font-size: 10px;
            color: var(--muted, #a3a3a3);
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid var(--border, rgba(255,255,255,0.06));
        }

        .rc-card-source-title {
            font-weight: 500;
            color: var(--foreground, #e5e5e5);
        }

        /* Connect card: two highlights */
        .rc-connect-highlight {
            background: var(--surface, rgba(255,255,255,0.04));
            border-left: 3px solid #8B5CF6;
            padding: 8px 10px;
            border-radius: 0 6px 6px 0;
            margin-bottom: 8px;
            font-size: 12px;
            color: var(--foreground, #e5e5e5);
            line-height: 1.5;
        }

        .rc-connect-label {
            font-size: 10px;
            font-weight: 600;
            color: #8B5CF6;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        /* ===========================
           Navigation
           =========================== */

        .rc-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--border, rgba(255,255,255,0.06));
            flex-shrink: 0;
        }

        .rc-nav-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 7px 14px;
            border-radius: 8px;
            border: 1px solid var(--border, rgba(255,255,255,0.1));
            background: var(--surface, rgba(255,255,255,0.04));
            color: var(--foreground, #e5e5e5);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .rc-nav-btn:hover {
            background: var(--primary, #10B981);
            color: #fff;
            border-color: var(--primary, #10B981);
        }

        .rc-nav-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }

        .rc-nav-btn:disabled:hover {
            background: var(--surface, rgba(255,255,255,0.04));
            color: var(--foreground, #e5e5e5);
            border-color: var(--border, rgba(255,255,255,0.1));
        }

        .rc-refresh-btn {
            padding: 5px 10px;
            border-radius: 6px;
            border: 1px solid var(--border, rgba(255,255,255,0.1));
            background: none;
            color: var(--muted, #a3a3a3);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .rc-refresh-btn:hover {
            color: var(--primary, #10B981);
            border-color: var(--primary, #10B981);
        }

        /* ===========================
           Empty State
           =========================== */

        .rc-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px 20px;
            flex: 1;
            gap: 12px;
        }

        .rc-empty-icon {
            width: 48px;
            height: 48px;
            color: var(--muted, #a3a3a3);
            opacity: 0.5;
        }

        .rc-empty-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--foreground, #e5e5e5);
        }

        .rc-empty-desc {
            font-size: 12px;
            color: var(--muted, #a3a3a3);
            line-height: 1.5;
            max-width: 240px;
        }

        .rc-empty-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 20px;
            border: 1px solid var(--border, rgba(255,255,255,0.1));
            border-radius: 8px;
            background: var(--surface, rgba(255,255,255,0.04));
            color: var(--primary, #10B981);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 4px;
        }

        .rc-empty-btn:hover {
            background: var(--primary, #10B981);
            color: #fff;
            border-color: var(--primary, #10B981);
        }

        /* ===========================
           Loading State
           =========================== */

        .rc-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px 20px;
            flex: 1;
            gap: 16px;
        }

        .rc-loading-text {
            font-size: 12px;
            color: var(--muted, #a3a3a3);
        }

        .rc-skeleton-card {
            width: 100%;
            max-width: 320px;
            height: 160px;
            border-radius: 12px;
            background: linear-gradient(
                90deg,
                var(--surface, rgba(255,255,255,0.04)) 25%,
                rgba(255,255,255,0.08) 50%,
                var(--surface, rgba(255,255,255,0.04)) 75%
            );
            background-size: 200% 100%;
            animation: rcShimmer 1.5s ease infinite;
        }

        @keyframes rcShimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        .rc-spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--border, rgba(255,255,255,0.1));
            border-top-color: var(--primary, #10B981);
            border-radius: 50%;
            animation: rcSpin 0.8s linear infinite;
        }

        @keyframes rcSpin {
            to { transform: rotate(360deg); }
        }

        /* ===========================
           Error State
           =========================== */

        .rc-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px 20px;
            flex: 1;
            gap: 12px;
        }

        .rc-error-icon {
            width: 36px;
            height: 36px;
            color: #EF4444;
            opacity: 0.8;
        }

        .rc-error-text {
            font-size: 13px;
            color: var(--foreground, #e5e5e5);
        }

        .rc-error-detail {
            font-size: 11px;
            color: var(--muted, #a3a3a3);
            max-width: 250px;
        }

        /* ===========================
           Session Complete
           =========================== */

        .rc-done {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px 20px;
            flex: 1;
            gap: 12px;
        }

        .rc-done-icon {
            font-size: 36px;
            line-height: 1;
        }

        .rc-done-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--foreground, #e5e5e5);
        }

        .rc-done-desc {
            font-size: 12px;
            color: var(--muted, #a3a3a3);
        }

        /* ===========================
           Fade-in Animation
           =========================== */

        .rc-fade-in {
            animation: rcFadeIn 0.3s ease;
        }

        @keyframes rcFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* ===========================
           Reduced Motion
           =========================== */

        @media (prefers-reduced-motion: reduce) {
            .rc-skeleton-card {
                animation: none !important;
            }
            .rc-spinner {
                animation: none !important;
            }
            .rc-fade-in {
                animation: none !important;
            }
        }
    `;

    document.head.appendChild(style);
})();
