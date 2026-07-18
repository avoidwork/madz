## ADDED Requirements

### Requirement: MessageBubble manages its own state
The MessageBubble component SHALL maintain internal state for content, streaming status, reasoning content, active tool call, and tool call display via useState. Each bubble is a standalone React functional component.

#### Scenario: MessageBubble renders initial content
- **WHEN** a MessageBubble is created with role, content, and time
- **THEN** it renders the role label and content area with the initial content

#### Scenario: MessageBubble updates content imperatively
- **WHEN** the parent calls the exposed update() method with a content update
- **THEN** the bubble's internal state is updated and it re-renders with the new content

#### Scenario: MessageBubble shows streaming indicator
- **WHEN** a MessageBubble's internal streaming state is true
- **THEN** it appends a cursor character to its content and re-renders on each update cycle

#### Scenario: MessageBubble renders reasoning content
- **WHEN** a MessageBubble's internal reasoningContent is present and role is "assistant"
- **THEN** it renders the reasoning content as muted text below the main content

#### Scenario: MessageBubble renders active tool call
- **WHEN** a MessageBubble's internal activeToolCall is present
- **THEN** it renders a "Running: <name>" indicator below the main content

#### Scenario: MessageBubble renders tool call display output
- **WHEN** a MessageBubble's internal toolCallDisplay is present
- **THEN** it renders each line of tool call display output below the main content

### Requirement: MessageList provides imperative message management API
The MessageList component SHALL expose an imperative ref API containing addMessage(role, content, options), updateMessage(id, updates), clear(), and setMessages(msgs) methods.

#### Scenario: addMessage creates a new bubble
- **WHEN** addMessage("user", text) is called
- **THEN** a new MessageBubble instance is created at the end of the message list

#### Scenario: updateMessage updates an existing bubble
- **WHEN** updateMessage(id, { content: "new text" }) is called with a valid id
- **THEN** the MessageBubble with that id updates its content and re-renders

#### Scenario: updateMessage with streaming flag shows cursor
- **WHEN** updateMessage(id, { streaming: true }) is called
- **THEN** the MessageBubble sets its streaming state and begins showing a cursor

#### Scenario: clear removes all bubbles
- **WHEN** clear() is called
- **THEN** all MessageBubble instances are removed and the list shows "No messages yet"

#### Scenario: setMessages initializes from a data array
- **WHEN** setMessages([{ role: "assistant", content: "Hello" }]) is called
- **THEN** all existing bubbles are cleared and new bubbles are created for each message

### Requirement: MessageList owns scroll management
The MessageList component SHALL manage ScrollView rendering, auto-scroll-to-bottom with throttle, terminal resize handling, and manual scroll detection internally.

#### Scenario: Auto-scroll during streaming
- **WHEN** a message is streaming and its content changes
- **THEN** MessageList scrolls to the bottom of the ScrollView with a 100ms throttle

#### Scenario: Suppress auto-scroll during user manual scroll
- **WHEN** the user scrolls up away from the bottom and is not streaming
- **THEN** MessageList does NOT auto-scroll until the user returns to bottom or streaming resumes

#### Scenario: Immediate scroll on streaming completion
- **WHEN** streaming completes (streaming state set to false)
- **THEN** MessageList immediately scrolls to the bottom (no throttle)

#### Scenario: Remeasure on terminal resize
- **WHEN** the terminal is resized
- **THEN** MessageList's ScrollView ref calls remeasure() to update measured heights

### Requirement: MessageList enforces rendering window
The MessageList component SHALL render at most the last 100 messages (MAX_RENDER_MESSAGES = 100) to prevent performance degradation with very long conversations, while all messages remain available via the imperative API.

#### Scenario: Long conversation limits visible bubbles
- **WHEN** MessageList contains 200 messages and renders
- **THEN** only the last 100 MessageBubble components are rendered in the React tree

#### Scenario: AddMessage after window is full still works
- **WHEN** the window is full and addMessage() is called
- **THEN** a new message is added and the oldest visible message is replaced
