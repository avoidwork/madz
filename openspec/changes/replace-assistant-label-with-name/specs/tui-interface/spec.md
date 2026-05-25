## MODIFIED Requirements

### Requirement: Interactive Chat Mode
The system SHALL provide an interactive conversational mode where users can type messages, receive LLM responses, and view conversation history in a scrollable terminal buffer with a customizable assistant display label.

#### Scenario: User sends a message and receives a response
- **WHEN** user types a message in the input panel and presses Enter
- **THEN** the system displays the user message followed by the LLM response, prefixing the assistant response with the configured `tui.name` value (defaulting to `"madz"`) instead of the literal string `"Assistant"`

#### Scenario: User scrolls through conversation history
- **WHEN** the conversation exceeds the visible terminal height
- **THEN** the user can scroll up to view prior messages using page-up/page-down or arrow keys, with assistant messages labeled by the configured name
