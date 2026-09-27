## MODIFIED Requirements

### Requirement: Trigger file picker on @ token
The system SHALL open the file picker when the input contains an `@` token at the end of the input, preceded by a space (or at index 0), and followed by alphanumeric characters. The `@` must be the final token in the input. A pasted string with `@` in the middle (e.g., a git repo URL like `git@github.com:owner/repo.git`) SHALL NOT open the picker.

#### Scenario: Picker opens on @ followed by a character
- **WHEN** the user types `@` followed by a printable character in the input bar, where the `@` is at the end of the input and preceded by a space
- **THEN** the file picker opens below the input showing matching file paths

#### Scenario: Picker does not open on bare @
- **WHEN** the input contains only `@` with no following character
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ mid-string
- **WHEN** the input contains `@` in the middle of a string (e.g., a git repo URL like `git@github.com:owner/repo.git`)
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ not preceded by a space
- **WHEN** the input contains `@` not preceded by a space (e.g., `git@github.com`)
- **THEN** the file picker does not open

#### Scenario: Picker does not open on @ not at the end of input
- **WHEN** the input contains `@` followed by content and a space (e.g., `@src/config more text`)
- **THEN** the file picker does not open
