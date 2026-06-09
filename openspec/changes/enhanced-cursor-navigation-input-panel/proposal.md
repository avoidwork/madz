## Why

Users currently cannot navigate within long input text in the chat input panel — every keystroke appends at the end and backspace removes from the end. When editing mid-text, users must retype or rely on terminal copy-paste. Arrow key cursor navigation and visual position feedback are needed for productive text editing.

## What Changes

- Add left/right arrow key navigation to move the cursor character-by-character within the input text in `app.js`.
- Change text insertion and backspace to operate at the cursor position rather than always at the end of the string.
- Render a visual highlight (background color + inverted text) on the character under the cursor position in the `Blink` component.
- Track `cursorPosition` state in `App` (defaults to `inputText.length`) and pass it to `InputPanel` via `Blink`.
- Update `getBlinkState` / `Blink` / `renderBlink` to accept a cursor position and render a highlighted character at that position, with the blinking cursor indicator remaining at the text end (preserving existing behavior).

## Capabilities

### New Capabilities

- `input-cursor-navigation`: Arrow key cursor navigation and visual highlight within the input text.

### Modified Capabilities

- `input-cursor`: Existing blinking cursor requirement now coexists with cursor-position tracking, character-level highlight, and non-end-of-text insertion.

## Impact

- `src/tui/app.js`: Add `cursorPosition` state; modify `useInput` hook to handle `ArrowLeft`/`ArrowRight`; update text insertion and backspace to splice at `cursorPosition`.
- `src/tui/inputPanel.js`: Update `Blink` component to accept `cursorPosition`; render highlighted character at that position.
- `src/tui/inputPanel.js`: Update `renderBlink` helper and `getBlinkState` to support cursor-position-based styling.
- `tests/unit/input-cursor.test.js` (or equivalent): Update tests for new behavior.
- Existing behavior (Enter-to-send, history navigation via Up/Down, escape) is preserved.
