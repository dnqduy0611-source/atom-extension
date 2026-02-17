// services/command_router.js
// AI Command Router — parses [ACTION:CMD:params] from AI responses,
// routes to registered handlers, supports undo.
// Phase 0: Foundation (no user-visible changes, behind feature flag)

(function () {
    'use strict';

    let enabled = false;
    const handlers = new Map();
    const undoHandlers = new Map();

    function msg(key, fallback) {
        try {
            const r = chrome.i18n.getMessage(key);
            if (r) return r;
        } catch { /* ignore */ }
        return fallback;
    }

    /**
     * Parse AI response text for [ACTION:CMD] or [ACTION:CMD:{...json...}]
     * Uses brace-counting to correctly extract nested JSON (arrays, objects).
     * Returns { command, params, cleanText } or null
     */
    function parseResponse(aiText) {
        if (!enabled || !aiText) return null;

        // Find [ACTION:COMMAND_NAME marker
        const marker = /\[ACTION:(\w+)/;
        const markerMatch = aiText.match(marker);
        if (!markerMatch) return null;

        const command = markerMatch[1];
        const afterCmd = markerMatch.index + markerMatch[0].length;
        let params = {};
        let tagEnd = -1;

        if (aiText[afterCmd] === ']') {
            // No params: [ACTION:CMD]
            tagEnd = afterCmd + 1;
        } else if (aiText[afterCmd] === ':' && aiText[afterCmd + 1] === '{') {
            // Has JSON params: [ACTION:CMD:{...}]
            // Brace-count to find matching close
            var jsonStart = afterCmd + 1;
            var depth = 0;
            var inString = false;
            var escape = false;
            for (var i = jsonStart; i < aiText.length; i++) {
                var ch = aiText[i];
                if (escape) { escape = false; continue; }
                if (ch === '\\' && inString) { escape = true; continue; }
                if (ch === '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch === '{' || ch === '[') depth++;
                else if (ch === '}' || ch === ']') {
                    depth--;
                    if (depth === 0) {
                        // ch should be '}', next should be ']'
                        var jsonStr = aiText.slice(jsonStart, i + 1);
                        try {
                            params = JSON.parse(jsonStr);
                        } catch (e) {
                            console.warn('[CommandRouter] Malformed JSON in action tag:', jsonStr);
                            return null;
                        }
                        tagEnd = (aiText[i + 1] === ']') ? i + 2 : i + 1;
                        break;
                    }
                }
            }
            if (tagEnd === -1) return null; // unclosed JSON
        } else {
            return null; // unexpected char after command name
        }

        var fullTag = aiText.slice(markerMatch.index, tagEnd);
        return {
            command: command,
            params: params,
            cleanText: aiText.replace(fullTag, '').trim()
        };
    }

    /**
     * Execute a registered handler for the given command.
     * Returns { success, message, data } or null.
     */
    async function execute(command, params) {
        if (!enabled) return null;

        const handler = handlers.get(command);
        if (!handler) {
            console.warn('[CommandRouter] Unknown command:', command);
            return {
                success: false,
                message: msg('cmd_unknown', 'Mình chưa hiểu ý bạn.')
            };
        }

        try {
            return await handler(params || {});
        } catch (err) {
            console.error('[CommandRouter] Execute error:', command, err);
            return {
                success: false,
                message: msg('cmd_error', 'Có lỗi xảy ra, thử lại nhé!')
            };
        }
    }

    /**
     * Register a command handler and optional undo handler.
     */
    function register(command, handler, undoHandler) {
        handlers.set(command, handler);
        if (undoHandler) undoHandlers.set(command, undoHandler);
    }

    /**
     * Execute undo for a previously executed command.
     * @returns {boolean} true if undo succeeded
     */
    async function undo(command, data) {
        const fn = undoHandlers.get(command);
        if (!fn) return false;
        try {
            await fn(data);
            return true;
        } catch (err) {
            console.error('[CommandRouter] Undo error:', command, err);
            return false;
        }
    }

    function setEnabled(flag) { enabled = !!flag; }
    function isEnabled() { return enabled; }
    function hasCommand(cmd) { return handlers.has(cmd); }
    function canUndo(cmd) { return undoHandlers.has(cmd); }

    window.CommandRouter = {
        parseResponse,
        execute,
        register,
        undo,
        setEnabled,
        isEnabled,
        hasCommand,
        canUndo
    };
})();
