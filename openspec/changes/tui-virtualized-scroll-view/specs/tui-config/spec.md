## ADDED Requirements

### Requirement: TUI overscan configuration
The system SHALL provide a `tui.overscan` configuration option that controls the number of messages mounted beyond the viewport on each side in the virtualized conversation panel.

#### Scenario: overscan defaults to 10
- **WHEN** `tui.overscan` is not set in config
- **THEN** the value defaults to 10

#### Scenario: overscan is a non-negative integer
- **WHEN** `tui.overscan` is validated by the TuiSchema
- **THEN** it is a non-negative integer (`z.number().int().min(0)`)

#### Scenario: overscan is threaded to MessageList
- **WHEN** the app renders the conversation panel
- **THEN** the `overscan` config value flows from `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`

#### Scenario: renderWindow is removed
- **WHEN** the TuiSchema Zod schema is validated
- **THEN** it does not include a `renderWindow` field
