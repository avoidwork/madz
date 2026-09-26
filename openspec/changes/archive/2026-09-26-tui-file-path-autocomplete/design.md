## Context

The TUI input bar (`src/tui/inputArea.js`) currently accepts free text via `ink-text-input` (`src/tui/inputPanel.js`). Users frequently need to reference file paths in prompts but must type them by hand. The `/skills`, `/sessions`, and `/memory` panels already establish a visual pattern for list selection (the `▸` indicator, rotating window, cyan highlight) using `ink-select-input`.

The challenge is focus ownership. Ink has no `stopPropagation` — when two components both register `useInput`, both receive every keystroke. The `/skills` panel solved this with a single `useInput` handler that owns both filtering and navigation. The file picker needs the same approach, but it must also own the input text itself (including cursor movement) while open, because the filter depends on the cursor position.

## Goals / Non-Goals

**Goals:**
- Provide a live, keyboard-driven file path autocomplete triggered by `@`.
- Derive the filter from the token at the cursor (cursor-aware), so moving the cursor doesn't break the filter.
- Own all input while the picker is open so there's no focus conflict with `ink-text-input`.
- Match the existing `/skills` and `/sessions` visual pattern.
- Keep the filter a pure substring match — never a glob pattern — to prevent glob injection.

**Non-Goals:**
- Reading file contents (list-only).
- Escaping quotes inside paths (documented limitation).
- Changing `/skills`, `/sessions`, or `/memory` behavior.
- Supporting multiple `@` tokens simultaneously.

## Decisions

### Decision 1: The picker owns the input while open
The `FilePicker` renders the input text with a cursor (replicating `ink-text-input`'s inverse cursor) and handles all keys: printable (insert at cursor), backspace (delete before cursor), left/right (move cursor), up/down (navigate list), Enter (select), Escape (close). The `InputPanel` is set to `focus={false}` while the picker is open.

**Alternatives considered:**
- *Keep `ink-text-input` active and add a separate filter handler* — rejected. Ink has no `stopPropagation`, so both handlers would receive every keystroke, causing the focus conflict the codebase deliberately avoids.
- *Use `ink-select-input` directly* — rejected. It doesn't filter; it only navigates a pre-built `items` array. Filtering must live in our code.

### Decision 2: Cursor-aware filter derivation
The filter is the text between the `@` and the cursor, where the token is bounded by whitespace (unquoted) or quotes (quoted). If the cursor moves out of the `@` token, the picker closes.

**Alternatives considered:**
- *Filter = text between last `@` and end of input* — rejected. Breaks when the cursor moves left; the slice can become empty and show every file.

### Decision 3: Glob once, filter in JS
Use `fast-glob` with a fixed pattern (`**/*`), excluding `node_modules`, `.git`, and `dist`, with `onlyFiles: true` and a depth cap. Cache the initial glob result; subsequent filtering is a JS substring match, not a re-glob. Debounce the initial glob at ~250ms.

**Alternatives considered:**
- *Re-glob on every keystroke* — rejected. Too slow and wasteful.
- *Use the filter as a glob pattern* — rejected. Glob-injection risk.

### Decision 4: Rotating window with up to 3 visible options
Mirror `ink-select-input`'s `limit` behavior: show up to 3 visible options with a rotating window so up/down scrolls through all results while 3 are visible. Use the `▸` indicator.

## Risks / Trade-offs

- [Focus conflict if `InputPanel` isn't unfocused] → Set `focus={false}` on `InputPanel` and bail in App-level `useInput` via `isPickerOpen()`.
- [Cursor-aware filter breaks if cursor moves out of token] → Close the picker when the cursor leaves the `@` token.
- [Large directory glob is slow] → Cache the initial glob, debounce, cap depth, exclude heavy dirs.
- [Paths with whitespace need quoting] → Wrap the selected path in quotes on insert.
- [Quotes inside paths not escaped] → Documented limitation, not a bug.

## Migration Plan

No migration — this is a new feature. Rollback is reverting the PR.

## Open Questions

None.
