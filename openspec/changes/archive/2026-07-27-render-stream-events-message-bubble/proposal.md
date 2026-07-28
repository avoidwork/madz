## Why

The streaming pipeline captures all LangChain `streamEvents` and stores them in the `events` array on the message model, but the TUI never renders them. Users see no indication of tool calls, agent actions, chain events, or reasoning progress during streaming — only the final text output.

## What Changes

- Add `events` prop destructuring to `MessageBubble`
- Build an `eventsEl` following the existing rendering pattern (conditional rendering, Box wrapper, Text elements)
- Render `eventsEl` alongside `reasoningEl`, `toolCallEl`, `toolDisplayEl`

## Capabilities

### New Capabilities
<!-- None — existing tui-streaming capability already covers event capture -->

### Modified Capabilities
- `component-message-bubbles`: MessageBubble now conditionally renders stream events alongside reasoning, tool call, and tool call display content

## Impact

- **src/tui/messageBubble.js** — Add `events` to prop destructuring, build `eventsEl`, render alongside existing conditional elements
