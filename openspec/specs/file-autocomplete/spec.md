# file-autocomplete Specification

## Purpose
TBD - created by archiving change tui-filepath-autocomplete. Update Purpose after archive.
## Requirements
### Requirement: @-triggered autocomplete activation
The system SHALL display a file path autocomplete overlay when the user types the `@` character in the TUI input panel. The overlay SHALL appear above the input bar and SHALL be dismissible.

#### Scenario: Autocomplete activates on @
- **WHEN** the user types `@` in the input panel
- **THEN** the system displays a scrollable file list overlay above the input bar

#### Scenario: Autocomplete does not activate on other characters
- **WHEN** the user types any character other than `@` in the input panel
- **THEN** the autocomplete overlay does not appear

#### Scenario: Autocomplete does not activate during streaming
- **WHEN** the system is streaming an AI response and the user types `@`
- **THEN** the autocomplete overlay does not appear

### Requirement: File list population
The system SHALL populate the autocomplete file list by recursively scanning the project root directory, respecting `.gitignore` patterns, and excluding directories listed in a default blacklist (`node_modules`, `.git`, `dist`, `build`).

#### Scenario: File list includes project files
- **WHEN** the autocomplete overlay is activated
- **THEN** the system displays a list of project files (relative paths from project root)

#### Scenario: File list respects .gitignore
- **WHEN** the autocomplete overlay is activated
- **THEN** files matching `.gitignore` patterns are excluded from the list

#### Scenario: File list excludes blacklisted directories
- **WHEN** the autocomplete overlay is activated
- **THEN** files within `node_modules`, `.git`, `dist`, and `build` directories are excluded

#### Scenario: File list respects extension whitelist
- **WHEN** the autocomplete overlay is activated
- **THEN** files with extensions not in the whitelist (default: `.js`, `.ts`, `.json`, `.yaml`, `.yml`, `.md`, `.txt`, `.css`, `.html`, `.mjs`, `.cjs`) are excluded

#### Scenario: File list is capped
- **WHEN** the project contains more than 5000 files
- **THEN** the system limits the file list to 5000 entries

#### Scenario: File list excludes symlinks
- **WHEN** the autocomplete overlay is activated
- **THEN** symbolic links are excluded from the file list

### Requirement: Fuzzy text filtering
The system SHALL filter the file list based on the text typed after `@` using case-insensitive substring matching with prefix scoring.

#### Scenario: Filter matches prefix
- **WHEN** the user types `@src` in the input panel
- **THEN** files starting with `src/` appear at the top of the filtered list

#### Scenario: Filter matches substring
- **WHEN** the user types `@input` in the input panel
- **THEN** files containing `input` in their path appear in the filtered list

#### Scenario: Filter is case-insensitive
- **WHEN** the user types `@SRC` in the input panel
- **THEN** files starting with `src/` appear in the filtered list

#### Scenario: Empty filter shows all files
- **WHEN** the user types only `@` with no additional characters
- **THEN** the full file list is displayed (subject to cache and cap)

### Requirement: Arrow key navigation
The system SHALL allow the user to navigate the file list using up and down arrow keys. The currently selected file SHALL be visually highlighted.

#### Scenario: Down arrow moves selection down
- **WHEN** the autocomplete overlay is active and the user presses the down arrow key
- **THEN** the selection moves to the next file in the list

#### Scenario: Up arrow moves selection up
- **WHEN** the autocomplete overlay is active and the user presses the up arrow key
- **THEN** the selection moves to the previous file in the list

#### Scenario: Selection wraps at boundaries
- **WHEN** the user is at the last file and presses down arrow
- **THEN** the selection wraps to the first file

#### Scenario: Selection wraps at boundaries (up)
- **WHEN** the user is at the first file and presses up arrow
- **THEN** the selection wraps to the last file

### Requirement: Enter selects and inserts path
The system SHALL insert the selected file path into the input text at the cursor position when the user presses Enter.

#### Scenario: Enter inserts path at cursor
- **WHEN** the user selects a file and presses Enter
- **THEN** the file path is inserted at the current cursor position in the input text

#### Scenario: Enter dismisses overlay
- **WHEN** the user selects a file and presses Enter
- **THEN** the autocomplete overlay is dismissed

#### Scenario: Enter appends space after path
- **WHEN** the user selects a file and presses Enter
- **THEN** a space character is appended after the inserted path

### Requirement: Escape dismisses overlay
The system SHALL dismiss the autocomplete overlay and return focus to the input panel when the user presses Escape.

#### Scenario: Escape dismisses overlay
- **WHEN** the autocomplete overlay is active and the user presses Escape
- **THEN** the overlay is dismissed and the input panel retains focus

#### Scenario: Escape clears @ trigger
- **WHEN** the autocomplete overlay is dismissed via Escape
- **THEN** the `@` character and any typed filter text are removed from the input

### Requirement: File list caching
The system SHALL cache the file list after the initial scan and reuse the cache for subsequent activations, invalidating the cache after a configurable TTL (default 30 seconds).

#### Scenario: Cache is populated on first scan
- **WHEN** the autocomplete overlay is activated for the first time
- **THEN** the system scans the project directory and caches the result

#### Scenario: Cached list is reused within TTL
- **WHEN** the autocomplete overlay is activated within the TTL period
- **THEN** the system uses the cached file list without rescanning

#### Scenario: Cache is invalidated after TTL
- **WHEN** the TTL period has elapsed since the last scan
- **THEN** the system rescans the project directory on next activation

### Requirement: Cursor position tracking
The system SHALL track the cursor position within the input panel and insert the selected file path at that position.

#### Scenario: Path inserted at cursor start
- **WHEN** the cursor is at position 0 and the user selects a file
- **THEN** the file path is inserted at the beginning of the input text

#### Scenario: Path inserted at cursor middle
- **WHEN** the cursor is at position 10 and the user selects a file
- **THEN** the file path is inserted at position 10, pushing existing text forward

#### Scenario: Path inserted at cursor end
- **WHEN** the cursor is at the end of the input text and the user selects a file
- **THEN** the file path is appended after the existing text

### Requirement: Scrollable file list
The system SHALL render the file list in a scrollable container that displays a maximum of 15 entries at a time.

#### Scenario: List scrolls when entries exceed viewport
- **WHEN** the filtered file list exceeds 15 entries
- **THEN** the user can scroll through the list using arrow keys or mouse wheel

#### Scenario: List shows fewer entries when available
- **WHEN** the filtered file list contains fewer than 15 entries
- **THEN** the list displays only the available entries without scroll indicators

### Requirement: Selected file highlighting
The system SHALL visually distinguish the currently selected file in the autocomplete list using a highlight indicator.

#### Scenario: First file is selected by default
- **WHEN** the autocomplete overlay is activated
- **THEN** the first file in the list is highlighted as selected

#### Scenario: Highlight follows selection
- **WHEN** the user navigates with arrow keys
- **THEN** the highlight moves to the newly selected file

