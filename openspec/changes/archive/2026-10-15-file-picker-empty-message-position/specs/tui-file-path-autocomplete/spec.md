## ADDED Requirements

### Requirement: Empty message renders below the input line
The system SHALL render the " No matching files." empty message on a distinct line below the input line, so the user's typed text remains visible when the `@` filter matches no files.

#### Scenario: Empty message is below the input line
- **WHEN** the file picker is open and the `@` filter matches no files
- **THEN** the " No matching files." message is rendered on a line below the input line, and the typed input remains visible

#### Scenario: Typed input remains visible when filter matches nothing
- **WHEN** the file picker is open and the user has typed a filter that matches no files (e.g., a typo)
- **THEN** the user can still see the text they typed above the empty message
