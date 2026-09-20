## ADDED Requirements

### Requirement: Picker opens on @ token
The system SHALL open the file path picker when the cursor is inside an `@` token in the TUI input bar. The picker is a self-contained input+list component that owns the input while open.

#### Scenario: Picker opens on @ followed by a character
- **WHEN** the user types `@` followed by a printable character in the input bar
- **THEN** the picker opens below the input showing matching file paths from the current working directory

#### Scenario: Picker does not open on @ with no following character
- **WHEN** the user types `@` at the end of the input with no following character
- **THEN** the picker does not open (or shows no results)

#### Scenario: Picker closes when cursor leaves the @ token
- **WHEN** the cursor moves out of the `@` token (before the `@`, or into a different token)
- **THEN** the picker closes

### Requirement: Cursor-aware filter derivation
The system SHALL derive the autocomplete filter as the text between the last `@` and the cursor, bounded by whitespace (unquoted) or quotes (quoted). The filter is trimmed and used only as a case-insensitive substring match against file paths — never as a glob pattern.

#### Scenario: Unquoted token bounded by whitespace
- **WHEN** the input is `@foo bar` with the cursor inside the `@foo` token
- **THEN** the filter is `foo` (the space ends the token)

#### Scenario: Quoted token bounded by quotes
- **WHEN** the input is `"@foo bar"` with the cursor inside the token
- **THEN** the filter is `foo bar` (quotes contain the path, so spaces within quotes are part of the path)

#### Scenario: Filter is trimmed
- **WHEN** the filter text has leading or trailing whitespace
- **THEN** the filter is trimmed before matching

#### Scenario: Filter is a substring match, not a glob
- **WHEN** the filter contains glob metacharacters (e.g., `*`, `?`, `[`)
- **THEN** they are treated literally as substring characters, never interpolated into a glob pattern

### Requirement: Fixed-pattern glob with JS-only filtering
The system SHALL glob the user's current working directory using a fixed pattern `**/*`, ignoring `node_modules`, `.git`, and `dist`, with `onlyFiles: true` and a depth cap. The filter is applied in JS as a case-insensitive substring match against the cached file list — never as a glob pattern.

#### Scenario: Glob ignores node_modules, .git, and dist
- **WHEN** the file list is globbed
- **THEN** files under `node_modules`, `.git`, and `dist` are excluded

#### Scenario: Glob returns only files
- **WHEN** the file list is globbed
- **THEN** only files are returned (no directories)

#### Scenario: Glob has a depth cap
- **WHEN** the file list is globbed
- **THEN** the glob is bounded by a depth cap to avoid traversing the entire filesystem

#### Scenario: Filter is applied in JS, not as a glob
- **WHEN** the user refines the filter
- **THEN** the cached file list is filtered in JS by case-insensitive substring match, not re-globbed with the filter

### Requirement: Debounced glob with cached result
The system SHALL debounce the glob at ~250ms on filter change and cache the initial glob result so re-filtering is a JS filter, not a re-glob.

#### Scenario: Glob is debounced
- **WHEN** the filter changes rapidly
- **THEN** the glob is debounced at ~250ms to avoid re-rendering too fast

#### Scenario: Initial glob result is cached
- **WHEN** the filter changes after the initial glob
- **THEN** re-filtering uses the cached file list, not a re-glob

### Requirement: Rotating-window list rendering
The system SHALL render up to 3 visible options, sorted alphabetically, with a rotating window and the `▸` indicator.

#### Scenario: Up to 3 visible options
- **WHEN** there are more than 3 matching files
- **THEN** only 3 are visible at a time

#### Scenario: Results sorted alphabetically
- **WHEN** the matching files are rendered
- **THEN** they are sorted alphabetically

#### Scenario: Rotating window navigation
- **WHEN** the user navigates up/down
- **THEN** the visible window rotates through all results while 3 remain visible

#### Scenario: Selected option has indicator
- **WHEN** an option is selected
- **THEN** it is marked with the `▸` indicator

### Requirement: Single useInput handler owns the picker
The system SHALL use a single `useInput` handler to own the picker while it is open, handling printable characters (insert at cursor), backspace (delete before cursor), left/right (move cursor), up/down (navigate list), enter (select), and escape (close).

#### Scenario: Printable characters insert at cursor
- **WHEN** the user types a printable character while the picker is open
- **THEN** it is inserted at the cursor position and the filter is refined

#### Scenario: Backspace deletes before cursor
- **WHEN** the user presses backspace while the picker is open
- **THEN** the character before the cursor is deleted

#### Scenario: Left/right move the cursor
- **WHEN** the user presses left or right while the picker is open
- **THEN** the cursor moves and the filter is re-derived from the token at the cursor

#### Scenario: Up/down navigate the list
- **WHEN** the user presses up or down while the picker is open
- **THEN** the selection moves through the list

#### Scenario: Enter selects
- **WHEN** the user presses Enter while the picker is open
- **THEN** the `@` token is replaced with the full selected path and the picker closes

#### Scenario: Escape closes
- **WHEN** the user presses Escape while the picker is open
- **THEN** the picker closes without replacing the token

### Requirement: Selection replaces the @ token
On Enter, the system SHALL replace the `@` token (from token start to token end) with the full selected path. If the path contains whitespace, it SHALL be wrapped in quotes.

#### Scenario: Token replaced with full path
- **WHEN** the user selects a file path
- **THEN** the `@` token is replaced with the full selected path

#### Scenario: Path with whitespace is quoted
- **WHEN** the selected path contains whitespace
- **THEN** it is wrapped in quotes

#### Scenario: Path without whitespace is not quoted
- **WHEN** the selected path contains no whitespace
- **THEN** it is not wrapped in quotes

### Requirement: InputPanel unfocused while picker open
While the picker is open, the system SHALL set `focus={false}` on the `InputPanel` so its handler goes inactive, and the App-level global `useInput` SHALL bail when the picker is open.

#### Scenario: InputPanel unfocused while picker open
- **WHEN** the picker is open
- **THEN** the `InputPanel` gets `focus={false}` so it stops capturing keystrokes

#### Scenario: App-level useInput bails when picker open
- **WHEN** the picker is open and the user presses a key
- **THEN** the App-level global `useInput` returns early via `isPickerOpen()` so up/down and Escape don't steal keys from the picker

#### Scenario: isPickerOpen exposed on input ref
- **WHEN** the picker is open
- **THEN** `isPickerOpen()` is exposed on the input ref and returns true

### Requirement: fast-glob is a direct dependency
The `fast-glob` package SHALL be promoted from a transitive to a direct dependency in `package.json`.

#### Scenario: fast-glob in dependencies
- **WHEN** `package.json` is inspected
- **THEN** `fast-glob` appears in the `dependencies` section
