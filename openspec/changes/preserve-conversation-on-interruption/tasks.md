## 1. Audit AbortError Handlers

- [ ] 1.1 Review src/tui/app.js lines 506-529 and 906-925 to identify all checkpointer.deleteThread(threadId) calls in AbortError handlers
- [ ] 1.2 Verify that explicit quit handlers (handleQuit) are in separate code paths and unaffected by the change

## 2. Implement Fix

- [ ] 2.1 Remove checkpointer.deleteThread(threadId) call from first AbortError handler (lines ~506-529)
- [ ] 2.2 Remove checkpointer.deleteThread(threadId) call from second AbortError handler (lines ~906-925)
- [ ] 2.3 Verify explicit quit behavior still calls deleteThread correctly

## 3. Write Tests

- [ ] 3.1 Write unit test: AbortError during streaming preserves conversation checkpoint
- [ ] 3.2 Write unit test: Explicit quit still deletes conversation checkpoint
- [ ] 3.3 Write unit test: Non-AbortError errors are unaffected by the change

## 4. Verify

- [ ] 4.1 Run full test suite and confirm all tests pass
- [ ] 4.2 Run lint to confirm no lint errors
- [ ] 4.3 Verify application starts without crashing