## Why

The current TUI message rendering uses a mutable array pattern that fights React's rendering model: messages are stored via state (`useState`), but updates are done by cloning the full array (`[...prev]`) and mutating the last element. This happens on every streaming tick, causing memory allocation churn, unnecessary re-renders of unchanged messages, and unreliable scroll behavior. The streaming handler clones the array on every character to append a cursor character, compounding the issue.

## What Changes

- **New:** `src/tui/messageBubble.js` — a self-contained MessageBubble component with internal state (content, streaming, reasoningContent, activeToolCall, toolCallDisplay, streamingId) and an imperative update method exposed via forwarded ref
- **New:** `src/tui/messageList.js` — a MessageList component that manages an array of MessageBubble instances, provides imperative addMessage/updateMessage/clear/setMessages methods, and owns scroll management (ScrollView, throttle, resize, manual scroll detection)
- **Modified:** `src/tui/conversationPanel.js` — simplified to a thin wrapper that renders MessageList, no longer owns scroll logic
- **Modified:** `src/tui/app.js` — replaces all `setMessages([...])` calls with imperative `messageListRef.current.addMessage()` and `.updateMessage()` calls; removes streaming array mutations across ~12 call sites
- **No breaking API changes** for external users of the TUI — the App component still accepts the same props (config, registry, sessionState, etc.)

## Capabilities

### New Capabilities
- **component-message-bubbles**: Component-based message rendering where each message is a standalone MessageBubble with its own state and imperative update API, eliminating array-spread-and-mutate rendering patterns

### Modified Capabilities
- **tui-conversation**: Requirement behavior unchanged, but implementation moves from data-driven rendering to component-instance management. The "conversation persistence on interruption" requirement still applies.
- **tui-scroll-view**: The scroll management requirement shifts from ConversationPanel to MessageList. MessageList becomes the entity that "handles keyboard scroll input", "handles terminal resize", and "owns scroll state". ConversationPanel remains the visual container but delegates scroll responsibility.

## Impact

- **Files created:** `src/tui/messageBubble.js`, `src/tui/messageList.js`
- **Files modified:** `src/tui/conversationPanel.js`, `src/tui/app.js`
- **Files unchanged:** `src/tui/messages.js` (reused for `getRoleLabel`, utilities)
- **Test files to update:** `tests/unit/tui/` — all TUI tests that mock `setMessages` or the messages state will need to mock the new imperative API
- **No new dependencies** — all existing dependencies (ink, ink-scroll-view, React) are sufficient
