# AmoNexus (ATOM Extension)

## Release vs Debug

Build-time flags live in `config/build_flags.js`.

- `DEBUG=false` (default): public release mode.
- `DEBUG=true`: internal/dev builds only.

When `DEBUG=false`:
- Dev-only UI is hidden (Debug Mode toggle, Debug Export, Dev Panel).
- `console.log` is disabled globally.
- Debug hub still exists in code but is inert.

When `DEBUG=true`:
- Debug features are available, but still require runtime enable.
- Enable runtime debug in Settings (`Debug Mode`) to see logs/panels.

## Enable Debug (Dev Build)

1. Set `DEBUG=true` in `config/build_flags.js`.
2. Reload the extension.
3. Turn on Debug Mode in Settings.
4. Open the Debug Panel from the popup (if enabled).

## Bug Report

The bug report page (`bug_report.html`) remains available in both release and dev builds.

## AI Command Routing (Phase 1)

Side panel now supports command routing for Focus actions with a dual-path flow:
- Tier 1: client-side intent parsing (`services/intent_parser.js`) for fast local execution.
- Tier 2: AI response action tags (`[ACTION:...]`) parsed by `services/command_router.js`.

This is controlled by feature flags and is OFF by default:
- `atom_feature_flags_v1.AI_COMMANDS_ENABLED` (current)
- `atom_feature_flags_v1.ENABLE_AI_COMMANDS` (legacy compatibility)
