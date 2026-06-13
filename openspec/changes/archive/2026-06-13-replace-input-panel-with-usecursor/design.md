## Context

The TUI (`src/tui/`) uses Ink for terminal rendering. The `InputPanel` component (`src/tui/inputPanel.js`) currently renders a cosmetic Unicode block character (`\u2588`) as a visual cursor, alongside the typed input text. This is wrapped in a `Blink` component (misnamed — no actual blinking occurs). The cursor is styled with a near-invisible color (`#202020`) when the input is unfocused, which is a visual hack rather than proper cursor hiding.

The `InputPanel` is a display-only component — all input handling (typing, Enter-to-send, history navigation, backspace) is managed by `App`'s single `useInput` hook. `InputPanel` receives `inputText`, `cursorChar`, and `cursorColor` props.

## Goals / Non-Goals

**Goals:**
- Replace the cosmetic cursor character with real terminal cursor positioning using Ink's `useCursor` hook.
- Properly hide/show the cursor based on input focus state.
- Handle wide characters (CJK, emoji) correctly using `string-width`.
- Clean up the `Blink` component entirely.

**Non-Goals:**
- Adding cursor blinking animation (not requested, adds complexity).
- Changing the input handling logic (remains in `App`'s `useInput`).
- Supporting custom cursor shapes (terminal cursor shape is controlled by the terminal emulator).
- IME (Input Method Editor) implementation beyond what `useCursor` provides natively.

## Decisions

### Decision 1: Use `useCursor` over manual ANSI escape codes
**Rationale:** Ink's `useCursor` hook is the framework-recommended approach. It handles cursor positioning relative to Ink's rendered output, accounting for layout changes automatically. Manual ANSI codes would be fragile and break on re-renders.

### Decision 2: Use `string-width` for x-position calculation
**Rationale:** Ink's own cursor-IME example uses `string-width` for the same reason. Terminal columns don't map 1:1 to character count when wide characters are present. This is essential for correct cursor placement.

### Decision 3: Remove `cursorChar` prop, keep `cursorColor` as focus signal
**Rationale:** The real terminal cursor replaces the character prop entirely. The `cursorColor` prop value (`#202020`) is repurposed as a focus indicator — when set to this value, the cursor is hidden; when `undefined`, it's shown. This minimizes API surface changes.

### Decision 4: Add `> ` prompt prefix
**Rationale:** The App component JSDoc describes an "IRC-style layout." The prompt prefix aligns with this description and provides visual clarity. It's a minor enhancement that improves UX.

### Decision 5: Remove `Blink` component entirely
**Rationale:** It serves no purpose beyond the cosmetic cursor. The name was already misleading. No other component references it.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `string-width` adds a production dependency | It's a small, well-maintained package (~2KB). Required for correctness with wide characters. |
| Cursor positioning may be off by one due to Box padding (`paddingX: 1`) | The `useCursor` hook positions relative to Ink output, which already accounts for container padding. Test with actual rendering. |
| Cursor hiding may flash briefly on unfocus | Ink handles cursor state transitions smoothly. The `setCursorPosition(undefined)` call is synchronous within the render cycle. |
| Terminal cursor appearance varies by emulator | This is expected — cursor shape/color is a terminal setting, not something we control. The positioning is correct regardless. |

## Open Questions

- None at this time. The approach is straightforward and follows Ink's documented patterns.
