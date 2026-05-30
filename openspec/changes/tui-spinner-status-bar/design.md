## Context

The status bar (`src/tui/statusBar.js`) shows a static indicator — `▶` for
"Sending"/"Streaming", `●` for "Ready", `✖` for errors. There is no rotation
animating the processing states. The input panel already has a `Blink` component
(`src/tui/inputPanel.js:41`) that uses `useState` + `setInterval` for a
cursor animation. The TUI is built on `ink` (React-based terminal UI).

## Goals / Non-Goals

**Goals:**
- Replace the static status-bar indicator with a rotating ink-Unicode spinner
- Keep the spinner component self-contained and testable
- Maintain layout stability (single-width characters only)

**Non-Goals:**
- Replacing or modifying the `Blink` cursor in the input panel
- Adding color transitions or pulse effects to the spinner
- Introducing a new external dependency

## Decisions

1. **Use ink primitives instead of `ora`**
   `ora` manipulates raw stdout and terminal cursor positioning, which conflicts
   with `ink`'s own terminal management. Both competing for TTY control produces
   corrupted output. `ink` components re-render automatically when state changes,
   making `useState` + `setInterval` sufficient.

2. **Mirror the existing `Blink` component pattern**
   The `Blink` component in `inputPanel.js:41` uses `useState` + `useEffect` +
   `setInterval` and exposes a `_testFrame` prop for deterministic unit testing.
   The `Spinner` follows this same pattern for consistency.

3. **10-frame ink Unicode sequence**
   Characters: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` — all single-width monospace, natively
   supported by terminal emulators, no extra dependency.

4. **80ms interval**
   Matches typical terminal spinner feel (close to `ora`'s default 100ms but
   noticeably smoother). Configurable via `interval` prop.

5. **Pure frame helper `getSpinnerFrame(frame)`**
   Like `getBlinkState`, this pure function maps a frame counter to a character
   using `frame % 10`. Enables unit testing without rendering.

## Risks / Trade-offs

- **TTY redraw latency on slow terminals**: Frame animation depends on the
  terminal's ability to keep up with rapid re-renders. At 80ms the interval is
  already low; `ink` batches renders so this is not a practical concern.
- **Color**: Current static indicator shows yellow `▶` during streaming. The
  spinner renders as plain text (default color). If color emphasis was valued,
  a future change could wrap the spinner in a `<Text color="yellow">`.
  Out of scope for this iteration.
