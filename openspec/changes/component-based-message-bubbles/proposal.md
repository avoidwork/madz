## Why

The current TUI architecture uses `messagesRef` (a mutable ref array) combined with `forceRender` (a useState counter) and array spreading to work around the fact that mutating a ref does not trigger React re-renders. This approach fights React's rendering model and causes:

- Memory leaks from constant array allocation during streaming
- Unnecessary re-renders of unchanged messages
- Complex scroll management that doesn't work reliably
- User messages don't appear until the assistant message streams in

The root problem: mutating a ref does not trigger React re-renders, so we work around it with forceRender and array spreading, which creates new references on every render and compounds the issue. This is a fundamental architectural mismatch that optimizations cannot fix.

## What Changes

- Replace `messagesRef` (useRef([])) with a component-based message system
- Remove `forceRender` and `renderCount` state entirely
- Introduce `MessageBubble` component — each message manages its own state via useState
- Introduce `MessageList` component — manages an array of MessageBubble instances with addMessage(), updateMessage(), clear() methods
- Simplify `ConversationPanel` to a thin wrapper around MessageList
- Update streaming callback to call `messageListRef.current.updateMessage()` instead of mutating a shared array
- Eliminate all array spreading in the message flow
- Move scroll management into MessageList internally

## Capabilities

### New Capabilities
- `tui-messages`: Component-based message architecture with MessageBubble and MessageList components replacing the ref-based message array

### Modified Capabilities
<!-- No existing spec-level requirements are changing — this is an implementation refactor -->

## Impact

- **src/tui/app.js** — Remove messagesRef, forceRender, renderCount; use messageListRef for MessageList
- **src/tui/conversationPanel.js** — Simplify from ~7579 bytes to a thin wrapper (~500 bytes)
- **src/tui/messageBubble.js** — New: standalone MessageBubble component with internal state
- **src/tui/messageList.js** — New: MessageList component managing bubble instances
- **src/tui/messages.js** — Utility functions reused by MessageBubble (getRoleLabel, formatMessage, etc.)
- **tests/unit/tui/** — Update mocks to use new component API instead of mocking setMessages or messagesRef