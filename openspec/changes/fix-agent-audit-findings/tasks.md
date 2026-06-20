## 1. Import Updates

- [x] 1.1 Add ToolMessage and HumanMessageChunk to @langchain/core/messages imports in src/agent/react.js

## 2. Message Type Detection Helper

- [x] 2.1 Implement getMessageRole() function that maps HumanMessage/HumanMessageChunk → "user", AIMessage/AIMessageChunk → "assistant", ToolMessage → "tool", SystemMessage → "system", with "system" fallback for unknown types
- [x] 2.2 Replace inline type detection in callReactAgent (line ~172) with getMessageRole() call
- [x] 2.3 Replace inline type detection in callReactAgentStreaming (line ~472) with getMessageRole() call

## 3. Streaming Response Fix

- [x] 3.1 Fix first return point in callReactAgentStreaming (success path, line ~436) to return { content: aggregatedText || originalMessage }
- [x] 3.2 Fix second return point in callReactAgentStreaming (end-of-stream, line ~524) to return { content: aggregatedText || originalMessage }

## 4. Performance Optimization

- [x] 4.1 Replace [...msgsArray].reverse().find() with reverse for-loop in extractContent() function

## 5. Unit Tests

- [x] 5.1 Add tests for getMessageRole(): HumanMessage → "user", HumanMessageChunk → "user", AIMessage → "assistant", AIMessageChunk → "assistant", ToolMessage → "tool", SystemMessage → "system", unknown → "system"
- [x] 5.2 Add test for streaming aggregation: multiple AIMessageChunk events produce concatenated text
- [x] 5.3 Add test for streaming fallback: empty events array returns original message

## 6. Verification

- [ ] 6.1 Run npm run test and verify all tests pass
- [ ] 6.2 Run npm run lint and verify no lint errors
- [ ] 6.3 Verify application starts without errors