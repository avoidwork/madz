## Requirements

### Requirement: MessageList uses ScrollView for rendering messages
The MessageList component SHALL render messages inside a `ScrollView` component from `ink-scroll-view` rather than manually slicing a messages array. ConversationPanel delegates all rendering to MessageList and does not directly render messages.

#### Scenario: ScrollView wraps message list
- **WHEN** the UI renders a conversation
- **THEN** the ScrollView from `ink-scroll-view` is the container inside MessageList, which is rendered by ConversationPanel

#### Scenario: Messages receive unique keys
- **WHEN** the ScrollView renders its children
- **THEN** each message element has a unique `key` prop (derived from message ID)

### Requirement: MessageList handles keyboard scroll input
The MessageList component SHALL capture keyboard input via Ink's `useInput` and translate arrow keys and page keys into scroll actions on the `ScrollView` ref through `messageListRef.current?.getScrollRef()`.
When App.js renders MessageList, App.js receives the ScrollView ref via `getScrollRef()` and uses it to call `scrollBy()`.

#### Scenario: Up arrow scrolls up by one line
- **WHEN** the user presses the up arrow key while the input panel is not focused
- **THEN** app.js obtains the ScrollView ref via `messageListRef.current?.getScrollRef()` and calls `scrollBy(-1)`

#### Scenario: Down arrow scrolls down by one line
- **WHEN** the user presses the down arrow key while the input panel is not focused
- **THEN** app.js obtains the ScrollView ref via `messageListRef.current?.getScrollRef()` and calls `scrollBy(1)`

#### Scenario: Page up scrolls up by viewport height
- **WHEN** the user presses page-up while the input panel is not focused
- **THEN** app.js obtains the ScrollView ref via `messageListRef.current?.getScrollRef()` and calls `scrollBy(-N)` where N equals the viewport height

#### Scenario: Page down scrolls down by viewport height
- **WHEN** the user presses page-down while the input panel is not focused
- **THEN** app.js obtains the ScrollView ref via `messageListRef.current?.getScrollRef()` and calls `scrollBy(N)` where N equals the viewport height

### Requirement: MessageList handles terminal resize
The MessageList component SHALL listen for `resize` events on `stdout` and call `remeasure()` on the ScrollView ref to update measured heights after a terminal dimension change.

#### Scenario: ScrollView is remeasured on terminal resize
- **WHEN** the terminal window is resized while the TUI is active
- **THEN** the MessageList's ScrollView ref's `remeasure()` method is called

#### Scenario: Resize listener is cleaned up on unmount
- **WHEN** the MessageList component unmounts (e.g., user closes the TUI)
- **THEN** the `resize` event listener is removed from `stdout`

### Requirement: MessageList owns auto-scroll management
The MessageList component SHALL manage auto-scroll-to-bottom with 100ms throttle during active streaming, immediate scroll on streaming completion, and manual scroll suppression to prevent auto-scroll when the user manually scrolls away from the bottom (suppressing until the user returns to the bottom or streaming resumes).

#### Scenario: Auto-scroll during streaming
- **WHEN** a message is streaming and its content changes via `updateMessage()`
- **THEN** MessageList scrolls to the bottom of the ScrollView with a 100ms throttle

#### Scenario: Suppress auto-scroll during user manual scroll
- **WHEN** the user scrolls up away from the bottom and is not streaming
- **THEN** MessageList does NOT auto-scroll until the user returns to the bottom or streaming resumes

#### Scenario: Immediate scroll after streaming completion
- **WHEN** streaming completes (the `updateMessage()` call sets `streaming: false`)
- **THEN** MessageList immediately scrolls to the bottom (no throttle delay)

### Requirement: app.js manages messages imperatively, not via array mutations
The `app.js` component SHALL NOT maintain message history as a mutable state array (`useState([])`). Instead, app.js calls imperative methods on the MessageList ref (`messageListRef.current.addMessage()`, `.updateMessage()`, `.getScrollRef()`) for all message operations.

#### Scenario: No messages array state in app.js
- **WHEN** `app.js` is inspected for scroll-related state and mutations
- **THEN** no `useState` calls for a messages array or `setMessages` callbacks that clone and mutate messages exist in the file

#### Scenario: MessageList ref used for all message updates
- **WHEN** `app.js` adds or updates messages (user input, assistant response, system messages)
- **THEN** it calls `messageListRef.current.addMessage()` or `messageListRef.current.updateMessage()` instead of pushing to a state array

#### Scenario: Scroll ref accessed via getScrollRef (no prop forwarding)
- **WHEN** keyboard scroll events occur in app.js
- **THEN** app.js calls `messageListRef.current.getScrollRef()` to obtain the ScrollView ref and invokes `scrollBy()` directly, rather than passing a `scrollRef` prop through the component chain

#### Scenario: ConversationPanel receives simplified props
- **WHEN** `app.js` renders ConversationPanel
- **THEN** it passes an initial `messages` array (for session restore), an optional `messageListRef` for imperative access, and `assistantName`, with all other message/scroll updates handled imperatively through the ref
