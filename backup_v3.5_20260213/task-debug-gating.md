# Task: Debug Gating for Release

## Goal
Disable dev-only debug surfaces for public builds while keeping full functionality intact.

## Scope
- Build-time debug flag (`config/build_flags.js`)
- Runtime debug gating for UI + background hub
- Global `console.log` suppression in release
- Docs updates

## Changes
- Added build flags + console guard
- Gated debug hub, debug pages, and dev panels
- Hid debug settings in Options for release builds
- Updated `README.md` and `CHANGELOG.md`

## Test Plan
- Reload extension and verify Debug UI is hidden when `DEBUG=false`
- Open popup and confirm Debug button is hidden
- Open bug report page and confirm it still works
