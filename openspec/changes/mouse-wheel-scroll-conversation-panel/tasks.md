## 1. Mouse Scroll Hook

- [x] 1.1 Create `src/tui/useMouseScroll.js` with a `useMouseScroll` hook that enables terminal mouse reporting (`\x1b[?1000h` / `\x1b[?1006h`) on mount and disables it (`\x1b[?1000l` / `\x1b[?1006l`) on unmount.
- [x] 1.2 Implement SGR mouse sequence parsing to detect wheel-up (button 64) and wheel-down (button 65), invoking a callback with `-1` / `+1` delta.
- [x] 1.3 Attach a `data` listener on `process.stdin` and remove it on unmount.
- [x] 1.4 Only enable mouse reporting when `stdout.isTTY` and not in CI.

## 2. Wire into Conversation Panel

- [x] 2.1 Wire the `useMouseScroll` hook into `src/tui/app.js` so wheel events call `conversationAreaRef.current?.scrollBy(delta)`.
- [x] 2.2 Only handle mouse events when `currentView === PANELS.CONVERSATION` and the file picker is closed.

## 3. Scroll-Up Suppression Integration

- [x] 3.1 Set `isUserScrolledUpRef` to `true` when the user scrolls up via mouse, using the ScrollView's `onScroll` callback.
- [x] 3.2 Set `isUserScrolledUpRef` to `false` when the user returns to the bottom.

## 4. Tests

- [x] 4.1 Add `tests/unit/tui/useMouseScroll.test.js` covering SGR sequence parsing (wheel-up vs wheel-down).
- [x] 4.2 Add tests for mouse reporting enable/disable on mount/unmount and stdin listener cleanup.

## 5. Verification

- [x] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm everything passes.
