## 1. Add focus state to InputPanel

- [ ] 1.1 Pass computed `cursorChar` to InputPanel based on `isInputFocused` state in App
- [ ] 1.2 When conversation is focused, pass `cursorChar={undefined}` to hide cursor
- [ ] 1.3 Ensure Blink component renders zero-width space when char is undefined

## 2. Remove useInput from ConversationPanel

- [ ] 2.1 Remove the `useInput((input, key) => executeScrollInput(...))` call from ConversationPanel
- [ ] 2.2 Keep pure functions `handleScrollInput`, `executeScrollInput` exported for testing
- [ ] 2.3 Keep `executeResize` and `executeAutoScroll` as pure functions (app calls them or they remain for testability)

## 3. Wire scroll ref via callback in ConversationPanel

- [ ] 3.1 Add `onScrollRef` callback prop to ConversationPanel and pass `scrollRef.current` through it
- [ ] 3.2 Update existing memo behavior in renderMessages to be unchanged

## 4. Centralize focus state and key routing in App

- [ ] 4.1 Add `isInputFocused` boolean state in App, default `true`
- [ ] 4.2 Add Tab handling: `key.tab` without `key.shift` → set `isInputFocused(false)`
- [ ] 4.3 Add Shift+Tab handling: `key.tab && key.shift` → set `isInputFocused(true)`
- [ ] 4.4 Conditionally apply input handler keys (char, backspace, Enter, history nav) only when `isInputFocused === true`
- [ ] 4.5 Conditionally apply scroll handler keys (upArrow, downArrow, pageUp, pageDown) only when `isInputFocused === false`
- [ ] 4.6 Route scroll input through `handleScrollInput(scrollRef.current, key)` when conversation is focused
- [ ] 4.7 Pass scroll ref to ConversationPanel via callback prop `onScrollRef`
- [ ] 4.8 Return focus to input after Enter (`isInputFocused(true)`) in handleSubmit
- [ ] 4.9 Compute `activeCursorChar = isInputFocused ? config?.tui?.cursorChar ?? "\u2588" : undefined` and pass to InputPanel

## 5. Update tests

- [ ] 5.1 Add test for cursor hidden when char is undefined in `tests/unit/tui.test.js`
- [ ] 5.2 Add test for Tab/Shift+Tab focus cycling in `tests/unit/tui.test.js`
- [ ] 5.3 Add focus-routing tests: keys only affect focused panel in `tests/unit/tui.test.js`
- [ ] 5.4 Update `tests/unit/conversationPanel.test.js` for removed useInput (scroll now handled externally)

## 6. Run lint and tests

- [ ] 6.1 Run `npm run lint` and fix any issues
- [ ] 6.2 Run `npm run test` and verify all tests pass
- [ ] 6.3 Run `npm run coverage` and verify coverage maintained
