## Context

The conversation panel scrolls via the custom `ScrollView` component in `src/tui/scrollView.js`, which replaced `ink-scroll-view` in PR #1309. It exposes `scrollBy(delta)`, `scrollToBottom()`, `getViewportHeight()`, and an `onScroll` callback. Keyboard scrolling is routed through `useInput` in `src/tui/app.js` (lines 414-422), calling `conversationAreaRef.current?.scrollBy(...)`.

Ink 8's `useInput` drops mouse control sequences (a v8.0.0 breaking change), so mouse events cannot be captured through `useInput`. They must be read from raw stdin and parsed as SGR mouse sequences.

## Goals / Non-Goals

**Goals:**
- Enable mouse-wheel scrolling in the conversation panel.
- Parse SGR mouse sequences to detect wheel-up/wheel-down.
- Integrate with existing scroll-up suppression so mouse scrolling doesn't fight auto-scroll.
- Keep the implementation dependency-free and scoped to the conversation view.

**Non-Goals:**
- No changes to the custom `ScrollView` component internals.
- No changes to keyboard scroll routing.
- No mouse click/drag scrolling — only wheel-up/wheel-down.

## Decisions

### Decision 1: Capture mouse events via raw stdin, not `useInput`
Ink 8's `useInput` explicitly drops mouse control sequences. The hook attaches its own `data` listener on `process.stdin` and parses SGR sequences. This is the only reliable way to receive mouse events in Ink 8.

**Alternatives considered:**
- `useInput` — rejected: drops mouse sequences in Ink 8.
- Third-party SGR parser — rejected: no new dependencies; the parser is ~20 lines.

### Decision 2: Enable mouse reporting with SGR 1000 + 1006 modes
The hook writes `\x1b[?1000h` (basic mouse tracking) and `\x1b[?1006h` (SGR extended mode) on mount, and the `l` variants on unmount. SGR mode provides precise `\x1b[<b;x;yM` / `\x1b[<b;x;ym` sequences that encode the button in the first parameter.

### Decision 3: Map wheel events to button codes 64 (up) and 65 (down)
In SGR mouse sequences, the first parameter encodes the button: 64 = wheel-up, 65 = wheel-down. The hook parses the first parameter and maps it to a `-1` or `+1` delta.

### Decision 4: Drive scroll via `conversationAreaRef.current?.scrollBy(delta)`
The conversation area exposes `scrollBy(delta)` (line 832 of `src/tui/conversationArea.js`), which forwards to `messageListRef.current?.scrollBy(delta)`. The hook calls this directly, matching the keyboard routing pattern.

### Decision 5: Integrate scroll-up suppression via the ScrollView `onScroll` callback
The custom `ScrollView` fires `onScroll(clamped)` on every scroll (line 47 of `src/tui/scrollView.js`). The hook uses this to set `isUserScrolledUpRef` to `true` when the user scrolls up, and `false` when they return to the bottom. This ref is currently only ever set to `false` (line 169 of `src/tui/messageList.js`), so the integration is a genuine behavioral change.

## Risks / Trade-offs

- **[Raw stdin listener leaks]** → The hook removes its stdin listener on unmount and only attaches when in the conversation view.
- **[Scroll fighting with auto-scroll]** → The hook sets `isUserScrolledUpRef` on scroll-up so auto-scroll is suppressed until the user returns to the bottom.
- **[Terminal without mouse support]** → The hook only attaches when `stdout.isTTY` and not in CI; sequences that don't parse are ignored.
- **[Mouse events during streaming]** → The hook respects the existing `isUserScrolledUpRef` suppression; streaming auto-scroll resumes when the user returns to the bottom.
