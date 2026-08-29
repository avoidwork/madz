## 1. Relax pub/sub deduplication for streaming

- [ ] 1.1 In `src/tui/messageBubble.js` `handleUpdate`, add a guard to skip the dedup check when `data?.streaming` is truthy, so every streaming chunk is appended to the chunks array.

## 2. Scroll on every streaming tick

- [ ] 2.1 In the streaming `useEffect` in `MessageBubbleInner`, call `scrollToBottom()` on every render tick while `streaming` is true, not only when `text.length > prevContentLengthRef.current`.

## 3. Add tests

- [ ] 3.1 Create `tests/unit/tui/messageBubble.test.js` with tests for:
  - Streaming dedup bypass: when `streaming: true`, identical chunks are appended
  - Non-streaming dedup preserved: when `streaming: false`, identical chunks are skipped
  - Streaming scroll: `scrollToBottom` is called on every streaming tick regardless of content length change
  - Non-streaming scroll: scroll only on content growth when not streaming

## 4. Verify

- [ ] 4.1 Run `npm run lint` to confirm no lint errors
- [ ] 4.2 Run `npm run test` to confirm all tests pass
- [ ] 4.3 Run `npm run coverage` to confirm coverage is maintained
