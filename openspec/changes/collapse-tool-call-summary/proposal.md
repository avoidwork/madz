## Why

The message bubble's completed-tool-calls summary lists every tool call individually, so a turn that invokes the same tool many times (e.g., `read_file`) produces a long, repetitive line. This makes the conversation panel noisy and hard to scan on long multi-hour sessions.

## What Changes

- Aggregate completed tool calls into a `{ [name]: count }` object at the source (streaming event handler) instead of a flat `string[]`.
- Render the summary as `⚡ N tool calls: read_file ×10, searchCode`, hiding `×1` for tools called once.
- Preserve insertion order (first-call order) so the summary reads as a record of what happened, not a ranking.
- Normalize legacy array-shaped calls to the count map on session restore so old transcripts still render correctly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `component-message-bubbles`: Add a requirement for the completed tool calls summary — the bubble SHALL render a collapsed count map of completed tool calls, hiding `×1` for single calls and preserving insertion order.

## Impact

- `src/tui/conversationArea.js` — aggregation source changes from `string[]` to count map.
- `src/tui/messageBubble.js` — render path uses a formatter instead of `.length`/`.join()`.
- `src/tui/messageList.js` — height calc and session restore adapt to the count map shape.
- `src/tui/messages.js` — new shared helpers (`normalizeCompletedToolCalls`, `hasCompletedToolCalls`, `formatCompletedToolCalls`).
- Tests: `tests/unit/tui/messages.test.js`, `tests/unit/tui/messageBubble.test.js`.

## Non-goals

- Changing the `activeToolCall` "Running: ..." indicator.
- Changing the `toolCallDisplay` result lines.
- Any change to the status bar.
- Sorting by count descending.
