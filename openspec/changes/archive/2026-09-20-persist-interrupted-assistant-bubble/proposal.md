## Why

When an assistant response is interrupted (via ESC or system interrupt) before producing message content, the TUI hides the assistant bubble entirely — even when it already contains reasoning or partial message segments. The user loses the visual indicator of what the agent was doing when it was interrupted. This is a rendering/display bug in the TUI message list.

## What Changes

- Extend the render guard in `src/tui/messageList.js` so an assistant bubble is NOT skipped when `data.segments` contains a `reasoning` or `message` segment with non-empty trimmed content, even when `streaming` is false and `content` is empty.
- Preserve the existing behavior: assistant bubbles with empty content, no segments, and `streaming=false` are still skipped.
- Add a regression test in `tests/unit/tui/messageList.test.js` verifying an interrupted assistant bubble (reasoning segments, empty content, `streaming=false`) is still rendered.

## Capabilities

### New Capabilities
<!-- None — this is a modification to an existing capability. -->

### Modified Capabilities
- `tui-message-list`: The render guard must keep assistant bubbles that carry non-empty `reasoning` or `message` segments even when `streaming` is false and `content` is empty.

## Impact

- `src/tui/messageList.js` — the render guard condition (lines 437-443) is extended.
- `tests/unit/tui/messageList.test.js` — a regression test is added.
- No changes to interrupt handling in `src/tui/conversationArea.js` (the state that triggers the guard is already correct).
- No API, dependency, or config changes.

## Non-goals

- No changes to `MessageBubble` rendering, styling, or segment coalescing logic.
- No changes to the imperative API surface or public exports.
- No changes to interrupt handling in `src/tui/conversationArea.js`.
- No changes to other segment types (e.g., tool-related segments do not keep the bubble).
