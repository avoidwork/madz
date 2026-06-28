## 1. Examine existing code and checkpointer API

- [ ] 1.1 Read `src/session/stateManager.js` to understand `removeLastAssistantToolCallMessage()` implementation and its access to session state
- [ ] 1.2 Read `src/agent/react.js` to understand how the LangGraph graph is created, how the checkpointer is passed, and where `dispatchProvider` is called
- [ ] 1.3 Read `src/tui/app.js` to understand `handleChat()` and `handleCommand()` interrupt cleanup paths (lines 524-526 and 922-924)
- [ ] 1.4 Verify the JavaScript LangGraph checkpointer API — confirm `put()` or `update()` method signature and expected state format

## 2. Propagate checkpoint cleanup in stateManager

- [ ] 2.1 Modify `removeLastAssistantToolCallMessage()` to accept an optional checkpointer parameter
- [ ] 2.2 After removing the last assistant message with tool_calls from in-memory state, call `checkpointer.put()` with the cleaned conversation state
- [ ] 2.3 Handle edge case where checkpointer is not provided (graceful no-op for backward compatibility)
- [ ] 2.4 Ensure the checkpoint state update uses the correct thread_id from session state

## 3. Add cleanup to handleCommand interrupt path

- [ ] 3.1 In `handleCommand()` interrupt path (app.js:524-526), add call to `sessionState.removeLastAssistantToolCallMessage()` before `popExchange()`
- [ ] 3.2 Ensure the call is guarded — only execute if there are assistant messages with tool_calls to remove
- [ ] 3.3 Verify both interrupt paths (chat and command) produce identical cleanup behavior

## 4. Implement checkpoint reconciliation on resume

- [ ] 4.1 Add an `#interruptOccurred` flag to session state to track when an interrupt has happened
- [ ] 4.2 Set the flag in both `handleChat()` and `handleCommand()` interrupt paths
- [ ] 4.3 In `react.js`, before `dispatchProvider` call, check if `#interruptOccurred` is true
- [ ] 4.4 If flag is true, compare checkpoint messages with in-memory conversation messages
- [ ] 4.5 If they diverge (different length or last messages don't match), write cleaned in-memory state to checkpoint via `checkpointer.put()`
- [ ] 4.6 Clear the `#interruptOccurred` flag after reconciliation

## 5. Add integration test for interrupt/resume scenario

- [ ] 5.1 Create `tests/integration/interrupt-checkpoint.test.js` (or add to existing integration test file)
- [ ] 5.2 Mock the LangGraph checkpointer to capture state writes
- [ ] 5.3 Simulate a tool call interrupt via the chat path and verify checkpoint is cleaned
- [ ] 5.4 Simulate a tool call interrupt via the command path and verify checkpoint is cleaned
- [ ] 5.5 Verify that resuming after interrupt does not replay orphaned tool calls
- [ ] 5.6 Verify that normal resume (no interrupt) is unaffected by reconciliation logic

## 6. Verify and commit

- [ ] 6.1 Run `npm run test` to ensure all tests pass
- [ ] 6.2 Run `npm run lint` to ensure lint passes
- [ ] 6.3 Run `npm run coverage` to ensure 100% coverage is maintained
- [ ] 6.4 Run `timeout 10 npm start` to verify application starts without crashing
- [ ] 6.5 Commit changes with conventional commit format
- [ ] 6.6 Push branch and create PR