## Why

Users working in the TUI frequently need to reference files — passing file paths to the agent, referencing project structure, or including code snippets. Currently, they must manually type or paste full file paths, which is error-prone and slow. An @-triggered autocomplete that scans the project directory and presents a filtered, scrollable list of files eliminates manual typing and reduces path errors.

## What Changes

- Introduce an @-triggered file path autocomplete overlay in the TUI input panel
- When the user types `@`, a scrollable dropdown renders above the input bar showing project files (filtered by `.gitignore`)
- Arrow key navigation, fuzzy text filtering, Enter to select, Escape to dismiss
- File list is cached after first scan; subsequent `@` triggers use the cached list
- Cursor position tracking in the input panel to insert the selected path at the correct position
- New `fileAutocomplete` spec defining the autocomplete capability

## Capabilities

### New Capabilities
- `file-autocomplete`: @-triggered file path autocomplete with fuzzy filtering, scrollable list, arrow key navigation, and path insertion at cursor position

### Modified Capabilities
- `tui-interface`: Adds autocomplete overlay rendering and @-trigger behavior to the input panel keyboard interaction requirements
- `tui-event-routing`: Adds autocomplete-specific key event handling (up/down/enter/escape) when the autocomplete overlay is active

## Impact

- **Affected code**: `src/tui/inputPanel.js` (autocomplete detection and overlay rendering), `src/tui/app.js` (autocomplete state management and key routing), `src/tui/fileAutocomplete.js` (new component)
- **Dependencies**: No new npm dependencies required. File scanning uses Node.js `fs` module. `.gitignore` parsing uses a simple pattern matcher (no `ignore` package needed for basic glob patterns).
- **Breaking changes**: None. The autocomplete is opt-in via the `@` trigger character and does not affect existing input behavior.

## Non-goals

- Directory navigation (browsing subdirectories within the autocomplete)
- File content preview within the autocomplete
- Autocomplete for command names or skill names (reserved for future use)
- Network or remote file path suggestions
- Configurable trigger character (always `@`)
- Multi-cursor or multi-selection support
