## Why

A message bubble's streaming status is not cleared when a new message segment arrives after it. A pending AI message that is interrupted by a system message still shows a spinner erroneously, even though the AI stream has ended. The `streaming` flag on an assistant bubble is only cleared via `finalizeStreaming` or `handleInterrupt`; when a subsequent message segment (e.g., a system message) is added via `addMessage`, the prior assistant bubble's `streaming` flag is left stale at `true`, so the spinner persists.

## What Changes

- Ensure every path that ends an assistant stream reliably clears the `streaming` flag on the bubble.
- When a new message segment is added after an assistant message, clear any stale `streaming: true` on the prior assistant bubble so the spinner stops and the bubble renders as completed.
- Add a defensive fallback in the message bubble rendering so a stale `streaming` flag cannot keep a spinner visible once a subsequent segment has arrived.

## Capabilities

### New Capabilities
<!-- None introduced -->

### Modified Capabilities
- `component-message-bubbles`: The MessageBubble streaming-status lifecycle SHALL clear the `streaming` flag when a new message segment arrives after the assistant message, so the spinner stops and the bubble renders as completed.
- `tui-streaming`: The streaming lifecycle SHALL guarantee that every path ending an assistant stream (normal completion, interrupt, error, or a subsequent message segment) clears the `streaming` flag on the assistant bubble.

## Impact

- `src/tui/messageBubble.js` — `pendingState` computation and `localStreaming` handling.
- `src/tui/conversationArea.js` — `addMessage`, `finalizeStreaming`, `handleInterrupt`, and the streaming error paths.
- `src/tui/messageList.js` — `addMessage` / `updateMessage` behavior for clearing stale streaming flags.
- Tests: `tests/unit/tui/messageBubble.test.js`, `tests/unit/tui/messageList.test.js`, `tests/unit/tui/conversationArea.test.js`.

## Non-goals

- No change to the visual styling of the spinner or completed bubbles.
- No change to the streaming content accumulation or segment coalescing logic.
- No change to session persistence or checkpointing.
