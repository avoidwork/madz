# Tasks: Fix TUI Flicker on Keystrokes and Spinner

## Task 1: Memoize StatusBar

- [x] 1.1: Add `React.memo` wrapper to the StatusBar component in `src/tui/statusBar.js`
- [x] 1.2: Verify the component still renders correctly with all props

## Task 2: Memoize InputPanel

- [x] 2.1: Add `React.memo` wrapper to the InputPanel component in `src/tui/inputPanel.js`
- [x] 2.2: Verify the component still handles input correctly

## Task 3: Memoize MessageList

- [x] 3.1: Add `React.memo` wrapper to the MessageList component in `src/tui/messageList.js`
- [x] 3.2: Verify the component still manages messages and scrolling correctly

## Task 4: Stabilize App Handlers

- [x] 4.1: Wrap `handleSubmit` with `useCallback` (dependencies: `handleInterrupt`, `handleCommand`, `handleChat`, `gcManager`)
- [x] 4.2: Wrap `handleInputFocus` with `useCallback`
- [x] 4.3: Wrap `handleInputBlur` with `useCallback`
- [x] 4.4: Verify all child components receive stable handler references

## Task 5: Isolate Spinner with ANSI Escape Codes

- [x] 5.1: Remove `ink-spinner` import from `src/tui/statusBar.js`
- [x] 5.2: Add `useEffect` with `setInterval` to write spinner frames via `stdout.write()`
- [x] 5.3: Use `\x1B[1A\x1B[0G` cursor positioning to target status bar line (prevents spinner from rendering in input bar)
- [x] 5.4: Use `\x1B[?25l` to hide cursor and `\x1B[?25h` to restore on unmount
- [x] 5.5: Use 10-frame spinner sequence (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) at 80ms interval
- [x] 5.6: Clean up interval and restore cursor on component unmount
- [x] 5.7: Verify spinner still animates correctly in the TUI

## Task 6: Fix Auto-Scroll on Initial Responses

- [x] 6.1: Add scroll trigger when streaming first starts (even if content is empty) in `src/tui/messageBubble.js`
- [x] 6.2: Add scroll trigger for assistant messages in `src/tui/messageList.js` (previously only scrolled for user/system)
- [x] 6.3: Verify initial responses scroll correctly

## Task 7: Verify and Test

- [x] 7.1: Run `npm run test` to verify no regressions
- [x] 7.2: Run `npm run lint` to verify code quality
- [x] 7.3: Verify app starts without crashing (`timeout 10 npm start`)
