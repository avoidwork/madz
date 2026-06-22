## Why

The current `InputPanel` component renders a cosmetic Unicode block character (`\u2588`) as a visual cursor. This approach is purely decorative — it doesn't provide real terminal cursor behavior, breaks with IME (Input Method Editor) support, and requires visual hacks (near-invisible color) to hide the cursor when the input is unfocused. Ink's `useCursor` hook provides proper terminal cursor positioning, which is essential for correct input behavior and accessibility.

## What Changes

- Replace the `Blink` component (which renders a static cursor character) with Ink's `useCursor` hook in `src/tui/inputPanel.js`.
- Use `setCursorPosition({x, y})` to position the real terminal cursor after the typed input text.
- Use `setCursorPosition(undefined)` to hide the cursor when the input panel is not focused.
- Add `string-width` dependency for accurate wide-character (CJK, emoji) cursor x-positioning.
- Remove the `cursorChar` prop from the `InputPanel` API — no longer needed with a real cursor.
- Add a `> ` prompt prefix to the input display to match the IRC-style layout.

## Capabilities

### New Capabilities
- `tui-cursor-positioning`: Proper terminal cursor positioning via Ink's `useCursor` hook in the input panel.

### Modified Capabilities
- *(none — this is a new capability, not a modification of existing spec-level behavior)*

## Impact

- **Affected code**: `src/tui/inputPanel.js` (refactored), `src/tui/app.js` (consumer removes `cursorChar` prop), `package.json` (new dependency).
- **Dependencies**: Adds `string-width` to production dependencies.
- **Breaking changes**: The `cursorChar` prop is removed from `InputPanel`. Any external consumers would need to drop this prop (internal only, so no external breaking change).
