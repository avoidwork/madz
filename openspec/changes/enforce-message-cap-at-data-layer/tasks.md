## 1. Implement data-layer cap in addMessage()

- [ ] 1.1 After pushing the new message ID to `idsRef.current`, add a check: if length exceeds `MAX_RENDER_MESSAGES`, shift off the oldest ID from index 0.
- [ ] 1.2 When shifting off an ID, clean up `dataRef`, `contentRef`, `idToIdxRef`, and the pub/sub topic from `topicsRef`.
- [ ] 1.3 Rebuild `idToIdxRef` indices after shifting (all remaining indices decrease by 1).

## 2. Make updateMessage() a no-op for shifted messages

- [ ] 2.1 In `updateMessage()`, verify the message ID exists in `idToIdxRef` before proceeding (early return if not found).
- [ ] 2.2 Add a test case verifying that updating a shifted message is a no-op.

## 2. Implement data-layer cap in setMessages()

- [ ] 2.1 After building the full internal state from the input array, check if `idsRef.current.length` exceeds `MAX_RENDER_MESSAGES`.
- [ ] 2.2 If over cap, truncate `idsRef.current` to the last 100 entries, rebuild `idToIdxRef`, and prune `dataRef`, `contentRef`, and pub/sub topics for removed messages.

## 3. Add regression tests

- [ ] 3.1 Test: addMessage when under cap — verify count increments correctly.
- [ ] 3.2 Test: addMessage when at cap — verify oldest message is shifted, count stays at 100.
- [ ] 3.3 Test: addMessage when over cap — verify oldest message is shifted, count stays at 100.
- [ ] 3.4 Test: setMessages when over cap — verify only last 100 retained, count is 100.
- [ ] 3.5 Test: setMessages preserves order — verify retained messages maintain relative order.
- [ ] 3.6 Test: orphaned data cleanup — verify dataRef, contentRef, idToIdxRef, and topicsRef are cleaned up on shift.

## 4. Verify and commit

- [ ] 4.1 Run `npm run test` — all tests pass.
- [ ] 4.2 Run `npm run lint` — no lint errors.
- [ ] 4.3 Run `npm run coverage` — coverage maintained.
- [ ] 4.4 Commit and push implementation code to the PR.