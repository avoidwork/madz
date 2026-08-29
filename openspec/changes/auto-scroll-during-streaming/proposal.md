## Why

During streaming responses, the TUI fails to auto-scroll to the bottom. The streaming effect only scrolls when content length changes, and pub/sub deduplication drops identical streaming chunks, preventing the scroll chain from triggering. Users watching a streaming response see the cursor freeze while content continues to arrive off-screen.

## What Changes

- Relax pub/sub deduplication in `MessageBubbleInner.handleUpdate` to skip the dedup check when `data?.streaming` is true, allowing every streaming chunk to be appended.
- Modify the streaming `useEffect` in `MessageBubbleInner` to call `scrollToBottom()` on every streaming tick, not just when content length changes.
- Add unit tests for the streaming scroll behavior and dedup bypass.

## Capabilities

### Modified Capabilities

- `tui-streaming`: Streaming response handling in the TUI — scroll behavior during streaming must follow content in real time, and deduplication must not suppress streaming chunks.

## Impact

- `src/tui/messageBubble.js` — `handleUpdate` dedup logic and streaming `useEffect` scroll logic
- `src/tui/messageList.js` — no changes (onContentHeightChange remains dead during streaming; the fix works around it)
- Test file for messageBubble streaming behavior

## Non-goals

- Fix the `onContentHeightChange` dead path in messageList.js (out of scope — the scroll-to-bottom approach via ScrollContext already works)
- Refactor the pub/sub system or scroll architecture
- Address non-streaming scroll edge cases
