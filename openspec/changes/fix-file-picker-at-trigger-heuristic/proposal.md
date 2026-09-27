## Why

The file picker autocomplete triggers on `@` appearing anywhere in the input,
including in the middle of a pasted string such as a git repo URL
(`git@github.com:owner/repo.git`). This opens the picker when it should not,
interrupting the user's flow. The trigger heuristic is too loose.

## What Changes

- Tighten the `@` trigger heuristic in `deriveFilter()` in `src/tui/filePicker.js`.
- The picker only opens when the `@` is a genuine trigger token: at the end of the
  current input, preceded by a space (or at index 0), and followed by alphanumeric
  characters.
- A pasted string with `@` in the middle (e.g., a git repo URL) no longer opens the
  picker.
- Add regression tests to `tests/unit/tui/filePicker.test.js` for `@` mid-string
  (git URL), `@` not preceded by a space, and `@` not at the end of input.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tui-file-path-autocomplete`: The "Trigger file picker on @ token" requirement
  is tightened so the picker only opens when `@` is the final token in the input,
  preceded by a space (or at index 0), and followed by alphanumeric characters.
  A pasted string with `@` in the middle must not open the picker.

## Impact

- `src/tui/filePicker.js` — `deriveFilter()` (lines 16-49).
- `tests/unit/tui/filePicker.test.js` — `describe("deriveFilter")` block.

## Non-goals

- No changes to the glob logic, sorting, `replaceToken`, or the `FilePicker`
  React component's rendering.
- No changes to other TUI modules or the file-picker UI.
