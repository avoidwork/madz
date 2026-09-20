## MODIFIED Requirements

### Requirement: Message List Renders All Messages
The TUI MessageList component MUST render all conversation messages without a configurable limit.

#### Scenario: Render all messages in a long conversation
- **WHEN** a conversation has more than 100 messages
- **THEN** the MessageList renders all messages, not just the last 100

#### Scenario: No renderWindow prop on MessageList
- **WHEN** the MessageList component is rendered
- **THEN** it does not accept or use a `renderWindow` prop

#### Scenario: ScrollView scrolls through full history
- **WHEN** a user scrolls up in the message list
- **THEN** all historical messages are accessible via the ScrollView

### Requirement: Interrupted Assistant Bubble Persists
The TUI MessageList component MUST keep an assistant bubble in the rendered message list when it contains non-empty `reasoning` or `message` segments, even if `streaming` is false and `content` is empty.

#### Scenario: Interrupted assistant bubble with reasoning segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and `segments` containing a `reasoning` segment with non-empty trimmed content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Interrupted assistant bubble with message segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and `segments` containing a `message` segment with non-empty trimmed content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Empty assistant bubble is still skipped
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and no `segments` (or only segments with empty/whitespace content)
- **THEN** the MessageList does not render the assistant bubble

#### Scenario: Streaming assistant bubble is always rendered
- **WHEN** an assistant message has `streaming` set to true
- **THEN** the MessageList renders the assistant bubble regardless of `content` or `segments`
