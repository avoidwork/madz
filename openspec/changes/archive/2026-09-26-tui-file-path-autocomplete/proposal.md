## Why

Users frequently reference files in prompts (e.g., "read @src/config/loader.js and fix it"). Currently they must type the full path by hand or copy it from elsewhere. This feature removes that friction by providing a live, keyboard-driven file picker directly in the input bar.

## What Changes

- Add a `FilePicker` component (`src/tui/filePicker.js`) rendered below the `InputPanel` when active.
- Trigger on typing `@` followed by a printable character; the character after `@` seeds the filter.
- Derive the filter from the token at the cursor (cursor-aware), bounded by whitespace (unquoted) or quotes (quoted).
- Glob the cwd for files with a fixed pattern (`**/*`), excluding `node_modules`, `.git`, and `dist`; cache the initial glob and re-filter in JS.
- Render results sorted alphabetically with a rotating window (up to 3 visible), using the `▸` indicator matching `/skills` and `/sessions`.
- Own all input while the picker is open via a single `useInput` handler: printable chars refine, backspace deletes, left/right move cursor, up/down navigate, Enter selects, Escape closes.
- On Enter, replace the `@`-token with the full selected path (wrapped in quotes if it contains whitespace) and close the picker.
- Wire into `InputArea` (render, `focus={false}` on `InputPanel`, expose `isPickerOpen()`).
- Bail in App-level `useInput` when the picker is open so up/down (history) and Escape (interrupt) don't steal keys.
- Promote `fast-glob` from a transitive to a direct dependency.

## Capabilities

### New Capabilities
- `tui-file-path-autocomplete`: The file path autocomplete capability for the TUI input bar — trigger, cursor-aware filter derivation, file listing, keyboard navigation, selection, and focus handling.

### Modified Capabilities
- `input-cursor`: The input cursor rendering behavior is affected when the picker owns the input while open (cursor is rendered by the picker, not `ink-text-input`).
- `tui-cursor-positioning`: The real terminal cursor positioning is delegated to the picker while it owns the input.

## Impact

- **New file**: `src/tui/filePicker.js` — the picker component.
- **Modified**: `src/tui/inputArea.js` — render the picker, expose `isPickerOpen()`.
- **Modified**: `src/tui/inputPanel.js` — set `focus={false}` while the picker is open.
- **Modified**: `src/tui/app.js` — bail in global `useInput` when the picker is open.
- **Dependency**: `fast-glob` promoted to a direct dependency.
- **Tests**: `tests/unit/tui/filePicker.test.js` and updates to `tests/unit/tui/inputArea.test.js` / `tests/unit/tui/app.test.js`.

## Non-goals

- Reading file contents (list-only).
- Glob-pattern injection — the filter is always a substring match, never interpolated into a glob.
- Escaping quotes inside paths (documented limitation).
- Any change to the `/skills`, `/sessions`, or `/memory` panel behavior.
