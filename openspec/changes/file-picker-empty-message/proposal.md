## Why

When the file picker's `@` autocomplete filter matches no files, the "No matching files." empty message is rendered as a sibling of the input `Text` inside a single column `Box`. This obscures the input line, so the user cannot see what they typed when they make a typo (e.g., `@src/confg`). The empty message should be removed entirely so the typed input is never obscured.

## What Changes

- Remove the "No matching files." empty-message rendering from the `FilePicker` component in `src/tui/filePicker.js`.
- When the filter matches no files, render nothing (an empty list) instead of the empty message.
- Preserve the existing "Loading files..." state and the matched-file list rendering.
- Add a unit test verifying that no empty message is rendered when the filter has no matches.

## Capabilities

### New Capabilities
<!-- None. This is a modification of an existing capability. -->

### Modified Capabilities
- `tui-file-path-autocomplete`: The file picker SHALL NOT render an empty message when the filter matches no files; it SHALL render nothing (an empty list) so the typed input is never obscured.

## Impact

- `src/tui/filePicker.js` — remove the empty-message ternary branch in the `FilePicker` render.
- `tests/unit/tui/filePicker.test.js` — add a test case verifying no empty message is rendered when the filter has no matches.
- No API, dependency, or config changes.

## Non-goals

- Do NOT reposition the empty message below the input line (the previously reverted approach in PR #1413 / commit 7efa4422).
- Do NOT add a new empty-state placeholder or message.
- Do NOT change the "Loading files..." behavior.
