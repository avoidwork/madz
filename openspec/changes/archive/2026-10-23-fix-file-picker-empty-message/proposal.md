## Why

When the file picker's `@` autocomplete filter matches no files, the " No matching files." message is rendered as a sibling of the input `Text` in a single column `Box`, obscuring the input line. When the user makes a typo (e.g., `@src/confg`), they cannot see what they typed because the empty message covers it.

## What Changes

- Remove the empty-message rendering branch in `FilePicker` (`src/tui/filePicker.js`) so that when the filter matches no files, nothing is rendered below the input line.
- The typed input line remains visible and unobscured on a typo.
- Add a render test asserting the empty-message text is never present and the input line always renders, plus a `deriveFilter` precondition test for a typo filter that matches no files.

## Capabilities

### New Capabilities
<!-- None — this is a bug fix to an existing capability. -->

### Modified Capabilities
- `tui-file-path-autocomplete`: The rendering requirement changes so the file picker does not render a " No matching files." empty message when the filter has no matches; the typed input line is never obscured.

## Impact

- **Modified**: `src/tui/filePicker.js` — remove the empty-message branch in the `FilePicker` render.
- **Modified**: `tests/unit/tui/filePicker.test.js` — add a render test and a `deriveFilter` precondition test.
- No change to globbing, sorting, navigation, selection, or trigger behavior.

## Non-goals

- No change to globbing, sorting, navigation, selection, or trigger behavior.
- No change to `deriveFilter`, `replaceToken`, `sortFiles`, or the `CommandPicker` component.
- No change to other TUI panels or the App-level input handling.
