## 1. Add pending bubble cleanup to messageList.js children rebuild

- [x] 1.1 After the `children.map()` block in messageList.js, add a check that inspects the last message in `renderData`
- [x] 1.2 If the last message has `role === "assistant"`, no content, and `streaming === true`, pop it from `newChildren`
- [x] 1.3 Verify the empty-message fallback still works after the pop (no children → "No messages yet")

## 2. Verify correctness

- [x] 2.1 Run `npm run lint` — no warnings or errors
- [x] 2.2 Run `npm run test` — all tests pass
- [x] 2.3 Run `npm run coverage` — coverage maintained
