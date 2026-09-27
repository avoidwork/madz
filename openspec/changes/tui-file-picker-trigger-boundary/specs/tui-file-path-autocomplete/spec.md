## MODIFIED Requirements

### Requirement: Trigger file picker on @ token
The system SHALL open the file picker only when the input contains an `@` token that is the trigger token at a word boundary (start of input or preceded by a space), the cursor is at the end of the token, and the token is followed by word characters. The trigger is validated with a regex using `\w`.

#### Scenario: Picker opens on @ followed by a character
- **WHEN** the user types `@` followed by a printable character in the input bar, where the `@` is at a word boundary (start of input or preceded by a space) and the cursor is at the end of the token
- **THEN** the file picker opens below the input showing matching file paths

#### Scenario: Picker does not open on bare @
- **WHEN** the input contains only `@` with no following character
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ mid-string
- **WHEN** the input contains `@` in the middle of a string (e.g., a pasted git repo URL `git@github.com:owner/repo.git`)
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ not preceded by a space
- **WHEN** the input contains `@` that is not preceded by a space and is not at the start of the input (e.g., `git@github.com`)
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ followed by a space
- **WHEN** the user types `@` and then a space
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ not at the end of input
- **WHEN** the cursor is not at the end of the `@` token (e.g., the cursor is before the `@` or the token has trailing characters after the cursor)
- **THEN** the file picker does not open
