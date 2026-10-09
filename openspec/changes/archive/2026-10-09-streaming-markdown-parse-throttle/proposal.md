## Why

During streaming, the message bubble re-parses the entire accumulated markdown on every chunk, which grows quadratically with content length. This was measured at 133ms for 32k characters across 800 chunks, causing visible lag in the TUI as long responses stream in.

## What Changes

- Add a throttled segment committer (`createSegmentThrottle`) that buffers the latest segments and commits them on a cadence instead of once per chunk.
- Wire the throttle into the pub/sub `handleUpdate` in `MessageBubbleInner` so the bubble re-renders at most once per cadence during streaming.
- Flush buffered segments immediately when the stream ends (`streaming === false`) or via an explicit `flush()`, so the completed content renders without delay.
- Clear any pending timer and buffered data on unsubscribe via `dispose()`.

## Capabilities

### New Capabilities
- `streaming-markdown-parse-throttle`: Throttles markdown re-parsing during streaming by committing accumulated segments on a cadence, flushing on stream end, and disposing cleanly on unsubscribe.

### Modified Capabilities
<!-- No existing spec-level requirements change; this is a new capability. -->

## Impact

- `src/tui/messageBubble.js` — adds `createSegmentThrottle(commit, throttleMs)` and wires it into `MessageBubbleInner`'s pub/sub `handleUpdate`.
- `tests/unit/tui/messageBubble.test.js` — adds 5 tests covering `createSegmentThrottle` commit-on-end, buffering, flush, and dispose behavior.
- No public API changes; the throttle is internal to the message bubble.

## Non-goals

- Not changing the markdown rendering pipeline itself (`markdown-rendering` spec).
- Not altering the streaming event model or pub/sub dedup behavior (`tui-streaming` spec).
- Not changing the virtualized scroll view (`tui-virtual-scroll-view` spec).
- Not introducing a configurable throttle interval; the 100ms cadence is fixed.
