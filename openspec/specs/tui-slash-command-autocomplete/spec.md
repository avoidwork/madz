# tui-slash-command-autocomplete Specification

## Purpose
TBD - created by archiving change tui-slash-command-autocomplete-editor-mode. Update Purpose after archive.
## Requirements
### Requirement: Trigger command picker on / token
The system SHALL open the command picker only when the input contains a `/` token that is the trigger token at a word boundary (start of input or preceded by a space), the cursor is at the end of the token, and the token is followed by a non-whitespace character.

#### Scenario: Picker opens on / followed by a character
- **WHEN** the user types `/` followed by a printable character in the input bar, where the `/` is at a word boundary (start of input or preceded by a space) and the cursor is at the end of the token
- **THEN** the command picker opens below the input showing matching commands and skills

#### Scenario: Picker does not open on bare /
- **WHEN** the input contains only `/` with no following character
- **THEN** the command picker does not open

#### Scenario: Picker does not open on / mid-string
- **WHEN** the input contains `/` in the middle of a string (e.g., a pasted URL `https://example.com`)
- **THEN** the command picker does not open

#### Scenario: Picker does not open on / not preceded by a space
- **WHEN** the input contains `/` that is not preceded by a space and is not at the start of the input
- **THEN** the command picker does not open

#### Scenario: Picker does not open on / followed by a space
- **WHEN** the user types `/` and then a space
- **THEN** the command picker does not open

### Requirement: Cursor-aware command filter derivation
The system SHALL derive the command filter from the token at the cursor, where the token starts with `/` and is bounded by whitespace. The filter is the text between the `/` and the cursor.

#### Scenario: Filter is text between / and cursor
- **WHEN** the cursor is within a `/` token
- **THEN** the filter is the text between the `/` and the cursor position

#### Scenario: Picker closes when cursor leaves the / token
- **WHEN** the cursor moves out of the `/` token (before the `/` or into a different token)
- **THEN** the command picker closes

### Requirement: Command list from registered commands and skills
The system SHALL populate the command picker with the registered command names from `CommandParser.listCommands()` plus the available skill names, so both commands and skills appear as suggestions.

#### Scenario: Registered commands are listed
- **WHEN** the picker opens
- **THEN** the picker lists registered command names (e.g., `config`, `provider`, `schedule`)

#### Scenario: Skills are listed
- **WHEN** the picker opens and skills are available
- **THEN** the picker lists skill names alongside commands

### Requirement: Filter is substring match only
The system SHALL treat the command filter as a case-insensitive substring match against the command list, never interpolating it into a glob pattern.

#### Scenario: Filter matches case-insensitively
- **WHEN** the filter is `CON` and a command is `config`
- **THEN** the command is included in the results

#### Scenario: Filter is not used as a glob pattern
- **WHEN** the filter contains glob metacharacters (e.g., `*`, `?`, `[`)
- **THEN** those characters are treated literally as part of the substring match

### Requirement: Selection replaces / token
The system SHALL replace the `/` token (from token start to token end) with the selected command name on Enter.

#### Scenario: Command replaces token
- **WHEN** the user selects a command
- **THEN** the `/` token is replaced with the command name as-is

### Requirement: Command picker owns input while open
The system SHALL have the command picker own all input while it is open, handling printable characters (insert at cursor), backspace (delete before cursor), left/right (move cursor), up/down (navigate list), Enter (select), and Escape (close).

#### Scenario: Printable characters insert at cursor
- **WHEN** the command picker is open and the user types a printable character
- **THEN** the character is inserted at the cursor position and the filter updates

#### Scenario: Up/down navigate the list
- **WHEN** the command picker is open and the user presses up or down
- **THEN** the highlighted suggestion changes

#### Scenario: Enter selects the highlighted command
- **WHEN** the command picker is open and the user presses Enter
- **THEN** the selected command replaces the `/` token and the picker closes

#### Scenario: Escape closes the picker
- **WHEN** the command picker is open and the user presses Escape
- **THEN** the picker closes without selecting

### Requirement: Command picker and file picker are mutually exclusive
The system SHALL not have the command picker and the file picker open at the same time; only one input handler owns keystrokes at a time.

#### Scenario: Command picker closes the file picker
- **WHEN** the file picker is open and the user types a `/` trigger token
- **THEN** the file picker closes and the command picker opens

#### Scenario: File picker closes the command picker
- **WHEN** the command picker is open and the user types an `@` trigger token
- **THEN** the command picker closes and the file picker opens

### Requirement: Command picker does not render an empty message when the filter has no matches
The system SHALL not render a " No matching commands." empty message below the input line when the command picker's filter matches no commands; the typed input line SHALL remain fully visible and unobscured.

#### Scenario: No empty message on a typo filter
- **WHEN** the user types a `/` token whose filter matches no commands (e.g. `/confg`)
- **THEN** the command picker renders nothing below the input line and the typed input line remains fully visible

#### Scenario: Empty message text is never present
- **WHEN** the command picker renders with a filter that matches no commands
- **THEN** the rendered output does not contain the text " No matching commands."

#### Scenario: Typed input line always renders
- **WHEN** the command picker renders with a filter that matches no commands
- **THEN** the typed input line is always rendered

