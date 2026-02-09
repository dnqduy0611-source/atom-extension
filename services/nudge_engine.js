// services/nudge_engine.js
// Smart nudge detection engine

(function () {
    'use strict';

    let contextInvalidated = false;

    function isExtensionContextValid() {
        if (contextInvalidated) return false;
        try {
            return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
        } catch (e) {
            contextInvalidated = true;
            return false;
        }
    }

    const NUDGE_CONFIG = {
        fastScrollThreshold: 1800, // px/s
        fastScrollCountThreshold: 5,
        passiveReadingMs: 5 * 60 * 1000,
        nudgeCooldownMs: 2 * 60 * 1000,
        maxNudgesPerSession: 5,
        completionThreshold: 0.95
    };

    // Helper to get i18n message with fallback
    function getMessage(key, fallback) {
        if (!isExtensionContextValid()) return fallback;
        try {
            if (chrome?.i18n?.getMessage) {
                return chrome.i18n.getMessage(key) || fallback;
            }
        } catch (e) {
            contextInvalidated = true;
            return fallback;
        }
        return fallback;
    }

    // Nudge type definitions with i18n keys
    const NUDGE_TYPES = {
        fast_scroll: {
            id: 'fast_scroll',
            icon: '⚡',
            titleKey: 'sp_nudge_fast_scroll_title',
            messageKey: 'sp_nudge_fast_scroll_msg',
            get title() { return getMessage(this.titleKey, 'Slow down a bit'); },
            get message() { return getMessage(this.messageKey, 'You are scrolling quickly. Want to pause and capture a key idea?'); },
            actions: [
                { id: 'open_panel', labelKey: 'sp_nudge_action_open_panel', get label() { return getMessage(this.labelKey, 'Open Side Panel'); }, primary: true },
                { id: 'summarize', labelKey: 'sp_action_summarize', get label() { return getMessage(this.labelKey, 'Summarize section'); } },
                { id: 'ask_question', labelKey: 'sp_nudge_action_ask', get label() { return getMessage(this.labelKey, 'Ask a question'); } }
            ]
        },
        passive_reading: {
            id: 'passive_reading',
            icon: '🧠',
            titleKey: 'sp_nudge_passive_title',
            messageKey: 'sp_nudge_passive_msg',
            get title() { return getMessage(this.titleKey, 'Active recall'); },
            get message() { return getMessage(this.messageKey, 'Try to recall the main point you just read.'); },
            actions: [
                { id: 'open_panel', labelKey: 'sp_nudge_action_open_panel', get label() { return getMessage(this.labelKey, 'Open Side Panel'); }, primary: true },
                { id: 'self_check', labelKey: 'sp_nudge_action_self_check', get label() { return getMessage(this.labelKey, 'Quick self-check'); } },
                { id: 'create_insight', labelKey: 'sp_nudge_action_insight', get label() { return getMessage(this.labelKey, 'Create insight'); } }
            ]
        },
        section_end: {
            id: 'section_end',
            icon: '📌',
            titleKey: 'sp_nudge_section_title',
            messageKey: 'sp_nudge_section_msg',
            get title() { return getMessage(this.titleKey, 'Section checkpoint'); },
            get message() { return getMessage(this.messageKey, 'You reached the end of a section. Capture 1 takeaway?'); },
            actions: [
                { id: 'open_panel', labelKey: 'sp_nudge_action_open_panel', get label() { return getMessage(this.labelKey, 'Open Side Panel'); }, primary: true },
                { id: 'key_point', labelKey: 'sp_nudge_action_key_point', get label() { return getMessage(this.labelKey, 'Key point'); } },
                { id: 'ask_question', labelKey: 'sp_nudge_action_ask', get label() { return getMessage(this.labelKey, 'Ask a question'); } }
            ]
        },
        completion: {
            id: 'completion',
            icon: '🏁',
            titleKey: 'sp_nudge_completion_title',
            messageKey: 'sp_nudge_completion_msg',
            get title() { return getMessage(this.titleKey, 'Wrap-up'); },
            get message() { return getMessage(this.messageKey, 'You are near the end. Want a quick summary or next steps?'); },
            actions: [
                { id: 'open_panel', labelKey: 'sp_nudge_action_open_panel', get label() { return getMessage(this.labelKey, 'Open Side Panel'); }, primary: true },
                { id: 'summarize', labelKey: 'sp_action_summarize', get label() { return getMessage(this.labelKey, 'Summarize'); } },
                { id: 'next_steps', labelKey: 'sp_nudge_action_next_steps', get label() { return getMessage(this.labelKey, 'Next steps'); } }
            ]
        }
    };

    class NudgeEngine {
        constructor() {
            this.lastScrollTime = 0;
            this.lastScrollY = 0;
            this.fastScrollCount = 0;
            this.lastHighlightTime = Date.now();
            this.lastNudgeTime = 0;
            this.nudgeCount = 0;
            this.completionShown = false;
        }

        recordScroll({ scrollY, time }) {
            if (!Number.isFinite(scrollY) || !Number.isFinite(time)) return;

            if (this.lastScrollTime) {
                const dt = Math.max(1, time - this.lastScrollTime);
                const dy = Math.abs(scrollY - this.lastScrollY);
                const speed = (dy / dt) * 1000;

                if (speed >= NUDGE_CONFIG.fastScrollThreshold) {
                    this.fastScrollCount += 1;
                } else if (this.fastScrollCount > 0) {
                    this.fastScrollCount = Math.max(0, this.fastScrollCount - 1);
                }
            }

            this.lastScrollTime = time;
            this.lastScrollY = scrollY;
        }

        recordHighlight() {
            this.lastHighlightTime = Date.now();
            this.fastScrollCount = 0;
        }

        canShowNudge() {
            if (this.nudgeCount >= NUDGE_CONFIG.maxNudgesPerSession) {
                return false;
            }
            if (!this.lastNudgeTime) return true;
            return Date.now() - this.lastNudgeTime > NUDGE_CONFIG.nudgeCooldownMs;
        }

        checkFastScroll() {
            if (!this.canShowNudge()) return null;
            if (this.fastScrollCount < NUDGE_CONFIG.fastScrollCountThreshold) return null;
            if (Date.now() - this.lastHighlightTime < 2 * 60 * 1000) return null;
            const base = NUDGE_TYPES.fast_scroll;
            return {
                id: base.id,
                icon: base.icon,
                title: base.title,
                message: base.message,
                actions: base.actions.map(a => ({ id: a.id, label: a.label, primary: a.primary }))
            };
        }

        checkPassiveReading() {
            if (!this.canShowNudge()) return null;
            const idleTime = Date.now() - this.lastHighlightTime;
            if (idleTime < NUDGE_CONFIG.passiveReadingMs) return null;
            const base = NUDGE_TYPES.passive_reading;
            return {
                id: base.id,
                icon: base.icon,
                title: base.title,
                message: base.message,
                actions: base.actions.map(a => ({ id: a.id, label: a.label, primary: a.primary }))
            };
        }

        checkSectionEnd(sectionTitle) {
            if (!this.canShowNudge()) return null;
            const base = NUDGE_TYPES.section_end;
            const nudge = {
                id: base.id,
                icon: base.icon,
                title: base.title,
                message: base.message,
                actions: base.actions.map(a => ({ id: a.id, label: a.label, primary: a.primary }))
            };
            if (sectionTitle) {
                // Use i18n placeholder $1 for section title
                const template = getMessage('sp_nudge_section_msg', 'You reached "$1". Capture 1 takeaway?');
                nudge.message = template.replace('$1', sectionTitle);
                nudge.triggerData = { sectionTitle };
            }
            return nudge;
        }

        checkCompletion(progress) {
            if (!this.canShowNudge()) return null;
            if (this.completionShown) return null;
            if (!Number.isFinite(progress) || progress < NUDGE_CONFIG.completionThreshold) return null;
            this.completionShown = true;
            const base = NUDGE_TYPES.completion;
            return {
                id: base.id,
                icon: base.icon,
                title: base.title,
                message: base.message,
                actions: base.actions.map(a => ({ id: a.id, label: a.label, primary: a.primary }))
            };
        }

        recordNudgeShown() {
            this.lastNudgeTime = Date.now();
            this.nudgeCount += 1;
        }

        reset() {
            this.lastScrollTime = 0;
            this.lastScrollY = 0;
            this.fastScrollCount = 0;
            this.lastHighlightTime = Date.now();
            this.lastNudgeTime = 0;
            this.nudgeCount = 0;
            this.completionShown = false;
        }
    }

    window.NudgeEngine = {
        NUDGE_CONFIG,
        NUDGE_TYPES,
        create: () => new NudgeEngine()
    };
})();
