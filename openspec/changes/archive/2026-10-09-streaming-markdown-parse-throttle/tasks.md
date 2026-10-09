## 1. Implement the throttled segment committer

- [x] 1.1 Add `createSegmentThrottle(commit, throttleMs)` to `src/tui/messageBubble.js` that buffers the latest segments and commits on a cadence
- [x] 1.2 Implement `push(segments, streaming)` to buffer and schedule/commit, `flush()` to commit immediately, and `dispose()` to clear the timer and buffer

## 2. Wire the throttle into the message bubble

- [x] 2.1 Create a `createSegmentThrottle` instance in `MessageBubbleInner`'s pub/sub `useEffect`
- [x] 2.2 Route published `segments` through `throttle.push(data.segments, data.streaming)` in `handleUpdate`
- [x] 2.3 Flush buffered segments on `streaming === false` and on the finalize path
- [x] 2.4 Call `throttle.dispose()` in the effect cleanup on unsubscribe

## 3. Add tests for the throttle

- [x] 3.1 Add a test that `createSegmentThrottle` commits immediately when `streaming` is false
- [x] 3.2 Add a test that streaming chunks are buffered and the latest is committed on the cadence
- [x] 3.3 Add a test that the stream end flushes buffered segments immediately
- [x] 3.4 Add a test that `flush()` commits any buffered segments
- [x] 3.5 Add a test that `dispose()` clears the pending timer and buffer
