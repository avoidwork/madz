## Context

The message bubble (`MessageBubbleInner` in `src/tui/messageBubble.js`) subscribes to a pub/sub topic and, on every published chunk during streaming, replaces its segments state. Each `setSegments` triggers a React re-render that re-parses the entire accumulated markdown via `MarkdownText`. Because the accumulated content grows with each chunk, the cost of re-parsing grows quadratically with content length — measured at 133ms for 32k chars across 800 chunks.

The change is confined to the message bubble. The streaming event model, pub/sub dedup, and virtualized scroll view are unchanged.

## Goals / Non-Goals

**Goals:**
- Reduce the number of markdown re-parses during streaming by committing segments on a cadence rather than once per chunk.
- Guarantee the final content renders immediately when the stream ends.
- Keep the throttle pure and unit-testable, independent of React.

**Non-Goals:**
- Changing the markdown rendering pipeline or its spec.
- Altering the streaming event model, pub/sub dedup, or scroll behavior.
- Making the throttle interval configurable (fixed at 100ms).
- Changing the public API of `MessageBubbleInner`.

## Decisions

### Decision: Introduce a pure `createSegmentThrottle(commit, throttleMs)` committer

A standalone factory returns `{ push, flush, dispose }`. It buffers the latest segments and schedules a commit on a `setTimeout` cadence. This keeps the throttling logic testable without React, matching the existing `createPubSub` test pattern.

**Alternatives considered:**
- Inline throttling inside `handleUpdate` — harder to test and mixes concerns.
- A React hook (`useThrottle`) — couples the logic to the component lifecycle and complicates unit tests.

### Decision: Commit the latest buffered segments, not a queue

`push(segments, streaming)` overwrites `pending` with the latest segments rather than enqueuing. During streaming, only the most recent snapshot matters; intermediate snapshots are discarded. This bounds memory and avoids a backlog of stale renders.

### Decision: Flush immediately on stream end

When `streaming === false`, `push` clears any pending timer and commits immediately. The `handleUpdate` also calls `throttle.flush()` on the finalize path (stream ended without a segments payload). This ensures the completed content renders without waiting for the next cadence.

### Decision: `dispose()` clears the timer and buffer on unsubscribe

The cleanup function returned by the `useEffect` calls `throttle.dispose()`, clearing any pending timer and buffered data to prevent a commit after the bubble unmounts.

## Risks / Trade-offs

- **Reduced render frequency during streaming** → The bubble updates at most once per 100ms instead of per chunk. This is the intended trade-off; the final flush guarantees the last content is not lost.
- **Timer leak if not disposed** → Mitigated by `dispose()` in the effect cleanup.
- **A commit may fire after `streaming` flips to false if a timer was already scheduled** → Mitigated by clearing the timer in the `streaming === false` branch before committing.
