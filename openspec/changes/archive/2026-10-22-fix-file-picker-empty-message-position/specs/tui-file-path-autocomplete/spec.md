## ADDED Requirements

### Requirement: Empty message renders below input line
The system SHALL render the " No matching files." empty message on a distinct line below the input line when the `@` filter matches no files, so the typed input remains visible.

#### Scenario: Empty message renders below the input line
- **WHEN** the file picker is open and the `@` filter matches no files (e.g., `@src/confg` where `confg` does not exist)
- **THEN** the " No matching files." message renders on a line below the input line, and the typed input remains visible

#### Scenario: Input line is a distinct row
- **WHEN** the file picker is open
- **THEN** the input `Text` (the `before`/`at`/`after` cursor rendering) is wrapped in its own `Box` row so it occupies a distinct line
