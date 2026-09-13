## 1. Implement Coalescing Logic

- [ ] 1.1 Add a `SEGMENT_COALESCE_TIMEOUT_MS` constant (value `250`) and an exported pure `coalesceSegments(existingSegments, newSegment, timeoutMs)` function in `src/tui/messageList.js` that implements the Desired Behavior table from `docs/STREAMING.md`.
- [ ] 1.2 Update `updateMessage` in `src/tui/messageList.js` to use `coalesceSegments` for the segment append/coalesce path, storing the merged segments and logging the measured gap via the structured logger on cross-type transitions.

## 2. Capture Timing in Stream Handler

- [ ] 2.1 Update `src/tui/conversationArea.js` stream event handler to attach a `time` field (via `Date.now()`) to each `message` and `reasoning` segment it constructs.

## 3. Update Message Typedef

- [ ] 3.1 Update the `Message` typedef in `src/tui/messages.js` so `segments` is documented as `Array<{type: string, content: string, time?: number}>`.

## 4. Add Unit Tests

- [ ] 4.1 Add unit tests for `coalesceSegments` covering: same-type append, cross-type append within timeout, cross-type new block after timeout, and punctuation-terminated anchor forcing a new block.
- [ ] 4.2 Update the imperative API simulation in `tests/unit/tui/messageList.test.js` to mirror the new coalescing behavior and add coverage for the timing/punctuation rules.

## 5. Verify

- [ ] 5.1 Run `npm run test`, `npm run lint`, and `npm run coverage` to confirm no regressions.
