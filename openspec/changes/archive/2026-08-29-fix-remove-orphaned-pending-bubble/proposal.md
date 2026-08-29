## Why

When the user sends back-to-back messages, an assistant `MessageBubble` is created immediately with empty content and `streaming: true`. If the user interrupts (ESC) before any content arrives, the bubble remains orphaned — showing just a spinner with no content. This is a visual glitch that leaves stale UI state.

## What Changes

- In `messageList.js`, after building the `newChildren` array from `renderData`, inspect the last message.
- If the last message is an assistant message with no content and `streaming === true`, pop it from `newChildren` before assigning to `childrenRef.current`.
- The data layer (`dataRef`, `idsRef`, `idToIdxRef`) is NOT modified — only the rendered children are filtered.

## Capabilities

### New Capabilities

- `tui-pending-bubble`: MessageList automatically removes orphaned pending assistant bubbles from the rendered children before display, preventing stale spinner UI when the user interrupts before content arrives.

### Modified Capabilities

- `tui-message-list`: The children rebuild loop now includes a post-map filter for pending assistant bubbles.

## Impact

- **Affected code:** `src/tui/messageList.js` — one block added after the children map (lines ~384-391)
- **No API changes:** No new exports, no new props, no changes to the imperative API
- **No dependency changes:** No new packages
- **Test impact:** Existing tests pass; the change is a render-layer filter that doesn't affect data layer behavior

## Non-goals

- Modifying `dataRef`, `idsRef`, or `idToIdxRef` — the data layer is untouched.
- Changing `handleInterrupt` or session state cleanup behavior.
- Adding a new tool or capability.
