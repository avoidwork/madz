## Why

Reasoning segments in assistant responses are prefixed with a unicode character (💭) at render time. This is a cosmetic artifact that clutters the reasoning display and is not part of the data layer. The prefix should be removed so reasoning segments render cleanly while remaining visually distinct from message content.

## What Changes

- Remove the `💭 ` prefix from reasoning segment rendering in `src/tui/messageBubble.js` line 282: change `` `💭 ` + seg.content`` to `seg.content`.
- Keep the gray color (`color: "gray"`) and offset styling (`marginLeft: 2`) so reasoning remains visually distinct from message content.
- Update the stale comment in `src/tui/messageList.js` line 179 that references "separate 💭 blocks" to remove the unicode reference (e.g., "separate reasoning blocks").
- Add/update a test in `tests/unit/tui/messageBubble.test.js` asserting that reasoning segments render without the `💭 ` prefix.

## Capabilities

### New Capabilities
<!-- None — this is a modification to an existing capability. -->

### Modified Capabilities
- `component-message-bubbles`: The MessageBubble component's reasoning segment rendering no longer prepends a unicode `💭 ` prefix. Reasoning segments still render as muted (gray) offset text, but without the unicode character.

## Impact

- `src/tui/messageBubble.js` — render layer, single source of the prefix.
- `src/tui/messageList.js` — stale comment only; no behavior change.
- `tests/unit/tui/messageBubble.test.js` — new/updated test asserting the prefix is absent.
- No changes to the data layer (`src/tui/conversationArea.js`, `src/stream/transformers/turn.js`).

## Non-goals

- No changes to the reasoning coalescing logic in `messageList.js` (only the comment is updated).
- No changes to the data layer that produces `{ type: "reasoning", content }` segments.
- No changes to gray color or offset styling — reasoning must remain visually distinct.
