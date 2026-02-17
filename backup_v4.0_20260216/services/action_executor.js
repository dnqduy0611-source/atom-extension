// services/action_executor.js
// ActionExecutor — orchestrates confirm → execute → toast/undo pipeline.
// Bridges IntentParser (Tier 1) and CommandRouter (Tier 2 / AI).
// Phase 0: Foundation

(function () {
    'use strict';

    var toast = null; // ToastManager reference

    function msg(key, fallback) {
        try { var r = chrome.i18n.getMessage(key); if (r) return r; } catch (e) { /* */ }
        return fallback;
    }

    /**
     * Init — wire the toast manager reference.
     * @param {object} toastMgr - window.ToastManager
     */
    function init(toastMgr) {
        toast = toastMgr;
        if (toast && typeof toast.init === 'function') toast.init();
    }

    /**
     * Run a command through the confirm → execute → toast pipeline.
     * @param {string} command  - e.g. 'FOCUS_START'
     * @param {object} params   - e.g. { minutes: 25 }
     * @param {object} [options]
     * @param {boolean} [options.confirm] - require user confirmation
     * @param {boolean} [options.undoable] - show undo toast after success
     * @returns {Promise<{success:boolean, message?:string}>}
     */
    async function run(command, params, options) {
        if (!options) options = {};
        var router = window.CommandRouter;
        if (!router) return { success: false, message: 'Router not available' };

        // Step 1: Confirmation (if required)
        if (options.confirm && toast) {
            var title = msg('cmd_confirm_action', 'Continue?');
            var subtitle = buildConfirmSubtitle(command, params);
            var confirmed = await toast.showConfirm({
                title: title,
                subtitle: subtitle
            });
            if (!confirmed) return { success: false, message: 'Cancelled' };
        }

        // Step 2: Execute via CommandRouter
        var result = await router.execute(command, params);
        if (!result) return { success: false, message: msg('cmd_error', 'Something went wrong.') };

        // Step 3: Toast feedback
        if (toast) {
            if (result.success && options.undoable && router.canUndo(command)) {
                toast.showUndo(
                    result.message || msg('cmd_done', 'Done!'),
                    function () { router.undo(command, result.data); }
                );
            } else if (result.success) {
                toast.showSuccess(result.message || msg('cmd_done', 'Done!'));
            } else {
                toast.showError(result.message || msg('cmd_error', 'Something went wrong.'));
            }
        }

        return result;
    }

    /**
     * Handle an AI response — parse for [ACTION:CMD:params], execute, return clean text.
     * @param {string} aiText - raw AI response
     * @returns {Promise<{cleanText:string, executed:boolean, result?:object}>}
     */
    // Commands that require confirmation even when triggered by AI
    var DESTRUCTIVE_COMMANDS = { FOCUS_STOP: true, FOCUS_START: true };

    async function handleAIResponse(aiText) {
        var router = window.CommandRouter;
        if (!router || !router.isEnabled()) {
            return { cleanText: aiText, executed: false };
        }

        var parsed = router.parseResponse(aiText);
        if (!parsed) {
            return { cleanText: aiText, executed: false };
        }

        var needsConfirm = !!DESTRUCTIVE_COMMANDS[parsed.command];
        var result = await run(parsed.command, parsed.params, {
            confirm: needsConfirm,
            undoable: router.canUndo(parsed.command)
        });

        return {
            cleanText: parsed.cleanText,
            executed: true,
            result: result
        };
    }

    /**
     * Handle a client-side intent match (from IntentParser).
     * @param {object} intentResult - from IntentParser.parse()
     * @returns {Promise<{success:boolean, message?:string}|null>}
     */
    async function handleIntent(intentResult) {
        if (!intentResult) return null;

        // Validation error from parser
        if (intentResult.error) {
            var hint = msg(intentResult.hintKey, 'Invalid input.');
            if (toast) toast.showError(hint);
            return { success: false, message: hint };
        }

        return run(intentResult.command, intentResult.params, {
            confirm: intentResult.confirm,
            undoable: intentResult.undoable
        });
    }

    // ---- Helpers ----

    function buildConfirmSubtitle(command, params) {
        switch (command) {
            case 'FOCUS_START':
                var min = (params && params.minutes) || 25;
                return msg('cmd_focus_confirm_sub', 'Start a focus session?')
                    .replace('{min}', min);
            case 'FOCUS_STOP':
                return msg('cmd_focus_stop_confirm', 'Stop your current session?');
            default:
                return '';
        }
    }

    window.ActionExecutor = {
        init: init,
        run: run,
        handleAIResponse: handleAIResponse,
        handleIntent: handleIntent
    };
})();
