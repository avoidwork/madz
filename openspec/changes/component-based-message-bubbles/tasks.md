## 1. Create MessageBubble Component

- [x] 1.1 Create src/tui/messageBubble.js with MessageBubble component skeleton
- [x] 1.2 Add useState hooks for content, streaming, toolCallDisplay, reasoningContent, and activeToolCall
- [x] 1.3 Implement useImperativeHandle to expose update() method
- [x] 1.4 Implement update() method that accepts content, streaming, toolCallDisplay, and reasoningContent parameters
- [x] 1.5 Implement render logic: role label, formatted content, streaming indicator, tool call display
- [ ] 1.6 Reuse utility functions from src/tui/messages.js (getRoleLabel, formatMessage, isStreamingMessage, countMessageLines, getToolCallLines)
- [x] 1.7 Add memoized rendering with React.memo to only re-render when own state changes
- [x] 1.8 Assign stable ID via randomUUID at component creation

## 2. Create MessageList Component

- [x] 2.1 Create src/tui/messageList.js with MessageList component skeleton
- [x] 2.2 Add useState for array of MessageBubble elements
- [x] 2.3 Implement addMessage(role, content) method that creates new MessageBubble with randomUUID
- [x] 2.4 Implement updateMessage(id, updates) method that finds bubble by ID and calls its update()
- [x] 2.5 Implement clear() method that empties the bubble array
- [x] 2.6 Implement MAX_RENDER_MESSAGES windowing logic to limit DOM size
- [x] 2.7 Implement internal scroll-to-bottom via useRef and ScrollView ref
- [x] 2.8 Auto-scroll on new message addition and content update
- [x] 2.9 Preserve user scroll position when they scroll up to read history
- [x] 2.10 Render bubbles in ScrollView with proper key props

## 3. Simplify ConversationPanel

- [x] 3.1 Remove all message data, scroll logic, and refs from conversationPanel.js
- [x] 3.2 Replace renderMessages() function with MessageList rendering
- [x] 3.3 Accept scrollRef prop and pass it to MessageList
- [x] 3.4 Remove forceRender and renderCount usage
- [x] 3.5 Verify ConversationPanel is a thin wrapper (~500 bytes vs current ~7579 bytes)

## 4. Update App Component

- [x] 4.1 Remove messagesRef (useRef([])) declaration
- [x] 4.2 Remove forceRender (useState(0)) declaration
- [x] 4.3 Remove renderCount (useState(0)) declaration
- [x] 4.4 Create messageListRef via useRef for MessageList component instance
- [x] 4.5 Replace all messagesRef.current.push/spread operations with messageListRef.current.addMessage()
- [ ] 4.6 Replace streaming handler mutations with messageListRef.current.updateMessage(id, chunk)
- [ ] 4.7 Update createStreamingCallback to call updateMessage instead of mutating messagesRef
- [ ] 4.8 Remove scrollRef (now handled by MessageList internally)
- [ ] 4.9 Remove array spreading from message rendering
- [ ] 4.10 Remove useEffect scroll-to-bottom logic (moved to MessageList)

## 5. Update Tests

- [ ] 5.1 Update test mocks in tests/unit/tui/ to use new component API
- [ ] 5.2 Replace mocks of setMessages with mocks of messageListRef.current.addMessage/updateMessage
- [ ] 5.3 Replace mocks of messagesRef with mocks of MessageList component
- [ ] 5.4 Add tests for MessageBubble component (state updates, streaming, tool calls)
- [ ] 5.5 Add tests for MessageList component (add, update, clear, windowing)
- [ ] 5.6 Add tests for ConversationPanel simplification
- [ ] 5.7 Verify all 1072 tests pass

## 6. Verify and Clean Up

- [ ] 6.1 Run npm run test and verify all tests pass
- [ ] 6.2 Run npm run lint and verify no lint errors
- [ ] 6.3 Run npm run coverage and verify coverage is maintained
- [ ] 6.4 Run npm start and verify application starts without crashing
- [ ] 6.5 Verify messages render immediately when created (no streaming delay)
- [ ] 6.6 Verify no array spreading or ref mutations remain in message flow
- [ ] 6.7 Verify user can scroll up to read history and new messages appear at bottom