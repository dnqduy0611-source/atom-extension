// config/build_flags.js
// Build-time flags. Set DEBUG=true for internal/dev builds only.

(function () {
    'use strict';

    const root = typeof globalThis !== 'undefined' ? globalThis : self;

    const BUILD_FLAGS = {
        DEBUG: false
    };

    root.ATOM_BUILD_FLAGS = BUILD_FLAGS;
})();
