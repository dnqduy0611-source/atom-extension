# Debug Confidence Panel Plan

## Goal
Add a standalone debug panel (separate from Options) to monitor AI confidence in realtime, with a lightweight, removable integration.

## Scope
- New debug page (`debug.html`, `debug.js`, `debug.css`)
- Debug hub in `background.js` (ring buffer + realtime port + persistence)
- Hidden popup link gated by `debug_mode`
- Event emission for AI decisions/timeouts/errors

## Steps
1. Implement Debug Hub in `background.js` with enable flag tied to `debug_mode`.
2. Persist ring buffers to storage for session continuity.
3. Create `debug.html/js/css` for the panel UI (latest + history + filter + realtime toggle).
4. Add hidden popup link to open the debug panel when `debug_mode` is true.
5. Emit `ai_decision`, `ai_timeout`, `ai_error` events from the AI pipeline.

## Acceptance
- Debug panel opens only when `debug_mode` is enabled.
- Latest + history render correctly and update in realtime.
- Events persist across popup reopen (storage-backed ring buffer).
- Removing debug files/handlers does not affect core ATOM flow.
