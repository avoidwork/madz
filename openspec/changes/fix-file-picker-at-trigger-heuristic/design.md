## Context

The file picker autocomplete in the TUI triggers on `@` anywhere in the input.
`deriveFilter()` in `src/tui/filePicker.js` uses `value.lastIndexOf("@", pos)` to
find the last `@` at or before the cursor, then activates the picker whenever the
cursor is after that `@`. This is too loose: a pasted git repo URL
(`git@github.com:owner/repo.git`) contains `@` mid-string, so the picker opens
when it should not.

## Goals / Non-Goals

**Goals:**
- Only open the picker when `@` is a genuine trigger token.
- The `@` must be the final token in the input (cursor at/after the `@` with the
  `@` at the end of the input).
- The character immediately left of `@` must be a space, or `@` is at index 0.
- The `@` must be followed by alphanumeric characters.
- A pasted string with `@` in the middle (e.g., a git URL) must not open the picker.

**Non-Goals:**
- No changes to glob logic, sorting, `replaceToken`, or the `FilePicker` React
  component's rendering.
- No changes to other TUI modules.

## Decisions

**Decision 1: Require `@` to be the final token in the input.**
The trigger requires the `@` at position `N-1` (end of input). If the `@` is at
`N-20`, it is not a trigger. This is implemented by checking that the token
extends to the end of the input (no whitespace after the `@`), and that the cursor
is at/after the `@` such that the `@` token is the final token.

**Decision 2: Require a space (or start-of-input) immediately left of `@`.**
The character at `lastAt - 1` must be whitespace, or `lastAt` must be 0. This
prevents `@` in the middle of a token (e.g., `git@github.com`) from triggering.

**Decision 3: Require alphanumeric characters after `@`.**
The `@` must be followed by at least one alphanumeric character for the picker to
open. A bare `@` with no following content does not trigger.

**Decision 4: Reject `@` mid-string when a space exists within the pasted token.**
If the input contains a space within a pasted token (e.g., a git URL), do not
activate. Combined with Decision 1 and 2, this ensures pasted strings with `@` in
the middle are ignored.

## Risks / Trade-offs

- [Tightening the heuristic may miss legitimate triggers] → The heuristic still
  opens the picker for the common case (`@` at end of input, preceded by space,
  followed by alphanumerics). The regression tests cover the valid and invalid
  cases.
- [Cursor position edge cases] → The cursor is clamped to `[0, value.length]`
  before the heuristic runs, so out-of-range cursors are handled safely.
