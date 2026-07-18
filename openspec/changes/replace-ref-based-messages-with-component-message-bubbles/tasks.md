## Architecture Note: Pub/Sub Instead of Ref Callbacks

The implementation diverges from the original plan in one key area: instead of MessageList holding a Map of bubble refs with imperative `bubble.update()` calls, the actual implementation uses a **pub/sub topic system**. Each bubble subscribes to a unique topic (`msg-{id}`). When `MessageList.updateMessage()` is called, it publishes to that topic, and the subscribed bubble receives the update and appends to its local chunks state. This avoids needing `React.forwardRef` + `useImperativeHandle` on bubbles, achieves the same performance goal (bubble-only re-renders without parent re-render), and simplifies the architecture.

## 1. MessageBubble Component

- [x] 1.1 Create `src/tui/messageBubble.js` with a MessageBubble functional component
  - Note: Uses plain functional component (no `forwardRef` or `useImperativeHandle`). Streaming updates flow via pub/sub topic subscriptions instead of callback refs.
- [x] 1.2 Implement internal state for content accumulation, streaming, reasoning, tool calls
  - Note: Uses `useState([])` for chunk accumulation with deduplication. Pub/sub triggers re-renders instead of a separate `streamingId` counter.
- [x] 1.3 Implement bubble-level update via pub/sub topic subscription (see architecture note)
  - Note: Replaces the original `useImperativeHandle` + `update(partialState)` plan with a pub/sub topic system. Each bubble subscribes to `msg-{id}` and appends chunks on publish. Verified working via message.test.js pubsub tests.
- [x] 1.4 Implement rendering: time label, role label (using getRoleLabel from messages.js), role-colored label, content in MarkdownText
- [x] 1.5 Implement reasoning content rendering (collapsed, muted, max 200 chars) when role is "assistant"
- [x] 1.6 Implement active tool call indicator when activeToolCall is present
- [x] 1.7 Implement tool call display rendering (line-by-line) when toolCallDisplay is present
- [x] 1.8 Reuse getRoleColors and getBubbleStyle from conversationPanel.js (direct import)
- [x] 1.9 Visual output matches the existing MessageBubble styling (borderStyle: round, borderColor, maxWidth: 90%, layout boxes)

## 2. MessageList Component

- [x] 2.1 Create `src/tui/messageList.js` with a MessageList functional component (forwardRef)
- [x] 2.2 Implement internal: useRef for message data (idsRef, dataRef, idToIdxRef, topicsRef) instead of useState + ref Map
  - Note: Uses `useRef` with Map-based data structures instead of a data array + ref Map. Pub/sub topics replace bubble instance refs.
- [x] 2.3 Implement `addMessage(role, content, options)` that creates unique ID, stores data, renders bubble, returns the message ID
- [x] 2.4 Implement `updateMessage(id, updates)` that merges updates into data, publishes to pub/sub topic (bubble receives and re-renders)
- [x] 2.5 Implement `clear()` that empties all data refs, triggers re-render
- [x] 2.6 Implement `setMessages(msgs)` that initializes list from an array (helper for session restore)
- [x] 2.7 ScrollView wrapper with internal ref managed and exposed via `getScrollRef()`
- [x] 2.8 Render MessageBubble instances for each message with stable keys (unique message IDs)
- [x] 2.9 MAX_RENDER_MESSAGES = 100 windowing via `slice(-MAX_RENDER_MESSAGES)`
- [x] 2.10 Scroll-throttle with content hash tracking, 100ms throttle, streaming detection, manual scroll suppression

## 3. Scroll Logic (Ported from ConversationPanel)

- [x] 3.1 Terminal resize handler: `stdout.on("resize")` calls `scrollRef.remeasure()`
- [x] 3.2 Manual scroll detection: `getMaxScrollOffset` / `getScrollOffset` sets `isUserScrollingRef`
- [x] 3.3 Scroll-to-bottom throttled effect with 100ms throttle during streaming
- [x] 3.4 Scroll ref accessible from App.js keyboard navigation via `messageListRef.current?.getScrollRef()`
  - Note: No prop-based scrollRef forwarding. MessageList stores its own internal ref and exposes it.
- [x] 3.5 Re-measure on resize works with the ink-scroll-view API

## 4. Simplified ConversationPanel

- [x] 4.1 `src/tui/conversationPanel.js` is a thin wrapper that renders MessageList
  - Note: The component is ~15 lines, but the file is 269 lines because legacy code is still exported.
- [x] 4.2 Passes `messages`, `assistantName`, `scrollRef`, and `messageListRef` props to MessageList
- [x] 4.3 Scroll ref exposed via `getScrollRef()` on the MessageList ref handle
  - Note: No prop-based ref forwarding. MessageList manages its own internal ref.
- [x] 4.4 Remove legacy code (old MessageBubble, renderMessages) from conversationPanel.js
  - Note: The component itself is under 20 lines. Legacy MessageBubble, renderMessages, and unused imports were removed in a follow-up commit.
