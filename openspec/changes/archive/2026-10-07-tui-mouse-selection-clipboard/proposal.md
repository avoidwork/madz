## Why

The TUI enables terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) to support wheel scrolling, which disables the terminal's native click-drag text selection. Users cannot select and copy text from the conversation output. This feature restores selection by implementing it in-app and copying the result to the system clipboard automatically.

## What Changes

- Extend `src/tui/useMouseScroll.js` to support drag selection alongside scrolling: add `\x1b[?1002h` (button-event tracking) to the enable sequence and `\x1b[?1002l` to the disable sequence. Wheel events (button codes 64/65) remain disjoint from left-button drag (button code 0), so scrolling and selection do not conflict.
- Track selection state: on left-button press (button 0), record the start `(x, y)`; on move while held, update the end; on release, finalize and invoke a new `onSelect` callback.
- Add a layout resolver that maps `(x, y)` coordinates to a character range in the rendered conversation, using terminal width, scroll offset, and each message's plain text plus wrapped-line structure.
- Copy the selected text to the system clipboard via `clipboardy` (added as a dependency).
- Render the selected region with inverse video / background style so the user sees what is being grabbed.
- Wire the selection callback into `src/tui/app.js`, gated by the same conditions as scroll (conversation view, file picker closed).

## Capabilities

### New Capabilities
- `tui-mouse-selection`: Character-level mouse selection in the conversation panel via SGR mouse sequence parsing, coordinate-to-character mapping, clipboard copy, and selection highlighting.

### Modified Capabilities
- `tui-mouse-scroll`: Update the `useMouseScroll` hook to also enable button-event tracking (`\x1b[?1002h` / `\x1b[?1002l`) and to classify left-button drag events (button 0) distinctly from wheel events (64/65).

## Impact

- **Modified**: `src/tui/useMouseScroll.js` (drag selection + button-event tracking), `src/tui/app.js` (wire selection callback), `src/tui/messageList.js` (pass selection range), `src/tui/messageBubble.js` (render selection highlight), `src/tui/markdownText.js` (render selection highlight).
- **New**: `src/tui/selectionLayout.js` (coordinate-to-character layout resolver).
- **Dependency**: `clipboardy` (v4.x+).
- **Tests**: `tests/unit/tui/useMouseScroll.test.js` (extend), `tests/unit/tui/selectionLayout.test.js` (new).

## Non-goals

- No changes to keyboard scroll routing.
- No changes to the custom `ScrollView` component internals.
- No selection in panel views (skills/memories/settings/sessions/projects).
- No re-enabling terminal-native selection (mutually exclusive with in-app mouse handling).
