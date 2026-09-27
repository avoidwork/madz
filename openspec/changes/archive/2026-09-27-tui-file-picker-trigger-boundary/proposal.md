## Why

The TUI file picker autocomplete triggers on `@` appearing anywhere in the input, including in the middle of a pasted string such as a git repo URL (`git@github.com:owner/repo.git`). This opens the picker when it should not. The trigger heuristic in `deriveFilter()` is too loose.

## What Changes

- Rewrite the trigger logic in `deriveFilter()` in `src/tui/filePicker.js` to be regex-based using `\w`.
- The picker only triggers when the `@` is the trigger token at a word boundary (start of input or preceded by a space), the cursor is at the end of the token, and the token is followed by word characters.
- Add regression tests to `tests/unit/tui/filePicker.test.js` for `@` mid-string (git URL), `@` not preceded by a space, `@` not at the end of input, and `@` followed by a space.

## Capabilities

### New Capabilities
<!-- None — this is a bug fix to an existing capability. -->

### Modified Capabilities
- `tui-file-path-autocomplete`: The trigger requirement changes so the picker only opens when `@` is the trigger token at a word boundary, at the end of the current input, and followed by word characters. A pasted string with `@` in the middle must not open the picker.

## Impact

- **Modified**: `src/tui/filePicker.js` — rewrite `deriveFilter()` trigger logic.
- **Modified**: `tests/unit/tui/filePicker.test.js` — add regression tests.
- No change to globbing, sorting, navigation, selection, or rendering behavior.

## Non-goals

- No change to globbing, sorting, navigation, selection, or rendering behavior.
- No change to `replaceToken`, `sortFiles`, or the `FilePicker` component.
- No change to other TUI panels or the App-level input handling.