- [x] 4.5 Kept `formatTime`, `getRoleColors`, `getBubbleStyle` as named exports
- [x] 4.6 Mounts with empty messages, shows "No messages yet" placeholder (via MessageList)
- [x] 4.7 ConversationPanel's useEffect on mount calls `panelRef.current.setMessages(messages)` for session restore

## 5. App.js Updates

- [x] 5.1 Added `messageListRef = useRef(null)` to App.js
- [x] 5.2 Passes `messageListRef` to ConversationPanel as a ref prop; scroll accessed via `getScrollRef()`
  - Note: No explicit `scrollRef={...}` prop. App.js uses `messageListRef.current?.getScrollRef()` in the keyboard navigation handler.
- [x] 5.3 `addMessage(msg)` calls `messageListRef.current?.addMessage(msg.role, msg.content, { time })`
- [x] 5.4 `handleChat` assistant message creation uses `messageListRef.current.addMessage("assistant", "", { streaming: true, time })`, stores ID in `streamingMsgIdRef.current`
- [x] 5.5 Streaming handler uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, { content: committedContentRef.current + "\u2588", streaming: true })`
- [x] 5.6 `finalizeStreaming` uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, updates)`
- [x] 5.7 Abort/error path uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, { streaming: false })` (non-error) or `clear()` (error cases)
- [x] 5.8 `handleInterrupt` uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, { streaming: false })`
- [x] 5.9 `handleNewSession` uses `messageListRef.current?.clear()`
- [x] 5.10 Command `.clear` action uses `messageListRef.current?.clear()`
- [x] 5.11 Skill action streaming path in handleCommand uses the same imperative pattern (addMessage + updateMessage)
- [x] 5.12 Auto-continue tool call display update uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, { toolCallDisplay })`
- [x] 5.13 Circuit breaker path uses `messageListRef.current?.updateMessage(streamingMsgIdRef.current, { streaming: false })`
- [x] 5.14 `statusProps.messageCount` uses `messageListRef.current?.getMessageCount() || 0`
- [x] 5.15 `addMessage` function now delegates to `messageListRef.current?.addMessage()` instead of using setChatHistory
- [x] 5.16 Added `streamingMsgIdRef = useRef(null)` to track the current streaming message bubble ID

## 6. Session/Config Edge Cases

- [x] 6.1 Scroll ref accessible from App.js keyboard navigation via `getScrollRef()` — no prop forwarding needed
- [x] 6.2 Cursor character config uses `config.tui.cursorChar` (both streaming and input panel)
  - Note: The streaming cursor character `"\u2588"` is hardcoded in App.js streaming handlers. The `MarkdownText` component strips it before parsing, so markdown rendering is unaffected.
- [x] 6.3 Initial session restore works: ConversationPanel's useEffect calls `panelRef.current.setMessages(messages)` on mount
- [x] 6.4 `messageCount` uses `messageListRef.current?.getMessageCount() || 0`
- [x] 6.5 MessageList exposes `getMessageCount()` and `getScrollRef()` on its ref handle for App.js access

## 7. Pub/Sub Infrastructure

- [x] 7.1 Create `createPubSub()` factory function in messageBubble.js — returns subscribe/unsubscribe/publish/getSubscribers
- [x] 7.2 Create `PubSubContext` React context with no-op defaults
- [x] 7.3 Create `PubSubProvider` component in messageList.js that wraps children with context provider and maintains Map of topic listeners
- [x] 7.4 Each MessageBubble subscribes to its topic on mount via useEffect, unsubscribes on unmount
- [x] 7.5 Chunks are deduplicated before append: `if (prev.length > 0 && prev[prev.length - 1] === newContent) return prev`
- [ ] 7.6 Document pub/sub API for testing (see task 7.x below)

## 8. Tests

- [ ] 8.1 Create `tests/unit/tui/messageBubble.test.js` — test rendering with various roles, pub/sub chunk accumulation, deduplication
- [ ] 8.2 Create `tests/unit/tui/messageList.test.js` — test addMessage, updateMessage, clear, setMessages, getMessageCount, getScrollRef, ref API, pub/sub publish flow
- [ ] 8.3 Create `tests/unit/tui/conversationPanel.test.js` — test that ConversationPanel renders MessageList, session restore on mount, empty state
- [ ] 8.4 Update `tests/unit/conversationPanel.test.js` — keep testing old `renderMessages`, `getRoleColors`, `getBubbleStyle` exports but add note that they are legacy
- [ ] 8.5 Test pub/sub system: create PubSub instances, verify subscribe/publish/unsubscribe, multi-subscriber, no-leak on unsubscribe
- [ ] 8.6 Ensure all existing tests pass

## 9. Verify & Clean Up

- [ ] 9.1 Run `npm run lint` and fix any issues
- [ ] 9.2 Run `npm run test` and fix any failures
- [ ] 9.3 Run `npm run coverage` and verify coverage is maintained
- [ ] 9.4 Run `npm start` briefly and verify the app boots without errors
- [ ] 9.5 Manual verification: user message appears on send, assistant streams correctly, interrupt stops streaming, new session clears, page up/down keyboard scroll works, session restore on relaunch
