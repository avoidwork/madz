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

### Requirement: updateMessage coalesces streaming segments
The `updateMessage` function SHALL coalesce incoming streaming segments into the message's ordered `segments` array using a timing-aware and punctuation-aware rule, rather than a purely type-based rule.

#### Scenario: Same-type segments are appended
- **WHEN** `updateMessage` receives a segment whose type matches the last segment
- **THEN** the incoming content is appended to the last segment

#### Scenario: Cross-type message segment appends within timeout
- **WHEN** `updateMessage` receives a `message` segment following a last `message` segment that does not end with sentence-ending punctuation and arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last message segment

#### Scenario: Cross-type message segment pushes a new block after timeout
- **WHEN** `updateMessage` receives a `message` segment following a last `message` segment that arrived after the coalesce timeout
- **THEN** a new message segment is pushed

#### Scenario: Cross-type reasoning segment appends within timeout
- **WHEN** `updateMessage` receives a `reasoning` segment following a last `reasoning` segment that arrived within the coalesce timeout
- **THEN** the incoming content is appended to the last reasoning segment

#### Scenario: Cross-type reasoning segment pushes a new block after timeout
- **WHEN** `updateMessage` receives a `reasoning` segment following a last `reasoning` segment that arrived after the coalesce timeout
- **THEN** a new reasoning segment is pushed

