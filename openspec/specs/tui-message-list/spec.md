# tui-message-list Specification

## Purpose
TBD - created by archiving change 2025-08-29-remove-render-window-message-limit. Update Purpose after archive.
## Requirements
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

### Requirement: No Config Option for Message Limit
The `tui.renderWindow` configuration option MUST be removed.

#### Scenario: Config schema has no renderWindow field
- **WHEN** the TuiSchema Zod schema is validated
- **THEN** it does not include a `renderWindow` field

#### Scenario: App does not pass renderWindow to ConversationPanel
- **WHEN** the app renders the ConversationPanel
- **THEN** no `renderWindow` prop is passed

### Requirement: Pub/Sub Topics Remain Valid
All message pub/sub topics MUST remain registered for the lifetime of the message.

#### Scenario: Older message topics receive streaming updates
- **WHEN** a message near the top of the conversation receives a streaming update
- **THEN** the update is delivered via the pub/sub topic

#### Scenario: No prunedIds cleanup
- **WHEN** messages are added to the conversation
- **THEN** no pub/sub topics are removed for older messages

### Requirement: Interrupted Assistant Bubble Persists
The TUI MessageList MUST render an assistant bubble that carries non-empty `reasoning` or `message` segments, even when `streaming` is false and `content` is empty.

#### Scenario: Interrupted assistant bubble with reasoning segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and a `segments` array containing a `reasoning` segment with non-empty content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Interrupted assistant bubble with message segments renders
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and a `segments` array containing a `message` segment with non-empty content
- **THEN** the MessageList renders the assistant bubble

#### Scenario: Empty assistant bubble is still skipped
- **WHEN** an assistant message has `streaming` set to false, empty `content`, and no non-empty `reasoning` or `message` segments
- **THEN** the MessageList does not render the assistant bubble

#### Scenario: Streaming assistant bubble always renders
- **WHEN** an assistant message has `streaming` set to true
- **THEN** the MessageList renders the assistant bubble regardless of content or segments

