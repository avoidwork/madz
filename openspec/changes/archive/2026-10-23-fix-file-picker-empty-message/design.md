## Context

The `FilePicker` component (`src/tui/filePicker.js`) renders an input `Text` and a list of matching files in a single column `Box`. When the `@` autocomplete filter matches no files, it renders a `" No matching files."` `Text` as a sibling of the input `Text`. Because both are in a single column `Box`, the empty message appears directly below the input line and obscures what the user typed when they make a typo (e.g., `@src/confg`).

A prior attempt (#1461) tried to *reposition* the empty message below the input line by wrapping the input `Text` in its own `Box` row. That was broken and reverted (#1462). This change takes the issue's stated approach: **remove** the empty-message rendering entirely.

## Goals / Non-Goals

**Goals:**
- Remove the `" No matching files."` empty-message branch so nothing renders when the filter has no matches.
- Keep the typed input line visible and unobscured on a typo.
- Add a render test asserting the empty-message text is never present and the input line always renders, plus a `deriveFilter` precondition test for a typo filter that matches no files.

**Non-Goals:**
- No change to globbing, sorting, navigation, selection, or trigger behavior.
- No change to `deriveFilter`, `replaceToken`, `sortFiles`, or the `CommandPicker` component.
- No change to other TUI panels or the App-level input handling.

## Decisions

### Decision 1: Render nothing when the filter has no matches

Replace the `filteredFiles.length === 0 ? React.createElement(Text, { color: "gray" }, " No matching files.") : ...` branch with `null`. When the filter matches nothing, the render produces no message and no list entries, so the input line is never obscured.

**Alternative considered:** Repositioning the message below the input line (the #1461 approach). Rejected because it was broken and reverted, and the issue explicitly asks to remove the message rather than reposition it. The `" Loading files..."` state is preserved — it only shows before the glob completes, not on a no-match filter.

## Risks / Trade-offs

- [The " Loading files..." state must still render] → The `!loaded` branch is unchanged; only the no-match branch becomes `null`.
- [Coverage must be maintained] → New render tests exercise the component's render path. Verified via `npm run coverage`.
