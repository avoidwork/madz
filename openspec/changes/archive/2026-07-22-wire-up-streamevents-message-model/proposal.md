## Why

The TUI has partial plumbing for event data — the message model has `activeToolCall`, `toolCallDisplay`, and `reasoningContent` — but the streaming handler only captures `message` events. All other event types from LangChain's `streamEvents` are ignored, so the TUI can't display tool call progress, agent actions, chain events, or reasoning content.

## What Changes

- Add an `events` array field to the Message model to store raw stream events
- Update `createStreamingHandler` in app.js to handle all LangChain event types (`on_chat_model_stream`, `on_tool_start/end/error`, `on_agent_*`, `on_chain_*`)
- Populate existing message fields (`reasoningContent`, `activeToolCall`, `toolCallDisplay`) from event data
- Update MessageList to pass through events in `addMessage`, `updateMessage`, and `setMessages`
- Ensure `finalizeStreaming` correctly passes accumulated reasoning and events

## Capabilities

### New Capabilities
- `tui-streaming`: Capture and store LangChain streamEvents on the message model, enabling rich event data (tool calls, agent actions, chain events, reasoning) to flow through the TUI pipeline

### Modified Capabilities
<!-- None — no existing spec-level requirements are changing -->

## Impact

- **src/tui/messages.js** — Message typedef gains `events` field
- **src/tui/messageList.js** — `addMessage`, `updateMessage`, `setMessages` pass through events
- **src/tui/app.js** — `createStreamingHandler` handles all event types; `finalizeStreaming` passes accumulated data
- **src/tui/messageBubble.js** — No changes (rendering path already exists, out of scope)
- **LangChain dependency** — No version changes; uses existing `streamEvents` API
