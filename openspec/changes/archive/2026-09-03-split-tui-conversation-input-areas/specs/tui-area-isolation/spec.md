## ADDED Requirements

### Requirement: App Component Is a Thin Router
The App component SHALL hold only cross-cutting state (`showBanner`, `showOnboarding`, `onboardingResponse`, `inputFocused`) and SHALL NOT hold conversation, streaming, input text, history, status, or context-size state. App SHALL render `ConversationArea` and `InputArea` as its two subtrees.

#### Scenario: App holds no input text state
- **WHEN** the user types a character in the input panel
- **THEN** App does not re-render (inputText state lives in InputArea)

#### Scenario: App holds no streaming state
- **WHEN** a streaming response updates context size
- **THEN** App does not re-render (contextSize state lives in ConversationArea and InputArea)

#### Scenario: App renders both areas
- **WHEN** the TUI is in normal chat mode (no banner, no onboarding)
- **THEN** App renders ConversationArea and InputArea as sibling subtrees

### Requirement: ConversationArea Owns Conversation and Streaming State
The ConversationArea component SHALL own all conversation and streaming state: `contextSize`, `isCompacting`, `messageListRef`, `abortControllerRef`, `isStreamingRef`, `dispatchPromiseRef`, `streamingMsgIdRef`, `tokenCacheRef`, `autoContinueCountRef`, and `isAutoContinuingRef`. It SHALL own the handlers `handleInterrupt`, `handleCommand`, `handleChat`, `createStreamingHandler`, `finalizeStreaming`, `updateContextSize`, `addMessage`, `handleNewSession`, and `shouldAbort`. It SHALL render ConversationPanel.

#### Scenario: New message re-renders only ConversationArea
- **WHEN** a user message or assistant response is added to the conversation
- **THEN** ConversationArea re-renders and InputArea does not re-render

#### Scenario: Interrupt is handled inside ConversationArea
- **WHEN** an interrupt is triggered
- **THEN** ConversationArea aborts the active stream, cleans up session state, and clears the input buffer via a callback to InputArea

### Requirement: InputArea Owns Input and Status State
The InputArea component SHALL own all input and status state: `inputText`, `historyIndex`, `chatHistory`, `statusMessage`, `contextSize`, and `isCompacting`. It SHALL render StatusBar and InputPanel. It SHALL read `messageCount` from a ref exposed by ConversationArea.

#### Scenario: Typing re-renders only InputArea
- **WHEN** the user types a character in the input panel
- **THEN** InputArea re-renders and ConversationArea (including MessageList) does not re-render

#### Scenario: Status message updates re-render only InputArea
- **WHEN** the status message changes (e.g., "Streaming..." to "Done")
- **THEN** InputArea re-renders and ConversationArea does not re-render

### Requirement: Cross-Area Communication Uses Imperative Refs
App SHALL communicate with ConversationArea and InputArea exclusively through imperative refs (`conversationAreaRef`, `inputAreaRef`) and stable callbacks. Neither area SHALL hold a reference to the other's internal state. All ref-based calls SHALL use optional chaining to tolerate unmounted areas.

#### Scenario: Key routing via refs
- **WHEN** the user presses an arrow key while the message list is focused
- **THEN** App calls `conversationAreaRef.current?.scrollBy(delta)` without re-rendering either area

#### Scenario: Status flow via stable callbacks
- **WHEN** ConversationArea changes the status message during streaming
- **THEN** it calls a stable App-provided callback that updates InputArea's internal status state, and App does not re-render

### Requirement: useInput Key Routing Stays in App
The `useInput` hook SHALL remain in App and SHALL route keys based on `inputFocused`: onboarding Enter to onboarding processing, Tab to focus toggle, Escape to interrupt (with 500ms debounce), up/down arrows to input history navigation when input is focused, and up/down/pageUp/pageDown to message list scrolling when the message list is focused.

#### Scenario: Tab toggles focus
- **WHEN** the user presses Tab
- **THEN** App toggles `inputFocused` and passes the new focus state to InputArea

#### Scenario: Escape interrupts with debounce
- **WHEN** the user presses Escape more than 500ms after the last interrupt
- **THEN** App calls `conversationAreaRef.current?.interrupt()`

#### Scenario: Up arrow navigates history when input focused
- **WHEN** the input panel is focused and the user presses up arrow with non-empty history
- **THEN** App calls `inputAreaRef.current?.navigateHistory('up')` and the input text is set to the previous entry

#### Scenario: Up arrow scrolls when message list focused
- **WHEN** the message list is focused and the user presses up arrow
- **THEN** App calls `conversationAreaRef.current?.scrollBy(-1)`

### Requirement: Existing TUI Behavior Is Preserved
After the split, all existing TUI behaviors SHALL work unchanged: message submission, command parsing, streaming with auto-continue, interrupt, new session, banner dismissal, onboarding flow, history navigation, and scroll navigation.

#### Scenario: Full chat round-trip
- **WHEN** the user submits a message and receives a streamed response
- **THEN** the user message and assistant response appear in the conversation panel, the status bar reflects streaming state, and the session is persisted

#### Scenario: New session resets both areas
- **WHEN** the user issues a new session command
- **THEN** the conversation is cleared, input history is cleared, context size resets to 0, and a system message announces the new session
