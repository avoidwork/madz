## Context

The TUI file picker autocomplete (`src/tui/filePicker.js`) triggers on `@` appearing anywhere in the input. The trigger heuristic lives in `deriveFilter(value, cursor)`, which uses `value.lastIndexOf("@", pos)` to find the last `@` at or before the cursor, then activates the picker whenever the cursor is after that `@`. This is too loose: a pasted git repo URL (`git@github.com:owner/repo.git`) has `@` mid-string, so the picker opens when it should not.

## Goals / Non-Goals

**Goals:**
- Tighten the trigger so the picker only opens when `@` is the trigger token at a word boundary (start of input or preceded by a space), the cursor is at the end of the token, and the token is followed by word characters.
- Use a regex with `\w` to validate the token.
- Add regression tests for the edge cases.

**Non-Goals:**
- No change to globbing, sorting, navigation, selection, or rendering behavior.
- No change to `replaceToken`, `sortFiles`, or the `FilePicker` component.
- No change to other TUI panels or the App-level input handling.

## Decisions

### Decision 1: Regex-based trigger validation

The trigger is validated with a regex using `\w`. The word to the left of the cursor is determined by walking left from the cursor until a space or the start of the input. The token must:
1. Start with `@`.
2. Be at a word boundary (start of input or preceded by a space).
3. Be followed by word characters (`\w`) — i.e., the cursor is at the end of the token and the token contains word characters after `@`.

**Alternative considered:** Keeping the `lastIndexOf` approach and adding boundary checks. Rejected because it requires multiple ad-hoc boundary checks and is harder to reason about than a single regex validation.

### Decision 2: Cursor must be at the end of the token

The cursor position determines the word. The word being processed is the one to the left of the cursor, with no space between it and the cursor. The `@` must be followed by word characters, and the cursor must be within the token (after the `@`). If the cursor is before the `@`, or the `@` is followed by a space, the picker does not trigger.

**Alternative considered:** Allowing the cursor anywhere within the token. Rejected because the issue spec requires the `@` to be "at the end of the current input" and "followed by word characters" — the cursor must be at the end of the token for the picker to be active.

## Risks / Trade-offs

- [Existing active cases must still trigger] → The regex must preserve the existing behavior for `read @src/config` with the cursor within the token. Covered by existing tests.
- [Coverage must be maintained] → New regression tests exercise the modified function's branches. Verified via `npm run coverage`.
