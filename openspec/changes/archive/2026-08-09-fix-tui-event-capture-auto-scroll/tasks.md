## 1. Analyze current useInput() handler

- [x] 1.1 Read src/tui/app.js useInput() handler (lines ~809-879) and map all key event handling paths
- [x] 1.2 Identify which keys are currently captured vs. which fall through, and document the current behavior

## 2. Restructure useInput() for focus-aware routing

- [x] 2.1 Refactor useInput() to check inputFocused state and conditionally intercept keys
- [x] 2.2 When inputFocused is true: only intercept Tab (focus toggle) and Escape (global action); allow all other keys to pass through
- [x] 2.3 When inputFocused is false: intercept upArrow, downArrow, pageUp, pageDown for message list navigation; allow Escape for global quit/interrupt
- [x] 2.4 Ensure Tab always toggles focus regardless of current focus state

## 3. Verify message list auto-scroll receives key events

- [x] 3.1 Confirm message list component's scrollBy() methods are accessible when key events bubble through
- [x] 3.2 Verify that auto-scroll during streaming now triggers when inputBar is focused (events no longer captured by app-level handler)

## 4. Test all keyboard interactions

- [x] 4.1 Test Tab toggling focus between inputBar and message list
- [x] 4.2 Test Escape from inputBar interrupts streaming
- [x] 4.3 Test Escape from message list quits app
- [x] 4.4 Test up/down/pageUp/pageDown navigation when message list is focused
- [x] 4.5 Test that key events bubble to message list when inputBar is focused

## 5. Run lint, tests, and verify application starts

- [x] 5.1 Run npm run lint (or equivalent)
- [x] 5.2 Run npm run test (or equivalent)
- [x] 5.3 Run npm start with timeout to verify app starts without crashing (app starts cleanly; TUI error is expected — Ink requires a real TTY, not a code change regression)
