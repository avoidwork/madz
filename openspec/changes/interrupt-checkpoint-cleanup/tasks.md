## 1. Investigate LangGraph Checkpointer API

- [ ] 1.1 Review LangGraph JS checkpointer API in src/agent/react.js to understand available methods for checkpoint updates
- [ ] 1.2 Verify checkpointer.put() or checkpointer.update() signature and expected state tuple format
- [ ] 1.3 Confirm thread_id is available in interrupt handling context for scoping checkpoint operations

## 2. Extend removeLastAssistantToolCallMessage for checkpoint cleanup

- [ ] 2.1 Modify removeLastAssistantToolCallMessage() in src/session/stateManager.js to accept optional checkpointer parameter
- [ ] 2.2 Implement checkpoint update logic: after removing message from in-memory conversation, call checkpointer.put() with cleaned state
- [ ] 2.3 Add graceful degradation: if checkpointer is unavailable or update fails, log warning and continue with in-memory cleanup only

## 3. Add cleanup to handleCommand() interrupt path

- [ ] 3.1 Identify the interrupt handling code in handleCommand() in src/tui/app.js (around lines 524-526)
- [ ] 3.2 Add removeLastAssistantToolCallMessage() call alongside existing popExchange() to match handleChat() behavior
- [ ] 3.3 Pass checkpointer to removeLastAssistantToolCallMessage() if available

## 4. Implement checkpoint reconciliation on resume

- [ ] 4.1 Add reconciliation step before dispatchProvider in src/agent/react.js that compares checkpoint state with in-memory conversation
- [ ] 4.2 Implement state comparison logic: compare message IDs and types between checkpoint and in-memory state
- [ ] 4.3 If states diverge, write cleaned state to checkpoint before proceeding with dispatchProvider
- [ ] 4.4 Ensure normal (non-interrupt) resume is not affected — reconciliation only triggers when states diverge

## 5. Add integration test for interrupt cleanup

- [ ] 5.1 Create test file tests/unit/interrupt-checkpoint-cleanup.test.js
- [ ] 5.2 Mock a tool call that requires user input and simulate interrupt during execution
- [ ] 5.3 Verify checkpoint contains no orphaned AIMessages with tool_calls after interrupt
- [ ] 5.4 Verify no duplicate tool calls in resumed conversation after interrupt + new message
- [ ] 5.5 Test both handleChat() and handleCommand() interrupt paths
- [ ] 5.6 Test graceful degradation when checkpointer is unavailable

## 6. Verify and test

- [ ] 6.1 Run npm run test to verify all tests pass
- [ ] 6.2 Run npm run lint to verify no lint errors
- [ ] 6.3 Run npm run coverage to verify coverage is maintained
- [ ] 6.4 Run timeout 10 npm start to verify application starts without crashing