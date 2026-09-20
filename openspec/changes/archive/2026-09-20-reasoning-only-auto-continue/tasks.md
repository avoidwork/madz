# Tasks: Reasoning-only auto-continue

## 1. Implementation

- [x] 1.1 Modify `src/tui/conversationArea.js` to detect reasoning-only completion after `finalizeStreaming` and dispatch a silent continue via `handleChat("Please continue.", { silentUser: true })`
- [x] 1.2 Ensure the silent continue renders in a fresh assistant bubble (via `handleChat`'s `addMessage("assistant", "", ...)`) rather than appending to the existing reasoning bubble

## 2. Tests

- [x] 2.1 Add unit test coverage in `tests/unit/tui/conversationArea.test.js` for the reasoning-only completion path, asserting a silent continue is dispatched and a fresh assistant bubble is created

## 3. Verification

- [x] 3.1 Run `npm run test` and confirm all tests pass
- [x] 3.2 Run `npm run lint` and confirm no lint errors
- [x] 3.3 Run `npm run coverage` and confirm coverage is maintained
