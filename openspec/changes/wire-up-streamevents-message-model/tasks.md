## 1. Extend Message Model

- [ ] 1.1 Add `events` field to Message typedef in src/tui/messages.js
- [ ] 1.2 Add `events` to JSDoc @param in addMessage options in src/tui/messageList.js
- [ ] 1.3 Store events in dataRef in addMessage in src/tui/messageList.js

## 2. Update MessageList to Pass Through Events

- [ ] 2.1 Pass events through in updateMessage (already handled via spread)
- [ ] 2.2 Pass events from source messages in setMessages in src/tui/messageList.js
- [ ] 2.3 Pass events to MessageBubble component in render loop in src/tui/messageList.js

## 3. Update Streaming Handler to Capture Events

- [ ] 3.1 Add events array initialization in createStreamingHandler in src/tui/app.js
- [ ] 3.2 Append all events to events array in createStreamingHandler in src/tui/app.js
- [ ] 3.3 Update message with events array after each event in src/tui/app.js

## 4. Populate Existing Fields from Events

- [ ] 4.1 Handle on_chat_model_stream — accumulate content from chunk in src/tui/app.js
- [ ] 4.2 Handle on_chat_model_stream — accumulate reasoning from chunk in src/tui/app.js
- [ ] 4.3 Handle on_tool_start — set activeToolCall with name, input, status in src/tui/app.js
- [ ] 4.4 Handle on_tool_end — clear activeToolCall, set toolCallDisplay in src/tui/app.js
- [ ] 4.5 Handle on_tool_error — set activeToolCall with name, error, status in src/tui/app.js

## 5. Update finalizeStreaming

- [ ] 5.1 Pass accumulated committedReasoning to finalizeStreaming in src/tui/app.js
- [ ] 5.2 Verify finalizeStreaming passes reasoningContent to message update in src/tui/app.js

## 6. Test and Verify

- [ ] 6.1 Run npm run test — all tests pass
- [ ] 6.2 Run npm run lint — no lint errors
- [ ] 6.3 Run npm run coverage — coverage maintained
- [ ] 6.4 Verify application starts without crashing
