# Proposal: Reposition file picker empty message below the input line

## Why

When the file picker's `@` autocomplete filter matches no files, the " No matching files." empty message renders in a way that obscures the input line, so the user cannot see what they typed when they make a typo. The empty message should be positioned below the line the user types on.

## What Changes

- Reposition the " No matching files." empty message in `src/tui/filePicker.js` so it renders on a distinct line below the input line.
- Ensure the typed input (the `before`/`at`/`after` cursor rendering) remains fully visible when the filter matches nothing.
- Add a test verifying the empty message renders below the input line.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-file-path-autocomplete`: The empty-state message (" No matching files.") must render below the input line so the user's typed text remains visible when the `@` filter matches no files.

## Impact

- `src/tui/filePicker.js` — the render block at the end of the `FilePicker` component.
- `tests/unit/tui/filePicker.test.js` — add a test for the empty-message positioning.

## Non-goals

- No change to the file globbing, filtering, or selection logic.
- No change to the command picker's empty message (`commandPicker.js`), though consistency is desirable.
- No change to the `deriveFilter` / `shouldOpenPicker` logic.
