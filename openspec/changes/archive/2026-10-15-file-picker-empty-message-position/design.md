# Design: Reposition file picker empty message below the input line

## Context

The `FilePicker` component in `src/tui/filePicker.js` renders its own input line (a `Text` with `before`/`at`/`after` cursor segments) and the empty message (or file list) as siblings in a single column `Box` (`flexDirection: "column"`). When the `@` filter matches no files, the " No matching files." message is the second child of the column. The user reports this obscures the typed input, so they cannot see a typo.

## Goals / Non-Goals

**Goals:**
- Render the " No matching files." message on a distinct line below the input line.
- Keep the typed input (with cursor) fully visible when the filter matches nothing.
- Preserve the existing file-list rendering when there ARE matches.

**Non-Goals:**
- No change to globbing, filtering, or selection logic.
- No change to the command picker's empty message.
- No change to `deriveFilter` / `shouldOpenPicker`.

## Decisions

**Decision: Wrap the input `Text` in its own `Box` row and render the empty message as a separate child below it.**

The current render block produces a column `Box` whose first child is the input `Text` and whose second child is either the empty message or the file list. The fix is to ensure the input `Text` occupies a distinct row and the empty message is a separate child rendered below it. This is a pure layout change — no behavioral change to the picker's core logic.

**Alternatives considered:**
- Adding explicit spacing/margin to push the message down — less explicit, relies on Ink's layout heuristics.
- Moving the message into a separate `Box` with `marginTop` — more verbose, no benefit over wrapping the input in its own row.

## Risks / Trade-offs

- [Risk] The empty message could still overlap the input if Ink's column layout collapses. → Mitigation: wrap the input `Text` in its own `Box` row so it occupies a distinct line, and verify with a render test.
- [Risk] The change could affect the non-empty file-list rendering. → Mitigation: keep the file-list branch unchanged; only the empty-message branch is repositioned.
