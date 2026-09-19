## 1. Remove unicode prefix from reasoning rendering

- [x] 1.1 Remove the `💭 ` prefix from reasoning segment rendering in `src/tui/messageBubble.js` line 282 (change `` `💭 ` + seg.content`` to `seg.content`), keeping the gray color and offset styling.
- [x] 1.2 Update the stale comment in `src/tui/messageList.js` line 179 that references "separate 💭 blocks" to remove the unicode reference (e.g., "separate reasoning blocks").

## 2. Add test coverage

- [x] 2.1 Add/update a test in `tests/unit/tui/messageBubble.test.js` asserting that reasoning segments render without the `💭 ` prefix.

## 3. Verify

- [x] 3.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
