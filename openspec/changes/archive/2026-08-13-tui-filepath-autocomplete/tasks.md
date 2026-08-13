## 1. Filesystem Scanner Module

- [ ] 1.1 Create `src/tui/fileScanner.js` with `scanProjectRoot()` function that recursively reads files from the project root directory
- [ ] 1.2 Implement `.gitignore` parsing using the `ignore` package (or manual parsing) to exclude ignored files
- [ ] 1.3 Implement default blacklist exclusion for `node_modules`, `.git`, `dist`, `build` directories
- [ ] 1.4 Implement file extension whitelist filtering (default: `.js`, `.ts`, `.json`, `.yaml`, `.yml`, `.md`, `.txt`, `.css`, `.html`, `.mjs`, `.cjs`)
- [ ] 1.5 Implement symlink exclusion from file list
- [ ] 1.6 Implement file list cap at 5000 entries
- [ ] 1.7 Return relative paths from project root for all scanned files

## 2. File List Cache

- [ ] 2.1 Create `src/tui/fileCache.js` with `FileCache` class using `tiny-lru` for TTL-based caching
- [ ] 2.2 Implement configurable TTL (default 30 seconds) via `tui.fileCacheTtl` config option
- [ ] 2.3 Implement cache invalidation on TTL expiry
- [ ] 2.4 Implement cache warm-up on first activation

## 3. Autocomplete Overlay Component

- [ ] 3.1 Create `src/tui/autocompletePanel.js` React component for the file autocomplete overlay
- [ ] 3.2 Implement scrollable container rendering max 15 entries at a time
- [ ] 3.3 Implement file list rendering with relative paths
- [ ] 3.4 Implement selected file highlighting with visual indicator
- [ ] 3.5 Implement scroll behavior for lists exceeding viewport

## 4. Input Integration

- [ ] 4.1 Modify `src/tui/inputPanel.js` to detect `@` character input and emit an event
- [ ] 4.2 Add cursor position tracking to `InputPanel` component
- [ ] 4.3 Pass cursor position state from `InputPanel` to parent `App` component

## 5. App-Level Autocomplete State

- [ ] 5.1 Add autocomplete state to `src/tui/app.js`: `showAutocomplete`, `selectedFileIndex`, `filteredFiles`, `cursorPosition`
- [ ] 5.2 Implement `@` detection in the input handler that triggers file scan or cache lookup
- [ ] 5.3 Implement fuzzy text filtering with case-insensitive substring matching and prefix scoring
- [ ] 5.4 Render the `AutocompletePanel` component above the input bar when active

## 6. Keyboard Navigation

- [ ] 6.1 Implement up/down arrow key handling for file list navigation in the app's `useInput` hook
- [ ] 6.2 Implement selection wrapping at list boundaries
- [ ] 6.3 Implement Enter key handling to select file and insert path at cursor position
- [ ] 6.4 Implement Escape key handling to dismiss overlay and clear `@` trigger
- [ ] 6.5 Ensure autocomplete keys take priority over message list navigation when overlay is active

## 7. Path Insertion

- [ ] 7.1 Implement file path insertion at the cursor position in the input text
- [ ] 7.2 Append a space character after the inserted path
- [ ] 7.3 Dismiss the autocomplete overlay after insertion
- [ ] 7.4 Handle edge case: cursor at beginning, middle, and end of input text

## 8. Integration with Existing Event Routing

- [ ] 8.1 Update `tui-interface` spec delta to document autocomplete overlay key interception
- [ ] 8.2 Update `tui-event-routing` spec delta to document Escape behavior override
- [ ] 8.3 Ensure autocomplete overlay does not interfere with streaming responses

## 9. Testing

- [ ] 9.1 Create `tests/unit/tui/fileScanner.test.js` with tests for file scanning, .gitignore parsing, blacklist exclusion, and cap
- [ ] 9.2 Create `tests/unit/tui/fileCache.test.js` with tests for TTL expiry and cache warm-up
- [ ] 9.3 Create `tests/unit/tui/autocompletePanel.test.js` with tests for rendering, selection, and scroll
- [ ] 9.4 Create `tests/unit/tui/fileFilter.test.js` with tests for fuzzy filtering, case-insensitivity, and prefix scoring

## 10. Configuration

- [ ] 10.1 Add `tui.fileCacheTtl` config option to `src/config/schemas/tui.js` with default 30000ms
- [ ] 10.2 Add `tui.maxAutocompleteEntries` config option with default 500
- [ ] 10.3 Add `tui.autocompleteMaxViewport` config option with default 15
- [ ] 10.4 Add `tui.autocompleteBlacklist` config option with default `['node_modules', '.git', 'dist', 'build']`

## 11. Polish

- [ ] 11.1 Run `npm run lint` and fix any issues
- [ ] 11.2 Run `npm run test` and verify all tests pass
- [ ] 11.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 11.4 Verify application starts with `timeout 10 npm start`
