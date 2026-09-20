## 1. Implementation

- [ ] 1.1 Extend the render guard in `src/tui/messageList.js` so an assistant bubble is kept when `segments` contains a `reasoning` or `message` segment with non-empty trimmed content, even when `streaming` is false and `content` is empty.

## 2. Testing

- [ ] 2.1 Add a regression test in `tests/unit/tui/messageList.test.js` covering an interrupted assistant bubble with reasoning segments and empty content (`streaming=false`) that should still render.

## 3. Verification

- [ ] 3.1 Run `npm run test` and confirm all tests pass.
- [ ] 3.2 Run `npm run lint` and confirm no lint/format issues.
- [ ] 3.3 Run `npm run coverage` and confirm coverage is maintained.
