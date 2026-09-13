## Why

The TUI's streaming segment coalescing in `src/tui/messageList.js` `updateMessage` is purely type-based: it appends to the last segment if the incoming segment has the same type, otherwise it pushes a new segment. This fragments continuous messages when `reasoning` interleaves mid-sentence (e.g., message "The answer is", reasoning "…", message "42"), and merges genuinely unrelated messages that happen to follow reasoning. The desired behavior is documented in `docs/STREAMING.md`.

## What Changes

- Replace the type-only coalescing rule in `updateMessage` with a timing-aware + punctuation-aware rule implementing the Desired Behavior table from `docs/STREAMING.md`.
- Extract the coalescing decision into a pure, exported helper `coalesceSegments(existingSegments, newSegment, timeoutMs)` so it is directly unit-testable.
- Capture `Date.now()` at each stream event arrival in `src/tui/conversationArea.js` and store it on each segment as `{type, content, time}`.
- Update the `Message` typedef in `src/tui/messages.js` to document the optional `time` field on segments.
- Add instrumentation via the structured logger to log the real gap between segments for cross-type transitions, so the provisional 250ms threshold can be tuned against measured data.

## Capabilities

### New Capabilities
- `tui-streaming-coalescing`: Timing-aware and punctuation-aware coalescing of interleaved `message`/`reasoning` streaming segments.

### Modified Capabilities
- `tui-message-list`: The `updateMessage` segment coalescing behavior changes from type-only to timing-aware + punctuation-aware.
- `tui-streaming`: Stream events now carry a per-segment arrival timestamp used by the coalescing rule.

## Impact

- `src/tui/messageList.js` — `updateMessage` coalescing logic; new exported `coalesceSegments` helper and `SEGMENT_COALESCE_TIMEOUT_MS` constant.
- `src/tui/conversationArea.js` — stream event handler attaches `time: Date.now()` to each segment.
- `src/tui/messages.js` — `Message` typedef documents the optional `time` field on segments.
- `tests/unit/tui/messageList.test.js` — new unit tests for the coalescing behavior.
- No change to `src/tui/messageBubble.js` rendering.
