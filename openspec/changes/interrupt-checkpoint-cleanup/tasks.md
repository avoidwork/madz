## 1. Extend stateManager.js with checkpoint cleanup

- [ ] 1.1 Update `removeLastAssistantToolCallMessage()` signature to accept optional checkpointer parameter
- [ ] 1.2 Implement checkpoint state read when checkpointer is provided
- [ ] 1.3 Implement orphaned AIMessage removal from checkpoint state
- [ ] 1.4 Implement checkpoint state write via `checkpointer.put()` with cleaned state
- [ ] 1.5 Ensure cleanup is idempotent — safe to call when checkpoint has no matching message

## 2. Update app.js interrupt handlers

- [ ] 2.1 Pass checkpointer to `removeLastAssistantToolCallMessage()` in `handleChat()` interrupt path
- [ ] 2.2 Add `removeLastAssistantToolCallMessage()` call to `handleCommand()` interrupt path (before `popExchange()`)
- [ ] 2.3 Ensure both interrupt paths use consistent cleanup logic

## 3. Add checkpoint reconciliation in react.js

- [ ] 3.1 Add checkpoint reconciliation logic before `dispatchProvider` resumes after interrupt
- [ ] 3.2 Implement comparison of in-memory conversation length vs checkpoint state
- [ ] 3.3 Implement reconciliation: truncate checkpoint if longer, or write in-memory if shorter
- [ ] 3.4 Ensure reconciliation only runs after interrupt (not on normal flow)

## 4. Add integration tests

- [ ] 4.1 Create test that simulates interrupt during tool execution
- [ ] 4.2 Verify checkpoint contains no orphaned AIMessages with tool_calls after interrupt
- [ ] 4.3 Verify in-memory state and checkpoint are consistent after interrupt
- [ ] 4.4 Verify resume after interrupt does not replay orphaned messages
- [ ] 4.5 Verify command-path interrupt cleanup (handleCommand path)

## 5. Verify and finalize

- [ ] 5.1 Run `npm run test` and verify all tests pass
- [ ] 5.2 Run `npm run lint` and verify no lint errors
- [ ] 5.3 Run `npm run coverage` and verify 100% coverage is maintained
- [ ] 5.4 Verify application starts without crashing (`npm start`)