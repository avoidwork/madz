## ADDED Requirements

### Requirement: Role-Based Message Rendering
The system SHALL apply content-appropriate rendering strategies per message role: markdown rendering for assistant and system messages, plain text rendering for user messages.

#### Scenario: Assistant messages are markdown-rendered
- **WHEN** the conversation panel receives an assistant message containing markdown syntax
- **THEN** the system routes the message content through the markdown renderer and displays formatted output

#### Scenario: System messages are markdown-rendered
- **WHEN** the conversation panel receives a system message containing markdown syntax
- **THEN** the system routes the message content through the markdown renderer and displays formatted output

#### Scenario: User messages are rendered as plain text
- **WHEN** the conversation panel receives a user message
- **THEN** the system renders the message content as plain text without markdown parsing

#### Scenario: Messages with no markdown syntax render identically
- **WHEN** the conversation panel receives an assistant message containing no markdown syntax
- **THEN** the system renders the message with the same visual appearance as unformatted plain text

### Requirement: Formatted Message Line Counting
The system SHALL accurately count rendered lines for virtualized scrolling when message content includes markdown formatting.

#### Scenario: Line count accounts for formatted content
- **WHEN** the conversation panel calculates visible message count
- **THEN** the line counting logic accounts for blank lines and indentation introduced by markdown formatting (headings, list items, fenced code blocks)

#### Scenario: Virtualized scrolling stays in sync with formatted messages
- **WHEN** the conversation panel renders a scrollable view with multiple formatted assistant messages
- **THEN** the virtual scroll viewport correctly positions and displays all messages without overlap or gaps
