## MODIFIED Requirements

### Requirement: Conversation panel uses ScrollView for rendering messages
The MessageList component SHALL render messages inside a `ScrollView` component from `ink-scroll-view` rather than manually slicing a messages array. ConversationPanel delegates all rendering to MessageList and does not directly render messages.

#### Scenario: ScrollView wraps message list
- **WHEN** the UI renders a conversation
- **THEN** the ScrollView from `ink-scroll-view` is the container inside MessageList, which is rendered by ConversationPanel

#### Scenario: Messages receive unique keys
- **WHEN** the ScrollView renders its children
- **THEN** each message element has a unique `key` prop (derived from message ID or index)

### Requirement: app.js no longer manages scroll state directly via setMessages
The `app.js` component SHALL NOT update messages via array cloning and mutation (`setMessages(prev => { const cloned = [...prev]; ... })`). Instead, app.js calls imperative methods on the MessageList ref for all message updates.

#### Scenario: Scroll state is removed from app.js
- **WHEN** `app.js` is inspected for scroll-related state and mutations
- **THEN** no `setMessages` callbacks that clone and mutate the messages array exist in the file

#### Scenario: ConversationPanel receives simplified props
- **WHEN** `app.js` renders ConversationPanel
- **THEN** it passes an initial `messages` array or `initialize` callback and `assistantName`, and uses a ref (`messageListRef`) for imperative updates
