## Why

The conversation panel in `src/tui/messageList.js` enforces a 100-message limit only at the render layer via `idsRef.current.slice(-MAX_RENDER_MESSAGES)`. Messages are never removed from the underlying data structures (`idsRef`, `idToIdxRef`, `dataRef`, `contentRef`), causing unbounded memory growth as conversations accumulate messages. Long-running sessions can accumulate thousands of messages in memory, even though only 100 are visible.

## What Changes

- Enforce the 100-message cap at the data layer in `addMessage()` — shift off the oldest message when the array exceeds `MAX_RENDER_MESSAGES`.
- Enforce the 100-message cap at the data layer in `setMessages()` — truncate the input to the last 100 messages before building internal state.
- Clean up orphaned data (`dataRef`, `contentRef`, pub/sub topics) when messages are shifted off.
- Add regression tests verifying the cap at the data layer.

## Capabilities

### New Capabilities
- `message-cap`: Defines the requirement that the MessageList data layer enforces a maximum message count, ensuring memory is bounded regardless of conversation length.

### Modified Capabilities
- None

## Impact

- **Affected code:** `src/tui/messageList.js` — `addMessage()` and `setMessages()` imperative APIs.
- **Affected tests:** `tests/unit/messageListApi.test.js` — new test cases for cap enforcement.
- **Behavioral change:** Sessions with more than 100 messages will now only retain the last 100 in memory, consistent with existing render-layer behavior.
- **Non-breaking:** The public imperative API surface (`addMessage`, `setMessages`, `getMessageCount`) remains unchanged. Only internal state management differs.

## Non-goals

- Changing the value of `MAX_RENDER_MESSAGES` — that remains a configurable constant.
- Adding a configurable cap limit — the cap value is not parameterized in this change.
- Modifying session persistence/restore logic outside of `messageList.js`.
- Adding pagination or "load older messages" functionality.