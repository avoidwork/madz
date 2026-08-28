# Proposal: Remove renderWindow Message Limit from TUI Message List Panel

## Why

The TUI's `MessageList` component currently limits rendering to the last N messages (default 100, configurable via `tui.renderWindow` in `config.yaml`). While the data layer stores all messages, the virtual render window slices the React tree to only the last N bubbles. This means older messages are not visible in the scrollable view, even though they exist in memory.

For long conversations, users lose the ability to scroll back and view the full conversation history directly in the TUI. Removing this cap would allow the message list to render all messages, making the full conversation accessible through the existing `ScrollView` mechanism.

## What Changes

1. **Remove the `renderWindow` prop** from `MessageList` and `ConversationPanel` — it is no longer needed.
2. **Remove the slicing logic** in `src/tui/messageList.js` that limits `renderData` to the last N messages. Instead, render all message IDs from `idsRef.current`.
3. **Remove the `prunedIds` cleanup loop** — since all messages stay in scope, pub/sub topics for older messages remain valid.
4. **Remove the `renderWindow` config option** from `src/config/schemas/tui.js`.
5. **Remove the `renderWindow` prop** from `src/tui/app.js` where it's passed to `ConversationPanel`.
6. **Update JSDoc** comments referencing `renderWindow` in affected files.

## Files Changed

- `src/config/schemas/tui.js` — Remove `renderWindow` from Zod schema
- `src/tui/app.js` — Remove `renderWindow` prop from `ConversationPanel` createElement
- `src/tui/conversationPanel.js` — Remove `renderWindow` prop destructuring and pass-through
- `src/tui/messageList.js` — Remove `renderWindow` prop, replace slicing with full array, remove `prunedIds` cleanup

## Non-goals

- Performance optimization for very large message lists (thousands of messages)
- Adding pagination or virtual scrolling as a future enhancement
- Changing the data layer message storage behavior

## Risks

- Large conversations with thousands of messages may cause performance issues due to rendering all bubbles simultaneously
- The ScrollView must handle the increased content height correctly
