## 1. Add cleanup helper to SessionStateManager

- [ ] 1.1 Add `removeLastAssistantToolCallMessage()` method to `src/session/stateManager.js` that checks if the last conversation entry is an assistant message with tool_calls and removes it if so
- [ ] 1.2 Ensure the helper is idempotent — safe to call when no matching message exists (no-op)
- [ ] 1.3 Ensure the helper handles empty conversation array without errors

## 2. Update handleInterrupt() to use cleanup helper

- [ ] 2.1 In `src/tui/app.js`, modify `handleInterrupt()` (line 944) to call `sessionState.removeLastAssistantToolCallMessage()` after aborting the controller and before waiting for dispatch to complete
- [ ] 2.2 Ensure the cleanup happens before the dispatchPromise resolves, so the conversation is clean when the AbortError catch block runs

## 3. Update AbortError catch block to use cleanup helper

- [ ] 3.1 In `src/tui/app.js`, modify the AbortError catch block (line 904-913) to call `sessionState.removeLastAssistantToolCallMessage()` before calling `sessionState.popExchange()`
- [ ] 3.2 Ensure the order is correct: remove assistant tool-call message first, then pop user message

## 4. Add unit tests

- [ ] 4.1 Add tests for `removeLastAssistantToolCallMessage()` in `src/session/stateManager.js` covering: assistant message with tool_calls present, assistant message without tool_calls, no assistant message, empty conversation
- [ ] 4.2 Add tests for `handleInterrupt()` cleanup behavior in `src/tui/app.js` covering: interrupt during tool execution, interrupt during text response, interrupt with no assistant message

## 5. Verify and lint

- [ ] 5.1 Run `npm run lint` to verify no linting errors
- [ ] 5.2 Run `npm run test` to verify all tests pass
- [ ] 5.3 Run `npm start` to verify application starts without crashing