## ADDED Requirements

### Requirement: Streaming markdown re-parse SHALL be throttled
During streaming, the message bubble SHALL commit accumulated segments on a cadence rather than re-parsing the entire markdown on every chunk, so the bubble re-renders at most once per cadence.

#### Scenario: Streaming chunks are buffered and committed on the cadence
- **WHEN** `createSegmentThrottle(commit, throttleMs)` is created and `push(segments, true)` is called multiple times within the cadence
- **THEN** `commit` is invoked at most once per `throttleMs` with the latest buffered segments

#### Scenario: Only the latest buffered segments are committed
- **WHEN** multiple `push(segments, true)` calls occur before the cadence fires
- **THEN** `commit` receives only the most recent segments array, not an intermediate snapshot

### Requirement: Streaming throttle SHALL flush immediately when the stream ends
When `streaming` becomes `false`, the throttle SHALL commit any buffered segments immediately so the completed content renders without waiting for the next cadence.

#### Scenario: Stream end flushes buffered segments
- **WHEN** `push(segments, false)` is called after buffered streaming segments
- **THEN** `commit` is invoked immediately with the buffered segments

#### Scenario: Explicit flush commits buffered segments
- **WHEN** `flush()` is called while segments are buffered
- **THEN** `commit` is invoked immediately with the buffered segments

### Requirement: Streaming throttle SHALL dispose cleanly on unsubscribe
The throttle SHALL clear any pending timer and buffered data on `dispose()` so no commit fires after the bubble unmounts.

#### Scenario: Dispose clears the pending timer and buffer
- **WHEN** `dispose()` is called while a commit is scheduled
- **THEN** no `commit` is invoked after the cadence elapses

### Requirement: Message bubble SHALL wire the throttle into streaming updates
`MessageBubbleInner` SHALL use `createSegmentThrottle` in its pub/sub `handleUpdate`, pushing published segments through the throttle and flushing when the stream ends.

#### Scenario: Bubble commits segments through the throttle
- **WHEN** a pub/sub update publishes `segments` with `streaming: true`
- **THEN** the throttle buffers and commits the segments on the cadence

#### Scenario: Bubble flushes on stream end
- **WHEN** a pub/sub update publishes `streaming: false` (with or without a segments payload)
- **THEN** the throttle flushes any buffered segments so the completed content renders
