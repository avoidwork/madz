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

### Requirement: Message List Renders a Windowed Subset
The TUI MessageList component MUST render a windowed subset of messages (the visible range plus an overscan buffer) rather than mounting every message bubble, while keeping all messages accessible via scroll.

#### Scenario: Only the visible window plus overscan mounts
- **WHEN** a conversation has more messages than fit in the viewport
- **THEN** the MessageList mounts only the visible range plus the overscan buffer on each side

#### Scenario: All messages remain accessible via scroll
- **WHEN** a user scrolls up or down in the message list
- **THEN** all historical messages are accessible via the ScrollView, even those not currently mounted

#### Scenario: No renderWindow prop on MessageList
- **WHEN** the MessageList component is rendered
- **THEN** it does not accept or use a `renderWindow` prop

#### Scenario: Overscan is threaded through the component tree
- **WHEN** the app renders the conversation panel
- **THEN** the `overscan` config value flows from `app.js` → `ConversationArea` → `ConversationPanel` → `MessageList`
