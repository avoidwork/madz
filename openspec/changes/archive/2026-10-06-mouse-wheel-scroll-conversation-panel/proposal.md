## Why

The conversation panel supports keyboard-only scrolling via the custom `ScrollView` component. Users on terminals with mouse support cannot scroll through long message histories with a scroll wheel — a usability gap for long conversations. Ink 8's `useInput` drops mouse control sequences (a v8.0.0 breaking change), so mouse events must be captured via raw stdin.

## What Changes

- Add a custom `useMouseScroll` hook that enables terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`), parses SGR mouse sequences to detect wheel-up/wheel-down, and invokes a callback.
- Wire the hook into `src/tui/app.js` so wheel events drive `conversationAreaRef.current?.scrollBy(delta)`.
- Integrate with the existing scroll-up suppression (`isUserScrolledUpRef`) so mouse scrolling doesn't fight auto-scroll on new messages.
- Disable mouse reporting and remove the stdin listener on unmount.
- Add unit tests for SGR sequence parsing and hook lifecycle cleanup.

## Capabilities

### New Capabilities
- `tui-mouse-scroll`: Mouse-wheel scrolling in the conversation panel via SGR mouse sequence parsing, wired to the custom ScrollView's `scrollBy` API.

### Modified Capabilities
- `tui-scroll-view`: Update to reflect the custom `ScrollView` component (replacing `ink-scroll-view`) and add the mouse-wheel scroll integration requirement.

## Impact

- **New file**: `src/tui/useMouseScroll.js` (custom hook).
- **Modified**: `src/tui/app.js` (wire mouse hook), `src/tui/messageList.js` (scroll-up suppression integration), `src/tui/scrollView.js` (no change — `onScroll` already exposed).
- **Tests**: `tests/unit/tui/useMouseScroll.test.js`.
- **No new npm dependencies.**

## Non-goals

- No changes to the custom `ScrollView` component internals.
- No changes to keyboard scroll routing.
- No support for mouse click/drag scrolling — only wheel-up/wheel-down.
