## 1. Create MessageBubble Component

- [ ] 1.1 Create `src/tui/messageBubble.js` with a MessageBubble functional component using React.forwardRef
- [ ] 1.2 Implement internal useState for: content, streaming, reasoningContent, activeToolCall, toolCallDisplay, streamingId
- [ ] 1.3 Implement expose `update(partialState)` method via useImperativeHandle that merges partial state into existing state and increments streamingId
- [ ] 1.4 Implement rendering: time label, role label (using getRoleLabel from messages.js), role-colored label, content in MarkdownText
- [ ] 1.5 Implement reasoning content rendering (collapsed, muted, max 200 chars) when role is "assistant"
- [ ] 1.6 Implement active tool call indicator when activeToolCall is present
- [ ] 1.7 Implement tool call display rendering (line-by-line) when toolCallDisplay is present
- [ ] 1.8 Reuse getRoleColors and getBubbleStyle from conversationPanel.js (or extract them to a shared module)
- [ ] 1.9 Verify visual output matches the existing MessageBubble styling (borderStyle: round, borderColor, maxWidth: 90%, layout boxes)

## 2. Create MessageList Component

- [ ] 2.1 Create `src/tui/messageList.js` with a MessageList functional component
- [ ] 2.2 Implement internal: useState for message data array, ref Map for bubble instance refs
- [ ] 2.3 Implement `addMessage(role, content, options)` that adds to data array, creates MessageBubble, stores ref in Map, triggers re-render via streamingId
- [ ] 2.4 Implement `updateMessage(id, updates)` that merges updates into data array entry, finds bubble ref by id, calls bubble.update(updates)
- [ ] 2.5 Implement `clear()` that empties data array, clears refs Map, triggers re-render
- [ ] 2.6 Implement `setMessages(msgs)` that calls clear() then adds all messages (helper for session restore)
- [ ] 2.7 Implement ScrollView wrapper with the ref forwarded to the ScrollView from ink-scroll-view
- [ ] 2.8 Render MessageBubble instances for each message in the data array with stable keys (use indexed message IDs)
- [ ] 2.9 Implement MAX_RENDER_MESSAGES = 100 windowing — only render the last N messages
- [ ] 2.10 Port scroll-throttle useEffect from conversationPanel.js (lines 307-353): content hash tracking, 100ms throttle, streaming detection, manual scroll suppression

## 3. Port Scroll Logic from ConversationPanel

- [ ] 3.1 Port terminal resize handler from conversationPanel.js (lines 269-279) into MessageList
- [ ] 3.2 Port manual scroll detection from conversationPanel.js (lines 283-301) into MessageList
- [ ] 3.3 Port scroll-to-bottom throttled effect from conversationPanel.js (lines 307-353) into MessageList
- [ ] 3.4 Ensure the scroll ref is accessible via forwarding/ref pattern so App.js keyboard navigation (pageUp/down, arrow keys) still works
- [ ] 3.5 Ensure re-measure on resize works with the ink-scroll-view API

## 4. Simplify ConversationPanel

- [ ] 4.1 Rewrite `src/tui/conversationPanel.js` to be a thin wrapper that imports and renders MessageList
- [ ] 4.2 Pass `messages` and `assistantName` props to MessageList
- [ ] 4.3 Forward or expose scrollRef from MessageList's internal ScrollView ref
- [ ] 4.4 Remove all scroll-related code, useEffect hooks, render messages logic from ConversationPanel (should be under 20 lines)
- [ ] 4.5 Keep `formatTime`, `getRoleColors`, `getBubbleStyle` as named exports from conversationPanel.js for the new messageBubble.js import
- [ ] 4.6 Verify the ConversationPanel still mounts with empty messages and shows "No messages yet" placeholder

## 5. Update App.js

- [ ] 5.1 Add `messageListRef = useRef(null)` to App.js
- [ ] 5.2 Update ConversationPanel render to pass `scrollRef={scrollRef}` (forwarding App's scrollRef) and add `messageListRef={messageListRef}` as a ref callback
- [ ] 5.3 Replace `addMessage(msg)` function: call `messageListRef.current?.addMessage(msg.role, msg.content, { ...rest })`
- [ ] 5.4 Update `handleChat` assistant message creation: call `messageListRef.current?.addMessage("assistant", "", { streaming: true, time: ... })` and track the bubble ID
- [ ] 5.5 Update `createStreamingHandler`: replace `setMessages(prev => clone+mutate)` with `messageListRef.current?.updateMessage(bubbleId, { content: text + "\u2588", streaming: true })`
- [ ] 5.6 Update `finalizeStreaming`: replace `setMessages(prev => clone+mutate)` with `messageListRef.current?.updateMessage(bubbleId, { content, streaming: false, ... })`
- [ ] 5.7 Update abort error path in handleChat catch: replace `setMessages(prev => filter)` with targeted `updateMessage(bubbleId, { streaming: false })`
- [ ] 5.8 Update handleInterrupt: replace `setMessages(prev => clone+mutate)` with `updateMessage(bubbleId, { streaming: false })`
- [ ] 5.9 Update handleNewSession: replace `setMessages([])` with `messageListRef.current?.clear()`
- [ ] 5.10 Update command `.clear` action: replace `setMessages([])` with `messageListRef.current?.clear()`
- [ ] 5.11 Update skill action streaming path in handleCommand (the complex block starting at line 206-358) to use the same imperative pattern as handleChat
- [ ] 5.12 Update auto-continue path tool call display update: replace `setMessages` with `updateMessage`
- [ ] 5.13 Update circuit breaker path: replace `setMessages` with `updateMessage`
- [ ] 5.14 Replace `messages.length` in `statusProps` with a reference to MessageList's message count (or track it via state/ref)
- [ ] 5.15 Remove `addMessage` function that wraps `setMessages` — replace all call sites

## 6. Handle Session/Config Edge Cases

- [ ] 6.1 Ensure the scrollRef from App.js (used in keyboard navigation at app.js line 862-875) is forwarded through ConversationPanel to MessageList's ScrollView
- [ ] 6.2 Ensure the cursor character config (from config.tui.cursorChar) is available — or repurpose the hardcoded `\u2588` for message bubbles
- [ ] 6.3 Ensure initial session restore works: when App mounts with a session state, the useEffect that calculates tokens is untouched, but messages should be synced to MessageList (add a seed mechanism)
- [ ] 6.4 Verify that `messages` state in App.js still works for the `statusProps.messageCount` — either track a count in a ref in App or add a method to MessageList to get current count

## 7. Tests

- [ ] 7.1 Create `tests/unit/tui/messageBubble.test.js` — test rendering with various roles, update behavior
- [ ] 7.2 Create `tests/unit/tui/messageList.test.js` — test addMessage, updateMessage, clear, setMessages, ref API
- [ ] 7.3 Update `tests/unit/tui/conversationPanel.test.js` — update to mock MessageList instead of testing ConversationPanel's own logic
- [ ] 7.4 Ensure all existing tests pass

## 8. Verify & Clean Up

- [ ] 8.1 Run `npm run lint` and fix any issues
- [ ] 8.2 Run `npm run test` and fix any failures
- [ ] 8.3 Run `npm start` briefly and verify the app boots without errors
- [ ] 8.4 Manually verify: user message appears on send, assistant streams, interrupt works, new session clears
