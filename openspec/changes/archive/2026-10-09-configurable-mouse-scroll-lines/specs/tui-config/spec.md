## ADDED Requirements

### Requirement: TUI mouse scroll lines configuration option
The system SHALL provide a `tui.mouseScrollLines` configuration option that controls how many lines the conversation panel scrolls per mouse wheel event. It SHALL be a positive integer, defaulting to 1.

#### Scenario: mouseScrollLines defaults to 1
- **WHEN** `tui.mouseScrollLines` is not set in config
- **THEN** the value defaults to 1

#### Scenario: mouseScrollLines is a positive integer
- **WHEN** `tui.mouseScrollLines` is set to a positive integer
- **THEN** the schema accepts it

#### Scenario: mouseScrollLines rejects zero
- **WHEN** `tui.mouseScrollLines` is set to 0
- **THEN** the schema rejects it

#### Scenario: mouseScrollLines rejects negative values
- **WHEN** `tui.mouseScrollLines` is set to a negative integer
- **THEN** the schema rejects it

#### Scenario: mouseScrollLines rejects non-integers
- **WHEN** `tui.mouseScrollLines` is set to a non-integer (e.g., 1.5)
- **THEN** the schema rejects it
