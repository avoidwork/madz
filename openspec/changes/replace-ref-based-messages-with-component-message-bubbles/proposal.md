## Why

The current TUI message rendering uses a mutable array pattern that fights React's rendering model: messages are stored via state (`useState`), but updates are done by cloning the full array (`[...prev]`) and mutating the last element. This happens on every streaming tick, causing memory allocation churn, unnecessary re-renders of unchanged messages, and unreliable scroll behavior. The streaming handler clones the array on every character to append a cursor character, compounding the issue.

## What Changes

- **New:** `src/tui/messageBubble.js` — a self-contained MessageBubble component with internal chunk accumulation state (`useState([])`), streaming status, reasoning content, tool call display, and pub/sub topic subscription for streaming updates
- **New:** `src/tui/messageList.js` — a MessageList component (forwardRef) that manages message data (using useRef Maps), provides imperative addMessage/updateMessage/clear/setMessages methods, owns scroll management (ScrollView, throttle, resize, manual scroll detection), and implements a pub/sub topic system for bubble updates
- **New:** `src/tui/messageBubble.js` also exports `createPubSub()`, `PubSubContext`, and `PubSubProvider` for the pub/sub architecture
- **Modified:** `src/tui/conversationPanel.js` — simplified to a thin wrapper that renders MessageList, exports legacy MessageBubble and renderMessages for backward compatibility
- **Modified:** `src/tui/app.js` — replaces all `setMessages([...])` calls with imperative `messageListRef.current.addMessage()` and `.updateMessage()` calls; removes streaming array mutations across ~12 call sites
- **No breaking API changes** for external users of the TUI — the App component still accepts the same props (config, registry, sessionState, etc.)

## Capabilities

### New Capabilities
- **component-message-bubbles**: Component-based message rendering where each message is a standalone MessageBubble with its own state and chunk-based accumulation, updated via a pub/sub topic system rather than ref callbacks

### Modified Capabilities
- **tui-conversation**: Requirement behavior unchanged, but implementation moves from data-driven rendering to component-instance management with pub/sub communication. The "conversation persistence on interruption" requirement still applies.
- **tui-scroll-view**: The scroll management requirement shifts from ConversationPanel to MessageList. MessageList becomes the entity that "handles keyboard scroll input", "handles terminal resize", and "owns scroll state". ConversationPanel remains the visual container but delegates scroll responsibility.

## Impact

- **Files created:** `src/tui/messageBubble.js`, `src/tui/messageList.js`
- **Files modified:** `src/tui/conversationPanel.js`, `src/tui/app.js`
- **Files unchanged:** `src/tui/messages.js` (reused for `getRoleLabel`, utilities)
- **Test files to create:** `tests/unit/tui/messageBubble.test.js`, `tests/unit/tui/messageList.test.js`, `tests/unit/tui/conversationPanel.test.js`
- **Test files to update:** `tests/unit/conversationPanel.test.js` (legacy rendering tests remain valid but are superseded)
- **No new dependencies** — all existing dependencies (ink, ink-scroll-view, React) are sufficient
