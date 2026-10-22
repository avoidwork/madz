## Context

The `FilePicker` component in `src/tui/filePicker.js` renders its own input line (a `Text` with `before`/`at`/`after` cursor segments) and the empty message as siblings in a single column `Box` (`flexDirection: "column"`). The render block is the `return React.createElement(Box, { flexDirection: "column", ... }, <input Text>, <empty message or file list>)` near the end of the component.

When the `@` filter matches no files, the " No matching files." message is rendered as the second child of the column `Box`. In Ink, a column `Box` stacks children vertically, so the message should already appear below the input line. However, the input `Text` is not wrapped in its own `Box` row, so the message can visually collide with or obscure the typed input line depending on layout. The fix is to make the input line an explicit, distinct row so the empty message is guaranteed to render on a separate line below it.

## Goals / Non-Goals

**Goals:**
- Ensure the " No matching files." empty message renders on a distinct line below the input line, keeping the typed input visible when the filter matches nothing.
- Match the `CommandPicker` layout pattern for consistency.

**Non-Goals:**
- No change to file globbing, filtering, sorting, or selection logic.
- No change to `CommandPicker` behavior beyond matching the empty-message layout.
- No change to `InputPanel` focus/ownership behavior while the picker is open.

## Decisions

- **Wrap the input `Text` in its own `Box` row.** The input `Text` (the `before`/`at`/`after` cursor rendering) is wrapped in a `Box` with `flexDirection: "row"` so it occupies a distinct line. This guarantees the empty message, rendered as a sibling below it in the column `Box`, never overlaps or obscures the typed input.
- **Render the empty message as a separate child below the input line.** The " No matching files." message remains a sibling of the input row in the column `Box`, so it stacks below the input line.
- **Match `CommandPicker`.** The `CommandPicker` in `src/tui/commandPicker.js` uses the same column `Box` pattern with the input `Text` as the first child and the empty message as the second child. The same wrapping is applied for consistency.

## Risks / Trade-offs

- [Layout regression in the file list rendering] → The change only wraps the input `Text` in a `Box` row; the file list and loading state remain siblings in the column `Box`, preserving their existing layout.
- [Ink rendering differences across terminals] → The `Box` row wrapping is a standard Ink layout primitive; no terminal-specific behavior is introduced.
