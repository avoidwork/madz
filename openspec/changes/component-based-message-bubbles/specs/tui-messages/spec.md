## ADDED Requirements

### Requirement: MessageBubble manages its own state
The MessageBubble component SHALL manage its own internal state including content, streaming status, tool call display, and reasoning content using React useState hooks. Each bubble SHALL be a standalone component instance that can update independently of other bubbles.

#### Scenario: Bubble renders initial content
- **WHEN** a new MessageBubble is created with role and content props
- **THEN** the bubble renders the initial content immediately without requiring a parent re-render

#### Scenario: Bubble updates during streaming
- **WHEN** the bubble's update() method is called with new content
- **THEN** the bubble re-renders with the updated content while preserving its identity

#### Scenario: Bubble tracks streaming state
- **WHEN** the bubble's update() method is called with streaming=true
- **THEN** the bubble renders in a streaming state (e.g., with a cursor or loading indicator)

#### Scenario: Bubble displays tool calls
- **WHEN** the bubble's update() method is called with toolCallDisplay data
- **THEN** the bubble renders the tool call information in its display

### Requirement: MessageList manages bubble instances
The MessageList component SHALL manage an array of MessageBubble component instances and provide imperative methods: addMessage(), updateMessage(), and clear(). The list SHALL render bubbles in a ScrollView with MAX_RENDER_MESSAGES windowing.

#### Scenario: Add message creates bubble
- **WHEN** addMessage(role, content) is called on MessageList
- **THEN** a new MessageBubble instance is created and appended to the list

#### Scenario: Update message targets specific bubble
- **WHEN** updateMessage(id, updates) is called with a valid bubble ID
- **THEN** the specific bubble identified by id updates its state with the provided updates

#### Scenario: Clear removes all bubbles
- **WHEN** clear() is called on MessageList
- **THEN** all MessageBubble instances are removed and the list is empty

#### Scenario: Windowing limits rendered bubbles
- **WHEN** the number of messages exceeds MAX_RENDER_MESSAGES
- **THEN** only the most recent MAX_RENDER_MESSAGES bubbles are rendered in the DOM

### Requirement: MessageList handles scroll internally
The MessageList component SHALL handle scroll-to-bottom behavior internally via its own ref, without requiring external useEffect-based scroll logic or array spreading from the parent.

#### Scenario: Auto-scroll on new message
- **WHEN** a new message is added to MessageList
- **THEN** the scroll view automatically scrolls to show the new message

#### Scenario: Auto-scroll on content update
- **WHEN** an existing bubble's content is updated via updateMessage()
- **THEN** the scroll view scrolls to show the updated content if it was at the bottom

#### Scenario: User scroll is preserved
- **WHEN** the user scrolls up to read history
- **THEN** auto-scroll does not interfere with the user's manual scroll position

### Requirement: ConversationPanel delegates to MessageList
The ConversationPanel component SHALL be simplified to a thin wrapper that renders MessageList. It SHALL not contain message data, scroll logic, or refs. It SHALL accept a scrollRef prop and pass it to MessageList.

#### Scenario: ConversationPanel renders MessageList
- **WHEN** ConversationPanel is rendered
- **THEN** it renders a MessageList component as its only child

#### Scenario: ConversationPanel passes scrollRef
- **WHEN** ConversationPanel receives a scrollRef prop
- **THEN** it passes the scrollRef to the MessageList component

### Requirement: App uses MessageList instead of refs
The App component (src/tui/app.js) SHALL remove messagesRef, forceRender, and renderCount. It SHALL create a messageListRef for the MessageList component and use it for all message operations.

#### Scenario: App creates messageListRef
- **WHEN** the App component initializes
- **THEN** it creates a ref via useRef to hold the MessageList component instance

#### Scenario: App adds messages via ref
- **WHEN** a message needs to be added (user or assistant)
- **THEN** App calls messageListRef.current.addMessage(role, content)

#### Scenario: App streams via ref
- **WHEN** a streaming event occurs
- **THEN** App calls messageListRef.current.updateMessage(id, chunk) instead of mutating a shared array

#### Scenario: App has no forceRender
- **WHEN** the App component is inspected
- **THEN** it contains no forceRender state, no renderCount state, and no messagesRef

### Requirement: No array spreading in message flow
The implementation SHALL eliminate all array spreading operations related to message management. Messages SHALL be added via React state in MessageList, not via array operations.

#### Scenario: No spread operator in message addition
- **WHEN** a new message is added
- **THEN** the code does not use [...messages, newMessage] or similar spread patterns

#### Scenario: No spread operator in message updates
- **WHEN** a message is updated during streaming
- **THEN** the code does not use [...messages] or similar spread patterns to trigger re-renders

### Requirement: Streaming callback uses MessageList API
The streaming callback in App (createStreamingCallback) SHALL call MessageList.updateMessage() instead of mutating messagesRef.current directly. The callback SHALL receive the message ID and content chunk and pass them to the update method.

#### Scenario: Streaming callback updates bubble
- **WHEN** a streaming chunk is received
- **THEN** the callback calls messageListRef.current.updateMessage(messageId, chunk)

#### Scenario: Streaming callback handles completion
- **WHEN** streaming completes for a message
- **THEN** the callback calls updateMessage with streaming=false to finalize the bubble

### Requirement: Utility functions are reused
Utility functions from src/tui/messages.js (getRoleLabel, formatMessage, isStreamingMessage, countMessageLines, getToolCallLines) SHALL be reused by the new MessageBubble component without modification.

#### Scenario: MessageBubble uses getRoleLabel
- **WHEN** MessageBubble renders a message
- **THEN** it uses getRoleLabel from messages.js to determine the role label

#### Scenario: MessageBubble uses formatMessage
- **WHEN** MessageBubble renders message content
- **THEN** it uses formatMessage from messages.js to format the content

### Requirement: Stable bubble IDs for reconciliation
Each MessageBubble SHALL be assigned a stable ID (via randomUUID) at creation time to ensure proper React reconciliation during updates and removals.

#### Scenario: Bubble gets stable ID on creation
- **WHEN** addMessage() creates a new bubble
- **THEN** the bubble is assigned a unique ID via randomUUID

#### Scenario: Bubble retains ID across updates
- **WHEN** a bubble's update() method is called multiple times
- **THEN** the bubble retains its original ID throughout its lifetime

#### Scenario: Bubble ID enables proper reconciliation
- **WHEN** bubbles are reordered or removed
- **THEN** React correctly reconciles the remaining bubbles without remounting them