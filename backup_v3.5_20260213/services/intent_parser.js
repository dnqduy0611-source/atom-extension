// services/intent_parser.js
// Client-side deterministic intent parser (Tier 1).
// Matches user text against known command patterns.
// Works offline, instant (< 10ms), no AI dependency.
// Phase 0: Foundation

(function () {
    'use strict';

    function msg(key, fallback) {
        try { const r = chrome.i18n.getMessage(key); if (r) return r; } catch { /* */ }
        return fallback;
    }

    // ----- Intent definitions -----
    // Each intent: { patterns[], extractParams(match), validate(params), confirm, undoable }

    const INTENTS = {
        FOCUS_START: {
            patterns: [
                /(?:bật|bắt đầu|start)\s*(?:pomodoro|focus|tập trung)\s*(\d+)?\s*(?:phút|p|minutes?|m)?/i,
                /(?:focus|tập trung)\s*(\d+)\s*(?:phút|p|minutes?|m)/i,
                /(\d+)\s*(?:phút|p|minutes?|m)\s*(?:focus|tập trung|pomodoro)/i
            ],
            extractParams: function (match) {
                return { minutes: parseInt(match[1], 10) || 25 };
            },
            validate: function (params) {
                if (params.minutes < 1) return { valid: false, hintKey: 'cmd_focus_min_too_low' };
                if (params.minutes > 180) return { valid: false, hintKey: 'cmd_focus_min_too_high' };
                return { valid: true };
            },
            confirm: true,
            undoable: true
        },

        FOCUS_STOP: {
            patterns: [
                /(?:dừng|tắt|stop|end|kết thúc)\s*(?:pomodoro|focus|timer|tập trung)/i,
                /(?:dừng|stop)\s*(?:lại|timer)?$/i,
                /(?:tắt|off)\s*(?:timer|pomodoro)?$/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: true,
            undoable: false
        },

        FOCUS_PAUSE: {
            patterns: [
                /(?:tạm dừng|pause)\s*(?:pomodoro|focus|timer|tập trung)?/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        OPEN_NOTES: {
            patterns: [
                /(?:mở|open|xem)\s*(?:ghi chú|notes?|memory|bộ nhớ)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        OPEN_DIARY: {
            patterns: [
                /(?:mở|open|xem)\s*(?:nhật ký|diary|journal)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        OPEN_SAVED: {
            patterns: [
                /(?:mở|open|xem)\s*(?:ghi chú đã lưu|saved|highlights?|đã lưu)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        OPEN_SETTINGS: {
            patterns: [
                /(?:mở|open)\s*(?:cài đặt|settings?|tùy chỉnh|options?)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        EXPORT_SAVED: {
            patterns: [
                /(?:xuất|export|save)\s*(?:tất cả\s*)?(?:ghi chú đã lưu|highlights?|saved)/i,
                /(?:xuất|export)\s*(?:srq|queue|saved)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        DIARY_ADD: {
            patterns: [
                /(?:ghi|viết|thêm|add)\s*(?:nhật ký|diary|journal)[:\s]*(.+)/i,
                /(?:diary|journal|nhật ký)[:\s]+(.+)/i,
                /(?:hôm nay|today)\s+(?:tôi|mình|I)\s+(.+)/i
            ],
            extractParams: function (match) {
                return { content: (match[1] || '').trim() };
            },
            validate: function (params) {
                if (!params.content) return { valid: false, hintKey: 'cmd_diary_empty' };
                return { valid: true };
            },
            confirm: false,
            undoable: true
        },

        DIARY_SUMMARY: {
            patterns: [
                /(?:tổng kết|tóm tắt|summary)\s+(?:nhật ký|diary|journal)\s*(hôm nay|tuần|tháng|today|week|month)?/i,
                /(?:nhật ký|diary|journal)\s+(?:tổng kết|tóm tắt|summary)\s*(hôm nay|tuần|tháng|today|week|month)?/i
            ],
            extractParams: function (match) {
                var raw = (match[1] || '').toLowerCase().trim();
                var periodMap = { 'hôm nay': 'today', 'tuần': 'week', 'tháng': 'month' };
                return { period: periodMap[raw] || raw || 'week' };
            },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: false
        },

        SAVE_TO_NOTES: {
            patterns: [
                /(?:lưu|save)\s*(?:vào\s*)?(?:ghi chú|notes?|memory|bộ nhớ)/i,
                /(?:ghi chú|note)\s*(?:lại|this|này)/i,
                /(?:save|lưu)\s+(?:this|này|đoạn này)/i
            ],
            extractParams: function () { return {}; },
            validate: function () { return { valid: true }; },
            confirm: false,
            undoable: true
        }
    };

    /**
     * Attempt to match user text to a known intent.
     * @param {string} text - raw user input
     * @returns {{ command, params, confirm, undoable } | { error:true, hintKey, originalCommand } | null}
     *          null means no match — forward to AI.
     */
    function parse(text) {
        if (!text) return null;
        var trimmed = text.trim();
        if (!trimmed) return null;

        var commands = Object.keys(INTENTS);
        for (var ci = 0; ci < commands.length; ci++) {
            var command = commands[ci];
            var config = INTENTS[command];
            for (var pi = 0; pi < config.patterns.length; pi++) {
                var match = trimmed.match(config.patterns[pi]);
                if (match) {
                    var params = config.extractParams(match);
                    var validation = config.validate(params);

                    if (!validation.valid) {
                        return {
                            command: null,
                            error: true,
                            hintKey: validation.hintKey,
                            originalCommand: command
                        };
                    }

                    return {
                        command: command,
                        params: params,
                        confirm: config.confirm,
                        undoable: config.undoable
                    };
                }
            }
        }

        return null; // No match → forward to AI
    }

    window.IntentParser = { parse: parse };
})();
