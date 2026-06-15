## Why

The context size indicator in the TUI status bar remains red (compacting color) after starting a new session. It should reset to the default gray color (`#606060`). This is a minor state management bug where `handleNewSession()` resets several state variables but omits `isCompacting`.

## What Changes

- Add `setIsCompacting(false)` to `handleNewSession()` in `src/tui/app.js` to reset the compaction state when starting a new session

## Capabilities

### New Capabilities
<!-- None — this is a bug fix, not a new capability -->

### Modified Capabilities
<!-- None — no spec-level behavior changes -->

## Impact

- `src/tui/app.js` — `handleNewSession()` function (line ~999)
- `src/tui/statusBar.js` — uses `isCompacting` prop for context indicator color
