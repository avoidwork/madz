## Why

When referencing files in conversations (e.g., "look at src/tui/app.js"), users must manually type full or partial paths. This is error-prone and slow, especially for deeply nested paths. A lightweight autocomplete triggered by `@` would reduce typos, speed up file references, and make the TUI feel more polished.

## What Changes

- Extend `InputPanel` component to detect `@` trigger and enter autocomplete mode.
- Add glob-based file search using `fast-glob` to find matching files in the project root.
- Render a dropdown list below the input line with keyboard navigation (up/down arrows, Enter to select, Esc to dismiss).
- Lift autocomplete state (`inAutocomplete`, `query`, `matches`, `selectedIndex`) to the App component.
- Replace `@<query>` with the full file path on selection; render filename portion in cyan/green.
- Show "No files match" when the glob returns zero results.
- Add `fast-glob` as a project dependency.

## Capabilities

### New Capabilities
- `tui-autocomplete`: @-triggered file path autocomplete with glob search, dropdown rendering, and keyboard navigation in the TUI input panel.

### Modified Capabilities
- None

## Impact

- **Affected code:** `src/tui/inputPanel.js` (extend with autocomplete mode), `src/tui/app.js` (lift state, pass props), `src/tui/statusBar.js` (dropdown renders between InputPanel and StatusBar).
- **Dependencies:** New dependency `fast-glob`.
- **TUI rendering:** Dropdown is a sibling component below InputPanel (Ink does not support z-index overlays).
- **Keyboard handling:** Autocomplete mode intercepts arrow keys and Enter before `ink-text-input` processes them.

## Non-goals

- Tab completion or other trigger characters.
- Fuzzy search (fuse.js) — prefix matching via glob is sufficient.
- Inline completion (VS Code-style).
- Autocomplete in non-input contexts (e.g., memory panel, settings).
- Caching of glob results across sessions.
