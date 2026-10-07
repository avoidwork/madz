## Context

The conversation panel scrolls via the custom `ScrollView` component in `src/tui/scrollView.js`, which exposes `scrollBy(delta)`, `getScrollOffset()`, `getContentHeight()`, and `getViewportHeight()` via an imperative ref. Mouse-wheel scrolling is handled by the `useMouseScroll` hook in `src/tui/useMouseScroll.js`, which enables terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`), parses SGR mouse sequences via `parseSgrMouseSequence()`, and maps wheel events (button codes 64/65) to scroll deltas via `buttonToDelta()`. The hook is wired in `src/tui/app.js` at line 430, gated by `currentView === PANELS.CONVERSATION` and the file picker being closed.

Ink 8's `useInput` drops mouse control sequences (a v8.0.0 breaking change), so mouse events must be captured via raw stdin. The hook already attaches a `data` listener on `process.stdin` and parses SGR sequences.

The TUI's mouse reporting disables the terminal's native click-drag text selection. This feature restores selection by implementing it in-app and copying the result to the clipboard automatically.

## Goals / Non-Goals

**Goals:**
- Add character-level mouse selection to the conversation view that copies the selected text to the system clipboard.
- Extend `useMouseScroll` to support drag selection alongside scrolling without conflicting with wheel events.
- Map `(x, y)` coordinates to a character range in the rendered conversation.
- Copy the selected text to the clipboard via `clipboardy`.
- Highlight the selected region so the user sees what is being grabbed.
- Gate selection by the same conditions as scroll (conversation view, file picker closed).

**Non-Goals:**
- No changes to keyboard scroll routing.
- No changes to the custom `ScrollView` component internals.
- No selection in panel views (skills/memories/settings/sessions/projects).
- No re-enabling terminal-native selection (mutually exclusive with in-app mouse handling).

## Decisions

### Decision 1: Enable button-event tracking via `\x1b[?1002h` / `\x1b[?1002l`
The hook currently enables `\x1b[?1000h` (basic mouse tracking) and `\x1b[?1006h` (SGR extended mode). To receive move events while a button is held, we add `\x1b[?1002h` (button-event tracking) to the enable sequence and `\x1b[?1002l` to the disable sequence. Wheel events (button codes 64/65) remain disjoint from left-button drag (button code 0), so scrolling and selection do not conflict.

**Alternatives considered:**
- `\x1b[?1003h` (any-event tracking) — rejected: delivers move events even without a button held, which would flood the handler and complicate selection state.
- Re-enabling terminal-native selection — rejected: mutually exclusive with in-app mouse handling.

### Decision 2: Classify wheel vs left-button drag via a `buttonToSelection()` helper
`buttonToDelta()` maps 64→-1, 65→+1, and returns null otherwise. We add a `buttonToSelection()` helper that returns `true` for button 0 (left-button drag) and `false` otherwise. This keeps wheel and drag classification disjoint and testable.

### Decision 3: Track selection state in a ref within the hook
On left-button press (button 0), record the start `(x, y)`; on move while held, update the end; on release, finalize and invoke a new `onSelect` callback with the start/end coordinates. The hook maintains a `selectionRef` to track the in-progress drag. Wheel events continue to invoke `onScroll`.

### Decision 4: Map coordinates to text via a dedicated layout resolver
A new module `src/tui/selectionLayout.js` exports a pure function that maps `(x, y)` coordinates to a character range. It takes the terminal width, the scroll offset, and a layout model (each message's plain text, vertical position, and wrapped-line structure). The scroll offset from `src/tui/scrollView.js` (`getScrollOffset()`) is added to the mouse `y` coordinate to resolve the correct character in the full content. Keeping this as a pure function makes it unit-testable without a TTY.

### Decision 5: Copy to clipboard via `clipboardy`
`clipboardy` (v4.x+) provides cross-platform clipboard access (macOS/Linux/Windows), wrapping `pbcopy`/`xclip`/`clip`. It is added as a dependency. Clipboard writes are best-effort and scoped to the interactive TUI; headless Docker builds are unaffected.

### Decision 6: Highlight the selected region in the message render
The selected character range is passed down to `messageBubble.js` / `markdownText.js`, which render the selected characters with inverse video or a background style. The highlight reflects the current drag state (start→current end) and clears on release.

## Risks / Trade-offs

- **[Raw stdin listener leaks]** → The hook removes its stdin listener on unmount and only attaches when in the conversation view.
- **[Selection vs scroll conflict]** → Wheel events (64/65) and left-button drag (0) are disjoint button codes; `buttonToSelection()` and `buttonToDelta()` classify them independently.
- **[Coordinate mapping accuracy]** → The layout resolver must account for ANSI stripping, wrapped lines, and the scroll offset. It is a pure function with unit tests against a known rendered layout.
- **[Clipboard write failure]** → Clipboard writes are best-effort; failures are caught and logged without crashing the TUI.
- **[Selection while file picker open]** → Selection is gated by the same conditions as scroll (conversation view, file picker closed), so it is suppressed when the file picker is open.
