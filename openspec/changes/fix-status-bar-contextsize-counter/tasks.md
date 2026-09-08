## 1. Fix duplicate user exchange in handleChat

- [ ] 1.1 Remove the duplicate `sessionState.addExchange({ role: "user", content: text })` call at line 463 in `src/tui/conversationArea.js`

## 2. Add updateContextSize calls in handleCommand skill path

- [ ] 2.1 Add `updateContextSize(sessionState, config)` after user exchange at line 202 in `src/tui/conversationArea.js`
- [ ] 2.2 Add `updateContextSize(sessionState, config)` after assistant exchange at line 317 in `src/tui/conversationArea.js`

## 3. Verify changes

- [ ] 3.1 Run `npm run lint` to verify no linting errors
- [ ] 3.2 Run `npm run test` to verify existing tests pass
