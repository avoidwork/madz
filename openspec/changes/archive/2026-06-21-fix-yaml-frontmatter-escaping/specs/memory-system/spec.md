## MODIFIED Requirements

### Requirement: Conversation Persistence
The system SHALL persist every conversation exchange (user input, LLM output, tool results) as a timestamped markdown file in the `memory/` directory. YAML frontmatter metadata (timestamp, provider, model, title, and any additional fields) SHALL be properly escaped to ensure valid YAML output when values contain special characters such as double quotes, backslashes, or newlines.

#### Scenario: System persists a conversation message
- **WHEN** the user sends a message or the LLM generates a response
- **THEN** a new markdown file is written to `memory/` containing the exchange with YAML frontmatter for metadata (timestamp, provider, model)

#### Scenario: System reads conversation history from memory
- **WHEN** the user reopens the TUI after exiting
- **THEN** the system loads the latest conversation file from `memory/` and displays the history in the conversation panel

#### Scenario: Frontmatter with special characters is valid YAML
- **WHEN** a title or frontmatter value contains double quotes, backslashes, or newlines
- **THEN** the generated YAML frontmatter is properly escaped and can be parsed without errors