## 1. Add cleanup helper to SessionStateManager

- [x] 1.1 Add `removeLastAssistantToolCallMessage()` method to `src/session/stateManager.js` that checks if the last conversation entry is an assistant message with tool_calls and removes it if so
- [x] 1.2 Ensure the helper is idempotent — safe to call when no matching message exists (no-op)
- [x] 1.3 Ensure the helper handles empty conversation array without errors

## 2. Update handleInterrupt() to use cleanup helper

- [x] 2.1 In `src/tui/app.js`, modify `handleInterrupt()` (line 944) to call `sessionState.removeLastAssistantToolCallMessage()` after aborting the controller and before waiting for dispatch to complete
- [x] 2.2 Ensure the cleanup happens before the dispatchPromise resolves, so the conversation is clean when the AbortError catch block runs

## 3. Update AbortError catch block to use cleanup helper

- [x] 3.1 In `src/tui/app.js`, modify the AbortError catch block (line 904-913) to call `sessionState.removeLastAssistantToolCallMessage()` before calling `sessionState.popExchange()`
- [x] 3.2 Ensure the order is correct: remove assistant tool-call message first, then pop user message

## 4. Add unit tests

- [x] 4.1 Add tests for `removeLastAssistantToolCallMessage()` in `src/session/stateManager.js` covering: assistant message with tool_calls present, assistant message without tool_calls, no assistant message, empty conversation
- [x] 4.2 Add tests for `handleInterrupt()` cleanup behavior in `src/tui/app.js` covering: interrupt during tool execution, interrupt during text response, interrupt with no assistant message

## 5. Verify and lint

- [x] 5.1 Run `npm run lint` to verify no linting errors
- [x] 5.2 Run `npm run test` to verify all tests pass
- [x] 5.3 Run `npm start` to verify application starts without crashing