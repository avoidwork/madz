## 1. Shared Helpers

- [x] 1.1 Add `normalizeCompletedToolCalls(calls)` to `src/tui/messages.js` — collapses a legacy array into a count map, copies an existing map, never mutates input.
- [x] 1.2 Add `hasCompletedToolCalls(calls)` to `src/tui/messages.js` — returns true if there is at least one completed call.
- [x] 1.3 Add `formatCompletedToolCalls(calls)` to `src/tui/messages.js` — returns `{ total, text }`, hiding `×1` for single calls and preserving insertion order.

## 2. Aggregation at the Source

- [x] 2.1 In `src/tui/conversationArea.js`, change `completedToolCalls` from `[]` to `{}`.
- [x] 2.2 Update the `on_tool_end` handler to increment `completedToolCalls[event.name]` and publish a shallow copy.

## 3. Render Path

- [x] 3.1 In `src/tui/messageBubble.js`, replace the `.length`/`.join()` logic with `formatCompletedToolCalls` and gate on `hasCompletedToolCalls`.

## 4. Height Calc & Session Restore

- [x] 4.1 In `src/tui/messageList.js`, change the `estimateMessageHeight` check from `.length > 0` to `hasCompletedToolCalls`.
- [x] 4.2 In `src/tui/messageList.js` `setMessages`, wrap `m.completedToolCalls` with `normalizeCompletedToolCalls`.

## 5. Tests

- [x] 5.1 Add unit tests for the three helpers in `tests/unit/tui/messages.test.js`.
- [x] 5.2 Add a render test in `tests/unit/tui/messageBubble.test.js` asserting `read_file ×3` renders instead of repeated names.

## 6. Verification

- [x] 6.1 Run `npm run test`, `npm run lint`, and `npm run coverage`.
