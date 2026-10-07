## ADDED Requirements

### Requirement: TUI overscan configuration option
The system SHALL provide a `tui.overscan` configuration option that controls how many messages are mounted beyond the viewport on each side in the virtualized scroll view. It SHALL be a non-negative integer, defaulting to 10.

#### Scenario: overscan defaults to 10
- **WHEN** `tui.overscan` is not set in config
- **THEN** the value defaults to 10

#### Scenario: overscan is a non-negative integer
- **WHEN** `tui.overscan` is set to a non-negative integer
- **THEN** the schema accepts it

#### Scenario: overscan rejects negative values
- **WHEN** `tui.overscan` is set to a negative integer
- **THEN** the schema rejects it

#### Scenario: overscan is threaded to MessageList
- **WHEN** the app renders the conversation panel
- **THEN** the `overscan` value is threaded through `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`
