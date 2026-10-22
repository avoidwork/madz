## Why

When the file picker's `@` autocomplete filter matches no files, the "No matching files." empty message is displayed in a way that obscures the input line, so the user cannot see what they typed when they make a typo. The empty message should be positioned below the line the user types on.

## What Changes

- Modify the `FilePicker` render in `src/tui/filePicker.js` so the input `Text` (the `before`/`at`/`after` cursor rendering) is wrapped in its own `Box` row, occupying a distinct line.
- Render the " No matching files." empty message as a separate child below the input line, so the typed text remains visible when the filter matches nothing.
- Match the behavior of `CommandPicker` in `src/tui/commandPicker.js` for consistency.
- Add a test case in `tests/unit/tui/filePicker.test.js` verifying the empty message renders below the input line when the filter has no matches.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-file-path-autocomplete`: The empty-message rendering requirement is updated so the " No matching files." message renders on a distinct line below the input line, keeping the typed input visible when the filter matches nothing.

## Impact

- `src/tui/filePicker.js` — the render block wrapping the input `Text` in its own `Box` row and rendering the empty message below it.
- `tests/unit/tui/filePicker.test.js` — new test coverage for the empty-message-below-input behavior.
- No API, dependency, or configuration changes.

## Non-goals

- No change to the file globbing, filtering, sorting, or selection logic.
- No change to the `CommandPicker` behavior beyond matching the empty-message layout for consistency.
- No change to the `InputPanel` focus/ownership behavior while the picker is open.
