# Tasks: Fix TUI Flicker on Keystrokes and Spinner

## Task 1: Memoize StatusBar

- [ ] 1.1: Add `React.memo` wrapper to the StatusBar component in `src/tui/statusBar.js`
- [ ] 1.2: Verify the component still renders correctly with all props

## Task 2: Memoize InputPanel

- [ ] 2.1: Add `React.memo` wrapper to the InputPanel component in `src/tui/inputPanel.js`
- [ ] 2.2: Verify the component still handles input correctly

## Task 3: Memoize MessageList

- [ ] 3.1: Add `React.memo` wrapper to the MessageList component in `src/tui/messageList.js`
- [ ] 3.2: Verify the component still manages messages and scrolling correctly

## Task 4: Stabilize App Handlers

- [ ] 4.1: Wrap `handleSubmit` with `useCallback` (dependencies: `handleCommand`, `handleChat`, `isStreamingRef`)
- [ ] 4.2: Wrap `onChange` handler (`setInputText`) — already stable via React setter
- [ ] 4.3: Wrap `onFocus` handler with `useCallback`
- [ ] 4.4: Wrap `onBlur` handler with `useCallback`
- [ ] 4.5: Verify all child components receive stable handler references

## Task 5: Isolate Spinner with ANSI Escape Codes

- [ ] 5.1: Remove `ink-spinner` import from `src/tui/statusBar.js`
- [ ] 5.2: Add `useEffect` with `setInterval` to write spinner frames via `stdout.write()`
- [ ] 5.3: Use `\r` carriage return to overwrite spinner position each frame
- [ ] 5.4: Use `\x1B[?25l` to hide cursor and `\x1B[?25h` to restore on unmount
- [ ] 5.5: Use 10-frame spinner sequence (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) at 80ms interval
- [ ] 5.6: Clean up interval and restore cursor on component unmount
- [ ] 5.7: Verify spinner still animates correctly in the TUI

## Task 6: Verify and Test

- [ ] 6.1: Run `npm run test` to verify no regressions
- [ ] 6.2: Run `npm run lint` to verify code quality
- [ ] 6.3: Verify app starts without crashing (`timeout 10 npm start`)
