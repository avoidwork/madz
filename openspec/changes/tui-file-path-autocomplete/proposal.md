## Why

Users frequently reference files in prompts (e.g., "read @src/config/loader.js and fix it") but must type the full path by hand. This adds a live, keyboard-driven file path autocomplete to the TUI input bar: typing `@` followed by a character opens a picker below the input showing matching file paths from the current working directory, and selecting a result replaces the `@`-prefixed token with the full path.

## What Changes

- Add a self-contained `FilePicker` component in `src/tui/filePicker.js` that owns the input while open.
- Derive the autocomplete filter from the token at the cursor (cursor-aware), bounded by whitespace (unquoted) or quotes (quoted). Active only when the cursor is inside an `@` token.
- Glob the user's cwd with `fast-glob` using a fixed pattern `**/*`, ignoring `node_modules`, `.git`, and `dist`, with `onlyFiles: true` and a depth cap. Filter in JS (case-insensitive substring match) — never use the filter as a glob pattern.
- Debounce the glob at ~250ms on filter change and cache the initial glob result.
- Render up to 3 visible options, sorted alphabetically, with a rotating window and the `▸` indicator.
- On Enter, replace the `@` token (token start to token end) with the full selected path; wrap in quotes if the path contains whitespace.
- Wire the picker into `InputArea` (render below `InputPanel`, set `focus={false}` while open, expose `isPickerOpen()`), and bail in the App-level global `useInput`.
- Promote `fast-glob` from a transitive to a direct dependency.
- Add unit tests in `tests/unit/tui/filePicker.test.js` and a test that the App bails when the picker is open.

## Capabilities

### New Capabilities

- `tui-file-path-autocomplete`: Defines the file path autocomplete behavior in the TUI input bar — the self-contained picker component, cursor-aware filter derivation with token boundaries, the fixed-pattern glob with JS-only filtering, the rotating-window list rendering, and the `@`-token replacement on selection.

### Modified Capabilities

<!-- No existing capability specs are modified — this is a new feature with no changes to existing spec-level behavior. -->

## Impact

- **Affected code:** `src/tui/filePicker.js` (new), `src/tui/inputArea.js` (render picker, expose `isPickerOpen()`), `src/tui/app.js` (bail global `useInput`), `src/tui/inputPanel.js` (unfocus while open — existing `focus` prop).
- **Dependency change:** `fast-glob` promoted to a direct dependency in `package.json`.
- **Test impact:** New `tests/unit/tui/filePicker.test.js`; App bail test.

## Non-goals

- Handling escapes in paths — quotes are literal boundaries (documented limitation).
- Reading file contents — the picker lists files only (read-only).
- Changing issue labels.
- Any behavior outside the TUI input autocomplete.
