## ADDED Requirements

### Requirement: Trigger file picker on @ token
The system SHALL open the file picker when the input contains an `@` token with content after it, where the token is bounded by whitespace (unquoted) or quotes (quoted).

#### Scenario: Picker opens on @ followed by a character
- **WHEN** the user types `@` followed by a printable character in the input bar
- **THEN** the file picker opens below the input showing matching file paths

#### Scenario: Picker does not open on bare @
- **WHEN** the input contains only `@` with no following character
- **THEN** the file picker does not open

#### Scenario: Picker does not open for a quoted @ with no filter
- **WHEN** the input contains `"@` with no content after the `@` inside the quotes
- **THEN** the file picker does not open

### Requirement: Cursor-aware filter derivation
The system SHALL derive the filter from the token at the cursor, where the token starts with `@` and is bounded by whitespace (unquoted) or quotes (quoted). The filter is the text between the `@` and the cursor.

#### Scenario: Filter is text between @ and cursor
- **WHEN** the cursor is within an `@` token
- **THEN** the filter is the text between the `@` and the cursor position

#### Scenario: Picker closes when cursor leaves the @ token
- **WHEN** the cursor moves out of the `@` token (before the `@` or into a different token)
- **THEN** the file picker closes

#### Scenario: Quoted token includes spaces
- **WHEN** the token is quoted (e.g., `"@foo bar"`)
- **THEN** spaces within the quotes are part of the token and the filter

### Requirement: File list from cwd
The system SHALL glob the current working directory for files using a fixed pattern, excluding `node_modules`, `.git`, and `dist`, with `onlyFiles: true`.

#### Scenario: Files are listed from cwd
- **WHEN** the picker opens
- **THEN** the picker lists matching files from the current working directory

#### Scenario: Excluded directories are not listed
- **WHEN** the cwd contains `node_modules`, `.git`, or `dist` directories
- **THEN** files in those directories are not listed

### Requirement: Filter is substring match only
The system SHALL treat the filter as a case-insensitive substring match against file paths, never interpolating it into a glob pattern.

#### Scenario: Filter is not used as a glob pattern
- **WHEN** the filter contains glob metacharacters (e.g., `*`, `?`, `[`)
- **THEN** those characters are treated literally as part of the substring match

#### Scenario: Filter matches case-insensitively
- **WHEN** the filter is `src` and a file is `SRC/foo.js`
- **THEN** the file is included in the results

### Requirement: Rotating window list
The system SHALL render up to 3 visible options at a time with a rotating window, using the `▸` indicator, so up/down scrolls through all results while 3 are visible.

#### Scenario: Up to 3 options visible
- **WHEN** there are more than 3 matching files
- **THEN** only 3 options are visible at a time

#### Scenario: Navigation scrolls through all results
- **WHEN** the user presses down past the last visible option
- **THEN** the window rotates to show the next options

### Requirement: Picker owns input while open
The system SHALL have the picker own all input while it is open, handling printable characters (insert at cursor), backspace (delete before cursor), left/right (move cursor), up/down (navigate list), Enter (select), and Escape (close).

#### Scenario: Printable characters insert at cursor
- **WHEN** the picker is open and the user types a printable character
- **THEN** the character is inserted at the cursor position and the filter updates

#### Scenario: Backspace deletes before cursor
- **WHEN** the picker is open and the user presses backspace
- **THEN** the character before the cursor is deleted and the filter updates

#### Scenario: Left/right move the cursor
- **WHEN** the picker is open and the user presses left or right
- **THEN** the cursor moves and the filter re-derives

#### Scenario: Enter selects the highlighted path
- **WHEN** the picker is open and the user presses Enter
- **THEN** the selected path replaces the `@` token and the picker closes

#### Scenario: Escape closes the picker
- **WHEN** the picker is open and the user presses Escape
- **THEN** the picker closes without selecting

### Requirement: Selection replaces @ token
The system SHALL replace the `@` token (from token start to token end) with the full selected path on Enter, wrapping the path in quotes if it contains whitespace.

#### Scenario: Path without whitespace replaces token
- **WHEN** the selected path contains no whitespace
- **THEN** the `@` token is replaced with the path as-is

#### Scenario: Path with whitespace is quoted
- **WHEN** the selected path contains whitespace
- **THEN** the path is wrapped in quotes when inserted

### Requirement: InputPanel unfocused while picker open
The system SHALL set the `InputPanel` to `focus={false}` while the picker is open, and the App-level `useInput` SHALL bail when the picker is open.

#### Scenario: InputPanel is unfocused while picker open
- **WHEN** the picker is open
- **THEN** the `InputPanel` does not capture keystrokes

#### Scenario: App-level handler bails when picker open
- **WHEN** the picker is open and the user presses up/down or Escape
- **THEN** the App-level `useInput` does not handle those keys (history nav / interrupt)
