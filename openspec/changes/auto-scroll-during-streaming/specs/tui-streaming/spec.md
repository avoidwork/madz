## ADDED Requirements

### Requirement: Pub/sub deduplication SHALL be bypassed for streaming updates
When a streaming update is published via the pub/sub system, the `handleUpdate` function in `MessageBubbleInner` SHALL NOT skip the append when content is identical to the previous chunk. The dedup check must be bypassed when `data?.streaming` is truthy.

#### Scenario: Streaming dedup is bypassed
- **WHEN** `handleUpdate` receives data with `streaming: true` and `content` identical to the last chunk
- **THEN** the content is appended to the chunks array (dedup is skipped)

#### Scenario: Non-streaming dedup still applies
- **WHEN** `handleUpdate` receives data with `streaming: false` (or undefined) and `content` identical to the last chunk
- **THEN** the dedup check applies and the chunk is not appended

### Requirement: Streaming scroll effect SHALL scroll on every streaming tick
The streaming `useEffect` in `MessageBubbleInner` SHALL call `scrollToBottom()` on every render tick while `streaming` is true, not only when content length changes.

#### Scenario: Scroll on streaming tick without content growth
- **WHEN** `streaming` is true and `text.length` equals `prevContentLengthRef.current`
- **THEN** `scrollToBottom()` is still called

#### Scenario: Scroll stops when streaming ends
- **WHEN** `streaming` transitions from true to false
- **THEN** `scrollToBottom()` is no longer called and refs are reset
