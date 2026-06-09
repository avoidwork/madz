## Context

The input panel (`src/tui/inputPanel.js`) and its parent `App` (`src/tui/app.js`) currently treat the input as an append-only buffer. The `useInput` hook in `App` has a single global handler that appends typed characters at the end of `inputText` and deletes from the end on backspace. A blinking cursor indicator (`█`) displays at the right edge. The component architecture separates input handling (in `App`) from rendering (in `InputPanel` → `Blink`).

## Goals / Non-Goals

**Goals:**
- Enable left and right arrow key navigation through the input text, positioning the cursor at any character index.
- Insert characters at the cursor position so mid-text editing is supported.
- Backspace deletes the character to the left of the cursor, adjusting the cursor position.
- Render a visual highlight (background + high-contrast text) on the character at the cursor position.
- Preserve all existing input behaviors: Enter-to-send, Up/Down for history navigation, Escape to quit.

**Non-Goals:**
- Home/End key support (deferred to a follow-up change).
- Text selection (range highlight) — no shift+arrow multi-character selection.
- Mouse click-to-position — keyboard-only navigation for now.
- Undo/redo for text edits.
- Multi-line input editing.

## Decisions

### D1: Manage `cursorPosition` state in `App`, not in `InputPanel`

The existing architecture places all `useInput` logic in `App` with `InputPanel` as a pure display component. Adding cursor position state to `App` follows this pattern and avoids introducing a new input handler inside `InputPanel`.

**Alternatives considered:**
- Move `useInput` into `InputPanel` — would require restructuring the existing input handling architecture and could interfere with panel focus management.
- Use a ref for cursor position — would not trigger re-renders needed for the visual highlight update.

### D2: Use cyan (`bgCyan`) for cursor character highlight via `ink` `Text` props

Ink's `Text` component accepts style props (e.g., `bgCyan`, `bold`). Rather than importing `chalk` or using inline ANSI escape codes, we pass visual style props to `Text` for the highlighted character. A fixed `bgCyan` with white text provides guaranteed contrast in any theme.

**Alternatives considered:**
- Derived cursor color (e.g., invert the configured cursor color) — adds complexity for marginal visual benefit.
- Configurable highlight color (`tui.cursorHighlightColor`) — defers config extension; a fixed color is sufficient for the initial implementation.

### D3: Split input text into three `Text` elements for rendering

The `Blink` component renders `(highlighted_char_at_cursor) + (remaining_text) + (blinking_cursor_char)`. When `cursorPosition < inputText.length`, the first segment is a styled `Text` wrapping `inputText[cursorPosition]`. This keeps the highlight as part of the text flow rather than an absolute overlay, preventing layout shifts.

**Alternatives considered:**
- Replace entire text with per-character styled `Text` elements — overkill; only one character needs highlighting at a time.
- Use `Box` nesting — introduces unnecessary layout complexity.

### D4: Default `cursorPosition` to `inputText.length`

On initial render and after send (submit), the cursor resets to the end, matching current behavior. This provides a seamless migration — no user action is required to use the feature.

## Risks / Trade-offs

### Risk: Terminal color compatibility
Some terminal emulators (especially Windows ConHost without ANSI support) may not render `bgCyan` or text color overrides. The highlight may appear as an unstyled character.

**Mitigation:** Use standard ANSI color codes through ink's built-in support. Document in release notes that the highlight requires a modern terminal. Provide a fallback config (`tui.disableCursorHighlight: true`) if needed. No hard failure — unstyled characters are acceptable.

### Risk: Arrow key collision with session search
If a future feature adds arrow key usage within the conversation panel, the global `useInput` handler may have conflicts. Currently ArrowLeft/ArrowRight are unused in `App`, so there is no risk today.

**Mitigation:** The `App` `useInput` handler already has priority ordering (onboarding → banner → normal). When session search arrow key support is added, ensure it's handled in the `ConversationPanel` focus scope or guarded by a state flag.

### Risk: Backspace inserts newlines in some terminals
Some terminal emulators send `\b` (ASCII backspace) for the backspace key rather than a named `key.backspace` flag. The existing handler uses `key.backspace`, which ink already normalizes, so this is not a risk.

## Migration Plan

This is a purely additive change — no config changes, no data migrations, no breaking API changes.

1. Add `cursorPosition` state to `App` alongside `inputText`.
2. Modify the `useInput` handler in `App` to process `ArrowLeft`/`ArrowRight`.
3. Update text insertion and backspace to splice at `cursorPosition` instead of appending/deleting at the end.
4. Update `Blink` component in `inputPanel.js` to accept and render cursor-position highlighting.
5. No user-facing migration steps — existing behavior is preserved when the cursor is at the end.

## Open Questions

- Should Home/End key support be bundled in this change, or deferred? Deferred to keep scope tight.
- Should cursor highlight color be configurable via `tui.cursorHighlightColor`? Defer to a follow-up if users request it.
