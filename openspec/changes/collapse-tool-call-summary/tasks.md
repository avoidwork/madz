## 1. Shared Helpers

- [ ] 1.1 Add `normalizeCompletedToolCalls(calls)` to `src/tui/messages.js` — collapses a legacy array into a count map, copies an existing map, never mutates input.
- [ ] 1.2 Add `hasCompletedToolCalls(calls)` to `src/tui/messages.js` — returns true if there is at least one completed call.
- [ ] 1.3 Add `formatCompletedToolCalls(calls)` to `src/tui/messages.js` — returns `{ total, text }`, hiding `×1` for single calls and preserving insertion order.

## 2. Aggregation at the Source

- [ ] 2.1 In `src/tui/conversationArea.js`, change `completedToolCalls` from `[]` to `{}`.
- [ ] 2.2 Update the `on_tool_end` handler to increment `completedToolCalls[event.name]` and publish a shallow copy.

## 3. Render Path

- [ ] 3.1 In `src/tui/messageBubble.js`, replace the `.length`/`.join()` logic with `formatCompletedToolCalls` and gate on `hasCompletedToolCalls`.

## 4. Height Calc & Session Restore

- [ ] 4.1 In `src/tui/messageList.js`, change the `estimateMessageHeight` check from `.length > 0` to `hasCompletedToolCalls`.
- [ ] 4.2 In `src/tui/messageList.js` `setMessages`, wrap `m.completedToolCalls` with `normalizeCompletedToolCalls`.

## 5. Tests

- [ ] 5.1 Add unit tests for the three helpers in `tests/unit/tui/messages.test.js`.
- [ ] 5.2 Add a render test in `tests/unit/tui/messageBubble.test.js` asserting `read_file ×3` renders instead of repeated names.

## 6. Verification

- [ ] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage`.
