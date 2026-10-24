## Why

When the command picker's `/` autocomplete filter matches no commands, the " No matching commands." message is rendered as a sibling of the input `Text` in a single column `Box`, obscuring the input line. When the user makes a typo (e.g., `/confg`), they cannot see what they typed because the empty message covers it. The file picker had the identical defect and was fixed by rendering nothing when the filter has no matches (commit a3d2833e, issue 1412); the command picker should behave the same way.

## What Changes

- Remove the empty-message rendering branch in `CommandPicker` (`src/tui/commandPicker.js`) so that when the filter matches no commands, nothing is rendered below the input line.
- The typed input line remains visible and unobscured on a typo.
- Add a render test asserting the empty-message text is never present and the input line always renders, plus a `deriveCommandFilter` precondition test for a typo filter that matches no commands.

## Capabilities

### New Capabilities
<!-- None — this is a bug fix to an existing capability. -->

### Modified Capabilities
- `tui-slash-command-autocomplete`: The rendering requirement changes so the command picker does not render a " No matching commands." empty message when the filter has no matches; the typed input line is never obscured.

## Impact

- **Modified**: `src/tui/commandPicker.js` — remove the empty-message branch in the `CommandPicker` render.
- **Modified**: `tests/unit/tui/commandPicker.test.js` — add a render test and a `deriveCommandFilter` precondition test.
- No change to command filtering, navigation, selection, or trigger behavior.

## Non-goals

- No change to command filtering, navigation, selection, or trigger behavior.
- No change to `deriveCommandFilter`, `shouldOpenCommandPicker`, `replaceCommandToken`, or `MAX_VISIBLE`.
- No change to the file picker or other TUI panels.
- No change to the App-level input handling.
