## 1. Fix duplicate user exchange in handleChat

- [x] 1.1 Remove the duplicate `sessionState.addExchange({ role: "user", content: text })` call at line 463 in `src/tui/conversationArea.js`

## 2. Add updateContextSize calls in handleCommand skill path

- [x] 2.1 Add `updateContextSize(sessionState, config)` after user exchange at line 202 in `src/tui/conversationArea.js`
- [x] 2.2 Add `updateContextSize(sessionState, config)` after assistant exchange at line 317 in `src/tui/conversationArea.js`

## 3. Debounced streaming context size updates

- [x] 3.1 Add `updateContextDisplay` wrapper that propagates to both local state and status bar via `onContextChange`
- [x] 3.2 Replace all 4 `setContextSize` call sites in streaming handler with `updateContextDisplay`
- [x] 3.3 Debounce token calculation at 33ms (~30fps) to avoid pile-up on rapid chunks

## 4. Verify changes

- [x] 4.1 Run `npm run lint` to verify no linting errors
- [x] 4.2 Run `npm run test` to verify existing tests pass
- [x] 4.3 Confirm context size counter updates smoothly at ~30fps during streaming
