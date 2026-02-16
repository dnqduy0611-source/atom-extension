// utils/console_guard.js
// Disable console.log unless build + runtime debug are enabled.

(function () {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : self;
    const flags = root.ATOM_BUILD_FLAGS && typeof root.ATOM_BUILD_FLAGS === 'object'
        ? root.ATOM_BUILD_FLAGS
        : { DEBUG: false };

    if (!root.__ATOM_CONSOLE_LOG__) {
        root.__ATOM_CONSOLE_LOG__ = console.log ? console.log.bind(console) : null;
    }
    const originalLog = root.__ATOM_CONSOLE_LOG__;

    function applyConsoleState(enabled) {
        if (!originalLog) return;
        console.log = enabled ? originalLog : function () { };
    }

    function setDebugState(runtimeEnabled) {
        const buildEnabled = !!flags.DEBUG;
        const enabled = buildEnabled && !!runtimeEnabled;
        root.ATOM_DEBUG_STATE = {
            buildEnabled,
            runtimeEnabled: !!runtimeEnabled,
            enabled
        };
        applyConsoleState(enabled);
    }

    if (!flags.DEBUG) {
        setDebugState(false);
        return;
    }

    // Default to disabled until storage resolves.
    setDebugState(false);

    if (root.chrome?.storage?.local?.get) {
        root.chrome.storage.local.get(['debug_mode'], (res) => {
            setDebugState(!!res?.debug_mode);
        });
        root.chrome.storage.onChanged?.addListener((changes) => {
            if (changes.debug_mode) {
                setDebugState(!!changes.debug_mode.newValue);
            }
        });
    }
})();
