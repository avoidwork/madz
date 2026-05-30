## Why

The status bar uses a static `▶` icon during sending/streaming
(`src/tui/statusBar.js:13`). Users have no rotating visual cue that the
system is actively processing, making the interface feel static and
unresponsive.

## What Changes

- Replace the static status-bar indicator with an animated ink-Unicode
  spinner (`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`) that cycles every ~80ms while the
  app is in "Sending..." or "Streaming..." state.
- New file: `src/tui/spinner.js` exporting `Spinner` component and
  `getSpinnerFrame()` pure helper.
- `src/tui/statusBar.js` integrates the `<Spinner>` component as a drop-in
  replacement for the static indicator character.
- Tests for the new module added to `tests/unit/tui.test.js`.

## Capabilities

### New Capabilities
- `tui-status-indicator`: Defines the animated spinner behavior for the TUI
  status bar — frame sequence, timing, active/inactive states, and layout
  stability guarantees.

### Modified Capabilities
<!-- None — existing behavior is extended, not altered -->

## Impact

- **Files**: `src/tui/spinner.js` (new), `src/tui/statusBar.js` (modify
  indicator), `tests/unit/tui.test.js` (add tests)
- **Dependencies**: none — uses only `React` and `ink` primitives already
  in the project, mirroring the existing `Blink` component pattern.
- **Breaking**: none — `StatusBar` props API is unchanged.
